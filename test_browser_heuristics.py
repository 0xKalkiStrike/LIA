#!/usr/bin/env python3
"""Test LIA's browser URL and search command heuristics."""

import sys
from agents.commander import _detect_browser_url_search_task

def run_tests():
    test_cases = [
        (
            "in edge search youtube",
            {"type": "execute_command", "command": 'start msedge "https://www.youtube.com"'}
        ),
        (
            "in chrome search google for cute puppies",
            {"type": "execute_command", "command": 'start chrome "https://www.google.com/search?q=cute%20puppies"'}
        ),
        (
            "search youtube for coldplay",
            {"type": "execute_command", "command": 'start https://www.youtube.com/results?search_query=coldplay'}
        ),
        (
            "open google.com",
            {"type": "execute_command", "command": 'start https://google.com'}
        ),
        (
            "go to https://github.com/trending",
            {"type": "execute_command", "command": 'start https://github.com/trending'}
        ),
        (
            "search google how to build an AI",
            {"type": "execute_command", "command": 'start https://www.google.com/search?q=how%20to%20build%20an%20AI'}
        ),
        (
            "what is 2 + 2",
            None
        ),
        (
            "open notepad",
            None
        )
    ]

    failed = 0
    print("=" * 80)
    print("RUNNING BROWSER HEURISTICS TESTS")
    print("=" * 80)

    for msg, expected in test_cases:
        res = _detect_browser_url_search_task(msg)
        if res == expected:
            print(f"[PASS] Command: '{msg}'\n       Result: {res}\n")
        else:
            print(f"[FAIL] Command: '{msg}'\n       Expected: {expected}\n       Got:      {res}\n")
            failed += 1

    print("=" * 80)
    if failed == 0:
        print("[SUCCESS] ALL BROWSER HEURISTICS TESTS PASSED!")
        sys.exit(0)
    else:
        print(f"[FAILURE] {failed} TESTS FAILED!")
        sys.exit(1)

if __name__ == "__main__":
    run_tests()
