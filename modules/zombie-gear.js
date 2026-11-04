// #region 生化模式装备系统: 空投补给 + 沙袋路障 + 肾上腺素
let airdrops = [];          // { mesh, beam, state:'falling'|'landed', landTimer, content, hp }
let barriers = [];          // { mesh, hp }
let airdropNextAt = null;   // 下次空投的帧号
let adrenalineFrames = 0;   // 肾上腺素剩余帧
let adrenalineCount = 0;    // 肾上腺素库存
const ADRENALINE_MAX = 3;
let adrenalineOverlay = null;

// ── 沙袋路障 ──────────────────────────────────────────────
// 沙包投掷落地后形成实体障碍（grenades.js 调用）
function createBarrier(pos) {
    if (gameMode !== 'zombie' || !scene) return;
    if (barriers.length >= ZOMBIE.barrierMax) removeBarrier(barriers[0]);

    const geo = new THREE.BoxGeometry(14, 5, 5);
    const mat = new THREE.MeshStandardMaterial({ color: 0xc2b280, roughness: 0.9 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 2.5, pos.z);
    mesh.rotation.y = Math.random() * Math.PI;
    mesh.name = 'wall';
    mesh.userData.noClimb = true;   // 不可攀爬: 玩家/Bot/僵尸都无法跨越, 必须绕行或摧毁
    mesh.userData.isBarrier = true;
    scene.add(mesh);
    mesh.worldBox = new THREE.Box3().setFromObject(mesh);
    collidableMeshList.push(mesh);
    barriers.push({ mesh: mesh, hp: ZOMBIE.barrierHp });
}

function removeBarrier(bar) {
    const i = barriers.indexOf(bar);
    if (i >= 0) barriers.splice(i, 1);
    const j = collidableMeshList.indexOf(bar.mesh);
    if (j >= 0) collidableMeshList.splice(j, 1);
    scene.remove(bar.mesh);
    if (bar.mesh.geometry) bar.mesh.geometry.dispose();
    if (bar.mesh.material) bar.mesh.material.dispose();
}

// 僵尸利爪拆路障 / 玩家近战拆路障共用入口
function damageBarrier(bar, dmg) {
    bar.hp -= dmg;
    createHitEffect(bar.mesh.position.clone(), true);
    if (bar.hp <= 0) {
        createHitEffect(bar.mesh.position.clone().add(new THREE.Vector3(0, 3, 0)), true);
        removeBarrier(bar);
    }
}

// ── 空投补给 ──────────────────────────────────────────────
function findAirdropSpot() {
    for (let tries = 0; tries < 50; tries++) {
        const gx = 15 + Math.floor(Math.random() * (NAV_CELL_COUNT - 30));
        const gz = 15 + Math.floor(Math.random() * (NAV_CELL_COUNT - 30));
        if (!navGrid[gx] || !navGrid[gx][gz]) continue;
        const p = getWorldPos(gx, gz);
        if (p.distanceTo(getPlayerPosition()) > 80) return p;
    }
    return new THREE.Vector3((Math.random() - 0.5) * 600, 0, (Math.random() - 0.5) * 600);
}

function spawnAirdrop() {
    const pos = findAirdropSpot();

    // 落点光柱
    const beamGeo = new THREE.CylinderGeometry(2.5, 2.5, 240, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x33ff66, transparent: true, opacity: 0.25, side: THREE.DoubleSide });
    const beam = new THREE.Mesh(beamGeo, beamMat);
    beam.position.set(pos.x, 120, pos.z);
    scene.add(beam);

    // 箱体 + 降落伞
    const group = new THREE.Group();
    const crate = new THREE.Mesh(
        new THREE.BoxGeometry(10, 8, 10),
        new THREE.MeshStandardMaterial({ color: 0x4a5d3a })
    );
    crate.name = 'crate';
    group.add(crate);
    const chute = new THREE.Mesh(
        new THREE.ConeGeometry(14, 10, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xff7722, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
    );
    chute.name = 'chute';
    chute.position.y = 14;
    group.add(chute);
    group.position.set(pos.x, 240, pos.z);
    scene.add(group);

    const roll = Math.random();
    const content = roll < 0.4 ? 'weapon' : (roll < 0.75 ? 'ammo' : 'medic');
    airdrops.push({ mesh: group, beam: beam, state: 'falling', landTimer: 0, content: content, hp: ZOMBIE.airdropHp });
    showKillFeed('📦 空投补给已投放！先到先得，小心僵尸伏击！');
}

function removeAirdrop(i) {
    const a = airdrops[i];
    scene.remove(a.mesh);
    if (a.beam) scene.remove(a.beam);
    a.mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        }
    });
    if (a.beam) {
        a.beam.geometry.dispose();
        a.beam.material.dispose();
    }
    airdrops.splice(i, 1);
}

