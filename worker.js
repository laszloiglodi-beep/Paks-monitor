export default {
  async fetch() {
    const OAH_URL =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    const VIZ_URL =
      "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

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

    let blocks = ["—", "—", "—", "—"];
    let oahTime = "—";
    let oahStatus = "OK";

    let water = null;
    let flow = null;
    let temp = null;
    let riverTime = "—";
    let riverStatus = "OK";

    // -------------------------
    // OAH
    // -------------------------
    try {
      const r = await fetch(OAH_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 PaksMonitor"
        }
      });

      if (!r.ok) throw new Error("OAH HTTP " + r.status);

      const text = clean(await r.text());

      const date = text.match(
        /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
      );

      if (date) oahTime = date[1];

      const power = text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );

      if (power) {
        blocks = [power[1], power[2], power[3], power[4]];
      } else {
        oahStatus = "Az OAH adatsor nem található";
      }
    } catch (e) {
      oahStatus = "OAH kapcsolat sikertelen";
    }

    // -------------------------
    // VÍZÜGY
    // -------------------------
    try {
      const r = await fetch(VIZ_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 PaksMonitor"
        }
      });

      if (!r.ok) throw new Error("Vízügy HTTP " + r.status);

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
        riverStatus = "A paksi vízügyi adatsor nem található";
      }
    } catch (e) {
      riverStatus = "Vízügyi kapcsolat sikertelen";
    }

    const total = blocks.every((x) => x !== "—")
      ? blocks.reduce((a, b) => a + Number(b), 0)
      : "—";

    const fmt1 = (v) =>
      typeof v === "number"
        ? v.toLocaleString("hu-HU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : "—";

    const waterText =
      typeof water === "number" ? `${water} cm` : "— cm";

    const shutdownDistance =
      typeof water === "number" ? water - (-134) : null;

    const safetyDistance =
      typeof water === "number" ? water - (-144) : null;

    let riverClass = "ok";
    let riverLabel = "Normál tartomány";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "Biztonsági határ alatt";
      } else if (water <= -134) {
        riverClass = "warning";
        riverLabel = "Leállási tartomány";
      } else if (water <= -129) {
        riverClass = "warning";
        riverLabel = "Közel a leállási küszöbhöz";
      }
    }

    // A skála: -110 ... -150 cm
    let markerPct = 0;
    if (typeof water === "number") {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const distanceText =
      typeof shutdownDistance === "number"
        ? shutdownDistance >= 0
          ? `${shutdownDistance} cm-re a −134 cm-es leállási küszöbtől`
          : `${Math.abs(shutdownDistance)} cm-rel a −134 cm-es küszöb alatt`
        : "—";

    const safetyText =
      typeof safetyDistance === "number"
        ? safetyDistance >= 0
          ? `${safetyDistance} cm-re a −144 cm-es biztonsági határtól`
          : `${Math.abs(safetyDistance)} cm-rel a −144 cm-es határ alatt`
        : "—";

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="refresh" content="300">
<meta name="theme-color" content="#07101d">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="PAKS">
<title>PAKS Monitor</title>

<style>
:root{
  --bg:#07101d;
  --card:#101d2d;
  --inner:#091524;
  --line:#29405a;
  --muted:#9cafc7;
  --green:#72df68;
  --blue:#55adff;
  --orange:#ffae32;
  --red:#ff5f5f;
}

*{box-sizing:border-box}

body{
  margin:0;
  background:var(--bg);
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
}

main{
  max-width:620px;
  margin:auto;
  padding:20px;
}

h1{
  margin:8px 0 22px;
  font-size:31px;
}

.card{
  background:var(--card);
  border:1px solid var(--line);
  border-radius:22px;
  padding:18px;
  margin-bottom:17px;
}

.label{
  color:var(--muted);
  font-size:13px;
  letter-spacing:.02em;
}

.total{
  margin:5px 0 18px;
  font-size:50px;
  line-height:1;
  font-weight:850;
  color:var(--green);
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}

.box,.metric{
  background:var(--inner);
  border-radius:15px;
  padding:15px;
}

.box strong{
  font-size:28px;
}

.river{
  margin:5px 0 8px;
  font-size:50px;
  line-height:1;
  font-weight:850;
  color:var(--blue);
}

.status{
  margin:0 0 16px;
  font-size:15px;
  font-weight:700;
}

.status.ok{color:var(--green)}
.status.warning{color:var(--orange)}
.status.danger{color:var(--red)}

.two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px;
}

