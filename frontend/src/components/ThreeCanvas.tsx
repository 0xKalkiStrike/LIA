"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as VRM from "@pixiv/three-vrm";

interface ThreeCanvasProps {
  profile: any;
  emotion?: string;
  viseme?: string;
  isSpeaking?: boolean;
  spokenText?: string;
  asleep?: boolean;
  onTelemetry?: (event: string) => void;
}

const ACCENT_HEX: Record<string, number> = {
  cyan: 0x53d7f0,
  gold: 0xe8b44a,
  crimson: 0xf2647c,
  violet: 0x9d7bf0,
  rose: 0xff8fb1,
};

const SKIN_HEX: Record<string, number> = {
  porcelain: 0xfff0e6,
  fair: 0xffe0d0,
  tan: 0xd2a688,
  brown: 0x9c7251,
  deep: 0x5c3d24,
};

const EYE_HEX: Record<string, number> = {
  amber: 0xd88813,
  emerald: 0x22c55e,
  sapphire: 0x2563eb,
  violet: 0x8b5cf6,
  rose: 0xec4899,
  crimson: 0xd97706,
};

const HAIR_HEX: Record<string, number> = {
  black: 0x1e1b18,
  brown: 0x5c4033,
  blonde: 0xfef08a,
  pink: 0xf472b6,
  blue: 0x3b82f6,
  violet: 0xa78bfa,
  white: 0xf9fafb,
};

const EXPR = {
  happy: ["happy", "joy", "Joy", "smile"],
  smile: ["smile", "happy"],
  sad: ["sad", "sorrow", "Sorrow"],
  angry: ["angry", "Angry"],
  surprised: ["surprised", "Surprised"],
  relaxed: ["relaxed", "neutral", "Neutral"],
  neutral: ["neutral", "Neutral"],
  blink: ["blink", "Blink", "blinkLeft", "blinkRight"],
  blinkL: ["blinkLeft", "Blink_L", "blink"],
  blinkR: ["blinkRight", "Blink_R", "blink"],
  aa: ["aa", "A", "vowel_A"],
  ee: ["ee", "e", "E", "vowel_E"],
  ih: ["ih", "i", "I", "vowel_I"],
  oh: ["oh", "o", "O", "vowel_O"],
  ou: ["ou", "u", "U", "vowel_U"],
};

// ── Enhanced Viseme sequence for natural speech ──
// Varied timing based on phoneme frequency and natural speech patterns
const VISEME_PATTERNS = [
  { viseme: "aa", duration: 100, intensity: 0.8 },  // "ah" sound
  { viseme: "ee", duration: 110, intensity: 0.75 }, // "ee" sound
  { viseme: "ih", duration: 95, intensity: 0.6 },   // "ih" sound
  { viseme: "oh", duration: 120, intensity: 0.7 },  // "oh" sound
  { viseme: "ou", duration: 105, intensity: 0.65 }, // "oo" sound
  { viseme: "aa", duration: 100, intensity: 0.8 },
  { viseme: "oh", duration: 115, intensity: 0.7 },
  { viseme: "ee", duration: 110, intensity: 0.75 },
  { viseme: "ih", duration: 90, intensity: 0.6 },
  { viseme: "aa", duration: 110, intensity: 0.85 },
] as const;

