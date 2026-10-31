/**
 * Empirical Adversarial Test Harness for Milestone 2 Gate Check
 * 
 * Tests:
 * 1. Viewport Bounding & Overlap across 5 Viewports (Desktop, Laptop, Tablet, Mobile Portrait, Mobile Landscape)
 * 2. Modal Activation & Event Isolation (Clicking #start-btn in mobile portrait not intercepted by #touch-look-zone; touch-ui isolation)
 * 3. Buy Menu Requisition (Rapid clicking through all 26+ weapon, grenade, drone, bullet, and utility buy buttons)
 * 4. Scope Panel Optics Matrix & Deploy Button Contract (button.deploy-btn presence, clickability, optic selection)
 * 5. Result Screen Thematic Styling (.victory / .defeat classes, cyan/crimson styles, bounds adherence)
 * 
 * Execution: node test_challenge_m2_empirical.js
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const failureLog = [];

function assert(condition, testId, message) {
    totalTests++;
    if (condition) {
        console.log(`  [PASS] ${testId}: ${message}`);
        totalPassed++;
    } else {
        console.error(`  [FAIL] ${testId}: ${message}`);
        totalFailed++;
        failureLog.push(`${testId}: ${message}`);
    }
}

function boxesIntersect(r1, r2) {
    return !(
        r2.left >= r1.right ||
        r2.right <= r1.left ||
        r2.top >= r1.bottom ||
        r2.bottom <= r1.top
    );
}

function getIntersectionArea(r1, r2) {
    const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    return xOverlap * yOverlap;
}

const VIEWPORTS = [
    { name: 'Desktop Full HD', width: 1920, height: 1080, isMobile: false, hasTouch: false },
    { name: 'Laptop WXGA', width: 1366, height: 768, isMobile: false, hasTouch: false },
    { name: 'Tablet iPad', width: 768, height: 1024, isMobile: true, hasTouch: true },
    { name: 'Mobile Portrait (iPhone 12/13/14)', width: 390, height: 844, isMobile: true, hasTouch: true },
    { name: 'Mobile Landscape', width: 844, height: 390, isMobile: true, hasTouch: true }
];

async function runMilestone2AdversarialTests() {
    console.log('================================================================================');
    console.log('   MILESTONE 2 EMPIRICAL ADVERSARIAL TEST HARNESS (GATE 1 VERIFICATION)        ');
    console.log('================================================================================\n');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security'
        ]
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    try {
        // =========================================================================
        // SECTION 1: VIEWPORT BOUNDING & MODAL OVERLAP AUDIT (5 VIEWPORTS)
        // =========================================================================
        console.log('================================================================================');
        console.log('>>> FOCUS AREA 1: VIEWPORT BOUNDING & MODAL OVERLAP (5 VIEWPORTS)');
        console.log('================================================================================');

        for (const vp of VIEWPORTS) {
            console.log(`\n--- Auditing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
            const page = await browser.newPage();
            const pageErrors = [];
            page.on('pageerror', err => {
                if (!err.message.includes('requestPointerLock')) {
                    pageErrors.push(err.message);
                }
            });

            await page.setViewport({
                width: vp.width,
                height: vp.height,
                isMobile: vp.isMobile,
                hasTouch: vp.hasTouch
            });

            await page.goto(baseUri, { waitUntil: 'load' });
            await new Promise(r => setTimeout(r, 400));

            // Check 1.1: Main Menu Console Bounding
            const mainMenuBounds = await page.evaluate(() => {
                const consoleEl = document.querySelector('.main-menu-console');
                if (!consoleEl) return null;
                const rect = consoleEl.getBoundingClientRect();
                return {
                    left: rect.left,
                    top: rect.top,
                    right: rect.right,
                    bottom: rect.bottom,
                    width: rect.width,
                    height: rect.height
                };
            });

            assert(mainMenuBounds !== null, `VP.${vp.width}.MM1`, `${vp.name}: .main-menu-console is mounted in DOM`);
            assert(mainMenuBounds.left >= 0 && mainMenuBounds.right <= vp.width + 1, `VP.${vp.width}.MM2`, 
                `${vp.name}: .main-menu-console within horizontal bounds [${Math.round(mainMenuBounds.left)}, ${Math.round(mainMenuBounds.right)}] (width: ${vp.width})`);
            assert(mainMenuBounds.top >= 0 && mainMenuBounds.bottom <= vp.height + 1, `VP.${vp.width}.MM3`, 
                `${vp.name}: .main-menu-console within vertical bounds [${Math.round(mainMenuBounds.top)}, ${Math.round(mainMenuBounds.bottom)}] (height: ${vp.height})`);

            // Start game to check in-game modals
            await page.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            // Check 1.2: Buy Menu Bounding & Overlap with HUD
            await page.evaluate(() => openBuyMenu());
            await page.evaluate(async () => {
                for (let i = 0; i < 15; i++) {
                    await new Promise(requestAnimationFrame);
                }
            });

            const buyMenuMetrics = await page.evaluate(() => {
                const bm = document.getElementById('buy-menu');
                const bmRect = bm ? bm.getBoundingClientRect() : null;
                const style = window.getComputedStyle(bm);

                // Check touch-ui state when buy menu is open
                const touchUi = document.getElementById('touch-ui');
                const touchStyle = touchUi ? window.getComputedStyle(touchUi) : null;

                // Check HUD bottom
                const hudBottom = document.querySelector('.hud-bottom');
                const hudRect = hudBottom ? hudBottom.getBoundingClientRect() : null;

                return {
                    isActive: bm.classList.contains('active') && !bm.classList.contains('hidden'),
                    display: style.display,
                    opacity: style.opacity,
                    rect: bmRect ? { left: bmRect.left, top: bmRect.top, right: bmRect.right, bottom: bmRect.bottom, width: bmRect.width, height: bmRect.height } : null,
                    touchUiPointerEvents: touchStyle ? touchStyle.pointerEvents : null,
                    touchUiOpacity: touchStyle ? touchStyle.opacity : null,
                    hudBottomRect: hudRect ? { left: hudRect.left, top: hudRect.top, right: hudRect.right, bottom: hudRect.bottom } : null
                };
            });

            assert(buyMenuMetrics.isActive, `VP.${vp.width}.BM1`, `${vp.name}: #buy-menu is active and visible`);
            assert(buyMenuMetrics.rect.left >= 0 && buyMenuMetrics.rect.right <= vp.width + 2, `VP.${vp.width}.BM2`,
                `${vp.name}: #buy-menu within horizontal bounds [${Math.round(buyMenuMetrics.rect.left)}, ${Math.round(buyMenuMetrics.rect.right)}]`);
            assert(buyMenuMetrics.rect.top >= 0 && buyMenuMetrics.rect.bottom <= vp.height + 2, `VP.${vp.width}.BM3`,
                `${vp.name}: #buy-menu within vertical bounds [${Math.round(buyMenuMetrics.rect.top)}, ${Math.round(buyMenuMetrics.rect.bottom)}]`);

            if (vp.hasTouch) {
                assert(buyMenuMetrics.touchUiPointerEvents === 'none', `VP.${vp.width}.BM4`,
                    `${vp.name}: #touch-ui pointer-events is 'none' while buy menu is active`);
                assert(parseFloat(buyMenuMetrics.touchUiOpacity) === 0, `VP.${vp.width}.BM5`,
                    `${vp.name}: #touch-ui opacity is 0 while buy menu is active`);
            }

            // Close buy menu
            await page.evaluate(() => closeBuyMenu());
            await new Promise(r => setTimeout(r, 450));

            // Check 1.3: Scope Panel Bounding
            await page.evaluate(() => toggleScopePanel());
            await new Promise(r => setTimeout(r, 300));

            const scopePanelMetrics = await page.evaluate(() => {
                const sp = document.getElementById('scope-panel');
                const rect = sp ? sp.getBoundingClientRect() : null;
                const style = window.getComputedStyle(sp);
                const touchUi = document.getElementById('touch-ui');
                const touchStyle = touchUi ? window.getComputedStyle(touchUi) : null;

                return {
                    isActive: sp.classList.contains('active') && !sp.classList.contains('hidden'),
                    display: style.display,
                    rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
                    touchUiPointerEvents: touchStyle ? touchStyle.pointerEvents : null,
                    touchUiOpacity: touchStyle ? touchStyle.opacity : null
                };
            });

            assert(scopePanelMetrics.isActive, `VP.${vp.width}.SP1`, `${vp.name}: #scope-panel is active and visible`);
            assert(scopePanelMetrics.rect.left >= 0 && scopePanelMetrics.rect.right <= vp.width + 2, `VP.${vp.width}.SP2`,
                `${vp.name}: #scope-panel within horizontal bounds [${Math.round(scopePanelMetrics.rect.left)}, ${Math.round(scopePanelMetrics.rect.right)}]`);
            assert(scopePanelMetrics.rect.top >= 0 && scopePanelMetrics.rect.bottom <= vp.height + 2, `VP.${vp.width}.SP3`,
                `${vp.name}: #scope-panel within vertical bounds [${Math.round(scopePanelMetrics.rect.top)}, ${Math.round(scopePanelMetrics.rect.bottom)}]`);

            if (vp.hasTouch) {
                assert(scopePanelMetrics.touchUiPointerEvents === 'none', `VP.${vp.width}.SP4`,
                    `${vp.name}: #touch-ui pointer-events is 'none' while scope panel is active`);
            }

            // Close scope panel
            await page.evaluate(() => toggleScopePanel());
            await new Promise(r => setTimeout(r, 450));

            // Check 1.4: Result Screen Card Bounding
            await page.evaluate(() => {
                endRound("测试回合胜利！恐怖分子获胜", true, 'elimination');
            });
            await new Promise(r => setTimeout(r, 300));

            const resultScreenMetrics = await page.evaluate(() => {
                const rs = document.getElementById('result-screen');
                const card = rs ? rs.querySelector('.result-card') : null;
                const rect = card ? card.getBoundingClientRect() : null;
                const touchUi = document.getElementById('touch-ui');
                const touchStyle = touchUi ? window.getComputedStyle(touchUi) : null;

                return {
                    isActive: rs.classList.contains('active') && !rs.classList.contains('hidden'),
                    cardRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
                    touchUiPointerEvents: touchStyle ? touchStyle.pointerEvents : null,
                    touchUiOpacity: touchStyle ? touchStyle.opacity : null
                };
            });

            assert(resultScreenMetrics.isActive, `VP.${vp.width}.RS1`, `${vp.name}: #result-screen is active upon endRound`);
            assert(resultScreenMetrics.cardRect.left >= 0 && resultScreenMetrics.cardRect.right <= vp.width + 2, `VP.${vp.width}.RS2`,
                `${vp.name}: .result-card within horizontal bounds [${Math.round(resultScreenMetrics.cardRect.left)}, ${Math.round(resultScreenMetrics.cardRect.right)}]`);
            assert(resultScreenMetrics.cardRect.top >= 0 && resultScreenMetrics.cardRect.bottom <= vp.height + 2, `VP.${vp.width}.RS3`,
                `${vp.name}: .result-card within vertical bounds [${Math.round(resultScreenMetrics.cardRect.top)}, ${Math.round(resultScreenMetrics.cardRect.bottom)}]`);

            if (vp.hasTouch) {
                assert(resultScreenMetrics.touchUiPointerEvents === 'none', `VP.${vp.width}.RS4`,
                    `${vp.name}: #touch-ui pointer-events is 'none' while result screen is active`);
            }

            assert(pageErrors.length === 0, `VP.${vp.width}.ERR`, `${vp.name}: 0 page errors during viewport audit`);

            await page.close();
        }

        // =========================================================================
        // SECTION 2: MODAL ACTIVATION & EVENT ISOLATION (MOBILE PORTRAIT 390x844)
        // =========================================================================
        console.log('\n================================================================================');
        console.log('>>> FOCUS AREA 2: MODAL ACTIVATION & EVENT ISOLATION (MOBILE 390x844)');
        console.log('================================================================================');

        {
            const mobilePage = await browser.newPage();
            const mobileErrors = [];
            mobilePage.on('pageerror', err => {
                if (!err.message.includes('requestPointerLock')) mobileErrors.push(err.message);
            });

            await mobilePage.setViewport({
                width: 390,
                height: 844,
                isMobile: true,
                hasTouch: true
            });

            await mobilePage.goto(baseUri, { waitUntil: 'load' });
            await new Promise(r => setTimeout(r, 400));

            // 2.1 Verify #touch-look-zone and #touch-ui stacking state when #main-menu is active
            const preStartTouchState = await mobilePage.evaluate(() => {
                const touchUi = document.getElementById('touch-ui');
                const lookZone = document.getElementById('touch-look-zone');
                const mainMenu = document.getElementById('main-menu');
                const startBtn = document.getElementById('start-btn');

                const touchStyle = touchUi ? window.getComputedStyle(touchUi) : null;
                const lookStyle = lookZone ? window.getComputedStyle(lookZone) : null;
                const menuStyle = mainMenu ? window.getComputedStyle(mainMenu) : null;
                const btnRect = startBtn ? startBtn.getBoundingClientRect() : null;

                // Test elementFromPoint at center of #start-btn
                const hitElement = document.elementFromPoint(
                    btnRect.left + btnRect.width / 2,
                    btnRect.top + btnRect.height / 2
                );

                return {
                    mainMenuActive: mainMenu && mainMenu.classList.contains('active'),
                    touchUiPointerEvents: touchStyle ? touchStyle.pointerEvents : null,
                    touchUiOpacity: touchStyle ? touchStyle.opacity : null,
                    lookZonePointerEvents: lookStyle ? lookStyle.pointerEvents : null,
                    menuZIndex: menuStyle ? menuStyle.zIndex : null,
                    hitElementId: hitElement ? hitElement.id : null,
                    hitElementTag: hitElement ? hitElement.tagName : null
                };
            });

            assert(preStartTouchState.mainMenuActive, "M2.2.1", "Main menu is active on mobile portrait load");
            assert(preStartTouchState.touchUiPointerEvents === 'none', "M2.2.2", 
                "#touch-ui has pointer-events: none when #main-menu is active");
            assert(parseFloat(preStartTouchState.touchUiOpacity) === 0, "M2.2.3", 
                "#touch-ui has opacity: 0 when #main-menu is active");
            assert(preStartTouchState.lookZonePointerEvents === 'none', "M2.2.4", 
                "#touch-look-zone has pointer-events: none via body:has(#main-menu.active) #touch-ui * rule");
            assert(parseInt(preStartTouchState.menuZIndex) >= 50, "M2.2.5", 
                `#main-menu z-index is >= 50 (actual: ${preStartTouchState.menuZIndex})`);
            assert(preStartTouchState.hitElementId === 'start-btn', "M2.2.6", 
                `elementFromPoint on #start-btn resolves directly to #start-btn (hit: ${preStartTouchState.hitElementTag}#${preStartTouchState.hitElementId}), NOT intercepted by #touch-look-zone`);

            // 2.2 Verify real click on #start-btn starts the game
            await mobilePage.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            const postStartGameState = await mobilePage.evaluate(() => {
                const mainMenu = document.getElementById('main-menu');
                const gameScreen = document.getElementById('game-screen');
                const touchUi = document.getElementById('touch-ui');
                const touchStyle = touchUi ? window.getComputedStyle(touchUi) : null;

                return {
                    mainMenuHidden: mainMenu.classList.contains('hidden') || !mainMenu.classList.contains('active'),
                    gameScreenActive: gameScreen.classList.contains('active'),
                    roundActive: typeof roundActive !== 'undefined' ? roundActive : false,
                    touchUiPointerEvents: touchStyle ? touchStyle.pointerEvents : null,
                    touchUiOpacity: touchStyle ? touchStyle.opacity : null
                };
            });

            assert(postStartGameState.mainMenuHidden, "M2.2.7", "#start-btn click cleanly deactivated #main-menu");
            assert(postStartGameState.gameScreenActive, "M2.2.8", "#game-screen is active after #start-btn click");
            assert(postStartGameState.roundActive, "M2.2.9", "roundActive is true in game logic");
            assert(parseFloat(postStartGameState.touchUiOpacity) > 0, "M2.2.10", 
                "#touch-ui opacity restored to visible in gameplay");

            // 2.3 Verify Buy Menu click and close button isolation on Mobile
            await mobilePage.evaluate(() => openBuyMenu());
            await new Promise(r => setTimeout(r, 300));

            const buyMenuMobileIsolation = await mobilePage.evaluate(() => {
                const bm = document.getElementById('buy-menu');
                const closeBtn = bm ? bm.querySelector('button.deploy-btn') : null;
                const btnRect = closeBtn ? closeBtn.getBoundingClientRect() : null;
                const hitEl = btnRect ? document.elementFromPoint(btnRect.left + btnRect.width / 2, btnRect.top + btnRect.height / 2) : null;
                return {
                    hitMatch: hitEl === closeBtn,
                    hitTag: hitEl ? hitEl.tagName : null,
                    hitClass: hitEl ? hitEl.className : null
                };
            });

            assert(buyMenuMobileIsolation.hitMatch, "M2.2.11", 
                `Buy menu close button is not intercepted by touch layer (hit: ${buyMenuMobileIsolation.hitTag}.${buyMenuMobileIsolation.hitClass})`);

            // Click close button on buy menu
            await mobilePage.click('#buy-menu button.deploy-btn');
            await new Promise(r => setTimeout(r, 450));

            const buyMenuClosedState = await mobilePage.evaluate(() => {
                const bm = document.getElementById('buy-menu');
                return bm.classList.contains('hidden') || !bm.classList.contains('active');
            });
            assert(buyMenuClosedState, "M2.2.12", "Clicking #buy-menu button.deploy-btn successfully closes buy menu");

            await mobilePage.close();
        }

        // =========================================================================
        // SECTION 3: BUY MENU REQUISITION STRESS TEST (RAPID PROGRAMMATIC CLICKING)
        // =========================================================================
        console.log('\n================================================================================');
        console.log('>>> FOCUS AREA 3: BUY MENU REQUISITION (RAPID CLICKING ALL BUY HOOKS)');
        console.log('================================================================================');

        {
            const shopPage = await browser.newPage();
            shopPage.on('pageerror', err => {
                if (!err.message.includes('requestPointerLock')) console.error('SHOP PAGE ERROR:', err.message);
            });

            await shopPage.setViewport({ width: 1920, height: 1080 });
            await shopPage.goto(baseUri, { waitUntil: 'load' });
            await shopPage.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            // Open buy menu and grant currency for stress test
            await shopPage.evaluate(() => {
                playerCurrency = 500000;
                playerScore = 50000;
                openBuyMenu();
            });
            await new Promise(r => setTimeout(r, 300));

            // List of all Primary Weapons to test
            const primaryWeapons = [
                { type: 'rifle', cost: 2700, name: '突击步枪 (AK-47)' },
                { type: 'sniper', cost: 4750, name: '狙击步枪 (AWP)' },
                { type: 'marksman', cost: 3300, name: '射手步枪 (DMR)' },
                { type: 'smg', cost: 2350, name: '冲锋枪 (P90)' },
                { type: 'mk4', cost: 1950, name: 'MK4 (三连发冲锋枪)' },
                { type: 'shotgun', cost: 1200, name: '霰弹枪 (Nova)' },
                { type: 'm249', cost: 5200, name: '重机枪 (M249)' },
                { type: 'gatling', cost: 7500, name: '加特林 (Gatling)' },
                { type: 'ash12', cost: 5000, name: 'ASH-12 (突击步枪)' },
                { type: 'flamethrower', cost: 4200, name: '喷火器 (Flamethrower)' },
                { type: 'mortar', cost: 6000, name: '迫击炮 (Mortar)' }
            ];

            console.log('\n--- 3.1 Primary Weapons Rapid Requisition ---');
            for (const pw of primaryWeapons) {
                const buyResult = await shopPage.evaluate((type, cost) => {
                    const prevCredits = playerCurrency;
                    buyWeapon(type, cost);
                    const hudName = document.getElementById('weapon-name').innerText;
                    const hudCredits = parseInt(document.getElementById('hud-credits').innerText);
                    const buyCredits = parseInt(document.getElementById('buy-credits').innerText);
                    return {
                        assigned: inventory.primary === type,
                        activeSlot: inventory.currentSlot === 1,
                        creditsDeducted: prevCredits - playerCurrency === cost,
                        hudCreditsMatch: hudCredits === playerCurrency,
                        buyCreditsMatch: buyCredits === playerCurrency,
                        hudName
                    };
                }, pw.type, pw.cost);

                assert(buyResult.assigned, `REQ.PW.${pw.type}`, `buyWeapon('${pw.type}') assigned to inventory.primary`);
                assert(buyResult.activeSlot, `REQ.PW.SLOT.${pw.type}`, `Purchasing ${pw.type} switched to slot 1`);
                assert(buyResult.creditsDeducted, `REQ.PW.COST.${pw.type}`, `Deducted $${pw.cost} from currency`);
                assert(buyResult.hudCreditsMatch && buyResult.buyCreditsMatch, `REQ.PW.DOM.${pw.type}`, `DOM credits telemetry updated properly for ${pw.type}`);
            }

            console.log('\n--- 3.2 Secondary Weapons Rapid Requisition ---');
            const secondaryWeapons = [
                { type: 'pistol', cost: 200, name: '格洛克手枪 (Glock)' },
                { type: 'deagle', cost: 700, name: '沙漠之鹰 (Deagle)' }
            ];

            for (const sw of secondaryWeapons) {
                const buyResult = await shopPage.evaluate((type, cost) => {
                    const prevCredits = playerCurrency;
                    buyWeapon(type, cost);
                    return {
                        assigned: inventory.secondary === type,
                        activeSlot: inventory.currentSlot === 2,
                        creditsDeducted: prevCredits - playerCurrency === cost
                    };
                }, sw.type, sw.cost);

                assert(buyResult.assigned, `REQ.SW.${sw.type}`, `buyWeapon('${sw.type}') assigned to inventory.secondary`);
                assert(buyResult.activeSlot, `REQ.SW.SLOT.${sw.type}`, `Purchasing ${sw.type} switched to slot 2`);
                assert(buyResult.creditsDeducted, `REQ.SW.COST.${sw.type}`, `Deducted $${sw.cost} from currency`);
            }

            console.log('\n--- 3.3 Throwables & Tactical Drone Requisition ---');
            const throwables = [
                { id: 'btn-throwable-hegrenade', type: 'hegrenade', cost: 300 },
                { id: 'btn-throwable-flashbang', type: 'flashbang', cost: 200 },
                { id: 'btn-throwable-molotov', type: 'molotov', cost: 400 },
                { id: 'btn-throwable-smoke', type: 'smoke', cost: 300 },
                { id: 'btn-throwable-sandbag', type: 'sandbag', cost: 50 },
                { id: 'btn-throwable-mine', type: 'mine', cost: 300 },
                { id: 'btn-drone', type: 'drone', cost: 800 }
            ];

            for (const th of throwables) {
                const clickResult = await shopPage.evaluate((btnId, type, cost) => {
                    const btn = document.getElementById(btnId);
                    if (!btn) return { exists: false };
                    const prevCount = inventory.grenades[type] || 0;
                    const prevCredits = playerCurrency;
                    btn.click();
                    const newCount = inventory.grenades[type] || 0;
                    const slot4 = document.getElementById('slot-4');
                    return {
                        exists: true,
                        countIncremented: newCount === prevCount + 1,
                        creditsDeducted: prevCredits - playerCurrency === cost,
                        slot4Visible: slot4 && !slot4.classList.contains('hidden')
                    };
                }, th.id, th.type, th.cost);

                assert(clickResult.exists, `REQ.TH.EXISTS.${th.type}`, `DOM button #${th.id} exists`);
                assert(clickResult.countIncremented, `REQ.TH.INC.${th.type}`, `Clicking #${th.id} incremented inventory.grenades['${th.type}']`);
                assert(clickResult.creditsDeducted, `REQ.TH.COST.${th.type}`, `Clicking #${th.id} deducted $${th.cost}`);
                assert(clickResult.slot4Visible, `REQ.TH.SLOT4.${th.type}`, `Inventory slot 4 unhidden on throwable purchase`);
            }

            console.log('\n--- 3.4 Bullet Types & Stacking Requisition ---');
            const bulletTypes = [
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
                'btn-bullet-fragment'
            ];

            for (const btId of bulletTypes) {
                const btResult = await shopPage.evaluate((btnId) => {
                    const btn = document.getElementById(btnId);
                    if (!btn) return { exists: false };
                    btn.click();
                    const btType = btnId.replace('btn-bullet-', '');
                    const hudBt = document.getElementById('bullet-type-display').innerText;
                    return {
                        exists: true,
                        bulletTypeSet: playerState.bulletType === btType,
                        hudDisplay: hudBt
                    };
                }, btId);

                assert(btResult.exists, `REQ.BT.EXISTS.${btId}`, `Bullet button #${btId} exists`);
                assert(btResult.bulletTypeSet, `REQ.BT.SET.${btId}`, `Clicking #${btId} set playerState.bulletType`);
            }

            // Test bullet stacking button
            const stackResult = await shopPage.evaluate(() => {
                const btn = document.getElementById('btn-bullet-stacking');
                if (!btn) return { exists: false };
                btn.click();
                return {
                    exists: true,
                    stackingActive: playerState.bulletStacking === true,
                    typesCount: playerState.bulletTypes.length
                };
            });
            assert(stackResult.exists && stackResult.stackingActive, "REQ.BT.STACK", "buyBulletStacking() activated successfully");

            console.log('\n--- 3.5 Utilities, Armor, Ammo & Biohazard Serum ---');
            // Drop comp
            const dropCompResult = await shopPage.evaluate(() => {
                const btn = document.getElementById('btn-drop-comp');
                if (!btn) return { exists: false };
                btn.click();
                return {
                    exists: true,
                    purchased: dropCompensationPurchased === true,
                    btnDisabled: btn.disabled === true
                };
            });
            assert(dropCompResult.purchased, "REQ.UTIL.DROPCOMP", "buyDropCompensation() sets dropCompensationPurchased");

            // Medkit (damage player first, then buy medkit)
            const medkitResult = await shopPage.evaluate(() => {
                playerState.hp = 45;
                const btn = document.getElementById('btn-medkit');
                if (!btn) return { exists: false };
                btn.click();
                return {
                    exists: true,
                    hpRestored: playerState.hp === 100,
                    hudHpVal: document.getElementById('hp-val').innerText
                };
            });
            assert(medkitResult.hpRestored && medkitResult.hudHpVal === '100', "REQ.UTIL.MEDKIT", "buyMedkit() restored HP to 100 and updated #hp-val");

            // Armor Plate
            const armorResult = await shopPage.evaluate(() => {
                playerState.armorPlates = 0;
                buyArmorPlate();
                buyArmorPlate();
                const hudArmor = document.getElementById('hud-armor').innerText;
                return {
                    plates: playerState.armorPlates,
                    hudArmor
                };
            });
            assert(armorResult.plates === 2 && armorResult.hudArmor.includes('2/6 (30%)'), "REQ.UTIL.ARMOR", "buyArmorPlate() updated armorPlates and #hud-armor");

            // Ammo
            const ammoResult = await shopPage.evaluate(() => {
                switchWeapon(1);
                ammoState.primary.reserve = 10;
                buyAmmo();
                return {
                    reserveIncremented: ammoState.primary.reserve > 10,
                    reserveVal: ammoState.primary.reserve
                };
            });
            assert(ammoResult.reserveIncremented, "REQ.UTIL.AMMO", `buyAmmo() replenished reserve ammunition (${ammoResult.reserveVal} rounds)`);

            // Biohazard Mode Switch & Zombie Serum
            const serumResult = await shopPage.evaluate(() => {
                selectGameMode('zombie');
                zombieState.pending = false; // Outbreak occurred
                playerCurrency = 10000;
                const serumBtn = document.getElementById('btn-zombie-serum');
                if (!serumBtn) return { exists: false };
                const prevCredits = playerCurrency;
                serumBtn.click();
                return {
                    exists: true,
                    deducted: prevCredits - playerCurrency === ZOMBIE.serumCost,
                    isZombie: playerState.isZombie === true || playerState.team === 'ZOMBIE'
                };
            });
            assert(serumResult.exists, "REQ.BIO.SERUM.EXISTS", "#btn-zombie-serum exists in DOM");
            assert(serumResult.deducted, "REQ.BIO.SERUM.COST", "Clicking #btn-zombie-serum deducted serumCost");
            assert(serumResult.isZombie, "REQ.BIO.SERUM.INFECT", "buyZombieSerum() mutated player into Zombie");

            await shopPage.close();
        }

        // =========================================================================
        // SECTION 4: SCOPE PANEL OPTICS MATRIX & DEPLOY BUTTON CONTRACT
        // =========================================================================
        console.log('\n================================================================================');
        console.log('>>> FOCUS AREA 4: SCOPE PANEL OPTICS MATRIX & DEPLOY BUTTON CONTRACT');
        console.log('================================================================================');

        {
            const scopeTestPage = await browser.newPage();
            await scopeTestPage.setViewport({ width: 1920, height: 1080 });
            await scopeTestPage.goto(baseUri, { waitUntil: 'load' });
            await scopeTestPage.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            // Verify contract button.deploy-btn inside #scope-panel
            const deployBtnContract = await scopeTestPage.evaluate(() => {
                const sp = document.getElementById('scope-panel');
                const btn = sp ? sp.querySelector('button.deploy-btn') : null;
                return {
                    panelExists: !!sp,
                    deployBtnExists: !!btn,
                    btnText: btn ? btn.innerText.trim() : '',
                    hasOnclick: btn ? btn.getAttribute('onclick') : null
                };
            });

            assert(deployBtnContract.deployBtnExists, "SCOPE.CONTRACT.1", "button.deploy-btn exists inside #scope-panel");
            assert(deployBtnContract.btnText.includes('关闭'), "SCOPE.CONTRACT.2", "button.deploy-btn has expected label ('关闭')");
            assert(deployBtnContract.hasOnclick && deployBtnContract.hasOnclick.includes('toggleScopePanel'), "SCOPE.CONTRACT.3", 
                "button.deploy-btn triggers toggleScopePanel()");

            // Open scope panel
            await scopeTestPage.evaluate(() => toggleScopePanel());
            await new Promise(r => setTimeout(r, 300));

            const scopeGridCount = await scopeTestPage.evaluate(() => {
                const grid = document.getElementById('scope-grid');
                return grid ? grid.querySelectorAll('button').length : 0;
            });
            assert(scopeGridCount === 8, "SCOPE.GRID.COUNT", `Optics matrix renders exactly 8 scope buttons (actual: ${scopeGridCount})`);

            // Test selecting each optic
            const optics = ['none', 'redDot', 'holo', 'scope2x', 'scope3x', 'scope4x', 'scope5x', 'scope8x'];
            for (const optic of optics) {
                const selectResult = await scopeTestPage.evaluate((sid) => {
                    selectScope(sid);
                    const label = document.getElementById('current-scope-label').innerText;
                    return {
                        currentScope: playerState.currentScope,
                        label
                    };
                }, optic);

                assert(selectResult.currentScope === optic, `SCOPE.SELECT.${optic}`, 
                    `selectScope('${optic}') sets playerState.currentScope = '${optic}' (label: ${selectResult.label})`);
            }

            // Click button.deploy-btn to close panel
            await scopeTestPage.click('#scope-panel button.deploy-btn');
            await new Promise(r => setTimeout(r, 450));

            const closedState = await scopeTestPage.evaluate(() => {
                const sp = document.getElementById('scope-panel');
                return sp.classList.contains('hidden') && !sp.classList.contains('active');
            });
            assert(closedState, "SCOPE.DEPLOY.CLOSE", "Clicking button.deploy-btn closes scope panel (.hidden, !.active)");

            await scopeTestPage.close();
        }

        // =========================================================================
        // SECTION 5: RESULT SCREEN THEMATIC STYLING & VIEWPORT ADHERENCE
        // =========================================================================
        console.log('\n================================================================================');
        console.log('>>> FOCUS AREA 5: RESULT SCREEN STYLING (.VICTORY / .DEFEAT) & BOUNDS');
        console.log('================================================================================');

        {
            const resultPage = await browser.newPage();
            await resultPage.setViewport({ width: 1920, height: 1080 });
            await resultPage.goto(baseUri, { waitUntil: 'load' });
            await resultPage.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            // 5.1 Test Victory State
            console.log('\n--- 5.1 Testing Result Screen Victory State ---');
            await resultPage.evaluate(() => {
                playerState.team = 'T';
                endRound("所有反恐精英已被消灭！恐怖分子获胜", true, 'elimination');
            });
            await new Promise(r => setTimeout(r, 300));

            const victoryStyles = await resultPage.evaluate(() => {
                const rs = document.getElementById('result-screen');
                const card = rs ? rs.querySelector('.result-card') : null;
                const title = document.getElementById('result-title');

                const cardStyle = card ? window.getComputedStyle(card) : null;
                const titleStyle = title ? window.getComputedStyle(title) : null;

                return {
                    hasVictoryClass: rs.classList.contains('victory'),
                    hasDefeatClass: rs.classList.contains('defeat'),
                    cardBorderColor: cardStyle ? cardStyle.borderColor : null,
                    cardBoxShadow: cardStyle ? cardStyle.boxShadow : null,
                    titleColor: titleStyle ? titleStyle.color : null,
                    titleTextShadow: titleStyle ? titleStyle.textShadow : null
                };
            });

            assert(victoryStyles.hasVictoryClass, "RS.VIC.CLASS.1", "#result-screen has .victory class on player win");
            assert(!victoryStyles.hasDefeatClass, "RS.VIC.CLASS.2", "#result-screen does NOT have .defeat class on player win");
            assert(victoryStyles.cardBorderColor && (victoryStyles.cardBorderColor.includes('0, 240, 255') || victoryStyles.cardBorderColor.includes('cyan')),
                "RS.VIC.STYLE.BORDER", `Victory card has Nanite Cyan border (actual: ${victoryStyles.cardBorderColor})`);
            assert(victoryStyles.titleColor && (victoryStyles.titleColor.includes('0, 240, 255') || victoryStyles.titleColor.includes('cyan')),
                "RS.VIC.STYLE.TITLE", `Victory title has Nanite Cyan color (actual: ${victoryStyles.titleColor})`);

            // 5.2 Test Defeat State
            console.log('\n--- 5.2 Testing Result Screen Defeat State ---');
            await resultPage.evaluate(() => {
                nextRound();
                roundActive = true;
                playerState.team = 'T';
                endRound("所有恐怖分子已被消灭！反恐精英获胜", false, 'elimination');
            });
            await new Promise(r => setTimeout(r, 300));

            const defeatStyles = await resultPage.evaluate(() => {
                const rs = document.getElementById('result-screen');
                const card = rs ? rs.querySelector('.result-card') : null;
                const title = document.getElementById('result-title');

                const cardStyle = card ? window.getComputedStyle(card) : null;
                const titleStyle = title ? window.getComputedStyle(title) : null;

                return {
                    hasVictoryClass: rs.classList.contains('victory'),
                    hasDefeatClass: rs.classList.contains('defeat'),
                    cardBorderColor: cardStyle ? cardStyle.borderColor : null,
                    cardBoxShadow: cardStyle ? cardStyle.boxShadow : null,
                    titleColor: titleStyle ? titleStyle.color : null
                };
            });

            assert(!defeatStyles.hasVictoryClass, "RS.DEF.CLASS.1", "#result-screen does NOT have .victory class on player loss");
            assert(defeatStyles.hasDefeatClass, "RS.DEF.CLASS.2", "#result-screen has .defeat class on player loss");
            assert(defeatStyles.cardBorderColor && (defeatStyles.cardBorderColor.includes('255, 42, 75') || defeatStyles.cardBorderColor.includes('crimson')),
                "RS.DEF.STYLE.BORDER", `Defeat card has Crimson Laser border (actual: ${defeatStyles.cardBorderColor})`);
            assert(defeatStyles.titleColor && (defeatStyles.titleColor.includes('255, 42, 75') || defeatStyles.titleColor.includes('crimson')),
                "RS.DEF.STYLE.TITLE", `Defeat title has Crimson Laser color (actual: ${defeatStyles.titleColor})`);

            // 5.3 Test nextRound() Clean Teardown
            console.log('\n--- 5.3 Testing nextRound() Result Screen Reset ---');
            await resultPage.evaluate(() => nextRound());
            await new Promise(r => setTimeout(r, 300));

            const resetState = await resultPage.evaluate(() => {
                const rs = document.getElementById('result-screen');
                return {
                    hidden: rs.classList.contains('hidden'),
                    active: rs.classList.contains('active'),
                    victory: rs.classList.contains('victory'),
                    defeat: rs.classList.contains('defeat')
                };
            });

            assert(resetState.hidden && !resetState.active, "RS.RESET.1", "nextRound() adds .hidden and removes .active");
            assert(!resetState.victory && !resetState.defeat, "RS.RESET.2", "nextRound() removes both .victory and .defeat classes");

            await resultPage.close();
        }

    } finally {
        await browser.close();
    }

    console.log('\n================================================================================');
    console.log('                     M2 ADVERSARIAL TEST SUMMARY                                ');
    console.log('================================================================================');
    console.log(`  Total Assertions Executed : ${totalTests}`);
    console.log(`  Total Passed              : ${totalPassed}`);
    console.log(`  Total Failed              : ${totalFailed}`);
    console.log('================================================================================');

    if (totalFailed > 0) {
        console.error('FAILURES:');
        failureLog.forEach(f => console.error(`  - ${f}`));
        console.error('\n>>> VERDICT: REQUEST_CHANGES <<<');
        process.exit(1);
    } else {
        console.log('\n>>> VERDICT: APPROVE <<<');
        process.exit(0);
    }
}

runMilestone2AdversarialTests().catch(err => {
    console.error('FATAL UNCAUGHT RUNNER ERROR:', err);
    process.exit(1);
});
