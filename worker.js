const OAH_URL =
  "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

const VIZ_URL =
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

const HVCS_URL =
  "https://www.vizugy.hu/?AllomasVOA=762D32FE-1414-4A35-9121-6FCE1EED55B4&mapData=OrasIdosor&mapModule=OpGrafikon";

const THRESHOLD_UP_URL =
  "https://www.vizugy.hu/?AllomasVOA=3472EA24-55EA-4B05-B1D7-3695034CADB9&mapData=OrasIdosor&mapModule=OpGrafikon";

const THRESHOLD_DOWN_URL =
  "https://www.vizugy.hu/?AllomasVOA=D79FBC2B-EBE1-4BBE-A431-B3FA46D638B8&mapData=OrasIdosor&mapModule=OpGrafikon";

const PUBLIC_URL =
  "https://paks-monitor.laszlo-iglodi.workers.dev";

const FB_IMAGE_RAW =
  "https://raw.githubusercontent.com/laszloiglodi-beep/Paks-monitor/main/60CF06BF-2068-420D-AC41-224FB3B75358.png";

const VERSION = "VPAKS01";

const PAKS_ZERO_MBF = 85.380;
const LOCAL_ZERO_MBF = 85.000;


// ============================================================
// SEGÉDFÜGGVÉNYEK
// ============================================================

function clean(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&#160;/gi, " ")
    .replace(/&minus;/gi, "-")
    .replace(/&#8722;/gi, "-")
    .replace(/&deg;/gi, "°")
    .replace(/\s+/g, " ")
    .trim();
}

function fmt1(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value.toLocaleString("hu-HU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      })
    : "—";
}

function fmt2(value) {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value.toLocaleString("hu-HU", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })
    : "—";
}

function shortTime(value) {
  const m =
    String(value || "")
      .match(/(\d{2}:\d{2})/);

  return m
    ? m[1]
    : "—";
}


// ============================================================
// BUDAPEST IDŐ
// ============================================================

function getBudapestOffset(timestamp) {
  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
      {
        timeZone: "Europe/Budapest",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
      }
    );

  const parts =
    formatter.formatToParts(
      new Date(timestamp)
    );

  const values = {};

  for (const p of parts) {
    if (p.type !== "literal") {
      values[p.type] =
        Number(p.value);
    }
  }

  const localAsUTC =
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second
    );

  return (
    localAsUTC -
    timestamp
  );
}

function parseHuTimestamp(value) {
  const m =
    String(value || "")
      .match(
        /(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?\s*(\d{2}):(\d{2})/
      );

  if (!m) {
    return null;
  }

  const desired =
    Date.UTC(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      0
    );

  let ts =
    desired;

  for (let i = 0; i < 2; i++) {
    ts =
      desired -
      getBudapestOffset(ts);
  }

  return Number.isFinite(ts)
    ? ts
    : null;
}

function cmToMbf(
  cm,
  zero
) {
  return Number.isFinite(cm)
    ? zero + cm / 100
    : null;
}

function direction(
  current,
  previous
) {
  if (
    !Number.isFinite(current) ||
    !Number.isFinite(previous)
  ) {
    return {
      symbol: "→",
      cls: "flat"
    };
  }

  if (current > previous) {
    return {
      symbol: "↑",
      cls: "up"
    };
  }

  if (current < previous) {
    return {
      symbol: "↓",
      cls: "down"
    };
  }

  return {
    symbol: "→",
    cls: "flat"
  };
}


// ============================================================
// VÍZÜGY PARSER
// ============================================================

async function fetchVizStation(
  url,
  wantExtras = false
) {
  const result = {
    value: null,
    flow: null,
    temp: null,
    time: "—",
    timestamp: null,
    previousValue: null,
    status: "OK"
  };

  try {
    const response =
      await fetch(
        url,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; VPAKS01)"
          },
          cf: {
            cacheTtl: 60,
            cacheEverything: false
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "VIZ HTTP " +
        response.status
      );
    }

    const text =
      clean(
        await response.text()
      );

    const rowRegex =
      /(20\d{2}\.\s*\d{2}\.\s*\d{2}\.?\s*\d{2}:\d{2})\s+(-?\d+)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)/g;

    const rows = [];
    let match;

    while (
      (
        match =
          rowRegex.exec(text)
      ) !== null
    ) {
      const timestamp =
        parseHuTimestamp(
          match[1]
        );

      if (
        !Number.isFinite(timestamp)
      ) {
        continue;
      }

      rows.push({
        timestamp,
        time: match[1],
        water: Number(match[2]),
        flow: match[3],
        temp1: match[4],
        temp2: match[5]
      });
    }

    rows.sort(
      (a, b) =>
        a.timestamp -
        b.timestamp
    );

    if (!rows.length) {
      result.status =
        "ADATHIBA";

      return result;
    }

    const latest =
      rows[
        rows.length - 1
      ];

    const previous =
      rows.length > 1
        ? rows[
            rows.length - 2
          ]
        : null;

    if (
      Number.isFinite(
        latest.water
      ) &&
      latest.water > -1000 &&
      latest.water < 1000
    ) {
      result.value =
        latest.water;
    }

    result.previousValue =
      previous &&
      Number.isFinite(
        previous.water
      )
        ? previous.water
        : null;

    result.time =
      latest.time;

    result.timestamp =
      latest.timestamp;

    if (wantExtras) {
      if (
        latest.flow !== "-"
      ) {
        const f =
          Number(
            latest.flow.replace(
              ",",
              "."
            )
          );

        if (
          Number.isFinite(f) &&
          f >= 0 &&
          f <= 20000
        ) {
          result.flow = f;
        }
      }

      for (
        const raw of
        [
          latest.temp1,
          latest.temp2
        ]
      ) {
        if (
          !raw ||
          raw === "-"
        ) {
          continue;
        }

        const t =
          Number(
            raw.replace(
              ",",
              "."
            )
          );

        if (
          Number.isFinite(t) &&
          t >= 0 &&
          t <= 40
        ) {
          result.temp = t;
          break;
        }
      }
    }

    if (
      !Number.isFinite(
        result.value
      )
    ) {
      result.status =
        "ADATHIBA";
    }

    return result;

  } catch (error) {
    result.status =
      "KAPCSOLATI HIBA";

    console.log(
      "VIZ ERROR:",
      error?.message ||
      String(error)
    );

    return result;
  }
}


// ============================================================
// D1
// ============================================================

async function ensureDB(env) {
  if (
    !env ||
    !env.DB
  ) {
    throw new Error(
      "DB binding missing"
    );
  }

  await env.DB
    .prepare(
      `CREATE TABLE IF NOT EXISTS measurements (
        ts INTEGER PRIMARY KEY,
        power INTEGER,
        water INTEGER,
        flow REAL,
        temp REAL,
        hvcs INTEGER,
        threshold_up INTEGER,
        threshold_down INTEGER
      )`
    )
    .run();

  for (
    const sql of
    [
      `ALTER TABLE measurements ADD COLUMN hvcs INTEGER`,
      `ALTER TABLE measurements ADD COLUMN threshold_up INTEGER`,
      `ALTER TABLE measurements ADD COLUMN threshold_down INTEGER`
    ]
  ) {
    try {
      await env.DB
        .prepare(sql)
        .run();
    } catch {}
  }
}


// ============================================================
// AKTUÁLIS ADATOK
// ============================================================

