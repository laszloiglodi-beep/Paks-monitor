const OAH_URL =
  "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

const VIZ_URL =
  "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

const MVM_TEMP_URL =
  "https://atomeromu.mvm.hu/hu-HU/Rolunk/Vizhomerseklet";

const PUBLIC_URL =
  "https://paks-monitor.laszlo-iglodi.workers.dev";

const FB_IMAGE_RAW =
  "https://raw.githubusercontent.com/laszloiglodi-beep/Paks-monitor/main/60CF06BF-2068-420D-AC41-224FB3B75358.png";


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
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}


function fmt1(value) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value.toLocaleString(
        "hu-HU",
        {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        }
      )
    : "—";
}


function shortTime(value) {
  const match =
    String(value || "").match(
      /(\d{2}:\d{2})/
    );

  return match
    ? match[1]
    : "—";
}


// ============================================================
// BUDAPESTI IDŐ
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
    String(value || "").match(
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
      getBudapestOffset(timestamp);
  }


  return Number.isFinite(timestamp)
    ? timestamp
    : null;
}


// ============================================================
// D1
// ============================================================

async function ensureDB(env) {

  if (!env || !env.DB) {
    throw new Error(
      "DB binding missing"
    );
  }


  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS measurements (
      ts INTEGER PRIMARY KEY,
      power INTEGER,
      water INTEGER,
      flow REAL,
      temp REAL
    )`
  ).run();


  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT
    )`
  ).run();


  /*
    ÚJ MIGRÁCIÓ.

    A korábbi hibás / 5 percenként
    gyártott Duna-görbe törlése.

    Ez CSAK EGYSZER fut le.
  */

  const migration =
    await env.DB.prepare(
      "SELECT value FROM meta WHERE key = ?"
    )
    .bind(
      "river_source_timestamp_v2"
    )
    .first();


  if (!migration) {

    await env.DB.prepare(
      "DELETE FROM measurements"
    ).run();


    await env.DB.prepare(
      "INSERT OR REPLACE INTO meta (key,value) VALUES (?,?)"
    )
    .bind(
      "river_source_timestamp_v2",
      "done"
    )
    .run();


    console.log(
      "D1 migration v2 completed"
    );
  }
}


// ============================================================
// AKTUÁLIS ADATOK
// ============================================================