function damageAirdrop(a, dmg) {
    a.hp -= dmg;
    createHitEffect(a.mesh.position.clone(), true);
    if (a.hp <= 0) {
        const i = airdrops.indexOf(a);
        if (i >= 0) removeAirdrop(i);
    }
}

function claimAirdrop(a, claimer) {
    if (claimer === 'player') {
        if (a.content === 'weapon') {
            const pool = ['m249', 'gatling', 'ash12'];
            const g = pool[Math.floor(Math.random() * pool.length)];
            inventory.primary = g;
            ammoState.primary.clip = getEffectiveMag(WEAPONS[g]);
            ammoState.primary.reserve = WEAPONS[g].reserve;
            switchWeapon(1);
            showKillFeed('📦 空投补给：获得 ' + WEAPONS[g].name + '（满弹药）！');
        } else if (a.content === 'ammo') {
            if (inventory.primary && ammoState.primary) {
                ammoState.primary.clip = getEffectiveMag(WEAPONS[inventory.primary]);
                ammoState.primary.reserve = WEAPONS[inventory.primary].reserve;
            }
            if (inventory.secondary && ammoState.secondary) {
                ammoState.secondary.clip = getEffectiveMag(WEAPONS[inventory.secondary]);
                ammoState.secondary.reserve = WEAPONS[inventory.secondary].reserve;
            }
            adrenalineCount = Math.min(ADRENALINE_MAX, adrenalineCount + 1);
            const isTouch = (typeof checkIsTouchDevice === 'function' ? checkIsTouchDevice() : Boolean(typeof isTouchDevice !== 'undefined' && isTouchDevice));
            showKillFeed(isTouch ? '📦 空投补给：弹药全满 + 肾上腺素×1（点击右侧图标使用）！' : '📦 空投补给：弹药全满 + 肾上腺素×1（按 Q 使用）！');
        } else {
            playerState.hp = 100;
            inventory.grenades.sandbag = (inventory.grenades.sandbag || 0) + 2;
            inventory.grenades.hegrenade = (inventory.grenades.hegrenade || 0) + 1;
            if (!inventory.currentGrenade) inventory.currentGrenade = 'sandbag';
            const slot4 = document.getElementById('slot-4');
            if (slot4) slot4.classList.remove('hidden');
            showKillFeed('📦 空投补给：生命值全满 + 沙包×2 + 手雷×1！');
        }
        updateHUD();
    } else {
        // 人类Bot: 武器箱→M249, 其他→回满血
        if (a.content === 'weapon') claimer.weapon = 'm249';
        claimer.hp = claimer.maxHp;
    }
}

// 人类Bot顺路抢空投: 返回120范围内最近落地空投的位置（纯查询, 无副作用）
function getBotAirdropTarget(b) {
    let best = null;
    let bestD = 120;
    for (const a of airdrops) {
        if (a.state !== 'landed') continue;
        const d = b.mesh.position.distanceTo(a.mesh.position);
        if (d < bestD) { bestD = d; best = a; }
    }
    return best ? best.mesh.position.clone() : null;
}

// ── 肾上腺素 ──────────────────────────────────────────────
function buyAdrenaline() {
    if (gameMode !== 'zombie') return;
    if (playerState.isZombie || playerState.team === 'ZOMBIE') {
        showKillFeed('僵尸无法使用肾上腺素！');
        return;
    }
    if (adrenalineCount >= ADRENALINE_MAX) {
        showKillFeed('肾上腺素最多携带 ' + ADRENALINE_MAX + ' 支！');
        return;
    }
    if (playerCurrency < ZOMBIE.adrenalineCost) {
        showKillFeed('金币不足，肾上腺素需要 $' + ZOMBIE.adrenalineCost);
        return;
    }
    playerCurrency -= ZOMBIE.adrenalineCost;
    adrenalineCount++;
    document.getElementById('buy-credits').innerText = playerCurrency;
    document.getElementById('hud-credits').innerText = playerCurrency;
    updateAdrenalineHud();
    const isTouch = (typeof checkIsTouchDevice === 'function' ? checkIsTouchDevice() : Boolean(typeof isTouchDevice !== 'undefined' && isTouchDevice));
    showKillFeed(isTouch ? '⚡ 购买肾上腺素×1（点击右侧图标使用：8秒移速+50%）' : '⚡ 购买肾上腺素×1（按 Q 使用：8秒移速+50%）');
}

function useAdrenaline() {
    if (gameMode !== 'zombie' || !roundActive) return;
    if (playerState.isZombie || playerState.team === 'ZOMBIE' || playerState.hp <= 0 || playerState.isSpectating) return;
    if (adrenalineCount <= 0) {
        showKillFeed('没有肾上腺素（商店可购买）');
        return;
    }
    if (adrenalineFrames > 0) return;
    adrenalineCount--;
    adrenalineFrames = ZOMBIE.adrenalineDuration * 60;
    showAdrenalineOverlay();
    playKnifeSound('hit');
    showKillFeed('⚡ 肾上腺素生效！' + ZOMBIE.adrenalineDuration + '秒内移速+50%');
    updateAdrenalineHud();
}

