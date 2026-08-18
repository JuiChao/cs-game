// #region 小地图与轨迹
function updateMinimap() {
    const canvas = document.getElementById('minimap-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    
    ctx.clearRect(0, 0, w, h);
    
    const scale = w / 800;
    const cx = w / 2;
    const cy = h / 2;
    
    // Draw obstacles (walls/terrain)
    ctx.fillStyle = 'rgba(150, 150, 150, 0.5)';
    collidableMeshList.forEach(mesh => {
        if (mesh.worldBox) {
            const minX = cx + mesh.worldBox.min.x * scale;
            const minZ = cy + mesh.worldBox.min.z * scale;
            const boxWidth = (mesh.worldBox.max.x - mesh.worldBox.min.x) * scale;
            const boxHeight = (mesh.worldBox.max.z - mesh.worldBox.min.z) * scale;
            ctx.fillRect(minX, minZ, boxWidth, boxHeight);
        }
    });
    
    bombZones.forEach((zone, index) => {
        const x = cx + zone.mesh.position.x * scale;
        const z = cy + zone.mesh.position.z * scale;
        ctx.fillStyle = 'rgba(255, 165, 0, 0.5)'; 
        ctx.fillRect(x - 4, z - 4, 8, 8);

        ctx.fillStyle = 'white';
        ctx.font = '10px "Microsoft YaHei", Arial';
        ctx.textAlign = 'center';
        const isT = playerState.team === 'T';
        const label = isT ? "我方炸弹安放区" : "我方炸弹拆除区";
        ctx.fillText(label, x, z - 8);
    });
    
    bots.forEach(b => {
        if (b.team !== playerState.team) return; // Only show teammates
        
        const x = cx + b.mesh.position.x * scale;
        const z = cy + b.mesh.position.z * scale;
        
        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    });
    
    if (playerState.hp > 0 && !playerState.isSpectating) {
        const x = cx + camera.position.x * scale;
        const z = cy + camera.position.z * scale;
        
        ctx.beginPath();
        ctx.arc(x, z, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2ecc71';
        ctx.fill();
        
        const dir = new THREE.Vector3();
        camera.getWorldDirection(dir);
        ctx.beginPath();
        ctx.moveTo(x, z);
        ctx.lineTo(x + dir.x * 8, z + dir.z * 8);
        ctx.strokeStyle = '#2ecc71';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

let trajectoryLine = null;
let trajectoryArea = null;

function updateTrajectory() {
    const weapon = getCurrentWeapon();
    if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'sandbag'].includes(weapon.id) || !controls || !controls.isLocked || playerState.hp <= 0 || playerState.isSpectating) {
        if (trajectoryLine) {
            scene.remove(trajectoryLine);
            trajectoryLine.geometry.dispose();
            trajectoryLine.material.dispose();
            trajectoryLine = null;
        }
        if (trajectoryArea) {
            scene.remove(trajectoryArea);
            trajectoryArea.geometry.dispose();
            trajectoryArea.material.dispose();
            trajectoryArea = null;
        }
        return;
    }
    
    const points = [];
    let pos = camera.position.clone();
    let dir = new THREE.Vector3();
    camera.getWorldDirection(dir);
    dir.y += 0.3;
    dir.normalize();
    
    let vel = dir.multiplyScalar(65);
    const dt = 0.05; 
    
    const isFromDrone = playerState.isControllingDrone;
    const lifeTime = weapon.id === 'molotov' ? Infinity : (weapon.id === 'hegrenade' && isFromDrone ? 1.5 : 2.0);
    const maxIters = lifeTime === Infinity ? 40 : Math.floor(lifeTime / dt);
    
    for (let i = 0; i < maxIters; i++) { 
        points.push(pos.clone());
        vel.y -= 40 * dt; 
        
        let nextX = pos.x + vel.x * dt;
        let nextY = pos.y + vel.y * dt;
        let nextZ = pos.z + vel.z * dt;
        
        let hitFloor = false;
        if (nextY <= 0.25) {
            nextY = 0.25;
            hitFloor = true;
        }
        
        const box = new THREE.Box3(
            new THREE.Vector3(nextX - 0.25, nextY - 0.25, nextZ - 0.25),
            new THREE.Vector3(nextX + 0.25, nextY + 0.25, nextZ + 0.25)
        );
        let col = collidableMeshList.some(wall => wall.worldBox.intersectsBox(box));
        
        if (col) {
            vel.x *= -0.5;
            vel.z *= -0.5;
        } else {
            pos.x = nextX;
            pos.z = nextZ;
        }
        
        pos.y = nextY;
        
        if (hitFloor) {
            if (weapon.id === 'molotov') {
                points.push(pos.clone());
                break;
            }
            vel.y *= -0.5;
            vel.x *= 0.8;
            vel.z *= 0.8;
        }
    }
    
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    if (!trajectoryLine) {
        const color = weapon.id === 'hegrenade' ? 0x00ff00 : (weapon.id === 'flashbang' ? 0xffffff : (weapon.id === 'molotov' ? 0xff4400 : 0xaa8844));
        const mat = new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 0.8, linewidth: 2 });
        trajectoryLine = new THREE.Line(geo, mat);
        scene.add(trajectoryLine);
    } else {
        trajectoryLine.geometry.dispose();
        trajectoryLine.geometry = geo;
        trajectoryLine.material.color.setHex(weapon.id === 'hegrenade' ? 0x00ff00 : (weapon.id === 'flashbang' ? 0xffffff : (weapon.id === 'molotov' ? 0xff4400 : 0xaa8844)));
    }
    
    const finalPos = points[points.length - 1];
    
    if (weapon.id === 'molotov') {
        const size = 45;
        if (!trajectoryArea || trajectoryArea.geometry.type !== 'PlaneGeometry') {
            if (trajectoryArea) {
                scene.remove(trajectoryArea);
                trajectoryArea.geometry.dispose();
                trajectoryArea.material.dispose();
            }
            const planeGeo = new THREE.PlaneGeometry(size, size);
            const planeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            trajectoryArea = new THREE.Mesh(planeGeo, planeMat);
            trajectoryArea.rotation.x = -Math.PI / 2;
            scene.add(trajectoryArea);
        }
    } else {
        const radius = (weapon.id === 'hegrenade' && isFromDrone) ? 50 : 40;
        if (!trajectoryArea || trajectoryArea.geometry.type !== 'CircleGeometry' || trajectoryArea.geometry.parameters.radius !== radius) {
            if (trajectoryArea) {
                scene.remove(trajectoryArea);
                trajectoryArea.geometry.dispose();
                trajectoryArea.material.dispose();
            }
            const circleGeo = new THREE.CircleGeometry(radius, 32);
            const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
            trajectoryArea = new THREE.Mesh(circleGeo, circleMat);
            trajectoryArea.rotation.x = -Math.PI / 2;
            scene.add(trajectoryArea);
        }
    }
    
    // Always render the area circle on the ground for accurate aiming, even if it explodes mid-air
    trajectoryArea.position.set(finalPos.x, 0.05, finalPos.z);
}

function destroyDrone(drone, exploded = false) {
    if (exploded) {
        triggerDroneExplosion(drone);
    } else {
        createHitEffect(drone.mesh.position, true); // Debris effect
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
        removePlayerDummy();
        camera.position.copy(drone.playerPos);
        updateHUD();
    } else {
        const bot = bots.find(b => b.id === drone.ownerId);
        if (bot) {
            bot.isControllingDrone = false;
            bot.lastShot = frameCount;
        }
    }
}

// --- MOBILE TOUCH CONTROLS ---
// #endregion
