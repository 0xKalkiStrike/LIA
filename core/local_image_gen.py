"""Local Stable Diffusion image generation — no cloud API, no API key.

Loads stable-diffusion-v1-5 (fully open, ungated on Hugging Face — no
account/token required) once and keeps it resident on the GPU for reuse.
Designed for 4GB-class VRAM (e.g. GTX 1650): fp16 weights + attention
slicing, 512x512 native resolution, a fast multistep scheduler so ~20 steps
is enough instead of the default 50.
"""
import threading

_PIPE = None
_LOCK = threading.Lock()
_LOAD_ERROR: str | None = None

MODEL_ID = "stable-diffusion-v1-5/stable-diffusion-v1-5"


def _load_pipeline():
    global _PIPE, _LOAD_ERROR
    import torch
    from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler

    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.float32

    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=dtype,
        safety_checker=None,  # avoid loading the (heavy, separate) NSFW classifier model
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    if device == "cuda":
        pipe.enable_attention_slicing()
    _PIPE = pipe


def get_pipeline():
    """Lazily load the pipeline on first use (first call will be slow — model
    download + load to GPU). Thread-safe. Raises on failure so callers can
    surface a real error instead of faking success."""
    global _PIPE, _LOAD_ERROR
    if _PIPE is not None:
        return _PIPE
    if _LOAD_ERROR is not None:
        raise RuntimeError(_LOAD_ERROR)
    with _LOCK:
        if _PIPE is None and _LOAD_ERROR is None:
            try:
                _load_pipeline()
            except Exception as e:
                _LOAD_ERROR = f"Failed to load local Stable Diffusion pipeline: {e}"
                raise RuntimeError(_LOAD_ERROR)
    return _PIPE


def generate_image(prompt: str, steps: int = 20, guidance_scale: float = 7.5, seed: int | None = None):
    """Generate a single 512x512 PIL image locally. Raises on failure."""
    import torch

    pipe = get_pipeline()
    generator = None
    if seed is not None:
        device = "cuda" if torch.cuda.is_available() else "cpu"
        generator = torch.Generator(device=device).manual_seed(seed)

    result = pipe(
        prompt=prompt,
        num_inference_steps=steps,
        guidance_scale=guidance_scale,
        generator=generator,
    )
    return result.images[0]
