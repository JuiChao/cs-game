// #region 炸弹系统
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
        if (!bombState.mesh) {
            promptUI.classList.add('hidden');
            bombUI.classList.add('hidden');
            return;
        }

        const distToBomb = playerPos.distanceTo(bombState.mesh.position);
        if (distToBomb < 15.0 && playerState.team === 'CT') {
            if (!isInteracting) promptUI.classList.remove('hidden');
            else promptUI.classList.add('hidden');

            if (isInteracting && !moveForward && !moveBackward && !moveLeft && !moveRight && playerState.isOnGround) {
                document.getElementById('bomb-text').innerText = "正在拆除 C4...";
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 300) * 100}%`;

                if (bombState.plantProgress >= 300) {
                    endRound("你成功拆除了炸弹！", false, 'bomb_defuse');
                    bombState.planted = false;
                    if (bombState.mesh) {
                        const idx = collidableMeshList.indexOf(bombState.mesh);
                        if (idx !== -1) collidableMeshList.splice(idx, 1);
                        scene.remove(bombState.mesh);
                        bombState.mesh.traverse(child => {
                            if (child.isMesh) {
                                if (child.geometry) child.geometry.dispose();
                                if (child.material) {
                                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                                    else child.material.dispose();
                                }
                            }
                        });
                        bombState.mesh = null;
                    }
                    bombUI.classList.add('hidden');
                    playerScore += 20;
                    bombState.plantProgress = 0;
                    const _hs1 = document.getElementById('hud-score');
                    if (_hs1) _hs1.innerText = playerScore;
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
                Math.abs(playerPos.z - zone.mesh.position.z) < 30 &&
                Math.abs(playerPos.y - zone.mesh.position.y) < 5) {
                inZone = true;
            }
        });

        if (inZone) {
            if (!isInteracting) promptUI.classList.remove('hidden');
            else promptUI.classList.add('hidden');

            if (isInteracting && !moveForward && !moveBackward && !moveLeft && !moveRight && playerState.isOnGround) {
                document.getElementById('bomb-text').innerText = "正在安装 C4...";
                bombUI.classList.remove('hidden');
                bombState.plantProgress += 1;
                bombProgUI.style.width = `${(bombState.plantProgress / 180) * 100}%`;

                if (bombState.plantProgress >= 180) {
                    bombState.planted = true;
                    if (!wallhackActive) {
                        activateWallhack("炸弹已安放！全图透视与死斗模式开启！");
                    }
                    bombUI.classList.add('hidden');
                    playerScore += 20;
                    bombState.plantProgress = 0;
                    bombState.timer = 60;
                    const _hs2 = document.getElementById('hud-score');
                    if (_hs2) _hs2.innerText = playerScore;
                    
                    bombState.mesh = createC4();
                    bombState.mesh.position.copy(camera.position);
                    bombState.mesh.position.y = 0.1;
                    
                    bombState.mesh.updateMatrixWorld(true);
                    bombState.mesh.worldBox = new THREE.Box3().setFromObject(bombState.mesh);

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

function detonateC4() {
    if (!roundActive) return;
    const bombPos = bombState.mesh ? bombState.mesh.position.clone() : getPlayerPosition().clone();

    // 1. Play explosion sound
    if (typeof playExplosionSound === 'function') playExplosionSound(bombPos);

    // 2. Detonation visual effects (multi-cluster explosion particles)
    if (typeof createExplosionEffect === 'function') {
        createExplosionEffect(bombPos);
        for (let i = 0; i < 5; i++) {
            const offset = new THREE.Vector3((Math.random() - 0.5) * 8, Math.random() * 5, (Math.random() - 0.5) * 8);
            createExplosionEffect(bombPos.clone().add(offset));
        }
    }

    // 3. Mark round as ended with C4 bomb_explode victory for Terrorists FIRST so checkWinCondition cannot override it
    endRound("C4 炸弹已引爆！恐怖分子获胜", true, 'bomb_explode');

    // 4. Lethal area damage to bots and player
    const c4Radius = 150;
    for (let index = bots.length - 1; index >= 0; index--) {
        const b = bots[index];
        if (b.isDead) continue;
        const dist = b.mesh.position.distanceTo(bombPos);
        if (dist < c4Radius) {
            const dmg = Math.round(500 * (1 - dist / c4Radius));
            b.hp -= dmg;
            if (b.hp <= 0 && typeof killBot === 'function') killBot(index, 'T', 'c4', false);
        }
    }

    if (playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(bombPos);
        if (dist < c4Radius) {
            const dmg = Math.round(500 * (1 - dist / c4Radius));
            if (!playerState.isInvincible) playerState.hp -= dmg;
            if (typeof triggerDamageVignette === 'function') triggerDamageVignette(1.0);
            if (typeof playerState !== 'undefined') playerState.cameraShake = 0.04;
            updateHUD();
            if (playerState.hp <= 0 && typeof playerDie === 'function') playerDie('T', 'c4');
        }
    }

    // 5. Clean up physical bomb mesh and reset state
    if (bombState.mesh) {
        const idx = collidableMeshList.indexOf(bombState.mesh);
        if (idx !== -1) collidableMeshList.splice(idx, 1);
        scene.remove(bombState.mesh);
        bombState.mesh.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            }
        });
        bombState.mesh = null;
    }
    bombState.planted = false;
}

function activateWallhack(msg) {
    wallhackActive = true;
    showAnnouncement(msg, "red");
    
    // Enable X-Ray for all bots
    bots.forEach(bot => {
        bot.mesh.traverse(child => {
            if (child.isMesh && child.material) {
                if (Array.isArray(child.material)) {
                    child.material = child.material.map(mat => {
                        let newMat = mat.clone();
                        newMat.depthTest = false;
                        newMat.depthWrite = false;
                        newMat.transparent = true;
                        newMat.opacity = 0.8;
                        newMat.needsUpdate = true;
                        return newMat;
                    });
                } else {
                    let newMat = child.material.clone();
                    newMat.depthTest = false;
                    newMat.depthWrite = false;
                    newMat.transparent = true;
                    newMat.opacity = 0.8;
                    newMat.needsUpdate = true;
                    child.material = newMat;
                }
                child.renderOrder = 999;
            }
        });
    });
}

// #endregion

