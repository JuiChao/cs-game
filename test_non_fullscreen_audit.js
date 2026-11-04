const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

function getOverlapArea(r1, r2) {
    if (!r1 || !r2) return 0;
    const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    return Math.round(xOverlap * yOverlap);
}

async function runNonFullscreenAudit() {
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    const gameUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    const testCases = [
        { name: 'Landscape Non-FS Standard (844x340)', w: 844, h: 340 },
        { name: 'Landscape Non-FS Compact (844x300)', w: 844, h: 300 },
        { name: 'Landscape Non-FS iPhone 8 (667x300)', w: 667, h: 300 },
        { name: 'Landscape Non-FS Super Compact (568x270)', w: 568, h: 270 },
        { name: 'Portrait Non-FS Safari (390x664)', w: 390, h: 664 },
        { name: 'Portrait Non-FS Medium (390x600)', w: 390, h: 600 },
        { name: 'Portrait Non-FS Short (375x550)', w: 375, h: 550 },
        { name: 'Portrait Non-FS Compact (320x460)', w: 320, h: 460 },
        { name: 'Landscape Fullscreen (844x390)', w: 844, h: 390 },
        { name: 'Portrait Fullscreen (390x844)', w: 390, h: 844 }
    ];

    let totalErrors = 0;

    for (const tc of testCases) {
        console.log('\n======================================================');
        console.log('AUDITING: ' + tc.name);
        console.log('======================================================');
        await page.setViewport({ width: tc.w, height: tc.h, isMobile: true, hasTouch: true });
        await page.goto(gameUri, { waitUntil: 'load' });
        await page.evaluate(() => {
            if (typeof startGame === 'function') startGame('standard');
        });
        await new Promise(r => setTimeout(r, 400));

        const metrics = await page.evaluate(() => {
            function getBox(sel) {
                const el = document.querySelector(sel);
                if (!el) return null;
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
                return {
                    sel,
                    left: Math.round(rect.left),
                    top: Math.round(rect.top),
                    right: Math.round(rect.right),
                    bottom: Math.round(rect.bottom),
                    width: Math.round(rect.width),
                    height: Math.round(rect.height),
                    visible
                };
            }

            return {
                joystick: getBox('#joystick-zone'),
                actions: getBox('#touch-actions'),
                touchBuy: getBox('#touch-buy'),
                touchFullscreen: getBox('#touch-fullscreen'),
                hudLeft: getBox('.hud-left'),
                hudRight: getBox('.hud-right'),
                hudRightWrapper: getBox('.hud-right-wrapper'),
                hudTop: getBox('.hud-top'),
                weaponInv: getBox('.weapon-inventory'),
                minimap: getBox('#minimap-container'),
                adrenaline: getBox('#adrenaline-hud'),
                vpWidth: window.innerWidth,
                vpHeight: window.innerHeight
            };
        });

        let caseErrors = 0;
        const pairs = [
            ['Joystick vs HUD-Left (HP)', metrics.joystick, metrics.hudLeft],
            ['Joystick vs Minimap', metrics.joystick, metrics.minimap],
            ['Joystick vs Actions', metrics.joystick, metrics.actions],
            ['Joystick vs Weapon-Inventory', metrics.joystick, metrics.weaponInv],
            ['Actions vs HUD-Right (Ammo)', metrics.actions, metrics.hudRight],
            ['Actions vs HUD-Right-Wrapper', metrics.actions, metrics.hudRightWrapper],
            ['Actions vs Weapon-Inventory', metrics.actions, metrics.weaponInv],
            ['Actions vs Adrenaline', metrics.actions, metrics.adrenaline],
            ['HUD-Left vs Minimap', metrics.hudLeft, metrics.minimap],
            ['Touch-Buy vs HUD-Top', metrics.touchBuy, metrics.hudTop],
            ['Touch-Fullscreen vs HUD-Top', metrics.touchFullscreen, metrics.hudTop],
            ['Touch-Buy vs Touch-Fullscreen', metrics.touchBuy, metrics.touchFullscreen]
        ];

        for (const [desc, a, b] of pairs) {
            if (a && b && a.visible && b.visible) {
                const area = getOverlapArea(a, b);
                if (area > 0) {
                    console.error(`  ❌ FAIL: ${desc} OVERLAPS by ${area}px²`);
                    console.error('     A (' + a.sel + '): ' + JSON.stringify(a));
                    console.error('     B (' + b.sel + '): ' + JSON.stringify(b));
                    caseErrors++;
                    totalErrors++;
                } else {
                    console.log(`  ✅ PASS: ${desc} (overlap: 0px²)`);
                }
            }
        }

        // Verify touch action right margin shifted away from edge
        if (metrics.actions && metrics.actions.visible) {
            const rightMargin = tc.w - metrics.actions.right;
            console.log(`  ℹ️ Touch Actions right margin: ${rightMargin}px (left: ${metrics.actions.left}, right: ${metrics.actions.right}, width: ${metrics.actions.width})`);
            if (rightMargin < 20) {
                console.error(`  ❌ FAIL: Touch actions too close to right screen edge (${rightMargin}px < 20px)`);
                caseErrors++;
                totalErrors++;
            } else {
                console.log(`  ✅ PASS: Touch actions comfortably separated from right screen edge (${rightMargin}px >= 20px)`);
            }
        }

        if (caseErrors === 0) {
            console.log(`>>> RESULT for ${tc.name}: PERFECT (0 overlaps)`);
        }
    }

    await browser.close();
    console.log('\n======================================================');
    if (totalErrors === 0) {
        console.log('>>> ALL NON-FULLSCREEN AUDITS PASSED WITH ZERO OVERLAPS <<<');
    } else {
        console.error(`>>> AUDITS COMPLETED WITH ${totalErrors} ERROR(S) <<<`);
    }
    console.log('======================================================');
    process.exit(totalErrors === 0 ? 0 : 1);
}

runNonFullscreenAudit().catch(err => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
});