function showAdrenalineOverlay() {
    if (adrenalineOverlay) return;
    adrenalineOverlay = document.createElement('div');
    adrenalineOverlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:9000;box-shadow:inset 0 0 120px 40px rgba(255,60,0,0.45);';
    document.body.appendChild(adrenalineOverlay);
}

function removeAdrenalineOverlay() {
    if (adrenalineOverlay) {
        adrenalineOverlay.remove();
        adrenalineOverlay = null;
    }
}

function updateAdrenalineHud() {
    const el = document.getElementById('adrenaline-hud');
    if (!el) return;
    if (gameMode !== 'zombie' || (adrenalineCount <= 0 && adrenalineFrames <= 0)) {
        el.style.display = 'none';
        return;
    }
    el.style.display = '';
    const isTouch = (typeof window !== 'undefined' && (
        (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) ||
        document.body.classList.contains('touch-device')
    ));
    const hint = isTouch ? '' : ' (按Q)';
    el.innerText = adrenalineFrames > 0
        ? ('⚡ 肾上腺素 ' + Math.ceil(adrenalineFrames / 60) + 's')
        : ('⚡ 肾上腺素 ×' + adrenalineCount + hint);
    if (!el._touchBound) {
        el._touchBound = true;
        el.style.cursor = 'pointer';
        el.style.pointerEvents = 'auto';
        el.addEventListener('click', () => { if (typeof useAdrenaline === 'function') useAdrenaline(); });
        el.addEventListener('touchend', (e) => {
            e.preventDefault();
            if (typeof useAdrenaline === 'function') useAdrenaline();
        }, { passive: false });
    }
}

// ── 主循环入口（physics.js 每帧调用） ────────────────────
function updateZombieGear(delta) {
    if (adrenalineFrames > 0) {
        adrenalineFrames--;
        if (adrenalineFrames === 0) removeAdrenalineOverlay();
    }
    if (gameMode !== 'zombie' || !roundActive) return;

    // 空投调度: 感染爆发后开始
    if (!zombieState.pending) {
        if (airdropNextAt === null) airdropNextAt = frameCount + ZOMBIE.airdropDelay * 60;
        if (frameCount >= airdropNextAt) {
            spawnAirdrop();
            airdropNextAt = frameCount + ZOMBIE.airdropInterval * 60;
        }
    }

    for (let i = airdrops.length - 1; i >= 0; i--) {
        const a = airdrops[i];
        if (a.state === 'falling') {
            a.mesh.position.y -= 55 * delta;
            if (a.mesh.position.y <= 4) {
                a.mesh.position.y = 4;
                a.state = 'landed';
                const chute = a.mesh.getObjectByName('chute');
                if (chute) chute.visible = false;
                a.landTimer = ZOMBIE.airdropLife * 60;
                createHitEffect(new THREE.Vector3(a.mesh.position.x, 0.5, a.mesh.position.z), true);
            }
        } else {
            a.landTimer--;
            if (a.landTimer <= 0) {
                removeAirdrop(i);
                continue;
            }
            // 玩家拾取
            if (playerState.hp > 0 && !playerState.isSpectating && !playerState.isZombie && playerState.team !== 'ZOMBIE'
                && getPlayerPosition().distanceTo(a.mesh.position) < 12) {
                claimAirdrop(a, 'player');
                removeAirdrop(i);
                continue;
            }
            // 人类Bot拾取
            let claimed = false;
            for (const b of bots) {
                if (b.isDead || b.team === 'ZOMBIE') continue;
                if (b.mesh.position.distanceTo(a.mesh.position) < 12) {
                    claimAirdrop(a, b);
                    removeAirdrop(i);
                    claimed = true;
                    break;
                }
            }
            if (claimed) continue;
        }
        if (a.beam) a.beam.material.opacity = 0.15 + Math.sin(frameCount * 0.1) * 0.1;
    }

    updateAdrenalineHud();
}

// ── 回合清理（map.js resetRound 调用） ───────────────────
function cleanupZombieGear() {
    for (let i = airdrops.length - 1; i >= 0; i--) removeAirdrop(i);
    for (let i = barriers.length - 1; i >= 0; i--) {
        const bar = barriers[i];
        const j = collidableMeshList.indexOf(bar.mesh);
        if (j >= 0) collidableMeshList.splice(j, 1);
        scene.remove(bar.mesh);
        if (bar.mesh.geometry) bar.mesh.geometry.dispose();
        if (bar.mesh.material) bar.mesh.material.dispose();
        barriers.splice(i, 1);
    }
    airdropNextAt = null;
    adrenalineFrames = 0;
    adrenalineCount = 0;
    removeAdrenalineOverlay();
    updateAdrenalineHud();
}

// #endregion
