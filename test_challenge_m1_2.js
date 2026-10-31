const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function runStaticContractChecks() {
    console.log('================================================================================');
    console.log('>>> 1. STATIC CONTRACT TOKEN AUDIT (PROJECT.md & Worker Handoff)');
    console.log('================================================================================');
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    const styleCss = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8');
    const errors = [];

    function check(targetName, content, token, desc, severity = 'CRITICAL') {
        if (!content.includes(token)) {
            const msg = `[STATIC ${severity}] ${targetName} missing "${token}" - ${desc}`;
            errors.push({ severity, msg });
            console.error(`  FAIL: ${msg}`);
        } else {
            console.log(`  PASS: ${targetName} contains "${token}" (${desc})`);
        }
    }

    // Required by Phase 4 & Phase 2 in index.html
    check('index.html', indexHtml, 'id="damage-vignette"', 'Damage vignette overlay element');
    check('index.html', indexHtml, 'id="mortar-cancel-btn"', 'Mortar cancel button');
    check('index.html', indexHtml, 'modules/shop.js', 'Shop module script tag');
    check('index.html', indexHtml, 'modules/drones.js', 'Drones module script tag');

    // Telemetry DOM Hooks in index.html
    const requiredHooks = [
        'id="hp-val"',
        'id="hp-fill"',
        'id="ammo-clip"',
        'id="ammo-reserve"',
        'id="round-timer"',
        'id="hud-armor"',
        'id="hud-credits"',
        'id="hud-score"',
        'id="minimap-container"',
        'id="minimap-canvas"',
        'id="weapon-name"',
        'id="bullet-type-display"',
        'id="slot-1"',
        'id="slot-2"',
        'id="slot-3"',
        'id="slot-4"',
        'id="buy-menu"',
        'id="main-menu"',
        'id="result-screen"',
        'id="scope-panel"'
    ];

    for (const hook of requiredHooks) {
        check('index.html', indexHtml, hook, `Required DOM hook ${hook}`);
    }

    // Style.css invariants
    check('style.css', styleCss, '#crosshair.hit', 'Crosshair hit selector (Phase 4 requirement)');
    check('style.css', styleCss, '#crosshair.hit-headshot', 'Crosshair hit-headshot selector (Phase 4 requirement)');
    check('style.css', styleCss, 'tabular-nums', 'Tabular numbers typography rule');

    // Design Tokens claimed in Worker Handoff Line 39
    check('style.css', styleCss, '--color-cyan', 'Nanite cyan token');
    check('style.css', styleCss, '--color-amber', 'Solar amber token');
    check('style.css', styleCss, '--color-crimson', 'Crimson laser token');
    check('style.css', styleCss, '--color-toxic', 'Toxic lime token');
    check('style.css', styleCss, '--bg-space', 'Obsidian void background token claimed in handoff', 'WARNING');
    check('style.css', styleCss, '--color-blue', 'Blue accent token claimed in handoff', 'WARNING');

    return errors;
}

function boxesIntersect(r1, r2) {
    return !(
        r2.left >= r1.right ||
        r2.right <= r1.left ||
        r2.top >= r1.bottom ||
        r2.bottom <= r1.top
    );
}

