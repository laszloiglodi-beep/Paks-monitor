const html = `<!doctype html>
<html lang="hu">

<head>

<meta charset="utf-8">

<!--
  V10 FEKVŐ / ZOOMOLHATÓ NÉZET

  - fix 1500 px széles dashboard
  - álló telefonon az egész egyben látszik
  - fekvő telefonon nagyobb lesz
  - pinch zoom engedélyezve
-->

<meta
  name="viewport"
  content="width=1536,initial-scale=1,minimum-scale=0.15,maximum-scale=5,user-scalable=yes,viewport-fit=cover"
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
  --bg:#020811;
  --panel:#07111c;
  --panel2:#0b1724;
  --line:#173650;
  --white:#f5f7fa;
  --muted:#8998aa;
  --green:#65df58;
  --blue:#4baaff;
  --orange:#ffad30;
  --red:#ff5b61;
  --purple:#c04dff;
}

*{
  box-sizing:border-box;
}

html{
  margin:0;
  padding:0;
  width:100%;
  min-width:1536px;
  min-height:100%;
  background:#000;
  touch-action:pan-x pan-y pinch-zoom;
}

body{
  margin:0;
  padding:0;
  width:100%;
  min-width:1536px;
  min-height:100vh;

  overflow:auto;

  background:
    radial-gradient(
      circle at 50% -10%,
      #0d2139 0%,
      #040b14 38%,
      #02060b 100%
    );

  color:var(--white);

  font-family:
    -apple-system,
    BlinkMacSystemFont,
    "Segoe UI",
    Arial,
    sans-serif;

  -webkit-text-size-adjust:100%;
  touch-action:pan-x pan-y pinch-zoom;
}


/* ============================================================
   FIX FEKVŐ VÁSZON
============================================================ */

.app{
  width:1500px;
  min-width:1500px;
  max-width:1500px;

  margin:18px auto;
  padding:0;
}


/* ============================================================
   FEJLÉC
============================================================ */

.header{
  height:58px;

  display:grid;
  grid-template-columns:340px 1fr 430px;

  align-items:center;

  gap:12px;

  margin-bottom:10px;
}

.brand{
  display:flex;
  align-items:center;
  gap:10px;
}

.logo{
  width:46px;
  height:46px;

  display:grid;
  place-items:center;

  border-radius:12px;

  font-size:27px;

  background:
    linear-gradient(
      145deg,
      #bf54ff,
      #57127c
    );
}

.title{
  font-size:25px;
  line-height:1;
  font-weight:950;
  letter-spacing:-.7px;
}

.versionBadge{
  display:inline-block;

  margin-left:8px;

  padding:4px 8px;

  border-radius:6px;

  background:#541269;

  color:#f0a6ff;

  font-size:10px;
}

.live{
  display:flex;
  align-items:center;
  justify-content:center;

  gap:7px;

  color:var(--green);

  font-size:13px;
  font-weight:900;
}

.liveDot{
  width:9px;
  height:9px;

  border-radius:50%;

  background:var(--green);

  box-shadow:
    0 0 9px var(--green);
}

.headerRight{
  display:grid;

  grid-template-columns:1fr 70px;

  gap:5px;

  height:38px;
}

.shareLink{
  min-width:0;

  display:flex;
  align-items:center;

  padding:0 8px;

  border:1px solid #9636c5;
  border-radius:7px;

  background:#16091d;

  color:#d24fff;

  text-decoration:none;

  white-space:nowrap;
  overflow:hidden;
  text-overflow:ellipsis;

  font-size:8px;
}

.copy{
  border:0;

  border-radius:7px;

  background:#142130;

  color:white;

  font-size:8px;
  font-weight:900;
}


/* ============================================================
   FELSŐ 3 PANEL
============================================================ */

.topGrid{
  display:grid;

  grid-template-columns:
    390px
    545px
    545px;

  gap:10px;

  height:250px;

  margin-bottom:10px;
}

.panel{
  border:1px solid var(--line);

  border-radius:10px;

  background:
    linear-gradient(
      145deg,
      #08141f,
      #06101a
    );

  overflow:hidden;
}

.pad{
  padding:12px;
}

.sectionTitle{
  color:#a9b4c1;

  font-size:11px;

  font-weight:900;

  letter-spacing:.4px;
}

.bigRow{
  display:flex;

  align-items:flex-end;

  justify-content:space-between;

  gap:8px;

  margin:
    6px 0 8px;
}

.bigPower{
  color:var(--green);

  font-size:46px;

  line-height:.92;

  font-weight:950;

  letter-spacing:-1.8px;
}

.bigWater{
  color:var(--blue);

  font-size:46px;

  line-height:.92;

  font-weight:950;

  letter-spacing:-1.8px;
}

.smallCaption{
  padding-bottom:4px;

  color:#718194;

  font-size:8px;
}

.status{
  padding-bottom:4px;

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


/* ============================================================
   GRAFIKONOK
============================================================ */

.chartPanel{
  padding:7px;

  border:1px solid #132c41;

  border-radius:8px;

  background:#050e18;

  margin-bottom:7px;
}

.chartHead{
  display:flex;

  justify-content:space-between;

  align-items:center;

  gap:5px;

  margin-bottom:3px;
}

.chartName{
  color:#8495a9;

  font-size:7px;

  font-weight:850;
}

.buttons{
  display:flex;

  gap:3px;
}

.period{
  border:0;

  border-radius:999px;

  padding:4px 7px;

  background:#111e2b;

  color:#8495a9;

  font-size:7px;

  font-weight:850;
}

.period.active{
  background:#234763;

  color:#fff;
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


/* ============================================================
   BLOKKOK
============================================================ */

.blocks{
  display:grid;

  grid-template-columns:
    repeat(4,1fr);

  height:220px;
}

.block{
  position:relative;

  padding:18px 14px;

  border-right:1px solid #183047;

  background:
    linear-gradient(
      180deg,
      #081522,
      #06101a
    );
}

.block:last-child{
  border-right:0;
}

.blockName{
  color:#9ba9b8;

  font-size:10px;

  font-weight:800;
}

.blockValue{
  margin-top:37px;

  font-size:24px;

  line-height:1;

  font-weight:950;
}

.source{
  height:28px;

  display:flex;

  align-items:center;

  padding:0 11px;

  border-top:1px solid #173047;

  color:#6f8092;

  font-size:8px;
}


/* ============================================================
   HŐ / FŐÁGI KÜSZÖB
============================================================ */

.metrics{
  display:grid;

  grid-template-columns:
    1fr 1fr 1.2fr;

  gap:6px;
}

.metric{
  min-width:0;

  padding:10px;

  border-radius:7px;

  border:1px solid #10283b;

  background:#0b1724;
}

.metricName{
  min-height:24px;

  color:#8292a4;

  font-size:8px;

  line-height:1.1;
}

.metricValue{
  margin-top:4px;

  white-space:nowrap;

  font-size:20px;

  font-weight:900;
}

.orange{
  color:var(--orange);
}

.infoRule{
  margin-top:7px;

  padding:8px;

  border:1px solid #684a18;

  border-radius:7px;

  background:#171208;

  color:#ffb340;

  text-align:center;

  font-size:9px;

  font-weight:900;
}

.gauge{
  position:relative;

  height:10px;

  margin-top:11px;

  border-radius:999px;

  background:
    linear-gradient(
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

  top:-6px;

  width:4px;
  height:22px;

  background:white;

  border-radius:3px;

  transform:
    translateX(-50%);

  box-shadow:
    0 0 7px white;
}

.scale{
  display:grid;

  grid-template-columns:
    1fr 1fr 1fr;

  margin-top:4px;

  font-size:8px;
}

.scale span:nth-child(1){
  color:#748396;
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
    1fr 1fr;

  gap:6px;

  margin-top:7px;
}

.distance{
  padding:7px 10px;

  border:1px solid #10283b;

  border-radius:7px;

  background:#0b1724;
}

.distanceNumber{
  font-size:19px;

  font-weight:950;
}

.distanceText{
  color:#718194;

  font-size:8px;
}


/* ============================================================
   NAGY FOLYAMATÁBRA
============================================================ */

.systemPanel{
  height:400px;

  margin-bottom:10px;

  position:relative;

  border:1px solid var(--line);

  border-radius:10px;

  overflow:hidden;

  background:#07131f;
}

.systemTitle{
  height:35px;

  display:flex;

  align-items:center;

  justify-content:space-between;

  padding:0 13px;

  border-bottom:1px solid #17364f;

  background:#06111c;
}

.systemTitleMain{
  font-size:12px;

  font-weight:950;

  color:#d3dce5;
}

.systemTitleLive{
  color:#6f8397;

  font-size:9px;

  font-weight:800;
}


/* ============================================================
   ÉLŐ ADATSOR A RAJZ FÖLÖTT
============================================================ */

.dataRail{
  height:74px;

  display:grid;

  grid-template-columns:
    repeat(5,1fr);

  gap:6px;

  padding:7px;

  background:#050e17;

  border-bottom:1px solid #17354d;
}

.dataBox{
  min-width:0;

  padding:6px;

  border:1px solid #18364e;

  border-radius:7px;

  background:#07131f;

  text-align:center;
}

.dataBox.upliftBox{
  border-color:#37793f;

  background:#07160a;
}

.dataLabel{
  color:#8596a8;

  font-size:7px;

  line-height:1.05;

  font-weight:850;
}

.dataValue{
  margin-top:4px;

  white-space:nowrap;

  font-size:18px;

  line-height:1;

  font-weight:950;
}

.dataSub{
  margin-top:3px;

  color:#7a8b9d;

  white-space:nowrap;

  font-size:7px;
}

.dataTime{
  margin-top:3px;

  color:#5d7184;

  font-size:6px;
}

.blue{
  color:var(--blue);
}

.green{
  color:var(--green);
}

.dir.up{
  color:var(--green);
}

.dir.down{
  color:var(--orange);
}

.dir.flat{
  color:#a0acb8;
}


/* ============================================================
   SEMATIKUS RAJZ
============================================================ */

.systemScene{
  position:relative;

  width:100%;

  height:290px;

  overflow:hidden;

  background:
    linear-gradient(
      180deg,
      #11283d 0%,
      #0f2639 54%,
      #3e332a 54%,
      #2e261f 100%
    );
}


/* FŐÁG */

.riverLeft{
  position:absolute;

  left:0;
  top:152px;

  width:29%;

  height:80px;

  background:
    linear-gradient(
      180deg,
      #268fd0,
      #126497
    );

  border-top:3px solid #67c6ff;
}


/* EMELKEDŐ FELVÍZ */

.waterRise{
  position:absolute;

  left:28.5%;
  top:132px;

  width:18%;

  height:100px;

  background:
    linear-gradient(
      180deg,
      #2c96d6,
      #166aa0
    );

  clip-path:
    polygon(
      0 20%,
      100% 0,
      100% 100%,
      0 100%
    );
}

.riseSurface{
  position:absolute;

  z-index:6;

  left:28.5%;
  top:151px;

  width:18.5%;

  height:4px;

  background:#66c7ff;

  transform:
    rotate(-6deg);

  transform-origin:
    left center;

  box-shadow:
    0 0 8px
    rgba(
      73,
      169,
      255,
      .75
    );
}


/* FELVÍZI SZAKASZ */

.riverRight{
  position:absolute;

  left:46%;
  right:0;

  top:132px;

  height:100px;

  background:
    linear-gradient(
      180deg,
      #2c96d6,
      #166aa0
    );

  border-top:3px solid #66c7ff;
}


/* MEDER */

.riverBed{
  position:absolute;

  left:0;
  right:0;

  top:232px;
  bottom:0;

  background:
    linear-gradient(
      #48382c,
      #2d241e
    );

  border-top:2px solid #5a493b;
}


/* DUZZASZTÁSI BADGE */

.upliftBadge{
  position:absolute;

  z-index:20;

  left:33%;
  top:28px;

  width:180px;

  padding:10px;

  border:1px solid #347941;

  border-radius:8px;

  background:
    rgba(
      4,
      23,
      9,
      .94
    );

  text-align:center;
}

.upliftBadgeLabel{
  color:#93a39a;

  font-size:8px;

  font-weight:850;
}

.upliftBadgeValue{
  margin-top:3px;

  color:var(--green);

  font-size:27px;

  line-height:1;

  font-weight:950;
}


/* FENÉKKÜSZÖB */

.threshold{
  position:absolute;

  z-index:8;

  left:42%;
  top:173px;

  width:15%;

  height:70px;

  border-radius:
    50% 50% 7px 7px;

  background:
    radial-gradient(
      circle at 10% 70%,
      #777b7d 0 13px,
      transparent 14px
    ),
    radial-gradient(
      circle at 27% 35%,
      #96999b 0 14px,
      transparent 15px
    ),
    radial-gradient(
      circle at 44% 70%,
      #5d6163 0 14px,
      transparent 15px
    ),
    radial-gradient(
      circle at 62% 35%,
      #888c8f 0 14px,
      transparent 15px
    ),
    radial-gradient(
      circle at 80% 70%,
      #6a6e70 0 13px,
      transparent 14px
    ),
    #45494b;
}

.thresholdText{
  position:absolute;

  z-index:10;

  left:40%;
  top:248px;

  width:19%;

  text-align:center;

  color:#aeb8c0;

  font-size:9px;

  font-weight:900;
}


/* RÁCS */

.rack{
  position:absolute;

  z-index:12;

  left:64%;

  top:152px;

  width:28px;
  height:95px;

  border:3px solid #95a1ac;

  background:
    repeating-linear-gradient(
      90deg,
      #253947 0 4px,
      #8e9ba6 4px 7px
    );
}

.rackText{
  position:absolute;

  z-index:12;

  left:59%;
  top:250px;

  width:22%;

  text-align:center;

  color:#85cfff;

  font-size:8px;

  font-weight:900;
}


/* SZIVATTYÚK */

.pump{
  position:absolute;

  z-index:13;

  top:133px;

  width:25px;
  height:115px;

  border-left:9px solid #929da6;

  border-radius:5px;
}

.pump:before{
  content:"";

  position:absolute;

  left:-15px;
  top:-8px;

  width:27px;
  height:20px;

  border-radius:6px;

  background:#919ba4;
}

.pump:after{
  content:"";

  position:absolute;

  left:-16px;
  bottom:-8px;

  width:29px;
  height:29px;

  border:3px solid #323b42;

  border-radius:50%;

  background:#68747d;
}

.pump1{
  left:73%;
}

.pump2{
  left:79%;
}


/* ERŐMŰ */

.plant{
  position:absolute;

  z-index:12;

  right:3%;

  top:110px;

  width:145px;
  height:140px;

  border:1px solid #88949d;

  border-radius:
    10px 10px 4px 4px;

  background:
    linear-gradient(
      145deg,
      #68747e,
      #353d43
    );
}

.plant:before{
  content:"";

  position:absolute;

  left:29px;
  top:-47px;

  width:85px;
  height:50px;

  border:1px solid #8e999f;

  border-radius:
    50% 50% 0 0;

  background:#5d6870;
}

.plantName{
  position:absolute;

  left:5px;
  right:5px;

  top:42px;

  text-align:center;

  color:#f2f4f7;

  font-size:13px;

  line-height:1.05;

  font-weight:900;
}

.plantMw{
  position:absolute;

  left:4px;
  right:4px;

  bottom:25px;

  text-align:center;

  color:var(--green);

  font-size:24px;

  font-weight:950;
}


/* ÁRAMLÁSI NYILAK */

.flowArrow{
  position:absolute;

  z-index:14;

  color:#6bc4fb;

  font-size:29px;

  font-weight:950;

  opacity:.9;
}

.fa1{
  left:18%;
  top:180px;
}

.fa2{
  left:59%;
  top:175px;
}

.fa3{
  left:69%;
  top:181px;
}


/* MAGYARÁZAT */

.sceneNote{
  position:absolute;

  left:10px;
  bottom:8px;

  z-index:25;

  padding:4px 7px;

  border-radius:5px;

  background:
    rgba(
      2,
      8,
      17,
      .78
    );

  color:#8999a9;

  font-size:7px;
}


/* ============================================================
   ALSÓ 5 ADATKÁRTYA
============================================================ */

.summaryRail{
  display:grid;

  grid-template-columns:
    repeat(5,1fr);

  gap:7px;

  margin-bottom:9px;
}

.summary{
  min-width:0;

  height:92px;

  padding:11px 7px;

  border:1px solid #18364e;

  border-radius:8px;

  background:#06121d;

  text-align:center;
}

.summary.highlight{
  border-color:#3c7438;

  background:#08160b;
}

.summaryLabel{
  min-height:17px;

  display:flex;

  justify-content:center;

  align-items:center;

  color:#8494a5;

  font-size:9px;

  line-height:1.05;

  font-weight:800;
}

.summaryValue{
  margin-top:6px;

  white-space:nowrap;

  font-size:22px;

  font-weight:950;
}

.summarySub{
  margin-top:5px;

  color:#647486;

  font-size:8px;
}


/* ============================================================
   ALSÓ SOR
============================================================ */

.bottomBar{
  height:39px;

  display:grid;

  grid-template-columns:
    1fr
    400px
    180px;

  gap:8px;

  align-items:center;

  margin-bottom:8px;
}

.bottomInfo{
  color:#65798c;

  font-size:8px;
}

.bottomShare{
  height:36px;

  display:grid;

  grid-template-columns:
    1fr 70px;

  gap:5px;

  padding:4px;

  border:1px solid #17334a;

  border-radius:8px;

  background:#07111b;
}

.version{
  text-align:right;

  color:#405266;

  font-size:8px;

  letter-spacing:1px;
}


/* ============================================================
   TOAST
============================================================ */

.toast{
  position:fixed;

  left:50%;
  bottom:20px;

  z-index:9999;

  transform:
    translateX(-50%)
    translateY(10px);

  opacity:0;

  padding:8px 14px;

  border:1px solid #337b40;

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


/*
  NINCS MOBIL ÁTTÖRDELÉS.

  Ez szándékos.

  A teljes 1500 px széles műszerfal
  mindig ugyanabban az elrendezésben marad.
*/

</style>

</head>


<body>


<div class="app">


<!-- =========================================================
     FEJLÉC
========================================================== -->


<div class="header">


  <div class="brand">

    <div class="logo">
      ⚛️
    </div>

    <div class="title">

      PAKS MONITOR

      <span class="versionBadge">
        V10
      </span>

    </div>

  </div>


  <div class="live">

    <span class="liveDot"></span>

    ÉLŐ ADATOK

  </div>


  <div class="headerRight">


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



<!-- =========================================================
     FELSŐ 3 PANEL
========================================================== -->


<div class="topGrid">


<!-- TELJESÍTMÉNY -->


<div class="panel">


<div class="pad">


<div class="sectionTitle">
  PAKSI ATOMERŐMŰ TELJESÍTMÉNYE
</div>


<div class="bigRow">


<div class="bigPower">
  ${totalText}
</div>


<div class="smallCaption">
  ÖSSZTELJESÍTMÉNY
</div>


</div>


<div class="chartPanel">


<div class="chartHead">


<div class="chartName">
  TELJESÍTMÉNY VÁLTOZÁSA • MW
</div>


<div class="buttons">


<button
  class="period active"
  data-chart="power"
  data-hours="6"
>
  6 ÓRA
</button>


<button
  class="period"
  data-chart="power"
  data-hours="24"
>
  24 ÓRA
</button>


<button
  class="period"
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


</div>


<div class="source">

OAH •

${shortTime(oahTime)} •

${oahStatus}

</div>


</div>



<!-- BLOKKOK -->


<div class="panel">


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


<div
  class="blockValue"
  style="${
    Number(value) > 0
      ? "color:#65df58"
      : ""
  }"
>

${
  value === "—"
    ? "—"
    : value + " MW"
}

</div>


<div
  style="
    position:absolute;
    left:14px;
    right:14px;
    bottom:45px;
    height:3px;
    background:#273847;
  "
>

<div
  style="
    height:100%;
    width:${
      Number.isFinite(
        Number(value)
      )
        ? Math.max(
            0,
            Math.min(
              100,
              Math.round(
                Number(value) /
                500 *
                100
              )
            )
          )
        : 0
    }%;
    background:${
      Number(value) > 0
        ? "#65df58"
        : "#344652"
    };
  "
></div>

</div>


<div
  style="
    position:absolute;
    left:14px;
    bottom:24px;
    color:#8998a8;
    font-size:9px;
  "
>

${
  Number.isFinite(
    Number(value)
  )
    ? Math.round(
        Number(value) /
        500 *
        100
      ) + "%"
    : "—"
}

</div>


</div>

`
).join("")}


