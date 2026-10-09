# The server must not restart on file changes: debug's reloader watches the
# whole repo, so a finished download (a new file in downloads/) kills the
# server — and any job still running with it.
import app as appmod


def test_main_runs_without_reloader(monkeypatch):
    seen = {}

    def fake_run(**kw):
        seen.update(kw)

    monkeypatch.setattr(appmod.app, "run", fake_run)
    appmod.main()
    assert seen["use_reloader"] is False
    assert seen["debug"] is True
    assert seen["host"] == "127.0.0.1"
    assert seen["port"] == 5000
