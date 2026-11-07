// #region 射击与战斗
function handleShooting(initialClick = false) {
    if (playerState.isSpectating) return;
    if (!controls || (!controls.isLocked && !isPlayerControlActive())) return;
    
    if (playerState.isControllingDrone) {
        if (!initialClick) return;
        if (inventory.currentSlot !== 4) return;
        const weapon = getCurrentWeapon();
        if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine'].includes(weapon.id)) return;

        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team, true, true);

        inventory.grenades[weapon.id]--;

        const types = ['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone'];
        const available = types.filter(t => inventory.grenades[t] > 0);
        if (available.length > 0) {
            if (inventory.grenades[weapon.id] <= 0) {
                inventory.currentGrenade = available[0];
            }
        } else {
            inventory.currentGrenade = null;
            document.getElementById('slot-4').classList.add('hidden');
        }

        playerState.lastShot = frameCount;
        playerState.lastCombatTime = frameCount;
        updateHUD();
        return;
    }
    
    if (isReloading) return;
    const weapon = getCurrentWeapon();

    if (weapon.id === 'mortar') {
        if (initialClick) openMortarMap();
        return;
    }

    const hasLightBullet = playerState.bulletType === 'light' || (playerState.bulletStacking && playerState.bulletTypes.includes('light'));
    const awpLightAuto = weapon.id === 'sniper' && hasLightBullet; // AWP+轻型子弹: 全自动速射形态

    const currentFireMode = (typeof getWeaponFireMode === 'function') ? getWeaponFireMode(weapon) : 'multi';
    const isSingleMode = (currentFireMode === 'single');
    if (isSingleMode) {
        playerState.burstQueue = 0;
    }

    // MK4 三连发: 队列推进后续弹（松开扳机也会打完整组, 单发模式下不进行三连发）
    let burstShotDue = false;
    if (weapon.burst && !isSingleMode && playerState.burstQueue > 0 && playerState.burstWeapon === weapon.id) {
        if (frameCount > playerState.burstNextShot + 10) {
            playerState.burstQueue = 0; // 队列超时(解锁/断帧)作废, 防止补射残留弹
        } else if (frameCount >= playerState.burstNextShot) {
            burstShotDue = true;
        } else {
            return;
        }
    }

    const canAutoFire = !isSingleMode && (weapon.auto || awpLightAuto);
    if (!canAutoFire && !initialClick && !burstShotDue) return;
    if (!isShooting && !burstShotDue) {
        playerState.gatlingFireStartFrame = 0;
        return;
    }
    playerState.isInspecting = false;
    let requiredCooldown = weapon.fireRate;

    if (weapon.id === 'gatling') {
        if (initialClick || !playerState.gatlingFireStartFrame || (frameCount - playerState.lastShot > 30)) {
            playerState.gatlingFireStartFrame = frameCount;
        }
        let elapsedSec = (frameCount - playerState.gatlingFireStartFrame) / 60;
        let rampMult = Math.min(9.5, 0.625 + elapsedSec * 0.6);
        requiredCooldown /= rampMult;
    }

    if (hasLightBullet) {
        if (awpLightAuto) requiredCooldown = 60 / 7; // AWP+轻型: 420发/分（60帧÷7发/秒）
        else requiredCooldown *= 0.30; // 射速+70%（冷却-70%）
    }

    let isDualBullet = playerState.bulletType === 'dual' || (playerState.bulletStacking && playerState.bulletTypes && playerState.bulletTypes.includes('dual'));
    if (isDualBullet && weapon.id !== 'ash12') {
        requiredCooldown *= 1.45;
    }
    if (weapon.id === 'switchblade' && playerState.knifeComboStage === 2) requiredCooldown = 48;
    if (!burstShotDue && frameCount - playerState.lastShot < requiredCooldown) return;

    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : (inventory.currentSlot === 2 ? ammoState.secondary : (inventory.currentSlot === 4 ? ammoState.grenade : null));
    
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade' && weapon.id !== 'zombieClaw' && inventory.currentSlot !== 4) {
        if (currentAmmo && currentAmmo.clip <= 0) {
            if (playerState.burstQueue > 0) playerState.burstQueue = 0; // 弹尽中断三连发
            if (initialClick) playEmptyClick();
            if (initialClick && currentAmmo.reserve > 0) handleReload();
            return;
        }
        currentAmmo.clip--;
    }

    if (inventory.currentSlot === 4) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);

        if (weapon.id === 'drone') {
            const spawned = createDrone(camera.position.clone(), camDir, playerState.team);
            if (!spawned) {
                if (typeof showKillFeed === 'function') showKillFeed('已有活跃无人机正在运行！');
                return;
            }
        } else {
            playGrenadePin();
            createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team, false, true);
        }
        
        inventory.grenades[weapon.id]--;
        
        const types = ['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine', 'drone'];
        const available = types.filter(t => inventory.grenades[t] > 0);
        if (available.length > 0) {
            if (inventory.grenades[weapon.id] <= 0) {
                inventory.currentGrenade = available[0];
            }
        } else {
            inventory.currentGrenade = null;
            document.getElementById('slot-4').classList.add('hidden');
            if (inventory.primary) switchWeapon(1);
            else switchWeapon(2);
        }

        playerState.lastShot = frameCount;
        playerState.lastCombatTime = frameCount;
        updateHUD();
        return;
    }

    playerState.lastShot = frameCount;
    // 三连发: 首发入队后续弹, 队列弹推进后重新排队 (单发模式下不进行连发入队)
    if (weapon.burst && !isSingleMode) {
        if (burstShotDue) {
            playerState.burstQueue--;
            if (playerState.burstQueue > 0) playerState.burstNextShot = frameCount + weapon.burstDelay;
        } else {
            playerState.burstQueue = weapon.burst - 1;
            playerState.burstNextShot = frameCount + weapon.burstDelay;
            playerState.burstWeapon = weapon.id;
        }
    }
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade' && weapon.id !== 'zombieClaw') {
        playerState.lastCombatTime = frameCount;
    }
    updateHUD();
    
    // View model recoil animation
    if(playerState.viewModel) {
        if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade' || weapon.id === 'zombieClaw') {
            playerState.knifeAnimStart = performance.now();
        } else if (weapon.id !== 'flamethrower') {
            const kickback = (playerState.isAds ? 0.002 : 0.1) * (isSingleMode ? 0.8 : 1.0);
            playerState.viewModel.position.z += kickback; // Kickback
            setTimeout(() => {
                if(playerState.viewModel) {
                    playerState.viewModel.position.z -= kickback;
                }
            }, 50);
        }
    }

    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade' || weapon.id === 'zombieClaw') {
        const now = performance.now();
        if (now - playerState.lastKnifeSwingTime > 1000) {
            playerState.knifeComboStage = 0;
        } else {
            playerState.knifeComboStage = (playerState.knifeComboStage + 1) % 3;
        }
        playerState.lastKnifeSwingTime = now;
        playerState.knifeAnimStage = playerState.knifeComboStage;
        
        let currentSwingTime = now;
        let executeDamage = () => {
            if (playerState.lastKnifeSwingTime !== currentSwingTime) return;
            if (getCurrentWeapon().id !== weapon.id) return;
            
            // CS刀械音效: 重击(第三段)用刺刀声, 普通挥砍交替两种挥刀声
            if (playerState.knifeComboStage === 2) playKnifeSound('stab');
            else playKnifeSound(playerState.knifeComboStage === 0 ? 'swing1' : 'swing2');

            let bestTarget = null;
        let bestDist = Infinity;
        let hitIsHeadshot = false;
        let hitPoint = null;
        let targetType = null; 
        let hitIndex = -1;
        
        let checkMesh = (mesh, entity, isHead, type, idx) => {
            if (!mesh) return;
            let worldPos = new THREE.Vector3();
            mesh.getWorldPosition(worldPos);
            
            let localPos = worldPos.clone();
            camera.worldToLocal(localPos);
            
            if (localPos.x >= -2 && localPos.x <= 2 &&
                localPos.y >= -1 && localPos.y <= 1 &&
                localPos.z >= -weapon.range && localPos.z <= 0) {
                
                let dist = camera.position.distanceTo(worldPos);
                
                let dir = worldPos.clone().sub(camera.position).normalize();
                raycaster.set(camera.position, dir);
                raycaster.far = weapon.range;
                let targets = [mesh].concat(collidableMeshList);
                let intersects = raycaster.intersectObjects(targets, true);
                
                if (intersects.length > 0 && (intersects[0].object === mesh || intersects[0].object.parent === mesh)) {
                    if (!bestTarget || (isHead && !hitIsHeadshot) || (isHead === hitIsHeadshot && dist < bestDist)) {
                        bestTarget = entity;
                        bestDist = dist;
                        hitIsHeadshot = isHead;
                        hitPoint = intersects[0].point;
                        targetType = type;
                        hitIndex = idx;
                    }
                }
            }
        };

        for (let i = 0; i < bots.length; i++) {
            let b = bots[i];
            if (b.hp <= 0) continue;
            let head = b.mesh.getObjectByName('head');
            if (head) checkMesh(head, b, true, 'bot', i);
            b.mesh.children.forEach(child => {
                if (child.name !== 'head') checkMesh(child, b, false, 'bot', i);
            });
        }
        
        for (let i = 0; i < activeDrones.length; i++) {
            let d = activeDrones[i];
            checkMesh(d.mesh, d, false, 'drone', i);
        }
        
        if (isShootingRange) {
            for (let i = 0; i < rangeTargets.length; i++) {
                let t = rangeTargets[i];
                let head = t.getObjectByName('rangeTargetHead');
                if (head) checkMesh(head, t, true, 'rangeTarget', i);
                let body = t.getObjectByName('rangeTargetBody');
                if (body) checkMesh(body, t, false, 'rangeTarget', i);
            }
        }
        
        if (bestTarget) {
            let dmg;
            if (weapon.id === 'kukri') dmg = (playerState.knifeComboStage === 2 ? 65 : 45);
            else if (weapon.id === 'switchblade') dmg = (playerState.knifeComboStage === 0 ? 30 : (playerState.knifeComboStage === 1 ? 55 : 75));
            else dmg = (playerState.knifeComboStage === 2 ? 40 : 30);
            
            if (targetType === 'bot' && bestTarget.team !== playerState.team) {
                if (weapon.id === 'zombieClaw') {
                    // 僵尸利爪: 感染人类而非造成伤害
                    playKnifeSound(Math.random() < 0.5 ? 'hit' : 'hit2');
                    createHitEffect(hitPoint, false);
                    if (typeof playHitMarkerSound === 'function') playHitMarkerSound(false);
                    if (!bestTarget.isDead && bestTarget.team !== 'ZOMBIE') infectBot(bestTarget, null);
                } else {
                    dmg *= zombieDmgTakenMult(bestTarget);
                    bestTarget.hp -= dmg;
                    playKnifeSound(Math.random() < 0.5 ? 'hit' : 'hit2');
                    createHitEffect(hitPoint, false);
                    if (typeof playHitMarkerSound === 'function') playHitMarkerSound(hitIsHeadshot);
                    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
                        playerState.hp = Math.min(100, playerState.hp + 5);
                        updateHUD();
                    }
                    if (bestTarget.hp <= 0) killBot(hitIndex, playerState.team, weapon.id, true);
                }
            } else if (targetType === 'drone' && bestTarget.team !== playerState.team) {
                bestTarget.hp -= dmg;
                createHitEffect(hitPoint, false);
                if (typeof playHitMarkerSound === 'function') playHitMarkerSound(false);
                if (bestTarget.hp <= 0) {
                    destroyDrone(bestTarget, false);
                    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
                        playerState.hp = Math.min(100, playerState.hp + 10);
                        updateHUD();
                    }
                }
            } else if (targetType === 'rangeTarget') {
                if (hitIsHeadshot) dmg *= 3.0;
                showFloatingDamage(dmg, hitPoint);
                createHitEffect(hitPoint, false);
                if (typeof playHitMarkerSound === 'function') playHitMarkerSound(hitIsHeadshot);
            }
        } else if (gameMode === 'zombie' && typeof barriers !== 'undefined' && barriers.length > 0) {
            // 近战无目标时: 拆除近处沙袋路障（僵尸利爪快, 人类武器慢）
            let barTarget = null;
            let barDist = Infinity;
            for (const bar of barriers) {
                const d = camera.position.distanceTo(bar.mesh.position);
                if (d < weapon.range && d < barDist) { barDist = d; barTarget = bar; }
            }
            if (barTarget) {
                playKnifeSound('hit');
                damageBarrier(barTarget, weapon.id === 'zombieClaw' ? 250 : 100);
            }
        }
        };

        let delayMs = 0;
        if (weapon.id === 'switchblade') {
            if (playerState.knifeComboStage === 1) delayMs = 200;
            else if (playerState.knifeComboStage === 2) delayMs = 650;
        }

        if (delayMs > 0) setTimeout(executeDamage, delayMs);
        else executeDamage();
        return;
    }

    if (weapon.id === 'flamethrower') {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);

        const muzzlePos = camera.position.clone().add(camDir.clone().multiplyScalar(2));
        createFlameStream(muzzlePos, camDir, weapon.range);

        // 喷火器伤害节流戳 (100ms Tick Interval)
        const now = performance.now();
        if (now - (playerState.lastFlameDamageTick || 0) < 100) {
            return;
        }
        playerState.lastFlameDamageTick = now;

        raycaster.set(camera.position, camDir);
        raycaster.far = weapon.range;
        const _floorMesh = scene.getObjectByName('floor');
        let targets = bots.filter(bot => !bot.isDead).map(bot => bot.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
        if (_floorMesh) targets.push(_floorMesh);
        const intersects = raycaster.intersectObjects(targets, true);

        if (intersects.length > 0) {
            const hit = intersects[0];
            let hitBot = null;
            let hitIndex = -1;
            let hitDrone = null;

            for (let j = 0; j < bots.length; j++) {
                if (hit.object === bots[j].mesh || hit.object.parent === bots[j].mesh) {
                    hitBot = bots[j];
                    hitIndex = j;
                    break;
                }
            }
            if (!hitBot) {
                for (let j = 0; j < activeDrones.length; j++) {
                    if (hit.object === activeDrones[j].mesh || hit.object.parent === activeDrones[j].mesh) {
                        hitDrone = activeDrones[j];
                        break;
                    }
                }
            }

            let hitRangeTarget = false;
            if (!hitBot && !hitDrone && isShootingRange) {
                if (hit.object.name === 'rangeTargetHead' || hit.object.name === 'rangeTargetBody') {
                    hitRangeTarget = true;
                }
            }

            if (hitBot && hitBot.team !== playerState.team) {
                // 生化模式: 喷火器(fireRate:0) 100ms 伤害节流，对僵尸造成 3点 + 当前血量2% 伤害（单次百分比上限20点）
                let flameDmg = weapon.damage * zombieDmgTakenMult(hitBot);
                if (gameMode === 'zombie' && hitBot.team === 'ZOMBIE') {
                    const percentDmg = Math.min(20, hitBot.hp * 0.02);
                    flameDmg = weapon.damage + percentDmg;
                }
                hitBot.hp -= flameDmg;
                if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                hitBot.burnTimer = 420;
                hitBot.burnDamageMult = 0.25;
                createHitEffect(hit.point, false, 'shotgun');
                if (typeof playHitMarkerSound === 'function') playHitMarkerSound(false);
                if (typeof showFloatingDamage === 'function') showFloatingDamage(Math.round(flameDmg), hit.point);
                if (hitBot.hp <= 0) killBot(hitIndex, playerState.team, weapon.id, true);
            } else if (hitDrone && hitDrone.team !== playerState.team) {
                hitDrone.hp -= weapon.damage;
                createHitEffect(hit.point, false, 'shotgun');
                if (typeof playHitMarkerSound === 'function') playHitMarkerSound(false);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (hitRangeTarget) {
                let dmg = weapon.damage;
                if (hit.object.name === 'rangeTargetHead') dmg *= 3.0;
                showFloatingDamage(dmg, hit.point);
                let targetObj = hit.object.parent;
                if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                targetObj.burnTimer = 420;
                targetObj.burnDamageMult = 0.25;
                createHitEffect(hit.point, false, 'shotgun');
                if (typeof playHitMarkerSound === 'function') playHitMarkerSound(hit.object.name === 'rangeTargetHead');
            } else if (!hitBot && !hitDrone) {
                createHitEffect(hit.point, true, 'shotgun');
            }
        }

        return;
    }

    // Guns use projectiles
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
    
    let bulletCount = weapon.id === 'shotgun' ? 16 : 1;
    if (isDualBullet && weapon.id !== 'shotgun') {
        bulletCount = 2;
    }
    let start;
    const scopeDef = SCOPE_TYPES[playerState.currentScope];
    const isMagnified = scopeDef && scopeDef.overlayType === 'magnified';
    if (playerState.isAds && (weapon.id === 'sniper' || weapon.id === 'marksman' || isMagnified)) {
        start = camera.position.clone();
    } else {
        start = camera.position.clone().add(new THREE.Vector3(0,-0.5,0));
    }
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
    const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
    
    for (let i = 0; i < bulletCount; i++) {
        let dir = raycaster.ray.direction.clone();
        
        // Add spread
        let actualSpread = (currentSpread + 5) / 500;
        if (playerState.isAds) {
            actualSpread = 0;
        }
        let theta, r;
        if (weapon.id === 'shotgun') {
            if (i === 0) {
                theta = 0;
                r = Math.random() * 0.2 * actualSpread;
            } else {
                // Evenly distribute 15 bullets in a ring to prevent overlapping and fill the crosshair
                theta = ((i - 1) / (bulletCount - 1)) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
                r = (0.4 + 0.6 * Math.random()) * actualSpread;
            }
        } else {
            theta = Math.random() * Math.PI * 2;
            r = Math.sqrt(Math.random()) * actualSpread;
        }
        
        dir.add(right.clone().multiplyScalar(Math.cos(theta) * r));
        dir.add(up.clone().multiplyScalar(Math.sin(theta) * r));
        dir.normalize();

        let shooterInfo = { team: playerState.team, isPlayer: true, bulletType: playerState.bulletType || 'normal', bulletTypes: playerState.bulletStacking ? playerState.bulletTypes : null };
        if (isDualBullet && weapon.id !== 'shotgun') {
            shooterInfo.divergenceSide = (i === 0 ? 1 : -1);
        }
        createBullet(start, dir, weapon, shooterInfo);
    }

    // 枪声: 每次扳机播放一次
    playGunSound(weapon.id);

    // Muzzle Flash Dynamic Lighting (F17)
    if (typeof triggerMuzzleFlash === 'function') {
        triggerMuzzleFlash(weapon);
    }



    // Camera recoil (deterministic pattern-based, CS-style) & Camera Shake
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade' && weapon.id !== 'zombieClaw') {
        let shakeAmt = (weapon.id === 'shotgun' || weapon.id === 'ash12' || weapon.id === 'sniper') ? 0.010 : 0.004;
        if (isSingleMode) shakeAmt *= 0.8;
        playerState.cameraShake = Math.min(0.025, (playerState.cameraShake || 0) + shakeAmt);

        // Reset pattern index if enough time has passed since last shot (0.4s)
        const framesSinceLastShot = frameCount - (playerState.lastRecoilShotFrame || 0);
        if (framesSinceLastShot > 24) {
            playerState.recoilPatternIndex = 0;
        }
        playerState.lastRecoilShotFrame = frameCount;
        
        // Get recoil from deterministic pattern (or fall back to old random system)
        const pattern = RECOIL_PATTERNS[weapon.id];
        let recoilPitch, recoilYaw;
        
        if (pattern) {
            const idx = playerState.recoilPatternIndex || 0;
            const entry = pattern[idx % pattern.length];
            recoilPitch = entry[0];
            recoilYaw = entry[1];
            playerState.recoilPatternIndex = idx + 1;
        } else {
            // Fallback for weapons without patterns
            recoilPitch = 0.01;
            recoilYaw = (Math.random() - 0.5) * 0.003;
        }
        
        // Apply ADS / hip-fire multipliers
        if (!playerState.isAds) {
            recoilPitch *= 0.4;
            recoilYaw *= 0.5;
        } else {
            if (weapon.id === 'marksman') {
                recoilPitch *= 0.43875;
                recoilYaw *= 0.468;
            } else if (weapon.id === 'ash12') {
                recoilPitch *= 1.716;
                recoilYaw *= 1.584;
            } else {
                recoilPitch *= 0.75;
                recoilYaw *= 0.5;
            }
        }

        if (playerState.bulletType === 'light' || (playerState.bulletStacking && playerState.bulletTypes.includes('light'))) {
            recoilPitch *= 0.4;
            recoilYaw *= 0.4;
        }

        if (weapon.id === 'gatling' && playerState.gatlingFireStartFrame) {
            let gElapsedSec = (frameCount - playerState.gatlingFireStartFrame) / 60;
            let gIntervals = Math.floor(gElapsedSec / 0.5);
            let gRecoilMult = Math.min(2.5, 1.0 + gIntervals * (1.0 / 20));
            recoilPitch *= gRecoilMult;
            recoilYaw *= gRecoilMult;
        }

        // 单发模式下后坐力会变为原来的 80%
        if (isSingleMode) {
            recoilPitch *= 0.8;
            recoilYaw *= 0.8;
        }

        const euler = new THREE.Euler(0, 0, 0, 'YXZ');
        euler.setFromQuaternion(camera.quaternion);
        euler.x += recoilPitch;
        euler.y += recoilYaw;
        
        // Track recoil recovery only for sniper and marksman rifles
        if (weapon.id === 'sniper' || weapon.id === 'marksman') {
            playerState.recoilRecovery = (playerState.recoilRecovery || 0) + recoilPitch;
            playerState.recoilRecoveryYaw = (playerState.recoilRecoveryYaw || 0) + recoilYaw;
            
            playerState.recoilRecoveryRate = (weapon.id === 'sniper') ? 0.08 : 0.032;
        }
        
        camera.quaternion.setFromEuler(euler);
    }
}

