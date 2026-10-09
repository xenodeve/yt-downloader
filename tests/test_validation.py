# Item 9: validation accepts YouTube, Facebook, TikTok, Instagram;
# rejects other sites (server-side is authoritative).
from app import app, is_supported_url


def test_supported_platforms():
    yes = [
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtu.be/QWxjRuN2pjA",
        "https://m.youtube.com/watch?v=x",
        "https://www.youtube.com/shorts/abc",
        "https://www.facebook.com/watch?v=10101010101",
        "https://m.facebook.com/reel/1234567890",
        "https://fb.watch/abc/",
        # the forms yt-dlp's facebook extractor tests use for video links
        "https://www.facebook.com/amogood/videos/1618742068337349/",
        "https://www.facebook.com/video.php?v=637842556329505",
        "https://www.instagram.com/p/ABC123/",
        "https://instagr.am/p/ABC123/",
        "https://www.instagram.com/reel/ABC123/",
        "https://www.tiktok.com/@user/video/1234567890",
        "https://vm.tiktok.com/ZMabcdef/",
    ]
    for u in yes:
        assert is_supported_url(u), u


def test_rejects_other_sites():
    no = [
        "https://vimeo.com/12345",
        "https://www.dailymotion.com/video/x",
        "https://twitter.com/x/status/1",
        "https://example.com/watch?v=1",
        "youtube.com",
    ]
    for u in no:
        assert not is_supported_url(u), u


def test_api_info_rejects_unsupported():
    c = app.test_client()
    r = c.get("/api/info?url=https://vimeo.com/12345")
    assert r.status_code == 400
    assert "support" in r.get_json()["error"]


def test_api_info_accepts_facebook():
    # an accepted URL passes the validation gate. Offline yt-dlp then fails
    # on the fake id through the pre-existing "Could not read info" handler
    # (which also 400s), so the assertion is on the message, not the status:
    # the support-gate error must NOT be what came back.
    c = app.test_client()
    r = c.get("/api/info?url=https://www.facebook.com/watch?v=10101010101")
    assert "support" not in r.get_json()["error"]


def test_api_download_rejects_unsupported():
    c = app.test_client()
    r = c.post("/api/download", json={"url": "https://vimeo.com/12345"})
    assert r.status_code == 400
