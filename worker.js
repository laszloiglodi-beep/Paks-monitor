/* ============================================================
   PAKS MONITOR
   FRISS HIVATALOS VÍZÜGY ADAT ELSŐDLEGES
============================================================ */

const OAH_URL =
  "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

const VIZ_URLS = [
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=Idosor&mapModule=OpFeGrafikon",
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=Idosor&mapModule=OpGrafikon",
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon"
];

const PUBLIC_URL =
  "https://paks-monitor.laszlo-iglodi.workers.dev";

const FB_IMAGE_RAW =
  "https://raw.githubusercontent.com/laszloiglodi-beep/Paks-monitor/main/60CF06BF-2068-420D-AC41-224FB3B75358.png";

const ALERT_WATER_LEVEL = -129;


/* ============================================================
   SEGÉDFÜGGVÉNYEK
============================================================ */

function cleanHTML(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " ")
    .replace(/<\/th>/gi, " ")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&deg;/gi, "°")
    .replace(/&sup3;/gi, "³")
    .replace(/&#176;/gi, "°")
    .replace(/&#179;/gi, "³")
    .replace(/&minus;/gi, "-")
    .replace(/&#8722;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}


function num(v) {
  if (v === null || v === undefined) return null;

  const n = Number(
    String(v)
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace("−", "-")
  );

  return Number.isFinite(n) ? n : null;
}


function budapestParts(ts = Date.now()) {
  const parts = new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(new Date(ts));

  const get = type =>
    parts.find(p => p.type === type)?.value || "";

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute")
  };
}


function formatTime(ts) {
  if (!ts) return "—";

  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(ts));
}


function formatDateTime(ts) {
  if (!ts) return "—";

  return new Intl.DateTimeFormat("hu-HU", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(ts));
}


/*
   Magyar időpont -> timestamp.

   Példák:
   2026.08.30. 12:00
   2026-08-30 12:00
   30.08.2026 12:00
*/

function parseHungarianDateTime(value) {
  if (!value) return null;

  let s = String(value)
    .replace(/\s+/g, " ")
    .trim();

  let m;


  // 2026.08.30. 12:00
  m = s.match(
    /(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})/
  );

  if (m) {
    const [, y, mo, d, h, mi] = m;

    return localBudapestTimestamp(
      Number(y),
      Number(mo),
      Number(d),
      Number(h),
      Number(mi)
    );
  }


  // 30.08.2026 12:00
  m = s.match(
    /(\d{1,2})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{4})\.?\s+(\d{1,2}):(\d{2})/
  );

  if (m) {
    const [, d, mo, y, h, mi] = m;

    return localBudapestTimestamp(
      Number(y),
      Number(mo),
      Number(d),
      Number(h),
      Number(mi)
    );
  }


  return null;
}


/*
   Europe/Budapest helyi idő -> UTC timestamp.
   Nyári/téli időszámítás kezelésével.
*/

function localBudapestTimestamp(year, month, day, hour, minute) {
  let guess = Date.UTC(
    year,
    month - 1,
    day,
    hour - 1,
    minute
  );

  for (let i = 0; i < 3; i++) {
    const p = budapestParts(guess);

    const represented = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute)
    );

    const wanted = Date.UTC(
      year,
      month - 1,
      day,
      hour,
      minute
    );

    guess += wanted - represented;
  }

  return guess;
}


/* ============================================================
   OAH – BLOKK TELJESÍTMÉNY
============================================================ */

async function fetchOah() {
  try {
    const response = await fetch(
      OAH_URL + "&_=" + Date.now(),
      {
        headers: {
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
          "cache-control": "no-cache",
          "pragma": "no-cache"
        },
        cf: {
          cacheTtl: 0,
          cacheEverything: false
        }
      }
    );

    if (!response.ok) {
      throw new Error("OAH HTTP " + response.status);
    }

    const html = await response.text();
    const text = cleanHTML(html);


    const blockMatch = text.match(
      /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
    );

    if (!blockMatch) {
      throw new Error("OAH blokkadat nem található");
    }

    const blocks = [
      Number(blockMatch[1]),
      Number(blockMatch[2]),
      Number(blockMatch[3]),
      Number(blockMatch[4])
    ];

    const total =
      blocks.reduce((sum, value) => sum + value, 0);


    let measurementTs = null;

    const dateMatch =
      text.match(
        /Mérés\s*dátuma[:\s]*([0-9]{4}[.\-\/][0-9]{1,2}[.\-\/][0-9]{1,2}\.?\s+[0-9]{1,2}:[0-9]{2})/i
      ) ||
      text.match(
        /Mérés\s*dátuma[:\s]*([0-9]{1,2}[.\-\/][0-9]{1,2}[.\-\/][0-9]{4}\.?\s+[0-9]{1,2}:[0-9]{2})/i
      );

    if (dateMatch) {
      measurementTs =
        parseHungarianDateTime(dateMatch[1]);
    }

    return {
      ok: true,
      blocks,
      total,
      ts: measurementTs || Date.now(),
      status: "OK"
    };

  } catch (error) {
    return {
      ok: false,
      blocks: [null, null, null, null],
      total: null,
      ts: null,
      status: "KAPCSOLATI HIBA",
      error: String(error)
    };
  }
}


