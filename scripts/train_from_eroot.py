"""Train LIA from ERoot/LIA JSON Datasets

Scans all training JSON files located in ERoot/LIA/ and imports them
into LIA's memory database and ChromaDB vector store.

Usage:
  python scripts/train_from_eroot.py [--validate-only] [--eroot-path PATH]
"""

import sys
import os
import glob
import json
import argparse

# Setup import path for LIA agents and core
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import memory_agent
from core.database import init_db

def find_eroot_directory(custom_path=None):
    candidates = [
        custom_path,
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "ERoot", "LIA"),
        "C:\\ERoot\\LIA",
        "ERoot/LIA"
    ]
    for path in candidates:
        if path and os.path.exists(path) and os.path.isdir(path):
            return os.path.abspath(path)
    return None

def validate_json_file(file_path):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return True, len(data.get("training_data", [])) if isinstance(data, dict) and "training_data" in data else 1
    except Exception as e:
        return False, str(e)

def run_eroot_training(eroot_dir, validate_only=False):
    print(f"=== LIA ERoot Training System ===")
    print(f"Target ERoot Directory: {eroot_dir}\n")

    json_files = glob.glob(os.path.join(eroot_dir, "*.json"))
    if not json_files:
        print("No JSON files found in ERoot directory!")
        return

    print(f"Found {len(json_files)} dataset files:")
    for f in json_files:
        valid, count = validate_json_file(f)
        status = f"VALID ({count} entries)" if valid else f"INVALID ({count})"
        print(f" - {os.path.basename(f)}: {status}")

    if validate_only:
        print("\nValidation complete. Skipped database ingestion (--validate-only set).")
        return

    print("\nStarting memory database ingestion...")
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization notice: {e}")

    total_ingested = 0
    for file_path in json_files:
        filename = os.path.basename(file_path)
        if filename == "master_training_index.json":
            continue

        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            domain = data.get("domain", os.path.splitext(filename)[0])
            items = data.get("training_data", [data])

            count = 0
            for item in items:
                content = json.dumps(item, indent=2) if isinstance(item, dict) else str(item)
                prompt_text = item.get("prompt", "") if isinstance(item, dict) else ""
                
                # Ingest into LIA Memory
                category = domain
                memory_agent.remember(
                    user_id="system_trainer",
                    content=f"Domain: {domain}\nPrompt: {prompt_text}\nContent:\n{content}",
                    category=category,
                    importance=3
                )
                count += 1

            total_ingested += count
            print(f"  [SUCCESS] {filename} -> Ingested {count} training records into domain '{domain}'")
        except Exception as e:
            print(f"  [ERROR] Failed to ingest {filename}: {e}")

    print(f"\n==========================================")
    print(f"Training Complete! Successfully ingested {total_ingested} records into LIA's AI Memory Engine.")
    print(f"LIA is now trained with all ERoot datasets.")
    print(f"==========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LIA ERoot Training Loader")
    parser.add_argument("--validate-only", action="store_true", help="Validate JSON files without ingesting into DB")
    parser.add_argument("--eroot-path", type=str, default=None, help="Custom path to ERoot/LIA directory")
    args = parser.parse_args()

    eroot_dir = find_eroot_directory(args.eroot_path)
    if not eroot_dir:
        print("Error: Could not locate ERoot/LIA directory.")
        sys.exit(1)

    run_eroot_training(eroot_dir, validate_only=args.validate_only)