async function getCurrentData() {
  let blocks =
    [
      "—",
      "—",
      "—",
      "—"
    ];

  let oahTime =
    "—";

  let oahTimestamp =
    null;

  let oahStatus =
    "OK";


  // OAH

  try {
    const response =
      await fetch(
        OAH_URL,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; VPAKS01)"
          },
          cf: {
            cacheTtl: 60,
            cacheEverything: false
          }
        }
      );

    if (!response.ok) {
      throw new Error(
        "OAH HTTP " +
        response.status
      );
    }

    const text =
      clean(
        await response.text()
      );

    const date =
      text.match(
        /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\.?\s*[0-9]{2}:[0-9]{2})/i
      );

    if (date) {
      oahTime =
        date[1];

      oahTimestamp =
        parseHuTimestamp(
          date[1]
        );
    }

    const mainPower =
      text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );

    if (mainPower) {
      blocks = [
        mainPower[1],
        mainPower[2],
        mainPower[3],
        mainPower[4]
      ];
    } else {
      const values = [];

      for (
        let i = 1;
        i <= 4;
        i++
      ) {
        const re =
          new RegExp(
            i +
            "\\.\\s*blokk[^0-9]{0,150}(\\d+)\\s*MW",
            "i"
          );

        const m =
          text.match(re);

        if (m) {
          values.push(
            m[1]
          );
        }
      }

      if (
        values.length === 4
      ) {
        blocks =
          values;
      } else {
        oahStatus =
          "ADATHIBA";
      }
    }

    if (
      !Number.isFinite(
        oahTimestamp
      )
    ) {
      oahStatus =
        oahStatus === "OK"
          ? "IDŐHIBA"
          : oahStatus;
    }

  } catch (error) {
    oahStatus =
      "KAPCSOLATI HIBA";

    console.log(
      "OAH ERROR:",
      error?.message ||
      String(error)
    );
  }


  // VÍZÜGY

  const [
    river,
    hvcs,
    thresholdUp,
    thresholdDown
  ] =
    await Promise.all(
      [
        fetchVizStation(
          VIZ_URL,
          true
        ),
        fetchVizStation(
          HVCS_URL,
          false
        ),
        fetchVizStation(
          THRESHOLD_UP_URL,
          false
        ),
        fetchVizStation(
          THRESHOLD_DOWN_URL,
          false
        )
      ]
    );


  const validBlocks =
    blocks.every(
      value =>
        /^\d+$/.test(
          String(value)
        )
    );


  const total =
    validBlocks
      ? blocks.reduce(
          (
            sum,
            value
          ) =>
            sum +
            Number(value),
          0
        )
      : null;


  const uplift =
    Number.isFinite(
      thresholdUp.value
    ) &&
    Number.isFinite(
      thresholdDown.value
    )
      ? thresholdUp.value -
        thresholdDown.value
      : null;


  const riverMbf =
    cmToMbf(
      river.value,
      PAKS_ZERO_MBF
    );


  const hvcsMbf =
    cmToMbf(
      hvcs.value,
      LOCAL_ZERO_MBF
    );


  const thresholdUpMbf =
    cmToMbf(
      thresholdUp.value,
      LOCAL_ZERO_MBF
    );


  const thresholdDownMbf =
    cmToMbf(
      thresholdDown.value,
      LOCAL_ZERO_MBF
    );


  return {
    blocks,
    total,

    water:
      river.value,

    flow:
      river.flow,

    temp:
      river.temp,

    riverTime:
      river.time,

    riverTimestamp:
      river.timestamp,

    riverPrevious:
      river.previousValue,

    riverMbf,

    hvcs:
      hvcs.value,

    hvcsTime:
      hvcs.time,

    hvcsTimestamp:
      hvcs.timestamp,

    hvcsPrevious:
      hvcs.previousValue,

    hvcsMbf,

    thresholdUp:
      thresholdUp.value,

    thresholdUpTime:
      thresholdUp.time,

    thresholdUpTimestamp:
      thresholdUp.timestamp,

    thresholdUpPrevious:
      thresholdUp.previousValue,

    thresholdUpMbf,

    thresholdDown:
      thresholdDown.value,

    thresholdDownTime:
      thresholdDown.time,

    thresholdDownTimestamp:
      thresholdDown.timestamp,

    thresholdDownPrevious:
      thresholdDown.previousValue,

    thresholdDownMbf,

    uplift,

    oahTime,
    oahTimestamp,
    oahStatus
  };
}


// ============================================================
// D1 MENTÉS
// ============================================================

async function upsertField(
  env,
  ts,
  field,
  value
) {
  if (
    !Number.isFinite(ts) ||
    !Number.isFinite(value)
  ) {
    return;
  }

  const allowed =
    new Set(
      [
        "power",
        "water",
        "flow",
        "temp",
        "hvcs",
        "threshold_up",
        "threshold_down"
      ]
    );

  if (
    !allowed.has(field)
  ) {
    return;
  }

  await env.DB
    .prepare(
      `INSERT INTO measurements
       (ts, ${field})
       VALUES (?, ?)
       ON CONFLICT(ts)
       DO UPDATE SET
       ${field}=excluded.${field}`
    )
    .bind(
      ts,
      value
    )
    .run();
}


async function saveMeasurement(
  env,
  data
) {
  try {
    await ensureDB(env);

    await upsertField(
      env,
      data.oahTimestamp,
      "power",
      data.total
    );

    await upsertField(
      env,
      data.riverTimestamp,
      "water",
      data.water
    );

    await upsertField(
      env,
      data.riverTimestamp,
      "flow",
      data.flow
    );

    await upsertField(
      env,
      data.riverTimestamp,
      "temp",
      data.temp
    );

    await upsertField(
      env,
      data.hvcsTimestamp,
      "hvcs",
      data.hvcs
    );

    await upsertField(
      env,
      data.thresholdUpTimestamp,
      "threshold_up",
      data.thresholdUp
    );

    await upsertField(
      env,
      data.thresholdDownTimestamp,
      "threshold_down",
      data.thresholdDown
    );

    const cutoff =
      Date.now() -
      11 *
      24 *
      60 *
      60 *
      1000;

    await env.DB
      .prepare(
        `DELETE FROM measurements
         WHERE ts < ?`
      )
      .bind(cutoff)
      .run();

  } catch (error) {
    console.log(
      "D1 SAVE ERROR:",
      error?.message ||
      String(error)
    );
  }
}


// ============================================================
// WORKER
// ============================================================

