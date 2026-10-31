// #region 商店与经济系统 (Shop & Economy System)

function openBuyMenu() {
    if (!roundActive) return;
    if (typeof mortarMapOpen !== 'undefined' && mortarMapOpen) return;
    if (!playerState.isControllingDrone) {
        if (typeof isShootingRange !== 'undefined' && isShootingRange) {
            // 靶场模式: 允许随时任意购买测试武器
        } else if (gameMode === 'zombie') {
            // 生化模式: 人类全程可在出生区补给（弹药/投掷物/血清），僵尸不可购买
            if (playerState.isZombie || playerState.team === 'ZOMBIE') return;
            if (typeof isPlayerInSpawn === 'function' && !isPlayerInSpawn()) return;
        } else if (roundTime <= 225 || (typeof isPlayerInSpawn === 'function' && !isPlayerInSpawn())) {
            return;
        }
    }

    const menu = document.getElementById('buy-menu');
    if (!menu) return;
    menu.classList.remove('hidden');
    menu.classList.add('active');

    // 互斥关闭瞄准镜面板
    const scopePanel = document.getElementById('scope-panel');
    if (scopePanel) {
        scopePanel.classList.add('hidden');
        scopePanel.classList.remove('active');
    }

    // 生化模式分类显隐 + 血清按钮文案
    const bioTitle = menu.querySelector('#biohazard-title');
    const bioCat = menu.querySelector('#biohazard-category');
    const isZombieMode = gameMode === 'zombie';
    if (bioTitle) bioTitle.style.display = isZombieMode ? 'block' : 'none';
    if (bioCat) bioCat.style.display = isZombieMode ? 'grid' : 'none';
    const serumBtn = document.getElementById('btn-zombie-serum');
    if (serumBtn && isZombieMode) {
        const canBuy = !zombieState.pending && !playerState.isZombie && playerState.team !== 'ZOMBIE';
        serumBtn.style.display = canBuy ? '' : 'none';
    }

    if (playerState.isControllingDrone) {
        menu.querySelectorAll('h3').forEach(h => h.style.display = 'none');
        menu.querySelectorAll('.mod-category button').forEach(b => {
            if (!b.id || !b.id.startsWith('btn-throwable-')) {
                b.style.display = 'none';
            }
        });
        const bHegrenade = document.getElementById('btn-throwable-hegrenade');
        if (bHegrenade) bHegrenade.innerHTML = "购买 手雷 (HE Grenade) - $150 (半价)";
        const bFlashbang = document.getElementById('btn-throwable-flashbang');
        if (bFlashbang) bFlashbang.innerHTML = "购买 闪光弹 (Flashbang) - $100 (半价)";
        const bMolotov = document.getElementById('btn-throwable-molotov');
        if (bMolotov) bMolotov.innerHTML = "购买 燃烧瓶 (Molotov) - $200 (半价)";
        const bSmoke = document.getElementById('btn-throwable-smoke');
        if (bSmoke) bSmoke.innerHTML = "购买 烟雾弹 (Smoke) - $150 (半价)";
        const bSandbag = document.getElementById('btn-throwable-sandbag');
        if (bSandbag) bSandbag.innerHTML = "购买 沙包 (Sandbag) - $25 (半价)";
        const bMine = document.getElementById('btn-throwable-mine');
        if (bMine) bMine.innerHTML = "购买 地雷 (Mine) - $150 (半价)";
    } else {
        menu.querySelectorAll('h3').forEach(h => {
            if (h.id === 'biohazard-title') {
                h.style.display = isZombieMode ? 'block' : 'none';
            } else {
                h.style.display = 'block';
            }
        });
        menu.querySelectorAll('.mod-category button').forEach(b => b.style.display = '');
        const bHegrenade = document.getElementById('btn-throwable-hegrenade');
        if (bHegrenade) bHegrenade.innerHTML = "购买 手雷 (HE Grenade) - $300";
        const bFlashbang = document.getElementById('btn-throwable-flashbang');
        if (bFlashbang) bFlashbang.innerHTML = "购买 闪光弹 (Flashbang) - $200";
        const bMolotov = document.getElementById('btn-throwable-molotov');
        if (bMolotov) bMolotov.innerHTML = "购买 燃烧瓶 (Molotov) - $400";
        const bSmoke = document.getElementById('btn-throwable-smoke');
        if (bSmoke) bSmoke.innerHTML = "购买 烟雾弹 (Smoke) - $300";
        const bSandbag = document.getElementById('btn-throwable-sandbag');
        if (bSandbag) bSandbag.innerHTML = "购买 沙包 (Sandbag) - $50";
        const bMine = document.getElementById('btn-throwable-mine');
        if (bMine) bMine.innerHTML = "购买 地雷 (Mine) - $300";
    }
    
    const buyCreditsEl = document.getElementById('buy-credits');
    if (buyCreditsEl) buyCreditsEl.innerText = playerCurrency;
    const _buyScore = document.getElementById('buy-score');
    if (_buyScore) _buyScore.innerText = playerScore;
    if (typeof updateBulletTypeUI === 'function') updateBulletTypeUI();
    if (document.exitPointerLock) document.exitPointerLock();
}

