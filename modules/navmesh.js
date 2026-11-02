// #region 导航网格与寻路
const NAV_GRID_SIZE = 10;
const NAV_MAP_EXTENT = 400;
const NAV_CELL_COUNT = (NAV_MAP_EXTENT * 2) / NAV_GRID_SIZE;
const NAV_CLIMB_HEIGHT = 5;      // 生化模式: 相邻格允许的爬升高度差（台阶每级2, 采样最大跳4）
const NAV_MAX_STANDABLE = 24;    // 生化模式: 可站立的最高地形（高台14, 30高墙排除）
let navGrid = []; // [x][z] 无障碍可走（爆破模式寻路用）
let navHeight = []; // [x][z] 格内最高可攀地形顶面高度（0=地面, 忽略noClimb护栏）
let navZombieBlocked = []; // [x][z] 生化模式寻路阻挡（护栏/过高墙体）

function buildNavGrid() {
    navGrid = [];
    navHeight = [];
    navZombieBlocked = [];
    for (let x = 0; x < NAV_CELL_COUNT; x++) {
        navGrid[x] = new Array(NAV_CELL_COUNT).fill(true);
        navHeight[x] = new Float32Array(NAV_CELL_COUNT);
        navZombieBlocked[x] = new Array(NAV_CELL_COUNT).fill(false);
    }

    const expandedBoxes = collidableMeshList.map(m => m.worldBox ? m.worldBox.clone().expandByScalar(5.0) : null);
    for (let i = 0; i < collidableMeshList.length; i++) {
        const mesh = collidableMeshList[i];
        if (!mesh.worldBox || !expandedBoxes[i]) continue;
        const eb = expandedBoxes[i];
        const minGx = Math.max(0, Math.min(NAV_CELL_COUNT - 1, Math.floor((eb.min.x + NAV_MAP_EXTENT) / NAV_GRID_SIZE)));
        const maxGx = Math.max(0, Math.min(NAV_CELL_COUNT - 1, Math.floor((eb.max.x + NAV_MAP_EXTENT) / NAV_GRID_SIZE)));
        const minGz = Math.max(0, Math.min(NAV_CELL_COUNT - 1, Math.floor((eb.min.z + NAV_MAP_EXTENT) / NAV_GRID_SIZE)));
        const maxGz = Math.max(0, Math.min(NAV_CELL_COUNT - 1, Math.floor((eb.max.z + NAV_MAP_EXTENT) / NAV_GRID_SIZE)));

        const isNoClimb = mesh.userData && mesh.userData.noClimb;
        const maxY = mesh.worldBox.max.y;

        for (let gx = minGx; gx <= maxGx; gx++) {
            const xMin = -NAV_MAP_EXTENT + gx * NAV_GRID_SIZE;
            const xMax = xMin + NAV_GRID_SIZE;
            if (xMax < eb.min.x || xMin > eb.max.x) continue;

            for (let gz = minGz; gz <= maxGz; gz++) {
                const zMin = -NAV_MAP_EXTENT + gz * NAV_GRID_SIZE;
                const zMax = zMin + NAV_GRID_SIZE;
                if (zMax < eb.min.z || zMin > eb.max.z) continue;

                navGrid[gx][gz] = false;
                if (isNoClimb) {
                    navZombieBlocked[gx][gz] = true;
                } else if (maxY > navHeight[gx][gz]) {
                    navHeight[gx][gz] = maxY;
                }
            }
        }
    }

    for (let x = 0; x < NAV_CELL_COUNT; x++) {
        for (let z = 0; z < NAV_CELL_COUNT; z++) {
            if (navHeight[x][z] > NAV_MAX_STANDABLE) {
                navZombieBlocked[x][z] = true;
            }
            navHeight[x][z] = Math.min(navHeight[x][z], NAV_MAX_STANDABLE);
        }
    }
}

function getGridPos(worldVec) {
    let gx = Math.floor((worldVec.x + NAV_MAP_EXTENT) / NAV_GRID_SIZE);
    let gz = Math.floor((worldVec.z + NAV_MAP_EXTENT) / NAV_GRID_SIZE);
    gx = Math.max(0, Math.min(NAV_CELL_COUNT - 1, gx));
    gz = Math.max(0, Math.min(NAV_CELL_COUNT - 1, gz));
    return { x: gx, z: gz };
}

function getWorldPos(gx, gz) {
    let y = 0;
    // 生化模式: 路点带地形高度, Bot在高台上移动时方向向量不向下倾斜
    if (gameMode === 'zombie' && navHeight[gx] && navHeight[gx][gz] !== undefined) {
        y = navHeight[gx][gz];
    }
    return new THREE.Vector3(
        -NAV_MAP_EXTENT + gx * NAV_GRID_SIZE + NAV_GRID_SIZE/2,
        y,
        -NAV_MAP_EXTENT + gz * NAV_GRID_SIZE + NAV_GRID_SIZE/2
    );
}

