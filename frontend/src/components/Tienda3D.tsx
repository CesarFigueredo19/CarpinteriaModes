import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Eye,
  Footprints,
  Sun,
  Sunset,
  Moon,
  Sparkles,
  ShoppingBag,
  Ruler,
  Phone,
  X,
  DoorOpen,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Music,
  Layers,
  Compass,
  RotateCw,
  RotateCcw,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Plus,
  Minus,
  PenLine,
  Check,
  Bot,
  ClipboardList,
} from 'lucide-react';
import {
  MUEBLES_SHOWROOM,
  MuebleItem,
  SHOWROOM_ZONES,
  WOOD_FINISHES,
  WoodFinishId,
} from '../data/catalog';
import {
  calculateAdjustedPriceBs,
  clampDimensionValue,
  getDimensionBounds,
} from '../utils/pricing';
import {
  applyWoodFinishToFurniture,
  buildAparadorBuffet,
  buildCamaImperial,
  buildComedor,
  buildComodaScandi,
  buildDimensionGuides,
  buildEscritorio,
  buildEstanteria,
  buildMesaCentro,
  buildRackTV,
  buildRopero,
  buildSillonEjecutivo,
  buildSofaModular,
  buildVitrinaBar,
  buildWorkbench,
} from '../utils/furnitureModels';
import { buildShowroomArchitecture } from '../utils/showroomArchitecture';
import { createCustomSignTexture } from '../utils/proceduralTextures';
import { soundEngine } from '../utils/soundEffects';
import { ClienteDTO } from '../services/appService';
import { FloatingCotizacionModal } from './QuoteModals';
import donTeofiloImg from '../assets/images/don_teofilo_oruro_1794532701317.jpg';
import mariaAsesoraImg from '../assets/images/maria_asesora_modes_1794532701827.jpg';

export interface PieceDimensionsCm {
  alto: number;
  ancho: number;
  prof: number;
}

export interface Tienda3DProps {
  isActive?: boolean;
  onGoToPanel?: () => void;
  onOpenCotizador?: (mueble?: MuebleItem, finishId?: WoodFinishId) => void;
  onComprarMueble?: (
    mueble: MuebleItem,
    finishId?: WoodFinishId,
    customDims?: string,
    overridePriceBs?: number
  ) => void;
  onAcquireMueble?: (
    mueble: MuebleItem,
    finishId?: WoodFinishId,
    customDims?: string,
    overridePriceBs?: number
  ) => void;
  onWhatsAppAlert?: (title: string, detail: string) => void;
  focusRequest?: {
    key: MuebleItem['key'];
    seq: number;
    finishId?: WoodFinishId;
    dims?: PieceDimensionsCm;
  } | null;
  stockByKey?: Partial<Record<MuebleItem['key'], number>>;
  clientes?: ClienteDTO[];
  onQuoteCreated?: () => void;
  onGoToPedidos?: () => void;
  onOpenAiAssistant?: () => void;
}

// Reusable scratch math objects (zero GC inside animation loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _rayOrigin = new THREE.Vector2();

type NavMode = 'explore' | 'walk';
type LightTone = 'dia' | 'tarde' | 'noche';
type WallTheme = 'azul' | 'claro' | 'madera';

