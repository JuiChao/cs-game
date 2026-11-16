/**
 * Tactical Airdrop Prop
 * 
 * Reinforced military supply drop container with high-visibility parachute canopy
 * and guidance beacon beam for Biohazard mode.
 * Strictly preserves `crate` and `chute` child node names.
 */

(function(root) {
    'use strict';

    /**
     * Procedural airdrop container texture with hazard stripes and stencil markings
     */
    function createAirdropCrateTexture() {
        if (typeof document === 'undefined') return null;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Military olive-drab base
        ctx.fillStyle = '#3d4d30';
        ctx.fillRect(0, 0, size, size);

        // Steel frame beveling
        const margin = 28;
        ctx.fillStyle = '#262f20';
        ctx.fillRect(0, 0, size, margin);
        ctx.fillRect(0, size - margin, size, margin);
        ctx.fillRect(0, 0, margin, size);
        ctx.fillRect(size - margin, 0, margin, size);

        // Yellow and black hazard caution chevron stripes across center
        const stripeH = 48;
        const stripeY = size * 0.5 - stripeH * 0.5;
        ctx.save();
        ctx.beginPath();
        ctx.rect(margin, stripeY, size - margin * 2, stripeH);
        ctx.clip();
        for (let x = -size; x < size * 2; x += 36) {
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.moveTo(x, stripeY);
            ctx.lineTo(x + 24, stripeY);
            ctx.lineTo(x + 24 - stripeH, stripeY + stripeH);
            ctx.lineTo(x - stripeH, stripeY + stripeH);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#1e1e1e';
            ctx.beginPath();
            ctx.moveTo(x + 24, stripeY);
            ctx.lineTo(x + 48, stripeY);
            ctx.lineTo(x + 48 - stripeH, stripeY + stripeH);
            ctx.lineTo(x + 24 - stripeH, stripeY + stripeH);
            ctx.closePath();
            ctx.fill();
        }
        ctx.restore();

        // Stencil texts
        ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.font = '900 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText('AIRDROP SUPPLY CONTAINER', size * 0.5, 120);
        ctx.font = 'bold 20px "Courier New", monospace';
        ctx.fillText('TACTICAL MUNITIONS // EMERGENCY RATION', size * 0.5, 155);
        ctx.font = 'bold 22px "Courier New", monospace';
        ctx.fillText('CAUTION: HEAVY LOAD (500 KG)', size * 0.5, 410);

        // Corner steel plate rivets
        ctx.fillStyle = '#a0a89d';
        const rivetCoords = [
            [14, 14], [size - 14, 14], [14, size - 14], [size - 14, size - 14],
            [size * 0.5, 14], [size * 0.5, size - 14], [14, size * 0.5], [size - 14, size * 0.5]
        ];
        rivetCoords.forEach(([rx, ry]) => {
            ctx.beginPath();
            ctx.arc(rx, ry, 5, 0, Math.PI * 2);
            ctx.fill();
        });

        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        return tex;
    }

    /**
     * Creates an airdrop group with reinforced crate, parachute canopy, and suspension cords.
     * 
     * @param {THREE.Vector3} pos Spawn coordinate
     * @returns {THREE.Group} Airdrop group with child nodes 'crate' and 'chute'
     */
    function createAirdropMesh(pos) {
        const group = new THREE.Group();

        // 1. Reinforced Container Mesh - STRICT NAME 'crate'
        const crateTex = createAirdropCrateTexture();
        const crateGeo = new THREE.BoxGeometry(10, 8, 10);
        const crateMat = new THREE.MeshStandardMaterial({
            color: 0x4a5d3a,
            map: crateTex || null,
            roughness: 0.7,
            metalness: 0.3
        });
        const crate = new THREE.Mesh(crateGeo, crateMat);
        crate.name = 'crate'; // STRICT CONTRACT
        crate.castShadow = true;
        crate.receiveShadow = true;
        group.add(crate);

        // Protective corner bumpers on the crate
        const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1a2118, roughness: 0.5, metalness: 0.8 });
        const bumperGeo = new THREE.BoxGeometry(2.4, 2.4, 2.4);
        for (let dx of [-4.5, 4.5]) {
            for (let dy of [-3.5, 3.5]) {
                for (let dz of [-4.5, 4.5]) {
                    const bumper = new THREE.Mesh(bumperGeo, bumperMat);
                    bumper.position.set(dx, dy, dz);
                    crate.add(bumper);
                }
            }
        }

        // 2. Parachute Canopy Mesh - STRICT NAME 'chute'
        const chuteGeo = new THREE.ConeGeometry(14, 10, 12, 1, true);
        const chuteMat = new THREE.MeshBasicMaterial({
            color: 0xff7722,
            transparent: true,
            opacity: 0.8,
            side: THREE.DoubleSide
        });
        const chute = new THREE.Mesh(chuteGeo, chuteMat);
        chute.name = 'chute'; // STRICT CONTRACT
        chute.position.y = 14;
        group.add(chute);

        // Suspension cord lines from canopy edge to crate top corners
        const cordMat = new THREE.LineBasicMaterial({ color: 0xdddddd, transparent: true, opacity: 0.6 });
        const corners = [
            new THREE.Vector3(-4.5, 4, -4.5),
            new THREE.Vector3(4.5, 4, -4.5),
            new THREE.Vector3(4.5, 4, 4.5),
            new THREE.Vector3(-4.5, 4, 4.5)
        ];
        corners.forEach((corner, idx) => {
            const ang = (idx * Math.PI) / 2 + Math.PI / 4;
            const canopyRimPos = new THREE.Vector3(Math.cos(ang) * 13.5, 9, Math.sin(ang) * 13.5);
            const cordPoints = [corner, canopyRimPos];
            const cordGeo = new THREE.BufferGeometry().setFromPoints(cordPoints);
            const cordLine = new THREE.Line(cordGeo, cordMat);
            chute.add(cordLine);
        });

        group.position.set(pos.x, 240, pos.z);

        return group;
    }

    /**
     * Creates the luminous guidance beacon beam projected to the sky
     */
    function createAirdropBeam(pos) {
        const beamGeo = new THREE.CylinderGeometry(2.5, 2.5, 240, 16);
        const beamMat = new THREE.MeshBasicMaterial({
            color: 0x00ff88,
            transparent: true,
            opacity: 0.25,
            side: THREE.DoubleSide
        });
        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(pos.x, 120, pos.z);
        return beam;
    }

    const AirdropProp = {
        createAirdropMesh,
        createAirdropBeam,
        createAirdropCrateTexture
    };

    root.AirdropProp = AirdropProp;
    root.createAirdropMesh = createAirdropMesh;
    root.createAirdropBeam = createAirdropBeam;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = AirdropProp;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