</div>


<div class="source">

OAH •

${shortTime(oahTime)} •

${oahStatus}

</div>


</div>



<!-- DUNA / HŐ / HATÁR -->


<div class="panel">


<div class="pad">


<div class="sectionTitle">
  🌊 DUNA • PAKS FŐÁG
</div>


<div class="bigRow">


<div class="bigWater">

${waterText}

</div>


<div
  class="status ${riverClass}"
>

${riverLabel}

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
  KILÉPŐ VÍZHŐ
</div>

<div class="metricValue orange">
  —
</div>

</div>


</div>


<div class="infoRule">

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
  −134 CM
</span>

<span>
  −144 CM
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


<div class="source">

VÍZÜGY •

${shortTime(riverTime)}

</div>


</div>


</div>



<!-- =========================================================
     NAGY FOLYAMATÁBRA
========================================================== -->


<div class="systemPanel">


<div class="systemTitle">


<div class="systemTitleMain">

DUNA → FENÉKKÜSZÖB →
HIDEGVÍZ-CSATORNA →
SZIVATTYÚK → ERŐMŰ

</div>


<div class="systemTitleLive">

VÍZÜGY ÉLŐ MÉRÉSEK

</div>


</div>



<!-- FELSŐ ÉLŐ ADATSOR -->


