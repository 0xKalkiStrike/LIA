"""Train LIA from Train Directory JSON Datasets

Scans all training JSON files located in Train/ (including all subfolders)
and imports them into LIA's memory database and ChromaDB vector store.

Usage:
  python scripts/train_from_folder.py [--validate-only] [--train-path PATH]
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

def find_train_directory(custom_path=None):
    candidates = [
        custom_path,
        os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "Train"),
        "C:\\Train",
        "Train"
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

def run_train_ingestion(train_dir, validate_only=False):
    print(f"=== LIA AI Training System ===")
    print(f"Target Train Directory: {train_dir}\n")

    # Search recursively for all .json files inside Train/ directory
    search_pattern = os.path.join(train_dir, "**", "*.json")
    json_files = glob.glob(search_pattern, recursive=True)
    if not json_files:
        print("No JSON files found in Train directory!")
        return

    # Deduplicate files by relative subpath to prevent double ingestion if mirrored in subfolders
    unique_files = {}
    for f in json_files:
        filename = os.path.basename(f)
        if filename not in unique_files:
            unique_files[filename] = f

    print(f"Found {len(unique_files)} unique dataset files in Train folder structure:")
    for name, path in unique_files.items():
        valid, count = validate_json_file(path)
        status = f"VALID ({count} entries)" if valid else f"INVALID ({count})"
        print(f" - {name} ({os.path.relpath(path, train_dir)}): {status}")

    if validate_only:
        print("\nValidation complete. Skipped database ingestion (--validate-only set).")
        return

    print("\nStarting memory database ingestion...")
    try:
        init_db()
    except Exception as e:
        print(f"Warning: Database initialization notice: {e}")

    total_ingested = 0
    for filename, file_path in unique_files.items():
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
    print(f"LIA is now trained with all Train datasets.")
    print(f"==========================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LIA Train Folder Ingestion Loader")
    parser.add_argument("--validate-only", action="store_true", help="Validate JSON files without ingesting into DB")
    parser.add_argument("--train-path", type=str, default=None, help="Custom path to Train directory")
    args = parser.parse_args()

    train_dir = find_train_directory(args.train_path)
    if not train_dir:
        print("Error: Could not locate Train directory.")
        sys.exit(1)

    run_train_ingestion(train_dir, validate_only=args.validate_only)