function closeBuyMenu() {
    const buyMenu = document.getElementById('buy-menu');
    if (buyMenu) {
        buyMenu.classList.add('hidden');
        buyMenu.classList.remove('active');
    }
    if (roundActive && controls && !isTouchDevice && typeof controls.lock === 'function') {
        controls.lock();
    }
}

function buyWeapon(type, cost) {
    // 生化模式: 僵尸禁买; 枪械仅感染爆发前可买, 投掷物爆发后仍可在出生区补给
    if (gameMode === 'zombie') {
        if (playerState.isZombie || playerState.team === 'ZOMBIE') {
            if (typeof showKillFeed === 'function') showKillFeed('僵尸无法购买装备！');
            return;
        }
        const isGun = ['rifle', 'sniper', 'marksman', 'smg', 'mk4', 'shotgun', 'm249', 'gatling', 'flamethrower', 'ash12', 'mortar'].includes(type)
            || ['pistol', 'deagle'].includes(type);
        if (isGun && !zombieState.pending) {
            if (typeof showKillFeed === 'function') showKillFeed('感染爆发后只能补给弹药与投掷物！');
            return;
        }
    }
    if (playerState.isControllingDrone) {
        if (!['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine'].includes(type)) return;
        cost = Math.floor(cost / 2);
    }
    if (playerCurrency >= cost) {
        if (type === 'rifle' || type === 'sniper' || type === 'marksman' || type === 'smg' || type === 'mk4' || type === 'shotgun' || type === 'm249' || type === 'gatling' || type === 'flamethrower' || type === 'ash12' || type === 'mortar') {
            playerCurrency -= cost;
            inventory.primary = type;
            const effMag = typeof getEffectiveMag === 'function' ? getEffectiveMag(WEAPONS[type]) : WEAPONS[type].mag;
            ammoState.primary.clip = effMag;
            ammoState.primary.reserve = WEAPONS[type].reserve;
            if (typeof switchWeapon === 'function') switchWeapon(1);
        } else if (type === 'pistol' || type === 'deagle') {
            playerCurrency -= cost;
            inventory.secondary = type;
            const effMag = typeof getEffectiveMag === 'function' ? getEffectiveMag(WEAPONS[type]) : WEAPONS[type].mag;
            ammoState.secondary.clip = effMag;
            ammoState.secondary.reserve = WEAPONS[type].reserve;
            if (typeof switchWeapon === 'function') switchWeapon(2);
        } else if (type === 'hegrenade' || type === 'flashbang' || type === 'molotov' || type === 'smoke' || type === 'sandbag' || type === 'mine' || type === 'drone') {
            if (type === 'mine' && (inventory.grenades.mine || 0) >= 5) {
                if (typeof showKillFeed === 'function') showKillFeed('地雷携带已达上限（5枚）');
                return;
            }
            playerCurrency -= cost;
            inventory.grenades[type] = (inventory.grenades[type] || 0) + 1;
            if (!inventory.currentGrenade) inventory.currentGrenade = type;
            const slot4 = document.getElementById('slot-4');
            if (slot4) slot4.classList.remove('hidden');
            if (typeof switchWeapon === 'function') switchWeapon(4);
        }
        const bCred = document.getElementById('buy-credits');
        if (bCred) bCred.innerText = playerCurrency;
        const hCred = document.getElementById('hud-credits');
        if (hCred) hCred.innerText = playerCurrency;
        if (typeof updateHUD === 'function') updateHUD();
    }
}

