/**
 * Tactical Shooting Range Target Prop
 * 
 * High-fidelity NATO silhouette shooting range target mounted on a reinforced
 * tubular steel tripod stand with concentric scoring rings.
 * Strictly preserves `rangeTargetBody` and `rangeTargetHead` child mesh contracts.
 */

(function(root) {
    'use strict';

    /**
     * Procedural torso target texture with concentric scoring rings
     */
    function createTargetBodyTexture() {
        if (typeof document === 'undefined') return null;
        const size = 512;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Olive-gray paper target backing
        ctx.fillStyle = '#b8c0b4';
        ctx.fillRect(0, 0, size, size);

        // Human torso silhouette outline
        ctx.fillStyle = '#2d332d';
        ctx.beginPath();
        // Shoulders and torso outline
        ctx.moveTo(70, size);
        ctx.lineTo(70, 160);
        ctx.quadraticCurveTo(70, 70, 160, 50);
        ctx.lineTo(352, 50);
        ctx.quadraticCurveTo(442, 70, 442, 160);
        ctx.lineTo(442, size);
        ctx.closePath();
        ctx.fill();

        // Concentric scoring ellipses
        const cx = size * 0.5;
        const cy = 260;
        const rings = [
            { rx: 150, ry: 190, score: '7' },
            { rx: 110, ry: 140, score: '8' },
            { rx: 75,  ry: 95,  score: '9' },
            { rx: 40,  ry: 50,  score: '10' }
        ];

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        ctx.lineWidth = 3;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.font = 'bold 20px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        rings.forEach(r => {
            ctx.beginPath();
            ctx.ellipse(cx, cy, r.rx, r.ry, 0, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillText(r.score, cx, cy - r.ry + 16);
            ctx.fillText(r.score, cx, cy + r.ry - 16);
        });

        // Center Kill Zone 'X'
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath();
        ctx.arc(cx, cy, 14, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(cx - 8, cy - 8); ctx.lineTo(cx + 8, cy + 8);
        ctx.moveTo(cx + 8, cy - 8); ctx.lineTo(cx - 8, cy + 8);
        ctx.stroke();

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Procedural head target texture with bullseye ring
     */
    function createTargetHeadTexture() {
        if (typeof document === 'undefined') return null;
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return null;

        // Paper background
        ctx.fillStyle = '#b8c0b4';
        ctx.fillRect(0, 0, size, size);

        // Head silhouette
        ctx.fillStyle = '#2d332d';
        ctx.beginPath();
        ctx.arc(128, 128, 105, 0, Math.PI * 2);
        ctx.fill();

        // Head scoring rings
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(128, 128, 70, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(128, 128, 35, 0, Math.PI * 2); ctx.stroke();

        // Center red bullseye
        ctx.fillStyle = '#e74c3c';
        ctx.beginPath(); ctx.arc(128, 128, 12, 0, Math.PI * 2); ctx.fill();

        const tex = new THREE.CanvasTexture(canvas);
        return tex;
    }

    /**
     * Creates a shooting range target on a reinforced steel tripod stand.
     * 
     * @param {THREE.Vector3} position
     * @returns {{ group: THREE.Group, bodyMesh: THREE.Mesh, headMesh: THREE.Mesh }}
     */
    function createRangeTarget(position) {
        const group = new THREE.Group();
        group.position.copy(position);

        // 1. Steel Tripod Stand Legs
        const steelMat = new THREE.MeshStandardMaterial({
            color: 0x22252a,
            roughness: 0.35,
            metalness: 0.85
        });

        // 3 tripod tubular legs spreading from y = 0.8 to y = 0
        const legGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.95, 8);
        for (let i = 0; i < 3; i++) {
            const ang = (i * Math.PI * 2) / 3;
            const leg = new THREE.Mesh(legGeo, steelMat);
            leg.position.set(Math.cos(ang) * 0.28, 0.42, Math.sin(ang) * 0.28);
            leg.rotation.z = 0.38;
            leg.rotation.y = -ang;
            leg.castShadow = true;
            group.add(leg);
        }

        // Center vertical mounting pole (supports target board)
        const poleGeo = new THREE.CylinderGeometry(0.038, 0.042, 2.2, 8);
        const pole = new THREE.Mesh(poleGeo, steelMat);
        pole.position.set(0, 1.1, -0.05);
        pole.castShadow = true;
        group.add(pole);

        // Bracket clamp crossbars
        const bracketGeo = new THREE.BoxGeometry(0.9, 0.04, 0.05);
        const bracket1 = new THREE.Mesh(bracketGeo, steelMat);
        bracket1.position.set(0, 0.8, -0.02);
        group.add(bracket1);

        const bracket2 = new THREE.Mesh(bracketGeo, steelMat);
        bracket2.position.set(0, 1.7, -0.02);
        group.add(bracket2);

        // 2. Target Body (Torso) - STRICT NAME 'rangeTargetBody'
        const bodyTex = createTargetBodyTexture();
        const bodyGeo = new THREE.BoxGeometry(1.5, 2.0, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            map: bodyTex || null,
            roughness: 0.85,
            metalness: 0.05
        });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1.0, 0); // Exact bottom at y=0, height=2.0
        bodyMesh.name = 'rangeTargetBody'; // STRICT CONTRACT
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);

        // 3. Target Head - STRICT NAME 'rangeTargetHead'
        const headTex = createTargetHeadTexture();
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMat = new THREE.MeshStandardMaterial({
            color: 0xcccccc,
            map: headTex || null,
            roughness: 0.85,
            metalness: 0.05
        });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 2.3, 0); // Above body
        headMesh.name = 'rangeTargetHead'; // STRICT CONTRACT
        headMesh.castShadow = true;
        headMesh.receiveShadow = true;
        group.add(headMesh);

        // Gameplay state flags
        group.hp = Infinity;
        group.burnStacks = 0;
        group.burnTimer = 0;
        group.isRed = false;
        group.poisonTimer = 0;
        group.poisonDelay = 0;
        group.poisonDamageApplied = false;
        group.isGreen = false;

        return {
            group,
            bodyMesh,
            headMesh
        };
    }

    const TargetProp = {
        createRangeTarget,
        createTargetBodyTexture,
        createTargetHeadTexture
    };

    root.TargetProp = TargetProp;
    root.createRangeTarget = createRangeTarget;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TargetProp;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