<div class="dataRail">


<div class="dataBox">


<div class="dataLabel">
  DUNA • PAKS FŐÁG
</div>


<div class="dataValue blue">

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


<div class="dataSub">

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


<div class="dataTime">

${shortTime(riverTime)}

</div>


</div>



<div class="dataBox">


<div class="dataLabel">
  FENÉKKÜSZÖB • FELVÍZ
</div>


<div class="dataValue green">

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


<div class="dataSub">

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


<div class="dataTime">

${shortTime(
  thresholdUpTime
)}

</div>


</div>



<div class="dataBox upliftBox">


<div class="dataLabel">
  DUZZASZTÁS • FELVÍZ − ALVÍZ
</div>


<div class="dataValue green">

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


<div class="dataSub">
  MÉRT KÜLÖNBSÉG
</div>


<div class="dataTime">
  ÉLŐ
</div>


</div>



<div class="dataBox">


<div class="dataLabel">
  FENÉKKÜSZÖB • ALVÍZ
</div>


<div class="dataValue blue">

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


<div class="dataSub">

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


<div class="dataTime">

${shortTime(
  thresholdDownTime
)}

</div>


</div>



<div class="dataBox">


<div class="dataLabel">
  HIDEGVÍZ-CSATORNA • ÖBLÖZET
