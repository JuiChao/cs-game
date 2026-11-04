// ============================================================================
// Postprocessing Pipeline Module (Features F13, F14, F15, F18)
// Three.js r128 EffectComposer, UnrealBloomPass, and Unified Cinematic Shader
// ============================================================================

let composer = null;
let renderPass = null;
let bloomPass = null;
let cinematicPass = null;
let postprocessingActive = false;
let postprocessingInitialized = false;
let currentHitAberration = 0.0;
let postprocessingTargetRenderer = null;
let postprocessingTargetScene = null;
let postprocessingTargetCamera = null;

// Single-Pass Unified Cinematic Shader (Vignette, Hit Chromatic Aberration, ACES Tone Curve, Film Grain)
const CinematicShader = {
    uniforms: {
        tDiffuse: { value: null },
        uTime: { value: 0.0 },
        time: { value: 0.0 },
        uResolution: { value: new THREE.Vector2(window.innerWidth || 1920, window.innerHeight || 1080) },
        resolution: { value: new THREE.Vector2(window.innerWidth || 1920, window.innerHeight || 1080) },
        uHitAberration: { value: 0.0 },
        hitAberration: { value: 0.0 },
        uVignetteDarkness: { value: 0.35 },
        vignetteDarkness: { value: 0.35 },
        uVignetteOffset: { value: 1.15 },
        vignetteOffset: { value: 1.15 },
        uGrainIntensity: { value: 0.022 },
        grainIntensity: { value: 0.022 }
    },
    vertexShader: [
        'varying vec2 vUv;',
        'void main() {',
        '    vUv = uv;',
        '    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
        '}'
    ].join('\n'),
    fragmentShader: [
        'uniform sampler2D tDiffuse;',
        'uniform float uTime;',
        'uniform vec2 uResolution;',
        'uniform float uHitAberration;',
        'uniform float uVignetteDarkness;',
        'uniform float uVignetteOffset;',
        'uniform float uGrainIntensity;',
        'varying vec2 vUv;',
        '',
        '// ACES Filmic Tone Mapping Curve (Narkowicz)',
        'vec3 ACESFilm(vec3 x) {',
        '    float a = 2.51;',
        '    float b = 0.03;',
        '    float c = 2.43;',
        '    float d = 0.59;',
        '    float e = 0.14;',
        '    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);',
        '}',
        '',
        '// Fast pseudo-random noise generator',
        'float rand(vec2 co) {',
        '    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);',
        '}',
        '',
        'void main() {',
        '    vec2 uv = vUv;',
        '    vec2 dir = uv - vec2(0.5);',
        '    float dist = length(dir);',
        '',
        '    // 1. Dynamic Chromatic Aberration (Fast single sample when no hit aberration)',
        '    vec3 color;',
        '    if (uHitAberration > 0.0001) {',
        '        float totalAberration = uHitAberration + 0.0015 * dist;',
        '        vec2 offset = normalize(dir + 0.0001) * totalAberration;',
        '        float r = texture2D(tDiffuse, clamp(uv + offset, 0.0, 1.0)).r;',
        '        float g = texture2D(tDiffuse, uv).g;',
        '        float b = texture2D(tDiffuse, clamp(uv - offset, 0.0, 1.0)).b;',
        '        color = vec3(r, g, b);',
        '    } else {',
        '        color = texture2D(tDiffuse, uv).rgb;',
        '    }',
        '',
        '    // 2. ACES Filmic Tone Mapping Curve (with sky luminance preservation)',
        '    vec3 toneColor = color * 1.12;',
        '    color = ACESFilm(toneColor);',
        '',
        '    // 3. Cinematic Vignette (gentle non-intrusive edge falloff)',
        '    float vignette = smoothstep(uVignetteOffset, uVignetteOffset - 0.45, dist);',
        '    color = mix(color * (1.0 - uVignetteDarkness * 0.25), color, vignette);',
        '',
        '    // 4. Subtle Film Grain',
        '    if (uGrainIntensity > 0.0) {',
        '        float noise = (rand(uv + vec2(sin(uTime * 2.5), cos(uTime * 2.5))) - 0.5) * uGrainIntensity;',
        '        float lum = dot(color, vec3(0.2126, 0.7152, 0.0722));',
        '        float grainWeight = 1.0 - smoothstep(0.7, 1.0, lum);',
        '        color += noise * grainWeight;',
        '    }',
        '',
        '    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);',
        '}'
    ].join('\n')
};

/**
 * Initializes the Three.js postprocessing pipeline.
 * Idempotent: Can safely be called during init3DGame() or map reload.
 */
