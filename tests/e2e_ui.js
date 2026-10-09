// Item 5: E2E UI flow — check -> info -> download -> progress -> save,
// with the API routes mocked so the flow is deterministic (no network).
// usage: node tests/e2e_ui.js <page.html>
const { chromium } = require("playwright");

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  pg.on("pageerror", (e) => errs.push(String(e)));

  const INFO = {
    is_playlist: false,
    title: "Neon Drive — Midnight City [Official Video]",
    duration: 222,
    thumbnail: "",
    uploader: "Chasing Static",
    qualities: [1080, 720, 360],
  };
  await pg.route("**/api/info*", (r) => r.fulfill({ json: INFO }));
  await pg.route("**/api/download*", (r) => r.fulfill({ json: { job_id: "mock1" } }));
  let step = 0;
  await pg.route("**/api/progress/*", (r) => {
    step += 1;
    const seq = [
      { status: "running", percent: 30, status_text: "Downloading 30%", error: null },
      { status: "done", percent: 100, status_text: "Finished", error: null,
        download_url: "/download/mock1" },
    ];
    r.fulfill({ json: seq[Math.min(step - 1, seq.length - 1)] });
  });

  // page must be served over http — fetch() refuses the file:// scheme
  await pg.goto(process.argv[2]);

  // 1. invalid URL: client gate shows the error, no fetch to /api/info
  let fetched = false;
  pg.on("request", (req) => { if (req.url().includes("/api/info")) fetched = true; });
  await pg.fill("#url", "https://vimeo.com/12345");
  await pg.click("#checkBtn");
  await pg.waitForTimeout(300);
  const errText = await pg.textContent("#urlErr");
  const clientGateOk = errText.includes("Not a YouTube") && !fetched;

  // 2. valid URL: full flow
  await pg.fill("#url", "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  await pg.click("#checkBtn");
  await pg.waitForSelector("#infoBody:not(.hidden)", { timeout: 5000 });
  const title = await pg.textContent("#vTitle");
  const indexNow = await pg.textContent(".index p.now");

  await pg.click("#dlBtn");
  await pg.waitForSelector("#progDone:not(.hidden)", { timeout: 10000 });
  const href = await pg.getAttribute("#saveBtn", "href");
  const pct = await pg.textContent("#progPct");
  const chip = await pg.textContent("#progChip");

  // 3. language toggle: TH swaps copy, html lang, and the dynamic strings;
  //    a second click returns to EN
  await pg.click("#langBtn");
  const thLang = await pg.evaluate(() => document.documentElement.lang);
  const thBtn = (await pg.textContent("#checkBtn")).trim();
  const thRow = (await pg.textContent(".index p.now")).trim();
  const thSave = (await pg.textContent("#saveBtn")).trim();
  const thChip = (await pg.textContent("#progChip")).trim();
  await pg.click("#langBtn");
  const enBack = (await pg.textContent("#checkBtn")).trim();

  const langOk = thLang === "th" && thBtn.includes("ตรวจสอบ") &&
    thRow.includes("โอนไฟล์") && thSave.includes("บันทึก") &&
    thChip.includes("เสร็จแล้ว") && enBack === "Check";

  console.log("E2E:", {
    clientGateOk, title, indexNow,
    href, pct, chip: chip.trim(),
    langOk, thLang, thBtn, thRow, thSave, thChip, enBack,
    pageErrors: errs.length,
  });
  await b.close();
})();
