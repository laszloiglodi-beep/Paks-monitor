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
  "PAKS MONITOR V7";


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
              "Mozilla/5.0 (compatible; PaksMonitor/7.0)"
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
              "Mozilla/5.0 (compatible; PaksMonitor/7.0)"
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


    // ========================================================
    // HTML
    // ========================================================

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
    9px
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
    40px;

  height:
    40px;

  border-radius:
    12px;

  display:
    grid;

  place-items:
    center;

  font-size:
    24px;

  background:
    linear-gradient(
      145deg,
      #bd53ff,
      #55117d
    );
}


.title{

  font-size:
    20px;

  line-height:
    .98;

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
    5px 8px;

  border-radius:
    999px;

  background:
    #0c2111;

  border:
    1px solid #275a31;

  color:
    #73e66a;

  font-size:
    9px;

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
    17px;

  overflow:
    hidden;

  margin-bottom:
    7px;
}


.inner{

  padding:
    10px;
}


.cardTitle{

  color:
    #a5b1bf;

  font-size:
    10px;

  letter-spacing:
    .55px;

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
    40px;

  line-height:
    .95;

  letter-spacing:
    -1.5px;

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
    8px;
}


.status{

  padding-bottom:
    3px;

  font-size:
    9px;

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
    7px;

  padding:
    7px 7px 4px;

  background:
    #050e18;

  border:
    1px solid #132b40;

  border-radius:
    11px;
}


.chartTop{

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  gap:
    6px;

  margin-bottom:
    4px;
}


.chartTitle{

  color:
    #8f9eb1;

  font-size:
    7px;

  font-weight:
    800;
}


.periods{

  display:
    flex;

  gap:
    3px;
}


.periodButton{

  border:
    0;

  padding:
    3px 6px;

  border-radius:
    999px;

  background:
    #111e2b;

  color:
    #8394a8;

  font-size:
    7px;

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
    92px;
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
    17px;

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
      1fr
    );

  gap:
    5px;
}


.metric{

  min-width:
    0;

  padding:
    6px 7px;

  border-radius:
    9px;

  background:
    var(--panel2);
}


.metricName{

  color:
    #8c9bad;

  font-size:
    6.5px;

  white-space:
    nowrap;
}


.metricValue{

  margin-top:
    2px;

  font-size:
    14px;

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
    5px 7px;

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
    7px;

  font-weight:
    900;
}


.gauge{

  position:
    relative;

  height:
    9px;

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
    19px;

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
    7px;
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
    9px;

  background:
    var(--panel2);
}


.distanceValue{

  font-size:
    13px;

  font-weight:
    950;
}


.distanceLabel{

  color:
    #78889b;

  font-size:
    6px;
}


.source{

  padding:
    5px 10px;

  border-top:
    1px solid #172e42;

  color:
    #718296;

  font-size:
    7px;
}


/* ============================================================
   ÚJ ALSÓ ÉLŐ SÉMA
============================================================ */

.hydroCard{

  padding:
    8px;
}


.hydroHead{

  display:
    flex;

  align-items:
    center;

  justify-content:
    space-between;

  margin-bottom:
    6px;
}


.hydroTitle{

  font-size:
    10px;

  font-weight:
    900;

  color:
    #c4d0dd;

  letter-spacing:
    .5px;
}


.hydroSub{

  font-size:
    6.5px;

  color:
    #718296;
}


.hydroStage{

  position:
    relative;

  height:
    245px;

  overflow:
    hidden;

  border-radius:
    13px;

  background:
    linear-gradient(
      #142b42 0 47%,
      #1d78b8 47% 75%,
      #3b2f25 75% 100%
    );

  border:
    1px solid #173750;
}


.skyGlow{

  position:
    absolute;

  inset:
    0;

  background:
    linear-gradient(
      180deg,
      rgba(
        70,
        140,
        200,
        .08
      ),
      transparent 42%
    );
}


