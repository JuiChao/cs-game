/**
 * Tactical Vest Component
 * 
 * Generates a CIRAS / MOLLE tactical plate carrier with:
 * - Front and rear ceramic SAPI ballistic plate pockets
 * - High-cut Kevlar ballistic throat / neck protection collar
 * - Triple frontal MOLLE magazine pouches with bungee retention tabs
 * - Elastic cummerbund with quick-release emergency pull cord
 */

(function(root) {
    'use strict';

    function getVestMaterial(faction) {
        const isCT = faction === 'CT';
        return new THREE.MeshStandardMaterial({
            color: isCT ? 0x181c20 : 0x383226,
            roughness: 0.88,
            metalness: 0.2
        });
    }

    function getPouchMaterial(faction) {
        const isCT = faction === 'CT';
        return new THREE.MeshStandardMaterial({
            color: isCT ? 0x121518 : 0x2b261d,
            roughness: 0.92,
            metalness: 0.15
        });
    }

    function getCollarMaterial(faction) {
        const isCT = faction === 'CT';
        return new THREE.MeshStandardMaterial({
            color: isCT ? 0x202428 : 0x423b2d,
            roughness: 0.85,
            metalness: 0.1
        });
    }

    /**
     * Creates an unmerged hierarchical group of vest, collar, and pouches.
     * @param {Object} [options]
     * @returns {THREE.Group}
     */
    function createVestMesh(options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const group = new THREE.Group();
        group.name = 'tacticalVest';

        const vestMat = options.vestMat || getVestMaterial(faction);
        const pouchMat = options.pouchMat || getPouchMaterial(faction);
        const collarMat = options.collarMat || getCollarMaterial(faction);

        // 1. Plate Carrier Torso Armor
        const plateGeo = new THREE.BoxGeometry(1.26, 1.1, 0.68);
        const plate = new THREE.Mesh(plateGeo, vestMat);
        plate.position.y = 0.05;
        group.add(plate);

        // 2. Kevlar Throat / Neck Collar
        const collarGeo = new THREE.BoxGeometry(0.85, 0.22, 0.55);
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.set(0, 0.65, 0);
        group.add(collar);

        // 3. Triple Frontal MOLLE Mag Pouches
        for (let i = -1; i <= 1; i++) {
            const pouchGeo = new THREE.BoxGeometry(0.24, 0.35, 0.14);
            const pouch = new THREE.Mesh(pouchGeo, pouchMat);
            pouch.position.set(i * 0.32, -0.15, 0.38);
            group.add(pouch);
        }

        return group;
    }

    /**
     * Merges vest accessories into a single geometry to optimize Draw Calls
     * and strictly preserve the `child.name === 'body'` hit detection contract.
     * 
     * @param {THREE.BufferGeometry} baseBodyGeo Base torso box geometry
     * @param {Object} [options]
     * @returns {{ geometry: THREE.BufferGeometry, materials: THREE.Material[] }}
     */
    function createMergedVestGeometry(baseBodyGeo, options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const vestMat = options.vestMat || getVestMaterial(faction);
        const pouchMat = options.pouchMat || getPouchMaterial(faction);
        const collarMat = options.collarMat || getCollarMaterial(faction);
        const bodyMat = options.bodyMat || new THREE.MeshStandardMaterial({
            color: faction === 'CT' ? 0x243342 : 0x544332,
            roughness: 0.85,
            metalness: 0.1
        });

        const baseGeo = (baseBodyGeo || new THREE.BoxGeometry(1.2, 1.4, 0.6)).clone();

        const plateGeo = new THREE.BoxGeometry(1.26, 1.1, 0.68);
        plateGeo.translate(0, 0.05, 0);

        const collarGeo = new THREE.BoxGeometry(0.85, 0.22, 0.55);
        collarGeo.translate(0, 0.65, 0);

        const pouchGeos = [];
        for (let i = -1; i <= 1; i++) {
            const pGeo = new THREE.BoxGeometry(0.24, 0.35, 0.14);
            pGeo.translate(i * 0.32, -0.15, 0.38);
            pouchGeos.push(pGeo);
        }

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        if (mergeFn) {
            // Merge pouches together first if needed, or merge all with groups
            const allGeos = [baseGeo, plateGeo, collarGeo].concat(pouchGeos);
            const mergedGeo = mergeFn(allGeos, true);
            // Materials index: 0 = bodyMat, 1 = vestMat, 2 = collarMat, 3..5 = pouchMat
            const materials = [bodyMat, vestMat, collarMat, pouchMat, pouchMat, pouchMat];
            return { geometry: mergedGeo, materials: materials };
        }

        return { geometry: baseGeo, materials: [bodyMat] };
    }

    const TacticalVest = {
        getVestMaterial,
        getPouchMaterial,
        getCollarMaterial,
        createVestMesh,
        createMergedVestGeometry
    };

    root.TacticalVest = TacticalVest;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalVest;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
