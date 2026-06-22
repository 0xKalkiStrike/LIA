import sqlite3
import os

db_path = os.path.join("data", "jarvis.db")
if not os.path.exists(db_path):
    print(f"Error: Database file not found at {db_path}")
    exit(1)

conn = sqlite3.connect(db_path)
conn.row_factory = sqlite3.Row
print("="*60)
print(f"LIA Database Shell ({db_path})")
print("Type standard SQL queries (e.g., SELECT * FROM Users;)")
print("Type 'exit' or '.exit' to quit.")
print("="*60)

while True:
    try:
        query = input("sqlite> ").strip()
        if not query:
            continue
        if query.lower() in ["exit", ".exit"]:
            break
            
        cursor = conn.cursor()
        cursor.execute(query)
        
        # Check if the query returns data
        if query.lower().startswith("select") or "returning" in query.lower():
            rows = cursor.fetchall()
            if rows:
                # Find columns and compute widths
                columns = rows[0].keys()
                print(" | ".join(columns))
                print("-" * (sum(len(c) for c in columns) + 3 * len(columns)))
                for row in rows:
                    print(" | ".join(str(row[c]) for c in columns))
                print(f"\n({len(rows)} rows returned)\n")
            else:
                print("(0 rows returned)\n")
        else:
            conn.commit()
            print(f"Success: {cursor.rowcount} row(s) affected.\n")
            
    except KeyboardInterrupt:
        print("\nUse 'exit' to quit.")
    except Exception as e:
        print(f"Error: {e}\n")

conn.close()
