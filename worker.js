export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/api") {
      const data = await loadAllData();

      return json(data);
    }

    const data = await loadAllData();

    return new Response(renderPage(data), {
      headers: {
        "content-type": "text/html; charset=UTF-8",
        "cache-control": "no-store, no-cache, must-revalidate",
      },
    });
  },
};


/* ============================================================
   PAKS MONITOR – LETISZTULT VERZIÓ

   CSAK:
   - 1. blokk MW
   - 2. blokk MW
   - 3. blokk MW
   - 4. blokk MW
   - összteljesítmény
   - Paks Duna vízállás
   - Paks Duna vízhőmérséklet
============================================================ */


/* ============================================================
   FORRÁSOK
============================================================ */

const OAH_URLS = [

  "https://tranem.haea.gov.hu/web/v3/oahportal.nsf/web?article=paksnpp&openagent=",

  "https://www.haea.gov.hu/web/v3/OAHportal.nsf/web?OpenAgent=&article=paksnpp",

  "https://nyomtatvany.haea.gov.hu/web/v3/oahportal.nsf/web?article=paksnpp&openagent="
];


const VIZ_URL =
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=Idosor&mapModule=OpFeGrafikon";



/* ============================================================
   MINDEN ADAT
============================================================ */

async function loadAllData() {

  const [paksResult, waterResult] =
    await Promise.allSettled([
      loadPaks(),
      loadWater()
    ]);


  const paks =
    paksResult.status === "fulfilled"
      ? paksResult.value
      : {
          blocks: [null, null, null, null],
          total: null,
          time: "–",
          status: "KAPCSOLATI HIBA"
        };


  const water =
    waterResult.status === "fulfilled"
      ? waterResult.value
      : {
          water: null,
          temp: null,
          time: "–",
          status: "KAPCSOLATI HIBA"
        };


  return {

    blocks: paks.blocks,

    total: paks.total,

    oahTime: paks.time,

    oahStatus: paks.status,

    water: water.water,

    temp: water.temp,

    waterTime: water.time,

    waterStatus: water.status,

    generated:
      new Date().toISOString()

  };
}



/* ============================================================
   OAH – PAKSI BLOKKOK
============================================================ */

async function loadPaks() {

  let lastError = null;


  for (const baseUrl of OAH_URLS) {

    try {

      const html =
        await fetchFresh(baseUrl);


      const result =
        parseOAH(html);


      if (
        result.blocks &&
        result.blocks.filter(
          x => x !== null
        ).length === 4
      ) {

        return {
          ...result,
          status: "OK"
        };

      }


      lastError =
        new Error("OAH ADATHIBA");

    }

    catch (e) {

      lastError = e;

    }

  }


  throw lastError ||
    new Error("OAH KAPCSOLATI HIBA");
}



/* ============================================================
   OAH PARSER
============================================================ */

function parseOAH(html) {

  const text =
    htmlToText(html);


  /*
     A tényleges OAH oldal körülbelül így néz ki:

     Utolsó frissítés: 2026. 08. 24 11:09

     A Paksi Atomerőmű elektromos teljesítmény adatai

     1. blokk
     2. blokk
     3. blokk
     4. blokk

     470 MW
     478 MW
     467 MW
     0 MW
  */


  let section = text;


  const startText =
    "A Paksi Atomerőmű elektromos teljesítmény adatai";


  const start =
    text.indexOf(startText);


  if (start >= 0) {

    section =
      text.slice(
        start,
        start + 1200
      );

  }


  /*
     Az elektromos teljesítmény szakaszból
     vesszük az első 4 MW értéket.
  */

  const mwMatches =
    [
      ...section.matchAll(
        /(-?\d{1,4}(?:[.,]\d+)?)\s*MW/gi
      )
    ];


  const values = [];


  for (const match of mwMatches) {

    const n =
      toNumber(match[1]);


    if (
      n !== null &&
      n >= 0 &&
      n <= 600
    ) {

      values.push(
        Math.round(n)
      );

    }


    if (values.length === 4)
      break;

  }


  const blocks = [
    values[0] ?? null,
    values[1] ?? null,
    values[2] ?? null,
    values[3] ?? null
  ];


  /*
     CSAK akkor számolunk összeget,
     ha mind a négy blokk megvan.
  */

  let total = null;


  if (
    blocks.every(
      x => x !== null
    )
  ) {

    total =
      blocks.reduce(
        (a, b) => a + b,
        0
      );

  }


  /*
     OAH frissítési idő
  */

  let time = "–";


  const tm =
    text.match(
      /Utolsó\s+frissítés\s*:\s*(\d{4}\.\s*\d{1,2}\.\s*\d{1,2}\s+\d{1,2}:\d{2})/i
    );


  if (tm) {

    time =
      tm[1]
        .replace(/\s+/g, " ")
        .trim();

  }


  return {
    blocks,
    total,
    time
  };

}



