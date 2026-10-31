// #region Bot AI
const BOT_CLIMB_HEIGHT = 2.05; // Bot 单步平滑踏步跨越判定（<= 2.0 单位高度差）

// Bot 脚下支撑面高度: 忽略护栏, 只统计顶面不超过脚+攀爬高度的障碍
function getBotSupportHeight(x, z, feetY) {
    let support = 0;
    for (const mesh of collidableMeshList) {
        if (!mesh.worldBox) continue;
        if (mesh.userData && mesh.userData.noClimb) continue;
        const wb = mesh.worldBox;
        if (x + 0.4 < wb.min.x || x - 0.4 > wb.max.x) continue;
        if (z + 0.4 < wb.min.z || z - 0.4 > wb.max.z) continue;
        if (wb.max.y <= feetY + 0.4 && wb.max.y > support) support = wb.max.y;
    }
    return support;
}

// Bot Y 平滑跟随地形（上台阶/高台行走/离台坠落）- 推广至所有模式
function updateBotGroundY(b, delta) {
    const support = getBotSupportHeight(b.mesh.position.x, b.mesh.position.z, b.mesh.position.y);
    const y = b.mesh.position.y;
    if (Math.abs(support - y) < 0.05) {
        if (y !== support) b.mesh.position.y = support;
        return;
    }
    const rate = support < y ? 0.35 : 0.25; // 下落略快于爬升
    b.mesh.position.y = y + (support - y) * Math.min(1, rate * 60 * delta);
}

// 尝试踏上阻挡物: 全部阻挡物可攀(≤脚+2.0且非护栏)时返回踏面高度, 否则-1
function botTryStepUp(blockers, feetY) {
    let maxTop = feetY;
    for (const w of blockers) {
        if (w.userData && w.userData.noClimb) return -1;
        const diff = w.worldBox.max.y - feetY;
        if (diff > BOT_CLIMB_HEIGHT || diff < -3.0) return -1;
        if (w.worldBox.max.y > maxTop) maxTop = w.worldBox.max.y;
    }
    return maxTop > feetY + 0.05 ? maxTop : -1;
}

function moveBotWithCollision(bot, moveVector) {
    const nextX = bot.mesh.position.x + moveVector.x;
    const nextZ = bot.mesh.position.z + moveVector.z;
    const feetY = bot.mesh.position.y;
    const canClimb = true;

    const margin = 0.05;

    const botBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - 0.4, feetY + 0.5, bot.mesh.position.z - 0.4 + margin),
        new THREE.Vector3(nextX + 0.4, feetY + 3.5, bot.mesh.position.z + 0.4 - margin)
    );
    const blockersX = collidableMeshList.filter(wall => wall.worldBox && wall.worldBox.intersectsBox(botBoxX));

    let movedX = false;
    if (blockersX.length === 0) {
        bot.mesh.position.x = nextX;
        movedX = true;
    } else if (canClimb) {
        const stepTop = botTryStepUp(blockersX, feetY);
        if (stepTop >= 0) {
            bot.mesh.position.x = nextX;
            bot.mesh.position.y = stepTop;
            movedX = true;
        }
    }

    const curFeetY = bot.mesh.position.y;
    const botBoxZ = new THREE.Box3(
        new THREE.Vector3(bot.mesh.position.x - 0.4 + margin, curFeetY + 0.5, nextZ - 0.4),
        new THREE.Vector3(bot.mesh.position.x + 0.4 - margin, curFeetY + 3.5, nextZ + 0.4)
    );
    const blockersZ = collidableMeshList.filter(wall => wall.worldBox && wall.worldBox.intersectsBox(botBoxZ));

    let movedZ = false;
    if (blockersZ.length === 0) {
        bot.mesh.position.z = nextZ;
        movedZ = true;
    } else if (canClimb) {
        const stepTop = botTryStepUp(blockersZ, curFeetY);
        if (stepTop >= 0) {
            bot.mesh.position.z = nextZ;
            bot.mesh.position.y = stepTop;
            movedZ = true;
        }
    }

    return movedX || movedZ;
}

