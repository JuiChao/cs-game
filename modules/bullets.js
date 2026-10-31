// #region Bot 生成与子弹系统
// Procedural cartoon / tactical faces generated via HTML5 Canvas (100% offline & zero network latency)
function createProceduralBotFaceTexture(team) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    
    // Background / Head base
    ctx.fillStyle = team === 'CT' ? '#2c3e50' : '#d35400';
    ctx.fillRect(0, 0, 128, 128);
    
    if (team === 'CT') {
        // Counter-Terrorist: Tactical helmet & visor / Balaclava
        ctx.fillStyle = '#1a252f';
        ctx.fillRect(16, 16, 96, 96);
        
        // Eye slit / Visor area
        ctx.fillStyle = '#34495e';
        ctx.fillRect(24, 40, 80, 28);
        
        // High-tech Visor / Goggles (Cyan glow)
        ctx.fillStyle = '#00d2d3';
        ctx.fillRect(28, 44, 32, 20);
        ctx.fillRect(68, 44, 32, 20);
        
        // Visor lens reflection
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.fillRect(32, 46, 10, 6);
        ctx.fillRect(72, 46, 10, 6);
        
        // Tactical breathing filter / mask
        ctx.fillStyle = '#2c3e50';
        ctx.beginPath();
        ctx.arc(64, 90, 16, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7f8c8d';
        ctx.fillRect(52, 88, 24, 4);
        ctx.fillRect(52, 94, 24, 4);

        // Helmet crest / strap
        ctx.fillStyle = '#2980b9';
        ctx.fillRect(16, 16, 96, 10);
    } else {
        // Terrorist: Desert Camo / Bandana & aviator glasses / mask
        ctx.fillStyle = '#e0ae8b';
        ctx.fillRect(20, 24, 88, 44);
        
        // Aviator sunglasses
        ctx.fillStyle = '#111111';
        ctx.beginPath();
        ctx.arc(42, 46, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(86, 46, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(54, 44, 20, 4);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillRect(36, 40, 6, 6);
        ctx.fillRect(80, 40, 6, 6);
        
        // Bandana / Shemagh covering lower face
        ctx.fillStyle = '#c0392b';
        ctx.fillRect(16, 68, 96, 44);
        
        // Bandana pattern / wrinkles
        ctx.fillStyle = '#962d22';
        ctx.fillRect(24, 76, 80, 4);
        ctx.fillRect(20, 88, 88, 4);
        ctx.fillRect(28, 100, 72, 4);
        
        // Headband
        ctx.fillStyle = '#7f1d1d';
        ctx.fillRect(16, 16, 96, 12);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

let cachedBotFaceTextures = { CT: null, T: null };
function getProceduralBotFaceTexture(team) {
    if (!cachedBotFaceTextures[team]) {
        cachedBotFaceTextures[team] = createProceduralBotFaceTexture(team);
    }
    return cachedBotFaceTextures[team];
}

if (typeof window !== 'undefined') {
    window.createProceduralBotFaceTexture = createProceduralBotFaceTexture;
    window.getProceduralBotFaceTexture = getProceduralBotFaceTexture;
}

function spawnBots(ctSpawns, tSpawns) {
    const ctMat = new THREE.MeshStandardMaterial({ color: 0x3498db }); // Blue for CT
    const tMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });  // Orange for T
    
    // Procedural cartoon / tactical faces generated via HTML5 Canvas (100% offline & zero network latency)
    const ctFaceTexture = getProceduralBotFaceTexture('CT');
    const tFaceTexture = getProceduralBotFaceTexture('T');
    
    const ctFaceMat = new THREE.MeshStandardMaterial({ map: ctFaceTexture, color: 0xffffff });
    const tFaceMat = new THREE.MeshStandardMaterial({ map: tFaceTexture, color: 0xffffff });
    
    let ctCount = 0;
    let tCount = 0;
    
    const spawnBot = (team, x, z) => {
        const teamColor = team === 'CT' ? 0x3498db : 0xe67e22;
        const bodyMat = (team === 'CT' ? ctMat : tMat).clone();
        const faceMat = (team === 'CT' ? ctFaceMat : tFaceMat).clone();

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Torso
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 1.7; 
        bodyMesh.name = 'body';
        group.add(bodyMesh);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.name = 'body';
        group.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeo, bodyMat);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.name = 'body';
        group.add(rightLeg);

        // Cartoon Head (More proportional)
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const materials = [
            bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat
        ];
        const headMesh = new THREE.Mesh(headGeo, materials);
        headMesh.position.y = 2.8;
        headMesh.name = 'head';
        group.add(headMesh);
        
        // Arms
        const handGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const handMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d });
        
        const leftHand = new THREE.Mesh(handGeo, handMat);
        leftHand.position.set(-0.9, 1.8, 0.3);
        group.add(leftHand);

        const rightHand = new THREE.Mesh(handGeo, handMat);
        rightHand.position.set(0.9, 1.8, 0.3);
        group.add(rightHand);
        // Buy logic
        let money = team === 'T' ? matchState.botMoneyT[tCount] : matchState.botMoneyCT[ctCount];
        let weaponId = 'pistol';
        let hasDrone = false;
        
        if (money >= 800 && Math.random() < 0.25) {
            hasDrone = true;
            money -= 800;
        }

        if (money >= 4750) { weaponId = 'sniper'; money -= 4750; }
        else if (money >= 3500) { weaponId = 'marksman'; money -= 3300; }
        else if (money >= 3100) { weaponId = 'rifle'; money -= 2700; }
        else if (money >= 1500) { weaponId = 'smg'; money -= 1500; }
        else if (money >= 1200) { weaponId = 'shotgun'; money -= 1200; }
        else if (money >= 700) { weaponId = 'deagle'; money -= 700; }
        
        if (team === 'T') { matchState.botMoneyT[tCount] = money; tCount++; }
        else { matchState.botMoneyCT[ctCount] = money; ctCount++; }
        
        // Weapon
        const wInfo = WEAPONS[weaponId];
        const gunGeo = new THREE.BoxGeometry(0.15, 0.15, wInfo.length);
        const gunMat = new THREE.MeshStandardMaterial({ color: wInfo.color });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        gunMesh.name = 'gun';
        
        // Magazine
        const botMagGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
        const botMagMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const botMag = new THREE.Mesh(botMagGeo, botMagMat);
        botMag.position.set(0, -0.15, 0.1);
        botMag.name = 'magazine';
        gunMesh.add(botMag);
        
        gunMesh.position.set(0.9, 1.8, 0.8);
        group.add(gunMesh);

        scene.add(group);

        bots.push({
            id: Math.random().toString(36).substring(7),
            team: team,
            mesh: group,
            hp: 100,
            maxHp: 100,
            isZombie: false,
            isDead: false,
            respawnTimer: 0,
            targetNode: new THREE.Vector3(x + (Math.random()-0.5)*40, 0, z + (Math.random()-0.5)*40),
            lastShot: 0,
            weapon: weaponId,
            kills: 0,
            actionProgress: 0,
            burnStacks: 0,
            burnTimer: 0,
            poisonTimer: 0,
            poisonDelay: 0,
            poisonDamageApplied: false,
            stunTimer: 0,
            freezeTimer: 0,
            freezeStacks: 0,
            bombTarget: null,
            hasDrone: hasDrone,
            isControllingDrone: false
        });
    };

    if (gameMode === 'zombie') {
        // 生化模式: 全员人类(CT)阵营，等待感染爆发
        for (let i = 0; i < 5; i++) {
            let spawnPos = ctSpawns[i];
            let numBots = (i === 0) ? 1 : 2;
            for (let j = 0; j < numBots; j++) {
                spawnBot('CT', spawnPos.x + (Math.random()-0.5)*4, spawnPos.z + (Math.random()-0.5)*4);
            }
        }
    } else {
        // Spawn CT Squads
        for (let i = 0; i < 5; i++) {
            let spawnPos = ctSpawns[i];
            let numBots = (playerState.team === 'CT' && i === 0) ? 1 : 2;
            for (let j = 0; j < numBots; j++) {
                spawnBot('CT', spawnPos.x + (Math.random()-0.5)*4, spawnPos.z + (Math.random()-0.5)*4);
            }
        }
        // Spawn T Squads
        for (let i = 0; i < 5; i++) {
            let spawnPos = tSpawns[i];
            let numBots = (playerState.team === 'T' && i === 0) ? 1 : 2;
            for (let j = 0; j < numBots; j++) {
                spawnBot('T', spawnPos.x + (Math.random()-0.5)*4, spawnPos.z + (Math.random()-0.5)*4);
            }
        }
    }

    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTime = 240;

    if (gameMode === 'zombie') {
        // 生化模式计时: 前15秒购买窗口 → 感染爆发 → 生存倒计时
        zombieState.pending = true;
        zombieState.countdown = ZOMBIE.infectionDelay;
        const cdEl = document.getElementById('zombie-countdown');
        if (cdEl) {
            cdEl.classList.remove('hidden');
            cdEl.innerText = `感染爆发倒计时: ${zombieState.countdown} 秒`;
        }
        roundTimerInterval = setInterval(() => {
            if (!roundActive) return;
            roundTime--;
            if (zombieState.pending) {
                zombieState.countdown--;
                const cdEl2 = document.getElementById('zombie-countdown');
                if (zombieState.countdown > 0) {
                    if (cdEl2) cdEl2.innerText = `感染爆发倒计时: ${zombieState.countdown} 秒`;
                } else if (cdEl2) {
                    cdEl2.classList.add('hidden');
                }
                if (zombieState.countdown <= 0) outbreakInfection();
            }
            if (roundTime <= 0) {
                endRound("时间到！人类幸存者获胜！", false, 'time');
            }
            updateHUD();
        }, 1000);
    } else {
        roundTimerInterval = setInterval(() => {
            if (roundActive && !bombState.planted) {
                roundTime--;
                if (roundTime === 120 && !wallhackActive) {
                    activateWallhack("剩余两分钟！全图透视与死斗模式开启！");
                }
                if (roundTime <= 0) {
                    endRound("时间到！反恐精英获胜", false, 'time');
                }
                updateHUD();
            }
        }, 1000);
    }
}

