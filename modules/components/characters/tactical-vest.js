/**
 * Tactical Vest Component
 * 
 * Generates a CIRAS / JPC modular tactical plate carrier with:
 * - Anatomically contoured chest and waist V-taper
 * - Front and rear ceramic SAPI ballistic strike armor plates
 * - Padded load-bearing shoulder straps
 * - High-cut Kevlar throat / neck armor collar
 * - Skeletal cummerbund with MOLLE webbing bands
 * - Triple frontal STANAG 5.56mm magazine pouches with elastic bungee tabs
 * - Chest tactical admin pouch
 * - Tactical radio pouch with flexible whip antenna
 * - Tactical duty belt with metallic Cobra buckle, hip holster, and dump pouch
 */

(function(root) {
    'use strict';

    function getVestMaterial(faction) {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
            return proceduralTextureFactory.getPBRMaterial('vest_' + faction);
        }
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

    function getBeltMaterial() {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
            return proceduralTextureFactory.getPBRMaterial('tacticalLeather');
        }
        return new THREE.MeshStandardMaterial({
            color: 0x121416,
            roughness: 0.75,
            metalness: 0.15
        });
    }

    function getBuckleMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x555555,
            roughness: 0.35,
            metalness: 0.85
        });
    }

    /**
     * Creates an unmerged hierarchical group of vest, armor plates, and pouches.
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
        const beltMat = options.beltMat || getBeltMaterial();
        const buckleMat = options.buckleMat || getBuckleMaterial();

        // 1. SAPI Armor Plates (Front & Back)
        const frontPlateGeo = new THREE.BoxGeometry(0.86, 0.82, 0.14);
        const frontPlate = new THREE.Mesh(frontPlateGeo, vestMat);
        frontPlate.position.set(0, 0.12, 0.28);
        group.add(frontPlate);

        const rearPlateGeo = new THREE.BoxGeometry(0.86, 0.82, 0.14);
        const rearPlate = new THREE.Mesh(rearPlateGeo, vestMat);
        rearPlate.position.set(0, 0.12, -0.28);
        group.add(rearPlate);

        // 2. Kevlar Throat / Neck Collar
        const collarGeo = new THREE.BoxGeometry(0.70, 0.18, 0.44);
        const collar = new THREE.Mesh(collarGeo, collarMat);
        collar.position.set(0, 0.68, 0);
        group.add(collar);

        // 3. Padded Shoulder Straps
        const strapGeo = new THREE.BoxGeometry(0.22, 0.10, 0.60);
        const leftStrap = new THREE.Mesh(strapGeo, vestMat);
        leftStrap.position.set(-0.34, 0.66, 0);
        group.add(leftStrap);

        const rightStrap = new THREE.Mesh(strapGeo, vestMat);
        rightStrap.position.set(0.34, 0.66, 0);
        group.add(rightStrap);

        // 4. Cummerbund
        const cummerbundGeo = new THREE.BoxGeometry(1.22, 0.42, 0.52);
        const cummerbund = new THREE.Mesh(cummerbundGeo, vestMat);
        cummerbund.position.set(0, 0.02, 0);
        group.add(cummerbund);

        // 5. Triple Frontal STANAG Mag Pouches
        for (let i = -1; i <= 1; i++) {
            const pouchGeo = new THREE.BoxGeometry(0.22, 0.34, 0.12);
            const pouch = new THREE.Mesh(pouchGeo, pouchMat);
            pouch.position.set(i * 0.26, -0.08, 0.38);
            group.add(pouch);
        }

        // 6. Chest Admin Pouch
        const adminGeo = new THREE.BoxGeometry(0.40, 0.18, 0.08);
        const admin = new THREE.Mesh(adminGeo, pouchMat);
        admin.position.set(0, 0.36, 0.34);
        group.add(admin);

        // 7. Tactical Radio Pouch & Antenna
        const radioGeo = new THREE.BoxGeometry(0.16, 0.26, 0.12);
        const radio = new THREE.Mesh(radioGeo, pouchMat);
        radio.position.set(-0.46, 0.20, 0.26);
        group.add(radio);

        const antGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6);
        const ant = new THREE.Mesh(antGeo, buckleMat);
        ant.position.set(-0.48, 0.52, 0.26);
        group.add(ant);

        // 8. Tactical Duty Belt, Buckle & Holster
        const beltGeo = new THREE.BoxGeometry(1.08, 0.14, 0.52);
        const belt = new THREE.Mesh(beltGeo, beltMat);
        belt.position.set(0, -0.66, 0);
        group.add(belt);

        const buckleGeo = new THREE.BoxGeometry(0.14, 0.12, 0.06);
        const buckle = new THREE.Mesh(buckleGeo, buckleMat);
        buckle.position.set(0, -0.66, 0.28);
        group.add(buckle);

        const holsterGeo = new THREE.BoxGeometry(0.16, 0.30, 0.14);
        const holster = new THREE.Mesh(holsterGeo, beltMat);
        holster.position.set(0.56, -0.72, 0.05);
        group.add(holster);

        return group;
    }

    /**
     * Merges vest accessories into a single geometry to optimize Draw Calls
     * and strictly preserve the `child.name === 'body'` hit detection contract.
     * 
     * @param {THREE.BufferGeometry} [baseBodyGeo] Base torso box geometry
     * @param {Object} [options]
     * @returns {{ geometry: THREE.BufferGeometry, materials: THREE.Material[] }}
     */
    function createMergedVestGeometry(baseBodyGeo, options) {
        options = options || {};
        const faction = options.faction || 'CT';
        const vestMat = options.vestMat || getVestMaterial(faction);
        const pouchMat = options.pouchMat || getPouchMaterial(faction);
        const collarMat = options.collarMat || getCollarMaterial(faction);
        const beltMat = options.beltMat || getBeltMaterial();
        const buckleMat = options.buckleMat || getBuckleMaterial();

        let bodyMat = options.bodyMat;
        if (!bodyMat) {
            if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
                bodyMat = proceduralTextureFactory.getPBRMaterial('camo_' + faction);
            } else {
                bodyMat = new THREE.MeshStandardMaterial({
                    color: faction === 'CT' ? 0x243342 : 0x544332,
                    roughness: 0.85,
                    metalness: 0.1
                });
            }
        }

        // 1. Anatomical Torso (Chest & Waist V-Taper)
        const chestGeo = new THREE.BoxGeometry(1.18, 0.72, 0.54);
        chestGeo.translate(0, 0.32, 0);

        const waistGeo = new THREE.BoxGeometry(1.04, 0.68, 0.48);
        waistGeo.translate(0, -0.32, 0);

        // 2. Kevlar Throat Collar
        const collarGeo = new THREE.BoxGeometry(0.70, 0.18, 0.44);
        collarGeo.translate(0, 0.68, 0);

        // 3. SAPI Armor Plates (Front & Back)
        const frontPlateGeo = new THREE.BoxGeometry(0.86, 0.82, 0.14);
        frontPlateGeo.translate(0, 0.12, 0.28);

        const rearPlateGeo = new THREE.BoxGeometry(0.86, 0.82, 0.14);
        rearPlateGeo.translate(0, 0.12, -0.28);

        // 4. Shoulder Straps
        const leftStrapGeo = new THREE.BoxGeometry(0.22, 0.10, 0.60);
        leftStrapGeo.translate(-0.34, 0.66, 0);

        const rightStrapGeo = new THREE.BoxGeometry(0.22, 0.10, 0.60);
        rightStrapGeo.translate(0.34, 0.66, 0);

        // 5. Cummerbund
        const cummerbundGeo = new THREE.BoxGeometry(1.22, 0.42, 0.52);
        cummerbundGeo.translate(0, 0.02, 0);

        // 6. Frontal STANAG Mag Pouches (3x)
        const pouchGeos = [];
        for (let i = -1; i <= 1; i++) {
            const pGeo = new THREE.BoxGeometry(0.22, 0.34, 0.12);
            pGeo.translate(i * 0.26, -0.08, 0.38);
            pouchGeos.push(pGeo);
        }

        // 7. Chest Admin Pouch
        const adminGeo = new THREE.BoxGeometry(0.40, 0.18, 0.08);
        adminGeo.translate(0, 0.36, 0.34);

        // 8. Tactical Radio & Antenna
        const radioGeo = new THREE.BoxGeometry(0.16, 0.26, 0.12);
        radioGeo.translate(-0.46, 0.20, 0.26);

        const antGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.45, 6);
        antGeo.translate(-0.48, 0.52, 0.26);

        // 9. Tactical Duty Belt, Buckle & Holster
        const beltGeo = new THREE.BoxGeometry(1.08, 0.14, 0.52);
        beltGeo.translate(0, -0.66, 0);

        const buckleGeo = new THREE.BoxGeometry(0.14, 0.12, 0.06);
        buckleGeo.translate(0, -0.66, 0.28);

        const holsterGeo = new THREE.BoxGeometry(0.16, 0.30, 0.14);
        holsterGeo.translate(0.56, -0.72, 0.05);

        const dumpPouchGeo = new THREE.BoxGeometry(0.18, 0.22, 0.14);
        dumpPouchGeo.translate(-0.56, -0.70, 0.05);

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        if (mergeFn) {
            const allGeos = [
                chestGeo, waistGeo,       // Group 0, 1 -> bodyMat (Camo combat shirt)
                collarGeo,                // Group 2 -> collarMat
                frontPlateGeo, rearPlateGeo, // Group 3, 4 -> vestMat
                leftStrapGeo, rightStrapGeo, // Group 5, 6 -> vestMat
                cummerbundGeo,            // Group 7 -> vestMat
                pouchGeos[0], pouchGeos[1], pouchGeos[2], // Group 8, 9, 10 -> pouchMat
                adminGeo,                 // Group 11 -> pouchMat
                radioGeo,                 // Group 12 -> pouchMat
                antGeo,                   // Group 13 -> buckleMat (metallic antenna)
                beltGeo,                  // Group 14 -> beltMat
                buckleGeo,                // Group 15 -> buckleMat
                holsterGeo,               // Group 16 -> beltMat
                dumpPouchGeo              // Group 17 -> pouchMat
            ];
            const mergedGeo = mergeFn(allGeos, true);
            const materials = [
                bodyMat, bodyMat,
                collarMat,
                vestMat, vestMat,
                vestMat, vestMat,
                vestMat,
                pouchMat, pouchMat, pouchMat,
                pouchMat,
                pouchMat,
                buckleMat,
                beltMat,
                buckleMat,
                beltMat,
                pouchMat
            ];
            return { geometry: mergedGeo, materials: materials };
        }

        return { geometry: chestGeo, materials: [bodyMat] };
    }

    const TacticalVest = {
        getVestMaterial,
        getPouchMaterial,
        getCollarMaterial,
        getBeltMaterial,
        getBuckleMaterial,
        createVestMesh,
        createMergedVestGeometry
    };

    root.TacticalVest = TacticalVest;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalVest;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
