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

        if (g.life <= 0 || ((g.type === 'molotov' || g.type === 'cryo') && hitFloor)) {
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

function createGrenadeExplosionParticles(pos) {
    if (typeof obtainParticle !== 'function') return;
    const colors = [0xff4400, 0xff8800, 0xffcc00, 0x555555, 0x888888, 0x333333];
    const geo = (typeof sharedParticleGeo !== 'undefined') ? sharedParticleGeo : null;
    for (let i = 0; i < 16; i++) {
        const color = colors[Math.floor(Math.random() * colors.length)];
        const ang = Math.random() * Math.PI * 2;
        const speed = 12 + Math.random() * 26;
        const vx = Math.cos(ang) * speed;
        const vy = Math.random() * 22 + 8;
        const vz = Math.sin(ang) * speed;
        const life = 0.4 + Math.random() * 0.4;
        const scale = 0.9 + Math.random() * 0.8;
        obtainParticle(geo, color, pos.x, pos.y + 0.5, pos.z, vx, vy, vz, life, 0.9, scale);
    }
}

function triggerGrenadeExplosion(g) {
    const pos = g.mesh.position;
    
    if (g.type === 'hegrenade') {
        createHitEffect(pos, false);
        createGrenadeExplosionParticles(pos);
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
    } else if (g.type === 'cryo') {
        createCryoZone(pos, g.team, g.isFromDrone, g.isPlayer);
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
        
        // 燃烧弹区域上方粒子效果
        if (typeof obtainParticle === 'function' && frameCount % 2 === 0) {
            const halfSize = (f.isFromDrone ? 28.125 : 22.5) * 0.85;
            const px = f.x + (Math.random() * 2 - 1) * halfSize;
            const py = 0.2 + Math.random() * 0.4;
            const pz = f.z + (Math.random() * 2 - 1) * halfSize;
            const fColors = [0xff2200, 0xff5500, 0xff9900, 0x444444];
            const col = fColors[Math.floor(Math.random() * fColors.length)];
            const geo = (typeof sharedParticleGeo !== 'undefined') ? sharedParticleGeo : null;
            obtainParticle(geo, col, px, py, pz, (Math.random() - 0.5) * 3, 14 + Math.random() * 10, (Math.random() - 0.5) * 3, 0.6 + Math.random() * 0.3, 0.8, 1.1);
        }
        
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
    const color = type === 'hegrenade' ? 0x005500 : (type === 'flashbang' ? 0xaaaaaa : (type === 'molotov' ? 0xaa4400 : (type === 'smoke' ? 0x9aa0a6 : (type === 'mine' ? 0x2a3a2a : (type === 'cryo' ? 0x00d4ff : 0xaa8844)))));
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
        life: (type === 'molotov' || type === 'mine' || type === 'cryo') ? Infinity : (type === 'hegrenade' && isFromDrone ? 1.5 : 2.0),
        isFromDrone: isFromDrone,
        isPlayer: isPlayer
    });
}

function drawCryoCountdownCanvas(canvas, ctx, life, maxLife) {
    if (!ctx) return;
    ctx.clearRect(0, 0, 256, 256);
    const cx = 128, cy = 128, r = 85;
    const progress = Math.max(0, Math.min(1.0, life / maxLife));

    // Outer dark translucent circle background
    ctx.beginPath();
    ctx.arc(cx, cy, 110, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 18, 34, 0.75)';
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)';
    ctx.stroke();

    // Circular track background
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0, 80, 130, 0.35)';
    ctx.stroke();

    // Shrinking circular progress bar
    if (progress > 0) {
        ctx.save();
        ctx.beginPath();
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);
        ctx.arc(cx, cy, r, startAngle, endAngle);
        ctx.lineWidth = 14;
        ctx.lineCap = 'round';
        ctx.strokeStyle = '#00f0ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 12;
        ctx.stroke();
        ctx.restore();
    }

    // Countdown numeric text
    ctx.save();
    ctx.shadowColor = 'rgba(0, 229, 255, 0.8)';
    ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px "Orbitron", "Inter", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(Math.max(0, life).toFixed(1) + 's', cx, cy);
    ctx.restore();
}

