/**
 * Tactical M4A4 Carbine Component
 * 
 * Provides a high-fidelity procedural 3D model for the M4A4 / CQBR carbine:
 * - Upper and lower receiver with shell deflector and forward assist
 * - Quad-rail handguard with transverse Picatinny rail slots
 * - Telescoping Crane stock on cylindrical buffer tube
 * - Birdcage flash hider
 * - NATO STANAG 5.56 magazine
 * 
 * Invariant: Must retain child mesh named `magazine` with cloneable geometry and material.
 */

(function(root) {
    'use strict';

    function createM4A4ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.82, color: 0x4a4a4a };
        const length = weaponDef.length || 0.82;

        const darkMetalMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial)
            ? WeaponBase.getGunmetalMaterial({ color: 0x1e2022 })
            : new THREE.MeshStandardMaterial({ color: 0x1e2022, metalness: 0.88, roughness: 0.28 });

        const polymerMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getPolymerMaterial)
            ? WeaponBase.getPolymerMaterial(0x181818)
            : new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.8, metalness: 0.15 });

        // Base receiver mesh acts as root for viewmodel animations
        const receiverGeo = new THREE.BoxGeometry(0.085, 0.11, 0.34);
        const m4Mesh = new THREE.Mesh(receiverGeo, darkMetalMat);
        m4Mesh.name = 'm4a4';

        // 1. Upper Flattop Picatinny Rail
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyRail) {
            const topRail = WeaponBase.createPicatinnyRail(0.26, { material: darkMetalMat });
            topRail.position.set(0, 0.058, -0.04);
            m4Mesh.add(topRail);
        } else {
            const railGeo = new THREE.BoxGeometry(0.024, 0.012, 0.26);
            const rail = new THREE.Mesh(railGeo, darkMetalMat);
            rail.position.set(0, 0.06, -0.04);
            m4Mesh.add(rail);
        }

        // 2. Brass Deflector & Forward Assist (Right side)
        const deflectorGeo = new THREE.BoxGeometry(0.02, 0.025, 0.035);
        const deflector = new THREE.Mesh(deflectorGeo, darkMetalMat);
        deflector.position.set(0.048, 0.025, 0.04);
        m4Mesh.add(deflector);

        const assistGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.035, 8);
        assistGeo.rotateZ(Math.PI / 3);
        const assist = new THREE.Mesh(assistGeo, darkMetalMat);
        assist.position.set(0.05, 0.035, 0.08);
        m4Mesh.add(assist);

        // 3. Quad-Rail Handguard
        const handguardGeo = new THREE.BoxGeometry(0.078, 0.082, 0.24);
        const handguard = new THREE.Mesh(handguardGeo, polymerMat);
        handguard.position.set(0, 0.015, -0.25);
        m4Mesh.add(handguard);

        // Barrel extending from handguard
        const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.38, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, darkMetalMat);
        barrel.position.set(0, 0.015, -0.38);
        m4Mesh.add(barrel);

        // 4. A2 Birdcage Flash Hider
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createMuzzleDevice) {
            const hider = WeaponBase.createMuzzleDevice('birdcage', { material: darkMetalMat });
            hider.position.set(0, 0.015, -0.58);
            m4Mesh.add(hider);
        } else {
            const hiderGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.06, 8);
            hiderGeo.rotateX(Math.PI / 2);
            const hider = new THREE.Mesh(hiderGeo, darkMetalMat);
            hider.position.set(0, 0.015, -0.58);
            m4Mesh.add(hider);
        }

        // 5. Buffer Tube & Telescoping Crane Stock
        const bufferGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.22, 12);
        bufferGeo.rotateX(Math.PI / 2);
        const buffer = new THREE.Mesh(bufferGeo, darkMetalMat);
        buffer.position.set(0, 0.01, 0.24);
        m4Mesh.add(buffer);

        const stockGeo = new THREE.BoxGeometry(0.06, 0.12, 0.22);
        const stock = new THREE.Mesh(stockGeo, polymerMat);
        stock.position.set(0, -0.02, 0.30);
        m4Mesh.add(stock);

        // 6. Ergonomic A2 Pistol Grip
        const gripGeo = new THREE.BoxGeometry(0.048, 0.12, 0.06);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.position.set(0, -0.11, 0.11);
        grip.rotation.x = -0.32;
        m4Mesh.add(grip);

        // 7. CRITICAL CONTRACT INVARIANT: Magazine (STANAG 30-round magazine)
        // Must be a THREE.Mesh with cloneable geometry & material
        const magGeo = new THREE.BoxGeometry(0.055, 0.22, 0.095);
        const magMat = new THREE.MeshStandardMaterial({
            color: 0x282a2d,
            metalness: 0.75,
            roughness: 0.35
        });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.13, -0.05);
        magMesh.rotation.x = 0.12; // Slight forward cant
        m4Mesh.add(magMesh);

        return m4Mesh;
    }

    const M4A4Component = {
        createM4A4ViewModel
    };

    root.M4A4Component = M4A4Component;
    root.createM4A4ViewModel = createM4A4ViewModel;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = M4A4Component;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
