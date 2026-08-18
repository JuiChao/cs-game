// #region Bot 生成与子弹系统
function spawnBots(ctSpawns, tSpawns) {
    const ctMat = new THREE.MeshStandardMaterial({ color: 0x3498db }); // Blue for CT
    const tMat = new THREE.MeshStandardMaterial({ color: 0xe67e22 });  // Orange for T
    
    // Load cartoon faces from the network
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    const ctFaceTexture = textureLoader.load('https://robohash.org/ctbot?set=set3');
    const tFaceTexture = textureLoader.load('https://robohash.org/tbot?set=set3');
    
    const ctFaceMat = new THREE.MeshStandardMaterial({ map: ctFaceTexture, color: 0xffffff });
    const tFaceMat = new THREE.MeshStandardMaterial({ map: tFaceTexture, color: 0xffffff });
    
    let ctCount = 0;
    let tCount = 0;
    
    const spawnBot = (team, x, z) => {
        const teamColor = team === 'CT' ? 0x3498db : 0xe67e22;
        const bodyMat = (team === 'CT' ? ctMat : tMat).clone();
        const faceMat = (team === 'CT' ? ctFaceMat : tFaceMat).clone();

        const group = new THREE.Group();
        group.position.set(x, 0, z);

        // Torso
        const bodyGeo = new THREE.BoxGeometry(1.2, 1.4, 0.6);
        const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
        bodyMesh.position.y = 1.7; 
        bodyMesh.name = 'body';
        group.add(bodyMesh);

        // Legs
        const legGeo = new THREE.BoxGeometry(0.4, 1.0, 0.4);
        const leftLeg = new THREE.Mesh(legGeo, bodyMat);
        leftLeg.position.set(-0.3, 0.5, 0);
        leftLeg.name = 'body';
        group.add(leftLeg);
        
        const rightLeg = new THREE.Mesh(legGeo, bodyMat);
        rightLeg.position.set(0.3, 0.5, 0);
        rightLeg.name = 'body';
        group.add(rightLeg);

        // Cartoon Head (More proportional)
        const headGeo = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const materials = [
            bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat
        ];
        const headMesh = new THREE.Mesh(headGeo, materials);
        headMesh.position.y = 2.8;
        headMesh.name = 'head';
        group.add(headMesh);
        
        // Arms
        const handGeo = new THREE.SphereGeometry(0.3, 16, 16);
        const handMat = new THREE.MeshStandardMaterial({ color: 0xf1c27d });
        
        const leftHand = new THREE.Mesh(handGeo, handMat);
        leftHand.position.set(-0.9, 1.8, 0.3);
        group.add(leftHand);

        const rightHand = new THREE.Mesh(handGeo, handMat);
        rightHand.position.set(0.9, 1.8, 0.3);
        group.add(rightHand);
        // Buy logic
        let money = team === 'T' ? matchState.botMoneyT[tCount] : matchState.botMoneyCT[ctCount];
        let weaponId = 'pistol';
        let hasDrone = false;
        
        if (money >= 800 && Math.random() < 0.25) {
            hasDrone = true;
            money -= 800;
        }

        if (money >= 4750) { weaponId = 'sniper'; money -= 4750; }
        else if (money >= 3500) { weaponId = 'marksman'; money -= 3300; }
        else if (money >= 3100) { weaponId = 'rifle'; money -= 2700; }
        else if (money >= 1500) { weaponId = 'smg'; money -= 1500; }
        else if (money >= 1200) { weaponId = 'shotgun'; money -= 1200; }
        else if (money >= 700) { weaponId = 'deagle'; money -= 700; }
        
        if (team === 'T') { matchState.botMoneyT[tCount] = money; tCount++; }
        else { matchState.botMoneyCT[ctCount] = money; ctCount++; }
        
        // Weapon
        const wInfo = WEAPONS[weaponId];
        const gunGeo = new THREE.BoxGeometry(0.15, 0.15, wInfo.length);
        const gunMat = new THREE.MeshStandardMaterial({ color: wInfo.color });
        const gunMesh = new THREE.Mesh(gunGeo, gunMat);
        
        // Magazine
        const botMagGeo = new THREE.BoxGeometry(0.12, 0.22, 0.12);
        const botMagMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
        const botMag = new THREE.Mesh(botMagGeo, botMagMat);
        botMag.position.set(0, -0.15, 0.1);
        botMag.name = 'magazine';
        gunMesh.add(botMag);
        
        gunMesh.position.set(0.9, 1.8, 0.8);
        group.add(gunMesh);

        scene.add(group);

        bots.push({
            id: Math.random().toString(36).substring(7),
            team: team,
            mesh: group,
            hp: 100,
            targetNode: new THREE.Vector3(x + (Math.random()-0.5)*40, 0, z + (Math.random()-0.5)*40),
            lastShot: 0,
            weapon: weaponId,
            actionProgress: 0,
            burnStacks: 0,
            burnTimer: 0,
            poisonTimer: 0,
            poisonDelay: 0,
            poisonDamageApplied: false,
            bombTarget: null,
            hasDrone: hasDrone,
            isControllingDrone: false
        });
    };

    // Spawn CT Squads
    for (let i = 0; i < 5; i++) {
        let spawnPos = ctSpawns[i];
        let numBots = (playerState.team === 'CT' && i === 0) ? 1 : 2;
        for (let j = 0; j < numBots; j++) {
            spawnBot('CT', spawnPos.x + (Math.random()-0.5)*4, spawnPos.z + (Math.random()-0.5)*4);
        }
    }
    // Spawn T Squads
    for (let i = 0; i < 5; i++) {
        let spawnPos = tSpawns[i];
        let numBots = (playerState.team === 'T' && i === 0) ? 1 : 2;
        for (let j = 0; j < numBots; j++) {
            spawnBot('T', spawnPos.x + (Math.random()-0.5)*4, spawnPos.z + (Math.random()-0.5)*4);
        }
    }
    
    if (roundTimerInterval) clearInterval(roundTimerInterval);
    roundTime = 240;
    roundTimerInterval = setInterval(() => {
        if (roundActive && !bombState.planted) {
            roundTime--;
            if (roundTime === 120 && !wallhackActive) {
                activateWallhack("剩余两分钟！全图透视与死斗模式开启！");
            }
            if (roundTime <= 0) {
                endRound("时间到！反恐精英获胜", false, 'time');
            }
            updateHUD();
        }
    }, 1000);
}

