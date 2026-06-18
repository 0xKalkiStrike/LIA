// /* LIA AI — Complete Anime Character Engine (ES Module)
//  *
//  * Exports buildAnime(el, cfg) → controller {
//  *   wake(), sleep(), wave(), rest(), setViseme(v),
//  *   setEmotion(emotion), speakVisemes(text, durationMs),
//  *   stopSpeaking(), lookAt(x, y), gesture(name), _cleanup()
//  * }
//  *
//  * Features:
//  *  - VRM face-FORWARD (rotation = 0, using VRMUtils for VRM0 compat)
//  *  - Full body idle breathing, shoulder sway, hip sway
//  *  - Complete emotion expressions: happy, sad, angry, surprised, thinking, excited
//  *  - Smooth lerp-based morph targets — no snapping
//  *  - Lip sync: A/E/I/O/U/M/F visemes mapped to VRM blendshapes
//  *  - Saccade eye movement + mouse tracking
//  *  - Auto-blink (randomised intervals)
//  *  - Gesture system: wave, celebrate, think, listen, idle
//  *  - Secondary motion: ear/tail/hair bouncing via VRM spring bones
//  */

// import * as THREE from 'three';
// import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
// import * as VRM from 'three-vrm';

// /* ── Colour palette per suit accent ── */
// const ACCENT_HEX = {
//   cyan:    0x53D7F0,
//   gold:    0xE8B44A,
//   crimson: 0xF2647C,
//   violet:  0x9D7BF0,
//   rose:    0xFF8FB1,
// };

// /* ── VRM Expression name aliases (VRM0 ↔ VRM1 names) ── */
// const EXPR = {
//   // VRM1 preset names (three-vrm v1.x resolves both)
//   happy:     ['happy',    'joy',      'Joy'],
//   sad:       ['sad',      'sorrow',   'Sorrow'],
//   angry:     ['angry',    'Angry'],
//   surprised: ['surprised','Surprised'],
//   relaxed:   ['relaxed',  'neutral',  'Neutral'],
//   neutral:   ['neutral',  'Neutral'],
//   blink:     ['blink',    'Blink',    'blinkLeft', 'blinkRight'],
//   blinkL:    ['blinkLeft', 'Blink_L', 'blink'],
//   blinkR:    ['blinkRight','Blink_R', 'blink'],
//   aa:        ['aa',       'A',        'vowel_A'],
//   ee:        ['ee',       'e',        'E',  'vowel_E'],
//   ih:        ['ih',       'i',        'I',  'vowel_I'],
//   oh:        ['oh',       'o',        'O',  'vowel_O'],
//   ou:        ['ou',       'u',        'U',  'vowel_U'],
// };

// /* ── Resolve expression name: try aliases until one works ── */
// function setExpr(vrm, aliases, val) {
//   if (!vrm) return;
//   if (vrm.expressionManager) {
//     for (const name of aliases) {
//       try {
//         vrm.expressionManager.setValue(name, val);
//         vrm.expressionManager.setValue(name.toLowerCase(), val);
//       } catch (_) {}
//     }
//   } else if (vrm.blendShapeProxy) {
//     for (const name of aliases) {
//       try {
//         vrm.blendShapeProxy.setValue(name, val);
//       } catch (_) {}
//     }
//   }
// }
// function getExpr(vrm, aliases) {
//   if (!vrm) return 0;
//   if (vrm.expressionManager) {
//     for (const name of aliases) {
//       try {
//         const v = vrm.expressionManager.getValue(name) ?? vrm.expressionManager.getValue(name.toLowerCase());
//         if (v !== undefined && v !== null) return v;
//       } catch (_) {}
//     }
//   } else if (vrm.blendShapeProxy) {
//     for (const name of aliases) {
//       try {
//         const v = vrm.blendShapeProxy.getValue(name);
//         if (v !== undefined && v !== null) return v;
//       } catch (_) {}
//     }
//   }
//   return 0;
// }
// function getBoneNode(vrm, name) {
//   if (!vrm || !vrm.humanoid) return null;
//   if (vrm.humanoid.getNormalizedBoneNode) {
//     return vrm.humanoid.getNormalizedBoneNode(name);
//   }
//   if (vrm.humanoid.getBoneNode) {
//     return vrm.humanoid.getBoneNode(name);
//   }
//   return null;
// }
// function lerpExprFn(vrm, aliases) {
//   return (target, speed = 0.18) => {
//     const cur = getExpr(vrm, aliases);
//     const next = THREE.MathUtils.lerp(cur, target, speed);
//     setExpr(vrm, aliases, next);
//   };
// }

// /* ── Viseme target shapes ── */
// const VISEME_TARGETS = {
//   rest: { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0    },
//   M:    { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0.1  },
//   F:    { aa: 0,    ee: 0.2,  ih: 0,    oh: 0,    ou: 0    },
//   A:    { aa: 1.0,  ee: 0,    ih: 0,    oh: 0,    ou: 0    },
//   E:    { aa: 0,    ee: 0.9,  ih: 0,    oh: 0,    ou: 0    },
//   I:    { aa: 0,    ee: 0,    ih: 0.85, oh: 0,    ou: 0    },
//   O:    { aa: 0,    ee: 0,    ih: 0,    oh: 1.0,  ou: 0    },
//   U:    { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0.85 },
// };

// /* ── Emotion expression targets ── */
// const EMOTION_TARGETS = {
//   happy:     { happy: 1.0, sad: 0,   angry: 0,   surprised: 0,   relaxed: 0   },
//   excited:   { happy: 1.0, sad: 0,   angry: 0,   surprised: 0.5, relaxed: 0   },
//   friendly:  { happy: 0.7, sad: 0,   angry: 0,   surprised: 0,   relaxed: 0.3 },
//   sad:       { happy: 0,   sad: 1.0, angry: 0,   surprised: 0,   relaxed: 0   },
//   concerned: { happy: 0,   sad: 0.7, angry: 0.2, surprised: 0,   relaxed: 0   },
//   angry:     { happy: 0,   sad: 0,   angry: 1.0, surprised: 0,   relaxed: 0   },
//   surprised: { happy: 0,   sad: 0,   angry: 0,   surprised: 1.0, relaxed: 0   },
//   curious:   { happy: 0.2, sad: 0,   angry: 0,   surprised: 0.6, relaxed: 0   },
//   thinking:  { happy: 0,   sad: 0.2, angry: 0.2, surprised: 0,   relaxed: 0.3 },
//   focused:   { happy: 0,   sad: 0,   angry: 0.3, surprised: 0,   relaxed: 0.4 },
//   neutral:   { happy: 0,   sad: 0,   angry: 0,   surprised: 0,   relaxed: 0.4 },
// };

// /* ── Build the anime character ── */
// export function buildAnime(el, cfg) {
//   el.innerHTML = '';
//   el.style.position = 'relative';
//   el.style.overflow  = 'hidden';

//   const W = el.clientWidth  || 300;
//   const H = el.clientHeight || 300;

//   /* Canvas + Renderer */
//   const canvas = document.createElement('canvas');
//   canvas.style.width  = '100%';
//   canvas.style.height = '100%';
//   el.appendChild(canvas);

//   const renderer = new THREE.WebGLRenderer({
//     canvas,
//     antialias: true,
//     alpha: false,
//     preserveDrawingBuffer: false,
//   });
//   renderer.setSize(W, H);
//   renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

//   /*
//    * CRITICAL COLOR SETUP for three-vrm v1.0.8 + Three.js r139:
//    * - sRGBEncoding: gamma correction so textures display correctly
//    * - LinearToneMapping: REQUIRED for MToon — ACES/Reinhard desaturate anime colors
//    * - exposure 1.0: neutral, no color shift
//    */
//   renderer.outputEncoding      = THREE.sRGBEncoding;
//   renderer.toneMapping         = THREE.LinearToneMapping;
//   renderer.toneMappingExposure = 1.0;
//   renderer.physicallyCorrectLights = false;
//   renderer.sortObjects = false;
//   renderer.autoClearColor = true;

//   /* Scene — DARK background so character textures are visible */
//   const scene = new THREE.Scene();
//   /* Set dark background to reveal character colors and textures */
//   scene.background = new THREE.Color(0x1a1a2e);  /* Dark blue-black for character visibility */
//   scene.fog = null;
//   renderer.setClearColor(scene.background, 1.0);

//   /* Camera — tight bust/portrait framing with focus on face */
//   const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
//   camera.position.set(0, 0.65, 3.2);  /* Positioned to see face clearly */
//   camera.lookAt(0, 0.65, 0);

//   /*
//    * LIGHTING for MToon:
//    * MToon's toon shader responds to: AmbientLight + DirectionalLight.
//    * HemisphereLight is NOT supported by MToon's custom GLSL — use AmbientLight.
//    * Rule: keep ambient bright enough that shadingShiftFactor > 0 pushes ALL
//    * pixels into the lit zone → full texture colors visible.
//    */
//   const accentColor = ACCENT_HEX[cfg.char_outfit || cfg.outfit] || ACCENT_HEX.cyan;

//   /* Very bright ambient — MToon needs this to stay in lit zone */
//   const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
//   scene.add(ambientLight);

//   /* Strong key light from front-above — drives MToon's directional shading */
//   const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
//   keyLight.position.set(0.5, 3.0, 4.0);
//   scene.add(keyLight);

//   /* Soft fill from left */
//   const fillLight = new THREE.DirectionalLight(0xc8d8ff, 1.2);
//   fillLight.position.set(-3.0, 1.5, 2.0);
//   scene.add(fillLight);

//   /* Front-centre fill — ensures face never dark */
//   const frontFill = new THREE.DirectionalLight(0xffffff, 1.0);
//   frontFill.position.set(0, 0.5, 5.0);
//   scene.add(frontFill);

//   /* Coloured rim accent */
//   const rimLight = new THREE.DirectionalLight(accentColor, 1.2);
//   rimLight.position.set(2.5, 1.0, 2.0);
//   scene.add(rimLight);

//   /* Top hair light */
//   const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
//   topLight.position.set(0, 5, 1);
//   scene.add(topLight);

//   /* Holographic HUD rings */
//   const hudGroup = new THREE.Group();
//   scene.add(hudGroup);
//   const mkRing = (r, thick, col, op, tilt) => {
//     const m = new THREE.Mesh(
//       new THREE.TorusGeometry(r, thick, 8, 96),
//       new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op })
//     );
//     m.rotation.x = tilt;
//     hudGroup.add(m);
//     return m;
//   };
//   const ring1 = mkRing(2.2, 0.012, accentColor, 0.22, Math.PI / 2);
//   const ring2 = mkRing(1.95, 0.007, 0x9D7BF0, 0.14, Math.PI / 2.4);
//   const ring3 = mkRing(2.5, 0.005, accentColor, 0.08, Math.PI / 3);

//   /* State */
//   const st = {
//     isSleeping: cfg.asleep || false,
//     emotion: 'neutral',
//     viseme: 'rest',
//     lookTarget: new THREE.Vector3(0, 0, 1),
//     time: 0,
//     delta: 0,
//     clock: new THREE.Clock(),
//     visemeTimer: null,
//     blinkTimer: 0,
//     nextBlinkAt: _randBlink(),
//     blinkPhase: 'open',   // open | closing | opening
//     blinkSpeed: 0,
//     gestureTime: 0,
//     currentGesture: 'idle',
//     gesturePhase: 0,
//     emotionAge: 0,
//     lastMouseTime: Date.now(),
//     idleGazeT: 0,
//     idleGestureT: 0,
//     vrm: null,
//     // Arm pose targets (lerped each frame)
//     lArm: { x: 0, y: 0, z: -0.15 },
//     rArm: { x: 0, y: 0, z: 0.15 },
//     lForearm: { x: 0, y: 0, z: 0 },
//     rForearm: { x: 0, y: 0, z: 0 },
//     lHand: { x: 0, y: 0, z: 0 },
//     rHand: { x: 0, y: 0, z: 0 },
//     neck: { x: 0, y: 0, z: 0 },
//     head: { x: 0, y: 0, z: 0 },
//     spine: { x: 0, y: 0, z: 0 },
//     chest: { x: 0, y: 0, z: 0 },
//     hips: { x: 0, y: 0, z: 0 },
//   };

//   function _randBlink() { return 180 + Math.random() * 260; } // frames

//   /* Model group */
//   const modelGroup = new THREE.Group();
//   scene.add(modelGroup);

//   /* Fallback procedural avatar (if VRM fails) */
//   let fallback = null;

