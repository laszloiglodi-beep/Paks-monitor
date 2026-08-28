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


function clean(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&minus;|&#8722;/gi, "-")
    .replace(/\s+/g, " ")
    .trim();
}


function fmt1(value) {
  return Number.isFinite(value)
    ? value.toLocaleString("hu-HU", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      })
    : "—";
}


function shortTime(value) {
  const m = String(value || "").match(/(\d{2}:\d{2})/);
  return m ? m[1] : "—";
}


function huTs(value) {
  return Date.parse(value);
}


// ============================================================
// D1
// ============================================================

async function ensureDB(env) {

  if (!env?.DB) {
    throw new Error("DB binding missing");
  }

  await env.DB
    .prepare(
      "CREATE TABLE IF NOT EXISTS measurements (" +
      "ts INTEGER PRIMARY KEY, " +
      "power INTEGER, " +
      "water INTEGER, " +
      "flow REAL, " +
      "temp REAL" +
      ")"
    )
    .run();

  await env.DB
    .prepare(
      "CREATE TABLE IF NOT EXISTS meta (" +
      "key TEXT PRIMARY KEY, " +
      "value TEXT" +
      ")"
    )
    .run();

  await seedHistory(env);
}


// ============================================================
// FIX RÉGI PONTOK
// ============================================================

async function seedHistory(env) {

  const already =
    await env.DB
      .prepare(
        "SELECT value FROM meta WHERE key = ?"
      )
      .bind("seed_v4")
      .first();

  if (already) return;


  const rows = [

    // --------------------------------------------------------
    // KORÁBBI DUNA-PONTOK
    // --------------------------------------------------------

    ["2026-08-18T00:00:00+02:00", null, -129, 754.1, 25.8],

    ["2026-08-20T00:00:00+02:00", null, -127, null, null],

    ["2026-08-21T00:00:00+02:00", null, -118, null, null],

    ["2026-08-22T00:00:00+02:00", null, -101, null, null],

    ["2026-08-23T00:00:00+02:00", null, -84, null, null],

    ["2026-08-24T00:00:00+02:00", null, -71, null, null],

    ["2026-08-25T00:00:00+02:00", null, -65, null, null],


    // --------------------------------------------------------
    // 2026.08.26.
    // --------------------------------------------------------

    ["2026-08-26T00:00:00+02:00", null, -65, 1009, 24.3],
    ["2026-08-26T03:00:00+02:00", null, -65, 1007, 24.1],
    ["2026-08-26T06:00:00+02:00", null, -66, 1000, 23.9],
    ["2026-08-26T09:00:00+02:00", null, -67, 993.7, 23.8],
    ["2026-08-26T12:00:00+02:00", null, -68, null, null],
    ["2026-08-26T18:00:00+02:00", null, -70, null, null],
    ["2026-08-26T23:30:00+02:00", null, -74, 962, 24.3],


    // --------------------------------------------------------
    // 2026.08.27.
    // --------------------------------------------------------

    ["2026-08-27T00:00:00+02:00", null, -74, 962, 24.2],
    ["2026-08-27T01:00:00+02:00", null, -75, 958, 24.1],
    ["2026-08-27T02:00:00+02:00", null, -75, 958, 24.1],
    ["2026-08-27T03:00:00+02:00", null, -76, 953, 24.1],
    ["2026-08-27T04:00:00+02:00", null, -77, 950, 24.0],
    ["2026-08-27T05:00:00+02:00", null, -77, 948, 24.0],
    ["2026-08-27T06:00:00+02:00", null, -78, 946, 23.9],
    ["2026-08-27T07:00:00+02:00", null, -79, 941, 23.8],
    ["2026-08-27T08:00:00+02:00", null, -79, 941, 23.8],
    ["2026-08-27T09:00:00+02:00", null, -81, 934, 23.8],
    ["2026-08-27T12:00:00+02:00", null, -82, null, null],
    ["2026-08-27T15:00:00+02:00", null, -84, null, null],
    ["2026-08-27T18:00:00+02:00", null, -85, 920, 25.2],
    ["2026-08-27T21:00:00+02:00", null, -86, 915, 24.7],
    ["2026-08-27T23:00:00+02:00", null, -87, 911, 24.5],


    // --------------------------------------------------------
    // 2026.08.28.
    // --------------------------------------------------------

    ["2026-08-28T00:00:00+02:00", null, -87, 911, 24.4],
    ["2026-08-28T00:30:00+02:00", null, -87, 911, 24.3],
    ["2026-08-28T01:00:00+02:00", null, -87, 911, 24.3],
    ["2026-08-28T01:30:00+02:00", null, -88, 908, 24.2],


    // --------------------------------------------------------
    // TELJESÍTMÉNY – BIZTOS PONTOK
    // --------------------------------------------------------

    ["2026-08-18T00:00:00+02:00", 480, null, null, null],

    ["2026-08-21T00:00:00+02:00", 480, null, null, null],

    ["2026-08-23T00:00:00+02:00", 960, null, null, null],

    ["2026-08-23T12:00:00+02:00", 1440, null, null, null],

    ["2026-08-24T07:00:00+02:00", 1460, null, null, null],

    ["2026-08-24T18:00:00+02:00", 1900, null, null, null],

    ["2026-08-26T16:35:00+02:00", 1950, null, null, null],

    ["2026-08-28T06:31:00+02:00", 1952, null, null, null]

  ];


  const statements =
    rows.map(row =>
      env.DB
        .prepare(
          "INSERT OR IGNORE INTO measurements " +
          "(ts,power,water,flow,temp) " +
          "VALUES (?,?,?,?,?)"
        )
        .bind(
          huTs(row[0]),
          row[1],
          row[2],
          row[3],
          row[4]
        )
    );


  statements.push(
    env.DB
      .prepare(
        "INSERT OR REPLACE INTO meta " +
        "(key,value) VALUES (?,?)"
      )
      .bind(
        "seed_v4",
        new Date().toISOString()
      )
  );


  await env.DB.batch(statements);
}


