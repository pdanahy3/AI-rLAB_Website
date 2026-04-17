"""Emit data/about.json from scripts/build-about-json.mjs (no Node required)."""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
MJS = ROOT / "scripts" / "build-about-json.mjs"
OUT = ROOT / "data" / "about.json"


def main() -> None:
    text = MJS.read_text(encoding="utf-8")
    key = "const data = "
    i = text.index(key) + len(key)
    start = text.index("{", i)
    depth = 0
    end = None
    for j in range(start, len(text)):
        if text[j] == "{":
            depth += 1
        elif text[j] == "}":
            depth -= 1
            if depth == 0:
                end = j + 1
                break
    if end is None:
        sys.exit("Could not find data object")

    blob = text[start:end]

    def quote_templates(m: re.Match) -> str:
        return json.dumps(m.group(1), ensure_ascii=False)

    blob = re.sub(r"`([^`]*)`", quote_templates, blob, flags=re.DOTALL)
    blob = re.sub(
        r"(^|\n)(\s+)([a-zA-Z_][a-zA-Z0-9_]*)\s*:",
        lambda m: f'{m.group(1)}{m.group(2)}"{m.group(3)}":',
        blob,
    )
    blob = re.sub(r",(\s*[\]}])", r"\1", blob)

    data = json.loads(blob)
    OUT.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("Wrote", OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