// ── Advanced Gesture Set with emotional context ──
const GESTURE_LIBRARY = {
  emphasis: [
    { rightUpperZ: 0.2, rightUpperX: -0.6, rightLowerZ: 0.1, rightLowerX: -0.5, rightHandZ: -0.15, leftUpperZ: -0.25, leftUpperX: -0.4 },
    { rightUpperZ: 0.35, rightUpperX: -0.4, rightLowerZ: 0.25, rightLowerX: -0.2, rightHandZ: 0.05, leftUpperZ: -0.65, leftUpperX: -0.2 },
  ],
  questioning: [
    { rightUpperZ: 0.4, rightUpperX: -0.3, rightLowerZ: 0.3, rightLowerX: 0.0, rightHandZ: 0.1, leftUpperZ: -0.65, leftUpperX: 0.0 },
    { rightUpperZ: 0.45, rightUpperX: -0.25, rightLowerZ: 0.25, rightLowerX: 0.05, rightHandZ: 0.15, leftUpperZ: -0.6, leftUpperX: 0.05 },
  ],
  presenting: [
    { rightUpperZ: 0.5, rightUpperX: -0.2, rightLowerZ: 0.25, rightLowerX: -0.15, rightHandZ: 0.05, leftUpperZ: -0.5, leftUpperX: -0.3 },
    { rightUpperZ: 0.3, rightUpperX: -0.4, rightLowerZ: 0.15, rightLowerX: -0.35, rightHandZ: 0.0, leftUpperZ: -0.55, leftUpperX: -0.35 },
  ],
};

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  profile,
  emotion = "neutral",
  viseme = "rest",
  isSpeaking = false,
  spokenText = "",
  asleep = false,
  onTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const fallbackRef = useRef<any>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  // Track speaking state changes without re-creating the entire scene
  const speakingRef = useRef(false);
  const visemeRef = useRef(viseme);

  // Update refs when props change (avoids re-mounting the 3D scene)
  useEffect(() => {
    speakingRef.current = isSpeaking || viseme === "A";
    visemeRef.current = viseme;
  }, [isSpeaking, viseme]);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    
    // Size setup
    const W = container.clientWidth || 400;
    const H = container.clientHeight || 500;
    
    // Scene & Canvas
    const canvas = document.createElement("canvas");
    container.appendChild(canvas);
    
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e111a);
    
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.set(0, 1.45, 1.6);
    camera.lookAt(0, 1.4, 0);

    // Gaze targets
    const mouse = new THREE.Vector2();
    const gazeTarget = new THREE.Vector3(0, 1.4, 1);
    
    // Lighting
    const accentColor = ACCENT_HEX[profile?.char_outfit] || ACCENT_HEX.cyan;
    
    const ambientLight = new THREE.AmbientLight(0xffffff, 2.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    keyLight.position.set(1.0, 3.0, 3.0);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(accentColor, 1.5);
    rimLight.position.set(-2.0, 2.0, -1.0);
    scene.add(rimLight);

    const fillLight = new THREE.DirectionalLight(0x334466, 0.6);
    fillLight.position.set(0, -1.0, 2.0);
    scene.add(fillLight);
    
    // VRM Loader
    const loader = new GLTFLoader();
    if (VRM.VRMLoaderPlugin) {
      loader.register((parser) => new VRM.VRMLoaderPlugin(parser));
    }
    
    const modelPath = profile?.vrm_path || "/LIA.vrm";
    
    if (profile?.avatar_type !== "male") {
      loader.load(
        modelPath,
        async (gltf) => {
          let vrm = gltf.userData.vrm;
          if (!vrm && (VRM as any).VRM && (VRM as any).VRM.from) {
            try {
              vrm = await (VRM as any).VRM.from(gltf);
            } catch (e) {}
          }
          
          if (!vrm) {
            fallbackRef.current = buildProceduralAvatar(scene, profile);
            return;
          }
          
          vrmRef.current = vrm;
          scene.add(vrm.scene);
          
          vrm.scene.rotation.y = 0;
          vrm.scene.position.set(0, 0, 0);
          vrm.scene.scale.setScalar(1.0);
          
          // Tune materials and apply dynamic customizations
          const hairColor = HAIR_HEX[profile?.char_hair_color] || HAIR_HEX.black;
          const skinColor = SKIN_HEX[profile?.char_skin] || SKIN_HEX.fair;
          const eyeColor = EYE_HEX[profile?.char_eyes] || EYE_HEX.sapphire;
          const outfitColor = ACCENT_HEX[profile?.char_outfit] || ACCENT_HEX.cyan;

          vrm.scene.traverse((obj: any) => {
            if (obj.isMesh) {
              const name = obj.name.toLowerCase();
              const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
              mats.forEach((mat: any) => {
                if (!mat) return;
                if (mat.isMToonMaterial) {
                  mat.shadingShiftFactor = 0.5;
                  mat.shadingToonyFactor = 0.95;
                }
                if (mat.map) mat.map.colorSpace = THREE.SRGBColorSpace;

                const matName = (mat.name || "").toLowerCase();
                
                if (name.includes("hair") || matName.includes("hair")) {
                  if (mat.color) mat.color.setHex(hairColor);
                } else if (name.includes("eye") || name.includes("iris") || matName.includes("eye") || matName.includes("iris")) {
                  if (mat.color) mat.color.setHex(eyeColor);
                } else if (name.includes("skin") || name.includes("face") || name.includes("body") || matName.includes("skin") || matName.includes("face")) {
                  if (mat.color) mat.color.setHex(skinColor);
                } else if (name.includes("cloth") || name.includes("outfit") || name.includes("wear") || name.includes("jacket") || name.includes("suit") || name.includes("shirt") || matName.includes("cloth") || matName.includes("suit")) {
                  if (mat.color) mat.color.setHex(outfitColor);
                }

                mat.needsUpdate = true;
              });
            }
          });
          
          applyIdlePose(vrm);
        },
        undefined,
        (err) => {
          console.warn("VRM load failed. Using procedural avatar fallback.", err);
          fallbackRef.current = buildProceduralAvatar(scene, profile);
        }
      );
    } else {
      fallbackRef.current = buildProceduralAvatar(scene, profile);
    }

    const applyIdlePose = (vrm: any) => {
      const setRot = (boneName: string, x: number, y: number, z: number) => {
        const b = getBone(vrm, boneName);
        if (b) b.rotation.set(x, y, z);
      };
      
      setRot("leftUpperArm", 0, 0, -0.65);
      setRot("rightUpperArm", 0, 0, 0.65);
      setRot("leftLowerArm", 0, 0, -0.15);
      setRot("rightLowerArm", 0, 0, 0.15);
      setRot("spine", 0.03, 0, 0);
    };

    // ── Animation state ──
    let blinkTimer = 0;
    let nextBlinkFrame = 200;
    let currentBlink = 0;

    // Head tilt variation
    let headTiltTarget = 0;
    let headTiltTimer = 0;
    let headTiltInterval = 300 + Math.random() * 400;
    let headNodding = false;
    let headNodTimer = 0;

    // Eye look-around variation with more sophistication
    let eyeLookTimer = 0;
    let eyeLookInterval = 400 + Math.random() * 600;
    let eyeLookTargetX = 0;
    let eyeLookTargetY = 0;
    let eyeSquint = 0; // for emotion-driven squinting

    // Smile tracking
    let smileFactor = 0;
    let targetSmileFactor = 0;

    // Viseme cycling state for speech
    let visemeCycleIndex = 0;
    let visemeCycleTimer = 0;
    let currentVisemeWeights: Record<string, number> = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
    let targetVisemeWeights: Record<string, number> = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
    let mouthOpen = 0; // 0-1 for mouth openness

    // Arm gesture state for talking
    let gesturePhase = 0;
    let gestureTimer = 0;
    let gestureInterval = 60 + Math.random() * 80;

    const setExpression = (vrm: any, name: string, value: number) => {
      const aliases = (EXPR as any)[name];
      if (!aliases) return;
      if (vrm.expressionManager) {
        aliases.forEach((a: string) => {
          try { vrm.expressionManager.setValue(a, value); } catch (_) {}
          try { vrm.expressionManager.setValue(a.toLowerCase(), value); } catch (_) {}
        });
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const dy = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.set(dx, dy);
    };
    window.addEventListener("mousemove", handleMouseMove);

    const handleResize = () => {
      const rW = container.clientWidth || 400;
      const rH = container.clientHeight || 500;
      camera.aspect = rW / rH;
      camera.updateProjectionMatrix();
      renderer.setSize(rW, rH);
    };
    window.addEventListener("resize", handleResize);

    // ── Main Animation Loop ──
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();
      const speaking = speakingRef.current;

      // ── Gaze Target (eye tracking) ──
      if (!asleep) {
        gazeTarget.x = THREE.MathUtils.lerp(gazeTarget.x, mouse.x * 0.4, 0.06);
        gazeTarget.y = THREE.MathUtils.lerp(gazeTarget.y, 1.45 + mouse.y * 0.2, 0.06);
      } else {
        gazeTarget.set(0, 1.35, 1);
      }

      // ── Eye Look-Around (when not speaking) ──
      if (!speaking) {
        eyeLookTimer++;
        if (eyeLookTimer >= eyeLookInterval) {
          eyeLookTargetX = (Math.random() - 0.5) * 0.3;
          eyeLookTargetY = (Math.random() - 0.5) * 0.25;
          eyeLookTimer = 0;
          eyeLookInterval = 400 + Math.random() * 600;
        }
        gazeTarget.x += eyeLookTargetX * 0.1;
        gazeTarget.y += eyeLookTargetY * 0.1;
      }

      // ── Smile Control ──
      if (speaking) {
        targetSmileFactor = 0.3 + Math.sin(time * 3) * 0.1; // Smile while talking
      } else {
        targetSmileFactor = 0.15; // Subtle smile at rest
      }
      smileFactor = THREE.MathUtils.lerp(smileFactor, targetSmileFactor, 0.08);

      // ── Blink with emotion-driven frequency ──
      // Blinking changes based on emotion (nervous = more blinks, focused = fewer)
      let blinkFrequencyMod = 1.0;
      if (emotion === "nervous" || emotion === "surprised") blinkFrequencyMod = 1.5;
      else if (emotion === "focused" || emotion === "determined") blinkFrequencyMod = 0.7;
      else if (emotion === "sad" || emotion === "thinking") blinkFrequencyMod = 0.85;

      blinkTimer++;
      if (blinkTimer >= nextBlinkFrame) {
        currentBlink = THREE.MathUtils.lerp(currentBlink, 1.0, 0.35);
        if (currentBlink >= 0.98) {
          blinkTimer = 0;
          nextBlinkFrame = Math.round((150 + Math.random() * 250) / blinkFrequencyMod);
        }
      } else {
        currentBlink = THREE.MathUtils.lerp(currentBlink, 0.0, 0.28);
      }

      // Eye squinting based on emotion (smiling = squint, angry = narrow)
      if (emotion === "happy" || emotion === "friendly" || emotion === "excited") {
        eyeSquint = Math.max(eyeSquint, 0.2);
      } else if (emotion === "angry" || emotion === "focused") {
        eyeSquint = Math.max(eyeSquint, 0.15);
      }
      eyeSquint = THREE.MathUtils.lerp(eyeSquint, 0, 0.05); // fade out over time

      // ── Head Tilt Variation ──
      headTiltTimer++;
      if (headTiltTimer >= headTiltInterval) {
        headTiltTarget = (Math.random() - 0.5) * 0.12;
        headTiltTimer = 0;
        headTiltInterval = 200 + Math.random() * 400;
      }

      // ── Viseme Cycling (Speech) with Enhanced Lip-Sync ──
      if (speaking) {
        visemeCycleTimer++;
        const pattern = VISEME_PATTERNS[visemeCycleIndex % VISEME_PATTERNS.length];
        const framesPerViseme = Math.round((pattern.duration / 1000) * 60);

        if (visemeCycleTimer >= framesPerViseme) {
          visemeCycleTimer = 0;
          visemeCycleIndex = (visemeCycleIndex + 1) % VISEME_PATTERNS.length;
        }

        const currentPattern = VISEME_PATTERNS[visemeCycleIndex % VISEME_PATTERNS.length];
        const nextPattern = VISEME_PATTERNS[(visemeCycleIndex + 1) % VISEME_PATTERNS.length];

        // Smooth transition between visemes
        const transition = visemeCycleTimer / framesPerViseme;

        // Set target weights with smooth interpolation
        targetVisemeWeights = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
        targetVisemeWeights[currentPattern.viseme as keyof typeof targetVisemeWeights] =
          THREE.MathUtils.lerp(0.8, 0.6, transition);
        targetVisemeWeights[nextPattern.viseme as keyof typeof targetVisemeWeights] =
          transition * 0.3;

        // Mouth open varies with viseme
        mouthOpen = 0.6 + Math.sin(time * 4) * 0.15;
      } else {
        // Close mouth smoothly when not speaking
        targetVisemeWeights = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
        mouthOpen = THREE.MathUtils.lerp(mouthOpen, 0, 0.05);
      }

      // Smooth lerp all viseme weights for natural animation
      for (const key of Object.keys(currentVisemeWeights)) {
        const target = targetVisemeWeights[key] || 0;
        currentVisemeWeights[key] = THREE.MathUtils.lerp(
          currentVisemeWeights[key],
          target,
          speaking ? 0.25 : 0.10
        );
      }

      // ── Gesture cycling for talking (natural hand movements) ──
      if (speaking) {
        gestureTimer++;
        if (gestureTimer >= gestureInterval) {
          gestureTimer = 0;
          gesturePhase = (gesturePhase + 1) % 8; // More gesture phases for variety
          gestureInterval = 40 + Math.random() * 100;
        }
      } else {
        // Smooth return to neutral with subtle idle movement
        gesturePhase = 0;
        gestureTimer = 0;
      }

      // Determine gesture type based on emotion and phase
      let currentGestureType = "presenting"; // default
      if (emotion === "surprised" || emotion === "excited") currentGestureType = "emphasis";
      if (emotion === "thinking" || emotion === "contemplative") currentGestureType = "questioning";
      if (emotion === "confident" || emotion === "focused") currentGestureType = "presenting";

      // ── Process VRM model updates ──
      if (vrmRef.current) {
        const vrm = vrmRef.current;
        
        // Gaze
        if (vrm.lookAt) {
          vrm.lookAt.lookAt(gazeTarget);
        }
        
        // ── Head movement with natural nodding ──
        const head = getBone(vrm, "head");
        const neck = getBone(vrm, "neck");
        if (head && !asleep) {
          // Mouse tracking + subtle head tilt variation
          let headYTarget = mouse.x * 0.15 + headTiltTarget;
          let headXTarget = -mouse.y * 0.1;

          // Periodic head nodding for affirmation
          if (Math.random() > 0.95 && !speaking) {
            headNodding = true;
            headNodTimer = 0;
          }
          if (headNodding) {
            headNodTimer++;
            headXTarget += Math.sin(headNodTimer * 0.05) * 0.12;
            if (headNodTimer > 30) headNodding = false;
          }

          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, headYTarget, 0.04);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, headXTarget, 0.04);
          // Enhanced head tilt with emotion response
          const tiltVariation = emotion === "sad" || emotion === "thinking" ? 0.05 : 0.03;
          head.rotation.z = THREE.MathUtils.lerp(head.rotation.z,
            Math.sin(time * 0.5) * tiltVariation + headTiltTarget * 0.5, 0.03);
        }
        if (neck && !asleep) {
          neck.rotation.y = THREE.MathUtils.lerp(neck.rotation.y, mouse.x * 0.05, 0.03);
          // Slight neck tilt for naturalism
          neck.rotation.z = THREE.MathUtils.lerp(neck.rotation.z,
            Math.sin(time * 0.3) * 0.01, 0.02);
        }

        // ── Breathing (emotion-responsive) ──
        const chest = getBone(vrm, "chest");
        const spine = getBone(vrm, "spine");
        const hips = getBone(vrm, "hips");

        // Breathing rate and depth vary by emotion and activity
        let breathRate = asleep ? 1.0 : (speaking ? 2.8 : 1.8);
        let breathDepth = asleep ? 0.012 : (speaking ? 0.03 : 0.022);

        if (emotion === "nervous" || emotion === "surprised") {
          breathRate *= 1.3;
          breathDepth *= 1.2;
        } else if (emotion === "relaxed" || emotion === "contemplative") {
          breathRate *= 0.8;
          breathDepth *= 0.9;
        } else if (emotion === "excited") {
          breathRate *= 1.4;
          breathDepth *= 1.3;
        }

        const breathe = Math.sin(time * breathRate) * breathDepth;
        if (chest) chest.rotation.x = breathe;
        if (spine) {
          spine.rotation.x = breathe * 0.4 + 0.03;
          // ── Enhanced body micro-sway (weight shift) with emotion response ──
          const swayIntensity = emotion === "confident" ? 0.008 : emotion === "nervous" ? 0.012 : 0.008;
          spine.rotation.z = Math.sin(time * 0.4) * swayIntensity + Math.sin(time * 0.7) * swayIntensity * 0.6;
          spine.rotation.y = Math.sin(time * 0.35 + 2) * swayIntensity * 0.4; // subtle twist
        }
        if (hips) {
          // Enhanced hip sway with emotion responsiveness
          const hipSwayIntensity = emotion === "happy" || emotion === "excited" ? 0.008 : 0.005;
          hips.rotation.z = Math.sin(time * 0.35 + 0.5) * hipSwayIntensity;
          hips.rotation.x = Math.sin(time * 0.3 + 1) * hipSwayIntensity * 0.3; // subtle lean
        }

        // ── Arm idle animation + talking gestures ──
        const leftUpperArm = getBone(vrm, "leftUpperArm");
        const rightUpperArm = getBone(vrm, "rightUpperArm");
        const leftLowerArm = getBone(vrm, "leftLowerArm");
        const rightLowerArm = getBone(vrm, "rightLowerArm");
        const leftHand = getBone(vrm, "leftHand");
        const rightHand = getBone(vrm, "rightHand");

        if (!speaking) {
          // Subtle idle arm sway
          if (leftUpperArm) {
            leftUpperArm.rotation.z = THREE.MathUtils.lerp(leftUpperArm.rotation.z,
              -0.65 + Math.sin(time * 0.6) * 0.03, 0.04);
            leftUpperArm.rotation.x = THREE.MathUtils.lerp(leftUpperArm.rotation.x,
              Math.sin(time * 0.4 + 1) * 0.02, 0.03);
          }
          if (rightUpperArm) {
            rightUpperArm.rotation.z = THREE.MathUtils.lerp(rightUpperArm.rotation.z,
              0.65 + Math.sin(time * 0.55 + 2) * 0.03, 0.04);
            rightUpperArm.rotation.x = THREE.MathUtils.lerp(rightUpperArm.rotation.x,
              Math.sin(time * 0.45 + 3) * 0.02, 0.03);
          }
          if (leftLowerArm) {
            leftLowerArm.rotation.z = THREE.MathUtils.lerp(leftLowerArm.rotation.z,
              -0.15 + Math.sin(time * 0.7) * 0.02, 0.04);
          }
          if (rightLowerArm) {
            rightLowerArm.rotation.z = THREE.MathUtils.lerp(rightLowerArm.rotation.z,
              0.15 + Math.sin(time * 0.65 + 1) * 0.02, 0.04);
          }
        } else {
          // ── Talking gestures with emotion-driven gesture selection ──
          const gestureLib = (GESTURE_LIBRARY as any)[currentGestureType] || (GESTURE_LIBRARY as any).presenting;
          const gestureIdx = gesturePhase % gestureLib.length;
          const gestureTargets = gestureLib[gestureIdx];

          // Enhanced gesture transitions with finger animations
          if (rightUpperArm) {
            rightUpperArm.rotation.z = THREE.MathUtils.lerp(rightUpperArm.rotation.z,
              gestureTargets.rightUpperZ + Math.sin(time * 2.2) * 0.03, 0.08);
            rightUpperArm.rotation.x = THREE.MathUtils.lerp(rightUpperArm.rotation.x,
              gestureTargets.rightUpperX + Math.sin(time * 1.8) * 0.02, 0.08);
          }
          if (rightLowerArm) {
            rightLowerArm.rotation.z = THREE.MathUtils.lerp(rightLowerArm.rotation.z,
              gestureTargets.rightLowerZ + Math.cos(time * 2.0) * 0.02, 0.08);
            rightLowerArm.rotation.x = THREE.MathUtils.lerp(rightLowerArm.rotation.x,
              gestureTargets.rightLowerX + Math.sin(time * 1.5) * 0.02, 0.08);
          }
          if (rightHand) {
            // Hand curl for emphasis
            const handCurl = currentGestureType === "emphasis" ?
              Math.sin(time * 3.0) * 0.1 : 0.05;
            rightHand.rotation.z = THREE.MathUtils.lerp(rightHand.rotation.z,
              gestureTargets.rightHandZ + handCurl, 0.07);
            rightHand.rotation.x = THREE.MathUtils.lerp(rightHand.rotation.x,
              Math.sin(time * 2.5) * 0.08, 0.06);
          }

          // Left arm supports gesture
          if (leftUpperArm) {
            leftUpperArm.rotation.z = THREE.MathUtils.lerp(leftUpperArm.rotation.z,
              gestureTargets.leftUpperZ + Math.sin(time * 0.8) * 0.02, 0.06);
            leftUpperArm.rotation.x = THREE.MathUtils.lerp(leftUpperArm.rotation.x,
              gestureTargets.leftUpperX + Math.sin(time * 0.6) * 0.02, 0.05);
          }
          if (leftLowerArm) {
            leftLowerArm.rotation.z = THREE.MathUtils.lerp(leftLowerArm.rotation.z,
              -0.1 + Math.sin(time * 0.9) * 0.03, 0.05);
          }
          if (leftHand) {
            leftHand.rotation.z = THREE.MathUtils.lerp(leftHand.rotation.z,
              Math.sin(time * 2.0) * 0.05, 0.06);
          }
        }

        // ── Enhanced Shoulder micro-movement with emotional shrugs ──
        const leftShoulder = getBone(vrm, "leftShoulder");
        const rightShoulder = getBone(vrm, "rightShoulder");

        // Emotion-driven shoulder tension
        let shoulderTension = 0;
        if (emotion === "nervous" || emotion === "surprised") shoulderTension = 0.012;
        else if (emotion === "happy" || emotion === "excited") shoulderTension = 0.01;
        else if (emotion === "sad" || emotion === "concerned") shoulderTension = 0.008;

        if (leftShoulder) {
          leftShoulder.rotation.z = Math.sin(time * 0.3) * (0.008 + shoulderTension);
          leftShoulder.rotation.x = Math.sin(time * 0.25 + 0.5) * shoulderTension * 0.5; // tense up/relax
        }
        if (rightShoulder) {
          rightShoulder.rotation.z = Math.sin(time * 0.35 + 1) * (0.008 + shoulderTension);
          rightShoulder.rotation.x = Math.sin(time * 0.28 + 1.5) * shoulderTension * 0.5;
        }

        // Occasional shoulder shrug for emphasis when speaking
        if (speaking && gesturePhase % 3 === 0) {
          if (leftShoulder) leftShoulder.position.y += Math.sin(time * 2.5) * 0.01;
          if (rightShoulder) rightShoulder.position.y += Math.cos(time * 2.5) * 0.01;
        }

        // ── Enhanced Blinking with eye squinting for expressions ──
        setExpression(vrm, "blink", currentBlink);

        // Apply eye squinting for natural micro-expressions
        const squintShapes = ["blinkL", "blinkR"];
        squintShapes.forEach(shape => {
          try {
            vrm.expressionManager?.setValue(shape, eyeSquint * 0.3);
          } catch (_) {}
        });

        // ── Emotion morphs with dynamic smile and micro-expressions ──
        const emoTargets = getEmotionBlend(emotion);
        Object.entries(emoTargets).forEach(([name, val]) => {
          let finalVal = val;
          // Apply smile factor for natural smiling while talking
          if (name === "smile") finalVal = Math.max(val, smileFactor);
          // Enhance expressions with micro-animations
          if (name === "surprised") finalVal += eyeSquint * 0.1;
          if (name === "happy" || name === "smile") finalVal *= (1.0 + eyeSquint * 0.2);

          setExpression(vrm, name, finalVal);
        });

        // ── Viseme (lip sync) with fine-tuned mouth control ──
        Object.entries(currentVisemeWeights).forEach(([name, val]) => {
          setExpression(vrm, name, val);
        });

        // ── Direct mouth opening for more natural speech ──
        setExpression(vrm, "aa", Math.max(currentVisemeWeights.aa, mouthOpen * 0.3));
        setExpression(vrm, "oh", Math.max(currentVisemeWeights.oh, mouthOpen * 0.2));

        vrm.update(delta);
      }

      // ── Process Fallback (procedural) model updates ──
      if (fallbackRef.current) {
        const currentViseme = VISEME_PATTERNS[visemeCycleIndex % VISEME_PATTERNS.length]?.viseme || "rest";
        fallbackRef.current.update(
          time, delta, currentBlink > 0.6,
          speaking ? currentViseme : "rest",
          emotion, gazeTarget, speaking, gesturePhase
        );
      }

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("resize", handleResize);
      container.innerHTML = "";
    };
  }, [profile, asleep]); // Removed emotion/viseme from deps — tracked via refs

  return <div ref={mountRef} className="w-full h-full min-h-[400px] relative overflow-hidden rounded-2xl glass" />;
};