function disposeBulletMesh(b) {
    // Bullets use shared geometry/material — no GPU resources to dispose per bullet
    // Just remove from scene; shared resources persist for game lifetime
    if (!b.mesh) return;
}

function hasBulletType(b, type) {
    if (b.bulletTypes) return b.bulletTypes.includes(type);
    return b.bulletType === type;
}

function createBullet(start, direction, weapon, shooterInfo) {
    const isShotgun = weapon && weapon.id === 'shotgun';
    const bt = shooterInfo.bulletType || 'normal';
    const bts = shooterInfo.bulletTypes || null;
    let mat;
    if (isShotgun) {
        mat = sharedBulletMatOrange;
    } else if (bts && bts.length > 1) {
        mat = sharedBulletMatWhite;
    } else if (bt === 'incendiary') {
        mat = sharedBulletMatRed;
    } else if (bt === 'poison') {
        mat = sharedBulletMatGreen;
    } else if (bt === 'tracking') {
        mat = sharedBulletMatCyan;
    } else if (bt === 'light') {
        mat = sharedBulletMatLightBlue;
    } else if (bt === 'dual') {
        mat = sharedBulletMatMagenta;
    } else if (bt === 'shock') {
        mat = sharedBulletMatShock;
    } else if (bt === 'freeze') {
        mat = sharedBulletMatFreeze;
    } else if (bt === 'ricochet') {
        mat = sharedBulletMatRicochet;
    } else if (bt === 'fragment') {
        mat = sharedBulletMatFragment;
    } else {
        mat = sharedBulletMatYellow;
    }
    const isGatling = weapon && weapon.id === 'gatling';
    const mesh = new THREE.Mesh(isGatling ? sharedBulletGeoGatling : sharedBulletGeo, mat);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), direction);
    scene.add(mesh);
    
    if (isShotgun) {
        for (let j = 0; j < 3; j++) {
            let flame = new THREE.Mesh(sharedFlameGeo, sharedFlameMat);
            flame.position.set((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.8);
            flame.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            mesh.add(flame);
        }
    }
    
    bullets.push({
        mesh: mesh,
        direction: direction,
        weapon: weapon,
        shooter: shooterInfo,
        bulletType: shooterInfo.bulletType || 'normal',
        bulletTypes: shooterInfo.bulletTypes || null,
        distance: 0,
        maxDistance: weapon.range,
        hitRadius: isGatling ? 3.5 : 2.0,
        divergenceSide: shooterInfo.divergenceSide || 0
    });
}

