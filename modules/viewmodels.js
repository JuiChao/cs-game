// #region 武器视图模型
function createC4() {
    const group = new THREE.Group();
    // Base block (Olive green C4 explosive)
    const blockGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x556b2f });
    const block = new THREE.Mesh(blockGeo, blockMat);
    group.add(block);
    
    // Screen/Keypad (Black)
    const padGeo = new THREE.BoxGeometry(0.4, 0.05, 0.3);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 0.125, 0);
    group.add(pad);
    
    // Flashing light (Red)
    const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(-0.25, 0.15, 0);
    lightMesh.name = 'c4light'; // So we can find it to flash
    group.add(lightMesh);
    
    return group;
}

function createKarambit() {
    const group = new THREE.Group();
    
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    group.add(handle);
    
    // Ring at the bottom
    const ringGeo = new THREE.TorusGeometry(0.025, 0.008, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = 0.09;
    group.add(ring);
    
    // Curved Blade
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.05, -0.1, 0.1, -0.2); // curve down
    shape.quadraticCurveTo(0.02, -0.1, -0.02, 0); // curve back up
    shape.lineTo(0, 0);
    
    const extrudeSettings = { depth: 0.005, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bladeGeo.translate(0, 0, -0.0025); // center depth
    const bladeMat = new THREE.MeshStandardMaterial({ 
        color: 0x880000, // Crimson web pattern
        metalness: 0.8, 
        roughness: 0.2,
        side: THREE.DoubleSide
    });
    
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.scale.set(1.2, 1.2, 1.2);
    blade.position.z = -0.075;
    blade.position.y = 0.005;
    blade.rotation.x = Math.PI / 2;
    blade.rotation.y = Math.PI; // Flip blade direction
    group.add(blade);
    
    // Default orientation adjustments
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function createKukri() {
    const group = new THREE.Group();
    
    // --- Materials matching the image ---
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.3, roughness: 0.7 }); // Crimson Red
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 1.0, roughness: 0.3 }); // Gold
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 }); // Silver
    const damascusMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.4 }); // Dark steel
    
    // --- Curved Handle ---
    const handleGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 16);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.rotation.z = -0.1; // curve handle slightly down
    group.add(handle);
    
    // Gold Bolster (thick ring near blade)
    const bolsterGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.04, 16);
    const bolster = new THREE.Mesh(bolsterGeo, goldMat);
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-0.005, 0, -0.07);
    group.add(bolster);
    
    // Red/Gold Pommel (End of handle)
    const pommelGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.04, 16);
    const pommel = new THREE.Mesh(pommelGeo, handleMat);
    pommel.rotation.x = Math.PI / 2;
    pommel.position.set(0.01, 0, 0.09);
    group.add(pommel);
    
    const pommelCapGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const pommelCap = new THREE.Mesh(pommelCapGeo, goldMat);
    pommelCap.position.set(0.01, 0, 0.10);
    pommelCap.scale.set(1, 1, 0.5);
    group.add(pommelCap);
    
    // --- Blade ---
    // Base Damascus Blade (Edge and lower half)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0); 
    // Spine
    bladeShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2); // Base spine
    bladeShape.quadraticCurveTo(0.04, -0.35, 0.22, -0.50); // Aggressive forward curve to tip
    // Edge (Belly)
    bladeShape.quadraticCurveTo(0.28, -0.35, 0.12, -0.15); // Wide belly
    // Cho (Notch)
    bladeShape.lineTo(0.08, -0.08); 
    bladeShape.quadraticCurveTo(0.04, -0.06, 0.08, -0.04); // The notch indent
    bladeShape.lineTo(0.02, 0); // Back to handle
    
    const bladeSettings = { depth: 0.004, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.002, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, bladeSettings);
    bladeGeo.translate(-0.01, 0, -0.002); // Center it
    
    const blade = new THREE.Mesh(bladeGeo, damascusMat);
    blade.position.z = -0.08;
    blade.position.y = 0.01;
    blade.rotation.x = Math.PI / 2;
    blade.rotation.y = Math.PI; 
    group.add(blade);
    
    // --- Golden Spine Details ---
    const spineShape = new THREE.Shape();
    spineShape.moveTo(0, 0);
    spineShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2); // Match spine
    spineShape.quadraticCurveTo(0.04, -0.35, 0.20, -0.48); // Slightly short of tip
    // Inner curve defining the gold region (follows the spine closely)
    spineShape.quadraticCurveTo(0.08, -0.35, 0.04, -0.2);
    spineShape.lineTo(0.03, -0.08);
    spineShape.lineTo(0.02, 0);
    
    const spineSettings = { depth: 0.006, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const spineGeo = new THREE.ExtrudeGeometry(spineShape, spineSettings);
    spineGeo.translate(-0.01, 0, -0.003); // Center it
    
    const spine = new THREE.Mesh(spineGeo, goldMat);
    blade.add(spine); // Add as child of blade so transformations match
    
    // Dragon/Floral Engravings on the gold spine
    class DragonCurve extends THREE.Curve {
        getPoint(t, optionalTarget = new THREE.Vector3()) {
            const tx = -0.01 + 0.15 * t + Math.sin(t * Math.PI * 3) * 0.01; 
            const ty = -0.05 - 0.35 * t;
            const tz = 0;
            return optionalTarget.set(tx, ty, tz);
        }
    }
    const dragonGeo = new THREE.TubeGeometry(new DragonCurve(), 32, 0.003, 8, false);
    
    const dragonPattern1 = new THREE.Mesh(dragonGeo, silverMat);
    dragonPattern1.position.z = 0.004; // pop out slightly
    spine.add(dragonPattern1);
    
    const dragonPattern2 = new THREE.Mesh(dragonGeo, silverMat);
    dragonPattern2.position.z = -0.004;
    spine.add(dragonPattern2);

    // Make it roughly similar to the image's robust size
    group.scale.set(2.6, 2.6, 2.6);
    
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function createSwitchblade() {
    const group = new THREE.Group();
    
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
    const darkSilverMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, metalness: 0.8, roughness: 0.2, emissive: 0x0022aa });
    
    const handleGeo = new THREE.BoxGeometry(0.02, 0.015, 0.15);
    const handle = new THREE.Mesh(handleGeo, silverMat);
    handle.position.z = 0.075;
    group.add(handle);
    
    const handleGripGeo = new THREE.BoxGeometry(0.018, 0.016, 0.12);
    const handleGrip = new THREE.Mesh(handleGripGeo, darkSilverMat);
    handleGrip.position.z = 0.08;
    group.add(handleGrip);
    
    const buttonGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.018, 8);
    const button = new THREE.Mesh(buttonGeo, blueMat);
    button.position.z = 0.04;
    button.rotation.x = Math.PI / 2;
    group.add(button);
    
    const buttonStarGeo = new THREE.ConeGeometry(0.008, 0.005, 4);
    const buttonStar = new THREE.Mesh(buttonStarGeo, silverMat);
    buttonStar.position.set(0, 0.01, 0.04);
    group.add(buttonStar);
    
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.012, 0);
    bladeShape.lineTo(0.008, -0.16);
    bladeShape.lineTo(0, -0.22);
    bladeShape.lineTo(-0.008, -0.16);
    bladeShape.lineTo(-0.012, 0);
    bladeShape.lineTo(0, 0);
    
    const extrudeSettings = { depth: 0.002, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
    bladeGeo.translate(0, 0, -0.001);
    
    const blade = new THREE.Mesh(bladeGeo, silverMat);
    blade.position.z = 0;
    blade.rotation.x = Math.PI / 2;
    group.add(blade);
    
    const blueLineGeo = new THREE.BoxGeometry(0.002, 0.003, 0.12);
    const blueLine = new THREE.Mesh(blueLineGeo, blueMat);
    blueLine.position.z = -0.06;
    group.add(blueLine);
    
    group.scale.set(2.0, 2.0, 2.0);
    
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function buildViewModel() {
    if (playerState.viewModel) {
        camera.remove(playerState.viewModel);
        const oldHitBox = camera.getObjectByName('knifeHitBox');
        if (oldHitBox) {
            oldHitBox.geometry.dispose();
            oldHitBox.material.dispose();
            camera.remove(oldHitBox);
        }
    }
    
    const w = getCurrentWeapon();
    
    if (w.id === 'knife') {
        playerState.viewModel = createKarambit();
    } else if (w.id === 'kukri') {
        playerState.viewModel = createKukri();
    } else if (w.id === 'switchblade') {
        playerState.viewModel = createSwitchblade();
    } else {
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length);
        const mat = new THREE.MeshStandardMaterial({ color: w.color });
        playerState.viewModel = new THREE.Mesh(geo, mat);
        
        // Magazine
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        playerState.viewModel.add(magMesh);

        if (w.id === 'shotgun') {
            const fireGroup = new THREE.Group();
            fireGroup.name = 'dragonFire';
            const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
            for (let i = 0; i < 20; i++) {
                let spark = new THREE.Mesh(sparkGeo, sparkMat.clone());
                spark.position.set((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.2);
                fireGroup.add(spark);
            }
            fireGroup.position.set(0, 0, -w.length/2);
            playerState.viewModel.add(fireGroup);
        }

        if (w.id === 'gatling') {
            const barrelGroup = new THREE.Group();
            barrelGroup.name = 'gatlingBarrels';
            const barrelGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.35, 8);
            barrelGeo.rotateX(Math.PI / 2);
            const barrelMat = new THREE.MeshStandardMaterial({ color: 0x555555, metalness: 0.8, roughness: 0.2 });
            for (let i = 0; i < 6; i++) {
                const barrel = new THREE.Mesh(barrelGeo, barrelMat);
                const angle = (i / 6) * Math.PI * 2;
                barrel.position.set(Math.cos(angle) * 0.045, Math.sin(angle) * 0.045, -w.length / 2 - 0.1);
                barrelGroup.add(barrel);
            }
            const ringGeo = new THREE.TorusGeometry(0.055, 0.012, 8, 16);
            const ringMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
            const frontRing = new THREE.Mesh(ringGeo, ringMat);
            frontRing.position.set(0, 0, -w.length / 2 - 0.25);
            barrelGroup.add(frontRing);
            const backRing = new THREE.Mesh(ringGeo, ringMat);
            backRing.position.set(0, 0, -w.length / 2 + 0.05);
            barrelGroup.add(backRing);
            playerState.viewModel.add(barrelGroup);

            const ammoBoxGeo = new THREE.BoxGeometry(0.12, 0.08, 0.15);
            const ammoBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, metalness: 0.4, roughness: 0.6 });
            const ammoBox = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
            ammoBox.position.set(0, -0.08, 0.05);
            playerState.viewModel.add(ammoBox);
        }

        if (w.id === 'flamethrower') {
            const ftGroup = new THREE.Group();
            ftGroup.name = 'flamethrowerBody';

            const bodyMat = new THREE.MeshStandardMaterial({ color: 0x8B0000, metalness: 0.6, roughness: 0.4 });
            const darkMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
            const brassMat = new THREE.MeshStandardMaterial({ color: 0xcc9900, metalness: 0.9, roughness: 0.2 });

            const tankGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.4, 16);
            const tank = new THREE.Mesh(tankGeo, bodyMat);
            tank.position.set(0, -0.05, 0.05);
            ftGroup.add(tank);

            const tankCapGeo = new THREE.SphereGeometry(0.06, 16, 16);
            const tankCap = new THREE.Mesh(tankCapGeo, darkMat);
            tankCap.position.set(0, -0.05, 0.25);
            ftGroup.add(tankCap);

            const nozzleGeo = new THREE.CylinderGeometry(0.025, 0.035, 0.2, 16);
            nozzleGeo.rotateX(Math.PI / 2);
            const nozzle = new THREE.Mesh(nozzleGeo, darkMat);
            nozzle.position.set(0, 0.02, -w.length / 2 - 0.05);
            ftGroup.add(nozzle);

            const muzzleRingGeo = new THREE.TorusGeometry(0.03, 0.008, 8, 16);
            const muzzleRing = new THREE.Mesh(muzzleRingGeo, brassMat);
            muzzleRing.position.set(0, 0.02, -w.length / 2 - 0.15);
            ftGroup.add(muzzleRing);

            const hoseGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.2, 8);
            const hose = new THREE.Mesh(hoseGeo, darkMat);
            hose.position.set(0, -0.02, -0.1);
            hose.rotation.x = -0.5;
            ftGroup.add(hose);

            const gripGeo = new THREE.BoxGeometry(0.04, 0.1, 0.06);
            const grip = new THREE.Mesh(gripGeo, darkMat);
            grip.position.set(0, -0.08, 0.02);
            ftGroup.add(grip);

            playerState.viewModel.add(ftGroup);
        }
        if (w.id === 'sniper' || w.id === 'marksman' || w.id === 'rifle' || w.id === 'smg' || w.id === 'shotgun' || w.id === 'm249' || w.id === 'deagle' || w.id === 'pistol' || w.id === 'ash12') {
            const scopeId = playerState.currentScope || 'redDot';

            if (scopeId === 'none') {
                if (w.id === 'sniper' || w.id === 'marksman') {
                    const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
                    scopeGeo.rotateX(Math.PI / 2);
                    const scopeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                    const scope = new THREE.Mesh(scopeGeo, scopeMat);
                    scope.position.set(0, 0.08, -0.1);
                    playerState.viewModel.add(scope);
                } else {
                    const ironGeo = new THREE.BoxGeometry(0.006, 0.03, 0.006);
                    const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                    const front = new THREE.Mesh(ironGeo, ironMat);
                    front.position.set(0, 0.06, -0.22);
                    playerState.viewModel.add(front);
                }
            } else if (scopeId === 'redDot') {
                // Red dot sight (existing design)
                const sightGroup = new THREE.Group();
                const baseGeo = new THREE.BoxGeometry(0.10, 0.04, 0.12);
                const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3530 });
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.position.set(0, 0.077, -0.1);
                sightGroup.add(base);
                const sw = 0.045, sh = 0.035, st = 0.002;
                const frameShape = new THREE.Shape();
                frameShape.moveTo(-sw - st, -sh - st); frameShape.lineTo(sw + st, -sh - st);
                frameShape.lineTo(sw + st, sh + st); frameShape.lineTo(-sw - st, sh + st);
                frameShape.lineTo(-sw - st, -sh - st);
                const hole = new THREE.Path();
                hole.moveTo(-sw, -sh); hole.lineTo(-sw, sh); hole.lineTo(sw, sh);
                hole.lineTo(sw, -sh); hole.lineTo(-sw, -sh);
                frameShape.holes.push(hole);
                const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.0075, bevelEnabled: false });
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3530 });
                const frame = new THREE.Mesh(frameGeo, frameMat);
                frame.position.set(0, 0.13, -0.10375);
                sightGroup.add(frame);
                const glassShape = new THREE.Shape();
                glassShape.moveTo(-sw, -sh); glassShape.lineTo(sw, -sh);
                glassShape.lineTo(sw, sh); glassShape.lineTo(-sw, sh);
                glassShape.lineTo(-sw, -sh);
                const glassGeo = new THREE.ShapeGeometry(glassShape);
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x9955ff, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.5, side: THREE.DoubleSide });
                const glass = new THREE.Mesh(glassGeo, glassMat);
                glass.position.set(0, 0.13, -0.1);
                sightGroup.add(glass);
                const dotGeo = new THREE.CircleGeometry(0.0015, 8);
                const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
                const dot = new THREE.Mesh(dotGeo, dotMat);
                dot.position.set(0, 0.13, -0.099);
                sightGroup.add(dot);
                sightGroup.scale.set(1.2, 1.2, 1.2);
                playerState.viewModel.add(sightGroup);
            } else if (scopeId === 'holo') {
                // Holographic sight — square window with thin frame (reticle shown via HTML overlay when ADS)
                const holoGroup = new THREE.Group();
                const baseGeo = new THREE.BoxGeometry(0.09, 0.03, 0.13);
                const baseMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
                const base = new THREE.Mesh(baseGeo, baseMat);
                base.position.set(0, 0.077, -0.1);
                holoGroup.add(base);
                // Square window frame (thin border)
                const fw = 0.05, fh = 0.04, ft = 0.0012;
                const frameShape = new THREE.Shape();
                frameShape.moveTo(-fw - ft, -fh - ft); frameShape.lineTo(fw + ft, -fh - ft);
                frameShape.lineTo(fw + ft, fh + ft); frameShape.lineTo(-fw - ft, fh + ft);
                frameShape.lineTo(-fw - ft, -fh - ft);
                const hole = new THREE.Path();
                hole.moveTo(-fw, -fh); hole.lineTo(-fw, fh); hole.lineTo(fw, fh);
                hole.lineTo(fw, -fh); hole.lineTo(-fw, -fh);
                frameShape.holes.push(hole);
                const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.006, bevelEnabled: false });
                const frameMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a });
                const frame = new THREE.Mesh(frameGeo, frameMat);
                frame.position.set(0, 0.13, -0.103);
                holoGroup.add(frame);
                // Glass
                const glassGeo = new THREE.PlaneGeometry(0.1, 0.08);
                const glassMat = new THREE.MeshStandardMaterial({ color: 0x00ff66, transparent: true, opacity: 0.10, side: THREE.DoubleSide });
                const glass = new THREE.Mesh(glassGeo, glassMat);
                glass.position.set(0, 0.13, -0.1);
                holoGroup.add(glass);
                holoGroup.scale.set(1.1, 1.1, 1.1);
                playerState.viewModel.add(holoGroup);
            } else {
                // Magnified scopes (2x/3x/4x/5x/8x) — slim cylindrical scope
                const scopeDef = SCOPE_TYPES[scopeId];
                const mag = scopeDef ? scopeDef.magnification : 2;
                // Slimmer tube: less screen obstruction
                const sLen = 0.18 + mag * 0.012;
                const sRad = 0.016 + mag * 0.0015;
                const scopeGroup = new THREE.Group();
                // Main tube
                const tubeGeo = new THREE.CylinderGeometry(sRad, sRad, sLen, 20);
                tubeGeo.rotateX(Math.PI / 2);
                const tubeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.6, roughness: 0.3 });
                const tube = new THREE.Mesh(tubeGeo, tubeMat);
                tube.position.set(0, 0.09, -0.1);
                scopeGroup.add(tube);
                // Front lens (objective)
                const frontLensGeo = new THREE.CircleGeometry(sRad * 0.85, 20);
                const lensMat = new THREE.MeshStandardMaterial({ color: 0x334466, transparent: true, opacity: 0.4, metalness: 0.8, roughness: 0.1, side: THREE.DoubleSide });
                const frontLens = new THREE.Mesh(frontLensGeo, lensMat);
                frontLens.position.set(0, 0.09, -0.1 - sLen / 2);
                scopeGroup.add(frontLens);
                // Rear lens (eyepiece)
                const rearLensGeo = new THREE.CircleGeometry(sRad * 0.7, 20);
                const rearLens = new THREE.Mesh(rearLensGeo, lensMat.clone());
                rearLens.position.set(0, 0.09, -0.1 + sLen / 2);
                scopeGroup.add(rearLens);
                // Mount base (slimmed to match tube)
                const mountGeo = new THREE.BoxGeometry(0.04, 0.02, 0.06);
                const mountMat = new THREE.MeshStandardMaterial({ color: 0x222222 });
                const mount = new THREE.Mesh(mountGeo, mountMat);
                mount.position.set(0, 0.065, -0.1);
                scopeGroup.add(mount);
                playerState.viewModel.add(scopeGroup);
            }
        }
    }
    
    if (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade') {
        playerState.viewModel.position.set(0.35, -0.25, -0.5); 
        playerState.viewModel.scale.set(1.69, 1.69, 1.69);
        playerState.viewModel.rotateY(-Math.PI / 8);
    } else {
        playerState.viewModel.position.set(0.3, -0.3, -0.5);
        playerState.viewModel.scale.set(1, 1, 1);
    }
    playerState.viewModel.traverse((child) => {
        if (child.isMesh) {
            child.material.depthTest = false;
            child.renderOrder = 999;
        }
    });
    camera.add(playerState.viewModel);
    scene.add(camera);
}

function updateViewModel() {
    buildViewModel();
}

// #endregion
