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
              "Mozilla/5.0 (compatible; PaksMonitor/9.0)"
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
      rows.length > 1

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
              "Mozilla/5.0 (compatible; PaksMonitor/9.0)"
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
     
