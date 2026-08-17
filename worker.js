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

const VERSION =
  "PAKS MONITOR V9";

const OUTLET_TEMP =
  34.9;

const OUTLET_TEMP_DATE =
  "08.14";

const PAKS_ZERO_MBF =
  85.380;

const LOCAL_ZERO_MBF =
  85.000;

const PUMP_MIN_MBF =
  83.60;


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
    ? value.toLocaleString(
        "hu-HU",
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }
      )
    : "—";
}


function fmt2(value) {

  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value.toLocaleString(
        "hu-HU",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2
        }
      )
    : "—";
}


function shortTime(value) {

  const match =
    String(value || "")
      .match(/(\d{2}:\d{2})/);

  return match
    ? match[1]
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

  for (const part of parts) {

    if (part.type !== "literal") {
      values[part.type] =
        Number(part.value);
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

  return localAsUTC - timestamp;
}


function parseHuTimestamp(value) {

  const match =
    String(value || "")
      .match(
        /(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?\s*(\d{2}):(\d{2})/
      );

  if (!match) {
    return null;
  }

  const desiredLocalAsUTC =
    Date.UTC(
      Number(match[1]),
      Number(match[2]) - 1,
      Number(match[3]),
      Number(match[4]),
      Number(match[5]),
      0
    );

  let timestamp =
    desiredLocalAsUTC;

  for (let i = 0; i < 2; i++) {

    timestamp =
      desiredLocalAsUTC -
      getBudapestOffset(
        timestamp
      );
  }

  return Number.isFinite(timestamp)
    ? timestamp
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
// VÍZÜGY
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
              "Mozilla/5.0 (compatible; PaksMonitor/9.0)"
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

        time:
          match[1],

        water:
          Number(
            match[2]
          ),

        flow:
          match[3],

        temp1:
          match[4],

        temp2:
          match[5]
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
            latest.flow
              .replace(",", ".")
          );

        if (
          Number.isFinite(f) &&
          f >= 0 &&
          f <= 20000
        ) {

          result.flow =
            f;
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
            raw.replace(",", ".")
          );

        if (
          Number.isFinite(t) &&
          t >= 0 &&
          t <= 40
        ) {

          result.temp =
            t;

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
      "VIZ STATION ERROR:",
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


  await env.DB
    .prepare(
      `CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT
      )`
    )
    .run();
}


// ============================================================
// RESET
// ============================================================

async function resetRiverHistory(env) {

  await ensureDB(env);


  await env.DB
    .prepare(
      `UPDATE measurements
       SET
         water = NULL,
         flow = NULL,
         temp = NULL,
         hvcs = NULL,
         threshold_up = NULL,
         threshold_down = NULL`
    )
    .run();


  await env.DB
    .prepare(
      `DELETE FROM measurements
       WHERE
         power IS NULL
         AND water IS NULL
         AND flow IS NULL
         AND temp IS NULL
         AND hvcs IS NULL
         AND threshold_up IS NULL
         AND threshold_down IS NULL`
    )
    .run();


  return true;
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


  // ==========================================================
  // OAH
  // ==========================================================

  try {

    const response =
      await fetch(
        OAH_URL,
        {
          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/9.0)"
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


  // ==========================================================
  // VÍZÜGY
  // ==========================================================

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


  const pumpReserveCm =
    Number.isFinite(
      hvcsMbf
    )
      ? Math.round(
          (
            hvcsMbf -
            PUMP_MIN_MBF
          ) *
          100
        )
      : null;


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

    riverStatus:
      river.status,

    riverPrevious:
      river.previousValue,

    riverMbf,


    hvcs:
      hvcs.value,

    hvcsTime:
      hvcs.time,

    hvcsTimestamp:
      hvcs.timestamp,

    hvcsStatus:
      hvcs.status,

    hvcsPrevious:
      hvcs.previousValue,

    hvcsMbf,


    thresholdUp:
      thresholdUp.value,

    thresholdUpTime:
      thresholdUp.time,

    thresholdUpTimestamp:
      thresholdUp.timestamp,

    thresholdUpStatus:
      thresholdUp.status,

    thresholdUpPrevious:
      thresholdUp.previousValue,

    thresholdUpMbf,


    thresholdDown:
      thresholdDown.value,

    thresholdDownTime:
      thresholdDown.time,

    thresholdDownTimestamp:
      thresholdDown.timestamp,

    thresholdDownStatus:
      thresholdDown.status,

    thresholdDownPrevious:
      thresholdDown.previousValue,

    thresholdDownMbf,


    uplift,

    pumpReserveCm,


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

    throw new Error(
      "Invalid field"
    );
  }


  await env.DB
    .prepare(
      `INSERT INTO measurements
       (
         ts,
         ${field}
       )
       VALUES (
         ?,
         ?
       )
       ON CONFLICT(ts)
       DO UPDATE SET
         ${field} =
           excluded.${field}`
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


    // ========================================================
    // VERSION
    // ========================================================

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


    // ========================================================
    // RESET
    // ========================================================

    if (
      url.pathname ===
      "/reset-river-history"
    ) {

      try {

        await resetRiverHistory(
          env
        );


        return new Response(
          `DUNA + HVCS HISTORY CLEARED ✓
${VERSION}`,
          {
            headers: {

              "content-type":
                "text/plain;charset=UTF-8",

              "cache-control":
                "no-store"
            }
          }
        );


      } catch (error) {

        return new Response(
          "RESET ERROR: " +
          (
            error?.message ||
            String(error)
          ),
          {
            status: 500
          }
        );
      }
    }


    // ========================================================
    // FACEBOOK KÉP
    // ========================================================

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
                "public, max-age=86400"
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


    // ========================================================
    // HISTORY
    // ========================================================

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

              version:
                VERSION,

              count:
                result.results
                  ?.length ||
                0,

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

              version:
                VERSION,

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


    // ========================================================
    // CURRENT
    // ========================================================

    const data =
      await getCurrentData();


    if (
      ctx &&
      typeof ctx.waitUntil ===
        "function"
    ) {

      ctx.waitUntil(
        saveMeasurement(
          env,
          data
        )
      );
    }


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

      pumpReserveCm,

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


    const outletTempText =
      Number.isFinite(
        OUTLET_TEMP
      )
        ? `${fmt1(OUTLET_TEMP)} °C`
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


    const html =
`<!doctype html>

<html lang="hu">

<head>

<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width,initial-scale=1,viewport-fit=cover"
>

<meta
  name="theme-color"
  content="#020811"
>

<meta
  name="apple-mobile-web-app-capable"
  content="yes"
>

<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black"
>

<title>
⚛️ PAKS AKTUÁLIS ADATOK
</title>

<meta
  property="og:title"
  content="⚛️ PAKS AKTUÁLIS ADATOK"
>

<meta
  property="og:image"
  content="${PUBLIC_URL}/facebook-image"
>


<style>

:root{

  --bg:#020811;
  --panel:#07111c;
  --panel2:#0c1825;
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

  width:100%;

  min-height:100%;

  overflow-x:hidden;

  background:#020811;

  color:var(--white);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}


body{

  min-height:100vh;

  background:
    radial-gradient(
      circle at 50% -10%,
      #0d2139 0%,
      #040b14 38%,
      #02060b 100%
    );
}


.app{

  width:min(
    100%,
    560px
  );

  margin:auto;

  padding:
    max(
      8px,
      env(safe-area-inset-top)
    )
    8px
    max(
      8px,
      env(safe-area-inset-bottom)
    );
}


.header{

  display:grid;

  grid-template-columns:
    auto 1fr auto;

  align-items:center;

  gap:8px;

  margin-bottom:7px;
}


.logo{

  width:39px;

  height:39px;

  display:grid;

  place-items:center;

  border-radius:11px;

  font-size:23px;

  background:
    linear-gradient(
      145deg,
      #bf54ff,
      #57127c
    );
}


.title{

  font-size:19px;

  font-weight:950;

  line-height:1;

  letter-spacing:-.5px;
}


.live{

  padding:5px 8px;

  border:
    1px solid #2b6735;

  border-radius:999px;

  background:#0b2110;

  color:#70e367;

  font-size:8px;

  font-weight:900;
}


.panel{

  border:
    1px solid #173650;

  border-radius:16px;

  background:
    linear-gradient(
      145deg,
      #08141f,
      #06101a
    );

  overflow:hidden;

  margin-bottom:7px;
}


.pad{
  padding:9px;
}


.sectionTitle{

  color:#a9b4c1;

  font-size:9px;

  font-weight:900;

  letter-spacing:.5px;
}


.bigRow{

  display:flex;

  align-items:flex-end;

  justify-content:
    space-between;

  gap:8px;

  margin:
    4px 0 7px;
}


.bigPower{

  color:var(--green);

  font-size:39px;

  line-height:.95;

  font-weight:950;

  letter-spacing:-1.4px;
}


.bigWater{

  color:var(--blue);

  font-size:39px;

  line-height:.95;

  font-weight:950;

  letter-spacing:-1.4px;
}


.smallCaption{

  color:#718194;

  font-size:7px;

  padding-bottom:3px;
}


.status{

  font-size:8px;

  font-weight:900;

  padding-bottom:3px;
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


.chartPanel{

  padding:6px;

  border:
    1px solid #132c41;

  border-radius:10px;

  background:#050e18;

  margin-bottom:6px;
}


.chartHead{

  display:flex;

  justify-content:
    space-between;

  align-items:center;

  gap:5px;

  margin-bottom:3px;
}


.chartName{

  color:#8495a9;

  font-size:6.5px;

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

  font-size:6.5px;

  font-weight:850;
}


.period.active{

  background:#234763;

  color:#fff;
}


.chartWrap{

  position:relative;

  height:87px;
}


canvas{

  display:block;

  width:100%;

  height:100%;
}


.blocks{

  display:grid;

  grid-template-columns:
    1fr 1fr;

  gap:5px;
}


.block{

  padding:6px 7px;

  border:
    1px solid #153047;

  border-radius:9px;

  background:#0b1724;
}


.blockName{

  color:#8695a6;

  font-size:6.5px;
}


.blockValue{

  margin-top:2px;

  font-size:16px;

  line-height:1;

  font-weight:900;
}


.source{

  padding:5px 9px;

  border-top:
    1px solid #173047;

  color:#6f8092;

  font-size:6px;
}


.metrics{

  display:grid;

  grid-template-columns:
    repeat(
      3,
      minmax(
        0,
        1fr
      )
    );

  gap:4px;
}


.metric{

  min-width:0;

  padding:6px;

  border-radius:8px;

  background:#0b1724;
}


.metricName{

  color:#8292a4;

  min-height:14px;

  font-size:5.8px;
}


.metricValue{

  margin-top:2px;

  white-space:nowrap;

  font-size:13px;

  font-weight:900;
}


.orange{
  color:var(--orange);
}


.tempRule{

  margin-top:5px;

  padding:5px;

  border:
    1px solid #684a18;

  border-radius:8px;

  background:#171208;

  color:#ffb340;

  text-align:center;

  font-size:6.3px;

  font-weight:900;
}


.gauge{

  position:relative;

  height:8px;

  margin-top:7px;

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

  height:18px;

  background:white;

  border-radius:2px;

  transform:
    translateX(-50%);

  box-shadow:
    0 0 6px white;
}


.scale{

  display:grid;

  grid-template-columns:
    1fr 1fr 1fr;

  margin-top:3px;

  font-size:6px;
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
    1fr 1fr;

  gap:5px;

  margin-top:5px;
}


.distance{

  padding:5px 7px;

  border-radius:8px;

  background:#0b1724;
}


.distanceNumber{

  font-size:12px;

  font-weight:950;
}


.distanceText{

  color:#718194;

  font-size:5.7px;
}


/* ============================================================
   V9 FOLYAMATÁBRA
============================================================ */


.systemPanel{
  padding:7px;
}


.systemTitle{

  display:flex;

  align-items:center;

  justify-content:
    space-between;

  gap:8px;

  margin:
    0 2px 6px;
}


.systemTitleMain{

  font-size:8px;

  font-weight:950;

  color:#d3dce5;
}


.systemTitleLive{

  color:#6f8397;

  font-size:5.7px;

  font-weight:800;
}


.dataRail{

  display:grid;

  grid-template-columns:
    repeat(
      5,
      minmax(
        0,
        1fr
      )
    );

  gap:3px;

  margin-bottom:5px;
}


.dataBox{

  min-width:0;

  padding:4px 2px;

  border:
    1px solid #18364e;

  border-radius:7px;

  background:#07131f;

  text-align:center;
}


.dataBox.upliftBox{

  border-color:#37793f;

  background:#07160a;
}


.dataLabel{

  min-height:17px;

  display:flex;

  justify-content:center;

  align-items:center;

  color:#8596a8;

  font-size:5px;

  line-height:1.05;

  font-weight:850;
}


.dataValue{

  margin-top:2px;

  white-space:nowrap;

  font-size:11.5px;

  line-height:1;

  font-weight:950;
}


.dataSub{

  margin-top:2px;

  color:#7a8b9d;

  white-space:nowrap;

  font-size:5px;
}


.dataTime{

  margin-top:2px;

  color:#5d7184;

  font-size:4.8px;
}


.blue{
  color:var(--blue);
}


.green{
  color:var(--green);
}


.dir.up{
  color:var(--green);
}


.dir.down{
  color:var(--orange);
}


.dir.flat{
  color:#a0acb8;
}


/*
  RAJZ
*/

.systemScene{

  position:relative;

  width:100%;

  height:195px;

  overflow:hidden;

  border:
    1px solid #183952;

  border-radius:11px;

  background:
    linear-gradient(
      180deg,
      #11283d 0%,
      #0f2639 53%,
      #3e332a 53%,
      #2e261f 100%
    );
}


/*
  FŐÁG:
  BAL OLDALT ALACSONYABB VÍZFELSZÍN
*/

.riverLeft{

  position:absolute;

  left:0;

  top:91px;

  width:30%;

  height:54px;

  background:
    linear-gradient(
      180deg,
      #268fd0,
      #126497
    );

  border-top:
    2px solid #67c6ff;
}


/*
  FŐÁG -> FELVÍZ
  FIZIKAILAG FELFELÉ TÖRŐ VÍZFELSZÍN
*/

.waterRise{

  position:absolute;

  left:29%;

  top:77px;

  width:20%;

  height:68px;

  background:
    linear-gradient(
      180deg,
      #2c96d6,
      #166aa0
    );

  clip-path:
    polygon(
      0 21%,
      100% 0,
      100% 100%,
      0 100%
    );
}


.riseSurface{

  position:absolute;

  left:29%;

  top:89px;

  width:21%;

  height:3px;

  background:#66c7ff;

  transform:
    rotate(-7deg);

  transform-origin:
    left center;

  box-shadow:
    0 0 7px
    rgba(
      73,
      169,
      255,
      .75
    );
}


/*
  FELVÍZI OLDAL
*/

.riverRight{

  position:absolute;

  left:48%;

  right:0;

  top:77px;

  height:68px;

  background:
    linear-gradient(
      180deg,
      #2c96d6,
      #166aa0
    );

  border-top:
    2px solid #66c7ff;
}


/*
  MEDER
*/

.riverBed{

  position:absolute;

  left:0;

  right:0;

  top:145px;

  bottom:0;

  background:
    linear-gradient(
      #48382c,
      #2d241e
    );

  border-top:
    2px solid #5a493b;
}


/*
  DUZZASZTÁS
*/

.upliftBadge{

  position:absolute;

  z-index:10;

  left:31%;

  top:10px;

  width:26%;

  padding:5px 3px;

  border:
    1px solid #347941;

  border-radius:8px;

  background:
    rgba(
      4,
      23,
      9,
      .95
    );

  text-align:center;
}


.upliftBadgeLabel{

  color:#93a39a;

  font-size:5px;

  font-weight:850;
}


.upliftBadgeValue{

  color:var(--green);

  margin-top:1px;

  font-size:18px;

  line-height:1;

  font-weight:950;
}


/*
  FENÉKKÜSZÖB
*/

.threshold{

  position:absolute;

  z-index:6;

  left:42%;

  top:114px;

  width:16%;

  height:41px;

  border-radius:
    50% 50% 7px 7px;

  background:
    radial-gradient(
      circle at 10% 70%,
      #777b7d 0 7px,
      transparent 8px
    ),
    radial-gradient(
      circle at 27% 35%,
      #96999b 0 7px,
      transparent 8px
    ),
    radial-gradient(
      circle at 44% 70%,
      #5d6163 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 62% 35%,
      #888c8f 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 80% 70%,
      #6a6e70 0 7px,
      transparent 8px
    ),
    #45494b;
}


.thresholdText{

  position:absolute;

  z-index:8;

  left:40%;

  top:158px;

  width:20%;

  text-align:center;

  color:#aeb8c0;

  font-size:5.2px;

  font-weight:900;
}


/*
  LEÁLLÁSI SZINT
*/

.shutdownLine{

  position:absolute;

  z-index:7;

  left:2%;

  right:2%;

  top:133px;

  border-top:
    2px dashed
    var(--red);
}


.shutdownText{

  position:absolute;

  z-index:9;

  left:3%;

  top:136px;

  color:var(--red);

  font-size:5.5px;

  font-weight:950;
}


/*
  SZŰRŐRÁCS
*/

.rack{

  position:absolute;

  z-index:7;

  left:64%;

  top:91px;

  width:14px;

  height:54px;

  border:
    2px solid #95a1ac;

  background:
    repeating-linear-gradient(
      90deg,
      #253947 0 2px,
      #8e9ba6 2px 4px
    );
}


.rackText{

  position:absolute;

  z-index:8;

  left:59%;

  top:150px;

  width:25%;

  text-align:center;

  color:#85cfff;

  font-size:4.8px;

  font-weight:900;
}


/*
  SZIVATTYÚK
*/

.pump{

  position:absolute;

  z-index:7;

  top:80px;

  width:12px;

  height:66px;

  border-left:
    5px solid #929da6;

  border-radius:4px;
}


.pump:before{

  content:"";

  position:absolute;

  left:-8px;

  top:-5px;

  width:15px;

  height:11px;

  border-radius:4px;

  background:#919ba4;
}


.pump:after{

  content:"";

  position:absolute;

  left:-9px;

  bottom:-6px;

  width:16px;

  height:16px;

  border:
    2px solid #323b42;

  border-radius:50%;

  background:#68747d;
}


.pump1{
  left:74%;
}


.pump2{
  left:80%;
}


/*
  SZIVATTYÚ TARTALÉK
*/

.reserve{

  position:absolute;

  z-index:10;

  right:10%;

  top:8px;

  width:24%;

  padding:5px 3px;

  border:
    1px solid #367943;

  border-radius:8px;

  background:
    rgba(
      4,
      24,
      11,
      .95
    );

  text-align:center;
}


.reserveLabel{

  color:#9bad9f;

  font-size:4.8px;

  font-weight:850;
}


.reserveValue{

  color:var(--green);

  margin-top:1px;

  font-size:18px;

  line-height:1;

  font-weight:950;
}


.reserveSub{

  margin-top:2px;

  color:#708677;

  font-size:4.4px;
}


/*
  ERŐMŰ
*/

.plant{

  position:absolute;

  z-index:7;

  right:2%;

  top:75px;

  width:57px;

  height:70px;

  border:
    1px solid #88949d;

  border-radius:
    8px 8px 3px 3px;

  background:
    linear-gradient(
      145deg,
      #68747e,
      #353d43
    );
}


.plant:before{

  content:"";

  position:absolute;

  left:11px;

  top:-22px;

  width:33px;

  height:25px;

  border:
    1px solid #8e999f;

  border-radius:
    50% 50% 0 0;

  background:#5d6870;
}


.plantName{

  position:absolute;

  left:3px;

  right:3px;

  top:14px;

  text-align:center;

  color:#f2f4f7;

  font-size:5.5px;

  line-height:1.05;

  font-weight:900;
}


.plantMw{

  position:absolute;

  left:2px;

  right:2px;

  bottom:8px;

  text-align:center;

  color:var(--green);

  font-size:11px;

  font-weight:950;
}


/*
  VÍZ ÁRAMLÁSI IRÁNY
*/

.flowArrow{

  position:absolute;

  z-index:8;

  color:#6bc4fb;

  font-size:16px;

  font-weight:950;

  opacity:.85;
}


.fa1{

  left:18%;

  top:99px;
}


.fa2{

  left:58%;

  top:91px;
}


.fa3{

  left:69%;

  top:98px;
}


/*
  ALSÓ ADATSOR
*/

.summaryRail{

  display:grid;

  grid-template-columns:
    repeat(
      3,
      minmax(
        0,
        1fr
      )
    );

  gap:4px;

  margin-top:5px;
}


.summary{

  min-width:0;

  padding:5px 3px;

  border:
    1px solid #18364e;

  border-radius:7px;

  background:#06121d;

  text-align:center;
}


.summary.highlight{

  border-color:#3c7438;

  background:#08160b;
}


.summaryLabel{

  min-height:15px;

  display:flex;

  justify-content:center;

  align-items:center;

  color:#8494a5;

  font-size:5px;

  line-height:1.05;

  font-weight:800;
}


.summaryValue{

  margin-top:2px;

  white-space:nowrap;

  font-size:12px;

  font-weight:950;
}


.summarySub{

  margin-top:2px;

  color:#647486;

  font-size:4.7px;
}


/*
  MEGOSZTÁS
*/

.share{

  display:grid;

  grid-template-columns:
    1fr 55px;

  gap:4px;

  padding:6px;

  border:
    1px solid #17334a;

  border-radius:10px;

  background:#07111b;
}


.shareLink{

  min-width:0;

  height:25px;

  display:flex;

  align-items:center;

  padding:0 6px;

  border:
    1px solid #9636c5;

  border-radius:7px;

  background:#16091d;

  color:#d24fff;

  text-decoration:none;

  white-space:nowrap;

  overflow:hidden;

  text-overflow:ellipsis;

  font-size:6px;
}


.copy{

  border:0;

  border-radius:7px;

  background:#142130;

  color:white;

  font-size:6.5px;

  font-weight:900;
}


.version{

  text-align:center;

  padding:5px;

  color:#405266;

  font-size:5.5px;

  letter-spacing:1px;
}


.toast{

  position:fixed;

  left:50%;

  bottom:20px;

  transform:
    translateX(-50%)
    translateY(10px);

  opacity:0;

  padding:7px 12px;

  border:
    1px solid #337b40;

  border-radius:999px;

  background:#102819;

  color:#79e870;

  font-size:10px;

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


@media(
  min-width:850px
){

  .app{

    width:
      min(
        1480px,
        98vw
      );
  }


  .topGrid{

    display:grid;

    grid-template-columns:
      1fr 1.35fr 1.35fr;

    gap:8px;
  }


  .topGrid .panel{
    margin-bottom:8px;
  }


  .chartWrap{
    height:160px;
  }


  .bigPower,
  .bigWater{
    font-size:63px;
  }


  .systemScene{
    height:330px;
  }


  .summaryRail{

    grid-template-columns:
      repeat(
        6,
        minmax(
          0,
          1fr
        )
      );
  }


  .summaryValue{
    font-size:20px;
  }


  .dataValue{
    font-size:18px;
  }
}

</style>

</head>


<body>


<div class="app">


  <div class="header">


    <div class="logo">
      ⚛️
    </div>


    <div class="title">
      PAKS AKTUÁLIS ADATOK
    </div>


    <div class="live">
      ● ÉLŐ
    </div>


  </div>



  <div class="topGrid">


    <!-- =====================================================
         ERŐMŰ
    ====================================================== -->


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
                class="period active"
                data-chart="power"
                data-hours="6"
              >
                6 ÓRA
              </button>


              <button
                class="period"
                data-chart="power"
                data-hours="24"
              >
                24 ÓRA
              </button>


              <button
                class="period"
                data-chart="power"
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


        <div class="blocks">


          ${blocks.map(
            (
              value,
              index
            ) => `

              <div class="block">


                <div class="blockName">
                  ${index + 1}. BLOKK
                </div>


                <div class="blockValue">

                  ${
                    value === "—"
                      ? "—"
                      : value +
                        " MW"
                  }

                </div>


              </div>

            `
          ).join("")}


        </div>


      </div>


      <div class="source">

        OAH •

        ${shortTime(oahTime)} •

        ${oahStatus}

      </div>


    </div>



    <!-- =====================================================
         DUNA
    ====================================================== -->


    <div class="panel">


      <div class="pad">


        <div class="sectionTitle">
          🌊 DUNA VÍZÁLLÁSA PAKSNÁL
        </div>


        <div class="bigRow">


          <div class="bigWater">
            ${waterText}
          </div>


          <div
            class="status ${riverClass}"
          >
            ${riverLabel}
          </div>


        </div>


        <div class="chartPanel">


          <div class="chartHead">


            <div class="chartName">
              VÍZÁLLÁS VÁLTOZÁSA • CM
            </div>


            <div class="buttons">


              <button
                class="period active"
                data-chart="water"
                data-hours="6"
              >
                6 ÓRA
              </button>


              <button
                class="period"
                data-chart="water"
                data-hours="24"
              >
                24 ÓRA
              </button>


              <button
                class="period"
                data-chart="water"
                data-hours="240"
              >
                10 NAP
              </button>


            </div>


          </div>


          <div class="chartWrap">

            <canvas
              id="waterChart"
            ></canvas>

          </div>


        </div>


      </div>


      <div class="source">

        VÍZÜGY •

        ${shortTime(riverTime)}

      </div>


    </div>



    <!-- =====================================================
         HŐMÉRSÉKLET / HATÁRÉRTÉK
    ====================================================== -->


    <div class="panel">


      <div class="pad">


        <div class="metrics">


          <div class="metric">


            <div class="metricName">
              VÍZHOZAM
            </div>


            <div class="metricValue">
              ${flowText}
            </div>


          </div>


          <div class="metric">


            <div class="metricName">
              DUNA VÍZHŐ
            </div>


            <div class="metricValue">
              ${tempText}
            </div>


          </div>


          <div class="metric">


            <div class="metricName">
              KILÉPŐ VÍZ HŐ<br>
              HŐCSÓVA ELEJÉN
            </div>


            <div class="metricValue orange">
              ${outletTempText}
            </div>


          </div>


        </div>


        <div class="tempRule">

          MVM ${OUTLET_TEMP_DATE}

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
            −134 CM
          </span>


          <span>
            −144 CM
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
              −134 CM KÜSZÖBIG
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
              −144 CM HATÁRIG
            </div>


          </div>


        </div>


      </div>


      <div class="source">
        KILÉPŐ VÍZ • MVM
      </div>


    </div>


  </div>



  <!-- =====================================================
       V9 FOLYAMATÁBRA
  ====================================================== -->


  <div class="panel systemPanel">


    <div class="systemTitle">


      <div class="systemTitleMain">

        DUNA → FENÉKKÜSZÖB → HIDEGVÍZ-CSATORNA → SZIVATTYÚK → ERŐMŰ

      </div>


      <div class="systemTitleLive">

        VÍZÜGY ÉLŐ

      </div>


    </div>



    <!-- ÉLŐ ADATOK -->


    <div class="dataRail">


      <div class="dataBox">


        <div class="dataLabel">
          DUNA<br>PAKS FŐÁG
        </div>


        <div class="dataValue blue">

          ${
            Number.isFinite(water)
              ? water + " cm"
              : "—"
          }

          <span
            class="dir ${riverDir.cls}"
          >
            ${riverDir.symbol}
          </span>

        </div>


        <div class="dataSub">

          ${
            Number.isFinite(
              riverMbf
            )
              ? fmt2(
                  riverMbf
                ) +
                " mBf"
              : "—"
          }

        </div>


        <div class="dataTime">
          ${shortTime(riverTime)}
        </div>


      </div>



      <div class="dataBox">


        <div class="dataLabel">
          FENÉKKÜSZÖB<br>FELVÍZ
        </div>


        <div class="dataValue green">

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


        <div class="dataSub">

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


        <div class="dataTime">
          ${shortTime(
            thresholdUpTime
          )}
        </div>


      </div>



      <div class="dataBox upliftBox">


        <div class="dataLabel">
          DUZZASZTÁS<br>EREDMÉNYE
        </div>


        <div class="dataValue green">

          ${
            Number.isFinite(
              uplift
            )
              ? "+" +
                uplift +
                " cm"
              : "—"
          }

        </div>


        <div class="dataSub">
          FELVÍZ − ALVÍZ
        </div>


        <div class="dataTime">
          ÉLŐ
        </div>


      </div>



      <div class="dataBox">


        <div class="dataLabel">
          FENÉKKÜSZÖB<br>ALVÍZ
        </div>


        <div class="dataValue blue">

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


        <div class="dataSub">

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


        <div class="dataTime">
          ${shortTime(
            thresholdDownTime
          )}
        </div>


      </div>



      <div class="dataBox">


        <div class="dataLabel">
          HIDEGVÍZ-CSATORNA<br>ÖBLÖZET
        </div>


        <div class="dataValue blue">

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


        <div class="dataSub">

          ${
            Number.isFinite(
              hvcsMbf
            )
              ? fmt2(
                  hvcsMbf
                ) +
                " mBf"
              : "—"
          }

        </div>


        <div class="dataTime">
          ${shortTime(hvcsTime)}
        </div>


      </div>


    </div>



    <!-- RAJZ -->


    <div class="systemScene">


      <div class="riverLeft"></div>

      <div class="waterRise"></div>

      <div class="riseSurface"></div>

      <div class="riverRight"></div>

      <div class="riverBed"></div>


      <div class="upliftBadge">


        <div class="upliftBadgeLabel">
          DUZZASZTÁS
        </div>


        <div class="upliftBadgeValue">

          ${
            Number.isFinite(
              uplift
            )
              ? "+" +
                uplift +
                " cm"
              : "—"
          }

        </div>


      </div>


      <div class="threshold"></div>


      <div class="thresholdText">
        KÖVES<br>
        FENÉKKÜSZÖB
      </div>


      <div class="shutdownLine"></div>


      <div class="shutdownText">
        −144 cm • LEÁLLÁSI SZINT
      </div>


      <div class="rack"></div>


      <div class="rackText">
        HIDEGVÍZ-CSATORNA
      </div>


      <div class="pump pump1"></div>

      <div class="pump pump2"></div>


      <div class="reserve">


        <div class="reserveLabel">
          SZIVATTYÚ TARTALÉK
        </div>


        <div class="reserveValue">

          ${
            Number.isFinite(
              pumpReserveCm
            )
              ? pumpReserveCm +
                " cm"
              : "—"
          }

        </div>


        <div class="reserveSub">
          83,60 mBf MINIMUM FELETT
        </div>


      </div>


      <div class="plant">


        <div class="plantName">
          PAKSI<br>
          ATOMERŐMŰ
        </div>


        <div class="plantMw">

          ${
            Number.isFinite(total)
              ? total +
                " MW"
              : "— MW"
          }

        </div>


      </div>


      <div class="flowArrow fa1">
        →
      </div>


      <div class="flowArrow fa2">
        →
      </div>


      <div class="flowArrow fa3">
        →
      </div>


    </div>



    <!-- ALSÓ RÖVID ÖSSZEFOGLALÓ -->


    <div class="summaryRail">


      <div class="summary">


        <div class="summaryLabel">
          DUNA PAKS
        </div>


        <div class="summaryValue blue">

          ${
            Number.isFinite(water)
              ? water +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          ${shortTime(riverTime)}
        </div>


      </div>


      <div class="summary">


        <div class="summaryLabel">
          FELVÍZ
        </div>


        <div class="summaryValue green">

          ${
            Number.isFinite(
              thresholdUp
            )
              ? thresholdUp +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          ${shortTime(
            thresholdUpTime
          )}
        </div>


      </div>


      <div class="summary">


        <div class="summaryLabel">
          ALVÍZ
        </div>


        <div class="summaryValue blue">

          ${
            Number.isFinite(
              thresholdDown
            )
              ? thresholdDown +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          ${shortTime(
            thresholdDownTime
          )}
        </div>


      </div>


      <div class="summary highlight">


        <div class="summaryLabel">
          DUZZASZTÁS
        </div>


        <div class="summaryValue green">

          ${
            Number.isFinite(
              uplift
            )
              ? "+" +
                uplift +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          FELVÍZ − ALVÍZ
        </div>


      </div>


      <div class="summary">


        <div class="summaryLabel">
          HIDEGVÍZ
        </div>


        <div class="summaryValue blue">

          ${
            Number.isFinite(hvcs)
              ? hvcs +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          ${shortTime(hvcsTime)}
        </div>


      </div>


      <div class="summary highlight">


        <div class="summaryLabel">
          SZIVATTYÚ TARTALÉK
        </div>


        <div class="summaryValue green">

          ${
            Number.isFinite(
              pumpReserveCm
            )
              ? pumpReserveCm +
                " cm"
              : "—"
          }

        </div>


        <div class="summarySub">
          83,60 mBf FELETT
        </div>


      </div>


    </div>


    <div class="source">

      VÍZÜGY

      • FŐÁG ${shortTime(riverTime)}

      • FELVÍZ ${shortTime(thresholdUpTime)}

      • ALVÍZ ${shortTime(thresholdDownTime)}

      • HVCS ${shortTime(hvcsTime)}

    </div>


  </div>



  <!-- =====================================================
       MEGOSZTÁS
  ====================================================== -->


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


  <div class="version">

    ${VERSION}

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


let selectedRange = {

  power: 6,
  water: 6
};


let cache = {};


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
    cache[hours]
  ) {

    return cache[hours];
  }


  const data =
    await getHistory(
      hours
    );


  cache[hours] =
    data;


  return data;
}


// ============================================================
// GRAFIKON
// ============================================================

async function drawChart(
  canvasId,
  field,
  hours,
  unit
) {

  const canvas =
    document.getElementById(
      canvasId
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
          row[field] !== null &&
          row[field] !== undefined
      )
      .map(
        row => ({
          x:
            Number(row.ts),

          y:
            Number(
              row[field]
            )
        })
      )
      .filter(
        point =>
          Number.isFinite(
            point.x
          ) &&
          Number.isFinite(
            point.y
          )
      )
      .sort(
        (a, b) =>
          a.x - b.x
      );


  const rect =
    canvas
      .getBoundingClientRect();


  const ratio =
    window.devicePixelRatio ||
    1;


  canvas.width =
    Math.max(
      1,
      Math.floor(
        rect.width *
        ratio
      )
    );


  canvas.height =
    Math.max(
      1,
      Math.floor(
        rect.height *
        ratio
      )
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


  const W =
    rect.width;


  const H =
    rect.height;


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  const pad = {
    left: 38,
    right: 8,
    top: 8,
    bottom: 20
  };


  const chartW =
    W -
    pad.left -
    pad.right;


  const chartH =
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
      chartH *
      i /
      4;


    ctx.beginPath();

    ctx.moveTo(
      pad.left,
      y
    );

    ctx.lineTo(
      W - pad.right,
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
      "10px -apple-system";

    ctx.textAlign =
      "left";

    ctx.fillText(
      "Új valódi mérésre várunk…",
      pad.left + 8,
      H / 2
    );

    return;
  }


  let minY =
    Math.min(
      ...data.map(
        point =>
          point.y
      )
    );


  let maxY =
    Math.max(
      ...data.map(
        point =>
          point.y
      )
    );


  if (
    minY === maxY
  ) {

    const delta =
      field === "water"
        ? 2
        : Math.max(
            1,
            Math.abs(minY) *
            .02
          );

    minY -= delta;

    maxY += delta;
  }


  const margin =
    Math.max(
      1,
      (
        maxY -
        minY
      ) *
      .15
    );


  minY -= margin;

  maxY += margin;


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
      chartW;


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
      chartH;


  ctx.fillStyle =
    "#708296";


  ctx.font =
    "8px -apple-system";


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
      chartH *
      i /
      2;


    ctx.fillText(
      Math.round(value) +
      " " +
      unit,

      pad.left - 4,

      y + 3
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

    const timestamp =
      minX +
      (
        maxX -
        minX
      ) *
      i /
      divisions;


    const date =
      new Date(
        timestamp
      );


    const label =
      hours >= 240
        ? date.toLocaleDateString(
            "hu-HU",
            {
              month: "2-digit",
              day: "2-digit"
            }
          )
        : date.toLocaleTimeString(
            "hu-HU",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          );


    ctx.fillText(
      label,
      sx(timestamp),
      H - 5
    );
  }


  const lineColor =
    field === "power"
      ? "#66df57"
      : "#49a9ff";


  ctx.strokeStyle =
    lineColor;


  ctx.fillStyle =
    lineColor;


  ctx.lineWidth =
    2.2;


  ctx.lineJoin =
    field === "water"
      ? "miter"
      : "round";


  ctx.lineCap =
    field === "water"
      ? "butt"
      : "round";


  if (
    data.length === 1
  ) {

    const point =
      data[0];


    ctx.beginPath();

    ctx.moveTo(
      Math.max(
        pad.left,
        sx(point.x)
      ),
      sy(point.y)
    );

    ctx.lineTo(
      sx(maxX),
      sy(point.y)
    );

    ctx.stroke();


    ctx.beginPath();

    ctx.arc(
      sx(maxX),
      sy(point.y),
      3.5,
      0,
      Math.PI * 2
    );

    ctx.fill();


    return;
  }


  ctx.beginPath();


  if (
    field === "water"
  ) {

    const first =
      data[0];


    let firstX =
      sx(first.x);


    if (
      firstX <
      pad.left
    ) {

      firstX =
        pad.left;
    }


    ctx.moveTo(
      firstX,
      sy(first.y)
    );


    for (
      let i = 1;
      i < data.length;
      i++
    ) {

      const previous =
        data[i - 1];

      const current =
        data[i];

      const currentX =
        sx(current.x);


      if (
        currentX <
        pad.left
      ) {

        continue;
      }


      if (
        currentX >
        W -
        pad.right
      ) {

        break;
      }


      ctx.lineTo(
        currentX,
        sy(previous.y)
      );


      ctx.lineTo(
        currentX,
        sy(current.y)
      );
    }


    const last =
      data[
        data.length - 1
      ];


    ctx.lineTo(
      sx(maxX),
      sy(last.y)
    );


  } else {


    data.forEach(
      (
        point,
        index
      ) => {

        const x =
          sx(point.x);

        const y =
          sy(point.y);


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
  }


  ctx.stroke();


  const last =
    data[
      data.length - 1
    ];


  ctx.beginPath();


  ctx.arc(

    field === "water"
      ? sx(maxX)
      : sx(last.x),

    sy(last.y),

    3.5,

    0,

    Math.PI * 2
  );


  ctx.fill();
}


// ============================================================
// ÚJRARAJZOLÁS
// ============================================================

async function redraw() {

  cache = {};


  await Promise.all(
    [

      drawChart(
        "powerChart",
        "power",
        selectedRange.power,
        "MW"
      ),

      drawChart(
        "waterChart",
        "water",
        selectedRange.water,
        "cm"
      )

    ]
  );
}


// ============================================================
// GOMBOK
// ============================================================

function setRange(
  chart,
  hours,
  button
) {

  selectedRange[chart] =
    hours;


  document
    .querySelectorAll(
      '[data-chart="' +
      chart +
      '"]'
    )
    .forEach(
      element =>
        element
          .classList
          .remove("active")
    );


  button
    .classList
    .add("active");


  cache = {};


  if (
    chart === "power"
  ) {

    drawChart(
      "powerChart",
      "power",
      hours,
      "MW"
    );

  } else {

    drawChart(
      "waterChart",
      "water",
      hours,
      "cm"
    );
  }
}


document
  .querySelectorAll(
    ".period"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          setRange(
            button.dataset.chart,
            Number(
              button.dataset.hours
            ),
            button
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


        toast
          .classList
          .add("show");


        setTimeout(
          () =>
            toast
              .classList
              .remove("show"),
          1400
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

redraw();


window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      window.__resizeTimer
    );


    window.__resizeTimer =
      setTimeout(
        redraw,
        150
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
