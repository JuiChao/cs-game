// #region 地图构建
let gameInitialized = false;

// 生化模式: 高台守点列表（buildBiolabMap 填充，其他地图为空）
let platformSpots = [];

const MAP_LIGHTING_CONFIGS = {
    dust2: {
        sky: 0x87CEEB,
        fogNear: 120, fogFar: 500,
        hemiSky: 0xb0e0ff, hemiGround: 0xd7b48c, hemiIntensity: 0.85,
        dirColor: 0xfffaed, dirIntensity: 0.95, dirPos: [120, 220, 80],
        dustColor: 0xf5d996, dustOpacity: 0.08
    },
    inferno: {
        sky: 0x87CEEB,
        fogNear: 120, fogFar: 520,
        hemiSky: 0xb0e0ff, hemiGround: 0xd7b48c, hemiIntensity: 0.85,
        dirColor: 0xfffaed, dirIntensity: 0.95, dirPos: [160, 180, 110],
        dustColor: 0xffb366, dustOpacity: 0.08
    },
    biolab: {
        sky: 0x1a2621,
        fogNear: 90, fogFar: 450,
        hemiSky: 0x4ef0af, hemiGround: 0x0f1a14, hemiIntensity: 0.55,
        dirColor: 0x80ffcc, dirIntensity: 0.70, dirPos: [40, 160, 40],
        dustColor: 0x00ff88, dustOpacity: 0.11
    },
    shootingRange: {
        sky: 0x87CEEB,
        fogNear: 120, fogFar: 500,
        hemiSky: 0xb0e0ff, hemiGround: 0xd7b48c, hemiIntensity: 0.85,
        dirColor: 0xffffff, dirIntensity: 0.95, dirPos: [0, 140, -50],
        dustColor: 0x88ccff, dustOpacity: 0.06
    }
};

function updateSceneLighting(mapId) {
    const isSR = typeof isShootingRange !== 'undefined' && isShootingRange;
    const cfg = isSR ? MAP_LIGHTING_CONFIGS.shootingRange : (MAP_LIGHTING_CONFIGS[mapId] || MAP_LIGHTING_CONFIGS.dust2);
    
    // Sky & Fog
    scene.background = new THREE.Color(cfg.sky);
    scene.fog = new THREE.Fog(cfg.sky, cfg.fogNear, cfg.fogFar);
    
    // Hemisphere Light
    if (hemiLight) {
        hemiLight.color.setHex(cfg.hemiSky);
        hemiLight.groundColor.setHex(cfg.hemiGround);
        hemiLight.intensity = cfg.hemiIntensity;
    }
    
    // Directional Light
    if (dirLight) {
        dirLight.color.setHex(cfg.dirColor);
        dirLight.intensity = cfg.dirIntensity;
        dirLight.position.set(cfg.dirPos[0], cfg.dirPos[1], cfg.dirPos[2]);
    }

    // Base Ambient Light
    if (baseAmbientLight) {
        baseAmbientLight.intensity = (mapId === 'biolab' && !isSR) ? 0.25 : 0.45;
    }
    
    // Atmospheric Dust Motes
    if (dustMotePoints && dustMotePoints.material) {
        dustMotePoints.material.color.setHex(cfg.dustColor);
        dustMotePoints.material.opacity = cfg.dustOpacity;
    }
}

function initAtmosphericDustMotes() {
    if (dustMotePoints) return;
    for (let i = 0; i < DUST_MOTE_COUNT; i++) {
        const i3 = i * 3;
        let mx = (Math.random() - 0.5) * 80;
        let mz = (Math.random() - 0.5) * 80;
        if (Math.hypot(mx, mz) < 4.5) {
            const angle = Math.random() * Math.PI * 2;
            mx = Math.cos(angle) * (4.5 + Math.random() * 5);
            mz = Math.sin(angle) * (4.5 + Math.random() * 5);
        }
        motePositions[i3] = mx;
        motePositions[i3 + 1] = Math.random() * 20 + 0.5;
        motePositions[i3 + 2] = mz;
        moteVelocities[i3] = (Math.random() - 0.5) * 0.3;
        moteVelocities[i3 + 1] = Math.random() * 0.15 - 0.05;
        moteVelocities[i3 + 2] = (Math.random() - 0.5) * 0.3;
        motePhases[i] = Math.random() * Math.PI * 2;
    }
    
    const moteGeo = new THREE.BufferGeometry();
    moteGeo.setAttribute('position', new THREE.BufferAttribute(motePositions, 3));
    
    // Procedural soft circular particle sprite
    const c = document.createElement('canvas');
    c.width = 32; c.height = 32;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
    g.addColorStop(0.35, 'rgba(255, 255, 255, 0.3)');
    g.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 32);
    const moteTex = new THREE.CanvasTexture(c);
    
    const moteMat = new THREE.PointsMaterial({
        size: 0.07,
        map: moteTex,
        transparent: true,
        opacity: 0.10,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });
    
    dustMotePoints = new THREE.Points(moteGeo, moteMat);
    dustMotePoints.frustumCulled = false;
    dustMotePoints.name = 'dustMotes';
    scene.add(dustMotePoints);
}

