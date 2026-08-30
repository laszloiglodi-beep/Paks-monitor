/* ============================================================
   PAKS MONITOR
   GRAFIKON HIBAPONT / TÖRÉS JAVÍTÁS
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
    .replace(/&#8722;/gi, "-")
    .replace(/&minus;/gi, "-")
    .replace(/&amp;/gi, "&")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function num(value) {
  if (value === null || value === undefined) return null;

  const n = Number(
    String(value)
      .trim()
      .replace(/\s/g, "")
      .replace(",", ".")
      .replace(/−/g, "-")
  );

  return Number.isFinite(n) ? n : null;
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


/* ============================================================
   BUDAPEST IDŐ PARSER
============================================================ */

function budapestParts(ts) {
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

function localBudapestTimestamp(year, month, day, hour, minute) {
  let guess =
    Date.UTC(year, month - 1, day, hour - 1, minute);

  for (let i = 0; i < 4; i++) {
    const p = budapestParts(guess);

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

    guess += wanted - represented;
  }

  return guess;
}

function parseHungarianDateTime(value) {
  if (!value) return null;

  const s =
    String(value)
      .replace(/\s+/g, " ")
      .trim();

  let m =
    s.match(
      /(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})/
    );

  if (m) {
    return localBudapestTimestamp(
      Number(m[1]),
      Number(m[2]),
      Number(m[3]),
      Number(m[4]),
      Number(m[5])
    );
  }

  m =
    s.match(
      /(\d{1,2})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{4})\.?\s+(\d{1,2}):(\d{2})/
    );

  if (m) {
    return localBudapestTimestamp(
      Number(m[3]),
      Number(m[2]),
      Number(m[1]),
      Number(m[4]),
      Number(m[5])
    );
  }

  return null;
}


/* ============================================================
   OAH
============================================================ */