function disposeBulletMesh(b) {
    // Bullets use shared geometry/material — no GPU resources to dispose per bullet
    // Just remove from scene; shared resources persist for game lifetime
    if (!b.mesh) return;
}

function hasBulletType(b, type) {
    if (b.bulletTypes) return b.bulletTypes.includes(type);
    return b.bulletType === type;
}

function createBullet(start, direction, weapon, shooterInfo) {
    const isShotgun = weapon && weapon.id === 'shotgun';
    const bt = shooterInfo.bulletType || 'normal';
    const bts = shooterInfo.bulletTypes || null;
    let mat;
    if (isShotgun) {
        mat = sharedBulletMatOrange;
    } else if (bts && bts.length > 1) {
        mat = sharedBulletMatWhite;
    } else if (bt === 'incendiary') {
        mat = sharedBulletMatRed;
    } else if (bt === 'poison') {
        mat = sharedBulletMatGreen;
    } else if (bt === 'tracking') {
        mat = sharedBulletMatCyan;
    } else if (bt === 'light') {
        mat = sharedBulletMatLightBlue;
    } else if (bt === 'dual') {
        mat = sharedBulletMatMagenta;
    } else {
        mat = sharedBulletMatYellow;
    }
    const isGatling = weapon && weapon.id === 'gatling';
    const mesh = new THREE.Mesh(isGatling ? sharedBulletGeoGatling : sharedBulletGeo, mat);
    mesh.position.copy(start);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), direction);
    scene.add(mesh);
    
    if (isShotgun) {
        for (let j = 0; j < 3; j++) {
            let flame = new THREE.Mesh(sharedFlameGeo, sharedFlameMat);
            flame.position.set((Math.random()-0.5)*0.2, (Math.random()-0.5)*0.2, (Math.random()-0.5)*0.8);
            flame.rotation.set(Math.random()*Math.PI, Math.random()*Math.PI, Math.random()*Math.PI);
            mesh.add(flame);
        }
    }
    
    bullets.push({
        mesh: mesh,
        direction: direction,
        weapon: weapon,
        shooter: shooterInfo,
        bulletType: shooterInfo.bulletType || 'normal',
        bulletTypes: shooterInfo.bulletTypes || null,
        distance: 0,
        maxDistance: weapon.range,
        hitRadius: isGatling ? 3.5 : 2.0,
        divergenceSide: shooterInfo.divergenceSide || 0
    });
}

