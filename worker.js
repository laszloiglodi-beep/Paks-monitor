export default {
  async fetch() {

    const url =
      "https://tranem.haea.gov.hu/web/v3/OAHPortal.nsf/web?OpenAgent=&article=paksnpp";

    let blocks = ["—","—","—","—"];
    let measured = "—";
    let status = "OK";

    try {
      const r = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 PaksMonitor"
        }
      });

      const html = await r.text();

      const text = html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/gi, " ")
        .replace(/\s+/g, " ");

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
        status = "Az OAH adatsor nem található";
      }

    } catch (e) {
      status = "OAH kapcsolat sikertelen";
    }

    const total = blocks.every(x => x !== "—")
      ? blocks.reduce((a,b) => a + Number(b), 0)
      : "—";

    return new Response(`
      <html>
      <head>
        <meta name="viewport" content="width=device-width">
        <meta http-equiv="refresh" content="300">
        <style>
          body{
            background:#07101d;
            color:white;
            font-family:-apple-system,sans-serif;
            padding:25px
          }
          h1{font-size:34px}
          .total{font-size:50px;color:#77df68;font-weight:800}
          .box{
            background:#101d2d;
            padding:18px;
            border-radius:16px;
            margin:12px 0
          }
          b{font-size:28px}
          small{color:#9cafc7}
        </style>
      </head>
      <body>

        <h1>⚛️ PAKS MONITOR</h1>

        <div class="total">${total} MW</div>

        <div class="box">1. blokk<br><b>${blocks[0]} MW</b></div>
        <div class="box">2. blokk<br><b>${blocks[1]} MW</b></div>
        <div class="box">3. blokk<br><b>${blocks[2]} MW</b></div>
        <div class="box">4. blokk<br><b>${blocks[3]} MW</b></div>

        <small>
          Forrás: OAH<br>
          Mérés: ${measured}<br>
          ${status}
        </small>

      </body>
      </html>
    `,{
      headers:{
        "content-type":"text/html;charset=UTF-8",
        "cache-control":"no-store"
      }
    });
  }
};
