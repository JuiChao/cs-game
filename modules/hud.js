// #region HUD 与公告
function showBombAnnouncement(planterTeam) {
    let msg = (planterTeam === playerState.team) ? '我方已安放炸弹' : '敌方已安放炸弹';
    let el = document.getElementById('bomb-announcement');
    if (!el) {
        el = document.createElement('div');
        el.id = 'bomb-announcement';
        el.style.position = 'absolute';
        el.style.top = '25%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.color = '#ff3c3c';
        el.style.fontSize = '2.5rem';
        el.style.fontWeight = 'bold';
        el.style.fontFamily = '"Orbitron", "Inter", "Microsoft YaHei", sans-serif';
        el.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '100';
        el.style.transition = 'opacity 0.3s ease';
        document.getElementById('hud').appendChild(el);
    }
    el.innerText = msg;
    el.style.opacity = 1;
    
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => {
        el.style.opacity = 0;
    }, 2000);
}

function showAnnouncement(msg, color = 'white') {
    let el = document.getElementById('general-announcement');
    if (!el) {
        el = document.createElement('div');
        el.id = 'general-announcement';
        el.style.position = 'absolute';
        el.style.top = '15%';
        el.style.left = '50%';
        el.style.transform = 'translate(-50%, -50%)';
        el.style.fontSize = '2.5rem';
        el.style.fontWeight = 'bold';
        el.style.fontFamily = '"Orbitron", "Inter", "Microsoft YaHei", sans-serif';
        el.style.textShadow = '0 0 10px rgba(0,0,0,0.8)';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '100';
        el.style.transition = 'opacity 0.3s ease';
        document.getElementById('hud').appendChild(el);
    }
    el.style.color = color;
    el.innerText = msg;
    el.style.opacity = 1;
    
    if (el.timeoutId) clearTimeout(el.timeoutId);
    el.timeoutId = setTimeout(() => {
        el.style.opacity = 0;
    }, 3000);
}

function checkWinCondition() {
    if (isShootingRange) return;
    const ctAlive = bots.filter(b => b.team === 'CT').length + (playerState.hp > 0 && playerState.team === 'CT' ? 1 : 0);
    const tAlive = bots.filter(b => b.team === 'T').length + (playerState.hp > 0 && playerState.team === 'T' ? 1 : 0);
    
    document.getElementById('score-ct').innerText = ctAlive;
    document.getElementById('score-t').innerText = tAlive;
    
    document.getElementById('label-t').innerText = playerState.team === 'T' ? '我方 T' : '敌方 T';
    document.getElementById('label-ct').innerText = playerState.team === 'CT' ? '我方 CT' : '敌方 CT';

    if (ctAlive === 0) endRound("所有反恐精英已被消灭！恐怖分子获胜", true, 'elimination');
    if (tAlive === 0) endRound("所有恐怖分子已被消灭！反恐精英获胜", false, 'elimination');
}

// #endregion
