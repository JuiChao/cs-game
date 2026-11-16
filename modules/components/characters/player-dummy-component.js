/**
 * Player Dummy Component
 * 
 * Generates a 3D tactical operator placeholder mesh placed in the world
 * during drone piloting. Strictly adheres to:
 * - Root mesh named 'playerDummy'
 * - Children are direct THREE.Mesh instances with valid geometry and material
 *   so removePlayerDummy() in scene.js safely executes geometry.dispose() and material.dispose().
 */

(function(root) {
    'use strict';

    function createPlayerDummyMesh(playerPos, team) {
        const playerDummyMesh = new THREE.Group();
        playerDummyMesh.name = 'playerDummy';
        if (playerPos) {
            playerDummyMesh.position.copy(playerPos);
        }

        const bodyGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.4, 8);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: team === 'T' ? 0xd35400 : 0x2980b9,
            roughness: 0.8,
            metalness: 0.2
        });
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.position.y = -2.8;
        body.name = 'body';

        const headGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xf1c40f,
            roughness: 0.7,
            metalness: 0.1
        });
        const head = new THREE.Mesh(headGeo, headMat);
        head.position.y = 0;
        head.name = 'head';

        playerDummyMesh.add(body);
        playerDummyMesh.add(head);

        return playerDummyMesh;
    }

    function disposePlayerDummy(dummyMesh) {
        if (!dummyMesh) return;
        dummyMesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry && typeof child.geometry.dispose === 'function') {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(m => { if (m && typeof m.dispose === 'function') m.dispose(); });
                    } else if (typeof child.material.dispose === 'function') {
                        child.material.dispose();
                    }
                }
            }
        });
    }

    const PlayerDummyComponent = {
        createPlayerDummyMesh,
        disposePlayerDummy
    };

    root.PlayerDummyComponent = PlayerDummyComponent;
    root.createPlayerDummyMesh = createPlayerDummyMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = PlayerDummyComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
