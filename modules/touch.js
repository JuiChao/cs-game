// #region 触控与窗口
function setupTouchControls() {
    if (!window.nipplejs) {
        console.warn("NippleJS not loaded");
        return;
    }

    const joystickZone = document.getElementById('joystick-zone');
    const manager = nipplejs.create({
        zone: joystickZone,
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'white',
        size: 100
    });

    manager.on('move', function (evt, data) {
        const x = data.vector.x;
        const y = data.vector.y;
        moveForward = y > 0.3;
        moveBackward = y < -0.3;
        moveRight = x > 0.3;
        moveLeft = x < -0.3;
    });

    manager.on('end', function () {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
    });

    // Touch to look
    const lookZone = document.getElementById('touch-look-zone');
    let lastTouchX = 0;
    let lastTouchY = 0;
    
    // Ensure rotation order is correct for FPS camera
    if (camera) camera.rotation.order = 'YXZ';

    lookZone.addEventListener('touchstart', (e) => {
        lastTouchX = e.changedTouches[0].pageX;
        lastTouchY = e.changedTouches[0].pageY;
    }, { passive: false });

    lookZone.addEventListener('touchmove', (e) => {
        e.preventDefault(); // Prevent scrolling
        if (playerState.isSpectating) return;

        const touch = e.changedTouches[0];
        const dx = touch.pageX - lastTouchX;
        const dy = touch.pageY - lastTouchY;

        let sensitivity = 0.005;
        if (playerState.isAds) {
            sensitivity = 0.002; // lower sensitivity when aiming
        }

        camera.rotation.y -= dx * sensitivity;
        camera.rotation.x -= dy * sensitivity;

        // limit pitch
        camera.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, camera.rotation.x));

        lastTouchX = touch.pageX;
        lastTouchY = touch.pageY;
    }, { passive: false });
    
    // Action Buttons
    const btnShoot = document.getElementById('touch-shoot');
    btnShoot.addEventListener('touchstart', (e) => { e.preventDefault(); if(playerState.isSpectating){ cycleSpectator(); } else { isShooting = true; handleShooting(true); }});
    btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); isShooting = false; });
    
    const btnAim = document.getElementById('touch-aim');
    btnAim.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const w = getCurrentWeapon();
        if (w.id === 'gatling') return;
        playerState.isAds = !playerState.isAds;
    });
    
    const btnJump = document.getElementById('touch-jump');
    btnJump.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (playerState.isControllingDrone) {
            moveUp = true;
        } else if (playerState.isOnGround && !playerState.isSpectating) {
            playerState.velocity.y = 15;
            playerState.isOnGround = false;
        }
    });
    btnJump.addEventListener('touchend', (e) => { e.preventDefault(); moveUp = false; });
    
    const btnReload = document.getElementById('touch-reload');
    btnReload.addEventListener('touchstart', (e) => { e.preventDefault(); handleReload(); });
    
    const btnInteract = document.getElementById('touch-interact');
    btnInteract.addEventListener('touchstart', (e) => { e.preventDefault(); isInteracting = true; });
    btnInteract.addEventListener('touchend', (e) => { e.preventDefault(); isInteracting = false; });
    
    const btnCrouch = document.getElementById('touch-crouch');
    btnCrouch.addEventListener('touchstart', (e) => { e.preventDefault(); moveDown = true; });
    btnCrouch.addEventListener('touchend', (e) => { e.preventDefault(); moveDown = false; });

    const btnShift = document.getElementById('touch-shift');
    btnShift.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (playerState.isControllingDrone) {
            const pd = activeDrones.find(d => d.isPlayer);
            if (pd) pd.selfDestructing = true;
        }
    });
}

// --- FULLSCREEN & RESIZE HANDLING ---
function toggleFullScreen() {
    if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.documentElement.webkitRequestFullscreen) { /* Safari */
            document.documentElement.webkitRequestFullscreen();
        } else if (document.documentElement.msRequestFullscreen) { /* IE11 */
            document.documentElement.msRequestFullscreen();
        }
        document.getElementById('touch-fullscreen').innerText = "退出";
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
        document.getElementById('touch-fullscreen').innerText = "全屏";
    }
}

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
    }
}

// #endregion 触控与窗口
