/* ============================================================
   PAKS MONITOR
   2026-09-11

   JAVÍTÁS:
   - OAH rész változatlan logikával
   - VÍZÜGY pontos paksi vízmérce
   - közvetlen táblázatsor parser
   - legfrissebb hivatalos adat
   - korábbi VÍZÜGY sorok visszatöltése D1-be
   - 6 óra / 24 óra / 10 nap grafikon
   - fallback csak akkor, ha VÍZÜGY tényleg nem elérhető
============================================================ */


/* ============================================================
   FORRÁSOK
============================================================ */

const OAH_URL =
  "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";


/*
   PAKS VÍZMÉRCE
   Törzsszám: 549
   AllomasVOA: 16496188-97AB-11D4-BB62-00508BA24287

   Több URL-t próbálunk, de ugyanazt a PAKS vízmércét.
*/

const VIZ_URLS = [

  "https://www.vizugy.hu/index.php?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon",

  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon",

  "https://www.vizugy.hu/index.php?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&Vizf=Duna&hozam=0&mapData=Hossz_szelv&mapModule=Ophossz_szelv&width="
];


const PUBLIC_URL =
  "https://paks-monitor.laszlo-iglodi.workers.dev";


const ALERT_WATER_LEVEL =
  -129;


/* ============================================================
   SEGÉDFÜGGVÉNYEK
============================================================ */

function cleanHTML(html) {

  return String(html || "")

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
      "\n"
    )

    .replace(
      /<\/tr>/gi,
      "\n"
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
      /<\/p>/gi,
      "\n"
    )

    .replace(
      /<\/div>/gi,
      "\n"
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
      /&#176;/gi,
      "°"
    )

    .replace(
      /&sup3;/gi,
      "³"
    )

    .replace(
      /&#179;/gi,
      "³"
    )

    .replace(
      /&#8722;/gi,
      "-"
    )

    .replace(
      /&minus;/gi,
      "-"
    )

    .replace(
      /&amp;/gi,
      "&"
    )

    .replace(
      /<[^>]+>/g,
      " "
    )

    .replace(
      /−/g,
      "-"
    )

    .replace(
      /\r/g,
      "\n"
    )

    .replace(
      /[ \t]+/g,
      " "
    )

    .replace(
      /\n\s+/g,
      "\n"
    )

    .replace(
      /\n{2,}/g,
      "\n"
    )

    .trim();
}


function numberValue(value) {

  if (
    value === null ||
    value === undefined ||
    value === "-"
  ) {
    return null;
  }


  const text =
    String(value)
      .trim()
      .replace(/−/g, "-")
      .replace(/\s/g, "");


  /*
     VÍZÜGY:
     629.500 jelenthet 629,500 jellegű kijelzést.
     Vízhozamnál a pont után 3 számjegy esetén
     ez lehet tizedespont is. JS Number megfelelő.
  */

  const normalized =
    text.replace(",", ".");


  const n =
    Number(normalized);


  return Number.isFinite(n)
    ? n
    : null;
}


/* ============================================================
   BUDAPEST IDŐ
============================================================ */

function budapestParts(ts) {

  const parts =
    new Intl.DateTimeFormat(
      "hu-HU",
      {
        timeZone:
          "Europe/Budapest",

        year:
          "numeric",

        month:
          "2-digit",

        day:
          "2-digit",

        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false
      }
    )
    .formatToParts(
      new Date(ts)
    );


  function get(type) {

    return (
      parts.find(
        p => p.type === type
      )?.value || ""
    );
  }


  return {

    year:
      get("year"),

    month:
      get("month"),

    day:
      get("day"),

    hour:
      get("hour"),

    minute:
      get("minute")
  };
}


function localBudapestTimestamp(
  year,
  month,
  day,
  hour,
  minute
) {

  let guess =
    Date.UTC(
      year,
      month - 1,
      day,
      hour - 1,
      minute
    );


  for (
    let i = 0;
    i < 4;
    i++
  ) {

    const p =
      budapestParts(
        guess
      );


    const represented =
      Date.UTC(
        Number(p.year),
        Number(p.month) - 1,
        Number(p.day),
        Number(p.hour),
        Number(p.minute)
      );


    const wanted =
      Date.UTC(
        year,
        month - 1,
        day,
        hour,
        minute
      );


    guess +=
      wanted -
      represented;
  }


  return guess;
}


function parseHuDateTime(value) {

  if (!value) {
    return null;
  }


  const s =
    String(value)
      .replace(/\s+/g, " ")
      .trim();


  /*
     2026.09.11. 05:30
  */

  const m =
    s.match(
      /(\d{4})\.(\d{1,2})\.(\d{1,2})\.?\s+(\d{1,2}):(\d{2})/
    );


  if (!m) {
    return null;
  }


  return localBudapestTimestamp(

    Number(m[1]),

    Number(m[2]),

    Number(m[3]),

    Number(m[4]),

    Number(m[5])
  );
}


function formatTime(ts) {

  if (!ts) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "hu-HU",
    {
      timeZone:
        "Europe/Budapest",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false
    }
  )
  .format(
    new Date(ts)
  );
}


function formatDateTime(ts) {

  if (!ts) {
    return "—";
  }


  return new Intl.DateTimeFormat(
    "hu-HU",
    {
      timeZone:
        "Europe/Budapest",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hour12:
        false
    }
  )
  .format(
    new Date(ts)
  );
}


/* ============================================================
   OAH
============================================================ */

