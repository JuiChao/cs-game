// #region 全局状态与配置
// --- GLOBAL STATE & UI LOGIC ---
function checkIsTouchDevice() {
    return Boolean(
        (typeof window !== 'undefined' && window.isTouchDevice) ||
        (typeof window !== 'undefined' && 'ontouchstart' in window) ||
        (typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) ||
        (typeof window !== 'undefined' && window.matchMedia && window.matchMedia("(pointer: coarse)").matches)
    );
}
var isTouchDevice = checkIsTouchDevice();
if (typeof window !== 'undefined') {
    window.isTouchDevice = isTouchDevice;
    if (isTouchDevice && typeof document !== 'undefined' && document.body) {
        document.body.classList.add('touch-device');
    }
}

function shouldAutoLockPointer() {
    if (typeof window === 'undefined') return false;
    const isSmallScreen = Math.min(window.innerWidth, window.innerHeight) <= 768 || window.innerWidth <= 768;
    const hasFinePointer = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const ua = (typeof navigator !== 'undefined') ? (navigator.userAgent || '') : '';
    const maxTouch = (typeof navigator !== 'undefined') ? (navigator.maxTouchPoints || 0) : 0;
    const isIPadOS = ua.includes('Macintosh') && (maxTouch > 0 || ('ontouchstart' in window));
    const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) || isIPadOS;

    if (typeof isTouchDevice !== 'undefined' && isTouchDevice) {
        if ((isSmallScreen && !hasFinePointer) || isMobileDevice) {
            return false;
        }
    }
    return true;
}
if (typeof window !== 'undefined') window.shouldAutoLockPointer = shouldAutoLockPointer;

