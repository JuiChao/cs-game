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

    // 生化模式: 人类存活数 vs 僵尸数（僵尸被击杀仍会重生，只统计在场数量）
    if (gameMode === 'zombie') {
        const humansAlive = bots.filter(b => b.team !== 'ZOMBIE').length +
            ((playerState.team !== 'ZOMBIE' && playerState.hp > 0 && !playerState.isSpectating) ? 1 : 0);
        const zombieCount = bots.filter(b => b.team === 'ZOMBIE').length + (playerState.team === 'ZOMBIE' ? 1 : 0);

        document.getElementById('score-ct').innerText = humansAlive;
        document.getElementById('score-t').innerText = zombieCount;
        document.getElementById('label-t').innerText = '僵尸';
        document.getElementById('label-ct').innerText = '人类';

        if (humansAlive === 0) endRound("所有人类都已被感染！僵尸获胜", true, 'elimination');
        return;
    }

    const ctAlive = bots.filter(b => b.team === 'CT').length + (playerState.hp > 0 && playerState.team === 'CT' ? 1 : 0);
    const tAlive = bots.filter(b => b.team === 'T').length + (playerState.hp > 0 && playerState.team === 'T' ? 1 : 0);
    
    document.getElementById('score-ct').innerText = ctAlive;
    document.getElementById('score-t').innerText = tAlive;
    
    document.getElementById('label-t').innerText = playerState.team === 'T' ? '我方 T' : '敌方 T';
    document.getElementById('label-ct').innerText = playerState.team === 'CT' ? '我方 CT' : '敌方 CT';

    if (ctAlive === 0) endRound("所有反恐精英已被消灭！恐怖分子获胜", true, 'elimination');
    if (!bombState.planted && tAlive === 0) endRound("所有恐怖分子已被消灭！反恐精英获胜", false, 'elimination');
}

function updateArmorHUD() {
    let el = document.getElementById('hud-armor');
    if (!el) return;
    let plates = playerState.armorPlates || 0;
    let reduction = Math.min(85, plates * 15);
    el.innerText = '护甲 ' + plates + '/6 (' + reduction + '%)';
}

