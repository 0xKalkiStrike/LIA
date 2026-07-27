import sqlite3
import os
import uuid
import hashlib

DB_PATH = os.path.join("data", "jarvis.db")

def init_db():
    if not os.path.exists(DB_PATH):
        print(f"Error: Database file not found at {DB_PATH}")
        print("Please start the backend server at least once to initialize the database.")
        exit(1)
    return sqlite3.connect(DB_PATH)

def hash_password(password: str) -> str:
    # Basic SHA-256 matching the backend implementation
    return hashlib.sha256(password.encode()).hexdigest()

def prompt_choice(prompt: str, choices: list) -> str:
    print(f"\n{prompt}")
    for i, choice in enumerate(choices, 1):
        print(f"  {i}. {choice.capitalize()}")
    
    while True:
        try:
            val = input("Select an option (number): ").strip()
            idx = int(val) - 1
            if 0 <= idx < len(choices):
                return choices[idx]
            print("Invalid choice. Try again.")
        except ValueError:
            print("Please enter a number.")

def prompt_string(prompt: str, default: str) -> str:
    val = input(f"\n{prompt} [{default}]: ").strip()
    return val if val else default

def main():
    print("="*60)
    print(" LIA - CHARACTER & USER CREATION TOOL ")
    print("="*60)
    print("\nThis script will create a new user and customize their AI companion.")
    
    conn = init_db()
    cursor = conn.cursor()
    
    # 1. User details
    print("\n--- COMMANDER (USER) DETAILS ---")
    while True:
        username = input("\nEnter Username (e.g. Tony): ").strip().lower()
        if not username:
            print("Username cannot be empty.")
            continue
            
        # Check if exists
        cursor.execute("SELECT id FROM Users WHERE username = ?", (username,))
        if cursor.fetchone():
            print("That username already exists! Please choose another.")
        else:
            break
            
    display_name = prompt_string("Enter Display Name", username.capitalize())
    password = input("Enter Secret Security Word (Password): ").strip()
    
    user_id = str(uuid.uuid4())
    pw_hash = hash_password(password) if password else hash_password("admin")
    
    # 2. Character Details
    print("\n--- COMPANION (CHARACTER) DETAILS ---")
    
    char_name = prompt_string("Companion Name", "LIA")
    
    genders = ["female", "male"]
    char_gender = prompt_choice("Avatar Base (Gender)", genders)
    
    accents = ["us", "gb", "in", "au"]
    voice_accent = prompt_choice("Voice Accent", accents)
    
    # Voice preset based on gender
    if char_gender == "female":
        voice_personas = ["friday", "nova"]
    else:
        voice_personas = ["jarvis_classic", "sage"]
    voice_persona = prompt_choice("Voice Preset", voice_personas)
    
    clothing_styles = ["casual", "professional", "formal", "scifi", "fantasy"]
    char_clothing_style = prompt_choice("Clothing Style", clothing_styles)
    
    outfits = ["cyan", "gold", "crimson", "violet", "rose"]
    char_outfit = prompt_choice("HUD/Outfit Accent Color", outfits)
    
    hair_styles = ["long", "short", "spiky", "bun", "curly", "wave"]
    char_hair_style = prompt_choice("Hair Style", hair_styles)
    
    hair_colors = ["black", "brown", "blonde", "pink", "blue", "violet", "white"]
    char_hair_color = prompt_choice("Hair Color", hair_colors)
    
    skins = ["porcelain", "fair", "tan", "brown", "deep"]
    char_skin = prompt_choice("Skin Tone", skins)
    
    eyes = ["amber", "emerald", "sapphire", "violet", "rose", "crimson"]
    char_eyes = prompt_choice("Eye Color", eyes)
    
    avatar_type = "male" if char_gender == "male" else "lia"
    vrm_path = "" if char_gender == "male" else "/static/LIA.vrm"
    
    print("\nSaving to database...")
    
    try:
        # Insert User
        cursor.execute(
            "INSERT INTO Users (id, username, display_name, password_hash) VALUES (?, ?, ?, ?)",
            (user_id, username, display_name, pw_hash)
        )
        
        # Insert Profile
        cursor.execute(
            """INSERT INTO Profiles (
                user_id, char_name, char_gender, voice_accent, voice_persona,
                char_clothing_style, char_outfit, char_hair_style, char_hair_color,
                char_skin, char_eyes, avatar_type, vrm_path
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                user_id, char_name, char_gender, voice_accent, voice_persona,
                char_clothing_style, char_outfit, char_hair_style, char_hair_color,
                char_skin, char_eyes, avatar_type, vrm_path
            )
        )
        
        conn.commit()
        print("\nSuccess! User and Character Profile created.")
        print(f"You can now log in to the web interface as '{username}' with your password.")
        print("Your character will load with all the specified settings.")
        
    except Exception as e:
        conn.rollback()
        print(f"\nError saving to database: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    main()
