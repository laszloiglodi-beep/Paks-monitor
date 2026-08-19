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

const VERSION = "VPAKS03";

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
  const m = String(value || "").match(/(\d{2}:\d{2})/);
  return m ? m[1] : "—";
}


// ============================================================
// BUDAPEST IDŐ
// ============================================================

function getBudapestOffset(timestamp) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Budapest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  });

  const parts = formatter.formatToParts(new Date(timestamp));
  const values = {};

  for (const part of parts) {
    if (part.type !== "literal") {
      values[part.type] = Number(part.value);
    }
  }

  const localAsUTC = Date.UTC(
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
  const match = String(value || "").match(
    /(\d{4})\.\s*(\d{2})\.\s*(\d{2})\.?\s*(\d{2}):(\d{2})/
  );

  if (!match) return null;

  const desired = Date.UTC(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
    Number(match[4]),
    Number(match[5]),
    0
  );

  let timestamp = desired;

  for (let i = 0; i < 2; i++) {
    timestamp = desired - getBudapestOffset(timestamp);
  }

  return Number.isFinite(timestamp) ? timestamp : null;
}

function cmToMbf(cm, zero) {
  return Number.isFinite(cm) ? zero + cm / 100 : null;
}

function direction(current, previous) {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) {
    return { symbol: "→", cls: "flat" };
  }

  if (current > previous) return { symbol: "↑", cls: "up" };
  if (current < previous) return { symbol: "↓", cls: "down" };

  return { symbol: "→", cls: "flat" };
}


// ============================================================
// VÍZÜGY PARSER
// ============================================================

async function fetchVizStation(url, wantExtras = false) {
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
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VPAKS03)"
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: false
      }
    });

    if (!response.ok) {
      throw new Error("VIZ HTTP " + response.status);
    }

    const text = clean(await response.text());

    const rowRegex =
      /(20\d{2}\.\s*\d{2}\.\s*\d{2}\.?\s*\d{2}:\d{2})\s+(-?\d+)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)\s+(-|\d+(?:[.,]\d+)?)/g;

    const rows = [];
    let match;

    while ((match = rowRegex.exec(text)) !== null) {
      const timestamp = parseHuTimestamp(match[1]);
      if (!Number.isFinite(timestamp)) continue;

      rows.push({
        timestamp,
        time: match[1],
        water: Number(match[2]),
        flow: match[3],
        temp1: match[4],
        temp2: match[5]
      });
    }

    rows.sort((a, b) => a.timestamp - b.timestamp);

    if (!rows.length) {
      result.status = "ADATHIBA";
      return result;
    }

    const latest = rows[rows.length - 1];
    const previous = rows.length > 1 ? rows[rows.length - 2] : null;

    if (
      Number.isFinite(latest.water) &&
      latest.water > -1000 &&
      latest.water < 1000
    ) {
      result.value = latest.water;
    }

    result.previousValue =
      previous && Number.isFinite(previous.water)
        ? previous.water
        : null;

    result.time = latest.time;
    result.timestamp = latest.timestamp;

    if (wantExtras) {
      if (latest.flow !== "-") {
        const f = Number(latest.flow.replace(",", "."));
        if (Number.isFinite(f) && f >= 0 && f <= 20000) {
          result.flow = f;
        }
      }

      for (const raw of [latest.temp1, latest.temp2]) {
        if (!raw || raw === "-") continue;

        const t = Number(raw.replace(",", "."));
        if (Number.isFinite(t) && t >= 0 && t <= 40) {
          result.temp = t;
          break;
        }
      }
    }

    if (!Number.isFinite(result.value)) {
      result.status = "ADATHIBA";
    }

    return result;

  } catch (error) {
    result.status = "KAPCSOLATI HIBA";

    console.log(
      "VIZ ERROR:",
      error?.message || String(error)
    );

    return result;
  }
}


// ============================================================
// D1
// ============================================================