// ── 生化模式: 购买变异血清, 主动变异为母体僵尸 ──
function buyZombieSerum() {
    if (gameMode !== 'zombie') return;
    if (playerState.isZombie || playerState.team === 'ZOMBIE') {
        if (typeof showKillFeed === 'function') showKillFeed('你已经是僵尸了！');
        return;
    }
    if (zombieState.pending) {
        if (typeof showKillFeed === 'function') showKillFeed('感染尚未爆发，变异血清还未激活！');
        return;
    }
    if (playerCurrency < ZOMBIE.serumCost) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，变异血清需要 $' + ZOMBIE.serumCost);
        return;
    }
    playerCurrency -= ZOMBIE.serumCost;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;
    closeBuyMenu();
    if (typeof infectPlayer === 'function') infectPlayer(null, true);
}

function buyBulletStacking() {
    if (playerState.isControllingDrone) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) return;
    if (playerState.bulletStacking) {
        if (typeof showKillFeed === 'function') showKillFeed('子弹叠加已激活');
        return;
    }
    if (playerCurrency < 500) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买子弹叠加功能');
        return;
    }
    playerCurrency -= 500;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;
    playerState.bulletStacking = true;
    playerState.bulletTypes = [playerState.bulletType || 'normal'];
    if (typeof showKillFeed === 'function') showKillFeed('子弹叠加已激活！可同时选择多种子弹类型');
    updateBulletTypeUI();
}

function buyDropCompensation() {
    if (dropCompensationPurchased) {
        if (typeof showKillFeed === 'function') showKillFeed('弹道下坠补偿已购买');
        return;
    }
    if (playerCurrency < 300) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买弹道下坠补偿');
        return;
    }
    playerCurrency -= 300;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;
    dropCompensationPurchased = true;
    if (typeof showKillFeed === 'function') showKillFeed('弹道下坠补偿已购买！按 V 键开关');
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
    const w = typeof getCurrentWeapon === 'function' ? getCurrentWeapon() : null;
    if (!w || !w.dropRate) {
        if (typeof showKillFeed === 'function') showKillFeed('当前武器不支持弹道下坠补偿');
        return;
    }
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    raycaster.set(camera.position, camDir);
    raycaster.far = 2000;
    const _targets = bots.filter(bot => !bot.isDead).map(bot => bot.mesh).concat(collidableMeshList);
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
        if (typeof showKillFeed === 'function') showKillFeed('弹道补偿已更新（距离' + Math.round(targetDist) + '，下移' + Math.round(pixelOffset) + 'px）');
    } else {
        dropCompensationOffset = 0;
        dropCompensationActive = false;
        const dot = document.getElementById('ch-dot');
        if (dot) dot.style.transform = 'translate(-50%, -50%)';
        if (typeof showKillFeed === 'function') showKillFeed('距离太近，无需补偿');
    }
}

function buyAmmo() {
    if (playerState.isControllingDrone) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) return;
    const w = typeof getCurrentWeapon === 'function' ? getCurrentWeapon() : null;
    if (!w || w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade') {
        if (typeof showKillFeed === 'function') showKillFeed('近战武器无需购买子弹');
        return;
    }
    if (['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone'].includes(w.id)) {
        if (typeof showKillFeed === 'function') showKillFeed('投掷物请在装备栏直接购买');
        return;
    }
    let magSize = (typeof w.mag === 'number') ? w.mag : 30;
    let buyAmount = magSize * 2;
    let cost = Math.round(magSize * 5 / 10) * 10;

    if (playerCurrency < cost) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买子弹 (需要' + cost + '$)');
        return;
    }
    playerCurrency -= cost;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;

    if (inventory.currentSlot === 1) {
        ammoState.primary.reserve += buyAmount;
    } else if (inventory.currentSlot === 2) {
        ammoState.secondary.reserve += buyAmount;
    }

    if (typeof showKillFeed === 'function') showKillFeed('购买子弹: +' + buyAmount + '发 (花费' + cost + '$)');
    if (typeof updateHUD === 'function') updateHUD();
}

function buyArmorPlate() {
    if (playerState.isControllingDrone) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) return;
    if ((playerState.armorPlates || 0) >= 6) {
        if (typeof showKillFeed === 'function') showKillFeed('护甲板已达上限（6块，减伤85%）');
        return;
    }
    if (playerCurrency < 400) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买护甲板');
        return;
    }
    playerCurrency -= 400;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;
    playerState.armorPlates = (playerState.armorPlates || 0) + 1;
    let reduction = Math.min(85, playerState.armorPlates * 15);
    if (typeof showKillFeed === 'function') showKillFeed('护甲板已安装: ' + playerState.armorPlates + '块 (减伤' + reduction + '%)');
    if (typeof updateArmorHUD === 'function') updateArmorHUD();
}

