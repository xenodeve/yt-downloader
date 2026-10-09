# Item 1: only YouTube links are accepted (server-side is authoritative).
from app import app, is_youtube_url


def test_youtube_url_true():
    assert is_youtube_url("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
    assert is_youtube_url("https://youtu.be/QWxjRuN2pjA")
    assert is_youtube_url("https://m.youtube.com/watch?v=x")
    assert is_youtube_url("https://www.youtube.com/shorts/abc")


def test_youtube_url_false():
    assert not is_youtube_url("https://vimeo.com/12345")
    assert not is_youtube_url("https://www.dailymotion.com/video/x")
    assert not is_youtube_url("youtube.com")


def test_api_info_rejects_non_youtube():
    c = app.test_client()
    r = c.get("/api/info?url=https://vimeo.com/12345")
    assert r.status_code == 400
    assert "YouTube" in r.get_json()["error"]


def test_api_download_rejects_non_youtube():
    c = app.test_client()
    r = c.post("/api/download", json={"url": "https://vimeo.com/12345"})
    assert r.status_code == 400
