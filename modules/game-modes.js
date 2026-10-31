// #region 游戏模式与回合管理
function getCurrentWeapon() {
    if (inventory.currentSlot === 1 && inventory.primary) return WEAPONS[inventory.primary];
    if (inventory.currentSlot === 2) return WEAPONS[inventory.secondary];
    if (inventory.currentSlot === 4 && inventory.currentGrenade) return WEAPONS[inventory.currentGrenade];
    return WEAPONS[inventory.melee || 'knife'];
}

// ── 生化模式运行时状态 ──
let zombieState = {
    pending: false,       // 感染是否尚未爆发（爆发前为购买窗口）
    countdown: 0          // 爆发倒计时（秒）
};

function selectGameMode(mode) {
    if (mode !== 'bomb' && mode !== 'zombie') return;
    gameMode = mode;
    const labelEl = document.getElementById('mode-label');
    if (labelEl) labelEl.textContent = mode === 'zombie' ? '生化' : '爆破';
    const startBtn = document.getElementById('start-btn');
    if (startBtn) startBtn.innerText = mode === 'zombie' ? '开始匹配 (加入人类阵营)' : '开始匹配 (加入 T 阵营)';
    // 模式联动专属地图: 生化用生化实验室, 爆破用 Dust II（仍可手动改选）
    selectMap(mode === 'zombie' ? 'biolab' : 'dust2');
}

// ── 生化模式: 僵尸化视觉 ──
function showZombieFilter(on) {
    const el = document.getElementById('zombie-filter');
    if (el) el.classList.toggle('hidden', !on);
}

function createInfectionEffect(pos) {
    for (let i = 0; i < 12; i++) {
        const px = pos.x + (Math.random() - 0.5) * 1.2;
        const py = pos.y + (Math.random() - 0.5) * 2.0;
        const pz = pos.z + (Math.random() - 0.5) * 1.2;
        const vx = (Math.random() - 0.5) * 8;
        const vy = Math.random() * 10;
        const vz = (Math.random() - 0.5) * 8;
        if (typeof obtainParticle === 'function') {
            obtainParticle(sharedParticleGeo, 0x22cc44, px, py, pz, vx, vy, vz, 1.0 + Math.random() * 0.5, 1.0, 1.0);
        } else {
            const mat = new THREE.MeshBasicMaterial({ color: 0x22cc44 });
            const mesh = new THREE.Mesh(sharedParticleGeo, mat);
            mesh.position.set(px, py, pz);
            scene.add(mesh);
            particles.push({
                mesh: mesh,
                velocity: new THREE.Vector3(vx, vy, vz),
                life: 1.0 + Math.random() * 0.5
            });
        }
    }
}

// ── 生化模式: Bot 僵尸化 ──
function makeZombieBot(bot, isSource) {
    // 若正在操控无人机，强制回收
    if (bot.isControllingDrone) {
        const d = activeDrones.find(dd => dd.ownerId === bot.id);
        if (d) destroyDrone(d, false);
        bot.isControllingDrone = false;
    }

    bot.team = 'ZOMBIE';
    bot.isZombie = true;
    bot.isSource = !!isSource;
    bot.maxHp = isSource ? ZOMBIE.sourceHp : ZOMBIE.hp;
    bot.hp = bot.maxHp;
    bot.weapon = 'zombieClaw';
    bot.burnStacks = 0;
    bot.burnTimer = 0;
    bot.poisonTimer = 0;
    bot.stunTimer = 0;
    bot.freezeTimer = 0;
    bot.freezeStacks = 0;
    bot.isRed = false;
    bot.isGreen = false;
    bot.path = null;
    bot.lastZombieAttack = 0;
    bot.actionProgress = 0;
    bot.enemySpotFrame = null;
    bot.zombieSlowTimer = ZOMBIE.newSlowFrames; // 新变僵尸适应期30秒减速

    // 移除枪械模型并释放资源
    const gun = bot.mesh.getObjectByName('gun');
    if (gun) {
        bot.mesh.remove(gun);
        gun.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });
    }

    // 僵尸绿化视觉（母体更深更大）
    const bodyColor = isSource ? 0x1d4a1d : 0x2d6a2d;
    const emissive = isSource ? 0x005500 : 0x003300;
    bot.mesh.traverse(child => {
        if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (m.color) m.color.setHex(bodyColor);
                if (m.emissive) m.emissive.setHex(emissive);
            });
        }
    });
    bot.mesh.scale.setScalar(isSource ? 1.18 : 1.0);
}

