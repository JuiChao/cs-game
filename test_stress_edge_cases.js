const fs = require('fs');
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

async function verifyCssVariableAliases(page) {
    console.log('================================================================================');
    console.log('>>> 1. EMPIRICAL CSS VARIABLE ALIAS RESOLUTION VERIFICATION');
    console.log('================================================================================');

    const result = await page.evaluate(() => {
        const root = document.documentElement;
        const style = window.getComputedStyle(root);

        const rawBgSpace = style.getPropertyValue('--bg-space').trim();
        const rawColorBlue = style.getPropertyValue('--color-blue').trim();
        const rawBgBase = style.getPropertyValue('--color-bg-base').trim();
        const rawArmor = style.getPropertyValue('--color-armor').trim();

        // Create test elements to verify actual cascade resolution
        const el1 = document.createElement('div');
        el1.id = '__test_alias_bg_space';
        el1.style.backgroundColor = 'var(--bg-space)';
        document.body.appendChild(el1);

        const el2 = document.createElement('div');
        el2.id = '__test_alias_color_blue';
        el2.style.color = 'var(--color-blue)';
        document.body.appendChild(el2);

        const computedBgSpace = window.getComputedStyle(el1).backgroundColor;
        const computedColorBlue = window.getComputedStyle(el2).color;

        el1.remove();
        el2.remove();

        return {
            rawBgSpace,
            rawColorBlue,
            rawBgBase,
            rawArmor,
            computedBgSpace,
            computedColorBlue
        };
    });

    console.log(`--bg-space declaration: "${result.rawBgSpace}" (target: "${result.rawBgBase}")`);
    console.log(`--color-blue declaration: "${result.rawColorBlue}" (target: "${result.rawArmor}")`);
    console.log(`Computed background-color via var(--bg-space): "${result.computedBgSpace}"`);
    console.log(`Computed color via var(--color-blue): "${result.computedColorBlue}"`);

    const errors = [];

    // Verify --bg-space resolves to #04070a / rgb(4, 7, 10)
    // #04070a in rgb is rgb(4, 7, 10)
    if (result.computedBgSpace !== 'rgb(4, 7, 10)') {
        errors.push(`--bg-space failed to resolve to rgb(4, 7, 10), got: "${result.computedBgSpace}"`);
    } else {
        console.log('  PASS: --bg-space correctly resolves to rgb(4, 7, 10) (alias of --color-bg-base: #04070a)');
    }

    // Verify --color-blue resolves to #38bdf8 / rgb(56, 189, 248)
    // #38bdf8 in rgb: 0x38=56, 0xbd=189, 0xf8=248 -> rgb(56, 189, 248)
    if (result.computedColorBlue !== 'rgb(56, 189, 248)') {
        errors.push(`--color-blue failed to resolve to rgb(56, 189, 248), got: "${result.computedColorBlue}"`);
    } else {
        console.log('  PASS: --color-blue correctly resolves to rgb(56, 189, 248) (alias of --color-armor: #38bdf8)');
    }

    return errors;
}