async function fetchOah() {

  try {

    const response =
      await fetch(

        OAH_URL +
        "&_=" +
        Date.now(),

        {

          headers: {

            "user-agent":
              "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",

            "cache-control":
              "no-cache",

            "pragma":
              "no-cache"
          },


          cf: {

            cacheTtl:
              0,

            cacheEverything:
              false
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "OAH HTTP " +
        response.status
      );
    }


    const html =
      await response.text();


    const text =
      cleanHTML(
        html
      );


    const blockMatch =
      text.match(

        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i

      );


    if (!blockMatch) {

      throw new Error(
        "OAH blokkadat nem található"
      );
    }


    const blocks = [

      Number(
        blockMatch[1]
      ),

      Number(
        blockMatch[2]
      ),

      Number(
        blockMatch[3]
      ),

      Number(
        blockMatch[4]
      )
    ];


    const total =
      blocks.reduce(
        (sum, value) =>
          sum + value,
        0
      );


    let measurementTs =
      Date.now();


    const dateMatch =

      text.match(
        /Mérés\s*dátuma[:\s]*([0-9]{4}\.[0-9]{1,2}\.[0-9]{1,2}\.?\s+[0-9]{1,2}:[0-9]{2})/i
      );


    if (dateMatch) {

      measurementTs =
        parseHuDateTime(
          dateMatch[1]
        )
        ||
        Date.now();
    }


    return {

      ok:
        true,

      blocks,

      total,

      ts:
        measurementTs,

      status:
        "OK"
    };


  } catch (error) {

    return {

      ok:
        false,

      blocks: [
        null,
        null,
        null,
        null
      ],

      total:
        null,

      ts:
        null,

      status:
        "KAPCSOLATI HIBA",

      error:
        String(error)
    };
  }
}


/* ============================================================
   VÍZÜGY PARSER
============================================================ */

/*
   Hivatalos táblázat tényleges formája:

   2026.09.11. 05:30 -111 629.500 22.0

   vagy:

   2026.09.10. 23:00 -110 634 22,6

   Első:
   dátum/idő

   Második:
   vízállás cm

   Harmadik:
   vízhozam m3/s

   Negyedik:
   felszíni vízhő °C
*/


function parseVizRows(html) {

  const text =
    cleanHTML(
      html
    );


  const rows = [];


  /*
     Direkt a hivatalos táblázat számsorát keressük.
  */

  const regex =
    /(\d{4}\.\d{1,2}\.\d{1,2}\.?\s+\d{1,2}:\d{2})\s+(-?\d{1,4})\s+(-|[0-9]+(?:[.,][0-9]+)?)\s+(-|[0-9]+(?:[.,][0-9]+)?)/g;


  let match;


  while (
    (
      match =
        regex.exec(text)
    ) !== null
  ) {

    const ts =
      parseHuDateTime(
        match[1]
      );


    const water =
      numberValue(
        match[2]
      );


    const flow =
      numberValue(
        match[3]
      );


    const temp =
      numberValue(
        match[4]
      );


    if (
      !Number.isFinite(ts)
    ) {
      continue;
    }


    if (
      !Number.isFinite(water)
    ) {
      continue;
    }


    /*
       Biztonsági életszerűség.
    */

    if (
      water < -500 ||
      water > 1500
    ) {
      continue;
    }


    if (
      Number.isFinite(flow) &&
      (
        flow < 50 ||
        flow > 10000
      )
    ) {
      continue;
    }


    if (
      Number.isFinite(temp) &&
      (
        temp < -5 ||
        temp > 40
      )
    ) {
      continue;
    }


    /*
       Jövőbeni hibás időpont kizárása.
    */

    if (
      ts >
      Date.now() +
      2 *
      60 *
      60 *
      1000
    ) {
      continue;
    }


    rows.push({

      ts,

      water:
        Math.round(
          water
        ),

      flow,

      temp
    });
  }


  /*
     Duplikációk eltávolítása.
  */

  const unique =
    new Map();


  for (
    const row
    of rows
  ) {

    const previous =
      unique.get(
        row.ts
      );


    if (!previous) {

      unique.set(
        row.ts,
        row
      );

      continue;
    }


    unique.set(

      row.ts,

      {

        ts:
          row.ts,

        water:
          row.water,

        flow:
          Number.isFinite(
            row.flow
          )
            ? row.flow
            : previous.flow,

        temp:
          Number.isFinite(
            row.temp
          )
            ? row.temp
            : previous.temp
      }
    );
  }


  return [
    ...unique.values()
  ]
  .sort(
    (a, b) =>
      a.ts - b.ts
  );
}


/* ============================================================
   VÍZÜGY LETÖLTÉS
============================================================ */

async function fetchViz() {

  const successfulSources =
    [];


  await Promise.all(

    VIZ_URLS.map(

      async (
        baseUrl,
        sourceIndex
      ) => {

        try {

          const separator =
            baseUrl.includes("?")
              ? "&"
              : "?";


          const fetchUrl =
            baseUrl +
            separator +
            "_cb=" +
            Date.now() +
            "_" +
            Math.random();


          const response =
            await fetch(

              fetchUrl,

              {

                headers: {

                  "user-agent":
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",

                  "accept":
                    "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",

                  "accept-language":
                    "hu-HU,hu;q=0.9,en;q=0.5",

                  "cache-control":
                    "no-cache",

                  "pragma":
                    "no-cache"
                },


                cf: {

                  cacheTtl:
                    0,

                  cacheEverything:
                    false
                },


                redirect:
                  "follow"
              }
            );


          if (
            !response.ok
          ) {
            return;
          }


          const html =
            await response.text();


          /*
             PLUSZ védelem:
             biztosan Paks vízmérce legyen,
             ne a küszöb alvíz vagy hűtővíz.
          */

          const cleaned =
            cleanHTML(html);


          if (
            !/Paks\s+vízmérce/i.test(
              cleaned
            )
            &&
            !/Vízmérce\s+név:\s*Paks/i.test(
              cleaned
            )
          ) {

            /*
               A Hossz_szelv oldal címe másképp is jöhet,
               ezért az állomás UUID-t elfogadjuk.
            */

            if (
              !html.includes(
                "16496188-97AB-11D4-BB62-00508BA24287"
              )
            ) {
              return;
            }
          }


          const rows =
            parseVizRows(
              html
            );


          if (
            !rows.length
          ) {
            return;
          }


          successfulSources.push({

            sourceIndex,

            sourceUrl:
              baseUrl,

            rows,

            latest:
              rows[
                rows.length - 1
              ]
          });


        } catch (error) {

          /*
             Egy forrás hibája
             nem állítja meg a másik kettőt.
          */

        }
      }
    )
  );


  if (
    !successfulSources.length
  ) {

    return {

      ok:
        false,

      official:
        false,

      water:
        null,

      flow:
        null,

      temp:
        null,

      ts:
        null,

      rows:
        [],

      status:
        "KAPCSOLATI HIBA"
    };
  }


  /*
     Az a forrás nyer,
     amelyiknek a LEGFRISSEBB mérési ideje van.
  */

  successfulSources.sort(

    (a, b) =>
      b.latest.ts -
      a.latest.ts
  );


  const winner =
    successfulSources[0];


  const latest =
    winner.latest;


  return {

    ok:
      true,

    official:
      true,

    water:
      latest.water,

    flow:
      latest.flow,

    temp:
      latest.temp,

    ts:
      latest.ts,

    rows:
      winner.rows,

    sourceUrl:
      winner.sourceUrl,

    sourceIndex:
      winner.sourceIndex,

    status:
      "OK"
  };
}


/* ============================================================
   D1
============================================================ */

async function ensureDB(env) {

  if (!env.DB) {
    return;
  }


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS measurements (

      ts INTEGER PRIMARY KEY,

      power INTEGER,

      water INTEGER,

      flow REAL,

      temp REAL
    )
  `).run();


  await env.DB.prepare(`
    CREATE TABLE IF NOT EXISTS meta (

      key TEXT PRIMARY KEY,

      value TEXT
    )
  `).run();


  await cleanupOldBadData(
    env
  );
}


/* ============================================================
   RÉGI HIBÁS SEED ADATOK EGYSZERI TAKARÍTÁSA
============================================================ */

async function cleanupOldBadData(
  env
) {

  const done =
    await env.DB.prepare(`
      SELECT value
      FROM meta
      WHERE key = ?
    `)
    .bind(
      "cleanup_20260911_v1"
    )
    .first();


  if (done) {
    return;
  }


  /*
     Régi mesterséges seed időpontok.
  */

  const oldSeedTimes = [

    "2026-08-18T00:00:00+02:00",

    "2026-08-18T12:00:00+02:00",

    "2026-08-21T00:00:00+02:00",

    "2026-08-23T00:00:00+02:00",

    "2026-08-23T12:00:00+02:00",

    "2026-08-24T07:00:00+02:00",

    "2026-08-24T18:00:00+02:00",

    "2026-08-26T16:35:00+02:00",

    "2026-08-27T09:00:00+02:00",

    "2026-08-28T01:30:00+02:00"
  ];


  for (
    const iso
    of oldSeedTimes
  ) {

    await env.DB.prepare(`
      DELETE FROM measurements
      WHERE ts = ?
    `)
    .bind(
      new Date(
        iso
      ).getTime()
    )
    .run();
  }


  await env.DB.prepare(`
    INSERT OR REPLACE INTO meta
    (key,value)
    VALUES (?,?)
  `)
  .bind(
    "cleanup_20260911_v1",
    "1"
  )
  .run();
}


/* ============================================================
   UTOLSÓ MENTETT VÍZÜGY ADAT
============================================================ */

async function getLastRiver(
  env
) {

  if (!env.DB) {
    return null;
  }


  return await env.DB.prepare(`
    SELECT

      ts,

      water,

      flow,

      temp

    FROM measurements

    WHERE water IS NOT NULL

    ORDER BY ts DESC

    LIMIT 1
  `)
  .first();
}


/* ============================================================
   VÍZÜGY TÖRTÉNETI SOROK BEÍRÁSA
============================================================ */

async function saveRiverRows(
  env,
  rows
) {

  if (
    !env.DB ||
    !Array.isArray(rows) ||
    !rows.length
  ) {
    return;
  }


  /*
     Legfeljebb az utolsó 500 hivatalos sor.
  */

  const selected =
    rows.slice(
      -500
    );


  for (
    const row
    of selected
  ) {

    if (
      !Number.isFinite(
        row.ts
      )
      ||
      !Number.isFinite(
        row.water
      )
    ) {
      continue;
    }


    const existing =
      await env.DB.prepare(`
        SELECT power
        FROM measurements
        WHERE ts = ?
      `)
      .bind(
        row.ts
      )
      .first();


    await env.DB.prepare(`
      INSERT OR REPLACE INTO measurements

      (
        ts,
        power,
        water,
        flow,
        temp
      )

      VALUES
      (?,?,?,?,?)
    `)
    .bind(

      row.ts,

      existing?.power ??
        null,

      row.water,

      Number.isFinite(
        row.flow
      )
        ? row.flow
        : null,

      Number.isFinite(
        row.temp
      )
        ? row.temp
        : null
    )
    .run();
  }
}


/* ============================================================
   AKTUÁLIS OAH ADAT MENTÉSE
============================================================ */

async function savePower(
  env,
  oah
) {

  if (
    !env.DB ||
    !oah?.ok ||
    !Number.isFinite(
      oah.total
    )
  ) {
    return;
  }


  const bucket =
    Math.floor(
      Date.now() /
      300000
    ) *
    300000;


  const existing =
    await env.DB.prepare(`
      SELECT

        water,

        flow,

        temp

      FROM measurements

      WHERE ts = ?
    `)
    .bind(
      bucket
    )
    .first();


  await env.DB.prepare(`
    INSERT OR REPLACE INTO measurements

    (
      ts,
      power,
      water,
      flow,
      temp
    )

    VALUES
    (?,?,?,?,?)
  `)
  .bind(

    bucket,

    oah.total,

    existing?.water ??
      null,

    existing?.flow ??
      null,

    existing?.temp ??
      null
  )
  .run();
}


/* ============================================================
   ADATBETÖLTÉS
============================================================ */

async function loadAllData(
  env
) {

  await ensureDB(
    env
  );


  const [
    oah,
    freshRiver
  ] =
    await Promise.all([

      fetchOah(),

      fetchViz()
    ]);


  /*
     VÍZÜGY TÖRTÉNETI SOROK
     azonnal bekerülnek D1-be.
  */

  if (
    freshRiver.ok &&
    freshRiver.official &&
    freshRiver.rows?.length
  ) {

    await saveRiverRows(

      env,

      freshRiver.rows
    );
  }


  await savePower(
    env,
    oah
  );


  let river =
    freshRiver;


  /*
     Ha most nem elérhető a VÍZÜGY,
     CSAK akkor használjuk
     az utolsó mentett adatot.
  */

  if (
    !freshRiver.ok
  ) {

    const stored =
      await getLastRiver(
        env
      );


    if (stored) {

      river = {

        ok:
          false,

        official:
          false,

        water:
          numberValue(
            stored.water
          ),

        flow:
          numberValue(
            stored.flow
          ),

        temp:
          numberValue(
            stored.temp
          ),

        ts:
          Number(
            stored.ts
          ),

        rows:
          [],

        status:
          "UTOLSÓ MENTETT ADAT"
      };


    } else {

      river = {

        ok:
          false,

        official:
          false,

        water:
          null,

        flow:
          null,

        temp:
          null,

        ts:
          null,

        rows:
          [],

        status:
          "NINCS ADAT"
      };
    }
  }


  /*
     11 napos tárolás.
  */

  if (env.DB) {

    await env.DB.prepare(`
      DELETE FROM measurements
      WHERE ts < ?
    `)
    .bind(

      Date.now() -
      11 *
      24 *
      60 *
      60 *
      1000
    )
    .run();
  }


  return {

    oah,

    river
  };
}


/* ============================================================
   VÍZÁLLÁS ÁLLAPOT
============================================================ */

function waterStatus(
  water
) {

  if (
    !Number.isFinite(
      water
    )
  ) {

    return {

      text:
        "NINCS ADAT",

      cls:
        "unknown"
    };
  }


  if (
    water <= -144
  ) {

    return {

      text:
        "KRITIKUS TARTOMÁNY",

      cls:
        "critical"
    };
  }


  if (
    water <= -134
  ) {

    return {

      text:
        "LEÁLLÁSI TARTOMÁNY",

      cls:
        "danger"
    };
  }


  if (
    water <= -129
  ) {

    return {

      text:
        "FIGYELMEZTETÉS",

      cls:
        "warning"
    };
  }


  return {

    text:
      "NORMÁL TARTOMÁNY",

    cls:
      "normal"
  };
}


/* ============================================================
   HTML
============================================================ */

function renderPage(
  data
) {

  const blocks =
    Array.isArray(
      data.oah.blocks
    )
      ? data.oah.blocks
      : [
          null,
          null,
          null,
          null
        ];


  const total =
    Number.isFinite(
      data.oah.total
    )
      ? data.oah.total
      : "—";


  const water =
    Number.isFinite(
      data.river?.water
    )
      ? data.river.water
      : null;


  const flow =
    Number.isFinite(
      data.river?.flow
    )
      ? data.river.flow
      : null;


  const temp =
    Number.isFinite(
      data.river?.temp
    )
      ? data.river.temp
      : null;


  const official =
    data.river?.official ===
    true;


  const ws =
    waterStatus(
      water
    );


  const shutdownReserve =
    Number.isFinite(
      water
    )
      ? water + 134
      : null;


  const safetyReserve =
    Number.isFinite(
      water
    )
      ? water + 144
      : null;


  return `
<!doctype html>

<html lang="hu">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,user-scalable=yes"
>

<meta
  name="theme-color"
  content="#070d18"
>

<title>
PAKS AKTUÁLIS ADATOK
</title>


<style>

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  background:#070d18;
  color:white;
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    sans-serif;
}

body{
  min-height:100vh;
}

.wrap{
  width:100%;
  max-width:700px;
  margin:0 auto;
  padding:12px;
}

.header{
  display:flex;
  align-items:center;
  justify-content:space-between;
  margin-bottom:10px;
}

.title{
  font-size:20px;
  font-weight:900;
  letter-spacing:.2px;
}

.live{
  color:#45e786;
  font-size:11px;
  font-weight:900;
}

.card{
  background:#101827;
  border:1px solid #28354a;
  border-radius:17px;
  padding:13px;
  margin-bottom:10px;
  overflow:hidden;
}

.section-title{
  color:#a7b0bf;
  font-size:11px;
  font-weight:900;
  letter-spacing:.4px;
}

.big{
  margin-top:7px;
  font-size:39px;
  line-height:1;
  font-weight:900;
}

.green{
  color:#68dc87;
}

.blue{
  color:#6db8ff;
}

.subtitle{
  margin-top:5px;
  color:#aab3c2;
  font-size:11px;
  font-weight:900;
}

.status{
  margin-top:6px;
  font-size:9px;
  font-weight:900;
}

.normal{
  color:#58e88d;
}

.warning{
  color:#ffd45a;
}

.danger{
  color:#ff923e;
}

.critical{
  color:#ff596a;
}

.unknown{
  color:#ffffff;
}

.chart-title{
  margin-top:15px;
  color:#a8b1c1;
  font-size:10px;
  font-weight:900;
}

.range{
  display:flex;
  gap:7px;
  margin:8px 0;
}

.range button{
  background:#111a29;
  border:1px solid #34445e;
  color:#a2adbe;
  border-radius:8px;
  padding:6px 10px;
  font-size:9px;
  font-weight:900;
}

.range button.active{
  background:#354963;
  color:#fff;
}

.chart-wrap{
  width:100%;
  height:122px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.blocks{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px;
}

.block{
  background:#192335;
  border-radius:11px;
  padding:9px 3px;
  text-align:center;
}

.block-name{
  color:#98a4b7;
  font-size:9px;
  font-weight:900;
}

.block-value{
  margin-top:4px;
  font-size:18px;
  font-weight:900;
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  margin-top:10px;
}

.metric{
  background:#192335;
  border-radius:11px;
  padding:9px;
}

.metric-label{
  color:#98a4b7;
  font-size:9px;
  font-weight:900;
}

.metric-value{
  margin-top:4px;
  font-size:18px;
  font-weight:900;
}

.gauge{
  margin-top:12px;
}

.gauge-line{
  position:relative;
  height:9px;
  border-radius:99px;
  background:
    linear-gradient(
      90deg,
      #ff5b6b,
      #ff9650,
      #ffd25d,
      #82ea98,
      #6ce991
    );
}

.marker{
  position:absolute;
  top:-5px;
  width:3px;
  height:19px;
  background:#fff;
  border-radius:4px;
}

.gauge-labels{
  display:flex;
  justify-content:space-between;
  margin-top:4px;
  color:#8794a7;
  font-size:8px;
}

.reserves{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  margin-top:8px;
}

.reserve{
  background:#192335;
  border-radius:11px;
  padding:8px;
  text-align:center;
}

.reserve-value{
  font-size:18px;
  font-weight:900;
}

.reserve-label{
  color:#929daf;
  font-size:8px;
  font-weight:900;
}

.source{
  margin-top:9px;
  color:#8996a9;
  font-size:9px;
  font-weight:900;
}

.ok{
  color:#52e88a;
}

.stale{
  color:#ffad48;
}

.warning-box{
  margin-top:8px;
  padding:8px;
  border-radius:9px;
  border:1px solid #67441b;
  background:#2a2014;
  color:#ffb85d;
  font-size:9px;
  font-weight:900;
}

.footer{
  margin:12px 0;
  color:#69778c;
  text-align:center;
  font-size:9px;
}

</style>

</head>


<body>

<div class="wrap">


<div class="header">

  <div class="title">
    ⚛️ PAKS AKTUÁLIS ADATOK
  </div>

  <div class="live">
    ● ÉLŐ
  </div>

</div>


<!-- ========================================================
     TELJESÍTMÉNY
======================================================== -->

<div class="card">

  <div class="section-title">
    PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
  </div>


  <div class="big green">
    ${total} MW
  </div>


  <div class="subtitle">
    ÖSSZTELJESÍTMÉNY
  </div>


  <div class="chart-title">
    TELJESÍTMÉNY VÁLTOZÁSA • MW
  </div>


  <div class="range">

    <button
      data-type="power"
      data-hours="6"
    >
      6 ÓRA
    </button>

    <button
      data-type="power"
      data-hours="24"
    >
      24 ÓRA
    </button>

    <button
      class="active"
      data-type="power"
      data-hours="240"
    >
      10 NAP
    </button>

  </div>


  <div class="chart-wrap">

    <canvas
      id="powerChart"
    ></canvas>

  </div>


  <div class="blocks">

    ${blocks.map(
      (b, i) => `

      <div class="block">

        <div class="block-name">
          ${i + 1}. BLOKK
        </div>

        <div class="block-value">
          ${
            Number.isFinite(b)
              ? b
              : "—"
          } MW
        </div>

      </div>

    `
    ).join("")}

  </div>


  <div class="source">

    OAH •

    ${formatTime(
      data.oah.ts
    )}

    •

    <span class="${
      data.oah.ok
        ? "ok"
        : "stale"
    }">

      ${data.oah.status}

    </span>

  </div>

</div>


<!-- ========================================================
     DUNA
======================================================== -->

<div class="card">

  <div class="section-title">
    🌊 DUNA VÍZÁLLÁSA PAKSNÁL
  </div>


  <div class="big blue">

    ${
      water !== null
        ? water
        : "—"
    } cm

  </div>


  <div class="status ${ws.cls}">
    ${ws.text}
  </div>


  <div class="chart-title">
    VÍZÁLLÁS VÁLTOZÁSA • CM
  </div>


  <div class="range">

    <button
      data-type="water"
      data-hours="6"
    >
      6 ÓRA
    </button>

    <button
      data-type="water"
      data-hours="24"
    >
      24 ÓRA
    </button>

    <button
      class="active"
      data-type="water"
      data-hours="240"
    >
      10 NAP
    </button>

  </div>


  <div class="chart-wrap">

    <canvas
      id="waterChart"
    ></canvas>

  </div>


  <div class="metrics">

    <div class="metric">

      <div class="metric-label">
        VÍZHOZAM
      </div>

      <div class="metric-value">

        ${
          flow !== null
            ? flow
                .toFixed(1)
                .replace(".", ",")
            : "—"
        } m³/s

      </div>

    </div>


    <div class="metric">

      <div class="metric-label">
        VÍZHŐMÉRSÉKLET
      </div>

      <div class="metric-value">

        ${
          temp !== null
            ? temp
                .toFixed(1)
                .replace(".", ",")
            : "—"
        } °C

      </div>

    </div>

  </div>


  <div class="gauge">

    <div class="gauge-line">

      ${
        water !== null
          ? `

        <div
          class="marker"
          style="
            left:${
              Math.max(
                0,
                Math.min(
                  100,
                  (
                    (
                      water +
                      150
                    ) /
                    40
                  ) *
                  100
                )
              )
            }%
          "
        ></div>

        `
          : ""
      }

    </div>


    <div class="gauge-labels">

      <span>
        −150
      </span>

      <span>
        −144
      </span>

      <span>
        −134
      </span>

      <span>
        −129
      </span>

      <span>
        −110 cm
      </span>

    </div>

  </div>


  <div class="reserves">

    <div class="reserve">

      <div class="reserve-value">

        ${
          shutdownReserve !== null
            ? shutdownReserve +
              " cm"
            : "—"
        }

      </div>

      <div class="reserve-label">
        LEÁLLÁSI KÜSZÖBIG
      </div>

    </div>


    <div class="reserve">

      <div class="reserve-value">

        ${
          safetyReserve !== null
            ? safetyReserve +
              " cm"
            : "—"
        }

      </div>

      <div class="reserve-label">
        BIZTONSÁGI HATÁRIG
      </div>

    </div>

  </div>


  <div class="source">

    VÍZÜGY •

    ${formatTime(
      data.river?.ts
    )}

    •

    <span class="${
      official
        ? "ok"
        : "stale"
    }">

      ${
        official
          ? "OK"
          : data.river?.status ||
            "NINCS ADAT"
      }

    </span>

  </div>


  ${
    !official
      ? `

    <div class="warning-box">

      ⚠️ A VÍZÜGY ÉLŐ LEKÉRÉSE NEM ELÉRHETŐ.
      AZ OLDAL UTOLSÓ MENTETT ADATOT MUTAT.

    </div>

    `
      : ""
  }

