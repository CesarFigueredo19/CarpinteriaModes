import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import {
  Box,
  DoorOpen,
  ExternalLink,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  RotateCcw,
  RotateCw,
  Ruler,
  X,
} from 'lucide-react';
import {
  BaseModel3DKey,
  MUEBLES_SHOWROOM,
  WOOD_FINISHES,
  WoodFinishId,
} from '../data/catalog';
import {
  applyWoodFinishToFurniture,
  buildDimensionGuides,
  buildFurnitureByKey,
} from '../utils/furnitureModels';
import { clampDimensionValue, getDimensionBounds } from '../utils/pricing';
import { PieceDimensionsCm } from './Tienda3D';

interface FloatingQuote3DPreviewProps {
  open: boolean;
  onToggleOpen: (next: boolean) => void;
  modelKey: BaseModel3DKey;
  finishId: WoodFinishId;
  onChangeFinish: (fid: WoodFinishId) => void;
  altoCm: number;
  anchoCm: number;
  profCm: number;
  onChangeAlto: (val: number) => void;
  onChangeAncho: (val: number) => void;
  onChangeProf: (val: number) => void;
  onResetDims: () => void;
  estimatedPriceBs: number;
  anticipoBs: number;
  zIndexClass?: string;
  onOpenInShowroom3D: (
    key: BaseModel3DKey,
    finishId: WoodFinishId,
    dims: PieceDimensionsCm
  ) => void;
}

function disposeThreeObject(root: THREE.Object3D, skipContactShadowTex = true) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    const matOrList = (mesh as THREE.Mesh | THREE.Line | THREE.Sprite).material;
    const mats = Array.isArray(matOrList) ? matOrList : matOrList ? [matOrList] : [];
    mats.forEach((m) => {
      if (!m) return;
      const anyMat = m as THREE.MeshStandardMaterial & {
        bumpMap?: THREE.Texture | null;
        roughnessMap?: THREE.Texture | null;
      };
      if (anyMat.map && !(skipContactShadowTex && obj.userData?.isContactShadow)) {
        anyMat.map.dispose();
      }
      if (anyMat.bumpMap) anyMat.bumpMap.dispose();
      if (anyMat.roughnessMap) anyMat.roughnessMap.dispose();
      m.dispose();
    });
  });
}

