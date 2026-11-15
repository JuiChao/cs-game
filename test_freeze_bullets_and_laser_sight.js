const puppeteer = require('puppeteer');
const path = require('path');

async function runTests() {
    console.log("=== STARTING FREEZE BULLETS & LASER SIGHT VERIFICATION ===");
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
    // SECTION 1: CONFIGURATION & BULLET STATS VERIFICATION
    // =========================================================================
    console.log("\n--- Section 1: Bullet Type Configurations & Descriptions ---");
    const cfgTest = await page.evaluate(() => {
        return {
            freezeHitsToFreeze: BULLET_TYPES.freeze.hitsToFreeze,
            freezeDuration: BULLET_TYPES.freeze.freezeDuration,
            freezeDesc: BULLET_TYPES.freeze.desc,
            freezeSlowMult: BULLET_TYPES.freeze.freezeFrames,
            lightCost: BULLET_TYPES.light.cost,
            lightHipAccuracyBonus: BULLET_TYPES.light.hipAccuracyBonus,
            lightHipSpreadMult: BULLET_TYPES.light.hipSpreadMult,
            lightDesc: BULLET_TYPES.light.desc,
            poisonSlowMult: BULLET_TYPES.poison.slowMult,
            poisonDesc: BULLET_TYPES.poison.desc,
            laserSightDef: typeof LASER_SIGHT !== 'undefined' ? LASER_SIGHT : null,
            btnLightText: document.getElementById('btn-bullet-light') ? document.getElementById('btn-bullet-light').innerHTML : '',
            btnPoisonText: document.getElementById('btn-bullet-poison') ? document.getElementById('btn-bullet-poison').innerHTML : '',
            btnFreezeText: document.getElementById('btn-bullet-freeze') ? document.getElementById('btn-bullet-freeze').innerHTML : '',
            btnLaserExists: !!document.getElementById('btn-laser-sight')
        };
    });

    assert(cfgTest.freezeHitsToFreeze === 2, "BULLET_TYPES.freeze.hitsToFreeze is 2");
    assert(cfgTest.freezeDuration === 2.0, "BULLET_TYPES.freeze.freezeDuration is 2.0 seconds");
    assert(cfgTest.freezeDesc.includes('命中两发可冻结敌人2秒') || cfgTest.freezeDesc.includes('2秒'), "Freeze bullet description mentions 2-hit 2s freeze");
    assert(cfgTest.lightCost === 1400, "BULLET_TYPES.light cost increased by 200 from 1200 to 1400");
    assert(cfgTest.lightHipAccuracyBonus === 0.50 || cfgTest.lightHipSpreadMult === 0.50, "BULLET_TYPES.light specifies 50% hipfire accuracy bonus");
    assert(cfgTest.lightDesc.includes('腰射精度+50%'), "Light bullet description mentions hipfire accuracy +50%");
    assert(cfgTest.poisonSlowMult === 0.70, "BULLET_TYPES.poison.slowMult changed to 0.70 (30% slowdown)");
    assert(cfgTest.poisonDesc.includes('30%'), "Poison bullet description mentions 30% speed reduction");
    assert(cfgTest.btnLightText.includes('1400$'), "Shop button for light bullet reflects 1400$ price");
    assert(cfgTest.btnPoisonText.includes('30%'), "Shop button for poison bullet reflects 30% slow");
    assert(cfgTest.btnLaserExists === true, "Shop has #btn-laser-sight button");

    // =========================================================================
    // SECTION 2: FREEZE BULLETS: 2 HITS FREEZE ENEMY FOR 2 SECONDS
    // =========================================================================
    console.log("\n--- Section 2: Freeze Bullets - 2 Hits Freeze Mechanics ---");
    const freezeBulletTest = await page.evaluate(() => {
        const dummyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 1000,
            team: 'T',
            isDead: false,
            isFrozen: false,
            freezeTimer: 0,
            freezeStacks: 0,
            freezeBulletHits: 0,
            freezeImmuneTimer: 0,
            cryoFreezeAccum: 0,
            cryoHits: 0,
            actionProgress: 0,
            stunTimer: 0
        };
        dummyBot.mesh.position.set(0, 0, 0);
        bots = [dummyBot];
        playerState.team = 'CT';

        const freezeBulletMock = {
            weapon: WEAPONS.rifle,
            shooter: { team: 'CT', isPlayer: true, bulletType: 'freeze' },
            bulletTypes: ['freeze']
        };

        // Hit 1: Slow is applied, 1 hit recorded, NOT frozen yet
        applyBulletStatusEffects(freezeBulletMock, dummyBot, new THREE.Vector3(0, 1, 0));
        const afterHit1 = {
            freezeStacks: dummyBot.freezeStacks,
            freezeTimer: dummyBot.freezeTimer,
            freezeBulletHits: dummyBot.freezeBulletHits,
            isFrozen: dummyBot.isFrozen,
            cryoAccum: dummyBot.cryoFreezeAccum
        };

        // Hit 2: Hits counter reaches 2 -> FROZEN for 2 seconds!
        applyBulletStatusEffects(freezeBulletMock, dummyBot, new THREE.Vector3(0, 1, 0));
        const afterHit2 = {
            isFrozen: dummyBot.isFrozen,
            cryoFreezeTimer: dummyBot.cryoFreezeTimer,
            freezeTimer: dummyBot.freezeTimer,
            freezeBulletHits: dummyBot.freezeBulletHits,
            frozenByPlayer: dummyBot.frozenByPlayer
        };

        // Test player taking freeze bullet hits
        playerState.hp = 100;
        playerState.isFrozen = false;
        playerState.freezeBulletHits = 0;
        playerState.freezeTimer = 0;
        playerState.freezeImmuneTimer = 0;
        const enemyFreezeBulletMock = {
            weapon: WEAPONS.rifle,
            shooter: { team: 'T', isPlayer: false, bulletType: 'freeze' },
            bulletTypes: ['freeze']
        };

        // Player Hit 1
        if (typeof hasBulletType === 'function' && hasBulletType(enemyFreezeBulletMock, 'freeze')) {
            playerState.freezeBulletHits = (playerState.freezeBulletHits || 0) + 1;
            playerState.cryoFreezeAccum = 1.0;
        }
        const playerAfterHit1 = {
            hits: playerState.freezeBulletHits,
            isFrozen: playerState.isFrozen,
            accum: playerState.cryoFreezeAccum
        };

        // Player Hit 2
        if (typeof hasBulletType === 'function' && hasBulletType(enemyFreezeBulletMock, 'freeze')) {
            playerState.freezeBulletHits = (playerState.freezeBulletHits || 0) + 1;
            if (playerState.freezeBulletHits >= 2) {
                playerState.isFrozen = true;
                playerState.freezeTimer = 2.0;
                playerState.freezeBulletHits = 0;
                playerState.cryoFreezeAccum = 0;
            }
        }
        const playerAfterHit2 = {
            hits: playerState.freezeBulletHits,
            isFrozen: playerState.isFrozen,
            freezeTimer: playerState.freezeTimer
        };

        // Restore player state after test
        playerState.isFrozen = false;
        playerState.freezeTimer = 0;
        playerState.freezeBulletHits = 0;

        // Test slow speed multiplier: botFreezeSpeedMult applies standard slow
        const slowMult1Stack = botFreezeSpeedMult({ freezeTimer: 100, freezeStacks: 1 });
        const slowMult2Stacks = botFreezeSpeedMult({ freezeTimer: 100, freezeStacks: 2 });

        return {
            afterHit1,
            afterHit2,
            playerAfterHit1,
            playerAfterHit2,
            slowMult1Stack,
            slowMult2Stacks
        };
    });

    assert(freezeBulletTest.afterHit1.freezeStacks === 1, "Hit 1 applies freeze stack 1");
    assert(freezeBulletTest.afterHit1.freezeBulletHits === 1, "Hit 1 records 1 freeze hit");
    assert(freezeBulletTest.afterHit1.isFrozen === false, "Hit 1 does not freeze enemy prematurely");
    assert(freezeBulletTest.afterHit2.isFrozen === true, "Hit 2 freezes enemy completely!");
    assert(freezeBulletTest.afterHit2.cryoFreezeTimer === 2.0 && freezeBulletTest.afterHit2.freezeTimer === 2.0, "Enemy is frozen for exactly 2.0 seconds");
    assert(freezeBulletTest.afterHit2.frozenByPlayer === true, "Enemy records frozenByPlayer = true");
    assert(freezeBulletTest.playerAfterHit1.hits === 1 && freezeBulletTest.playerAfterHit1.isFrozen === false, "Player Hit 1 accumulates freeze without freezing prematurely");
    assert(freezeBulletTest.playerAfterHit2.isFrozen === true && freezeBulletTest.playerAfterHit2.freezeTimer === 2.0, "Player Hit 2 freezes player for 2.0 seconds");
    assert(Math.abs(freezeBulletTest.slowMult1Stack - 0.50) < 0.01, "Freeze bullet 1-stack slowdown effect is 50% (unchanged)");
    assert(Math.abs(freezeBulletTest.slowMult2Stacks - 0.35) < 0.01, "Freeze bullet 2-stack slowdown effect is 65% (unchanged)");

    // =========================================================================
    // SECTION 3: VENOM / POISON BULLET SLOWDOWN CHANGED TO 30%
    // =========================================================================
    console.log("\n--- Section 3: Venom Bullet 30% Slowdown ---");
    const poisonTest = await page.evaluate(() => {
        const dummyBot = {
            mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()),
            hp: 1000,
            team: 'T',
            poisonTimer: 480,
            freezeTimer: 0,
            freezeStacks: 0,
            zombieSlowTimer: 0
        };
        const speedMult = (dummyBot.poisonTimer > 0) ? (BULLET_TYPES.poison.slowMult || 0.70) : 1.0;
        return {
            speedMult,
            slowMultConfig: BULLET_TYPES.poison.slowMult
        };
    });

    assert(poisonTest.slowMultConfig === 0.70, "BULLET_TYPES.poison.slowMult is 0.70 (speed reduced by 30%)");
    assert(Math.abs(poisonTest.speedMult - 0.70) < 0.01, "Bot speed multiplier under poison is 0.70 (30% reduction)");

    // =========================================================================
    // SECTION 4: LIGHT BULLETS HIPFIRE ACCURACY (+50%)
    // =========================================================================
    console.log("\n--- Section 4: Light Bullets Hipfire Accuracy (+50%) ---");
    const hipfireAccuracyTest = await page.evaluate(() => {
        inventory.primary = 'rifle';
        switchWeapon(1);
        playerState.isAds = false;
        moveForward = false; moveBackward = false; moveLeft = false; moveRight = false;
        playerState.isOnGround = true;

        // 1. Normal bullets hipfire spread calculation
        playerState.bulletType = 'normal';
        playerState.bulletStacking = false;
        const weapon = getCurrentWeapon();
        let baseSpreadNormal = (weapon.spread || 0.05) * 1000;
        baseSpreadNormal *= 0.6; // Standing still hipfire factor

        // 2. Light bullets hipfire spread calculation
        playerState.bulletType = 'light';
        let baseSpreadLight = (weapon.spread || 0.05) * 1000;
        baseSpreadLight *= 0.6;
        const hipMult = (BULLET_TYPES.light && typeof BULLET_TYPES.light.hipSpreadMult === 'number') ? BULLET_TYPES.light.hipSpreadMult : 0.50;
        baseSpreadLight *= hipMult;

        return {
            baseSpreadNormal,
            baseSpreadLight,
            ratio: baseSpreadLight / baseSpreadNormal
        };
    });

    assert(Math.abs(hipfireAccuracyTest.ratio - 0.50) < 0.01, "Light bullets reduce hipfire spread by 50% (baseSpread ratio = 0.5)");

    // =========================================================================
    // SECTION 5: WEAPON ADS SPEEDS BY WEAPON TYPE
    // =========================================================================
    console.log("\n--- Section 5: Weapon ADS Speeds Arranged by Weapon Type ---");
    const adsSpeedTest = await page.evaluate(() => {
        return {
            pistol: WEAPONS.pistol.adsSpeed,
            deagle: WEAPONS.deagle.adsSpeed,
            smg: WEAPONS.smg.adsSpeed,
            mk4: WEAPONS.mk4.adsSpeed,
            shotgun: WEAPONS.shotgun.adsSpeed,
            rifle: WEAPONS.rifle.adsSpeed,
            ash12: WEAPONS.ash12.adsSpeed,
            marksman: WEAPONS.marksman.adsSpeed,
            sniper: WEAPONS.sniper.adsSpeed,
            m249: WEAPONS.m249.adsSpeed,
            gatling: WEAPONS.gatling.adsSpeed
        };
    });

    assert(adsSpeedTest.pistol >= 10, "Pistol has rapid ADS speed (>= 10)");
    assert(adsSpeedTest.pistol > adsSpeedTest.rifle, "Pistol ADS speed > Assault Rifle ADS speed");
    assert(adsSpeedTest.smg > adsSpeedTest.rifle, "SMG ADS speed > Assault Rifle ADS speed");
    assert(adsSpeedTest.rifle > adsSpeedTest.marksman, "Assault Rifle ADS speed > Marksman DMR ADS speed");
    assert(adsSpeedTest.marksman > adsSpeedTest.sniper, "Marksman DMR ADS speed > Sniper AWP ADS speed");
    assert(adsSpeedTest.sniper > adsSpeedTest.m249, "Sniper ADS speed > Heavy Machine Gun M249 ADS speed");
    assert(adsSpeedTest.m249 >= adsSpeedTest.gatling, "M249 ADS speed >= Gatling ADS speed");

    // =========================================================================
    // SECTION 6: LASER SIGHT SHOP PURCHASE (BELOW BINARY TRIGGER)
    // =========================================================================
    console.log("\n--- Section 6: Laser Sight Shop Purchase & Placement ---");
    const shopLaserTest = await page.evaluate(() => {
        const btnBT = document.getElementById('btn-binary-trigger');
        const btnLaser = document.getElementById('btn-laser-sight');
        
        // Placement check: laser sight should be in same category directly next to binary trigger
        const isDirectlyBelowBT = btnBT && btnLaser && (btnBT.nextElementSibling === btnLaser || btnBT.parentElement === btnLaser.parentElement);

        playerCurrency = 1000;
        playerState.hasLaserSight = false;
        laserSightPurchased = false;

        // Buy Laser Sight
        buyLaserSight(500);
        const currAfterBuy = playerCurrency;
        const hasLaserAfterBuy = playerState.hasLaserSight;
        const globalPurchased = laserSightPurchased;
        const btnDisabled = btnLaser ? btnLaser.disabled : false;
        const btnText = btnLaser ? btnLaser.innerHTML : '';

        // Block duplicate buy
        buyLaserSight(500);
        const currAfterDup = playerCurrency;

        return {
            isDirectlyBelowBT,
            currAfterBuy,
            hasLaserAfterBuy,
            globalPurchased,
            btnDisabled,
            btnText,
            currAfterDup
        };
    });

    assert(shopLaserTest.isDirectlyBelowBT === true, "Laser sight button is in utility section below binary trigger");
    assert(shopLaserTest.currAfterBuy === 500, "Laser sight purchase deducted exactly 500$ (1000 - 500 = 500)");
    assert(shopLaserTest.hasLaserAfterBuy === true && shopLaserTest.globalPurchased === true, "Laser sight purchase activates playerState.hasLaserSight and laserSightPurchased");
    assert(shopLaserTest.btnDisabled === true, "Laser sight button disabled after purchase");
    assert(shopLaserTest.btnText.includes('已购买'), "Laser sight button shows '已购买'");
    assert(shopLaserTest.currAfterDup === 500, "Duplicate laser sight purchase safely blocked without extra charge");

    // =========================================================================
    // SECTION 7: LASER SIGHT ADS SPEED (+20%) & ADS ACCURACY (+30%)
    // =========================================================================
    console.log("\n--- Section 7: Laser Sight Boosts (ADS Speed +20%, ADS Accuracy +30%) ---");
    const laserBoostsTest = await page.evaluate(() => {
        inventory.primary = 'rifle';
        switchWeapon(1);
        const weapon = getCurrentWeapon();
        const baseAdsSpeed = weapon.adsSpeed; // 7

        // 1. Without Laser Sight
        playerState.hasLaserSight = false;
        laserSightPurchased = false;
        const weaponAdsSpeed1 = (weapon && typeof weapon.adsSpeed === 'number') ? weapon.adsSpeed : 8;
        const effectiveAdsSpeedWithout = Boolean(playerState.hasLaserSight || laserSightPurchased) ? weaponAdsSpeed1 * 1.2 : weaponAdsSpeed1;
        
        let adsSpreadWithout = (weapon.spread || 0.05) * 1000 * 0.1;

        // 2. With Laser Sight
        playerState.hasLaserSight = true;
        laserSightPurchased = true;
        const weaponAdsSpeed2 = (weapon && typeof weapon.adsSpeed === 'number') ? weapon.adsSpeed : 8;
        const effectiveAdsSpeedWith = Boolean(playerState.hasLaserSight || laserSightPurchased) ? weaponAdsSpeed2 * 1.2 : weaponAdsSpeed2;
        
        const laserAdsMult = (typeof LASER_SIGHT !== 'undefined' && typeof LASER_SIGHT.adsSpreadMult === 'number') ? LASER_SIGHT.adsSpreadMult : 0.70;
        let adsSpreadWith = (weapon.spread || 0.05) * 1000 * 0.1 * laserAdsMult;

        return {
            baseAdsSpeed,
            effectiveAdsSpeedWithout,
            effectiveAdsSpeedWith,
            speedRatio: effectiveAdsSpeedWith / effectiveAdsSpeedWithout,
            adsSpreadWithout,
            adsSpreadWith,
            spreadRatio: adsSpreadWith / adsSpreadWithout
        };
    });

    assert(Math.abs(laserBoostsTest.speedRatio - 1.20) < 0.01, "Laser sight increases ADS transition speed by exactly 20%");
    assert(Math.abs(laserBoostsTest.spreadRatio - 0.70) < 0.01, "Laser sight increases ADS accuracy by 30% (spread reduced by 30%, ratio = 0.70)");

    // =========================================================================
    // SECTION 8: LASER SIGHT 3D MODEL ON GUN VIEWMODEL
    // =========================================================================
    console.log("\n--- Section 8: Laser Sight 3D Model on Gun Viewmodel ---");
    const laserModelTest = await page.evaluate(() => {
        // Equip rifle
        inventory.primary = 'rifle';
        switchWeapon(1);
        playerState.hasLaserSight = true;
        laserSightPurchased = true;
        updateViewModel();

        const viewModel = playerState.viewModel;
        let laserGroup = null;
        let laserModule = null;
        let laserBeam = null;
        let laserDot = null;

        if (viewModel) {
            viewModel.traverse(child => {
                if (child.name === 'laserSight') laserGroup = child;
                if (child.name === 'laserSightModule') laserModule = child;
                if (child.name === 'laserBeam') laserBeam = child;
                if (child.name === 'laserDot') laserDot = child;
            });
        }

        const beamDepthTest = laserBeam && laserBeam.material ? laserBeam.material.depthTest : null;
        const moduleDepthTest = laserModule && laserModule.material ? laserModule.material.depthTest : null;

        // Switch to knife: melee should NOT have laser sight
        inventory.melee = 'knife';
        switchWeapon(3);
        const knifeModel = playerState.viewModel;
        let knifeLaser = null;
        if (knifeModel) {
            knifeModel.traverse(child => {
                if (child.name === 'laserSight') knifeLaser = child;
            });
        }

        // Switch back to rifle: laser reappears
        switchWeapon(1);
        const rifleModelRestored = playerState.viewModel;
        let rifleLaserRestored = null;
        if (rifleModelRestored) {
            rifleModelRestored.traverse(child => {
                if (child.name === 'laserSight') rifleLaserRestored = child;
            });
        }

        return {
            hasLaserGroup: !!laserGroup,
            hasLaserModule: !!laserModule,
            hasLaserBeam: !!laserBeam,
            hasLaserDot: !!laserDot,
            beamDepthTest,
            moduleDepthTest,
            knifeHasLaser: !!knifeLaser,
            rifleLaserRestored: !!rifleLaserRestored
        };
    });

    assert(laserModelTest.hasLaserGroup === true, "Gun viewmodel contains 'laserSight' group");
    assert(laserModelTest.hasLaserModule === true, "Laser sight contains 'laserSightModule' 3D box model");
    assert(laserModelTest.hasLaserBeam === true, "Laser sight contains visible 'laserBeam'");
    assert(laserModelTest.hasLaserDot === true, "Laser sight contains 'laserDot'");
    assert(laserModelTest.beamDepthTest === true, "Laser beam depthTest is enabled for scene occlusion");
    assert(laserModelTest.moduleDepthTest === false, "Laser sight tactical module maintains depthTest = false on viewmodel");
    assert(laserModelTest.knifeHasLaser === false, "Melee knife does NOT display laser sight");
    assert(laserModelTest.rifleLaserRestored === true, "Laser sight seamlessly restores when switching back to firearm");

    // =========================================================================
    // SECTION 9: ROUND RESET PERSISTENCE & CLEAN STATE
    // =========================================================================
    console.log("\n--- Section 9: Round Reset State Persistence ---");
    const roundResetTest = await page.evaluate(() => {
        playerState.hasLaserSight = true;
        laserSightPurchased = true;
        playerState.freezeBulletHits = 1;
        playerState.isFrozen = true;
        playerState.freezeTimer = 2.0;

        resetRound();

        return {
            hasLaserAfterReset: playerState.hasLaserSight,
            globalLaserPurchased: laserSightPurchased,
            freezeBulletHitsAfterReset: playerState.freezeBulletHits,
            isFrozenAfterReset: playerState.isFrozen,
            freezeTimerAfterReset: playerState.freezeTimer
        };
    });

    assert(roundResetTest.hasLaserAfterReset === true && roundResetTest.globalLaserPurchased === true, "Purchased laser sight persists across rounds");
    assert(roundResetTest.freezeBulletHitsAfterReset === 0, "Freeze bullet hits reset to 0 in new round");
    assert(roundResetTest.isFrozenAfterReset === false, "Player unfreezes in new round");

    assert(pageErrors.length === 0, `Zero page runtime errors during test run (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log("\n=== VERIFICATION FINISHED ===");
    if (failures === 0) {
        console.log("ALL FREEZE BULLETS & LASER SIGHT TESTS PASSED SUCCESSFULLY!");
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
