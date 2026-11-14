import * as THREE from 'three';
import { BaseModel3DKey, WOOD_FINISHES, WoodFinishId } from '../data/catalog';
import {
  createWoodTexture,
  createWoodBumpTexture,
  createContactShadowTexture,
} from './proceduralTextures';

let sharedShadowTex: THREE.CanvasTexture | null = null;

function getContactShadowTexture() {
  if (!sharedShadowTex) {
    sharedShadowTex = createContactShadowTexture();
  }
  return sharedShadowTex;
}

function addContactShadow(group: THREE.Group, width: number, depth: number, opacity = 0.48) {
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    depthWrite: false,
    opacity,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), mat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.004;
  shadow.userData.isContactShadow = true;
  group.add(shadow);
}

function createWoodMaterial(woodType: string, maxAnisotropy: number, repeatX = 1, repeatY = 1) {
  const preset = WOOD_FINISHES[woodType as WoodFinishId] || WOOD_FINISHES.mara;
  const map = createWoodTexture(woodType, maxAnisotropy, repeatX, repeatY);
  const bumpMap = createWoodBumpTexture(maxAnisotropy);
  return new THREE.MeshPhysicalMaterial({
    map,
    bumpMap,
    bumpScale: 0.008,
    roughness: preset.roughness,
    metalness: 0.04,
    clearcoat: preset.clearcoat,
    clearcoatRoughness: 0.25,
  });
}

function createBrassMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    metalness: 0.88,
    roughness: 0.22,
  });
}

function createChromeMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.94,
    roughness: 0.14,
  });
}

function createDarkSteelMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    metalness: 0.65,
    roughness: 0.42,
  });
}

function registerWoodMesh(group: THREE.Group, mesh: THREE.Mesh) {
  if (!group.userData.woodMeshes) {
    group.userData.woodMeshes = [];
  }
  (group.userData.woodMeshes as THREE.Mesh[]).push(mesh);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
}

/**
 * Swap wood finish live on any furniture piece
 */
export function applyWoodFinishToFurniture(
  group: THREE.Group,
  finishId: WoodFinishId,
  maxAnisotropy: number = 4
) {
  const meshes = (group.userData.woodMeshes as THREE.Mesh[] | undefined) || [];
  const newMat = createWoodMaterial(finishId, maxAnisotropy);
  meshes.forEach((m) => {
    m.material = newMat;
  });
}

/**
 * 1. ROPERO ESMERALDA 3 CUERPOS (with animated opening doors & lower drawer!)
 */
export function buildRopero(woodType: WoodFinishId = 'mara', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const interiorWoodMat = createWoodMaterial('roble', maxAnisotropy);
  const brassMat = createBrassMaterial();
  const mirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xe8eef2,
    metalness: 0.95,
    roughness: 0.04,
    clearcoat: 1.0,
    envMapIntensity: 1.5,
  });

  const W = 1.8;
  const H = 2.1;
  const D = 0.6;

  // Plinth base
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.1, D - 0.04), woodMat);
  plinth.position.y = 0.05;
  registerWoodMesh(group, plinth);
  group.add(plinth);

  // Back panel + interior shelves + sides + top
  const backPanel = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, H - 0.18, 0.03), interiorWoodMat);
  backPanel.position.set(0, H / 2, -D / 2 + 0.02);
  backPanel.receiveShadow = true;
  group.add(backPanel);

  const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.04, H - 0.14, D), woodMat);
  sideL.position.set(-W / 2 + 0.02, H / 2 + 0.02, 0);
  registerWoodMesh(group, sideL);
  group.add(sideL);

  const sideR = new THREE.Mesh(new THREE.BoxGeometry(0.04, H - 0.14, D), woodMat);
  sideR.position.set(W / 2 - 0.02, H / 2 + 0.02, 0);
  registerWoodMesh(group, sideR);
  group.add(sideR);

  // Interior vertical dividers
  [-0.3, 0.3].forEach((x) => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.03, H - 0.2, D - 0.06), interiorWoodMat);
    div.position.set(x, H / 2 + 0.02, -0.01);
    group.add(div);
  });

  // Interior horizontal shelf & hanging rod + clothes props (visible when doors open!)
  const upperShelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.03, D - 0.08), interiorWoodMat);
  upperShelf.position.set(0, 1.65, -0.01);
  group.add(upperShelf);

  const midDeck = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 0.03, D - 0.06), interiorWoodMat);
  midDeck.position.set(0, 0.55, -0.01);
  group.add(midDeck);

  // Chrome hanging rod inside left & center bay
  const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.12, 12), createChromeMaterial());
  rod.rotation.z = Math.PI / 2;
  rod.position.set(-0.3, 1.54, 0);
  group.add(rod);

  // Stylized hanging garments inside
  const shirtColors = [0xd6d3d1, 0x334155, 0x92400e, 0xe7e5e4];
  shirtColors.forEach((col, i) => {
    const garment = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.52, 0.34),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 })
    );
    garment.position.set(-0.72 + i * 0.18, 1.24, 0);
    group.add(garment);
  });

  // Top crown cornice
  const topRoof = new THREE.Mesh(new THREE.BoxGeometry(W + 0.08, 0.08, D + 0.06), woodMat);
  topRoof.position.set(0, H - 0.04, 0.01);
  registerWoodMesh(group, topRoof);
  group.add(topRoof);

  // Articulated Left Door Pivot
  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-W / 2 + 0.04, 1.3, D / 2 - 0.01);
  const leftDoor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.46, 0.035), woodMat);
  leftDoor.position.set(0.28, 0, 0);
  registerWoodMesh(group, leftDoor);
  leftDoorPivot.add(leftDoor);
  const leftHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 10), brassMat);
  leftHandle.position.set(0.51, 0, 0.03);
  leftDoorPivot.add(leftHandle);
  group.add(leftDoorPivot);

  // Center Mirror Door Pivot
  const centerDoorPivot = new THREE.Group();
  centerDoorPivot.position.set(-0.29, 1.3, D / 2 - 0.01);
  const centerDoor = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.46, 0.035), woodMat);
  centerDoor.position.set(0.29, 0, 0);
  registerWoodMesh(group, centerDoor);
  centerDoorPivot.add(centerDoor);

  const mirrorPane = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.28, 0.01), mirrorMat);
  mirrorPane.position.set(0.29, 0, 0.02);
  centerDoorPivot.add(mirrorPane);
  group.add(centerDoorPivot);

  // Articulated Right Door Pivot
  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(W / 2 - 0.04, 1.3, D / 2 - 0.01);
  const rightDoor = new THREE.Mesh(new THREE.BoxGeometry(0.56, 1.46, 0.035), woodMat);
  rightDoor.position.set(-0.28, 0, 0);
  registerWoodMesh(group, rightDoor);
  rightDoorPivot.add(rightDoor);
  const rightHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.22, 10), brassMat);
  rightHandle.position.set(-0.51, 0, 0.03);
  rightDoorPivot.add(rightHandle);
  group.add(rightDoorPivot);

  // Lower Drawers Group (3 drawers, middle & top slide out!)
  const drawerSlideGroup = new THREE.Group();
  for (let row = 0; row < 2; row++) {
    const dy = 0.2 + row * 0.2;
    const drawerFace = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.17, 0.035), woodMat);
    drawerFace.position.set(0, dy, D / 2 - 0.01);
    registerWoodMesh(group, drawerFace);
    drawerSlideGroup.add(drawerFace);

    const drawerBox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.13, D - 0.14), interiorWoodMat);
    drawerBox.position.set(0, dy - 0.01, 0.02);
    drawerSlideGroup.add(drawerBox);

    [-0.36, 0.36].forEach((hx) => {
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.02, 0.025), brassMat);
      knob.position.set(hx, dy, D / 2 + 0.015);
      drawerSlideGroup.add(knob);
    });
  }
  group.add(drawerSlideGroup);

  addContactShadow(group, 2.3, 1.15);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    leftDoorPivot.rotation.y = -p * 1.15;
    centerDoorPivot.rotation.y = -p * 0.65;
    rightDoorPivot.rotation.y = p * 1.15;
    drawerSlideGroup.position.z = p * 0.28;
  };

  return group;
}

