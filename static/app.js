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
};

const indexRows = [...document.querySelectorAll(".index p[data-row]")];
const CHECK_LABEL = els.checkBtn.textContent; // preserve original label
const ORB_HTML = '<span class="orb" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></span>';
let currentType = "video";
let pollTimer = null;

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

const YOUTUBE_RE = /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?|watch\/|shorts\/|live\/|clip\/)|youtu\.be\/)/i;
function isYoutube(url) { return YOUTUBE_RE.test(url); }

function setUrlError(msg) {
  els.urlErr.textContent = msg || "";
  show(els.urlErr, !!msg);
}

async function checkInfo() {
  const url = els.url.value.trim();
  if (!url) { shake(els.checkBtn); return; }
  if (!isYoutube(url)) { setUrlError("Not a YouTube link"); shake(els.checkBtn); return; }

  setUrlError("");
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
    setUrlError(e.message);
  } finally {
    els.checkBtn.disabled = false;
    els.checkBtn.textContent = CHECK_LABEL;
  }
}

function renderInfo(data) {
  show(els.infoLoading, false);
  show(els.infoBody, true);
  show(els.optCard, true);
  els.errMsg.textContent = "";
  show(els.errMsg, false);

  if (data.is_playlist) {
    show(els.thumb, false);
    els.vTitle.textContent = data.title || "Playlist";
    els.vUp.textContent = `${data.count} videos in playlist`;
    els.vDur.textContent = "";
    els.metaCount.textContent = `${data.count} results`;
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
    els.metaCount.textContent = "1 result";

    // fill quality options
    els.quality.innerHTML = "";
    const quals = data.qualities || [];
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
      o.textContent = "Best quality";
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
  show(els.progCard, false);
  show(els.progDone, false);
  show(els.progChip, false);
  els.barFill.style.width = "0%";
  els.progPct.textContent = "0%";
  els.barWrap.setAttribute("aria-valuenow", "0");
  els.metaStage.textContent = "—";
  if (pollTimer) { clearInterval(pollTimer); pollTimer = null; }
}

function setChip(text) {
  els.chipText.textContent = text;
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
  els.progText.textContent = "Starting…";
  els.barFill.style.width = "0%";
  els.progPct.textContent = "0%";
  els.barWrap.setAttribute("aria-valuenow", "0");
  setChip("yt-dlp · starting");
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
      setChip(`yt-dlp · ${p.status_text || "working"}`);

      if (p.status === "done") {
        clearInterval(pollTimer); pollTimer = null;
        els.progText.textContent = "Finished";
        els.barFill.style.width = "100%";
        els.progPct.textContent = "100%";
        els.barWrap.setAttribute("aria-valuenow", "100");
        els.metaStage.textContent = "100%";
        setChip("complete · saved to downloads/");
        els.saveBtn.href = p.download_url;
        show(els.progDone, true);
      } else if (p.status === "error") {
        clearInterval(pollTimer); pollTimer = null;
        showError(p.error || "Something went wrong");
      }
    } catch (e) {
      clearInterval(pollTimer); pollTimer = null;
      showError(e.message);
    }
  }, 1000);
}

function showError(msg) {
  els.progText.textContent = "Error";
  els.metaStage.textContent = "halt";
  setChip("yt-dlp · halted");
  els.errMsg.textContent = msg;
  show(els.errMsg, true);
}

// ---------- bind ----------
els.checkBtn.addEventListener("click", checkInfo);
els.url.addEventListener("keydown", (e) => { if (e.key === "Enter") checkInfo(); });
els.typeSeg.addEventListener("click", (e) => {
  const btn = e.target.closest(".seg-btn");
  if (btn) setType(btn.dataset.type);
});
els.dlBtn.addEventListener("click", startDownload);