</div>


<div class="dataValue blue">

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


<div class="dataSub">

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


<div class="dataTime">

${shortTime(hvcsTime)}

</div>


</div>


</div>



<!-- RAJZ -->


<div class="systemScene">


<div class="riverLeft"></div>

<div class="waterRise"></div>

<div class="riseSurface"></div>

<div class="riverRight"></div>

<div class="riverBed"></div>



<div class="upliftBadge">


<div class="upliftBadgeLabel">
  DUZZASZTÁS EREDMÉNYE
</div>


<div class="upliftBadgeValue">

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



<div class="threshold"></div>


<div class="thresholdText">

KÖVES FENÉKKÜSZÖB

</div>



<div class="rack"></div>


<div class="rackText">

HIDEGVÍZ-CSATORNA

</div>



<div class="pump pump1"></div>

<div class="pump pump2"></div>



<div class="plant">


<div class="plantName">

PAKSI<br>
ATOMERŐMŰ

</div>


<div class="plantMw">

${totalText}

</div>


</div>



<div class="flowArrow fa1">
  →
</div>


<div class="flowArrow fa2">
  →
</div>


<div class="flowArrow fa3">
  →
</div>



<div class="sceneNote">

SEMATIKUS ÁBRA •

A VÍZFELSZÍN RAJZA NEM SZINTEZETT HOSSZ-SZELVÉNY •

