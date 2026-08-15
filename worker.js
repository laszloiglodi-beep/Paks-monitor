export default {
  async fetch() {
    const OAH_URL =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    const VIZ_URL =
      "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

    const PUBLIC_URL =
      "https://paks-monitor.laszlo-iglodi.workers.dev";

    const clean = (html) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/gi, " ")
        .replace(/&minus;/gi, "-")
        .replace(/&#8722;/gi, "-")
        .replace(/\s+/g, " ")
        .trim();

    const fmt1 = (v) =>
      typeof v === "number"
        ? v.toLocaleString("hu-HU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : "—";

    const shortTime = (s) => {
      const m = String(s).match(/(\d{2}:\d{2})/);
      return m ? m[1] : "—";
    };

    let blocks = ["—", "—", "—", "—"];
    let oahTime = "—";
    let oahStatus = "OK";

    let water = null;
    let flow = null;
    let temp = null;
    let riverTime = "—";
    let riverStatus = "OK";

    // OAH
    try {
      const r = await fetch(OAH_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 PaksMonitor"
        }
      });

      if (!r.ok) throw new Error();

      const text = clean(await r.text());

      const date = text.match(
        /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
      );

      if (date) oahTime = date[1];

      const power = text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );

      if (power) {
        blocks = [
          power[1],
          power[2],
          power[3],
          power[4]
        ];
      } else {
        oahStatus = "ADATHIBA";
      }
    } catch {
      oahStatus = "KAPCSOLATI HIBA";
    }

    // Vízügy
    try {
      const r = await fetch(VIZ_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 PaksMonitor"
        }
      });

      if (!r.ok) throw new Error();

      const text = clean(await r.text());

      const row = text.match(
        /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
      );

      if (row) {
        riverTime = row[1];
        water = Number(row[2]);

        if (row[3] !== "-")
          flow = Number(row[3].replace(",", "."));

        if (row[4] !== "-")
          temp = Number(row[4].replace(",", "."));
        else if (row[5] !== "-")
          temp = Number(row[5].replace(",", "."));
      } else {
        riverStatus = "ADATHIBA";
      }
    } catch {
      riverStatus = "KAPCSOLATI HIBA";
    }

    const total = blocks.every((x) => x !== "—")
      ? blocks.reduce((a, b) => a + Number(b), 0)
      : "—";

    const waterText =
      typeof water === "number"
        ? `${water} cm`
        : "— cm";

    const shutdownDistance =
      typeof water === "number"
        ? water + 134
        : null;

    const safetyDistance =
      typeof water === "number"
        ? water + 144
        : null;

    let riverClass = "normal";
    let riverLabel = "NORMÁL";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "KRITIKUS";
      } else if (water <= -134) {
        riverClass = "warning";
        riverLabel = "LEÁLLÁSI TARTOMÁNY";
      } else if (water <= -129) {
        riverClass = "warning";
        riverLabel = "FIGYELMEZTETÉS";
      }
    }

    let markerPct = 0;

    if (typeof water === "number") {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#030812">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="Paks Adatok">
<title>PAKS aktuális adatok</title>

<style>
:root{
  --bg:#030812;
  --panel:#07111d;
  --panel2:#0d1825;
  --border:#1c3d58;
  --muted:#91a0b2;
  --green:#66df57;
  --blue:#4aa9ff;
  --orange:#ffad30;
  --red:#ff5b60;
  --purple:#c04cff;
}

*{box-sizing:border-box}

html,body{
  margin:0;
  width:100%;
  height:100%;
  overflow:hidden;
  background:#030812;
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
}

body{
  display:flex;
  justify-content:center;
}

.app{
  width:min(100%,500px);
  height:100dvh;
  padding:
    max(8px,env(safe-area-inset-top))
    10px
    max(6px,env(safe-area-inset-bottom));

  display:grid;
  grid-template-rows:auto auto auto auto;
  gap:6px;
}

/* FEJLÉC */

.header{
  min-height:38px;
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:7px;
}

.logo{
  width:34px;
  height:34px;
  border-radius:10px;
  display:grid;
  place-items:center;
  font-size:21px;
  background:linear-gradient(145deg,#b84fff,#57107e);
}

.title{
  font-size:18px;
  line-height:1;
  font-weight:950;
  letter-spacing:-.4px;
}

.live{
  display:flex;
  align-items:center;
  gap:5px;
  padding:4px 7px;
  border-radius:999px;
  background:#0c2111;
  border:1px solid #275930;
  color:#72e569;
  font-size:9px;
  font-weight:900;
}

.dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#72e569;
  box-shadow:0 0 7px #72e569;
}

/* PANELEK */

.card{
  background:linear-gradient(145deg,#0a1420,#07101a);
  border:1px solid var(--border);
  border-radius:15px;
  overflow:hidden;
}

.inner{
  padding:9px 10px;
}

.cardTitle{
  color:#a3afbd;
  font-size:9px;
  font-weight:800;
  letter-spacing:.4px;
}

/* PAKS */

.powerTop{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  margin:3px 0 6px;
}

.total{
  color:var(--green);
  font-size:34px;
  line-height:1;
  font-weight:950;
  letter-spacing:-1px;
}

.totalLabel{
  color:#748397;
  font-size:8px;
  padding-bottom:2px;
}

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
}

.block{
  min-height:44px;
  padding:6px 8px;
  background:var(--panel2);
  border-radius:9px;
  border:1px solid #162b3e;
}

.blockName{
  color:#8e9daf;
  font-size:8px;
}

.blockValue{
  margin-top:1px;
  font-size:17px;
  line-height:1;
  font-weight:900;
}

.source{
  padding:5px 10px 6px;
  border-top:1px solid #172d40;
  color:#728398;
  font-size:8px;
}

/* DUNA */

.riverTop{
  display:flex;
  justify-content:space-between;
  align-items:flex-end;
  margin:3px 0 5px;
}

.water{
  color:var(--blue);
  font-size:34px;
  line-height:1;
  font-weight:950;
  letter-spacing:-1px;
}

.state{
  font-size:9px;
  font-weight:900;
  padding-bottom:2px;
}

.normal{color:var(--green)}
.warning{color:var(--orange)}
.danger{color:var(--red)}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
}