/* ============================================================
   VÍZÜGY
============================================================ */

async function loadWater() {

  const html =
    await fetchFresh(VIZ_URL);


  const result =
    parseWater(html);


  if (
    result.water === null
  ) {

    throw new Error(
      "VÍZÜGY ADATHIBA"
    );

  }


  return {
    ...result,
    status: "OK"
  };

}



/* ============================================================
   VÍZÜGY PARSER
============================================================ */

function parseWater(html) {

  const text =
    htmlToText(html);


  /*
     Megkeressük a PAKS vízmérce részét.
  */

  let section = text;


  const marker =
    "Paks vízmérce";


  const p =
    text.indexOf(marker);


  if (p >= 0) {

    section =
      text.slice(
        p,
        p + 5000
      );

  }


  /*
     Valós Vízügy formátum:

     2026.08.02. 11:00 -133 737.800 - 27.4

     oszlopok:

     dátum
     idő
     vízállás cm
     vízhozam
     felszíni vízhő
     mederfenéki vízhő

     Ha a felszíni érték "-"
     akkor a mederfenéki vízhőt használjuk.
  */


  const rowRegex =
    /(\d{4}\.\d{2}\.\d{2}\.)\s+(\d{1,2}:\d{2})\s+(-?\d{1,4})\s+(-?\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)/g;


  let match;


  while (
    (match = rowRegex.exec(section))
    !== null
  ) {


    const date =
      match[1];


    const clock =
      match[2];


    const water =
      toNumber(match[3]);


    const surfaceTemp =
      match[5] === "-"
        ? null
        : toNumber(match[5]);


    const bottomTemp =
      match[6] === "-"
        ? null
        : toNumber(match[6]);


    /*
       Elsődlegesen felszíni vízhő.
       Ha nincs, akkor mederfenéki.
    */

    const temp =
      surfaceTemp !== null
        ? surfaceTemp
        : bottomTemp;


    if (
      water !== null &&
      water > -500 &&
      water < 1000
    ) {

      return {

        water:
          Math.round(water),

        temp:
          temp === null
            ? null
            : Math.round(
                temp * 10
              ) / 10,

        time:
          `${date} ${clock}`

      };

    }

  }


  return {

    water: null,

    temp: null,

    time: "–"

  };

}



/* ============================================================
   FRISS FETCH
============================================================ */

async function fetchFresh(baseUrl) {

  /*
     Cache-buster:
     így a Cloudflare sem tartja bent
     a régi OAH/Vízügy oldalt.
  */

  const separator =
    baseUrl.includes("?")
      ? "&"
      : "?";


  const url =
    baseUrl +
    separator +
    "_paksmonitor=" +
    Date.now();


  const res =
    await fetch(
      url,
      {
        method: "GET",

        headers: {

          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

          "Accept":
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

          "Accept-Language":
            "hu-HU,hu;q=0.9,en;q=0.7",

          "Cache-Control":
            "no-cache",

          "Pragma":
            "no-cache"

        },

        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }

      }
    );


  if (!res.ok) {

    throw new Error(
      "HTTP " + res.status
    );

  }


  return await res.text();

}



/* ============================================================
   HTML -> TEXT
============================================================ */