//   /* ── Environment Map ──
//    * MToon uses directional/ambient lighting (not PBR IBL).
//    * scene.environment is not needed for correct anime color rendering.
//    */
//   // No env map needed for MToon

//   /* ── Load VRM using three-vrm v1.x VRMLoaderPlugin ── */
//   const loader = new GLTFLoader();
//   if (VRM.VRMLoaderPlugin) {
//     loader.register((parser) => new VRM.VRMLoaderPlugin(parser));
//   }

//   const vrmPath = cfg.vrm_path || '/static/LIA.vrm';

//   loader.load(
//     vrmPath,
//     async (gltf) => {
//       let vrm = gltf.userData.vrm;

//       if (!vrm && VRM.VRM && VRM.VRM.from) {
//         try { vrm = await VRM.VRM.from(gltf); } catch(e) {}
//       }

//       if (!vrm) {
//         fallback = _buildFallback(modelGroup, accentColor, cfg);
//         return;
//       }

//       st.vrm = vrm;
//       modelGroup.add(vrm.scene);

//       /* ── ORIENTATION: VRM0 models face -Z by default.
//        *    Camera is at +Z looking at -Z. Rotate 180° (Math.PI) to face camera.
//        *    DO NOT call VRMUtils.rotateVRM0 — it corrupts MToon material state.
//        */
//       vrm.scene.rotation.y = Math.PI;
//       vrm.scene.position.set(0, -0.95, 0);
//       vrm.scene.scale.setScalar(1.0);

//       /* ── DEFINITIVE MToon color fix ──────────────────────────────────
//        * three-vrm v1.0.8 MToon materials have these key properties:
//        *   shadingShiftFactor: -1..1   (0.5 = push into lit zone = full color)
//        *   shadingToonyFactor: 0..1    (0.9 = hard toon edge)
//        * Standard Three.js materials: set texture color space.
//        * CSS canvas filter: absolute safety net for any residual B&W.
//        * ─────────────────────────────────────────────────────────────── */
//       let mtoonCount = 0, stdCount = 0;
//       vrm.scene.traverse(obj => {
//         if (!obj.isMesh) return;
//         obj.frustumCulled = false;

//         const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
//         mats.forEach(mat => {
//           if (!mat) return;

//           /* Fix texture color space — works for both MToon and standard */
//           ['map', 'emissiveMap', 'shadeMultiplyTexture', 'matcapTexture',
//            'rimMultiplyTexture', 'outlineWidthMultiplyTexture'].forEach(f => {
//             if (mat[f] && mat[f].isTexture) {
//               mat[f].encoding = THREE.sRGBEncoding;
//               mat[f].needsUpdate = true;
//             }
//           });

//           const isMToon = mat.isMToonMaterial ||
//                           (mat.constructor && mat.constructor.name &&
//                            mat.constructor.name.toLowerCase().includes('mtoon'));

//           if (isMToon) {
//             mtoonCount++;
//             /* Push shading boundary: keeps full-lit region visible in color */
//             if ('shadingShiftFactor' in mat) mat.shadingShiftFactor = 0.5;
//             if ('shadingToonyFactor' in mat) mat.shadingToonyFactor = 0.9;
//             /* Disable matcap which can cause grayscale-like rendering */
//             if ('matcapFactor' in mat) mat.matcapFactor = new THREE.Color(0, 0, 0);
//             /* Disable rim that may compete with main color */
//             if ('rimLightingMixFactor' in mat) mat.rimLightingMixFactor = 0.0;
//           } else {
//             stdCount++;
//             /* Standard PBR: ensure roughness/metalness don't gray it out */
//             if ('roughness' in mat) mat.roughness = Math.min(mat.roughness, 0.8);
//             if ('metalness' in mat) mat.metalness = Math.min(mat.metalness, 0.2);
//           }

//           mat.needsUpdate = true;
//         });
//       });

//       /* CSS safety net — if WebGL output still looks grey, saturate via CSS */
//       canvas.style.filter = 'saturate(1.4) brightness(1.05)';

//       _applyIdlePose(vrm);
//       console.log(`✓ VRM loaded: ${mtoonCount} MToon + ${stdCount} standard materials. Color fix applied.`);
//     },
//     () => {},
//     (err) => {
//       console.warn('VRM not found → procedural fallback:', err);
//       fallback = _buildFallback(modelGroup, accentColor, cfg);
//     }
//   );

//   /* ── Apply initial T-pose → comfortable idle pose ── */
//   function _applyIdlePose(vrm) {
//     function boneRot(name, x, y, z) {
//       const b = getBoneNode(vrm, name);
//       if (b) { b.rotation.x = x; b.rotation.y = y; b.rotation.z = z; }
//     }
//     // Relax arms into a natural rest pose
//     boneRot('leftUpperArm',  0,  0, -0.65);
//     boneRot('rightUpperArm', 0,  0,  0.65);
//     boneRot('leftLowerArm',  0,  0, -0.12);
//     boneRot('rightLowerArm', 0,  0,  0.12);
//     boneRot('leftHand',      0.0, 0, -0.05);
//     boneRot('rightHand',     0.0, 0,  0.05);
//     boneRot('spine',         0.02, 0, 0);
//     boneRot('chest',         0.0, 0, 0);
//     boneRot('neck',          0.0, 0, 0);
//     boneRot('head',          0.0, 0, 0);
//   }

//   /* ── Mouse look ── */
//   function onMouseMove(e) {
//     if (st.isSleeping) return;
//     st.lastMouseTime = Date.now();
//     const rect = canvas.getBoundingClientRect();
//     const dx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
//     const dy = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
//     st.lookTarget.set(dx * 0.9, dy * 0.55, 1);
//   }
//   window.addEventListener('mousemove', onMouseMove);

//   /* ────────────────────────────────────────────
//    *  GESTURE DEFINITIONS
//    *  Each gesture sets target bone rotations that
//    *  the main loop lerps toward each frame.
//    * ──────────────────────────────────────────── */
//   function _setGestureTargets(gesture, t) {
//     const sin = Math.sin, cos = Math.cos;

//     switch (gesture) {
//       /* ── IDLE: gentle sway, arms at side ── */
//       case 'idle':
//       default:
//         st.lArm = { x: 0,    y: 0,  z: -0.65 + sin(t * 0.6) * 0.04 };
//         st.rArm = { x: 0,    y: 0,  z:  0.65 + sin(t * 0.6 + 1) * 0.04 };
//         st.lForearm = { x: 0.05, y: 0, z: -0.08 };
//         st.rForearm = { x: 0.05, y: 0, z:  0.08 };
//         st.lHand = { x: 0, y: 0, z: 0 };
//         st.rHand = { x: 0, y: 0, z: 0 };
//         st.spine = { x: 0.02, y: sin(t * 0.4) * 0.015, z: 0 };
//         st.chest = { x: 0,    y: 0, z: sin(t * 0.4) * 0.01 };
//         break;

//       /* ── WAVE: right arm waving hello ── */
//       case 'wave':
//         st.rArm = { x: -0.3, y: -0.3, z: 0.9 + sin(t * 6) * 0.25 };
//         st.rForearm = { x: 0.6 + sin(t * 6) * 0.3, y: 0, z: 0 };
//         st.rHand = { x: 0, y: sin(t * 6) * 0.2, z: 0 };
//         st.lArm = { x: 0, y: 0, z: -0.65 };
//         st.lForearm = { x: 0.05, y: 0, z: 0 };
//         st.spine = { x: 0.02, y: 0, z: 0 };
//         break;

//       /* ── CELEBRATE: both arms raised, victory ── */
//       case 'celebrate':
//         st.lArm = { x: -0.2, y: 0.2,  z: -(0.9 + sin(t * 8) * 0.15) };
//         st.rArm = { x: -0.2, y: -0.2, z:   0.9 + sin(t * 8 + 0.5) * 0.15 };
//         st.lForearm = { x: 0.4 + sin(t * 8) * 0.2, y: 0, z: 0 };
//         st.rForearm = { x: 0.4 + sin(t * 8) * 0.2, y: 0, z: 0 };
//         st.lHand = { x: sin(t * 8) * 0.3, y: 0, z: 0 };
//         st.rHand = { x: sin(t * 8) * 0.3, y: 0, z: 0 };
//         st.spine = { x: -0.05, y: sin(t * 4) * 0.04, z: 0 };
//         break;

//       /* ── THINKING: one hand near chin, slight tilt ── */
//       case 'thinking':
//         st.lArm = { x: 0.25, y: 0.1,  z: -0.25 };
//         st.lForearm = { x: 1.2, y: -0.1, z: 0 };
//         st.lHand = { x: -0.4, y: 0, z: -0.2 };
//         st.rArm = { x: 0,    y: 0,   z: 0.65 };
//         st.rForearm = { x: 0.1, y: 0, z: 0 };
//         st.rHand = { x: 0, y: 0, z: 0 };
//         st.neck = { x: sin(t * 1.2) * 0.04, y: 0.07, z: 0.08 };
//         st.spine = { x: 0.05, y: 0.04, z: 0 };
//         break;

//       /* ── LISTENING: slight forward lean, attentive ── */
//       case 'listening':
//         st.lArm = { x: 0.1, y: 0, z: -0.5 };
//         st.rArm = { x: 0.1, y: 0, z:  0.5 };
//         st.lForearm = { x: 0.3, y: 0, z: 0 };
//         st.rForearm = { x: 0.3, y: 0, z: 0 };
//         st.spine = { x: 0.07 + sin(t * 1.5) * 0.015, y: 0, z: 0 };
//         st.neck = { x: -0.06, y: sin(t * 1.5) * 0.06, z: 0.05 };
//         break;

//       /* ── FRIENDLY: open arms, relaxed, welcoming ── */
//       case 'friendly':
//         st.lArm = { x: 0, y: 0.15,  z: -(0.45 + sin(t * 2.5) * 0.08) };
//         st.rArm = { x: 0, y: -0.15, z:   0.45 + sin(t * 2.5 + 1.2) * 0.08 };
//         st.lForearm = { x: 0.15, y: 0.1,  z: 0 };
//         st.rForearm = { x: 0.15, y: -0.1, z: 0 };
//         st.lHand = { x: 0, y: 0, z: 0.1 };
//         st.rHand = { x: 0, y: 0, z: -0.1 };
//         st.spine = { x: 0, y: sin(t * 1.5) * 0.02, z: 0 };
//         break;

//       /* ── SURPRISED: hands up, startle ── */
//       case 'surprised':
//         st.lArm = { x: -0.3, y: 0.1,  z: -0.85 + sin(t * 7) * 0.1 };
//         st.rArm = { x: -0.3, y: -0.1, z:  0.85 + sin(t * 7) * 0.1 };
//         st.lForearm = { x: 0.8, y: 0, z: 0 };
//         st.rForearm = { x: 0.8, y: 0, z: 0 };
//         st.neck = { x: -0.1, y: 0, z: 0 };
//         st.spine = { x: -0.04, y: 0, z: 0 };
//         break;

//       /* ── TALKING: light hand gestures while speaking ── */
//       case 'talking':
//         const swing = sin(t * 4.5) * 0.12;
//         st.rArm = { x: 0.1,   y: 0,   z: 0.5 + swing };
//         st.rForearm = { x: 0.35 + sin(t * 4.5 + 1) * 0.15, y: 0, z: 0 };
//         st.rHand = { x: sin(t * 4.5) * 0.15, y: 0, z: 0 };
//         st.lArm = { x: 0,     y: 0.05, z: -0.7 };
//         st.lForearm = { x: 0.1, y: 0, z: 0 };
//         st.spine = { x: 0, y: sin(t * 2) * 0.02, z: 0 };
//         break;

//       /* ── ANGRY: tense arms, leaning forward ── */
//       case 'angry':
//         st.lArm = { x: 0.1, y: 0, z: -0.5 };
//         st.rArm = { x: 0.1, y: 0, z:  0.5 };
//         st.lForearm = { x: 0.6 + sin(t * 5) * 0.05, y: 0, z: 0 };
//         st.rForearm = { x: 0.6 + sin(t * 5) * 0.05, y: 0, z: 0 };
//         st.spine = { x: 0.06, y: sin(t * 4) * 0.02, z: 0 };
//         st.neck = { x: 0.04, y: sin(t * 3) * 0.04, z: 0 };
//         break;

