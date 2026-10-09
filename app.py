"""
YT Downloader — local web app
Download video (MP4) and audio (MP3) from YouTube through a web page.

Run:  python app.py   →  open http://localhost:5000
"""

import os
import re
import shutil
import threading
import uuid
import zipfile
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_file
import yt_dlp

BASE_DIR = Path(__file__).resolve().parent
DOWNLOAD_DIR = BASE_DIR / "downloads"
DOWNLOAD_DIR.mkdir(exist_ok=True)

app = Flask(__name__)

# server-side gate: accepted platforms (the client checks too,
# but the server is authoritative) — all four have yt-dlp extractors
SUPPORTED_RE = re.compile(
    r"^https?://(?:www\.|m\.)?(?:"
    r"youtube\.com/(?:watch\?|watch/|shorts/|live/|clip/)|youtu\.be/"
    r"|facebook\.com/(?:watch|reel|reels|profile_video|[^/?#]+/videos/|video\.php)|fb\.watch/|fb\.com/"
    r"|instagram\.com/(?:p|reel|tv)/|instagr\.am/"
    r"|tiktok\.com/|vm\.tiktok\.com/|m\.tiktok\.com/"
    r")",
    re.IGNORECASE,
)


def is_supported_url(url):
    return bool(SUPPORTED_RE.match(url))

SUPPORT_MSG = "Not a supported link — YouTube, Facebook, TikTok, Instagram"

# a raw yt-dlp failure like "Sign in to confirm you're not a bot" is true
# but not useful — append the one action that fixes it (cookies.txt).
# Facebook's "Cannot parse data" and TikTok's page-wall are the same class:
# the site hides the data from anonymous requests, a logged-in session fixes it.
COOKIES_TRIGGER_RE = re.compile(
    r"sign in to confirm|login required|cannot parse data|unexpected response from webpage request",
    re.IGNORECASE,
)
COOKIES_HINT = " — export cookies.txt from your logged-in browser and place it next to app.py"


def friendly_error(msg):
    if COOKIES_TRIGGER_RE.search(msg):
        return msg + COOKIES_HINT
    return msg

# job_id -> {status, percent, status_text, file_path, error}
JOBS = {}
JOBS_LOCK = threading.Lock()
JOBS_MAX = 20


def prune_jobs():
    """dict order is insertion order — drop the oldest finished jobs beyond
    JOBS_MAX. Running jobs are never dropped: their worker thread and the
    progress hook write into JOBS[job_id], and a KeyError there kills the
    download mid-flight."""
    with JOBS_LOCK:
        victims = [jid for jid in JOBS if JOBS[jid]["status"] != "running"]
        for job_id in victims[:max(0, len(JOBS) - JOBS_MAX)]:
            del JOBS[job_id]


# --------------------------------------------------------------------------- #
# ffmpeg: use ffmpeg on PATH first; fall back to the bundled imageio-ffmpeg
# --------------------------------------------------------------------------- #
def get_ffmpeg_location():
    # 1. ffmpeg on PATH
    exe = shutil.which("ffmpeg")
    if exe:
        return os.path.dirname(exe)
    # 2. create bin/ffmpeg.exe from imageio-ffmpeg
    #    (yt-dlp looks for a file named "ffmpeg" in the ffmpeg_location dir,
    #     but imageio-ffmpeg ships it as ffmpeg-win-x86_64-v7.1.exe)
    try:
        import imageio_ffmpeg
        src = imageio_ffmpeg.get_ffmpeg_exe()
        bin_dir = BASE_DIR / "bin"
        bin_dir.mkdir(exist_ok=True)
        dst = bin_dir / "ffmpeg.exe"
        if not dst.exists():
            shutil.copy2(src, dst)
        return str(bin_dir)
    except Exception:
        return None


def base_ydl_opts():
    opts = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
    }
    ff = get_ffmpeg_location()
    if ff:
        opts["ffmpeg_location"] = ff
    # YouTube blocks anonymous requests from some IPs ("Sign in to confirm
    # you're not a bot"). Pass cookies: a cookies.txt exported from the
    # browser, placed next to app.py; or YTDLP_BROWSER=chrome/firefox/...
    # to read cookies straight from the browser's cookie store.
    cookie_file = BASE_DIR / "cookies.txt"
    if cookie_file.exists():
        opts["cookiefile"] = str(cookie_file)
    browser = os.environ.get("YTDLP_BROWSER")
    if browser:
        opts["cookiesfrombrowser"] = (browser,)
    return opts


def outtmpl_for(job_id):
    # %(title.80)s keeps the path under Windows MAX_PATH even for long titles
    return str(DOWNLOAD_DIR / f"{job_id}%(title.80)s [%(id)s].%(ext)s")


def make_progress_hook(job_id):
    def hook(d):
        if d.get("status") == "downloading":
            total = d.get("total_bytes") or d.get("total_bytes_estimate")
            done = d.get("downloaded_bytes", 0)
            if total:
                pct = done / total * 100
                with JOBS_LOCK:
                    JOBS[job_id]["percent"] = pct
                    JOBS[job_id]["status_text"] = f"Downloading {pct:.0f}%"
        elif d.get("status") == "finished":
            with JOBS_LOCK:
                JOBS[job_id]["status_text"] = "Processing…"
    return hook


def pick_final_file(files):
    """Pick the final output file (not an intermediate .fXXX part)."""
    media = [f for f in files if f.suffix.lower() in (".mp4", ".mp3", ".m4a", ".webm", ".mkv")]
    pool = media or files
    if not pool:
        return None
    return max(pool, key=lambda f: f.stat().st_size)


