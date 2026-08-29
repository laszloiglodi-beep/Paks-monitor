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

    ["2026-08-18T00:00:00+02:00", null, -129, 754.1, 25.8],
    ["2026-08-20T00:00:00+02:00", null, -127, null, null],
    ["2026-08-21T00:00:00+02:00", null, -118, null, null],
    ["2026-08-22T00:00:00+02:00", null, -101, null, null],
    ["2026-08-23T00:00:00+02:00", null, -84, null, null],
    ["2026-08-24T00:00:00+02:00", null, -71, null, null],
    ["2026-08-25T00:00:00+02:00", null, -65, null, null],

    ["2026-08-26T00:00:00+02:00", null, -65, 1009, 24.3],
    ["2026-08-26T03:00:00+02:00", null, -65, 1007, 24.1],
    ["2026-08-26T06:00:00+02:00", null, -66, 1000, 23.9],
    ["2026-08-26T09:00:00+02:00", null, -67, 993.7, 23.8],
    ["2026-08-26T12:00:00+02:00", null, -68, null, null],
    ["2026-08-26T18:00:00+02:00", null, -70, null, null],
    ["2026-08-26T23:30:00+02:00", null, -74, 962, 24.3],

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

    ["2026-08-28T00:00:00+02:00", null, -87, 911, 24.4],
    ["2026-08-28T00:30:00+02:00", null, -87, 911, 24.3],
    ["2026-08-28T01:00:00+02:00", null, -87, 911, 24.3],
    ["2026-08-28T01:30:00+02:00", null, -88, 908, 24.2],

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

  let blocks = ["—", "—", "—", "—"];
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


   