.metric{
  padding:6px 8px;
  background:var(--panel2);
  border-radius:9px;
}

.metricName{
  color:#8e9daf;
  font-size:8px;
}

.metricValue{
  margin-top:1px;
  font-size:15px;
  font-weight:900;
}

.gauge{
  position:relative;
  height:9px;
  margin-top:7px;
  border-radius:999px;
  background:
    linear-gradient(
      90deg,
      #50c75a 0 60%,
      #ffad30 60% 85%,
      #ef555b 85% 100%
    );
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-5px;
  width:3px;
  height:19px;
  border-radius:2px;
  background:#fff;
  transform:translateX(-50%);
  box-shadow:0 0 6px #fff;
}

.scale{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  margin-top:3px;
  font-size:7px;
}

.scale span:nth-child(1){color:#7e8d9d}
.scale span:nth-child(2){text-align:center;color:var(--orange)}
.scale span:nth-child(3){text-align:right;color:var(--red)}

.distances{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
  margin-top:5px;
}

.distance{
  padding:5px 7px;
  background:var(--panel2);
  border-radius:9px;
}

.distanceValue{
  font-size:13px;
  font-weight:950;
}

.distanceLabel{
  color:#7e8d9d;
  font-size:6.5px;
}

/* ALSÓ SÁV */

.bottom{
  display:grid;
  grid-template-columns:.7fr .45fr 1.7fr;
  align-items:center;
  min-height:58px;
  border:1px solid #17324a;
  background:#06101a;
  border-radius:14px;
  overflow:hidden;
}

.refresh{
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  padding:5px;
  border-right:1px solid #17324a;
  color:#8090a3;
  font-size:7px;
  text-align:center;
  line-height:1.2;
}

.signature{
  height:100%;
  display:flex;
  align-items:center;
  justify-content:center;
  border-right:1px solid #17324a;
  color:var(--purple);
  font-size:11px;
  font-weight:950;
  letter-spacing:2px;
}

.share{
  padding:5px 6px;
}

.shareTitle{
  color:#8998aa;
  font-size:7px;
  margin-bottom:3px;
}

.shareRow{
  display:grid;
  grid-template-columns:1fr 58px;
  gap:4px;
}

.url{
  min-width:0;
  height:28px;
  display:flex;
  align-items:center;
  padding:0 6px;
  border-radius:7px;
  border:1px solid #9d38cf;
  background:#170b20;
  color:#d253ff;
  font-size:6.5px;
  text-decoration:none;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
}

.copy{
  height:28px;
  border:none;
  border-radius:7px;
  background:#14202c;
  color:#fff;
  font-size:7px;
  font-weight:900;
}

.toast{
  position:fixed;
  left:50%;
  bottom:18px;
  transform:translateX(-50%) translateY(10px);
  opacity:0;
  padding:7px 11px;
  border-radius:999px;
  background:#0e2715;
  border:1px solid #347b40;
  color:#7bea70;
  font-size:11px;
  font-weight:800;
  transition:.2s;
  pointer-events:none;
}

.toast.show{
  opacity:1;
  transform:translateX(-50%) translateY(0);
}

/* NAGYOBB KIJELZŐ */

@media(min-width:760px){
  .app{
    max-width:1100px;
    grid-template-columns:1fr 1fr;
    grid-template-rows:auto 1fr auto;
  }

  .header{
    grid-column:1 / -1;
  }

  .bottom{
    grid-column:1 / -1;
  }

  .title{
    font-size:26px;
  }

  .total,
  .water{
    font-size:52px;
  }

  .blockValue{
    font-size:24px;
  }

  .metricValue{
    font-size:22px;
  }
}

</style>

<script>
function copyLink(){
  const link = "${PUBLIC_URL}";

  if(navigator.clipboard){
    navigator.clipboard.writeText(link).then(showToast);
  }else{
    window.prompt("Másold ki a linket:",link);
  }
}

function showToast(){
  const t = document.getElementById("toast");
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),1500);
}

