// #region 触控与窗口
function setupTouchControls() {
    if (typeof document !== 'undefined' && document.body) {
        document.body.classList.add('touch-device');
    }

    const joystickZone = document.getElementById('joystick-zone');
    let joyKnob = null;
    let joyTouchId = null;
    let joyStartX = 0;
    let joyStartY = 0;

    // Helper to reset movement flags
    function resetJoyMovement() {
        moveForward = false;
        moveBackward = false;
        moveLeft = false;
        moveRight = false;
        if (joyKnob) {
            joyKnob.style.transform = 'translate(0px, 0px)';
        }
    }

    // Helper to process joystick vector
    function processJoyMovement(dx, dy) {
        const dist = Math.hypot(dx, dy);
        const deadzone = 12; // 阻尼死区 (12px)
        if (dist < deadzone) {
            moveForward = false;
            moveBackward = false;
            moveLeft = false;
            moveRight = false;
            return;
        }
        const normX = dx / dist;
        const normY = -dy / dist; // Inverted screen Y: dragging up (negative dy) is forward (positive Y)
        moveForward = normY > 0.25;
        moveBackward = normY < -0.25;
        moveRight = normX > 0.25;
        moveLeft = normX < -0.25;
    }

    if (joystickZone) {
        // Ensure visual knob element exists inside joystick-zone for native feedback
        joyKnob = joystickZone.querySelector('.joystick-knob');
        if (!joyKnob) {
            joyKnob = document.createElement('div');
            joyKnob.className = 'joystick-knob';
            joystickZone.appendChild(joyKnob);
        }

        if (window.nipplejs) {
            // When NippleJS is available, initialize NippleJS manager
            try {
                const manager = nipplejs.create({
                    zone: joystickZone,
                    mode: 'semi',
                    catchDistance: 150,
                    color: 'white',
                    size: 100
                });

                manager.on('move', function (evt, data) {
                    if (!data || !data.vector) return;
                    const x = data.vector.x;
                    const y = data.vector.y;
                    const dist = data.distance || 0;
                    const deadzone = 12; // 阻尼死区 (12px)
                    if (dist < deadzone) {
                        moveForward = false;
                        moveBackward = false;
                        moveLeft = false;
                        moveRight = false;
                        return;
                    }
                    moveForward = y > 0.25;
                    moveBackward = y < -0.25;
                    moveRight = x > 0.25;
                    moveLeft = x < -0.25;
                });

                manager.on('end', function () {
                    moveForward = false;
                    moveBackward = false;
                    moveLeft = false;
                    moveRight = false;
                });
            } catch (err) {
                console.warn("Failed to initialize NippleJS, using native touch fallback:", err);
            }
        }

        // Native touch joystick handler: works as fallback when NippleJS is absent,
        // and also catches touches on joystickZone or immediate catchment area
        function handleNativeTouchStart(e) {
            if (joyTouchId !== null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                const rect = joystickZone.getBoundingClientRect();
                const insideZone = (
                    touch.clientX >= rect.left - 40 &&
                    touch.clientX <= rect.right + 40 &&
                    touch.clientY >= rect.top - 40 &&
                    touch.clientY <= rect.bottom + 40
                );
                if (insideZone) {
                    e.preventDefault();
                    joyTouchId = touch.identifier;
                    joyStartX = rect.left + rect.width / 2;
                    joyStartY = rect.top + rect.height / 2;
                    const dx = touch.clientX - joyStartX;
                    const dy = touch.clientY - joyStartY;
                    const maxRadius = Math.max(30, rect.width * 0.4);
                    const dist = Math.hypot(dx, dy);
                    const clampedDist = Math.min(dist, maxRadius);
                    const angle = Math.atan2(dy, dx);
                    if (joyKnob) {
                        joyKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
                    }
                    processJoyMovement(dx, dy);
                    break;
                }
            }
        }

        function handleNativeTouchMove(e) {
            if (joyTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                const touch = e.changedTouches[i];
                if (touch.identifier === joyTouchId) {
                    e.preventDefault();
                    const dx = touch.clientX - joyStartX;
                    const dy = touch.clientY - joyStartY;
                    const rect = joystickZone.getBoundingClientRect();
                    const maxRadius = Math.max(30, rect.width * 0.4);
                    const dist = Math.hypot(dx, dy);
                    const clampedDist = Math.min(dist, maxRadius);
                    const angle = Math.atan2(dy, dx);
                    if (joyKnob) {
                        joyKnob.style.transform = `translate(${Math.cos(angle) * clampedDist}px, ${Math.sin(angle) * clampedDist}px)`;
                    }
                    processJoyMovement(dx, dy);
                    break;
                }
            }
        }

        function handleNativeTouchEnd(e) {
            if (joyTouchId === null) return;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === joyTouchId) {
                    joyTouchId = null;
                    resetJoyMovement();
                    break;
                }
            }
        }

        joystickZone.addEventListener('touchstart', handleNativeTouchStart, { passive: false });
        window.addEventListener('touchmove', handleNativeTouchMove, { passive: false });
        window.addEventListener('touchend', handleNativeTouchEnd, { passive: false });
        window.addEventListener('touchcancel', handleNativeTouchEnd, { passive: false });
    }

    // Touch to look (Right screen)
    const lookZone = document.getElementById('touch-look-zone');
    let lastTouchX = 0;
    let lastTouchY = 0;
    let lookTouchId = null;
    
    // Ensure rotation order is correct for FPS camera
    if (camera) camera.rotation.order = 'YXZ';

    if (lookZone) {
        lookZone.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (typeof mortarCameraActive !== 'undefined' && mortarCameraActive) {
                if (typeof cancelMortarCamera === 'function') cancelMortarCamera();
                return;
            }
            if (lookTouchId === null && e.changedTouches.length > 0) {
                const touch = e.changedTouches[0];
                lookTouchId = touch.identifier;
                lastTouchX = touch.pageX;
                lastTouchY = touch.pageY;
            }
        }, { passive: false });

        lookZone.addEventListener('touchmove', (e) => {
            e.preventDefault(); // Prevent scrolling
            if (playerState.isSpectating) return;

            let touch = null;
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookTouchId) {
                    touch = e.changedTouches[i];
                    break;
                }
            }
            if (!touch) return;

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

        lookZone.addEventListener('touchend', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookTouchId) {
                    lookTouchId = null;
                    break;
                }
            }
        }, { passive: false });

        lookZone.addEventListener('touchcancel', (e) => {
            e.preventDefault();
            for (let i = 0; i < e.changedTouches.length; i++) {
                if (e.changedTouches[i].identifier === lookTouchId) {
                    lookTouchId = null;
                    break;
                }
            }
        }, { passive: false });
    }

    // Action Buttons
    const btnShoot = document.getElementById('touch-shoot');
    if (btnShoot) {
        btnShoot.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (playerState.isSpectating) {
                cycleSpectator();
            } else {
                isShooting = true;
                handleShooting(true);
            }
        });
        btnShoot.addEventListener('touchend', (e) => { e.preventDefault(); isShooting = false; });
        btnShoot.addEventListener('touchcancel', (e) => { e.preventDefault(); isShooting = false; });
    }
    
    const btnAim = document.getElementById('touch-aim');
    if (btnAim) {
        btnAim.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const w = getCurrentWeapon();
            if (w.id === 'gatling' || w.id === 'mortar' || w.id === 'zombieClaw' || w.id === 'flamethrower') return;
            playerState.isAds = !playerState.isAds;
            if (playerState.isAds && (w.id === 'sniper' || w.id === 'marksman')) playScopeZoom();
        });
    }
    
    const btnJump = document.getElementById('touch-jump');
    if (btnJump) {
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
        btnJump.addEventListener('touchcancel', (e) => { e.preventDefault(); moveUp = false; });
    }
    
    const btnReload = document.getElementById('touch-reload');
    if (btnReload) {
        btnReload.addEventListener('touchstart', (e) => { e.preventDefault(); handleReload(); });
    }
    
    const btnInteract = document.getElementById('touch-interact');
    if (btnInteract) {
        btnInteract.addEventListener('touchstart', (e) => { e.preventDefault(); isInteracting = true; });
        btnInteract.addEventListener('touchend', (e) => { e.preventDefault(); isInteracting = false; });
        btnInteract.addEventListener('touchcancel', (e) => { e.preventDefault(); isInteracting = false; });
    }
    
    const btnCrouch = document.getElementById('touch-crouch');
    if (btnCrouch) {
        btnCrouch.addEventListener('touchstart', (e) => { e.preventDefault(); moveDown = true; });
        btnCrouch.addEventListener('touchend', (e) => { e.preventDefault(); moveDown = false; });
        btnCrouch.addEventListener('touchcancel', (e) => { e.preventDefault(); moveDown = false; });
    }

    const btnShift = document.getElementById('touch-shift');
    if (btnShift) {
        btnShift.addEventListener('touchstart', (e) => {
            e.preventDefault();
            if (playerState.isControllingDrone) {
                const pd = activeDrones.find(d => d.isPlayer);
                if (pd) pd.selfDestructing = true;
            }
        });
    }
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
        const fsBtn = document.getElementById('touch-fullscreen');
        if (fsBtn) fsBtn.innerText = "退出";
    } else {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) { /* Safari */
            document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) { /* IE11 */
            document.msExitFullscreen();
        }
        const fsBtn = document.getElementById('touch-fullscreen');
        if (fsBtn) fsBtn.innerText = "全屏";
    }
}

window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
    if (camera && renderer) {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        if (typeof onPostprocessingResize === 'function') {
            onPostprocessingResize(window.innerWidth, window.innerHeight);
        }
    }
}

// #endregion 触控与窗口
