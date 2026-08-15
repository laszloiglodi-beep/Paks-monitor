export default {
  async fetch() {
    const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="refresh" content="300">
<title>PAKS Monitor</title>
<style>
body{margin:0;background:#07101d;color:white;font-family:-apple-system,sans-serif}
main{max-width:600px;margin:auto;padding:20px}
h1{font-size:30px}
.card{background:#101d2d;border:1px solid #29405a;border-radius:20px;padding:18px;margin-bottom:16px}
.label{color:#9cafc7;font-size:13px}
.big{font-size:48px;font-weight:800;color:#72df68}
.river{font-size:48px;font-weight:800;color:#55adff}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:15px}
.box{background:#091524;border-radius:14px;padding:15px}
.box strong{font-size:25px}
.small{color:#8fa3bb;font-size:12px;margin-top:14px}
</style>
</head>
<body>
<main>
<h1>⚛️ PAKS MONITOR</h1>

<div class="card">
<div class="label">PAKSI ATOMERŐMŰ TELJESÍTMÉNYE</div>
<div class="big">ÉLŐ ADAT</div>
<div class="grid">
<div class="box">1. blokk<br><strong>— MW</strong></div>
<div class="box">2. blokk<br><strong>— MW</strong></div>
<div class="box">3. blokk<br><strong>— MW</strong></div>
<div class="box">4. blokk<br><strong>— MW</strong></div>
</div>
<div class="small">Forrás: OAH</div>
</div>

<div class="card">
<div class="label">🌊 DUNA VÍZÁLLÁSA PAKSNÁL</div>
<div class="river">ÉLŐ ADAT</div>
<div class="small">Leállási küszöb: −134 cm<br>Biztonsági határ: −144 cm</div>
</div>

</main>
</body>
</html>`;

    return new Response(html,{
      headers:{"content-type":"text/html;charset=UTF-8"}
    });
  }
};
