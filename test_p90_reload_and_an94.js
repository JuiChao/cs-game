const puppeteer = require('puppeteer');
const path = require('path');

async function runTests() {
    console.log("================================================================================");
    console.log(">>> P90 RELOAD BUGFIX & AN-94 INTEGRATION TEST SUITE");
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
    await page.goto(gameUri, { waitUntil: 'load' });

    // Initialize game
    await page.evaluate(() => {
        if (typeof startGame === 'function') startGame('dust2', 'normal');
        playerCurrency = 100000;
        playerScore = 10000;
    });
    await new Promise(r => setTimeout(r, 600));

    let passed = 0;
    let failed = 0;

    function assert(cond, testId, msg) {
        if (cond) {
            console.log(`  [PASS] ${testId}: ${msg}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${testId}: ${msg}`);
            failed++;
        }
    }

    console.log("\n--- DOMAIN 1: P90 (SMG) Reload Bugfix Verification ---");

    const p90Buy = await page.evaluate(() => {
        buyWeapon('smg', 2350);
        return {
            primary: inventory.primary,
            slot: inventory.currentSlot,
            clip: ammoState.primary.clip,
            reserve: ammoState.primary.reserve,
            weaponName: document.getElementById('weapon-name').innerText
        };
    });

    assert(p90Buy.primary === 'smg', "P90.1", "P90 purchased and set as primary");
    assert(p90Buy.slot === 1, "P90.2", "Active inventory slot is 1 (primary)");
    assert(p90Buy.clip === 50, "P90.3", "P90 initial clip is 50 rounds");
    assert(p90Buy.reserve === 150, "P90.4", "P90 initial reserve is 150 rounds");
    assert(p90Buy.weaponName.includes('P90'), "P90.5", `HUD displays P90: ${p90Buy.weaponName}`);

    // Fire 15 rounds
    const p90PreReload = await page.evaluate(() => {
        ammoState.primary.clip -= 15;
        updateHUD();
        const magMesh = playerState.viewModel ? playerState.viewModel.getObjectByName('magazine') : null;
        return {
            clip: ammoState.primary.clip,
            hasMag: Boolean(magMesh),
            magVisibleBefore: magMesh ? magMesh.visible : false
        };
    });

    assert(p90PreReload.clip === 35, "P90.6", "Clip reduced to 35 before reload");
    assert(p90PreReload.hasMag, "P90.7", "P90 viewmodel contains child named 'magazine'");
    assert(p90PreReload.magVisibleBefore === true, "P90.8", "Magazine is visible before reload");

    // Initiate reload
    const p90ReloadStart = await page.evaluate(() => {
        handleReload();
        const magMesh = playerState.viewModel ? playerState.viewModel.getObjectByName('magazine') : null;
        return {
            isReloading,
            magVisibleDuring: magMesh ? magMesh.visible : true,
            droppedCount: droppedMagazines.length
        };
    });

    assert(p90ReloadStart.isReloading === true, "P90.9", "P90 handleReload() successfully initiates reload without crashing");
    assert(p90ReloadStart.magVisibleDuring === false, "P90.10", "Magazine is hidden during reload");
    assert(p90ReloadStart.droppedCount > 0, "P90.11", "Dropped magazine successfully spawned into droppedMagazines array");

    // Wait for reload duration (P90 reloadTime is 2.8s)
    await new Promise(r => setTimeout(r, 3100));

    const p90ReloadEnd = await page.evaluate(() => {
        const magMesh = playerState.viewModel ? playerState.viewModel.getObjectByName('magazine') : null;
        return {
            isReloading,
            clip: ammoState.primary.clip,
            reserve: ammoState.primary.reserve,
            magVisibleAfter: magMesh ? magMesh.visible : false
        };
    });

    assert(p90ReloadEnd.isReloading === false, "P90.12", "P90 reload timer completed, isReloading is false");
    assert(p90ReloadEnd.clip === 50, "P90.13", `P90 clip replenished to 50 (got: ${p90ReloadEnd.clip})`);
    assert(p90ReloadEnd.reserve === 135, "P90.14", `P90 reserve deducted by 15 (got: ${p90ReloadEnd.reserve})`);
    assert(p90ReloadEnd.magVisibleAfter === true, "P90.15", "Magazine is restored to visible after reload completion");

    console.log("\n--- DOMAIN 2: AN-94 Weapon Configuration & Model ---");

    const an94Def = await page.evaluate(() => {
        const w = WEAPONS.an94;
        return {
            exists: Boolean(w),
            id: w ? w.id : null,
            name: w ? w.name : null,
            damage: w ? w.damage : null,
            fireRate: w ? w.fireRate : null,
            burstFireRate: w ? w.burstFireRate : null,
            mag: w ? w.mag : null,
            reserve: w ? w.reserve : null,
            auto: w ? w.auto : null
        };
    });

    assert(an94Def.exists, "AN94.1", "WEAPONS.an94 is defined in config");
    assert(an94Def.id === 'an94', "AN94.2", "Weapon ID is 'an94'");
    assert(an94Def.name.includes('AN-94'), "AN94.3", `Weapon name is valid (${an94Def.name})`);
    assert(an94Def.damage === 34, "AN94.4", `Damage is 34 (${an94Def.damage})`);
    assert(Math.abs(an94Def.fireRate - 6.43) < 0.05, "AN94.5", `Sustained fireRate is ~6.43 (~560 RPM)`);
    assert(an94Def.burstFireRate === 2.0, "AN94.6", `Burst fireRate is 2.0 (1800 RPM)`);
    assert(an94Def.mag === 30, "AN94.7", "Magazine capacity is 30 rounds");
    assert(an94Def.reserve === 90, "AN94.8", "Reserve capacity is 90 rounds");
    assert(an94Def.auto === true, "AN94.9", "AN-94 is full-auto capable");

    // Buy AN-94
    const an94Buy = await page.evaluate(() => {
        buyWeapon('an94', 3100);
        const vm = playerState.viewModel;
        const mag = vm ? vm.getObjectByName('magazine') : null;
        return {
            primary: inventory.primary,
            slot: inventory.currentSlot,
            clip: ammoState.primary.clip,
            reserve: ammoState.primary.reserve,
            hudName: document.getElementById('weapon-name').innerText,
            hasVM: Boolean(vm),
            vmName: vm ? vm.name : null,
            hasMag: Boolean(mag),
            magCanted: mag ? (mag.rotation.z < -0.1) : false
        };
    });

    assert(an94Buy.primary === 'an94', "AN94.10", "buyWeapon('an94', 3100) sets inventory.primary = 'an94'");
    assert(an94Buy.slot === 1, "AN94.11", "Active slot switched to 1");
    assert(an94Buy.clip === 30, "AN94.12", "Clip initialized to 30");
    assert(an94Buy.reserve === 90, "AN94.13", "Reserve initialized to 90");
    assert(an94Buy.hudName.includes('AN-94'), "AN94.14", `HUD displays AN-94: ${an94Buy.hudName}`);
    assert(an94Buy.hasVM, "AN94.15", "AN-94 viewmodel successfully constructed");
    assert(an94Buy.vmName === 'an94', "AN94.16", "Viewmodel group name is 'an94'");
    assert(an94Buy.hasMag, "AN94.17", "AN-94 viewmodel contains child named 'magazine'");
    assert(an94Buy.magCanted === true, "AN94.18", "AN-94 magazine features iconic starboard-canted tilt (rotation.z < -0.1)");

    console.log("\n--- DOMAIN 3: AN-94 Fire Rate Dynamics (1800 RPM -> 560 RPM) ---");

    const fireRateProfile = await page.evaluate(() => {
        const weapon = getCurrentWeapon();
        const results = [];
        playerState.lastShot = -999;
        playerState.an94BurstCount = 0;
        frameCount = 100;

        // Shot 1 (Initial click, frame 100)
        isShooting = true;
        handleShooting(true, false);
        const shot1Fired = (playerState.lastShot === 100);
        const countAfterShot1 = playerState.an94BurstCount;
        results.push({ shot: 1, fired: shot1Fired, frame: 100, burstCount: countAfterShot1 });

        // Frame 101 (1 frame later): should NOT fire because 1800 RPM cooldown = 2.0 frames
        frameCount = 101;
        handleShooting(false, false);
        const shotAt101 = (playerState.lastShot === 101);
        results.push({ shot: 1.5, fired: shotAt101, frame: 101 });

        // Frame 102 (2 frames after Shot 1): Shot 2 SHOULD fire (1800 RPM = 2 frames delay)
        frameCount = 102;
        handleShooting(false, false);
        const shot2Fired = (playerState.lastShot === 102);
        const countAfterShot2 = playerState.an94BurstCount;
        results.push({ shot: 2, fired: shot2Fired, frame: 102, burstCount: countAfterShot2 });

        // Frame 103 (1 frame after Shot 2): should NOT fire
        frameCount = 103;
        handleShooting(false, false);
        const shotAt103 = (playerState.lastShot === 103);
        results.push({ shot: 2.5, fired: shotAt103, frame: 103 });

        // Frame 104 (2 frames after Shot 2): Shot 3 SHOULD fire (1800 RPM = 2 frames delay)
        frameCount = 104;
        handleShooting(false, false);
        const shot3Fired = (playerState.lastShot === 104);
        const countAfterShot3 = playerState.an94BurstCount;
        results.push({ shot: 3, fired: shot3Fired, frame: 104, burstCount: countAfterShot3 });

        // Frame 105 (1 frame after Shot 3): should NOT fire
        // Frame 106 (2 frames after Shot 3): Now burstCount >= 3, cooldown is 3600/560 = 6.43 frames!
        // So at frame 106, it MUST NOT fire!
        frameCount = 106;
        handleShooting(false, false);
        const shotAt106 = (playerState.lastShot === 106);
        results.push({ shot: 3.5, fired: shotAt106, frame: 106 });

        // Frames 107, 108, 109: should NOT fire
        frameCount = 109;
        handleShooting(false, false);
        const shotAt109 = (playerState.lastShot === 109);
        results.push({ shot: 3.8, fired: shotAt109, frame: 109 });

        // Frame 111 (7 frames after Shot 3, 104 + 7 = 111 >= 104 + 6.43): Shot 4 SHOULD fire!
        frameCount = 111;
        handleShooting(false, false);
        const shot4Fired = (playerState.lastShot === 111);
        const countAfterShot4 = playerState.an94BurstCount;
        results.push({ shot: 4, fired: shot4Fired, frame: 111, burstCount: countAfterShot4 });

        // Release trigger and wait 20 frames
        isShooting = false;
        handleShooting(false, false); // triggers reset
        frameCount = 140;

        // Pull trigger again for fresh burst
        isShooting = true;
        handleShooting(true, false);
        const shot5Fired = (playerState.lastShot === 140);
        const countAfterShot5 = playerState.an94BurstCount;

        // Frame 142 (2 frames later): should fire Shot 2 of new burst at 1800 RPM
        frameCount = 142;
        handleShooting(false, false);
        const shot6Fired = (playerState.lastShot === 142);
        const countAfterShot6 = playerState.an94BurstCount;

        // Clean up shooting state
        isShooting = false;
        handleShooting(false, false);

        return {
            results,
            shot1Fired,
            shotAt101,
            shot2Fired,
            shotAt103,
            shot3Fired,
            shotAt106,
            shotAt109,
            shot4Fired,
            shot5Fired,
            countAfterShot5,
            shot6Fired,
            countAfterShot6,
            remainingClip: ammoState.primary.clip
        };
    });

    assert(fireRateProfile.shot1Fired === true, "AN94.19", "Shot 1 fires immediately at frame 100");
    assert(fireRateProfile.shotAt101 === false, "AN94.20", "Shot fails at frame 101 (1800 RPM requires 2 frames delay)");
    assert(fireRateProfile.shot2Fired === true, "AN94.21", "Shot 2 fires at frame 102 (interval = 2 frames -> 1800 RPM)");
    assert(fireRateProfile.shotAt103 === false, "AN94.22", "Shot fails at frame 103");
    assert(fireRateProfile.shot3Fired === true, "AN94.23", "Shot 3 fires at frame 104 (interval = 2 frames -> 1800 RPM)");
    assert(fireRateProfile.shotAt106 === false, "AN94.24", "Shot fails at frame 106 (cooldown has switched to 560 RPM / 6.43 frames)");
    assert(fireRateProfile.shotAt109 === false, "AN94.25", "Shot fails at frame 109 (cooldown not yet met)");
    assert(fireRateProfile.shot4Fired === true, "AN94.26", "Shot 4 fires at frame 111 (interval = 7 frames -> 560 RPM sustained rate)");
    assert(fireRateProfile.shot5Fired === true, "AN94.27", "Trigger release & re-press resets burst: Shot 5 fires at frame 140");
    assert(fireRateProfile.countAfterShot5 === 1, "AN94.28", "Burst count reset to 1 on fresh trigger pull");
    assert(fireRateProfile.shot6Fired === true, "AN94.29", "Shot 6 fires 2 frames later (1800 RPM burst speed active again)");
    assert(fireRateProfile.countAfterShot6 === 2, "AN94.30", "Burst count increments to 2 for new burst");

    console.log("\n--- DOMAIN 4: AN-94 Reload Verification ---");

    const an94Reload = await page.evaluate(() => {
        isShooting = false;
        handleReload();
        return {
            isReloading,
            clipBefore: ammoState.primary.clip,
            reserveBefore: ammoState.primary.reserve
        };
    });

    assert(an94Reload.isReloading === true, "AN94.31", "AN-94 reload initiated without errors");

    await new Promise(r => setTimeout(r, 2800));

    const an94ReloadDone = await page.evaluate(() => {
        return {
            isReloading,
            clip: ammoState.primary.clip,
            reserve: ammoState.primary.reserve
        };
    });

    assert(an94ReloadDone.isReloading === false, "AN94.32", "AN-94 reload completed");
    assert(an94ReloadDone.clip === 30, "AN94.33", `AN-94 clip replenished to 30 (got: ${an94ReloadDone.clip})`);

    console.log("\n--- DOMAIN 5: Error Diagnostics ---");
    assert(pageErrors.length === 0, "DIAG.1", `Zero uncaught page errors (found: ${pageErrors.length})`);
    assert(consoleErrors.length === 0, "DIAG.2", `Zero console error messages (found: ${consoleErrors.length})`);

    console.log("\n================================================================================");
    console.log(`TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
    console.log("================================================================================");

    await browser.close();
    process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
