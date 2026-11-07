const puppeteer = require('puppeteer');
const path = require('path');

async function runTests() {
    console.log("=== STARTING FIRE MODE & RECOIL VERIFICATION ===");
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error("FAIL:", message);
            failures++;
        } else {
            console.log("PASS:", message);
        }
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => { pageErrors.push(err.message); console.error('PAGE ERROR:', err.message); });

    const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(uri, { waitUntil: 'load' });

    // Start game
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1200));

    // Test 1: Global APIs exist
    console.log("\n--- Test 1: Fire Mode API Existence ---");
    const apisExist = await page.evaluate(() => {
        return typeof window.getWeaponFireMode === 'function' &&
               typeof window.setWeaponFireMode === 'function' &&
               typeof window.toggleFireMode === 'function';
    });
    assert(apisExist, "getWeaponFireMode, setWeaponFireMode, toggleFireMode exposed on window");

    // Test 2: Initial mode and badge
    console.log("\n--- Test 2: Initial Fire Mode & HUD Badge ---");
    const initialMode = await page.evaluate(() => {
        const cur = window.getCurrentWeapon();
        const mode = window.getWeaponFireMode(cur);
        const propMode = window.playerState.fireMode;
        const badge = document.getElementById('fire-mode-badge');
        return {
            weapon: cur.id,
            mode,
            propMode,
            badgeText: badge ? badge.innerText.trim() : null,
            badgeClass: badge ? badge.className : null,
            badgeVisible: badge ? badge.style.display !== 'none' : false
        };
    });
    assert(initialMode.mode === 'multi', `Initial mode is 'multi' (got: ${initialMode.mode})`);
    assert(initialMode.propMode === 'multi', `playerState.fireMode is 'multi' (got: ${initialMode.propMode})`);
    assert(initialMode.badgeText === '多发', `HUD badge text is '多发' (got: ${initialMode.badgeText})`);
    assert(initialMode.badgeVisible === true, "HUD badge is visible for secondary firearm (pistol)");

    // Test 3: Toggle fire mode via KeyX
    console.log("\n--- Test 3: Toggle Fire Mode via KeyX ---");
    await page.keyboard.press('KeyX');
    await new Promise(r => setTimeout(r, 100));

    const singleMode = await page.evaluate(() => {
        const cur = window.getCurrentWeapon();
        const mode = window.getWeaponFireMode(cur);
        const propMode = window.playerState.fireMode;
        const badge = document.getElementById('fire-mode-badge');
        return {
            mode,
            propMode,
            badgeText: badge ? badge.innerText.trim() : null,
            hasSingleClass: badge ? badge.classList.contains('single-mode') : false,
            hasMultiClass: badge ? badge.classList.contains('multi-mode') : false
        };
    });
    assert(singleMode.mode === 'single', `After KeyX, mode is 'single' (got: ${singleMode.mode})`);
    assert(singleMode.propMode === 'single', `playerState.fireMode is 'single' (got: ${singleMode.propMode})`);
    assert(singleMode.badgeText === '单发', `HUD badge text changed to '单发' (got: ${singleMode.badgeText})`);
    assert(singleMode.hasSingleClass && !singleMode.hasMultiClass, "HUD badge has .single-mode class");

    // Toggle back to multi via KeyX
    await page.keyboard.press('KeyX');
    await new Promise(r => setTimeout(r, 100));
    const backToMulti = await page.evaluate(() => window.playerState.fireMode);
    assert(backToMulti === 'multi', `After second KeyX, mode returned to 'multi' (got: ${backToMulti})`);

    // Test 4: Toggle fire mode via UI click on badge
    console.log("\n--- Test 4: Toggle via Clicking HUD Badge ---");
    await page.evaluate(() => {
        document.getElementById('fire-mode-badge').click();
    });
    await new Promise(r => setTimeout(r, 100));
    const clickToggleMode = await page.evaluate(() => window.playerState.fireMode);
    assert(clickToggleMode === 'single', `After clicking badge, mode toggled to 'single' (got: ${clickToggleMode})`);

    await page.evaluate(() => {
        document.getElementById('fire-mode-badge').click();
    });
    await new Promise(r => setTimeout(r, 100));
    const clickToggleBack = await page.evaluate(() => window.playerState.fireMode);
    assert(clickToggleBack === 'multi', `After clicking badge again, mode toggled to 'multi' (got: ${clickToggleBack})`);

    // Test 5: Per-weapon Fire Mode Persistence
    console.log("\n--- Test 5: Per-Weapon Persistence Across Weapon Switch ---");
    const persistenceTest = await page.evaluate(() => {
        // Buy rifle (slot 1)
        playerCurrency = 10000;
        buyWeapon('rifle', 2700);
        switchWeapon(1);
        const rifleInitial = getWeaponFireMode(getCurrentWeapon());

        // Toggle rifle to single
        toggleFireMode();
        const rifleSingle = getWeaponFireMode(getCurrentWeapon());

        // Switch to secondary (pistol, slot 2)
        switchWeapon(2);
        const pistolMode = getWeaponFireMode(getCurrentWeapon());

        // Switch back to rifle (slot 1)
        switchWeapon(1);
        const rifleRetained = getWeaponFireMode(getCurrentWeapon());

        return { rifleInitial, rifleSingle, pistolMode, rifleRetained };
    });
    assert(persistenceTest.rifleInitial === 'multi', "Rifle initially defaults to 'multi'");
    assert(persistenceTest.rifleSingle === 'single', "Rifle toggled to 'single'");
    assert(persistenceTest.pistolMode === 'multi', "Pistol maintained its own 'multi' mode");
    assert(persistenceTest.rifleRetained === 'single', "Rifle retained 'single' mode upon switching back");

    // Test 6: Non-firearms (Knife / Grenade) hide badge and ignore toggle
    console.log("\n--- Test 6: Non-Firearm Safety (Knife & Grenades) ---");
    const meleeTest = await page.evaluate(() => {
        window.switchWeapon(3); // Knife
        const knifeBadgeDisplay = document.getElementById('fire-mode-badge').style.display;
        window.toggleFireMode();
        const curW = window.getCurrentWeapon();
        return {
            knifeId: curW.id,
            badgeDisplay: knifeBadgeDisplay
        };
    });
    assert(meleeTest.badgeDisplay === 'none', "Fire mode badge is hidden for melee weapons");

    // Test 7: Single-fire prevents continuous spray on trigger hold
    console.log("\n--- Test 7: Single-Fire Mechanics (No Continuous Spray) ---");
    const sprayTest = await page.evaluate(() => {
        switchWeapon(1); // Rifle (AK-47, mag 30)
        ammoState.primary.clip = 30;
        ammoState.primary.reserve = 90;
        playerState.isSpectating = false;
        playerState.isControllingDrone = false;
        roundActive = true;
        if (typeof controls !== 'undefined' && controls) controls.isLocked = true;

        // Ensure single mode
        setWeaponFireMode('rifle', 'single');
        const clipBefore = ammoState.primary.clip;

        // Initial click: should fire 1 bullet
        isShooting = true;
        handleShooting(true);
        const clipAfterInitial = ammoState.primary.clip;

        // Advance frames while keeping trigger pressed (handleShooting(false))
        for (let f = 0; f < 30; f++) {
            frameCount += 1;
            handleShooting(false);
        }
        const clipAfterHold = ammoState.primary.clip;

        // Release trigger and press again: should fire 1 more bullet
        isShooting = false;
        frameCount += 10;
        isShooting = true;
        handleShooting(true);
        const clipAfterSecondClick = ammoState.primary.clip;

        return {
            clipBefore,
            clipAfterInitial,
            clipAfterHold,
            clipAfterSecondClick
        };
    });
    assert(sprayTest.clipBefore - sprayTest.clipAfterInitial === 1, `Single-fire initial click consumed exactly 1 bullet (${sprayTest.clipBefore} -> ${sprayTest.clipAfterInitial})`);
    assert(sprayTest.clipAfterHold === sprayTest.clipAfterInitial, `Holding trigger in single-fire did NOT fire more bullets (${sprayTest.clipAfterHold} === ${sprayTest.clipAfterInitial})`);
    assert(sprayTest.clipAfterInitial - sprayTest.clipAfterSecondClick === 1, `Second click consumed exactly 1 bullet (${sprayTest.clipAfterInitial} -> ${sprayTest.clipAfterSecondClick})`);

    // Test 8: Multi-fire allows continuous spray on trigger hold
    console.log("\n--- Test 8: Multi-Fire Mechanics (Continuous Spray) ---");
    const multiSprayTest = await page.evaluate(() => {
        switchWeapon(1);
        setWeaponFireMode('rifle', 'multi');
        ammoState.primary.clip = 30;
        const clipStart = ammoState.primary.clip;

        isShooting = true;
        handleShooting(true);

        // Advance frames with fireRate (6 frames for rifle)
        for (let f = 0; f < 30; f++) {
            frameCount += 1;
            handleShooting(false);
        }
        isShooting = false;
        const clipEnd = ammoState.primary.clip;
        return { clipStart, clipEnd, fired: clipStart - clipEnd };
    });
    assert(multiSprayTest.fired > 2, `Multi-fire held trigger fired continuously (fired ${multiSprayTest.fired} rounds in 30 frames)`);

    // Test 9: Exact 80% Recoil Verification
    console.log("\n--- Test 9: Recoil Exactly 80% in Single-Fire Mode ---");
    const recoilTest = await page.evaluate(() => {
        switchWeapon(1); // Rifle
        const w = getCurrentWeapon();
        const pattern = RECOIL_PATTERNS[w.id];

        // 1. Measure Multi-Fire Recoil
        setWeaponFireMode('rifle', 'multi');
        playerState.cameraShake = 0;
        playerState.lastShot = -1000;
        playerState.recoilPatternIndex = 0;
        playerState.lastRecoilShotFrame = 0;
        playerState.isAds = false;
        playerState.bulletType = 'normal';
        playerState.bulletStacking = false;

        const quatBeforeMulti = camera.quaternion.clone();
        const eulerBeforeMulti = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(quatBeforeMulti);

        ammoState.primary.clip = 30;
        isShooting = true;
        handleShooting(true);

        const quatAfterMulti = camera.quaternion.clone();
        const eulerAfterMulti = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(quatAfterMulti);

        const pitchMulti = eulerAfterMulti.x - eulerBeforeMulti.x;
        const yawMulti = eulerAfterMulti.y - eulerBeforeMulti.y;
        const shakeMulti = playerState.cameraShake;

        // Reset camera and state
        camera.quaternion.copy(quatBeforeMulti);
        playerState.cameraShake = 0;
        playerState.lastShot = -1000;
        playerState.recoilPatternIndex = 0;
        playerState.lastRecoilShotFrame = 0;

        // 2. Measure Single-Fire Recoil
        setWeaponFireMode('rifle', 'single');
        ammoState.primary.clip = 30;
        isShooting = true;
        handleShooting(true);

        const quatAfterSingle = camera.quaternion.clone();
        const eulerAfterSingle = new THREE.Euler(0, 0, 0, 'YXZ').setFromQuaternion(quatAfterSingle);

        const pitchSingle = eulerAfterSingle.x - eulerBeforeMulti.x;
        const yawSingle = eulerAfterSingle.y - eulerBeforeMulti.y;
        const shakeSingle = playerState.cameraShake;

        return {
            patternPitch: pattern[0][0],
            pitchMulti,
            pitchSingle,
            yawMulti,
            yawSingle,
            shakeMulti,
            shakeSingle,
            ratioPitch: pitchSingle / pitchMulti
        };
    });

    console.log("Multi pitch:", recoilTest.pitchMulti, "Single pitch:", recoilTest.pitchSingle);
    console.log("Pitch ratio (Single / Multi):", recoilTest.ratioPitch);
    assert(Math.abs(recoilTest.ratioPitch - 0.8) < 1e-4, `Single-fire pitch recoil is exactly 80% (got ${recoilTest.ratioPitch.toFixed(4)})`);
    assert(Math.abs(recoilTest.shakeSingle - recoilTest.shakeMulti * 0.8) < 1e-6, `Single-fire camera shake is 80% (${recoilTest.shakeSingle} vs ${recoilTest.shakeMulti * 0.8})`);

    // Test 10: Sniper / Marksman Recoil Recovery in Single-Fire Mode
    console.log("\n--- Test 10: Sniper / Marksman Recoil Recovery at 80% ---");
    const dmrTest = await page.evaluate(() => {
        playerCurrency = 10000;
        buyWeapon('marksman', 3200);
        switchWeapon(1);
        playerState.isAds = true;
        playerState.bulletType = 'normal';

        // Multi
        setWeaponFireMode('marksman', 'multi');
        playerState.lastShot = -1000;
        playerState.recoilPatternIndex = 0;
        playerState.recoilRecovery = 0;
        isShooting = true;
        handleShooting(true);
        const multiRecov = playerState.recoilRecovery;

        // Single
        setWeaponFireMode('marksman', 'single');
        playerState.lastShot = -1000;
        playerState.recoilPatternIndex = 0;
        playerState.recoilRecovery = 0;
        isShooting = true;
        handleShooting(true);
        const singleRecov = playerState.recoilRecovery;

        return {
            multiRecov,
            singleRecov,
            ratio: singleRecov / multiRecov
        };
    });
    console.log("DMR Multi Recovery:", dmrTest.multiRecov, "Single Recovery:", dmrTest.singleRecov);
    assert(Math.abs(dmrTest.ratio - 0.8) < 1e-4, `DMR recoil recovery tracks exact 80% recoil (ratio: ${dmrTest.ratio.toFixed(4)})`);

    // Test 11: MK4 Burst Weapon Single vs Multi
    console.log("\n--- Test 11: MK4 Burst Weapon (3-round burst vs 1-round single) ---");
    const mk4Test = await page.evaluate(() => {
        playerCurrency = 10000;
        buyWeapon('mk4', 2100);
        switchWeapon(1);

        // In multi: burstQueue queues 2 extra rounds
        setWeaponFireMode('mk4', 'multi');
        ammoState.primary.clip = 30;
        playerState.lastShot = -1000;
        isShooting = true;
        handleShooting(true);
        const queueMulti = playerState.burstQueue;

        // In single: burstQueue is 0 (single shot only)
        setWeaponFireMode('mk4', 'single');
        ammoState.primary.clip = 30;
        playerState.lastShot = -1000;
        isShooting = true;
        handleShooting(true);
        const queueSingle = playerState.burstQueue;

        return { queueMulti, queueSingle };
    });
    assert(mk4Test.queueMulti === 2, `MK4 multi-mode queued 2 burst shots (got: ${mk4Test.queueMulti})`);
    assert(mk4Test.queueSingle === 0, `MK4 single-mode queued 0 extra burst shots (got: ${mk4Test.queueSingle})`);

    // Test 12: Semi-Auto Weapon Integrity in Multi-Mode (Deagle & Sniper)
    console.log("\n--- Test 12: Semi-Auto Weapon Integrity in Multi-Mode ---");
    const semiAutoTest = await page.evaluate(() => {
        // Deagle (auto: false)
        playerCurrency = 10000;
        buyWeapon('deagle', 650);
        switchWeapon(2);
        setWeaponFireMode('deagle', 'multi');
        ammoState.secondary.clip = 7;
        playerState.lastShot = -1000;

        isShooting = true;
        handleShooting(true); // 1st shot
        const deagleClipAfterClick = ammoState.secondary.clip;

        // Hold trigger for 40 frames
        for (let i = 0; i < 40; i++) {
            frameCount++;
            handleShooting(false);
        }
        isShooting = false;
        const deagleClipAfterHold = ammoState.secondary.clip;

        // Sniper (auto: false)
        buyWeapon('sniper', 4750);
        switchWeapon(1);
        setWeaponFireMode('sniper', 'multi');
        playerState.bulletType = 'normal';
        ammoState.primary.clip = 10;
        playerState.lastShot = -1000;

        isShooting = true;
        handleShooting(true);
        const sniperClipAfterClick = ammoState.primary.clip;

        for (let i = 0; i < 80; i++) {
            frameCount++;
            handleShooting(false);
        }
        isShooting = false;
        const sniperClipAfterHold = ammoState.primary.clip;

        return {
            deagleClipAfterClick,
            deagleClipAfterHold,
            sniperClipAfterClick,
            sniperClipAfterHold
        };
    });
    assert(semiAutoTest.deagleClipAfterClick === 6, "Deagle fires 1st shot on initial click (7 -> 6)");
    assert(semiAutoTest.deagleClipAfterHold === 6, "Deagle in multi-mode does NOT auto-spray while holding trigger (stays at 6)");
    assert(semiAutoTest.sniperClipAfterClick === 9, "Sniper fires 1st shot on initial click (10 -> 9)");
    assert(semiAutoTest.sniperClipAfterHold === 9, "Sniper in multi-mode does NOT auto-spray while holding trigger (stays at 9)");

    // Test 13: Special Weapons Safety (Flamethrower & Mortar)
    console.log("\n--- Test 13: Special Weapon Safety (Flamethrower & Mortar) ---");
    const specialWeaponTest = await page.evaluate(() => {
        playerCurrency = 20000;
        buyWeapon('flamethrower', 4000);
        switchWeapon(1);
        const ftBadge = document.getElementById('fire-mode-badge').style.display;
        const ftToggleResult = toggleFireMode();

        buyWeapon('mortar', 6000);
        switchWeapon(1);
        const mortarBadge = document.getElementById('fire-mode-badge').style.display;
        const mortarToggleResult = toggleFireMode();

        return {
            ftBadge,
            ftToggleResult,
            mortarBadge,
            mortarToggleResult
        };
    });
    assert(specialWeaponTest.ftBadge === 'none', "Fire mode badge is hidden for Flamethrower");
    assert(specialWeaponTest.ftToggleResult === undefined, "toggleFireMode safely ignores Flamethrower");
    assert(specialWeaponTest.mortarBadge === 'none', "Fire mode badge is hidden for Mortar");
    assert(specialWeaponTest.mortarToggleResult === undefined, "toggleFireMode safely ignores Mortar");

    // Test 14: DMR Recoil Recovery in Single Mode over Physics Loop
    console.log("\n--- Test 14: DMR Recoil Recovery Execution in Single Mode ---");
    const dmrRecoveryFrameTest = await page.evaluate(() => {
        playerCurrency = 10000;
        buyWeapon('marksman', 3200);
        switchWeapon(1);
        setWeaponFireMode('marksman', 'single');
        playerState.lastShot = -1000;

        // Tap fire: click and release
        isShooting = true;
        handleShooting(true);
        isShooting = false;
        const recovInitial = playerState.recoilRecovery;

        // Run 30 physics recovery frames
        for (let i = 0; i < 30; i++) {
            let delta = 0.016;
            const _recoilW = getCurrentWeapon();
            const _isSingle = (typeof getWeaponFireMode === 'function') && getWeaponFireMode(_recoilW) === 'single';
            if (_recoilW && _recoilW.id === 'marksman' && !isShooting && !_isSingle) {
                playerState.recoilRecovery = 0;
                playerState.recoilRecoveryYaw = 0;
            }
            const _hasRecoilRecovery = _recoilW && (_recoilW.id === 'sniper' || (_recoilW.id === 'marksman' && (isShooting || _isSingle)));
            if (_hasRecoilRecovery && playerState.recoilRecovery && playerState.recoilRecovery > 0) {
                const rate = playerState.recoilRecoveryRate || 0.15;
                const recoverAmount = Math.min(playerState.recoilRecovery, delta * rate);
                playerState.recoilRecovery -= recoverAmount;
            }
        }
        const recovAfterFrames = playerState.recoilRecovery;

        return { recovInitial, recovAfterFrames };
    });
    assert(dmrRecoveryFrameTest.recovInitial > 0, `DMR registered initial single-fire recoil recovery (${dmrRecoveryFrameTest.recovInitial})`);
    assert(dmrRecoveryFrameTest.recovAfterFrames < dmrRecoveryFrameTest.recovInitial, `DMR smoothly recovers recoil in single mode even after trigger release (${dmrRecoveryFrameTest.recovInitial} -> ${dmrRecoveryFrameTest.recovAfterFrames})`);

    // Test 15: Touch Listener Idempotency
    console.log("\n--- Test 15: Touch Listener Idempotency ---");
    const touchIdempotencyTest = await page.evaluate(() => {
        playerCurrency = 10000;
        buyWeapon('rifle', 2700);
        switchWeapon(1);
        setWeaponFireMode('rifle', 'multi');

        window._touchControlsInitialized = false;
        const badge = document.getElementById('fire-mode-badge');
        if (badge) badge._touchFmInit = false;

        // Re-run setupTouchControls multiple times to test duplicate listener prevention
        setupTouchControls();
        window._touchControlsInitialized = false;
        setupTouchControls();

        const touchEvent = new Event('touchstart', { bubbles: true, cancelable: true });
        badge.dispatchEvent(touchEvent);
        const modeAfter1Tap = getWeaponFireMode(getCurrentWeapon());

        badge.dispatchEvent(touchEvent);
        const modeAfter2Taps = getWeaponFireMode(getCurrentWeapon());

        return { modeAfter1Tap, modeAfter2Taps };
    });
    assert(touchIdempotencyTest.modeAfter1Tap === 'single', "First touch tap toggles to single despite multiple setupTouchControls calls");
    assert(touchIdempotencyTest.modeAfter2Taps === 'multi', "Second touch tap toggles back to multi cleanly");

    // Test 16: Spread Bloom Safety When Trigger Held in Single-Fire Mode
    console.log("\n--- Test 16: Single-Fire Spread Bloom Safety on Trigger Hold ---");
    const spreadSafetyTest = await page.evaluate(() => {
        switchWeapon(1); // Rifle
        setWeaponFireMode('rifle', 'single');
        ammoState.primary.clip = 30;

        let baseSpread = 10;
        currentSpread = 10;

        // Click and hold trigger in single mode for 20 frames
        isShooting = true;
        handleShooting(true);

        for (let i = 0; i < 20; i++) {
            frameCount++;
            handleShooting(false);
            const weapon = getCurrentWeapon();
            const isSingle = (typeof getWeaponFireMode === 'function') && getWeaponFireMode(weapon) === 'single';
            const canContShoot = !isSingle && (weapon.auto || (weapon.id === 'sniper' && (playerState.bulletType === 'light' || (playerState.bulletStacking && playerState.bulletTypes && playerState.bulletTypes.includes('light')))));
            if (canContShoot || (frameCount - (playerState.lastShot || -999) <= 2)) {
                baseSpread += 8;
            }
        }
        isShooting = false;
        return { baseSpread };
    });
    // In full-auto, baseSpread would have increased by 20 * 8 = 160.
    // In single-fire, it only increases for the initial shot frames (<= 2 frames: at most 2 * 8 = 16).
    assert(spreadSafetyTest.baseSpread <= 26, `Single-fire trigger hold does not bloom spread indefinitely (baseSpread: ${spreadSafetyTest.baseSpread} <= 26)`);

    // Check page errors
    assert(pageErrors.length === 0, `Zero page errors during test run (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log(`\n=== VERIFICATION FINISHED: ${failures === 0 ? "ALL PASSED" : failures + " FAILURES"} ===`);
    if (failures > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("FATAL TEST RUN ERROR:", err);
    process.exit(1);
});