function htmlToText(html) {

  return String(html)

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
      /<\/tr>/gi,
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
      /<[^>]*>/g,
      " "
    )

    .replace(
      /&nbsp;/gi,
      " "
    )

    .replace(
      /&#160;/gi,
      " "
    )

    .replace(
      /&deg;/gi,
      "°"
    )

    .replace(
      /&minus;/gi,
      "-"
    )

    .replace(
      /&ndash;/gi,
      "-"
    )

    .replace(
      /&mdash;/gi,
      "-"
    )

    .replace(
      /&amp;/gi,
      "&"
    )

    .replace(
      /\s+/g,
      " "
    )

    .trim();

}



/* ============================================================
   SZÁM
============================================================ */

function toNumber(value) {

  if (
    value === null ||
    value === undefined
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
   JSON DEBUG
============================================================ */

function json(data) {

  return new Response(
    JSON.stringify(
      data,
      null,
      2
    ),
    {
      headers: {
        "content-type":
          "application/json; charset=UTF-8",
        "cache-control":
          "no-store"
      }
    }
  );

}



/* ============================================================
   OLDAL
============================================================ */

function renderPage(data) {

  const blocks =
    data.blocks ||
    [
      null,
      null,
      null,
      null
    ];


  return `<!doctype html>

<html lang="hu">

<head>

<meta charset="utf-8">

<meta
 name="viewport"
 content="width=device-width,
 initial-scale=1,
 maximum-scale=5,
 user-scalable=yes"
>

<meta
 name="theme-color"
 content="#06111a"
>

<title>
PAKS MONITOR
</title>


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

 font-family:
 -apple-system,
 BlinkMacSystemFont,
 "Segoe UI",
 Arial,
 sans-serif;

}


body{
 min-height:100vh;
}


.page{

 width:100%;
 max-width:720px;

 margin:auto;

 padding:
 22px 16px 30px;

}


/* HEADER */

.header{

 display:flex;

 align-items:center;

 justify-content:
 space-between;

 margin-bottom:20px;

}


.logo{

 display:flex;

 align-items:center;

 gap:10px;

 font-weight:950;

 font-size:25px;

 letter-spacing:-1px;

}


.atom{

 font-size:27px;

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

 margin-right:7px;

 border-radius:50%;

 background:#45e6a1;

 box-shadow:
 0 0 15px #45e6a1;

}


/* KÁRTYA */

.card{

 background:#0c1a25;

 border:
 1px solid #203544;

 border-radius:20px;

}


/* ÖSSZTELJESÍTMÉNY */

.total{

 padding:
 20px 10px 22px;

 text-align:center;

 margin-bottom:13px;

}


.label{

 color:#8da1b0;

 font-size:14px;

 font-weight:800;

 letter-spacing:.4px;

}


.totalNumber{

 margin-top:7px;

 font-size:48px;

 line-height:1;

 font-weight:950;

 color:#48e5a0;

}


.totalNumber span{

 color:#94a8b6;

 font-size:18px;

 margin-left:4px;

}


/* BLOKKOK */

.blocks{

 display:grid;

 grid-template-columns:
 1fr 1fr;

 gap:10px;

}


.block{

 min-height:102px;

 display:flex;

 flex-direction:column;

 justify-content:center;

 align-items:center;

}


.blockName{

 color:#8fa2b0;

 font-size:14px;

 font-weight:850;

 margin-bottom:8px;

}


.blockMW{

 font-size:31px;

 font-weight:950;

 line-height:1;

}


.blockMW span{

 margin-left:4px;

 color:#8498a8;

 font-size:15px;

}


/* DUNA */

.dunaTitle{

 color:#94a8b6;

 font-size:15px;

 font-weight:900;

 letter-spacing:1.4px;

 margin:
 20px 3px 10px;

}


.duna{

 display:grid;

 grid-template-columns:
 1fr 1fr;

 gap:10px;

}


.waterCard{

 min-height:138px;

 text-align:center;

 display:flex;

 flex-direction:column;

 justify-content:center;

}


.icon{

 font-size:24px;

 margin-bottom:5px;

}


.waterLabel{

 font-size:13px;

 font-weight:850;

 color:#8da1b0;

}


.waterNumber{

 margin-top:6px;

 font-size:38px;

 line-height:1;

 font-weight:950;

 color:#57c8ff;

}


.waterNumber span{

 margin-left:4px;

 font-size:15px;

 color:#91a5b4;

}


.tempNumber{

 color:#ffc857;

}


/* FOOTER */

.footer{

 border-top:
 1px solid #17303e;

 margin-top:16px;

 padding-top:13px;

 text-align:center;

 color:#607786;

 font-size:11px;

 line-height:1.8;

}


.brand{

 margin-top:8px;

 font-weight:900;

 letter-spacing:4px;

 color:#415866;

}


/* STATUS */

.good{
 color:#45e6a1;
}

.bad{
 color:#ffbf55;
}


/* KISEBB MOBIL */

@media(
 max-width:390px
){

 .page{
   padding:
   18px 12px 25px;
 }

 .logo{
   font-size:22px;
 }

 .totalNumber{
   font-size:44px;
 }

 .blockMW{
   font-size:29px;
 }

 .waterNumber{
   font-size:35px;
 }

}

</style>

</head>


<body>


<div class="page">


<div class="header">

 <div class="logo">

   <span class="atom">
   ⚛️
   </span>

   PAKS MONITOR

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

 ${blockHTML(
   1,
   blocks[0]
 )}

 ${blockHTML(
   2,
   blocks[1]
 )}

 ${blockHTML(
   3,
   blocks[2]
 )}

 ${blockHTML(
   4,
   blocks[3]
 )}

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

   <span>
   cm
   </span>

   </div>

 </div>



 <div class="card waterCard">

   <div class="icon">
   🌡️
   </div>

   <div class="waterLabel">

   VÍZHŐMÉRSÉKLET

   </div>

   <div class=
   "waterNumber tempNumber">

   ${showTemp(data.temp)}

   <span>
   °C
   </span>

   </div>

 </div>


</div>



<div class="footer">

 <div>

 PAKS • OAH:
 ${escapeHTML(
   data.oahTime ||
   "–"
 )}

 •

 <span class="${
   data.oahStatus === "OK"
     ? "good"
     : "bad"
 }">

 ${escapeHTML(
   data.oahStatus ||
   "–"
 )}

 </span>

 </div>


 <div>

 DUNA • VÍZÜGY:
 ${escapeHTML(
   data.waterTime ||
   "–"
 )}

 •

 <span class="${
   data.waterStatus === "OK"
     ? "good"
     : "bad"
 }">

 ${escapeHTML(
   data.waterStatus ||
   "–"
 )}

 </span>

 </div>


 <div class="brand">

 IGLÓDI

 </div>

</div>


</div>


<script>

/*
   Automatikus frissítés:
   60 másodperc
*/

setTimeout(
 function(){

   location.reload();

 },
 60000
);

</script>


</body>

</html>`;

}



/* ============================================================
   BLOKK HTML
============================================================ */

function blockHTML(
  number,
  mw
) {

  return `

<div class="card block">

 <div class="blockName">

 ${number}. BLOKK

 </div>


 <div class="blockMW">

 ${show(mw)}

 <span>
 MW
 </span>

 </div>

</div>

`;

}



/* ============================================================
   MEGJELENÍTÉS
============================================================ */

function show(value) {

  if (
    value === null ||
    value === undefined ||
    !Number.isFinite(
      Number(value)
    )
  ) {

    return "??";

  }


  return escapeHTML(
    String(value)
      .replace(".", ",")
  );

}



function showTemp(value) {

  if (
    value === null ||
    value === undefined
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
   ESCAPE
============================================================ */

function escapeHTML(value) {

  return String(value)

    .replace(
      /&/g,
      "&amp;"
    )

    .replace(
      /</g,
      "&lt;"
    )

    .replace(
      />/g,
      "&gt;"
    )

    .replace(
      /"/g,
      "&quot;"
    )

    .replace(
      /'/g,
      "&#039;"
    );

}
