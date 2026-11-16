/**
 * Tactical Weapon Base Component & Materials
 * 
 * Provides foundational procedural geometry and PBR materials for weapon systems:
 * - MIL-STD-1913 Picatinny tactical rails using ExtrudeGeometry with bevels & recoil grooves
 * - Weapon muzzle devices (birdcage flash hider, slanted AK compensator, dual-baffle brake)
 * - Cached high-fidelity procedural PBR materials (gunmetal, anodized aluminum, walnut wood, polymer)
 */

(function(root) {
    'use strict';

    /**
     * Procedural Picatinny Rail (MIL-STD-1913 Standard)
     * Uses ExtrudeGeometry with bevels and transverse recoil grooves.
     * 
     * @param {number} length Rail length in meters
     * @param {Object} [options]
     * @returns {THREE.Group|THREE.Mesh}
     */
    function createPicatinnyRail(length, options) {
        options = options || {};
        const width = options.width || 0.021;
        const height = options.height || 0.009;
        const slotPitch = 0.010; // 10mm pitch between recoil slots
        const slotWidth = 0.005; // 5mm slot width

        const railGroup = new THREE.Group();
        railGroup.name = options.name || 'picatinnyRail';

        const mat = options.material || getGunmetalMaterial();

        // 1. Picatinny Cross-Section Shape (MIL-STD-1913 hexagonal dovetail profile)
        const railShape = new THREE.Shape();
        const halfW = width / 2;
        const baseW = halfW * 0.75;
        const midH = height * 0.45;
        const topH = height;

        railShape.moveTo(-baseW, 0);
        railShape.lineTo(-halfW, midH);
        railShape.lineTo(-halfW, midH + height * 0.25);
        railShape.lineTo(-halfW * 0.85, topH);
        railShape.lineTo(halfW * 0.85, topH);
        railShape.lineTo(halfW, midH + height * 0.25);
        railShape.lineTo(halfW, midH);
        railShape.lineTo(baseW, 0);
        railShape.closePath();

        // 2. Base Rail Spine Extrusion
        const spineLength = length;
        const spineSettings = {
            depth: spineLength,
            bevelEnabled: true,
            bevelSegments: 1,
            steps: 1,
            bevelSize: 0.0008,
            bevelThickness: 0.0008
        };
        const spineGeo = new THREE.ExtrudeGeometry(railShape, spineSettings);
        spineGeo.translate(0, 0, -spineLength / 2);
        const spineMesh = new THREE.Mesh(spineGeo, mat);
        railGroup.add(spineMesh);

        // 3. Segmented Upper Recoil Teeth & Grooves
        const numTeeth = Math.max(1, Math.floor(length / slotPitch));
        const toothLen = slotPitch - slotWidth;
        const toothGeo = new THREE.BoxGeometry(width * 0.98, height * 0.35, toothLen);

        for (let i = 0; i < numTeeth; i++) {
            const zPos = -length / 2 + (i + 0.5) * slotPitch;
            const tooth = new THREE.Mesh(toothGeo, mat);
            tooth.position.set(0, height * 0.85, zPos);
            railGroup.add(tooth);
        }

        return railGroup;
    }

    function createPicatinnyTopRail(length, options) {
        options = Object.assign({}, options, { name: 'picatinnyTopRail' });
        return createPicatinnyRail(length, options);
    }

    function createPicatinnySideRail(length, options) {
        options = Object.assign({}, options, { name: 'picatinnySideRail', width: 0.018, height: 0.007 });
        return createPicatinnyRail(length, options);
    }

    /**
     * Procedural Muzzle Devices
     */
    function createMuzzleDevice(type, options) {
        options = options || {};
        const mat = options.material || getGunmetalMaterial();
        const group = new THREE.Group();
        group.name = 'muzzleDevice';

        if (type === 'akCompensator') {
            // Slanted muzzle compensator for AK-47
            const geo = new THREE.CylinderGeometry(0.016, 0.018, 0.07, 12);
            geo.rotateX(Math.PI / 2);
            const comp = new THREE.Mesh(geo, mat);
            comp.rotation.z = Math.PI / 4; // Slanted vent cut
            group.add(comp);
        } else if (type === 'birdcage') {
            // A2 birdcage flash hider for M4A4
            const bodyGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.065, 12);
            bodyGeo.rotateX(Math.PI / 2);
            const body = new THREE.Mesh(bodyGeo, mat);
            group.add(body);

            // Ring collar
            const ringGeo = new THREE.TorusGeometry(0.016, 0.003, 6, 12);
            const ring = new THREE.Mesh(ringGeo, mat);
            ring.position.z = 0.02;
            group.add(ring);
        } else if (type === 'dualBaffle') {
            // Heavy sniper muzzle brake with side baffles
            const bodyGeo = new THREE.BoxGeometry(0.045, 0.035, 0.09);
            const body = new THREE.Mesh(bodyGeo, mat);
            group.add(body);

            // Side vent cutouts
            const darkMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
            const ventGeo = new THREE.BoxGeometry(0.048, 0.016, 0.025);
            const vent1 = new THREE.Mesh(ventGeo, darkMat);
            vent1.position.z = -0.015;
            group.add(vent1);

            const vent2 = new THREE.Mesh(ventGeo, darkMat);
            vent2.position.z = 0.02;
            group.add(vent2);
        }

        return group;
    }

    /**
     * Material accessors leveraging proceduralTextureFactory when present
     */
    function getGunmetalMaterial(options) {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.createBrushedMetalMaterial) {
            return proceduralTextureFactory.createBrushedMetalMaterial(options);
        }
        return new THREE.MeshStandardMaterial({
            color: (options && options.color) || 0x242426,
            metalness: 0.85,
            roughness: 0.28
        });
    }

    function getPolymerMaterial(color) {
        return new THREE.MeshStandardMaterial({
            color: color || 0x1a1a1a,
            metalness: 0.15,
            roughness: 0.82
        });
    }

    function getWalnutMaterial() {
        if (typeof proceduralTextureFactory !== 'undefined' && proceduralTextureFactory.createWalnutWoodMaterial) {
            return proceduralTextureFactory.createWalnutWoodMaterial();
        }
        return new THREE.MeshStandardMaterial({
            color: 0x5a2d0c,
            roughness: 0.72,
            metalness: 0.08
        });
    }

    const WeaponBase = {
        createPicatinnyRail,
        createPicatinnyTopRail,
        createPicatinnySideRail,
        createMuzzleDevice,
        getGunmetalMaterial,
        getPolymerMaterial,
        getWalnutMaterial
    };

    root.WeaponBase = WeaponBase;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = WeaponBase;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
