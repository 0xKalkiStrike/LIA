"""Import Knowledge — loads facts and training data from JSON into LIA's database.

Place your `train.json` file in LIA's root directory and run this script to
teach LIA all the training data.
"""
import sys
import os
import json

# Setup import path for agents
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agents import memory_agent
from core.database import init_db

def load_and_train(file_path="train.json"):
    if not os.path.exists(file_path):
        print(f"Error: The training file '{file_path}' was not found.")
        print("Please move your 'train.json' file to the root of the LIA directory and try again.")
        return
        
    try:
        init_db()
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)
            
        print("Training starting... Processing JSON data structures.")
        count = 0
        
        # Support both List of items/QA-pairs or a general Object map
        if isinstance(data, list):
            for item in data:
                content = ""
                category = "fact"
                
                if isinstance(item, str):
                    content = item
                elif isinstance(item, dict):
                    if "content" in item:
                        content = item["content"]
                        category = item.get("category", "fact")
                    elif "question" in item and "answer" in item:
                        content = f"Question: {item['question']}\nAnswer: {item['answer']}"
                    elif "prompt" in item and "completion" in item:
                        content = f"Context: {item['prompt']}\nResponse: {item['completion']}"
                    else:
                        content = json.dumps(item)
                        
                if content:
                    # Teach it to the default user session
                    memory_agent.remember("user_1", content, category=category, importance=2)
                    count += 1
                    
        elif isinstance(data, dict):
            for key, val in data.items():
                content = f"{key}: {val}" if not isinstance(val, (dict, list)) else f"{key}: {json.dumps(val)}"
                memory_agent.remember("user_1", content, category="fact", importance=2)
                count += 1
                
        print(f"Training complete! Successfully loaded {count} items into LIA's semantic memory.")
        print("LIA will now automatically recall and use this knowledge in future chat sessions.")
    except Exception as e:
        print(f"Training failed: {e}")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else "train.json"
    load_and_train(target)