/* ============================================================
   VÍZÜGY – FRISS ADAT KERESÉSE
============================================================ */

/*
   FONTOS:

   Nem az első talált számot használjuk.

   Az oldalból minden olyan részt megkeresünk,
   amelyhez időbélyeg tartozik.

   Ezután a mérési sorokat timestamp szerint rendezzük,
   és a LEGFRISSEBBET választjuk.
*/


function parseVizRows(html) {
  const text = cleanHTML(html);

  const rows = [];


  /*
     A szöveget sorokra bontjuk.
     Egy mérési sor általában dátum + vízállás +
     vízhozam + vízhőmérséklet környezetében található.
  */

  const lines = text
    .split(/\n/)
    .map(x => x.trim())
    .filter(Boolean);


  for (let i = 0; i < lines.length; i++) {

    const combined = [
      lines[i - 1] || "",
      lines[i] || "",
      lines[i + 1] || "",
      lines[i + 2] || "",
      lines[i + 3] || ""
    ].join(" ");


    const dateMatch =
      combined.match(
        /(\d{4}[.\-\/]\s*\d{1,2}[.\-\/]\s*\d{1,2}\.?\s+\d{1,2}:\d{2})/
      ) ||
      combined.match(
        /(\d{1,2}[.\-\/]\s*\d{1,2}[.\-\/]\s*\d{4}\.?\s+\d{1,2}:\d{2})/
      );


    if (!dateMatch) continue;


    const ts =
      parseHungarianDateTime(dateMatch[1]);

    if (!ts) continue;


    /*
       Vízállás cm
    */

    let water = null;

    const waterPatterns = [
      /vízállás[^+\-−0-9]{0,25}([+\-−]?\d{1,4})\s*cm/i,
      /([+\-−]?\d{1,4})\s*cm/i
    ];

    for (const pattern of waterPatterns) {
      const m = combined.match(pattern);

      if (m) {
        const value = num(m[1]);

        if (
          value !== null &&
          value >= -1000 &&
          value <= 2000
        ) {
          water = value;
          break;
        }
      }
    }


    /*
       Vízhozam m³/s
    */

    let flow = null;

    const flowMatch =
      combined.match(
        /(?:vízhozam[^0-9]{0,30})?([0-9]{2,5}(?:[,.][0-9]+)?)\s*m(?:³|3)\s*\/\s*s/i
      );

    if (flowMatch) {
      flow = num(flowMatch[1]);
    }


    /*
       Vízhőmérséklet
    */

    let temp = null;

    const tempMatch =
      combined.match(
        /(?:vízhőmérséklet[^0-9]{0,30})?([0-9]{1,2}(?:[,.][0-9]+)?)\s*°?\s*C/i
      );

    if (tempMatch) {
      const t = num(tempMatch[1]);

      if (t !== null && t >= -5 && t <= 40) {
        temp = t;
      }
    }


    if (water !== null) {
      rows.push({
        ts,
        water,
        flow,
        temp
      });
    }
  }


  /*
     Második parser:
     ha a HTML nem sortörésekkel adja vissza a táblázatot.
  */

  const globalDateRegex =
    /(\d{4}[.\-\/]\s*\d{1,2}[.\-\/]\s*\d{1,2}\.?\s+\d{1,2}:\d{2}|\d{1,2}[.\-\/]\s*\d{1,2}[.\-\/]\s*\d{4}\.?\s+\d{1,2}:\d{2})/g;

  let match;

  while ((match = globalDateRegex.exec(text)) !== null) {

    const ts =
      parseHungarianDateTime(match[1]);

    if (!ts) continue;


    const start = match.index;
    const section =
      text.slice(start, start + 500);


    const waterMatch =
      section.match(
        /([+\-−]?\d{1,4})\s*cm/i
      );

    if (!waterMatch) continue;


    const water =
      num(waterMatch[1]);

    if (
      water === null ||
      water < -1000 ||
      water > 2000
    ) {
      continue;
    }


    const flowMatch =
      section.match(
        /([0-9]{2,5}(?:[,.][0-9]+)?)\s*m(?:³|3)\s*\/\s*s/i
      );


    const tempMatch =
      section.match(
        /([0-9]{1,2}(?:[,.][0-9]+)?)\s*°?\s*C/i
      );


    rows.push({
      ts,
      water,
      flow:
        flowMatch ? num(flowMatch[1]) : null,
      temp:
        tempMatch ? num(tempMatch[1]) : null
    });
  }


  /*
     Duplikáció eltávolítása.
  */

  const unique = new Map();

  for (const row of rows) {

    const previous =
      unique.get(row.ts);

    if (!previous) {
      unique.set(row.ts, row);
      continue;
    }

    unique.set(row.ts, {
      ts: row.ts,
      water:
        row.water ?? previous.water,
      flow:
        row.flow ?? previous.flow,
      temp:
        row.temp ?? previous.temp
    });
  }


  return [...unique.values()]
    .sort((a, b) => a.ts - b.ts);
}


