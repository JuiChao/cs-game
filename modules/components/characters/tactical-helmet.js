/**
 * Tactical Helmet Component
 * 
 * Generates an Ops-Core FAST style ballistic helmet with:
 * - High-cut ballistic shell with raised ear clearance
 * - Anatomical neck collar and head base
 * - Wilcox L4 G24 night-vision goggles (NVG) shroud / mount
 * - Tactical communications headset (Peltor ComTac) with flexible boom mic
 * - Side ARC accessory rails
 * - Polycarbonate ballistic protective goggles with tinted reflective lens
 * - Rear battery / counterweight pouch and retention straps
 */

(function(root) {
    'use strict';

    function getHelmetMaterial(faction) {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
            return proceduralTextureFactory.getPBRMaterial('helmet_' + faction);
        }
        const isCT = faction === 'CT';
        return new THREE.MeshStandardMaterial({
            color: isCT ? 0x1f2428 : 0x2e2920,
            roughness: 0.65,
            metalness: 0.35
        });
    }

    function getVisorMaterial() {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.getPBRMaterial) {
            return proceduralTextureFactory.getPBRMaterial('visor');
        }
        return new THREE.MeshStandardMaterial({
            color: 0x14202c,
            roughness: 0.12,
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

    function getHeadsetMaterial(faction) {
        return new THREE.MeshStandardMaterial({
            color: faction === 'CT' ? 0x222a22 : 0x2a221a,
            roughness: 0.6,
            metalness: 0.3
        });
    }

    function getStrapMaterial() {
        return new THREE.MeshStandardMaterial({
            color: 0x181818,
            roughness: 0.9,
            metalness: 0.1
        });
    }

    /**
     * Creates an unmerged hierarchical group of helmet, comms, NVG mount, and visor.
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
        const headsetMat = options.headsetMat || getHeadsetMaterial(faction);
        const strapMat = options.strapMat || getStrapMaterial();

        // 1. FAST Ballistic Shell Dome
        const domeGeo = new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
        domeGeo.scale(1.02, 0.95, 1.08);
        const dome = new THREE.Mesh(domeGeo, helmetMat);
        dome.position.y = 0.12;
        group.add(dome);

        // 2. Front Brim
        const brimGeo = new THREE.BoxGeometry(0.72, 0.08, 0.20);
        const brim = new THREE.Mesh(brimGeo, helmetMat);
        brim.position.set(0, 0.16, -0.34);
        group.add(brim);

        // 3. NVG Shroud / Mount (Wilcox L4 G24)
        const nvgGeo = new THREE.BoxGeometry(0.14, 0.14, 0.06);
        const nvg = new THREE.Mesh(nvgGeo, nvgMat);
        nvg.position.set(0, 0.22, -0.46);
        group.add(nvg);

        // 4. ARC Accessory Rails (Left & Right)
        const railGeo = new THREE.BoxGeometry(0.04, 0.08, 0.38);
        const leftRail = new THREE.Mesh(railGeo, nvgMat);
        leftRail.position.set(-0.41, 0.14, 0.02);
        group.add(leftRail);

        const rightRail = new THREE.Mesh(railGeo, nvgMat);
        rightRail.position.set(0.41, 0.14, 0.02);
        group.add(rightRail);

        // 5. Comms Headset (Ear cups, headband, boom mic)
        const earGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.06, 12);
        earGeo.rotateZ(Math.PI / 2);
        const leftEar = new THREE.Mesh(earGeo, headsetMat);
        leftEar.position.set(-0.38, 0.06, -0.02);
        group.add(leftEar);

        const rightEar = new THREE.Mesh(earGeo, headsetMat);
        rightEar.position.set(0.38, 0.06, -0.02);
        group.add(rightEar);

        const bandGeo = new THREE.BoxGeometry(0.80, 0.04, 0.12);
        const headBand = new THREE.Mesh(bandGeo, strapMat);
        headBand.position.set(0, 0.38, -0.02);
        group.add(headBand);

        const micGeo = new THREE.BoxGeometry(0.24, 0.03, 0.03);
        const mic = new THREE.Mesh(micGeo, nvgMat);
        mic.position.set(-0.16, -0.10, -0.36);
        group.add(mic);

        // 6. Ballistic Eye Visor & Goggles Frame
        const goggleFrameGeo = new THREE.BoxGeometry(0.66, 0.20, 0.08);
        const goggleFrame = new THREE.Mesh(goggleFrameGeo, strapMat);
        goggleFrame.position.set(0, 0.06, -0.40);
        group.add(goggleFrame);

        const visorGeo = new THREE.BoxGeometry(0.60, 0.16, 0.04);
        const visor = new THREE.Mesh(visorGeo, visorMat);
        visor.position.set(0, 0.06, -0.43);
        group.add(visor);

        const strapGeo = new THREE.BoxGeometry(0.82, 0.06, 0.82);
        const strap = new THREE.Mesh(strapGeo, strapMat);
        strap.position.set(0, 0.08, 0);
        group.add(strap);

        // 7. Rear Counterweight / Battery Pouch
        const pouchGeo = new THREE.BoxGeometry(0.26, 0.14, 0.10);
        const pouch = new THREE.Mesh(pouchGeo, helmetMat);
        pouch.position.set(0, 0.14, 0.42);
        group.add(pouch);

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
        const headsetMat = options.headsetMat || getHeadsetMaterial(faction);
        const strapMat = options.strapMat || getStrapMaterial();
        const faceMat = options.faceMat || new THREE.MeshStandardMaterial({ color: 0xf1c27d, roughness: 0.8 });

        const baseGeo = (baseHeadGeo || new THREE.BoxGeometry(0.74, 0.76, 0.74)).clone();

        // 1. Neck cylinder
        const neckGeo = new THREE.CylinderGeometry(0.18, 0.22, 0.32, 10);
        neckGeo.translate(0, -0.28, 0);

        // 2. Helmet Dome
        const domeGeo = new THREE.SphereGeometry(0.44, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.58);
        domeGeo.scale(1.02, 0.95, 1.08);
        domeGeo.translate(0, 0.12, 0);

        // 3. Brim
        const brimGeo = new THREE.BoxGeometry(0.72, 0.08, 0.20);
        brimGeo.translate(0, 0.16, -0.34);

        // 4. NVG Mount Shroud
        const nvgGeo = new THREE.BoxGeometry(0.14, 0.14, 0.06);
        nvgGeo.translate(0, 0.22, -0.46);

        // 5. ARC Rails
        const leftRailGeo = new THREE.BoxGeometry(0.04, 0.08, 0.38);
        leftRailGeo.translate(-0.41, 0.14, 0.02);

        const rightRailGeo = new THREE.BoxGeometry(0.04, 0.08, 0.38);
        rightRailGeo.translate(0.41, 0.14, 0.02);

        // 6. Comms Headset (Ear cups, band, boom mic)
        const leftEarGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.06, 10);
        leftEarGeo.rotateZ(Math.PI / 2);
        leftEarGeo.translate(-0.38, 0.06, -0.02);

        const rightEarGeo = new THREE.CylinderGeometry(0.10, 0.10, 0.06, 10);
        rightEarGeo.rotateZ(Math.PI / 2);
        rightEarGeo.translate(0.38, 0.06, -0.02);

        const bandGeo = new THREE.BoxGeometry(0.80, 0.04, 0.12);
        bandGeo.translate(0, 0.38, -0.02);

        const micGeo = new THREE.BoxGeometry(0.24, 0.03, 0.03);
        micGeo.translate(-0.16, -0.10, -0.36);

        // 7. Ballistic Goggles (Frame, Lens, Strap)
        const frameGeo = new THREE.BoxGeometry(0.66, 0.20, 0.08);
        frameGeo.translate(0, 0.06, -0.40);

        const visorGeo = new THREE.BoxGeometry(0.60, 0.16, 0.04);
        visorGeo.translate(0, 0.06, -0.43);

        const strapGeo = new THREE.BoxGeometry(0.82, 0.06, 0.82);
        strapGeo.translate(0, 0.08, 0);

        // 8. Rear Battery Counterweight Pouch
        const pouchGeo = new THREE.BoxGeometry(0.26, 0.14, 0.10);
        pouchGeo.translate(0, 0.14, 0.42);

        const mergeFn = (typeof THREE !== 'undefined' && THREE.BufferGeometryUtils && THREE.BufferGeometryUtils.mergeBufferGeometries)
            ? THREE.BufferGeometryUtils.mergeBufferGeometries
            : ((typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.mergeBufferGeometries)
                ? proceduralTextureFactory.mergeBufferGeometries
                : null);

        if (mergeFn) {
            const allGeos = [
                baseGeo, neckGeo,      // Group 0, 1 -> faceMat / balaclava
                domeGeo, brimGeo,      // Group 2, 3 -> helmetMat
                nvgGeo,                // Group 4 -> nvgMat
                leftRailGeo, rightRailGeo, // Group 5, 6 -> nvgMat
                leftEarGeo, rightEarGeo,   // Group 7, 8 -> headsetMat
                bandGeo,               // Group 9 -> strapMat
                micGeo,                // Group 10 -> nvgMat
                frameGeo,              // Group 11 -> strapMat
                visorGeo,              // Group 12 -> visorMat
                strapGeo,              // Group 13 -> strapMat
                pouchGeo               // Group 14 -> helmetMat
            ];
            const mergedGeo = mergeFn(allGeos, true);
            const materials = [
                faceMat, faceMat,
                helmetMat, helmetMat,
                nvgMat,
                nvgMat, nvgMat,
                headsetMat, headsetMat,
                strapMat,
                nvgMat,
                strapMat,
                visorMat,
                strapMat,
                helmetMat
            ];
            return { geometry: mergedGeo, materials: materials };
        }

        return { geometry: baseGeo, materials: [faceMat] };
    }

    const TacticalHelmet = {
        getHelmetMaterial,
        getVisorMaterial,
        getNvgMountMaterial,
        getHeadsetMaterial,
        getStrapMaterial,
        createHelmetMesh,
        createMergedHelmetGeometry
    };

    root.TacticalHelmet = TacticalHelmet;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalHelmet;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
