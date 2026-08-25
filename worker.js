export default {
  async fetch(request) {
    const url = new URL(request.url);

    const data = await loadAllData();

    if (url.pathname === "/api") {
      return new Response(
        JSON.stringify(data, null, 2),
        {
          headers: {
            "content-type": "application/json; charset=UTF-8",
            "cache-control": "no-store"
          }
        }
      );
    }

    return new Response(
      renderPage(data),
      {
        headers: {
          "content-type": "text/html; charset=UTF-8",
          "cache-control": "no-store, no-cache, must-revalidate"
        }
      }
    );
  }
};


/* =========================================================
   MŰKÖDŐ FORRÁSOK
========================================================= */

const OAH_URL =
  "https://webmail.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

const VIZ_URL =
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";


/* =========================================================
   ÖSSZES ADAT
========================================================= */

async function loadAllData() {

  const results = await Promise.allSettled([
    loadOAH(),
    loadWater()
  ]);

  const oah =
    results[0].status === "fulfilled"
      ? results[0].value
      : {
          blocks: [null, null, null, null],
          total: null,
          time: "–",
          status: "HIBA",
          error: String(results[0].reason || "")
        };

  const water =
    results[1].status === "fulfilled"
      ? results[1].value
      : {
          water: null,
          temp: null,
          time: "–",
          status: "HIBA",
          error: String(results[1].reason || "")
        };

  return {
    blocks: oah.blocks,
    total: oah.total,

    oahTime: oah.time,
    oahStatus: oah.status,
    oahError: oah.error || null,

    water: water.water,
    temp: water.temp,

    waterTime: water.time,
    waterStatus: water.status,
    waterError: water.error || null
  };
}


/* =========================================================
   OAH
========================================================= */

async function loadOAH() {

  const html = await fetchPage(OAH_URL);

  const text = htmlToText(html);


  /*
     A tényleges OAH szöveg:

     A Paksi Atomerőmű elektromos teljesítmény adatai
     1. blokk 2. blokk 3. blokk 4. blokk
     477 MW 490 MW 487 MW 322 MW
  */


  const powerStart =
    text.search(
      /Paksi\s+Atomerőmű\s+elektromos\s+teljesítmény\s+adatai/i
    );


  if (powerStart < 0) {
    throw new Error(
      "OAH: teljesítmény rész nem található"
    );
  }


  /*
     Csak az ezt követő 1200 karakterből keresünk MW adatot.
  */

  const section =
    text.slice(
      powerStart,
      powerStart + 1200
    );


  const mw =
    [
      ...section.matchAll(
        /(\d{1,3}(?:[.,]\d+)?)\s*MW/gi
      )
    ]
      .map(m => toNumber(m[1]))
      .filter(
        n =>
          n !== null &&
          n >= 0 &&
          n <= 600
      );


  if (mw.length < 4) {
    throw new Error(
      "OAH: nincs meg mind a négy MW adat"
    );
  }


  const blocks = [
    Math.round(mw[0]),
    Math.round(mw[1]),
    Math.round(mw[2]),
    Math.round(mw[3])
  ];


  const total =
    blocks.reduce(
      (sum, n) => sum + n,
      0
    );


  /*
     Időpont
  */

  let time = "–";


  const timeMatch =
    text.match(
      /Utolsó\s+frissítés\s*:\s*(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\s+\d{1,2}:\d{2})/i
    );


  if (timeMatch) {
    time =
      timeMatch[1]
        .replace(/\s+/g, " ")
        .trim();
  }


  return {
    blocks,
    total,
    time,
    status: "OK"
  };
}


/* =========================================================
   VÍZÜGY
========================================================= */

async function loadWater() {

  const html = await fetchPage(VIZ_URL);

  const text = htmlToText(html);


  /*
     Tényleges sor:

     2026.08.25. 11:00 -67 1009,000 24,4

     dátum
     idő
     vízállás
     vízhozam
     vízhő
  */


  const rows =
    [
      ...text.matchAll(
        /(\d{4}\.\d{2}\.\d{2}\.)\s+(\d{1,2}:\d{2})\s+(-?\d{1,4})\s+(\d+(?:[.,]\d+)?)\s+(-?\d{1,2}(?:[.,]\d+)?)/g
      )
    ];


  if (!rows.length) {
    throw new Error(
      "VÍZÜGY: mérési sor nem található"
    );
  }


  /*
     Az első dátumos mérési sor a legfrissebb.
  */

  const row = rows[0];


  const water =
    toNumber(row[3]);

  const temp =
    toNumber(row[5]);


  if (
    water === null ||
    water < -500 ||
    water > 1000
  ) {
    throw new Error(
      "VÍZÜGY: hibás vízállás"
    );
  }


  if (
    temp === null ||
    temp < -5 ||
    temp > 40
  ) {
    throw new Error(
      "VÍZÜGY: hibás vízhő"
    );
  }


  return {
    water: Math.round(water),

    temp:
      Math.round(temp * 10) / 10,

    time:
      `${row[1]} ${row[2]}`,

    status: "OK"
  };
}