/* ============================================================
   VÍZÜGY – MINDHÁROM FORRÁS ELLENŐRZÉSE
============================================================ */

async function fetchViz() {

  const candidates = [];

  const fetches = VIZ_URLS.map(
    async (url, sourceIndex) => {

      try {

        const response = await fetch(
          url + "&_=" + Date.now(),
          {
            headers: {
              "user-agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",
              "accept":
                "text/html,application/xhtml+xml",
              "cache-control":
                "no-cache",
              "pragma":
                "no-cache"
            },

            cf: {
              cacheTtl: 0,
              cacheEverything: false
            }
          }
        );


        if (!response.ok) {
          return;
        }


        const html =
          await response.text();


        const rows =
          parseVizRows(html);


        if (!rows.length) {
          return;
        }


        /*
           CSAK A FORRÁS LEGFRISSEBB SORA
        */

        const newest =
          rows[rows.length - 1];


        candidates.push({
          ...newest,
          sourceIndex,
          sourceUrl: url
        });

      } catch (_) {
      }
    }
  );


  await Promise.all(fetches);


  if (!candidates.length) {
    return {
      ok: false,
      official: false,
      water: null,
      flow: null,
      temp: null,
      ts: null,
      status: "KAPCSOLATI HIBA"
    };
  }


  /*
     A HÁROM VÍZÜGY FORRÁS KÖZÜL
     A LEGNAGYOBB TIMESTAMP NYER.
  */

  candidates.sort(
    (a, b) => b.ts - a.ts
  );


  const newest =
    candidates[0];


  return {
    ok: true,
    official: true,

    water:
      newest.water,

    flow:
      newest.flow,

    temp:
      newest.temp,

    ts:
      newest.ts,

    status:
      "OK",

    sourceIndex:
      newest.sourceIndex,

    sourceUrl:
      newest.sourceUrl
  };
}


/* ============================================================
   D1 ADATBÁZIS
============================================================ */

async function ensureDB(env) {

  if (!env.DB) return;


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


  await seedHistory(env);
}


/* ============================================================
   KEZDŐ TÖRTÉNETI ADATOK
============================================================ */

async function seedHistory(env) {

  if (!env.DB) return;


  const meta =
    await env.DB.prepare(
      "SELECT value FROM meta WHERE key = ?"
    )
    .bind("seed_v4")
    .first();


  if (meta) return;


  const points = [

    ["2026-08-18T00:00:00+02:00", null, -129, 754.1, 25.8],
    ["2026-08-18T12:00:00+02:00", 480, -128, 760, 26.0],

    ["2026-08-21T00:00:00+02:00", 480, -122, 780, 25.5],

    ["2026-08-23T00:00:00+02:00", 960, -110, 820, 25.0],
    ["2026-08-23T12:00:00+02:00", 1440, -105, 850, 24.8],

    ["2026-08-24T07:00:00+02:00", 1460, -100, 870, 24.6],
    ["2026-08-24T18:00:00+02:00", 1900, -95, 890, 24.5],

    ["2026-08-26T16:35:00+02:00", 1950, -85, 920, 24.0],

    ["2026-08-27T09:00:00+02:00", 1950, -81, 934, 23.8],

    ["2026-08-28T01:30:00+02:00", 1952, -88, 908, 24.2]
  ];


  for (const p of points) {

    const ts =
      new Date(p[0]).getTime();


    await env.DB.prepare(`
      INSERT OR IGNORE INTO measurements
      (ts,power,water,flow,temp)
      VALUES (?,?,?,?,?)
    `)
    .bind(
      ts,
      p[1],
      p[2],
      p[3],
      p[4]
    )
    .run();
  }


  await env.DB.prepare(`
    INSERT OR REPLACE INTO meta
    (key,value)
    VALUES (?,?)
  `)
  .bind(
    "seed_v4",
    "1"
  )
  .run();
}