export default {

  async scheduled(
    controller,
    env,
    ctx
  ) {
    const data =
      await getCurrentData();

    ctx.waitUntil(
      saveMeasurement(
        env,
        data
      )
    );
  },


  async fetch(
    request,
    env,
    ctx
  ) {
    const url =
      new URL(
        request.url
      );


    // VERSION

    if (
      url.pathname ===
      "/version"
    ) {
      return new Response(
        VERSION,
        {
          headers: {
            "content-type":
              "text/plain;charset=UTF-8",
            "cache-control":
              "no-store"
          }
        }
      );
    }


    // FACEBOOK IMAGE

    if (
      url.pathname ===
      "/facebook-image"
    ) {
      try {
        const response =
          await fetch(
            FB_IMAGE_RAW
          );

        if (!response.ok) {
          return new Response(
            "Image not found",
            {
              status: 404
            }
          );
        }

        return new Response(
          response.body,
          {
            headers: {
              "content-type":
                "image/png",
              "cache-control":
                "public,max-age=86400"
            }
          }
        );

      } catch {
        return new Response(
          "Image unavailable",
          {
            status: 503
          }
        );
      }
    }


    // HISTORY

    if (
      url.pathname ===
      "/api/history"
    ) {
      try {
        await ensureDB(env);

        let hours =
          Number(
            url.searchParams
              .get("hours") ||
            6
          );

        if (
          ![
            6,
            24,
            240
          ].includes(hours)
        ) {
          hours = 6;
        }

        const cutoff =
          Date.now() -
          hours *
          60 *
          60 *
          1000;

        const result =
          await env.DB
            .prepare(
              `SELECT
                 ts,
                 power,
                 water,
                 flow,
                 temp,
                 hvcs,
                 threshold_up,
                 threshold_down
               FROM measurements
               WHERE ts >= ?
               ORDER BY ts ASC`
            )
            .bind(cutoff)
            .all();

        return new Response(
          JSON.stringify(
            {
              ok: true,
              version: VERSION,
              data:
                result.results ||
                []
            }
          ),
          {
            headers: {
              "content-type":
                "application/json;charset=UTF-8",
              "cache-control":
                "no-store"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify(
            {
              ok: false,
              version: VERSION,
              data: [],
              error:
                error?.message ||
                String(error)
            }
          ),
          {
            headers: {
              "content-type":
                "application/json;charset=UTF-8",
              "cache-control":
                "no-store"
            }
          }
        );
      }
    }


    // CURRENT

    const data =
      await getCurrentData();

    ctx.waitUntil(
      saveMeasurement(
        env,
        data
      )
    );


    const {
      blocks,
      total,

      water,
      flow,
      temp,

      riverTime,
      riverPrevious,
      riverMbf,

      hvcs,
      hvcsTime,
      hvcsPrevious,
      hvcsMbf,

      thresholdUp,
      thresholdUpTime,
      thresholdUpPrevious,
      thresholdUpMbf,

      thresholdDown,
      thresholdDownTime,
      thresholdDownPrevious,
      thresholdDownMbf,

      uplift,

      oahTime,
      oahStatus
    } = data;


    const totalText =
      Number.isFinite(total)
        ? `${total} MW`
        : "— MW";

    const waterText =
      Number.isFinite(water)
        ? `${water} cm`
        : "— cm";

    const flowText =
      Number.isFinite(flow)
        ? `${fmt1(flow)} m³/s`
        : "— m³/s";

    const tempText =
      Number.isFinite(temp)
        ? `${fmt1(temp)} °C`
        : "— °C";


    const shutdownDistance =
      Number.isFinite(water)
        ? water + 134
        : null;

    const safetyDistance =
      Number.isFinite(water)
        ? water + 144
        : null;


    const riverDir =
      direction(
        water,
        riverPrevious
      );

    const hvcsDir =
      direction(
        hvcs,
        hvcsPrevious
      );

    const upDir =
      direction(
        thresholdUp,
        thresholdUpPrevious
      );

    const downDir =
      direction(
        thresholdDown,
        thresholdDownPrevious
      );


    let riverClass =
      "normal";

    let riverLabel =
      "NORMÁL";


    if (
      Number.isFinite(water)
    ) {
      if (
        water <= -144
      ) {
        riverClass =
          "danger";

        riverLabel =
          "KRITIKUS";

      } else if (
        water <= -134
      ) {
        riverClass =
          "warning";

        riverLabel =
          "LEÁLLÁSI TARTOMÁNY";

      } else if (
        water <= -129
      ) {
        riverClass =
          "warning";

        riverLabel =
          "FIGYELMEZTETÉS";
      }
    }


    let markerPct = 0;

    if (
      Number.isFinite(water)
    ) {
      markerPct =
        (
          (-110 - water) /
          40
        ) *
        100;

      markerPct =
        Math.max(
          0,
          Math.min(
            100,
            markerPct
          )
        );
    }


    const html = `<!doctype html>
<html lang="hu">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=5,user-scalable=yes,viewport-fit=cover"
>

<meta
  name="theme-color"
  content="#000000"
>

<meta
  name="apple-mobile-web-app-capable"
  content="yes"
>

<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black"
>

<title>⚛️ PAKS MONITOR</title>

<meta
  property="og:title"
  content="⚛️ PAKS MONITOR"
>

<meta
  property="og:image"
  content="${PUBLIC_URL}/facebook-image"
>


<style>

:root{
  --bg:#020811;
  --panel:#07111c;
  --panel2:#0b1724;
  --line:#173650;
  --white:#f5f7fa;
  --muted:#8998aa;
  --green:#65df58;
  --blue:#4baaff;
  --orange:#ffad30;
  --red:#ff5b61;
  --purple:#c04dff;
}

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  width:100%;
  min-height:100%;
  background:#000;
  color:var(--white);
  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
  -webkit-text-size-adjust:100%;
  touch-action:
    pan-x
    pan-y
    pinch-zoom;
}

body{
  overflow:auto;
}


/* ============================================================
   VPAKS01:
   FIX 1536 × 864 FEKVŐ MŰSZERFAL
============================================================ */

#vpaksViewport{
  position:relative;
  width:100%;
  background:#000;
  overflow:visible;
}

#vpaksBoard{
  position:absolute;
  left:0;
  top:0;
  width:1536px;
  height:864px;
  transform-origin:top left;
  background:
    radial-gradient(
      circle at 50% -10%,
      #0d2139 0%,
      #040b14 38%,
      #02060b 100%
    );
  padding:12px;
}


/* ============================================================
   FEJLÉC
============================================================ */

.header{
  height:52px;
  display:grid;
  grid-template-columns:
    390px
    1fr
    430px;
  gap:10px;
  align-items:center;
  margin-bottom:8px;
}

.brand{
  display:flex;
  align-items:center;
  gap:10px;
}

.brandName{
  font-size:26px;
  line-height:.9;
  font-weight:950;
  letter-spacing:-.7px;
}

.versionBadge{
  display:inline-block;
  margin-left:8px;
  padding:4px 7px;
  border-radius:5px;
  background:#58136f;
  color:#f3a8ff;
  font-size:9px;
  vertical-align:middle;
}

.live{
  display:inline-flex;
  align-items:center;
  gap:6px;
  margin-left:10px;
  color:var(--green);
  font-size:11px;
  font-weight:900;
}

.liveDot{
  width:8px;
  height:8px;
  border-radius:50%;
  background:var(--green);
  box-shadow:0 0 8px var(--green);
}

.clockWrap{
  text-align:center;
}

.clock{
  display:inline-block;
  font-size:27px;
  font-weight:950;
}

.refresh{
  margin-left:10px;
  color:#77889a;
  font-size:9px;
}

.headerRight{
  display:grid;
  grid-template-columns:
    95px
    1fr;
  gap:7px;
  align-items:center;
}

.signature{
  height:35px;
  display:grid;
  place-items:center;
  border:1px solid #4d1d64;
  border-radius:6px;
  background:#100817;
  color:#d24fff;
  font-size:12px;
  font-weight:950;
  letter-spacing:1px;
}

.share{
  height:35px;
  display:grid;
  grid-template-columns:
    1fr
    63px;
  gap:4px;
  padding:4px;
  border:1px solid #17334a;
  border-radius:6px;
  background:#07111b;
}

.shareLink{
  min-width:0;
  display:flex;
  align-items:center;
  padding:0 6px;
  border:1px solid #9636c5;
  border-radius:5px;
  background:#16091d;
  color:#d24fff;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-decoration:none;
  font-size:7px;
}

.copy{
  border:0;
  border-radius:5px;
  background:#142130;
  color:#fff;
  font-size:7px;
  font-weight:900;
}


/* ============================================================
   FELSŐ SOR
============================================================ */

.topGrid{
  display:grid;
  grid-template-columns:
    390px
    535px
    565px;
  gap:8px;
  height:236px;
  margin-bottom:8px;
}

.panel{
  border:1px solid var(--line);
  border-radius:7px;
  background:
    linear-gradient(
      145deg,
      #08141f,
      #06101a
    );
  overflow:hidden;
}

.pad{
  padding:10px;
}

.sectionTitle{
  color:#b3bfca;
  font-size:10px;
  font-weight:900;
}

.bigRow{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:8px;
  margin:5px 0 6px;
}

.bigPower{
  color:var(--green);
  font-size:43px;
  line-height:.93;
  font-weight:950;
  letter-spacing:-1.6px;
}

.bigWater{
  color:var(--blue);
  font-size:43px;
  line-height:.93;
  font-weight:950;
}

.smallCaption{
  padding-bottom:3px;
  color:#718194;
  font-size:7px;
}

.status{
  padding-bottom:3px;
  font-size:8px;
  font-weight:900;
}

.normal{
  color:var(--green);
}

.warning{
  color:var(--orange);
}

.danger{
  color:var(--red);
}


/* ============================================================
   TELJESÍTMÉNY GRAFIKON
============================================================ */

.chartPanel{
  padding:6px;
  border:1px solid #132c41;
  border-radius:7px;
  background:#050e18;
}

.chartHead{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:4px;
  margin-bottom:2px;
}

.chartName{
  color:#8495a9;
  font-size:6px;
  font-weight:850;
}

.buttons{
  display:flex;
  gap:2px;
}

.period{
  border:0;
  border-radius:999px;
  padding:3px 5px;
  background:#111e2b;
  color:#8495a9;
  font-size:6px;
  font-weight:850;
}

.period.active{
  background:#234763;
  color:#fff;
}

.chartWrap{
  position:relative;
  height:104px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}


/* ============================================================
   4 BLOKK
============================================================ */

.blockPanel{
  display:grid;
  grid-template-rows:
    1fr
    25px;
  height:100%;
}

.blocks{
  display:grid;
  grid-template-columns:
    repeat(4,1fr);
}

.block{
  position:relative;
  padding:16px 13px;
  border-right:1px solid #173047;
}

.block:last-child{
  border-right:0;
}

.blockName{
  color:#9aa8b7;
  font-size:9px;
  font-weight:850;
}

.blockValue{
  margin-top:34px;
  color:#f7f8fa;
  font-size:23px;
  font-weight:950;
}

.blockValue.on{
  color:var(--green);
}

.blockPct{
  position:absolute;
  left:13px;
  bottom:38px;
  color:#9aa8b7;
  font-size:10px;
}

.blockPct.on{
  color:var(--green);
}

.blockBar{
  position:absolute;
  left:13px;
  right:13px;
  bottom:24px;
  height:2px;
  background:#354654;
}

.blockBarFill{
  height:100%;
  background:var(--green);
}

.source{
  height:25px;
  display:flex;
  align-items:center;
  padding:0 10px;
  border-top:1px solid #173047;
  color:#728397;
  font-size:7px;
}


/* ============================================================
   JOBB FELSŐ PANEL
============================================================ */

.metrics{
  display:grid;
  grid-template-columns:
    1fr
    1fr
    1.15fr;
  gap:5px;
}

.metric{
  padding:8px;
  border:1px solid #10283b;
  border-radius:6px;
  background:#0b1724;
}

.metricName{
  min-height:18px;
  color:#8292a4;
  font-size:7px;
}

.metricValue{
  margin-top:2px;
  white-space:nowrap;
  font-size:19px;
  font-weight:950;
}

.orange{
  color:var(--orange);
}

.infoRule{
  margin-top:6px;
  padding:6px;
  border:1px solid #684a18;
  border-radius:6px;
  background:#171208;
  color:#ffb340;
  text-align:center;
  font-size:7px;
  font-weight:900;
}

.gauge{
  position:relative;
  height:9px;
  margin-top:9px;
  border-radius:999px;
  background:
    linear-gradient(
      90deg,
      #54cc59 0%,
      #54cc59 60%,
      #ffad30 60%,
      #ffad30 85%,
      #ef555b 85%,
      #ef555b 100%
    );
}

.marker{
  position:absolute;
  left:${markerPct}%;
  top:-5px;
  width:3px;
  height:19px;
  border-radius:2px;
  background:#fff;
  transform:translateX(-50%);
  box-shadow:0 0 6px #fff;
}

.scale{
  display:grid;
  grid-template-columns:
    1fr
    1fr
    1fr;
  margin-top:3px;
  font-size:7px;
}

.scale span:nth-child(1){
  color:#748396;
}

.scale span:nth-child(2){
  text-align:center;
  color:var(--orange);
}

.scale span:nth-child(3){
  text-align:right;
  color:var(--red);
}

.distanceGrid{
  display:grid;
  grid-template-columns:
    1fr
    1fr;
  gap:5px;
  margin-top:6px;
}

.distance{
  padding:5px 8px;
  border:1px solid #10283b;
  border-radius:6px;
  background:#0b1724;
}

.distanceNumber{
  font-size:17px;
  font-weight:950;
}

.distanceText{
  color:#718194;
  font-size:7px;
}


/* ============================================================
   NAGY VÍZRENDSZER
============================================================ */

.hydroPanel{
  position:relative;
  height:425px;
  margin-bottom:8px;
  border:1px solid var(--line);
  border-radius:7px;
  overflow:hidden;
  background:#07121c;
}

.scene{
  position:relative;
  width:100%;
  height:325px;
  overflow:hidden;
  background:
    linear-gradient(
      180deg,
      #143551 0%,
      #102e47 48%,
      #0b1e2d 100%
    );
}


/* CÍMEK */

.sceneTitle{
  position:absolute;
  z-index:30;
  top:10px;
  color:#f2f4f7;
  text-align:center;
  font-size:11px;
  font-weight:900;
}

.tRiver{
  left:15px;
  width:230px;
}

.tThreshold{
  left:250px;
  width:430px;
}

.tHvcs{
  left:700px;
  width:235px;
}

.tPumps{
  left:950px;
  width:220px;
}

.tPlant{
  right:10px;
  width:270px;
}


/* VÍZ */

.riverMain{
  position:absolute;
  z-index:2;
  left:0;
  top:173px;
  width:300px;
  height:105px;
  background:
    linear-gradient(
      #2694d6,
      #116398
    );
  border-top:3px solid #69cbff;
}

.riseWater{
  position:absolute;
  z-index:3;
  left:295px;
  top:155px;
  width:150px;
  height:123px;
  background:
    linear-gradient(
      #2c98d9,
      #176ca2
    );
  clip-path:
    polygon(
      0 15%,
      100% 0,
      100% 100%,
      0 100%
    );
}

.riseLine{
  position:absolute;
  z-index:6;
  left:294px;
  top:173px;
  width:155px;
  height:3px;
  background:#6bceff;
  transform:rotate(-6deg);
  transform-origin:left center;
}

.upWater{
  position:absolute;
  z-index:2;
  left:440px;
  top:155px;
  width:270px;
  height:123px;
  background:
    linear-gradient(
      #2b96d6,
      #17699e
    );
  border-top:3px solid #68caff;
}


/* KÜSZÖB UTÁNI ALACSONYABB SZINT */

.downWater{
  position:absolute;
  z-index:2;
  left:700px;
  top:181px;
  width:185px;
  height:97px;
  background:
    linear-gradient(
      #278fce,
      #17689b
    );
  border-top:3px solid #68caff;
}


/* HVCS SZINT */

.hvcsRise{
  position:absolute;
  z-index:2;
  left:880px;
  top:163px;
  width:100px;
  height:115px;
  background:
    linear-gradient(
      #2b95d4,
      #17699d
    );
  clip-path:
    polygon(
      0 16%,
      100% 0,
      100% 100%,
      0 100%
    );
}

.hvcsWater{
  position:absolute;
  z-index:2;
  left:975px;
  right:0;
  top:163px;
  height:115px;
  background:
    linear-gradient(
      #2b95d4,
      #17699d
    );
  border-top:3px solid #68caff;
}

.bed{
  position:absolute;
  z-index:1;
  left:0;
  right:0;
  top:278px;
  bottom:0;
  background:
    linear-gradient(
      #493a2d,
      #2b231d
    );
  border-top:2px solid #5e4a3a;
}


/* MÉRÉSI KÁRTYÁK */

.reading{
  position:absolute;
  z-index:30;
  width:125px;
  padding:8px;
  border:1px solid #1a3d59;
  border-radius:6px;
  background:rgba(3,14,24,.93);
  text-align:center;
}

.readLab{
  color:#91a1b2;
  font-size:7px;
  font-weight:850;
}

.readVal{
  margin-top:4px;
  font-size:19px;
  line-height:1;
  font-weight:950;
}

.readSub{
  margin-top:4px;
  color:#d0d7de;
  font-size:8px;
}

.readTime{
  margin-top:4px;
  color:#6f8192;
  font-size:7px;
}

.rRiver{
  left:42px;
  top:45px;
}

.rUp{
  left:295px;
  top:44px;
}

.rDown{
  left:660px;
  top:44px;
}

.rHvcs{
  left:830px;
  top:44px;
}


/* DUZZASZTÁS PANEL */

.upliftCard{
  position:absolute;
  z-index:35;
  left:405px;
  top:40px;
  width:210px;
  height:135px;
  padding:9px;
  border:1px solid #347941;
  border-radius:6px;
  background:rgba(5,25,10,.94);
}

.upliftLabel{
  color:#86b68c;
  text-align:center;
  font-size:8px;
  font-weight:900;
}

.upliftValue{
  margin-top:5px;
  color:var(--green);
  text-align:center;
  font-size:25px;
  font-weight:950;
}

.upliftSub{
  margin-top:2px;
  color:#8ab990;
  text-align:center;
  font-size:8px;
}

.miniGraph{
  position:absolute;
  left:10px;
  right:10px;
  bottom:12px;
  height:55px;
}

.miniGrid{
  position:absolute;
  inset:0;
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 13px,
      rgba(75,150,90,.18) 13px 14px
    );
}

.miniLine{
  position:absolute;
  left:10px;
  right:10px;
  top:32px;
  height:2px;
  background:var(--green);
  transform:rotate(-6deg);
  transform-origin:left center;
}

.miniDot{
  position:absolute;
  right:7px;
  top:11px;
  width:7px;
  height:7px;
  border-radius:50%;
  background:var(--green);
  box-shadow:0 0 7px var(--green);
}


/* FENÉKKÜSZÖB */

.wallL{
  position:absolute;
  z-index:9;
  left:420px;
  top:148px;
  width:18px;
  height:137px;
  background:
    linear-gradient(
      90deg,
      #9ca7ad,
      #555f66
    );
}

.wallR{
  position:absolute;
  z-index:9;
  left:670px;
  top:148px;
  width:18px;
  height:137px;
  background:
    linear-gradient(
      90deg,
      #9ca7ad,
      #555f66
    );
}

.thresholdRock{
  position:absolute;
  z-index:8;
  left:445px;
  top:224px;
  width:220px;
  height:65px;
  border-radius:
    55% 55% 5px 5px;
  background:
    radial-gradient(
      circle at 15% 60%,
      #8c9093 0 16px,
      transparent 17px
    ),
    radial-gradient(
      circle at 34% 30%,
      #717578 0 18px,
      transparent 19px
    ),
    radial-gradient(
      circle at 51% 64%,
      #969a9c 0 17px,
      transparent 18px
    ),
    radial-gradient(
      circle at 70% 33%,
      #676b6e 0 20px,
      transparent 21px
    ),
    radial-gradient(
      circle at 87% 67%,
      #8b8f91 0 18px,
      transparent 19px
    ),
    #45494c;
}


/* SZŰRŐRÁCS */

.rack{
  position:absolute;
  z-index:10;
  left:790px;
  top:183px;
  width:36px;
  height:95px;
  border:3px solid #87949e;
  background:
    repeating-linear-gradient(
      90deg,
      #253845 0 5px,
      #9aa7b0 5px 8px
    );
}

.rackLabel{
  position:absolute;
  z-index:15;
  left:760px;
  top:152px;
  width:100px;
  color:#cad3da;
  text-align:center;
  font-size:8px;
  font-weight:850;
}


/* SZIVATTYÚK */

.pump{
  position:absolute;
  z-index:12;
  top:158px;
  width:35px;
  height:120px;
  border-left:10px solid #8e99a2;
}

.pump:before{
  content:"";
  position:absolute;
  left:-17px;
  top:-8px;
  width:32px;
  height:22px;
  border-radius:6px;
  background:#949ea6;
}

.pump:after{
  content:"";
  position:absolute;
  left:-18px;
  bottom:-8px;
  width:33px;
  height:33px;
  border:3px solid #303940;
  border-radius:50%;
  background:#69747d;
}

.p1{
  left:940px;
}

.p2{
  left:1010px;
}

.p3{
  left:1080px;
}


/* ERŐMŰ */

.plant{
  position:absolute;
  z-index:12;
  right:35px;
  top:113px;
  width:190px;
  height:165px;
  border:1px solid #87929a;
  border-radius:7px 7px 3px 3px;
  background:
    linear-gradient(
      145deg,
      #69737c,
      #343c42
    );
}

.plant:before{
  content:"";
  position:absolute;
  left:42px;
  top:-58px;
  width:105px;
  height:62px;
  border:1px solid #929ba2;
  border-radius:50% 50% 0 0;
  background:#59636b;
}

.chimney{
  position:absolute;
  right:14px;
  top:-65px;
  width:20px;
  height:70px;
  background:
    repeating-linear-gradient(
      180deg,
      #eee 0 10px,
      #b43030 10px 20px
    );
}

.plantName{
  margin-top:45px;
  text-align:center;
  font-size:13px;
  font-weight:950;
}

.plantMw{
  margin-top:18px;
  color:var(--green);
  text-align:center;
  font-size:28px;
  font-weight:950;
}


/* SZIVATTYÚ SZINT PANEL */

.hvcsPanel{
  position:absolute;
  z-index:35;
  right:25px;
  bottom:12px;
  width:240px;
  padding:11px;
  border:1px solid #26643a;
  border-radius:6px;
  background:rgba(4,19,11,.94);
}

.hvcsPanelTitle{
  color:#b9c4cc;
  font-size:9px;
  font-weight:900;
}

.hvcsPanelValue{
  margin-top:5px;
  color:var(--blue);
  font-size:23px;
  font-weight:950;
}

.hvcsPanelSub{
  margin-top:6px;
  color:#8fa0ad;
  font-size:8px;
}


/* FLOW */

.flowArrow{
  position:absolute;
  z-index:15;
  color:#5dbbfa;
  font-size:27px;
  font-weight:950;
}

.fa1{
  left:190px;
  top:200px;
}

.fa2{
  left:745px;
  top:207px;
}

.fa3{
  left:875px;
  top:205px;
}

.fa4{
  left:920px;
  top:205px;
}


/* LEÁLLÁSI SZINT */

.shutdownLine{
  position:absolute;
  z-index:18;
  left:220px;
  right:260px;
  top:260px;
  border-top:
    2px dashed
    var(--red);
}

.shutdownText{
  position:absolute;
  z-index:20;
  left:250px;
  top:264px;
  color:var(--red);
  font-size:8px;
  font-weight:950;
}


/* ============================================================
   ALSÓ ADATKÁRTYÁK
============================================================ */

.bottomRail{
  display:grid;
  grid-template-columns:
    1.1fr
    1fr
    1fr
    1.15fr
    1fr
    1.2fr
    1.15fr;
  height:90px;
  border-top:1px solid #17334a;
  background:#05101a;
}

.bottomCard{
  position:relative;
  padding:9px;
  border-right:1px solid #17334a;
  text-align:center;
}

.bottomCard:last-child{
  border-right:0;
}

.bottomCard.highlight{
  border:1px solid #6b621d;
  background:#08150b;
}

.bottomLabel{
  color:#8c9bab;
  font-size:8px;
  font-weight:850;
}

.bottomValue{
  margin-top:8px;
  font-size:21px;
  font-weight:950;
}

.bottomSub{
  margin-top:5px;
  color:#748698;
  font-size:7px;
}

.bottomDanger{
  margin-top:5px;
  color:var(--red);
  font-size:7px;
  font-weight:900;
}

.bottomGraph{
  position:absolute;
  left:15px;
  right:15px;
  bottom:18px;
  height:30px;
}

.bottomGraphLine{
  position:absolute;
  left:0;
  right:0;
  top:15px;
  height:2px;
  background:var(--green);
  transform:rotate(4deg);
}


/* ============================================================
   LÁBLÉC
============================================================ */

.footer{
  height:34px;
  display:grid;
  grid-template-columns:
    1fr
    1fr
    1fr;
  align-items:center;
  padding:0 10px;
  border:1px solid #173650;
  border-radius:5px;
  background:#05101a;
  color:#6d7f92;
  font-size:7px;
}

.footer div:nth-child(2){
  text-align:center;
}

.footer div:nth-child(3){
  text-align:right;
}


/* ============================================================
   TOAST
============================================================ */

.toast{
  position:fixed;
  left:50%;
  bottom:20px;
  z-index:9999;
  transform:
    translateX(-50%)
    translateY(10px);
  opacity:0;
  padding:8px 14px;
  border:1px solid #337b40;
  border-radius:999px;
  background:#102819;
  color:#79e870;
  font-size:11px;
  font-weight:850;
  transition:.2s;
  pointer-events:none;
}

.toast.show{
  opacity:1;
  transform:
    translateX(-50%)
    translateY(0);
}

</style>

</head>


<body>


<div id="vpaksViewport">


<div id="vpaksBoard">


<!-- =========================================================
     FEJLÉC
========================================================== -->

<div class="header">


<div class="brand">

<div class="brandName">
  PAKS MONITOR

  <span class="versionBadge">
    VP01
  </span>

  <span class="live">
    <span class="liveDot"></span>
    ÉLŐ ADATOK
  </span>

</div>

</div>


<div class="clockWrap">

<span
  class="clock"
  id="clock"
>
  --:--
</span>

<span class="refresh">
  FRISSÍTVE:
  ${shortTime(oahTime)}
</span>

</div>


<div class="headerRight">


<div class="signature">
  IGLÓDI
</div>


<div class="share">

<a
  class="shareLink"
  href="${PUBLIC_URL}"
>
  🔗 ${PUBLIC_URL}
</a>

<button
  class="copy"
  id="copyButton"
>
  MÁSOLÁS
</button>

</div>


</div>


</div>



<!-- =========================================================
     FELSŐ SOR
========================================================== -->

<div class="topGrid">


<!-- TELJESÍTMÉNY -->

<div class="panel">


<div class="pad">


<div class="sectionTitle">
  PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
</div>


<div class="bigRow">

<div class="bigPower">
  ${totalText}
</div>

<div class="smallCaption">
  ÖSSZTELJESÍTMÉNY
</div>

</div>


<div class="chartPanel">


<div class="chartHead">

<div class="chartName">
  TELJESÍTMÉNY VÁLTOZÁSA • MW
</div>


<div class="buttons">

<button
  class="period"
  data-hours="6"
>
  6 ÓRA
</button>

<button
  class="period active"
  data-hours="24"
>
  24 ÓRA
</button>

<button
  class="period"
  data-hours="240"
>
  10 NAP
</button>

</div>

</div>


<div class="chartWrap">

<canvas
  id="powerChart"
></canvas>

</div>


</div>


</div>


</div>



<!-- 4 BLOKK -->

<div class="panel blockPanel">


<div class="blocks">


${blocks.map(
  (
    value,
    index
  ) => {

    const n =
      Number(value);

    const pct =
      Number.isFinite(n)
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                n / 500 * 100
              )
            )
          )
        : 0;

    return `

<div class="block">


<div class="blockName">
  ${index + 1}. BLOKK
</div>


<div
  class="blockValue ${
    n > 0
      ? "on"
      : ""
  }"
>

${
  value === "—"
    ? "—"
    : value + " MW"
}

</div>


<div
  class="blockPct ${
    n > 0
      ? "on"
      : ""
  }"
>
  ${pct}%
</div>


<div class="blockBar">

<div
  class="blockBarFill"
  style="
    width:${pct}%;
    background:${
      n > 0
        ? "#65df58"
        : "#354654"
    };
  "
></div>

</div>


</div>

`;

  }
).join("")}


</div>


<div class="source">

OAH •

${shortTime(oahTime)} •

${oahStatus}

</div>


</div>



<!-- JOBB PANEL -->

<div class="panel">


<div class="pad">


<div class="metrics">


<div class="metric">

<div class="metricName">
  VÍZHOZAM
</div>

<div class="metricValue blue">
  ${flowText}
</div>

</div>


<div class="metric">

<div class="metricName">
  DUNA VÍZHŐ
</div>

<div class="metricValue blue">
  ${tempText}
</div>

</div>


<div class="metric">

<div class="metricName">
  KILÉPŐ VÍZHŐ
</div>

<div class="metricValue orange">
  —
</div>

</div>


</div>


<div class="infoRule">

KILÉPŐ VÍZHŐ:
NINCS FRISS HITELES ADAT

• 29,5 °C BEAVATKOZÁSI SZINT

• +0,1 °C → −80 MW

</div>


<div class="gauge">

<div
  class="marker"
  style="left:${markerPct}%"
></div>

</div>


<div class="scale">

<span>
  NORMÁL
</span>

<span>
  −134 cm
</span>

<span>
  −144 cm • LEÁLLÁSI SZINT
</span>

</div>


<div class="distanceGrid">


<div class="distance">

<div class="distanceNumber">

${
  Number.isFinite(
    shutdownDistance
  )
    ? shutdownDistance +
      " cm"
    : "—"
}

</div>

<div class="distanceText">
  LEÁLLÁSI KÜSZÖBIG
</div>

</div>


<div class="distance">

<div class="distanceNumber">

${
  Number.isFinite(
    safetyDistance
  )
    ? safetyDistance +
      " cm"
    : "—"
}

</div>

<div class="distanceText">
  BIZTONSÁGI HATÁRIG
</div>

</div>


</div>


</div>


</div>


</div>



<!-- =========================================================
     NAGY VÍZRENDSZER
========================================================== -->

<div class="hydroPanel">


<div class="scene">


<div class="sceneTitle tRiver">
  DUNA (FŐÁG)
</div>

<div class="sceneTitle tThreshold">
  FENÉKKÜSZÖB (KŐSZÓRÁS)
</div>

<div class="sceneTitle tHvcs">
  HIDEGVÍZ-CSATORNA<br>
  (ÖBLÖZET)
</div>

<div class="sceneTitle tPumps">
  SZIVATTYÚK<br>
  (HŰTŐVÍZ)
</div>

<div class="sceneTitle tPlant">
  PAKSI ATOMERŐMŰ
</div>



<!-- VÍZ -->

<div class="riverMain"></div>

<div class="riseWater"></div>

<div class="riseLine"></div>

<div class="upWater"></div>

<div class="downWater"></div>

<div class="hvcsRise"></div>

<div class="hvcsWater"></div>

<div class="bed"></div>



<!-- MÉRÉSEK -->

<div class="reading rRiver">

<div class="readLab">
  AKTUÁLIS
</div>

<div class="readVal blue">

${
  Number.isFinite(water)
    ? water +
      " cm"
    : "—"
}

<span
  class="dir ${riverDir.cls}"
>
${riverDir.symbol}
</span>

</div>

<div class="readSub">

${
  Number.isFinite(riverMbf)
    ? fmt2(riverMbf) +
      " mBf"
    : "—"
}

</div>

<div class="readTime">
  MÉRÉS:
  ${shortTime(riverTime)}
</div>

</div>



<div class="reading rUp">

<div class="readLab">
  FELVÍZ
</div>

<div class="readVal green">

${
  Number.isFinite(
    thresholdUp
  )
    ? thresholdUp +
      " cm"
    : "—"
}

<span
  class="dir ${upDir.cls}"
>
${upDir.symbol}
</span>

</div>

<div class="readSub">

${
  Number.isFinite(
    thresholdUpMbf
  )
    ? fmt2(
        thresholdUpMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="readTime">
  MÉRÉS:
  ${shortTime(
    thresholdUpTime
  )}
</div>

</div>



<div class="upliftCard">

<div class="upliftLabel">
  DUZZASZTÁS EREDMÉNYE
</div>

<div class="upliftValue">

${
  Number.isFinite(uplift)
    ? (
        uplift >= 0
          ? "+"
          : ""
      ) +
      uplift +
      " cm"
    : "—"
}

</div>

<div class="upliftSub">
  FELVÍZ − ALVÍZ
</div>

<div class="miniGraph">

<div class="miniGrid"></div>

<div class="miniLine"></div>

<div class="miniDot"></div>

</div>

</div>



<div class="reading rDown">

<div class="readLab">
  ALVÍZ
</div>

<div class="readVal blue">

${
  Number.isFinite(
    thresholdDown
  )
    ? thresholdDown +
      " cm"
    : "—"
}

<span
  class="dir ${downDir.cls}"
>
${downDir.symbol}
</span>

</div>

<div class="readSub">

${
  Number.isFinite(
    thresholdDownMbf
  )
    ? fmt2(
        thresholdDownMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="readTime">
  MÉRÉS:
  ${shortTime(
    thresholdDownTime
  )}
</div>

</div>



<div class="reading rHvcs">

<div class="readLab">
  AKTUÁLIS
</div>

<div class="readVal blue">

${
  Number.isFinite(hvcs)
    ? hvcs +
      " cm"
    : "—"
}

<span
  class="dir ${hvcsDir.cls}"
>
${hvcsDir.symbol}
</span>

</div>

<div class="readSub">

${
  Number.isFinite(hvcsMbf)
    ? fmt2(
        hvcsMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="readTime">
  MÉRÉS:
  ${shortTime(hvcsTime)}
</div>

</div>



<!-- FENÉKKÜSZÖB -->

<div class="wallL"></div>

<div class="wallR"></div>

<div class="thresholdRock"></div>



<!-- RÁCS -->

<div class="rackLabel">
  SZŰRŐRÁCS
</div>

<div class="rack"></div>



<!-- SZIVATTYÚK -->

<div class="pump p1"></div>

<div class="pump p2"></div>

<div class="pump p3"></div>



<!-- ERŐMŰ -->

<div class="plant">

<div class="chimney"></div>

<div class="plantName">
  PAKSI<br>
  ATOMERŐMŰ
</div>

<div class="plantMw">
  ${totalText}
</div>

</div>



<!-- ÖBLÖZET PANEL -->

<div class="hvcsPanel">

<div class="hvcsPanelTitle">
  SZIVATTYÚ SZINT • ÖBLÖZET
</div>

<div class="hvcsPanelValue">

${
  Number.isFinite(hvcsMbf)
    ? fmt2(
        hvcsMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="hvcsPanelSub">
  VÍZÜGY ÉLŐ MÉRÉSI ADAT
</div>

</div>



<!-- NYILAK -->

<div class="flowArrow fa1">
  →
</div>

<div class="flowArrow fa2">
  →
</div>

<div class="flowArrow fa3">
  ↑
</div>

<div class="flowArrow fa4">
  ↑
</div>



<!-- LEÁLLÁSI SZINT -->

<div class="shutdownLine"></div>

<div class="shutdownText">
  −144 cm • LEÁLLÁSI SZINT
</div>


</div>



<!-- =========================================================
     ALSÓ ADATSOR
========================================================== -->

<div class="bottomRail">


<div class="bottomCard">

<div class="bottomLabel">
  DUNA – PAKS (FŐÁG)
</div>

<div class="bottomValue blue">

${
  Number.isFinite(water)
    ? water +
      " cm"
    : "—"
}

</div>

<div class="bottomSub">

${
  Number.isFinite(riverMbf)
    ? fmt2(riverMbf) +
      " mBf"
    : "—"
}

</div>

<div class="bottomSub">
  MÉRÉS:
  ${shortTime(riverTime)}
</div>

<div class="bottomSub">
  🌊 ${flowText}
</div>

</div>



<div class="bottomCard">

<div class="bottomLabel">
  FENÉKKÜSZÖB FELVÍZ
</div>

<div class="bottomValue blue">

${
  Number.isFinite(
    thresholdUp
  )
    ? thresholdUp +
      " cm"
    : "—"
}

</div>

<div class="bottomSub">

${
  Number.isFinite(
    thresholdUpMbf
  )
    ? fmt2(
        thresholdUpMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="bottomSub">
  MÉRÉS:
  ${shortTime(
    thresholdUpTime
  )}
</div>

<div class="bottomDanger">
  −144 cm LEÁLLÁSI SZINT
</div>

</div>



<div class="bottomCard">

<div class="bottomLabel">
  FENÉKKÜSZÖB ALVÍZ
</div>

<div class="bottomValue blue">

${
  Number.isFinite(
    thresholdDown
  )
    ? thresholdDown +
      " cm"
    : "—"
}

</div>

<div class="bottomSub">

${
  Number.isFinite(
    thresholdDownMbf
  )
    ? fmt2(
        thresholdDownMbf
      ) +
      " mBf"
    : "—"
}

</div>

<div class="bottomSub">
  MÉRÉS:
  ${shortTime(
    thresholdDownTime
  )}
</div>

<div class="bottomDanger">
  −144 cm LEÁLLÁSI SZINT
</div>

</div>



<div class="bottomCard highlight">

<div class="bottomLabel">
  DUZZASZTÁS EREDMÉNYE
</div>

<div class="bottomValue green">

${
  Number.isFinite(uplift)
    ? (
        uplift >= 0
          ? "+"
          : ""
      ) +
      uplift +
      " cm"
    : "—"
}

</div>

<div class="bottomSub">
  FELVÍZ − ALVÍZ
</div>

</div>



<div class="bottomCard">

<div class="bottomLabel">
  HIDEGVÍZ-CSATORNA
</div>

<div class="bottomValue blue">

${
  Number.isFinite(hvcs)
    ? hvcs +
      " cm"
    : "—"
}

</div>

<div class="bottomSub">

${
  Number.isFinite(hvcsMbf)
    ? fmt2(hvcsMbf) +
      " mBf"
    : "—"
}

</div>

<div class="bottomSub">
  MÉRÉS:
  ${shortTime(hvcsTime)}
</div>

<div class="bottomDanger">
  −144 cm LEÁLLÁSI SZINT
</div>

</div>



<div class="bottomCard">

<div class="bottomLabel">
  SZIVATTYÚ SZINT (ÖBLÖZET)
</div>

<div class="bottomValue blue">

${
  Number.isFinite(hvcsMbf)
    ? fmt2(hvcsMbf) +
      " mBf"
    : "—"
}

</div>

<div class="bottomSub">
  MÉRÉS:
  ${shortTime(hvcsTime)}
</div>

<div class="bottomDanger">
  ÉLŐ VÍZÜGY MÉRÉS
</div>

</div>



<div class="bottomCard">

<div class="bottomLabel">
  ATOMERŐMŰ TELJESÍTMÉNYE
</div>

<div class="bottomValue green">
  ${totalText}
</div>

<div class="bottomGraph">
  <div class="bottomGraphLine"></div>
</div>

</div>


</div>


</div>



<!-- =========================================================
     LÁBLÉC
========================================================== -->

<div class="footer">

<div>
  ADATFORRÁSOK:
  OAH • OVF / VÍZÜGY
</div>

<div>
  AZ ADATOK TÁJÉKOZTATÓ JELLEGŰEK.
</div>

<div>
  ${VERSION}
</div>

</div>


</div>


</div>



<div
  class="toast"
  id="toast"
>
  Link másolva
</div>



<script>


const PUBLIC_URL =
  "${PUBLIC_URL}";


const BOARD_WIDTH =
  1536;


const BOARD_HEIGHT =
  864;


let selectedHours =
  24;


let historyCache =
  {};


// ============================================================
// TELJES FEKVŐ KÉP AUTOMATIKUS MÉRETEZÉSE
// ============================================================

function fitBoard() {

  const viewport =
    document.getElementById(
      "vpaksViewport"
    );


  const board =
    document.getElementById(
      "vpaksBoard"
    );


  if (
    !viewport ||
    !board
  ) {
    return;
  }


  /*
    A teljes 1536 px széles fekvő dashboard
    mindig ráfér a TELEFON SZÉLESSÉGÉRE.

    Álló telefonnál:
    teljes fekvő kép kicsiben.

    Fekvő telefonnál:
    automatikusan sokkal nagyobb.

    A böngésző pinch zoomja nincs tiltva.
  */

  const availableWidth =
    window.innerWidth;


  const scale =
    Math.min(
      1,
      availableWidth /
      BOARD_WIDTH
    );


  const scaledWidth =
    BOARD_WIDTH *
    scale;


  const scaledHeight =
    BOARD_HEIGHT *
    scale;


  viewport.style.height =
    scaledHeight +
    "px";


  board.style.transform =
    "scale(" +
    scale +
    ")";


  board.style.left =
    Math.max(
      0,
      (
        availableWidth -
        scaledWidth
      ) /
      2
    ) +
    "px";


  board.style.top =
    "0px";
}


// ============================================================
// BUDAPEST ÓRA
// ============================================================

function updateClock() {

  const element =
    document.getElementById(
      "clock"
    );


  if (!element) {
    return;
  }


  element.textContent =
    new Date()
      .toLocaleTimeString(
        "hu-HU",
        {
          timeZone:
            "Europe/Budapest",

          hour:
            "2-digit",

          minute:
            "2-digit"
        }
      );
}


// ============================================================
// HISTORY
// ============================================================

async function getHistory(
  hours
) {

  try {

    const response =
      await fetch(
        "/api/history?hours=" +
        hours +
        "&v=" +
        Date.now(),
        {
          cache:
            "no-store"
        }
      );


    const json =
      await response.json();


    if (
      json &&
      json.ok === true &&
      Array.isArray(
        json.data
      )
    ) {

      return json.data;
    }


  } catch {}


  return [];
}


async function loadHistory(
  hours
) {

  if (
    historyCache[
      hours
    ]
  ) {

    return historyCache[
      hours
    ];
  }


  const rows =
    await getHistory(
      hours
    );


  historyCache[
    hours
  ] =
    rows;


  return rows;
}


// ============================================================
// TELJESÍTMÉNY GRAFIKON
// ============================================================

async function drawPowerChart(
  hours
) {

  const canvas =
    document.getElementById(
      "powerChart"
    );


  if (!canvas) {
    return;
  }


  const rows =
    await loadHistory(
      hours
    );


  const data =
    rows
      .filter(
        row =>
          row.power !== null &&
          row.power !== undefined
      )
      .map(
        row => ({
          x:
            Number(row.ts),
          y:
            Number(row.power)
        })
      )
      .filter(
        point =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
      )
      .sort(
        (a, b) =>
          a.x - b.x
      );


  /*
    clientWidth / clientHeight:
    az eredeti 1536-as dashboard mérete,
    nem a CSS-sel lekicsinyített méret.
  */

  const W =
    canvas.clientWidth;


  const H =
    canvas.clientHeight;


  const ratio =
    window.devicePixelRatio ||
    1;


  canvas.width =
    Math.floor(
      W *
      ratio
    );


  canvas.height =
    Math.floor(
      H *
      ratio
    );


  const ctx =
    canvas.getContext(
      "2d"
    );


  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  const pad = {
    left: 38,
    right: 8,
    top: 7,
    bottom: 19
  };


  const cw =
    W -
    pad.left -
    pad.right;


  const ch =
    H -
    pad.top -
    pad.bottom;


  ctx.strokeStyle =
    "rgba(115,145,170,.18)";


  ctx.lineWidth = 1;


  for (
    let i = 0;
    i <= 4;
    i++
  ) {

    const y =
      pad.top +
      ch *
      i /
      4;


    ctx.beginPath();

    ctx.moveTo(
      pad.left,
      y
    );

    ctx.lineTo(
      W -
      pad.right,
      y
    );

    ctx.stroke();
  }


  if (
    data.length === 0
  ) {

    ctx.fillStyle =
      "#718397";


    ctx.font =
      "9px -apple-system";


    ctx.fillText(
      "Új valódi mérésre várunk…",
      pad.left +
      6,
      H /
      2
    );


    return;
  }


  let minY =
    Math.min(
      ...data.map(
        p =>
          p.y
      )
    );


  let maxY =
    Math.max(
      ...data.map(
        p =>
          p.y
      )
    );


  if (
    minY === maxY
  ) {

    minY -= 2;
    maxY += 2;
  }


  const extra =
    Math.max(
      1,
      (
        maxY -
        minY
      ) *
      .15
    );


  minY -= extra;
  maxY += extra;


  const maxX =
    Date.now();


  const minX =
    maxX -
    hours *
    60 *
    60 *
    1000;


  const sx =
    x =>
      pad.left +
      (
        (
          x -
          minX
        ) /
        (
          maxX -
          minX
        )
      ) *
      cw;


  const sy =
    y =>
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
      ch;


  ctx.fillStyle =
    "#738598";


  ctx.font =
    "7px -apple-system";


  ctx.textAlign =
    "right";


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


    const y =
      pad.top +
      ch *
      i /
      2;


    ctx.fillText(
      Math.round(value) +
      " MW",
      pad.left -
      4,
      y +
      3
    );
  }


  ctx.textAlign =
    "center";


  const divisions =
    hours >= 240
      ? 4
      : 3;


  for (
    let i = 0;
    i <= divisions;
    i++
  ) {

    const ts =
      minX +
      (
        maxX -
        minX
      ) *
      i /
      divisions;


    const d =
      new Date(ts);


    const label =
      hours >= 240
        ? d.toLocaleDateString(
            "hu-HU",
            {
              month:
                "2-digit",
              day:
                "2-digit"
            }
          )
        : d.toLocaleTimeString(
            "hu-HU",
            {
              hour:
                "2-digit",
              minute:
                "2-digit"
            }
          );


    ctx.fillText(
      label,
      sx(ts),
      H - 4
    );
  }


  ctx.strokeStyle =
    "#65df58";


  ctx.fillStyle =
    "#65df58";


  ctx.lineWidth =
    2;


  ctx.lineJoin =
    "round";


  ctx.lineCap =
    "round";


  ctx.beginPath();


  data.forEach(
    (
      p,
      index
    ) => {

      const x =
        sx(p.x);

      const y =
        sy(p.y);


      if (
        index === 0
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
    }
  );


  ctx.stroke();


  const last =
    data[
      data.length - 1
    ];


  ctx.beginPath();


  ctx.arc(
    sx(last.x),
    sy(last.y),
    3.5,
    0,
    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// GOMBOK
// ============================================================

document
  .querySelectorAll(
    ".period"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          selectedHours =
            Number(
              button.dataset.hours
            );


          document
            .querySelectorAll(
              ".period"
            )
            .forEach(
              b =>
                b.classList
                  .remove(
                    "active"
                  )
            );


          button.classList
            .add(
              "active"
            );


          historyCache =
            {};


          drawPowerChart(
            selectedHours
          );
        }
      );
    }
  );


// ============================================================
// MÁSOLÁS
// ============================================================

document
  .getElementById(
    "copyButton"
  )
  ?.addEventListener(
    "click",
    async () => {

      try {

        await navigator
          .clipboard
          .writeText(
            PUBLIC_URL
          );


        const toast =
          document
            .getElementById(
              "toast"
            );


        toast.classList
          .add(
            "show"
          );


        setTimeout(
          () =>
            toast.classList
              .remove(
                "show"
              ),
          1300
        );


      } catch {

        window.prompt(
          "Másold a linket:",
          PUBLIC_URL
        );
      }
    }
  );


// ============================================================
// START
// ============================================================

fitBoard();

updateClock();

setInterval(
  updateClock,
  15000
);

drawPowerChart(
  24
);


// ============================================================
// FORGATÁS
// ============================================================

function refit() {

  clearTimeout(
    window.__vpaksResize
  );


  window.__vpaksResize =
    setTimeout(
      () => {

        fitBoard();

        historyCache =
          {};

        drawPowerChart(
          selectedHours
        );

      },
      150
    );
}


window.addEventListener(
  "resize",
  refit
);


window.addEventListener(
  "orientationchange",
  () => {

    setTimeout(
      refit,
      300
    );
  }
);


</script>


</body>
</html>`;


    return new Response(
      html,
      {
        status: 200,
        headers: {
          "content-type":
            "text/html;charset=UTF-8",

          "cache-control":
            "no-store, no-cache, must-revalidate",

          "pragma":
            "no-cache"
        }
      }
    );
  }
};