// ── Helpers ──

function getBone(vrm: any, name: string) {
  if (vrm.humanoid?.getNormalizedBoneNode) {
    return vrm.humanoid.getNormalizedBoneNode(name);
  }
  return vrm.humanoid?.getBoneNode(name);
}

function getEmotionBlend(emo: string): Record<string, number> {
  const defaults = { happy: 0, smile: 0, sad: 0, angry: 0, surprised: 0, relaxed: 0 };

  // Rich emotional expressions with nuanced blends and micro-expressions
  switch (emo) {
    case "happy":
    case "friendly":
      return { ...defaults, happy: 0.85, smile: 0.75, relaxed: 0.35, surprised: 0.05 };
    case "excited":
    case "delighted":
      return { ...defaults, happy: 1.0, smile: 0.95, surprised: 0.4, relaxed: 0.2 };
    case "confident":
      return { ...defaults, happy: 0.5, smile: 0.65, relaxed: 0.8, angry: 0.05 };
    case "sad":
    case "concerned":
      return { ...defaults, sad: 0.95, relaxed: 0.15, surprised: 0.1 };
    case "angry":
      return { ...defaults, angry: 1.0, sad: 0.15, relaxed: 0 };
    case "surprised":
      return { ...defaults, surprised: 1.0, happy: 0.25, relaxed: 0.1 };
    case "thinking":
    case "contemplative":
      return { ...defaults, relaxed: 0.7, sad: 0.2, happy: 0.1 };
    case "focused":
    case "determined":
      return { ...defaults, relaxed: 0.6, angry: 0.2, happy: 0.15 };
    case "nervous":
      return { ...defaults, surprised: 0.5, sad: 0.4, relaxed: 0.2 };
    case "curious":
      return { ...defaults, surprised: 0.6, happy: 0.4, relaxed: 0.3 };
    case "embarrassed":
      return { ...defaults, sad: 0.4, relaxed: 0.3, surprised: 0.2, happy: 0.1 };
    default:
      return { ...defaults, smile: 0.25, relaxed: 0.45 };
  }
}