// 电击/冰冻状态应用（仅对Bot生效，靶场目标无AI不受影响）
function applyBulletStatusEffects(b, bot, hitPoint) {
    if (!bot || bot.stunTimer === undefined) return;
    if (hasBulletType(b, 'shock')) {
        bot.stunTimer = BULLET_TYPES.shock.stunFrames;
        createShockEffect(hitPoint);
    }
    if (hasBulletType(b, 'freeze')) {
        const cfg = BULLET_TYPES.freeze;
        bot.freezeStacks = Math.min(cfg.maxFreezeStacks, (bot.freezeStacks || 0) + 1);
        bot.freezeTimer = cfg.freezeFrames;
        createFreezeEffect(hitPoint);
    }
}

// 破片子弹: 命中敌人后分裂弹丸向四周飞散（弹丸不再二次分裂）
function spawnFragmentPellets(b, hitPoint) {
    const cfg = BULLET_TYPES.fragment;
    for (let k = 0; k < cfg.fragmentCount; k++) {
        const ang = Math.random() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(ang), Math.random() * 0.4 - 0.1, Math.sin(ang)).normalize();
        createBullet(hitPoint.clone(), dir, b.weapon, { team: b.shooter.team, isPlayer: !!b.shooter.isPlayer });
        const pellet = bullets[bullets.length - 1];
        if (pellet) {
            pellet.isFragmentPellet = true;
            pellet.fragmentMult = cfg.fragmentDamageRatio;
        }
    }
}

// --- 粒子对象池 (Zero-Allocation Particle Pool) ---
const PARTICLE_POOL_SIZE = 1024;
let particlePool = null;
let particlePoolFree = null;

function initParticlePool() {
    if (particlePool) return;
    particlePool = [];
    particlePoolFree = [];
    for (let i = 0; i < PARTICLE_POOL_SIZE; i++) {
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 1.0 });
        mat.isPooled = true;
        const mesh = new THREE.Mesh(sharedParticleGeo, mat);
        mesh.frustumCulled = false;
        const p = {
            mesh: mesh,
            velocity: new THREE.Vector3(),
            life: 0,
            opacityMult: 1,
            inUse: false,
            isPooled: true
        };
        particlePool.push(p);
        particlePoolFree.push(p);
    }
}
initParticlePool();

function obtainParticle(geometry, color, x, y, z, vx, vy, vz, life, opacityMult = 1, scale = 1.0) {
    initParticlePool();
    let p = null;
    if (particlePoolFree && particlePoolFree.length > 0) {
        p = particlePoolFree.pop();
    } else if (particles.length > 0) {
        // Recycle oldest active particle in O(1)
        p = particles.shift();
        if (p.mesh && p.mesh.parent) {
            scene.remove(p.mesh);
        }
    } else {
        p = particlePool[0];
        if (p.mesh && p.mesh.parent) {
            scene.remove(p.mesh);
        }
    }
    
    p.inUse = true;
    p.life = life;
    p.opacityMult = opacityMult;
    p.mesh.geometry = geometry || sharedParticleGeo;
    p.mesh.material.color.setHex(color);
    p.mesh.material.opacity = opacityMult;
    p.mesh.material.transparent = true;
    p.mesh.position.set(x, y, z);
    p.mesh.scale.setScalar(scale);
    p.velocity.set(vx, vy, vz);
    
    scene.add(p.mesh);
    particles.push(p);
    return p;
}

// --- 弹道射线检测 2D 空间分区网格 (Spatial Grid) ---
const BULLET_GRID_CELL_SIZE = 40;
const BULLET_GRID_MIN_X = -450;
const BULLET_GRID_MAX_X = 450;
const BULLET_GRID_MIN_Z = -450;
const BULLET_GRID_MAX_Z = 450;
const BULLET_GRID_COLS = Math.ceil((BULLET_GRID_MAX_X - BULLET_GRID_MIN_X) / BULLET_GRID_CELL_SIZE);
const BULLET_GRID_ROWS = Math.ceil((BULLET_GRID_MAX_Z - BULLET_GRID_MIN_Z) / BULLET_GRID_CELL_SIZE);
const TOTAL_BULLET_CELLS = BULLET_GRID_COLS * BULLET_GRID_ROWS;

let bulletSpatialGrid = null;
let spatialGridMeshCount = -1;
let _spatialQueryStamp = 0;
const _spatialQueryResults = [];
const _bulletNextPos = new THREE.Vector3();

function rebuildBulletSpatialGrid() {
    bulletSpatialGrid = new Array(TOTAL_BULLET_CELLS);
    for (let i = 0; i < TOTAL_BULLET_CELLS; i++) {
        bulletSpatialGrid[i] = [];
    }
    
    if (typeof collidableMeshList !== 'undefined') {
        for (let i = 0; i < collidableMeshList.length; i++) {
            const mesh = collidableMeshList[i];
            if (!mesh.worldBox) {
                mesh.worldBox = new THREE.Box3().setFromObject(mesh);
            }
            const box = mesh.worldBox;
            if (box.max.x < BULLET_GRID_MIN_X || box.min.x > BULLET_GRID_MAX_X || box.max.z < BULLET_GRID_MIN_Z || box.min.z > BULLET_GRID_MAX_Z) {
                continue;
            }
            
            let minCol = Math.max(0, Math.min(BULLET_GRID_COLS - 1, Math.floor((box.min.x - BULLET_GRID_MIN_X) / BULLET_GRID_CELL_SIZE)));
            let maxCol = Math.max(0, Math.min(BULLET_GRID_COLS - 1, Math.floor((box.max.x - BULLET_GRID_MIN_X) / BULLET_GRID_CELL_SIZE)));
            let minRow = Math.max(0, Math.min(BULLET_GRID_ROWS - 1, Math.floor((box.min.z - BULLET_GRID_MIN_Z) / BULLET_GRID_CELL_SIZE)));
            let maxRow = Math.max(0, Math.min(BULLET_GRID_ROWS - 1, Math.floor((box.max.z - BULLET_GRID_MIN_Z) / BULLET_GRID_CELL_SIZE)));
            
            for (let c = minCol; c <= maxCol; c++) {
                for (let r = minRow; r <= maxRow; r++) {
                    bulletSpatialGrid[r * BULLET_GRID_COLS + c].push(mesh);
                }
            }
        }
        spatialGridMeshCount = collidableMeshList.length;
    }
}

