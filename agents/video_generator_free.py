"""
FREE Video Generator — Zero-cost real video generation

Options:
1. Replicate API - Pay-per-use (~$0.005 per video, free tier)
2. Local AnimateDiff - Completely free, runs on your machine
3. Hugging Face - Free inference with rate limits
4. Open-source models (ModelScope, Damo, etc.)
"""

import requests
import json
import time
import os
import subprocess
from pathlib import Path
from typing import Optional, Dict

try:
    import replicate
except ImportError:
    replicate = None

from core.config import ROOT, load

GENERATED_DIR = ROOT / "ui" / "static" / "generated"
GENERATED_DIR.mkdir(parents=True, exist_ok=True)

# ── Configuration ──
REPLICATE_API_TOKEN = os.getenv("REPLICATE_API_TOKEN", "")
HF_TOKEN = os.getenv("HF_API_KEY", "")

class FreeVideoGenerator:
    """Free video generation using open-source and free APIs"""

    @staticmethod
    def generate_with_replicate_free(prompt: str, duration: int = 4) -> Optional[Dict]:
        """
        Generate video using Replicate (pay-per-use, very cheap)
        - Free tier: $1 free credit/month
        - Per video: ~$0.005-0.01
        - Model: AnimateDiff (open-source)

        Sign up: https://replicate.com
        Get token from: https://replicate.com/account/api-tokens
        """

        if not REPLICATE_API_TOKEN:
            print("⚠️  Replicate token not set. See setup guide.")
            return None

        try:
            # Use free/cheap model on Replicate
            # TailorMode AnimateDiff is $0.005 per run
            output = replicate.run(
                "deforum-art/animatediff:d2523e3e3f50492bcfd94f1b4cbf22c4d1c90a11e105dfc5b2ac8d51754e2fbf",
                input={
                    "prompt": prompt,
                    "num_frames": 16,
                    "guidance_scale": 7.5,
                    "seed": int(time.time()) % 10000
                }
            )

            if output and len(output) > 0:
                return {
                    "video_url": output[0] if isinstance(output, list) else output,
                    "duration": duration,
                    "engine": "replicate_free",
                    "quality": "high",
                    "cost": "$0.005"
                }
            return None

        except Exception as e:
            print(f"Replicate error: {e}")
            return None

    @staticmethod
    def generate_with_huggingface_free(prompt: str) -> Optional[Dict]:
        """
        Generate video using Hugging Face (completely free!)
        - Zero cost
        - Rate limited (1-2 videos per hour)
        - Model: ZeroScope or similar

        HF Spaces inference is completely free but slow
        """

        try:
            # Use Hugging Face's free inference API
            # No token needed for public models

            # Option 1: Use ZeroScope (free, open-source)
            hf_api_url = "https://api-inference.huggingface.co/models/cerspense/zeroscope_v2_576w"

            headers = {}
            if HF_TOKEN:
                headers["Authorization"] = f"Bearer {HF_TOKEN}"

            payload = {"inputs": prompt}

            response = requests.post(
                hf_api_url,
                headers=headers,
                json=payload,
                timeout=120
            )

            if response.status_code == 200:
                result = response.json()
                # HF returns base64 or URL
                return {
                    "video_url": result.get("url") or result.get("output"),
                    "duration": 4,
                    "engine": "huggingface_free",
                    "quality": "medium",
                    "cost": "FREE"
                }

            return None

        except Exception as e:
            print(f"HuggingFace error: {e}")
            return None

    @staticmethod
    def generate_with_local_animatediff(prompt: str) -> Optional[Dict]:
        """
        Generate video locally using AnimateDiff (100% FREE)
        - Requires: Python, PyTorch, diffusers
        - Download once, use forever
        - Runs on CPU or GPU

        Install:
        pip install diffusers transformers torch
        """

        try:
            from diffusers import AnimateDiffPipeline
            from diffusers.utils import export_to_video
            import torch

            print("🔧 Initializing AnimateDiff (first run downloads models ~3GB)...")

            # Use lightweight model for free tier
            model_id = "runwayml/stable-diffusion-v1-5"
            pipe = AnimateDiffPipeline.from_pretrained(
                model_id,
                torch_dtype=torch.float16
            )

            # Use CPU if GPU not available
            if not torch.cuda.is_available():
                pipe = pipe.to("cpu")
            else:
                pipe = pipe.to("cuda")

            # Generate frames
            print(f"🎨 Generating video: {prompt}")
            output = pipe(
                prompt=prompt,
                num_frames=16,
                guidance_scale=7.5,
                num_inference_steps=25
            )

            # Save video
            video_id = f"vid_local_{int(time.time())}"
            video_path = GENERATED_DIR / f"{video_id}.mp4"

            export_to_video(output.frames[0], str(video_path))

            return {
                "video_url": f"/static/generated/{video_id}.mp4",
                "video_path": str(video_path),
                "duration": 4,
                "engine": "local_animatediff",
                "quality": "good",
                "cost": "FREE (one-time download ~3GB)"
            }

        except ImportError:
            print("❌ AnimateDiff not installed. Run:")
            print("   pip install diffusers transformers torch")
            return None
        except Exception as e:
            print(f"Local AnimateDiff error: {e}")
            return None

    @staticmethod
    def generate_with_pika_free(prompt: str) -> Optional[Dict]:
        """
        Generate using Pika Labs (has free tier!)

        Sign up: https://pika.art
        Free tier includes monthly credits
        """

        pika_api_key = os.getenv("PIKA_API_KEY", "")
        if not pika_api_key:
            return None

        try:
            url = "https://api.pika.art/v1/generate"
            headers = {
                "Authorization": f"Bearer {pika_api_key}",
                "Content-Type": "application/json"
            }
            payload = {
                "prompt": prompt,
                "duration": 4,
                "aspect_ratio": "16:9"
            }

            response = requests.post(url, json=payload, headers=headers, timeout=30)
            if response.status_code == 200:
                result = response.json()
                return {
                    "video_url": result.get("video_url"),
                    "duration": 4,
                    "engine": "pika_free",
                    "quality": "high",
                    "cost": "FREE (with monthly credits)"
                }

            return None
        except Exception as e:
            print(f"Pika error: {e}")
            return None


