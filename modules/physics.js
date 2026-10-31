// #region 物理与动画循环
// 台阶攀爬高度（每级台阶高2，护栏等矮障碍标记 noClimb 不可攀爬）
const PLAYER_STEP_HEIGHT = 2.6;

// 计算(x,z)处玩家可站立的支撑面高度（脚下水平范围内、顶面不高于maxTop的最高障碍顶）
function getSupportHeight(x, z, maxTop) {
    let support = 0;
    for (const wall of collidableMeshList) {
        if (wall.userData && wall.userData.noClimb) continue;
        const wb = wall.worldBox;
        if (!wb) continue;
        if (x + 0.4 < wb.min.x || x - 0.4 > wb.max.x) continue;
        if (z + 0.4 < wb.min.z || z - 0.4 > wb.max.z) continue;
        if (wb.max.y <= maxTop && wb.max.y > support) support = wb.max.y;
    }
    return support;
}

// 尝试攀爬阻挡物: 全部阻挡物顶面比脚高不超过台阶高度且无 noClimb 标记时踏上
function tryStepUp(blockers, curFeet) {
    if (blockers.length === 0) return -1;
    let maxTop = 0;
    for (const w of blockers) {
        if (w.userData && w.userData.noClimb) return -1;
        const diff = w.worldBox.max.y - curFeet;
        if (diff > PLAYER_STEP_HEIGHT || diff <= -0.1) return -1;
        if (w.worldBox.max.y > maxTop) maxTop = w.worldBox.max.y;
    }
    return maxTop > curFeet + 0.05 ? maxTop : -1;
}

function updatePhysics(delta) {
    if (playerState.isSpectating) return;

    // 生化模式: 新变僵尸适应期倒计时
    if (playerState.zombieSlowTimer > 0) playerState.zombieSlowTimer--;

    // 重力 + 支撑面落地（高台/台阶顶或地面）
    playerState.velocity.y -= 40.0 * delta;
    let nextY = camera.position.y + playerState.velocity.y * delta;
    const feetNow = camera.position.y - 2;
    const support = getSupportHeight(camera.position.x, camera.position.z, feetNow + 0.3);
    const groundY = support + 2;
    if (nextY <= groundY) {
        nextY = groundY;
        playerState.velocity.y = 0;
        playerState.isOnGround = true;
    } else {
        playerState.isOnGround = false;
    }
    camera.position.y = nextY;

    playerState.velocity.x -= playerState.velocity.x * 10.0 * delta;
    playerState.velocity.z -= playerState.velocity.z * 10.0 * delta;

    playerState.direction.z = Number(moveForward) - Number(moveBackward);
    playerState.direction.x = Number(moveRight) - Number(moveLeft);
    playerState.direction.normalize();

    // Melee gives speed boost
    const w = getCurrentWeapon();
    let speedMult = 1.0;
    if (w.id === 'knife') speedMult = 1.5;
    else if (w.id === 'kukri') speedMult = 1.35;
    else if (w.id === 'zombieClaw') {
        speedMult = ZOMBIE.playerSpeedMult;
        if (playerState.zombieSlowTimer > 0) speedMult *= ZOMBIE.newSlowMult;
    }
    else if (w.id === 'gatling') {
        speedMult = 0.75;
        if (isShooting) speedMult = 0.25;
    }
    else if (w.id === 'flamethrower') {
        speedMult = 0.8;
        if (isShooting) speedMult = 0.5;
    }
    else if (w.id === 'mortar') {
        speedMult = 0.7;
    }

    // 生化模式: 肾上腺素期间移速提升
    if (gameMode === 'zombie' && adrenalineFrames > 0) speedMult *= ZOMBIE.adrenalineMult;

    if (moveForward || moveBackward) playerState.velocity.z -= playerState.direction.z * 400.0 * speedMult * delta;
    if (moveLeft || moveRight) playerState.velocity.x -= playerState.direction.x * 400.0 * speedMult * delta;

    // Calculate intended world movement vector
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const forward = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    forward.crossVectors(camera.up, right).normalize();

    const moveX = right.clone().multiplyScalar(-playerState.velocity.x * delta);
    const moveZ = forward.clone().multiplyScalar(-playerState.velocity.z * delta);
    const moveDir = new THREE.Vector3().addVectors(moveX, moveZ);

    // Independent Axis Collision (碰撞盒跟随眼高, 支持高台行走)
    const nextX = camera.position.x + moveDir.x;
    const nextZ = camera.position.z + moveDir.z;

    const playerRadius = 0.4;
    const margin = 0.05;
    const curFeet = camera.position.y - 2;

    const playerBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - playerRadius, camera.position.y - 1.5, camera.position.z - playerRadius + margin),
        new THREE.Vector3(nextX + playerRadius, camera.position.y + 1.5, camera.position.z + playerRadius - margin)
    );
    const blockersX = collidableMeshList.filter(wall => wall.worldBox && wall.worldBox.intersectsBox(playerBoxX));

    if (blockersX.length === 0) {
        camera.position.x = nextX;
    } else {
        const stepTop = tryStepUp(blockersX, curFeet);
        if (stepTop >= 0 && playerState.isOnGround) {
            camera.position.x = nextX;
            camera.position.y = stepTop + 2;
        } else {
            playerState.velocity.x = 0;
        }
    }

    const playerBoxZ = new THREE.Box3(
        new THREE.Vector3(camera.position.x - playerRadius + margin, camera.position.y - 1.5, nextZ - playerRadius),
        new THREE.Vector3(camera.position.x + playerRadius - margin, camera.position.y + 1.5, nextZ + playerRadius)
    );
    const blockersZ = collidableMeshList.filter(wall => wall.worldBox && wall.worldBox.intersectsBox(playerBoxZ));

    if (blockersZ.length === 0) {
        camera.position.z = nextZ;
    } else {
        const stepTop = tryStepUp(blockersZ, curFeet);
        if (stepTop >= 0 && playerState.isOnGround) {
            camera.position.z = nextZ;
            camera.position.y = stepTop + 2;
        } else {
            playerState.velocity.z = 0;
        }
    }

    // Bounding box map limits
    if (camera.position.x < -399) camera.position.x = -399;
    if (camera.position.x > 399) camera.position.x = 399;
    if (camera.position.z < -399) camera.position.z = -399;
    if (camera.position.z > 399) camera.position.z = 399;

    // 动态移动脚步声与落地检测
    const horizSpeed = Math.hypot(playerState.velocity.x, playerState.velocity.z);
    const surfaceType = (support > 0 && typeof currentMap !== 'undefined' && currentMap === 'biolab') ? 'metal' : 'sand';

    if (playerState.isOnGround && horizSpeed > 2.0 && !playerState.isControllingDrone) {
        playerState.footstepDistance = (playerState.footstepDistance || 0) + horizSpeed * delta;
        const isMeleeRun = w && (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'zombieClaw');
        const stepInterval = (horizSpeed > 16 || isMeleeRun) ? 2.8 : 3.8;
        if (playerState.footstepDistance >= stepInterval) {
            playerState.footstepDistance = 0;
            if (typeof playFootstepSound === 'function') {
                playFootstepSound(surfaceType, horizSpeed > 16 ? 0.35 : 0.22);
            }
        }
    } else {
        playerState.footstepDistance = 0;
    }

    // 落地瞬间音效
    if (!playerState.wasOnGround && playerState.isOnGround) {
        if ((playerState.lastAirVy || 0) < -10) {
            if (typeof playLandSound === 'function') {
                playLandSound(surfaceType, 0.45);
            }
        }
    }
    playerState.wasOnGround = playerState.isOnGround;
    if (!playerState.isOnGround) {
        playerState.lastAirVy = playerState.velocity.y;
    }
}