function updateBullets(delta) {
    const _floorMesh = scene.getObjectByName('floor');
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        
        let speed = 527.34375; // default bullet speed
        if (b.weapon && b.weapon.id === 'sniper') {
            speed = 1230.46875; // sniper rifle
        } else if (b.weapon && b.weapon.id === 'marksman') {
            speed = 1031.25; // marksman
        } else if (b.weapon && b.weapon.id === 'deagle') {
            speed = 685.546875; // deagle
        }

        if (hasBulletType(b, 'tracking')) speed *= 0.1;
        if (hasBulletType(b, 'light')) speed *= 1.2;
        if (hasBulletType(b, 'dual')) speed *= 0.35;

        const moveDist = speed * delta;
        b.distance += moveDist;

        // Tracking bullet: steer toward nearest enemy or range target (low efficiency)
        if (hasBulletType(b, 'tracking')) {
            let nearestTarget = null;
            let nearestDistSq = 60 * 60;
            for (let j = 0; j < bots.length; j++) {
                let bot = bots[j];
                if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                let distSq = b.mesh.position.distanceToSquared(bot.mesh.position);
                if (distSq < nearestDistSq) {
                    nearestDistSq = distSq;
                    nearestTarget = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                }
            }
            if (nearestTarget) {
                let targetDir = new THREE.Vector3()
                    .subVectors(nearestTarget, b.mesh.position)
                    .normalize();
                b.direction.lerp(targetDir, 0.24).normalize();
                b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), b.direction);
            }
        }

        // Dual bullet divergence: gradually curve up/down, growing with distance flown
        if (b.divergenceSide) {
            let divRate = 0.00075 + b.distance * 0.000003375;
            let absDiv = Math.abs(b.direction.y);
            if (absDiv < 0.02) {
                b.direction.y += divRate * b.divergenceSide;
                b.direction.normalize();
                b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), b.direction);
            }
        }

        // Bullet drop: parabolic downward curve based on weapon drop rate (accumulates over distance)
        if (b.weapon && b.weapon.dropRate) {
            if (b.dropAccum === undefined) b.dropAccum = 0;
            b.dropAccum += b.weapon.dropRate * moveDist;
            b.direction.y -= b.dropAccum;
            b.direction.normalize();
            b.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1), b.direction);
        }

        // Raycast for collision
        raycaster.set(b.mesh.position, b.direction);
        raycaster.far = moveDist;
        
        let targets = bots.map(bot => bot.mesh).concat(activeDrones.map(d => d.mesh)).concat(collidableMeshList);
        if (_floorMesh) targets.push(_floorMesh);
        const intersects = raycaster.intersectObjects(targets, true);
        
        // Player hit check
        let hitPlayer = false;
        let isPlayerHeadshot = false;
        if (b.shooter.team !== playerState.team && playerState.hp > 0 && !playerState.isSpectating) {
            const playerPos = getPlayerPosition();
            const pToB = new THREE.Vector3().subVectors(playerPos, b.mesh.position);
            const projectionLength = pToB.dot(b.direction);
            
            let closestPoint;
            if (projectionLength <= 0) closestPoint = b.mesh.position.clone();
            else if (projectionLength >= moveDist) closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(moveDist));
            else closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(projectionLength));
            
            if (closestPoint.distanceTo(playerPos) < b.hitRadius) {
                if (intersects.length === 0 || intersects[0].distance > projectionLength) {
                    hitPlayer = true;
                    if (closestPoint.y > playerPos.y - 0.4) isPlayerHeadshot = true;
                }
            }
        }
        
        if (hitPlayer) {
            let dmg = b.weapon.damage * 0.75;
            if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) dmg *= 0.70;
            if (hasBulletType(b, 'dual')) dmg *= 0.65;
            if (isPlayerHeadshot) dmg *= 2.7;
            if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'kukri' || getCurrentWeapon().id === 'switchblade' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) {
                if (isPlayerHeadshot) dmg *= 0.0125;
                else dmg *= 0.05;
            }
            let finalDmg = dmg;
            if (getCurrentWeapon().id === 'kukri' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) finalDmg *= 0.025;
            else if (getCurrentWeapon().id === 'switchblade') finalDmg *= 0.04;
            if (!playerState.isInvincible) playerState.hp -= Math.ceil(applyArmorReduction(finalDmg));
            if (b.weapon.id === 'shotgun') {
                playerState.burnStacks = Math.min(6, (playerState.burnStacks || 0) + 1);
                playerState.burnTimer = 300;
                playerState.burnSourceTeam = b.shooter.team;
            }
            playerState.lastCombatTime = frameCount;
            updateHUD();
            createHitEffect(getPlayerPosition(), false, b.weapon.id);

            if (hasBulletType(b, 'proximity')) {
                let explosionDmg = dmg * 0.75;
                let explosionPos = getPlayerPosition();
                createExplosionEffect(explosionPos);
                for (let j = 0; j < bots.length; j++) {
                    let bot = bots[j];
                    if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                    let dist = bot.mesh.position.distanceTo(explosionPos);
                    if (dist < 8) {
                        let areaDmg = explosionDmg * (1 - dist / 8);
                        bot.hp -= areaDmg;
                        if (bot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id);
                    }
                }
                if (isShootingRange) {
                    rangeTargets.forEach(t => {
                        const dist = t.position.distanceTo(explosionPos);
                        if (dist < 8) {
                            const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                            if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                        }
                    });
                }
            }

            disposeBulletMesh(b);
            scene.remove(b.mesh);
            bullets.splice(i, 1);

            if (playerState.hp <= 0) playerDie(b.team, b.weapon.id);
            continue;
        }

        // Radius-based bot hit check (for larger bullets like Gatling)
        if (b.hitRadius > 2.0) {
            let radiusHitBot = null;
            let radiusHitIndex = -1;
            let radiusHitPoint = null;
            for (let j = 0; j < bots.length; j++) {
                let bot = bots[j];
                if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                let botPos = bot.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
                const pToB = new THREE.Vector3().subVectors(botPos, b.mesh.position);
                const projectionLength = pToB.dot(b.direction);
                if (projectionLength <= 0 || projectionLength >= moveDist) continue;
                let closestPoint = b.mesh.position.clone().add(b.direction.clone().multiplyScalar(projectionLength));
                if (closestPoint.distanceTo(botPos) < b.hitRadius) {
                    if (intersects.length === 0 || intersects[0].distance > projectionLength) {
                        radiusHitBot = bot;
                        radiusHitIndex = j;
                        radiusHitPoint = closestPoint;
                        break;
                    }
                }
            }
            if (radiusHitBot) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) dmg *= 0.70;
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                radiusHitBot.hp -= dmg;

                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((radiusHitBot.burnStacks || 0) < 20) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = 300;
                    radiusHitBot.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((radiusHitBot.burnStacks || 0) < 6) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = 300;
                    radiusHitBot.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((radiusHitBot.burnStacks || 0) < 20) radiusHitBot.burnStacks = (radiusHitBot.burnStacks || 0) + 1;
                    radiusHitBot.burnTimer = Math.max(radiusHitBot.burnTimer || 0, 180);
                    radiusHitBot.burnDamageMult = 0.25;
                }

                if (hasBulletType(b, 'poison')) {
                    radiusHitBot.poisonTimer = 480;
                    radiusHitBot.poisonTickTimer = 34;
                }

                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    radiusHitBot.hp -= explosionDmg;
                    createExplosionEffect(radiusHitPoint);
                    for (let j = 0; j < bots.length; j++) {
                        if (j === radiusHitIndex) continue;
                        let otherBot = bots[j];
                        if (otherBot.team === b.shooter.team || otherBot.hp <= 0) continue;
                        let dist = otherBot.mesh.position.distanceTo(radiusHitPoint);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            otherBot.hp -= areaDmg;
                            if (otherBot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(radiusHitPoint);
                            if (dist < 8) {
                                const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                            }
                        });
                    }
                }

                createHitEffect(radiusHitPoint, false, b.weapon.id);
                if (radiusHitBot.hp <= 0) killBot(radiusHitIndex, b.shooter.team, b.weapon.id);

                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
                continue;
            }
        }

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
            
            if (hitRangeTarget) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) dmg *= 0.70;
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                if (hit.object.name === 'rangeTargetHead') dmg *= 3.0; // Headshot multiplier
                showFloatingDamage(dmg, hit.point);

                // Add burn/poison effects to the target group
                let targetObj = hit.object.parent;
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = 300;
                    targetObj.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((targetObj.burnStacks || 0) < 6) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = 300;
                    targetObj.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((targetObj.burnStacks || 0) < 20) targetObj.burnStacks = (targetObj.burnStacks || 0) + 1;
                    targetObj.burnTimer = Math.max(targetObj.burnTimer || 0, 180);
                    targetObj.burnDamageMult = 0.25;
                }

                if (hasBulletType(b, 'poison')) {
                    targetObj.poisonTimer = 360;
                    targetObj.poisonTickTimer = 34;
                }
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    createExplosionEffect(hit.point);
                    showFloatingDamage(explosionDmg, hit.point);
                    rangeTargets.forEach(t => {
                        if (t === targetObj) return;
                        const dist = t.position.distanceTo(hit.point);
                        if (dist < 8) {
                            const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                            if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                        }
                    });
                }
                
                createHitEffect(hit.point, false, b.weapon.id);
                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
                continue;
            }
            
            if (hitBot && hitBot.team !== b.shooter.team) {
                let dmg = b.weapon.damage;
                if (hasBulletType(b, 'tracking')) dmg *= 0.50;
                if (hasBulletType(b, 'light')) dmg *= 0.70;
                if (hasBulletType(b, 'dual')) dmg *= 0.65;
                if (hit.object.name === 'head') dmg *= 3.0; // Headshot
                hitBot.hp -= dmg;
                // Burn effects (shotgun dragon breath + incendiary synergy)
                if (b.weapon.id === 'shotgun' && hasBulletType(b, 'incendiary')) {
                    if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = 300;
                    hitBot.burnDamageMult = 0.25;
                } else if (b.weapon.id === 'shotgun') {
                    if ((hitBot.burnStacks || 0) < 6) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = 300;
                    hitBot.burnDamageMult = 1;
                } else if (hasBulletType(b, 'incendiary')) {
                    if ((hitBot.burnStacks || 0) < 20) hitBot.burnStacks = (hitBot.burnStacks || 0) + 1;
                    hitBot.burnTimer = Math.max(hitBot.burnTimer || 0, 180);
                    hitBot.burnDamageMult = 0.25;
                }

                // Poison effect (independent)
                if (hasBulletType(b, 'poison')) {
                    hitBot.poisonTimer = 480;
                    hitBot.poisonTickTimer = 34;
                }
                // Proximity explosion (independent)
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = dmg * 0.75;
                    hitBot.hp -= explosionDmg;
                    createExplosionEffect(hit.point);
                    for (let j = 0; j < bots.length; j++) {
                        if (j === hitIndex) continue;
                        let otherBot = bots[j];
                        if (otherBot.team === b.shooter.team || otherBot.hp <= 0) continue;
                        let dist = otherBot.mesh.position.distanceTo(hit.point);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            otherBot.hp -= areaDmg;
                            if (otherBot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(hit.point);
                            if (dist < 8) {
                                const tDmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (tDmg > 0) showFloatingDamage(tDmg, t.position);
                            }
                        });
                    }
                }

                createHitEffect(hit.point, false, b.weapon.id);

                if (hitBot.hp <= 0) killBot(hitIndex, b.shooter.team, b.weapon.id);
            } else if (hitDrone && hitDrone.team !== b.shooter.team) {
                hitDrone.hp -= b.weapon.damage;
                createHitEffect(hit.point, false, b.weapon.id);
                if (hitDrone.hp <= 0) destroyDrone(hitDrone, false);
            } else if (!hitBot && !hitDrone) {
                createHitEffect(hit.point, true, b.weapon.id); // Wall hit
                if (hasBulletType(b, 'proximity')) {
                    let explosionDmg = b.weapon.damage * 0.75;
                    createExplosionEffect(hit.point);
                    for (let j = 0; j < bots.length; j++) {
                        let bot = bots[j];
                        if (bot.team === b.shooter.team || bot.hp <= 0) continue;
                        let dist = bot.mesh.position.distanceTo(hit.point);
                        if (dist < 8) {
                            let areaDmg = explosionDmg * (1 - dist / 8);
                            bot.hp -= areaDmg;
                            if (bot.hp <= 0) killBot(j, b.shooter.team, b.weapon.id);
                        }
                    }
                    if (isShootingRange) {
                        rangeTargets.forEach(t => {
                            const dist = t.position.distanceTo(hit.point);
                            if (dist < 8) {
                                const dmg = Math.round(explosionDmg * (1 - dist / 8));
                                if (dmg > 0) showFloatingDamage(dmg, t.position);
                            }
                        });
                    }
                }
            }

            disposeBulletMesh(b);
            scene.remove(b.mesh);
            bullets.splice(i, 1);
        } else {
            b.mesh.position.add(b.direction.clone().multiplyScalar(moveDist));
            if (b.distance >= 2000) { // Fix: don't despawn based on weapon.range, use map size limit
                disposeBulletMesh(b);
                scene.remove(b.mesh);
                bullets.splice(i, 1);
            }
        }
    }
}