function queryBulletSpatialTargets(startPos, endPos, hitRadius) {
    if (!bulletSpatialGrid || (typeof collidableMeshList !== 'undefined' && spatialGridMeshCount !== collidableMeshList.length)) {
        rebuildBulletSpatialGrid();
    }
    
    _spatialQueryResults.length = 0;
    _spatialQueryStamp++;
    if (_spatialQueryStamp >= 0x7FFFFFFF) _spatialQueryStamp = 1;
    
    const pad = Math.max(4.0, hitRadius || 2.0);
    const minX = Math.min(startPos.x, endPos.x) - pad;
    const maxX = Math.max(startPos.x, endPos.x) + pad;
    const minZ = Math.min(startPos.z, endPos.z) - pad;
    const maxZ = Math.max(startPos.z, endPos.z) + pad;
    
    const hasGridOverlap = !(maxX < BULLET_GRID_MIN_X || minX > BULLET_GRID_MAX_X || maxZ < BULLET_GRID_MIN_Z || minZ > BULLET_GRID_MAX_Z);
    if (bulletSpatialGrid && hasGridOverlap) {
        let minCol = Math.max(0, Math.min(BULLET_GRID_COLS - 1, Math.floor((minX - BULLET_GRID_MIN_X) / BULLET_GRID_CELL_SIZE)));
        let maxCol = Math.max(0, Math.min(BULLET_GRID_COLS - 1, Math.floor((maxX - BULLET_GRID_MIN_X) / BULLET_GRID_CELL_SIZE)));
        let minRow = Math.max(0, Math.min(BULLET_GRID_ROWS - 1, Math.floor((minZ - BULLET_GRID_MIN_Z) / BULLET_GRID_CELL_SIZE)));
        let maxRow = Math.max(0, Math.min(BULLET_GRID_ROWS - 1, Math.floor((maxZ - BULLET_GRID_MIN_Z) / BULLET_GRID_CELL_SIZE)));

        for (let c = minCol; c <= maxCol; c++) {
            for (let r = minRow; r <= maxRow; r++) {
                const cell = bulletSpatialGrid[r * BULLET_GRID_COLS + c];
                for (let i = 0; i < cell.length; i++) {
                    const mesh = cell[i];
                    if (mesh._spatialStamp !== _spatialQueryStamp) {
                        mesh._spatialStamp = _spatialQueryStamp;
                        _spatialQueryResults.push(mesh);
                    }
                }
            }
        }
    }
    
    if (typeof bots !== 'undefined') {
        for (let j = 0; j < bots.length; j++) {
            const bot = bots[j];
            if (bot.isDead || !bot.mesh) continue;
            const bp = bot.mesh.position;
            if (bp.x >= minX - 2 && bp.x <= maxX + 2 && bp.z >= minZ - 2 && bp.z <= maxZ + 2) {
                _spatialQueryResults.push(bot.mesh);
            }
        }
    }
    
    if (typeof activeDrones !== 'undefined') {
        for (let j = 0; j < activeDrones.length; j++) {
            const drone = activeDrones[j];
            if (!drone.mesh) continue;
            const dp = drone.mesh.position;
            if (dp.x >= minX - 2 && dp.x <= maxX + 2 && dp.z >= minZ - 2 && dp.z <= maxZ + 2) {
                _spatialQueryResults.push(drone.mesh);
            }
        }
    }
    
    return _spatialQueryResults;
}

function createShockEffect(pos) {
    for (let i = 0; i < 8; i++) {
        const pColor = Math.random() > 0.5 ? 0xcc66ff : 0xffffff;
        const vx = (Math.random()-0.5)*18;
        const vy = (Math.random()-0.5)*18;
        const vz = (Math.random()-0.5)*18;
        obtainParticle(sharedParticleGeo, pColor, pos.x, pos.y, pos.z, vx, vy, vz, 0.35 + Math.random() * 0.2, 1.0, 1.0);
    }
}

function createFreezeEffect(pos) {
    for (let i = 0; i < 8; i++) {
        const pColor = Math.random() > 0.5 ? 0x99e6ff : 0xd9f7ff;
        const vx = (Math.random()-0.5)*6;
        const vy = Math.random()*5 + 1;
        const vz = (Math.random()-0.5)*6;
        obtainParticle(sharedParticleGeo, pColor, pos.x, pos.y, pos.z, vx, vy, vz, 0.5 + Math.random() * 0.3, 1.0, 1.0);
    }
}

