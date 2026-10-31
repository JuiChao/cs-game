const puppeteer = require('puppeteer');
const path = require('path');

async function runHUDChallenge() {
    console.log("================================================================================");
    console.log(">>> TEAMWORK CHALLENGER M1: EMPIRICAL STRESS TEST HARNESS");
    console.log("================================================================================");

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
    const consoleErrors = [];

    page.on('pageerror', err => {
        if (err.message && err.message.includes('requestPointerLock')) return;
        pageErrors.push(err.message);
        console.error('PAGE ERROR:', err.message);
    });

    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text && (text.includes('Pointer Lock API') || text.includes('requestPointerLock'))) return;
            consoleErrors.push(text);
            console.error('CONSOLE ERROR:', text);
        }
    });

    await page.setViewport({ width: 1920, height: 1080 });
    const gameUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    let totalTests = 0;
    let passedTests = 0;
    let failedTests = 0;
    const failures = [];

    function assert(condition, testId, description) {
        totalTests++;
        if (condition) {
            passedTests++;
            console.log(`  [PASS] ${testId}: ${description}`);
        } else {
            failedTests++;
            failures.push({ testId, description });
            console.error(`  [FAIL] ${testId}: ${description}`);
        }
    }

    try {
        await page.goto(gameUri, { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 600));

        // Start match to mount HUD and game elements
        await page.evaluate(() => {
            if (typeof selectGameMode === 'function') selectGameMode('bomb');
            const startBtn = document.getElementById('start-btn');
            if (startBtn) startBtn.click();
        });
        await new Promise(r => setTimeout(r, 1000));

        // -------------------------------------------------------------------------
        // CHALLENGE 1: RAPID HEALTH STATE CHANGES & LOW-HP CRITICAL PULSE
        // -------------------------------------------------------------------------
        console.log("\n--- CHALLENGE 1: Vitality Tracking & Critical Low-HP Pulse ---");

        const healthTrackingResult = await page.evaluate(() => {
            const results = [];
            const testSteps = [100, 85, 50, 30, 26, 25, 24, 10, 1, 0, -20];

            for (const hp of testSteps) {
                playerState.hp = hp;
                updateHUD();

                const hpValEl = document.getElementById('hp-val');
                const hpFillEl = document.getElementById('hp-fill');
                const hudLeftEl = document.querySelector('.hud-left');

                const displayedText = hpValEl ? hpValEl.innerText.trim() : null;
                const fillWidth = hpFillEl ? hpFillEl.style.width : null;
                const hasCritical = hudLeftEl ? hudLeftEl.classList.contains('critical-vitals') : false;

                results.push({
                    hp,
                    displayedText,
                    fillWidth,
                    hasCritical
                });
            }
            return results;
        });

        for (const res of healthTrackingResult) {
            const expectedText = String(Math.ceil(res.hp));
            assert(res.displayedText === expectedText, `CH1.1[HP=${res.hp}]`, `#hp-val displays '${expectedText}' (got '${res.displayedText}')`);

            const expectedWidthPct = Math.max(0, Math.min(100, (res.hp / 100) * 100));
            assert(res.fillWidth === `${expectedWidthPct}%`, `CH1.2[HP=${res.hp}]`, `#hp-fill width is '${expectedWidthPct}%' (got '${res.fillWidth}')`);

            const shouldBeCritical = res.hp <= 25;
            assert(res.hasCritical === shouldBeCritical, `CH1.3[HP=${res.hp}]`, `.critical-vitals class is ${shouldBeCritical ? 'PRESENT' : 'ABSENT'} at ${res.hp} HP`);
        }

        // Boundary stress: Rapidly oscillate around 25 HP 200 times
        const oscillationResult = await page.evaluate(() => {
            const hudLeftEl = document.querySelector('.hud-left');
            let desyncCount = 0;
            for (let i = 0; i < 200; i++) {
                const targetHp = (i % 2 === 0) ? 25 : 26;
                playerState.hp = targetHp;
                updateHUD();
                const expectedCritical = targetHp <= 25;
                if (hudLeftEl.classList.contains('critical-vitals') !== expectedCritical) {
                    desyncCount++;
                }
            }
            // Restore to 100
            playerState.hp = 100;
            updateHUD();
            const cleanAt100 = !hudLeftEl.classList.contains('critical-vitals');
            return { desyncCount, cleanAt100 };
        });

        assert(oscillationResult.desyncCount === 0, "CH1.4", "Rapid 200x 25HP/26HP oscillation produced 0 class desyncs");
        assert(oscillationResult.cleanAt100, "CH1.5", "Restoring to 100 HP cleanly removes .critical-vitals");

        // Styling inspection of .critical-vitals
        const criticalStyling = await page.evaluate(() => {
            playerState.hp = 15;
            updateHUD();
            const hudLeftEl = document.querySelector('.hud-left');
            const hpValEl = document.getElementById('hp-val');
            const hpFillEl = document.getElementById('hp-fill');

            const hudLeftStyle = window.getComputedStyle(hudLeftEl);
            const hpValStyle = window.getComputedStyle(hpValEl);
            const hpFillStyle = window.getComputedStyle(hpFillEl);

            return {
                borderLeftColor: hudLeftStyle.borderLeftColor,
                animationName: hudLeftStyle.animationName,
                valColor: hpValStyle.color,
                fillBackground: hpFillStyle.background
            };
        });

        assert(criticalStyling.borderLeftColor.includes('255, 23, 68') || criticalStyling.borderLeftColor.includes('rgb(255, 23, 68)'), 
            "CH1.6", `Critical vitals border-left transitions to crimson (${criticalStyling.borderLeftColor})`);
        assert(criticalStyling.animationName.includes('criticalVitalsPulse'), 
            "CH1.7", `Critical vitals pulse animation active (${criticalStyling.animationName})`);

        // Reset HP to full
        await page.evaluate(() => { playerState.hp = 100; updateHUD(); });


        // -------------------------------------------------------------------------
        // CHALLENGE 2: ROUND TIMER TRANSITIONS TO RED WHEN C4 PLANTED
        // -------------------------------------------------------------------------
        console.log("\n--- CHALLENGE 2: Chronometer C4 Plant Reactive Glow & Transitions ---");

        const timerPrePlant = await page.evaluate(() => {
            bombState.planted = false;
            roundTime = 135; // 02:15
            updateHUD();
            const timerEl = document.getElementById('round-timer');
            const style = window.getComputedStyle(timerEl);
            return {
                text: timerEl.innerText,
                color: timerEl.style.color,
                computedColor: style.color
            };
        });
        assert(timerPrePlant.text === '02:15', "CH2.1", "Standard round timer formats 135s as '02:15'");
        assert(timerPrePlant.color === '#fff' || timerPrePlant.color === 'rgb(255, 255, 255)', "CH2.2", "Standard round timer inline color is '#fff'");

        // Plant C4 & pump animation frames for 0.3s CSS transition
        const timerPostPlant = await page.evaluate(async () => {
            bombState.planted = true;
            bombState.timer = 45;
            if (!bombState.mesh && typeof createC4 === 'function') {
                bombState.mesh = createC4();
                bombState.mesh.position.set(0, 0.1, 0);
                scene.add(bombState.mesh);
            }
            updateHUD();
            const timerEl = document.getElementById('round-timer');
            const inlineColor = timerEl.style.color;
            const text = timerEl.innerText;
            // Pump 25 animation frames to allow CSS transition: color 0.3s ease to complete
            for (let i = 0; i < 25; i++) {
                await new Promise(r => requestAnimationFrame(r));
            }
            const computedColor = window.getComputedStyle(timerEl).color;
            return {
                text,
                inlineColor,
                computedColor
            };
        });
        assert(timerPostPlant.text === '00:45', "CH2.3", "Planted C4 timer displays '00:45'");
        assert(timerPostPlant.inlineColor === '#ff3c3c' || timerPostPlant.inlineColor === 'rgb(255, 60, 60)', 
            "CH2.4", `Planted C4 timer text inline color transitions to crimson '#ff3c3c' / rgb(255, 60, 60) (actual: ${timerPostPlant.inlineColor})`);
        assert(timerPostPlant.computedColor.includes('255, 60, 60') || timerPostPlant.computedColor.includes('rgb(255, 60, 60)'),
            "CH2.5", `Computed text color confirms red glow transition (${timerPostPlant.computedColor})`);

        // Rapid countdown simulation: 45s down to 0s
        const countdownSimulation = await page.evaluate(() => {
            let formatErrors = 0;
            for (let t = 45; t >= 0; t--) {
                bombState.timer = t;
                updateHUD();
                const timerEl = document.getElementById('round-timer');
                const expected = `00:${t.toString().padStart(2, '0')}`;
                if (timerEl.innerText !== expected) formatErrors++;
            }
            return { formatErrors };
        });
        assert(countdownSimulation.formatErrors === 0, "CH2.6", "C4 countdown from 45s to 0s completed with 0 formatting errors");

        // Defusal / Round Reset back to standard & pump frames for transition
        const timerPostDefusal = await page.evaluate(async () => {
            bombState.planted = false;
            if (bombState.mesh) {
                scene.remove(bombState.mesh);
                bombState.mesh = null;
            }
            roundTime = 200;
            updateHUD();
            const timerEl = document.getElementById('round-timer');
            const inlineColor = timerEl.style.color;
            const text = timerEl.innerText;
            for (let i = 0; i < 25; i++) {
                await new Promise(r => requestAnimationFrame(r));
            }
            const computedColor = window.getComputedStyle(timerEl).color;
            return {
                text,
                inlineColor,
                computedColor
            };
        });
        assert(timerPostDefusal.text === '03:20', "CH2.7", "Post-defusal timer restored to '03:20'");
        assert(timerPostDefusal.inlineColor === '#fff' || timerPostDefusal.inlineColor === 'rgb(255, 255, 255)', 
            "CH2.8", `Post-defusal timer text color returned to '#fff' (actual: ${timerPostDefusal.inlineColor})`);
        assert(timerPostDefusal.computedColor.includes('255, 255, 255') || timerPostDefusal.computedColor.includes('rgb(255, 255, 255)'),
            "CH2.9", `Computed text color confirms white restoration (${timerPostDefusal.computedColor})`);


        // -------------------------------------------------------------------------
        // CHALLENGE 3: CROSSHAIR .HIT AND .HIT-HEADSHOT WITH ZERO LAYOUT JITTER
        // -------------------------------------------------------------------------
        console.log("\n--- CHALLENGE 3: Crosshair Hit Feedback & Jitter Invariance ---");

        // Baseline crosshair geometry
        const baseCrosshairRect = await page.evaluate(() => {
            const ch = document.getElementById('crosshair');
            const r = ch.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        });

        // Trigger normal hitmarker
        const hitResult = await page.evaluate(() => {
            showHitMarker(false);
            const ch = document.getElementById('crosshair');
            const r = ch.getBoundingClientRect();
            return {
                hasHit: ch.classList.contains('hit'),
                hasHeadshot: ch.classList.contains('hit-headshot'),
                rect: { x: r.x, y: r.y, width: r.width, height: r.height }
            };
        });
        assert(hitResult.hasHit, "CH3.1", "#crosshair gains .hit class on weapon hit");
        assert(!hitResult.hasHeadshot, "CH3.2", "#crosshair does NOT have .hit-headshot on normal hit");

        // Check layout jitter (center coordinates x + width/2, y + height/2 must remain identical)
        const baseCenterX = baseCrosshairRect.x + baseCrosshairRect.width / 2;
        const baseCenterY = baseCrosshairRect.y + baseCrosshairRect.height / 2;
        const hitCenterX = hitResult.rect.x + hitResult.rect.width / 2;
        const hitCenterY = hitResult.rect.y + hitResult.rect.height / 2;

        const jitterDeltaX = Math.abs(baseCenterX - hitCenterX);
        const jitterDeltaY = Math.abs(baseCenterY - hitCenterY);
        assert(jitterDeltaX < 0.01 && jitterDeltaY < 0.01, "CH3.3", 
            `Normal hit center anchor invariant (deltaX: ${jitterDeltaX.toFixed(4)}, deltaY: ${jitterDeltaY.toFixed(4)}) - ZERO JITTER`);

        // Trigger headshot hitmarker
        const headshotResult = await page.evaluate(() => {
            showHitMarker(true);
            const ch = document.getElementById('crosshair');
            const r = ch.getBoundingClientRect();
            return {
                hasHit: ch.classList.contains('hit'),
                hasHeadshot: ch.classList.contains('hit-headshot'),
                rect: { x: r.x, y: r.y, width: r.width, height: r.height }
            };
        });
        assert(!headshotResult.hasHit, "CH3.4", "#crosshair does NOT have .hit when headshot is triggered");
        assert(headshotResult.hasHeadshot, "CH3.5", "#crosshair gains .hit-headshot class on headshot hit");

        const hsCenterX = headshotResult.rect.x + headshotResult.rect.width / 2;
        const hsCenterY = headshotResult.rect.y + headshotResult.rect.height / 2;
        const hsJitterDeltaX = Math.abs(baseCenterX - hsCenterX);
        const hsJitterDeltaY = Math.abs(baseCenterY - hsCenterY);
        assert(hsJitterDeltaX < 0.01 && hsJitterDeltaY < 0.01, "CH3.6", 
            `Headshot hit center anchor invariant (deltaX: ${hsJitterDeltaX.toFixed(4)}, deltaY: ${hsJitterDeltaY.toFixed(4)}) - ZERO JITTER`);

        // Wait 120ms to verify auto-cleanup timer
        await new Promise(r => setTimeout(r, 150));
        const cleanCrosshair = await page.evaluate(() => {
            const ch = document.getElementById('crosshair');
            return {
                hasHit: ch.classList.contains('hit'),
                hasHeadshot: ch.classList.contains('hit-headshot')
            };
        });
        assert(!cleanCrosshair.hasHit && !cleanCrosshair.hasHeadshot, "CH3.7", 
            "Crosshair automatically clears .hit and .hit-headshot after ~90ms timeout");

        // High-frequency burst test: 50 rapid weapon hits spaced 5ms apart
        await page.evaluate(async () => {
            for (let i = 0; i < 50; i++) {
                showHitMarker(i % 3 === 0);
                await new Promise(r => setTimeout(r, 5));
            }
        });
        await new Promise(r => setTimeout(r, 200));

        const burstCleanup = await page.evaluate(() => {
            const ch = document.getElementById('crosshair');
            return {
                hasHit: ch.classList.contains('hit'),
                hasHeadshot: ch.classList.contains('hit-headshot')
            };
        });
        assert(!burstCleanup.hasHit && !burstCleanup.hasHeadshot, "CH3.8", 
            "High-frequency 50-hit burst cleans up completely with zero stuck classes");


        // -------------------------------------------------------------------------
        // CHALLENGE 4: FLOATING DAMAGE NUMBERS LIFECYCLE & DOM LEAK STRESS
        // -------------------------------------------------------------------------
        console.log("\n--- CHALLENGE 4: Floating Damage Numbers Lifecycle & DOM Leaks ---");

        const spawnDamageResult = await page.evaluate(() => {
            const container = document.getElementById('damage-numbers');
            const initialCount = container.children.length;

            const dummyPos = new THREE.Vector3(0, 1.5, -5);
            showFloatingDamage(35, dummyPos, false);

            const afterNormal = container.children.length;
            const spawnedEl = container.lastElementChild;
            const textContent = spawnedEl ? spawnedEl.innerText : null;
            const hasClass = spawnedEl ? spawnedEl.classList.contains('damage-text') : false;

            showFloatingDamage(110, dummyPos, true);
            const afterHeadshot = container.children.length;
            const hsEl = container.lastElementChild;
            const hsColor = hsEl ? hsEl.style.color : null;

            return {
                initialCount,
                afterNormal,
                afterHeadshot,
                textContent,
                hasClass,
                hsColor,
                floatingDamagesCount: floatingDamages.length
            };
        });

        assert(spawnDamageResult.afterNormal === spawnDamageResult.initialCount + 1, "CH4.1", 
            "showFloatingDamage(35) appends exactly 1 child to #damage-numbers");
        assert(spawnDamageResult.textContent === '35', "CH4.2", 
            "Spawned damage text displays '35'");
        assert(spawnDamageResult.hasClass, "CH4.3", 
            "Spawned element has class .damage-text");
        assert(spawnDamageResult.hsColor.includes('255, 77, 77') || spawnDamageResult.hsColor.includes('#ff4d4d'), "CH4.4", 
            `Headshot damage text colored red (${spawnDamageResult.hsColor})`);

        // Edge case: Negative and zero damage should NOT spawn elements
        const invalidDamageResult = await page.evaluate(() => {
            const container = document.getElementById('damage-numbers');
            const before = container.children.length;
            const dummyPos = new THREE.Vector3(0, 1.5, -5);

            showFloatingDamage(0, dummyPos, false);
            showFloatingDamage(-40, dummyPos, false);

            const after = container.children.length;
            return { delta: after - before };
        });
        assert(invalidDamageResult.delta === 0, "CH4.5", 
            "showFloatingDamage(0) and negative damage safely ignored without spawning DOM elements");

        // Lifecycle & Garbage Collection: Advance floating damages by 1.6s
        const gcResult = await page.evaluate(() => {
            const container = document.getElementById('damage-numbers');
            // Advance delta by 1.6s (life is 1.5s)
            updateFloatingDamages(1.6);
            return {
                containerChildrenRemaining: container.children.length,
                floatingDamagesArrayRemaining: floatingDamages.length
            };
        });
        assert(gcResult.containerChildrenRemaining === 0, "CH4.6", 
            "updateFloatingDamages lifecycle expired all DOM nodes from #damage-numbers");
        assert(gcResult.floatingDamagesArrayRemaining === 0, "CH4.7", 
            "floatingDamages internal physics tracking array fully flushed (0 entries)");

        // HEAVY ADVERSARIAL STRESS TEST: Spawn 500 damage numbers over 300 frames
        console.log("  Executing rapid 500-instance damage generation stress test...");
        const stressGCResult = await page.evaluate(() => {
            const container = document.getElementById('damage-numbers');
            const dummyPos = new THREE.Vector3(0, 1.5, -5);

            // Step 1: Rapidly spawn 500 damage numbers
            for (let i = 0; i < 500; i++) {
                showFloatingDamage(Math.floor(Math.random() * 80) + 10, dummyPos, i % 5 === 0);
            }
            const peakDomNodes = container.children.length;
            const peakArrayLen = floatingDamages.length;

            // Step 2: Step through physics simulation frame by frame
            // Total 100 frames at 0.02s = 2.0s (exceeds 1.5s maxLife)
            for (let f = 0; f < 100; f++) {
                updateFloatingDamages(0.02);
            }

            const finalDomNodes = container.children.length;
            const finalArrayLen = floatingDamages.length;

            return {
                peakDomNodes,
                peakArrayLen,
                finalDomNodes,
                finalArrayLen
            };
        });

        assert(stressGCResult.peakDomNodes === 500, "CH4.8", 
            `Peak DOM nodes allocated successfully during stress burst: ${stressGCResult.peakDomNodes}`);
        assert(stressGCResult.finalDomNodes === 0, "CH4.9", 
            `DOM nodes after lifecycle expiration: ${stressGCResult.finalDomNodes} (ZERO DOM LEAKS)`);
        assert(stressGCResult.finalArrayLen === 0, "CH4.10", 
            `Internal tracking array after lifecycle expiration: ${stressGCResult.finalArrayLen} (ZERO MEMORY LEAKS)`);

        // Final page error diagnostics
        assert(pageErrors.length === 0, "DIAG.1", 
            `Zero unhandled page errors during empirical challenge harness (found: ${pageErrors.length})`);
        assert(consoleErrors.length === 0, "DIAG.2", 
            `Zero browser console error logs during empirical challenge harness (found: ${consoleErrors.length})`);

    } catch (err) {
        console.error("FATAL ERROR IN CHALLENGE HARNESS:", err);
        failedTests++;
        failures.push({ testId: "FATAL", description: err.message });
    } finally {
        await browser.close();
    }

    console.log("\n================================================================================");
    console.log("             CHALLENGE HARNESS VERIFICATION SUMMARY                             ");
    console.log("================================================================================");
    console.log(`  Total Assertions Executed : ${totalTests}`);
    console.log(`  Total Passed              : ${passedTests}`);
    console.log(`  Total Failed              : ${failedTests}`);
    console.log("================================================================================");

    if (failedTests === 0) {
        console.log(">>> VERDICT: APPROVE - All empirical HUD challenges passed flawlessly! <<<\n");
        process.exit(0);
    } else {
        console.error(`>>> VERDICT: REJECT - ${failedTests} challenge assertions failed! <<<`);
        console.error("Failures:", failures);
        process.exit(1);
    }
}

runHUDChallenge();
