// #region Three.js 场景初始化
let scene, camera, renderer, controls;
let clock, raycaster;
let roundActive = false;
let frameCount = 0;

// Global Lighting & Atmosphere References (persistent across map reloads)
let hemiLight = null;
let dirLight = null;
let baseAmbientLight = null;
let playerMuzzleLight = null;
let botMuzzleLight = null;
let playerMuzzleTimer = 0;
let botMuzzleTimer = 0;

// Atmospheric Dust Motes
let dustMotePoints = null;
const DUST_MOTE_COUNT = 350;
const motePositions = new Float32Array(DUST_MOTE_COUNT * 3);
const moteVelocities = new Float32Array(DUST_MOTE_COUNT * 3);
const motePhases = new Float32Array(DUST_MOTE_COUNT);

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
    gatlingBarrelSpin: 0,
    maxHp: 100,
    isZombie: false,
    isSource: false,
    zombieRespawnTimer: 0,
    zombieSlowTimer: 0,
    killStreak: 0,
    lastFlameDamageTick: 0,
    cameraShake: 0,
    weaponFireModes: {}
};

try {
    Object.defineProperty(playerState, 'fireMode', {
        get() {
            const w = (typeof getCurrentWeapon === 'function') ? getCurrentWeapon() : null;
            return (typeof getWeaponFireMode === 'function') ? getWeaponFireMode(w) : 'multi';
        },
        set(val) {
            const w = (typeof getCurrentWeapon === 'function') ? getCurrentWeapon() : null;
            if (w && typeof setWeaponFireMode === 'function') setWeaponFireMode(w, val);
        },
        configurable: true
    });
} catch (e) {}
if (typeof window !== 'undefined') window.playerState = playerState;

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
    playerDummyMesh.name = 'playerDummy';
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
if (typeof window !== 'undefined') {
    window.getPlayerDummyMesh = () => playerDummyMesh;
}

let isReloading = false;
let reloadTimer = null;
let currentSpread = 10;

let bombState = {
    planted: false,
    plantProgress: 0,
    timer: 60,
    mesh: null
};

// Shared resources for bullets and particles (avoids per-shot GC pressure)
const sharedBulletGeo = new THREE.BoxGeometry(0.08, 0.08, 3.2);
const sharedBulletGeoGatling = new THREE.BoxGeometry(0.25, 0.25, 4.5);
const sharedBulletMatYellow = new THREE.MeshBasicMaterial({ color: 0xfffa44, blending: THREE.AdditiveBlending });
const sharedBulletMatOrange = new THREE.MeshBasicMaterial({ color: 0xff8811, blending: THREE.AdditiveBlending });
const sharedBulletMatRed = new THREE.MeshBasicMaterial({ color: 0xff3322, blending: THREE.AdditiveBlending });
const sharedBulletMatGreen = new THREE.MeshBasicMaterial({ color: 0x33ff66, blending: THREE.AdditiveBlending });
const sharedBulletMatCyan = new THREE.MeshBasicMaterial({ color: 0x00f0ff, blending: THREE.AdditiveBlending });
const sharedBulletMatWhite = new THREE.MeshBasicMaterial({ color: 0xffffff, blending: THREE.AdditiveBlending });
const sharedBulletMatLightBlue = new THREE.MeshBasicMaterial({ color: 0x88ccff, blending: THREE.AdditiveBlending });
const sharedBulletMatMagenta = new THREE.MeshBasicMaterial({ color: 0xff33cc, blending: THREE.AdditiveBlending });
const sharedBulletMatShock = new THREE.MeshBasicMaterial({ color: 0xcc66ff, blending: THREE.AdditiveBlending });
const sharedBulletMatFreeze = new THREE.MeshBasicMaterial({ color: 0x88eeff, blending: THREE.AdditiveBlending });
const sharedBulletMatRicochet = new THREE.MeshBasicMaterial({ color: 0xd0d0d0, blending: THREE.AdditiveBlending });
const sharedBulletMatFragment = new THREE.MeshBasicMaterial({ color: 0xff5533, blending: THREE.AdditiveBlending });
const sharedFlameGeo = new THREE.BoxGeometry(0.15, 0.15, 0.3);
const sharedFlameMat = new THREE.MeshBasicMaterial({ color: 0xff5500, transparent: true, opacity: 0.8 });
const sharedParticleGeo = new THREE.BoxGeometry(0.2, 0.2, 0.2);
const sharedMuzzleGeo = new THREE.BoxGeometry(0.12, 0.12, 0.12);

// Input
var moveForward = false, moveBackward = false, moveLeft = false, moveRight = false;
var moveUp = false, moveDown = false;
var isShooting = false;
var isInteracting = false;

function unstuckPlayer() {
    if (!roundActive || playerState.isSpectating || playerState.hp <= 0) return;
    if (playerState.isControllingDrone) return;
    if (typeof mortarCameraActive !== 'undefined' && mortarCameraActive) return;
    if (typeof mortarMapOpen !== 'undefined' && mortarMapOpen) return;
    if (playerState.spawnPos) {
        camera.position.x = playerState.spawnPos.x;
        camera.position.y = playerState.spawnPos.y || 2;
        camera.position.z = playerState.spawnPos.z;
        if (playerState.velocity) playerState.velocity.set(0, 0, 0);
        playerState.isOnGround = true;
        if (typeof showKillFeed === 'function') showKillFeed('已脱离卡死回到出生点');
    }
}

