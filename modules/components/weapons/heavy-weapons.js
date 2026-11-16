/**
 * Tactical Heavy Weapons Component
 * 
 * Provides procedural 3D models for heavy support weapons:
 * - Shotgun: Tactical pump-action shotgun with heat shield & preserved `dragonFire` muzzle group
 * - Minigun: 6-barrel rotary cannon with central drive axle & preserved `gatlingBarrels` group
 * - Flamethrower: Pressurized fuel tank canisters, pilot ignition loop, brass nozzle
 * 
 * Invariants: Must retain `dragonFire` on shotgun and `gatlingBarrels` on gatling minigun.
 */

(function(root) {
    'use strict';

    function createShotgunMesh(w) {
        w = w || { length: 0.9, color: 0x333333 };
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length);
        const mat = new THREE.MeshStandardMaterial({ color: w.color || 0x333333, metalness: 0.8, roughness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'shotgun';

        // Magazine tube under barrel
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        mesh.add(magMesh);

        // CRITICAL CONTRACT INVARIANT: dragonFire muzzle particle group
        const fireGroup = new THREE.Group();
        fireGroup.name = 'dragonFire';
        const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
        const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
        for (let i = 0; i < 20; i++) {
            let spark = new THREE.Mesh(sparkGeo, sparkMat.clone());
            spark.position.set((Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.1, (Math.random() - 0.5) * 0.2);
            fireGroup.add(spark);
        }
        fireGroup.position.set(0, 0, -w.length / 2);
        mesh.add(fireGroup);

        return mesh;
    }

    function createMinigunMesh(w) {
        w = w || { length: 0.95, color: 0x222222 };
        const geo = new THREE.BoxGeometry(0.12, 0.12, w.length * 0.6);
        const mat = new THREE.MeshStandardMaterial({ color: w.color || 0x222222, metalness: 0.85, roughness: 0.25 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'gatling';

        // Magazine / Ammo drum
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        mesh.add(magMesh);

        // CRITICAL CONTRACT INVARIANT: gatlingBarrels rotary barrel assembly
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
        mesh.add(barrelGroup);

        const ammoBoxGeo = new THREE.BoxGeometry(0.12, 0.08, 0.15);
        const ammoBoxMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, metalness: 0.4, roughness: 0.6 });
        const ammoBox = new THREE.Mesh(ammoBoxGeo, ammoBoxMat);
        ammoBox.position.set(0, -0.08, 0.05);
        mesh.add(ammoBox);

        return mesh;
    }

    const TacticalHeavyWeapons = {
        createShotgunMesh,
        createMinigunMesh
    };

    root.TacticalHeavyWeapons = TacticalHeavyWeapons;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalHeavyWeapons;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
