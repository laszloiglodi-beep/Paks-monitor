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

    const waterText =
      typeof water === "number" ? `${water} cm` : "— cm";

    const shutdownDistance =
      typeof water === "number" ? water + 134 : null;

    let riverClass = "ok";
    let riverLabel = "Normál";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "Kritikus";
      } else if (water <= -134) {
        riverClass = "warning";
        riverLabel = "Leállási tartomány";
      } else if (water <= -129) {
        riverClass = "warning";
        riverLabel = "Figyelmeztetés";
      }
    }

    let markerPct = 0;

    if (typeof water === "number") {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const distanceText =
      typeof shutdownDistance === "number"
        ? shutdownDistance >= 0
          ? `${shutdownDistance} cm a leállási küszöbig`
          : `${Math.abs(shutdownDistance)} cm-rel a küszöb alatt`
        : "—";

    const shortTime = s => {
      const m = String(s).match(/(\d{2}:\d{2})/);
      return m ? m[1] : "—";
    };

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta http-equiv="refresh" content="300">
<meta name="theme-color" content="#07101d">
<meta name="apple-mobile-web-app-capable" content="yes">
<title>Paks aktuális adatok</title>

<style>
*{box-sizing:border-box}

html,body{
  margin:0;
  height:100%;
  background:#07101d;
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}

body{
  display:flex;
  justify-content:center;
  overflow:hidden
}

main{
  width:min(100%,480px);
  height:100vh;
  padding:10px 12px 8px;
  display:flex;
  flex-direction:column;
  gap:8px
}

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  min-height:42px
}

.title{
  font-size:22px;
  font-weight:850;
  letter-spacing:.01em
}

.live{
  font-size:10px;
  color:#7ddc73;
  padding:4px 7px;
  border-radius:20px;
  background:#102718
}

.hero{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px
}

.heroBox{
  background:linear-gradient(145deg,#142235,#0c1726);
  border:1px solid #29405a;
  border-radius:16px;
  padding:11px 12px
}

.kicker{
  color:#9cafc7;
  font-size:10px;
  text-transform:uppercase
}

.big{
  font-size:34px;
  line-height:1;
  font-weight:900;
  margin-top:3px
}

.power{color:#75df67}
.river{color:#5baeff}

.sub{
  font-size:11px;
  margin-top:4px
}

.ok{color:#75df67}
.warning{color:#ffb43b}
.danger{color:#ff6666}

.panel{
  background:#101d2d;
  border:1px solid #29405a;
  border-radius:16px;
  padding:10px 11px
}

.blocks{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px
}

.block{
  background:#091524;
  border-radius:10px;
  padding:7px 5px;
  text-align:center
}

.block span{
  display:block;
  color:#9cafc7;
  font-size:9px
}

.block b{
  display:block;
  font-size:17px;
  margin-top:2px
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:7px
}

.metric{
  background:#091524;
  border-radius:10px;
  padding:8px
}

.metric span{
  color:#9cafc7;
  font-size:9px
}

.metric b{
  display:block;
  margin-top:2px;
  font-size:17px
}

.gauge{
  position:relative;
  height:10px;
  border-radius:8px;
  margin-top:9px;
  background:linear-gradient(
    90deg,
    #5ac75a 0 60%,
    #ffb33b 60% 85%,
    #ef5858 85% 100%
  )
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-6px;
  width:3px;
  height:22px;
  background:#fff;
  transform:translateX(-50%);
  box-shadow:0 0 0 1px rgba(0,0,0,.3)
}

.scale{
  display:flex;
  justify-content:space-between;
  margin-top:4px;
  font-size:9px
}

.scale span:nth-child(2){color:#ffb33b}
.scale span:nth-child(3){color:#ff6b6b}

.distance{
  margin-top:6px;
  font-size:12px;
  font-weight:700
}

.source{
  margin-top:auto;
  font-size:9px;
  color:#8397b3;
  text-align:center;
  white-space:nowrap
}
</style>
</head>

<body>
<main>

<div class="header">
  <div class="title">⚛️ PAKS AKTUÁLIS ADATOK</div>
  <div class="live">● ÉLŐ</div>
</div>

<div class="hero">

  <div class="heroBox">
    <div class="kicker">Erőmű</div>
    <div class="big power">${total} MW</div>
    <div class="sub">összteljesítmény</div>
  </div>

  <div class="heroBox">
    <div class="kicker">Duna • Paks</div>
    <div class="big river">${waterText}</div>
    <div class="sub ${riverClass}">${riverLabel}</div>
  </div>

</div>

<div class="panel">

  <div class="blocks">
    ${blocks.map((v,i)=>`
      <div class="block">
        <span>${i+1}. blokk</span>
        <b>${v}</b>
        <span>MW</span>
      </div>
    `).join("")}
  </div>

</div>

<div class="panel">

  <div class="metrics">

    <div class="metric">
      <span>VÍZHOZAM</span>
      <b>${fmt1(flow)} m³/s</b>
    </div>

    <div class="metric">
      <span>VÍZHŐMÉRSÉKLET</span>
      <b>${fmt1(temp)} °C</b>
    </div>

  </div>

  <div class="gauge">
    ${typeof water === "number" ? `<div class="marker"></div>` : ""}
  </div>

  <div class="scale">
    <span>normál</span>
    <span>−134 cm</span>
    <span>−144 cm</span>
  </div>

  <div class="distance">
    ${distanceText}
  </div>

</div>

<div class="footer">
  AUTOMATIKUS FRISSÍTÉS • 5 PERC • IGLÓDI
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
