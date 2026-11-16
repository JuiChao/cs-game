/**
 * Tactical Character Component (Player & Bot Models)
 * 
 * Provides high-fidelity procedural humanoid tactical models:
 * - Counter-Terrorist (CT): Ballistic Kevlar vest, tactical helmet with NVG shroud, balaclava, combat uniform
 * - Terrorist (T): Paramilitary gear, utility harness, ammo pouches, masked face
 * - Third-person Player Dummy: Used during drone pilot spectating
 * 
 * CRITICAL CONTRACT INVARIANTS:
 * - Root `bot.mesh` MUST contain direct children:
 *   - `head`: `THREE.Mesh` with `name = 'head'` (essential 3.0x damage multiplier)
 *   - `body`: `THREE.Mesh` with `name = 'body'` (1.0x torso/limb damage)
 *   - `gun`: `THREE.Mesh` with `name = 'gun'`, containing child with `name = 'magazine'`
 */

(function(root) {
    'use strict';

    function createTacticalBotMesh(options) {
        if (typeof BotCharacterComponent !== 'undefined' && BotCharacterComponent.createBotMesh) {
            return BotCharacterComponent.createBotMesh(options);
        }

        options = options || {};
        const team = options.team || 'CT';

        const group = new THREE.Group();
        group.name = options.name || ('bot_' + team);

        const bodyMat = options.bodyMat || new THREE.MeshStandardMaterial({
            color: team === 'CT' ? 0x243342 : 0x544332,
            roughness: 0.85,
            metalness: 0.1
        });

        const vestMat = new THREE.MeshStandardMaterial({
            color: team === 'CT' ? 0x181c20 : 0x383226,
            roughness: 0.9,
            metalness: 0.2
        });

        const faceMat = options.faceMat || new THREE.MeshStandardMaterial({
            color: 0xf1c27d,
            roughness: 0.8
        });

        const helmetMat = new THREE.MeshStandardMaterial({
            color: team === 'CT' ? 0x1f2428 : 0x2e2920,
            roughness: 0.7,
            metalness: 0.4
        });

        // 1. Torso (CONTRACT INVARIANT: name = 'body')
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 1.7;
        bodyMesh.name = 'body';
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // Tactical Kevlar Vest over Torso
        const vestGeo = new THREE.BoxGeometry(1.26, 1.1, 0.68);
        const vestMesh = new THREE.Mesh(vestGeo, vestMat);
        vestMesh.position.y = 1.75;
        vestMesh.castShadow = true;
        group.add(vestMesh);

        // 2. Legs (CONTRACT INVARIANT: name = 'body')
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.name = 'body';
        leftLeg.castShadow = true;
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, bodyMat);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.name = 'body';
        rightLeg.castShadow = true;
        group.add(rightLeg);

        // 3. Head (CONTRACT INVARIANT: name = 'head', 3x multiplier)
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const headMaterials = options.materials || [
            bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat
        ];
        const headMesh = new THREE.Mesh(headGeo, headMaterials);
        headMesh.position.y = 2.8;
        headMesh.name = 'head';
        headMesh.castShadow = true;
        group.add(headMesh);

        // Ballistic Helmet over Head
        const helmetGeo = new THREE.BoxGeometry(0.86, 0.45, 0.88);
        const helmetMesh = new THREE.Mesh(helmetGeo, helmetMat);
        helmetMesh.position.y = 3.05;
        helmetMesh.castShadow = true;
        group.add(helmetMesh);

        // 4. Arms & Hands
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

        // 5. Weapon (CONTRACT INVARIANT: name = 'gun' with child named 'magazine')
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

    function createPlayerDummyMesh(playerPos, team) {
        if (typeof PlayerDummyComponent !== 'undefined' && PlayerDummyComponent.createPlayerDummyMesh) {
            return PlayerDummyComponent.createPlayerDummyMesh(playerPos, team);
        }

        const playerDummyMesh = new THREE.Group();
        playerDummyMesh.name = 'playerDummy';
        if (playerPos) playerDummyMesh.position.copy(playerPos);

        const bodyGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({ color: team === 'T' ? 0xd35400 : 0x2980b9 });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = -2.8;

        const headGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0;

        playerDummyMesh.add(body);
        playerDummyMesh.add(head);

        return playerDummyMesh;
    }

    const TacticalCharacterComponent = {
        createTacticalBotMesh,
        createPlayerDummyMesh
    };

    root.TacticalCharacterComponent = TacticalCharacterComponent;
    root.createTacticalBotMesh = createTacticalBotMesh;
    root.createPlayerDummyMesh = createPlayerDummyMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalCharacterComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
