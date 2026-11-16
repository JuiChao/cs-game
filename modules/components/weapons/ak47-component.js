/**
 * Tactical AK-47 Assault Rifle Component
 * 
 * Provides a high-fidelity procedural 3D model for the Avtomat Kalashnikova (AK-47):
 * - Stamped steel receiver with bolt carrier charging handle
 * - Ribbed stamped receiver dust cover
 * - Slanted muzzle compensator
 * - Walnut wood handguard, gas tube, buttstock, and pistol grip
 * - Curved 30-round banana magazine
 * 
 * Invariant: Must retain child mesh named `magazine` with cloneable geometry and material.
 */

(function(root) {
    'use strict';

    function createAK47ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.88, color: 0x8B4513 };
        const length = weaponDef.length || 0.88;

        // Base receiver mesh acts as the root weapon mesh for compatibility with animations
        const receiverGeo = new THREE.BoxGeometry(0.09, 0.11, 0.38);
        const steelMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial) 
            ? WeaponBase.getGunmetalMaterial({ color: 0x222326 }) 
            : new THREE.MeshStandardMaterial({ color: 0x222326, metalness: 0.85, roughness: 0.3 });
        
        const akMesh = new THREE.Mesh(receiverGeo, steelMat);
        akMesh.name = 'ak47';

        const woodMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getWalnutMaterial)
            ? WeaponBase.getWalnutMaterial()
            : new THREE.MeshStandardMaterial({ color: 0x5a2d0c, roughness: 0.75, metalness: 0.08 });

        const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x18181a, metalness: 0.9, roughness: 0.25 });

        // 1. Ribbed Dust Cover (Upper curved receiver)
        const coverGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.36, 12, 1, false, 0, Math.PI);
        coverGeo.rotateX(Math.PI / 2);
        coverGeo.rotateZ(Math.PI / 2);
        const cover = new THREE.Mesh(coverGeo, steelMat);
        cover.position.set(0, 0.055, -0.01);
        akMesh.add(cover);

        // 2. Bolt Carrier Charging Handle (Right side)
        const handleGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.045, 8);
        handleGeo.rotateZ(Math.PI / 2);
        const handle = new THREE.Mesh(handleGeo, darkMetalMat);
        handle.position.set(0.055, 0.02, 0.05);
        akMesh.add(handle);

        // 3. Barrel & Gas Block
        const barrelGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.44, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, steelMat);
        barrel.position.set(0, 0.01, -0.38);
        akMesh.add(barrel);

        // Gas tube (Above barrel)
        const gasTubeGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.24, 12);
        gasTubeGeo.rotateX(Math.PI / 2);
        const gasTube = new THREE.Mesh(gasTubeGeo, darkMetalMat);
        gasTube.position.set(0, 0.042, -0.26);
        akMesh.add(gasTube);

        // 4. Wood Handguard & Forend (Surrounds gas tube and barrel)
        const handguardGeo = new THREE.BoxGeometry(0.075, 0.085, 0.22);
        const handguard = new THREE.Mesh(handguardGeo, woodMat);
        handguard.position.set(0, 0.02, -0.25);
        akMesh.add(handguard);

        // 5. Wood Buttstock
        const stockGeo = new THREE.BoxGeometry(0.065, 0.13, 0.28);
        const stock = new THREE.Mesh(stockGeo, woodMat);
        stock.position.set(0, -0.03, 0.32);
        stock.rotation.x = -0.05;
        akMesh.add(stock);

        // Buttplate
        const buttPlateGeo = new THREE.BoxGeometry(0.068, 0.135, 0.02);
        const buttPlate = new THREE.Mesh(buttPlateGeo, darkMetalMat);
        buttPlate.position.set(0, -0.03, 0.46);
        akMesh.add(buttPlate);

        // 6. Wood Pistol Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.13, 0.065);
        const grip = new THREE.Mesh(gripGeo, woodMat);
        grip.position.set(0, -0.11, 0.13);
        grip.rotation.x = -0.35;
        akMesh.add(grip);

        // 7. Slanted Muzzle Brake
        const muzzleGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.06, 12);
        muzzleGeo.rotateX(Math.PI / 2);
        const muzzle = new THREE.Mesh(muzzleGeo, darkMetalMat);
        muzzle.position.set(0, 0.01, -0.61);
        muzzle.rotation.z = Math.PI / 4;
        akMesh.add(muzzle);

        // 8. Front Sight Post Tower with protective hood
        const sightTowerGeo = new THREE.BoxGeometry(0.025, 0.06, 0.025);
        const sightTower = new THREE.Mesh(sightTowerGeo, darkMetalMat);
        sightTower.position.set(0, 0.045, -0.56);
        akMesh.add(sightTower);

        // Cleaning rod under barrel
        const rodGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.38, 6);
        rodGeo.rotateX(Math.PI / 2);
        const rod = new THREE.Mesh(rodGeo, darkMetalMat);
        rod.position.set(0, -0.015, -0.36);
        akMesh.add(rod);

        // 9. CRITICAL CONTRACT INVARIANT: Magazine (Curved 30-round banana magazine)
        // Must be a THREE.Mesh with cloneable geometry & material
        const magGeo = new THREE.BoxGeometry(0.065, 0.24, 0.11);
        const magMat = new THREE.MeshStandardMaterial({
            color: 0x1a1a1c,
            metalness: 0.8,
            roughness: 0.35
        });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.14, -0.06);
        magMesh.rotation.x = 0.22; // Forward banana curve angle
        akMesh.add(magMesh);

        return akMesh;
    }

    const AK47Component = {
        createAK47ViewModel
    };

    root.AK47Component = AK47Component;
    root.createAK47ViewModel = createAK47ViewModel;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AK47Component;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