</div>


<div class="footer">

  PAKS MONITOR • IGLÓDI

</div>

</div>


<script>

/* ============================================================
   GRAFIKON
============================================================ */

let selectedRange = {

  power:
    240,

  water:
    240
};


async function loadHistory(
  type
) {

  try {

    const hours =
      selectedRange[
        type
      ];


    const response =
      await fetch(

        "/api/history?hours=" +
        hours +
        "&_=" +
        Date.now(),

        {
          cache:
            "no-store"
        }
      );


    const result =
      await response.json();


    if (
      type ===
      "power"
    ) {

      const points =
        result.rows

          .filter(
            r =>
              r.power !== null &&
              Number.isFinite(
                Number(
                  r.power
                )
              )
          )

          .map(
            r => ({
              x:
                Number(
                  r.ts
                ),

              y:
                Number(
                  r.power
                )
            })
          );


      drawChart(

        "powerChart",

        points,

        "MW",

        hours
      );


    } else {

      const points =
        result.rows

          .filter(
            r =>
              r.water !== null &&
              Number.isFinite(
                Number(
                  r.water
                )
              )
          )

          .map(
            r => ({
              x:
                Number(
                  r.ts
                ),

              y:
                Number(
                  r.water
                )
            })
          );


      drawChart(

        "waterChart",

        points,

        "cm",

        hours
      );
    }


  } catch (error) {

    console.error(
      error
    );
  }
}


