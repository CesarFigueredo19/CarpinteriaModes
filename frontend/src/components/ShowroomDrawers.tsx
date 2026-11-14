import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  CheckCircle2,
  Phone,
  Eye,
  ShoppingBag,
  Ruler,
  QrCode,
  Landmark,
  Store,
  Loader2,
} from 'lucide-react';
import {
  MUEBLES_SHOWROOM,
  MuebleItem,
  WOOD_FINISHES,
  WoodFinishId,
} from '../data/catalog';
import {
  CotizacionResponse,
  crearCotizacion,
  crearPedido,
  PedidoResponse,
  registrarAnticipo,
} from '../services/api';

export interface CartLine {
  id: string;
  mueble: MuebleItem;
  finishId: WoodFinishId;
  qty: number;
  customDims?: string;
  unitPriceBs: number;
}

interface CatalogPanelProps {
  open: boolean;
  stockByKey?: Partial<Record<MuebleItem['key'], number>>;
  onClose: () => void;
  onFocusIn3D: (key: MuebleItem['key'], finishId?: WoodFinishId) => void;
  onAddToCart: (mueble: MuebleItem, finishId: WoodFinishId) => void;
}

export function CatalogPanelDrawer({
  open,
  stockByKey,
  onClose,
  onFocusIn3D,
  onAddToCart,
}: CatalogPanelProps) {
  const [selectedCat, setSelectedCat] = useState<string>('Todos');
  const [cardFinishes, setCardFinishes] = useState<
    Partial<Record<MuebleItem['key'], WoodFinishId>>
  >({});

  const items = useMemo(() => Object.values(MUEBLES_SHOWROOM), []);
  const categories = useMemo(
    () => ['Todos', ...Array.from(new Set(items.map((i) => i.categoria)))],
    [items]
  );

  const filtered = useMemo(
    () =>
      selectedCat === 'Todos'
        ? items
        : items.filter((i) => i.categoria === selectedCat),
    [items, selectedCat]
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex justify-end">
      <div className="w-full max-w-2xl bg-[#fbf8f3] h-full overflow-y-auto shadow-2xl border-l border-stone-200 flex flex-col">
        <div className="px-6 py-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h2 className="font-serif-brand font-semibold text-xl text-amber-50">
              Catálogo de Exhibición · Oruro
            </h2>
            <p className="text-xs text-slate-300 mt-0.5">
              Elige acabado en madera noble y visualiza el modelo 3D al instante.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar catálogo"
            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-3 bg-white border-b border-stone-200 flex items-center gap-1.5 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCat(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                selectedCat === cat
                  ? 'bg-slate-900 text-amber-300 font-semibold'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-5">
          {filtered.map((item) => {
            const activeFinishId = cardFinishes[item.key] || item.defaultFinish;
            const finish = WOOD_FINISHES[activeFinishId];
            const liveStock = stockByKey?.[item.key] ?? item.stock;
            return (
              <div
                key={item.key}
                className="bg-white border border-stone-200 rounded-2xl p-5 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5 shadow-xs"
              >
                <div>
                  <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                    <span>{item.categoria}</span>
                    <span aria-hidden="true">·</span>
                    <span
                      className={`font-semibold ${
                        liveStock > 0 ? 'text-emerald-700' : 'text-amber-700'
                      }`}
                    >
                      {liveStock > 0 ? `Stock Oruro: ${liveStock}` : 'Bajo pedido'}
                    </span>
                  </div>
                  <h3 className="font-serif-brand font-semibold text-base text-slate-900 mt-1">
                    {item.nombre}
                  </h3>
                  <p className="text-xs text-stone-600 mt-1">{item.madera}</p>

                  {/* Technical dimensions breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3 text-center font-mono-data text-[11px]">
                    <div className="bg-stone-50 border border-stone-200 rounded-lg py-1">
                      <span className="text-[10px] text-stone-500 block">Alto</span>
                      <strong className="text-slate-900">{item.alto_cm} cm</strong>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-lg py-1">
                      <span className="text-[10px] text-stone-500 block">Ancho</span>
                      <strong className="text-slate-900">{item.ancho_cm} cm</strong>
                    </div>
                    <div className="bg-stone-50 border border-stone-200 rounded-lg py-1">
                      <span className="text-[10px] text-stone-500 block">Prof.</span>
                      <strong className="text-slate-900">{item.profundidad_cm} cm</strong>
                    </div>
                  </div>

                  {/* Interactive finish selector synced to 3D */}
                  {item.key !== 'sillon' && (
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-[11px] text-stone-500 mb-1.5">
                        <span>Acabado:</span>
                        <span className="font-medium text-slate-800">{finish.shortLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                          const preset = WOOD_FINISHES[fid];
                          const isSelected = activeFinishId === fid;
                          return (
                            <button
                              key={fid}
                              type="button"
                              title={preset.label}
                              onClick={() =>
                                setCardFinishes((prev) => ({ ...prev, [item.key]: fid }))
                              }
                              className={`w-6 h-6 rounded-full border transition-transform cursor-pointer ${
                                isSelected
                                  ? 'ring-2 ring-amber-600 ring-offset-1 scale-105 border-slate-900'
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

                <div className="mt-4 pt-3 border-t border-stone-100">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="font-mono-data text-base font-semibold text-amber-800">
                      Bs. {item.precio_bs.toLocaleString('es-BO')}
                    </span>
                    <span className="text-[11px] text-stone-500 font-mono-data">
                      Anticipo Bs. {item.anticipo_bs.toLocaleString('es-BO')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => {
                        onFocusIn3D(item.key, activeFinishId);
                        onClose();
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <Eye className="w-3.5 h-3.5 text-amber-300" />
                      <span>Ver en 3D</span>
                    </button>
                    <button
                      onClick={() => onAddToCart(item, activeFinishId)}
                      className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>Añadir</span>
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

interface CotizadorModalProps {
  open: boolean;
  initialMueble?: MuebleItem;
  initialFinish?: WoodFinishId;
  onClose: () => void;
  onAddCustomToCart: (
    mueble: MuebleItem,
    finishId: WoodFinishId,
    customDims: string,
    priceBs: number
  ) => void;
  onWhatsAppAlert?: (title: string, detail: string) => void;
}

export function CotizadorModal({
  open,
  initialMueble,
  initialFinish,
  onClose,
  onAddCustomToCart,
  onWhatsAppAlert,
}: CotizadorModalProps) {
  const catalogList = useMemo(() => Object.values(MUEBLES_SHOWROOM), []);
  const [selectedKey, setSelectedKey] = useState<MuebleItem['key']>(
    initialMueble?.key || 'ropero'
  );
  const baseItem = MUEBLES_SHOWROOM[selectedKey];

  const [finishId, setFinishId] = useState<WoodFinishId>(
    initialFinish || baseItem.defaultFinish
  );
  const [alto, setAlto] = useState<number>(baseItem.alto_cm);
  const [ancho, setAncho] = useState<number>(baseItem.ancho_cm);
  const [prof, setProf] = useState<number>(baseItem.profundidad_cm);
  const [conPoliuretano, setConPoliuretano] = useState<boolean>(true);
  const [conCerradura, setConCerradura] = useState<boolean>(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [savedQuote, setSavedQuote] = useState<CotizacionResponse | null>(null);

  useEffect(() => {
    if (open && initialMueble) {
      setSelectedKey(initialMueble.key);
      setFinishId(initialFinish || initialMueble.defaultFinish);
      setAlto(initialMueble.alto_cm);
      setAncho(initialMueble.ancho_cm);
      setProf(initialMueble.profundidad_cm);
    }
    if (open) {
      setSavedQuote(null);
      setErrorMsg(null);
    }
  }, [open, initialMueble, initialFinish]);

  const handleModelChange = (k: MuebleItem['key']) => {
    const next = MUEBLES_SHOWROOM[k];
    setSelectedKey(k);
    setFinishId(next.defaultFinish);
    setAlto(next.alto_cm);
    setAncho(next.ancho_cm);
    setProf(next.profundidad_cm);
    setSavedQuote(null);
  };

  const woodMultipliers: Record<WoodFinishId, number> = {
    mara: 1.15,
    tajibo: 1.12,
    cedro: 1.05,
    roble: 1.0,
    grafito: 0.96,
  };

  const baseVolume = Math.max(
    1,
    baseItem.alto_cm * baseItem.ancho_cm * baseItem.profundidad_cm
  );
  const customVolume = Math.max(1, alto * ancho * prof);
  const scaleFactor = 0.45 + 0.55 * (customVolume / baseVolume);
  const woodFactor = woodMultipliers[finishId] || 1;
  const extras = (conPoliuretano ? 180 : 0) + (conCerradura ? 110 : 0);
  const estimatedPrice =
    Math.round((baseItem.precio_bs * scaleFactor * woodFactor + extras) / 10) * 10;
  const anticipo = Math.round(estimatedPrice * 0.5);

  if (!open) return null;

  const customDimsText = `${alto} × ${ancho} × ${prof} cm`;

  const handleSaveQuote = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const resp = await crearCotizacion({
        cliente_nombre: clienteNombre || undefined,
        cliente_telefono: clienteTelefono || undefined,
        modelo_key: selectedKey,
        finish_id: finishId,
        alto_cm: alto,
        ancho_cm: ancho,
        profundidad_cm: prof,
        con_poliuretano: conPoliuretano,
        con_cerradura: conCerradura,
        notas: notas || undefined,
      });
      setSavedQuote(resp);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo guardar la cotización.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
      <div className="bg-[#fbf8f3] rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-stone-200 text-stone-800 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div>
            <h3 className="font-serif-brand font-semibold text-xl text-slate-900">
              Cotizador Artesanal a Medida
            </h3>
            <p className="text-xs text-stone-500">
              Fabricación personalizada en Oruro · Entrega 12 a 18 días
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar cotizador"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {savedQuote ? (
          <div className="mt-5 bg-white border border-emerald-200 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-700 shrink-0" />
              <div>
                <h4 className="font-serif-brand font-semibold text-lg text-slate-900">
                  Cotización {savedQuote.cotizacion.codigo_cotizacion} Guardada
                </h4>
                <p className="text-xs text-stone-600">
                  {savedQuote.cotizacion.modelo_base} ·{' '}
                  {savedQuote.cotizacion.madera_acabado}
                </p>
              </div>
            </div>

            <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 font-mono-data text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-stone-500">Dimensiones</span>
                <span className="font-semibold text-slate-900">
                  {savedQuote.cotizacion.alto_cm} × {savedQuote.cotizacion.ancho_cm} ×{' '}
                  {savedQuote.cotizacion.profundidad_cm} cm
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Total Estimado</span>
                <span className="font-semibold text-amber-800">
                  Bs. {savedQuote.cotizacion.precio_estimado_bs.toLocaleString('es-BO')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Anticipo taller (50%)</span>
                <span className="font-semibold text-slate-900">
                  Bs. {savedQuote.cotizacion.anticipo_bs.toLocaleString('es-BO')}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                onClick={() => {
                  onAddCustomToCart(
                    baseItem,
                    finishId,
                    customDimsText,
                    savedQuote.cotizacion.precio_estimado_bs
                  );
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Añadir al carrito</span>
              </button>
              <button
                type="button"
                onClick={() =>
                  onWhatsAppAlert?.(
                    `Cotización ${savedQuote.cotizacion.codigo_cotizacion}`,
                    `Comunícate al +591 72418920 con tu código ${savedQuote.cotizacion.codigo_cotizacion} (${savedQuote.cotizacion.modelo_base}, ${savedQuote.cotizacion.alto_cm}×${savedQuote.cotizacion.ancho_cm}×${savedQuote.cotizacion.profundidad_cm} cm, Estimado Bs. ${savedQuote.cotizacion.precio_estimado_bs.toLocaleString('es-BO')}).`
                  )
                }
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Contacto WhatsApp</span>
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSaveQuote} className="space-y-4 mt-4">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1.5">
                Modelo Base
              </label>
              <select
                value={selectedKey}
                onChange={(e) => handleModelChange(e.target.value as MuebleItem['key'])}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-700"
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
                Madera y Acabado
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
                      className={`p-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer transition-colors ${
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

            <div>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-800 mb-1.5">
                <span className="flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-amber-800" />
                  Medidas Requeridas (cm)
                </span>
                <span className="text-stone-400 font-normal">
                  Estándar: {baseItem.alto_cm}×{baseItem.ancho_cm}×{baseItem.profundidad_cm} cm
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Alto (cm)</span>
                  <input
                    type="number"
                    min={40}
                    max={280}
                    value={alto}
                    onChange={(e) => setAlto(Number(e.target.value) || 40)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono-data text-sm"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Ancho (cm)</span>
                  <input
                    type="number"
                    min={40}
                    max={320}
                    value={ancho}
                    onChange={(e) => setAncho(Number(e.target.value) || 40)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono-data text-sm"
                  />
                </div>
                <div>
                  <span className="text-[11px] text-stone-500 block mb-1">Prof. (cm)</span>
                  <input
                    type="number"
                    min={25}
                    max={180}
                    value={prof}
                    onChange={(e) => setProf(Number(e.target.value) || 25)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white font-mono-data text-sm"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <label className="flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conPoliuretano}
                  onChange={(e) => setConPoliuretano(e.target.checked)}
                  className="rounded accent-amber-800"
                />
                <span>Sellado e impermeabilizado poliuretánico (+Bs. 180)</span>
              </label>
              <label className="flex items-center gap-2.5 text-xs text-stone-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conCerradura}
                  onChange={(e) => setConCerradura(e.target.checked)}
                  className="rounded accent-amber-800"
                />
                <span>Herrajes de cierre suave y cerradura metálica (+Bs. 110)</span>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Tu nombre (opcional)"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
              />
              <input
                type="tel"
                placeholder="WhatsApp Oruro (opcional)"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
              />
            </div>

            <input
              type="text"
              placeholder="Notas adicionales para Don Teófilo (ej. divisiones internas)"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
            />

            {/* Summary Box */}
            <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-300">Presupuesto Estimado</div>
                <div className="font-mono-data text-2xl font-semibold text-amber-300">
                  Bs. {estimatedPrice.toLocaleString('es-BO')}
                </div>
              </div>
              <div className="text-right font-mono-data">
                <div className="text-[11px] text-slate-300">Anticipo 50%</div>
                <div className="text-sm font-semibold text-white">
                  Bs. {anticipo.toLocaleString('es-BO')}
                </div>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                {errorMsg}
              </p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs cursor-pointer disabled:opacity-60"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                <span>Guardar Cotización</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onAddCustomToCart(baseItem, finishId, customDimsText, estimatedPrice);
                  onClose();
                }}
                className="flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>Añadir al carrito</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface CartDrawerProps {
  open: boolean;
  items: CartLine[];
  onClose: () => void;
  onUpdateQty: (id: string, delta: number) => void;
  onRemove: (id: string) => void;
  onClear: () => void;
  onOrderCreated?: () => void;
  onWhatsAppAlert?: (title: string, detail: string) => void;
}

export function CartDrawer({
  open,
  items,
  onClose,
  onUpdateQty,
  onRemove,
  onClear,
  onOrderCreated,
  onWhatsAppAlert,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [oruroAddress, setOruroAddress] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'oruro' | 'showroom'>('oruro');
  const [paymentMethod, setPaymentMethod] = useState<'qr_simple' | 'transferencia' | 'showroom'>(
    'qr_simple'
  );
  const [submitting, setSubmitting] = useState(false);
  const [payingAdvance, setPayingAdvance] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [orderResult, setOrderResult] = useState<PedidoResponse | null>(null);
  const [advanceReceipt, setAdvanceReceipt] = useState<string | null>(null);

  if (!open) return null;

  const subtotal = items.reduce((acc, line) => acc + line.unitPriceBs * line.qty, 0);
  const anticipo = Math.round(subtotal * 0.5);
  const deliveryCost = deliveryMode === 'oruro' && subtotal > 0 ? 80 : 0;
  const total = subtotal + deliveryCost;

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const resp = await crearPedido({
        cliente_nombre: customerName,
        cliente_telefono: customerPhone,
        modalidad_entrega: deliveryMode,
        direccion_oruro: deliveryMode === 'oruro' ? oruroAddress : undefined,
        metodo_pago: paymentMethod,
        items: items.map((line) => ({
          key: line.mueble.key,
          finishId: line.finishId,
          qty: line.qty,
          customDims: line.customDims,
          unitPriceBs: line.unitPriceBs,
        })),
      });
      setOrderResult(resp);
      setAdvanceReceipt(null);
      onClear();
      onOrderCreated?.();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo registrar tu pedido.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayAdvance = async () => {
    if (!orderResult) return;
    setPayingAdvance(true);
    setErrorMsg(null);
    try {
      const res = await registrarAnticipo({
        codigo_pedido: orderResult.pedido.codigo_pedido,
        metodo_pago: paymentMethod,
      });
      setAdvanceReceipt(res.referencia_pago);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al registrar el anticipo.'
      );
    } finally {
      setPayingAdvance(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 flex justify-end">
      <div className="w-full max-w-md bg-[#fbf8f3] h-full overflow-y-auto shadow-2xl border-l border-stone-200 flex flex-col">
        <div className="px-6 py-5 bg-slate-900 text-white border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="font-serif-brand font-semibold text-xl text-amber-50">
              Bolsa de Compra · Mueblería Modes
            </h2>
            <p className="text-xs text-slate-300">
              Pedido directo con inventario en Oruro, Bolivia
            </p>
          </div>
          <button
            onClick={() => {
              setOrderResult(null);
              setAdvanceReceipt(null);
              onClose();
            }}
            aria-label="Cerrar carrito"
            className="p-2 rounded-lg text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 p-6">
          {orderResult ? (
            <div className="bg-white border border-emerald-200 rounded-2xl p-6 space-y-4 shadow-sm">
              <div className="text-center">
                <CheckCircle2 className="w-10 h-10 text-emerald-700 mx-auto mb-2" />
                <h3 className="font-serif-brand font-semibold text-lg text-slate-900">
                  Pedido {orderResult.pedido.codigo_pedido} Confirmado
                </h3>
                <p className="text-xs text-stone-600 mt-1.5 leading-relaxed">
                  Registrado para <strong>{orderResult.pedido.cliente_nombre}</strong> (WhatsApp{' '}
                  <strong>{orderResult.pedido.cliente_telefono}</strong>).
                </p>
              </div>

              <div className="bg-stone-50 rounded-xl p-3.5 border border-stone-200 font-mono-data text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Pedido</span>
                  <span className="font-semibold text-slate-900">
                    Bs. {orderResult.pedido.total_bs.toLocaleString('es-BO')}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800 font-semibold">
                  <span>Anticipo 50%</span>
                  <span>Bs. {orderResult.pedido.anticipo_bs.toLocaleString('es-BO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Estado de Pago</span>
                  <span
                    className={`font-semibold ${
                      advanceReceipt ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {advanceReceipt
                      ? `Anticipo Verificado (${advanceReceipt})`
                      : 'Pendiente de Anticipo'}
                  </span>
                </div>
              </div>

              {!advanceReceipt && (
                <button
                  onClick={handlePayAdvance}
                  disabled={payingAdvance}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {payingAdvance ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span>
                    Registrar Anticipo 50% (Bs.{' '}
                    {orderResult.pedido.anticipo_bs.toLocaleString('es-BO')})
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onWhatsAppAlert?.(
                    `Pedido ${orderResult.pedido.codigo_pedido}`,
                    `Para coordinar tu entrega o enviar tu comprobante de anticipo (Bs. ${orderResult.pedido.anticipo_bs.toLocaleString('es-BO')}), contáctanos al +591 72418920 indicando el código ${orderResult.pedido.codigo_pedido}.`
                  )
                }
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
              >
                <Phone className="w-4 h-4" />
                <span>Contacto WhatsApp Oruro</span>
              </button>

              <button
                onClick={() => {
                  setOrderResult(null);
                  setAdvanceReceipt(null);
                  onClose();
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
              >
                Volver al Showroom 3D
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-14">
              <ShoppingBag className="w-10 h-10 text-stone-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-800">Tu bolsa está vacía</p>
              <p className="text-xs text-stone-500 mt-1">
                Haz clic en cualquier mueble del Showroom 3D para rotarlo, elegir madera y añadirlo a tu pedido.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((line) => {
                const finish = WOOD_FINISHES[line.finishId];
                return (
                  <div
                    key={line.id}
                    className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col gap-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h4 className="font-semibold text-sm text-slate-900">
                          {line.mueble.nombre}
                        </h4>
                        <div className="text-xs text-stone-500 mt-0.5 flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-full border border-black/20 inline-block"
                            style={{ backgroundColor: finish.swatchHex }}
                          />
                          <span>{finish.label}</span>
                          {line.customDims && <span>· {line.customDims}</span>}
                        </div>
                      </div>
                      <button
                        onClick={() => onRemove(line.id)}
                        title="Eliminar artículo"
                        aria-label="Eliminar artículo"
                        className="text-stone-400 hover:text-red-600 p-1 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-stone-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onUpdateQty(line.id, -1)}
                          className="w-7 h-7 rounded-lg border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono-data text-sm font-semibold w-5 text-center">
                          {line.qty}
                        </span>
                        <button
                          onClick={() => onUpdateQty(line.id, 1)}
                          className="w-7 h-7 rounded-lg border border-stone-300 flex items-center justify-center hover:bg-stone-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-mono-data text-sm font-semibold text-amber-800">
                        Bs. {(line.unitPriceBs * line.qty).toLocaleString('es-BO')}
                      </span>
                    </div>
                  </div>
                );
              })}

              <form onSubmit={handleConfirm} className="pt-4 border-t border-stone-200 space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('oruro')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                      deliveryMode === 'oruro'
                        ? 'bg-slate-900 text-amber-300 border-slate-900'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    Envío Oruro (+Bs. 80)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeliveryMode('showroom')}
                    className={`py-2 px-3 rounded-xl text-xs font-semibold border cursor-pointer ${
                      deliveryMode === 'showroom'
                        ? 'bg-slate-900 text-amber-300 border-slate-900'
                        : 'bg-white text-stone-700 border-stone-300'
                    }`}
                  >
                    Retiro en Showroom
                  </button>
                </div>

                {/* Payment Method for 50% Anticipo */}
                <div>
                  <span className="block text-[11px] font-semibold text-stone-600 mb-1.5">
                    Modalidad de Anticipo (50% en Bolivianos)
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qr_simple')}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'qr_simple'
                          ? 'bg-amber-50 border-amber-700 text-amber-900 font-semibold'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Simple</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('transferencia')}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'transferencia'
                          ? 'bg-amber-50 border-amber-700 text-amber-900 font-semibold'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <Landmark className="w-3.5 h-3.5" />
                      <span>Transferencia</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('showroom')}
                      className={`py-2 px-2 rounded-xl border text-[11px] font-medium flex flex-col items-center gap-1 cursor-pointer ${
                        paymentMethod === 'showroom'
                          ? 'bg-amber-50 border-amber-700 text-amber-900 font-semibold'
                          : 'bg-white border-stone-200 text-stone-600'
                      }`}
                    >
                      <Store className="w-3.5 h-3.5" />
                      <span>En Tienda</span>
                    </button>
                  </div>
                </div>

                <input
                  type="text"
                  required
                  placeholder="Nombre completo"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
                />
                <input
                  type="tel"
                  required
                  placeholder="Celular / WhatsApp (ej. 72418920)"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
                />
                {deliveryMode === 'oruro' && (
                  <input
                    type="text"
                    placeholder="Zona / Dirección de entrega en Oruro"
                    value={oruroAddress}
                    onChange={(e) => setOruroAddress(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
                  />
                )}

                <div className="bg-white rounded-2xl p-4 space-y-1.5 font-mono-data text-xs border border-stone-200">
                  <div className="flex justify-between text-stone-600">
                    <span>Subtotal</span>
                    <span>Bs. {subtotal.toLocaleString('es-BO')}</span>
                  </div>
                  <div className="flex justify-between text-stone-600">
                    <span>Despacho Oruro</span>
                    <span>{deliveryCost === 0 ? 'Gratis' : `Bs. ${deliveryCost}`}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-semibold text-sm pt-1.5 border-t border-stone-200">
                    <span>Total de la compra</span>
                    <span>Bs. {total.toLocaleString('es-BO')}</span>
                  </div>
                  <div className="flex justify-between text-amber-800 font-semibold">
                    <span>Anticipo requerido (50%)</span>
                    <span>Bs. {anticipo.toLocaleString('es-BO')}</span>
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={onClear}
                    className="py-3 px-3.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-700 font-semibold text-xs cursor-pointer"
                  >
                    Vaciar
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                    <span>Confirmar Pedido</span>
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
