implement avatar framework

The current state-of-the-art (as of mid-2026) for real-time 3D avatar animation in web apps (e.g., AI chatbots) using primarily Three.js + HTML Canvas focuses on a mature ecosystem rather than a single monolithic framework. This setup delivers smooth, browser-native WebGL/WebGPU rendering with no pre-rendered video, video streaming, or server-side video generation. Everything runs client-side on the canvas: model loading, skeletal animation (via AnimationMixer), facial blendshapes/morph targets for expressions and lip-sync, and gesture/idle states driven by AI logic (LLM + TTS or real-time audio).
Key principles of the SOTA stack:

Avatar formats: VRM (standardized, excellent blendshape support for face/visemes) or GLB/GLTF (from customizable creators).
Rendering: Three.js core (or WebGPU renderer for better perf) + declarative helpers.
Facial animation/lip-sync: Real-time viseme → blendshape mapping (via Web Audio API analysis or SDK-provided data streams). No video = pure morph target updates every frame in useFrame or equivalent.
Body/gestures: Retargeted Mixamo animations or procedural states.
Integration: Often with React/Next.js via React Three Fiber (R3F) for modern web apps, but pure vanilla Three.js works fine too.
AI chatbot fit: Hook into TTS (e.g., ElevenLabs, Azure) or real-time voice AI; drive idle/talking/gesture states + lip-sync from text/visemes/phonemes.

Top SOTA Frameworks/Libraries (Practical & Production-Ready)
Here are the leading options, ranked by relevance for your use case (real-time chatbot avatar on canvas):

@pixiv/three-vrm (Core Library for VRM Avatars)
The de facto standard for real-time web avatars. Loads VRM files (from VRoid Studio or other creators) with built-in support for:
Blendshapes (FACS-based: visemes for lip-sync, emotions like happy/angry).
Skeletal animation (bones + springs for natural movement).
Look-at targets, auto-blink, and expression presets.
Actively maintained (v3.x+ in 2026 with WebGPU support). Pairs perfectly with Three.js AnimationMixer for body animations.
Why SOTA for chatbots: Extremely lightweight, performant on mobile/desktop, and designed exactly for live 3D avatars (VTubers, assistants). Use with MediaPipe or custom logic for extra pose tracking if needed.
GitHub: pixiv/three-vrm (examples include basic lip-sync setups).

React Three Fiber (R3F) + @react-three/drei
The dominant way to use Three.js in real web apps (especially React/Next.js chat UIs). Declarative JSX for scenes, avatars, and animations while staying 100% Three.js under the hood (direct canvas/WebGL rendering).
Handles useFrame loops for real-time morph target updates, lighting, post-processing, and easy integration with AI state.
Almost every modern Three.js avatar tutorial (including lip-sync chatbots) uses this. Pure vanilla Three.js is still viable but R3F accelerates development without sacrificing performance.
Convai Web SDK
Purpose-built for browser-based conversational AI avatars using Three.js/R3F.
Provides low-latency (<200ms) real-time lip-sync via NeuroSync (returns morph target/viseme data directly).
Handles voice I/O, LLM intelligence, and avatar state in one SDK.
No game engine or local GPU required—pure Three.js canvas.
Perfect chatbot fit: Drop-in for talking avatars that listen, think, speak, and animate faces/body in real time.

Gabber SDK
Real-time AI backend + VRM/Three.js frontend integration. Streams live visemes for frame-perfect lip-sync on blendshapes, plus vision/voice I/O. Works natively with @pixiv/three-vrm in React/Next.js apps.
Strong for fully interactive AI characters (see their VRM + viseme demo repos).
wawa-lipsync (Open-Source Real-Time Lip-Sync Library)
Lightweight, browser-native (Web Audio API → viseme detection) library built specifically for R3F/Three.js avatars. No servers or heavy ML needed.
Excellent free/open-source option for custom TTS-driven lip-sync on any GLB/VRM model with morph targets. Popular in 2025–2026 tutorials for AI chatbots and games.
VerseEngine/three-avatar
Lightweight dedicated avatar system built on Three.js. Supports VRM/VRoid + Ready Player Me models out of the box, Mixamo animations, head tracking, replaceable lip-sync/IK modules. Great drop-in if you want a higher-level abstraction.

Avatar Creation & Model Sources (2026 Landscape)

VRoid Studio → Export VRM (best for stylized/real-time web avatars).
Avatar SDK (MetaPerson) → Drop-in replacement for Ready Player Me (which sunset Jan 2026). Provides GLB avatars + official MetaPerson Loader for Three.js with blendshapes. Real-time facial animation support.
Legacy/Alternatives: Ready Player Me GLBs still work (with their animation library + Mixamo retargeting), but migration to Avatar SDK or VRM is recommended.

Body Animation & Full Pipeline Tips

Three.js AnimationMixer + Mixamo (free animations) or RPM/Avatar SDK animation packs. Retargeting tools make it easy.
State machine for idle → talking → gesture blending (common in chatbot demos).
Performance: WebGPU renderer (Three.js r171+) + Draco/KTX2 compression for models. Runs 60 FPS easily on modern devices.
Full example stacks seen in 2026 tutorials:
R3F + three-vrm + wawa-lipsync (pure open-source).
R3F + Convai/Gabber SDK (full AI end-to-end).
Vanilla Three.js + three-avatar.


This ecosystem is mature, actively maintained, and exactly matches your constraints (real-time canvas rendering, no video). For a quick start, check Wawa Sensei tutorials (R3F + VRM + lipsync) or the official Convai/Gabber Web SDK docs—they include complete chatbot avatar examples.
