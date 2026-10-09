# Item 3: finalize() — playlist zips contain the media only (no intermediate
# .part files, no old .zip); an empty playlist raises; a single video picks
# the real media file.
import zipfile

import pytest

from app import DOWNLOAD_DIR, finalize


def _files(job, names):
    out = []
    for n in names:
        p = DOWNLOAD_DIR / f"{job}{n}"
        p.write_bytes(b"x" * 4)
        out.append(p)
    return out


def test_finalize_zips_media_only():
    job = "z1"
    files = _files(job, ["a.mp4", "b.mp3", "a.f140.part"])
    (DOWNLOAD_DIR / f"{job}.zip").write_bytes(b"old")  # an old zip must not be zipped in
    final = finalize(job, {"_type": "playlist"})
    assert final.suffix == ".zip"
    names = zipfile.ZipFile(final).namelist()
    assert sorted(names) == sorted([f.name for f in files[:2]])
    for p in files:
        p.unlink()
    final.unlink()


def test_finalize_empty_playlist_raises():
    with pytest.raises(RuntimeError):
        finalize("z2", {"_type": "playlist"})


def test_finalize_single_picks_media_not_part():
    job = "z3"
    files = _files(job, ["x.f140.part", "x.mp4"])
    try:
        final = finalize(job, {"_type": "url"})
        assert final is not None
        assert final.suffix == ".mp4"
    finally:
        for p in files:
            p.unlink()
