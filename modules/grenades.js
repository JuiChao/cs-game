// #region 投掷物系统
function updateGrenades(delta) {
    for (let i = grenades.length - 1; i >= 0; i--) {
        const g = grenades[i];
        g.life -= delta;
        g.velocity.y -= 40 * delta; // gravity
        
        const nextX = g.mesh.position.x + g.velocity.x * delta;
        const nextY = g.mesh.position.y + g.velocity.y * delta;
        const nextZ = g.mesh.position.z + g.velocity.z * delta;
        
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
            if (g.circleMesh) scene.remove(g.circleMesh);
            grenades.splice(i, 1);
        }
    }
}

function triggerGrenadeExplosion(g) {
    const pos = g.mesh.position;
    
    if (g.type === 'hegrenade') {
        createHitEffect(pos, false);
        
        const range = g.isFromDrone ? 50 : 40;
        const dmgMult = g.isFromDrone ? 1.1 : 1.0;
        
        for (let index = bots.length - 1; index >= 0; index--) {
            const b = bots[index];
            const dist = b.mesh.position.distanceTo(pos);
            if (dist < range) {
                const dmg = Math.round(Math.max(0, 100 * dmgMult * (1 - dist / range)));
                if (b.team !== g.team) {
                    b.hp -= dmg * 0.75;
                    if (b.hp <= 0) killBot(index, g.team, 'hegrenade');
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
            isFromDrone: g.isFromDrone 
        });
    } else if (g.type === 'sandbag') {
        createHitEffect(pos, true);
    }
}

function updateFires(delta) {
    for(let i=activeFires.length-1; i>=0; i--) {
        let f = activeFires[i];
        f.life -= delta;
        if(f.life <= 0) {
            scene.remove(f.mesh);
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
                if (Math.abs(b.mesh.position.x - f.x) < halfSize && Math.abs(b.mesh.position.z - f.z) < halfSize) {
                    let ticks = f.hitMap.get(b) || 0;
                    f.hitMap.set(b, ticks + 1);
                    let extraDamage = Math.floor((ticks * tickRate / 60) / 0.3);
                    let finalDmg = Math.ceil((4 + extraDamage) * dmgMult);
                    b.hp -= finalDmg * 0.75;
                    if (b.hp <= 0) killBot(index, f.team, 'molotov');
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
                    playerState.lastCombatTime = frameCount;
                    updateHUD();
                    if (playerState.hp <= 0) playerDie(f.team, 'molotov');
                }
            }
        }
    }
}

function createGrenade(start, direction, type, team, isFromDrone = false) {
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const color = type === 'hegrenade' ? 0x005500 : (type === 'flashbang' ? 0xaaaaaa : (type === 'molotov' ? 0xaa4400 : 0xaa8844));
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
        life: type === 'molotov' ? Infinity : (type === 'hegrenade' && isFromDrone ? 1.5 : 2.0),
        isFromDrone: isFromDrone
    });
}

// #endregion