async function fetchOah() {
  try {
    const response =
      await fetch(
        OAH_URL + "&_=" + Date.now(),
        {
          headers: {
            "user-agent":
              "Mozilla/5.0",
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
      throw new Error("OAH HTTP " + response.status);
    }

    const html =
      await response.text();

    const text =
      cleanHTML(html);

    const blockMatch =
      text.match(
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
      blocks.reduce(
        (sum, value) => sum + value,
        0
      );

    let ts = Date.now();

    const dateMatch =
      text.match(
        /Mérés\s*dátuma[:\s]*([0-9]{4}[.\-/][0-9]{1,2}[.\-/][0-9]{1,2}\.?\s+[0-9]{1,2}:[0-9]{2})/i
      );

    if (dateMatch) {
      ts =
        parseHungarianDateTime(dateMatch[1]) ||
        Date.now();
    }

    return {
      ok: true,
      blocks,
      total,
      ts,
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
   VÍZÜGY
============================================================ */

function extractNumbersAfterDate(text) {
  if (!text) return null;

  const dm =
    text.match(
      /(?:\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2}\.?|\d{1,2}[.\-/]\d{1,2}[.\-/]\d{4}\.?)\s+\d{1,2}:\d{2}/
    );

  if (!dm) return null;

  const ts =
    parseHungarianDateTime(dm[0]);

  if (!ts) return null;

  const rest =
    text
      .slice(
        (dm.index || 0) +
        dm[0].length
      )
      .replace(/−/g, "-")
      .replace(/\s+/g, " ")
      .trim();

  const values =
    [...rest.matchAll(
      /[-+]?\d+(?:[,.]\d+)?/g
    )]
      .map(m => num(m[0]))
      .filter(Number.isFinite);

  for (let i = 0; i < values.length; i++) {
    const water = values[i];

    if (water < -500 || water > 1500) {
      continue;
    }

    for (
      let j = i + 1;
      j < Math.min(values.length, i + 5);
      j++
    ) {
      const flow = values[j];

      if (flow < 50 || flow > 10000) {
        continue;
      }

      for (
        let k = j + 1;
        k < Math.min(values.length, j + 5);
        k++
      ) {
        const temp = values[k];

        if (temp < -2 || temp > 40) {
          continue;
        }

        return {
          ts,
          water: Math.round(water),
          flow,
          temp
        };
      }
    }
  }

  return null;
}

function parseVizRows(html) {
  const rows = [];

  const clean =
    cleanHTML(html);

  const lines =
    clean
      .split(/\n+/)
      .map(x => x.trim())
      .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const joined =
      [
        lines[i],
        lines[i + 1] || "",
        lines[i + 2] || "",
        lines[i + 3] || ""
      ].join(" ");

    const row =
      extractNumbersAfterDate(joined);

    if (row) {
      rows.push(row);
    }
  }

  const unique =
    new Map();

  rows.forEach(row => {
    unique.set(row.ts, row);
  });

  return [...unique.values()]
    .sort((a, b) => a.ts - b.ts);
}

async function fetchViz() {
  const candidates = [];

  await Promise.all(
    VIZ_URLS.map(
      async (baseUrl, sourceIndex) => {
        try {
          const response =
            await fetch(
              baseUrl + "&_=" + Date.now(),
              {
                headers: {
                  "user-agent": "Mozilla/5.0",
                  "cache-control": "no-cache",
                  "pragma": "no-cache"
                },
                cf: {
                  cacheTtl: 0,
                  cacheEverything: false
                }
              }
            );

          if (!response.ok) return;

          const html =
            await response.text();

          const rows =
            parseVizRows(html);

          if (!rows.length) return;

          candidates.push({
            ...rows[rows.length - 1],
            sourceIndex
          });

        } catch (_) {}
      }
    )
  );

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

  candidates.sort(
    (a, b) => b.ts - a.ts
  );

  const latest =
    candidates[0];

  return {
    ok: true,
    official: true,
    water: latest.water,
    flow: latest.flow,
    temp: latest.temp,
    ts: latest.ts,
    status: "OK"
  };
}


/* ============================================================
   D1
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

  await cleanBadHistory(env);
}


/* ============================================================
   RÉGI HIBÁS PONTOK TAKARÍTÁSA
============================================================ */

async function cleanBadHistory(env) {
  const done =
    await env.DB.prepare(`
      SELECT value
      FROM meta
      WHERE key = ?
    `)
      .bind("history_cleanup_v3")
      .first();

  if (done) return;

  /*
     Régi, hibás / seed teljesítménypontok:
     olyan sorok, amelyek Paks összteljesítményként
     nyilvánvalóan nem élő, valós adatként kerültek be.
  */

  await env.DB.prepare(`
    DELETE FROM measurements
    WHERE
      power IS NOT NULL
      AND power > 0
      AND power < 1500
      AND ts < ?
  `)
    .bind(
      new Date(
        "2026-08-26T00:00:00+02:00"
      ).getTime()
    )
    .run();

  /*
     Régi seedelt / irreális vízállásminták törlése.
  */

  const badTimes = [
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

  for (const iso of badTimes) {
    await env.DB.prepare(`
      DELETE FROM measurements
      WHERE ts = ?
    `)
      .bind(new Date(iso).getTime())
      .run();
  }

  await env.DB.prepare(`
    INSERT OR REPLACE INTO meta
    (key,value)
    VALUES (?,?)
  `)
    .bind(
      "history_cleanup_v3",
      "1"
    )
    .run();
}


/* ============================================================
   UTOLSÓ MENTETT VÍZ
============================================================ */

async function getLastRiver(env) {
  if (!env.DB) return null;

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
  `).first();
}


/* ============================================================
   MENTÉS
============================================================ */

async function saveMeasurement(env, data) {
  if (!env.DB) return;

  const powerBucket =
    Math.floor(Date.now() / 300000) *
    300000;

  if (
    data.oah?.ok &&
    Number.isFinite(data.oah.total)
  ) {
    const existing =
      await env.DB.prepare(`
        SELECT water,flow,temp
        FROM measurements
        WHERE ts = ?
      `)
        .bind(powerBucket)
        .first();

    await env.DB.prepare(`
      INSERT OR REPLACE INTO measurements
      (ts,power,water,flow,temp)
      VALUES (?,?,?,?,?)
    `)
      .bind(
        powerBucket,
        data.oah.total,
        existing?.water ?? null,
        existing?.flow ?? null,
        existing?.temp ?? null
      )
      .run();
  }

  if (
    data.river?.official &&
    Number.isFinite(data.river.ts) &&
    Number.isFinite(data.river.water)
  ) {
    const existing =
      await env.DB.prepare(`
        SELECT power
        FROM measurements
        WHERE ts = ?
      `)
        .bind(data.river.ts)
        .first();

    await env.DB.prepare(`
      INSERT OR REPLACE INTO measurements
      (ts,power,water,flow,temp)
      VALUES (?,?,?,?,?)
    `)
      .bind(
        data.river.ts,
        existing?.power ?? null,
        data.river.water,
        data.river.flow,
        data.river.temp
      )
      .run();
  }

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
   AKTUÁLIS ADAT
============================================================ */

async function loadAllData(env) {
  await ensureDB(env);

  const [oah, freshRiver] =
    await Promise.all([
      fetchOah(),
      fetchViz()
    ]);

  let river =
    freshRiver;

  if (!freshRiver.ok) {
    const stored =
      await getLastRiver(env);

    if (stored) {
      river = {
        ok: false,
        official: false,
        water: num(stored.water),
        flow: num(stored.flow),
        temp: num(stored.temp),
        ts: Number(stored.ts),
        status:
          "UTOLSÓ MENTETT ADAT"
      };
    }
  }

  const data = {
    oah,
    river
  };

  await saveMeasurement(env, data);

  return data;
}


/* ============================================================
   ÁLLAPOT
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
    Number.isFinite(data.river?.water)
      ? data.river.water
      : null;

  const flow =
    Number.isFinite(data.river?.flow)
      ? data.river.flow
      : null;

  const temp =
    Number.isFinite(data.river?.temp)
      ? data.river.temp
      : null;

  const ws =
    waterStatus(water);

  return `<!doctype html>
<html lang="hu">

<head>

<meta charset="UTF-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,user-scalable=yes"
>

<title>PAKS AKTUÁLIS ADATOK</title>

<style>

*{
  box-sizing:border-box
}

body{
  margin:0;
  background:#070d18;
  color:#fff;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}

.wrap{
  max-width:700px;
  margin:auto;
  padding:12px
}

.card{
  background:#101827;
  border:1px solid #263247;
  border-radius:16px;
  padding:12px;
  margin-bottom:10px
}

.title{
  font-size:20px;
  font-weight:900;
  margin-bottom:12px
}

.section-title{
  color:#a8b2c3;
  font-size:11px;
  font-weight:900
}

.big{
  font-size:39px;
  font-weight:900;
  margin-top:6px
}

.green{
  color:#65d884
}

.blue{
  color:#6db8ff
}

.subtitle{
  color:#a7b0bf;
  font-size:11px;
  font-weight:900
}

.chart-title{
  color:#a4adbd;
  margin-top:14px;
  font-size:10px;
  font-weight:900
}

.range{
  display:flex;
  gap:7px;
  margin:7px 0
}

.range button{
  background:#111a29;
  color:#9eaabd;
  border:1px solid #33425b;
  padding:6px 10px;
  border-radius:8px;
  font-size:9px;
  font-weight:900
}

.range button.active{
  background:#30445f;
  color:white
}

.chart-wrap{
  height:120px
}

canvas{
  width:100%;
  height:100%
}

.blocks{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:6px
}

.block{
  background:#192335;
  padding:8px 2px;
  border-radius:11px;
  text-align:center
}

.block-name{
  font-size:9px;
  color:#98a4b7;
  font-weight:900
}

.block-value{
  font-size:18px;
  font-weight:900;
  margin-top:4px
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:7px;
  margin-top:10px
}

.metric{
  background:#192335;
  border-radius:11px;
  padding:9px
}

.metric-label{
  color:#98a4b7;
  font-size:9px;
  font-weight:900
}

.metric-value{
  font-size:17px;
  font-weight:900
}

.status{
  font-size:9px;
  font-weight:900;
  margin:4px 0 8px
}

.normal{
  color:#53e88c
}

.warning{
  color:#ffd151
}

.danger{
  color:#ff913f
}

.critical{
  color:#ff5365
}

.source{
  margin-top:8px;
  font-size:9px;
  color:#8895a8;
  font-weight:900
}

.ok{
  color:#51e88b
}

.stale{
  color:#ffad48
}

</style>

</head>

<body>

<div class="wrap">

<div class="title">
⚛️ PAKS AKTUÁLIS ADATOK
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

<button data-type="power" data-hours="6">
6 ÓRA
</button>

<button data-type="power" data-hours="24">
24 ÓRA
</button>

<button class="active" data-type="power" data-hours="240">
10 NAP
</button>

</div>

<div class="chart-wrap">
<canvas id="powerChart"></canvas>
</div>

<div class="blocks">

${blocks.map((b,i)=>`

<div class="block">

<div class="block-name">
${i+1}. BLOKK
</div>

<div class="block-value">
${Number.isFinite(b)?b:"—"} MW
</div>

</div>

`).join("")}

</div>

<div class="source">
OAH • ${formatTime(data.oah.ts)} •
<span class="${data.oah.ok?"ok":"stale"}">
${data.oah.status}
</span>
</div>

</div>


<div class="card">

<div class="section-title">
🌊 DUNA VÍZÁLLÁSA PAKSNÁL
</div>

<div class="big blue">
${water!==null?water:"—"} cm
</div>

<div class="status ${ws.cls}">
${ws.text}
</div>

<div class="chart-title">
VÍZÁLLÁS VÁLTOZÁSA • CM
</div>

<div class="range">

<button data-type="water" data-hours="6">
6 ÓRA
</button>

<button data-type="water" data-hours="24">
24 ÓRA
</button>

<button class="active" data-type="water" data-hours="240">
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
${flow!==null?flow.toFixed(1).replace(".",","):"—"} m³/s
</div>

</div>

<div class="metric">

<div class="metric-label">
VÍZHŐMÉRSÉKLET
</div>

<div class="metric-value">
${temp!==null?temp.toFixed(1).replace(".",","):"—"} °C
</div>

</div>

</div>

<div class="source">
VÍZÜGY • ${formatTime(data.river?.ts)} •
<span class="${data.river?.official?"ok":"stale"}">
${data.river?.official?"OK":data.river?.status || "NINCS ADAT"}
</span>
</div>

</div>

</div>


<script>

let selectedRange = {
  power:240,
  water:240
};


async function loadHistory(type){

  const hours =
    selectedRange[type];

  const response =
    await fetch(
      "/api/history?hours="+
      hours+
      "&_="+
      Date.now(),
      {
        cache:"no-store"
      }
    );

  const data =
    await response.json();

  let points;

  if(type==="power"){

    points =
      data.rows
        .filter(r =>
          r.power!==null &&
          Number.isFinite(Number(r.power))
        )
        .map(r=>({
          x:Number(r.ts),
          y:Number(r.power)
        }));

    points =
      filterPowerPoints(points,hours);

    drawChart(
      "powerChart",
      points,
      "MW",
      hours
    );

  }else{

    points =
      data.rows
        .filter(r =>
          r.water!==null &&
          Number.isFinite(Number(r.water))
        )
        .map(r=>({
          x:Number(r.ts),
          y:Number(r.water)
        }));

    points =
      filterWaterPoints(points,hours);

    drawChart(
      "waterChart",
      points,
      "cm",
      hours
    );
  }
}


/* ============================================================
   TELJESÍTMÉNY HIBAPONT SZŰRÉS
============================================================ */

function filterPowerPoints(raw,hours){

  const points =
    raw
      .filter(p=>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.y>=0 &&
        p.y<=2200
      )
      .sort((a,b)=>a.x-b.x);


  if(hours>=240){

    /*
       A régi grafikonban látható
       0 / 480 / 960 / 1200 körüli hibás
       history pontokat kivesszük.

       1500 MW felett minden valódi
       összteljesítmény továbbra is látszik.

       Az aktuális valódi blokk-leállást
       NEM töröljük, mert az új adatokon
       nem alkalmazunk vak szűrést.
    */

    const recentCutoff =
      Date.now() -
      72*60*60*1000;

    return points.filter(p=>{

      if(p.x>=recentCutoff){
        return true;
      }

      return p.y>=1500;

    });
  }

  return points;
}


/* ============================================================
   VÍZÁLLÁS HIBAPONT SZŰRÉS
============================================================ */

function filterWaterPoints(raw,hours){

  const points =
    raw
      .filter(p=>
        Number.isFinite(p.x) &&
        Number.isFinite(p.y) &&
        p.y>=-300 &&
        p.y<=300
      )
      .sort((a,b)=>a.x-b.x);


  if(points.length<3){
    return points;
  }


  const result=[
    points[0]
  ];


  for(let i=1;i<points.length-1;i++){

    const prev =
      result[result.length-1];

    const cur =
      points[i];

    const next =
      points[i+1];


    const jump1 =
      Math.abs(
        cur.y-prev.y
      );

    const jump2 =
      Math.abs(
        cur.y-next.y
      );


    const dt1 =
      cur.x-prev.x;

    const dt2 =
      next.x-cur.x;


    /*
       Egyetlen pont 30+ cm-t ugrik,
       majd azonnal visszaugrik:
       ez tipikus hibás adat.
    */

    const isolatedSpike =
      jump1>=30 &&
      jump2>=30 &&
      dt1<=3*60*60*1000 &&
      dt2<=3*60*60*1000 &&
      Math.abs(prev.y-next.y)<=10;


    if(!isolatedSpike){
      result.push(cur);
    }
  }


  result.push(
    points[points.length-1]
  );


  return result;
}


/* ============================================================
   GRAFIKON
============================================================ */

function drawChart(
  canvasId,
  points,
  unit,
  hours
){

  const canvas =
    document.getElementById(canvasId);

  if(!canvas) return;


  const parent =
    canvas.parentElement;

  const rect =
    parent.getBoundingClientRect();

  const width =
    Math.floor(rect.width);

  const height =
    Math.floor(rect.height);

  const dpr =
    Math.min(
      window.devicePixelRatio||1,
      3
    );


  canvas.width =
    width*dpr;

  canvas.height =
    height*dpr;

  canvas.style.width =
    width+"px";

  canvas.style.height =
    height+"px";


  const ctx =
    canvas.getContext("2d");


  ctx.setTransform(
    dpr,0,0,dpr,0,0
  );


  ctx.clearRect(
    0,0,width,height
  );


  if(!points.length){

    ctx.fillStyle=
      "#8491a5";

    ctx.font=
      "10px -apple-system";

    ctx.textAlign=
      "center";

    ctx.fillText(
      "NINCS TÖRTÉNETI ADAT",
      width/2,
      height/2
    );

    return;
  }


  const values =
    points.map(p=>p.y);


  let minY =
    Math.min(...values);

  let maxY =
    Math.max(...values);


  let span =
    maxY-minY;


  if(span===0){

    span =
      unit==="MW"
        ? 20
        : 2;

    minY-=span/2;
    maxY+=span/2;

  }else{

    const extra =
      span*0.15;

    minY-=extra;
    maxY+=extra;
  }


  if(unit==="MW"){

    minY=
      Math.floor(minY/10)*10;

    maxY=
      Math.ceil(maxY/10)*10;

  }else{

    minY=
      Math.floor(minY);

    maxY=
      Math.ceil(maxY);
  }


  const labels=[];

  for(let i=0;i<=2;i++){

    const v =
      maxY-
      (maxY-minY)*
      i/2;

    labels.push(
      Math.round(v)+" "+unit
    );
  }


  ctx.font=
    "8px -apple-system";


  let widest=0;

  labels.forEach(label=>{
    widest=
      Math.max(
        widest,
        ctx.measureText(label).width
      );
  });


  const pad={
    left:
      Math.ceil(widest)+12,
    right:8,
    top:8,
    bottom:20
  };


  const chartW =
    width-
    pad.left-
    pad.right;

  const chartH =
    height-
    pad.top-
    pad.bottom;


  ctx.strokeStyle=
    "#29364a";

  ctx.fillStyle=
    "#8491a4";

  ctx.font=
    "8px -apple-system";


  for(let i=0;i<=2;i++){

    const y =
      pad.top+
      chartH*i/2;

    ctx.beginPath();

    ctx.moveTo(
      pad.left,
      y
    );

    ctx.lineTo(
      width-pad.right,
      y
    );

    ctx.stroke();

    ctx.textAlign=
      "left";

    ctx.textBaseline=
      "middle";

    ctx.fillText(
      labels[i],
      2,
      y
    );
  }


  const minX =
    points[0].x;

  const maxX =
    points[
      points.length-1
    ].x;

  const xRange =
    Math.max(
      1,
      maxX-minX
    );


  const xPos =
    x =>
      pad.left+
      ((x-minX)/xRange)*
      chartW;


  const yPos =
    y =>
      pad.top+
      ((maxY-y)/
      (maxY-minY))*
      chartH;


  let maxGap;

  if(hours<=6){

    maxGap=
      45*60*1000;

  }else if(hours<=24){

    maxGap=
      90*60*1000;

  }else{

    maxGap=
      4*60*60*1000;
  }


  ctx.strokeStyle=
    unit==="MW"
      ? "#72e58c"
      : "#6db8ff";

  ctx.lineWidth=2;

  ctx.lineJoin=
    "round";

  ctx.lineCap=
    "round";


  ctx.beginPath();


  let previous=null;


  points.forEach(p=>{

    const x=
      xPos(p.x);

    const y=
      yPos(p.y);


    if(
      !previous ||
      p.x-previous.x>
      maxGap
    ){

      ctx.moveTo(x,y);

    }else{

      ctx.lineTo(x,y);
    }


    previous=p;
  });


  ctx.stroke();


  const last =
    points[
      points.length-1
    ];


  ctx.beginPath();

  ctx.arc(
    xPos(last.x),
    yPos(last.y),
    3,
    0,
    Math.PI*2
  );

  ctx.fillStyle=
    unit==="MW"
      ? "#72e58c"
      : "#6db8ff";

  ctx.fill();


  const ticks=[
    minX,
    minX+xRange/2,
    maxX
  ];


  ctx.fillStyle=
    "#8390a3";

  ctx.font=
    "8px -apple-system";


  ticks.forEach(
    (ts,index)=>{

      const d=
        new Date(ts);

      const label=
        hours>=240
          ? d.toLocaleString(
              "hu-HU",
              {
                timeZone:
                  "Europe/Budapest",
                month:"2-digit",
                day:"2-digit",
                hour:"2-digit",
                minute:"2-digit",
                hour12:false
              }
            )
          : d.toLocaleTimeString(
              "hu-HU",
              {
                timeZone:
                  "Europe/Budapest",
                hour:"2-digit",
                minute:"2-digit",
                hour12:false
              }
            );


      ctx.textAlign=
        index===0
          ? "left"
          : index===1
            ? "center"
            : "right";


      ctx.fillText(
        label,
        xPos(ts),
        height-4
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
.forEach(button=>{

  button.addEventListener(
    "click",
    ()=>{

      const type=
        button.dataset.type;

      const hours=
        Number(
          button.dataset.hours
        );


      selectedRange[type]=
        hours;


      document
      .querySelectorAll(
        '.range button[data-type="'+
        type+
        '"]'
      )
      .forEach(
        b=>
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


loadHistory("power");
loadHistory("water");

</script>

</body>
</html>`;
}


/* ============================================================
   WORKER
============================================================ */

export default {

  async fetch(request,env,ctx){

    const url=
      new URL(request.url);


    if(
      url.pathname===
      "/api"
    ){

      const data=
        await loadAllData(env);

      return new Response(
        JSON.stringify(
          data,
          null,
          2
        ),
        {
          headers:{
            "content-type":
              "application/json; charset=UTF-8",
            "cache-control":
              "no-store"
          }
        }
      );
    }


    if(
      url.pathname===
      "/api/history"
    ){

      await ensureDB(env);


      let hours=
        Number(
          url.searchParams.get(
            "hours"
          )||240
        );


      if(
        ![6,24,240]
        .includes(hours)
      ){
        hours=240;
      }


      const cutoff=
        Date.now()-
        hours*
        60*
        60*
        1000;


      const result=
        await env.DB.prepare(`
          SELECT
            ts,
            power,
            water,
            flow,
            temp
          FROM measurements
          WHERE ts>=?
          ORDER BY ts ASC
        `)
        .bind(cutoff)
        .all();


      return new Response(
        JSON.stringify({
          hours,
          rows:
            result.results||[]
        }),
        {
          headers:{
            "content-type":
              "application/json; charset=UTF-8",
            "cache-control":
              "no-store"
          }
        }
      );
    }


    const data=
      await loadAllData(env);


    return new Response(
      renderPage(data),
      {
        headers:{
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


  async scheduled(
    event,
    env,
    ctx
  ){

    ctx.waitUntil(
      loadAllData(env)
    );
  }
};
