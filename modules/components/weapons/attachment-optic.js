/**
 * Tactical Optic Sights Component
 * 
 * Generates procedural optical sight attachments for firearms:
 * - none: Iron sight post for rifles/smgs or default optic tube for snipers
 * - redDot: Micro reflex red dot sight with housing, glass lens, red emitter reticle, and clamp mount
 * - holo: EOTech holographic sight with protective hood, rectangular window, and QD mount
 * - scope2x, scope3x, scope4x, scope5x, scope8x: Precision telescopic scopes with objective bells,
 *   turrets, coated lenses, and dual Picatinny mounting rings
 */

(function(root) {
    'use strict';

    function createScopeMesh(scopeId, w) {
        scopeId = scopeId || 'none';
        w = w || { length: 0.8, id: 'rifle' };

        const scopeGroup = new THREE.Group();
        scopeGroup.name = 'opticSight';

        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0.8, roughness: 0.3 });
        const glassMat = new THREE.MeshBasicMaterial({ color: 0x88ccff, transparent: true, opacity: 0.35 });
        const mountMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.4 });

        if (scopeId === 'none') {
            if (w.id === 'sniper' || w.id === 'marksman') {
                const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
                scopeGeo.rotateX(Math.PI / 2);
                const scopeMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8, roughness: 0.3 });
                const scope = new THREE.Mesh(scopeGeo, scopeMat);
                scope.position.set(0, 0.08, -0.1);
                scopeGroup.add(scope);
            } else {
                const ironGeo = new THREE.BoxGeometry(0.006, 0.03, 0.006);
                const ironMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.9, roughness: 0.2 });
                const front = new THREE.Mesh(ironGeo, ironMat);
                front.position.set(0, 0.065, -w.length / 2 + 0.02);
                scopeGroup.add(front);

                const rear = new THREE.Mesh(ironGeo, ironMat);
                rear.position.set(0, 0.065, 0.1);
                scopeGroup.add(rear);
            }
        } else if (scopeId === 'redDot' || scopeId === 'red_dot') {
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
            // Magnified Optical Scope Tube (scope2x, scope3x, scope4x, scope5x, scope8x)
            let scaleFactor = 1.0;
            if (scopeId === 'scope2x') scaleFactor = 0.9;
            else if (scopeId === 'scope3x') scaleFactor = 1.0;
            else if (scopeId === 'scope4x') scaleFactor = 1.1;
            else if (scopeId === 'scope5x') scaleFactor = 1.2;
            else if (scopeId === 'scope8x') scaleFactor = 1.35;

            const tubeLength = 0.18 * scaleFactor;
            const tubeGeo = new THREE.CylinderGeometry(0.022, 0.026, tubeLength, 16);
            tubeGeo.rotateX(Math.PI / 2);
            const tube = new THREE.Mesh(tubeGeo, darkMat);
            tube.position.set(0, 0.095, -0.08);
            scopeGroup.add(tube);

            const bellLength = 0.06 * scaleFactor;
            const bellGeo = new THREE.CylinderGeometry(0.032 * scaleFactor, 0.026, bellLength, 16);
            bellGeo.rotateX(Math.PI / 2);
            const bell = new THREE.Mesh(bellGeo, darkMat);
            bell.position.set(0, 0.095, -0.08 - tubeLength / 2 - bellLength / 2);
            scopeGroup.add(bell);

            const lens = new THREE.Mesh(new THREE.CircleGeometry(0.028 * scaleFactor, 16), glassMat);
            lens.position.set(0, 0.095, -0.08 - tubeLength / 2 - bellLength);
            scopeGroup.add(lens);

            // Adjustment turrets
            const turretGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8);
            const elevTurret = new THREE.Mesh(turretGeo, darkMat);
            elevTurret.position.set(0, 0.12, -0.08);
            scopeGroup.add(elevTurret);

            const windTurretGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.016, 8);
            windTurretGeo.rotateZ(Math.PI / 2);
            const windTurret = new THREE.Mesh(windTurretGeo, darkMat);
            windTurret.position.set(0.025, 0.095, -0.08);
            scopeGroup.add(windTurret);

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