/**
 * 2. JUEGO DE COMEDOR VIRREY 6 SILLAS (with table centerpiece & sliding chairs!)
 */
export function buildComedor(woodType: WoodFinishId = 'cedro', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy, 1.5, 1);
  const fabricMat = new THREE.MeshPhysicalMaterial({
    color: 0xe6dfd3,
    roughness: 0.9,
    sheen: 0.7,
    sheenColor: new THREE.Color(0xfaf7f0),
  });

  // Tabletop with beveled apron
  const top = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.055, 0.98), woodMat);
  top.position.y = 0.76;
  registerWoodMesh(group, top);
  group.add(top);

  const apron = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.08, 0.78), woodMat);
  apron.position.y = 0.70;
  registerWoodMesh(group, apron);
  group.add(apron);

  // 4 Tapered dining legs
  const legOffsets: [number, number][] = [
    [-0.78, -0.36],
    [0.78, -0.36],
    [-0.78, 0.36],
    [0.78, 0.36],
  ];
  legOffsets.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.028, 0.74, 12), woodMat);
    leg.position.set(lx, 0.37, lz);
    registerWoodMesh(group, leg);
    group.add(leg);
  });

  // Centerpiece: linen runner + ceramic fruit bowl
  const runner = new THREE.Mesh(
    new THREE.BoxGeometry(1.35, 0.008, 0.28),
    new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 })
  );
  runner.position.y = 0.792;
  group.add(runner);

  const bowl = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.0),
        new THREE.Vector2(0.08, 0.01),
        new THREE.Vector2(0.16, 0.06),
        new THREE.Vector2(0.18, 0.09),
        new THREE.Vector2(0.165, 0.092),
      ],
      20
    ),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.25 })
  );
  bowl.position.set(0, 0.795, 0);
  bowl.castShadow = true;
  group.add(bowl);

  // 6 Dining Chairs (2 per long side + 1 per head)
  const chairs: { chair: THREE.Group; basePos: THREE.Vector3; outDir: THREE.Vector3 }[] = [];

  const createChair = (x: number, z: number, rotY: number, outDir: THREE.Vector3) => {
    const c = new THREE.Group();
    // 4 legs
    [
      [-0.18, -0.18],
      [0.18, -0.18],
      [-0.18, 0.18],
      [0.18, 0.18],
    ].forEach(([cx, cz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.44, 8), woodMat);
      leg.position.set(cx, 0.22, cz);
      registerWoodMesh(group, leg);
      c.add(leg);
    });
    // Seat frame + cushion
    const seatFrame = new THREE.Mesh(new THREE.BoxGeometry(0.43, 0.04, 0.43), woodMat);
    seatFrame.position.y = 0.45;
    registerWoodMesh(group, seatFrame);
    c.add(seatFrame);

    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.40, 0.045, 0.40), fabricMat);
    cushion.position.y = 0.485;
    cushion.castShadow = true;
    c.add(cushion);

    // Backrest stiles & slats
    [-0.18, 0.18].forEach((bx) => {
      const stile = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.54, 0.035), woodMat);
      stile.position.set(bx, 0.73, -0.19);
      registerWoodMesh(group, stile);
      c.add(stile);
    });
    for (let s = 0; s < 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.055, 0.022), woodMat);
      slat.position.set(0, 0.62 + s * 0.15, -0.19);
      registerWoodMesh(group, slat);
      c.add(slat);
    }

    c.position.set(x, 0, z);
    c.rotation.y = rotY;
    group.add(c);
    chairs.push({ chair: c, basePos: new THREE.Vector3(x, 0, z), outDir });
  };

  createChair(-0.48, -0.66, 0, new THREE.Vector3(0, 0, -1));
  createChair(0.48, -0.66, 0, new THREE.Vector3(0, 0, -1));
  createChair(-0.48, 0.66, Math.PI, new THREE.Vector3(0, 0, 1));
  createChair(0.48, 0.66, Math.PI, new THREE.Vector3(0, 0, 1));
  createChair(-1.12, 0, Math.PI / 2, new THREE.Vector3(-1, 0, 0));
  createChair(1.12, 0, -Math.PI / 2, new THREE.Vector3(1, 0, 0));

  addContactShadow(group, 2.9, 2.0);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    chairs.forEach(({ chair, basePos, outDir }) => {
      chair.position.copy(basePos).addScaledVector(outDir, p * 0.26);
    });
  };

  return group;
}

/**
 * 3. ESCRITORIO GERENCIAL EN L (with opening drawer + toggleable architectural brass lamp!)
 */