setTimeout(()=>{
  location.reload();
},300000);
</script>

</head>

<body>

<div class="app">

  <header class="header">

    <div class="logo">
      ⚛️
    </div>

    <div class="title">
      PAKS AKTUÁLIS ADATOK
    </div>

    <div class="live">
      <span class="dot"></span>
      ÉLŐ
    </div>

  </header>


  <section class="card">

    <div class="inner">

      <div class="cardTitle">
        PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
      </div>

      <div class="powerTop">

        <div class="total">
          ${total} MW
        </div>

        <div class="totalLabel">
          ÖSSZTELJESÍTMÉNY
        </div>

      </div>

      <div class="blocks">

        <div class="block">
          <div class="blockName">1. BLOKK</div>
          <div class="blockValue">${blocks[0]} MW</div>
        </div>

        <div class="block">
          <div class="blockName">2. BLOKK</div>
          <div class="blockValue">${blocks[1]} MW</div>
        </div>

        <div class="block">
          <div class="blockName">3. BLOKK</div>
          <div class="blockValue">${blocks[2]} MW</div>
        </div>

        <div class="block">
          <div class="blockName">4. BLOKK</div>
          <div class="blockValue">${blocks[3]} MW</div>
        </div>

      </div>

    </div>

    <div class="source">
      OAH • ${shortTime(oahTime)} • ${oahStatus}
    </div>

  </section>


  <section class="card">

    <div class="inner">

      <div class="cardTitle">
        🌊 DUNA VÍZÁLLÁSA PAKSNÁL
      </div>

      <div class="riverTop">

        <div class="water">
          ${waterText}
        </div>

        <div class="state ${riverClass}">
          ${riverLabel}
        </div>

      </div>

      <div class="metrics">

        <div class="metric">
          <div class="metricName">VÍZHOZAM</div>
          <div class="metricValue">
            ${fmt1(flow)} m³/s
          </div>
        </div>

        <div class="metric">
          <div class="metricName">VÍZHŐMÉRSÉKLET</div>
          <div class="metricValue">
            ${fmt1(temp)} °C
          </div>
        </div>

      </div>

      <div class="gauge">
        ${
          typeof water === "number"
            ? `<div class="marker"></div>`
            : ""
        }
      </div>

      <div class="scale">
        <span>NORMÁL</span>
        <span>−134 CM</span>
        <span>−144 CM</span>
      </div>

      <div class="distances">

        <div class="distance">
          <div class="distanceValue">
            ${
              shutdownDistance !== null
                ? Math.abs(shutdownDistance) + " cm"
                : "—"
            }
          </div>
          <div class="distanceLabel">
            LEÁLLÁSI KÜSZÖBIG
          </div>
        </div>

        <div class="distance">
          <div class="distanceValue">
            ${
              safetyDistance !== null
                ? Math.abs(safetyDistance) + " cm"
                : "—"
            }
          </div>
          <div class="distanceLabel">
            BIZTONSÁGI HATÁRIG
          </div>
        </div>

      </div>

    </div>

    <div class="source">
      VÍZÜGY • ${shortTime(riverTime)} • ${riverStatus}
    </div>

  </section>


  <footer class="bottom">

    <div class="refresh">
      AUTOMATIKUS<br>FRISSÍTÉS<br>5 PERC
    </div>

    <div class="signature">
      IGLÓDI
    </div>

    <div class="share">

      <div class="shareTitle">
        🔗 PARANCSIKON / MEGOSZTÁS
      </div>

      <div class="shareRow">

        <a
          class="url"
          href="${PUBLIC_URL}"
          target="_blank"
          rel="noopener"
        >
          ${PUBLIC_URL}
        </a>

        <button
          class="copy"
          onclick="copyLink()"
        >
          MÁSOLÁS
        </button>

      </div>

    </div>

  </footer>

</div>

<div class="toast" id="toast">
  ✓ LINK MÁSOLVA
</div>

</body>
</html>`;

    return new Response(html,{
      headers:{
        "content-type":"text/html;charset=UTF-8",
        "cache-control":"no-store"
      }
    });
  }
};
