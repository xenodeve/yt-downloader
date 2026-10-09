"""Thai-integrity gate: catch model-written Thai with dropped tone marks or
wrong-script substitutions before they land in a file.

Incident: an agent wrote README.md / templates/index.html with ดาวนโหลด
(for ดาวน์โหลด), เว็บไซต (for เว็บไซต์), ลิงค (for ลิงก์), ชื่o (for ชื่อ).
The file bytes were wrong at the codepoint level -- no terminal setting can
fix that -- so the check runs on file content, not on display.

Usage:
  python scripts/check-thai.py            scan the project (exit 1 on errors)
  python scripts/check-thai.py --self-test
       verify the detector on embedded samples (exit 1 if it misfires)

Rules:
  BROKEN  regexes that match ONLY the broken form. A missing final diacritic
          is otherwise a substring of the correct word, so each end-of-word
          case carries a negative lookahead (เว็บไซต(?!์)).
  LATIN   a Latin letter directly adjacent to a Thai char (ชื่o, นั้n) --
          warning: legit mixes ("MP4 หรือ") always carry a space.
"""
import os
import re
import sys

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SUFFIXES = (".md", ".py", ".html", ".js", ".css", ".txt")
SKIP_DIRS = {"downloads", ".git", "__pycache__", "node_modules", ".venv", "venv"}
# This file carries the broken forms on purpose (docstring + self-test), so it
# is not scanned; --self-test is its own check.
SKIP_FILES = {"check-thai.py"}

BROKEN = [
    (r"ดาวนโหลด", "ดาวน์โหลด"),
    (r"วดีโอ", "วิดีโอ"),
    (r"เว็บไซต(?!์)", "เว็บไซต์"),
    (r"ลิงค(?!์)", "ลิงก์"),
    (r"แลว(?!้)", "แล้ว"),
    (r"หรื(?!อ)", "หรือ"),
    (r"ไฟล(?!์)", "ไฟล์"),
    (r"เกียวกับ", "เกี่ยวกับ"),
]
LATIN_IN_THAI = re.compile(r"[ก-๛][A-Za-z]|[A-Za-z][ก-๛]")   # adjacent either side: ชื่o ends in Latin


def check_text(text):
    """(errors, warnings): errors are broken words, warnings Latin-in-Thai."""
    errors = [(m.group(0), fix) for pat, fix in BROKEN
              for m in re.finditer(pat, text)]
    warnings = LATIN_IN_THAI.findall(text)
    return errors, warnings


def iter_files(base):
    for root, dirs, files in os.walk(base):
        dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
        for f in sorted(files):
            if f.endswith(SUFFIXES) and f not in SKIP_FILES:
                yield os.path.join(root, f)


def scan(base):
    bad, warn = {}, {}
    for path in iter_files(base):
        try:
            text = open(path, encoding = "utf-8").read()
        except (UnicodeDecodeError, OSError):
            continue
        errors, warnings = check_text(text)
        if errors:
            bad[path] = errors
        if warnings:
            warn[path] = warnings
    return bad, warn


def self_test():
    """The detector must fire on the incident's broken forms and stay quiet
    on the correct ones -- including เว็บไซต์, which a naive substring
    check false-positives on (docs/results/17-thai-sampler-2026-09-15.md)."""
    broken_samples = [
        "ดาวนโหลดวดีโอ", "เว็บไซต", "วางลิงค", "ชื่o", "นั้n",
        "โหลดแลว", "หรื MP3", "เซฟไฟล", "เกียวกับแมว",
    ]
    clean_samples = [
        "ดาวน์โหลดวิดีโอ", "เว็บไซต์", "วางลิงก์", "ชื่อ", "นั้น",
        "โหลดแล้ว", "หรือ MP3", "เซฟไฟล์", "เกี่ยวกับแมว",
        "def f(x): return x", "MP4 หรือ MP3",
    ]
    fails = 0
    for s in broken_samples:
        e, w = check_text(s)
        if not (e or w):
            print(f"MISS (should fire): {s!r}")
            fails += 1
    for s in clean_samples:
        e, w = check_text(s)
        if e or w:
            print(f"FALSE POSITIVE (should stay quiet): {s!r} -> {e} {w}")
            fails += 1
    print("self-test: " + ("PASS" if not fails else f"{fails} FAILURES"))
    return fails


def main():
    if "--self-test" in sys.argv:
        return 1 if self_test() else 0
    base = sys.argv[1] if len(sys.argv) > 1 else BASE
    bad, warn = scan(base)
    for path, errors in bad.items():
        for found, fix in errors:
            print(f"ERROR {os.path.relpath(path, base)}: {found!r} (want {fix!r})")
    for path, warnings in warn.items():
        print(f"WARN  {os.path.relpath(path, base)}: latin-in-thai {warnings}")
    if bad:
        print(f"{sum(len(v) for v in bad.values())} Thai error(s) -- fix before merge")
        return 1
    print("thai gate: clean")
    return 0


if __name__ == "__main__":
    sys.exit(main())