//       /* ── POINTING: right arm out to point at something ── */
//       case 'point':
//         st.rArm = { x: -0.2, y: -0.4, z: 0.3 };
//         st.rForearm = { x: 0, y: -0.3, z: 0 };
//         st.rHand = { x: 0, y: 0, z: 0.1 };
//         st.lArm = { x: 0, y: 0, z: -0.65 };
//         break;
//     }
//   }

//   /* ── Linely lerp a rotation set toward target ── */
//   function lerpBone(bone, target, speed = 0.12) {
//     if (!bone) return;
//     if (target.x !== undefined) bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, target.x, speed);
//     if (target.y !== undefined) bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, target.y, speed);
//     if (target.z !== undefined) bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, target.z, speed);
//   }

//   /* ────────────────────────────────────
//    *  RENDER LOOP
//    * ──────────────────────────────────── */
//   let reqId = null;

//   function animate() {
//     reqId = requestAnimationFrame(animate);
//     const delta = st.clock.getDelta();
//     st.time += delta;
//     st.delta = delta;

//     /* Rotate HUD rings */
//     hudGroup.rotation.z += 0.0025;
//     ring1.rotation.y = Math.sin(st.time * 0.35) * 0.08;
//     ring2.rotation.y = Math.cos(st.time * 0.28) * 0.06;
//     ring3.rotation.x += 0.001;

//     if (st.isSleeping) {
//       /* Gentle bob while asleep */
//       if (st.vrm) {
//         st.vrm.scene.position.y = -0.95 + Math.sin(st.time * 0.5) * 0.008;
//         st.vrm.update(delta);
//       }
//       renderer.render(scene, camera);
//       return;
//     }

//     /* ── Idle gaze saccades ── */
//     st.idleGazeT += delta;
//     const timeSinceMouse = Date.now() - st.lastMouseTime;
//     if (timeSinceMouse > 2000) {
//       const driftX = Math.sin(st.idleGazeT * 0.38) * 0.18 + Math.cos(st.idleGazeT * 1.4) * 0.05;
//       const driftY = Math.cos(st.idleGazeT * 0.32) * 0.10 + Math.sin(st.idleGazeT * 1.2) * 0.03;
//       if (Math.sin(st.idleGazeT * 0.12) > 0.96) {
//         // saccade: quick snap glance
//         st.lookTarget.set(driftX * 2.2, driftY * 1.8, 1);
//       } else {
//         st.lookTarget.x = THREE.MathUtils.lerp(st.lookTarget.x, driftX, 0.035);
//         st.lookTarget.y = THREE.MathUtils.lerp(st.lookTarget.y, driftY, 0.035);
//       }
//     }

//     /* ── Random idle gesture cycling ── */
//     st.idleGestureT += delta;
//     if (st.idleGestureT > 15 + Math.random() * 5) {
//       st.idleGestureT = 0;
//       if (st.currentGesture === 'idle') {
//         const picks = ['listening', 'friendly', 'thinking', 'talking'];
//         const g = picks[Math.floor(Math.random() * picks.length)];
//         controller.gesture(g);
//         setTimeout(() => { if (st.currentGesture === g) controller.gesture('idle'); },
//           2500 + Math.random() * 3000);
//       }
//     }

//     /* ── Blink state machine ── */
//     st.blinkTimer++;
//     if (st.blinkTimer >= st.nextBlinkAt && st.blinkPhase === 'open') {
//       st.blinkPhase = 'closing';
//       st.blinkSpeed = 0.45 + Math.random() * 0.25;
//     }
//     let blinkVal = 0;
//     if (st.blinkPhase === 'closing') {
//       const cur = getExpr(st.vrm, EXPR.blink);
//       const next = Math.min(1, cur + st.blinkSpeed);
//       blinkVal = next;
//       if (next >= 0.98) { st.blinkPhase = 'opening'; }
//     } else if (st.blinkPhase === 'opening') {
//       const cur = getExpr(st.vrm, EXPR.blink);
//       const next = Math.max(0, cur - st.blinkSpeed);
//       blinkVal = next;
//       if (next <= 0.02) {
//         st.blinkPhase = 'open';
//         st.blinkTimer  = 0;
//         st.nextBlinkAt = _randBlink();
//       }
//     }

//     /* ── VRM update ── */
//     if (st.vrm) {
//       const G = n => getBoneNode(st.vrm, n);

//       /* Bones */
//       const neckBone   = G('neck');
//       const headBone   = G('head');
//       const spineBone  = G('spine');
//       const chestBone  = G('chest') || G('upperChest');
//       const hipsBone   = G('hips');
//       const lArmBone   = G('leftUpperArm');
//       const rArmBone   = G('rightUpperArm');
//       const lForeArm   = G('leftLowerArm');
//       const rForeArm   = G('rightLowerArm');
//       const lHandBone  = G('leftHand');
//       const rHandBone  = G('rightHand');
//       const lEyeBone   = G('leftEye');
//       const rEyeBone   = G('rightEye');

//       /* Breathing — chest and spine sway */
//       const breathe = Math.sin(st.time * 1.35) * 0.012;
//       if (st.vrm.scene) {
//         st.vrm.scene.position.y = -0.95 + breathe;
//       }

//       /* Gesture bone targets */
//       st.gestureTime += delta;
//       _setGestureTargets(st.currentGesture, st.gestureTime);

//       /* Apply with lerp */
//       lerpBone(lArmBone,  st.lArm,    0.10);
//       lerpBone(rArmBone,  st.rArm,    0.10);
//       lerpBone(lForeArm,  st.lForearm, 0.12);
//       lerpBone(rForeArm,  st.rForearm, 0.12);
//       lerpBone(lHandBone, st.lHand,   0.14);
//       lerpBone(rHandBone, st.rHand,   0.14);
//       lerpBone(spineBone, st.spine,   0.08);
//       lerpBone(chestBone, st.chest,   0.08);

//       /* Gaze — neck + head + eyes */
//       if (neckBone) {
//         neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, st.lookTarget.x * 0.28, 0.07);
//         neckBone.rotation.x = THREE.MathUtils.lerp(neckBone.rotation.x, st.neck.x - st.lookTarget.y * 0.14, 0.07);
//         neckBone.rotation.z = THREE.MathUtils.lerp(neckBone.rotation.z, st.neck.z, 0.07);
//       }
//       if (headBone) {
//         headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, st.lookTarget.x * 0.10 + st.head.y, 0.07);
//         headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, st.head.x, 0.07);
//         headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, st.head.z, 0.07);
//       }
//       if (lEyeBone && rEyeBone) {
//         const ey = THREE.MathUtils.lerp(lEyeBone.rotation.y, st.lookTarget.x * 0.45, 0.12);
//         const ex = THREE.MathUtils.lerp(lEyeBone.rotation.x, -st.lookTarget.y * 0.28, 0.12);
//         lEyeBone.rotation.y = ey; lEyeBone.rotation.x = ex;
//         rEyeBone.rotation.y = ey; rEyeBone.rotation.x = ex;
//       }

//       /* ── Expressions ── */
//       if (st.vrm.expressionManager || st.vrm.blendShapeProxy) {
//         /* Blink */
//         setExpr(st.vrm, EXPR.blink, blinkVal);

//         /* Emotion */
//         const emo = EMOTION_TARGETS[st.emotion] || EMOTION_TARGETS.neutral;
//         st.emotionAge = Math.min(1, st.emotionAge + delta * 1.8);
//         const blend = st.emotionAge;

//         setExpr(st.vrm, EXPR.happy,     THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.happy),     emo.happy     * blend, 0.10));
//         setExpr(st.vrm, EXPR.sad,       THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.sad),       emo.sad       * blend, 0.10));
//         setExpr(st.vrm, EXPR.angry,     THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.angry),     emo.angry     * blend, 0.10));
//         setExpr(st.vrm, EXPR.surprised, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.surprised), emo.surprised * blend, 0.10));
//         setExpr(st.vrm, EXPR.relaxed,   THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.relaxed),   emo.relaxed   * blend, 0.10));

//         /* Viseme — morph lips */
//         const vt = VISEME_TARGETS[st.viseme] || VISEME_TARGETS.rest;
//         setExpr(st.vrm, EXPR.aa, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.aa), vt.aa, 0.28));
//         setExpr(st.vrm, EXPR.ee, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ee), vt.ee, 0.28));
//         setExpr(st.vrm, EXPR.ih, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ih), vt.ih, 0.28));
//         setExpr(st.vrm, EXPR.oh, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.oh), vt.oh, 0.28));
//         setExpr(st.vrm, EXPR.ou, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ou), vt.ou, 0.28));

//         if (st.vrm.blendShapeProxy) {
//           st.vrm.blendShapeProxy.update();
//         }
//       }

//       st.vrm.update(delta);
//     }

//     /* ── Procedural fallback ── */
//     if (fallback) {
//       fallback.update(st.time, delta, blinkVal > 0.5, st.viseme, st.emotion);
//     }

//     renderer.render(scene, camera);
//   }
//   animate();

//   /* Resize handler */
//   function onResize() {
//     const w = el.clientWidth, h = el.clientHeight;
//     camera.aspect = w / h;
//     camera.updateProjectionMatrix();
//     renderer.setSize(w, h);
//   }
//   window.addEventListener('resize', onResize);

//   /* ──────────────────────────────────────────
//    *  PUBLIC CONTROLLER
//    * ────────────────────────────────────────── */
//   const controller = {
//     wake() {
//       return new Promise(resolve => {
//         st.isSleeping = false;
//         let n = 0;
//         const iv = setInterval(() => {
//           modelGroup.visible = (n % 2 === 0);
//           if (n++ > 7) { clearInterval(iv); modelGroup.visible = true; resolve(); }
//         }, 80);
//       });
//     },
//     sleep() {
//       st.isSleeping = true;
//       modelGroup.visible = true;
//     },
//     wave() {
//       if (st.isSleeping) return;
//       controller.gesture('wave');
//       setTimeout(() => { if (st.currentGesture === 'wave') controller.gesture('idle'); }, 3000);
//     },
//     setEmotion(emotion) {
//       if (st.isSleeping) return;
//       st.emotion = emotion;
//       st.emotionAge = 0;

//       /* Emotion → gesture mapping */
//       const gestureMap = {
//         excited:   'celebrate',
//         happy:     'friendly',
//         friendly:  'friendly',
//         sad:       'thinking',
//         concerned: 'thinking',
//         angry:     'angry',
//         thinking:  'thinking',
//         focused:   'listening',
//         surprised: 'surprised',
//         curious:   'listening',
//       };
//       controller.gesture(gestureMap[emotion] || 'idle');

//       /* Rim light colour by emotion */
//       const lightMap = {
//         excited:   0xFF8FB1, happy: 0xFFD080, friendly: 0xA0E8A0,
//         sad:       0x6080FF, concerned: 0x9060C0,
//         angry:     0xFF4040, surprised: 0xFFFF60,
//         thinking:  0xE8B44A, focused: 0x80D0FF,
//       };
//       rimLight.color.setHex(lightMap[emotion] || accentColor);
//     },
//     setViseme(v) {
//       if (st.isSleeping) return;
//       st.viseme = v;
//     },
//     rest() {
//       st.viseme = 'rest';
//       /* Don't reset gesture — let it finish naturally */
//     },
//     speakVisemes(text, durationMs) {
//       if (st.isSleeping) return;
//       controller.gesture('talking');
//       const seq = _textToVisemes(text);
//       const step = Math.max(65, durationMs / seq.length);
//       let i = 0;
//       clearInterval(st.visemeTimer);
//       st.visemeTimer = setInterval(() => {
//         if (i >= seq.length) {
//           clearInterval(st.visemeTimer);
//           controller.rest();
//           return;
//         }
//         controller.setViseme(seq[i++]);
//       }, step);
//     },
//     stopSpeaking() {
//       clearInterval(st.visemeTimer);
//       controller.rest();
//     },
//     lookAt(x, y) {
//       if (st.isSleeping) return;
//       st.lastMouseTime = Date.now();
//       st.lookTarget.set(x, y, 1);
//     },
//     gesture(name) {
//       if (st.isSleeping) return;
//       st.currentGesture = name;
//       st.gestureTime = 0;
//     },
//     _cleanup() {
//       cancelAnimationFrame(reqId);
//       clearInterval(st.visemeTimer);
//       window.removeEventListener('mousemove', onMouseMove);
//       window.removeEventListener('resize', onResize);
//       renderer.dispose();
//     }
//   };

//   window.currentAvatarController = controller;
//   window.__vrm_debug_st = st;
//   window.__vrm_debug_scene = scene;
//   return controller;
// }