async function getCurrentData() {

  let blocks =
    ["—", "—", "—", "—"];

  let oahTime = "—";
  let oahTimestamp = null;
  let oahStatus = "OK";


  let water = null;
  let flow = null;
  let temp = null;

  let riverTime = "—";
  let riverTimestamp = null;
  let riverStatus = "OK";


  let heatTemp = null;
  let heatDate = "—";
  let heatStatus =
    "NAPI MVM MÉRÉS";


  // ==========================================================
  // OAH – PAKSI BLOKKOK
  // ==========================================================

  try {

    const response =
      await fetch(
        OAH_URL,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/2.0)"
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


    /*
      Elsődleges parser:
      négy blokk egymás után.
    */

    let power =
      text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );


    /*
      Tartalék parser,
      ha az OAH kicsit átrendezi
      a szöveget.
    */

    if (!power) {

      const values = [];

      for (
        let i = 1;
        i <= 4;
        i++
      ) {

        const re =
          new RegExp(
            i +
            "\\.\\s*blokk[^0-9]{0,120}(\\d+)\\s*MW",
            "i"
          );


        const m =
          text.match(re);


        if (m) {
          values.push(m[1]);
        }
      }


      if (values.length === 4) {

        blocks =
          values;

      } else {

        oahStatus =
          "ADATHIBA";
      }

    } else {

      blocks = [
        power[1],
        power[2],
        power[3],
        power[4]
      ];
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
  // VÍZÜGY – PAKS
  // ==========================================================

  try {

    const response =
      await fetch(
        VIZ_URL,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/2.0)"
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


    /*
      Vízállás
      Vízhozam
      két lehetséges hőmérsékleti mező.

      Az összes valódi időpontot
      megkeressük, majd a legfrissebbet
      választjuk.

      NEM a Worker futási idejét használjuk.
    */

    const rowRegex =
      /(20\d{2}\.\s*\d{2}\.\s*\d{2}\.?\s*\d{2}:\d{2})\s+(-?\d+)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)/g;


    let latestRow = null;
    let match;


    while (
      (match =
        rowRegex.exec(text)) !== null
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


      if (
        !latestRow ||
        timestamp >
        latestRow.timestamp
      ) {

        latestRow = {
          timestamp,
          time: match[1],
          water: match[2],
          flow: match[3],
          temp1: match[4],
          temp2: match[5]
        };
      }
    }


    if (latestRow) {

      riverTime =
        latestRow.time;

      riverTimestamp =
        latestRow.timestamp;


      // ------------------------
      // VÍZÁLLÁS
      // ------------------------

      const w =
        Number(
          latestRow.water
        );


      if (
        Number.isFinite(w) &&
        w > -1000 &&
        w < 1000
      ) {

        water = w;
      }


      // ------------------------
      // VÍZHOZAM
      // ------------------------

      if (
        latestRow.flow !== "-"
      ) {

        const f =
          Number(
            latestRow.flow.replace(
              ",",
              "."
            )
          );


        if (
          Number.isFinite(f) &&
          f >= 0 &&
          f <= 20000
        ) {

          flow = f;
        }
      }


      // ------------------------
      // VÍZHŐMÉRSÉKLET
      // ------------------------

      let candidates = [
        latestRow.temp1,
        latestRow.temp2
      ];


      for (
        const raw of candidates
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


        /*
          FONTOS:

          2026 vagy 700 stb.
          soha nem lehet hőmérséklet.
        */

        if (
          Number.isFinite(t) &&
          t >= 0 &&
          t <= 40
        ) {

          temp = t;
          break;
        }
      }


      if (
        !Number.isFinite(water)
      ) {

        riverStatus =
          "ADATHIBA";
      }


    } else {

      riverStatus =
        "ADATHIBA";
    }


  } catch (error) {

    riverStatus =
      "KAPCSOLATI HIBA";

    console.log(
      "VIZ ERROR:",
      error?.message ||
      String(error)
    );
  }


  // ==========================================================
  // MVM – HŐCSÓVA / 500 M
  // ==========================================================

  /*
    FONTOS:

    Az MVM ezen az oldalon napi
    hivatalos mérési eredményt tesz közzé.

    A PDF-grafikonból nem gyártunk
    ál-5-perces adatot.

    A Worker csak azt jelzi, hogy
    van-e aktuális napi hivatalos
    közzététel.

    Ha az MVM később közvetlen
    gépi numerikus adatot tesz ki,
    ide köthető be.
  */

  try {

    const response =
      await fetch(
        MVM_TEMP_URL,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/2.0)"
          },
          cf: {
            cacheTtl: 300,
            cacheEverything: false
          }
        }
      );


    if (!response.ok) {

      throw new Error(
        "MVM HTTP " +
        response.status
      );
    }


    const raw =
      await response.text();


    const text =
      clean(raw);


    /*
      Legutóbbi grafikon dátuma.
      Példa:
      2026. évi augusztus 14-ei
    */

    const dateMatch =
      text.match(
        /2026\.\s*évi\s+([a-záéíóöőúüű]+)\s+(\d{1,2})-ei\s+mérési eredmény/i
      );


    if (dateMatch) {

      heatDate =
        "2026. " +
        dateMatch[1] +
        " " +
        dateMatch[2] +
        ".";
    }


    /*
      Csak akkor fogadunk el numerikus
      értéket, ha az MVM HTML-oldal
      kifejezetten egy aktuális
      hőcsóva-mért értéket ír ki.

      Ez szándékosan konzervatív.
    */

    const currentMatch =
      text.match(
        /(?:hőcsóva[^.]{0,100}|mért\s+érték[^.]{0,100})(2[0-9]|3[0-1])[,\.](\d{1,2})\s*°?C/i
      );


    if (currentMatch) {

      const value =
        Number(
          currentMatch[1] +
          "." +
          currentMatch[2]
        );


      if (
        Number.isFinite(value) &&
        value >= 20 &&
        value <= 31.5
      ) {

        heatTemp =
          value;
      }
    }


  } catch (error) {

    heatStatus =
      "MVM KAPCSOLATI HIBA";

    console.log(
      "MVM ERROR:",
      error?.message ||
      String(error)
    );
  }


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
          (sum, value) =>
            sum +
            Number(value),
          0
        )
      : null;


  return {

    blocks,
    total,

    water,
    flow,
    temp,

    heatTemp,
    heatDate,
    heatStatus,

    oahTime,
    oahTimestamp,

    riverTime,
    riverTimestamp,

    oahStatus,
    riverStatus
  };
}


