export default {
  async fetch(request, env, ctx) {
    try {
      const data = await getCurrentData();

      return new Response(renderPage(data), {
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "no-store, no-cache, must-revalidate"
        }
      });

    } catch (err) {
      return new Response(
        renderPage({
          blocks: [null, null, null, null],
          total: null,
          water: null,
          temp: null,
          oahTime: "–",
          waterTime: "–",
          error: String(err)
        }),
        {
          headers: {
            "content-type": "text/html; charset=UTF-8",
            "cache-control": "no-store"
          }
        }
      );
    }
  }
};


/* =========================================================
   FORRÁSOK
========================================================= */

const OAH_URL =
  "https://www.haea.hu/web/v3/OAHPortal.nsf/web?openagent&article=news&uid=5F07570053A024ACC1257BE9002F5A99";

const VIZ_URL =
  "https://www.vizugy.hu/?mapModule=OpGrafikon&AllomasVOA=16496188&mapData=Idosor";


/* =========================================================
   ADATOK LEKÉRÉSE
========================================================= */

async function getCurrentData() {

  const [oahResult, vizResult] = await Promise.allSettled([
    fetchText(OAH_URL),
    fetchText(VIZ_URL)
  ]);

  let blocks = [null, null, null, null];
  let total = null;
  let oahTime = "–";

  let water = null;
  let temp = null;
  let waterTime = "–";


  /* ---------------- OAH / PAKS ---------------- */

  if (oahResult.status === "fulfilled") {

    const html = oahResult.value;

    const parsed = parsePaks(html);

    blocks = parsed.blocks;
    total = parsed.total;
    oahTime = parsed.time;
  }


  /* ---------------- VÍZÜGY ---------------- */

  if (vizResult.status === "fulfilled") {

    const html = vizResult.value;

    const parsed = parseWater(html);

    water = parsed.water;
    temp = parsed.temp;
    waterTime = parsed.time;
  }


  return {
    blocks,
    total,
    water,
    temp,
    oahTime,
    waterTime
  };
}


/* =========================================================
   FETCH
========================================================= */

async function fetchText(url) {

  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15",
      "accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    },
    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  });

  if (!res.ok) {
    throw new Error("HTTP " + res.status);
  }

  return await res.text();
}


/* =========================================================
   PAKS PARSER
========================================================= */

function parsePaks(html) {

  const text = cleanText(html);

  let blocks = [null, null, null, null];


  /*
    Többféle OAH-megjelenítésre próbálunk illeszkedni.
    Keresés:
       1. blokk ... MW
       2. blokk ... MW
  */

  for (let i = 1; i <= 4; i++) {

    const patterns = [

      new RegExp(
        `${i}\\.?\\s*blokk[\\s\\S]{0,250}?(\\d{2,4}(?:[.,]\\d+)?)\\s*MW`,
        "i"
      ),

      new RegExp(
        `blokk\\s*${i}[\\s\\S]{0,250}?(\\d{2,4}(?:[.,]\\d+)?)\\s*MW`,
        "i"
      ),

      new RegExp(
        `${i}\\s*[.:\\-]?\\s*(?:blokk)?[\\s\\S]{0,120}?(\\d{2,4})\\s*MW`,
        "i"
      )
    ];

    for (const p of patterns) {

      const m = text.match(p);

      if (m) {

        const n = numberValue(m[1]);

        if (n !== null && n >= 0 && n < 1000) {
          blocks[i - 1] = Math.round(n);
          break;
        }
      }
    }
  }


  /*
    Biztonsági keresés:
    ha a fenti minták nem találták meg mind a négyet,
    MW értékeket keresünk.
  */

  if (blocks.filter(v => v !== null).length < 4) {

    const mwMatches = [
      ...text.matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*MW/gi)
    ]
      .map(m => numberValue(m[1]))
      .filter(v => v !== null && v >= 0 && v <= 550);

    if (mwMatches.length >= 4) {

      const candidate = mwMatches.slice(0, 4);

      for (let i = 0; i < 4; i++) {
        if (blocks[i] === null) {
          blocks[i] = Math.round(candidate[i]);
        }
      }
    }
  }


  const valid = blocks.filter(v => v !== null);

  const total =
    valid.length
      ? valid.reduce((a, b) => a + b, 0)
      : null;


  /* MÉRÉSI IDŐ */

  let time = "–";

  const timePatterns = [

    /Mérés\s*dátuma[:\s]*([0-9]{4}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2}[^<\n]{0,25})/i,

    /([0-9]{4}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2})/,

    /([0-9]{1,2}[.\-/][0-9]{1,2}[.\-/][0-9]{4}\s+[0-9]{1,2}:[0-9]{2})/
  ];

  for (const p of timePatterns) {

    const m = text.match(p);

    if (m) {
      time = tidyTime(m[1]);
      break;
    }
  }


  return {
    blocks,
    total,
    time
  };
}


