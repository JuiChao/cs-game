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
        if (b.team !== playerState.team || b.isDead) return; // Only show teammates

        const x = cx + b.mesh.position.x * scale;
        const z = cy + b.mesh.position.z * scale;

        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#3498db';
        ctx.fill();
    });

    // 敌人暴露: 透视模式全显 / 最近1.5秒内开过枪或攻击过的敌人
    bots.forEach(b => {
        if (b.team === playerState.team || b.isDead) return;
        const firedRecently = (b.lastShot && frameCount - b.lastShot < 90) || (b.lastZombieAttack && frameCount - b.lastZombieAttack < 90);
        if (!wallhackActive && !firedRecently) return;

        const x = cx + b.mesh.position.x * scale;
        const z = cy + b.mesh.position.z * scale;

        ctx.beginPath();
        ctx.arc(x, z, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ff4444';
        ctx.fill();
    });

    // 已安放的C4: 红点闪烁
    if (bombState.planted && bombState.mesh && Math.floor(frameCount / 30) % 2 === 0) {
        const x = cx + bombState.mesh.position.x * scale;
        const z = cy + bombState.mesh.position.z * scale;
        ctx.beginPath();
        ctx.arc(x, z, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ff0000';
        ctx.fill();
    }

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

const MAX_TRAJECTORY_POINTS = 128;
const trajectoryPositions = new Float32Array(MAX_TRAJECTORY_POINTS * 3);
let trajectoryGeo = null;
let trajectoryLine = null;
let trajectoryAreaPlane = null;
let trajectoryAreaCircle = null;
let trajectoryArea = null;

const _trajCamDir = new THREE.Vector3();
const _trajBox = new THREE.Box3();
const _trajBoxMin = new THREE.Vector3();
const _trajBoxMax = new THREE.Vector3();

function initTrajectoryObjects() {
    if (!trajectoryLine) {
        trajectoryGeo = new THREE.BufferGeometry();
        trajectoryGeo.setAttribute('position', new THREE.BufferAttribute(trajectoryPositions, 3));
        const mat = new THREE.LineBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.8, linewidth: 2 });
        trajectoryLine = new THREE.Line(trajectoryGeo, mat);
        trajectoryLine.frustumCulled = false;
        trajectoryLine.visible = false;
        scene.add(trajectoryLine);
    }
    if (!trajectoryAreaPlane) {
        const planeGeo = new THREE.PlaneGeometry(45, 45);
        const planeMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        trajectoryAreaPlane = new THREE.Mesh(planeGeo, planeMat);
        trajectoryAreaPlane.rotation.x = -Math.PI / 2;
        trajectoryAreaPlane.visible = false;
        scene.add(trajectoryAreaPlane);
    }
    if (!trajectoryAreaCircle) {
        // Base radius 40 circle; can scale uniformly for other radii
        const circleGeo = new THREE.CircleGeometry(40, 32);
        const circleMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, side: THREE.DoubleSide });
        trajectoryAreaCircle = new THREE.Mesh(circleGeo, circleMat);
        trajectoryAreaCircle.rotation.x = -Math.PI / 2;
        trajectoryAreaCircle.visible = false;
        scene.add(trajectoryAreaCircle);
    }
}

if (typeof window !== 'undefined') {
    window.getTrajectoryLine = () => trajectoryLine;
    window.getTrajectoryGeo = () => trajectoryGeo;
    window.getTrajectoryPositions = () => trajectoryPositions;
}

