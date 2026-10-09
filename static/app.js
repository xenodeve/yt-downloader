// YT Downloader — frontend logic
const $ = (id) => document.getElementById(id);

const els = {
  url: $("url"),
  checkBtn: $("checkBtn"),
  urlErr: $("urlErr"),
  infoCard: $("infoCard"),
  infoLoading: $("infoLoading"),
  infoBody: $("infoBody"),
  thumb: $("thumb"),
  vTitle: $("vTitle"),
  vUp: $("vUp"),
  vDur: $("vDur"),
  playlistList: $("playlistList"),
  metaCount: $("metaCount"),
  metaType: $("metaType"),
  metaStage: $("metaStage"),
  optCard: $("optCard"),
  typeSeg: $("typeSeg"),
  qualityField: $("qualityField"),
  bitrateField: $("bitrateField"),
  quality: $("quality"),
  bitrate: $("bitrate"),
  dlBtn: $("dlBtn"),
  progCard: $("progCard"),
  progText: $("progText"),
  progPct: $("progPct"),
  barWrap: $("barWrap"),
  barFill: $("barFill"),
  progChip: $("progChip"),
  chipText: $("chipText"),
  progDone: $("progDone"),
  saveBtn: $("saveBtn"),
  errMsg: $("errMsg"),
  langBtn: $("langBtn"),
};

const indexRows = [...document.querySelectorAll(".index p[data-row]")];
const ORB_HTML = '<span class="orb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
let currentType = "video";
let pollTimer = null;

// EN/TH toggle — langBtn's label is the language you switch TO
const I18N = {
  en: {
    skip: "Skip to content",
    kicker: "Local · Self-hosted",
    row1: "01 · Source URL", row2: "02 · Parsed",
    row3: "03 · Format", row4: "04 · Transfer",
    metaHint: "paste ⏎", check: "Check",
    qualityLabel: "Quality", bitrateLabel: "Bitrate",
    segVideo: "Video · MP4", segAudio: "Audio · MP3",
    dl: "↓ Download", progText: "Downloading…",
    save: "◈ Save file",
    foot: "For internal use · Please respect content creators’ rights",
    langBtn: "ไทย",
  },
  th: {
    skip: "ข้ามไปเนื้อหา",
    kicker: "local · ทำงานในเครื่อง",
    row1: "01 · แหล่งข้อมูล", row2: "02 · วิเคราะห์แล้ว",
    row3: "03 · รูปแบบ", row4: "04 · โอนไฟล์",
    metaHint: "วาง ⏎", check: "ตรวจสอบ",
    qualityLabel: "ความละเอียด", bitrateLabel: "บิตเรต",
    segVideo: "วิดีโอ · MP4", segAudio: "เสียง · MP3",
    dl: "↓ ดาวน์โหลด", progText: "กำลังดาวน์โหลด…",
    save: "◈ บันทึกไฟล์",
    foot: "ใช้ภายใน · กรุณาเคารพสิทธิ์ของผู้สร้างสรรค์เนื้อหา",
    langBtn: "EN",
  },
};
let lang = "en";
let lastInfo = null, lastChip = null, lastUrlErr = null, lastMsg = null;
let stageHalt = false, qualBest = false, progState = null;
function T(en, th) { return lang === "th" ? th : en; }

function setIndex(n) {
  indexRows.forEach((p) => p.classList.toggle("now", p.dataset.row === String(n)));
}

function shake(btn) {
  btn.classList.remove("shake");
  void btn.offsetWidth; // restart the animation if already present
  btn.classList.add("shake");
  setTimeout(() => btn.classList.remove("shake"), 500);
}

