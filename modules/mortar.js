// #region 迫击炮系统
let mortarMapOpen = false;
let mortarZoom = 1.0;
let mortarTargetPos = null;
let mortarMouseX = 0;
let mortarMouseY = 0;
let mortarShells = [];
let mortarCameraActive = false;
let mortarSavedCameraPos = null;
let mortarSavedCameraRot = null;
let mortarSavedFov = 75;
let mortarCameraReturnTimer = 0;
let mortarShellMesh = null;
let mortarExplosionPos = null;

function openMortarMap() {
    if (mortarMapOpen) return;
    const w = getCurrentWeapon();
    if (!w || w.id !== 'mortar') return;
    if (ammoState.primary.clip <= 0) {
        if (ammoState.primary.reserve > 0) {
            handleReload();
        } else {
            showKillFeed('迫击炮弹药耗尽');
        }
        return;
    }
    mortarMapOpen = true;
    mortarTargetPos = null;
    mortarZoom = 1.0;
    const overlay = document.getElementById('mortar-map-overlay');
    if (overlay) overlay.classList.remove('hidden');
    if (controls) document.exitPointerLock();
    drawMortarMap();
}

function closeMortarMap() {
    mortarMapOpen = false;
    mortarTargetPos = null;
    const overlay = document.getElementById('mortar-map-overlay');
    const canLock = (typeof shouldAutoLockPointer === 'function') ? shouldAutoLockPointer() : !isTouchDevice;
    if (roundActive && controls && canLock && typeof controls.lock === 'function') {
        try { controls.lock(); } catch (e) {}
    }
    if (typeof updatePointerLockPrompt === 'function') {
        updatePointerLockPrompt();
    }
}

