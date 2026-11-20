/**
 * Tactical Firearms Components (P90, MK4 Vector, DMR Marksman, M249 SAW, ASH-12)
 * 
 * Provides high-fidelity procedural 3D models for all primary firearms:
 * - P90 (SMG):
 *   - Iconic bullpup unibody composite frame with dual thumbhole grip and forward hand-stop
 *   - Top-mounted horizontal translucent magazine (`magazine`) with visible brass cartridges
 *   - Triple-rail optics bridge with ambidextrous cocking handles and slotted compensator
 * 
 * - MK4 Vector (SMG):
 *   - Super V articulated recoil mitigation housing with steep forward-angled magwell
 *   - Extended stick magazine (`magazine`) angled back into grip
 *   - Skeletonized folding stock, vertical foregrip, and threaded muzzle shroud
 * 
 * - Marksman DMR:
 *   - Long precision match-grade fluted barrel (0.7m) with dual-chamber muzzle brake
 *   - M-LOK slotted free-float aluminum handguard with top Picatinny rail
 *   - Precision sniper stock with adjustable cheek riser and rubber recoil pad
 *   - Curved 20-round steel box magazine (`magazine`) and folded metal bipod
 * 
 * - M249 SAW (Machine Gun):
 *   - Stamped steel receiver with top feed tray cover and latch
 *   - Perforated cylindrical heat shield over heavy barrel, folding carrying handle
 *   - 100-round green polymer ammunition drum (`magazine`) with linked brass belt
 *   - Tubular folding metal stock and folded heavy steel bipod
 * 
 * - ASH-12 (Heavy Assault Rifle):
 *   - Massive 12.7x55mm bullpup monolithic receiver with polymer lower and steel upper
 *   - Full-length top Picatinny rail, side rails, and heavy two-chamber muzzle brake
 *   - Straight 20-round box magazine (`magazine`) behind pistol grip
 * 
 * Contract: All models maintain a named child mesh `magazine` for reload animations.
 */