# yt-dlp intermediates look like "job.a.f140.mp4"; the real output is "job.a.mp4"
INTERMEDIATE_RE = re.compile(r"\.f\d+\.[^.]+$")


def finalize(job_id, info):
    """Pick (or build) the result file for a finished job."""
    files = [f for f in DOWNLOAD_DIR.glob(f"{job_id}*") if f.is_file()]
    if info.get("_type") == "playlist":
        media = [f for f in files
                 if f.suffix.lower() != ".zip"
                 and not INTERMEDIATE_RE.search(f.name)
                 and f.suffix.lower() not in (".part", ".tmp")]
        if not media:
            raise RuntimeError("No downloaded file found")
        zip_path = DOWNLOAD_DIR / f"{job_id}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for f in media:
                zf.write(f, f.name)
        return zip_path
    return pick_final_file(files)


# --------------------------------------------------------------------------- #
# Home page
# --------------------------------------------------------------------------- #
@app.route("/")
def index():
    return render_template("index.html")


# --------------------------------------------------------------------------- #
# Fetch video info (no download)
# --------------------------------------------------------------------------- #
@app.route("/api/info")
def api_info():
    url = (request.args.get("url") or "").strip()
    if not url:
        return jsonify({"error": "URL is empty"}), 400
    if not is_supported_url(url):
        return jsonify({"error": SUPPORT_MSG}), 400

    opts = base_ydl_opts()
    opts.update({
        "skip_download": True,
        "extract_flat": "in_playlist",  # fast for playlists
    })
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=False)
    except Exception as e:
        return jsonify({"error": f"Could not read info: {friendly_error(str(e))}"}), 400

    if info.get("_type") == "playlist":
        entries = [e for e in (info.get("entries") or []) if e]
        return jsonify({
            "is_playlist": True,
            "title": info.get("title"),
            "count": len(entries),
            "entries": [
                {
                    "title": e.get("title"),
                    "duration": e.get("duration"),
                    "url": e.get("url") or e.get("webpage_url"),
                }
                for e in entries
            ],
        })

    # single video: collect available qualities
    qualities = set()
    for f in info.get("formats", []):
        if f.get("vcodec") != "none" and f.get("height"):
            qualities.add(f["height"])
    return jsonify({
        "is_playlist": False,
        "title": info.get("title"),
        "duration": info.get("duration"),
        "thumbnail": info.get("thumbnail"),
        "uploader": info.get("uploader"),
        "qualities": sorted(qualities, reverse=True),
    })


# --------------------------------------------------------------------------- #
# Start download (background job)
# --------------------------------------------------------------------------- #
@app.route("/api/download", methods=["POST"])
def api_download():
    data = request.get_json(force=True, silent=True) or {}
    url = (data.get("url") or "").strip()
    kind = data.get("type", "video")      # video | mp3
    quality = data.get("quality")         # int (height) for video
    bitrate = data.get("bitrate")         # int (kbps) for mp3

    if not url:
        return jsonify({"error": "URL is empty"}), 400
    if not is_supported_url(url):
        return jsonify({"error": SUPPORT_MSG}), 400

    job_id = uuid.uuid4().hex
    prune_jobs()  # called outside the lock — prune_jobs acquires it itself
    with JOBS_LOCK:
        JOBS[job_id] = {
            "status": "running",
            "percent": 0,
            "status_text": "Starting…",
            "file_path": None,
            "error": None,
        }

    def worker():
        try:
            opts = base_ydl_opts()
            opts["outtmpl"] = outtmpl_for(job_id)
            opts["progress_hooks"] = [make_progress_hook(job_id)]

            if kind == "mp3":
                opts["format"] = "bestaudio/best"
                opts["postprocessors"] = [{
                    "key": "FFmpegExtractAudio",
                    "preferredcodec": "mp3",
                    "preferredquality": str(bitrate or 192),
                }]
            else:
                if quality:
                    opts["format"] = (
                        f"bestvideo[height<={quality}]+bestaudio/"
                        f"best[height<={quality}]/best"
                    )
                else:
                    opts["format"] = "bestvideo+bestaudio/best"
                opts["merge_output_format"] = "mp4"

            with yt_dlp.YoutubeDL(opts) as ydl:
                info = ydl.extract_info(url, download=True)

            final = finalize(job_id, info)

            with JOBS_LOCK:
                JOBS[job_id]["status"] = "done"
                JOBS[job_id]["percent"] = 100
                JOBS[job_id]["status_text"] = "Finished"
                JOBS[job_id]["file_path"] = str(final) if final else None
        except Exception as e:
            with JOBS_LOCK:
                JOBS[job_id]["status"] = "error"
                JOBS[job_id]["status_text"] = "Error"
                JOBS[job_id]["error"] = friendly_error(str(e))

    threading.Thread(target=worker, daemon=True).start()
    return jsonify({"job_id": job_id})


# --------------------------------------------------------------------------- #
# Check job status
# --------------------------------------------------------------------------- #
@app.route("/api/progress/<job_id>")
def api_progress(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job:
            return jsonify({"error": "Job not found"}), 404
        return jsonify({
            "status": job["status"],
            "percent": job["percent"],
            "status_text": job["status_text"],
            "error": job["error"],
            "download_url": f"/download/{job_id}" if job["status"] == "done" else None,
        })


# --------------------------------------------------------------------------- #
# Send the result file
# --------------------------------------------------------------------------- #
@app.route("/download/<job_id>")
def download_file(job_id):
    with JOBS_LOCK:
        job = JOBS.get(job_id)
        if not job or job["status"] != "done" or not job["file_path"]:
            return jsonify({"error": "File not ready"}), 404
        path = Path(job["file_path"])
    return send_file(path, as_attachment=True, download_name=path.name)


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