function updateHUD() {
    if (document.getElementById('hud-score')) {
        document.getElementById('hud-score').innerText = playerScore;
    }
    if (document.getElementById('hud-credits') && typeof playerCurrency !== 'undefined') {
        document.getElementById('hud-credits').innerText = playerCurrency;
    }
    const hpVal = document.getElementById('hp-val');
    if (hpVal) {
        hpVal.innerText = Math.ceil(playerState.hp);
        const hudLeft = document.querySelector('.hud-left');
        if (hudLeft) {
            hudLeft.classList.toggle('critical-vitals', playerState.hp <= 25);
        }
    }
    const hpMax = playerState.maxHp || 100;
    const hpFill = document.getElementById('hp-fill');
    if (hpFill) hpFill.style.width = `${Math.max(0, Math.min(100, (playerState.hp / hpMax) * 100))}%`;
    
    const weaponInv = document.querySelector('.weapon-inventory');
    const hudRight = document.querySelector('.hud-right');
    if (playerState.isControllingDrone) {
        if (weaponInv) weaponInv.style.display = 'none';
        if (hudRight) hudRight.style.display = 'flex';
    } else {
        if (weaponInv) weaponInv.style.display = 'flex';
        if (hudRight) hudRight.style.display = 'flex';
    }
    
    const w = typeof getCurrentWeapon === 'function' ? getCurrentWeapon() : null;
    const weaponNameEl = document.getElementById('weapon-name');
    if (w && weaponNameEl) weaponNameEl.innerText = w.name;

    const btDisplay = document.getElementById('bullet-type-display');
    if (btDisplay && typeof BULLET_TYPES !== 'undefined') {
        const bt = BULLET_TYPES[playerState.bulletType || 'normal'];
        btDisplay.innerText = bt ? bt.name : '普通子弹';
        btDisplay.style.color = (playerState.bulletType === 'incendiary') ? '#ff6600' :
                                (playerState.bulletType === 'poison') ? '#44ff00' :
                                (playerState.bulletType === 'proximity') ? '#ffaa00' : '#aaa';
    }

    const fmDisplay = document.getElementById('fire-mode-badge');
    if (fmDisplay) {
        const nonFirearms = ['knife', 'kukri', 'switchblade', 'zombieClaw', 'hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone', 'mortar', 'c4', 'flamethrower', 'cryo'];
        const isGun = w && inventory && (inventory.currentSlot === 1 || inventory.currentSlot === 2) &&
                      !nonFirearms.includes(w.id);
        if (!isGun) {
            fmDisplay.style.display = 'none';
        } else {
            fmDisplay.style.display = 'inline-flex';
            const mode = (typeof getWeaponFireMode === 'function') ? getWeaponFireMode(w) : 'multi';
            const hasBT = Boolean(playerState.hasBinaryTrigger || (typeof binaryTriggerPurchased !== 'undefined' && binaryTriggerPurchased));
            if (mode === 'single') {
                fmDisplay.innerText = '单发';
                fmDisplay.title = hasBT ? '当前单发模式 (后坐力 80%, 双发扳机射速+30%)，点击或按 X 切换' : '当前单发模式 (后坐力 80%)，点击或按 X 切换';
                fmDisplay.classList.add('single-mode');
                fmDisplay.classList.remove('multi-mode');
            } else {
                fmDisplay.innerText = '多发';
                fmDisplay.title = '当前多发模式，点击或按 X 切换';
                fmDisplay.classList.add('multi-mode');
                fmDisplay.classList.remove('single-mode');
            }
        }
    }
    
    const ammoClip = document.getElementById('ammo-clip');
    const ammoReserve = document.getElementById('ammo-reserve');
    if (w && ammoClip && ammoReserve) {
        if (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'zombieClaw') {
            ammoClip.innerText = '-';
            ammoReserve.innerText = '-';
        } else if (['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone', 'cryo'].includes(w.id)) {
            ammoClip.innerText = (inventory && inventory.grenades) ? (inventory.grenades[w.id] || 0) : 0;
            ammoReserve.innerText = '-';
        } else {
            let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
            if (currentAmmo) {
                ammoClip.innerText = currentAmmo.clip;
                ammoReserve.innerText = currentAmmo.reserve;
            }
        }
    }
    
    const roundTimerEl = document.getElementById('round-timer');
    if (roundTimerEl) {
        if (bombState.planted) {
            roundTimerEl.innerText = `00:${bombState.timer.toString().padStart(2, '0')}`;
            roundTimerEl.style.color = '#ff3c3c';
        } else {
            const mins = Math.floor(roundTime / 60);
            const secs = roundTime % 60;
            roundTimerEl.innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            roundTimerEl.style.color = '#fff';
        }
    }
    
    const buyPrompt = document.getElementById('buy-prompt');
    if (buyPrompt) {
        const zombieBuyOk = gameMode !== 'zombie' || (zombieState.pending && !playerState.isZombie);
        const inSpawn = typeof isPlayerInSpawn === 'function' ? isPlayerInSpawn() : true;
        if (roundTime > 225 && zombieBuyOk && inSpawn && !playerState.isSpectating && roundActive) {
            buyPrompt.classList.remove('hidden');
        } else {
            buyPrompt.classList.add('hidden');
        }
    }

    checkWinCondition(); // Updates top scores
    updateArmorHUD();
    if (typeof updateFreezeHUD === 'function') updateFreezeHUD();
    if (typeof updateEnemyFreezeHUD === 'function') updateEnemyFreezeHUD();
}

function updateFreezeHUD() {
    const freezeStatusEl = document.getElementById('freeze-status');
    const freezeProgEl = document.getElementById('freeze-progress');
    const freezeTextEl = document.getElementById('freeze-text');
    if (!freezeStatusEl || !freezeProgEl || !freezeTextEl || typeof playerState === 'undefined') return;

    if (playerState.hp <= 0 || playerState.isSpectating) {
        freezeStatusEl.classList.add('hidden');
        freezeProgEl.style.width = '0%';
    } else if (playerState.isFrozen) {
        freezeStatusEl.classList.remove('hidden');
        freezeProgEl.style.width = '100%';
        freezeTextEl.innerText = `已冰冻! (${(playerState.freezeTimer || 0).toFixed(1)}s)`;
    } else if (playerState.freezeImmuneTimer > 0) {
        freezeStatusEl.classList.remove('hidden');
        const immunePct = Math.max(0, Math.min(100, Math.round((playerState.freezeImmuneTimer / 5.0) * 100)));
        freezeProgEl.style.width = immunePct + '%';
        freezeTextEl.innerText = `解冻冷却: ${immunePct}% (${playerState.freezeImmuneTimer.toFixed(1)}s)`;
    } else if (playerState.cryoFreezeAccum > 0 || playerState.cryoHits > 0) {
        freezeStatusEl.classList.remove('hidden');
        const accumPct = Math.min(100, Math.round(((playerState.cryoFreezeAccum || 0) / 2.0) * 100));
        freezeProgEl.style.width = accumPct + '%';
        freezeTextEl.innerText = `冰冻累积: ${accumPct}%`;
    } else {
        freezeStatusEl.classList.add('hidden');
        freezeProgEl.style.width = '0%';
    }
}

