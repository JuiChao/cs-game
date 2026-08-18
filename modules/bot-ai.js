// #region Bot AI
function moveBotWithCollision(bot, moveVector) {
    const nextX = bot.mesh.position.x + moveVector.x;
    const nextZ = bot.mesh.position.z + moveVector.z;
    
    const margin = 0.05;
    
    const botBoxX = new THREE.Box3(
        new THREE.Vector3(nextX - 0.4, 0.5, bot.mesh.position.z - 0.4 + margin),
        new THREE.Vector3(nextX + 0.4, 3.5, bot.mesh.position.z + 0.4 - margin)
    );
    let colX = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxX));
    
    if (!colX) { bot.mesh.position.x = nextX; }
    
    const botBoxZ = new THREE.Box3(
        new THREE.Vector3(bot.mesh.position.x - 0.4 + margin, 0.5, nextZ - 0.4),
        new THREE.Vector3(bot.mesh.position.x + 0.4 - margin, 3.5, nextZ + 0.4)
    );
    let colZ = collidableMeshList.some(wall => wall.worldBox.intersectsBox(botBoxZ));
    
    if (!colZ) { bot.mesh.position.z = nextZ; }
    
    return !colX || !colZ;
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
        if (b.isControllingDrone) return;
        
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
            if (intersects.length === 0) {
                if (d < minDist) { minDist = d; nearestEnemy = playerEye; }
            }
        }
        
        bots.forEach(other => {
            if (other.team !== b.team) {
                const otherEye = other.mesh.position.clone().add(new THREE.Vector3(0, 2.8, 0));
                const d = botEye.distanceTo(otherEye);
                
                if (d < minAbsDist) { minAbsDist = d; absoluteClosestEnemy = otherEye; }
                
                const dir = new THREE.Vector3().subVectors(otherEye, botEye).normalize();
                raycaster.set(botEye, dir);
                raycaster.far = d;
                const intersects = raycaster.intersectObjects(collidableMeshList);
                if (intersects.length === 0) {
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
            const combatSlow = (b.poisonTimer > 0) ? 0.25 : 1.0;
            if (lowHP) {
                const fleeDir = new THREE.Vector3().subVectors(b.mesh.position, nearestEnemy);
                fleeDir.y = 0; fleeDir.normalize();
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
                    const gType = ['hegrenade', 'flashbang', 'molotov'][Math.floor(Math.random()*3)];
                    let spreadDir = dir.clone();
                    spreadDir.x += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.y += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.z += (Math.random() - 0.5) * actualSpread * 10;
                    spreadDir.normalize();
                    createGrenade(botEye.clone(), spreadDir, gType, b.team);
                } else {
                    let bulletCount = b.weapon === 'shotgun' ? 10 : 1;

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

            // Generate path if needed (with frequency limiting to reduce CPU load)
            const needsNewPath = !b.path || b.path.length === 0;
            const targetMoved = b.path && b.path.length > 0 && b.targetNode.distanceTo(b.path[b.path.length - 1]) > 5;
            const cooldownElapsed = !b.lastPathfindFrame || (frameCount - b.lastPathfindFrame) > 30; // 0.5s at 60fps
            
            if (needsNewPath || (targetMoved && cooldownElapsed)) {
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
                if (b.stuckTimer > 0 || !((bombState.planted && b.team === 'CT') || (!bombState.planted && b.team === 'T'))) {
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
                const speedMult = (b.poisonTimer > 0) ? 0.25 : 1.0;
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
