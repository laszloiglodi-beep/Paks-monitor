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

    try {
      const r = await fetch(OAH_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
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
        blocks = [power[1], power[2], power[3], power[4]];
      } else {
        oahStatus = "OAH adathiba";
      }
    } catch {
      oahStatus = "OAH kapcsolat hiba";
    }

    try {
      const r = await fetch(VIZ_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
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
        riverStatus = "Vízügy adathiba";
      }
    } catch {
      riverStatus = "Vízügy kapcsolat hiba";
    }

    const total = blocks.every(x => x !== "—")
      ? blocks.reduce((a, b) => a + Number(b), 0)
      : "—";

    const fmt1 = v =>
      typeof v === "number"
        ? v.toLocaleString("hu-HU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : "—";

    const shortTime = s => {
      const m = String(s).match(/(\d{2}:\d{2})/);
      return m ? m[1] : "—";
    };

    const waterText =
      typeof water === "number" ? `${water} cm` : "— cm";

    const shutdownDistance =
      typeof water === "number" ? water + 134 : null;

    const safetyDistance =
      typeof water === "number" ? water + 144 : null;

    let riverClass = "ok";
    let riverLabel = "NORMÁL TARTOMÁNY";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "KRITIKUS VÍZSZINT";
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

<meta name="viewport"
content="width=device-width,initial-scale=1,viewport-fit=cover">

<meta http-equiv="refresh" content="300">

<meta name="theme-color" content="#05080d">

<meta name="apple-mobile-web-app-capable" content="yes">

<meta name="apple-mobile-web-app-title"
content="PAKS ADATOK">

<title>PAKS aktuális adatok</title>

<meta property="og:title"
content="PAKS aktuális adatok">

<meta property="og:description"
content="A Paksi Atomerőmű aktuális blokkteljesítménye és a Duna paksi vízállása egy helyen.">

<meta property="og:type"
content="website">

<meta property="og:url"
content="https://paks-monitor.laszlo-iglodi.workers.dev">

<meta name="twitter:card"
content="summary">

<style>

*{
  box-sizing:border-box;
}

html,body{
  margin:0;
  width:100%;
  height:100%;
  background:#05080d;
  color:white;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}

body{
  overflow:hidden;
}

main{
  width:100%;
  max-width:500px;
  height:100dvh;
  margin:auto;

  padding:
    max(7px,env(safe-area-inset-top))
    11px
    max(5px,env(safe-area-inset-bottom));

  display:flex;
  flex-direction:column;
  gap:6px;
}

.header{
  height:38px;
  display:flex;
  align-items:center;
  justify-content:space-between;
  flex-shrink:0;
}

.brand{
  display:flex;
  align-items:center;
  gap:7px;
}

.atom{
  width:32px;
  height:32px;
  border-radius:9px;
  display:grid;
  place-items:center;
  font-size:20px;

  background:
    linear-gradient(
      145deg,
      #8d3fd0,
      #411064
    );
}

.title{
  font-size:19px;
  font-weight:900;
  letter-spacing:-.4px;
}

.live{
  display:flex;
  align-items:center;
  gap:4px;
  padding:4px 7px;
  border-radius:30px;
  background:#0d2112;
  border:1px solid #245029;
  color:#75e369;
  font-size:9px;
  font-weight:800;
}

.dot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#75e369;
  box-shadow:0 0 7px #75e369;
}

.card{
  background:#0c1118;
  border:1px solid #242e39;
  border-radius:15px;
  overflow:hidden;
  flex-shrink:0;
}

.cardTitle{
  color:#9ba8b7;
  font-size:9px;
  font-weight:800;
  letter-spacing:.45px;
}

.powerCard{
  padding:9px 10px 7px;
}

.powerTop{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  margin-top:2px;
  margin-bottom:6px;
}

.total{
  color:#75e169;
  font-size:36px;
  line-height:1;
  font-weight:950;
  letter-spacing:-1.3px;
}

.totalText{
  color:#748294;
  font-size:8px;
  margin-bottom:3px;
}

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  grid-template-rows:1fr 1fr;
  gap:5px;
}

.block{
  min-height:51px;
  background:#121a24;
  border:1px solid #172431;
  border-radius:10px;
  padding:6px 9px;
}

.blockName{
  color:#92a0b1;
  font-size:9px;
  margin-bottom:2px;
}

