import * as THREE from 'three';
import {
  createWorkshopFloorTexture,
  createAndeanRugTexture,
  createGalleryArtTexture,
  createWoodTexture,
  createAdvisorStandeeTexture,
  createPlaqueTexture,
  createCustomSignTexture,
} from './proceduralTextures';
import { MUEBLES_SHOWROOM } from '../data/catalog';

export interface ShowroomArchitectureRefs {
  floorMesh: THREE.Mesh;
  wallMeshes: THREE.Mesh[];
  ceilingMesh: THREE.Mesh;
  emissiveBulbs: THREE.MeshStandardMaterial[];
  billboards: THREE.Group[];
  waypointMeshes: THREE.Mesh[];
  interactiveAdvisors: THREE.Group[];
  interactiveSigns: THREE.Object3D[];
  customSignMat: THREE.MeshStandardMaterial;
  glassPanes: THREE.MeshPhysicalMaterial[];
}

export function buildShowroomArchitecture(
  scene: THREE.Scene,
  maxAnisotropy: number,
  isSoftwareGl: boolean
): ShowroomArchitectureRefs {
  const wallMeshes: THREE.Mesh[] = [];
  const emissiveBulbs: THREE.MeshStandardMaterial[] = [];
  const billboards: THREE.Group[] = [];
  const waypointMeshes: THREE.Mesh[] = [];
  const interactiveAdvisors: THREE.Group[] = [];
  const interactiveSigns: THREE.Object3D[] = [];
  const glassPanes: THREE.MeshPhysicalMaterial[] = [];

  const initialSignTex = createCustomSignTexture(
    'Mueblería Modes',
    'Carpintería de Autor · Oruro, Bolivia',
    maxAnisotropy
  );
  const customSignMat = new THREE.MeshStandardMaterial({
    map: initialSignTex,
    roughness: 0.28,
    metalness: 0.14,
    emissive: 0x0f172a,
    emissiveMap: initialSignTex,
    emissiveIntensity: 0.45,
  });

  // 1. Wide-plank gallery floor
  const floorGeo = new THREE.PlaneGeometry(34, 34);
  const floorMat = new THREE.MeshStandardMaterial({
    map: createWorkshopFloorTexture(maxAnisotropy),
    roughness: 0.68,
    metalness: 0.05,
  });
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.receiveShadow = true;
  floorMesh.userData.isWalkableFloor = true;
  scene.add(floorMesh);

  // 2. Woven Area Rugs under furniture vignettes (y = 0.012 to avoid Z-fighting)
  const addRug = (
    x: number,
    z: number,
    w: number,
    d: number,
    rotY: number,
    variant: 'warm' | 'slate' | 'terracotta'
  ) => {
    const rugMat = new THREE.MeshStandardMaterial({
      map: createAndeanRugTexture(variant, maxAnisotropy),
      roughness: 0.94,
      metalness: 0.0,
    });
    const rug = new THREE.Mesh(new THREE.BoxGeometry(w, 0.012, d), rugMat);
    rug.position.set(x, 0.006, z);
    rug.rotation.y = rotY;
    rug.receiveShadow = true;
    rug.userData.isWalkableFloor = true;
    scene.add(rug);
  };

  addRug(1.6, 1.2, 4.2, 3.2, -0.18, 'terracotta'); // Comedor
  addRug(-5.7, 0.1, 4.6, 5.8, 0.25, 'warm'); // Dormitorio Clóset
  addRug(-8.4, 6.4, 4.2, 3.6, 0.65, 'warm'); // Dormitorio Cama Imperial
  addRug(4.7, -3.6, 3.8, 3.4, -0.42, 'slate'); // Oficina
  addRug(7.8, 0.9, 4.6, 4.0, 0.08, 'slate'); // Sala & Living

  // 3. Architectural Walls (Deep Navy Blue default finish, Back/Left/Right) + Baseboards
  const wallMat = new THREE.MeshStandardMaterial({
    color: 0x16243b,
    roughness: 0.84,
    metalness: 0.04,
  });
  const baseboardMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture('mara', maxAnisotropy),
    roughness: 0.45,
  });

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(26, 5.6, 0.3), wallMat);
  backWall.position.set(0, 2.8, -9.0);
  backWall.receiveShadow = true;
  scene.add(backWall);
  wallMeshes.push(backWall);

  const backBaseboard = new THREE.Mesh(new THREE.BoxGeometry(25.6, 0.18, 0.05), baseboardMat);
  backBaseboard.position.set(0, 0.09, -8.83);
  scene.add(backBaseboard);

  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.6, 22), wallMat);
  leftWall.position.set(-12.5, 2.8, 1.8);
  leftWall.receiveShadow = true;
  scene.add(leftWall);
  wallMeshes.push(leftWall);

  const leftBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 21.6), baseboardMat);
  leftBaseboard.position.set(-12.33, 0.09, 1.8);
  scene.add(leftBaseboard);

  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.6, 22), wallMat);
  rightWall.position.set(12.5, 2.8, 1.8);
  rightWall.receiveShadow = true;
  scene.add(rightWall);
  wallMeshes.push(rightWall);

  const rightBaseboard = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 21.6), baseboardMat);
  rightBaseboard.position.set(12.33, 0.09, 1.8);
  scene.add(rightBaseboard);

  // 4. Timber Slat Accent Wall behind Estantería Tajibo
  const slatMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture('cedro', maxAnisotropy),
    roughness: 0.48,
  });
  const slatBackdrop = new THREE.Mesh(
    new THREE.BoxGeometry(4.4, 4.8, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 })
  );
  slatBackdrop.position.set(-0.2, 2.5, -8.83);
  scene.add(slatBackdrop);

  for (let i = -20; i <= 20; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.05, 4.8, 0.06), slatMat);
    slat.position.set(-0.2 + i * 0.1, 2.5, -8.79);
    slat.castShadow = true;
    scene.add(slat);
  }

  // 4b. Grand Illuminated Showroom 3D Name Sign mounted above central cedar slat wall
  const wallSignGroup = new THREE.Group();
  const signBackFrame = new THREE.Mesh(
    new THREE.BoxGeometry(2.86, 0.94, 0.06),
    baseboardMat
  );
  signBackFrame.castShadow = true;
  wallSignGroup.add(signBackFrame);

  const signBrassTrim = new THREE.Mesh(
    new THREE.BoxGeometry(2.76, 0.84, 0.068),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.22 })
  );
  wallSignGroup.add(signBrassTrim);

  const wallSignFace = new THREE.Mesh(new THREE.PlaneGeometry(2.68, 0.78), customSignMat);
  wallSignFace.position.z = 0.036;
  wallSignGroup.add(wallSignFace);

  // Two brass gallery spot arms illuminating the name sign
  [-0.85, 0.85].forEach((lx) => {
    const arm = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 0.04, 0.28),
      new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 })
    );
    arm.position.set(lx, 0.52, 0.14);
    wallSignGroup.add(arm);

    const hood = new THREE.Mesh(
      new THREE.CylinderGeometry(0.03, 0.045, 0.22, 12),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.5, roughness: 0.4 })
    );
    hood.rotation.z = Math.PI / 2;
    hood.position.set(lx, 0.52, 0.27);
    wallSignGroup.add(hood);
  });

  const signGlowLight = new THREE.PointLight(0xffe4b5, 1.35, 5.5);
  signGlowLight.position.set(0, 0.55, 0.65);
  wallSignGroup.add(signGlowLight);

  wallSignGroup.position.set(-0.2, 3.38, -8.72);
  wallSignGroup.userData.isCustomNameSign = true;
  scene.add(wallSignGroup);
  interactiveSigns.push(wallSignGroup);

  // 4c. Carpentry Workshop Wall Sign above Don Teófilo's bench
  const workshopSignGroup = new THREE.Group();
  const wsBack = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.68, 0.05), baseboardMat);
  wsBack.castShadow = true;
  workshopSignGroup.add(wsBack);

  const wsTrim = new THREE.Mesh(
    new THREE.BoxGeometry(1.96, 0.6, 0.058),
    new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.85, roughness: 0.25 })
  );
  workshopSignGroup.add(wsTrim);

  const wsFace = new THREE.Mesh(new THREE.PlaneGeometry(1.88, 0.54), customSignMat);
  wsFace.position.z = 0.032;
  workshopSignGroup.add(wsFace);

  workshopSignGroup.position.set(-8.6, 3.05, -8.8);
  workshopSignGroup.userData.isCustomNameSign = true;
  scene.add(workshopSignGroup);
  interactiveSigns.push(workshopSignGroup);

  // 5. Front Storefront Glass Facade & Entrance Door (+Z = 12.2)
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x292524,
    metalness: 0.5,
    roughness: 0.4,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdbeafe,
    roughness: 0.06,
    metalness: 0.05,
    transmission: isSoftwareGl ? 0 : 0.78,
    transparent: true,
    opacity: isSoftwareGl ? 0.24 : 0.9,
    ior: 1.5,
    depthWrite: false,
  });
  glassPanes.push(glassMat);

  // Storefront header beam
  const frontHeader = new THREE.Mesh(new THREE.BoxGeometry(25.3, 1.0, 0.3), wallMat);
  frontHeader.position.set(0, 5.1, 12.2);
  scene.add(frontHeader);
  wallMeshes.push(frontHeader);

  // Vertical mullions & glass windows
  [-10, -6, -2, 2, 6, 10].forEach((mx) => {
    const mullion = new THREE.Mesh(new THREE.BoxGeometry(0.12, 4.6, 0.16), frameMat);
    mullion.position.set(mx, 2.3, 12.2);
    scene.add(mullion);
  });

  const leftWindow = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 4.5), glassMat);
  leftWindow.position.set(-7.2, 2.3, 12.2);
  scene.add(leftWindow);

  const rightWindow = new THREE.Mesh(new THREE.PlaneGeometry(10.2, 4.5), glassMat);
  rightWindow.position.set(7.2, 2.3, 12.2);
  scene.add(rightWindow);

  // Entrance glass double doors with brass handles
  const doorGlass = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 3.6), glassMat);
  doorGlass.position.set(0, 1.85, 12.2);
  scene.add(doorGlass);

  const brassMat = new THREE.MeshStandardMaterial({ color: 0xd4af37, metalness: 0.88, roughness: 0.2 });
  [-0.25, 0.25].forEach((hx) => {
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.75, 10), brassMat);
    handle.position.set(hx, 1.35, 12.08);
    scene.add(handle);
  });

  // 6. Ceiling, Exposed Timber Beams & Track Lighting Fixtures
  const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xf5f2eb, roughness: 0.92 });
  const ceilingMesh = new THREE.Mesh(new THREE.PlaneGeometry(26, 22), ceilingMat);
  ceilingMesh.rotation.x = Math.PI / 2;
  ceilingMesh.position.set(0, 5.6, 1.8);
  scene.add(ceilingMesh);

  const beamMat = new THREE.MeshStandardMaterial({
    map: createWoodTexture('mara', maxAnisotropy),
    roughness: 0.55,
  });
  [-6.5, -2.5, 1.5, 5.5, 9.5].forEach((bz) => {
    const beam = new THREE.Mesh(new THREE.BoxGeometry(25, 0.28, 0.24), beamMat);
    beam.position.set(0, 5.45, bz);
    scene.add(beam);
  });

  // Track lighting rails & cylindrical spot heads
  const trackMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.6, roughness: 0.4 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff8e7,
    emissive: 0xffd27d,
    emissiveIntensity: 1.4,
  });
  emissiveBulbs.push(bulbMat);

  [-4.8, 0, 4.8].forEach((tx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 15), trackMat);
    rail.position.set(tx, 5.26, -0.5);
    scene.add(rail);

    [-5.5, -1.5, 2.5, 6.0].forEach((tz) => {
      const can = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.22, 12), trackMat);
      can.position.set(tx, 5.1, tz);
      can.rotation.x = 0.25;
      scene.add(can);

      const lens = new THREE.Mesh(new THREE.CircleGeometry(0.055, 12), bulbMat);
      lens.position.set(tx, 4.99, tz + 0.03);
      lens.rotation.x = Math.PI / 2 + 0.25;
      scene.add(lens);
    });
  });

  // 7. Framed Gallery Artworks (procedural high-res posters & wood sample board)
  const addGalleryFrame = (x: number, y: number, z: number, rotY: number, artIndex: number) => {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.72, 1.32, 0.07), beamMat);
    frame.castShadow = true;
    g.add(frame);

    const art = new THREE.Mesh(
      new THREE.PlaneGeometry(1.56, 1.16),
      new THREE.MeshStandardMaterial({
        map: createGalleryArtTexture(artIndex, maxAnisotropy),
        roughness: 0.35,
      })
    );
    art.position.z = 0.04;
    g.add(art);

    g.position.set(x, y, z);
    g.rotation.y = rotY;
    scene.add(g);
  };

  addGalleryFrame(-6.2, 2.9, -8.82, 0, 0);
  addGalleryFrame(6.2, 2.9, -8.82, 0, 2);
  addGalleryFrame(-12.32, 2.9, -2.5, Math.PI / 2, 1);
  addGalleryFrame(12.32, 2.9, 1.5, -Math.PI / 2, 3);

  // 8. Reception & Sales Counter + Pendant Lamps
  const counterGroup = new THREE.Group();
  const counterBody = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.98, 0.72),
    new THREE.MeshStandardMaterial({ map: createWoodTexture('mara', maxAnisotropy), roughness: 0.42 })
  );
  counterBody.position.y = 0.49;
  counterBody.castShadow = true;
  counterBody.receiveShadow = true;
  counterGroup.add(counterBody);

  const counterTop = new THREE.Mesh(
    new THREE.BoxGeometry(2.42, 0.06, 0.84),
    new THREE.MeshStandardMaterial({ color: 0xf5f2eb, roughness: 0.22, metalness: 0.05 })
  );
  counterTop.position.y = 1.01;
  counterTop.castShadow = true;
  counterGroup.add(counterTop);

  // Front Brass-Trimmed Reception Counter Name Plaque
  const deskPlaqueBorder = new THREE.Mesh(
    new THREE.BoxGeometry(1.52, 0.48, 0.025),
    brassMat
  );
  deskPlaqueBorder.position.set(0, 0.52, 0.368);
  counterGroup.add(deskPlaqueBorder);

  const deskPlaqueFace = new THREE.Mesh(new THREE.PlaneGeometry(1.44, 0.42), customSignMat);
  deskPlaqueFace.position.set(0, 0.52, 0.383);
  deskPlaqueFace.userData.isCustomNameSign = true;
  counterGroup.add(deskPlaqueFace);
  interactiveSigns.push(deskPlaqueFace);

  // Wood sample display tray on counter
  const sampleBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.55, 0.025, 0.26),
    new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6 })
  );
  sampleBase.position.set(-0.55, 1.05, 0.05);
  counterGroup.add(sampleBase);

  (['mara', 'cedro', 'roble', 'tajibo'] as const).forEach((w, idx) => {
    const chip = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.025, 0.16),
      new THREE.MeshStandardMaterial({ map: createWoodTexture(w, maxAnisotropy), roughness: 0.38 })
    );
    chip.position.set(-0.73 + idx * 0.12, 1.075, 0.05);
    counterGroup.add(chip);
  });

  // Two warm pendant lights over reception counter
  [-0.55, 0.55].forEach((px) => {
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 2.8, 6), trackMat);
    cord.position.set(px, 4.1, 0);
    counterGroup.add(cord);

    const shade = new THREE.Mesh(
      new THREE.ConeGeometry(0.22, 0.22, 20, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.35, side: THREE.DoubleSide })
    );
    shade.position.set(px, 2.65, 0);
    counterGroup.add(shade);

    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 12), bulbMat);
    bulb.position.set(px, 2.58, 0);
    counterGroup.add(bulb);
  });

  counterGroup.position.set(4.6, 0, 5.2);
  counterGroup.rotation.y = -0.35;
  scene.add(counterGroup);

  // 9. Potted Indoor Plants (composite multi-part botanical props)
  const addPlant = (x: number, z: number, scale = 1) => {
    const pGroup = new THREE.Group();
    const pot = new THREE.Mesh(
      new THREE.CylinderGeometry(0.26, 0.19, 0.44, 16),
      new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.78 })
    );
    pot.position.y = 0.22;
    pot.castShadow = true;
    pGroup.add(pot);

    const soil = new THREE.Mesh(
      new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16),
      new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95 })
    );
    soil.position.y = 0.43;
    pGroup.add(soil);

    const leafMat = new THREE.MeshStandardMaterial({
      color: 0x2d5a27,
      roughness: 0.55,
      side: THREE.DoubleSide,
    });
    const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.7 });

    for (let i = 0; i < 9; i++) {
      const angle = (i / 9) * Math.PI * 2;
      const height = 0.55 + (i % 3) * 0.22;
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, height, 6), stemMat);
      stem.position.set(Math.cos(angle) * 0.08, 0.42 + height * 0.45, Math.sin(angle) * 0.08);
      stem.rotation.z = -Math.cos(angle) * 0.28;
      stem.rotation.x = Math.sin(angle) * 0.28;
      pGroup.add(stem);

      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), leafMat);
      leaf.scale.set(1.2, 0.16, 0.72);
      leaf.position.set(Math.cos(angle) * 0.28, 0.42 + height * 0.9, Math.sin(angle) * 0.28);
      leaf.rotation.y = -angle;
      leaf.rotation.z = -0.35;
      leaf.castShadow = true;
      pGroup.add(leaf);
    }

    pGroup.position.set(x, 0, z);
    pGroup.scale.setScalar(scale);
    scene.add(pGroup);
  };

  addPlant(-10.8, -7.6, 1.15);
  addPlant(10.8, -7.6, 1.1);
  addPlant(-2.8, 10.6, 1.0);
  addPlant(2.8, 10.6, 1.0);

  // 10. Discreet Floor Price Plaques beside major displays
  const addEaselPlaque = (
    x: number,
    z: number,
    rotY: number,
    shortTitle: string,
    priceBs: number
  ) => {
    const g = new THREE.Group();
    const stand = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.025, 0.68, 8),
      trackMat
    );
    stand.position.y = 0.34;
    g.add(stand);

    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.14, 0.025, 16), trackMat);
    foot.position.y = 0.012;
    g.add(foot);

    const card = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.17, 0.015),
      new THREE.MeshStandardMaterial({
        map: createPlaqueTexture(shortTitle, priceBs),
        roughness: 0.4,
      })
    );
    card.position.set(0, 0.68, 0.01);
    card.rotation.x = -0.45;
    g.add(card);

    g.position.set(x, 0, z);
    g.rotation.y = rotY;
    scene.add(g);
  };

  addEaselPlaque(-3.7, -1.3, 0.4, 'Ropero Esmeralda', MUEBLES_SHOWROOM.ropero.precio_bs);
  addEaselPlaque(3.2, 2.3, -0.3, 'Comedor Virrey 6P', MUEBLES_SHOWROOM.comedor.precio_bs);
  addEaselPlaque(4.0, -5.0, -0.5, 'Escritorio L Roble', MUEBLES_SHOWROOM.escritorio.precio_bs);
  addEaselPlaque(-5.5, 2.8, 0.9, 'Cómoda Scandi', MUEBLES_SHOWROOM.comoda.precio_bs);
  addEaselPlaque(-6.4, 7.6, 0.7, 'Cama Imperial', MUEBLES_SHOWROOM.cama.precio_bs);
  addEaselPlaque(7.4, 2.7, -0.8, 'Sofá Andino 3C', MUEBLES_SHOWROOM.sofa.precio_bs);
  addEaselPlaque(7.8, 7.7, -0.7, 'Vitrina Bar Roble', MUEBLES_SHOWROOM.vitrina.precio_bs);

  // 11. Interactive Floor Waypoint Rings (Click to glide/walk there!)
  const waypointCoords: [number, number][] = [
    [0, 5.5],
    [-2.5, 1.5],
    [2.5, 3.8],
    [2.2, -1.6],
    [-3.5, -3.5],
    [5.0, 1.5],
    [-5.2, 5.2],
  ];
  waypointCoords.forEach(([wx, wz]) => {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.22, 0.3, 32),
      new THREE.MeshBasicMaterial({
        color: 0xb45309,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(wx, 0.018, wz);
    ring.userData.isWaypoint = true;
    ring.userData.waypointPos = new THREE.Vector3(wx, 0, wz);
    scene.add(ring);
    waypointMeshes.push(ring);
  });

  // 12. Advisor Standees (Don Teófilo at Workshop & María Paredes at Reception)
  const createAdvisorStandee = (
    x: number,
    z: number,
    characterType: 'carpintero' | 'asesora'
  ) => {
    const standeeGroup = new THREE.Group();

    // Wooden floor pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 0.08, 24),
      beamMat
    );
    pedestal.position.y = 0.04;
    pedestal.castShadow = true;
    standeeGroup.add(pedestal);

    const boardPivot = new THREE.Group();
    boardPivot.position.y = 1.65;

    const tex = createAdvisorStandeeTexture(characterType, maxAnisotropy);
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.18, 1.56),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true, side: THREE.DoubleSide })
    );
    boardPivot.add(panel);
    standeeGroup.add(boardPivot);

    standeeGroup.position.set(x, 0, z);
    standeeGroup.userData = {
      characterType,
      boardPivot,
      baseY: 1.65,
    };

    scene.add(standeeGroup);
    billboards.push(boardPivot);
    interactiveAdvisors.push(standeeGroup);
  };

  createAdvisorStandee(-7.6, -5.4, 'carpintero');
  createAdvisorStandee(3.1, 5.2, 'asesora');

  return {
    floorMesh,
    wallMeshes,
    ceilingMesh,
    emissiveBulbs,
    billboards,
    waypointMeshes,
    interactiveAdvisors,
    interactiveSigns,
    customSignMat,
    glassPanes,
  };
}