.metric b{
  display:block;
  margin-top:5px;
  font-size:22px;
}

.gaugeWrap{
  margin-top:25px;
  padding-top:8px;
}

.gauge{
  position:relative;
  height:18px;
  border-radius:12px;
  background:
    linear-gradient(
      90deg,
      #52c75a 0%,
      #52c75a 60%,
      #ffae32 60%,
      #ffae32 85%,
      #ef5350 85%,
      #ef5350 100%
    );
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-10px;
  width:4px;
  height:38px;
  background:#fff;
  border-radius:2px;
  transform:translateX(-50%);
  box-shadow:0 0 0 2px rgba(0,0,0,.25);
}

.marker::after{
  content:"";
  position:absolute;
  top:-7px;
  left:50%;
  width:0;
  height:0;
  transform:translateX(-50%);
  border-left:7px solid transparent;
  border-right:7px solid transparent;
  border-bottom:9px solid #fff;
}

.scaleLabels{
  position:relative;
  height:46px;
  margin-top:8px;
  font-size:12px;
  color:var(--muted);
}

.scaleLabels span{
  position:absolute;
  transform:translateX(-50%);
}

.scaleLabels .normal{left:6%}
.scaleLabels .shutdown{
  left:60%;
  color:var(--orange);
}
.scaleLabels .safety{
  left:85%;
  color:var(--red);
}

.distance{
  margin-top:8px;
  background:var(--inner);
  border-radius:14px;
  padding:14px;
  line-height:1.55;
}

.distance strong{
  display:block;
  font-size:16px;
}

.info{
  color:#8fa3bb;
  font-size:12px;
  line-height:1.55;
  margin-top:15px;
}

.footer{
  text-align:center;
  color:#8fa3bb;
  font-size:12px;
  margin:20px 0 8px;
}
</style>
</head>

<body>
<main>

<h1>⚛️ PAKS MONITOR</h1>

<div class="card">
  <div class="label">PAKSI ATOMERŐMŰ ÖSSZTELJESÍTMÉNYE</div>
  <div class="total">${total} MW</div>

  <div class="grid">
    ${blocks.map((v,i)=>`
      <div class="box">
        <div class="label">${i+1}. BLOKK</div>
        <strong>${v} MW</strong>
      </div>
    `).join("")}
  </div>

  <div class="info">
    Forrás: OAH<br>
    Mérés: ${oahTime}<br>
    ${oahStatus}
  </div>
</div>

<div class="card">
  <div class="label">🌊 DUNA – PAKS</div>
  <div class="river">${waterText}</div>

  <div class="status ${riverClass}">
    ${riverLabel}
  </div>

  <div class="two">
    <div class="metric">
      <div class="label">VÍZHOZAM</div>
      <b>${fmt1(flow)} m³/s</b>
    </div>

    <div class="metric">
      <div class="label">VÍZHŐMÉRSÉKLET</div>
      <b>${fmt1(temp)} °C</b>
    </div>
  </div>

  <div class="gaugeWrap">
    <div class="gauge">
      ${typeof water === "number" ? `<div class="marker"></div>` : ""}
    </div>

    <div class="scaleLabels">
      <span class="normal">normál</span>
      <span class="shutdown">−134 cm</span>
      <span class="safety">−144 cm</span>
    </div>
  </div>

  <div class="distance">
    <strong>${distanceText}</strong>
    ${safetyText}
  </div>

  <div class="info">
    Forrás: Vízügy<br>
    Mérés: ${riverTime}<br>
    ${riverStatus}
  </div>
</div>

<div class="footer">
  Automatikus frissítés: 5 percenként
</div>

</main>
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