(function(root) {
    'use strict';

    /**
     * Helper to obtain standard materials
     */
    function getMaterials() {
        const gunmetal = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial)
            ? WeaponBase.getGunmetalMaterial({ color: 0x222326 })
            : new THREE.MeshStandardMaterial({ color: 0x222326, metalness: 0.85, roughness: 0.3 });

        const polymer = (typeof WeaponBase !== 'undefined' && WeaponBase.getPolymerMaterial)
            ? WeaponBase.getPolymerMaterial(0x1a1a1c)
            : new THREE.MeshStandardMaterial({ color: 0x1a1a1c, metalness: 0.15, roughness: 0.82 });

        const darkMetal = new THREE.MeshStandardMaterial({ color: 0x141416, metalness: 0.9, roughness: 0.25 });
        const brassMat = new THREE.MeshStandardMaterial({ color: 0xc89b3c, metalness: 0.85, roughness: 0.2 });

        return { gunmetal, polymer, darkMetal, brassMat };
    }

    /**
     * 1. FN P90 5.7x28mm Submachine Gun
     */
    function createP90ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.50, color: 0x444444 };
        const mats = getMaterials();

        const p90Group = new THREE.Group();
        p90Group.name = 'smg';

        // Main Bullpup Frame
        const bodyGeo = new THREE.BoxGeometry(0.08, 0.16, 0.44);
        const body = new THREE.Mesh(bodyGeo, mats.polymer);
        body.position.set(0, 0.01, 0.02);
        p90Group.add(body);

        // Rear Buttstock
        const stockGeo = new THREE.BoxGeometry(0.075, 0.15, 0.14);
        const stock = new THREE.Mesh(stockGeo, mats.polymer);
        stock.position.set(0, 0.01, 0.25);
        p90Group.add(stock);

        const buttpadGeo = new THREE.BoxGeometry(0.078, 0.155, 0.02);
        const buttpad = new THREE.Mesh(buttpadGeo, mats.darkMetal);
        buttpad.position.set(0, 0, 0.075);
        stock.add(buttpad);

        // Dual Thumbhole Grips (Rear trigger grip + Front support grip)
        const rearGripGeo = new THREE.BoxGeometry(0.052, 0.14, 0.07);
        const rearGrip = new THREE.Mesh(rearGripGeo, mats.polymer);
        rearGrip.position.set(0, -0.09, 0.06);
        rearGrip.rotation.x = -0.32;
        p90Group.add(rearGrip);

        const frontGripGeo = new THREE.BoxGeometry(0.052, 0.13, 0.065);
        const frontGrip = new THREE.Mesh(frontGripGeo, mats.polymer);
        frontGrip.position.set(0, -0.085, -0.10);
        frontGrip.rotation.x = 0.28;
        p90Group.add(frontGrip);

        // Lower connecting bridge between grips
        const bridgeGeo = new THREE.BoxGeometry(0.048, 0.024, 0.14);
        const bridge = new THREE.Mesh(bridgeGeo, mats.polymer);
        bridge.position.set(0, -0.145, -0.02);
        p90Group.add(bridge);

        // Trigger in rear thumbhole
        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.025, 0.012), mats.darkMetal);
        trigger.position.set(0, -0.04, 0.02);
        p90Group.add(trigger);

        // Barrel & Slotted Flash Compensator
        const barrelGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.12, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.gunmetal);
        barrel.position.set(0, 0.045, -0.25);
        p90Group.add(barrel);

        const compGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.045, 12);
        compGeo.rotateX(Math.PI / 2);
        const comp = new THREE.Mesh(compGeo, mats.darkMetal);
        comp.position.set(0, 0, -0.06);
        barrel.add(comp);

        // Top Aluminum Receiver Bridge (Optics Rail)
        const topBridgeGeo = new THREE.BoxGeometry(0.055, 0.045, 0.26);
        const topBridge = new THREE.Mesh(topBridgeGeo, mats.gunmetal);
        topBridge.position.set(0, 0.095, -0.08);
        p90Group.add(topBridge);

        // Top Picatinny Rail
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyTopRail) {
            const topRail = WeaponBase.createPicatinnyTopRail(0.24);
            topRail.position.set(0, 0.023, 0);
            topBridge.add(topRail);
        }

        // Top-Mounted Translucent Magazine (Invariant: Named `magazine`)
        // P90 magazine lies flat on top of the receiver!
        const magGroup = new THREE.Group();
        magGroup.name = 'magazine';
        magGroup.position.set(0, 0.092, 0.11);

        const magShellGeo = new THREE.BoxGeometry(0.068, 0.032, 0.27);
        const magShellMat = new THREE.MeshStandardMaterial({
            color: 0x3d3528,
            transparent: true,
            opacity: 0.65,
            roughness: 0.35,
            metalness: 0.15
        });
        const magShell = new THREE.Mesh(magShellGeo, magShellMat);
        magGroup.add(magShell);

        // Visible 5.7x28mm Brass Cartridges inside the magazine
        const bulletGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.048, 8);
        bulletGeo.rotateZ(Math.PI / 2); // Transverse spiral feed
        for (let i = 0; i < 7; i++) {
            const cartridge = new THREE.Mesh(bulletGeo, mats.brassMat);
            cartridge.position.set(0, 0, -0.10 + i * 0.032);
            magGroup.add(cartridge);
        }

        // Attach geometry & material reference on magGroup to support mesh-like property checks
        magGroup.geometry = magShellGeo;
        magGroup.material = magShellMat;

        p90Group.add(magGroup);

        return p90Group;
    }

    /**
     * 2. MK4 / Kriss Vector Submachine Gun
     */
    function createMK4ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.55, color: 0x3a4a5a };
        const mats = getMaterials();

        const mk4Group = new THREE.Group();
        mk4Group.name = 'mk4';

        // Super V Angled Recoil Mitigation Housing
        const lowerGeo = new THREE.BoxGeometry(0.075, 0.17, 0.22);
        const lower = new THREE.Mesh(lowerGeo, mats.polymer);
        lower.position.set(0, -0.02, -0.04);
        mk4Group.add(lower);

        // Upper Receiver (Aluminum with continuous top rail)
        const upperGeo = new THREE.BoxGeometry(0.068, 0.075, 0.36);
        const upper = new THREE.Mesh(upperGeo, mats.gunmetal);
        upper.position.set(0, 0.065, 0.02);
        mk4Group.add(upper);

        // Continuous Top Picatinny Rail
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyTopRail) {
            const topRail = WeaponBase.createPicatinnyTopRail(0.35);
            topRail.position.set(0, 0.04, 0);
            upper.add(topRail);
        }

        // Barrel & Threaded Shroud
        const barrelGeo = new THREE.CylinderGeometry(0.015, 0.015, 0.18, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.gunmetal);
        barrel.position.set(0, 0.035, -0.24);
        mk4Group.add(barrel);

        const shroudGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.08, 12);
        shroudGeo.rotateX(Math.PI / 2);
        const shroud = new THREE.Mesh(shroudGeo, mats.darkMetal);
        shroud.position.set(0, 0, -0.05);
        barrel.add(shroud);

        // Vertical Stubby Foregrip on lower rail
        const vfgGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.09, 12);
        const vfg = new THREE.Mesh(vfgGeo, mats.polymer);
        vfg.position.set(0, -0.10, -0.11);
        mk4Group.add(vfg);

        // Ergonomic Pistol Grip
        const gripGeo = new THREE.BoxGeometry(0.045, 0.14, 0.065);
        const grip = new THREE.Mesh(gripGeo, mats.polymer);
        grip.position.set(0, -0.09, 0.11);
        grip.rotation.x = -0.32;
        mk4Group.add(grip);

        // Skeletonized Folding Stock
        const stockGeo = new THREE.BoxGeometry(0.045, 0.11, 0.22);
        const stock = new THREE.Mesh(stockGeo, mats.polymer);
        stock.position.set(0, 0.03, 0.28);
        mk4Group.add(stock);

        // Extended 30-round Glock Stick Magazine (Invariant: Named `magazine`)
        const magGeo = new THREE.BoxGeometry(0.035, 0.22, 0.052);
        const magMesh = new THREE.Mesh(magGeo, mats.polymer);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.15, -0.02);
        magMesh.rotation.x = 0.15; // Angled backward into Super V well
        mk4Group.add(magMesh);

        return mk4Group;
    }

    /**
     * 3. Mk14 EBR / DMR 7.62mm Designated Marksman Rifle
     */
    function createMarksmanViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 1.1, color: 0x2e4a23 };
        const mats = getMaterials();

        const dmrGroup = new THREE.Group();
        dmrGroup.name = 'marksman';

        // CNC Billet Aluminum Receiver Chassis
        const receiverGeo = new THREE.BoxGeometry(0.08, 0.095, 0.44);
        const receiver = new THREE.Mesh(receiverGeo, mats.gunmetal);
        receiver.position.set(0, 0.01, 0.05);
        dmrGroup.add(receiver);

        // Extended Top Picatinny Rail
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyTopRail) {
            const topRail = WeaponBase.createPicatinnyTopRail(0.48);
            topRail.position.set(0, 0.05, -0.06);
            receiver.add(topRail);
        }

        // Long Precision Match-Grade Fluted Barrel (0.55m)
        const barrelGeo = new THREE.CylinderGeometry(0.016, 0.018, 0.58, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.darkMetal);
        barrel.position.set(0, 0.02, -0.46);
        dmrGroup.add(barrel);

        // Heavy Dual-Chamber Muzzle Brake
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createMuzzleDevice) {
            const brake = WeaponBase.createMuzzleDevice('dualBaffle');
            brake.position.set(0, 0, -0.30);
            barrel.add(brake);
        }

        // Free-Float Aluminum Handguard with M-LOK side slots
        const handguardGeo = new THREE.BoxGeometry(0.07, 0.075, 0.36);
        const handguard = new THREE.Mesh(handguardGeo, mats.gunmetal);
        handguard.position.set(0, 0.02, -0.28);
        dmrGroup.add(handguard);

        // Folded Tactical Bipod under handguard
        const bipodBase = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 0.04), mats.darkMetal);
        bipodBase.position.set(0, -0.045, -0.38);
        dmrGroup.add(bipodBase);

        const bipodLegGeo = new THREE.CylinderGeometry(0.006, 0.007, 0.18, 8);
        bipodLegGeo.rotateX(Math.PI / 2);
        const legLeft = new THREE.Mesh(bipodLegGeo, mats.darkMetal);
        legLeft.position.set(-0.022, -0.015, 0.09);
        bipodBase.add(legLeft);
        const legRight = new THREE.Mesh(bipodLegGeo, mats.darkMetal);
        legRight.position.set(0.022, -0.015, 0.09);
        bipodBase.add(legRight);

        // Precision Sniper Stock with Adjustable Cheek Rest
        const stockGeo = new THREE.BoxGeometry(0.065, 0.14, 0.32);
        const stock = new THREE.Mesh(stockGeo, mats.polymer);
        stock.position.set(0, -0.02, 0.40);
        dmrGroup.add(stock);

        const cheekRiser = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.03, 0.14), mats.polymer);
        cheekRiser.position.set(0, 0.08, -0.02);
        stock.add(cheekRiser);

        const buttpad = new THREE.Mesh(new THREE.BoxGeometry(0.068, 0.145, 0.02), mats.darkMetal);
        buttpad.position.set(0, 0, 0.16);
        stock.add(buttpad);

        // Ergonomic Sniper Grip with Palm Rest
        const gripGeo = new THREE.BoxGeometry(0.048, 0.15, 0.065);
        const grip = new THREE.Mesh(gripGeo, mats.polymer);
        grip.position.set(0, -0.10, 0.18);
        grip.rotation.x = -0.35;
        dmrGroup.add(grip);

        const palmRest = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.018, 0.08), mats.darkMetal);
        palmRest.position.set(0, -0.08, 0);
        grip.add(palmRest);

        // Curved 20-Round 7.62 NATO Steel Box Magazine (Invariant: Named `magazine`)
        const magGeo = new THREE.BoxGeometry(0.045, 0.19, 0.085);
        const magMesh = new THREE.Mesh(magGeo, mats.darkMetal);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.12, 0.02);
        magMesh.rotation.x = 0.12;
        dmrGroup.add(magMesh);

        return dmrGroup;
    }

    /**
     * 4. M249 SAW 5.56mm Light Machine Gun
     */
    function createM249ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 1.0, color: 0x113311 };
        const mats = getMaterials();

        const m249Group = new THREE.Group();
        m249Group.name = 'm249';

        // Heavy Stamped Steel Receiver with Top Feed Cover
        const receiverGeo = new THREE.BoxGeometry(0.11, 0.12, 0.46);
        const receiver = new THREE.Mesh(receiverGeo, mats.gunmetal);
        receiver.position.set(0, 0.02, 0.04);
        m249Group.add(receiver);

        // Top Feed Tray Cover with latch
        const feedCoverGeo = new THREE.BoxGeometry(0.105, 0.035, 0.28);
        const feedCover = new THREE.Mesh(feedCoverGeo, mats.darkMetal);
        feedCover.position.set(0, 0.065, -0.02);
        receiver.add(feedCover);

        // Heavy Finned Barrel & Perforated Heat Shield
        const barrelGeo = new THREE.CylinderGeometry(0.020, 0.022, 0.52, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.darkMetal);
        barrel.position.set(0, 0.025, -0.42);
        m249Group.add(barrel);

        const heatShieldGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.28, 16, 1, true, 0, Math.PI);
        heatShieldGeo.rotateX(Math.PI / 2);
        heatShieldGeo.rotateZ(Math.PI);
        const heatShield = new THREE.Mesh(heatShieldGeo, mats.darkMetal);
        heatShield.position.set(0, 0.045, -0.32);
        m249Group.add(heatShield);

        // Folding Carrying Handle on barrel right
        const handleStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), mats.darkMetal);
        handleStem.position.set(0.065, 0.06, -0.22);
        handleStem.rotation.z = -0.6;
        m249Group.add(handleStem);

        const handleGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.10, 8), mats.polymer);
        handleGrip.rotateX(Math.PI / 2);
        handleGrip.position.set(0.035, 0.035, 0);
        handleStem.add(handleGrip);

        // Tubular Folding Metal Stock
        const stockTubeGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.32, 8);
        stockTubeGeo.rotateX(Math.PI / 2);
        const stockTube = new THREE.Mesh(stockTubeGeo, mats.gunmetal);
        stockTube.position.set(0, -0.01, 0.40);
        m249Group.add(stockTube);

        const buttplateGeo = new THREE.BoxGeometry(0.075, 0.16, 0.025);
        const buttplate = new THREE.Mesh(buttplateGeo, mats.darkMetal);
        buttplate.position.set(0, 0, 0.16);
        stockTube.add(buttplate);

        // Heavy Pistol Grip
        const gripGeo = new THREE.BoxGeometry(0.05, 0.15, 0.07);
        const grip = new THREE.Mesh(gripGeo, mats.polymer);
        grip.position.set(0, -0.11, 0.16);
        grip.rotation.x = -0.32;
        m249Group.add(grip);

        // 100-Round Olive Green Box/Drum Magazine (Invariant: Named `magazine`)
        const magGeo = new THREE.BoxGeometry(0.12, 0.15, 0.16);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x3b4432, roughness: 0.82, metalness: 0.15 }); // OD Green
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.13, -0.01);
        m249Group.add(magMesh);

        // Brass Ammunition Belt Segment entering the feed tray
        const beltGeo = new THREE.BoxGeometry(0.045, 0.025, 0.06);
        const belt = new THREE.Mesh(beltGeo, mats.brassMat);
        belt.position.set(-0.065, 0.08, 0);
        magMesh.add(belt);

        return m249Group;
    }

    /**
     * 5. ASh-12.7 Heavy Bullpup Assault Rifle
     */
    function createASH12ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.85, color: 0x1a1a2e };
        const mats = getMaterials();

        const ashGroup = new THREE.Group();
        ashGroup.name = 'ash12';

        // Massive Monolithic Bullpup Body
        const mainBodyGeo = new THREE.BoxGeometry(0.09, 0.15, 0.52);
        const mainBody = new THREE.Mesh(mainBodyGeo, mats.polymer);
        mainBody.position.set(0, 0.02, 0.04);
        ashGroup.add(mainBody);

        // Steel Upper Receiver Housing
        const upperGeo = new THREE.BoxGeometry(0.085, 0.065, 0.48);
        const upper = new THREE.Mesh(upperGeo, mats.gunmetal);
        upper.position.set(0, 0.095, 0.01);
        ashGroup.add(upper);

        // Full-length Top Tactical Rail
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyTopRail) {
            const topRail = WeaponBase.createPicatinnyTopRail(0.46);
            topRail.position.set(0, 0.038, 0);
            upper.add(topRail);
        }

        // Heavy Barrel with Massive Two-Chamber Muzzle Brake
        const barrelGeo = new THREE.CylinderGeometry(0.022, 0.022, 0.24, 16);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.darkMetal);
        barrel.position.set(0, 0.05, -0.32);
        ashGroup.add(barrel);

        const brakeGeo = new THREE.BoxGeometry(0.058, 0.048, 0.11);
        const brake = new THREE.Mesh(brakeGeo, mats.darkMetal);
        brake.position.set(0, 0, -0.12);
        barrel.add(brake);

        // Recoil Vents in muzzle brake
        const ventMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0c });
        const vent1 = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.022, 0.03), ventMat);
        vent1.position.z = -0.02;
        brake.add(vent1);
        const vent2 = new THREE.Mesh(new THREE.BoxGeometry(0.060, 0.022, 0.03), ventMat);
        vent2.position.z = 0.025;
        brake.add(vent2);

        // Pistol Grip (Bullpup: Positioned forward)
        const gripGeo = new THREE.BoxGeometry(0.048, 0.15, 0.07);
        const grip = new THREE.Mesh(gripGeo, mats.polymer);
        grip.position.set(0, -0.10, -0.06);
        grip.rotation.x = -0.30;
        ashGroup.add(grip);

        // Forward Handguard / Lower Picatinny rail
        const forendGeo = new THREE.BoxGeometry(0.075, 0.065, 0.16);
        const forend = new THREE.Mesh(forendGeo, mats.polymer);
        forend.position.set(0, -0.03, -0.18);
        ashGroup.add(forend);

        // Buttpad at the very rear
        const buttpadGeo = new THREE.BoxGeometry(0.092, 0.155, 0.03);
        const buttpad = new THREE.Mesh(buttpadGeo, mats.darkMetal);
        buttpad.position.set(0, 0.02, 0.31);
        ashGroup.add(buttpad);

        // Heavy Straight 12.7x55mm 20-Round Box Magazine (Behind grip in bullpup slot!)
        const magGeo = new THREE.BoxGeometry(0.055, 0.18, 0.095);
        const magMesh = new THREE.Mesh(magGeo, mats.darkMetal);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.11, 0.18);
        ashGroup.add(magMesh);

        return ashGroup;
    }

    /**
     * 6. AN-94 5.45x39mm Russian Assault Rifle
     * Features:
     * - Stamped steel receiver housing and dark Russian polymer lower chassis
     * - Iconic figure-8 double-chamber muzzle brake (two cylindrical ports stacked vertically)
     * - Reciprocating barrel assembly with under-barrel guide rail
     * - Canted magazine well & 30-round plum/bakelite magazine tilted ~12° to starboard
     * - Ribbed ergonomic polymer handguard with heat vents
     * - Skeletonized folding polymer stock with rubber buttpad
     * - Star-wheel rotary aperture rear sight and hooded front post
     */
    function createAN94ViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.85, color: 0x2b3038 };
        const mats = getMaterials();

        const an94Group = new THREE.Group();
        an94Group.name = 'an94';

        // 1. Stamped Steel Upper Receiver
        const receiverGeo = new THREE.BoxGeometry(0.065, 0.082, 0.44);
        const receiver = new THREE.Mesh(receiverGeo, mats.gunmetal);
        receiver.position.set(0, 0.038, 0.02);
        an94Group.add(receiver);

        // 2. Polymer Lower Receiver / Chassis (Dark Russian Plum/Polymer)
        const chassisMat = new THREE.MeshStandardMaterial({
            color: 0x1c1e22,
            metalness: 0.25,
            roughness: 0.75
        });
        const chassisGeo = new THREE.BoxGeometry(0.062, 0.065, 0.40);
        const chassis = new THREE.Mesh(chassisGeo, chassisMat);
        chassis.position.set(0, -0.028, 0.02);
        an94Group.add(chassis);

        // 3. Top Optics Rail (Picatinny/Dovetail)
        if (typeof WeaponBase !== 'undefined' && WeaponBase.createPicatinnyTopRail) {
            const topRail = WeaponBase.createPicatinnyTopRail(0.28);
            topRail.position.set(0, 0.048, -0.02);
            receiver.add(topRail);
        }

        // 4. Reciprocating Barrel Assembly & Guide Rod
        const barrelGeo = new THREE.CylinderGeometry(0.012, 0.012, 0.38, 14);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, mats.darkMetal);
        barrel.position.set(0, 0.045, -0.32);
        an94Group.add(barrel);

        const guideGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.26, 12);
        guideGeo.rotateX(Math.PI / 2);
        const guide = new THREE.Mesh(guideGeo, mats.gunmetal);
        guide.position.set(0, 0.015, -0.27);
        an94Group.add(guide);

        // 5. Legendary Figure-8 Muzzle Compensator
        const brakeUpperGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.075, 14);
        brakeUpperGeo.rotateX(Math.PI / 2);
        const brakeUpper = new THREE.Mesh(brakeUpperGeo, mats.darkMetal);
        brakeUpper.position.set(0, 0.045, -0.52);
        an94Group.add(brakeUpper);

        const brakeLowerGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.075, 14);
        brakeLowerGeo.rotateX(Math.PI / 2);
        const brakeLower = new THREE.Mesh(brakeLowerGeo, mats.darkMetal);
        brakeLower.position.set(0, 0.018, -0.52);
        an94Group.add(brakeLower);

        const brakeBridgeGeo = new THREE.BoxGeometry(0.028, 0.035, 0.07);
        const brakeBridge = new THREE.Mesh(brakeBridgeGeo, mats.darkMetal);
        brakeBridge.position.set(0, 0.0315, -0.52);
        an94Group.add(brakeBridge);

        // 6. Ribbed Polymer Handguard with Heat Vents
        const handguardGeo = new THREE.BoxGeometry(0.068, 0.070, 0.22);
        const handguard = new THREE.Mesh(handguardGeo, chassisMat);
        handguard.position.set(0, 0.022, -0.18);
        an94Group.add(handguard);

        const ribMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 });
        for (let r = 0; r < 4; r++) {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.012, 0.018), ribMat);
            rib.position.set(0, 0.015, -0.25 + r * 0.045);
            an94Group.add(rib);
        }

        // 7. Ergonomic Russian Pistol Grip & Trigger
        const gripGeo = new THREE.BoxGeometry(0.042, 0.14, 0.065);
        const grip = new THREE.Mesh(gripGeo, chassisMat);
        grip.position.set(0, -0.11, 0.08);
        grip.rotation.x = -0.32;
        an94Group.add(grip);

        const guardGeo = new THREE.BoxGeometry(0.02, 0.045, 0.08);
        const guard = new THREE.Mesh(guardGeo, mats.gunmetal);
        guard.position.set(0, -0.068, 0.03);
        an94Group.add(guard);

        const triggerGeo = new THREE.BoxGeometry(0.008, 0.03, 0.015);
        const trigger = new THREE.Mesh(triggerGeo, mats.darkMetal);
        trigger.position.set(0, -0.065, 0.04);
        trigger.rotation.x = 0.25;
        an94Group.add(trigger);

        // 8. Canted 30-Round Magazine (Invariant: Named `magazine`)
        // The AN-94 magazine is canted ~12° to the right (starboard)
        const magPlumMat = new THREE.MeshStandardMaterial({
            color: 0x2e1e1e, // Russian plum polymer
            roughness: 0.55,
            metalness: 0.2
        });
        const magGeo = new THREE.BoxGeometry(0.042, 0.21, 0.078);
        const magMesh = new THREE.Mesh(magGeo, magPlumMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0.016, -0.125, -0.05);
        magMesh.rotation.z = -0.18; // ~10.3 degrees canted to the right!
        magMesh.rotation.x = 0.15;  // Slight forward sweep
        an94Group.add(magMesh);

        // 9. Side-Folding Skeleton Stock
        const stockStrutGeo = new THREE.BoxGeometry(0.035, 0.042, 0.26);
        const stockStrut = new THREE.Mesh(stockStrutGeo, chassisMat);
        stockStrut.position.set(0, 0.012, 0.32);
        an94Group.add(stockStrut);

        const buttpadGeo = new THREE.BoxGeometry(0.050, 0.13, 0.025);
        const buttpad = new THREE.Mesh(buttpadGeo, mats.darkMetal);
        buttpad.position.set(0, -0.015, 0.44);
        an94Group.add(buttpad);

        // 10. Star-wheel Aperture Rear Sight & Hooded Front Sight
        const rearSightGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.018, 10);
        rearSightGeo.rotateZ(Math.PI / 2);
        const rearSight = new THREE.Mesh(rearSightGeo, mats.darkMetal);
        rearSight.position.set(0, 0.092, 0.12);
        an94Group.add(rearSight);

        const frontSightGeo = new THREE.BoxGeometry(0.012, 0.042, 0.015);
        const frontSight = new THREE.Mesh(frontSightGeo, mats.darkMetal);
        frontSight.position.set(0, 0.078, -0.46);
        an94Group.add(frontSight);

        return an94Group;
    }

    const TacticalFirearmsComponents = {
        createP90ViewModel,
        createMK4ViewModel,
        createMarksmanViewModel,
        createM249ViewModel,
        createASH12ViewModel,
        createAN94ViewModel
    };

    root.TacticalFirearmsComponents = TacticalFirearmsComponents;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalFirearmsComponents;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
