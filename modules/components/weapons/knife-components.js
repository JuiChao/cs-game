/**
 * Tactical Knife & Melee Weapons Component
 * 
 * Provides high-fidelity procedural 3D models for all melee weapons:
 * - Karambit: Curved talon blade with crimson web finish, index finger retention ring
 * - Kukri: Forward-recurve Nepalese blade, brass bolster, pommel cap
 * - Switchblade: Italian stiletto spear-point blade with textured grip
 * - Zombie Claw: Infected mutated hand with elongated curved claws
 */

(function(root) {
    'use strict';

    function createKarambit() {
        const group = new THREE.Group();
        group.name = 'karambit';
        
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
        group.name = 'kukri';
        
        // Materials
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.3, roughness: 0.7 }); // Crimson Red
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 1.0, roughness: 0.3 }); // Gold
        const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 }); // Silver
        const damascusMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.4 }); // Dark steel
        
        // Curved Handle
        const handleGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 16);
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.rotation.z = -0.1;
        group.add(handle);
        
        // Gold Bolster
        const bolsterGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.04, 16);
        const bolster = new THREE.Mesh(bolsterGeo, goldMat);
        bolster.rotation.x = Math.PI / 2;
        bolster.position.set(-0.005, 0, -0.07);
        group.add(bolster);
        
        // Pommel
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
        
        // Recurve Blade
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0);
        bladeShape.lineTo(0.005, 0.08);
        bladeShape.quadraticCurveTo(0.03, 0.18, 0.045, 0.28);
        bladeShape.quadraticCurveTo(0.035, 0.38, 0.01, 0.45);
        bladeShape.lineTo(-0.02, 0.42);
        bladeShape.quadraticCurveTo(-0.03, 0.25, -0.015, 0.12);
        bladeShape.lineTo(-0.01, 0);
        bladeShape.closePath();
        
        const extrudeSettings = { depth: 0.006, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.002, bevelThickness: 0.002 };
        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
        bladeGeo.translate(0, 0, -0.003);
        const blade = new THREE.Mesh(bladeGeo, silverMat);
        blade.position.set(-0.008, 0, -0.09);
        blade.rotation.x = Math.PI / 2;
        blade.rotation.y = Math.PI;
        group.add(blade);

        group.rotation.y = Math.PI / 3.5;
        group.rotation.x = -Math.PI / 10;
        group.rotation.z = Math.PI / 6;

        return group;
    }

    function createSwitchblade() {
        const group = new THREE.Group();
        group.name = 'switchblade';

        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.3, roughness: 0.8 });
        const steelMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.15 });

        // Handle
        const handleGeo = new THREE.BoxGeometry(0.025, 0.015, 0.14);
        const handle = new THREE.Mesh(handleGeo, bodyMat);
        group.add(handle);

        // Blade
        const bladeGeo = new THREE.BoxGeometry(0.018, 0.003, 0.12);
        const blade = new THREE.Mesh(bladeGeo, steelMat);
        blade.position.set(0, 0, -0.12);
        group.add(blade);

        group.rotation.y = Math.PI / 4;
        group.rotation.x = -Math.PI / 12;

        return group;
    }

    function createZombieClaw() {
        const group = new THREE.Group();
        group.name = 'zombieClaw';

        const fleshMat = new THREE.MeshStandardMaterial({ color: 0x2e4d2e, roughness: 0.9, metalness: 0.1 });
        const boneMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.5 });

        // Palm / Hand
        const handGeo = new THREE.BoxGeometry(0.08, 0.05, 0.12);
        const hand = new THREE.Mesh(handGeo, fleshMat);
        group.add(hand);

        // 4 Claws
        for (let i = 0; i < 4; i++) {
            const clawGeo = new THREE.ConeGeometry(0.012, 0.08, 8);
            clawGeo.rotateX(-Math.PI / 2);
            const claw = new THREE.Mesh(clawGeo, boneMat);
            claw.position.set(-0.03 + i * 0.02, 0.01, -0.1);
            group.add(claw);
        }

        group.rotation.y = Math.PI / 5;
        group.rotation.x = -Math.PI / 10;

        return group;
    }

    const TacticalKnifeComponent = {
        createKarambit,
        createKukri,
        createSwitchblade,
        createZombieClaw
    };

    root.TacticalKnifeComponent = TacticalKnifeComponent;
    root.createKarambit = root.createKarambit || createKarambit;
    root.createKukri = root.createKukri || createKukri;
    root.createSwitchblade = root.createSwitchblade || createSwitchblade;
    root.createZombieClaw = root.createZombieClaw || createZombieClaw;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalKnifeComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
