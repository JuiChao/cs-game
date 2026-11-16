/**
 * Character Factory Component
 * 
 * Unified tactical operator generator for CT, T, and Zombie factions.
 * Provides faction palettes, procedural textures, and modular humanoid assembly.
 */

(function(root) {
    'use strict';

    function getFactionPalette(faction, isSource) {
        if (faction === 'CT') {
            return {
                uniform: 0x243342,
                vest: 0x181c20,
                helmet: 0x1f2428,
                gloves: 0x111111,
                skin: 0xf1c27d,
                accent: 0x3498db
            };
        } else if (faction === 'T') {
            return {
                uniform: 0x544332,
                vest: 0x383226,
                helmet: 0x2e2920,
                gloves: 0x221d17,
                skin: 0xdcb275,
                accent: 0xe67e22
            };
        } else {
            // Zombie / Undead
            return {
                uniform: 0x1f2b1f,
                vest: 0x152015,
                helmet: 0x182418,
                gloves: 0x111111,
                skin: isSource ? 0x1d4a1d : 0x2d6a2d,
                accent: isSource ? 0x00ff44 : 0x00cc33
            };
        }
    }

    function getFactionFaceTexture(faction) {
        if (typeof getProceduralBotFaceTexture === 'function') {
            return getProceduralBotFaceTexture(faction === 'CT' ? 'CT' : 'T');
        }
        if (typeof createProceduralBotFaceTexture === 'function') {
            return createProceduralBotFaceTexture(faction === 'CT' ? 'CT' : 'T');
        }
        return null;
    }

    /**
     * Builds a tactical operator humanoid group for specified faction.
     * @param {Object} [options]
     * @returns {THREE.Group}
     */
    function createCharacter(options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const palette = getFactionPalette(faction, options.isSource);

        const group = new THREE.Group();
        group.name = 'operator_' + faction;

        const uniformMat = new THREE.MeshStandardMaterial({
            color: palette.uniform,
            roughness: 0.85,
            metalness: 0.1
        });

        const skinMat = new THREE.MeshStandardMaterial({
            color: palette.skin,
            roughness: 0.8
        });

        // Torso
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, uniformMat);
        bodyMesh.position.y = 1.7;
        bodyMesh.name = 'body';
        group.add(bodyMesh);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const leftLeg = new THREE.Mesh(legGeo, uniformMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.name = 'body';
        group.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, uniformMat);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.name = 'body';
        group.add(rightLeg);

        // Head
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const faceTex = getFactionFaceTexture(faction);
        const faceMat = faceTex
            ? new THREE.MeshStandardMaterial({ map: faceTex, roughness: 0.8 })
            : skinMat;

        const headMaterials = [uniformMat, uniformMat, uniformMat, uniformMat, faceMat, uniformMat];
        const headMesh = new THREE.Mesh(headGeo, headMaterials);
        headMesh.position.y = 2.8;
        headMesh.name = 'head';
        group.add(headMesh);

        // Hands
        const handGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const leftHand = new THREE.Mesh(handGeo, skinMat);
        leftHand.position.set(-0.9, 1.8, 0.3);
        group.add(leftHand);

        const rightHand = new THREE.Mesh(handGeo, skinMat);
        rightHand.position.set(0.9, 1.8, 0.3);
        group.add(rightHand);

        // Tactical gear overlays
        if (faction !== 'Zombie') {
            if (typeof TacticalVest !== 'undefined' && TacticalVest.createVestMesh) {
                const vest = TacticalVest.createVestMesh({ faction });
                vest.position.set(0, 1.7, 0);
                group.add(vest);
            }
            if (typeof TacticalHelmet !== 'undefined' && TacticalHelmet.createHelmetMesh) {
                const helmet = TacticalHelmet.createHelmetMesh({ faction });
                helmet.position.set(0, 2.8, 0);
                group.add(helmet);
            }
        }

        return group;
    }

    const CharacterFactory = {
        getFactionPalette,
        getFactionFaceTexture,
        createCharacter
    };

    root.CharacterFactory = CharacterFactory;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CharacterFactory;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