// ============================================================
// OAH
// ============================================================

async function fetchOah() {

  let blocks =
    ["—", "—", "—", "—"];

  let time = "—";
  let status = "OK";


  try {

    const response =
      await fetch(
        OAH_URL + "&_=" + Date.now(),
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/1.0)",
            "Cache-Control":
              "no-cache"
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
        /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
      );


    if (date) {
      time = date[1];
    }


    const power =
      text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );


    if (power) {

      blocks = [
        power[1],
        power[2],
        power[3],
        power[4]
      ];

    } else {

      status =
        "ADATHIBA";
    }


  } catch (error) {

    status =
      "KAPCSOLATI HIBA";
  }


  const total =
    blocks.every(
      value =>
        /^\d+$/.test(
          String(value)
        )
    )
      ? blocks.reduce(
          (sum, value) =>
            sum + Number(value),
          0
        )
      : null;


  return {
    blocks,
    total,
    time,
    status
  };
}


// ============================================================
// VÍZÜGY PARSER
// ============================================================

function parseViz(text) {

  const patterns = [

    /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+(?:[.,]\d+)?|-)\s+(\d+(?:[.,]\d+)?|-)(?:\s+(\d+(?:[.,]\d+)?|-))?/,

    /(20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2})\s+(-?\d+)\s+(\d+(?:[.,]\d+)?|-)\s+(\d+(?:[.,]\d+)?|-)(?:\s+(\d+(?:[.,]\d+)?|-))?/

  ];


  let row = null;


  for (const pattern of patterns) {

    row =
      text.match(pattern);

    if (row) break;
  }


  if (!row) {
    return null;
  }


  const num =
    value => {

      if (
        !value ||
        value === "-"
      ) {
        return null;
      }


      let s =
        String(value)
          .trim();


      // 1009,000 a Vízügy oldalán = 1009 m3/s
      if (
        /^\d+,\d{3}$/.test(s) &&
        Number(s.split(",")[0]) > 100
      ) {

        s =
          s.split(",")[0];

      } else {

        s =
          s.replace(",", ".");
      }


      const n =
        Number(s);


      return Number.isFinite(n)
        ? n
        : null;
    };


  return {

    time:
      row[1],

    water:
      num(row[2]),

    flow:
      num(row[3]),

    temp:
      num(row[4]) ??
      num(row[5])

  };
}