export function buildEscritorio(woodType: WoodFinishId = 'roble', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const darkMat = createDarkSteelMaterial();
  const brassMat = createBrassMaterial();

  // Main desktop
  const mainTop = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.05, 0.72), woodMat);
  mainTop.position.set(0, 0.74, 0);
  registerWoodMesh(group, mainTop);
  group.add(mainTop);

  // L-Return wing
  const returnTop = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.05, 0.92), woodMat);
  returnTop.position.set(-0.475, 0.74, 0.76);
  registerWoodMesh(group, returnTop);
  group.add(returnTop);

  // Modesty panel & steel frame legs
  const modesty = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.48, 0.03), woodMat);
  modesty.position.set(0, 0.48, -0.3);
  registerWoodMesh(group, modesty);
  group.add(modesty);

  const steelLegs: [number, number][] = [
    [-0.75, -0.3],
    [0.75, -0.3],
    [0.75, 0.3],
    [-0.75, 1.15],
    [-0.2, 1.15],
  ];
  steelLegs.forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.72, 0.045), darkMat);
    leg.position.set(lx, 0.36, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  // 3-drawer pedestal on right
  const pedBox = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.62, 0.64), woodMat);
  pedBox.position.set(0.54, 0.41, 0);
  registerWoodMesh(group, pedBox);
  group.add(pedBox);

  // Animated top drawer
  const topDrawerPivot = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const df = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.17, 0.03), woodMat);
    df.position.set(0.54, 0.22 + i * 0.19, 0.325);
    registerWoodMesh(group, df);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.025), brassMat);
    pull.position.set(0.54, 0.22 + i * 0.19, 0.345);
    if (i === 2) {
      topDrawerPivot.add(df, pull);
    } else {
      group.add(df, pull);
    }
  }
  group.add(topDrawerPivot);

  // Leather desk blotter + laptop prop
  const blotter = new THREE.Mesh(
    new THREE.BoxGeometry(0.68, 0.008, 0.4),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.7 })
  );
  blotter.position.set(-0.08, 0.77, 0.06);
  group.add(blotter);

  const laptopBase = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.012, 0.22),
    createChromeMaterial()
  );
  laptopBase.position.set(-0.08, 0.78, 0.06);
  group.add(laptopBase);

  const laptopScreen = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.21, 0.01),
    new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.4 })
  );
  laptopScreen.position.set(-0.08, 0.88, -0.045);
  laptopScreen.rotation.x = -0.2;
  group.add(laptopScreen);

  // Architectural brass desk lamp with warm bulb
  const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 0.02, 16), brassMat);
  lampBase.position.set(0.52, 0.775, -0.18);
  group.add(lampBase);

  const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.38, 10), brassMat);
  lampStem.position.set(0.52, 0.96, -0.18);
  group.add(lampStem);

  const lampShade = new THREE.Mesh(
    new THREE.ConeGeometry(0.11, 0.14, 16, 1, true),
    new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4, side: THREE.DoubleSide })
  );
  lampShade.position.set(0.44, 1.12, -0.12);
  lampShade.rotation.z = 0.45;
  group.add(lampShade);

  const lampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff3c4,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.4,
  });
  const lampBulb = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 12), lampBulbMat);
  lampBulb.position.set(0.45, 1.09, -0.12);
  group.add(lampBulb);

  const deskLight = new THREE.PointLight(0xffd28a, 0.5, 3.2);
  deskLight.position.set(0.45, 1.02, -0.12);
  group.add(deskLight);

  addContactShadow(group, 2.1, 1.8);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.deskLight = deskLight;
  group.userData.lampBulbMat = lampBulbMat;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 7, dt);
    const p = group.userData.openProgress;
    topDrawerPivot.position.z = p * 0.25;
    deskLight.intensity = 0.45 + p * 2.2;
    lampBulbMat.emissiveIntensity = 0.4 + p * 2.4;
  };

  return group;
}

/**
 * 4. ESTANTERÍA LIBRERO MODULAR TAJIBO (populated with books & ceramics!)
 */
export function buildEstanteria(woodType: WoodFinishId = 'tajibo', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const darkFrameMat = createDarkSteelMaterial();

  const W = 1.2;
  const H = 2.0;
  const D = 0.35;

  // 4 Vertical stiles
  [
    [-W / 2 + 0.025, -D / 2 + 0.025],
    [W / 2 - 0.025, -D / 2 + 0.025],
    [-W / 2 + 0.025, D / 2 - 0.025],
    [W / 2 - 0.025, D / 2 - 0.025],
  ].forEach(([sx, sz]) => {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.04, H, 0.04), darkFrameMat);
    post.position.set(sx, H / 2, sz);
    post.castShadow = true;
    group.add(post);
  });

  // 5 Wood shelves
  const shelfHeights = [0.12, 0.56, 1.0, 1.44, 1.88];
  shelfHeights.forEach((sy) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(W, 0.036, D), woodMat);
    shelf.position.set(0, sy, 0);
    registerWoodMesh(group, shelf);
    group.add(shelf);
  });

  // Styled books & decorative ceramics across shelves
  const bookColors = [0x991b1b, 0x1e3a8a, 0x065f46, 0x92400e, 0x374151, 0xd97706];
  for (let b = 0; b < 6; b++) {
    const bh = 0.21 + (b % 3) * 0.03;
    const book = new THREE.Mesh(
      new THREE.BoxGeometry(0.045, bh, 0.22),
      new THREE.MeshStandardMaterial({ color: bookColors[b], roughness: 0.65 })
    );
    book.position.set(-0.42 + b * 0.05, 1.02 + bh / 2, 0);
    book.castShadow = true;
    group.add(book);
  }

  // Ceramic vase on shelf 4
  const vase = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0.06, 0),
        new THREE.Vector2(0.085, 0.09),
        new THREE.Vector2(0.04, 0.2),
        new THREE.Vector2(0.048, 0.24),
      ],
      16
    ),
    new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.3 })
  );
  vase.position.set(0.28, 1.46, 0);
  vase.castShadow = true;
  group.add(vase);

  // Decorative wooden storage boxes on bottom shelf
  [-0.28, 0.28].forEach((bx) => {
    const box = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.22, 0.26),
      new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.8 })
    );
    box.position.set(bx, 0.25, 0);
    box.castShadow = true;
    group.add(box);
  });

  addContactShadow(group, 1.5, 0.7);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    vase.rotation.y += dt * 0.4 * group.userData.openProgress;
  };

  return group;
}

/**
 * 5. SILLÓN GERENCIAL EJECUTIVO (5-star chrome base, casters, swivel animation!)
 */
