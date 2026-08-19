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

const VERSION = "VPAKS04";

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
        "User-Agent": "Mozilla/5.0 (compatible; VPAKS04)"
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
        "User-Agent": "Mozilla/5.0 (compatible; VPAKS04)"
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
              <div
                class="fill"
                style="width:${pct}%"
              ></div>
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
  content="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=10,user-scalable=yes,viewport-fit=cover"
>

<meta name="theme-color" content="#000000">

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
  --bg:#02070d;
  --panel:#07131f;
  --panel2:#0a1a28;
  --line:#173650;
  --white:#f4f7fa;
  --muted:#8394a6;
  --green:#61df54;
  --blue:#49adff;
  --orange:#ffae32;
  --red:#ff515b;
  --purple:#d04dff;
  --cyan:#5cc7ff;
}

*{
  box-sizing:border-box;
}

html,
body{
  margin:0;
  padding:0;
  width:100%;
  height:100%;
  background:#000;
  overflow:hidden;
  color:var(--white);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;

  -webkit-text-size-adjust:100%;

  touch-action:auto;
}

#stage{
  position:fixed;
  inset:0;
  overflow:hidden;
  background:#000;
}

#board{
  position:absolute;

  left:0;
  top:0;

  width:1600px;
  height:900px;

  transform-origin:top left;

  background:
    radial-gradient(
      circle at 52% -20%,
      #102740 0%,
      #07121d 42%,
      #02070d 78%,
      #000 100%
    );

  padding:12px;
}

.header{
  height:54px;

  display:grid;

  grid-template-columns:
    430px
    1fr
    500px;

  gap:10px;

  align-items:center;

  margin-bottom:8px;
}

.brandRow{
  display:flex;
  align-items:center;
  gap:10px;
}

.brand{
  font-size:27px;
  font-weight:950;
  letter-spacing:-.8px;
}

.badge{
  padding:4px 8px;

  border-radius:6px;

  background:#5d146d;

  color:#f0a4ff;

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

  box-shadow:
    0 0 10px
    var(--green);
}

.clockWrap{
  text-align:center;
}

.clock{
  font-size:28px;
  font-weight:950;
}

.refresh{
  margin-left:10px;

  color:#7f8f9f;

  font-size:9px;
}

.headerRight{
  display:grid;

  grid-template-columns:
    100px
    1fr;

  gap:8px;
}

.signature{
  height:35px;

  display:grid;

  place-items:center;

  border:
    1px solid #5e2470;

  border-radius:7px;

  background:#12091a;

  color:#dc5aff;

  font-size:11px;

  font-weight:950;

  letter-spacing:1px;
}

.share{
  height:35px;

  display:grid;

  grid-template-columns:
    1fr
    70px;

  gap:5px;

  padding:4px;

  border:
    1px solid #183650;

  border-radius:7px;

  background:#07111c;
}

.shareLink{
  min-width:0;

  display:flex;

  align-items:center;

  padding:
    0 8px;

  border:
    1px solid #9f3bc9;

  border-radius:5px;

  background:#16091e;

  color:#dc57ff;

  text-decoration:none;

  white-space:nowrap;

  overflow:hidden;

  text-overflow:ellipsis;

  font-size:8px;
}

.copy{
  border:0;

  border-radius:5px;

  background:#172637;

  color:white;

  font-size:8px;

  font-weight:900;
}

.topGrid{
  height:220px;

  display:grid;

  grid-template-columns:
    430px
    570px
    560px;

  gap:8px;

  margin-bottom:8px;
}

.panel{
  position:relative;

  overflow:hidden;

  border:
    1px solid var(--line);

  border-radius:8px;

  background:
    linear-gradient(
      145deg,
      #091623,
      #06101a
    );

  box-shadow:
    0 10px 40px
    rgba(0,0,0,.18)
    inset;
}

.pad{
  padding:12px;
}

.eyebrow{
  color:#9babb9;

  font-size:10px;

  font-weight:900;
}

.powerBig{
  margin-top:5px;

  color:var(--green);

  font-size:42px;

  line-height:1;

  font-weight:950;
}

.chartPanel{
  margin-top:9px;

  padding:7px;

  border:
    1px solid #17324a;

  border-radius:7px;

  background:#050e17;
}

.chartHead{
  display:flex;

  justify-content:
    space-between;

  align-items:center;

  gap:8px;

  height:20px;
}

.chartName{
  color:#8798aa;

  font-size:7px;

  font-weight:850;
}