// ============================================================
// VÍZÜGY
// ============================================================

async function fetchViz() {

  let lastError =
    "";


  for (const baseUrl of VIZ_URLS) {

    try {

      const separator =
        baseUrl.includes("?")
          ? "&"
          : "?";


      const url =
        baseUrl +
        separator +
        "_=" +
        Date.now();


      const response =
        await fetch(
          url,
          {
            headers: {

              "User-Agent":
                "Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1",

              "Accept":
                "text/html,application/xhtml+xml",

              "Accept-Language":
                "hu-HU,hu;q=0.9",

              "Cache-Control":
                "no-cache",

              "Pragma":
                "no-cache"
            }
          }
        );


      if (!response.ok) {

        lastError =
          "HTTP " +
          response.status;

        continue;
      }


      const html =
        await response.text();


      const text =
        clean(html);


      const parsed =
        parseViz(text);


      if (
        parsed &&
        Number.isFinite(
          parsed.water
        )
      ) {

        return {
          ...parsed,
          status:
            "OK"
        };
      }


      lastError =
        "ADATHIBA";


    } catch (error) {

      lastError =
        error?.message ||
        String(error);
    }
  }


  return {

    time:
      "—",

    water:
      null,

    flow:
      null,

    temp:
      null,

    status:
      lastError === "ADATHIBA"
        ? "ADATHIBA"
        : "KAPCSOLATI HIBA"
  };
}


// ============================================================
// UTOLSÓ MENTETT DUNA-ADAT
// ============================================================

async function lastStoredRiver(env) {

  try {

    await ensureDB(env);


    const row =
      await env.DB
        .prepare(
          "SELECT ts,water,flow,temp " +
          "FROM measurements " +
          "WHERE water IS NOT NULL " +
          "ORDER BY ts DESC " +
          "LIMIT 1"
        )
        .first();


    return row || null;


  } catch (error) {

    return null;
  }
}


// ============================================================
// AKTUÁLIS ADATOK
// ============================================================

async function getCurrentData(env) {

  const [
    oah,
    viz
  ] =
    await Promise.all([
      fetchOah(),
      fetchViz()
    ]);


  let finalViz =
    viz;


  // Ha a Vízügy pillanatnyilag nem válaszol,
  // legalább az UTOLSÓ VALÓS mentett értéket mutatjuk.
  // Nem nevezzük élő adatnak.

  if (
    !Number.isFinite(
      finalViz.water
    ) &&
    env?.DB
  ) {

    const stored =
      await lastStoredRiver(env);


    if (
      stored &&
      Number.isFinite(
        Number(stored.water)
      )
    ) {

      const d =
        new Date(
          Number(stored.ts)
        );


      finalViz = {

        water:
          Number(stored.water),

        flow:
          stored.flow === null
            ? null
            : Number(stored.flow),

        temp:
          stored.temp === null
            ? null
            : Number(stored.temp),

        time:
          d.toLocaleTimeString(
            "hu-HU",
            {
              hour:"2-digit",
              minute:"2-digit",
              timeZone:
                "Europe/Budapest"
            }
          ),

        status:
          "UTOLSÓ MENTETT ADAT"
      };
    }
  }


  return {

    blocks:
      oah.blocks,

    total:
      oah.total,

    oahTime:
      oah.time,

    oahStatus:
      oah.status,

    water:
      finalViz.water,

    flow:
      finalViz.flow,

    temp:
      finalViz.temp,

    riverTime:
      finalViz.time,

    riverStatus:
      finalViz.status
  };
}


// ============================================================
// MENTÉS
// ============================================================

