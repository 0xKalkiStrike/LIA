import os
import shutil
import json

def setup_train_folders():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Paths
    eroot_project = os.path.join(project_root, "ERoot")
    eroot_c = "C:\\ERoot"
    
    train_project = os.path.join(project_root, "Train")
    train_c = "C:\\Train"
    
    # 1. Remove old ERoot if present
    if os.path.exists(eroot_project):
        shutil.rmtree(eroot_project, ignore_errors=True)
    if os.path.exists(eroot_c):
        shutil.rmtree(eroot_c, ignore_errors=True)
        
    # 2. Ensure Train directories exist
    domains = [
        ("Image_Generation", "image_generation.json"),
        ("Video_Generation", "video_generation.json"),
        ("Development", "development.json"),
        ("Data_Scraping", "data_scraping.json"),
        ("Data_Analysis", "data_analysis.json"),
        ("Article", "article.json"),
        ("Presentation", "presentation.json"),
        ("Research", "research.json"),
        ("Voice_Speech", "voice_speech.json"),
        ("Vision_Multimodal", "vision_multimodal.json"),
        ("Automation_Control", "automation_control.json"),
        ("Memory_Reasoning", "memory_reasoning.json")
    ]
    
    for base in [train_project, train_c]:
        os.makedirs(os.path.join(base, "LIA"), exist_ok=True)
        for domain_dir, _ in domains:
            os.makedirs(os.path.join(base, domain_dir), exist_ok=True)
            
    print(f"Created Train directory structures at:\n - {train_project}\n - {train_c}")

if __name__ == "__main__":
    setup_train_folders()
