# Item 8: pass YouTube cookies so yt-dlp is not blocked as a bot
# ("Sign in to confirm you're not a bot").
import app
from app import base_ydl_opts


def test_browser_cookie_opt(monkeypatch):
    monkeypatch.setenv("YTDLP_BROWSER", "firefox")
    opts = base_ydl_opts()
    assert opts["cookiesfrombrowser"] == ("firefox",)


def test_cookiefile_when_present(tmp_path, monkeypatch):
    monkeypatch.setattr(app, "BASE_DIR", tmp_path)
    (tmp_path / "cookies.txt").write_text("# Netscape cookie file\n")
    opts = base_ydl_opts()
    assert opts["cookiefile"] == str(tmp_path / "cookies.txt")
