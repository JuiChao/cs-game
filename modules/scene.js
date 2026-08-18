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
    currentScope: 'redDot',
    isControllingDrone: false,
    spawnPos: new THREE.Vector3(),
    isInspecting: false,
    bulletType: 'normal',
    bulletStacking: false,
    bulletTypes: [],
    armorPlates: 0,
    inspectStartTime: 0,
    gatlingFireStartFrame: 0,
    gatlingBarrelSpin: 0
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
const sharedBulletGeoGatling = new THREE.BoxGeometry(0.3, 0.3, 2);
const sharedBulletMatYellow = new THREE.MeshBasicMaterial({ color: 0xfffb00 });
const sharedBulletMatOrange = new THREE.MeshBasicMaterial({ color: 0xff4500 });
const sharedBulletMatRed = new THREE.MeshBasicMaterial({ color: 0xff0000 });
const sharedBulletMatGreen = new THREE.MeshBasicMaterial({ color: 0x44ff00 });
const sharedBulletMatCyan = new THREE.MeshBasicMaterial({ color: 0x00ffff });
const sharedBulletMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff });
const sharedBulletMatLightBlue = new THREE.MeshBasicMaterial({ color: 0x88ccff });
const sharedBulletMatMagenta = new THREE.MeshBasicMaterial({ color: 0xff00ff });
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
        if (e.code === 'KeyT' && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
            toggleScopePanel();
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
                document.getElementById('hud-credits').innerText = playerCurrency;
                const _hudScore2 = document.getElementById('hud-score');
                if (_hudScore2) _hudScore2.innerText = playerScore;
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
            case 'KeyT':
                if (roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
                    toggleScopePanel();
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
        const w = getCurrentWeapon();
        if (w.id !== 'gatling') playerState.isAds = true;
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

// ── Scope Selection Panel ──
let _scopeToggleTime = 0;
function toggleScopePanel() {
    const now = performance.now();
    if (now - _scopeToggleTime < 400) return; // debounce 400ms
    _scopeToggleTime = now;
    const panel = document.getElementById('scope-panel');
    if (panel.classList.contains('hidden')) {
        buildScopeGrid();
        panel.classList.remove('hidden');
        panel.classList.add('active');
        if (controls && controls.isLocked) controls.unlock();
    } else {
        panel.classList.add('hidden');
        panel.classList.remove('active');
        if (controls && !controls.isLocked && !playerState.isSpectating) controls.lock();
    }
}

function buildScopeGrid() {
    const grid = document.getElementById('scope-grid');
    grid.innerHTML = '';
    const scopeIcons = {
        none: '⊘', redDot: '●', holo: '◎',
        scope2x: '2×', scope3x: '3×', scope4x: '4×', scope5x: '5×', scope8x: '8×'
    };
    SCOPE_ORDER.forEach(sid => {
        const s = SCOPE_TYPES[sid];
        const btn = document.createElement('button');
        btn.style.cssText = 'padding:12px 6px; text-align:center; border-radius:6px; cursor:pointer; font-size:13px; border:1px solid #555; background:rgba(40,40,40,0.85); color:#ddd; transition:all 0.15s;';
        const isActive = (playerState.currentScope === sid);
        if (isActive) {
            btn.style.borderColor = '#f1c40f';
            btn.style.background = 'rgba(241,196,15,0.15)';
        }
        btn.innerHTML = '<div style="font-size:22px; font-weight:bold; color:' + (isActive ? '#f1c40f' : '#aaa') + ';">' + scopeIcons[sid] + '</div><div style="margin-top:4px;">' + s.name + '</div>';
        btn.onclick = function() { selectScope(sid); };
        btn.onmouseenter = function() { if (!isActive) { btn.style.borderColor = '#888'; btn.style.background = 'rgba(60,60,60,0.85)'; } };
        btn.onmouseleave = function() { if (!isActive) { btn.style.borderColor = '#555'; btn.style.background = 'rgba(40,40,40,0.85)'; } };
        grid.appendChild(btn);
    });
    document.getElementById('current-scope-label').textContent = SCOPE_TYPES[playerState.currentScope].name;
}

function selectScope(sid) {
    if (!SCOPE_TYPES[sid]) return;
    playerState.currentScope = sid;
    buildScopeGrid();
    if (playerState.viewModel) updateViewModel();
    showKillFeed('瞄准镜已切换: ' + SCOPE_TYPES[sid].name);
}

// --- NAV GRID & PATHFINDING ---
// #endregion
