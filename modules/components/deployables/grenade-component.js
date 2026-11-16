/**
 * Tactical Grenade Component
 * 
 * Provides high-fidelity procedural 3D models for all 6 throwable deployables:
 * - `hegrenade`: Segmented cast-iron pineapple HE grenade with spoon lever & pull ring
 * - `cryo`: Vacuum cryogenic flask with high-pressure relief valve & analog pressure gauge
 * - `flashbang`: Ported aluminum stun canister with blast venting ports
 * - `molotov`: Glass bottle with liquid volume and cloth rag wick
 * - `smoke`: Cylindrical smoke canister with emission vent ports
 * - `mine`: Disc-shaped tactical landmine with pressure sensor & arming LED
 * 
 * Fully encapsulates nested geometry disposal and maintains backwards-compatible
 * proxy properties for legacy `.geometry.dispose()` and `.material.dispose()` calls.
 */

(function(root) {
    'use strict';

    /**
     * Helper to attach safe disposal proxies to a THREE.Group or THREE.Mesh.
     */
    function attachDisposalProxies(group) {
        group.dispose = function() {
            group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m && m.dispose());
                        else child.material.dispose();
                    }
                }
            });
            if (group.userData && group.userData.textures) {
                group.userData.textures.forEach(t => t && t.dispose());
            }
        };

        // Legacy compatibility proxies: if any existing code calls group.geometry.dispose()
        if (!group.geometry) {
            group.geometry = {
                dispose: function() {
                    group.traverse(child => {
                        if (child.isMesh && child.geometry && child.geometry !== this) {
                            child.geometry.dispose();
                        }
                    });
                }
            };
        }

        if (!group.material) {
            group.material = {
                dispose: function() {
                    group.traverse(child => {
                        if (child.isMesh && child.material && child.material !== this) {
                            if (Array.isArray(child.material)) child.material.forEach(m => m && m.dispose());
                            else child.material.dispose();
                        }
                    });
                }
            };
        }

        return group;
    }

    /**
     * Procedural Pineapple HE Grenade (M67 / Mk 2 Pineapple hybrid)
     */
    function createHEGrenadeMesh() {
        const group = new THREE.Group();
        const textures = [];

        // Pineapple segmentation canvas texture
        let castIronTex = null;
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 256; canvas.height = 256;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#3a4428';
                ctx.fillRect(0, 0, 256, 256);
                // Fragmentation grid grooves
                ctx.strokeStyle = '#1a1f12';
                ctx.lineWidth = 6;
                for (let x = 0; x <= 256; x += 32) {
                    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 256); ctx.stroke();
                }
                for (let y = 0; y <= 256; y += 32) {
                    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(256, y); ctx.stroke();
                }
                // Cast iron noise
                const img = ctx.getImageData(0, 0, 256, 256);
                for (let i = 0; i < img.data.length; i += 4) {
                    const n = (Math.random() - 0.5) * 30;
                    img.data[i] = Math.max(0, Math.min(255, img.data[i] + n));
                    img.data[i+1] = Math.max(0, Math.min(255, img.data[i+1] + n));
                    img.data[i+2] = Math.max(0, Math.min(255, img.data[i+2] + n));
                }
                ctx.putImageData(img, 0, 0);
                castIronTex = new THREE.CanvasTexture(canvas);
                textures.push(castIronTex);
            }
        }

        const bodyMat = new THREE.MeshStandardMaterial({
            color: 0x4a5d34,
            map: castIronTex,
            roughness: 0.85,
            metalness: 0.25
        });

        // 1. Segmented pineapple body
        const bodyGeo = new THREE.SphereGeometry(0.20, 16, 12);
        const body = new THREE.Mesh(bodyGeo, bodyMat);
        body.scale.set(1.0, 1.25, 1.0);
        body.castShadow = true;
        group.add(body);

        // 2. Fuze collar
        const fuzeMat = new THREE.MeshStandardMaterial({ color: 0x2e3528, roughness: 0.5, metalness: 0.7 });
        const collarGeo = new THREE.CylinderGeometry(0.065, 0.08, 0.08, 12);
        const collar = new THREE.Mesh(collarGeo, fuzeMat);
        collar.position.y = 0.26;
        group.add(collar);

        // 3. Safety Spoon Lever
        const spoonMat = new THREE.MeshStandardMaterial({ color: 0x444d38, roughness: 0.6, metalness: 0.6 });
        const spoonGeo = new THREE.BoxGeometry(0.045, 0.36, 0.015);
        const spoon = new THREE.Mesh(spoonGeo, spoonMat);
        spoon.position.set(0.13, 0.12, 0);
        spoon.rotation.z = -0.22;
        group.add(spoon);

        // 4. Pull Ring and Cotter Pin
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.2, metalness: 0.9 });
        const ringGeo = new THREE.TorusGeometry(0.045, 0.007, 8, 16);
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(-0.08, 0.27, 0);
        ring.rotation.y = Math.PI / 4;
        group.add(ring);

        group.userData = { textures };
        return attachDisposalProxies(group);
    }

    /**
     * Procedural Cryo Grenade (Cryogenic Vacuum Flask with Valve & Gauge)
     */
    function createCryoGrenadeMesh() {
        const group = new THREE.Group();
        const textures = [];

        // Brushed cryogenic metal canister
        const canisterMat = new THREE.MeshStandardMaterial({
            color: 0x00d4ff,
            roughness: 0.25,
            metalness: 0.85,
            emissive: 0x002233
        });

        // 1. Double-walled vacuum canister body
        const bodyGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.36, 16);
        const body = new THREE.Mesh(bodyGeo, canisterMat);
        body.castShadow = true;
        group.add(body);

        // 2. Insulated silicone shock bumpers (top and bottom rings)
        const bumperMat = new THREE.MeshStandardMaterial({ color: 0x1a2634, roughness: 0.8 });
        const bumperTop = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 8, 16), bumperMat);
        bumperTop.rotation.x = Math.PI / 2;
        bumperTop.position.y = 0.16;
        group.add(bumperTop);

        const bumperBottom = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.016, 8, 16), bumperMat);
        bumperBottom.rotation.x = Math.PI / 2;
        bumperBottom.position.y = -0.16;
        group.add(bumperBottom);

        // 3. High-pressure Relief Valve Nozzle
        const valveMat = new THREE.MeshStandardMaterial({ color: 0xc8a14a, roughness: 0.35, metalness: 0.8 });
        const valveGeo = new THREE.CylinderGeometry(0.045, 0.065, 0.09, 10);
        const valve = new THREE.Mesh(valveGeo, valveMat);
        valve.position.y = 0.22;
        group.add(valve);

        const nozzleGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.05, 8);
        const nozzle = new THREE.Mesh(nozzleGeo, valveMat);
        nozzle.rotation.z = Math.PI / 2;
        nozzle.position.set(0.06, 0.23, 0);
        group.add(nozzle);

        // 4. Analog Pressure Gauge Dial
        let gaugeTex = null;
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            canvas.width = 128; canvas.height = 128;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = '#ffffff';
                ctx.beginPath(); ctx.arc(64, 64, 60, 0, Math.PI * 2); ctx.fill();
                // Outer ring
                ctx.strokeStyle = '#222222'; ctx.lineWidth = 6; ctx.stroke();
                // Warning arc (red high pressure zone)
                ctx.strokeStyle = '#e74c3c'; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(64, 64, 46, -Math.PI * 0.3, Math.PI * 0.4); ctx.stroke();
                // Safe arc (cyan cryo zone)
                ctx.strokeStyle = '#00bcd4'; ctx.lineWidth = 10;
                ctx.beginPath(); ctx.arc(64, 64, 46, Math.PI * 0.5, Math.PI * 1.5); ctx.stroke();
                // Needle pointing into red zone
                ctx.strokeStyle = '#111111'; ctx.lineWidth = 4;
                ctx.beginPath(); ctx.moveTo(64, 64); ctx.lineTo(92, 46); ctx.stroke();
                // Center pin
                ctx.fillStyle = '#e74c3c';
                ctx.beginPath(); ctx.arc(64, 64, 7, 0, Math.PI * 2); ctx.fill();
                gaugeTex = new THREE.CanvasTexture(canvas);
                textures.push(gaugeTex);
            }
        }

        const gaugeGeo = new THREE.CircleGeometry(0.045, 16);
        const gaugeMat = new THREE.MeshBasicMaterial({ map: gaugeTex, color: gaugeTex ? 0xffffff : 0x00e5ff });
        const gauge = new THREE.Mesh(gaugeGeo, gaugeMat);
        gauge.position.set(0, 0.06, 0.142);
        group.add(gauge);

        group.userData = { textures };
        return attachDisposalProxies(group);
    }

    /**
     * Procedural Flashbang (M84 Ported Stun Canister)
     */
    function createFlashbangMesh() {
        const group = new THREE.Group();

        // 1. Main Aluminum Cylinder Body
        const aluMat = new THREE.MeshStandardMaterial({
            color: 0xb0b5b8,
            roughness: 0.35,
            metalness: 0.85
        });
        const bodyGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.34, 16);
        const body = new THREE.Mesh(bodyGeo, aluMat);
        body.castShadow = true;
        group.add(body);

        // 2. Blast Venting Holes (Perforated vents on canister surface)
        const ventMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
        const holeGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.25, 8);
        for (let i = 0; i < 4; i++) {
            const hole1 = new THREE.Mesh(holeGeo, ventMat);
            hole1.position.y = 0.06;
            hole1.rotation.y = (i * Math.PI) / 4;
            hole1.rotation.x = Math.PI / 2;
            group.add(hole1);

            const hole2 = new THREE.Mesh(holeGeo, ventMat);
            hole2.position.y = -0.06;
            hole2.rotation.y = (i * Math.PI) / 4 + Math.PI / 8;
            hole2.rotation.x = Math.PI / 2;
            group.add(hole2);
        }

        // 3. Blue identification warning band
        const bandMat = new THREE.MeshStandardMaterial({ color: 0x1565c0, roughness: 0.4 });
        const bandGeo = new THREE.CylinderGeometry(0.122, 0.122, 0.04, 16);
        const band = new THREE.Mesh(bandGeo, bandMat);
        band.position.y = 0.13;
        group.add(band);

        // 4. Top fuze & spoon assembly
        const fuzeMat = new THREE.MeshStandardMaterial({ color: 0x4a4f55, roughness: 0.4, metalness: 0.8 });
        const fuzeGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.07, 12);
        const fuze = new THREE.Mesh(fuzeGeo, fuzeMat);
        fuze.position.y = 0.20;
        group.add(fuze);

        const spoonGeo = new THREE.BoxGeometry(0.04, 0.30, 0.012);
        const spoon = new THREE.Mesh(spoonGeo, fuzeMat);
        spoon.position.set(0.09, 0.08, 0);
        spoon.rotation.z = -0.16;
        group.add(spoon);

        return attachDisposalProxies(group);
    }

    /**
     * Procedural Molotov Cocktail (Glass bottle + gasoline + cloth rag wick)
     */
    function createMolotovMesh() {
        const group = new THREE.Group();

        // 1. Amber/Green Glass Bottle Body
        const glassMat = new THREE.MeshStandardMaterial({
            color: 0x7c4718,
            transparent: true,
            opacity: 0.75,
            roughness: 0.15,
            metalness: 0.1
        });

        const bottleBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.24, 12), glassMat);
        bottleBase.castShadow = true;
        group.add(bottleBase);

        // Bottle shoulder / tapered neck
        const shoulder = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.09, 12, 1, true), glassMat);
        shoulder.position.y = 0.16;
        group.add(shoulder);

        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 12), glassMat);
        neck.position.y = 0.24;
        group.add(neck);

        // 2. Liquid flammable fuel level inside bottle
        const fuelMat = new THREE.MeshStandardMaterial({
            color: 0xe67e22,
            roughness: 0.2,
            metalness: 0.0,
            emissive: 0x441100
        });
        const fuel = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.12, 0.16, 12), fuelMat);
        fuel.position.y = -0.03;
        group.add(fuel);

        // 3. Rag wick stuffed in bottle neck
        const ragMat = new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.9 });
        const rag = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 0.15, 8), ragMat);
        rag.position.set(0.02, 0.32, 0);
        rag.rotation.z = 0.25;
        group.add(rag);

        // Charred burning wick tip with bright ember
        const emberMat = new THREE.MeshBasicMaterial({ color: 0xff4500 });
        const ember = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 8), emberMat);
        ember.position.set(0.045, 0.38, 0);
        group.add(ember);

        return attachDisposalProxies(group);
    }

    /**
     * Procedural Smoke Canister (M18 Military Smoke Grenade)
     */
    function createSmokeGrenadeMesh() {
        const group = new THREE.Group();

        // 1. Cylindrical steel canister body
        const smokeMat = new THREE.MeshStandardMaterial({
            color: 0x788075,
            roughness: 0.65,
            metalness: 0.4
        });
        const bodyGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.34, 16);
        const body = new THREE.Mesh(bodyGeo, smokeMat);
        body.castShadow = true;
        group.add(body);

        // 2. Top and Bottom rolled seam rims
        const rimMat = new THREE.MeshStandardMaterial({ color: 0x555c52, roughness: 0.5, metalness: 0.6 });
        const rimTop = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 16), rimMat);
        rimTop.position.y = 0.17;
        group.add(rimTop);

        const rimBottom = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.02, 16), rimMat);
        rimBottom.position.y = -0.17;
        group.add(rimBottom);

        // 3. Smoke Emission Vent Ports on top lid
        const ventMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
        for (let i = 0; i < 4; i++) {
            const vent = new THREE.Mesh(new THREE.CircleGeometry(0.02, 8), ventMat);
            vent.rotation.x = -Math.PI / 2;
            const ang = (i * Math.PI) / 2;
            vent.position.set(Math.cos(ang) * 0.07, 0.181, Math.sin(ang) * 0.07);
            group.add(vent);
        }

        // 4. Fuze mechanism
        const fuzeMat = new THREE.MeshStandardMaterial({ color: 0x3d423a, roughness: 0.5, metalness: 0.7 });
        const fuze = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.06, 10), fuzeMat);
        fuze.position.y = 0.20;
        group.add(fuze);

        const spoon = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.26, 0.012), fuzeMat);
        spoon.position.set(0.09, 0.09, 0);
        spoon.rotation.z = -0.15;
        group.add(spoon);

        return attachDisposalProxies(group);
    }

    /**
     * Procedural Disc-Shaped Landmine (Throwable projectile)
     */
    function createMineMesh() {
        const group = new THREE.Group();

        // 1. Disc-shaped casing (tapered bevels)
        const mineMat = new THREE.MeshStandardMaterial({
            color: 0x2e3b2e,
            roughness: 0.6,
            metalness: 0.5
        });
        const bodyGeo = new THREE.CylinderGeometry(0.22, 0.26, 0.10, 16);
        const body = new THREE.Mesh(bodyGeo, mineMat);
        body.castShadow = true;
        group.add(body);

        // 2. Central Pressure Plate Sensor
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x1e261e, roughness: 0.8, metalness: 0.2 });
        const plateGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.025, 16);
        const plate = new THREE.Mesh(plateGeo, plateMat);
        plate.position.y = 0.055;
        group.add(plate);

        // 3. Central Armed Blinking Optical LED Beacon
        const ledMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const ledGeo = new THREE.SphereGeometry(0.035, 8, 8);
        const led = new THREE.Mesh(ledGeo, ledMat);
        led.position.y = 0.075;
        group.add(led);

        // 4. Anti-tamper perimeter notch grooves
        const notchMat = new THREE.MeshBasicMaterial({ color: 0x111611 });
        for (let i = 0; i < 6; i++) {
            const notch = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.11, 0.04), notchMat);
            const ang = (i * Math.PI) / 3;
            notch.position.set(Math.cos(ang) * 0.24, 0, Math.sin(ang) * 0.24);
            notch.rotation.y = -ang;
            group.add(notch);
        }

        return attachDisposalProxies(group);
    }

    /**
     * Unified Procedural Grenade Mesh Factory
     * 
     * @param {string} type Grenade identifier: 'hegrenade'|'cryo'|'flashbang'|'molotov'|'smoke'|'mine'
     * @returns {THREE.Group}
     */
    function createProceduralGrenade(type) {
        switch (type) {
            case 'hegrenade':
                return createHEGrenadeMesh();
            case 'cryo':
                return createCryoGrenadeMesh();
            case 'flashbang':
                return createFlashbangMesh();
            case 'molotov':
                return createMolotovMesh();
            case 'smoke':
                return createSmokeGrenadeMesh();
            case 'mine':
                return createMineMesh();
            default:
                return createHEGrenadeMesh();
        }
    }

    function disposeGrenadeHierarchy(mesh) {
        if (!mesh) return;
        if (typeof mesh.dispose === 'function') {
            mesh.dispose();
        } else if (typeof mesh.traverse === 'function') {
            mesh.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) {
                        if (Array.isArray(child.material)) child.material.forEach(m => m && m.dispose());
                        else child.material.dispose();
                    }
                }
            });
        }
    }

    const TacticalGrenadeComponent = {
        createGrenade: createProceduralGrenade,
        createProceduralGrenade,
        createHEGrenadeMesh,
        createCryoGrenadeMesh,
        createFlashbangMesh,
        createMolotovMesh,
        createSmokeGrenadeMesh,
        createMineMesh,
        disposeGrenadeHierarchy
    };

    root.TacticalGrenadeComponent = TacticalGrenadeComponent;
    root.createProceduralGrenade = createProceduralGrenade;
    if (typeof root.disposeGrenadeHierarchy === 'undefined') {
        root.disposeGrenadeHierarchy = disposeGrenadeHierarchy;
    }

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalGrenadeComponent;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
