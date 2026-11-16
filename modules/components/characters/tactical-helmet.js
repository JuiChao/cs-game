/**
 * Tactical Helmet Component
 * 
 * Generates an Ops-Core FAST style ballistic helmet with:
 * - High-cut ballistic shell with raised ear clearance
 * - Wilcox L4 G24 night-vision goggles (NVG) shroud / mount
 * - Polycarbonate ballistic protective visor
 * - Velcro side / top attachment patches
 */

(function(root) {
    'use strict';

    function getHelmetMaterial(faction) {
        const isCT = faction === 'CT';
        return new THREE.MeshStandardMaterial({
            color: isCT ? 0x1f2428 : 0x2e2920,
            roughness: 0.65,
            metalness: 0.35
        });
    }

    function getVisorMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x1a2a3a,
            roughness: 0.1,
            metalness: 0.9,
            transparent: true,
            opacity: 0.85
        });
    }

    function getNvgMountMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x111111,
            roughness: 0.5,
            metalness: 0.8
        });
    }

    /**
     * Creates an unmerged hierarchical group of helmet, NVG mount, and visor.
     * @param {Object} [options]
     * @returns {THREE.Group}
     */
    function createHelmetMesh(options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const group = new THREE.Group();
        group.name = 'tacticalHelmet';

        const helmetMat = options.helmetMat || getHelmetMaterial(faction);
        const nvgMat = options.nvgMat || getNvgMountMaterial();
        const visorMat = options.visorMat || getVisorMaterial();

        // 1. FAST Ballistic Shell
        const shellGeo = new THREE.BoxGeometry(0.86, 0.45, 0.88);
        const shell = new THREE.Mesh(shellGeo, helmetMat);
        shell.position.y = 0.25;
        group.add(shell);

        // 2. NVG Shroud / Mount (Wilcox L4 G24)
        const nvgGeo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
        const nvg = new THREE.Mesh(nvgGeo, nvgMat);
        nvg.position.set(0, 0.28, -0.46);
        group.add(nvg);

        // 3. Ballistic Eye Visor
        const visorGeo = new THREE.BoxGeometry(0.72, 0.22, 0.04);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.08, -0.44);
        group.add(visor);

        return group;
    }

    /**
     * Merges helmet accessories into a single geometry to optimize Draw Calls
     * and strictly preserve the `child.name === 'head'` hit detection contract.
     * 
     * @param {THREE.BufferGeometry} baseHeadGeo Base head box geometry
     * @param {Object} [options]
     * @returns {{ geometry: THREE.BufferGeometry, materials: THREE.Material[] }}
     */
    function createMergedHelmetGeometry(baseHeadGeo, options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const helmetMat = options.helmetMat || getHelmetMaterial(faction);
        const nvgMat = options.nvgMat || getNvgMountMaterial();
        const visorMat = options.visorMat || getVisorMaterial();
        const faceMat = options.faceMat || new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8 });

        const baseGeo = (baseHeadGeo || new THREE.BoxGeometry(0.8, 0.8, 0.8)).clone();

        const shellGeo = new THREE.BoxGeometry(0.86, 0.45, 0.88);
        shellGeo.translate(0, 0.25, 0);

        const nvgGeo = new THREE.BoxGeometry(0.12, 0.12, 0.06);
        nvgGeo.translate(0, 0.28, -0.46);

        const visorGeo = new THREE.BoxGeometry(0.72, 0.22, 0.04);
        visorGeo.translate(0, 0.08, -0.44);

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        if (mergeFn) {
            const mergedGeo = mergeFn([baseGeo, shellGeo, nvgGeo, visorGeo], true);
            const materials = [faceMat, helmetMat, nvgMat, visorMat];
            return { geometry: mergedGeo, materials: materials };
        }

        return { geometry: baseGeo, materials: [faceMat] };
    }

    const TacticalHelmet = {
        getHelmetMaterial,
        getVisorMaterial,
        getNvgMountMaterial,
        createHelmetMesh,
        createMergedHelmetGeometry
    };

    root.TacticalHelmet = TacticalHelmet;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalHelmet;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