function createCryoZone(pos, team, isFromDrone = false, isPlayer = false) {
    if (typeof activeCryoZones === 'undefined') activeCryoZones = [];
    const baseSize = 65; // 范围扩大 (原 45 -> 65)
    const size = isFromDrone ? baseSize * 1.25 : baseSize;
    const cryoGeo = new THREE.PlaneGeometry(size, size);
    const cryoMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
    const cryoMesh = new THREE.Mesh(cryoGeo, cryoMat);
    cryoMesh.rotation.x = -Math.PI / 2;
    cryoMesh.position.set(pos.x, 0.12, pos.z);
    scene.add(cryoMesh);

    const innerGeo = new THREE.RingGeometry(size * 0.15, size * 0.48, 32);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xa0e8ff, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    innerMesh.rotation.x = -Math.PI / 2;
    innerMesh.position.set(pos.x, 0.14, pos.z);
    scene.add(innerMesh);

    const duration = 11.0; // 持续时间增加 3 秒 (原 8.0s -> 11.0s)
    let countdownCanvas = null;
    let countdownCtx = null;
    let countdownTexture = null;
    let countdownSprite = null;
    if (typeof document !== 'undefined') {
        countdownCanvas = document.createElement('canvas');
        countdownCanvas.width = 256;
        countdownCanvas.height = 256;
        countdownCtx = countdownCanvas.getContext('2d');
        drawCryoCountdownCanvas(countdownCanvas, countdownCtx, duration, duration);
        countdownTexture = new THREE.CanvasTexture(countdownCanvas);
        const spriteMat = new THREE.SpriteMaterial({ map: countdownTexture, transparent: true, depthWrite: false });
        countdownSprite = new THREE.Sprite(spriteMat);
        countdownSprite.position.set(pos.x, 4.5, pos.z);
        countdownSprite.scale.set(5.5, 5.5, 1.0);
        countdownSprite.renderOrder = 10;
        scene.add(countdownSprite);
    }

    createHitEffect(pos, true);
    if (typeof playExplosionSound === 'function') playExplosionSound(pos);

    activeCryoZones.push({
        mesh: cryoMesh,
        innerMesh: innerMesh,
        countdownSprite: countdownSprite,
        countdownCanvas: countdownCanvas,
        countdownCtx: countdownCtx,
        countdownTexture: countdownTexture,
        life: duration,
        maxLife: duration,
        x: pos.x,
        z: pos.z,
        halfSize: size / 2,
        team: team,
        isFromDrone: isFromDrone,
        isPlayer: isPlayer,
        rangeTimer: 0,
        rangeTicks: 0
    });
}

