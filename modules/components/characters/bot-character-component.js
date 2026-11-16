/**
 * Bot Character Component
 * 
 * Assembles high-fidelity procedural tactical humanoid models for CT, T, and Zombie factions
 * with strict game engine contract compliance:
 * - Direct children of root `bot.mesh` MUST be:
 *   1. `body`: `THREE.Mesh` named 'body' (1.0x torso damage) with merged CIRAS plate carrier, pouches & belt
 *   2. `leftLeg`: `THREE.Mesh` named 'body' (1.0x limb damage) with merged combat trousers, knee pad & boot
 *   3. `rightLeg`: `THREE.Mesh` named 'body' (1.0x limb damage) with merged combat trousers, knee pad & boot
 *   4. `head`: `THREE.Mesh` named 'head' (essential 3.0x headshot multiplier) with merged FAST helmet, comms & visor
 *   5. `leftArm`: `THREE.Mesh` named 'body' (1.0x limb damage) with articulated shoulder, sleeve & elbow pad
 *   6. `rightArm`: `THREE.Mesh` named 'body' (1.0x limb damage) with articulated shoulder, sleeve & elbow pad
 *   7. `leftHand`: `THREE.Mesh` with tactical carbon-fiber knuckle assault glove
 *   8. `rightHand`: `THREE.Mesh` with tactical carbon-fiber knuckle assault glove
 *   9. `gun`: `THREE.Mesh` named 'gun' (removed upon zombie infection) with child `magazine` (`THREE.Mesh`)
 * 
 * Uses BufferGeometryUtils.mergeBufferGeometries to merge accessories into unified sub-meshes,
 * minimizing draw calls while strictly maintaining direct parent raycasting (`hit.object.parent === bot.mesh`).
 */

