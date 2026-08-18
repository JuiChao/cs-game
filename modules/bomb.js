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
                Math.abs(playerPos.z - zone.mesh.position.z) < 30) {
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

function updateHUD() {
    if (document.getElementById('hud-score')) {
        document.getElementById('hud-score').innerText = playerScore;
    }
    document.getElementById('hp-val').innerText = playerState.hp;
    document.getElementById('hp-fill').style.width = `${Math.max(0, playerState.hp)}%`;
    
    if (playerState.isControllingDrone) {
        document.querySelector('.weapon-inventory').style.display = 'none';
        document.querySelector('.hud-right').style.display = 'flex';
    } else {
        document.querySelector('.weapon-inventory').style.display = 'flex';
        document.querySelector('.hud-right').style.display = 'flex';
    }
    
    const w = getCurrentWeapon();
    document.getElementById('weapon-name').innerText = w.name;

    const btDisplay = document.getElementById('bullet-type-display');
    if (btDisplay) {
        const bt = BULLET_TYPES[playerState.bulletType || 'normal'];
        btDisplay.innerText = bt ? bt.name : '普通子弹';
        btDisplay.style.color = (playerState.bulletType === 'incendiary') ? '#ff6600' :
                                (playerState.bulletType === 'poison') ? '#44ff00' :
                                (playerState.bulletType === 'proximity') ? '#ffaa00' : '#aaa';
    }
    
    if (w.id === 'knife') {
        document.getElementById('ammo-clip').innerText = '-';
        document.getElementById('ammo-reserve').innerText = '-';
    } else if (['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'].includes(w.id)) {
        document.getElementById('ammo-clip').innerText = inventory.grenades[w.id];
        document.getElementById('ammo-reserve').innerText = '-';
    } else {
        let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : ammoState.secondary;
        document.getElementById('ammo-clip').innerText = currentAmmo.clip;
        document.getElementById('ammo-reserve').innerText = currentAmmo.reserve;
    }
    
    if (bombState.planted) {
        document.getElementById('round-timer').innerText = `00:${bombState.timer.toString().padStart(2, '0')}`;
        document.getElementById('round-timer').style.color = '#ff3c3c';
    } else {
        const mins = Math.floor(roundTime / 60);
        const secs = roundTime % 60;
        document.getElementById('round-timer').innerText = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        document.getElementById('round-timer').style.color = '#fff';
    }
    
    const buyPrompt = document.getElementById('buy-prompt');
    if (roundTime > 225 && isPlayerInSpawn() && !playerState.isSpectating && roundActive) {
        buyPrompt.classList.remove('hidden');
    } else {
        buyPrompt.classList.add('hidden');
    }

    checkWinCondition(); // Updates top scores
    if (typeof updateArmorHUD === 'function') updateArmorHUD();
}

function triggerDroneExplosion(drone) {
    const pos = drone.targetIndicator.position;
    createHitEffect(pos, false);
    for (let index = bots.length - 1; index >= 0; index--) {
        const b = bots[index];
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (b.team !== drone.team) {
                b.hp -= dmg * 0.75;
                if (b.hp <= 0) killBot(index, drone.team, 'drone');
            }
        }
    }
    
    if (isShootingRange) {
        rangeTargets.forEach(t => {
            const dist = t.position.distanceTo(pos);
            if (dist < 29.25) {
                const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
                if (dmg > 0) showFloatingDamage(dmg, t.position);
            }
        });
    }
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (playerState.team !== drone.team) {
                let actualDmg = dmg * 0.75;
                if (getCurrentWeapon().id === 'kukri' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) actualDmg *= 0.025;
                else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.05;
                if (!playerState.isInvincible) playerState.hp -= Math.ceil(applyArmorReduction(actualDmg));
                playerState.lastCombatTime = frameCount;
                if (playerState.hp <= 0) playerDie(drone.team, 'drone');
            }
        }
    }
}