function drawChart(
  canvasId,
  rawPoints,
  unit,
  hours
) {

  const canvas =
    document.getElementById(
      canvasId
    );


  if (!canvas) {
    return;
  }


  /*
     Érvényes pontok + időrend.
  */

  const map =
    new Map();


  for (
    const p
    of rawPoints
  ) {

    if (
      !Number.isFinite(
        p.x
      )
      ||
      !Number.isFinite(
        p.y
      )
    ) {
      continue;
    }


    if (
      unit === "MW"
      &&
      (
        p.y < 0 ||
        p.y > 2300
      )
    ) {
      continue;
    }


    if (
      unit === "cm"
      &&
      (
        p.y < -500 ||
        p.y > 1500
      )
    ) {
      continue;
    }


    map.set(
      p.x,
      p
    );
  }


  const points =
    [
      ...map.values()
    ]
    .sort(
      (a, b) =>
        a.x -
        b.x
    );


  const parent =
    canvas.parentElement;


  const rect =
    parent
      .getBoundingClientRect();


  const width =
    Math.max(
      100,
      Math.floor(
        rect.width
      )
    );


  const height =
    Math.max(
      80,
      Math.floor(
        rect.height
      )
    );


  const dpr =
    Math.min(
      window.devicePixelRatio ||
      1,
      3
    );


  canvas.width =
    Math.floor(
      width *
      dpr
    );


  canvas.height =
    Math.floor(
      height *
      dpr
    );


  canvas.style.width =
    width +
    "px";


  canvas.style.height =
    height +
    "px";


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.setTransform(
    dpr,
    0,
    0,
    dpr,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    width,
    height
  );


  if (
    !points.length
  ) {

    ctx.fillStyle =
      "#8794a7";


    ctx.font =
      "10px -apple-system";


    ctx.textAlign =
      "center";


    ctx.fillText(

      "NINCS TÖRTÉNETI ADAT",

      width /
      2,

      height /
      2
    );


    return;
  }


  const values =
    points.map(
      p => p.y
    );


  let minY =
    Math.min(
      ...values
    );


  let maxY =
    Math.max(
      ...values
    );


  let span =
    maxY -
    minY;


  if (
    span === 0
  ) {

    span =
      unit === "MW"
        ? 20
        : 2;


    minY -=
      span /
      2;


    maxY +=
      span /
      2;

  } else {

    const extra =
      span *
      0.15;


    minY -=
      extra;


    maxY +=
      extra;
  }


  if (
    unit === "MW"
  ) {

    minY =
      Math.floor(
        minY /
        10
      ) *
      10;


    maxY =
      Math.ceil(
        maxY /
        10
      ) *
      10;

  } else {

    minY =
      Math.floor(
        minY
      );


    maxY =
      Math.ceil(
        maxY
      );
  }


  if (
    minY === maxY
  ) {
    maxY +=
      1;
  }


  const yLabels =
    [];


  for (
    let i = 0;
    i <= 2;
    i++
  ) {

    const value =
      maxY -
      (
        maxY -
        minY
      ) *
      i /
      2;


    yLabels.push(

      Math.round(
        value
      ) +
      " " +
      unit
    );
  }


  ctx.font =
    "8px -apple-system";


  let widest =
    0;


  for (
    const label
    of yLabels
  ) {

    widest =
      Math.max(

        widest,

        ctx.measureText(
          label
        ).width
      );
  }


  const pad = {

    left:
      Math.ceil(
        widest
      ) +
      12,

    right:
      8,

    top:
      8,

    bottom:
      20
  };


  const chartW =
    Math.max(

      1,

      width -
      pad.left -
      pad.right
    );


  const chartH =
    Math.max(

      1,

      height -
      pad.top -
      pad.bottom
    );


  ctx.strokeStyle =
    "#29364a";


  ctx.lineWidth =
    1;


  ctx.fillStyle =
    "#8491a4";


  ctx.font =
    "8px -apple-system";


  for (
    let i = 0;
    i <= 2;
    i++
  ) {

    const y =
      pad.top +
      chartH *
      i /
      2;


    ctx.beginPath();


    ctx.moveTo(
      pad.left,
      y
    );


    ctx.lineTo(
      width -
      pad.right,
      y
    );


    ctx.stroke();


    ctx.textAlign =
      "left";


    ctx.textBaseline =
      "middle";


    ctx.fillText(

      yLabels[i],

      2,

      y
    );
  }


  const minX =
    points[
      0
    ].x;


  const maxX =
    points[
      points.length -
      1
    ].x;


  const xRange =
    Math.max(
      1,
      maxX -
      minX
    );


  function xPos(
    x
  ) {

    return (

      pad.left +

      (
        (
          x -
          minX
        ) /
        xRange
      ) *
      chartW
    );
  }


  function yPos(
    y
  ) {

    return (

      pad.top +

      (
        (
          maxY -
          y
        ) /
        (
          maxY -
          minY
        )
      ) *
      chartH
    );
  }


  /*
     Időben nagy adathiánynál
     ne húzzon átlós vonalat.
  */

  let maxGap;


  if (
    hours <= 6
  ) {

    maxGap =
      45 *
      60 *
      1000;

  } else if (
    hours <= 24
  ) {

    maxGap =
      2 *
      60 *
      60 *
      1000;

  } else {

    maxGap =
      8 *
      60 *
      60 *
      1000;
  }


  ctx.strokeStyle =
    unit === "MW"
      ? "#78e793"
      : "#6db8ff";


  ctx.lineWidth =
    2;


  ctx.lineJoin =
    "round";


  ctx.lineCap =
    "round";


  ctx.beginPath();


  let previous =
    null;


  for (
    const p
    of points
  ) {

    const x =
      xPos(
        p.x
      );


    const y =
      yPos(
        p.y
      );


    if (
      previous === null
      ||
      p.x -
      previous.x >
      maxGap
    ) {

      ctx.moveTo(
        x,
        y
      );

    } else {

      ctx.lineTo(
        x,
        y
      );
    }


    previous =
      p;
  }


  ctx.stroke();


  const last =
    points[
      points.length -
      1
    ];


  ctx.beginPath();


  ctx.arc(

    xPos(
      last.x
    ),

    yPos(
      last.y
    ),

    3,

    0,

    Math.PI *
    2
  );


  ctx.fillStyle =
    unit === "MW"
      ? "#78e793"
      : "#6db8ff";


  ctx.fill();


  ctx.fillStyle =
    "#8390a3";


  ctx.font =
    "8px -apple-system";


  ctx.textBaseline =
    "alphabetic";


  const ticks = [

    minX,

    minX +
    xRange /
    2,

    maxX
  ];


  ticks.forEach(
    (
      ts,
      index
    ) => {

      const d =
        new Date(
          ts
        );


      let label;


      if (
        hours >= 240
      ) {

        label =
          d.toLocaleString(

            "hu-HU",

            {

              timeZone:
                "Europe/Budapest",

              month:
                "2-digit",

              day:
                "2-digit",

              hour:
                "2-digit",

              minute:
                "2-digit",

              hour12:
                false
            }
          );

      } else {

        label =
          d.toLocaleTimeString(

            "hu-HU",

            {

              timeZone:
                "Europe/Budapest",

              hour:
                "2-digit",

              minute:
                "2-digit",

              hour12:
                false
            }
          );
      }


      ctx.textAlign =

        index === 0
          ? "left"
          :
        index === 1
          ? "center"
          :
          "right";


      ctx.fillText(

        label,

        xPos(
          ts
        ),

        height -
        4
      );
    }
  );
}


