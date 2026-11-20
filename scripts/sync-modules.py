"""data/modules.js es la fuente de los módulos; data/modules.json (lo usa el servidor) se genera desde ahí.

Uso: python3 scripts/sync-modules.py          (regenera modules.json)
     python3 scripts/sync-modules.py --check  (falla si están distintos; lo usa CI)
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read_js():
    text = (ROOT / "data" / "modules.js").read_text(encoding="utf-8")
    return json.loads(text[text.index("=", text.index("window.")) + 1:text.rindex(";")])


def main():
    modules = read_js()
    target = ROOT / "data" / "modules.json"
    if "--check" in sys.argv:
        if json.loads(target.read_text(encoding="utf-8")) != modules:
            sys.exit("data/modules.json no coincide con data/modules.js: corré python3 scripts/sync-modules.py")
        print("modules.json al día")
        return
    target.write_text(json.dumps(modules, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("modules.json regenerado (%d secciones)" % len(modules))


if __name__ == "__main__":
    main()
