/**
 * Tactical Barricade Prop (Multi-Sandbag Stacked Barrier)
 * 
 * Replaces primitive box in `modules/zombie-gear.js` with a realistic multi-tier
 * interlocking sandbag fortification. Merges individual sandbag geometries into
 * a single high-performance BufferGeometry to maintain 100% compatibility with
 * `collidableMeshList`, `worldBox`, and native disposal.
 */

(function(root) {
    'use strict';

    /**
     * Procedural burlap / hessian fabric weave texture
     */
    function createBurlapTexture() {
        if (typeof document === 'undefined') return null;
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Sandbag khaki / burlap base
        ctx.fillStyle = '#bda778';
        ctx.fillRect(0, 0, size, size);

        // Coarse fiber cross-hatch pattern
        const step = 8;
        ctx.strokeStyle = '#9c8454';
        ctx.lineWidth = 2;
        for (let x = 0; x <= size; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, size);
            ctx.stroke();
        }
        for (let y = 0; y <= size; y += step) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size, y);
            ctx.stroke();
        }

        // Noise and speckles
        const img = ctx.getImageData(0, 0, size, size);
        const data = img.data;
        for (let i = 0; i < data.length; i += 4) {
            const n = (Math.random() - 0.5) * 28;
            data[i] = Math.max(0, Math.min(255, data[i] + n));
            data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + n));
            data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + n * 0.8));
        }
        ctx.putImageData(img, 0, 0);

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(3, 2);
        return tex;
    }

    /**
     * Builds a single sandbag BufferGeometry centered at a given offset and rotation.
     */
    function createSingleSandbagGeometry(x, y, z, rotY = 0, scaleX = 1.0) {
        // Rounded oblong shape for realistic sandbag
        const geo = new THREE.BoxGeometry(3.4 * scaleX, 1.25, 1.8, 2, 2, 2);
        
        // Slightly curve corners by pulling corner vertices inward
        const pos = geo.attributes.position;
        for (let i = 0; i < pos.count; i++) {
            const px = pos.getX(i);
            const py = pos.getY(i);
            const pz = pos.getZ(i);
            const distFromCenter = Math.sqrt(px * px + pz * pz);
            // Slight bulge in center, tapering at ends
            const factor = 1.0 - (Math.abs(px) / (1.7 * scaleX)) * 0.12;
            pos.setY(i, py * factor);
            pos.setZ(i, pz * factor);
        }
        geo.computeVertexNormals();

        // Apply local transform
        const mat4 = new THREE.Matrix4();
        const rotMat = new THREE.Matrix4().makeRotationY(rotY);
        const transMat = new THREE.Matrix4().makeTranslation(x, y, z);
        mat4.multiplyMatrices(transMat, rotMat);
        geo.applyMatrix4(mat4);

        return geo;
    }

    /**
     * Constructs a full multi-tier stacked sandbag wall mesh.
     * Dimensions roughly 14 width x 4.5 height x 4.5 depth.
     * 
     * @param {THREE.Vector3} pos Center floor position
     * @returns {THREE.Mesh} Merged sandbag barrier mesh
     */
    function createBarricadeMesh(pos) {
        const bagGeometries = [];

        // Tier 1 (Bottom row: 2 rows of 4 sandbags, y ~ 0.65)
        for (let row = -1; row <= 1; row += 2) {
            const zOff = row * 0.95;
            for (let i = -2; i <= 2; i++) {
                const xOff = i * 3.1 + (row > 0 ? 0.3 : -0.3);
                const rot = (Math.random() - 0.5) * 0.15;
                bagGeometries.push(createSingleSandbagGeometry(xOff, 0.65, zOff, rot));
            }
        }

        // Tier 2 (Middle row: staggered, y ~ 1.85)
        for (let row = -1; row <= 1; row += 2) {
            const zOff = row * 0.82;
            for (let i = -2; i <= 1; i++) {
                const xOff = (i + 0.5) * 3.1 + (row > 0 ? -0.2 : 0.2);
                const rot = (Math.random() - 0.5) * 0.12;
                bagGeometries.push(createSingleSandbagGeometry(xOff, 1.85, zOff, rot));
            }
        }

        // Tier 3 (Top crest: interlocking center bags, y ~ 3.0)
        for (let i = -2; i <= 2; i++) {
            const xOff = i * 2.8;
            const rot = (Math.random() - 0.5) * 0.18;
            bagGeometries.push(createSingleSandbagGeometry(xOff, 3.0, 0, rot, 0.95));
        }

        // Merge all sandbags into a single efficient BufferGeometry
        let mergedGeo;
        if (root.mergeBufferGeometries) {
            mergedGeo = root.mergeBufferGeometries(bagGeometries);
        } else if (THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries) {
            mergedGeo = THREE.BufferGeometryUtils.mergeBufferGeometries(bagGeometries);
        } else {
            // Fallback to BoxGeometry if merge utility not present
            mergedGeo = new THREE.BoxGeometry(14, 4.5, 4.5);
        }

        // Clean up intermediate unmerged geometries
        bagGeometries.forEach(g => {
            if (g && g !== mergedGeo) g.dispose();
        });

        const burlapTex = createBurlapTexture();
        const mat = new THREE.MeshStandardMaterial({
            color: 0xc2b280,
            map: burlapTex || null,
            roughness: 0.92,
            metalness: 0.05
        });

        const barrierMesh = new THREE.Mesh(mergedGeo, mat);
        barrierMesh.position.set(pos.x, 0, pos.z);
        barrierMesh.rotation.y = Math.random() * Math.PI;
        barrierMesh.name = 'wall';
        barrierMesh.userData.noClimb = true;
        barrierMesh.userData.isBarrier = true;
        barrierMesh.userData.burlapTex = burlapTex;
        barrierMesh.castShadow = true;
        barrierMesh.receiveShadow = true;

        // Custom degradation handler
        barrierMesh.userData.applyDamageFeedback = function(currentHp, maxHp) {
            const ratio = Math.max(0, currentHp / (maxHp || 100));
            // Progressive visual wear: darkening and grit staining
            mat.color.setRGB(0.76 * (0.45 + 0.55 * ratio), 0.70 * (0.45 + 0.55 * ratio), 0.50 * (0.45 + 0.55 * ratio));
        };

        return barrierMesh;
    }

    const BarricadeProp = {
        createBarricadeMesh,
        createBurlapTexture
    };

    root.BarricadeProp = BarricadeProp;
    root.createBarricadeMesh = createBarricadeMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = BarricadeProp;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