/* ============================================================
   GOMBOK
============================================================ */

document
  .querySelectorAll(
    ".range button"
  )
  .forEach(
    button => {

      button.addEventListener(

        "click",

        () => {

          const type =
            button.dataset.type;


          const hours =
            Number(
              button.dataset.hours
            );


          selectedRange[
            type
          ] =
            hours;


          document
            .querySelectorAll(
              '.range button[data-type="' +
              type +
              '"]'
            )
            .forEach(
              b =>
                b.classList.remove(
                  "active"
                )
            );


          button
            .classList
            .add(
              "active"
            );


          loadHistory(
            type
          );
        }
      );
    }
  );


loadHistory(
  "power"
);


loadHistory(
  "water"
);


let resizeTimer =
  null;


window.addEventListener(

  "resize",

  () => {

    clearTimeout(
      resizeTimer
    );


    resizeTimer =
      setTimeout(

        () => {

          loadHistory(
            "power"
          );


          loadHistory(
            "water"
          );

        },

        150
      );
  }
);

</script>

</body>

</html>
`;
}


/* ============================================================
   WORKER
============================================================ */

export default {


  async fetch(
    request,
    env,
    ctx
  ) {

    const url =
      new URL(
        request.url
      );


    /* ========================================================
       API
    ======================================================== */

    if (
      url.pathname ===
      "/api"
    ) {

      const data =
        await loadAllData(
          env
        );


      return new Response(

        JSON.stringify(

          {

            oah:
              data.oah,

            river: {

              ok:
                data.river.ok,

              official:
                data.river.official,

              water:
                data.river.water,

              flow:
                data.river.flow,

              temp:
                data.river.temp,

              ts:
                data.river.ts,

              status:
                data.river.status,

              sourceUrl:
                data.river.sourceUrl ||
                null
            },


            riverInfo: {

              station:
                "Paks",

              stationId:
                "16496188-97AB-11D4-BB62-00508BA24287",

              measurementTime:
                data.river.ts
                  ? formatDateTime(
                      data.river.ts
                    )
                  : null,

              ageMinutes:
                data.river.ts
                  ? Math.round(
                      (
                        Date.now() -
                        data.river.ts
                      ) /
                      60000
                    )
                  : null,

              alert:
                data.river.official ===
                  true
                &&
                Number.isFinite(
                  data.river.water
                )
                &&
                data.river.water <=
                  ALERT_WATER_LEVEL
            }

          },

          null,

          2
        ),

        {

          headers: {

            "content-type":
              "application/json; charset=UTF-8",

            "cache-control":
              "no-store, no-cache, must-revalidate",

            "pragma":
              "no-cache",

            "expires":
              "0"
          }
        }
      );
    }


    /* ========================================================
       VÍZÜGY DEBUG
    ======================================================== */

    if (
      url.pathname ===
      "/api/debug-viz"
    ) {

      const river =
        await fetchViz();


      return new Response(

        JSON.stringify(

          {

            ok:
              river.ok,

            official:
              river.official,

            latest: {

              water:
                river.water,

              flow:
                river.flow,

              temp:
                river.temp,

              ts:
                river.ts,

              time:
                river.ts
                  ? formatDateTime(
                      river.ts
                    )
                  : null
            },

            rowCount:
              river.rows?.length ||
              0,

            source:
              river.sourceUrl ||
              null,

            rows:
              (
                river.rows ||
                []
              )
              .slice(
                -20
              )

          },

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


    /* ========================================================
       HISTORY
    ======================================================== */

    if (
      url.pathname ===
      "/api/history"
    ) {

      await ensureDB(
        env
      );


      let hours =
        Number(
          url.searchParams.get(
            "hours"
          )
          ||
          240
        );


      if (
        ![
          6,
          24,
          240
        ].includes(
          hours
        )
      ) {

        hours =
          240;
      }


      const cutoff =
        Date.now() -
        hours *
        60 *
        60 *
        1000;


      const result =
        await env.DB.prepare(`
          SELECT

            ts,

            power,

            water,

            flow,

            temp

          FROM measurements

          WHERE ts >= ?

          ORDER BY ts ASC
        `)
        .bind(
          cutoff
        )
        .all();


      return new Response(

        JSON.stringify(
          {

            hours,

            rows:
              result.results ||
              []
          }
        ),

        {

          headers: {

            "content-type":
              "application/json; charset=UTF-8",

            "cache-control":
              "no-store, no-cache, must-revalidate",

            "pragma":
              "no-cache",

            "expires":
              "0"
          }
        }
      );
    }


    /* ========================================================
       FŐOLDAL
    ======================================================== */

    const data =
      await loadAllData(
        env
      );


    return new Response(

      renderPage(
        data
      ),

      {

        headers: {

          "content-type":
            "text/html; charset=UTF-8",

          "cache-control":
            "no-store, no-cache, must-revalidate",

          "pragma":
            "no-cache",

          "expires":
            "0"
        }
      }
    );
  },


  /* ==========================================================
     CRON
  ========================================================== */

  async scheduled(
    event,
    env,
    ctx
  ) {

    ctx.waitUntil(

      loadAllData(
        env
      )
    );
  }
};