function createBurnParticle(pos) {
    const pColor = Math.random() > 0.4 ? 0xff0000 : 0xff5500;
    const mat = new THREE.MeshBasicMaterial({ color: pColor });
    const mesh = new THREE.Mesh(sharedParticleGeo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 1.5;
    mesh.position.z += (Math.random() - 0.5) * 1.5;
    mesh.position.y += (Math.random() - 0.5) * 1.5;
    scene.add(mesh);
    
    particles.push({
        mesh: mesh,
        velocity: new THREE.Vector3((Math.random()-0.5)*5, Math.random()*8 + 2, (Math.random()-0.5)*5),
        life: 0.8 + Math.random() * 0.4
    });
}

function createHitEffect(pos, isWall, weaponId = null) {
    const color = isWall ? 0xaaaaaa : 0xff0000;
    const isDragonBreath = weaponId === 'shotgun';
    const count = isDragonBreath ? 7 : 5;
    
    for(let i = 0; i < count; i++) {
        const pColor = isDragonBreath ? (Math.random() > 0.4 ? 0xff0000 : 0xff5500) : color;
        const mat = new THREE.MeshBasicMaterial({ color: pColor });
        const mesh = new THREE.Mesh(sharedParticleGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        
        let velocity;
        if (isDragonBreath) {
            velocity = new THREE.Vector3((Math.random()-0.5)*15, Math.random()*15, (Math.random()-0.5)*15);
        } else {
            velocity = new THREE.Vector3((Math.random()-0.5)*10, Math.random()*10, (Math.random()-0.5)*10);
        }
        
        particles.push({
            mesh: mesh,
            velocity: velocity,
            life: isDragonBreath ? 1.5 + Math.random() * 0.5 : 1.0
        });
    }
}

function createExplosionEffect(pos) {
    const count = 15;
    for (let i = 0; i < count; i++) {
        const pColor = Math.random() > 0.3 ? 0xff6600 : 0xffaa00;
        const mat = new THREE.MeshBasicMaterial({ color: pColor });
        const mesh = new THREE.Mesh(sharedParticleGeo, mat);
        mesh.position.copy(pos);
        scene.add(mesh);
        particles.push({
            mesh: mesh,
            velocity: new THREE.Vector3((Math.random()-0.5)*25, Math.random()*20, (Math.random()-0.5)*25),
            life: 1.2 + Math.random() * 0.6
        });
    }
}

function createPoisonParticle(pos) {
    const mat = new THREE.MeshBasicMaterial({ color: 0x44ff00 });
    const mesh = new THREE.Mesh(sharedParticleGeo, mat);
    mesh.position.copy(pos);
    mesh.position.x += (Math.random() - 0.5) * 1.2;
    mesh.position.z += (Math.random() - 0.5) * 1.2;
    scene.add(mesh);
    particles.push({
        mesh: mesh,
        velocity: new THREE.Vector3((Math.random()-0.5)*3, Math.random()*4 + 1, (Math.random()-0.5)*3),
        life: 0.6 + Math.random() * 0.3
    });
}
function createMuzzleFire(pos, dir) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const pColor = Math.random() > 0.4 ? 0xff0000 : 0xff5500;
        const mat = new THREE.MeshBasicMaterial({ color: pColor });
        const mesh = new THREE.Mesh(sharedMuzzleGeo, mat);

        mesh.position.copy(pos).add(dir.clone().multiplyScalar(2.5));
        scene.add(mesh);

        let velocity = dir.clone().multiplyScalar(25 + Math.random() * 15);
        velocity.x += (Math.random() - 0.5) * 4;
        velocity.y += (Math.random() - 0.5) * 4;
        velocity.z += (Math.random() - 0.5) * 4;

        particles.push({
            mesh: mesh,
            velocity: velocity,
            life: 0.3 + Math.random() * 0.3
        });
    }
}