// /* Legacy global binding */
// window.buildAnime = buildAnime;

// /* ────────────────────────────────────────────────────────────────
//  * _textToVisemes — maps plain text → viseme sequence
//  * ──────────────────────────────────────────────────────────────── */
// function _textToVisemes(text) {
//   if (!text) return ['rest'];
//   const rules = [
//     [/[aæ]/gi,      'A'],
//     [/[eɛ]/gi,      'E'],
//     [/[iɪy]/gi,     'I'],
//     [/[oɔ]/gi,      'O'],
//     [/[uʊ]/gi,      'U'],
//     [/[mbp]/gi,     'M'],
//     [/[fv]/gi,      'F'],
//     [/[tdnlrsz]/gi, 'E'],
//     [/[kg]/gi,      'A'],
//     [/[wh]/gi,      'O'],
//   ];
//   const seq = [];
//   const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
//   for (const word of words) {
//     if (!word) { seq.push('rest'); continue; }
//     for (const ch of word) {
//       let matched = false;
//       for (const [re, vis] of rules) {
//         re.lastIndex = 0;
//         if (re.test(ch)) { seq.push(vis); matched = true; break; }
//       }
//       if (!matched) seq.push('rest');
//     }
//     seq.push('rest');
//   }
//   return seq.length ? seq : ['rest'];
// }

// /* ────────────────────────────────────────────────────────────────
//  * PROCEDURAL FALLBACK — full anime-style 3D character
//  * (used only if LIA.vrm fails to load)
//  * ──────────────────────────────────────────────────────────────── */
// function _buildFallback(parent, themeColor, c) {
//   const gender = c.char_gender || c.gender || 'female';
//   const grp = new THREE.Group();
//   grp.position.set(0, -0.15, 0);
//   parent.add(grp);

//   /* Materials */
//   const skinHex = { porcelain: 0xF6E3D5, fair: 0xECC9B8, tan: 0xD9A06E, brown: 0xA86A3E, deep: 0x6E4426 }[c.char_skin || 'fair'] || 0xECC9B8;
//   const eyeHex = { sapphire: 0x3B6FD4, emerald: 0x2E9C72, amber: 0xC98A2E, violet: 0x8B5CD6, rose: 0xD45C82, crimson: 0xC0392B }[c.char_eyes || 'sapphire'] || 0x3B6FD4;
//   const hairHex = { black: 0x1b1424, brown: 0x4a2c11, blonde: 0xdcb45a, pink: 0xe36c99, blue: 0x2d51b3, violet: 0x613cb3, white: 0xe1e5f0 }[c.char_hair_color || 'black'] || 0x1b1424;

//   const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.45, metalness: 0.05 });
//   const hairMat = new THREE.MeshPhongMaterial({ color: hairHex, shininess: 90, specular: 0x444444 });
//   const eyeMat  = new THREE.MeshBasicMaterial({ color: eyeHex });
//   const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFDFDFD });
//   const darkMat  = new THREE.MeshBasicMaterial({ color: 0x111111 });
//   const lipMat   = new THREE.LineBasicMaterial({ color: 0xE25F75, linewidth: 3 });

//   /* Body / Neck / Shoulders */
//   const bodyMat = new THREE.MeshPhongMaterial({ color: themeColor, shininess: 60 });
//   const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.0, 1.1, 32), bodyMat);
//   body.position.set(0, -1.3, 0);
//   grp.add(body);

//   const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.55, 16), skinMat);
//   neck.position.set(0, -0.55, 0);
//   grp.add(neck);

//   /* Head */
//   const head = new THREE.Group();
//   grp.add(head);
//   const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.88, 64, 64), skinMat);
//   headMesh.scale.set(1.0, 1.12, 1.02);
//   head.add(headMesh);

//   /* Nose */
//   const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), skinMat);
//   nose.rotation.x = -Math.PI / 6; nose.position.set(0, 0.05, 0.88);
//   head.add(nose);

//   /* Eyes */
//   function mkEye(side) {
//     const eg = new THREE.Group();
//     eg.position.set(side * 0.3, 0.18, 0.8);
//     const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), whiteMat);
//     const iris   = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), eyeMat);
//     iris.position.z = 0.1; iris.translateZ(0.01);
//     const pupil  = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12), darkMat);
//     pupil.position.z = 0.112;
//     const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), whiteMat);
//     highlight.position.set(0.02, 0.025, 0.115);
//     eg.add(sclera, iris, pupil, highlight);
//     head.add(eg);
//     return eg;
//   }
//   const leftEye  = mkEye(-1);
//   const rightEye = mkEye(1);

//   /* Eyelids */
//   function mkLid(side) {
//     const lidGeo = new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
//     lidGeo.rotateX(Math.PI / 2);
//     const lid = new THREE.Mesh(lidGeo, skinMat);
//     lid.position.set(side * 0.3, 0.18, 0.8);
//     grp.add(lid);
//     return lid;
//   }
//   const lLid = mkLid(-1), rLid = mkLid(1);

//   /* Eyebrows */
//   const browMat = new THREE.MeshBasicMaterial({ color: hairHex });
//   function mkBrow(side) {
//     const bg = new THREE.CylinderGeometry(0.012, 0.004, 0.28, 6);
//     bg.rotateZ(Math.PI / 2.4);
//     const b = new THREE.Mesh(bg, browMat);
//     b.position.set(side * 0.3, 0.38, 0.88);
//     if (side > 0) b.scale.x = -1;
//     head.add(b);
//     return b;
//   }
//   const lBrow = mkBrow(-1), rBrow = mkBrow(1);

//   /* Lips — CatmullRom */
//   const LP = 7;
//   const pts = Array.from({ length: LP }, () => new THREE.Vector3());
//   const curve = new THREE.CatmullRomCurve3(pts, true);
//   const lipsGeo = new THREE.BufferGeometry();
//   lipsGeo.setFromPoints(curve.getPoints(24));
//   const lips = new THREE.Line(lipsGeo, lipMat);
//   lips.position.set(0, -0.36, 0.94);
//   head.add(lips);

//   /* Hair */
//   const style = c.char_hair_style || 'long';
//   const STRANDS = gender === 'female' ? 22 : 14;
//   const SEG = style === 'short' || style === 'spiky' ? 4 : 6;
//   const SEG_LEN = style === 'short' ? 0.28 : style === 'spiky' ? 0.22 : 0.44;
//   const strandsData = [], strandMeshes = [];
//   for (let s = 0; s < STRANDS; s++) {
//     const ang = (s / STRANDS) * Math.PI - Math.PI / 2;
//     const rx = Math.cos(ang) * 0.88;
//     const ry = 0.42 + Math.sin(Math.abs(ang)) * 0.35;
//     const rz = -0.22 + Math.cos(Math.abs(ang)) * 0.45;
//     const nodes = [];
//     for (let i = 0; i < SEG; i++) {
//       let px = rx, py = ry - i * SEG_LEN, pz = rz - i * 0.08;
//       if (style === 'wave') px += Math.sin(i * 1.5 + s) * 0.07;
//       else if (style === 'curly') { px += Math.sin(i * 2.5 + s) * 0.05; pz += Math.cos(i * 2.5 + s) * 0.05; }
//       else if (style === 'spiky') { const d = Math.sqrt(px*px + py*py + pz*pz); px += (px/d)*i*0.07; py += (py/d)*i*0.07; pz += (pz/d)*i*0.07; }
//       nodes.push({ pos: new THREE.Vector3(px, py, pz), prev: new THREE.Vector3(px, py, pz) });
//     }
//     strandsData.push(nodes);
//     const sc = new THREE.CatmullRomCurve3(nodes.map(n => n.pos));
//     const sm = new THREE.Mesh(new THREE.TubeGeometry(sc, 6, 0.07 - s * 0.001, 6, false), hairMat);
//     grp.add(sm);
//     strandMeshes.push(sm);
//   }
//   if (style === 'bun') {
//     const bun = new THREE.Mesh(new THREE.SphereGeometry(gender === 'female' ? 0.3 : 0.24, 24, 24), hairMat);
//     bun.position.set(0, gender === 'female' ? 0.42 : 0.68, -0.82);
//     head.add(bun);
//   }

//   /* Fallback mouth state */
//   let fW = 0.2, fH = 0.06, fBC = 0.05;

//   return {
//     update(time, delta, isBlinking, viseme, emotion) {
//       /* Blink */
//       lLid.scale.y = isBlinking ? 0.06 : 1.0;
//       rLid.scale.y = isBlinking ? 0.06 : 1.0;

//       /* Eyebrow raise by emotion */
//       const browY = emotion === 'surprised' ? 0.46 : emotion === 'angry' ? 0.3 : 0.38;
//       lBrow.position.y = THREE.MathUtils.lerp(lBrow.position.y, browY, 0.1);
//       rBrow.position.y = THREE.MathUtils.lerp(rBrow.position.y, browY, 0.1);

//       /* Lips morphing */
//       const VMORPHS = {
//         rest: { w: 1.2, h: 0.1,  curve: 0.05  },
//         M:    { w: 1.0, h: 0.0,  curve: 0.0   },
//         A:    { w: 1.5, h: 1.2,  curve: 0.15  },
//         E:    { w: 1.7, h: 0.6,  curve: 0.25  },
//         I:    { w: 1.4, h: 0.4,  curve: 0.15  },
//         O:    { w: 1.0, h: 1.3,  curve: -0.05 },
//         U:    { w: 0.7, h: 0.8,  curve: -0.15 },
//         F:    { w: 1.1, h: 0.25, curve: 0.05  },
//       };
//       let emoCurve = 0, hm = 1.0, wm = 1.0;
//       if (emotion === 'excited')   { emoCurve = 0.45; hm = 1.3; wm = 1.1; }
//       else if (emotion === 'happy' || emotion === 'friendly') { emoCurve = 0.3; }
//       else if (emotion === 'sad'  || emotion === 'concerned') { emoCurve = -0.35; }
//       else if (emotion === 'surprised') { emoCurve = 0.0; hm = 1.8; wm = 0.85; }
//       else if (emotion === 'thinking')  { emoCurve = -0.05; wm = 0.75; hm = 0.15; }
//       const cfg = VMORPHS[viseme] || VMORPHS.rest;
//       const tw = cfg.w * wm * 0.2, th = cfg.h * hm * 0.12, tbc = cfg.curve + emoCurve * 0.22;
//       fW  = THREE.MathUtils.lerp(fW,  tw,  0.22);
//       fH  = THREE.MathUtils.lerp(fH,  th,  0.22);
//       fBC = THREE.MathUtils.lerp(fBC, tbc, 0.22);
//       for (let i = 0; i < LP; i++) {
//         const theta = (i / (LP - 1)) * Math.PI * 2;
//         const x = Math.cos(theta) * fW;
//         const corner = (fW - Math.abs(x)) * fBC * 0.5;
//         pts[i].set(x, Math.sin(theta) * fH + corner, 0);
//       }
//       curve.points = pts;
//       lips.geometry.setFromPoints(curve.getPoints(24));

//       /* Hair physics (Verlet) */
//       const windX = Math.sin(time * 3.1) * 0.06, windZ = Math.cos(time * 2.2) * 0.06;
//       for (let s = 0; s < STRANDS; s++) {
//         const nodes = strandsData[s], mesh = strandMeshes[s];
//         const ang = (s / STRANDS) * Math.PI - Math.PI / 2;
//         const rx = Math.cos(ang) * 0.88, ry = 0.42 + Math.sin(Math.abs(ang)) * 0.35, rz = -0.22 + Math.cos(Math.abs(ang)) * 0.45;
//         const wr = new THREE.Vector3(rx, ry, rz).applyMatrix4(headMesh.matrixWorld);
//         nodes[0].pos.copy(wr); nodes[0].prev.copy(wr);
//         for (let i = 1; i < SEG; i++) {
//           const n = nodes[i], tmp = n.pos.clone();
//           const vel = n.pos.clone().sub(n.prev).multiplyScalar(0.88);
//           n.pos.add(vel); n.pos.y -= 0.013; n.pos.x += windX * 0.018; n.pos.z += windZ * 0.018;
//           n.prev.copy(tmp);
//         }
//         for (let it = 0; it < 2; it++) {
//           for (let i = 0; i < SEG - 1; i++) {
//             const n1 = nodes[i], n2 = nodes[i+1];
//             const d = n2.pos.clone().sub(n1.pos), len = d.length(), err = SEG_LEN - len, off = d.normalize().multiplyScalar(err * 0.5);
//             if (i > 0) n1.pos.sub(off); n2.pos.add(off);
//           }
//         }
//         mesh.geometry.dispose();
//         mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nodes.map(n => n.pos)), 6, 0.055 - s * 0.001, 6, false);
//       }
//     }
//   };
// }


