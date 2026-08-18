// ═══════════════════════════════════════════════════════════════════════
// 反恐行动：3D 爆破 — game.js 文件目录索引
// ═══════════════════════════════════════════════════════════════════════
//
// #region 全局状态与配置 .............. 第 70 行
//   全局变量、经济系统、武器定义、后坐力表、难度设置、背包/弹药状态
//
// #region 游戏模式与回合管理 .......... 第 166 行
//   startGame / startShootingRange / exitShootingRange
//   openBuyMenu / buyWeapon / switchWeapon / handleReload
//   endRound / nextRound / showKillFeed
//
// #region Three.js 场景初始化 ......... 第 593 行
//   scene / camera / renderer / controls / raycaster
//   playerState / getPlayerPosition / createPlayerDummy
//   bombState / 输入状态 / cycleSpectator
//   音效系统 (playKnifeSwingSound / playKukriSwingSound)
//
// #region 导航网格与寻路 .............. 第 934 行
//   NAV_GRID 常量 / buildNavGrid / getGridPos / getWorldPos
//   findPath (A*) / findFlankPath (侧翼包抄)
//
// #region 地图构建 .................... 第 1092 行
//   init3DGame / rebuildMap / buildShootingRangeMap / buildLargeMap
//   createProceduralTexture (程序化纹理)
//   getValidSpawnPoint / resetRound
//
// #region 武器视图模型 ................ 第 1561 行
//   createC4 / createKarambit / createKukri / createSwitchblade
//   buildViewModel / updateViewModel
//
// #region Bot 生成与子弹系统 .......... 第 1941 行
//   spawnBots / disposeBulletMesh / createBullet / updateBullets
//   createBurnParticle / createHitEffect / createMuzzleFire
//   showFloatingDamage / updateFloatingDamages
//   updateMagazines / updateParticles
//
// #region 无人机系统 .................. 第 2450 行
//   createDrone / triggerDroneExplosion / updateDronePhysics / destroyDrone
//
// #region 射击与战斗 .................. 第 2498 行
//   handleShooting (玩家射击逻辑、后坐力、散布、ADS)
//   playerDie / killBot
//
// #region HUD 与公告 .................. 第 2893 行
//   showBombAnnouncement / showAnnouncement / checkWinCondition / updateHUD
//
// #region Bot AI ...................... 第 2968 行
//   moveBotWithCollision / botAI (寻路、战斗、目标、手雷、无人机)
//   activateWallhack (全图透视)
//
// #region 炸弹系统 .................... 第 3352 行
//   handleBomb (安装/拆除 C4)
//
// #region 物理与动画循环 .............. 第 3695 行
//   updatePhysics (玩家移动/碰撞/跳跃)
//   animate (主循环：渲染、更新所有子系统)
//
// #region 投掷物系统 .................. 第 4367 行
//   updateGrenades / triggerGrenadeExplosion / updateFires / createGrenade
//
// #region 小地图与轨迹 ................ 第 4602 行
//   updateMinimap / updateTrajectory (手雷抛物线预测)
//
// #region 触控与窗口 .................. 第 4846 行
//   setupTouchControls / toggleFullScreen / onWindowResize
//
// ═══════════════════════════════════════════════════════════════════════

// #region 全局状态与配置
// --- GLOBAL STATE & UI LOGIC ---
let playerCurrency = 3200;
let playerScore = 0;
let matchState = { tWins: 0, ctWins: 0, maxWins: 5, lossStreakT: 0, lossStreakCT: 0, botMoneyT: new Array(10).fill(800), botMoneyCT: new Array(10).fill(800) };

// Bot Difficulty Settings
const BOT_DIFFICULTY_SETTINGS = {
    easy:   { spreadMult: 4.0, reactionFrames: 30, grenadeChance: 0.02, fireCooldownMult: 1.5, label: '简单' },
    medium: { spreadMult: 2.5, reactionFrames: 15, grenadeChance: 0.05, fireCooldownMult: 1.0, label: '中等' },
    hard:   { spreadMult: 1.5, reactionFrames: 8,  grenadeChance: 0.08, fireCooldownMult: 0.8, label: '困难' },
    pro:    { spreadMult: 0.8, reactionFrames: 3,  grenadeChance: 0.12, fireCooldownMult: 0.6, label: '专家' }
};
let botDifficulty = 'medium';

function setBotDifficulty(level) {
    if (BOT_DIFFICULTY_SETTINGS[level]) {
        botDifficulty = level;
        const labelEl = document.getElementById('difficulty-label');
        if (labelEl) labelEl.textContent = BOT_DIFFICULTY_SETTINGS[level].label;
    }
}