/* =========================================================
   FETCH
========================================================= */

async function fetchPage(url) {

  const response =
    await fetch(
      url,
      {
        method: "GET",

        redirect: "follow",

        headers: {
          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "hu-HU,hu;q=0.9,en-US;q=0.8,en;q=0.7",

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0 Safari/537.36"
        },

        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }
      }
    );


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}`
    );
  }


  const html =
    await response.text();


  if (!html || html.length < 300) {
    throw new Error(
      "Üres forrásoldal"
    );
  }


  return html;
}


/* =========================================================
   HTML -> SZÖVEG
========================================================= */

function htmlToText(html) {

  return decodeEntities(
    String(html)

      .replace(
        /<script[\s\S]*?<\/script>/gi,
        " "
      )

      .replace(
        /<style[\s\S]*?<\/style>/gi,
        " "
      )

      .replace(
        /<br\s*\/?>/gi,
        " "
      )

      .replace(
        /<\/td>/gi,
        " "
      )

      .replace(
        /<\/th>/gi,
        " "
      )

      .replace(
        /<\/tr>/gi,
        " "
      )

      .replace(
        /<\/div>/gi,
        " "
      )

      .replace(
        /<\/p>/gi,
        " "
      )

      .replace(
        /<[^>]+>/g,
        " "
      )

      .replace(
        /\s+/g,
        " "
      )

      .trim()
  );
}


/* =========================================================
   HTML ENTITÁSOK
========================================================= */

function decodeEntities(s) {

  return String(s)

    .replace(/&nbsp;|&#160;/gi, " ")

    .replace(/&aacute;/gi, "á")
    .replace(/&Aacute;/gi, "Á")

    .replace(/&eacute;/gi, "é")
    .replace(/&Eacute;/gi, "É")

    .replace(/&iacute;/gi, "í")
    .replace(/&Iacute;/gi, "Í")

    .replace(/&oacute;/gi, "ó")
    .replace(/&Oacute;/gi, "Ó")

    .replace(/&ouml;/gi, "ö")
    .replace(/&Ouml;/gi, "Ö")

    .replace(/&odblac;/gi, "ő")
    .replace(/&Odblac;/gi, "Ő")

    .replace(/&uacute;/gi, "ú")
    .replace(/&Uacute;/gi, "Ú")

    .replace(/&uuml;/gi, "ü")
    .replace(/&Uuml;/gi, "Ü")

    .replace(/&udblac;/gi, "ű")
    .replace(/&Udblac;/gi, "Ű")

    .replace(/&deg;/gi, "°")

    .replace(/&minus;|&ndash;|&mdash;/gi, "-")

    .replace(/&amp;/gi, "&")

    .replace(/&quot;/gi, '"')

    .replace(/&#39;/gi, "'");
}


/* =========================================================
   SZÁM
========================================================= */

function toNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }


  const n =
    Number(
      String(value)
        .trim()
        .replace(/\s+/g, "")
        .replace(",", ".")
    );


  return Number.isFinite(n)
    ? n
    : null;
}


/* =========================================================
   HTML OLDAL
========================================================= */

function renderPage(data) {

  const blocks =
    data.blocks ||
    [null, null, null, null];


  return `<!DOCTYPE html>

<html lang="hu">

<head>

<meta charset="UTF-8">

<meta
 name="viewport"
 content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes"
>

<meta name="theme-color" content="#06111a">

<title>PAKS MONITOR</title>


<style>

*{
 box-sizing:border-box;
}

html,
body{
 margin:0;
 padding:0;
 background:#06111a;
 color:white;
 font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
}

body{
 min-height:100vh;
}

.page{
 width:100%;
 max-width:720px;
 margin:auto;
 padding:20px 14px 28px;
}


/* HEADER */

.header{
 display:flex;
 align-items:center;
 justify-content:space-between;
 margin-bottom:18px;
}

.logo{
 font-size:24px;
 font-weight:950;
 letter-spacing:-1px;
}

.live{
 color:#45e6a1;
 font-size:14px;
 font-weight:900;
}

.live::before{
 content:"";
 display:inline-block;
 width:9px;
 height:9px;
 border-radius:50%;
 background:#45e6a1;
 margin-right:7px;
 box-shadow:0 0 15px #45e6a1;
}


/* CARD */

.card{
 background:#0c1a25;
 border:1px solid #203544;
 border-radius:19px;
}


/* TOTAL */

.total{
 padding:20px 10px;
 text-align:center;
 margin-bottom:11px;
}

