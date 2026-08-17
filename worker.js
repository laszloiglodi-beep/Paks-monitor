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
  "PAKS MONITOR V8";


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
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " "
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " "
    )
    .replace(
      /<[^>]+>/g,
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
      /&minus;/gi,
      "-"
    )
    .replace(
      /&#8722;/gi,
      "-"
    )
    .replace(
      /&deg;/gi,
      "°"
    )
    .replace(
      /\s+/g,
      " "
    )
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
          minimumFractionDigits:
            1,

          maximumFractionDigits:
            1
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
          minimumFractionDigits:
            2,

          maximumFractionDigits:
            2
        }
      )
    : "—";
}


function shortTime(value) {

  const match =
    String(value || "")
      .match(
        /(\d{2}:\d{2})/
      );


  return match
    ? match[1]
    : "—";
}


// ============================================================
// BUDAPESTI HELYI IDŐ
// ============================================================

function getBudapestOffset(timestamp) {

  const formatter =
    new Intl.DateTimeFormat(
      "en-GB",
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

        second:
          "2-digit",

        hourCycle:
          "h23"
      }
    );


  const parts =
    formatter.formatToParts(
      new Date(timestamp)
    );


  const values =
    {};


  for (
    const part of parts
  ) {

    if (
      part.type !==
      "literal"
    ) {

      values[
        part.type
      ] =
        Number(
          part.value
        );
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


  for (
    let i = 0;
    i < 2;
    i++
  ) {

    timestamp =
      desiredLocalAsUTC -
      getBudapestOffset(
        timestamp
      );
  }


  return Number.isFinite(
    timestamp
  )
    ? timestamp
    : null;
}


function cmToMbf(
  cm,
  zero
) {

  return Number.isFinite(
    cm
  )
    ? zero +
      cm /
      100
    : null;
}


function direction(
  current,
  previous
) {

  if (
    !Number.isFinite(
      current
    ) ||
    !Number.isFinite(
      previous
    )
  ) {

    return {
      symbol:
        "→",

      cls:
        "flat"
    };
  }


  if (
    current >
    previous
  ) {

    return {
      symbol:
        "↑",

      cls:
        "up"
    };
  }


  if (
    current <
    previous
  ) {

    return {
      symbol:
        "↓",

      cls:
        "down"
    };
  }


  return {
    symbol:
      "→",

    cls:
      "flat"
  };
}


// ============================================================
// VÍZÜGY ÁLTALÁNOS PARSER
// ============================================================

async function fetchVizStation(
  url,
  wantExtras = false
) {

  const result = {

    value:
      null,

    flow:
      null,

    temp:
      null,

    time:
      "—",

    timestamp:
      null,

    previousValue:
      null,

    status:
      "OK"
  };


  try {

    const response =
      await fetch(
        url,
        {
          headers: {

            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/8.0)"
          },

          cf: {

            cacheTtl:
              60,

            cacheEverything:
              false
          }
        }
      );


    if (
      !response.ok
    ) {

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


    const rows =
      [];


    let match;


    while (
      (
        match =
          rowRegex.exec(
            text
          )
      ) !== null
    ) {

      const timestamp =
        parseHuTimestamp(
          match[1]
        );


      if (
        !Number.isFinite(
          timestamp
        )
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
      (
        a,
        b
      ) =>
        a.timestamp -
        b.timestamp
    );


    if (
      !rows.length
    ) {

      result.status =
        "ADATHIBA";


      return result;
    }


    const latest =
      rows[
        rows.length -
        1
      ];


    const previous =
      rows.length >
      1

        ? rows[
            rows.length -
            2
          ]

        : null;


    if (
      Number.isFinite(
        latest.water
      ) &&
      latest.water >
      -1000 &&
      latest.water <
      1000
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


    if (
      wantExtras
    ) {

      if (
        latest.flow !==
        "-"
      ) {

        const f =
          Number(
            latest.flow
              .replace(
                ",",
                "."
              )
          );


        if (
          Number.isFinite(
            f
          ) &&
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
            raw.replace(
              ",",
              "."
            )
          );


        if (
          Number.isFinite(
            t
          ) &&
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
        .prepare(
          sql
        )
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

  await ensureDB(
    env
  );


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
              "Mozilla/5.0 (compatible; PaksMonitor/8.0)"
          },

          cf: {

            cacheTtl:
              60,

            cacheEverything:
              false
          }
        }
      );


    if (
      !response.ok
    ) {

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


    if (
      date
    ) {

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


    if (
      mainPower
    ) {

      blocks = [

        mainPower[1],
        mainPower[2],
        mainPower[3],
        mainPower[4]

      ];

    } else {

      const values =
        [];


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
          text.match(
            re
          );


        if (
          m
        ) {

          values.push(
            m[1]
          );
        }
      }


      if (
        values.length ===
        4
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
        oahStatus ===
        "OK"

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
  // 4 VÍZÜGY FORRÁS
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
    !Number.isFinite(
      ts
    ) ||
    !Number.isFinite(
      value
    )
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
    !allowed.has(
      field
    )
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

    await ensureDB(
      env
    );


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
      .bind(
        cutoff
      )
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
            status:
              500
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


        if (
          !response.ok
        ) {

          return new Response(
            "Image not found",
            {
              status:
                404
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
            status:
              503
          }
        );
      }
    }


    // ========================================================
    // HISTORY API
    // ========================================================

    if (
      url.pathname ===
      "/api/history"
    ) {

      try {

        await ensureDB(
          env
        );


        let hours =
          Number(
            url.searchParams
              .get(
                "hours"
              ) ||
            6
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
            6;
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

               WHERE
                 ts >= ?

               ORDER BY
                 ts ASC`
            )
            .bind(
              cutoff
            )
            .all();


        return new Response(
          JSON.stringify(
            {
              ok:
                true,

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
              ok:
                false,

              version:
                VERSION,

              data:
                [],

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
    // AKTUÁLIS ADATOK
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


    // ========================================================
    // SZÖVEGEK
    // ========================================================

    const totalText =
      Number.isFinite(
        total
      )
        ? `${total} MW`
        : "— MW";


    const waterText =
      Number.isFinite(
        water
      )
        ? `${water} cm`
        : "— cm";


    const flowText =
      Number.isFinite(
        flow
      )
        ? `${fmt1(flow)} m³/s`
        : "— m³/s";


    const tempText =
      Number.isFinite(
        temp
      )
        ? `${fmt1(temp)} °C`
        : "— °C";


    const outletTempText =
      Number.isFinite(
        OUTLET_TEMP
      )
        ? `${fmt1(OUTLET_TEMP)} °C`
        : "— °C";


    const shutdownDistance =
      Number.isFinite(
        water
      )
        ? water +
          134
        : null;


    const safetyDistance =
      Number.isFinite(
        water
      )
        ? water +
          144
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


    // ========================================================
    // STÁTUSZ
    // ========================================================

    let riverClass =
      "normal";


    let riverLabel =
      "NORMÁL TARTOMÁNY";


    if (
      Number.isFinite(
        water
      )
    ) {

      if (
        water <=
        -144
      ) {

        riverClass =
          "danger";


        riverLabel =
          "KRITIKUS VÍZSZINT";


      } else if (
        water <=
        -134
      ) {

        riverClass =
          "warning";


        riverLabel =
          "LEÁLLÁSI TARTOMÁNY";


      } else if (
        water <=
        -129
      ) {

        riverClass =
          "warning";


        riverLabel =
          "FIGYELMEZTETÉS";
      }
    }


    let markerPct =
      0;


    if (
      Number.isFinite(
        water
      )
    ) {

      markerPct =
        (
          (
            -110 -
            water
          ) /
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
  content="#030812"
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


<style>

:root{

  --bg:
    #030812;

  --panel:
    #07111d;

  --panel2:
    #0c1825;

  --border:
    #1b3b57;

  --white:
    #f6f8fb;

  --muted:
    #8f9daf;

  --green:
    #66df57;

  --blue:
    #49a9ff;

  --orange:
    #ffad30;

  --red:
    #ff5c61;

  --purple:
    #bf4cff;
}


*{

  box-sizing:
    border-box;
}


html,
body{

  margin:
    0;

  width:
    100%;

  min-height:
    100%;

  overflow-x:
    hidden;

  background:
    radial-gradient(
      circle at 50% -10%,
      #0d2037 0%,
      #040b14 35%,
      #02060b 75%
    );

  color:
    var(--white);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;
}


body{

  min-height:
    100vh;
}


.app{

  width:
    min(
      100%,
      520px
    );

  margin:
    auto;

  padding:
    max(
      8px,
      env(safe-area-inset-top)
    )
    8px
    max(
      7px,
      env(safe-area-inset-bottom)
    );
}


.header{

  display:
    grid;

  grid-template-columns:
    auto 1fr auto;

  align-items:
    center;

  gap:
    8px;

  margin-bottom:
    7px;
}


.logo{

  width:
    38px;

  height:
    38px;

  border-radius:
    11px;

  display:
    grid;

  place-items:
    center;

  font-size:
    23px;

  background:
    linear-gradient(
      145deg,
      #bd53ff,
      #55117d
    );
}


.title{

  min-width:
    0;

  font-size:
    19px;

  line-height:
    1;

  font-weight:
    950;

  letter-spacing:
    -.6px;
}


.live{

  display:
    flex;

  align-items:
    center;

  gap:
    5px;

  padding:
    5px 7px;

  border-radius:
    999px;

  background:
    #0c2111;

  border:
    1px solid #275a31;

  color:
    #73e66a;

  font-size:
    8px;

  font-weight:
    900;
}


.liveDot{

  width:
    7px;

  height:
    7px;

  border-radius:
    50%;

  background:
    #73e66a;

  box-shadow:
    0 0 8px #73e66a;
}


.card{

  background:
    linear-gradient(
      145deg,
      #09131f,
      #06101a
    );

  border:
    1px solid var(--border);

  border-radius:
    16px;

  overflow:
    hidden;

  margin-bottom:
    7px;
}


.inner{

  padding:
    9px;
}


.cardTitle{

  color:
    #a5b1bf;

  font-size:
    9px;

  letter-spacing:
    .45px;

  font-weight:
    850;
}


.mainRow{

  display:
    flex;

  align-items:
    flex-end;

  justify-content:
    space-between;

  gap:
    10px;

  margin:
    4px 0 7px;
}


.big{

  font-size:
    38px;

  line-height:
    .95;

  letter-spacing:
    -1.3px;

  font-weight:
    950;
}


.power{

  color:
    var(--green);
}


.water{

  color:
    var(--blue);
}


.caption{

  padding-bottom:
    3px;

  color:
    #78879a;

  font-size:
    7px;
}


.status{

  padding-bottom:
    3px;

  font-size:
    8px;

  font-weight:
    900;
}


.normal{

  color:
    var(--green);
}


.warning{

  color:
    var(--orange);
}


.danger{

  color:
    var(--red);
}


.chartBox{

  margin-bottom:
    6px;

  padding:
    6px 6px 3px;

  background:
    #050e18;

  border:
    1px solid #132b40;

  border-radius:
    10px;
}


.chartTop{

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    5px;

  margin-bottom:
    3px;
}


.chartTitle{

  color:
    #8f9eb1;

  font-size:
    6.5px;

  font-weight:
    800;
}


.periods{

  display:
    flex;

  gap:
    2px;
}


.periodButton{

  border:
    0;

  padding:
    3px 5px;

  border-radius:
    999px;

  background:
    #111e2b;

  color:
    #8394a8;

  font-size:
    6.5px;

  font-weight:
    850;
}


.periodButton.active{

  color:
    white;

  background:
    #234663;
}


.chartWrap{

  position:
    relative;

  width:
    100%;

  height:
    86px;
}


canvas{

  display:
    block;

  width:
    100%;

  height:
    100%;
}


.blocks{

  display:
    grid;

  grid-template-columns:
    1fr 1fr;

  gap:
    5px;
}


.block{

  padding:
    6px 8px;

  background:
    var(--panel2);

  border-radius:
    9px;

  border:
    1px solid #142b3f;
}


.blockName{

  color:
    #8c9bad;

  font-size:
    7px;
}


.blockValue{

  margin-top:
    2px;

  font-size:
    16px;

  line-height:
    1;

  font-weight:
    900;
}


.metrics{

  display:
    grid;

  grid-template-columns:
    repeat(
      3,
      minmax(
        0,
        1fr
      )
    );

  gap:
    4px;
}


.metric{

  min-width:
    0;

  padding:
    6px;

  border-radius:
    8px;

  background:
    var(--panel2);
}


.metricName{

  color:
    #8c9bad;

  font-size:
    6px;

  min-height:
    14px;
}


.metricValue{

  margin-top:
    2px;

  font-size:
    13px;

  font-weight:
    900;

  white-space:
    nowrap;
}


.outletValue{

  color:
    var(--orange);
}


.tempRule{

  margin-top:
    5px;

  padding:
    5px 6px;

  border:
    1px solid #604718;

  border-radius:
    8px;

  background:
    #171209;

  color:
    #ffb641;

  text-align:
    center;

  font-size:
    6.5px;

  font-weight:
    900;
}


.gauge{

  position:
    relative;

  height:
    8px;

  border-radius:
    999px;

  margin-top:
    7px;

  background:
    linear-gradient(
      90deg,
      #52c85a 0%,
      #52c85a 60%,
      #ffad30 60%,
      #ffad30 85%,
      #ef555b 85%,
      #ef555b 100%
    );
}


.marker{

  position:
    absolute;

  left:
    ${markerPct}%;

  top:
    -5px;

  width:
    3px;

  height:
    18px;

  border-radius:
    2px;

  background:
    #fff;

  transform:
    translateX(-50%);

  box-shadow:
    0 0 6px #fff;
}


.scale{

  display:
    grid;

  grid-template-columns:
    1fr 1fr 1fr;

  margin-top:
    3px;

  font-size:
    6px;
}


.scale span:nth-child(1){

  color:
    #7e8c9d;
}


.scale span:nth-child(2){

  text-align:
    center;

  color:
    var(--orange);
}


.scale span:nth-child(3){

  text-align:
    right;

  color:
    var(--red);
}


.distances{

  display:
    grid;

  grid-template-columns:
    1fr 1fr;

  gap:
    5px;

  margin-top:
    5px;
}


.distance{

  padding:
    5px 7px;

  border-radius:
    8px;

  background:
    var(--panel2);
}


.distanceValue{

  font-size:
    12px;

  font-weight:
    950;
}


.distanceLabel{

  color:
    #78889b;

  font-size:
    5.8px;
}


.source{

  padding:
    5px 9px;

  border-top:
    1px solid #172e42;

  color:
    #718296;

  font-size:
    6.3px;
}


/* ============================================================
   V8 MOBIL HIDRAULIKAI PANEL
============================================================ */

.hydroCard{

  padding:
    7px;
}


.hydroHead{

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    8px;

  margin:
    0 2px 6px;
}


.hydroTitle{

  min-width:
    0;

  font-size:
    8px;

  font-weight:
    950;

  color:
    #d3dde8;
}


.hydroSub{

  flex:
    0 0 auto;

  color:
    #6f8296;

  font-size:
    6px;

  font-weight:
    800;
}


/*
  ÖT ADATDOBOZ EGY SORBAN.
  EZEK MÁR NEM ABSZOLÚT POZÍCIONÁLTAK.
*/

.hydroReadings{

  display:
    grid;

  grid-template-columns:
    repeat(
      5,
      minmax(
        0,
        1fr
      )
    );

  gap:
    3px;

  width:
    100%;

  margin-bottom:
    5px;
}


.hCell{

  min-width:
    0;

  padding:
    4px 3px;

  border:
    1px solid #18364e;

  border-radius:
    7px;

  background:
    #07131f;

  text-align:
    center;

  overflow:
    hidden;
}


.hCell.liftCell{

  border-color:
    #2b6e36;

  background:
    #07170b;
}


.hLab{

  min-height:
    17px;

  display:
    flex;

  align-items:
    center;

  justify-content:
    center;

  color:
    #8fa0b2;

  font-size:
    5.2px;

  line-height:
    1.05;

  font-weight:
    850;
}


.hVal{

  margin-top:
    2px;

  font-size:
    12px;

  line-height:
    1;

  font-weight:
    950;

  white-space:
    nowrap;
}


.hMbf{

  margin-top:
    2px;

  color:
    #8899aa;

  font-size:
    5.5px;

  white-space:
    nowrap;
}


.hTime{

  margin-top:
    2px;

  color:
    #5f7183;

  font-size:
    5px;

  white-space:
    nowrap;
}


.blueText{

  color:
    var(--blue);
}


.greenText{

  color:
    var(--green);
}


.orangeText{

  color:
    var(--orange);
}


.dir.up{

  color:
    var(--green);
}


.dir.down{

  color:
    var(--orange);
}


.dir.flat{

  color:
    #9ba8b7;
}


/*
  SÉMA
*/

.hydroStage{

  position:
    relative;

  width:
    100%;

  height:
    154px;

  overflow:
    hidden;

  border:
    1px solid #183a54;

  border-radius:
    11px;

  background:
    linear-gradient(
      180deg,
      #102337 0%,
      #122c44 47%,
      #372e29 47%,
      #302821 100%
    );
}


/*
  BAL OLDALI DUNA:
  ALACSONYABB SZINT.
*/

.riverWater{

  position:
    absolute;

  left:
    0;

  top:
    72px;

  width:
    34%;

  height:
    47px;

  background:
    linear-gradient(
      180deg,
      #248bce,
      #12659d
    );

  border-top:
    2px solid #64c4ff;
}


/*
  EMELKEDŐ TÖRÉS:
  A DUNA FŐÁGTÓL JOBBRA,
  AZ ERŐMŰ/HVCS FELÉ FELJEBB KERÜL A VÍZ.
*/

.riseWater{

  position:
    absolute;

  left:
    32%;

  top:
    60px;

  width:
    19%;

  height:
    59px;

  background:
    linear-gradient(
      180deg,
      #278fd0,
      #14669c
    );

  clip-path:
    polygon(
      0 20%,
      100% 0,
      100% 100%,
      0 100%
    );

  border-top:
    0;
}


.riseLine{

  position:
    absolute;

  left:
    32%;

  top:
    66px;

  width:
    20%;

  height:
    2px;

  background:
    #65c5ff;

  transform:
    rotate(
      -8deg
    );

  transform-origin:
    left center;

  box-shadow:
    0 0 7px
    rgba(
      73,
      169,
      255,
      .7
    );
}


/*
  FELVÍZ / HIDEGVÍZ-CSATORNA:
  MAGASABB VÍZSZINT.
*/

.upWater{

  position:
    absolute;

  left:
    49%;

  right:
    0;

  top:
    60px;

  height:
    59px;

  background:
    linear-gradient(
      180deg,
      #278fd0,
      #14669c
    );

  border-top:
    2px solid #65c5ff;
}


/*
  MEDER
*/

.riverBed{

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    119px;

  bottom:
    0;

  background:
    linear-gradient(
      180deg,
      #4a3a2c,
      #2e251f
    );

  border-top:
    2px solid #5d4c3d;
}


/*
  FENÉKKÜSZÖB KÖVEKBŐL
*/

.threshold{

  position:
    absolute;

  z-index:
    4;

  left:
    43%;

  top:
    88px;

  width:
    15%;

  height:
    38px;

  background:
    radial-gradient(
      circle at 12% 78%,
      #777b7d 0 7px,
      transparent 8px
    ),
    radial-gradient(
      circle at 30% 45%,
      #96999b 0 7px,
      transparent 8px
    ),
    radial-gradient(
      circle at 47% 70%,
      #626668 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 65% 35%,
      #888c8f 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 83% 70%,
      #6a6e70 0 7px,
      transparent 8px
    ),
    #44484a;

  border-radius:
    50% 50% 8px 8px;

  border-bottom:
    2px solid #303437;
}


.thresholdLabel{

  position:
    absolute;

  z-index:
    7;

  left:
    41%;

  top:
    122px;

  width:
    19%;

  text-align:
    center;

  color:
    #b2bac2;

  font-size:
    5.5px;

  font-weight:
    900;
}


/*
  LEÁLLÁSI SZINT
*/

.shutdownLine{

  position:
    absolute;

  z-index:
    5;

  left:
    2%;

  right:
    2%;

  top:
    111px;

  border-top:
    2px dashed var(--red);
}


.shutdownText{

  position:
    absolute;

  z-index:
    8;

  left:
    2%;

  top:
    113px;

  color:
    var(--red);

  font-size:
    5.7px;

  font-weight:
    950;
}


/*
  HIDEGVÍZ-CSATORNA BEÖMLÉS
*/

.channelGate{

  position:
    absolute;

  z-index:
    5;

  left:
    62%;

  top:
    70px;

  width:
    13px;

  height:
    49px;

  border:
    2px solid #92a1ad;

  background:
    repeating-linear-gradient(
      90deg,
      #253947 0 2px,
      #8e9ba6 2px 4px
    );
}


.channelLabel{

  position:
    absolute;

  z-index:
    7;

  left:
    58%;

  top:
    126px;

  width:
    23%;

  text-align:
    center;

  color:
    #86cfff;

  font-size:
    5.2px;

  font-weight:
    900;
}


/*
  KÉT SZIVATTYÚ
*/

.pump{

  position:
    absolute;

  z-index:
    6;

  top:
    62px;

  width:
    12px;

  height:
    62px;

  border-left:
    5px solid #929da6;

  border-radius:
    5px;
}


.pump:before{

  content:
    "";

  position:
    absolute;

  left:
    -8px;

  top:
    -5px;

  width:
    15px;

  height:
    11px;

  border-radius:
    4px;

  background:
    #919ba4;
}


.pump:after{

  content:
    "";

  position:
    absolute;

  left:
    -9px;

  bottom:
    -6px;

  width:
    16px;

  height:
    16px;

  border-radius:
    50%;

  background:
    #69747c;

  border:
    2px solid #333c43;
}


.pump1{

  left:
    74%;
}


.pump2{

  left:
    79%;
}


/*
  SZIVATTYÚ TARTALÉK
*/

.reserveBadge{

  position:
    absolute;

  z-index:
    9;

  left:
    68%;

  top:
    8px;

  width:
    22%;

  padding:
    5px 3px;

  border:
    1px solid #347843;

  border-radius:
    8px;

  background:
    rgba(
      4,
      24,
      11,
      .94
    );

  text-align:
    center;
}


.reserveTitle{

  color:
    #a9b9ae;

  font-size:
    5px;

  font-weight:
    800;
}


.reserveValue{

  margin-top:
    1px;

  color:
    var(--green);

  font-size:
    17px;

  line-height:
    1;

  font-weight:
    950;
}


.reserveSub{

  margin-top:
    2px;

  color:
    #6f8d78;

  font-size:
    4.8px;

  line-height:
    1.05;
}


/*
  ERŐMŰ
*/

.plant{

  position:
    absolute;

  z-index:
    5;

  right:
    2%;

  top:
    52px;

  width:
    55px;

  height:
    68px;

  border:
    1px solid #85939e;

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

  content:
    "";

  position:
    absolute;

  left:
    11px;

  top:
    -22px;

  width:
    32px;

  height:
    25px;

  border:
    1px solid #8e999f;

  border-radius:
    50% 50% 0 0;

  background:
    #5d6870;
}


.plantName{

  position:
    absolute;

  left:
    3px;

  right:
    3px;

  top:
    16px;

  text-align:
    center;

  color:
    #eef3f7;

  font-size:
    5.6px;

  line-height:
    1.05;

  font-weight:
    900;
}


.plantMw{

  position:
    absolute;

  left:
    2px;

  right:
    2px;

  bottom:
    8px;

  text-align:
    center;

  color:
    var(--green);

  font-size:
    11px;

  font-weight:
    950;
}


/*
  FOLYÁSIRÁNYT MUTATÓ NYILAK
*/

.flow{

  position:
    absolute;

  z-index:
    6;

  color:
    #75c9ff;

  font-size:
    16px;

  font-weight:
    950;

  opacity:
    .85;
}


.flow1{

  left:
    18%;

  top:
    80px;
}


.flow2{

  left:
    57%;

  top:
    74px;
}


.flow3{

  left:
    68%;

  top:
    78px;
}


/*
  DUZZASZTÁS FELIRAT A TÖRÉSNÉL
*/

.riseBadge{

  position:
    absolute;

  z-index:
    9;

  left:
    34%;

  top:
    18px;

  width:
    29%;

  padding:
    4px;

  border:
    1px solid #32733d;

  border-radius:
    8px;

  background:
    rgba(
      5,
      22,
      9,
      .94
    );

  text-align:
    center;
}


.riseSmall{

  color:
    #8fa997;

  font-size:
    4.9px;

  font-weight:
    850;
}


.riseBig{

  color:
    var(--green);

  font-size:
    17px;

  line-height:
    1;

  font-weight:
    950;

  margin-top:
    1px;
}


/*
  KIS DUZZASZTÁS GRAFIKON
*/

.upliftBox{

  margin-top:
    5px;

  display:
    grid;

  grid-template-columns:
    86px 1fr;

  gap:
    5px;

  align-items:
    stretch;
}


.upliftInfo{

  min-width:
    0;

  padding:
    6px;

  border:
    1px solid #254f2c;

  border-radius:
    9px;

  background:
    #07150a;
}


.upliftLabel{

  color:
    #829888;

  font-size:
    5.6px;

  font-weight:
    850;
}


.upliftNow{

  margin-top:
    2px;

  color:
    var(--green);

  font-size:
    18px;

  font-weight:
    950;
}


.upliftFormula{

  margin-top:
    2px;

  color:
    #64766a;

  font-size:
    5px;
}


.upliftChartShell{

  min-width:
    0;

  height:
    58px;

  padding:
    4px;

  border:
    1px solid #16324a;

  border-radius:
    9px;

  background:
    #050e18;
}


#upliftChart{

  width:
    100%;

  height:
    100%;
}


/*
  ALSÓ RÉSZ
*/

.bottom{

  display:
    grid;

  grid-template-columns:
    .55fr 1.55fr;

  gap:
    5px;
}


.signature{

  display:
    grid;

  place-items:
    center;

  min-height:
    41px;

  border:
    1px solid #3e2255;

  border-radius:
    10px;

  background:
    #100817;

  color:
    var(--purple);

  font-size:
    11px;

  font-weight:
    950;

  letter-spacing:
    2px;
}


.share{

  min-width:
    0;

  border:
    1px solid #17334a;

  border-radius:
    10px;

  background:
    #07111c;

  padding:
    5px;
}


.shareTitle{

  color:
    #8494a7;

  font-size:
    6.5px;

  margin-bottom:
    3px;
}


.shareRow{

  display:
    grid;

  grid-template-columns:
    1fr 55px;

  gap:
    4px;
}


.url{

  min-width:
    0;

  height:
    24px;

  display:
    flex;

  align-items:
    center;

  padding:
    0 6px;

  border:
    1px solid #9e38cf;

  border-radius:
    7px;

  background:
    #180b20;

  color:
    #d353ff;

  font-size:
    6px;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;

  text-decoration:
    none;
}


.copy{

  height:
    24px;

  border:
    0;

  border-radius:
    7px;

  background:
    #142130;

  color:
    white;

  font-size:
    6.5px;

  font-weight:
    900;
}


.version{

  margin-top:
    5px;

  text-align:
    center;

  color:
    #405268;

  font-size:
    5.5px;

  letter-spacing:
    1px;
}


.toast{

  position:
    fixed;

  left:
    50%;

  bottom:
    20px;

  transform:
    translateX(-50%)
    translateY(10px);

  opacity:
    0;

  padding:
    7px 12px;

  border-radius:
    999px;

  background:
    #102819;

  border:
    1px solid #347b41;

  color:
    #7bea70;

  font-size:
    10px;

  font-weight:
    850;

  transition:
    .2s;

  pointer-events:
    none;
}


.toast.show{

  opacity:
    1;

  transform:
    translateX(-50%)
    translateY(0);
}


@media(
  min-width:
  800px
){

  .app{

    width:
      min(
        1200px,
        96vw
      );
  }


  .cards{

    display:
      grid;

    grid-template-columns:
      1fr 1fr;

    gap:
      12px;
  }


  .card{

    margin-bottom:
      8px;
  }


  .chartWrap{

    height:
      170px;
  }


  .big{

    font-size:
      68px;
  }


  .hydroStage{

    height:
      230px;
  }


  .riverWater{

    top:
      111px;

    height:
      72px;
  }


  .riseWater{

    top:
      91px;

    height:
      92px;
  }


  .riseLine{

    top:
      100px;
  }


  .upWater{

    top:
      91px;

    height:
      92px;
  }


  .riverBed{

    top:
      183px;
  }


  .threshold{

    top:
      135px;

    height:
      58px;
  }


  .thresholdLabel{

    top:
      196px;
  }


  .shutdownLine{

    top:
      171px;
  }


  .shutdownText{

    top:
      174px;
  }


  .channelGate{

    top:
      105px;

    height:
      78px;
  }


  .channelLabel{

    top:
      195px;
  }


  .pump{

    top:
      98px;

    height:
      90px;
  }


  .plant{

    top:
      83px;

    width:
      78px;

    height:
      100px;
  }


  .plant:before{

    left:
      15px;

    width:
      46px;

    height:
      34px;

    top:
      -31px;
  }


  .plantName{

    font-size:
      8px;
  }


  .plantMw{

    font-size:
      16px;
  }


  .hVal{

    font-size:
      17px;
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

      <span class="liveDot"></span>

      ÉLŐ

    </div>


  </div>


  <div class="cards">


    <!-- ===================================================
         PAKS
    ==================================================== -->


    <div class="card">


      <div class="inner">


        <div class="cardTitle">
          PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
        </div>


        <div class="mainRow">


          <div class="big power">
            ${totalText}
          </div>


          <div class="caption">
            ÖSSZTELJESÍTMÉNY
          </div>


        </div>


        <div class="chartBox">


          <div class="chartTop">


            <div class="chartTitle">
              TELJESÍTMÉNY VÁLTOZÁSA • MW
            </div>


            <div class="periods">


              <button
                class="periodButton active"
                data-chart="power"
                data-hours="6"
              >
                6 ÓRA
              </button>


              <button
                class="periodButton"
                data-chart="power"
                data-hours="24"
              >
                24 ÓRA
              </button>


              <button
                class="periodButton"
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



    <!-- ===================================================
         DUNA
    ==================================================== -->


    <div class="card">


      <div class="inner">


        <div class="cardTitle">
          🌊 DUNA VÍZÁLLÁSA PAKSNÁL
        </div>


        <div class="mainRow">


          <div class="big water">
            ${waterText}
          </div>


          <div
            class="status ${riverClass}"
          >
            ${riverLabel}
          </div>


        </div>


        <div class="chartBox">


          <div class="chartTop">


            <div class="chartTitle">
              VÍZÁLLÁS VÁLTOZÁSA • CM
            </div>


            <div class="periods">


              <button
                class="periodButton active"
                data-chart="water"
                data-hours="6"
              >
                6 ÓRA
              </button>


              <button
                class="periodButton"
                data-chart="water"
                data-hours="24"
              >
                24 ÓRA
              </button>


              <button
                class="periodButton"
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
              KILÉPŐ VÍZ HŐ<br>HŐCSÓVA ELEJÉN
            </div>


            <div
              class="metricValue outletValue"
            >
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


        <div class="distances">


          <div class="distance">


            <div class="distanceValue">

              ${
                Number.isFinite(
                  shutdownDistance
                )
                  ? shutdownDistance +
                    " cm"
                  : "—"
              }

            </div>


            <div class="distanceLabel">
              −134 CM KÜSZÖBIG
            </div>


          </div>



          <div class="distance">


            <div class="distanceValue">

              ${
                Number.isFinite(
                  safetyDistance
                )
                  ? safetyDistance +
                    " cm"
                  : "—"
              }

            </div>


            <div class="distanceLabel">
              −144 CM HATÁRIG
            </div>


          </div>


        </div>


      </div>


      <div class="source">

        VÍZÜGY •

        ${shortTime(riverTime)}

        &nbsp; • &nbsp;

        KILÉPŐ VÍZ: MVM

      </div>


    </div>


  </div>



  <!-- =====================================================
       V8 HIDRAULIKAI PANEL
  ====================================================== -->


  <div class="card hydroCard">


    <div class="hydroHead">


      <div class="hydroTitle">

        DUNA → FENÉKKÜSZÖB → HŰTŐVÍZ → ERŐMŰ

      </div>


      <div class="hydroSub">

        VÍZÜGY ÉLŐ

      </div>


    </div>



    <!-- ===================================================
         MÉRÉSI ADATOK
    ==================================================== -->


    <div class="hydroReadings">


      <div class="hCell">


        <div class="hLab">
          DUNA<br>PAKS
        </div>


        <div class="hVal blueText">

          ${
            Number.isFinite(
              water
            )
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


        <div class="hMbf">

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


        <div class="hTime">

          ${shortTime(riverTime)}

        </div>


      </div>



      <div class="hCell">


        <div class="hLab">
          KÜSZÖB<br>FELVÍZ
        </div>


        <div class="hVal greenText">

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


        <div class="hMbf">

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


        <div class="hTime">

          ${shortTime(
            thresholdUpTime
          )}

        </div>


      </div>



      <div class="hCell liftCell">


        <div class="hLab">
          DUZZASZTÁS<br>EREDMÉNYE
        </div>


        <div class="hVal greenText">

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


        <div class="hMbf">

          FELVÍZ − ALVÍZ

        </div>


        <div class="hTime">

          ÉLŐ

        </div>


      </div>



      <div class="hCell">


        <div class="hLab">
          KÜSZÖB<br>ALVÍZ
        </div>


        <div class="hVal blueText">

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


        <div class="hMbf">

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


        <div class="hTime">

          ${shortTime(
            thresholdDownTime
          )}

        </div>


      </div>



      <div class="hCell">


        <div class="hLab">
          HIDEGVÍZ<br>ÖBLÖZET
        </div>


        <div class="hVal blueText">

          ${
            Number.isFinite(
              hvcs
            )
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


        <div class="hMbf">

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


        <div class="hTime">

          ${shortTime(
            hvcsTime
          )}

        </div>


      </div>


    </div>



    <!-- ===================================================
         SEMATIKUS ÁBRA
    ==================================================== -->


    <div class="hydroStage">


      <div class="riverWater"></div>

      <div class="riseWater"></div>

      <div class="riseLine"></div>

      <div class="upWater"></div>

      <div class="riverBed"></div>


      <div class="threshold"></div>


      <div class="thresholdLabel">
        KÖVES<br>FENÉKKÜSZÖB
      </div>


      <div class="shutdownLine"></div>


      <div class="shutdownText">
        −144 cm • LEÁLLÁSI SZINT
      </div>


      <div class="channelGate"></div>


      <div class="channelLabel">
        HIDEGVÍZ-CSATORNA
      </div>


      <div class="pump pump1"></div>

      <div class="pump pump2"></div>


      <div class="reserveBadge">


        <div class="reserveTitle">
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


      <div class="riseBadge">


        <div class="riseSmall">
          DUZZASZTÁS
        </div>


        <div class="riseBig">

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


      <div class="plant">


        <div class="plantName">
          PAKSI<br>
          ATOMERŐMŰ
        </div>


        <div class="plantMw">

          ${
            Number.isFinite(
              total
            )
              ? total +
                " MW"
              : "— MW"
          }

        </div>


      </div>


      <div class="flow flow1">
        →
      </div>


      <div class="flow flow2">
        →
      </div>


      <div class="flow flow3">
        →
      </div>


    </div>



    <!-- ===================================================
         DUZZASZTÁS GRAFIKON
    ==================================================== -->


    <div class="upliftBox">


      <div class="upliftInfo">


        <div class="upliftLabel">
          DUZZASZTÁS
        </div>


        <div class="upliftNow">

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


        <div class="upliftFormula">
          FELVÍZ − ALVÍZ
        </div>


      </div>


      <div class="upliftChartShell">

        <canvas
          id="upliftChart"
        ></canvas>

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
       ALSÓ SÁV
  ====================================================== -->


  <div class="bottom">


    <div class="signature">

      IGLÓDI

    </div>


    <div class="share">


      <div class="shareTitle">

        🔗 PARANCSIKON / MEGOSZTÁS

      </div>


      <div class="shareRow">


        <a
          class="url"
          href="${PUBLIC_URL}"
        >

          ${PUBLIC_URL}

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


  <div class="version">

    ${VERSION}

  </div>


</div>



<div
  id="toast"
  class="toast"
>

  Link másolva

</div>



<script>


const PUBLIC_URL =
  "${PUBLIC_URL}";


let selectedRange = {

  power:
    6,

  water:
    6
};


let cache =
  {};


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
    cache[
      hours
    ]
  ) {

    return cache[
      hours
    ];
  }


  const data =
    await getHistory(
      hours
    );


  cache[
    hours
  ] =
    data;


  return data;
}


// ============================================================
// FŐ GRAFIKON
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


  if (
    !canvas
  ) {

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
          row[
            field
          ] !== null &&
          row[
            field
          ] !== undefined
      )
      .map(
        row => ({

          x:
            Number(
              row.ts
            ),

          y:
            Number(
              row[
                field
              ]
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
        (
          a,
          b
        ) =>
          a.x -
          b.x
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

    left:
      38,

    right:
      8,

    top:
      8,

    bottom:
      20
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


  ctx.lineWidth =
    1;


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
      W -
      pad.right,
      y
    );


    ctx.stroke();
  }


  if (
    data.length ===
    0
  ) {

    ctx.fillStyle =
      "#718397";


    ctx.font =
      "10px -apple-system";


    ctx.textAlign =
      "left";


    ctx.fillText(
      "Új valódi mérésre várunk…",
      pad.left +
      8,
      H /
      2
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
    minY ===
    maxY
  ) {

    const delta =
      field ===
      "water"

        ? 2

        : Math.max(
            1,
            Math.abs(
              minY
            ) *
            .02
          );


    minY -=
      delta;


    maxY +=
      delta;
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


  minY -=
    margin;


  maxY +=
    margin;


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
      Math.round(
        value
      ) +
      " " +
      unit,

      pad.left -
      4,

      y +
      3
    );
  }


  ctx.textAlign =
    "center";


  const divisions =
    hours >=
    240

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
              month:
                "2-digit",

              day:
                "2-digit"
            }
          )

        : date.toLocaleTimeString(
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
      sx(
        timestamp
      ),
      H -
      5
    );
  }


  const lineColor =
    field ===
    "power"

      ? "#66df57"

      : "#49a9ff";


  ctx.strokeStyle =
    lineColor;


  ctx.fillStyle =
    lineColor;


  ctx.lineWidth =
    2.2;


  ctx.lineJoin =
    field ===
    "water"

      ? "miter"

      : "round";


  ctx.lineCap =
    field ===
    "water"

      ? "butt"

      : "round";


  if (
    data.length ===
    1
  ) {

    const point =
      data[0];


    ctx.beginPath();


    ctx.moveTo(
      Math.max(
        pad.left,
        sx(
          point.x
        )
      ),
      sy(
        point.y
      )
    );


    ctx.lineTo(
      sx(
        maxX
      ),
      sy(
        point.y
      )
    );


    ctx.stroke();


    ctx.beginPath();


    ctx.arc(
      sx(
        maxX
      ),
      sy(
        point.y
      ),
      3.5,
      0,
      Math.PI *
      2
    );


    ctx.fill();


    return;
  }


  ctx.beginPath();


  if (
    field ===
    "water"
  ) {

    const first =
      data[0];


    let firstX =
      sx(
        first.x
      );


    if (
      firstX <
      pad.left
    ) {

      firstX =
        pad.left;
    }


    ctx.moveTo(
      firstX,
      sy(
        first.y
      )
    );


    for (
      let i = 1;
      i <
      data.length;
      i++
    ) {

      const previous =
        data[
          i -
          1
        ];


      const current =
        data[i];


      const currentX =
        sx(
          current.x
        );


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
        sy(
          previous.y
        )
      );


      ctx.lineTo(
        currentX,
        sy(
          current.y
        )
      );
    }


    const last =
      data[
        data.length -
        1
      ];


    ctx.lineTo(
      sx(
        maxX
      ),
      sy(
        last.y
      )
    );


  } else {


    data.forEach(
      (
        point,
        index
      ) => {

        const x =
          sx(
            point.x
          );


        const y =
          sy(
            point.y
          );


        if (
          index ===
          0
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
      data.length -
      1
    ];


  ctx.beginPath();


  ctx.arc(

    field ===
    "water"

      ? sx(
          maxX
        )

      : sx(
          last.x
        ),

    sy(
      last.y
    ),

    3.5,

    0,

    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// DUZZASZTÁS GRAFIKON
// ============================================================

async function drawUpliftChart() {

  const canvas =
    document.getElementById(
      "upliftChart"
    );


  if (!canvas) {

    return;
  }


  const rows =
    await loadHistory(
      24
    );


  const points =
    rows
      .filter(
        row =>
          row.threshold_up !==
          null &&
          row.threshold_up !==
          undefined &&
          row.threshold_down !==
          null &&
          row.threshold_down !==
          undefined
      )
      .map(
        row => ({

          x:
            Number(
              row.ts
            ),

          y:
            Number(
              row.threshold_up
            ) -
            Number(
              row.threshold_down
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
        (
          a,
          b
        ) =>
          a.x -
          b.x
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


  ctx.strokeStyle =
    "rgba(100,140,165,.15)";


  ctx.lineWidth =
    1;


  for (
    let i = 1;
    i <= 2;
    i++
  ) {

    const y =
      H *
      i /
      3;


    ctx.beginPath();

    ctx.moveTo(
      0,
      y
    );

    ctx.lineTo(
      W,
      y
    );

    ctx.stroke();
  }


  if (
    points.length ===
    0
  ) {

    ctx.fillStyle =
      "#64778a";


    ctx.font =
      "7px -apple-system";


    ctx.fillText(
      "Duzzasztási adatsorra várunk…",
      7,
      H /
      2
    );


    return;
  }


  let minY =
    Math.min(
      ...points.map(
        p =>
          p.y
      )
    );


  let maxY =
    Math.max(
      ...points.map(
        p =>
          p.y
      )
    );


  if (
    minY ===
    maxY
  ) {

    minY -=
      1;


    maxY +=
      1;
  }


  const yMargin =
    Math.max(
      1,
      (
        maxY -
        minY
      ) *
      .25
    );


  minY -=
    yMargin;


  maxY +=
    yMargin;


  const maxX =
    Date.now();


  const minX =
    maxX -
    24 *
    60 *
    60 *
    1000;


  const sx =
    x =>
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
      W;


  const sy =
    y =>
      4 +
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
      (
        H -
        10
      );


  ctx.strokeStyle =
    "#66df57";


  ctx.fillStyle =
    "#66df57";


  ctx.lineWidth =
    2;


  ctx.lineJoin =
    "round";


  ctx.lineCap =
    "round";


  ctx.beginPath();


  points.forEach(
    (
      point,
      index
    ) => {

      const x =
        sx(
          point.x
        );


      const y =
        sy(
          point.y
        );


      if (
        index ===
        0
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
    points[
      points.length -
      1
    ];


  ctx.beginPath();


  ctx.arc(
    sx(
      last.x
    ),
    sy(
      last.y
    ),
    2.8,
    0,
    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// ÚJRARAJZOLÁS
// ============================================================

async function redraw() {

  cache =
    {};


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
      ),

      drawUpliftChart()

    ]
  );
}


// ============================================================
// IDŐTARTOMÁNY
// ============================================================

function setRange(
  chart,
  hours,
  button
) {

  selectedRange[
    chart
  ] =
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
          .remove(
            "active"
          )
    );


  button
    .classList
    .add(
      "active"
    );


  cache =
    {};


  if (
    chart ===
    "power"
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


// ============================================================
// GOMBOK
// ============================================================

document
  .querySelectorAll(
    ".periodButton"
  )
  .forEach(
    button => {

      button.addEventListener(
        "click",
        () => {

          setRange(

            button
              .dataset
              .chart,

            Number(
              button
                .dataset
                .hours
            ),

            button
          );
        }
      );
    }
  );


// ============================================================
// LINK MÁSOLÁS
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
          .add(
            "show"
          );


        setTimeout(
          () =>
            toast
              .classList
              .remove(
                "show"
              ),
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
// INDÍTÁS
// ============================================================

redraw();


window.addEventListener(
  "resize",
  () => {

    clearTimeout(
      window
        .__resizeTimer
    );


    window
      .__resizeTimer =
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
        status:
          200,

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