export default function Tienda3D({
  isActive = true,
  onGoToPanel,
  onComprarMueble,
  onAcquireMueble,
  onWhatsAppAlert,
  focusRequest,
  stockByKey,
  clientes = [],
  onQuoteCreated,
  onGoToPedidos,
  onOpenAiAssistant,
}: Tienda3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // UI state
  const [navMode, setNavMode] = useState<NavMode>('explore');
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [activeZoneId, setActiveZoneId] = useState<string>('general');
  const [selectedMuebleKey, setSelectedMuebleKey] = useState<MuebleItem['key']>('ropero');
  const [showMuebleCard, setShowMuebleCard] = useState(false);
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);
  const [showDonTeofiloModal, setShowDonTeofiloModal] = useState(false);
  const [showMariaModal, setShowMariaModal] = useState(false);
  const [floatingQuoteOpen, setFloatingQuoteOpen] = useState(false);
  const [nearDonTeofilo, setNearDonTeofilo] = useState(false);
  const nearDonTeofiloRef = useRef(false);
  const [currentTone, setCurrentTone] = useState<LightTone>('dia');
  const [wallTheme, setWallTheme] = useState<WallTheme>('azul');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showDimensions3D, setShowDimensions3D] = useState(false);
  const [isPieceInteracted, setIsPieceInteracted] = useState(false);
  const [rotatePieceMode, setRotatePieceMode] = useState(false);
  const [autoSpinPiece, setAutoSpinPiece] = useState(false);
  const [muted, setMuted] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [customName3D, setCustomName3D] = useState<string>(() => {
    try {
      return localStorage.getItem('muebleria_modes_3d_name_v1') || '';
    } catch {
      return '';
    }
  });
  const [draftName3D, setDraftName3D] = useState<string>(customName3D);
  const [nameEditorExpanded, setNameEditorExpanded] = useState<boolean>(false);
  const [pieceFinishes, setPieceFinishes] = useState<Record<MuebleItem['key'], WoodFinishId>>(() => {
    const initial = {} as Record<MuebleItem['key'], WoodFinishId>;
    Object.values(MUEBLES_SHOWROOM).forEach((item) => {
      initial[item.key] = item.defaultFinish;
    });
    return initial;
  });
  const [pieceDims, setPieceDims] = useState<Record<MuebleItem['key'], PieceDimensionsCm>>(() => {
    const initial = {} as Record<MuebleItem['key'], PieceDimensionsCm>;
    Object.values(MUEBLES_SHOWROOM).forEach((item) => {
      initial[item.key] = {
        alto: item.alto_cm,
        ancho: item.ancho_cm,
        prof: item.profundidad_cm,
      };
    });
    return initial;
  });

  // Mutable refs for animation loop access without re-mounting WebGL
  const navModeRef = useRef<NavMode>('explore');
  const selectedKeyRef = useRef<MuebleItem['key']>('ropero');
  const showCardRef = useRef(false);
  const rotatePieceModeRef = useRef(false);
  const autoSpinPieceRef = useRef(false);
  const musicAutoStartedRef = useRef(false);
  const pieceDimsRef = useRef(pieceDims);
  useEffect(() => {
    pieceDimsRef.current = pieceDims;
  }, [pieceDims]);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const orbitRef = useRef<OrbitControls | null>(null);
  const pointerLockRef = useRef<PointerLockControls | null>(null);
  const maxAnisotropyRef = useRef<number>(4);

  const furnitureMapRef = useRef<Record<string, THREE.Group>>({});
  const targetRotationYRef = useRef<Record<string, number>>({});
  const dimensionGuideRef = useRef<THREE.Group | null>(null);
  const selectionRingRef = useRef<THREE.Mesh | null>(null);
  const customSignMatRef = useRef<THREE.MeshStandardMaterial | null>(null);

  const lightsRef = useRef<{
    hemiLight?: THREE.HemisphereLight;
    keyLight?: THREE.DirectionalLight;
    fillLight?: THREE.DirectionalLight;
    spot1?: THREE.PointLight;
    spot2?: THREE.PointLight;
    spot3?: THREE.PointLight;
    spot4?: THREE.PointLight;
    spot5?: THREE.PointLight;
    emissiveBulbs?: THREE.MeshStandardMaterial[];
    wallMeshes?: THREE.Mesh[];
    ceilingMesh?: THREE.Mesh;
  }>({});

  // Camera glide target (for smooth damp transitions)
  const cameraGlideRef = useRef<{
    active: boolean;
    camPos: THREE.Vector3;
    targetPos: THREE.Vector3;
  }>({
    active: false,
    camPos: new THREE.Vector3(0, 2.3, 8.6),
    targetPos: new THREE.Vector3(0, 1.1, -1.8),
  });

  // Movement & physics refs
  const moveStateRef = useRef({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });
  const velocityRef = useRef(new THREE.Vector3());
  const canJumpRef = useRef(true);
  const lastStepSoundRef = useRef(0);

  useEffect(() => {
    navModeRef.current = navMode;
  }, [navMode]);

  useEffect(() => {
    selectedKeyRef.current = selectedMuebleKey;
  }, [selectedMuebleKey]);

  useEffect(() => {
    showCardRef.current = showMuebleCard;
    if (orbitRef.current) {
      orbitRef.current.minDistance = showMuebleCard ? 0.85 : 1.3;
    }
    if (!showMuebleCard) {
      setRotatePieceMode(false);
      setAutoSpinPiece(false);
    }
  }, [showMuebleCard]);

  useEffect(() => {
    rotatePieceModeRef.current = rotatePieceMode;
  }, [rotatePieceMode]);

  useEffect(() => {
    autoSpinPieceRef.current = autoSpinPiece;
  }, [autoSpinPiece]);

  // Helper to unlock Web Audio & gently start ambient showroom music on first interaction
  const ensureAudioAwake = () => {
    if (!musicAutoStartedRef.current && !soundEngine.muted) {
      musicAutoStartedRef.current = true;
      soundEngine.startAmbientMusic();
      setMusicOn(true);
    }
  };

  // Smoothly fly to a furniture piece for close-up inspection & rotation
  const focusFurniture = (key: MuebleItem['key']) => {
    const item = MUEBLES_SHOWROOM[key];
    const group = furnitureMapRef.current[key];
    if (!item || !group) return;

    ensureAudioAwake();
    setSelectedMuebleKey(key);
    setShowMuebleCard(true);
    setIsPieceInteracted(Boolean(group.userData.isOpen));
    setAutoSpinPiece(false);
    soundEngine.playWoodTap();

    // Update selection ring
    if (selectionRingRef.current) {
      selectionRingRef.current.position.set(item.position[0], 0.025, item.position[2]);
      selectionRingRef.current.scale.setScalar(item.collisionRadius * 1.08);
      selectionRingRef.current.visible = true;
    }

    // Compute world-space camera offset rotated by piece rotationY
    const offset = new THREE.Vector3(...item.cameraOffset).applyAxisAngle(
      new THREE.Vector3(0, 1, 0),
      item.rotationY * 0.45
    );
    const desiredCam = new THREE.Vector3(...item.position).add(offset);
    desiredCam.x = THREE.MathUtils.clamp(desiredCam.x, -11.4, 11.4);
    desiredCam.z = THREE.MathUtils.clamp(desiredCam.z, -7.8, 11.2);
    desiredCam.y = THREE.MathUtils.clamp(desiredCam.y, 1.0, 4.4);

    const desiredTarget = new THREE.Vector3(...item.position).add(
      new THREE.Vector3(...item.targetOffset)
    );

    cameraGlideRef.current.camPos.copy(desiredCam);
    cameraGlideRef.current.targetPos.copy(desiredTarget);
    cameraGlideRef.current.active = true;
  };

  // Respond to external focus requests from the Catalog Panel or Floating Top Nav
  useEffect(() => {
    if (focusRequest && furnitureMapRef.current[focusRequest.key]) {
      if (navModeRef.current === 'walk' && pointerLockRef.current?.isLocked) {
        pointerLockRef.current.unlock();
      }
      setNavMode('explore');
      if (focusRequest.finishId && focusRequest.key !== 'sillon') {
        const grp = furnitureMapRef.current[focusRequest.key];
        if (grp) {
          applyWoodFinishToFurniture(grp, focusRequest.finishId, maxAnisotropyRef.current);
          setPieceFinishes((prev) => ({
            ...prev,
            [focusRequest.key]: focusRequest.finishId!,
          }));
        }
      }
      if (focusRequest.dims) {
        const base = MUEBLES_SHOWROOM[focusRequest.key];
        const bounds = getDimensionBounds(base);
        setPieceDims((prev) => ({
          ...prev,
          [focusRequest.key]: {
            alto: clampDimensionValue(focusRequest.dims!.alto, bounds.alto.min, bounds.alto.max),
            ancho: clampDimensionValue(focusRequest.dims!.ancho, bounds.ancho.min, bounds.ancho.max),
            prof: clampDimensionValue(focusRequest.dims!.prof, bounds.prof.min, bounds.prof.max),
          },
        }));
      }
      focusFurniture(focusRequest.key);
    }
  }, [focusRequest]);

  // Update 3D dimension guides whenever selected piece, toggle, or live dimensions change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (dimensionGuideRef.current) {
      scene.remove(dimensionGuideRef.current);
      dimensionGuideRef.current.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = (child as THREE.Sprite | THREE.Mesh | THREE.Line).material;
        if (mat) {
          const mats = Array.isArray(mat) ? mat : [mat];
          mats.forEach((m) => {
            const maybeMap = (m as THREE.SpriteMaterial | THREE.MeshStandardMaterial).map;
            if (maybeMap) {
              maybeMap.dispose();
            }
            m.dispose();
          });
        }
      });
      dimensionGuideRef.current = null;
    }

    if (showDimensions3D && showMuebleCard) {
      const item = MUEBLES_SHOWROOM[selectedMuebleKey];
      const grp = furnitureMapRef.current[selectedMuebleKey];
      const curDims = pieceDims[selectedMuebleKey];
      if (item && grp && curDims) {
        const guides = buildDimensionGuides(curDims.ancho, curDims.alto, curDims.prof);
        guides.position.set(...item.position);
        guides.rotation.y = grp.rotation.y;
        scene.add(guides);
        dimensionGuideRef.current = guides;
      }
    }
  }, [showDimensions3D, showMuebleCard, selectedMuebleKey, pieceDims]);

  // Helper to update the 3D wall sign, workshop sign & reception plaque textures
  const applySignTexture = (nameVal: string) => {
    const mat = customSignMatRef.current;
    if (!mat) return;
    const clean = nameVal.trim();
    const tex = createCustomSignTexture(
      clean || 'Carpintería Mueblería Modes',
      'Carpintería Artesanal · Oruro, Bolivia',
      maxAnisotropyRef.current
    );
    const prevMap = mat.map;
    mat.map = tex;
    mat.emissiveMap = tex;
    mat.needsUpdate = true;
    if (prevMap) prevMap.dispose();
  };

  useEffect(() => {
    applySignTexture(customName3D);
    try {
      if (customName3D.trim()) {
        localStorage.setItem('muebleria_modes_3d_name_v1', customName3D.trim());
      } else {
        localStorage.removeItem('muebleria_modes_3d_name_v1');
      }
    } catch {
      // ignore storage errors
    }
  }, [customName3D]);

  // Initialize Three.js WebGL scene once
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Software WebGL probe
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxAnisotropyRef.current = renderer.capabilities.getMaxAnisotropy();

    const canvasEl = renderer.domElement;
    const onContextLost = (e: Event) => {
      e.preventDefault();
      setContextLost(true);
    };
    const onContextRestored = () => {
      setContextLost(false);
    };
    canvasEl.addEventListener('webglcontextlost', onContextLost);
    canvasEl.addEventListener('webglcontextrestored', onContextRestored);

    container.replaceChildren(canvasEl);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0b1320);
    scene.fog = new THREE.FogExp2(0x0b1320, 0.014);
    sceneRef.current = scene;

    // Studio IBL Environment Map
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(54, width / height, 0.1, 80);
    camera.position.set(0, 2.3, 8.6);
    cameraRef.current = camera;

    // OrbitControls for effortless Explore + Zoom + 360 inspection
    const orbit = new OrbitControls(camera, canvasEl);
    orbit.target.set(0, 1.1, -1.8);
    orbit.enableDamping = !isSoftwareGl;
    orbit.dampingFactor = 0.07;
    orbit.minDistance = 0.85;
    orbit.maxDistance = 14.5;
    orbit.maxPolarAngle = Math.PI / 2 - 0.04;
    orbit.minPolarAngle = 0.22;
    orbit.panSpeed = 0.85;
    orbit.zoomSpeed = 1.1;
    orbit.addEventListener('start', () => {
      cameraGlideRef.current.active = false;
    });
    orbit.update();
    orbitRef.current = orbit;

    // PointerLockControls for optional First-Person Walking mode
    const pointerLock = new PointerLockControls(camera, canvasEl);
    pointerLock.addEventListener('lock', () => setIsPointerLocked(true));
    pointerLock.addEventListener('unlock', () => setIsPointerLocked(false));
    pointerLockRef.current = pointerLock;

    // 3-Point Studio + Showroom Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0x573b26, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffedd5, 1.85);
    keyLight.position.set(7, 11, 8);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 35;
    keyLight.shadow.camera.left = -13;
    keyLight.shadow.camera.right = 13;
    keyLight.shadow.camera.top = 13;
    keyLight.shadow.camera.bottom = -13;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0xe0f2fe, 0.45);
    fillLight.position.set(-8, 6, -6);
    scene.add(fillLight);

    const spot1 = new THREE.PointLight(0xffefd6, 2.2, 13, 1.5);
    spot1.position.set(-5.0, 4.7, -1.5);
    scene.add(spot1);

    const spot2 = new THREE.PointLight(0xffefd6, 2.2, 13, 1.5);
    spot2.position.set(2.0, 4.7, 1.5);
    scene.add(spot2);

    const spot3 = new THREE.PointLight(0xffefd6, 1.8, 12, 1.5);
    spot3.position.set(4.5, 4.7, -3.5);
    scene.add(spot3);

    const spot4 = new THREE.PointLight(0xffefd6, 2.0, 13, 1.5);
    spot4.position.set(8.0, 4.7, 2.2);
    scene.add(spot4);

    const spot5 = new THREE.PointLight(0xffefd6, 2.0, 13, 1.5);
    spot5.position.set(-7.8, 4.7, 5.4);
    scene.add(spot5);

    // Build Architectural Showroom Shell
    const arch = buildShowroomArchitecture(scene, maxAnisotropyRef.current, isSoftwareGl);
    customSignMatRef.current = arch.customSignMat;
    {
      const cleanInit = customName3D.trim();
      const initialTex = createCustomSignTexture(
        cleanInit || 'Carpintería Mueblería Modes',
        'Carpintería Artesanal · Oruro, Bolivia',
        maxAnisotropyRef.current
      );
      const prevMap = arch.customSignMat.map;
      arch.customSignMat.map = initialTex;
      arch.customSignMat.emissiveMap = initialTex;
      arch.customSignMat.needsUpdate = true;
      if (prevMap) prevMap.dispose();
    }

    lightsRef.current = {
      hemiLight,
      keyLight,
      fillLight,
      spot1,
      spot2,
      spot3,
      spot4,
      spot5,
      emissiveBulbs: arch.emissiveBulbs,
      wallMeshes: arch.wallMeshes,
      ceilingMesh: arch.ceilingMesh,
    };

    // Build all 12 Showroom Furniture Models + Workshop Workbench
    const builtMap: Record<MuebleItem['key'], THREE.Group> = {
      ropero: buildRopero('mara', maxAnisotropyRef.current),
      comedor: buildComedor('cedro', maxAnisotropyRef.current),
      escritorio: buildEscritorio('roble', maxAnisotropyRef.current),
      estante: buildEstanteria('tajibo', maxAnisotropyRef.current),
      sillon: buildSillonEjecutivo(),
      comoda: buildComodaScandi('roble', maxAnisotropyRef.current),
      cama: buildCamaImperial('mara', maxAnisotropyRef.current),
      sofa: buildSofaModular('roble', maxAnisotropyRef.current),
      mesa_centro: buildMesaCentro('cedro', maxAnisotropyRef.current),
      aparador: buildAparadorBuffet('tajibo', maxAnisotropyRef.current),
      rack_tv: buildRackTV('cedro', maxAnisotropyRef.current),
      vitrina: buildVitrinaBar('roble', maxAnisotropyRef.current),
    };

    (Object.keys(builtMap) as MuebleItem['key'][]).forEach((key) => {
      const item = MUEBLES_SHOWROOM[key];
      const grp = builtMap[key];
      grp.position.set(...item.position);
      grp.rotation.y = item.rotationY;
      grp.userData.muebleKey = key;
      grp.userData.displayName = item.nombre;
      targetRotationYRef.current[key] = item.rotationY;
      scene.add(grp);
    });
    furnitureMapRef.current = builtMap;

    const workbench = buildWorkbench(maxAnisotropyRef.current);
    workbench.position.set(-7.6, 0, -6.7);
    workbench.rotation.y = 0.25;
    scene.add(workbench);

    // Floor selection highlight ring
    const selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.88, 1.0, 48),
      new THREE.MeshBasicMaterial({
        color: 0xd97706,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      })
    );
    selectionRing.rotation.x = -Math.PI / 2;
    selectionRing.position.set(0, 0.024, 0);
    selectionRing.visible = false;
    scene.add(selectionRing);
    selectionRingRef.current = selectionRing;

    const interactiveObjects: THREE.Object3D[] = [
      ...Object.values(builtMap),
      ...arch.interactiveAdvisors,
      ...arch.interactiveSigns,
      ...arch.waypointMeshes,
    ];

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // Raycasting & Direct Product-Rotation Drag state
    const raycaster = new THREE.Raycaster();
    let pointerDownPos = { x: 0, y: 0 };
    let isDraggingProduct = false;
    let lastDragX = 0;
    let lastHoverTime = 0;

    const resolveTarget = (hitObj: THREE.Object3D) => {
      let curr: THREE.Object3D | null = hitObj;
      while (curr) {
        if (
          curr.userData?.muebleKey ||
          curr.userData?.characterType ||
          curr.userData?.isCustomNameSign ||
          curr.userData?.isWaypoint
        ) {
          return curr;
        }
        curr = curr.parent;
      }
      return null;
    };

    const handlePointerDown = (e: PointerEvent) => {
      ensureAudioAwake();
      pointerDownPos = { x: e.clientX, y: e.clientY };
      lastDragX = e.clientX;

      if (
        navModeRef.current === 'explore' &&
        rotatePieceModeRef.current &&
        showCardRef.current
      ) {
        isDraggingProduct = true;
        orbit.enabled = false;
        canvasEl.style.cursor = 'ew-resize';
        return;
      }

      // In FPS Walk mode, click directly interacts with crosshair target
      if (navModeRef.current === 'walk' && pointerLock.isLocked) {
        _rayOrigin.set(0, 0);
        raycaster.setFromCamera(_rayOrigin, camera);
        const hits = raycaster.intersectObjects(interactiveObjects, true);
        if (hits.length > 0 && hits[0].distance < 8.5) {
          const target = resolveTarget(hits[0].object);
          if (target?.userData?.characterType === 'carpintero') {
            pointerLock.unlock();
            setShowDonTeofiloModal(true);
            soundEngine.playChime();
          } else if (target?.userData?.characterType === 'asesora') {
            pointerLock.unlock();
            setShowMariaModal(true);
            soundEngine.playChime();
          } else if (target?.userData?.muebleKey) {
            const key = target.userData.muebleKey as MuebleItem['key'];
            setSelectedMuebleKey(key);
            setShowMuebleCard(true);
            target.userData.isOpen = !target.userData.isOpen;
            setIsPieceInteracted(Boolean(target.userData.isOpen));
            soundEngine.playDrawerGlide(Boolean(target.userData.isOpen));
          }
        }
      }
    };

    const handlePointerUp = (e: PointerEvent) => {
      if (isDraggingProduct) {
        isDraggingProduct = false;
        orbit.enabled = true;
        canvasEl.style.cursor = 'grab';
        return;
      }

      if (navModeRef.current !== 'explore') return;
      const dist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
      if (dist > 6) return; // Was a drag orbit, not a click

      const rect = canvasEl.getBoundingClientRect();
      _rayOrigin.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(_rayOrigin, camera);

      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length > 0) {
        const target = resolveTarget(hits[0].object);
        if (target?.userData?.characterType === 'carpintero') {
          setShowDonTeofiloModal(true);
          soundEngine.playChime();
          return;
        }
        if (target?.userData?.characterType === 'asesora') {
          setShowMariaModal(true);
          soundEngine.playChime();
          return;
        }
        if (target?.userData?.muebleKey) {
          const key = target.userData.muebleKey as MuebleItem['key'];
          focusFurniture(key);
          return;
        }
        if (target?.userData?.isCustomNameSign) {
          setNameEditorExpanded(true);
          cameraGlideRef.current.camPos.set(-0.2, 2.55, -3.5);
          cameraGlideRef.current.targetPos.set(-0.2, 3.25, -8.72);
          cameraGlideRef.current.active = true;
          soundEngine.playChime();
          return;
        }
        if (target?.userData?.isWaypoint) {
          const wp = target.userData.waypointPos as THREE.Vector3;
          _vecA.subVectors(orbit.target, camera.position);
          _vecA.y = 0;
          if (_vecA.lengthSq() < 0.01) _vecA.set(0, 0, -1);
          _vecA.normalize();

          cameraGlideRef.current.camPos.set(wp.x, 1.75, wp.z);
          cameraGlideRef.current.targetPos
            .copy(cameraGlideRef.current.camPos)
            .addScaledVector(_vecA, 3.2);
          cameraGlideRef.current.targetPos.y = 1.25;
          cameraGlideRef.current.active = true;
          soundEngine.playFootstep();
          return;
        }
      }

      // Click on walkable floor moves smoothly toward clicked point
      const floorHits = raycaster.intersectObject(arch.floorMesh, false);
      if (floorHits.length > 0) {
        const pt = floorHits[0].point;
        const clampedX = THREE.MathUtils.clamp(pt.x, -11.0, 11.0);
        const clampedZ = THREE.MathUtils.clamp(pt.z, -7.8, 10.8);
        _vecA.subVectors(orbit.target, camera.position);
        _vecA.y = 0;
        if (_vecA.lengthSq() < 0.01) _vecA.set(0, 0, -1);
        _vecA.normalize();

        cameraGlideRef.current.camPos.set(clampedX, 1.75, clampedZ);
        cameraGlideRef.current.targetPos
          .copy(cameraGlideRef.current.camPos)
          .addScaledVector(_vecA, 3.4);
        cameraGlideRef.current.targetPos.y = 1.2;
        cameraGlideRef.current.active = true;
        soundEngine.playFootstep();
      }
    };

    const handlePointerMove = (e: PointerEvent) => {
      // Handle free 360° product rotation drag when "Rotar Pieza 360°" mode is active
      if (isDraggingProduct && showCardRef.current) {
        const deltaX = e.clientX - lastDragX;
        lastDragX = e.clientX;
        const key = selectedKeyRef.current;
        targetRotationYRef.current[key] =
          (targetRotationYRef.current[key] ?? 0) + deltaX * 0.012;
        return;
      }

      if (navModeRef.current !== 'explore') return;
      if (rotatePieceModeRef.current && showCardRef.current) {
        canvasEl.style.cursor = 'ew-resize';
        setHoveredLabel('Arrastra horizontalmente para girar el mueble 360°');
        return;
      }

      const now = performance.now();
      if (now - lastHoverTime < 50) return; // Throttle to 20fps
      lastHoverTime = now;

      const rect = canvasEl.getBoundingClientRect();
      _rayOrigin.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(_rayOrigin, camera);
      const hits = raycaster.intersectObjects(interactiveObjects, true);
      if (hits.length > 0) {
        const target = resolveTarget(hits[0].object);
        if (target?.userData?.characterType === 'carpintero') {
          canvasEl.style.cursor = 'pointer';
          setHoveredLabel('Don Teófilo · Maestro Artesano (Clic para cotizar)');
          return;
        }
        if (target?.userData?.characterType === 'asesora') {
          canvasEl.style.cursor = 'pointer';
          setHoveredLabel('María Paredes · Asesora Comercial (Clic para consultar)');
          return;
        }
        if (target?.userData?.muebleKey) {
          canvasEl.style.cursor = 'pointer';
          setHoveredLabel(`${target.userData.displayName} · Clic para ver detalles y rotar`);
          return;
        }
        if (target?.userData?.isCustomNameSign) {
          canvasEl.style.cursor = 'pointer';
          setHoveredLabel('Letrero Carpintería 3D · Clic para editar el nombre');
          return;
        }
        if (target?.userData?.isWaypoint) {
          canvasEl.style.cursor = 'pointer';
          setHoveredLabel('Caminar hacia esta zona');
          return;
        }
      }
      canvasEl.style.cursor = 'grab';
      setHoveredLabel(null);
    };

    canvasEl.addEventListener('pointerdown', handlePointerDown);
    canvasEl.addEventListener('pointerup', handlePointerUp);
    canvasEl.addEventListener('pointermove', handlePointerMove);

    // Keyboard WASD + E (interact) + R (toggle product rotate) + H (toggle HUD) + Space (jump)
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }
      if (e.code === 'KeyW' || e.code === 'ArrowUp') moveStateRef.current.forward = true;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') moveStateRef.current.backward = true;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveStateRef.current.left = true;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') moveStateRef.current.right = true;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') moveStateRef.current.sprint = true;
      if (e.code === 'Space' && navModeRef.current === 'walk' && canJumpRef.current) {
        velocityRef.current.y = 5.2;
        canJumpRef.current = false;
      }
      if (e.code === 'KeyH') {
        setDockCollapsed((prev) => !prev);
      }
      if (e.code === 'KeyR' && showCardRef.current) {
        setRotatePieceMode((prev) => !prev);
      }
      if (e.code === 'KeyE' && showCardRef.current) {
        const grp = furnitureMapRef.current[selectedKeyRef.current];
        if (grp) {
          grp.userData.isOpen = !grp.userData.isOpen;
          setIsPieceInteracted(Boolean(grp.userData.isOpen));
          soundEngine.playDrawerGlide(Boolean(grp.userData.isOpen));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'KeyW' || e.code === 'ArrowUp') moveStateRef.current.forward = false;
      if (e.code === 'KeyS' || e.code === 'ArrowDown') moveStateRef.current.backward = false;
      if (e.code === 'KeyA' || e.code === 'ArrowLeft') moveStateRef.current.left = false;
      if (e.code === 'KeyD' || e.code === 'ArrowRight') moveStateRef.current.right = false;
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') moveStateRef.current.sprint = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    // ResizeObserver for responsive container
    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (w < 10 || h < 10) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    };
    const resizeObs = new ResizeObserver(handleResize);
    resizeObs.observe(container);

    // Collision resolution helper for Walk mode
    const furnitureColliders = Object.values(MUEBLES_SHOWROOM).map((m) => ({
      x: m.position[0],
      z: m.position[2],
      r: m.collisionRadius,
    }));
    furnitureColliders.push({ x: 4.6, z: 5.2, r: 1.35 }, { x: -7.6, z: -6.7, r: 1.15 });

    // Animation loop + software-WebGL pacing
    let frameId = 0;
    let disposed = false;
    const clock = new THREE.Clock();

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    const tick = () => {
      if (disposed) return;
      if (!isActiveRef.current) {
        if (isSoftwareGl) {
          frameId = window.setTimeout(tick, 180);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }
      const dt = Math.min(clock.getDelta(), 0.05);
      const elapsed = clock.elapsedTime;

      // 1. Update furniture door/drawer/swivel animations, live 3D scale & 360° turntable rotation
      (Object.keys(furnitureMapRef.current) as MuebleItem['key'][]).forEach((key) => {
        const grp = furnitureMapRef.current[key];
        const base = MUEBLES_SHOWROOM[key];
        const targetDims = pieceDimsRef.current[key];
        if (base && targetDims) {
          const sx = targetDims.ancho / base.ancho_cm;
          const sy = targetDims.alto / base.alto_cm;
          const sz = targetDims.prof / base.profundidad_cm;
          grp.scale.x = THREE.MathUtils.damp(grp.scale.x, sx, 11, dt);
          grp.scale.y = THREE.MathUtils.damp(grp.scale.y, sy, 11, dt);
          grp.scale.z = THREE.MathUtils.damp(grp.scale.z, sz, 11, dt);
        }
        if (typeof grp.userData.updateAnimation === 'function') {
          grp.userData.updateAnimation(dt);
        }
        if (autoSpinPieceRef.current && showCardRef.current && selectedKeyRef.current === key) {
          targetRotationYRef.current[key] = (targetRotationYRef.current[key] ?? grp.rotation.y) + dt * 0.85;
        }
        const targetRot = targetRotationYRef.current[key];
        if (typeof targetRot === 'number') {
          grp.rotation.y = THREE.MathUtils.damp(grp.rotation.y, targetRot, 10, dt);
        }
      });

      // Keep 3D dimension guides aligned if product is rotating
      if (dimensionGuideRef.current && showCardRef.current) {
        const activeGrp = furnitureMapRef.current[selectedKeyRef.current];
        if (activeGrp) {
          dimensionGuideRef.current.rotation.y = activeGrp.rotation.y;
        }
      }

      // 2. Gentle breathing & Y-axis facing for Advisor Standees (keeping elevated baseY)
      arch.billboards.forEach((boardPivot, idx) => {
        const baseY = Number(boardPivot.parent?.userData?.baseY ?? 1.65);
        boardPivot.position.y = baseY + Math.sin(elapsed * 1.8 + idx * 1.5) * 0.03;
        const worldPos = _vecA;
        boardPivot.getWorldPosition(worldPos);
        const angle = Math.atan2(camera.position.x - worldPos.x, camera.position.z - worldPos.z);
        boardPivot.rotation.y = angle;
      });

      // 2b. Proximity check to Don Teófilo (-7.6, -5.4) -> show floating Cotización a Medida option
      const distDonTeofilo = Math.hypot(camera.position.x - -7.6, camera.position.z - -5.4);
      const isCloseToTeofilo = distDonTeofilo <= 3.6;
      if (isCloseToTeofilo !== nearDonTeofiloRef.current) {
        nearDonTeofiloRef.current = isCloseToTeofilo;
        setNearDonTeofilo(isCloseToTeofilo);
      }

      // 3. Subtle waypoint ring pulse via scale
      arch.waypointMeshes.forEach((wp, idx) => {
        const s = 1 + Math.sin(elapsed * 2.4 + idx) * 0.07;
        wp.scale.setScalar(s);
      });

      // 4. Camera Navigation: Explore vs FPS Walk + Footstep Cadence Audio
      const isWalkingKeys =
        moveStateRef.current.forward ||
        moveStateRef.current.backward ||
        moveStateRef.current.left ||
        moveStateRef.current.right;

      if (navModeRef.current === 'explore') {
        orbit.enabled = !isDraggingProduct;

        const keyMoveZ =
          Number(moveStateRef.current.forward) - Number(moveStateRef.current.backward);
        const keyMoveX =
          Number(moveStateRef.current.right) - Number(moveStateRef.current.left);

        if (keyMoveZ !== 0 || keyMoveX !== 0) {
          cameraGlideRef.current.active = false;
          camera.getWorldDirection(_vecA);
          _vecA.y = 0;
          _vecA.normalize();
          _vecB.crossVectors(_vecA, camera.up).normalize();
          const speed = (moveStateRef.current.sprint ? 6.5 : 3.8) * dt;
          const moveDelta = _vecA
            .multiplyScalar(keyMoveZ * speed)
            .addScaledVector(_vecB, keyMoveX * speed);
          camera.position.add(moveDelta);
          orbit.target.add(moveDelta);

          const nowMs = performance.now();
          const stepInterval = moveStateRef.current.sprint ? 310 : 440;
          if (nowMs - lastStepSoundRef.current > stepInterval) {
            lastStepSoundRef.current = nowMs;
            soundEngine.playFootstep();
          }
        }

        // Smooth camera glide when focusing a furniture piece or zone
        if (cameraGlideRef.current.active) {
          const lambda = 5.5;
          camera.position.x = THREE.MathUtils.damp(
            camera.position.x,
            cameraGlideRef.current.camPos.x,
            lambda,
            dt
          );
          camera.position.y = THREE.MathUtils.damp(
            camera.position.y,
            cameraGlideRef.current.camPos.y,
            lambda,
            dt
          );
          camera.position.z = THREE.MathUtils.damp(
            camera.position.z,
            cameraGlideRef.current.camPos.z,
            lambda,
            dt
          );
          orbit.target.x = THREE.MathUtils.damp(
            orbit.target.x,
            cameraGlideRef.current.targetPos.x,
            lambda,
            dt
          );
          orbit.target.y = THREE.MathUtils.damp(
            orbit.target.y,
            cameraGlideRef.current.targetPos.y,
            lambda,
            dt
          );
          orbit.target.z = THREE.MathUtils.damp(
            orbit.target.z,
            cameraGlideRef.current.targetPos.z,
            lambda,
            dt
          );

          if (camera.position.distanceTo(cameraGlideRef.current.camPos) < 0.03) {
            cameraGlideRef.current.active = false;
          }
        }

        camera.position.x = THREE.MathUtils.clamp(camera.position.x, -11.8, 11.8);
        camera.position.z = THREE.MathUtils.clamp(camera.position.z, -8.3, 11.6);
        camera.position.y = THREE.MathUtils.clamp(camera.position.y, 0.7, 4.9);

        orbit.update();
      } else {
        orbit.enabled = false;

        if (pointerLock.isLocked) {
          velocityRef.current.x -= velocityRef.current.x * 10.0 * dt;
          velocityRef.current.z -= velocityRef.current.z * 10.0 * dt;
          velocityRef.current.y -= 18.0 * dt;

          const dirZ =
            Number(moveStateRef.current.forward) - Number(moveStateRef.current.backward);
          const dirX =
            Number(moveStateRef.current.right) - Number(moveStateRef.current.left);
          _vecA.set(dirX, 0, dirZ);
          if (_vecA.lengthSq() > 0) _vecA.normalize();

          const walkSpeed = moveStateRef.current.sprint ? 28.0 : 17.0;
          if (dirZ !== 0) velocityRef.current.z -= _vecA.z * walkSpeed * dt;
          if (dirX !== 0) velocityRef.current.x -= _vecA.x * walkSpeed * dt;

          pointerLock.moveRight(-velocityRef.current.x * dt);
          pointerLock.moveForward(-velocityRef.current.z * dt);
          camera.position.y += velocityRef.current.y * dt;

          if (camera.position.y < 1.68) {
            velocityRef.current.y = 0;
            camera.position.y = 1.68;
            canJumpRef.current = true;
          }

          // Footstep audio on floor while walking
          if (isWalkingKeys && camera.position.y <= 1.72) {
            const nowMs = performance.now();
            const stepInterval = moveStateRef.current.sprint ? 300 : 430;
            if (nowMs - lastStepSoundRef.current > stepInterval) {
              lastStepSoundRef.current = nowMs;
              soundEngine.playFootstep();
            }
          }

          camera.position.x = THREE.MathUtils.clamp(camera.position.x, -11.7, 11.7);
          camera.position.z = THREE.MathUtils.clamp(camera.position.z, -8.2, 11.4);

          for (const col of furnitureColliders) {
            const dx = camera.position.x - col.x;
            const dz = camera.position.z - col.z;
            const distSq = dx * dx + dz * dz;
            if (distSq < col.r * col.r && distSq > 0.0001) {
              const dist = Math.sqrt(distSq);
              camera.position.x = col.x + (dx / dist) * col.r;
              camera.position.z = col.z + (dz / dist) * col.r;
            }
          }

          // Crosshair hover hint in FPS mode
          _rayOrigin.set(0, 0);
          raycaster.setFromCamera(_rayOrigin, camera);
          const fpsHits = raycaster.intersectObjects(interactiveObjects, true);
          if (fpsHits.length > 0 && fpsHits[0].distance < 7.5) {
            const t = resolveTarget(fpsHits[0].object);
            if (t?.userData?.muebleKey) {
              setHoveredLabel(`${t.userData.displayName} · Clic para abrir/inspeccionar`);
            } else if (t?.userData?.characterType === 'carpintero') {
              setHoveredLabel('Don Teófilo · Clic para hablar');
            } else if (t?.userData?.characterType === 'asesora') {
              setHoveredLabel('María Paredes · Clic para hablar');
            } else {
              setHoveredLabel(null);
            }
          } else {
            setHoveredLabel(null);
          }
        }
      }

      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      resizeObs.disconnect();
      soundEngine.stopAmbientMusic();
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvasEl.removeEventListener('pointerdown', handlePointerDown);
      canvasEl.removeEventListener('pointerup', handlePointerUp);
      canvasEl.removeEventListener('pointermove', handlePointerMove);
      canvasEl.removeEventListener('webglcontextlost', onContextLost);
      canvasEl.removeEventListener('webglcontextrestored', onContextRestored);
      orbit.dispose();
      pointerLock.dispose();

      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => mat.dispose());
        }
      });
      renderer.dispose();
    };
  }, []);

  // Zone Teleport handler
  const irAZona = (zoneId: string) => {
    ensureAudioAwake();
    const zone = SHOWROOM_ZONES.find((z) => z.id === zoneId);
    if (!zone) return;
    setActiveZoneId(zoneId);
    if (navMode === 'walk') {
      pointerLockRef.current?.unlock();
      setNavMode('explore');
    }
    cameraGlideRef.current.camPos.set(...zone.cameraPos);
    cameraGlideRef.current.targetPos.set(...zone.targetPos);
    cameraGlideRef.current.active = true;
    soundEngine.playFootstep();
  };

  // Switch between Explore and FPS Walk
  const toggleNavMode = (mode: NavMode) => {
    ensureAudioAwake();
    setNavMode(mode);
    if (mode === 'walk') {
      setRotatePieceMode(false);
      setAutoSpinPiece(false);
      cameraGlideRef.current.active = false;
      if (cameraRef.current) {
        cameraRef.current.position.y = 1.68;
      }
      pointerLockRef.current?.lock();
    } else {
      if (pointerLockRef.current?.isLocked) {
        pointerLockRef.current.unlock();
      }
      if (cameraRef.current && orbitRef.current) {
        cameraRef.current.getWorldDirection(_vecA);
        orbitRef.current.target
          .copy(cameraRef.current.position)
          .addScaledVector(_vecA, 3.5);
        orbitRef.current.update();
      }
    }
  };

  // Zoom Camera smoothly toward or away from target
  const handleZoomStep = (direction: 'in' | 'out') => {
    const cam = cameraRef.current;
    const orbit = orbitRef.current;
    if (!cam || !orbit) return;
    cameraGlideRef.current.active = false;
    _vecA.subVectors(cam.position, orbit.target);
    const dist = _vecA.length();
    const nextDist = THREE.MathUtils.clamp(
      direction === 'in' ? dist * 0.78 : dist * 1.25,
      showMuebleCard ? 0.9 : 1.3,
      14.0
    );
    _vecA.normalize().multiplyScalar(nextDist);
    cam.position.copy(orbit.target).add(_vecA);
    orbit.update();
    soundEngine.playRotateTick();
  };

  // Rotate selected 3D furniture piece freely
  const rotateSelectedPiece = (deltaRad: number) => {
    setAutoSpinPiece(false);
    targetRotationYRef.current[selectedMuebleKey] =
      (targetRotationYRef.current[selectedMuebleKey] ?? 0) + deltaRad;
    soundEngine.playRotateTick();
  };

  const resetSelectedPieceRotation = () => {
    setAutoSpinPiece(false);
    const item = MUEBLES_SHOWROOM[selectedMuebleKey];
    if (item) {
      targetRotationYRef.current[selectedMuebleKey] = item.rotationY;
      soundEngine.playWoodTap();
    }
  };

  // Lighting presets
  const cambiarTonoLuz = (tono: LightTone) => {
    setCurrentTone(tono);
    const { hemiLight, keyLight, fillLight, spot1, spot2, spot3, spot4, spot5, emissiveBulbs } =
      lightsRef.current;
    if (!hemiLight || !keyLight || !fillLight || !spot1 || !spot2 || !spot3) return;

    if (tono === 'dia') {
      hemiLight.color.setHex(0xfff7ed);
      hemiLight.intensity = 0.85;
      keyLight.color.setHex(0xffedd5);
      keyLight.intensity = 1.85;
      fillLight.intensity = 0.45;
      spot1.intensity = 2.2;
      spot2.intensity = 2.2;
      spot3.intensity = 1.8;
      if (spot4) spot4.intensity = 2.0;
      if (spot5) spot5.intensity = 2.0;
      if (rendererRef.current) rendererRef.current.toneMappingExposure = 1.12;
      emissiveBulbs?.forEach((b) => (b.emissiveIntensity = 1.0));
    } else if (tono === 'tarde') {
      hemiLight.color.setHex(0xffedd5);
      hemiLight.intensity = 0.65;
      keyLight.color.setHex(0xfb923c);
      keyLight.intensity = 2.15;
      fillLight.intensity = 0.35;
      spot1.intensity = 2.5;
      spot2.intensity = 2.5;
      spot3.intensity = 2.2;
      if (spot4) spot4.intensity = 2.4;
      if (spot5) spot5.intensity = 2.4;
      if (rendererRef.current) rendererRef.current.toneMappingExposure = 1.06;
      emissiveBulbs?.forEach((b) => (b.emissiveIntensity = 1.8));
    } else {
      hemiLight.color.setHex(0x1e3a8a);
      hemiLight.intensity = 0.34;
      keyLight.color.setHex(0x93c5fd);
      keyLight.intensity = 0.55;
      fillLight.intensity = 0.25;
      spot1.intensity = 4.0;
      spot2.intensity = 4.0;
      spot3.intensity = 3.6;
      if (spot4) spot4.intensity = 3.8;
      if (spot5) spot5.intensity = 3.8;
      if (rendererRef.current) rendererRef.current.toneMappingExposure = 1.02;
      emissiveBulbs?.forEach((b) => (b.emissiveIntensity = 3.0));
    }
  };

  // Wall & Atmosphere theme
  const cambiarAmbiente = (tema: WallTheme) => {
    setWallTheme(tema);
    const scene = sceneRef.current;
    if (!scene) return;

    const wallColorMap: Record<WallTheme, number> = {
      azul: 0x16243b,
      claro: 0xf1ece2,
      madera: 0x3b2314,
    };
    const bgHexMap: Record<WallTheme, number> = {
      azul: 0x0b1320,
      claro: 0xf4efe6,
      madera: 0x24140a,
    };

    scene.background = new THREE.Color(bgHexMap[tema]);
    if (scene.fog) scene.fog.color.setHex(bgHexMap[tema]);

    lightsRef.current.wallMeshes?.forEach((w) => {
      (w.material as THREE.MeshStandardMaterial).color.setHex(wallColorMap[tema]);
    });
  };

  // Live wood finish change on selected furniture
  const handleSelectFinish = (finishId: WoodFinishId) => {
    const grp = furnitureMapRef.current[selectedMuebleKey];
    if (grp) {
      applyWoodFinishToFurniture(grp, finishId, maxAnisotropyRef.current);
      setPieceFinishes((prev) => ({ ...prev, [selectedMuebleKey]: finishId }));
      soundEngine.playWoodTap();
    }
  };

  // Toggle open/close doors, drawers or chair swivel
  const handleTogglePieceAction = () => {
    const grp = furnitureMapRef.current[selectedMuebleKey];
    if (!grp) return;
    grp.userData.isOpen = !grp.userData.isOpen;
    setIsPieceInteracted(Boolean(grp.userData.isOpen));
    soundEngine.playDrawerGlide(Boolean(grp.userData.isOpen));
  };

  const toggleMute = () => {
    const next = !muted;
    soundEngine.setMuted(next);
    setMuted(next);
    if (next) {
      setMusicOn(false);
    }
  };

  const toggleMusic = () => {
    if (muted) {
      soundEngine.setMuted(false);
      setMuted(false);
    }
    const active = soundEngine.toggleAmbientMusic();
    musicAutoStartedRef.current = true;
    setMusicOn(active);
  };

  const setWalkDirection = (
    dir: 'forward' | 'backward' | 'left' | 'right',
    pressed: boolean
  ) => {
    if (pressed) ensureAudioAwake();
    moveStateRef.current[dir] = pressed;
  };

  const handleAdjustDimension = (
    axis: keyof PieceDimensionsCm,
    rawValue: number,
    autoShowGuides = false
  ) => {
    const base = MUEBLES_SHOWROOM[selectedMuebleKey];
    if (!base) return;
    const bounds = getDimensionBounds(base);
    const nextVal = clampDimensionValue(rawValue, bounds[axis].min, bounds[axis].max);
    setPieceDims((prev) => ({
      ...prev,
      [selectedMuebleKey]: {
        ...prev[selectedMuebleKey],
        [axis]: nextVal,
      },
    }));
    if (autoShowGuides && !showDimensions3D) {
      setShowDimensions3D(true);
    }
  };

  const handleResetDimensions = () => {
    const base = MUEBLES_SHOWROOM[selectedMuebleKey];
    if (!base) return;
    setPieceDims((prev) => ({
      ...prev,
      [selectedMuebleKey]: {
        alto: base.alto_cm,
        ancho: base.ancho_cm,
        prof: base.profundidad_cm,
      },
    }));
    soundEngine.playWoodTap();
  };

  const focusNameSignIn3D = () => {
    ensureAudioAwake();
    if (navMode === 'walk') {
      pointerLockRef.current?.unlock();
      setNavMode('explore');
    }
    cameraGlideRef.current.camPos.set(-0.2, 2.55, -3.5);
    cameraGlideRef.current.targetPos.set(-0.2, 3.25, -8.72);
    cameraGlideRef.current.active = true;
    soundEngine.playChime();
  };

  const handleApplyCustomName = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleaned = draftName3D.trim();
    setCustomName3D(cleaned);
    soundEngine.playChime();
    focusNameSignIn3D();
  };

  const muebleActual = MUEBLES_SHOWROOM[selectedMuebleKey] || MUEBLES_SHOWROOM.ropero;
  const activeFinishId = pieceFinishes[selectedMuebleKey] || muebleActual.defaultFinish;
  const activeFinish = WOOD_FINISHES[activeFinishId];
  const currentDims = pieceDims[selectedMuebleKey] || {
    alto: muebleActual.alto_cm,
    ancho: muebleActual.ancho_cm,
    prof: muebleActual.profundidad_cm,
  };
  const dimBounds = getDimensionBounds(muebleActual);
  const adjustedPricing = calculateAdjustedPriceBs(
    muebleActual,
    activeFinishId,
    currentDims.alto,
    currentDims.ancho,
    currentDims.prof
  );

  return (
    <div className="relative w-full h-full overflow-hidden bg-stone-900 select-none">
      {/* Dedicated WebGL Mount */}
      <div ref={mountRef} className="w-full h-full" />

      {/* WebGL Context Lost Recovery */}
      {contextLost && (
        <div className="absolute inset-0 z-50 bg-stone-950 flex flex-col items-center justify-center text-stone-100 p-6 text-center">
          <p className="text-lg font-serif-brand font-semibold">
            Reiniciando motor gráfico 3D...
          </p>
          <p className="text-sm text-stone-400 mt-1">
            Restaurando iluminación y texturas del showroom.
          </p>
        </div>
      )}

      {/* FPS Pointer Lock Resume Banner */}
      {navMode === 'walk' && !isPointerLocked && !showDonTeofiloModal && !showMariaModal && !floatingQuoteOpen && (
        <div className="absolute inset-0 z-30 bg-stone-950/75 flex items-center justify-center p-6">
          <div className="max-w-sm w-full bg-stone-900 border border-stone-700 p-7 rounded-2xl text-stone-100 text-center shadow-2xl">
            <Footprints className="w-10 h-10 text-amber-400 mx-auto mb-3" />
            <h3 className="text-xl font-serif-brand font-semibold mb-2">
              Modo Caminata en Primera Persona
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed mb-5">
              Camina por la tienda usando W, A, S, D (Shift para acelerar), Espacio para saltar y clic para abrir muebles o hablar con asesores.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => pointerLockRef.current?.lock()}
                className="w-full py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition-colors cursor-pointer"
              >
                Comenzar a Caminar
              </button>
              <button
                onClick={() => toggleNavMode('explore')}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 font-medium text-xs transition-colors cursor-pointer"
              >
                Volver a Modo Explorar (Órbita Libre)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crosshair only during locked FPS walk */}
      {navMode === 'walk' && isPointerLocked && (
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-20">
          <div className="w-2.5 h-2.5 rounded-full border-2 border-amber-300 bg-stone-950/60" />
        </div>
      )}

      {/* Top-Left Custom 3D Carpentry Name Sign Control */}
      <div className="absolute top-3.5 left-3.5 z-25 max-w-[92vw]">
        {!nameEditorExpanded ? (
          <button
            type="button"
            onClick={() => {
              setDraftName3D(customName3D);
              setNameEditorExpanded(true);
            }}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-stone-950/92 hover:bg-stone-900 border border-amber-500/50 text-stone-100 text-xs font-medium shadow-xl cursor-pointer transition-colors"
          >
            <PenLine className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span>
              {customName3D.trim()
                ? `Carpintería en 3D: ${customName3D}`
                : 'Carpintería Mueblería Modes · Editar nombre 3D'}
            </span>
          </button>
        ) : (
          <form
            onSubmit={handleApplyCustomName}
            className="bg-stone-950/95 border border-amber-500/50 rounded-2xl p-3 shadow-2xl text-stone-100 w-[315px] space-y-2"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5" />
                <span>Nombre de la Carpintería en 3D</span>
              </span>
              <button
                type="button"
                onClick={() => setNameEditorExpanded(false)}
                aria-label="Cerrar editor de nombre"
                className="text-stone-400 hover:text-white p-0.5 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              maxLength={34}
              placeholder="Ej. Carpintería Mueblería Modes"
              value={draftName3D}
              onChange={(e) => setDraftName3D(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-stone-900 border border-stone-700 text-xs text-white placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-semibold cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Grabar en 3D</span>
              </button>
              <button
                type="button"
                onClick={focusNameSignIn3D}
                className="py-1.5 px-2.5 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-medium cursor-pointer"
              >
                Ver Letrero
              </button>
              {customName3D.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    setDraftName3D('');
                    setCustomName3D('');
                    soundEngine.playWoodTap();
                  }}
                  title="Restablecer a Carpintería Mueblería Modes"
                  className="py-1.5 px-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-stone-400 hover:text-white text-[11px] cursor-pointer"
                >
                  Rest.
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* On-Screen Walk D-Pad & Zoom Controls (Bottom-Left inside 3D viewport) */}
      {!dockCollapsed && navMode === 'explore' && (
        <div className="hidden md:flex absolute bottom-24 left-4 z-20 flex-col items-center gap-1.5 bg-stone-950/90 border border-stone-700 p-2 rounded-2xl shadow-xl text-stone-200">
          <button
            onPointerDown={() => setWalkDirection('forward', true)}
            onPointerUp={() => setWalkDirection('forward', false)}
            onPointerLeave={() => setWalkDirection('forward', false)}
            title="Caminar adelante (W)"
            aria-label="Caminar adelante"
            className="w-8 h-8 rounded-lg bg-stone-900 hover:bg-amber-700 border border-stone-700 flex items-center justify-center cursor-pointer"
          >
            <ArrowUp className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5">
            <button
              onPointerDown={() => setWalkDirection('left', true)}
              onPointerUp={() => setWalkDirection('left', false)}
              onPointerLeave={() => setWalkDirection('left', false)}
              title="Paso izquierda (A)"
              aria-label="Paso izquierda"
              className="w-8 h-8 rounded-lg bg-stone-900 hover:bg-amber-700 border border-stone-700 flex items-center justify-center cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <button
              onPointerDown={() => setWalkDirection('backward', true)}
              onPointerUp={() => setWalkDirection('backward', false)}
              onPointerLeave={() => setWalkDirection('backward', false)}
              title="Caminar atrás (S)"
              aria-label="Caminar atrás"
              className="w-8 h-8 rounded-lg bg-stone-900 hover:bg-amber-700 border border-stone-700 flex items-center justify-center cursor-pointer"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
            <button
              onPointerDown={() => setWalkDirection('right', true)}
              onPointerUp={() => setWalkDirection('right', false)}
              onPointerLeave={() => setWalkDirection('right', false)}
              title="Paso derecha (D)"
              aria-label="Paso derecha"
              className="w-8 h-8 rounded-lg bg-stone-900 hover:bg-amber-700 border border-stone-700 flex items-center justify-center cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1.5 pt-1 border-t border-stone-800 w-full justify-center">
            <button
              onClick={() => handleZoomStep('in')}
              title="Acercar Zoom"
              aria-label="Acercar Zoom"
              className="w-8 h-7 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-center cursor-pointer"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleZoomStep('out')}
              title="Alejar Zoom"
              aria-label="Alejar Zoom"
              className="w-8 h-7 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 flex items-center justify-center cursor-pointer"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Hover / Crosshair Hint Toast above Bottom Dock */}
      {hoveredLabel && (
        <div
          className={`absolute left-1/2 -translate-x-1/2 z-20 pointer-events-none transition-all duration-150 ${
            dockCollapsed ? 'bottom-16' : 'bottom-28'
          }`}
        >
          <div className="bg-stone-950/92 text-stone-100 border border-stone-700 px-3.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shadow-lg">
            {hoveredLabel}
          </div>
        </div>
      )}

      {/* Product Detail & 360° Inspection Panel (Right Side — only when a piece is clicked) */}
      {showMuebleCard && muebleActual && (
        <aside className="absolute top-4 right-4 z-25 w-[92vw] max-w-[370px] max-h-[calc(100%-130px)] overflow-y-auto bg-[#fbf8f3] border border-stone-200 rounded-2xl p-5 shadow-2xl text-stone-800">
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
            <div className="min-w-0">
              <div className="text-[11px] font-medium text-stone-500 flex items-center gap-1.5 flex-wrap">
                <span>{muebleActual.categoria}</span>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 font-semibold">
                  Stock Oruro: {stockByKey?.[muebleActual.key] ?? muebleActual.stock} u.
                </span>
              </div>
              <h3 className="font-serif-brand font-semibold text-lg text-slate-900 mt-1 leading-snug">
                {muebleActual.nombre}
              </h3>
              <div className="font-mono-data text-base font-semibold text-amber-800 mt-1 flex flex-wrap items-baseline gap-x-2">
                <span>Bs. {adjustedPricing.precioBs.toLocaleString('es-BO')}</span>
                <span className="text-xs font-normal text-stone-500">
                  (Anticipo 50%: Bs. {adjustedPricing.anticipoBs.toLocaleString('es-BO')})
                </span>
                {adjustedPricing.isCustomSize && (
                  <span className="text-[10px] font-sans font-semibold text-amber-900 bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded-md">
                    Medida ajustada
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => {
                setShowMuebleCard(false);
                setShowDimensions3D(false);
                setRotatePieceMode(false);
                setAutoSpinPiece(false);
                if (selectionRingRef.current) selectionRingRef.current.visible = false;
              }}
              aria-label="Cerrar ficha técnica"
              className="text-stone-400 hover:text-stone-800 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-stone-600 leading-relaxed mt-3">
            {muebleActual.descripcion}
          </p>

          {/* 360° Free Product Rotation & Zoom Controls */}
          <div className="mt-3.5 p-3 rounded-xl bg-stone-50 border border-stone-200">
            <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700 mb-2">
              <span>Inspección 360° y Zoom</span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleZoomStep('in')}
                  title="Acercar zoom al producto"
                  className="p-1 rounded-md bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleZoomStep('out')}
                  title="Alejar zoom del producto"
                  className="p-1 rounded-md bg-white border border-stone-200 hover:bg-stone-100 text-stone-700 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-1.5">
              <button
                onClick={() => rotateSelectedPiece(-Math.PI / 4)}
                title="Rotar 45° a la izquierda"
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-xs font-medium text-stone-700 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>45°</span>
              </button>
              <button
                onClick={() => setRotatePieceMode((prev) => !prev)}
                title="Arrastra en la escena para girar el mueble libremente (R)"
                className={`col-span-2 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg border text-xs font-semibold cursor-pointer transition-colors whitespace-nowrap ${
                  rotatePieceMode
                    ? 'bg-amber-800 text-white border-amber-900'
                    : 'bg-white hover:bg-stone-100 text-stone-800 border-stone-200'
                }`}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{rotatePieceMode ? 'Rotando (Arrastra)' : 'Rotar Libre (R)'}</span>
              </button>
              <button
                onClick={() => rotateSelectedPiece(Math.PI / 4)}
                title="Rotar 45° a la derecha"
                className="flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-white hover:bg-stone-100 border border-stone-200 text-xs font-medium text-stone-700 cursor-pointer"
              >
                <span>45°</span>
                <RotateCw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 mt-2">
              <button
                onClick={() => setAutoSpinPiece((prev) => !prev)}
                className={`flex-1 py-1.5 px-2 rounded-lg text-[11px] font-medium border cursor-pointer transition-colors ${
                  autoSpinPiece
                    ? 'bg-stone-900 text-amber-300 border-stone-900'
                    : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-100'
                }`}
              >
                {autoSpinPiece ? 'Detener Giro 360°' : 'Giro Automático 360°'}
              </button>
              <button
                onClick={resetSelectedPieceRotation}
                className="py-1.5 px-2.5 rounded-lg text-[11px] font-medium bg-white text-stone-600 border border-stone-200 hover:bg-stone-100 cursor-pointer"
              >
                Restablecer
              </button>
            </div>
          </div>

          {/* Interactive 3D Actions (Open doors/drawers + 3D dimensions) */}
          <div className="grid grid-cols-2 gap-2 mt-3">
            <button
              onClick={handleTogglePieceAction}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                isPieceInteracted
                  ? 'bg-amber-800 text-white border-amber-900'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                {isPieceInteracted
                  ? 'Cerrar / Restablecer'
                  : muebleActual.interactiveActionLabel || 'Interactuar (E)'}
              </span>
            </button>

            <button
              onClick={() => {
                setShowDimensions3D((prev) => !prev);
                soundEngine.playWoodTap();
              }}
              className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                showDimensions3D
                  ? 'bg-stone-900 text-amber-300 border-stone-900'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-800 border-stone-200'
              }`}
            >
              <Ruler className="w-3.5 h-3.5 shrink-0" />
              <span>{showDimensions3D ? 'Ocultar Cotas 3D' : 'Ver Cotas 3D'}</span>
            </button>
          </div>

          {/* Live Wood Finish Customizer */}
          {selectedMuebleKey !== 'sillon' && (
            <div className="mt-4 pt-3 border-t border-stone-200">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="font-semibold text-stone-800">Acabado en tiempo real</span>
                <span className="text-stone-500">{activeFinish.label}</span>
              </div>
              <div className="flex items-center gap-2">
                {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                  const preset = WOOD_FINISHES[fid];
                  const active = activeFinishId === fid;
                  return (
                    <button
                      key={fid}
                      onClick={() => handleSelectFinish(fid)}
                      title={preset.label}
                      className={`flex-1 py-1.5 px-1 rounded-lg border text-[11px] font-medium transition-all cursor-pointer flex flex-col items-center gap-1 ${
                        active
                          ? 'border-amber-800 bg-amber-50 text-amber-950 font-semibold'
                          : 'border-stone-200 bg-white hover:bg-stone-50 text-stone-600'
                      }`}
                    >
                      <span
                        className="w-4 h-4 rounded-full border border-black/20"
                        style={{ backgroundColor: preset.swatchHex }}
                      />
                      <span>{preset.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Live Interactive Dimensions Editor (Scales 3D model + guides + price in real time) */}
          <div className="mt-4 pt-3 border-t border-stone-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-stone-800">
                <Ruler className="w-3.5 h-3.5 text-amber-800" />
                <span>Ajustar medidas en vivo (cm)</span>
              </div>
              {adjustedPricing.isCustomSize && (
                <button
                  type="button"
                  onClick={handleResetDimensions}
                  className="text-[11px] font-medium text-amber-800 hover:text-amber-950 underline cursor-pointer"
                >
                  Restablecer ({muebleActual.alto_cm}×{muebleActual.ancho_cm}×{muebleActual.profundidad_cm})
                </button>
              )}
            </div>

            {(
              [
                {
                  axis: 'alto' as const,
                  label: 'Alto',
                  value: currentDims.alto,
                  min: dimBounds.alto.min,
                  max: dimBounds.alto.max,
                },
                {
                  axis: 'ancho' as const,
                  label: 'Ancho',
                  value: currentDims.ancho,
                  min: dimBounds.ancho.min,
                  max: dimBounds.ancho.max,
                },
                {
                  axis: 'prof' as const,
                  label: 'Profundidad',
                  value: currentDims.prof,
                  min: dimBounds.prof.min,
                  max: dimBounds.prof.max,
                },
              ]
            ).map((dim) => (
              <div
                key={dim.axis}
                className="bg-stone-50 border border-stone-200 rounded-xl px-2.5 py-2 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-stone-700">{dim.label}</span>
                  <div className="flex items-center gap-1 font-mono-data">
                    <button
                      type="button"
                      aria-label={`Disminuir ${dim.label}`}
                      onClick={() => handleAdjustDimension(dim.axis, dim.value - 5, true)}
                      className="w-6 h-6 rounded-md bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-stone-700 cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={dim.min}
                      max={dim.max}
                      value={dim.value}
                      onChange={(e) => {
                        const parsed = Number(e.target.value);
                        if (!Number.isNaN(parsed)) {
                          handleAdjustDimension(dim.axis, parsed, true);
                        }
                      }}
                      className="w-14 text-center py-0.5 px-1 rounded-md border border-stone-300 bg-white text-xs font-semibold text-slate-900"
                    />
                    <button
                      type="button"
                      aria-label={`Aumentar ${dim.label}`}
                      onClick={() => handleAdjustDimension(dim.axis, dim.value + 5, true)}
                      className="w-6 h-6 rounded-md bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-stone-700 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <span className="text-[11px] text-stone-500 ml-0.5">cm</span>
                  </div>
                </div>
                <input
                  type="range"
                  min={dim.min}
                  max={dim.max}
                  value={dim.value}
                  onChange={(e) =>
                    handleAdjustDimension(dim.axis, Number(e.target.value), true)
                  }
                  className="w-full h-1.5 accent-amber-800 cursor-pointer"
                />
              </div>
            ))}
          </div>

          {/* Primary Storefront CTAs */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <button
              onClick={() =>
                onComprarMueble?.(
                  muebleActual,
                  activeFinishId,
                  adjustedPricing.customDimsLabel,
                  adjustedPricing.precioBs
                )
              }
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-stone-900 hover:bg-stone-800 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <ShoppingBag className="w-3.5 h-3.5 shrink-0 text-amber-300" />
              <span>Añadir a Bolsa</span>
            </button>
            <button
              onClick={() =>
                onAcquireMueble?.(
                  muebleActual,
                  activeFinishId,
                  adjustedPricing.customDimsLabel,
                  adjustedPricing.precioBs
                )
              }
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-colors cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Adquirir Ahora</span>
            </button>
          </div>
          <button
            onClick={() => setFloatingQuoteOpen(true)}
            className="mt-2 w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-900 border border-stone-300 font-semibold text-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            <Ruler className="w-3.5 h-3.5 text-amber-800 shrink-0" />
            <span>Cotizar a Medida (Flotante)</span>
          </button>
        </aside>
      )}

      {/* Floating Proximity Card when approaching Don Teófilo in 3D */}
      {nearDonTeofilo && !floatingQuoteOpen && !showDonTeofiloModal && (
        <div className="absolute top-16 left-3.5 z-25 bg-stone-950/95 border border-amber-500/70 rounded-2xl p-3.5 shadow-2xl text-stone-100 max-w-[300px] space-y-2.5">
          <div className="flex items-center gap-2.5">
            <img
              src={donTeofiloImg}
              alt="Don Teófilo"
              referrerPolicy="no-referrer"
              className="w-10 h-10 rounded-full object-cover border-2 border-amber-500 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-amber-300">
                Don Teófilo · Taller a Medida
              </div>
              <div className="text-[11px] text-stone-300">
                ¿Deseas cotizar un mueble a tu medida aquí mismo?
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              if (pointerLockRef.current?.isLocked) {
                pointerLockRef.current.unlock();
              }
              setFloatingQuoteOpen(true);
            }}
            className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Abrir Cotización a Medida (Flotante)</span>
          </button>
        </div>
      )}

      {/* Collapsible Unified Bottom Control Dock */}
      <div
        className={`absolute left-1/2 -translate-x-1/2 z-20 transition-transform duration-300 ease-out w-[94%] max-w-[1020px] ${
          dockCollapsed ? 'bottom-3 translate-y-[calc(100%-36px)]' : 'bottom-4 translate-y-0'
        }`}
      >
        {/* Collapse / Expand Tab */}
        <div className="flex justify-center mb-1.5">
          <button
            onClick={() => setDockCollapsed((prev) => !prev)}
            className="flex items-center gap-1.5 px-3.5 py-1 rounded-t-xl bg-stone-950/92 text-stone-200 hover:text-white border border-b-0 border-stone-700 text-[11px] font-medium cursor-pointer"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Mostrar Controles (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Ocultar Controles (H)</span>
              </>
            )}
          </button>
        </div>

        {/* Dock Body */}
        <div className="bg-stone-950/92 border border-stone-700/90 rounded-2xl px-3.5 py-2.5 shadow-2xl text-stone-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* Showroom Zone Shortcuts */}
          <div className="flex items-center gap-1 overflow-x-auto max-w-full">
            <Compass className="w-3.5 h-3.5 text-amber-400 mr-1 shrink-0" />
            {SHOWROOM_ZONES.map((z) => (
              <button
                key={z.id}
                onClick={() => irAZona(z.id)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  activeZoneId === z.id
                    ? 'bg-amber-700 text-white'
                    : 'bg-stone-900 text-stone-300 hover:bg-stone-800 hover:text-white'
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          {/* Right Controls Cluster */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Navigation Mode Toggle */}
            <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
              <button
                onClick={() => toggleNavMode('explore')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  navMode === 'explore'
                    ? 'bg-stone-700 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Explorar</span>
              </button>
              <button
                onClick={() => toggleNavMode('walk')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  navMode === 'walk'
                    ? 'bg-amber-700 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>Caminar FPS</span>
              </button>
            </div>

            {/* Lighting Presets */}
            <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
              <button
                onClick={() => cambiarTonoLuz('dia')}
                title="Iluminación Día"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap ${
                  currentTone === 'dia'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Día</span>
              </button>
              <button
                onClick={() => cambiarTonoLuz('tarde')}
                title="Iluminación Tarde"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap ${
                  currentTone === 'tarde'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Sunset className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tarde</span>
              </button>
              <button
                onClick={() => cambiarTonoLuz('noche')}
                title="Iluminación Noche"
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap ${
                  currentTone === 'noche'
                    ? 'bg-amber-600 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Noche</span>
              </button>
            </div>

            {/* Wall / Atmosphere Tone */}
            <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
              {(
                [
                  { id: 'azul', label: 'Azul Marino' },
                  { id: 'claro', label: 'Galería' },
                  { id: 'madera', label: 'Caoba' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => cambiarAmbiente(t.id)}
                  className={`px-2 py-1 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap ${
                    wallTheme === t.id
                      ? 'bg-slate-700 text-amber-300 font-semibold'
                      : 'text-stone-400 hover:text-white'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Ambient Music & SFX Audio Controls */}
            <div className="flex items-center bg-stone-900 p-0.5 rounded-lg border border-stone-800">
              <button
                onClick={toggleMusic}
                title={musicOn ? 'Pausar música ambiental' : 'Reproducir música ambiental'}
                className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs cursor-pointer transition-colors whitespace-nowrap ${
                  musicOn && !muted
                    ? 'bg-emerald-700 text-white'
                    : 'text-stone-400 hover:text-white'
                }`}
              >
                <Music className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Música</span>
              </button>
              <button
                onClick={toggleMute}
                aria-label={muted ? 'Activar audio' : 'Silenciar audio'}
                title={muted ? 'Activar audio' : 'Silenciar audio'}
                className="p-1.5 rounded-md text-stone-300 hover:text-white cursor-pointer"
              >
                {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
            </div>

            {onGoToPanel && (
              <button
                onClick={onGoToPanel}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-white text-stone-900 text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-amber-800" />
                <span>Catálogo</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Don Teófilo (Maestro Artesano) */}
      {showDonTeofiloModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-[#fbf8f3] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-stone-800">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-3.5">
                <img
                  src={donTeofiloImg}
                  alt="Don Teófilo, Maestro Artesano de Mueblería Modes en Oruro"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-amber-600 shadow-sm shrink-0 bg-amber-100"
                />
                <div>
                  <h3 className="font-serif-brand font-semibold text-lg text-slate-900">
                    Don Teófilo · Maestro Artesano
                  </h3>
                  <p className="text-xs text-stone-500">Carpintería Fina · Oruro, Bolivia</p>
                </div>
              </div>
              <button
                onClick={() => setShowDonTeofiloModal(false)}
                aria-label="Cerrar diálogo de Don Teófilo"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-600 my-4 leading-relaxed">
              &ldquo;Bienvenido al taller. Aquí trabajamos Mara, Cedro, Roble y Tajibo secos al natural. Si necesita un ropero o comedor con medidas exactas para su hogar en Oruro, lo calculamos y registramos su cotización ahora mismo.&rdquo;
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setShowDonTeofiloModal(false);
                  setFloatingQuoteOpen(true);
                }}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
              >
                Cotización a Medida (Flotante)
              </button>
              <button
                onClick={() => setShowDonTeofiloModal(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
              >
                Seguir en 3D
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: María Paredes (Asesora Comercial) */}
      {showMariaModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
          <div className="bg-[#fbf8f3] rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 text-stone-800">
            <div className="flex items-center justify-between pb-4 border-b border-stone-200">
              <div className="flex items-center gap-3.5">
                <img
                  src={mariaAsesoraImg}
                  alt="María Paredes, Asesora Comercial de Mueblería Modes en Oruro"
                  referrerPolicy="no-referrer"
                  className="w-14 h-14 rounded-full object-cover border-2 border-slate-800 shadow-sm shrink-0 bg-slate-200"
                />
                <div>
                  <h3 className="font-serif-brand font-semibold text-lg text-slate-900">
                    María Paredes · Asesora Comercial
                  </h3>
                  <p className="text-xs text-stone-500">Atención en Showroom &amp; Despachos Oruro</p>
                </div>
              </div>
              <button
                onClick={() => setShowMariaModal(false)}
                aria-label="Cerrar diálogo de María Paredes"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-stone-600 my-4 leading-relaxed">
              &ldquo;Con gusto le confirmo disponibilidad inmediata en Oruro, envíos a domicilio o reservas con el 50% de anticipo mediante QR Simple o transferencia.&rdquo;
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowMariaModal(false);
                  onOpenAiAssistant?.();
                }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer"
              >
                <Bot className="w-4 h-4" />
                <span>Chat Asistente IA</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMariaModal(false);
                  onWhatsAppAlert?.(
                    'Contacto Directo · María Paredes',
                    'Escríbenos o llámanos al +591 72418920 en Oruro para confirmar disponibilidad inmediata, envíos a domicilio o reservas con el 50% de anticipo.'
                  );
                }}
                className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>WhatsApp</span>
              </button>
              <button
                onClick={() => setShowMariaModal(false)}
                className="py-2.5 px-3 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ventana Flotante de Cotización a Medida sin salir del Showroom 3D */}
      <FloatingCotizacionModal
        open={floatingQuoteOpen}
        sourceLabel="Don Teófilo · Cotización a Medida en 3D"
        initialModelKey={selectedMuebleKey}
        initialFinishId={activeFinishId}
        clientes={clientes}
        onClose={() => setFloatingQuoteOpen(false)}
        onSuccess={() => {
          setFloatingQuoteOpen(false);
          onQuoteCreated?.();
          onGoToPedidos?.();
        }}
        onViewInShowroom3D={(key, fid, dims) => {
          setFloatingQuoteOpen(false);
          if (key !== 'sillon' && furnitureMapRef.current[key]) {
            applyWoodFinishToFurniture(
              furnitureMapRef.current[key]!,
              fid,
              maxAnisotropyRef.current
            );
            setPieceFinishes((prev) => ({ ...prev, [key]: fid }));
          }
          const base = MUEBLES_SHOWROOM[key];
          const b = getDimensionBounds(base);
          setPieceDims((prev) => ({
            ...prev,
            [key]: {
              alto: clampDimensionValue(dims.alto, b.alto.min, b.alto.max),
              ancho: clampDimensionValue(dims.ancho, b.ancho.min, b.ancho.max),
              prof: clampDimensionValue(dims.prof, b.prof.min, b.prof.max),
            },
          }));
          setNavMode('explore');
          focusFurniture(key);
        }}
      />
    </div>
  );
}