export function buildSillonEjecutivo(): THREE.Group {
  const group = new THREE.Group();
  const chromeMat = createChromeMaterial();
  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: 0x18181b,
    roughness: 0.34,
    metalness: 0.05,
    clearcoat: 0.28,
    clearcoatRoughness: 0.45,
  });

  // 5-star chrome base + caster wheels
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.025, 0.31), chromeMat);
    arm.position.set(Math.sin(angle) * 0.155, 0.075, Math.cos(angle) * 0.155);
    arm.rotation.y = angle;
    arm.castShadow = true;
    group.add(arm);

    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.024, 12), createDarkSteelMaterial());
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(Math.sin(angle) * 0.29, 0.028, Math.cos(angle) * 0.29);
    group.add(wheel);
  }

  // Pneumatic cylinder
  const piston = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.34, 12), chromeMat);
  piston.position.y = 0.24;
  group.add(piston);

  // Swivel Upper Pivot
  const swivelPivot = new THREE.Group();
  swivelPivot.position.y = 0.42;

  const seat = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.11, 0.52), leatherMat);
  seat.position.set(0, 0.05, 0);
  seat.castShadow = true;
  swivelPivot.add(seat);

  const backrest = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.72, 0.11), leatherMat);
  backrest.position.set(0, 0.42, -0.22);
  backrest.rotation.x = -0.1;
  backrest.castShadow = true;
  swivelPivot.add(backrest);

  const headrest = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.16, 0.10), leatherMat);
  headrest.position.set(0, 0.81, -0.26);
  swivelPivot.add(headrest);

  // Chrome & padded armrests
  [-0.29, 0.29].forEach((ax) => {
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.22, 0.04), chromeMat);
    bracket.position.set(ax, 0.15, 0);
    swivelPivot.add(bracket);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.035, 0.34), leatherMat);
    pad.position.set(ax, 0.26, 0.02);
    pad.castShadow = true;
    swivelPivot.add(pad);
  });

  group.add(swivelPivot);
  addContactShadow(group, 0.9, 0.9);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 4, dt);
    swivelPivot.rotation.y = group.userData.openProgress * Math.PI;
  };

  return group;
}

/**
 * 6. CÓMODA SCANDI BICOLOR 4 GAVETAS (splayed legs + 4 sliding graphite drawers!)
 */
export function buildComodaScandi(woodType: WoodFinishId = 'roble', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const grafitoMat = createWoodMaterial('grafito', maxAnisotropy);
  const brassMat = createBrassMaterial();

  // Splayed Scandinavian wooden legs
  [
    [-0.43, -0.17, -0.12, -0.08],
    [0.43, -0.17, 0.12, -0.08],
    [-0.43, 0.17, -0.12, 0.08],
    [0.43, 0.17, 0.12, 0.08],
  ].forEach(([lx, lz, rz, rx]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.014, 0.2, 10), woodMat);
    leg.position.set(lx, 0.095, lz);
    leg.rotation.z = -rz;
    leg.rotation.x = rx;
    registerWoodMesh(group, leg);
    group.add(leg);
  });

  // Main carcass
  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 0.46), woodMat);
  topBoard.position.y = 0.93;
  registerWoodMesh(group, topBoard);
  group.add(topBoard);

  const bottomBoard = new THREE.Mesh(new THREE.BoxGeometry(1.02, 0.035, 0.46), woodMat);
  bottomBoard.position.y = 0.19;
  registerWoodMesh(group, bottomBoard);
  group.add(bottomBoard);

  [-0.492, 0.492].forEach((sx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.46), woodMat);
    side.position.set(sx, 0.56, 0);
    registerWoodMesh(group, side);
    group.add(side);
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.72, 0.025), woodMat);
  back.position.set(0, 0.56, -0.215);
  registerWoodMesh(group, back);
  group.add(back);

  // 4 sliding graphite drawer units
  const drawers: THREE.Group[] = [];
  for (let i = 0; i < 4; i++) {
    const dGroup = new THREE.Group();
    const dy = 0.28 + i * 0.175;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.93, 0.155, 0.03), grafitoMat);
    face.position.set(0, dy, 0.22);
    face.castShadow = true;
    dGroup.add(face);

    const innerBox = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.12, 0.36), woodMat);
    innerBox.position.set(0, dy - 0.01, 0.02);
    dGroup.add(innerBox);

    const handle = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.016, 0.02), brassMat);
    handle.position.set(0, dy + 0.03, 0.24);
    dGroup.add(handle);

    group.add(dGroup);
    drawers.push(dGroup);
  }

  // Tabletop decorative mirror & ceramic pot
  const mirrorFrame = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.018, 10, 32), brassMat);
  mirrorFrame.position.set(-0.18, 1.2, -0.06);
  group.add(mirrorFrame);

  const mirrorGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.21, 32),
    new THREE.MeshPhysicalMaterial({ color: 0xe8eef2, metalness: 0.95, roughness: 0.04, clearcoat: 1 })
  );
  mirrorGlass.position.set(-0.18, 1.2, -0.055);
  group.add(mirrorGlass);

  addContactShadow(group, 1.35, 0.75);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    drawers.forEach((d, idx) => {
      // Staggered drawer opening
      d.position.z = p * (0.1 + (3 - idx) * 0.055);
    });
  };

  return group;
}

/**
 * 7. BANCO DE CARPINTERÍA DE DON TEÓFILO
 */
export function buildWorkbench(maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const benchWood = createWoodMaterial('roble', maxAnisotropy);
  const darkMetal = createDarkSteelMaterial();

  const slab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.09, 0.8), benchWood);
  slab.position.y = 0.86;
  slab.castShadow = true;
  slab.receiveShadow = true;
  group.add(slab);

  [
    [-0.82, -0.32],
    [0.82, -0.32],
    [-0.82, 0.32],
    [0.82, 0.32],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.82, 0.09), benchWood);
    leg.position.set(lx, 0.41, lz);
    leg.castShadow = true;
    group.add(leg);
  });

  const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.65, 0.04, 0.6), benchWood);
  lowerShelf.position.y = 0.24;
  group.add(lowerShelf);

  // Vise & sample planks on workbench
  const vise = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.14, 0.14), darkMetal);
  vise.position.set(-0.7, 0.86, 0.45);
  group.add(vise);

  const sampleColors: WoodFinishId[] = ['mara', 'cedro', 'roble', 'tajibo'];
  sampleColors.forEach((w, idx) => {
    const plank = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.03, 0.16),
      createWoodMaterial(w, maxAnisotropy)
    );
    plank.position.set(-0.2 + idx * 0.24, 0.92 + idx * 0.015, 0.05);
    plank.rotation.y = (idx - 1.5) * 0.12;
    plank.castShadow = true;
    group.add(plank);
  });

  addContactShadow(group, 2.2, 1.1);
  return group;
}

/**
 * 8. CAMA IMPERIAL 2 PLAZAS CON VELADORES Y LÁMPARAS (sliding nightstand drawers + warm bedside lamps!)
 */