function initPostprocessing(rendererInstance, sceneInstance, cameraInstance, width, height) {
    postprocessingTargetRenderer = rendererInstance;
    postprocessingTargetScene = sceneInstance;
    postprocessingTargetCamera = cameraInstance;

    // Check if Three.js postprocessing classes are loaded
    if (typeof THREE === 'undefined' ||
        typeof THREE.EffectComposer !== 'function' ||
        typeof THREE.RenderPass !== 'function' ||
        typeof THREE.UnrealBloomPass !== 'function' ||
        typeof THREE.ShaderPass !== 'function') {
        console.warn('Postprocessing dependencies not loaded; using direct WebGLRenderer fallback.');
        postprocessingActive = false;
        return false;
    }

    try {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const w = width || window.innerWidth;
        const h = height || window.innerHeight;

        // Pre-configure composer with matching render target format
        const renderTarget = new THREE.WebGLRenderTarget(Math.floor(w * dpr), Math.floor(h * dpr), {
            minFilter: THREE.LinearFilter,
            magFilter: THREE.LinearFilter,
            format: THREE.RGBAFormat,
            stencilBuffer: false
        });

        composer = new THREE.EffectComposer(rendererInstance, renderTarget);
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);

        // 1. Base Render Pass
        renderPass = new THREE.RenderPass(sceneInstance, cameraInstance);
        composer.addPass(renderPass);

        // 2. Incandescent UnrealBloomPass (F14) - half resolution for 4x performance boost
        bloomPass = new THREE.UnrealBloomPass(
            new THREE.Vector2(Math.floor(w * 0.5), Math.floor(h * 0.5)),
            0.45, // strength
            0.35, // radius
            1.15  // threshold
        );
        composer.addPass(bloomPass);

        // 3. Unified Cinematic Shader Pass (F15)
        cinematicPass = new THREE.ShaderPass(CinematicShader);
        cinematicPass.renderToScreen = true;
        if (cinematicPass.uniforms.uResolution) {
            cinematicPass.uniforms.uResolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr));
        }
        if (cinematicPass.uniforms.resolution) {
            cinematicPass.uniforms.resolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr));
        }
        composer.addPass(cinematicPass);

        postprocessingActive = true;
        postprocessingInitialized = true;
        return true;
    } catch (err) {
        console.error('Failed to initialize EffectComposer, falling back to standard renderer:', err);
        composer = null;
        postprocessingActive = false;
        return false;
    }
}

/**
 * Renders the scene through the postprocessing composer, with seamless fallback.
 */
function renderPostprocessing(deltaTime) {
    if (!postprocessingActive || !composer) {
        if (postprocessingTargetRenderer && postprocessingTargetScene && postprocessingTargetCamera) {
            postprocessingTargetRenderer.render(postprocessingTargetScene, postprocessingTargetCamera);
        } else if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
            renderer.render(scene, camera);
        }
        return;
    }

    try {
        const dt = Math.min(deltaTime || 0.016, 0.1);

        // Decay hit chromatic aberration
        if (currentHitAberration > 0.0001) {
            currentHitAberration *= Math.pow(0.85, dt * 60.0);
            if (currentHitAberration < 0.0001) currentHitAberration = 0.0;
        } else {
            currentHitAberration = 0.0;
        }

        if (cinematicPass && cinematicPass.uniforms) {
            cinematicPass.uniforms.uTime.value += dt;
            cinematicPass.uniforms.time.value += dt;
            cinematicPass.uniforms.uHitAberration.value = currentHitAberration;
            cinematicPass.uniforms.hitAberration.value = currentHitAberration;
        }

        composer.render(dt);
    } catch (renderErr) {
        console.error('Postprocessing render error, disabling composer:', renderErr);
        postprocessingActive = false;
        if (postprocessingTargetRenderer && postprocessingTargetScene && postprocessingTargetCamera) {
            postprocessingTargetRenderer.render(postprocessingTargetScene, postprocessingTargetCamera);
        } else if (typeof renderer !== 'undefined' && typeof scene !== 'undefined' && typeof camera !== 'undefined') {
            renderer.render(scene, camera);
        }
    }
}

/**
 * Handles window resize for composer and all passes.
 */
function onPostprocessingResize(width, height) {
    if (!postprocessingActive || !composer) return;
    try {
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const w = width || window.innerWidth;
        const h = height || window.innerHeight;
        composer.setPixelRatio(dpr);
        composer.setSize(w, h);

        if (bloomPass && typeof bloomPass.setSize === 'function') {
            bloomPass.setSize(Math.floor(w * 0.5), Math.floor(h * 0.5));
        }
        if (cinematicPass && cinematicPass.uniforms) {
            if (cinematicPass.uniforms.uResolution) {
                cinematicPass.uniforms.uResolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr));
            }
            if (cinematicPass.uniforms.resolution) {
                cinematicPass.uniforms.resolution.value.set(Math.floor(w * dpr), Math.floor(h * dpr));
            }
        }
    } catch (e) {
        console.warn('onPostprocessingResize error:', e);
    }
}

/**
 * Triggers transient chromatic aberration on weapon fire or player damage.
 * @param {number} intensity - Aberration magnitude (0.01 - 0.06)
 */
function triggerHitAberration(intensity = 0.025) {
    currentHitAberration = Math.min(0.06, Math.max(currentHitAberration, intensity));
    if (cinematicPass && cinematicPass.uniforms) {
        cinematicPass.uniforms.uHitAberration.value = currentHitAberration;
        cinematicPass.uniforms.hitAberration.value = currentHitAberration;
    }
}

// Global exposure
window.initPostprocessing = initPostprocessing;
window.renderPostprocessing = renderPostprocessing;
window.onPostprocessingResize = onPostprocessingResize;
window.triggerHitAberration = triggerHitAberration;
window.CinematicShader = CinematicShader;
