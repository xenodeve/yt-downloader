// Live-server E2E: no mocks — real Flask server, real yt-dlp, real network.
// usage: node tests/e2e_live.js http://127.0.0.1:5000
const { chromium } = require("playwright");

(async () => {
  const base = process.argv[2];
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));
  await pg.goto(base);

  // 1. vimeo: the client gate blocks it before any fetch
  let fetched = false;
  pg.on("request", (req) => { if (req.url().includes("/api/info")) fetched = true; });
  await pg.fill("#url", "https://vimeo.com/12345");
  await pg.click("#checkBtn");
  await pg.waitForTimeout(300);
  const gate = (await pg.textContent("#urlErr")).includes("Not a supported") && !fetched;

  // 2. Facebook/TikTok/Instagram: the gate lets them through to the server;
  //    the server's real yt-dlp extraction result is recorded as-is
  const platforms = {};
  for (const u of [
    "https://www.facebook.com/watch?v=10101010101",
    "https://www.tiktok.com/@user/video/1234567890",
    "https://www.instagram.com/p/ABC123/",
  ]) {
    await pg.fill("#url", u);
    await pg.click("#checkBtn");
    await pg.waitForTimeout(4000);
    const err = (await pg.textContent("#urlErr")).trim();
    platforms[u.split("/")[2]] = err.includes("Not a supported")
      ? "blocked-by-gate" : (err ? "extraction-error: " + err.slice(0, 60) : "extracted");
  }

  // 3. full YouTube flow: real info, real download (mp3 128k), real progress
  await pg.fill("#url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await pg.click("#checkBtn");
  const gotInfo = await pg.waitForSelector("#infoBody:not(.hidden)", { timeout: 25000 })
    .then(() => true).catch(() => false);
  const title = gotInfo ? (await pg.textContent("#vTitle")).trim() : "";
  let flow = null;
  if (gotInfo) {
    await pg.click('[data-type="mp3"]');
    await pg.selectOption("#bitrate", "128");
    await pg.click("#dlBtn");
    const done = await pg.waitForSelector("#progDone:not(.hidden)", { timeout: 120000 })
      .then(() => true).catch(() => false);
    if (done) {
      const href = await pg.getAttribute("#saveBtn", "href");
      const resp = await pg.request.get(base + href);
      const body = await resp.body();
      flow = { href, saveStatus: resp.status(), saveBytes: body.length };
    } else {
      flow = { downloadFailed: true, progText: (await pg.textContent("#progText")).trim() };
    }
  }

  // 4. language toggle at the end (EN -> TH -> EN)
  await pg.click("#langBtn");
  const thLang = await pg.evaluate(() => document.documentElement.lang);
  const thSave = (await pg.textContent("#saveBtn")).trim();
  await pg.click("#langBtn");

  console.log("E2E-LIVE:", {
    gate, platforms, gotInfo, title, flow,
    thLang, thSave, pageErrors: errs.length,
  });
  await b.close();
})();
