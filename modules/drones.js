// #region 无人机系统
function createDrone(start, direction, team, isPlayer = true, ownerId = null) {
    if (isPlayer && activeDrones.some(d => d.isPlayer)) return; // Only 1 player drone
    
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
        createPlayerDummy();
    }
    
    updateHUD();
}

// #endregion
