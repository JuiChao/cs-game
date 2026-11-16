/**
 * Tactical Crate Prop & Instancing System
 * 
 * Batches static cover crates using THREE.InstancedMesh with procedural reinforced
 * wood/metal texture to minimize draw calls, while maintaining decoupled invisible
 * proxy box colliders in `collidableMeshList` with accurate `worldBox`.
 */

(function(root) {
    'use strict';

    let cachedCrateMaterial = null;

    /**
     * Procedural military shipping crate texture with wood slats, metal brackets, and stencils.
     */
    function createCrateTexture() {
        if (typeof document === 'undefined') return null;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Base wood color (weathered pine/olive wood)
        ctx.fillStyle = '#6b543b';
        ctx.fillRect(0, 0, size, size);

        // Wood plank horizontal slats
        const plankH = 64;
        ctx.strokeStyle = '#3a2b1b';
        ctx.lineWidth = 4;
        for (let y = 0; y <= size; y += plankH) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        // Procedural wood grain noise
        const img = ctx.getImageData(0, 0, size, size);
        const data = img.data;
        for (let y = 0; y < size; y++) {
            const grainSin = Math.sin(y * 0.12) * 14;
            for (let x = 0; x < size; x++) {
                const idx = (y * size + x) * 4;
                const noise = (Math.random() - 0.5) * 18 + grainSin;
                data[idx] = Math.max(0, Math.min(255, data[idx] + noise));
                data[idx + 1] = Math.max(0, Math.min(255, data[idx + 1] + noise * 0.8));
                data[idx + 2] = Math.max(0, Math.min(255, data[idx + 2] + noise * 0.6));
            }
        }
        ctx.putImageData(img, 0, 0);

        // Outer metal reinforcement frame
        const frameW = 32;
        ctx.fillStyle = '#3a3f45';
        ctx.fillRect(0, 0, size, frameW); // Top
        ctx.fillRect(0, size - frameW, size, frameW); // Bottom
        ctx.fillRect(0, 0, frameW, size); // Left
        ctx.fillRect(size - frameW, 0, frameW, size); // Right

        // Diagonal wooden cross bracing
        ctx.strokeStyle = '#5a4630';
        ctx.lineWidth = 26;
        ctx.beginPath();
        ctx.moveTo(frameW, frameW);
        ctx.lineTo(size - frameW, size - frameW);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(size - frameW, frameW);
        ctx.lineTo(frameW, size - frameW);
        ctx.stroke();

        // Corner metal brackets
        ctx.fillStyle = '#22262a';
        const cSize = 64;
        // TL, TR, BL, BR
        ctx.fillRect(0, 0, cSize, frameW + 12);
        ctx.fillRect(0, 0, frameW + 12, cSize);
        ctx.fillRect(size - cSize, 0, cSize, frameW + 12);
        ctx.fillRect(size - (frameW + 12), 0, frameW + 12, cSize);
        ctx.fillRect(0, size - (frameW + 12), cSize, frameW + 12);
        ctx.fillRect(0, size - cSize, frameW + 12, cSize);
        ctx.fillRect(size - cSize, size - (frameW + 12), cSize, frameW + 12);
        ctx.fillRect(size - (frameW + 12), size - cSize, frameW + 12, cSize);

        // Bolt rivets on corners
        ctx.fillStyle = '#8f97a0';
        const rivetPos = [
            [16, 16], [48, 16], [16, 48],
            [size - 16, 16], [size - 48, 16], [size - 16, 48],
            [16, size - 16], [48, size - 16], [16, size - 48],
            [size - 16, size - 16], [size - 48, size - 16], [size - 16, size - 48]
        ];
        rivetPos.forEach(([rx, ry]) => {
            ctx.beginPath();
            ctx.arc(rx, ry, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        // Stencil markings
        ctx.save();
        ctx.translate(size * 0.5, size * 0.5);
        ctx.fillStyle = 'rgba(25, 20, 15, 0.75)';
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('SUPPLY CRATE', 0, -12);
        ctx.font = '16px "Courier New", monospace';
        ctx.fillText('CAL: 7.62mm / 5.56mm', 0, 12);
        ctx.fillText('WEIGHT: 85 KG', 0, 32);
        ctx.restore();

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.userData = { isShared: true };
        return tex;
    }

    /**
     * Get or create singleton PBR crate material
     */
    function getCrateMaterial() {
        if (cachedCrateMaterial) return cachedCrateMaterial;
        const tex = createCrateTexture();
        let normalMap = null;
        if (root.proceduralTextureFactory && tex && tex.image) {
            normalMap = root.proceduralTextureFactory.generateNormalMapFromCanvas(tex.image, 1.5);
        }
        cachedCrateMaterial = new THREE.MeshStandardMaterial({
            map: tex,
            normalMap: normalMap || null,
            roughness: 0.75,
            metalness: 0.2
        });
        cachedCrateMaterial.userData = { isShared: true };
        return cachedCrateMaterial;
    }

    /**
     * Batches an array of crate positions using THREE.InstancedMesh and generates
     * corresponding decoupled invisible proxy colliders for collidableMeshList.
     * 
     * @param {Array<{x: number, y?: number, z: number}>} positions
     * @param {Object} [options={}]
     * @param {number} [options.size=10]
     * @param {THREE.Scene} [options.targetScene]
     * @param {Array<THREE.Mesh>} [options.targetCollidableList]
     * @returns {{ instancedMesh: THREE.InstancedMesh, colliders: Array<THREE.Mesh> }}
     */
    function createBatchedCrates(positions, options = {}) {
        if (!positions || positions.length === 0) return { instancedMesh: null, colliders: [] };

        const crateSize = options.size || 10;
        const targetScene = options.targetScene || (typeof scene !== 'undefined' ? scene : null);
        const collidables = options.targetCollidableList || (typeof collidableMeshList !== 'undefined' ? collidableMeshList : []);
        const boxGeo = new THREE.BoxGeometry(crateSize, crateSize, crateSize);
        const mat = getCrateMaterial();

        // 1. Instanced Mesh for GPU batching (1 Draw Call for all crates)
        const instancedMesh = new THREE.InstancedMesh(boxGeo, mat, positions.length);
        instancedMesh.name = 'visual_crates';
        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;

        const dummy = new THREE.Object3D();
        const colliderMat = (options && options.colliderMaterial)
            ? options.colliderMaterial
            : new THREE.MeshBasicMaterial({ visible: false });
        colliderMat.userData = { isShared: true };

        const colliders = [];

        for (let i = 0; i < positions.length; i++) {
            const p = positions[i];
            const posY = (p.y !== undefined) ? p.y : (crateSize * 0.5);

            // Set instance transform
            dummy.position.set(p.x, posY, p.z);
            dummy.rotation.set(0, (i * 0.15) % (Math.PI * 2), 0); // Subtle natural rotation variation
            dummy.updateMatrix();
            instancedMesh.setMatrixAt(i, dummy.matrix);

            // 2. Decoupled invisible proxy collider for precise raycast / physics
            const collider = new THREE.Mesh(boxGeo, colliderMat);
            collider.position.set(p.x, posY, p.z);
            collider.name = 'wall';
            collider.visible = false;
            collider.castShadow = true;
            collider.receiveShadow = true;
            collider.updateMatrixWorld(true);
            collider.worldBox = new THREE.Box3().setFromObject(collider);

            colliders.push(collider);
            if (collidables) collidables.push(collider);
            if (targetScene) targetScene.add(collider);
        }

        instancedMesh.instanceMatrix.needsUpdate = true;
        if (targetScene) targetScene.add(instancedMesh);

        return {
            instancedMesh,
            colliders
        };
    }

    const CrateProp = {
        createCrateTexture,
        getCrateMaterial,
        createBatchedCrates
    };

    root.CrateProp = CrateProp;
    root.createBatchedCrates = createBatchedCrates;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = CrateProp;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