/* LIA AI — Complete Anime Character Engine (ES Module)
 *
 * Exports buildAnime(el, cfg) → controller {
 *   wake(), sleep(), wave(), rest(), setViseme(v),
 *   setEmotion(emotion), speakVisemes(text, durationMs),
 *   stopSpeaking(), lookAt(x, y), gesture(name), _cleanup()
 * }
 *
 * Features:
 *  - VRM face-FORWARD (rotation = 0, using VRMUtils for VRM0 compat)
 *  - Full body idle breathing, shoulder sway, hip sway
 *  - Complete emotion expressions: happy, sad, angry, surprised, thinking, excited
 *  - Smooth lerp-based morph targets — no snapping
 *  - Lip sync: A/E/I/O/U/M/F visemes mapped to VRM blendshapes
 *  - Saccade eye movement + mouse tracking
 *  - Auto-blink (randomised intervals)
 *  - Gesture system: wave, celebrate, think, listen, idle
 *  - Secondary motion: ear/tail/hair bouncing via VRM spring bones
 */

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as VRM from 'three-vrm';

/* ── Colour palette per suit accent ── */
const ACCENT_HEX = {
  cyan:    0x53D7F0,
  gold:    0xE8B44A,
  crimson: 0xF2647C,
  violet:  0x9D7BF0,
  rose:    0xFF8FB1,
};

/* ── VRM Expression name aliases (VRM0 ↔ VRM1 names) ── */
const EXPR = {
  // VRM1 preset names (three-vrm v1.x resolves both)
  happy:     ['happy',    'joy',      'Joy'],
  sad:       ['sad',      'sorrow',   'Sorrow'],
  angry:     ['angry',    'Angry'],
  surprised: ['surprised','Surprised'],
  relaxed:   ['relaxed',  'neutral',  'Neutral'],
  neutral:   ['neutral',  'Neutral'],
  blink:     ['blink',    'Blink',    'blinkLeft', 'blinkRight'],
  blinkL:    ['blinkLeft', 'Blink_L', 'blink'],
  blinkR:    ['blinkRight','Blink_R', 'blink'],
  aa:        ['aa',       'A',        'vowel_A'],
  ee:        ['ee',       'e',        'E',  'vowel_E'],
  ih:        ['ih',       'i',        'I',  'vowel_I'],
  oh:        ['oh',       'o',        'O',  'vowel_O'],
  ou:        ['ou',       'u',        'U',  'vowel_U'],
};

/* ── Resolve expression name: try aliases until one works ── */
function setExpr(vrm, aliases, val) {
  if (!vrm) return;
  if (vrm.expressionManager) {
    for (const name of aliases) {
      try {
        vrm.expressionManager.setValue(name, val);
        vrm.expressionManager.setValue(name.toLowerCase(), val);
      } catch (_) {}
    }
  } else if (vrm.blendShapeProxy) {
    for (const name of aliases) {
      try {
        vrm.blendShapeProxy.setValue(name, val);
      } catch (_) {}
    }
  }
}
function getExpr(vrm, aliases) {
  if (!vrm) return 0;
  if (vrm.expressionManager) {
    for (const name of aliases) {
      try {
        const v = vrm.expressionManager.getValue(name) ?? vrm.expressionManager.getValue(name.toLowerCase());
        if (v !== undefined && v !== null) return v;
      } catch (_) {}
    }
  } else if (vrm.blendShapeProxy) {
    for (const name of aliases) {
      try {
        const v = vrm.blendShapeProxy.getValue(name);
        if (v !== undefined && v !== null) return v;
      } catch (_) {}
    }
  }
  return 0;
}
function getBoneNode(vrm, name) {
  if (!vrm || !vrm.humanoid) return null;
  if (vrm.humanoid.getNormalizedBoneNode) {
    return vrm.humanoid.getNormalizedBoneNode(name);
  }
  if (vrm.humanoid.getBoneNode) {
    return vrm.humanoid.getBoneNode(name);
  }
  return null;
}
function lerpExprFn(vrm, aliases) {
  return (target, speed = 0.18) => {
    const cur = getExpr(vrm, aliases);
    const next = THREE.MathUtils.lerp(cur, target, speed);
    setExpr(vrm, aliases, next);
  };
}

/* ── Viseme target shapes ── */
const VISEME_TARGETS = {
  rest: { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0    },
  M:    { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0.1  },
  F:    { aa: 0,    ee: 0.2,  ih: 0,    oh: 0,    ou: 0    },
  A:    { aa: 1.0,  ee: 0,    ih: 0,    oh: 0,    ou: 0    },
  E:    { aa: 0,    ee: 0.9,  ih: 0,    oh: 0,    ou: 0    },
  I:    { aa: 0,    ee: 0,    ih: 0.85, oh: 0,    ou: 0    },
  O:    { aa: 0,    ee: 0,    ih: 0,    oh: 1.0,  ou: 0    },
  U:    { aa: 0,    ee: 0,    ih: 0,    oh: 0,    ou: 0.85 },
};

/* ── Emotion expression targets ── */
const EMOTION_TARGETS = {
  happy:     { happy: 1.0, sad: 0,   angry: 0,   surprised: 0,   relaxed: 0   },
  excited:   { happy: 1.0, sad: 0,   angry: 0,   surprised: 0.5, relaxed: 0   },
  friendly:  { happy: 0.7, sad: 0,   angry: 0,   surprised: 0,   relaxed: 0.3 },
  sad:       { happy: 0,   sad: 1.0, angry: 0,   surprised: 0,   relaxed: 0   },
  concerned: { happy: 0,   sad: 0.7, angry: 0.2, surprised: 0,   relaxed: 0   },
  angry:     { happy: 0,   sad: 0,   angry: 1.0, surprised: 0,   relaxed: 0   },
  surprised: { happy: 0,   sad: 0,   angry: 0,   surprised: 1.0, relaxed: 0   },
  curious:   { happy: 0.2, sad: 0,   angry: 0,   surprised: 0.6, relaxed: 0   },
  thinking:  { happy: 0,   sad: 0.2, angry: 0.2, surprised: 0,   relaxed: 0.3 },
  focused:   { happy: 0,   sad: 0,   angry: 0.3, surprised: 0,   relaxed: 0.4 },
  neutral:   { happy: 0,   sad: 0,   angry: 0,   surprised: 0,   relaxed: 0.4 },
};