/* ============================================================
   UTOLSÓ MENTETT VÍZÜGY ADAT
============================================================ */

async function getLastRiver(env) {

  if (!env.DB) return null;


  const row =
    await env.DB.prepare(`
      SELECT
        ts,
        water,
        flow,
        temp
      FROM measurements
      WHERE water IS NOT NULL
      ORDER BY ts DESC
      LIMIT 1
    `).first();


  return row || null;
}


/* ============================================================
   MÉRÉS MENTÉSE
============================================================ */

async function saveMeasurement(env, data) {

  if (!env.DB) return;


  /*
     5 perces teljesítmény bucket.
  */

  const bucket =
    Math.floor(Date.now() / 300000) *
    300000;


  const power =
    Number.isFinite(data.oah?.total)
      ? data.oah.total
      : null;


  /*
     VÍZÜGY adatot csak akkor mentünk,
     ha MOST közvetlenül hivatalos forrásból jött.

     Így a régi fallback adatot nem mentjük új időponttal.
  */

  if (data.river?.official === true) {

    const officialTs =
      data.river.ts;


    /*
       Hivatalos VÍZÜGY mérés saját időbélyeggel.
    */

    const existing =
      await env.DB.prepare(`
        SELECT power
        FROM measurements
        WHERE ts = ?
      `)
      .bind(officialTs)
      .first();


    await env.DB.prepare(`
      INSERT OR REPLACE INTO measurements
      (ts,power,water,flow,temp)
      VALUES (?,?,?,?,?)
    `)
    .bind(
      officialTs,
      existing?.power ?? null,
      data.river.water,
      data.river.flow,
      data.river.temp
    )
    .run();
  }


  /*
     Aktuális OAH teljesítmény mentése
     5 perces bucketbe.
  */

  if (power !== null) {

    const previous =
      await env.DB.prepare(`
        SELECT
          water,
          flow,
          temp
        FROM measurements
        WHERE ts = ?
      `)
      .bind(bucket)
      .first();


    await env.DB.prepare(`
      INSERT OR REPLACE INTO measurements
      (ts,power,water,flow,temp)
      VALUES (?,?,?,?,?)
    `)
    .bind(
      bucket,
      power,
      previous?.water ?? null,
      previous?.flow ?? null,
      previous?.temp ?? null
    )
    .run();
  }


  /*
     11 napnál régebbi adatok törlése.
  */

  await env.DB.prepare(`
    DELETE FROM measurements
    WHERE ts < ?
  `)
  .bind(
    Date.now() -
    11 * 24 * 60 * 60 * 1000
  )
  .run();
}


/* ============================================================
   ÖSSZES AKTUÁLIS ADAT
============================================================ */

async function loadAllData(env) {

  await ensureDB(env);


  const [
    oah,
    freshRiver
  ] =
    await Promise.all([
      fetchOah(),
      fetchViz()
    ]);


  let river =
    freshRiver;


  /*
     CSAK akkor használunk mentett adatot,
     ha egyik hivatalos VÍZÜGY lekérés sem adott adatot.
  */

  if (!freshRiver.ok) {

    const stored =
      await getLastRiver(env);


    if (stored) {

      river = {
        ok: false,
        official: false,

        water:
          num(stored.water),

        flow:
          num(stored.flow),

        temp:
          num(stored.temp),

        ts:
          Number(stored.ts),

        status:
          "UTOLSÓ MENTETT ADAT"
      };

    } else {

      river = {
        ok: false,
        official: false,
        water: null,
        flow: null,
        temp: null,
        ts: null,
        status: "NINCS ADAT"
      };
    }
  }


  const data = {
    oah,
    river
  };


  await saveMeasurement(
    env,
    data
  );


  return data;
}


/* ============================================================
   VÍZÁLLÁS ÁLLAPOT
============================================================ */

