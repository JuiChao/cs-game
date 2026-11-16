/**
 * Tactical Optic Sights Component
 * 
 * Generates procedural optical sight attachments (Red Dot, Holographic, ACOG, Sniper 8X).
 */

(function(root) {
    'use strict';

    function createScopeMesh(scopeId) {
        const scopeGroup = new THREE.Group();
        scopeGroup.name = 'opticSight';

        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
        const mountMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 });

        if (scopeId === 'red_dot') {
            // Micro Red Dot Sight
            const housingGeo = new THREE.BoxGeometry(0.045, 0.045, 0.07);
            const housing = new THREE.Mesh(housingGeo, darkMat);
            housing.position.set(0, 0.08, -0.05);
            scopeGroup.add(housing);

            const lensGeo = new THREE.CylinderGeometry(0.016, 0.016, 0.055, 12);
            lensGeo.rotateX(Math.PI / 2);
            const lens = new THREE.Mesh(lensGeo, glassMat);
            lens.position.set(0, 0.08, -0.05);
            scopeGroup.add(lens);

            const reticleGeo = new THREE.CircleGeometry(0.003, 8);
            const reticleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
            const reticle = new THREE.Mesh(reticleGeo, reticleMat);
            reticle.position.set(0, 0.08, -0.024);
            scopeGroup.add(reticle);

            // Mount
            const mountGeo = new THREE.BoxGeometry(0.035, 0.02, 0.06);
            const mount = new THREE.Mesh(mountGeo, mountMat);
            mount.position.set(0, 0.055, -0.05);
            scopeGroup.add(mount);
        } else if (scopeId === 'holo') {
            // Holographic Sight (EOTech style hood & glass)
            const hoodGeo = new THREE.BoxGeometry(0.055, 0.05, 0.09);
            const hood = new THREE.Mesh(hoodGeo, darkMat);
            hood.position.set(0, 0.085, -0.05);
            scopeGroup.add(hood);

            const windowGeo = new THREE.BoxGeometry(0.04, 0.038, 0.07);
            const glassWindow = new THREE.Mesh(windowGeo, glassMat);
            glassWindow.position.set(0, 0.085, -0.05);
            scopeGroup.add(glassWindow);

            const mountGeo = new THREE.BoxGeometry(0.045, 0.02, 0.08);
            const mount = new THREE.Mesh(mountGeo, mountMat);
            mount.position.set(0, 0.055, -0.05);
            scopeGroup.add(mount);
        } else {
            // Magnified Optical Scope Tube (ACOG / 8X)
            const tubeGeo = new THREE.CylinderGeometry(0.022, 0.026, 0.18, 16);
            tubeGeo.rotateX(Math.PI / 2);
            const tube = new THREE.Mesh(tubeGeo, darkMat);
            tube.position.set(0, 0.095, -0.08);
            scopeGroup.add(tube);

            const bellGeo = new THREE.CylinderGeometry(0.032, 0.026, 0.06, 16);
            bellGeo.rotateX(Math.PI / 2);
            const bell = new THREE.Mesh(bellGeo, darkMat);
            bell.position.set(0, 0.095, -0.19);
            scopeGroup.add(bell);

            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028, 16), glassMat);
            lens.position.set(0, 0.095, -0.22);
            scopeGroup.add(lens);

            // Ring mounts
            const ringGeo = new THREE.BoxGeometry(0.04, 0.03, 0.03);
            const ring1 = new THREE.Mesh(ringGeo, mountMat);
            ring1.position.set(0, 0.07, -0.03);
            scopeGroup.add(ring1);

            const ring2 = new THREE.Mesh(ringGeo, mountMat);
            ring2.position.set(0, 0.07, -0.13);
            scopeGroup.add(ring2);
        }

        return scopeGroup;
    }

    const TacticalOpticComponent = {
        createScopeMesh
    };

    root.TacticalOpticComponent = TacticalOpticComponent;
    root.createScopeMesh = createScopeMesh;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalOpticComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
