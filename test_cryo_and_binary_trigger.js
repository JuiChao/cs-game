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
            hasInnerMesh: !!z.innerMesh,
            hasCountdownSprite: !!z.countdownSprite,
            hasCountdownCanvas: !!z.countdownCanvas
        };
    });

    assert(zoneCreateTest.zoneCount >= 1, "createCryoZone adds zone to activeCryoZones");
    assert(zoneCreateTest.zoneHalfSize === 32.5, "Standard cryo zone halfSize is 32.5 (size 65, expanded from 45)");
    assert(zoneCreateTest.zoneLife === 11.0, "Cryo zone initial life is 11.0 seconds (8s + 3s)");
    assert(zoneCreateTest.hasMesh && zoneCreateTest.hasInnerMesh, "Cryo zone has outer mesh and inner ring mesh");
    assert(zoneCreateTest.hasCountdownSprite && zoneCreateTest.hasCountdownCanvas, "Cryo zone has circular countdown sprite & canvas above area");

    console.log("\n--- Section 1.3: Cryo Damage (Escalating +1 per 0.5s) & 2s Accumulation ---");
    const damageProgressionTest = await page.evaluate(() => {
        // Place zone at center, position player at center
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        playerState.hp = 100;
        playerState.isFrozen = false;
        playerState.freezeTimer = 0;
        playerState.freezeImmuneTimer = 0;
        playerState.cryoFreezeAccum = 0;
        playerState.cryoDamageTicks = 0;
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
            isFrozen: playerState.isFrozen,
            uiHidden: freezeStatus ? freezeStatus.classList.contains('hidden') : true
        });

        // Tick another 0.25s (total 0.5s): Tick 1 (3 base damage, hp 100 -> 97)
        updateCryoZones(0.25);
        snapshots.push({
            t: 0.5,
            hp: playerState.hp,
            isFrozen: playerState.isFrozen,
            uiHidden: freezeStatus ? freezeStatus.classList.contains('hidden') : true,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        });

        // Tick 0.5s (total 1.0s): Tick 2 (3 + 1 = 4 damage -> hp 93)
        updateCryoZones(0.5);
        snapshots.push({
            t: 1.0,
            hp: playerState.hp,
            progWidth: freezeProg ? freezeProg.style.width : ''
        });

        // Tick 0.5s (total 1.5s): Tick 3 (3 + 2 = 5 damage -> hp 88)
        updateCryoZones(0.5);
        snapshots.push({
            t: 1.5,
            hp: playerState.hp,
            progWidth: freezeProg ? freezeProg.style.width : ''
        });

        // Tick 0.5s (total 2.0s): Tick 4 (3 + 3 = 6 damage -> hp 82, stacked 2.0s -> FREEZE!)
        updateCryoZones(0.5);
        snapshots.push({
            t: 2.0,
            hp: playerState.hp,
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        });

        return snapshots;
    });

    assert(damageProgressionTest[0].hp === 100, "No damage dealt before 0.5s elapsed");
    assert(damageProgressionTest[1].hp === 97, "At 0.5s: Tick 1 deals 3 damage (hp 100 -> 97)");
    assert(damageProgressionTest[1].uiHidden === false, "At 0.5s: Freeze status UI overlay is visible");
    assert(damageProgressionTest[2].hp === 93, "At 1.0s: Tick 2 deals 4 damage (3+1), hp becomes 93");
    assert(damageProgressionTest[3].hp === 88, "At 1.5s: Tick 3 deals 5 damage (3+2), hp becomes 88");
    assert(damageProgressionTest[4].hp === 82, "At 2.0s: Tick 4 deals 6 damage (3+3), hp becomes 82");
    assert(damageProgressionTest[4].isFrozen === true, "Stacking 2.0s in cryo zone triggers isFrozen = true");
    assert(Math.abs(damageProgressionTest[4].freezeTimer - 3.0) < 0.001, "Freeze duration is set to exactly 3.0 seconds");
    assert(damageProgressionTest[4].progWidth === '100%', "Freeze progress bar is 100% when frozen");
    assert(damageProgressionTest[4].text.includes('已冰冻'), "Freeze status text shows '已冰冻!'");

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

    console.log("\n--- Section 1.5: 3s Freeze Duration & 5s Percentage Thaw Cooldown ---");
    const unfreezeImmunityTest = await page.evaluate(() => {
        // Player is currently frozen with freezeTimer = 3.0s, ensure zone stays active
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        activeCryoZones[0].life = 999;
        camera.position.set(0, 2, 0);

        playerState.isFrozen = true;
        playerState.freezeTimer = 3.0;
        playerState.freezeImmuneTimer = 0;
        playerState.cryoFreezeAccum = 0;
        playerState.cryoHits = 0;
        playerState.cryoDamageTimer = 0;
        playerState.cryoDamageTicks = 0;
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
        const freezeProg = document.getElementById('freeze-progress');
        const freezeText = document.getElementById('freeze-text');
        const stateAt3s = {
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer,
            freezeImmuneTimer: playerState.freezeImmuneTimer,
            cryoFreezeAccum: playerState.cryoFreezeAccum,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        };

        // Advance 2.5s while still in zone:
        // Immune timer decreases from 5.0 to 2.5s (50%)
        updateCryoZones(2.5);
        const stateDuringImmune = {
            isFrozen: playerState.isFrozen,
            immuneTimerLeft: playerState.freezeImmuneTimer,
            progWidth: freezeProg ? freezeProg.style.width : '',
            text: freezeText ? freezeText.innerText : ''
        };

        // Advance remaining 2.5s of immunity (total 5.0s immunity elapsed)
        updateCryoZones(2.5);
        const stateAfterImmunityExpires = {
            immuneTimer: playerState.freezeImmuneTimer
        };

        // Reset HP to 500 to prevent death from escalating damage, then advance 2.0s after immunity expired: accumulates 2s and freezes again!
        playerState.hp = 500;
        playerState.isSpectating = false;
        updateCryoZones(2.0);
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
    assert(Math.abs(unfreezeImmunityTest.stateAt3s.freezeImmuneTimer - 5.0) < 0.001, "Unfreezing grants exactly 5.0s thaw cooldown");
    assert(unfreezeImmunityTest.stateAt3s.progWidth === '100%', "Thaw cooldown progress starts at 100%");
    assert(unfreezeImmunityTest.stateAt3s.text.includes('解冻冷却'), "Thaw cooldown text displays '解冻冷却'");
    assert(unfreezeImmunityTest.stateDuringImmune.isFrozen === false, "Cannot be frozen while thaw cooldown is active");
    assert(unfreezeImmunityTest.stateDuringImmune.progWidth === '50%', "Thaw cooldown bar decreases to 50% after 2.5s (5s -> 2.5s)");
    assert(unfreezeImmunityTest.stateAfterImmunityExpires.immuneTimer === 0, "Thaw cooldown timer expires after 5.0s");
    assert(unfreezeImmunityTest.stateRefrozen.isFrozen === true, "Can be frozen again after 5s thaw cooldown passes");

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
                cryoFreezeAccum: 0,
                cryoHits: 0,
                cryoDamageTimer: 0,
                cryoDamageTicks: 0,
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
        b.cryoFreezeAccum = 0;
        b.cryoHits = 0;
        b.cryoDamageTimer = 0;
        b.cryoDamageTicks = 0;

        // Apply 2.0s of zone updates to bot (4 ticks: 3+4+5+6 = 18 dmg, 2s accumulation -> freeze!)
        updateCryoZones(2.0);
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

    assert(botCryoTest.botFrozen === true, "Bot in cryo zone becomes isFrozen = true after 2.0s accumulation");
    assert(botCryoTest.botHp === 82, "Bot took 18 escalating damage (3+4+5+6 = 18 dmg, hp 100 -> 82)");
    assert(botCryoTest.botUnfrozen === false, "Bot unfreezes after 3.0s");
    assert(Math.abs(botCryoTest.botImmuneTimer - 5.0) < 0.001, "Bot receives 5s thaw cooldown after unfreezing");

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
            cryoFreezeAccum: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            cryoDamageTicks: 0,
            stunTimer: 0,
            actionProgress: 180
        };
        bDefuse.mesh.position.set(102, 0, 100);
        bots = [bDefuse];

        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(100, 0, 100), 'T', false, true);
        activeCryoZones[0].life = 999;
        updateCryoZones(2.0);
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

    console.log("\n--- Section 1.8: Cryo Zone 60% Slowdown for Player and Bots ---");
    const slowTest = await page.evaluate(() => {
        playerState.hp = 100;
        playerState.isSpectating = false;
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        activeCryoZones[0].life = 999;

        // Test player speed multiplier in cryo zone
        playerState.isFrozen = false;
        playerState.inCryoZone = true;
        camera.position.set(0, 2, 0); // inside zone

        // Normal player move velocity check
        playerState.velocity.set(0, 0, 0);
        moveForward = true;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        updatePhysics(0.016);
        const playerVzInZone = playerState.velocity.z;

        // Move player outside cryo zone
        playerState.inCryoZone = false;
        camera.position.set(500, 2, 500); // outside zone
        playerState.velocity.set(0, 0, 0);
        updatePhysics(0.016);
        const playerVzOutside = playerState.velocity.z;

        moveForward = false;

        // Test bot speed multiplier in cryo zone
        const testBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 100,
            team: 'CT',
            inCryoZone: true,
            freezeTimer: 0
        };
        testBot.mesh.position.set(0, 0, 0); // inside zone
        const botSpeedInZone = botFreezeSpeedMult(testBot);
        testBot.inCryoZone = false;
        testBot.mesh.position.set(500, 0, 500); // outside zone
        const botSpeedOutside = botFreezeSpeedMult(testBot);

        return {
            playerVzInZone,
            playerVzOutside,
            playerRatio: playerVzInZone / playerVzOutside,
            botSpeedInZone,
            botSpeedOutside
        };
    });

    assert(Math.abs(slowTest.playerRatio - 0.4) < 0.05, `Player speed is reduced by 60% in cryo zone (ratio: ${slowTest.playerRatio.toFixed(3)})`);
    assert(slowTest.botSpeedInZone === 0.4, "Bot speed multiplier is exactly 0.4 (60% slow) in cryo zone");
    assert(slowTest.botSpeedOutside === 1.0, "Bot speed multiplier is 1.0 outside cryo zone");

    console.log("\n--- Section 1.9: Leaving Cryo Zone Removes Continuous Damage Effect ---");
    const exitZoneDamageTest = await page.evaluate(() => {
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        playerState.hp = 100;
        playerState.isFrozen = false;
        camera.position.set(0, 2, 0); // inside

        // Spend 1.0s in zone: 2 damage ticks, cryoDamageTicks becomes 2
        updateCryoZones(0.5);
        updateCryoZones(0.5);
        const hpAfterTicks = playerState.hp;
        const ticksInZone = playerState.cryoDamageTicks;

        // Step out of zone
        camera.position.set(300, 2, 300);
        updateCryoZones(1.0); // 1.0s outside zone
        const hpOutside = playerState.hp;
        const ticksAfterExit = playerState.cryoDamageTicks;

        return {
            hpAfterTicks,
            ticksInZone,
            hpOutside,
            ticksAfterExit
        };
    });

    assert(exitZoneDamageTest.ticksInZone === 2, "Cryo damage ticks stacked to 2 while in zone");
    assert(exitZoneDamageTest.hpOutside === exitZoneDamageTest.hpAfterTicks, "Zero damage dealt after stepping out of cryo zone");
    assert(exitZoneDamageTest.ticksAfterExit === 0, "CryoDamageTicks reset to 0 after exiting zone");

    console.log("\n--- Section 1.10: Enemy Freeze Progress HUD and '敌人已冻结' Prompt ---");
    const enemyFreezeHUDTest = await page.evaluate(() => {
        activeCryoZones.length = 0;
        // Player throws cryo grenade (isPlayer = true)
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, true);
        playerState.team = 'CT';

        const enemyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 1000,
            team: 'T', // enemy
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            cryoDamageTicks: 0,
            stunTimer: 0
        };
        enemyBot.mesh.position.set(0, 0, 0);
        bots = [enemyBot];

        const eFreezeStatus = document.getElementById('enemy-freeze-status');
        const eFreezeProg = document.getElementById('enemy-freeze-progress');
        const eFreezeText = document.getElementById('enemy-freeze-text');

        // Tick 1.0s (50% accumulated):
        updateCryoZones(1.0);
        const hudAt1_0s = {
            hidden: eFreezeStatus ? eFreezeStatus.classList.contains('hidden') : true,
            width: eFreezeProg ? eFreezeProg.style.width : '',
            text: eFreezeText ? eFreezeText.innerText : ''
        };

        // Tick another 1.0s (total 2.0s -> enemy frozen!):
        updateCryoZones(1.0);
        const hudAt2_0s = {
            isEnemyFrozen: enemyBot.isFrozen,
            hidden: eFreezeStatus ? eFreezeStatus.classList.contains('hidden') : true,
            width: eFreezeProg ? eFreezeProg.style.width : '',
            text: eFreezeText ? eFreezeText.innerText : ''
        };

        const generalAnnouncement = document.getElementById('general-announcement');
        const announcementText = generalAnnouncement ? generalAnnouncement.innerText : '';

        return {
            hudAt1_0s,
            hudAt2_0s,
            announcementText
        };
    });

    assert(enemyFreezeHUDTest.hudAt1_0s.hidden === false, "Enemy freeze status HUD is visible while enemy accumulates freeze");
    assert(enemyFreezeHUDTest.hudAt1_0s.width === '50%', "Enemy freeze progress shows 50% at 1.0s");
    assert(enemyFreezeHUDTest.hudAt1_0s.text.includes('50%'), "Enemy freeze text displays '50%'");
    assert(enemyFreezeHUDTest.hudAt2_0s.isEnemyFrozen === true, "Enemy bot becomes frozen at 2.0s");
    assert(enemyFreezeHUDTest.hudAt2_0s.text.includes('敌人已冻结'), "Enemy freeze HUD displays '敌人已冻结'");
    assert(enemyFreezeHUDTest.announcementText.includes('敌人已冻结'), "Screen announcement displays '敌人已冻结'");

    console.log("\n--- Section 1.10b: Friendly Bot Safety & Player Death/Spectator HUD Hide ---");
    const friendlyAndDeathHUDTest = await page.evaluate(() => {
        // Clear announcement and zones
        const announcementEl = document.getElementById('general-announcement');
        if (announcementEl) announcementEl.innerText = '';
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, true); // player throw
        playerState.team = 'CT';
        playerState.hp = 100;
        playerState.isSpectating = false;

        // Friendly teammate bot (CT)
        const friendlyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 1000,
            team: 'CT', // friendly teammate!
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            cryoDamageTicks: 0,
            stunTimer: 0
        };
        friendlyBot.mesh.position.set(0, 0, 0);
        bots = [friendlyBot];

        // 2 seconds in zone: friendly bot gets frozen by cryo effect
        updateCryoZones(2.0);
        const friendlyFrozen = friendlyBot.isFrozen;
        const friendlyAccumFromPlayer = friendlyBot.cryoAccumFromPlayer;
        const friendlyFrozenByPlayer = friendlyBot.frozenByPlayer;
        const announcementAfterFriendly = announcementEl ? announcementEl.innerText : '';
        const eFreezeStatus = document.getElementById('enemy-freeze-status');
        const hudVisibleForFriendly = eFreezeStatus ? !eFreezeStatus.classList.contains('hidden') : false;

        // Now test player death hiding enemy freeze HUD
        const enemyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 1000,
            team: 'T', // enemy
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            cryoDamageTicks: 0,
            stunTimer: 0
        };
        enemyBot.mesh.position.set(0, 0, 0);
        bots = [enemyBot];
        updateCryoZones(1.0); // enemy accumulates 50%
        const hudVisibleBeforeDeath = eFreezeStatus ? !eFreezeStatus.classList.contains('hidden') : false;

        playerState.hp = 0; // player dies
        updateCryoZones(0.1);
        const hudHiddenAfterDeath = eFreezeStatus ? eFreezeStatus.classList.contains('hidden') : true;

        playerState.hp = 100;
        playerState.isSpectating = true; // player spectating
        updateCryoZones(0.1);
        const hudHiddenWhileSpectating = eFreezeStatus ? eFreezeStatus.classList.contains('hidden') : true;

        playerState.isSpectating = false;

        return {
            friendlyFrozen,
            friendlyAccumFromPlayer: !!friendlyAccumFromPlayer,
            friendlyFrozenByPlayer: !!friendlyFrozenByPlayer,
            announcementAfterFriendly,
            hudVisibleForFriendly,
            hudVisibleBeforeDeath,
            hudHiddenAfterDeath,
            hudHiddenWhileSpectating
        };
    });

    assert(friendlyAndDeathHUDTest.friendlyFrozen === true, "Friendly bot is frozen by cryo zone");
    assert(friendlyAndDeathHUDTest.friendlyAccumFromPlayer === false, "Friendly bot DOES NOT set cryoAccumFromPlayer");
    assert(friendlyAndDeathHUDTest.friendlyFrozenByPlayer === false, "Friendly bot DOES NOT set frozenByPlayer");
    assert(!friendlyAndDeathHUDTest.announcementAfterFriendly.includes('敌人已冻结'), "Freezing friendly bot DOES NOT announce '敌人已冻结'");
    assert(friendlyAndDeathHUDTest.hudVisibleForFriendly === false, "Enemy freeze HUD remains hidden for friendly bots");
    assert(friendlyAndDeathHUDTest.hudVisibleBeforeDeath === true, "Enemy freeze HUD visible when enemy accumulates");
    assert(friendlyAndDeathHUDTest.hudHiddenAfterDeath === true, "Enemy freeze HUD hides when player hp <= 0");
    assert(friendlyAndDeathHUDTest.hudHiddenWhileSpectating === true, "Enemy freeze HUD hides when player is spectating");

    console.log("\n--- Section 1.10c: Bot Fatal Cryo Damage & No Post-Mortem Freeze ---");
    const fatalBotCryoTest = await page.evaluate(() => {
        const announcementEl = document.getElementById('general-announcement');
        if (announcementEl) announcementEl.innerText = '';
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, true); // player throw
        playerState.team = 'CT';
        playerState.hp = 100;
        playerState.isSpectating = false;

        // Bot with 3 hp (will die on tick 1)
        const lowHpBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 3,
            team: 'T',
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 1.9, // almost frozen
            cryoHits: 5,
            cryoDamageTimer: 0.45,
            cryoDamageTicks: 0,
            stunTimer: 0
        };
        lowHpBot.mesh.position.set(0, 0, 0);
        bots = [lowHpBot];

        // 0.1s delta: damage timer hits 0.5s -> deals 3 dmg -> bot dies
        updateCryoZones(0.1);

        const botDied = (lowHpBot.hp <= 0 || lowHpBot.isDead || bots.length === 0);
        const postMortemFrozen = lowHpBot.isFrozen;
        const postMortemAnnouncement = announcementEl ? announcementEl.innerText : '';

        return {
            botDied,
            postMortemFrozen,
            postMortemAnnouncement
        };
    });

    assert(fatalBotCryoTest.botDied === true, "Low-hp bot dies from cryo damage");
    assert(fatalBotCryoTest.postMortemFrozen === false, "Dead bot is NOT frozen post-mortem");
    assert(!fatalBotCryoTest.postMortemAnnouncement.includes('敌人已冻结'), "Dead bot DOES NOT trigger '敌人已冻结' announcement");

    console.log("\n--- Section 1.10d: Overlapping Cryo Zones (Standard + Drone & Bot + Player Priority) ---");
    const overlappingZonesTest = await page.evaluate(() => {
        activeCryoZones.length = 0;
        playerState.hp = 100;
        playerState.team = 'CT';
        playerState.isSpectating = false;

        // Zone 0: Bot-thrown, standard 1.0x (isPlayer: false, isFromDrone: false)
        createCryoZone(new THREE.Vector3(0, 0, 0), 'T', false, false);
        // Zone 1: Player-thrown, drone enhanced 1.1x (isPlayer: true, isFromDrone: true)
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', true, true);

        const enemyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 100,
            team: 'T',
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 0,
            cryoHits: 0,
            cryoDamageTimer: 0,
            cryoDamageTicks: 0,
            cryoAccumFromPlayer: false,
            frozenByPlayer: false
        };
        enemyBot.mesh.position.set(0, 0, 0);
        bots = [enemyBot];

        // Tick 0.5s: First damage tick in overlapping zone
        updateCryoZones(0.5);
        const botHpAfterTick1 = enemyBot.hp; // 3 * 1.1 = Math.ceil(3.3) = 4 dmg -> 96 HP
        const botAccumFromPlayer = enemyBot.cryoAccumFromPlayer;
        const eFreezeProg = document.getElementById('enemy-freeze-progress');
        const hudWidthAt0_5s = eFreezeProg ? eFreezeProg.style.width : '';

        // Tick another 1.5s (total 2.0s): 2.0s accumulation reached -> frozen!
        updateCryoZones(1.5);
        const botFrozenAt2s = enemyBot.isFrozen;
        const botFrozenByPlayer = enemyBot.frozenByPlayer;
        const eFreezeText = document.getElementById('enemy-freeze-text');
        const hudTextAt2s = eFreezeText ? eFreezeText.innerText : '';
        const announcementEl = document.getElementById('general-announcement');
        const announcementAt2s = announcementEl ? announcementEl.innerText : '';

        // Player overlapping test
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(50, 0, 50), 'T', false, false); // normal
        createCryoZone(new THREE.Vector3(50, 0, 50), 'T', true, false);  // drone
        camera.position.set(50, 2, 50);
        playerState.hp = 100;
        playerState.cryoDamageTimer = 0;
        playerState.cryoDamageTicks = 0;
        playerState.inCryoZone = false;
        updateCryoZones(0.5);
        const playerHpAfterTick1 = playerState.hp; // 100 - 4 = 96

        return {
            botHpAfterTick1,
            botAccumFromPlayer,
            hudWidthAt0_5s,
            botFrozenAt2s,
            botFrozenByPlayer,
            hudTextAt2s,
            announcementAt2s,
            playerHpAfterTick1
        };
    });

    assert(overlappingZonesTest.botHpAfterTick1 === 96, "Bot in overlapping normal + drone zones receives 1.1x drone damage (100 -> 96 HP)");
    assert(overlappingZonesTest.botAccumFromPlayer === true, "Bot in overlapping bot + player zones correctly sets cryoAccumFromPlayer");
    assert(overlappingZonesTest.hudWidthAt0_5s === '25%', "Enemy freeze HUD shows 25% progress at 0.5s in overlapping zone");
    assert(overlappingZonesTest.botFrozenAt2s === true, "Bot in overlapping zones reaches full freeze at 2.0s");
    assert(overlappingZonesTest.botFrozenByPlayer === true, "Bot in overlapping zones sets frozenByPlayer = true");
    assert(overlappingZonesTest.hudTextAt2s.includes('敌人已冻结'), "Enemy freeze HUD displays '敌人已冻结' in overlapping zone");
    assert(overlappingZonesTest.announcementAt2s.includes('敌人已冻结'), "Announcement displays '敌人已冻结' in overlapping zone");
    assert(overlappingZonesTest.playerHpAfterTick1 === 96, "Player in overlapping normal + drone zones receives 1.1x drone damage (100 -> 96 HP)");

    console.log("\n--- Section 1.11: Circular Countdown Sprite and Shrinking Arc Above Zone ---");
    const countdownVisualTest = await page.evaluate(() => {
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(0, 0, 0), 'CT', false, false);
        const z = activeCryoZones[0];

        const initialLife = z.life;
        const spriteY = z.countdownSprite.position.y;

        // Advance 4.0s
        updateCryoZones(4.0);
        const lifeAt4s = z.life;

        return {
            initialLife,
            spriteY,
            lifeAt4s,
            maxLife: z.maxLife
        };
    });

    assert(countdownVisualTest.initialLife === 11.0, "Cryo zone countdown starts at 11.0s");
    assert(countdownVisualTest.spriteY > 2.0, "Countdown sprite floats above zone ground (Y > 2.0)");
    assert(Math.abs(countdownVisualTest.lifeAt4s - 7.0) < 0.01, "Countdown decreases to 7.0s after 4s elapsed");

    console.log("\n--- Section 1.12: Grenade Explosion, Molotov & Cryo Area Particle Effects ---");
    const particleEffectsTest = await page.evaluate(() => {
        particles.length = 0;
        const pCountBefore = particles.length;

        // 1. Grenade explosion particles
        createGrenadeExplosionParticles(new THREE.Vector3(10, 1, 10));
        const pCountAfterGrenade = particles.length;

        // 2. Molotov area particles
        activeFires.length = 0;
        const fireMesh = new THREE.Mesh(new THREE.PlaneGeometry(45, 45), new THREE.MeshBasicMaterial());
        activeFires.push({
            mesh: fireMesh,
            life: 7.0,
            x: 0,
            z: 0,
            isFromDrone: false
        });
        frameCount = 2; // trigger frameCount % 2 === 0
        updateFires(0.016);
        const pCountAfterMolotov = particles.length;

        // 3. Cryo zone particles
        activeCryoZones.length = 0;
        createCryoZone(new THREE.Vector3(50, 0, 50), 'CT', false, false);
        frameCount = 4;
        updateCryoZones(0.016);
        const pCountAfterCryo = particles.length;

        return {
            pCountBefore,
            pCountAfterGrenade,
            pCountAfterMolotov,
            pCountAfterCryo
        };
    });

    assert(particleEffectsTest.pCountAfterGrenade >= 14, "Grenade explosion spawns lightweight particle burst (>= 14 particles)");
    assert(particleEffectsTest.pCountAfterMolotov > particleEffectsTest.pCountAfterGrenade, "Molotov zone generates rising fire particles");
    assert(particleEffectsTest.pCountAfterCryo > particleEffectsTest.pCountAfterMolotov, "Cryo zone generates rising frost particles");

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
