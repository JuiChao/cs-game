// --- GLOBAL STATE & UI LOGIC ---
let playerCurrency = 3200;
let playerScore = 0;
let matchState = { tWins: 0, ctWins: 0, maxWins: 5, lossStreakT: 0, lossStreakCT: 0, botMoneyT: new Array(10).fill(800), botMoneyCT: new Array(10).fill(800) };

// Weapon Definitions
const WEAPONS = {
    pistol: { id: 'pistol', name: '格洛克', damage: 20, fireRate: 3, spread: 0.01, mag: 20, reserve: 120, auto: true, range: 100, color: 0x333333, length: 0.4, killReward: 300 },
    rifle: { id: 'rifle', name: '突击步枪 (AK-47)', damage: 35, fireRate: 6, spread: 0.005, mag: 30, reserve: 90, auto: true, range: 200, color: 0x8b4513, length: 0.8, killReward: 300 },
    sniper: { id: 'sniper', name: '狙击步枪 (AWP)', damage: 110, fireRate: 80, spread: 0.00025, mag: 10, reserve: 30, auto: false, range: 500, color: 0x1a4314, length: 1.2, killReward: 100 },
    smg: { id: 'smg', name: '冲锋枪 (P90)', damage: 22, fireRate: 4, spread: 0.0125, mag: 50, reserve: 150, auto: true, range: 120, color: 0x444444, length: 0.5, killReward: 600 },
    shotgun: { id: 'shotgun', name: '霰弹枪 (Nova)', damage: 150, fireRate: 45, spread: 0.026, mag: 8, reserve: 32, auto: false, range: 50, color: 0x222222, length: 0.9, killReward: 900 },
    m249: { id: 'm249', name: '重机枪 (M249)', damage: 30, fireRate: 7, spread: 0.02, mag: 100, reserve: 200, auto: true, range: 180, color: 0x113311, length: 1.0, killReward: 300 },
    deagle: { id: 'deagle', name: '沙漠之鹰 (Deagle)', damage: 60, fireRate: 20, spread: 0.005, mag: 7, reserve: 35, auto: false, range: 150, color: 0x777777, length: 0.45, killReward: 300 },
    knife: { id: 'knife', name: '战术小刀', damage: 55, fireRate: 25, spread: 0, mag: '-', reserve: '-', auto: true, range: 3, color: 0xcccccc, length: 0.3, killReward: 1500 },
    hegrenade: { id: 'hegrenade', name: '手雷 (HE)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x005500, length: 0.2, killReward: 300 },
    flashbang: { id: 'flashbang', name: '闪光弹 (Flash)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaaaaaa, length: 0.2, killReward: 300 },
    molotov: { id: 'molotov', name: '燃烧瓶 (Molotov)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaa4400, length: 0.2, killReward: 300 },
    sandbag: { id: 'sandbag', name: '沙包 (Sandbag)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xc2b280, length: 0.25, killReward: 0 },
    drone: { id: 'drone', name: '战术无人机 (Drone)', damage: 150, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x2c3e50, length: 0.3, killReward: 300 }
};

let inventory = {
    primary: null,
    secondary: 'pistol',
    melee: 'knife',
    grenades: { hegrenade: 0, flashbang: 0, molotov: 0, sandbag: 0, drone: 0 },
    currentGrenade: null,
    currentSlot: 2 // 1: Primary, 2: Secondary, 3: Melee, 4: Grenade
};

let ammoState = {
    primary: { clip: 0, reserve: 0 },
    secondary: { clip: 20, reserve: 120 },
    grenade: { clip: 0, reserve: 0 }
};

let activeDrones = [];

let roundTime = 240;
let roundTimerInterval = null;

function getCurrentWeapon() {
    if (inventory.currentSlot === 1 && inventory.primary) return WEAPONS[inventory.primary];
    if (inventory.currentSlot === 2) return WEAPONS[inventory.secondary];
    if (inventory.currentSlot === 4 && inventory.currentGrenade) return WEAPONS[inventory.currentGrenade];
    return WEAPONS.knife;
}

function isPlayerInSpawn() {
    if (!playerState.spawnPos) return false;
    return camera.position.distanceTo(playerState.spawnPos) < 150;
}

function startGame() {
    document.getElementById('main-menu').classList.remove('active');
    document.getElementById('game-screen').classList.add('active');
    document.getElementById('hud-credits').innerText = playerCurrency;
    init3DGame();
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
        if (type === 'rifle' || type === 'sniper' || type === 'smg' || type === 'shotgun' || type === 'm249') {
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
    
    isReloading = false;
    
    inventory.currentSlot = slot;
    
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${slot}`).classList.add('active');
    
    updateViewModel();
    updateHUD();
}

function handleReload() {
    if (isReloading || playerState.isSpectating) return;
    const weapon = getCurrentWeapon();
    if (weapon.id === 'knife' || weapon.type === 'grenade') return;
    
    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
    if (currentAmmo.clip >= weapon.mag || currentAmmo.reserve <= 0) return;
    
    isReloading = true;
    showKillFeed(`正在换弹...`); // Reusing kill feed for HUD message
    
    setTimeout(() => {
        if (!isReloading) return; // Cancelled by weapon switch
        isReloading = false;
        if (playerState.hp <= 0) return;
        const needed = weapon.mag - currentAmmo.clip;
        const reloadAmount = Math.min(needed, currentAmmo.reserve);
        currentAmmo.clip += reloadAmount;
        currentAmmo.reserve -= reloadAmount;
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
let scene, camera, renderer, controls;
let clock, raycaster;
let roundActive = false;
let frameCount = 0;
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

// Player State
let playerState = {
    hp: 100,
    team: 'T',
    lastShot: -1000,
    speed: 11.25,
    velocity: new THREE.Vector3(),
    direction: new THREE.Vector3(),
    viewModel: null,
    isSpectating: false,
    spectateIndex: 0,
    isOnGround: true,
    isAds: false,
    isControllingDrone: false,
    spawnPos: new THREE.Vector3()
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
    timer: 90,
    mesh: null
};

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
            case 'KeyR': handleReload(); break;
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
        const w = getCurrentWeapon();
        if (w.id === 'sniper') camera.fov = 15;
        else if (w.id === 'rifle') camera.fov = 50;
        else camera.fov = 60;
        camera.updateProjectionMatrix();
        playerState.isAds = true;
    }
});
document.addEventListener('mouseup', (e) => { 
    if (e.button === 0) isShooting = false; 
    if (e.button === 2 && camera) {
        camera.fov = 75;
        camera.updateProjectionMatrix();
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


let gameInitialized = false;

function init3DGame() {
    if (!gameInitialized) {
        const container = document.getElementById('canvas-container');
        container.innerHTML = ''; 

        scene = new THREE.Scene();
        scene.background = new THREE.Color(0x87CEEB); // Sky blue
        scene.fog = new THREE.Fog(0x87CEEB, 20, 300);

        camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

        const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
        scene.add(ambientLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(100, 200, 100);
        scene.add(dirLight);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setSize(window.innerWidth, window.innerHeight);
        container.appendChild(renderer.domElement);

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
        
        buildLargeMap();
        
        collidableMeshList = [];
        scene.children.forEach(child => {
            if (child.name === 'wall') {
                child.worldBox = new THREE.Box3().setFromObject(child);
                collidableMeshList.push(child);
            }
        });

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
    if (bots) bots.forEach(b => scene.remove(b.mesh));
    if (bullets) bullets.forEach(b => scene.remove(b.mesh));
    if (grenades) grenades.forEach(g => scene.remove(g.mesh));
    if (activeFires) activeFires.forEach(f => scene.remove(f.mesh));
    if (particles) particles.forEach(p => scene.remove(p.mesh));
    if (bombState.mesh) { scene.remove(bombState.mesh); bombState.mesh = null; }

    bots = [];
    bullets = [];
    grenades = [];
    activeFires = [];
    particles = [];
    
    let squadSpawns = [];
    for (let i = 0; i < 10; i++) {
        squadSpawns.push(getValidSpawnPoint(squadSpawns, 100));
    }
    
    let ctSpawns = squadSpawns.slice(0, 5);
    let tSpawns = squadSpawns.slice(5, 10);
    
    if (playerState.team === 'T') {
        camera.position.set(tSpawns[0].x, 2, tSpawns[0].z);
        camera.rotation.set(0, Math.random() * Math.PI * 2, 0);
    } else {
        camera.position.set(ctSpawns[0].x, 2, ctSpawns[0].z);
        camera.rotation.set(0, Math.random() * Math.PI * 2, 0);
    }
    
    playerState.spawnPos.copy(camera.position);
    
    buildViewModel();

    spawnBots(ctSpawns, tSpawns);

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
    
    document.getElementById('bomb-status').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('active');
    document.getElementById('result-screen').classList.add('hidden');
    document.getElementById('buy-prompt').classList.remove('hidden');
    setTimeout(() => { document.getElementById('buy-prompt').classList.add('hidden'); }, 10000);

    updateHUD();
}

function buildLargeMap() {
    const texLoader = new THREE.TextureLoader();
    
    // Floor Texture (Sand)
    const floorTex = texLoader.load('https://images.unsplash.com/photo-1542272201-b1ca555f8505?w=1024&h=1024&fit=crop');
    floorTex.wrapS = THREE.RepeatWrapping;
    floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(20, 20);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1.0 });

    const floorGeo = new THREE.PlaneGeometry(800, 800);
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    // Wall Texture (Stone/Brick)
    let clonedWallMaterials = [];
    const wallTex = texLoader.load('https://images.unsplash.com/photo-1517627043994-b991abb62fc8?w=1024&h=1024&fit=crop', (loadedTex) => {
        clonedWallMaterials.forEach(mat => {
            mat.map.image = loadedTex.image;
            mat.map.needsUpdate = true;
        });
    });
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
    
    const createBox = (x, z) => {
        const geo = new THREE.BoxGeometry(10, 10, 10);
        const mat = boxMat.clone();
        const box = new THREE.Mesh(geo, mat);
        box.position.set(x, 5, z);
        box.name = 'wall';
        scene.add(box);
    }
    
    const createDoor = (x, z, w, d) => {
        const geo = new THREE.BoxGeometry(w, 40, d);
        const mat = new THREE.MeshStandardMaterial({ color: 0x4a4a4a }); 
        const door = new THREE.Mesh(geo, mat);
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
    zoneA.position.set(-330, 0.05, -330); // Top-left
    scene.add(zoneA);
    bombZones.push({ mesh: zoneA, name: 'A 区' });
}

function buildViewModel() {
    if (playerState.viewModel) camera.remove(playerState.viewModel);
    
    const w = getCurrentWeapon();
    const geo = new THREE.BoxGeometry(0.1, 0.1, w.length);
    const mat = new THREE.MeshStandardMaterial({ color: w.color });
    playerState.viewModel = new THREE.Mesh(geo, mat);
    
    // Position bottom right of camera
    playerState.viewModel.position.set(0.3, -0.3, -0.5);
    camera.add(playerState.viewModel);
    scene.add(camera);
}

function updateViewModel() {
    if(!playerState.viewModel) return;
    const w = getCurrentWeapon();
    playerState.viewModel.geometry.dispose();
    playerState.viewModel.geometry = new THREE.BoxGeometry(0.1, 0.1, w.length);
    playerState.viewModel.material.color.setHex(w.color);
}

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
        const bodyMat = team === 'CT' ? ctMat : tMat;
        const faceMat = team === 'CT' ? ctFaceMat : tFaceMat;

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
            if (roundTime <= 0) {
                endRound("时间到！反恐精英获胜", false, 'time');
            }
            updateHUD();
        }
    }, 1000);
}

function createBullet(start, direction, weapon, shooterInfo) {
    const geo = new THREE.BoxGeometry(0.1, 0.1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xfffb00 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    // Align bullet to direction
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), direction);
    scene.add(mesh);
    
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
    const speed = 250; // bullet speed
    
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        const moveDist = speed * delta;
        b.distance += moveDist;
        
        // Raycast for collision
        raycaster.set(b.mesh.position, b.direction);
        raycaster.far = moveDist;
        
        let targets = bots.map(bot => bot.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
        const intersects = raycaster.intersectObjects(targets, true);
        
        // Player hit check
        let hitPlayer = false;
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
                }
            }
        }
        
        if (hitPlayer) {
            playerState.hp -= b.weapon.damage;
            updateHUD();
            createHitEffect(getPlayerPosition(), false);
            
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
            
            if (hitBot && hitBot.team !== b.shooter.team) {
                let dmg = b.weapon.damage;
                if (hit.object.name === 'head') dmg *= 2; // Headshot
                hitBot.hp -= dmg;
                createHitEffect(hit.point, false);

                if (hitBot.hp <= 0) killBot(hitIndex, b.shooter.team, b.weapon.id);
            } else if (hitDrone && hitDrone.team !== b.shooter.team) {
                hitDrone.hp -= b.weapon.damage;
                createHitEffect(hit.point, false);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (!hitBot && !hitDrone) {
                createHitEffect(hit.point, true); // Wall hit
            }
            
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        } else {
            b.mesh.position.add(b.direction.clone().multiplyScalar(moveDist));
            if (b.distance >= b.maxDistance) {
                scene.remove(b.mesh);
                bullets.splice(i, 1);
            }
        }
    }
}

function createHitEffect(pos, isWall) {
    const color = isWall ? 0xaaaaaa : 0xff0000;
    for(let i = 0; i < 5; i++) {
        const geo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
        const mat = new THREE.MeshBasicMaterial({ color: color });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        
        particles.push({
            mesh: mesh,
            velocity: new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10),
            life: 1.0
        });
    }
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= delta * 2;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            particles.splice(i, 1);
        } else {
            p.velocity.y -= 20 * delta; // gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.material.opacity = p.life;
            p.mesh.material.transparent = true;
        }
    }
}

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
    const ringGeo = new THREE.RingGeometry(13, 15, 32);
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
        updateHUD();
        return;
    }
    
    if (isReloading) return;
    const weapon = getCurrentWeapon();
    if (!weapon.auto && !initialClick) return; 
    if (!isShooting) return;
    if (frameCount - playerState.lastShot < weapon.fireRate) return;

    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : (inventory.currentSlot === 2 ? ammoState.secondary : (inventory.currentSlot === 4 ? ammoState.grenade : null));
    
    if (weapon.id !== 'knife' && inventory.currentSlot !== 4) {
        if (currentAmmo.clip <= 0) {
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
        updateHUD();
        return;
    }

    playerState.lastShot = frameCount;
    updateHUD();
    
    // View model recoil animation
    if(playerState.viewModel) {
        playerState.viewModel.position.z += 0.1; // Kickback
        setTimeout(() => { if(playerState.viewModel) playerState.viewModel.position.z -= 0.1; }, 50);
    }

    if (weapon.id === 'knife') {
        raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
        raycaster.far = weapon.range;
        let targets = bots.map(b => b.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
        const intersects = raycaster.intersectObjects(targets, true);
        if (intersects.length > 0) {
            const hit = intersects[0];
            let hitBot = null;
            let hitIndex = -1;
            let hitDrone = null;
            for (let i = 0; i < bots.length; i++) {
                if (hit.object === bots[i].mesh || hit.object.parent === bots[i].mesh) {
                    hitBot = bots[i]; hitIndex = i; break;
                }
            }
            if (!hitBot) {
                for (let j = 0; j < activeDrones.length; j++) {
                    if (hit.object === activeDrones[j].mesh || hit.object.parent === activeDrones[j].mesh) {
                        hitDrone = activeDrones[j]; break;
                    }
                }
            }
            
            if (hitBot && hitBot.team !== playerState.team) {
                hitBot.hp -= weapon.damage;
                createHitEffect(hit.point, false);
                if (hitBot.hp <= 0) killBot(hitIndex, playerState.team, weapon.id);
            } else if (hitDrone && hitDrone.team !== playerState.team) {
                hitDrone.hp -= weapon.damage;
                createHitEffect(hit.point, false);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            }
        }
        return;
    }

    // Guns use projectiles
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    let bulletCount = weapon.id === 'shotgun' ? 8 : 1;
    let start = camera.position.clone().add(new THREE.Vector3(0,-0.5,0));
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    
    for (let i = 0; i < bulletCount; i++) {
        let dir = raycaster.ray.direction.clone();
        
        // Add spread
        let actualSpread = (currentSpread + 5) / 500;
        if (weapon.id === 'shotgun') actualSpread += weapon.spread;
        const theta = Math.random() * Math.PI * 2;
        const r = Math.sqrt(Math.random()) * actualSpread;
        
        dir.add(right.multiplyScalar(Math.cos(theta) * r));
        dir.add(up.multiplyScalar(Math.sin(theta) * r));
        dir.normalize();

        createBullet(start, dir, weapon, { team: playerState.team });
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
    } else {
        showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 [${bot.team}] BOT`);
    }

    scene.remove(bot.mesh);
    bots.splice(index, 1);
    
    checkWinCondition();
}

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

function checkWinCondition() {
    const ctAlive = bots.filter(b => b.team === 'CT').length + (playerState.hp > 0 && playerState.team === 'CT' ? 1 : 0);
    const tAlive = bots.filter(b => b.team === 'T').length + (playerState.hp > 0 && playerState.team === 'T' ? 1 : 0);
    
    document.getElementById('score-ct').innerText = ctAlive;
    document.getElementById('score-t').innerText = tAlive;
    
    document.getElementById('label-t').innerText = playerState.team === 'T' ? '我方 T' : '敌方 T';
    document.getElementById('label-ct').innerText = playerState.team === 'CT' ? '我方 CT' : '敌方 CT';

    if (ctAlive === 0 && !bombState.planted) endRound("所有反恐精英已被消灭！恐怖分子获胜", true, 'elimination');
    if (tAlive === 0 && !bombState.planted) endRound("所有恐怖分子已被消灭！反恐精英获胜", false, 'elimination');
}

function moveBotWithCollision(bot, moveVector) {
    const nextX = bot.mesh.position.x + moveVector.x;
    const nextZ = bot.mesh.position.z + moveVector.z;
    
    const botBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - 0.4, 0.5, bot.mesh.position.z - 0.4),
        new THREE.Vector3(nextX + 0.4, 3.5, bot.mesh.position.z + 0.4)
    );
    let colX = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxX));
    
    const botBoxZ = new THREE.Box3(
        new THREE.Vector3(bot.mesh.position.x - 0.4, 0.5, nextZ - 0.4),
        new THREE.Vector3(bot.mesh.position.x + 0.4, 3.5, nextZ + 0.4)
    );
    let colZ = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxZ));
    
    if (!colX) { bot.mesh.position.x = nextX; }
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
        
        const botEye = b.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
        
        if (playerState.hp > 0 && playerState.team !== b.team && !playerState.isSpectating) {
            const playerEye = getPlayerPosition().clone();
            const d = botEye.distanceTo(playerEye);
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
                const dir = new THREE.Vector3().subVectors(otherEye, botEye).normalize();
                raycaster.set(botEye, dir);
                raycaster.far = d;
                const intersects = raycaster.intersectObjects(collidableMeshList);
                if (intersects.length === 0) {
                    if (d < minDist) { minDist = d; nearestEnemy = otherEye; }
                }
            }
        });
        
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
            const fireCooldown = 60 / (WEAPONS[b.weapon].fireRate / 2); // Approximate frame delay
            if (frameCount - b.lastShot > fireCooldown) {
                b.lastShot = frameCount;
                
                const dir = new THREE.Vector3().subVectors(nearestEnemy, botEye).normalize();
                
                let actualSpread = WEAPONS[b.weapon].spread * 2.5; // Base bot spread (+25% inaccuracy)
                if (minDist > 150) actualSpread *= 0.1; // ADS Simulation at long range
                
                if (Math.random() < 0.05) {
                    const gType = ['hegrenade', 'flashbang', 'molotov'][Math.floor(Math.random()*3)];
                    let spreadDir = dir.clone();
                    spreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.normalize();
                    createGrenade(botEye.clone(), spreadDir, gType, b.team);
                } else {
                    let bulletCount = b.weapon === 'shotgun' ? 8 : 1;
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
                if (distToBomb < 7.5) {
                    b.actionProgress++;
                    if (b.actionProgress >= 810) {
                        endRound("反恐精英成功拆除了炸弹！", false, 'bomb_defuse');
                        bombState.planted = false;
                        if (bombState.mesh) { scene.remove(bombState.mesh); bombState.mesh = null; }
                    }
                    return; // Stop moving, defusing
                } else {
                    b.actionProgress = 0;
                }
            } else if (bombState.planted && b.team === 'T' && isDefusing && bombState.mesh) {
                b.targetNode = bombState.mesh.position.clone();
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
                        bombState.timer = 60;
                        b.actionProgress = 0;
                        
                        const bombGeo = new THREE.BoxGeometry(0.8, 0.2, 0.5);
                        const bombMat = new THREE.MeshStandardMaterial({ color: 0x333333 });
                        bombState.mesh = new THREE.Mesh(bombGeo, bombMat);
                        bombState.mesh.position.copy(b.mesh.position);
                        bombState.mesh.position.y = 0.1;
                        
                        const lightGeo = new THREE.SphereGeometry(0.1);
                        const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                        const lightMesh = new THREE.Mesh(lightGeo, lightMat);
                        lightMesh.position.set(0, 0.15, 0);
                        bombState.mesh.add(lightMesh);
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

            const dir = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position);
            if (dir.length() < 2) {
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
                b.mesh.lookAt(b.targetNode);
                const moveVec = dir.multiplyScalar(9 * delta); // Normal speed (-25%)
                
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
                    let bestDir = dir.clone().negate();
                    let bestScore = -Infinity;
                    
                    const p1 = new THREE.Vector3(b.mesh.position.x, 1.5, b.mesh.position.z);
                    for(let i = 0; i < 16; i++) {
                        let angle = i * Math.PI / 8;
                        let td = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle));
                        raycaster.set(p1, td);
                        raycaster.far = 40;
                        const intersects = raycaster.intersectObjects(collidableMeshList);
                        let d = intersects.length > 0 ? intersects[0].distance : 40;
                        
                        let score = d;
                        if (d > 5) {
                            score += td.dot(dir) * 20;
                        }
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestDir = td.clone();
                        }
                    }
                    
                    b.targetNode = b.mesh.position.clone().add(bestDir.multiplyScalar(20));
                    b.stuckTimer = 90; 
                    b.timeStuck = 0;
                    
                    if (!bombState.planted && b.team === 'T') {
                        b.bombTarget = null;
                    }
                }
            }
        }
    });
}

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
        if (playerState.team !== 'CT' || !bombState.mesh) {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            return;
        }

        const distToBomb = playerPos.distanceTo(bombState.mesh.position);
        if (distToBomb < 7.5) {
            if (!isInteracting) promptUI.classList.remove('hidden');
            else promptUI.classList.add('hidden');

            if (isInteracting) {
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 810) * 100}%`;

                if (bombState.plantProgress >= 810) {
                    endRound("你成功拆除了炸弹！", false, 'bomb_defuse');
                    bombState.planted = false;
                    if (bombState.mesh) { scene.remove(bombState.mesh); bombState.mesh = null; }
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

            if (isInteracting) {
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 180) * 100}%`;

                if (bombState.plantProgress >= 180) {
                    bombState.planted = true;
                    bombUI.classList.add('hidden');
                    playerScore += 20;
                    bombState.plantProgress = 0;
                    bombState.timer = 60;
                    
                    const bombGeo = new THREE.BoxGeometry(0.8, 0.2, 0.4);
                    const bombMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
                    bombState.mesh = new THREE.Mesh(bombGeo, bombMat);
                    bombState.mesh.position.copy(camera.position);
                    bombState.mesh.position.y = 0.1;
                    
                    const lightGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
                    const lightMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                    const lightMesh = new THREE.Mesh(lightGeo, lightMat);
                    lightMesh.position.set(0, 0.15, 0);
                    bombState.mesh.add(lightMesh);
                    
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
    bots.forEach((b, index) => {
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < 15) {
            const dmg = Math.round(Math.max(0, 120 * (1 - dist / 15)));
            if (b.team !== drone.team) {
                b.hp -= dmg;
                if (b.hp <= 0) killBot(index, drone.team, 'drone');
            }
        }
    });
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(pos);
        if (dist < 15) {
            const dmg = Math.round(Math.max(0, 120 * (1 - dist / 15)));
            if (playerState.team !== drone.team || dmg > 0) {
                playerState.hp -= dmg;
                if (playerState.hp <= 0) playerDie(drone.team, 'drone');
            }
        }
    }
}

