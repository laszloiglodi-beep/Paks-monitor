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

    // OAH
    try {
      const r = await fetch(OAH_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
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
        oahStatus = "OAH adatsor nem található";
      }
    } catch (e) {
      oahStatus = "OAH kapcsolat sikertelen";
    }

    // VÍZÜGY
    try {
      const r = await fetch(VIZ_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
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
        riverStatus = "Vízügyi adatsor nem található";
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
      typeof water === "number" ? water + 134 : null;

    const safetyDistance =
      typeof water === "number" ? water + 144 : null;

    let riverClass = "ok";
    let riverLabel = "Normál tartomány";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "Kritikus tartomány";
      } else if (water <= -134) {
        riverClass = "warning";
        riverLabel = "Leállási tartomány";
      } else if (water <= -129) {
        riverClass = "warning";
        riverLabel = "Közel a leállási küszöbhöz";
      }
    }

    // Skála: -110 ... -150 cm
    let markerPct = 0;
    if (typeof water === "number") {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const distanceText =
      typeof shutdownDistance === "number"
        ? shutdownDistance >= 0
          ? `${shutdownDistance} cm a −134 cm-es küszöbig`
          : `${Math.abs(shutdownDistance)} cm-rel a −134 cm-es küszöb alatt`
        : "—";

    const safetyText =
      typeof safetyDistance === "number"
        ? safetyDistance >= 0
          ? `${safetyDistance} cm a −144 cm-es határig`
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
<title>Paks aktuális adatok</title>

<style>
*{box-sizing:border-box}

body{
  margin:0;
  background:#07101d;
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}

main{
  max-width:520px;
  margin:auto;
  padding:8px 10px 10px
}

h1{
  margin:2px 0 8px;
  font-size:24px;
  line-height:1.1
}

.card{
  background:#101d2d;
  border:1px solid #29405a;
  border-radius:15px;
  padding:10px;
  margin-bottom:8px
}

.label{
  color:#9cafc7;
  font-size:10px
}

.total{
  font-size:34px;
  line-height:1;
  font-weight:850;
  color:#72df68;
  margin:2px 0 7px
}

.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px
}

.box,.metric{
  background:#091524;
  border-radius:10px;
  padding:7px 9px
}

.box strong{
  font-size:19px
}

.river{
  font-size:34px;
  line-height:1;
  font-weight:850;
  color:#55adff;
  margin:2px 0 3px
}

.status{
  font-size:11px;
  font-weight:700;
  margin-bottom:6px
}

.status.ok{color:#72df68}
.status.warning{color:#ffae32}
.status.danger{color:#ff5f5f}

.two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px
}

.metric b{
  display:block;
  margin-top:1px;
  font-size:16px
}

.gauge{
  position:relative;
  height:10px;
  border-radius:8px;
  margin-top:9px;
  background:linear-gradient(
    90deg,
    #52c75a 0 60%,
    #ffae32 60% 85%,
    #ef5350 85% 100%
  )
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-5px;
  width:3px;
  height:20px;
  background:#fff;
  transform:translateX(-50%)
}

.scale{
  display:flex;
  justify-content:space-between;
  font-size:9px;
  margin-top:3px
}

.scale .orange{color:#ffae32}
.scale .red{color:#ff6961}

.distance{
  margin-top:6px;
  background:#091524;
  border-radius:9px;
  padding:6px 8px;
  font-size:11px;
  line-height:1.3
}

.info{
  color:#8fa3bb;
  font-size:9px;
  line-height:1.25;
  margin-top:5px
}

.footer{
  text-align:center;
  color:#8fa3bb;
  font-size:8px;
  margin-top:3px
}
</style>
</head>

<body>
<main>

<h1>⚛️ PAKS AKTUÁLIS ADATOK</h1>

<div class="card">
  <div class="label">ERŐMŰ ÖSSZTELJESÍTMÉNY</div>
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
    OAH • ${oahTime} • ${oahStatus}
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
      <div class="label">VÍZHŐ</div>
      <b>${fmt1(temp)} °C</b>
    </div>
  </div>

  <div class="gauge">
    ${typeof water === "number" ? `<div class="marker"></div>` : ""}
  </div>

  <div class="scale">
    <span>normál</span>
    <span class="orange">−134</span>
    <span class="red">−144 cm</span>
  </div>

  <div class="distance">
    ${distanceText}<br>
    ${safetyText}
  </div>

  <div class="info">
    Vízügy • ${riverTime} • ${riverStatus}
  </div>
</div>

<div class="footer">
  Automatikus frissítés: 5 perc
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
