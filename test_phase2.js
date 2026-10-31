const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runPhase2Tests() {
    console.log("=== STARTING PHASE 2 AUTOMATED VERIFICATION ===");
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error("FAIL:", message);
            failures++;
        } else {
            console.log("PASS:", message);
        }
    }

    // 1. Static Architecture & Module Checks
    console.log("\n--- Checking File Architecture & Decoupling ---");
    assert(fs.existsSync(path.join(__dirname, 'modules/drones.js')), "modules/drones.js exists");
    assert(fs.existsSync(path.join(__dirname, 'modules/shop.js')), "modules/shop.js exists");

    const bombJsContent = fs.readFileSync(path.join(__dirname, 'modules/bomb.js'), 'utf-8');
    assert(!bombJsContent.includes('function updateDronePhysics'), "bomb.js does NOT contain updateDronePhysics");
    assert(!bombJsContent.includes('function triggerDroneExplosion'), "bomb.js does NOT contain triggerDroneExplosion");
    assert(!bombJsContent.includes('function updateHUD'), "bomb.js does NOT contain updateHUD");

    const minimapJsContent = fs.readFileSync(path.join(__dirname, 'modules/minimap.js'), 'utf-8');
    assert(!minimapJsContent.includes('function destroyDrone'), "minimap.js does NOT contain destroyDrone");

    const dronesJsContent = fs.readFileSync(path.join(__dirname, 'modules/drones.js'), 'utf-8');
    assert(dronesJsContent.includes('function createDrone'), "drones.js contains createDrone");
    assert(dronesJsContent.includes('function updateDronePhysics'), "drones.js contains updateDronePhysics");
    assert(dronesJsContent.includes('function triggerDroneExplosion'), "drones.js contains triggerDroneExplosion");
    assert(dronesJsContent.includes('function destroyDrone'), "drones.js contains destroyDrone");

    const shopJsContent = fs.readFileSync(path.join(__dirname, 'modules/shop.js'), 'utf-8');
    assert(shopJsContent.includes('function buyWeapon'), "shop.js contains buyWeapon");
    assert(shopJsContent.includes('function openBuyMenu'), "shop.js contains openBuyMenu");
    assert(shopJsContent.includes('function closeBuyMenu'), "shop.js contains closeBuyMenu");
    assert(shopJsContent.includes('function buyAmmo'), "shop.js contains buyAmmo");
    assert(shopJsContent.includes('function buyArmorPlate'), "shop.js contains buyArmorPlate");
    assert(shopJsContent.includes('function buyMedkit'), "shop.js contains buyMedkit");
    assert(shopJsContent.includes('function buyBulletType'), "shop.js contains buyBulletType");

    const bulletsJsContent = fs.readFileSync(path.join(__dirname, 'modules/bullets.js'), 'utf-8');
    assert(!bulletsJsContent.includes('robohash.org'), "bullets.js contains NO robohash.org references");
    assert(bulletsJsContent.includes('createProceduralBotFaceTexture'), "bullets.js contains createProceduralBotFaceTexture");

    const indexHtmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    assert(indexHtmlContent.includes('<script src="modules/shop.js"></script>'), "index.html includes modules/shop.js");
    assert(indexHtmlContent.includes('<script src="modules/drones.js"></script>'), "index.html includes modules/drones.js");

    // 2. Headless Browser Verification
    console.log("\n--- Starting Headless Browser Tests ---");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const interceptedRequests = [];
    await page.setRequestInterception(true);
    page.on('request', req => {
        interceptedRequests.push(req.url());
        req.continue();
    });

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

    // Test 2.1: Verify RoboHash is completely eliminated
    console.log("\n--- Testing RoboHash Network Elimination & Canvas Textures ---");
    const robohashRequests = interceptedRequests.filter(url => url.includes('robohash.org'));
    assert(robohashRequests.length === 0, `Zero network requests to robohash.org (found: ${robohashRequests.length})`);

    const canvasTextureResult = await page.evaluate(() => {
        const ctTex = createProceduralBotFaceTexture('CT');
        const tTex = createProceduralBotFaceTexture('T');
        return {
            ctIsCanvas: ctTex && ctTex.image && ctTex.image.tagName === 'CANVAS',
            tIsCanvas: tTex && tTex.image && tTex.image.tagName === 'CANVAS',
            ctWidth: ctTex && ctTex.image ? ctTex.image.width : 0,
            tWidth: tTex && tTex.image ? tTex.image.width : 0,
            isCanvasTexture: ctTex instanceof THREE.CanvasTexture && tTex instanceof THREE.CanvasTexture
        };
    });
    assert(canvasTextureResult.ctIsCanvas && canvasTextureResult.tIsCanvas, "CT and T bot face textures generated via HTML5 Canvas");
    assert(canvasTextureResult.ctWidth === 128 && canvasTextureResult.tWidth === 128, "Procedural face textures have valid 128x128 dimensions");
    assert(canvasTextureResult.isCanvasTexture, "Textures are valid THREE.CanvasTexture instances");

    // Test 2.2: Verify Drone Lifecycle in modules/drones.js
    console.log("\n--- Testing Drone System (Creation, Physics, Damage, Destruction) ---");
    const droneTestResult = await page.evaluate(() => {
        roundActive = true;
        playerState.hp = 100;
        playerState.team = 'CT';
        playerState.isSpectating = false;
        playerState.isControllingDrone = false;
        camera.position.set(0, 10, 0);

        // 1. Create player drone
        const startPos = new THREE.Vector3(0, 10, 0);
        const dir = new THREE.Vector3(0, 0, 1);
        createDrone(startPos, dir, 'CT', true);

        const playerDroneCreated = activeDrones.some(d => d.isPlayer);
        const controllingDrone = playerState.isControllingDrone;

        // Duplicate player drone should be rejected
        createDrone(startPos, dir, 'CT', true);
        const playerDroneCount = activeDrones.filter(d => d.isPlayer).length;

        // 2. Step physics
        window.moveForward = true;
        updateDronePhysics(0.016);
        window.moveForward = false;
        const playerDrone = activeDrones.find(d => d.isPlayer);
        const droneMoved = playerDrone && (playerDrone.mesh.position.z !== 0 || camera.position.z !== 0);

        // 3. Create Bot drone targeting player
        const botDroneStart = new THREE.Vector3(0, 15, 50);
        createDrone(botDroneStart, new THREE.Vector3(0, 0, -1), 'T', false, 9999);
        const botDrone = activeDrones.find(d => !d.isPlayer);
        // Step bot drone physics towards player
        for (let i = 0; i < 10; i++) {
            updateDronePhysics(0.016);
        }
        const botDroneVelocityValid = botDrone && botDrone.velocity.length() > 0;

        // 4. Test Drone Explosion damage
        const testTBot = { id: 8881, team: 'T', hp: 100, isDead: false, mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()) };
        testTBot.mesh.position.set(0, 0, 10);
        bots.push(testTBot);
        playerDrone.targetIndicator.position.set(0, 0, 10);
        triggerDroneExplosion(playerDrone);
        const enemyBotDamaged = testTBot.hp < 100;

        // 5. Test destroyDrone cleanup
        const initialActiveDroneCount = activeDrones.length;
        destroyDrone(playerDrone, false);
        const finalActiveDroneCount = activeDrones.length;
        const playerStateRestored = !playerState.isControllingDrone;

        // Clean up bot drone and test bot
        if (botDrone) destroyDrone(botDrone, false);
        const tBotIdx = bots.indexOf(testTBot);
        if (tBotIdx !== -1) bots.splice(tBotIdx, 1);

        return {
            playerDroneCreated,
            controllingDrone,
            playerDroneCount,
            droneMoved,
            botDroneVelocityValid,
            enemyBotDamaged,
            destroyedCleanly: initialActiveDroneCount > finalActiveDroneCount,
            playerStateRestored
        };
    });
    assert(droneTestResult.playerDroneCreated && droneTestResult.controllingDrone, "Player drone spawned and playerState.isControllingDrone activated");
    assert(droneTestResult.playerDroneCount === 1, "Duplicate player drone creation properly blocked");
    assert(droneTestResult.droneMoved, "Player drone physics processed movement input");
    assert(droneTestResult.botDroneVelocityValid, "Bot drone AI calculated velocity toward target");
    assert(droneTestResult.enemyBotDamaged, "triggerDroneExplosion dealt blast damage to enemy bot");
    assert(droneTestResult.destroyedCleanly && droneTestResult.playerStateRestored, "destroyDrone removed drone from scene/array and restored player state");

    // Test 2.3: Verify Shop & Economy in modules/shop.js
    console.log("\n--- Testing Shop & Economy (modules/shop.js) ---");
    const shopTestResult = await page.evaluate(() => {
        roundActive = true;
        roundTime = 240;
        playerState.isSpectating = false;
        playerState.isControllingDrone = false;
        playerCurrency = 10000;
        playerScore = 500;
        inventory.primary = null;
        inventory.secondary = 'pistol';
        ammoState.primary = { clip: 0, reserve: 0 };
        ammoState.secondary = { clip: 12, reserve: 24 };
        playerState.armorPlates = 0;
        playerState.hp = 80;
        playerState.bulletStacking = false;
        playerState.bulletType = 'normal';
        playerState.bulletTypes = ['normal'];
        if (playerState.spawnPos) {
            camera.position.copy(playerState.spawnPos);
        } else {
            playerState.spawnPos = camera.position.clone();
        }

        // 1. Open and Close buy menu
        openBuyMenu();
        const menuOpen = document.getElementById('buy-menu').classList.contains('active');
        closeBuyMenu();
        const menuClosed = document.getElementById('buy-menu').classList.contains('hidden');

        // 2. Buy Primary Weapon (AK-47: $2700)
        buyWeapon('rifle', 2700);
        const boughtRifle = inventory.primary === 'rifle';
        const currencyAfterRifle = playerCurrency; // 10000 - 2700 = 7300

        // 3. Buy Ammo
        switchWeapon(1);
        const clipBeforeAmmo = ammoState.primary.reserve;
        buyAmmo();
        const clipAfterAmmo = ammoState.primary.reserve;
        const boughtAmmo = clipAfterAmmo > clipBeforeAmmo;

        // 4. Buy Armor Plate ($400 each, max 6)
        buyArmorPlate();
        buyArmorPlate();
        const platesCount = playerState.armorPlates; // should be 2
        const armorHudText = document.getElementById('hud-armor') ? document.getElementById('hud-armor').innerText : '';

        // 5. Buy Medkit ($500, restores hp to 100)
        buyMedkit();
        const hpAfterMedkit = playerState.hp; // should be 100
        const currBeforeMaxHpBuy = playerCurrency;
        buyMedkit(); // Should reject because already 100
        const rejectedFullHpMedkit = playerCurrency === currBeforeMaxHpBuy;

        // 6. Buy Bullet Type & Stacking
        buyBulletStacking();
        const stackingActive = playerState.bulletStacking === true;
        buyBulletType('incendiary');
        const incendiaryAdded = playerState.bulletTypes.includes('incendiary');

        // 7. Buy Drop Compensation
        dropCompensationPurchased = false;
        buyDropCompensation();
        const dropCompPurchased = dropCompensationPurchased;

        return {
            menuOpen,
            menuClosed,
            boughtRifle,
            currencyAfterRifle,
            boughtAmmo,
            platesCount,
            armorHudText,
            hpAfterMedkit,
            rejectedFullHpMedkit,
            stackingActive,
            incendiaryAdded,
            dropCompPurchased
        };
    });
    assert(shopTestResult.menuOpen && shopTestResult.menuClosed, "openBuyMenu() and closeBuyMenu() successfully toggle buy-menu DOM state");
    assert(shopTestResult.boughtRifle && shopTestResult.currencyAfterRifle === 7300, `buyWeapon('rifle', 2700) equipped rifle and deducted currency (7300 == ${shopTestResult.currencyAfterRifle})`);
    assert(shopTestResult.boughtAmmo, "buyAmmo() recharged weapon reserve ammo");
    assert(shopTestResult.platesCount === 2 && shopTestResult.armorHudText.includes('2/6'), `buyArmorPlate() added plates and updated HUD (plates: ${shopTestResult.platesCount}, hud: ${shopTestResult.armorHudText})`);
    assert(shopTestResult.hpAfterMedkit === 100 && shopTestResult.rejectedFullHpMedkit, "buyMedkit() restored HP to 100 and refused purchase when already full");
    assert(shopTestResult.stackingActive && shopTestResult.incendiaryAdded, "buyBulletStacking() and buyBulletType() enabled multi-bullet type customization");
    assert(shopTestResult.dropCompPurchased, "buyDropCompensation() updated dropCompensationPurchased state");

    // Test 2.4: Gating Debug Cheat Backdoors (KeyL & KeyK)
    console.log("\n--- Testing Debug Backdoor Key Gating (KeyL & KeyK) ---");
    // Ensure controls are mock locked for keydown switch
    await page.evaluate(() => {
        if (!controls) controls = {};
        controls.isLocked = true;
        playerState.isInvincible = false;
        playerCurrency = 5000;
        playerScore = 100;
        delete window.__DEV__;
    });

    // In default production environment without dev flag, KeyL and KeyK must be ignored
    await page.keyboard.press('KeyL');
    await page.keyboard.press('KeyK');
    const prodResult = await page.evaluate(() => {
        return {
            invincible: playerState.isInvincible,
            currency: playerCurrency,
            score: playerScore,
            isDev: isDevMode()
        };
    });
    assert(prodResult.isDev === false, "isDevMode() returns false in default production environment");
    assert(prodResult.invincible === false, "KeyL (Invincibility) blocked in production environment");
    assert(prodResult.currency === 5000, "KeyK (Free Money) blocked in production environment (currency unchanged at 5000)");
    assert(prodResult.score === 100, "KeyK (Free Score) blocked in production environment (score unchanged at 100)");

    // In DEV environment (window.__DEV__ = true), KeyL and KeyK must work
    await page.evaluate(() => {
        window.__DEV__ = true;
    });
    await page.keyboard.press('KeyL');
    await page.keyboard.press('KeyK');
    const devResult = await page.evaluate(() => {
        return {
            invincible: playerState.isInvincible,
            currency: playerCurrency,
            score: playerScore,
            isDev: isDevMode()
        };
    });
    assert(devResult.isDev === true, "isDevMode() returns true when window.__DEV__ = true");
    assert(devResult.invincible === true, "KeyL successfully activated Invincibility in DEV mode");
    assert(devResult.currency === 6000, "KeyK successfully granted +1000 Currency in DEV mode (5000 -> 6000)");
    assert(devResult.score === 1100, "KeyK successfully granted +1000 Score in DEV mode (100 -> 1100)");

    // Test 2.5: URL param ?debug=true authentication
    console.log("\n--- Testing URL Param ?debug=true Authentication ---");
    const debugPage = await browser.newPage();
    const debugUri = baseUri + '?debug=true';
    await debugPage.goto(debugUri, { waitUntil: 'load' });
    const urlDebugResult = await debugPage.evaluate(() => {
        return typeof isDevMode === 'function' ? isDevMode() : false;
    });
    assert(urlDebugResult === true, "URL parameter ?debug=true activates isDevMode()");
    await debugPage.close();

    // Test 2.6: Bot Drone autonomous physics while player is spectating and while buy menu is open
    console.log("\n--- Testing Drone Simulation Decoupling (Spectating & Menus) ---");
    const droneDecoupleResult = await page.evaluate(() => {
        roundActive = true;
        playerState.isSpectating = true; // Player is dead / spectating
        const startPos = new THREE.Vector3(0, 20, 50);
        const botDrone = createDrone(startPos, new THREE.Vector3(0, 0, -1), 'T', false, 9991);
        const initialZ = botDrone.mesh.position.z;

        // Step physics via the global entity update loop
        for (let i = 0; i < 20; i++) {
            updateDronePhysics(0.016);
        }
        const movedWhileSpectating = botDrone.mesh.position.z !== initialZ;
        destroyDrone(botDrone, false, true);

        // Now test with buy menu open (pointer unlocked)
        playerState.isSpectating = false;
        const playerStartPos = new THREE.Vector3(0, 20, 0);
        const playerDrone = createDrone(playerStartPos, new THREE.Vector3(0, 0, 1), 'CT', true);
        playerDrone.selfDestructing = true;
        const pInitialY = playerDrone.mesh.position.y;
        openBuyMenu(); // opens buy menu and unlocks pointer
        for (let i = 0; i < 15; i++) {
            updateDronePhysics(0.016);
        }
        const fellWhileMenuOpen = playerDrone.mesh.position.y < pInitialY;
        closeBuyMenu();
        destroyDrone(playerDrone, false, true);

        return { movedWhileSpectating, fellWhileMenuOpen };
    });
    assert(droneDecoupleResult.movedWhileSpectating, "Bot drones continue simulating physics while player is spectating");
    assert(droneDecoupleResult.fellWhileMenuOpen, "Player drone self-destruct continues falling when buy menu is open");

    // Test 2.7: Drone and Dummy Cleanup in resetRound()
    console.log("\n--- Testing Drone & Dummy Cleanup on Round Reset ---");
    const cleanupResult = await page.evaluate(() => {
        // Clean up any background bot drones before test
        while (activeDrones.length > 0) destroyDrone(activeDrones[0], false, true);
        roundActive = true;
        playerState.isSpectating = false;
        playerState.hp = 100;
        createDrone(new THREE.Vector3(10, 10, 10), new THREE.Vector3(0, 0, 1), 'CT', true);
        const dummyExistsBefore = !!(typeof getPlayerDummyMesh === 'function' ? getPlayerDummyMesh() : scene.getObjectByName('playerDummy'));
        const dronesBefore = activeDrones.length;

        // Reset round
        resetRound();

        const dronesAfter = activeDrones.length;
        const dummyExistsAfter = !!(typeof getPlayerDummyMesh === 'function' ? getPlayerDummyMesh() : scene.getObjectByName('playerDummy'));
        const controllingDroneAfter = playerState.isControllingDrone;

        // Test that we can spawn a new drone in the new round
        const newDrone = createDrone(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, 0, 1), 'CT', true);
        const canSpawnInNewRound = !!newDrone;
        if (newDrone) destroyDrone(newDrone, false, true);

        return {
            dummyExistsBefore,
            dronesBefore,
            dronesAfter,
            dummyExistsAfter,
            controllingDroneAfter,
            canSpawnInNewRound
        };
    });
    assert(cleanupResult.dummyExistsBefore && cleanupResult.dronesBefore === 1, "Player drone and dummy spawned before resetRound");
    assert(cleanupResult.dronesAfter === 0, "activeDrones array cleared by resetRound");
    assert(!cleanupResult.dummyExistsAfter, "playerDummyMesh cleaned from scene and set to null by resetRound");
    assert(!cleanupResult.controllingDroneAfter, "playerState.isControllingDrone reset to false");
    assert(cleanupResult.canSpawnInNewRound, "New drone successfully created in subsequent round without stale obstruction");

    // Test 2.8: Duplicate Drone Deployment in Slot 4 does not waste inventory
    console.log("\n--- Testing Redundant Drone Fire in Slot 4 ---");
    const slot4Result = await page.evaluate(() => {
        roundActive = true;
        playerState.hp = 100;
        playerState.isSpectating = false;
        if (!controls) controls = {};
        controls.isLocked = true;
        inventory.currentSlot = 4;
        inventory.grenades['drone'] = 2;
        inventory.currentGrenade = 'drone';

        // Fire 1: deploys first drone
        isShooting = true;
        handleShooting(true);
        isShooting = false;
        const remainingAfterFirst = inventory.grenades['drone'];
        const isControlling = playerState.isControllingDrone;

        // Fire 2: redundant fire while controlling drone
        isShooting = true;
        handleShooting(true);
        isShooting = false;
        const remainingAfterSecond = inventory.grenades['drone'];

        // Clean up
        const pd = activeDrones.find(d => d.isPlayer);
        if (pd) destroyDrone(pd, false, true);

        return { remainingAfterFirst, isControlling, remainingAfterSecond };
    });
    assert(slot4Result.remainingAfterFirst === 1 && slot4Result.isControlling, "First drone fire deployed drone and decremented inventory (2 -> 1)");
    assert(slot4Result.remainingAfterSecond === 1, "Duplicate drone fire blocked without wasting inventory (still 1)");

    // Test 2.9: Buy Menu Biohazard title hidden in bomb mode and Escape key closes menu
    console.log("\n--- Testing Buy Menu Biohazard Title & Escape Key ---");
    const menuUiResult = await page.evaluate(() => {
        gameMode = 'bomb';
        roundActive = true;
        roundTime = 240;
        playerState.isSpectating = false;
        playerState.isControllingDrone = false;
        playerState.spawnPos = camera.position.clone();
        openBuyMenu();
        const bioTitle = document.getElementById('biohazard-title');
        const bioTitleVisible = bioTitle && bioTitle.style.display !== 'none';
        const isMenuOpen = !document.getElementById('buy-menu').classList.contains('hidden');
        return { bioTitleVisible, isMenuOpen };
    });
    assert(!menuUiResult.bioTitleVisible, "Biohazard title is hidden in Bomb Mode buy menu");
    assert(menuUiResult.isMenuOpen, "Buy menu opened successfully");

    // Press Escape to close menu
    await page.keyboard.press('Escape');
    const menuClosedByEscape = await page.evaluate(() => {
        return document.getElementById('buy-menu').classList.contains('hidden');
    });
    assert(menuClosedByEscape, "Escape key closes active buy menu");

    // Test 2.10: Procedural Face Texture Singleton Caching
    console.log("\n--- Testing Procedural Face Texture Singleton Caching ---");
    const textureCacheResult = await page.evaluate(() => {
        const ct1 = getProceduralBotFaceTexture('CT');
        const ct2 = getProceduralBotFaceTexture('CT');
        const t1 = getProceduralBotFaceTexture('T');
        const t2 = getProceduralBotFaceTexture('T');
        return {
            ctIdentical: ct1 === ct2,
            tIdentical: t1 === t2
        };
    });
    assert(textureCacheResult.ctIdentical && textureCacheResult.tIdentical, "getProceduralBotFaceTexture reuses singleton CanvasTexture without reallocating");

    // Verification of zero page errors
    assert(pageErrors.length === 0, `Zero page runtime errors during Phase 2 tests (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log(`\n=== PHASE 2 VERIFICATION FINISHED: ${failures === 0 ? "ALL PASSED" : failures + " FAILURES"} ===`);
    if (failures > 0) process.exit(1);
}

runPhase2Tests().catch(err => {
    console.error("FATAL PHASE 2 TEST EXCEPTION:", err);
    process.exit(1);
});
