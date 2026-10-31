// #region 投掷物系统
function updateGrenades(delta) {
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.life -= delta;
        g.velocity.y -= 40 * delta; // gravity
        
        const nextX = g.mesh.position.x + g.velocity.x * delta;
        const nextY = g.mesh.position.y + g.velocity.y * delta;
        const nextZ = g.mesh.position.z + g.velocity.z * delta;

        // 地雷: 首次触地或撞墙即贴附部署（地面平放 / 贴墙 / 天花板），不再弹跳
        if (g.type === 'mine') {
            let attachPos = null, attachNormal = null;
            if (nextY <= 0.25) {
                attachPos = new THREE.Vector3(g.mesh.position.x, 0.25, g.mesh.position.z);
                attachNormal = new THREE.Vector3(0, 1, 0);
            } else {
                const mbox = new THREE.Box3(
                    new THREE.Vector3(nextX - 0.25, g.mesh.position.y - 0.25, nextZ - 0.25),
                    new THREE.Vector3(nextX + 0.25, g.mesh.position.y + 0.25, nextZ + 0.25)
                );
                if (collidableMeshList.some(wall => wall.worldBox.intersectsBox(mbox))) {
                    // 射线求墙面命中点与法线
                    const velDir = g.velocity.clone().normalize();
                    raycaster.set(g.mesh.position, velDir);
                    raycaster.far = g.velocity.length() * delta + 1.0;
                    const hits = raycaster.intersectObjects(collidableMeshList, false);
                    if (hits.length > 0 && hits[0].face) {
                        attachPos = hits[0].point.clone();
                        attachNormal = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld);
                        if (attachNormal.dot(velDir) > 0) attachNormal.negate(); // 保证法线朝外
                    } else {
                        // 射线未命中兜底: 原地贴地
                        attachPos = new THREE.Vector3(g.mesh.position.x, 0.25, g.mesh.position.z);
                        attachNormal = new THREE.Vector3(0, 1, 0);
                    }
                }
            }
            if (attachPos) {
                scene.remove(g.mesh);
                g.mesh.geometry.dispose();
                g.mesh.material.dispose();
                grenades.splice(i, 1);
                deployMine(attachPos, attachNormal, g.team, g.isPlayer);
                continue;
            }
        }

        let hitFloor = false;
        if (nextY <= 0.25) {
            g.mesh.position.y = 0.25;
            g.velocity.y *= -0.5; // bounce vertical
            g.velocity.x *= 0.8;  // friction
            g.velocity.z *= 0.8;
            hitFloor = true;
        } else {
            g.mesh.position.y = nextY;
        }
        
        // Wall collision (simplified X and Z)
        const box = new THREE.Box3(
            new THREE.Vector3(nextX - 0.25, g.mesh.position.y - 0.25, nextZ - 0.25),
            new THREE.Vector3(nextX + 0.25, g.mesh.position.y + 0.25, nextZ + 0.25)
        );
        let col = collidableMeshList.some(wall => wall.worldBox.intersectsBox(box));
        if (col) {
            g.velocity.x *= -0.5;
            g.velocity.z *= -0.5;
        } else {
            g.mesh.position.x = nextX;
            g.mesh.position.z = nextZ;
        }
        
        if (g.type === 'hegrenade') {
            if (!g.circleMesh) {
                const circleGeo = new THREE.CircleGeometry(40, 32);
                const circleMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
                g.circleMesh = new THREE.Mesh(circleGeo, circleMat);
                g.circleMesh.rotation.x = -Math.PI / 2;
                g.circleMesh.position.y = 0.05;
                scene.add(g.circleMesh);
            }
            g.circleMesh.position.x = g.mesh.position.x;
            g.circleMesh.position.z = g.mesh.position.z;
        }

        if (g.life <= 0 || (g.type === 'molotov' && hitFloor)) {
            triggerGrenadeExplosion(g);
            scene.remove(g.mesh);
            if (g.mesh.geometry) g.mesh.geometry.dispose();
            if (g.mesh.material) {
                if (Array.isArray(g.mesh.material)) g.mesh.material.forEach(m => m.dispose());
                else g.mesh.material.dispose();
            }
            if (g.circleMesh) {
                scene.remove(g.circleMesh);
                if (g.circleMesh.geometry) g.circleMesh.geometry.dispose();
                if (g.circleMesh.material) {
                    if (Array.isArray(g.circleMesh.material)) g.circleMesh.material.forEach(m => m.dispose());
                    else g.circleMesh.material.dispose();
                }
            }
            grenades.splice(i, 1);
        }
    }
}

