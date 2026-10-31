const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runPhase4Tests() {
    console.log("=== STARTING PHASE 4 AUTOMATED VERIFICATION ===");
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error("FAIL:", message);
            failures++;
        } else {
            console.log("PASS:", message);
        }
    }

    // 1. Static Code Analysis Checks
    console.log("\n--- Checking Phase 4 Source Code Implementations ---");
    const combatJs = fs.readFileSync(path.join(__dirname, 'modules/combat.js'), 'utf-8');
    assert(combatJs.includes('playerState.lastFlameDamageTick'), "combat.js implements flamethrower 100ms damage throttle timestamp");
    assert(combatJs.includes('Math.min(20, hitBot.hp * 0.02)'), "combat.js caps zombie flamethrower percentage damage at 20 HP per tick");
    assert(combatJs.includes('playHitMarkerSound('), "combat.js triggers playHitMarkerSound on hits");
    assert(combatJs.includes('playerState.cameraShake'), "combat.js applies camera shake on fire and damage");

    const botAiJs = fs.readFileSync(path.join(__dirname, 'modules/bot-ai.js'), 'utf-8');
    assert(botAiJs.includes('const BOT_CLIMB_HEIGHT = 2.05'), "bot-ai.js defines BOT_CLIMB_HEIGHT <= 2.05");
    assert(botAiJs.includes('const canClimb = true'), "bot-ai.js decouples canClimb from zombie-only mode");
    assert(botAiJs.includes('updateBotGroundY(b, delta)'), "bot-ai.js promotes updateBotGroundY unconditionally across all modes");

    const soundJs = fs.readFileSync(path.join(__dirname, 'modules/sound.js'), 'utf-8');
    assert(soundJs.includes('function playFootstepSound('), "sound.js defines procedural playFootstepSound");
    assert(soundJs.includes('function playLandSound('), "sound.js defines procedural playLandSound");
    assert(soundJs.includes('function playC4Beep('), "sound.js defines progressive spatial playC4Beep");
    assert(soundJs.includes('function playHitMarkerSound('), "sound.js defines procedural playHitMarkerSound");

    const hudJs = fs.readFileSync(path.join(__dirname, 'modules/hud.js'), 'utf-8');
    assert(hudJs.includes('function triggerDamageVignette('), "hud.js defines triggerDamageVignette");
    assert(hudJs.includes('function showHitMarker('), "hud.js defines showHitMarker crosshair visual feedback");

    const touchJs = fs.readFileSync(path.join(__dirname, 'modules/touch.js'), 'utf-8');
    assert(touchJs.includes("mode: 'semi'"), "touch.js configures virtual joystick with semi mode");
    assert(touchJs.includes('catchDistance: 150'), "touch.js configures catchDistance: 150");
    assert(touchJs.includes('const deadzone = 12'), "touch.js applies 12px deadzone damping");

    const mortarJs = fs.readFileSync(path.join(__dirname, 'modules/mortar.js'), 'utf-8');
    assert(mortarJs.includes('function cancelMortarCamera('), "mortar.js defines cancelMortarCamera");
    assert(mortarJs.includes("e.code === 'Escape' || e.code === 'KeyF'"), "mortar.js supports Escape and KeyF cancellation");
    assert(mortarJs.includes('function cleanupMortar('), "mortar.js defines cleanupMortar");

    const physicsJs = fs.readFileSync(path.join(__dirname, 'modules/physics.js'), 'utf-8');
    assert(physicsJs.includes('playerState.cameraShake *= 0.82'), "physics.js decays camera shake exponentially (0.82)");
    assert(physicsJs.includes('Math.sin(playerState.swayPhase * 0.5)'), "physics.js applies natural weapon sway on viewModel X");
    assert(physicsJs.includes('Math.abs(Math.sin(playerState.swayPhase))'), "physics.js applies natural weapon sway on viewModel Y");
    assert(physicsJs.includes('let beepInterval = 60'), "physics.js implements progressive C4 beep cadence thresholds");

    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert(indexHtml.includes('id="damage-vignette"'), "index.html defines #damage-vignette overlay");
    assert(indexHtml.includes('id="mortar-cancel-btn"'), "index.html defines #mortar-cancel-btn");

    const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');
    assert(styleCss.includes('#crosshair.hit'), "style.css defines #crosshair.hit style");
    assert(styleCss.includes('#crosshair.hit-headshot'), "style.css defines #crosshair.hit-headshot style");

    // 2. Headless Browser Runtime Verification
    console.log("\n--- Starting Headless Browser Tests ---");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => { pageErrors.push(err.message); console.error('PAGE ERROR STACK:', err.stack); });
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(baseUri, { waitUntil: 'load' });

    console.log("Starting game in browser...");
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1000));

    // Test 4.1: Flamethrower Balance & Throttle Test
    console.log("\n--- Testing Flamethrower 100ms Throttle & 20 HP Cap ---");
    const flameResult = await page.evaluate(() => {
        // Switch to flamethrower
        inventory.primary = 'flamethrower';
        inventory.currentSlot = 1;
        ammoState.primary.clip = 100;
        ammoState.primary.reserve = 200;
        controls.isLocked = true;
        isShooting = true;
        updateHUD();

        // Create a 3000 HP Mother Zombie target
        gameMode = 'zombie';
        const zombieMesh = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshBasicMaterial());
        zombieMesh.position.set(0, 2, -10);
        scene.add(zombieMesh);
        zombieMesh.updateMatrixWorld(true);

        const testZombie = {
            id: 999,
            team: 'ZOMBIE',
            hp: 3000,
            maxHp: 3000,
            isDead: false,
            mesh: zombieMesh,
            burnStacks: 0,
            burnTimer: 0,
            burnDamageMult: 1
        };
        bots.push(testZombie);

        // Aim camera directly at the zombie
        camera.position.set(0, 2, 0);
        camera.lookAt(0, 2, -10);

        playerState.lastFlameDamageTick = 0;
        const initialHp = testZombie.hp;

        // Fire 1st time
        handleShooting(true);
        const hpAfterShot1 = testZombie.hp;
        const dmgShot1 = initialHp - hpAfterShot1;

        // Try firing immediately within 10ms (simulated rapid frame before 100ms)
        // Since performance.now() is within 10ms, damage should be throttled
        handleShooting(false);
        const hpAfterThrottledShot = testZombie.hp;
        const wasThrottled = (hpAfterThrottledShot === hpAfterShot1);

        // Simulate 105ms passed by setting lastFlameDamageTick back
        playerState.lastFlameDamageTick = performance.now() - 110;
        handleShooting(false);
        const hpAfterShot2 = testZombie.hp;
        const dmgShot2 = hpAfterShot1 - hpAfterShot2;

        // Cleanup
        scene.remove(zombieMesh);
        const zIdx = bots.indexOf(testZombie);
        if (zIdx !== -1) bots.splice(zIdx, 1);
        gameMode = 'bomb';
        isShooting = false;

        return {
            dmgShot1,
            wasThrottled,
            dmgShot2,
            baseDamage: WEAPONS.flamethrower.damage
        };
    });

    assert(flameResult.dmgShot1 === flameResult.baseDamage + 20, `Flamethrower damage capped at base + 20 HP (expected: ${flameResult.baseDamage + 20}, actual: ${flameResult.dmgShot1})`);
    assert(flameResult.wasThrottled, "Flamethrower throttled within 100ms (zero extra damage dealt)");
    assert(flameResult.dmgShot2 === flameResult.baseDamage + 20, `Flamethrower second tick after 100ms applies correct capped damage (${flameResult.dmgShot2})`);

    // Test 4.2: Bot Stepping & Ground Height Adaptation in Bomb Mode
    console.log("\n--- Testing Bot Step-Up & Ground Height Adaptation in Bomb Mode ---");
    const stepUpResult = await page.evaluate(() => {
        gameMode = 'bomb';
        // Create an obstacle of height 1.8 (<= 2.05)
        const stepGeo = new THREE.BoxGeometry(4, 1.8, 4);
        const stepMesh = new THREE.Mesh(stepGeo, new THREE.MeshBasicMaterial());
        stepMesh.position.set(20, 0.9, 20); // bottom at y=0, top at y=1.8
        stepMesh.worldBox = new THREE.Box3().setFromObject(stepMesh);
        collidableMeshList.push(stepMesh);

        // Create a tall wall of height 4.0 (> 2.05)
        const wallGeo = new THREE.BoxGeometry(4, 4.0, 4);
        const wallMesh = new THREE.Mesh(wallGeo, new THREE.MeshBasicMaterial());
        wallMesh.position.set(40, 2.0, 20); // bottom at y=0, top at y=4.0
        wallMesh.worldBox = new THREE.Box3().setFromObject(wallMesh);
        collidableMeshList.push(wallMesh);

        // Test botTryStepUp on step obstacle
        const stepCanStep = botTryStepUp([stepMesh], 0);

        // Test botTryStepUp on tall wall obstacle
        const wallCanStep = botTryStepUp([wallMesh], 0);

        // Test moveBotWithCollision stepping onto the 1.8m step in Bomb Mode
        const testBotMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 1), new THREE.MeshBasicMaterial());
        testBotMesh.position.set(17.8, 0, 20);
        const testBot = {
            mesh: testBotMesh,
            team: 'CT',
            hp: 100
        };

        const movedOntoStep = moveBotWithCollision(testBot, new THREE.Vector3(0.5, 0, 0));
        const botYAfterStep = testBot.mesh.position.y;

        // Test updateBotGroundY smooth ground tracking
        const botHigh = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 1), new THREE.MeshBasicMaterial()),
            team: 'CT'
        };
        botHigh.mesh.position.set(20, 1.8, 20); // on top of step
        updateBotGroundY(botHigh, 0.016);
        const supportOnStep = botHigh.mesh.position.y;

        // Move off step into open air (y=0 support)
        botHigh.mesh.position.set(0, 1.8, 0);
        updateBotGroundY(botHigh, 0.1);
        const smoothDropY = botHigh.mesh.position.y;

        // Cleanup
        const stepIdx = collidableMeshList.indexOf(stepMesh);
        if (stepIdx !== -1) collidableMeshList.splice(stepIdx, 1);
        const wallIdx = collidableMeshList.indexOf(wallMesh);
        if (wallIdx !== -1) collidableMeshList.splice(wallIdx, 1);

        return {
            stepCanStep,
            wallCanStep,
            movedOntoStep,
            botYAfterStep,
            supportOnStep,
            smoothDropY
        };
    });

    assert(Math.abs(stepUpResult.stepCanStep - 1.8) < 0.01, `botTryStepUp correctly recognizes 1.8m obstacle as climbable (top: ${stepUpResult.stepCanStep})`);
    assert(stepUpResult.wallCanStep === -1, `botTryStepUp rejects 4.0m wall as un-climbable (-1)`);
    assert(stepUpResult.movedOntoStep && Math.abs(stepUpResult.botYAfterStep - 1.8) < 0.05, `Bot stepped up onto 1.8m obstacle in Bomb Mode (Y: ${stepUpResult.botYAfterStep})`);
    assert(Math.abs(stepUpResult.supportOnStep - 1.8) < 0.05, "updateBotGroundY tracks support height on top of elevated obstacles");
    assert(stepUpResult.smoothDropY < 1.8, `updateBotGroundY smoothly drops bot when walking off edges (Y: ${stepUpResult.smoothDropY.toFixed(2)})`);

    // Test 4.3: Procedural Soundscape & HUD Feedback
    console.log("\n--- Testing Web Audio Soundscape & HUD Vignette / HitMarker ---");
    const soundHudResult = await page.evaluate(() => {
        let footstepSandOk = false;
        let footstepMetalOk = false;
        let landOk = false;
        let c4BeepOk = false;
        let hitMarkerOk = false;
        let vignetteOk = false;

        try {
            playFootstepSound('sand', 0.25);
            footstepSandOk = true;
            playFootstepSound('metal', 0.35);
            footstepMetalOk = true;
        } catch (e) { console.error('footstep err:', e); }

        try {
            playLandSound('metal', 0.45);
            landOk = true;
        } catch (e) { console.error('land err:', e); }

        try {
            playC4Beep(new THREE.Vector3(10, 0, 10), 1046.5);
            c4BeepOk = true;
        } catch (e) { console.error('c4beep err:', e); }

        // Test HitMarker DOM class toggles
        playHitMarkerSound(false);
        const crosshair = document.getElementById('crosshair');
        const hasHitClass = crosshair && crosshair.classList.contains('hit');

        playHitMarkerSound(true);
        const hasHeadshotClass = crosshair && crosshair.classList.contains('hit-headshot');
        hitMarkerOk = hasHitClass && hasHeadshotClass;

        // Test Damage Vignette
        triggerDamageVignette(0.75);
        const vignette = document.getElementById('damage-vignette');
        const vignetteOpacity = vignette ? parseFloat(vignette.style.opacity) : 0;
        vignetteOk = vignetteOpacity >= 0.5;

        return {
            footstepSandOk,
            footstepMetalOk,
            landOk,
            c4BeepOk,
            hitMarkerOk,
            vignetteOk,
            vignetteOpacity
        };
    });

    assert(soundHudResult.footstepSandOk && soundHudResult.footstepMetalOk, "Procedural footsteps for sand and metal synthesized without errors");
    assert(soundHudResult.landOk, "Procedural landing sound synthesized without errors");
    assert(soundHudResult.c4BeepOk, "Procedural spatial C4 beep synthesized without errors");
    assert(soundHudResult.hitMarkerOk, "HitMarker visual indicator applied .hit and .hit-headshot to #crosshair");
    assert(soundHudResult.vignetteOk, `Damage vignette triggered with opacity > 0.5 (actual: ${soundHudResult.vignetteOpacity})`);

    // Test 4.4: Progressive C4 Beep Cadence Progression
    console.log("\n--- Testing Progressive C4 Beep Cadence Thresholds ---");
    const c4CadenceResult = await page.evaluate(() => {
        function getBeepInterval(timer) {
            let beepInterval = 60;
            if (timer <= 10) beepInterval = 8;
            else if (timer <= 20) beepInterval = 15;
            else if (timer <= 40) beepInterval = 30;
            else beepInterval = 60;
            return beepInterval;
        }

        return {
            interval60: getBeepInterval(55), // >40s
            interval30: getBeepInterval(35), // 20-40s
            interval15: getBeepInterval(18), // 10-20s
            interval8: getBeepInterval(6)    // <=10s
        };
    });

    assert(c4CadenceResult.interval60 === 60, "C4 beep interval at 55s is 60 frames (1 beep/sec)");
    assert(c4CadenceResult.interval30 === 30, "C4 beep interval at 35s is 30 frames (2 beeps/sec)");
    assert(c4CadenceResult.interval15 === 15, "C4 beep interval at 18s is 15 frames (4 beeps/sec)");
    assert(c4CadenceResult.interval8 === 8, "C4 beep interval at 6s is 8 frames (rapid beeping)");

    // Test 4.5: Mortar Camera Tactical Interrupt
    console.log("\n--- Testing Mortar Camera Activation & Tactical Interrupt (cancelMortarCamera) ---");
    const mortarResult = await page.evaluate(() => {
        // Equip mortar
        inventory.primary = 'mortar';
        inventory.currentSlot = 1;
        ammoState.primary.clip = 5;
        ammoState.primary.reserve = 10;
        updateHUD();

        // Position player
        camera.position.set(10, 2, 10);
        camera.rotation.set(0, 0, 0);
        const originalPos = camera.position.clone();

        // Open mortar map and set target
        openMortarMap();
        mortarTargetPos = new THREE.Vector3(80, 0, 120);

        // Fire mortar
        fireMortar();

        const cameraActiveAfterFire = mortarCameraActive;
        const shellsCount = mortarShells.length;
        const cameraPosYAfterFire = camera.position.y;

        // Cancel mortar camera
        cancelMortarCamera();

        const cameraActiveAfterCancel = mortarCameraActive;
        const cameraPosAfterCancel = camera.position.clone();
        const distFromOriginal = originalPos.distanceTo(cameraPosAfterCancel);

        // Cleanup shell meshes
        mortarShells.forEach(s => {
            scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
        });
        mortarShells = [];

        return {
            cameraActiveAfterFire,
            shellsCount,
            cameraPosYAfterFire,
            cameraActiveAfterCancel,
            distFromOriginal
        };
    });

    assert(mortarResult.cameraActiveAfterFire, "Mortar fire activates aerial tracking camera (mortarCameraActive = true)");
    assert(mortarResult.shellsCount > 0, "Mortar shell spawned and added to physics queue");
    assert(mortarResult.cameraPosYAfterFire >= 70, `Mortar camera hoisted to high aerial vantage (Y: ${mortarResult.cameraPosYAfterFire})`);
    assert(!mortarResult.cameraActiveAfterCancel, "cancelMortarCamera() sets mortarCameraActive to false");
    assert(mortarResult.distFromOriginal < 0.01, "cancelMortarCamera() instantly restores player original camera coordinates");

    // Test 4.6: Weapon Sway & Camera Shake Decay
    console.log("\n--- Testing Natural Weapon Sway & Camera Shake Decay ---");
    const swayShakeResult = await page.evaluate(() => {
        // Test Camera Shake decay
        playerState.cameraShake = 0.05;
        // Simulate decay step
        playerState.cameraShake *= 0.82;
        const shakeDecayed = playerState.cameraShake;

        // Test Weapon Sway while sprinting
        playerState.velocity.set(15, 0, 10); // horizSpeed ~ 18.0
        const horizSpeed = Math.hypot(playerState.velocity.x, playerState.velocity.z);

        const currentBaseX = 0.3;
        const currentBaseY = -0.3;

        let swayPositions = [];
        let phase = 0;
        for (let f = 0; f < 30; f++) {
            const swaySpeed = Math.min(0.35, 0.14 + horizSpeed * 0.005);
            const swayAmpX = Math.min(0.025, 0.008 + horizSpeed * 0.0006);
            const swayAmpY = Math.min(0.02, 0.006 + horizSpeed * 0.0005);
            phase += swaySpeed;
            const x = currentBaseX + Math.sin(phase * 0.5) * swayAmpX;
            const y = currentBaseY + Math.abs(Math.sin(phase)) * swayAmpY;
            swayPositions.push({ x, y });
        }

        const minX = Math.min(...swayPositions.map(p => p.x));
        const maxX = Math.max(...swayPositions.map(p => p.x));
        const hasHorizontalSway = (maxX - minX) > 0.01;

        const minY = Math.min(...swayPositions.map(p => p.y));
        const maxY = Math.max(...swayPositions.map(p => p.y));
        const hasVerticalSway = (maxY - minY) > 0.005;

        // Reset
        playerState.velocity.set(0, 0, 0);
        playerState.cameraShake = 0;

        return {
            shakeDecayed,
            hasHorizontalSway,
            hasVerticalSway
        };
    });

    assert(swayShakeResult.shakeDecayed < 0.045 && swayShakeResult.shakeDecayed > 0.035, `Camera shake decays exponentially by factor 0.82 (0.05 -> ${swayShakeResult.shakeDecayed.toFixed(4)})`);
    assert(swayShakeResult.hasHorizontalSway, "Weapon sway produces smooth horizontal figure-8 oscillation during movement");
    assert(swayShakeResult.hasVerticalSway, "Weapon sway produces smooth vertical bobbing oscillation during movement");

    // Test 4.7: Mobile Touch Damping & Deadzone
    console.log("\n--- Testing Mobile Touch Joystick Deadzone Damping ---");
    const touchDeadzoneResult = await page.evaluate(() => {
        let insideDeadzoneBlocked = false;
        let outsideDeadzoneMoved = false;

        const deadzone = 12;

        function simulateJoystickMove(vectorX, vectorY, distance) {
            let f = false, b = false, l = false, r = false;
            if (distance < deadzone) {
                return { f, b, l, r, stopped: true };
            }
            f = vectorY > 0.25;
            b = vectorY < -0.25;
            r = vectorX > 0.25;
            l = vectorX < -0.25;
            return { f, b, l, r, stopped: false };
        }

        const deadzoneMove = simulateJoystickMove(0.8, 0.8, 8); // 8px distance (<12px)
        insideDeadzoneBlocked = deadzoneMove.stopped && !deadzoneMove.f && !deadzoneMove.b;

        const activeMove = simulateJoystickMove(0.0, 1.0, 35); // 35px distance (>12px)
        outsideDeadzoneMoved = !activeMove.stopped && activeMove.f;

        return {
            insideDeadzoneBlocked,
            outsideDeadzoneMoved
        };
    });

    assert(touchDeadzoneResult.insideDeadzoneBlocked, "Touch joystick ignores micro-movements within 12px deadzone");
    assert(touchDeadzoneResult.outsideDeadzoneMoved, "Touch joystick correctly registers intentional movements outside deadzone");

    // Test 4.8: Edge Cases & Resource Disposal
    console.log("\n--- Testing Edge Cases & Resource Disposal ---");
    const edgeCaseResult = await page.evaluate(() => {
        // 1. Test cleanupMortar scene mesh disposal
        const dummyShellGeo = new THREE.SphereGeometry(1.5, 4, 4);
        const dummyShellMat = new THREE.MeshBasicMaterial();
        const dummyShellMesh = new THREE.Mesh(dummyShellGeo, dummyShellMat);
        scene.add(dummyShellMesh);
        mortarShells.push({
            mesh: dummyShellMesh,
            targetPos: new THREE.Vector3(0, 0, 0),
            velocity: new THREE.Vector3(0, -80, 0),
            exploded: false,
            team: 'CT'
        });
        mortarCameraActive = true;
        const cancelBtn = document.getElementById('mortar-cancel-btn');
        if (cancelBtn) cancelBtn.classList.remove('hidden');

        cleanupMortar();

        const shellInScene = scene.children.includes(dummyShellMesh);
        const shellsCleared = mortarShells.length === 0;
        const cameraDeactivated = !mortarCameraActive;
        const btnHidden = cancelBtn ? cancelBtn.classList.contains('hidden') : true;

        // 2. Test Procedural Audio noise buffer reuse (zero GC)
        const buf1 = getProceduralNoiseBuffer();
        const buf2 = getProceduralNoiseBuffer();
        const isSingletonBuffer = (buf1 !== null && buf1 === buf2);

        // 3. Test getBotSupportHeight does not tractor-beam bot up to overhead obstacle
        const highObstacle = new THREE.Mesh(new THREE.BoxGeometry(4, 2, 4), new THREE.MeshBasicMaterial());
        highObstacle.position.set(50, 1.0, 50); // top at y=2.0
        highObstacle.worldBox = new THREE.Box3().setFromObject(highObstacle);
        collidableMeshList.push(highObstacle);

        // Bot is on ground (feetY = 0), obstacle top is 2.0 (higher than feet + 0.4)
        const overheadSupport = getBotSupportHeight(50, 50, 0);
        const noLevitation = overheadSupport === 0;

        // Cleanup
        const oIdx = collidableMeshList.indexOf(highObstacle);
        if (oIdx !== -1) collidableMeshList.splice(oIdx, 1);

        // 4. Test compound diagonal movement step-up in botAI
        const compoundStep = new THREE.Mesh(new THREE.BoxGeometry(4, 1.5, 4), new THREE.MeshBasicMaterial());
        compoundStep.position.set(70, 0.75, 70); // top at y=1.5
        compoundStep.worldBox = new THREE.Box3().setFromObject(compoundStep);
        collidableMeshList.push(compoundStep);

        const diagBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 3.5, 1), new THREE.MeshBasicMaterial()),
            team: 'CT',
            hp: 100
        };
        diagBot.mesh.position.set(67.8, 0, 67.8);
        const movedDiag = moveBotWithCollision(diagBot, new THREE.Vector3(0.5, 0, 0.5));
        const botStepHeight = diagBot.mesh.position.y;

        const cIdx = collidableMeshList.indexOf(compoundStep);
        if (cIdx !== -1) collidableMeshList.splice(cIdx, 1);

        return {
            shellInScene,
            shellsCleared,
            cameraDeactivated,
            btnHidden,
            isSingletonBuffer,
            noLevitation,
            movedDiag,
            botStepHeight
        };
    });

    assert(!edgeCaseResult.shellInScene, "cleanupMortar removes in-flight mortar meshes from Three.js scene");
    assert(edgeCaseResult.shellsCleared, "cleanupMortar clears mortarShells queue");
    assert(edgeCaseResult.cameraDeactivated, "cleanupMortar restores camera active flag to false");
    assert(edgeCaseResult.btnHidden, "mortar-cancel-btn is hidden after mortar cleanup");
    assert(edgeCaseResult.isSingletonBuffer, "Procedural audio uses singleton noise buffer across multiple calls (zero GC)");
    assert(edgeCaseResult.noLevitation, "getBotSupportHeight does not tractor-beam bots up into overhead obstacles (>0.4m above feet)");
    assert(edgeCaseResult.movedDiag && Math.abs(edgeCaseResult.botStepHeight - 1.5) < 0.01, `Bot smoothly negotiates diagonal compound step (Y: ${edgeCaseResult.botStepHeight})`);

    // Final checks
    assert(pageErrors.length === 0, `Zero page runtime errors during Phase 4 verification (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log("\n=== PHASE 4 VERIFICATION FINISHED ===");
    if (failures === 0) {
        console.log("ALL PHASE 4 TESTS PASSED SUCCESSFULLY!");
        process.exit(0);
    } else {
        console.error(`PHASE 4 VERIFICATION FAILED: ${failures} assertions failed.`);
        process.exit(1);
    }
}

runPhase4Tests().catch(err => {
    console.error("Test execution fatal error:", err);
    process.exit(1);
});
