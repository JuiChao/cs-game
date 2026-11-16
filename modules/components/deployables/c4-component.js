/**
 * Tactical C4 Component
 * 
 * Procedural C4 explosive block with military composition stamp, electronic detonator,
 * dynamic 7-segment LCD canvas showing countdown/ticking seconds, multi-strand
 * Catmull-Rom fuse wires, and strictly preserved `c4light` child node.
 */

(function(root) {
    'use strict';

    /**
     * Helper to draw a single 7-segment digit on a 2D canvas context.
     * Segments:
     *   -- a --
     *  |       |
     *  f       b
     *  |       |
     *   -- g --
     *  |       |
     *  e       c
     *  |       |
     *   -- d --
     */
    const SEGMENTS = {
        '0': [1, 1, 1, 1, 1, 1, 0],
        '1': [0, 1, 1, 0, 0, 0, 0],
        '2': [1, 1, 0, 1, 1, 0, 1],
        '3': [1, 1, 1, 1, 0, 0, 1],
        '4': [0, 1, 1, 0, 0, 1, 1],
        '5': [1, 0, 1, 1, 0, 1, 1],
        '6': [1, 0, 1, 1, 1, 1, 1],
        '7': [1, 1, 1, 0, 0, 0, 0],
        '8': [1, 1, 1, 1, 1, 1, 1],
        '9': [1, 1, 1, 1, 0, 1, 1],
        '-': [0, 0, 0, 0, 0, 0, 1],
        ' ': [0, 0, 0, 0, 0, 0, 0]
    };

    function draw7SegmentDigit(ctx, digitChar, x, y, width, height, litColor, dimColor) {
        const segs = SEGMENTS[digitChar] || SEGMENTS[' '];
        const segThick = Math.max(3, height * 0.12);
        const halfH = height * 0.5;

        function drawH(sx, sy, lit) {
            ctx.fillStyle = lit ? litColor : dimColor;
            ctx.beginPath();
            ctx.moveTo(sx + segThick * 0.5, sy);
            ctx.lineTo(sx + width - segThick * 0.5, sy);
            ctx.lineTo(sx + width - segThick, sy + segThick);
            ctx.lineTo(sx + segThick, sy + segThick);
            ctx.closePath();
            ctx.fill();
        }

        function drawV(sx, sy, lit) {
            ctx.fillStyle = lit ? litColor : dimColor;
            ctx.beginPath();
            ctx.moveTo(sx, sy + segThick * 0.5);
            ctx.lineTo(sx + segThick, sy + segThick);
            ctx.lineTo(sx + segThick, sy + halfH - segThick * 0.5);
            ctx.lineTo(sx, sy + halfH);
            ctx.closePath();
            ctx.fill();
        }

        // a (top horizontal)
        drawH(x, y, segs[0]);
        // b (top-right vertical)
        drawV(x + width - segThick, y, segs[1]);
        // c (bottom-right vertical)
        drawV(x + width - segThick, y + halfH - segThick * 0.5, segs[2]);
        // d (bottom horizontal)
        drawH(x, y + height - segThick, segs[3]);
        // e (bottom-left vertical)
        drawV(x, y + halfH - segThick * 0.5, segs[4]);
        // f (top-left vertical)
        drawV(x, y, segs[5]);
        // g (middle horizontal)
        drawH(x, y + halfH - segThick * 0.5, segs[6]);
    }

    /**
     * Create the procedural military composition C-4 surface texture
     */
    function createC4BlockTexture() {
        if (typeof document === 'undefined') return null;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base olive drab clay color
        ctx.fillStyle = '#546b38';
        ctx.fillRect(0, 0, size, size);

        // Procedural speckle noise for composite plastic explosive grain
        const imgData = ctx.getImageData(0, 0, size, size);
        const data = imgData.data;
        for (let i = 0; i < data.length; i += 4) {
            const noise = (Math.random() - 0.5) * 24;
            data[i] = Math.max(0, Math.min(255, data[i] + noise));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
        }
        ctx.putImageData(imgData, 0, 0);

        // Stenciled military stamp
        ctx.save();
        ctx.translate(size * 0.5, size * 0.5);
        ctx.fillStyle = 'rgba(20, 28, 15, 0.78)';
        ctx.font = '900 24px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.letterSpacing = '3px';
        ctx.fillText('C-4 HIGH EXPLOSIVE', 0, -45);
        ctx.font = 'bold 18px "Courier New", monospace';
        ctx.fillText('M112 DEMOLITION BLOCK', 0, -18);
        ctx.font = '14px "Courier New", monospace';
        ctx.fillText('COMPOSITION C-4 / 1.25 LB', 0, 6);
        ctx.fillText('LOT NO: 84A-9402', 0, 28);
        ctx.fillText('DANGER - KEEP DRY', 0, 50);

        // Border rectangle stamp
        ctx.strokeStyle = 'rgba(20, 28, 15, 0.65)';
        ctx.lineWidth = 3;
        ctx.strokeRect(-210, -75, 420, 145);

        // Black corner hazard bars
        ctx.fillStyle = 'rgba(15, 20, 12, 0.85)';
        ctx.fillRect(-220, -85, 30, 8);
        ctx.fillRect(-220, -85, 8, 30);
        ctx.fillRect(190, 77, 30, 8);
        ctx.fillRect(212, 55, 8, 30);
        ctx.restore();

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        return texture;
    }

    /**
     * Create the procedural keypad texture
     */
    function createKeypadTexture() {
        if (typeof document === 'undefined') return null;
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Matte black chassis
        ctx.fillStyle = '#181b1e';
        ctx.fillRect(0, 0, size, size);

        // Keypad grid border
        ctx.strokeStyle = '#2b3138';
        ctx.lineWidth = 4;
        ctx.strokeRect(12, 12, size - 24, size - 24);

        // 3x4 buttons
        const keys = [
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['*', '0', '#']
        ];
        const btnW = 52;
        const btnH = 38;
        const startX = 28;
        const startY = 32;
        const gapX = 18;
        const gapY = 14;

        ctx.font = 'bold 20px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let r = 0; r < 4; r++) {
            for (let c = 0; c < 3; c++) {
                const bx = startX + c * (btnW + gapX);
                const by = startY + r * (btnH + gapY);

                // Button bevel
                ctx.fillStyle = '#262c33';
                ctx.fillRect(bx, by, btnW, btnH);
                ctx.strokeStyle = '#3d4652';
                ctx.lineWidth = 2;
                ctx.strokeRect(bx, by, btnW, btnH);

                // Key label
                ctx.fillStyle = (keys[r][c] === '*' || keys[r][c] === '#') ? '#e67e22' : '#ecf0f1';
                ctx.fillText(keys[r][c], bx + btnW * 0.5, by + btnH * 0.5);
            }
        }

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Creates a high-fidelity procedural C4 deployable explosive model.
     * 
     * Preserves:
     * - Child mesh named 'c4light' at local position (-0.25, 0.15, 0)
     * - Physical bounding dimensions ~ 0.8 x 0.2 x 0.5
     * - Dynamic 7-segment digital timer screen with updateTimerDisplay()
     * - Multi-strand Catmull-Rom fuse wires
     * 
     * @returns {THREE.Group}
     */
    function createC4() {
        const group = new THREE.Group();

        // 1. Base C4 Explosive Block (Military Demolition Block)
        const blockGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
        const blockTex = createC4BlockTexture();
        const blockMat = new THREE.MeshStandardMaterial({
            color: 0x556b2f,
            map: blockTex || null,
            roughness: 0.85,
            metalness: 0.05
        });
        const block = new THREE.Mesh(blockGeo, blockMat);
        block.name = 'c4body';
        block.castShadow = true;
        block.receiveShadow = true;
        group.add(block);

        // 2. Heavy black vinyl wrap bands (bundling demolition charges)
        const tapeMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1a,
            roughness: 0.6,
            metalness: 0.1
        });
        const tape1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.208, 0.508), tapeMat);
        tape1.position.x = -0.18;
        group.add(tape1);

        const tape2 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.208, 0.508), tapeMat);
        tape2.position.x = 0.26;
        group.add(tape2);

        // 3. Electronic Detonator & Timer Housing (Main Box)
        const detHousingGeo = new THREE.BoxGeometry(0.36, 0.065, 0.32);
        const detHousingMat = new THREE.MeshStandardMaterial({
            color: 0x22262a,
            roughness: 0.45,
            metalness: 0.4
        });
        const detHousing = new THREE.Mesh(detHousingGeo, detHousingMat);
        detHousing.position.set(0.08, 0.125, 0);
        detHousing.castShadow = true;
        group.add(detHousing);

        // 4. Keypad Membrane on right side of housing
        const keypadTex = createKeypadTexture();
        const keypadGeo = new THREE.PlaneGeometry(0.14, 0.20);
        const keypadMat = new THREE.MeshStandardMaterial({
            map: keypadTex || null,
            color: keypadTex ? 0xffffff : 0x111111,
            roughness: 0.6
        });
        const keypad = new THREE.Mesh(keypadGeo, keypadMat);
        keypad.rotation.x = -Math.PI / 2;
        keypad.position.set(0.16, 0.158, 0);
        group.add(keypad);

        // 5. Dynamic 7-Segment LCD Display Canvas Screen
        const lcdCanvas = (typeof document !== 'undefined') ? document.createElement('canvas') : null;
        let lcdTexture = null;
        if (lcdCanvas) {
            lcdCanvas.width = 256;
            lcdCanvas.height = 128;
            const lcdCtx = lcdCanvas.getContext('2d');
            
            function renderLcd(secondsLeft) {
                if (!lcdCtx) return;
                // Backlit LCD glass background
                lcdCtx.fillStyle = '#0f1710';
                lcdCtx.fillRect(0, 0, 256, 128);

                // Subtle grid pattern
                lcdCtx.strokeStyle = 'rgba(0, 255, 65, 0.04)';
                lcdCtx.lineWidth = 1;
                for (let y = 0; y < 128; y += 8) {
                    lcdCtx.beginPath();
                    lcdCtx.moveTo(0, y);
                    lcdCtx.lineTo(256, y);
                    lcdCtx.stroke();
                }

                // Format MM:SS or SS
                const s = Math.max(0, Math.floor(secondsLeft || 0));
                const mins = Math.floor(s / 60);
                const secs = s % 60;
                const minStr = String(mins).padStart(2, '0');
                const secStr = String(secs).padStart(2, '0');

                const litColor = '#00ff44';
                const dimColor = '#172e1c';

                // Digits: [M1][M2] : [S1][S2]
                const dW = 34, dH = 68, topY = 30;
                draw7SegmentDigit(lcdCtx, minStr[0], 22, topY, dW, dH, litColor, dimColor);
                draw7SegmentDigit(lcdCtx, minStr[1], 64, topY, dW, dH, litColor, dimColor);

                // Colon dots
                lcdCtx.fillStyle = (s % 2 === 0) ? litColor : dimColor;
                lcdCtx.fillRect(108, topY + 18, 8, 8);
                lcdCtx.fillRect(108, topY + 44, 8, 8);

                draw7SegmentDigit(lcdCtx, secStr[0], 126, topY, dW, dH, litColor, dimColor);
                draw7SegmentDigit(lcdCtx, secStr[1], 168, topY, dW, dH, litColor, dimColor);

                // Status label
                lcdCtx.fillStyle = '#ff3333';
                lcdCtx.font = 'bold 13px monospace';
                lcdCtx.fillText('ARMED', 208, 48);

                if (lcdTexture) lcdTexture.needsUpdate = true;
            }

            renderLcd(60);
            lcdTexture = new THREE.CanvasTexture(lcdCanvas);
            group.userData.renderLcd = renderLcd;
        }

        const lcdBezelGeo = new THREE.BoxGeometry(0.16, 0.015, 0.10);
        const lcdBezelMat = new THREE.MeshStandardMaterial({ color: 0x0a0c0e, roughness: 0.3 });
        const lcdBezel = new THREE.Mesh(lcdBezelGeo, lcdBezelMat);
        lcdBezel.position.set(-0.01, 0.158, 0);
        group.add(lcdBezel);

        const lcdScreenGeo = new THREE.PlaneGeometry(0.14, 0.08);
        const lcdScreenMat = new THREE.MeshBasicMaterial({
            map: lcdTexture || null,
            color: lcdTexture ? 0xffffff : 0x00ff66
        });
        const lcdScreen = new THREE.Mesh(lcdScreenGeo, lcdScreenMat);
        lcdScreen.rotation.x = -Math.PI / 2;
        lcdScreen.position.set(-0.01, 0.166, 0);
        lcdScreen.name = 'c4lcd';
        group.add(lcdScreen);

        // 6. STRICT INVARIANT: Red blinking light named 'c4light' at (-0.25, 0.15, 0)
        const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
        lightMesh.position.set(-0.25, 0.15, 0);
        lightMesh.name = 'c4light'; // STRICT contract for physics.js flashing
        group.add(lightMesh);

        // Protective metallic bezel around the beacon light
        const lightBezelGeo = new THREE.CylinderGeometry(0.065, 0.075, 0.04, 12);
        const lightBezelMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
        const lightBezel = new THREE.Mesh(lightBezelGeo, lightBezelMat);
        lightBezel.position.set(-0.25, 0.11, 0);
        group.add(lightBezel);

        // 7. Aluminum Blasting Cap Cylinders (embedded into C4 block)
        const capMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
        const capGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.06, 8);

        const cap1 = new THREE.Mesh(capGeo, capMat);
        cap1.position.set(-0.31, 0.11, 0.08);
        group.add(cap1);

        const cap2 = new THREE.Mesh(capGeo, capMat);
        cap2.position.set(0.33, 0.11, 0.08);
        group.add(cap2);

        const cap3 = new THREE.Mesh(capGeo, capMat);
        cap3.position.set(-0.26, 0.11, -0.09);
        group.add(cap3);

        // 8. Multi-Strand Catmull-Rom Detonator Fuse Wires
        const wireDefinitions = [
            {
                color: 0xdd2222, // Red wire
                points: [
                    new THREE.Vector3(-0.06, 0.14, 0.06),
                    new THREE.Vector3(-0.14, 0.20, 0.14),
                    new THREE.Vector3(-0.25, 0.16, 0.11),
                    new THREE.Vector3(-0.31, 0.13, 0.08)
                ]
            },
            {
                color: 0x1e88e5, // Blue wire
                points: [
                    new THREE.Vector3(0.10, 0.14, 0.08),
                    new THREE.Vector3(0.20, 0.20, 0.14),
                    new THREE.Vector3(0.28, 0.16, 0.10),
                    new THREE.Vector3(0.33, 0.13, 0.08)
                ]
            },
            {
                color: 0xfbc02d, // Yellow wire
                points: [
                    new THREE.Vector3(0.00, 0.14, -0.07),
                    new THREE.Vector3(-0.10, 0.19, -0.13),
                    new THREE.Vector3(-0.20, 0.15, -0.11),
                    new THREE.Vector3(-0.26, 0.13, -0.09)
                ]
            }
        ];

        wireDefinitions.forEach(wDef => {
            const curve = new THREE.CatmullRomCurve3(wDef.points);
            const tubeGeo = new THREE.TubeGeometry(curve, 20, 0.006, 6, false);
            const tubeMat = new THREE.MeshStandardMaterial({
                color: wDef.color,
                roughness: 0.5,
                metalness: 0.1
            });
            const tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
            tubeMesh.castShadow = true;
            group.add(tubeMesh);
        });

        // 9. Dynamic Timer Display API on Group
        group.updateTimerDisplay = function(seconds) {
            if (group.userData.renderLcd) {
                group.userData.renderLcd(seconds);
            }
        };

        // Disposal helper
        group.dispose = function() {
            group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m && m.dispose());
                        else child.material.dispose();
                    }
                }
            });
            if (blockTex) blockTex.dispose();
            if (keypadTex) keypadTex.dispose();
            if (lcdTexture) lcdTexture.dispose();
        };

        return group;
    }

    // Attach to TacticalC4Component namespace
    const TacticalC4Component = {
        createC4,
        createC4BlockTexture,
        createKeypadTexture
    };

    root.TacticalC4Component = TacticalC4Component;
    root.createC4 = createC4;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalC4Component;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