/* =========================================================
   VÍZÜGY PARSER
========================================================= */

function parseWater(html) {

  const text = cleanText(html);

  let water = null;
  let temp = null;
  let time = "–";


  /* -------------------------------------------------------
     VÍZÁLLÁS
  ------------------------------------------------------- */

  const waterPatterns = [

    /Vízállás[^0-9\-]{0,100}(-?\d{1,4})\s*cm/i,

    /vízállás[\s\S]{0,150}?(-?\d{1,4})\s*cm/i,

    /(-?\d{1,4})\s*cm[\s\S]{0,80}?vízállás/i
  ];

  for (const p of waterPatterns) {

    const m = text.match(p);

    if (m) {

      const n = numberValue(m[1]);

      if (n !== null && n > -500 && n < 1000) {
        water = Math.round(n);
        break;
      }
    }
  }


  /* -------------------------------------------------------
     VÍZHŐMÉRSÉKLET
  ------------------------------------------------------- */

  const tempPatterns = [

    /Vízhőmérséklet[^0-9\-]{0,100}(-?\d{1,2}(?:[.,]\d+)?)\s*°?\s*C/i,

    /vízhő[^0-9\-]{0,100}(-?\d{1,2}(?:[.,]\d+)?)\s*°?\s*C/i,

    /(-?\d{1,2}(?:[.,]\d+)?)\s*°\s*C[\s\S]{0,100}?vízhő/i
  ];

  for (const p of tempPatterns) {

    const m = text.match(p);

    if (m) {

      const n = numberValue(m[1]);

      if (n !== null && n > -5 && n < 45) {
        temp = Math.round(n * 10) / 10;
        break;
      }
    }
  }


  /* -------------------------------------------------------
     MÉRÉSI IDŐ
  ------------------------------------------------------- */

  const timePatterns = [

    /([0-9]{4}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2}\s+[0-9]{1,2}:[0-9]{2})/,

    /([0-9]{1,2}[.\-/][0-9]{1,2}[.\-/][0-9]{4}\s+[0-9]{1,2}:[0-9]{2})/
  ];

  for (const p of timePatterns) {

    const m = text.match(p);

    if (m) {
      time = tidyTime(m[1]);
      break;
    }
  }


  return {
    water,
    temp,
    time
  };
}


/* =========================================================
   HTML
========================================================= */