export function FloatingQuote3DPreview({
  open,
  onToggleOpen,
  modelKey,
  finishId,
  onChangeFinish,
  altoCm,
  anchoCm,
  profCm,
  onChangeAlto,
  onChangeAncho,
  onChangeProf,
  onResetDims,
  estimatedPriceBs,
  anticipoBs,
  zIndexClass = 'z-40',
  onOpenInShowroom3D,
}: FloatingQuote3DPreviewProps) {
  const baseItem = MUEBLES_SHOWROOM[modelKey] || MUEBLES_SHOWROOM.ropero;
  const bounds = getDimensionBounds(baseItem);
  const finishPreset = WOOD_FINISHES[finishId];

  const [expanded, setExpanded] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const [showGuides, setShowGuides] = useState(true);
  const [isOpenAnim, setIsOpenAnim] = useState(false);

  const canvasHostRef = useRef<HTMLDivElement>(null);
  const furnitureRef = useRef<THREE.Group | null>(null);
  const guidesRef = useRef<THREE.Group | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const maxAnisotropyRef = useRef(4);

  const liveDimsRef = useRef({ altoCm, anchoCm, profCm });
  liveDimsRef.current = { altoCm, anchoCm, profCm };

  const liveStateRef = useRef({
    modelKey,
    autoRotate,
    showGuides,
    isOpenAnim,
  });
  liveStateRef.current = { modelKey, autoRotate, showGuides, isOpenAnim };

  // Initialize Three.js Studio Preview ONLY when open
  useEffect(() => {
    if (!open || !canvasHostRef.current) return;
    const container = canvasHostRef.current;

    const initW = Math.max(container.clientWidth || 380, 260);
    const initH = Math.max(container.clientHeight || 250, 200);

    // Probe WebGL software fallback
    let isSoftwareGl = false;
    try {
      const probe = document.createElement('canvas');
      const gl =
        probe.getContext('webgl2') ||
        probe.getContext('webgl') ||
        probe.getContext('experimental-webgl');
      if (gl && 'getExtension' in gl) {
        const dbg = (gl as WebGLRenderingContext).getExtension('WEBGL_debug_renderer_info');
        if (dbg) {
          const rStr = String(
            (gl as WebGLRenderingContext).getParameter(dbg.UNMASKED_RENDERER_WEBGL) || ''
          ).toLowerCase();
          if (rStr.includes('swiftshader') || rStr.includes('llvmpipe') || rStr.includes('software')) {
            isSoftwareGl = true;
          }
        }
      }
    } catch {
      // ignore probe errors
    }

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      alpha: false,
    });
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(initW, initH);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    maxAnisotropyRef.current = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);

    container.innerHTML = '';
    renderer.domElement.style.display = 'block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf4efe6);
    sceneRef.current = scene;

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(42, initW / initH, 0.1, 40);
    camera.position.set(2.5, 1.85, 3.0);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 1.3;
    controls.maxDistance = 8.5;
    controls.target.set(0, 0.75, 0);
    controlsRef.current = controls;

    // Warm studio lighting
    const hemi = new THREE.HemisphereLight(0xfffbeb, 0xd6cfc2, 1.15);
    scene.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff5e4, 2.0);
    keyLight.position.set(4.5, 6.5, 4.2);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 18;
    keyLight.shadow.camera.left = -3;
    keyLight.shadow.camera.right = 3;
    keyLight.shadow.camera.top = 3;
    keyLight.shadow.camera.bottom = -3;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xe0f2fe, 0.85);
    rimLight.position.set(-4, 3.5, -3.5);
    scene.add(rimLight);

    // Studio floor & subtle radial ring pedestal
    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 2.68, 0.04, 48),
      new THREE.MeshStandardMaterial({
        color: 0xe6dccb,
        roughness: 0.85,
        metalness: 0.02,
      })
    );
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.92, 1.96, 64),
      new THREE.MeshBasicMaterial({
        color: 0xb45309,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.004;
    scene.add(ring);

    const grid = new THREE.GridHelper(4.8, 12, 0xc7bba7, 0xddd4c3);
    grid.position.y = 0.002;
    scene.add(grid);

    const resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width < 20 || height < 20) continue;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    });
    resizeObs.observe(container);

    let rafId = 0;
    let lastTime = performance.now();
    let frameAccumulator = 0;

    const tick = (now: number) => {
      rafId = requestAnimationFrame(tick);
      const dt = Math.min((now - lastTime) / 1000, 0.1);
      lastTime = now;

      if (isSoftwareGl) {
        frameAccumulator += dt;
        if (frameAccumulator < 1 / 24) return;
        frameAccumulator = 0;
      }

      const activeMesh = furnitureRef.current;
      if (activeMesh) {
        const refItem =
          MUEBLES_SHOWROOM[liveStateRef.current.modelKey] || MUEBLES_SHOWROOM.ropero;
        const dims = liveDimsRef.current;
        const targetSx = Math.max(0.45, Math.min(2.2, dims.anchoCm / refItem.ancho_cm));
        const targetSy = Math.max(0.45, Math.min(2.2, dims.altoCm / refItem.alto_cm));
        const targetSz = Math.max(0.45, Math.min(2.2, dims.profCm / refItem.profundidad_cm));

        activeMesh.scale.x = THREE.MathUtils.damp(activeMesh.scale.x, targetSx, 10, dt);
        activeMesh.scale.y = THREE.MathUtils.damp(activeMesh.scale.y, targetSy, 10, dt);
        activeMesh.scale.z = THREE.MathUtils.damp(activeMesh.scale.z, targetSz, 10, dt);

        activeMesh.userData.isOpen = liveStateRef.current.isOpenAnim;
        if (typeof activeMesh.userData.updateAnimation === 'function') {
          activeMesh.userData.updateAnimation(dt);
        }
      }

      controls.autoRotate = liveStateRef.current.autoRotate;
      controls.autoRotateSpeed = 1.65;
      controls.update();
      renderer.render(scene, camera);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      resizeObs.disconnect();
      controls.dispose();
      if (furnitureRef.current) {
        scene.remove(furnitureRef.current);
        disposeThreeObject(furnitureRef.current);
        furnitureRef.current = null;
      }
      if (guidesRef.current) {
        scene.remove(guidesRef.current);
        disposeThreeObject(guidesRef.current);
        guidesRef.current = null;
      }
      disposeThreeObject(scene);
      envTarget.dispose();
      renderer.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
    };
  }, [open, expanded]);

  // Swap 3D furniture model whenever modelKey changes while open
  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!open || !scene) return;

    if (furnitureRef.current) {
      scene.remove(furnitureRef.current);
      disposeThreeObject(furnitureRef.current);
      furnitureRef.current = null;
    }

    const mesh = buildFurnitureByKey(modelKey, finishId, maxAnisotropyRef.current);
    const refItem = MUEBLES_SHOWROOM[modelKey] || MUEBLES_SHOWROOM.ropero;
    mesh.scale.set(
      anchoCm / refItem.ancho_cm,
      altoCm / refItem.alto_cm,
      profCm / refItem.profundidad_cm
    );
    scene.add(mesh);
    furnitureRef.current = mesh;
    setIsOpenAnim(false);

    if (camera && controls) {
      const hM = Math.max(0.6, altoCm / 100);
      const wM = Math.max(0.8, anchoCm / 100);
      const dM = Math.max(0.6, profCm / 100);
      const radius = Math.max(wM, hM, dM);
      controls.target.set(0, hM * 0.48, 0);
      camera.position.set(radius * 1.15 + 0.9, hM * 0.85 + 0.65, radius * 1.35 + 1.0);
      controls.update();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expanded, modelKey]);

  // Swap wood finish live without rebuilding geometry
  useEffect(() => {
    if (!open || !furnitureRef.current) return;
    applyWoodFinishToFurniture(furnitureRef.current, finishId, maxAnisotropyRef.current);
  }, [open, expanded, finishId]);

  // Rebuild 3D architectural dimension guides live as dimensions change
  useEffect(() => {
    const scene = sceneRef.current;
    if (!open || !scene) return;

    if (guidesRef.current) {
      scene.remove(guidesRef.current);
      disposeThreeObject(guidesRef.current);
      guidesRef.current = null;
    }

    if (showGuides) {
      const g = buildDimensionGuides(anchoCm, altoCm, profCm);
      scene.add(g);
      guidesRef.current = g;
    }
  }, [open, expanded, showGuides, altoCm, anchoCm, profCm]);

  if (!open) {
    return null;
  }

  return (
    <aside
      aria-label="Visor 3D Flotante de Cotización a Medida"
      className={`fixed bottom-20 right-4 ${zIndexClass} bg-[#fbf8f3] border border-stone-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all ${
        expanded ? 'w-[min(95vw,660px)]' : 'w-[min(94vw,430px)]'
      }`}
    >
      {/* Top Bar */}
      <div className="px-4 py-2.5 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-amber-300 font-semibold">
            <Box className="w-3.5 h-3.5 shrink-0" />
            <span>Estudio 3D Flotante · A Medida</span>
          </div>
          <p className="text-xs font-serif-brand font-semibold text-white truncate">
            {baseItem.nombre}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            title={expanded ? 'Reducir ventana' : 'Ampliar ventana 3D'}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onToggleOpen(false)}
            title="Minimizar visor flotante"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Interactive 3D Viewport */}
      <div
        className={`relative w-full bg-[#f4efe6] border-b border-stone-200 select-none ${
          expanded ? 'h-80 sm:h-96' : 'h-60'
        }`}
      >
        <div ref={canvasHostRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top-left wood badge */}
        <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg bg-white/95 border border-stone-200 shadow-xs text-[11px] font-medium text-slate-800 flex items-center gap-1.5 pointer-events-none">
          <span
            className="w-2.5 h-2.5 rounded-full border border-black/20"
            style={{ backgroundColor: finishPreset.swatchHex }}
          />
          <span>{finishPreset.label}</span>
        </div>

        {/* Bottom Canvas Action Pills (solid surface, zero backdrop-filter) */}
        <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <button
              type="button"
              onClick={() => setIsOpenAnim((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border shadow-xs cursor-pointer ${
                isOpenAnim
                  ? 'bg-amber-800 text-white border-amber-900'
                  : 'bg-white text-slate-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <DoorOpen className="w-3.5 h-3.5" />
              <span>{isOpenAnim ? 'Cerrar' : 'Animar'}</span>
            </button>
            <button
              type="button"
              onClick={() => setShowGuides((v) => !v)}
              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border shadow-xs cursor-pointer ${
                showGuides
                  ? 'bg-slate-900 text-amber-300 border-slate-900'
                  : 'bg-white text-slate-800 border-stone-300 hover:bg-stone-50'
              }`}
            >
              <Ruler className="w-3.5 h-3.5" />
              <span>Cotas cm</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRotate((v) => !v)}
            className={`pointer-events-auto px-2.5 py-1.5 rounded-lg text-[11px] font-semibold flex items-center gap-1 border shadow-xs cursor-pointer ${
              autoRotate
                ? 'bg-amber-100 text-amber-950 border-amber-300'
                : 'bg-white text-stone-700 border-stone-300 hover:bg-stone-50'
            }`}
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>360°</span>
          </button>
        </div>
      </div>

      {/* Live Wood Swatches + Editable Dimensions */}
      <div className="p-3.5 space-y-3 bg-white max-h-[42vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-stone-600">Madera / Acabado</span>
          <div className="flex items-center gap-1.5">
            {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
              const p = WOOD_FINISHES[fid];
              const active = finishId === fid;
              return (
                <button
                  key={fid}
                  type="button"
                  onClick={() => onChangeFinish(fid)}
                  title={p.label}
                  className={`w-6 h-6 rounded-full border-2 cursor-pointer transition-transform ${
                    active ? 'border-slate-900 scale-110' : 'border-stone-300 hover:scale-105'
                  }`}
                  style={{ backgroundColor: p.swatchHex }}
                />
              );
            })}
          </div>
        </div>

        {/* Editable Dimensions in Real Time */}
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-800 flex items-center gap-1">
              <Ruler className="w-3.5 h-3.5 text-amber-800" />
              <span>Medidas Editables en Tiempo Real (cm)</span>
            </span>
            <button
              type="button"
              onClick={onResetDims}
              className="text-[11px] text-amber-800 hover:text-amber-950 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Estándar</span>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {[
              {
                label: 'Alto',
                val: altoCm,
                min: bounds.alto.min,
                max: bounds.alto.max,
                onChange: onChangeAlto,
              },
              {
                label: 'Ancho',
                val: anchoCm,
                min: bounds.ancho.min,
                max: bounds.ancho.max,
                onChange: onChangeAncho,
              },
              {
                label: 'Prof.',
                val: profCm,
                min: bounds.prof.min,
                max: bounds.prof.max,
                onChange: onChangeProf,
              },
            ].map((axis) => (
              <div key={axis.label} className="bg-white border border-stone-200 rounded-lg p-1.5 space-y-1">
                <div className="flex items-center justify-between text-[10px] text-stone-500">
                  <span className="font-semibold text-slate-700">{axis.label}</span>
                  <span className="font-mono-data">
                    {axis.min}-{axis.max}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    aria-label={`Reducir ${axis.label}`}
                    onClick={() => axis.onChange(clampDimensionValue(axis.val - 5, axis.min, axis.max))}
                    className="w-6 h-6 rounded border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={axis.min}
                    max={axis.max}
                    value={axis.val}
                    onChange={(e) => {
                      const raw = Number(e.target.value);
                      if (!Number.isNaN(raw)) {
                        axis.onChange(Math.max(10, Math.min(400, Math.round(raw))));
                      }
                    }}
                    onBlur={(e) => {
                      axis.onChange(
                        clampDimensionValue(Number(e.target.value) || axis.min, axis.min, axis.max)
                      );
                    }}
                    className="w-full min-w-0 text-center font-mono-data text-xs font-semibold text-slate-900 border border-stone-200 rounded py-0.5"
                  />
                  <button
                    type="button"
                    aria-label={`Aumentar ${axis.label}`}
                    onClick={() => axis.onChange(clampDimensionValue(axis.val + 5, axis.min, axis.max))}
                    className="w-6 h-6 rounded border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <input
                  type="range"
                  min={axis.min}
                  max={axis.max}
                  value={clampDimensionValue(axis.val, axis.min, axis.max)}
                  onChange={(e) => axis.onChange(Number(e.target.value))}
                  className="w-full accent-amber-800 cursor-pointer h-1.5"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Footer Price & Open in Showroom */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="font-mono-data">
            <div className="text-[11px] text-stone-500">
              Estimado ({altoCm}×{anchoCm}×{profCm} cm)
            </div>
            <div className="text-sm font-bold text-slate-900">
              Bs. {estimatedPriceBs.toLocaleString('es-BO')}{' '}
              <span className="text-[11px] font-normal text-amber-800">
                (Anticipo Bs. {anticipoBs.toLocaleString('es-BO')})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() =>
              onOpenInShowroom3D(modelKey, finishId, {
                alto: altoCm,
                ancho: anchoCm,
                prof: profCm,
              })
            }
            className="py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Showroom 3D</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