async function runViewportResponsiveChecks() {
    console.log('\n================================================================================');
    console.log('>>> 2. VIEWPORT BOUNDARY, HUD ANCHOR & TOUCH COLLISION AUDIT');
    console.log('================================================================================');
    const viewports = [
        { name: 'Desktop Full HD', width: 1920, height: 1080, isMobile: false, hasTouch: false },
        { name: 'Laptop WXGA', width: 1366, height: 768, isMobile: false, hasTouch: false },
        { name: 'Mobile Portrait (iPhone 12/13/14)', width: 390, height: 844, isMobile: true, hasTouch: true },
        { name: 'Mobile Landscape', width: 844, height: 390, isMobile: true, hasTouch: true }
    ];

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const results = [];
    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    for (const vp of viewports) {
        console.log(`\n--- Auditing Viewport: ${vp.name} (${vp.width}x${vp.height}) ---`);
        const page = await browser.newPage();
        const pageErrors = [];
        page.on('pageerror', err => pageErrors.push(err.message));

        await page.setViewport({
            width: vp.width,
            height: vp.height,
            isMobile: vp.isMobile,
            hasTouch: vp.hasTouch
        });

        await page.goto(baseUri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        const layoutMetrics = await page.evaluate(() => {
            function getRect(sel) {
                const el = document.querySelector(sel);
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0' && rect.width > 0 && rect.height > 0;
                return {
                    selector: sel,
                    isVisible,
                    top: rect.top,
                    bottom: rect.bottom,
                    left: rect.left,
                    right: rect.right,
                    width: rect.width,
                    height: rect.height
                };
            }

            const vw = window.innerWidth;
            const vh = window.innerHeight;

            return {
                vw,
                vh,
                hudBottom: getRect('.hud-bottom'),
                hudLeft: getRect('.hud-left'),
                hudRight: getRect('.hud-right'),
                hudRightWrapper: getRect('.hud-right-wrapper'),
                hudTop: getRect('.hud-top'),
                minimap: getRect('#minimap-container'),
                weaponInventory: getRect('.weapon-inventory'),
                joystickZone: getRect('#joystick-zone'),
                touchActions: getRect('#touch-actions'),
                touchShoot: getRect('#touch-shoot'),
                touchJump: getRect('#touch-jump'),
                touchCrouch: getRect('#touch-crouch')
            };
        });

        const errors = [];

        // 1. Invariant: .hud-bottom MUST be anchored at the bottom of the viewport
        if (layoutMetrics.hudBottom && layoutMetrics.hudBottom.isVisible) {
            const bottomDistance = vp.height - layoutMetrics.hudBottom.bottom;
            if (layoutMetrics.hudBottom.top < vp.height * 0.3) {
                errors.push(`[CRITICAL LAYOUT REGRESSION] .hud-bottom is rendering at top of screen (top: ${Math.round(layoutMetrics.hudBottom.top)}px, bottom: ${Math.round(layoutMetrics.hudBottom.bottom)}px). Expected anchor near screen bottom (vh: ${vp.height}px).`);
            }
        }

        // 2. Invariant: Vitality cluster (.hud-left) must NOT collide with minimap radar
        if (layoutMetrics.hudLeft && layoutMetrics.minimap && layoutMetrics.hudLeft.isVisible && layoutMetrics.minimap.isVisible) {
            if (boxesIntersect(layoutMetrics.hudLeft, layoutMetrics.minimap)) {
                const xOverlap = Math.max(0, Math.min(layoutMetrics.hudLeft.right, layoutMetrics.minimap.right) - Math.max(layoutMetrics.hudLeft.left, layoutMetrics.minimap.left));
                const yOverlap = Math.max(0, Math.min(layoutMetrics.hudLeft.bottom, layoutMetrics.minimap.bottom) - Math.max(layoutMetrics.hudLeft.top, layoutMetrics.minimap.top));
                const area = xOverlap * yOverlap;
                if (area > 20) {
                    errors.push(`[CRITICAL COLLISION] Vitality cluster .hud-left directly overlaps #minimap-container (overlap area: ${Math.round(area)}px^2, bounds: .hud-left[${Math.round(layoutMetrics.hudLeft.left)},${Math.round(layoutMetrics.hudLeft.top)}] vs minimap[${Math.round(layoutMetrics.minimap.left)},${Math.round(layoutMetrics.minimap.top)}]).`);
                }
            }
        }

        // 3. Invariant: Elements must not overflow viewport horizontally
        const checkOverflow = [
            layoutMetrics.hudTop,
            layoutMetrics.hudLeft,
            layoutMetrics.hudRight,
            layoutMetrics.hudRightWrapper,
            layoutMetrics.minimap
        ].filter(el => el && el.isVisible);

        for (const el of checkOverflow) {
            if (el.left < 0 || el.right > vp.width + 2) {
                errors.push(`[VIEWPORT OVERFLOW] ${el.selector} overflows viewport width: bounds=[${Math.round(el.left)}, ${Math.round(el.right)}] on viewport width ${vp.width}px.`);
            }
        }

        // 4. Invariant: On touch viewports, touch buttons must not collide with HUD telemetry or inventory
        if (vp.hasTouch) {
            const touchElements = [
                layoutMetrics.joystickZone,
                layoutMetrics.touchActions,
                layoutMetrics.touchShoot,
                layoutMetrics.touchJump,
                layoutMetrics.touchCrouch
            ].filter(el => el && el.isVisible);

            const hudClusters = [
                layoutMetrics.hudLeft,
                layoutMetrics.hudRight,
                layoutMetrics.hudRightWrapper,
                layoutMetrics.weaponInventory,
                layoutMetrics.minimap
            ].filter(el => el && el.isVisible);

            for (const t of touchElements) {
                for (const h of hudClusters) {
                    if (boxesIntersect(t, h)) {
                        const xOverlap = Math.max(0, Math.min(t.right, h.right) - Math.max(t.left, h.left));
                        const yOverlap = Math.max(0, Math.min(t.bottom, h.bottom) - Math.max(t.top, h.top));
                        const area = xOverlap * yOverlap;
                        if (area > 30) {
                            errors.push(`[TOUCH COLLISION] Touch control ${t.selector} collides with ${h.selector} (overlap area: ${Math.round(area)}px^2).`);
                        }
                    }
                }
            }
        }

        if (pageErrors.length > 0) {
            errors.push(`[BROWSER ERROR] Page errors: ${pageErrors.join('; ')}`);
        }

        results.push({
            viewport: vp.name,
            size: `${vp.width}x${vp.height}`,
            metrics: layoutMetrics,
            errors,
            passed: errors.length === 0
        });

        if (errors.length === 0) {
            console.log(`  PASS: Viewport ${vp.name} passed all boundary and anchor checks.`);
        } else {
            console.error(`  FAIL: Viewport ${vp.name} failed with ${errors.length} defect(s):`);
            errors.forEach(e => console.error(`    - ${e}`));
        }

        await page.close();
    }

    await browser.close();
    return results;
}

async function main() {
    const staticErrors = await runStaticContractChecks();
    const viewportResults = await runViewportResponsiveChecks();

    console.log('\n================================================================================');
    console.log('>>> EMPIRICAL CHALLENGER FINAL SUMMARY');
    console.log('================================================================================');
    const criticalStatic = staticErrors.filter(e => e.severity === 'CRITICAL').length;
    const warningStatic = staticErrors.filter(e => e.severity === 'WARNING').length;
    const totalViewportErrors = viewportResults.reduce((acc, r) => acc + r.errors.length, 0);

    console.log(`Static Contract Issues   : ${criticalStatic} critical, ${warningStatic} warnings`);
    console.log(`Viewport Layout Defects  : ${totalViewportErrors} defects detected across viewports`);

    if (criticalStatic === 0 && totalViewportErrors === 0) {
        console.log('\n>>> VERDICT: APPROVE <<<');
        process.exit(0);
    } else {
        console.error('\n>>> VERDICT: REJECT <<<');
        process.exit(1);
    }
}

main().catch(err => {
    console.error('Fatal challenger execution error:', err);
    process.exit(1);
});
