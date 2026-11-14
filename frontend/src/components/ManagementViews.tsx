import React, { useMemo, useState } from 'react';
import {
  Eye,
  ShoppingBag,
  CreditCard,
  Ruler,
  Search,
  UserPlus,
  Phone,
  Plus,
  Minus,
  Trash2,
  Loader2,
  CheckCircle2,
  Sparkles,
  Users,
  ClipboardList,
  Package,
  RotateCcw,
  Box,
  Calendar,
  Pencil,
  X,
  AlertCircle,
  Banknote,
  QrCode,
  Store,
  MapPin,
} from 'lucide-react';
import {
  MUEBLES_CATALOGO,
  MUEBLES_SHOWROOM,
  MuebleItem,
  WOOD_FINISHES,
  WoodFinishId,
} from '../data/catalog';
import {
  calculateAdjustedPriceBs,
  clampDimensionValue,
  getDimensionBounds,
} from '../utils/pricing';
import {
  ClienteDTO,
  CotizacionDTO,
  PedidoDTO,
  appService,
} from '../services/appService';
import { CartLine } from './ShowroomDrawers';
import { CheckoutItemInput } from './ClientCheckoutModal';
import { PieceDimensionsCm } from './Tienda3D';
import { FloatingQuote3DPreview } from './FloatingQuote3DPreview';
import {
  EditCotizacionModal,
  FloatingCotizacionModal,
  FloatingDeliveryCalendarModal,
  NewClientQuickModal,
  QuotePaymentAlertModal,
  QuotePaymentMethod,
} from './QuoteModals';

// ============================================================================
// 1. CATÁLOGO AMPLIADO (Mara, Cedro, Tajibo y Roble)
// ============================================================================
interface CatalogViewProps {
  products: MuebleItem[];
  stockByKey: Partial<Record<MuebleItem['key'], number>>;
  onViewIn3D: (
    key: MuebleItem['key'],
    finishId: WoodFinishId,
    dims?: PieceDimensionsCm
  ) => void;
  onAddToCart: (
    mueble: MuebleItem,
    finishId: WoodFinishId,
    customDims?: string,
    overridePriceBs?: number
  ) => void;
  onAcquireNow: (item: CheckoutItemInput) => void;
}