function updateBullets(delta) {
    const _floorMesh = scene.getObjectByName('floor');
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        
        let speed = 527.34375; // default bullet speed
        if (b.weapon && b.weapon.id === 'sniper') {
            speed = 1230.46875; // sniper rifle
        } else if (b.weapon && b.weapon.id === 'marksman') {
            speed = 1031.25; // marksman
        } else if (b.weapon && b.weapon.id === 'deagle') {
            speed = 685.546875; // deagle
        }

        if (hasBulletType(b, 'tracking')) speed *= 0.135; // 追踪子弹: 基础速度的13.5%（原10%，+35%）
        if (hasBulletType(b, 'light')) speed *= 1.2;
        if (hasBulletType(b, 'dual')) speed *= 0.35;
        if (hasBulletType(b, 'ricochet') && b.ricochetCount) speed *= Math.pow(0.8, b.ricochetCount); // 跳弹: 每反弹一次弹速-20%（累计）

        const moveDist = speed * delta;
        b.distance += moveDist;

        // Tracking bullet: steer toward nearest enemy or range target (low efficiency)
        if (hasBulletType(b, 'tracking')) {
            // 每0.1秒有3%概率追踪失败: 失败后永久脱锁, 偏转向其他方向飞去
            if (b.trackCheckAcc === undefined) b.trackCheckAcc = 0;
            if (b.trackLost === undefined) b.trackLost = false;
            b.trackCheckAcc += delta;
            if (b.trackCheckAcc >= 0.1) {
                b.trackCheckAcc = 0;
                if (Math.random() < 0.03) {
                    b.trackLost = true;
                    // 随机偏转: 水平±36° + 垂直±20°
                    const yaw = (Math.random() * 2 - 1) * (Math.PI / 5);
                    const pitch = (Math.random() * 2 - 1) * (Math.PI / 9);
                    b.direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
                    const rightAxis = new THREE.Vector3().crossVectors(b.direction, new THREE.Vector3(0, 1, 0)).normalize();
                    b.direction.applyAxisAngle(rightAxis, pitch).normalize();
                    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.direction);
                }
            }
            if (!b.trackLost) {
                let nearestTarget = null;
                let nearestDistSq = 30 * 30; // 追踪范围30（原60，缩小50%）
                for (let j = 0; j < bots.length; j++) {
                    let bot = bots[j];
                    if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                    let distSq = b.mesh.position.distanceToSquared(bot.mesh.position);
                    if (distSq < nearestDistSq) {
                        nearestDistSq = distSq;
                        nearestTarget = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                    }
                }
                if (nearestTarget) {
                    let targetDir = new THREE.Vector3()
                        .subVectors(nearestTarget, b.mesh.position)
                        .normalize();
                    b.direction.lerp(targetDir, 0.24).normalize();
                    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.direction);
                }
            }
        }

        // 跳弹: 反弹后获得轻微追踪能力，附近无敌人则沿反弹方向直线飞离（脱靶）
        if (hasBulletType(b, 'ricochet') && b.ricochetCount > 0) {
            let ricochetTarget = null;
            let ricochetDistSq = 40 * 40; // 追踪范围40
            for (let j = 0; j < bots.length; j++) {
                let bot = bots[j];
                if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                let distSq = b.mesh.position.distanceToSquared(bot.mesh.position);
                if (distSq < ricochetDistSq) {
                    ricochetDistSq = distSq;
                    ricochetTarget = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
            }
            if (ricochetTarget) {
                let ricochetDir = new THREE.Vector3().subVectors(ricochetTarget, b.mesh.position).normalize();
                b.direction.lerp(ricochetDir, 0.08).normalize(); // 轻微转向（追踪子弹转向系数0.24）
                b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.direction);
            }
        }

        // Dual bullet divergence: gradually curve up/down, growing with distance flown
        if (b.divergenceSide) {
            let divRate = 0.00075 + b.distance * 0.000003375;
            let absDiv = Math.abs(b.direction.y);
            if (absDiv < 0.02) {
                b.direction.y += divRate * b.divergenceSide;
                b.direction.normalize();
                b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), b.direction);
            }
        }

        // Bullet drop: parabolic downward curve based on weapon drop rate (accumulates over distance)
        if (b.weapon && b.weapon.dropRate) {
            if (b.dropAccum === undefined) b.dropAccum = 0;
            b.dropAccum += b.weapon.dropRate * moveDist;
            b.direction.y -= b.dropAccum;
            b.direction.normalize();
            b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), b.direction);
        }

        // Raycast for collision
        raycaster.set(b.mesh.position, b.direction);
        raycaster.far = moveDist;
        
        _bulletNextPos.x = b.mesh.position.x + b.direction.x * moveDist;
        _bulletNextPos.y = b.mesh.position.y + b.direction.y * moveDist;
        _bulletNextPos.z = b.mesh.position.z + b.direction.z * moveDist;
        
        const targets = queryBulletSpatialTargets(b.mesh.position, _bulletNextPos, b.hitRadius);
        if (_floorMesh) targets.push(_floorMesh);
        const intersects = raycaster.intersectObjects(targets, true);
        
        // Player hit check
        let hitPlayer = false;
        let isPlayerHeadshot = false;
        if (b.shooter.team !== playerState.team && playerState.hp > 0 && !playerState.isSpectating) {
            const playerPos = getPlayerPosition();
            const pToB = new THREE.Vector3().subVectors(playerPos, b.mesh.position);
            const projectionLength = pToB.dot(b.direction);
            
            let closestPoint;
            if (projectionLength <= 0) closestPoint = b.mesh.position.clone();
            else if (projectionLength >= moveDist) closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(moveDist));
            else closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(projectionLength));
            
            if (closestPoint.distanceTo(playerPos) < b.hitRadius) {
                if (intersects.length === 0 || intersects[0].distance > projectionLength) {
                    hitPlayer = true;
                    if (closestPoint.y > playerPos.y - 0.4) isPlayerHeadshot = true;
                }
            }
        }
        
        if (hitPlayer) {
            let dmg = b.weapon.damage * 0.75;
            if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) dmg *= 0.70;
            if (hasBulletType(b, 'dual')) dmg *= 0.65;
            if (b.ricochetCount) dmg *= Math.pow(0.8, b.ricochetCount); // 跳弹: 每反弹一次伤害-20%（累计）
            if (b.fragmentMult) dmg *= b.fragmentMult;
            if (isPlayerHeadshot) dmg *= 2.7;
            if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) {
                if (isPlayerHeadshot) dmg *= 0.0125;
                else dmg *= 0.05;
            }
            let finalDmg = dmg;
            if (getCurrentWeapon().id === 'kukri' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) finalDmg *= 0.025;
            else if (getCurrentWeapon().id === 'switchblade') finalDmg *= 0.04;
            if (!playerState.isInvincible) playerState.hp -= Math.ceil(applyArmorReduction(finalDmg));
            if (typeof triggerDamageVignette === 'function') triggerDamageVignette(finalDmg / 35);
            playerState.cameraShake = Math.min(0.03, (playerState.cameraShake || 0) + 0.012);
            if (b.weapon.id === 'shotgun') {
                playerState.burnStacks = Math.min(6, (playerState.burnStacks || 0) + 1);
                playerState.burnTimer = 420;
                playerState.burnSourceTeam = b.shooter.team;
            }
            playerState.lastCombatTime = frameCount;
            updateHUD();
            createHitEffect(getPlayerPosition(), false, b.weapon.id);

            if (hasBulletType(b, 'proximity')) {
                let explosionDmg = dmg * 0.75;
                let explosionPos = getPlayerPosition();
                createExplosionEffect(explosionPos);
                for (let j = 0; j < bots.length; j++) {
                    let bot = bots[j];
                    if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                    let dist = bot.mesh.position.distanceTo(explosionPos);
                    if (dist < 8) {
                        let areaDmg = explosionDmg * (1 - dist / 8);
                        bot.hp -= areaDmg;
                        if (bot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);
                    }
                }
                if (isShootingRange) {
                    rangeTargets.forEach(t => {
                        const dist = t.position.distanceTo(explosionPos);
                        if (dist < 8) {
                            const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                            if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                        }
                    });
                }
            }

            disposeBulletMesh(b);
            scene.remove(b.mesh);
            bullets.splice(i, 1);

            if (playerState.hp <= 0) playerDie(b.team, b.weapon.id);
            continue;
        }

        // Radius-based bot hit check (for larger bullets like Gatling)
        if (b.hitRadius > 2.0) {
            let radiusHitBot = null;
            let radiusHitIndex = -1;
            let radiusHitPoint = null;
            for (let j = 0; j < bots.length; j++) {
                let bot = bots[j];
                if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                let botPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                const pToB = new THREE.Vector3().subVectors(botPos, b.mesh.position);
                const projectionLength = pToB.dot(b.direction);
                if (projectionLength <= 0 || projectionLength >= moveDist) continue;
                let closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(projectionLength));
                if (closestPoint.distanceTo(botPos) < b.hitRadius) {
                    if (intersects.length === 0 || intersects[0].distance > projectionLength) {
                        radiusHitBot = bot;
                        radiusHitIndex = j;
                        radiusHitPoint = closestPoint;
                        break;
                    }
                }
            }
            if (radiusHitBot) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) {
                    if (b.weapon.id === 'sniper') dmg = 48; // AWP+轻型: 身体每发固定48
                    else dmg *= 0.70;
                }
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                if (b.ricochetCount) dmg *= Math.pow(0.8, b.ricochetCount); // 跳弹: 每反弹一次伤害-20%（累计）
                if (b.fragmentMult) dmg *= b.fragmentMult;
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) dmg *= 0.50; // 龙息弹直击伤害减半
                if (b.shooter.isPlayer) dmg *= zombieDmgTakenMult(radiusHitBot);
                radiusHitBot.hp -= dmg;

                applyBulletStatusEffects(b, radiusHitBot, radiusHitPoint);
                if (hasBulletType(b, 'fragment') && !b.isFragmentPellet) spawnFragmentPellets(b, radiusHitPoint);
                if (b.shooter.isPlayer) showFloatingDamage(dmg, radiusHitPoint);

                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((radiusHitBot.burnStacks || 0) < 20) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = 420;
                    radiusHitBot.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((radiusHitBot.burnStacks || 0) < 6) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = 420;
                    radiusHitBot.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((radiusHitBot.burnStacks || 0) < 20) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = Math.max(radiusHitBot.burnTimer || 0, 300);
                    radiusHitBot.burnDamageMult = 0.25;
                }

                if (hasBulletType(b, 'poison')) {
                    radiusHitBot.poisonTimer = 480;
                    radiusHitBot.poisonTickTimer = 34;
                }

                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    radiusHitBot.hp -= explosionDmg;
                    createExplosionEffect(radiusHitPoint);
                    for (let j = 0; j < bots.length; j++) {
                        if (j === radiusHitIndex) continue;
                        let otherBot = bots[j];
                        if (otherBot.team === b.shooter.team || otherBot.hp <= 0 || otherBot.isDead) continue;
                        let dist = otherBot.mesh.position.distanceTo(radiusHitPoint);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            otherBot.hp -= areaDmg;
                            if (otherBot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(radiusHitPoint);
                            if (dist < 8) {
                                const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                            }
                        });
                    }
                }

                createHitEffect(radiusHitPoint, false, b.weapon.id);
                if (radiusHitBot.hp <= 0) killBot(radiusHitIndex, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);

                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
                continue;
            }
        }

        if (intersects.length > 0) {
            const hit = intersects[0];
            let hitBot = null;
            let hitIndex = -1;
            let hitDrone = null;
            for (let j = 0; j < bots.length; j++) {
                if (hit.object === bots[j].mesh || hit.object.parent === bots[j].mesh) {
                    hitBot = bots[j];
                    hitIndex = j;
                    break;
                }
            }
            if (!hitBot) {
                for (let j = 0; j < activeDrones.length; j++) {
                    if (hit.object === activeDrones[j].mesh || hit.object.parent === activeDrones[j].mesh) {
                        hitDrone = activeDrones[j];
                        break;
                    }
                }
            }
            
            let hitRangeTarget = false;
            if (!hitBot && !hitDrone && isShootingRange) {
                if (hit.object.name === 'rangeTargetHead' || hit.object.name === 'rangeTargetBody') {
                    hitRangeTarget = true;
                }
            }
            
            if (hitRangeTarget) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) {
                    if (b.weapon.id === 'sniper') dmg = 48; // AWP+轻型: 身体每发固定48
                    else dmg *= 0.70;
                }
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                if (b.ricochetCount) dmg *= Math.pow(0.8, b.ricochetCount); // 跳弹: 每反弹一次伤害-20%（累计）
                if (b.fragmentMult) dmg *= b.fragmentMult;
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) dmg *= 0.50; // 龙息弹直击伤害减半
                if (hit.object.name === 'rangeTargetHead') dmg *= 3.0; // Headshot multiplier
                showFloatingDamage(dmg, hit.point);
                if (b.shooter.isPlayer && typeof playHitMarkerSound === 'function') playHitMarkerSound(hit.object.name === 'rangeTargetHead');
                if (hasBulletType(b, 'fragment') && !b.isFragmentPellet) spawnFragmentPellets(b, hit.point);

                // Add burn/poison effects to the target group
                let targetObj = hit.object.parent;
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = 420;
                    targetObj.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((targetObj.burnStacks || 0) < 6) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = 420;
                    targetObj.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = Math.max(targetObj.burnTimer || 0, 300);
                    targetObj.burnDamageMult = 0.25;
                }

                if (hasBulletType(b, 'poison')) {
                    targetObj.poisonTimer = 360;
                    targetObj.poisonTickTimer = 34;
                }
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    createExplosionEffect(hit.point);
                    showFloatingDamage(explosionDmg, hit.point);
                    rangeTargets.forEach(t => {
                        if (t === targetObj) return;
                        const dist = t.position.distanceTo(hit.point);
                        if (dist < 8) {
                            const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                            if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                        }
                    });
                }
                
                createHitEffect(hit.point, false, b.weapon.id);
                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
                continue;
            }
            
            if (hitBot && hitBot.team !== b.shooter.team) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) {
                    if (b.weapon.id === 'sniper') dmg = 48; // AWP+轻型: 身体每发固定48
                    else dmg *= 0.70;
                }
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                if (b.ricochetCount) dmg *= Math.pow(0.8, b.ricochetCount); // 跳弹: 每反弹一次伤害-20%（累计）
                if (b.fragmentMult) dmg *= b.fragmentMult;
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) dmg *= 0.50; // 龙息弹直击伤害减半
                if (hit.object.name === 'head') dmg *= 3.0; // Headshot
                if (b.shooter.isPlayer) {
                    dmg *= zombieDmgTakenMult(hitBot);
                    if (typeof playHitMarkerSound === 'function') playHitMarkerSound(hit.object.name === 'head');
                }
                hitBot.hp -= dmg;

                applyBulletStatusEffects(b, hitBot, hit.point);
                if (hasBulletType(b, 'fragment') && !b.isFragmentPellet) spawnFragmentPellets(b, hit.point);
                if (b.shooter.isPlayer) showFloatingDamage(dmg, hit.point, hit.object.name === 'head');
                // Burn effects (shotgun dragon breath + incendiary synergy)
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = 420;
                    hitBot.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((hitBot.burnStacks || 0) < 6) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = 420;
                    hitBot.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = Math.max(hitBot.burnTimer || 0, 300);
                    hitBot.burnDamageMult = 0.25;
                }

                // Poison effect (independent)
                if (hasBulletType(b, 'poison')) {
                    hitBot.poisonTimer = 480;
                    hitBot.poisonTickTimer = 34;
                }
                // Proximity explosion (independent)
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    hitBot.hp -= explosionDmg;
                    createExplosionEffect(hit.point);
                    for (let j = 0; j < bots.length; j++) {
                        if (j === hitIndex) continue;
                        let otherBot = bots[j];
                        if (otherBot.team === b.shooter.team || otherBot.hp <= 0 || otherBot.isDead) continue;
                        let dist = otherBot.mesh.position.distanceTo(hit.point);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            otherBot.hp -= areaDmg;
                            if (otherBot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(hit.point);
                            if (dist < 8) {
                                const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                            }
                        });
                    }
                }

                createHitEffect(hit.point, false, b.weapon.id);

                if (hitBot.hp <= 0) killBot(hitIndex, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);
            } else if (hitDrone && hitDrone.team !== b.shooter.team) {
                hitDrone.hp -= b.weapon.damage;
                createHitEffect(hit.point, false, b.weapon.id);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (!hitBot && !hitDrone) {
                createHitEffect(hit.point, true, b.weapon.id); // Wall hit
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = b.weapon.damage * 0.75;
                    createExplosionEffect(hit.point);
                    for (let j = 0; j < bots.length; j++) {
                        let bot = bots[j];
                        if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                        let dist = bot.mesh.position.distanceTo(hit.point);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            if (b.shooter.isPlayer) areaDmg *= zombieDmgTakenMult(bot);
                            bot.hp -= areaDmg;
                            if (bot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id, !!b.shooter.isPlayer, b.shooter.isPlayer ? null : b.shooter);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(hit.point);
                            if (dist < 8) {
                                const dmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (dmg > 0) showFloatingDamage(dmg, t.position);
                            }
                        });
                    }
                }

                // 跳弹: 命中墙壁/地面最多反弹5次继续飞行，每弹一次伤害-20%、弹速-20%，反弹后轻微追踪附近敌人
                if (hasBulletType(b, 'ricochet') && (b.ricochetCount || 0) < 5 && hit.face) {
                    b.ricochetCount = (b.ricochetCount || 0) + 1;
                    const bounceNormal = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
                    b.direction.reflect(bounceNormal).normalize();
                    b.mesh.position.copy(hit.point).addScaledVector(bounceNormal, 1.0);
                    b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), b.direction);
                    continue; // 保留子弹继续飞行
                }
            }

            disposeBulletMesh(b);
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        } else {
            b.mesh.position.add(b.direction.clone().multiplyScalar(moveDist));
            if (b.distance >= 2000) { // Fix: don't despawn based on weapon.range, use map size limit
                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
            }
        }
    }
}