async function ensureDB(env) {
  if (!env || !env.DB) {
    throw new Error("DB binding missing");
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

  for (const sql of [
    `ALTER TABLE measurements ADD COLUMN hvcs INTEGER`,
    `ALTER TABLE measurements ADD COLUMN threshold_up INTEGER`,
    `ALTER TABLE measurements ADD COLUMN threshold_down INTEGER`
  ]) {
    try {
      await env.DB.prepare(sql).run();
    } catch {}
  }
}


// ============================================================
// AKTUÁLIS ADATOK
// ============================================================

async function getCurrentData() {
  let blocks = ["—", "—", "—", "—"];
  let oahTime = "—";
  let oahTimestamp = null;
  let oahStatus = "OK";

  try {
    const response = await fetch(OAH_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VPAKS03)"
      },
      cf: {
        cacheTtl: 60,
        cacheEverything: false
      }
    });

    if (!response.ok) {
      throw new Error("OAH HTTP " + response.status);
    }

    const text = clean(await response.text());

    const date = text.match(
      /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\.?\s*[0-9]{2}:[0-9]{2})/i
    );

    if (date) {
      oahTime = date[1];
      oahTimestamp = parseHuTimestamp(date[1]);
    }

    const mainPower = text.match(
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

      for (let i = 1; i <= 4; i++) {
        const re = new RegExp(
          i + "\\.\\s*blokk[^0-9]{0,150}(\\d+)\\s*MW",
          "i"
        );

        const m = text.match(re);
        if (m) values.push(m[1]);
      }

      if (values.length === 4) {
        blocks = values;
      } else {
        oahStatus = "ADATHIBA";
      }
    }

    if (!Number.isFinite(oahTimestamp)) {
      oahStatus = oahStatus === "OK" ? "IDŐHIBA" : oahStatus;
    }

  } catch (error) {
    oahStatus = "KAPCSOLATI HIBA";
    console.log(
      "OAH ERROR:",
      error?.message || String(error)
    );
  }

  const [river, hvcs, thresholdUp, thresholdDown] =
    await Promise.all([
      fetchVizStation(VIZ_URL, true),
      fetchVizStation(HVCS_URL, false),
      fetchVizStation(THRESHOLD_UP_URL, false),
      fetchVizStation(THRESHOLD_DOWN_URL, false)
    ]);

  const validBlocks = blocks.every(value =>
    /^\d+$/.test(String(value))
  );

  const total = validBlocks
    ? blocks.reduce((sum, value) => sum + Number(value), 0)
    : null;

  const uplift =
    Number.isFinite(thresholdUp.value) &&
    Number.isFinite(thresholdDown.value)
      ? thresholdUp.value - thresholdDown.value
      : null;

  const riverMbf = cmToMbf(river.value, PAKS_ZERO_MBF);
  const hvcsMbf = cmToMbf(hvcs.value, LOCAL_ZERO_MBF);
  const thresholdUpMbf = cmToMbf(thresholdUp.value, LOCAL_ZERO_MBF);
  const thresholdDownMbf = cmToMbf(thresholdDown.value, LOCAL_ZERO_MBF);

  return {
    blocks,
    total,

    water: river.value,
    flow: river.flow,
    temp: river.temp,

    riverTime: river.time,
    riverTimestamp: river.timestamp,
    riverStatus: river.status,
    riverPrevious: river.previousValue,
    riverMbf,

    hvcs: hvcs.value,
    hvcsTime: hvcs.time,
    hvcsTimestamp: hvcs.timestamp,
    hvcsStatus: hvcs.status,
    hvcsPrevious: hvcs.previousValue,
    hvcsMbf,

    thresholdUp: thresholdUp.value,
    thresholdUpTime: thresholdUp.time,
    thresholdUpTimestamp: thresholdUp.timestamp,
    thresholdUpStatus: thresholdUp.status,
    thresholdUpPrevious: thresholdUp.previousValue,
    thresholdUpMbf,

    thresholdDown: thresholdDown.value,
    thresholdDownTime: thresholdDown.time,
    thresholdDownTimestamp: thresholdDown.timestamp,
    thresholdDownStatus: thresholdDown.status,
    thresholdDownPrevious: thresholdDown.previousValue,
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

async function upsertField(env, ts, field, value) {
  if (!Number.isFinite(ts) || !Number.isFinite(value)) return;

  const allowed = new Set([
    "power",
    "water",
    "flow",
    "temp",
    "hvcs",
    "threshold_up",
    "threshold_down"
  ]);

  if (!allowed.has(field)) return;

  await env.DB
    .prepare(
      `INSERT INTO measurements
       (ts, ${field})
       VALUES (?, ?)
       ON CONFLICT(ts)
       DO UPDATE SET
       ${field}=excluded.${field}`
    )
    .bind(ts, value)
    .run();
}

async function saveMeasurement(env, data) {
  try {
    await ensureDB(env);

    await upsertField(env, data.oahTimestamp, "power", data.total);
    await upsertField(env, data.riverTimestamp, "water", data.water);
    await upsertField(env, data.riverTimestamp, "flow", data.flow);
    await upsertField(env, data.riverTimestamp, "temp", data.temp);
    await upsertField(env, data.hvcsTimestamp, "hvcs", data.hvcs);
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
      11 * 24 * 60 * 60 * 1000;

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
      error?.message || String(error)
    );
  }
}


// ============================================================
// WORKER
// ============================================================

export default {
  async scheduled(controller, env, ctx) {
    const data = await getCurrentData();
    ctx.waitUntil(saveMeasurement(env, data));
  },

  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.pathname === "/version") {
      return new Response(VERSION, {
        headers: {
          "content-type": "text/plain;charset=UTF-8",
          "cache-control": "no-store"
        }
      });
    }

    if (url.pathname === "/facebook-image") {
      try {
        const response = await fetch(FB_IMAGE_RAW);

        if (!response.ok) {
          return new Response("Image not found", {
            status: 404
          });
        }

        return new Response(response.body, {
          headers: {
            "content-type": "image/png",
            "cache-control": "public,max-age=86400"
          }
        });

      } catch {
        return new Response("Image unavailable", {
          status: 503
        });
      }
    }

    if (url.pathname === "/api/history") {
      try {
        await ensureDB(env);

        let hours = Number(
          url.searchParams.get("hours") || 24
        );

        if (![6, 24, 240].includes(hours)) {
          hours = 24;
        }

        const cutoff =
          Date.now() -
          hours * 60 * 60 * 1000;

        const result = await env.DB
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
          JSON.stringify({
            ok: true,
            version: VERSION,
            count: result.results?.length || 0,
            data: result.results || []
          }),
          {
            headers: {
              "content-type":
                "application/json;charset=UTF-8",
              "cache-control": "no-store"
            }
          }
        );

      } catch (error) {
        return new Response(
          JSON.stringify({
            ok: false,
            version: VERSION,
            data: [],
            error:
              error?.message || String(error)
          }),
          {
            headers: {
              "content-type":
                "application/json;charset=UTF-8",
              "cache-control": "no-store"
            }
          }
        );
      }
    }

    const data = await getCurrentData();

    if (ctx && typeof ctx.waitUntil === "function") {
      ctx.waitUntil(saveMeasurement(env, data));
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

      oahTime,
      oahStatus
    } = data;

    const totalText =
      Number.isFinite(total)
        ? `${total} MW`
        : "— MW";

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

    const riverDir = direction(water, riverPrevious);
    const hvcsDir = direction(hvcs, hvcsPrevious);
    const upDir = direction(thresholdUp, thresholdUpPrevious);
    const downDir = direction(thresholdDown, thresholdDownPrevious);

    let markerPct = 0;

    if (Number.isFinite(water)) {
      markerPct = ((-110 - water) / 40) * 100;
      markerPct = Math.max(0, Math.min(100, markerPct));
    }

    const blockHtml = blocks.map((value, index) => {
      const n = Number(value);

      const pct = Number.isFinite(n)
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(n / 500 * 100)
            )
          )
        : 0;

      return `
        <div class="blockCard">
          <div class="eyebrow">${index + 1}. BLOKK</div>
          <div class="blockValue ${n > 0 ? "on" : ""}">
            ${value === "—" ? "—" : value + " MW"}
          </div>
          <div class="blockBottom">
            <span>${pct}%</span>
            <div class="track">
              <div class="fill" style="width:${pct}%"></div>
            </div>
          </div>
        </div>
      `;
    }).join("");

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">

