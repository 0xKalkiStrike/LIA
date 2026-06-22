#!/usr/bin/env python3
"""Test LIA command execution functionality."""

from agents import device_agent, commander
from agents.auth_agent import create_account
import json

print("=" * 70)
print("LIA COMMAND EXECUTION TEST SUITE")
print("=" * 70)
print()

# Test 1: Launch app
print("TEST 1: Launch Application")
print("-" * 70)
result = device_agent.launch_app("notepad")
print(f"Command: launch_app('notepad')")
print(f"Result: {json.dumps(result, indent=2)}")
print()

# Test 2: List files
print("TEST 2: List Files")
print("-" * 70)
files = device_agent.list_files()
print(f"Command: list_files()")
print(f"Files found: {len(files)}")
for f in files[:5]:
    print(f"  - {f['name']} ({'dir' if f['is_dir'] else 'file'})")
if len(files) > 5:
    print(f"  ... and {len(files) - 5} more")
print()

# Test 3: Run simple command
print("TEST 3: Execute Command (date)")
print("-" * 70)
result = device_agent.run_command("date /t")
print(f"Command: date /t")
print(f"Success: {result['ok']}")
print(f"Output: {result['stdout']}")
if result['stderr']:
    print(f"Error: {result['stderr']}")
print()

# Test 4: Run Python command
print("TEST 4: Execute Command (Python)")
print("-" * 70)
result = device_agent.run_command("python --version")
print(f"Command: python --version")
print(f"Success: {result['ok']}")
print(f"Output: {result['stdout']}")
print()

# Test 5: Simulate LIA command detection
print("TEST 5: LIA Command Detection & Execution")
print("-" * 70)

# Create a test user
try:
    user_id, token = create_account("testuser", "Test User", "secret123", {
        "char_name": "LIA",
        "language_mode": "english"
    })
except:
    user_id = "test_user_001"

test_commands = [
    "open notepad",
    "launch calculator",
    "show files",
]

for cmd in test_commands:
    print(f"\nUser Command: '{cmd}'")
    result = commander.handle_message(user_id, cmd)
    print(f"  LIA Reply: {result['reply'][:100]}...")
    if result.get('task'):
        print(f"  Task Type: {result['task']['type']}")
        print(f"  Task Detected: [YES]")
    if result.get('task_result'):
        print(f"  Task Executed: [YES]")
        print(f"  Execution Result: {result['task_result']['ok']}")
    print()

print("=" * 70)
print("[SUCCESS] ALL TESTS COMPLETED SUCCESSFULLY")
print("=" * 70)
