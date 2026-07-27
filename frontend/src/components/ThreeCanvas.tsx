"use client";

import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as VRM from "@pixiv/three-vrm";

interface ThreeCanvasProps {
  profile: any;
  emotion?: string;
  viseme?: string;
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
  happy: ["happy", "joy", "Joy"],
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

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({
  profile,
  emotion = "neutral",
  viseme = "rest",
  asleep = false,
  onTelemetry,
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const vrmRef = useRef<any>(null);
  const fallbackRef = useRef<any>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());

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
    });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.LinearToneMapping;
    renderer.toneMappingExposure = 1.0;
    
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0e111a); // Sleep Dark glassmorphic background
    
    const camera = new THREE.PerspectiveCamera(35, W / H, 0.1, 100);
    camera.position.set(0, 1.45, 1.6); // tight portrait focus
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
    
    // VRM Loader
    const loader = new GLTFLoader();
    if (VRM.VRMLoaderPlugin) {
      loader.register((parser) => new VRM.VRMLoaderPlugin(parser));
    }
    
    let isLoaded = false;
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
            // Rollback to procedural fallback
            fallbackRef.current = buildProceduralAvatar(scene, profile);
            return;
          }
          
          vrmRef.current = vrm;
          scene.add(vrm.scene);
          
          // Rotation to face front
          vrm.scene.rotation.y = 0;
          vrm.scene.position.set(0, 0, 0);
          vrm.scene.scale.setScalar(1.0);
          
          // Tune materials and apply dynamic customizations to VRM
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
                
                // Color override matching mesh or material keywords
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
          isLoaded = true;
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
      const getBone = (name: string) => {
        if (vrm.humanoid?.getNormalizedBoneNode) {
          return vrm.humanoid.getNormalizedBoneNode(name);
        }
        return vrm.humanoid?.getBoneNode(name);
      };
      
      const setRot = (boneName: string, x: number, y: number, z: number) => {
        const b = getBone(boneName);
        if (b) b.rotation.set(x, y, z);
      };
      
      setRot("leftUpperArm", 0, 0, -0.65);
      setRot("rightUpperArm", 0, 0, 0.65);
      setRot("leftLowerArm", 0, 0, -0.15);
      setRot("rightLowerArm", 0, 0, 0.15);
      setRot("spine", 0.03, 0, 0);
    };

    // Auto-blink setup
    let blinkTimer = 0;
    let nextBlinkFrame = 200;
    let currentBlink = 0;

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

    // Mouse movement listner
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const dx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const dy = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouse.set(dx, dy);
    };
    window.addEventListener("mousemove", handleMouseMove);

    // Telemetry trigger simulation
    let waveTimer = 0;
    let isWaving = false;

    // Resize listener
    const handleResize = () => {
      const rW = container.clientWidth || 400;
      const rH = container.clientHeight || 500;
      camera.aspect = rW / rH;
      camera.updateProjectionMatrix();
      renderer.setSize(rW, rH);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let reqId: number;
    const animate = () => {
      reqId = requestAnimationFrame(animate);
      const delta = clockRef.current.getDelta();
      const time = clockRef.current.getElapsedTime();

      // Look Target Lerp
      if (!asleep) {
        gazeTarget.x = THREE.MathUtils.lerp(gazeTarget.x, mouse.x * 0.4, 0.08);
        gazeTarget.y = THREE.MathUtils.lerp(gazeTarget.y, 1.45 + mouse.y * 0.2, 0.08);
      } else {
        gazeTarget.set(0, 1.4, 1);
      }

      // Blink animation
      blinkTimer++;
      if (blinkTimer >= nextBlinkFrame) {
        currentBlink = THREE.MathUtils.lerp(currentBlink, 1.0, 0.28);
        if (currentBlink >= 0.98) {
          blinkTimer = 0;
          nextBlinkFrame = 180 + Math.random() * 220;
        }
      } else {
        currentBlink = THREE.MathUtils.lerp(currentBlink, 0.0, 0.22);
      }

      // ── Process VRM model updates ──
      if (vrmRef.current) {
        const vrm = vrmRef.current;
        
        // Gaze tracking
        if (vrm.lookAt) {
          vrm.lookAt.lookAt(gazeTarget);
        }
        
        // Head/neck sway
        const head = vrm.humanoid?.getNormalizedBoneNode("head");
        const neck = vrm.humanoid?.getNormalizedBoneNode("neck");
        if (head && !asleep) {
          head.rotation.y = THREE.MathUtils.lerp(head.rotation.y, mouse.x * 0.15, 0.05);
          head.rotation.x = THREE.MathUtils.lerp(head.rotation.x, -mouse.y * 0.1, 0.05);
        }

        // Idle Breathing
        const chest = vrm.humanoid?.getNormalizedBoneNode("chest");
        const spine = vrm.humanoid?.getNormalizedBoneNode("spine");
        const breathe = Math.sin(time * (asleep ? 1.2 : 2.0)) * 0.02;
        if (chest) chest.rotation.x = breathe;
        if (spine) spine.rotation.x = breathe * 0.5;

        // Apply Blinking
        setExpression(vrm, "blink", currentBlink);

        // Apply Emotion morphs
        const emoTargets = getEmotionBlend(emotion);
        Object.entries(emoTargets).forEach(([name, val]) => {
          setExpression(vrm, name, val);
        });

        // Apply Visemes (talking)
        const visemeTargets = getVisemeBlend(viseme);
        Object.entries(visemeTargets).forEach(([name, val]) => {
          // Adjust expressions for mouth
          setExpression(vrm, name, val);
        });

        vrm.update(delta);
      }

      // ── Process Fallback (procedural) model updates ──
      if (fallbackRef.current) {
        fallbackRef.current.update(time, delta, currentBlink > 0.6, viseme, emotion, gazeTarget);
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
  }, [profile, emotion, viseme, asleep]);

  return <div ref={mountRef} className="w-full h-full min-h-[400px] relative overflow-hidden rounded-2xl glass" />;
};

