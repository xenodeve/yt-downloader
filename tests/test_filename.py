# Item 2: output filename is bounded (Windows MAX_PATH) and zip is never
# picked as the final media file.
from app import DOWNLOAD_DIR, outtmpl_for, pick_final_file


def test_outtmpl_truncates_title():
    t = outtmpl_for("abc123")
    assert "%(title.80)s" in t  # title capped, not unbounded


def test_outtmpl_path_length():
    t = outtmpl_for("a" * 32)
    worst = str(DOWNLOAD_DIR) + t.replace("%(title.80)s", "x" * 80).replace("%(id)s", "y" * 11)
    assert len(worst) < 240


def test_pick_final_file_skips_zip():
    z = DOWNLOAD_DIR / "job1.zip"
    m = DOWNLOAD_DIR / "job1big.mp4"
    z.write_bytes(b"zipzipzipzipzipzip")  # zip is the bigger file
    m.write_bytes(b"media")
    try:
        assert pick_final_file([z, m]) == m
    finally:
        z.unlink()
        m.unlink()