function updateDronePhysics(delta) {
    for (let index = activeDrones.length - 1; index >= 0; index--) {
        let drone = activeDrones[index];
        // Indicator
        raycaster.set(drone.mesh.position, new THREE.Vector3(0, -1, 0));
        let targets = bots.map(b => b.mesh).concat(collidableMeshList);
        const intersects = raycaster.intersectObjects(targets);
        let groundY = 0;
        if (intersects.length > 0) groundY = intersects[0].point.y;
        
        drone.targetIndicator.position.set(drone.mesh.position.x, groundY + 0.1, drone.mesh.position.z);
    
        if (drone.selfDestructing) {
            drone.targetIndicator.visible = true; // Keep it visible so players can judge the range
            if (drone.mesh.position.y <= groundY + 2.0) {
                destroyDrone(drone, true);
                continue; 
            }
        } else {
            drone.targetIndicator.visible = true;
        }
    
        drone.velocity.x -= drone.velocity.x * 5.0 * delta;
        drone.velocity.y -= drone.velocity.y * 5.0 * delta;
        drone.velocity.z -= drone.velocity.z * 5.0 * delta;
    
        if (drone.isPlayer) {
            let dirZ = Number(moveForward) - Number(moveBackward);
            let dirX = Number(moveRight) - Number(moveLeft);
            let dirY = Number(moveUp) - Number(moveDown);
        
            if (drone.selfDestructing) {
                dirY = 0; 
                drone.velocity.y = -78.125; 
                if (!drone.selfDestructBoosted) {
                    drone.velocity.x *= 1.75;
                    drone.velocity.z *= 1.75;
                    drone.selfDestructBoosted = true;
                }
            }

            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            forward.crossVectors(camera.up, right).normalize();
        
            let currentSpeed = drone.selfDestructing ? 437.5 : 250.0;
            if (dirZ !== 0) drone.velocity.add(forward.clone().multiplyScalar(dirZ * currentSpeed * delta));
            if (dirX !== 0) drone.velocity.add(right.clone().multiplyScalar(dirX * currentSpeed * delta));
            if (dirY !== 0) drone.velocity.y += dirY * 250.0 * delta;
        
            camera.position.add(drone.velocity.clone().multiplyScalar(delta));
            
            // Bounds
            if (camera.position.y < 2) { camera.position.y = 2; drone.velocity.y = 0; }
            if (camera.position.x < -399) camera.position.x = -399;
            if (camera.position.x > 399) camera.position.x = 399;
            if (camera.position.z < -399) camera.position.z = -399;
            if (camera.position.z > 399) camera.position.z = 399;
        
            drone.mesh.position.copy(camera.position);
        } else {
            // Bot drone logic
            let nearestEnemyPos = null;
            let minDist = Infinity;
            if (drone.team !== playerState.team && playerState.hp > 0 && !playerState.isSpectating) {
                nearestEnemyPos = getPlayerPosition().clone();
                minDist = drone.mesh.position.distanceTo(nearestEnemyPos);
            }
            bots.forEach(b => {
                if (b.team !== drone.team && b.hp > 0) {
                    const dist = drone.mesh.position.distanceTo(b.mesh.position);
                    if (dist < minDist) {
                        minDist = dist;
                        nearestEnemyPos = b.mesh.position.clone();
                    }
                }
            });
            
            if (nearestEnemyPos) {
                if (minDist < 20) {
                    drone.selfDestructing = true;
                } else {
                    if (minDist < 80 && Math.random() < 0.01) {
                        const gType = ['hegrenade', 'flashbang', 'molotov'][Math.floor(Math.random() * 3)];
                        const dir = new THREE.Vector3().subVectors(nearestEnemyPos, drone.mesh.position).normalize();
                        dir.y += 0.2;
                        dir.normalize();
                        createGrenade(drone.mesh.position.clone(), dir, gType, drone.team, true);
                    }
                    const dir = new THREE.Vector3().subVectors(nearestEnemyPos, drone.mesh.position).normalize();
                    drone.velocity.add(dir.multiplyScalar(250.0 * delta));
                    // maintain altitude slightly above enemy
                    drone.velocity.y += ((nearestEnemyPos.y + 5) - drone.mesh.position.y) * 5.0 * delta;
                }
            } else {
                drone.selfDestructing = true;
            }
            
            drone.mesh.position.add(drone.velocity.clone().multiplyScalar(delta));
            if (drone.mesh.position.y < 2) { drone.mesh.position.y = 2; drone.velocity.y = 0; }
        }
    }
}

// #endregion