def generate_free_video(prompt: str, user_id: str, video_type: str = "text-to-video"):
    """
    Generate video COMPLETELY FREE using multiple strategies

    Priority order:
    1. Local AnimateDiff (completely free, no internet needed)
    2. Pika Labs free tier (monthly free credits)
    3. Replicate free tier ($1 free credit/month)
    4. HuggingFace (completely free but slow)
    """

    print(f"\n🎬 Generating FREE video: {prompt}\n")

    # Strategy 1: Try local generation first (most reliable, free)
    print("📍 Method 1: Trying local AnimateDiff (completely free)...")
    result = FreeVideoGenerator.generate_with_local_animatediff(prompt)
    if result:
        print("✅ Success with local AnimateDiff!")
        return {
            "success": True,
            "video_id": f"vid_{user_id}_{int(time.time())}",
            "engine": "local_animatediff",
            "prompt": prompt,
            "video_url": result.get("video_url"),
            "video_path": result.get("video_path"),
            "duration": result.get("duration"),
            "quality": result.get("quality"),
            "cost": result.get("cost"),
            "type": video_type,
            "generated_at": time.time()
        }

    # Strategy 2: Try Pika Labs free tier
    print("📍 Method 2: Trying Pika Labs free tier...")
    result = FreeVideoGenerator.generate_with_pika_free(prompt)
    if result:
        print("✅ Success with Pika Labs!")
        return {
            "success": True,
            "video_id": f"vid_{user_id}_{int(time.time())}",
            "engine": "pika_free",
            "prompt": prompt,
            "video_url": result.get("video_url"),
            "duration": result.get("duration"),
            "quality": result.get("quality"),
            "cost": result.get("cost"),
            "type": video_type,
            "generated_at": time.time()
        }

    # Strategy 3: Try Replicate free tier
    print("📍 Method 3: Trying Replicate free tier...")
    result = FreeVideoGenerator.generate_with_replicate_free(prompt)
    if result:
        print("✅ Success with Replicate!")
        return {
            "success": True,
            "video_id": f"vid_{user_id}_{int(time.time())}",
            "engine": "replicate_free",
            "prompt": prompt,
            "video_url": result.get("video_url"),
            "duration": result.get("duration"),
            "quality": result.get("quality"),
            "cost": result.get("cost"),
            "type": video_type,
            "generated_at": time.time()
        }

    # Strategy 4: Try HuggingFace (slowest but free)
    print("📍 Method 4: Trying HuggingFace (this may take 2-3 minutes)...")
    result = FreeVideoGenerator.generate_with_huggingface_free(prompt)
    if result:
        print("✅ Success with HuggingFace!")
        return {
            "success": True,
            "video_id": f"vid_{user_id}_{int(time.time())}",
            "engine": "huggingface_free",
            "prompt": prompt,
            "video_url": result.get("video_url"),
            "duration": result.get("duration"),
            "quality": result.get("quality"),
            "cost": result.get("cost"),
            "type": video_type,
            "generated_at": time.time()
        }

    # All strategies failed
    print("\n⚠️  No free video generation available")
    return {
        "success": False,
        "error": "All free video generation methods unavailable",
        "available_methods": [
            "Local AnimateDiff (requires setup)",
            "Pika Labs free tier (requires signup)",
            "Replicate free tier (requires $1 credit)",
            "HuggingFace (requires setup)"
        ],
        "recommended": "Install local AnimateDiff - completely free!"
    }


# ── Quick setup helpers ──

def setup_local_animatediff():
    """Install AnimateDiff locally (one-time setup)"""
    print("\n🔧 Setting up local AnimateDiff (completely free)...\n")

    commands = [
        "pip install diffusers transformers torch",
        "pip install imageio imageio-ffmpeg",
        "pip install omegaconf einops"
    ]

    for cmd in commands:
        print(f"Running: {cmd}")
        os.system(cmd)

    print("\n✅ Setup complete! AnimateDiff is ready.")
    print("   First video generation will download ~3GB of models.")
    print("   After that, all videos are generated completely offline!\n")


def setup_replicate_free():
    """Setup free Replicate account (free tier)"""
    print("""
📍 Setup Replicate Free Tier:

1. Go to: https://replicate.com
2. Sign up (free account)
3. Get API token: https://replicate.com/account/api-tokens
4. Set environment variable:

   $env:REPLICATE_API_TOKEN = "your_token_here"

5. Free tier includes: $1 credit/month (enough for ~200 videos!)

Cost after free tier: $0.005 per video (extremely cheap)
""")


def setup_pika_free():
    """Setup free Pika Labs account"""
    print("""
📍 Setup Pika Labs Free Tier:

1. Go to: https://pika.art
2. Sign up for beta access
3. Free tier gives monthly video generation credits
4. Set environment variable:

   $env:PIKA_API_KEY = "your_api_key"

No credit card needed!
""")