function updateCryoZones(delta) {
    if (typeof activeCryoZones === 'undefined' || !activeCryoZones) return;

    // 1. Zone lifecycle & visual effects
    for (let i = activeCryoZones.length - 1; i >= 0; i--) {
        const z = activeCryoZones[i];
        z.life -= delta;
        if (z.life <= 0) {
            if (z.mesh) {
                scene.remove(z.mesh);
                if (z.mesh.geometry) z.mesh.geometry.dispose();
                if (z.mesh.material) z.mesh.material.dispose();
            }
            if (z.innerMesh) {
                scene.remove(z.innerMesh);
                if (z.innerMesh.geometry) z.innerMesh.geometry.dispose();
                if (z.innerMesh.material) z.innerMesh.material.dispose();
            }
            if (z.countdownSprite) {
                scene.remove(z.countdownSprite);
                if (z.countdownSprite.material) z.countdownSprite.material.dispose();
            }
            if (z.countdownTexture) z.countdownTexture.dispose();
            activeCryoZones.splice(i, 1);
            continue;
        }
        if (z.mesh && z.mesh.material) {
            z.mesh.material.opacity = 0.55 + Math.sin((z.maxLife - z.life) * 4) * 0.12;
        }
        // 更新倒计时圆形缩减进度条
        if (z.countdownCtx && z.countdownTexture) {
            drawCryoCountdownCanvas(z.countdownCanvas, z.countdownCtx, z.life, z.maxLife);
            z.countdownTexture.needsUpdate = true;
        }
        // 液氮冷罐区域上方轻微粒子效果 (不卡顿)
        if (typeof obtainParticle === 'function' && frameCount % 2 === 0) {
            const half = z.halfSize * 0.85;
            const px = z.x + (Math.random() * 2 - 1) * half;
            const py = 0.2 + Math.random() * 0.4;
            const pz = z.z + (Math.random() * 2 - 1) * half;
            const cColors = [0x00ffff, 0x88eeff, 0xd0f8ff, 0xffffff, 0x00bfff];
            const col = cColors[Math.floor(Math.random() * cColors.length)];
            const geo = (typeof sharedParticleGeo !== 'undefined') ? sharedParticleGeo : null;
            obtainParticle(geo, col, px, py, pz, (Math.random() - 0.5) * 4, 11 + Math.random() * 10, (Math.random() - 0.5) * 4, 0.6 + Math.random() * 0.4, 0.85, 1.0);
        }
    }

    // 2. Player freeze timer & immunity countdown
    if (typeof playerState !== 'undefined') {
        if (playerState.isFrozen) {
            playerState.freezeTimer -= delta;
            if (playerState.freezeTimer <= 0) {
                playerState.isFrozen = false;
                playerState.freezeTimer = 0;
                playerState.freezeImmuneTimer = 5.0; // 5 秒的解冻冷却
                playerState.cryoFreezeAccum = 0;
                playerState.cryoHits = 0;
                playerState.cryoDamageTicks = 0;
            }
        } else if (playerState.freezeImmuneTimer > 0) {
            playerState.freezeImmuneTimer -= delta;
            if (playerState.freezeImmuneTimer < 0) playerState.freezeImmuneTimer = 0;
        }

        // Check if player is inside any active cryo zone
        let pInZone = false;
        let zForPlayer = null;
        let pFromDrone = false;
        let pZoneTeam = 'T';
        if (playerState.hp > 0 && !playerState.isSpectating && typeof getPlayerPosition === 'function') {
            const pPos = getPlayerPosition();
            if (pPos) {
                for (let j = 0; j < activeCryoZones.length; j++) {
                    const z = activeCryoZones[j];
                    if (Math.abs(pPos.x - z.x) < z.halfSize && Math.abs(pPos.z - z.z) < z.halfSize) {
                        pInZone = true;
                        if (!zForPlayer) {
                            zForPlayer = z;
                            pZoneTeam = z.team || 'T';
                        }
                        if (z.isFromDrone) {
                            pFromDrone = true;
                        }
                    }
                }
            }
        }
        playerState.inCryoZone = pInZone;

        if (pInZone && playerState.hp > 0 && !playerState.isSpectating) {
            playerState.cryoDecayTimer = 0;
            
            // 伤害机制: 在液氮冷罐中待 0.5 秒，下一次伤害就加 1 点
            playerState.cryoDamageTimer = (playerState.cryoDamageTimer || 0) + delta;
            while (playerState.cryoDamageTimer >= 0.5) {
                playerState.cryoDamageTimer -= 0.5;
                const ticks = (playerState.cryoDamageTicks || 0);
                playerState.cryoDamageTicks = ticks + 1;
                const extraDamage = ticks; // 第1次伤害基础3, 待0.5秒后下一次伤害+1(4), 再+1(5)...
                const dmgMult = pFromDrone ? 1.1 : 1.0;
                const finalDmg = Math.ceil((3 + extraDamage) * dmgMult);

                if (!playerState.isInvincible) playerState.hp -= finalDmg;
                if (typeof triggerDamageVignette === 'function') triggerDamageVignette(0.2);
                playerState.lastCombatTime = frameCount;
                if (typeof updateHUD === 'function') updateHUD();
                if (playerState.hp <= 0) {
                    playerDie(zForPlayer ? zForPlayer.team : pZoneTeam, 'cryo');
                    break;
                }
            }

            // 冰冻累积: 堆满 2 秒就会产生冻结
            if (!playerState.isFrozen && (!playerState.freezeImmuneTimer || playerState.freezeImmuneTimer <= 0)) {
                playerState.cryoFreezeAccum = (playerState.cryoFreezeAccum || 0) + delta;
                playerState.cryoHits = Math.round((playerState.cryoFreezeAccum / 2.0) * 6);
                if (playerState.cryoFreezeAccum >= 2.0) {
                    playerState.cryoFreezeAccum = 2.0;
                    playerState.isFrozen = true;
                    playerState.freezeTimer = 3.0; // 持续 3 秒
                    playerState.cryoFreezeAccum = 0;
                    playerState.cryoHits = 0;
                    playerState.isAds = false;
                    playerState.isInspecting = false;
                    playerState.binaryReleaseDueFrame = 0;
                    playerState.binaryTriggerPressed = false;
                }
            }
        } else {
            // 离开冷罐区域之后，持续伤害的效果就会没有
            playerState.cryoDamageTimer = 0;
            playerState.cryoDamageTicks = 0;
            if (!playerState.isFrozen) {
                playerState.cryoDecayTimer = (playerState.cryoDecayTimer || 0) + delta;
                if (playerState.cryoDecayTimer >= 1.5) {
                    playerState.cryoFreezeAccum = Math.max(0, (playerState.cryoFreezeAccum || 0) - delta * 2.0);
                    playerState.cryoHits = Math.round((playerState.cryoFreezeAccum / 2.0) * 6);
                }
            }
        }

        // Update on-screen freeze progress bar
        if (typeof updateFreezeHUD === 'function') {
            updateFreezeHUD();
        } else {
            const freezeStatusEl = document.getElementById('freeze-status');
            const freezeProgEl = document.getElementById('freeze-progress');
            const freezeTextEl = document.getElementById('freeze-text');
            if (freezeStatusEl && freezeProgEl && freezeTextEl) {
                if (playerState.hp <= 0 || playerState.isSpectating) {
                    freezeStatusEl.classList.add('hidden');
                } else if (playerState.isFrozen) {
                    freezeStatusEl.classList.remove('hidden');
                    freezeProgEl.style.width = '100%';
                    freezeTextEl.innerText = `已冰冻! (${playerState.freezeTimer.toFixed(1)}s)`;
                } else if (playerState.freezeImmuneTimer > 0) {
                    // 5 秒的解冻冷却也是百分比，从 100% 慢慢减到 0%
                    freezeStatusEl.classList.remove('hidden');
                    const immunePct = Math.max(0, Math.min(100, Math.round((playerState.freezeImmuneTimer / 5.0) * 100)));
                    freezeProgEl.style.width = immunePct + '%';
                    freezeTextEl.innerText = `解冻冷却: ${immunePct}% (${playerState.freezeImmuneTimer.toFixed(1)}s)`;
                } else if (playerState.cryoFreezeAccum > 0 || playerState.cryoHits > 0) {
                    freezeStatusEl.classList.remove('hidden');
                    const accumPct = Math.min(100, Math.round(((playerState.cryoFreezeAccum || 0) / 2.0) * 100));
                    freezeProgEl.style.width = accumPct + '%';
                    freezeTextEl.innerText = `冰冻累积: ${accumPct}%`;
                } else {
                    freezeStatusEl.classList.add('hidden');
                    freezeProgEl.style.width = '0%';
                }
            }
        }
    }

    // 3. Bots update
    if (typeof bots !== 'undefined' && Array.isArray(bots)) {
        for (let bIdx = bots.length - 1; bIdx >= 0; bIdx--) {
            const b = bots[bIdx];
            if (!b || b.isDead) continue;

            if (b.isFrozen) {
                if (b.cryoFreezeTimer === undefined) b.cryoFreezeTimer = (b.freezeTimer && b.freezeTimer <= 3.0) ? b.freezeTimer : 3.0;
                b.cryoFreezeTimer -= delta;
                b.freezeTimer = Math.max(0, b.cryoFreezeTimer);
                if (b.cryoFreezeTimer <= 0) {
                    b.isFrozen = false;
                    b.cryoFreezeTimer = 0;
                    b.freezeTimer = 0;
                    b.freezeImmuneTimer = 5.0; // 解冻后 5 秒冷却
                    b.cryoFreezeAccum = 0;
                    b.cryoHits = 0;
                    b.cryoDamageTicks = 0;
                    b.frozenByPlayer = false;
                }
            } else if (b.freezeImmuneTimer > 0) {
                b.freezeImmuneTimer -= delta;
                if (b.freezeImmuneTimer < 0) b.freezeImmuneTimer = 0;
            }

            let bInZone = false;
            let bZone = null;
            let bIsPlayer = false;
            let bFromDrone = false;
            let bKillerTeam = 'CT';
            for (let j = 0; j < activeCryoZones.length; j++) {
                const z = activeCryoZones[j];
                if (Math.abs(b.mesh.position.x - z.x) < z.halfSize && Math.abs(b.mesh.position.z - z.z) < z.halfSize) {
                    bInZone = true;
                    if (!bZone) {
                        bZone = z;
                        bKillerTeam = z.team || 'CT';
                    }
                    if (z.isPlayer) {
                        bIsPlayer = true;
                        bKillerTeam = z.team || 'CT';
                    }
                    if (z.isFromDrone) {
                        bFromDrone = true;
                    }
                }
            }
            b.inCryoZone = bInZone;

            if (bInZone) {
                b.cryoDecayTimer = 0;
                b.cryoDamageTimer = (b.cryoDamageTimer || 0) + delta;
                while (b.cryoDamageTimer >= 0.5) {
                    b.cryoDamageTimer -= 0.5;
                    const bTicks = (b.cryoDamageTicks || 0);
                    b.cryoDamageTicks = bTicks + 1;
                    const bExtraDmg = bTicks; // 待0.5秒下一次伤害+1
                    const dmgMult = bFromDrone ? 1.1 : 1.0;
                    const finalDmg = Math.ceil((3 + bExtraDmg) * dmgMult);

                    b.hp -= finalDmg * zombieExplosiveDmgMult(b);
                    if (bIsPlayer && typeof showFloatingDamage === 'function' && b.mesh) {
                        showFloatingDamage(finalDmg, b.mesh.position);
                    }
                    if (b.hp <= 0) {
                        killBot(bIdx, bKillerTeam, 'cryo', bIsPlayer);
                        break;
                    }
                }

                if (b.hp <= 0 || b.isDead) {
                    continue;
                }

                // 堆满 2 秒就会产生冻结
                if (!b.isFrozen && (!b.freezeImmuneTimer || b.freezeImmuneTimer <= 0)) {
                    b.cryoFreezeAccum = (b.cryoFreezeAccum || 0) + delta;
                    b.cryoHits = Math.round((b.cryoFreezeAccum / 2.0) * 6);
                    const isEnemyOfPlayer = (typeof playerState !== 'undefined' && b.team !== playerState.team);
                    if (bIsPlayer && isEnemyOfPlayer) {
                        b.cryoAccumFromPlayer = true;
                    }
                    if (b.cryoFreezeAccum >= 2.0) {
                        b.cryoFreezeAccum = 2.0;
                        b.isFrozen = true;
                        b.cryoFreezeTimer = 3.0;
                        b.freezeTimer = 3.0;
                        b.actionProgress = 0;
                        b.cryoFreezeAccum = 0;
                        b.cryoHits = 0;
                        if (bIsPlayer && isEnemyOfPlayer) {
                            b.frozenByPlayer = true;
                            if (typeof showAnnouncement === 'function') {
                                showAnnouncement('敌人已冻结', '#00e5ff');
                            }
                        }
                    }
                }
            } else {
                b.cryoDamageTimer = 0;
                b.cryoDamageTicks = 0;
                if (!b.isFrozen) {
                    b.cryoDecayTimer = (b.cryoDecayTimer || 0) + delta;
                    if (b.cryoDecayTimer >= 1.5) {
                        b.cryoFreezeAccum = Math.max(0, (b.cryoFreezeAccum || 0) - delta * 2.0);
                        b.cryoHits = Math.round((b.cryoFreezeAccum / 2.0) * 6);
                        if (b.cryoFreezeAccum <= 0) b.cryoAccumFromPlayer = false;
                    }
                }
            }
        }
    }

    // 4. Enemy freeze HUD for player screen
    if (typeof updateEnemyFreezeHUD === 'function') {
        updateEnemyFreezeHUD();
    } else {
        const eFreezeStatusEl = document.getElementById('enemy-freeze-status');
        const eFreezeProgEl = document.getElementById('enemy-freeze-progress');
        const eFreezeTextEl = document.getElementById('enemy-freeze-text');
        if (typeof playerState !== 'undefined' && (playerState.hp <= 0 || playerState.isSpectating)) {
            if (eFreezeStatusEl) eFreezeStatusEl.classList.add('hidden');
            if (eFreezeProgEl) eFreezeProgEl.style.width = '0%';
        } else if (eFreezeStatusEl && eFreezeProgEl && eFreezeTextEl) {
            let maxEnemyPct = 0;
            let anyEnemyFrozen = false;
            let enemyFrozenTimer = 0;
            let activeEnemyFound = false;

            if (typeof bots !== 'undefined' && Array.isArray(bots)) {
                for (let k = 0; k < bots.length; k++) {
                    const eb = bots[k];
                    if (!eb || eb.isDead || (typeof playerState !== 'undefined' && eb.team === playerState.team)) continue;
                    if (eb.frozenByPlayer && eb.isFrozen) {
                        anyEnemyFrozen = true;
                        const ft = eb.cryoFreezeTimer || eb.freezeTimer || 0;
                        if (ft > enemyFrozenTimer) enemyFrozenTimer = ft;
                        activeEnemyFound = true;
                        continue;
                    }
                    if (eb.cryoAccumFromPlayer && eb.cryoFreezeAccum > 0) {
                        const pct = Math.min(100, Math.round((eb.cryoFreezeAccum / 2.0) * 100));
                        if (pct > maxEnemyPct) {
                            maxEnemyPct = pct;
                            activeEnemyFound = true;
                        }
                    }
                }
            }

            if (anyEnemyFrozen) {
                eFreezeStatusEl.classList.remove('hidden');
                eFreezeProgEl.style.width = '100%';
                eFreezeTextEl.innerText = `敌人已冻结! (${enemyFrozenTimer.toFixed(1)}s)`;
            } else if (activeEnemyFound && maxEnemyPct > 0) {
                eFreezeStatusEl.classList.remove('hidden');
                eFreezeProgEl.style.width = maxEnemyPct + '%';
                eFreezeTextEl.innerText = `敌人冰冻累积: ${maxEnemyPct}%`;
            } else {
                eFreezeStatusEl.classList.add('hidden');
                eFreezeProgEl.style.width = '0%';
            }
        }
    }

    // 5. Shooting range targets
    if (typeof isShootingRange !== 'undefined' && isShootingRange && typeof rangeTargets !== 'undefined') {
        for (let i = 0; i < activeCryoZones.length; i++) {
            const z = activeCryoZones[i];
            z.rangeTimer = (z.rangeTimer || 0) + delta;
            while (z.rangeTimer >= 0.5) {
                z.rangeTimer -= 0.5;
                const rTicks = (z.rangeTicks || 0);
                z.rangeTicks = rTicks + 1;
                const rDmg = 3 + rTicks;
                rangeTargets.forEach(t => {
                    if (Math.abs(t.position.x - z.x) < z.halfSize && Math.abs(t.position.z - z.z) < z.halfSize) {
                        if (typeof showFloatingDamage === 'function') showFloatingDamage(rDmg, t.position);
                    }
                });
            }
        }
    }
}

if (typeof window !== 'undefined') {
    window.createCryoZone = createCryoZone;
    window.updateCryoZones = updateCryoZones;
    window.createGrenadeExplosionParticles = createGrenadeExplosionParticles;
    window.drawCryoCountdownCanvas = drawCryoCountdownCanvas;
}

// #endregion