function createFlameStream(pos, dir, range) {
    const count = 6;
    for (let i = 0; i < count; i++) {
        const r = Math.random();
        const pColor = r > 0.5 ? 0xff6600 : (r > 0.2 ? 0xffaa00 : 0xff3300);
        const mat = new THREE.MeshBasicMaterial({ color: pColor, transparent: true, opacity: 0.2 });
        const mesh = new THREE.Mesh(sharedMuzzleGeo, mat);
        mesh.position.copy(pos);
        mesh.position.x += (Math.random() - 0.5) * 0.4;
        mesh.position.y += (Math.random() - 0.5) * 0.4;
        mesh.position.z += (Math.random() - 0.5) * 0.4;
        mesh.scale.setScalar(1.0 + Math.random() * 0.8);
        scene.add(mesh);

        let velocity = dir.clone().multiplyScalar(30 + Math.random() * 25);
        velocity.x += (Math.random() - 0.5) * 8;
        velocity.y += (Math.random() - 0.5) * 8;
        velocity.z += (Math.random() - 0.5) * 8;

        particles.push({
            mesh: mesh,
            velocity: velocity,
            life: 0.3 + Math.random() * 0.4,
            opacityMult: 0.2
        });
    }
}

function showFloatingDamage(amount, worldPos) {
    if (amount <= 0) return;
    
    const container = document.getElementById('damage-numbers');
    if (!container) return;
    
    const elem = document.createElement('div');
    elem.className = 'damage-text';
    elem.innerText = Math.ceil(amount);
    
    const offsetPos = worldPos.clone();
    offsetPos.x += (Math.random() - 0.5) * 1.5;
    offsetPos.y += 0.5 + Math.random() * 1.0;
    offsetPos.z += (Math.random() - 0.5) * 1.5;
    
    container.appendChild(elem);
    
    floatingDamages.push({
        elem: elem,
        pos: offsetPos,
        life: 1.5,
        maxLife: 1.5
    });
}