.waterLine{

  position:
    absolute;

  left:
    0;

  right:
    0;

  top:
    47%;

  height:
    2px;

  background:
    #58bcff;

  box-shadow:
    0 0 6px
    rgba(
      73,
      169,
      255,
      .7
    );
}


.waterBreak{

  position:
    absolute;

  left:
    22%;

  top:
    47%;

  width:
    18%;

  height:
    16px;

  border-top:
    3px solid #58bcff;

  border-right:
    3px solid #58bcff;

  transform:
    translateY(
      -13px
    )
    skewY(
      -8deg
    );
}


.breakLabel{

  position:
    absolute;

  left:
    25%;

  top:
    39%;

  font-size:
    6px;

  color:
    #a8d9ff;

  font-weight:
    900;

  background:
    rgba(
      4,
      12,
      20,
      .78
    );

  padding:
    2px 5px;

  border-radius:
    999px;
}


.threshold{

  position:
    absolute;

  left:
    39%;

  bottom:
    25%;

  width:
    14%;

  height:
    74px;

  background:
    radial-gradient(
      circle at 20% 20%,
      #8b8d90 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 55% 35%,
      #6f7175 0 10px,
      transparent 11px
    ),
    radial-gradient(
      circle at 80% 70%,
      #919397 0 8px,
      transparent 9px
    ),
    radial-gradient(
      circle at 35% 75%,
      #696b6e 0 9px,
      transparent 10px
    ),
    #45484c;

  border-radius:
    42% 42% 5px 5px;

  box-shadow:
    0 0 0 2px
    #2a2d31 inset;
}


.threshold:after{

  content:
    "";

  position:
    absolute;

  left:
    -8px;

  right:
    -8px;

  bottom:
    -5px;

  height:
    14px;

  background:
    #383b3f;

  border-radius:
    50%;
}


.rack{

  position:
    absolute;

  left:
    67%;

  bottom:
    25%;

  width:
    26px;

  height:
    75px;

  border:
    2px solid #7f8b96;

  background:
    repeating-linear-gradient(
      90deg,
      #263847 0 3px,
      #9aa6b1 3px 5px
    );
}


.pump{

  position:
    absolute;

  bottom:
    24%;

  width:
    32px;

  height:
    115px;

  border-left:
    8px solid #7d8790;

  border-radius:
    7px;
}


.pump:before{

  content:
    "";

  position:
    absolute;

  left:
    -14px;

  top:
    -8px;

  width:
    24px;

  height:
    18px;

  border-radius:
    7px;

  background:
    #89939b;
}


.pump:after{

  content:
    "";

  position:
    absolute;

  left:
    -14px;

  bottom:
    -9px;

  width:
    24px;

  height:
    24px;

  border-radius:
    50%;

  background:
    #66717b;

  border:
    3px solid #313940;
}


.p1{

  left:
    77%;
}


.p2{

  left:
    84%;
}


.plant{

  position:
    absolute;

  right:
    2%;

  bottom:
    25%;

  width:
    74px;

  height:
    94px;

  border-radius:
    10px 10px 3px 3px;

  background:
    linear-gradient(
      145deg,
      #68717a,
      #343b42
    );

  border:
    1px solid #8a939b;

  box-shadow:
    0 0 15px
    rgba(
      90,
      220,
      90,
      .08
    );
}


.plant:before{

  content:
    "";

  position:
    absolute;

  left:
    14px;

  top:
    -36px;

  width:
    46px;

  height:
    42px;

  border-radius:
    50% 50% 0 0;

  background:
    #59626b;

  border:
    1px solid #8b949d;
}


.plantText{

  position:
    absolute;

  left:
    7px;

  right:
    7px;

  top:
    31px;

  text-align:
    center;

  font-size:
    8px;

  font-weight:
    900;
}


.mwNow{

  position:
    absolute;

  left:
    7px;

  right:
    7px;

  bottom:
    9px;

  text-align:
    center;

  color:
    var(--green);

  font-size:
    15px;

  font-weight:
    950;
}


