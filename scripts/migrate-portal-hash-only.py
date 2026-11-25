"""Offline migration. Never connects to GitHub or modifies the source.
Use a private, verified backup of data/clientes.js. Default is dry-run.
"""
import argparse
import json
import os
from pathlib import Path
import re
import tempfile

def migrate(raw):
    match = re.fullmatch(r"(?s)(.*?window\.LANZATE_CLIENTES\s*=\s*)(\[.*\])(\s*;\s*)", raw)
    if not match:
        raise ValueError("Unexpected client data format")
    rows = json.loads(match[2])
    count = 0
    for row in rows:
        portal = row.get("portal") or {}
        if "clave" not in portal:
            continue
        if not re.fullmatch(r"scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}", str(portal.get("hash", ""))):
            raise ValueError("Legacy credential without valid hash; migration aborted")
        del portal["clave"]
        count += 1
    return match[1] + json.dumps(rows, ensure_ascii=False, indent=2) + match[3], count

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    result, count = migrate(args.source.read_text(encoding="utf-8"))
    if args.output:
        if args.output.resolve() == args.source.resolve():
            parser.error("Output must differ from source")
        fd = os.open(args.output, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as out:
                out.write(result)
        except BaseException:
            args.output.unlink(missing_ok=True)
            raise
    print("Legacy copies eligible for removal:", count)
    print("Separate output created" if args.output else "Dry-run only; no files changed")

if __name__ == "__main__":
    main()
