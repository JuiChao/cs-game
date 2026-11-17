/**
 * Tactical Pistol Components (Glock 18 & Desert Eagle .50 AE)
 * 
 * Provides high-fidelity procedural 3D viewmodels for secondary handguns:
 * - Glock 18:
 *   - Injection-molded polymer lower frame with ergonomic finger grooves, flared magwell, and trigger guard
 *   - CNC-milled nitrided steel slide with front/rear cocking serrations and ejection port
 *   - Steel barrel with rifled muzzle crown and recoil guide rod
 *   - White-dot 3-dot combat iron sights (front post + rear notch)
 *   - 33-round extended polymer magazine (`magazine`) with basepad
 *   - Under-barrel Picatinny rail for tactical attachments (laser sight)
 * 
 * - Desert Eagle .50 AE:
 *   - Massive stepped polygonal slide in brushed steel with gas-operated barrel assembly
 *   - Integrated full-length top Weaver/Picatinny rail
 *   - Textured black combat wrap-around grips with custom medallion
 *   - External combat hammer, beaver tail, and ambidextrous safety levers
 *   - Huge .50 caliber muzzle bore with counter-bored crown
 *   - 7-round stainless steel box magazine (`magazine`) with rubber bumper pad
 * 
 * Contract: Both models maintain a named child mesh `magazine` for reload animations.
 */