export function buildCamaImperial(woodType: WoodFinishId = 'mara', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy, 1.4, 1);
  const brassMat = createBrassMaterial();
  const linenMat = new THREE.MeshPhysicalMaterial({
    color: 0xf5f0e8,
    roughness: 0.88,
    sheen: 0.6,
    sheenColor: new THREE.Color(0xffffff),
  });
  const blanketMat = new THREE.MeshPhysicalMaterial({
    color: 0x7c2d12,
    roughness: 0.85,
    sheen: 0.5,
    sheenColor: new THREE.Color(0xfed7aa),
  });

  // Carved timber headboard + vertical panels
  const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.74, 1.2, 0.08), woodMat);
  headboard.position.set(0, 0.6, -1.03);
  registerWoodMesh(group, headboard);
  group.add(headboard);

  const headCrown = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.06, 0.11), woodMat);
  headCrown.position.set(0, 1.2, -1.03);
  registerWoodMesh(group, headCrown);
  group.add(headCrown);

  // Bed platform frame & 4 corner legs
  const platform = new THREE.Mesh(new THREE.BoxGeometry(1.68, 0.22, 2.06), woodMat);
  platform.position.set(0, 0.22, -0.02);
  registerWoodMesh(group, platform);
  group.add(platform);

  const footboard = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.44, 0.06), woodMat);
  footboard.position.set(0, 0.28, 1.02);
  registerWoodMesh(group, footboard);
  group.add(footboard);

  [
    [-0.78, -0.98],
    [0.78, -0.98],
    [-0.78, 0.98],
    [0.78, 0.98],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.14, 0.08), woodMat);
    leg.position.set(lx, 0.07, lz);
    registerWoodMesh(group, leg);
    group.add(leg);
  });

  // Mattress, blanket & pillows
  const mattress = new THREE.Mesh(new THREE.BoxGeometry(1.56, 0.24, 1.94), linenMat);
  mattress.position.set(0, 0.43, 0);
  mattress.castShadow = true;
  mattress.receiveShadow = true;
  group.add(mattress);

  const throwBlanket = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.255, 0.88), blanketMat);
  throwBlanket.position.set(0, 0.435, 0.46);
  throwBlanket.castShadow = true;
  group.add(throwBlanket);

  [-0.38, 0.38].forEach((px) => {
    const pillow = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.12, 0.4),
      new THREE.MeshPhysicalMaterial({ color: 0xfefcf8, roughness: 0.85, sheen: 0.5 })
    );
    pillow.position.set(px, 0.6, -0.72);
    pillow.rotation.x = 0.18;
    pillow.castShadow = true;
    group.add(pillow);
  });

  // Two Flanking Nightstands with animated drawers & bedside lamps
  const drawers: THREE.Group[] = [];
  const shadeMats: THREE.MeshStandardMaterial[] = [];

  [-1.11, 1.11].forEach((nx) => {
    const standBody = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.48, 0.42), woodMat);
    standBody.position.set(nx, 0.28, -0.82);
    registerWoodMesh(group, standBody);
    group.add(standBody);

    const drawerGrp = new THREE.Group();
    const dFace = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.17, 0.03), woodMat);
    dFace.position.set(nx, 0.39, -0.605);
    registerWoodMesh(group, dFace);
    const dKnob = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.018, 0.025), brassMat);
    dKnob.position.set(nx, 0.39, -0.585);
    drawerGrp.add(dFace, dKnob);
    group.add(drawerGrp);
    drawers.push(drawerGrp);

    // Bedside lamp
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.14, 14), brassMat);
    lampBase.position.set(nx, 0.59, -0.84);
    group.add(lampBase);

    const shadeMat = new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.3,
      roughness: 0.5,
    });
    shadeMats.push(shadeMat);
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.18, 16), shadeMat);
    shade.position.set(nx, 0.74, -0.84);
    group.add(shade);
  });

  const bedLampLight = new THREE.PointLight(0xffd28a, 0.3, 3.6);
  bedLampLight.position.set(0, 1.0, -0.75);
  group.add(bedLampLight);

  addContactShadow(group, 2.8, 2.4);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    drawers.forEach((d) => {
      d.position.z = p * 0.2;
    });
    bedLampLight.intensity = 0.3 + p * 2.1;
    shadeMats.forEach((m) => {
      m.emissiveIntensity = 0.3 + p * 1.9;
    });
  };

  return group;
}

/**
 * 9. SOFÁ MODULAR ANDINO 3 CUERPOS (solid wood plinth + extendable ottoman chaise!)
 */
export function buildSofaModular(woodType: WoodFinishId = 'roble', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy, 1.4, 1);
  const fabricMat = new THREE.MeshPhysicalMaterial({
    color: 0xe7e1d6,
    roughness: 0.9,
    sheen: 0.75,
    sheenColor: new THREE.Color(0xfaf7f2),
  });
  const accentMat = new THREE.MeshPhysicalMaterial({
    color: 0x9a3412,
    roughness: 0.85,
    sheen: 0.6,
  });

  // Solid wood plinth base + splayed legs
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.08, 0.88), woodMat);
  plinth.position.set(0, 0.16, 0);
  registerWoodMesh(group, plinth);
  group.add(plinth);

  [-1.04, 0, 1.04].forEach((lx) => {
    [-0.36, 0.36].forEach((lz) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.018, 0.14, 10), woodMat);
      leg.position.set(lx, 0.07, lz);
      registerWoodMesh(group, leg);
      group.add(leg);
    });
  });

  // Upholstered main deck + backrest + 2 arms with wood accent tops
  const seatDeck = new THREE.Mesh(new THREE.BoxGeometry(2.02, 0.16, 0.82), fabricMat);
  seatDeck.position.set(0, 0.28, 0.02);
  seatDeck.castShadow = true;
  group.add(seatDeck);

  const backrestFrame = new THREE.Mesh(new THREE.BoxGeometry(2.26, 0.56, 0.16), fabricMat);
  backrestFrame.position.set(0, 0.54, -0.35);
  backrestFrame.castShadow = true;
  group.add(backrestFrame);

  [-1.07, 1.07].forEach((ax) => {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.44, 0.86), fabricMat);
    arm.position.set(ax, 0.42, 0);
    arm.castShadow = true;
    group.add(arm);

    const woodCap = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.87), woodMat);
    woodCap.position.set(ax, 0.65, 0);
    registerWoodMesh(group, woodCap);
    group.add(woodCap);
  });

  // 3 Seat cushions + 3 back cushions + 2 throw pillows
  [-0.66, 0, 0.66].forEach((cx, idx) => {
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.13, 0.74), fabricMat);
    cushion.position.set(cx, 0.42, 0.05);
    cushion.castShadow = true;
    group.add(cushion);

    const backCush = new THREE.Mesh(new THREE.BoxGeometry(0.63, 0.38, 0.15), fabricMat);
    backCush.position.set(cx, 0.66, -0.2);
    backCush.rotation.x = -0.14;
    backCush.castShadow = true;
    group.add(backCush);

    if (idx !== 1) {
      const throwPillow = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.3, 0.1), accentMat);
      throwPillow.position.set(cx * 1.25, 0.58, -0.06);
      throwPillow.rotation.set(-0.2, idx === 0 ? 0.35 : -0.35, 0);
      throwPillow.castShadow = true;
      group.add(throwPillow);
    }
  });

  // Pull-out modular footrest ottoman drawer
  const ottomanGroup = new THREE.Group();
  const ottBase = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.07, 0.58), woodMat);
  ottBase.position.set(0.66, 0.24, 0.06);
  registerWoodMesh(group, ottBase);
  const ottPad = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.11, 0.56), fabricMat);
  ottPad.position.set(0.66, 0.33, 0.06);
  ottPad.castShadow = true;
  ottomanGroup.add(ottBase, ottPad);
  group.add(ottomanGroup);

  addContactShadow(group, 2.6, 1.35);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    ottomanGroup.position.z = p * 0.54;
    ottomanGroup.position.y = p * 0.05;
  };

  return group;
}

