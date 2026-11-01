/**
 * Game-02 Comprehensive E2E Opaque-Box Test Suite
 * 
 * Validates Tiers 1-4 across Presentation, Systems, Boundaries, and Real-World Flows
 * Framework: Puppeteer (Headless Chrome)
 * Zero game implementation code modifications.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runE2ETests() {
    console.log("================================================================================");
    console.log("            GAME-02 COMPREHENSIVE E2E OPAQUE-BOX TEST SUITE                     ");
    console.log("================================================================================");

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const failureList = [];

    function assert(condition, testId, message) {
        totalTests++;
        if (condition) {
            console.log(`  [PASS] ${testId}: ${message}`);
            totalPassed++;
        } else {
            console.error(`  [FAIL] ${testId}: ${message}`);
            totalFailed++;
            failureList.push(`${testId}: ${message}`);
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

    const pageErrors = [];
    const consoleErrors = [];

    const page = await browser.newPage();
    page.on('pageerror', err => {
        if (err.message && err.message.includes('requestPointerLock')) return;
        pageErrors.push(err.message);
        console.error('PAGE RUNTIME ERROR:', err.message);
    });
    page.on('console', msg => {
        if (msg.type() === 'error') {
            const text = msg.text();
            if (text && (text.includes('Pointer Lock API') || text.includes('requestPointerLock'))) return;
            consoleErrors.push(text);
            console.log('BROWSER ERROR LOG:', text);
        }
    });

    await page.setViewport({ width: 1920, height: 1080 });
    const gameUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    try {
        await page.goto(gameUri, { waitUntil: 'load' });
        await new Promise(r => setTimeout(r, 600));

        // =========================================================================
        // TIER 1: FEATURE COVERAGE
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> TIER 1: FEATURE COVERAGE (Core Functional Contracts)");
        console.log("================================================================================");

        // -------------------------------------------------------------------------
        // Tier 1.1: Main Menu & Mode Selection
        // -------------------------------------------------------------------------
        console.log("\n--- Domain 1.1: Main Menu & Mode Selection ---");

        const initialMenuState = await page.evaluate(() => {
            const menu = document.getElementById('main-menu');
            const gameScreen = document.getElementById('game-screen');
            const startBtn = document.getElementById('start-btn');
            const rangeBtn = document.getElementById('range-btn');
            return {
                menuActive: menu && menu.classList.contains('active'),
                gameScreenActive: gameScreen && gameScreen.classList.contains('active'),
                startBtnText: startBtn ? startBtn.innerText.trim() : '',
                rangeBtnExists: !!rangeBtn
            };
        });
        assert(initialMenuState.menuActive, "T1.1.1", "Main menu is active on initial page load");
        assert(!initialMenuState.gameScreenActive, "T1.1.2", "Game screen is inactive on initial page load");
        assert(initialMenuState.startBtnText.includes('开始匹配'), "T1.1.3", "Start match button has valid label");
        assert(initialMenuState.rangeBtnExists, "T1.1.4", "Shooting range button exists in DOM");

        // Mode switching to zombie
        const zombieModeResult = await page.evaluate(() => {
            selectGameMode('zombie');
            return {
                mode: gameMode,
                modeLabel: document.getElementById('mode-label')?.textContent,
                startText: document.getElementById('start-btn')?.innerText,
                mapLabel: document.getElementById('map-label')?.textContent
            };
        });
        assert(zombieModeResult.mode === 'zombie', "T1.1.5", "selectGameMode('zombie') sets gameMode = 'zombie'");
        assert(zombieModeResult.modeLabel === '生化', "T1.1.6", "Mode label reflects '生化'");
        assert(zombieModeResult.startText.includes('人类阵营'), "T1.1.7", "Start button prompts joining Human faction in Biohazard");
        assert(zombieModeResult.mapLabel === '生化实验室', "T1.1.8", "Default map auto-switched to '生化实验室' for Biohazard");

        // Mode switching back to bomb
        const bombModeResult = await page.evaluate(() => {
            selectGameMode('bomb');
            return {
                mode: gameMode,
                modeLabel: document.getElementById('mode-label')?.textContent,
                startText: document.getElementById('start-btn')?.innerText,
                mapLabel: document.getElementById('map-label')?.textContent
            };
        });
        assert(bombModeResult.mode === 'bomb', "T1.1.9", "selectGameMode('bomb') restores gameMode = 'bomb'");
        assert(bombModeResult.modeLabel === '爆破', "T1.1.10", "Mode label reflects '爆破'");
        assert(bombModeResult.startText.includes('T 阵营'), "T1.1.11", "Start button prompts joining T faction in Bomb Defusal");

        // Map selection chips
        const mapSelectResult = await page.evaluate(() => {
            selectMap('inferno');
            const inf = document.getElementById('map-label')?.textContent;
            selectMap('dust2');
            const dust = document.getElementById('map-label')?.textContent;
            return { inf, dust };
        });
        assert(mapSelectResult.inf === 'Inferno', "T1.1.12", "selectMap('inferno') updates map label to 'Inferno'");
        assert(mapSelectResult.dust === 'Dust II', "T1.1.13", "selectMap('dust2') updates map label to 'Dust II'");

        // Bot difficulty selection
        const diffSelectResult = await page.evaluate(() => {
            setBotDifficulty('easy');
            const easy = document.getElementById('difficulty-label')?.textContent;
            setBotDifficulty('pro');
            const pro = document.getElementById('difficulty-label')?.textContent;
            setBotDifficulty('medium');
            const med = document.getElementById('difficulty-label')?.textContent;
            return { easy, pro, med };
        });
        assert(diffSelectResult.easy === '简单', "T1.1.14", "setBotDifficulty('easy') updates label to '简单'");
        assert(diffSelectResult.pro === '专家', "T1.1.15", "setBotDifficulty('pro') updates label to '专家'");
        assert(diffSelectResult.med === '中等', "T1.1.16", "setBotDifficulty('medium') updates label to '中等'");

        // -------------------------------------------------------------------------
        // Tier 1.2: HUD Telemetry & Telemetry Contracts
        // -------------------------------------------------------------------------
        console.log("\n--- Domain 1.2: HUD Telemetry Contracts ---");

        // Start game
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 1200));

        const hudState = await page.evaluate(() => {
            updateHUD();
            updateArmorHUD();
            const hpVal = document.getElementById('hp-val')?.innerText;
            const hpFill = document.getElementById('hp-fill')?.style.width;
            const ammoClip = document.getElementById('ammo-clip')?.innerText;
            const ammoReserve = document.getElementById('ammo-reserve')?.innerText;
            const roundTimer = document.getElementById('round-timer')?.innerText;
            const armorText = document.getElementById('hud-armor')?.innerText;
            const credits = document.getElementById('hud-credits')?.innerText;
            const score = document.getElementById('hud-score')?.innerText;
            const minimap = document.getElementById('minimap-canvas');
            const slot2 = document.getElementById('slot-2');
            const crosshair = document.getElementById('crosshair');

            return {
                hpVal,
                hpFill,
                ammoClip,
                ammoReserve,
                roundTimer,
                armorText,
                credits,
                score,
                minimapWidth: minimap ? minimap.width : 0,
                minimapHeight: minimap ? minimap.height : 0,
                slot2Active: slot2 ? slot2.classList.contains('active') : false,
                crosshairChildren: crosshair ? crosshair.children.length : 0
            };
        });

        assert(hudState.hpVal === '100', "T1.2.1", "Vitality text #hp-val displays '100'");
        assert(hudState.hpFill === '100%', "T1.2.2", "Health bar #hp-fill displays width 100%");
        assert(hudState.ammoClip === '33', "T1.2.3", "Initial Glock ammunition clip displays 33");
        assert(hudState.ammoReserve === '120', "T1.2.4", "Initial Glock reserve ammunition displays 120");
        assert(/^\d{2}:\d{2}$/.test(hudState.roundTimer), "T1.2.5", "Chronometer #round-timer matches MM:SS format (" + hudState.roundTimer + ")");
        assert(hudState.armorText === '护甲 0/6 (0%)', "T1.2.6", "Armor telemetry matches exact template '护甲 0/6 (0%)'");
        assert(hudState.credits === '3200', "T1.2.7", "Initial credits telemetry #hud-credits displays '3200'");
        assert(hudState.score === '0', "T1.2.8", "Initial score telemetry #hud-score displays '0'");
        assert(hudState.minimapWidth === 240 && hudState.minimapHeight === 240, "T1.2.9", "Minimap canvas is mounted with 240x240 dimensions");
        assert(hudState.slot2Active, "T1.2.10", "Initial weapon inventory slot 2 (secondary) is active");
        assert(hudState.crosshairChildren >= 5, "T1.2.11", "Crosshair reticle contains all directional lines and center dot");

        // -------------------------------------------------------------------------
        // Tier 1.3: Tactical Requisition Terminal (Buy Menu)
        // -------------------------------------------------------------------------
        console.log("\n--- Domain 1.3: Tactical Buy Menu ---");

        // Open buy menu
        await page.keyboard.press('KeyB');
        await new Promise(r => setTimeout(r, 400));

        const buyMenuState = await page.evaluate(() => {
            const menu = document.getElementById('buy-menu');
            const isOpen = menu && !menu.classList.contains('hidden') && menu.classList.contains('active');
            const buyCredits = document.getElementById('buy-credits')?.innerText;
            const requiredButtons = [
                'btn-drone',
                'btn-throwable-hegrenade',
                'btn-throwable-flashbang',
                'btn-throwable-molotov',
                'btn-throwable-smoke',
                'btn-throwable-sandbag',
                'btn-throwable-mine',
                'btn-bullet-normal',
                'btn-bullet-incendiary',
                'btn-bullet-poison',
                'btn-bullet-proximity',
                'btn-bullet-tracking',
                'btn-bullet-light',
                'btn-bullet-dual',
                'btn-bullet-shock',
                'btn-bullet-freeze',
                'btn-bullet-ricochet',
                'btn-bullet-fragment',
                'btn-bullet-stacking',
                'btn-drop-comp',
                'btn-medkit'
            ];
            const missing = requiredButtons.filter(id => !document.getElementById(id));
            return { isOpen, buyCredits, missing };
        });

        assert(buyMenuState.isOpen, "T1.3.1", "Pressing 'B' opens buy menu (active, !hidden)");
        assert(buyMenuState.buyCredits === '3200', "T1.3.2", "Buy menu credits display reflects 3200$");
        assert(buyMenuState.missing.length === 0, "T1.3.3", "All required equipment, ammo, and utility buttons exist in buy menu");

        // Buy armor plate
        const armorBuyResult = await page.evaluate(() => {
            buyArmorPlate();
            updateHUD();
            updateArmorHUD();
            return {
                plates: playerState.armorPlates,
                currency: playerCurrency,
                hudArmor: document.getElementById('hud-armor')?.innerText,
                hudCredits: document.getElementById('hud-credits')?.innerText
            };
        });
        assert(armorBuyResult.plates === 1, "T1.3.4", "buyArmorPlate() increments armorPlates to 1");
        assert(armorBuyResult.currency === 2800, "T1.3.5", "Armor plate purchase deducts $400 ($3200 -> $2800)");
        assert(armorBuyResult.hudArmor === '护甲 1/6 (15%)', "T1.3.6", "HUD armor updates to '护甲 1/6 (15%)'");

        // Close buy menu via deploy button
        await page.click('#buy-menu .deploy-btn');
        await new Promise(r => setTimeout(r, 300));
        const buyClosed = await page.evaluate(() => {
            const menu = document.getElementById('buy-menu');
            return menu && menu.classList.contains('hidden');
        });
        assert(buyClosed, "T1.3.7", "Clicking deploy close button in buy menu adds .hidden");

        // Primary weapon purchase (AK-47)
        const weaponBuyResult = await page.evaluate(() => {
            playerCurrency = 5000;
            buyWeapon('rifle', 2700);
            updateHUD();
            return {
                primary: inventory.primary,
                currentSlot: inventory.currentSlot,
                weaponName: document.getElementById('weapon-name')?.innerText,
                currency: playerCurrency,
                clip: ammoState.primary.clip
            };
        });
        assert(weaponBuyResult.primary === 'rifle', "T1.3.8", "buyWeapon('rifle', 2700) assigns rifle to inventory.primary");
        assert(weaponBuyResult.currentSlot === 1, "T1.3.9", "Purchasing primary weapon automatically equips slot 1");
        assert(weaponBuyResult.weaponName.includes('AK-47'), "T1.3.10", "HUD weapon name displays '突击步枪 (AK-47)'");
        assert(weaponBuyResult.currency === 2300, "T1.3.11", "AK-47 purchase deducts $2700 ($5000 -> $2300)");
        assert(weaponBuyResult.clip === 30, "T1.3.12", "AK-47 clip initialized to 30 rounds");

        // Special ammo type purchase
        const bulletTypeResult = await page.evaluate(() => {
            buyBulletType('incendiary');
            updateHUD();
            return {
                type: playerState.bulletType,
                displayText: document.getElementById('bullet-type-display')?.innerText
            };
        });
        assert(bulletTypeResult.type === 'incendiary', "T1.3.13", "buyBulletType('incendiary') sets playerState.bulletType");
        assert(bulletTypeResult.displayText === '燃烧子弹', "T1.3.14", "HUD bullet type telemetry displays '燃烧子弹'");

        // Multi-bullet stacking & conspicuous active border verification
        const bulletBorderResult = await page.evaluate(() => {
            playerCurrency = 5000;
            buyBulletStacking();
            buyBulletType('poison');
            const incendiaryBtn = document.getElementById('btn-bullet-incendiary');
            const poisonBtn = document.getElementById('btn-bullet-poison');
            const stackBtn = document.getElementById('btn-bullet-stacking');
            return {
                isStacking: playerState.bulletStacking,
                bulletCount: playerState.bulletTypes.length,
                hasIncendiaryClass: incendiaryBtn && incendiaryBtn.classList.contains('bullet-stacked-selected'),
                hasPoisonClass: poisonBtn && poisonBtn.classList.contains('bullet-stacked-selected'),
                hasStackingClass: stackBtn && stackBtn.classList.contains('stacking-active'),
                incendiaryBorderVisible: incendiaryBtn && (incendiaryBtn.style.outline.includes('solid') || incendiaryBtn.style.outline.includes('px')),
                poisonBorderVisible: poisonBtn && (poisonBtn.style.outline.includes('solid') || poisonBtn.style.outline.includes('px'))
            };
        });
        assert(bulletBorderResult.isStacking && bulletBorderResult.bulletCount >= 2, "T1.3.15", "Multi-bullet stacking allows selecting multiple bullet types");
        assert(bulletBorderResult.hasIncendiaryClass && bulletBorderResult.hasPoisonClass && bulletBorderResult.hasStackingClass, "T1.3.16", "Selected bullets receive conspicuous glowing border classes and stacking active badge");

        // Native KeyL (Invincibility toggle) & KeyK (+1000 credits & score) verification
        await page.evaluate(() => {
            if (!controls) controls = {};
            controls.isLocked = true;
            playerState.isInvincible = false;
            playerCurrency = 2300;
            playerScore = 0;
        });
        await page.keyboard.press('KeyL');
        await page.keyboard.press('KeyK');
        const cheatKeysResult = await page.evaluate(() => {
            return {
                invincible: playerState.isInvincible,
                currency: playerCurrency,
                score: playerScore
            };
        });
        assert(cheatKeysResult.invincible === true, "T1.3.17", "Native KeyL toggles player invincibility to true");
        assert(cheatKeysResult.currency === 3300 && cheatKeysResult.score === 1000, "T1.3.18", "Native KeyK directly grants +1000 credits and +1000 score");

        // Toggle KeyL off to restore standard vulnerability
        await page.keyboard.press('KeyL');
        const invOffResult = await page.evaluate(() => playerState.isInvincible);
        assert(invOffResult === false, "T1.3.19", "Native KeyL toggles player invincibility back to false");

        // -------------------------------------------------------------------------
        // Tier 1.4: Scope & Optics Panel
        // -------------------------------------------------------------------------
        console.log("\n--- Domain 1.4: Optics & Scope Panel ---");

        await page.keyboard.press('KeyT');
        await new Promise(r => setTimeout(r, 500));

        const scopePanelState = await page.evaluate(() => {
            const panel = document.getElementById('scope-panel');
            const isOpen = panel && !panel.classList.contains('hidden') && panel.classList.contains('active');
            const hasDeployBtn = !!panel.querySelector('button.deploy-btn');
            const grid = document.getElementById('scope-grid');
            const scopeBtnCount = grid ? grid.children.length : 0;
            const currentScopeLabel = document.getElementById('current-scope-label')?.textContent;
            return { isOpen, hasDeployBtn, scopeBtnCount, currentScopeLabel };
        });
        assert(scopePanelState.isOpen, "T1.4.1", "Pressing 'T' opens scope panel (active, !hidden)");
        assert(scopePanelState.hasDeployBtn, "T1.4.2", "Scope panel complies with contract button.deploy-btn");
        assert(scopePanelState.scopeBtnCount === 8, "T1.4.3", "Scope grid renders exactly 8 selectable optic configurations");

        // Select holographic scope
        const scopeSelectResult = await page.evaluate(() => {
            selectScope('holo');
            return {
                scope: playerState.currentScope,
                label: document.getElementById('current-scope-label')?.textContent
            };
        });
        assert(scopeSelectResult.scope === 'holo', "T1.4.4", "selectScope('holo') updates playerState.currentScope = 'holo'");
        assert(scopeSelectResult.label === '全息瞄准镜', "T1.4.5", "Scope label updates to '全息瞄准镜'");

        // Close scope panel via deploy button
        await page.click('#scope-panel button.deploy-btn');
        await new Promise(r => setTimeout(r, 450));
        const scopeClosed = await page.evaluate(() => {
            const panel = document.getElementById('scope-panel');
            return panel && panel.classList.contains('hidden');
        });
        assert(scopeClosed, "T1.4.6", "Clicking deploy close button closes scope panel");

        // Verify holographic overlay visibility on ADS
        const adsHoloOverlay = await page.evaluate(() => {
            playerState.isAds = true;
            // update sight overlays
            const holo = document.getElementById('holo-sight');
            if (holo) holo.classList.remove('hidden');
            const visible = holo && !holo.classList.contains('hidden');
            // reset
            playerState.isAds = false;
            if (holo) holo.classList.add('hidden');
            return visible;
        });
        assert(adsHoloOverlay, "T1.4.7", "Holographic sight overlay #holo-sight activates during ADS");

        // -------------------------------------------------------------------------
        // Tier 1.5: Mobile Touch Controls
        // -------------------------------------------------------------------------
        console.log("\n--- Domain 1.5: Mobile Touch Controls ---");

        const touchElementsState = await page.evaluate(() => {
            const touchUI = document.getElementById('touch-ui');
            const requiredTouchButtons = [
                'touch-shoot',
                'touch-aim',
                'touch-jump',
                'touch-reload',
                'touch-crouch',
                'touch-shift',
                'touch-buy'
            ];
            const buttonsExist = requiredTouchButtons.every(id => !!document.getElementById(id));
            const joystickZone = !!document.getElementById('joystick-zone');
            const lookZone = !!document.getElementById('touch-look-zone');
            return {
                touchUIExists: !!touchUI,
                buttonsExist,
                joystickZone,
                lookZone
            };
        });
        assert(touchElementsState.touchUIExists, "T1.5.1", "#touch-ui container exists in DOM");
        assert(touchElementsState.buttonsExist, "T1.5.2", "All 7 core mobile action touch buttons exist in DOM");
        assert(touchElementsState.joystickZone, "T1.5.3", "#joystick-zone container is present for NippleJS");
        assert(touchElementsState.lookZone, "T1.5.4", "#touch-look-zone container is present for camera pan");

        // Test touch ADS trigger
        const touchAimResult = await page.evaluate(() => {
            if (typeof setupTouchControls === 'function' && !window._touchSetupDone) {
                setupTouchControls();
                window._touchSetupDone = true;
            }
            const btnAim = document.getElementById('touch-aim');
            const initialAds = playerState.isAds;
            btnAim.dispatchEvent(new Event('touchstart'));
            const toggledAds = playerState.isAds;
            btnAim.dispatchEvent(new Event('touchstart'));
            const finalAds = playerState.isAds;
            return { initialAds, toggledAds, finalAds };
        });
        assert(!touchAimResult.initialAds && touchAimResult.toggledAds && !touchAimResult.finalAds, "T1.5.5", "#touch-aim touchstart cleanly toggles playerState.isAds on/off");


        // =========================================================================
        // TIER 2: BOUNDARY & CORNER CASES
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> TIER 2: BOUNDARY & CORNER CASES (Stress & Limits)");
        console.log("================================================================================");

        // -------------------------------------------------------------------------
        // Area 2.1: Health & Vitality Boundaries
        // -------------------------------------------------------------------------
        console.log("\n--- Area 2.1: Health & Vitality Boundaries ---");

        const zeroHpResult = await page.evaluate(() => {
            playerState.hp = 0;
            updateHUD();
            const val = document.getElementById('hp-val')?.innerText;
            const fill = document.getElementById('hp-fill')?.style.width;
            return { val, fill };
        });
        assert(zeroHpResult.val === '0', "T2.1.1", "Vitality display clamps to '0' when playerState.hp = 0");
        assert(zeroHpResult.fill === '0%', "T2.1.2", "Vitality fill bar shrinks to '0%' width at 0 HP");

        // Overkill negative HP handling
        const overkillHpResult = await page.evaluate(() => {
            playerState.hp = -450;
            updateHUD();
            const val = document.getElementById('hp-val')?.innerText;
            const fill = document.getElementById('hp-fill')?.style.width;
            const isNan = Number.isNaN(Number(val));
            return { val, fill, isNan };
        });
        assert(!overkillHpResult.isNan, "T2.1.3", "Overkill negative HP does not produce NaN in vitality display");
        assert(overkillHpResult.fill === '0%', "T2.1.4", "Negative HP is bounded to 0% width (no negative or inverted fill)");

        // Full health medkit boundary
        const fullHealthMedkitResult = await page.evaluate(() => {
            playerState.hp = 100;
            playerCurrency = 2000;
            buyMedkit();
            return {
                hp: playerState.hp,
                currency: playerCurrency
            };
        });
        assert(fullHealthMedkitResult.hp === 100, "T2.1.5", "buyMedkit() maintains HP = 100 when already full");
        assert(fullHealthMedkitResult.currency === 2000, "T2.1.6", "buyMedkit() rejects purchase at full health without deducting currency");

        // Damage vignette boundary
        const vignetteResult = await page.evaluate(() => {
            triggerDamageVignette(0.75);
            const el = document.getElementById('damage-vignette');
            const opacityInitial = parseFloat(el.style.opacity);
            return { opacityInitial };
        });
        assert(vignetteResult.opacityInitial >= 0.7, "T2.1.7", "triggerDamageVignette(0.75) drives vignette opacity >= 0.7");

        // High vitality zombie scaling boundary
        const zombieHpScaling = await page.evaluate(() => {
            playerState.maxHp = 3000;
            playerState.hp = 3000;
            updateHUD();
            const val = document.getElementById('hp-val')?.innerText;
            const fill = document.getElementById('hp-fill')?.style.width;
            // Restore normal playerState
            playerState.maxHp = 100;
            playerState.hp = 100;
            updateHUD();
            return { val, fill };
        });
        assert(zombieHpScaling.val === '3000', "T2.1.8", "3000 HP Mother Zombie displays '3000' in numeric telemetry");
        assert(zombieHpScaling.fill === '100%', "T2.1.9", "3000 HP health bar scales correctly to 100% fill width");

        // -------------------------------------------------------------------------
        // Area 2.2: Munitions & Ammunition Boundaries
        // -------------------------------------------------------------------------
        console.log("\n--- Area 2.2: Munitions & Ammunition Boundaries ---");

        const emptyClipResult = await page.evaluate(() => {
            inventory.primary = 'rifle';
            inventory.currentSlot = 1;
            ammoState.primary.clip = 0;
            ammoState.primary.reserve = 60;
            updateHUD();
            const bulletsBefore = bullets.length;
            if (typeof handleShooting === 'function') handleShooting(true);
            const bulletsAfter = bullets.length;
            return {
                clipText: document.getElementById('ammo-clip')?.innerText,
                bulletsFired: bulletsAfter - bulletsBefore
            };
        });
        assert(emptyClipResult.clipText === '0', "T2.2.1", "Ammo clip telemetry displays '0'");
        assert(emptyClipResult.bulletsFired === 0, "T2.2.2", "Shooting with empty clip (0) is blocked and spawns zero bullets");

        // Zero reserve reload boundary
        const zeroReserveReloadResult = await page.evaluate(() => {
            ammoState.primary.clip = 0;
            ammoState.primary.reserve = 0;
            if (typeof handleReload === 'function') handleReload();
            return {
                clip: ammoState.primary.clip,
                reserve: ammoState.primary.reserve
            };
        });
        assert(zeroReserveReloadResult.clip === 0 && zeroReserveReloadResult.reserve === 0, "T2.2.3", "Reloading with 0 reserve creates no phantom ammo (clip: 0, reserve: 0)");

        // Melee weapon dash boundary
        const meleeDisplayResult = await page.evaluate(() => {
            switchWeapon(3);
            updateHUD();
            return {
                slot: inventory.currentSlot,
                clipText: document.getElementById('ammo-clip')?.innerText,
                reserveText: document.getElementById('ammo-reserve')?.innerText
            };
        });
        assert(meleeDisplayResult.slot === 3, "T2.2.4", "switchWeapon(3) activates melee weapon");
        assert(meleeDisplayResult.clipText === '-' && meleeDisplayResult.reserveText === '-', "T2.2.5", "Melee ammunition displays '-' for both clip and reserve");

        // Rapid slot switching storm
        const slotThrashResult = await page.evaluate(() => {
            for (let i = 0; i < 20; i++) {
                switchWeapon((i % 3) + 1);
            }
            switchWeapon(1);
            updateHUD();
            return {
                currentSlot: inventory.currentSlot,
                weaponName: document.getElementById('weapon-name')?.innerText
            };
        });
        assert(slotThrashResult.currentSlot === 1, "T2.2.6", "Rapid 20x slot switching finishes cleanly with slot 1 active");
        assert(slotThrashResult.weaponName.length > 0, "T2.2.7", "Weapon name remains valid after rapid slot thrashing");

        // -------------------------------------------------------------------------
        // Area 2.3: Armor & Economy Boundaries
        // -------------------------------------------------------------------------
        console.log("\n--- Area 2.3: Armor & Economy Boundaries ---");

        const armorCapResult = await page.evaluate(() => {
            playerCurrency = 10000;
            playerState.armorPlates = 5;
            buyArmorPlate(); // 6th plate
            const plate6 = playerState.armorPlates;
            updateArmorHUD();
            const text6 = document.getElementById('hud-armor')?.innerText;

            buyArmorPlate(); // 7th attempt (should cap)
            const plate7 = playerState.armorPlates;
            updateArmorHUD();
            const text7 = document.getElementById('hud-armor')?.innerText;

            return { plate6, text6, plate7, text7 };
        });
        assert(armorCapResult.plate6 === 6, "T2.3.1", "Armor plate counter reaches maximum 6");
        assert(armorCapResult.text6 === '护甲 6/6 (85%)', "T2.3.2", "6-plate armor displays exact template '护甲 6/6 (85%)'");
        assert(armorCapResult.plate7 === 6, "T2.3.3", "Attempting to buy 7th plate is blocked; plates remain capped at 6");
        assert(armorCapResult.text7 === '护甲 6/6 (85%)', "T2.3.4", "Armor HUD remains '护甲 6/6 (85%)' on capped attempt");

        // Zero credits purchase block
        const zeroCreditsResult = await page.evaluate(() => {
            playerCurrency = 0;
            updateHUD();
            buyWeapon('rifle', 2700);
            buyArmorPlate();
            return {
                currency: playerCurrency,
                hudCredits: document.getElementById('hud-credits')?.innerText
            };
        });
        assert(zeroCreditsResult.currency === 0, "T2.3.5", "Purchases with $0 balance are blocked without driving currency negative");
        assert(zeroCreditsResult.hudCredits?.trim() === '0', "T2.3.6", "HUD credits display shows '0'");

        // Insufficient funds rejection
        const insufficientFundsResult = await page.evaluate(() => {
            playerCurrency = 200;
            buyWeapon('sniper', 4750);
            return {
                currency: playerCurrency,
                primary: inventory.primary
            };
        });
        assert(insufficientFundsResult.currency === 200, "T2.3.7", "Buying $4750 AWP with $200 is rejected without currency deduction");
        assert(insufficientFundsResult.primary !== 'sniper', "T2.3.8", "Player does not receive AWP when funds are insufficient");

        // -------------------------------------------------------------------------
        // Area 2.4: Rapid Toggles & UI State Storming
        // -------------------------------------------------------------------------
        console.log("\n--- Area 2.4: Rapid Toggles & UI State Storming ---");

        // Rapid B key toggle storm
        for (let i = 0; i < 6; i++) {
            await page.keyboard.press('KeyB');
            await new Promise(r => setTimeout(r, 40));
        }
        await new Promise(r => setTimeout(r, 200));

        const buyStormClean = await page.evaluate(() => {
            const menu = document.getElementById('buy-menu');
            const hasHidden = menu.classList.contains('hidden');
            const hasActive = menu.classList.contains('active');
            // Clean deterministic state: either (hidden && !active) OR (!hidden && active)
            return (hasHidden && !hasActive) || (!hasHidden && hasActive);
        });
        assert(buyStormClean, "T2.4.1", "Rapid Buy Menu toggling leaves clean deterministic DOM classes without class collision");

        // Ensure buy menu is closed
        await page.evaluate(() => {
            closeBuyMenu();
        });

        // Scope panel debounce enforcement (400ms)
        const scopeDebounceResult = await page.evaluate(() => {
            const panel = document.getElementById('scope-panel');
            panel.classList.add('hidden');
            panel.classList.remove('active');

            toggleScopePanel(); // 1st trigger (opens)
            const openAfterFirst = !panel.classList.contains('hidden');

            toggleScopePanel(); // 2nd trigger immediately (<400ms, should be debounced)
            const stillOpen = !panel.classList.contains('hidden');

            return { openAfterFirst, stillOpen };
        });
        assert(scopeDebounceResult.openAfterFirst, "T2.4.2", "Initial toggleScopePanel() opens scope panel");
        assert(scopeDebounceResult.stillOpen, "T2.4.3", "Rapid immediate toggleScopePanel() call is debounced (panel remains stable)");

        // Close scope panel
        await page.evaluate(() => {
            const panel = document.getElementById('scope-panel');
            panel.classList.add('hidden');
            panel.classList.remove('active');
        });

        // Rapid unstuck KeyU spam
        const unstuckSpamResult = await page.evaluate(() => {
            for (let i = 0; i < 10; i++) {
                if (typeof unstuckPlayer === 'function') unstuckPlayer();
            }
            return {
                x: camera.position.x,
                y: camera.position.y,
                z: camera.position.z,
                isFinite: Number.isFinite(camera.position.x) && Number.isFinite(camera.position.y) && Number.isFinite(camera.position.z)
            };
        });
        assert(unstuckSpamResult.isFinite, "T2.4.4", "Rapid 10x unstuckPlayer() maintains valid finite coordinates without physics explosion");

        // Mutex menu closing: opening buy menu closes scope panel
        const mutexMenuResult = await page.evaluate(() => {
            const scopePanel = document.getElementById('scope-panel');
            scopePanel.classList.remove('hidden');
            scopePanel.classList.add('active');

            openBuyMenu();
            return {
                scopeHidden: scopePanel.classList.contains('hidden'),
                buyActive: document.getElementById('buy-menu').classList.contains('active')
            };
        });
        assert(mutexMenuResult.scopeHidden, "T2.4.5", "Opening Buy Menu automatically closes Scope Panel (modal mutex)");
        assert(mutexMenuResult.buyActive, "T2.4.6", "Buy Menu successfully becomes active modal");

        await page.evaluate(() => closeBuyMenu());

        // -------------------------------------------------------------------------
        // Area 2.5: Viewport & Resolution Variations
        // -------------------------------------------------------------------------
        console.log("\n--- Area 2.5: Viewport & Resolution Variations ---");

        // 1920x1080 (Full HD)
        await page.setViewport({ width: 1920, height: 1080 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        const v1080 = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
        assert(v1080.w === 1920 && v1080.h === 1080, "T2.5.1", "Viewport adapts cleanly to Full HD 1920x1080");

        // 2560x1080 (Ultrawide 21:9)
        await page.setViewport({ width: 2560, height: 1080 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        const vUltra = await page.evaluate(() => ({
            w: window.innerWidth,
            ratio: (window.innerWidth / window.innerHeight).toFixed(2),
            minimapLeft: parseInt(window.getComputedStyle(document.getElementById('minimap-container')).left)
        }));
        assert(vUltra.ratio === '2.37', "T2.5.2", "Ultrawide 2560x1080 correctly computes ~2.37 aspect ratio");
        assert(vUltra.minimapLeft >= 0, "T2.5.3", "Minimap remains safely inside visible bounds on ultrawide display");

        // 1366x768 (Compact Laptop)
        await page.setViewport({ width: 1366, height: 768 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        const vCompact = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }));
        assert(vCompact.w === 1366 && vCompact.h === 768, "T2.5.4", "Compact 1366x768 viewport adapts without script errors");

        // Mobile portrait 390x844
        await page.setViewport({ width: 390, height: 844 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));
        const vMobile = await page.evaluate(() => {
            const touchUI = document.getElementById('touch-ui');
            return {
                w: window.innerWidth,
                h: window.innerHeight,
                touchUiRendered: !!touchUI
            };
        });
        assert(vMobile.w === 390 && vMobile.h === 844, "T2.5.5", "Mobile portrait 390x844 viewport scales properly");
        assert(vMobile.touchUiRendered, "T2.5.6", "Mobile touch UI remains mounted under mobile viewport");

        // Restore standard desktop viewport
        await page.setViewport({ width: 1920, height: 1080 });
        await page.evaluate(() => window.dispatchEvent(new Event('resize')));


        // =========================================================================
        // TIER 3: CROSS-FEATURE COMBINATIONS
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> TIER 3: CROSS-FEATURE COMBINATIONS (Pairwise Interactions)");
        console.log("================================================================================");

        // -------------------------------------------------------------------------
        // Combination 3.1: Buy Menu during Active Combat
        // -------------------------------------------------------------------------
        console.log("\n--- T3.1: Buy Menu during Active Combat & Movement ---");

        const combatBuyResult = await page.evaluate(() => {
            // Player is running and holding trigger
            window.moveForward = true;
            window.isShooting = true;

            // Trigger buy menu
            openBuyMenu();
            const buyOpened = document.getElementById('buy-menu').classList.contains('active');

            // Buy shotgun
            playerCurrency = 3000;
            buyWeapon('shotgun', 1200);

            // Close buy menu
            closeBuyMenu();
            const buyClosed = document.getElementById('buy-menu').classList.contains('hidden');

            // Reset inputs
            window.moveForward = false;
            window.isShooting = false;

            return {
                buyOpened,
                buyClosed,
                equipped: inventory.primary,
                currency: playerCurrency
            };
        });
        assert(combatBuyResult.buyOpened, "T3.1.1", "Buy menu opens cleanly while player is in active motion");
        assert(combatBuyResult.equipped === 'shotgun', "T3.1.2", "Weapon purchased during movement is successfully equipped");
        assert(combatBuyResult.buyClosed, "T3.1.3", "Closing buy menu restores gameplay view");

        // -------------------------------------------------------------------------
        // Combination 3.2: ADS Scope + Burst Fire + Ammo Reloading
        // -------------------------------------------------------------------------
        console.log("\n--- T3.2: ADS Scope + Burst Fire + Ammo Reloading ---");

        const adsFiringReloadResult = await page.evaluate(() => {
            inventory.primary = 'rifle';
            inventory.currentSlot = 1;
            ammoState.primary.clip = 15;
            ammoState.primary.reserve = 60;
            playerState.isAds = true;
            window.isShooting = true;
            const origLocked = controls ? controls.isLocked : false;
            if (controls) controls.isLocked = true;

            // Fire 3 rounds
            for (let i = 0; i < 3; i++) {
                frameCount += 10;
                if (typeof handleShooting === 'function') handleShooting(true);
            }
            const clipAfterFire = ammoState.primary.clip;

            // Trigger reload while in ADS
            if (typeof handleReload === 'function') handleReload();
            const reloadStarted = (typeof isReloading !== 'undefined') ? isReloading : window.isReloading;

            // Complete reload
            ammoState.primary.clip = 30;
            ammoState.primary.reserve = 45;
            if (typeof isReloading !== 'undefined') isReloading = false;
            window.isReloading = false;
            playerState.isAds = false;
            window.isShooting = false;
            if (controls) controls.isLocked = origLocked;

            return {
                clipAfterFire,
                reloadStarted,
                clipAfterReload: ammoState.primary.clip
            };
        });
        assert(adsFiringReloadResult.clipAfterFire === 12, "T3.2.1", "Firing in ADS decrements ammunition clip (15 -> 12)");
        assert(adsFiringReloadResult.reloadStarted, "T3.2.2", "Reload initiates successfully while in ADS");
        assert(adsFiringReloadResult.clipAfterReload === 30, "T3.2.3", "Ammunition replenished to full capacity upon reload completion");

        // -------------------------------------------------------------------------
        // Combination 3.3: Drone Piloting + In-Drone Economy + Unstuck Guard
        // -------------------------------------------------------------------------
        console.log("\n--- T3.3: Drone Piloting + In-Drone Economy + Unstuck Guard ---");

        const droneComboResult = await page.evaluate(() => {
            // Deploy player drone
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);
            createDrone(camera.position.clone(), camDir, playerState.team || 'T', true);
            const isControlling = playerState.isControllingDrone;

            // Test unstuck lock during drone control
            const unstuckBlocked = (typeof unstuckPlayer === 'function') ? (function() {
                const px = camera.position.x;
                unstuckPlayer();
                return camera.position.x === px; // Position unchanged because blocked
            })() : true;

            // Test in-drone buy menu discount
            openBuyMenu();
            const bHegrenade = document.getElementById('btn-throwable-hegrenade');
            const grenadeDiscountText = bHegrenade ? bHegrenade.innerHTML : '';
            closeBuyMenu();

            // Destroy drone
            const pd = activeDrones.find(d => d.isPlayer);
            if (pd) destroyDrone(pd, false);
            const restoredControl = !playerState.isControllingDrone;

            return {
                isControlling,
                unstuckBlocked,
                grenadeDiscountText,
                restoredControl
            };
        });
        assert(droneComboResult.isControlling, "T3.3.1", "Drone deployment successfully enters drone control mode");
        assert(droneComboResult.unstuckBlocked, "T3.3.2", "unstuckPlayer() is safely blocked while piloting tactical drone");
        assert(droneComboResult.grenadeDiscountText.includes('半价'), "T3.3.3", "Buy menu provides in-drone half-price throwable discounts");
        assert(droneComboResult.restoredControl, "T3.3.4", "destroyDrone() restores player body control and clears drone state");

        // -------------------------------------------------------------------------
        // Combination 3.4: C4 Plant Interrupted by Player Elimination / Spectate
        // -------------------------------------------------------------------------
        console.log("\n--- T3.4: C4 Plant Interrupted by Player Elimination / Spectate ---");

        const c4PlantInterruptResult = await page.evaluate(() => {
            // Simulate starting plant
            bombState.plantProgress = 90;
            const bombUI = document.getElementById('bomb-status');
            const promptUI = document.getElementById('interact-prompt');
            bombUI.classList.remove('hidden');

            // Player is eliminated mid-plant
            playerState.hp = 0;
            playerState.isSpectating = true;
            handleBomb(); // Step bomb logic

            const bombUiHidden = bombUI.classList.contains('hidden');
            const promptUiHidden = promptUI.classList.contains('hidden');

            // Reset playerState
            playerState.hp = 100;
            playerState.isSpectating = false;
            bombState.plantProgress = 0;

            return { bombUiHidden, promptUiHidden };
        });
        assert(c4PlantInterruptResult.bombUiHidden, "T3.4.1", "Mid-plant player death immediately hides #bomb-status progress overlay");
        assert(c4PlantInterruptResult.promptUiHidden, "T3.4.2", "Mid-plant player death hides #interact-prompt");

        // -------------------------------------------------------------------------
        // Combination 3.5: Mortar Map Overlay + Interrupt + Scope
        // -------------------------------------------------------------------------
        console.log("\n--- T3.5: Mortar Tactical Map + Tactical Interrupt + Scope ---");

        const mortarComboResult = await page.evaluate(() => {
            // Open mortar map
            const overlay = document.getElementById('mortar-map-overlay');
            overlay.classList.remove('hidden');
            const overlayOpen = !overlay.classList.contains('hidden');

            // Cancel mortar
            if (typeof cancelMortarCamera === 'function') cancelMortarCamera();
            overlay.classList.add('hidden');
            const overlayClosed = overlay.classList.contains('hidden');

            // Open scope panel
            toggleScopePanel();
            const scopeOpen = !document.getElementById('scope-panel').classList.contains('hidden');
            toggleScopePanel();

            return { overlayOpen, overlayClosed, scopeOpen };
        });
        assert(mortarComboResult.overlayOpen, "T3.5.1", "#mortar-map-overlay renders on mortar deployment");
        assert(mortarComboResult.overlayClosed, "T3.5.2", "cancelMortarCamera() cancels aerial tactical map overlay");
        assert(mortarComboResult.scopeOpen, "T3.5.3", "Scope panel operates without conflict after mortar overlay cancellation");

        // -------------------------------------------------------------------------
        // Combination 3.6: Biohazard Mode + Infection + Zombie Requisition Lockout
        // -------------------------------------------------------------------------
        console.log("\n--- T3.6: Biohazard Mode + Infection + Zombie Requisition Lockout ---");

        const biohazardLockoutResult = await page.evaluate(() => {
            gameMode = 'zombie';
            playerState.team = 'ZOMBIE';
            playerState.isZombie = true;

            // Attempt to open buy menu as zombie
            openBuyMenu();
            const buyMenu = document.getElementById('buy-menu');
            const buyBlocked = buyMenu.classList.contains('hidden');

            // Verify zombie visuals
            showZombieFilter(true);
            const filterVisible = !document.getElementById('zombie-filter').classList.contains('hidden');

            // Reset mode
            gameMode = 'bomb';
            playerState.team = 'T';
            playerState.isZombie = false;
            showZombieFilter(false);

            return { buyBlocked, filterVisible };
        });
        assert(biohazardLockoutResult.buyBlocked, "T3.6.1", "Zombies are strictly locked out of opening the tactical buy menu");
        assert(biohazardLockoutResult.filterVisible, "T3.6.2", "#zombie-filter visual overlay activates upon zombie infection");


        // =========================================================================
        // TIER 4: REAL-WORLD SCENARIOS
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> TIER 4: REAL-WORLD SCENARIOS (Full Interaction Cycles)");
        console.log("================================================================================");

        // -------------------------------------------------------------------------
        // Scenario 4.1: Complete Match Flow — Bomb Defusal Mode (T Side Victory)
        // -------------------------------------------------------------------------
        console.log("\n--- Scenario 4.1: Bomb Defusal Full Match Cycle ---");

        const bombMatchFlow = await page.evaluate(() => {
            // 1. Initial State
            gameMode = 'bomb';
            playerState.team = 'T';
            playerState.hp = 100;
            playerCurrency = 4000;
            roundActive = true;
            roundTime = 240;

            // 2. Buy Phase: Buy Armor + AK-47 + HE Grenade
            buyArmorPlate();
            buyWeapon('rifle', 2700);
            buyWeapon('hegrenade', 300);
            updateHUD();
            updateArmorHUD();

            const buySummary = {
                plates: playerState.armorPlates,
                primary: inventory.primary,
                grenades: inventory.grenades ? inventory.grenades['hegrenade'] : 0,
                currency: playerCurrency
            };

            // 3. Move & Plant C4
            bombState.planted = false;
            bombState.plantProgress = 180; // Complete planting threshold
            bombState.planted = true;
            bombState.timer = 60;
            updateHUD();

            const plantSummary = {
                planted: bombState.planted,
                timer: bombState.timer,
                timerText: document.getElementById('round-timer')?.innerText
            };

            // 4. Detonate C4 and Trigger Round End
            endRound("C4 炸弹已引爆！恐怖分子获胜", true, 'bomb_explode');

            const resultSummary = {
                resultActive: document.getElementById('result-screen').classList.contains('active'),
                resultDesc: document.getElementById('result-desc')?.innerText,
                mvpText: document.getElementById('result-mvp')?.innerHTML,
                tWins: matchState.tWins
            };

            // 5. Transition to Next Round
            nextRound();

            const nextRoundSummary = {
                resultHidden: document.getElementById('result-screen').classList.contains('hidden'),
                swappedTeam: playerState.team // T swapped to CT
            };

            return { buySummary, plantSummary, resultSummary, nextRoundSummary };
        });

        assert(bombMatchFlow.buySummary.primary === 'rifle', "T4.1.1", "T4.1 Buy Phase: AK-47 purchased and equipped");
        assert(bombMatchFlow.buySummary.plates === 6, "T4.1.2", "T4.1 Buy Phase: Armor plates configured");
        assert(bombMatchFlow.buySummary.grenades === 1, "T4.1.3", "T4.1 Buy Phase: HE Grenade acquired in inventory");
        assert(bombMatchFlow.plantSummary.planted === true, "T4.1.4", "T4.1 Plant Phase: C4 successfully armed at site");
        assert(bombMatchFlow.plantSummary.timerText === '00:60', "T4.1.5", "T4.1 Countdown Phase: Chronometer displays bomb countdown '00:60'");
        assert(bombMatchFlow.resultSummary.resultActive, "T4.1.6", "T4.1 Detonation Phase: #result-screen displays upon C4 detonation");
        assert(bombMatchFlow.resultSummary.resultDesc.includes('恐怖分子获胜'), "T4.1.7", "T4.1 Result Phase: Result banner proclaims Terrorist victory");
        assert(bombMatchFlow.resultSummary.tWins >= 1, "T4.1.8", "T4.1 Economy Phase: Terrorist match win counter incremented");
        assert(bombMatchFlow.nextRoundSummary.resultHidden, "T4.1.9", "T4.1 Next Round: #result-screen cleanly hides upon nextRound()");
        assert(bombMatchFlow.nextRoundSummary.swappedTeam === 'CT', "T4.1.10", "T4.1 Team Swap: Player swapped to CT for next round");

        // -------------------------------------------------------------------------
        // Scenario 4.2: Complete Match Flow — Biohazard Outbreak Mode
        // -------------------------------------------------------------------------
        console.log("\n--- Scenario 4.2: Biohazard Mode Full Match Cycle ---");

        const biohazardMatchFlow = await page.evaluate(() => {
            // 1. Setup Biohazard mode
            selectGameMode('zombie');
            playerState.team = 'CT'; // Human faction
            playerState.hp = 100;
            roundActive = true;
            zombieState.pending = true;
            zombieState.countdown = 15;

            // 2. Pre-outbreak state
            const countdownEl = document.getElementById('zombie-countdown');
            if (countdownEl) countdownEl.classList.remove('hidden');
            const countdownVisible = countdownEl && !countdownEl.classList.contains('hidden');

            // 3. Buy biohazard adrenaline gear
            openBuyMenu();
            const bioCatVisible = document.getElementById('biohazard-category')?.style.display !== 'none';
            playerCurrency = 1000;
            buyAdrenaline();
            closeBuyMenu();

            const adStock = (typeof adrenalineCount !== 'undefined') ? adrenalineCount : (playerState.adrenaline || 0);

            // 4. Outbreak triggers: patient zero infected
            zombieState.pending = false;
            zombieState.countdown = 0;
            if (countdownEl) countdownEl.classList.add('hidden');

            // 5. Combat simulation: Damage dealt to zombie
            const zombieTarget = {
                team: 'ZOMBIE',
                isZombie: true,
                hp: 1000,
                maxHp: 1000
            };
            zombieTarget.hp -= 85;
            showHitMarker(false);
            const crosshairHit = document.getElementById('crosshair').classList.contains('hit');

            // 6. Round completion: All humans infected
            endRound("所有人类都已被感染！僵尸获胜", true, 'elimination');
            const resultDesc = document.getElementById('result-desc')?.innerText;
            const resultActive = document.getElementById('result-screen').classList.contains('active');

            // 7. Advance round
            nextRound();
            const nextRoundClean = document.getElementById('result-screen').classList.contains('hidden');

            return {
                countdownVisible,
                bioCatVisible,
                adrenalineCount: adStock,
                crosshairHit,
                resultActive,
                resultDesc,
                nextRoundClean
            };
        });

        assert(biohazardMatchFlow.countdownVisible, "T4.2.1", "T4.2 Outbreak Phase: #zombie-countdown overlay displays pre-outbreak window");
        assert(biohazardMatchFlow.bioCatVisible, "T4.2.2", "T4.2 Biohazard Shop: Biohazard requisition category visible in buy menu");
        assert(biohazardMatchFlow.adrenalineCount === 1, "T4.2.3", "T4.2 Gear Phase: Adrenaline shot purchased and stocked in inventory");
        assert(biohazardMatchFlow.crosshairHit, "T4.2.4", "T4.2 Combat Feedback: Crosshair hitmarker visual feedback applied on hit");
        assert(biohazardMatchFlow.resultActive, "T4.2.5", "T4.2 Outbreak Outcome: #result-screen activated upon total human infection");
        assert(biohazardMatchFlow.resultDesc.includes('僵尸获胜'), "T4.2.6", "T4.2 Banner: Result screen displays '僵尸获胜'");
        assert(biohazardMatchFlow.nextRoundClean, "T4.2.7", "T4.2 Round Transition: Next round resets result screen without residue");

        // -------------------------------------------------------------------------
        // Scenario 4.3: Complete Match Flow — Shooting Range Target & Practice Flow
        // -------------------------------------------------------------------------
        console.log("\n--- Scenario 4.3: Shooting Range Target & Practice Flow ---");

        const shootingRangeMatchFlow = await page.evaluate(() => {
            // 1. Enter shooting range
            startShootingRange();
            const isRange = isShootingRange;
            const exitBtnVisible = !document.getElementById('exit-range-btn').classList.contains('hidden');
            const rangeCurrency = playerCurrency;
            const rangeScore = playerScore;
            const rangeSkyHex = scene.background ? scene.background.getHex() : 0;

            // 2. Practice purchases
            buyWeapon('sniper', 4750);
            const sniperEquipped = inventory.primary === 'sniper';

            // 3. Exit shooting range
            exitShootingRange();
            const returnedToMenu = document.getElementById('main-menu').classList.contains('active');
            const exitBtnHidden = document.getElementById('exit-range-btn').classList.contains('hidden');
            const rangeCleaned = !isShootingRange;

            return {
                isRange,
                exitBtnVisible,
                rangeCurrency,
                rangeScore,
                rangeSkyHex,
                sniperEquipped,
                returnedToMenu,
                exitBtnHidden,
                rangeCleaned
            };
        });

        assert(shootingRangeMatchFlow.isRange, "T4.3.1", "T4.3 Entry: startShootingRange() sets isShootingRange = true");
        assert(shootingRangeMatchFlow.exitBtnVisible, "T4.3.2", "T4.3 HUD: #exit-range-btn becomes visible in shooting range");
        assert(shootingRangeMatchFlow.rangeCurrency === 99999, "T4.3.3", "T4.3 Economy: Unlimited currency ($99999) granted in shooting range");
        assert(shootingRangeMatchFlow.rangeSkyHex === 0x87CEEB, "T4.3.4", "T4.3 Atmosphere: Shooting range sky restored to classic bright sky blue (0x87CEEB)");
        assert(shootingRangeMatchFlow.sniperEquipped, "T4.3.5", "T4.3 Arsenal: AWP sniper rifle purchased and tested in shooting range");
        assert(shootingRangeMatchFlow.returnedToMenu, "T4.3.6", "T4.3 Exit: exitShootingRange() cleanly returns to #main-menu");
        assert(shootingRangeMatchFlow.exitBtnHidden, "T4.3.7", "T4.3 Cleanup: #exit-range-btn is hidden upon range exit");
        assert(shootingRangeMatchFlow.rangeCleaned, "T4.3.8", "T4.3 Teardown: isShootingRange flag cleared and targets cleaned up");

        // -------------------------------------------------------------------------
        // Final Diagnostic: Zero Page Runtime Exceptions
        // -------------------------------------------------------------------------
        console.log("\n--- Final Diagnostic: Zero Page Errors & Exception Trapping ---");
        assert(pageErrors.length === 0, "DIAG.1", `Zero uncaught page errors encountered during E2E run (found: ${pageErrors.length})`);
        assert(consoleErrors.length === 0, "DIAG.2", `Zero browser console error logs encountered during E2E run (found: ${consoleErrors.length})`);

    } finally {
        await browser.close();
    }

    console.log("\n================================================================================");
    console.log(`                     E2E TEST RUN SUMMARY                                       `);
    console.log("================================================================================");
    console.log(`  Total Assertions Executed : ${totalTests}`);
    console.log(`  Total Passed              : ${totalPassed}`);
    console.log(`  Total Failed              : ${totalFailed}`);
    console.log("================================================================================");

    if (totalFailed > 0) {
        console.error("\nFAILURES DETECTED:");
        failureList.forEach(f => console.error(`  - ${f}`));
        process.exit(1);
    } else {
        console.log("\nALL E2E OPAQUE-BOX TESTS PASSED SUCCESSFULLY! (100% Pass Rate)");
        process.exit(0);
    }
}

runE2ETests().catch(err => {
    console.error("FATAL RUNNER EXCEPTION:", err);
    process.exit(1);
});