function updateAdaptivePrompts() {
    if (typeof document === 'undefined') return;
    var isTouch = (typeof checkIsTouchDevice === 'function' ? checkIsTouchDevice() : Boolean(typeof isTouchDevice !== 'undefined' && isTouchDevice))
        || ('ontouchstart' in window) || (navigator.maxTouchPoints > 0) || (window.matchMedia && window.matchMedia("(pointer: coarse)").matches) || /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

    // 1. Spectator Prompt
    var sp = document.getElementById('spectator-prompt');
    if (sp) {
        var p = sp.querySelector('p');
        if (p) {
            var targetEl = document.getElementById('spectator-target');
            var target = targetEl ? targetEl.innerText : '无';
            var specHint = isTouch ? '点击屏幕或开火键切换观战视角' : '点击鼠标左键切换观战视角';
            p.innerHTML = specHint + '<br>(当前观战: <span id="spectator-target" style="color:#e67e22;">' + target + '</span>)';
        }
    }

    // 2. Pointer Lock Subtitle
    var plSub = document.querySelector('.pointer-lock-subtitle');
    if (plSub) {
        plSub.innerText = isTouch ? '轻触屏幕进入战斗' : '锁定鼠标以控制准心视角 (按 Esc 释放)';
    }

    // 3. Mortar Map Instruction & Cancel Button
    var mortarInst = document.getElementById('mortar-map-instruction');
    if (mortarInst) {
        mortarInst.innerText = isTouch ? '点击地图选择目标 · 点击下方按钮发射或关闭' : '滚轮缩放 · 点击选择目标 · 按 F 发射 · 按 Esc 取消';
    }
    var mortarCancelBtn = document.getElementById('mortar-cancel-btn');
    if (mortarCancelBtn) {
        mortarCancelBtn.innerText = isTouch ? '返回角色本体视角' : '返回角色本体视角 (Esc / F)';
    }

    // 4. Pickup & Interact Prompts
    var pickupPrompt = document.getElementById('pickup-prompt');
    if (pickupPrompt) {
        pickupPrompt.innerText = isTouch ? '点击拾取武器' : '按 [E] 拾取武器';
    }
    var interactPrompt = document.getElementById('interact-prompt');
    if (interactPrompt) {
        interactPrompt.innerText = isTouch ? '点击或按住 [互动]' : '长按 [E] 互动';
    }

    // 5. Close Buttons
    var buyCloseBtn = document.querySelector('#buy-menu .deploy-btn');
    if (buyCloseBtn) {
        buyCloseBtn.innerText = isTouch ? '关闭菜单' : '关闭菜单 (按 B)';
    }
    var scopeCloseBtn = document.querySelector('#scope-panel .tactical-deploy-btn');
    if (scopeCloseBtn) {
        scopeCloseBtn.innerText = isTouch ? '关闭' : '关闭 (按 T)';
    }

    // 6. Shop item descriptions
    var mortarShopBtn = document.querySelector("button[onclick*='mortar']");
    if (mortarShopBtn) {
        var small1 = mortarShopBtn.querySelector('small');
        if (small1) {
            small1.innerText = isTouch
                ? '打开战术地图选择目标发射，炮弹从天而降造成大范围爆炸伤害'
                : '左键打开战术地图选择目标，按F键发射，炮弹从天而降造成大范围爆炸伤害';
        }
    }
    var dropCompBtn = document.getElementById('btn-drop-comp');
    if (dropCompBtn && (typeof dropCompensationPurchased === 'undefined' || !dropCompensationPurchased)) {
        var small2 = dropCompBtn.querySelector('small');
        if (small2) {
            small2.innerText = isTouch
                ? '购买后开镜自动测距补偿：准心下移补偿弹道下坠，对准敌人即可命中'
                : '购买后开镜瞄准敌人按 V 键：准心一次性下移补偿弹道下坠，往上抬准心对准头部即可命中';
        }
    }
    var adrenalineBtn = document.getElementById('btn-adrenaline');
    if (adrenalineBtn) {
        var small3 = adrenalineBtn.querySelector('small');
        if (small3) {
            small3.innerText = isTouch
                ? '购买后注射：8秒移速+50%，最多携带3支。点击右侧图标使用，逃命神器'
                : '购买后按 Q 注射：8秒移速+50%，最多携带3支。感染爆发后随时可用，逃命/抢空投神器';
        }
    }

    // 7. Scope Shortcut Pill
    var scopePill = document.querySelector('.scope-shortcut-pill');
    if (scopePill) {
        scopePill.innerHTML = isTouch
            ? '<span class="mobile-prompt-hint">免费</span>'
            : '<span class="desktop-prompt-hint"><span class="key-tag">T</span> 关闭 · 免费</span>';
    }

    // 8. Buy Prompt
    var buyPrompt = document.getElementById('buy-prompt');
    if (buyPrompt) {
        buyPrompt.innerHTML = isTouch
            ? '<span class="mobile-prompt-hint">点击 [购买] 打开菜单</span>'
            : '<span class="desktop-prompt-hint">按 [B] 打开购买菜单</span>';
    }

    // 9. Controls Hint
    var controlsHint = document.getElementById('controls-hint');
    if (controlsHint) {
        if (isTouch) {
            controlsHint.style.display = 'none';
        } else {
            controlsHint.style.display = '';
        }
    }
}
if (typeof window !== 'undefined') {
    window.updateAdaptivePrompts = updateAdaptivePrompts;
    if (typeof document !== 'undefined') {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', updateAdaptivePrompts);
        } else {
            updateAdaptivePrompts();
        }
    }
    window.addEventListener('resize', updateAdaptivePrompts);
}

function isPlayerControlActive() {
    if (typeof roundActive !== 'undefined' && !roundActive) return false;
    if (typeof playerState !== 'undefined' && (playerState.hp <= 0 || playerState.isSpectating)) return false;
    if (typeof mortarMapOpen !== 'undefined' && mortarMapOpen) return false;
    if (typeof mortarCameraActive !== 'undefined' && mortarCameraActive) return false;
    if (typeof controls !== 'undefined' && controls && controls.isLocked) return true;
    if (checkIsTouchDevice()) {
        const buyMenu = document.getElementById('buy-menu');
        if (buyMenu && !buyMenu.classList.contains('hidden')) return false;
        const scopePanel = document.getElementById('scope-panel');
        if (scopePanel && !scopePanel.classList.contains('hidden')) return false;
        return true;
    }
    return false;
}

function isDevMode() {
    if (typeof window !== 'undefined' && window.__DEV__ === true) return true;
    try {
        if (typeof window !== 'undefined' && window.location && window.location.search) {
            const params = new URLSearchParams(window.location.search);
            return params.get('debug') === 'true' || params.get('dev') === 'true';
        }
    } catch (e) {}
    return false;
}
if (typeof window !== 'undefined') window.isDevMode = isDevMode;

