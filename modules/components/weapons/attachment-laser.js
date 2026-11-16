/**
 * Tactical Laser Sight Component (PEQ-15 / DBAL Style Module)
 * 
 * Generates an authentic tactical rail-mounted laser aiming module.
 * Strictly adheres to node naming and depthTest rendering contracts:
 * - Root group: `laserSight`
 * - Box module: `laserSightModule` (depthTest: false for first-person HUD priority)
 * - Laser beam: `laserBeam` (depthTest: true for realistic environment occlusion)
 * - Laser dot:  `laserDot`  (depthTest: true)
 */

(function(root) {
    'use strict';

    function createLaserSightModule(weaponLength) {
        weaponLength = weaponLength || 0.8;
        const laserGroup = new THREE.Group();
        laserGroup.name = 'laserSight';

        const mZ = -weaponLength * 0.25;

        // 1. Tactical Box Module (mounted on right rail of gun)
        const boxGeo = new THREE.BoxGeometry(0.025, 0.025, 0.08);
        const boxMat = new THREE.MeshStandardMaterial({
            color: 0x1f1f1f,
            metalness: 0.8,
            roughness: 0.2,
            depthTest: false // Contract invariant: first-person overlay visibility
        });
        const boxMesh = new THREE.Mesh(boxGeo, boxMat);
        boxMesh.name = 'laserSightModule';
        boxMesh.position.set(0.065, -0.015, mZ);
        laserGroup.add(boxMesh);

        // 2. Front Lens / Emitter Bezel Ring
        const emitterGeo = new THREE.CylinderGeometry(0.006, 0.007, 0.015, 8);
        emitterGeo.rotateX(Math.PI / 2);
        const emitterMat = new THREE.MeshStandardMaterial({
            color: 0x050505,
            metalness: 0.9,
            roughness: 0.1,
            depthTest: false
        });
        const emitterMesh = new THREE.Mesh(emitterGeo, emitterMat);
        emitterMesh.position.set(0.065, -0.015, mZ - 0.045);
        laserGroup.add(emitterMesh);

        // 3. Glowing Red Diode / Emitter Dot
        const diodeGeo = new THREE.CircleGeometry(0.004, 8);
        const diodeMat = new THREE.MeshBasicMaterial({
            color: 0xff0000,
            side: THREE.DoubleSide,
            depthTest: false
        });
        const diodeMesh = new THREE.Mesh(diodeGeo, diodeMat);
        diodeMesh.position.set(0.065, -0.015, mZ - 0.053);
        laserGroup.add(diodeMesh);

        // 4. Visible Red Laser Beam (projecting forward)
        const beamLength = 40;
        const beamGeo = new THREE.CylinderGeometry(0.0012, 0.002, beamLength, 6);
        beamGeo.rotateX(Math.PI / 2);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0xff0022,
            transparent: true,
            opacity: 0.45,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            depthTest: true // Contract invariant: scene occlusion
        });
        const beamMesh = new THREE.Mesh(beamGeo, beamMat);
        beamMesh.name = 'laserBeam';
        beamMesh.position.set(0.065, -0.015, mZ - 0.053 - beamLength / 2);
        laserGroup.add(beamMesh);

        // 5. Laser Dot at distance
        const dotGeo = new THREE.SphereGeometry(0.015, 8, 8);
        const dotMat = new THREE.MeshBasicMaterial({
            color: 0xff1133,
            depthTest: true // Contract invariant: scene occlusion
        });
        const dotMesh = new THREE.Mesh(dotGeo, dotMat);
        dotMesh.name = 'laserDot';
        dotMesh.position.set(0.065, -0.015, mZ - 0.053 - beamLength);
        laserGroup.add(dotMesh);

        return laserGroup;
    }

    const TacticalLaserComponent = {
        createLaserSightModule
    };

    root.TacticalLaserComponent = TacticalLaserComponent;
    root.createLaserSightModule = createLaserSightModule;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalLaserComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
