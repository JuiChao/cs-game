const puppeteer = require('puppeteer');
const path = require('path');

async function runTests() {
    console.log("=== STARTING CRYO CANISTER & BINARY TRIGGER VERIFICATION ===");
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

    // =========================================================================
    // SECTION 1: CRYO CANISTER (液氮冷罐) TESTS
    // =========================================================================

    console.log("\n--- Section 1.1: Cryo Canister Shop Purchase & Drone Discount ---");
    const cryoShopTest = await page.evaluate(() => {
        playerCurrency = 1000;
        const initialCryoCount = inventory.grenades.cryo || 0;
        
        // Regular buy: cost 400
        buyWeapon('cryo', 400);
        const countAfterBuy = inventory.grenades.cryo;
        const currencyAfterBuy = playerCurrency;

        // Drone half price buy: cost 200
        playerState.isControllingDrone = true;
        buyWeapon('cryo', 400); // shop passes 400, buyWeapon halves to 200
        playerState.isControllingDrone = false;
        const countAfterDrone = inventory.grenades.cryo;
        const currencyAfterDrone = playerCurrency;

        return {
            initialCryoCount,
            countAfterBuy,
            currencyAfterBuy,
            countAfterDrone,
            currencyAfterDrone,
            shopBtnExists: !!document.getElementById('btn-throwable-cryo')
        };
    });

    assert(cryoShopTest.shopBtnExists === true, "Shop has 'btn-throwable-cryo' button");
    assert(cryoShopTest.countAfterBuy === cryoShopTest.initialCryoCount + 1, "Buying cryo grenade increases count by 1");
    assert(cryoShopTest.currencyAfterBuy === 600, "Regular cryo purchase costs 400$ (1000 - 400 = 600)");
    assert(cryoShopTest.countAfterDrone === cryoShopTest.countAfterBuy + 1, "Drone cryo purchase increases count by 1");
    assert(cryoShopTest.currencyAfterDrone === 400, "Drone cryo purchase is half price (600 - 200 = 400$)");

    console.log("\n--- Section 1.2: Cryo Zone Creation & Geometry ---");
    const zoneCreateTest = await page.evaluate(() => {
        createCryoZone(new THREE.Vector3(0, 0, 0), 'T', false, true);
        const z = activeCryoZones[activeCryoZones.length - 1];
        return {
            zoneCount: activeCryoZones.length,
            zoneHalfSize: z.halfSize,
            zoneLife: z.life,
            hasMesh: !!z.mesh,
            hasInnerMesh: !!z.innerMesh
        };
    });

    assert(zoneCreateTest.zoneCount >= 1, "createCryoZone adds zone to activeCryoZones");
    assert(zoneCreateTest.zoneHalfSize === 22.5, "Standard cryo zone halfSize is 22.5 (size 45)");
    assert(zoneCreateTest.zoneLife === 8.0, "Cryo zone initial life is 8.0 seconds");
    assert(zoneCreateTest.hasMesh && zoneCreateTest.hasInnerMesh, "Cryo zone has outer mesh and inner ring mesh");

    console.log("\n--- Section 1.3: Cryo Damage (5 damage per 0.5s) & Accumulation HUD ---");
    const damageProgressionTest = await page.evaluate(() => {
        // Place zone at center, position player at center
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        playerState.hp = 100;
        playerState.isFrozen = false;
        playerState.freezeTimer = 0;
        playerState.freezeImmuneTimer = 0;
        playerState.cryoHits = 0;
        playerState.cryoDamageTimer = 0;
        camera.position.set(0, 2, 0);

        const snapshots = [];
        const freezeStatus = document.getElementById('freeze-status');
        const freezeProg = document.getElementById('freeze-progress');
        const freezeText = document.getElementById('freeze-text');

        // Tick 0.25s: not yet 0.5s, no damage yet
        updateCryoZones(0.25);
        snapshots.push({
            t: 0.25,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            isFrozen: playerState.isFrozen,
            uiHidden: freezeStatus ? freezeStatus.classList.contains('hidden') : true
        });

        // Tick another 0.25s (total 0.5s): Tick 1 (5 damage, 1 hit, 20% progress)
        updateCryoZones(0.25);
        snapshots.push({
            t: 0.5,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            isFrozen: playerState.isFrozen,
            uiHidden: freezeStatus ? freezeStatus.classList.contains('hidden') : true,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        });

        // Tick 0.5s (total 1.0s): Tick 2 (5 damage -> 90 hp, 2 hits, 40%)
        updateCryoZones(0.5);
        snapshots.push({
            t: 1.0,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            progWidth: freezeProg ? freezeProg.style.width : ''
        });

        // Tick 0.5s (total 1.5s): Tick 3 (5 damage -> 85 hp, 3 hits, 60%)
        updateCryoZones(0.5);
        snapshots.push({
            t: 1.5,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            progWidth: freezeProg ? freezeProg.style.width : ''
        });

        // Tick 0.5s (total 2.0s): Tick 4 (5 damage -> 80 hp, 4 hits, 80%)
        updateCryoZones(0.5);
        snapshots.push({
            t: 2.0,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            progWidth: freezeProg ? freezeProg.style.width : ''
        });

        // Tick 0.5s (total 2.5s): Tick 5 (5 damage -> 75 hp, 5 hits -> FREEZE!)
        updateCryoZones(0.5);
        snapshots.push({
            t: 2.5,
            hp: playerState.hp,
            hits: playerState.cryoHits,
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        });

        return snapshots;
    });

    assert(damageProgressionTest[0].hp === 100 && damageProgressionTest[0].hits === 0, "No damage dealt before 0.5s elapsed");
    assert(damageProgressionTest[1].hp === 95 && damageProgressionTest[1].hits === 1, "At 0.5s: Exactly 5 damage dealt (hp 100 -> 95), cryoHits = 1");
    assert(damageProgressionTest[1].uiHidden === false, "At 0.5s: Freeze status UI overlay is visible");
    assert(damageProgressionTest[1].progWidth === '20%', "Freeze progress bar is 20% on 1 hit");
    assert(damageProgressionTest[2].hp === 90 && damageProgressionTest[2].hits === 2, "At 1.0s: Exactly 10 total damage dealt, cryoHits = 2");
    assert(damageProgressionTest[2].progWidth === '40%', "Freeze progress bar is 40% on 2 hits");
    assert(damageProgressionTest[3].hp === 85 && damageProgressionTest[3].hits === 3, "At 1.5s: Exactly 15 total damage dealt, cryoHits = 3");
    assert(damageProgressionTest[4].hp === 80 && damageProgressionTest[4].hits === 4, "At 2.0s: Exactly 20 total damage dealt, cryoHits = 4");
    assert(damageProgressionTest[5].hp === 75 && damageProgressionTest[5].hits === 5, "At 2.5s: 5 hits reached, total damage = 25");
    assert(damageProgressionTest[5].isFrozen === true, "5 damage ticks triggers isFrozen = true");
    assert(Math.abs(damageProgressionTest[5].freezeTimer - 3.0) < 0.001, "Freeze duration is set to exactly 3.0 seconds");
    assert(damageProgressionTest[5].progWidth === '100%', "Freeze progress bar is 100% when frozen");
    assert(damageProgressionTest[5].text.includes('已冰冻'), "Freeze status text shows '已冰冻!'");

    console.log("\n--- Section 1.4: Frozen State Action Restrictions (Move/Shoot/Jump/Interact) ---");
    const frozenActionTest = await page.evaluate(() => {
        playerState.isFrozen = true;
        playerState.freezeTimer = 3.0;

        // 1. Movement physics test
        playerState.velocity.set(10, 0, 10);
        updatePhysics(0.016);
        const vxAfterPhysics = playerState.velocity.x;
        const vzAfterPhysics = playerState.velocity.z;

        // 2. Shooting test
        const clipBeforeShoot = ammoState.secondary.clip;
        handleShooting(true);
        const clipAfterShoot = ammoState.secondary.clip;

        return {
            vxAfterPhysics,
            vzAfterPhysics,
            clipBeforeShoot,
            clipAfterShoot
        };
    });

    assert(frozenActionTest.vxAfterPhysics === 0 && frozenActionTest.vzAfterPhysics === 0, "updatePhysics forces velocity to 0 when frozen");
    assert(frozenActionTest.clipAfterShoot === frozenActionTest.clipBeforeShoot, "handleShooting is completely blocked when frozen");

    console.log("\n--- Section 1.5: 3s Freeze Duration & 5s Freeze Immunity Mechanics ---");
    const unfreezeImmunityTest = await page.evaluate(() => {
        // Player is currently frozen with freezeTimer = 3.0s, ensure zone stays active
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        activeCryoZones[0].life = 999;
        camera.position.set(0, 2, 0);

        playerState.isFrozen = true;
        playerState.freezeTimer = 3.0;
        playerState.freezeImmuneTimer = 0;
        playerState.cryoHits = 5;
        playerState.cryoDamageTimer = 0;
        playerState.hp = 100;

        // Advance 2.0s: still frozen (1.0s remaining)
        updateCryoZones(2.0);
        const stateAt2s = {
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            freezeImmuneTimer: playerState.freezeImmuneTimer
        };

        // Advance 1.0s (total 3.0s): Exactly unfreezes!
        updateCryoZones(1.0);
        const stateAt3s = {
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            freezeImmuneTimer: playerState.freezeImmuneTimer,
            cryoHits: playerState.cryoHits
        };

        // Advance 2.5s while still in zone:
        // Takes 5 damage every 0.5s (5 ticks = 25 damage), but CANNOT be frozen because immune!
        const hpBeforeImmuneTicks = playerState.hp;
        updateCryoZones(2.5);
        const stateDuringImmune = {
            isFrozen: playerState.isFrozen,
            damageTaken: hpBeforeImmuneTicks - playerState.hp,
            cryoHits: playerState.cryoHits,
            immuneTimerLeft: playerState.freezeImmuneTimer
        };

        // Advance remaining 2.5s of immunity (total 5.0s immunity elapsed)
        updateCryoZones(2.5);
        const stateAfterImmunityExpires = {
            immuneTimer: playerState.freezeImmuneTimer
        };

        // Reset HP to 100 to prevent death, then advance 2.5s after immunity expired: can accumulate freeze again and freeze!
        playerState.hp = 100;
        updateCryoZones(2.5);
        const stateRefrozen = {
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer
        };

        return {
            stateAt2s,
            stateAt3s,
            stateDuringImmune,
            stateAfterImmunityExpires,
            stateRefrozen
        };
    });

    assert(unfreezeImmunityTest.stateAt2s.isFrozen === true, "Player remains frozen at 2.0s");
    assert(unfreezeImmunityTest.stateAt3s.isFrozen === false, "Player unfreezes after 3.0 seconds");
    assert(Math.abs(unfreezeImmunityTest.stateAt3s.freezeImmuneTimer - 5.0) < 0.001, "Unfreezing grants exactly 5.0s freeze immunity");
    assert(unfreezeImmunityTest.stateAt3s.cryoHits === 0, "CryoHits resets to 0 on unfreezing");
    assert(unfreezeImmunityTest.stateDuringImmune.isFrozen === false, "Cannot be frozen while immunity is active");
    assert(unfreezeImmunityTest.stateDuringImmune.damageTaken === 25, "Still takes 5 damage per 0.5s during immunity (5 ticks = 25 dmg)");
    assert(unfreezeImmunityTest.stateDuringImmune.cryoHits === 0, "CryoHits does NOT accumulate during 5s immunity");
    assert(unfreezeImmunityTest.stateAfterImmunityExpires.immuneTimer === 0, "Immunity timer expires after 5.0s");
    assert(unfreezeImmunityTest.stateRefrozen.isFrozen === true, "Can be frozen again after 5s immunity cooldown passes");

    console.log("\n--- Section 1.6: Bot Freezing & Bot AI Halt ---");
    const botCryoTest = await page.evaluate(() => {
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(50, 0, 50), 'T', false, true);
        activeCryoZones[0].life = 999;

        // Spawn or get a bot
        if (!bots || bots.length === 0) {
            bots = [{
                mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
                hp: 100,
                team: 'CT',
                isDead: false,
                isFrozen: false,
                freezeTimer: 0,
                freezeImmuneTimer: 0,
                cryoHits: 0,
                cryoDamageTimer: 0,
                stunTimer: 0
            }];
            scene.add(bots[0].mesh);
        }
        const b = bots[0];
        b.mesh.position.set(50, 0, 50);
        b.hp = 100;
        b.isFrozen = false;
        b.freezeTimer = 0;
        b.freezeImmuneTimer = 0;
        b.cryoHits = 0;
        b.cryoDamageTimer = 0;

        // Apply 2.5s of zone updates to bot (5 ticks of 5 damage = 25 dmg, 5 hits)
        updateCryoZones(2.5);
        const botFrozen = b.isFrozen;
        const botTimer = b.freezeTimer;
        const botHp = b.hp;

        // Bot AI should halt
        let actionExecuted = false;
        b.testAction = () => { actionExecuted = true; };
        botAI(0.016);

        // Advance 3.0s: bot unfreezes with 5s immunity
        updateCryoZones(3.0);
        const botUnfrozen = b.isFrozen;
        const botImmuneTimer = b.freezeImmuneTimer;

        return {
            botFrozen,
            botTimer,
            botHp,
            botUnfrozen,
            botImmuneTimer
        };
    });

    assert(botCryoTest.botFrozen === true, "Bot in cryo zone becomes isFrozen = true after 5 hits");
    assert(botCryoTest.botHp === 75, "Bot took 25 damage (5 ticks * 5 dmg = 25 dmg)");
    assert(botCryoTest.botUnfrozen === false, "Bot unfreezes after 3.0s");
    assert(Math.abs(botCryoTest.botImmuneTimer - 5.0) < 0.001, "Bot receives 5s immunity after unfreezing");

    console.log("\n--- Section 1.7: Bot Mid-Defuse Interruption & Player Action Lock ---");
    const edgeCase1Test = await page.evaluate(() => {
        // 1. Bot mid-defuse interrupted
        bombState.planted = true;
        bombState.timer = 45;
        if (!bombState.mesh) {
            bombState.mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
            scene.add(bombState.mesh);
        }
        bombState.mesh.position.set(100, 0, 100);

        const bDefuse = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 100,
            team: 'CT',
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            stunTimer: 0,
            actionProgress: 180
        };
        bDefuse.mesh.position.set(102, 0, 100);
        bots = [bDefuse];

        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(100, 0, 100), 'T', false, true);
        activeCryoZones[0].life = 999;
        updateCryoZones(2.5);
        botAI(0.016);
        const defuseInterrupted = bDefuse.isFrozen && bDefuse.actionProgress === 0;

        // 2. Player action lock while frozen
        playerState.isFrozen = true;
        playerState.freezeTimer = 3.0;
        inventory.grenades.hegrenade = 2;
        quickThrowGrenade();
        const nadesAfterThrow = inventory.grenades.hegrenade;

        ammoState.primary.clip = 15;
        ammoState.primary.reserve = 60;
        isReloading = false;
        handleReload();
        const reloadBlocked = !isReloading;

        inventory.primary = 'rifle';
        inventory.secondary = 'pistol';
        switchWeapon(2);
        const switchBlocked = (inventory.currentSlot !== 2);

        playerState.isFrozen = false;
        playerState.freezeTimer = 0;

        return {
            defuseInterrupted,
            nadesBlocked: nadesAfterThrow === 2,
            reloadBlocked,
            switchBlocked
        };
    });

    assert(edgeCase1Test.defuseInterrupted === true, "Bot mid-defuse is cleanly cancelled (actionProgress reset to 0) upon freezing");
    assert(edgeCase1Test.nadesBlocked === true, "quickThrowGrenade is blocked while player is frozen");
    assert(edgeCase1Test.reloadBlocked === true, "handleReload is blocked while player is frozen");
    assert(edgeCase1Test.switchBlocked === true, "switchWeapon is blocked while player is frozen");

    // =========================================================================
    // SECTION 2: BINARY TRIGGER (双发扳机) TESTS
    // =========================================================================

    console.log("\n--- Section 2.1: Binary Trigger Shop Purchase (700$) ---");
    const btShopTest = await page.evaluate(() => {
        playerState.hasBinaryTrigger = false;
        binaryTriggerPurchased = false;

        // 1. Cannot buy with < 700$
        playerCurrency = 500;
        buyBinaryTrigger();
        const failState = {
            hasBT: playerState.hasBinaryTrigger,
            purchased: binaryTriggerPurchased,
            currency: playerCurrency
        };

        // 2. Can buy with 700$
        playerCurrency = 1000;
        buyBinaryTrigger();
        const btnBT = document.getElementById('btn-binary-trigger');
        const successState = {
            hasBT: playerState.hasBinaryTrigger,
            purchased: binaryTriggerPurchased,
            currency: playerCurrency,
            btnDisabled: btnBT ? btnBT.disabled : false,
            btnText: btnBT ? btnBT.innerText : ''
        };

        // 3. Duplicate purchase blocked (no extra charge)
        buyBinaryTrigger();
        const duplicateState = {
            currency: playerCurrency
        };

        return { failState, successState, duplicateState };
    });

    assert(btShopTest.failState.hasBT === false, "Cannot purchase Binary Trigger with insufficient funds ($500 < $700)");
    assert(btShopTest.failState.currency === 500, "Currency untouched on failed purchase");
    assert(btShopTest.successState.hasBT === true, "buyBinaryTrigger sets playerState.hasBinaryTrigger = true");
    assert(btShopTest.successState.purchased === true, "buyBinaryTrigger sets binaryTriggerPurchased = true");
    assert(btShopTest.successState.currency === 300, "Binary Trigger deducted exactly 700$ (1000 - 700 = 300)");
    assert(btShopTest.successState.btnDisabled === true, "Binary Trigger shop button becomes disabled after purchase");
    assert(btShopTest.successState.btnText.includes('已购买'), "Shop button displays '已购买'");
    assert(btShopTest.duplicateState.currency === 300, "Duplicate purchase is blocked with no extra charge");

    console.log("\n--- Section 2.2: Binary Trigger in Single-Fire Mode (Press & Release Attacks) ---");
    const btSingleFireTest = await page.evaluate(() => {
        // Ensure Binary Trigger active, player alive and control active, and equip rifle in single mode
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isFrozen = false;
        playerState.isControllingDrone = false;
        roundActive = true;
        if (controls) controls.isLocked = true;
        playerState.hasBinaryTrigger = true;
        binaryTriggerPurchased = true;
        isReloading = false;
        inventory.primary = 'rifle';
        switchWeapon(1);
        setWeaponFireMode(WEAPONS.rifle, 'single');

        // Set ammo to 30
        ammoState.primary.clip = 30;
        ammoState.primary.reserve = 90;
        playerState.lastShot = -1000;
        frameCount = 1000;

        // Step 1: Press trigger (mousedown)
        isShooting = true;
        handleShooting(true, false);
        const clipAfterPress = ammoState.primary.clip;
        const lastShotAfterPress = playerState.lastShot;

        // Step 2: Release trigger after weapon cooldown (e.g. fireRate = 6 frames)
        frameCount += 10;
        isShooting = false;
        handleTriggerRelease();
        const clipAfterRelease = ammoState.primary.clip;
        const lastShotAfterRelease = playerState.lastShot;

        return {
            mode: getWeaponFireMode(WEAPONS.rifle),
            clipAfterPress,
            clipAfterRelease,
            lastShotAfterPress,
            lastShotAfterRelease
        };
    });

    assert(btSingleFireTest.mode === 'single', "Rifle is confirmed in 'single' mode");
    assert(btSingleFireTest.clipAfterPress === 29, "Pressing mouse attacks once in single mode (30 -> 29)");
    assert(btSingleFireTest.clipAfterRelease === 28, "Releasing mouse attacks once in single mode (29 -> 28)");
    assert(btSingleFireTest.lastShotAfterRelease > btSingleFireTest.lastShotAfterPress, "Release attack updated lastShot frame");

    console.log("\n--- Section 2.3: Binary Trigger Rapid Tap Cooldown Buffer ---");
    const btBufferTest = await page.evaluate(() => {
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isFrozen = false;
        roundActive = true;
        if (controls) controls.isLocked = true;
        playerState.hasBinaryTrigger = true;
        binaryTriggerPurchased = true;
        inventory.primary = 'rifle';
        switchWeapon(1);
        setWeaponFireMode(WEAPONS.rifle, 'single');
        ammoState.primary.clip = 30;
        frameCount = 2000;
        playerState.lastShot = -1000;

        // Press trigger -> fires shot 1 at frame 2000
        isShooting = true;
        handleShooting(true, false);
        const clipPress = ammoState.primary.clip;

        // Release trigger almost immediately (1 frame later, cooldown is 6 frames)
        frameCount += 1;
        isShooting = false;
        handleTriggerRelease();
        const clipImmediateRelease = ammoState.primary.clip;
        const bufferedFrame = playerState.binaryReleaseDueFrame;

        // Simulate frame loop stepping forward until bufferedFrame is reached
        frameCount = bufferedFrame;
        // In physics.js: when frameCount >= binaryReleaseDueFrame, it fires buffered shot
        if (playerState.binaryReleaseDueFrame && frameCount >= playerState.binaryReleaseDueFrame) {
            playerState.binaryReleaseDueFrame = 0;
            handleShooting(true, true);
        }
        const clipAfterBufferExecuted = ammoState.primary.clip;

        return {
            clipPress,
            clipImmediateRelease,
            bufferedFrame,
            clipAfterBufferExecuted
        };
    });

    assert(btBufferTest.clipPress === 29, "First shot fired on immediate press (30 -> 29)");
    assert(btBufferTest.clipImmediateRelease === 29, "Release during cooldown did not fire prematurely (stays 29)");
    assert(btBufferTest.bufferedFrame === 2006, "Buffered release shot scheduled for frame 2006");
    assert(btBufferTest.clipAfterBufferExecuted === 28, "Buffered shot executed when cooldown frame reached (29 -> 28)");

    console.log("\n--- Section 2.4: Binary Trigger Disabled in Multi / Burst Modes ---");
    const btDisabledModesTest = await page.evaluate(() => {
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isFrozen = false;
        roundActive = true;
        if (controls) controls.isLocked = true;
        playerState.hasBinaryTrigger = true;
        binaryTriggerPurchased = true;
        // 1. Rifle in 'multi' mode
        inventory.primary = 'rifle';
        switchWeapon(1);
        setWeaponFireMode(WEAPONS.rifle, 'multi');
        ammoState.primary.clip = 30;
        frameCount = 3000;
        playerState.lastShot = -1000;

        isShooting = true;
        handleShooting(true, false);
        const clipMultiPress = ammoState.primary.clip;

        frameCount += 10;
        isShooting = false;
        handleTriggerRelease();
        const clipMultiRelease = ammoState.primary.clip;

        // 2. MK4 in 'burst' mode
        inventory.primary = 'mk4';
        switchWeapon(1);
        setWeaponFireMode(WEAPONS.mk4, 'burst');
        ammoState.primary.clip = 30;
        frameCount = 4000;
        playerState.lastShot = -1000;

        isShooting = true;
        handleShooting(true, false);
        const clipBurstPress = ammoState.primary.clip;

        frameCount += 10;
        isShooting = false;
        handleTriggerRelease();
        const clipBurstRelease = ammoState.primary.clip;

        // 3. Melee (knife)
        switchWeapon(3);
        const knifeClipBefore = ammoState.secondary.clip;
        handleTriggerRelease();
        const knifeClipAfter = ammoState.secondary.clip;

        return {
            clipMultiPress,
            clipMultiRelease,
            clipBurstPress,
            clipBurstRelease,
            knifeClipBefore,
            knifeClipAfter
        };
    });

    assert(btDisabledModesTest.clipMultiPress === 29, "Multi-mode fired initial shot on press");
    assert(btDisabledModesTest.clipMultiRelease === 29, "Multi-mode release DOES NOT fire extra shot (Binary Trigger disabled in multi)");
    assert(btDisabledModesTest.clipBurstRelease === btDisabledModesTest.clipBurstPress, "Burst-mode release DOES NOT fire extra shot (Binary Trigger disabled in burst)");
    assert(btDisabledModesTest.knifeClipAfter === btDisabledModesTest.knifeClipBefore, "Melee weapon safely ignores trigger release");

    console.log("\n--- Section 2.5: Binary Trigger Disabled if Not Purchased ---");
    const btNotPurchasedTest = await page.evaluate(() => {
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isFrozen = false;
        roundActive = true;
        if (controls) controls.isLocked = true;
        playerState.hasBinaryTrigger = false;
        binaryTriggerPurchased = false;
        inventory.primary = 'rifle';
        switchWeapon(1);
        setWeaponFireMode(WEAPONS.rifle, 'single');
        ammoState.primary.clip = 30;
        frameCount = 5000;
        playerState.lastShot = -1000;

        isShooting = true;
        handleShooting(true, false);
        const clipPress = ammoState.primary.clip;

        frameCount += 10;
        isShooting = false;
        handleTriggerRelease();
        const clipRelease = ammoState.primary.clip;

        return { clipPress, clipRelease };
    });

    assert(btNotPurchasedTest.clipPress === 29, "Single mode fires on press even without Binary Trigger");
    assert(btNotPurchasedTest.clipRelease === 29, "Without Binary Trigger, release DOES NOT fire (stays 29)");

    console.log("\n--- Section 2.6: Mid-Hold Mode Switch & Stray Release Safety ---");
    const modeSwitchSafetyTest = await page.evaluate(() => {
        playerState.hp = 100;
        playerState.isSpectating = false;
        playerState.isFrozen = false;
        roundActive = true;
        if (controls) controls.isLocked = true;
        playerState.hasBinaryTrigger = true;
        binaryTriggerPurchased = true;
        inventory.primary = 'rifle';
        switchWeapon(1);

        // 1. Multi mode press -> switch to Single -> release: MUST NOT fire
        setWeaponFireMode(WEAPONS.rifle, 'multi');
        ammoState.primary.clip = 30;
        frameCount = 6000;
        playerState.lastShot = -1000;
        isShooting = true;
        handleShooting(true, false);
        const clipMultiPress = ammoState.primary.clip; // 29

        toggleFireMode(WEAPONS.rifle); // switches to single
        frameCount += 10;
        isShooting = false;
        handleTriggerRelease(false);
        const clipAfterMultiToSingleRelease = ammoState.primary.clip; // 29

        // 2. Stray mouseup with no mousedown: MUST NOT fire
        ammoState.primary.clip = 30;
        frameCount = 7000;
        isShooting = false;
        handleTriggerRelease(false);
        const clipAfterStrayMouseUp = ammoState.primary.clip; // 30

        return {
            clipMultiPress,
            clipAfterMultiToSingleRelease,
            clipAfterStrayMouseUp
        };
    });

    assert(modeSwitchSafetyTest.clipAfterMultiToSingleRelease === 29, "Switching from multi to single while holding does NOT fire a rogue release shot");
    assert(modeSwitchSafetyTest.clipAfterStrayMouseUp === 30, "Stray mouseup without prior trigger press does NOT fire a ghost shot");

    console.log("\n--- Section 2.7: Round Reset & Clean State Recovery ---");
    const resetRoundTest = await page.evaluate(() => {
        createCryoZone(new THREE.Vector3(10, 0, 10), 'T', false, true);
        playerState.isFrozen = true;
        playerState.freezeTimer = 2.5;
        playerState.freezeImmuneTimer = 3.0;
        playerState.cryoHits = 4;
        playerState.binaryReleaseDueFrame = 12345;

        // Call resetRound()
        resetRound();

        const freezeStatus = document.getElementById('freeze-status');
        const freezeProg = document.getElementById('freeze-progress');

        return {
            cryoZonesLeft: activeCryoZones.length,
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            freezeImmuneTimer: playerState.freezeImmuneTimer,
            cryoHits: playerState.cryoHits,
            binaryReleaseDueFrame: playerState.binaryReleaseDueFrame,
            uiHidden: freezeStatus ? freezeStatus.classList.contains('hidden') : true,
            progWidth: freezeProg ? freezeProg.style.width : '',
            hasBTMaintained: playerState.hasBinaryTrigger
        };
    });

    assert(resetRoundTest.cryoZonesLeft === 0, "resetRound clears all activeCryoZones");
    assert(resetRoundTest.isFrozen === false, "resetRound resets isFrozen = false");
    assert(resetRoundTest.freezeTimer === 0, "resetRound resets freezeTimer = 0");
    assert(resetRoundTest.freezeImmuneTimer === 0, "resetRound resets freezeImmuneTimer = 0");
    assert(resetRoundTest.cryoHits === 0, "resetRound resets cryoHits = 0");
    assert(resetRoundTest.binaryReleaseDueFrame === 0, "resetRound resets binaryReleaseDueFrame = 0");
    assert(resetRoundTest.uiHidden === true, "resetRound hides freeze status UI overlay");
    assert(resetRoundTest.progWidth === '0%', "resetRound resets freeze progress bar width to 0%");

    assert(pageErrors.length === 0, `Zero page runtime errors during test run (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log("\n=== VERIFICATION FINISHED ===");
    if (failures === 0) {
        console.log("ALL CRYO CANISTER & BINARY TRIGGER TESTS PASSED SUCCESSFULLY!");
        process.exit(0);
    } else {
        console.error(`FAILED with ${failures} assertion failure(s).`);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error("Test runner encountered error:", err);
    process.exit(1);
});