// ── Fallback Procedural Model Builder ──
function buildProceduralAvatar(scene: THREE.Scene, c: any) {
  const grp = new THREE.Group();
  scene.add(grp);

  const accentColor = ACCENT_HEX[c?.char_outfit] || ACCENT_HEX.cyan;
  const skinColor = SKIN_HEX[c?.char_skin] || SKIN_HEX.fair;
  const hairColor = HAIR_HEX[c?.char_hair_color] || HAIR_HEX.black;
  const eyeColor = EYE_HEX[c?.char_eyes] || EYE_HEX.sapphire;
  const gender = c?.char_gender || "female";

  const skinMat = new THREE.MeshLambertMaterial({ color: skinColor });
  const hairMat = new THREE.MeshLambertMaterial({ color: hairColor });
  const suitMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 });
  const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const lipMat = new THREE.LineBasicMaterial({ color: 0xe11d48, linewidth: 2 });
  const browMat = new THREE.LineBasicMaterial({ color: hairColor, linewidth: 2 });

  // Upper Body Suit base
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.44, 0.8, 16), suitMat);
  body.position.set(0, 0.9, 0);
  grp.add(body);

  const trim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 16), accentMat);
  trim.position.set(0, 1.25, 0);
  grp.add(trim);

  // Neck
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.22, 12), skinMat);
  neck.position.set(0, 1.34, 0);
  grp.add(neck);

  // Head Group
  const head = new THREE.Group();
  head.position.set(0, 1.54, 0);
  grp.add(head);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 24), skinMat);
  headMesh.scale.set(1.0, 1.15, 1.0);
  head.add(headMesh);

  // Eyes
  const lEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), eyeMat);
  lEye.position.set(-0.085, 0.06, 0.19);
  lEye.scale.set(1.0, 1.5, 0.5);
  head.add(lEye);

  const rEye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 12), eyeMat);
  rEye.position.set(0.085, 0.06, 0.19);
  rEye.scale.set(1.0, 1.5, 0.5);
  head.add(rEye);

  // Blinking Lids
  const lLid = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
  lLid.position.set(-0.085, 0.065, 0.195);
  lLid.rotation.x = Math.PI / 2;
  lLid.scale.set(1.02, 1.0, 0.3);
  head.add(lLid);

  const rLid = new THREE.Mesh(new THREE.SphereGeometry(0.046, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), skinMat);
  rLid.position.set(0.085, 0.065, 0.195);
  rLid.rotation.x = Math.PI / 2;
  rLid.scale.set(1.02, 1.0, 0.3);
  head.add(rLid);

  // Eyebrows
  const makeBrow = () => {
    const geo = new THREE.BufferGeometry();
    const pts = [new THREE.Vector3(-0.04, 0, 0), new THREE.Vector3(0, 0.008, 0), new THREE.Vector3(0.04, 0, 0)];
    geo.setFromPoints(pts);
    return new THREE.Line(geo, browMat);
  };
  const lBrow = makeBrow();
  lBrow.position.set(-0.085, 0.14, 0.196);
  head.add(lBrow);

  const rBrow = makeBrow();
  rBrow.position.set(0.085, 0.14, 0.196);
  head.add(rBrow);

  // Lips
  const LP = 7;
  const pts = Array.from({ length: LP }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const lipsGeo = new THREE.BufferGeometry();
  lipsGeo.setFromPoints(curve.getPoints(20));
  const lips = new THREE.Line(lipsGeo, lipMat);
  lips.position.set(0, -0.09, 0.2);
  head.add(lips);

  // Arms (procedural)
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.4, 1.15, 0);
  grp.add(leftArm);
  const lUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 8), suitMat);
  lUpperArm.position.set(0, -0.15, 0);
  lUpperArm.rotation.z = -0.15;
  leftArm.add(lUpperArm);
  const lLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 8), skinMat);
  lLowerArm.position.set(0, -0.37, 0);
  leftArm.add(lLowerArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.4, 1.15, 0);
  grp.add(rightArm);
  const rUpperArm = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.35, 8), suitMat);
  rUpperArm.position.set(0, -0.15, 0);
  rUpperArm.rotation.z = 0.15;
  rightArm.add(rUpperArm);
  const rLowerArm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.04, 0.3, 8), skinMat);
  rLowerArm.position.set(0, -0.37, 0);
  rightArm.add(rLowerArm);

  // Hair Strands
  const style = c?.char_hair_style || "long";
  const STRANDS = gender === "female" ? 20 : 12;
  const SEG = style === "short" || style === "spiky" ? 3 : 5;
  const SEG_LEN = style === "short" ? 0.08 : style === "spiky" ? 0.06 : 0.14;
  
  const strandsData: any[] = [];
  const strandMeshes: THREE.Mesh[] = [];

  for (let s = 0; s < STRANDS; s++) {
    const ang = (s / STRANDS) * Math.PI - Math.PI / 2;
    const rx = Math.cos(ang) * 0.22;
    const ry = 0.08 + Math.sin(Math.abs(ang)) * 0.12;
    const rz = -0.08 + Math.cos(Math.abs(ang)) * 0.14;
    
    const nodes: any[] = [];
    for (let i = 0; i < SEG; i++) {
      let px = rx;
      let py = ry - i * SEG_LEN;
      let pz = rz - i * 0.02;
      
      if (style === "wave") px += Math.sin(i * 1.5 + s) * 0.02;
      else if (style === "curly") {
        px += Math.sin(i * 2.5 + s) * 0.015;
        pz += Math.cos(i * 2.5 + s) * 0.015;
      }
      
      nodes.push({
        pos: new THREE.Vector3(px, py, pz),
        prev: new THREE.Vector3(px, py, pz)
      });
    }
    strandsData.push(nodes);
    
    const sc = new THREE.CatmullRomCurve3(nodes.map(n => n.pos));
    const sm = new THREE.Mesh(new THREE.TubeGeometry(sc, 6, 0.03 - s * 0.0005, 5, false), hairMat);
    head.add(sm);
    strandMeshes.push(sm);
  }

  if (style === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(gender === "female" ? 0.09 : 0.07, 16, 16), hairMat);
    bun.position.set(0, 0.1, -0.22);
    head.add(bun);
  }

  let fW = 0.07;
  let fH = 0.02;
  let fBC = 0.02;

  return {
    update(time: number, delta: number, isBlinking: boolean, viseme: string, emotion: string, gazeTarget: THREE.Vector3, speaking: boolean = false, gesturePhase: number = 0) {
      // Blink
      lLid.scale.y = isBlinking ? 0.08 : 1.0;
      rLid.scale.y = isBlinking ? 0.08 : 1.0;

      // Eyebrow raises
      const browY = emotion === "surprised" ? 0.17 : emotion === "angry" ? 0.11 : 0.14;
      lBrow.position.y = THREE.MathUtils.lerp(lBrow.position.y, browY, 0.1);
      rBrow.position.y = THREE.MathUtils.lerp(rBrow.position.y, browY, 0.1);

      // Head look at with tilt
      head.lookAt(gazeTarget);
      head.rotation.x = Math.max(-0.2, Math.min(0.2, head.rotation.x));
      head.rotation.y = Math.max(-0.3, Math.min(0.3, head.rotation.y));
      head.rotation.z = Math.sin(time * 0.5) * 0.03;

      // Body breathing/sway
      body.rotation.x = Math.sin(time * 1.8) * 0.01;
      body.rotation.z = Math.sin(time * 0.4) * 0.005;

      // Enhanced arm animations with natural gesture timing
      if (speaking) {
        // Dynamic talking gestures for procedural model
        const swing = Math.sin(time * 2.0) * 0.15;
        const emphasis = Math.sin(time * 3.5) * 0.08; // faster emphasis gesture

        rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z, 0.3 + swing + emphasis, 0.07);
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x,
          -0.2 + Math.sin(time * 1.5) * 0.12 + Math.cos(time * 2.0) * 0.06, 0.07);
        rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y,
          Math.sin(time * 1.2) * 0.08, 0.06);

        // Left arm accompanies gesture
        leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z,
          Math.sin(time * 0.8) * 0.06 - 0.1, 0.06);
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x,
          Math.sin(time * 1.3) * 0.05, 0.05);
      } else {
        // Idle arm sway with natural weight shift
        leftArm.rotation.z = THREE.MathUtils.lerp(leftArm.rotation.z,
          Math.sin(time * 0.6) * 0.035 - 0.05, 0.04);
        rightArm.rotation.z = THREE.MathUtils.lerp(rightArm.rotation.z,
          Math.sin(time * 0.55 + 2) * 0.035 + 0.05, 0.04);
        leftArm.rotation.x = THREE.MathUtils.lerp(leftArm.rotation.x,
          Math.sin(time * 0.4) * 0.025, 0.03);
        rightArm.rotation.x = THREE.MathUtils.lerp(rightArm.rotation.x,
          Math.sin(time * 0.45 + 1) * 0.025, 0.03);

        // Subtle arm rotation for natural posture
        leftArm.rotation.y = THREE.MathUtils.lerp(leftArm.rotation.y,
          Math.sin(time * 0.5) * 0.02, 0.03);
        rightArm.rotation.y = THREE.MathUtils.lerp(rightArm.rotation.y,
          Math.sin(time * 0.48 + 1) * 0.02, 0.03);
      }

      // Enhanced Visemes with sophisticated natural mouth shapes for better lip-sync
      const VMORPHS: Record<string, any> = {
        rest: { w: 0.065, h: 0.020, curve: 0.015 },  // Natural slight smile at rest
        M:    { w: 0.050, h: 0.001, curve: 0.0 },    // Closed lips for M/B/P
        N:    { w: 0.055, h: 0.008, curve: 0.005 },  // Slight opening for N
        aa:   { w: 0.088, h: 0.078, curve: 0.042 },  // Very open for ah
        A:    { w: 0.088, h: 0.078, curve: 0.042 },
        ae:   { w: 0.080, h: 0.050, curve: 0.035 },  // Between A and E
        ee:   { w: 0.098, h: 0.038, curve: 0.052 },  // Wide spread for ee
        E:    { w: 0.098, h: 0.038, curve: 0.052 },
        ih:   { w: 0.082, h: 0.032, curve: 0.042 },  // Moderate for ih
        I:    { w: 0.082, h: 0.032, curve: 0.042 },
        oh:   { w: 0.050, h: 0.078, curve: -0.015 }, // Round for oh
        O:    { w: 0.050, h: 0.078, curve: -0.015 },
        ou:   { w: 0.035, h: 0.052, curve: -0.042 }, // Very round for oo
        U:    { w: 0.035, h: 0.052, curve: -0.042 },
        F:    { w: 0.065, h: 0.015, curve: 0.010 },  // Teeth visibility for F/V
      };

      let emoCurve = 0, hm = 1.0, wm = 1.0;
      if (emotion === "excited" || emotion === "delighted") {
        emoCurve = 0.070;
        hm = 1.25;
        wm = 1.15;
      } else if (emotion === "happy" || emotion === "friendly" || emotion === "confident") {
        emoCurve = 0.050;
        hm = 1.08;
        wm = 1.05;
      } else if (emotion === "sad" || emotion === "concerned") {
        emoCurve = -0.060;
        hm = 0.9;
      } else if (emotion === "surprised") {
        emoCurve = 0.005;
        hm = 1.7;
        wm = 0.80;
      } else if (emotion === "angry") {
        emoCurve = -0.045;
        wm = 1.1;
      }
      
      const vcfg = VMORPHS[viseme] || VMORPHS.rest;
      const tw = vcfg.w * wm, th = vcfg.h * hm, tbc = vcfg.curve + emoCurve;
      
      fW = THREE.MathUtils.lerp(fW, tw, 0.15);
      fH = THREE.MathUtils.lerp(fH, th, 0.15);
      fBC = THREE.MathUtils.lerp(fBC, tbc, 0.15);

      for (let i = 0; i < LP; i++) {
        const theta = (i / (LP - 1)) * Math.PI * 2;
        const x = Math.cos(theta) * fW;
        const corner = (fW - Math.abs(x)) * fBC * 0.5;
        pts[i].set(x, Math.sin(theta) * fH + corner, 0);
      }
      
      curve.points = pts;
      lips.geometry.dispose();
      lips.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));

      // Hair wind sway
      const wind = Math.sin(time * 3.0) * 0.01;
      for (let s = 0; s < STRANDS; s++) {
        const nodes = strandsData[s];
        const mesh = strandMeshes[s];
        
        for (let i = 1; i < SEG; i++) {
          nodes[i].pos.x += wind * 0.02 * i;
        }
        
        mesh.geometry.dispose();
        mesh.geometry = new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(nodes.map((n: any) => n.pos)),
          6,
          0.025 - s * 0.0004,
          5,
          false
        );
      }
    }
  };
}