.periods{
  display:flex;
  gap:3px;
}

.period{
  border:0;

  padding:
    4px 6px;

  border-radius:999px;

  background:#142231;

  color:#8fa0b2;

  font-size:7px;

  font-weight:900;
}

.period.active{
  background:#274d69;
  color:white;
}

.chartWrap{
  height:120px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.blocksGrid{
  height:188px;

  display:grid;

  grid-template-columns:
    repeat(4,1fr);
}

.blockCard{
  position:relative;

  padding:
    15px 13px;

  border-right:
    1px solid #173650;
}

.blockCard:last-child{
  border-right:0;
}

.blockValue{
  margin-top:32px;

  font-size:23px;

  font-weight:950;
}

.blockValue.on{
  color:var(--green);
}

.blockBottom{
  position:absolute;

  left:13px;
  right:13px;
  bottom:18px;

  color:#8b9cad;

  font-size:9px;
}

.track{
  margin-top:6px;

  height:2px;

  background:#354653;
}

.fill{
  height:100%;

  background:var(--green);
}

.source{
  height:31px;

  display:flex;

  align-items:center;

  padding:
    0 10px;

  border-top:
    1px solid #173650;

  color:#748698;

  font-size:8px;
}

.metricsGrid{
  display:grid;

  grid-template-columns:
    repeat(3,1fr);

  gap:6px;
}

.metric{
  padding:9px;

  border:
    1px solid #15314a;

  border-radius:7px;

  background:#0b1825;
}

.metricName{
  min-height:18px;

  color:#8697a9;

  font-size:8px;

  font-weight:850;
}

.metricValue{
  margin-top:3px;

  font-size:20px;

  font-weight:950;
}

.blue{
  color:var(--blue);
}

.green{
  color:var(--green);
}

.orange{
  color:var(--orange);
}

.red{
  color:var(--red);
}

.rule{
  margin-top:7px;

  padding:6px;

  border:
    1px solid #70511e;

  border-radius:6px;

  background:#1a1409;

  color:#ffb43c;

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
      #54cc59 0 60%,
      #ffad30 60% 85%,
      #ef555b 85% 100%
    );
}

.marker{
  position:absolute;

  left:${markerPct}%;

  top:-5px;

  width:3px;

  height:19px;

  background:white;

  transform:
    translateX(-50%);

  box-shadow:
    0 0 7px
    white;
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

  gap:6px;

  margin-top:6px;
}

.distance{
  padding:
    6px 8px;

  border:
    1px solid #15314a;

  border-radius:6px;

  background:#0b1825;
}

.distanceNumber{
  font-size:18px;

  font-weight:950;
}

.distanceText{
  color:#77899b;

  font-size:7px;
}

.hydroPanel{
  position:relative;

  height:540px;

  overflow:hidden;

  border:
    1px solid var(--line);

  border-radius:8px;

  background:#06111c;
}

.scene{
  position:relative;

  height:420px;

  overflow:hidden;

  background:
    linear-gradient(
      180deg,
      #163d5f 0 33%,
      #0d2941 33% 58%,
      #071724 58% 100%
    );
}

.skyGlow{
  position:absolute;

  inset:0;

  background:
    radial-gradient(
      circle at 84% 10%,
      rgba(84,145,192,.22),
      transparent 26%
    ),
    linear-gradient(
      180deg,
      rgba(0,0,0,0),
      rgba(0,0,0,.08)
    );
}