/**
 * 10. MESA DE CENTRO ELEVABLE CON REVISTERO (smooth hydraulic lift-top reveals storage!)
 */
export function buildMesaCentro(woodType: WoodFinishId = 'cedro', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const steelMat = createDarkSteelMaterial();

  // 4 Tapered legs + lower magazine shelf
  [
    [-0.52, -0.27],
    [0.52, -0.27],
    [-0.52, 0.27],
    [0.52, 0.27],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.017, 0.42, 10), woodMat);
    leg.position.set(lx, 0.21, lz);
    registerWoodMesh(group, leg);
    group.add(leg);
  });

  const lowerShelf = new THREE.Mesh(new THREE.BoxGeometry(1.06, 0.03, 0.54), woodMat);
  lowerShelf.position.y = 0.14;
  registerWoodMesh(group, lowerShelf);
  group.add(lowerShelf);

  // Storage apron box (visible when lift-top rises)
  const boxBottom = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.03, 0.6), woodMat);
  boxBottom.position.y = 0.31;
  registerWoodMesh(group, boxBottom);
  group.add(boxBottom);

  const boxWalls = new THREE.Mesh(new THREE.BoxGeometry(1.12, 0.11, 0.6), woodMat);
  boxWalls.position.y = 0.37;
  registerWoodMesh(group, boxWalls);
  group.add(boxWalls);

  // Scissor lift arms + Liftable Tabletop + decorative book & mug
  const liftTopGroup = new THREE.Group();
  const topSlab = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.045, 0.68), woodMat);
  topSlab.position.y = 0.445;
  registerWoodMesh(group, topSlab);
  liftTopGroup.add(topSlab);

  const artBook = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.028, 0.21),
    new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.6 })
  );
  artBook.position.set(-0.22, 0.48, 0.04);
  artBook.rotation.y = 0.15;
  artBook.castShadow = true;
  liftTopGroup.add(artBook);

  const ceramicTray = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.1, 0.02, 18),
    new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.25 })
  );
  ceramicTray.position.set(0.24, 0.48, -0.04);
  liftTopGroup.add(ceramicTray);
  group.add(liftTopGroup);

  const liftArmL = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.18, 0.03), steelMat);
  liftArmL.position.set(-0.42, 0.36, 0);
  const liftArmR = liftArmL.clone();
  liftArmR.position.x = 0.42;
  group.add(liftArmL, liftArmR);

  addContactShadow(group, 1.45, 0.9);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    liftTopGroup.position.y = p * 0.22;
    liftTopGroup.position.z = p * 0.14;
    liftArmL.position.y = 0.36 + p * 0.1;
    liftArmR.position.y = 0.36 + p * 0.1;
  };

  return group;
}

/**
 * 11. APARADOR BUFFET TAJIBO CON VITRINAS (hinged glass doors + sliding drawers!)
 */
export function buildAparadorBuffet(woodType: WoodFinishId = 'tajibo', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy, 1.3, 1);
  const brassMat = createBrassMaterial();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.08,
    metalness: 0.05,
    transparent: true,
    opacity: 0.35,
  });

  // Base legs & main carcass
  [-0.78, 0.78].forEach((lx) => {
    [-0.19, 0.19].forEach((lz) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.016, 0.18, 10), woodMat);
      leg.position.set(lx, 0.09, lz);
      registerWoodMesh(group, leg);
      group.add(leg);
    });
  });

  const bottomBoard = new THREE.Mesh(new THREE.BoxGeometry(1.75, 0.035, 0.48), woodMat);
  bottomBoard.position.y = 0.19;
  registerWoodMesh(group, bottomBoard);
  group.add(bottomBoard);

  const topBoard = new THREE.Mesh(new THREE.BoxGeometry(1.78, 0.04, 0.5), woodMat);
  topBoard.position.y = 0.93;
  registerWoodMesh(group, topBoard);
  group.add(topBoard);

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.71, 0.72, 0.025), woodMat);
  back.position.set(0, 0.56, -0.225);
  registerWoodMesh(group, back);
  group.add(back);

  [-0.855, -0.32, 0.32, 0.855].forEach((sx) => {
    const div = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.72, 0.46), woodMat);
    div.position.set(sx, 0.56, 0);
    registerWoodMesh(group, div);
    group.add(div);
  });

  // Interior shelves & porcelain bowls visible behind glass
  [-0.58, 0.58].forEach((cx) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.4), woodMat);
    shelf.position.set(cx, 0.56, -0.01);
    registerWoodMesh(group, shelf);
    group.add(shelf);

    const pitcher = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.08, 0.18, 14),
      new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.25 })
    );
    pitcher.position.set(cx, 0.66, 0);
    group.add(pitcher);
  });

  // 3 Center sliding drawers
  const drawerSlide = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const dy = 0.31 + i * 0.23;
    const face = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.2, 0.03), woodMat);
    face.position.set(0, dy, 0.22);
    registerWoodMesh(group, face);
    const pull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.018, 0.025), brassMat);
    pull.position.set(0, dy, 0.24);
    drawerSlide.add(face, pull);
  }
  group.add(drawerSlide);

  // Left & Right Articulated Glass Showcase Doors
  const leftDoorPivot = new THREE.Group();
  leftDoorPivot.position.set(-0.84, 0.56, 0.22);
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.028), glassMat);
  leftFrame.position.x = 0.25;
  const leftTrim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.032), woodMat);
  leftTrim.position.set(0.25, 0.31, 0);
  registerWoodMesh(group, leftTrim);
  const leftTrimBot = leftTrim.clone();
  leftTrimBot.position.y = -0.31;
  registerWoodMesh(group, leftTrimBot);
  leftDoorPivot.add(leftFrame, leftTrim, leftTrimBot);
  group.add(leftDoorPivot);

  const rightDoorPivot = new THREE.Group();
  rightDoorPivot.position.set(0.84, 0.56, 0.22);
  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.68, 0.028), glassMat);
  rightFrame.position.x = -0.25;
  const rightTrim = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.032), woodMat);
  rightTrim.position.set(-0.25, 0.31, 0);
  registerWoodMesh(group, rightTrim);
  const rightTrimBot = rightTrim.clone();
  rightTrimBot.position.y = -0.31;
  registerWoodMesh(group, rightTrimBot);
  rightDoorPivot.add(rightFrame, rightTrim, rightTrimBot);
  group.add(rightDoorPivot);

  addContactShadow(group, 2.1, 0.85);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    leftDoorPivot.rotation.y = -p * 1.1;
    rightDoorPivot.rotation.y = p * 1.1;
    drawerSlide.position.z = p * 0.22;
  };

  return group;
}

