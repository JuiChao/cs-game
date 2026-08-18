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
    playerScore = 99999;
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
    const _buyScore = document.getElementById('buy-score');
    if (_buyScore) _buyScore.innerText = playerScore;
    if (typeof updateBulletTypeUI === 'function') updateBulletTypeUI();
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
        if (type === 'rifle' || type === 'sniper' || type === 'marksman' || type === 'smg' || type === 'shotgun' || type === 'm249' || type === 'gatling' || type === 'flamethrower' || type === 'ash12') {
            playerCurrency -= cost;
            inventory.primary = type;
            ammoState.primary.clip = getEffectiveMag(WEAPONS[type]);
            ammoState.primary.reserve = WEAPONS[type].reserve;
            switchWeapon(1);
        } else if (type === 'pistol' || type === 'deagle') {
            playerCurrency -= cost;
            inventory.secondary = type;
            ammoState.secondary.clip = getEffectiveMag(WEAPONS[type]);
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

function buyBulletStacking() {
    if (playerState.isControllingDrone) return;
    if (playerState.bulletStacking) {
        showKillFeed('子弹叠加已激活');
        return;
    }
    if (playerCurrency < 500) {
        showKillFeed('金币不足，无法购买子弹叠加功能');
        return;
    }
    playerCurrency -= 500;
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.getElementById('hud-credits').innerText = playerCurrency;
    playerState.bulletStacking = true;
    playerState.bulletTypes = [playerState.bulletType || 'normal'];
    showKillFeed('子弹叠加已激活！可同时选择多种子弹类型');
    updateBulletTypeUI();
}

function buyDropCompensation() {
    if (dropCompensationPurchased) {
        showKillFeed('弹道下坠补偿已购买');
        return;
    }
    if (playerCurrency < 300) {
        showKillFeed('金币不足，无法购买弹道下坠补偿');
        return;
    }
    playerCurrency -= 300;
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.getElementById('hud-credits').innerText = playerCurrency;
    dropCompensationPurchased = true;
    showKillFeed('弹道下坠补偿已购买！按 V 键开关');
    const btn = document.getElementById('btn-drop-comp');
    if (btn) {
        btn.innerHTML = '弹道下坠补偿 <span class="price">已购买</span> <br><small>按 V 键开关：准星自动下移补偿子弹下坠</small>';
        btn.disabled = true;
        btn.style.opacity = '0.5';
    }
}

function toggleDropCompensation() {
    if (!dropCompensationPurchased) return;
    // Every press recalculates: always re-measure distance and re-apply offset
    const w = getCurrentWeapon();
    if (!w || !w.dropRate) {
        showKillFeed('当前武器不支持弹道下坠补偿');
        return;
    }
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    raycaster.set(camera.position, camDir);
    raycaster.far = 2000;
    const _targets = bots.map(bot => bot.mesh).concat(collidableMeshList);
    const _floorMesh = scene.getObjectByName('floor');
    if (_floorMesh) _targets.push(_floorMesh);
    const _hits = raycaster.intersectObjects(_targets, true);
    let targetDist = 500;
    if (_hits.length > 0) targetDist = _hits[0].distance;
    if (targetDist < 5) targetDist = 5;

    // Simulate bullet trajectory to find total vertical drop
    let dropAccum = 0;
    let simDir = new THREE.Vector3(0, 0, 1);
    let posY = 0;
    let remaining = targetDist;
    const step = 10;
    while (remaining > 0) {
        const moveDist = Math.min(step, remaining);
        dropAccum += w.dropRate * moveDist;
        simDir.y -= dropAccum;
        simDir.normalize();
        posY += simDir.y * moveDist;
        remaining -= moveDist;
    }

    // Convert world drop to screen pixel offset
    const dropAngle = Math.atan2(-posY, targetDist);
    const vFovRad = camera.fov * Math.PI / 180;
    const pixelOffset = (window.innerHeight / 2) * Math.tan(dropAngle) / Math.tan(vFovRad / 2);
    if (pixelOffset > 0 && pixelOffset < 400) {
        dropCompensationOffset = pixelOffset;
        dropCompensationActive = true;
        showKillFeed('弹道补偿已更新（距离' + Math.round(targetDist) + '，下移' + Math.round(pixelOffset) + 'px）');
    } else {
        dropCompensationOffset = 0;
        dropCompensationActive = false;
        const dot = document.getElementById('ch-dot');
        if (dot) dot.style.transform = 'translate(-50%, -50%)';
        showKillFeed('距离太近，无需补偿');
    }
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
    if (hasLightBullet()) mag = Math.round(mag * 1.5);
    return mag;
}

function adjustClipForLightBullet() {
    const w = getCurrentWeapon();
    if (!w || typeof w.mag !== 'number') return;
    if (['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'].includes(w.id)) return;
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

function buyAmmo() {
    if (playerState.isControllingDrone) return;
    const w = getCurrentWeapon();
    if (!w || w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade') {
        showKillFeed('近战武器无需购买子弹');
        return;
    }
    if (['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'].includes(w.id)) {
        showKillFeed('投掷物请在装备栏直接购买');
        return;
    }
    let magSize = (typeof w.mag === 'number') ? w.mag : 30;
    let buyAmount = magSize * 2;
    let cost = Math.round(magSize * 5 / 10) * 10;

    if (playerCurrency < cost) {
        showKillFeed('金币不足，无法购买子弹 (需要' + cost + '$)');
        return;
    }
    playerCurrency -= cost;
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.getElementById('hud-credits').innerText = playerCurrency;

    if (inventory.currentSlot === 1) {
        ammoState.primary.reserve += buyAmount;
    } else if (inventory.currentSlot === 2) {
        ammoState.secondary.reserve += buyAmount;
    }

    showKillFeed('购买子弹: +' + buyAmount + '发 (花费' + cost + '$)');
    updateHUD();
}

function buyArmorPlate() {
    if (playerState.isControllingDrone) return;
    if ((playerState.armorPlates || 0) >= 6) {
        showKillFeed('护甲板已达上限（6块，减伤85%）');
        return;
    }
    if (playerCurrency < 400) {
        showKillFeed('金币不足，无法购买护甲板');
        return;
    }
    playerCurrency -= 400;
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.getElementById('hud-credits').innerText = playerCurrency;
    playerState.armorPlates = (playerState.armorPlates || 0) + 1;
    let reduction = Math.min(85, playerState.armorPlates * 15);
    showKillFeed('护甲板已安装: ' + playerState.armorPlates + '块 (减伤' + reduction + '%)');
    updateArmorHUD();
}

function updateArmorHUD() {
    let el = document.getElementById('hud-armor');
    if (!el) return;
    let plates = playerState.armorPlates || 0;
    let reduction = Math.min(85, plates * 15);
    el.innerText = '护甲 ' + plates + '/6 (' + reduction + '%)';
}

function buyBulletType(typeId) {
    if (playerState.isControllingDrone) return;
    const bt = BULLET_TYPES[typeId];
    if (!bt) return;

    const w = getCurrentWeapon();
    if (w.id === 'flamethrower' && (typeId === 'tracking' || typeId === 'proximity')) {
        showKillFeed('喷火器无法使用追踪子弹或近炸引信子弹');
        return;
    }
    if (w.id === 'shotgun' && typeId === 'dual') {
        showKillFeed('霰弹枪无法使用双头弹');
        return;
    }
    let scaledCost = bt.cost;

    if (playerState.bulletStacking) {
        let idx = playerState.bulletTypes.indexOf(typeId);
        if (idx >= 0) {
            if (playerState.bulletTypes.length <= 1) {
                showKillFeed('至少需要保留一种子弹类型');
                return;
            }
            playerState.bulletTypes.splice(idx, 1);
            showKillFeed('已移除: ' + bt.name);
        } else {
            if (bt.costType === 'currency') {
                if (playerCurrency < scaledCost) {
                    showKillFeed('金币不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                    return;
                }
                playerCurrency -= scaledCost;
                document.getElementById('buy-credits').innerText = playerCurrency;
                document.getElementById('hud-credits').innerText = playerCurrency;
            } else if (bt.costType === 'score') {
                if (playerScore < scaledCost) {
                    showKillFeed('积分不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                    return;
                }
                playerScore -= scaledCost;
                if (document.getElementById('hud-score'))
                    document.getElementById('hud-score').innerText = playerScore;
                const _bs = document.getElementById('buy-score');
                if (_bs) _bs.innerText = playerScore;
            }
            playerState.bulletTypes.push(typeId);
            showKillFeed('已添加: ' + bt.name);
        }
        playerState.bulletType = playerState.bulletTypes[0];
    } else {
        if (bt.costType === 'currency') {
            if (playerCurrency < scaledCost) {
                showKillFeed('金币不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                return;
            }
            playerCurrency -= scaledCost;
            document.getElementById('buy-credits').innerText = playerCurrency;
            document.getElementById('hud-credits').innerText = playerCurrency;
        } else if (bt.costType === 'score') {
            if (playerScore < scaledCost) {
                showKillFeed('积分不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                return;
            }
            playerScore -= scaledCost;
            if (document.getElementById('hud-score'))
                document.getElementById('hud-score').innerText = playerScore;
            const _bs2 = document.getElementById('buy-score');
            if (_bs2) _bs2.innerText = playerScore;
        }
        playerState.bulletType = typeId;
        showKillFeed('子弹类型已切换: ' + bt.name);
    }
    adjustClipForLightBullet();
    updateBulletTypeUI();
}

function updateBulletTypeUI() {
    document.querySelectorAll('#bullet-type-category button').forEach(btn => {
        btn.style.outline = '';
    });
    if (playerState.bulletStacking) {
        playerState.bulletTypes.forEach(t => {
            const btn = document.getElementById('btn-bullet-' + t);
            if (btn) btn.style.outline = '2px solid #00ff00';
        });
        const stackBtn = document.getElementById('btn-bullet-stacking');
        if (stackBtn) stackBtn.style.outline = '2px solid #ff00ff';
    } else {
        const activeBtn = document.getElementById('btn-bullet-' + playerState.bulletType);
        if (activeBtn) activeBtn.style.outline = '2px solid #00ff00';
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
    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade' || weapon.type === 'grenade') return;
    
    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
    if (currentAmmo.clip >= getEffectiveMag(weapon) || currentAmmo.reserve <= 0) return;
    
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
        const _resetScore = document.getElementById('hud-score');
        if (_resetScore) _resetScore.innerText = playerScore;
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