.treeLine{
  position:absolute;

  z-index:2;

  left:0;
  right:0;

  top:135px;

  height:58px;

  opacity:.55;

  background:
    radial-gradient(circle at 3% 95%,#173e2f 0 26px,transparent 27px),
    radial-gradient(circle at 8% 90%,#194835 0 24px,transparent 25px),
    radial-gradient(circle at 13% 98%,#143d2c 0 28px,transparent 29px),
    radial-gradient(circle at 19% 92%,#1b4b35 0 25px,transparent 26px),
    radial-gradient(circle at 25% 96%,#184431 0 27px,transparent 28px),
    radial-gradient(circle at 31% 94%,#143a2b 0 23px,transparent 24px),
    radial-gradient(circle at 38% 98%,#1a4933 0 29px,transparent 30px),
    radial-gradient(circle at 44% 92%,#153e2d 0 23px,transparent 24px),
    radial-gradient(circle at 51% 96%,#174431 0 26px,transparent 27px),
    radial-gradient(circle at 58% 94%,#1a4a34 0 28px,transparent 29px),
    radial-gradient(circle at 65% 97%,#153d2d 0 25px,transparent 26px),
    radial-gradient(circle at 72% 95%,#1b4935 0 29px,transparent 30px),
    radial-gradient(circle at 79% 93%,#173f2f 0 24px,transparent 25px),
    radial-gradient(circle at 86% 96%,#1a4933 0 27px,transparent 28px),
    radial-gradient(circle at 93% 92%,#143c2c 0 25px,transparent 26px),
    radial-gradient(circle at 98% 96%,#1b4b35 0 30px,transparent 31px);
}

.water{
  position:absolute;

  z-index:3;

  left:0;
  right:0;

  top:188px;

  height:156px;

  background:
    repeating-linear-gradient(
      180deg,
      rgba(255,255,255,.05) 0 2px,
      transparent 2px 9px
    ),
    linear-gradient(
      180deg,
      #156899 0,
      #0c4c77 45%,
      #083650 100%
    );

  border-top:
    3px solid #68caff;
}

.water:after{
  content:"";

  position:absolute;

  inset:0;

  background:
    linear-gradient(
      90deg,
      transparent 0 25%,
      rgba(70,190,255,.08) 35%,
      transparent 55%,
      rgba(70,190,255,.07) 72%,
      transparent 100%
    );
}

.bed{
  position:absolute;

  z-index:1;

  left:0;
  right:0;

  top:344px;
  bottom:0;

  background:
    radial-gradient(circle at 8% 20%,#6a5542 0 12px,transparent 13px),
    radial-gradient(circle at 18% 45%,#4f4033 0 18px,transparent 19px),
    radial-gradient(circle at 29% 20%,#76604b 0 14px,transparent 15px),
    radial-gradient(circle at 45% 40%,#5d4a39 0 17px,transparent 18px),
    radial-gradient(circle at 61% 25%,#6a5542 0 13px,transparent 14px),
    radial-gradient(circle at 73% 40%,#514034 0 18px,transparent 19px),
    radial-gradient(circle at 87% 22%,#6f5945 0 15px,transparent 16px),
    linear-gradient(#3d3027,#241d18);
}

.sceneTitle{
  position:absolute;

  z-index:20;

  top:11px;

  color:white;

  text-align:center;

  font-size:11px;

  font-weight:950;

  text-shadow:
    0 2px 8px
    rgba(0,0,0,.8);
}

.tRiver{
  left:20px;
  width:260px;
}

.tThreshold{
  left:320px;
  width:370px;
}

.tHvcs{
  left:760px;
  width:260px;
}

.tPumps{
  left:1030px;
  width:200px;
}

.tPlant{
  right:18px;
  width:270px;
}

.reading{
  position:absolute;

  z-index:30;

  width:145px;

  padding:8px;

  border:
    1px solid #1d4666;

  border-radius:7px;

  background:
    rgba(4,16,27,.94);

  text-align:center;

  box-shadow:
    0 9px 24px
    rgba(0,0,0,.25);
}

.readLabel{
  color:#91a2b4;

  font-size:7px;

  font-weight:850;
}

.readValue{
  margin-top:4px;

  font-size:20px;

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
  left:38px;
  top:52px;
}

.rUp{
  left:315px;
  top:52px;
}

.rDown{
  left:700px;
  top:52px;
}

.rHvcs{
  left:840px;
  top:52px;
}

.upliftCard{
  position:absolute;

  z-index:35;

  left:470px;
  top:45px;

  width:215px;
  height:148px;

  padding:9px;

  border:
    1px solid #347941;

  border-radius:7px;

  background:
    rgba(4,24,10,.96);

  box-shadow:
    0 12px 28px
    rgba(0,0,0,.28);
}

.upliftLabel{
  color:#91bd96;

  text-align:center;

  font-size:8px;

  font-weight:900;
}

.upliftValue{
  margin-top:6px;

  color:var(--green);

  text-align:center;

  font-size:28px;

  line-height:1;

  font-weight:950;
}

.upliftSub{
  margin-top:4px;

  color:#8bb490;

  text-align:center;

  font-size:8px;
}

.miniGraph{
  position:absolute;

  left:10px;
  right:10px;
  bottom:10px;

  height:62px;

  overflow:hidden;

  border-top:
    1px solid
    rgba(70,130,75,.18);

  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 14px,
      rgba(75,150,90,.12) 14px 15px
    );
}

.miniLine{
  position:absolute;

  left:8px;
  right:12px;

  top:38px;

  height:2px;

  background:var(--green);

  transform:
    rotate(-7deg);

  transform-origin:
    left center;
}

.miniDot{
  position:absolute;

  right:8px;

  top:12px;

  width:8px;
  height:8px;

  border-radius:50%;

  background:var(--green);

  box-shadow:
    0 0 9px
    var(--green);
}

.wall{
  position:absolute;

  z-index:12;

  top:184px;

  width:18px;

  height:167px;

  background:
    linear-gradient(
      90deg,
      #a6afb5,
      #59636a
    );

  box-shadow:
    4px 0 8px
    rgba(0,0,0,.35);
}

.wallL{
  left:440px;
}

.wallR{
  left:690px;
}

.thresholdRock{
  position:absolute;

  z-index:11;

  left:460px;

  top:278px;

  width:225px;

  height:76px;

  border-radius:
    52% 52% 5px 5px;

  background:
    radial-gradient(circle at 12% 62%,#8c9093 0 18px,transparent 19px),
    radial-gradient(circle at 30% 30%,#74787b 0 20px,transparent 21px),
    radial-gradient(circle at 49% 68%,#979a9c 0 19px,transparent 20px),
    radial-gradient(circle at 69% 29%,#686c6f 0 22px,transparent 23px),
    radial-gradient(circle at 88% 67%,#8d9092 0 19px,transparent 20px),
    #45494c;

  box-shadow:
    0 -8px 28px
    rgba(0,0,0,.25);
}

.rack{
  position:absolute;

  z-index:15;

  left:805px;

  top:230px;

  width:40px;

  height:115px;

  border:
    3px solid #87949e;

  background:
    repeating-linear-gradient(
      90deg,
      #253845 0 5px,
      #9aa7b0 5px 8px
    );

  box-shadow:
    0 0 16px
    rgba(0,0,0,.4);
}

.rackLabel{
  position:absolute;

  z-index:20;

  left:765px;

  top:207px;

  width:120px;

  color:#cad3da;

  text-align:center;

  font-size:8px;

  font-weight:850;
}

.pump{
  position:absolute;

  z-index:18;

  top:187px;

  width:38px;

  height:157px;

  border-left:
    11px solid #8e99a2;

  filter:
    drop-shadow(
      0 7px 8px
      rgba(0,0,0,.35)
    );
}

.pump:before{
  content:"";

  position:absolute;

  left:-19px;

  top:-10px;

  width:35px;

  height:23px;

  border-radius:6px;

  background:
    linear-gradient(
      #a6afb6,
      #6f7880
    );
}

.pump:after{
  content:"";

  position:absolute;

  left:-19px;

  bottom:-10px;

  width:36px;

  height:36px;

  border:
    3px solid #303940;

  border-radius:50%;

  background:
    radial-gradient(
      circle at 35% 30%,
      #8a969e,
      #5e6971 70%
    );
}

.p1{
  left:980px;
}

.p2{
  left:1055px;
}

.p3{
  left:1130px;
}

.pipe{
  position:absolute;

  z-index:16;

  left:1135px;

  top:190px;

  width:185px;

  height:20px;

  border-top:
    8px solid #87939c;

  border-right:
    8px solid #87939c;

  border-radius:
    0 20px 0 0;
}

.plant{
  position:absolute;

  z-index:22;

  right:38px;

  top:132px;

  width:210px;

  height:212px;

  border:
    1px solid #87929a;

  border-radius:
    8px 8px 3px 3px;

  background:
    linear-gradient(
      145deg,
      rgba(255,255,255,.06),
      transparent 35%
    ),
    linear-gradient(
      145deg,
      #6a747d,
      #343c42
    );

  box-shadow:
    0 14px 30px
    rgba(0,0,0,.32);
}

.plant:before{
  content:"";

  position:absolute;

  left:45px;

  top:-68px;

  width:112px;

  height:70px;

  border:
    1px solid #929ba2;

  border-radius:
    50% 50% 0 0;

  background:
    linear-gradient(
      #68737c,
      #4c555d
    );
}

.chimney{
  position:absolute;

  right:16px;

  top:-74px;

  width:21px;

  height:80px;

  background:
    repeating-linear-gradient(
      180deg,
      #eee 0 11px,
      #b43030 11px 22px
    );
}

.plantName{
  margin-top:68px;

  text-align:center;

  font-size:13px;

  font-weight:950;
}

.plantMw{
  margin-top:26px;

  color:var(--green);

  text-align:center;

  font-size:31px;

  font-weight:950;
}

.atom{
  position:absolute;

  left:50%;

  bottom:15px;

  transform:
    translateX(-50%);

  color:#67e758;

  font-size:28px;

  opacity:.8;
}

.hvcsPanel{
  position:absolute;

  z-index:30;

  right:25px;

  bottom:18px;

  width:270px;

  padding:11px;

  border:
    1px solid #2e6f43;

  border-radius:7px;

  background:
    rgba(4,19,11,.95);
}

.hvcsPanelTitle{
  color:#b9c4cc;

  font-size:9px;

  font-weight:900;
}

.hvcsPanelValue{
  margin-top:4px;

  color:var(--blue);

  font-size:24px;

  font-weight:950;
}

.hvcsPanelSub{
  margin-top:6px;

  color:#8fa0ad;

  font-size:8px;

  line-height:1.35;
}

.flowArrow{
  position:absolute;

  z-index:25;

  color:#5dbbfa;

  font-size:29px;

  font-weight:950;

  text-shadow:
    0 0 8px
    rgba(93,187,250,.35);
}

.fa1{
  left:210px;
  top:255px;
}

.fa2{
  left:760px;
  top:264px;
}

.fa3{
  left:925px;
  top:262px;
}

.fa4{
  left:1215px;
  top:257px;
}

.mainThresholdLine{
  position:absolute;

  z-index:28;

  left:195px;

  width:235px;

  top:327px;

  border-top:
    2px dashed
    var(--red);
}

.mainThresholdLabel{
  position:absolute;

  z-index:29;

  left:245px;

  top:332px;

  color:var(--red);

  font-size:8px;

  font-weight:950;
}

.bottomRail{
  height:118px;

  display:grid;

  grid-template-columns:
    1.05fr
    1fr
    1fr
    1.15fr
    1fr
    1.15fr
    1.1fr;

  border-top:
    1px solid #17334a;

  background:#05101a;
}

.bottomCard{
  position:relative;

  padding:10px;

  border-right:
    1px solid #17334a;

  text-align:center;
}

.bottomCard:last-child{
  border-right:0;
}

.bottomCard.highlight{
  border:
    1px solid #72661c;

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

.bottomGraph{
  position:absolute;

  left:16px;
  right:16px;
  bottom:18px;

  height:30px;
}

.bottomGraphLine{
  position:absolute;

  left:0;
  right:0;

  top:14px;

  height:2px;

  background:var(--green);

  transform:
    rotate(4deg);
}

.footer{
  position:absolute;

  left:12px;
  right:12px;

  bottom:10px;

  height:34px;

  display:grid;

  grid-template-columns:
    1fr
    1fr
    1fr;

  align-items:center;

  padding:
    0 10px;

  border:
    1px solid #173650;

  border-radius:6px;

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

.dir.up{
  color:var(--green);
}

.dir.down{
  color:var(--orange);
}

.dir.flat{
  color:#d0d8df;
}

.toast{
  position:fixed;

  left:50%;

  bottom:20px;

  z-index:999999;

  transform:
    translateX(-50%)
    translateY(10px);

  opacity:0;

  padding:
    8px 14px;

  border:
    1px solid #337b40;

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


<div id="stage">

<div id="board">


<div class="header">


<div class="brandRow">

<div class="brand">
  PAKS MONITOR
</div>

<div class="badge">
  VP04
</div>

<div class="live">

<span class="liveDot"></span>

ÉLŐ ADATOK

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



<div class="topGrid">


<div class="panel">

<div class="pad">


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

<canvas
  id="powerChart"
></canvas>

</div>


</div>


</div>

</div>



<div class="panel">


<div class="blocksGrid">

${blockHtml}

</div>


<div class="source">

OAH

• ${shortTime(oahTime)}

• ${oahStatus}

</div>


</div>



<div class="panel">

<div class="pad">


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

</div>


</div>



<div class="hydroPanel">


<div class="scene">


<div class="skyGlow"></div>

<div class="treeLine"></div>


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



<div class="water"></div>

<div class="bed"></div>



<div class="reading rRiver">

<div class="readLabel">
  AKTUÁLIS
</div>

<div class="readValue blue">

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

<div class="readTime">

MÉRÉS:

${shortTime(riverTime)}

</div>

</div>



<div class="reading rUp">

<div class="readLabel">
  FELVÍZ
</div>

<div class="readValue blue">

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


<div class="miniGraph">

<div class="miniLine"></div>

<div class="miniDot"></div>

</div>


</div>



<div class="reading rDown">

<div class="readLabel">
  ALVÍZ
</div>

<div class="readValue blue">

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

<div class="readLabel">
  AKTUÁLIS
</div>

<div class="readValue blue">

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

<div class="readTime">

MÉRÉS:

${shortTime(hvcsTime)}

</div>

</div>



<div class="wall wallL"></div>

<div class="wall wallR"></div>

<div class="thresholdRock"></div>



<div class="rackLabel">
  SZŰRŐRÁCS
</div>

<div class="rack"></div>



<div class="pump p1"></div>

<div class="pump p2"></div>

<div class="pump p3"></div>

<div class="pipe"></div>



<div class="plant">

<div class="chimney"></div>

<div class="plantName">
  PAKSI<br>
  ATOMERŐMŰ
</div>

<div class="plantMw">
  ${totalText}
</div>

<div class="atom">
  ⚛
</div>

</div>



<div class="hvcsPanel">

<div class="hvcsPanelTitle">
  SZIVATTYÚ SZINT (ÖBLÖZETBEN)
</div>

<div class="hvcsPanelValue">

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

<div class="hvcsPanelSub">

TARTALÉK:

${
  Number.isFinite(
    safetyDistance
  )
    ? safetyDistance +
      " cm"
    : "—"
}

• LEÁLLÁSI SZINT:

−144 cm

</div>

</div>



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
  →
</div>



<div class="mainThresholdLine"></div>

<div class="mainThresholdLabel">
  PAKS FŐÁG • −144 cm
</div>


</div>



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

</div>



<div class="bottomCard highlight">

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

<div class="bottomSub">

${
  Number.isFinite(
    safetyDistance
  )
    ? "TARTALÉK: " +
      safetyDistance +
      " cm"
    : "—"
}

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

const BOARD_W =
  1600;

const BOARD_H =
  900;

let selectedHours =
  24;

let historyCache =
  {};


function getViewportSize() {

  if (
    window.visualViewport
  ) {

    return {
      width:
        window.visualViewport
          .width,

      height:
        window.visualViewport
          .height
    };
  }

  return {
    width:
      window.innerWidth,

    height:
      window.innerHeight
  };
}


function fitBoard() {

  const board =
    document.getElementById(
      "board"
    );

  if (!board) {
    return;
  }

  const viewport =
    getViewportSize();

  const scale =
    Math.min(
      viewport.width /
      BOARD_W,

      viewport.height /
      BOARD_H
    );

  const renderedWidth =
    BOARD_W *
    scale;

  const renderedHeight =
    BOARD_H *
    scale;

  const left =
    (
      viewport.width -
      renderedWidth
    ) /
    2;

  const top =
    (
      viewport.height -
      renderedHeight
    ) /
    2;

  board.style.left =
    left +
    "px";

  board.style.top =
    top +
    "px";

  board.style.transform =
    "scale(" +
    scale +
    ")";
}


function updateClock() {

  const clock =
    document.getElementById(
      "clock"
    );

  if (!clock) {
    return;
  }

  clock.textContent =
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
    left: 40,
    right: 10,
    top: 7,
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
    data.length === 0
  ) {

    ctx.fillStyle =
      "#718397";

    ctx.font =
      "9px -apple-system";

    ctx.textAlign =
      "left";

    ctx.fillText(
      "Új mérésre várunk…",
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
      chartH *
      i /
      2;

    ctx.fillText(
      Math.round(
        value
      ) +
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
      4
    );
  }

  ctx.strokeStyle =
    "#61df54";

  ctx.fillStyle =
    "#61df54";

  ctx.lineWidth =
    2;

  ctx.lineJoin =
    "round";

  ctx.lineCap =
    "round";

  ctx.beginPath();

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
      data.length -
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
              element =>
                element.classList
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


fitBoard();

updateClock();

drawPowerChart(
  selectedHours
);

setInterval(
  updateClock,
  15000
);


let resizeTimer;


function refit() {

  clearTimeout(
    resizeTimer
  );

  resizeTimer =
    setTimeout(
      () => {

        fitBoard();

        historyCache =
          {};

        drawPowerChart(
          selectedHours
        );

      },
      120
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
      250
    );

    setTimeout(
      refit,
      700
    );
  }
);


if (
  window.visualViewport
) {

  window.visualViewport
    .addEventListener(
      "resize",
      refit
    );
}


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
