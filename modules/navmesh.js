// #region 导航网格与寻路
const NAV_GRID_SIZE = 10;
const NAV_MAP_EXTENT = 400; 
const NAV_CELL_COUNT = (NAV_MAP_EXTENT * 2) / NAV_GRID_SIZE; 
let navGrid = []; // [x][z]

function buildNavGrid() {
    navGrid = [];
    for (let x = 0; x < NAV_CELL_COUNT; x++) {
        navGrid[x] = [];
        for (let z = 0; z < NAV_CELL_COUNT; z++) {
            const cellMin = new THREE.Vector3(-NAV_MAP_EXTENT + x * NAV_GRID_SIZE, 0, -NAV_MAP_EXTENT + z * NAV_GRID_SIZE);
            const cellMax = new THREE.Vector3(-NAV_MAP_EXTENT + (x + 1) * NAV_GRID_SIZE, 10, -NAV_MAP_EXTENT + (z + 1) * NAV_GRID_SIZE);
            const cellBox = new THREE.Box3(cellMin, cellMax);
            
            let walkable = true;
            for (let mesh of collidableMeshList) {
                if (mesh.worldBox && cellBox.intersectsBox(mesh.worldBox.clone().expandByScalar(5.0))) {
                    walkable = false;
                    break;
                }
            }
            navGrid[x][z] = walkable;
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
    return new THREE.Vector3(
        -NAV_MAP_EXTENT + gx * NAV_GRID_SIZE + NAV_GRID_SIZE/2,
        0,
        -NAV_MAP_EXTENT + gz * NAV_GRID_SIZE + NAV_GRID_SIZE/2
    );
}

function findPath(startVec, endVec) {
    const start = getGridPos(startVec);
    const end = getGridPos(endVec);
    
    let openSet = [start];
    let cameFrom = new Map();
    let gScore = new Map();
    let fScore = new Map();
    
    const hash = (node) => `${node.x},${node.z}`;
    
    gScore.set(hash(start), 0);
    fScore.set(hash(start), Math.abs(start.x - end.x) + Math.abs(start.z - end.z));
    
    let iters = 0;
    while (openSet.length > 0 && iters < 3000) {
        iters++;
        let currentIdx = 0;
        let minF = Infinity;
        for (let i = 0; i < openSet.length; i++) {
            let f = fScore.get(hash(openSet[i])) || Infinity;
            if (f < minF) {
                minF = f;
                currentIdx = i;
            }
        }
        
        let current = openSet[currentIdx];
        
        if (current.x === end.x && current.z === end.z) {
            let path = [];
            let currHash = hash(current);
            while (cameFrom.has(currHash)) {
                path.unshift(getWorldPos(current.x, current.z));
                current = cameFrom.get(currHash);
                currHash = hash(current);
            }
            if (path.length === 0) path.push(endVec.clone()); 
            path.push(endVec.clone()); 
            return path;
        }
        
        openSet.splice(currentIdx, 1);
        
        const neighbors = [
            {x: current.x+1, z: current.z}, {x: current.x-1, z: current.z},
            {x: current.x, z: current.z+1}, {x: current.x, z: current.z-1},
            {x: current.x+1, z: current.z+1}, {x: current.x-1, z: current.z-1},
            {x: current.x+1, z: current.z-1}, {x: current.x-1, z: current.z+1}
        ];
        
        for (let neighbor of neighbors) {
            if (neighbor.x < 0 || neighbor.x >= NAV_CELL_COUNT || neighbor.z < 0 || neighbor.z >= NAV_CELL_COUNT) continue;
            if (!navGrid[neighbor.x][neighbor.z]) continue;
            
            if (neighbor.x !== current.x && neighbor.z !== current.z) {
                if (!navGrid[current.x][neighbor.z] || !navGrid[neighbor.x][current.z]) continue;
            }
            
            let tentativeGScore = (gScore.get(hash(current)) || Infinity) + ((neighbor.x !== current.x && neighbor.z !== current.z) ? 1.414 : 1);
            
            if (tentativeGScore < (gScore.get(hash(neighbor)) || Infinity)) {
                cameFrom.set(hash(neighbor), current);
                gScore.set(hash(neighbor), tentativeGScore);
                fScore.set(hash(neighbor), tentativeGScore + Math.abs(neighbor.x - end.x) + Math.abs(neighbor.z - end.z));
                if (!openSet.some(n => n.x === neighbor.x && n.z === neighbor.z)) {
                    openSet.push(neighbor);
                }
            }
        }
    }
    
    return [endVec.clone()];
}

function findFlankPath(startVec, endVec) {
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

// #endregion