/* ── Build the anime character ── */
export function buildAnime(el, cfg) {
  el.innerHTML = '';
  el.style.position = 'relative';
  el.style.overflow  = 'hidden';

  const W = el.clientWidth  || 300;
  const H = el.clientHeight || 300;

  /* Canvas + Renderer */
  const canvas = document.createElement('canvas');
  canvas.style.width  = '100%';
  canvas.style.height = '100%';
  el.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: false,
  });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  /*
   * CRITICAL COLOR SETUP for three-vrm v1.0.8 + Three.js r139:
   * - sRGBEncoding: gamma correction so textures display correctly
   * - LinearToneMapping: REQUIRED for MToon — ACES/Reinhard desaturate anime colors
   * - exposure 1.0: neutral, no color shift
   */
  renderer.outputEncoding      = THREE.sRGBEncoding;
  renderer.toneMapping         = THREE.LinearToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.physicallyCorrectLights = false;
  renderer.sortObjects = false;
  renderer.autoClearColor = true;

  /* Scene — DARK background so character textures are visible */
  const scene = new THREE.Scene();
  /* Set dark background to reveal character colors and textures */
  scene.background = new THREE.Color(0x1a1a2e);  /* Dark blue-black for character visibility */
  scene.fog = null;
  renderer.setClearColor(scene.background, 1.0);

  /* Camera — tight bust/portrait framing with focus on face */
  const camera = new THREE.PerspectiveCamera(32, W / H, 0.1, 100);
  camera.position.set(0, 0.65, 3.2);  /* Positioned to see face clearly */
  camera.lookAt(0, 0.65, 0);

  /*
   * LIGHTING for MToon:
   * MToon's toon shader responds to: AmbientLight + DirectionalLight.
   * HemisphereLight is NOT supported by MToon's custom GLSL — use AmbientLight.
   * Rule: keep ambient bright enough that shadingShiftFactor > 0 pushes ALL
   * pixels into the lit zone → full texture colors visible.
   */
  const accentColor = ACCENT_HEX[cfg.char_outfit || cfg.outfit] || ACCENT_HEX.cyan;

  /* Very bright ambient — MToon needs this to stay in lit zone */
  const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
  scene.add(ambientLight);

  /* Strong key light from front-above — drives MToon's directional shading */
  const keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
  keyLight.position.set(0.5, 3.0, 4.0);
  scene.add(keyLight);

  /* Soft fill from left */
  const fillLight = new THREE.DirectionalLight(0xc8d8ff, 1.2);
  fillLight.position.set(-3.0, 1.5, 2.0);
  scene.add(fillLight);

  /* Front-centre fill — ensures face never dark */
  const frontFill = new THREE.DirectionalLight(0xffffff, 1.0);
  frontFill.position.set(0, 0.5, 5.0);
  scene.add(frontFill);

  /* Coloured rim accent */
  const rimLight = new THREE.DirectionalLight(accentColor, 1.2);
  rimLight.position.set(2.5, 1.0, 2.0);
  scene.add(rimLight);

  /* Top hair light */
  const topLight = new THREE.DirectionalLight(0xffffff, 0.8);
  topLight.position.set(0, 5, 1);
  scene.add(topLight);

  /* Holographic HUD rings */
  const hudGroup = new THREE.Group();
  scene.add(hudGroup);
  const mkRing = (r, thick, col, op, tilt) => {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(r, thick, 8, 96),
      new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op })
    );
    m.rotation.x = tilt;
    hudGroup.add(m);
    return m;
  };
  const ring1 = mkRing(2.2, 0.012, accentColor, 0.22, Math.PI / 2);
  const ring2 = mkRing(1.95, 0.007, 0x9D7BF0, 0.14, Math.PI / 2.4);
  const ring3 = mkRing(2.5, 0.005, accentColor, 0.08, Math.PI / 3);

  /* State */
  const st = {
    isSleeping: cfg.asleep || false,
    emotion: 'neutral',
    viseme: 'rest',
    lookTarget: new THREE.Vector3(0, 0, 1),
    time: 0,
    delta: 0,
    clock: new THREE.Clock(),
    visemeTimer: null,
    blinkTimer: 0,
    nextBlinkAt: _randBlink(),
    blinkPhase: 'open',   // open | closing | opening
    blinkSpeed: 0,
    gestureTime: 0,
    currentGesture: 'idle',
    gesturePhase: 0,
    emotionAge: 0,
    lastMouseTime: Date.now(),
    idleGazeT: 0,
    idleGestureT: 0,
    vrm: null,
    // Arm pose targets (lerped each frame)
    lArm: { x: 0, y: 0, z: -0.15 },
    rArm: { x: 0, y: 0, z: 0.15 },
    lForearm: { x: 0, y: 0, z: 0 },
    rForearm: { x: 0, y: 0, z: 0 },
    lHand: { x: 0, y: 0, z: 0 },
    rHand: { x: 0, y: 0, z: 0 },
    neck: { x: 0, y: 0, z: 0 },
    head: { x: 0, y: 0, z: 0 },
    spine: { x: 0, y: 0, z: 0 },
    chest: { x: 0, y: 0, z: 0 },
    hips: { x: 0, y: 0, z: 0 },
  };

  function _randBlink() { return 180 + Math.random() * 260; } // frames

  /* Model group */
  const modelGroup = new THREE.Group();
  scene.add(modelGroup);

  /* Fallback procedural avatar (if VRM fails) */
  let fallback = null;

  /* ── Environment Map ──
   * MToon uses directional/ambient lighting (not PBR IBL).
   * scene.environment is not needed for correct anime color rendering.
   */
  // No env map needed for MToon

  /* ── Load VRM using three-vrm v1.x VRMLoaderPlugin ── */
  const loader = new GLTFLoader();
  if (VRM.VRMLoaderPlugin) {
    loader.register((parser) => new VRM.VRMLoaderPlugin(parser));
  }

  const vrmPath = cfg.vrm_path || '/static/LIA.vrm';

  loader.load(
    vrmPath,
    async (gltf) => {
      let vrm = gltf.userData.vrm;

      if (!vrm && VRM.VRM && VRM.VRM.from) {
        try { vrm = await VRM.VRM.from(gltf); } catch(e) {}
      }

      if (!vrm) {
        fallback = _buildFallback(modelGroup, accentColor, cfg);
        return;
      }

      st.vrm = vrm;
      modelGroup.add(vrm.scene);

      /* ── ORIENTATION ──────────────────────────────────────────────────
       * LIA.vrm is a VRM 1.0 model (VRMC_vrm). VRM 1.0 models already face
       * +Z (toward a camera placed on +Z), so NO 180° flip is needed.
       * Detect the spec version and only rotate legacy VRM 0.x models.
       *   - VRM 1.0  → meta.metaVersion === '1' (or vrm.meta with no exporterVersion)
       *   - VRM 0.x  → faces -Z, needs Math.PI flip
       * ──────────────────────────────────────────────────────────────── */
      const isVRM0 = !!(vrm.meta && vrm.meta.metaVersion === '0') ||
                     !!(vrm.meta && vrm.meta.exporterVersion &&
                        /UniVRM-0\./.test(vrm.meta.exporterVersion));
      vrm.scene.rotation.y = isVRM0 ? Math.PI : 0;   /* LIA.vrm → 0 (faces camera) */
      vrm.scene.position.set(0, -0.95, 0);
      vrm.scene.scale.setScalar(1.0);

      /* ── DEFINITIVE MToon color fix ──────────────────────────────────
       * three-vrm v1.0.8 MToon materials have these key properties:
       *   shadingShiftFactor: -1..1   (0.5 = push into lit zone = full color)
       *   shadingToonyFactor: 0..1    (0.9 = hard toon edge)
       * Standard Three.js materials: set texture color space.
       * CSS canvas filter: absolute safety net for any residual B&W.
       * ─────────────────────────────────────────────────────────────── */
      let mtoonCount = 0, stdCount = 0;
      vrm.scene.traverse(obj => {
        if (!obj.isMesh) return;
        obj.frustumCulled = false;

        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach(mat => {
          if (!mat) return;

          /* Fix texture color space — works for both MToon and standard */
          ['map', 'emissiveMap', 'shadeMultiplyTexture', 'matcapTexture',
           'rimMultiplyTexture', 'outlineWidthMultiplyTexture'].forEach(f => {
            if (mat[f] && mat[f].isTexture) {
              mat[f].encoding = THREE.sRGBEncoding;
              mat[f].needsUpdate = true;
            }
          });

          const isMToon = mat.isMToonMaterial ||
                          (mat.constructor && mat.constructor.name &&
                           mat.constructor.name.toLowerCase().includes('mtoon'));

          if (isMToon) {
            mtoonCount++;
            /* Push shading boundary: keeps full-lit region visible in color */
            if ('shadingShiftFactor' in mat) mat.shadingShiftFactor = 0.5;
            if ('shadingToonyFactor' in mat) mat.shadingToonyFactor = 0.9;
            /* Disable matcap which can cause grayscale-like rendering */
            if ('matcapFactor' in mat) mat.matcapFactor = new THREE.Color(0, 0, 0);
            /* Disable rim that may compete with main color */
            if ('rimLightingMixFactor' in mat) mat.rimLightingMixFactor = 0.0;
          } else {
            stdCount++;
            /* Standard PBR: ensure roughness/metalness don't gray it out */
            if ('roughness' in mat) mat.roughness = Math.min(mat.roughness, 0.8);
            if ('metalness' in mat) mat.metalness = Math.min(mat.metalness, 0.2);
          }

          mat.needsUpdate = true;
        });
      });

      /* CSS safety net — if WebGL output still looks grey, saturate via CSS */
      canvas.style.filter = 'saturate(1.4) brightness(1.05)';

      _applyIdlePose(vrm);
      console.log(`✓ VRM loaded: ${mtoonCount} MToon + ${stdCount} standard materials. Color fix applied.`);
    },
    () => {},
    (err) => {
      console.warn('VRM not found → procedural fallback:', err);
      fallback = _buildFallback(modelGroup, accentColor, cfg);
    }
  );

  /* ── Apply initial T-pose → comfortable idle pose ── */
  function _applyIdlePose(vrm) {
    function boneRot(name, x, y, z) {
      const b = getBoneNode(vrm, name);
      if (b) { b.rotation.x = x; b.rotation.y = y; b.rotation.z = z; }
    }
    // Relax arms down from T-pose into a natural rest pose.
    // VRM A/T-pose has arms out along ±X; rotating ~75° about Z drops them.
    // For a model facing +Z: left arm needs +Z rot, right arm needs -Z rot.
    boneRot('leftUpperArm',  0,  0,  1.25);
    boneRot('rightUpperArm', 0,  0, -1.25);
    boneRot('leftLowerArm',  0, -0.18, 0.15);
    boneRot('rightLowerArm', 0,  0.18, -0.15);
    boneRot('leftHand',      0.0, 0,  0.05);
    boneRot('rightHand',     0.0, 0, -0.05);
    boneRot('spine',         0.02, 0, 0);
    boneRot('chest',         0.0, 0, 0);
    boneRot('neck',          0.0, 0, 0);
    boneRot('head',          0.0, 0, 0);
  }

  /* ── Mouse look ── */
  function onMouseMove(e) {
    if (st.isSleeping) return;
    st.lastMouseTime = Date.now();
    const rect = canvas.getBoundingClientRect();
    const dx = ((e.clientX - rect.left) / rect.width)  * 2 - 1;
    const dy = -((e.clientY - rect.top)  / rect.height) * 2 + 1;
    st.lookTarget.set(dx * 0.9, dy * 0.55, 1);
  }
  window.addEventListener('mousemove', onMouseMove);

  /* ────────────────────────────────────────────
   *  GESTURE DEFINITIONS
   *  Each gesture sets target bone rotations that
   *  the main loop lerps toward each frame.
   * ──────────────────────────────────────────── */
  function _setGestureTargets(gesture, t) {
    const sin = Math.sin, cos = Math.cos;

    switch (gesture) {
      /* ── IDLE: gentle sway, arms at side ── */
      case 'idle':
      default:
        /* Arms lowered to sides: VRM T-pose needs ~1.3 rad on Z to hang down */
        st.lArm = { x: 0,    y: 0,  z: -1.30 + sin(t * 0.6) * 0.03 };
        st.rArm = { x: 0,    y: 0,  z:  1.30 + sin(t * 0.6 + 1) * 0.03 };
        st.lForearm = { x: 0.08, y: 0, z: -0.18 };
        st.rForearm = { x: 0.08, y: 0, z:  0.18 };
        st.lHand = { x: 0, y: 0, z: 0 };
        st.rHand = { x: 0, y: 0, z: 0 };
        st.spine = { x: 0.02, y: sin(t * 0.4) * 0.015, z: 0 };
        st.chest = { x: 0,    y: 0, z: sin(t * 0.4) * 0.01 };
        break;

      /* ── WAVE: right arm waving hello ── */
      case 'wave':
        st.rArm = { x: -0.3, y: -0.3, z: 0.9 + sin(t * 6) * 0.25 };
        st.rForearm = { x: 0.6 + sin(t * 6) * 0.3, y: 0, z: 0 };
        st.rHand = { x: 0, y: sin(t * 6) * 0.2, z: 0 };
        st.lArm = { x: 0, y: 0, z: -1.30 };
        st.lForearm = { x: 0.05, y: 0, z: 0 };
        st.spine = { x: 0.02, y: 0, z: 0 };
        break;

      /* ── CELEBRATE: both arms raised, victory ── */
      case 'celebrate':
        st.lArm = { x: -0.2, y: 0.2,  z: -(0.9 + sin(t * 8) * 0.15) };
        st.rArm = { x: -0.2, y: -0.2, z:   0.9 + sin(t * 8 + 0.5) * 0.15 };
        st.lForearm = { x: 0.4 + sin(t * 8) * 0.2, y: 0, z: 0 };
        st.rForearm = { x: 0.4 + sin(t * 8) * 0.2, y: 0, z: 0 };
        st.lHand = { x: sin(t * 8) * 0.3, y: 0, z: 0 };
        st.rHand = { x: sin(t * 8) * 0.3, y: 0, z: 0 };
        st.spine = { x: -0.05, y: sin(t * 4) * 0.04, z: 0 };
        break;

      /* ── THINKING: one hand near chin, slight tilt ── */
      case 'thinking':
        st.lArm = { x: 0.25, y: 0.1,  z: -0.25 };
        st.lForearm = { x: 1.2, y: -0.1, z: 0 };
        st.lHand = { x: -0.4, y: 0, z: -0.2 };
        st.rArm = { x: 0,    y: 0,   z: 1.30 };
        st.rForearm = { x: 0.1, y: 0, z: 0 };
        st.rHand = { x: 0, y: 0, z: 0 };
        st.neck = { x: sin(t * 1.2) * 0.04, y: 0.07, z: 0.08 };
        st.spine = { x: 0.05, y: 0.04, z: 0 };
        break;

      /* ── LISTENING: slight forward lean, attentive ── */
      case 'listening':
        st.lArm = { x: 0.1, y: 0, z: -0.5 };
        st.rArm = { x: 0.1, y: 0, z:  0.5 };
        st.lForearm = { x: 0.3, y: 0, z: 0 };
        st.rForearm = { x: 0.3, y: 0, z: 0 };
        st.spine = { x: 0.07 + sin(t * 1.5) * 0.015, y: 0, z: 0 };
        st.neck = { x: -0.06, y: sin(t * 1.5) * 0.06, z: 0.05 };
        break;

      /* ── FRIENDLY: open arms, relaxed, welcoming ── */
      case 'friendly':
        st.lArm = { x: 0, y: 0.15,  z: -(0.45 + sin(t * 2.5) * 0.08) };
        st.rArm = { x: 0, y: -0.15, z:   0.45 + sin(t * 2.5 + 1.2) * 0.08 };
        st.lForearm = { x: 0.15, y: 0.1,  z: 0 };
        st.rForearm = { x: 0.15, y: -0.1, z: 0 };
        st.lHand = { x: 0, y: 0, z: 0.1 };
        st.rHand = { x: 0, y: 0, z: -0.1 };
        st.spine = { x: 0, y: sin(t * 1.5) * 0.02, z: 0 };
        break;

      /* ── SURPRISED: hands up, startle ── */
      case 'surprised':
        st.lArm = { x: -0.3, y: 0.1,  z: -0.85 + sin(t * 7) * 0.1 };
        st.rArm = { x: -0.3, y: -0.1, z:  0.85 + sin(t * 7) * 0.1 };
        st.lForearm = { x: 0.8, y: 0, z: 0 };
        st.rForearm = { x: 0.8, y: 0, z: 0 };
        st.neck = { x: -0.1, y: 0, z: 0 };
        st.spine = { x: -0.04, y: 0, z: 0 };
        break;

      /* ── TALKING: light hand gestures while speaking ── */
      case 'talking':
        const swing = sin(t * 4.5) * 0.12;
        st.rArm = { x: 0.1,   y: 0,   z: 0.5 + swing };
        st.rForearm = { x: 0.35 + sin(t * 4.5 + 1) * 0.15, y: 0, z: 0 };
        st.rHand = { x: sin(t * 4.5) * 0.15, y: 0, z: 0 };
        st.lArm = { x: 0,     y: 0.05, z: -1.25 };
        st.lForearm = { x: 0.1, y: 0, z: 0 };
        st.spine = { x: 0, y: sin(t * 2) * 0.02, z: 0 };
        break;

      /* ── ANGRY: tense arms, leaning forward ── */
      case 'angry':
        st.lArm = { x: 0.1, y: 0, z: -0.5 };
        st.rArm = { x: 0.1, y: 0, z:  0.5 };
        st.lForearm = { x: 0.6 + sin(t * 5) * 0.05, y: 0, z: 0 };
        st.rForearm = { x: 0.6 + sin(t * 5) * 0.05, y: 0, z: 0 };
        st.spine = { x: 0.06, y: sin(t * 4) * 0.02, z: 0 };
        st.neck = { x: 0.04, y: sin(t * 3) * 0.04, z: 0 };
        break;

      /* ── POINTING: right arm out to point at something ── */
      case 'point':
        st.rArm = { x: -0.2, y: -0.4, z: 0.3 };
        st.rForearm = { x: 0, y: -0.3, z: 0 };
        st.rHand = { x: 0, y: 0, z: 0.1 };
        st.lArm = { x: 0, y: 0, z: -1.30 };
        break;
    }
  }

  /* ── Linely lerp a rotation set toward target ── */
  function lerpBone(bone, target, speed = 0.12) {
    if (!bone) return;
    if (target.x !== undefined) bone.rotation.x = THREE.MathUtils.lerp(bone.rotation.x, target.x, speed);
    if (target.y !== undefined) bone.rotation.y = THREE.MathUtils.lerp(bone.rotation.y, target.y, speed);
    if (target.z !== undefined) bone.rotation.z = THREE.MathUtils.lerp(bone.rotation.z, target.z, speed);
  }

  /* ────────────────────────────────────
   *  RENDER LOOP
   * ──────────────────────────────────── */
  let reqId = null;

  function animate() {
    reqId = requestAnimationFrame(animate);
    const delta = st.clock.getDelta();
    st.time += delta;
    st.delta = delta;

    /* Rotate HUD rings */
    hudGroup.rotation.z += 0.0025;
    ring1.rotation.y = Math.sin(st.time * 0.35) * 0.08;
    ring2.rotation.y = Math.cos(st.time * 0.28) * 0.06;
    ring3.rotation.x += 0.001;

    if (st.isSleeping) {
      /* Gentle bob while asleep */
      if (st.vrm) {
        st.vrm.scene.position.y = -0.95 + Math.sin(st.time * 0.5) * 0.008;
        st.vrm.update(delta);
      }
      renderer.render(scene, camera);
      return;
    }

    /* ── Idle gaze saccades ── */
    st.idleGazeT += delta;
    const timeSinceMouse = Date.now() - st.lastMouseTime;
    if (timeSinceMouse > 1200) {
      /* Wider drift so the head clearly looks left/right while idle */
      const driftX = Math.sin(st.idleGazeT * 0.38) * 0.55 + Math.cos(st.idleGazeT * 1.4) * 0.12;
      const driftY = Math.cos(st.idleGazeT * 0.32) * 0.22 + Math.sin(st.idleGazeT * 1.2) * 0.06;
      if (Math.sin(st.idleGazeT * 0.12) > 0.96) {
        // saccade: quick snap glance
        st.lookTarget.set(driftX * 1.6, driftY * 1.4, 1);
      } else {
        st.lookTarget.x = THREE.MathUtils.lerp(st.lookTarget.x, driftX, 0.04);
        st.lookTarget.y = THREE.MathUtils.lerp(st.lookTarget.y, driftY, 0.04);
      }
    }

    /* ── Random idle gesture cycling ── */
    st.idleGestureT += delta;
    if (st.idleGestureT > 15 + Math.random() * 5) {
      st.idleGestureT = 0;
      if (st.currentGesture === 'idle') {
        const picks = ['listening', 'friendly', 'thinking', 'talking'];
        const g = picks[Math.floor(Math.random() * picks.length)];
        controller.gesture(g);
        setTimeout(() => { if (st.currentGesture === g) controller.gesture('idle'); },
          2500 + Math.random() * 3000);
      }
    }

    /* ── Blink state machine ── */
    st.blinkTimer++;
    if (st.blinkTimer >= st.nextBlinkAt && st.blinkPhase === 'open') {
      st.blinkPhase = 'closing';
      st.blinkSpeed = 0.45 + Math.random() * 0.25;
    }
    let blinkVal = 0;
    if (st.blinkPhase === 'closing') {
      const cur = getExpr(st.vrm, EXPR.blink);
      const next = Math.min(1, cur + st.blinkSpeed);
      blinkVal = next;
      if (next >= 0.98) { st.blinkPhase = 'opening'; }
    } else if (st.blinkPhase === 'opening') {
      const cur = getExpr(st.vrm, EXPR.blink);
      const next = Math.max(0, cur - st.blinkSpeed);
      blinkVal = next;
      if (next <= 0.02) {
        st.blinkPhase = 'open';
        st.blinkTimer  = 0;
        st.nextBlinkAt = _randBlink();
      }
    }

    /* ── VRM update ── */
    if (st.vrm) {
      const G = n => getBoneNode(st.vrm, n);

      /* Bones */
      const neckBone   = G('neck');
      const headBone   = G('head');
      const spineBone  = G('spine');
      const chestBone  = G('chest') || G('upperChest');
      const hipsBone   = G('hips');
      const lArmBone   = G('leftUpperArm');
      const rArmBone   = G('rightUpperArm');
      const lForeArm   = G('leftLowerArm');
      const rForeArm   = G('rightLowerArm');
      const lHandBone  = G('leftHand');
      const rHandBone  = G('rightHand');
      const lEyeBone   = G('leftEye');
      const rEyeBone   = G('rightEye');

      /* Breathing — chest and spine sway */
      const breathe = Math.sin(st.time * 1.35) * 0.012;
      if (st.vrm.scene) {
        st.vrm.scene.position.y = -0.95 + breathe;
      }

      /* Gesture bone targets */
      st.gestureTime += delta;
      _setGestureTargets(st.currentGesture, st.gestureTime);

      /* Apply with lerp */
      lerpBone(lArmBone,  st.lArm,    0.10);
      lerpBone(rArmBone,  st.rArm,    0.10);
      lerpBone(lForeArm,  st.lForearm, 0.12);
      lerpBone(rForeArm,  st.rForearm, 0.12);
      lerpBone(lHandBone, st.lHand,   0.14);
      lerpBone(rHandBone, st.rHand,   0.14);
      lerpBone(spineBone, st.spine,   0.08);
      lerpBone(chestBone, st.chest,   0.08);

      /* Gaze — neck + head + eyes. Multipliers boosted so the head
       * actually turns left/right (old 0.28/0.10 were near-imperceptible). */
      if (neckBone) {
        neckBone.rotation.y = THREE.MathUtils.lerp(neckBone.rotation.y, st.lookTarget.x * 0.42, 0.08);
        neckBone.rotation.x = THREE.MathUtils.lerp(neckBone.rotation.x, st.neck.x - st.lookTarget.y * 0.18, 0.08);
        neckBone.rotation.z = THREE.MathUtils.lerp(neckBone.rotation.z, st.neck.z, 0.07);
      }
      if (headBone) {
        headBone.rotation.y = THREE.MathUtils.lerp(headBone.rotation.y, st.lookTarget.x * 0.30 + st.head.y, 0.08);
        headBone.rotation.x = THREE.MathUtils.lerp(headBone.rotation.x, st.head.x - st.lookTarget.y * 0.10, 0.08);
        headBone.rotation.z = THREE.MathUtils.lerp(headBone.rotation.z, st.head.z, 0.07);
      }
      if (lEyeBone && rEyeBone) {
        const ey = THREE.MathUtils.lerp(lEyeBone.rotation.y, st.lookTarget.x * 0.45, 0.12);
        const ex = THREE.MathUtils.lerp(lEyeBone.rotation.x, -st.lookTarget.y * 0.28, 0.12);
        lEyeBone.rotation.y = ey; lEyeBone.rotation.x = ex;
        rEyeBone.rotation.y = ey; rEyeBone.rotation.x = ex;
      }

      /* ── Expressions ── */
      if (st.vrm.expressionManager || st.vrm.blendShapeProxy) {
        /* Blink */
        setExpr(st.vrm, EXPR.blink, blinkVal);

        /* Emotion */
        const emo = EMOTION_TARGETS[st.emotion] || EMOTION_TARGETS.neutral;
        st.emotionAge = Math.min(1, st.emotionAge + delta * 1.8);
        const blend = st.emotionAge;

        setExpr(st.vrm, EXPR.happy,     THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.happy),     emo.happy     * blend, 0.10));
        setExpr(st.vrm, EXPR.sad,       THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.sad),       emo.sad       * blend, 0.10));
        setExpr(st.vrm, EXPR.angry,     THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.angry),     emo.angry     * blend, 0.10));
        setExpr(st.vrm, EXPR.surprised, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.surprised), emo.surprised * blend, 0.10));
        setExpr(st.vrm, EXPR.relaxed,   THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.relaxed),   emo.relaxed   * blend, 0.10));

        /* Viseme — morph lips */
        const vt = VISEME_TARGETS[st.viseme] || VISEME_TARGETS.rest;
        setExpr(st.vrm, EXPR.aa, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.aa), vt.aa, 0.28));
        setExpr(st.vrm, EXPR.ee, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ee), vt.ee, 0.28));
        setExpr(st.vrm, EXPR.ih, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ih), vt.ih, 0.28));
        setExpr(st.vrm, EXPR.oh, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.oh), vt.oh, 0.28));
        setExpr(st.vrm, EXPR.ou, THREE.MathUtils.lerp(getExpr(st.vrm, EXPR.ou), vt.ou, 0.28));

        if (st.vrm.blendShapeProxy) {
          st.vrm.blendShapeProxy.update();
        }
      }

      st.vrm.update(delta);
    }

    /* ── Procedural fallback ── */
    if (fallback) {
      fallback.update(st.time, delta, blinkVal > 0.5, st.viseme, st.emotion);
    }

    renderer.render(scene, camera);
  }
  animate();

  /* Resize handler */
  function onResize() {
    const w = el.clientWidth, h = el.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }
  window.addEventListener('resize', onResize);

  /* ──────────────────────────────────────────
   *  PUBLIC CONTROLLER
   * ────────────────────────────────────────── */
  const controller = {
    wake() {
      return new Promise(resolve => {
        st.isSleeping = false;
        let n = 0;
        const iv = setInterval(() => {
          modelGroup.visible = (n % 2 === 0);
          if (n++ > 7) { clearInterval(iv); modelGroup.visible = true; resolve(); }
        }, 80);
      });
    },
    sleep() {
      st.isSleeping = true;
      modelGroup.visible = true;
    },
    wave() {
      if (st.isSleeping) return;
      controller.gesture('wave');
      setTimeout(() => { if (st.currentGesture === 'wave') controller.gesture('idle'); }, 3000);
    },
    setEmotion(emotion) {
      if (st.isSleeping) return;
      st.emotion = emotion;
      st.emotionAge = 0;

      /* Emotion → gesture mapping */
      const gestureMap = {
        excited:   'celebrate',
        happy:     'friendly',
        friendly:  'friendly',
        sad:       'thinking',
        concerned: 'thinking',
        angry:     'angry',
        thinking:  'thinking',
        focused:   'listening',
        surprised: 'surprised',
        curious:   'listening',
      };
      controller.gesture(gestureMap[emotion] || 'idle');

      /* Rim light colour by emotion */
      const lightMap = {
        excited:   0xFF8FB1, happy: 0xFFD080, friendly: 0xA0E8A0,
        sad:       0x6080FF, concerned: 0x9060C0,
        angry:     0xFF4040, surprised: 0xFFFF60,
        thinking:  0xE8B44A, focused: 0x80D0FF,
      };
      rimLight.color.setHex(lightMap[emotion] || accentColor);
    },
    setViseme(v) {
      if (st.isSleeping) return;
      st.viseme = v;
    },
    rest() {
      st.viseme = 'rest';
      /* Don't reset gesture — let it finish naturally */
    },
    speakVisemes(text, durationMs) {
      if (st.isSleeping) return;
      controller.gesture('talking');
      const seq = _textToVisemes(text);
      const step = Math.max(65, durationMs / seq.length);
      let i = 0;
      clearInterval(st.visemeTimer);
      st.visemeTimer = setInterval(() => {
        if (i >= seq.length) {
          clearInterval(st.visemeTimer);
          controller.rest();
          return;
        }
        controller.setViseme(seq[i++]);
      }, step);
    },
    stopSpeaking() {
      clearInterval(st.visemeTimer);
      controller.rest();
    },
    lookAt(x, y) {
      if (st.isSleeping) return;
      st.lastMouseTime = Date.now();
      st.lookTarget.set(x, y, 1);
    },
    gesture(name) {
      if (st.isSleeping) return;
      st.currentGesture = name;
      st.gestureTime = 0;
    },
    _cleanup() {
      cancelAnimationFrame(reqId);
      clearInterval(st.visemeTimer);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    }
  };

  window.currentAvatarController = controller;
  window.__vrm_debug_st = st;
  window.__vrm_debug_scene = scene;
  return controller;
}

