// #region 射击与战斗
function handleShooting(initialClick = false) {
    if (playerState.isSpectating) return;
    if (!controls || !controls.isLocked) return;
    
    if (playerState.isControllingDrone) {
        if (!initialClick) return;
        if (inventory.currentSlot !== 4) return;
        const weapon = getCurrentWeapon();
        if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'sandbag'].includes(weapon.id)) return;
        
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team, true);
        
        inventory.grenades[weapon.id]--;
        
        const types = ['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'];
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
    if (!weapon.auto && !initialClick) return;
    if (!isShooting) {
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

    if (playerState.bulletType === 'light' || (playerState.bulletStacking && playerState.bulletTypes.includes('light'))) {
        requiredCooldown *= 0.65;
    }

    let isDualBullet = playerState.bulletType === 'dual' || (playerState.bulletStacking && playerState.bulletTypes && playerState.bulletTypes.includes('dual'));
    if (isDualBullet && weapon.id !== 'ash12') {
        requiredCooldown *= 1.45;
    }
    if (weapon.id === 'switchblade' && playerState.knifeComboStage === 2) requiredCooldown = 48;
    if (frameCount - playerState.lastShot < requiredCooldown) return;

    let currentAmmo = inventory.currentSlot === 1 ? ammoState.primary : (inventory.currentSlot === 2 ? ammoState.secondary : (inventory.currentSlot === 4 ? ammoState.grenade : null));
    
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade' && inventory.currentSlot !== 4) {
        if (currentAmmo && currentAmmo.clip <= 0) {
            if (initialClick && currentAmmo.reserve > 0) handleReload();
            return;
        }
        currentAmmo.clip--;
    }

    if (inventory.currentSlot === 4) {
        const camDir = new THREE.Vector3();
        camera.getWorldDirection(camDir);
        
        if (weapon.id === 'drone') {
            createDrone(camera.position.clone(), camDir, playerState.team);
        } else {
            createGrenade(camera.position.clone(), camDir, weapon.id, playerState.team);
        }
        
        inventory.grenades[weapon.id]--;
        
        const types = ['hegrenade', 'flashbang', 'molotov', 'sandbag', 'drone'];
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
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade') {
        playerState.lastCombatTime = frameCount;
    }
    updateHUD();
    
    // View model recoil animation
    if(playerState.viewModel) {
        if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
            playerState.knifeAnimStart = performance.now();
        } else if (weapon.id !== 'flamethrower') {
            const kickback = playerState.isAds ? 0.002 : 0.1;
            playerState.viewModel.position.z += kickback; // Kickback
            setTimeout(() => {
                if(playerState.viewModel) {
                    playerState.viewModel.position.z -= kickback;
                }
            }, 50);
        }
    }

    if (weapon.id === 'knife' || weapon.id === 'kukri' || weapon.id === 'switchblade') {
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
            
            if (weapon.id === 'kukri') playKukriSwingSound(playerState.knifeComboStage);
            else playKnifeSwingSound(playerState.knifeComboStage);

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
                bestTarget.hp -= dmg;
                createHitEffect(hitPoint, false);
                if (weapon.id === 'knife' || weapon.id === 'switchblade') {
                    playerState.hp = Math.min(100, playerState.hp + 5);
                    updateHUD();
                }
                if (bestTarget.hp <= 0) killBot(hitIndex, playerState.team, weapon.id);
            } else if (targetType === 'drone' && bestTarget.team !== playerState.team) {
                bestTarget.hp -= dmg;
                createHitEffect(hitPoint, false);
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

        raycaster.set(camera.position, camDir);
        raycaster.far = weapon.range;
        const _floorMesh = scene.getObjectByName('floor');
        let targets = bots.map(bot => bot.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
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
                hitBot.hp -= weapon.damage;
                if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                hitBot.burnTimer = 300;
                hitBot.burnDamageMult = 0.25;
                createHitEffect(hit.point, false, 'shotgun');
                if (hitBot.hp <= 0) killBot(hitIndex, playerState.team, weapon.id);
            } else if (hitDrone && hitDrone.team !== playerState.team) {
                hitDrone.hp -= weapon.damage;
                createHitEffect(hit.point, false, 'shotgun');
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (hitRangeTarget) {
                let dmg = weapon.damage;
                if (hit.object.name === 'rangeTargetHead') dmg *= 3.0;
                showFloatingDamage(dmg, hit.point);
                let targetObj = hit.object.parent;
                if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                targetObj.burnTimer = 300;
                targetObj.burnDamageMult = 0.25;
                createHitEffect(hit.point, false, 'shotgun');
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

        let shooterInfo = { team: playerState.team, bulletType: playerState.bulletType || 'normal', bulletTypes: playerState.bulletStacking ? playerState.bulletTypes : null };
        if (isDualBullet && weapon.id !== 'shotgun') {
            shooterInfo.divergenceSide = (i === 0 ? 1 : -1);
        }
        createBullet(start, dir, weapon, shooterInfo);
    }



    // Camera recoil (deterministic pattern-based, CS-style)
    if (weapon.id !== 'knife' && weapon.id !== 'kukri' && weapon.id !== 'switchblade') {
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
    if (killerTeam) {
        const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
        showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 你`);
    }

    playerState.isSpectating = true;
    document.exitPointerLock();
    document.getElementById('spectator-prompt').classList.remove('hidden');
    if (playerState.isControllingDrone) {
        const pd = activeDrones.find(d => d.isPlayer);
        if (pd) destroyDrone(pd, false);
    }
    cycleSpectator();
    checkWinCondition();
}

function killBot(index, killerTeam, weaponId = 'rifle') {
    const bot = bots[index];
    const wName = WEAPONS[weaponId] ? WEAPONS[weaponId].name : weaponId;
    
    if (killerTeam === playerState.team) {
        const reward = WEAPONS[weaponId] ? WEAPONS[weaponId].killReward : 300;
        playerCurrency += reward;
        playerScore += 10;
        document.getElementById('hud-credits').innerText = playerCurrency;
        const _hudScore = document.getElementById('hud-score');
        if (_hudScore) _hudScore.innerText = playerScore;
        showKillFeed(`你 使用 ${wName} 击杀了 [${bot.team}] BOT (+$${reward})`);
        
        if (weaponId === 'knife' || weaponId === 'kukri' || weaponId === 'switchblade') {
            playerState.hp = Math.min(100, playerState.hp + 10);
            updateHUD();
        }
    } else {
        showKillFeed(`[${killerTeam}] BOT 使用 ${wName} 击杀了 [${bot.team}] BOT`);
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

// #endregion
