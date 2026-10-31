// #region 无人机系统
function createDrone(start, direction, team, isPlayer = true, ownerId = null) {
    if (isPlayer && activeDrones.some(d => d.isPlayer)) return false; // Only 1 player drone
    
    // Create Drone Mesh (Small cross with center)
    const droneGroup = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({ color: team === 'T' ? 0xd35400 : 0x2980b9 });
    const center = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.6), mat);
    const arm1 = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.2), mat);
    const arm2 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.1, 1.4), mat);
    droneGroup.add(center);
    droneGroup.add(arm1);
    droneGroup.add(arm2);
    
    droneGroup.position.copy(start).add(direction.clone().multiplyScalar(2));
    scene.add(droneGroup);
    
    // Create explosion indicator (hidden initially)
    const ringGeo = new THREE.RingGeometry(25.35, 29.25, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: team === 'T' ? 0xff0000 : 0x00ff00, side: THREE.DoubleSide, transparent: true, opacity: 0.5 });
    const indicator = new THREE.Mesh(ringGeo, ringMat);
    indicator.rotation.x = -Math.PI / 2; // Flat on ground
    scene.add(indicator);
    
    const drone = {
        id: Math.random().toString(36).substring(7),
        mesh: droneGroup,
        targetIndicator: indicator,
        velocity: new THREE.Vector3(),
        isPlayer: isPlayer,
        ownerId: ownerId, // for bot
        team: team,
        playerPos: start.clone(), // origin point
        selfDestructing: false,
        hp: 50
    };
    activeDrones.push(drone);
    
    if (isPlayer) {
        playerState.isControllingDrone = true;
        if (typeof createPlayerDummy === 'function') createPlayerDummy();
    }
    
    if (typeof updateHUD === 'function') updateHUD();
    return drone;
}

