/**
 * Tactical Knife & Melee Weapons Component
 * 
 * Provides high-fidelity procedural 3D models for all melee weapons:
 * - Karambit: Curved talon blade with crimson web finish, index finger retention ring.
 *             CRITICAL CONTRACT: MUST maintain exactly 3 child geometries for test_phase3.js:140!
 * - Kukri: Forward-recurve Nepalese blade, gold bolster, Cho notch, dragon TubeGeometry spine
 * - Switchblade: Italian stiletto handle, spring release button, star cone, spear-point blade, blue inlay
 * - Zombie Claw: Mutated palm, 3 curved claws (lengths [0.15, 0.22, 0.15]), decayed forearm, pustule spheres
 */

(function(root) {
    'use strict';

    /**
     * Karambit Model
     * STRICT INVARIANT: Exactly 3 child meshes with geometries (Handle, Ring, Blade).
     */
    function createKarambit() {
        const group = new THREE.Group();
        group.name = 'karambit';
        
        // 1. Handle (Geometry 1)
        const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        group.add(handle);
        
        // 2. Retention Ring at the bottom (Geometry 2)
        const ringGeo = new THREE.TorusGeometry(0.025, 0.008, 8, 16);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.z = 0.09;
        group.add(ring);
        
        // 3. Curved Talon Blade (Geometry 3)
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

    /**
     * Kukri Model
     * Curved handle, gold bolster, pommel cap, forward-recurve blade with Cho notch,
     * golden spine, and dragon TubeGeometry spine engravings.
     */
    function createKukri() {
        const group = new THREE.Group();
        group.name = 'kukri';
        
        // Materials
        const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.3, roughness: 0.7 }); // Crimson Red
        const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 1.0, roughness: 0.3 }); // Gold
        const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 }); // Silver
        const damascusMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.4 }); // Dark steel
        
        // 1. Curved Handle
        const handleGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 16);
        const handle = new THREE.Mesh(handleGeo, handleMat);
        handle.rotation.x = Math.PI / 2;
        handle.rotation.z = -0.1;
        group.add(handle);
        
        // 2. Gold Bolster
        const bolsterGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.04, 16);
        const bolster = new THREE.Mesh(bolsterGeo, goldMat);
        bolster.rotation.x = Math.PI / 2;
        bolster.position.set(-0.005, 0, -0.07);
        group.add(bolster);
        
        // 3. Pommel & Cap
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
        
        // 4. Forward-Recurve Blade with Cho Notch
        const bladeShape = new THREE.Shape();
        bladeShape.moveTo(0, 0); 
        // Spine
        bladeShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2); // Base spine
        bladeShape.quadraticCurveTo(0.04, -0.35, 0.22, -0.50); // Forward curve to tip
        // Edge (Belly)
        bladeShape.quadraticCurveTo(0.28, -0.35, 0.12, -0.15); // Wide belly
        // Cho (Notch)
        bladeShape.lineTo(0.08, -0.08); 
        bladeShape.quadraticCurveTo(0.04, -0.06, 0.08, -0.04); // Cho notch indent
        bladeShape.lineTo(0.02, 0); // Back to handle
        
        const bladeSettings = { depth: 0.004, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.002, bevelThickness: 0.001 };
        const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, bladeSettings);
        bladeGeo.translate(-0.01, 0, -0.002);
        
        const blade = new THREE.Mesh(bladeGeo, damascusMat);
        blade.position.z = -0.08;
        blade.position.y = 0.01;
        blade.rotation.x = Math.PI / 2;
        blade.rotation.y = Math.PI; 
        group.add(blade);
        
        // 5. Golden Spine Overlay
        const spineShape = new THREE.Shape();
        spineShape.moveTo(0, 0);
        spineShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2);
        spineShape.quadraticCurveTo(0.04, -0.35, 0.20, -0.48);
        spineShape.quadraticCurveTo(0.08, -0.35, 0.04, -0.2);
        spineShape.lineTo(0.03, -0.08);
        spineShape.lineTo(0.02, 0);
        
        const spineSettings = { depth: 0.006, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
        const spineGeo = new THREE.ExtrudeGeometry(spineShape, spineSettings);
        spineGeo.translate(-0.01, 0, -0.003);
        
        const spine = new THREE.Mesh(spineGeo, goldMat);
        blade.add(spine);
        
        // 6. Dragon/Floral TubeGeometry Spine Engraving
        class DragonCurve extends THREE.Curve {
            getPoint(t, optionalTarget) {
                const target = optionalTarget || new THREE.Vector3();
                const tx = -0.01 + 0.15 * t + Math.sin(t * Math.PI * 3) * 0.01; 
                const ty = -0.05 - 0.35 * t;
                const tz = 0;
                return target.set(tx, ty, tz);
            }
        }
        const dragonGeo = new THREE.TubeGeometry(new DragonCurve(), 32, 0.003, 8, false);
        
        const dragonPattern1 = new THREE.Mesh(dragonGeo, silverMat);
        dragonPattern1.position.z = 0.004;
        spine.add(dragonPattern1);
        
        const dragonPattern2 = new THREE.Mesh(dragonGeo, silverMat);
        dragonPattern2.position.z = -0.004;
        spine.add(dragonPattern2);

        group.scale.set(2.6, 2.6, 2.6);
        group.rotation.y = Math.PI / 4;
        group.rotation.x = -Math.PI / 12;
        group.rotation.z = Math.PI / 4;

        return group;
    }

    /**
     * Switchblade Model
     * Italian stiletto handle, spring release button, star cone, spear-point blade, blue inlay.
     */
    function createSwitchblade() {
        const group = new THREE.Group();
        group.name = 'switchblade';
        
        const silverMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
        const darkSilverMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 });
        const blueMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, metalness: 0.8, roughness: 0.2, emissive: 0x0022aa });
        
        // 1. Handle Frame
        const handleGeo = new THREE.BoxGeometry(0.02, 0.015, 0.15);
        const handle = new THREE.Mesh(handleGeo, silverMat);
        handle.position.z = 0.075;
        group.add(handle);
        
        // 2. Textured Grip Panel
        const handleGripGeo = new THREE.BoxGeometry(0.018, 0.016, 0.12);
        const handleGrip = new THREE.Mesh(handleGripGeo, darkSilverMat);
        handleGrip.position.z = 0.08;
        group.add(handleGrip);
        
        // 3. Stiletto Spring Release Button
        const buttonGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.018, 8);
        const button = new THREE.Mesh(buttonGeo, blueMat);
        button.position.z = 0.04;
        button.rotation.x = Math.PI / 2;
        group.add(button);
        
        // 4. Button Star Cone
        const buttonStarGeo = new THREE.ConeGeometry(0.008, 0.005, 4);
        const buttonStar = new THREE.Mesh(buttonStarGeo, silverMat);
        buttonStar.position.set(0, 0.01, 0.04);
        group.add(buttonStar);
        
        // 5. Spear-Point Stiletto Blade
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
        
        // 6. Blue Inlay Accent Line
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

    /**
     * Zombie Claw Model
     * Mutated palm, 3 curved claws (lengths [0.15, 0.22, 0.15]), decayed forearm, pustule spheres.
     */
    function createZombieClaw() {
        const group = new THREE.Group();
        group.name = 'zombieClaw';

        const skinMat = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 0.95 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1d4a1d, roughness: 0.85 });
        const nailMat = new THREE.MeshStandardMaterial({ color: 0xd8e8c0, roughness: 0.35, metalness: 0.1 });

        // 1. Mutated Palm
        const palmGeo = new THREE.BoxGeometry(0.09, 0.035, 0.11);
        const palm = new THREE.Mesh(palmGeo, skinMat);
        group.add(palm);

        // 2. Three Curved Claws (Middle is longest: lengths [0.15, 0.22, 0.15])
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

        // 3. Decayed Forearm
        const armGeo = new THREE.CylinderGeometry(0.028, 0.036, 0.16, 10);
        armGeo.rotateX(Math.PI / 2);
        const arm = new THREE.Mesh(armGeo, darkMat);
        arm.position.set(0, -0.006, 0.11);
        group.add(arm);

        // 4. Infection Pustule Spheres
        for (let i = 0; i < 4; i++) {
            const spotGeo = new THREE.SphereGeometry(0.012, 6, 6);
            const spot = new THREE.Mesh(spotGeo, nailMat);
            const a = (i / 4) * Math.PI * 2;
            spot.position.set(Math.cos(a) * 0.03, Math.sin(a) * 0.03, 0.05 + (i * 0.025));
            group.add(spot);
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
