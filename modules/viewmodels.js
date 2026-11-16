// #region 武器视图模型
function createC4() {
    if (typeof TacticalC4Component !== 'undefined' && typeof TacticalC4Component.createC4 === 'function') {
        return TacticalC4Component.createC4();
    }
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

function createZombieClaw() {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.95 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d4a1d, roughness: 0.85 });
    const nailMat = new THREE.MeshStandardMaterial({ color: 0xd8e8c0, roughness: 0.35, metalness: 0.1 });

    // 手掌
    const palmGeo = new THREE.BoxGeometry(0.09, 0.035, 0.11);
    const palm = new THREE.Mesh(palmGeo, skinMat);
    group.add(palm);

    // 三根利爪（中指最长），尖端朝 -Z
    const clawLengths = [0.15, 0.22, 0.15];
    const clawX = [-0.03, 0, 0.03];
    for (let i = 0; i < 3; i++) {
        const clawGeo = new THREE.ConeGeometry(0.008, clawLengths[i], 6);
        clawGeo.rotateX(-Math.PI / 2);
        clawGeo.translate(0, 0, -clawLengths[i] / 2);
        const claw = new THREE.Mesh(clawGeo, nailMat);
        claw.position.set(clawX[i], 0.006, -0.055);
        claw.rotation.x = -0.1;
        group.add(claw);
    }

    // 腐烂前臂
    const armGeo = new THREE.CylinderGeometry(0.028, 0.036, 0.16, 10);
    armGeo.rotateX(Math.PI / 2);
    const arm = new THREE.Mesh(armGeo, darkMat);
    arm.position.set(0, -0.006, 0.11);
    group.add(arm);

    // 前臂腐斑
    for (let i = 0; i < 4; i++) {
        const spotGeo = new THREE.SphereGeometry(0.012, 6, 6);
        const spot = new THREE.Mesh(spotGeo, nailMat);
        const a = Math.random() * Math.PI * 2;
        spot.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.05 + Math.random() * 0.1);
        group.add(spot);
    }

    return group;
}

const TEXTURE_PROPERTIES_TO_DISPOSE = [
    'map', 'alphaMap', 'aoMap', 'bumpMap', 'displacementMap',
    'emissiveMap', 'envMap', 'lightMap', 'metalnessMap',
    'normalMap', 'roughnessMap', 'specularMap'
];

function disposeMaterialInstance(m) {
    if (!m) return;
    for (let i = 0; i < TEXTURE_PROPERTIES_TO_DISPOSE.length; i++) {
        const prop = TEXTURE_PROPERTIES_TO_DISPOSE[i];
        if (m[prop] && typeof m[prop].dispose === 'function') {
            m[prop].dispose();
        }
    }
    if (typeof m.dispose === 'function') {
        m.dispose();
    }
}

function disposeHierarchy(obj) {
    if (!obj) return;
    obj.traverse(child => {
        if (child.isMesh || child.isPoints || child.isLine || child.isSprite) {
            if (child.geometry && typeof child.geometry.dispose === 'function') {
                child.geometry.dispose();
            }
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(disposeMaterialInstance);
                } else {
                    disposeMaterialInstance(child.material);
                }
            }
        }
    });
    while (obj.children && obj.children.length > 0) {
        obj.remove(obj.children[0]);
    }
}
if (typeof window !== 'undefined') {
    window.disposeHierarchy = disposeHierarchy;
}