let playerCurrency = 3200;
let playerScore = 0;
let matchState = { tWins: 0, ctWins: 0, maxWins: 8, lossStreakT: 0, lossStreakCT: 0, botMoneyT: new Array(10).fill(800), botMoneyCT: new Array(10).fill(800), roundKills: { player: 0, myBots: 0, enemyBots: 0 }, roundBestKiller: null };
let activeSmokes = [];   // 烟雾云: { group, x, z, life, grow }
let weaponDrops = [];    // 武器掉落: { mesh, weaponId, life }
let activeMines = [];    // 地雷: { group, lamp, circle, x, z, team, armTimer, isPlayer }

// ── 游戏模式: 'bomb' 爆破 | 'zombie' 生化 ──
let gameMode = 'bomb';

// ── 生化模式配置 (CS Biohazard 风格) ──
const ZOMBIE = {
    infectionDelay: 15,      // 感染爆发倒计时（秒），也是购买窗口
    sourceCount: 2,          // 母体僵尸数量
    sourceHp: 3000,          // 母体僵尸血量
    hp: 1500,                // 普通僵尸血量
    speed: 30,               // 僵尸Bot移动速度（普通Bot为22）
    playerSpeedMult: 1.45,   // 僵尸玩家移速倍率
    attackRange: 14,         // 僵尸Bot感染攻击距离
    attackCooldown: 45,      // 僵尸Bot感染攻击间隔（帧）
    respawnFrames: 480,      // 僵尸死亡后重生时间（8秒）
    regenPerSec: 25,         // 僵尸每秒回血
    newSlowFrames: 1800,     // 新变僵尸适应期时长（帧，30秒）
    newSlowMult: 0.5,        // 新变僵尸适应期移速倍率
    serumCost: 8000,         // 变异血清价格（爆发后可购买，变身为母体僵尸）
    playerDmgMult: 1.25,     // 生化模式下玩家对僵尸的伤害加成倍率
    // 空投补给
    airdropDelay: 30,        // 感染爆发后首次空投延迟（秒）
    airdropInterval: 75,     // 后续空投间隔（秒）
    airdropLife: 20,         // 空投落地后可拾取时长（秒）
    airdropHp: 600,          // 空投箱血量（僵尸可摧毁）
    // 沙袋路障
    barrierHp: 600,          // 沙袋路障血量
    barrierMax: 12,          // 场上路障数量上限
    // 肾上腺素
    adrenalineCost: 300,     // 肾上腺素价格
    adrenalineDuration: 8,   // 肾上腺素持续（秒）
    adrenalineMult: 1.5      // 肾上腺素移速倍率
};

// 生化模式: 对僵尸目标的伤害加成倍率（仅在玩家伤害来源的结算点调用）
function zombieDmgTakenMult(target) {
    return (gameMode === 'zombie' && target && target.team === 'ZOMBIE') ? ZOMBIE.playerDmgMult : 1;
}

// 生化模式爆破系(手雷/燃烧弹/迫击炮/无人机)对僵尸伤害×3
function zombieExplosiveDmgMult(target) {
    return (gameMode === 'zombie' && target && target.team === 'ZOMBIE') ? 3 : 1;
}