function fmtDuration(s) {
  if (!s && s !== 0) return "";
  s = Math.round(s);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

function show(el, on) { el.classList.toggle("hidden", !on); }

const SUPPORTED_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?|watch\/|shorts\/|live\/|clip\/)|youtu\.be\/|facebook\.com\/(watch|reel|reels|profile_video|[^/?#]+\/videos\/|video\.php)|fb\.watch\/|fb\.com\/|instagram\.com\/(p|reel|tv)\/|instagr\.am\/|tiktok\.com\/|vm\.tiktok\.com\/|m\.tiktok\.com\/)/i;
function isSupported(url) { return SUPPORTED_RE.test(url); }

function setUrlError(pair) { // [en, th] or null
  lastUrlErr = pair;
  els.urlErr.textContent = pair ? T(pair[0], pair[1]) : "";
  show(els.urlErr, !!pair);
}

async function checkInfo() {
  const url = els.url.value.trim();
  if (!url) { shake(els.checkBtn); return; }
  if (!isSupported(url)) { setUrlError(["Not a supported link — YouTube, Facebook, TikTok, Instagram", "ไม่ใช่ลิงก์ที่รองรับ — YouTube, Facebook, TikTok, Instagram"]); shake(els.checkBtn); return; }

  setUrlError(null);
  els.checkBtn.disabled = true;
  els.checkBtn.innerHTML = ORB_HTML; // thinking orb while parsing
  hideProgress();

  // show card + skeleton while fetching
  show(els.infoCard, true);
  show(els.infoLoading, true);
  show(els.infoBody, false);
  show(els.playlistList, false);
  show(els.optCard, false);

  try {
    const res = await fetch("/api/info?url=" + encodeURIComponent(url));
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not load video info");

    show(els.infoLoading, false);
    renderInfo(data);
    setIndex(2);
  } catch (e) {
    show(els.infoCard, false);
    setUrlError([e.message, e.message]);
  } finally {
    els.checkBtn.disabled = false;
    els.checkBtn.textContent = T("Check", "ตรวจสอบ");
  }
}

function renderInfo(data) {
  show(els.infoLoading, false);
  show(els.infoBody, true);
  show(els.optCard, true);
  els.errMsg.textContent = "";
  show(els.errMsg, false);

  lastInfo = data;
  if (data.is_playlist) {
    show(els.thumb, false);
    els.vTitle.textContent = data.title || "Playlist";
    els.vDur.textContent = "";
    infoCopy(data);
    els.playlistList.innerHTML = "";
    (data.entries || []).forEach((e) => {
      const li = document.createElement("li");
      const t = document.createElement("span");
      t.className = "pl-title";
      t.textContent = e.title || "(no title)";
      const d = document.createElement("span");
      d.className = "pl-dur";
      d.textContent = fmtDuration(e.duration);
      li.append(t, d);
      els.playlistList.appendChild(li);
    });
    show(els.playlistList, true);
    // playlist: no per-clip quality selection
    show(els.qualityField, false);
    show(els.bitrateField, currentType === "mp3");
  } else {
    show(els.playlistList, false);
    show(els.thumb, true);
    els.thumb.src = data.thumbnail || "";
    els.vTitle.textContent = data.title || "";
    els.vUp.textContent = data.uploader || "";
    els.vDur.textContent = fmtDuration(data.duration);
    infoCopy(data);

    // fill quality options
    els.quality.innerHTML = "";
    const quals = data.qualities || [];
    qualBest = quals.length === 0;
    if (quals.length) {
      quals.forEach((q) => {
        const o = document.createElement("option");
        o.value = q;
        o.textContent = q >= 1080 ? `${q}p (Full HD+)` : `${q}p`;
        els.quality.appendChild(o);
      });
    } else {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = T("Best quality", "คุณภาพดีที่สุด");
      els.quality.appendChild(o);
    }
    show(els.qualityField, currentType === "video");
    show(els.bitrateField, currentType === "mp3");
  }
}

function setType(type) {
  currentType = type;
  [...els.typeSeg.children].forEach((b) => {
    const on = b.dataset.type === type;
    b.classList.toggle("active", on);
    b.setAttribute("aria-selected", on ? "true" : "false");
  });
  els.metaType.textContent = type === "video" ? "MP4" : "MP3";
  show(els.qualityField, type === "video");
  show(els.bitrateField, type === "mp3");
}

function hideProgress() {
  lastChip = null; stageHalt = false; progState = null;
  show(els.progCard, false);
  show(els.progDone, false);
  show(els.progChip, false);
  els.barFill.style.width = "0%";
  els.progPct.textContent = "0%";
  els.barWrap.setAttribute("aria-valuenow", "0");
  els.metaStage.textContent = "—";
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function setChip(pair) {
  lastChip = pair;
  els.chipText.textContent = T(pair[0], pair[1]);
  show(els.progChip, true);
}

async function startDownload() {
  const url = els.url.value.trim();
  if (!url) { shake(els.dlBtn); return; }

  const payload = { url, type: currentType };
  if (currentType === "video") payload.quality = parseInt(els.quality.value, 10) || null;
  if (currentType === "mp3") payload.bitrate = parseInt(els.bitrate.value, 10) || 192;

  els.dlBtn.disabled = true;
  show(els.progCard, true);
  show(els.progDone, false);
  els.errMsg.textContent = "";
  show(els.errMsg, false);
  progState = "starting";
  els.progText.textContent = T("Starting…", "เริ่ม…");
  els.barFill.style.width = "0%";
  els.progPct.textContent = "0%";
  els.barWrap.setAttribute("aria-valuenow", "0");
  setChip(["yt-dlp · starting", "yt-dlp · เริ่ม"]);
  setIndex(4);

  try {
    const res = await fetch("/api/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not start download");
    pollProgress(data.job_id);
  } catch (e) {
    showError(e.message);
  } finally {
    els.dlBtn.disabled = false;
  }
}

function pollProgress(jobId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    try {
      const res = await fetch(`/api/progress/${jobId}`);
      const p = await res.json();
      if (!res.ok) throw new Error(p.error || "Job not found");

      const pct = Math.round(p.percent || 0);
      els.progText.textContent = p.status_text || "";
      els.progPct.textContent = `${pct}%`;
      els.barFill.style.width = `${pct}%`;
      els.barWrap.setAttribute("aria-valuenow", String(pct));
      els.metaStage.textContent = `${pct}%`;
      progState = null; // server text — language-neutral
      const status = p.status_text || "working";
      setChip([`yt-dlp · ${status}`, `yt-dlp · ${status}`]);

      if (p.status === "done") {
        clearInterval(pollTimer); pollTimer = null;
        progState = "finished";
        els.progText.textContent = T("Finished", "เสร็จแล้ว");
        els.barFill.style.width = "100%";
        els.progPct.textContent = "100%";
        els.barWrap.setAttribute("aria-valuenow", "100");
        els.metaStage.textContent = "100%";
        setChip(["complete · saved to downloads/", "เสร็จแล้ว · เก็บใน downloads/"]);
        els.saveBtn.href = p.download_url;
        show(els.progDone, true);
      } else if (p.status === "error") {
        clearInterval(pollTimer); pollTimer = null;
        showError([p.error || "Something went wrong", p.error || "มีบางอย่างผิดพลาด"]);
      }
    } catch (e) {
      clearInterval(pollTimer); pollTimer = null;
      showError([e.message, e.message]);
    }
  }, 1000);
}

function showError(pair) {
  progState = "error"; stageHalt = true; lastMsg = pair;
  els.progText.textContent = T("Error", "เกิดข้อผิดพลาด");
  els.metaStage.textContent = T("halt", "หยุด");
  setChip(["yt-dlp · halted", "yt-dlp · หยุด"]);
  els.errMsg.textContent = T(pair[0], pair[1]);
  show(els.errMsg, true);
}

// ---------- language ----------
// shared copy for the info card — renderInfo and applyLang both use it
function infoCopy(d) {
  if (d.is_playlist) {
    els.vUp.textContent = T(`${d.count} videos in playlist`, `${d.count} วิดีโอในเพลย์ลิสต์`);
    els.metaCount.textContent = T(`${d.count} results`, `${d.count} ผลลัพธ์`);
  } else {
    els.metaCount.textContent = T("1 result", "1 ผลลัพธ์");
  }
  if (qualBest && els.quality.options.length) {
    els.quality.options[0].textContent = T("Best quality", "คุณภาพดีที่สุด");
  }
}

function refreshDynamic() {
  if (lastInfo) infoCopy(lastInfo);
  if (progState === "starting") els.progText.textContent = T("Starting…", "เริ่ม…");
  if (progState === "finished") els.progText.textContent = T("Finished", "เสร็จแล้ว");
  if (progState === "error") els.progText.textContent = T("Error", "เกิดข้อผิดพลาด");
  if (stageHalt) els.metaStage.textContent = T("halt", "หยุด");
  if (lastUrlErr) els.urlErr.textContent = T(lastUrlErr[0], lastUrlErr[1]);
  if (lastMsg) els.errMsg.textContent = T(lastMsg[0], lastMsg[1]);
  if (lastChip) setChip(lastChip);
}

function applyLang() {
  document.documentElement.lang = lang;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = I18N[lang][el.dataset.i18n];
  });
  refreshDynamic();
}

// ---------- bind ----------
els.checkBtn.addEventListener("click", checkInfo);
els.url.addEventListener("keydown", (e) => { if (e.key === "Enter") checkInfo(); });
els.typeSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) setType(btn.dataset.type);
});
els.dlBtn.addEventListener("click", startDownload);
els.langBtn.addEventListener("click", () => {
  lang = lang === "en" ? "th" : "en";
  applyLang();
});