// ── Helpers ──
function getEmotionBlend(emo: string): Record<string, number> {
  const defaults = { happy: 0, sad: 0, angry: 0, surprised: 0, relaxed: 0 };
  if (emo === "happy" || emo === "friendly") return { ...defaults, happy: 0.8, relaxed: 0.2 };
  if (emo === "excited") return { ...defaults, happy: 1.0, surprised: 0.4 };
  if (emo === "sad" || emo === "concerned") return { ...defaults, sad: 0.9 };
  if (emo === "angry") return { ...defaults, angry: 1.0 };
  if (emo === "surprised") return { ...defaults, surprised: 1.0 };
  if (emo === "thinking") return { ...defaults, relaxed: 0.5, sad: 0.1 };
  if (emo === "focused") return { ...defaults, relaxed: 0.4, angry: 0.2 };
  return { ...defaults, relaxed: 0.3 };
}

function getVisemeBlend(vis: string): Record<string, number> {
  const defaults = { aa: 0, ee: 0, ih: 0, oh: 0, ou: 0 };
  if (vis === "A") return { ...defaults, aa: 1.0 };
  if (vis === "E") return { ...defaults, ee: 0.85 };
  if (vis === "I") return { ...defaults, ih: 0.85 };
  if (vis === "O") return { ...defaults, oh: 1.0 };
  if (vis === "U") return { ...defaults, ou: 0.8 };
  if (vis === "M") return { ...defaults, ou: 0.1 };
  if (vis === "F") return { ...defaults, ee: 0.2 };
  return defaults;
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
  const suitMat = new THREE.MeshLambertMaterial({ color: 0x1f2937 }); // dark base
  const accentMat = new THREE.MeshLambertMaterial({ color: accentColor });
  const eyeMat = new THREE.MeshBasicMaterial({ color: eyeColor });
  const scleraMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
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

  // Eyes (Left/Right)
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

  // Lips (drawn dynamically using CatmullRom)
  const LP = 7;
  const pts = Array.from({ length: LP }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const lipsGeo = new THREE.BufferGeometry();
  lipsGeo.setFromPoints(curve.getPoints(20));
  const lips = new THREE.Line(lipsGeo, lipMat);
  lips.position.set(0, -0.09, 0.2);
  head.add(lips);

  // Hair Strands (Procedural strands)
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

  // Back Bun
  if (style === "bun") {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(gender === "female" ? 0.09 : 0.07, 16, 16), hairMat);
    bun.position.set(0, 0.1, -0.22);
    head.add(bun);
  }

  let fW = 0.07;
  let fH = 0.02;
  let fBC = 0.02;

  return {
    update(time: number, delta: number, isBlinking: boolean, viseme: string, emotion: string, gazeTarget: THREE.Vector3) {
      // Blink
      lLid.scale.y = isBlinking ? 0.08 : 1.0;
      rLid.scale.y = isBlinking ? 0.08 : 1.0;

      // Eyebrow raises
      const browY = emotion === "surprised" ? 0.17 : emotion === "angry" ? 0.11 : 0.14;
      lBrow.position.y = THREE.MathUtils.lerp(lBrow.position.y, browY, 0.1);
      rBrow.position.y = THREE.MathUtils.lerp(rBrow.position.y, browY, 0.1);

      // Simple look at
      head.lookAt(gazeTarget);
      // reset rotation slightly
      head.rotation.x = Math.max(-0.2, Math.min(0.2, head.rotation.x));
      head.rotation.y = Math.max(-0.3, Math.min(0.3, head.rotation.y));

      // Visemes mapping
      const VMORPHS: Record<string, any> = {
        rest: { w: 0.06, h: 0.015, curve: 0.01 },
        M:    { w: 0.055, h: 0.002, curve: 0.0 },
        A:    { w: 0.08, h: 0.07, curve: 0.035 },
        E:    { w: 0.09, h: 0.035, curve: 0.045 },
        I:    { w: 0.075, h: 0.025, curve: 0.035 },
        O:    { w: 0.05, h: 0.07, curve: -0.01 },
        U:    { w: 0.035, h: 0.045, curve: -0.035 },
        F:    { w: 0.06, h: 0.01, curve: 0.01 },
      };
      
      let emoCurve = 0, hm = 1.0, wm = 1.0;
      if (emotion === "excited") { emoCurve = 0.065; hm = 1.2; wm = 1.1; }
      else if (emotion === "happy" || emotion === "friendly") { emoCurve = 0.045; }
      else if (emotion === "sad" || emotion === "concerned") { emoCurve = -0.055; }
      else if (emotion === "surprised") { emoCurve = 0.0; hm = 1.6; wm = 0.85; }
      
      const vcfg = VMORPHS[viseme] || VMORPHS.rest;
      const tw = vcfg.w * wm, th = vcfg.h * hm, tbc = vcfg.curve + emoCurve;
      
      fW = THREE.MathUtils.lerp(fW, tw, 0.2);
      fH = THREE.MathUtils.lerp(fH, th, 0.2);
      fBC = THREE.MathUtils.lerp(fBC, tbc, 0.2);

      for (let i = 0; i < LP; i++) {
        const theta = (i / (LP - 1)) * Math.PI * 2;
        const x = Math.cos(theta) * fW;
        const corner = (fW - Math.abs(x)) * fBC * 0.5;
        pts[i].set(x, Math.sin(theta) * fH + corner, 0);
      }
      
      curve.points = pts;
      lips.geometry.dispose();
      lips.geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));

      // Hair strands wind sway
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
