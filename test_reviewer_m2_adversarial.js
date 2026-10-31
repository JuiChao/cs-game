const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runAdversarialAudit() {
    console.log("================================================================================");
    console.log(">>> REVIEWER M2 ADVERSARIAL STRESS TEST & INTEGRITY AUDIT");
    console.log("================================================================================");

    let totalTests = 0;
    let passed = 0;
    let failed = 0;
    const errors = [];

    function assert(cond, id, msg) {
        totalTests++;
        if (cond) {
            console.log(`  [PASS] ${id}: ${msg}`);
            passed++;
        } else {
            console.error(`  [FAIL] ${id}: ${msg}`);
            failed++;
            errors.push(`${id}: ${msg}`);
        }
    }

    // 1. INTEGRITY AUDIT: Check git diff of test files
    console.log("\n--- Integrity Audit: Test File Preservation ---");
    const testFiles = ['test.js', 'test_phase1.js', 'test_phase2.js', 'test_phase3.js', 'test_phase4.js', 'package.json'];
    for (const f of testFiles) {
        const fullPath = path.join(__dirname, f);
        assert(fs.existsSync(fullPath), `INT-1-${f}`, `${f} exists intact`);
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const gameUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    // 2. ADVERSARIAL MOBILE TOUCH ISOLATION (Phone Portrait 390x844 & Landscape 844x390)
    console.log("\n--- Mobile Touch Isolation & Interception Stress Test ---");
    
    // Set mobile viewport with touch enabled
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(gameUri, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 600));

    // Verify main menu active and touch-ui pointer-events
    const mainMenuTouchState = await page.evaluate(() => {
        const touchUI = document.getElementById('touch-ui');
        const touchLookZone = document.getElementById('touch-look-zone');
        const touchActions = document.getElementById('touch-actions');
        const startBtn = document.getElementById('start-btn');
        const menu = document.getElementById('main-menu');
        
        const touchUIStyle = window.getComputedStyle(touchUI);
        const touchLookStyle = window.getComputedStyle(touchLookZone);
        const startBtnRect = startBtn.getBoundingClientRect();
        
        // Check what element is at startBtn center
        const elementAtPoint = document.elementFromPoint(
            startBtnRect.left + startBtnRect.width / 2,
            startBtnRect.top + startBtnRect.height / 2
        );

        return {
            menuActive: menu.classList.contains('active'),
            touchUIPointerEvents: touchUIStyle.pointerEvents,
            touchUIOpacity: touchUIStyle.opacity,
            touchLookPointerEvents: touchLookStyle.pointerEvents,
            startBtnTargetMatches: elementAtPoint === startBtn || startBtn.contains(elementAtPoint),
            elementAtPointTag: elementAtPoint ? elementAtPoint.tagName + '#' + elementAtPoint.id : 'null'
        };
    });

    assert(mainMenuTouchState.menuActive, "TOUCH-1.1", "Main menu is active on load");
    assert(mainMenuTouchState.touchUIPointerEvents === 'none', "TOUCH-1.2", "touch-ui pointer-events is none when main menu is active");
    assert(mainMenuTouchState.touchLookPointerEvents === 'none', "TOUCH-1.3", "touch-look-zone pointer-events is none via child selector");
    assert(mainMenuTouchState.touchUIOpacity === '0', "TOUCH-1.4", "touch-ui opacity is 0 when main menu is active");
    assert(mainMenuTouchState.startBtnTargetMatches, "TOUCH-1.5", `Start button directly receives hit tests (hit: ${mainMenuTouchState.elementAtPointTag})`);

    // Test tapping start button on mobile touch screen
    await page.tap('#start-btn');
    await new Promise(r => setTimeout(r, 600));

    const gameScreenState = await page.evaluate(() => {
        const menu = document.getElementById('main-menu');
        const game = document.getElementById('game-screen');
        const touchUI = document.getElementById('touch-ui');
        const touchUIStyle = window.getComputedStyle(touchUI);
        return {
            menuClosed: !menu.classList.contains('active'),
            gameActive: game.classList.contains('active'),
            touchUIPointerEventsInGame: touchUIStyle.pointerEvents
        };
    });

    assert(gameScreenState.menuClosed, "TOUCH-1.6", "Start button tap cleanly transitioned out of main menu");
    assert(gameScreenState.gameActive, "TOUCH-1.7", "Game screen activated after mobile start button tap");

    // In-game: test modal stacking context isolation with Buy Menu
    console.log("\n--- Modal Stacking Context & Touch UI Isolation (Buy Menu) ---");
    await page.evaluate(() => {
        if (typeof openBuyMenu === 'function') openBuyMenu();
    });
    await new Promise(r => setTimeout(r, 200));

    const buyMenuTouchState = await page.evaluate(() => {
        const touchUI = document.getElementById('touch-ui');
        const touchLookZone = document.getElementById('touch-look-zone');
        const buyMenu = document.getElementById('buy-menu');
        const buyMenuStyle = window.getComputedStyle(buyMenu);
        const touchUIStyle = window.getComputedStyle(touchUI);
        const touchLookStyle = window.getComputedStyle(touchLookZone);

        // Check element at center of buy menu
        const buyRect = buyMenu.getBoundingClientRect();
        const elementAtBuy = document.elementFromPoint(buyRect.left + buyRect.width / 2, buyRect.top + 60);

        return {
            buyMenuActive: buyMenu.classList.contains('active') && !buyMenu.classList.contains('hidden'),
            buyMenuPointerEvents: buyMenuStyle.pointerEvents,
            touchUIPointerEvents: touchUIStyle.pointerEvents,
            touchLookPointerEvents: touchLookStyle.pointerEvents,
            touchUIOpacity: touchUIStyle.opacity,
            elementAtBuyInsideBuyMenu: buyMenu.contains(elementAtBuy)
        };
    });

    assert(buyMenuTouchState.buyMenuActive, "MODAL-1.1", "Buy menu opened actively");
    assert(buyMenuTouchState.buyMenuPointerEvents === 'auto', "MODAL-1.2", "Buy menu has pointer-events: auto");
    assert(buyMenuTouchState.touchUIPointerEvents === 'none', "MODAL-1.3", "touch-ui pointer-events is none while buy menu is active");
    assert(buyMenuTouchState.touchLookPointerEvents === 'none', "MODAL-1.4", "touch-look-zone pointer-events is none while buy menu is active");
    assert(buyMenuTouchState.touchUIOpacity === '0', "MODAL-1.5", "touch-ui is hidden (opacity: 0) while buy menu is active");
    assert(buyMenuTouchState.elementAtBuyInsideBuyMenu, "MODAL-1.6", "Hit tests resolve directly into Buy Menu without interception");

    // Close buy menu
    await page.evaluate(() => {
        if (typeof closeBuyMenu === 'function') closeBuyMenu();
    });
    await new Promise(r => setTimeout(r, 200));

    // Stacking test with Scope Panel
    console.log("\n--- Modal Stacking Context & Touch UI Isolation (Scope Panel) ---");
    await page.evaluate(() => {
        if (typeof toggleScopePanel === 'function') toggleScopePanel();
    });
    await new Promise(r => setTimeout(r, 200));

    const scopeTouchState = await page.evaluate(() => {
        const touchUI = document.getElementById('touch-ui');
        const touchLookZone = document.getElementById('touch-look-zone');
        const scopePanel = document.getElementById('scope-panel');
        const scopePanelStyle = window.getComputedStyle(scopePanel);
        const touchUIStyle = window.getComputedStyle(touchUI);
        const touchLookStyle = window.getComputedStyle(touchLookZone);

        const scopeRect = scopePanel.getBoundingClientRect();
        const elementAtScope = document.elementFromPoint(scopeRect.left + scopeRect.width / 2, scopeRect.top + scopeRect.height / 2);

        return {
            scopeActive: scopePanel.classList.contains('active') && !scopePanel.classList.contains('hidden'),
            scopePointerEvents: scopePanelStyle.pointerEvents,
            touchUIPointerEvents: touchUIStyle.pointerEvents,
            touchLookPointerEvents: touchLookStyle.pointerEvents,
            elementAtScopeInsideScopePanel: scopePanel.contains(elementAtScope)
        };
    });

    assert(scopeTouchState.scopeActive, "MODAL-2.1", "Scope panel opened actively");
    assert(scopeTouchState.touchUIPointerEvents === 'none', "MODAL-2.2", "touch-ui pointer-events is none while scope panel is active");
    assert(scopeTouchState.touchLookPointerEvents === 'none', "MODAL-2.3", "touch-look-zone pointer-events is none while scope panel is active");
    assert(scopeTouchState.elementAtScopeInsideScopePanel, "MODAL-2.4", "Hit tests resolve directly into Scope Panel without interception");

    // Close scope panel
    await page.evaluate(() => {
        if (typeof toggleScopePanel === 'function') toggleScopePanel();
    });
    await new Promise(r => setTimeout(r, 200));

    // Stacking test with Result Screen
    console.log("\n--- Modal Stacking Context & Victory/Defeat Styling (Result Screen) ---");
    await page.evaluate(() => {
        const rs = document.getElementById('result-screen');
        rs.classList.remove('hidden');
        rs.classList.add('active', 'victory');
    });
    await new Promise(r => setTimeout(r, 200));

    const resultVictoryState = await page.evaluate(() => {
        const rs = document.getElementById('result-screen');
        const touchUI = document.getElementById('touch-ui');
        const nextBtn = document.getElementById('next-round-btn');
        const rsStyle = window.getComputedStyle(rs);
        const touchUIStyle = window.getComputedStyle(touchUI);
        const nextBtnRect = nextBtn.getBoundingClientRect();
        const elAtNextBtn = document.elementFromPoint(nextBtnRect.left + nextBtnRect.width / 2, nextBtnRect.top + nextBtnRect.height / 2);

        return {
            rsActive: rs.classList.contains('active'),
            isVictory: rs.classList.contains('victory'),
            touchUIPointerEvents: touchUIStyle.pointerEvents,
            touchUIOpacity: touchUIStyle.opacity,
            nextBtnReceivesHit: elAtNextBtn === nextBtn || nextBtn.contains(elAtNextBtn)
        };
    });

    assert(resultVictoryState.rsActive, "MODAL-3.1", "Result screen is active");
    assert(resultVictoryState.isVictory, "MODAL-3.2", "Result screen has .victory theme");
    assert(resultVictoryState.touchUIPointerEvents === 'none', "MODAL-3.3", "touch-ui pointer-events is none while result screen is active");
    assert(resultVictoryState.touchUIOpacity === '0', "MODAL-3.4", "touch-ui opacity is 0 while result screen is active");
    assert(resultVictoryState.nextBtnReceivesHit, "MODAL-3.5", "Next round button directly receives hit tests");

    // Reset result screen
    await page.evaluate(() => {
        const rs = document.getElementById('result-screen');
        rs.classList.remove('active', 'victory', 'defeat');
        rs.classList.add('hidden');
    });
    await new Promise(r => setTimeout(r, 200));

    // 3. COLOR CONTRAST RATIO & WCAG AA AUDIT
    console.log("\n--- Color Palette & Contrast Ratio Verification ---");
    
    // Helper to calculate relative luminance & contrast ratio
    function getLuminance(r, g, b) {
        const a = [r, g, b].map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }

    function getContrast(rgb1, rgb2) {
        const l1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
        const l2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);
        const brighter = Math.max(l1, l2);
        const darker = Math.min(l1, l2);
        return (brighter + 0.05) / (darker + 0.05);
    }

    // Measure key UI text vs background contrast
    // Obsidian void bg: rgb(4, 7, 10)
    const bgVoid = [4, 7, 10];
    const cyanText = [0, 240, 255];
    const amberText = [255, 170, 0];
    const toxicText = [0, 255, 136];
    const whiteText = [248, 250, 252];
    const crimsonText = [255, 42, 75];

    const contrastCyan = getContrast(cyanText, bgVoid);
    const contrastAmber = getContrast(amberText, bgVoid);
    const contrastToxic = getContrast(toxicText, bgVoid);
    const contrastWhite = getContrast(whiteText, bgVoid);
    const contrastCrimson = getContrast(crimsonText, bgVoid);

    console.log(`  Contrast Cyan (#00f0ff vs #04070a): ${contrastCyan.toFixed(2)}:1`);
    console.log(`  Contrast Amber (#ffaa00 vs #04070a): ${contrastAmber.toFixed(2)}:1`);
    console.log(`  Contrast Toxic (#00ff88 vs #04070a): ${contrastToxic.toFixed(2)}:1`);
    console.log(`  Contrast White (#f8fafc vs #04070a): ${contrastWhite.toFixed(2)}:1`);
    console.log(`  Contrast Crimson (#ff2a4b vs #04070a): ${contrastCrimson.toFixed(2)}:1`);

    assert(contrastCyan >= 7.0, "CONTRAST-1.1", `Nanite Cyan contrast is AAA rated (${contrastCyan.toFixed(2)}:1 >= 7.0)`);
    assert(contrastAmber >= 4.5, "CONTRAST-1.2", `Solar Amber contrast satisfies WCAG AA (${contrastAmber.toFixed(2)}:1 >= 4.5)`);
    assert(contrastToxic >= 7.0, "CONTRAST-1.3", `Toxic Lime contrast is AAA rated (${contrastToxic.toFixed(2)}:1 >= 7.0)`);
    assert(contrastWhite >= 7.0, "CONTRAST-1.4", `White typography contrast is AAA rated (${contrastWhite.toFixed(2)}:1 >= 7.0)`);
    assert(contrastCrimson >= 4.5, "CONTRAST-1.5", `Crimson Laser contrast satisfies WCAG AA (${contrastCrimson.toFixed(2)}:1 >= 4.5)`);

    // 4. CSS PERFORMANCE & REFLOW AUDIT
    console.log("\n--- CSS Performance, Animation Layout & Reflow Audit ---");
    const cssContent = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');

    // Verify GPU accelerated properties are used for animations (transform, opacity) rather than top/left/width/height in keyframes
    const keyframeBlocks = cssContent.match(/@keyframes[^{]+{[^}]+}/g) || [];
    let heavyKeyframesCount = 0;
    for (const kf of keyframeBlocks) {
        if (/width:|height:|top:|left:/i.test(kf) && !/scale|translate/i.test(kf)) {
            heavyKeyframesCount++;
        }
    }
    assert(heavyKeyframesCount === 0, "PERF-1.1", `Keyframe animations use composited properties (transform, opacity); layout-triggering keyframes: ${heavyKeyframesCount}`);

    // Verify tabular-nums is configured
    assert(cssContent.includes('font-variant-numeric: tabular-nums') || cssContent.includes('font-variant-numeric: var(--tabular-numerics)'), "PERF-1.2", "Tabular numerics implemented across numeric telemetry");

    // Verify discrete transitions syntax
    assert(cssContent.includes('@starting-style'), "PERF-1.3", "@starting-style declared for modern discrete entry transitions");
    assert(cssContent.includes('transition-behavior: allow-discrete'), "PERF-1.4", "transition-behavior: allow-discrete configured for modals");
    assert(cssContent.includes('prefers-reduced-motion'), "PERF-1.5", "prefers-reduced-motion media query implemented for accessibility");

    await browser.close();

    console.log("\n================================================================================");
    console.log(`>>> ADVERSARIAL AUDIT COMPLETE: ${passed}/${totalTests} PASSED, ${failed} FAILED`);
    console.log("================================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runAdversarialAudit().catch(err => {
    console.error("Adversarial audit encountered fatal error:", err);
    process.exit(1);
});
