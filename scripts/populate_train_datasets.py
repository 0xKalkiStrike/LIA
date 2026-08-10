import os
import json
import shutil

DATASETS = {
    "image_generation.json": {
        "folder": "Image_Generation",
        "content": {
            "domain": "image_generation",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for AI Image Generation engines (Stable Diffusion, SDXL, Flux.1, Midjourney, DALL-E 3, ComfyUI)",
            "categories": ["prompt_engineering", "style_presets", "negative_prompts", "camera_and_lighting", "comfyui_workflows", "lora_triggers", "model_configs"],
            "training_data": [
                {
                    "id": "img_gen_001",
                    "category": "prompt_engineering",
                    "prompt": "Hyper-realistic futuristic cyberpunk city street at night, neon reflections on wet asphalt, cinematic lighting, 8k resolution, photorealistic",
                    "completion": {
                        "model": "Flux.1-Dev",
                        "parameters": {"steps": 30, "cfg_scale": 7.0, "sampler": "euler_ancestral", "aspect_ratio": "16:9", "width": 1280, "height": 720, "seed": 42918237},
                        "style_tags": ["cyberpunk", "photorealistic", "cinematic", "octane_render", "raytracing"],
                        "negative_prompt": "blurry, low quality, distorted, oversaturated, deformed hands, extra limbs, bad anatomy, text, watermark"
                    }
                },
                {
                    "id": "img_gen_002",
                    "category": "style_presets",
                    "prompt": "Create an anime-style character portrait of a female wizard casting a blue elemental spell",
                    "completion": {
                        "style_preset": "Makoto Shinkai / Studio Ghibli Fusion",
                        "enhanced_prompt": "Masterpiece anime illustration of a young female wizard with silver hair and glowing blue eyes, casting a swirling ice and blue aura spell, vibrant colors, detailed magical runes, dramatic atmospheric depth, artstation trending",
                        "recommended_lora": "anime_vibrant_v2.safetensors",
                        "lora_weight": 0.75
                    }
                },
                {
                    "id": "img_gen_003",
                    "category": "camera_and_lighting",
                    "prompt": "What are the best camera and lighting settings for dramatic portrait photography in image generation prompts?",
                    "completion": {
                        "lens_keywords": ["85mm f/1.4 lens", "shallow depth of field", "bokeh background", "bokeh circles", "sharp focus on eyes"],
                        "lighting_keywords": ["rembrandt lighting", "volumetric lighting", "god rays", "dramatic side lighting", "softbox fill light", "rim light glow"],
                        "composition": ["rule of thirds", "golden ratio", "close-up portrait", "low angle shot"]
                    }
                },
                {
                    "id": "img_gen_004",
                    "category": "comfyui_workflows",
                    "prompt": "Generate a ComfyUI pipeline JSON structure for text-to-image with SDXL base and refiner",
                    "completion": {
                        "workflow_type": "SDXL_Base_Refiner_Cascade",
                        "nodes": [
                            {"id": 1, "type": "KSamplerAdvanced", "title": "Base KSampler", "start_step": 0, "end_step": 20},
                            {"id": 2, "type": "KSamplerAdvanced", "title": "Refiner KSampler", "start_step": 20, "end_step": 30},
                            {"id": 3, "type": "VAEDecode", "title": "VAE Output Decoder"},
                            {"id": 4, "type": "SaveImage", "title": "Export Image"}
                        ]
                    }
                },
                {
                    "id": "img_gen_005",
                    "category": "lora_triggers",
                    "prompt": "List essential LoRA trigger words and categories for realistic character modeling",
                    "completion": {
                        "categories": {
                            "skin_texture": ["micro-skin texture", "pore detail", "subsurface scattering", "natural skin imperfections"],
                            "expression": ["subtle smile", "intense gaze", "thoughtful expression"],
                            "fashion": ["haute couture", "cybernetic suit", "tactical gear", "vintage silk dress"]
                        }
                    }
                }
            ]
        }
    },
    "video_generation.json": {
        "folder": "Video_Generation",
        "content": {
            "domain": "video_generation",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for AI Video Generation, Motion Synthesis, AnimateDiff, Sora, Kling, Runway Gen-2/Gen-3, and Lip Sync",
            "categories": ["text_to_video", "image_to_video", "animatediff_params", "camera_motion_control", "lip_sync_audio", "video_upconversion"],
            "training_data": [
                {
                    "id": "vid_gen_001",
                    "category": "text_to_video",
                    "prompt": "Cinematic slow-motion shot of a futuristic drone navigating through a foggy pine forest at sunrise, 4k 60fps",
                    "completion": {
                        "engine": "AnimateDiff_v3 / HunyuanVideo",
                        "fps": 24,
                        "duration_seconds": 4.0,
                        "motion_bucket_id": 127,
                        "camera_motion": {"pan": "forward_slow", "zoom": "in", "tilt": "slightly_down", "rotation": 0.0},
                        "negative_prompt": "choppy movement, flickering, morphing limbs, static camera, noise artifacts, frame dropping"
                    }
                },
                {
                    "id": "vid_gen_002",
                    "category": "image_to_video",
                    "prompt": "Animate a static image of water cascading down a mountain waterfall with realistic mist effect",
                    "completion": {
                        "method": "Image-to-Video Motion Vector Guided Diffusion",
                        "motion_strength": 0.65,
                        "denoise_strength": 0.70,
                        "masking": "fluid_dynamics_mask",
                        "guidance_scale": 8.5
                    }
                },
                {
                    "id": "vid_gen_003",
                    "category": "camera_motion_control",
                    "prompt": "Explain camera movement parameters for high-end cinematic video generation",
                    "completion": {
                        "camera_moves": {
                            "dolly_zoom": "simultaneous zoom in and backward movement for vertigo effect",
                            "orbit_around": "360-degree smooth rotational camera sweep around target subject",
                            "truck_left_right": "horizontal lateral camera tracking shot",
                            "crane_up": "vertical elevation shot exposing wide landscape"
                        }
                    }
                },
                {
                    "id": "vid_gen_004",
                    "category": "lip_sync_audio",
                    "prompt": "How to configure audio-driven avatar lip sync for video generation using SadTalker or Wav2Lip",
                    "completion": {
                        "pipeline": "Wav2Lip_GAN / SadTalker_v0.0.2",
                        "audio_sample_rate": 16000,
                        "face_detector": "retinaface",
                        "expression_scale": 1.1,
                        "pose_style": 0,
                        "post_processing": ["GFPGAN_face_enhancer", "codeformer_restoration"]
                    }
                },
                {
                    "id": "vid_gen_005",
                    "category": "video_upconversion",
                    "prompt": "Workflow for taking a 512x512 low fps video and upscaling it to 4K 60fps smooth video",
                    "completion": {
                        "steps": [
                            "Step 1: Frame interpolation using RIFE / Real-CSI to increase framerate from 15fps to 60fps",
                            "Step 2: Spatial AI upscaling using Real-ESRGAN / SeedVR to 4K resolution",
                            "Step 3: Temporal smoothing filter to eliminate inter-frame flicker",
                            "Step 4: H.265 / AV1 encoding with CRF 18"
                        ]
                    }
                }
            ]
        }
    },
    "development.json": {
        "folder": "Development",
        "content": {
            "domain": "development",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Full-Stack Development, Software Architecture, Code Generation, Refactoring, and DevOps",
            "categories": ["backend_python", "frontend_typescript", "database_architecture", "async_concurrency", "clean_architecture", "devops_docker"],
            "training_data": [
                {
                    "id": "dev_001",
                    "category": "backend_python",
                    "prompt": "Create an asynchronous FastAPI backend service with JWT authentication and Pydantic v2 schemas",
                    "completion": {
                        "architecture": "FastAPI Async Router Pattern",
                        "code_snippet": "from fastapi import FastAPI, Depends, HTTPException, status\nfrom fastapi.security import OAuth2PasswordBearer\nfrom pydantic import BaseModel, EmailStr\nimport jwt\n\napp = FastAPI(title='LIA Enterprise API', version='1.0.0')\n\nclass UserRegister(BaseModel):\n    username: str\n    email: EmailStr\n    password: str\n\n@app.post('/api/v1/auth/register', status_code=status.HTTP_201_CREATED)\nasync def register_user(user: UserRegister):\n    return {'status': 'success', 'user': user.username}"
                    }
                },
                {
                    "id": "dev_002",
                    "category": "frontend_typescript",
                    "prompt": "How to structure a Next.js App Router project with Tailwind CSS and Zustand state management",
                    "completion": {
                        "directory_layout": {
                            "src/app": ["page.tsx", "layout.tsx", "providers.tsx", "globals.css"],
                            "src/components": ["ui/Button.tsx", "ui/Modal.tsx", "chat/ChatBox.tsx"],
                            "src/store": ["useChatStore.ts", "useAuthStore.ts"],
                            "src/lib": ["apiClient.ts", "utils.ts"]
                        },
                        "state_management_pattern": "Zustand slices with persist middleware"
                    }
                },
                {
                    "id": "dev_003",
                    "category": "database_architecture",
                    "prompt": "Design an optimized PostgreSQL schema for a multi-tenant chat application with vector search capabilities",
                    "completion": {
                        "extensions": ["pgvector", "uuid-ossp"],
                        "schema_sql": "CREATE EXTENSION IF NOT EXISTS vector;\nCREATE TABLE users (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  email VARCHAR(255) UNIQUE NOT NULL,\n  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP\n);\nCREATE TABLE embeddings (\n  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),\n  user_id UUID REFERENCES users(id) ON DELETE CASCADE,\n  content TEXT NOT NULL,\n  embedding vector(1536)\n);\nCREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);"
                    }
                },
                {
                    "id": "dev_004",
                    "category": "devops_docker",
                    "prompt": "Write a multi-stage Dockerfile for a Python FastAPI application with UV package manager",
                    "completion": {
                        "dockerfile": "FROM python:3.11-slim as builder\nWORKDIR /app\nRUN pip install uv\nCOPY requirements.txt .\nRUN uv pip install --system --no-cache -r requirements.txt\n\nFROM python:3.11-slim as runner\nWORKDIR /app\nCOPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages\nCOPY . .\nEXPOSE 8000\nCMD [\"python\", \"run.py\"]"
                    }
                }
            ]
        }
    },
    "data_scraping.json": {
        "folder": "Data_Scraping",
        "content": {
            "domain": "data_scraping",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Web Scraping, Automated Data Extraction, Headless Browsing, Anti-Bot Evasion, and Proxy Management",
            "categories": ["playwright_async", "beautifulsoup_parsing", "anti_bot_evasion", "proxy_rotation", "structured_data_extraction"],
            "training_data": [
                {
                    "id": "scrape_001",
                    "category": "playwright_async",
                    "prompt": "Write an asynchronous Python Playwright scraper to extract product details from dynamic e-commerce web pages",
                    "completion": {
                        "framework": "Playwright Python Async",
                        "code_snippet": "import asyncio\nfrom playwright.async_api import async_playwright\n\nasync def scrape_products(url):\n    async with async_playwright() as p:\n        browser = await p.chromium.launch(headless=True)\n        page = await browser.new_page()\n        await page.goto(url, wait_until='networkidle')\n        products = []\n        elements = await page.query_selector_all('.product-card')\n        for el in elements:\n            title = await el.query_selector_eval('.title', 'e => e.innerText')\n            price = await el.query_selector_eval('.price', 'e => e.innerText')\n            products.append({'title': title.strip(), 'price': price.strip()})\n        await browser.close()\n        return products"
                    }
                },
                {
                    "id": "scrape_002",
                    "category": "anti_bot_evasion",
                    "prompt": "How to bypass Cloudflare, Akamai, and Bot Detection mechanisms during automated web scraping?",
                    "completion": {
                        "techniques": [
                            "Use Playwright-stealth / Undetected-Chromium drivers to mask navigator.webdriver flags",
                            "Rotate User-Agent strings with realistic browser fingerprint parameters (Sec-CH-UA, Accept-Language)",
                            "Implement residential proxy pools with automatic IP rotation per request batch",
                            "Add human-like randomized interaction delays (mouse jitter, smooth scroll, random pause)",
                            "Bypass Cloudflare turnstile using browser subagents or automated solver APIs"
                        ]
                    }
                },
                {
                    "id": "scrape_003",
                    "category": "structured_data_extraction",
                    "prompt": "Extract JSON-LD and microdata schemas from web pages using BeautifulSoup and extruct",
                    "completion": {
                        "parser": "BeautifulSoup4 + extruct",
                        "code_snippet": "from bs4 import BeautifulSoup\nimport json\n\ndef parse_json_ld(html_content):\n    soup = BeautifulSoup(html_content, 'html.parser')\n    scripts = soup.find_all('script', type='application/ld+json')\n    extracted = []\n    for s in scripts:\n        try:\n            data = json.loads(s.string)\n            extracted.append(data)\n        except Exception:\n            continue\n    return extracted"
                    }
                }
            ]
        }
    },
    "data_analysis.json": {
        "folder": "Data_Analysis",
        "content": {
            "domain": "data_analysis",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Data Science, Exploratory Data Analysis (EDA), Statistical Analytics, Pandas DataFrames, and ML Models",
            "categories": ["exploratory_data_analysis", "pandas_data_wrangling", "statistical_testing", "machine_learning_pipeline", "visualization_charts"],
            "training_data": [
                {
                    "id": "analysis_001",
                    "category": "exploratory_data_analysis",
                    "prompt": "Provide a complete Python automated Exploratory Data Analysis (EDA) script using Pandas and Seaborn",
                    "completion": {
                        "libraries": ["pandas", "numpy", "seaborn", "matplotlib.pyplot"],
                        "code_snippet": "import pandas as pd\nimport numpy as np\nimport seaborn as sns\nimport matplotlib.pyplot as plt\n\ndef perform_eda(df):\n    summary = {\n        'shape': df.shape,\n        'missing_values': df.isnull().sum().to_dict(),\n        'data_types': df.dtypes.astype(str).to_dict(),\n        'numeric_stats': df.describe().to_dict()\n    }\n    numeric_df = df.select_dtypes(include=[np.number])\n    corr_matrix = numeric_df.corr()\n    return summary, corr_matrix"
                    }
                },
                {
                    "id": "analysis_002",
                    "category": "statistical_testing",
                    "prompt": "How to execute A/B test hypothesis testing using SciPy stats (t-test and Chi-square test)",
                    "completion": {
                        "methodology": "Two-sample independent t-test for continuous metrics, Chi-square for conversion rates",
                        "code_snippet": "from scipy import stats\n\ndef evaluate_ab_test(control_group, treatment_group, alpha=0.05):\n    t_stat, p_val = stats.ttest_ind(control_group, treatment_group)\n    significant = p_val < alpha\n    return {'t_statistic': t_stat, 'p_value': p_val, 'statistically_significant': significant}"
                    }
                },
                {
                    "id": "analysis_003",
                    "category": "machine_learning_pipeline",
                    "prompt": "Build an end-to-end XGBoost classification pipeline with hyperparameter tuning and cross-validation",
                    "completion": {
                        "pipeline": "Scikit-Learn Pipeline + XGBClassifier + GridSearchCV",
                        "steps": [
                            "1. SimpleImputer for handling missing numeric values",
                            "2. OneHotEncoder / TargetEncoder for categorical features",
                            "3. StandardScaler for feature normalization",
                            "4. XGBClassifier with binary:logistic objective",
                            "5. 5-Fold Stratified K-Fold Cross Validation",
                            "6. Evaluation via ROC-AUC score and confusion matrix"
                        ]
                    }
                }
            ]
        }
    },
    "article.json": {
        "folder": "Article",
        "content": {
            "domain": "article",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Long-Form Article Generation, SEO Content Writing, Copywriting Frameworks, and Editorial Publishing",
            "categories": ["long_form_articles", "seo_optimization", "copywriting_frameworks", "headline_generation", "editorial_review"],
            "training_data": [
                {
                    "id": "art_001",
                    "category": "long_form_articles",
                    "prompt": "Generate a high-authority technical article outline and content strategy on Artificial Intelligence and Autonomous Agents",
                    "completion": {
                        "title": "The Evolution of Autonomous AI Agents: From Reactive Models to Goal-Driven Systems",
                        "structure": [
                            {"section": "Introduction", "focus": "Hook reader, define AI agents vs static LLMs, set thesis"},
                            {"section": "Core Architecture", "focus": "Reasoning loops, planning engines, memory vector stores, tool execution"},
                            {"section": "Real-World Applications", "focus": "Code assistance, automated research, device control, video synthesis"},
                            {"section": "Challenges & Security", "focus": "Hallucination mitigation, prompt injection defense, sandbox safety"},
                            {"section": "Conclusion", "focus": "Summary of future trajectory and strategic implications"}
                        ],
                        "target_word_count": 2500,
                        "reading_grade_level": "College / Professional"
                    }
                },
                {
                    "id": "art_002",
                    "category": "seo_optimization",
                    "prompt": "What are the key SEO optimization directives for technical blog articles?",
                    "completion": {
                        "seo_directives": {
                            "primary_keyword_density": "1.5% to 2.5% natural inclusion",
                            "h1_title": "Includes primary keyword within first 60 characters",
                            "meta_description": "150-160 characters with compelling call to action and keyword",
                            "subheadings": "H2 and H3 tags containing LSI keywords",
                            "internal_linking": "Minimum 3-5 relevant contextual internal hyperlinks",
                            "readability": "Short paragraphs (2-4 sentences max), bullet points, and high scannability"
                        }
                    }
                },
                {
                    "id": "art_003",
                    "category": "copywriting_frameworks",
                    "prompt": "Demonstrate the PAS (Problem-Agitate-Solve) and AIDA (Attention-Interest-Desire-Action) copywriting frameworks",
                    "completion": {
                        "pas_framework": {
                            "problem": "Manual data extraction takes hours of tedious copy-pasting every day.",
                            "agitate": "Errors slip into your reports, deadlines get missed, and your team burns out on repetitive grunt work.",
                            "solve": "LIA Automated Scraping & Analysis Agent automates end-to-end data workflows in seconds with 99.9% accuracy."
                        },
                        "aida_framework": {
                            "attention": "Stop Wasting Time on Manual Content Generation!",
                            "interest": "AI-powered agents can write, design, and analyze 10x faster than traditional methods.",
                            "desire": "Imagine generating complete, polished presentations and articles in under 30 seconds.",
                            "action": "Deploy LIA AI today and transform your workflow."
                        }
                    }
                }
            ]
        }
    },
    "presentation.json": {
        "folder": "Presentation",
        "content": {
            "domain": "presentation",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Presentation Deck Generation, Slide Layout Design, python-pptx Automation, and Pitch Decks",
            "categories": ["slide_deck_templates", "python_pptx_automation", "pitch_deck_structure", "visual_design_palettes", "speaker_notes_generation"],
            "training_data": [
                {
                    "id": "pres_001",
                    "category": "slide_deck_templates",
                    "prompt": "Create a 10-slide executive presentation outline for a corporate AI Strategy launch",
                    "completion": {
                        "presentation_title": "Enterprise AI Transformation Strategy 2026",
                        "theme": "Modern Dark Glassmorphism / Cyber Teal Accent",
                        "slides": [
                            {"slide_number": 1, "layout": "Title Slide", "headline": "Enterprise AI Transformation Strategy"},
                            {"slide_number": 2, "layout": "Executive Summary", "headline": "Strategic Vision & Goals"},
                            {"slide_number": 3, "layout": "Market Analysis", "headline": "The AI Imperative"},
                            {"slide_number": 4, "layout": "Architecture Blueprint", "headline": "LIA Multi-Agent Ecosystem"},
                            {"slide_number": 5, "layout": "Implementation Roadmap", "headline": "4-Phase Rollout Plan"},
                            {"slide_number": 6, "layout": "ROI & Impact", "headline": "Expected Business Outcomes"},
                            {"slide_number": 7, "layout": "Risk & Security", "headline": "Governance & Safety"},
                            {"slide_number": 8, "layout": "Team & Resources", "headline": "Core Execution Team"},
                            {"slide_number": 9, "layout": "Financial Budget", "headline": "Resource Allocation"},
                            {"slide_number": 10, "layout": "Call to Action", "headline": "Next Steps & Discussion"}
                        ]
                    }
                },
                {
                    "id": "pres_002",
                    "category": "python_pptx_automation",
                    "prompt": "Write a Python script using `python-pptx` to programmatically build custom formatted PowerPoint slides",
                    "completion": {
                        "library": "python-pptx",
                        "code_snippet": "from pptx import Presentation\nfrom pptx.util import Inches, Pt\nfrom pptx.dml.color import RGBColor\n\ndef generate_deck(title_text, subtitle_text, output_path='presentation.pptx'):\n    prs = Presentation()\n    prs.slide_width = Inches(13.333)\n    prs.slide_height = Inches(7.5)\n    slide = prs.slides.add_slide(prs.slide_layouts[6])\n    tx_box = slide.shapes.add_textbox(Inches(1.0), Inches(2.0), Inches(11.333), Inches(2.0))\n    tf = tx_box.text_frame\n    p = tf.paragraphs[0]\n    p.text = title_text\n    p.font.size = Pt(44)\n    p.font.bold = True\n    p.font.color.rgb = RGBColor(15, 23, 42)\n    prs.save(output_path)\n    return output_path"
                    }
                }
            ]
        }
    },
    "research.json": {
        "folder": "Research",
        "content": {
            "domain": "research",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Academic Research Synthesis, Literature Review, Citation Analysis, and Scientific Reasoning",
            "categories": ["literature_synthesis", "arxiv_pubmed_queries", "citation_bibtex_parsing", "hypothesis_formulation", "peer_review_critique"],
            "training_data": [
                {
                    "id": "res_001",
                    "category": "literature_synthesis",
                    "prompt": "Synthesize key scientific literature on Retrieval-Augmented Generation (RAG) vs Long-Context Window LLMs",
                    "completion": {
                        "topic": "RAG vs Long-Context Windows in LLMs",
                        "synthesis": "While extreme long-context windows allow processing full books or codebases in a single prompt, RAG architectures remain superior in cost efficiency, dynamic knowledge updating, precise source attribution, and latency reduction.",
                        "key_citations": [
                            {"author": "Lewis et al.", "year": 2020, "title": "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks"},
                            {"author": "Gao et al.", "year": 2023, "title": "Retrieval-Augmented Generation for Large Language Models: A Survey"}
                        ]
                    }
                },
                {
                    "id": "res_002",
                    "category": "arxiv_pubmed_queries",
                    "prompt": "How to construct precise boolean search queries for arXiv and PubMed APIs",
                    "completion": {
                        "arxiv_query": "cat:q-bio.BM OR cat:cs.AI AND ti:\"AlphaFold\" OR abs:\"protein structure prediction\"",
                        "pubmed_eutilities_query": "((\"artificial intelligence\"[MeSH Terms] OR \"deep learning\"[All Fields]) AND (\"drug discovery\"[All Fields]))"
                    }
                },
                {
                    "id": "res_003",
                    "category": "citation_bibtex_parsing",
                    "prompt": "Provide standard BibTeX entry parsing and generation rules for scientific publishing",
                    "completion": {
                        "bibtex_template": "@article{lia_agent_2026,\n  author = {LIA AI Research Group},\n  title = {Universal Multi-Agent System for Autonomous Task Execution},\n  journal = {Journal of Artificial Intelligence Research},\n  year = {2026}\n}"
                    }
                }
            ]
        }
    },
    "voice_speech.json": {
        "folder": "Voice_Speech",
        "content": {
            "domain": "voice_speech",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Speech-to-Text (STT), Text-to-Speech (TTS), Voice Cloning, Piper Audio Engine, and Phonetic Processing",
            "categories": ["piper_tts_config", "whisper_stt", "voice_cloning_coqui", "ssml_phonetics", "audio_feature_extraction"],
            "training_data": [
                {
                    "id": "voice_001",
                    "category": "piper_tts_config",
                    "prompt": "Configure Piper TTS for fast local speech generation with high clarity ONNX voice models",
                    "completion": {
                        "engine": "Piper ONNX C++ / Python",
                        "voice_model": "en_US-lessac-high.onnx",
                        "parameters": {"length_scale": 1.0, "noise_scale": 0.667, "noise_w": 0.8, "sample_rate": 22050, "output_format": "wav_pcm_16bit"}
                    }
                },
                {
                    "id": "voice_002",
                    "category": "whisper_stt",
                    "prompt": "How to run faster-whisper locally with GPU acceleration for real-time speech-to-text",
                    "completion": {
                        "library": "faster-whisper (CTranslate2)",
                        "code_snippet": "from faster_whisper import WhisperModel\nmodel = WhisperModel('medium.en', device='cuda', compute_type='float16')\nsegments, info = model.transcribe('audio.wav', beam_size=5, vad_filter=True)"
                    }
                },
                {
                    "id": "voice_003",
                    "category": "voice_cloning_coqui",
                    "prompt": "Voice cloning training setup parameters using XTTS-v2",
                    "completion": {
                        "model": "XTTS-v2 Coqui",
                        "requirements": {"sample_audio_length": "6 to 10 seconds", "audio_format": "22050Hz Mono WAV", "temperature": 0.75}
                    }
                }
            ]
        }
    },
    "vision_multimodal.json": {
        "folder": "Vision_Multimodal",
        "content": {
            "domain": "vision_multimodal",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Vision Language Models (VLM), Object Detection (YOLOv8), OCR (Tesseract/EasyOCR), and Visual QA",
            "categories": ["yolo_object_detection", "ocr_text_extraction", "vlm_prompting", "spatial_bounding_box"],
            "training_data": [
                {
                    "id": "vis_001",
                    "category": "yolo_object_detection",
                    "prompt": "Configure YOLOv8 for real-time webcam object detection and tracking in Python",
                    "completion": {
                        "framework": "Ultralytics YOLOv8",
                        "code_snippet": "from ultralytics import YOLO\nmodel = YOLO('yolov8n.pt')\nresults = model.track(source=0, show=True, tracker='bytetrack.yaml')"
                    }
                },
                {
                    "id": "vis_002",
                    "category": "ocr_text_extraction",
                    "prompt": "Image preprocessing techniques to boost OCR accuracy using OpenCV and Tesseract",
                    "completion": {
                        "preprocessing_pipeline": ["1. Convert to grayscale", "2. GaussianBlur", "3. Otsu thresholding", "4. Deskew", "5. Run Tesseract PSM 6"]
                    }
                },
                {
                    "id": "vis_003",
                    "category": "vlm_prompting",
                    "prompt": "How to structure multimodal prompt requests for VLM models",
                    "completion": {
                        "prompt_format": {"system_instruction": "Identify all text elements and UI components in screenshot.", "image_input": "base64"}
                    }
                }
            ]
        }
    },
    "automation_control.json": {
        "folder": "Automation_Control",
        "content": {
            "domain": "automation_control",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for System Automation, PowerShell/Bash Scripting, PyAutoGUI Desktop Control, and n8n Workflows",
            "categories": ["powershell_windows_admin", "pyautogui_desktop_control", "n8n_workflow_integration", "system_health_monitoring"],
            "training_data": [
                {
                    "id": "auto_001",
                    "category": "powershell_windows_admin",
                    "prompt": "Write a PowerShell script to audit running processes and RAM usage",
                    "completion": {
                        "script": "Get-Process | Sort-Object WorkingSet64 -Descending | Select-Object -First 10 ProcessName, ID"
                    }
                },
                {
                    "id": "auto_002",
                    "category": "pyautogui_desktop_control",
                    "prompt": "How to safely perform GUI automation using PyAutoGUI",
                    "completion": {
                        "failsafe_config": "import pyautogui\npyautogui.FAILSAFE = True"
                    }
                },
                {
                    "id": "auto_003",
                    "category": "n8n_workflow_integration",
                    "prompt": "Blueprint for an n8n webhook automation triggering AI task execution",
                    "completion": {
                        "nodes": [{"name": "Webhook Trigger", "type": "n8n-nodes-base.webhook"}]
                    }
                }
            ]
        }
    },
    "memory_reasoning.json": {
        "folder": "Memory_Reasoning",
        "content": {
            "domain": "memory_reasoning",
            "version": "1.0.0",
            "description": "Comprehensive training dataset for Semantic Memory Management, Vector Search (ChromaDB), Chain-of-Thought Reasoning, and Self-Reflection",
            "categories": ["chromadb_vector_store", "chain_of_thought_prompting", "episodic_memory_recall", "agent_self_reflection"],
            "training_data": [
                {
                    "id": "mem_001",
                    "category": "chromadb_vector_store",
                    "prompt": "How to query ChromaDB for semantic similarity search with metadata filtering in Python",
                    "completion": {
                        "code_snippet": "import chromadb\nclient = chromadb.PersistentClient(path='./data/chroma')\ncollection = client.get_or_create_collection('lia_memory')\nresults = collection.query(query_texts=['AnimateDiff video generation'], n_results=5)"
                    }
                },
                {
                    "id": "mem_002",
                    "category": "chain_of_thought_prompting",
                    "prompt": "Provide a standard Chain-of-Thought (CoT) reasoning template",
                    "completion": {
                        "cot_template": ["1. Understand goal", "2. Deconstruct sub-tasks", "3. Identify constraints", "4. Execute step-by-step", "5. Validate"]
                    }
                },
                {
                    "id": "mem_003",
                    "category": "agent_self_reflection",
                    "prompt": "Define the self-reflection loop mechanism for AI agents upon encountering runtime execution errors",
                    "completion": {
                        "reflection_loop": ["Capture error", "Identify root cause", "Formulate targeted remedy", "Re-run verification"]
                    }
                }
            ]
        }
    }
}

