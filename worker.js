export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Diagnosztika:
    // https://SAJAT-WORKER.workers.dev/api
    if (url.pathname === "/api") {
      const data = await loadAllData();

      return new Response(JSON.stringify(data, null, 2), {
        headers: {
          "content-type": "application/json; charset=UTF-8",
          "cache-control": "no-store"
        }
      });
    }

    const data = await loadAllData();

    return new Response(renderPage(data), {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store, no-cache, must-revalidate",
        "pragma": "no-cache"
      }
    });
  }
};


/* ============================================================
   PAKS MONITOR – LETISZTULT
============================================================ */


/*
   ELLENŐRZÖTT, MŰKÖDŐ FORRÁSOK
*/

const OAH_URL =
  "https://tranem.haea.gov.hu/web/v3/oahportal.nsf/web?article=paksnpp&openagent=";

const VIZ_URL =
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";


/* ============================================================
   ADATOK BETÖLTÉSE
============================================================ */

async function loadAllData() {

  const [oahResult, vizResult] = await Promise.allSettled([
    loadOAH(),
    loadVizugy()
  ]);


  const oah =
    oahResult.status === "fulfilled"
      ? oahResult.value
      : {
          blocks: [null, null, null, null],
          total: null,
          time: "–",
          status: "HIBA",
          error: String(oahResult.reason || "")
        };


  const viz =
    vizResult.status === "fulfilled"
      ? vizResult.value
      : {
          water: null,
          temp: null,
          time: "–",
          status: "HIBA",
          error: String(vizResult.reason || "")
        };


  return {
    blocks: oah.blocks,
    total: oah.total,

    oahTime: oah.time,
    oahStatus: oah.status,
    oahError: oah.error || null,

    water: viz.water,
    temp: viz.temp,

    waterTime: viz.time,
    waterStatus: viz.status,
    waterError: viz.error || null,

    generated: new Date().toISOString()
  };
}


/* ============================================================
   OAH
============================================================ */