// ── 医疗包: 商店消耗品，立即恢复满血 ──
function buyMedkit() {
    if (playerState.isControllingDrone) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) {
        if (typeof showKillFeed === 'function') showKillFeed('僵尸无法使用医疗包');
        return;
    }
    if (playerState.hp >= 100) {
        if (typeof showKillFeed === 'function') showKillFeed('生命值已满，无需医疗包');
        return;
    }
    if (playerCurrency < 500) {
        if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买医疗包');
        return;
    }
    playerCurrency -= 500;
    const bCred = document.getElementById('buy-credits');
    if (bCred) bCred.innerText = playerCurrency;
    const hCred = document.getElementById('hud-credits');
    if (hCred) hCred.innerText = playerCurrency;
    playerState.hp = 100;
    if (typeof showKillFeed === 'function') showKillFeed('使用医疗包: 生命值已恢复至 100');
    if (typeof updateHUD === 'function') updateHUD();
}

function buyBulletType(typeId) {
    if (playerState.isControllingDrone) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) return;
    const bt = BULLET_TYPES[typeId];
    if (!bt) return;

    const w = typeof getCurrentWeapon === 'function' ? getCurrentWeapon() : null;
    if (w) {
        if (w.id === 'flamethrower' && (typeId === 'tracking' || typeId === 'proximity')) {
            if (typeof showKillFeed === 'function') showKillFeed('喷火器无法使用追踪子弹或近炸引信子弹');
            return;
        }
        if (w.id === 'shotgun' && typeId === 'dual') {
            if (typeof showKillFeed === 'function') showKillFeed('霰弹枪无法使用双头弹');
            return;
        }
        if (w.id === 'shotgun' && typeId === 'fragment') {
            if (typeof showKillFeed === 'function') showKillFeed('霰弹枪无法使用破片子弹');
            return;
        }
    }
    let scaledCost = bt.cost;

    if (playerState.bulletStacking) {
        let idx = playerState.bulletTypes.indexOf(typeId);
        if (idx >= 0) {
            if (playerState.bulletTypes.length <= 1) {
                if (typeof showKillFeed === 'function') showKillFeed('至少需要保留一种子弹类型');
                return;
            }
            playerState.bulletTypes.splice(idx, 1);
            if (typeof showKillFeed === 'function') showKillFeed('已移除: ' + bt.name);
        } else {
            if (bt.costType === 'currency') {
                if (playerCurrency < scaledCost) {
                    if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                    return;
                }
                playerCurrency -= scaledCost;
                const bCred = document.getElementById('buy-credits');
                if (bCred) bCred.innerText = playerCurrency;
                const hCred = document.getElementById('hud-credits');
                if (hCred) hCred.innerText = playerCurrency;
            } else if (bt.costType === 'score') {
                if (playerScore < scaledCost) {
                    if (typeof showKillFeed === 'function') showKillFeed('积分不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                    return;
                }
                playerScore -= scaledCost;
                if (document.getElementById('hud-score'))
                    document.getElementById('hud-score').innerText = playerScore;
                const _bs = document.getElementById('buy-score');
                if (_bs) _bs.innerText = playerScore;
            }
            playerState.bulletTypes.push(typeId);
            if (typeof showKillFeed === 'function') showKillFeed('已添加: ' + bt.name);
        }
        playerState.bulletType = playerState.bulletTypes[0];
    } else {
        if (bt.costType === 'currency') {
            if (playerCurrency < scaledCost) {
                if (typeof showKillFeed === 'function') showKillFeed('金币不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                return;
            }
            playerCurrency -= scaledCost;
            const bCred = document.getElementById('buy-credits');
            if (bCred) bCred.innerText = playerCurrency;
            const hCred = document.getElementById('hud-credits');
            if (hCred) hCred.innerText = playerCurrency;
        } else if (bt.costType === 'score') {
            if (playerScore < scaledCost) {
                if (typeof showKillFeed === 'function') showKillFeed('积分不足，无法购买 ' + bt.name + ' (需要' + scaledCost + ')');
                return;
            }
            playerScore -= scaledCost;
            if (document.getElementById('hud-score'))
                document.getElementById('hud-score').innerText = playerScore;
            const _bs2 = document.getElementById('buy-score');
            if (_bs2) _bs2.innerText = playerScore;
        }
        playerState.bulletType = typeId;
        if (typeof showKillFeed === 'function') showKillFeed('子弹类型已切换: ' + bt.name);
    }
    if (typeof adjustClipForLightBullet === 'function') adjustClipForLightBullet();
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

// #endregion
