# Item 6: favicon.svg + real og.png (1200x630 print-tech OG card).
from app import app


def test_favicon():
    r = app.test_client().get("/static/favicon.svg")
    assert r.status_code == 200
    assert r.data.startswith(b"<svg")


def test_og_image_is_real():
    r = app.test_client().get("/static/og.png")
    assert r.status_code == 200
    assert len(r.data) > 1000  # the 1x1 placeholder was 67 bytes