function renderPage(data) {

  const blocks = data.blocks || [null, null, null, null];

  return `<!DOCTYPE html>
<html lang="hu">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"
/>

<meta name="theme-color" content="#071018">

<title>Paks Monitor</title>


<style>

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  background:#071018;
  color:#ffffff;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Roboto,
    Arial,
    sans-serif;
}

body{
  min-height:100vh;
}

.page{
  width:100%;
  max-width:720px;
  margin:0 auto;
  padding:14px;
}


/* ======================================================
   FEJLÉC
====================================================== */

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:14px;
}

.title{
  font-size:23px;
  font-weight:900;
  letter-spacing:-0.5px;
}

.live{
  display:flex;
  align-items:center;
  gap:6px;
  font-size:12px;
  font-weight:800;
  color:#49e59a;
}

.dot{
  width:8px;
  height:8px;
  border-radius:50%;
  background:#49e59a;
  box-shadow:0 0 12px #49e59a;
}


/* ======================================================
   ÖSSZTELJESÍTMÉNY
====================================================== */

.total{
  background:#0d1923;
  border:1px solid #20303d;
  border-radius:18px;
  padding:18px;
  text-align:center;
  margin-bottom:12px;
}

.total-label{
  font-size:13px;
  color:#8ea1ae;
  font-weight:700;
  letter-spacing:.4px;
}

.total-value{
  margin-top:3px;
  font-size:47px;
  line-height:1;
  font-weight:950;
  color:#4ce89b;
  letter-spacing:-2px;
}

.total-unit{
  font-size:17px;
  margin-left:4px;
  color:#a9bac4;
}


/* ======================================================
   4 BLOKK
====================================================== */

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px;
}

.block{
  background:#0d1923;
  border:1px solid #20303d;
  border-radius:16px;
  padding:15px 10px;
  text-align:center;
}

.block-name{
  color:#91a3af;
  font-size:13px;
  font-weight:800;
  margin-bottom:5px;
}

.block-value{
  font-size:30px;
  line-height:1;
  font-weight:950;
}

.block-unit{
  font-size:13px;
  color:#8396a3;
  margin-left:2px;
}


/* ======================================================
   DUNA
====================================================== */

.section-title{
  margin:18px 2px 8px;
  color:#8ea1ae;
  font-size:13px;
  font-weight:800;
  letter-spacing:.8px;
}

.duna{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:9px;
}

.water-card{
  background:#0d1923;
  border:1px solid #20303d;
  border-radius:17px;
  padding:17px 8px;
  text-align:center;
}

.water-icon{
  font-size:22px;
  margin-bottom:4px;
}

.water-label{
  font-size:12px;
  color:#8fa1ad;
  font-weight:750;
}

.water-value{
  margin-top:4px;
  font-size:34px;
  line-height:1;
  font-weight:950;
  color:#65cfff;
}

.temp-value{
  color:#ffd067;
}

.unit{
  font-size:14px;
  color:#98a9b4;
  margin-left:2px;
}


/* ======================================================
   IDŐ
====================================================== */

.times{
  margin-top:14px;
  padding-top:11px;
  border-top:1px solid #172631;
  color:#607582;
  font-size:10px;
  line-height:1.7;
  text-align:center;
}

.brand{
  margin-top:8px;
  text-align:center;
  color:#3f5360;
  font-size:10px;
  font-weight:900;
  letter-spacing:2px;
}


/* ======================================================
   MOBIL
====================================================== */

@media(max-width:390px){

  .page{
    padding:11px;
  }

  .title{
    font-size:21px;
  }

  .total-value{
    font-size:43px;
  }

  .block-value{
    font-size:28px;
  }

  .water-value{
    font-size:31px;
  }
}

</style>

</head>


<body>

<div class="page">


  <div class="header">

    <div class="title">
      ⚛️ PAKS MONITOR
    </div>

    <div class="live">
      <span class="dot"></span>
      LIVE
    </div>

  </div>



  <div class="total">

    <div class="total-label">
      ERŐMŰ ÖSSZTELJESÍTMÉNY
    </div>

    <div class="total-value">
      ${display(data.total)}
      <span class="total-unit">MW</span>
    </div>

  </div>



  <div class="blocks">

    ${blockCard(1, blocks[0])}

    ${blockCard(2, blocks[1])}

    ${blockCard(3, blocks[2])}

    ${blockCard(4, blocks[3])}

  </div>



  <div class="section-title">
    DUNA • PAKS
  </div>



  <div class="duna">

    <div class="water-card">

      <div class="water-icon">💧</div>

      <div class="water-label">
        VÍZÁLLÁS
      </div>

      <div class="water-value">
        ${display(data.water)}
        <span class="unit">cm</span>
      </div>

    </div>



    <div class="water-card">

      <div class="water-icon">🌡️</div>

      <div class="water-label">
        VÍZHŐMÉRSÉKLET
      </div>

      <div class="water-value temp-value">
        ${display(data.temp)}
        <span class="unit">°C</span>
      </div>

    </div>

  </div>



  <div class="times">

    PAKS • OAH:
    ${escapeHtml(data.oahTime || "–")}

    <br>

    DUNA • VÍZÜGY:
    ${escapeHtml(data.waterTime || "–")}

  </div>


  <div class="brand">
    IGLÓDI
  </div>


</div>


<script>

setTimeout(function(){
  location.reload();
}, 60000);

</script>


</body>
</html>`;
}


/* =========================================================
   BLOKK KÁRTYA
========================================================= */

function blockCard(number, value) {

  let status = "";

  if (value === null || value === undefined) {

    status = `
      <div class="block-value">
        ??
        <span class="block-unit">MW</span>
      </div>
    `;

  } else {

    status = `
      <div class="block-value">
        ${escapeHtml(String(value))}
        <span class="block-unit">MW</span>
      </div>
    `;
  }


  return `
    <div class="block">

      <div class="block-name">
        ${number}. BLOKK
      </div>

      ${status}

    </div>
  `;
}


/* =========================================================
   SEGÉDFÜGGVÉNYEK
========================================================= */

function cleanText(html) {

  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&deg;/gi, "°")
    .replace(/&ndash;/gi, "-")
    .replace(/&minus;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}


function numberValue(v) {

  if (v === undefined || v === null) {
    return null;
  }

  const n = Number(
    String(v)
      .replace(/\s/g, "")
      .replace(",", ".")
  );

  return Number.isFinite(n) ? n : null;
}


function tidyTime(v) {

  if (!v) {
    return "–";
  }

  return String(v)
    .replace(/\s+/g, " ")
    .replace(/\.$/, "")
    .trim()
    .slice(0, 30);
}


function display(value) {

  if (
    value === null ||
    value === undefined ||
    Number.isNaN(value)
  ) {
    return "??";
  }

  return escapeHtml(String(value).replace(".", ","));
}


function escapeHtml(value) {

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