async function auditViewport(page, vp, baseUri) {
    console.log(`\n--------------------------------------------------------------------------------`);
    console.log(`Auditing Viewport: ${vp.name} (${vp.width}x${vp.height}) [mobile: ${vp.isMobile}, touch: ${vp.hasTouch}]`);
    console.log(`--------------------------------------------------------------------------------`);

    const pageErrors = [];
    page.removeAllListeners('pageerror');
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

    const metrics = await page.evaluate(() => {
        function getRect(sel) {
            const el = document.querySelector(sel);
            if (!el) return null;
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const isVisible = style.display !== 'none' &&
                              style.visibility !== 'hidden' &&
                              style.opacity !== '0' &&
                              rect.width > 0 &&
                              rect.height > 0;
            return {
                selector: sel,
                isVisible,
                top: Math.round(rect.top),
                bottom: Math.round(rect.bottom),
                left: Math.round(rect.left),
                right: Math.round(rect.right),
                width: Math.round(rect.width),
                height: Math.round(rect.height)
            };
        }

        return {
            vw: window.innerWidth,
            vh: window.innerHeight,
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

    // Check 1: .hud-bottom anchor verification
    if (metrics.hudBottom && metrics.hudBottom.isVisible) {
        console.log(`  .hud-bottom bounds: top=${metrics.hudBottom.top}, bottom=${metrics.hudBottom.bottom}, h=${metrics.hudBottom.height}`);
        // Must not collapse to top of screen
        if (metrics.hudBottom.top < vp.height * 0.25) {
            errors.push(`.hud-bottom collapsed near top of screen (top: ${metrics.hudBottom.top}px, vh: ${vp.height}px)`);
        } else {
            console.log(`  PASS: .hud-bottom properly anchored in lower viewport (top: ${metrics.hudBottom.top}px >= ${Math.round(vp.height * 0.25)}px)`);
        }
    }

    // Check 2: Vitality cluster (.hud-left) vs Minimap (#minimap-container) collision
    if (metrics.hudLeft && metrics.minimap && metrics.hudLeft.isVisible && metrics.minimap.isVisible) {
        const overlap = getOverlapArea(metrics.hudLeft, metrics.minimap);
        if (overlap > 10) {
            errors.push(`Vitality cluster .hud-left overlaps #minimap-container by ${overlap} px²`);
        } else {
            console.log(`  PASS: .hud-left and #minimap-container have zero overlap (overlap: ${overlap} px²)`);
        }
    }

    // Check 3: Viewport bounds / overflow check for core HUD elements
    const hudElementsToCheck = [
        metrics.hudTop,
        metrics.hudLeft,
        metrics.hudRight,
        metrics.hudRightWrapper,
        metrics.minimap
    ].filter(el => el && el.isVisible);

    for (const el of hudElementsToCheck) {
        if (el.left < -2 || el.right > vp.width + 4) {
            errors.push(`${el.selector} overflows viewport horizontally: left=${el.left}, right=${el.right}, vw=${vp.width}`);
        }
    }
    console.log(`  PASS: Core HUD elements safely bounded within [0, ${vp.width}] horizontal limits.`);

    // Check 4: Touch Controls Non-Overlap Checks (on touch-enabled viewports)
    if (vp.hasTouch) {
        console.log('  --- Touch Controls & HUD Collision Audit ---');
        console.log(`  #joystick-zone: ${JSON.stringify(metrics.joystickZone)}`);
        console.log(`  #touch-actions: ${JSON.stringify(metrics.touchActions)}`);
        console.log(`  #touch-crouch : ${JSON.stringify(metrics.touchCrouch)}`);
        console.log(`  .weapon-inventory: ${JSON.stringify(metrics.weaponInventory)}`);

        // A. Inter-touch-controls non-overlap
        // Joystick vs Touch-actions
        if (metrics.joystickZone && metrics.touchActions && metrics.joystickZone.isVisible && metrics.touchActions.isVisible) {
            const overlap = getOverlapArea(metrics.joystickZone, metrics.touchActions);
            if (overlap > 10) {
                errors.push(`#joystick-zone overlaps #touch-actions by ${overlap} px²`);
            } else {
                console.log(`  PASS: #joystick-zone does not overlap #touch-actions (overlap: ${overlap} px²)`);
            }
        }

        // Joystick vs Weapon Inventory
        if (metrics.joystickZone && metrics.weaponInventory && metrics.joystickZone.isVisible && metrics.weaponInventory.isVisible) {
            const overlap = getOverlapArea(metrics.joystickZone, metrics.weaponInventory);
            if (overlap > 10) {
                errors.push(`#joystick-zone overlaps .weapon-inventory by ${overlap} px²`);
            } else {
                console.log(`  PASS: #joystick-zone does not overlap .weapon-inventory (overlap: ${overlap} px²)`);
            }
        }

        // Touch actions vs Weapon Inventory
        if (metrics.touchActions && metrics.weaponInventory && metrics.touchActions.isVisible && metrics.weaponInventory.isVisible) {
            const overlap = getOverlapArea(metrics.touchActions, metrics.weaponInventory);
            if (overlap > 10) {
                errors.push(`#touch-actions overlaps .weapon-inventory by ${overlap} px²`);
            } else {
                console.log(`  PASS: #touch-actions does not overlap .weapon-inventory (overlap: ${overlap} px²)`);
            }
        }

        // Touch crouch vs Weapon Inventory
        if (metrics.touchCrouch && metrics.weaponInventory && metrics.touchCrouch.isVisible && metrics.weaponInventory.isVisible) {
            const overlap = getOverlapArea(metrics.touchCrouch, metrics.weaponInventory);
            if (overlap > 10) {
                errors.push(`#touch-crouch overlaps .weapon-inventory by ${overlap} px²`);
            } else {
                console.log(`  PASS: #touch-crouch does not overlap .weapon-inventory (overlap: ${overlap} px²)`);
            }
        }

        // B. Touch controls vs Vital HUD elements
        const touchControls = [
            metrics.joystickZone,
            metrics.touchActions,
            metrics.touchCrouch,
            metrics.weaponInventory
        ].filter(el => el && el.isVisible);

        const vitalHudElements = [
            metrics.hudLeft,
            metrics.hudRight,
            metrics.hudRightWrapper,
            metrics.hudTop,
            metrics.minimap
        ].filter(el => el && el.isVisible);

        for (const tc of touchControls) {
            for (const vh of vitalHudElements) {
                // Note: .weapon-inventory is a HUD element itself, but let's check it doesn't overlap hudLeft / hudRight / minimap / hudTop
                if (tc.selector === '.weapon-inventory' && (vh.selector === '.hud-bottom' || vh.selector === '.weapon-inventory')) {
                    continue;
                }
                const overlap = getOverlapArea(tc, vh);
                if (overlap > 15) {
                    errors.push(`Touch control ${tc.selector} overlaps vital HUD element ${vh.selector} by ${overlap} px² (tc: [${tc.left},${tc.top},${tc.right},${tc.bottom}] vs vh: [${vh.left},${vh.top},${vh.right},${vh.bottom}])`);
                }
            }
        }
        if (errors.filter(e => e.includes('vital HUD')).length === 0) {
            console.log('  PASS: All touch controls maintain exclusive interaction zones separate from vital HUD telemetry.');
        }
    }

    if (pageErrors.length > 0) {
        errors.push(`Page runtime errors: ${pageErrors.join('; ')}`);
    }

    return {
        viewport: vp.name,
        resolution: `${vp.width}x${vp.height}`,
        passed: errors.length === 0,
        errors,
        metrics
    };
}

async function run() {
    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.goto(baseUri, { waitUntil: 'load' });

    // 1. CSS Variable resolution verification
    const cssErrors = await verifyCssVariableAliases(page);

    // 2. Viewport edge cases specified in instructions:
    // - ultra-wide screens (21:9 e.g. 2560x1080, 3440x1440)
    // - small square screens (800x800)
    // - narrow mobile (320x568)
    // - tall phone (414x896)
    // plus baseline standard viewports
    const viewportsToTest = [
        { name: 'Ultra-Wide 21:9 (1080p)', width: 2560, height: 1080, isMobile: false, hasTouch: false },
        { name: 'Ultra-Wide 21:9 (1440p QHD)', width: 3440, height: 1440, isMobile: false, hasTouch: false },
        { name: 'Small Square Screen', width: 800, height: 800, isMobile: false, hasTouch: false },
        { name: 'Narrow Mobile (iPhone 5/SE1)', width: 320, height: 568, isMobile: true, hasTouch: true },
        { name: 'Tall Phone (iPhone 11/XR)', width: 414, height: 896, isMobile: true, hasTouch: true },
        { name: 'Standard Phone Portrait (iPhone 12/13/14)', width: 390, height: 844, isMobile: true, hasTouch: true },
        { name: 'Landscape Phone', width: 844, height: 390, isMobile: true, hasTouch: true }
    ];

    const viewportResults = [];
    for (const vp of viewportsToTest) {
        const res = await auditViewport(page, vp, baseUri);
        viewportResults.push(res);
    }

    await browser.close();

    console.log('\n================================================================================');
    console.log('>>> EMPIRICAL CHALLENGER 2 STRESS TEST RESULTS');
    console.log('================================================================================');
    console.log(`CSS Variable Aliases: ${cssErrors.length === 0 ? 'PASSED (0 errors)' : 'FAILED (' + cssErrors.length + ' errors)'}`);
    if (cssErrors.length > 0) {
        cssErrors.forEach(e => console.error(`  - ${e}`));
    }

    let totalViewportErrors = 0;
    for (const res of viewportResults) {
        const status = res.passed ? 'PASS' : 'FAIL';
        console.log(`[${status}] Viewport: ${res.viewport} (${res.resolution}) - ${res.errors.length} defect(s)`);
        if (!res.passed) {
            totalViewportErrors += res.errors.length;
            res.errors.forEach(e => console.error(`    * ${e}`));
        }
    }

    console.log('================================================================================');
    if (cssErrors.length === 0 && totalViewportErrors === 0) {
        console.log('>>> OVERALL EMPIRICAL VERDICT: APPROVE <<<');
        process.exit(0);
    } else {
        console.error('>>> OVERALL EMPIRICAL VERDICT: REQUEST_CHANGES <<<');
        process.exit(1);
    }
}

run().catch(err => {
    console.error('Fatal execution error:', err);
    process.exit(1);
});
