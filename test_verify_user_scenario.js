const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

async function runScenarioTests() {
    console.log("=== STARTING USER SCENARIO VERIFICATION ===");

    // Scenario 1: Desktop User clicking "开始匹配"
    console.log("\n--- Scenario 1: Desktop User Clicking '开始匹配' ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });
        
        const errors = [];
        page.on('pageerror', err => errors.push(err.message));
        
        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });

        await page.evaluate(() => {
            const btn = document.getElementById('start-btn');
            btn.addEventListener('click', () => {
                const t0 = performance.now();
                requestAnimationFrame(() => {
                    window._actualStartDuration = performance.now() - t0;
                });
            }, true);
        });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        const actualDuration = await page.evaluate(() => window._actualStartDuration || 0);
        console.log(`Game start in-browser execution took: ${actualDuration.toFixed(1)}ms`);
        assert(actualDuration < 500, `Game start execution must be under 500ms (took ${actualDuration.toFixed(1)}ms)`);

        const state = await page.evaluate(() => {
            return {
                isLocked: (typeof controls !== 'undefined' && controls) ? controls.isLocked : false,
                hasPointerLockElement: Boolean(document.pointerLockElement),
                gameActive: document.getElementById('game-screen').classList.contains('active'),
                menuInactive: !document.getElementById('main-menu').classList.contains('active'),
                promptHidden: document.getElementById('pointer-lock-prompt').classList.contains('hidden'),
                camRotY: camera.rotation.y,
                camRotX: camera.rotation.x
            };
        });

        console.log("Scenario 1 Game State:", state);
        assert(state.gameActive, "Game screen must be active");
        assert(state.menuInactive, "Main menu must be inactive");
        assert(state.isLocked || state.hasPointerLockElement, "Controls or document must have pointer lock");
        assert(state.promptHidden, "Pointer lock prompt must be hidden when locked");

        // Test mouse movement rotates camera (yaw & pitch)
        const initialYaw = state.camRotY;
        await page.mouse.move(500, 300);
        await page.mouse.move(600, 250); // move right and up
        await new Promise(r => setTimeout(r, 100));

        const afterMove = await page.evaluate(() => {
            return {
                camRotY: camera.rotation.y,
                camRotX: camera.rotation.x
            };
        });

        console.log(`Camera rotation before: yaw=${initialYaw.toFixed(4)}, after: yaw=${afterMove.camRotY.toFixed(4)}`);
        assert(afterMove.camRotY !== initialYaw, "Camera yaw must rotate in response to mouse movement");
        console.log("PASS: Mouse aim controls camera orientation smoothly");

        // Measure frame progression and CPU frame compute time
        const f0 = await page.evaluate(() => window.frameCount);
        await new Promise(r => setTimeout(r, 2000));
        const f1 = await page.evaluate(() => window.frameCount);
        const fps = (f1 - f0) / 2;
        console.log(`Active gameplay headless rAF rate: ${fps.toFixed(1)} ticks/s`);
        assert(fps >= 8, `Gameplay frames must advance actively (actual: ${fps})`);

        const avgFrameComputeTime = await page.evaluate(() => {
            let t0 = performance.now();
            botAI();
            updatePhysics();
            updateBullets();
            if (typeof updateMinimap === 'function') updateMinimap();
            if (typeof updateHUD === 'function') updateHUD();
            return performance.now() - t0;
        });
        console.log(`Per-frame game logic compute time: ${avgFrameComputeTime.toFixed(2)}ms (capacity: ${(1000/avgFrameComputeTime).toFixed(0)} FPS)`);
        assert(avgFrameComputeTime < 16.6, `Game logic per frame must be under 16.6ms (took: ${avgFrameComputeTime.toFixed(2)}ms)`);

        assert(errors.length === 0, `Zero page runtime errors (errors: ${errors.join(', ')})`);
        await browser.close();
    }

    // Scenario 2: Touchscreen Laptop User (has touchpoints, but is on desktop resolution with mouse)
    console.log("\n--- Scenario 2: Touchscreen Laptop User (maxTouchPoints > 0, 1920x1080) ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, hasTouch: true });

        // Simulate touchscreen laptop where navigator.maxTouchPoints = 10
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 10 });
        });

        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });

        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        const touchLaptopState = await page.evaluate(() => {
            return {
                maxTouchPoints: navigator.maxTouchPoints,
                shouldAutoLock: typeof shouldAutoLockPointer === 'function' ? shouldAutoLockPointer() : false,
                isLocked: (typeof controls !== 'undefined' && controls) ? controls.isLocked : false,
                hasPointerLockElement: Boolean(document.pointerLockElement)
            };
        });

        console.log("Touchscreen Laptop State:", touchLaptopState);
        assert(touchLaptopState.shouldAutoLock, "Touchscreen laptop must allow pointer locking");
        assert(touchLaptopState.isLocked || touchLaptopState.hasPointerLockElement, "Touchscreen laptop must lock pointer on click");
        console.log("PASS: Touchscreen laptop successfully locks mouse pointer");

        assert(errors.length === 0, `Zero page runtime errors (errors: ${errors.join(', ')})`);
        await browser.close();
    }

    // Scenario 3: Smartphone User (width: 390, touch only, no mouse)
    console.log("\n--- Scenario 3: Smartphone User (width: 390, isMobile: true) ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

        const errors = [];
        page.on('pageerror', err => errors.push(err.message));

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });

        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        const mobileState = await page.evaluate(() => {
            return {
                shouldAutoLock: typeof shouldAutoLockPointer === 'function' ? shouldAutoLockPointer() : true,
                locked: (typeof controls !== 'undefined' && controls) ? controls.isLocked : false,
                active: typeof isPlayerControlActive === 'function' ? isPlayerControlActive() : false,
                promptHidden: document.getElementById('pointer-lock-prompt').classList.contains('hidden')
            };
        });

        console.log("Mobile State:", mobileState);
        assert(mobileState.shouldAutoLock === false, "Mobile phone should not auto-lock desktop pointer");
        assert(mobileState.locked === false, "Mobile phone must not lock pointer");
        assert(mobileState.active === true, "Mobile controls must be active without pointer lock");
        assert(mobileState.promptHidden === true, "Desktop pointer prompt must be hidden on mobile phone");
        console.log("PASS: Mobile touch controls operate without desktop pointer interference");

        assert(errors.length === 0, `Zero page runtime errors (errors: ${errors.join(', ')})`);
        await browser.close();
    }

    // Scenario 4: Pointer Lock Prompt Recovery
    console.log("\n--- Scenario 4: Pointer Lock Recovery on Escape & Re-click ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });

        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        // Simulate user hitting Escape to release pointer lock
        await page.evaluate(() => {
            if (document.exitPointerLock) document.exitPointerLock();
        });
        await new Promise(r => setTimeout(r, 200));

        const unlockedState = await page.evaluate(() => {
            return {
                isLocked: (typeof controls !== 'undefined' && controls) ? controls.isLocked : false,
                promptVisible: !document.getElementById('pointer-lock-prompt').classList.contains('hidden')
            };
        });

        console.log("State after Escape release:", unlockedState);
        assert(unlockedState.isLocked === false, "Controls must be unlocked after exitPointerLock");
        assert(unlockedState.promptVisible === true, "Pointer lock recovery prompt must appear when unlocked");

        // Click prompt to recapture pointer
        await page.click('#pointer-lock-prompt');
        await new Promise(r => setTimeout(r, 300));

        const relockedState = await page.evaluate(() => {
            return {
                isLocked: (typeof controls !== 'undefined' && controls) ? controls.isLocked : false,
                hasPointerLockElement: Boolean(document.pointerLockElement),
                promptHidden: document.getElementById('pointer-lock-prompt').classList.contains('hidden')
            };
        });

        console.log("State after clicking recovery prompt:", relockedState);
        assert(relockedState.isLocked || relockedState.hasPointerLockElement, "Controls must relock upon clicking prompt");
        assert(relockedState.promptHidden === true, "Prompt must hide upon relocking");
        console.log("PASS: Pointer lock recovery prompt recaptures mouse seamlessly");

        await browser.close();
    }

    // Scenario 5: Touchscreen Laptop Closing Buy Menu Re-engages Pointer Lock
    console.log("\n--- Scenario 5: Touchscreen Laptop Buy Menu Pointer Re-lock ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, hasTouch: true });
        await page.evaluateOnNewDocument(() => {
            Object.defineProperty(navigator, 'maxTouchPoints', { get: () => 10 });
        });

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        // Open Buy Menu
        await page.evaluate(() => openBuyMenu());
        await new Promise(r => setTimeout(r, 200));

        const buyOpenState = await page.evaluate(() => ({
            buyActive: !document.getElementById('buy-menu').classList.contains('hidden'),
            isLocked: controls ? controls.isLocked : false
        }));
        assert(buyOpenState.buyActive, "Buy menu should be open");

        // Close Buy Menu
        await page.evaluate(() => closeBuyMenu());
        await new Promise(r => setTimeout(r, 200));

        const buyClosedState = await page.evaluate(() => ({
            buyClosed: document.getElementById('buy-menu').classList.contains('hidden'),
            isLocked: controls ? controls.isLocked : false,
            hasPointerLockElement: Boolean(document.pointerLockElement)
        }));
        console.log("Touchscreen Laptop after closeBuyMenu():", buyClosedState);
        assert(buyClosedState.buyClosed, "Buy menu must be closed");
        assert(buyClosedState.isLocked || buyClosedState.hasPointerLockElement, "Pointer must re-lock on touchscreen PC when closing buy menu");
        console.log("PASS: Touchscreen laptop cleanly re-locks pointer after closing buy menu");

        await browser.close();
    }

    // Scenario 6: Exiting Shooting Range Cleanly Unlocks Pointer
    console.log("\n--- Scenario 6: Exiting Shooting Range Releases Pointer Lock ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });
        await page.click('#range-btn');
        await new Promise(r => setTimeout(r, 600));

        const rangeState = await page.evaluate(() => ({
            isShootingRange: typeof isShootingRange !== 'undefined' ? isShootingRange : false,
            isLocked: controls ? controls.isLocked : false
        }));
        console.log("Shooting range active state:", rangeState);
        assert(rangeState.isShootingRange, "Shooting range must be active");

        // Exit shooting range
        await page.evaluate(() => exitShootingRange());
        await new Promise(r => setTimeout(r, 200));

        const exitState = await page.evaluate(() => ({
            isShootingRange: typeof isShootingRange !== 'undefined' ? isShootingRange : false,
            mainMenuActive: document.getElementById('main-menu').classList.contains('active'),
            isLocked: controls ? controls.isLocked : false,
            hasPointerLockElement: Boolean(document.pointerLockElement)
        }));
        console.log("State after exitShootingRange():", exitState);
        assert(!exitState.isShootingRange, "Shooting range must be inactive");
        assert(exitState.mainMenuActive, "Main menu must be active");
        assert(!exitState.isLocked && !exitState.hasPointerLockElement, "Pointer lock must be released on main menu");
        console.log("PASS: Shooting range cleanly releases pointer lock upon return to main menu");

        await browser.close();
    }

    // Scenario 7: Fallback Mouse Drag Look when Pointer Lock is Denied/Inactive
    console.log("\n--- Scenario 7: Fallback Mouse Drag Aim when Pointer Lock is Inactive ---");
    {
        const browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080 });

        const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
        await page.goto(uri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        // Force pointer unlock to simulate denied pointer lock or iframe restriction
        await page.evaluate(() => {
            if (controls) controls.isLocked = false;
            if (document.exitPointerLock) document.exitPointerLock();
        });
        await new Promise(r => setTimeout(r, 100));

        const initialRotY = await page.evaluate(() => camera.rotation.y);

        // Simulate mouse dragging (left click held + move)
        await page.mouse.down({ button: 'left' });
        await page.mouse.move(700, 300);
        await page.mouse.move(800, 250);
        await page.mouse.up({ button: 'left' });
        await new Promise(r => setTimeout(r, 100));

        const draggedRotY = await page.evaluate(() => camera.rotation.y);
        console.log(`Fallback drag rotation: initial=${initialRotY.toFixed(4)}, dragged=${draggedRotY.toFixed(4)}`);
        assert(draggedRotY !== initialRotY, "Fallback mouse drag must rotate camera even when pointer lock is disabled");
        console.log("PASS: Fallback mouse drag allows full camera and gun aiming when pointer lock is unavailable");

        await browser.close();
    }

    console.log("\n=== ALL USER SCENARIOS VERIFIED SUCCESSFULLY ===");
}

runScenarioTests().catch(err => {
    console.error("FATAL VERIFICATION ERROR:", err);
    process.exit(1);
});