<meta
  name="viewport"
  content="width=device-width, initial-scale=1, minimum-scale=1, maximum-scale=10, user-scalable=yes, viewport-fit=cover"
>

<meta name="theme-color" content="#020811">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">

<title>⚛️ PAKS MONITOR</title>

<meta property="og:title" content="⚛️ PAKS MONITOR">
<meta property="og:image" content="${PUBLIC_URL}/facebook-image">

<style>
:root{
  --bg:#020811;
  --panel:#07121d;
  --panel2:#0a1825;
  --line:#183850;
  --white:#f4f7fa;
  --muted:#8394a6;
  --green:#61df54;
  --blue:#49adff;
  --orange:#ffae32;
  --red:#ff515b;
  --purple:#d04dff;
}

*{box-sizing:border-box}

html{
  width:100%;
  min-height:100%;
  background:#000;
  -webkit-text-size-adjust:100%;
  touch-action:manipulation;
}

body{
  margin:0;
  min-height:100%;
  color:var(--white);
  background:
    radial-gradient(circle at 50% -15%,#0d2238 0,#06101a 35%,#02070c 70%,#000 100%);
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif;
  overflow-x:hidden;
}

button,a{
  font:inherit;
}

.page{
  width:min(1500px,100%);
  margin:0 auto;
  padding:
    max(12px,env(safe-area-inset-top))
    max(12px,env(safe-area-inset-right))
    max(18px,env(safe-area-inset-bottom))
    max(12px,env(safe-area-inset-left));
}

.header{
  display:grid;
  grid-template-columns:1fr auto;
  align-items:center;
  gap:12px;
  margin-bottom:12px;
}

.brandRow{
  display:flex;
  flex-wrap:wrap;
  align-items:center;
  gap:8px;
}

.brand{
  font-size:clamp(22px,4vw,34px);
  line-height:1;
  font-weight:950;
  letter-spacing:-1px;
}

.badge{
  padding:4px 7px;
  border-radius:6px;
  background:#5a1269;
  color:#f2a7ff;
  font-size:9px;
  font-weight:900;
}

.live{
  display:inline-flex;
  align-items:center;
  gap:6px;
  color:var(--green);
  font-size:11px;
  font-weight:900;
}

.liveDot{
  width:8px;
  height:8px;
  border-radius:50%;
  background:var(--green);
  box-shadow:0 0 10px var(--green);
}

.clockBox{
  text-align:right;
}

.clock{
  font-size:clamp(22px,5vw,34px);
  font-weight:950;
}

.refresh{
  color:var(--muted);
  font-size:9px;
}

.toolbar{
  display:flex;
  gap:8px;
  align-items:center;
  margin-bottom:12px;
}

.signature{
  padding:8px 11px;
  border:1px solid #57216d;
  border-radius:7px;
  color:#d85cff;
  background:#12091a;
  font-size:11px;
  font-weight:950;
  letter-spacing:1px;
}

.shareLink{
  min-width:0;
  flex:1;
  padding:8px 10px;
  border:1px solid #9036b9;
  border-radius:7px;
  background:#14091b;
  color:#d950ff;
  text-decoration:none;
  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;
  font-size:10px;
}

.copy{
  border:0;
  border-radius:7px;
  padding:9px 11px;
  background:#162637;
  color:white;
  font-size:10px;
  font-weight:900;
}

.panel{
  border:1px solid var(--line);
  border-radius:10px;
  background:
    linear-gradient(145deg,#0a1723,#06101a);
  overflow:hidden;
}

.sectionPad{
  padding:14px;
}

.eyebrow{
  color:#93a3b4;
  font-size:10px;
  font-weight:900;
}

.heroGrid{
  display:grid;
  grid-template-columns:1.05fr 1.2fr 1fr;
  gap:10px;
  margin-bottom:10px;
}

.powerBig{
  margin-top:6px;
  color:var(--green);
  font-size:clamp(38px,5vw,62px);
  line-height:1;
  font-weight:950;
}

.chartPanel{
  margin-top:12px;
  padding:8px;
  border:1px solid #15314a;
  border-radius:8px;
  background:#050e17;
}

.chartHead{
  display:flex;
  justify-content:space-between;
  gap:8px;
  align-items:center;
  margin-bottom:6px;
}

.chartName{
  color:#8998a8;
  font-size:8px;
  font-weight:850;
}

.periods{
  display:flex;
  gap:4px;
}

.period{
  border:0;
  padding:5px 7px;
  border-radius:999px;
  background:#142231;
  color:#8fa0b2;
  font-size:8px;
  font-weight:900;
}

.period.active{
  background:#274d69;
  color:white;
}

.chartWrap{
  height:170px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.blocksGrid{
  display:grid;
  grid-template-columns:repeat(2,1fr);
  gap:8px;
  padding:10px;
}

.blockCard{
  min-height:126px;
  padding:12px;
  border:1px solid #173650;
  border-radius:8px;
  background:#081522;
}

.blockValue{
  margin-top:18px;
  font-size:23px;
  font-weight:950;
}

.blockValue.on{
  color:var(--green);
}

.blockBottom{
  margin-top:18px;
  color:#8d9eae;
  font-size:10px;
}

.track{
  margin-top:7px;
  height:3px;
  border-radius:999px;
  background:#344653;
  overflow:hidden;
}

.fill{
  height:100%;
  background:var(--green);
}

.source{
  padding:8px 10px;
  border-top:1px solid #173650;
  color:#77899b;
  font-size:9px;
}

.metricsGrid{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:7px;
}

.metric{
  padding:10px;
  border:1px solid #15314a;
  border-radius:8px;
  background:#0b1825;
}

.metricName{
  min-height:22px;
  color:#8798aa;
  font-size:9px;
  font-weight:850;
}

.metricValue{
  margin-top:4px;
  font-size:clamp(18px,3vw,27px);
  font-weight:950;
}

.blue{color:var(--blue)}
.green{color:var(--green)}
.orange{color:var(--orange)}
.red{color:var(--red)}

.rule{
  margin-top:9px;
  padding:8px;
  border:1px solid #70511e;
  border-radius:8px;
  background:#1a1409;
  color:#ffb43c;
  text-align:center;
  font-size:9px;
  font-weight:900;
  line-height:1.45;
}

.gauge{
  position:relative;
  height:10px;
  margin-top:12px;
  border-radius:999px;
  background:linear-gradient(
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
  height:20px;
  border-radius:2px;
  background:white;
  transform:translateX(-50%);
  box-shadow:0 0 6px white;
}

.scale{
  display:grid;
  grid-template-columns:1fr 1fr 1fr;
  margin-top:5px;
  font-size:8px;
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
  grid-template-columns:1fr 1fr;
  gap:7px;
  margin-top:10px;
}

.distance{
  padding:9px;
  border:1px solid #15314a;
  border-radius:8px;
  background:#0b1825;
}

.distanceNumber{
  font-size:20px;
  font-weight:950;
}

.distanceText{
  margin-top:3px;
  color:#7c8d9f;
  font-size:8px;
}

.hydro{
  margin-bottom:10px;
}

.hydroHead{
  padding:12px 14px 0;
  font-size:12px;
  font-weight:950;
}

.readings{
  display:grid;
  grid-template-columns:repeat(5,1fr);
  gap:8px;
  padding:12px;
}

.readCard{
  min-width:0;
  padding:10px;
  border:1px solid #173650;
  border-radius:8px;
  background:#071522;
  text-align:center;
}

.readCard.highlight{
  border-color:#347941;
  background:#07190c;
}

.readLabel{
  color:#8fa0b1;
  font-size:9px;
  font-weight:900;
}

.readValue{
  margin-top:7px;
  font-size:clamp(20px,3vw,30px);
  font-weight:950;
}

.readSub{
  margin-top:5px;
  color:#8b9cac;
  font-size:9px;
}

.diagramWrap{
  padding:0 12px 12px;
}

.diagram{
  position:relative;
  min-width:940px;
  height:300px;
  overflow:hidden;
  border:1px solid #173650;
  border-radius:10px;
  background:linear-gradient(#173f60 0 46%,#0b2437 46% 100%);
}

.diagramScroller{
  overflow-x:auto;
  -webkit-overflow-scrolling:touch;
  padding-bottom:2px;
}

.water{
  position:absolute;
  left:0;
  right:0;
  top:165px;
  height:82px;
  background:linear-gradient(#2a98da,#17699f);
  border-top:3px solid #69caff;
}

.bed{
  position:absolute;
  left:0;
  right:0;
  top:247px;
  bottom:0;
  background:linear-gradient(#4a3b2e,#2a221c);
}

.sceneLabel{
  position:absolute;
  top:12px;
  z-index:5;
  color:#f5f7fa;
  text-align:center;
  font-size:11px;
  font-weight:900;
}

.labRiver{left:20px;width:150px}
.labThreshold{left:210px;width:250px}
.labHvcs{left:520px;width:165px}
.labPumps{left:680px;width:120px}
.labPlant{left:795px;width:125px}

.threshold{
  position:absolute;
  z-index:4;
  left:265px;
  top:204px;
  width:175px;
  height:45px;
  border-radius:50% 50% 5px 5px;
  background:
    radial-gradient(circle at 15% 62%,#8b9094 0 16px,transparent 17px),
    radial-gradient(circle at 35% 28%,#72777b 0 18px,transparent 19px),
    radial-gradient(circle at 55% 66%,#989c9f 0 17px,transparent 18px),
    radial-gradient(circle at 74% 30%,#686d70 0 19px,transparent 20px),
    #454b4f;
}

.wall{
  position:absolute;
  z-index:5;
  top:158px;
  width:13px;
  height:91px;
  background:linear-gradient(90deg,#a1aab0,#596269);
}

.wallA{left:250px}
.wallB{left:446px}

.rack{
  position:absolute;
  z-index:6;
  left:545px;
  top:168px;
  width:30px;
  height:79px;
  border:2px solid #87949e;
  background:repeating-linear-gradient(
    90deg,
    #253845 0 4px,
    #9aa7b0 4px 7px
  );
}

.pump{
  position:absolute;
  z-index:6;
  top:155px;
  width:24px;
  height:92px;
  border-left:8px solid #8f99a1;
}

.pump:before{
  content:"";
  position:absolute;
  left:-13px;
  top:-7px;
  width:25px;
  height:18px;
  border-radius:5px;
  background:#949ea6;
}

.pump:after{
  content:"";
  position:absolute;
  left:-14px;
  bottom:-8px;
  width:26px;
  height:26px;
  border:2px solid #303940;
  border-radius:50%;
  background:#69747d;
}

.p1{left:665px}
.p2{left:715px}
.p3{left:765px}

.plant{
  position:absolute;
  z-index:6;
  right:22px;
  top:105px;
  width:125px;
  height:142px;
  border:1px solid #89939b;
  border-radius:7px 7px 3px 3px;
  background:linear-gradient(145deg,#69737c,#343c42);
}

.plant:before{
  content:"";
  position:absolute;
  left:27px;
  top:-43px;
  width:72px;
  height:45px;
  border:1px solid #939ca3;
  border-radius:50% 50% 0 0;
  background:#59636b;
}

.chimney{
  position:absolute;
  right:8px;
  top:-48px;
  width:15px;
  height:53px;
  background:repeating-linear-gradient(
    180deg,
    #eee 0 8px,
    #b43131 8px 16px
  );
}

.plantName{
  margin-top:42px;
  text-align:center;
  font-size:10px;
  font-weight:950;
}

.plantMw{
  margin-top:16px;
  color:var(--green);
  text-align:center;
  font-size:20px;
  font-weight:950;
}

.flowArrow{
  position:absolute;
  z-index:8;
  color:#60bdff;
  font-size:24px;
  font-weight:950;
}

.a1{left:135px;top:190px}
.a2{left:500px;top:190px}
.a3{left:632px;top:190px}
.a4{left:810px;top:190px}

.thresholdLine{
  position:absolute;
  z-index:7;
  left:80px;
  top:230px;
  width:150px;
  border-top:2px dashed var(--red);
}

.thresholdText{
  position:absolute;
  z-index:8;
  left:95px;
  top:235px;
  color:var(--red);
  font-size:8px;
  font-weight:950;
}

.bottomGrid{
  display:grid;
  grid-template-columns:repeat(7,1fr);
  gap:8px;
  margin-bottom:10px;
}

.bottomCard{
  padding:10px;
  border:1px solid #173650;
  border-radius:8px;
  background:#06121d;
  text-align:center;
}

.bottomCard.highlight{
  border-color:#72661c;
  background:#08150b;
}

.bottomLabel{
  color:#8c9bab;
  font-size:8px;
  font-weight:850;
}

.bottomValue{
  margin-top:7px;
  font-size:19px;
  font-weight:950;
}

.bottomSub{
  margin-top:4px;
  color:#76889a;
  font-size:8px;
}

.footer{
  display:grid;
  grid-template-columns:1fr auto 1fr;
  gap:10px;
  align-items:center;
  padding:10px 12px;
  border:1px solid #173650;
  border-radius:8px;
  background:#05101a;
  color:#6d7f92;
  font-size:8px;
}

.footer div:nth-child(2){text-align:center}
.footer div:nth-child(3){text-align:right}

.dir.up{color:var(--green)}
.dir.down{color:var(--orange)}
.dir.flat{color:#d0d8df}

.toast{
  position:fixed;
  left:50%;
  bottom:calc(22px + env(safe-area-inset-bottom));
  z-index:9999;
  transform:translateX(-50%) translateY(8px);
  opacity:0;
  padding:9px 14px;
  border:1px solid #347a40;
  border-radius:999px;
  background:#102819;
  color:#79e870;
  font-size:11px;
  font-weight:900;
  pointer-events:none;
  transition:.2s;
}

.toast.show{
  opacity:1;
  transform:translateX(-50%) translateY(0);
}

@media (max-width:900px){
  .page{
    padding-left:10px;
    padding-right:10px;
  }

  .header{
    grid-template-columns:1fr auto;
  }

  .toolbar{
    flex-wrap:wrap;
  }

  .signature{
    order:1;
  }

  .shareLink{
    order:2;
    flex:1 1 220px;
  }

  .copy{
    order:3;
  }

  .heroGrid{
    grid-template-columns:1fr;
  }

  .blocksGrid{
    grid-template-columns:repeat(2,1fr);
  }

  .metricsGrid{
    grid-template-columns:repeat(3,1fr);
  }

  .chartWrap{
    height:180px;
  }

  .readings{
    grid-template-columns:repeat(2,1fr);
  }

  .readCard.highlight{
    grid-column:1 / -1;
  }

  .bottomGrid{
    grid-template-columns:repeat(2,1fr);
  }

  .footer{
    grid-template-columns:1fr;
  }

  .footer div,
  .footer div:nth-child(2),
  .footer div:nth-child(3){
    text-align:left;
  }
}

@media (max-width:520px){
  .brand{
    font-size:24px;
  }

  .clock{
    font-size:24px;
  }

  .refresh{
    display:block;
    margin-top:2px;
  }

  .toolbar{
    gap:6px;
  }

  .shareLink{
    width:100%;
    flex-basis:100%;
  }

  .blocksGrid{
    grid-template-columns:repeat(2,1fr);
  }

  .blockCard{
    min-height:115px;
  }

  .metric{
    padding:8px 6px;
  }

  .metricName{
    font-size:8px;
  }

  .metricValue{
    font-size:17px;
  }

  .distanceNumber{
    font-size:18px;
  }

  .readings{
    grid-template-columns:1fr 1fr;
    gap:7px;
  }

  .readValue{
    font-size:22px;
  }

  .bottomGrid{
    grid-template-columns:1fr 1fr;
  }
}
</style>
</head>

<body>

<div class="page">

  <div class="header">
    <div>
      <div class="brandRow">
        <div class="brand">PAKS MONITOR</div>
        <div class="badge">VP03</div>
        <div class="live">
          <span class="liveDot"></span>
          ÉLŐ ADATOK
        </div>
      </div>
    </div>

    <div class="clockBox">
      <div class="clock" id="clock">--:--</div>
      <div class="refresh">
        FRISSÍTVE: ${shortTime(oahTime)}
      </div>
    </div>
  </div>

  <div class="toolbar">
    <div class="signature">IGLÓDI</div>

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

  <div class="heroGrid">

    <section class="panel">
      <div class="sectionPad">

        <div class="eyebrow">
          PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
        </div>

        <div class="powerBig">
          ${totalText}
        </div>

        <div class="chartPanel">

          <div class="chartHead">

            <div class="chartName">
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
            <canvas id="powerChart"></canvas>
          </div>

        </div>

      </div>
    </section>


    <section class="panel">
      <div class="blocksGrid">
        ${blockHtml}
      </div>

      <div class="source">
        OAH • ${shortTime(oahTime)} • ${oahStatus}
      </div>
    </section>


    <section class="panel">
      <div class="sectionPad">

        <div class="metricsGrid">

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

        <div class="rule">
          KILÉPŐ VÍZHŐ: NINCS FRISS HITELES ADAT
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
          <span>NORMÁL</span>
          <span>−134 cm</span>
          <span>−144 cm • LEÁLLÁSI SZINT</span>
        </div>

        <div class="distanceGrid">

          <div class="distance">
            <div class="distanceNumber">
              ${
                Number.isFinite(shutdownDistance)
                  ? shutdownDistance + " cm"
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
                Number.isFinite(safetyDistance)
                  ? safetyDistance + " cm"
                  : "—"
              }
            </div>
            <div class="distanceText">
              −144 CM HATÁRIG
            </div>
          </div>

        </div>

      </div>
    </section>

  </div>


  <section class="panel hydro">

    <div class="hydroHead">
      DUNA • FENÉKKÜSZÖB • HIDEGVÍZ-CSATORNA • ERŐMŰ
    </div>

    <div class="readings">

      <div class="readCard">
        <div class="readLabel">
          DUNA – PAKS
        </div>

        <div class="readValue blue">
          ${
            Number.isFinite(water)
              ? water + " cm"
              : "—"
          }
          <span class="dir ${riverDir.cls}">
            ${riverDir.symbol}
          </span>
        </div>

        <div class="readSub">
          ${
            Number.isFinite(riverMbf)
              ? fmt2(riverMbf) + " mBf"
              : "—"
          }
        </div>

        <div class="readSub">
          MÉRÉS: ${shortTime(riverTime)}
        </div>
      </div>


      <div class="readCard">
        <div class="readLabel">
          FENÉKKÜSZÖB FELVÍZ
        </div>

        <div class="readValue blue">
          ${
            Number.isFinite(thresholdUp)
              ? thresholdUp + " cm"
              : "—"
          }
          <span class="dir ${upDir.cls}">
            ${upDir.symbol}
          </span>
        </div>

        <div class="readSub">
          ${
            Number.isFinite(thresholdUpMbf)
              ? fmt2(thresholdUpMbf) + " mBf"
              : "—"
          }
        </div>

        <div class="readSub">
          MÉRÉS: ${shortTime(thresholdUpTime)}
        </div>
      </div>


      <div class="readCard highlight">
        <div class="readLabel">
          DUZZASZTÁS EREDMÉNYE
        </div>

        <div class="readValue green">
          ${
            Number.isFinite(uplift)
              ? (uplift >= 0 ? "+" : "") + uplift + " cm"
              : "—"
          }
        </div>

        <div class="readSub">
          FELVÍZ − ALVÍZ
        </div>
      </div>


      <div class="readCard">
        <div class="readLabel">
          FENÉKKÜSZÖB ALVÍZ
        </div>

        <div class="readValue blue">
          ${
            Number.isFinite(thresholdDown)
              ? thresholdDown + " cm"
              : "—"
          }
          <span class="dir ${downDir.cls}">
            ${downDir.symbol}
          </span>
        </div>

        <div class="readSub">
          ${
            Number.isFinite(thresholdDownMbf)
              ? fmt2(thresholdDownMbf) + " mBf"
              : "—"
          }
        </div>

        <div class="readSub">
          MÉRÉS: ${shortTime(thresholdDownTime)}
        </div>
      </div>


      <div class="readCard">
        <div class="readLabel">
          HIDEGVÍZ-CSATORNA
        </div>

        <div class="readValue blue">
          ${
            Number.isFinite(hvcs)
              ? hvcs + " cm"
              : "—"
          }
          <span class="dir ${hvcsDir.cls}">
            ${hvcsDir.symbol}
          </span>
        </div>

        <div class="readSub">
          ${
            Number.isFinite(hvcsMbf)
              ? fmt2(hvcsMbf) + " mBf"
              : "—"
          }
        </div>

        <div class="readSub">
          MÉRÉS: ${shortTime(hvcsTime)}
        </div>
      </div>

    </div>


    <div class="diagramWrap">
      <div class="diagramScroller">

        <div class="diagram">

          <div class="sceneLabel labRiver">
            DUNA (FŐÁG)
          </div>

          <div class="sceneLabel labThreshold">
            FENÉKKÜSZÖB (KŐSZÓRÁS)
          </div>

          <div class="sceneLabel labHvcs">
            HIDEGVÍZ-CSATORNA
          </div>

          <div class="sceneLabel labPumps">
            SZIVATTYÚK
          </div>

          <div class="sceneLabel labPlant">
            PAKSI ATOMERŐMŰ
          </div>

          <div class="water"></div>
          <div class="bed"></div>

          <div class="wall wallA"></div>
          <div class="wall wallB"></div>
          <div class="threshold"></div>

          <div class="rack"></div>

          <div class="pump p1"></div>
          <div class="pump p2"></div>
          <div class="pump p3"></div>

          <div class="plant">
            <div class="chimney"></div>

            <div class="plantName">
              PAKSI<br>ATOMERŐMŰ
            </div>

            <div class="plantMw">
              ${totalText}
            </div>
          </div>

          <div class="flowArrow a1">→</div>
          <div class="flowArrow a2">→</div>
          <div class="flowArrow a3">↑</div>
          <div class="flowArrow a4">→</div>

          <div class="thresholdLine"></div>

          <div class="thresholdText">
            PAKS FŐÁG • −144 cm
          </div>

        </div>

      </div>
    </div>

  </section>


  <div class="bottomGrid">

    <div class="bottomCard">
      <div class="bottomLabel">
        DUNA – PAKS
      </div>
      <div class="bottomValue blue">
        ${
          Number.isFinite(water)
            ? water + " cm"
            : "—"
        }
      </div>
      <div class="bottomSub">
        ${
          Number.isFinite(riverMbf)
            ? fmt2(riverMbf) + " mBf"
            : "—"
        }
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
          Number.isFinite(thresholdUp)
            ? thresholdUp + " cm"
            : "—"
        }
      </div>
      <div class="bottomSub">
        ${
          Number.isFinite(thresholdUpMbf)
            ? fmt2(thresholdUpMbf) + " mBf"
            : "—"
        }
      </div>
    </div>


    <div class="bottomCard">
      <div class="bottomLabel">
        FENÉKKÜSZÖB ALVÍZ
      </div>
      <div class="bottomValue blue">
        ${
          Number.isFinite(thresholdDown)
            ? thresholdDown + " cm"
            : "—"
        }
      </div>
      <div class="bottomSub">
        ${
          Number.isFinite(thresholdDownMbf)
            ? fmt2(thresholdDownMbf) + " mBf"
            : "—"
        }
      </div>
    </div>


    <div class="bottomCard highlight">
      <div class="bottomLabel">
        DUZZASZTÁS EREDMÉNYE
      </div>
      <div class="bottomValue green">
        ${
          Number.isFinite(uplift)
            ? (uplift >= 0 ? "+" : "") + uplift + " cm"
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
            ? hvcs + " cm"
            : "—"
        }
      </div>
      <div class="bottomSub">
        ${
          Number.isFinite(hvcsMbf)
            ? fmt2(hvcsMbf) + " mBf"
            : "—"
        }
      </div>
    </div>


    <div class="bottomCard">
      <div class="bottomLabel">
        ÖBLÖZET VÍZSZINT
      </div>
      <div class="bottomValue blue">
        ${
          Number.isFinite(hvcsMbf)
            ? fmt2(hvcsMbf) + " mBf"
            : "—"
        }
      </div>
      <div class="bottomSub">
        HVCS MÉRÉSI ADAT
      </div>
    </div>


    <div class="bottomCard">
      <div class="bottomLabel">
        ATOMERŐMŰ TELJESÍTMÉNYE
      </div>
      <div class="bottomValue green">
        ${totalText}
      </div>
      <div class="bottomSub">
        OAH • ${shortTime(oahTime)}
      </div>
    </div>

  </div>


  <div class="footer">
    <div>
      ADATFORRÁSOK: OAH • OVF / VÍZÜGY
    </div>

    <div>
      AZ ADATOK TÁJÉKOZTATÓ JELLEGŰEK.
    </div>

    <div>
      ${VERSION}
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
const PUBLIC_URL = "${PUBLIC_URL}";

let selectedHours = 24;
let historyCache = {};

function updateClock() {
  const clock = document.getElementById("clock");

  if (!clock) return;

  clock.textContent =
    new Date().toLocaleTimeString(
      "hu-HU",
      {
        timeZone: "Europe/Budapest",
        hour: "2-digit",
        minute: "2-digit"
      }
    );
}

async function getHistory(hours) {
  try {
    const response = await fetch(
      "/api/history?hours=" +
      hours +
      "&v=" +
      Date.now(),
      {
        cache: "no-store"
      }
    );

    const json = await response.json();

    if (
      json &&
      json.ok === true &&
      Array.isArray(json.data)
    ) {
      return json.data;
    }

  } catch {}

  return [];
}

async function loadHistory(hours) {
  if (historyCache[hours]) {
    return historyCache[hours];
  }

  const rows = await getHistory(hours);
  historyCache[hours] = rows;

  return rows;
}

async function drawPowerChart(hours) {
  const canvas =
    document.getElementById("powerChart");

  if (!canvas) return;

  const rows = await loadHistory(hours);

  const data = rows
    .filter(row =>
      row.power !== null &&
      row.power !== undefined
    )
    .map(row => ({
      x: Number(row.ts),
      y: Number(row.power)
    }))
    .filter(point =>
      Number.isFinite(point.x) &&
      Number.isFinite(point.y)
    )
    .sort((a, b) => a.x - b.x);

  const W = canvas.clientWidth;
  const H = canvas.clientHeight;
  const ratio = window.devicePixelRatio || 1;

  canvas.width = Math.floor(W * ratio);
  canvas.height = Math.floor(H * ratio);

  const ctx = canvas.getContext("2d");

  ctx.setTransform(
    ratio,
    0,
    0,
    ratio,
    0,
    0
  );

  ctx.clearRect(0, 0, W, H);

  const pad = {
    left: 44,
    right: 10,
    top: 8,
    bottom: 22
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

  for (let i = 0; i <= 4; i++) {
    const y =
      pad.top +
      chartH * i / 4;

    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(W - pad.right, y);
    ctx.stroke();
  }

  if (data.length === 0) {
    ctx.fillStyle = "#718397";
    ctx.font = "10px -apple-system";
    ctx.textAlign = "left";

    ctx.fillText(
      "Új mérésre várunk…",
      pad.left + 6,
      H / 2
    );

    return;
  }

  let minY = Math.min(
    ...data.map(p => p.y)
  );

  let maxY = Math.max(
    ...data.map(p => p.y)
  );

  if (minY === maxY) {
    minY -= 2;
    maxY += 2;
  }

  const margin = Math.max(
    1,
    (maxY - minY) * .15
  );

  minY -= margin;
  maxY += margin;

  const maxX = Date.now();

  const minX =
    maxX -
    hours *
    60 *
    60 *
    1000;

  const sx = x =>
    pad.left +
    ((x - minX) /
      (maxX - minX)) *
    chartW;

  const sy = y =>
    pad.top +
    ((maxY - y) /
      (maxY - minY)) *
    chartH;

  ctx.fillStyle = "#738598";
  ctx.font = "8px -apple-system";
  ctx.textAlign = "right";

  for (let i = 0; i <= 2; i++) {
    const value =
      maxY -
      (maxY - minY) *
      i / 2;

    const y =
      pad.top +
      chartH * i / 2;

    ctx.fillText(
      Math.round(value) + " MW",
      pad.left - 4,
      y + 3
    );
  }

  ctx.textAlign = "center";

  const divisions =
    hours >= 240
      ? 4
      : 3;

  for (let i = 0; i <= divisions; i++) {
    const timestamp =
      minX +
      (maxX - minX) *
      i / divisions;

    const date = new Date(timestamp);

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
      H - 4
    );
  }

  ctx.strokeStyle = "#61df54";
  ctx.fillStyle = "#61df54";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  ctx.beginPath();

  data.forEach((point, index) => {
    const x = sx(point.x);
    const y = sy(point.y);

    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });

  ctx.stroke();

  const last = data[data.length - 1];

  ctx.beginPath();
  ctx.arc(
    sx(last.x),
    sy(last.y),
    4,
    0,
    Math.PI * 2
  );
  ctx.fill();
}

document
  .querySelectorAll(".period")
  .forEach(button => {
    button.addEventListener(
      "click",
      () => {
        selectedHours =
          Number(button.dataset.hours);

        document
          .querySelectorAll(".period")
          .forEach(element =>
            element.classList.remove("active")
          );

        button.classList.add("active");

        historyCache = {};

        drawPowerChart(selectedHours);
      }
    );
  });

document
  .getElementById("copyButton")
  ?.addEventListener(
    "click",
    async () => {
      try {
        await navigator.clipboard.writeText(
          PUBLIC_URL
        );

        const toast =
          document.getElementById("toast");

        toast.classList.add("show");

        setTimeout(
          () =>
            toast.classList.remove("show"),
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

updateClock();

setInterval(
  updateClock,
  15000
);

drawPowerChart(selectedHours);

let resizeTimer;

window.addEventListener(
  "resize",
  () => {
    clearTimeout(resizeTimer);

    resizeTimer = setTimeout(
      () => {
        historyCache = {};
        drawPowerChart(selectedHours);
      },
      140
    );
  }
);
</script>

</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        "content-type":
          "text/html;charset=UTF-8",
        "cache-control":
          "no-store, no-cache, must-revalidate",
        "pragma":
          "no-cache"
      }
    });
  }
};