/**
 * 12. RACK CENTRO DE TV CEDRO 180 CM (sliding slatted doors + screen prop!)
 */
export function buildRackTV(woodType: WoodFinishId = 'cedro', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy, 1.4, 1);
  const steelMat = createDarkSteelMaterial();
  const brassMat = createBrassMaterial();

  // Steel sled legs
  [-0.78, 0, 0.78].forEach((lx) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.16, 0.38), steelMat);
    leg.position.set(lx, 0.08, 0);
    leg.castShadow = true;
    group.add(leg);
  });

  // Main lowboard carcass
  const bottom = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.035, 0.44), woodMat);
  bottom.position.y = 0.18;
  registerWoodMesh(group, bottom);
  group.add(bottom);

  const top = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.038, 0.45), woodMat);
  top.position.y = 0.60;
  registerWoodMesh(group, top);
  group.add(top);

  [-0.88, -0.3, 0.3, 0.88].forEach((sx) => {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.40, 0.43), woodMat);
    panel.position.set(sx, 0.39, 0);
    registerWoodMesh(group, panel);
    group.add(panel);
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.4, 0.02), woodMat);
  back.position.set(0, 0.39, -0.205);
  registerWoodMesh(group, back);
  group.add(back);

  // Center media shelf + lower sliding drawer
  const centerShelf = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.025, 0.4), woodMat);
  centerShelf.position.set(0, 0.4, 0);
  registerWoodMesh(group, centerShelf);
  group.add(centerShelf);

  const centerDrawer = new THREE.Group();
  const cFace = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.18, 0.028), woodMat);
  cFace.position.set(0, 0.29, 0.21);
  registerWoodMesh(group, cFace);
  const cPull = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.016, 0.02), brassMat);
  cPull.position.set(0, 0.29, 0.23);
  centerDrawer.add(cFace, cPull);
  group.add(centerDrawer);

  // Two Slatted Sliding Doors (Left & Right)
  const makeSlatDoor = (centerX: number) => {
    const d = new THREE.Group();
    const backing = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.37, 0.018), steelMat);
    backing.position.set(centerX, 0.39, 0.21);
    d.add(backing);
    for (let s = -3; s <= 3; s++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.37, 0.028), woodMat);
      slat.position.set(centerX + s * 0.075, 0.39, 0.22);
      registerWoodMesh(group, slat);
      d.add(slat);
    }
    group.add(d);
    return d;
  };
  const leftSlatDoor = makeSlatDoor(-0.59);
  const rightSlatDoor = makeSlatDoor(0.59);

  // Mounted Smart TV & Soundbar showcase prop on top
  const tvStand = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.02, 0.2), steelMat);
  tvStand.position.set(0, 0.63, -0.05);
  const tvNeck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.04), steelMat);
  tvNeck.position.set(0, 0.69, -0.07);
  const tvScreen = new THREE.Mesh(
    new THREE.BoxGeometry(1.26, 0.72, 0.03),
    new THREE.MeshPhysicalMaterial({ color: 0x090d16, roughness: 0.12, metalness: 0.4, clearcoat: 0.9 })
  );
  tvScreen.position.set(0, 1.07, -0.06);
  tvScreen.castShadow = true;
  const soundbar = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.055, 0.08), steelMat);
  soundbar.position.set(0, 0.65, 0.11);
  group.add(tvStand, tvNeck, tvScreen, soundbar);

  addContactShadow(group, 2.1, 0.78);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    leftSlatDoor.position.x = p * 0.28;
    rightSlatDoor.position.x = -p * 0.28;
    centerDrawer.position.z = p * 0.22;
  };

  return group;
}

/**
 * 13. VITRINA BAR & CAVA DE VINO ROBLE (diamond wine rack, warm bar glow & swinging glass door!)
 */