function playerDie(killerTeam = null, weaponId = 'rifle') {
    playerState.killStreak = 0; // 死亡清零连杀
    // 生化模式: 人类死亡即被感染，僵尸死亡8秒后重生
    if (gameMode === 'zombie' && roundActive) {
        if (!playerState.isZombie) {
            infectPlayer(null);
        }
        if (playerState.isZombie) {
            if (killerTeam) {
                showKillFeed(`[${killerTeam}] 击杀了 你，你已沦为僵尸...`);
            }
            playerState.isSpectating = true;
            playerState.zombieRespawnTimer = ZOMBIE.respawnFrames;
            document.exitPointerLock();
            showSpectatorPrompt();
            if (playerState.isControllingDrone) {
                const pd = activeDrones.find(d => d.isPlayer);
                if (pd) destroyDrone(pd, false);
            }
            cycleSpectator();
            checkWinCondition();
            return;
        }
    }

    if (killerTeam) {
        const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
        if (weaponId === 'c4') {
            showKillFeed(`你 被 C4 炸弹 爆炸冲击波击杀`);
        } else {
            showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 你`);
        }
    }

    playerState.isSpectating = true;
    document.exitPointerLock();
    showSpectatorPrompt();
    if (playerState.isControllingDrone) {
        const pd = activeDrones.find(d => d.isPlayer);
        if (pd) destroyDrone(pd, false);
    }
    cycleSpectator();
    checkWinCondition();
}

function showSpectatorPrompt() {
    const sp = document.getElementById('spectator-prompt');
    if (!sp) return;
    sp.classList.remove('hidden');
    const p = sp.querySelector('p');
    if (p) {
        const isTouch = (typeof checkIsTouchDevice === 'function' ? checkIsTouchDevice() : Boolean(typeof isTouchDevice !== 'undefined' && isTouchDevice));
        const specHint = isTouch ? '点击屏幕或开火键切换观战视角' : '点击鼠标左键切换观战视角';
        const targetEl = document.getElementById('spectator-target');
        const targetText = targetEl ? targetEl.innerText : '无';
        p.innerHTML = `${specHint}<br>(当前观战: <span id="spectator-target" style="color:#e67e22;">${targetText}</span>)`;
    }
}

// ── G键快速投掷高爆手雷（无需切换到4号槽位）──
function quickThrowGrenade() {
    if (!roundActive || playerState.isSpectating || playerState.isControllingDrone || playerState.hp <= 0) return;
    if (gameMode === 'zombie' && (playerState.isZombie || playerState.team === 'ZOMBIE')) return;
    if (!(inventory.grenades.hegrenade > 0)) {
        showKillFeed('没有高爆手雷！可在商店购买');
        return;
    }
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    playGrenadePin();
    createGrenade(camera.position.clone(), camDir, 'hegrenade', playerState.team, false, true);
    inventory.grenades.hegrenade--;
    playerState.lastShot = frameCount;
    showKillFeed('快速投掷高爆手雷 (剩余 ' + inventory.grenades.hegrenade + ')');
    updateHUD();
}

// ── 地雷部署: 投掷后首次碰撞（落地/撞墙）时贴附表面，生成范围圈 ──
function deployMine(position, normal, team, isPlayer) {
    // 场上上限10枚，超限移除最旧的
    while (activeMines.length >= 10) {
        removeMineMesh(activeMines[0]);
        activeMines.splice(0, 1);
    }
    const group = new THREE.Group();
    const geo = new THREE.CylinderGeometry(0.5, 0.6, 0.25, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a });
    const body = new THREE.Mesh(geo, mat);
    group.add(body);
    const lampGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const lampMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const lamp = new THREE.Mesh(lampGeo, lampMat);
    lamp.position.y = 0.18;
    group.add(lamp);
    group.position.copy(position);
    if (normal) {
        // 贴附朝向: 圆柱顶面朝向碰撞面外法线（地面平放 / 墙面贴合 / 天花板倒挂）
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize());
        group.quaternion.copy(quat);
        group.position.add(normal.clone().normalize().multiplyScalar(0.15)); // 沿法线抬离表面防穿模
    }
    scene.add(group);

    // 范围圈: 危险区红盘(爆炸半径18.75) + 边缘环 + 触发半径小环(9)，无论贴哪始终平铺于雷下方地面
    const circle = new THREE.Group();
    const dangerGeo = new THREE.CircleGeometry(18.75, 48);
    const dangerMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false });
    const danger = new THREE.Mesh(dangerGeo, dangerMat);
    danger.rotation.x = -Math.PI / 2;
    circle.add(danger);
    const ringGeo = new THREE.RingGeometry(17.7, 18.75, 48);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = -Math.PI / 2;
    circle.add(ring);
    const trigGeo = new THREE.RingGeometry(8, 9, 24);
    const trigMat = new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const trig = new THREE.Mesh(trigGeo, trigMat);
    trig.rotation.x = -Math.PI / 2;
    circle.add(trig);
    circle.position.set(position.x, 0.06, position.z); // 平铺于雷正下方地面（贴墙雷也投影到地面）
    scene.add(circle);

    activeMines.push({ group: group, lamp: lamp, circle: circle, x: position.x, z: position.z, team: team, armTimer: 90, isPlayer: !!isPlayer });
}

// 移除地雷网格并释放 GPU 资源
function removeMineMesh(m) {
    if (m.group) {
        scene.remove(m.group);
        m.group.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }
    if (m.circle) {
        scene.remove(m.circle);
        m.circle.traverse(child => {
            if (child.isMesh) {
                if (child.geometry) child.geometry.dispose();
                if (child.material) child.material.dispose();
            }
        });
    }
}

// 地雷更新: 布防倒计时 + 仅敌方靠近触发（队友与玩家自己踩上安全），触发后 0.25 秒引信爆炸
function updateMines() {
    for (let i = activeMines.length - 1; i >= 0; i--) {
        const m = activeMines[i];
        if (m.armTimer > 0) {
            m.armTimer--;
            m.lamp.visible = (frameCount % 40 < 20); // 布防中慢闪
            continue;
        }
        // 引信倒计时: 走近爆炸中心触发后 0.25 秒（15帧）起爆
        if (m.fuseTimer > 0) {
            m.fuseTimer--;
            m.lamp.visible = (frameCount % 4 < 2); // 引信中极速闪烁预警
            if (m.fuseTimer <= 0) explodeMine(m, i);
            continue;
        }
        m.lamp.visible = (frameCount % 10 < 5); // 武装后快闪
        let triggered = false;
        for (let j = bots.length - 1; j >= 0; j--) {
            const b = bots[j];
            if (b.isDead || b.team === m.team) continue; // 队友踩上不触发
            const dx = b.mesh.position.x - m.x;
            const dz = b.mesh.position.z - m.z;
            if (dx * dx + dz * dz < 81) { // 触发半径9（仅敌方）
                triggered = true;
                break;
            }
        }
        // 敌对阵营的玩家才会触发（自己的雷踩上安全）
        if (!triggered && playerState.team !== m.team && playerState.hp > 0 && !playerState.isSpectating && !playerState.isControllingDrone) {
            const p = getPlayerPosition();
            const dx = p.x - m.x;
            const dz = p.z - m.z;
            if (dx * dx + dz * dz < 81) triggered = true; // 触发半径9
        }
        if (triggered) m.fuseTimer = 15; // 启动0.25秒引信（60fps × 0.25 = 15帧）
    }
}

function explodeMine(m, index) {
    const pos = m.group ? m.group.position.clone() : new THREE.Vector3(m.x, 0.5, m.z);
    createHitEffect(pos, false);
    playExplosionSound(pos);
    const range = 18.75; // 爆炸半径（12.5 增大50%）
    // 爆炸只伤敌方（队友免疫，不伤自己人）
    for (let j = bots.length - 1; j >= 0; j--) {
        const b = bots[j];
        if (b.isDead || b.team === m.team) continue;
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < range) {
            b.hp -= 120 * (1 - dist / range) * zombieExplosiveDmgMult(b);
            if (b.hp <= 0) killBot(j, m.team, 'mine', m.isPlayer);
        }
    }
    // 玩家与雷同阵营则免疫（自己的雷不伤自己）
    if (playerState.team !== m.team && playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = getPlayerPosition();
        const dist = playerPos.distanceTo(pos);
        if (dist < range) {
            let dmg = Math.round(Math.max(0, 120 * (1 - dist / range)));
            dmg = applyArmorReduction(dmg);
            const wid = getCurrentWeapon().id;
            if (wid === 'kukri' || (wid === 'flamethrower' && isShooting)) dmg *= 0.025;
            else if (wid === 'knife' || wid === 'switchblade') dmg *= 0.05;
            if (!playerState.isInvincible) playerState.hp -= Math.ceil(dmg);
            if (typeof triggerDamageVignette === 'function') triggerDamageVignette(dmg / 35);
            playerState.cameraShake = Math.min(0.03, (playerState.cameraShake || 0) + 0.015);
            playerState.lastCombatTime = frameCount;
            if (playerState.hp <= 0) playerDie(m.team, 'mine');
        }
    }
    removeMineMesh(m);
    activeMines.splice(index, 1);
}

// ── 连杀奖励: 3连杀起每级+100$，上限+500$（死亡或新回合清零）──
function handleKillStreakReward() {
    playerState.killStreak = (playerState.killStreak || 0) + 1;
    if (playerState.killStreak < 3) return;
    const bonus = Math.min(500, (playerState.killStreak - 2) * 100);
    playerCurrency += bonus;
    document.getElementById('hud-credits').innerText = playerCurrency;
    showKillFeed(`${playerState.killStreak} 连杀！额外奖励 +$${bonus}`);
    showAnnouncement(`${playerState.killStreak} 连杀！`, playerState.killStreak >= 5 ? '#ff4d4d' : '#ffd700');
}

function killBot(index, killerTeam, weaponId = 'rifle', killerIsPlayer = false, killerBot = null) {
    const bot = bots[index];
    const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;

    // MVP 统计: 击杀者 Bot 的回合击杀数
    if (killerBot && !killerBot.isDead) {
        killerBot.kills = (killerBot.kills || 0) + 1;
        if (!matchState.roundBestKiller || killerBot.kills > matchState.roundBestKiller.kills) {
            matchState.roundBestKiller = { kills: killerBot.kills, team: killerBot.team };
        }
    }

    // 生化模式: 僵尸被击杀后不移除，8秒后原地系统重生
    if (gameMode === 'zombie' && bot.team === 'ZOMBIE') {
        if (bot.isDead) return; // 已在重生流程中，避免重置计时
        if (killerIsPlayer) {
        const reward = 500;
        playerCurrency += reward;
        playerScore += 10;
        document.getElementById('hud-credits').innerText = playerCurrency;
        const _hudScore = document.getElementById('hud-score');
        if (_hudScore) _hudScore.innerText = playerScore;
        matchState.roundKills.player++;
        showKillFeed(`你 使用 ${wName} 击杀了僵尸 (+$${reward})`);
        handleKillStreakReward();
    } else {
            if (killerTeam === playerState.team) matchState.roundKills.myBots++;
            else matchState.roundKills.enemyBots++;
            showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了僵尸`);
        }
        bot.isDead = true;
        bot.hp = 0;
        bot.respawnTimer = ZOMBIE.respawnFrames;
        bot.burnStacks = 0;
        bot.burnTimer = 0;
        bot.poisonTimer = 0;
        bot.stunTimer = 0;
        bot.freezeTimer = 0;
        bot.freezeStacks = 0;
        scene.remove(bot.mesh);
        checkWinCondition();
        return;
    }

    // 击杀统计（MVP 用）
    if (killerIsPlayer) matchState.roundKills.player++;
    else if (killerTeam === playerState.team) matchState.roundKills.myBots++;
    else matchState.roundKills.enemyBots++;

    // 爆破模式: Bot 阵亡掉落其武器（15秒内可按 E 拾取）
    if (gameMode === 'bomb' && bot.weapon && WEAPONS[bot.weapon]) {
        spawnWeaponDrop(bot.mesh.position.clone(), bot.weapon);
    }

    if (killerIsPlayer) {
        const reward = WEAPONS[weaponId] ? WEAPONS[weaponId].killReward : 300;
        playerCurrency += reward;
        playerScore += 10;
        document.getElementById('hud-credits').innerText = playerCurrency;
        const _hudScore = document.getElementById('hud-score');
        if (_hudScore) _hudScore.innerText = playerScore;
        showKillFeed(`你 使用 ${wName} 击杀了 [${bot.team}] BOT (+$${reward})`);
        handleKillStreakReward();

        if (weaponId === 'knife' || weaponId === 'kukri' || weaponId === 'switchblade') {
            playerState.hp = Math.min(100, playerState.hp + 10);
            updateHUD();
        }
    } else {
        if (weaponId === 'c4') {
            showKillFeed(`[${bot.team}] BOT 被 C4 炸弹 爆炸冲击波击杀`);
        } else {
            showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 [${bot.team}] BOT`);
        }
    }

    scene.remove(bot.mesh);
    bot.mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
    });
    bots.splice(index, 1);

    checkWinCondition();
}

// ── 武器拾取系统: Bot 阵亡掉落武器, 15秒内可按 E 拾取 ──
function spawnWeaponDrop(pos, weaponId) {
    if (!WEAPONS[weaponId]) return;
    const wInfo = WEAPONS[weaponId];
    const geo = new THREE.BoxGeometry(0.15, 0.15, Math.max(0.4, wInfo.length));
    const mat = new THREE.MeshStandardMaterial({ color: wInfo.color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(pos.x, 0.3, pos.z);
    mesh.rotation.z = Math.PI / 2;
    mesh.rotation.y = Math.random() * Math.PI * 2;
    scene.add(mesh);
    weaponDrops.push({ mesh: mesh, weaponId: weaponId, life: 15.0 });
}

function removeWeaponDrop(i) {
    const d = weaponDrops[i];
    scene.remove(d.mesh);
    if (d.mesh.geometry) d.mesh.geometry.dispose();
    if (d.mesh.material) d.mesh.material.dispose();
    weaponDrops.splice(i, 1);
}

function updateWeaponDrops(delta) {
    for (let i = weaponDrops.length - 1; i >= 0; i--) {
        const d = weaponDrops[i];
        d.life -= delta;
        if (d.life <= 0) {
            removeWeaponDrop(i);
            continue;
        }
        d.mesh.rotation.y += delta * 1.2;
        // 消失前 3 秒闪烁提示
        if (d.life < 3) d.mesh.visible = Math.floor(d.life * 5) % 2 === 0;
    }
}

function handleWeaponPickup() {
    const promptEl = document.getElementById('pickup-prompt');
    if (!promptEl) return;
    if (gameMode !== 'bomb' || playerState.isSpectating || playerState.isControllingDrone || !roundActive || mortarMapOpen || mortarCameraActive) {
        promptEl.classList.add('hidden');
        return;
    }
    if (typeof bombState !== 'undefined' && bombState) {
        const isInteractingWithBomb = bombState.plantProgress > 0 ||
            (bombState.planted && playerState.team === 'CT' && bombState.mesh && camera && camera.position.distanceTo(bombState.mesh.position) < 15) ||
            (!bombState.planted && playerState.team === 'T' && typeof bombZones !== 'undefined' && bombZones.some(zone => 
                Math.abs(camera.position.x - zone.mesh.position.x) < 30 &&
                Math.abs(camera.position.z - zone.mesh.position.z) < 30 &&
                Math.abs(camera.position.y - zone.mesh.position.y) < 5
            ));
        if (isInteractingWithBomb) {
            promptEl.classList.add('hidden');
            return;
        }
    }
    const playerPos = getPlayerPosition();
    let nearest = -1;
    let nearestDist = 5.0;
    for (let i = 0; i < weaponDrops.length; i++) {
        const d = weaponDrops[i];
        const dist = Math.hypot(playerPos.x - d.mesh.position.x, playerPos.z - d.mesh.position.z);
        if (dist < nearestDist) { nearestDist = dist; nearest = i; }
    }
    if (nearest === -1) {
        promptEl.classList.add('hidden');
        return;
    }
    const drop = weaponDrops[nearest];
    const wInfo = WEAPONS[drop.weaponId];
    const isTouch = (typeof checkIsTouchDevice === 'function' ? checkIsTouchDevice() : Boolean(typeof isTouchDevice !== 'undefined' && isTouchDevice));
    promptEl.innerText = isTouch ? `点击拾取 ${wInfo.name}` : `按 [E] 拾取 ${wInfo.name}`;
    promptEl.classList.remove('hidden');
    if (!promptEl._touchPickupInit) {
        promptEl._touchPickupInit = true;
        promptEl.style.cursor = 'pointer';
        const triggerPickup = (e) => {
            if (e && e.preventDefault) e.preventDefault();
            isInteracting = true;
            setTimeout(() => { isInteracting = false; }, 200);
        };
        promptEl.addEventListener('click', triggerPickup);
        promptEl.addEventListener('touchstart', triggerPickup, { passive: false });
    }
    if (isInteracting && frameCount - (playerState.lastPickupFrame || -999) > 30) {
        playerState.lastPickupFrame = frameCount;
        const isSecondary = drop.weaponId === 'pistol' || drop.weaponId === 'deagle';
        if (isSecondary) {
            inventory.secondary = drop.weaponId;
            ammoState.secondary.clip = getEffectiveMag(wInfo);
            ammoState.secondary.reserve = wInfo.reserve;
            switchWeapon(2);
        } else {
            inventory.primary = drop.weaponId;
            ammoState.primary.clip = getEffectiveMag(wInfo);
            ammoState.primary.reserve = wInfo.reserve;
            switchWeapon(1);
        }
        showKillFeed(`拾取了 ${wInfo.name}`);
        removeWeaponDrop(nearest);
        promptEl.classList.add('hidden');
        updateHUD();
    }
}

// #endregion
