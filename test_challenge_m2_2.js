/**
 * Milestone 2 Gate 2 Empirical Adversarial Stress Test Harness
 * 
 * Target: UI Ergonomics, Transition Performance & Accessibility Stress
 * 1. Modal Transition Stress (100x rapid toggles on #buy-menu & #scope-panel, DOM mutations, memory, transition resolution)
 * 2. Tablet Viewport Ergonomics (768x1024 portrait & 1024x768 landscape, safe thumb reach zones, >=15px clearance)
 * 3. Contrast & Accessibility Stress (WCAG AA compliance for --color-toxic, --color-cyan, --color-armor, button hover)
 * 4. Baseline Regression Integration Check
 * 
 * ZERO implementation modifications.
 */

const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

// ── WCAG 2.1 Contrast Ratio Utilities ──
function parseRgb(colorStr) {
    if (!colorStr) return { r: 0, g: 0, b: 0, a: 1 };
    const match = colorStr.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\)/);
    if (match) {
        return {
            r: parseFloat(match[1]),
            g: parseFloat(match[2]),
            b: parseFloat(match[3]),
            a: match[4] !== undefined ? parseFloat(match[4]) : 1
        };
    }
    if (colorStr.startsWith('#')) {
        let hex = colorStr.slice(1);
        if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
        const num = parseInt(hex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255,
            a: 1
        };
    }
    return { r: 0, g: 0, b: 0, a: 1 };
}

function compositeColor(fg, bg) {
    const a = fg.a;
    return {
        r: Math.round(fg.r * a + bg.r * (1 - a)),
        g: Math.round(fg.g * a + bg.g * (1 - a)),
        b: Math.round(fg.b * a + bg.b * (1 - a)),
        a: 1
    };
}

function getLuminance(rgb) {
    const sRGB = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
    const linear = sRGB.map(val => val <= 0.04045 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4));
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function calculateContrastRatio(fgStr, bgStr, baseBgStr = '#04070a') {
    const base = parseRgb(baseBgStr);
    const bgRaw = parseRgb(bgStr);
    const effectiveBg = bgRaw.a < 1 ? compositeColor(bgRaw, base) : bgRaw;
    const fgRaw = parseRgb(fgStr);
    const effectiveFg = fgRaw.a < 1 ? compositeColor(fgRaw, effectiveBg) : fgRaw;

    const l1 = getLuminance(effectiveFg);
    const l2 = getLuminance(effectiveBg);
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
}

// ── Bounding Box Distance Utility ──
function calculateBoxClearance(r1, r2) {
    // If overlapping, clearance is negative
    const xOverlap = Math.max(0, Math.min(r1.right, r2.right) - Math.max(r1.left, r2.left));
    const yOverlap = Math.max(0, Math.min(r1.bottom, r2.bottom) - Math.max(r1.top, r2.top));
    if (xOverlap > 0 && yOverlap > 0) {
        return -(xOverlap * yOverlap); // negative area indicates collision
    }
    const dx = Math.max(0, Math.max(r1.left - r2.right, r2.left - r1.right));
    const dy = Math.max(0, Math.max(r1.top - r2.bottom, r2.top - r1.bottom));
    return Math.sqrt(dx * dx + dy * dy);
}