// ============================================================
// D1 MENTÉS
// ============================================================

async function saveMeasurement(
  env,
  data
) {

  try {

    await ensureDB(env);


    // ========================================================
    // OAH
    //
    // OAH SAJÁT IDŐPONTJÁVAL
    // ========================================================

    if (
      Number.isFinite(data.total) &&
      Number.isFinite(
        data.oahTimestamp
      )
    ) {

      await env.DB.prepare(
        `INSERT INTO measurements
        (ts,power,water,flow,temp)
        VALUES (?, ?, NULL, NULL, NULL)
        ON CONFLICT(ts)
        DO UPDATE SET
        power = excluded.power`
      )
      .bind(
        data.oahTimestamp,
        data.total
      )
      .run();
    }


    // ========================================================
    // VÍZÜGY
    //
    // CSAK A VÍZÜGY SAJÁT
    // KÖZZÉTÉTELI IDŐPONTJÁVAL.
    //
    // UGYANAZ AZ IDŐPONT =
    // UGYANAZ A D1 SOR.
    //
    // NINCS 5 PERCES HAMIS PONT.
    // ========================================================

    if (
      Number.isFinite(
        data.water
      ) &&
      Number.isFinite(
        data.riverTimestamp
      )
    ) {

      await env.DB.prepare(
        `INSERT INTO measurements
        (ts,power,water,flow,temp)
        VALUES (?, NULL, ?, ?, ?)
        ON CONFLICT(ts)
        DO UPDATE SET
        water = excluded.water,
        flow = excluded.flow,
        temp = excluded.temp`
      )
      .bind(
        data.riverTimestamp,
        data.water,

        Number.isFinite(
          data.flow
        )
          ? data.flow
          : null,

        Number.isFinite(
          data.temp
        )
          ? data.temp
          : null
      )
      .run();
    }


    // 11 napot tartunk meg

    const cutoff =
      Date.now() -
      11 *
      24 *
      60 *
      60 *
      1000;


    await env.DB.prepare(
      "DELETE FROM measurements WHERE ts < ?"
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
    // FB IMAGE
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
    // HISTORY API
    // ========================================================

    if (
      url.pathname ===
      "/api/history"
    ) {

      try {

        await ensureDB(env);


        let hours =
          Number(
            url.searchParams.get(
              "hours"
            ) || 6
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
          await env.DB.prepare(
            `SELECT
              ts,
              power,
              water,
              flow,
              temp
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
              count:
                result.results?.length ||
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
    // AKTUÁLIS ADAT
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
      heatTemp,
      heatDate,
      heatStatus,
      oahTime,
      riverTime,
      oahStatus,
      riverStatus
    } = data;


    // ========================================================
    // KIJELZŐSZÖVEGEK
    // ========================================================

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
        ? `${Math.round(flow)} m³/s`
        : "— m³/s";


    const tempText =
      Number.isFinite(temp)
        ? `${fmt1(temp)} °C`
        : "— °C";


    const heatText =
      Number.isFinite(heatTemp)
        ? `${fmt1(heatTemp)} °C`
        : "— °C";


    // ========================================================
    // VÍZSZINT STÁTUSZ
    // ========================================================

    const shutdownDistance =
      Number.isFinite(water)
        ? water + 134
        : null;


    const safetyDistance =
      Number.isFinite(water)
        ? water + 144
        : null;


    let riverClass =
      "normal";

    let riverLabel =
      "NORMÁL TARTOMÁNY";


    if (
      Number.isFinite(water)
    ) {

      if (
        water <= -144
      ) {

        riverClass =
          "danger";

        riverLabel =
          "KRITIKUS VÍZSZINT";

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
        ((-110 - water) / 40) *
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
    // HŐCSÓVA STÁTUSZ
    // ========================================================

    let heatClass =
      "normal";

    let heatLabel =
      Number.isFinite(heatTemp)
        ? "NORMÁL TARTOMÁNY"
        : "MVM NAPI MÉRÉS";


    if (
      Number.isFinite(heatTemp)
    ) {

      if (
        heatTemp >= 30
      ) {

        heatClass =
          "danger";

        heatLabel =
          "HŐMÉRSÉKLETI HATÁR";

      } else if (
        heatTemp >= 29.5
      ) {

        heatClass =
          "warning";

        heatLabel =
          "BEAVATKOZÁSI TARTOMÁNY";

      } else if (
        heatTemp >= 29
      ) {

        heatClass =
          "warning";

        heatLabel =
          "HATÁR KÖZELÉBEN";
      }
    }


    const heatPct =
      Number.isFinite(heatTemp)
        ? Math.max(
            0,
            Math.min(
              100,
              (
                (heatTemp - 24) /
                7.5
              ) *
              100
            )
          )
        : 0;


    // ========================================================
    // HTML
    // ========================================================

    const html = `<!doctype html>
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

<title>⚛️ PAKS AKTUÁLIS ADATOK</title>

<meta
  property="og:type"
  content="website"
>

<meta
  property="og:title"
  content="⚛️ PAKS AKTUÁLIS ADATOK"
>

<meta
  property="og:description"
  content="Paksi Atomerőmű • Duna • vízállás • vízhőmérséklet • hőcsóva"
>

<meta
  property="og:url"
  content="${PUBLIC_URL}/"
>

<meta
  property="og:image"
  content="${PUBLIC_URL}/facebook-image"
>

<meta
  name="twitter:card"
  content="summary_large_image"
>

<meta
  name="twitter:image"
  content="${PUBLIC_URL}/facebook-image"
>


<style>

:root{
  --bg:#030812;
  --panel:#07111d;
  --panel2:#0c1825;
  --border:#1b3b57;
  --white:#f6f8fb;
  --muted:#8f9daf;
  --green:#66df57;
  --blue:#49a9ff;
  --orange:#ffad30;
  --red:#ff5c61;
  --purple:#bf4cff;
}

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  width:100%;
  min-height:100%;
  background:
    radial-gradient(
      circle at 50% -10%,
      #0d2037 0%,
      #040b14 35%,
      #02060b 75%
    );
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
}

.app{
  width:min(100%,520px);
  margin:auto;
  padding:
    max(8px,env(safe-area-inset-top))
    9px
    max(8px,env(safe-area-inset-bottom));
}

.header{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:8px;
  margin-bottom:7px;
}

.logo{
  width:40px;
  height:40px;
  border-radius:12px;
  display:grid;
  place-items:center;
  font-size:24px;
  background:
    linear-gradient(
      145deg,
      #bd53ff,
      #55117d
    );
}

.title{
  font-size:20px;
  line-height:.98;
  font-weight:950;
  letter-spacing:-.6px;
}

.live{
  display:flex;
  align-items:center;
  gap:5px;
  padding:5px 8px;
  border-radius:999px;
  background:#0c2111;
  border:1px solid #275a31;
  color:#73e66a;
  font-size:9px;
  font-weight:900;
}

.liveDot{
  width:7px;
  height:7px;
  border-radius:50%;
  background:#73e66a;
  box-shadow:0 0 8px #73e66a;
}

.card{
  background:
    linear-gradient(
      145deg,
      #09131f,
      #06101a
    );
  border:1px solid var(--border);
  border-radius:17px;
  overflow:hidden;
  margin-bottom:7px;
}

.inner{
  padding:10px;
}

.cardTitle{
  color:#a5b1bf;
  font-size:10px;
  letter-spacing:.55px;
  font-weight:850;
}

.mainRow{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  margin:4px 0 7px;
}

.big{
  font-size:40px;
  line-height:.95;
  letter-spacing:-1.5px;
  font-weight:950;
}

.power{
  color:var(--green);
}

.water{
  color:var(--blue);
}

.heat{
  color:var(--orange);
}

.caption{
  padding-bottom:3px;
  color:#78879a;
  font-size:8px;
}

.status{
  padding-bottom:3px;
  font-size:9px;
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

.chartBox{
  margin-bottom:7px;
  padding:7px 7px 4px;
  background:#050e18;
  border:1px solid #132b40;
  border-radius:11px;
}

.chartTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:6px;
  margin-bottom:4px;
}

.chartTitle{
  color:#8f9eb1;
  font-size:7px;
  font-weight:800;
}

.periods{
  display:flex;
  gap:3px;
}

.periodButton{
  border:0;
  padding:3px 6px;
  border-radius:999px;
  background:#111e2b;
  color:#8394a8;
  font-size:7px;
  font-weight:850;
}

.periodButton.active{
  color:white;
  background:#234663;
}

.chartWrap{
  position:relative;
  width:100%;
  height:92px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
}

.block{
  padding:6px 8px;
  background:var(--panel2);
  border-radius:9px;
  border:1px solid #142b3f;
}

.blockName{
  color:#8c9bad;
  font-size:7px;
}

.blockValue{
  margin-top:2px;
  font-size:17px;
  line-height:1;
  font-weight:900;
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
}

.metric{
  padding:6px 8px;
  border-radius:9px;
  background:var(--panel2);
}

.metricName{
  color:#8c9bad;
  font-size:7px;
}

.metricValue{
  margin-top:2px;
  font-size:16px;
  font-weight:900;
}

.gauge{
  position:relative;
  height:9px;
  border-radius:999px;
  margin-top:7px;
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
  position:absolute;
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
  grid-template-columns:1fr 1fr 1fr;
  margin-top:3px;
  font-size:7px;
}

.scale span:nth-child(2){
  text-align:center;
  color:var(--orange);
}

.scale span:nth-child(3){
  text-align:right;
  color:var(--red);
}

.distances{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:5px;
  margin-top:5px;
}

.distance{
  padding:5px 7px;
  border-radius:9px;
  background:var(--panel2);
}

.distanceValue{
  font-size:13px;
  font-weight:950;
}

.distanceLabel{
  color:#78889b;
  font-size:6px;
}

.source{
  padding:5px 10px;
  border-top:1px solid #172e42;
  color:#718296;
  font-size:7px;
}

.bottom{
  display:grid;
  grid-template-columns:.55fr 1.55fr;
  gap:5px;
}

.signature{
  display:grid;
  place-items:center;
  min-height:43px;
  border:1px solid #3e2255;
  border-radius:11px;
  background:#100817;
  color:var(--purple);
  font-size:12px;
  font-weight:950;
  letter-spacing:2px;
}

.share{
  min-width:0;
  border:1px solid #17334a;
  border-radius:11px;
  background:#07111c;
  padding:5px;
}

.shareTitle{
  color:#8494a7;
  font-size:7px;
  margin-bottom:3px;
}

.shareRow{
  display:grid;
  grid-template-columns:1fr 57px;
  gap:4px;
}

.url{
  min-width:0;
  height:25px;
  display:flex;
  align-items:center;
  padding:0 6px;
  border:1px solid #9e38cf;
  border-radius:7px;
  background:#180b20;
  color:#d353ff;
  font-size:6.5px;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  text-decoration:none;
}

.copy{
  height:25px;
  border:0;
  border-radius:7px;
  background:#142130;
  color:white;
  font-size:7px;
  font-weight:900;
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
  border-radius:999px;
  background:#102819;
  border:1px solid #347b41;
  color:#7bea70;
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

@media(min-width:800px){

  .app{
    width:min(1200px,96vw);
  }

  .cards{
    display:grid;
    grid-template-columns:1fr 1fr;
    gap:12px;
  }

  .card{
    margin-bottom:0;
  }

  .chartWrap{
    height:180px;
  }

  .big{
    font-size:70px;
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
      PAKS<br>
      AKTUÁLIS ADATOK
    </div>

    <div class="live">
      <span class="liveDot"></span>
      ÉLŐ
    </div>

  </div>


  <div class="cards">

    <!-- ================================================
         ERŐMŰ
    ================================================= -->

    <div class="card">

      <div class="inner">

        <div class="cardTitle">
          ⚛ PAKSI ATOMERŐMŰ
        </div>

        <div class="mainRow">

          <div class="big power">
            ${totalText}
          </div>

          <div class="caption">
            ${oahStatus}<br>
            ${oahTime}
          </div>

        </div>


        <div class="chartBox">

          <div class="chartTop">

            <div class="chartTitle">
              TELJESÍTMÉNY
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
            <canvas id="powerChart"></canvas>
          </div>

        </div>


        <div class="blocks">

          ${blocks.map(
            (value, index) => `
            <div class="block">

              <div class="blockName">
                ${index + 1}. BLOKK
              </div>

              <div class="blockValue">
                ${value === "—"
                  ? "—"
                  : value + " MW"}
              </div>

            </div>
          `
          ).join("")}

        </div>

      </div>

      <div class="source">
        Forrás: OAH • mérés:
        ${oahTime}
      </div>

    </div>


    <!-- ================================================
         DUNA
    ================================================= -->

    <div class="card">

      <div class="inner">

        <div class="cardTitle">
          🌊 DUNA – PAKS
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
              VÍZÁLLÁS
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
            <canvas id="waterChart"></canvas>
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
              DUNA VÍZHŐMÉRSÉKLET
            </div>

            <div class="metricValue">
              ${tempText}
            </div>

          </div>

        </div>


        <div class="gauge">

          <div
            class="marker"
            style="left:${markerPct}%"
          ></div>

        </div>

        <div class="scale">

          <span>
            normál
          </span>

          <span>
            −134 cm
          </span>

          <span>
            −144 cm
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
              −134 CM-ES SZINTIG
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
              −144 CM-ES SZINTIG
            </div>

          </div>

        </div>

      </div>

      <div class="source">
        Forrás: Vízügy •
        ${riverStatus} •
        mérés:
        ${riverTime}
      </div>

    </div>

  </div>


  <!-- ==================================================
       HŐCSÓVA
  =================================================== -->

  <div class="card">

    <div class="inner">

      <div class="cardTitle">
        🌡️ ERŐMŰ HŐTERHELÉS – 500 M-ES SZELVÉNY
      </div>


      <div class="mainRow">

        <div class="big heat">
          ${heatText}
        </div>

        <div
          class="status ${heatClass}"
        >
          ${heatLabel}
        </div>

      </div>


      <div class="metrics">

        <div class="metric">

          <div class="metricName">
            BEAVATKOZÁSI SZINT
          </div>

          <div class="metricValue">
            29,5 °C
          </div>

        </div>


        <div class="metric">

          <div class="metricName">
            NORMÁL HATÁR
          </div>

          <div class="metricValue">
            30,0 °C
          </div>

        </div>

      </div>


      <div
        class="gauge"
        style="
          background:
            linear-gradient(
              90deg,
              #52c85a 0%,
              #52c85a 73%,
              #ffad30 73%,
              #ffad30 80%,
              #ef555b 80%,
              #ef555b 100%
            );
        "
      >

        ${
          Number.isFinite(
            heatTemp
          )
            ? `
              <div
                class="marker"
                style="left:${heatPct}%"
              ></div>
            `
            : ""
        }

      </div>


      <div class="scale">

        <span>
          24 °C
        </span>

        <span>
          29,5 °C
        </span>

        <span>
          30,0 °C
        </span>

      </div>


      <div
        style="
          margin-top:7px;
          color:#7d8da0;
          font-size:7px;
          line-height:1.4;
        "
      >
        Az 500 m-es hőcsóva hivatalos
        mérése napi közzététel.
        Nem generálunk belőle
        5 perces mesterséges adatot.
      </div>

    </div>


    <div class="source">
      Forrás: MVM Paksi Atomerőmű •
      ${heatStatus} •
      legutóbbi közzététel:
      ${heatDate}
    </div>

  </div>


  <!-- ==================================================
       ALSÓ RÉSZ
  =================================================== -->

  <div class="bottom">

    <div class="signature">
      IGLÓDI
    </div>


    <div class="share">

      <div class="shareTitle">
        MEGOSZTÁS
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
          MÁSOL
        </button>

      </div>

    </div>

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
  power: 6,
  water: 6
};


let historyCache = {};


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
        hours,
        {
          cache: "no-store"
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
    historyCache[hours]
  ) {

    return historyCache[hours];
  }


  const data =
    await getHistory(
      hours
    );


  historyCache[hours] =
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
          x: Number(row.ts),
          y: Number(row[field])
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


  const rect =
    canvas.getBoundingClientRect();


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


  // ==========================================================
  // RÁCS
  // ==========================================================

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
      i / 4;


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
      "Adatgyűjtés folyamatban…",
      pad.left + 8,
      H / 2
    );

    return;
  }


  // ==========================================================
  // Y TARTOMÁNY
  // ==========================================================

  let minY =
    Math.min(
      ...data.map(
        p => p.y
      )
    );


  let maxY =
    Math.max(
      ...data.map(
        p => p.y
      )
    );


  if (
    minY === maxY
  ) {

    const delta =
      Math.max(
        1,
        Math.abs(minY) *
        .02
      );


    minY -= delta;
    maxY += delta;
  }


  const margin =
    Math.max(
      field === "water"
        ? 1
        : 5,

      (maxY - minY) *
      .15
    );


  minY -= margin;
  maxY += margin;


  // ==========================================================
  // X TARTOMÁNY
  // ==========================================================

  const maxX =
    Date.now();


  const minX =
    maxX -
    hours *
    60 *
    60 *
    1000;


  const sx = x =>
    pad.left +
    (
      (x - minX) /
      (maxX - minX)
    ) *
    chartW;


  const sy = y =>
    pad.top +
    (
      (maxY - y) /
      (maxY - minY)
    ) *
    chartH;


  // ==========================================================
  // Y FELIRAT
  // ==========================================================

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
        maxY - minY
      ) *
      i / 2;


    const y =
      pad.top +
      chartH *
      i / 2;


    ctx.fillText(
      Math.round(value) +
      " " +
      unit,
      pad.left - 4,
      y + 3
    );
  }


  // ==========================================================
  // IDŐTENGELY
  // ==========================================================

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

    const t =
      minX +
      (
        maxX - minX
      ) *
      i /
      divisions;


    const d =
      new Date(t);


    const label =
      hours >= 240
        ? d.toLocaleDateString(
            "hu-HU",
            {
              month: "2-digit",
              day: "2-digit"
            }
          )
        : d.toLocaleTimeString(
            "hu-HU",
            {
              hour: "2-digit",
              minute: "2-digit"
            }
          );


    ctx.fillText(
      label,
      sx(t),
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
    "round";

  ctx.lineCap =
    "round";


  // ==========================================================
  // EGYETLEN PONT
  // ==========================================================

  if (
    data.length === 1
  ) {

    const p =
      data[0];


    /*
      Egyetlen mérés esetén is
      az értéket a jelenig tartjuk.
    */

    ctx.beginPath();

    ctx.moveTo(
      Math.max(
        pad.left,
        sx(p.x)
      ),
      sy(p.y)
    );

    ctx.lineTo(
      sx(maxX),
      sy(p.y)
    );

    ctx.stroke();


    ctx.beginPath();

    ctx.arc(
      Math.max(
        pad.left,
        sx(p.x)
      ),
      sy(p.y),
      3.5,
      0,
      Math.PI * 2
    );

    ctx.fill();

    return;
  }


  // ==========================================================
  // GRAFIKON
  // ==========================================================

  ctx.beginPath();


  /*
    VÍZÁLLÁSNÁL LÉPCSŐS VONAL.

    Az előző értéket tartjuk
    egészen az új hivatalos
    mérés időpontjáig.

    Nincs mesterséges köztes érték.
  */

  if (
    field === "water"
  ) {

    const first =
      data[0];


    ctx.moveTo(
      sx(first.x),
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


      // vízszintesen az új időig
      ctx.lineTo(
        sx(current.x),
        sy(previous.y)
      );


      // az új mérés időpontjában ugrás
      ctx.lineTo(
        sx(current.x),
        sy(current.y)
      );
    }


    const last =
      data[
        data.length - 1
      ];


    // utolsó mérés a jelenig
    ctx.lineTo(
      sx(maxX),
      sy(last.y)
    );


  } else {

    /*
      Teljesítménynél marad a
      normál összekötés.
    */

    data.forEach(
      (
        point,
        index
      ) => {

        if (
          index === 0
        ) {

          ctx.moveTo(
            sx(point.x),
            sy(point.y)
          );

        } else {

          ctx.lineTo(
            sx(point.x),
            sy(point.y)
          );
        }
      }
    );
  }


  ctx.stroke();


  // ==========================================================
  // UTOLSÓ PONT
  // ==========================================================

  const last =
    data[
      data.length - 1
    ];


  ctx.beginPath();

  ctx.arc(
    sx(last.x),
    sy(last.y),
    3.3,
    0,
    Math.PI * 2
  );

  ctx.fill();
}


// ============================================================
// ÚJRARAJZOLÁS
// ============================================================

async function redraw() {

  await Promise.all([

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

  ]);
}


// ============================================================
// IDŐTARTOMÁNY GOMB
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
      item =>
        item.classList.remove(
          "active"
        )
    );


  button.classList.add(
    "active"
  );


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


// ============================================================
// ESEMÉNYEK
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

        await navigator.clipboard.writeText(
          PUBLIC_URL
        );


        const toast =
          document.getElementById(
            "toast"
          );


        toast.classList.add(
          "show"
        );


        setTimeout(
          () =>
            toast.classList.remove(
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
            "no-store"
        }
      }
    );
  }
};