function init3DGame() {
    if (!gameInitialized) {
        const container = document.getElementById('canvas-container');
        container.innerHTML = ''; 

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        scene.fog = new THREE.Fog(0x87CEEB, 120, 500);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);
        scene.add(camera);

        // 1. Dual-Bounce Ambient Hemisphere Light (F16)
        hemiLight = new THREE.HemisphereLight(0x90caf9, 0xd7b48c, 0.65);
        hemiLight.name = 'hemiLight';
        scene.add(hemiLight);

        // Base Gentle Ambient (fill in deepest crevices)
        baseAmbientLight = new THREE.AmbientLight(0xffffff, 0.45);
        baseAmbientLight.name = 'baseAmbientLight';
        scene.add(baseAmbientLight);

        // 2. Soft Directional Light with Acne Prevention (F16)
        dirLight = new THREE.DirectionalLight(0xfffaed, 0.85);
        dirLight.position.set(120, 220, 80);
        dirLight.castShadow = true;
        const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches);
        const shadowRes = isTouch ? 512 : 1024;
        dirLight.shadow.mapSize.width = shadowRes;
        dirLight.shadow.mapSize.height = shadowRes;
        dirLight.shadow.camera.near = 10;
        dirLight.shadow.camera.far = 600;
        const d = 320;
        dirLight.shadow.camera.left = -d;
        dirLight.shadow.camera.right = d;
        dirLight.shadow.camera.top = d;
        dirLight.shadow.camera.bottom = -d;
        dirLight.shadow.bias = -0.0004;
        dirLight.shadow.normalBias = 0.05;
        dirLight.shadow.radius = 2.0;
        scene.add(dirLight);

        // 3. Transient Player Weapon Muzzle Flash Light (F17)
        playerMuzzleLight = new THREE.PointLight(0xffaa33, 0, 16, 2);
        playerMuzzleLight.name = 'playerMuzzleLight';
        playerMuzzleLight.castShadow = false;
        playerMuzzleLight.position.set(0.35, -0.25, -0.8);
        camera.add(playerMuzzleLight);

        // 4. Transient Bot Muzzle Flash Light (F17)
        botMuzzleLight = new THREE.PointLight(0xff8822, 0, 14, 2);
        botMuzzleLight.name = 'botMuzzleLight';
        botMuzzleLight.castShadow = false;
        scene.add(botMuzzleLight);

        renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
        const dpr = Math.min(window.devicePixelRatio || 1, 1.0);
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(renderer.domElement);

        // 5. Atmospheric Dust Motes (F17)
        initAtmosphericDustMotes();

        // 6. Postprocessing Pipeline (F13, F14, F15, F18)
        if (typeof initPostprocessing === 'function') {
            initPostprocessing(renderer, scene, camera, window.innerWidth, window.innerHeight);
        }

        const knifeRange = WEAPONS.knife.range;
        const knifeRingGeo = new THREE.RingGeometry(knifeRange * 0.9, knifeRange, 32);
        const knifeRingMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
        knifeRangeIndicator = new THREE.Mesh(knifeRingGeo, knifeRingMat);
        knifeRangeIndicator.rotation.x = -Math.PI / 2; // Flat on ground
        knifeRangeIndicator.visible = false;
        scene.add(knifeRangeIndicator);

        const predRingGeo = new THREE.RingGeometry(0.5, 0.7, 32);
        const predRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: 0.8, depthTest: false });
        predictionMarker = new THREE.Mesh(predRingGeo, predRingMat);
        predictionMarker.visible = false;
        predictionMarker.renderOrder = 999;
        scene.add(predictionMarker);

        if (typeof THREE.PointerLockControls === 'undefined') {
            THREE.PointerLockControls = class extends THREE.EventDispatcher {
                constructor(cam, domEl) {
                    super();
                    this.domElement = domEl || document.body;
                    this.isLocked = false;
                    this.minPolarAngle = 0;
                    this.maxPolarAngle = Math.PI;
                    const scope = this;
                    const _euler = new THREE.Euler(0, 0, 0, 'YXZ');
                    const _PI_2 = Math.PI / 2;

                    function onMouseMove(event) {
                        if (!scope.isLocked) return;
                        const movementX = event.movementX || event.mozMovementX || event.webkitMovementX || 0;
                        const movementY = event.movementY || event.mozMovementY || event.webkitMovementY || 0;
                        _euler.setFromQuaternion(cam.quaternion);
                        _euler.y -= movementX * 0.002;
                        _euler.x -= movementY * 0.002;
                        _euler.x = Math.max(_PI_2 - scope.maxPolarAngle, Math.min(_PI_2 - scope.minPolarAngle, _euler.x));
                        cam.quaternion.setFromEuler(_euler);
                        scope.dispatchEvent({ type: 'change' });
                    }

                    function onPointerlockChange() {
                        const ple = scope.domElement.ownerDocument.pointerLockElement;
                        if (ple) {
                            scope.isLocked = true;
                            scope.dispatchEvent({ type: 'lock' });
                        } else {
                            scope.isLocked = false;
                            scope.dispatchEvent({ type: 'unlock' });
                        }
                    }

                    this.connect = function() {
                        document.addEventListener('mousemove', onMouseMove);
                        document.addEventListener('pointerlockchange', onPointerlockChange);
                    };
                    this.disconnect = function() {
                        document.removeEventListener('mousemove', onMouseMove);
                        document.removeEventListener('pointerlockchange', onPointerlockChange);
                    };
                    this.lock = function() {
                        if (this.domElement && typeof this.domElement.requestPointerLock === 'function') {
                            this.domElement.requestPointerLock();
                        } else {
                            document.body.requestPointerLock();
                        }
                    };
                    this.unlock = function() {
                        if (document.exitPointerLock) document.exitPointerLock();
                    };
                    this.connect();
                }
            };
        }

        controls = new THREE.PointerLockControls(camera, document.body);

        function shouldAutoLockPointer() {
            if (typeof window === 'undefined') return false;
            const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 768 || window.innerWidth <= 768;
            const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
            const isMobileDevice = (typeof navigator !== 'undefined') && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

            if (typeof isTouchDevice !== 'undefined' && isTouchDevice) {
                if ((isSmallScreen && !hasFinePointer) || isMobileDevice) {
                    return false;
                }
            }
            return true;
        }
        window.shouldAutoLockPointer = shouldAutoLockPointer;
        
        function updatePointerLockPrompt() {
            const prompt = document.getElementById('pointer-lock-prompt');
            if (!prompt) return;
            if (!roundActive || playerState.isSpectating || !shouldAutoLockPointer()) {
                prompt.classList.add('hidden');
                return;
            }
            const buyMenu = document.getElementById('buy-menu');
            const scopePanel = document.getElementById('scope-panel');
            const mainMenu = document.getElementById('main-menu');
            const resultScreen = document.getElementById('result-screen');
            const mortarMap = document.getElementById('mortar-map-overlay');
            const isMenuOpen = (buyMenu && !buyMenu.classList.contains('hidden')) ||
                               (scopePanel && !scopePanel.classList.contains('hidden')) ||
                               (mainMenu && mainMenu.classList.contains('active')) ||
                               (resultScreen && !resultScreen.classList.contains('hidden')) ||
                               (mortarMap && !mortarMap.classList.contains('hidden'));
            if (!isMenuOpen && controls && !controls.isLocked && !document.pointerLockElement) {
                prompt.classList.remove('hidden');
            } else {
                prompt.classList.add('hidden');
            }
        }
        window.updatePointerLockPrompt = updatePointerLockPrompt;

        controls.addEventListener('lock', () => {
            const prompt = document.getElementById('pointer-lock-prompt');
            if (prompt) prompt.classList.add('hidden');
        });

        controls.addEventListener('unlock', () => {
            if (typeof resetInputState === 'function') resetInputState();
            updatePointerLockPrompt();
        });
        
        document.addEventListener('pointerlockchange', () => {
            const hasLock = Boolean(document.pointerLockElement);
            if (controls) {
                controls.isLocked = hasLock;
            }
            updatePointerLockPrompt();
        });

        document.addEventListener('pointerlockerror', () => {
            updatePointerLockPrompt();
        });
        
        isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || window.matchMedia("(pointer: coarse)").matches;
        
        function tryLockPointer() {
            if (!roundActive || playerState.isSpectating) return;
            if (document.pointerLockElement) {
                if (controls) controls.isLocked = true;
                return;
            }
            const buyMenu = document.getElementById('buy-menu');
            const scopePanel = document.getElementById('scope-panel');
            const mainMenu = document.getElementById('main-menu');
            const resultScreen = document.getElementById('result-screen');
            const mortarMap = document.getElementById('mortar-map-overlay');
            if (buyMenu && !buyMenu.classList.contains('hidden')) return;
            if (scopePanel && !scopePanel.classList.contains('hidden')) return;
            if (mainMenu && mainMenu.classList.contains('active')) return;
            if (resultScreen && !resultScreen.classList.contains('hidden')) return;
            if (mortarMap && !mortarMap.classList.contains('hidden')) return;
            if (controls && typeof controls.lock === 'function') {
                try {
                    if (document.activeElement && typeof document.activeElement.blur === 'function') {
                        document.activeElement.blur();
                    }
                    const res = controls.lock();
                    if (res && typeof res.catch === 'function') res.catch(() => {});
                } catch (e) {
                    try { 
                        const res2 = document.body.requestPointerLock(); 
                        if (res2 && typeof res2.catch === 'function') res2.catch(() => {});
                    } catch (e2) {}
                }
            }
        }
        window.tryLockPointer = tryLockPointer;

        container.addEventListener('click', tryLockPointer);
        const gameScreenEl = document.getElementById('game-screen');
        if (gameScreenEl) {
            gameScreenEl.addEventListener('click', (e) => {
                if (e.target && (e.target.closest('#buy-menu') || e.target.closest('#scope-panel') || e.target.closest('#result-screen') || e.target.closest('#mortar-map-overlay'))) {
                    return;
                }
                tryLockPointer();
            });
            gameScreenEl.addEventListener('pointerdown', (e) => {
                if (e.target && (e.target.closest('#buy-menu') || e.target.closest('#scope-panel') || e.target.closest('#result-screen') || e.target.closest('#mortar-map-overlay'))) {
                    return;
                }
                if (e.pointerType === 'mouse' && controls && !controls.isLocked) {
                    tryLockPointer();
                }
            });
        }
        const promptEl = document.getElementById('pointer-lock-prompt');
        if (promptEl) {
            promptEl.addEventListener('click', tryLockPointer);
            promptEl.addEventListener('pointerdown', tryLockPointer);
        }
        
        document.getElementById('buy-menu').addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        
        rebuildMap();
        
        clock = new THREE.Clock();
        raycaster = new THREE.Raycaster();
        
        if (isTouchDevice) {
            setupTouchControls();
        }

        gameInitialized = true;
        requestAnimationFrame(animate);
    } else {
        rebuildMap();
    }
    resetRound();
}