function triggerDroneExplosion(drone) {
    const pos = drone.targetIndicator.position;
    if (typeof createHitEffect === 'function') createHitEffect(pos, false);
    if (typeof playExplosionSound === 'function') playExplosionSound(pos);
    const ownerBot = (!drone.isPlayer && drone.ownerId) ? bots.find(b => b.id === drone.ownerId) : null;
    for (let index = bots.length - 1; index >= 0; index--) {
        const b = bots[index];
        if (b.isDead) continue;
        const dist = b.mesh.position.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (b.team !== drone.team) {
                const mult = typeof zombieExplosiveDmgMult === 'function' ? zombieExplosiveDmgMult(b) : 1;
                b.hp -= dmg * 0.75 * mult;
                if (b.hp <= 0 && typeof killBot === 'function') killBot(index, drone.team, 'drone', !!drone.isPlayer, ownerBot);
            }
        }
    }
    
    if (typeof isShootingRange !== 'undefined' && isShootingRange && typeof rangeTargets !== 'undefined') {
        rangeTargets.forEach(t => {
            const dist = t.position.distanceTo(pos);
            if (dist < 29.25) {
                const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
                if (dmg > 0 && typeof showFloatingDamage === 'function') showFloatingDamage(dmg, t.position);
            }
        });
    }
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const playerPos = typeof getPlayerPosition === 'function' ? getPlayerPosition() : camera.position;
        const dist = playerPos.distanceTo(pos);
        if (dist < 29.25) {
            const dmg = Math.round(Math.max(0, 175 * (1 - dist / 29.25)));
            if (playerState.team !== drone.team) {
                let actualDmg = dmg * 0.75;
                const curW = typeof getCurrentWeapon === 'function' ? getCurrentWeapon() : null;
                if (curW) {
                    if (curW.id === 'kukri' || (curW.id === 'flamethrower' && typeof isShooting !== 'undefined' && isShooting)) actualDmg *= 0.025;
                    else if (curW.id === 'knife' || curW.id === 'switchblade') actualDmg *= 0.05;
                }
                const reduction = typeof applyArmorReduction === 'function' ? applyArmorReduction(actualDmg) : actualDmg;
                if (!playerState.isInvincible) playerState.hp -= Math.ceil(reduction);
                if (typeof triggerDamageVignette === 'function') triggerDamageVignette(reduction / 35);
                if (typeof playerState !== 'undefined') playerState.cameraShake = Math.min(0.035, (playerState.cameraShake || 0) + 0.02);
                if (typeof frameCount !== 'undefined') playerState.lastCombatTime = frameCount;
                if (playerState.hp <= 0 && typeof playerDie === 'function') playerDie(drone.team, 'drone');
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
            let dirZ = 0;
            let dirX = 0;
            let dirY = 0;
            const buyMenu = typeof document !== 'undefined' ? document.getElementById('buy-menu') : null;
            const menuOpen = buyMenu && !buyMenu.classList.contains('hidden');
            if (!playerState.isSpectating && !menuOpen) {
                dirZ = Number(moveForward) - Number(moveBackward);
                dirX = Number(moveRight) - Number(moveLeft);
                dirY = Number(moveUp) - Number(moveDown);
            }
        
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
            const forward = new THREE.Vector3();
            forward.crossVectors(camera.up, right).normalize();
        
            let currentSpeed = drone.selfDestructing ? 437.5 : 250.0;
            if (dirZ !== 0) drone.velocity.add(forward.clone().multiplyScalar(dirZ * currentSpeed * delta));
            if (dirX !== 0) drone.velocity.add(right.clone().multiplyScalar(dirX * currentSpeed * delta));
            if (dirY !== 0) drone.velocity.y += dirY * 250.0 * delta;
        
            if (!playerState.isSpectating) {
                camera.position.add(drone.velocity.clone().multiplyScalar(delta));
                
                // Bounds
                if (camera.position.y < 2) { camera.position.y = 2; drone.velocity.y = 0; }
                if (camera.position.x < -399) camera.position.x = -399;
                if (camera.position.x > 399) camera.position.x = 399;
                if (camera.position.z < -399) camera.position.z = -399;
                if (camera.position.z > 399) camera.position.z = 399;
            
                drone.mesh.position.copy(camera.position);
            } else {
                drone.mesh.position.add(drone.velocity.clone().multiplyScalar(delta));
                if (drone.mesh.position.y < 2) { drone.mesh.position.y = 2; drone.velocity.y = 0; }
            }
        } else {
            // Bot drone logic
            let nearestEnemyPos = null;
            let minDist = Infinity;
            if (drone.team !== playerState.team && playerState.hp > 0 && !playerState.isSpectating) {
                nearestEnemyPos = (typeof getPlayerPosition === 'function' ? getPlayerPosition() : camera.position).clone();
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
                        const gType = ['hegrenade', 'flashbang', 'molotov', 'smoke'][Math.floor(Math.random() * 4)];
                        const dir = new THREE.Vector3().subVectors(nearestEnemyPos, drone.mesh.position).normalize();
                        dir.y += 0.2;
                        dir.normalize();
                        if (typeof createGrenade === 'function') {
                            createGrenade(drone.mesh.position.clone(), dir, gType, drone.team, true);
                        }
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

function destroyDrone(drone, exploded = false, silent = false) {
    if (exploded) {
        triggerDroneExplosion(drone);
    } else if (!silent) {
        if (typeof createHitEffect === 'function') createHitEffect(drone.mesh.position, true); // Debris effect
    }
    
    // Remove from scene
    scene.remove(drone.mesh);
    if (drone.targetIndicator) scene.remove(drone.targetIndicator);
    
    // Dispose GPU resources
    drone.mesh.traverse(child => {
        if (child.isMesh) {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        }
    });
    if (drone.targetIndicator) {
        if (drone.targetIndicator.geometry) drone.targetIndicator.geometry.dispose();
        if (drone.targetIndicator.material) drone.targetIndicator.material.dispose();
    }
    
    // Remove from array
    const idx = activeDrones.indexOf(drone);
    if (idx > -1) activeDrones.splice(idx, 1);
    
    // Reset player or bot state
    if (drone.isPlayer) {
        playerState.isControllingDrone = false;
        if (typeof removePlayerDummy === 'function') removePlayerDummy();
        if (!playerState.isSpectating) camera.position.copy(drone.playerPos);
        if (typeof updateHUD === 'function') updateHUD();
    } else {
        const bot = bots.find(b => b.id === drone.ownerId);
        if (bot) {
            bot.isControllingDrone = false;
            bot.lastShot = typeof frameCount !== 'undefined' ? frameCount : 0;
        }
    }
}
// #endregion