function animate() {
    requestAnimationFrame(animate);
    frameCount++;
    window.frameCount = frameCount;

    let delta = clock.getDelta();
    if (delta > 0.1) delta = 0.1; // Prevent physics explosion on lag/tab switch
    
    // Recoil recovery only for sniper and marksman rifles (every frame)
    const _recoilW = getCurrentWeapon();
    if (_recoilW && _recoilW.id === 'marksman' && !isShooting) {
        playerState.recoilRecovery = 0;
        playerState.recoilRecoveryYaw = 0;
    }
    const _hasRecoilRecovery = _recoilW && (_recoilW.id === 'sniper' || (_recoilW.id === 'marksman' && isShooting));
    if (_hasRecoilRecovery && playerState.recoilRecovery && playerState.recoilRecovery > 0) {
        const rate = playerState.recoilRecoveryRate || 0.15;
        const recoverAmount = Math.min(playerState.recoilRecovery, delta * rate);
        playerState.recoilRecovery -= recoverAmount;

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x -= recoverAmount;

        // Recover yaw recoil
        if (playerState.recoilRecoveryYaw && playerState.recoilRecoveryYaw !== 0) {
            const yawRecover = Math.min(Math.abs(playerState.recoilRecoveryYaw), delta * rate * 0.3);
            const sign = playerState.recoilRecoveryYaw > 0 ? -1 : 1;
            playerState.recoilRecoveryYaw += sign * yawRecover;
            euler.y += sign * yawRecover;
        }

        camera.quaternion.setFromEuler(euler);
    }

    // 开火与受击镜头抖动 (Camera Shake)
    if (playerState.cameraShake && playerState.cameraShake > 0.0001) {
        const shakeYaw = (Math.random() - 0.5) * playerState.cameraShake;
        const shakePitch = (Math.random() - 0.5) * playerState.cameraShake;
        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.y += shakeYaw;
        euler.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.x + shakePitch));
        camera.quaternion.setFromEuler(euler);
        playerState.cameraShake *= 0.82;
    }
    
    // Update zone labels
    const isT = playerState.team === 'T';
    bombZones.forEach((zone) => {
        const labelEl = document.getElementById(zone.labelId || 'zoneA-label');
        if (labelEl) {
            if (gameMode === 'zombie') { labelEl.style.display = 'none'; return; }
            const pos = zone.mesh.position.clone();
            pos.y += 3; 
            pos.project(camera);
            if (pos.z > 1) { 
                labelEl.style.display = 'none';
            } else {
                labelEl.style.display = 'block';
                const x = (pos.x * .5 + .5) * window.innerWidth;
                const y = (pos.y * -.5 + .5) * window.innerHeight;
                labelEl.style.left = x + 'px';
                labelEl.style.top = y + 'px';
                labelEl.innerText = isT ? `${zone.name} 安放区` : `${zone.name} 拆除区`;
            }
        }
    });

    if (playerState.isSpectating) {
        // 生化模式: 僵尸玩家重生倒计时
        if (gameMode === 'zombie' && playerState.isZombie && roundActive && playerState.zombieRespawnTimer > 0) {
            playerState.zombieRespawnTimer--;
            if (playerState.zombieRespawnTimer <= 0) {
                respawnPlayerZombie();
            } else if (playerState.zombieRespawnTimer % 60 === 0) {
                const spEl = document.getElementById('spectator-prompt');
                const h2 = spEl ? spEl.querySelector('h2') : null;
                if (h2) h2.innerText = `僵尸重生倒计时: ${Math.ceil(playerState.zombieRespawnTimer / 60)} 秒`;
            }
        }
        const friendlyBots = bots.filter(b => b.team === playerState.team && !b.isDead);
        if (friendlyBots.length > 0) {
            let specBot = friendlyBots[playerState.spectateIndex];
            if (!specBot) {
                cycleSpectator();
                specBot = friendlyBots[playerState.spectateIndex];
            }
            if (specBot) {
                camera.position.copy(specBot.mesh.position);
                camera.position.y += 3.5;
                camera.rotation.copy(specBot.mesh.rotation);
            }
        }
    } else if (mortarCameraActive) {
        updateMortarCamera(delta);
    } else if (mortarMapOpen) {
        drawMortarMap();
    } else {
        if ((controls && controls.isLocked) || isPlayerControlActive()) {
            if (!playerState.isControllingDrone) {
                updatePhysics(delta);
                handleShooting();
                handleBomb();
            }
        }
    }

    handleWeaponPickup();

    if (typeof updateDronePhysics === 'function') updateDronePhysics(delta);
    updateMortarShells(delta);


    updateBullets(delta);
    updateGrenades(delta);
    updateMines();
    updateParticles(delta);
    updateFloatingDamages(delta);
    updateMagazines(delta);
    if (typeof updateZombieGear === 'function') updateZombieGear(delta);
    updateFires(delta);
    updateSmokes(delta);
    updateWeaponDrops(delta);
    
    // Global Bomb Timer Tick & Progressive Beep
    if (bombState.planted && roundActive) {
        if (frameCount % 60 === 0) {
            bombState.timer--;
            updateHUD();
            
            if (bombState.timer <= 0) {
                if (typeof detonateC4 === 'function') {
                    detonateC4();
                }
            }
        }

        // C4 动态渐进逼近蜂鸣（随剩余时间由慢变急促：40~60s 每秒1响，20~40s 每秒2响，10s内急促连续蜂鸣，与 C4 倒计时严格同步）
        let beepInterval = 60;
        if (bombState.timer <= 10) beepInterval = 8;
        else if (bombState.timer <= 20) beepInterval = 15;
        else if (bombState.timer <= 40) beepInterval = 30;
        else beepInterval = 60;

        if (frameCount % beepInterval === 0 && bombState.timer > 0) {
            const bombPos = bombState.mesh ? bombState.mesh.position : null;
            if (typeof playC4Beep === 'function') {
                playC4Beep(bombPos, bombState.timer <= 10 ? 1250 : 1046.5);
            }
            if (bombState.mesh) {
                let light = bombState.mesh.getObjectByName('c4light');
                if (light && light.material) {
                    light.material.color.setHex(0xff0000);
                    setTimeout(() => {
                        if (light && light.material) light.material.color.setHex(0x330000);
                    }, Math.min(100, (beepInterval / 60) * 500));
                }
            }
        }
    }

    // Burn Damage Tick
    if (roundActive) {
        if (playerState.burnTimer > 0) {
            if (frameCount % 40 === 0 && playerState.hp > 0 && !playerState.isSpectating) {
                if (!playerState.isInvincible) playerState.hp -= applyArmorReduction(3 * playerState.burnStacks);
                if (typeof triggerDamageVignette === 'function') triggerDamageVignette(0.4);
                updateHUD();
                if (playerState.hp <= 0) playerDie(playerState.burnSourceTeam || 'T', 'molotov');
            }
            if (frameCount % 3 === 0 && playerState.hp > 0 && !playerState.isSpectating) {
                createBurnParticle(getPlayerPosition().clone().add(new THREE.Vector3(0, -0.5, 0)));
            }
            playerState.burnTimer--;
            if (playerState.burnTimer <= 0) playerState.burnStacks = 0;
        }

        // 生化模式: 僵尸玩家每秒回血
        if (gameMode === 'zombie' && playerState.isZombie && !playerState.isSpectating && frameCount % 60 === 0 && playerState.hp < playerState.maxHp) {
            playerState.hp = Math.min(playerState.maxHp, playerState.hp + ZOMBIE.regenPerSec);
            updateHUD();
        }

        for (let i = bots.length - 1; i >= 0; i--) {
            let bot = bots[i];
            if (bot.burnTimer > 0) {
                if (!bot.isRed) {
                    bot.isRed = true;
                    bot.mesh.traverse(child => {
                        if (child.isMesh) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach(m => { if (m.emissive) m.emissive.setHex(0xff0000); });
                        }
                    });
                }
                if (frameCount % 40 === 0 && bot.hp > 0) {
                    bot.hp -= 3 * bot.burnStacks * (bot.burnDamageMult || 1) * zombieDmgTakenMult(bot);
                    if (bot.hp <= 0) killBot(i, playerState.team, 'molotov', true);
                }
                if (frameCount % 3 === 0 && bot.hp > 0) {
                    createBurnParticle(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                }
                bot.burnTimer--;
                if (bot.burnTimer <= 0) {
                    bot.burnStacks = 0;
                    if (bot.isRed) {
                        bot.isRed = false;
                        bot.mesh.traverse(child => {
                            if (child.isMesh) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                const defaultEmissive = bot.isZombie ? (bot.isSource ? 0x005500 : 0x003300) : 0x000000;
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(defaultEmissive); });
                            }
                        });
                    }
                }
            }
        }

        // Poison effect processing for bots
        for (let i = bots.length - 1; i >= 0; i--) {
            let bot = bots[i];
            if (bot.poisonTimer > 0) {
                if (!bot.isGreen) {
                    bot.isGreen = true;
                    bot.mesh.traverse(child => {
                        if (child.isMesh) {
                            const mats = Array.isArray(child.material) ? child.material : [child.material];
                            mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x004400); });
                        }
                    });
                }
                if (bot.poisonTickTimer > 0) {
                    bot.poisonTickTimer--;
                }
                if (bot.poisonTickTimer <= 0) {
                    bot.hp -= 3 * zombieDmgTakenMult(bot);
                    bot.poisonTickTimer = 34;
                    if (bot.hp <= 0) killBot(i, playerState.team, 'poison', true);
                }
                if (frameCount % 5 === 0 && bot.hp > 0) {
                    createPoisonParticle(bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                }
                bot.poisonTimer--;
                if (bot.poisonTimer <= 0) {
                    if (bot.isGreen) {
                        bot.isGreen = false;
                        bot.mesh.traverse(child => {
                            if (child.isMesh) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                const defaultEmissive = bot.isZombie ? (bot.isSource ? 0x005500 : 0x003300) : 0x000000;
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(defaultEmissive); });
                            }
                        });
                    }
                }
            }
        }

        if (isShootingRange) {
            rangeTargets.forEach(t => {
                if (t.burnTimer > 0) {
                    if (!t.isRed) {
                        t.isRed = true;
                        t.traverse(child => {
                            if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x550000); });
                            }
                        });
                    }
                    if (frameCount % 40 === 0) {
                        let dmg = 3 * t.burnStacks * (t.burnDamageMult || 1);
                        showFloatingDamage(dmg, t.position);
                    }
                    if (frameCount % 3 === 0) {
                        createBurnParticle(t.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                    }
                    t.burnTimer--;
                    if (t.burnTimer <= 0) {
                        t.burnStacks = 0;
                        if (t.isRed) {
                            t.isRed = false;
                            t.traverse(child => {
                                if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                    const mats = Array.isArray(child.material) ? child.material : [child.material];
                                    mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
                                }
                            });
                        }
                    }
                }
            });

            // Poison effect for range targets
            rangeTargets.forEach(t => {
                if (t.poisonTimer > 0) {
                    if (!t.isGreen) {
                        t.isGreen = true;
                        t.traverse(child => {
                            if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x004400); });
                            }
                        });
                    }
                    if (t.poisonTickTimer > 0) {
                        t.poisonTickTimer--;
                    }
                    if (t.poisonTickTimer <= 0) {
                        showFloatingDamage(3, t.position);
                        t.poisonTickTimer = 34;
                    }
                    if (frameCount % 5 === 0) {
                        createPoisonParticle(t.position.clone().add(new THREE.Vector3(0, 1.5, 0)));
                    }
                    t.poisonTimer--;
                    if (t.poisonTimer <= 0 && t.isGreen) {
                        t.isGreen = false;
                        t.traverse(child => {
                            if (child.isMesh && (child.name === 'rangeTargetBody' || child.name === 'rangeTargetHead')) {
                                const mats = Array.isArray(child.material) ? child.material : [child.material];
                                mats.forEach(m => { if (m.emissive) m.emissive.setHex(0x000000); });
                            }
                        });
                    }
                }
            });
        }
    }

    // Out of Combat Healing Tick (1% per 0.75s after 3s)
    if (frameCount % 45 === 0 && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
        if (frameCount - playerState.lastCombatTime >= 180 && playerState.hp > 0 && playerState.hp < 100) {
            let healAmount = Math.round(100 * 0.01);
            playerState.hp = Math.min(100, playerState.hp + healAmount);
            updateHUD();
        }
    }

    // Knife Healing Tick
    if (frameCount % 60 === 0 && roundActive && !playerState.isSpectating && !playerState.isControllingDrone) {
        let weapon = getCurrentWeapon();
        if ((weapon.id === 'knife' || weapon.id === 'kukri') && playerState.hp > 0 && playerState.hp < 100) {
            let enemyInRange = false;
            
            for (let i = 0; i < bots.length; i++) {
                if (bots[i].hp > 0 && bots[i].team !== playerState.team) {
                    if (bots[i].mesh.position.distanceTo(camera.position) <= weapon.range) {
                        enemyInRange = true;
                        break;
                    }
                }
            }
            if (!enemyInRange) {
                for (let i = 0; i < activeDrones.length; i++) {
                    if (activeDrones[i].hp > 0 && activeDrones[i].team !== playerState.team) {
                        if (activeDrones[i].mesh.position.distanceTo(camera.position) <= weapon.range) {
                            enemyInRange = true;
                            break;
                        }
                    }
                }
            }
            
            if (enemyInRange) {
                let healPercent = 0.02;
                let healAmount = Math.round(100 * healPercent);
                playerState.hp = Math.min(100, playerState.hp + healAmount);
                updateHUD();
            }
        }
    }

    for (let bot of bots) {
        bot._prevPos = bot.mesh.position.clone();
    }
    botAI(delta);
    for (let bot of bots) {
        if (bot._prevPos) {
            bot.velocity = new THREE.Vector3().subVectors(bot.mesh.position, bot._prevPos).divideScalar(delta);
        }
    }
    updateMinimap();
    updateTrajectory();
    
    if (knifeRangeIndicator) {
        const w = getCurrentWeapon();
        if (!playerState.isControllingDrone && (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'flamethrower' || w.id === 'zombieClaw') && roundActive) {
            knifeRangeIndicator.visible = true;
            knifeRangeIndicator.position.copy(camera.position);
            knifeRangeIndicator.position.y = 0.05;
            const scaleRatio = w.range / WEAPONS.knife.range;
            knifeRangeIndicator.scale.setScalar(scaleRatio);
        } else {
            knifeRangeIndicator.visible = false;
        }
    }

    if (predictionMarker) {
        const scopeDef = SCOPE_TYPES[playerState.currentScope];
        const isHighMag = scopeDef && scopeDef.magnification >= 2;

        if (playerState.isAds && playerState.adsProgress >= 0.99 && isHighMag && roundActive && !playerState.isSpectating) {
            const camDir = new THREE.Vector3();
            camera.getWorldDirection(camDir);

            let nearestBot = null;
            let nearestAngle = 0.08;

            for (let bot of bots) {
                if (bot.hp <= 0 || bot.team === playerState.team) continue;
                const botPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                const toBot = botPos.clone().sub(camera.position);
                const dist = toBot.length();
                if (dist > 2000 || dist < 0.1) continue;
                toBot.normalize();
                const dot = Math.max(-1, Math.min(1, camDir.dot(toBot)));
                const angle = Math.acos(dot);
                if (angle < nearestAngle) {
                    raycaster.set(camera.position, toBot);
                    raycaster.far = dist;
                    const walls = raycaster.intersectObjects(collidableMeshList, true);
                    if (walls.length === 0 || walls[0].distance >= dist - 1) {
                        nearestAngle = angle;
                        nearestBot = bot;
                    }
                }
            }

            if (nearestBot) {
                predictionTargetBot = nearestBot;
                predictionGraceTimer = 300;
            }

            if (predictionTargetBot && predictionGraceTimer > 0) {
                if (predictionTargetBot.hp <= 0) {
                    predictionTargetBot = null;
                    predictionGraceTimer = 0;
                    predictionMarker.visible = false;
                } else {
                    if (!nearestBot) predictionGraceTimer--;

                    const weapon = getCurrentWeapon();
                    let bulletSpeed = 527.34375;
                    if (weapon.id === 'sniper') bulletSpeed = 1230.46875;
                    else if (weapon.id === 'marksman') bulletSpeed = 1031.25;
                    else if (weapon.id === 'deagle') bulletSpeed = 685.546875;

                    const _predHasBulletType = function(type) {
                        if (playerState.bulletStacking && playerState.bulletTypes) return playerState.bulletTypes.includes(type);
                        return playerState.bulletType === type;
                    };
                    if (_predHasBulletType('tracking')) bulletSpeed *= 0.135;
                    if (_predHasBulletType('light')) bulletSpeed *= 1.2;
                    if (_predHasBulletType('dual')) bulletSpeed *= 0.35;

                    const botPos = predictionTargetBot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                    const dist = camera.position.distanceTo(botPos);
                    let time = dist / bulletSpeed;
                    let predictedPos = botPos.clone().add(predictionTargetBot.velocity.clone().multiplyScalar(time));
                    let dist2 = camera.position.distanceTo(predictedPos);
                    let time2 = dist2 / bulletSpeed;
                    predictedPos = botPos.clone().add(predictionTargetBot.velocity.clone().multiplyScalar(time2));

                    predictionMarker.position.copy(predictedPos);
                    predictionMarker.lookAt(camera.position);
                    predictionMarker.visible = true;
                }
            } else {
                predictionMarker.visible = false;
            }
        } else {
            predictionMarker.visible = false;
            predictionTargetBot = null;
            predictionGraceTimer = 0;
        }
    }
    
    // Procedural Knife Swing Animation
    if (playerState.viewModel && (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade' || getCurrentWeapon().id === 'zombieClaw')) {
        const now = performance.now();
        let animDuration = (getCurrentWeapon().fireRate / 60) * 1000; // ms
        if (getCurrentWeapon().id === 'switchblade' && playerState.knifeAnimStage === 2) animDuration = 800;
        const elapsed = now - (playerState.knifeAnimStart || 0);
        
        let targetPosX = 0.35;
        let targetPosY = -0.25;
        let targetPosZ = -0.5;
        let targetRotX = 0;
        let targetRotY = -Math.PI / 8;
        let targetRotZ = 0;

        if (elapsed < animDuration) {
            let t = elapsed / animDuration;
            let slashProg = t < 0.3 ? t / 0.3 : 1.0 - ((t - 0.3) / 0.7);
            let ease = 1 - Math.pow(1 - slashProg, 3); // Cubic ease out

            if (getCurrentWeapon().id === 'kukri') {
                if (playerState.knifeAnimStage === 0) {
                    // Kukri Diagonal downward chop
                    targetPosX -= ease * 0.2;
                    targetPosY -= ease * 0.4;
                    targetPosZ -= ease * 0.4;
                    targetRotX -= ease * 0.6;
                    targetRotY += ease * 0.5;
                    targetRotZ -= ease * 0.4;
                } else if (playerState.knifeAnimStage === 1) {
                    // Kukri Backhand upward slash
                    targetPosX += ease * 0.3;
                    targetPosY += ease * 0.3;
                    targetPosZ -= ease * 0.2;
                    targetRotX += ease * 0.5;
                    targetRotY -= ease * 0.8;
                    targetRotZ += ease * 0.5;
                } else {
                    // Kukri Heavy overhead strike
                    targetPosY += ease * 0.5;
                    targetPosZ -= ease * 0.5;
                    targetRotX -= ease * 1.2;
                    targetRotY -= ease * 0.2;
                }
            } else if (getCurrentWeapon().id === 'switchblade') {
                if (playerState.knifeAnimStage === 0) {
                    // 1. Straight forward stab (正着的戳击)
                    targetPosZ -= ease * 0.8;
                } else if (playerState.knifeAnimStage === 2) {
                    // 3. Diagonal downward stab (左上到右下) with a pause
                    let customPosX = 0, customPosY = 0, customPosZ = 0;
                    let customRotX = 0, customRotY = 0;
                    if (t < 0.1875) { // 150ms windup
                        let wt = t / 0.1875;
                        let we = 1 - Math.pow(1 - wt, 2);
                        customPosX = -0.6 * we; 
                        customPosY = 0.4 * we;
                        customPosZ = 0.2 * we;
                        customRotX = 0.5 * we;
                        customRotY = 0.4 * we;
                    } else if (t < 0.8125) { // 500ms pause
                        customPosX = -0.6; 
                        customPosY = 0.4;
                        customPosZ = 0.2;
                        customRotX = 0.5; 
                        customRotY = 0.4;
                    } else if (t < 0.9) { // 70ms strike
                        let st = (t - 0.8125) / 0.0875;
                        let se = 1 - Math.pow(1 - st, 3);
                        customPosX = -0.6 * (1 - se) + 0.1 * se;
                        customPosY = 0.4 * (1 - se) - 0.3 * se;
                        customPosZ = 0.2 * (1 - se) - 0.8 * se;
                        customRotX = 0.5 * (1 - se) - 0.8 * se;
                        customRotY = 0.4 * (1 - se) - 0.2 * se;
                    } else { // 80ms return
                        let rt = (t - 0.9) / 0.1;
                        let re = 1 - Math.pow(rt, 2);
                        customPosX = 0.1 * re;
                        customPosY = -0.3 * re;
                        customPosZ = -0.8 * re;
                        customRotX = -0.8 * re;
                        customRotY = -0.2 * re;
                    }
                    targetPosX += customPosX;
                    targetPosY += customPosY;
                    targetPosZ += customPosZ;
                    targetRotX += customRotX;
                    targetRotY += customRotY;
                } else {
                    // 2. Straight forward stab in the dead center (正中间往前的戳击)
                    targetPosX -= ease * 0.35;
                    targetPosZ -= ease * 0.9;
                    targetRotY += ease * (Math.PI / 8);
                }
            } else {
                if (playerState.knifeAnimStage === 0) {
                    // Slash Left
                    targetPosX -= ease * 0.3;
                    targetPosZ -= ease * 0.3;
                    targetRotX += ease * 0.4;
                    targetRotY += ease * 1.2;
                    targetRotZ += ease * 0.2;
                } else if (playerState.knifeAnimStage === 1) {
                    // Slash Right (Sweep back)
                    targetPosX += ease * 0.4;
                    targetPosY -= ease * 0.1;
                    targetPosZ -= ease * 0.3;
                    targetRotX += ease * 0.3;
                    targetRotY -= ease * 1.5;
                    targetRotZ -= ease * 0.3;
                } else {
                    // Heavy Stab Forward
                    targetPosY += ease * 0.2;
                    targetPosZ -= ease * 0.6;
                    targetRotX -= ease * 0.2;
                    targetRotZ += ease * 0.1;
                }
            }
        }
        
        playerState.viewModel.position.set(targetPosX, targetPosY, targetPosZ);
        playerState.viewModel.rotation.set(targetRotX, targetRotY, targetRotZ);
    }

    // Spread calculation
    const weapon = getCurrentWeapon();
    let baseSpread = (weapon.spread || 0.05) * 1000;
    
    if (weapon.id === 'sniper' && !playerState.isAds) {
        baseSpread = 150; // Huge hip fire spread for AWP
    }
    if (weapon.id === 'shotgun') {
        baseSpread = 12.8; // Reduced hip fire spread for shotgun
    }
    
    if (playerState.isAds) {
        baseSpread *= 0.1;
    } else {
        if (!playerState.isOnGround) {
            if (weapon.id === 'gatling') {
                baseSpread *= 5.0 * 0.25;
            } else if (weapon.id === 'smg' || weapon.id === 'shotgun') {
                baseSpread *= 5.0;
            } else if (weapon.id === 'pistol') {
                baseSpread *= 7.5;
            } else {
                baseSpread *= 10.0;
            }
        } else if (moveForward || moveBackward || moveLeft || moveRight) {
            if (weapon.id === 'gatling') {
                baseSpread *= 2.5 * 0.25;
            } else if (weapon.id === 'smg' || weapon.id === 'shotgun') {
                baseSpread *= 2.5;
            } else if (weapon.id === 'pistol') {
                baseSpread *= 3.75;
            } else {
                baseSpread *= 5.0;
            }
        } else {
            if (weapon.id === 'gatling') {
                baseSpread *= 0.6 * 0.25;
            } else {
                baseSpread *= 0.6;
            }
        }
        if (isShooting && !isReloading && controls && (controls.isLocked || isPlayerControlActive())) {
            if (weapon.id === 'gatling') {
                baseSpread += 8 * 0.25;
            } else {
                baseSpread += 8;
            }
        }
    }

    if (weapon.id === 'gatling') {
        baseSpread *= 0.5;
    }

    currentSpread += (baseSpread - currentSpread) * 0.2;
    
    if (document.getElementById('ch-top')) {
        let gap = currentSpread;
        if (weapon.id === 'gatling') gap *= 0.25;
        document.getElementById('ch-top').style.top = `calc(50% - ${gap}px - 5px)`;
        document.getElementById('ch-bottom').style.top = `calc(50% + ${gap}px + 5px)`;
        document.getElementById('ch-left').style.left = `calc(50% - ${gap}px - 5px)`;
        document.getElementById('ch-right').style.left = `calc(50% + ${gap}px + 5px)`;
    }
    
    // View model bobbing & ADS animation
    if (!playerState.isSpectating && !mortarCameraActive && !mortarMapOpen && playerState.viewModel && controls && (controls.isLocked || isPlayerControlActive())) {
        if (playerState.isAds) {
            playerState.adsProgress += delta * 8;
            if (playerState.adsProgress > 1) playerState.adsProgress = 1;
        } else {
            playerState.adsProgress -= delta * 8;
            if (playerState.adsProgress < 0) playerState.adsProgress = 0;
        }

        const w = getCurrentWeapon();
        let finalFov = 75;
        let overlayType = 'none';
        if (w.id === 'sniper' || w.id === 'marksman') {
            const scopeDef = SCOPE_TYPES[playerState.currentScope];
            if (scopeDef && (scopeDef.overlayType === 'magnified' || scopeDef.overlayType === 'redDot' || scopeDef.overlayType === 'holo')) {
                finalFov = scopeDef.fov;
                overlayType = scopeDef.overlayType;
            } else {
                finalFov = (w.id === 'sniper') ? 10 : 15;
                overlayType = 'sniper';
            }
        }
        else if (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'flamethrower' || w.id === 'mortar' || w.id === 'zombieClaw') { finalFov = 75; overlayType = 'none'; }
        else {
            const scopeDef = SCOPE_TYPES[playerState.currentScope] || SCOPE_TYPES.redDot;
            finalFov = scopeDef.fov;
            overlayType = scopeDef.overlayType;
        }

        const ease = 1 - Math.pow(1 - playerState.adsProgress, 3);
        camera.fov = 75 + (finalFov - 75) * ease;
        camera.updateProjectionMatrix();

        const scopeOverlay = document.getElementById('scope-overlay');
        const magOverlay = document.getElementById('mag-scope-overlay');
        const crosshair = document.getElementById('crosshair');
        const redDot = document.getElementById('red-dot-sight');
        const holoSight = document.getElementById('holo-sight');

        if (playerState.adsProgress >= 0.99) {
            if (overlayType === 'sniper') {
                playerState.viewModel.visible = false;
                if (scopeOverlay) scopeOverlay.classList.remove('hidden');
            } else if (overlayType === 'magnified') {
                playerState.viewModel.visible = false;
                const scopeDef = SCOPE_TYPES[playerState.currentScope];
                if (magOverlay && scopeDef) {
                    magOverlay.style.setProperty('--scope-r', scopeDef.scopeRadius + 'px');
                    magOverlay.classList.remove('hidden');
                }
            } else if (overlayType === 'redDot') {
                if (redDot) redDot.classList.remove('hidden');
            } else if (overlayType === 'holo') {
                if (holoSight) holoSight.classList.remove('hidden');
            }
            const buyMenu = document.getElementById('buy-menu');
            if (buyMenu && !buyMenu.classList.contains('hidden')) {
                closeBuyMenu();
            }
            const weaponInv = document.querySelector('.weapon-inventory');
            if (weaponInv) weaponInv.style.display = 'none';
            if (crosshair) {
                if (dropCompensationActive && dropCompensationOffset > 0) {
                    crosshair.classList.remove('hidden');
                    const lines = crosshair.querySelectorAll('.ch-line');
                    lines.forEach(l => l.style.display = 'none');
                    const dot = document.getElementById('ch-dot');
                    if (dot) dot.style.display = '';
                } else {
                    crosshair.classList.add('hidden');
                }
            }
        } else {
            playerState.viewModel.visible = true;
            if (scopeOverlay) scopeOverlay.classList.add('hidden');
            if (magOverlay) magOverlay.classList.add('hidden');
            if (redDot) redDot.classList.add('hidden');
            if (holoSight) holoSight.classList.add('hidden');
            if (crosshair) {
                crosshair.classList.remove('hidden');
                const lines = crosshair.querySelectorAll('.ch-line');
                lines.forEach(l => l.style.display = '');
            }
            const weaponInv = document.querySelector('.weapon-inventory');
            if (weaponInv) weaponInv.style.display = '';
        }

        const isMeleeW = w && (w.id === 'knife' || w.id === 'kukri' || w.id === 'switchblade' || w.id === 'zombieClaw');
        if (!playerState.isInspecting && !isMeleeW) {
            const hipX = 0.3, hipY = -0.3, hipZ = -0.5;
            const adsX = 0, adsY = -0.156, adsZ = -0.1125;
            
            const currentBaseX = hipX + (adsX - hipX) * ease;
            let currentBaseY = hipY + (adsY - hipY) * ease;
            const currentBaseZ = hipZ + (adsZ - hipZ) * ease;

            playerState.viewModel.position.z = currentBaseZ;

            // 自然武器摆动 (Weapon Sway) 与移动晃动 (采用相位累加，杜绝大帧数抖动)
            const horizSpeed = Math.hypot(playerState.velocity.x, playerState.velocity.z);
            if (horizSpeed > 1.5 && !playerState.isAds) {
                const swaySpeed = Math.min(0.35, 0.14 + horizSpeed * 0.005);
                const swayAmpX = Math.min(0.025, 0.008 + horizSpeed * 0.0006);
                const swayAmpY = Math.min(0.02, 0.006 + horizSpeed * 0.0005);
                playerState.swayPhase = (playerState.swayPhase || 0) + swaySpeed;
                playerState.viewModel.position.x = currentBaseX + Math.sin(playerState.swayPhase * 0.5) * swayAmpX;
                playerState.viewModel.position.y = currentBaseY + Math.abs(Math.sin(playerState.swayPhase)) * swayAmpY;
            } else {
                playerState.viewModel.position.x = currentBaseX;
                playerState.viewModel.position.y = currentBaseY;
            }
        }

        if (w.id === 'gatling' && playerState.viewModel) {
            const barrelGroup = playerState.viewModel.getObjectByName('gatlingBarrels');
            if (barrelGroup) {
                if (isShooting && !isReloading) {
                    playerState.gatlingBarrelSpin = Math.min(30, (playerState.gatlingBarrelSpin || 0) + delta * 80);
                } else {
                    playerState.gatlingBarrelSpin = (playerState.gatlingBarrelSpin || 0) * 0.92;
                    if (playerState.gatlingBarrelSpin < 0.01) playerState.gatlingBarrelSpin = 0;
                }
                barrelGroup.rotation.z += (playerState.gatlingBarrelSpin || 0) * delta;
            }
        }
    }
    
    // Weapon Inspect Animation
    if (playerState.viewModel && playerState.isInspecting) {
        const now = performance.now();
        const elapsed = now - playerState.inspectStartTime;
        const inspectDuration = 3500; 

        if (elapsed > inspectDuration) {
            playerState.isInspecting = false;
            const curW = getCurrentWeapon();
            const curIsMelee = curW && (curW.id === 'knife' || curW.id === 'kukri' || curW.id === 'switchblade' || curW.id === 'zombieClaw');
            if (!curIsMelee) {
                playerState.viewModel.rotation.set(0, 0, 0);
                playerState.viewModel.position.set(0.3, -0.3, -0.5);
            }
        } else {
            let t = elapsed / inspectDuration;
            
            if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade') {
                let customRotX = 0, customRotY = 0, customRotZ = 0;
                let customPosX = 0, customPosY = 0, customPosZ = 0;
                
                if (t < 0.2) {
                    let st = t / 0.2;
                    let ease = 1 - Math.pow(1 - st, 2);
                    customRotZ += ease * Math.PI * 2;
                    customPosY += Math.sin(st * Math.PI) * 0.2;
                } else if (t < 0.8) {
                    let st = (t - 0.2) / 0.6;
                    let admireEase = Math.sin(st * Math.PI);
                    customRotY += admireEase * 2.0;
                    customRotX += admireEase * 0.5;
                    customPosX -= admireEase * 0.2;
                    customPosZ += admireEase * 0.25;
                    customPosY += admireEase * 0.2;
                } else {
                    let st = (t - 0.8) / 0.2;
                    let ease = st * st;
                    customRotZ -= (1 - ease) * Math.PI * 2;
                    customPosY += Math.sin(st * Math.PI) * 0.1;
                }
                
                playerState.viewModel.rotation.x += customRotX;
                playerState.viewModel.rotation.y += customRotY;
                playerState.viewModel.rotation.z += customRotZ;
                playerState.viewModel.position.x += customPosX;
                playerState.viewModel.position.y += customPosY;
                playerState.viewModel.position.z += customPosZ;
            } else {
                let gunRotX = 0, gunRotY = 0, gunRotZ = 0;
                let gunPosX = 0, gunPosY = 0, gunPosZ = 0;
                
                if (t < 0.2) {
                    let st = t / 0.2;
                    let se = 1 - Math.pow(1 - st, 2);
                    gunRotY = se * 1.5;
                    gunRotZ = se * 0.2;
                    gunPosX = -se * 0.1;
                    gunPosZ = se * 0.15;
                    gunPosY = se * 0.15;
                } else if (t < 0.4) {
                    let st = (t - 0.2) / 0.2;
                    gunRotY = 1.5 + Math.sin(st * Math.PI) * 0.1;
                    gunRotZ = 0.2;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                } else if (t < 0.6) {
                    let st = (t - 0.4) / 0.2;
                    let smooth = st * st * (3 - 2 * st);
                    gunRotY = 1.5 * (1 - smooth) + (-1.5 * smooth);
                    gunRotZ = 0.2 * (1 - smooth) + (-0.2 * smooth);
                    gunRotX = Math.sin(smooth * Math.PI) * 0.3;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                } else if (t < 0.8) {
                    let st = (t - 0.6) / 0.2;
                    gunRotY = -1.5 - Math.sin(st * Math.PI) * 0.1;
                    gunRotZ = -0.2;
                    gunPosX = -0.1;
                    gunPosZ = 0.15;
                    gunPosY = 0.15;
                    gunPosZ = 0.15;
                } else {
                    let st = (t - 0.8) / 0.2;
                    let se = 1 - Math.pow(st, 2);
                    gunRotY = -1.5 * se;
                    gunRotZ = -0.2 * se;
                    gunPosX = -0.1 * se;
                    gunPosZ = 0.15 * se;
                    gunPosY = 0.15 * se;
                }
                
                playerState.viewModel.rotation.set(gunRotX, gunRotY, gunRotZ);
                playerState.viewModel.position.x = 0.3 + gunPosX;
                playerState.viewModel.position.z = -0.5 + gunPosZ;
                playerState.viewModel.position.y += gunPosY;
            }
        }
    } else if (playerState.viewModel && getCurrentWeapon().id !== 'knife' && getCurrentWeapon().id !== 'kukri' && getCurrentWeapon().id !== 'switchblade') {
         playerState.viewModel.rotation.set(0,0,0);
    }
    
    // Dragon fire animation
    if (playerState.viewModel) {
        let df = playerState.viewModel.getObjectByName('dragonFire');
        if (df) {
            df.children.forEach(spark => {
                spark.position.y += Math.random() * 0.015;
                spark.position.x += (Math.random()-0.5) * 0.01;
                if (spark.position.y > 0.1) {
                    spark.position.set((Math.random()-0.5)*0.1, (Math.random()-0.5)*0.1, (Math.random()-0.5)*0.2);
                    spark.material.color.setHex(Math.random() > 0.5 ? 0xff5500 : 0xffaa00);
                }
            });
        }
    }

    // Bullet drop compensation: lock dot at fixed downward offset (only in ADS)
    if (dropCompensationActive && dropCompensationOffset > 0 && playerState.adsProgress >= 0.99) {
        const dot = document.getElementById('ch-dot');
        if (dot) dot.style.transform = 'translate(-50%, calc(-50% + ' + dropCompensationOffset + 'px))';
    } else {
        const dot = document.getElementById('ch-dot');
        if (dot) dot.style.transform = 'translate(-50%, -50%)';
    }

    renderer.render(scene, camera);
}


// #endregion