function rebuildMap() {
    // Remove old map meshes
    for (let i = scene.children.length - 1; i >= 0; i--) {
        let child = scene.children[i];
        if (child.name === 'wall' || child.name === 'floor' || child.name === 'roof' || child.name === 'bombSite' || child.name === 'navGrid') {
            scene.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
                } else {
                    if (child.material.map) child.material.map.dispose();
                    child.material.dispose();
                }
            }
        }
    }

    // Dynamic map-specific lighting, sky, fog, and dust motes (F16, F17)
    updateSceneLighting(currentMap);

    if (isShootingRange) {
        buildShootingRangeMap();
    } else {
        if (currentMap === 'inferno') {
            buildInfernoMap();
        } else if (currentMap === 'biolab') {
            buildBiolabMap();
        } else {
            buildLargeMap();
        }
        buildNavGrid();
    }
    
    collidableMeshList = [];
    scene.children.forEach(child => {
        if (child.name === 'wall') {
            child.worldBox = new THREE.Box3().setFromObject(child);
            collidableMeshList.push(child);
        }
        if (child.name === 'floor') {
            child.receiveShadow = true;
        } else if (child.name === 'wall' || child.name === 'roof' || child.name === 'bombSite' || child.name === 'box' || child.name === 'door') {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
    if (typeof rebuildBulletSpatialGrid === 'function') {
        rebuildBulletSpatialGrid();
    }
}

function buildShootingRangeMap() {
    // Floor Texture (procedural stone)
    const floorTex = createProceduralTexture('stone');
    floorTex.repeat.set(5, 20);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.8 });

    const floorGeo = new THREE.PlaneGeometry(50, 300);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -100;
    floor.name = 'floor';
    scene.add(floor);

    // Wall Material
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9 }); 

    const createWall = (x, z, w, d, h = 10) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const wall = new THREE.Mesh(geo, wallMat);
        wall.position.set(x, h/2, z);
        wall.name = 'wall';
        scene.add(wall);
    };
    
    // Back wall
    createWall(0, 50, 50, 2);
    // Left wall
    createWall(-25, -100, 2, 300);
    // Right wall
    createWall(25, -100, 2, 300);
    // Front wall (deep into range)
    createWall(0, -250, 50, 2);
}

function getValidSpawnPoint(existingPoints, minDist = 80, area = null) {
    for (let i = 0; i < 500; i++) {
        let x, z;
        if (area) {
            x = area.minX + Math.random() * (area.maxX - area.minX);
            z = area.minZ + Math.random() * (area.maxZ - area.minZ);
        } else {
            x = (Math.random() - 0.5) * 750;
            z = (Math.random() - 0.5) * 750;
        }
        let valid = true;
        
        for (let pt of existingPoints) {
            let dx = pt.x - x;
            let dz = pt.z - z;
            if (Math.sqrt(dx*dx + dz*dz) < minDist) {
                valid = false;
                break;
            }
        }
        if (!valid) continue;
        
        let box = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(x, 5, z), new THREE.Vector3(20, 30, 20)); // Large safe zone to account for squad offset
        for (let mesh of collidableMeshList) {
            let meshBox = mesh.worldBox;
            if (box.intersectsBox(meshBox)) {
                valid = false;
                break;
            }
        }
        if (valid) return {x, z};
    }
    if (area) {
        return { x: area.minX + Math.random() * (area.maxX - area.minX), z: area.minZ + Math.random() * (area.maxZ - area.minZ) };
    }
    return {x: (Math.random() - 0.5) * 700, z: (Math.random() - 0.5) * 700};
}