function updateEnemyFreezeHUD() {
    const eFreezeStatusEl = document.getElementById('enemy-freeze-status');
    const eFreezeProgEl = document.getElementById('enemy-freeze-progress');
    const eFreezeTextEl = document.getElementById('enemy-freeze-text');
    if (!eFreezeStatusEl || !eFreezeProgEl || !eFreezeTextEl) return;

    if (typeof playerState !== 'undefined' && (playerState.hp <= 0 || playerState.isSpectating)) {
        eFreezeStatusEl.classList.add('hidden');
        eFreezeProgEl.style.width = '0%';
        return;
    }

    let maxEnemyPct = 0;
    let anyEnemyFrozen = false;
    let enemyFrozenTimer = 0;
    let activeEnemyFound = false;

    if (typeof bots !== 'undefined' && Array.isArray(bots)) {
        for (let k = 0; k < bots.length; k++) {
            const eb = bots[k];
            if (!eb || eb.isDead || (typeof playerState !== 'undefined' && eb.team === playerState.team)) continue;
            if (eb.frozenByPlayer && eb.isFrozen) {
                anyEnemyFrozen = true;
                const ft = eb.cryoFreezeTimer || eb.freezeTimer || 0;
                if (ft > enemyFrozenTimer) enemyFrozenTimer = ft;
                activeEnemyFound = true;
                continue;
            }
            if (eb.cryoAccumFromPlayer && eb.cryoFreezeAccum > 0) {
                const pct = Math.min(100, Math.round((eb.cryoFreezeAccum / 2.0) * 100));
                if (pct > maxEnemyPct) {
                    maxEnemyPct = pct;
                    activeEnemyFound = true;
                }
            }
        }
    }

    if (anyEnemyFrozen) {
        eFreezeStatusEl.classList.remove('hidden');
        eFreezeProgEl.style.width = '100%';
        eFreezeTextEl.innerText = `敌人已冻结! (${enemyFrozenTimer.toFixed(1)}s)`;
    } else if (activeEnemyFound && maxEnemyPct > 0) {
        eFreezeStatusEl.classList.remove('hidden');
        eFreezeProgEl.style.width = maxEnemyPct + '%';
        eFreezeTextEl.innerText = `敌人冰冻累积: ${maxEnemyPct}%`;
    } else {
        eFreezeStatusEl.classList.add('hidden');
        eFreezeProgEl.style.width = '0%';
    }
}

if (typeof window !== 'undefined') {
    window.updateFreezeHUD = updateFreezeHUD;
    window.updateEnemyFreezeHUD = updateEnemyFreezeHUD;
}

// 玩家受击屏幕边缘红色晕影提示 (Damage Vignette)
function triggerDamageVignette(intensity = 1.0) {
    if (typeof triggerHitAberration === 'function') {
        triggerHitAberration(intensity * 0.025);
    }
    const el = document.getElementById('damage-vignette');
    if (!el) return;
    el.style.opacity = Math.min(1.0, 0.4 + intensity * 0.4);
    clearTimeout(el._vignetteTimer);
    el._vignetteTimer = setTimeout(() => {
        el.style.opacity = '0';
    }, 220);
}

// 准星命中视觉反馈
function showHitMarker(isHeadshot = false) {
    const crosshair = document.getElementById('crosshair');
    if (!crosshair) return;
    crosshair.classList.remove('hit', 'hit-headshot');
    crosshair.classList.add(isHeadshot ? 'hit-headshot' : 'hit');
    clearTimeout(crosshair._hitTimer);
    crosshair._hitTimer = setTimeout(() => {
        crosshair.classList.remove('hit');
        crosshair.classList.remove('hit-headshot');
    }, 90);
}

// #endregion