function updateDronePhysics(delta) {
    activeDrones.forEach(drone => {
        // Indicator
        raycaster.set(drone.mesh.position, new THREE.Vector3(0, -1, 0));
        let targets = bots.map(b => b.mesh).concat(collidableMeshList);
        const intersects = raycaster.intersectObjects(targets);
        let groundY = 0;
        if (intersects.length > 0) groundY = intersects[0].point.y;
        
        drone.targetIndicator.position.set(drone.mesh.position.x, groundY + 0.1, drone.mesh.position.z);
    
        if (drone.selfDestructing) {
            drone.targetIndicator.visible = false;
            
            // Dive animation
            const diveSpeed = 78.125;
            drone.mesh.position.y -= diveSpeed * delta;
            
            if (drone.isPlayer) {
                camera.position.y = drone.mesh.position.y;
            }
    
            // Check if hit ground
            if (drone.mesh.position.y <= groundY + 2.0) {
                destroyDrone(drone, true);
            }
            return; // Skip normal movement
        }
        
        drone.targetIndicator.visible = true;
    
        drone.velocity.x -= drone.velocity.x * 5.0 * delta;
        drone.velocity.y -= drone.velocity.y * 5.0 * delta;
        drone.velocity.z -= drone.velocity.z * 5.0 * delta;
    
        if (drone.isPlayer) {
            let dirZ = Number(moveForward) - Number(moveBackward);
            let dirX = Number(moveRight) - Number(moveLeft);
            let dirY = Number(moveUp) - Number(moveDown);
        
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            forward.crossVectors(camera.up, right).normalize();
        
            if (dirZ !== 0) drone.velocity.add(forward.clone().multiplyScalar(dirZ * 250.0 * delta));
            if (dirX !== 0) drone.velocity.add(right.clone().multiplyScalar(dirX * 250.0 * delta));
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
    });
}

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
    const speedMult = w.id === 'knife' ? 1.3 : 1.0;

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
    const playerBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - playerRadius, 0.5, camera.position.z - playerRadius),
        new THREE.Vector3(nextX + playerRadius, 3.5, camera.position.z + playerRadius)
    );
    let colX = collidableMeshList.some(wall => wall.worldBox.intersectsBox(playerBoxX));
    
    const playerBoxZ = new THREE.Box3(
        new THREE.Vector3(camera.position.x - playerRadius, 0.5, nextZ - playerRadius),
        new THREE.Vector3(camera.position.x + playerRadius, 3.5, nextZ + playerRadius)
    );
    let colZ = collidableMeshList.some(wall => wall.worldBox.intersectsBox(playerBoxZ));

    if (!colX) {
        camera.position.x = nextX;
    } else {
        playerState.velocity.x = 0;
    }

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

    const delta = clock.getDelta();
    
    // Update zone labels
    const isT = playerState.team === 'T';
    bombZones.forEach((zone) => {
        const labelEl = document.getElementById('zoneA-label');
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
                labelEl.innerText = isT ? "我方炸弹安放区" : "我方炸弹拆除区";
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
    updateFires(delta);
    
    // Global Bomb Timer Tick
    if (bombState.planted && roundActive) {
        if (frameCount % 60 === 0) {
            bombState.timer--;
            updateHUD();
            
            if (bombState.mesh) bombState.mesh.material.color.setHex(bombState.timer % 2 === 0 ? 0xff0000 : 0x330000);
            
            if (bombState.timer <= 0) {
                endRound("C4 炸弹已引爆！恐怖分子获胜", true, 'bomb_explode');
            }
        }
    }

    botAI(delta);
    updateMinimap();
    updateTrajectory();
    
    // Spread calculation
    const weapon = getCurrentWeapon();
    let baseSpread = (weapon.spread || 0.05) * 1000;
    
    if (weapon.id === 'sniper' && !playerState.isAds) {
        baseSpread = 150; // Huge hip fire spread for AWP
    }
    
    if (playerState.isAds) {
        baseSpread *= 0.1;
    } else {
        if (!playerState.isOnGround) {
            baseSpread *= 10.0;
        } else if (moveForward || moveBackward || moveLeft || moveRight) {
            baseSpread *= 5.0;
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
    
    // View model bobbing
    if (!playerState.isSpectating && playerState.viewModel && controls && controls.isLocked) {
        if (playerState.velocity.length() > 2) {
            playerState.viewModel.position.y = -0.3 + Math.sin(frameCount * 0.2) * 0.02;
        } else {
            playerState.viewModel.position.y = -0.3;
        }
    }
    
    renderer.render(scene, camera);
}


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
        
        bots.forEach((b, index) => {
            const dist = b.mesh.position.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                if (b.team !== g.team) {
                    b.hp -= dmg;
                    if (b.hp <= 0) killBot(index, g.team, 'hegrenade');
                }
            }
        });
        if (playerState.hp > 0 && !playerState.isSpectating) {
            const playerPos = getPlayerPosition();
            const dist = playerPos.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 80 * dmgMult * (1 - dist / range)));
                playerState.hp -= dmg;
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
            
            bots.forEach((b, index) => {
                if (Math.abs(b.mesh.position.x - f.x) < halfSize && Math.abs(b.mesh.position.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get(b) || 0;
                    f.hitMap.set(b, ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    b.hp -= finalDmg;
                    if (b.hp <= 0) killBot(index, f.team, 'molotov');
                }
            });
            if (playerState.hp > 0 && !playerState.isSpectating) {
                const playerPos = getPlayerPosition();
                if (Math.abs(playerPos.x - f.x) < halfSize && Math.abs(playerPos.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get('player') || 0;
                    f.hitMap.set('player', ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    playerState.hp -= finalDmg;
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
        if(!playerState.isAds) {
            const w = getCurrentWeapon();
            if (w.id === 'sniper') camera.fov = 15;
            else if (w.id === 'rifle') camera.fov = 50;
            else camera.fov = 60;
            camera.updateProjectionMatrix();
            playerState.isAds = true;
        } else {
            camera.fov = 75;
            camera.updateProjectionMatrix();
            playerState.isAds = false;
        }
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