A MÉRÉSI SZÁMOK IRÁNYADÓK

</div>


</div>


</div>



<!-- =========================================================
     ALSÓ ÉLŐ ADATKÁRTYÁK
========================================================== -->


<div class="summaryRail">


<div class="summary">


<div class="summaryLabel">
  DUNA PAKS
</div>


<div class="summaryValue blue">

${
  Number.isFinite(
    water
  )
    ? water +
      " cm"
    : "—"
}

</div>


<div class="summarySub">

${shortTime(riverTime)}

</div>


</div>



<div class="summary">


<div class="summaryLabel">
  FELVÍZ
</div>


<div class="summaryValue green">

${
  Number.isFinite(
    thresholdUp
  )
    ? thresholdUp +
      " cm"
    : "—"
}

</div>


<div class="summarySub">

${shortTime(
  thresholdUpTime
)}

</div>


</div>



<div class="summary">


<div class="summaryLabel">
  ALVÍZ
</div>


<div class="summaryValue blue">

${
  Number.isFinite(
    thresholdDown
  )
    ? thresholdDown +
      " cm"
    : "—"
}

</div>


<div class="summarySub">

${shortTime(
  thresholdDownTime
)}

</div>


</div>



<div class="summary highlight">


<div class="summaryLabel">
  DUZZASZTÁS
