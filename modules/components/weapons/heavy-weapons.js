/**
 * Tactical Heavy Weapons Component
 * 
 * Provides procedural 3D models for heavy support weapons:
 * - Shotgun: Tactical pump-action shotgun with heat shield & preserved `dragonFire` muzzle group
 * - Minigun: 6-barrel rotary cannon with central drive axle & preserved `gatlingBarrels` group
 * - Flamethrower: Pressurized fuel tank canisters, pilot nozzle, brass ring & `flamethrowerBody` group
 * - Mortar: Tactical deployable mortar tube, baseplate, bipod legs & `mortarBody` group
 * 
 * Invariants:
 * - Must retain direct child `magazine` (`THREE.Mesh`) on all heavy firearms for reload physics
 * - Must retain `dragonFire` group with 20 spark meshes on shotgun
 * - Must retain `gatlingBarrels` group on gatling minigun for rotary spin
 * - Must retain `flamethrowerBody` on flamethrower
 * - Must retain `mortarBody` on mortar
 */

(function(root) {
    'use strict';

    function createShotgunMesh(w) {
        w = w || { length: 0.9, color: 0x333333 };
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length);
        const mat = new THREE.MeshStandardMaterial({ color: w.color || 0x333333, metalness: 0.8, roughness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'shotgun';

        // Magazine tube under barrel (CONTRACT INVARIANT: THREE.Mesh named 'magazine')
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

        // Magazine / Ammo drum (CONTRACT INVARIANT: THREE.Mesh named 'magazine')
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

    function createFlamethrowerMesh(w) {
        w = w || { length: 0.85, color: 0x8B0000 };
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length * 0.7);
        const mat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'flamethrower';

        // Fuel Tank / Magazine (CONTRACT INVARIANT: THREE.Mesh named 'magazine')
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        mesh.add(magMesh);

        // Flamethrower Body Group
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

        mesh.add(ftGroup);
        return mesh;
    }

    function createMortarMesh(w) {
        w = w || { length: 0.7, color: 0x4a5a2a };
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length * 0.5);
        const mat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.name = 'mortar';

        // Shell / Magazine (CONTRACT INVARIANT: THREE.Mesh named 'magazine')
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        mesh.add(magMesh);

        // Mortar Body Group
        const mortarGroup = new THREE.Group();
        mortarGroup.name = 'mortarBody';

        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, metalness: 0.5, roughness: 0.5 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, metalness: 0.6, roughness: 0.4 });

        const tubeGeo = new THREE.CylinderGeometry(0.08, 0.09, 0.5, 16);
        tubeGeo.rotateX(Math.PI / 2);
        const tube = new THREE.Mesh(tubeGeo, bodyMat);
        tube.position.set(0, 0, -0.1);
        mortarGroup.add(tube);

        const muzzleGeo = new THREE.TorusGeometry(0.08, 0.015, 8, 16);
        const muzzle = new THREE.Mesh(muzzleGeo, darkMat);
        muzzle.position.set(0, 0, -0.35);
        mortarGroup.add(muzzle);

        const baseGeo = new THREE.BoxGeometry(0.25, 0.05, 0.15);
        const base = new THREE.Mesh(baseGeo, darkMat);
        base.position.set(0, -0.12, 0.05);
        mortarGroup.add(base);

        const bipodGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.15, 6);
        const bipodMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.7, roughness: 0.3 });
        const bipodL = new THREE.Mesh(bipodGeo, bipodMat);
        bipodL.position.set(-0.08, -0.08, -0.15);
        bipodL.rotation.z = 0.3;
        mortarGroup.add(bipodL);
        const bipodR = new THREE.Mesh(bipodGeo, bipodMat);
        bipodR.position.set(0.08, -0.08, -0.15);
        bipodR.rotation.z = -0.3;
        mortarGroup.add(bipodR);

        const sightGeo = new THREE.BoxGeometry(0.04, 0.05, 0.02);
        const sight = new THREE.Mesh(sightGeo, darkMat);
        sight.position.set(0, 0.08, 0);
        mortarGroup.add(sight);

        mesh.add(mortarGroup);
        return mesh;
    }

    const TacticalHeavyWeapons = {
        createShotgunMesh,
        createMinigunMesh,
        createFlamethrowerMesh,
        createMortarMesh
    };

    root.TacticalHeavyWeapons = TacticalHeavyWeapons;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalHeavyWeapons;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
