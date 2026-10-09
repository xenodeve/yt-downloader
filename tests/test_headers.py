# TikTok's WAF serves a hard wall to plain "en" requests and a solvable
# JS challenge to local Accept-Language — yt-dlp solves the challenge in
# pure Python, so the header is what lets TikTok extraction start.
from app import base_ydl_opts


def test_base_opts_send_local_accept_language():
    opts = base_ydl_opts()
    assert opts["http_headers"]["Accept-Language"] == "th,en"


def test_headers_keep_the_browser_defaults():
    # yt-dlp's http_headers option REPLACES the default headers, so we must
    # merge std_headers in — a bare {Accept-Language} request has no User-Agent
    opts = base_ydl_opts()
    assert "User-Agent" in opts["http_headers"]