function buildViewModel() {
    if (playerState.viewModel) {
        camera.remove(playerState.viewModel);
        disposeHierarchy(playerState.viewModel);
        playerState.viewModel = null;
        const oldHitBox = camera.getObjectByName('knifeHitBox');
        if (oldHitBox) {
            oldHitBox.geometry.dispose();
            oldHitBox.material.dispose();
            camera.remove(oldHitBox);
        }
    }
    
    const w = getCurrentWeapon();
    
    // ── STEP 1: Build Base Weapon Mesh ──
    if (w.id === 'knife') {
        playerState.viewModel = (typeof TacticalKnifeComponent !== 'undefined' && TacticalKnifeComponent.createKarambit)
            ? TacticalKnifeComponent.createKarambit()
            : createKarambit();
    } else if (w.id === 'kukri') {
        playerState.viewModel = (typeof TacticalKnifeComponent !== 'undefined' && TacticalKnifeComponent.createKukri)
            ? TacticalKnifeComponent.createKukri()
            : createKukri();
    } else if (w.id === 'switchblade') {
        playerState.viewModel = (typeof TacticalKnifeComponent !== 'undefined' && TacticalKnifeComponent.createSwitchblade)
            ? TacticalKnifeComponent.createSwitchblade()
            : createSwitchblade();
    } else if (w.id === 'zombieClaw') {
        playerState.viewModel = (typeof TacticalKnifeComponent !== 'undefined' && TacticalKnifeComponent.createZombieClaw)
            ? TacticalKnifeComponent.createZombieClaw()
            : createZombieClaw();
    } else if ((w.id === 'rifle' || w.id === 'ak47') && typeof AK47Component !== 'undefined' && AK47Component.createAK47ViewModel) {
        playerState.viewModel = AK47Component.createAK47ViewModel(w);
    } else if ((w.id === 'm4a4' || w.id === 'm4') && typeof M4A4Component !== 'undefined' && M4A4Component.createM4A4ViewModel) {
        playerState.viewModel = M4A4Component.createM4A4ViewModel(w);
    } else if ((w.id === 'sniper' || w.id === 'awp') && typeof AWPComponent !== 'undefined' && AWPComponent.createAWPViewModel) {
        playerState.viewModel = AWPComponent.createAWPViewModel(w);
    } else if (w.id === 'shotgun' && typeof TacticalHeavyWeapons !== 'undefined' && TacticalHeavyWeapons.createShotgunMesh) {
        playerState.viewModel = TacticalHeavyWeapons.createShotgunMesh(w);
    } else if (w.id === 'gatling' && typeof TacticalHeavyWeapons !== 'undefined' && TacticalHeavyWeapons.createMinigunMesh) {
        playerState.viewModel = TacticalHeavyWeapons.createMinigunMesh(w);
    } else if (w.id === 'flamethrower' && typeof TacticalHeavyWeapons !== 'undefined' && TacticalHeavyWeapons.createFlamethrowerMesh) {
        playerState.viewModel = TacticalHeavyWeapons.createFlamethrowerMesh(w);
    } else if (w.id === 'mortar' && typeof TacticalHeavyWeapons !== 'undefined' && TacticalHeavyWeapons.createMortarMesh) {
        playerState.viewModel = TacticalHeavyWeapons.createMortarMesh(w);
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
    }

    const isMelee = (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'zombieClaw');
    const isThrowableOrSpecial = ['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone', 'mortar', 'c4', 'cryo'].includes(w.id);

    // ── STEP 2: Attach Optics (Firearms) ──
    if (!isMelee && !isThrowableOrSpecial) {
        const scopeId = playerState.currentScope || 'redDot';
        if (typeof TacticalOpticComponent !== 'undefined' && typeof TacticalOpticComponent.createScopeMesh === 'function') {
            const scopeMesh = TacticalOpticComponent.createScopeMesh(scopeId, w);
            if (scopeMesh) playerState.viewModel.add(scopeMesh);
        }
    }

    // ── STEP 3: Attach Laser Sight (Firearms) ──
    const hasLaser = Boolean(playerState.hasLaserSight || (typeof laserSightPurchased !== 'undefined' && laserSightPurchased));
    if (hasLaser && !isMelee && !isThrowableOrSpecial) {
        if (typeof TacticalLaserComponent !== 'undefined' && typeof TacticalLaserComponent.createLaserSightModule === 'function') {
            const laserGroup = TacticalLaserComponent.createLaserSightModule(w.length);
            playerState.viewModel.add(laserGroup);
        }
    }
    
    if (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'zombieClaw') {
        playerState.viewModel.position.set(0.35, -0.25, -0.5); 
        playerState.viewModel.scale.set(1.69, 1.69, 1.69);
        playerState.viewModel.rotateY(-Math.PI / 8);
    } else {
        playerState.viewModel.position.set(0.3, -0.3, -0.5);
        playerState.viewModel.scale.set(1, 1, 1);
    }
    playerState.viewModel.traverse((child) => {
        if (child.isMesh) {
            const isLaserBeamOrDot = (child.name === 'laserBeam' || child.name === 'laserDot');
            if (Array.isArray(child.material)) {
                child.material.forEach(m => { if (m) m.depthTest = isLaserBeamOrDot; });
            } else if (child.material) {
                child.material.depthTest = isLaserBeamOrDot;
            }
            child.renderOrder = isLaserBeamOrDot ? 500 : 999;
        }
    });
    camera.add(playerState.viewModel);
    scene.add(camera);
}

function updateViewModel() {
    buildViewModel();
}

// #endregion