.flowArrow{

  position:
    absolute;

  color:
    #65bdff;

  font-size:
    19px;

  font-weight:
    950;
}


.a1{

  left:
    15%;

  top:
    58%;
}


.a2{

  left:
    56%;

  top:
    58%;
}


.a3{

  left:
    72%;

  top:
    60%;
}


.reading{

  position:
    absolute;

  z-index:
    5;

  min-width:
    93px;

  padding:
    6px 7px;

  border-radius:
    8px;

  background:
    rgba(
      4,
      12,
      20,
      .88
    );

  border:
    1px solid #1b3b57;

  box-shadow:
    0 4px 18px
    rgba(
      0,
      0,
      0,
      .24
    );
}


.reading .lab{

  font-size:
    6px;

  color:
    #93a2b4;

  font-weight:
    800;
}


.reading .val{

  font-size:
    15px;

  font-weight:
    950;

  margin-top:
    1px;
}


.reading .sub{

  font-size:
    7px;

  color:
    #d6dce3;

  margin-top:
    2px;
}


.reading .tm{

  font-size:
    6px;

  color:
    #77879a;

  margin-top:
    2px;
}


.rRiver{

  left:
    3%;

  top:
    9%;
}


.rUp{

  left:
    24%;

  top:
    4%;
}


.rLift{

  left:
    43%;

  top:
    4%;

  border-color:
    #2f6e36;
}


.rDown{

  left:
    54%;

  top:
    8%;
}


.rHvcs{

  left:
    68%;

  top:
    5%;
}


.blueVal{

  color:
    var(--blue);
}


.greenVal{

  color:
    var(--green);
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


.redLine{

  position:
    absolute;

  left:
    2%;

  right:
    2%;

  top:
    68%;

  border-top:
    2px dashed
    var(--red);

  opacity:
    .88;
}


.redLabel{

  position:
    absolute;

  left:
    4%;

  top:
    69%;

  color:
    var(--red);

  font-size:
    7px;

  font-weight:
    950;
}


.pumpPanel{

  position:
    absolute;

  right:
    1.5%;

  bottom:
    2%;

  z-index:
    6;

  width:
    150px;

  padding:
    7px;

  border-radius:
    9px;

  background:
    rgba(
      4,
      16,
      10,
      .93
    );

  border:
    1px solid #2f6e36;
}


.pumpPanel .pv{

  font-size:
    18px;

  font-weight:
    950;

  color:
    var(--green);
}


.pumpPanel .mbf{

  font-size:
    11px;

  font-weight:
    900;

  color:
    #5bb5ff;
}


.pumpPanel .tiny{

  font-size:
    6px;

  color:
    #b8c3cd;

  margin-top:
    2px;
}


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
    43px;

  border:
    1px solid #3e2255;

  border-radius:
    11px;

  background:
    #100817;

  color:
    var(--purple);

  font-size:
    12px;

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
    11px;

  background:
    #07111c;

  padding:
    5px;
}


.shareTitle{

  color:
    #8494a7;

  font-size:
    7px;

  margin-bottom:
    3px;
}


.shareRow{

  display:
    grid;

  grid-template-columns:
    1fr 57px;

  gap:
    4px;
}


.url{

  min-width:
    0;

  height:
    25px;

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
    6.5px;

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
    25px;

  border:
    0;

  border-radius:
    7px;

  background:
    #142130;

  color:
    white;

  font-size:
    7px;

  font-weight:
    900;
}


