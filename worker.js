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
        riverLabel = "FIGYELMEZTETÉSI TARTOMÁNY";
      }
    }

    let markerPct = 0;

    // Skála: -110 ... -150 cm
    if (typeof water === "number") {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const shutdownText =
      typeof shutdownDistance === "number"
        ? shutdownDistance >= 0
          ? `${shutdownDistance} cm a leállási küszöbig`
          : `${Math.abs(shutdownDistance)} cm-rel a küszöb alatt`
        : "—";

    const safetyText =
      typeof safetyDistance === "number"
        ? safetyDistance >= 0
          ? `${safetyDistance} cm a biztonsági határig`
          : `${Math.abs(safetyDistance)} cm-rel a biztonsági határ alatt`
        : "—";

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
content="PAKS">

<title>PAKS aktuális adatok</title>

<style>

*{
  box-sizing:border-box;
}

html,body{
  margin:0;
  width:100%;
  min-height:100%;
  background:#05080d;
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,
  "Segoe UI",Roboto,Arial,sans-serif;
}

body{
  display:flex;
  justify-content:center;
}

main{
  width:min(100%,500px);
  padding:
    max(10px,env(safe-area-inset-top))
    14px
    max(10px,env(safe-area-inset-bottom));
}


/* HEADER */

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:10px;
}

.titleWrap{
  display:flex;
  align-items:center;
  gap:9px;
}

.logo{
  width:38px;
  height:38px;
  border-radius:11px;
  display:grid;
  place-items:center;
  font-size:24px;
  background:
    linear-gradient(145deg,#8e3fd1,#471270);
  box-shadow:
    0 4px 16px rgba(151,70,226,.28);
}

.title{
  font-size:22px;
  line-height:1;
  font-weight:900;
  letter-spacing:-.4px;
}

.live{
  display:flex;
  align-items:center;
  gap:5px;
  font-size:9px;
  font-weight:800;
  color:#7ce56d;
  border:1px solid #244d29;
  background:#0d2112;
  padding:5px 8px;
  border-radius:99px;
}

.liveDot{
  width:6px;
  height:6px;
  border-radius:50%;
  background:#6de55d;
  box-shadow:0 0 8px #6de55d;
}


/* MAIN CARD */

.card{
  background:#0b1017;
  border:1px solid #242d38;
  border-radius:18px;
  overflow:hidden;
  margin-bottom:10px;
}

.cardHead{
  padding:12px 14px 5px;
}

.eyebrow{
  color:#9ca8b7;
  font-size:11px;
  font-weight:750;
  letter-spacing:.45px;
}

.totalRow{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  padding:0 14px 10px;
}

.total{
  font-size:47px;
  line-height:.95;
  font-weight:950;
  letter-spacing:-1.8px;
  color:#76e16b;
}

.totalLabel{
  color:#778594;
  font-size:10px;
  margin-bottom:5px;
}


/* BLOCKS */

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  padding:0 12px 10px;
}

.block{
  min-height:72px;
  border-radius:12px;
  background:#111923;
  border:1px solid #172331;
  padding:9px 11px;
}

.blockTitle{
  color:#9ba9b9;
  font-size:11px;
  font-weight:650;
  margin-bottom:5px;
}

.blockPower{
  font-size:27px;
  line-height:1;
  font-weight:900;
  letter-spacing:-.5px;
}

.meta{
  border-top:1px solid #1a222c;
  padding:7px 13px;
  color:#738295;
  font-size:9px;
}


/* RIVER */

.riverHead{
  padding:12px 14px 0;
}

.riverMain{
  padding:2px 14px 4px;
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
}

.water{
  color:#5daeff;
  font-size:46px;
  line-height:.95;
  font-weight:950;
  letter-spacing:-1.5px;
}

.state{
  font-size:10px;
  font-weight:850;
  margin-bottom:6px;
  text-align:right;
}

.state.ok{
  color:#7ce16e;
}

.state.warning{
  color:#ffad35;
}

.state.danger{
  color:#ff5f60;
}


/* METRICS */

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  padding:7px 12px 9px;
}

.metric{
  border-radius:12px;
  background:#111923;
  padding:9px 11px;
}

.metricLabel{
  color:#8d9bad;
  font-size:10px;
  margin-bottom:3px;
}