.label{
 color:#8da1b0;
 font-size:13px;
 font-weight:800;
}

.totalNumber{
 margin-top:5px;
 color:#48e5a0;
 font-size:48px;
 font-weight:950;
 line-height:1;
}

.totalNumber span{
 font-size:17px;
 color:#94a8b6;
}


/* BLOCKS */

.blocks{
 display:grid;
 grid-template-columns:1fr 1fr;
 gap:9px;
}

.block{
 min-height:100px;
 display:flex;
 flex-direction:column;
 justify-content:center;
 align-items:center;
}

.blockName{
 color:#8fa2b0;
 font-size:13px;
 font-weight:850;
 margin-bottom:7px;
}

.blockMW{
 font-size:31px;
 font-weight:950;
}

.blockMW span{
 color:#8498a8;
 font-size:14px;
}


/* DUNA */

.section{
 margin:18px 3px 9px;
 font-size:14px;
 color:#94a8b6;
 font-weight:900;
 letter-spacing:1.3px;
}

.duna{
 display:grid;
 grid-template-columns:1fr 1fr;
 gap:9px;
}

.water{
 min-height:132px;
 display:flex;
 flex-direction:column;
 justify-content:center;
 align-items:center;
 text-align:center;
}

.icon{
 font-size:23px;
 margin-bottom:5px;
}

.waterLabel{
 color:#8da1b0;
 font-size:12px;
 font-weight:850;
}

.waterValue{
 margin-top:6px;
 color:#57c8ff;
 font-size:37px;
 font-weight:950;
}

.waterValue span{
 color:#91a5b4;
 font-size:14px;
}

.temperature{
 color:#ffc857;
}


/* FOOT */

.footer{
 border-top:1px solid #17303e;
 margin-top:15px;
 padding-top:12px;
 text-align:center;
 color:#607786;
 font-size:10px;
 line-height:1.8;
}

.ok{
 color:#45e6a1;
}

.err{
 color:#ffbd55;
}

.brand{
 margin-top:7px;
 letter-spacing:4px;
 font-weight:900;
 color:#415866;
}

</style>

</head>


<body>

<div class="page">


<div class="header">

  <div class="logo">
    ⚛️ PAKS MONITOR
  </div>

  <div class="live">
    LIVE
  </div>

</div>


<div class="card total">

  <div class="label">
    ERŐMŰ ÖSSZTELJESÍTMÉNY
  </div>

  <div class="totalNumber">
    ${show(data.total)}
    <span>MW</span>
  </div>

</div>


<div class="blocks">

  ${blockCard(1, blocks[0])}

  ${blockCard(2, blocks[1])}

  ${blockCard(3, blocks[2])}

  ${blockCard(4, blocks[3])}

</div>


<div class="section">
  DUNA • PAKS
</div>


<div class="duna">

  <div class="card water">

    <div class="icon">
      💧
    </div>

    <div class="waterLabel">
      VÍZÁLLÁS
    </div>

    <div class="waterValue">
      ${show(data.water)}
      <span>cm</span>
    </div>

  </div>


  <div class="card water">

    <div class="icon">
      🌡️
    </div>

    <div class="waterLabel">
      VÍZHŐMÉRSÉKLET
    </div>

    <div class="waterValue temperature">
      ${showTemp(data.temp)}
      <span>°C</span>
    </div>

  </div>

</div>


<div class="footer">

  PAKS • OAH:
  ${escapeHTML(data.oahTime || "–")}
  •
  <span class="${data.oahStatus === "OK" ? "ok" : "err"}">
    ${escapeHTML(data.oahStatus || "HIBA")}
  </span>

  <br>

  DUNA • VÍZÜGY:
  ${escapeHTML(data.waterTime || "–")}
  •
  <span class="${data.waterStatus === "OK" ? "ok" : "err"}">
    ${escapeHTML(data.waterStatus || "HIBA")}
  </span>

  <div class="brand">
    IGLÓDI
  </div>

</div>


</div>


<script>

setTimeout(function(){
 location.reload();
},60000);

</script>


</body>

</html>`;
}


/* =========================================================
   BLOKK KÁRTYA
========================================================= */

function blockCard(number, value) {

  return `
  <div class="card block">

    <div class="blockName">
      ${number}. BLOKK
    </div>

    <div class="blockMW">
      ${show(value)}
      <span>MW</span>
    </div>

  </div>
  `;
}


/* =========================================================
   MEGJELENÍTÉS
========================================================= */

function show(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "??";
  }

  return escapeHTML(
    String(value).replace(".", ",")
  );
}


function showTemp(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(Number(value))
  ) {
    return "??";
  }

  return escapeHTML(
    Number(value)
      .toFixed(1)
      .replace(".", ",")
  );
}


function escapeHTML(value) {

  return String(value)

    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