// ── 生化模式: 僵尸 Bot AI（追踪最近人类 + 利爪感染） ──
function zombieBotAI(b, delta) {
    // 新变僵尸适应期倒计时（30秒移速减半）
    if (b.zombieSlowTimer > 0) b.zombieSlowTimer--;

    // 僵尸缓慢回血
    if (frameCount % 60 === 0 && b.hp < b.maxHp) {
        b.hp = Math.min(b.maxHp, b.hp + ZOMBIE.regenPerSec);
    }

    const botPos = b.mesh.position;

    // 寻找最近人类（玩家或人类Bot），僵尸嗅觉穿墙感知
    let target = null;
    let targetBot = null;
    let targetIsPlayer = false;
    let minDist = Infinity;

    if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== 'ZOMBIE') {
        const d = botPos.distanceTo(getPlayerPosition());
        if (d < minDist) { minDist = d; target = getPlayerPosition(); targetIsPlayer = true; }
    }

    bots.forEach(other => {
        if (other === b || other.isDead || other.team === 'ZOMBIE' || other.hp <= 0) return;
        const d = botPos.distanceTo(other.mesh.position);
        if (d < minDist) { minDist = d; target = other.mesh.position; targetBot = other; targetIsPlayer = false; }
    });

    if (!target) {
        // 无目标: 随机游荡
        if (!b.targetNode || botPos.distanceTo(b.targetNode) < 10) {
            b.targetNode = new THREE.Vector3((Math.random() - 0.5) * 760, 0, (Math.random() - 0.5) * 760);
            b.path = null;
        }
    } else {
        // 感染攻击（利爪范围内且高度接近, 隔着高台地板不能感染）
        const heightGap = Math.abs(target.y - botPos.y);
        if (minDist < ZOMBIE.attackRange && heightGap < 5) {
            b.mesh.lookAt(target.x, botPos.y, target.z);
            if (roundActive && frameCount - (b.lastZombieAttack || 0) >= ZOMBIE.attackCooldown) {
                b.lastZombieAttack = frameCount;
                if (typeof playKnifeSound === 'function') playKnifeSound('swing1');
                if (targetIsPlayer) infectPlayer(b);
                else infectBot(targetBot, b);
            }
            return;
        }

        // 追踪目标（A* 会自动经楼梯爬上高台）
        b.targetNode = new THREE.Vector3(target.x, 0, target.z);
    }

    // 优先摧毁近处的补给空投（僵尸战术: 毁掉人类的补给, 无论是否有追击目标）
    for (const a of airdrops) {
        if (a.state === 'landed' && botPos.distanceTo(a.mesh.position) < ZOMBIE.attackRange) {
            b.mesh.lookAt(a.mesh.position.x, botPos.y, a.mesh.position.z);
            if (roundActive && frameCount - (b.lastZombieAttack || 0) >= ZOMBIE.attackCooldown) {
                b.lastZombieAttack = frameCount;
                if (typeof playKnifeSound === 'function') playKnifeSound('hit');
                damageAirdrop(a, 300);
            }
            return;
        }
    }

    // 拆毁近处沙袋路障（noClimb 挡路, 僵尸必须拆）
    for (const bar of barriers) {
        if (botPos.distanceTo(bar.mesh.position) < 18) {
            b.mesh.lookAt(bar.mesh.position.x, botPos.y, bar.mesh.position.z);
            if (roundActive && frameCount - (b.lastZombieAttack || 0) >= ZOMBIE.attackCooldown) {
                b.lastZombieAttack = frameCount;
                if (typeof playKnifeSound === 'function') playKnifeSound('hit');
                damageBarrier(bar, 250);
            }
            return;
        }
    }

    // 寻路（30帧限频，与普通Bot一致）
    const needsNewPath = !b.path || b.path.length === 0;
    const targetMoved = b.path && b.path.length > 0 && b.targetNode && b.targetNode.distanceTo(b.path[b.path.length - 1]) > 5;
    const cooldownElapsed = !b.lastPathfindFrame || (frameCount - b.lastPathfindFrame) > 30;

    if (b.targetNode && (needsNewPath || (targetMoved && cooldownElapsed))) {
        b.path = findFlankPath(botPos, b.targetNode);
        b.pathIndex = 0;
        b.lastPathfindFrame = frameCount;
    }

    let currentWaypoint = b.targetNode;
    if (b.path && b.pathIndex < b.path.length) {
        currentWaypoint = b.path[b.pathIndex];
        const flatBotPos = new THREE.Vector3(botPos.x, 0, botPos.z);
        const flatWaypoint = new THREE.Vector3(currentWaypoint.x, 0, currentWaypoint.z);
        if (flatBotPos.distanceTo(flatWaypoint) < 8) {
            b.pathIndex++;
            if (b.pathIndex < b.path.length) currentWaypoint = b.path[b.pathIndex];
            else currentWaypoint = b.targetNode;
        }
    }

    const dir = new THREE.Vector3().subVectors(currentWaypoint, botPos);
    const distToFinal = new THREE.Vector3().subVectors(b.targetNode, botPos).length();

    if (distToFinal >= 2) {
        dir.normalize();
        b.mesh.lookAt(botPos.x + dir.x, botPos.y, botPos.z + dir.z);
        let speedMult = (b.poisonTimer > 0) ? 0.25 : 1.0;
        if (b.zombieSlowTimer > 0) speedMult *= ZOMBIE.newSlowMult;
        speedMult *= botFreezeSpeedMult(b);
        const moveVec = dir.multiplyScalar(ZOMBIE.speed * delta * speedMult);

        const startPos = botPos.clone();
        moveBotWithCollision(b, moveVec);
        const actualMoved = startPos.distanceTo(botPos);

        if (b.timeStuck === undefined) b.timeStuck = 0;
        if (actualMoved < 2.0 * delta) b.timeStuck += delta;
        else b.timeStuck = 0;

        if (b.timeStuck >= 0.5) {
            botPos.sub(dir.clone().multiplyScalar(4.0));
            b.path = null;
            b.timeStuck = 0;
        }
    }
}

