/**
 * Bot Character Component
 * 
 * Assembles tactical AI bot humanoid models with strict game engine contract compliance:
 * - Direct children of root `bot.mesh` MUST be:
 *   1. `body`: `THREE.Mesh` named 'body' (1.0x torso damage) with merged tactical vest
 *   2. `leftLeg`: `THREE.Mesh` named 'body' (1.0x limb damage)
 *   3. `rightLeg`: `THREE.Mesh` named 'body' (1.0x limb damage)
 *   4. `head`: `THREE.Mesh` named 'head' (essential 3.0x headshot multiplier) with merged FAST helmet & visor
 *   5. `leftHand`: `THREE.Mesh`
 *   6. `rightHand`: `THREE.Mesh`
 *   7. `gun`: `THREE.Mesh` named 'gun' (removed upon zombie infection) with child `magazine` (`THREE.Mesh`)
 * 
 * Uses BufferGeometryUtils.mergeBufferGeometries to merge helmet and vest into single head/body meshes,
 * minimizing draw calls while strictly maintaining direct parent raycasting (`hit.object.parent === bot.mesh`).
 */

(function(root) {
    'use strict';

    function createBotMesh(options) {
        options = options || {};
        const team = options.team || 'CT';
        const isCT = team === 'CT';

        const group = new THREE.Group();
        group.name = options.name || ('bot_' + team);

        const bodyMat = options.bodyMat || new THREE.MeshStandardMaterial({
            color: isCT ? 0x243342 : 0x544332,
            roughness: 0.85,
            metalness: 0.1
        });

        const faceMat = options.faceMat || new THREE.MeshStandardMaterial({
            color: 0xf1c27d,
            roughness: 0.8
        });

        // 1. Torso / Body (DIRECT CHILD: name = 'body', y = 1.7)
        let bodyMesh;
        if (typeof TacticalVest !== 'undefined' && TacticalVest.createMergedVestGeometry) {
            const baseBodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
            const vestData = TacticalVest.createMergedVestGeometry(baseBodyGeo, { faction: team, bodyMat });
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

        // 2. Legs (DIRECT CHILDREN: name = 'body')
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.name = 'body';
        leftLeg.castShadow = true;
        leftLeg.receiveShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, bodyMat);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.name = 'body';
        rightLeg.castShadow = true;
        rightLeg.receiveShadow = true;
        group.add(rightLeg);

        // 3. Head (DIRECT CHILD: name = 'head', y = 2.8, 3.0x multiplier)
        let headMesh;
        if (typeof TacticalHelmet !== 'undefined' && TacticalHelmet.createMergedHelmetGeometry) {
            const baseHeadGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
            const helmetData = TacticalHelmet.createMergedHelmetGeometry(baseHeadGeo, { faction: team, faceMat });
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

        // 4. Arms & Hands (DIRECT CHILDREN)
        const handGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const handMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d });

        const leftHand = new THREE.Mesh(handGeo, handMat);
        leftHand.position.set(-0.9, 1.8, 0.3);
        leftHand.castShadow = true;
        group.add(leftHand);

        const rightHand = new THREE.Mesh(handGeo, handMat);
        rightHand.position.set(0.9, 1.8, 0.3);
        rightHand.castShadow = true;
        group.add(rightHand);

        // 5. Weapon (DIRECT CHILD: name = 'gun' with child 'magazine')
        const wInfo = options.wInfo || { length: 0.8, color: 0x555555 };
        const gunGeo = new THREE.BoxGeometry(0.15, 0.15, wInfo.length || 0.8);
        const gunMat = new THREE.MeshStandardMaterial({ color: wInfo.color || 0x555555 });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.name = 'gun';
        gunMesh.castShadow = true;

        const botMagGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
        const botMagMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const botMag = new THREE.Mesh(botMagGeo, botMagMat);
        botMag.position.set(0, -0.15, 0.1);
        botMag.name = 'magazine';
        gunMesh.add(botMag);

        gunMesh.position.set(0.9, 1.8, 0.8);
        group.add(gunMesh);

        return group;
    }

    const BotCharacterComponent = {
        createBotMesh
    };

    root.BotCharacterComponent = BotCharacterComponent;
    root.createBotMesh = createBotMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BotCharacterComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