export function CatalogView({
  products,
  stockByKey,
  onViewIn3D,
  onAddToCart,
  onAcquireNow,
}: CatalogViewProps) {
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [selectedWood, setSelectedWood] = useState<string>('Todas');
  const [search, setSearch] = useState('');
  const [cardFinishes, setCardFinishes] = useState<Record<number, WoodFinishId>>({});
  const [cardDims, setCardDims] = useState<Record<number, PieceDimensionsCm>>({});
  const [editingSizeIds, setEditingSizeIds] = useState<Record<number, boolean>>({});

  const catalogItems = products.length > 0 ? products : MUEBLES_CATALOGO;
  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(catalogItems.map((m) => m.categoria)))],
    [catalogItems]
  );
  const woods = ['Todas', 'Mara', 'Cedro', 'Tajibo', 'Roble'];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return catalogItems.filter((m) => {
      if (selectedCategory !== 'Todas' && m.categoria !== selectedCategory) return false;
      if (selectedWood !== 'Todas' && m.woodSpeciesTag !== selectedWood) return false;
      if (
        q &&
        !m.nombre.toLowerCase().includes(q) &&
        !m.madera.toLowerCase().includes(q) &&
        !m.categoria.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [catalogItems, selectedCategory, selectedWood, search]);

  return (
    <div className="h-full overflow-y-auto bg-[#fbf8f3] p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5" />
              <span>Exhibición &amp; Taller Artesanal · Oruro, Bolivia</span>
            </div>
            <h1 className="font-serif-brand font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
              Catálogo de Muebles en Madera Noble
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Explora piezas fabricadas en Mara, Cedro, Tajibo y Roble. Cambia el acabado en vivo o adquiérelas al instante.
            </p>
            <p className="text-[11px] text-emerald-800 mt-1 font-medium">
              Mostrando {filtered.length} de {catalogItems.length} muebles cargados
            </p>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar ropero, comedor, mara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-700"
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedCategory === cat
                    ? 'bg-slate-900 text-amber-300 font-semibold'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <span className="text-[11px] font-semibold text-stone-500 mr-1">Madera:</span>
            {woods.map((w) => (
              <button
                key={w}
                onClick={() => setSelectedWood(w)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap cursor-pointer transition-colors ${
                  selectedWood === w
                    ? 'bg-amber-800 text-white font-semibold'
                    : 'bg-white border border-stone-200 text-stone-700 hover:bg-stone-100'
                }`}
              >
                {w}
              </button>
            ))}
          </div>
        </div>

        {/* Product Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((item) => {
            const finishId = cardFinishes[item.id] || item.defaultFinish;
            const finish = WOOD_FINISHES[finishId];
            const liveStock = stockByKey[item.key] ?? item.stock;
            const dims = cardDims[item.id] || {
              alto: item.alto_cm,
              ancho: item.ancho_cm,
              prof: item.profundidad_cm,
            };
            const bounds = getDimensionBounds(item);
            const pricing = calculateAdjustedPriceBs(
              item,
              finishId,
              dims.alto,
              dims.ancho,
              dims.prof
            );
            const isEditingSize = Boolean(editingSizeIds[item.id]);

            const updateCardDim = (axis: keyof PieceDimensionsCm, value: number) => {
              const clamped = clampDimensionValue(
                value,
                bounds[axis].min,
                bounds[axis].max
              );
              setCardDims((prev) => ({
                ...prev,
                [item.id]: {
                  ...(prev[item.id] || {
                    alto: item.alto_cm,
                    ancho: item.ancho_cm,
                    prof: item.profundidad_cm,
                  }),
                  [axis]: clamped,
                },
              }));
            };

            const resetCardDims = () => {
              setCardDims((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
              });
            };

            return (
              <div
                key={item.id}
                className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-shadow"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 text-[11px] text-stone-500">
                    <span>{item.categoria}</span>
                    <span className="font-semibold text-emerald-700">
                      {liveStock > 0 ? `Stock Oruro: ${liveStock}` : 'Bajo pedido'}
                    </span>
                  </div>

                  <h2 className="font-serif-brand font-semibold text-lg text-slate-900 mt-1.5 leading-snug">
                    {item.nombre}
                  </h2>
                  <p className="text-xs font-medium text-amber-800 mt-0.5">{item.madera}</p>
                  <p className="text-xs text-stone-600 mt-2 leading-relaxed line-clamp-2">
                    {item.descripcion}
                  </p>

                  {/* Dimensions Summary + Live Adjustment Toggle */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between mb-1.5 text-[11px]">
                      <span className="font-semibold text-stone-600 flex items-center gap-1">
                        <Ruler className="w-3 h-3 text-amber-800" />
                        <span>Medidas {pricing.isCustomSize ? '(Personalizadas)' : '(cm)'}</span>
                      </span>
                      <div className="flex items-center gap-2">
                        {pricing.isCustomSize && (
                          <button
                            type="button"
                            onClick={resetCardDims}
                            title="Restablecer medidas originales"
                            className="inline-flex items-center gap-0.5 text-[10px] font-medium text-stone-500 hover:text-slate-900 cursor-pointer"
                          >
                            <RotateCcw className="w-2.5 h-2.5" />
                            <span>Original</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            setEditingSizeIds((prev) => ({
                              ...prev,
                              [item.id]: !prev[item.id],
                            }))
                          }
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border cursor-pointer transition-colors ${
                            isEditingSize
                              ? 'bg-amber-800 text-white border-amber-900'
                              : 'bg-stone-50 hover:bg-amber-50 text-amber-900 border-stone-300'
                          }`}
                        >
                          {isEditingSize ? 'Listo' : 'Ajustar medidas'}
                        </button>
                      </div>
                    </div>

                    {!isEditingSize ? (
                      <div className="grid grid-cols-3 gap-1.5 text-center font-mono-data text-[11px]">
                        <div
                          onClick={() =>
                            setEditingSizeIds((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className={`border rounded-lg py-1.5 cursor-pointer transition-colors ${
                            pricing.isCustomSize
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-400'
                          }`}
                        >
                          <span className="text-[10px] text-stone-500 block">Alto</span>
                          <strong className="text-slate-900">{dims.alto} cm</strong>
                        </div>
                        <div
                          onClick={() =>
                            setEditingSizeIds((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className={`border rounded-lg py-1.5 cursor-pointer transition-colors ${
                            pricing.isCustomSize
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-400'
                          }`}
                        >
                          <span className="text-[10px] text-stone-500 block">Ancho</span>
                          <strong className="text-slate-900">{dims.ancho} cm</strong>
                        </div>
                        <div
                          onClick={() =>
                            setEditingSizeIds((prev) => ({ ...prev, [item.id]: true }))
                          }
                          className={`border rounded-lg py-1.5 cursor-pointer transition-colors ${
                            pricing.isCustomSize
                              ? 'bg-amber-50/70 border-amber-300'
                              : 'bg-stone-50 border-stone-200 hover:border-amber-400'
                          }`}
                        >
                          <span className="text-[10px] text-stone-500 block">Prof.</span>
                          <strong className="text-slate-900">{dims.prof} cm</strong>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-stone-50 border border-stone-200 rounded-xl p-2.5 space-y-2">
                        {(
                          [
                            {
                              axis: 'alto' as const,
                              label: 'Alto',
                              val: dims.alto,
                              min: bounds.alto.min,
                              max: bounds.alto.max,
                            },
                            {
                              axis: 'ancho' as const,
                              label: 'Ancho',
                              val: dims.ancho,
                              min: bounds.ancho.min,
                              max: bounds.ancho.max,
                            },
                            {
                              axis: 'prof' as const,
                              label: 'Prof.',
                              val: dims.prof,
                              min: bounds.prof.min,
                              max: bounds.prof.max,
                            },
                          ]
                        ).map((d) => (
                          <div key={d.axis} className="space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium text-stone-700">{d.label}</span>
                              <div className="flex items-center gap-1 font-mono-data">
                                <button
                                  type="button"
                                  onClick={() => updateCardDim(d.axis, d.val - 5)}
                                  className="w-5 h-5 rounded bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
                                >
                                  <Minus className="w-2.5 h-2.5" />
                                </button>
                                <input
                                  type="number"
                                  min={d.min}
                                  max={d.max}
                                  value={d.val}
                                  onChange={(e) => {
                                    const num = Number(e.target.value);
                                    if (!Number.isNaN(num)) updateCardDim(d.axis, num);
                                  }}
                                  className="w-12 text-center py-0.5 rounded border border-stone-300 bg-white text-[11px] font-semibold"
                                />
                                <button
                                  type="button"
                                  onClick={() => updateCardDim(d.axis, d.val + 5)}
                                  className="w-5 h-5 rounded bg-white border border-stone-300 hover:bg-stone-100 flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-2.5 h-2.5" />
                                </button>
                                <span className="text-[10px] text-stone-500">cm</span>
                              </div>
                            </div>
                            <input
                              type="range"
                              min={d.min}
                              max={d.max}
                              value={d.val}
                              onChange={(e) => updateCardDim(d.axis, Number(e.target.value))}
                              className="w-full h-1 accent-amber-800 cursor-pointer"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {item.key !== 'sillon' && (
                    <div className="mt-3.5 pt-3 border-t border-stone-100">
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="text-stone-500">Acabado:</span>
                        <span className="font-semibold text-slate-800">{finish.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                          const preset = WOOD_FINISHES[fid];
                          const active = finishId === fid;
                          return (
                            <button
                              key={fid}
                              type="button"
                              title={preset.label}
                              onClick={() =>
                                setCardFinishes((prev) => ({ ...prev, [item.id]: fid }))
                              }
                              className={`w-6 h-6 rounded-full border cursor-pointer transition-transform ${
                                active
                                  ? 'ring-2 ring-amber-700 ring-offset-1 scale-110 border-slate-900'
                                  : 'border-black/20 hover:scale-105'
                              }`}
                              style={{ backgroundColor: preset.swatchHex }}
                            />
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3.5 border-t border-stone-100">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-mono-data text-lg font-bold text-amber-800">
                      Bs. {pricing.precioBs.toLocaleString('es-BO')}
                    </span>
                    <span className="font-mono-data text-[11px] text-stone-500">
                      Anticipo 50%: Bs. {pricing.anticipoBs.toLocaleString('es-BO')}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      onClick={() =>
                        onViewIn3D(
                          item.key,
                          finishId,
                          pricing.isCustomSize ? dims : undefined
                        )
                      }
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ver 3D</span>
                    </button>
                    <button
                      onClick={() =>
                        onAddToCart(
                          item,
                          finishId,
                          pricing.customDimsLabel,
                          pricing.precioBs
                        )
                      }
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-900 border border-stone-300 text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-amber-800" />
                      <span>Bolsa</span>
                    </button>
                    <button
                      onClick={() =>
                        onAcquireNow({
                          key: item.key,
                          customName: pricing.isCustomSize
                            ? `${item.nombre} (A medida)`
                            : item.nombre,
                          finishId,
                          qty: 1,
                          customDims: pricing.customDimsLabel,
                          unitPriceBs: pricing.precioBs,
                        })
                      }
                      className="flex items-center justify-center gap-1 py-2 px-2 rounded-xl bg-amber-800 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <CreditCard className="w-3.5 h-3.5" />
                      <span>Adquirir</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. COTIZACIONES A MEDIDA (Formulario + Visor 3D Flotante + Tabla Supabase)
// ============================================================================
interface CotizacionesViewProps {
  cotizaciones: CotizacionDTO[];
  clientes: ClienteDTO[];
  onRefresh: () => void;
  onAddCustomToCart: (
    mueble: MuebleItem,
    finishId: WoodFinishId,
    customDims: string,
    priceBs: number
  ) => void;
  onAcquireNow: (item: CheckoutItemInput) => void;
  onViewIn3D: (
    key: MuebleItem['key'],
    finishId: WoodFinishId,
    dims: PieceDimensionsCm
  ) => void;
  onWhatsAppAlert: (title: string, detail: string) => void;
  onGoToPedidosQuotes?: () => void;
}

const WOOD_MULTIPLIERS_COT: Record<WoodFinishId, number> = {
  mara: 1.15,
  tajibo: 1.12,
  cedro: 1.05,
  roble: 1.0,
  grafito: 0.96,
};

function computeQuoteEstimateBs(
  baseItem: MuebleItem,
  finishId: WoodFinishId,
  altoCm: number,
  anchoCm: number,
  profCm: number,
  conPoliuretano: boolean,
  conCerradura: boolean
) {
  const baseVolume = Math.max(1, baseItem.alto_cm * baseItem.ancho_cm * baseItem.profundidad_cm);
  const customVolume = Math.max(1, altoCm * anchoCm * profCm);
  const scaleFactor = 0.45 + 0.55 * (customVolume / baseVolume);
  const extras = (conPoliuretano ? 180 : 0) + (conCerradura ? 110 : 0);
  const precioBs =
    Math.round(
      (baseItem.precio_bs * scaleFactor * (WOOD_MULTIPLIERS_COT[finishId] || 1) + extras) / 10
    ) * 10;
  return {
    precioBs,
    anticipoBs: Math.round(precioBs * 0.5),
  };
}

function resolveQuoteBase(cot: CotizacionDTO): {
  baseItem: MuebleItem;
  finishId: WoodFinishId;
} {
  const foundItem =
    Object.values(MUEBLES_SHOWROOM).find(
      (m) =>
        m.nombre.toLowerCase() === cot.modelo_base.toLowerCase() ||
        cot.modelo_base.toLowerCase().includes(m.key.replace('_', ' '))
    ) || MUEBLES_SHOWROOM.ropero;

  const foundFinish =
    (Object.values(WOOD_FINISHES).find(
      (f) =>
        f.label.toLowerCase() === cot.madera_preferida.toLowerCase() ||
        cot.madera_preferida.toLowerCase().includes(f.shortLabel.toLowerCase())
    )?.id as WoodFinishId | undefined) || foundItem.defaultFinish;

  return { baseItem: foundItem, finishId: foundFinish };
}

export function CotizacionesView({
  cotizaciones,
  clientes,
  onRefresh,
  onAddCustomToCart,
  onAcquireNow,
  onViewIn3D,
  onWhatsAppAlert,
  onGoToPedidosQuotes,
}: CotizacionesViewProps) {
  const catalogList = useMemo(() => Object.values(MUEBLES_SHOWROOM), []);
  const [selectedKey, setSelectedKey] = useState<MuebleItem['key']>('ropero');
  const baseItem = MUEBLES_SHOWROOM[selectedKey];
  const bounds = useMemo(() => getDimensionBounds(baseItem), [baseItem]);

  const [finishId, setFinishId] = useState<WoodFinishId>(baseItem.defaultFinish);
  const [alto, setAlto] = useState(baseItem.alto_cm);
  const [ancho, setAncho] = useState(baseItem.ancho_cm);
  const [prof, setProf] = useState(baseItem.profundidad_cm);
  const [conPoliuretano, setConPoliuretano] = useState(true);
  const [conCerradura, setConCerradura] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [clienteDireccion, setClienteDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedBanner, setSavedBanner] = useState<CotizacionDTO | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // New client quick registration & pre-save Payment/Advance Alert modal
  const [newClientModalOpen, setNewClientModalOpen] = useState(false);
  const [paymentAlertOpen, setPaymentAlertOpen] = useState(false);

  // Floating 3D studio widget state (opened from the single "Ver en 3D" button)
  const [floating3DOpen, setFloating3DOpen] = useState(false);

  // Full quote editor modal, floating delivery calendar modal, and chronological sort
  const [fullEditTarget, setFullEditTarget] = useState<CotizacionDTO | null>(null);
  const [calendarTarget, setCalendarTarget] = useState<CotizacionDTO | null>(null);
  const [sortOldestFirst, setSortOldestFirst] = useState(false);

  const sortedQuotes = useMemo(() => {
    return [...cotizaciones].sort((a, b) =>
      sortOldestFirst
        ? a.created_at.localeCompare(b.created_at)
        : b.created_at.localeCompare(a.created_at)
    );
  }, [cotizaciones, sortOldestFirst]);

  const handleModelChange = (k: MuebleItem['key']) => {
    const next = MUEBLES_SHOWROOM[k];
    setSelectedKey(k);
    setFinishId(next.defaultFinish);
    setAlto(next.alto_cm);
    setAncho(next.ancho_cm);
    setProf(next.profundidad_cm);
  };

  const handleResetStandardDims = () => {
    setAlto(baseItem.alto_cm);
    setAncho(baseItem.ancho_cm);
    setProf(baseItem.profundidad_cm);
  };

  const { precioBs: estimatedPrice, anticipoBs: anticipo } = computeQuoteEstimateBs(
    baseItem,
    finishId,
    alto,
    ancho,
    prof,
    conPoliuretano,
    conCerradura
  );
  const customDimsText = `${alto} × ${ancho} × ${prof} cm`;
  const isCustomSize =
    alto !== baseItem.alto_cm || ancho !== baseItem.ancho_cm || prof !== baseItem.profundidad_cm;

  const handleRequestQuotePaymentAlert = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSavedBanner(null);
    setPaymentAlertOpen(true);
  };

  const handleConfirmCreateQuote = async (
    formaPago: QuotePaymentMethod,
    dejaAnticipo: boolean
  ) => {
    setSaving(true);
    setErrorMsg(null);
    setSavedBanner(null);
    try {
      const created = await appService.crearCotizacionConCliente({
        cliente_nombre: clienteNombre || undefined,
        cliente_telefono: clienteTelefono || undefined,
        cliente_direccion: clienteDireccion || undefined,
        modelo_key: selectedKey,
        finish_id: finishId,
        alto_cm: alto,
        ancho_cm: ancho,
        profundidad_cm: prof,
        precio_estimado_bs: estimatedPrice,
        con_poliuretano: conPoliuretano,
        con_cerradura: conCerradura,
        forma_pago: formaPago,
        deja_anticipo: dejaAnticipo,
        notas: notas || undefined,
      });
      setPaymentAlertOpen(false);
      setSavedBanner(created);
      onRefresh();
      onGoToPedidosQuotes?.();
    } catch (err) {
      setPaymentAlertOpen(false);
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la cotización.');
    } finally {
      setSaving(false);
    }
  };

  const handleLoadQuoteIntoDesigner = (cot: CotizacionDTO, openFloating3D = true) => {
    const { baseItem: matchedItem, finishId: matchedFinish } = resolveQuoteBase(cot);
    const b = getDimensionBounds(matchedItem);
    setSelectedKey(matchedItem.key);
    setFinishId(matchedFinish);
    setAlto(clampDimensionValue(Number(cot.alto_cm) || matchedItem.alto_cm, b.alto.min, b.alto.max));
    setAncho(clampDimensionValue(Number(cot.ancho_cm) || matchedItem.ancho_cm, b.ancho.min, b.ancho.max));
    setProf(
      clampDimensionValue(Number(cot.profundidad_cm) || matchedItem.profundidad_cm, b.prof.min, b.prof.max)
    );
    setConPoliuretano(Boolean(cot.con_poliuretano));
    setConCerradura(Boolean(cot.con_cerradura));
    if (cot.cliente_nombre) setClienteNombre(cot.cliente_nombre);
    if (cot.cliente_telefono) setClienteTelefono(cot.cliente_telefono);
    if (cot.notas) setNotas(cot.notas);
    if (openFloating3D) {
      setFloating3DOpen(true);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#fbf8f3] p-6 lg:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Taller de Don Teófilo · Oruro</span>
            </div>
            <h1 className="font-serif-brand font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
              Cotizaciones a Medida
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Edita medidas en tiempo real en Mara, Cedro, Tajibo o Roble, visualízalas en 3D y envíalas directo a Bolsa y Pedidos.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Interactive Calculator */}
          <form
            onSubmit={handleRequestQuotePaymentAlert}
            className="lg:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                Nueva Cotización Artesanal
              </h2>
              <button
                type="button"
                onClick={() => setNewClientModalOpen(true)}
                className="text-[11px] font-semibold text-amber-900 hover:text-amber-950 flex items-center gap-1 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-2.5 py-1.5 rounded-lg cursor-pointer"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Nuevo Cliente</span>
              </button>
            </div>

            {clientes.length > 0 && (
              <div>
                <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                  Seleccionar cliente registrado (opcional)
                </label>
                <select
                  value={selectedClientId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setSelectedClientId(id);
                    const c = clientes.find((cl) => cl.id === id);
                    if (c) {
                      setClienteNombre(c.nombre);
                      setClienteTelefono(c.telefono);
                      setClienteDireccion(c.direccion);
                    }
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs"
                >
                  <option value="">-- Ingresar manualmente o elegir cliente --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nombre} ({c.telefono})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">Modelo Base</label>
              <select
                value={selectedKey}
                onChange={(e) => handleModelChange(e.target.value as MuebleItem['key'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs bg-white"
              >
                {catalogList.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.nombre} (Base Bs. {m.precio_bs})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Madera Preferida
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                  const preset = WOOD_FINISHES[fid];
                  const active = finishId === fid;
                  return (
                    <button
                      key={fid}
                      type="button"
                      onClick={() => setFinishId(fid)}
                      className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer ${
                        active
                          ? 'border-amber-800 bg-amber-50 text-amber-950 font-semibold'
                          : 'border-stone-200 bg-white text-stone-600'
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

            {/* Editable Dimensions with Steppers + Direct Inputs + Sliders */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <Ruler className="w-3.5 h-3.5 text-amber-800" />
                  <span>Medidas Editables (cm)</span>
                </span>
                {isCustomSize && (
                  <button
                    type="button"
                    onClick={handleResetStandardDims}
                    className="text-[11px] font-semibold text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restablecer estándar</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  {
                    label: 'Alto',
                    value: alto,
                    min: bounds.alto.min,
                    max: bounds.alto.max,
                    setter: setAlto,
                  },
                  {
                    label: 'Ancho',
                    value: ancho,
                    min: bounds.ancho.min,
                    max: bounds.ancho.max,
                    setter: setAncho,
                  },
                  {
                    label: 'Prof.',
                    value: prof,
                    min: bounds.prof.min,
                    max: bounds.prof.max,
                    setter: setProf,
                  },
                ].map((axis) => (
                  <div
                    key={axis.label}
                    className="bg-white border border-stone-200 rounded-xl p-2 space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-slate-700">{axis.label}</span>
                      <span className="font-mono-data text-[10px] text-stone-400">
                        {axis.min}-{axis.max}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label={`Disminuir ${axis.label}`}
                        onClick={() =>
                          axis.setter(clampDimensionValue(axis.value - 5, axis.min, axis.max))
                        }
                        className="w-6 h-7 rounded-lg border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <input
                        type="number"
                        min={axis.min}
                        max={axis.max}
                        value={axis.value}
                        onChange={(e) => {
                          const raw = Number(e.target.value);
                          if (!Number.isNaN(raw)) {
                            axis.setter(Math.max(10, Math.min(400, Math.round(raw))));
                          }
                        }}
                        onBlur={(e) => {
                          axis.setter(
                            clampDimensionValue(
                              Number(e.target.value) || axis.min,
                              axis.min,
                              axis.max
                            )
                          );
                        }}
                        className="w-full min-w-0 px-1 py-1 rounded-lg border border-stone-300 font-mono-data text-xs font-semibold text-center text-slate-900"
                      />
                      <button
                        type="button"
                        aria-label={`Aumentar ${axis.label}`}
                        onClick={() =>
                          axis.setter(clampDimensionValue(axis.value + 5, axis.min, axis.max))
                        }
                        className="w-6 h-7 rounded-lg border border-stone-300 hover:bg-stone-100 flex items-center justify-center text-slate-700 cursor-pointer shrink-0"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                    <input
                      type="range"
                      min={axis.min}
                      max={axis.max}
                      value={clampDimensionValue(axis.value, axis.min, axis.max)}
                      onChange={(e) => axis.setter(Number(e.target.value))}
                      className="w-full accent-amber-800 cursor-pointer h-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conPoliuretano}
                  onChange={(e) => setConPoliuretano(e.target.checked)}
                  className="accent-amber-800"
                />
                <span>Impermeabilizado poliuretánico (+Bs. 180)</span>
              </label>
              <label className="flex items-center gap-2 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conCerradura}
                  onChange={(e) => setConCerradura(e.target.checked)}
                  className="accent-amber-800"
                />
                <span>Herrajes cierre suave y cerradura (+Bs. 110)</span>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
              <input
                type="tel"
                placeholder="Teléfono / WhatsApp"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>

            <input
              type="text"
              placeholder="Notas o divisiones internas requeridas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
            />

            <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between font-mono-data">
              <div>
                <span className="text-[11px] text-slate-300 block">Presupuesto Estimado</span>
                <strong className="text-xl text-amber-300">
                  Bs. {estimatedPrice.toLocaleString('es-BO')}
                </strong>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-300 block">Anticipo 50%</span>
                <strong className="text-sm text-white">
                  Bs. {anticipo.toLocaleString('es-BO')}
                </strong>
              </div>
            </div>

            {savedBanner && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>
                  Cotización <strong>{savedBanner.codigo_cotizacion}</strong> registrada.
                </span>
              </div>
            )}
            {errorMsg && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setFloating3DOpen((v) => !v)}
                className={`py-2.5 px-2.5 rounded-xl border font-semibold text-xs cursor-pointer flex items-center justify-center gap-1 ${
                  floating3DOpen
                    ? 'bg-amber-100 border-amber-500 text-amber-950'
                    : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-slate-900'
                }`}
              >
                <Box className="w-3.5 h-3.5 text-amber-800" />
                <span>{floating3DOpen ? 'Ocultar 3D' : 'Ver en 3D'}</span>
              </button>
              <button
                type="submit"
                disabled={saving}
                className="py-2.5 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer flex items-center justify-center gap-1"
              >
                {saving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Sparkles className="w-3.5 h-3.5" />
                )}
                <span>Cotizar</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onAcquireNow({
                    key: baseItem.key,
                    customName: `${baseItem.nombre} (A medida)`,
                    finishId,
                    qty: 1,
                    customDims: customDimsText,
                    unitPriceBs: estimatedPrice,
                  })
                }
                className="py-2.5 px-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-1"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Adquirir</span>
              </button>
            </div>
          </form>

          {/* Saved Quotes Table */}
          <div className="lg:col-span-7 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                  Historial de Cotizaciones ({cotizaciones.length})
                </h2>
                <p className="text-[11px] text-stone-500">
                  Ordenado por fecha de pedido · El estado se actualiza solo desde Bolsa y Pedidos
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSortOldestFirst((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-stone-200 bg-stone-50 hover:bg-stone-100 text-[11px] font-semibold text-slate-800 cursor-pointer"
              >
                <Calendar className="w-3.5 h-3.5 text-amber-800" />
                <span>{sortOldestFirst ? 'Fecha: Más antiguas' : 'Fecha: Más recientes'}</span>
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                    <th className="py-3 px-4 font-semibold">Fecha &amp; Código</th>
                    <th className="py-3 px-4 font-semibold">Cliente</th>
                    <th className="py-3 px-4 font-semibold">Mueble &amp; Medidas</th>
                    <th className="py-3 px-4 font-semibold">Total</th>
                    <th className="py-3 px-4 font-semibold">Estado</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sortedQuotes.map((cot) => {
                    const statusMeta =
                      QUOTE_STATUS_META[cot.estado] || QUOTE_STATUS_META.pendiente;
                    const orderDateFormatted = new Date(cot.created_at).toLocaleDateString(
                      'es-BO',
                      {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      }
                    );
                    const deliveryIso =
                      cot.fecha_entrega ||
                      (() => {
                        const d = new Date(cot.created_at);
                        d.setDate(d.getDate() + 7);
                        return d.toISOString().slice(0, 10);
                      })();

                    return (
                      <tr key={cot.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="font-mono-data font-semibold text-slate-900">
                            {cot.codigo_cotizacion}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono-data">
                            Pedido: {orderDateFormatted}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-900">
                            {cot.cliente_nombre || 'Cliente Showroom'}
                          </div>
                          <div className="text-[11px] text-stone-500 font-mono-data">
                            {cot.cliente_telefono || 'Sin teléfono'}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-medium text-slate-800">{cot.modelo_base}</div>
                          <div className="text-[11px] text-stone-500 mt-0.5">
                            {cot.descripcion_medidas} · {cot.madera_preferida}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono-data font-semibold text-amber-800 whitespace-nowrap">
                          Bs. {Number(cot.precio_estimado_bs).toLocaleString('es-BO')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            title="El estado se modifica directamente desde Bolsa y Pedidos"
                            className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${statusMeta.badgeClass}`}
                          >
                            {statusMeta.label}
                          </span>
                          <div className="text-[10px] text-stone-400 mt-0.5">
                            Entrega: {deliveryIso}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleLoadQuoteIntoDesigner(cot, true)}
                              title="Ver mueble en 3D"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[11px] font-semibold cursor-pointer"
                            >
                              <Box className="w-3.5 h-3.5" />
                              <span>Ver 3D</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setFullEditTarget(cot)}
                              title="Editar toda la cotización"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-950 text-[11px] font-semibold cursor-pointer"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                              <span>Editar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => setCalendarTarget(cot)}
                              title="Ver fecha de entrega en calendario flotante"
                              className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Entrega</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {sortedQuotes.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-stone-500">
                        Aún no hay cotizaciones registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Opción Flotante 3D para Cotización a Medida */}
      <FloatingQuote3DPreview
        open={floating3DOpen}
        onToggleOpen={setFloating3DOpen}
        modelKey={selectedKey}
        finishId={finishId}
        onChangeFinish={setFinishId}
        altoCm={alto}
        anchoCm={ancho}
        profCm={prof}
        onChangeAlto={setAlto}
        onChangeAncho={setAncho}
        onChangeProf={setProf}
        onResetDims={handleResetStandardDims}
        estimatedPriceBs={estimatedPrice}
        anticipoBs={anticipo}
        onOpenInShowroom3D={(key, fid, dims) => onViewIn3D(key, fid, dims)}
      />

      {/* Modal para Editar Toda la Cotización */}
      <EditCotizacionModal
        cotizacion={fullEditTarget}
        onClose={() => setFullEditTarget(null)}
        onSaved={() => {
          setFullEditTarget(null);
          onRefresh();
        }}
      />

      {/* Calendario Flotante de Fecha de Entrega */}
      <FloatingDeliveryCalendarModal
        cotizacion={calendarTarget}
        onClose={() => setCalendarTarget(null)}
        onUpdatedDate={() => {
          onRefresh();
        }}
      />

      {/* Modal para Registrar Nuevo Cliente sin salir de Cotizaciones */}
      <NewClientQuickModal
        open={newClientModalOpen}
        onClose={() => setNewClientModalOpen(false)}
        onCreated={(cli) => {
          setSelectedClientId(cli.id);
          setClienteNombre(cli.nombre);
          setClienteTelefono(cli.telefono);
          setClienteDireccion(cli.direccion);
          onRefresh();
        }}
      />

      {/* Alerta previa de Forma de Pago y Adelanto antes de registrar cotización */}
      <QuotePaymentAlertModal
        open={paymentAlertOpen}
        summary={{
          modeloNombre: baseItem.nombre,
          maderaLabel: WOOD_FINISHES[finishId].label,
          medidasLabel: customDimsText,
          clienteNombre: clienteNombre || undefined,
          precioTotalBs: estimatedPrice,
          anticipoBs: anticipo,
        }}
        submitting={saving}
        onCancel={() => setPaymentAlertOpen(false)}
        onConfirm={handleConfirmCreateQuote}
      />
    </div>
  );
}

// ============================================================================
// 3. GESTIÓN DE CLIENTES (CRM Oruro + Cotización a Medida Flotante por cliente)
// ============================================================================
interface ClientesViewProps {
  clientes: ClienteDTO[];
  pedidos: PedidoDTO[];
  onRefresh: () => void;
  onWhatsAppAlert: (title: string, detail: string) => void;
  onGoToPedidosQuotes?: () => void;
}

export function ClientesView({
  clientes,
  pedidos,
  onRefresh,
  onWhatsAppAlert,
  onGoToPedidosQuotes,
}: ClientesViewProps) {
  const [search, setSearch] = useState('');
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [quoteClientTarget, setQuoteClientTarget] = useState<ClienteDTO | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        c.telefono.toLowerCase().includes(q) ||
        c.direccion.toLowerCase().includes(q)
    );
  }, [clientes, search]);

  const handleSaveClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      await appService.registrarOActualizarCliente({
        nombre,
        telefono,
        direccion,
        notas,
      });
      setNombre('');
      setTelefono('');
      setDireccion('');
      setNotas('');
      onRefresh();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar el cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#fbf8f3] p-6 lg:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Directorio Comercial · Oruro</span>
            </div>
            <h1 className="font-serif-brand font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
              Gestión de Clientes
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Registra clientes o inicia una cotización a medida flotante directamente desde cada cliente registrado.
            </p>
          </div>
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, celular o zona..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Quick Register / Update Form */}
          <form
            onSubmit={handleSaveClient}
            className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3.5"
          >
            <h2 className="font-serif-brand font-semibold text-lg text-slate-900 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-amber-800" />
              <span>Registrar / Actualizar Cliente</span>
            </h2>
            <p className="text-[11px] text-stone-500">
              Si el teléfono ya existe en el sistema, el registro se actualiza automáticamente.
            </p>

            <input
              type="text"
              required
              placeholder="Nombre completo *"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs"
            />
            <input
              type="tel"
              required
              placeholder="Teléfono / WhatsApp (ej. 72418920) *"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs"
            />
            <input
              type="text"
              required
              placeholder="Dirección en Oruro *"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs"
            />
            <input
              type="text"
              placeholder="Notas o preferencias (opcional)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 text-xs"
            />

            {errorMsg && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {errorMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Guardar Cliente</span>
            </button>
          </form>

          {/* Clients Table */}
          <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                Clientes Registrados ({filtered.length})
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                    <th className="py-3 px-4 font-semibold">Nombre</th>
                    <th className="py-3 px-4 font-semibold">Teléfono</th>
                    <th className="py-3 px-4 font-semibold">Dirección Oruro</th>
                    <th className="py-3 px-4 font-semibold">Compras</th>
                    <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {filtered.map((cli) => {
                    const countOrders = pedidos.filter(
                      (p) =>
                        p.cliente_id === cli.id ||
                        p.cliente_telefono.replace(/\s+/g, '') === cli.telefono.replace(/\s+/g, '')
                    ).length;
                    return (
                      <tr key={cli.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900">{cli.nombre}</div>
                          {cli.notas && (
                            <div className="text-[11px] text-stone-500 truncate max-w-[200px]">
                              {cli.notas}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono-data text-slate-800">{cli.telefono}</td>
                        <td className="py-3 px-4 text-stone-600">{cli.direccion}</td>
                        <td className="py-3 px-4 font-mono-data font-semibold text-amber-800">
                          {countOrders} pedido(s)
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setQuoteClientTarget(cli)}
                              className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-amber-800 hover:bg-amber-700 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <ClipboardList className="w-3 h-3" />
                              <span>Cotizar</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                onWhatsAppAlert(
                                  `Cliente: ${cli.nombre}`,
                                  `Contacto registrado: ${cli.telefono}. Dirección en Oruro: ${cli.direccion}. Atención Mueblería Modes: +591 72418920.`
                                )
                              }
                              className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              <Phone className="w-3 h-3" />
                              <span>WhatsApp</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-stone-500">
                        No se encontraron clientes con ese criterio.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Ventana Flotante de Cotización a Medida desde Gestión de Clientes */}
      <FloatingCotizacionModal
        open={Boolean(quoteClientTarget)}
        sourceLabel={
          quoteClientTarget
            ? `Cotización a Medida · ${quoteClientTarget.nombre}`
            : 'Cotización a Medida · Cliente'
        }
        initialCliente={quoteClientTarget}
        clientes={clientes}
        onClose={() => setQuoteClientTarget(null)}
        onSuccess={() => {
          setQuoteClientTarget(null);
          onRefresh();
          onGoToPedidosQuotes?.();
        }}
      />
    </div>
  );
}

// ============================================================================
// 4. BOLSA DE COMPRAS Y PEDIDOS (2 Opciones: Compras/Clientes y Cotizaciones)
// ============================================================================
const QUOTE_STATUS_META: Record<
  CotizacionDTO['estado'],
  {
    label: string;
    rowClass: string;
    badgeClass: string;
    messageTitle: string;
    statusMessage: string;
  }
> = {
  pendiente: {
    label: 'Pendiente',
    rowClass: 'bg-amber-50/85 hover:bg-amber-100/75 border-l-4 border-l-amber-500',
    badgeClass: 'bg-amber-100 text-amber-950 border-amber-300',
    messageTitle: 'Cotización Pendiente de Confirmación',
    statusMessage:
      'Tu cotización está registrada y en espera de confirmación. Puedes elegir tu forma de pago y dejar el anticipo del 50% para que Don Teófilo programe el corte de madera.',
  },
  aprobada: {
    label: 'Aprobada',
    rowClass: 'bg-sky-50/85 hover:bg-sky-100/75 border-l-4 border-l-sky-600',
    badgeClass: 'bg-sky-100 text-sky-950 border-sky-300',
    messageTitle: '¡Cotización Aprobada!',
    statusMessage:
      'El presupuesto y las medidas fueron aprobados. Confirma o completa el pago del anticipo del 50% para ingresar inmediatamente a fabricación artesanal en nuestro taller de Oruro.',
  },
  en_fabricacion: {
    label: 'En fabricación',
    rowClass: 'bg-indigo-50/85 hover:bg-indigo-100/75 border-l-4 border-l-indigo-600',
    badgeClass: 'bg-indigo-100 text-indigo-950 border-indigo-300',
    messageTitle: 'Mueble en Fabricación en Taller',
    statusMessage:
      'El Maestro Don Teófilo está trabajando tu pieza a medida en carpintería fina. Desde aquí puedes verificar tu abono o adelantar el saldo restante.',
  },
  completada: {
    label: 'Completada',
    rowClass: 'bg-emerald-50/85 hover:bg-emerald-100/75 border-l-4 border-l-emerald-600',
    badgeClass: 'bg-emerald-100 text-emerald-950 border-emerald-300',
    messageTitle: '¡Mueble Terminado y Listo!',
    statusMessage:
      'Tu mueble a medida ha finalizado el acabado y control de calidad. Realiza o confirma el pago total / saldo pendiente para coordinar la entrega inmediata en Oruro.',
  },
};

const QUOTE_STATE_ORDER: Record<CotizacionDTO['estado'], number> = {
  pendiente: 0,
  aprobada: 1,
  en_fabricacion: 2,
  completada: 3,
};

function formatFormaPagoLabel(forma?: CotizacionDTO['forma_pago']) {
  if (forma === 'transferencia') return 'Transferencia';
  if (forma === 'showroom') return 'En Showroom';
  return 'QR Simple';
}

function pedidoEstadoMeta(estado: PedidoDTO['estado']) {
  const labels: Record<PedidoDTO['estado'], { label: string; className: string }> = {
    cotizacion: { label: 'Cotización', className: 'bg-amber-100 text-amber-950 border-amber-300' },
    confirmado: { label: 'Confirmado', className: 'bg-sky-100 text-sky-900 border-sky-300' },
    en_taller: { label: 'En producción', className: 'bg-indigo-100 text-indigo-900 border-indigo-300' },
    listo_entrega: { label: 'Listo', className: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
    entregado: { label: 'Entregado', className: 'bg-stone-100 text-stone-800 border-stone-300' },
    cancelado: { label: 'Cancelado', className: 'bg-red-100 text-red-900 border-red-300' },
  };
  return labels[estado] || labels.confirmado;
}

function formatEstadoPagoBadge(cot: CotizacionDTO) {
  if (cot.estado_pago === 'pagado_total') {
    return { label: 'Pagado 100%', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' };
  }
  if (cot.estado_pago === 'anticipo_pagado') {
    return { label: 'Anticipo 50% pagado', cls: 'bg-sky-100 text-sky-900 border-sky-300' };
  }
  if (cot.deja_anticipo || cot.estado_pago === 'pendiente_anticipo') {
    return { label: 'Anticipo pendiente', cls: 'bg-amber-100 text-amber-900 border-amber-300' };
  }
  return { label: 'Sin adelanto', cls: 'bg-stone-100 text-stone-700 border-stone-300' };
}

interface PedidosViewProps {
  cartItems: CartLine[];
  pedidos: PedidoDTO[];
  cotizaciones: CotizacionDTO[];
  activeTab: 'compras' | 'cotizaciones';
  onChangeTab: (tab: 'compras' | 'cotizaciones') => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemoveCartItem: (id: string) => void;
  onClearCart: () => void;
  onFinalizeCart: () => void;
  onRefresh: () => void;
  onWhatsAppAlert: (title: string, detail: string) => void;
}

export function PedidosView({
  cartItems,
  pedidos,
  cotizaciones,
  activeTab,
  onChangeTab,
  onUpdateQty,
  onRemoveCartItem,
  onClearCart,
  onFinalizeCart,
  onRefresh,
  onWhatsAppAlert,
}: PedidosViewProps) {
  const subtotal = cartItems.reduce((acc, l) => acc + l.unitPriceBs * l.qty, 0);
  const [quoteStatusFilter, setQuoteStatusFilter] = useState<
    'todas' | CotizacionDTO['estado']
  >('todas');
  const [quoteActionModal, setQuoteActionModal] = useState<CotizacionDTO | null>(null);
  const [payMethodChoice, setPayMethodChoice] = useState<QuotePaymentMethod>('qr_simple');
  const [payTypeChoice, setPayTypeChoice] = useState<'anticipo' | 'total'>('anticipo');
  const [payingQuote, setPayingQuote] = useState(false);

  const handleQuoteStatusChange = async (
    codigo: string,
    nextStatus: CotizacionDTO['estado']
  ) => {
    try {
      await appService.actualizarEstadoCotizacion(codigo, nextStatus);
      onRefresh();
    } catch {
      // ignore transient error
    }
  };

  const handleOpenQuoteAlert = (cot: CotizacionDTO) => {
    setQuoteActionModal(cot);
    setPayMethodChoice(cot.forma_pago || 'qr_simple');
    setPayTypeChoice(cot.estado_pago === 'anticipo_pagado' ? 'total' : 'anticipo');
  };

  const handleConfirmQuotePayment = async () => {
    if (!quoteActionModal) return;
    setPayingQuote(true);
    try {
      await appService.registrarPagoCotizacion(quoteActionModal.codigo_cotizacion, {
        forma_pago: payMethodChoice,
        tipo_pago: payTypeChoice,
      });
      setQuoteActionModal(null);
      onRefresh();
    } catch {
      // keep dialog open on transient error
    } finally {
      setPayingQuote(false);
    }
  };

  const quoteCounts = useMemo(() => {
    const counts = {
      todas: cotizaciones.length,
      pendiente: 0,
      aprobada: 0,
      en_fabricacion: 0,
      completada: 0,
    };
    cotizaciones.forEach((c) => {
      if (c.estado in counts) {
        counts[c.estado] += 1;
      }
    });
    return counts;
  }, [cotizaciones]);

  const classifiedQuotes = useMemo(() => {
    const base =
      quoteStatusFilter === 'todas'
        ? cotizaciones
        : cotizaciones.filter((c) => c.estado === quoteStatusFilter);
    return [...base].sort(
      (a, b) => (QUOTE_STATE_ORDER[a.estado] ?? 9) - (QUOTE_STATE_ORDER[b.estado] ?? 9)
    );
  }, [cotizaciones, quoteStatusFilter]);

  return (
    <div className="h-full overflow-y-auto bg-[#fbf8f3] p-6 lg:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-stone-200 pb-4">
          <div>
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Compras, Datos de Clientes y Cotizaciones · Oruro</span>
            </div>
            <h1 className="font-serif-brand font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
              Bolsa y Pedidos
            </h1>
          </div>

          {/* Dos Opciones Principales */}
          <div className="flex flex-wrap items-center gap-2 bg-stone-100 p-1.5 rounded-2xl border border-stone-200">
            <button
              type="button"
              onClick={() => onChangeTab('compras')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'compras'
                  ? 'bg-slate-900 text-amber-300 shadow-xs'
                  : 'text-stone-700 hover:bg-white'
              }`}
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Pedidos y Datos del Cliente ({pedidos.length})</span>
            </button>
            <button
              type="button"
              onClick={() => onChangeTab('cotizaciones')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
                activeTab === 'cotizaciones'
                  ? 'bg-amber-800 text-white shadow-xs'
                  : 'text-stone-700 hover:bg-white'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Cotizaciones a Medida ({cotizaciones.length})</span>
            </button>
          </div>
        </div>

        {/* OPCIÓN 1: COMPRAS Y DATOS DEL CLIENTE */}
        {activeTab === 'compras' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Active Shopping Bag */}
            <div className="lg:col-span-4 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                  Bolsa Actual ({cartItems.reduce((a, b) => a + b.qty, 0)})
                </h2>
                {cartItems.length > 0 && (
                  <button
                    onClick={onClearCart}
                    className="text-xs text-stone-500 hover:text-red-600 cursor-pointer"
                  >
                    Vaciar
                  </button>
                )}
              </div>

              {cartItems.length === 0 ? (
                <div className="text-center py-10 text-xs text-stone-500">
                  Tu bolsa está vacía. Selecciona muebles en el 3D Interactivo o en el Catálogo para adquirirlos.
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {cartItems.map((line) => {
                      const finish = WOOD_FINISHES[line.finishId];
                      return (
                        <div
                          key={line.id}
                          className="border border-stone-200 rounded-xl p-3 flex flex-col gap-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="font-semibold text-xs text-slate-900">
                                {line.mueble.nombre}
                              </div>
                              <div className="text-[11px] text-stone-500">
                                {finish.label}
                                {line.customDims ? ` · ${line.customDims}` : ''}
                              </div>
                            </div>
                            <button
                              onClick={() => onRemoveCartItem(line.id)}
                              aria-label="Eliminar"
                              className="text-stone-400 hover:text-red-600 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => onUpdateQty(line.id, -1)}
                                className="w-6 h-6 rounded border border-stone-300 flex items-center justify-center cursor-pointer"
                              >
                                <Minus className="w-3 h-3" />
                              </button>
                              <span className="font-mono-data text-xs font-semibold">
                                {line.qty}
                              </span>
                              <button
                                onClick={() => onUpdateQty(line.id, 1)}
                                className="w-6 h-6 rounded border border-stone-300 flex items-center justify-center cursor-pointer"
                              >
                                <Plus className="w-3 h-3" />
                              </button>
                            </div>
                            <span className="font-mono-data text-xs font-semibold text-amber-800">
                              Bs. {(line.unitPriceBs * line.qty).toLocaleString('es-BO')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="bg-stone-50 border border-stone-200 rounded-xl p-3.5 font-mono-data text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-stone-500">Subtotal</span>
                      <span className="font-semibold text-slate-900">
                        Bs. {subtotal.toLocaleString('es-BO')}
                      </span>
                    </div>
                    <div className="flex justify-between text-amber-800">
                      <span>Anticipo 50%</span>
                      <span className="font-semibold">
                        Bs. {Math.round(subtotal * 0.5).toLocaleString('es-BO')}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={onFinalizeCart}
                    className="w-full py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer shadow-sm"
                  >
                    Finalizar Compra y Registrar Cliente
                  </button>
                </>
              )}
            </div>

            {/* Compradores y Datos Completos del Cliente */}
            <div className="lg:col-span-8 bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                    Pedidos y Datos del Cliente ({pedidos.length})
                  </h2>
                  <p className="text-[11px] text-stone-500">
                    Incluye dirección de entrega en Oruro, teléfono, notas y detalle de compra inmediata.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                      <th className="py-3 px-4 font-semibold">Código</th>
                      <th className="py-3 px-4 font-semibold">Datos del Cliente</th>
                      <th className="py-3 px-4 font-semibold">Mueble &amp; Acabado</th>
                      <th className="py-3 px-4 font-semibold">Pago</th>
                      <th className="py-3 px-4 font-semibold">Estado</th>
                      <th className="py-3 px-4 font-semibold text-right">Contacto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {pedidos.map((ped) => {
                      const statusMeta = pedidoEstadoMeta(ped.estado);
                      return (
                      <tr key={ped.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4 font-mono-data font-semibold text-slate-900 whitespace-nowrap">
                          {ped.codigo_pedido}
                        </td>
                        <td className="py-3 px-4 space-y-0.5">
                          <div className="font-semibold text-slate-900">{ped.cliente_nombre}</div>
                          <div className="text-[11px] text-stone-600 font-mono-data">
                            Tel: {ped.cliente_telefono}
                          </div>
                          <div className="text-[11px] text-stone-500 flex items-start gap-1 max-w-[220px]">
                            <MapPin className="w-3 h-3 shrink-0 mt-0.5 text-amber-800" />
                            <span>{ped.direccion_oruro || 'Retiro en Showroom Oruro'}</span>
                          </div>
                          {ped.notas_entrega && (
                            <div className="text-[10px] text-amber-900 bg-amber-50 rounded px-1.5 py-0.5 inline-block">
                              Nota: {ped.notas_entrega}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="space-y-2">
                            {(ped.detalles || []).map((line) => (
                              <div key={line.id} className="border-b border-stone-100 last:border-0 pb-1 last:pb-0">
                                <div className="font-medium text-slate-800">
                                  {line.cantidad} × {line.mueble_nombre}
                                </div>
                                <div className="text-[11px] text-stone-500">
                                  {line.especificaciones} · {line.medidas}
                                </div>
                                <div className="text-[10px] text-stone-500 font-mono-data">
                                  Bs. {line.subtotal.toLocaleString('es-BO')}
                                </div>
                              </div>
                            ))}
                            {(!ped.detalles || ped.detalles.length === 0) && (
                              <div className="font-medium text-slate-800">{ped.mueble_nombre}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono-data whitespace-nowrap">
                          <div className="font-semibold text-amber-800">
                            Bs. {Number(ped.precio_bs ?? ped.total_bs).toLocaleString('es-BO')}
                          </div>
                          <div className="text-[10px] text-stone-500">
                            {formatFormaPagoLabel(ped.metodo_pago)} ·{' '}
                            {ped.estado === 'cotizacion' ? 'Cotización a medida' : 'Compra inmediata'}
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span className={`inline-block px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${statusMeta.className}`}>
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() =>
                              onWhatsAppAlert(
                                `${ped.estado === 'cotizacion' ? 'Cotización' : 'Pedido'} ${ped.codigo_pedido}`,
                                `Cliente: ${ped.cliente_nombre} (${ped.cliente_telefono}). Dirección: ${
                                  ped.direccion_oruro || 'Showroom Oruro'
                                }. Mueble: ${ped.mueble_nombre}. Contáctanos al +591 72418920.`
                              )
                            }
                            className="inline-flex items-center gap-1 py-1.5 px-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-[11px] font-semibold cursor-pointer"
                          >
                            <Phone className="w-3 h-3" />
                            <span>Alerta</span>
                          </button>
                        </td>
                      </tr>
                      );
                    })}
                    {pedidos.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-500">
                          Aún no hay compras registradas.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* OPCIÓN 2: COTIZACIONES A MEDIDA CLASIFICADAS Y POR COLORES */}
        {activeTab === 'cotizaciones' && (
          <div className="space-y-4">
            {/* Clasificación por Estado */}
            <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    {
                      id: 'todas' as const,
                      label: `Todas (${quoteCounts.todas})`,
                      activeCls: 'bg-slate-900 text-amber-300 border-slate-900',
                    },
                    {
                      id: 'pendiente' as const,
                      label: `Pendientes (${quoteCounts.pendiente})`,
                      activeCls: 'bg-amber-600 text-white border-amber-700',
                    },
                    {
                      id: 'aprobada' as const,
                      label: `Aprobadas (${quoteCounts.aprobada})`,
                      activeCls: 'bg-sky-700 text-white border-sky-800',
                    },
                    {
                      id: 'en_fabricacion' as const,
                      label: `En Fabricación (${quoteCounts.en_fabricacion})`,
                      activeCls: 'bg-indigo-700 text-white border-indigo-800',
                    },
                    {
                      id: 'completada' as const,
                      label: `Completadas (${quoteCounts.completada})`,
                      activeCls: 'bg-emerald-700 text-white border-emerald-800',
                    },
                  ]
                ).map((pill) => {
                  const active = quoteStatusFilter === pill.id;
                  return (
                    <button
                      key={pill.id}
                      type="button"
                      onClick={() => setQuoteStatusFilter(pill.id)}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-colors ${
                        active
                          ? pill.activeCls
                          : 'bg-stone-50 hover:bg-stone-100 text-stone-700 border-stone-200'
                      }`}
                    >
                      {pill.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-[11px] text-stone-500">
                Filas clasificadas por color según el estado
              </span>
            </div>

            <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                      <th className="py-3 px-4 font-semibold">Código</th>
                      <th className="py-3 px-4 font-semibold">Cliente</th>
                      <th className="py-3 px-4 font-semibold">Mueble &amp; Medidas</th>
                      <th className="py-3 px-4 font-semibold">Total &amp; Adelanto</th>
                      <th className="py-3 px-4 font-semibold">Estado</th>
                      <th className="py-3 px-4 font-semibold text-right">Mensaje y Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-200/70">
                    {classifiedQuotes.map((cot) => {
                      const meta = QUOTE_STATUS_META[cot.estado] || QUOTE_STATUS_META.pendiente;
                      const pagoBadge = formatEstadoPagoBadge(cot);
                      return (
                        <tr key={cot.id} className={`transition-colors ${meta.rowClass}`}>
                          <td className="py-3.5 px-4 font-mono-data font-bold text-slate-900 whitespace-nowrap">
                            <div>{cot.codigo_cotizacion}</div>
                            <span
                              className={`inline-block mt-1 px-2 py-0.5 rounded-md border text-[10px] font-sans font-semibold ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {cot.cliente_nombre || 'Cliente Showroom'}
                            </div>
                            <div className="text-[11px] text-stone-600 font-mono-data">
                              {cot.cliente_telefono || 'Sin teléfono'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{cot.modelo_base}</div>
                            <div className="text-[11px] text-stone-600">
                              {cot.descripcion_medidas} · {cot.madera_preferida}
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-mono-data whitespace-nowrap">
                            <div className="font-bold text-amber-900">
                              Bs. {Number(cot.precio_estimado_bs).toLocaleString('es-BO')}
                            </div>
                            <div className="text-[10px] text-stone-600">
                              {formatFormaPagoLabel(cot.forma_pago)} · 50%: Bs.{' '}
                              {Number(cot.anticipo_bs).toLocaleString('es-BO')}
                            </div>
                            <span
                              className={`inline-block mt-1 px-1.5 py-0.5 rounded border text-[10px] font-sans font-semibold ${pagoBadge.cls}`}
                            >
                              {pagoBadge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <select
                              value={cot.estado}
                              onChange={(e) =>
                                handleQuoteStatusChange(
                                  cot.codigo_cotizacion,
                                  e.target.value as CotizacionDTO['estado']
                                )
                              }
                              className="px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-[11px] font-semibold"
                            >
                              <option value="pendiente">Pendiente</option>
                              <option value="aprobada">Aprobada</option>
                              <option value="en_fabricacion">En fabricación</option>
                              <option value="completada">Completada</option>
                            </select>
                          </td>
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleOpenQuoteAlert(cot)}
                                className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-300 text-[11px] font-semibold cursor-pointer shadow-xs"
                              >
                                <AlertCircle className="w-3.5 h-3.5" />
                                <span>Ver Estado y Pagar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  onWhatsAppAlert(
                                    `Cotización ${cot.codigo_cotizacion}`,
                                    `${meta.statusMessage} Monto total: Bs. ${Number(
                                      cot.precio_estimado_bs
                                    ).toLocaleString('es-BO')}. Teléfono taller: +591 72418920.`
                                  )
                                }
                                title="Ver contacto WhatsApp"
                                className="p-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                              >
                                <Phone className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {classifiedQuotes.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-stone-500">
                          No hay cotizaciones a medida en este estado.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de Mensaje según Estado y Opción de Pago de Cotización */}
      {quoteActionModal && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="quote-status-pay-title"
          className="fixed inset-0 z-[70] bg-slate-950/75 flex items-center justify-center p-4"
        >
          <div className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4">
            {(() => {
              const meta =
                QUOTE_STATUS_META[quoteActionModal.estado] || QUOTE_STATUS_META.pendiente;
              const pagoBadge = formatEstadoPagoBadge(quoteActionModal);
              return (
                <>
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
                    <div>
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-semibold ${meta.badgeClass}`}
                      >
                        Estado: {meta.label}
                      </span>
                      <h3
                        id="quote-status-pay-title"
                        className="font-serif-brand font-bold text-lg text-slate-900 mt-1"
                      >
                        {meta.messageTitle}
                      </h3>
                      <p className="text-[11px] font-mono-data text-stone-500">
                        {quoteActionModal.codigo_cotizacion} · {quoteActionModal.modelo_base}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setQuoteActionModal(null)}
                      aria-label="Cerrar alerta de estado y pago"
                      className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mensaje de acuerdo al estado */}
                  <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-xs text-stone-700 leading-relaxed">
                    {meta.statusMessage}
                  </div>

                  <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-xs space-y-1.5 font-mono-data">
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-sans">Estado de pago actual:</span>
                      <span
                        className={`px-2 py-0.5 rounded border text-[10px] font-sans font-semibold ${pagoBadge.cls}`}
                      >
                        {pagoBadge.label}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-stone-500 font-sans">Total cotización:</span>
                      <strong className="text-slate-900">
                        Bs. {Number(quoteActionModal.precio_estimado_bs).toLocaleString('es-BO')}
                      </strong>
                    </div>
                    <div className="flex justify-between text-amber-800">
                      <span className="font-sans">Anticipo 50%:</span>
                      <strong>
                        Bs. {Number(quoteActionModal.anticipo_bs).toLocaleString('es-BO')}
                      </strong>
                    </div>
                  </div>

                  {/* Opciones de Pago */}
                  <div className="space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-800">
                      Elige el método y monto a pagar
                    </label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'qr_simple' as const, label: 'QR Simple', icon: QrCode },
                        { id: 'transferencia' as const, label: 'Transferencia', icon: Banknote },
                        { id: 'showroom' as const, label: 'Showroom', icon: Store },
                      ].map((opt) => {
                        const Icon = opt.icon;
                        const active = payMethodChoice === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setPayMethodChoice(opt.id)}
                            className={`p-2 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1 cursor-pointer ${
                              active
                                ? 'bg-slate-900 text-amber-300 border-slate-900'
                                : 'bg-white text-stone-700 border-stone-200'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setPayTypeChoice('anticipo')}
                        className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer ${
                          payTypeChoice === 'anticipo'
                            ? 'bg-amber-50 border-amber-600 text-amber-950 font-semibold'
                            : 'bg-white border-stone-200 text-stone-700'
                        }`}
                      >
                        <div>Anticipo 50%</div>
                        <div className="font-mono-data text-[11px] text-amber-800">
                          Bs. {Number(quoteActionModal.anticipo_bs).toLocaleString('es-BO')}
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPayTypeChoice('total')}
                        className={`p-2.5 rounded-xl border text-left text-xs cursor-pointer ${
                          payTypeChoice === 'total'
                            ? 'bg-emerald-50 border-emerald-600 text-emerald-950 font-semibold'
                            : 'bg-white border-stone-200 text-stone-700'
                        }`}
                      >
                        <div>Pago Total 100%</div>
                        <div className="font-mono-data text-[11px] text-emerald-800">
                          Bs. {Number(quoteActionModal.precio_estimado_bs).toLocaleString('es-BO')}
                        </div>
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setQuoteActionModal(null)}
                      className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
                    >
                      Cerrar
                    </button>
                    <button
                      type="button"
                      disabled={payingQuote}
                      onClick={handleConfirmQuotePayment}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
                    >
                      {payingQuote ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <CreditCard className="w-4 h-4" />
                      )}
                      <span>Registrar Pago</span>
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