function triggerGrenadeExplosion(g) {
    const pos = g.mesh.position;
    
    if (g.type === 'hegrenade') {
        createHitEffect(pos, false);
        playExplosionSound(pos);
        
        const range = g.isFromDrone ? 50 : 40;
        const dmgMult = g.isFromDrone ? 1.1 : 1.0;
        
        for (let index = bots.length - 1; index >= 0; index--) {
            const b = bots[index];
            const dist = b.mesh.position.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                if (b.team !== g.team) {
                    b.hp -= dmg * 0.75 * zombieExplosiveDmgMult(b);
                    if (b.hp <= 0) killBot(index, g.team, 'hegrenade', !!g.isPlayer);
                }
            }
        }
        
        if (isShootingRange) {
            rangeTargets.forEach(t => {
                const dist = t.position.distanceTo(pos);
                if (dist < range) {
                    const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                    if (dmg > 0) showFloatingDamage(dmg, t.position);
                }
            });
        }
        if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== g.team) {
            const playerPos = getPlayerPosition();
            const dist = playerPos.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 80 * dmgMult * (1 - dist / range)));
                let actualDmg = dmg * 0.75;
                if (getCurrentWeapon().id === 'kukri' || (getCurrentWeapon().id === 'flamethrower' && isShooting)) actualDmg *= 0.025;
                else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.05;
                if (!playerState.isInvincible) playerState.hp -= Math.ceil(actualDmg);
                if (typeof triggerDamageVignette === 'function') triggerDamageVignette(actualDmg / 30);
                if (typeof playerState !== 'undefined') playerState.cameraShake = Math.min(0.03, (playerState.cameraShake || 0) + 0.02);
                playerState.lastCombatTime = frameCount;
                if (playerState.hp <= 0) playerDie(g.team, 'hegrenade');
            }
        }
    } else if (g.type === 'flashbang') {
        createHitEffect(pos, true);
        if (playerState.hp > 0 && !playerState.isSpectating) {
            const playerPos = getPlayerPosition();
            const dist = playerPos.distanceTo(pos);
            if (dist < 200) {
                const dirToFlash = new THREE.Vector3().subVectors(pos, playerPos).normalize();
                const camDir = new THREE.Vector3();
                camera.getWorldDirection(camDir);
                if (camDir.dot(dirToFlash) > 0.3) {
                    raycaster.set(playerPos, dirToFlash);
                    const intersects = raycaster.intersectObjects(collidableMeshList);
                    if (intersects.length === 0 || intersects[0].distance > dist) {
                        const flashOverlay = document.createElement('div');
                        flashOverlay.style.position = 'fixed';
                        flashOverlay.style.top = 0; flashOverlay.style.left = 0;
                        flashOverlay.style.width = '100vw'; flashOverlay.style.height = '100vh';
                        flashOverlay.style.background = 'white';
                        flashOverlay.style.zIndex = 9999;
                        flashOverlay.style.opacity = 1;
                        flashOverlay.style.transition = 'opacity 3s ease-out';
                        document.body.appendChild(flashOverlay);
                        setTimeout(() => flashOverlay.style.opacity = 0, 100);
                        setTimeout(() => flashOverlay.remove(), 3100);
                    }
                }
            }
        }
    } else if (g.type === 'molotov') {
        const size = g.isFromDrone ? 45 * 1.25 : 45;
        const fireGeo = new THREE.PlaneGeometry(size, size);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.6 });
        const fire = new THREE.Mesh(fireGeo, fireMat);
        fire.rotation.x = -Math.PI / 2;
        fire.position.set(pos.x, 0.1, pos.z);
        scene.add(fire);
        
        activeFires.push({
            mesh: fire,
            life: 7.0,
            x: pos.x,
            z: pos.z,
            team: g.team,
            hitMap: new Map(),
            isFromDrone: g.isFromDrone,
            isPlayer: g.isPlayer
        });
    } else if (g.type === 'smoke') {
        // 烟雾弹: 生成遮蔽视野的烟雾云（阻挡Bot视线检测, 不挡子弹/移动）
        const group = new THREE.Group();
        const smokeMat = new THREE.MeshLambertMaterial({ color: 0xb8bcc2, transparent: true, opacity: 0.92 });
        const coreGeo = new THREE.SphereGeometry(14, 12, 10);
        const core = new THREE.Mesh(coreGeo, smokeMat);
        core.position.y = 6;
        group.add(core);
        for (let i = 0; i < 6; i++) {
            const puff = new THREE.Mesh(new THREE.SphereGeometry(9, 10, 8), smokeMat);
            const ang = (i / 6) * Math.PI * 2;
            puff.position.set(Math.cos(ang) * 11, 4 + Math.random() * 6, Math.sin(ang) * 11);
            group.add(puff);
        }
        group.position.set(pos.x, 0, pos.z);
        group.scale.setScalar(0.15);
        scene.add(group);
        activeSmokes.push({ group: group, x: pos.x, z: pos.z, life: 15.0, grow: 0 });
        createHitEffect(pos, true);
    } else if (g.type === 'sandbag') {
        // 生化模式: 沙包落地形成实体路障（僵尸不可攀爬, 须拆毁）
        if (gameMode === 'zombie') {
            createBarrier(pos);
        } else {
            createHitEffect(pos, true);
        }
    }
}