function cheatToggleInvincible() {
    playerState.isInvincible = !playerState.isInvincible;
    if (typeof showKillFeed === 'function') {
        showKillFeed(playerState.isInvincible ? '你已开启无敌模式' : '你已关闭无敌模式');
    }
}

function cheatAddCurrencyAndScore() {
    playerCurrency += 1000;
    playerScore += 1000;
    if (typeof showKillFeed === 'function') {
        showKillFeed('已增加 1000 金钱与积分');
    }
    const _hudCred = document.getElementById('hud-credits');
    if (_hudCred) _hudCred.innerText = playerCurrency;
    const _hudScore2 = document.getElementById('hud-score');
    if (_hudScore2) _hudScore2.innerText = playerScore;
    const _buyCred = document.getElementById('buy-credits');
    if (_buyCred) _buyCred.innerText = playerCurrency;
    const _buyScore = document.getElementById('buy-score');
    if (_buyScore) _buyScore.innerText = playerScore;
    if (typeof updateHUD === 'function') updateHUD();
}

document.addEventListener('keydown', (e) => {
    if (!controls || (!controls.isLocked && !isPlayerControlActive())) {
        if (e.code === 'Escape') {
            const _buyMenuEl = document.getElementById('buy-menu');
            if (_buyMenuEl && !_buyMenuEl.classList.contains('hidden')) closeBuyMenu();
            const _scopeEl = document.getElementById('scope-panel');
            if (_scopeEl && !_scopeEl.classList.contains('hidden')) toggleScopePanel();
            if (typeof mortarMapOpen !== 'undefined' && mortarMapOpen && typeof closeMortarMap === 'function') closeMortarMap();
            return;
        }
        if (mortarMapOpen) return;
        if (e.key.toLowerCase() === 'b' && roundActive && !playerState.isSpectating) {
            const _buyMenuEl = document.getElementById('buy-menu');
            const _buyOpen = _buyMenuEl && !_buyMenuEl.classList.contains('hidden');
            // 生化模式: 爆发后/已感染不能打开购买菜单（但允许关闭）
            if (!_buyOpen && gameMode === 'zombie' && (!zombieState.pending || playerState.isZombie)) return;
            if (_buyOpen) {
                closeBuyMenu();
            } else {
                openBuyMenu();
            }
        }
        if (e.code === 'KeyL' && (roundActive || (typeof isShootingRange !== 'undefined' && isShootingRange)) && !playerState.isSpectating) {
            cheatToggleInvincible();
            return;
        }
        if (e.code === 'KeyK' && (roundActive || (typeof isShootingRange !== 'undefined' && isShootingRange)) && !playerState.isSpectating) {
            cheatAddCurrencyAndScore();
            return;
        }
        if (e.code === 'KeyT' && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
            toggleScopePanel();
        }
        if (e.code === 'KeyU' && roundActive && !playerState.isSpectating) {
            unstuckPlayer();
        }
        if ((e.code === 'KeyX' || e.code === 'KeyZ') && (roundActive || (typeof isShootingRange !== 'undefined' && isShootingRange)) && !playerState.isSpectating && !playerState.isControllingDrone) {
            toggleFireMode();
            return;
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
                cheatToggleInvincible();
                break;
            case 'KeyK':
                cheatAddCurrencyAndScore();
                break;
            case 'KeyR': handleReload(); break;
            case 'KeyF':
                if (mortarMapOpen) { fireMortar(); break; }
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
            case 'KeyQ':
                if (typeof useAdrenaline === 'function') useAdrenaline();
                break;
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
            case 'KeyU':
                unstuckPlayer();
                break;
            case 'KeyV':
                toggleDropCompensation();
                break;
            case 'KeyG':
                quickThrowGrenade();
                break;
            case 'KeyX':
            case 'KeyZ':
                if ((roundActive || (typeof isShootingRange !== 'undefined' && isShootingRange)) && !playerState.isSpectating && !playerState.isControllingDrone) {
                    toggleFireMode();
                }
                break;
            case 'Escape': {
                const _buyMenuEl = document.getElementById('buy-menu');
                if (_buyMenuEl && !_buyMenuEl.classList.contains('hidden')) closeBuyMenu();
                const _scopeEl = document.getElementById('scope-panel');
                if (_scopeEl && !_scopeEl.classList.contains('hidden')) toggleScopePanel();
                if (typeof mortarMapOpen !== 'undefined' && mortarMapOpen && typeof closeMortarMap === 'function') closeMortarMap();
                break;
            }
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
        const canLock = (typeof shouldAutoLockPointer === 'function') ? shouldAutoLockPointer() : !isTouchDevice;
        if (!canLock) {
            if (playerState.isSpectating) {
                cycleSpectator();
                return;
            }
            if (!playerState.isControllingDrone) {
                isShooting = true;
                handleShooting(true);
            }
            return;
        }
        if (roundActive && controls && (!controls.isLocked || !document.pointerLockElement) && !playerState.isSpectating) {
            if (typeof tryLockPointer === 'function') tryLockPointer();
        }
        if (playerState.isSpectating) {
            cycleSpectator();
            return;
        }
        isShooting = true; 
        handleShooting(true); 
    }
    if (e.button === 2 && ((controls && controls.isLocked) || isPlayerControlActive())) {
        const w = getCurrentWeapon();
        if (w.id !== 'gatling' && w.id !== 'mortar' && w.id !== 'zombieClaw' && w.id !== 'flamethrower' && !playerState.isAds) {
            playerState.isAds = true;
            if (w.id === 'sniper' || w.id === 'marksman') playScopeZoom();
        }
    }
});
document.addEventListener('mouseup', (e) => { 
    if (e.button === 0) isShooting = false; 
    if (e.button === 2 && camera) {
        playerState.isAds = false;
    }
});
document.addEventListener('contextmenu', e => e.preventDefault());

let _lastFallbackMouseX = null;
let _lastFallbackMouseY = null;
const _fallbackAimEuler = new THREE.Euler(0, 0, 0, 'YXZ');

document.addEventListener('mousemove', (e) => {
    // If pointer is locked by PointerLockControls, Three.js already controls rotation
    if (controls && controls.isLocked && document.pointerLockElement) {
        _lastFallbackMouseX = e.clientX;
        _lastFallbackMouseY = e.clientY;
        return;
    }

    if (!roundActive || !camera || playerState.isSpectating || playerState.isControllingDrone || (typeof mortarCameraActive !== 'undefined' && mortarCameraActive) || (typeof mortarMapOpen !== 'undefined' && mortarMapOpen)) {
        _lastFallbackMouseX = e.clientX;
        _lastFallbackMouseY = e.clientY;
        return;
    }

    const buyMenu = document.getElementById('buy-menu');
    const scopePanel = document.getElementById('scope-panel');
    const mainMenu = document.getElementById('main-menu');
    const resultScreen = document.getElementById('result-screen');
    if ((buyMenu && !buyMenu.classList.contains('hidden')) ||
        (scopePanel && !scopePanel.classList.contains('hidden')) ||
        (mainMenu && mainMenu.classList.contains('active')) ||
        (resultScreen && !resultScreen.classList.contains('hidden'))) {
        _lastFallbackMouseX = e.clientX;
        _lastFallbackMouseY = e.clientY;
        return;
    }

    // When pointer lock is unavailable, blocked or pending:
    // Allow aiming if dragging (mouse buttons down) so user can always aim and adjust gun direction
    if (e.buttons > 0) {
        const movementX = (typeof e.movementX === 'number' && e.movementX !== 0) ? e.movementX : (_lastFallbackMouseX !== null ? e.clientX - _lastFallbackMouseX : 0);
        const movementY = (typeof e.movementY === 'number' && e.movementY !== 0) ? e.movementY : (_lastFallbackMouseY !== null ? e.clientY - _lastFallbackMouseY : 0);

        if (Math.abs(movementX) < 400 && Math.abs(movementY) < 400) {
            _fallbackAimEuler.setFromQuaternion(camera.quaternion);
            _fallbackAimEuler.y -= movementX * 0.002;
            _fallbackAimEuler.x -= movementY * 0.002;
            const _PI_2 = Math.PI / 2;
            _fallbackAimEuler.x = Math.max(-_PI_2 + 0.01, Math.min(_PI_2 - 0.01, _fallbackAimEuler.x));
            camera.quaternion.setFromEuler(_fallbackAimEuler);
        }
    }

    _lastFallbackMouseX = e.clientX;
    _lastFallbackMouseY = e.clientY;
});

function resetInputState() {
    moveForward = false;
    moveBackward = false;
    moveLeft = false;
    moveRight = false;
    moveUp = false;
    moveDown = false;
    isShooting = false;
    isInteracting = false;
    _lastFallbackMouseX = null;
    _lastFallbackMouseY = null;
    if (typeof playerState !== 'undefined' && playerState) {
        playerState.isAds = false;
    }
}
window.addEventListener('blur', resetInputState);
document.addEventListener('visibilitychange', () => {
    if (document.hidden) resetInputState();
});

function cycleSpectator() {
    const friendlyBots = bots.filter(b => b.team === playerState.team && !b.isDead);
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
        const canLock = (typeof shouldAutoLockPointer === 'function') ? shouldAutoLockPointer() : !isTouchDevice;
        if (roundActive && controls && !controls.isLocked && canLock && !playerState.isSpectating) {
            if (!document.pointerLockElement) {
                try { const res = controls.lock(); if (res && res.catch) res.catch(() => {}); } catch (e) {}
            } else {
                controls.isLocked = true;
            }
        }
        if (typeof updatePointerLockPrompt === 'function') {
            updatePointerLockPrompt();
        }
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
