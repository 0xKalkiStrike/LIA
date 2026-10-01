#!/usr/bin/env python3
"""Test LIA app launching - REAL execution verification."""

from agents import commander, device_agent
from agents.auth_agent import create_account
import subprocess
import time

print("=" * 80)
print("LIA APPLICATION LAUNCH TEST - REAL EXECUTION")
print("=" * 80)
print()

# Create test user
try:
    user_id, _ = create_account("launcher_test", "Test User", "secret", {
        "char_name": "LIA",
        "language_mode": "english"
    })
except:
    user_id = "launcher_test_001"

# Test 1: Direct launch_app function
print("TEST 1: Direct Device Agent Launch")
print("-" * 80)
print("Launching: Notepad")
result = device_agent.launch_app("notepad")
print(f"Result: {result['message']}")
print(f"Success: {result['ok']}")
time.sleep(1)

# Check if process is running
proc_check = subprocess.run("tasklist | findstr notepad", shell=True, capture_output=True, text=True)
running = "notepad" in proc_check.stdout.lower()
print(f"Notepad Process Running: {running}")
print()

# Test 2: LIA command detection and execution
print("TEST 2: LIA Command Detection + Execution")
print("-" * 80)
user_command = "open calculator"
print(f"User Command: '{user_command}'")

result = commander.handle_message(user_id, user_command)
print(f"LIA Reply: {result['reply'][:80]}...")
print(f"Task Detected: {result.get('task') is not None}")
print(f"Task Type: {result.get('task', {}).get('type', 'N/A')}")
print(f"Task Result: {result.get('task_result', {}).get('ok', 'N/A')}")
print(f"Task Message: {result.get('task_result', {}).get('message', 'N/A')}")

time.sleep(1)

# Check if calculator is running
proc_check = subprocess.run("tasklist | findstr calc", shell=True, capture_output=True, text=True)
running = "calc" in proc_check.stdout.lower()
print(f"Calculator Process Running: {running}")
print()

# Test 3: PowerShell launch
print("TEST 3: PowerShell Launch")
print("-" * 80)
user_command = "open powershell"
print(f"User Command: '{user_command}'")

result = commander.handle_message(user_id, user_command)
print(f"LIA Reply: {result['reply'][:80]}...")
print(f"Task Executed: {result.get('task_result', {}).get('ok', 'N/A')}")

print()
print("=" * 80)
print("VERIFICATION: Check your desktop - Notepad and Calculator should be open!")
print("=" * 80)
