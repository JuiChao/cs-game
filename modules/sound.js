// #region 枪械音效系统 (CS 1.6 sounds)
let sndCtx = null;
const soundBuffers = {};
let soundSystemReady = false;
let activeGunSounds = 0;

// 武器ID -> 音效键名映射
const WEAPON_SOUND_KEYS = {
    pistol: 'pistol_shoot',
    rifle: 'rifle_shoot',
    sniper: 'sniper_shoot',
    marksman: 'marksman_shoot',
    smg: 'smg_shoot',
    mk4: 'smg_shoot',
    shotgun: 'shotgun_shoot',
    m249: 'm249_shoot',
    gatling: 'm249_shoot',
    ash12: 'ash12_shoot',
    deagle: 'deagle_shoot'
};

// 换弹音效序列: [弹匣退出, 弹匣插入, 拉栓]（时间为换弹时长百分比）
const RELOAD_SEQUENCES = {
    pistol:   { out: 'reload_pistol_out',   in: 'reload_pistol_in',   bolt: 'reload_pistol_bolt',  boltAt: 0.80 },
    rifle:    { out: 'reload_rifle_out',    in: 'reload_rifle_in',    bolt: 'reload_rifle_bolt',   boltAt: 0.80 },
    sniper:   { out: 'reload_sniper_out',   in: 'reload_sniper_in',   bolt: 'reload_sniper_bolt',  boltAt: 0.80 },
    marksman: { out: 'reload_marksman_out', in: 'reload_marksman_in', bolt: 'reload_marksman_bolt', boltAt: 0.80 },
    smg:      { out: 'reload_smg_out',      in: 'reload_smg_in',      bolt: null,                  boltAt: 1.0 },
    mk4:      { out: 'reload_smg_out',      in: 'reload_smg_in',      bolt: null,                  boltAt: 1.0 },
    shotgun:  { out: 'reload_shotgun_shell', in: null,                bolt: 'reload_shotgun_pump', boltAt: 0.85 },
    m249:     { out: 'reload_m249_out',     in: 'reload_m249_in',     bolt: null,                  boltAt: 1.0 },
    gatling:  { out: 'reload_m249_out',     in: 'reload_m249_in',     bolt: null,                  boltAt: 1.0 },
    ash12:    { out: 'reload_ash12_out',    in: 'reload_ash12_in',    bolt: null,                  boltAt: 1.0 },
    deagle:   { out: 'reload_deagle_out',   in: 'reload_deagle_in',   bolt: null,                  boltAt: 1.0 }
};

function base64ToArrayBuffer(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes.buffer;
}

function initSoundSystem() {
    if (soundSystemReady) return;
    try {
        sndCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
        return;
    }
    soundSystemReady = true;
    // 解码所有音效
    const keys = Object.keys(SOUNDS_DATA);
    let pending = keys.length;
    keys.forEach(key => {
        try {
            sndCtx.decodeAudioData(base64ToArrayBuffer(SOUNDS_DATA[key]), buf => {
                soundBuffers[key] = buf;
            }, () => {});
        } catch (e) {}
    });
}

function resumeSoundContext() {
    if (sndCtx && sndCtx.state === 'suspended') sndCtx.resume();
}

// 通用播放: name音效键, volume音量, rate播放速率(音调), pan声像(-1左 ~ 1右)
function playSound(name, volume = 1.0, rate = 1.0, pan = 0) {
    if (!soundSystemReady || !sndCtx) return;
    const buf = soundBuffers[name];
    if (!buf) return;
    if (sndCtx.state === 'suspended') sndCtx.resume();

    const src = sndCtx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;

    const gain = sndCtx.createGain();
    gain.gain.value = volume;

    let node = src;
    if (pan !== 0 && sndCtx.createStereoPanner) {
        const panner = sndCtx.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, pan));
        node.connect(panner);
        panner.connect(gain);
    } else {
        node.connect(gain);
    }
    gain.connect(sndCtx.destination);
    src.start(0);
}

