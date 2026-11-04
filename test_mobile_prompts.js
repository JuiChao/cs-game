const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

async function runTests() {
    console.log("=== STARTING MOBILE PROMPTS VERIFICATION ===");

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const uri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    // -------------------------------------------------------------
    // Test 1: Desktop Mode (1920x1080)
    // -------------------------------------------------------------
    console.log("\n--- Testing Desktop Mode (1920x1080, no touch) ---");
    {
        const page = await browser.newPage();
        await page.setViewport({ width: 1920, height: 1080, isMobile: false, hasTouch: false });
        await page.goto(uri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 500));

        const desktopEvaluation = await page.evaluate(() => {
            const specPrompt = document.getElementById('spectator-prompt');
            const pointerLockPrompt = document.getElementById('pointer-lock-prompt');
            const pointerLockSub = pointerLockPrompt ? pointerLockPrompt.querySelector('.pointer-lock-subtitle') : null;
            const mortarMapInst = document.getElementById('mortar-map-instruction');
            const mortarCancelBtn = document.getElementById('mortar-cancel-btn');
            const buyCloseBtn = document.querySelector('#buy-menu .deploy-btn');
            const scopeCloseBtn = document.querySelector('#scope-panel .tactical-deploy-btn');
            const mortarShopBtn = document.querySelector("button[onclick*='mortar']");
            const dropCompShopBtn = document.getElementById('btn-drop-comp');
            const adrenalineShopBtn = document.getElementById('btn-adrenaline');
            const grenadeHintBtn = document.getElementById('btn-quick-grenade-hint');
            const interactPrompt = document.getElementById('interact-prompt');
            const pickupPrompt = document.getElementById('pickup-prompt');
            const buyPrompt = document.getElementById('buy-prompt');
            const scopePill = document.querySelector('.scope-shortcut-pill');
            const controlsHint = document.getElementById('controls-hint');

            // Test zombie infection announcement text on desktop
            let zombieAnnouncement = '';
            const origShow = window.showAnnouncement;
            window.showAnnouncement = (msg) => { zombieAnnouncement = msg; };
            if (typeof infectPlayer === 'function') {
                gameMode = 'zombie';
                playerState.team = 'CT';
                playerState.isZombie = false;
                infectPlayer(null, false);
            }
            window.showAnnouncement = origShow;

            return {
                specPromptText: specPrompt ? specPrompt.innerText : '',
                pointerLockSubText: pointerLockSub ? pointerLockSub.innerText : '',
                mortarMapInstText: mortarMapInst ? mortarMapInst.innerText : '',
                mortarCancelBtnText: mortarCancelBtn ? mortarCancelBtn.innerText : '',
                buyCloseBtnText: buyCloseBtn ? buyCloseBtn.innerText : '',
                scopeCloseBtnText: scopeCloseBtn ? scopeCloseBtn.innerText : '',
                mortarShopBtnText: mortarShopBtn ? mortarShopBtn.innerText : '',
                dropCompShopBtnText: dropCompShopBtn ? dropCompShopBtn.innerText : '',
                adrenalineShopBtnText: adrenalineShopBtn ? adrenalineShopBtn.innerText : '',
                grenadeHintVisible: grenadeHintBtn ? window.getComputedStyle(grenadeHintBtn).display !== 'none' : false,
                interactPromptText: interactPrompt ? interactPrompt.innerText : '',
                pickupPromptText: pickupPrompt ? pickupPrompt.innerText : '',
                buyPromptText: buyPrompt ? buyPrompt.innerText : '',
                scopePillText: scopePill ? scopePill.innerText : '',
                controlsHintVisible: controlsHint ? window.getComputedStyle(controlsHint).display !== 'none' : false,
                zombieAnnouncement
            };
        });

        console.log("Desktop evaluated state:", desktopEvaluation);

        assert(desktopEvaluation.specPromptText.includes('点击鼠标左键'), "Desktop spectator prompt must mention '点击鼠标左键'");
        assert(!desktopEvaluation.specPromptText.includes('点击屏幕或开火键'), "Desktop spectator prompt must not mention touch screen");
        assert(desktopEvaluation.pointerLockSubText.includes('锁定鼠标以控制准心视角'), "Desktop pointer lock prompt must mention '锁定鼠标'");
        assert(desktopEvaluation.mortarMapInstText.includes('按 F 发射'), "Desktop mortar map must mention '按 F 发射'");
        assert(desktopEvaluation.mortarMapInstText.includes('滚轮缩放'), "Desktop mortar map must mention '滚轮缩放'");
        assert(desktopEvaluation.mortarCancelBtnText.includes('(Esc / F)'), "Desktop mortar cancel button must mention '(Esc / F)'");
        assert(desktopEvaluation.buyCloseBtnText.includes('(按 B)'), "Desktop buy menu close button must mention '(按 B)'");
        assert(desktopEvaluation.scopeCloseBtnText.includes('(按 T)'), "Desktop scope panel close button must mention '(按 T)'");
        assert(desktopEvaluation.mortarShopBtnText.includes('左键打开战术地图'), "Desktop mortar shop item must mention '左键'");
        assert(desktopEvaluation.dropCompShopBtnText.includes('按 V 键'), "Desktop drop compensation must mention '按 V 键'");
        assert(desktopEvaluation.adrenalineShopBtnText.includes('按 Q'), "Desktop adrenaline item must mention '按 Q'");
        assert(desktopEvaluation.grenadeHintVisible === true, "Desktop quick grenade hint must be visible");
        assert(desktopEvaluation.interactPromptText.includes('长按 [E]'), "Desktop interact prompt must mention '长按 [E]'");
        assert(desktopEvaluation.pickupPromptText.includes('按 [E] 拾取'), "Desktop pickup prompt must mention '按 [E] 拾取'");
        assert(desktopEvaluation.buyPromptText.includes('按 [B]'), "Desktop buy prompt must mention '按 [B]'");
        assert(desktopEvaluation.scopePillText.includes('T') && desktopEvaluation.scopePillText.includes('关闭'), "Desktop scope pill must mention 'T 关闭'");
        assert(desktopEvaluation.controlsHintVisible === true, "Desktop controls hint must be visible");
        assert(desktopEvaluation.zombieAnnouncement.includes('[左键]'), "Desktop zombie announcement must mention '[左键]'");

        console.log("PASS: Desktop mode correctly preserves keyboard and mouse prompts");
        await page.close();
    }

    // -------------------------------------------------------------
    // Test 2: Mobile Phone Mode (iPhone 14: 390x844, touch)
    // -------------------------------------------------------------
    console.log("\n--- Testing Mobile Phone Mode (390x844, touch device) ---");
    {
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1');
        await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
        await page.goto(uri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 500));

        const mobileEvaluation = await page.evaluate(() => {
            const specPrompt = document.getElementById('spectator-prompt');
            const pointerLockPrompt = document.getElementById('pointer-lock-prompt');
            const mortarMapInst = document.getElementById('mortar-map-instruction');
            const mortarCancelBtn = document.getElementById('mortar-cancel-btn');
            const buyCloseBtn = document.querySelector('#buy-menu .deploy-btn');
            const scopeCloseBtn = document.querySelector('#scope-panel .tactical-deploy-btn');
            const mortarShopBtn = document.querySelector("button[onclick*='mortar']");
            const dropCompShopBtn = document.getElementById('btn-drop-comp');
            const adrenalineShopBtn = document.getElementById('btn-adrenaline');
            const grenadeHintBtn = document.getElementById('btn-quick-grenade-hint');
            const interactPrompt = document.getElementById('interact-prompt');
            const pickupPrompt = document.getElementById('pickup-prompt');
            const buyPrompt = document.getElementById('buy-prompt');
            const scopePill = document.querySelector('.scope-shortcut-pill');
            const controlsHint = document.getElementById('controls-hint');

            const isTouchClassPresent = document.body.classList.contains('touch-device') || document.documentElement.classList.contains('touch-device');
            const pointerLockDisplay = pointerLockPrompt ? window.getComputedStyle(pointerLockPrompt).display : 'none';
            const grenadeHintDisplay = grenadeHintBtn ? window.getComputedStyle(grenadeHintBtn).display : 'none';
            const controlsHintDisplay = controlsHint ? window.getComputedStyle(controlsHint).display : 'none';
            const specPointerEvents = specPrompt ? window.getComputedStyle(specPrompt).pointerEvents : '';

            // Test zombie infection announcement text on mobile
            let zombieAnnouncement = '';
            const origShow = window.showAnnouncement;
            window.showAnnouncement = (msg) => { zombieAnnouncement = msg; };
            if (typeof infectPlayer === 'function') {
                gameMode = 'zombie';
                playerState.team = 'CT';
                playerState.isZombie = false;
                infectPlayer(null, false);
            }
            window.showAnnouncement = origShow;

            // Test dynamic spectator prompt update on player death
            if (typeof showSpectatorPrompt === 'function') {
                showSpectatorPrompt();
            }

            return {
                isTouchClassPresent,
                pointerLockDisplay,
                grenadeHintDisplay,
                controlsHintDisplay,
                specPointerEvents,
                specPromptText: specPrompt ? specPrompt.innerText : '',
                mortarMapInstText: mortarMapInst ? mortarMapInst.innerText : '',
                mortarCancelBtnText: mortarCancelBtn ? mortarCancelBtn.innerText : '',
                buyCloseBtnText: buyCloseBtn ? buyCloseBtn.innerText : '',
                scopeCloseBtnText: scopeCloseBtn ? scopeCloseBtn.innerText : '',
                mortarShopBtnText: mortarShopBtn ? mortarShopBtn.innerText : '',
                dropCompShopBtnText: dropCompShopBtn ? dropCompShopBtn.innerText : '',
                adrenalineShopBtnText: adrenalineShopBtn ? adrenalineShopBtn.innerText : '',
                interactPromptText: interactPrompt ? interactPrompt.innerText : '',
                pickupPromptText: pickupPrompt ? pickupPrompt.innerText : '',
                buyPromptText: buyPrompt ? buyPrompt.innerText : '',
                scopePillText: scopePill ? scopePill.innerText : '',
                zombieAnnouncement
            };
        });

        console.log("Mobile evaluated state:", mobileEvaluation);

        assert(mobileEvaluation.isTouchClassPresent === true, "Mobile device must have touch-device class");
        assert(mobileEvaluation.pointerLockDisplay === 'none', "Pointer lock prompt must have display: none on mobile");
        assert(mobileEvaluation.grenadeHintDisplay === 'none', "Desktop keyboard shortcut hint must have display: none on mobile");
        assert(mobileEvaluation.controlsHintDisplay === 'none', "Desktop controls hint must have display: none on mobile");
        assert(mobileEvaluation.specPromptText.includes('点击屏幕或开火键'), "Mobile spectator prompt must say '点击屏幕或开火键切换观战视角'");
        assert(!mobileEvaluation.specPromptText.includes('点击鼠标左键'), "Mobile spectator prompt must NOT say '点击鼠标左键'");
        assert(mobileEvaluation.specPointerEvents === 'auto', "Mobile spectator prompt must have pointer-events: auto for easy tapping");
        assert(!mobileEvaluation.mortarMapInstText.includes('滚轮缩放'), "Mobile mortar map must NOT say '滚轮缩放'");
        assert(!mobileEvaluation.mortarMapInstText.includes('按 F 发射'), "Mobile mortar map must NOT say '按 F 发射'");
        assert(!mobileEvaluation.mortarCancelBtnText.includes('(Esc / F)'), "Mobile mortar cancel button must NOT have '(Esc / F)'");
        assert(!mobileEvaluation.buyCloseBtnText.includes('(按 B)'), "Mobile buy menu close button must NOT have '(按 B)'");
        assert(!mobileEvaluation.scopeCloseBtnText.includes('(按 T)'), "Mobile scope close button must NOT have '(按 T)'");
        assert(!mobileEvaluation.mortarShopBtnText.includes('左键'), "Mobile mortar shop item must NOT say '左键'");
        assert(!mobileEvaluation.mortarShopBtnText.includes('按F键'), "Mobile mortar shop item must NOT say '按F键'");
        assert(!mobileEvaluation.dropCompShopBtnText.includes('按 V 键'), "Mobile drop compensation item must NOT say '按 V 键'");
        assert(!mobileEvaluation.adrenalineShopBtnText.includes('按 Q'), "Mobile adrenaline item must NOT say '按 Q'");
        assert(mobileEvaluation.interactPromptText.includes('点击或按住 [互动]'), "Mobile interact prompt must say '点击或按住 [互动]'");
        assert(mobileEvaluation.pickupPromptText.includes('点击拾取'), "Mobile pickup prompt must say '点击拾取'");
        assert(!mobileEvaluation.buyPromptText.includes('按 [B]'), "Mobile buy prompt must NOT say '按 [B]'");
        assert(!mobileEvaluation.scopePillText.includes('T 关闭'), "Mobile scope pill must NOT say 'T 关闭'");
        assert(mobileEvaluation.zombieAnnouncement.includes('[开火]'), "Mobile zombie announcement must say '[开火]'");
        assert(!mobileEvaluation.zombieAnnouncement.includes('[左键]'), "Mobile zombie announcement must NOT say '[左键]'");

        // Test spectator cycling via touch on screen or on spectator-prompt
        const specCycleResult = await page.evaluate(() => {
            playerState.isSpectating = true;
            playerState.team = 'CT';
            bots[0].team = 'CT';
            bots[0].isDead = false;
            playerState.spectateIndex = 0;

            const targetBefore = document.getElementById('spectator-target').innerText;
            const sp = document.getElementById('spectator-prompt');
            sp.click();
            const targetAfterSpClick = document.getElementById('spectator-target').innerText;

            return { targetBefore, targetAfterSpClick };
        });
        assert(specCycleResult.targetBefore !== specCycleResult.targetAfterSpClick, "Tapping spectator prompt must cycle spectator target");

        // Test Mortar map open, zoom, and close
        const mortarOverlayTest = await page.evaluate(() => {
            inventory.primary = 'mortar';
            switchWeapon(1);
            ammoState.primary.clip = 5;
            openMortarMap();
            const overlay = document.getElementById('mortar-map-overlay');
            const openInitially = !overlay.classList.contains('hidden');

            const initialZoom = mortarZoom;
            zoomMortarMap(0.4);
            const zoomedIn = mortarZoom > initialZoom;

            zoomMortarMap(-0.8);
            const zoomedOut = mortarZoom < initialZoom;

            // Close map using closeMortarMap
            closeMortarMap();
            const closedAfter = overlay.classList.contains('hidden');

            return { openInitially, zoomedIn, zoomedOut, closedAfter };
        });

        assert(mortarOverlayTest.openInitially === true, "Mortar map must open");
        assert(mortarOverlayTest.zoomedIn === true, "zoomMortarMap(+) must increase zoom");
        assert(mortarOverlayTest.zoomedOut === true, "zoomMortarMap(-) must decrease zoom");
        assert(mortarOverlayTest.closedAfter === true, "closeMortarMap() must add hidden class to #mortar-map-overlay");

        console.log("PASS: Mobile touch device prompts and mortar map verified with zero mouse/keyboard leaks");
        await page.close();
    }

    // -------------------------------------------------------------
    // Test 3: Tablet Mode (iPad: 1024x768 landscape, touch)
    // -------------------------------------------------------------
    console.log("\n--- Testing Tablet Mode (1024x768 touch) ---");
    {
        const page = await browser.newPage();
        await page.setViewport({ width: 1024, height: 768, isMobile: true, hasTouch: true });
        await page.goto(uri, { waitUntil: 'load' });

        const tabletEvaluation = await page.evaluate(() => {
            const shouldAutoLock = typeof shouldAutoLockPointer === 'function' ? shouldAutoLockPointer() : true;
            const pointerLockPrompt = document.getElementById('pointer-lock-prompt');
            const pointerLockDisplay = pointerLockPrompt ? window.getComputedStyle(pointerLockPrompt).display : 'none';
            const specPrompt = document.getElementById('spectator-prompt');
            const buyPrompt = document.getElementById('buy-prompt');
            const controlsHint = document.getElementById('controls-hint');

            return {
                shouldAutoLock,
                pointerLockDisplay,
                controlsHintDisplay: controlsHint ? window.getComputedStyle(controlsHint).display : 'none',
                specPromptText: specPrompt ? specPrompt.innerText : '',
                buyPromptText: buyPrompt ? buyPrompt.innerText : ''
            };
        });

        console.log("Tablet evaluated state:", tabletEvaluation);
        assert(tabletEvaluation.shouldAutoLock === false, "Tablet touch device must not auto lock desktop pointer");
        assert(tabletEvaluation.pointerLockDisplay === 'none', "Tablet touch device must hide pointer lock prompt");
        assert(tabletEvaluation.controlsHintDisplay === 'none', "Tablet touch device must hide controls hint");
        assert(tabletEvaluation.specPromptText.includes('点击屏幕或开火键'), "Tablet spectator prompt must say '点击屏幕或开火键切换观战视角'");
        assert(!tabletEvaluation.specPromptText.includes('点击鼠标左键'), "Tablet spectator prompt must NOT say '点击鼠标左键'");
        assert(!tabletEvaluation.buyPromptText.includes('按 [B]'), "Tablet buy prompt must NOT say '按 [B]'");

        console.log("PASS: Tablet touch mode verified successfully");
        await page.close();
    }

    // -------------------------------------------------------------
    // Test 4: iPad Pro Mode (1194x834, coarse pointer, modern iPadOS UA)
    // -------------------------------------------------------------
    console.log("\n--- Testing iPad Pro Mode (1194x834, coarse pointer, modern iPadOS UA) ---");
    {
        const page = await browser.newPage();
        // Modern iPadOS Safari reports as Macintosh with maxTouchPoints > 0
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15');
        await page.setViewport({ width: 1194, height: 834, isMobile: true, hasTouch: true });
        await page.goto(uri, { waitUntil: 'load' });

        const ipadProEvaluation = await page.evaluate(() => {
            const shouldAutoLock = typeof shouldAutoLockPointer === 'function' ? shouldAutoLockPointer() : true;
            const pointerLockPrompt = document.getElementById('pointer-lock-prompt');
            const pointerLockDisplay = pointerLockPrompt ? window.getComputedStyle(pointerLockPrompt).display : 'none';
            const specPrompt = document.getElementById('spectator-prompt');
            const buyPrompt = document.getElementById('buy-prompt');
            const controlsHint = document.getElementById('controls-hint');

            return {
                shouldAutoLock,
                pointerLockDisplay,
                controlsHintDisplay: controlsHint ? window.getComputedStyle(controlsHint).display : 'none',
                specPromptText: specPrompt ? specPrompt.innerText : '',
                buyPromptText: buyPrompt ? buyPrompt.innerText : ''
            };
        });

        console.log("iPad Pro evaluated state:", ipadProEvaluation);
        assert(ipadProEvaluation.shouldAutoLock === false, "iPad Pro pure touch device must not auto lock pointer");
        assert(ipadProEvaluation.pointerLockDisplay === 'none', "iPad Pro pure touch device must hide pointer lock prompt");
        assert(ipadProEvaluation.controlsHintDisplay === 'none', "iPad Pro pure touch device must hide controls hint");
        assert(ipadProEvaluation.specPromptText.includes('点击屏幕或开火键'), "iPad Pro spectator prompt must say '点击屏幕或开火键切换观战视角'");
        assert(!ipadProEvaluation.specPromptText.includes('点击鼠标左键'), "iPad Pro spectator prompt must NOT say '点击鼠标左键'");
        assert(!ipadProEvaluation.buyPromptText.includes('按 [B]'), "iPad Pro buy prompt must NOT say '按 [B]'");

        console.log("PASS: iPad Pro pure touch mode verified successfully");
        await page.close();
    }

    await browser.close();
    console.log("\n=== ALL MOBILE PROMPTS VERIFICATION TESTS PASSED SUCCESSFULLY! ===");
}

runTests().catch(err => {
    console.error("Test failure:", err);
    process.exit(1);
});