(function(root) {
    'use strict';

    /**
     * Create high-fidelity Glock 18 Pistol ViewModel
     */
    function createGlockViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.40, color: 0x333333 };

        const glockGroup = new THREE.Group();
        glockGroup.name = 'pistol';

        const polymerMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getPolymerMaterial)
            ? WeaponBase.getPolymerMaterial(0x181819)
            : new THREE.MeshStandardMaterial({ color: 0x181819, roughness: 0.82, metalness: 0.12 });

        const slideMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial)
            ? WeaponBase.getGunmetalMaterial({ color: 0x242528 })
            : new THREE.MeshStandardMaterial({ color: 0x242528, roughness: 0.35, metalness: 0.88 });

        const steelMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1c, roughness: 0.25, metalness: 0.92 });
        const darkDetailMat = new THREE.MeshStandardMaterial({ color: 0x111112, roughness: 0.5, metalness: 0.8 });
        const sightDotMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        // 1. Slide (Upper CNC steel receiver)
        const slideLength = 0.26;
        const slideWidth = 0.046;
        const slideHeight = 0.048;
        const slideGeo = new THREE.BoxGeometry(slideWidth, slideHeight, slideLength);
        const slide = new THREE.Mesh(slideGeo, slideMat);
        slide.position.set(0, 0.038, -0.04);
        glockGroup.add(slide);

        // Slide Top Chamfer / Bevel Crown
        const bevelGeo = new THREE.BoxGeometry(slideWidth * 0.92, 0.008, slideLength * 0.98);
        const bevel = new THREE.Mesh(bevelGeo, slideMat);
        bevel.position.set(0, slideHeight * 0.5 + 0.003, 0);
        slide.add(bevel);

        // Rear Cocking Serrations (both sides)
        const serrationMat = new THREE.MeshBasicMaterial({ color: 0x0c0c0e });
        const serrationGeo = new THREE.BoxGeometry(slideWidth + 0.002, slideHeight * 0.65, 0.004);
        for (let i = 0; i < 7; i++) {
            const serr = new THREE.Mesh(serrationGeo, serrationMat);
            serr.position.set(0, 0, slideLength * 0.32 - i * 0.008);
            slide.add(serr);
        }

        // Front Press-Check Serrations
        for (let i = 0; i < 4; i++) {
            const serr = new THREE.Mesh(serrationGeo, serrationMat);
            serr.position.set(0, 0, -slideLength * 0.30 - i * 0.008);
            slide.add(serr);
        }

        // Ejection Port (Right-top cutout)
        const ejectGeo = new THREE.BoxGeometry(slideWidth * 0.52, 0.024, 0.052);
        const ejectMesh = new THREE.Mesh(ejectGeo, darkDetailMat);
        ejectMesh.position.set(slideWidth * 0.26, slideHeight * 0.22, -0.01);
        slide.add(ejectMesh);

        // Extractor claw
        const extractorGeo = new THREE.BoxGeometry(0.004, 0.008, 0.022);
        const extractorMat = new THREE.MeshStandardMaterial({ color: 0x8a6d3b, metalness: 0.8, roughness: 0.3 }); // Brass/heat treated
        const extractor = new THREE.Mesh(extractorGeo, extractorMat);
        extractor.position.set(slideWidth * 0.505, slideHeight * 0.22, -0.015);
        slide.add(extractor);

        // Fire Selector Switch on slide left (Glock 18 Semi/Full Auto switch)
        const selectorGeo = new THREE.CylinderGeometry(0.009, 0.009, 0.006, 12);
        selectorGeo.rotateZ(Math.PI / 2);
        const selector = new THREE.Mesh(selectorGeo, steelMat);
        selector.position.set(-slideWidth * 0.504, 0, slideLength * 0.28);
        slide.add(selector);
        const selectorPin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.012), darkDetailMat);
        selectorPin.position.set(-slideWidth * 0.506, 0.004, slideLength * 0.28);
        slide.add(selectorPin);

        // 2. Barrel & Guide Rod
        const barrelGeo = new THREE.CylinderGeometry(0.014, 0.014, 0.05, 12);
        barrelGeo.rotateX(Math.PI / 2);
        const barrel = new THREE.Mesh(barrelGeo, steelMat);
        barrel.position.set(0, slideHeight * 0.16, -slideLength * 0.52);
        slide.add(barrel);

        // Muzzle Bore (Hollow rifled interior)
        const boreGeo = new THREE.CircleGeometry(0.010, 12);
        const boreMat = new THREE.MeshBasicMaterial({ color: 0x050505, side: THREE.DoubleSide });
        const bore = new THREE.Mesh(boreGeo, boreMat);
        bore.position.set(0, 0, -0.026);
        barrel.add(bore);

        // Guide Rod
        const rodGeo = new THREE.CylinderGeometry(0.006, 0.006, 0.03, 8);
        rodGeo.rotateX(Math.PI / 2);
        const rod = new THREE.Mesh(rodGeo, new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.15 }));
        rod.position.set(0, -slideHeight * 0.28, -slideLength * 0.505);
        slide.add(rod);

        // 3. Sights (White Dot Combat Sights)
        // Front Sight Post
        const frontSightGeo = new THREE.BoxGeometry(0.008, 0.012, 0.016);
        const frontSight = new THREE.Mesh(frontSightGeo, darkDetailMat);
        frontSight.position.set(0, slideHeight * 0.5 + 0.006, -slideLength * 0.44);
        slide.add(frontSight);

        const frontDotGeo = new THREE.CircleGeometry(0.002, 8);
        const frontDot = new THREE.Mesh(frontDotGeo, sightDotMat);
        frontDot.position.set(0, slideHeight * 0.5 + 0.007, -slideLength * 0.44 + 0.0085);
        slide.add(frontDot);

        // Rear Sight U-Notch
        const rearSightGeo = new THREE.BoxGeometry(0.032, 0.014, 0.014);
        const rearSight = new THREE.Mesh(rearSightGeo, darkDetailMat);
        rearSight.position.set(0, slideHeight * 0.5 + 0.007, slideLength * 0.44);
        slide.add(rearSight);

        const rearDot1 = new THREE.Mesh(frontDotGeo, sightDotMat);
        rearDot1.position.set(-0.010, slideHeight * 0.5 + 0.007, slideLength * 0.44 + 0.0075);
        slide.add(rearDot1);

        const rearDot2 = new THREE.Mesh(frontDotGeo, sightDotMat);
        rearDot2.position.set(0.010, slideHeight * 0.5 + 0.007, slideLength * 0.44 + 0.0075);
        slide.add(rearDot2);

        // 4. Polymer Lower Frame & Grip
        const frameLength = 0.23;
        const frameWidth = 0.044;
        const frameHeight = 0.036;
        const frameGeo = new THREE.BoxGeometry(frameWidth, frameHeight, frameLength);
        const frame = new THREE.Mesh(frameGeo, polymerMat);
        frame.position.set(0, 0.002, -0.045);
        glockGroup.add(frame);

        // Under-barrel Tactical Accessory Rail
        const railGeo = new THREE.BoxGeometry(frameWidth * 0.85, 0.010, 0.08);
        const rail = new THREE.Mesh(railGeo, polymerMat);
        rail.position.set(0, -frameHeight * 0.5 - 0.004, -0.045);
        frame.add(rail);

        // Grip (Angled ergonomic grip)
        const gripGeo = new THREE.BoxGeometry(0.042, 0.165, 0.065);
        const grip = new THREE.Mesh(gripGeo, polymerMat);
        grip.position.set(0, -0.085, 0.055);
        grip.rotation.x = -0.26; // Glock 22-degree grip angle
        glockGroup.add(grip);

        // Grip Finger Grooves (Gen 3/4 style)
        const grooveGeo = new THREE.BoxGeometry(0.043, 0.024, 0.014);
        for (let i = 0; i < 3; i++) {
            const groove = new THREE.Mesh(grooveGeo, polymerMat);
            groove.position.set(0, 0.04 - i * 0.038, -0.032);
            grip.add(groove);
        }

        // Textured Grip Panels
        const stippleGeo = new THREE.BoxGeometry(0.044, 0.12, 0.045);
        const stippleMat = new THREE.MeshStandardMaterial({ color: 0x121213, roughness: 0.95 });
        const stipple = new THREE.Mesh(stippleGeo, stippleMat);
        stipple.position.set(0, -0.01, 0.005);
        grip.add(stipple);

        // 5. Trigger Guard & Trigger
        const guardGeo = new THREE.BoxGeometry(0.024, 0.055, 0.075);
        const guard = new THREE.Mesh(guardGeo, polymerMat);
        guard.position.set(0, -0.035, -0.015);
        glockGroup.add(guard);

        // Trigger with Glock safety blade
        const triggerGeo = new THREE.BoxGeometry(0.008, 0.028, 0.016);
        const trigger = new THREE.Mesh(triggerGeo, darkDetailMat);
        trigger.position.set(0, -0.028, -0.010);
        trigger.rotation.x = 0.35;
        glockGroup.add(trigger);

        const safetyBladeGeo = new THREE.BoxGeometry(0.003, 0.018, 0.008);
        const safetyBladeMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.6 }); // Glock red safety bar accent
        const safetyBlade = new THREE.Mesh(safetyBladeGeo, safetyBladeMat);
        safetyBlade.position.set(0, 0, -0.006);
        trigger.add(safetyBlade);

        // 6. Extended 33-Round Magazine (Invariant: Named `magazine`)
        const magGeo = new THREE.BoxGeometry(0.036, 0.19, 0.052);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x161617, roughness: 0.75, metalness: 0.18 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.155, 0.075);
        magMesh.rotation.x = -0.26;
        glockGroup.add(magMesh);

        // Extended Bumper Baseplate (+2 Floorplate)
        const bumperGeo = new THREE.BoxGeometry(0.044, 0.024, 0.062);
        const bumper = new THREE.Mesh(bumperGeo, darkDetailMat);
        bumper.position.set(0, -0.092, 0);
        magMesh.add(bumper);

        return glockGroup;
    }

    /**
     * Create high-fidelity Desert Eagle .50 AE Pistol ViewModel
     */
    function createDeagleViewModel(weaponDef) {
        weaponDef = weaponDef || { length: 0.45, color: 0x777777 };

        const deagleGroup = new THREE.Group();
        deagleGroup.name = 'deagle';

        // Brushed Stainless Steel PBR
        const chromeSlideMat = (typeof WeaponBase !== 'undefined' && WeaponBase.getGunmetalMaterial)
            ? WeaponBase.getGunmetalMaterial({ color: 0x7c8085 })
            : new THREE.MeshStandardMaterial({ color: 0x7c8085, roughness: 0.22, metalness: 0.92 });

        const darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x222428, roughness: 0.32, metalness: 0.88 });
        const gripRubberMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.94, metalness: 0.05 });
        const medallionMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, roughness: 0.35, metalness: 0.9 }); // Golden Eagle Medallion

        // 1. Massive Stepped Slide & Barrel Assembly
        const barrelLength = 0.32;
        const barrelWidth = 0.052;
        const barrelHeight = 0.056;

        // Barrel with top rail
        const barrelGeo = new THREE.BoxGeometry(barrelWidth, barrelHeight, barrelLength);
        const barrel = new THREE.Mesh(barrelGeo, chromeSlideMat);
        barrel.position.set(0, 0.045, -0.06);
        deagleGroup.add(barrel);

        // Full-length Top Weaver Rail on barrel
        const topRailGeo = new THREE.BoxGeometry(barrelWidth * 0.72, 0.010, barrelLength * 0.88);
        const topRail = new THREE.Mesh(topRailGeo, darkSteelMat);
        topRail.position.set(0, barrelHeight * 0.5 + 0.005, 0);
        barrel.add(topRail);

        // Recoil Cross Slots on Top Rail
        const slotGeo = new THREE.BoxGeometry(barrelWidth * 0.74, 0.006, 0.006);
        const slotMat = new THREE.MeshBasicMaterial({ color: 0x111113 });
        for (let i = 0; i < 9; i++) {
            const slot = new THREE.Mesh(slotGeo, slotMat);
            slot.position.set(0, 0.003, -barrelLength * 0.38 + i * 0.024);
            topRail.add(slot);
        }

        // Colossal .50 AE Muzzle Bore
        const muzzleBoreGeo = new THREE.CylinderGeometry(0.018, 0.018, 0.03, 16);
        muzzleBoreGeo.rotateX(Math.PI / 2);
        const boreInteriorMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        const muzzleBore = new THREE.Mesh(muzzleBoreGeo, boreInteriorMat);
        muzzleBore.position.set(0, 0, -barrelLength * 0.5 - 0.005);
        barrel.add(muzzleBore);

        // Front Crown Ring
        const crownGeo = new THREE.TorusGeometry(0.019, 0.004, 8, 16);
        const crown = new THREE.Mesh(crownGeo, darkSteelMat);
        crown.position.set(0, 0, -barrelLength * 0.5 - 0.002);
        barrel.add(crown);

        // Gas Piston Tube underneath barrel
        const gasTubeGeo = new THREE.CylinderGeometry(0.012, 0.012, barrelLength * 0.65, 12);
        gasTubeGeo.rotateX(Math.PI / 2);
        const gasTube = new THREE.Mesh(gasTubeGeo, darkSteelMat);
        gasTube.position.set(0, -barrelHeight * 0.35, -barrelLength * 0.15);
        barrel.add(gasTube);

        // 2. Rear Slide Section & Serrations
        const rearSlideGeo = new THREE.BoxGeometry(barrelWidth, barrelHeight * 0.95, 0.12);
        const rearSlide = new THREE.Mesh(rearSlideGeo, chromeSlideMat);
        rearSlide.position.set(0, 0.043, 0.06);
        deagleGroup.add(rearSlide);

        // Deep Angled Cocking Serrations
        const deagleSerrGeo = new THREE.BoxGeometry(barrelWidth + 0.002, barrelHeight * 0.70, 0.005);
        for (let i = 0; i < 6; i++) {
            const ds = new THREE.Mesh(deagleSerrGeo, slotMat);
            ds.position.set(0, 0, -0.035 + i * 0.014);
            rearSlide.add(ds);
        }

        // External Combat Hammer
        const hammerGeo = new THREE.BoxGeometry(0.018, 0.032, 0.024);
        const hammer = new THREE.Mesh(hammerGeo, darkSteelMat);
        hammer.position.set(0, 0.046, 0.12);
        hammer.rotation.x = 0.45;
        deagleGroup.add(hammer);

        // Sights
        const frontSight = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.016, 0.022), darkSteelMat);
        frontSight.position.set(0, barrelHeight * 0.5 + 0.014, -barrelLength * 0.45);
        barrel.add(frontSight);

        const rearSight = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.018, 0.016), darkSteelMat);
        rearSight.position.set(0, barrelHeight * 0.5 + 0.014, 0.045);
        rearSlide.add(rearSight);

        // 3. Frame & Heavy Combat Grip
        const frameGeo = new THREE.BoxGeometry(0.048, 0.045, 0.28);
        const frame = new THREE.Mesh(frameGeo, chromeSlideMat);
        frame.position.set(0, 0.002, -0.04);
        deagleGroup.add(frame);

        // Huge Grip
        const gripGeo = new THREE.BoxGeometry(0.046, 0.17, 0.075);
        const grip = new THREE.Mesh(gripGeo, gripRubberMat);
        grip.position.set(0, -0.09, 0.065);
        grip.rotation.x = -0.22;
        deagleGroup.add(grip);

        // Textured Grip Panels (Wrap-around panels)
        const panelGeo = new THREE.BoxGeometry(0.049, 0.14, 0.062);
        const panel = new THREE.Mesh(panelGeo, gripRubberMat);
        panel.position.set(0, 0, 0);
        grip.add(panel);

        // Golden Medallion on grip
        const medGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.051, 12);
        medGeo.rotateZ(Math.PI / 2);
        const medallion = new THREE.Mesh(medGeo, medallionMat);
        medallion.position.set(0, 0.01, 0);
        grip.add(medallion);

        // Trigger Guard & Trigger
        const guardGeo = new THREE.BoxGeometry(0.026, 0.065, 0.085);
        const guard = new THREE.Mesh(guardGeo, chromeSlideMat);
        guard.position.set(0, -0.038, -0.012);
        deagleGroup.add(guard);

        const trigger = new THREE.Mesh(new THREE.BoxGeometry(0.010, 0.032, 0.018), darkSteelMat);
        trigger.position.set(0, -0.032, -0.008);
        trigger.rotation.x = 0.30;
        deagleGroup.add(trigger);

        // 4. Stainless Steel 7-Round Magazine (Invariant: Named `magazine`)
        const magGeo = new THREE.BoxGeometry(0.038, 0.18, 0.058);
        const magMat = new THREE.MeshStandardMaterial({ color: 0x8a8e94, roughness: 0.25, metalness: 0.88 });
        const magMesh = new THREE.Mesh(magGeo, magMat);
        magMesh.name = 'magazine';
        magMesh.position.set(0, -0.155, 0.082);
        magMesh.rotation.x = -0.22;
        deagleGroup.add(magMesh);

        // Black Rubber Floorplate Bumper
        const bumperGeo = new THREE.BoxGeometry(0.048, 0.022, 0.068);
        const bumper = new THREE.Mesh(bumperGeo, gripRubberMat);
        bumper.position.set(0, -0.09, 0);
        magMesh.add(bumper);

        return deagleGroup;
    }

    const TacticalPistolComponents = {
        createGlockViewModel,
        createDeagleViewModel
    };

    root.TacticalPistolComponents = TacticalPistolComponents;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = TacticalPistolComponents;
    }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