function botAI(delta) {
    let isDefusing = false;
    if (bombState.planted) {
        if (playerState.team === 'CT' && bombState.plantProgress > 0) isDefusing = true;
        bots.forEach(bot => {
            if (bot.team === 'CT' && bot.actionProgress > 0) isDefusing = true;
        });
    }

    bots.forEach(b => {
        // 僵尸死亡重生计时（保留在数组中，仅隐藏）
        if (b.isDead) {
            if (gameMode === 'zombie' && b.team === 'ZOMBIE' && roundActive) {
                b.respawnTimer--;
                if (b.respawnTimer <= 0) respawnZombieBot(b);
            }
            return;
        }

        if (b.isControllingDrone) return;

        // 电击麻痹: 停止一切行动（移动/开火/下包拆包）
        if (b.stunTimer > 0) {
            b.stunTimer--;
            return;
        }

        // 冰冻减速计时
        if (b.freezeTimer > 0) {
            b.freezeTimer--;
            if (b.freezeTimer <= 0) b.freezeStacks = 0;
        }

        // Bot Y 平滑吸附地形（台阶/高台/斜坡吸附/离台平滑坠落）- 推广至所有模式
        updateBotGroundY(b, delta);

        // 生化模式: 僵尸走独立AI
        if (gameMode === 'zombie' && b.team === 'ZOMBIE') {
            zombieBotAI(b, delta);
            return;
        }

        // 生化模式: 人类Bot开局自动寻路上高台守点, 坚守到回合结束
        // (不return, 继续走下方通用逻辑: 有敌人在射程内照样开火)
        if (gameMode === 'zombie' && b.team !== 'ZOMBIE' && platformSpots.length > 0) {
            // 附近有落地空投时优先顺路争抢（抢完自动回守点）
            const dropPos = (typeof getBotAirdropTarget === 'function') ? getBotAirdropTarget(b) : null;
            if (dropPos) {
                b.targetNode = dropPos;
            } else {
                if (!b.holdSpot) {
                    const spot = platformSpots[bots.indexOf(b) % platformSpots.length];
                    b.holdSpot = new THREE.Vector3(spot.x + (Math.random() - 0.5) * 10, spot.h, spot.z + (Math.random() - 0.5) * 10);
                    b.path = null;
                }
                b.targetNode = b.holdSpot;
                const flatDistToSpot = Math.hypot(b.holdSpot.x - b.mesh.position.x, b.holdSpot.z - b.mesh.position.z);
                if (flatDistToSpot < 10 && b.mesh.position.y > 3) {
                    // 已就位: 原地缓慢扫视警戒
                    b.mesh.rotation.y += 0.015;
                }
            }
        }

        let avoidanceVec = new THREE.Vector3();
        let avoiding = false;
        
        grenades.forEach(g => {
            const dist = b.mesh.position.distanceTo(g.mesh.position);
            if (dist < 50) {
                const dir = new THREE.Vector3().subVectors(b.mesh.position, g.mesh.position);
                dir.y = 0;
                if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                avoidanceVec.add(dir.multiplyScalar(20 * delta));
                avoiding = true;
            }
        });
        
        activeFires.forEach(f => {
            const fPos = new THREE.Vector3(f.x, b.mesh.position.y, f.z);
            const dist = b.mesh.position.distanceTo(fPos);
            if (dist < 40) {
                const dir = new THREE.Vector3().subVectors(b.mesh.position, fPos);
                dir.y = 0;
                if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                avoidanceVec.add(dir.multiplyScalar(20 * delta));
                avoiding = true;
            }
        });
        
        grenades.forEach(g => {
            if (g.team !== b.team) {
                const gPos = new THREE.Vector3(g.mesh.position.x, b.mesh.position.y, g.mesh.position.z);
                const dist = b.mesh.position.distanceTo(gPos);
                if (dist < 60) {
                    const dir = new THREE.Vector3().subVectors(b.mesh.position, gPos);
                    dir.y = 0;
                    if (dir.lengthSq() > 0.001) dir.normalize(); else dir.set(1, 0, 0);
                    avoidanceVec.add(dir.multiplyScalar(25 * delta));
                    avoiding = true;
                }
            }
        });

        if (avoiding) {
            b.actionProgress = 0;
            if (avoidanceVec.length() > 25 * delta) {
                avoidanceVec.normalize().multiplyScalar(25 * delta);
            }
            const lookPos = b.mesh.position.clone().add(avoidanceVec);
            b.mesh.lookAt(lookPos.x, b.mesh.position.y, lookPos.z);
            moveBotWithCollision(b, avoidanceVec);
            return;
        }

        let nearestEnemy = null;
        let minDist = Infinity;
        let absoluteClosestEnemy = null;
        let minAbsDist = Infinity;
        
        const botEye = b.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
        
        if (playerState.hp > 0 && playerState.team !== b.team && !playerState.isSpectating) {
            const playerEye = getPlayerPosition().clone();
            const d = botEye.distanceTo(playerEye);
            
            if (d < minAbsDist) { minAbsDist = d; absoluteClosestEnemy = playerEye; }
            
            const dir = new THREE.Vector3().subVectors(playerEye, botEye).normalize();
            raycaster.set(botEye, dir);
            raycaster.far = d;
            const intersects = raycaster.intersectObjects(collidableMeshList);
            if (intersects.length === 0 && !isSegmentBlockedBySmoke(botEye, playerEye)) {
                if (d < minDist) { minDist = d; nearestEnemy = playerEye; }
            }
        }
        
        bots.forEach(other => {
            if (other.team !== b.team && !other.isDead) {
                const otherEye = other.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
                const d = botEye.distanceTo(otherEye);
                
                if (d < minAbsDist) { minAbsDist = d; absoluteClosestEnemy = otherEye; }
                
                const dir = new THREE.Vector3().subVectors(otherEye, botEye).normalize();
                raycaster.set(botEye, dir);
                raycaster.far = d;
                const intersects = raycaster.intersectObjects(collidableMeshList);
                if (intersects.length === 0 && !isSegmentBlockedBySmoke(botEye, otherEye)) {
                    if (d < minDist) { minDist = d; nearestEnemy = otherEye; }
                }
            }
        });

        // WALLHACK AGGRESSION: Override normal target with absolute closest enemy
        if (wallhackActive && absoluteClosestEnemy) {
            if (frameCount % 30 === 0) {
                b.targetNode = new THREE.Vector3(absoluteClosestEnemy.x, 0, absoluteClosestEnemy.z);
                b.bombTarget = null; 
            }
        }
        
        const lowHP = b.hp < 40;

        if (nearestEnemy && minDist < (lowHP ? 120 : 60)) {
            if (b.hasDrone) {
                b.hasDrone = false;
                b.isControllingDrone = true;
                createDrone(b.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, 1, 0), b.team, false, b.id);
                return;
            }
            
            b.actionProgress = 0; // Cancel objective action if in combat
            b.mesh.lookAt(nearestEnemy.x, b.mesh.position.y, nearestEnemy.z);
            
            let moveVec = new THREE.Vector3();
            const combatSlow = ((b.poisonTimer > 0) ? 0.25 : 1.0) * botFreezeSpeedMult(b);
            if (lowHP) {
                const fleeDir = new THREE.Vector3().subVectors(b.mesh.position, nearestEnemy);
                fleeDir.y = 0;
                if (fleeDir.lengthSq() > 0.0001) fleeDir.normalize();
                else fleeDir.set(1, 0, 0);
                fleeDir.applyAxisAngle(new THREE.Vector3(0,1,0), (Math.random() - 0.5) * 1.5);
                moveVec = fleeDir.multiplyScalar(12 * delta * combatSlow);
            } else {
                const strafeDir = new THREE.Vector3(1,0,0).applyQuaternion(b.mesh.quaternion);
                const strafeMagnitude = (Math.random() - 0.5) * 33.75 * delta * combatSlow;
                moveVec = strafeDir.multiplyScalar(strafeMagnitude);
            }
            
            // Move with collision
            moveBotWithCollision(b, moveVec);
            
            // Still try to shoot back even if fleeing
            const diff = BOT_DIFFICULTY_SETTINGS[botDifficulty];
            const fireCooldown = (60 / (WEAPONS[b.weapon].fireRate / 2)) * diff.fireCooldownMult;
            
            // Reaction time: bot must see enemy for reactionFrames before first shot
            if (!b.enemySpotFrame) b.enemySpotFrame = frameCount;
            const reacted = (frameCount - b.enemySpotFrame) >= diff.reactionFrames;
            
            if (reacted && frameCount - b.lastShot > fireCooldown) {
                b.lastShot = frameCount;
                
                const dir = new THREE.Vector3().subVectors(nearestEnemy, botEye).normalize();
                
                let actualSpread = WEAPONS[b.weapon].spread * diff.spreadMult;
                if (minDist > 150) actualSpread *= 0.1; // ADS Simulation at long range
                if (b.poisonTimer > 0) actualSpread *= 4; // Poison reduces accuracy by 75%
                
                if (Math.random() < diff.grenadeChance) {
                    const gType = ['hegrenade', 'flashbang', 'molotov', 'smoke'][Math.floor(Math.random()*4)];
                    let spreadDir = dir.clone();
                    spreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.normalize();
                    createGrenade(botEye.clone(), spreadDir, gType, b.team);
                } else {
                    let bulletCount = b.weapon === 'shotgun' ? 10 : 1;

                    // 敌人枪声: 距离衰减 + 立体声定位
                    playGunSound(b.weapon, botEye);
                    if (typeof triggerBotMuzzleFlash === 'function') {
                        triggerBotMuzzleFlash(botEye);
                    }

                    for (let j = 0; j < bulletCount; j++) {
                        let currentSpreadDir = dir.clone();
                        currentSpreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                        currentSpreadDir.normalize();
                        createBullet(botEye.clone(), currentSpreadDir, WEAPONS[b.weapon], { team: b.team });
                    }
                }
            }
        } else {
            // Reset reaction timer when not in combat
            b.enemySpotFrame = null;
            // Objective logic
            if (b.hasDrone && Math.random() < 0.002) {
                b.hasDrone = false;
                b.isControllingDrone = true;
                createDrone(b.mesh.position.clone().add(new THREE.Vector3(0, 2, 0)), new THREE.Vector3(0, 1, 0), b.team, false, b.id);
                return;
            }
            if (b.stuckTimer > 0) {
                b.stuckTimer--;
            } else if (bombState.planted && b.team === 'CT') {
                if (bombState.mesh) {
                    b.targetNode = bombState.mesh.position.clone();
                }
                const dir = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position);
                const distToBomb = dir.length();
                if (distToBomb < 15.0) { // Require close proximity to defuse
                    // Ensure no wall between bot and bomb
                    const bombEye = b.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
                    const bombTargetPos = bombState.mesh.position.clone().add(new THREE.Vector3(0, 0.5, 0));
                    const toBombDir = new THREE.Vector3().subVectors(bombTargetPos, bombEye).normalize();
                    raycaster.set(bombEye, toBombDir);
                    raycaster.far = distToBomb;
                    const wallHits = raycaster.intersectObjects(collidableMeshList).filter(h => h.object !== bombState.mesh && h.object.parent !== bombState.mesh);

                    if (wallHits.length === 0) {
                        b.actionProgress++;
                        if (b.actionProgress >= 300) {
                            endRound("反恐精英成功拆除了炸弹！", false, 'bomb_defuse');
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
                        }
                        return; // Stop moving, defusing
                    } else {
                        b.actionProgress = 0; // Wall is blocking
                    }
                } else {
                    b.actionProgress = 0;
                }
            } else if (bombState.planted && b.team === 'T') {
                if (bombState.mesh) {
                    if (isDefusing) {
                        b.targetNode = bombState.mesh.position.clone(); // Rush the bomb
                    } else {
                        // Guard the bomb
                        if (!b.bombTarget || Math.random() < 0.02) {
                            b.bombTarget = bombState.mesh.position.clone();
                            b.bombTarget.x += (Math.random() - 0.5) * 20;
                            b.bombTarget.z += (Math.random() - 0.5) * 20;
                        }
                        b.targetNode = b.bombTarget;
                    }
                }
            } else if (!bombState.planted && b.team === 'T') {
                if (!b.bombTarget) {
                    const zone = bombZones[Math.floor(Math.random() * bombZones.length)];
                    if (zone) {
                        b.bombTarget = zone.mesh.position.clone();
                        b.bombTarget.x += (Math.random() - 0.5) * 10;
                        b.bombTarget.z += (Math.random() - 0.5) * 10;
                        b.targetNode = b.bombTarget;
                    }
                } else {
                    b.targetNode = b.bombTarget;
                }
                
                const dir = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position);
                if (dir.length() < 7.5) {
                    b.actionProgress++;
                    if (b.actionProgress >= 180) {
                        bombState.planted = true;
                        if (!wallhackActive) {
                            activateWallhack("炸弹已安放！全图透视与死斗模式开启！");
                        }
                        bombState.timer = 60;
                        b.actionProgress = 0;
                        
                        bombState.mesh = createC4();
                        bombState.mesh.position.copy(b.mesh.position);
                        bombState.mesh.position.y = 0.1;
                        
                        bombState.mesh.updateMatrixWorld(true);
                        bombState.mesh.worldBox = new THREE.Box3().setFromObject(bombState.mesh);

                        scene.add(bombState.mesh);
                        showKillFeed("炸弹已被安放！");
                        showBombAnnouncement(b.team);
                    }
                    return; // Stop moving, planting
                } else {
                    b.actionProgress = 0;
                }
            } else {
                b.actionProgress = 0;
            }

            if (!b.targetNode) {
                b.targetNode = new THREE.Vector3((Math.random() - 0.5) * 760, 0, (Math.random() - 0.5) * 760);
            }

            // Generate path if needed (with frequency limiting to reduce CPU load)
            const needsNewPath = !b.path || b.path.length === 0;
            const targetMoved = b.path && b.path.length > 0 && b.targetNode && b.targetNode.distanceTo(b.path[b.path.length - 1]) > 5;
            const cooldownElapsed = !b.lastPathfindFrame || (frameCount - b.lastPathfindFrame) > 30; // 0.5s at 60fps
            
            if (b.targetNode && (needsNewPath || (targetMoved && cooldownElapsed))) {
                b.path = findFlankPath(b.mesh.position, b.targetNode);
                b.pathIndex = 0;
                b.lastPathfindFrame = frameCount;
            }
            
            let currentWaypoint = b.targetNode;
            if (b.path && b.pathIndex < b.path.length) {
                currentWaypoint = b.path[b.pathIndex];
                let flatBotPos = new THREE.Vector3(b.mesh.position.x, 0, b.mesh.position.z);
                let flatWaypoint = new THREE.Vector3(currentWaypoint.x, 0, currentWaypoint.z);
                if (flatBotPos.distanceTo(flatWaypoint) < 8) {
                    b.pathIndex++;
                    if (b.pathIndex < b.path.length) {
                        currentWaypoint = b.path[b.pathIndex];
                    } else {
                        currentWaypoint = b.targetNode;
                    }
                }
            }

            const distToFinal = new THREE.Vector3().subVectors(b.targetNode, b.mesh.position).length();
            const dir = new THREE.Vector3().subVectors(currentWaypoint, b.mesh.position);
            
            if (distToFinal < 2) {
                if (gameMode === 'zombie' && b.holdSpot) {
                    // 生化模式守点Bot已就位, 保持驻守不再游荡
                } else if (b.stuckTimer > 0 || !((bombState.planted && b.team === 'CT') || (!bombState.planted && b.team === 'T'))) {
                    let isDefender = false;
                    if (bombState.planted && b.team === 'T' && bombState.mesh) {
                        const tBots = bots.filter(bot => bot.team === 'T');
                        if (tBots.indexOf(b) < 3) isDefender = true;
                    }

                    if (isDefender) {
                        b.targetNode = bombState.mesh.position.clone().add(new THREE.Vector3((Math.random()-0.5)*120, 0, (Math.random()-0.5)*120));
                    } else {
                        b.targetNode = new THREE.Vector3((Math.random()-0.5)*760, 0, (Math.random()-0.5)*760);
                    }
                }
            } else {
                dir.normalize();

                b.mesh.lookAt(b.mesh.position.x + dir.x, b.mesh.position.y, b.mesh.position.z + dir.z);
                const speedMult = ((b.poisonTimer > 0) ? 0.25 : 1.0) * botFreezeSpeedMult(b);
                const moveVec = dir.multiplyScalar(22 * delta * speedMult); // Normal speed
                
                const startPos = b.mesh.position.clone();
                moveBotWithCollision(b, moveVec);
                const actualMoved = startPos.distanceTo(b.mesh.position);
                
                if (b.timeStuck === undefined) b.timeStuck = 0;
                
                if (actualMoved < 2.0 * delta) {
                    b.timeStuck += delta;
                } else {
                    b.timeStuck = 0;
                }
                
                if (b.timeStuck >= 0.5) {
                    // Bounce backwards to un-wedge from the geometry
                    b.mesh.position.sub(dir.clone().multiplyScalar(4.0));
                    b.path = null;
                    if (!bombState.planted && b.team === 'T') {
                        b.bombTarget = null;
                    }
                    b.timeStuck = 0;
                }
            }
        }
    });
}

// #endregion