.blockValue{
  font-size:20px;
  line-height:1;
  font-weight:900;
}

.source{
  color:#68788b;
  font-size:8px;
  margin-top:5px;
}

.riverCard{
  padding:9px 10px 7px;
}

.riverTop{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  margin-top:2px;
}

.water{
  color:#59adff;
  font-size:36px;
  line-height:1;
  font-weight:950;
  letter-spacing:-1.2px;
}

.state{
  font-size:9px;
  font-weight:900;
  margin-bottom:3px;
}

.ok{
  color:#75df69;
}

.warning{
  color:#ffad35;
}

.danger{
  color:#ff5d61;
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
  margin-top:6px;
}

.metric{
  background:#121a24;
  border-radius:9px;
  padding:6px 8px;
}

.metricName{
  color:#8998aa;
  font-size:8px;
}

.metricValue{
  margin-top:1px;
  font-size:16px;
  font-weight:850;
}

.gauge{
  position:relative;
  height:10px;
  border-radius:99px;
  margin-top:7px;

  background:
    linear-gradient(
      90deg,
      #55c65b 0%,
      #55c65b 60%,
      #ffab35 60%,
      #ffab35 85%,
      #ed575a 85%,
      #ed575a 100%
    );
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-5px;
  width:3px;
  height:20px;
  background:white;
  border-radius:2px;
  transform:translateX(-50%);
  box-shadow:0 0 6px white;
}

.scale{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  margin-top:3px;
  font-size:8px;
  color:#8492a2;
}

.scale span:nth-child(2){
  text-align:center;
  color:#ffad35;
}

.scale span:nth-child(3){
  text-align:right;
  color:#ff6264;
}

.distances{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
  margin-top:5px;
}

.distance{
  background:#121a24;
  border-radius:9px;
  padding:5px 7px;
}

.distanceNumber{
  font-size:14px;
  font-weight:900;
}

.distanceText{
  color:#8190a1;
  font-size:7px;
  margin-top:1px;
}

.footer{
  margin-top:auto;
  min-height:16px;
  display:flex;
  align-items:center;
  justify-content:center;
  gap:7px;
  color:#657487;
  font-size:7px;
  letter-spacing:.2px;
}

.iglodi{
  color:#a45add;
  font-weight:950;
  letter-spacing:1.6px;
}

</style>
</head>

<body>

<main>

<div class="header">

  <div class="brand">

    <div class="atom">
      ⚛️
    </div>

    <div class="title">
      PAKS AKTUÁLIS ADATOK
    </div>

  </div>

  <div class="live">

    <span class="dot"></span>

    ÉLŐ

  </div>

</div>


<section class="card powerCard">

  <div class="cardTitle">
    PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
  </div>

  <div class="powerTop">

    <div class="total">
      ${total} MW
    </div>

    <div class="totalText">
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

  <div class="source">
    OAH • ${shortTime(oahTime)} • ${oahStatus}
  </div>

</section>


<section class="card riverCard">

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

      <div class="metricName">
        VÍZHOZAM
      </div>

      <div class="metricValue">
        ${fmt1(flow)} m³/s
      </div>

    </div>

    <div class="metric">

      <div class="metricName">
        VÍZHŐMÉRSÉKLET
      </div>

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

      <div class="distanceNumber">
        ${
          shutdownDistance !== null
            ? Math.abs(shutdownDistance) + " cm"
            : "—"
        }
      </div>

      <div class="distanceText">
        LEÁLLÁSI KÜSZÖBIG
      </div>

    </div>

    <div class="distance">

      <div class="distanceNumber">
        ${
          safetyDistance !== null
            ? Math.abs(safetyDistance) + " cm"
            : "—"
        }
      </div>

      <div class="distanceText">
        BIZTONSÁGI HATÁRIG
      </div>

    </div>

  </div>

  <div class="source">
    VÍZÜGY • ${shortTime(riverTime)} • ${riverStatus}
  </div>

</section>


<div class="footer">

  <span>
    AUTOMATIKUS FRISSÍTÉS • 5 PERC
  </span>

  <span>•</span>

  <span class="iglodi">
    IGLÓDI
  </span>

</div>

</main>

</body>
</html>`;

    return new Response(html, {
      headers: {
        "content-type": "text/html;charset=UTF-8",
        "cache-control": "no-store"
      }
    });
  }
};
