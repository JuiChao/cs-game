/**
 * Tactical AWP Precision Sniper Rifle Component
 * 
 * Provides a high-fidelity procedural 3D model for the Arctic Warfare Police (AWP):
 * - Composite olive-drab chassis with ergonomic thumbhole stock and cheek riser
 * - Heavy fluted steel barrel with massive dual-chamber muzzle brake
 * - Integrated high-power optical sniper scope with dual rail rings and adjustment turrets
 * - Distinctive bolt-action handle with spherical knob
 * - Box magazine
 * 
 * Invariant: Must retain child mesh named `magazine` with cloneable geometry and material.
 */

(function(root) {
    'use strict';

    function createAWPViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 1.15, color: 0x2e8b57 };
        const length = weaponDef.length || 1.15;

        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x3d4a3b, // Arctic / Olive Drab chassis
            roughness: 0.85,
            metalness: 0.12
        });

        const steelMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial)
            ? WeaponBase.getGunmetalMaterial({ color: 0x1f2124 })
            : new THREE.MeshStandardMaterial({ color: 0x1f2124, metalness: 0.9, roughness: 0.25 });

        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x141517, metalness: 0.85, roughness: 0.3 });

        // Base receiver mesh acts as root for viewmodel animations
        const receiverGeo = new THREE.BoxGeometry(0.088, 0.11, 0.42);
        const awpMesh = new THREE.Mesh(receiverGeo, chassisMat);
        awpMesh.name = 'awp';

        // 1. Heavy Fluted Free-Floating Barrel
        const barrelGeo = new THREE.CylinderGeometry(0.016, 0.019, 0.62, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, steelMat);
        barrel.position.set(0, 0.02, -0.48);
        awpMesh.add(barrel);

        // 2. Large Dual-Baffle Muzzle Brake
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createMuzzleDevice) {
            const brake = WeaponBase.createMuzzleDevice('dualBaffle', { material: darkMetalMat });
            brake.position.set(0, 0.02, -0.80);
            awpMesh.add(brake);
        } else {
            const brakeGeo = new THREE.BoxGeometry(0.045, 0.035, 0.09);
            const brake = new THREE.Mesh(brakeGeo, darkMetalMat);
            brake.position.set(0, 0.02, -0.80);
            awpMesh.add(brake);
        }

        // 3. Thumbhole Sniper Stock & Cheek Riser
        const stockGeo = new THREE.BoxGeometry(0.065, 0.15, 0.38);
        const stock = new THREE.Mesh(stockGeo, chassisMat);
        stock.position.set(0, -0.04, 0.36);
        awpMesh.add(stock);

        // Cheek rest
        const cheekGeo = new THREE.BoxGeometry(0.068, 0.04, 0.16);
        const cheek = new THREE.Mesh(cheekGeo, darkMetalMat);
        cheek.position.set(0, 0.055, 0.32);
        awpMesh.add(cheek);

        // Rubber buttpad
        const padGeo = new THREE.BoxGeometry(0.068, 0.155, 0.035);
        const pad = new THREE.Mesh(padGeo, darkMetalMat);
        pad.position.set(0, -0.04, 0.56);
        awpMesh.add(pad);

        // 4. Bolt Handle & Spherical Knob (Right side)
        const boltStemGeo = new THREE.CylinderGeometry(0.007, 0.007, 0.06, 8);
        boltStemGeo.rotateZ(Math.PI / 2.5);
        const boltStem = new THREE.Mesh(boltStemGeo, steelMat);
        boltStem.position.set(0.06, 0.035, 0.04);
        awpMesh.add(boltStem);

        const knobGeo = new THREE.SphereGeometry(0.014, 12, 12);
        const knob = new THREE.Mesh(knobGeo, darkMetalMat);
        knob.position.set(0.085, 0.048, 0.04);
        awpMesh.add(knob);

        // 5. Integrated High-Magnification Optical Scope
        const scopeGroup = new THREE.Group();
        scopeGroup.name = 'awpScope';

        // Main optical tube
        const tubeGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.32, 16);
        tubeGeo.rotateX(Math.PI / 2);
        const tube = new THREE.Mesh(tubeGeo, darkMetalMat);
        tube.position.set(0, 0.11, -0.06);
        scopeGroup.add(tube);

        // Objective bell
        const objBellGeo = new THREE.CylinderGeometry(0.036, 0.026, 0.08, 16);
        objBellGeo.rotateX(Math.PI / 2);
        const objBell = new THREE.Mesh(objBellGeo, darkMetalMat);
        objBell.position.set(0, 0.11, -0.23);
        scopeGroup.add(objBell);

        // Objective lens
        const lensMat = new THREE.MeshBasicMaterial({ color: 0x336699, transparent: true, opacity: 0.6 });
        const objLens = new THREE.Mesh(new THREE.CircleGeometry(0.032, 16), lensMat);
        objLens.position.set(0, 0.11, -0.27);
        scopeGroup.add(objLens);

        // Adjustment turrets (elevation & windage)
        const turretGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.018, 12);
        const elevTurret = new THREE.Mesh(turretGeo, darkMetalMat);
        elevTurret.position.set(0, 0.138, -0.06);
        scopeGroup.add(elevTurret);

        const windTurretGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.018, 12);
        windTurretGeo.rotateZ(Math.PI / 2);
        const windTurret = new THREE.Mesh(windTurretGeo, darkMetalMat);
        windTurret.position.set(0.032, 0.11, -0.06);
        scopeGroup.add(windTurret);

        // Scope mounting rings
        const ringGeo = new THREE.BoxGeometry(0.045, 0.035, 0.03);
        const ring1 = new THREE.Mesh(ringGeo, darkMetalMat);
        ring1.position.set(0, 0.08, 0.04);
        scopeGroup.add(ring1);

        const ring2 = new THREE.Mesh(ringGeo, darkMetalMat);
        ring2.position.set(0, 0.08, -0.14);
        scopeGroup.add(ring2);

        awpMesh.add(scopeGroup);

        // 6. CRITICAL CONTRACT INVARIANT: Box Magazine
        // Must be a THREE.Mesh with cloneable geometry & material
        const magGeo = new THREE.BoxGeometry(0.065, 0.18, 0.11);
        const magMat = new THREE.MeshStandardMaterial({
            color: 0x1c1e21,
            metalness: 0.8,
            roughness: 0.3
        });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.12, -0.03);
        awpMesh.add(magMesh);

        return awpMesh;
    }

    const AWPComponent = {
        createAWPViewModel
    };

    root.AWPComponent = AWPComponent;
    root.createAWPViewModel = createAWPViewModel;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AWPComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