function waterStatus(water) {

  if (!Number.isFinite(water)) {
    return {
      text: "NINCS ADAT",
      cls: "unknown"
    };
  }


  if (water <= -144) {
    return {
      text: "KRITIKUS TARTOMÁNY",
      cls: "critical"
    };
  }


  if (water <= -134) {
    return {
      text: "LEÁLLÁSI TARTOMÁNY",
      cls: "danger"
    };
  }


  if (water <= -129) {
    return {
      text: "FIGYELMEZTETÉS",
      cls: "warning"
    };
  }


  return {
    text: "NORMÁL TARTOMÁNY",
    cls: "normal"
  };
}


/* ============================================================
   HTML
============================================================ */

function renderPage(data) {

  const blocks =
    data.oah.blocks || [
      null,
      null,
      null,
      null
    ];


  const total =
    Number.isFinite(data.oah.total)
      ? data.oah.total
      : "—";


  const water =
    Number.isFinite(data.river.water)
      ? data.river.water
      : null;


  const flow =
    Number.isFinite(data.river.flow)
      ? data.river.flow
      : null;


  const temp =
    Number.isFinite(data.river.temp)
      ? data.river.temp
      : null;


  const ws =
    waterStatus(water);


  const shutdownReserve =
    Number.isFinite(water)
      ? water - (-134)
      : null;


  const safetyReserve =
    Number.isFinite(water)
      ? water - (-144)
      : null;


  const official =
    data.river.official === true;


  const riverStatus =
    official
      ? "OK"
      : data.river.status;


  const riverStatusClass =
    official
      ? "ok"
      : "stale";


  return `<!doctype html>

<html lang="hu">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=yes"
>

<meta
  name="theme-color"
  content="#070d18"
>

<title>PAKS AKTUÁLIS ADATOK</title>

<style>

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  background:#070d18;
  color:#ffffff;
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
  letter-spacing:.3px;
}

.live{
  font-size:11px;
  font-weight:900;
  color:#42ff91;
}

.card{
  background:#101827;
  border:1px solid #202b3d;
  border-radius:16px;
  padding:12px;
  margin-bottom:10px;
  overflow:hidden;
}

.section-title{
  font-size:11px;
  color:#aeb9c8;
  font-weight:800;
  letter-spacing:.5px;
  margin-bottom:5px;
}

.big{
  font-size:38px;
  font-weight:900;
  line-height:1;
}

.green{
  color:#45ef8a;
}

.blue{
  color:#55b8ff;
}

.subtitle{
  margin-top:4px;
  color:#8f9bae;
  font-size:10px;
  font-weight:800;
}

.chart-title{
  font-size:10px;
  color:#8f9bae;
  margin-top:10px;
  margin-bottom:5px;
  font-weight:800;
}

.chart-wrap{
  width:100%;
  height:116px;
  overflow:hidden;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.range{
  display:flex;
  gap:6px;
  margin:5px 0 8px;
}

.range button{
  border:1px solid #2b3850;
  background:#172132;
  color:#9faabd;
  border-radius:7px;
  padding:5px 9px;
  font-size:9px;
  font-weight:900;
}

.range button.active{
  background:#2b425e;
  color:white;
}

.blocks{
  display:grid;
  grid-template-columns:
    repeat(4,1fr);
  gap:6px;
}

.block{
  background:#172132;
  border-radius:10px;
  padding:8px 3px;
  text-align:center;
}

.block-name{
  color:#8f9bae;
  font-size:9px;
  font-weight:800;
}

.block-value{
  font-size:18px;
  font-weight:900;
  margin-top:2px;
}

.source{
  margin-top:8px;
  font-size:9px;
  color:#8290a5;
  font-weight:700;
}

.source .ok{
  color:#43e885;
}

.source .stale{
  color:#ffad48;
}

.river-top{
  display:flex;
  justify-content:space-between;
  align-items:flex-start;
}

.status{
  font-size:9px;
  font-weight:900;
  margin-top:4px;
}

.status.normal{
  color:#45ef8a;
}

.status.warning{
  color:#ffcf48;
}

.status.danger{
  color:#ff853e;
}

.status.critical{
  color:#ff4f64;
}

.status.unknown{
  color:#929fb0;
}

.metrics{
  display:grid;
  grid-template-columns:
    1fr 1fr;
  gap:7px;
  margin-top:8px;
}

.metric{
  background:#172132;
  border-radius:10px;
  padding:8px;
}

.metric-label{
  color:#8f9bae;
  font-size:9px;
  font-weight:800;
}

.metric-value{
  font-size:17px;
  font-weight:900;
  margin-top:2px;
}

.gauge{
  margin-top:11px;
}

.gauge-line{
  height:9px;
  border-radius:99px;
  background:
    linear-gradient(
      to right,
      #ff4f64 0%,
      #ff853e 25%,
      #ffcf48 38%,
      #45ef8a 55%,
      #45ef8a 100%
    );
  position:relative;
}

.marker{
  position:absolute;
  top:-5px;
  width:3px;
  height:19px;
  background:white;
  border-radius:2px;
}

.gauge-labels{
  display:flex;
  justify-content:space-between;
  font-size:8px;
  color:#8390a4;
  margin-top:4px;
}

.reserves{
  display:grid;
  grid-template-columns:
    1fr 1fr;
  gap:7px;
  margin-top:7px;
}

.reserve{
  text-align:center;
  background:#172132;
  border-radius:10px;
  padding:7px;
}

.reserve-value{
  font-size:18px;
  font-weight:900;
}

.reserve-label{
  font-size:8px;
  color:#8f9bae;
  font-weight:800;
}

.fresh-warning{
  background:#372716;
  border:1px solid #7b5020;
  color:#ffc56c;
  border-radius:9px;
  padding:7px 8px;
  margin-top:7px;
  font-size:9px;
  font-weight:800;
}

.footer{
  text-align:center;
  color:#617087;
  font-size:9px;
  margin:12px 0;
}

.signature{
  font-weight:900;
  letter-spacing:2px;
  color:#8c99aa;
}

.share{
  margin-top:10px;
  display:flex;
  gap:6px;
}

.share input{
  min-width:0;
  flex:1;
  background:#070d18;
  border:1px solid #263247;
  border-radius:8px;
  color:#9ca8ba;
  padding:7px;
  font-size:9px;
}

.share button{
  border:0;
  border-radius:8px;
  background:#2c4667;
  color:white;
  font-size:9px;
  font-weight:900;
  padding:0 10px;
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
      <canvas id="powerChart"></canvas>
    </div>


    <div class="blocks">

      ${blocks.map((b, i) => `

        <div class="block">

          <div class="block-name">
            ${i + 1}. BLOKK
          </div>

          <div class="block-value">
            ${Number.isFinite(b) ? b : "—"} MW
          </div>

        </div>

      `).join("")}

    </div>


    <div class="source">

      OAH •

      ${formatTime(data.oah.ts)}

      •

      <span class="${data.oah.ok ? "ok" : "stale"}">
        ${data.oah.status}
      </span>

    </div>

  </div>


  <div class="card">

    <div class="section-title">
      🌊 DUNA VÍZÁLLÁSA PAKSNÁL
    </div>


    <div class="river-top">

      <div>

        <div class="big blue">
          ${water !== null ? water : "—"} cm
        </div>

        <div class="status ${ws.cls}">
          ${ws.text}
        </div>

      </div>

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
      <canvas id="waterChart"></canvas>
    </div>


    <div class="metrics">

      <div class="metric">

        <div class="metric-label">
          VÍZHOZAM
        </div>

        <div class="metric-value">
          ${
            flow !== null
              ? flow.toFixed(1).replace(".", ",")
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
              ? temp.toFixed(1).replace(".", ",")
              : "—"
          } °C
        </div>

      </div>

    </div>


    <div class="gauge">

      <div class="gauge-line">

        ${
          water !== null
            ? `<div
                 class="marker"
                 style="left:${Math.max(
                   0,
                   Math.min(
                     100,
                     ((water + 150) / 40) * 100
                   )
                 )}%">
               </div>`
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
              ? shutdownReserve + " cm"
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
              ? safetyReserve + " cm"
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

      ${formatTime(data.river.ts)}

      •

      <span class="${riverStatusClass}">
        ${riverStatus}
      </span>

    </div>


    ${
      !official
        ? `
          <div class="fresh-warning">
            ⚠️ A VÍZÜGY ÉLŐ LEKÉRÉSE NEM ELÉRHETŐ.
            EZ UTOLSÓ MENTETT ADAT, NEM FRISS HIVATALOS MÉRÉS.
          </div>
        `
        : ""
    }

  </div>


  <div class="footer">

    <div class="signature">
      IGLÓDI
    </div>

    <div class="share">

      <input
        id="shareUrl"
        value="${PUBLIC_URL}"
        readonly
      >

      <button onclick="copyUrl()">
        MÁSOLÁS
      </button>

    </div>

  </div>

</div>


<script>

let selectedRange = {
  power: 240,
  water: 240
};


async function loadHistory(type) {

  const hours =
    selectedRange[type];

  try {

    const response =
      await fetch(
        "/api/history?hours=" +
        hours +
        "&_=" +
        Date.now(),
        {
          cache: "no-store"
        }
      );


    const data =
      await response.json();


    if (type === "power") {

      const points =
        data.rows
          .filter(
            x =>
              Number.isFinite(
                Number(x.power)
              )
          )
          .map(x => ({
            x: Number(x.ts),
            y: Number(x.power)
          }));


      drawChart(
        "powerChart",
        points,
        "MW"
      );

    } else {

      const points =
        data.rows
          .filter(
            x =>
              Number.isFinite(
                Number(x.water)
              )
          )
          .map(x => ({
            x: Number(x.ts),
            y: Number(x.water)
          }));


      drawChart(
        "waterChart",
        points,
        "cm"
      );
    }

  } catch (e) {

    console.error(e);

  }
}


/* ============================================================
   GRAFIKON
   DINAMIKUS Y TENGELY SZÉLESSÉGGEL
============================================================ */

function drawChart(
  canvasId,
  points,
  unit
) {

  const canvas =
    document.getElementById(
      canvasId
    );


  if (!canvas) return;


  const parent =
    canvas.parentElement;


  const rect =
    parent.getBoundingClientRect();


  const width =
    Math.max(
      100,
      Math.floor(rect.width)
    );


  const height =
    Math.max(
      80,
      Math.floor(rect.height)
    );


  const dpr =
    Math.min(
      window.devicePixelRatio || 1,
      3
    );


  canvas.width =
    Math.floor(width * dpr);

  canvas.height =
    Math.floor(height * dpr);


  canvas.style.width =
    width + "px";

  canvas.style.height =
    height + "px";


  const ctx =
    canvas.getContext("2d");


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


  if (!points.length) {

    ctx.fillStyle =
      "#8491a5";

    ctx.font =
      "10px -apple-system";

    ctx.textAlign =
      "center";

    ctx.fillText(
      "NINCS TÖRTÉNETI ADAT",
      width / 2,
      height / 2
    );

    return;
  }


  const values =
    points.map(
      p => p.y
    );


  let minY =
    Math.min(...values);

  let maxY =
    Math.max(...values);


  let span =
    maxY - minY;


  if (span === 0) {
    span =
      Math.max(
        Math.abs(maxY) * 0.04,
        unit === "MW" ? 20 : 5
      );
  }


  const extra =
    span * 0.15;


  minY -= extra;
  maxY += extra;


  if (unit === "MW") {

    minY =
      Math.floor(minY / 10) * 10;

    maxY =
      Math.ceil(maxY / 10) * 10;

  } else {

    minY =
      Math.floor(minY);

    maxY =
      Math.ceil(maxY);

  }


  if (maxY === minY) {
    maxY += 1;
  }


  const yLabels = [];

  for (let i = 0; i <= 2; i++) {

    const value =
      maxY -
      (maxY - minY) *
      i / 2;


    yLabels.push(
      Math.round(value) +
      " " +
      unit
    );
  }


  ctx.font =
    "8px -apple-system";


  let widestLabel = 0;


  yLabels.forEach(label => {

    widestLabel =
      Math.max(
        widestLabel,
        ctx.measureText(label).width
      );

  });


  const pad = {

    left:
      Math.ceil(
        widestLabel
      ) + 12,

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
    "#263247";

  ctx.lineWidth =
    1;


  ctx.fillStyle =
    "#7f8ca0";

  ctx.font =
    "8px -apple-system";


  /*
     Y tengely
  */

  for (let i = 0; i <= 2; i++) {

    const y =
      pad.top +
      chartH *
      i / 2;


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
    points[0].x;


  const maxX =
    points[
      points.length - 1
    ].x;


  const xRange =
    Math.max(
      1,
      maxX - minX
    );


  function xPos(x) {

    return (
      pad.left +
      ((x - minX) /
        xRange) *
      chartW
    );

  }


  function yPos(y) {

    return (
      pad.top +
      ((maxY - y) /
        (maxY - minY)) *
      chartH
    );

  }


  /*
     Vonal
  */

  ctx.beginPath();

  ctx.strokeStyle =
    unit === "MW"
      ? "#45ef8a"
      : "#55b8ff";

  ctx.lineWidth =
    2;


  points.forEach(
    (p, index) => {

      const x =
        xPos(p.x);

      const y =
        yPos(p.y);


      if (index === 0) {

        ctx.moveTo(x, y);

      } else {

        ctx.lineTo(x, y);

      }

    }
  );


  ctx.stroke();


  /*
     Utolsó pont
  */

  const last =
    points[
      points.length - 1
    ];


  ctx.beginPath();

  ctx.arc(
    xPos(last.x),
    yPos(last.y),
    3,
    0,
    Math.PI * 2
  );


  ctx.fillStyle =
    unit === "MW"
      ? "#45ef8a"
      : "#55b8ff";


  ctx.fill();


  /*
     X tengely időpontok
  */

  ctx.fillStyle =
    "#7f8ca0";

  ctx.font =
    "8px -apple-system";

  ctx.textBaseline =
    "alphabetic";


  const xTicks = [
    minX,
    minX + xRange / 2,
    maxX
  ];


  xTicks.forEach(
    (t, i) => {

      const d =
        new Date(t);


      const label =
        d.toLocaleString(
          "hu-HU",
          {
            timeZone:
              "Europe/Budapest",

            month:
              selectedRange[
                unit === "MW"
                  ? "power"
                  : "water"
              ] === 240
                ? "2-digit"
                : undefined,

            day:
              selectedRange[
                unit === "MW"
                  ? "power"
                  : "water"
              ] === 240
                ? "2-digit"
                : undefined,

            hour:
              "2-digit",

            minute:
              "2-digit",

            hour12:
              false
          }
        );


      if (i === 0) {
        ctx.textAlign = "left";
      }

      if (i === 1) {
        ctx.textAlign = "center";
      }

      if (i === 2) {
        ctx.textAlign = "right";
      }


      ctx.fillText(
        label,
        xPos(t),
        height - 4
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
  .forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const type =
          button.dataset.type;

        const hours =
          Number(
            button.dataset.hours
          );


        selectedRange[type] =
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


        button.classList.add(
          "active"
        );


        loadHistory(type);

      }
    );

  });


function copyUrl() {

  const input =
    document.getElementById(
      "shareUrl"
    );


  navigator.clipboard
    .writeText(
      input.value
    )
    .catch(() => {

      input.select();

      document.execCommand(
        "copy"
      );

    });

}


/*
   indulás
*/

loadHistory("power");
loadHistory("water");


window.addEventListener(
  "resize",
  () => {

    loadHistory("power");
    loadHistory("water");

  }
);

</script>

</body>

</html>`;
}