async function runM2Gate2AdversarialSuite() {
    console.log("================================================================================");
    console.log("    MILESTONE 2 GATE 2: EMPIRICAL ADVERSARIAL STRESS TEST SUITE                 ");
    console.log("================================================================================");

    let totalTests = 0;
    let totalPassed = 0;
    let totalFailed = 0;
    const failures = [];

    function record(condition, testId, message, details = "") {
        totalTests++;
        if (condition) {
            console.log(`  [PASS] ${testId}: ${message} ${details}`);
            totalPassed++;
        } else {
            console.error(`  [FAIL] ${testId}: ${message} ${details}`);
            totalFailed++;
            failures.push(`${testId}: ${message} ${details}`);
        }
    }

    const browser = await puppeteer.launch({
        headless: 'new',
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-web-security',
            '--js-flags=--expose-gc'
        ]
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');

    try {
        // =========================================================================
        // PART 1: MODAL TRANSITION STRESS TEST (100x RAPID TOGGLES)
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> 1. MODAL TRANSITION STRESS (100x Rapid Toggles on #buy-menu & #scope-panel)");
        console.log("================================================================================");

        const page1 = await browser.newPage();
        await page1.setViewport({ width: 1920, height: 1080 });
        await page1.goto(baseUri, { waitUntil: 'load' });
        await page1.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        // 1.1 Buy Menu 100x Rapid Toggling
        const buyMenuStressResult = await page1.evaluate(async () => {
            const buyMenu = document.getElementById('buy-menu');
            const touchUi = document.getElementById('touch-ui');
            let mutationCount = 0;
            const initialChildCount = buyMenu.querySelectorAll('*').length;

            const observer = new MutationObserver(mutations => {
                mutationCount += mutations.length;
            });
            observer.observe(buyMenu, { attributes: true, childList: true, subtree: true });

            const memBefore = (window.performance && window.performance.memory) 
                ? window.performance.memory.usedJSHeapSize : 0;
            const startTime = performance.now();

            // Perform 100 rapid toggles
            for (let i = 0; i < 100; i++) {
                if (i % 2 === 0) {
                    buyMenu.classList.remove('hidden');
                    buyMenu.classList.add('active');
                } else {
                    buyMenu.classList.add('hidden');
                    buyMenu.classList.remove('active');
                }
            }
            const endTime = performance.now();
            observer.disconnect();

            const memAfter = (window.performance && window.performance.memory) 
                ? window.performance.memory.usedJSHeapSize : 0;
            const finalChildCount = buyMenu.querySelectorAll('*').length;

            // Test Open Transition resolution
            buyMenu.classList.remove('hidden');
            buyMenu.classList.add('active');
            
            // Allow CSS transition to resolve
            await new Promise(r => setTimeout(r, 1000));

            const openStyle = window.getComputedStyle(buyMenu);
            const openOpacity = parseFloat(openStyle.opacity);
            const openPointerEvents = openStyle.pointerEvents;
            const openDisplay = openStyle.display;

            // Touch UI isolation in open state
            const touchUiStyleOpen = touchUi ? window.getComputedStyle(touchUi) : null;
            const touchUiPointerOpen = touchUiStyleOpen ? touchUiStyleOpen.pointerEvents : null;

            // Test Closed state resolution
            buyMenu.classList.add('hidden');
            buyMenu.classList.remove('active');
            await new Promise(r => setTimeout(r, 1000));
            const closedStyle = window.getComputedStyle(buyMenu);
            const closedOpacity = parseFloat(closedStyle.opacity);
            const closedPointerEvents = closedStyle.pointerEvents;

            return {
                elapsedMs: endTime - startTime,
                mutationCount,
                initialChildCount,
                finalChildCount,
                heapDeltaBytes: memAfter - memBefore,
                openOpacity,
                openPointerEvents,
                openDisplay,
                touchUiPointerOpen,
                closedOpacity,
                closedPointerEvents
            };
        });

        record(
            buyMenuStressResult.elapsedMs < 1000,
            "M1.1.1",
            "100x rapid toggles on #buy-menu executed without layout thrashing freeze",
            `(${buyMenuStressResult.elapsedMs.toFixed(1)}ms total, ${(buyMenuStressResult.elapsedMs/100).toFixed(3)}ms/toggle)`
        );
        record(
            buyMenuStressResult.initialChildCount === buyMenuStressResult.finalChildCount,
            "M1.1.2",
            "DOM element tree integrity preserved across 100x toggles (zero node leakage)",
            `(${buyMenuStressResult.initialChildCount} -> ${buyMenuStressResult.finalChildCount} nodes)`
        );
        record(
            buyMenuStressResult.heapDeltaBytes < 15 * 1024 * 1024,
            "M1.1.3",
            "Heap memory consumption remains tightly bounded across rapid cycles",
            `(${(buyMenuStressResult.heapDeltaBytes / (1024 * 1024)).toFixed(2)} MB delta)`
        );
        record(
            buyMenuStressResult.openOpacity > 0.5 && buyMenuStressResult.openPointerEvents === 'auto' && buyMenuStressResult.openDisplay !== 'none',
            "M1.1.4",
            "#buy-menu open transition resolves cleanly (opacity > 0.5, pointer-events: auto, display: flex)",
            `(opacity: ${buyMenuStressResult.openOpacity.toFixed(3)}, pointerEvents: ${buyMenuStressResult.openPointerEvents})`
        );
        record(
            buyMenuStressResult.closedOpacity === 0 && buyMenuStressResult.closedPointerEvents === 'none',
            "M1.1.5",
            "#buy-menu closed state resolved cleanly (opacity: 0, pointer-events: none, no click hijacking)",
            `(opacity: ${buyMenuStressResult.closedOpacity}, pointerEvents: ${buyMenuStressResult.closedPointerEvents})`
        );

        // 1.2 Scope Panel 100x Rapid Toggling & Grid Accumulation Guard
        const scopeStressResult = await page1.evaluate(async () => {
            const scopePanel = document.getElementById('scope-panel');
            const scopeGrid = document.getElementById('scope-grid');
            let mutationCount = 0;
            const initialChildCount = scopePanel.querySelectorAll('*').length;

            const observer = new MutationObserver(mutations => {
                mutationCount += mutations.length;
            });
            observer.observe(scopePanel, { attributes: true, childList: true, subtree: true });

            const memBefore = (window.performance && window.performance.memory) 
                ? window.performance.memory.usedJSHeapSize : 0;
            const startTime = performance.now();

            // Perform 100 rapid toggles and call buildScopeGrid
            for (let i = 0; i < 100; i++) {
                if (i % 2 === 0) {
                    if (typeof buildScopeGrid === 'function') buildScopeGrid();
                    scopePanel.classList.remove('hidden');
                    scopePanel.classList.add('active');
                } else {
                    scopePanel.classList.add('hidden');
                    scopePanel.classList.remove('active');
                }
            }
            const endTime = performance.now();
            observer.disconnect();

            const memAfter = (window.performance && window.performance.memory) 
                ? window.performance.memory.usedJSHeapSize : 0;
            const finalGridButtonCount = scopeGrid ? scopeGrid.querySelectorAll('button').length : 0;

            // Final Open State with transition resolution
            scopePanel.classList.remove('hidden');
            scopePanel.classList.add('active');
            await new Promise(r => setTimeout(r, 1000));

            const openStyle = window.getComputedStyle(scopePanel);
            const openOpacity = parseFloat(openStyle.opacity);
            const openPointerEvents = openStyle.pointerEvents;
            const hasDeployBtn = !!scopePanel.querySelector('button.deploy-btn');

            // Final Closed State
            scopePanel.classList.add('hidden');
            scopePanel.classList.remove('active');
            await new Promise(r => setTimeout(r, 1000));
            const closedStyle = window.getComputedStyle(scopePanel);
            const closedOpacity = parseFloat(closedStyle.opacity);
            const closedPointerEvents = closedStyle.pointerEvents;

            return {
                elapsedMs: endTime - startTime,
                mutationCount,
                finalGridButtonCount,
                heapDeltaBytes: memAfter - memBefore,
                openOpacity,
                openPointerEvents,
                hasDeployBtn,
                closedOpacity,
                closedPointerEvents
            };
        });

        record(
            scopeStressResult.elapsedMs < 1000,
            "M1.2.1",
            "100x rapid toggles on #scope-panel executed without frame freeze",
            `(${scopeStressResult.elapsedMs.toFixed(1)}ms total, ${(scopeStressResult.elapsedMs/100).toFixed(3)}ms/toggle)`
        );
        record(
            scopeStressResult.finalGridButtonCount === 8,
            "M1.2.2",
            "Scope grid button count remains strictly stable at 8 (no duplicate button buildup)",
            `(${scopeStressResult.finalGridButtonCount} optics cards)`
        );
        record(
            scopeStressResult.openOpacity >= 0.95 && scopeStressResult.openPointerEvents === 'auto' && scopeStressResult.hasDeployBtn,
            "M1.2.3",
            "#scope-panel open state resolved cleanly with preserved button.deploy-btn",
            `(opacity: ${scopeStressResult.openOpacity}, pointerEvents: ${scopeStressResult.openPointerEvents})`
        );
        record(
            scopeStressResult.closedOpacity === 0 && scopeStressResult.closedPointerEvents === 'none',
            "M1.2.4",
            "#scope-panel closed state resolved cleanly (opacity: 0, pointer-events: none)",
            `(opacity: ${scopeStressResult.closedOpacity}, pointerEvents: ${scopeStressResult.closedPointerEvents})`
        );

        await page1.close();

        // =========================================================================
        // PART 2: TABLET VIEWPORT ERGONOMICS & CLEARANCE AUDIT
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> 2. TABLET VIEWPORT ERGONOMICS (768x1024 Portrait & 1024x768 Landscape)");
        console.log("================================================================================");

        const tabletViewports = [
            { name: "iPad/Tablet Portrait", width: 768, height: 1024, isMobile: true, hasTouch: true },
            { name: "iPad/Tablet Landscape", width: 1024, height: 768, isMobile: true, hasTouch: true }
        ];

        for (const tvp of tabletViewports) {
            console.log(`\n--- Evaluating ${tvp.name} (${tvp.width}x${tvp.height}) ---`);
            const pageTablet = await browser.newPage();
            await pageTablet.setViewport({
                width: tvp.width,
                height: tvp.height,
                isMobile: tvp.isMobile,
                hasTouch: tvp.hasTouch
            });
            await pageTablet.goto(baseUri, { waitUntil: 'load' });
            await pageTablet.click('#start-btn');
            await new Promise(r => setTimeout(r, 600));

            const tabletMetrics = await pageTablet.evaluate(() => {
                function getBox(sel) {
                    const el = document.querySelector(sel);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    const s = window.getComputedStyle(el);
                    const isVisible = s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && r.width > 0 && r.height > 0;
                    return {
                        selector: sel,
                        isVisible,
                        left: r.left,
                        right: r.right,
                        top: r.top,
                        bottom: r.bottom,
                        width: r.width,
                        height: r.height
                    };
                }

                // All touch action buttons
                const touchButtons = [
                    getBox('#touch-actions'),
                    getBox('#touch-shoot'),
                    getBox('#touch-jump'),
                    getBox('#touch-crouch'),
                    getBox('#touch-reload'),
                    getBox('#touch-scope')
                ].filter(b => b && b.isVisible);

                // HUD telemetry elements
                const hudClusters = [
                    getBox('.hud-right-wrapper') || getBox('.hud-right'),
                    getBox('.hud-left'),
                    getBox('.hud-top'),
                    getBox('.weapon-inventory'),
                    getBox('#minimap-container')
                ].filter(h => h && h.isVisible);

                const joystick = getBox('#joystick-zone');

                return {
                    vw: window.innerWidth,
                    vh: window.innerHeight,
                    touchButtons,
                    hudClusters,
                    joystick
                };
            });

            // 2.1 Viewport containment check
            let outOfBoundsCount = 0;
            tabletMetrics.touchButtons.forEach(btn => {
                if (btn.left < 0 || btn.right > tvp.width + 1 || btn.top < 0 || btn.bottom > tvp.height + 1) {
                    outOfBoundsCount++;
                }
            });
            record(
                outOfBoundsCount === 0,
                `T2.1-${tvp.width}`,
                `${tvp.name}: Touch buttons completely contained inside viewport bounds`,
                `(${tabletMetrics.touchButtons.length} buttons checked, ${outOfBoundsCount} clipped)`
            );

            // 2.2 Safe thumb reach zone check
            // For right-handed action cluster, distance from right edge must be <= 220px
            const actionsBox = tabletMetrics.touchButtons.find(b => b.selector === '#touch-actions') || tabletMetrics.touchButtons[0];
            let rightEdgeOffset = 0;
            let bottomEdgeOffset = 0;
            if (actionsBox) {
                rightEdgeOffset = tvp.width - actionsBox.right;
                bottomEdgeOffset = tvp.height - actionsBox.bottom;
            }
            record(
                actionsBox && rightEdgeOffset <= 200 && bottomEdgeOffset <= 150,
                `T2.2-${tvp.width}`,
                `${tvp.name}: Touch action cluster resides within safe thumb reach perimeter`,
                `(right edge offset: ${rightEdgeOffset.toFixed(1)}px, bottom offset: ${bottomEdgeOffset.toFixed(1)}px)`
            );

            // 2.3 Clearance check from HUD telemetry (contract: >= 15px clearance)
            let minClearance = 99999;
            let closestPair = null;
            let collisionCount = 0;

            for (const btn of tabletMetrics.touchButtons) {
                for (const hud of tabletMetrics.hudClusters) {
                    const clearance = calculateBoxClearance(btn, hud);
                    if (clearance < minClearance) {
                        minClearance = clearance;
                        closestPair = { btn: btn.selector, hud: hud.selector, clearance };
                    }
                    if (clearance < 15) {
                        collisionCount++;
                    }
                }
            }

            record(
                minClearance >= 15 && collisionCount === 0,
                `T2.3-${tvp.width}`,
                `${tvp.name}: Touch controls maintain >= 15px safe clearance from HUD telemetry`,
                `(min clearance: ${minClearance.toFixed(1)}px between ${closestPair ? closestPair.btn : 'N/A'} and ${closestPair ? closestPair.hud : 'N/A'})`
            );

            await pageTablet.close();
        }

        // =========================================================================
        // PART 3: CONTRAST & ACCESSIBILITY STRESS (WCAG AA COMPLIANCE)
        // =========================================================================
        console.log("\n================================================================================");
        console.log(">>> 3. CONTRAST & ACCESSIBILITY STRESS (WCAG AA Compliance Testing)");
        console.log("================================================================================");

        const pageContrast = await browser.newPage();
        await pageContrast.setViewport({ width: 1920, height: 1080 });
        await pageContrast.goto(baseUri, { waitUntil: 'load' });
        await pageContrast.click('#start-btn');
        await new Promise(r => setTimeout(r, 600));

        // Open Buy Menu to inspect prices and buttons
        await pageContrast.evaluate(() => {
            const m = document.getElementById('buy-menu');
            if (m) {
                m.classList.remove('hidden');
                m.classList.add('active');
            }
        });
        await new Promise(r => setTimeout(r, 400));

        const contrastData = await pageContrast.evaluate(() => {
            function getElemStyles(sel) {
                const el = document.querySelector(sel);
                if (!el) return null;
                const style = window.getComputedStyle(el);
                return {
                    color: style.color,
                    backgroundColor: style.backgroundColor,
                    fontSize: style.fontSize,
                    fontWeight: style.fontWeight
                };
            }

            const rootStyle = window.getComputedStyle(document.documentElement);
            const colorToxic = rootStyle.getPropertyValue('--color-toxic').trim();
            const colorCyan = rootStyle.getPropertyValue('--color-cyan').trim();
            const colorArmor = rootStyle.getPropertyValue('--color-armor').trim();
            const bgBase = rootStyle.getPropertyValue('--color-bg-base').trim() || '#04070a';

            // Prices in buy menu
            const priceEl = document.querySelector('#buy-menu .price');
            const priceStyle = priceEl ? window.getComputedStyle(priceEl) : null;
            const priceParent = priceEl ? window.getComputedStyle(priceEl.parentElement) : null;
            const modalStyle = window.getComputedStyle(document.getElementById('buy-menu'));

            // Vitality & Armor
            const hpVal = getElemStyles('#hp-val');
            const hudArmor = getElemStyles('#hud-armor');
            const hudLeft = getElemStyles('.hud-left');
            const ctScore = getElemStyles('.ct-score');

            return {
                colorToxic,
                colorCyan,
                colorArmor,
                bgBase,
                price: {
                    color: priceStyle ? priceStyle.color : colorToxic,
                    bg: priceStyle ? priceStyle.backgroundColor : 'rgba(0, 255, 136, 0.1)',
                    parentBg: priceParent ? priceParent.backgroundColor : 'rgba(8, 14, 24, 0.82)',
                    modalBg: modalStyle ? modalStyle.backgroundColor : 'rgba(6, 11, 19, 0.82)',
                    fontSize: priceStyle ? priceStyle.fontSize : '15px',
                    fontWeight: priceStyle ? priceStyle.fontWeight : '700'
                },
                vitality: {
                    hpColor: hpVal ? hpVal.color : '#ffffff',
                    hudBg: hudLeft ? hudLeft.backgroundColor : 'rgba(16, 22, 32, 0.85)',
                    ctColor: ctScore ? ctScore.color : colorCyan
                },
                armor: {
                    color: hudArmor ? hudArmor.color : colorArmor,
                    bg: hudArmor ? hudArmor.backgroundColor : 'rgba(0, 180, 255, 0.12)',
                    hudBg: hudLeft ? hudLeft.backgroundColor : 'rgba(16, 22, 32, 0.85)'
                }
            };
        });

        // 3.1 Buy Menu Prices (--color-toxic) contrast
        const toxicContrastAgainstModal = calculateContrastRatio(
            contrastData.price.color || '#00ff88',
            contrastData.price.modalBg || 'rgba(6, 11, 19, 0.82)',
            contrastData.bgBase
        );
        const toxicContrastAgainstButton = calculateContrastRatio(
            contrastData.price.color || '#00ff88',
            contrastData.price.parentBg || 'rgba(8, 14, 24, 0.82)',
            contrastData.bgBase
        );

        record(
            toxicContrastAgainstModal >= 4.5 && toxicContrastAgainstButton >= 4.5,
            "C3.1.1",
            "Buy menu price (--color-toxic #00ff88) achieves WCAG AA normal text compliance (>= 4.5:1)",
            `(ratio against modal: ${toxicContrastAgainstModal.toFixed(2)}:1, against button: ${toxicContrastAgainstButton.toFixed(2)}:1)`
        );

        // 3.2 Health & Team Label (--color-cyan) contrast
        const cyanContrastAgainstHud = calculateContrastRatio(
            contrastData.colorCyan || '#00f0ff',
            contrastData.vitality.hudBg || 'rgba(16, 22, 32, 0.85)',
            contrastData.bgBase
        );
        record(
            cyanContrastAgainstHud >= 4.5,
            "C3.2.1",
            "Health/Faction label (--color-cyan #00f0ff) achieves WCAG AA compliance (>= 4.5:1)",
            `(computed ratio: ${cyanContrastAgainstHud.toFixed(2)}:1 against HUD substrate)`
        );

        // 3.3 Armor telemetry label (--color-armor) contrast
        const armorContrastAgainstHud = calculateContrastRatio(
            contrastData.armor.color || '#38bdf8',
            contrastData.armor.hudBg || 'rgba(16, 22, 32, 0.85)',
            contrastData.bgBase
        );
        record(
            armorContrastAgainstHud >= 4.5,
            "C3.3.1",
            "Armor badge (--color-armor #38bdf8) achieves WCAG AA compliance (>= 4.5:1)",
            `(computed ratio: ${armorContrastAgainstHud.toFixed(2)}:1 against HUD substrate)`
        );

        // 3.4 Button Hover States Contrast
        await pageContrast.hover('#buy-menu .mod-category button');
        await new Promise(r => setTimeout(r, 200));

        const hoverContrastData = await pageContrast.evaluate(() => {
            const btn = document.querySelector('#buy-menu .mod-category button');
            const style = window.getComputedStyle(btn);
            return {
                btnColor: style.color,
                btnBg: style.backgroundColor
            };
        });

        const hoverTextRatio = calculateContrastRatio(
            hoverContrastData.btnColor || '#f8fafc',
            hoverContrastData.btnBg || 'rgba(14, 24, 40, 0.92)',
            contrastData.bgBase
        );
        record(
            hoverTextRatio >= 4.5,
            "C3.4.1",
            "Buy button hover text achieves WCAG AA compliance (>= 4.5:1)",
            `(computed ratio: ${hoverTextRatio.toFixed(2)}:1)`
        );

        // Deploy button hover state in scope panel
        await pageContrast.evaluate(() => {
            const b = document.getElementById('buy-menu');
            if (b) { b.classList.add('hidden'); b.classList.remove('active'); }
            const s = document.getElementById('scope-panel');
            if (s) { s.classList.remove('hidden'); s.classList.add('active'); }
        });
        await new Promise(r => setTimeout(r, 400));
        await pageContrast.hover('#scope-panel button.deploy-btn');
        await new Promise(r => setTimeout(r, 200));

        const deployHoverData = await pageContrast.evaluate(() => {
            const btn = document.querySelector('#scope-panel button.deploy-btn');
            const style = window.getComputedStyle(btn);
            return {
                color: style.color,
                bg: style.backgroundColor
            };
        });

        const deployHoverRatio = calculateContrastRatio(
            deployHoverData.color || '#ffffff',
            deployHoverData.bg || 'rgba(0, 240, 255, 0.35)',
            contrastData.bgBase
        );
        record(
            deployHoverRatio >= 3.0, // Large bold button text requirement >= 3:1
            "C3.4.2",
            "Tactical deploy button hover state complies with WCAG AA large/bold criteria (>= 3.0:1)",
            `(computed ratio: ${deployHoverRatio.toFixed(2)}:1)`
        );

        await pageContrast.close();

    } catch (err) {
        console.error("FATAL SUITE EXECUTION ERROR:", err);
        record(false, "FATAL", "Uncaught test harness exception", err.message);
    } finally {
        await browser.close();
    }

    // =========================================================================
    // FINAL VERDICT & SUMMARY
    // =========================================================================
    console.log("\n================================================================================");
    console.log(">>> EMPIRICAL CHALLENGER FINAL SUMMARY                                          ");
    console.log("================================================================================");
    console.log(`Total Assertions Executed : ${totalTests}`);
    console.log(`Total Passed              : ${totalPassed}`);
    console.log(`Total Failed              : ${totalFailed}`);

    if (totalFailed === 0) {
        console.log("\n>>> VERDICT: APPROVE <<<");
        process.exit(0);
    } else {
        console.error("\n>>> VERDICT: REQUEST_CHANGES <<<");
        console.error("Failures:");
        failures.forEach(f => console.error("  - " + f));
        process.exit(1);
    }
}

runM2Gate2AdversarialSuite();