/* Legacy global binding */
window.buildAnime = buildAnime;

/* ────────────────────────────────────────────────────────────────
 * _textToVisemes — maps plain text → viseme sequence
 * ──────────────────────────────────────────────────────────────── */
function _textToVisemes(text) {
  if (!text) return ['rest'];
  const rules = [
    [/[aæ]/gi,      'A'],
    [/[eɛ]/gi,      'E'],
    [/[iɪy]/gi,     'I'],
    [/[oɔ]/gi,      'O'],
    [/[uʊ]/gi,      'U'],
    [/[mbp]/gi,     'M'],
    [/[fv]/gi,      'F'],
    [/[tdnlrsz]/gi, 'E'],
    [/[kg]/gi,      'A'],
    [/[wh]/gi,      'O'],
  ];
  const seq = [];
  const words = text.toLowerCase().replace(/[^a-z\s]/g, '').split(/\s+/);
  for (const word of words) {
    if (!word) { seq.push('rest'); continue; }
    for (const ch of word) {
      let matched = false;
      for (const [re, vis] of rules) {
        re.lastIndex = 0;
        if (re.test(ch)) { seq.push(vis); matched = true; break; }
      }
      if (!matched) seq.push('rest');
    }
    seq.push('rest');
  }
  return seq.length ? seq : ['rest'];
}