export function buildVitrinaBar(woodType: WoodFinishId = 'roble', maxAnisotropy = 4): THREE.Group {
  const group = new THREE.Group();
  const woodMat = createWoodMaterial(woodType, maxAnisotropy);
  const brassMat = createBrassMaterial();
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0f2fe,
    roughness: 0.06,
    metalness: 0.05,
    transparent: true,
    opacity: 0.32,
  });

  const W = 0.95;
  const H = 1.92;
  const D = 0.45;

  // Plinth & outer cabinet shell
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, 0.1, D - 0.04), woodMat);
  plinth.position.y = 0.05;
  registerWoodMesh(group, plinth);
  group.add(plinth);

  [-W / 2 + 0.02, W / 2 - 0.02].forEach((sx) => {
    const side = new THREE.Mesh(new THREE.BoxGeometry(0.038, H - 0.1, D), woodMat);
    side.position.set(sx, H / 2 + 0.03, 0);
    registerWoodMesh(group, side);
    group.add(side);
  });

  const back = new THREE.Mesh(new THREE.BoxGeometry(W - 0.04, H - 0.1, 0.025), woodMat);
  back.position.set(0, H / 2 + 0.03, -D / 2 + 0.015);
  registerWoodMesh(group, back);
  group.add(back);

  const top = new THREE.Mesh(new THREE.BoxGeometry(W + 0.04, 0.045, D + 0.03), woodMat);
  top.position.set(0, H - 0.02, 0.01);
  registerWoodMesh(group, top);
  group.add(top);

  // Horizontal shelves + bottle cubbies
  [0.12, 0.62, 1.05, 1.46].forEach((sy) => {
    const shelf = new THREE.Mesh(new THREE.BoxGeometry(W - 0.06, 0.03, D - 0.05), woodMat);
    shelf.position.set(0, sy, 0);
    registerWoodMesh(group, shelf);
    group.add(shelf);
  });

  // Wine bottles resting horizontally in lower rack
  const bottleMat = new THREE.MeshPhysicalMaterial({
    color: 0x14532d,
    roughness: 0.18,
    clearcoat: 0.8,
  });
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 4; col++) {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.26, 12), bottleMat);
      bottle.rotation.x = Math.PI / 2;
      bottle.position.set(-0.27 + col * 0.18, 0.72 + row * 0.13, 0);
      group.add(bottle);
    }
  }

  // Hanging wine glasses on upper shelf
  const stemGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.05,
    transparent: true,
    opacity: 0.58,
  });
  [-0.24, 0, 0.24].forEach((gx) => {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.02, 0.11, 14), stemGlassMat);
    cup.position.set(gx, 1.56, 0);
    group.add(cup);
  });

  // Hinged Glass Door
  const doorPivot = new THREE.Group();
  doorPivot.position.set(-W / 2 + 0.04, 1.24, D / 2 - 0.01);
  const doorGlass = new THREE.Mesh(new THREE.BoxGeometry(W - 0.08, 1.24, 0.02), glassMat);
  doorGlass.position.x = (W - 0.08) / 2;
  const doorPull = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.24, 10), brassMat);
  doorPull.position.set(W - 0.14, 0, 0.03);
  doorPivot.add(doorGlass, doorPull);
  group.add(doorPivot);

  const barLight = new THREE.PointLight(0xfbbf24, 0.35, 2.8);
  barLight.position.set(0, 1.65, 0.05);
  group.add(barLight);

  addContactShadow(group, 1.3, 0.8);

  group.userData.isOpen = false;
  group.userData.openProgress = 0;
  group.userData.updateAnimation = (dt: number) => {
    const target = group.userData.isOpen ? 1 : 0;
    group.userData.openProgress = THREE.MathUtils.damp(group.userData.openProgress, target, 6, dt);
    const p = group.userData.openProgress;
    doorPivot.rotation.y = -p * 1.25;
    barLight.intensity = 0.35 + p * 2.4;
  };

  return group;
}

/**
 * 14. 3D ARCHITECTURAL DIMENSION GUIDES (Alto / Ancho / Prof)
 */
export function buildDimensionGuides(
  widthCm: number,
  heightCm: number,
  depthCm: number
): THREE.Group {
  const group = new THREE.Group();
  const w = widthCm / 100;
  const h = heightCm / 100;
  const d = depthCm / 100;

  const lineMat = new THREE.LineBasicMaterial({ color: 0xd97706 });

  const makeMeasureLine = (p1: THREE.Vector3, p2: THREE.Vector3) => {
    const geo = new THREE.BufferGeometry().setFromPoints([p1, p2]);
    return new THREE.Line(geo, lineMat);
  };

  // Width line (front bottom)
  group.add(makeMeasureLine(new THREE.Vector3(-w / 2, 0.04, d / 2 + 0.18), new THREE.Vector3(w / 2, 0.04, d / 2 + 0.18)));
  // Height line (right side)
  group.add(makeMeasureLine(new THREE.Vector3(w / 2 + 0.18, 0, d / 2), new THREE.Vector3(w / 2 + 0.18, h, d / 2)));
  // Depth line (right bottom)
  group.add(makeMeasureLine(new THREE.Vector3(w / 2 + 0.18, 0.04, -d / 2), new THREE.Vector3(w / 2 + 0.18, 0.04, d / 2)));

  // Bounding floor outline
  const rectPts = [
    new THREE.Vector3(-w / 2 - 0.08, 0.02, -d / 2 - 0.08),
    new THREE.Vector3(w / 2 + 0.08, 0.02, -d / 2 - 0.08),
    new THREE.Vector3(w / 2 + 0.08, 0.02, d / 2 + 0.08),
    new THREE.Vector3(-w / 2 - 0.08, 0.02, d / 2 + 0.08),
    new THREE.Vector3(-w / 2 - 0.08, 0.02, -d / 2 - 0.08),
  ];
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(rectPts), lineMat));

  // Sprite helper for readable cm labels
  const makeLabel = (text: string, pos: THREE.Vector3) => {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 96;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#1c1917';
    ctx.beginPath();
    ctx.roundRect(16, 16, 224, 64, 16);
    ctx.fill();
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = '#fef3c7';
    ctx.font = 'bold 30px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 49);

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false }));
    sprite.position.copy(pos);
    sprite.scale.set(0.55, 0.21, 1);
    sprite.renderOrder = 20;
    group.add(sprite);
  };

  makeLabel(`${widthCm} cm`, new THREE.Vector3(0, 0.16, d / 2 + 0.2));
  makeLabel(`${heightCm} cm`, new THREE.Vector3(w / 2 + 0.34, h / 2, d / 2));
  makeLabel(`${depthCm} cm`, new THREE.Vector3(w / 2 + 0.34, 0.16, 0));

  return group;
}

/**
 * Factory helper to instantiate any of the 12 3D furniture models by key
 */
export function buildFurnitureByKey(
  key: BaseModel3DKey,
  woodType: WoodFinishId,
  maxAnisotropy = 4
): THREE.Group {
  switch (key) {
    case 'ropero':
      return buildRopero(woodType, maxAnisotropy);
    case 'comedor':
      return buildComedor(woodType, maxAnisotropy);
    case 'escritorio':
      return buildEscritorio(woodType, maxAnisotropy);
    case 'estante':
      return buildEstanteria(woodType, maxAnisotropy);
    case 'sillon':
      return buildSillonEjecutivo();
    case 'comoda':
      return buildComodaScandi(woodType, maxAnisotropy);
    case 'cama':
      return buildCamaImperial(woodType, maxAnisotropy);
    case 'sofa':
      return buildSofaModular(woodType, maxAnisotropy);
    case 'mesa_centro':
      return buildMesaCentro(woodType, maxAnisotropy);
    case 'aparador':
      return buildAparadorBuffet(woodType, maxAnisotropy);
    case 'rack_tv':
      return buildRackTV(woodType, maxAnisotropy);
    case 'vitrina':
      return buildVitrinaBar(woodType, maxAnisotropy);
    default:
      return buildRopero(woodType, maxAnisotropy);
  }
}