function createBurnParticle(pos) {
    const pColor = Math.random() > 0.4 ? 0xff0000 : 0xff5500;
    const px = pos.x + (Math.random() - 0.5) * 1.5;
    const py = pos.y + (Math.random() - 0.5) * 1.5;
    const pz = pos.z + (Math.random() - 0.5) * 1.5;
    const vx = (Math.random() - 0.5) * 5;
    const vy = Math.random() * 8 + 2;
    const vz = (Math.random() - 0.5) * 5;
    obtainParticle(sharedParticleGeo, pColor, px, py, pz, vx, vy, vz, 0.8 + Math.random() * 0.4, 1.0, 1.0);
}

function createHitEffect(pos, isWall, weaponId = null) {
    const color = isWall ? 0xaaaaaa : 0xff0000;
    const isDragonBreath = weaponId === 'shotgun';
    const count = isDragonBreath ? 7 : 5;
    
    for (let i = 0; i < count; i++) {
        const pColor = isDragonBreath ? (Math.random() > 0.4 ? 0xff0000 : 0xff5500) : color;
        let vx, vy, vz;
        if (isDragonBreath) {
            vx = (Math.random() - 0.5) * 15;
            vy = Math.random() * 15;
            vz = (Math.random() - 0.5) * 15;
        } else {
            vx = (Math.random() - 0.5) * 10;
            vy = Math.random() * 10;
            vz = (Math.random() - 0.5) * 10;
        }
        const life = isDragonBreath ? 1.5 + Math.random() * 0.5 : 1.0;
        obtainParticle(sharedParticleGeo, pColor, pos.x, pos.y, pos.z, vx, vy, vz, life, 1.0, 1.0);
    }
}

