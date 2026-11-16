/**
 * Procedural Texture Factory & Native BufferGeometryUtils
 * 
 * Provides canvas-based procedural PBR textures, 3x3 Sobel convolution normal maps,
 * cached PBR material pools, and zero-dependency geometry merging.
 */

(function(root) {
    'use strict';

    // =========================================================================
    // 1. Native BufferGeometryUtils (Zero External CDN Dependencies)
    // =========================================================================

    /**
     * Natively merges an array of THREE.BufferGeometry instances into a single BufferGeometry.
     * Supports indexed and non-indexed geometries via toNonIndexed() conversion.
     * Merges position, normal, and uv typed arrays safely.
     * 
     * @param {Array<THREE.BufferGeometry>} geometries Array of BufferGeometry instances to merge
     * @param {boolean} [useGroups=false] Whether to create geometry groups per merged sub-geometry
     * @returns {THREE.BufferGeometry|null} Merged BufferGeometry or null if empty
     */
    function mergeBufferGeometries(geometries, useGroups) {
        if (!geometries || geometries.length === 0) return null;
        if (typeof THREE === 'undefined') {
            throw new Error('THREE is required for mergeBufferGeometries');
        }

        // Filter valid geometries
        const validGeos = [];
        for (let i = 0; i < geometries.length; i++) {
            const g = geometries[i];
            if (g && g.attributes && g.attributes.position) {
                validGeos.push(g);
            }
        }
        if (validGeos.length === 0) return null;
        if (validGeos.length === 1 && !useGroups) {
            return validGeos[0].clone();
        }

        // Convert indexed geometries to non-indexed so all geometries share uniform vertex buffers
        const nonIndexedGeos = [];
        const isTemporary = [];
        let totalVertices = 0;
        let hasNormal = true;
        let hasUv = true;

        for (let i = 0; i < validGeos.length; i++) {
            const g = validGeos[i];
            let nonIdx;
            if (g.index !== null) {
                nonIdx = g.toNonIndexed();
                isTemporary.push(true);
            } else {
                nonIdx = g;
                isTemporary.push(false);
            }
            nonIndexedGeos.push(nonIdx);
            totalVertices += nonIdx.attributes.position.count;

            if (!nonIdx.attributes.normal) hasNormal = false;
            if (!nonIdx.attributes.uv) hasUv = false;
        }

        const mergedPos = new Float32Array(totalVertices * 3);
        const mergedNorm = hasNormal ? new Float32Array(totalVertices * 3) : null;
        const mergedUv = hasUv ? new Float32Array(totalVertices * 2) : null;

        let posOffset = 0;
        let normOffset = 0;
        let uvOffset = 0;
        let groupStart = 0;

        const mergedGeo = new THREE.BufferGeometry();

        for (let i = 0; i < nonIndexedGeos.length; i++) {
            const g = nonIndexedGeos[i];
            const count = g.attributes.position.count;

            // Merge position
            mergedPos.set(g.attributes.position.array, posOffset);
            posOffset += count * 3;

            // Merge normal
            if (hasNormal && g.attributes.normal) {
                mergedNorm.set(g.attributes.normal.array, normOffset);
                normOffset += count * 3;
            }

            // Merge uv
            if (hasUv && g.attributes.uv) {
                mergedUv.set(g.attributes.uv.array, uvOffset);
                uvOffset += count * 2;
            }

            if (useGroups) {
                mergedGeo.addGroup(groupStart, count, i);
                groupStart += count;
            }

            // Dispose intermediate non-indexed geometries
            if (isTemporary[i]) {
                g.dispose();
            }
        }

        mergedGeo.setAttribute('position', new THREE.BufferAttribute(mergedPos, 3));
        if (hasNormal) {
            mergedGeo.setAttribute('normal', new THREE.BufferAttribute(mergedNorm, 3));
        }
        if (hasUv) {
            mergedGeo.setAttribute('uv', new THREE.BufferAttribute(mergedUv, 2));
        }

        mergedGeo.computeBoundingBox();
        mergedGeo.computeBoundingSphere();

        return mergedGeo;
    }

    // Attach to THREE.BufferGeometryUtils
    if (typeof THREE !== 'undefined') {
        THREE.BufferGeometryUtils = THREE.BufferGeometryUtils || {};
        THREE.BufferGeometryUtils.mergeBufferGeometries = mergeBufferGeometries;
    }

    // =========================================================================
    // 2. Procedural Texture Factory
    // =========================================================================

    class ProceduralTextureFactory {
        constructor() {
            this._materialCache = new Map();
            this._textureCache = new Map();
        }

        /**
         * 3x3 Sobel convolution normal map generator converting height/bump canvases
         * into tangent-space unit normal textures.
         * 
         * @param {HTMLCanvasElement} sourceCanvas Grayscale bump/height source canvas
         * @param {number} [strength=1.0] Normal vector perturbation strength
         * @returns {THREE.CanvasTexture} Tangent-space normal map texture
         */
        generateNormalMapFromCanvas(sourceCanvas, strength = 1.0) {
            if (!sourceCanvas) return null;
            const width = sourceCanvas.width || 256;
            const height = sourceCanvas.height || 256;

            let srcCtx;
            try {
                srcCtx = sourceCanvas.getContext('2d', { willReadFrequently: true }) || sourceCanvas.getContext('2d');
            } catch (e) {
                srcCtx = null;
            }

            let srcData;
            if (srcCtx && typeof srcCtx.getImageData === 'function') {
                srcData = srcCtx.getImageData(0, 0, width, height).data;
            } else {
                srcData = new Uint8ClampedArray(width * height * 4);
                for (let i = 0; i < srcData.length; i += 4) {
                    srcData[i] = 128; srcData[i + 1] = 128; srcData[i + 2] = 128; srcData[i + 3] = 255;
                }
            }

            // Extract Rec. 709 luminance values into 2D float height map [0..1]
            const hMap = new Float32Array(width * height);
            for (let i = 0, j = 0; i < srcData.length; i += 4, j++) {
                hMap[j] = (0.299 * srcData[i] + 0.587 * srcData[i + 1] + 0.114 * srcData[i + 2]) / 255.0;
            }

            const normalCanvas = document.createElement('canvas');
            normalCanvas.width = width;
            normalCanvas.height = height;
            const normCtx = normalCanvas.getContext('2d', { willReadFrequently: true }) || normalCanvas.getContext('2d');
            const normImageData = normCtx.createImageData(width, height);
            const dstData = normImageData.data;

            // 3x3 Sobel convolution with periodic boundary wrapping for seamless tiling
            for (let y = 0; y < height; y++) {
                const yPrev = (y - 1 + height) % height;
                const yNext = (y + 1) % height;

                const rowPrev = yPrev * width;
                const rowCurr = y * width;
                const rowNext = yNext * width;

                for (let x = 0; x < width; x++) {
                    const xPrev = (x - 1 + width) % width;
                    const xNext = (x + 1) % width;

                    // Sample 3x3 neighborhood heights
                    const tl = hMap[rowPrev + xPrev];
                    const tc = hMap[rowPrev + x];
                    const tr = hMap[rowPrev + xNext];

                    const ml = hMap[rowCurr + xPrev];
                    const mr = hMap[rowCurr + xNext];

                    const bl = hMap[rowNext + xPrev];
                    const bc = hMap[rowNext + x];
                    const br = hMap[rowNext + xNext];

                    // Sobel kernels:
                    // dX: [-1, 0, 1; -2, 0, 2; -1, 0, 1]
                    // dY: [-1, -2, -1; 0, 0, 0; 1, 2, 1]
                    const dx = (tr + 2.0 * mr + br) - (tl + 2.0 * ml + bl);
                    const dy = (bl + 2.0 * bc + br) - (tl + 2.0 * tc + tr);

                    // Tangent-space unit normal vector
                    let nx = -dx * strength;
                    let ny = -dy * strength;
                    let nz = 1.0;

                    const invLen = 1.0 / Math.sqrt(nx * nx + ny * ny + nz * nz);
                    nx *= invLen;
                    ny *= invLen;
                    nz *= invLen;

                    const pIdx = (y * width + x) * 4;
                    // Map [-1, 1] to [0, 255] RGB normal format
                    dstData[pIdx] = Math.round((nx * 0.5 + 0.5) * 255);
                    dstData[pIdx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
                    dstData[pIdx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
                    dstData[pIdx + 3] = 255;
                }
            }

            normCtx.putImageData(normImageData, 0, 0);

            if (typeof THREE !== 'undefined' && THREE.CanvasTexture) {
                const tex = new THREE.CanvasTexture(normalCanvas);
                tex.wrapS = THREE.RepeatWrapping;
                tex.wrapT = THREE.RepeatWrapping;
                tex.userData = { isShared: true };
                return tex;
            }
            return normalCanvas;
        }

        /**
         * Brushed metal receiver: dark metallic base (#22252a), high-frequency horizontal striations,
         * anisotropic roughness (0.35–0.45), high metalness (0.90), linear normal map.
         * 
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createBrushedMetalMaterial(options = {}) {
            const size = 512;
            const diffCanvas = document.createElement('canvas');
            diffCanvas.width = size;
            diffCanvas.height = size;
            const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');

            diffCtx.fillStyle = '#22252a';
            diffCtx.fillRect(0, 0, size, size);

            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = size;
            heightCanvas.height = size;
            const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');
            heightCtx.fillStyle = '#808080';
            heightCtx.fillRect(0, 0, size, size);

            const roughCanvas = document.createElement('canvas');
            roughCanvas.width = size;
            roughCanvas.height = size;
            const roughCtx = roughCanvas.getContext('2d', { willReadFrequently: true }) || roughCanvas.getContext('2d');

            const diffImg = diffCtx.getImageData(0, 0, size, size);
            const heightImg = heightCtx.getImageData(0, 0, size, size);
            const roughImg = roughCtx.createImageData(size, size);

            const dData = diffImg.data;
            const hData = heightImg.data;
            const rData = roughImg.data;

            // Generate fine anisotropic horizontal striations
            for (let y = 0; y < size; y++) {
                const lineBase = Math.sin(y * 1.5) * 4.0 + (Math.sin(y * 7.3) * 3.0) + ((Math.random() - 0.5) * 8.0);
                const lineRough = 0.40 + (Math.sin(y * 2.1) * 0.04) + ((Math.random() - 0.5) * 0.03);
                const clampedRough = Math.max(0.35, Math.min(0.45, lineRough));
                const roughByte = Math.round(clampedRough * 255);

                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;
                    const microNoise = (Math.random() - 0.5) * 6.0;
                    const streak = Math.max(-14, Math.min(14, lineBase + microNoise));

                    // Base color #22252a is (34, 37, 42)
                    dData[idx] = Math.max(0, Math.min(255, 34 + streak));
                    dData[idx + 1] = Math.max(0, Math.min(255, 37 + streak));
                    dData[idx + 2] = Math.max(0, Math.min(255, 42 + streak * 1.1));
                    dData[idx + 3] = 255;

                    const hVal = Math.max(0, Math.min(255, 128 + streak * 2.5));
                    hData[idx] = hVal;
                    hData[idx + 1] = hVal;
                    hData[idx + 2] = hVal;
                    hData[idx + 3] = 255;

                    rData[idx] = roughByte;
                    rData[idx + 1] = roughByte;
                    rData[idx + 2] = roughByte;
                    rData[idx + 3] = 255;
                }
            }

            diffCtx.putImageData(diffImg, 0, 0);
            heightCtx.putImageData(heightImg, 0, 0);
            roughCtx.putImageData(roughImg, 0, 0);

            const diffTex = new THREE.CanvasTexture(diffCanvas);
            diffTex.wrapS = THREE.RepeatWrapping;
            diffTex.wrapT = THREE.RepeatWrapping;
            diffTex.userData = { isShared: true };

            const roughTex = new THREE.CanvasTexture(roughCanvas);
            roughTex.wrapS = THREE.RepeatWrapping;
            roughTex.wrapT = THREE.RepeatWrapping;
            roughTex.userData = { isShared: true };

            const normalTex = this.generateNormalMapFromCanvas(heightCanvas, 1.8);

            const mat = new THREE.MeshStandardMaterial(Object.assign({
                map: diffTex,
                normalMap: normalTex,
                roughnessMap: roughTex,
                roughness: 0.40,
                metalness: 0.90
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Walnut wood grain: organic multi-frequency sinusoidal annual rings,
         * warm amber (#7c4826) to espresso (#2a150b) gradient, dielectric (metalness 0.0, roughness 0.55),
         * ring ridge normal map.
         * 
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createWalnutWoodMaterial(options = {}) {
            const size = 512;
            const diffCanvas = document.createElement('canvas');
            diffCanvas.width = size;
            diffCanvas.height = size;
            const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');

            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = size;
            heightCanvas.height = size;
            const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');

            const diffImg = diffCtx.createImageData(size, size);
            const heightImg = heightCtx.createImageData(size, size);
            const dData = diffImg.data;
            const hData = heightImg.data;

            // Warm amber #7c4826 = (124, 72, 38)
            // Dark espresso #2a150b = (42, 21, 11)
            const rAmber = 124, gAmber = 72, bAmber = 38;
            const rEspresso = 42, gEspresso = 21, bEspresso = 11;

            const cx = size * 0.35;
            const cy = size * 0.50;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;

                    const dx = (x - cx);
                    const dy = (y - cy) * 1.8;
                    const dist = Math.sqrt(dx * dx + dy * dy);

                    // Multi-frequency sinusoidal perturbations for organic growth rings
                    const warp1 = Math.sin(y * 0.04) * 8.0;
                    const warp2 = Math.sin(x * 0.025 + y * 0.035) * 5.0;
                    const warp3 = Math.cos((x - y) * 0.015) * 4.0;
                    const rEff = (dist + warp1 + warp2 + warp3) * 0.18;

                    const ringSin = Math.sin(rEff);
                    const ringT = Math.pow(0.5 + 0.5 * ringSin, 1.6);
                    const fiberNoise = ((Math.random() - 0.5) * 0.06);
                    const t = Math.max(0, Math.min(1, ringT + fiberNoise));

                    dData[idx] = Math.round(rEspresso + (rAmber - rEspresso) * t);
                    dData[idx + 1] = Math.round(gEspresso + (gAmber - gEspresso) * t);
                    dData[idx + 2] = Math.round(bEspresso + (bAmber - bEspresso) * t);
                    dData[idx + 3] = 255;

                    const hVal = Math.round(t * 220 + 20);
                    hData[idx] = hVal;
                    hData[idx + 1] = hVal;
                    hData[idx + 2] = hVal;
                    hData[idx + 3] = 255;
                }
            }

            diffCtx.putImageData(diffImg, 0, 0);
            heightCtx.putImageData(heightImg, 0, 0);

            const diffTex = new THREE.CanvasTexture(diffCanvas);
            diffTex.wrapS = THREE.RepeatWrapping;
            diffTex.wrapT = THREE.RepeatWrapping;
            diffTex.userData = { isShared: true };

            const normalTex = this.generateNormalMapFromCanvas(heightCanvas, 1.2);

            const mat = new THREE.MeshStandardMaterial(Object.assign({
                map: diffTex,
                normalMap: normalTex,
                roughness: 0.55,
                metalness: 0.0
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Weathered masonry: brick/stone blocks, mortar joint recesses, surface noise,
         * high roughness (0.85–0.95), deep mortar groove normal map.
         * 
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createWeatheredMasonryMaterial(options = {}) {
            const size = 512;
            const diffCanvas = document.createElement('canvas');
            diffCanvas.width = size;
            diffCanvas.height = size;
            const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');

            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = size;
            heightCanvas.height = size;
            const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');

            const blockH = 32;
            const blockW = 64;
            const mortarGap = 3;

            // Deep dark mortar background
            diffCtx.fillStyle = '#3a3835';
            diffCtx.fillRect(0, 0, size, size);

            heightCtx.fillStyle = '#202020'; // Low mortar recess
            heightCtx.fillRect(0, 0, size, size);

            const rows = Math.ceil(size / blockH) + 1;
            const cols = Math.ceil(size / blockW) + 2;

            const basePalette = [
                { r: 120, g: 112, b: 100 },
                { r: 135, g: 125, b: 110 },
                { r: 110, g: 102, b: 92 },
                { r: 145, g: 136, b: 122 },
                { r: 105, g: 98,  b: 88 }
            ];

            for (let row = -1; row < rows; row++) {
                const y = row * blockH;
                const rowOffset = (row % 2 === 0) ? 0 : blockW * 0.5;

                for (let col = -1; col < cols; col++) {
                    const x = col * blockW + rowOffset;
                    const pIdx = Math.abs((row * 13 + col * 17) % basePalette.length);
                    const pal = basePalette[pIdx];
                    const shadeVar = ((col * 31 + row * 47) % 21) - 10;

                    const bx = x + mortarGap;
                    const by = y + mortarGap;
                    const bw = blockW - mortarGap * 2;
                    const bh = blockH - mortarGap * 2;

                    diffCtx.fillStyle = `rgb(${pal.r + shadeVar}, ${pal.g + shadeVar}, ${pal.b + shadeVar})`;
                    diffCtx.fillRect(bx, by, bw, bh);

                    heightCtx.fillStyle = '#d0d0d0';
                    heightCtx.fillRect(bx, by, bw, bh);
                }
            }

            const diffImg = diffCtx.getImageData(0, 0, size, size);
            const heightImg = heightCtx.getImageData(0, 0, size, size);
            const dData = diffImg.data;
            const hData = heightImg.data;

            for (let i = 0; i < dData.length; i += 4) {
                const isMortar = (hData[i] < 60);
                const noise = (Math.random() - 0.5) * (isMortar ? 12 : 28);

                dData[i] = Math.max(0, Math.min(255, dData[i] + noise));
                dData[i + 1] = Math.max(0, Math.min(255, dData[i + 1] + noise));
                dData[i + 2] = Math.max(0, Math.min(255, dData[i + 2] + noise));

                if (!isMortar) {
                    hData[i] = Math.max(0, Math.min(255, hData[i] + noise * 1.5));
                    hData[i + 1] = hData[i];
                    hData[i + 2] = hData[i];
                } else {
                    hData[i] = Math.max(0, Math.min(255, hData[i] + (Math.random() - 0.5) * 8));
                    hData[i + 1] = hData[i];
                    hData[i + 2] = hData[i];
                }
            }

            diffCtx.putImageData(diffImg, 0, 0);
            heightCtx.putImageData(heightImg, 0, 0);

            const diffTex = new THREE.CanvasTexture(diffCanvas);
            diffTex.wrapS = THREE.RepeatWrapping;
            diffTex.wrapT = THREE.RepeatWrapping;
            diffTex.userData = { isShared: true };

            const normalTex = this.generateNormalMapFromCanvas(heightCanvas, 2.5);

            const mat = new THREE.MeshStandardMaterial(Object.assign({
                map: diffTex,
                normalMap: normalTex,
                roughness: 0.90,
                metalness: 0.0
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Procedural Digital Camouflage & Ripstop Fabric:
         * Generates pixelated tactical camouflage with ripstop crosshatch grid
         * and tangent-space normal map via Sobel convolution.
         * 
         * @param {'CT'|'T'|'Zombie'} [faction='CT'] Faction designation
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createCamoFabricMaterial(faction = 'CT', options = {}) {
            if (typeof document === 'undefined' || typeof THREE === 'undefined') {
                const fallbackColor = faction === 'CT' ? 0x243342 : (faction === 'T' ? 0x544332 : 0x1f2b1f);
                return new THREE.MeshStandardMaterial(Object.assign({ color: fallbackColor, roughness: 0.85, metalness: 0.1 }, options));
            }
            const size = 256;
            const diffCanvas = document.createElement('canvas');
            diffCanvas.width = size;
            diffCanvas.height = size;
            const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');

            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = size;
            heightCanvas.height = size;
            const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');

            const isCT = (faction === 'CT');
            const isZombie = (faction === 'Zombie');

            // Camouflage color palette
            let palette;
            if (isCT) {
                // Urban SWAT / SpecOps Navy digital camo
                palette = [
                    { r: 24, g: 35, b: 48 },   // Dark slate navy
                    { r: 38, g: 52, b: 70 },   // Medium tactical blue
                    { r: 18, g: 24, b: 32 },   // Deep midnight shadow
                    { r: 58, g: 74, b: 94 }    // Steel blue highlight
                ];
            } else if (isZombie) {
                palette = [
                    { r: 28, g: 45, b: 28 },
                    { r: 42, g: 68, b: 42 },
                    { r: 20, g: 32, b: 20 },
                    { r: 60, g: 90, b: 50 }
                ];
            } else {
                // Guerrilla / Desert Coyote Tan digital camo
                palette = [
                    { r: 92, g: 78, b: 60 },   // Coyote tan
                    { r: 122, g: 104, b: 80 }, // Desert khaki
                    { r: 54, g: 44, b: 34 },   // Dark earth
                    { r: 76, g: 84, b: 62 }    // Olive drab accent
                ];
            }

            diffCtx.fillStyle = `rgb(${palette[0].r}, ${palette[0].g}, ${palette[0].b})`;
            diffCtx.fillRect(0, 0, size, size);

            heightCtx.fillStyle = '#808080';
            heightCtx.fillRect(0, 0, size, size);

            // Procedural digital camo blocks (pixelated multi-scale camouflage blotches)
            const blockSize = 8;
            const cols = size / blockSize;
            const rows = size / blockSize;

            for (let cy = 0; cy < rows; cy++) {
                for (let cx = 0; cx < cols; cx++) {
                    const n = Math.sin(cx * 0.45) * Math.cos(cy * 0.45) + Math.sin(cx * 1.2 + cy * 0.8) * 0.5 + ((Math.random() - 0.5) * 0.6);
                    let colorIndex = 0;
                    if (n > 0.45) colorIndex = 3;
                    else if (n > 0.1) colorIndex = 1;
                    else if (n < -0.3) colorIndex = 2;

                    const col = palette[colorIndex];
                    diffCtx.fillStyle = `rgb(${col.r}, ${col.g}, ${col.b})`;
                    diffCtx.fillRect(cx * blockSize, cy * blockSize, blockSize, blockSize);

                    const h = 120 + colorIndex * 8;
                    heightCtx.fillStyle = `rgb(${h}, ${h}, ${h})`;
                    heightCtx.fillRect(cx * blockSize, cy * blockSize, blockSize, blockSize);
                }
            }

            // Ripstop crosshatch weave pattern and cloth fiber noise
            const diffImg = diffCtx.getImageData(0, 0, size, size);
            const heightImg = heightCtx.getImageData(0, 0, size, size);
            const dData = diffImg.data;
            const hData = heightImg.data;

            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const idx = (y * size + x) * 4;
                    const isRipstop = (x % 16 === 0 || y % 16 === 0);
                    const weave = ((x + y) % 2 === 0 ? 6 : -6);
                    const noise = (Math.random() - 0.5) * 12;
                    const mod = (isRipstop ? 14 : 0) + weave + noise;

                    dData[idx] = Math.max(0, Math.min(255, dData[idx] + mod));
                    dData[idx + 1] = Math.max(0, Math.min(255, dData[idx + 1] + mod));
                    dData[idx + 2] = Math.max(0, Math.min(255, dData[idx + 2] + mod));

                    const hVal = Math.max(0, Math.min(255, hData[idx] + (isRipstop ? 20 : 0) + weave * 1.5));
                    hData[idx] = hVal;
                    hData[idx + 1] = hVal;
                    hData[idx + 2] = hVal;
                }
            }

            diffCtx.putImageData(diffImg, 0, 0);
            heightCtx.putImageData(heightImg, 0, 0);

            const diffTex = new THREE.CanvasTexture(diffCanvas);
            diffTex.wrapS = THREE.RepeatWrapping;
            diffTex.wrapT = THREE.RepeatWrapping;
            diffTex.userData = { isShared: true };

            const normTex = this.generateNormalMapFromCanvas(heightCanvas, 1.4);

            const mat = new THREE.MeshStandardMaterial(Object.assign({
                map: diffTex,
                normalMap: normTex,
                roughness: 0.85,
                metalness: 0.05
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Modular Plate Carrier & Ballistic Cordura Nylon:
         * Heavy-duty woven fabric with horizontal MOLLE webbing and bar-tack stitching.
         * 
         * @param {'CT'|'T'} [faction='CT'] Faction designation
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createPlateCarrierMaterial(faction = 'CT', options = {}) {
            if (typeof document === 'undefined' || typeof THREE === 'undefined') {
                return new THREE.MeshStandardMaterial(Object.assign({
                    color: faction === 'CT' ? 0x181c20 : 0x383226,
                    roughness: 0.88,
                    metalness: 0.2
                }, options));
            }
            const size = 256;
            const diffCanvas = document.createElement('canvas');
            diffCanvas.width = size;
            diffCanvas.height = size;
            const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');

            const heightCanvas = document.createElement('canvas');
            heightCanvas.width = size;
            heightCanvas.height = size;
            const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');

            const isCT = (faction === 'CT');
            const baseHex = isCT ? '#181c22' : '#342c22';
            diffCtx.fillStyle = baseHex;
            diffCtx.fillRect(0, 0, size, size);

            heightCtx.fillStyle = '#808080';
            heightCtx.fillRect(0, 0, size, size);

            // Horizontal MOLLE webbing straps (every 32 pixels, 18px thick)
            for (let y = 8; y < size; y += 32) {
                diffCtx.fillStyle = isCT ? '#12151a' : '#29221a';
                diffCtx.fillRect(0, y, size, 18);
                diffCtx.fillStyle = isCT ? '#28303a' : '#4a3f32';
                for (let x = 12; x < size; x += 24) {
                    diffCtx.fillRect(x, y + 2, 3, 14);
                }

                heightCtx.fillStyle = '#b0b0b0';
                heightCtx.fillRect(0, y, size, 18);
            }

            const dImg = diffCtx.getImageData(0, 0, size, size);
            const hImg = heightCtx.getImageData(0, 0, size, size);
            for (let i = 0; i < dImg.data.length; i += 4) {
                const n = (Math.random() - 0.5) * 10;
                dImg.data[i] = Math.max(0, Math.min(255, dImg.data[i] + n));
                dImg.data[i + 1] = Math.max(0, Math.min(255, dImg.data[i + 1] + n));
                dImg.data[i + 2] = Math.max(0, Math.min(255, dImg.data[i + 2] + n));
                hImg.data[i] = Math.max(0, Math.min(255, hImg.data[i] + n * 1.2));
                hImg.data[i + 1] = hImg.data[i];
                hImg.data[i + 2] = hImg.data[i];
            }
            diffCtx.putImageData(dImg, 0, 0);
            heightCtx.putImageData(hImg, 0, 0);

            const diffTex = new THREE.CanvasTexture(diffCanvas);
            diffTex.wrapS = THREE.RepeatWrapping;
            diffTex.wrapT = THREE.RepeatWrapping;
            diffTex.userData = { isShared: true };

            const normTex = this.generateNormalMapFromCanvas(heightCanvas, 1.8);

            const mat = new THREE.MeshStandardMaterial(Object.assign({
                map: diffTex,
                normalMap: normTex,
                roughness: 0.88,
                metalness: 0.15
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Ballistic FAST Helmet Material:
         * Matte composite Kevlar shell with anti-reflective finish.
         * 
         * @param {'CT'|'T'} [faction='CT'] Faction designation
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createBallisticHelmetMaterial(faction = 'CT', options = {}) {
            const isCT = (faction === 'CT');
            const color = isCT ? 0x1c2126 : 0x2e2820;
            const mat = new THREE.MeshStandardMaterial(Object.assign({
                color: color,
                roughness: 0.65,
                metalness: 0.35
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Ballistic Visor Material:
         * Polycarbonate protective eyewear with specular highlights and tint.
         * 
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createBallisticVisorMaterial(options = {}) {
            const mat = new THREE.MeshStandardMaterial(Object.assign({
                color: 0x14202c,
                roughness: 0.12,
                metalness: 0.90,
                transparent: true,
                opacity: 0.85
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Tactical Leather Material:
         * Rugged leather for combat boots, utility belts, and holsters.
         * 
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createTacticalLeatherMaterial(options = {}) {
            const mat = new THREE.MeshStandardMaterial(Object.assign({
                color: 0x121416,
                roughness: 0.75,
                metalness: 0.15
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Tactical Combat Glove Material:
         * Reinforced assault gloves with carbon-fiber knuckle protection.
         * 
         * @param {'CT'|'T'} [faction='CT'] Faction designation
         * @param {Object} [options={}] Additional MeshStandardMaterial parameters
         * @returns {THREE.MeshStandardMaterial}
         */
        createTacticalGloveMaterial(faction = 'CT', options = {}) {
            const isCT = (faction === 'CT');
            const mat = new THREE.MeshStandardMaterial(Object.assign({
                color: isCT ? 0x16181b : 0x24201a,
                roughness: 0.55,
                metalness: 0.40
            }, options));
            mat.userData = { isShared: true };
            return mat;
        }

        /**
         * Cached PBR material pool avoiding duplicate allocations.
         * 
         * @param {string} type Material type name
         * @param {Object} [options={}] Additional configuration options
         * @returns {THREE.MeshStandardMaterial}
         */
        getPBRMaterial(type, options = {}) {
            const cacheKey = `${type}_${JSON.stringify(options)}`;
            if (this._materialCache.has(cacheKey)) {
                return this._materialCache.get(cacheKey);
            }

            let mat;
            switch (type) {
                case 'brushedMetal':
                    mat = this.createBrushedMetalMaterial(options);
                    break;
                case 'walnutWood':
                    mat = this.createWalnutWoodMaterial(options);
                    break;
                case 'weatheredMasonry':
                case 'stone':
                    mat = this.createWeatheredMasonryMaterial(options);
                    break;
                case 'plaster': {
                    // Warm Mediterranean plaster with fine stipple normal map
                    const size = 512;
                    const diffCanvas = document.createElement('canvas');
                    diffCanvas.width = size;
                    diffCanvas.height = size;
                    const diffCtx = diffCanvas.getContext('2d', { willReadFrequently: true }) || diffCanvas.getContext('2d');
                    diffCtx.fillStyle = '#c4a882';
                    diffCtx.fillRect(0, 0, size, size);

                    const heightCanvas = document.createElement('canvas');
                    heightCanvas.width = size;
                    heightCanvas.height = size;
                    const heightCtx = heightCanvas.getContext('2d', { willReadFrequently: true }) || heightCanvas.getContext('2d');
                    heightCtx.fillStyle = '#808080';
                    heightCtx.fillRect(0, 0, size, size);

                    const dImg = diffCtx.getImageData(0, 0, size, size);
                    const hImg = heightCtx.getImageData(0, 0, size, size);
                    for (let i = 0; i < dImg.data.length; i += 4) {
                        const n = (Math.random() - 0.5) * 18;
                        dImg.data[i] = Math.max(0, Math.min(255, 196 + n));
                        dImg.data[i + 1] = Math.max(0, Math.min(255, 168 + n));
                        dImg.data[i + 2] = Math.max(0, Math.min(255, 130 + n));
                        hImg.data[i] = Math.max(0, Math.min(255, 128 + n * 2));
                        hImg.data[i + 1] = hImg.data[i];
                        hImg.data[i + 2] = hImg.data[i];
                    }
                    diffCtx.putImageData(dImg, 0, 0);
                    heightCtx.putImageData(hImg, 0, 0);

                    // Add subtle cracks
                    diffCtx.strokeStyle = 'rgba(80,65,45,0.2)';
                    diffCtx.lineWidth = 1;
                    for (let c = 0; c < 6; c++) {
                        diffCtx.beginPath();
                        diffCtx.moveTo(Math.random() * size, 0);
                        diffCtx.lineTo(Math.random() * size, size);
                        diffCtx.stroke();
                    }

                    const diffTex = new THREE.CanvasTexture(diffCanvas);
                    diffTex.wrapS = THREE.RepeatWrapping;
                    diffTex.wrapT = THREE.RepeatWrapping;
                    diffTex.userData = { isShared: true };

                    const normTex = this.generateNormalMapFromCanvas(heightCanvas, 1.4);
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        map: diffTex,
                        normalMap: normTex,
                        roughness: 0.90,
                        metalness: 0.0
                    }, options));
                    break;
                }
                case 'sand': {
                    const size = 512;
                    const c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    const ctx = c.getContext('2d');
                    ctx.fillStyle = '#c2a878';
                    ctx.fillRect(0, 0, size, size);
                    const img = ctx.getImageData(0, 0, size, size);
                    for (let i = 0; i < img.data.length; i += 4) {
                        const n = (Math.random() - 0.5) * 22;
                        img.data[i] = Math.max(0, Math.min(255, 194 + n));
                        img.data[i + 1] = Math.max(0, Math.min(255, 168 + n));
                        img.data[i + 2] = Math.max(0, Math.min(255, 120 + n));
                    }
                    ctx.putImageData(img, 0, 0);
                    const tex = new THREE.CanvasTexture(c);
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.userData = { isShared: true };
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        map: tex,
                        roughness: 1.0,
                        metalness: 0.0
                    }, options));
                    break;
                }
                case 'grass': {
                    const size = 512;
                    const c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    const ctx = c.getContext('2d');
                    ctx.fillStyle = '#5a7042';
                    ctx.fillRect(0, 0, size, size);
                    const img = ctx.getImageData(0, 0, size, size);
                    for (let i = 0; i < img.data.length; i += 4) {
                        const n = (Math.random() - 0.5) * 25;
                        img.data[i] = Math.max(0, Math.min(255, 90 + n));
                        img.data[i + 1] = Math.max(0, Math.min(255, 112 + n));
                        img.data[i + 2] = Math.max(0, Math.min(255, 66 + n));
                    }
                    ctx.putImageData(img, 0, 0);
                    const tex = new THREE.CanvasTexture(c);
                    tex.wrapS = THREE.RepeatWrapping;
                    tex.wrapT = THREE.RepeatWrapping;
                    tex.userData = { isShared: true };
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        map: tex,
                        roughness: 1.0,
                        metalness: 0.0
                    }, options));
                    break;
                }
                case 'platform':
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        color: 0x4a5548,
                        roughness: 0.85,
                        metalness: 0.1
                    }, options));
                    break;
                case 'metal':
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        color: 0x5a6a5a,
                        roughness: 0.60,
                        metalness: 0.35
                    }, options));
                    break;
                case 'rail':
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        color: 0x2a8a3a,
                        roughness: 0.50,
                        emissive: 0x002a08
                    }, options));
                    break;
                case 'box':
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        color: 0x5c4033,
                        roughness: 0.85,
                        metalness: 0.0
                    }, options));
                    break;
                case 'door':
                    mat = new THREE.MeshStandardMaterial(Object.assign({
                        color: 0x4a4a4a,
                        roughness: 0.70,
                        metalness: 0.20
                    }, options));
                    break;
                case 'camo_CT':
                    mat = this.createCamoFabricMaterial('CT', options);
                    break;
                case 'camo_T':
                    mat = this.createCamoFabricMaterial('T', options);
                    break;
                case 'vest_CT':
                    mat = this.createPlateCarrierMaterial('CT', options);
                    break;
                case 'vest_T':
                    mat = this.createPlateCarrierMaterial('T', options);
                    break;
                case 'helmet_CT':
                    mat = this.createBallisticHelmetMaterial('CT', options);
                    break;
                case 'helmet_T':
                    mat = this.createBallisticHelmetMaterial('T', options);
                    break;
                case 'visor':
                    mat = this.createBallisticVisorMaterial(options);
                    break;
                case 'tacticalLeather':
                case 'leather':
                    mat = this.createTacticalLeatherMaterial(options);
                    break;
                case 'gloves_CT':
                    mat = this.createTacticalGloveMaterial('CT', options);
                    break;
                case 'gloves_T':
                    mat = this.createTacticalGloveMaterial('T', options);
                    break;
                default:
                    mat = new THREE.MeshStandardMaterial(options);
                    break;
            }

            mat.userData = Object.assign(mat.userData || {}, { isShared: true });
            this._materialCache.set(cacheKey, mat);
            return mat;
        }
    }

    const proceduralTextureFactory = new ProceduralTextureFactory();

    // Export singleton to global/window
    root.proceduralTextureFactory = proceduralTextureFactory;

    // CommonJS / Node export if available
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            ProceduralTextureFactory,
            proceduralTextureFactory,
            mergeBufferGeometries
        };
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