function updateFloatingDamages(delta) {
    for (let i = floatingDamages.length - 1; i >= 0; i--) {
        const fd = floatingDamages[i];
        fd.life -= delta;
        if (fd.life <= 0) {
            if (fd.elem.parentNode) fd.elem.parentNode.removeChild(fd.elem);
            floatingDamages.splice(i, 1);
            continue;
        }
        
        fd.pos.y += 1.0 * delta; // float up
        
        const temp = fd.pos.clone();
        temp.project(camera);
        
        if (temp.z > 1) {
            fd.elem.style.display = 'none'; // Behind camera
        } else {
            fd.elem.style.display = 'block';
            const x = (temp.x * 0.5 + 0.5) * window.innerWidth;
            const y = (temp.y * -0.5 + 0.5) * window.innerHeight;
            fd.elem.style.left = `${x}px`;
            fd.elem.style.top = `${y}px`;
            
            const alpha = Math.min(1, fd.life / (fd.maxLife * 0.5)); // fade out
            fd.elem.style.opacity = alpha;
            fd.elem.style.transform = `translate(-50%, -50%) scale(${1 + (1 - fd.life/fd.maxLife)*0.5})`;
        }
    }
}

function updateMagazines(delta) {
    for (let i = droppedMagazines.length - 1; i >= 0; i--) {
        const mag = droppedMagazines[i];
        mag.life -= delta;
        if (mag.life <= 0) {
            scene.remove(mag.mesh);
            droppedMagazines.splice(i, 1);
            continue;
        }

        mag.velocity.y -= 20 * delta; // Gravity
        
        const nextPos = mag.mesh.position.clone().add(mag.velocity.clone().multiplyScalar(delta));
        if (nextPos.y <= 0.05) {
            nextPos.y = 0.05;
            mag.velocity.y *= -0.4; // Bounce
            mag.velocity.x *= 0.7; // Friction
            mag.velocity.z *= 0.7;
        } else {
            mag.mesh.rotation.x += mag.rotSpeed.x * delta;
            mag.mesh.rotation.y += mag.rotSpeed.y * delta;
            mag.mesh.rotation.z += mag.rotSpeed.z * delta;
        }
        
        mag.mesh.position.copy(nextPos);
    }
}

function updateParticles(delta) {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life -= delta * 2;
        if (p.life <= 0) {
            scene.remove(p.mesh);
            // Only dispose material; geometry is shared across particles
            if (p.mesh.material) p.mesh.material.dispose();
            particles.splice(i, 1);
        } else {
            p.velocity.y -= 20 * delta; // gravity
            p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
            p.mesh.material.opacity = p.life * (p.opacityMult || 1);
            p.mesh.material.transparent = true;
        }
    }
}

// #endregion
