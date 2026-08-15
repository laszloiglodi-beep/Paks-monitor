export default {
  async fetch() {

    const OAH_URL =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    const VIZ_URL =
      "https://www.vizugy.hu/?AllomasVOA=16496188-97AB-11D4-BB62-00508BA24287&mapData=OrasIdosor&mapModule=OpGrafikon";

    let blocks = ["—","—","—","—"];
    let measured = "—";
    let oahStatus = "OK";

    let water = "—";
    let flow = "—";
    let temp = "—";
    let riverTime = "—";
    let riverStatus = "OK";

    function clean(html) {
      return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/&#160;/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    try {
      const r = await fetch(OAH_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
      });

      const text = clean(await r.text());

      const date = text.match(
        /Mérés dátuma:\s*([0-9]{4}\.\s*[0-9]{2}\.\s*[0-9]{2}\s*[0-9]{2}:[0-9]{2})/i
      );

      if (date) measured = date[1];

      const power = text.match(
        /1\.\s*blokk\s*2\.\s*blokk\s*3\.\s*blokk\s*4\.\s*blokk\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW\s*(\d+)\s*MW/i
      );

      if (power) {
        blocks = [power[1], power[2], power[3], power[4]];
      } else {
        oahStatus = "Az OAH adatsor nem található";
      }

    } catch (e) {
      oahStatus = "OAH kapcsolat sikertelen";
    }

    try {
      const r = await fetch(VIZ_URL, {
        headers: { "User-Agent": "Mozilla/5.0 PaksMonitor" }
      });

      const text = clean(await r.text());

      const row = text.match(
        /(20\d{2}\.\d{2}\.\d{2}\.\s*\d{2}:\d{2})\s+(-?\d+)\s+(\d+[.,]\d+|-)\s+(\d+[.,]?\d*|-)\s+(\d+[.,]?\d*|-)/
      );

      if (row) {
        riverTime = row[1];
        water = row[2];

        if (row[3] !== "-")
          flow = row[3].replace(".", ",");

        // A Vízügy táblában a felszíni vízhő sokszor "-" ,
        // ezért ha az üres, a fenék közeli értéket mutatjuk.
        if (row[4] !== "-")
          temp = row[4].replace(".", ",");
        else if (row[5] !== "-")
          temp = row[5].replace(".", ",");

      } else {
        riverStatus = "A paksi vízügyi adatsor nem található";
      }

    } catch (e) {
      riverStatus = "Vízügyi kapcsolat sikertelen";
    }

    const total = blocks.every(x => x !== "—")
      ? blocks.reduce((a,b) => a + Number(b), 0)
      : "—";

    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="300">
<meta name="theme-color" content="#07101d">
<title>PAKS Monitor</title>

<style>
body{
  margin:0;
  background:#07101d;
  color:white;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif
}
main{max-width:600px;margin:auto;padding:20px}
h1{font-size:30px;margin:10px 0 20px}
.card{
  background:#101d2d;
  border:1px solid #29405a;
  border-radius:20px;
  padding:18px;
  margin-bottom:16px
}
.label{color:#9cafc7;font-size:13px}
.total{
  font-size:48px;
  font-weight:800;
  color:#72df68;
  margin:5px 0 16px
}
.grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px
}
.box{
  background:#091524;
  border-radius:14px;
  padding:15px
}
.box strong{font-size:27px}
.river{
  font-size:48px;
  font-weight:800;
  color:#55adff;
  margin:5px 0 15px
}
.two{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:10px
}
.metric{
  background:#091524;
  padding:14px;
  border-radius:14px
}
.metric b{font-size:21px}
.scale{
  height:18px;
  margin:24px 0 8px;
  border-radius:10px;
  background:linear-gradient(
    90deg,
    #52c75a 0%,
    #52c75a 45%,
    #ffae32 45%,
    #ffae32 70%,
    #ef5350 70%
  )
}
.threshold{
  display:flex;
  justify-content:space-between;
  font-size:13px
}
.orange{color:#ffae32}
.red{color:#ff6961}
.info{
  color:#8fa3bb;
  font-size:12px;
  line-height:1.5;
  margin-top:14px
}
</style>
</head>

<body>
<main>

<h1>⚛️ PAKS MONITOR</h1>

<div class="card">
  <div class="label">PAKSI ATOMERŐMŰ ÖSSZTELJESÍTMÉNYE</div>
  <div class="total">${total} MW</div>

  <div class="grid">
    ${blocks.map((v,i)=>`
      <div class="box">
        <div class="label">${i+1}. BLOKK</div>
        <strong>${v} MW</strong>
      </div>
    `).join("")}
  </div>

  <div class="info">
    Forrás: OAH<br>
    Mérés: ${measured}<br>
    ${oahStatus}
  </div>
</div>

<div class="card">
  <div class="label">🌊 DUNA – PAKS</div>
  <div class="river">${water} cm</div>

  <div class="two">
    <div class="metric">
      <div class="label">VÍZHOZAM</div>
      <b>${flow} m³/s</b>
    </div>

    <div class="metric">
      <div class="label">VÍZHŐMÉRSÉKLET</div>
      <b>${temp} °C</b>
    </div>
  </div>

  <div class="scale"></div>

  <div class="threshold">
    <span>normál</span>
    <span class="orange">−134 cm</span>
    <span class="red">−144 cm</span>
  </div>

  <div class="info">
    Forrás: Vízügy<br>
    Mérés: ${riverTime}<br>
    ${riverStatus}
  </div>
</div>

<div class="info" style="text-align:center">
Automatikus frissítés: 5 percenként
</div>

</main>
</body>
</html>`;

    return new Response(html,{
      headers:{
        "content-type":"text/html;charset=UTF-8",
        "cache-control":"no-store"
      }
    });
  }
};