</div>


<div class="summaryValue green">

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


<div class="summarySub">
  FELVÍZ − ALVÍZ
</div>


</div>



<div class="summary">


<div class="summaryLabel">
  HIDEGVÍZ-CSATORNA
</div>


<div class="summaryValue blue">

${
  Number.isFinite(
    hvcs
  )
    ? hvcs +
      " cm"
    : "—"
}

</div>


<div class="summarySub">

${
  Number.isFinite(
    hvcsMbf
  )
    ? fmt2(
        hvcsMbf
      ) +
      " mBf • "
    : ""
}

${shortTime(hvcsTime)}

</div>


</div>


</div>



<!-- =========================================================
     ALSÓ SOR
========================================================== -->


<div class="bottomBar">


<div class="bottomInfo">

ADATFORRÁSOK:
OAH • VÍZÜGY

&nbsp;&nbsp;|&nbsp;&nbsp;

KILÉPŐ VÍZHŐ:
NINCS FRISS HITELES ADAT

</div>


<div class="bottomShare">


<a
  class="shareLink"
  href="${PUBLIC_URL}"
>

🔗 ${PUBLIC_URL}

</a>


<button
  class="copy"
  id="copyButtonBottom"
>
  MÁSOLÁS
</button>


</div>


<div class="version">

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