function resetRound() {
    isReloading = false;
    if (typeof reloadTimer !== 'undefined' && reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
    if (typeof droppedMagazines !== 'undefined' && droppedMagazines) {
        droppedMagazines.forEach(m => {
            scene.remove(m.mesh);
            if (m.mesh.geometry) m.mesh.geometry.dispose();
            if (m.mesh.material) {
                if (Array.isArray(m.mesh.material)) m.mesh.material.forEach(mat => mat.dispose());
                else m.mesh.material.dispose();
            }
        });
        droppedMagazines.length = 0;
    }
    if (typeof floatingDamages !== 'undefined' && floatingDamages) {
        floatingDamages.forEach(fd => {
            if (fd.elem) {
                if (typeof fd.elem.remove === 'function') fd.elem.remove();
                else if (fd.elem.parentNode) fd.elem.parentNode.removeChild(fd.elem);
            }
        });
        floatingDamages.length = 0;
    }
    const dmgNumbers = document.getElementById('damage-numbers');
    if (dmgNumbers) dmgNumbers.innerHTML = '';

    // Dispose all GPU resources before clearing arrays
    if (bots) bots.forEach(b => {
        scene.remove(b.mesh);
        b.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); }
            }
        });
    });
    if (bullets) bullets.forEach(b => { disposeBulletMesh(b); scene.remove(b.mesh); });
    if (grenades) grenades.forEach(g => {
        scene.remove(g.mesh);
        if (g.mesh.geometry) g.mesh.geometry.dispose();
        if (g.mesh.material) g.mesh.material.dispose();
        if (g.circleMesh) {
            scene.remove(g.circleMesh);
            if (g.circleMesh.geometry) g.circleMesh.geometry.dispose();
            if (g.circleMesh.material) g.circleMesh.material.dispose();
        }
    });
    if (activeFires) activeFires.forEach(f => {
        scene.remove(f.mesh);
        if (f.mesh.geometry) f.mesh.geometry.dispose();
        if (f.mesh.material) f.mesh.material.dispose();
    });
    if (particles) particles.forEach(p => {
        scene.remove(p.mesh);
        if (p.mesh.geometry && p.mesh.geometry !== sharedParticleGeo && p.mesh.geometry !== sharedMuzzleGeo && p.mesh.geometry !== sharedFlameGeo) p.mesh.geometry.dispose();
        if (p.mesh.material && !p.isPooled && !p.mesh.material.isPooled) p.mesh.material.dispose();
        if (p.isPooled) p.inUse = false;
    });
    if (typeof particlePool !== 'undefined' && Array.isArray(particlePool)) {
        for (let i = 0; i < particlePool.length; i++) {
            const p = particlePool[i];
            if (p.mesh && p.mesh.parent) scene.remove(p.mesh);
            p.inUse = false;
        }
        if (typeof particlePoolFree !== 'undefined' && Array.isArray(particlePoolFree)) {
            particlePoolFree.length = 0;
            for (let i = 0; i < particlePool.length; i++) {
                particlePoolFree.push(particlePool[i]);
            }
        }
    }
    bombState.planted = false;
    if (bombState.mesh) {
        const idx = collidableMeshList.indexOf(bombState.mesh);
        if (idx !== -1) collidableMeshList.splice(idx, 1);
        scene.remove(bombState.mesh);
        bombState.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) { if (Array.isArray(child.material)) child.material.forEach(m => m.dispose()); else child.material.dispose(); }
            }
        });
        bombState.mesh = null;
    }
    bots = [];
    bullets = [];
    grenades = [];
    wallhackActive = false;
    activeFires = [];
    particles = [];
    playerState.killStreak = 0; // 新回合清零连杀
    // 清理无人机与玩家傀儡模型
    if (typeof removePlayerDummy === 'function') removePlayerDummy();
    if (typeof activeDrones !== 'undefined' && activeDrones.length > 0) {
        for (let i = activeDrones.length - 1; i >= 0; i--) {
            if (typeof destroyDrone === 'function') destroyDrone(activeDrones[i], false, true);
        }
        activeDrones = [];
    }
    if (typeof playerState !== 'undefined') {
        playerState.isControllingDrone = false;
        playerState.lastFlameDamageTick = 0;
        playerState.cameraShake = 0;
    }
    if (typeof cleanupMortar === 'function') cleanupMortar();
    else if (typeof cancelMortarCamera === 'function') cancelMortarCamera();
    // 清理地雷
    activeMines.forEach(m => removeMineMesh(m));
    activeMines = [];
    // 清理武器掉落
    if (weaponDrops) weaponDrops.forEach(d => {
        scene.remove(d.mesh);
        if (d.mesh.geometry) d.mesh.geometry.dispose();
        if (d.mesh.material) d.mesh.material.dispose();
    });
    weaponDrops = [];
    // 清理残留烟雾云
    if (activeSmokes) activeSmokes.forEach(s => {
        scene.remove(s.group);
        s.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    });
    activeSmokes = [];
    // 生化模式: 清理空投/路障/肾上腺素状态
    if (typeof cleanupZombieGear === 'function') cleanupZombieGear();
    if (typeof rebuildBulletSpatialGrid === 'function') rebuildBulletSpatialGrid();
    
    const spawnArea = MAP_SPAWN_AREAS[currentMap] || MAP_SPAWN_AREAS.dust2;
    let tSpawns = [];
    let ctSpawns = [];
    for (let i = 0; i < 5; i++) {
        tSpawns.push(getValidSpawnPoint(tSpawns, 40, spawnArea.t));
    }
    for (let i = 0; i < 5; i++) {
        ctSpawns.push(getValidSpawnPoint(ctSpawns, 40, spawnArea.ct));
    }
    
    if (isShootingRange) {
        camera.position.set(0, 2, 0);
        camera.rotation.set(0, 0, 0); // Looking -Z
    } else {
        if (playerState.team === 'T') {
            camera.position.set(tSpawns[0].x, 2, tSpawns[0].z);
            camera.rotation.set(0, Math.random() * Math.PI * 2, 0);
        } else {
            camera.position.set(ctSpawns[0].x, 2, ctSpawns[0].z);
            camera.rotation.set(0, Math.random() * Math.PI * 2, 0);
        }
    }
    
    playerState.spawnPos.copy(camera.position);
    
    buildViewModel();

    if (isShootingRange) {
        setupShootingRangeTargets();
    } else {
        spawnBots(ctSpawns, tSpawns);
    }

    playerState.hp = 100;
    playerState.isSpectating = false;
    document.getElementById('spectator-prompt').classList.add('hidden');

    // 生化模式回合重置: 玩家恢复人类身份，恢复感染时被没收的武器
    playerState.isZombie = false;
    playerState.isSource = false;
    playerState.maxHp = 100;
    playerState.zombieRespawnTimer = 0;
    playerState.zombieSlowTimer = 0;
    if (gameMode === 'zombie') {
        playerState.team = 'CT';
    }
    if (playerState.prevMelees) {
        inventory.melees = playerState.prevMelees;
        inventory.melee = (playerState.prevMelee && playerState.prevMelee !== 'zombieClaw') ? playerState.prevMelee : 'knife';
        inventory.primary = playerState.prevPrimary || null;
        inventory.secondary = playerState.prevSecondary || 'pistol';
        playerState.prevMelees = null;
    }
    if (playerState.isZombie === false && inventory.melee === 'zombieClaw') {
        inventory.melee = 'knife';
        inventory.melees = ['knife', 'kukri', 'switchblade'];
    }

    // Auto switch to primary if available
    if (inventory.primary) switchWeapon(1);
    else switchWeapon(2);

    bombState.planted = false;
    bombState.plantProgress = 0;
    bombState.timer = 60;

    // 每回合重置击杀统计（MVP 用）
    matchState.roundKills = { player: 0, myBots: 0, enemyBots: 0 };
    matchState.roundBestKiller = null;

    roundActive = true;
    frameCount = 0;
    playerState.lastShot = -1000;
    playerState.lastCombatTime = -1000;
    playerState.knifeComboStage = 0;
    playerState.lastKnifeSwingTime = 0;
    playerState.burnStacks = 0;
    playerState.burnTimer = 0;
    playerState.bulletType = 'normal';
    playerState.bulletStacking = false;
    playerState.bulletTypes = [];
    playerState.armorPlates = 0;
    playerState.gatlingFireStartFrame = 0;
    playerState.burstQueue = 0;
    playerState.burstWeapon = null;
    playerState.burstNextShot = 0;

    if (typeof showZombieFilter === 'function') showZombieFilter(false);
    const _zcd = document.getElementById('zombie-countdown');
    if (_zcd) _zcd.classList.add('hidden');
    const _s1 = document.getElementById('slot-1');
    if (_s1 && inventory.primary) _s1.classList.remove('hidden');
    const _s2 = document.getElementById('slot-2');
    if (_s2) _s2.classList.remove('hidden');
    const _s4 = document.getElementById('slot-4');
    if (_s4 && Object.values(inventory.grenades).some(v => v > 0)) _s4.classList.remove('hidden');
    const _sp2 = document.getElementById('spectator-prompt');
    if (_sp2) {
        const _spH2 = _sp2.querySelector('h2');
        if (_spH2) _spH2.innerText = '你已阵亡 (Spectating)';
    }

    if (typeof cleanupMortar === 'function') cleanupMortar();
    if (typeof updateArmorHUD === 'function') updateArmorHUD();
    
    document.getElementById('bomb-status').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('buy-prompt').classList.remove('hidden');
    setTimeout(() => { document.getElementById('buy-prompt').classList.add('hidden'); }, 10000);

    updateHUD();
    if (typeof updatePointerLockPrompt === 'function') updatePointerLockPrompt();
    if (typeof resetMinimapStaticCache === 'function') resetMinimapStaticCache();
}

