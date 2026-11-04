const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

async function testJoystickFix() {
    console.log('=== STARTING JOYSTICK FIX VERIFICATION ===');
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true });

    page.on('pageerror', err => console.error('Browser Page Error:', err));

    await page.goto('file://' + path.resolve(__dirname, 'index.html'), { waitUntil: 'networkidle0' });
    await page.evaluate(() => startGame('standard'));
    await new Promise(r => setTimeout(r, 1000));

    const zoneRect = await page.evaluate(() => {
        const r = document.getElementById('joystick-zone').getBoundingClientRect();
        return { left: r.left, top: r.top, width: r.width, height: r.height };
    });
    console.log('Zone rect:', zoneRect);
    const cx = zoneRect.left + zoneRect.width / 2;
    const cy = zoneRect.top + zoneRect.height / 2;

    // Check 1: No visible nipple discs exist before touch
    const preTouch = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        const nipple = zone.querySelector('.nipple');
        return {
            hasKnob: !!knob,
            hasNipple: !!nipple,
            knobTransform: knob ? knob.style.transform : null
        };
    });
    console.log('Pre-touch:', preTouch);
    assert(preTouch.hasKnob, 'Joystick knob element exists');
    assert(!preTouch.hasNipple, 'No rogue nipplejs DOM discs injected before touch');

    // Check 2: First touch (slightly off-center, e.g. cx + 15, cy + 10)
    console.log('\n--- Test: First Touch & Drag ---');
    await page.touchscreen.touchStart(cx + 15, cy + 10);
    await new Promise(r => setTimeout(r, 50));

    let tState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        const nipple = zone.querySelector('.nipple');
        const nippleVisible = nipple && window.getComputedStyle(nipple).display !== 'none';
        return {
            knobTransform: knob ? knob.style.transform : null,
            nippleVisible: !!nippleVisible,
            hasNipple: !!nipple
        };
    });
    console.log('During 1st touch down:', tState);
    assert(!tState.nippleVisible, 'No visible white/gray nipplejs discs on first touch down');
    assert(tState.knobTransform && tState.knobTransform !== 'translate(0px, 0px)', 'Knob moved on touch down');

    // Drag Up (moveForward = true)
    await page.touchscreen.touchMove(cx, cy - 35);
    await new Promise(r => setTimeout(r, 50));
    let moveUpState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        return {
            knobTransform: knob ? knob.style.transform : null,
            f: typeof moveForward !== 'undefined' ? moveForward : null,
            b: typeof moveBackward !== 'undefined' ? moveBackward : null
        };
    });
    console.log('Dragging UP:', moveUpState);
    assert(moveUpState.f === true, 'moveForward is true when dragging up');
    assert(moveUpState.b === false, 'moveBackward is false when dragging up');

    // Drag Right (moveRight = true)
    await page.touchscreen.touchMove(cx + 35, cy);
    await new Promise(r => setTimeout(r, 50));
    let moveRightState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        return {
            knobTransform: knob ? knob.style.transform : null,
            r: typeof moveRight !== 'undefined' ? moveRight : null,
            l: typeof moveLeft !== 'undefined' ? moveLeft : null
        };
    });
    console.log('Dragging RIGHT:', moveRightState);
    assert(moveRightState.r === true, 'moveRight is true when dragging right');
    assert(moveRightState.l === false, 'moveLeft is false when dragging right');

    // Release 1st touch
    await page.touchscreen.touchEnd();
    await new Promise(r => setTimeout(r, 200));
    let releaseState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        return {
            knobTransform: knob ? knob.style.transform : null,
            f: typeof moveForward !== 'undefined' ? moveForward : null,
            r: typeof moveRight !== 'undefined' ? moveRight : null
        };
    });
    console.log('After release 1:', releaseState);
    assert(releaseState.knobTransform === 'translate(0px, 0px)', 'Knob resets to center on release');
    assert(releaseState.f === false && releaseState.r === false, 'Movement flags reset on release');

    // Check 3: Second Touch at a COMPLETELY DIFFERENT position (cx - 20, cy - 15)
    console.log('\n--- Test: Second Touch (no split/offset bug) ---');
    await page.touchscreen.touchStart(cx - 20, cy - 15);
    await new Promise(r => setTimeout(r, 50));
    let t2State = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        const nipple = zone.querySelector('.nipple');
        const nippleVisible = nipple && window.getComputedStyle(nipple).display !== 'none';
        return {
            knobTransform: knob ? knob.style.transform : null,
            nippleVisible: !!nippleVisible,
            hasNipple: !!nipple
        };
    });
    console.log('During 2nd touch down:', t2State);
    assert(!t2State.nippleVisible, 'Second touch does NOT spawn split white/gray discs');

    // Drag down (moveBackward = true)
    await page.touchscreen.touchMove(cx, cy + 35);
    await new Promise(r => setTimeout(r, 50));
    let moveDownState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        return {
            knobTransform: knob ? knob.style.transform : null,
            f: typeof moveForward !== 'undefined' ? moveForward : null,
            b: typeof moveBackward !== 'undefined' ? moveBackward : null
        };
    });
    console.log('Dragging DOWN on 2nd touch:', moveDownState);
    assert(moveDownState.b === true, 'moveBackward is true on 2nd touch drag');
    assert(moveDownState.f === false, 'moveForward is false on 2nd touch drag');

    await page.touchscreen.touchEnd();
    await new Promise(r => setTimeout(r, 200));

    // Check 4: Multiple fast taps / touches (stress test rapid reactivation)
    console.log('\n--- Test: Rapid Multi-Touch Cycles ---');
    for (let i = 0; i < 5; i++) {
        const rx = cx + (i % 2 === 0 ? 25 : -25);
        const ry = cy + (i % 3 === 0 ? 25 : -25);
        await page.touchscreen.touchStart(rx, ry);
        await new Promise(r => setTimeout(r, 30));
        await page.touchscreen.touchMove(rx + 10, ry - 20);
        await new Promise(r => setTimeout(r, 30));
        await page.touchscreen.touchEnd();
        await new Promise(r => setTimeout(r, 30));
    }
    let rapidState = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const knob = zone.querySelector('.joystick-knob');
        return {
            knobTransform: knob ? knob.style.transform : null,
            f: typeof moveForward !== 'undefined' ? moveForward : null,
            b: typeof moveBackward !== 'undefined' ? moveBackward : null
        };
    });
    console.log('After rapid multi-touch cycles:', rapidState);
    assert(rapidState.knobTransform === 'translate(0px, 0px)', 'Knob always resets to center after rapid touches');
    assert(rapidState.f === false && rapidState.b === false, 'Flags always reset after rapid touches');

    // Check 5: Multi-Touch Look & Move Independence (Adversarial Vector)
    console.log('\n--- Test: Multi-Touch Aim & Move Independence ---');
    const multiTouchResult = await page.evaluate(() => {
        const zone = document.getElementById('joystick-zone');
        const rect = zone.getBoundingClientRect();
        const zx = rect.left + rect.width / 2;
        const zy = rect.top + rect.height / 2;
        const lookZone = document.getElementById('touch-look-zone');

        // Touch 1 on joystick (dragging up)
        const touchJoy = new Touch({ identifier: 101, target: zone, clientX: zx, clientY: zy - 32 });
        zone.dispatchEvent(new TouchEvent('touchstart', {
            changedTouches: [touchJoy],
            touches: [touchJoy],
            bubbles: true,
            cancelable: true
        }));

        const joyMoving = moveForward === true;

        // Touch 2 on look zone (aiming)
        const touchLook = new Touch({ identifier: 202, target: lookZone, clientX: 600, clientY: 200 });
        lookZone.dispatchEvent(new TouchEvent('touchstart', {
            changedTouches: [touchLook],
            touches: [touchJoy, touchLook],
            bubbles: true,
            cancelable: true
        }));

        // Move Touch 2 (aiming right) while Touch 1 stays on joystick
        const touchLookMove = new Touch({ identifier: 202, target: lookZone, clientX: 640, clientY: 200 });
        window.dispatchEvent(new TouchEvent('touchmove', {
            changedTouches: [touchLookMove],
            touches: [touchJoy, touchLookMove],
            bubbles: true,
            cancelable: true
        }));

        const joyStillMoving = moveForward === true;

        // Joystick finger lifts (Touch 101 ends), but Aim finger (Touch 202) is still held!
        window.dispatchEvent(new TouchEvent('touchend', {
            changedTouches: [touchJoy],
            touches: [touchLookMove], // touchLookMove still held!
            bubbles: true,
            cancelable: true
        }));

        const knob = zone.querySelector('.joystick-knob');
        const joyResetWhileAiming = (moveForward === false && knob.style.transform === 'translate(0px, 0px)');

        // Finally aim finger lifts
        window.dispatchEvent(new TouchEvent('touchend', {
            changedTouches: [touchLookMove],
            touches: [],
            bubbles: true,
            cancelable: true
        }));

        return { joyMoving, joyStillMoving, joyResetWhileAiming };
    });
    console.log('Multi-touch result:', multiTouchResult);
    assert(multiTouchResult.joyMoving, 'Joystick moves player forward initially');
    assert(multiTouchResult.joyStillMoving, 'Joystick remains stable while second finger aims in look zone');
    assert(multiTouchResult.joyResetWhileAiming, 'Joystick correctly resets when released even while aim finger is held');

    // Check 6: Idempotent initialization & zero DOM pollution
    console.log('\n--- Test: Idempotent Setup & Zero Rogue DOM Nodes ---');
    const idempotency = await page.evaluate(() => {
        setupTouchControls();
        setupTouchControls();
        const zone = document.getElementById('joystick-zone');
        const knobs = zone.querySelectorAll('.joystick-knob');
        const nipples = document.querySelectorAll('.nipple');
        return {
            knobCount: knobs.length,
            nippleCount: nipples.length
        };
    });
    console.log('Idempotency check:', idempotency);
    assert(idempotency.knobCount === 1, 'Only exactly 1 tactical joystick knob present after multiple setup calls');
    assert(idempotency.nippleCount === 0, 'Zero rogue NippleJS DOM disks present in document');

    console.log('\n=== ALL JOYSTICK CHECKS PASSED PERFECTLY! ===');
    await browser.close();
}

testJoystickFix().catch(err => {
    console.error('FATAL TEST ERROR:', err);
    process.exit(1);
});
