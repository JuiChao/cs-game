// #region 地图构建
let gameInitialized = false;

function init3DGame() {
    if (!gameInitialized) {
        const container = document.getElementById('canvas-container');
        container.innerHTML = ''; 

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        scene.fog = new THREE.Fog(0x87CEEB, 20, 300);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 1000);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

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

        controls = new THREE.PointerLockControls(camera, document.body);
        
        let isTouchDevice = window.matchMedia("(pointer: coarse)").matches;
        
        container.addEventListener('click', () => { 
            if (!isTouchDevice && roundActive && !playerState.isSpectating && document.getElementById('buy-menu').classList.contains('hidden')) {
                controls.lock(); 
            }
        });
        
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
    
    if (isShootingRange) {
        buildShootingRangeMap();
    } else {
        buildLargeMap();
        buildNavGrid();
    }
    
    collidableMeshList = [];
    scene.children.forEach(child => {
        if (child.name === 'wall') {
            child.worldBox = new THREE.Box3().setFromObject(child);
            collidableMeshList.push(child);
        }
    });
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

function getValidSpawnPoint(existingPoints, minDist = 80) {
    for (let i = 0; i < 500; i++) {
        let x = (Math.random() - 0.5) * 750;
        let z = (Math.random() - 0.5) * 750;
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
    return {x: (Math.random() - 0.5) * 700, z: (Math.random() - 0.5) * 700};
}

function resetRound() {
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
    });
    if (activeFires) activeFires.forEach(f => {
        scene.remove(f.mesh);
        if (f.mesh.geometry) f.mesh.geometry.dispose();
        if (f.mesh.material) f.mesh.material.dispose();
    });
    if (particles) particles.forEach(p => {
        scene.remove(p.mesh);
        if (p.mesh.geometry) p.mesh.geometry.dispose();
        if (p.mesh.material) p.mesh.material.dispose();
    });
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
    
    let squadSpawns = [];
    for (let i = 0; i < 10; i++) {
        squadSpawns.push(getValidSpawnPoint(squadSpawns, 100));
    }
    
    let ctSpawns = squadSpawns.slice(0, 5);
    let tSpawns = squadSpawns.slice(5, 10);
    
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
    
    // Auto switch to primary if available
    if (inventory.primary) switchWeapon(1);
    else switchWeapon(2);

    bombState.planted = false;
    bombState.plantProgress = 0;
    bombState.timer = 60;
    
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
    if (typeof updateArmorHUD === 'function') updateArmorHUD();
    
    document.getElementById('bomb-status').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('buy-prompt').classList.remove('hidden');
    setTimeout(() => { document.getElementById('buy-prompt').classList.add('hidden'); }, 10000);

    updateHUD();
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

// #endregion