// 生化模式: 相邻格之间的攀爬过渡是否可行
function navClimbOK(ax, az, bx, bz) {
    if (navZombieBlocked[ax][az] || navZombieBlocked[bx][bz]) return false;
    return Math.abs(navHeight[ax][az] - navHeight[bx][bz]) <= NAV_CLIMB_HEIGHT;
}

const TOTAL_NAV_CELLS = NAV_CELL_COUNT * NAV_CELL_COUNT;
const SQRT2 = 1.4142135623730951;
const SQRT2_MINUS_1 = SQRT2 - 1.0;

function octileDistance(dx, dz) {
    return (dx > dz) ? (dx + SQRT2_MINUS_1 * dz) : (dz + SQRT2_MINUS_1 * dx);
}

// 1D TypedArray pools for Zero-GC A* pathfinding
const navGScore = new Float32Array(TOTAL_NAV_CELLS);
const navFScore = new Float32Array(TOTAL_NAV_CELLS);
const navCameFrom = new Int32Array(TOTAL_NAV_CELLS);
const navSearchStamp = new Uint32Array(TOTAL_NAV_CELLS);
const navClosedStamp = new Uint32Array(TOTAL_NAV_CELLS);
const navHeap = new Int32Array(TOTAL_NAV_CELLS);
const navHeapPos = new Int32Array(TOTAL_NAV_CELLS).fill(-1);
let navHeapSize = 0;
let navSearchId = 0;

function navHeapPush(idx) {
    let i = navHeapSize++;
    while (i > 0) {
        let p = (i - 1) >> 1;
        let pNode = navHeap[p];
        if (navFScore[idx] < navFScore[pNode]) {
            navHeap[i] = pNode;
            navHeapPos[pNode] = i;
            i = p;
        } else {
            break;
        }
    }
    navHeap[i] = idx;
    navHeapPos[idx] = i;
}

function navHeapUpdate(idx) {
    let i = navHeapPos[idx];
    if (i < 0) return;
    while (i > 0) {
        let p = (i - 1) >> 1;
        let pNode = navHeap[p];
        if (navFScore[idx] < navFScore[pNode]) {
            navHeap[i] = pNode;
            navHeapPos[pNode] = i;
            i = p;
        } else {
            break;
        }
    }
    navHeap[i] = idx;
    navHeapPos[idx] = i;
}

function navHeapPop() {
    if (navHeapSize === 0) return -1;
    let minNode = navHeap[0];
    navHeapPos[minNode] = -1;
    navHeapSize--;
    if (navHeapSize > 0) {
        let lastNode = navHeap[navHeapSize];
        let i = 0;
        let half = navHeapSize >> 1;
        while (i < half) {
            let left = (i << 1) + 1;
            let right = left + 1;
            let bestChild = (right < navHeapSize && navFScore[navHeap[right]] < navFScore[navHeap[left]]) ? right : left;
            if (navFScore[navHeap[bestChild]] < navFScore[lastNode]) {
                let bestNode = navHeap[bestChild];
                navHeap[i] = bestNode;
                navHeapPos[bestNode] = i;
                i = bestChild;
            } else {
                break;
            }
        }
        navHeap[i] = lastNode;
        navHeapPos[lastNode] = i;
    }
    return minNode;
}