// Procedural texture generation (replaces external CDN dependencies)
function createProceduralTexture(type) {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    
    if (type === 'sand') {
        // Sand-colored floor texture with noise
        ctx.fillStyle = '#c2a878';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 8000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const shade = Math.random();
            if (shade < 0.33) ctx.fillStyle = 'rgba(180,155,110,0.5)';
            else if (shade < 0.66) ctx.fillStyle = 'rgba(210,185,140,0.5)';
            else ctx.fillStyle = 'rgba(150,130,95,0.4)';
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (type === 'stone') {
        // Stone/brick wall texture
        ctx.fillStyle = '#6b6b6b';
        ctx.fillRect(0, 0, size, size);
        const brickW = 64, brickH = 32;
        for (let row = 0; row < size / brickH; row++) {
            const offset = row % 2 === 0 ? 0 : brickW / 2;
            for (let col = -1; col < size / brickW + 1; col++) {
                const x = col * brickW + offset;
                const y = row * brickH;
                const shade = 80 + Math.floor(Math.random() * 60);
                ctx.fillStyle = `rgb(${shade},${shade},${shade})`;
                ctx.fillRect(x + 1, y + 1, brickW - 2, brickH - 2);
            }
        }
        // Add noise
        for (let i = 0; i < 4000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
            ctx.fillRect(x, y, 2, 2);
        }
    } else if (type === 'grass') {
        // Grass/dirt ground texture for Inferno
        ctx.fillStyle = '#5a7042';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 9000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const shade = Math.random();
            if (shade < 0.33) ctx.fillStyle = 'rgba(70,95,55,0.5)';
            else if (shade < 0.66) ctx.fillStyle = 'rgba(90,120,68,0.5)';
            else ctx.fillStyle = 'rgba(50,75,40,0.4)';
            ctx.fillRect(x, y, 2, 2);
        }
        // Dirt patches
        for (let i = 0; i < 25; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            ctx.fillStyle = `rgba(130,105,72,${0.2 + Math.random() * 0.25})`;
            ctx.beginPath();
            ctx.arc(x, y, 4 + Math.random() * 12, 0, Math.PI * 2);
            ctx.fill();
        }
    } else if (type === 'plaster') {
        // Plaster wall texture (warm Mediterranean tones for Inferno)
        ctx.fillStyle = '#c4a882';
        ctx.fillRect(0, 0, size, size);
        for (let i = 0; i < 6000; i++) {
            const x = Math.random() * size;
            const y = Math.random() * size;
            const shade = Math.random();
            if (shade < 0.33) ctx.fillStyle = 'rgba(180,155,120,0.35)';
            else if (shade < 0.66) ctx.fillStyle = 'rgba(200,175,140,0.35)';
            else ctx.fillStyle = 'rgba(150,125,95,0.3)';
            ctx.fillRect(x, y, 3, 3);
        }
        // Cracks
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = `rgba(80,65,45,${0.15 + Math.random() * 0.2})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(Math.random() * size, 0);
            ctx.lineTo(Math.random() * size, size);
            ctx.stroke();
        }
    }
    
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    return texture;
}

function buildLargeMap() {
    // Floor Texture (procedural sand)
    const floorTex = createProceduralTexture('sand');
    floorTex.repeat.set(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 });

    const floorGeo = new THREE.PlaneGeometry(800, 800);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';
    scene.add(floor);

    // Wall Texture (procedural stone)
    let clonedWallMaterials = [];
    const wallTex = createProceduralTexture('stone');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }); 
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 }); 

    const createWall = (x, z, w, d, h = 30) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = wallMat.clone();
        mat.map = wallTex.clone();
        mat.map.repeat.set(Math.max(w, d) / 20, h / 20);
        clonedWallMaterials.push(mat);
        
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(x, h/2, z);
        wall.name = 'wall';
        scene.add(wall);
    };
    
    // Shared geometry and materials for boxes and doors (reduces draw calls and memory)
    const sharedBoxGeo = new THREE.BoxGeometry(10, 10, 10);
    const sharedDoorMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    
    const createBox = (x, z) => {
        const box = new THREE.Mesh(sharedBoxGeo, boxMat);
        box.position.set(x, 5, z);
        box.name = 'wall';
        scene.add(box);
    }
    
    const createDoor = (x, z, w, d) => {
        const geo = new THREE.BoxGeometry(w, 40, d);
        const door = new THREE.Mesh(geo, sharedDoorMat);
        door.position.set(x, 20, z);
        door.name = 'wall';
        scene.add(door);
    };

    // Outer bounds
    createWall(0, -400, 800, 4); // N
    createWall(0, 400, 800, 4);  // S
    createWall(-400, 0, 4, 800); // W
    createWall(400, 0, 4, 800);  // E
    
    // --- Dust II Abstract Layout ---
    
    // T Spawn Area (Bottom center)
    createWall(-100, 350, 4, 100);
    createWall(100, 350, 4, 100);
    
    // Mid (Center vertical corridor)
    createWall(-60, 150, 4, 300); // Mid left wall
    createWall(60, 200, 4, 200);  // Mid right wall
    
    // Mid Doors (Using gap instead of solid wall)
    createWall(-40, 0, 40, 4); 
    createWall(40, 0, 40, 4);
    createDoor(-15, 0, 10, 4);
    createDoor(15, 0, 10, 4);
    
    // CT Spawn Area (Top center)
    createWall(-100, -350, 4, 100);
    createWall(100, -350, 4, 100);
    
    // A Long (Right side)
    createWall(100, 300, 200, 4); // T to Long
    createWall(300, 250, 4, 100); // Long doors entrance
    createDoor(300, 200, 40, 4);  // Long Doors
    createWall(240, -50, 4, 500); // Inner wall of Long
    createWall(360, -50, 4, 500); // Outer wall of Long
    createWall(360, -250, 40, 4); // Pit separator
    
    // A Site (Top Right)
    createWall(200, -280, 80, 4); // CT spawn to A ramp
    createWall(240, -200, 80, 4); // A cross
    
    // A Short / Catwalk (From Mid to A)
    createWall(150, 100, 180, 4); // Catwalk outer
    createWall(150, 40, 180, 4);  // Catwalk inner
    createWall(240, 40, 4, 120);  // Catwalk going up to A
    
    // B Tunnels (Left side)
    createWall(-150, 250, 100, 4); // T to Tunnels (Partial to leave entrance open)
    createWall(-300, 100, 4, 300); // Tunnels outer
    createWall(-200, 100, 4, 300); // Tunnels inner
    createWall(-280, -50, 40, 4); // Upper tunnels exit to B (Left part)
    createDoor(-250, -50, 20, 4); // B Tunnels Door
    
    // B Site (Top Left)
    // Redesigned with disjointed walls and boxes to prevent bots from getting stuck in deep corners
    createWall(-200, -90, 4, 80);  // Upper part of B wall
    createWall(-200, -230, 4, 60); // Lower part of B wall, leaving a large gap
    createWall(-120, -250, 120, 4); // Shorter CT to B wall to prevent a long dead end
    createBox(-160, -200); // Defensive cover 1
    createBox(-150, -150); // Defensive cover 2
    createBox(-100, -200); // Defensive cover 3
    
    // Cover boxes in A
    createBox(280, -280); 
    createBox(295, -280); 
    createBox(280, -265);
    createBox(220, -150); // Goose
    createBox(250, -220); // Extra A Site Cover
    createBox(270, -200); // Extra A Cross Cover
    createBox(300, -100); // Long A Pit Cover
    
    // Cover boxes in B
    createBox(-280, -250); // Back B
    createBox(-260, -200); // Car
    createBox(-220, -250); // Default plant
    createBox(-240, -170); // Extra B Doors Cover
    createBox(-150, -220); // Extra B Window Cover
    createBox(-280, 50);  // Tunnels cover
    
    // Cover boxes in Mid
    createBox(-40, 100); // Xbox
    createBox(20, -150); // CT spawn box
    createBox(0, 50);   // Mid doors extra cover
    createBox(-20, 200); // Top mid extra cover

    // Bomb Zones
    bombZones = [];
    platformSpots = [];
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 });
    const zoneGeo = new THREE.BoxGeometry(60, 0.1, 60);
    
    const zoneA = new THREE.Mesh(zoneGeo, zoneMat);
    zoneA.position.set(-330, 0.05, -330); // Top-left (B Site area)
    scene.add(zoneA);
    bombZones.push({ mesh: zoneA, name: 'A 区', labelId: 'zoneA-label' });
    
    const zoneB = new THREE.Mesh(zoneGeo.clone(), zoneMat.clone());
    zoneB.position.set(330, 0.05, -330); // Top-right (A Site area)
    scene.add(zoneB);
    bombZones.push({ mesh: zoneB, name: 'B 区', labelId: 'zoneB-label' });
}

// ── de_inferno: 意大利小镇 ──
// T Spawn (南) → Mid (中庭拱门) → CT Spawn (北)
// T Spawn → Banana (香蕉道) → B Site (西北)
// Mid → Apartments (公寓) → B Site
// Mid → A Short (A小道) → A Site (东北)
// CT Spawn → A Site / B Site
function buildInfernoMap() {
    // Floor - grass/dirt ground
    const floorTex = createProceduralTexture('grass');
    floorTex.repeat.set(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 });
    const floorGeo = new THREE.PlaneGeometry(800, 800);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';
    scene.add(floor);

    // Wall texture (plaster for Mediterranean feel)
    const wallTex = createProceduralTexture('plaster');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const boxMat = new THREE.MeshStandardMaterial({ color: 0x5c4033 });

    const createWall = (x, z, w, d, h = 30) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const mat = wallMat.clone();
        mat.map = wallTex.clone();
        mat.map.repeat.set(Math.max(w, d) / 20, h / 20);
        const wall = new THREE.Mesh(geo, mat);
        wall.position.set(x, h / 2, z);
        wall.name = 'wall';
        scene.add(wall);
    };

    const sharedBoxGeo = new THREE.BoxGeometry(10, 10, 10);
    const createBox = (x, z) => {
        const box = new THREE.Mesh(sharedBoxGeo, boxMat);
        box.position.set(x, 5, z);
        box.name = 'wall';
        scene.add(box);
    };

    const sharedDoorMat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a });
    const createDoor = (x, z, w, d) => {
        const geo = new THREE.BoxGeometry(w, 40, d);
        const door = new THREE.Mesh(geo, sharedDoorMat);
        door.position.set(x, 20, z);
        door.name = 'wall';
        scene.add(door);
    };

    // ── 外围边界 ──
    createWall(0, -400, 800, 4);   // 北
    createWall(0, 400, 800, 4);    // 南
    createWall(-400, 0, 4, 800);   // 西
    createWall(400, 0, 4, 800);    // 东

    // ── T 出生区 (南中) ──
    createWall(-70, 380, 4, 40);   // T出生后墙左
    createWall(70, 380, 4, 40);    // T出生后墙右

    // ── 中庭走廊 (Mid) ──
    // Mid 左墙南段: z=50~250
    createWall(-50, 150, 4, 200);
    // Mid 右墙南段: z=25~175
    createWall(50, 100, 4, 150);
    // Mid 左墙北段: z=-150~-50
    createWall(-50, -100, 4, 100);
    // Mid 右墙北段: z=-150~-50
    createWall(50, -100, 4, 100);
    // 左侧缺口 z=-50~50 = 公寓入口
    // 右侧缺口 z=-50~25 = A小道入口

    // ── 香蕉道 (Banana: T→B, 左侧弯道) ──
    createWall(-130, 300, 4, 100);  // 香蕉道右墙 (隔开T出生)
    createWall(-230, 300, 4, 100);  // 香蕉道外墙
    createWall(-230, 250, 100, 4);  // 香蕉道转弯墙
    createWall(-230, 130, 4, 240);  // 香蕉道北侧外墙: z=10~250
    createWall(-150, 80, 4, 100);   // 香蕉道北侧内墙: z=30~130 (z<30 留缺口进入B区)

    // ── 公寓 (Apartments: Mid↔B, 左侧) ──
    createWall(-150, -25, 4, 150);  // 公寓左墙: z=-100~50

    // ── A小道 (A Short: Mid↔A, 右侧) ──
    createWall(150, -25, 4, 150);   // A小道右墙: z=-100~50

    // ── B 区 (西北) ──
    createWall(-320, -175, 4, 150);  // B区外墙: z=-250~-100
    createWall(-225, -250, 190, 4);  // B区后墙: x=-320~-130
    // B区前方开放 (连接公寓和香蕉道)

    // ── A 区 (东北) ──
    createWall(320, -175, 4, 150);   // A区外墙: z=-250~-100
    createWall(225, -250, 190, 4);   // A区后墙: x=130~320
    // A区前方开放 (连接A小道和CT)

    // ── CT 出生区 (北中) ──
    createWall(-70, -380, 4, 40);   // CT出生后墙左
    createWall(70, -380, 4, 40);    // CT出生后墙右
    // CT出生分隔墙 (连接到A区和B区)
    createWall(-130, -300, 4, 100);  // CT→B区分隔: z=-350~-250
    createWall(130, -300, 4, 100);   // CT→A区分隔: z=-350~-250

    // ── 掩马 (Doors / Arches) ──
    createDoor(-15, 200, 10, 4);     // T出生到Mid的拱门
    createDoor(15, 200, 10, 4);

    // ── 掩掩体 (Cover Boxes) ──
    // B区掩体
    createBox(-250, -200);   // B默认安放点
    createBox(-220, -180);   // B车位
    createBox(-280, -220);   // B后方
    createBox(-200, -230);   // B入口掩体
    createBox(-170, -150);   // B公寓入口掩体

    // A区掩体
    createBox(250, -200);    // A默认安放点
    createBox(220, -180);    // A坑位
    createBox(280, -220);    // A后方
    createBox(200, -230);    // A入口掩体
    createBox(170, -150);    // A小道入口掩体

    // 中庭掩体
    createBox(-20, 100);     // Mid箱子
    createBox(20, 50);      // Mid交叉位
    createBox(0, -25);       // 拱门掩体
    createBox(-30, -25);    // 拱门左侧
    createBox(30, -25);     // 拱门右侧
    createBox(0, -120);     // Mid北侧

    // 香蕉道掩体
    createBox(-180, 250);   // 香蕉道掩体
    createBox(-200, 100);   // 香蕉道中段

    // 公寓掩体
    createBox(-100, -25);   // 公寓掩体

    // A小道掩体
    createBox(100, -25);    // A小道掩体

    // CT出生区掩体
    createBox(-30, -320);   // CT掩体
    createBox(30, -320);    // CT掩体

    // ── 爆破区 ──
    bombZones = [];
    const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 });
    const zoneGeo = new THREE.BoxGeometry(60, 0.1, 60);

    // B区 (西北) → 标为A区
    const zoneA = new THREE.Mesh(zoneGeo, zoneMat);
    zoneA.position.set(-250, 0.05, -200);
    scene.add(zoneA);
    bombZones.push({ mesh: zoneA, name: 'A 区', labelId: 'zoneA-label' });

    // A区 (东北) → 标为B区
    const zoneB = new THREE.Mesh(zoneGeo.clone(), zoneMat.clone());
    zoneB.position.set(250, 0.05, -200);
    scene.add(zoneB);
    bombZones.push({ mesh: zoneB, name: 'B 区', labelId: 'zoneB-label' });
    platformSpots = [];
}

// ── 生化实验室 (Biolab): 丧尸围城守点图 ──
// 人类出生: 中央广场 (南)
// 五大高台守点: 中央天台(10)/西南货柜(8)/东南哨塔(14)/西北水塔(12)/东北脚手架(8)
// 玩家与Bot均可经台阶(step-up)登高; 僵尸走楼梯或围台攻击台边人类
function buildBiolabMap() {
    // Floor - 混凝土地面
    const floorTex = createProceduralTexture('stone');
    floorTex.repeat.set(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 });

    const floorGeo = new THREE.PlaneGeometry(800, 800);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.name = 'floor';
    scene.add(floor);

    // Materials
    let clonedWallMaterials = [];
    const wallTex = createProceduralTexture('stone');
    wallTex.wrapS = THREE.RepeatWrapping;
    wallTex.wrapT = THREE.RepeatWrapping;
    const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 });
    const platformMat = new THREE.MeshStandardMaterial({ color: 0x4a5548, roughness: 0.85 });
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x5a6a5a, roughness: 0.6, metalness: 0.3 });
    const railMat = new THREE.MeshStandardMaterial({ color: 0x2a8a3a, roughness: 0.5, emissive: 0x002a08 });

    // 墙体: yBase 支持悬空护栏 (护栏建在高台面上)
    const createWall = (x, z, w, d, h = 30, yBase = 0, mat = null) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const useMat = mat || wallMat.clone();
        if (!mat) {
            useMat.map = wallTex.clone();
            useMat.map.repeat.set(Math.max(w, d) / 20, h / 20);
            clonedWallMaterials.push(useMat);
        }
        const wall = new THREE.Mesh(geo, useMat);
        wall.position.set(x, yBase + h / 2, z);
        wall.name = 'wall';
        scene.add(wall);
    };

    // 高台平台 (实心, 从地面起)
    const createPlatform = (x, z, w, d, h) => {
        const geo = new THREE.BoxGeometry(w, h, d);
        const wall = new THREE.Mesh(geo, platformMat);
        wall.position.set(x, h / 2, z);
        wall.name = 'wall';
        scene.add(wall);
    };

    // 直跑台阶: 每级高2(≤step-up 2.6), 从地面逐级升到台面高度
    // (x, z): 台阶中心; w: 宽度; dir: 延伸方向 'N'|'S'|'E'|'W'; topH: 顶端高度
    const createStairs = (x, z, w, dir, topH) => {
        const steps = Math.floor(topH / 2);
        const stepDepth = 7;
        for (let i = 0; i < steps; i++) {
            const h = (i + 1) * 2;
            const off = (steps - i) * stepDepth - stepDepth / 2;
            let sx = x, sz = z, sw = w, sd = stepDepth;
            if (dir === 'N') { sz = z - off; }
            else if (dir === 'S') { sz = z + off; }
            else if (dir === 'E') { sx = x + off; sw = stepDepth; sd = w; }
            else { sx = x - off; sw = stepDepth; sd = w; }
            createWall(sx, sz, sw, sd, h, 0, metalMat);
        }
    };

    // 台上护栏: 高1.2, 不挡玩家视线(眼高在护栏上方), 标记 noClimb 不可攀爬
    const createRail = (x, z, w, d, yBase) => {
        const geo = new THREE.BoxGeometry(w, 1.2, d);
        const rail = new THREE.Mesh(geo, railMat);
        rail.position.set(x, yBase + 0.6, z);
        rail.name = 'wall';
        rail.userData.noClimb = true;
        scene.add(rail);
    };

    const createBox = (x, z, h = 10) => {
        const geo = new THREE.BoxGeometry(10, h, 10);
        const box = new THREE.Mesh(geo, metalMat);
        box.position.set(x, h / 2, z);
        box.name = 'wall';
        scene.add(box);
    };

    // ── 外围墙 ──
    createWall(0, -400, 800, 4);
    createWall(0, 400, 800, 4);
    createWall(-400, 0, 4, 800);
    createWall(400, 0, 4, 800);

    // ═══ 守点1: 中央天台 (高10, 均衡博弈点) ═══
    // 台面 x∈[-35,35], z∈[-95,-25]
    createPlatform(0, -60, 70, 70, 10);
    createStairs(0, -25, 20, 'S', 10); // 南侧直跑台阶
    // 台上护栏 (南侧留20宽缺口对准台阶, 其余三面围)
    createRail(0, -94.4, 70, 1.2, 10);
    createRail(-34.4, -60, 1.2, 70, 10);
    createRail(34.4, -60, 1.2, 70, 10);
    createRail(-27, -25.6, 16, 1.2, 10);
    createRail(27, -25.6, 16, 1.2, 10);
    // 台上掩体
    createBox(-20, -75);
    createBox(18, -50, 10);

    // ═══ 守点2: 西南货柜平台 (高8, 激进输出位) ═══
    // 台面 x∈[-260,-220], z∈[160,200]
    createPlatform(-240, 180, 40, 40, 8);
    createStairs(-220, 180, 14, 'E', 8); // 东侧台阶
    createRail(-240, 199.4, 40, 1.2, 8);
    createRail(-259.4, 180, 1.2, 40, 8);
    createRail(-240, 160.6, 40, 1.2, 8);
    // 货柜迷宫 (地面博弈点)
    createBox(-300, 120);
    createBox(-288, 132);
    createBox(-300, 144);
    createBox(-280, 200);
    createBox(-290, 240);
    createBox(-250, 260);
    createBox(-320, 180);
    createBox(-200, 240);
    createBox(-160, 200);
    createBox(-180, 160);

    // ═══ 守点3: 东南哨塔 (高14, 安全点但台阶长) ═══
    // 塔面 x∈[227,253], z∈[187,213]
    createPlatform(240, 200, 26, 26, 14);
    createStairs(240, 187, 12, 'N', 14); // 北侧直跑长台阶 (7级)
    // 塔顶护栏 (北侧留缺口对准台阶)
    createRail(240, 212.4, 26, 1.2, 14);
    createRail(227.6, 200, 1.2, 26, 14);
    createRail(252.4, 200, 1.2, 26, 14);
    createRail(229, 187.6, 5, 1.2, 14);
    createRail(251, 187.6, 5, 1.2, 14);
    // 哨塔周边废墟掩体
    createBox(300, 150);
    createBox(312, 162);
    createBox(300, 240);
    createBox(280, 280);
    createBox(330, 200);
    createBox(200, 280);

    // ═══ 中央出生广场防线 (南, 人类出生) ═══
    // 弧形沙袋防线 + 箱阵
    createBox(-60, 90);
    createBox(-40, 100);
    createBox(40, 100);
    createBox(60, 90);
    createWall(0, 70, 30, 4, 6);    // 广场前矮墙
    createWall(-90, 130, 4, 40, 8); // 两侧翼墙
    createWall(90, 130, 4, 40, 8);
    createBox(-20, 170);
    createBox(20, 170);

    // ═══ 西侧长廊 (双墙夹道, 地面博弈点) ═══
    createWall(-150, 60, 4, 200);
    createWall(-110, 60, 4, 200);
    createBox(-130, 20);
    createBox(-130, 100);

    // ═══ 东侧废墟 (地面博弈点) ═══
    createWall(150, 60, 4, 200);
    createBox(130, 20);
    createBox(130, 100);
    createBox(170, 40);
    createBox(170, 120);

    // ═══ 北部丧尸侧开阔地 (少掩体, 丧尸冲锋走廊) ═══
    createBox(-100, -200);
    createBox(100, -200);
    createBox(0, -260);
    createWall(-60, -320, 4, 120, 20); // 北侧残墙
    createWall(60, -320, 4, 120, 20);

    // ═══ 东北/西北连接通道掩体 ═══
    createBox(-300, -100);
    createBox(-280, -140);
    createBox(300, -100);
    createBox(280, -140);
    createBox(-200, -300);
    createBox(200, -300);

    // ═══ 守点4: 西北水塔 (高12, 深入丧尸腹地的安全点) ═══
    // 塔面 x∈[-255,-225], z∈[-215,-185], 南侧长台阶
    createPlatform(-240, -200, 30, 30, 12);
    createStairs(-240, -185, 14, 'S', 12);
    createRail(-240, -215.6, 30, 1.2, 12);      // 北
    createRail(-255.6, -200, 1.2, 30, 12);      // 西
    createRail(-224.4, -200, 1.2, 30, 12);      // 东
    createRail(-251, -184.4, 8, 1.2, 12);       // 南侧台阶左段
    createRail(-229, -184.4, 8, 1.2, 12);       // 南侧台阶右段
    // 通往水塔的冲锋掩体
    createBox(-290, -240);
    createBox(-200, -250);

    // ═══ 守点5: 东北脚手架 (高8, 激进前压点, 台边可被利爪够到) ═══
    // 台面 x∈[223,257], z∈[-217,-183], 西侧台阶
    createPlatform(240, -200, 34, 34, 8);
    createStairs(223, -200, 14, 'W', 8);
    createRail(240, -217.6, 34, 1.2, 8);        // 北
    createRail(257.6, -200, 1.2, 34, 8);        // 东
    createRail(240, -182.4, 34, 1.2, 8);        // 南
    createRail(222.4, -212, 1.2, 10, 8);        // 西侧台阶上段
    createRail(222.4, -188, 1.2, 10, 8);        // 西侧台阶下段
    // 脚手架周边掩体
    createBox(290, -240);
    createBox(200, -250);

    // 生化模式无爆破区; 若在爆破模式下运行生化实验室, 提供保底爆破点A与B
    bombZones = [];
    if (typeof gameMode !== 'undefined' && gameMode === 'bomb') {
        const zoneMat = new THREE.MeshBasicMaterial({ color: 0xffff00, transparent: true, opacity: 0.3 });
        const zoneGeo = new THREE.BoxGeometry(60, 0.1, 60);
        
        const zoneA = new THREE.Mesh(zoneGeo, zoneMat);
        zoneA.position.set(-200, 0.05, -200);
        scene.add(zoneA);
        bombZones.push({ mesh: zoneA, name: 'A 区', labelId: 'zoneA-label' });
        
        const zoneB = new THREE.Mesh(zoneGeo.clone(), zoneMat.clone());
        zoneB.position.set(200, 0.05, -200);
        scene.add(zoneB);
        bombZones.push({ mesh: zoneB, name: 'B 区', labelId: 'zoneB-label' });
    }
    platformSpots = [
        { x: 0, z: -60, h: 10 },      // 中央天台
        { x: -240, z: 180, h: 8 },    // 西南货柜平台
        { x: 240, z: 200, h: 14 },    // 东南哨塔
        { x: -240, z: -200, h: 12 },  // 西北水塔
        { x: 240, z: -200, h: 8 }     // 东北脚手架
    ];
}

// #endregion