(function(root) {
    'use strict';

    function createTacticalLegMesh(isLeft, faction, bodyMat) {
        const side = isLeft ? -1 : 1;

        // 1. Thigh with bellows cargo pocket
        const thighGeo = new THREE.BoxGeometry(0.38, 0.48, 0.38);
        thighGeo.translate(0, 0.26, 0);

        const pocketGeo = new THREE.BoxGeometry(0.08, 0.20, 0.18);
        pocketGeo.translate(side * 0.21, 0.26, 0);

        // 2. Hard-shell tactical knee pad (Crye Precision AirFlex style)
        const kneeGeo = new THREE.BoxGeometry(0.30, 0.18, 0.10);
        kneeGeo.translate(0, 0.00, 0.20);

        const strapGeo = new THREE.BoxGeometry(0.34, 0.04, 0.36);
        strapGeo.translate(0, 0.00, 0);

        // 3. Lower calf bloused into boot collar
        const shinGeo = new THREE.BoxGeometry(0.34, 0.38, 0.34);
        shinGeo.translate(0, -0.24, 0);

        // 4. Tactical combat boot (leather ankle, foot & lugged rubber sole)
        const bootAnkleGeo = new THREE.BoxGeometry(0.36, 0.16, 0.36);
        bootAnkleGeo.translate(0, -0.42, 0);

        const bootFootGeo = new THREE.BoxGeometry(0.34, 0.14, 0.48);
        bootFootGeo.translate(0, -0.50, 0.06);

        const bootSoleGeo = new THREE.BoxGeometry(0.36, 0.06, 0.52);
        bootSoleGeo.translate(0, -0.57, 0.06);

        const kneeMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6, metalness: 0.4 });
        const leatherMat = (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial)
            ? proceduralTextureFactory.getPBRMaterial('tacticalLeather')
            : new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.75, metalness: 0.15 });
        const soleMat = new THREE.MeshStandardMaterial({ color: 0x080808, roughness: 0.95, metalness: 0.05 });

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        let legMesh;
        if (mergeFn) {
            const geos = [
                thighGeo, pocketGeo, shinGeo,
                kneeGeo, strapGeo,
                bootAnkleGeo, bootFootGeo,
                bootSoleGeo
            ];
            const merged = mergeFn(geos, true);
            const materials = [
                bodyMat, bodyMat, bodyMat,
                kneeMat, kneeMat,
                leatherMat, leatherMat,
                soleMat
            ];
            legMesh = new THREE.Mesh(merged, materials);
        } else {
            legMesh = new THREE.Mesh(thighGeo, bodyMat);
        }

        legMesh.name = 'body';
        legMesh.castShadow = true;
        legMesh.receiveShadow = true;
        return legMesh;
    }

    function createTacticalArmMesh(isLeft, faction, bodyMat) {
        const side = isLeft ? -1 : 1;

        // 1. Shoulder Deltoid cap with unit insignia patch
        const shoulderGeo = new THREE.BoxGeometry(0.30, 0.26, 0.30);
        shoulderGeo.translate(0, 0.28, 0);

        const patchGeo = new THREE.BoxGeometry(0.04, 0.12, 0.14);
        patchGeo.translate(side * 0.16, 0.28, 0);

        // 2. Bicep / Tricep sleeve angled toward weapon
        const bicepGeo = new THREE.BoxGeometry(0.24, 0.34, 0.24);
        bicepGeo.translate(0, 0.02, 0.06);

        // 3. Composite elbow protection pad
        const elbowGeo = new THREE.BoxGeometry(0.24, 0.14, 0.08);
        elbowGeo.translate(0, -0.12, -0.08);

        // 4. Forearm sleeve
        const forearmGeo = new THREE.BoxGeometry(0.22, 0.32, 0.22);
        forearmGeo.translate(0, -0.28, 0.12);

        const patchColor = faction === 'CT' ? 0x2980b9 : 0xd35400;
        const patchMat = new THREE.MeshStandardMaterial({ color: patchColor, roughness: 0.7, metalness: 0.1 });
        const elbowMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6, metalness: 0.4 });

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        let armMesh;
        if (mergeFn) {
            const geos = [
                shoulderGeo, bicepGeo, forearmGeo,
                patchGeo,
                elbowGeo
            ];
            const merged = mergeFn(geos, true);
            const materials = [
                bodyMat, bodyMat, bodyMat,
                patchMat,
                elbowMat
            ];
            armMesh = new THREE.Mesh(merged, materials);
        } else {
            armMesh = new THREE.Mesh(shoulderGeo, bodyMat);
        }

        armMesh.name = 'body';
        armMesh.castShadow = true;
        armMesh.receiveShadow = true;
        return armMesh;
    }

    function createTacticalGloveMesh(isLeft, faction) {
        const side = isLeft ? -1 : 1;

        // Palm & glove body
        const palmGeo = new THREE.BoxGeometry(0.22, 0.14, 0.22);

        // Molded carbon fiber knuckle plate
        const knuckleGeo = new THREE.BoxGeometry(0.20, 0.06, 0.08);
        knuckleGeo.translate(0, 0.04, 0.08);

        // Finger segments grasping weapon
        const fingersGeo = new THREE.BoxGeometry(0.18, 0.08, 0.12);
        fingersGeo.translate(0, -0.04, 0.12);

        const thumbGeo = new THREE.BoxGeometry(0.08, 0.08, 0.10);
        thumbGeo.translate(-side * 0.10, 0.00, 0.08);

        const gloveMat = (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial)
            ? proceduralTextureFactory.getPBRMaterial('gloves_' + faction)
            : new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.55, metalness: 0.4 });

        const knuckleMat = new THREE.MeshStandardMaterial({
            color: 0x0f1113,
            roughness: 0.35,
            metalness: 0.70
        });

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        let handMesh;
        if (mergeFn) {
            const geos = [palmGeo, fingersGeo, thumbGeo, knuckleGeo];
            const merged = mergeFn(geos, true);
            const materials = [gloveMat, gloveMat, gloveMat, knuckleMat];
            handMesh = new THREE.Mesh(merged, materials);
        } else {
            handMesh = new THREE.Mesh(palmGeo, gloveMat);
        }

        handMesh.castShadow = true;
        return handMesh;
    }

    function createBotMesh(options) {
        options = options || {};
        const team = options.team || 'CT';
        const isCT = team === 'CT';

        const group = new THREE.Group();
        group.name = options.name || ('bot_' + team);

        // 0. Base Materials
        let bodyMat = options.bodyMat;
        if (!bodyMat) {
            if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
                bodyMat = proceduralTextureFactory.getPBRMaterial('camo_' + team);
            } else {
                bodyMat = new THREE.MeshStandardMaterial({
                    color: isCT ? 0x243342 : 0x544332,
                    roughness: 0.85,
                    metalness: 0.1
                });
            }
        }

        let faceMat = options.faceMat;
        if (!faceMat) {
            if (typeof getProceduralBotFaceTexture === 'function') {
                const tex = getProceduralBotFaceTexture(team);
                faceMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 });
            } else {
                faceMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8 });
            }
        }

        // 1. Torso / Body (DIRECT CHILD: name = 'body', y = 1.7)
        let bodyMesh;
        if (typeof TacticalVest !== 'undefined' && TacticalVest.createMergedVestGeometry) {
            const vestData = TacticalVest.createMergedVestGeometry(null, { faction: team, bodyMat });
            bodyMesh = new THREE.Mesh(vestData.geometry, vestData.materials);
        } else {
            const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
            bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        }
        bodyMesh.position.y = 1.7;
        bodyMesh.name = 'body';
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // 2. Legs (DIRECT CHILDREN: name = 'body', x = -0.3, 0.3, y = 0.5)
        const leftLeg = createTacticalLegMesh(true, team, bodyMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        group.add(leftLeg);

        const rightLeg = createTacticalLegMesh(false, team, bodyMat);
        rightLeg.position.set(0.3, 0.5, 0);
        group.add(rightLeg);

        // 3. Head (DIRECT CHILD: name = 'head', y = 2.8, 3.0x multiplier)
        let headMesh;
        if (typeof TacticalHelmet !== 'undefined' && TacticalHelmet.createMergedHelmetGeometry) {
            const helmetData = TacticalHelmet.createMergedHelmetGeometry(null, { faction: team, faceMat });
            headMesh = new THREE.Mesh(helmetData.geometry, helmetData.materials);
        } else {
            const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const headMaterials = options.materials || [
                bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat
            ];
            headMesh = new THREE.Mesh(headGeo, headMaterials);
        }
        headMesh.position.y = 2.8;
        headMesh.name = 'head';
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        group.add(headMesh);

        // 4. Arms (DIRECT CHILDREN: name = 'body', connecting shoulders to hands)
        const leftArm = createTacticalArmMesh(true, team, bodyMat);
        leftArm.position.set(-0.68, 1.8, 0.12);
        group.add(leftArm);

        const rightArm = createTacticalArmMesh(false, team, bodyMat);
        rightArm.position.set(0.68, 1.8, 0.12);
        group.add(rightArm);

        // 5. Gloved Hands (DIRECT CHILDREN: leftHand, rightHand)
        const leftHand = createTacticalGloveMesh(true, team);
        leftHand.position.set(-0.9, 1.8, 0.3);
        group.add(leftHand);

        const rightHand = createTacticalGloveMesh(false, team);
        rightHand.position.set(0.9, 1.8, 0.3);
        group.add(rightHand);

        // 6. Weapon (DIRECT CHILD: name = 'gun' with child 'magazine')
        const wInfo = options.wInfo || { length: 0.8, color: 0x555555 };
        const gunGeo = new THREE.BoxGeometry(0.15, 0.15, wInfo.length || 0.8);
        const gunMat = new THREE.MeshStandardMaterial({
            color: wInfo.color || 0x222222,
            metalness: 0.8,
            roughness: 0.4
        });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.name = 'gun';
        gunMesh.castShadow = true;

        const botMagGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
        const botMagMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.7, roughness: 0.3 });
        const botMag = new THREE.Mesh(botMagGeo, botMagMat);
        botMag.position.set(0, -0.15, 0.1);
        botMag.name = 'magazine';
        gunMesh.add(botMag);

        gunMesh.position.set(0.9, 1.8, 0.8);
        group.add(gunMesh);

        return group;
    }

    const BotCharacterComponent = {
        createBotMesh,
        createTacticalLegMesh,
        createTacticalArmMesh,
        createTacticalGloveMesh
    };

    root.BotCharacterComponent = BotCharacterComponent;
    root.createBotMesh = createBotMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BotCharacterComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
