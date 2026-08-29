#!/usr/bin/env python
"""build_system.py -- parses, validates, and merges the Train/* domain
datasets (indexed by Train/LIA/master_training_index.json) into a single
Alpaca-format instruction-tuning file, and optionally generates the Ollama
Modelfile from the same source of truth.

Usage:
    python build_system.py                    # build data/alpaca_train.json
    python build_system.py --strict            # exit 1 on any validation error
    python build_system.py --modelfile          # also (re)generate Modelfile
    python build_system.py --out path/to.json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
TRAIN_DIR = ROOT / "Train"
DEFAULT_INDEX = TRAIN_DIR / "LIA" / "master_training_index.json"
DEFAULT_OUT = ROOT / "data" / "alpaca_train.json"
MODELFILE_PATH = ROOT / "Modelfile"

REQUIRED_ENTRY_KEYS = ("id", "category", "prompt", "completion")


class DomainResult:
    def __init__(self, domain: str, path: Path):
        self.domain = domain
        self.path = path
        self.errors: list[str] = []
        self.alpaca_entries: list[dict] = []
        self.description: str = ""

    @property
    def ok(self) -> bool:
        return not self.errors


def _load_index(index_path: Path) -> dict:
    if not index_path.exists():
        print(f"FATAL: master index not found at {index_path}", file=sys.stderr)
        sys.exit(1)
    with open(index_path, "r", encoding="utf-8-sig") as f:
        return json.load(f)


def _to_alpaca(entry: dict) -> dict:
    completion = entry["completion"]
    output = completion if isinstance(completion, str) else json.dumps(completion, ensure_ascii=False, indent=2)
    return {"instruction": entry["prompt"], "input": "", "output": output}


def _validate_and_convert(domain: str, path: Path) -> DomainResult:
    result = DomainResult(domain, path)

    if not path.exists():
        result.errors.append(f"file not found: {path}")
        return result

    try:
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        result.errors.append(f"invalid JSON: {e}")
        return result

    if "domain" not in data:
        result.errors.append("missing top-level 'domain' key")
    if "training_data" not in data:
        result.errors.append("missing top-level 'training_data' key")
        return result

    result.description = data.get("description", "")
    training_data = data["training_data"]
    if not isinstance(training_data, list) or not training_data:
        result.errors.append("'training_data' must be a non-empty list")
        return result

    seen_ids: set[str] = set()
    for i, entry in enumerate(training_data):
        missing = [k for k in REQUIRED_ENTRY_KEYS if k not in entry]
        if missing:
            result.errors.append(f"training_data[{i}] missing keys: {missing}")
            continue
        entry_id = entry["id"]
        if entry_id in seen_ids:
            result.errors.append(f"training_data[{i}] duplicate id: {entry_id}")
            continue
        seen_ids.add(entry_id)
        if not str(entry["prompt"]).strip():
            result.errors.append(f"training_data[{i}] (id={entry_id}) has empty prompt")
            continue
        result.alpaca_entries.append(_to_alpaca(entry))

    return result


def _generate_modelfile(domain_results: list[DomainResult], base_model: str) -> str:
    from core import persona

    lines = [f"FROM {base_model}", ""]

    system_parts = [
        persona.build_system_prompt("friendly", char_name="LIA", user_name="Commander"),
        "\n---\n\n" + persona.build_system_prompt("engineering", char_name="LIA", user_name="Commander"),
        "\n---\n\n" + persona.build_system_prompt("research", char_name="LIA", user_name="Commander"),
        "\n---\n\n## Trained Domain Coverage\n",
    ]
    for r in domain_results:
        if r.ok and r.description:
            system_parts.append(f"* **{r.domain}** — {r.description}\n")

    system_text = "".join(system_parts).replace('"""', "'''")
    lines.append(f'SYSTEM """{system_text}"""')
    lines.append("")
    lines.append("PARAMETER temperature 0.72")
    lines.append("PARAMETER num_predict 512")
    lines.append("PARAMETER top_p 0.9")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", type=Path, default=DEFAULT_INDEX)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--strict", action="store_true", help="exit 1 if any domain file fails validation")
    parser.add_argument("--modelfile", action="store_true", help="also (re)generate Modelfile")
    parser.add_argument("--base-model", default="llama3.2", help="FROM line for the generated Modelfile")
    args = parser.parse_args()

    index = _load_index(args.index)
    datasets = index.get("datasets", [])
    if not datasets:
        print("FATAL: master index has no 'datasets' entries", file=sys.stderr)
        return 1

    results: list[DomainResult] = []
    merged: list[dict] = []
    any_errors = False

    print(f"Building dataset from {len(datasets)} domain(s) listed in {args.index}\n")
    for ds in datasets:
        domain = ds["domain"]
        path = TRAIN_DIR / ds["file"]
        result = _validate_and_convert(domain, path)
        results.append(result)
        merged.extend(result.alpaca_entries)

        status = "OK" if result.ok else "FAILED"
        print(f"  [{status}] {domain:20s} entries={len(result.alpaca_entries):4d}  ({path})")
        for err in result.errors:
            print(f"           - {err}")
            any_errors = True

    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(merged, f, ensure_ascii=False, indent=2)

    print(f"\nWrote {len(merged)} Alpaca-format entries -> {args.out}")

    if args.modelfile:
        modelfile_text = _generate_modelfile(results, args.base_model)
        MODELFILE_PATH.write_text(modelfile_text, encoding="utf-8")
        print(f"Wrote Modelfile -> {MODELFILE_PATH}")

    if any_errors:
        print("\nValidation errors were found in one or more domain files (see above).")
        if args.strict:
            return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
