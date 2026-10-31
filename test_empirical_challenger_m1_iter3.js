const path = require('path');
const puppeteer = require('puppeteer');

function boxesIntersect(r1, r2) {
    if (!r1 || !r2) return false;
    return !(
        r2.left >= r1.right ||
        r2.right <= r1.left ||
        r2.top >= r1.bottom ||
        r2.bottom <= r1.top
    );
}

function getOverlapArea(r1, r2) {
    if (!boxesIntersect(r1, r2)) return 0;
    const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    return Math.round(xOverlap * yOverlap);
}

async function runEmpiricalChallenge() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const fileUrl = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const failures = [];

    function assert(condition, message, details = '') {
        totalTests++;
        if (condition) {
            totalPassed++;
            console.log(`  [PASS] ${message}`);
        } else {
            totalFailed++;
            console.error(`  [FAIL] ${message} - ${details}`);
            failures.push(`${message} - ${details}`);
        }
    }

    try {
        console.log('================================================================================');
        console.log('>>> CHALLENGER 2: EMPIRICAL VERIFICATION OF ITERATION 3 FIXES');
        console.log('================================================================================\n');

        // =========================================================================
        // PART 1: MOBILE TOUCH HIT-TESTING (document.elementFromPoint & Weapon Switch)
        // =========================================================================
        console.log('--------------------------------------------------------------------------------');
        console.log('PART 1: MOBILE TOUCH HIT-TESTING & INTERACTION AUDIT');
        console.log('--------------------------------------------------------------------------------');

        const mobileViewports = [
            { name: 'Standard Mobile Portrait (390x844)', width: 390, height: 844 },
            { name: 'Narrow Mobile Portrait (320x568)', width: 320, height: 568 },
            { name: 'Tall Mobile Portrait (414x896)', width: 414, height: 896 },
            { name: 'Mobile Landscape (844x390)', width: 844, height: 390 }
        ];

        for (const vp of mobileViewports) {
            console.log(`\nAuditing Mobile Viewport: ${vp.name}`);
            const page = await browser.newPage();
            await page.setViewport({
                width: vp.width,
                height: vp.height,
                isMobile: true,
                hasTouch: true
            });

            await page.goto(fileUrl, { waitUntil: 'load' });
            await page.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            // Equip weapons in slots 1 & 4 so all 4 slots are populated & interactive
            await page.evaluate(() => {
                playerCurrency = 10000;
                inventory.primary = 'rifle';
                ammoState.primary = { clip: 30, reserve: 90 };
                inventory.grenades.hegrenade = 1;
                inventory.currentGrenade = 'hegrenade';
                document.getElementById('slot-1').classList.remove('hidden');
                document.getElementById('slot-4').classList.remove('hidden');
                if (typeof updateHUD === 'function') {
                    updateHUD();
                }
            });
            await new Promise(r => setTimeout(r, 200));

            // 1. Check touch look zone status
            const lookZoneInfo = await page.evaluate(() => {
                const lz = document.querySelector('#touch-look-zone');
                if (!lz) return null;
                const rect = lz.getBoundingClientRect();
                const style = window.getComputedStyle(lz);
                return {
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height,
                    zIndex: style.zIndex,
                    pointerEvents: style.pointerEvents,
                    display: style.display
                };
            });

            assert(lookZoneInfo !== null, `${vp.name}: #touch-look-zone mounted in DOM`);
            assert(lookZoneInfo && lookZoneInfo.width > 0, `${vp.name}: #touch-look-zone is active and sized (w=${lookZoneInfo ? lookZoneInfo.width : 0}, h=${lookZoneInfo ? lookZoneInfo.height : 0}, zIndex=${lookZoneInfo ? lookZoneInfo.zIndex : ''})`);

            // 2. Perform document.elementFromPoint on slots 1, 2, 3, 4
            const hitTestResults = await page.evaluate(() => {
                const slots = ['slot-1', 'slot-2', 'slot-3', 'slot-4'];
                return slots.map(id => {
                    const el = document.getElementById(id);
                    if (!el) return { id, exists: false };
                    const rect = el.getBoundingClientRect();
                    const cx = Math.round(rect.left + rect.width / 2);
                    const cy = Math.round(rect.top + rect.height / 2);
                    const target = document.elementFromPoint(cx, cy);
                    const isContained = el.contains(target);
                    const isLookZone = target && (target.id === 'touch-look-zone' || target.closest('#touch-look-zone') !== null);
                    return {
                        id,
                        exists: true,
                        rect: { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height },
                        center: { cx, cy },
                        targetTag: target ? target.tagName : null,
                        targetId: target ? target.id : null,
                        targetClass: target ? target.className : null,
                        isContained,
                        isLookZone
                    };
                });
            });

            for (const res of hitTestResults) {
                assert(res.exists, `${vp.name}: #${res.id} exists in DOM`);
                assert(!res.isLookZone, `${vp.name}: #${res.id} is NOT blocked by #touch-look-zone (hit target: <${res.targetTag} id="${res.targetId}" class="${res.targetClass}">)`);
                assert(res.isContained, `${vp.name}: document.elementFromPoint(${res.center.cx}, ${res.center.cy}) directly hits #${res.id} or its descendant`);
            }

            // 3. Functional weapon switching via direct viewport tap coordinates
            const switchResult = await page.evaluate(async () => {
                const slot4 = document.getElementById('slot-4');
                const slot3 = document.getElementById('slot-3');
                const slot2 = document.getElementById('slot-2');
                const slot1 = document.getElementById('slot-1');
                
                const getActiveId = () => document.querySelector('.weapon-inventory .inv-slot.active')?.id;
                const initialActive = getActiveId();

                // Tap slot 3 (Knife)
                const r3 = slot3.getBoundingClientRect();
                const x3 = r3.left + r3.width / 2;
                const y3 = r3.top + r3.height / 2;
                const target3 = document.elementFromPoint(x3, y3);
                if (target3) {
                    target3.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                const afterTap3 = getActiveId();

                // Tap slot 1 (Primary rifle)
                const r1 = slot1.getBoundingClientRect();
                const x1 = r1.left + r1.width / 2;
                const y1 = r1.top + r1.height / 2;
                const target1 = document.elementFromPoint(x1, y1);
                if (target1) {
                    target1.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                const afterTap1 = getActiveId();

                // Tap slot 4 (Grenade)
                const r4 = slot4.getBoundingClientRect();
                const x4 = r4.left + r4.width / 2;
                const y4 = r4.top + r4.height / 2;
                const target4 = document.elementFromPoint(x4, y4);
                if (target4) {
                    target4.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                const afterTap4 = getActiveId();

                // Tap slot 2 (Pistol)
                const r2 = slot2.getBoundingClientRect();
                const x2 = r2.left + r2.width / 2;
                const y2 = r2.top + r2.height / 2;
                const target2 = document.elementFromPoint(x2, y2);
                if (target2) {
                    target2.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
                }
                const afterTap2 = getActiveId();

                return {
                    initialActive,
                    afterTap3,
                    afterTap1,
                    afterTap4,
                    afterTap2
                };
            });

            assert(switchResult.afterTap3 === 'slot-3', `${vp.name}: Tapping slot 3 coordinate switched active weapon to knife (slot-3)`);
            assert(switchResult.afterTap1 === 'slot-1', `${vp.name}: Tapping slot 1 coordinate switched active weapon to rifle (slot-1)`);
            assert(switchResult.afterTap4 === 'slot-4', `${vp.name}: Tapping slot 4 coordinate switched active weapon to grenade (slot-4)`);
            assert(switchResult.afterTap2 === 'slot-2', `${vp.name}: Tapping slot 2 coordinate switched active weapon to pistol (slot-2)`);

            await page.close();
        }

        // =========================================================================
        // PART 2: TABLET VIEWPORTS (768x1024, 800x800)
        // =========================================================================
        console.log('\n--------------------------------------------------------------------------------');
        console.log('PART 2: TABLET VIEWPORT LAYOUT & LEAK AUDIT');
        console.log('--------------------------------------------------------------------------------');

        const tabletViewports = [
            { name: 'iPad Portrait (768x1024, Desktop Mode)', width: 768, height: 1024, isMobile: false, hasTouch: false },
            { name: 'iPad Portrait (768x1024, Touch Mode)', width: 768, height: 1024, isMobile: true, hasTouch: true },
            { name: 'Tablet Square (800x800, Desktop Mode)', width: 800, height: 800, isMobile: false, hasTouch: false },
            { name: 'Tablet Square (800x800, Touch Mode)', width: 800, height: 800, isMobile: true, hasTouch: true }
        ];

        for (const vp of tabletViewports) {
            console.log(`\nAuditing Tablet Viewport: ${vp.name}`);
            const page = await browser.newPage();
            await page.setViewport({
                width: vp.width,
                height: vp.height,
                isMobile: vp.isMobile,
                hasTouch: vp.hasTouch
            });

            await page.goto(fileUrl, { waitUntil: 'load' });
            await page.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            const tabletMetrics = await page.evaluate(() => {
                function getRect(sel) {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    return {
                        selector: sel,
                        top: Math.round(r.top),
                        bottom: Math.round(r.bottom),
                        left: Math.round(r.left),
                        right: Math.round(r.right),
                        width: Math.round(r.width),
                        height: Math.round(r.height),
                        minWidth: s.minWidth,
                        maxWidth: s.maxWidth,
                        display: s.display,
                        position: s.position
                    };
                }

                return {
                    vw: window.innerWidth,
                    vh: window.innerHeight,
                    hudTop: getRect('.hud-top'),
                    healthBar: getRect('.health-bar'),
                    hudLeft: getRect('.hud-left'),
                    hudBottom: getRect('.hud-bottom'),
                    minimap: getRect('#minimap-container')
                };
            });

            // 1. Verify .hud-top does not overlap #minimap-container
            assert(tabletMetrics.hudTop !== null, `${vp.name}: .hud-top exists`);
            assert(tabletMetrics.minimap !== null, `${vp.name}: #minimap-container exists`);

            if (tabletMetrics.hudTop && tabletMetrics.minimap) {
                const overlapTopMap = getOverlapArea(tabletMetrics.hudTop, tabletMetrics.minimap);
                assert(overlapTopMap === 0, `${vp.name}: .hud-top and #minimap-container have ZERO overlap (overlap: ${overlapTopMap} px²)`);
            }

            // 2. Verify .hud-top bounds do not leak horizontally outside viewport
            if (tabletMetrics.hudTop) {
                assert(tabletMetrics.hudTop.left >= 0, `${vp.name}: .hud-top left boundary (${tabletMetrics.hudTop.left}px) >= 0`);
                assert(tabletMetrics.hudTop.right <= vp.width, `${vp.name}: .hud-top right boundary (${tabletMetrics.hudTop.right}px) <= ${vp.width}px`);
                console.log(`  [INFO] .hud-top bounds: left=${tabletMetrics.hudTop.left}, right=${tabletMetrics.hudTop.right}, width=${tabletMetrics.hudTop.width}, max-width=${tabletMetrics.hudTop.maxWidth}`);
            }

            // 3. Verify .health-bar computed width does not leak desktop min-width (240px)
            if (tabletMetrics.healthBar) {
                assert(tabletMetrics.healthBar.width <= 120, `${vp.name}: .health-bar width (${tabletMetrics.healthBar.width}px) <= 120px (responsive scaled, not 240px)`);
                assert(tabletMetrics.healthBar.minWidth === '0px', `${vp.name}: .health-bar min-width is overridden to '0px' (got: "${tabletMetrics.healthBar.minWidth}")`);
            }

            // 4. Verify .hud-left (vitality cluster) does not overlap #minimap-container
            if (tabletMetrics.hudLeft && tabletMetrics.minimap) {
                const overlapLeftMap = getOverlapArea(tabletMetrics.hudLeft, tabletMetrics.minimap);
                assert(overlapLeftMap === 0, `${vp.name}: .hud-left and #minimap-container have ZERO overlap (overlap: ${overlapLeftMap} px²)`);
            }

            // 5. Verify .hud-bottom anchor is preserved in bottom viewport region
            if (tabletMetrics.hudBottom) {
                assert(tabletMetrics.hudBottom.top >= vp.height * 0.25, `${vp.name}: .hud-bottom properly anchored in lower viewport (top: ${tabletMetrics.hudBottom.top}px >= ${Math.round(vp.height * 0.25)}px)`);
            }

            await page.close();
        }

        console.log('\n================================================================================');
        console.log('>>> SUMMARY OF EMPIRICAL CHALLENGER 2 VERIFICATION');
        console.log('================================================================================');
        console.log(`Total Assertions : ${totalTests}`);
        console.log(`Total Passed     : ${totalPassed}`);
        console.log(`Total Failed     : ${totalFailed}`);
        if (totalFailed === 0) {
            console.log('\n>>> EMPIRICAL VERDICT: APPROVE <<<');
        } else {
            console.log('\n>>> EMPIRICAL VERDICT: REQUEST_CHANGES <<<');
            console.log('Failures:\n' + failures.map(f => ' - ' + f).join('\n'));
        }

    } finally {
        await browser.close();
    }

    if (totalFailed > 0) {
        process.exit(1);
    }
}

runEmpiricalChallenge().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