// 玩家开枪音效: 带轻微音调/音量随机变化，连续射击更自然
function playGunSound(weaponId, worldPos = null) {
    const key = WEAPON_SOUND_KEYS[weaponId];
    if (!key) return;

    let volume = 0.55;
    let pan = 0;
    let isEnemy = false;

    if (worldPos && camera) {
        // 敌人射击: 距离衰减 + 声像定位
        isEnemy = true;
        const dist = camera.position.distanceTo(worldPos);
        if (dist > 700) return; // 太远听不见
        const atten = Math.max(0.06, 1 - dist / 700);
        volume = 0.4 * atten;

        // 声像: 目标方向在相机右向量上的投影
        const toSrc = new THREE.Vector3().subVectors(worldPos, camera.position).normalize();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        pan = Math.max(-0.9, Math.min(0.9, toSrc.dot(right)));
    }

    // 限制同时播放的敌人枪声数量，防止爆音
    if (isEnemy) {
        if (activeGunSounds > 10) return;
        activeGunSounds++;
        setTimeout(() => activeGunSounds--, 150);
    }

    // 加特林用略高音调与M249区分
    let baseRate = 1.0;
    if (weaponId === 'gatling') baseRate = 1.08;

    const rate = baseRate * (0.96 + Math.random() * 0.08);
    const vol = volume * (0.9 + Math.random() * 0.2);
    playSound(key, vol, rate, pan);
}

// 换弹音效序列
function playReloadSequence(weaponId, reloadTime) {
    const seq = RELOAD_SEQUENCES[weaponId];
    if (!seq || !soundSystemReady) return;
    const dur = (reloadTime * 1000) || 2000;

    if (seq.out) playSound(seq.out, 0.5, 1.0, 0);
    if (seq.in) setTimeout(() => {
        if (!isReloading) return;
        playSound(seq.in, 0.5, 1.0, 0);
    }, dur * 0.40);
    if (seq.bolt) setTimeout(() => {
        if (!isReloading) return;
        playSound(seq.bolt, 0.5, 1.0, 0);
    }, dur * seq.boltAt);
}

// 空仓点击
function playEmptyClick() {
    playSound('empty_click', 0.5, 0.98 + Math.random() * 0.04, 0);
}

// 开镜音效
function playScopeZoom() {
    playSound('scope_zoom', 0.4, 1.0, 0);
}

// 爆炸音效
function playExplosionSound(worldPos = null) {
    let volume = 0.65;
    let pan = 0;
    if (worldPos && camera) {
        const dist = camera.position.distanceTo(worldPos);
        if (dist > 900) volume = 0.15;
        else volume = 0.65 * Math.max(0.2, 1 - dist / 1200);
        const toSrc = new THREE.Vector3().subVectors(worldPos, camera.position).normalize();
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        pan = Math.max(-0.9, Math.min(0.9, toSrc.dot(right)));
    }
    playSound('explosion', volume, 0.97 + Math.random() * 0.06, pan);
}

// 手雷拉环
function playGrenadePin() {
    playSound('grenade_pin', 0.45, 1.0, 0);
}

// 刀械音效
function playKnifeSound(type) {
    // type: 'swing1' | 'swing2' | 'stab' | 'hit'
    const map = { swing1: 'knife_swing1', swing2: 'knife_swing2', stab: 'knife_stab', hit: 'knife_hit1', hit2: 'knife_hit2' };
    const key = map[type];
    if (!key) return;
    playSound(key, 0.55, 0.97 + Math.random() * 0.06, 0);
}

