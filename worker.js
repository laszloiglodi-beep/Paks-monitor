export default {

  // ============================================================
  // WEBOLDAL
  // ============================================================

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


    // ============================================================
    // SEGÉDFÜGGVÉNYEK
    // ============================================================

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
      typeof value === "number" && Number.isFinite(value)
        ? value.toLocaleString("hu-HU", {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
          })
        : "—";


    const shortTime = (value) => {
      const m = String(value || "").match(/(\d{2}:\d{2})/);
      return m ? m[1] : "—";
    };


    // ============================================================
    // D1 TÁBLA
    // ============================================================

    async function ensureDB() {

      if (!env || !env.DB) {
        throw new Error("DB binding missing");
      }

      await env.DB.exec(`
        CREATE TABLE IF NOT EXISTS measurements (
          ts INTEGER PRIMARY KEY,
          power INTEGER,
          water INTEGER,
          flow REAL,
          temp REAL
        )
      `);
    }


    // ============================================================
    // AKTUÁLIS ADATOK
    // ============================================================

    async function getCurrentData() {

      let blocks = ["—", "—", "—", "—"];

      let oahTime = "—";
      let oahStatus = "OK";

      let water = null;
      let flow = null;
      let temp = null;

      let riverTime = "—";
      let riverStatus = "OK";


      // ---------------- PAKS ----------------

      try {

        const response = await fetch(OAH_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/1.0)"
          }
        });

        if (!response.ok) {
          throw new Error("OAH HTTP " + response.status);
        }

        const text =
          clean(await response.text());


        const date = text.match(
          /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
        );

        if (date) {
          oahTime = date[1];
        }


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

      } catch (e) {

        oahStatus = "KAPCSOLATI HIBA";
      }


      // ---------------- DUNA ----------------

      try {

        const response = await fetch(VIZ_URL, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (compatible; PaksMonitor/1.0)"
          }
        });

        if (!response.ok) {
          throw new Error("VIZ HTTP " + response.status);
        }

        const text =
          clean(await response.text());


        const row = text.match(
          /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
        );


        if (row) {

          riverTime = row[1];

          water = Number(row[2]);


          if (row[3] !== "-") {

            const n =
              Number(row[3].replace(",", "."));

            if (Number.isFinite(n)) {
              flow = n;
            }
          }


          if (row[4] !== "-") {

            const n =
              Number(row[4].replace(",", "."));

            if (Number.isFinite(n)) {
              temp = n;
            }

          } else if (row[5] !== "-") {

            const n =
              Number(row[5].replace(",", "."));

            if (Number.isFinite(n)) {
              temp = n;
            }
          }

        } else {

          riverStatus = "ADATHIBA";
        }

      } catch (e) {

        riverStatus = "KAPCSOLATI HIBA";
      }


      const total =
        blocks.every(x => /^\d+$/.test(String(x)))
          ? blocks.reduce(
              (sum, value) => sum + Number(value),
              0
            )
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


    // ============================================================
    // D1 MENTÉS
    // ============================================================

    async function saveMeasurement(data) {

      try {

        await ensureDB();


        // 5 perces időablak
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
            Number.isFinite(data.total)
              ? data.total
              : null,

            Number.isFinite(data.water)
              ? data.water
              : null,

            Number.isFinite(data.flow)
              ? data.flow
              : null,

            Number.isFinite(data.temp)
              ? data.temp
              : null
          )
          .run();


        // 11 napnál régebbi adatok törlése
        const cutoff =
          Date.now() -
          11 * 24 * 60 * 60 * 1000;


        await env.DB
          .prepare(`
            DELETE FROM measurements
            WHERE ts < ?
          `)
          .bind(cutoff)
          .run();


      } catch (e) {

        console.log(
          "D1 SAVE ERROR:",
          e && e.message
            ? e.message
            : String(e)
        );
      }
    }


    // ============================================================
    // FACEBOOK KÉP
    // ============================================================

    if (url.pathname === "/facebook-image") {

      try {

        const imageResponse =
          await fetch(FB_IMAGE_RAW);


        if (!imageResponse.ok) {

          return new Response(
            "Image not found",
            { status: 404 }
          );
        }


        return new Response(
          imageResponse.body,
          {
            headers: {
              "content-type": "image/png",
              "cache-control":
                "public, max-age=86400"
            }
          }
        );


      } catch (e) {

        return new Response(
          "Image unavailable",
          { status: 503 }
        );
      }
    }


    // ============================================================
    // HISTORY API
    // ============================================================

    if (url.pathname === "/api/history") {

      try {

        await ensureDB();


        let hours =
          Number(
            url.searchParams.get("hours") || 6
          );


        if (![6, 24, 240].includes(hours)) {
          hours = 6;
        }


        const cutoff =
          Date.now() -
          hours * 60 * 60 * 1000;


        const result =
          await env.DB
            .prepare(`
              SELECT
                ts,
                power,
                water,
                flow,
                temp
              FROM measurements
              WHERE ts >= ?
              ORDER BY ts ASC
            `)
            .bind(cutoff)
            .all();


        return new Response(
          JSON.stringify({
            ok: true,
            count:
              Array.isArray(result.results)
                ? result.results.length
                : 0,
            data:
              Array.isArray(result.results)
                ? result.results
                : []
          }),
          {
            status: 200,
            headers: {
              "content-type":
                "application/json;charset=UTF-8",

              "cache-control":
                "no-store",

              "access-control-allow-origin":
                "*"
            }
          }
        );


      } catch (e) {

        return new Response(
          JSON.stringify({
            ok: false,
            count: 0,
            data: [],
            error:
              e && e.message
                ? e.message
                : String(e)
          }),
          {
            status: 200,
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


    // ============================================================
    // FŐOLDAL ADAT
    // ============================================================

    const data =
      await getCurrentData();


    // Oldalmegnyitáskor is mentünk egy pontot.
    if (ctx && typeof ctx.waitUntil === "function") {

      ctx.waitUntil(
        saveMeasurement(data)
      );

    } else {

      saveMeasurement(data);
    }


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


    let markerPct = 0;


    if (Number.isFinite(water)) {

      markerPct =
        ((-110 - water) / 40) * 100;

      markerPct =
        Math.max(
          0,
          Math.min(100, markerPct)
        );
    }


    // ============================================================
    // HTML
    // ============================================================

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


<!-- FACEBOOK -->

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

<meta
  property="og:image:secure_url"
  content="${PUBLIC_URL}/facebook-image"
>

<meta
  property="og:image:type"
  content="image/png"
>

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
  cursor:pointer;
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
  left:${markerPct}%;
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

let cache = {};


async function getHistory(hours){

  try{

    const response =
      await fetch(
        "/api/history?hours=" + hours,
        {
          cache:"no-store"
        }
      );


    const json =
      await response.json();


    if(
      json &&
      json.ok === true &&
      Array.isArray(json.data)
    ){
      return json.data;
    }


    return [];


  }catch(e){

    console.log(
      "History error",
      e
    );

    return [];
  }
}


async function loadHistory(hours){

  if(cache[hours]){
    return cache[hours];
  }

  const data =
    await getHistory(hours);

  cache[hours] =
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


  const rows =
    await loadHistory(hours);


  const data =
    rows
      .map(row => ({
        x:Number(row.ts),
        y:Number(row[field])
      }))
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
      Math.floor(rect.width * ratio)
    );


  canvas.height =
    Math.max(
      1,
      Math.floor(rect.height * ratio)
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


  // NINCS ADAT

  if(data.length === 0){

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


  let minY =
    Math.min(
      ...data.map(p => p.y)
    );


  let maxY =
    Math.max(
      ...data.map(p => p.y)
    );


  if(minY === maxY){

    const delta =
      Math.max(
        1,
        Math.abs(minY) * .02
      );

    minY -= delta;
    maxY += delta;
  }


  const margin =
    Math.max(
      1,
      (maxY - minY) * .15
    );


  minY -= margin;
  maxY += margin;


  const now =
    Date.now();


  const minX =
    now -
    hours *
    60 *
    60 *
    1000;


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


  // Y FELIRATOK

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


  // X TENGELY

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


  // EGYETLEN PONT IS LÁTSZIK

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

    ctx.font =
      "9px -apple-system";

    ctx.textAlign =
      "left";

    ctx.fillText(
      "1 mérés – a következő pont után indul a görbe",
      pad.left + 8,
      H / 2
    );

    return;
  }


  // VONAL

  ctx.beginPath();


  data.forEach(
    (point,index)=>{

      const x =
        sx(point.x);

      const y =
        sy(point.y);


      if(index === 0){

        ctx.moveTo(
          x,
          y
        );

      }else{

        ctx.lineTo(
          x,
          y
        );
      }
    }
  );


  ctx.stroke();


  // UTOLSÓ PONT

  const last =
    data[data.length - 1];


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


  redraw();
}


function copyLink(){

  if(navigator.clipboard){

    navigator.clipboard
      .writeText(PUBLIC_URL)
      .then(showToast);

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


// 5 percenként frissítjük a grafikont

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


<!-- ============================================================
     PAKS
     ============================================================ -->

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

    <div class="blockName">
      1. BLOKK
    </div>

    <div class="blockValue">
      ${blocks[0]} MW
    </div>

  </div>


  <div class="block">

    <div class="blockName">
      2. BLOKK
    </div>

    <div class="blockValue">
      ${blocks[1]} MW
    </div>

  </div>


  <div class="block">

    <div class="blockName">
      3. BLOKK
    </div>

    <div class="blockValue">
      ${blocks[2]} MW
    </div>

  </div>


  <div class="block">

    <div class="blockName">
      4. BLOKK
    </div>

    <div class="blockValue">
      ${blocks[3]} MW
    </div>

  </div>

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


<!-- ============================================================
     DUNA
     ============================================================ -->

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

  VÍZÜGY
  •
  ${shortTime(riverTime)}
  •
  ${riverStatus}

</div>


</section>


</div>


<!-- ============================================================
     ALSÓ RÉSZ
     ============================================================ -->

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
        status: 200,
        headers: {
          "content-type":
            "text/html;charset=UTF-8",

          "cache-control":
            "no-store"
        }
      }
    );
  },


  // ============================================================
  // 5 PERCES CRON
  // ============================================================

  async scheduled(controller, env, ctx) {

    ctx.waitUntil(
      collectScheduledData(env)
    );
  }

};


// ================================================================
// CRON ADATGYŰJTÉS
// ================================================================

async function collectScheduledData(env) {

  try {

    if (!env || !env.DB) {

      console.log(
        "CRON: DB binding missing"
      );

      return;
    }


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
      )
    `);


    let total = null;

    let water = null;

    let flow = null;

    let temp = null;


    // ---------------- PAKS ----------------

    try {

      const response =
        await fetch(
          OAH_URL,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; PaksMonitor/1.0)"
            }
          }
        );


      if (response.ok) {

        const text =
          clean(
            await response.text()
          );


        const power = text.match(
          /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
        );


        if (power) {

          total =
            Number(power[1]) +
            Number(power[2]) +
            Number(power[3]) +
            Number(power[4]);
        }
      }

    } catch (e) {

      console.log(
        "CRON OAH ERROR:",
        e && e.message
          ? e.message
          : String(e)
      );
    }


    // ---------------- DUNA ----------------

    try {

      const response =
        await fetch(
          VIZ_URL,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; PaksMonitor/1.0)"
            }
          }
        );


      if (response.ok) {

        const text =
          clean(
            await response.text()
          );


        const row = text.match(
          /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
        );


        if (row) {

          const w =
            Number(row[2]);


          if (Number.isFinite(w)) {
            water = w;
          }


          if (row[3] !== "-") {

            const n =
              Number(
                row[3].replace(",", ".")
              );

            if (Number.isFinite(n)) {
              flow = n;
            }
          }


          if (row[4] !== "-") {

            const n =
              Number(
                row[4].replace(",", ".")
              );

            if (Number.isFinite(n)) {
              temp = n;
            }

          } else if (row[5] !== "-") {

            const n =
              Number(
                row[5].replace(",", ".")
              );

            if (Number.isFinite(n)) {
              temp = n;
            }
          }
        }
      }

    } catch (e) {

      console.log(
        "CRON VIZ ERROR:",
        e && e.message
          ? e.message
          : String(e)
      );
    }


    // ---------------- MENTÉS ----------------

    const bucket =
      Math.floor(
        Date.now() / 300000
      ) * 300000;


    await env.DB
      .prepare(`
        INSERT OR REPLACE INTO measurements
        (ts, power, water, flow, temp)
        VALUES (?, ?, ?, ?, ?)
      `)
      .bind(
        bucket,
        Number.isFinite(total)
          ? total
          : null,

        Number.isFinite(water)
          ? water
          : null,

        Number.isFinite(flow)
          ? flow
          : null,

        Number.isFinite(temp)
          ? temp
          : null
      )
      .run();


    // ---------------- TAKARÍTÁS ----------------

    const cutoff =
      Date.now() -
      11 * 24 * 60 * 60 * 1000;


    await env.DB
      .prepare(`
        DELETE FROM measurements
        WHERE ts < ?
      `)
      .bind(cutoff)
      .run();


    console.log(
      "CRON OK",
      bucket,
      total,
      water
    );


  } catch (e) {

    console.log(
      "CRON FATAL:",
      e && e.message
        ? e.message
        : String(e)
    );
  }
}
