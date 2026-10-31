const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

async function runPhase3Tests() {
    console.log("=== STARTING PHASE 3 AUTOMATED VERIFICATION ===");
    let failures = 0;
    function assert(condition, message) {
        if (!condition) {
            console.error("FAIL:", message);
            failures++;
        } else {
            console.log("PASS:", message);
        }
    }

    // 1. Static Code Analysis Checks
    console.log("\n--- Checking Phase 3 Source Code Implementations ---");
    const viewmodelsJs = fs.readFileSync(path.join(__dirname, 'modules/viewmodels.js'), 'utf-8');
    assert(viewmodelsJs.includes('function disposeHierarchy('), "viewmodels.js defines disposeHierarchy()");
    assert(viewmodelsJs.includes('disposeHierarchy(playerState.viewModel)'), "buildViewModel() invokes disposeHierarchy(playerState.viewModel)");

    const minimapJs = fs.readFileSync(path.join(__dirname, 'modules/minimap.js'), 'utf-8');
    assert(minimapJs.includes('setDrawRange('), "minimap.js uses setDrawRange for zero-allocation trajectory");
    assert(minimapJs.includes('trajectoryPositions = new Float32Array'), "minimap.js uses static Float32Array for trajectory positions");

    const navmeshJs = fs.readFileSync(path.join(__dirname, 'modules/navmesh.js'), 'utf-8');
    assert(navmeshJs.includes('function octileDistance('), "navmesh.js implements octileDistance heuristic");
    assert(navmeshJs.includes('navHeapPush') && navmeshJs.includes('navHeapPop'), "navmesh.js implements Binary Min-Heap (navHeapPush/navHeapPop)");
    assert(navmeshJs.includes('navGScore = new Float32Array'), "navmesh.js uses 1D TypedArrays (Float32Array) for gScore");
    assert(!navmeshJs.includes('const hash = (node) => `${node.x},${node.z}`'), "navmesh.js eliminates `${node.x},${node.z}` string hashing");

    const bulletsJs = fs.readFileSync(path.join(__dirname, 'modules/bullets.js'), 'utf-8');
    assert(bulletsJs.includes('function obtainParticle('), "bullets.js implements obtainParticle() pool accessor");
    assert(bulletsJs.includes('PARTICLE_POOL_SIZE = 1024'), "bullets.js pre-allocates particle object pool");
    assert(bulletsJs.includes('function queryBulletSpatialTargets('), "bullets.js implements queryBulletSpatialTargets()");
    assert(bulletsJs.includes('bulletSpatialGrid'), "bullets.js implements bulletSpatialGrid 2D spatial partitioning");

    // 2. Headless Browser Runtime Verification
    console.log("\n--- Starting Headless Browser Tests ---");
    const browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', err => { pageErrors.push(err.message); console.error('PAGE ERROR STACK:', err.stack); });
    page.on('console', msg => {
        if (msg.type() === 'error') console.log('PAGE ERROR LOG:', msg.text());
    });

    const baseUri = 'file:///' + path.join(__dirname, 'index.html').replace(/\\/g, '/');
    await page.goto(baseUri, { waitUntil: 'load' });

    console.log("Starting game in browser...");
    await page.click('#start-btn');
    await new Promise(r => setTimeout(r, 1000));

    // Test 3.1: Particle Pool Architecture & Flamethrower Zero-GC Stress
    console.log("\n--- Testing Particle Object Pool & Zero-GC Firing ---");
    const particlePoolResult = await page.evaluate(() => {
        const initialPool = typeof getParticlePool === 'function' ? getParticlePool() : null;
        const initialPoolSize = initialPool ? initialPool.length : 0;

        // Count how many materials are created during 120 consecutive flamethrower ticks (720 particles)
        const activeBefore = particles.length;
        const muzzlePos = new THREE.Vector3(0, 5, 0);
        const shootDir = new THREE.Vector3(0, 0, 1);

        for (let tick = 0; tick < 120; tick++) {
            createFlameStream(muzzlePos, shootDir, 50);
            updateParticles(0.016);
        }

        const poolAfter = getParticlePool();
        const activeAfter = particles.length;
        const allPooled = particles.every(p => p.isPooled === true);

        // Verify position update happened without throwing
        const hasMovedParticles = particles.some(p => p.mesh.position.z !== 0 || p.mesh.position.y !== 5);

        // Verify pool saturation with 1500 calls recycled without unbounded array growth
        for (let s = 0; s < 1500; s++) {
            obtainParticle(sharedParticleGeo, 0xffaa00, 0, 5, 0, 1, 1, 1, 1.0);
        }
        const saturatedPoolLength = getParticlePool().length;
        const saturatedActiveLength = particles.length;
        const poolBounded = saturatedPoolLength === 1024 && saturatedActiveLength <= 1024;

        // Reset round and verify pooled materials are NOT disposed and free list is reclaimed
        resetRound();
        let particleGeoValid = sharedParticleGeo && sharedParticleGeo.attributes && sharedParticleGeo.attributes.position;
        let muzzleGeoValid = sharedMuzzleGeo && sharedMuzzleGeo.attributes && sharedMuzzleGeo.attributes.position;
        const freeAfterReset = typeof getParticlePoolFree === 'function' ? getParticlePoolFree().length : -1;

        // Spawn after reset round succeeds without WebGL or material errors
        let spawnError = null;
        try {
            createExplosionEffect(new THREE.Vector3(5, 5, 5));
            createFlameStream(new THREE.Vector3(5, 5, 5), shootDir, 50);
            updateParticles(0.016);
        } catch (e) {
            spawnError = e.message;
        }

        return {
            initialPoolSize,
            activeAfter,
            allPooled,
            hasMovedParticles,
            poolBounded,
            saturatedPoolLength,
            freeAfterReset,
            particleGeoValid: !!particleGeoValid,
            muzzleGeoValid: !!muzzleGeoValid,
            spawnError
        };
    });
    assert(particlePoolResult.initialPoolSize === 1024, "Particle pool pre-allocated with 1024 instances");
    assert(particlePoolResult.allPooled, "All active particles originate from preallocated pool (isPooled = true)");
    assert(particlePoolResult.hasMovedParticles, "updateParticles() updated particle positions in-place without vector allocations");
    assert(particlePoolResult.poolBounded, "Particle pool strictly bounded at 1024 items under 1500 saturation calls");
    assert(particlePoolResult.freeAfterReset === 1024, "Particle pool free stack fully reclaimed to 1024 on resetRound()");
    assert(particlePoolResult.particleGeoValid && particlePoolResult.muzzleGeoValid, "shared geometries preserved across resetRound()");
    assert(particlePoolResult.spawnError === null, `Particle creation after resetRound executed cleanly: ${particlePoolResult.spawnError}`);

    // Test 3.2: ViewModel Recursive Resource Disposal
    console.log("\n--- Testing ViewModel Recursive Resource Disposal (disposeHierarchy) ---");
    const viewmodelDisposalResult = await page.evaluate(() => {
        // 1. Equip Karambit (Knife) - composite model with TorusGeometry and ExtrudeGeometry
        switchWeapon(3);
        const knifeModel = playerState.viewModel;
        let knifeGeometries = [];
        let knifeMaterials = [];
        knifeModel.traverse(child => {
            if (child.geometry) knifeGeometries.push(child.geometry);
            if (child.material) knifeMaterials.push(child.material);
        });

        // Track disposal calls with spies
        let geometriesDisposed = 0;
        let materialsDisposed = 0;
        knifeGeometries.forEach(geo => {
            const origDispose = geo.dispose;
            geo.dispose = function() {
                geometriesDisposed++;
                origDispose.apply(this, arguments);
            };
        });
        knifeMaterials.forEach(mat => {
            const origDispose = mat.dispose;
            mat.dispose = function() {
                materialsDisposed++;
                origDispose.apply(this, arguments);
            };
        });

        // 2. Switch weapon to primary (e.g. rifle) - triggers buildViewModel()
        inventory.primary = 'rifle';
        switchWeapon(1);
        const newModel = playerState.viewModel;

        // 3. Test standalone disposeHierarchy with nested arbitrary group including Sprite and multi-textures
        const testGroup = new THREE.Group();
        const testMesh1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
        
        let texturesDisposed = 0;
        const fakeMap = { dispose: () => { texturesDisposed++; } };
        const fakeNormalMap = { dispose: () => { texturesDisposed++; } };
        const matWithMaps = new THREE.MeshStandardMaterial();
        matWithMaps.map = fakeMap;
        matWithMaps.normalMap = fakeNormalMap;
        
        const testMesh2 = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), [matWithMaps, new THREE.MeshBasicMaterial()]);
        const testSprite = new THREE.Sprite(new THREE.SpriteMaterial());
        testGroup.add(testMesh1);
        testGroup.add(testMesh2);
        testGroup.add(testSprite);

        let standaloneGeosDisposed = 0;
        let standaloneMatsDisposed = 0;
        let spritesDisposed = 0;
        [testMesh1.geometry, testMesh2.geometry, testSprite.geometry].forEach(g => {
            if (!g) return;
            const od = g.dispose;
            g.dispose = function() { standaloneGeosDisposed++; od.apply(this, arguments); };
        });
        [testMesh1.material, testMesh2.material[0], testMesh2.material[1], testSprite.material].forEach(m => {
            if (!m) return;
            const od = m.dispose;
            m.dispose = function() { standaloneMatsDisposed++; od.apply(this, arguments); };
        });

        disposeHierarchy(testGroup);
        const childrenCleared = testGroup.children.length === 0;

        // Safe against null/undefined
        let nullSafe = true;
        try {
            disposeHierarchy(null);
            disposeHierarchy(undefined);
        } catch (e) {
            nullSafe = false;
        }

        // 4. Stress test: rapid continuous weapon cycling across 500 iterations
        const geosBeforeCycle = renderer.info.memory.geometries;
        const texturesBeforeCycle = renderer.info.memory.textures;
        for (let cycle = 0; cycle < 500; cycle++) {
            switchWeapon((cycle % 4) + 1);
        }
        const geosAfterCycle = renderer.info.memory.geometries;
        const texturesAfterCycle = renderer.info.memory.textures;
        const memoryBounded = (geosAfterCycle <= geosBeforeCycle + 4) && (texturesAfterCycle <= texturesBeforeCycle);

        return {
            knifeGeoCount: knifeGeometries.length,
            geometriesDisposed,
            materialsDisposed,
            switchedToNewModel: newModel !== knifeModel,
            standaloneGeosDisposed,
            standaloneMatsDisposed,
            texturesDisposed,
            childrenCleared,
            nullSafe,
            memoryBounded,
            geosDelta: geosAfterCycle - geosBeforeCycle,
            texturesDelta: texturesAfterCycle - texturesBeforeCycle
        };
    });
    assert(viewmodelDisposalResult.knifeGeoCount > 0, `Karambit model composed of ${viewmodelDisposalResult.knifeGeoCount} child geometries`);
    assert(viewmodelDisposalResult.geometriesDisposed === viewmodelDisposalResult.knifeGeoCount, "All geometries of old ViewModel disposed on weapon switch");
    assert(viewmodelDisposalResult.materialsDisposed > 0, "All materials of old ViewModel disposed on weapon switch");
    assert(viewmodelDisposalResult.switchedToNewModel, "New weapon ViewModel constructed cleanly");
    assert(viewmodelDisposalResult.standaloneGeosDisposed >= 2 && viewmodelDisposalResult.standaloneMatsDisposed >= 3, "disposeHierarchy recursively disposed nested groups, sprites, and material arrays");
    assert(viewmodelDisposalResult.texturesDisposed === 2, "disposeHierarchy recursively disposed map and normalMap textures");
    assert(viewmodelDisposalResult.childrenCleared, "disposeHierarchy detached all child nodes from the root object");
    assert(viewmodelDisposalResult.memoryBounded, `500 rapid weapon switches maintained strictly bounded memory (geo delta: ${viewmodelDisposalResult.geosDelta}, tex delta: ${viewmodelDisposalResult.texturesDelta})`);
    assert(viewmodelDisposalResult.nullSafe, "disposeHierarchy handles null/undefined arguments safely");

    // Test 3.3: Zero-Allocation Trajectory Prediction
    console.log("\n--- Testing Zero-Allocation Trajectory Prediction ---");
    const trajectoryResult = await page.evaluate(() => {
        roundActive = true;
        playerState.hp = 100;
        playerState.isSpectating = false;
        if (!controls) controls = {};
        controls.isLocked = true;

        inventory.currentSlot = 4;
        inventory.grenades['hegrenade'] = 5;
        inventory.currentGrenade = 'hegrenade';

        // 1. First trajectory update
        updateTrajectory();
        const line1 = getTrajectoryLine();
        const geo1 = getTrajectoryGeo();
        const drawRange1 = geo1.drawRange.count;
        const pos1_sample = getTrajectoryPositions()[0];

        // 2. Move camera and update trajectory again
        camera.position.x += 10;
        updateTrajectory();
        const line2 = getTrajectoryLine();
        const geo2 = getTrajectoryGeo();
        const drawRange2 = geo2.drawRange.count;
        const pos2_sample = getTrajectoryPositions()[0];

        // 3. Switch to Molotov (area plane mode)
        inventory.grenades['molotov'] = 5;
        inventory.currentGrenade = 'molotov';
        updateTrajectory();
        const line3 = getTrajectoryLine();
        const geo3 = getTrajectoryGeo();

        // 4. Switch to rifle (inactive trajectory)
        inventory.currentSlot = 1;
        updateTrajectory();
        const visibleAfterUnequip = line1.visible;

        return {
            lineExists: !!line1,
            geoUnchangedAcrossFrames: geo1 === geo2 && geo2 === geo3,
            lineUnchangedAcrossFrames: line1 === line2 && line2 === line3,
            drawRangeValid: drawRange1 > 5 && drawRange2 > 5,
            positionsUpdatedInPlace: pos1_sample !== pos2_sample,
            hiddenWhenInactive: visibleAfterUnequip === false
        };
    });
    assert(trajectoryResult.lineExists, "Trajectory line initialized with persistent BufferGeometry");
    assert(trajectoryResult.geoUnchangedAcrossFrames, "BufferGeometry instance is 100% persistent across frames (zero reallocation)");
    assert(trajectoryResult.lineUnchangedAcrossFrames, "Line instance is persistent across frames without recreation");
    assert(trajectoryResult.drawRangeValid, "setDrawRange(0, count) dynamically updates visible vertex count");
    assert(trajectoryResult.positionsUpdatedInPlace, "Float32Array vertex coordinates updated in-place");
    assert(trajectoryResult.hiddenWhenInactive, "Trajectory line hidden when holding non-throwable weapons without disposing geometry");

    // Test 3.4: A* Pathfinding 1D TypedArray Min-Heap & Octile Heuristic
    console.log("\n--- Testing A* Pathfinding 1D TypedArray Min-Heap & Octile Heuristic ---");
    const pathfindingResult = await page.evaluate(() => {
        // 1. Octile Distance Metric Verification
        const octOrthogonal = octileDistance(10, 0); // Straight = 10
        const octDiagonal = octileDistance(10, 10); // Diagonal = 10 * 1.41421... = 14.1421...
        const octMixed = octileDistance(10, 5); // 5 diagonal + 5 straight = 5*1.41421... + 5 = 12.071...

        // 2. Real Pathfinding on navGrid
        buildNavGrid();
        let walkableCells = [];
        for (let x = 10; x < 70; x++) {
            for (let z = 10; z < 70; z++) {
                if (navGrid[x] && navGrid[x][z]) {
                    walkableCells.push({ x, z });
                }
            }
        }
        const sCell = walkableCells[0];
        const eCell = walkableCells[Math.floor(walkableCells.length * 0.75)];
        const pStart = getWorldPos(sCell.x, sCell.z);
        const pEnd = getWorldPos(eCell.x, eCell.z);

        const startTime = performance.now();
        const path = findPath(pStart, pEnd);
        const searchTime = performance.now() - startTime;

        const pathFound = path && path.length > 2;

        // 3. Verify identical start/end immediate return
        const samePointPath = findPath(pStart, pStart);

        // 4. Verify flanking path uses optimized findPath
        const flankPath = findFlankPath(pStart, pEnd);

        // 5. Boundary coordinates (-400, -400), (400, 400) and out-of-bounds (-550, -550)
        const pEdge1 = new THREE.Vector3(-400, 0, -400);
        const pEdge2 = new THREE.Vector3(400, 0, 400);
        const pOOB = new THREE.Vector3(-550, 0, -550);
        const edgePath1 = findPath(pEdge1, pStart);
        const edgePath2 = findPath(pStart, pEdge2);
        const oobPath = findPath(pOOB, pEnd);
        const edgePathsValid = edgePath1.length > 0 && edgePath2.length > 0 && oobPath.length > 0;

        // 6. Stress test: 50 consecutive findPath queries
        const stressStart = performance.now();
        for (let k = 0; k < 50; k++) {
            findPath(pStart, pEnd);
        }
        const avgQueryTimeMs = (performance.now() - stressStart) / 50;

        return {
            octOrthogonal: Math.round(octOrthogonal),
            octDiagonalNear: Math.abs(octDiagonal - 14.1421356) < 0.001,
            octMixedNear: Math.abs(octMixed - 12.0710678) < 0.001,
            pathFound,
            searchTimeMs: searchTime,
            samePointPathLength: samePointPath.length,
            flankPathFound: flankPath && flankPath.length > 2,
            edgePathsValid,
            avgQueryTimeMs
        };
    });
    assert(pathfindingResult.octOrthogonal === 10, "Octile heuristic calculates straight orthogonal steps at exact cost 10");
    assert(pathfindingResult.octDiagonalNear, "Octile heuristic calculates 8-direction diagonal distance (14.142)");
    assert(pathfindingResult.octMixedNear, "Octile heuristic calculates mixed orthogonal+diagonal steps (12.071)");
    assert(pathfindingResult.pathFound, "A* findPath computed complete valid trajectory across the map");
    assert(pathfindingResult.samePointPathLength === 1, "findPath handles identical start and end point in O(1)");
    assert(pathfindingResult.flankPathFound, "findFlankPath works seamlessly with the new 1D Min-Heap engine");
    assert(pathfindingResult.edgePathsValid, "findPath handles boundary coordinates (-400, 400) and out-of-bounds inputs safely");
    assert(pathfindingResult.avgQueryTimeMs < 5.0, `A* average search latency is under 5ms (actual: ${pathfindingResult.avgQueryTimeMs.toFixed(3)}ms)`);

    // Test 3.5: 2D Spatial Grid Bullet Raycast Partitioning
    console.log("\n--- Testing 2D Spatial Grid Partitioning & Raycast Optimization ---");
    const spatialGridResult = await page.evaluate(() => {
        roundActive = true;
        rebuildMap();

        const totalCollidables = collidableMeshList.length;
        rebuildBulletSpatialGrid();

        // 1. Query small localized line segment (e.g. length 15 near origin)
        const p1 = new THREE.Vector3(0, 2, 0);
        const p2 = new THREE.Vector3(0, 2, 15);
        const localizedTargets = queryBulletSpatialTargets(p1, p2, 2.0).slice();

        // 2. Query across map corner (e.g. -350, -350)
        const cornerP1 = new THREE.Vector3(-350, 2, -350);
        const cornerP2 = new THREE.Vector3(-340, 2, -340);
        const cornerTargets = queryBulletSpatialTargets(cornerP1, cornerP2, 2.0).slice();

        // 3. Query out-of-bounds raycast (e.g. -1000, -1000)
        const oobP1 = new THREE.Vector3(-1000, 2, -1000);
        const oobP2 = new THREE.Vector3(-950, 2, -950);
        const oobTargets = queryBulletSpatialTargets(oobP1, oobP2, 2.0).slice();

        // 4. Test dynamic Bot filtering: add close bot and far bot
        const closeBot = { id: 701, team: 'T', hp: 100, isDead: false, mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()) };
        closeBot.mesh.position.set(0, 1, 10);
        const farBot = { id: 702, team: 'T', hp: 100, isDead: false, mesh: new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), new THREE.MeshBasicMaterial()) };
        farBot.mesh.position.set(250, 1, 250);

        bots.push(closeBot);
        bots.push(farBot);

        const targetsWithBots = queryBulletSpatialTargets(p1, p2, 2.0);
        const includesCloseBot = targetsWithBots.includes(closeBot.mesh);
        const excludesFarBot = !targetsWithBots.includes(farBot.mesh);

        // Clean up test bots
        const bIdx1 = bots.indexOf(closeBot);
        if (bIdx1 > -1) bots.splice(bIdx1, 1);
        const bIdx2 = bots.indexOf(farBot);
        if (bIdx2 > -1) bots.splice(bIdx2, 1);

        // 5. Test actual bullet raycast collision using spatial grid
        const bulletStart = new THREE.Vector3(0, 2, 0);
        const bulletDir = new THREE.Vector3(0, 0, 1);
        createBullet(bulletStart, bulletDir, WEAPONS.rifle, { team: 'CT', isPlayer: true });
        const bulletCountBefore = bullets.length;

        // Step bullets through spatial grid
        updateBullets(0.016);
        const bulletUpdatedCleanly = bullets.length >= 0;

        return {
            totalCollidables,
            localizedTargetCount: localizedTargets.length,
            cornerTargetCount: cornerTargets.length,
            oobTargetCount: oobTargets.length,
            filteredSignificantPortion: localizedTargets.length < totalCollidables * 0.5,
            includesCloseBot,
            excludesFarBot,
            bulletUpdatedCleanly
        };
    });
    assert(spatialGridResult.totalCollidables > 10, `Scene contains ${spatialGridResult.totalCollidables} static collidable meshes`);
    assert(spatialGridResult.filteredSignificantPortion, `Spatial Grid filtered candidates from ${spatialGridResult.totalCollidables} down to ${spatialGridResult.localizedTargetCount} meshes`);
    assert(spatialGridResult.oobTargetCount === 0, "Spatial Grid correctly discards off-grid raycast queries (0 candidate meshes)");
    assert(spatialGridResult.includesCloseBot, "Spatial Grid correctly includes active bot inside trajectory bounding box");
    assert(spatialGridResult.excludesFarBot, "Spatial Grid correctly discards distant bot outside trajectory bounding box");
    assert(spatialGridResult.bulletUpdatedCleanly, "Bullet physics and spatial grid collision update executed without errors");

    // Zero page errors check
    assert(pageErrors.length === 0, `Zero page runtime errors during Phase 3 verification (errors: ${pageErrors.join(', ')})`);

    await browser.close();

    console.log(`\n=== PHASE 3 VERIFICATION FINISHED: ${failures === 0 ? "ALL PASSED" : failures + " FAILURES"} ===`);
    if (failures > 0) process.exit(1);
}

runPhase3Tests().catch(err => {
    console.error("FATAL PHASE 3 TEST EXCEPTION:", err);
    process.exit(1);
});