function findPath(startVec, endVec) {
    if (!startVec || !endVec) return [];
    const start = getGridPos(startVec);
    const end = getGridPos(endVec);
    
    const startIdx = start.x * NAV_CELL_COUNT + start.z;
    const endIdx = end.x * NAV_CELL_COUNT + end.z;
    
    if (startIdx === endIdx) {
        return [endVec.clone()];
    }
    
    // 生化模式启用爬梯寻路（射击场不建网格, 回退旧逻辑）
    const climbNav = (gameMode === 'zombie' && navZombieBlocked.length > 0);
    
    navSearchId++;
    if (navSearchId >= 0xFFFFFFFE) {
        navSearchStamp.fill(0);
        navClosedStamp.fill(0);
        navHeapPos.fill(-1);
        navSearchId = 1;
    }
    
    navHeapSize = 0;
    
    navGScore[startIdx] = 0;
    const hStart = octileDistance(Math.abs(start.x - end.x), Math.abs(start.z - end.z));
    navFScore[startIdx] = hStart;
    navSearchStamp[startIdx] = navSearchId;
    navCameFrom[startIdx] = -1;
    
    navHeapPush(startIdx);
    
    let iters = 0;
    while (navHeapSize > 0 && iters < 3000) {
        iters++;
        const currentIdx = navHeapPop();
        if (currentIdx === -1) break;
        
        if (currentIdx === endIdx) {
            let path = [];
            let curr = currentIdx;
            while (curr !== -1 && curr !== startIdx) {
                let cx = (curr / NAV_CELL_COUNT) | 0;
                let cz = curr % NAV_CELL_COUNT;
                path.push(getWorldPos(cx, cz));
                curr = navCameFrom[curr];
            }
            path.reverse();
            path.push(endVec.clone());
            return path;
        }
        
        navClosedStamp[currentIdx] = navSearchId;
        
        const curX = (currentIdx / NAV_CELL_COUNT) | 0;
        const curZ = currentIdx % NAV_CELL_COUNT;
        const currentG = navGScore[currentIdx];
        
        // 8 directions: 4 orthogonal, 4 diagonal
        for (let d = 0; d < 8; d++) {
            let nx, nz, stepCost;
            switch (d) {
                case 0: nx = curX + 1; nz = curZ; stepCost = 1.0; break;
                case 1: nx = curX - 1; nz = curZ; stepCost = 1.0; break;
                case 2: nx = curX; nz = curZ + 1; stepCost = 1.0; break;
                case 3: nx = curX; nz = curZ - 1; stepCost = 1.0; break;
                case 4: nx = curX + 1; nz = curZ + 1; stepCost = SQRT2; break;
                case 5: nx = curX - 1; nz = curZ - 1; stepCost = SQRT2; break;
                case 6: nx = curX + 1; nz = curZ - 1; stepCost = SQRT2; break;
                case 7: nx = curX - 1; nz = curZ + 1; stepCost = SQRT2; break;
            }
            
            if (nx < 0 || nx >= NAV_CELL_COUNT || nz < 0 || nz >= NAV_CELL_COUNT) continue;
            
            const neighborIdx = nx * NAV_CELL_COUNT + nz;
            if (navClosedStamp[neighborIdx] === navSearchId) continue;
            
            if (climbNav) {
                if (!navClimbOK(curX, curZ, nx, nz)) continue;
                if (nx !== curX && nz !== curZ) {
                    // 禁止穿角: 两个正交邻格也要能爬过去
                    if (!navClimbOK(curX, curZ, curX, nz) || !navClimbOK(curX, curZ, nx, curZ)) continue;
                }
            } else {
                if (!navGrid[nx] || !navGrid[nx][nz]) continue;
                if (nx !== curX && nz !== curZ) {
                    if (!navGrid[curX] || !navGrid[curX][nz] || !navGrid[nx] || !navGrid[nx][curZ]) continue;
                }
            }
            
            const tentativeG = currentG + stepCost;
            const isDiscovered = (navSearchStamp[neighborIdx] === navSearchId);
            
            if (!isDiscovered || tentativeG < navGScore[neighborIdx]) {
                navCameFrom[neighborIdx] = currentIdx;
                navGScore[neighborIdx] = tentativeG;
                const h = octileDistance(Math.abs(nx - end.x), Math.abs(nz - end.z));
                navFScore[neighborIdx] = tentativeG + h;
                navSearchStamp[neighborIdx] = navSearchId;
                
                if (!isDiscovered) {
                    navHeapPush(neighborIdx);
                } else {
                    navHeapUpdate(neighborIdx);
                }
            }
        }
    }
    
    return [endVec.clone()];
}

function findFlankPath(startVec, endVec) {
    if (!startVec || !endVec) return [];
    const directDist = startVec.distanceTo(endVec);
    if (directDist < 60) return findPath(startVec, endVec);
    
    let midVec = null;
    let attempts = 0;
    while(attempts < 50) {
        let rx = Math.floor(Math.random() * NAV_CELL_COUNT);
        let rz = Math.floor(Math.random() * NAV_CELL_COUNT);
        if (navGrid[rx] && navGrid[rx][rz]) {
            let testVec = getWorldPos(rx, rz);
            let distToStart = startVec.distanceTo(testVec);
            let distToEnd = testVec.distanceTo(endVec);
            let totalDist = distToStart + distToEnd;
            if (totalDist > directDist * 1.1 && totalDist < directDist * 1.6 && distToStart > 30 && distToEnd > 30) {
                midVec = testVec;
                break;
            }
        }
        attempts++;
    }
    
    if (!midVec) {
        return findPath(startVec, endVec);
    }
    
    let path1 = findPath(startVec, midVec);
    let path2 = findPath(midVec, endVec);
    
    if (path1.length > 0 && path2.length > 0) {
        if (path1[path1.length - 1].distanceTo(path2[0]) < 2) {
            path1.pop();
        }
        return path1.concat(path2);
    }
    return findPath(startVec, endVec);
}

if (typeof window !== 'undefined') {
    window.octileDistance = octileDistance;
    window.findPath = findPath;
    window.findFlankPath = findFlankPath;
    window.getNavMeshStats = () => ({
        heapCapacity: TOTAL_NAV_CELLS,
        lastSearchId: navSearchId
    });
}

// #endregion