const PUBLIC_URL =
  "${PUBLIC_URL}";


let selectedRange = {

  power:
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
// TELJESÍTMÉNY GRAFIKON
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
      42,

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
      Math.max(
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
      5
    );
  }


  ctx.strokeStyle =
    "#66df57";


  ctx.fillStyle =
    "#66df57";


  ctx.lineWidth =
    2.2;


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
    3.5,
    0,
    Math.PI *
    2
  );


  ctx.fill();
}


// ============================================================
// IDŐTARTOMÁNY
// ============================================================

function setRange(
  hours,
  button
) {

  selectedRange.power =
    hours;


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


  cache =
    {};


  drawChart(
    "powerChart",
    "power",
    hours,
    "MW"
  );
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

          setRange(
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

async function copyLink() {

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


document
  .getElementById(
    "copyButton"
  )
  ?.addEventListener(
    "click",
    copyLink
  );


document
  .getElementById(
    "copyButtonBottom"
  )
  ?.addEventListener(
    "click",
    copyLink
  );


// ============================================================
// START
// ============================================================

drawChart(
  "powerChart",
  "power",
  6,
  "MW"
);


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
          () => {

            cache =
              {};


            drawChart(
              "powerChart",
              "power",
              selectedRange.power,
              "MW"
            );

          },
          150
        );
  }
);


</script>


</body>

</html>`;