function drawMortarMap() {
    const canvas = document.getElementById('mortar-map-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, w, h);

    const baseScale = w / 800;
    const scale = baseScale * mortarZoom;
    const cx = w / 2;
    const cy = h / 2;

    const offsetX = cx - (mortarMouseX - cx) * (mortarZoom - 1) / mortarZoom * 0;
    const offsetY = cy - (mortarMouseY - cy) * (mortarZoom - 1) / mortarZoom * 0;

    const toMapX = (worldX) => cx + worldX * scale;
    const toMapY = (worldZ) => cy + worldZ * scale;

    ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
    collidableMeshList.forEach(mesh => {
        if (mesh.worldBox) {
            const minX = toMapX(mesh.worldBox.min.x);
            const minZ = toMapY(mesh.worldBox.min.z);
            const boxW = (mesh.worldBox.max.x - mesh.worldBox.min.x) * scale;
            const boxH = (mesh.worldBox.max.z - mesh.worldBox.min.z) * scale;
            if (minX + boxW < 0 || minX > w || minZ + boxH < 0 || minZ > h) return;
            ctx.fillRect(minX, minZ, boxW, boxH);
        }
    });

    bombZones.forEach((zone) => {
        const x = toMapX(zone.mesh.position.x);
        const z = toMapY(zone.mesh.position.z);
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)';
        ctx.fillRect(x - 4, z - 4, 8, 8);
        ctx.fillStyle = 'white';
        ctx.font = '10px "Microsoft YaHei", Arial';
        ctx.textAlign = 'center';
        ctx.fillText(zone.name || 'Zone', x, z - 8);
    });

    bots.forEach(b => {
        if (b.team === playerState.team) return;
        if (b.hp <= 0) return;
        const x = toMapX(b.mesh.position.x);
        const z = toMapY(b.mesh.position.z);
        if (x < 0 || x > w || z < 0 || z > h) return;
        ctx.beginPath();
        ctx.arc(x, z, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#e74c3c';
        ctx.fill();
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 1;
        ctx.stroke();
    });

    bots.forEach(b => {
        if (b.team !== playerState.team) return;
        if (b.hp <= 0) return;
        const x = toMapX(b.mesh.position.x);
        const z = toMapY(b.mesh.position.z);
        if (x < 0 || x > w || z < 0 || z > h) return;
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    });

    if (playerState.hp > 0 && !playerState.isSpectating) {
        const px = toMapX(camera.position.x);
        const pz = toMapY(camera.position.z);
        ctx.beginPath();
        ctx.arc(px, pz, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.lineTo(px + dir.x * 8, pz + dir.z * 8);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const weapon = getCurrentWeapon();
    const explosionRadius = (weapon && weapon.explosionRadius) || 50;
    const mouseWorld = mortarCanvasToWorld(mortarMouseX, mortarMouseY, canvas);
    const mx = toMapX(mouseWorld.x);
    const my = toMapY(mouseWorld.z);
    ctx.beginPath();
    ctx.arc(mx, my, explosionRadius * scale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(231, 76, 60, 0.2)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(231, 76, 60, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(mx, my, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    if (mortarTargetPos) {
        const tx = toMapX(mortarTargetPos.x);
        const tz = toMapY(mortarTargetPos.z);
        ctx.beginPath();
        ctx.arc(tx, tz, explosionRadius * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(241, 196, 15, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(241, 196, 15, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(tx - 8, tz);
        ctx.lineTo(tx + 8, tz);
        ctx.moveTo(tx, tz - 8);
        ctx.lineTo(tx, tz + 8);
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.stroke();
    }

    const infoEl = document.getElementById('mortar-map-info');
    if (infoEl) {
        if (mortarTargetPos) {
            infoEl.textContent = `目标坐标: (${Math.round(mortarTargetPos.x)}, ${Math.round(mortarTargetPos.z)})  |  缩放: ${mortarZoom.toFixed(1)}x  |  弹药: ${ammoState.primary.clip}/${ammoState.primary.reserve}  |  按 F 发射`;
        } else {
            infoEl.textContent = `缩放: ${mortarZoom.toFixed(1)}x  |  弹药: ${ammoState.primary.clip}/${ammoState.primary.reserve}  |  点击地图选择目标`;
        }
    }
}

function mortarCanvasToWorld(canvasX, canvasY, canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const baseScale = w / 800;
    const scale = baseScale * mortarZoom;
    const cx = w / 2;
    const cy = h / 2;
    return {
        x: (canvasX - cx) / scale,
        z: (canvasY - cy) / scale
    };
}

function handleMortarMapMouseMove(e) {
    if (!mortarMapOpen) return;
    const canvas = document.getElementById('mortar-map-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    mortarMouseX = ((e.clientX - rect.left) / rect.width) * canvas.width;
    mortarMouseY = ((e.clientY - rect.top) / rect.height) * canvas.height;
    drawMortarMap();
}

function handleMortarMapClick(e) {
    if (!mortarMapOpen) return;
    const canvas = document.getElementById('mortar-map-canvas');
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const world = mortarCanvasToWorld(cx, cy, canvas);
    world.x = Math.max(-399, Math.min(399, world.x));
    world.z = Math.max(-399, Math.min(399, world.z));
    mortarTargetPos = new THREE.Vector3(world.x, 0, world.z);
    drawMortarMap();
}

function handleMortarMapWheel(e) {
    if (!mortarMapOpen) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.2 : 0.2;
    mortarZoom = Math.max(0.5, Math.min(4.0, mortarZoom + delta));
    drawMortarMap();
}

function fireMortar() {
    if (!mortarMapOpen || !mortarTargetPos) return;
    if (ammoState.primary.clip <= 0) {
        showKillFeed('迫击炮弹药耗尽');
        return;
    }

    const target = mortarTargetPos.clone();
    ammoState.primary.clip--;
    updateHUD();

    const shellGeo = new THREE.SphereGeometry(1.5, 8, 8);
    const shellMat = new THREE.MeshStandardMaterial({ color: 0x4a5a2a, emissive: 0x222200 });
    const shellMesh = new THREE.Mesh(shellGeo, shellMat);
    shellMesh.position.set(target.x, 200, target.z);
    shellMesh.userData.isMortarShell = true;
    scene.add(shellMesh);

    mortarShells.push({
        mesh: shellMesh,
        targetPos: target,
        velocity: new THREE.Vector3(0, -80, 0),
        exploded: false,
        team: playerState.team
    });

    mortarCameraActive = true;
    mortarSavedCameraPos = camera.position.clone();
    mortarSavedCameraRot = camera.rotation.clone();
    mortarSavedFov = camera.fov;

    camera.position.set(target.x, 80, target.z);
    camera.lookAt(target.x, 200, target.z);

    mortarMapOpen = false;
    mortarTargetPos = null;
    const overlay = document.getElementById('mortar-map-overlay');
    if (overlay) overlay.classList.add('hidden');

    showKillFeed('迫击炮已发射！按 [Esc] 或 [F] 立即返回本体视角');
    const cancelBtn = document.getElementById('mortar-cancel-btn');
    if (cancelBtn) cancelBtn.classList.remove('hidden');

    if (playerState.viewModel) playerState.viewModel.visible = false;
}

function updateMortarShells(delta) {
    for (let i = mortarShells.length - 1; i >= 0; i--) {
        const s = mortarShells[i];
        if (s.exploded) continue;

        s.mesh.position.add(s.velocity.clone().multiplyScalar(delta));
        s.velocity.y -= 20 * delta;

        if (s.mesh.position.y <= 0.5) {
            s.mesh.position.y = 0.5;
            s.exploded = true;
            mortarExplosionPos = s.targetPos.clone();
            explodeMortarShell(s);
            scene.remove(s.mesh);
            s.mesh.geometry.dispose();
            s.mesh.material.dispose();
            mortarCameraReturnTimer = 1.0;
            mortarShells.splice(i, 1);
        }
    }
}

function explodeMortarShell(shell) {
    const pos = shell.targetPos.clone();
    pos.y = 0.5;

    createExplosionEffect(pos);
    playExplosionSound(pos);
    createExplosionEffect(pos.clone().add(new THREE.Vector3(0, 2, 0)));

    const weapon = WEAPONS.mortar;
    const range = weapon.explosionRadius || 50;
    const baseDamage = weapon.damage;

    for (let index = bots.length - 1; index >= 0; index--) {
        const b = bots[index];
        if (b.isDead) continue;
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < range) {
            const dmg = Math.round(Math.max(0, baseDamage * (1 - dist / range)));
            if (b.team !== shell.team) {
                b.hp -= dmg * zombieExplosiveDmgMult(b);
                if (b.hp <= 0) killBot(index, shell.team, 'mortar', true);
            }
        }
    }

    if (isShootingRange) {
        rangeTargets.forEach(t => {
            const dist = t.position.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, baseDamage * (1 - dist / range)));
                if (dmg > 0) showFloatingDamage(dmg, t.position);
            }
        });
    }

    for (let i = activeDrones.length - 1; i >= 0; i--) {
        const d = activeDrones[i];
        const dist = d.mesh.position.distanceTo(pos);
        if (dist < range) {
            const dmg = Math.round(Math.max(0, baseDamage * (1 - dist / range)));
            if (d.team !== shell.team) {
                d.hp -= dmg;
                if (d.hp <= 0) destroyDrone(d, false);
            }
        }
    }

    if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== shell.team) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(pos);
        if (dist < range) {
            const dmg = Math.round(Math.max(0, baseDamage * 0.6 * (1 - dist / range)));
            if (!playerState.isInvincible) playerState.hp -= Math.ceil(dmg);
            if (typeof triggerDamageVignette === 'function') triggerDamageVignette(dmg / 35);
            if (typeof playerState !== 'undefined') playerState.cameraShake = Math.min(0.035, (playerState.cameraShake || 0) + 0.025);
            playerState.lastCombatTime = frameCount;
            updateHUD();
            if (playerState.hp <= 0) playerDie(shell.team, 'mortar');
        }
    }

    showKillFeed('迫击炮爆炸！范围: ' + range + ' 单位');
}

function updateMortarCamera(delta) {
    if (!mortarCameraActive) return;

    if (mortarShells.length > 0 && !mortarShells[0].exploded) {
        const shell = mortarShells[0];
        const targetPos = shell.targetPos;
        const shellY = shell.mesh.position.y;

        camera.position.x = targetPos.x;
        camera.position.z = targetPos.z;

        const desiredY = 40 + shellY * 0.2;
        camera.position.y += (desiredY - camera.position.y) * 0.08;

        camera.lookAt(shell.mesh.position.x, shell.mesh.position.y, shell.mesh.position.z);
    } else if (mortarCameraReturnTimer > 0) {
        mortarCameraReturnTimer -= delta;
        if (mortarExplosionPos) {
            camera.lookAt(mortarExplosionPos.x, 0, mortarExplosionPos.z);
        }
        if (mortarCameraReturnTimer <= 0) {
            camera.position.copy(mortarSavedCameraPos);
            camera.rotation.copy(mortarSavedCameraRot);
            camera.fov = mortarSavedFov;
            camera.updateProjectionMatrix();
            mortarCameraActive = false;
            mortarSavedCameraPos = null;
            mortarSavedCameraRot = null;
            mortarExplosionPos = null;

            const cancelBtn = document.getElementById('mortar-cancel-btn');
            if (cancelBtn) cancelBtn.classList.add('hidden');

            if (playerState.viewModel) playerState.viewModel.visible = true;
            const canLockLanding = (typeof shouldAutoLockPointer === 'function') ? shouldAutoLockPointer() : !isTouchDevice;
            if (roundActive && controls && canLockLanding) {
                try { controls.lock(); } catch (e) {}
            }
            if (typeof updatePointerLockPrompt === 'function') {
                updatePointerLockPrompt();
            }
        }
    }
}

// 中断迫击炮空中弹道跟踪并立即返回角色本体视角
function cancelMortarCamera() {
    if (!mortarCameraActive) return;
    if (mortarSavedCameraPos) {
        camera.position.copy(mortarSavedCameraPos);
        camera.rotation.copy(mortarSavedCameraRot);
        camera.fov = mortarSavedFov;
        camera.updateProjectionMatrix();
    }
    mortarCameraActive = false;
    mortarCameraReturnTimer = 0;
    mortarSavedCameraPos = null;
    mortarSavedCameraRot = null;
    mortarExplosionPos = null;

    const cancelBtn = document.getElementById('mortar-cancel-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');

    if (playerState.viewModel) playerState.viewModel.visible = true;
    const canLockCancel = (typeof shouldAutoLockPointer === 'function') ? shouldAutoLockPointer() : !isTouchDevice;
    if (roundActive && controls && canLockCancel) {
        try { controls.lock(); } catch (e) {}
    }
    if (typeof updatePointerLockPrompt === 'function') {
        updatePointerLockPrompt();
    }
    if (typeof showKillFeed === 'function') showKillFeed('已中断迫击炮视角，返回角色本体');
}

// 全局清理迫击炮状态与在途弹药 Mesh
function cleanupMortar() {
    cancelMortarCamera();
    mortarMapOpen = false;
    mortarCameraActive = false;
    mortarCameraReturnTimer = 0;
    mortarTargetPos = null;
    mortarExplosionPos = null;
    if (mortarShells && mortarShells.length > 0) {
        mortarShells.forEach(s => {
            if (s.mesh) {
                scene.remove(s.mesh);
                if (s.mesh.geometry) s.mesh.geometry.dispose();
                if (s.mesh.material) s.mesh.material.dispose();
            }
        });
        mortarShells = [];
    }
    const overlay = document.getElementById('mortar-map-overlay');
    if (overlay) overlay.classList.add('hidden');
    const cancelBtn = document.getElementById('mortar-cancel-btn');
    if (cancelBtn) cancelBtn.classList.add('hidden');
}

function initMortarEvents() {
    const canvas = document.getElementById('mortar-map-canvas');
    if (!canvas) return;
    canvas.addEventListener('mousemove', handleMortarMapMouseMove);
    canvas.addEventListener('click', handleMortarMapClick);
    canvas.addEventListener('wheel', handleMortarMapWheel, { passive: false });

    document.addEventListener('keydown', (e) => {
        if (!mortarMapOpen && !mortarCameraActive) return;
        if (mortarCameraActive) {
            if (e.code === 'Escape' || e.code === 'KeyF' || e.key === 'Escape' || e.key === 'f' || e.key === 'F') {
                e.preventDefault();
                cancelMortarCamera();
                return;
            }
        }
        if ((e.code === 'KeyF' || e.key === 'f' || e.key === 'F') && mortarMapOpen) {
            e.preventDefault();
            fireMortar();
        } else if ((e.code === 'Escape' || e.key === 'Escape') && mortarMapOpen) {
            e.preventDefault();
            closeMortarMap();
        }
    });
}
initMortarEvents();
// #endregion