async function loadOAH() {

  const html = await fetchSource(OAH_URL);

  const text = htmlToText(html);

  /*
     Megkeressük kizárólag ezt a részt:

     A Paksi Atomerőmű elektromos teljesítmény adatai

     1. blokk 2. blokk 3. blokk 4. blokk
     xxx MW xxx MW xxx MW xxx MW
  */

  const marker =
    "A Paksi Atomerőmű elektromos teljesítmény adatai";

  const markerPos =
    normalize(text).indexOf(normalize(marker));


  if (markerPos < 0) {
    throw new Error("OAH: teljesítmény szakasz nem található");
  }


  /*
     Csak az ezt követő rövid szakaszt vizsgáljuk,
     így más MW szám nem keveredhet bele.
  */

  const section =
    text.substring(markerPos, markerPos + 1000);


  const matches =
    [...section.matchAll(/(-?\d{1,4}(?:[.,]\d+)?)\s*MW/gi)];


  const values = [];


  for (const match of matches) {

    const n = toNumber(match[1]);

    if (
      n !== null &&
      n >= 0 &&
      n <= 600
    ) {
      values.push(Math.round(n));
    }

    if (values.length === 4) break;
  }


  if (values.length !== 4) {
    throw new Error(
      "OAH: nem található mind a 4 blokk teljesítménye"
    );
  }


  const blocks = [
    values[0],
    values[1],
    values[2],
    values[3]
  ];


  const total =
    blocks.reduce((sum, value) => sum + value, 0);


  /*
     OAH frissítési idő
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


/* ============================================================
   VÍZÜGY – PAKS
============================================================ */

async function loadVizugy() {

  const html = await fetchSource(VIZ_URL);

  const text = htmlToText(html);


  /*
     Megkeressük pontosan a Paks vízmérce részt.
  */

  const marker = "Paks vízmérce";

  const markerPos =
    normalize(text).indexOf(normalize(marker));


  if (markerPos < 0) {
    throw new Error(
      "VÍZÜGY: Paks vízmérce nem található"
    );
  }


  const section =
    text.substring(markerPos, markerPos + 5000);


  /*
     A tényleges jelenlegi sor ilyen:

     2026.08.25. 10:00 -68 1006,000 24,3

     vagy bizonyos esetekben:

     dátum idő vízállás vízhozam felszíni-hő mederfenéki-hő

     Ezért NEM követelünk kötelezően két hőmérsékleti mezőt.
  */

  const rowRegex =
    /(\d{4}\.\d{2}\.\d{2}\.)\s+(\d{1,2}:\d{2})\s+(-?\d{1,4})\s+(-?\d+(?:[.,]\d+)?)\s+(?:(-|\d+(?:[.,]\d+)?))(?:\s+(-|\d+(?:[.,]\d+)?))?/g;


  let match;


  while ((match = rowRegex.exec(section)) !== null) {

    const date = match[1];
    const clock = match[2];

    const water =
      toNumber(match[3]);

    const temp1 =
      match[5] && match[5] !== "-"
        ? toNumber(match[5])
        : null;

    const temp2 =
      match[6] && match[6] !== "-"
        ? toNumber(match[6])
        : null;


    /*
       Ha felszíni hő van, azt használjuk.
       Ha nincs, de mederfenéki van, azt.
  */

    const temp =
      temp1 !== null
        ? temp1
        : temp2;


    if (
      water !== null &&
      water >= -500 &&
      water <= 1000
    ) {

      return {
        water: Math.round(water),

        temp:
          temp !== null
            ? Math.round(temp * 10) / 10
            : null,

        time: `${date} ${clock}`,

        status: "OK"
      };
    }
  }


  throw new Error(
    "VÍZÜGY: aktuális paksi mérési sor nem található"
  );
}


/* ============================================================
   FORRÁS LEKÉRÉSE
============================================================ */

async function fetchSource(url) {

  /*
     Fontos:
     nincs kamu host,
     nincs alternatív domain,
     nincs automatikus címváltogatás.
  */

  const response = await fetch(url, {
    method: "GET",

    headers: {
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

      "Accept-Language":
        "hu-HU,hu;q=0.9,en;q=0.7",

      "User-Agent":
        "Mozilla/5.0 (compatible; PaksMonitor/1.0)"
    },

    cf: {
      cacheTtl: 0,
      cacheEverything: false
    }
  });


  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status} – ${url}`
    );
  }


  const html =
    await response.text();


  if (!html || html.length < 200) {
    throw new Error(
      "Üres vagy hibás válasz"
    );
  }


  return html;
}


/* ============================================================
   HTML → SZÖVEG
============================================================ */

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
        /<\/p>/gi,
        " "
      )

      .replace(
        /<\/div>/gi,
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


/* ============================================================
   HTML ENTITÁSOK
============================================================ */

function decodeEntities(text) {

  return String(text)

    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")

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

    .replace(/&minus;/gi, "-")
    .replace(/&ndash;/gi, "-")
    .replace(/&mdash;/gi, "-")

    .replace(/&amp;/gi, "&")

    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"');
}


/* ============================================================
   NORMALIZÁLÁS
============================================================ */

function normalize(value) {

  return String(value)
    .toLocaleLowerCase("hu-HU")
    .replace(/\s+/g, " ")
    .trim();
}


/* ============================================================
   SZÁM KONVERZIÓ
============================================================ */

function toNumber(value) {

  if (
    value === null ||
    value === undefined ||
    value === "-"
  ) {
    return null;
  }


  const n =
    Number(
      String(value)
        .replace(/\s+/g, "")
        .replace(",", ".")
    );


  return Number.isFinite(n)
    ? n
    : null;
}


/* ============================================================
   OLDAL
============================================================ */

function renderPage(data) {

  const blocks =
    Array.isArray(data.blocks)
      ? data.blocks
      : [null, null, null, null];


  const oahOK =
    data.oahStatus === "OK";

  const vizOK =
    data.waterStatus === "OK";


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

* {
  box-sizing: border-box;
}

html,
body {
  margin: 0;
  padding: 0;
  background: #06111a;
  color: #fff;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}

body {
  min-height: 100vh;
}

.page {
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  padding: 22px 16px 30px;
}


/* HEADER */

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 25px;
  font-weight: 950;
  letter-spacing: -1px;
}

.atom {
  font-size: 27px;
}

.live {
  display: flex;
  align-items: center;
  gap: 7px;
  color: #45e6a1;
  font-size: 14px;
  font-weight: 900;
}

.liveDot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #45e6a1;
  box-shadow: 0 0 15px #45e6a1;
}


/* KÁRTYA */

.card {
  background: #0c1a25;
  border: 1px solid #203544;
  border-radius: 20px;
}


/* ÖSSZTELJESÍTMÉNY */

.total {
  margin-bottom: 13px;
  padding: 20px 10px 22px;
  text-align: center;
}

.label {
  color: #8da1b0;
  font-size: 14px;
  font-weight: 800;
  letter-spacing: .4px;
}

.totalNumber {
  margin-top: 7px;
  color: #48e5a0;
  font-size: 48px;
  font-weight: 950;
  line-height: 1;
}

.totalNumber span {
  margin-left: 4px;
  color: #94a8b6;
  font-size: 18px;
}


/* BLOKKOK */

.blocks {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.block {
  min-height: 102px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
}

.blockName {
  margin-bottom: 8px;
  color: #8fa2b0;
  font-size: 14px;
  font-weight: 850;
}

.blockMW {
  font-size: 31px;
  font-weight: 950;
  line-height: 1;
}

.blockMW span {
  margin-left: 4px;
  color: #8498a8;
  font-size: 15px;
}


/* DUNA */

.dunaTitle {
  margin: 20px 3px 10px;
  color: #94a8b6;
  font-size: 15px;
  font-weight: 900;
  letter-spacing: 1.4px;
}

.duna {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.waterCard {
  min-height: 138px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  text-align: center;
}

.icon {
  margin-bottom: 5px;
  font-size: 24px;
}

.waterLabel {
  color: #8da1b0;
  font-size: 13px;
  font-weight: 850;
}

.waterNumber {
  margin-top: 6px;
  color: #57c8ff;
  font-size: 38px;
  font-weight: 950;
  line-height: 1;
}

.waterNumber span {
  margin-left: 4px;
  color: #91a5b4;
  font-size: 15px;
}

.tempNumber {
  color: #ffc857;
}


/* FOOTER */

.footer {
  margin-top: 16px;
  padding-top: 13px;
  border-top: 1px solid #17303e;
  color: #607786;
  font-size: 11px;
  line-height: 1.8;
  text-align: center;
}

.ok {
  color: #45e6a1;
}

.err {
  color: #ffbf55;
}

.brand {
  margin-top: 8px;
  color: #415866;
  font-weight: 900;
  letter-spacing: 4px;
}


/* MOBIL */

@media (max-width: 390px) {

  .page {
    padding: 18px 12px 25px;
  }

  .logo {
    font-size: 22px;
  }

  .totalNumber {
    font-size: 44px;
  }

  .blockMW {
    font-size: 29px;
  }

  .waterNumber {
    font-size: 35px;
  }
}

</style>

</head>


<body>

<div class="page">


  <div class="header">

    <div class="logo">
      <span class="atom">⚛️</span>
      PAKS MONITOR
    </div>

    <div class="live">
      <span class="liveDot"></span>
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

    ${blockHTML(1, blocks[0])}

    ${blockHTML(2, blocks[1])}

    ${blockHTML(3, blocks[2])}

    ${blockHTML(4, blocks[3])}

  </div>



  <div class="dunaTitle">
    DUNA • PAKS
  </div>



  <div class="duna">


    <div class="card waterCard">

      <div class="icon">
        💧
      </div>

      <div class="waterLabel">
        VÍZÁLLÁS
      </div>

      <div class="waterNumber">
        ${show(data.water)}
        <span>cm</span>
      </div>

    </div>



    <div class="card waterCard">

      <div class="icon">
        🌡️
      </div>

      <div class="waterLabel">
        VÍZHŐMÉRSÉKLET
      </div>

      <div class="waterNumber tempNumber">
        ${showTemp(data.temp)}
        <span>°C</span>
      </div>

    </div>


  </div>



  <div class="footer">

    <div>
      PAKS • OAH:
      ${escapeHTML(data.oahTime || "–")}
      •
      <span class="${oahOK ? "ok" : "err"}">
        ${escapeHTML(data.oahStatus || "–")}
      </span>
    </div>


    <div>
      DUNA • VÍZÜGY:
      ${escapeHTML(data.waterTime || "–")}
      •
      <span class="${vizOK ? "ok" : "err"}">
        ${escapeHTML(data.waterStatus || "–")}
      </span>
    </div>


    <div class="brand">
      IGLÓDI
    </div>

  </div>


</div>


<script>

setTimeout(function () {
  location.reload();
}, 60000);

</script>


</body>
</html>`;
}


/* ============================================================
   BLOKK
============================================================ */

function blockHTML(number, mw) {

  return `
    <div class="card block">

      <div class="blockName">
        ${number}. BLOKK
      </div>

      <div class="blockMW">
        ${show(mw)}
        <span>MW</span>
      </div>

    </div>
  `;
}


/* ============================================================
   KIÍRÁS
============================================================ */

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


/* ============================================================
   HTML ESCAPE
============================================================ */

function escapeHTML(value) {

  return String(value)

    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