.metricValue{
  font-size:21px;
  line-height:1.05;
  font-weight:850;
}


/* GAUGE */

.gaugeArea{
  padding:0 13px 8px;
}

.gauge{
  position:relative;
  height:14px;
  border-radius:999px;
  overflow:visible;

  background:
    linear-gradient(
      90deg,
      #55c85d 0%,
      #55c85d 60%,
      #ffab35 60%,
      #ffab35 85%,
      #ed575a 85%,
      #ed575a 100%
    );
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-7px;

  width:4px;
  height:28px;

  background:#fff;

  transform:translateX(-50%);

  border-radius:2px;

  box-shadow:
    0 0 0 1px rgba(0,0,0,.25),
    0 0 8px rgba(255,255,255,.45);
}

.marker:before{
  content:"";
  position:absolute;

  top:-6px;
  left:50%;

  transform:translateX(-50%);

  width:0;
  height:0;

  border-left:5px solid transparent;
  border-right:5px solid transparent;
  border-bottom:6px solid #fff;
}

.scale{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  margin-top:6px;
  font-size:9px;
  color:#909cab;
}

.scale span:nth-child(1){
  text-align:left;
}

.scale span:nth-child(2){
  color:#ffad35;
  text-align:center;
}

.scale span:nth-child(3){
  color:#ff6565;
  text-align:right;
}


/* ALERT BOX */

.distance{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  padding:0 12px 9px;
}

.distanceBox{
  background:#111923;
  border-radius:11px;
  padding:8px 9px;
}

.distanceValue{
  font-size:15px;
  font-weight:850;
  line-height:1.1;
}

.distanceLabel{
  color:#8593a4;
  font-size:8px;
  margin-top:3px;
}


/* FOOT */

.footer{
  text-align:center;
  color:#6f7c8d;
  font-size:8px;
  margin-top:2px;
}

</style>
</head>

<body>

<main>

<div class="header">

  <div class="titleWrap">

    <div class="logo">⚛️</div>

    <div class="title">
      PAKS AKTUÁLIS<br>ADATOK
    </div>

  </div>

  <div class="live">

    <span class="liveDot"></span>

    ÉLŐ

  </div>

</div>


<!-- ERŐMŰ -->

<div class="card">

  <div class="cardHead">

    <div class="eyebrow">
      PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
    </div>

  </div>

  <div class="totalRow">

    <div class="total">
      ${total} MW
    </div>

    <div class="totalLabel">
      ÖSSZTELJESÍTMÉNY
    </div>

  </div>


  <div class="blocks">

    ${blocks.map((v,i)=>`

      <div class="block">

        <div class="blockTitle">
          ${i+1}. BLOKK
        </div>

        <div class="blockPower">
          ${v} MW
        </div>

      </div>

    `).join("")}

  </div>


  <div class="meta">

    OAH
    &nbsp;•&nbsp;
    ${shortTime(oahTime)}
    &nbsp;•&nbsp;
    ${oahStatus}

  </div>

</div>


<!-- DUNA -->

<div class="card">

  <div class="riverHead">

    <div class="eyebrow">
      🌊 DUNA VÍZÁLLÁSA PAKSNÁL
    </div>

  </div>


  <div class="riverMain">

    <div class="water">
      ${waterText}
    </div>

    <div class="state ${riverClass}">
      ${riverLabel}
    </div>

  </div>


  <div class="metrics">

    <div class="metric">

      <div class="metricLabel">
        VÍZHOZAM
      </div>

      <div class="metricValue">
        ${fmt1(flow)} m³/s
      </div>

    </div>


    <div class="metric">

      <div class="metricLabel">
        VÍZHŐMÉRSÉKLET
      </div>

      <div class="metricValue">
        ${fmt1(temp)} °C
      </div>

    </div>

  </div>


  <div class="gaugeArea">

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

  </div>


  <div class="distance">

    <div class="distanceBox">

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


    <div class="distanceBox">

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


  <div class="meta">

    Vízügy
    &nbsp;•&nbsp;
    ${shortTime(riverTime)}
    &nbsp;•&nbsp;
    ${riverStatus}

  </div>

</div>


<div class="footer">

  AUTOMATIKUS FRISSÍTÉS • 5 PERC

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