.version{

  margin-top:
    6px;

  text-align:
    center;

  color:
    #405268;

  font-size:
    6px;

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
      0;
  }


  .chartWrap{

    height:
      180px;
  }


  .big{

    font-size:
      70px;
  }


  .hydroStage{

    height:
      320px;
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


    <!-- PAKS -->


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



    <!-- DUNA -->


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
              KILÉPŐ VÍZ HŐ • HŐCSÓVA ELEJÉN
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
              LEÁLLÁSI KÜSZÖBIG
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
              BIZTONSÁGI HATÁRIG
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
       ÚJ ALSÓ ÉLŐ SÉMA
  ====================================================== -->


  <div class="card hydroCard">


    <div class="hydroHead">


      <div class="hydroTitle">
        DUNA → FENÉKKÜSZÖB → HIDEGVÍZ-CSATORNA → SZIVATTYÚK → ERŐMŰ
      </div>


      <div class="hydroSub">
        VÍZÜGY ÉLŐ MÉRÉSEK
      </div>


    </div>


    <div class="hydroStage">


      <div class="skyGlow"></div>


      <div class="waterLine"></div>


      <div class="waterBreak"></div>


      <div class="breakLabel">
        VÍZFELSZÍN-TÖRÉS / DUZZASZTÁS
      </div>


      <div class="threshold"></div>


      <div class="rack"></div>


      <div class="pump p1"></div>


      <div class="pump p2"></div>


      <div class="plant">


        <div class="plantText">
          PAKSI<br>
          ATOMERŐMŰ
        </div>


        <div class="mwNow">

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


      <div class="flowArrow a1">
        →
      </div>


      <div class="flowArrow a2">
        →
      </div>


      <div class="flowArrow a3">
        ↗
      </div>


      <div class="reading rRiver">


        <div class="lab">
          DUNA • PAKS FŐÁG
        </div>


        <div class="val blueVal">

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


        <div class="sub">

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


        <div class="tm">
          MÉRÉS:
          ${shortTime(riverTime)}
        </div>


      </div>



      <div class="reading rUp">


        <div class="lab">
          FENÉKKÜSZÖB • FELVÍZ
        </div>


        <div class="val greenVal">

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


        <div class="sub">

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


        <div class="tm">
          MÉRÉS:
          ${shortTime(
            thresholdUpTime
          )}
        </div>


      </div>



      <div class="reading rLift">


        <div class="lab">
          DUZZASZTÁS EREDMÉNYE
        </div>


        <div class="val greenVal">

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


        <div class="sub">
          FELVÍZ − ALVÍZ
        </div>


        <div class="tm">
          ÉLŐ KÜLÖNBSÉG
        </div>


      </div>



      <div class="reading rDown">


        <div class="lab">
          FENÉKKÜSZÖB • ALVÍZ
        </div>


        <div class="val blueVal">

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


        <div class="sub">

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


        <div class="tm">
          MÉRÉS:
          ${shortTime(
            thresholdDownTime
          )}
        </div>


      </div>



      <div class="reading rHvcs">


        <div class="lab">
          HIDEGVÍZ-CSATORNA • ÖBLÖZET
        </div>


        <div class="val blueVal">

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


        <div class="sub">

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


        <div class="tm">
          MÉRÉS:
          ${shortTime(
            hvcsTime
          )}
        </div>


      </div>



      <div class="redLine"></div>


      <div class="redLabel">

        −144 cm • LEÁLLÁSI SZINT

      </div>



      <div class="pumpPanel">


        <div class="tiny">
          SZIVATTYÚ SZINT • ÖBLÖZET
        </div>


        <div class="mbf">

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


        <div class="pv">

          ${
            Number.isFinite(
              pumpReserveCm
            )
              ? pumpReserveCm +
                " cm"
              : "—"
          }

        </div>


        <div class="tiny">

          TARTALÉK A 83,60 mBf
          MINIMUM FELETT

        </div>


      </div>


    </div>


    <div class="source">

      VÍZÜGY

      • FŐÁG
      ${shortTime(riverTime)}

      • FELVÍZ
      ${shortTime(thresholdUpTime)}

      • ALVÍZ
      ${shortTime(thresholdDownTime)}

      • HVCS
      ${shortTime(hvcsTime)}

      • DUZZASZTÁS =
      FELVÍZ − ALVÍZ

    </div>


  </div>



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
      json.ok ===
      true &&
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
      hours >=
      240

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
      )

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