function createExplosionEffect(pos) {
    const count = 15;
    for (let i = 0; i < count; i++) {
        const pColor = Math.random() > 0.3 ? 0xff6600 : 0xffaa00;
        const vx = (Math.random() - 0.5) * 25;
        const vy = Math.random() * 20;
        const vz = (Math.random() - 0.5) * 25;
        const life = 1.2 + Math.random() * 0.6;
        obtainParticle(sharedParticleGeo, pColor, pos.x, pos.y, pos.z, vx, vy, vz, life, 1.0, 1.0);
    }
}

function createPoisonParticle(pos) {
    const px = pos.x + (Math.random() - 0.5) * 1.2;
    const py = pos.y;
    const pz = pos.z + (Math.random() - 0.5) * 1.2;
    const vx = (Math.random() - 0.5) * 3;
    const vy = Math.random() * 4 + 1;
    const vz = (Math.random() - 0.5) * 3;
    obtainParticle(sharedParticleGeo, 0x44ff00, px, py, pz, vx, vy, vz, 0.6 + Math.random() * 0.3, 1.0, 1.0);
}

function createMuzzleFire(pos, dir) {
    const count = 6;
    const px = pos.x + dir.x * 2.5;
    const py = pos.y + dir.y * 2.5;
    const pz = pos.z + dir.z * 2.5;
    for (let i = 0; i < count; i++) {
        const pColor = Math.random() > 0.4 ? 0xff0000 : 0xff5500;
        const speed = 25 + Math.random() * 15;
        const vx = dir.x * speed + (Math.random() - 0.5) * 4;
        const vy = dir.y * speed + (Math.random() - 0.5) * 4;
        const vz = dir.z * speed + (Math.random() - 0.5) * 4;
        obtainParticle(sharedMuzzleGeo, pColor, px, py, pz, vx, vy, vz, 0.3 + Math.random() * 0.3, 1.0, 1.0);
    }
}

