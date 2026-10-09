# Error messages must be actionable: a bot-block / login-required yt-dlp
# failure tells the developer what to do (export cookies.txt), not just the
# raw extractor text.
from app import app, friendly_error


def test_bot_block_gets_cookies_hint():
    raw = "[youtube] bc1EBkxhRRc: Sign in to confirm you're not a bot"
    out = friendly_error(raw)
    assert raw in out          # the original text is kept, not replaced
    assert "cookies.txt" in out


def test_plain_error_unchanged():
    assert friendly_error("Cannot parse data") == "Cannot parse data"


def test_api_info_bot_block_shows_hint(monkeypatch):
    import yt_dlp

    class FakeYDL:
        def __init__(self, opts):
            pass
        def __enter__(self):
            return self
        def __exit__(self, *a):
            return False
        def extract_info(self, url, download=False):
            raise Exception("Sign in to confirm you're not a bot")

    monkeypatch.setattr(yt_dlp, "YoutubeDL", FakeYDL)
    c = app.test_client()
    r = c.get("/api/info?url=https://www.youtube.com/watch?v=bc1EBkxhRRc")
    assert r.status_code == 400
    assert "cookies.txt" in r.get_json()["error"]