// 冰冻子弹减速倍率: 1层50% / 2层65% / 3层80% 减速（供Bot移速计算调用）
function botFreezeSpeedMult(bot) {
    if (!bot || !(bot.freezeTimer > 0)) return 1;
    const stacks = Math.max(1, Math.min(BULLET_TYPES.freeze.maxFreezeStacks, bot.freezeStacks || 1));
    return 1 - (0.5 + 0.15 * (stacks - 1));
}

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
    pistol: { id: 'pistol', name: '格洛克', damage: 20, fireRate: 3, spread: 0.01, mag: 33, reserve: 120, auto: true, range: 100, color: 0x333333, length: 0.4, killReward: 300, dropRate: 0.000040 },
    rifle: { id: 'rifle', name: '突击步枪 (AK-47)', damage: 35, fireRate: 6, spread: 0.005, mag: 30, reserve: 90, auto: true, range: 200, color: 0x8b4513, length: 0.8, killReward: 300, dropRate: 0.000020 },
    sniper: { id: 'sniper', name: '狙击步枪 (AWP)', damage: 110, fireRate: 64, spread: 0.00025, mag: 10, reserve: 30, auto: false, range: 500, color: 0x1a4314, length: 1.2, killReward: 100, dropRate: 0.000008 },
    marksman: { id: 'marksman', name: '射手步枪 (DMR)', damage: 34, fireRate: 6.86, spread: 0.002, mag: 25, reserve: 90, auto: true, range: 450, color: 0x2e4a23, length: 1.1, killReward: 300, dropRate: 0.000012 },
    smg: { id: 'smg', name: '冲锋枪 (P90)', damage: 27.8, fireRate: 3.4, spread: 0.00625, mag: 50, reserve: 150, auto: true, range: 120, color: 0x444444, length: 0.5, killReward: 600, dropRate: 0.000035 },
    mk4: { id: 'mk4', name: 'MK4 冲锋枪 (三连发)', damage: 32, fireRate: 6.16, burst: 3, burstDelay: 3, spread: 0.004, mag: 30, reserve: 90, auto: false, range: 160, color: 0x3a4a5a, length: 0.55, killReward: 600, reloadTime: 2.2, dropRate: 0.000030 },
    shotgun: { id: 'shotgun', name: '连发霰弹枪 (Auto)', damage: 6, fireRate: 13.5, spread: 0.00511, mag: 12, reserve: 36, auto: true, range: 50, color: 0x222222, length: 0.9, killReward: 900, dropRate: 0.000080 },
    m249: { id: 'm249', name: '重机枪 (M249)', damage: 30, fireRate: 5.19, spread: 0.02, mag: 100, reserve: 200, auto: true, range: 180, color: 0x113311, length: 1.0, killReward: 300, dropRate: 0.000030 },
    gatling: { id: 'gatling', name: '加特林 (Gatling)', damage: 12.5, fireRate: 8, spread: 0.015, mag: 400, reserve: 800, auto: true, range: 200, color: 0x2a2a3a, length: 0.7, killReward: 300, reloadTime: 5, dropRate: 0.000035 },
    ash12: { id: 'ash12', name: 'ASH-12 (突击步枪)', damage: 65, fireRate: 10.5, spread: 0.008, mag: 30, reserve: 90, auto: true, range: 300, color: 0x1a1a2e, length: 0.85, killReward: 300, dropRate: 0.000018 },
    flamethrower: { id: 'flamethrower', name: '喷火器 (Flamethrower)', damage: 3, fireRate: 0, spread: 0.02, mag: 300, reserve: 600, auto: true, range: 1050, color: 0x8B0000, length: 0.8, killReward: 300, reloadTime: 4 },
    deagle: { id: 'deagle', name: '沙漠之鹰 (Deagle)', damage: 60, fireRate: 20, spread: 0.005, mag: 7, reserve: 35, auto: false, range: 150, color: 0x777777, length: 0.45, killReward: 300, dropRate: 0.000025 },
    knife: { id: 'knife', name: '战术小刀 (Karambit)', damage: 34, fireRate: 16, spread: 0, mag: '-', reserve: '-', auto: true, range: 8.05, color: 0xcccccc, length: 0.3, killReward: 1500 },
    zombieClaw: { id: 'zombieClaw', name: '僵尸利爪 (Claw)', damage: 45, fireRate: 22, spread: 0, mag: '-', reserve: '-', auto: true, range: 16.0, color: 0x4a7a3a, length: 0.35, killReward: 0 },
    kukri: { id: 'kukri', name: '尼泊尔军刀 (Kukri)', damage: 55, fireRate: 34, spread: 0, mag: '-', reserve: '-', auto: true, range: 15.0, color: 0xaaaaaa, length: 0.4, killReward: 1500 },
    switchblade: { id: 'switchblade', name: '北极星弹簧刀 (Switchblade)', damage: 35, fireRate: 20, spread: 0, mag: '-', reserve: '-', auto: true, range: 12.0, color: 0xcccccc, length: 0.35, killReward: 1500 },
    hegrenade: { id: 'hegrenade', name: '手雷 (HE)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x005500, length: 0.2, killReward: 300 },
    flashbang: { id: 'flashbang', name: '闪光弹 (Flash)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaaaaaa, length: 0.2, killReward: 300 },
    molotov: { id: 'molotov', name: '燃烧瓶 (Molotov)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xaa4400, length: 0.2, killReward: 300 },
    smoke: { id: 'smoke', name: '烟雾弹 (Smoke)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x9aa0a6, length: 0.2, killReward: 300 },
    sandbag: { id: 'sandbag', name: '沙包 (Sandbag)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0xc2b280, length: 0.25, killReward: 0 },
    mine: { id: 'mine', name: '地雷 (Mine)', damage: 0, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x2a3a2a, length: 0.2, killReward: 300 },
    drone: { id: 'drone', name: '战术无人机 (Drone)', damage: 150, fireRate: 60, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x2c3e50, length: 0.3, killReward: 300 },
    mortar: { id: 'mortar', name: '迫击炮 (Mortar)', damage: 150, fireRate: 120, spread: 0, mag: 1, reserve: 5, auto: false, range: 0, color: 0x4a5a2a, length: 0.6, killReward: 300, explosionRadius: 50 },
    c4: { id: 'c4', name: 'C4 炸弹', damage: 500, fireRate: 0, spread: 0, mag: 1, reserve: 0, auto: false, range: 0, color: 0x333333, length: 0.3, killReward: 300 }
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
        [0.027, 0], [0.0243, 0.0027], [0.0216, -0.00405], [0.0189, 0.00405], [0.0162, -0.0027],
        [0.0135, 0.0054], [0.0135, -0.0054]
    ],
    smg: [
        [0.012, 0], [0.012, 0.002], [0.010, -0.003], [0.010, 0.003], [0.008, -0.002],
        [0.008, 0.004], [0.008, -0.004], [0.006, 0.005], [0.006, -0.005]
    ],
    mk4: [
        [0.012, 0], [0.015, 0.004], [0.018, -0.006]
    ],
    shotgun: [[0.04, 0]],
    m249: [
        [0.0144, 0], [0.0144, 0.0024], [0.012, -0.0032], [0.012, 0.0032], [0.0096, -0.0024],
        [0.0096, 0.004], [0.008, -0.004], [0.008, 0.0048], [0.0064, -0.0048], [0.0064, 0.0048]
    ],
    gatling: [
        [0.010, 0], [0.010, 0.002], [0.009, -0.002], [0.009, 0.003], [0.008, -0.003],
        [0.008, 0.003], [0.007, -0.004], [0.007, 0.004], [0.006, -0.004], [0.006, 0.004]
    ],
    deagle: [[0.05, 0]]
};

let inventory = {
    primary: null,
    secondary: 'pistol',
    melee: 'knife',
    melees: ['knife', 'kukri', 'switchblade'],
    grenades: { hegrenade: 0, flashbang: 0, molotov: 0, smoke: 0, sandbag: 0, mine: 0, drone: 0 },
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
let predictionMarker;
let predictionTargetBot = null;
let predictionGraceTimer = 0;
let dropCompensationPurchased = false;
let dropCompensationActive = false;
let dropCompensationOffset = 0;

let roundTime = 240;
let roundTimerInterval = null;
let wallhackActive = false;

// ── Map Selection ──
let currentMap = 'dust2';

const MAP_LIST = {
    dust2:    { id: 'dust2',    name: 'Dust II',   desc: '沙漠城镇，经典对称爆破图' },
    inferno:  { id: 'inferno',  name: 'Inferno',   desc: '意大利小镇，中庭拱门与香蕉道' },
    biolab:   { id: 'biolab',   name: '生化实验室', desc: '丧尸围城，三大高台守点与货柜迷宫' }
};

const MAP_SPAWN_AREAS = {
    dust2: {
        t: { minX: -350, maxX: 350, minZ: 270, maxZ: 370 },
        ct: { minX: -350, maxX: 350, minZ: -370, maxZ: -270 }
    },
    inferno: {
        t: { minX: -55, maxX: 55, minZ: 275, maxZ: 350 },
        ct: { minX: -55, maxX: 55, minZ: -350, maxZ: -275 }
    },
    biolab: {
        t: { minX: -70, maxX: 70, minZ: 110, maxZ: 200 },
        ct: { minX: -70, maxX: 70, minZ: 110, maxZ: 200 }
    }
};

// ── Scope / Optic Definitions ──
// fov: ADS FOV when using this scope (base hipfire FOV = 75)
// overlayType: 'redDot' | 'holo' | 'magnified' | 'none'
// scopeRadius: transparent circle radius in px for magnified overlays
const SCOPE_TYPES = {
    none:     { id: 'none',     name: '无瞄准镜',    magnification: 1, fov: 70, overlayType: 'none',      scopeRadius: 0   },
    redDot:   { id: 'redDot',   name: '红点瞄准镜',  magnification: 1, fov: 60, overlayType: 'redDot',    scopeRadius: 0   },
    holo:     { id: 'holo',     name: '全息瞄准镜',  magnification: 1, fov: 60, overlayType: 'holo',      scopeRadius: 0   },
    scope2x: { id: 'scope2x', name: '2倍镜', magnification: 2, fov: 37.5, overlayType: 'magnified', scopeRadius: 550 },
 scope3x: { id: 'scope3x', name: '3倍镜', magnification: 3, fov: 25, overlayType: 'magnified', scopeRadius: 470 },
 scope4x: { id: 'scope4x', name: '4倍镜', magnification: 4, fov: 18.75, overlayType: 'magnified', scopeRadius: 400 },
 scope5x: { id: 'scope5x', name: '5倍镜', magnification: 5, fov: 15, overlayType: 'magnified', scopeRadius: 340 },
 scope8x: { id: 'scope8x', name: '8倍镜', magnification: 8, fov: 9.375, overlayType: 'magnified', scopeRadius: 260 }
};
const SCOPE_ORDER = ['none', 'redDot', 'holo', 'scope2x', 'scope3x', 'scope4x', 'scope5x', 'scope8x'];

// ── Bullet Type Definitions ──
// costType: 'currency' (金币) or 'score' (积分)
const BULLET_TYPES = {
    normal: {
        id: 'normal', name: '普通子弹', cost: 0, costType: 'currency',
        desc: '无特殊效果'
    },
    incendiary: {
        id: 'incendiary', name: '燃烧子弹', cost: 500, costType: 'currency',
        desc: '命中叠加灼烧(最多3层，搭配霰弹枪8层)，每层3点伤害，持续3秒(搭配霰弹枪5秒)',
        maxStacks: 3, burnDuration: 180, burnDps: 3
    },
    poison: {
        id: 'poison', name: '剧毒子弹', cost: 500, costType: 'currency',
        desc: '命中后不造成即时伤害，持续8秒每0.57秒造成3点伤害，敌人移速与精度减少75%',
        poisonDuration: 480, poisonDamage: 3, poisonTickInterval: 34, slowMult: 0.25
    },
    proximity: {
        id: 'proximity', name: '近炸引信子弹', cost: 1000, costType: 'currency',
        desc: '命中敌人产生爆炸，爆炸伤害为子弹伤害的75%',
        explosionRatio: 0.75
    },
    tracking: {
        id: 'tracking', name: '追踪子弹', cost: 700, costType: 'currency',
        desc: '发射后追踪附近敌人，每0.1秒3%概率脱靶（脱靶后永久失去追踪并偏转飞离），子弹伤害降至50%',
        damageMult: 0.50, trackingRange: 30, trackingStrength: 0.24
    },
    light: {
        id: 'light', name: '轻型子弹', cost: 1200, costType: 'currency',
        desc: '子弹伤害降低30%，飞行速度+20%，枪械射速+70%，后坐力减少60%，弹匣容量+50%；AWP专用：全自动、射速420发/分、弹匣25发、身体伤害-40%',
        damageMult: 0.70, speedMult: 1.2, fireRateMult: 0.30, recoilMult: 0.4, magMult: 1.5
    },
    dual: {
        id: 'dual', name: '双头弹', cost: 600, costType: 'currency',
        desc: '一次发射两颗子弹，伤害降低35%，子弹飞出后上下逐渐分离，射速降低45%，飞行速度降低65%',
        damageMult: 0.65, bulletCount: 2
    },
    shock: {
        id: 'shock', name: '电击子弹', cost: 800, costType: 'currency',
        desc: '命中麻痹敌人0.8秒，完全停止移动与开火',
        stunFrames: 48
    },
    freeze: {
        id: 'freeze', name: '冰冻子弹', cost: 700, costType: 'currency',
        desc: '命中减速50%持续3秒，可叠加最多3层（2层65%、3层80%减速）',
        freezeFrames: 180, maxFreezeStacks: 3
    },
    ricochet: {
        id: 'ricochet', name: '跳弹', cost: 600, costType: 'currency',
        desc: '命中墙壁或地面最多反弹5次，每弹一次伤害与弹速各-20%，反弹后轻微追踪附近敌人（无目标则直线飞离）'
    },
    fragment: {
        id: 'fragment', name: '破片子弹', cost: 900, costType: 'currency',
        desc: '命中敌人后分裂3发弹丸向四周飞散，每发弹丸造成35%伤害（霰弹枪不可用）',
        fragmentCount: 3, fragmentDamageRatio: 0.35
    }
};

// #endregion
