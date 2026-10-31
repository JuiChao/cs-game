const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

function getOverlapArea(r1, r2) {
    if (!r1 || !r2) return 0;
    const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    return xOverlap * yOverlap;
}

async function runAdversarialSweep() {
    console.log('================================================================================');
    console.log('>>> ADVERSARIAL STRESS TEST SUITE — CHALLENGER 1 (MILESTONE 1 ITERATION 2)');
    console.log('================================================================================');

    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    // Section 1: Milestone 1 Gate Verification Viewports
    const m1Viewports = [
        { name: 'Desktop Full HD', width: 1920, height: 1080, isMobile: false, hasTouch: false, category: 'desktop' },
        { name: 'Laptop WXGA', width: 1366, height: 768, isMobile: false, hasTouch: false, category: 'laptop' },
        { name: 'Mobile Portrait (iPhone 12/13/14)', width: 390, height: 844, isMobile: true, hasTouch: true, category: 'mobile-portrait' },
        { name: 'Mobile Landscape', width: 844, height: 390, isMobile: true, hasTouch: true, category: 'mobile-landscape' }
    ];

    // Section 2: Extended Responsive Resolution Sweep
    const extendedViewports = [
        { name: '4K UHD Desktop', width: 3840, height: 2160, isMobile: false, hasTouch: false, category: 'desktop' },
        { name: 'QHD Desktop', width: 2560, height: 1440, isMobile: false, hasTouch: false, category: 'desktop' },
        { name: 'Ultrawide 21:9', width: 3440, height: 1440, isMobile: false, hasTouch: false, category: 'desktop' },
        { name: 'Legacy Desktop 4:3', width: 1024, height: 768, isMobile: false, hasTouch: false, category: 'desktop' },
        { name: 'Small Phone Portrait (Android)', width: 360, height: 640, isMobile: true, hasTouch: true, category: 'mobile-portrait' },
        { name: 'iPhone SE Portrait', width: 375, height: 667, isMobile: true, hasTouch: true, category: 'mobile-portrait' },
        { name: 'iPhone SE Landscape', width: 667, height: 375, isMobile: true, hasTouch: true, category: 'mobile-landscape' }
    ];

    // Section 3: Future Milestone 2 Tablet Ergonomics Audit (Advisory)
    const m2AdvisoryViewports = [
        { name: 'Tablet Landscape (iPad)', width: 1024, height: 768, isMobile: true, hasTouch: true, category: 'tablet' },
        { name: 'Tablet Portrait (iPad)', width: 768, height: 1024, isMobile: true, hasTouch: true, category: 'tablet' }
    ];

    let m1Defects = 0;
    let extendedDefects = 0;
    let m2AdvisoryNotes = [];

    async function auditViewport(vp, isAdvisory = false) {
        process.stdout.write(`Testing [${vp.name}] (${vp.width}x${vp.height})... `);
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
        await new Promise(r => setTimeout(r, 400));

        const evaluation = await page.evaluate(() => {
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

            return {
                hudBottom: getRect('.hud-bottom'),
                hudLeft: getRect('.hud-left'),
                hudRight: getRect('.hud-right'),
                hudRightWrapper: getRect('.hud-right-wrapper'),
                hudTop: getRect('.hud-top'),
                minimap: getRect('#minimap-container'),
                weaponInventory: getRect('.weapon-inventory'),
                joystickZone: getRect('#joystick-zone'),
                touchActions: getRect('#touch-actions'),
                touchCrouch: getRect('#touch-crouch')
            };
        });

        const defects = [];

        // 1. Overlap between .hud-left and #minimap-container MUST be EXACTLY 0 px²
        const overlapHudLeftMinimap = getOverlapArea(evaluation.hudLeft, evaluation.minimap);
        if (overlapHudLeftMinimap > 0) {
            defects.push(`OVERLAP DETECTED: .hud-left and #minimap-container overlap by ${overlapHudLeftMinimap.toFixed(1)} px²`);
        }

        // 2. .hud-bottom anchoring & elevation check
        if (evaluation.hudBottom && evaluation.hudBottom.isVisible) {
            if (vp.category === 'desktop' || vp.category === 'laptop') {
                const distToBottom = vp.height - evaluation.hudBottom.bottom;
                if (distToBottom > 50 || evaluation.hudBottom.top < vp.height * 0.5) {
                    defects.push(`ANCHOR DEFECT: .hud-bottom not anchored at bottom (distToBottom=${distToBottom}px, top=${evaluation.hudBottom.top}px, vh=${vp.height}px)`);
                }
            } else if (vp.category === 'mobile-portrait') {
                if (evaluation.hudBottom.bottom > vp.height - 150) {
                    defects.push(`ELEVATION DEFECT: .hud-bottom sits too low in mobile portrait (bottom=${evaluation.hudBottom.bottom}px, vh=${vp.height}px)`);
                }
            }
        }

        // 3. Viewport width overflow checks
        if (evaluation.hudTop && evaluation.hudTop.isVisible) {
            if (evaluation.hudTop.left < 0 || evaluation.hudTop.right > vp.width + 1) {
                defects.push(`OVERFLOW: .hud-top overflows viewport [${evaluation.hudTop.left.toFixed(0)}, ${evaluation.hudTop.right.toFixed(0)}] on width ${vp.width}px`);
            }
        }

        const rightEl = evaluation.hudRightWrapper || evaluation.hudRight;
        if (rightEl && rightEl.isVisible) {
            if (rightEl.right > vp.width + 2) {
                defects.push(`OVERFLOW: .hud-right overflows viewport [${rightEl.left.toFixed(0)}, ${rightEl.right.toFixed(0)}] on width ${vp.width}px`);
            }
        }

        if (evaluation.hudLeft && evaluation.hudLeft.isVisible) {
            if (evaluation.hudLeft.left < -1) {
                defects.push(`OVERFLOW: .hud-left overflows viewport left [${evaluation.hudLeft.left.toFixed(0)}]`);
            }
        }

        // 4. Touch collision check on touch devices
        if (vp.hasTouch) {
            const touchList = [evaluation.joystickZone, evaluation.touchActions, evaluation.touchCrouch].filter(e => e && e.isVisible);
            const hudList = [evaluation.hudLeft, evaluation.hudRight, evaluation.hudRightWrapper, evaluation.weaponInventory].filter(e => e && e.isVisible);

            for (const t of touchList) {
                for (const h of hudList) {
                    const area = getOverlapArea(t, h);
                    if (area > 20) {
                        defects.push(`TOUCH CONFLICT: ${t.selector} collides with ${h.selector} (${area.toFixed(1)} px²)`);
                    }
                }
            }
        }

        if (pageErrors.length > 0) {
            defects.push(`BROWSER ERRORS: ${pageErrors.join(', ')}`);
        }

        if (defects.length === 0) {
            console.log(`PASS (Overlap: 0 px², Anchored: Yes, Overflows: 0)`);
        } else {
            if (isAdvisory) {
                console.log(`ADVISORY FOR M2 (${defects.length} ergonomics note(s))`);
                defects.forEach(d => console.log(`   [M2 Note] ${d}`));
                m2AdvisoryNotes.push({ vp: vp.name, defects });
            } else {
                console.log(`FAILED (${defects.length} defect(s))`);
                defects.forEach(d => console.log(`   --> ${d}`));
            }
        }

        await page.close();
        return defects;
    }

    console.log('\n--- 1. Mandatory Milestone 1 Viewports ---');
    for (const vp of m1Viewports) {
        const d = await auditViewport(vp, false);
        m1Defects += d.length;
    }

    console.log('\n--- 2. Extended High-Res & Phone Viewports ---');
    for (const vp of extendedViewports) {
        const d = await auditViewport(vp, false);
        extendedDefects += d.length;
    }

    console.log('\n--- 3. Advisory Audit for Future Milestone 2 (Tablet Touch) ---');
    for (const vp of m2AdvisoryViewports) {
        await auditViewport(vp, true);
    }

    // Telemetry content expansion stress test
    console.log('\n--- 4. Telemetry Content Expansion Stress Test ---');
    const stressVps = [
        { name: 'Desktop Full HD', width: 1920, height: 1080 },
        { name: 'Mobile Portrait (390x844)', width: 390, height: 844, isMobile: true, hasTouch: true }
    ];

    let contentStressDefects = 0;
    for (const vp of stressVps) {
        process.stdout.write(`Testing content expansion stress on [${vp.name}]... `);
        const page = await browser.newPage();
        await page.setViewport({ width: vp.width, height: vp.height, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch });
        await page.goto(baseUri, { waitUntil: 'load' });
        await page.click('#start-btn');
        await new Promise(r => setTimeout(r, 400));

        const stressResult = await page.evaluate(() => {
            const hpVal = document.getElementById('hp-val');
            const hudArmor = document.getElementById('hud-armor');
            const ammoClip = document.getElementById('ammo-clip');
            const ammoReserve = document.getElementById('ammo-reserve');
            const roundTimer = document.getElementById('round-timer');
            const hudCredits = document.getElementById('hud-credits');
            const weaponName = document.getElementById('weapon-name');

            if (hpVal) hpVal.textContent = '999';
            if (hudArmor) hudArmor.textContent = '护甲 6/6 (100%)';
            if (ammoClip) ammoClip.textContent = '999';
            if (ammoReserve) ammoReserve.textContent = '9999';
            if (roundTimer) roundTimer.textContent = '99:59';
            if (hudCredits) hudCredits.textContent = '999999$';
            if (weaponName) weaponName.textContent = '高能离子歼灭重型轨道脉冲枪 (TITAN-RAILGUN)';

            const hl = document.querySelector('.hud-left').getBoundingClientRect();
            const mm = document.querySelector('#minimap-container').getBoundingClientRect();
            const hr = document.querySelector('.hud-right').getBoundingClientRect();
            const ht = document.querySelector('.hud-top').getBoundingClientRect();

            function intersect(r1, r2) {
                const xo = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
                const yo = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
                return xo * yo;
            }

            return {
                minimapOverlap: intersect(hl, mm),
                hudRightRight: hr.right,
                vw: window.innerWidth
            };
        });

        const defects = [];
        if (stressResult.minimapOverlap > 0) defects.push(`Minimap overlap ${stressResult.minimapOverlap} px²`);
        if (stressResult.hudRightRight > vp.width + 5) defects.push(`hud-right overflowed right (${stressResult.hudRightRight} > ${vp.width})`);

        if (defects.length === 0) {
            console.log(`PASS (Overlap: 0 px², Min-width stable)`);
        } else {
            console.log(`FAILED (${defects.join(', ')})`);
            contentStressDefects += defects.length;
        }

        await page.close();
    }

    await browser.close();

    console.log('\n================================================================================');
    console.log('>>> EMPIRICAL CHALLENGER FINAL SUMMARY');
    console.log('================================================================================');
    console.log(`Milestone 1 Gate Viewport Defects : ${m1Defects}`);
    console.log(`Extended Resolution Defects       : ${extendedDefects}`);
    console.log(`Content Expansion Stress Defects  : ${contentStressDefects}`);
    console.log(`Milestone 2 Forward Touch Notes   : ${m2AdvisoryNotes.length} viewports flagged`);

    if (m1Defects === 0 && extendedDefects === 0 && contentStressDefects === 0) {
        console.log('\n>>> VERDICT: APPROVE <<<');
        process.exit(0);
    } else {
        console.error('\n>>> VERDICT: REJECT <<<');
        process.exit(1);
    }
}

runAdversarialSweep().catch(err => {
    console.error('Fatal stress suite error:', err);
    process.exit(1);
});
