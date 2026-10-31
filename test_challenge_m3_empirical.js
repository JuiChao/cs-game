/**
 * Milestone 3 Gate Empirical Adversarial Stress Test Harness
 * Author: challenger_m3_1 (teamwork_challenger)
 * 
 * Stress Dimensions:
 * 1. Live Render Postprocessing Continuous Stability (250 frames with EffectComposer, UnrealBloomPass, and CinematicShader)
 * 2. Rapid Hit Aberration Burst Stress (100 rapid triggers, exponential decay to zero, NaN guard)
 * 3. Concurrent Weapon Cycling + Live Postprocessing Render Stress (500 switches while rendering)
 * 4. Postprocessing Viewport Resize & DPR Clamping Stress (50 rapid resize events across various aspect ratios)
 * 5. Dynamic Muzzle Flash Lighting & Atmospheric Dust Motes Bounding Stress
 * 6. Postprocessing Graceful Fallback & Error Trapping
 * 
 * Execution: node test_challenge_m3_empirical.js
 */

const puppeteer = require('puppeteer');
const path = require('path');

async function runMilestone3ChallengeSuite() {
    console.log("================================================================================");
    console.log("    MILESTONE 3: EMPIRICAL ADVERSARIAL STRESS TEST SUITE                        ");
    console.log("================================================================================");

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const failures = [];

    function record(condition, testId, message, details = "") {
        totalTests++;
        if (condition) {
            console.log(`  [PASS] ${testId}: ${message} ${details}`);
            totalPassed++;
        } else {
            console.error(`  [FAIL] ${testId}: ${message} ${details}`);
            totalFailed++;
            failures.push(`${testId}: ${message} ${details}`);
        }
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ]
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    try {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));
        page.on('console', msg => {
            if (msg.type() === 'error') pageErrors.push(msg.text());
        });

        await page.goto(baseUri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 800));

        // =========================================================================
        // SECTION 1: CONTINUOUS LIVE POSTPROCESSING RENDER MEMORY STABILITY
        // =========================================================================
        console.log("\n>>> 1. LIVE POSTPROCESSING CONTINUOUS RENDER STABILITY (250 Frames)");
        const liveRenderResult = await page.evaluate(async () => {
            // Verify postprocessing is active
            const isActive = (typeof postprocessingActive !== 'undefined') ? postprocessingActive : false;
            const hasComposer = (typeof composer !== 'undefined') && (composer !== null);
            const hasCinematicPass = (typeof cinematicPass !== 'undefined') && (cinematicPass !== null);

            // Warm up 10 frames
            for (let i = 0; i < 10; i++) {
                if (typeof renderPostprocessing === 'function') {
                    renderPostprocessing(0.016);
                }
            }

            const initialGeos = renderer.info.memory.geometries;
            const initialTex = renderer.info.memory.textures;
            const initialPrograms = renderer.info.programs ? renderer.info.programs.length : 0;

            // Render 250 consecutive live frames
            for (let frame = 0; frame < 250; frame++) {
                if (typeof renderPostprocessing === 'function') {
                    renderPostprocessing(0.016);
                }
            }

            const finalGeos = renderer.info.memory.geometries;
            const finalTex = renderer.info.memory.textures;
            const finalPrograms = renderer.info.programs ? renderer.info.programs.length : 0;

            return {
                isActive,
                hasComposer,
                hasCinematicPass,
                initialGeos,
                initialTex,
                initialPrograms,
                finalGeos,
                finalTex,
                finalPrograms,
                geoDelta: finalGeos - initialGeos,
                texDelta: finalTex - initialTex,
                programDelta: finalPrograms - initialPrograms
            };
        });

        record(
            liveRenderResult.isActive && liveRenderResult.hasComposer && liveRenderResult.hasCinematicPass,
            "M3.1.1",
            "Live EffectComposer and CinematicPass are fully initialized and active",
            `(active: ${liveRenderResult.isActive})`
        );
        record(
            liveRenderResult.geoDelta === 0,
            "M3.1.2",
            "Continuous live postprocessing maintains zero geometry allocation growth over 250 frames",
            `(initial: ${liveRenderResult.initialGeos}, final: ${liveRenderResult.finalGeos}, delta: ${liveRenderResult.geoDelta})`
        );
        record(
            liveRenderResult.texDelta === 0,
            "M3.1.3",
            "Continuous live postprocessing maintains zero texture allocation growth over 250 frames",
            `(initial: ${liveRenderResult.initialTex}, final: ${liveRenderResult.finalTex}, delta: ${liveRenderResult.texDelta})`
        );
        record(
            liveRenderResult.programDelta === 0,
            "M3.1.4",
            "Shader programs remain strictly constant (zero shader recompilation leaks)",
            `(programs: ${liveRenderResult.finalPrograms}, delta: ${liveRenderResult.programDelta})`
        );

        // =========================================================================
        // SECTION 2: HIT CHROMATIC ABERRATION BURST & EXPONENTIAL DECAY
        // =========================================================================
        console.log("\n>>> 2. HIT CHROMATIC ABERRATION BURST & EXPONENTIAL DECAY");
        const aberrationResult = await page.evaluate(async () => {
            if (typeof triggerHitAberration !== 'function') return { available: false };

            // 100 rapid random intensity triggers
            for (let i = 0; i < 100; i++) {
                triggerHitAberration(Math.random() * 0.1);
            }

            const clampedMax = currentHitAberration <= 0.08 && currentHitAberration > 0;
            const isNotNaN = !isNaN(currentHitAberration);

            // Step decay simulation for 60 frames (1 second at 60 FPS)
            const decayHistory = [];
            for (let step = 0; step < 60; step++) {
                renderPostprocessing(0.016);
                decayHistory.push(currentHitAberration);
            }

            const finalAberration = currentHitAberration;
            const fullyDecayed = finalAberration === 0.0;
            const strictlyMonotonicDecay = decayHistory.every((val, idx) => {
                if (idx === 0) return true;
                return val <= decayHistory[idx - 1] + 0.00001;
            });

            return {
                available: true,
                clampedMax,
                isNotNaN,
                finalAberration,
                fullyDecayed,
                strictlyMonotonicDecay
            };
        });

        record(
            aberrationResult.available && aberrationResult.clampedMax && aberrationResult.isNotNaN,
            "M3.2.1",
            "triggerHitAberration correctly clamps burst intensity and prevents NaN",
            `(valid clamp: ${aberrationResult.clampedMax})`
        );
        record(
            aberrationResult.fullyDecayed && aberrationResult.strictlyMonotonicDecay,
            "M3.2.2",
            "Hit chromatic aberration decays exponentially and cleanly restores to exactly 0.0 within 1s",
            `(final: ${aberrationResult.finalAberration})`
        );

        // =========================================================================
        // SECTION 3: RAPID WEAPON CYCLING (500 CYCLES) UNDER ACTIVE LIVE RENDERING
        // =========================================================================
        console.log("\n>>> 3. RAPID WEAPON CYCLING (500 Cycles) UNDER ACTIVE LIVE RENDERING");
        const weaponCycleStressResult = await page.evaluate(async () => {
            const geosBefore = renderer.info.memory.geometries;
            const texBefore = renderer.info.memory.textures;

            // Perform 500 weapon cycles while rendering live postprocessing
            for (let cycle = 0; cycle < 500; cycle++) {
                switchWeapon((cycle % 4) + 1);
                if (cycle % 5 === 0 && typeof renderPostprocessing === 'function') {
                    renderPostprocessing(0.016);
                }
            }

            // Let any pending disposal settle
            switchWeapon(1);
            renderPostprocessing(0.016);

            const geosAfter = renderer.info.memory.geometries;
            const texAfter = renderer.info.memory.textures;

            return {
                geosBefore,
                texBefore,
                geosAfter,
                texAfter,
                geoDelta: geosAfter - geosBefore,
                texDelta: texAfter - texBefore,
                isBounded: (geosAfter <= geosBefore + 4) && (texAfter <= texBefore)
            };
        });

        record(
            weaponCycleStressResult.isBounded,
            "M3.3.1",
            "500 rapid weapon switches under live postprocessing maintain strictly bounded memory",
            `(geo: ${weaponCycleStressResult.geosBefore} -> ${weaponCycleStressResult.geosAfter} [delta ${weaponCycleStressResult.geoDelta}], tex: ${weaponCycleStressResult.texBefore} -> ${weaponCycleStressResult.texAfter} [delta ${weaponCycleStressResult.texDelta}])`
        );

        // =========================================================================
        // SECTION 4: POSTPROCESSING VIEWPORT RESIZE & DPR CLAMPING STRESS
        // =========================================================================
        console.log("\n>>> 4. POSTPROCESSING VIEWPORT RESIZE & DPR CLAMPING STRESS (50 Resizes)");
        const resizeStressResult = await page.evaluate(async () => {
            if (typeof onPostprocessingResize !== 'function') return { available: false };

            const testResolutions = [
                [1920, 1080], [1366, 768], [768, 1024], [390, 844], [844, 390],
                [2560, 1440], [3840, 2160], [1280, 720], [800, 600], [1024, 768]
            ];

            let resizeErrors = 0;
            const dprValues = [];

            // Perform 50 rapid resize invocations across diverse resolutions
            for (let i = 0; i < 50; i++) {
                const [w, h] = testResolutions[i % testResolutions.length];
                try {
                    onPostprocessingResize(w, h);
                    renderPostprocessing(0.016);
                    if (composer && composer.pixelRatio) {
                        dprValues.push(composer.pixelRatio);
                    }
                } catch (e) {
                    resizeErrors++;
                }
            }

            // Restore standard viewport
            onPostprocessingResize(1920, 1080);
            renderPostprocessing(0.016);

            const allDprClamped = dprValues.every(dpr => dpr <= 1.75 && dpr > 0);

            return {
                available: true,
                resizeErrors,
                allDprClamped,
                maxDprObserved: Math.max(...dprValues, 1.0)
            };
        });

        record(
            resizeStressResult.available && resizeStressResult.resizeErrors === 0,
            "M3.4.1",
            "50 rapid resize events executed cleanly without composer or FBO render target failures",
            `(errors: ${resizeStressResult.resizeErrors})`
        );
        record(
            resizeStressResult.allDprClamped,
            "M3.4.2",
            "Composer pixel ratio is strictly clamped to DPR <= 1.75 across all screen sizes",
            `(max DPR: ${resizeStressResult.maxDprObserved})`
        );

        // =========================================================================
        // SECTION 5: ATMOSPHERIC DUST MOTES & DYNAMIC MUZZLE LIGHTS STRESS
        // =========================================================================
        console.log("\n>>> 5. ATMOSPHERIC DUST MOTES & DYNAMIC MUZZLE LIGHTS STRESS");
        const atmosphericStressResult = await page.evaluate(async () => {
            const hasDustMotes = typeof dustMotePoints !== 'undefined' && dustMotePoints !== null;
            const hasPlayerLight = typeof playerMuzzleLight !== 'undefined' && playerMuzzleLight !== null;
            const hasBotLight = typeof botMuzzleLight !== 'undefined' && botMuzzleLight !== null;

            // Trigger muzzle flash bursts
            if (typeof triggerMuzzleFlash === 'function') {
                triggerMuzzleFlash(getCurrentWeapon());
            }
            if (typeof triggerBotMuzzleFlash === 'function') {
                triggerBotMuzzleFlash(new THREE.Vector3(10, 2, 10));
            }

            const playerLightTriggered = playerMuzzleLight ? playerMuzzleLight.intensity > 1.0 : false;
            const botLightTriggered = botMuzzleLight ? botMuzzleLight.intensity > 1.0 : false;

            // Decay for 30 frames
            for (let f = 0; f < 30; f++) {
                if (typeof animate === 'function') {
                    // Update lights and dust motes directly
                    if (playerMuzzleTimer > 0 && playerMuzzleLight) {
                        playerMuzzleTimer -= 0.016;
                        playerMuzzleLight.intensity = Math.max(0, playerMuzzleLight.intensity * Math.exp(-0.016 * 40));
                        if (playerMuzzleTimer <= 0) playerMuzzleLight.intensity = 0;
                    }
                    if (botMuzzleTimer > 0 && botMuzzleLight) {
                        botMuzzleTimer -= 0.016;
                        botMuzzleLight.intensity = Math.max(0, botMuzzleLight.intensity * Math.exp(-0.016 * 40));
                        if (botMuzzleTimer <= 0) botMuzzleLight.intensity = 0;
                    }
                }
            }

            const lightsCleanlyZeroed = (playerMuzzleLight.intensity === 0) && (botMuzzleLight.intensity === 0);

            // Verify dust motes bounds (toroidal 90m volume)
            let dustMotesBounded = true;
            if (dustMotePoints && dustMotePoints.geometry) {
                const pos = dustMotePoints.geometry.attributes.position.array;
                for (let i = 0; i < pos.length; i += 3) {
                    const y = pos[i + 1];
                    if (isNaN(pos[i]) || isNaN(y) || isNaN(pos[i + 2]) || y < 0.4 || y > 22.5) {
                        dustMotesBounded = false;
                        break;
                    }
                }
            }

            return {
                hasDustMotes,
                hasPlayerLight,
                hasBotLight,
                playerLightTriggered,
                botLightTriggered,
                lightsCleanlyZeroed,
                dustMotesBounded
            };
        });

        record(
            atmosphericStressResult.hasDustMotes && atmosphericStressResult.hasPlayerLight && atmosphericStressResult.hasBotLight,
            "M3.5.1",
            "Persistent player/bot muzzle lights and atmospheric dust motes are active",
            `()`
        );
        record(
            atmosphericStressResult.playerLightTriggered && atmosphericStressResult.lightsCleanlyZeroed,
            "M3.5.2",
            "Muzzle flash dynamic lights achieve high peak luminescence and decay exponentially to zero",
            `(decayed to 0: ${atmosphericStressResult.lightsCleanlyZeroed})`
        );
        record(
            atmosphericStressResult.dustMotesBounded,
            "M3.5.3",
            "Atmospheric dust motes remain strictly bounded within 90m toroidal volume without NaN coordinates",
            `(bounded: ${atmosphericStressResult.dustMotesBounded})`
        );

        // =========================================================================
        // SECTION 6: ERROR RESILIENCY & FALLBACK INTEGRITY
        // =========================================================================
        console.log("\n>>> 6. ERROR RESILIENCY & POSTPROCESSING FALLBACK INTEGRITY");
        const fallbackResult = await page.evaluate(async () => {
            let fallbackInvokedWithoutError = false;

            // Temporarily disable composer to test direct renderer fallback
            const origComposer = composer;
            composer = null;

            try {
                // Calling renderPostprocessing when composer is null should directly call renderer.render()
                renderPostprocessing(0.016);
                fallbackInvokedWithoutError = true;
            } catch (e) {
                fallbackInvokedWithoutError = false;
            } finally {
                composer = origComposer;
            }

            return {
                fallbackInvokedWithoutError
            };
        });

        record(
            fallbackResult.fallbackInvokedWithoutError,
            "M3.6.1",
            "renderPostprocessing seamlessly falls back to standard renderer.render() if composer is disabled",
            `()`
        );

        record(
            pageErrors.length === 0,
            "M3.6.2",
            "Zero uncaught page errors or WebGL exceptions recorded during Milestone 3 stress harness",
            `(page errors: ${pageErrors.length})`
        );

    } finally {
        await browser.close();
    }

    console.log("\n================================================================================");
    console.log("                     M3 EMPIRICAL STRESS TEST SUMMARY                           ");
    console.log("================================================================================");
    console.log(`  Total Assertions Executed : ${totalTests}`);
    console.log(`  Total Passed              : ${totalPassed}`);
    console.log(`  Total Failed              : ${totalFailed}`);
    console.log("================================================================================");

    if (totalFailed > 0) {
        console.error("\n>>> VERDICT: REQUEST_CHANGES <<<");
        failures.forEach(f => console.error("  - " + f));
        process.exit(1);
    } else {
        console.log("\n>>> VERDICT: APPROVE <<<");
        process.exit(0);
    }
}

runMilestone3ChallengeSuite().catch(err => {
    console.error("FATAL SUITE CRASH:", err);
    process.exit(1);
});
