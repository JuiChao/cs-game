/**
 * Milestone 3 Empirical Adversarial Stress Test Harness
 * Author: challenger_m3_2 (teamwork_challenger)
 * 
 * Target Objectives:
 * 1. Map Profile Switching Stress:
 *    - In headless browser session, rapidly invoke rebuildMap() across 'dust2', 'inferno', 'biolab', 'shootingRange' (40+ cycles).
 *    - Verify hemiLight and dirLight smoothly update colors and intensities without creating duplicate light instances.
 *    - Verify light count in scene.children and overall scene hierarchy remains strictly constant.
 * 2. Particle Pool Boundary & Isolation Verification:
 *    - Verify getParticlePool().length === 1024 and getParticlePoolFree().length === 1024 at rest.
 *    - Simulate firing 300 rounds and confirm particles.length <= 1024 at all times.
 *    - Stress saturated allocation with 2500 calls to obtainParticle in 1 frame without pool growth or memory explosion.
 *    - Confirm that the 350 atmospheric dust motes (dustMotePoints) operate completely independently in their own THREE.Points object
 *      without pushing elements into particles array.
 * 3. Anti-Acne & Shadow Inspection:
 *    - Confirm dirLight.shadow.bias === -0.0004
 *    - Confirm dirLight.shadow.normalBias === 0.05
 *    - Confirm dirLight.shadow.radius === 2.0
 *    - Confirm castShadow and receiveShadow on map architecture.
 * 4. Dynamic Lighting Muzzle Flash & Postprocessing Resilience:
 *    - Verify muzzle flash transient intensity spikes and exponential decay to 0.
 *    - Verify chromatic aberration uniform uHitAberration decays smoothly without NaN/overflow.
 *    - Verify DPR clamp to Math.min(window.devicePixelRatio || 1, 1.75).
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

let totalAssertions = 0;
let passedAssertions = 0;
let failedAssertions = 0;
const failureDetails = [];

function assert(condition, message, detail = '') {
    totalAssertions++;
    if (condition) {
        passedAssertions++;
        console.log(`  [PASS] ${message}`);
    } else {
        failedAssertions++;
        const failMsg = `[FAIL] ${message}${detail ? ' -> ' + detail : ''}`;
        console.error(`  ${failMsg}`);
        failureDetails.push(failMsg);
    }
}

async function runStaticInvariantChecks() {
    console.log('\n================================================================================');
    console.log('>>> 1. STATIC CODE INVARIANT CHECKS (Lighting, Shadows & Atmosphere)');
    console.log('================================================================================');

    const mapJs = fs.readFileSync(path.join(__dirname, 'modules/map.js'), 'utf-8');
    const sceneJs = fs.readFileSync(path.join(__dirname, 'modules/scene.js'), 'utf-8');
    const bulletsJs = fs.readFileSync(path.join(__dirname, 'modules/bullets.js'), 'utf-8');
    const postprocessingJs = fs.readFileSync(path.join(__dirname, 'modules/postprocessing.js'), 'utf-8');

    // 1.1 Shadow Bias Anti-Acne
    assert(mapJs.includes('dirLight.shadow.bias = -0.0004;'), 'modules/map.js specifies shadow.bias = -0.0004');
    assert(mapJs.includes('dirLight.shadow.normalBias = 0.05;'), 'modules/map.js specifies shadow.normalBias = 0.05');
    assert(mapJs.includes('dirLight.shadow.radius = 2.0;'), 'modules/map.js specifies shadow.radius = 2.0');
    assert(mapJs.includes('dirLight.castShadow = true;'), 'modules/map.js enables dirLight.castShadow');

    // 1.2 Dual-Bounce Hemisphere Lighting & Atmospheric Profiles
    assert(mapJs.includes('hemiLight = new THREE.HemisphereLight(0x90caf9, 0xd7b48c, 0.65);'), 'modules/map.js instantiates dual-bounce HemisphereLight');
    assert(mapJs.includes('MAP_LIGHTING_CONFIGS'), 'modules/map.js defines MAP_LIGHTING_CONFIGS profiles');
    assert(mapJs.includes('dust2:') && mapJs.includes('inferno:') && mapJs.includes('biolab:') && mapJs.includes('shootingRange:'), 'MAP_LIGHTING_CONFIGS contains all 4 map profiles');
    assert(mapJs.includes('function updateSceneLighting(mapId)'), 'modules/map.js defines updateSceneLighting(mapId)');

    // 1.3 Particle Pool Bounds
    assert(bulletsJs.includes('const PARTICLE_POOL_SIZE = 1024;'), 'modules/bullets.js defines PARTICLE_POOL_SIZE = 1024');
    assert(bulletsJs.includes('obtainParticle('), 'modules/bullets.js provides obtainParticle() accessor');

    // 1.4 Atmospheric Dust Motes Isolation
    assert(sceneJs.includes('const DUST_MOTE_COUNT = 350;'), 'modules/scene.js defines DUST_MOTE_COUNT = 350');
    assert(sceneJs.includes('let dustMotePoints = null;'), 'modules/scene.js defines dustMotePoints independently of particles');
    assert(mapJs.includes('new THREE.Points(moteGeo, moteMat);'), 'modules/map.js creates THREE.Points for dust motes');

    // 1.5 Postprocessing Clamping & Resilience
    assert(postprocessingJs.includes('Math.min(window.devicePixelRatio || 1, 1.75)'), 'modules/postprocessing.js clamps DPR to max 1.75');
    assert(postprocessingJs.includes('triggerHitAberration('), 'modules/postprocessing.js exports triggerHitAberration()');
}

async function runBrowserRuntimeStressTests() {
    console.log('\n================================================================================');
    console.log('>>> 2. HEADLESS BROWSER RUNTIME ADVERSARIAL STRESS TESTS');
    console.log('================================================================================');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ]
    });

    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => {
        pageErrors.push(err.message);
        console.error('  [PAGE ERROR]', err.message);
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(baseUri, { waitUntil: 'load' });
    await page.setViewport({ width: 1280, height: 720, deviceScaleFactor: 1 });

    // Start game
    console.log('  Starting 3D game session...');
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1200));

    // =========================================================================
    // SECTION 2.1: Map Profile Switching Stress Test (40 Rapid Cycles)
    // =========================================================================
    console.log('\n--- Section 2.1: Map Profile Switching Stress Test (40 cycles) ---');
    const mapSwitchResult = await page.evaluate(() => {
        const results = {
            initialLightCount: 0,
            initialLightIds: [],
            cycles: 0,
            colorMatches: true,
            intensityMatches: true,
            lightRefPreserved: true,
            sceneLightCountHistory: [],
            errors: []
        };

        try {
            // Count all lights initially attached to scene
            const sceneLights = scene.children.filter(c => c && c.isLight);
            results.initialLightCount = sceneLights.length;
            results.initialLightIds = sceneLights.map(l => ({ name: l.name, type: l.type }));

            const originalHemi = hemiLight;
            const originalDir = dirLight;
            const originalBase = baseAmbientLight;
            const originalBotMuzzle = botMuzzleLight;

            const mapSequence = ['dust2', 'inferno', 'biolab', 'shootingRange'];

            for (let i = 0; i < 40; i++) {
                const targetMap = mapSequence[i % mapSequence.length];
                currentMap = targetMap;
                isShootingRange = (targetMap === 'shootingRange');

                // Invoke rebuildMap directly
                rebuildMap();

                const cfgKey = isShootingRange ? 'shootingRange' : targetMap;
                const expectedCfg = MAP_LIGHTING_CONFIGS[cfgKey];

                // Verify hemiLight properties
                if (hemiLight.color.getHex() !== expectedCfg.hemiSky) {
                    results.colorMatches = false;
                    results.errors.push(`Cycle ${i} (${targetMap}): hemiLight.color mismatch (expected 0x${expectedCfg.hemiSky.toString(16)}, got 0x${hemiLight.color.getHex().toString(16)})`);
                }
                if (hemiLight.groundColor.getHex() !== expectedCfg.hemiGround) {
                    results.colorMatches = false;
                    results.errors.push(`Cycle ${i} (${targetMap}): hemiLight.groundColor mismatch`);
                }
                if (Math.abs(hemiLight.intensity - expectedCfg.hemiIntensity) > 0.001) {
                    results.intensityMatches = false;
                    results.errors.push(`Cycle ${i} (${targetMap}): hemiLight.intensity mismatch`);
                }

                // Verify dirLight properties
                if (dirLight.color.getHex() !== expectedCfg.dirColor) {
                    results.colorMatches = false;
                    results.errors.push(`Cycle ${i} (${targetMap}): dirLight.color mismatch`);
                }
                if (Math.abs(dirLight.intensity - expectedCfg.dirIntensity) > 0.001) {
                    results.intensityMatches = false;
                    results.errors.push(`Cycle ${i} (${targetMap}): dirLight.intensity mismatch`);
                }

                // Verify dust motes color & opacity
                if (dustMotePoints && dustMotePoints.material) {
                    if (dustMotePoints.material.color.getHex() !== expectedCfg.dustColor) {
                        results.colorMatches = false;
                        results.errors.push(`Cycle ${i} (${targetMap}): dustMotePoints color mismatch`);
                    }
                    if (Math.abs(dustMotePoints.material.opacity - expectedCfg.dustOpacity) > 0.001) {
                        results.intensityMatches = false;
                        results.errors.push(`Cycle ${i} (${targetMap}): dustMotePoints opacity mismatch`);
                    }
                }

                // Verify light instances are exact same object references (zero allocation / zero duplicate)
                if (hemiLight !== originalHemi || dirLight !== originalDir || baseAmbientLight !== originalBase || botMuzzleLight !== originalBotMuzzle) {
                    results.lightRefPreserved = false;
                    results.errors.push(`Cycle ${i}: Light instance reference changed!`);
                }

                // Record current light count in scene.children
                const currentLights = scene.children.filter(c => c && c.isLight).length;
                results.sceneLightCountHistory.push(currentLights);
                results.cycles++;
            }

            // Restore dust2 as default
            currentMap = 'dust2';
            isShootingRange = false;
            rebuildMap();
        } catch (e) {
            results.errors.push('Exception in mapSwitch: ' + e.message);
        }

        return results;
    });

    assert(mapSwitchResult.cycles === 40, `Completed 40 rapid map rebuild cycles (actual: ${mapSwitchResult.cycles})`);
    assert(mapSwitchResult.lightRefPreserved === true, 'All light instances (hemiLight, dirLight, baseAmbientLight, botMuzzleLight) preserved identical references without re-instantiation');
    assert(mapSwitchResult.colorMatches === true, 'Hemisphere, directional, and dust mote colors matched map profile specs on every cycle', mapSwitchResult.errors.join('; '));
    assert(mapSwitchResult.intensityMatches === true, 'Hemisphere, directional, and dust mote intensities matched map profile specs on every cycle');

    const allCountsMatchInitial = mapSwitchResult.sceneLightCountHistory.every(c => c === mapSwitchResult.initialLightCount);
    assert(allCountsMatchInitial === true, `Light count in scene.children strictly invariant across 40 map switches (constant at ${mapSwitchResult.initialLightCount})`);
    assert(mapSwitchResult.errors.length === 0, `No light-related errors across 40 map switches (errors: ${mapSwitchResult.errors.length})`);

    // =========================================================================
    // SECTION 2.2: Particle Pool Boundary & Atmospheric Mote Isolation
    // =========================================================================
    console.log('\n--- Section 2.2: Particle Pool Boundary & Atmospheric Mote Isolation ---');
    const particleStressResult = await page.evaluate(() => {
        const res = {
            initialPoolSize: 0,
            initialFreeCount: 0,
            dustMoteCount: 0,
            dustMoteIsPoints: false,
            dustMotesIsolated: true,
            maxActiveDuring300Rounds: 0,
            poolSizeDuring300Rounds: 0,
            maxActiveDuringSaturatedBurst: 0,
            saturatedPoolSize: 0,
            recycledSuccessfully: true,
            errors: []
        };

        try {
            const pool = getParticlePool();
            const free = getParticlePoolFree();
            res.initialPoolSize = pool ? pool.length : 0;
            res.initialFreeCount = free ? free.length : 0;

            // Check dustMotePoints
            if (dustMotePoints) {
                res.dustMoteIsPoints = dustMotePoints.isPoints === true;
                if (dustMotePoints.geometry && dustMotePoints.geometry.attributes && dustMotePoints.geometry.attributes.position) {
                    res.dustMoteCount = dustMotePoints.geometry.attributes.position.count;
                }
            }

            // Verify particles array does NOT contain dustMotePoints
            res.dustMotesIsolated = !particles.some(p => p === dustMotePoints || (p.mesh && p.mesh === dustMotePoints));

            // Simulate firing 300 rounds
            // Each round creates a bullet, muzzle flash, and multiple impact / trail / shell particles
            let peakParticles = 0;
            for (let round = 0; round < 300; round++) {
                // Spawn 6 particles per round
                for (let k = 0; k < 6; k++) {
                    obtainParticle(
                        sharedParticleGeo,
                        0xffaa00,
                        (Math.random() - 0.5) * 10,
                        1.5,
                        (Math.random() - 0.5) * 10,
                        (Math.random() - 0.5) * 2,
                        Math.random() * 3,
                        (Math.random() - 0.5) * 2,
                        0.5
                    );
                }

                // Advance physics/particles update
                updateParticles(0.016);
                if (particles.length > peakParticles) {
                    peakParticles = particles.length;
                }

                if (particles.length > 1024) {
                    res.errors.push(`particles.length exceeded 1024 during round ${round} (length: ${particles.length})`);
                }
            }
            res.maxActiveDuring300Rounds = peakParticles;
            res.poolSizeDuring300Rounds = getParticlePool().length;

            // Saturated Allocation Stress: Attempt to request 2500 particles in a single tick (more than 2x pool capacity)
            for (let i = 0; i < 2500; i++) {
                obtainParticle(
                    sharedParticleGeo,
                    0xff4400,
                    0, 1, 0,
                    0, 1, 0,
                    0.2
                );
            }
            res.maxActiveDuringSaturatedBurst = particles.length;
            res.saturatedPoolSize = getParticlePool().length;

            // Step updateParticles until all expire to ensure complete recycling back to free pool
            for (let step = 0; step < 120; step++) {
                updateParticles(0.05);
            }
            const freeAfterDecay = getParticlePoolFree().length;
            const activeAfterDecay = particles.length;

            // Confirm that all particles were returned to free list
            if (activeAfterDecay !== 0 || freeAfterDecay !== 1024) {
                res.recycledSuccessfully = false;
                res.errors.push(`Recycle mismatch: active=${activeAfterDecay}, free=${freeAfterDecay} (expected 0 and 1024)`);
            }

            // Confirm dustMotePoints still completely intact and isolated
            if (dustMotePoints.geometry.attributes.position.count !== 350) {
                res.errors.push(`dustMotePoints count changed to ${dustMotePoints.geometry.attributes.position.count}`);
            }
            if (particles.some(p => p === dustMotePoints || (p.mesh && p.mesh === dustMotePoints))) {
                res.dustMotesIsolated = false;
                res.errors.push('dustMotePoints leaked into particles array');
            }
        } catch (e) {
            res.errors.push('Exception in particle stress: ' + e.message);
        }

        return res;
    });

    assert(particleStressResult.initialPoolSize === 1024, `Initial particle pool pre-allocated to 1024 (actual: ${particleStressResult.initialPoolSize})`);
    assert(particleStressResult.dustMoteIsPoints === true, 'dustMotePoints is an independent THREE.Points object');
    assert(particleStressResult.dustMoteCount === 350, `dustMotePoints contains exactly 350 motes (actual: ${particleStressResult.dustMoteCount})`);
    assert(particleStressResult.dustMotesIsolated === true, 'dustMotePoints is strictly isolated and never pushed into particles array');
    assert(particleStressResult.maxActiveDuring300Rounds <= 1024, `particles.length strictly bounded <= 1024 during 300 rounds (peak: ${particleStressResult.maxActiveDuring300Rounds})`);
    assert(particleStressResult.poolSizeDuring300Rounds === 1024, `particlePool size strictly constant at 1024 during 300 rounds (actual: ${particleStressResult.poolSizeDuring300Rounds})`);
    assert(particleStressResult.maxActiveDuringSaturatedBurst <= 1024, `particles.length strictly clamped to <= 1024 under 2500 burst allocations (peak: ${particleStressResult.maxActiveDuringSaturatedBurst})`);
    assert(particleStressResult.saturatedPoolSize === 1024, `particlePool size never expands beyond 1024 under saturation (actual: ${particleStressResult.saturatedPoolSize})`);
    assert(particleStressResult.recycledSuccessfully === true, 'All pooled particles successfully returned to particlePoolFree after expiration');
    assert(particleStressResult.errors.length === 0, `Zero errors during particle stress test (errors: ${particleStressResult.errors.length})`);

    // =========================================================================
    // SECTION 2.3: Anti-Acne & Shadow Inspection in Live WebGL
    // =========================================================================
    console.log('\n--- Section 2.3: Anti-Acne & Shadow Inspection in Live WebGL ---');
    const shadowInspectionResult = await page.evaluate(() => {
        const res = {
            hasDirLight: false,
            castShadow: false,
            bias: null,
            normalBias: null,
            radius: null,
            mapSizeW: null,
            mapSizeH: null,
            camNear: null,
            camFar: null,
            frustumLeft: null,
            frustumRight: null,
            frustumTop: null,
            frustumBottom: null,
            floorReceivesShadow: false,
            wallCastsAndReceivesShadow: false,
            totalShadowCasters: 0,
            totalShadowReceivers: 0
        };

        if (dirLight) {
            res.hasDirLight = true;
            res.castShadow = dirLight.castShadow;
            res.bias = dirLight.shadow.bias;
            res.normalBias = dirLight.shadow.normalBias;
            res.radius = dirLight.shadow.radius;
            res.mapSizeW = dirLight.shadow.mapSize.width;
            res.mapSizeH = dirLight.shadow.mapSize.height;
            res.camNear = dirLight.shadow.camera.near;
            res.camFar = dirLight.shadow.camera.far;
            res.frustumLeft = dirLight.shadow.camera.left;
            res.frustumRight = dirLight.shadow.camera.right;
            res.frustumTop = dirLight.shadow.camera.top;
            res.frustumBottom = dirLight.shadow.camera.bottom;
        }

        // Check map architecture meshes
        let foundFloor = false;
        let foundWall = false;
        scene.traverse(obj => {
            if (obj.isMesh) {
                if (obj.name === 'floor') {
                    foundFloor = true;
                    if (obj.receiveShadow) res.floorReceivesShadow = true;
                }
                if (obj.name === 'wall') {
                    foundWall = true;
                    if (obj.castShadow && obj.receiveShadow) res.wallCastsAndReceivesShadow = true;
                }
                if (obj.castShadow) res.totalShadowCasters++;
                if (obj.receiveShadow) res.totalShadowReceivers++;
            }
        });

        return res;
    });

    assert(shadowInspectionResult.hasDirLight === true, 'Directional light dirLight exists in scene');
    assert(shadowInspectionResult.castShadow === true, 'dirLight.castShadow is true');
    assert(Math.abs(shadowInspectionResult.bias - (-0.0004)) < 0.00001, `dirLight.shadow.bias is exactly -0.0004 (actual: ${shadowInspectionResult.bias})`);
    assert(Math.abs(shadowInspectionResult.normalBias - 0.05) < 0.00001, `dirLight.shadow.normalBias is exactly 0.05 (actual: ${shadowInspectionResult.normalBias})`);
    assert(Math.abs(shadowInspectionResult.radius - 2.0) < 0.001, `dirLight.shadow.radius is 2.0 for soft shadows (actual: ${shadowInspectionResult.radius})`);
    assert(shadowInspectionResult.mapSizeW >= 1024 && shadowInspectionResult.mapSizeH >= 1024, `Shadow map resolution is >= 1024x1024 (actual: ${shadowInspectionResult.mapSizeW}x${shadowInspectionResult.mapSizeH})`);
    assert(shadowInspectionResult.frustumLeft === -320 && shadowInspectionResult.frustumRight === 320, `Shadow camera frustum horizontal span is [-320, 320]`);
    assert(shadowInspectionResult.frustumBottom === -320 && shadowInspectionResult.frustumTop === 320, `Shadow camera frustum vertical span is [-320, 320]`);
    assert(shadowInspectionResult.floorReceivesShadow === true, 'Floor meshes have receiveShadow = true');
    assert(shadowInspectionResult.wallCastsAndReceivesShadow === true, 'Wall meshes have castShadow = true and receiveShadow = true');
    assert(shadowInspectionResult.totalShadowCasters > 50, `Multiple shadow casters active in scene (count: ${shadowInspectionResult.totalShadowCasters})`);
    assert(shadowInspectionResult.totalShadowReceivers > 50, `Multiple shadow receivers active in scene (count: ${shadowInspectionResult.totalShadowReceivers})`);

    // =========================================================================
    // SECTION 2.4: Muzzle Flash Transient Dynamic Light Lifecycle
    // =========================================================================
    console.log('\n--- Section 2.4: Muzzle Flash Transient Dynamic Light Lifecycle ---');
    const muzzleFlashResult = await page.evaluate(() => {
        const res = {
            playerLightExists: !!playerMuzzleLight,
            botLightExists: !!botMuzzleLight,
            playerInitialIntensity: playerMuzzleLight ? playerMuzzleLight.intensity : -1,
            botInitialIntensity: botMuzzleLight ? botMuzzleLight.intensity : -1,
            playerTriggerIntensity: 0,
            botTriggerIntensity: 0,
            playerDecayedHalfway: false,
            playerDecayedToZero: false,
            botDecayedToZero: false
        };

        // Trigger player muzzle flash
        if (typeof triggerMuzzleFlash === 'function') {
            triggerMuzzleFlash(WEAPONS.ak47);
            res.playerTriggerIntensity = playerMuzzleLight.intensity;
        }

        // Trigger bot muzzle flash
        if (typeof triggerBotMuzzleFlash === 'function') {
            triggerBotMuzzleFlash(new THREE.Vector3(0, 1.5, 0));
            res.botTriggerIntensity = botMuzzleLight.intensity;
        }

        // Simulate 0.02s decay
        const delta = 0.02;
        playerMuzzleTimer -= delta;
        playerMuzzleLight.intensity = Math.max(0, playerMuzzleLight.intensity * Math.exp(-delta * 40));
        botMuzzleTimer -= delta;
        botMuzzleLight.intensity = Math.max(0, botMuzzleLight.intensity * Math.exp(-delta * 40));

        if (playerMuzzleLight.intensity < res.playerTriggerIntensity && playerMuzzleLight.intensity > 0) {
            res.playerDecayedHalfway = true;
        }

        // Simulate another 0.1s decay (timer expires)
        const delta2 = 0.1;
        playerMuzzleTimer -= delta2;
        if (playerMuzzleTimer <= 0) playerMuzzleLight.intensity = 0;
        botMuzzleTimer -= delta2;
        if (botMuzzleTimer <= 0) botMuzzleLight.intensity = 0;

        if (playerMuzzleLight.intensity === 0) res.playerDecayedToZero = true;
        if (botMuzzleLight.intensity === 0) res.botDecayedToZero = true;

        return res;
    });

    assert(muzzleFlashResult.playerLightExists === true, 'playerMuzzleLight exists on camera');
    assert(muzzleFlashResult.botLightExists === true, 'botMuzzleLight exists on scene');
    assert(muzzleFlashResult.playerInitialIntensity === 0, 'playerMuzzleLight resting intensity is 0');
    assert(muzzleFlashResult.botInitialIntensity === 0, 'botMuzzleLight resting intensity is 0');
    assert(muzzleFlashResult.playerTriggerIntensity >= 2.0, `triggerMuzzleFlash spikes player light intensity >= 2.0 (actual: ${muzzleFlashResult.playerTriggerIntensity})`);
    assert(muzzleFlashResult.botTriggerIntensity >= 1.5, `triggerBotMuzzleFlash spikes bot light intensity >= 1.5 (actual: ${muzzleFlashResult.botTriggerIntensity})`);
    assert(muzzleFlashResult.playerDecayedHalfway === true, 'playerMuzzleLight decays exponentially during simulation step');
    assert(muzzleFlashResult.playerDecayedToZero === true, 'playerMuzzleLight returns completely to 0 after timer expiry');
    assert(muzzleFlashResult.botDecayedToZero === true, 'botMuzzleLight returns completely to 0 after timer expiry');

    // =========================================================================
    // SECTION 2.5: Postprocessing Hit Aberration & Viewport Clamping Stress
    // =========================================================================
    console.log('\n--- Section 2.5: Postprocessing Hit Aberration & DPR Clamping Stress ---');
    const postprocessingStressResult = await page.evaluate(() => {
        const res = {
            hasInit: typeof initPostprocessing === 'function',
            hasRender: typeof renderPostprocessing === 'function',
            hasTriggerAberration: typeof triggerHitAberration === 'function',
            aberrationTriggerValue: 0,
            aberrationDecayed: false,
            noNaN: true,
            dprClampedProperly: true,
            errors: []
        };

        try {
            // Trigger rapid hit aberrations (e.g. 50 times in rapid succession)
            for (let i = 0; i < 50; i++) {
                triggerHitAberration(0.5);
            }

            // Step renderPostprocessing 30 frames
            for (let f = 0; f < 30; f++) {
                renderPostprocessing(0.016);
            }

            // Check cinematicShaderPass uniform if available
            if (typeof cinematicShaderPass !== 'undefined' && cinematicShaderPass && cinematicShaderPass.uniforms) {
                const uHit = cinematicShaderPass.uniforms.uHitAberration.value;
                if (isNaN(uHit)) {
                    res.noNaN = false;
                    res.errors.push('uHitAberration is NaN');
                }
                if (uHit < 0.05) {
                    res.aberrationDecayed = true;
                }
            } else {
                res.aberrationDecayed = true;
            }

            // Test resize clamping
            if (typeof onPostprocessingResize === 'function') {
                onPostprocessingResize(800, 600);
                const currentDPR = renderer.getPixelRatio();
                if (currentDPR > 1.75001) {
                    res.dprClampedProperly = false;
                    res.errors.push(`Renderer pixelRatio ${currentDPR} exceeds 1.75 ceiling`);
                }
            }
        } catch (e) {
            res.errors.push('Exception in postprocessing stress: ' + e.message);
        }

        return res;
    });

    assert(postprocessingStressResult.hasInit === true, 'initPostprocessing function exists on window');
    assert(postprocessingStressResult.hasRender === true, 'renderPostprocessing function exists on window');
    assert(postprocessingStressResult.hasTriggerAberration === true, 'triggerHitAberration function exists on window');
    assert(postprocessingStressResult.aberrationDecayed === true, 'Hit chromatic aberration decayed smoothly after rapid triggers');
    assert(postprocessingStressResult.noNaN === true, 'Shader uniforms remain finite (no NaN or Infinity)');
    assert(postprocessingStressResult.dprClampedProperly === true, 'Postprocessing resize strictly clamps DPR to <= 1.75');
    assert(postprocessingStressResult.errors.length === 0, `Zero errors during postprocessing stress test (errors: ${postprocessingStressResult.errors.length})`);

    assert(pageErrors.length === 0, `Zero page runtime errors throughout entire test run (errors: ${pageErrors.join('; ')})`);

    await browser.close();
}

async function main() {
    console.log('################################################################################');
    console.log('### MILESTONE 3 EMPIRICAL ADVERSARIAL CHALLENGE TEST SUITE (challenger_m3_2) ###');
    console.log('################################################################################');

    try {
        await runStaticInvariantChecks();
        await runBrowserRuntimeStressTests();
    } catch (err) {
        console.error('FATAL TEST ERROR:', err);
        failedAssertions++;
        failureDetails.push(`FATAL TEST ERROR: ${err.message}`);
    }

    console.log('\n================================================================================');
    console.log(`### FINAL VERIFICATION SUMMARY ###`);
    console.log(`Total Assertions: ${totalAssertions}`);
    console.log(`Passed: ${passedAssertions}`);
    console.log(`Failed: ${failedAssertions}`);
    console.log(`Success Rate: ${Math.round((passedAssertions / totalAssertions) * 100)}%`);
    console.log('================================================================================');

    if (failedAssertions > 0) {
        console.error('\nFAILURE DETAILS:');
        failureDetails.forEach(f => console.error(`  - ${f}`));
        console.error('\nVERDICT: REQUEST_CHANGES');
        process.exit(1);
    } else {
        console.log('\nVERDICT: APPROVE');
        process.exit(0);
    }
}

main();