MASTER_INDEX = {
    "project": "LIA AI - Local Intelligence Assistant",
    "version": "2.0.0",
    "environment": "Train_Master_Hub",
    "description": "Master Index and Training Configuration for LIA Multi-Domain Autonomous Artificial Intelligence",
    "datasets": [
        {"domain": fname.replace(".json", ""), "file": f"{data['folder']}/{fname}", "priority": 1, "description": data["content"]["description"]}
        for fname, data in DATASETS.items()
    ]
}

def populate():
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    bases = [os.path.join(project_root, "Train"), "C:\\Train"]

    for base in bases:
        # Write LIA master index and all json files in Train/LIA/
        lia_dir = os.path.join(base, "LIA")
        os.makedirs(lia_dir, exist_ok=True)
        with open(os.path.join(lia_dir, "master_training_index.json"), "w", encoding="utf-8") as f:
            json.dump(MASTER_INDEX, f, indent=2)

        for filename, info in DATASETS.items():
            # Write to Train/LIA/ filename
            with open(os.path.join(lia_dir, filename), "w", encoding="utf-8") as f:
                json.dump(info["content"], f, indent=2)

            # Write to Train/DomainFolder/ filename
            domain_folder = os.path.join(base, info["folder"])
            os.makedirs(domain_folder, exist_ok=True)
            with open(os.path.join(domain_folder, filename), "w", encoding="utf-8") as f:
                json.dump(info["content"], f, indent=2)

    print("Successfully populated all Train domain subfolders and Train/LIA dataset files!")

if __name__ == "__main__":
    populate()