let proceduralNoiseBuffer = null;
function getProceduralNoiseBuffer() {
    if (proceduralNoiseBuffer || !sndCtx) return proceduralNoiseBuffer;
    try {
        const length = Math.floor(sndCtx.sampleRate * 1.0); // 1.0s procedural noise buffer
        const buf = sndCtx.createBuffer(1, length, sndCtx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        proceduralNoiseBuffer = buf;
    } catch (e) {}
    return proceduralNoiseBuffer;
}

// 动态移动脚步声（Web Audio 合成白噪声带通滤波: 沙石 / 金属，单例噪声零GC分配）
function playFootstepSound(surface = 'sand', volume = 0.3) {
    if (!soundSystemReady || !sndCtx) return;
    if (sndCtx.state === 'suspended') sndCtx.resume();
    try {
        const noiseBuf = getProceduralNoiseBuffer();
        if (!noiseBuf) return;
        const src = sndCtx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = sndCtx.createBiquadFilter();
        if (surface === 'metal') {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(1400 + Math.random() * 200, sndCtx.currentTime);
            filter.Q.setValueAtTime(3.5, sndCtx.currentTime);
        } else {
            filter.type = 'bandpass';
            filter.frequency.setValueAtTime(650 + Math.random() * 150, sndCtx.currentTime);
            filter.Q.setValueAtTime(1.5, sndCtx.currentTime);
        }

        const gain = sndCtx.createGain();
        const now = sndCtx.currentTime;
        gain.gain.setValueAtTime(volume * (0.85 + Math.random() * 0.3), now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(sndCtx.destination);

        const offset = Math.random() * 0.8;
        src.start(now, offset, 0.055);
        src.stop(now + 0.055);
    } catch (e) {}
}

// 落地跳跃缓冲音效（单例噪声零GC分配）
function playLandSound(surface = 'sand', volume = 0.5) {
    if (!soundSystemReady || !sndCtx) return;
    if (sndCtx.state === 'suspended') sndCtx.resume();
    try {
        const noiseBuf = getProceduralNoiseBuffer();
        if (!noiseBuf) return;
        const src = sndCtx.createBufferSource();
        src.buffer = noiseBuf;
        src.loop = true;

        const filter = sndCtx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(surface === 'metal' ? 850 : 380, sndCtx.currentTime);
        filter.Q.setValueAtTime(1.8, sndCtx.currentTime);

        const gain = sndCtx.createGain();
        const now = sndCtx.currentTime;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

        src.connect(filter);
        filter.connect(gain);
        gain.connect(sndCtx.destination);

        const offset = Math.random() * 0.8;
        src.start(now, offset, 0.11);
        src.stop(now + 0.11);
    } catch (e) {}
}

// C4 动态渐进逼近蜂鸣（随剩余时间由慢变急促，空间立体声音效）
function playC4Beep(worldPos = null, freq = 1046.5) {
    if (!soundSystemReady || !sndCtx) return;
    if (sndCtx.state === 'suspended') sndCtx.resume();
    try {
        const osc = sndCtx.createOscillator();
        const gain = sndCtx.createGain();
        const now = sndCtx.currentTime;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);

        let volume = 0.45;
        let pan = 0;
        if (worldPos && camera) {
            const dist = camera.position.distanceTo(worldPos);
            if (dist > 1100) return;
            const atten = Math.max(0.08, 1 - dist / 1100);
            volume = 0.45 * atten;

            const toSrc = new THREE.Vector3().subVectors(worldPos, camera.position).normalize();
            const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
            pan = Math.max(-0.9, Math.min(0.9, toSrc.dot(right)));
        }

        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.055);

        let node = osc;
        if (pan !== 0 && sndCtx.createStereoPanner) {
            const panner = sndCtx.createStereoPanner();
            panner.pan.value = pan;
            node.connect(panner);
            panner.connect(gain);
        } else {
            node.connect(gain);
        }
        gain.connect(sndCtx.destination);

        osc.start(now);
        osc.stop(now + 0.055);
    } catch (e) {}
}

// 准星命中确认音 (Hit-Marker)
function playHitMarkerSound(isHeadshot = false) {
    if (typeof showHitMarker === 'function') showHitMarker(isHeadshot);
    if (!soundSystemReady || !sndCtx) return;
    if (sndCtx.state === 'suspended') sndCtx.resume();
    try {
        const osc = sndCtx.createOscillator();
        const gain = sndCtx.createGain();
        const now = sndCtx.currentTime;

        osc.type = isHeadshot ? 'triangle' : 'sine';
        const startFreq = isHeadshot ? 2400 : 1600;
        osc.frequency.setValueAtTime(startFreq, now);
        osc.frequency.exponentialRampToValueAtTime(startFreq * 0.4, now + 0.035);

        const volume = isHeadshot ? 0.42 : 0.28;
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

        osc.connect(gain);
        gain.connect(sndCtx.destination);

        osc.start(now);
        osc.stop(now + 0.035);
    } catch (e) {}
}

// 首次用户交互时初始化（浏览器自动播放策略）
(function () {
    const unlock = () => {
        initSoundSystem();
        resumeSoundContext();
    };
    document.addEventListener('mousedown', unlock, { once: true });
    document.addEventListener('touchstart', unlock, { once: true });
    document.addEventListener('keydown', unlock, { once: true });
})();
// #endregion