// Weapon Definitions
const WEAPONS = {
    pistol: { id: 'pistol', name: '格洛克', damage: 20, fireRate: 3, spread: 0.01, mag: 33, reserve: 120, auto: true, range: 100, color: 0x333333, length: 0.4, killReward: 300 },
    rifle: { id: 'rifle', name: '突击步枪 (AK-47)', damage: 35, fireRate: 6, spread: 0.005, mag: 30, reserve: 90, auto: true, range: 200, color: 0x8b4513, length: 0.8, killReward: 300 },
    sniper: { id: 'sniper', name: '狙击步枪 (AWP)', damage: 110, fireRate: 80, spread: 0.00025, mag: 10, reserve: 30, auto: false, range: 500, color: 0x1a4314, length: 1.2, killReward: 100 },
    marksman: { id: 'marksman', name: '射手步枪 (DMR)', damage: 45, fireRate: 12.25, spread: 0.002, mag: 25, reserve: 90, auto: true, range: 450, color: 0x2e4a23, length: 1.1, killReward: 300 },
    smg: { id: 'smg', name: '冲锋枪 (P90)', damage: 27.8, fireRate: 3.4, spread: 0.00625, mag: 50, reserve: 150, auto: true, range: 120, color: 0x444444, length: 0.5, killReward: 600 },
    shotgun: { id: 'shotgun', name: '连发霰弹枪 (Auto)', damage: 12, fireRate: 13.5, spread: 0.00511, mag: 12, reserve: 36, auto: true, range: 50, color: 0x222222, length: 0.9, killReward: 900 },
    m249: { id: 'm249', name: '重机枪 (M249)', damage: 30, fireRate: 7, spread: 0.02, mag: 100, reserve: 200, auto: true, range: 180, color: 0x113311, length: 1.0, killReward: 300 },
    deagle: { id: 'deagle', name: '沙漠之鹰 (Deagle)', damage: 60, fireRate: 20, spread: 0.005, mag: 7, reserve: 35, auto: false, range: 150, color: 0x777777, length: 0.45, killReward: 300 },
    knife: { id: 'knife', name: '战术小刀 (Karambit)', damage: 34, fireRate: 16, spread: 0, mag: '-', reserve: '-', auto: true, range: 8.05, color: 0xcccccc, length: 0.3, killReward: 1500 },
    kukri: { id: 'kukri', name: '尼泊尔军刀 (Kukri)', damage: 55, fireRate: 34, spread: 0, mag: '-', reserve: '-', auto: true, range: 15.0, color: 0xaaaaaa, length: 0.4, killReward: 1500 },
    switchblade: { id: 'switchblade', name: '北极星弹簧刀 (Switchblade)', damage: 35, fireRate: 20, spread: 0, mag: '-', reserve: '-', auto: true, range: 12.0, color: 0xcccccc, length: 0.35, killReward: 1500 },
    hegrenade: { id: 'hegrenade', name: '手雷 (HE)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x005500, length: 0.2, killReward: 300 },
    flashbang: { id: 'flashbang', name: '闪光弹 (Flash)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaaaaaa, length: 0.2, killReward: 300 },
    molotov: { id: 'molotov', name: '燃烧瓶 (Molotov)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaa4400, length: 0.2, killReward: 300 },
    sandbag: { id: 'sandbag', name: '沙包 (Sandbag)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xc2b280, length: 0.25, killReward: 0 },
    drone: { id: 'drone', name: '战术无人机 (Drone)', damage: 150, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x2c3e50, length: 0.3, killReward: 300 }
};

// Deterministic recoil patterns (CS-style learnable spray patterns)
// Each entry: [pitch, yaw] in radians. Pattern loops after array ends.
const RECOIL_PATTERNS = {
    rifle: [
        [0.025, 0], [0.025, 0], [0.022, 0.003], [0.020, 0.006], [0.018, -0.002],
        [0.015, -0.008], [0.012, 0.005], [0.010, -0.006], [0.008, 0.008], [0.008, -0.008]
    ],
    pistol: [
        [0.015, 0], [0.015, 0.002], [0.012, -0.003], [0.010, 0.003], [0.010, -0.002],
        [0.008, 0.004], [0.008, -0.004], [0.008, 0.003]
    ],
    sniper: [[0.08, 0]],
    marksman: [
        [0.020, 0], [0.018, 0.002], [0.016, -0.003], [0.014, 0.003], [0.012, -0.002],
        [0.010, 0.004], [0.010, -0.004]
    ],
    smg: [
        [0.012, 0], [0.012, 0.002], [0.010, -0.003], [0.010, 0.003], [0.008, -0.002],
        [0.008, 0.004], [0.008, -0.004], [0.006, 0.005], [0.006, -0.005]
    ],
    shotgun: [[0.04, 0]],
    m249: [
        [0.018, 0], [0.018, 0.003], [0.015, -0.004], [0.015, 0.004], [0.012, -0.003],
        [0.012, 0.005], [0.010, -0.005], [0.010, 0.006], [0.008, -0.006], [0.008, 0.006]
    ],
    deagle: [[0.05, 0]]
};

let inventory = {
    primary: null,
    secondary: 'pistol',
    melee: 'knife',
    melees: ['knife', 'kukri', 'switchblade'],
    grenades: { hegrenade: 0, flashbang: 0, molotov: 0, sandbag: 0, drone: 0 },
    currentGrenade: null,
    currentSlot: 2 // 1: Primary, 2: Secondary, 3: Melee, 4: Grenade
};

let ammoState = {
    primary: { clip: 0, reserve: 0 },
    secondary: { clip: 33, reserve: 120 },
    grenade: { clip: 0, reserve: 0 }
};

let activeDrones = [];
let knifeRangeIndicator;

let roundTime = 240;
let roundTimerInterval = null;
let wallhackActive = false;

// #endregion

// #region 游戏模式与回合管理
function getCurrentWeapon() {
    if (inventory.currentSlot === 1 && inventory.primary) return WEAPONS[inventory.primary];
    if (inventory.currentSlot === 2) return WEAPONS[inventory.secondary];
    if (inventory.currentSlot === 4 && inventory.currentGrenade) return WEAPONS[inventory.currentGrenade];
    return WEAPONS[inventory.melee || 'knife'];
}

function isPlayerInSpawn() {
    if (!playerState.spawnPos) return false;
    return camera.position.distanceTo(playerState.spawnPos) < 150;
}

function startGame() {
    isShootingRange = false;
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('hud-credits').innerText = playerCurrency;
    document.getElementById('exit-range-btn').classList.add('hidden');
    init3DGame();
}

let isShootingRange = false;
let rangeTargets = [];
let floatingDamages = [];

function startShootingRange() {
    isShootingRange = true;
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('exit-range-btn').classList.remove('hidden');
    
    playerCurrency = 99999;
    document.getElementById('hud-credits').innerText = playerCurrency;
    
    if (!gameInitialized) {
        init3DGame();
    } else {
        rebuildMap();
        resetRound();
    }
}

function exitShootingRange() {
    isShootingRange = false;
    document.getElementById('main-menu').classList.add('active');
    document.getElementById('game-screen').classList.remove('active');
    document.getElementById('exit-range-btn').classList.add('hidden');
    
    roundActive = false;
    if (controls) document.exitPointerLock();
    
    rangeTargets.forEach(t => {
        scene.remove(t);
        t.traverse(child => {
            if (child.isMesh) {
                const idx = collidableMeshList.indexOf(child);
                if (idx !== -1) collidableMeshList.splice(idx, 1);
            }
        });
    });
    rangeTargets = [];
    
    floatingDamages.forEach(fd => {
        if (fd.elem && fd.elem.parentNode) fd.elem.parentNode.removeChild(fd.elem);
    });
    floatingDamages = [];
    document.getElementById('damage-numbers').innerHTML = '';
    
    if (gameInitialized) {
        rebuildMap();
    }
}

function setupShootingRangeTargets() {
    if (typeof roundTimerInterval !== 'undefined' && roundTimerInterval) {
        clearInterval(roundTimerInterval);
    }
    
    // Clear old
    rangeTargets.forEach(t => {
        scene.remove(t);
        t.traverse(child => {
            if (child.isMesh) {
                const idx = collidableMeshList.indexOf(child);
                if (idx !== -1) collidableMeshList.splice(idx, 1);
            }
        });
    });
    rangeTargets = [];
    
    // Set up player looking at -Z
    camera.rotation.set(0, 0, 0); 
    const lookDir = new THREE.Vector3(0, 0, -1);
    
    const distances = [25, 50, 100];
    distances.forEach((dist, i) => {
        const group = new THREE.Group();
        const pos = new THREE.Vector3(0, 0, 0).add(lookDir.clone().multiplyScalar(dist));
        // Spread them out slightly side to side
        const right = new THREE.Vector3(1, 0, 0); 
        pos.add(right.clone().multiplyScalar((i - 1) * 5));
        group.position.copy(pos);
        
        // Body (1.5 width, 2 height, 0.5 depth)
        const bodyGeo = new THREE.BoxGeometry(1.5, 2, 0.5);
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.set(0, 1, 0); // Bottom at y=0
        bodyMesh.name = 'rangeTargetBody';
        group.add(bodyMesh);
        
        // Head (0.6 width, 0.6 height, 0.6 depth)
        const headGeo = new THREE.BoxGeometry(0.6, 0.6, 0.6);
        const headMat = new THREE.MeshStandardMaterial({ color: 0xcccccc });
        const headMesh = new THREE.Mesh(headGeo, headMat);
        headMesh.position.set(0, 2 + 0.3, 0); // Above body
        headMesh.name = 'rangeTargetHead';
        group.add(headMesh);
        
        group.hp = Infinity; 
        group.burnStacks = 0;
        group.burnTimer = 0;
        group.isRed = false;
        
        scene.add(group);
        rangeTargets.push(group);
        
        // We must compute world boxes after adding to scene for correct world transforms
        group.updateMatrixWorld(true);
        bodyMesh.worldBox = new THREE.Box3().setFromObject(bodyMesh);
        collidableMeshList.push(bodyMesh);
        
        headMesh.worldBox = new THREE.Box3().setFromObject(headMesh);
        collidableMeshList.push(headMesh);
    });
}


function openBuyMenu() {
    if (!roundActive) return;
    if (!playerState.isControllingDrone && (roundTime <= 225 || !isPlayerInSpawn())) return; // Only buy in first 15s in spawn
    
    const menu = document.getElementById('buy-menu');
    menu.classList.remove('hidden');
    menu.classList.add('active');
    
    if (playerState.isControllingDrone) {
        menu.querySelectorAll('h3').forEach(h => h.style.display = 'none');
        menu.querySelectorAll('.mod-category button').forEach(b => {
            if (!b.id || !b.id.startsWith('btn-throwable-')) {
                b.style.display = 'none';
            }
        });
        document.getElementById('btn-throwable-hegrenade').innerHTML = "购买 手雷 (HE Grenade) - $150 (半价)";
        document.getElementById('btn-throwable-flashbang').innerHTML = "购买 闪光弹 (Flashbang) - $100 (半价)";
        document.getElementById('btn-throwable-molotov').innerHTML = "购买 燃烧瓶 (Molotov) - $200 (半价)";
        document.getElementById('btn-throwable-sandbag').innerHTML = "购买 沙包 (Sandbag) - $25 (半价)";
    } else {
        menu.querySelectorAll('h3').forEach(h => h.style.display = 'block');
        menu.querySelectorAll('.mod-category button').forEach(b => b.style.display = '');
        document.getElementById('btn-throwable-hegrenade').innerHTML = "购买 手雷 (HE Grenade) - $300";
        document.getElementById('btn-throwable-flashbang').innerHTML = "购买 闪光弹 (Flashbang) - $200";
        document.getElementById('btn-throwable-molotov').innerHTML = "购买 燃烧瓶 (Molotov) - $400";
        document.getElementById('btn-throwable-sandbag').innerHTML = "购买 沙包 (Sandbag) - $50";
    }
    
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.exitPointerLock();
}

function closeBuyMenu() {
    document.getElementById('buy-menu').classList.add('hidden');
    document.getElementById('buy-menu').classList.remove('active');
    if (roundActive && controls) controls.lock();
}

function buyWeapon(type, cost) {
    if (playerState.isControllingDrone) {
        if (!['hegrenade', 'flashbang', 'molotov', 'sandbag'].includes(type)) return;
        cost = Math.floor(cost / 2);
    }
    if (playerCurrency >= cost) {
        if (type === 'rifle' || type === 'sniper' || type === 'marksman' || type === 'smg' || type === 'shotgun' || type === 'm249') {
            playerCurrency -= cost;
            inventory.primary = type;
            ammoState.primary.clip = WEAPONS[type].mag;
            ammoState.primary.reserve = WEAPONS[type].reserve;
            switchWeapon(1);
        } else if (type === 'pistol' || type === 'deagle') {
            playerCurrency -= cost;
            inventory.secondary = type;
            ammoState.secondary.clip = WEAPONS[type].mag;
            ammoState.secondary.reserve = WEAPONS[type].reserve;
            switchWeapon(2);
        } else if (type === 'hegrenade' || type === 'flashbang' || type === 'molotov' || type === 'sandbag' || type === 'drone') {
            playerCurrency -= cost;
            inventory.grenades[type] = (inventory.grenades[type] || 0) + 1;
            if (!inventory.currentGrenade) inventory.currentGrenade = type;
            document.getElementById('slot-4').classList.remove('hidden');
            switchWeapon(4);
        }
        document.getElementById('buy-credits').innerText = playerCurrency;
        document.getElementById('hud-credits').innerText = playerCurrency;
    }
}

function switchWeapon(slot) {
    if (playerState.isControllingDrone && slot !== 4) return;
    if (slot === 1 && !inventory.primary) return;
    
    if (slot === 3) {
        if (!inventory.melees) inventory.melees = ['knife', 'kukri', 'switchblade'];
        if (inventory.currentSlot === 3) {
            let idx = inventory.melees.indexOf(inventory.melee);
            inventory.melee = inventory.melees[(idx + 1) % inventory.melees.length];
        }
    }
    
    if (slot === 4) {
        const types = ['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'];
        const available = types.filter(t => inventory.grenades[t] > 0);
        if (available.length === 0) return;
        
        if (inventory.currentSlot === 4) {
            let idx = available.indexOf(inventory.currentGrenade);
            idx = (idx + 1) % available.length;
            inventory.currentGrenade = available[idx];
        } else {
            if (!inventory.currentGrenade || inventory.grenades[inventory.currentGrenade] <= 0) {
                inventory.currentGrenade = available[0];
            }
        }
    }
    
    playerState.isInspecting = false;
    isReloading = false;
    
    if (playerState.isAds && camera) {
        camera.fov = 75;
        camera.updateProjectionMatrix();
        playerState.isAds = false;
        const overlay = document.getElementById('scope-overlay');
        if (overlay) overlay.classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
    }
    
    inventory.currentSlot = slot;
    
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${slot}`).classList.add('active');
    
    updateViewModel();
    updateHUD();
}

function handleReload() {
    if (isReloading || playerState.isSpectating) return;
    const weapon = getCurrentWeapon();
    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade' || weapon.type === 'grenade') return;
    
    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
    if (currentAmmo.clip >= weapon.mag || currentAmmo.reserve <= 0) return;
    
    playerState.isInspecting = false;
    isReloading = true;
    showKillFeed(`正在换弹...`); // Reusing kill feed for HUD message
    
    if (playerState.viewModel) {
        const mag = playerState.viewModel.getObjectByName('magazine');
        if (mag) {
            mag.visible = false;
            const dropGeo = mag.geometry.clone();
            const dropMat = mag.material.clone();
            const dropMesh = new THREE.Mesh(dropGeo, dropMat);
            const worldPos = new THREE.Vector3();
            mag.getWorldPosition(worldPos);
            dropMesh.position.copy(worldPos);
            const worldQuat = new THREE.Quaternion();
            mag.getWorldQuaternion(worldQuat);
            dropMesh.quaternion.copy(worldQuat);
            scene.add(dropMesh);
            
            const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
            const dropVel = new THREE.Vector3(0, -2, 0).add(forward.multiplyScalar(2)).add(right.multiplyScalar(1));
            
            droppedMagazines.push({
                mesh: dropMesh,
                velocity: dropVel,
                life: 3.0,
                rotSpeed: new THREE.Vector3(Math.random()*10, Math.random()*10, Math.random()*10)
            });
        }
    }
    
    setTimeout(() => {
        if (!isReloading) return; // Cancelled by weapon switch
        isReloading = false;
        if (playerState.hp <= 0) return;
        const needed = weapon.mag - currentAmmo.clip;
        const reloadAmount = Math.min(needed, currentAmmo.reserve);
        currentAmmo.clip += reloadAmount;
        currentAmmo.reserve -= reloadAmount;
        
        if (playerState.viewModel) {
            const m = playerState.viewModel.getObjectByName('magazine');
            if (m) m.visible = true;
        }
        
        updateHUD();
    }, weapon.reloadTime * 1000 || 2000); 
}

function endRound(msg, tWin, reason = 'elimination') {
    if (!roundActive) return; // Prevent multiple calls
    roundActive = false;
    document.exitPointerLock();
    
    if (tWin) {
        matchState.tWins++;
        matchState.lossStreakT = 0;
        matchState.lossStreakCT++;
    } else {
        matchState.ctWins++;
        matchState.lossStreakCT = 0;
        matchState.lossStreakT++;
    }
    
    document.getElementById('wins-t').innerText = matchState.tWins;
    document.getElementById('wins-ct').innerText = matchState.ctWins;

    document.getElementById('result-screen').classList.remove('hidden');
    document.getElementById('result-screen').classList.add('active');
    document.getElementById('bomb-status').classList.add('hidden');
    document.getElementById('interact-prompt').classList.add('hidden');
    
    let endMsg = msg;
    if (matchState.tWins >= matchState.maxWins) endMsg = "比赛结束！恐怖分子获胜";
    if (matchState.ctWins >= matchState.maxWins) endMsg = "比赛结束！反恐精英获胜";
    
    const isPlayerWin = (tWin && playerState.team === 'T') || (!tWin && playerState.team === 'CT');
    endMsg += isPlayerWin ? " (我方胜利)" : " (敌方胜利)";
    
    document.getElementById('result-desc').innerText = endMsg;
    document.getElementById('result-desc').style.color = tWin ? '#e67e22' : '#3498db';
    
    // CS Economy
    let tMoney = 0;
    let ctMoney = 0;
    if (tWin) {
        tMoney = (reason === 'bomb_explode') ? 3500 : 3250;
        ctMoney = 1400 + (matchState.lossStreakCT - 1) * 500;
        if (ctMoney > 3400) ctMoney = 3400;
    } else {
        ctMoney = (reason === 'bomb_defuse') ? 3500 : 3250;
        tMoney = 1400 + (matchState.lossStreakT - 1) * 500;
        if (tMoney > 3400) tMoney = 3400;
        if (bombState.planted) tMoney += 800; // T bonus for plant
    }
    
    if (playerState.team === 'T') {
        playerCurrency += tMoney;
        if (tWin) playerScore += 50;
    } else {
        playerCurrency += ctMoney;
        if (!tWin) playerScore += 50;
    }
    
    // Distribute to bots
    for (let i = 0; i < 10; i++) {
        matchState.botMoneyT[i] = Math.min(16000, matchState.botMoneyT[i] + tMoney);
        matchState.botMoneyCT[i] = Math.min(16000, matchState.botMoneyCT[i] + ctMoney);
    }
    
    document.getElementById('hud-credits').innerText = playerCurrency;
    updateHUD();
    
    let countdown = 5;
    const countdownEl = document.getElementById('result-countdown');
    if (countdownEl) countdownEl.innerText = `进入下一回合倒计时: ${countdown} 秒`;
    
    if (roundCountdownInterval) clearInterval(roundCountdownInterval);
    roundCountdownInterval = setInterval(() => {
        countdown--;
        if (countdownEl) countdownEl.innerText = `进入下一回合倒计时: ${countdown} 秒`;
        if (countdown <= 0) {
            clearInterval(roundCountdownInterval);
            if (!roundActive) nextRound();
        }
    }, 1000);
}

function nextRound() {
    if (roundCountdownInterval) clearInterval(roundCountdownInterval);
    playerState.team = playerState.team === 'T' ? 'CT' : 'T'; // Swap team and spawn location
    
    if (matchState.tWins >= matchState.maxWins || matchState.ctWins >= matchState.maxWins) {
        matchState.tWins = 0;
        matchState.ctWins = 0;
        matchState.lossStreakT = 0;
        matchState.lossStreakCT = 0;
        matchState.botMoneyT = new Array(10).fill(800);
        matchState.botMoneyCT = new Array(10).fill(800);
        document.getElementById('wins-t').innerText = matchState.tWins;
        document.getElementById('wins-ct').innerText = matchState.ctWins;
        playerCurrency = 3200; // Reset match
        playerScore = 0;
    }
    document.getElementById('result-screen').classList.add('hidden');
    
    init3DGame();
}

function showKillFeed(msg) {
    const feed = document.getElementById('kill-feed');
    const entry = document.createElement('div');
    entry.className = 'kill-entry';
    entry.innerText = msg;
    feed.appendChild(entry);
    setTimeout(() => { if(feed.contains(entry)) feed.removeChild(entry); }, 4000);
}


// --- 3D ENGINE (THREE.JS) ---
// #endregion

// #region Three.js 场景初始化
let scene, camera, renderer, controls;
let clock, raycaster;
let roundActive = false;
let frameCount = 0;

let audioCtx;
function playKnifeSwingSound(stage) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (stage === 0) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(100, now + 0.15);
        gain.gain.setValueAtTime(0.5, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (stage === 1) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(500, now);
        osc.frequency.exponentialRampToValueAtTime(150, now + 0.15);
        gain.gain.setValueAtTime(0.6, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (stage === 2) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(50, now + 0.2);
        gain.gain.setValueAtTime(0.8, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        const bufferSize = audioCtx.sampleRate * 0.2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = audioCtx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = audioCtx.createGain();
        noiseGain.gain.setValueAtTime(0.3, now);
        noiseGain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
        
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = 800;
        
        noise.connect(filter);
        filter.connect(noiseGain);
        noiseGain.connect(audioCtx.destination);
        
        noise.start(now);
        
        osc.start(now);
        osc.stop(now + 0.2);
    }
}

function playKukriSwingSound(stage) {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    const now = audioCtx.currentTime;
    
    if (stage === 0 || stage === 1) {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(300, now);
        osc.frequency.exponentialRampToValueAtTime(80, now + 0.25);
        gain.gain.setValueAtTime(0.7, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
        osc.start(now);
        osc.stop(now + 0.25);
    } else if (stage === 2) {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(200, now);
        osc.frequency.exponentialRampToValueAtTime(40, now + 0.3);
        gain.gain.setValueAtTime(1.0, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    }
}

let roundCountdownInterval = null;

// Entities
let bots = [];
let collidableMeshList = [];
let bombZones = [];
let tracers = [];
let bullets = [];
let grenades = [];
let activeFires = [];
let particles = [];
let droppedMagazines = [];

// Player State
let playerState = {
    isInvincible: false,
    hp: 100,
    team: 'T',
    lastShot: -1000,
    lastCombatTime: -1000,
    knifeComboStage: 0,
    lastKnifeSwingTime: 0,
    burnStacks: 0,
    burnTimer: 0,
    burnSourceTeam: null,
    speed: 11.25,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    viewModel: null,
    isSpectating: false,
    spectateIndex: 0,
    isOnGround: true,
    isAds: false,
    adsProgress: 0,
    isControllingDrone: false,
    spawnPos: new THREE.Vector3(),
    isInspecting: false,
    inspectStartTime: 0
};

function getPlayerPosition() {
    if (playerState.isControllingDrone) {
        const pd = activeDrones.find(d => d.isPlayer);
        if (pd) return pd.playerPos;
    }
    return camera.position;
}

let playerDummyMesh = null;

function createPlayerDummy() {
    if (playerDummyMesh) return;
    
    playerDummyMesh = new THREE.Group();
    const pd = activeDrones.find(d => d.isPlayer);
    if (!pd) return;
    playerDummyMesh.position.copy(pd.playerPos);
    
    const bodyGeo = new THREE.CylinderGeometry(1.2, 1.2, 4.4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: playerState.team === 'T' ? 0xd35400 : 0x2980b9 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = -2.8; 
    
    const headGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
    const headMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.y = 0; 
    
    playerDummyMesh.add(body);
    playerDummyMesh.add(head);
    
    scene.add(playerDummyMesh);
}

function removePlayerDummy() {
    if (playerDummyMesh) {
        scene.remove(playerDummyMesh);
        playerDummyMesh.children.forEach(child => {
            child.geometry.dispose();
            child.material.dispose();
        });
        playerDummyMesh = null;
    }
}

let isReloading = false;
let currentSpread = 10;

let bombState = {
    planted: false,
    plantProgress: 0,
    timer: 60,
    mesh: null
};

// Shared resources for bullets and particles (avoids per-shot GC pressure)
const sharedBulletGeo = new THREE.BoxGeometry(0.1, 0.1, 1);
const sharedBulletMatYellow = new THREE.MeshBasicMaterial({ color: 0xfffb00 });
const sharedBulletMatOrange = new THREE.MeshBasicMaterial({ color: 0xff4500 });
const sharedFlameGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
const sharedFlameMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.8 });
const sharedParticleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const sharedMuzzleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

// Input
let moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
let moveUp = false, moveDown = false;
let isShooting = false;
let isInteracting = false;

document.addEventListener('keydown', (e) => {
    if (!controls || !controls.isLocked) {
        if (e.key.toLowerCase() === 'b' && roundActive && !playerState.isSpectating) {
            if (document.getElementById('buy-menu').classList.contains('hidden')) {
                openBuyMenu();
            } else {
                closeBuyMenu();
            }
        }
        if (e.code === 'KeyU' && roundActive && !playerState.isSpectating) {
            camera.position.y = 5;
            camera.position.x = playerState.spawnPos.x;
            camera.position.z = playerState.spawnPos.z;
        }
        return;
    }
    
        switch (e.code) {
            case 'KeyW': moveForward = true; break;
            case 'KeyA': moveLeft = true; break;
            case 'KeyS': moveBackward = true; break;
            case 'KeyD': moveRight = true; break;
            case 'KeyE': isInteracting = true; break;
            case 'ControlLeft':
            case 'ControlRight':
            case 'KeyC': moveDown = true; break;
            case 'ShiftLeft': 
            case 'ShiftRight':
                if (playerState.isControllingDrone) {
                    const pd = activeDrones.find(d => d.isPlayer);
                    if (pd) pd.selfDestructing = true;
                }
                break;
            case 'Space': 
                if (playerState.isControllingDrone) {
                    moveUp = true;
                } else if (playerState.isOnGround && !playerState.isSpectating) {
                    playerState.velocity.y = 15; // Jump velocity
                    playerState.isOnGround = false;
                }
                break;
            case 'KeyL':
                playerState.isInvincible = !playerState.isInvincible;
                showKillFeed(playerState.isInvincible ? '你已开启无敌模式' : '你已关闭无敌模式');
                break;
            case 'KeyK':
                playerCurrency += 1000;
                playerScore += 1000;
                showKillFeed('已增加 1000 金钱与积分');
                updateHUD();
                break;
            case 'KeyR': handleReload(); break;
            case 'KeyF':
                if (roundActive && !playerState.isSpectating && !playerState.isControllingDrone && playerState.viewModel) {
                    if (!playerState.isInspecting) {
                        playerState.isInspecting = true;
                        playerState.inspectStartTime = performance.now();
                    }
                }
                break;
            case 'Digit1': switchWeapon(1); break;
            case 'Digit2': switchWeapon(2); break;
            case 'Digit3': switchWeapon(3); break;
            case 'Digit4': switchWeapon(4); break;
            case 'KeyB': 
                if (document.getElementById('buy-menu').classList.contains('hidden')) {
                    openBuyMenu();
                } else {
                    closeBuyMenu();
                }
                break;
            case 'KeyU':
                if (roundActive && !playerState.isSpectating) {
                    camera.position.y = 5;
                    camera.position.x = playerState.spawnPos.x;
                    camera.position.z = playerState.spawnPos.z;
                }
                break;
            case 'KeyV':
                toggleDropCompensation();
                break;
        }
});
document.addEventListener('keyup', (e) => {
    switch (e.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyD': moveRight = false; break;
        case 'KeyE': isInteracting = false; break;
        case 'ControlLeft':
        case 'ControlRight':
        case 'KeyC': moveDown = false; break;
        case 'Space': moveUp = false; break;
    }
});
document.addEventListener('mousedown', (e) => { 
    if (e.button === 0) {
        if (playerState.isSpectating) {
            cycleSpectator();
            return;
        }
        isShooting = true; 
        handleShooting(true); 
    }
    if (e.button === 2 && controls && controls.isLocked) {
        playerState.isAds = true;
    }
});
document.addEventListener('mouseup', (e) => { 
    if (e.button === 0) isShooting = false; 
    if (e.button === 2 && camera) {
        playerState.isAds = false;
    }
});
document.addEventListener('contextmenu', e => e.preventDefault());

function cycleSpectator() {
    const friendlyBots = bots.filter(b => b.team === playerState.team);
    if (friendlyBots.length > 0) {
        playerState.spectateIndex = (playerState.spectateIndex + 1) % friendlyBots.length;
        document.getElementById('spectator-target').innerText = "BOT " + friendlyBots[playerState.spectateIndex].id;
    }
}

// --- NAV GRID & PATHFINDING ---
// #endregion

// #region 导航网格与寻路
const NAV_GRID_SIZE = 10;
const NAV_MAP_EXTENT = 400; 
const NAV_CELL_COUNT = (NAV_MAP_EXTENT * 2) / NAV_GRID_SIZE; 
let navGrid = []; // [x][z]

function buildNavGrid() {
    navGrid = [];
    for (let x = 0; x < NAV_CELL_COUNT; x++) {
        navGrid[x] = [];
        for (let z = 0; z < NAV_CELL_COUNT; z++) {
            const cellMin = new THREE.Vector3(-NAV_MAP_EXTENT + x * NAV_GRID_SIZE, 0, -NAV_MAP_EXTENT + z * NAV_GRID_SIZE);
            const cellMax = new THREE.Vector3(-NAV_MAP_EXTENT + (x + 1) * NAV_GRID_SIZE, 10, -NAV_MAP_EXTENT + (z + 1) * NAV_GRID_SIZE);
            const cellBox = new THREE.Box3(cellMin, cellMax);
            
            let walkable = true;
            for (let mesh of collidableMeshList) {
                if (mesh.worldBox && cellBox.intersectsBox(mesh.worldBox.clone().expandByScalar(5.0))) {
                    walkable = false;
                    break;
                }
            }
            navGrid[x][z] = walkable;
        }
    }
}

function getGridPos(worldVec) {
    let gx = Math.floor((worldVec.x + NAV_MAP_EXTENT) / NAV_GRID_SIZE);
    let gz = Math.floor((worldVec.z + NAV_MAP_EXTENT) / NAV_GRID_SIZE);
    gx = Math.max(0, Math.min(NAV_CELL_COUNT - 1, gx));
    gz = Math.max(0, Math.min(NAV_CELL_COUNT - 1, gz));
    return { x: gx, z: gz };
}

function getWorldPos(gx, gz) {
    return new THREE.Vector3(
        -NAV_MAP_EXTENT + gx * NAV_GRID_SIZE + NAV_GRID_SIZE/2,
        0,
        -NAV_MAP_EXTENT + gz * NAV_GRID_SIZE + NAV_GRID_SIZE/2
    );
}

function findPath(startVec, endVec) {
    const start = getGridPos(startVec);
    const end = getGridPos(endVec);
    
    let openSet = [start];
    let cameFrom = new Map();
    let gScore = new Map();
    let fScore = new Map();
    
    const hash = (node) => `${node.x},${node.z}`;
    
    gScore.set(hash(start), 0);
    fScore.set(hash(start), Math.abs(start.x - end.x) + Math.abs(start.z - end.z));
    
    let iters = 0;
    while (openSet.length > 0 && iters < 3000) {
        iters++;
        let currentIdx = 0;
        let minF = Infinity;
        for (let i = 0; i < openSet.length; i++) {
            let f = fScore.get(hash(openSet[i])) || Infinity;
            if (f < minF) {
                minF = f;
                currentIdx = i;
            }
        }
        
        let current = openSet[currentIdx];
        
        if (current.x === end.x && current.z === end.z) {
            let path = [];
            let currHash = hash(current);
            while (cameFrom.has(currHash)) {
                path.unshift(getWorldPos(current.x, current.z));
                current = cameFrom.get(currHash);
                currHash = hash(current);
            }
            if (path.length === 0) path.push(endVec.clone()); 
            path.push(endVec.clone()); 
            return path;
        }
        
        openSet.splice(currentIdx, 1);
        
        const neighbors = [
            {x: current.x+1, z: current.z}, {x: current.x-1, z: current.z},
            {x: current.x, z: current.z+1}, {x: current.x, z: current.z-1},
            {x: current.x+1, z: current.z+1}, {x: current.x-1, z: current.z-1},
            {x: current.x+1, z: current.z-1}, {x: current.x-1, z: current.z+1}
        ];
        
        for (let neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= NAV_CELL_COUNT || neighbor.z < 0 || neighbor.z >= NAV_CELL_COUNT) continue;
            if (!navGrid[neighbor.x][neighbor.z]) continue;
            
            if (neighbor.x !== current.x && neighbor.z !== current.z) {
                if (!navGrid[current.x][neighbor.z] || !navGrid[neighbor.x][current.z]) continue;
            }
            
            let tentativeGScore = (gScore.get(hash(current)) || Infinity) + ((neighbor.x !== current.x && neighbor.z !== current.z) ? 1.414 : 1);
            
            if (tentativeGScore < (gScore.get(hash(neighbor)) || Infinity)) {
                cameFrom.set(hash(neighbor), current);
                gScore.set(hash(neighbor), tentativeGScore);
                fScore.set(hash(neighbor), tentativeGScore + Math.abs(neighbor.x - end.x) + Math.abs(neighbor.z - end.z));
                if (!openSet.some(n => n.x === neighbor.x && n.z === neighbor.z)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    
    return [endVec.clone()];
}

function findFlankPath(startVec, endVec) {
    const directDist = startVec.distanceTo(endVec);
    if (directDist < 60) return findPath(startVec, endVec);
    
    let midVec = null;
    let attempts = 0;
    while(attempts < 50) {
        let rx = Math.floor(Math.random() * NAV_CELL_COUNT);
        let rz = Math.floor(Math.random() * NAV_CELL_COUNT);
        if (navGrid[rx] && navGrid[rx][rz]) {
            let testVec = getWorldPos(rx, rz);
            let distToStart = startVec.distanceTo(testVec);
            let distToEnd = testVec.distanceTo(endVec);
            let totalDist = distToStart + distToEnd;
            if (totalDist > directDist * 1.1 && totalDist < directDist * 1.6 && distToStart > 30 && distToEnd > 30) {
                midVec = testVec;
                break;
            }
        }
        attempts++;
    }
    
    if (!midVec) {
        return findPath(startVec, endVec);
    }
    
    let path1 = findPath(startVec, midVec);
    let path2 = findPath(midVec, endVec);
    
    if (path1.length > 0 && path2.length > 0) {
        if (path1[path1.length - 1].distanceTo(path2[0]) < 2) {
            path1.pop();
        }
        return path1.concat(path2);
    }
    return findPath(startVec, endVec);
}

// #endregion

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

// #region 武器视图模型
function createC4() {
    const group = new THREE.Group();
    // Base block (Olive green C4 explosive)
    const blockGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
    const blockMat = new THREE.MeshStandardMaterial({ color: 0x556b2f });
    const block = new THREE.Mesh(blockGeo, blockMat);
    group.add(block);
    
    // Screen/Keypad (Black)
    const padGeo = new THREE.BoxGeometry(0.4, 0.05, 0.3);
    const padMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.position.set(0, 0.125, 0);
    group.add(pad);
    
    // Flashing light (Red)
    const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
    lightMesh.position.set(-0.25, 0.15, 0);
    lightMesh.name = 'c4light'; // So we can find it to flash
    group.add(lightMesh);
    
    return group;
}

function createKarambit() {
    const group = new THREE.Group();
    
    // Handle
    const handleGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.15, 8);
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    group.add(handle);
    
    // Ring at the bottom
    const ringGeo = new THREE.TorusGeometry(0.025, 0.008, 8, 16);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.z = 0.09;
    group.add(ring);
    
    // Curved Blade
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.quadraticCurveTo(0.05, -0.1, 0.1, -0.2); // curve down
    shape.quadraticCurveTo(0.02, -0.1, -0.02, 0); // curve back up
    shape.lineTo(0, 0);
    
    const extrudeSettings = { depth: 0.005, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    bladeGeo.translate(0, 0, -0.0025); // center depth
    const bladeMat = new THREE.MeshStandardMaterial({ 
        color: 0x880000, // Crimson web pattern
        metalness: 0.8, 
        roughness: 0.2,
        side: THREE.DoubleSide
    });
    
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.scale.set(1.2, 1.2, 1.2);
    blade.position.z = -0.075;
    blade.position.y = 0.005;
    blade.rotation.x = Math.PI / 2;
    blade.rotation.y = Math.PI; // Flip blade direction
    group.add(blade);
    
    // Default orientation adjustments
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function createKukri() {
    const group = new THREE.Group();
    
    // --- Materials matching the image ---
    const handleMat = new THREE.MeshStandardMaterial({ color: 0x8b0000, metalness: 0.3, roughness: 0.7 }); // Crimson Red
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 1.0, roughness: 0.3 }); // Gold
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 1.0, roughness: 0.2 }); // Silver
    const damascusMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.8, roughness: 0.4 }); // Dark steel
    
    // --- Curved Handle ---
    const handleGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.16, 16);
    const handle = new THREE.Mesh(handleGeo, handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.rotation.z = -0.1; // curve handle slightly down
    group.add(handle);
    
    // Gold Bolster (thick ring near blade)
    const bolsterGeo = new THREE.CylinderGeometry(0.016, 0.012, 0.04, 16);
    const bolster = new THREE.Mesh(bolsterGeo, goldMat);
    bolster.rotation.x = Math.PI / 2;
    bolster.position.set(-0.005, 0, -0.07);
    group.add(bolster);
    
    // Red/Gold Pommel (End of handle)
    const pommelGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.04, 16);
    const pommel = new THREE.Mesh(pommelGeo, handleMat);
    pommel.rotation.x = Math.PI / 2;
    pommel.position.set(0.01, 0, 0.09);
    group.add(pommel);
    
    const pommelCapGeo = new THREE.SphereGeometry(0.022, 16, 16);
    const pommelCap = new THREE.Mesh(pommelCapGeo, goldMat);
    pommelCap.position.set(0.01, 0, 0.10);
    pommelCap.scale.set(1, 1, 0.5);
    group.add(pommelCap);
    
    // --- Blade ---
    // Base Damascus Blade (Edge and lower half)
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0); 
    // Spine
    bladeShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2); // Base spine
    bladeShape.quadraticCurveTo(0.04, -0.35, 0.22, -0.50); // Aggressive forward curve to tip
    // Edge (Belly)
    bladeShape.quadraticCurveTo(0.28, -0.35, 0.12, -0.15); // Wide belly
    // Cho (Notch)
    bladeShape.lineTo(0.08, -0.08); 
    bladeShape.quadraticCurveTo(0.04, -0.06, 0.08, -0.04); // The notch indent
    bladeShape.lineTo(0.02, 0); // Back to handle
    
    const bladeSettings = { depth: 0.004, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.002, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, bladeSettings);
    bladeGeo.translate(-0.01, 0, -0.002); // Center it
    
    const blade = new THREE.Mesh(bladeGeo, damascusMat);
    blade.position.z = -0.08;
    blade.position.y = 0.01;
    blade.rotation.x = Math.PI / 2;
    blade.rotation.y = Math.PI; 
    group.add(blade);
    
    // --- Golden Spine Details ---
    const spineShape = new THREE.Shape();
    spineShape.moveTo(0, 0);
    spineShape.quadraticCurveTo(-0.02, -0.1, -0.02, -0.2); // Match spine
    spineShape.quadraticCurveTo(0.04, -0.35, 0.20, -0.48); // Slightly short of tip
    // Inner curve defining the gold region (follows the spine closely)
    spineShape.quadraticCurveTo(0.08, -0.35, 0.04, -0.2);
    spineShape.lineTo(0.03, -0.08);
    spineShape.lineTo(0.02, 0);
    
    const spineSettings = { depth: 0.006, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const spineGeo = new THREE.ExtrudeGeometry(spineShape, spineSettings);
    spineGeo.translate(-0.01, 0, -0.003); // Center it
    
    const spine = new THREE.Mesh(spineGeo, goldMat);
    blade.add(spine); // Add as child of blade so transformations match
    
    // Dragon/Floral Engravings on the gold spine
    class DragonCurve extends THREE.Curve {
        getPoint(t, optionalTarget = new THREE.Vector3()) {
            const tx = -0.01 + 0.15 * t + Math.sin(t * Math.PI * 3) * 0.01; 
            const ty = -0.05 - 0.35 * t;
            const tz = 0;
            return optionalTarget.set(tx, ty, tz);
        }
    }
    const dragonGeo = new THREE.TubeGeometry(new DragonCurve(), 32, 0.003, 8, false);
    
    const dragonPattern1 = new THREE.Mesh(dragonGeo, silverMat);
    dragonPattern1.position.z = 0.004; // pop out slightly
    spine.add(dragonPattern1);
    
    const dragonPattern2 = new THREE.Mesh(dragonGeo, silverMat);
    dragonPattern2.position.z = -0.004;
    spine.add(dragonPattern2);

    // Make it roughly similar to the image's robust size
    group.scale.set(2.6, 2.6, 2.6);
    
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function createSwitchblade() {
    const group = new THREE.Group();
    
    const silverMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.9, roughness: 0.2 });
    const darkSilverMat = new THREE.MeshStandardMaterial({ color: 0x777777, metalness: 0.8, roughness: 0.4 });
    const blueMat = new THREE.MeshStandardMaterial({ color: 0x0055ff, metalness: 0.8, roughness: 0.2, emissive: 0x0022aa });
    
    const handleGeo = new THREE.BoxGeometry(0.02, 0.015, 0.15);
    const handle = new THREE.Mesh(handleGeo, silverMat);
    handle.position.z = 0.075;
    group.add(handle);
    
    const handleGripGeo = new THREE.BoxGeometry(0.018, 0.016, 0.12);
    const handleGrip = new THREE.Mesh(handleGripGeo, darkSilverMat);
    handleGrip.position.z = 0.08;
    group.add(handleGrip);
    
    const buttonGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.018, 8);
    const button = new THREE.Mesh(buttonGeo, blueMat);
    button.position.z = 0.04;
    button.rotation.x = Math.PI / 2;
    group.add(button);
    
    const buttonStarGeo = new THREE.ConeGeometry(0.008, 0.005, 4);
    const buttonStar = new THREE.Mesh(buttonStarGeo, silverMat);
    buttonStar.position.set(0, 0.01, 0.04);
    group.add(buttonStar);
    
    const bladeShape = new THREE.Shape();
    bladeShape.moveTo(0, 0);
    bladeShape.lineTo(0.012, 0);
    bladeShape.lineTo(0.008, -0.16);
    bladeShape.lineTo(0, -0.22);
    bladeShape.lineTo(-0.008, -0.16);
    bladeShape.lineTo(-0.012, 0);
    bladeShape.lineTo(0, 0);
    
    const extrudeSettings = { depth: 0.002, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: 0.001, bevelThickness: 0.001 };
    const bladeGeo = new THREE.ExtrudeGeometry(bladeShape, extrudeSettings);
    bladeGeo.translate(0, 0, -0.001);
    
    const blade = new THREE.Mesh(bladeGeo, silverMat);
    blade.position.z = 0;
    blade.rotation.x = Math.PI / 2;
    group.add(blade);
    
    const blueLineGeo = new THREE.BoxGeometry(0.002, 0.003, 0.12);
    const blueLine = new THREE.Mesh(blueLineGeo, blueMat);
    blueLine.position.z = -0.06;
    group.add(blueLine);
    
    group.scale.set(2.0, 2.0, 2.0);
    
    group.rotation.y = Math.PI / 4;
    group.rotation.x = -Math.PI / 12;
    group.rotation.z = Math.PI / 4;
    
    return group;
}

function buildViewModel() {
    if (playerState.viewModel) {
        camera.remove(playerState.viewModel);
        const oldHitBox = camera.getObjectByName('knifeHitBox');
        if (oldHitBox) {
            oldHitBox.geometry.dispose();
            oldHitBox.material.dispose();
            camera.remove(oldHitBox);
        }
    }
    
    const w = getCurrentWeapon();
    
    if (w.id === 'knife') {
        playerState.viewModel = createKarambit();
    } else if (w.id === 'kukri') {
        playerState.viewModel = createKukri();
    } else if (w.id === 'switchblade') {
        playerState.viewModel = createSwitchblade();
    } else {
        const geo = new THREE.BoxGeometry(0.1, 0.1, w.length);
        const mat = new THREE.MeshStandardMaterial({ color: w.color });
        playerState.viewModel = new THREE.Mesh(geo, mat);
        
        // Magazine
        const magGeo = new THREE.BoxGeometry(0.08, 0.15, 0.08);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.position.set(0, -0.1, 0.1);
        magMesh.name = 'magazine';
        playerState.viewModel.add(magMesh);

        if (w.id === 'shotgun') {
            const fireGroup = new THREE.Group();
            fireGroup.name = 'dragonFire';
            const sparkGeo = new THREE.BoxGeometry(0.02, 0.02, 0.02);
            const sparkMat = new THREE.MeshBasicMaterial({ color: 0xff5500 });
            for (let i = 0; i < 20; i++) {
                let spark = new THREE.Mesh(sparkGeo, sparkMat.clone());
                spark.position.set((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.2);
                fireGroup.add(spark);
            }
            fireGroup.position.set(0, 0, -w.length/2);
            playerState.viewModel.add(fireGroup);
        }
        
        // Add 3D scopes
        if (w.id === 'sniper' || w.id === 'marksman') {
            const scopeGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 16);
            scopeGeo.rotateX(Math.PI / 2);
            const scopeMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
            const scope = new THREE.Mesh(scopeGeo, scopeMat);
            scope.position.set(0, 0.08, -0.1);
            playerState.viewModel.add(scope);
        } else if (w.id === 'rifle' || w.id === 'smg' || w.id === 'shotgun' || w.id === 'deagle' || w.id === 'pistol') {
            const sightGroup = new THREE.Group();
            
            const baseGeo = new THREE.BoxGeometry(0.10, 0.04, 0.12);
            const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3530 });
            const base = new THREE.Mesh(baseGeo, baseMat);
            base.position.set(0, 0.077, -0.1);
            sightGroup.add(base);
            
            const w = 0.045;
            const h = 0.035;
            const t = 0.002;

            const frameShape = new THREE.Shape();
            frameShape.moveTo(-w - t, -h - t);
            frameShape.lineTo(w + t, -h - t);
            frameShape.lineTo(w + t, h + t);
            frameShape.lineTo(-w - t, h + t);
            frameShape.lineTo(-w - t, -h - t);
            
            const hole = new THREE.Path();
            hole.moveTo(-w, -h);
            hole.lineTo(-w, h);
            hole.lineTo(w, h);
            hole.lineTo(w, -h);
            hole.lineTo(-w, -h);
            frameShape.holes.push(hole);

            const frameGeo = new THREE.ExtrudeGeometry(frameShape, { depth: 0.0075, bevelEnabled: false });
            const frameMat = new THREE.MeshStandardMaterial({ color: 0x3a3530 });
            const frame = new THREE.Mesh(frameGeo, frameMat);
            frame.position.set(0, 0.13, -0.10375);
            sightGroup.add(frame);

            const glassShape = new THREE.Shape();
            glassShape.moveTo(-w, -h);
            glassShape.lineTo(w, -h);
            glassShape.lineTo(w, h);
            glassShape.lineTo(-w, h);
            glassShape.lineTo(-w, -h);

            const glassGeo = new THREE.ShapeGeometry(glassShape);
            const glassMat = new THREE.MeshStandardMaterial({ color: 0x9955ff, transparent: true, opacity: 0.3, roughness: 0.1, metalness: 0.5, side: THREE.DoubleSide });
            const glass = new THREE.Mesh(glassGeo, glassMat);
            glass.position.set(0, 0.13, -0.1);
            sightGroup.add(glass);

            const dotGeo = new THREE.CircleGeometry(0.0015, 8);
            const dotMat = new THREE.MeshBasicMaterial({ color: 0xff0000, side: THREE.DoubleSide });
            const dot = new THREE.Mesh(dotGeo, dotMat);
            dot.position.set(0, 0.13, -0.099);
            sightGroup.add(dot);
            
            sightGroup.scale.set(1.2, 1.2, 1.2);
            playerState.viewModel.add(sightGroup);
        }
    }
    
    if (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade') {
        playerState.viewModel.position.set(0.35, -0.25, -0.5); 
        playerState.viewModel.scale.set(1.69, 1.69, 1.69);
        playerState.viewModel.rotateY(-Math.PI / 8);
    } else {
        playerState.viewModel.position.set(0.3, -0.3, -0.5);
        playerState.viewModel.scale.set(1, 1, 1);
    }
    playerState.viewModel.traverse((child) => {
        if (child.isMesh) {
            child.material.depthTest = false;
            child.renderOrder = 999;
        }
    });
    camera.add(playerState.viewModel);
    scene.add(camera);
}

function updateViewModel() {
    buildViewModel();
}

// #endregion

// #region Bot 生成与子弹系统
function spawnBots(ctSpawns, tSpawns) {
    const ctMat = new THREE.MeshStandardMaterial({ color: 0x3498db }); // Blue for CT
    const tMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });  // Orange for T
    
    // Load cartoon faces from the network
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const ctFaceTexture = textureLoader.load('https://robohash.org/ctbot?set=set3');
    const tFaceTexture = textureLoader.load('https://robohash.org/tbot?set=set3');
    
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
            targetNode: new THREE.Vector3(x + (Math.random()-0.5)*40, 0, z + (Math.random()-0.5)*40),
            lastShot: 0,
            weapon: weaponId,
            actionProgress: 0,
            burnStacks: 0,
            burnTimer: 0,
            bombTarget: null,
            hasDrone: hasDrone,
            isControllingDrone: false
        });
    };

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
    
    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTime = 240;
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

function disposeBulletMesh(b) {
    // Bullets use shared geometry/material — no GPU resources to dispose per bullet
    // Just remove from scene; shared resources persist for game lifetime
    if (!b.mesh) return;
}

function createBullet(start, direction, weapon, shooterInfo) {
    const isShotgun = weapon && weapon.id === 'shotgun';
    const mat = isShotgun ? sharedBulletMatOrange : sharedBulletMatYellow;
    const mesh = new THREE.Mesh(sharedBulletGeo, mat);
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
        distance: 0,
        maxDistance: weapon.range
    });
}

function updateBullets(delta) {
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
        
        const moveDist = speed * delta;
        b.distance += moveDist;
        
        // Raycast for collision
        raycaster.set(b.mesh.position, b.direction);
        raycaster.far = moveDist;
        
        let targets = bots.map(bot => bot.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
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
            
            if (closestPoint.distanceTo(playerPos) < 2.0) {
                if (intersects.length === 0 || intersects[0].distance > projectionLength) {
                    hitPlayer = true;
                    if (closestPoint.y > playerPos.y - 0.4) isPlayerHeadshot = true;
                }
            }
        }
        
        if (hitPlayer) {
            let dmg = b.weapon.damage * 0.75;
            if (isPlayerHeadshot) dmg *= 2.7;
            if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade') {
                if (isPlayerHeadshot) dmg *= 0.025;
                else dmg *= 0.1;
            }
            let finalDmg = dmg;
            if (getCurrentWeapon().id === 'kukri') finalDmg *= 0.05;
            else if (getCurrentWeapon().id === 'switchblade') finalDmg *= 0.08;
            if (!playerState.isInvincible) playerState.hp -= Math.ceil(finalDmg);
            if (b.weapon.id === 'shotgun') {
                playerState.burnStacks = Math.min(6, (playerState.burnStacks || 0) + 1);
                playerState.burnTimer = 300;
                playerState.burnSourceTeam = b.shooter.team;
            }
            playerState.lastCombatTime = frameCount;
            updateHUD();
            createHitEffect(getPlayerPosition(), false, b.weapon.id);
            
            disposeBulletMesh(b);
            scene.remove(b.mesh);
            bullets.splice(i, 1);
            
            if (playerState.hp <= 0) playerDie(b.team, b.weapon.id);
            continue;
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
                if (hit.object.name === 'rangeTargetHead') dmg *= 3.0; // Headshot multiplier
                showFloatingDamage(dmg, hit.point);
                
                // Add burn stack property to the group for shotgun burn effect testing
                let targetObj = hit.object.parent;
                if (b.weapon.id === 'shotgun') {
                    targetObj.burnStacks = Math.min(6, (targetObj.burnStacks || 0) + 1);
                    targetObj.burnTimer = 300;
                }
                
                createHitEffect(hit.point, false, b.weapon.id);
                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
                continue;
            }
            
            if (hitBot && hitBot.team !== b.shooter.team) {
                let dmg = b.weapon.damage;
                if (hit.object.name === 'head') dmg *= 3.0; // Headshot
                hitBot.hp -= dmg;
                if (b.weapon.id === 'shotgun') {
                    hitBot.burnStacks = Math.min(6, (hitBot.burnStacks || 0) + 1);
                    hitBot.burnTimer = 300;
                }
                createHitEffect(hit.point, false, b.weapon.id);

                if (hitBot.hp <= 0) killBot(hitIndex, b.shooter.team, b.weapon.id);
            } else if (hitDrone && hitDrone.team !== b.shooter.team) {
                hitDrone.hp -= b.weapon.damage;
                createHitEffect(hit.point, false, b.weapon.id);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (!hitBot && !hitDrone) {
                createHitEffect(hit.point, true, b.weapon.id); // Wall hit
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
    const mat = new THREE.MeshBasicMaterial({ color: pColor });
    const mesh = new THREE.Mesh(sharedParticleGeo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 1.5;
    mesh.position.z += (Math.random() - 0.5) * 1.5;
    mesh.position.y += (Math.random() - 0.5) * 1.5;
    scene.add(mesh);
    
    particles.push({
        mesh: mesh,
        velocity: new THREE.Vector3((Math.random()-0.5)*5, Math.random()*8 + 2, (Math.random()-0.5)*5),
        life: 0.8 + Math.random() * 0.4
    });
}

function createHitEffect(pos, isWall, weaponId = null) {
    const color = isWall ? 0xaaaaaa : 0xff0000;
    const isDragonBreath = weaponId === 'shotgun';
    const count = isDragonBreath ? 7 : 5;
    
    for(let i = 0; i < count; i++) {
        const pColor = isDragonBreath ? (Math.random() > 0.4 ? 0xff0000 : 0xff5500) : color;
        const mat = new THREE.MeshBasicMaterial({ color: pColor });
        const mesh = new THREE.Mesh(sharedParticleGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        
        let velocity;
        if (isDragonBreath) {
            velocity = new THREE.Vector3((Math.random()-0.5)*15, Math.random()*15, (Math.random()-0.5)*15);
        } else {
            velocity = new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10);
        }
        
        particles.push({
            mesh: mesh,
            velocity: velocity,
            life: isDragonBreath ? 1.5 + Math.random() * 0.5 : 1.0
        });
    }
}
function createMuzzleFire(pos, dir) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const pColor = Math.random() > 0.4 ? 0xff0000 : 0xff5500;
        const mat = new THREE.MeshBasicMaterial({ color: pColor });
        const mesh = new THREE.Mesh(sharedMuzzleGeo, mat);
        
        mesh.position.copy(pos).add(dir.clone().multiplyScalar(2.5));
        scene.add(mesh);
        
        let velocity = dir.clone().multiplyScalar(25 + Math.random() * 15);
        velocity.x += (Math.random() - 0.5) * 4;
        velocity.y += (Math.random() - 0.5) * 4;
        velocity.z += (Math.random() - 0.5) * 4;
        
        particles.push({
            mesh: mesh,
            velocity: velocity,
            life: 0.3 + Math.random() * 0.3
        });
    }
}

function showFloatingDamage(amount, worldPos) {
    if (amount <= 0) return;
    
    const container = document.getElementById('damage-numbers');
    if (!container) return;
    
    const elem = document.createElement('div');
    elem.className = 'damage-text';
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
            // Only dispose material; geometry is shared across particles
            if (p.mesh.material) p.mesh.material.dispose();
            particles.splice(i, 1);
        } else {
            p.velocity.y -= 20 * delta; // gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.material.opacity = p.life;
            p.mesh.material.transparent = true;
        }
    }
}

// #endregion

// #region 无人机系统
function createDrone(start, direction, team, isPlayer = true, ownerId = null) {
    if (isPlayer && activeDrones.some(d => d.isPlayer)) return; // Only 1 player drone
    
    // Create Drone Mesh (Small cross with center)
    const droneGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: team === 'T' ? 0xd35400 : 0x2980b9 });
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), mat);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.2), mat);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1.4), mat);
    droneGroup.add(center);
    droneGroup.add(arm1);
    droneGroup.add(arm2);
    
    droneGroup.position.copy(start).add(direction.clone().multiplyScalar(2));
    scene.add(droneGroup);
    
    // Create explosion indicator (hidden initially)
    const ringGeo = new THREE.RingGeometry(25.35, 29.25, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: team === 'T' ? 0xff0000 : 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const indicator = new THREE.Mesh(ringGeo, ringMat);
    indicator.rotation.x = -Math.PI / 2; // Flat on ground
    scene.add(indicator);
    
    const drone = {
        id: Math.random().toString(36).substring(7),
        mesh: droneGroup,
        targetIndicator: indicator,
        velocity: new THREE.Vector3(),
        isPlayer: isPlayer,
        ownerId: ownerId, // for bot
        team: team,
        playerPos: start.clone(), // origin point
        selfDestructing: false,
        hp: 50
    };
    activeDrones.push(drone);
    
    if (isPlayer) {
        playerState.isControllingDrone = true;
        createPlayerDummy();
    }
    
    updateHUD();
}

// #endregion

// #region 射击与战斗
function handleShooting(initialClick = false) {
    if (playerState.isSpectating) return;
    if (!controls || !controls.isLocked) return;
    
    if (playerState.isControllingDrone) {
        if (!initialClick) return;
        if (inventory.currentSlot !== 4) return;
        const weapon = getCurrentWeapon();
        if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'sandbag'].includes(weapon.id)) return;
        
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team, true);
        
        inventory.grenades[weapon.id]--;
        
        const types = ['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'];
        const available = types.filter(t => inventory.grenades[t] > 0);
        if (available.length > 0) {
            if (inventory.grenades[weapon.id] <= 0) {
                inventory.currentGrenade = available[0];
            }
        } else {
            inventory.currentGrenade = null;
            document.getElementById('slot-4').classList.add('hidden');
        }
        
        playerState.lastShot = frameCount;
        playerState.lastCombatTime = frameCount;
        updateHUD();
        return;
    }
    
    if (isReloading) return;
    const weapon = getCurrentWeapon();
    if (!weapon.auto && !initialClick) return; 
    if (!isShooting) return;
    playerState.isInspecting = false;
    let requiredCooldown = weapon.fireRate;
    if (weapon.id === 'switchblade' && playerState.knifeComboStage === 2) requiredCooldown = 48;
    if (frameCount - playerState.lastShot < requiredCooldown) return;

    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : (inventory.currentSlot === 2 ? ammoState.secondary : (inventory.currentSlot === 4 ? ammoState.grenade : null));
    
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade' && inventory.currentSlot !== 4) {
        if (currentAmmo && currentAmmo.clip <= 0) {
            if (initialClick && currentAmmo.reserve > 0) handleReload();
            return;
        }
        currentAmmo.clip--;
    }

    if (inventory.currentSlot === 4) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        
        if (weapon.id === 'drone') {
            createDrone(camera.position.clone(), camDir, playerState.team);
        } else {
            createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team);
        }
        
        inventory.grenades[weapon.id]--;
        
        const types = ['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'];
        const available = types.filter(t => inventory.grenades[t] > 0);
        if (available.length > 0) {
            if (inventory.grenades[weapon.id] <= 0) {
                inventory.currentGrenade = available[0];
            }
        } else {
            inventory.currentGrenade = null;
            document.getElementById('slot-4').classList.add('hidden');
            if (inventory.primary) switchWeapon(1);
            else switchWeapon(2);
        }
        
        playerState.lastShot = frameCount;
        playerState.lastCombatTime = frameCount;
        updateHUD();
        return;
    }

    playerState.lastShot = frameCount;
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade') {
        playerState.lastCombatTime = frameCount;
    }
    updateHUD();
    
    // View model recoil animation
    if(playerState.viewModel) {
        if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
            playerState.knifeAnimStart = performance.now();
        } else {
            const kickback = playerState.isAds ? 0.002 : 0.1;
            playerState.viewModel.position.z += kickback; // Kickback
            setTimeout(() => { 
                if(playerState.viewModel) {
                    playerState.viewModel.position.z -= kickback;
                }
            }, 50);
        }
    }

    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
        const now = performance.now();
        if (now - playerState.lastKnifeSwingTime > 1000) {
            playerState.knifeComboStage = 0;
        } else {
            playerState.knifeComboStage = (playerState.knifeComboStage + 1) % 3;
        }
        playerState.lastKnifeSwingTime = now;
        playerState.knifeAnimStage = playerState.knifeComboStage;
        
        let currentSwingTime = now;
        let executeDamage = () => {
            if (playerState.lastKnifeSwingTime !== currentSwingTime) return;
            if (getCurrentWeapon().id !== weapon.id) return;
            
            if (weapon.id === 'kukri') playKukriSwingSound(playerState.knifeComboStage);
            else playKnifeSwingSound(playerState.knifeComboStage);

            let bestTarget = null;
        let bestDist = Infinity;
        let hitIsHeadshot = false;
        let hitPoint = null;
        let targetType = null; 
        let hitIndex = -1;
        
        let checkMesh = (mesh, entity, isHead, type, idx) => {
            if (!mesh) return;
            let worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            
            let localPos = worldPos.clone();
            camera.worldToLocal(localPos);
            
            if (localPos.x >= -2 && localPos.x <= 2 &&
                localPos.y >= -1 && localPos.y <= 1 &&
                localPos.z >= -weapon.range && localPos.z <= 0) {
                
                let dist = camera.position.distanceTo(worldPos);
                
                let dir = worldPos.clone().sub(camera.position).normalize();
                raycaster.set(camera.position, dir);
                raycaster.far = weapon.range;
                let targets = [mesh].concat(collidableMeshList);
                let intersects = raycaster.intersectObjects(targets, true);
                
                if (intersects.length > 0 && (intersects[0].object === mesh || intersects[0].object.parent === mesh)) {
                    if (!bestTarget || (isHead && !hitIsHeadshot) || (isHead === hitIsHeadshot && dist < bestDist)) {
                        bestTarget = entity;
                        bestDist = dist;
                        hitIsHeadshot = isHead;
                        hitPoint = intersects[0].point;
                        targetType = type;
                        hitIndex = idx;
                    }
                }
            }
        };

        for (let i = 0; i < bots.length; i++) {
            let b = bots[i];
            if (b.hp <= 0) continue;
            let head = b.mesh.getObjectByName('head');
            if (head) checkMesh(head, b, true, 'bot', i);
            b.mesh.children.forEach(child => {
                if (child.name !== 'head') checkMesh(child, b, false, 'bot', i);
            });
        }
        
        for (let i = 0; i < activeDrones.length; i++) {
            let d = activeDrones[i];
            checkMesh(d.mesh, d, false, 'drone', i);
        }
        
        if (isShootingRange) {
            for (let i = 0; i < rangeTargets.length; i++) {
                let t = rangeTargets[i];
                let head = t.getObjectByName('rangeTargetHead');
                if (head) checkMesh(head, t, true, 'rangeTarget', i);
                let body = t.getObjectByName('rangeTargetBody');
                if (body) checkMesh(body, t, false, 'rangeTarget', i);
            }
        }
        
        if (bestTarget) {
            let dmg;
            if (weapon.id === 'kukri') dmg = (playerState.knifeComboStage === 2 ? 65 : 45);
            else if (weapon.id === 'switchblade') dmg = (playerState.knifeComboStage === 0 ? 30 : (playerState.knifeComboStage === 1 ? 55 : 75));
            else dmg = (playerState.knifeComboStage === 2 ? 40 : 30);
            
            if (targetType === 'bot' && bestTarget.team !== playerState.team) {
                bestTarget.hp -= dmg;
                createHitEffect(hitPoint, false);
                if (weapon.id === 'knife' || weapon.id === 'switchblade') {
                    playerState.hp = Math.min(100, playerState.hp + 5);
                    updateHUD();
                }
                if (bestTarget.hp <= 0) killBot(hitIndex, playerState.team, weapon.id);
            } else if (targetType === 'drone' && bestTarget.team !== playerState.team) {
                bestTarget.hp -= dmg;
                createHitEffect(hitPoint, false);
                if (bestTarget.hp <= 0) {
                    destroyDrone(bestTarget, false);
                    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
                        playerState.hp = Math.min(100, playerState.hp + 10);
                        updateHUD();
                    }
                }
            } else if (targetType === 'rangeTarget') {
                if (hitIsHeadshot) dmg *= 3.0;
                showFloatingDamage(dmg, hitPoint);
                createHitEffect(hitPoint, false);
            }
        }
        };

        let delayMs = 0;
        if (weapon.id === 'switchblade') {
            if (playerState.knifeComboStage === 1) delayMs = 200;
            else if (playerState.knifeComboStage === 2) delayMs = 650;
        }

        if (delayMs > 0) setTimeout(executeDamage, delayMs);
        else executeDamage();
        return;
    }

    // Guns use projectiles
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    let bulletCount = weapon.id === 'shotgun' ? 16 : 1;
    let start;
    if (playerState.isAds && (weapon.id === 'sniper' || weapon.id === 'marksman')) {
        start = camera.position.clone();
    } else {
        start = camera.position.clone().add(new THREE.Vector3(0,-0.5,0));
    }
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    
    for (let i = 0; i < bulletCount; i++) {
        let dir = raycaster.ray.direction.clone();
        
        // Add spread
        let actualSpread = (currentSpread + 5) / 500;
        if (playerState.isAds) {
            actualSpread = 0;
        }
        let theta, r;
        if (weapon.id === 'shotgun') {
            if (i === 0) {
                theta = 0;
                r = Math.random() * 0.2 * actualSpread;
            } else {
                // Evenly distribute 15 bullets in a ring to prevent overlapping and fill the crosshair
                theta = ((i - 1) / (bulletCount - 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
                r = (0.4 + 0.6 * Math.random()) * actualSpread;
            }
        } else {
            theta = Math.random() * Math.PI * 2;
            r = Math.sqrt(Math.random()) * actualSpread;
        }
        
        dir.add(right.clone().multiplyScalar(Math.cos(theta) * r));
        dir.add(up.clone().multiplyScalar(Math.sin(theta) * r));
        dir.normalize();

        createBullet(start, dir, weapon, { team: playerState.team });
    }



    // Camera recoil (deterministic pattern-based, CS-style)
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade') {
        // Reset pattern index if enough time has passed since last shot (0.4s)
        const framesSinceLastShot = frameCount - (playerState.lastRecoilShotFrame || 0);
        if (framesSinceLastShot > 24) {
            playerState.recoilPatternIndex = 0;
        }
        playerState.lastRecoilShotFrame = frameCount;
        
        // Get recoil from deterministic pattern (or fall back to old random system)
        const pattern = RECOIL_PATTERNS[weapon.id];
        let recoilPitch, recoilYaw;
        
        if (pattern) {
            const idx = playerState.recoilPatternIndex || 0;
            const entry = pattern[idx % pattern.length];
            recoilPitch = entry[0];
            recoilYaw = entry[1];
            playerState.recoilPatternIndex = idx + 1;
        } else {
            // Fallback for weapons without patterns
            recoilPitch = 0.01;
            recoilYaw = (Math.random() - 0.5) * 0.003;
        }
        
        // Apply ADS / hip-fire multipliers
        if (!playerState.isAds) {
            recoilPitch *= 0.4;
            recoilYaw *= 0.5;
        } else {
            if (weapon.id === 'marksman') {
                recoilPitch *= 0.28125;
                recoilYaw *= 0.3;
            } else {
                recoilPitch *= 0.75;
                recoilYaw *= 0.5;
            }
        }
        
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x += recoilPitch;
        euler.y += recoilYaw;
        
        // Track recoil recovery for ALL weapons
        playerState.recoilRecovery = (playerState.recoilRecovery || 0) + recoilPitch;
        playerState.recoilRecoveryYaw = (playerState.recoilRecoveryYaw || 0) + recoilYaw;
        
        // Store recovery rate based on weapon type
        let recoveryRate = 0.15;
        switch (weapon.id) {
            case 'smg': recoveryRate = 0.25; break;
            case 'pistol': recoveryRate = 0.22; break;
            case 'deagle': recoveryRate = 0.18; break;
            case 'rifle': recoveryRate = 0.12; break;
            case 'marksman': recoveryRate = 0.15; break;
            case 'sniper': recoveryRate = 0.08; break;
            case 'shotgun': recoveryRate = 0.10; break;
            case 'm249': recoveryRate = 0.10; break;
        }
        playerState.recoilRecoveryRate = recoveryRate;
        
        camera.quaternion.setFromEuler(euler);
    }
}

function playerDie(killerTeam = null, weaponId = 'rifle') {
    if (killerTeam) {
        const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
        showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 你`);
    }

    playerState.isSpectating = true;
    document.exitPointerLock();
    document.getElementById('spectator-prompt').classList.remove('hidden');
    if (playerState.isControllingDrone) {
        const pd = activeDrones.find(d => d.isPlayer);
        if (pd) destroyDrone(pd, false);
    }
    cycleSpectator();
    checkWinCondition();
}

function killBot(index, killerTeam, weaponId = 'rifle') {
    const bot = bots[index];
    const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
    
    if (killerTeam === playerState.team) {
        const reward = WEAPONS[weaponId] ? WEAPONS[weaponId].killReward : 300;
        playerCurrency += reward;
        playerScore += 10;
        document.getElementById('hud-credits').innerText = playerCurrency;
        showKillFeed(`你 使用 ${wName} 击杀了 [${bot.team}] BOT (+$${reward})`);
        
        if (weaponId === 'knife' || weaponId === 'kukri' || weaponId === 'switchblade') {
            playerState.hp = Math.min(100, playerState.hp + 10);
            updateHUD();
        }
    } else {
        showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 [${bot.team}] BOT`);
    }

    scene.remove(bot.mesh);
    bot.mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
    });
    bots.splice(index, 1);
    
    checkWinCondition();
}

// #endregion

// #region HUD 与公告
function showBombAnnouncement(planterTeam) {
    let msg = (planterTeam === playerState.team) ? '我方已安放炸弹' : '敌方已安放炸弹';
    let el = document.getElementById('bomb-announcement');
    if (!el) {
        el = document.createElement('div');
        el.id = 'bomb-announcement';
        el.style.position = 'absolute';
        el.style.top = '25%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.color = '#ff3c3c';
        el.style.fontSize = '2.5rem';
        el.style.fontWeight = 'bold';
        el.style.fontFamily = '"Orbitron", "Inter", "Microsoft YaHei", sans-serif';
        el.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '100';
        el.style.transition = 'opacity 0.3s ease';
        document.getElementById('hud').appendChild(el);
    }
    el.innerText = msg;
    el.style.opacity = 1;
    
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => {
        el.style.opacity = 0;
    }, 2000);
}

function showAnnouncement(msg, color = 'white') {
    let el = document.getElementById('general-announcement');
    if (!el) {
        el = document.createElement('div');
        el.id = 'general-announcement';
        el.style.position = 'absolute';
        el.style.top = '15%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.fontSize = '2.5rem';
        el.style.fontWeight = 'bold';
        el.style.fontFamily = '"Orbitron", "Inter", "Microsoft YaHei", sans-serif';
        el.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '100';
        el.style.transition = 'opacity 0.3s ease';
        document.getElementById('hud').appendChild(el);
    }
    el.style.color = color;
    el.innerText = msg;
    el.style.opacity = 1;
    
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => {
        el.style.opacity = 0;
    }, 3000);
}

function checkWinCondition() {
    if (isShootingRange) return;
    const ctAlive = bots.filter(b => b.team === 'CT').length + (playerState.hp > 0 && playerState.team === 'CT' ? 1 : 0);
    const tAlive = bots.filter(b => b.team === 'T').length + (playerState.hp > 0 && playerState.team === 'T' ? 1 : 0);
    
    document.getElementById('score-ct').innerText = ctAlive;
    document.getElementById('score-t').innerText = tAlive;
    
    document.getElementById('label-t').innerText = playerState.team === 'T' ? '我方 T' : '敌方 T';
    document.getElementById('label-ct').innerText = playerState.team === 'CT' ? '我方 CT' : '敌方 CT';

    if (ctAlive === 0) endRound("所有反恐精英已被消灭！恐怖分子获胜", true, 'elimination');
    if (tAlive === 0) endRound("所有恐怖分子已被消灭！反恐精英获胜", false, 'elimination');
}

// #endregion

// #region Bot AI
function moveBotWithCollision(bot, moveVector) {
    const nextX = bot.mesh.position.x + moveVector.x;
    const nextZ = bot.mesh.position.z + moveVector.z;
    
    const margin = 0.05;
    
    const botBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - 0.4, 0.5, bot.mesh.position.z - 0.4 + margin),
        new THREE.Vector3(nextX + 0.4, 3.5, bot.mesh.position.z + 0.4 - margin)
    );
    let colX = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxX));
    
    if (!colX) { bot.mesh.position.x = nextX; }
    
    const botBoxZ = new THREE.Box3(
        new THREE.Vector3(bot.mesh.position.x - 0.4 + margin, 0.5, nextZ - 0.4),
        new THREE.Vector3(bot.mesh.position.x + 0.4 - margin, 3.5, nextZ + 0.4)
    );
    let colZ = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxZ));
    
    if (!colZ) { bot.mesh.position.z = nextZ; }
    
    return !colX || !colZ;
}

function botAI(delta) {
    let isDefusing = false;
    if (bombState.planted) {
        if (playerState.team === 'CT' && bombState.plantProgress > 0) isDefusing = true;
        bots.forEach(bot => {
            if (bot.team === 'CT' && bot.actionProgress > 0) isDefusing = true;
        });
    }

    bots.forEach(b => {
        if (b.isControllingDrone) return;
        
        let avoidanceVec = new THREE.Vector3();
        let avoiding = false;
        
        grenades.forEach(g => {
            const dist = b.mesh.position.distanceTo(g.mesh.position);
            if (dist < 50) {
                const dir = new THREE.Vector3().subVectors(b.mesh.position, g.mesh.position);
                dir.y = 0;
                if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                avoidanceVec.add(dir.multiplyScalar(20 * delta));
                avoiding = true;
            }
        });
        
        activeFires.forEach(f => {
            const fPos = new THREE.Vector3(f.x, b.mesh.position.y, f.z);
            const dist = b.mesh.position.distanceTo(fPos);
            if (dist < 40) {
                const dir = new THREE.Vector3().subVectors(b.mesh.position, fPos);
                dir.y = 0;
                if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                avoidanceVec.add(dir.multiplyScalar(20 * delta));
                avoiding = true;
            }
        });
        
        grenades.forEach(g => {
            if (g.team !== b.team) {
                const gPos = new THREE.Vector3(g.mesh.position.x, b.mesh.position.y, g.mesh.position.z);
                const dist = b.mesh.position.distanceTo(gPos);
                if (dist < 60) {
                    const dir = new THREE.Vector3().subVectors(b.mesh.position, gPos);
                    dir.y = 0;
                    if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                    avoidanceVec.add(dir.multiplyScalar(25 * delta));
                    avoiding = true;
                }
            }
        });

        if (avoiding) {
            b.actionProgress = 0;
            if (avoidanceVec.length() > 25 * delta) {
                avoidanceVec.normalize().multiplyScalar(25 * delta);
            }
            const lookPos = b.mesh.position.clone().add(avoidanceVec);
            b.mesh.lookAt(lookPos.x, b.mesh.position.y, lookPos.z);
            moveBotWithCollision(b, avoidanceVec);
            return;
        }

        let nearestEnemy = null;
        let minDist = Infinity;
        let absoluteClosestEnemy = null;
        let minAbsDist = Infinity;
        
        const botEye = b.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
        
        if (playerState.hp > 0 && playerState.team !== b.team && !playerState.isSpectating) {
            const playerEye = getPlayerPosition().clone();
            const d = botEye.distanceTo(playerEye);
            
            if (d < minAbsDist) { minAbsDist = d; absoluteClosestEnemy = playerEye; }
            
            const dir = new THREE.Vector3().subVectors(playerEye, botEye).normalize();
            raycaster.set(botEye, dir);
            raycaster.far = d;
            const intersects = raycaster.intersectObjects(collidableMeshList);
            if (intersects.length === 0) {
                if (d < minDist) { minDist = d; nearestEnemy = playerEye; }
            }
        }
        
        bots.forEach(other => {
            if (other.team !== b.team) {
                const otherEye = other.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
                const d = botEye.distanceTo(otherEye);
                
                if (d < minAbsDist) { minAbsDist = d; absoluteClosestEnemy = otherEye; }
                
                const dir = new THREE.Vector3().subVectors(otherEye, botEye).normalize();
                raycaster.set(botEye, dir);
                raycaster.far = d;
                const intersects = raycaster.intersectObjects(collidableMeshList);
                if (intersects.length === 0) {
                    if (d < minDist) { minDist = d; nearestEnemy = otherEye; }
                }
            }
        });

        // WALLHACK AGGRESSION: Override normal target with absolute closest enemy
        if (wallhackActive && absoluteClosestEnemy) {
            if (frameCount % 30 === 0) {
                b.targetNode = new THREE.Vector3(absoluteClosestEnemy.x, 0, absoluteClosestEnemy.z);
                b.bombTarget = null; 
            }
        }
        
        const lowHP = b.hp < 40;

        if (nearestEnemy && minDist < (lowHP ? 120 : 60)) {
            if (b.hasDrone) {
                b.hasDrone = false;
                b.isControllingDrone = true;
                createDrone(b.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, 1, 0), b.team, false, b.id);
                return;
            }
            
            b.actionProgress = 0; // Cancel objective action if in combat
            b.mesh.lookAt(nearestEnemy.x, b.mesh.position.y, nearestEnemy.z);
            
            let moveVec = new THREE.Vector3();
            if (lowHP) {
                // Seek cover: run away from enemy
                const fleeDir = new THREE.Vector3().subVectors(b.mesh.position, nearestEnemy);
                fleeDir.y = 0; fleeDir.normalize();
                // Add some zigzag
                fleeDir.applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random() - 0.5) * 1.5);
                moveVec = fleeDir.multiplyScalar(12 * delta); // run faster when fleeing (-25% speed)
            } else {
                // Strafe slightly
                const strafeDir = new THREE.Vector3(1,0,0).applyQuaternion(b.mesh.quaternion);
                const strafeMagnitude = (Math.random() - 0.5) * 33.75 * delta; // (-25% speed)
                moveVec = strafeDir.multiplyScalar(strafeMagnitude);
            }
            
            // Move with collision
            moveBotWithCollision(b, moveVec);
            
            // Still try to shoot back even if fleeing
            const diff = BOT_DIFFICULTY_SETTINGS[botDifficulty];
            const fireCooldown = (60 / (WEAPONS[b.weapon].fireRate / 2)) * diff.fireCooldownMult;
            
            // Reaction time: bot must see enemy for reactionFrames before first shot
            if (!b.enemySpotFrame) b.enemySpotFrame = frameCount;
            const reacted = (frameCount - b.enemySpotFrame) >= diff.reactionFrames;
            
            if (reacted && frameCount - b.lastShot > fireCooldown) {
                b.lastShot = frameCount;
                
                const dir = new THREE.Vector3().subVectors(nearestEnemy, botEye).normalize();
                
                let actualSpread = WEAPONS[b.weapon].spread * diff.spreadMult;
                if (minDist > 150) actualSpread *= 0.1; // ADS Simulation at long range
                
                if (Math.random() < diff.grenadeChance) {
                    const gType = ['hegrenade', 'flashbang', 'molotov'][Math.floor(Math.random()*3)];
                    let spreadDir = dir.clone();
                    spreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.normalize();
                    createGrenade(botEye.clone(), spreadDir, gType, b.team);
                } else {
                    let bulletCount = b.weapon === 'shotgun' ? 10 : 1;

                    for (let j = 0; j < bulletCount; j++) {
                        let currentSpreadDir = dir.clone();
                        currentSpreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.normalize();
                        createBullet(botEye.clone(), currentSpreadDir, WEAPONS[b.weapon], { team: b.team });
                    }
                }
            }
        } else {
            // Reset reaction timer when not in combat
            b.enemySpotFrame = null;
            // Objective logic
            if (b.hasDrone && Math.random() < 0.002) {
                b.hasDrone = false;
                b.isControllingDrone = true;
                createDrone(b.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, 1, 0), b.team, false, b.id);
                return;
            }
            if (b.stuckTimer > 0) {
                b.stuckTimer--;
            } else if (bombState.planted && b.team === 'CT') {
                if (bombState.mesh) {
                    b.targetNode = bombState.mesh.position.clone();
                }
                const dir = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position);
                const distToBomb = dir.length();
                if (distToBomb < 15.0) { // Require close proximity to defuse
                    // Ensure no wall between bot and bomb
                    const bombEye = b.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
                    const bombTargetPos = bombState.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
                    const toBombDir = new THREE.Vector3().subVectors(bombTargetPos, bombEye).normalize();
                    raycaster.set(bombEye, toBombDir);
                    raycaster.far = distToBomb;
                    const wallHits = raycaster.intersectObjects(collidableMeshList).filter(h => h.object !== bombState.mesh && h.object.parent !== bombState.mesh);

                    if (wallHits.length === 0) {
                        b.actionProgress++;
                        if (b.actionProgress >= 300) {
                            endRound("反恐精英成功拆除了炸弹！", false, 'bomb_defuse');
                            bombState.planted = false;
                            if (bombState.mesh) {
                                const idx = collidableMeshList.indexOf(bombState.mesh);
                                if (idx !== -1) collidableMeshList.splice(idx, 1);
                                scene.remove(bombState.mesh);
                                bombState.mesh = null;
                            }
                        }
                        return; // Stop moving, defusing
                    } else {
                        b.actionProgress = 0; // Wall is blocking
                    }
                } else {
                    b.actionProgress = 0;
                }
            } else if (bombState.planted && b.team === 'T') {
                if (bombState.mesh) {
                    if (isDefusing) {
                        b.targetNode = bombState.mesh.position.clone(); // Rush the bomb
                    } else {
                        // Guard the bomb
                        if (!b.bombTarget || Math.random() < 0.02) {
                            b.bombTarget = bombState.mesh.position.clone();
                            b.bombTarget.x += (Math.random() - 0.5) * 20;
                            b.bombTarget.z += (Math.random() - 0.5) * 20;
                        }
                        b.targetNode = b.bombTarget;
                    }
                }
            } else if (!bombState.planted && b.team === 'T') {
                if (!b.bombTarget) {
                    const zone = bombZones[Math.floor(Math.random() * bombZones.length)];
                    if (zone) {
                        b.bombTarget = zone.mesh.position.clone();
                        b.bombTarget.x += (Math.random() - 0.5) * 10;
                        b.bombTarget.z += (Math.random() - 0.5) * 10;
                        b.targetNode = b.bombTarget;
                    }
                } else {
                    b.targetNode = b.bombTarget;
                }
                
                const dir = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position);
                if (dir.length() < 7.5) {
                    b.actionProgress++;
                    if (b.actionProgress >= 180) {
                        bombState.planted = true;
                        if (!wallhackActive) {
                            activateWallhack("炸弹已安放！全图透视与死斗模式开启！");
                        }
                        bombState.timer = 60;
                        b.actionProgress = 0;
                        
                        bombState.mesh = createC4();
                        bombState.mesh.position.copy(b.mesh.position);
                        bombState.mesh.position.y = 0.1;
                        
                        bombState.mesh.updateMatrixWorld(true);
                        bombState.mesh.worldBox = new THREE.Box3().setFromObject(bombState.mesh);

                        scene.add(bombState.mesh);
                        showKillFeed("炸弹已被安放！");
                        showBombAnnouncement(b.team);
                    }
                    return; // Stop moving, planting
                } else {
                    b.actionProgress = 0;
                }
            } else {
                b.actionProgress = 0;
            }

            // Generate path if needed (with frequency limiting to reduce CPU load)
            const needsNewPath = !b.path || b.path.length === 0;
            const targetMoved = b.path && b.path.length > 0 && b.targetNode.distanceTo(b.path[b.path.length - 1]) > 5;
            const cooldownElapsed = !b.lastPathfindFrame || (frameCount - b.lastPathfindFrame) > 30; // 0.5s at 60fps
            
            if (needsNewPath || (targetMoved && cooldownElapsed)) {
                b.path = findFlankPath(b.mesh.position, b.targetNode);
                b.pathIndex = 0;
                b.lastPathfindFrame = frameCount;
            }
            
            let currentWaypoint = b.targetNode;
            if (b.path && b.pathIndex < b.path.length) {
                currentWaypoint = b.path[b.pathIndex];
                let flatBotPos = new THREE.Vector3(b.mesh.position.x, 0, b.mesh.position.z);
                let flatWaypoint = new THREE.Vector3(currentWaypoint.x, 0, currentWaypoint.z);
                if (flatBotPos.distanceTo(flatWaypoint) < 8) {
                    b.pathIndex++;
                    if (b.pathIndex < b.path.length) {
                        currentWaypoint = b.path[b.pathIndex];
                    } else {
                        currentWaypoint = b.targetNode;
                    }
                }
            }

            const distToFinal = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position).length();
            const dir = new THREE.Vector3().subVectors(currentWaypoint, b.mesh.position);
            
            if (distToFinal < 2) {
                if (b.stuckTimer > 0 || !((bombState.planted && b.team === 'CT') || (!bombState.planted && b.team === 'T'))) {
                    let isDefender = false;
                    if (bombState.planted && b.team === 'T' && bombState.mesh) {
                        const tBots = bots.filter(bot => bot.team === 'T');
                        if (tBots.indexOf(b) < 3) isDefender = true;
                    }
                    
                    if (isDefender) {
                        b.targetNode = bombState.mesh.position.clone().add(new THREE.Vector3((Math.random()-0.5)*120, 0, (Math.random()-0.5)*120));
                    } else {
                        b.targetNode = new THREE.Vector3((Math.random()-0.5)*760, 0, (Math.random()-0.5)*760);
                    }
                }
            } else {
                dir.normalize();

                b.mesh.lookAt(b.mesh.position.x + dir.x, b.mesh.position.y, b.mesh.position.z + dir.z);
                const moveVec = dir.multiplyScalar(22 * delta); // Normal speed
                
                const startPos = b.mesh.position.clone();
                moveBotWithCollision(b, moveVec);
                const actualMoved = startPos.distanceTo(b.mesh.position);
                
                if (b.timeStuck === undefined) b.timeStuck = 0;
                
                if (actualMoved < 2.0 * delta) {
                    b.timeStuck += delta;
                } else {
                    b.timeStuck = 0;
                }
                
                if (b.timeStuck >= 0.5) {
                    // Bounce backwards to un-wedge from the geometry
                    b.mesh.position.sub(dir.clone().multiplyScalar(4.0));
                    b.path = null;
                    if (!bombState.planted && b.team === 'T') {
                        b.bombTarget = null;
                    }
                    b.timeStuck = 0;
                }
            }
        }
    });
}

// #endregion

// #region 炸弹系统
function handleBomb() {
    const promptUI = document.getElementById('interact-prompt');
    const bombUI = document.getElementById('bomb-status');
    const bombProgUI = document.getElementById('bomb-progress');

    if (playerState.isSpectating) {
        promptUI.classList.add('hidden');
        bombUI.classList.add('hidden');
        return;
    }

    const playerPos = camera.position;

    if (bombState.planted) {
        if (!bombState.mesh) {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            return;
        }

        const distToBomb = playerPos.distanceTo(bombState.mesh.position);
        if (distToBomb < 15.0 && playerState.team === 'CT') {
            if (!isInteracting) promptUI.classList.remove('hidden');
            else promptUI.classList.add('hidden');

            if (isInteracting && !moveForward && !moveBackward && !moveLeft && !moveRight && playerState.isOnGround) {
                document.getElementById('bomb-text').innerText = "正在拆除 C4...";
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 300) * 100}%`;

                if (bombState.plantProgress >= 300) {
                    endRound("你成功拆除了炸弹！", false, 'bomb_defuse');
                    bombState.planted = false;
                    if (bombState.mesh) {
                        const idx = collidableMeshList.indexOf(bombState.mesh);
                        if (idx !== -1) collidableMeshList.splice(idx, 1);
                        scene.remove(bombState.mesh);
                        bombState.mesh = null;
                    }
                    bombUI.classList.add('hidden');
                    playerScore += 20;
                    bombState.plantProgress = 0;
                }
            } else {
                bombState.plantProgress = 0;
                bombUI.classList.add('hidden');
            }
        } else {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            bombState.plantProgress = 0;
        }
    } else {
        if (playerState.team !== 'T') {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            return;
        }

        let inZone = false;
        bombZones.forEach(zone => {
            if (Math.abs(playerPos.x - zone.mesh.position.x) < 30 && 
                Math.abs(playerPos.z - zone.mesh.position.z) < 30) {
                inZone = true;
            }
        });

        if (inZone) {
            if (!isInteracting) promptUI.classList.remove('hidden');
            else promptUI.classList.add('hidden');

            if (isInteracting && !moveForward && !moveBackward && !moveLeft && !moveRight && playerState.isOnGround) {
                document.getElementById('bomb-text').innerText = "正在安装 C4...";
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 180) * 100}%`;

                if (bombState.plantProgress >= 180) {
                    bombState.planted = true;
                    if (!wallhackActive) {
                        activateWallhack("炸弹已安放！全图透视与死斗模式开启！");
                    }
                    bombUI.classList.add('hidden');
                    playerScore += 20;
                    bombState.plantProgress = 0;
                    bombState.timer = 60;
                    
                    bombState.mesh = createC4();
                    bombState.mesh.position.copy(camera.position);
                    bombState.mesh.position.y = 0.1;
                    
                    bombState.mesh.updateMatrixWorld(true);
                    bombState.mesh.worldBox = new THREE.Box3().setFromObject(bombState.mesh);

                    scene.add(bombState.mesh);
                    showKillFeed("炸弹已被安放！");
                    showBombAnnouncement(playerState.team);
                }
            } else {
                bombState.plantProgress = 0;
                bombUI.classList.add('hidden');
            }
        } else {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            bombState.plantProgress = 0;
        }
    }
}

function activateWallhack(msg) {
    wallhackActive = true;
    showAnnouncement(msg, "red");
    
    // Enable X-Ray for all bots
    bots.forEach(bot => {
        bot.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        let newMat = mat.clone();
                        newMat.depthTest = false;
                        newMat.depthWrite = false;
                        newMat.transparent = true;
                        newMat.opacity = 0.8;
                        newMat.needsUpdate = true;
                        return newMat;
                    });
                } else {
                    let newMat = child.material.clone();
                    newMat.depthTest = false;
                    newMat.depthWrite = false;
                    newMat.transparent = true;
                    newMat.opacity = 0.8;
                    newMat.needsUpdate = true;
                    child.material = newMat;
                }
                child.renderOrder = 999;
            }
        });
    });
}

function updateHUD() {
    if (document.getElementById('hud-score')) {
        document.getElementById('hud-score').innerText = playerScore;
    }
    document.getElementById('hp-val').innerText = playerState.hp;
    document.getElementById('hp-fill').style.width = `${Math.max(0, playerState.hp)}%`;
    
    if (playerState.isControllingDrone) {
        document.querySelector('.weapon-inventory').style.display = 'none';
        document.querySelector('.hud-right').style.display = 'flex';
    } else {
        document.querySelector('.weapon-inventory').style.display = 'flex';
        document.querySelector('.hud-right').style.display = 'flex';
    }
    
    const w = getCurrentWeapon();
    document.getElementById('weapon-name').innerText = w.name;
    
    if (w.id === 'knife') {
        document.getElementById('ammo-clip').innerText = '-';
        document.getElementById('ammo-reserve').innerText = '-';
    } else if (['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'].includes(w.id)) {
        document.getElementById('ammo-clip').innerText = inventory.grenades[w.id];
        document.getElementById('ammo-reserve').innerText = '-';
    } else {
        let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
        document.getElementById('ammo-clip').innerText = currentAmmo.clip;
        document.getElementById('ammo-reserve').innerText = currentAmmo.reserve;
    }
    
    if (bombState.planted) {
        document.getElementById('round-timer').innerText = `00:${bombState.timer.toString().padStart(2, '0')}`;
        document.getElementById('round-timer').style.color = '#ff3c3c';
    } else {
        const mins = Math.floor(roundTime / 60);
        const secs = roundTime % 60;
        document.getElementById('round-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('round-timer').style.color = '#fff';
    }
    
    const buyPrompt = document.getElementById('buy-prompt');
    if (roundTime > 225 && isPlayerInSpawn() && !playerState.isSpectating && roundActive) {
        buyPrompt.classList.remove('hidden');
    } else {
        buyPrompt.classList.add('hidden');
    }

    checkWinCondition(); // Updates top scores
}

function triggerDroneExplosion(drone) {
    const pos = drone.targetIndicator.position;
    createHitEffect(pos, false);
    for (let index = bots.length - 1; index >= 0; index--) {
        const b = bots[index];
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (b.team !== drone.team) {
                b.hp -= dmg * 0.75;
                if (b.hp <= 0) killBot(index, drone.team, 'drone');
            }
        }
    }
    
    if (isShootingRange) {
        rangeTargets.forEach(t => {
            const dist = t.position.distanceTo(pos);
            if (dist < 29.25) {
                const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
                if (dmg > 0) showFloatingDamage(dmg, t.position);
            }
        });
    }
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (playerState.team !== drone.team) {
                let actualDmg = dmg * 0.75;
                if (getCurrentWeapon().id === 'kukri') actualDmg *= 0.05;
                else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.1;
                if (!playerState.isInvincible) playerState.hp -= Math.ceil(actualDmg);
                playerState.lastCombatTime = frameCount;
                if (playerState.hp <= 0) playerDie(drone.team, 'drone');
            }
        }
    }
}

function updateDronePhysics(delta) {
    for (let index = activeDrones.length - 1; index >= 0; index--) {
        let drone = activeDrones[index];
        // Indicator
        raycaster.set(drone.mesh.position, new THREE.Vector3(0, -1, 0));
        let targets = bots.map(b => b.mesh).concat(collidableMeshList);
        const intersects = raycaster.intersectObjects(targets);
        let groundY = 0;
        if (intersects.length > 0) groundY = intersects[0].point.y;
        
        drone.targetIndicator.position.set(drone.mesh.position.x, groundY + 0.1, drone.mesh.position.z);
    
        if (drone.selfDestructing) {
            drone.targetIndicator.visible = true; // Keep it visible so players can judge the range
            if (drone.mesh.position.y <= groundY + 2.0) {
                destroyDrone(drone, true);
                continue; 
            }
        } else {
            drone.targetIndicator.visible = true;
        }
    
        drone.velocity.x -= drone.velocity.x * 5.0 * delta;
        drone.velocity.y -= drone.velocity.y * 5.0 * delta;
        drone.velocity.z -= drone.velocity.z * 5.0 * delta;
    
        if (drone.isPlayer) {
            let dirZ = Number(moveForward) - Number(moveBackward);
            let dirX = Number(moveRight) - Number(moveLeft);
            let dirY = Number(moveUp) - Number(moveDown);
        
            if (drone.selfDestructing) {
                dirY = 0; 
                drone.velocity.y = -78.125; 
                if (!drone.selfDestructBoosted) {
                    drone.velocity.x *= 1.75;
                    drone.velocity.z *= 1.75;
                    drone.selfDestructBoosted = true;
                }
            }

            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            forward.crossVectors(camera.up, right).normalize();
        
            let currentSpeed = drone.selfDestructing ? 437.5 : 250.0;
            if (dirZ !== 0) drone.velocity.add(forward.clone().multiplyScalar(dirZ * currentSpeed * delta));
            if (dirX !== 0) drone.velocity.add(right.clone().multiplyScalar(dirX * currentSpeed * delta));
            if (dirY !== 0) drone.velocity.y += dirY * 250.0 * delta;
        
            camera.position.add(drone.velocity.clone().multiplyScalar(delta));
            
            // Bounds
            if (camera.position.y < 2) { camera.position.y = 2; drone.velocity.y = 0; }
            if (camera.position.x < -399) camera.position.x = -399;
            if (camera.position.x > 399) camera.position.x = 399;
            if (camera.position.z < -399) camera.position.z = -399;
            if (camera.position.z > 399) camera.position.z = 399;
        
            drone.mesh.position.copy(camera.position);
        } else {
            // Bot drone logic
            let nearestEnemyPos = null;
            let minDist = Infinity;
            if (drone.team !== playerState.team && playerState.hp > 0 && !playerState.isSpectating) {
                nearestEnemyPos = getPlayerPosition().clone();
                minDist = drone.mesh.position.distanceTo(nearestEnemyPos);
            }
            bots.forEach(b => {
                if (b.team !== drone.team && b.hp > 0) {
                    const dist = drone.mesh.position.distanceTo(b.mesh.position);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEnemyPos = b.mesh.position.clone();
                    }
                }
            });
            
            if (nearestEnemyPos) {
                if (minDist < 20) {
                    drone.selfDestructing = true;
                } else {
                    if (minDist < 80 && Math.random() < 0.01) {
                        const gType = ['hegrenade', 'flashbang', 'molotov'][Math.floor(Math.random() * 3)];
                        const dir = new THREE.Vector3().subVectors(nearestEnemyPos, drone.mesh.position).normalize();
                        dir.y += 0.2;
                        dir.normalize();
                        createGrenade(drone.mesh.position.clone(), dir, gType, drone.team, true);
                    }
                    const dir = new THREE.Vector3().subVectors(nearestEnemyPos, drone.mesh.position).normalize();
                    drone.velocity.add(dir.multiplyScalar(250.0 * delta));
                    // maintain altitude slightly above enemy
                    drone.velocity.y += ((nearestEnemyPos.y + 5) - drone.mesh.position.y) * 5.0 * delta;
                }
            } else {
                drone.selfDestructing = true;
            }
            
            drone.mesh.position.add(drone.velocity.clone().multiplyScalar(delta));
            if (drone.mesh.position.y < 2) { drone.mesh.position.y = 2; drone.velocity.y = 0; }
        }
    }
}

// #endregion

// #region 物理与动画循环
function updatePhysics(delta) {
    if (playerState.isSpectating) return;

    playerState.velocity.y -= 40.0 * delta; // Gravity
    let nextY = camera.position.y + playerState.velocity.y * delta;
    
    if (nextY <= 2) { 
        nextY = 2;
        playerState.velocity.y = 0;
        playerState.isOnGround = true;
    } else {
        playerState.isOnGround = false;
    }
    camera.position.y = nextY;

    playerState.velocity.x -= playerState.velocity.x * 10.0 * delta;
    playerState.velocity.z -= playerState.velocity.z * 10.0 * delta;

    playerState.direction.z = Number(moveForward) - Number(moveBackward);
    playerState.direction.x = Number(moveRight) - Number(moveLeft);
    playerState.direction.normalize();
    
    // Melee gives speed boost
    const w = getCurrentWeapon();
    let speedMult = 1.0;
    if (w.id === 'knife') speedMult = 1.5;
    else if (w.id === 'kukri') speedMult = 1.35;

    if (moveForward || moveBackward) playerState.velocity.z -= playerState.direction.z * 400.0 * speedMult * delta;
    if (moveLeft || moveRight) playerState.velocity.x -= playerState.direction.x * 400.0 * speedMult * delta;

    // Calculate intended world movement vector
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    forward.crossVectors(camera.up, right).normalize();
    
    const moveX = right.clone().multiplyScalar(-playerState.velocity.x * delta);
    const moveZ = forward.clone().multiplyScalar(-playerState.velocity.z * delta);
    const moveDir = new THREE.Vector3().addVectors(moveX, moveZ);
    
    // Independent Axis Collision
    const nextX = camera.position.x + moveDir.x;
    const nextZ = camera.position.z + moveDir.z;
    
    const playerRadius = 0.4;
    const margin = 0.05;
    
    const playerBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - playerRadius, 0.5, camera.position.z - playerRadius + margin),
        new THREE.Vector3(nextX + playerRadius, 3.5, camera.position.z + playerRadius - margin)
    );
    let colX = collidableMeshList.some(wall => wall.worldBox.intersectsBox(playerBoxX));
    
    if (!colX) {
        camera.position.x = nextX;
    } else {
        playerState.velocity.x = 0;
    }

    const playerBoxZ = new THREE.Box3(
        new THREE.Vector3(camera.position.x - playerRadius + margin, 0.5, nextZ - playerRadius),
        new THREE.Vector3(camera.position.x + playerRadius - margin, 3.5, nextZ + playerRadius)
    );
    let colZ = collidableMeshList.some(wall => wall.worldBox.intersectsBox(playerBoxZ));

    if (!colZ) {
        camera.position.z = nextZ;
    } else {
        playerState.velocity.z = 0;
    }

    // Bounding box map limits
    if (camera.position.x < -399) camera.position.x = -399;
    if (camera.position.x > 399) camera.position.x = 399;
    if (camera.position.z < -399) camera.position.z = -399;
    if (camera.position.z > 399) camera.position.z = 399;
}

function animate() {
    requestAnimationFrame(animate);
    frameCount++;

    let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1; // Prevent physics explosion on lag/tab switch
    
    if (playerState.recoilRecovery && playerState.recoilRecovery > 0) {
        const rate = playerState.recoilRecoveryRate || 0.15;
        const recoverAmount = Math.min(playerState.recoilRecovery, delta * rate);
        playerState.recoilRecovery -= recoverAmount;
        
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x -= recoverAmount;
        
        // Recover yaw recoil
        if (playerState.recoilRecoveryYaw && playerState.recoilRecoveryYaw !== 0) {
            const yawRecover = Math.min(Math.abs(playerState.recoilRecoveryYaw), delta * rate * 0.3);
            const sign = playerState.recoilRecoveryYaw > 0 ? -1 : 1;
            playerState.recoilRecoveryYaw += sign * yawRecover;
            euler.y += sign * yawRecover;
        }
        
        camera.quaternion.setFromEuler(euler);
    }
    
    // Update zone labels
    const isT = playerState.team === 'T';
    bombZones.forEach((zone) => {
        const labelEl = document.getElementById(zone.labelId || 'zoneA-label');
        if (labelEl) {
            const pos = zone.mesh.position.clone();
            pos.y += 3; 
            pos.project(camera);
            if (pos.z > 1) { 
                labelEl.style.display = 'none';
            } else {
                labelEl.style.display = 'block';
                const x = (pos.x * .5 + .5) * window.innerWidth;
                const y = (pos.y * -.5 + .5) * window.innerHeight;
                labelEl.style.left = x + 'px';
                labelEl.style.top = y + 'px';
                labelEl.innerText = isT ? `${zone.name} 安放区` : `${zone.name} 拆除区`;
            }
        }
    });

    if (playerState.isSpectating) {
        const friendlyBots = bots.filter(b => b.team === playerState.team);
        if (friendlyBots.length > 0) {
            let specBot = friendlyBots[playerState.spectateIndex];
            if (!specBot) {
                cycleSpectator();
                specBot = friendlyBots[playerState.spectateIndex];
            }
            if (specBot) {
                camera.position.copy(specBot.mesh.position);
                camera.position.y += 3.5;
                camera.rotation.copy(specBot.mesh.rotation);
            }
        }
    } else {
        if (controls && controls.isLocked) {
            updateDronePhysics(delta);
            if (!playerState.isControllingDrone) {
                updatePhysics(delta);
                handleShooting();
                handleBomb();
            }
        }
    }
    
    
    updateBullets(delta);
    updateGrenades(delta);
    updateParticles(delta);
    updateFloatingDamages(delta);
    updateMagazines(delta);
    updateFires(delta);
    
    // Global Bomb Timer Tick
    if (bombState.planted && roundActive) {
        if (frameCount % 60 === 0) {
            bombState.timer--;
            updateHUD();
            
            if (bombState.mesh) {
                let light = bombState.mesh.getObjectByName('c4light');
                if (light && light.material) light.material.color.setHex(bombState.timer % 2 === 0 ? 0xff0000 : 0x330000);
            }
            
            if (bombState.timer <= 0) {
                endRound("C4 炸弹已引爆！恐怖分子获胜", true, 'bomb_explode');
            }
        }
    }

    // Burn Damage Tick
    if (roundActive) {
        if (playerState.burnTimer > 0) {
            if (frameCount % 40 === 0 && playerState.hp > 0 && !playerState.isSpectating) {
                if (!playerState.isInvincible) playerState.hp -= 2 * playerState.burnStacks;
                updateHUD();
                if (playerState.hp <= 0) playerDie(playerState.burnSourceTeam || 'T', 'molotov');
            }
            if (frameCount % 3 === 0 && playerState.hp > 0 && !playerState.isSpectating) {
                createBurnParticle(getPlayerPosition().clone().add(new THREE.Vector3(0, -0.5, 0)));
            }
            playerState.burnTimer--;
            if (playerState.burnTimer <= 0) playerState.burnStacks = 0;
        }

        for (let i = bots.length - 1; i >= 0; i--) {
            let bot = bots[i];
            if (bot.burnTimer > 0) {
                if (!bot.isRed) {
                    bot.isRed = true;
                    bot.mesh.traverse(child => {
                        if (child.isMesh) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach(m => { if (m.emissive) m.emissive.setHex(0xff0000); });
                        }
                    });
                }
                if (frameCount % 40 === 0 && bot.hp > 0) {
                    bot.hp -= 2 * bot.burnStacks;
                    if (bot.hp <= 0) killBot(i, playerState.team, 'molotov');
                }
                if (frameCount % 3 === 0 && bot.hp > 0) {
                    createBurnParticle(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                }
                bot.burnTimer--;
                if (bot.burnTimer <= 0) {
                    bot.burnStacks = 0;
                    if (bot.isRed) {
                        bot.isRed = false;
                        bot.mesh.traverse(child => {
                            if (child.isMesh) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
                            }
                        });
                    }
                }
            }
        }
        
        if (isShootingRange) {
            rangeTargets.forEach(t => {
                if (t.burnTimer > 0) {
                    if (!t.isRed) {
                        t.isRed = true;
                        t.traverse(child => {
                            if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x550000); });
                            }
                        });
                    }
                    if (frameCount % 40 === 0) {
                        let dmg = 2 * t.burnStacks;
                        showFloatingDamage(dmg, t.position);
                    }
                    if (frameCount % 3 === 0) {
                        createBurnParticle(t.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                    }
                    t.burnTimer--;
                    if (t.burnTimer <= 0) {
                        t.burnStacks = 0;
                        if (t.isRed) {
                            t.isRed = false;
                            t.traverse(child => {
                                if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                                    mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
                                }
                            });
                        }
                    }
                }
            });
        }
    }

    // Out of Combat Healing Tick (1% per 0.75s after 3s)
    if (frameCount % 45 === 0 && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
        if (frameCount - playerState.lastCombatTime >= 180 && playerState.hp > 0 && playerState.hp < 100) {
            let healAmount = Math.round(100 * 0.01);
            playerState.hp = Math.min(100, playerState.hp + healAmount);
            updateHUD();
        }
    }

    // Knife Healing Tick
    if (frameCount % 60 === 0 && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
        let weapon = getCurrentWeapon();
        if ((weapon.id === 'knife' || weapon.id === 'kukri') && playerState.hp > 0 && playerState.hp < 100) {
            let enemyInRange = false;
            
            for (let i = 0; i < bots.length; i++) {
                if (bots[i].hp > 0 && bots[i].team !== playerState.team) {
                    if (bots[i].mesh.position.distanceTo(camera.position) <= weapon.range) {
                        enemyInRange = true;
                        break;
                    }
                }
            }
            if (!enemyInRange) {
                for (let i = 0; i < activeDrones.length; i++) {
                    if (activeDrones[i].hp > 0 && activeDrones[i].team !== playerState.team) {
                        if (activeDrones[i].mesh.position.distanceTo(camera.position) <= weapon.range) {
                            enemyInRange = true;
                            break;
                        }
                    }
                }
            }
            
            if (enemyInRange) {
                let healPercent = 0.02;
                let healAmount = Math.round(100 * healPercent);
                playerState.hp = Math.min(100, playerState.hp + healAmount);
                updateHUD();
            }
        }
    }

    botAI(delta);
    updateMinimap();
    updateTrajectory();
    
    if (knifeRangeIndicator) {
        if (!playerState.isControllingDrone && (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade') && roundActive) {
            knifeRangeIndicator.visible = true;
            knifeRangeIndicator.position.copy(camera.position);
            knifeRangeIndicator.position.y = 0.05; // Slightly above ground
            const scaleRatio = getCurrentWeapon().range / WEAPONS.knife.range;
            knifeRangeIndicator.scale.setScalar(scaleRatio);
        } else {
            knifeRangeIndicator.visible = false;
        }
    }
    
    // Procedural Knife Swing Animation
    if (playerState.viewModel && (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade')) {
        const now = performance.now();
        let animDuration = (getCurrentWeapon().fireRate / 60) * 1000; // ms
        if (getCurrentWeapon().id === 'switchblade' && playerState.knifeAnimStage === 2) animDuration = 800;
        const elapsed = now - (playerState.knifeAnimStart || 0);
        
        let targetPosX = 0.35;
        let targetPosY = -0.25;
        let targetPosZ = -0.5;
        let targetRotX = 0;
        let targetRotY = -Math.PI / 8;
        let targetRotZ = 0;

        if (elapsed < animDuration) {
            let t = elapsed / animDuration;
            let slashProg = t < 0.3 ? t / 0.3 : 1.0 - ((t - 0.3) / 0.7);
            let ease = 1 - Math.pow(1 - slashProg, 3); // Cubic ease out

            if (getCurrentWeapon().id === 'kukri') {
                if (playerState.knifeAnimStage === 0) {
                    // Kukri Diagonal downward chop
                    targetPosX -= ease * 0.2;
                    targetPosY -= ease * 0.4;
                    targetPosZ -= ease * 0.4;
                    targetRotX -= ease * 0.6;
                    targetRotY += ease * 0.5;
                    targetRotZ -= ease * 0.4;
                } else if (playerState.knifeAnimStage === 1) {
                    // Kukri Backhand upward slash
                    targetPosX += ease * 0.3;
                    targetPosY += ease * 0.3;
                    targetPosZ -= ease * 0.2;
                    targetRotX += ease * 0.5;
                    targetRotY -= ease * 0.8;
                    targetRotZ += ease * 0.5;
                } else {
                    // Kukri Heavy overhead strike
                    targetPosY += ease * 0.5;
                    targetPosZ -= ease * 0.5;
                    targetRotX -= ease * 1.2;
                    targetRotY -= ease * 0.2;
                }
            } else if (getCurrentWeapon().id === 'switchblade') {
                if (playerState.knifeAnimStage === 0) {
                    // 1. Straight forward stab (正着的戳击)
                    targetPosZ -= ease * 0.8;
                } else if (playerState.knifeAnimStage === 2) {
                    // 3. Diagonal downward stab (左上到右下) with a pause
                    let customPosX = 0, customPosY = 0, customPosZ = 0;
                    let customRotX = 0, customRotY = 0;
                    if (t < 0.1875) { // 150ms windup
                        let wt = t / 0.1875;
                        let we = 1 - Math.pow(1 - wt, 2);
                        customPosX = -0.6 * we; 
                        customPosY = 0.4 * we;
                        customPosZ = 0.2 * we;
                        customRotX = 0.5 * we;
                        customRotY = 0.4 * we;
                    } else if (t < 0.8125) { // 500ms pause
                        customPosX = -0.6; 
                        customPosY = 0.4;
                        customPosZ = 0.2;
                        customRotX = 0.5; 
                        customRotY = 0.4;
                    } else if (t < 0.9) { // 70ms strike
                        let st = (t - 0.8125) / 0.0875;
                        let se = 1 - Math.pow(1 - st, 3);
                        customPosX = -0.6 * (1 - se) + 0.1 * se;
                        customPosY = 0.4 * (1 - se) - 0.3 * se;
                        customPosZ = 0.2 * (1 - se) - 0.8 * se;
                        customRotX = 0.5 * (1 - se) - 0.8 * se;
                        customRotY = 0.4 * (1 - se) - 0.2 * se;
                    } else { // 80ms return
                        let rt = (t - 0.9) / 0.1;
                        let re = 1 - Math.pow(rt, 2);
                        customPosX = 0.1 * re;
                        customPosY = -0.3 * re;
                        customPosZ = -0.8 * re;
                        customRotX = -0.8 * re;
                        customRotY = -0.2 * re;
                    }
                    targetPosX += customPosX;
                    targetPosY += customPosY;
                    targetPosZ += customPosZ;
                    targetRotX += customRotX;
                    targetRotY += customRotY;
                } else {
                    // 2. Straight forward stab in the dead center (正中间往前的戳击)
                    targetPosX -= ease * 0.35;
                    targetPosZ -= ease * 0.9;
                    targetRotY += ease * (Math.PI / 8);
                }
            } else {
                if (playerState.knifeAnimStage === 0) {
                    // Slash Left
                    targetPosX -= ease * 0.3;
                    targetPosZ -= ease * 0.3;
                    targetRotX += ease * 0.4;
                    targetRotY += ease * 1.2;
                    targetRotZ += ease * 0.2;
                } else if (playerState.knifeAnimStage === 1) {
                    // Slash Right (Sweep back)
                    targetPosX += ease * 0.4;
                    targetPosY -= ease * 0.1;
                    targetPosZ -= ease * 0.3;
                    targetRotX += ease * 0.3;
                    targetRotY -= ease * 1.5;
                    targetRotZ -= ease * 0.3;
                } else {
                    // Heavy Stab Forward
                    targetPosY += ease * 0.2;
                    targetPosZ -= ease * 0.6;
                    targetRotX -= ease * 0.2;
                    targetRotZ += ease * 0.1;
                }
            }
        }
        
        playerState.viewModel.position.set(targetPosX, targetPosY, targetPosZ);
        playerState.viewModel.rotation.set(targetRotX, targetRotY, targetRotZ);
    }

    // Spread calculation
    const weapon = getCurrentWeapon();
    let baseSpread = (weapon.spread || 0.05) * 1000;
    
    if (weapon.id === 'sniper' && !playerState.isAds) {
        baseSpread = 150; // Huge hip fire spread for AWP
    }
    if (weapon.id === 'shotgun') {
        baseSpread = 12.8; // Reduced hip fire spread for shotgun
    }
    
    if (playerState.isAds) {
        baseSpread *= 0.1;
    } else {
        if (!playerState.isOnGround) {
            if (weapon.id === 'smg' || weapon.id === 'shotgun') {
                baseSpread *= 5.0;
            } else if (weapon.id === 'pistol') {
                baseSpread *= 7.5;
            } else {
                baseSpread *= 10.0;
            }
        } else if (moveForward || moveBackward || moveLeft || moveRight) {
            if (weapon.id === 'smg' || weapon.id === 'shotgun') {
                baseSpread *= 2.5;
            } else if (weapon.id === 'pistol') {
                baseSpread *= 3.75;
            } else {
                baseSpread *= 5.0;
            }
        }
        if (isShooting && !isReloading && controls && controls.isLocked) {
            baseSpread += 8;
        }
    }
    
    currentSpread += (baseSpread - currentSpread) * 0.2;
    
    if (document.getElementById('ch-top')) {
        const gap = currentSpread;
        document.getElementById('ch-top').style.top = `calc(50% - ${gap}px - 5px)`;
        document.getElementById('ch-bottom').style.top = `calc(50% + ${gap}px + 5px)`;
        document.getElementById('ch-left').style.left = `calc(50% - ${gap}px - 5px)`;
        document.getElementById('ch-right').style.left = `calc(50% + ${gap}px + 5px)`;
    }
    
    // View model bobbing & ADS animation
    if (!playerState.isSpectating && playerState.viewModel && controls && controls.isLocked) {
        if (playerState.isAds) {
            playerState.adsProgress += delta * 8;
            if (playerState.adsProgress > 1) playerState.adsProgress = 1;
        } else {
            playerState.adsProgress -= delta * 8;
            if (playerState.adsProgress < 0) playerState.adsProgress = 0;
        }

        const w = getCurrentWeapon();
        let finalFov = 75;
        if (w.id === 'sniper') finalFov = 10;
        else if (w.id === 'marksman') finalFov = 15;
        else if (w.id === 'rifle') finalFov = 50;
        else finalFov = 60;
        
        const ease = 1 - Math.pow(1 - playerState.adsProgress, 3);
        camera.fov = 75 + (finalFov - 75) * ease;
        camera.updateProjectionMatrix();

        const overlay = document.getElementById('scope-overlay');
        const crosshair = document.getElementById('crosshair');
        const redDot = document.getElementById('red-dot-sight');
        
        if (playerState.adsProgress >= 0.99) {
            if (w.id === 'sniper' || w.id === 'marksman') {
                playerState.viewModel.visible = false;
                if (overlay) overlay.classList.remove('hidden');
            } else if (w.id !== 'knife' && w.id !== 'kukri' && w.id !== 'switchblade') {
                if (redDot) redDot.classList.remove('hidden');
            }
            if (crosshair) crosshair.classList.add('hidden');
        } else {
            playerState.viewModel.visible = true;
            if (overlay) overlay.classList.add('hidden');
            if (redDot) redDot.classList.add('hidden');
            if (crosshair) crosshair.classList.remove('hidden');
        }

        if (!playerState.isInspecting && w.id !== 'knife' && w.id !== 'kukri' && w.id !== 'switchblade') {
            const hipX = 0.3, hipY = -0.3, hipZ = -0.5;
            const adsX = 0, adsY = -0.156, adsZ = -0.1125;
            
            const currentBaseX = hipX + (adsX - hipX) * ease;
            let currentBaseY = hipY + (adsY - hipY) * ease;
            const currentBaseZ = hipZ + (adsZ - hipZ) * ease;

            playerState.viewModel.position.x = currentBaseX;
            playerState.viewModel.position.z = currentBaseZ;

            if (playerState.velocity.length() > 2 && !playerState.isAds) {
                currentBaseY += Math.sin(frameCount * 0.2) * 0.02;
            }
            playerState.viewModel.position.y = currentBaseY;
        }
    }
    
    // Weapon Inspect Animation
    if (playerState.viewModel && playerState.isInspecting) {
        const now = performance.now();
        const elapsed = now - playerState.inspectStartTime;
        const inspectDuration = 3500; 

        if (elapsed > inspectDuration) {
            playerState.isInspecting = false;
            if (getCurrentWeapon().id !== 'knife' && getCurrentWeapon().id !== 'kukri' && getCurrentWeapon().id !== 'switchblade') {
                playerState.viewModel.rotation.set(0, 0, 0);
                playerState.viewModel.position.set(0.3, -0.3, -0.5);
            }
        } else {
            let t = elapsed / inspectDuration;
            
            if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade') {
                let customRotX = 0, customRotY = 0, customRotZ = 0;
                let customPosX = 0, customPosY = 0, customPosZ = 0;
                
                if (t < 0.2) {
                    let st = t / 0.2;
                    let ease = 1 - Math.pow(1 - st, 2);
                    customRotZ += ease * Math.PI * 2;
                    customPosY += Math.sin(st * Math.PI) * 0.2;
                } else if (t < 0.8) {
                    let st = (t - 0.2) / 0.6;
                    let admireEase = Math.sin(st * Math.PI);
                    customRotY += admireEase * 2.0;
                    customRotX += admireEase * 0.5;
                    customPosX -= admireEase * 0.2;
                    customPosZ += admireEase * 0.25;
                    customPosY += admireEase * 0.2;
                } else {
                    let st = (t - 0.8) / 0.2;
                    let ease = st * st;
                    customRotZ -= (1 - ease) * Math.PI * 2;
                    customPosY += Math.sin(st * Math.PI) * 0.1;
                }
                
                playerState.viewModel.rotation.x += customRotX;
                playerState.viewModel.rotation.y += customRotY;
                playerState.viewModel.rotation.z += customRotZ;
                playerState.viewModel.position.x += customPosX;
                playerState.viewModel.position.y += customPosY;
                playerState.viewModel.position.z += customPosZ;
            } else {
                let gunRotX = 0, gunRotY = 0, gunRotZ = 0;
                let gunPosX = 0, gunPosY = 0, gunPosZ = 0;
                
                if (t < 0.2) {
                    let st = t / 0.2;
                    let se = 1 - Math.pow(1 - st, 2);
                    gunRotY = se * 1.5;
                    gunRotZ = se * 0.2;
                    gunPosX = -se * 0.1;
                    gunPosZ = se * 0.15;
                    gunPosY = se * 0.15;
                } else if (t < 0.4) {
                    let st = (t - 0.2) / 0.2;
                    gunRotY = 1.5 + Math.sin(st * Math.PI) * 0.1;
                    gunRotZ = 0.2;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                } else if (t < 0.6) {
                    let st = (t - 0.4) / 0.2;
                    let smooth = st * st * (3 - 2 * st);
                    gunRotY = 1.5 * (1 - smooth) + (-1.5 * smooth);
                    gunRotZ = 0.2 * (1 - smooth) + (-0.2 * smooth);
                    gunRotX = Math.sin(smooth * Math.PI) * 0.3;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                } else if (t < 0.8) {
                    let st = (t - 0.6) / 0.2;
                    gunRotY = -1.5 - Math.sin(st * Math.PI) * 0.1;
                    gunRotZ = -0.2;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                    gunPosZ = 0.15;
                } else {
                    let st = (t - 0.8) / 0.2;
                    let se = 1 - Math.pow(st, 2);
                    gunRotY = -1.5 * se;
                    gunRotZ = -0.2 * se;
                    gunPosX = -0.1 * se;
                    gunPosZ = 0.15 * se;
                    gunPosY = 0.15 * se;
                }
                
                playerState.viewModel.rotation.set(gunRotX, gunRotY, gunRotZ);
                playerState.viewModel.position.x = 0.3 + gunPosX;
                playerState.viewModel.position.z = -0.5 + gunPosZ;
                playerState.viewModel.position.y += gunPosY;
            }
        }
    } else if (playerState.viewModel && getCurrentWeapon().id !== 'knife' && getCurrentWeapon().id !== 'kukri' && getCurrentWeapon().id !== 'switchblade') {
         playerState.viewModel.rotation.set(0,0,0);
    }
    
    // Dragon fire animation
    if (playerState.viewModel) {
        let df = playerState.viewModel.getObjectByName('dragonFire');
        if (df) {
            df.children.forEach(spark => {
                spark.position.y += Math.random() * 0.015;
                spark.position.x += (Math.random()-0.5) * 0.01;
                if (spark.position.y > 0.1) {
                    spark.position.set((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.2);
                    spark.material.color.setHex(Math.random() > 0.5 ? 0xff5500 : 0xffaa00);
                }
            });
        }
    }
    
    renderer.render(scene, camera);
}


// #endregion

// #region 投掷物系统
function updateGrenades(delta) {
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.life -= delta;
        g.velocity.y -= 40 * delta; // gravity
        
        const nextX = g.mesh.position.x + g.velocity.x * delta;
        const nextY = g.mesh.position.y + g.velocity.y * delta;
        const nextZ = g.mesh.position.z + g.velocity.z * delta;
        
        let hitFloor = false;
        if (nextY <= 0.25) {
            g.mesh.position.y = 0.25;
            g.velocity.y *= -0.5; // bounce vertical
            g.velocity.x *= 0.8;  // friction
            g.velocity.z *= 0.8;
            hitFloor = true;
        } else {
            g.mesh.position.y = nextY;
        }
        
        // Wall collision (simplified X and Z)
        const box = new THREE.Box3(
            new THREE.Vector3(nextX - 0.25, g.mesh.position.y - 0.25, nextZ - 0.25),
            new THREE.Vector3(nextX + 0.25, g.mesh.position.y + 0.25, nextZ + 0.25)
        );
        let col = collidableMeshList.some(wall => wall.worldBox.intersectsBox(box));
        if (col) {
            g.velocity.x *= -0.5;
            g.velocity.z *= -0.5;
        } else {
            g.mesh.position.x = nextX;
            g.mesh.position.z = nextZ;
        }
        
        if (g.type === 'hegrenade') {
            if (!g.circleMesh) {
                const circleGeo = new THREE.CircleGeometry(40, 32);
                const circleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
                g.circleMesh = new THREE.Mesh(circleGeo, circleMat);
                g.circleMesh.rotation.x = -Math.PI / 2;
                g.circleMesh.position.y = 0.05;
                scene.add(g.circleMesh);
            }
            g.circleMesh.position.x = g.mesh.position.x;
            g.circleMesh.position.z = g.mesh.position.z;
        }

        if (g.life <= 0 || (g.type === 'molotov' && hitFloor)) {
            triggerGrenadeExplosion(g);
            scene.remove(g.mesh);
            if (g.circleMesh) scene.remove(g.circleMesh);
            grenades.splice(i, 1);
        }
    }
}

function triggerGrenadeExplosion(g) {
    const pos = g.mesh.position;
    
    if (g.type === 'hegrenade') {
        createHitEffect(pos, false);
        
        const range = g.isFromDrone ? 50 : 40;
        const dmgMult = g.isFromDrone ? 1.1 : 1.0;
        
        for (let index = bots.length - 1; index >= 0; index--) {
            const b = bots[index];
            const dist = b.mesh.position.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                if (b.team !== g.team) {
                    b.hp -= dmg * 0.75;
                    if (b.hp <= 0) killBot(index, g.team, 'hegrenade');
                }
            }
        }
        
        if (isShootingRange) {
            rangeTargets.forEach(t => {
                const dist = t.position.distanceTo(pos);
                if (dist < range) {
                    const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                    if (dmg > 0) showFloatingDamage(dmg, t.position);
                }
            });
        }
        if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== g.team) {
            const playerPos = getPlayerPosition();
            const dist = playerPos.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 80 * dmgMult * (1 - dist / range)));
                let actualDmg = dmg * 0.75;
                if (getCurrentWeapon().id === 'kukri') actualDmg *= 0.05;
                else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.1;
                if (!playerState.isInvincible) playerState.hp -= Math.ceil(actualDmg);
                playerState.lastCombatTime = frameCount;
                if (playerState.hp <= 0) playerDie(g.team, 'hegrenade');
            }
        }
    } else if (g.type === 'flashbang') {
        createHitEffect(pos, true);
        if (playerState.hp > 0 && !playerState.isSpectating) {
            const playerPos = getPlayerPosition();
            const dist = playerPos.distanceTo(pos);
            if (dist < 200) {
                const dirToFlash = new THREE.Vector3().subVectors(pos, playerPos).normalize();
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                if (camDir.dot(dirToFlash) > 0.3) {
                    raycaster.set(playerPos, dirToFlash);
                    const intersects = raycaster.intersectObjects(collidableMeshList);
                    if (intersects.length === 0 || intersects[0].distance > dist) {
                        const flashOverlay = document.createElement('div');
                        flashOverlay.style.position = 'fixed';
                        flashOverlay.style.top = 0; flashOverlay.style.left = 0;
                        flashOverlay.style.width = '100vw'; flashOverlay.style.height = '100vh';
                        flashOverlay.style.background = 'white';
                        flashOverlay.style.zIndex = 9999;
                        flashOverlay.style.opacity = 1;
                        flashOverlay.style.transition = 'opacity 3s ease-out';
                        document.body.appendChild(flashOverlay);
                        setTimeout(() => flashOverlay.style.opacity = 0, 100);
                        setTimeout(() => flashOverlay.remove(), 3100);
                    }
                }
            }
        }
    } else if (g.type === 'molotov') {
        const size = g.isFromDrone ? 45 * 1.25 : 45;
        const fireGeo = new THREE.PlaneGeometry(size, size);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6 });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.rotation.x = -Math.PI / 2;
        fire.position.set(pos.x, 0.1, pos.z);
        scene.add(fire);
        
        activeFires.push({ 
            mesh: fire, 
            life: 7.0, 
            x: pos.x, 
            z: pos.z, 
            team: g.team, 
            hitMap: new Map(),
            isFromDrone: g.isFromDrone 
        });
    } else if (g.type === 'sandbag') {
        createHitEffect(pos, true);
    }
}

function updateFires(delta) {
    for(let i=activeFires.length-1; i>=0; i--) {
        let f = activeFires[i];
        f.life -= delta;
        if(f.life <= 0) {
            scene.remove(f.mesh);
            activeFires.splice(i, 1);
            continue;
        }
        
        f.mesh.material.opacity = 0.5 + Math.random() * 0.3;
        
        const tickRate = f.isFromDrone ? 7 : 8; 
        if (frameCount % tickRate === 0) { 
            const halfSize = f.isFromDrone ? 28.125 : 22.5; 
            const dmgMult = f.isFromDrone ? 1.1 : 1.0;
            
            for (let index = bots.length - 1; index >= 0; index--) {
                const b = bots[index];
                if (Math.abs(b.mesh.position.x - f.x) < halfSize && Math.abs(b.mesh.position.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get(b) || 0;
                    f.hitMap.set(b, ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    b.hp -= finalDmg * 0.75;
                    if (b.hp <= 0) killBot(index, f.team, 'molotov');
                }
            }
            
            if (isShootingRange) {
                rangeTargets.forEach(t => {
                    if (Math.abs(t.position.x - f.x) < halfSize && Math.abs(t.position.z - f.z) < halfSize) {
                        let ticks = f.hitMap.get(t) || 0;
                        f.hitMap.set(t, ticks + 1);
                        let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                        let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                        showFloatingDamage(finalDmg, t.position);
                    }
                });
            }
            if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== f.team) {
                const playerPos = getPlayerPosition();
                if (Math.abs(playerPos.x - f.x) < halfSize && Math.abs(playerPos.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get('player') || 0;
                    f.hitMap.set('player', ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    let actualDmg = finalDmg * 0.75;
                    if (getCurrentWeapon().id === 'kukri') actualDmg *= 0.05;
                    else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.1;
                    if (!playerState.isInvincible) playerState.hp -= Math.ceil(actualDmg);
                    playerState.lastCombatTime = frameCount;
                    updateHUD();
                    if (playerState.hp <= 0) playerDie(f.team, 'molotov');
                }
            }
        }
    }
}

function createGrenade(start, direction, type, team, isFromDrone = false) {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const color = type === 'hegrenade' ? 0x005500 : (type === 'flashbang' ? 0xaaaaaa : (type === 'molotov' ? 0xaa4400 : 0xaa8844));
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    scene.add(mesh);
    
    direction.y += 0.3;
    direction.normalize();
    
    grenades.push({
        mesh: mesh,
        velocity: direction.multiplyScalar(65),
        type: type,
        team: team,
        life: type === 'molotov' ? Infinity : (type === 'hegrenade' && isFromDrone ? 1.5 : 2.0),
        isFromDrone: isFromDrone
    });
}

// #endregion

// #region 小地图与轨迹
function updateMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const scale = w / 800;
    const cx = w / 2;
    const cy = h / 2;
    
    // Draw obstacles (walls/terrain)
    ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
    collidableMeshList.forEach(mesh => {
        if (mesh.worldBox) {
            const minX = cx + mesh.worldBox.min.x * scale;
            const minZ = cy + mesh.worldBox.min.z * scale;
            const boxWidth = (mesh.worldBox.max.x - mesh.worldBox.min.x) * scale;
            const boxHeight = (mesh.worldBox.max.z - mesh.worldBox.min.z) * scale;
            ctx.fillRect(minX, minZ, boxWidth, boxHeight);
        }
    });
    
    bombZones.forEach((zone, index) => {
        const x = cx + zone.mesh.position.x * scale;
        const z = cy + zone.mesh.position.z * scale;
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)'; 
        ctx.fillRect(x - 4, z - 4, 8, 8);

        ctx.fillStyle = 'white';
        ctx.font = '10px "Microsoft YaHei", Arial';
        ctx.textAlign = 'center';
        const isT = playerState.team === 'T';
        const label = isT ? "我方炸弹安放区" : "我方炸弹拆除区";
        ctx.fillText(label, x, z - 8);
    });
    
    bots.forEach(b => {
        if (b.team !== playerState.team) return; // Only show teammates
        
        const x = cx + b.mesh.position.x * scale;
        const z = cy + b.mesh.position.z * scale;
        
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    });
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const x = cx + camera.position.x * scale;
        const z = cy + camera.position.z * scale;
        
        ctx.beginPath();
        ctx.arc(x, z, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
        
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(x + dir.x * 8, z + dir.z * 8);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

let trajectoryLine = null;
let trajectoryArea = null;

function updateTrajectory() {
    const weapon = getCurrentWeapon();
    if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'sandbag'].includes(weapon.id) || !controls || !controls.isLocked || playerState.hp <= 0 || playerState.isSpectating) {
        if (trajectoryLine) {
            scene.remove(trajectoryLine);
            trajectoryLine.geometry.dispose();
            trajectoryLine.material.dispose();
            trajectoryLine = null;
        }
        if (trajectoryArea) {
            scene.remove(trajectoryArea);
            trajectoryArea.geometry.dispose();
            trajectoryArea.material.dispose();
            trajectoryArea = null;
        }
        return;
    }
    
    const points = [];
    let pos = camera.position.clone();
    let dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y += 0.3;
    dir.normalize();
    
    let vel = dir.multiplyScalar(65);
    const dt = 0.05; 
    
    const isFromDrone = playerState.isControllingDrone;
    const lifeTime = weapon.id === 'molotov' ? Infinity : (weapon.id === 'hegrenade' && isFromDrone ? 1.5 : 2.0);
    const maxIters = lifeTime === Infinity ? 40 : Math.floor(lifeTime / dt);
    
    for (let i = 0; i < maxIters; i++) { 
        points.push(pos.clone());
        vel.y -= 40 * dt; 
        
        let nextX = pos.x + vel.x * dt;
        let nextY = pos.y + vel.y * dt;
        let nextZ = pos.z + vel.z * dt;
        
        let hitFloor = false;
        if (nextY <= 0.25) {
            nextY = 0.25;
            hitFloor = true;
        }
        
        const box = new THREE.Box3(
            new THREE.Vector3(nextX - 0.25, nextY - 0.25, nextZ - 0.25),
            new THREE.Vector3(nextX + 0.25, nextY + 0.25, nextZ + 0.25)
        );
        let col = collidableMeshList.some(wall => wall.worldBox.intersectsBox(box));
        
        if (col) {
            vel.x *= -0.5;
            vel.z *= -0.5;
        } else {
            pos.x = nextX;
            pos.z = nextZ;
        }
        
        pos.y = nextY;
        
        if (hitFloor) {
            if (weapon.id === 'molotov') {
                points.push(pos.clone());
                break;
            }
            vel.y *= -0.5;
            vel.x *= 0.8;
            vel.z *= 0.8;
        }
    }
    
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    if (!trajectoryLine) {
        const color = weapon.id === 'hegrenade' ? 0x00ff00 : (weapon.id === 'flashbang' ? 0xffffff : (weapon.id === 'molotov' ? 0xff4400 : 0xaa8844));
        const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.8, linewidth: 2 });
        trajectoryLine = new THREE.Line(geo, mat);
        scene.add(trajectoryLine);
    } else {
        trajectoryLine.geometry.dispose();
        trajectoryLine.geometry = geo;
        trajectoryLine.material.color.setHex(weapon.id === 'hegrenade' ? 0x00ff00 : (weapon.id === 'flashbang' ? 0xffffff : (weapon.id === 'molotov' ? 0xff4400 : 0xaa8844)));
    }
    
    const finalPos = points[points.length - 1];
    
    if (weapon.id === 'molotov') {
        const size = 45;
        if (!trajectoryArea || trajectoryArea.geometry.type !== 'PlaneGeometry') {
            if (trajectoryArea) {
                scene.remove(trajectoryArea);
                trajectoryArea.geometry.dispose();
                trajectoryArea.material.dispose();
            }
            const planeGeo = new THREE.PlaneGeometry(size, size);
            const planeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            trajectoryArea = new THREE.Mesh(planeGeo, planeMat);
            trajectoryArea.rotation.x = -Math.PI / 2;
            scene.add(trajectoryArea);
        }
    } else {
        const radius = (weapon.id === 'hegrenade' && isFromDrone) ? 50 : 40;
        if (!trajectoryArea || trajectoryArea.geometry.type !== 'CircleGeometry' || trajectoryArea.geometry.parameters.radius !== radius) {
            if (trajectoryArea) {
                scene.remove(trajectoryArea);
                trajectoryArea.geometry.dispose();
                trajectoryArea.material.dispose();
            }
            const circleGeo = new THREE.CircleGeometry(radius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            trajectoryArea = new THREE.Mesh(circleGeo, circleMat);
            trajectoryArea.rotation.x = -Math.PI / 2;
            scene.add(trajectoryArea);
        }
    }
    
    // Always render the area circle on the ground for accurate aiming, even if it explodes mid-air
    trajectoryArea.position.set(finalPos.x, 0.05, finalPos.z);
}

function destroyDrone(drone, exploded = false) {
    if (exploded) {
        triggerDroneExplosion(drone);
    } else {
        createHitEffect(drone.mesh.position, true); // Debris effect
    }
    
    // Remove from scene
    scene.remove(drone.mesh);
    if (drone.targetIndicator) scene.remove(drone.targetIndicator);
    
    // Dispose GPU resources
    drone.mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
    });
    if (drone.targetIndicator) {
        if (drone.targetIndicator.geometry) drone.targetIndicator.geometry.dispose();
        if (drone.targetIndicator.material) drone.targetIndicator.material.dispose();
    }
    
    // Remove from array
    const idx = activeDrones.indexOf(drone);
    if (idx > -1) activeDrones.splice(idx, 1);
    
    // Reset player or bot state
    if (drone.isPlayer) {
        playerState.isControllingDrone = false;
        removePlayerDummy();
        camera.position.copy(drone.playerPos);
        updateHUD();
    } else {
        const bot = bots.find(b => b.id === drone.ownerId);
        if (bot) {
            bot.isControllingDrone = false;
            bot.lastShot = frameCount;
        }
    }
}

// --- MOBILE TOUCH CONTROLS ---
// #endregion

// #region 触控与窗口
function setupTouchControls() {
    if (!window.nipplejs) {
        console.warn("NippleJS not loaded");
        return;
    }

    const joystickZone = document.getElementById('joystick-zone');
    const manager = nipplejs.create({
        zone: joystickZone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    });

    manager.on('move', function (evt, data) {
        const x = data.vector.x;
        const y = data.vector.y;
        moveForward = y > 0.3;
        moveBackward = y < -0.3;
        moveRight = x > 0.3;
        moveLeft = x < -0.3;
    });

    manager.on('end', function () {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    });

    // Touch to look
    const lookZone = document.getElementById('touch-look-zone');
    let lastTouchX = 0;
    let lastTouchY = 0;
    
    // Ensure rotation order is correct for FPS camera
    if (camera) camera.rotation.order = 'YXZ';

    lookZone.addEventListener('touchstart', (e) => {
        lastTouchX = e.changedTouches[0].pageX;
        lastTouchY = e.changedTouches[0].pageY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        if (playerState.isSpectating) return;

        const touch = e.changedTouches[0];
        const dx = touch.pageX - lastTouchX;
        const dy = touch.pageY - lastTouchY;

        let sensitivity = 0.005;
        if (playerState.isAds) {
            sensitivity = 0.002; // lower sensitivity when aiming
        }

        camera.rotation.y -= dx * sensitivity;
        camera.rotation.x -= dy * sensitivity;

        // limit pitch
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

        lastTouchX = touch.pageX;
        lastTouchY = touch.pageY;
    }, { passive: false });
    
    // Action Buttons
    const btnShoot = document.getElementById('touch-shoot');
    btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); if(playerState.isSpectating){ cycleSpectator(); } else { isShooting = true; handleShooting(true); }});
    btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); isShooting = false; });
    
    const btnAim = document.getElementById('touch-aim');
    btnAim.addEventListener('touchstart', (e) => { 
        e.preventDefault(); 
        playerState.isAds = !playerState.isAds;
    });
    
    const btnJump = document.getElementById('touch-jump');
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (playerState.isControllingDrone) {
            moveUp = true;
        } else if (playerState.isOnGround && !playerState.isSpectating) {
            playerState.velocity.y = 15;
            playerState.isOnGround = false;
        }
    });
    btnJump.addEventListener('touchend', (e) => { e.preventDefault(); moveUp = false; });
    
    const btnReload = document.getElementById('touch-reload');
    btnReload.addEventListener('touchstart', (e) => { e.preventDefault(); handleReload(); });
    
    const btnInteract = document.getElementById('touch-interact');
    btnInteract.addEventListener('touchstart', (e) => { e.preventDefault(); isInteracting = true; });
    btnInteract.addEventListener('touchend', (e) => { e.preventDefault(); isInteracting = false; });
    
    const btnCrouch = document.getElementById('touch-crouch');
    btnCrouch.addEventListener('touchstart', (e) => { e.preventDefault(); moveDown = true; });
    btnCrouch.addEventListener('touchend', (e) => { e.preventDefault(); moveDown = false; });

    const btnShift = document.getElementById('touch-shift');
    btnShift.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (playerState.isControllingDrone) {
            const pd = activeDrones.find(d => d.isPlayer);
            if (pd) pd.selfDestructing = true;
        }
    });
}

// --- FULLSCREEN & RESIZE HANDLING ---
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
            document.documentElement.msRequestFullscreen();
        }
        document.getElementById('touch-fullscreen').innerText = "退出";
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
        document.getElementById('touch-fullscreen').innerText = "全屏";
    }
}

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// #endregion 触控与窗口