// ── 生化模式: 感染爆发 ──
function outbreakInfection() {
    zombieState.pending = false;
    const cdEl = document.getElementById('zombie-countdown');
    if (cdEl) cdEl.classList.add('hidden');

    const candidates = bots.filter(b => !b.isDead && b.hp > 0);
    for (let i = candidates.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    const count = Math.min(ZOMBIE.sourceCount, candidates.length);
    for (let i = 0; i < count; i++) {
        makeZombieBot(candidates[i], true);
        createInfectionEffect(candidates[i].mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    }

    if (typeof playExplosionSound === 'function') playExplosionSound(camera.position);
    showAnnouncement('感染爆发！' + count + ' 只母体僵尸出现了！', '#00ff88');
    showKillFeed('病毒爆发！躲开僵尸的利爪，存活到最后！');
    showKillFeed('新变僵尸有30秒适应期移速减半，抓紧时间抢占高台！');
    updateHUD();
}

// ── 生化模式: 感染人类 Bot ──
function infectBot(bot, source) {
    if (gameMode !== 'zombie' || !bot || bot.team === 'ZOMBIE' || bot.isDead) return;
    makeZombieBot(bot, false);
    if (typeof playKnifeSound === 'function') playKnifeSound('stab');
    createInfectionEffect(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
    showKillFeed('一名人类被感染，加入了僵尸行列！');
    updateHUD();
}

// ── 生化模式: 感染玩家 ──
// isSource: 变异为母体僵尸（变异血清触发）
function infectPlayer(source, isSource) {
    if (gameMode !== 'zombie' || playerState.team === 'ZOMBIE' || playerState.isZombie) return;

    playerState.team = 'ZOMBIE';
    playerState.isZombie = true;
    playerState.isSource = !!isSource;
    playerState.maxHp = isSource ? ZOMBIE.sourceHp : ZOMBIE.hp;
    playerState.hp = playerState.maxHp;
    playerState.burnStacks = 0;
    playerState.burnTimer = 0;
    playerState.armorPlates = 0;
    playerState.zombieSlowTimer = ZOMBIE.newSlowFrames; // 适应期30秒移速减半

    // 没收枪械投掷物，只留僵尸利爪（保存原配置供下回合恢复）
    playerState.prevPrimary = inventory.primary;
    playerState.prevSecondary = inventory.secondary;
    playerState.prevMelee = inventory.melee;
    playerState.prevMelees = [...inventory.melees];
    inventory.primary = null;
    inventory.secondary = null;
    inventory.currentGrenade = null;
    Object.keys(inventory.grenades).forEach(k => { inventory.grenades[k] = 0; });
    inventory.melee = 'zombieClaw';
    inventory.melees = ['zombieClaw'];

    isReloading = false;
    // 关闭可能开着的购买菜单与迫击炮地图
    const _buyMenu = document.getElementById('buy-menu');
    if (_buyMenu && !_buyMenu.classList.contains('hidden')) {
        _buyMenu.classList.add('hidden');
        _buyMenu.classList.remove('active');
    }
    mortarMapOpen = false;
    mortarCameraActive = false;
    const _mortarOverlay = document.getElementById('mortar-map-overlay');
    if (_mortarOverlay) _mortarOverlay.classList.add('hidden');
    if (playerState.isAds) {
        playerState.isAds = false;
        camera.fov = 75;
        camera.updateProjectionMatrix();
        const scopeOverlay = document.getElementById('scope-overlay');
        const magOverlay = document.getElementById('mag-scope-overlay');
        const redDot = document.getElementById('red-dot-sight');
        const holoSight = document.getElementById('holo-sight');
        if (scopeOverlay) scopeOverlay.classList.add('hidden');
        if (magOverlay) magOverlay.classList.add('hidden');
        if (redDot) redDot.classList.add('hidden');
        if (holoSight) holoSight.classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
    }

    document.getElementById('slot-1').classList.add('hidden');
    document.getElementById('slot-2').classList.add('hidden');
    document.getElementById('slot-4').classList.add('hidden');
    switchWeapon(3);

    showZombieFilter(true);
    if (typeof playKnifeSound === 'function') playKnifeSound('stab');
    createInfectionEffect(getPlayerPosition().clone());
    if (isSource) {
        showAnnouncement('你变异为母体僵尸！(血量' + ZOMBIE.sourceHp + ') 前30秒移速减半', '#00ff88');
    } else {
        showAnnouncement('你被感染了！前30秒移速减半，用利爪 [左键] 感染人类！', '#00ff88');
    }
    updateHUD();
}

// ── 生化模式: 僵尸 Bot 重生 ──
function respawnZombieBot(bot) {
    bot.isDead = false;
    bot.hp = bot.maxHp || ZOMBIE.hp;
    bot.burnStacks = 0;
    bot.burnTimer = 0;
    bot.poisonTimer = 0;
    bot.stunTimer = 0;
    bot.freezeTimer = 0;
    bot.freezeStacks = 0;
    bot.isRed = false;
    bot.isGreen = false;
    bot.path = null;
    bot.lastZombieAttack = 0;
    bot.zombieSlowTimer = 0; // 重生为满状态, 不再适应期减速
    // 重生时恢复僵尸绿色发光（燃烧/中毒会覆盖 emissive）
    bot.mesh.traverse(child => {
        if (child.isMesh) {
            const mats = Array.isArray(child.material) ? child.material : [child.material];
            mats.forEach(m => {
                if (m.emissive) m.emissive.setHex(bot.isSource ? 0x005500 : 0x003300);
            });
        }
    });
    const pos = getValidSpawnPoint([], 0);
    bot.mesh.position.set(pos.x, 0, pos.z);
    bot.mesh.visible = true;
    scene.add(bot.mesh);
    showKillFeed('一只僵尸重新站了起来...');
}

// ── 生化模式: 僵尸玩家重生 ──
function respawnPlayerZombie() {
    playerState.isSpectating = false;
    playerState.hp = playerState.maxHp || ZOMBIE.hp;
    playerState.zombieRespawnTimer = 0;
    playerState.zombieSlowTimer = 0; // 重生为满状态
    playerState.burnStacks = 0;
    playerState.burnTimer = 0;

    const sp = document.getElementById('spectator-prompt');
    if (sp) {
        sp.classList.add('hidden');
        const h2 = sp.querySelector('h2');
        if (h2) h2.innerText = '你已阵亡 (Spectating)';
        const p = sp.querySelector('p');
        if (p) p.innerHTML = '点击鼠标左键切换观战视角<br>(当前观战: <span id="spectator-target" style="color:#e67e22;">无</span>)';
    }

    const pos = getValidSpawnPoint([], 0);
    camera.position.set(pos.x, 2, pos.z);
    camera.rotation.set(0, Math.random() * Math.PI * 2, 0);
    showAnnouncement('僵尸重生！', '#00ff88');
    updateHUD();
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
    initSoundSystem();
    init3DGame();
}

function selectMap(mapId) {
    if (!MAP_LIST[mapId]) return;
    currentMap = mapId;
    const labelEl = document.getElementById('map-label');
    if (labelEl) labelEl.textContent = MAP_LIST[mapId].name;
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
    playerScore = 99999;
    initSoundSystem();
    document.getElementById('hud-credits').innerText = playerCurrency;
    if (document.getElementById('hud-score'))
        document.getElementById('hud-score').innerText = playerScore;
    
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
        group.poisonTimer = 0;
        group.poisonDelay = 0;
        group.poisonDamageApplied = false;
        group.isGreen = false;
        
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




function applyArmorReduction(damage) {
    let reduction = Math.min(0.85, (playerState.armorPlates || 0) * 0.15);
    return damage * (1 - reduction);
}

function hasLightBullet() {
    return playerState.bulletType === 'light' || (playerState.bulletStacking && playerState.bulletTypes.includes('light'));
}

function getEffectiveMag(weapon) {
    let mag = (weapon && typeof weapon.mag === 'number') ? weapon.mag : 30;
    if (hasLightBullet()) {
        if (weapon && weapon.id === 'sniper') return 25; // AWP+轻型子弹: 弹匣固定25发
        mag = Math.round(mag * 1.5);
    }
    return mag;
}

function adjustClipForLightBullet() {
    const w = getCurrentWeapon();
    if (!w || typeof w.mag !== 'number') return;
    if (['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone'].includes(w.id)) return;
    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
    if (!currentAmmo) return;
    let baseMag = w.mag;
    let effectiveMag = getEffectiveMag(w);
    if (hasLightBullet()) {
        if (currentAmmo.clip >= baseMag) {
            currentAmmo.clip = Math.min(effectiveMag, currentAmmo.clip + (effectiveMag - baseMag));
        }
    } else {
        if (currentAmmo.clip > baseMag) {
            currentAmmo.clip = baseMag;
        }
    }
    updateHUD();
}



function switchWeapon(slot) {
    if (playerState.isControllingDrone && slot !== 4) return;
    if (slot === 1 && !inventory.primary) return;
    if (slot === 2 && !inventory.secondary) return;
    
    if (slot === 3) {
        if (!inventory.melees) inventory.melees = ['knife', 'kukri', 'switchblade'];
        if (inventory.currentSlot === 3) {
            let idx = inventory.melees.indexOf(inventory.melee);
            inventory.melee = inventory.melees[(idx + 1) % inventory.melees.length];
        }
    }
    
    if (slot === 4) {
        const types = ['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone'];
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
    if (typeof reloadTimer !== 'undefined' && reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
    playerState.burstQueue = 0; // 切枪中断三连发

    if (playerState.isAds && camera) {
        camera.fov = 75;
        camera.updateProjectionMatrix();
        playerState.isAds = false;
        const scopeOverlay = document.getElementById('scope-overlay');
        const magOverlay = document.getElementById('mag-scope-overlay');
        const redDot = document.getElementById('red-dot-sight');
        const holoSight = document.getElementById('holo-sight');
        if (scopeOverlay) scopeOverlay.classList.add('hidden');
        if (magOverlay) magOverlay.classList.add('hidden');
        if (redDot) redDot.classList.add('hidden');
        if (holoSight) holoSight.classList.add('hidden');
        document.getElementById('crosshair').classList.remove('hidden');
    }
    
    inventory.currentSlot = slot;
    playerState.gatlingFireStartFrame = 0;
    playerState.gatlingBarrelSpin = 0;
    
    document.querySelectorAll('.inv-slot').forEach(el => el.classList.remove('active'));
    document.getElementById(`slot-${slot}`).classList.add('active');
    
    updateViewModel();
    updateHUD();
}

function handleReload() {
    if (isReloading || playerState.isSpectating) return;
    const weapon = getCurrentWeapon();
    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade' || weapon.id === 'zombieClaw' || weapon.type === 'grenade') return;
    
    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
    if (currentAmmo.clip >= getEffectiveMag(weapon) || currentAmmo.reserve <= 0) return;
    
    playerState.isInspecting = false;
    isReloading = true;
    playerState.burstQueue = 0; // 换弹中断三连发
    showKillFeed(`正在换弹...`); // Reusing kill feed for HUD message

    // CS换弹音效序列: 退弹匣 -> 插弹匣 -> 拉栓
    playReloadSequence(weapon.id, weapon.reloadTime);
    
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
    
    if (typeof reloadTimer !== 'undefined' && reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
    reloadTimer = setTimeout(() => {
        if (typeof reloadTimer !== 'undefined') reloadTimer = null;
        if (!isReloading) return; // Cancelled by weapon switch
        isReloading = false;
        if (playerState.hp <= 0) return;
        const needed = getEffectiveMag(weapon) - currentAmmo.clip;
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
    isReloading = false;
    if (typeof reloadTimer !== 'undefined' && reloadTimer) {
        clearTimeout(reloadTimer);
        reloadTimer = null;
    }
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
    const _pickupPrompt = document.getElementById('pickup-prompt');
    if (_pickupPrompt) _pickupPrompt.classList.add('hidden');
    
    let endMsg = msg;
    if (gameMode === 'zombie') {
        if (matchState.tWins >= matchState.maxWins) endMsg = "比赛结束！僵尸阵营获胜";
        if (matchState.ctWins >= matchState.maxWins) endMsg = "比赛结束！人类阵营获胜";
    } else {
        if (matchState.tWins >= matchState.maxWins) endMsg = "比赛结束！恐怖分子获胜";
        if (matchState.ctWins >= matchState.maxWins) endMsg = "比赛结束！反恐精英获胜";
    }
    
    let isPlayerWin;
    if (gameMode === 'zombie') {
        isPlayerWin = tWin ? playerState.team === 'ZOMBIE' : playerState.team !== 'ZOMBIE';
    } else {
        isPlayerWin = (tWin && playerState.team === 'T') || (!tWin && playerState.team === 'CT');
    }
    endMsg += isPlayerWin ? " (我方胜利)" : " (敌方胜利)";
    
    document.getElementById('result-desc').innerText = endMsg;
    document.getElementById('result-desc').style.color = tWin ? '#e67e22' : '#3498db';

    // 回合 MVP + 当前比分 + 连败补偿 展示
    const mvpEl = document.getElementById('result-mvp');
    if (mvpEl) {
        const playerKills = matchState.roundKills.player;
        const bestKiller = matchState.roundBestKiller;
        let mvpText;
        if (playerKills > 0 && playerKills >= (bestKiller ? bestKiller.kills : 0)) {
            mvpText = `本回合 MVP: 你 (${playerKills} 杀)`;
        } else if (bestKiller && bestKiller.kills > 0) {
            mvpText = `本回合 MVP: [${bestKiller.team}] BOT (${bestKiller.kills} 杀)`;
        } else {
            mvpText = '本回合无击杀';
        }
        const scoreText = gameMode === 'zombie'
            ? `当前比分 — 僵尸 ${matchState.tWins} : ${matchState.ctWins} 人类`
            : `当前比分 — T ${matchState.tWins} : ${matchState.ctWins} CT (先到 ${matchState.maxWins} 胜)`;
        mvpEl.innerHTML = `${mvpText}<br><span style="color:#fff; font-weight:400; font-size:0.95rem;">${scoreText}</span>`;
        if (!isPlayerWin) {
            const playerOnTSide = (gameMode === 'zombie') ? playerState.team === 'ZOMBIE' : playerState.team === 'T';
            const streak = playerOnTSide ? matchState.lossStreakT : matchState.lossStreakCT;
            if (streak >= 2) {
                const bonus = Math.min(3400, 1400 + (streak - 1) * 500);
                mvpEl.innerHTML += `<br><span style="color:#aaa; font-weight:400; font-size:0.9rem;">连败补偿: $${bonus} (已连败 ${streak} 场)</span>`;
            }
        }
    }
    
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
    
    if (gameMode === 'zombie') {
        // 生化模式: 僵尸方(tWin)与人类方经济
        const playerOnZombieSide = playerState.team === 'ZOMBIE';
        if (playerOnZombieSide === tWin) {
            playerCurrency += tMoney;
            if (tWin) playerScore += 50;
        } else {
            playerCurrency += ctMoney;
            if (!tWin) playerScore += 50;
        }
    } else if (playerState.team === 'T') {
        playerCurrency += tMoney;
        if (tWin) playerScore += 50;
    } else {
        playerCurrency += ctMoney;
        if (!tWin) playerScore += 50;
    }
    const _endHudScore = document.getElementById('hud-score');
    if (_endHudScore) _endHudScore.innerText = playerScore;
    
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
    if (gameMode !== 'zombie') {
        playerState.team = playerState.team === 'T' ? 'CT' : 'T'; // Swap team and spawn location
    }
    
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
        const _resetScore = document.getElementById('hud-score');
        if (_resetScore) _resetScore.innerText = playerScore;
    }
    document.getElementById('result-screen').classList.remove('active');
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
