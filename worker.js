export default {
  async fetch(request, env, ctx) {
    const OAH_URL =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    const VIZ_URL =
      "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

    const PUBLIC_URL =
      "https://paks-monitor.laszlo-iglodi.workers.dev";

    const FB_IMAGE_RAW =
      "https://raw.githubusercontent.com/laszloiglodi-beep/Paks-monitor/main/60CF06BF-2068-420D-AC41-224FB3B75358.png";

    const url = new URL(request.url);

    // =========================================================
    // ADATBÁZIS ELŐKÉSZÍTÉS
    // =========================================================

    async function ensureDB() {
      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS measurements (
          ts INTEGER PRIMARY KEY,
          power INTEGER,
          water INTEGER,
          flow REAL,
          temp REAL
        );
      `);
    }

    // =========================================================
    // HTML TISZTÍTÁS
    // =========================================================

    const clean = (html) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/gi, " ")
        .replace(/&minus;/gi, "-")
        .replace(/&#8722;/gi, "-")
        .replace(/\s+/g, " ")
        .trim();

    const fmt1 = (value) =>
      typeof value === "number"
        ? value.toLocaleString("hu-HU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : "—";

    const shortTime = (value) => {
      const m = String(value).match(/(\d{2}:\d{2})/);
      return m ? m[1] : "—";
    };

    // =========================================================
    // AKTUÁLIS ADATOK LEKÉRÉSE
    // =========================================================

    async function getCurrentData() {
      let blocks = ["—", "—", "—", "—"];
      let oahTime = "—";
      let oahStatus = "OK";

      let water = null;
      let flow = null;
      let temp = null;
      let riverTime = "—";
      let riverStatus = "OK";

      try {
        const response = await fetch(OAH_URL, {
          headers: {
            "User-Agent": "Mozilla/5.0 PaksMonitor"
          }
        });

        if (!response.ok) throw new Error();

        const text = clean(await response.text());

        const date = text.match(
          /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
        );

        if (date) oahTime = date[1];

        const power = text.match(
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
          oahStatus = "ADATHIBA";
        }
      } catch {
        oahStatus = "KAPCSOLATI HIBA";
      }

      try {
        const response = await fetch(VIZ_URL, {
          headers: {
            "User-Agent": "Mozilla/5.0 PaksMonitor"
          }
        });

        if (!response.ok) throw new Error();

        const text = clean(await response.text());

        const row = text.match(
          /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
        );

        if (row) {
          riverTime = row[1];
          water = Number(row[2]);

          if (row[3] !== "-") {
            flow = Number(row[3].replace(",", "."));
          }

          if (row[4] !== "-") {
            temp = Number(row[4].replace(",", "."));
          } else if (row[5] !== "-") {
            temp = Number(row[5].replace(",", "."));
          }
        } else {
          riverStatus = "ADATHIBA";
        }
      } catch {
        riverStatus = "KAPCSOLATI HIBA";
      }

      const total =
        blocks.every((x) => x !== "—")
          ? blocks.reduce((sum, value) => sum + Number(value), 0)
          : null;

      return {
        blocks,
        total,
        water,
        flow,
        temp,
        oahTime,
        riverTime,
        oahStatus,
        riverStatus
      };
    }

    // =========================================================
    // ADAT MENTÉSE D1-BE
    // =========================================================

    async function saveMeasurement(data) {
      await ensureDB();

      const bucket =
        Math.floor(Date.now() / 300000) * 300000;

      await env.DB
        .prepare(`
          INSERT OR REPLACE INTO measurements
          (ts, power, water, flow, temp)
          VALUES (?, ?, ?, ?, ?)
        `)
        .bind(
          bucket,
          typeof data.total === "number" ? data.total : null,
          typeof data.water === "number" ? data.water : null,
          typeof data.flow === "number" ? data.flow : null,
          typeof data.temp === "number" ? data.temp : null
        )
        .run();

      const cutoff =
        Date.now() - 11 * 24 * 60 * 60 * 1000;

      await env.DB
        .prepare(`
          DELETE FROM measurements
          WHERE ts < ?
        `)
        .bind(cutoff)
        .run();
    }

    // =========================================================
    // FACEBOOK KÉP
    // =========================================================

    if (url.pathname === "/facebook-image") {
      const imageResponse = await fetch(FB_IMAGE_RAW);

      return new Response(imageResponse.body, {
        headers: {
          "content-type": "image/png",
          "cache-control": "public, max-age=86400"
        }
      });
    }

    // =========================================================
    // HISTORY API
    // =========================================================

    if (url.pathname === "/api/history") {
      await ensureDB();

      let hours = Number(url.searchParams.get("hours") || 6);

      if (![6, 24, 240].includes(hours)) {
        hours = 6;
      }

      const cutoff =
        Date.now() - hours * 60 * 60 * 1000;

      const result = await env.DB
        .prepare(`
          SELECT ts, power, water, flow, temp
          FROM measurements
          WHERE ts >= ?
          ORDER BY ts ASC
        `)
        .bind(cutoff)
        .all();

      return Response.json(result.results || [], {
        headers: {
          "cache-control": "no-store"
        }
      });
    }

    // =========================================================
    // FŐOLDAL
    // =========================================================

    const data = await getCurrentData();

    ctx.waitUntil(
      saveMeasurement(data)
    );

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
      typeof total === "number"
        ? `${total} MW`
        : "— MW";

    const waterText =
      typeof water === "number"
        ? `${water} cm`
        : "— cm";

    const shutdownDistance =
      typeof water === "number"
        ? water + 134
        : null;

    const safetyDistance =
      typeof water === "number"
        ? water + 144
        : null;

    let riverClass = "normal";
    let riverLabel = "NORMÁL TARTOMÁNY";

    if (typeof water === "number") {
      if (water <= -144) {
        riverClass = "danger";
        riverLabel = "KRITIKUS VÍZSZINT";
      } else if (water <= -134) {
        riverClass = "warning";
        riverLabel = "LEÁLLÁSI TARTOMÁNY";
      } else if (water <= -129) {
        riverClass = "warning";
        riverLabel = "FIGYELMEZTETÉS";
      }
    }

    let markerPct = 0;

    if (typeof water === "number") {
      markerPct =
        ((-110 - water) / 40) * 100;

      markerPct =
        Math.max(
          0,
          Math.min(100, markerPct)
        );
    }

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

<meta
  name="apple-mobile-web-app-status-bar-style"
  content="black"
>

<meta
  name="apple-mobile-web-app-title"
  content="PAKS ADATOK"
>

<title>⚛️ PAKS AKTUÁLIS ADATOK</title>

<meta property="og:type" content="website">
<meta property="og:title" content="⚛️ PAKS AKTUÁLIS ADATOK">
<meta
  property="og:description"
  content="Paksi Atomerőmű • Duna vízállás • vízhozam • vízhőmérséklet • élő adatok"
>
<meta property="og:url" content="${PUBLIC_URL}/">
<meta property="og:image" content="${PUBLIC_URL}/facebook-image">
<meta property="og:image:secure_url" content="${PUBLIC_URL}/facebook-image">
<meta property="og:image:type" content="image/png">

<meta
  property="og:image:alt"
  content="PAKS aktuális adatok – Paksi Atomerőmű és Duna"
>

<meta
  name="twitter:card"
  content="summary_large_image"
>
<meta
  name="twitter:title"
  content="⚛️ PAKS AKTUÁLIS ADATOK"
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
    max(10px,env(safe-area-inset-top))
    10px
    max(8px,env(safe-area-inset-bottom));
}

.header{
  display:grid;
  grid-template-columns:auto 1fr auto;
  align-items:center;
  gap:9px;
  margin-bottom:8px;
}

.logo{
  width:42px;
  height:42px;
  border-radius:12px;
  display:grid;
  place-items:center;
  font-size:25px;
  background:
    linear-gradient(
      145deg,
      #bd53ff,
      #55117d
    );
}

.title{
  font-size:21px;
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
  font-size:10px;
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
  border-radius:18px;
  overflow:hidden;
  margin-bottom:8px;
}

.inner{
  padding:12px;
}

.cardTitle{
  color:#a5b1bf;
  font-size:11px;
  letter-spacing:.55px;
  font-weight:850;
}

.mainRow{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:10px;
  margin:5px 0 8px;
}

.big{
  font-size:43px;
  line-height:.95;
  letter-spacing:-1.7px;
  font-weight:950;
}

.power{
  color:var(--green);
}

.water{
  color:var(--blue);
}

.caption{
  padding-bottom:4px;
  color:#78879a;
  font-size:9px;
}

.status{
  padding-bottom:4px;
  font-size:10px;
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
  margin-bottom:8px;
  padding:8px 8px 5px;
  background:#050e18;
  border:1px solid #132b40;
  border-radius:12px;
}

.chartTop{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin-bottom:5px;
}

.chartTitle{
  color:#8f9eb1;
  font-size:8px;
  font-weight:800;
}

.periods{
  display:flex;
  gap:3px;
}

.periodButton{
  border:0;
  padding:3px 7px;
  border-radius:999px;
  background:#111e2b;
  color:#8394a8;
  font-size:7px;
  font-weight:850;
  cursor:pointer;
}

.periodButton.active{
  color:white;
  background:#234663;
}

.chartWrap{
  position:relative;
  width:100%;
  height:100px;
}

canvas{
  display:block;
  width:100%;
  height:100%;
}

.blocks{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
}

.block{
  padding:7px 9px;
  background:var(--panel2);
  border-radius:10px;
  border:1px solid #142b3f;
}

.blockName{
  color:#8c9bad;
  font-size:8px;
}

.blockValue{
  margin-top:2px;
  font-size:18px;
  line-height:1;
  font-weight:900;
}

.metrics{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
}

.metric{
  padding:7px 9px;
  border-radius:10px;
  background:var(--panel2);
}

.metricName{
  color:#8c9bad;
  font-size:8px;
}

.metricValue{
  margin-top:2px;
  font-size:17px;
  font-weight:900;
}

.gauge{
  position:relative;
  height:10px;
  border-radius:999px;
  margin-top:8px;
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
  height:20px;
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

.distances{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:6px;
  margin-top:6px;
}

.distance{
  padding:6px 8px;
  border-radius:10px;
  background:var(--panel2);
}

.distanceValue{
  font-size:14px;
  font-weight:950;
}

.distanceLabel{
  color:#78889b;
  font-size:6px;
}

.source{
  padding:6px 12px;
  border-top:1px solid #172e42;
  color:#718296;
  font-size:8px;
}

.bottom{
  display:grid;
  grid-template-columns:.55fr 1.55fr;
  gap:6px;
}

.signature{
  display:grid;
  place-items:center;
  min-height:48px;
  border:1px solid #3e2255;
  border-radius:12px;
  background:#100817;
  color:var(--purple);
  font-size:13px;
  font-weight:950;
  letter-spacing:2px;
}

.share{
  min-width:0;
  border:1px solid #17334a;
  border-radius:12px;
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
  grid-template-columns:1fr 58px;
  gap:4px;
}

.url{
  min-width:0;
  height:27px;
  display:flex;
  align-items:center;
  padding:0 7px;
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
  height:27px;
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
    font-size:72px;
  }

  .blockValue{
    font-size:27px;
  }

  .metricValue{
    font-size:26px;
  }
}

</style>

<script>

const PUBLIC_URL =
  "${PUBLIC_URL}";

let selectedRange = {
  power:6,
  water:6
};

let cachedHistory = {};

async function loadHistory(hours){

  if(cachedHistory[hours]){
    return cachedHistory[hours];
  }

  const r =
    await fetch(
      "/api/history?hours=" +
      hours,
      {
        cache:"no-store"
      }
    );

  const data =
    await r.json();

  cachedHistory[hours] =
    data;

  return data;
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

  const dataRaw =
    await loadHistory(
      hours
    );

  const data =
    dataRaw
      .filter(
        x =>
          typeof x[field] ===
          "number"
      )
      .map(
        x => ({
          x:Number(x.ts),
          y:Number(x[field])
        })
      );

  const rect =
    canvas.getBoundingClientRect();

  const ratio =
    window.devicePixelRatio || 1;

  canvas.width =
    rect.width * ratio;

  canvas.height =
    rect.height * ratio;

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

  ctx.clearRect(
    0,
    0,
    W,
    H
  );

  const pad = {
    left:38,
    right:8,
    top:8,
    bottom:20
  };

  ctx.strokeStyle =
    "rgba(115,145,170,.18)";

  ctx.lineWidth = 1;

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

  if(data.length === 0){

    ctx.fillStyle =
      "#718397";

    ctx.font =
      "10px -apple-system";

    ctx.fillText(
      "Adatgyűjtés folyamatban…",
      pad.left + 10,
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
    (
      maxY -
      minY
    ) * .15;

  minY -= margin;
  maxY += margin;

  const minX =
    Date.now() -
    hours *
    60 *
    60 *
    1000;

  const maxX =
    Date.now();

  const chartW =
    W -
    pad.left -
    pad.right;

  const chartH =
    H -
    pad.top -
    pad.bottom;

  const sx = x =>
    pad.left +
    (
      x - minX
    ) /
    (
      maxX - minX
    ) *
    chartW;

  const sy = y =>
    pad.top +
    (
      maxY - y
    ) /
    (
      maxY - minY
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

  ctx.textAlign =
    "center";

  const divisions =
    hours >= 240
      ? 4
      : 3;

  for(let i=0;i<=divisions;i++){

    const t =
      minX +
      (
        maxX - minX
      ) *
      i /
      divisions;

    const d =
      new Date(t);

    let label;

    if(hours >= 240){

      label =
        d.toLocaleDateString(
          "hu-HU",
          {
            month:"2-digit",
            day:"2-digit"
          }
        );

    }else{

      label =
        d.toLocaleTimeString(
          "hu-HU",
          {
            hour:"2-digit",
            minute:"2-digit"
          }
        );
    }

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

    ctx.fillStyle =
      "#718397";

    ctx.textAlign =
      "left";

    ctx.font =
      "9px -apple-system";

    ctx.fillText(
      "1 adatpont – a vonal a következő mérés után jelenik meg",
      pad.left + 10,
      H / 2
    );

    return;
  }

  ctx.beginPath();

  data.forEach(
    (point,index)=>{

      const x =
        sx(point.x);

      const y =
        sy(point.y);

      if(index === 0){
        ctx.moveTo(x,y);
      }else{
        ctx.lineTo(x,y);
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

function clearCache(){
  cachedHistory = {};
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

  redraw();
}

function copyLink(){

  if(navigator.clipboard){

    navigator.clipboard
      .writeText(
        PUBLIC_URL
      )
      .then(
        showToast
      );

  }else{

    window.prompt(
      "Másold ki a linket:",
      PUBLIC_URL
    );
  }
}

function showToast(){

  const toast =
    document.getElementById(
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
    1500
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

    clearCache();

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
        class="periodButton active"
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
        class="periodButton"
        data-chart="power"
        onclick="setRange('power',240,this)"
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

  <div class="block">
    <div class="blockName">1. BLOKK</div>
    <div class="blockValue">${blocks[0]} MW</div>
  </div>

  <div class="block">
    <div class="blockName">2. BLOKK</div>
    <div class="blockValue">${blocks[1]} MW</div>
  </div>

  <div class="block">
    <div class="blockName">3. BLOKK</div>
    <div class="blockValue">${blocks[2]} MW</div>
  </div>

  <div class="block">
    <div class="blockName">4. BLOKK</div>
    <div class="blockValue">${blocks[3]} MW</div>
  </div>

</div>

</div>

<div class="source">
  OAH • ${shortTime(oahTime)} • ${oahStatus}
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
        class="periodButton active"
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
        class="periodButton"
        data-chart="water"
        onclick="setRange('water',240,this)"
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
    typeof water === "number"
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
          ? Math.abs(shutdownDistance) + " cm"
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
          ? Math.abs(safetyDistance) + " cm"
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
  VÍZÜGY • ${shortTime(riverTime)} • ${riverStatus}
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

<div
  class="toast"
  id="toast"
>
  ✓ LINK MÁSOLVA
</div>

</body>

</html>`;

    return new Response(
      html,
      {
        headers:{
          "content-type":
            "text/html;charset=UTF-8",
          "cache-control":
            "no-store"
        }
      }
    );
  },

  async scheduled(controller, env, ctx) {

    const OAH_URL =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    const VIZ_URL =
      "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

    const clean = (html) =>
      html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/gi, " ")
        .replace(/&minus;/gi, "-")
        .replace(/&#8722;/gi, "-")
        .replace(/\s+/g, " ")
        .trim();

    await env.DB.exec(`
      CREATE TABLE IF NOT EXISTS measurements (
        ts INTEGER PRIMARY KEY,
        power INTEGER,
        water INTEGER,
        flow REAL,
        temp REAL
      );
    `);

    let total = null;
    let water = null;
    let flow = null;
    let temp = null;

    try {

      const r =
        await fetch(OAH_URL, {
          headers:{
            "User-Agent":
              "Mozilla/5.0 PaksMonitor"
          }
        });

      const text =
        clean(
          await r.text()
        );

      const power =
        text.match(
          /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
        );

      if(power){

        total =
          Number(power[1]) +
          Number(power[2]) +
          Number(power[3]) +
          Number(power[4]);

      }

    }catch{}


    try {

      const r =
        await fetch(VIZ_URL, {
          headers:{
            "User-Agent":
              "Mozilla/5.0 PaksMonitor"
          }
        });

      const text =
        clean(
          await r.text()
        );

      const row =
        text.match(
          /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
        );

      if(row){

        water =
          Number(row[2]);

        if(row[3] !== "-"){
          flow =
            Number(
              row[3]
                .replace(",", ".")
            );
        }

        if(row[4] !== "-"){
          temp =
            Number(
              row[4]
                .replace(",", ".")
            );
        }else if(row[5] !== "-"){
          temp =
            Number(
              row[5]
                .replace(",", ".")
            );
        }

      }

    }catch{}


    const bucket =
      Math.floor(
        Date.now() /
        300000
      ) *
      300000;


    await env.DB
      .prepare(`
        INSERT OR REPLACE INTO measurements
        (ts,power,water,flow,temp)
        VALUES (?,?,?,?,?)
      `)
      .bind(
        bucket,
        total,
        water,
        flow,
        temp
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
      .prepare(`
        DELETE FROM measurements
        WHERE ts < ?
      `)
      .bind(cutoff)
      .run();
  }
};
