# Item 4: JOBS stays bounded — prune_jobs keeps the newest JOBS_MAX entries.
from app import JOBS, JOBS_MAX, prune_jobs


def test_prune_keeps_newest():
    # single-threaded test: populate without the lock, prune_jobs takes it itself
    JOBS.clear()
    for i in range(JOBS_MAX + 5):
        JOBS[f"j{i}"] = {"status": "done", "percent": 100, "status_text": "Finished",
                         "file_path": None, "error": None}
    prune_jobs()
    assert len(JOBS) <= JOBS_MAX
    assert "j24" in JOBS   # newest kept
    assert "j0" not in JOBS  # oldest dropped