function createFlameStream(pos, dir, range) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const r = Math.random();
        const pColor = r > 0.5 ? 0xff6600 : (r > 0.2 ? 0xffaa00 : 0xff3300);
        const px = pos.x + (Math.random() - 0.5) * 0.4;
        const py = pos.y + (Math.random() - 0.5) * 0.4;
        const pz = pos.z + (Math.random() - 0.5) * 0.4;
        const speed = 30 + Math.random() * 25;
        const vx = dir.x * speed + (Math.random() - 0.5) * 8;
        const vy = dir.y * speed + (Math.random() - 0.5) * 8;
        const vz = dir.z * speed + (Math.random() - 0.5) * 8;
        const scale = 1.0 + Math.random() * 0.8;
        obtainParticle(sharedMuzzleGeo, pColor, px, py, pz, vx, vy, vz, 0.3 + Math.random() * 0.4, 0.2, scale);
    }
}

function showFloatingDamage(amount, worldPos, isHeadshot = false) {
    if (amount <= 0) return;

    const container = document.getElementById('damage-numbers');
    if (!container) return;

    const elem = document.createElement('div');
    elem.className = 'damage-text';
    if (isHeadshot) elem.style.color = '#ff4d4d';
    elem.innerText = Math.ceil(amount);
    
    const offsetPos = worldPos.clone();
    offsetPos.x += (Math.random() - 0.5) * 1.5;
    offsetPos.y += 0.5 + Math.random() * 1.0;
    offsetPos.z += (Math.random() - 0.5) * 1.5;
    
    container.appendChild(elem);
    
    floatingDamages.push({
        elem: elem,
        pos: offsetPos,
        life: 1.5,
        maxLife: 1.5
    });
}

function updateFloatingDamages(delta) {
    for (let i = floatingDamages.length - 1; i >= 0; i--) {
        const fd = floatingDamages[i];
        fd.life -= delta;
        if (fd.life <= 0) {
            if (fd.elem.parentNode) fd.elem.parentNode.removeChild(fd.elem);
            floatingDamages.splice(i, 1);
            continue;
        }
        
        fd.pos.y += 1.0 * delta; // float up
        
        const temp = fd.pos.clone();
        temp.project(camera);
        
        if (temp.z > 1) {
            fd.elem.style.display = 'none'; // Behind camera
        } else {
            fd.elem.style.display = 'block';
            const x = (temp.x * 0.5 + 0.5) * window.innerWidth;
            const y = (temp.y * -0.5 + 0.5) * window.innerHeight;
            fd.elem.style.left = `${x}px`;
            fd.elem.style.top = `${y}px`;
            
            const alpha = Math.min(1, fd.life / (fd.maxLife * 0.5)); // fade out
            fd.elem.style.opacity = alpha;
            fd.elem.style.transform = `translate(-50%, -50%) scale(${1 + (1 - fd.life/fd.maxLife)*0.5})`;
        }
    }
}

function updateMagazines(delta) {
    for (let i = droppedMagazines.length - 1; i >= 0; i--) {
        const mag = droppedMagazines[i];
        mag.life -= delta;
        if (mag.life <= 0) {
            scene.remove(mag.mesh);
            if (mag.mesh.geometry) mag.mesh.geometry.dispose();
            if (mag.mesh.material) {
                if (Array.isArray(mag.mesh.material)) mag.mesh.material.forEach(m => m.dispose());
                else mag.mesh.material.dispose();
            }
            droppedMagazines.splice(i, 1);
            continue;
        }

        mag.velocity.y -= 20 * delta; // Gravity
        
        const nextPos = mag.mesh.position.clone().add(mag.velocity.clone().multiplyScalar(delta));
        if (nextPos.y <= 0.05) {
            nextPos.y = 0.05;
            mag.velocity.y *= -0.4; // Bounce
            mag.velocity.x *= 0.7; // Friction
            mag.velocity.z *= 0.7;
        } else {
            mag.mesh.rotation.x += mag.rotSpeed.x * delta;
            mag.mesh.rotation.y += mag.rotSpeed.y * delta;
            mag.mesh.rotation.z += mag.rotSpeed.z * delta;
        }
        
        mag.mesh.position.copy(nextPos);
    }
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= delta * 2;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            p.inUse = false;
            // Only dispose non-pooled materials; return pooled particles to free stack
            if (!p.isPooled && p.mesh && p.mesh.material) {
                p.mesh.material.dispose();
            } else if (p.isPooled && particlePoolFree) {
                particlePoolFree.push(p);
            }
            particles.splice(i, 1);
        } else {
            p.velocity.y -= 20 * delta; // gravity
            p.mesh.position.x += p.velocity.x * delta;
            p.mesh.position.y += p.velocity.y * delta;
            p.mesh.position.z += p.velocity.z * delta;
            p.mesh.material.opacity = Math.max(0, Math.min(1.0, p.life * (p.opacityMult || 1)));
            p.mesh.material.transparent = true;
        }
    }
}

if (typeof window !== 'undefined') {
    window.obtainParticle = obtainParticle;
    window.getParticlePool = () => particlePool;
    window.getParticlePoolFree = () => particlePoolFree;
    window.rebuildBulletSpatialGrid = rebuildBulletSpatialGrid;
    window.queryBulletSpatialTargets = queryBulletSpatialTargets;
}

// #endregion
