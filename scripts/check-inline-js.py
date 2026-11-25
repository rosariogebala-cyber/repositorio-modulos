"""Check executable inline JavaScript in tracked HTML files without executing it."""
from html.parser import HTMLParser
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]

class Scripts(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=False)
        self.current = None
        self.scripts = []
    def handle_starttag(self, tag, attrs):
        if tag != "script":
            return
        attrs = dict(attrs)
        kind = (attrs.get("type") or "").strip().lower()
        if not attrs.get("src") and kind in ("", "text/javascript", "application/javascript", "module"):
            self.current = [kind, self.getpos()[0], ""]
    def handle_data(self, data):
        if self.current is not None:
            self.current[2] += data
    def handle_endtag(self, tag):
        if tag == "script" and self.current is not None:
            self.scripts.append(self.current)
            self.current = None

paths = subprocess.check_output(["git", "ls-files", "-z", "--", "*.html"], cwd=ROOT).decode().split("\0")
failures = []
count = 0
with tempfile.TemporaryDirectory() as tmp:
    for rel in filter(None, paths):
        # Generated landing HTML may be absent from a local checkout. Audit the
        # tracked snapshot in that case rather than silently skipping the file.
        source = ROOT / rel
        if source.is_file():
            markup = source.read_text(encoding="utf-8")
        else:
            tracked = subprocess.run(["git", "show", ":" + rel], cwd=ROOT, capture_output=True)
            if tracked.returncode:
                failures.append(f"{rel}: tracked HTML unavailable")
                continue
            markup = tracked.stdout.decode("utf-8")
            print(f"{rel}: using tracked Git snapshot (local file absent)")
        parser = Scripts()
        parser.feed(markup)
        for kind, line, code in parser.scripts:
            if not code.strip():
                continue
            count += 1
            file = Path(tmp, "check.mjs" if kind == "module" else "check.cjs")
            file.write_text(code, encoding="utf-8")
            result = subprocess.run(["node", "--check", str(file)], capture_output=True, text=True)
            if result.returncode:
                failures.append(f"{rel}:{line}\n{result.stderr}")
print(f"Checked {count} inline scripts; {len(failures)} failures.")
for failure in failures:
    print(failure)
raise SystemExit(bool(failures))
