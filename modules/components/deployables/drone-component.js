/**
 * Tactical Drone Component
 * 
 * Procedural quadrotor surveillance and strike drone model featuring:
 * - Procedural carbon-fiber weave chassis texture
 * - 4 diagonal carbon motor arms with brushless motor pods
 * - 4 rotating aerodynamic propeller blades (CW & CCW pairs)
 * - Forward 2-axis gimbal surveillance camera with optical lens
 * - Team-specific tactical accent liveries (T: orange, CT: blue)
 */

(function(root) {
    'use strict';

    /**
     * Procedural carbon fiber twill weave texture generator
     */
    function createCarbonFiberTexture() {
        if (typeof document === 'undefined') return null;
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Dark charcoal carbon base
        ctx.fillStyle = '#15171a';
        ctx.fillRect(0, 0, size, size);

        // 2x2 Twill weave pattern
        const tileSize = 16;
        for (let y = 0; y < size; y += tileSize) {
            for (let x = 0; x < size; x += tileSize) {
                const isDiag = ((x / tileSize) + (y / tileSize)) % 2 === 0;

                // Gradient highlight simulating light reflection off carbon filaments
                const grad = ctx.createLinearGradient(x, y, x + tileSize, y + tileSize);
                if (isDiag) {
                    grad.addColorStop(0, '#2a2e33');
                    grad.addColorStop(0.5, '#1e2126');
                    grad.addColorStop(1, '#111316');
                } else {
                    grad.addColorStop(0, '#1a1c20');
                    grad.addColorStop(0.5, '#25292f');
                    grad.addColorStop(1, '#15171a');
                }

                ctx.fillStyle = grad;
                ctx.fillRect(x, y, tileSize, tileSize);

                // Filament micro-striations
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
                ctx.lineWidth = 1;
                for (let k = 2; k < tileSize; k += 3) {
                    ctx.beginPath();
                    if (isDiag) {
                        ctx.moveTo(x + k, y);
                        ctx.lineTo(x, y + k);
                    } else {
                        ctx.moveTo(x + tileSize - k, y);
                        ctx.lineTo(x + tileSize, y + k);
                    }
                    ctx.stroke();
                }
            }
        }

        const texture = new THREE.CanvasTexture(canvas);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(4, 4);
        return texture;
    }

    /**
     * Creates a high-fidelity procedural quadrotor drone mesh
     * 
     * @param {string} [team='T'] 'T' or 'CT' faction
     * @returns {THREE.Group} Fully assembled drone mesh
     */
    function createDroneMesh(team = 'T') {
        const droneGroup = new THREE.Group();
        const teamColor = (team === 'T') ? 0xd35400 : 0x2980b9;
        const carbonTex = createCarbonFiberTexture();

        // Common Materials
        const carbonMat = new THREE.MeshStandardMaterial({
            color: 0x2b3036,
            map: carbonTex || null,
            roughness: 0.35,
            metalness: 0.7
        });

        const metalMat = new THREE.MeshStandardMaterial({
            color: 0x1f2327,
            roughness: 0.4,
            metalness: 0.85
        });

        const accentMat = new THREE.MeshStandardMaterial({
            color: teamColor,
            roughness: 0.3,
            metalness: 0.4
        });

        // 1. Central Aerodynamic Fuselage
        const bodyGeo = new THREE.BoxGeometry(0.52, 0.16, 0.62);
        const bodyMesh = new THREE.Mesh(bodyGeo, carbonMat);
        bodyMesh.position.y = 0;
        bodyMesh.castShadow = true;
        droneGroup.add(bodyMesh);

        // Top canopy fairing (sleek sloped cover)
        const canopyGeo = new THREE.CylinderGeometry(0.18, 0.26, 0.08, 6);
        const canopyMesh = new THREE.Mesh(canopyGeo, carbonMat);
        canopyMesh.position.y = 0.11;
        canopyMesh.rotation.y = Math.PI / 6;
        canopyMesh.castShadow = true;
        droneGroup.add(canopyMesh);

        // Team Accent Racing / Identification Stripe
        const stripeGeo = new THREE.BoxGeometry(0.12, 0.02, 0.64);
        const stripeMesh = new THREE.Mesh(stripeGeo, accentMat);
        stripeMesh.position.y = 0.082;
        droneGroup.add(stripeMesh);

        // 2. Diagonal Carbon Motor Arms (X-Configuration)
        const armLength = 0.88;
        const armGeo = new THREE.CylinderGeometry(0.028, 0.028, armLength, 8);
        const angles = [
            Math.PI / 4,       // Front-Right (+X, +Z)
            (3 * Math.PI) / 4, // Front-Left (-X, +Z)
            (5 * Math.PI) / 4, // Rear-Left (-X, -Z)
            (7 * Math.PI) / 4  // Rear-Right (+X, -Z)
        ];

        const armDist = 0.58;
        const motorPositions = [];

        angles.forEach(ang => {
            const arm = new THREE.Mesh(armGeo, carbonMat);
            const midX = Math.cos(ang) * (armDist * 0.5);
            const midZ = Math.sin(ang) * (armDist * 0.5);
            arm.position.set(midX, -0.01, midZ);
            arm.rotation.z = Math.PI / 2;
            arm.rotation.y = -ang + Math.PI / 2;
            arm.castShadow = true;
            droneGroup.add(arm);

            motorPositions.push({
                x: Math.cos(ang) * armDist,
                z: Math.sin(ang) * armDist,
                ang: ang
            });
        });

        // 3. Brushless Motors, Propeller Mounts & Aerodynamic Propeller Blades
        const motorGeo = new THREE.CylinderGeometry(0.065, 0.07, 0.08, 12);
        const shaftGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.04, 8);
        const bladeGeo = new THREE.BoxGeometry(0.44, 0.012, 0.045);
        const propMat = new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.25,
            metalness: 0.3
        });

        const propellers = [];

        motorPositions.forEach((mPos, idx) => {
            // Motor base housing
            const motor = new THREE.Mesh(motorGeo, metalMat);
            motor.position.set(mPos.x, 0.01, mPos.z);
            motor.castShadow = true;
            droneGroup.add(motor);

            // Motor accent ring
            const ringGeo = new THREE.CylinderGeometry(0.072, 0.072, 0.018, 12);
            const motorRing = new THREE.Mesh(ringGeo, accentMat);
            motorRing.position.set(mPos.x, 0.02, mPos.z);
            droneGroup.add(motorRing);

            // Rotor shaft
            const shaft = new THREE.Mesh(shaftGeo, metalMat);
            shaft.position.set(mPos.x, 0.06, mPos.z);
            droneGroup.add(shaft);

            // Rotating Propeller Group
            const propGroup = new THREE.Group();
            propGroup.position.set(mPos.x, 0.075, mPos.z);

            // Blade 1
            const blade1 = new THREE.Mesh(bladeGeo, propMat);
            blade1.rotation.y = 0.12; // Aerodynamic pitch angle
            propGroup.add(blade1);

            // Blade 2 (counter-blade)
            const blade2 = new THREE.Mesh(bladeGeo, propMat);
            blade2.rotation.y = -0.12;
            blade2.rotation.z = Math.PI / 2;
            blade2.rotation.x = Math.PI / 2;
            blade2.rotation.y = Math.PI / 2;
            propGroup.add(blade2);

            // Center hub spinner cone
            const spinnerGeo = new THREE.ConeGeometry(0.035, 0.04, 8);
            const spinner = new THREE.Mesh(spinnerGeo, metalMat);
            spinner.position.y = 0.02;
            propGroup.add(spinner);

            propGroup.name = `propeller_${idx}`;
            propGroup.userData.direction = (idx % 2 === 0) ? 1 : -1; // Alternate CW and CCW
            propellers.push(propGroup);
            droneGroup.add(propGroup);

            // Motor Landing Peg
            const legGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.16, 6);
            const leg = new THREE.Mesh(legGeo, carbonMat);
            leg.position.set(mPos.x, -0.11, mPos.z);
            droneGroup.add(leg);
        });

        // 4. Forward 2-Axis Gimbal Surveillance Camera
        const gimbalGroup = new THREE.Group();
        gimbalGroup.position.set(0, -0.09, 0.26);

        // Gimbal Yaw Mount Ring
        const yawGeo = new THREE.TorusGeometry(0.06, 0.012, 8, 16);
        const yawMesh = new THREE.Mesh(yawGeo, metalMat);
        yawMesh.rotation.x = Math.PI / 2;
        gimbalGroup.add(yawMesh);

        // Camera Spherical Pod
        const podGeo = new THREE.SphereGeometry(0.055, 12, 10);
        const podMesh = new THREE.Mesh(podGeo, metalMat);
        podMesh.position.set(0, -0.02, 0.02);
        gimbalGroup.add(podMesh);

        // Optical Lens Barrel
        const lensBarrelGeo = new THREE.CylinderGeometry(0.035, 0.038, 0.04, 12);
        const lensBarrel = new THREE.Mesh(lensBarrelGeo, metalMat);
        lensBarrel.rotation.x = Math.PI / 2;
        lensBarrel.position.set(0, -0.02, 0.07);
        gimbalGroup.add(lensBarrel);

        // Multi-coated glass lens
        const lensGlassGeo = new THREE.CircleGeometry(0.032, 12);
        const lensGlassMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            roughness: 0.1,
            metalness: 0.9,
            emissive: 0x003355
        });
        const lensGlass = new THREE.Mesh(lensGlassGeo, lensGlassMat);
        lensGlass.position.set(0, -0.02, 0.091);
        gimbalGroup.add(lensGlass);

        // Status recording LED indicator
        const recLedGeo = new THREE.SphereGeometry(0.012, 6, 6);
        const recLedMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
        const recLed = new THREE.Mesh(recLedGeo, recLedMat);
        recLed.position.set(0.04, -0.02, 0.075);
        gimbalGroup.add(recLed);

        gimbalGroup.name = 'gimbalCamera';
        droneGroup.add(gimbalGroup);

        // 5. Store propeller animation references on the group
        droneGroup.userData.propellers = propellers;
        droneGroup.updatePropellers = function(delta) {
            const spinSpeed = 48.0; // Rapid realistic rotation
            for (let i = 0; i < propellers.length; i++) {
                const prop = propellers[i];
                prop.rotation.y += prop.userData.direction * spinSpeed * delta;
            }
        };

        // Disposal helper
        droneGroup.dispose = function() {
            droneGroup.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m && m.dispose());
                        else child.material.dispose();
                    }
                }
            });
            if (carbonTex) carbonTex.dispose();
        };

        return droneGroup;
    }

    const TacticalDroneComponent = {
        createDrone: createDroneMesh,
        createDroneMesh,
        createCarbonFiberTexture
    };

    root.TacticalDroneComponent = TacticalDroneComponent;
    root.createDroneMesh = createDroneMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalDroneComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
