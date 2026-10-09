# Renders the Flask page and inlines CSS/JS into a single file the
# design-ship-gate scripts can open as a plain page.
import pathlib, sys
BASE = pathlib.Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE))
from app import app

css = (BASE / "static" / "style.css").read_text(encoding="utf-8")
js = (BASE / "static" / "app.js").read_text(encoding="utf-8")
html = app.test_client().get("/").data.decode("utf-8")
html = html.replace('<link rel="stylesheet" href="/static/style.css" />',
                    "<style>\n" + css + "\n</style>")
html = html.replace('<script src="/static/app.js"></script>',
                    "<script>\n" + js + "\n</script>")
out = BASE / "design-exploration" / "gate-snapshot.html"
out.write_text(html, encoding="utf-8")
print("snapshot:", out)