function updateFires(delta) {
    for(let i=activeFires.length-1; i>=0; i--) {
        let f = activeFires[i];
        f.life -= delta;
        if(f.life <= 0) {
            scene.remove(f.mesh);
            if (f.mesh.geometry) f.mesh.geometry.dispose();
            if (f.mesh.material) {
                if (Array.isArray(f.mesh.material)) f.mesh.material.forEach(m => m.dispose());
                else f.mesh.material.dispose();
            }
            activeFires.splice(i, 1);
            continue;
        }
        
        f.mesh.material.opacity = 0.5 + Math.random() * 0.3;
        
        const tickRate = f.isFromDrone ? 7 : 8; 
        if (frameCount % tickRate === 0) { 
            const halfSize = f.isFromDrone ? 28.125 : 22.5; 
            const dmgMult = f.isFromDrone ? 1.1 : 1.0;
            
            for (let index = bots.length - 1; index >= 0; index--) {
                const b = bots[index];
                if (b.isDead) continue;
                if (Math.abs(b.mesh.position.x - f.x) < halfSize && Math.abs(b.mesh.position.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get(b) || 0;
                    f.hitMap.set(b, ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    b.hp -= finalDmg * 0.75 * zombieExplosiveDmgMult(b);
                    if (b.hp <= 0) killBot(index, f.team, 'molotov', !!f.isPlayer);
                }
            }
            
            if (isShootingRange) {
                rangeTargets.forEach(t => {
                    if (Math.abs(t.position.x - f.x) < halfSize && Math.abs(t.position.z - f.z) < halfSize) {
                        let ticks = f.hitMap.get(t) || 0;
                        f.hitMap.set(t, ticks + 1);
                        let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                        let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                        showFloatingDamage(finalDmg, t.position);
                    }
                });
            }
            if (playerState.hp > 0 && !playerState.isSpectating && playerState.team !== f.team) {
                const playerPos = getPlayerPosition();
                if (Math.abs(playerPos.x - f.x) < halfSize && Math.abs(playerPos.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get('player') || 0;
                    f.hitMap.set('player', ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    let actualDmg = finalDmg * 0.75;
                    if (getCurrentWeapon().id === 'kukri') actualDmg *= 0.025;
                    else if (getCurrentWeapon().id === 'knife' || getCurrentWeapon().id === 'switchblade') actualDmg *= 0.05;
                    if (!playerState.isInvincible) playerState.hp -= Math.ceil(applyArmorReduction(actualDmg));
                    if (typeof triggerDamageVignette === 'function') triggerDamageVignette(0.35);
                    playerState.lastCombatTime = frameCount;
                    updateHUD();
                    if (playerState.hp <= 0) playerDie(f.team, 'molotov');
                }
            }
        }
    }
}

function updateSmokes(delta) {
    for (let i = activeSmokes.length - 1; i >= 0; i--) {
        const s = activeSmokes[i];
        s.life -= delta;
        if (s.life <= 0) {
            scene.remove(s.group);
            s.group.traverse(child => {
                if (child.isMesh) {
                    if (child.geometry) child.geometry.dispose();
                    if (child.material) child.material.dispose();
                }
            });
            activeSmokes.splice(i, 1);
            continue;
        }
        // 落地后快速膨胀成形
        if (s.group.scale.x < 1) {
            s.grow += delta;
            s.group.scale.setScalar(Math.min(1, 0.15 + s.grow * 1.6));
        }
        // 缓慢飘移 + 消散前淡出
        s.group.position.x += Math.sin(i * 2.1 + frameCount * 0.005) * 0.02;
        s.group.position.z += Math.cos(i * 1.7 + frameCount * 0.004) * 0.02;
        const mat = s.group.children[0].material;
        if (s.life < 3) mat.opacity = 0.92 * (s.life / 3);
        s.group.rotation.y += delta * 0.05;
    }
}

// 线段 a→b 是否被任意已成形烟雾云遮挡（Bot视野检测用）
function isSegmentBlockedBySmoke(a, b) {
    for (const s of activeSmokes) {
        if (s.life < 2 || s.group.scale.x < 0.85) continue; // 未成形/已消散的烟不遮挡
        const cx = s.x, cz = s.z, cy = 7, r = 15;
        const abx = b.x - a.x, aby = b.y - a.y, abz = b.z - a.z;
        const acx = cx - a.x, acy = cy - a.y, acz = cz - a.z;
        const abLenSq = abx * abx + aby * aby + abz * abz;
        let t = abLenSq > 0 ? (acx * abx + acy * aby + acz * abz) / abLenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const px = a.x + abx * t - cx, py = a.y + aby * t - cy, pz = a.z + abz * t - cz;
        if (px * px + py * py + pz * pz < r * r) return true;
    }
    return false;
}

function createGrenade(start, direction, type, team, isFromDrone = false, isPlayer = false) {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const color = type === 'hegrenade' ? 0x005500 : (type === 'flashbang' ? 0xaaaaaa : (type === 'molotov' ? 0xaa4400 : (type === 'smoke' ? 0x9aa0a6 : (type === 'mine' ? 0x2a3a2a : 0xaa8844))));
    const mat = new THREE.MeshStandardMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(start);
    scene.add(mesh);

    direction.y += 0.3;
    direction.normalize();

    grenades.push({
        mesh: mesh,
        velocity: direction.multiplyScalar(65),
        type: type,
        team: team,
        life: (type === 'molotov' || type === 'mine') ? Infinity : (type === 'hegrenade' && isFromDrone ? 1.5 : 2.0),
        isFromDrone: isFromDrone,
        isPlayer: isPlayer
    });
}

// #endregion