async function saveMeasurement(
  env,
  data
) {

  try {

    await ensureDB(env);


    const bucket =
      Math.floor(
        Date.now() /
        300000
      ) *
      300000;


    await env.DB
      .prepare(
        "INSERT OR REPLACE INTO measurements " +
        "(ts,power,water,flow,temp) " +
        "VALUES (?,?,?,?,?)"
      )
      .bind(

        bucket,

        Number.isFinite(
          data.total
        )
          ? data.total
          : null,

        Number.isFinite(
          data.water
        )
          ? data.water
          : null,

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


    const cutoff =
      Date.now() -
      11 *
      24 *
      60 *
      60 *
      1000;


    await env.DB
      .prepare(
        "DELETE FROM measurements " +
        "WHERE ts < ?"
      )
      .bind(cutoff)
      .run();


  } catch (error) {

    console.log(
      "D1 SAVE ERROR",
      error?.message ||
      String(error)
    );
  }
}


// ============================================================
// HTML
// ============================================================

function render(data) {

  const {
    blocks,
    total,
    water,
    flow,
    temp,
    oahTime,
    riverTime,
    oahStatus,
    riverStatus
  } = data;


  const totalText =
    Number.isFinite(total)
      ? `${total} MW`
      : "— MW";


  const waterText =
    Number.isFinite(water)
      ? `${water} cm`
      : "— cm";


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


  if (Number.isFinite(water)) {

    if (water <= -144) {

      riverClass =
        "danger";

      riverLabel =
        "KRITIKUS VÍZSZINT";

    } else if (water <= -134) {

      riverClass =
        "warning";

      riverLabel =
        "LEÁLLÁSI TARTOMÁNY";

    } else if (water <= -129) {

      riverClass =
        "warning";

      riverLabel =
        "FIGYELMEZTETÉS";
    }
  }


  const markerPct =
    Number.isFinite(water)
      ? Math.max(
          0,
          Math.min(
            100,
            (
              (-110 - water) /
              40
            ) *
            100
          )
        )
      : 0;


  return `<!doctype html>

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


<meta property="og:type" content="website">

<meta
  property="og:title"
  content="⚛️ PAKS AKTUÁLIS ADATOK"
>

<meta
  property="og:description"
  content="Paksi Atomerőmű • Duna vízállás • vízhozam • vízhőmérséklet • élő adatok"
>

<meta
  property="og:url"
  content="${PUBLIC_URL}/"
>

<meta
  property="og:image"
  content="${PUBLIC_URL}/facebook-image"
>


<style>

:root{
  --panel2:#0c1825;
  --border:#1b3b57;
  --white:#f6f8fb;
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

.app{
  width:min(100%,520px);
  margin:auto;
  padding:
    max(8px,env(safe-area-inset-top))
    9px
    max(7px,env(safe-area-inset-bottom));
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
  font-weight:950;
}

.power{
  color:var(--green);
}

.water{
  color:var(--blue);
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

.blocks,
.metrics,
.distances{
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

.blockName,
.metricName{
  color:#8c9bad;
  font-size:7px;
}

.blockValue{
  margin-top:2px;
  font-size:17px;
  font-weight:900;
}

.metric{
  padding:6px 8px;
  border-radius:9px;
  background:var(--panel2);
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
  left:${markerPct}%;
  top:-5px;
  width:3px;
  height:19px;
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

.scale span:nth-child(1){
  color:#7e8c9d;
}

.scale span:nth-child(2){
  text-align:center;
  color:var(--orange);
}

.scale span:nth-child(3){
  text-align:right;
  color:var(--red);
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

</style>


<script>

// ============================================================
// FONTOS: ALAPBÓL 10 NAP
// ============================================================

let selectedRange = {
  power:240,
  water:240
};


let cache = {};


async function getHistory(hours){

  try{

    const response =
      await fetch(
        "/api/history?hours=" +
        hours,
        {
          cache:"no-store"
        }
      );

    const json =
      await response.json();

    return (
      json?.ok &&
      Array.isArray(json.data)
    )
      ? json.data
      : [];

  }catch(error){

    return [];
  }
}


async function loadHistory(hours){

  if(cache[hours]){
    return cache[hours];
  }

  return cache[hours] =
    await getHistory(hours);
}


async function drawChart(
  canvasId,
  field,
  hours,
  unit
){

  const canvas =
    document.getElementById(
      canvasId
    );

  if(!canvas){
    return;
  }


  const rows =
    await loadHistory(hours);


  const data =
    rows
      .filter(
        row =>
          row[field] !== null &&
          row[field] !== undefined
      )
      .map(
        row => ({
          x:Number(row.ts),
          y:Number(row[field])
        })
      )
      .filter(
        point =>
          Number.isFinite(point.x) &&
          Number.isFinite(point.y)
      );


  const rect =
    canvas.getBoundingClientRect();


  const ratio =
    window.devicePixelRatio || 1;


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
    canvas.getContext("2d");


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


  const pad = {
    left:38,
    right:8,
    top:8,
    bottom:20
  };


  ctx.clearRect(
    0,
    0,
    W,
    H
  );


  ctx.strokeStyle =
    "rgba(115,145,170,.18)";


  for(let i=0;i<=4;i++){

    const y =
      pad.top +
      (
        H -
        pad.top -
        pad.bottom
      ) *
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


  if(!data.length){

    ctx.fillStyle =
      "#718397";

    ctx.font =
      "10px -apple-system";

    ctx.fillText(
      "Adatgyűjtés folyamatban…",
      pad.left + 8,
      H / 2
    );

    return;
  }


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


  if(minY === maxY){

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
      1,
      (
        maxY -
        minY
      ) *
      .15
    );


  minY -= margin;
  maxY += margin;


  const now =
    Date.now();


  const minX =
    now -
    hours *
    3600000;


  const maxX =
    now;


  const chartW =
    W -
    pad.left -
    pad.right;


  const chartH =
    H -
    pad.top -
    pad.bottom;


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


  for(let i=0;i<=2;i++){

    const value =
      maxY -
      (
        maxY -
        minY
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


  ctx.textAlign =
    "center";


  const divisions =
    hours >= 240
      ? 4
      : 3;


  for(
    let i=0;
    i<=divisions;
    i++
  ){

    const time =
      minX +
      (
        maxX -
        minX
      ) *
      i /
      divisions;


    const date =
      new Date(time);


    const label =
      hours >= 240
        ? date.toLocaleDateString(
            "hu-HU",
            {
              month:"2-digit",
              day:"2-digit"
            }
          )
        : date.toLocaleTimeString(
            "hu-HU",
            {
              hour:"2-digit",
              minute:"2-digit"
            }
          );


    ctx.fillText(
      label,
      sx(time),
      H - 5
    );
  }


  const color =
    field === "power"
      ? "#66df57"
      : "#49a9ff";


  ctx.strokeStyle =
    color;

  ctx.fillStyle =
    color;

  ctx.lineWidth =
    2.2;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";


  if(data.length === 1){

    ctx.beginPath();

    ctx.arc(
      sx(data[0].x),
      sy(data[0].y),
      4,
      0,
      Math.PI * 2
    );

    ctx.fill();

    return;
  }


  ctx.beginPath();


  data.forEach(
    (point,index) => {

      if(index){

        ctx.lineTo(
          sx(point.x),
          sy(point.y)
        );

      }else{

        ctx.moveTo(
          sx(point.x),
          sy(point.y)
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
    Math.PI * 2
  );

  ctx.fill();
}


async function redraw(){

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


function setRange(
  chart,
  hours,
  button
){

  selectedRange[chart] =
    hours;


  document
    .querySelectorAll(
      '[data-chart="' +
      chart +
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
    .add("active");


  cache = {};

  redraw();
}


function copyLink(){

  navigator.clipboard
    ?.writeText(
      "${PUBLIC_URL}"
    );
}


window.addEventListener(
  "load",
  redraw
);


window.addEventListener(
  "resize",
  redraw
);


setInterval(
  async () => {

    cache = {};

    await redraw();

  },
  300000
);

</script>

</head>


<body>


<div class="app">


<header class="header">

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

</header>


<div class="cards">


<section class="card">

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
class="periodButton"
data-chart="power"
onclick="setRange('power',6,this)"
>
6 ÓRA
</button>

<button
class="periodButton"
data-chart="power"
onclick="setRange('power',24,this)"
>
24 ÓRA
</button>

<button
class="periodButton active"
data-chart="power"
onclick="setRange('power',240,this)"
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
  (block,index) =>
    `<div class="block">
      <div class="blockName">
        ${index + 1}. BLOKK
      </div>
      <div class="blockValue">
        ${block} MW
      </div>
    </div>`
).join("")}

</div>

</div>


<div class="source">

OAH
•
${shortTime(oahTime)}
•
${oahStatus}

</div>

</section>


<section class="card">

<div class="inner">


<div class="cardTitle">
🌊 DUNA VÍZÁLLÁSA PAKSNÁL
</div>


<div class="mainRow">

<div class="big water">
${waterText}
</div>

<div class="status ${riverClass}">
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
class="periodButton"
data-chart="water"
onclick="setRange('water',6,this)"
>
6 ÓRA
</button>

<button
class="periodButton"
data-chart="water"
onclick="setRange('water',24,this)"
>
24 ÓRA
</button>

<button
class="periodButton active"
data-chart="water"
onclick="setRange('water',240,this)"
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
${fmt1(flow)} m³/s
</div>

</div>


<div class="metric">

<div class="metricName">
VÍZHŐMÉRSÉKLET
</div>

<div class="metricValue">
${fmt1(temp)} °C
</div>

</div>

</div>


<div class="gauge">

${
  Number.isFinite(water)
    ? `<div class="marker"></div>`
    : ""
}

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
  shutdownDistance !== null
    ? Math.abs(
        shutdownDistance
      ) +
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
  safetyDistance !== null
    ? Math.abs(
        safetyDistance
      ) +
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

VÍZÜGY
•
${shortTime(riverTime)}
•
${riverStatus}

</div>

</section>


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
target="_blank"
rel="noopener"
>
${PUBLIC_URL}
</a>

<button
class="copy"
onclick="copyLink()"
>
MÁSOLÁS
</button>

</div>

</div>

</div>


</div>

</body>

</html>`;
}


// ============================================================
// WORKER
// ============================================================

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
              status:404
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


      } catch (error) {

        return new Response(
          "Image unavailable",
          {
            status:503
          }
        );
      }
    }


    if (
      url.pathname ===
      "/api/history"
    ) {

      try {

        await ensureDB(env);


        let hours =
          Number(
            url
              .searchParams
              .get("hours") ||
            240
          );


        if (
          ![
            6,
            24,
            240
          ].includes(hours)
        ) {

          hours =
            240;
        }


        const cutoff =
          Date.now() -
          hours *
          3600000;


        const result =
          await env.DB
            .prepare(
              "SELECT " +
              "ts,power,water,flow,temp " +
              "FROM measurements " +
              "WHERE ts >= ? " +
              "ORDER BY ts ASC"
            )
            .bind(cutoff)
            .all();


        return Response.json(
          {
            ok:true,

            count:
              result.results
                ?.length ||
              0,

            data:
              result.results ||
              []
          },
          {
            headers: {
              "cache-control":
                "no-store"
            }
          }
        );


      } catch (error) {

        return Response.json(
          {
            ok:false,
            count:0,
            data:[],
            error:
              error?.message ||
              String(error)
          },
          {
            headers: {
              "cache-control":
                "no-store"
            }
          }
        );
      }
    }


    const data =
      await getCurrentData(
        env
      );


    ctx
      ?.waitUntil
      ?.(
        saveMeasurement(
          env,
          data
        )
      );


    return new Response(
      render(data),
      {
        headers: {
          "content-type":
            "text/html;charset=UTF-8",

          "cache-control":
            "no-store"
        }
      }
    );
  },


  async scheduled(
    controller,
    env,
    ctx
  ) {

    ctx.waitUntil(
      (
        async () => {

          const data =
            await getCurrentData(
              env
            );


          await saveMeasurement(
            env,
            data
          );

        }
      )()
    );
  }

};