/* ============================================================
   WORKER
============================================================ */

export default {

  async fetch(request, env, ctx) {

    const url =
      new URL(request.url);


    /*
       Aktuális diagnosztika.

       /api

       Itt egyből látható,
       hogy a VÍZÜGY adat hivatalos-e.
    */

    if (url.pathname === "/api") {

      const data =
        await loadAllData(env);


      return new Response(
        JSON.stringify(
          {
            ...data,

            riverInfo: {

              official:
                data.river.official === true,

              measurementTime:
                data.river.ts
                  ? formatDateTime(
                      data.river.ts
                    )
                  : null,

              alert:
                data.river.official === true &&
                Number.isFinite(
                  data.river.water
                ) &&
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
              "no-cache"
          }
        }
      );
    }


    /*
       Történeti adatok
    */

    if (
      url.pathname ===
      "/api/history"
    ) {

      await ensureDB(env);


      let hours =
        Number(
          url.searchParams.get(
            "hours"
          ) || 240
        );


      if (
        ![
          6,
          24,
          240
        ].includes(hours)
      ) {
        hours = 240;
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
        .bind(cutoff)
        .all();


      return new Response(
        JSON.stringify({
          hours,
          rows:
            result.results || []
        }),
        {
          headers: {
            "content-type":
              "application/json; charset=UTF-8",

            "cache-control":
              "no-store, no-cache, must-revalidate",

            "pragma":
              "no-cache"
          }
        }
      );
    }


    /*
       Facebook kép
    */

    if (
      url.pathname ===
      "/facebook-image"
    ) {

      const image =
        await fetch(
          FB_IMAGE_RAW,
          {
            cf: {
              cacheTtl: 300
            }
          }
        );


      if (!image.ok) {
        return new Response(
          "Image unavailable",
          {
            status: 502
          }
        );
      }


      const headers =
        new Headers(
          image.headers
        );


      headers.set(
        "cache-control",
        "public, max-age=300"
      );


      return new Response(
        image.body,
        {
          status: image.status,
          headers
        }
      );
    }


    /*
       Főoldal
    */

    const data =
      await loadAllData(env);


    return new Response(
      renderPage(data),
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


  /*
     Ha van Cloudflare Cron Trigger,
     háttérben is mentjük az adatokat.
  */

  async scheduled(
    event,
    env,
    ctx
  ) {

    ctx.waitUntil(
      loadAllData(env)
    );
  }
};