/* ────────────────────────────────────────────────────────────────
 * PROCEDURAL FALLBACK — full anime-style 3D character
 * (used only if LIA.vrm fails to load)
 * ──────────────────────────────────────────────────────────────── */
function _buildFallback(parent, themeColor, c) {
  const gender = c.char_gender || c.gender || 'female';
  const grp = new THREE.Group();
  grp.position.set(0, -0.15, 0);
  parent.add(grp);

  /* Materials */
  const skinHex = { porcelain: 0xF6E3D5, fair: 0xECC9B8, tan: 0xD9A06E, brown: 0xA86A3E, deep: 0x6E4426 }[c.char_skin || 'fair'] || 0xECC9B8;
  const eyeHex = { sapphire: 0x3B6FD4, emerald: 0x2E9C72, amber: 0xC98A2E, violet: 0x8B5CD6, rose: 0xD45C82, crimson: 0xC0392B }[c.char_eyes || 'sapphire'] || 0x3B6FD4;
  const hairHex = { black: 0x1b1424, brown: 0x4a2c11, blonde: 0xdcb45a, pink: 0xe36c99, blue: 0x2d51b3, violet: 0x613cb3, white: 0xe1e5f0 }[c.char_hair_color || 'black'] || 0x1b1424;

  const skinMat = new THREE.MeshStandardMaterial({ color: skinHex, roughness: 0.45, metalness: 0.05 });
  const hairMat = new THREE.MeshPhongMaterial({ color: hairHex, shininess: 90, specular: 0x444444 });
  const eyeMat  = new THREE.MeshBasicMaterial({ color: eyeHex });
  const whiteMat = new THREE.MeshBasicMaterial({ color: 0xFDFDFD });
  const darkMat  = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const lipMat   = new THREE.LineBasicMaterial({ color: 0xE25F75, linewidth: 3 });

  /* Body / Neck / Shoulders */
  const bodyMat = new THREE.MeshPhongMaterial({ color: themeColor, shininess: 60 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 1.0, 1.1, 32), bodyMat);
  body.position.set(0, -1.3, 0);
  grp.add(body);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.35, 0.55, 16), skinMat);
  neck.position.set(0, -0.55, 0);
  grp.add(neck);

  /* Head */
  const head = new THREE.Group();
  grp.add(head);
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.88, 64, 64), skinMat);
  headMesh.scale.set(1.0, 1.12, 1.02);
  head.add(headMesh);

  /* Nose */
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.26, 4), skinMat);
  nose.rotation.x = -Math.PI / 6; nose.position.set(0, 0.05, 0.88);
  head.add(nose);

  /* Eyes */
  function mkEye(side) {
    const eg = new THREE.Group();
    eg.position.set(side * 0.3, 0.18, 0.8);
    const sclera = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 16), whiteMat);
    const iris   = new THREE.Mesh(new THREE.CircleGeometry(0.075, 16), eyeMat);
    iris.position.z = 0.1; iris.translateZ(0.01);
    const pupil  = new THREE.Mesh(new THREE.CircleGeometry(0.038, 12), darkMat);
    pupil.position.z = 0.112;
    const highlight = new THREE.Mesh(new THREE.CircleGeometry(0.018, 8), whiteMat);
    highlight.position.set(0.02, 0.025, 0.115);
    eg.add(sclera, iris, pupil, highlight);
    head.add(eg);
    return eg;
  }
  const leftEye  = mkEye(-1);
  const rightEye = mkEye(1);

  /* Eyelids */
  function mkLid(side) {
    const lidGeo = new THREE.SphereGeometry(0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
    lidGeo.rotateX(Math.PI / 2);
    const lid = new THREE.Mesh(lidGeo, skinMat);
    lid.position.set(side * 0.3, 0.18, 0.8);
    grp.add(lid);
    return lid;
  }
  const lLid = mkLid(-1), rLid = mkLid(1);

  /* Eyebrows */
  const browMat = new THREE.MeshBasicMaterial({ color: hairHex });
  function mkBrow(side) {
    const bg = new THREE.CylinderGeometry(0.012, 0.004, 0.28, 6);
    bg.rotateZ(Math.PI / 2.4);
    const b = new THREE.Mesh(bg, browMat);
    b.position.set(side * 0.3, 0.38, 0.88);
    if (side > 0) b.scale.x = -1;
    head.add(b);
    return b;
  }
  const lBrow = mkBrow(-1), rBrow = mkBrow(1);

  /* Lips — CatmullRom */
  const LP = 7;
  const pts = Array.from({ length: LP }, () => new THREE.Vector3());
  const curve = new THREE.CatmullRomCurve3(pts, true);
  const lipsGeo = new THREE.BufferGeometry();
  lipsGeo.setFromPoints(curve.getPoints(24));
  const lips = new THREE.Line(lipsGeo, lipMat);
  lips.position.set(0, -0.36, 0.94);
  head.add(lips);

  /* Hair */
  const style = c.char_hair_style || 'long';
  const STRANDS = gender === 'female' ? 22 : 14;
  const SEG = style === 'short' || style === 'spiky' ? 4 : 6;
  const SEG_LEN = style === 'short' ? 0.28 : style === 'spiky' ? 0.22 : 0.44;
  const strandsData = [], strandMeshes = [];
  for (let s = 0; s < STRANDS; s++) {
    const ang = (s / STRANDS) * Math.PI - Math.PI / 2;
    const rx = Math.cos(ang) * 0.88;
    const ry = 0.42 + Math.sin(Math.abs(ang)) * 0.35;
    const rz = -0.22 + Math.cos(Math.abs(ang)) * 0.45;
    const nodes = [];
    for (let i = 0; i < SEG; i++) {
      let px = rx, py = ry - i * SEG_LEN, pz = rz - i * 0.08;
      if (style === 'wave') px += Math.sin(i * 1.5 + s) * 0.07;
      else if (style === 'curly') { px += Math.sin(i * 2.5 + s) * 0.05; pz += Math.cos(i * 2.5 + s) * 0.05; }
      else if (style === 'spiky') { const d = Math.sqrt(px*px + py*py + pz*pz); px += (px/d)*i*0.07; py += (py/d)*i*0.07; pz += (pz/d)*i*0.07; }
      nodes.push({ pos: new THREE.Vector3(px, py, pz), prev: new THREE.Vector3(px, py, pz) });
    }
    strandsData.push(nodes);
    const sc = new THREE.CatmullRomCurve3(nodes.map(n => n.pos));
    const sm = new THREE.Mesh(new THREE.TubeGeometry(sc, 6, 0.07 - s * 0.001, 6, false), hairMat);
    grp.add(sm);
    strandMeshes.push(sm);
  }
  if (style === 'bun') {
    const bun = new THREE.Mesh(new THREE.SphereGeometry(gender === 'female' ? 0.3 : 0.24, 24, 24), hairMat);
    bun.position.set(0, gender === 'female' ? 0.42 : 0.68, -0.82);
    head.add(bun);
  }

  /* Fallback mouth state */
  let fW = 0.2, fH = 0.06, fBC = 0.05;

  return {
    update(time, delta, isBlinking, viseme, emotion) {
      /* Blink */
      lLid.scale.y = isBlinking ? 0.06 : 1.0;
      rLid.scale.y = isBlinking ? 0.06 : 1.0;

      /* Eyebrow raise by emotion */
      const browY = emotion === 'surprised' ? 0.46 : emotion === 'angry' ? 0.3 : 0.38;
      lBrow.position.y = THREE.MathUtils.lerp(lBrow.position.y, browY, 0.1);
      rBrow.position.y = THREE.MathUtils.lerp(rBrow.position.y, browY, 0.1);

      /* Lips morphing */
      const VMORPHS = {
        rest: { w: 1.2, h: 0.1,  curve: 0.05  },
        M:    { w: 1.0, h: 0.0,  curve: 0.0   },
        A:    { w: 1.5, h: 1.2,  curve: 0.15  },
        E:    { w: 1.7, h: 0.6,  curve: 0.25  },
        I:    { w: 1.4, h: 0.4,  curve: 0.15  },
        O:    { w: 1.0, h: 1.3,  curve: -0.05 },
        U:    { w: 0.7, h: 0.8,  curve: -0.15 },
        F:    { w: 1.1, h: 0.25, curve: 0.05  },
      };
      let emoCurve = 0, hm = 1.0, wm = 1.0;
      if (emotion === 'excited')   { emoCurve = 0.45; hm = 1.3; wm = 1.1; }
      else if (emotion === 'happy' || emotion === 'friendly') { emoCurve = 0.3; }
      else if (emotion === 'sad'  || emotion === 'concerned') { emoCurve = -0.35; }
      else if (emotion === 'surprised') { emoCurve = 0.0; hm = 1.8; wm = 0.85; }
      else if (emotion === 'thinking')  { emoCurve = -0.05; wm = 0.75; hm = 0.15; }
      const cfg = VMORPHS[viseme] || VMORPHS.rest;
      const tw = cfg.w * wm * 0.2, th = cfg.h * hm * 0.12, tbc = cfg.curve + emoCurve * 0.22;
      fW  = THREE.MathUtils.lerp(fW,  tw,  0.22);
      fH  = THREE.MathUtils.lerp(fH,  th,  0.22);
      fBC = THREE.MathUtils.lerp(fBC, tbc, 0.22);
      for (let i = 0; i < LP; i++) {
        const theta = (i / (LP - 1)) * Math.PI * 2;
        const x = Math.cos(theta) * fW;
        const corner = (fW - Math.abs(x)) * fBC * 0.5;
        pts[i].set(x, Math.sin(theta) * fH + corner, 0);
      }
      curve.points = pts;
      lips.geometry.setFromPoints(curve.getPoints(24));

      /* Hair physics (Verlet) */
      const windX = Math.sin(time * 3.1) * 0.06, windZ = Math.cos(time * 2.2) * 0.06;
      for (let s = 0; s < STRANDS; s++) {
        const nodes = strandsData[s], mesh = strandMeshes[s];
        const ang = (s / STRANDS) * Math.PI - Math.PI / 2;
        const rx = Math.cos(ang) * 0.88, ry = 0.42 + Math.sin(Math.abs(ang)) * 0.35, rz = -0.22 + Math.cos(Math.abs(ang)) * 0.45;
        const wr = new THREE.Vector3(rx, ry, rz).applyMatrix4(headMesh.matrixWorld);
        nodes[0].pos.copy(wr); nodes[0].prev.copy(wr);
        for (let i = 1; i < SEG; i++) {
          const n = nodes[i], tmp = n.pos.clone();
          const vel = n.pos.clone().sub(n.prev).multiplyScalar(0.88);
          n.pos.add(vel); n.pos.y -= 0.013; n.pos.x += windX * 0.018; n.pos.z += windZ * 0.018;
          n.prev.copy(tmp);
        }
        for (let it = 0; it < 2; it++) {
          for (let i = 0; i < SEG - 1; i++) {
            const n1 = nodes[i], n2 = nodes[i+1];
            const d = n2.pos.clone().sub(n1.pos), len = d.length(), err = SEG_LEN - len, off = d.normalize().multiplyScalar(err * 0.5);
            if (i > 0) n1.pos.sub(off); n2.pos.add(off);
          }
        }
        mesh.geometry.dispose();
        mesh.geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(nodes.map(n => n.pos)), 6, 0.055 - s * 0.001, 6, false);
      }
    }
  };
}