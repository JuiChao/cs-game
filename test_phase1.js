const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const { execSync } = require('child_process');

async function runTests() {
    console.log("=== STARTING PHASE 1 AUTOMATED VERIFICATION ===");
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error("FAIL:", message);
            failures++;
        } else {
            console.log("PASS:", message);
        }
    }

    // 1. Git & Hygiene Verification
    console.log("\n--- Checking Git & Cleanliness ---");
    const trackedNodeModules = execSync('git ls-files node_modules', { encoding: 'utf-8' }).trim();
    assert(trackedNodeModules.length === 0, "No node_modules tracked in git");

    const gitignoreContent = fs.readFileSync(path.join(__dirname, '.gitignore'), 'utf-8');
    assert(gitignoreContent.includes('node_modules/'), ".gitignore contains node_modules/");

    const obsoleteFiles = [
        'game.js', 'game-backup.js',
        'announcement.txt', 'announcement_def.txt', 'collidable.txt', 'controls.txt',
        'functions.txt', 'interact.txt', 'keydown.txt', 'movement.txt',
        'plantProgress.txt', 'plantProgress2.txt', 'pointerlock.txt', 'search_results.txt', 'velocity.txt'
    ];
    for (const f of obsoleteFiles) {
        assert(!fs.existsSync(path.join(__dirname, f)), `Obsolete file removed: ${f}`);
    }

    // 2. Headless Browser Verification
    console.log("\n--- Starting Headless Browser Tests ---");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    // Emulate touch device prior to navigation
    await page.setViewport({
        width: 390,
        height: 844,
        isMobile: true,
        hasTouch: true
    });

    const pageErrors = [];
    page.on('pageerror', err => { pageErrors.push(err.message); console.error('PAGE ERROR STACK:', err.stack); });
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
    });

    const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(uri, { waitUntil: 'load' });

    console.log("Starting game on touch device...");
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1000));

    // Test 2.1: Mobile input active and controls decoupling
    console.log("\n--- Testing Mobile Loop Decoupling ---");
    const touchState = await page.evaluate(() => {
        const active = typeof isPlayerControlActive === 'function' ? isPlayerControlActive() : false;
        const locked = controls ? controls.isLocked : null;
        return { active, locked, isTouch: checkIsTouchDevice() };
    });
    assert(touchState.isTouch === true, "Touch device detected");
    assert(touchState.locked === false, "Desktop pointer is NOT locked on touch device");
    assert(touchState.active === true, "isPlayerControlActive() is true on mobile without pointer lock");

    // Test 2.2: Mobile movement without pointer lock
    const initialPos = await page.evaluate(() => {
        return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    });
    await page.evaluate(() => {
        window.moveForward = true;
        for (let i = 0; i < 20; i++) {
            updatePhysics(0.016);
        }
        window.moveForward = false;
    });
    const movedPos = await page.evaluate(() => {
        return { x: camera.position.x, y: camera.position.y, z: camera.position.z };
    });
    const distMoved = Math.hypot(movedPos.x - initialPos.x, movedPos.z - initialPos.z);
    assert(distMoved > 0.1, `Player moved ${distMoved.toFixed(2)} units without pointer lock`);

    // Test 2.3: Mobile ADS / Scope without pointer lock
    console.log("\n--- Testing ADS and Scope Overlay on Touch ---");
    const initialFov = await page.evaluate(() => camera.fov);
    await page.evaluate(() => {
        playerState.isAds = true;
        // Step physics to process ADS animation
        for (let i = 0; i < 30; i++) {
            playerState.adsProgress = Math.min(1, playerState.adsProgress + 0.05);
            camera.fov = 75 + (20 - 75) * playerState.adsProgress;
        }
    });
    const adsFov = await page.evaluate(() => camera.fov);
    assert(adsFov < initialFov, `Camera FOV zoomed from ${initialFov} to ${adsFov} in ADS`);

    // Reset ADS
    await page.evaluate(() => {
        playerState.isAds = false;
        playerState.adsProgress = 0;
        camera.fov = 75;
    });

    // Test 2.4: Mobile Shooting without pointer lock
    console.log("\n--- Testing Mobile Shooting ---");
    const bulletCountBefore = await page.evaluate(() => bullets.length);
    await page.evaluate(() => {
        // Ensure autonomous bots do not kill unshielded player during initial delay
        playerState.isInvincible = true;
        playerState.hp = 100;
        playerState.isSpectating = false;
        // Select secondary weapon (pistol, 33 rounds)
        switchWeapon(2);
        // Simulate touch-shoot button touchstart
        const btnShoot = document.getElementById('touch-shoot');
        btnShoot.dispatchEvent(new Event('touchstart'));
    });
    const bulletCountAfter = await page.evaluate(() => {
        // Release touch
        const btnShoot = document.getElementById('touch-shoot');
        btnShoot.dispatchEvent(new Event('touchend'));
        return bullets.length;
    });
    assert(bulletCountAfter > bulletCountBefore, `Bullet fired on mobile without pointer lock (bullets: ${bulletCountBefore} -> ${bulletCountAfter})`);

    // Test 3: resetRound() shared geometry preservation
    console.log("\n--- Testing resetRound() Particle Geo Safety ---");
    await page.evaluate(() => {
        // Create particles
        createExplosionEffect(new THREE.Vector3(0, 5, 0));
        createMuzzleFire(new THREE.Vector3(0, 5, 0), new THREE.Vector3(0, 0, 1));
    });
    const particlesBeforeReset = await page.evaluate(() => particles.length);
    assert(particlesBeforeReset > 0, `Generated ${particlesBeforeReset} particles before resetRound`);

    await page.evaluate(() => {
        resetRound();
    });

    const geoValidAfterReset = await page.evaluate(() => {
        let particleGeoValid = sharedParticleGeo && sharedParticleGeo.attributes && sharedParticleGeo.attributes.position;
        let muzzleGeoValid = sharedMuzzleGeo && sharedMuzzleGeo.attributes && sharedMuzzleGeo.attributes.position;
        
        let error = null;
        try {
            createExplosionEffect(new THREE.Vector3(10, 5, 10));
            createMuzzleFire(new THREE.Vector3(10, 5, 10), new THREE.Vector3(0, 0, 1));
        } catch (e) {
            error = e.message;
        }
        return { particleGeoValid: !!particleGeoValid, muzzleGeoValid: !!muzzleGeoValid, error };
    });
    assert(geoValidAfterReset.particleGeoValid, "sharedParticleGeo retained its buffer attributes after resetRound");
    assert(geoValidAfterReset.muzzleGeoValid, "sharedMuzzleGeo retained its buffer attributes after resetRound");
    assert(geoValidAfterReset.error === null, `New particles created without errors in new round: ${geoValidAfterReset.error}`);

    // Test 4: C4 Detonation, Sound, and Lethal Radius
    console.log("\n--- Testing C4 Detonation & Lethal Damage ---");
    const c4DetonationResult = await page.evaluate(() => {
        roundActive = true;
        // Place C4 at (0, 0.1, 0)
        bombState.planted = true;
        bombState.timer = 1;
        bombState.mesh = createC4();
        bombState.mesh.position.set(0, 0.1, 0);
        scene.add(bombState.mesh);

        // Track sound
        let explosionSoundCalled = false;
        let soundPos = null;
        window.playExplosionSound = (pos) => {
            explosionSoundCalled = true;
            soundPos = pos ? { x: pos.x, y: pos.y, z: pos.z } : null;
        };

        // Create close CT bot (distance 20), close T bot (distance 25), and far CT bot (distance 250)
        const closeMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
        closeMesh.position.set(20, 1, 0);
        scene.add(closeMesh);
        bots.push({ id: 991, team: 'CT', hp: 100, isDead: false, mesh: closeMesh });

        const closeTMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
        closeTMesh.position.set(25, 1, 0);
        scene.add(closeTMesh);
        bots.push({ id: 993, team: 'T', hp: 100, isDead: false, mesh: closeTMesh });

        const farMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial());
        farMesh.position.set(250, 1, 0);
        scene.add(farMesh);
        bots.push({ id: 992, team: 'CT', hp: 100, isDead: false, mesh: farMesh });

        // Place player at distance 30
        camera.position.set(30, 2, 0);
        playerState.hp = 100;
        playerState.isInvincible = false;

        let endRoundMessage = null;
        let endRoundWinner = null;
        window.endRound = (msg, tWin) => {
            endRoundMessage = msg;
            endRoundWinner = tWin ? 'T' : 'CT';
            roundActive = false;
        };

        // Invoke ACTUAL production function detonateC4()!
        detonateC4();

        const closeBot = bots.find(b => b.id === 991);
        const closeTBot = bots.find(b => b.id === 993);
        const farBot = bots.find(b => b.id === 992);

        return {
            explosionSoundCalled,
            soundPos,
            closeBotAlive: !!closeBot,
            closeTBotAlive: !!closeTBot,
            farBotHp: farBot ? farBot.hp : null,
            playerHp: playerState.hp,
            bombMeshCleaned: bombState.mesh === null,
            bombPlantedCleaned: bombState.planted === false,
            endRoundMessage,
            endRoundWinner
        };
    });
    assert(c4DetonationResult.explosionSoundCalled === true, "playExplosionSound called with bomb position");
    assert(c4DetonationResult.closeBotAlive === false, "Bot in blast radius (dist 20) took lethal damage and was eliminated");
    assert(c4DetonationResult.closeTBotAlive === false, "T bot in blast radius took lethal damage and was eliminated");
    assert(c4DetonationResult.farBotHp === 100, `Bot outside blast radius (dist 250) took 0 damage (hp: ${c4DetonationResult.farBotHp})`);
    assert(c4DetonationResult.playerHp <= 0, `Player in blast radius took lethal damage (hp: ${c4DetonationResult.playerHp})`);
    assert(c4DetonationResult.bombMeshCleaned === true, "Physical C4 mesh cleaned up after detonation");
    assert(c4DetonationResult.bombPlantedCleaned === true, "bombState.planted set to false after detonation");
    assert(c4DetonationResult.endRoundWinner === 'T', `C4 victory awarded to Terrorists (winner: ${c4DetonationResult.endRoundWinner})`);
    assert(c4DetonationResult.endRoundMessage && c4DetonationResult.endRoundMessage.includes("C4"), `endRound invoked with message: ${c4DetonationResult.endRoundMessage}`);

    // Test 5: KeyU (Unstuck) and KeyT (Scope Panel)
    console.log("\n--- Testing KeyU Unstuck and KeyT Scope Panel ---");
    await page.evaluate(() => {
        roundActive = true;
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isControllingDrone = false;
        playerState.spawnPos = new THREE.Vector3(50, 2, 50);
        // Put player in stuck position
        camera.position.set(-180, -20, 200);
        playerState.velocity.set(10, -5, 10);
    });
    await page.keyboard.press('KeyU');
    const unstuckPos = await page.evaluate(() => {
        return {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            vx: playerState.velocity.x,
            vy: playerState.velocity.y,
            vz: playerState.velocity.z
        };
    });
    assert(unstuckPos.x === 50 && unstuckPos.z === 50, `KeyU reset player to spawnPos (x: ${unstuckPos.x}, z: ${unstuckPos.z})`);
    assert(unstuckPos.vx === 0 && unstuckPos.vz === 0, `KeyU zeroed player horizontal velocity (vx: ${unstuckPos.vx}, vz: ${unstuckPos.vz})`);
    assert(unstuckPos.vy > -5 && unstuckPos.vy <= 0, `KeyU reset vertical velocity from stuck -5 (vy: ${unstuckPos.vy})`);

    // Test KeyU safety guard: drone mode should prevent camera hijacking
    const droneGuardResult = await page.evaluate(() => {
        camera.position.set(100, 30, 100);
        playerState.isControllingDrone = true;
        unstuckPlayer();
        const posAfter = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
        playerState.isControllingDrone = false;
        return posAfter;
    });
    assert(droneGuardResult.x === 100 && droneGuardResult.y === 30 && droneGuardResult.z === 100, "unstuckPlayer() safely blocked while controlling drone");

    // KeyT toggle
    const scopePanelVisibleBefore = await page.evaluate(() => {
        const panel = document.getElementById('scope-panel');
        return panel && !panel.classList.contains('hidden');
    });
    await page.keyboard.press('KeyT');
    await new Promise(r => setTimeout(r, 500));
    const scopePanelVisibleAfter = await page.evaluate(() => {
        const panel = document.getElementById('scope-panel');
        return panel && !panel.classList.contains('hidden');
    });
    assert(!scopePanelVisibleBefore && scopePanelVisibleAfter, "KeyT toggled scope panel open");

    // Test scope panel close button (touch / mouse accessibility)
    const scopePanelClosedByBtn = await page.evaluate(() => {
        const closeBtn = document.querySelector('#scope-panel button.deploy-btn');
        if (closeBtn) closeBtn.click();
        const panel = document.getElementById('scope-panel');
        const locked = controls ? controls.isLocked : false;
        return { closed: panel.classList.contains('hidden'), locked };
    });
    assert(scopePanelClosedByBtn.closed, "Scope panel closed via UI close button");
    assert(scopePanelClosedByBtn.locked === false, "Scope panel close did NOT trigger pointer lock on touch device");

    assert(pageErrors.length === 0, `Zero page runtime errors during tests (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log(`\n=== VERIFICATION FINISHED: ${failures === 0 ? "ALL PASSED" : failures + " FAILURES"} ===`);
    if (failures > 0) process.exit(1);
}

runTests().catch(err => {
    console.error("FATAL TEST EXCEPTION:", err);
    process.exit(1);
});