function updateTrajectory() {
    const weapon = getCurrentWeapon();
    if (!weapon || !['hegrenade', 'flashbang', 'molotov', 'smoke', 'sandbag', 'mine'].includes(weapon.id) || !controls || (!controls.isLocked && !isPlayerControlActive()) || playerState.hp <= 0 || playerState.isSpectating) {
        if (trajectoryLine) trajectoryLine.visible = false;
        if (trajectoryAreaPlane) trajectoryAreaPlane.visible = false;
        if (trajectoryAreaCircle) trajectoryAreaCircle.visible = false;
        trajectoryArea = null;
        return;
    }
    
    initTrajectoryObjects();
    
    let posX = camera.position.x;
    let posY = camera.position.y;
    let posZ = camera.position.z;
    
    camera.getWorldDirection(_trajCamDir);
    let dirX = _trajCamDir.x;
    let dirY = _trajCamDir.y + 0.3;
    let dirZ = _trajCamDir.z;
    let dirLen = Math.hypot(dirX, dirY, dirZ);
    if (dirLen > 0.00001) {
        dirX /= dirLen;
        dirY /= dirLen;
        dirZ /= dirLen;
    }
    
    let velX = dirX * 65;
    let velY = dirY * 65;
    let velZ = dirZ * 65;
    const dt = 0.05;
    
    const isFromDrone = playerState.isControllingDrone;
    const lifeTime = weapon.id === 'molotov' ? Infinity : (weapon.id === 'hegrenade' && isFromDrone ? 1.5 : 2.0);
    const maxIters = lifeTime === Infinity ? 40 : Math.min(MAX_TRAJECTORY_POINTS - 2, Math.floor(lifeTime / dt));
    
    let count = 0;
    
    for (let i = 0; i < maxIters; i++) {
        trajectoryPositions[count * 3 + 0] = posX;
        trajectoryPositions[count * 3 + 1] = posY;
        trajectoryPositions[count * 3 + 2] = posZ;
        count++;
        
        velY -= 40 * dt;
        
        let nextX = posX + velX * dt;
        let nextY = posY + velY * dt;
        let nextZ = posZ + velZ * dt;
        
        let hitFloor = false;
        if (nextY <= 0.25) {
            nextY = 0.25;
            hitFloor = true;
        }
        
        _trajBoxMin.set(nextX - 0.25, nextY - 0.25, nextZ - 0.25);
        _trajBoxMax.set(nextX + 0.25, nextY + 0.25, nextZ + 0.25);
        _trajBox.min = _trajBoxMin;
        _trajBox.max = _trajBoxMax;
        
        let col = false;
        for (let j = 0; j < collidableMeshList.length; j++) {
            const wall = collidableMeshList[j];
            if (wall.worldBox && wall.worldBox.intersectsBox(_trajBox)) {
                col = true;
                break;
            }
        }
        
        if (col) {
            velX *= -0.5;
            velZ *= -0.5;
        } else {
            posX = nextX;
            posZ = nextZ;
        }
        
        posY = nextY;
        
        if (hitFloor) {
            if (weapon.id === 'molotov') {
                trajectoryPositions[count * 3 + 0] = posX;
                trajectoryPositions[count * 3 + 1] = posY;
                trajectoryPositions[count * 3 + 2] = posZ;
                count++;
                break;
            }
            velY *= -0.5;
            velX *= 0.8;
            velZ *= 0.8;
        }
    }
    
    trajectoryGeo.attributes.position.needsUpdate = true;
    trajectoryGeo.setDrawRange(0, count);
    
    const lineColor = weapon.id === 'hegrenade' ? 0x00ff00 : (weapon.id === 'flashbang' ? 0xffffff : (weapon.id === 'molotov' ? 0xff4400 : 0xaa8844));
    trajectoryLine.material.color.setHex(lineColor);
    trajectoryLine.visible = true;
    
    const finalX = count > 0 ? trajectoryPositions[(count - 1) * 3 + 0] : posX;
    const finalZ = count > 0 ? trajectoryPositions[(count - 1) * 3 + 2] : posZ;
    
    if (weapon.id === 'molotov') {
        if (trajectoryAreaCircle) trajectoryAreaCircle.visible = false;
        trajectoryArea = trajectoryAreaPlane;
        trajectoryArea.visible = true;
    } else {
        if (trajectoryAreaPlane) trajectoryAreaPlane.visible = false;
        const radius = (weapon.id === 'hegrenade' && isFromDrone) ? 50 : 40;
        const scaleFactor = radius / 40;
        trajectoryAreaCircle.scale.set(scaleFactor, scaleFactor, 1);
        trajectoryArea = trajectoryAreaCircle;
        trajectoryArea.visible = true;
    }
    
    // Always render the area circle on the ground for accurate aiming, even if it explodes mid-air
    trajectoryArea.position.set(finalX, 0.05, finalZ);
}


// --- MOBILE TOUCH CONTROLS ---
// #endregion
