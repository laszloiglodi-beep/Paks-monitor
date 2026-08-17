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
  "PAKS MONITOR V10";

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


function nowBudapest() {

  return new Intl.DateTimeFormat(
    "hu-HU",
    {
      timeZone:
        "Europe/Budapest",

      hour:
        "2-digit",

      minute:
        "2-digit",

      hourCycle:
        "h23"
    }
  )
    .format(
      new Date()
    );
}


// ============================================================
// BUDAPEST IDŐ
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
      new Date(
        timestamp
      )
    );


  const values =
    {};


  for (
    const part of
    parts
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


  if (
    !match
  ) {

    return null;
  }


  const desiredLocalAsUTC =
    Date.UTC(
      Number(
        match[1]
      ),
      Number(
        match[2]
      ) - 1,
      Number(
        match[3]
      ),
      Number(
        match[4]
      ),
      Number(
        match[5]
      ),
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
      cm / 100
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


/*
  A RAJZON A CM ÉRTÉKEKET
  FÜGGŐLEGES POZÍCIÓRA FORDÍTJUK.

  -120 cm = magasabb
  -145 cm = alacsonyabb
*/

function levelY(value) {

  if (
    !Number.isFinite(
      value
    )
  ) {

    return 240;
  }


  const min =
    -145;

  const max =
    -120;


  const top =
    185;

  const bottom =
    285;


  const clamped =
    Math.max(
      min,
      Math.min(
        max,
        value
      )
    );


  return Math.round(
    bottom -
    (
      (
        clamped -
        min
      ) /
      (
        max -
        min
      )
    ) *
    (
      bottom -
      top
    )
  );
}


// ============================================================
// VÍZÜGY
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
              "Mozilla/5.0 (compatible; PaksMonitor/10.0)"
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


      rows.push(
        {

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
        }
      );
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

async function ensureDB(
  env
) {

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

async function resetRiverHistory(
  env
) {

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
              "Mozilla/5.0 (compatible; PaksMonitor/10.0)"
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

      blocks =
        [
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
          String(
            value
          )
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
            Number(
              value
            ),
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
    // FACEBOOK
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
    // HISTORY
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
            24
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
            24;
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
    // CURRENT DATA
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
      Number.isFinite(
        total
      )
        ? `${total} MW`
        : "— MW";


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


    const yRiver =
      levelY(
        water
      );


    const yUp =
      levelY(
        thresholdUp
      );


    const yDown =
      levelY(
        thresholdDown
      );


    const yHvcs =
      levelY(
        hvcs
      );


    const blockPercent =
      blocks.map(
        value => {

          const n =
            Number(
              value
            );


          return Number.isFinite(
            n
          )
            ? Math.max(
                0,
                Math.min(
                  100,
                  Math.round(
                    n /
                    500 *
                    100
                  )
                )
              )
            : 0;
        }
      );


    const nowText =
      nowBudapest();


    // ========================================================
    // HTML
    // ========================================================

    const html =
`<!doctype html>

<html lang="hu">

<head>

<meta charset="utf-8">

<!--
  FIX SZÉLES V10.
  TELEFONON AZ EGÉSZ DASHBOARD EGYBEN LÁTSZIK.
  A FELHASZNÁLÓ SZABADON NAGYÍTHAT.
-->

<meta
  name="viewport"
  content="width=1536,user-scalable=yes,minimum-scale=0.1,maximum-scale=5"
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
  ⚛️ PAKS MONITOR V10
</title>

<meta
  property="og:title"
  content="⚛️ PAKS MONITOR V10"
>

<meta
  property="og:image"
  content="${PUBLIC_URL}/facebook-image"
>


<style>

:root{

  --bg:
    #020811;

  --panel:
    #06111d;

  --panel2:
    #081827;

  --line:
    #153650;

  --white:
    #f6f8fb;

  --muted:
    #8293a6;

  --green:
    #62dc55;

  --blue:
    #4caaff;

  --orange:
    #ffad30;

  --red:
    #ff535d;

  --purple:
    #c54cff;
}


*{
  box-sizing:
    border-box;
}


html,
body{

  margin:
    0;

  padding:
    0;

  width:
    100%;

  min-height:
    100%;

  background:
    #000;

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

  min-width:
    1536px;

  background:
    radial-gradient(
      circle at 50% -20%,
      #0d2137 0,
      #040b13 42%,
      #02060b 100%
    );
}


button,
a{
  font:
    inherit;
}


.board{

  width:
    1536px;

  margin:
    0 auto;

  padding:
    12px 14px 10px;
}


/* ============================================================
   FEJLÉC
============================================================ */

.header{

  height:
    50px;

  display:
    grid;

  grid-template-columns:
    310px 1fr 550px;

  gap:
    12px;

  align-items:
    center;

  margin-bottom:
    8px;
}


.brand{

  display:
    flex;

  align-items:
    center;

  gap:
    11px;

  font-size:
    27px;

  font-weight:
    950;

  letter-spacing:
    -1px;
}


.versionBadge{

  padding:
    4px 9px;

  border-radius:
    7px;

  background:
    #4f155f;

  color:
    #e5a4ff;

  font-size:
    12px;

  letter-spacing:
    0;
}


.live{

  color:
    var(--green);

  font-size:
    14px;

  font-weight:
    900;
}


.headerTime{

  text-align:
    center;

  font-size:
    30px;

  font-weight:
    950;
}


.headerTime small{

  margin-left:
    12px;

  color:
    #9aa8b7;

  font-size:
    12px;

  font-weight:
    700;
}


.headerRight{

  display:
    grid;

  grid-template-columns:
    95px 1fr;

  gap:
    8px;
}


.iglodi{

  height:
    42px;

  display:
    grid;

  place-items:
    center;

  border:
    1px solid #4b1f59;

  border-radius:
    8px;

  background:
    #100817;

  color:
    var(--purple);

  font-size:
    16px;

  font-weight:
    950;
}


.share{

  height:
    42px;

  display:
    grid;

  grid-template-columns:
    1fr 70px;

  gap:
    6px;

  padding:
    5px;

  border:
    1px solid var(--line);

  border-radius:
    8px;

  background:
    #06101b;
}


.shareLink{

  min-width:
    0;

  display:
    flex;

  align-items:
    center;

  padding:
    0 8px;

  border:
    1px solid #6a2382;

  border-radius:
    6px;

  background:
    #120819;

  color:
    #d052ff;

  white-space:
    nowrap;

  overflow:
    hidden;

  text-overflow:
    ellipsis;

  text-decoration:
    none;

  font-size:
    10px;
}


.copy{

  border:
    0;

  border-radius:
    6px;

  background:
    #132333;

  color:
    white;

  font-size:
    10px;

  font-weight:
    900;
}


/* ============================================================
   FELSŐ 3 PANEL
============================================================ */

.top{

  display:
    grid;

  grid-template-columns:
    400px 560px 528px;

  gap:
    10px;

  height:
    245px;

  margin-bottom:
    10px;
}


.panel{

  position:
    relative;

  border:
    1px solid var(--line);

  border-radius:
    9px;

  background:
    linear-gradient(
      145deg,
      #07131f,
      #040d16
    );

  overflow:
    hidden;
}


.panelTitle{

  padding:
    12px 14px 0;

  color:
    #aeb9c4;

  font-size:
    14px;

  font-weight:
    900;
}


.powerValue{

  padding:
    5px 14px 0;

  color:
    var(--green);

  font-size:
    48px;

  line-height:
    .95;

  font-weight:
    950;

  letter-spacing:
    -2px;
}


.powerCaption{

  position:
    absolute;

  right:
    16px;

  top:
    71px;

  color:
    #8493a3;

  font-size:
    11px;
}


.chartHead{

  display:
    flex;

  justify-content:
    space-between;

  align-items:
    center;

  margin:
    10px 12px 0;
}


.chartLabel{

  color:
    #8b9bad;

  font-size:
    10px;

  font-weight:
    850;
}


.periods{

  display:
    flex;

  gap:
    4px;
}


.period{

  border:
    0;

  border-radius:
    999px;

  padding:
    4px 8px;

  background:
    #111f2d;

  color:
    #7d8fa3;

  font-size:
    9px;

  font-weight:
    900;
}


.period.active{

  background:
    #234967;

  color:
    white;
}


.chartWrap{

  height:
    118px;

  padding:
    2px 8px 0;
}


canvas{

  display:
    block;

  width:
    100%;

  height:
    100%;
}


/* BLOKKOK */

.blockGrid{

  display:
    grid;

  grid-template-columns:
    repeat(
      4,
      1fr
    );

  height:
    198px;

  margin-top:
    8px;
}


.blockCard{

  position:
    relative;

  padding:
    14px;

  border-right:
    1px solid #132f45;
}


.blockCard:last-child{

  border-right:
    0;
}


.blockName{

  color:
    #a3afbb;

  font-size:
    13px;

  font-weight:
    850;
}


.blockMW{

  margin-top:
    34px;

  font-size:
    27px;

  font-weight:
    950;
}


.green{

  color:
    var(--green);
}


.blue{

  color:
    var(--blue);
}


.orange{

  color:
    var(--orange);
}


.red{

  color:
    var(--red);
}


.blockPct{

  position:
    absolute;

  left:
    14px;

  bottom:
    34px;

  font-size:
    14px;

  color:
    #b3bec8;
}


.blockBar{

  position:
    absolute;

  left:
    14px;

  right:
    14px;

  bottom:
    20px;

  height:
    3px;

  background:
    #2b3945;
}


.blockBar span{

  display:
    block;

  height:
    100%;

  background:
    var(--green);
}


.blockSource{

  position:
    absolute;

  left:
    0;

  right:
    0;

  bottom:
    0;

  height:
    35px;

  display:
    flex;

  align-items:
    center;

  padding:
    0 14px;

  border-top:
    1px solid #15344c;

  color:
    #8798aa;

  font-size:
    12px;
}


/* HŐ / HATÁR */

.metricGrid{

  display:
    grid;

  grid-template-columns:
    repeat(
      3,
      1fr
    );

  gap:
    7px;

  padding:
    10px 10px 5px;
}


.metric{

  height:
    70px;

  padding:
    11px;

  border:
    1px solid #10283b;

  border-radius:
    7px;

  background:
    #081522;
}


.metricName{

  color:
    #8697a9;

  font-size:
    11px;

  font-weight:
    800;

  line-height:
    1.15;
}


.metricValue{

  margin-top:
    6px;

  font-size:
    21px;

  font-weight:
    950;

  white-space:
    nowrap;
}


.tempRule{

  margin:
    0 10px 7px;

  padding:
    7px;

  border:
    1px solid #674817;

  border-radius:
    6px;

  background:
    #171207;

  color:
    #ffb33c;

  text-align:
    center;

  font-size:
    10px;

  font-weight:
    900;
}


.gauge{

  position:
    relative;

  height:
    11px;

  margin:
    0 12px;

  border-radius:
    999px;

  background:
    linear-gradient(
      90deg,
      #51c95a 0 60%,
      #ffad30 60% 85%,
      #ec5059 85% 100%
    );
}


.gaugeMarker{

  position:
    absolute;

  left:
    ${markerPct}%;

  top:
    -7px;

  width:
    4px;

  height:
    25px;

  border-radius:
    3px;

  background:
    white;

  box-shadow:
    0 0 7px white;

  transform:
    translateX(-50%);
}


.gaugeScale{

  display:
    grid;

  grid-template-columns:
    1fr 1fr 1fr;

  margin:
    5px 12px 0;

  font-size:
    10px;
}


.gaugeScale span:nth-child(1){

  color:
    var(--green);
}


.gaugeScale span:nth-child(2){

  text-align:
    center;

  color:
    var(--orange);
}


.gaugeScale span:nth-child(3){

  text-align:
    right;

  color:
    var(--red);
}


.distanceGrid{

  display:
    grid;

  grid-template-columns:
    1fr 1fr;

  gap:
    8px;

  margin:
    10px;
}


.distance{

  padding:
    8px 10px;

  border:
    1px solid #10283b;

  border-radius:
    7px;

  background:
    #081522;
}


.distanceValue{

  font-size:
    20px;

  font-weight:
    950;
}


.distanceLabel{

  color:
    #8999aa;

  font-size:
    10px;
}


/* ============================================================
   FŐ MŰSZAKI ÁBRA
============================================================ */

.hydro{

  height:
    405px;

  margin-bottom:
    8px;

  border:
    1px solid var(--line);

  border-radius:
    9px;

  overflow:
    hidden;

  background:
    #07131e;
}


.scene{

  position:
    relative;

  width:
    100%;

  height:
    405px;

  overflow:
    hidden;

  background:
    linear-gradient(
      180deg,
      #0e2a40 0,
      #153b57 53%,
      #3c3025 53%,
      #201b17 100%
    );
}


.sceneBg{

  position:
    absolute;

  inset:
    0;

  opacity:
    .25;

  background:
    radial-gradient(
      ellipse at 20% 48%,
      #3e744e 0 7%,
      transparent 8%
    ),
    radial-gradient(
      ellipse at 28% 45%,
      #305f43 0 8%,
      transparent 9%
    ),
    radial-gradient(
      ellipse at 78% 46%,
      #356548 0 10%,
      transparent 11%
    );
}


.waterSvg{

  position:
    absolute;

  inset:
    0;

  width:
    100%;

  height:
    100%;
}


.zoneTitle{

  position:
    absolute;

  top:
    12px;

  z-index:
    10;

  color:
    #e1e8ee;

  font-size:
    15px;

  font-weight:
    900;

  text-align:
    center;
}


.zRiver{

  left:
    25px;

  width:
    250px;
}


.zThreshold{

  left:
    290px;

  width:
    520px;
}


.zHvcs{

  left:
    825px;

  width:
    300px;
}


.zPumps{

  left:
    1120px;

  width:
    220px;
}


.reading{

  position:
    absolute;

  z-index:
    20;

  width:
    130px;

  padding:
    10px 9px 8px;

  border:
    1px solid #1a3e59;

  border-radius:
    8px;

  background:
    rgba(
      4,
      15,
      25,
      .93
    );

  text-align:
    center;

  box-shadow:
    0 7px 18px rgba(
      0,
      0,
      0,
      .25
    );
}


.readingLabel{

  color:
    #9cabb9;

  font-size:
    10px;

  font-weight:
    850;
}


.readingValue{

  margin-top:
    4px;

  font-size:
    23px;

  line-height:
    1;

  font-weight:
    950;

  white-space:
    nowrap;
}


.readingSub{

  margin-top:
    5px;

  font-size:
    12px;

  color:
    #d9e0e6;
}


.readingTime{

  margin-top:
    5px;

  font-size:
    9px;

  color:
    #718397;
}


.up{

  color:
    var(--green);
}


.down{

  color:
    var(--orange);
}


.flat{

  color:
    #a2afbb;
}


.rRiver{

  left:
    45px;

  top:
    52px;
}


.rUp{

  left:
    335px;

  top:
    52px;
}


.rDown{

  left:
    690px;

  top:
    52px;
}


.rHvcs{

  left:
    880px;

  top:
    52px;
}


/* DUZZASZTÁS */

.upliftPanel{

  position:
    absolute;

  z-index:
    25;

  left:
    465px;

  top:
    48px;

  width:
    190px;

  height:
    185px;

  padding:
    9px;

  border:
    1px solid #3b7c3e;

  border-radius:
    8px;

  background:
    rgba(
      4,
      25,
      10,
      .93
    );
}


.upliftTitle{

  color:
    #83cb82;

  font-size:
    10px;

  font-weight:
    900;

  text-align:
    center;
}


.upliftValue{

  margin-top:
    4px;

  color:
    var(--green);

  font-size:
    28px;

  line-height:
    1;

  text-align:
    center;

  font-weight:
    950;
}


.upliftSub{

  margin-top:
    5px;

  text-align:
    center;

  color:
    #8da99a;

  font-size:
    9px;
}


.upliftChartWrap{

  height:
    90px;

  margin-top:
    7px;
}


.upliftNow{

  text-align:
    center;

  color:
    var(--green);

  font-size:
    11px;

  font-weight:
    900;
}


/* VÍZHOZAM */

.flowMetric{

  position:
    absolute;

  left:
    28px;

  bottom:
    25px;

  z-index:
    20;

  width:
    210px;

  padding:
    8px 10px;

  border-radius:
    8px;

  background:
    rgba(
      5,
      17,
      27,
      .82
    );
}


.flowMetricLabel{

  color:
    #8ca0b2;

  font-size:
    10px;
}


.flowMetricValue{

  margin-top:
    4px;

  font-size:
    20px;

  font-weight:
    950;
}


.flowMetricTime{

  margin-top:
    4px;

  color:
    #718397;

  font-size:
    9px;
}


/* FENÉKKÜSZÖB */

.thresholdStructure{

  position:
    absolute;

  z-index:
    14;

  left:
    390px;

  top:
    245px;

  width:
    360px;

  height:
    130px;
}


.wallL,
.wallR{

  position:
    absolute;

  bottom:
    0;

  width:
    26px;

  height:
    145px;

  background:
    linear-gradient(
      90deg,
      #6d7276,
      #b0b5b8,
      #656a6d
    );

  border:
    1px solid #c4c9cc;
}


.wallL{
  left:0;
}


.wallR{
  right:0;
}


.rocks{

  position:
    absolute;

  left:
    25px;

  right:
    25px;

  bottom:
    0;

  height:
    80px;

  border-radius:
    48% 48% 0 0;

  background:
    radial-gradient(
      circle at 8% 75%,
      #73777a 0 15px,
      transparent 16px
    ),
    radial-gradient(
      circle at 20% 45%,
      #929699 0 17px,
      transparent 18px
    ),
    radial-gradient(
      circle at 34% 75%,
      #5f6467 0 17px,
      transparent 18px
    ),
    radial-gradient(
      circle at 49% 38%,
      #8d9194 0 18px,
      transparent 19px
    ),
    radial-gradient(
      circle at 64% 70%,
      #696e71 0 17px,
      transparent 18px
    ),
    radial-gradient(
      circle at 80% 40%,
      #93979a 0 16px,
      transparent 17px
    ),
    radial-gradient(
      circle at 93% 72%,
      #62676a 0 15px,
      transparent 16px
    ),
    #44494c;
}


/* RÁCS */

.rack{

  position:
    absolute;

  z-index:
    18;

  left:
    850px;

  top:
    220px;

  width:
    48px;

  height:
    145px;

  border:
    3px solid #9ba7b1;

  background:
    repeating-linear-gradient(
      90deg,
      #203747 0 5px,
      #98a5af 5px 8px
    );
}


.rackLabel{

  position:
    absolute;

  z-index:
    18;

  left:
    820px;

  top:
    194px;

  width:
    110px;

  text-align:
    center;

  color:
    #d2dae1;

  font-size:
    10px;

  font-weight:
    850;
}


/* SZIVATTYÚ */

.pump{

  position:
    absolute;

  z-index:
    18;

  top:
    190px;

  width:
    55px;

  height:
    180px;
}


.pumpHead{

  position:
    absolute;

  top:
    0;

  left:
    7px;

  width:
    40px;

  height:
    30px;

  border-radius:
    10px 10px 3px 3px;

  background:
    linear-gradient(
      #a5adb3,
      #69747c
    );

  border:
    1px solid #c5cbd0;
}


.pumpPipe{

  position:
    absolute;

  top:
    28px;

  left:
    21px;

  width:
    14px;

  height:
    125px;

  background:
    linear-gradient(
      90deg,
      #707c84,
      #aeb7bd,
      #65717a
    );
}


.pumpBase{

  position:
    absolute;

  left:
    9px;

  bottom:
    0;

  width:
    38px;

  height:
    38px;

  border-radius:
    50%;

  background:
    #68767f;

  border:
    4px solid #313d45;
}


.p1{
  left:1010px;
}


.p2{
  left:1090px;
}


.p3{
  left:1170px;
}


.pipeToPlant{

  position:
    absolute;

  z-index:
    17;

  left:
    1195px;

  top:
    210px;

  width:
    150px;

  height:
    55px;

  border-top:
    14px solid #78858d;

  border-right:
    14px solid #78858d;

  border-radius:
    0 24px 0 0;
}


/* ERŐMŰ */

.plant{

  position:
    absolute;

  z-index:
    20;

  right:
    20px;

  top:
    105px;

  width:
    190px;

  height:
    250px;

  border:
    1px solid #929ca4;

  border-radius:
    12px 12px 4px 4px;

  background:
    linear-gradient(
      145deg,
      #717b84,
      #313940
    );
}


.plant:before{

  content:
    "";

  position:
    absolute;

  left:
    38px;

  top:
    -60px;

  width:
    112px;

  height:
    67px;

  border:
    1px solid #9ca5ac;

  border-radius:
    55% 55% 0 0;

  background:
    #5d6870;
}


.stack{

  position:
    absolute;

  right:
    14px;

  top:
    -74px;

  width:
    24px;

  height:
    92px;

  background:
    repeating-linear-gradient(
      180deg,
      #ddd 0 10px,
      #d84b42 10px 20px
    );

  border-radius:
    6px 6px 0 0;
}


.plantName{

  margin-top:
    78px;

  text-align:
    center;

  font-size:
    17px;

  font-weight:
    950;
}


.atom{

  margin-top:
    12px;

  text-align:
    center;

  color:
    var(--green);

  font-size:
    42px;
}


/* SZIVATTYÚ INFO */

.pumpInfo{

  position:
    absolute;

  z-index:
    28;

  right:
    38px;

  bottom:
    20px;

  width:
    250px;

  padding:
    14px;

  border:
    1px solid #387b3f;

  border-radius:
    9px;

  background:
    rgba(
      4,
      20,
      9,
      .94
    );
}


.pumpInfoTitle{

  color:
    #abb9b0;

  font-size:
    11px;

  font-weight:
    850;
}


.pumpInfoMbf{

  margin-top:
    6px;

  color:
    var(--blue);

  font-size:
    23px;

  font-weight:
    950;
}


.pumpInfoReserve{

  margin-top:
    10px;

  color:
    var(--green);

  font-size:
    22px;

  font-weight:
    950;
}


.pumpInfoStop{

  margin-top:
    8px;

  color:
    var(--red);

  font-size:
    18px;

  font-weight:
    950;
}


.pumpInfoText{

  margin-top:
    8px;

  color:
    #c1cbd3;

  font-size:
    9px;

  line-height:
    1.35;
}


/* LEÁLLÁSI VONAL */

.stopLine{

  position:
    absolute;

  z-index:
    16;

  left:
    25px;

  right:
    305px;

  top:
    ${levelY(-144)}px;

  border-top:
    3px dashed var(--red);
}


.stopText{

  position:
    absolute;

  z-index:
    17;

  left:
    250px;

  top:
    ${levelY(-144) - 19}px;

  color:
    var(--red);

  font-size:
    11px;

  font-weight:
    950;
}


.flowArrow{

  position:
    absolute;

  z-index:
    17;

  color:
    #2ba5f5;

  font-size:
    34px;

  font-weight:
    950;
}


.a1{
  left:255px;
  top:262px;
}


.a2{
  left:925px;
  top:265px;
}


.a3{
  left:985px;
  top:245px;
}


.a4{
  left:1065px;
  top:245px;
}


.a5{
  left:1145px;
  top:245px;
}


/* ============================================================
   ALSÓ ADATSOR
============================================================ */

.bottomRail{

  height:
    165px;

  display:
    grid;

  grid-template-columns:
    repeat(
      7,
      1fr
    );

  border:
    1px solid var(--line);

  border-radius:
    9px;

  background:
    #06111c;

  overflow:
    hidden;

  margin-bottom:
    8px;
}


.bottomCard{

  position:
    relative;

  padding:
    14px 12px;

  border-right:
    1px solid #17344b;

  text-align:
    center;
}


.bottomCard:last-child{

  border-right:
    0;
}


.bottomHighlight{

  border:
    1px solid #7c661c;

  background:
    rgba(
      30,
      23,
      4,
      .38
    );
}


.bottomLabel{

  color:
    #9dacba;

  font-size:
    11px;

  font-weight:
    850;

  min-height:
    28px;
}


.bottomValue{

  margin-top:
    9px;

  font-size:
    25px;

  line-height:
    1;

  font-weight:
    950;
}


.bottomSub{

  margin-top:
    8px;

  color:
    #9cabb9;

  font-size:
    11px;
}


.bottomTime{

  margin-top:
    7px;

  color:
    #6e8194;

  font-size:
    9px;
}


.bottomStop{

  margin-top:
    8px;

  color:
    var(--red);

  font-size:
    10px;

  font-weight:
    900;
}


.miniChart{

  height:
    55px;

  margin-top:
    6px;
}


/* FOOTER */

.footer{

  height:
    38px;

  display:
    grid;

  grid-template-columns:
    1.4fr 1fr 1fr;

  align-items:
    center;

  padding:
    0 14px;

  border:
    1px solid #112e45;

  border-radius:
    8px;

  background:
    #050e17;

  color:
    #6f8193;

  font-size:
    10px;
}


.footer span:nth-child(2){

  text-align:
    center;
}


.footer span:nth-child(3){

  text-align:
    right;
}


.toast{

  position:
    fixed;

  left:
    50%;

  bottom:
    28px;

  z-index:
    999;

  transform:
    translateX(-50%)
    translateY(10px);

  opacity:
    0;

  padding:
    9px 16px;

  border:
    1px solid #347d41;

  border-radius:
    999px;

  background:
    #102819;

  color:
    #7bea70;

  font-size:
    13px;

  font-weight:
    900;

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

</style>

</head>


<body>


<div class="board">


  <!-- =====================================================
       FEJLÉC
  ====================================================== -->


  <div class="header">


    <div class="brand">

      PAKS MONITOR

      <span class="versionBadge">
        V10
      </span>

      <span class="live">
        ● ÉLŐ ADATOK
      </span>

    </div>


    <div class="headerTime">

      ${nowText}

      <small>
        FRISSÍTVE: ${nowText}
      </small>

    </div>


    <div class="headerRight">


      <div class="iglodi">
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



  <!-- =====================================================
       FELSŐ SOR
  ====================================================== -->


  <div class="top">


    <!-- TELJESÍTMÉNY -->


    <div class="panel">


      <div class="panelTitle">
        PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
      </div>


      <div class="powerValue">
        ${totalText}
      </div>


      <div class="powerCaption">
        ÖSSZTELJESÍTMÉNY
      </div>


      <div class="chartHead">


        <div class="chartLabel">
          TELJESÍTMÉNY VÁLTOZÁSA • MW
        </div>


        <div class="periods">


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



    <!-- BLOKKOK -->


    <div class="panel">


      <div class="blockGrid">


        ${blocks.map(
          (
            value,
            index
          ) => `

            <div class="blockCard">


              <div class="blockName">
                ${index + 1}. BLOKK
              </div>


              <div
                class="blockMW ${
                  Number(value) > 0
                    ? "green"
                    : ""
                }"
              >

                ${
                  value === "—"
                    ? "—"
                    : value + " MW"
                }

              </div>


              <div class="blockPct">

                ${blockPercent[index]}%

              </div>


              <div class="blockBar">

                <span
                  style="width:${blockPercent[index]}%"
                ></span>

              </div>


            </div>

          `
        ).join("")}


      </div>


      <div class="blockSource">

        OAH •

        ${shortTime(oahTime)} •

        ${oahStatus}

      </div>


    </div>



    <!-- HŐ / HATÁROK -->


    <div class="panel">


      <div class="metricGrid">


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
            KILÉPŐ VÍZ HŐ<br>
            (HŐCSÓVA ELEJÉN)
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

        <div class="gaugeMarker"></div>

      </div>


      <div class="gaugeScale">

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


  </div>



  <!-- =====================================================
       NAGY MŰSZAKI ÁBRA
  ====================================================== -->


  <div class="hydro">


    <div class="scene">


      <div class="sceneBg"></div>


      <!--
        DINAMIKUS VÍZFELSZÍN:

        DUNA
        → FELVÍZ EMELKEDIK
        → KÜSZÖB UTÁN ALVÍZ LEESIK
        → HVCS ISMÉT KÜLÖN SZINT
      -->


      <svg
        class="waterSvg"
        viewBox="0 0 1508 405"
        preserveAspectRatio="none"
      >


        <defs>

          <linearGradient
            id="waterGrad"
            x1="0"
            y1="0"
            x2="0"
            y2="1"
          >

            <stop
              offset="0%"
              stop-color="#168bd1"
            />

            <stop
              offset="100%"
              stop-color="#075483"
            />

          </linearGradient>

        </defs>


        <path

          d="
            M 0 ${yRiver}
            L 290 ${yRiver}

            L 390 ${yUp}
            L 650 ${yUp}

            L 700 ${yDown}
            L 850 ${yDown}

            L 930 ${yHvcs}
            L 1508 ${yHvcs}

            L 1508 365
            L 0 365
            Z
          "

          fill="url(#waterGrad)"

        />


        <polyline

          points="
            0,${yRiver}

            290,${yRiver}

            390,${yUp}

            650,${yUp}

            700,${yDown}

            850,${yDown}

            930,${yHvcs}

            1508,${yHvcs}
          "

          fill="none"

          stroke="#66c8ff"

          stroke-width="4"

        />


      </svg>



      <div class="zoneTitle zRiver">
        DUNA (FŐÁG)
      </div>


      <div class="zoneTitle zThreshold">
        FENÉKKÜSZÖB (KŐSZÓRÁS)
      </div>


      <div class="zoneTitle zHvcs">
        HIDEGVÍZ-CSATORNA<br>
        (ÖBLÖZET)
      </div>


      <div class="zoneTitle zPumps">
        SZIVATTYÚK<br>
        (HŰTŐVÍZ)
      </div>



      <!-- DUNA -->


      <div class="reading rRiver">

        <div class="readingLabel">
          AKTUÁLIS
        </div>

        <div class="readingValue blue">

          ${
            Number.isFinite(
              water
            )
              ? water +
                " cm"
              : "—"
          }

          <span class="${riverDir.cls}">
            ${riverDir.symbol}
          </span>

        </div>

        <div class="readingSub">

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

        <div class="readingTime">

          MÉRÉS:
          ${shortTime(riverTime)}

        </div>

      </div>



      <!-- FELVÍZ -->


      <div class="reading rUp">

        <div class="readingLabel">
          FELVÍZ
        </div>

        <div class="readingValue blue">

          ${
            Number.isFinite(
              thresholdUp
            )
              ? thresholdUp +
                " cm"
              : "—"
          }

          <span class="${upDir.cls}">
            ${upDir.symbol}
          </span>

        </div>

        <div class="readingSub">

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

        <div class="readingTime">

          MÉRÉS:
          ${shortTime(
            thresholdUpTime
          )}

        </div>

      </div>



      <!-- DUZZASZTÁS -->


      <div class="upliftPanel">


        <div class="upliftTitle">
          DUZZASZTÁS EREDMÉNYE
        </div>


        <div class="upliftValue">

          ${
            Number.isFinite(
              uplift
            )
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


        <div class="upliftChartWrap">

          <canvas
            id="upliftChart"
          ></canvas>

        </div>


        <div class="upliftNow">

          AKTUÁLIS:

          ${
            Number.isFinite(
              uplift
            )
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


      </div>



      <!-- ALVÍZ -->


      <div class="reading rDown">

        <div class="readingLabel">
          ALVÍZ
        </div>

        <div class="readingValue blue">

          ${
            Number.isFinite(
              thresholdDown
            )
              ? thresholdDown +
                " cm"
              : "—"
          }

          <span class="${downDir.cls}">
            ${downDir.symbol}
          </span>

        </div>

        <div class="readingSub">

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

        <div class="readingTime">

          MÉRÉS:
          ${shortTime(
            thresholdDownTime
          )}

        </div>

      </div>



      <!-- HVCS -->


      <div class="reading rHvcs">

        <div class="readingLabel">
          AKTUÁLIS
        </div>

        <div class="readingValue blue">

          ${
            Number.isFinite(
              hvcs
            )
              ? hvcs +
                " cm"
              : "—"
          }

          <span class="${hvcsDir.cls}">
            ${hvcsDir.symbol}
          </span>

        </div>

        <div class="readingSub">

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

        <div class="readingTime">

          MÉRÉS:
          ${shortTime(hvcsTime)}

        </div>

      </div>



      <!-- VÍZHOZAM -->


      <div class="flowMetric">

        <div class="flowMetricLabel">
          🌊 VÍZHOZAM
        </div>

        <div class="flowMetricValue">
          ${flowText}
        </div>

        <div class="flowMetricTime">
          MÉRÉS: ${shortTime(riverTime)}
        </div>

      </div>



      <!-- FENÉKKÜSZÖB -->


      <div class="thresholdStructure">

        <div class="wallL"></div>

        <div class="rocks"></div>

        <div class="wallR"></div>

      </div>



      <!-- SZŰRŐRÁCS -->


      <div class="rackLabel">
        SZŰRŐRÁCS
      </div>

      <div class="rack"></div>



      <!-- SZIVATTYÚK -->


      <div class="pump p1">

        <div class="pumpHead"></div>

        <div class="pumpPipe"></div>

        <div class="pumpBase"></div>

      </div>


      <div class="pump p2">

        <div class="pumpHead"></div>

        <div class="pumpPipe"></div>

        <div class="pumpBase"></div>

      </div>


      <div class="pump p3">

        <div class="pumpHead"></div>

        <div class="pumpPipe"></div>

        <div class="pumpBase"></div>

      </div>


      <div class="pipeToPlant"></div>



      <!-- ERŐMŰ -->


      <div class="plant">

        <div class="stack"></div>

        <div class="plantName">
          PAKSI<br>
          ATOMERŐMŰ
        </div>

        <div class="atom">
          ⚛
        </div>

      </div>



      <!-- SZIVATTYÚ ADAT -->


      <div class="pumpInfo">


        <div class="pumpInfoTitle">
          SZIVATTYÚ SZINT (ÖBLÖZETBEN)
        </div>


        <div class="pumpInfoMbf">

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


        <div class="pumpInfoReserve">

          TARTALÉK:

          ${
            Number.isFinite(
              pumpReserveCm
            )
              ? pumpReserveCm +
                " cm ↑"
              : "—"
          }

        </div>


        <div class="pumpInfoStop">
          LEÁLLÁSI SZINT: −144 cm
        </div>


        <div class="pumpInfoText">

          A tartalék a 83,60 mBf
          minimumhoz viszonyított
          pillanatnyi különbség.

        </div>


      </div>



      <div class="stopLine"></div>


      <div class="stopText">
        −144 cm • LEÁLLÁSI SZINT
      </div>



      <div class="flowArrow a1">
        →
      </div>


      <div class="flowArrow a2">
        →
      </div>


      <div class="flowArrow a3">
        ↑
      </div>


      <div class="flowArrow a4">
        ↑
      </div>


      <div class="flowArrow a5">
        ↑
      </div>


    </div>


  </div>



  <!-- =====================================================
       ALSÓ SOR
  ====================================================== -->


  <div class="bottomRail">


    <div class="bottomCard">

      <div class="bottomLabel">
        DUNA – PAKS (FŐÁG)
      </div>

      <div class="bottomValue blue">

        ${
          Number.isFinite(
            water
          )
            ? water +
              " cm"
            : "—"
        }

        <span class="${riverDir.cls}">
          ${riverDir.symbol}
        </span>

      </div>

      <div class="bottomSub">

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

      <div class="bottomTime">
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

        <span class="${upDir.cls}">
          ${upDir.symbol}
        </span>

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

      <div class="bottomTime">

        MÉRÉS:
        ${shortTime(
          thresholdUpTime
        )}

      </div>

      <div class="bottomStop">
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

        <span class="${downDir.cls}">
          ${downDir.symbol}
        </span>

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

      <div class="bottomTime">

        MÉRÉS:
        ${shortTime(
          thresholdDownTime
        )}

      </div>

      <div class="bottomStop">
        −144 cm LEÁLLÁSI SZINT
      </div>

    </div>



    <div class="bottomCard bottomHighlight">

      <div class="bottomLabel">
        DUZZASZTÁS EREDMÉNYE
      </div>

      <div class="bottomValue green">

        ${
          Number.isFinite(
            uplift
          )
            ? (
                uplift >= 0
                  ? "+"
                  : ""
              ) +
              uplift +
              " cm ↑"
            : "—"
        }

      </div>

      <div class="bottomSub">
        FELVÍZ − ALVÍZ
      </div>

      <div class="bottomTime">
        ÉLŐ KÜLÖNBSÉG
      </div>

    </div>



    <div class="bottomCard">

      <div class="bottomLabel">
        HIDEGVÍZ-CSATORNA
      </div>

      <div class="bottomValue blue">

        ${
          Number.isFinite(
            hvcs
          )
            ? hvcs +
              " cm"
            : "—"
        }

        <span class="${hvcsDir.cls}">
          ${hvcsDir.symbol}
        </span>

      </div>

      <div class="bottomSub">

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

      <div class="bottomTime">

        MÉRÉS:
        ${shortTime(hvcsTime)}

      </div>

      <div class="bottomStop">
        −144 cm LEÁLLÁSI SZINT
      </div>

    </div>



    <div class="bottomCard">

      <div class="bottomLabel">
        SZIVATTYÚ SZINT (ÖBLÖZETBEN)
      </div>

      <div class="bottomValue blue">

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

      <div class="bottomSub green">

        TARTALÉK:

        ${
          Number.isFinite(
            pumpReserveCm
          )
            ? pumpReserveCm +
              " cm ↑"
            : "—"
        }

      </div>

      <div class="bottomTime">

        MÉRÉS:
        ${shortTime(hvcsTime)}

      </div>

      <div class="bottomStop">
        −144 cm LEÁLLÁSI SZINT
      </div>

    </div>



    <div class="bottomCard">

      <div class="bottomLabel">
        2. BLOKK TELJESÍTMÉNYE
      </div>

      <div class="bottomValue green">

        ${
          blocks[1] ===
          "—"

            ? "—"

            : blocks[1] +
              " MW"
        }

      </div>

      <div class="miniChart">

        <canvas
          id="miniPowerChart"
        ></canvas>

      </div>

      <div class="bottomTime">
        ${shortTime(oahTime)}
      </div>

    </div>


  </div>



  <div class="footer">

    <span>
      ADATFORRÁSOK:
      OVF / VÍZÜGY
      • OAH
      • MVM
    </span>

    <span>
      AZ ADATOK TÁJÉKOZTATÓ JELLEGŰEK.
    </span>

    <span>
      UTOLSÓ FRISSÍTÉS:
      ${nowText}
      •
      ${VERSION}
    </span>

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


let selectedPowerRange =
  24;


let historyCache =
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
    historyCache[
      hours
    ]
  ) {

    return historyCache[
      hours
    ];
  }


  const data =
    await getHistory(
      hours
    );


  historyCache[
    hours
  ] =
    data;


  return data;
}


// ============================================================
// CANVAS
// ============================================================

function setupCanvas(
  canvas
) {

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


  return {

    ctx,

    W:
      rect.width,

    H:
      rect.height
  };
}


// ============================================================
// TELJESÍTMÉNY GRAFIKON
// ============================================================

async function drawPowerChart() {

  const canvas =
    document.getElementById(
      "powerChart"
    );


  if (
    !canvas
  ) {

    return;
  }


  const rows =
    await loadHistory(
      selectedPowerRange
    );


  const points =
    rows
      .filter(
        row =>
          row.power !==
          null &&
          row.power !==
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
              row.power
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


  const {
    ctx,
    W,
    H
  } =
    setupCanvas(
      canvas
    );


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  const pad = {

    left:
      52,

    right:
      12,

    top:
      8,

    bottom:
      19
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
    "rgba(115,145,170,.20)";


  ctx.lineWidth =
    1;


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
    !points.length
  ) {

    ctx.fillStyle =
      "#718397";


    ctx.font =
      "11px -apple-system";


    ctx.fillText(
      "Új mérésre várunk…",
      pad.left +
      8,
      H /
      2
    );


    return;
  }


  let minY =
    Math.min(
      ...points.map(
        point =>
          point.y
      )
    );


  let maxY =
    Math.max(
      ...points.map(
        point =>
          point.y
      )
    );


  if (
    minY ===
    maxY
  ) {

    minY -=
      2;

    maxY +=
      2;
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
    selectedPowerRange *
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
    "#708296";


  ctx.font =
    "10px -apple-system";


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
      Math.round(
        value
      ) +
      " MW",

      pad.left -
      5,

      y +
      3
    );
  }


  ctx.textAlign =
    "center";


  const divisions =
    selectedPowerRange >=
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
      selectedPowerRange >=
      240

        ? date
            .toLocaleDateString(
              "hu-HU",
              {
                month:
                  "2-digit",

                day:
                  "2-digit"
              }
            )

        : date
            .toLocaleTimeString(
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
      3
    );
  }


  ctx.strokeStyle =
    "#65df58";


  ctx.fillStyle =
    "#65df58";


  ctx.lineWidth =
    2.4;


  ctx.beginPath();


  points.forEach(
    (
      point,
      index
    ) => {

      if (
        index === 0
      ) {

        ctx.moveTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
        );

      } else {

        ctx.lineTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
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
    4,
    0,
    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// KIS TELJESÍTMÉNY GRAFIKON
// ============================================================

async function drawMiniPower() {

  const canvas =
    document.getElementById(
      "miniPowerChart"
    );


  if (
    !canvas
  ) {

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
          row.power !==
          null &&
          row.power !==
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
              row.power
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
      );


  const {
    ctx,
    W,
    H
  } =
    setupCanvas(
      canvas
    );


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  if (
    points.length <
    2
  ) {

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

    minY--;

    maxY++;
  }


  const minX =
    points[0].x;


  const maxX =
    points[
      points.length -
      1
    ].x;


  const sx =
    x =>
      4 +
      (
        (
          x -
          minX
        ) /
        (
          maxX -
          minX ||
          1
        )
      ) *
      (
        W -
        8
      );


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
          minY ||
          1
        )
      ) *
      (
        H -
        8
      );


  ctx.strokeStyle =
    "#65df58";


  ctx.lineWidth =
    2;


  ctx.beginPath();


  points.forEach(
    (
      point,
      index
    ) => {

      if (
        index === 0
      ) {

        ctx.moveTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
        );

      } else {

        ctx.lineTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
        );
      }
    }
  );


  ctx.stroke();
}


// ============================================================
// DUZZASZTÁS 10 NAP
// ============================================================

async function drawUpliftChart() {

  const canvas =
    document.getElementById(
      "upliftChart"
    );


  if (
    !canvas
  ) {

    return;
  }


  const rows =
    await loadHistory(
      240
    );


  let lastUp =
    null;


  let lastDown =
    null;


  const points =
    [];


  const ordered =
    rows
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          Number(
            a.ts
          ) -
          Number(
            b.ts
          )
      );


  for (
    const row of
    ordered
  ) {

    if (
      row.threshold_up !==
      null &&
      row.threshold_up !==
      undefined
    ) {

      const value =
        Number(
          row.threshold_up
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        lastUp =
          value;
      }
    }


    if (
      row.threshold_down !==
      null &&
      row.threshold_down !==
      undefined
    ) {

      const value =
        Number(
          row.threshold_down
        );


      if (
        Number.isFinite(
          value
        )
      ) {

        lastDown =
          value;
      }
    }


    if (
      Number.isFinite(
        lastUp
      ) &&
      Number.isFinite(
        lastDown
      )
    ) {

      points.push(
        {

          x:
            Number(
              row.ts
            ),

          y:
            lastUp -
            lastDown
        }
      );
    }
  }


  const {
    ctx,
    W,
    H
  } =
    setupCanvas(
      canvas
    );


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  ctx.strokeStyle =
    "rgba(70,120,75,.35)";


  for (
    let i = 0;
    i <= 3;
    i++
  ) {

    const y =
      8 +
      (
        H -
        16
      ) *
      i /
      3;


    ctx.beginPath();


    ctx.moveTo(
      4,
      y
    );


    ctx.lineTo(
      W -
      4,
      y
    );


    ctx.stroke();
  }


  if (
    !points.length
  ) {

    return;
  }


  let minY =
    Math.min(
      0,
      ...points.map(
        point =>
          point.y
      )
    );


  let maxY =
    Math.max(
      1,
      ...points.map(
        point =>
          point.y
      )
    );


  if (
    minY ===
    maxY
  ) {

    minY--;

    maxY++;
  }


  const minX =
    Date.now() -
    240 *
    60 *
    60 *
    1000;


  const maxX =
    Date.now();


  const sx =
    x =>
      4 +
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
      (
        W -
        8
      );


  const sy =
    y =>
      6 +
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
        12
      );


  ctx.strokeStyle =
    "#65df58";


  ctx.fillStyle =
    "#65df58";


  ctx.lineWidth =
    2;


  ctx.beginPath();


  points.forEach(
    (
      point,
      index
    ) => {

      if (
        index === 0
      ) {

        ctx.moveTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
        );

      } else {

        ctx.lineTo(
          sx(
            point.x
          ),
          sy(
            point.y
          )
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
    3,
    0,
    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// TELJESÍTMÉNY GOMBOK
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

          selectedPowerRange =
            Number(
              button.dataset.hours
            );


          document
            .querySelectorAll(
              ".period"
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


          historyCache =
            {};


          drawPowerChart();
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
// START
// ============================================================

async function redraw() {

  historyCache =
    {};


  await Promise.all(
    [

      drawPowerChart(),

      drawMiniPower(),

      drawUpliftChart()

    ]
  );
}


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
