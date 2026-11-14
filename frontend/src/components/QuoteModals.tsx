import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  Box,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  Minus,
  Pencil,
  Plus,
  QrCode,
  RotateCcw,
  Ruler,
  Store,
  UserPlus,
  X,
} from 'lucide-react';
import {
  BaseModel3DKey,
  MUEBLES_SHOWROOM,
  MuebleItem,
  WOOD_FINISHES,
  WoodFinishId,
} from '../data/catalog';
import {
  ClienteDTO,
  CotizacionDTO,
  appService,
} from '../services/appService';
import { clampDimensionValue, getDimensionBounds } from '../utils/pricing';
import { FloatingQuote3DPreview } from './FloatingQuote3DPreview';
import type { PieceDimensionsCm } from './Tienda3D';

export type QuotePaymentMethod = 'qr_simple' | 'transferencia' | 'showroom';

export function computeCotizacionEstimateBs(
  baseItem: MuebleItem,
  finishId: WoodFinishId,
  altoCm: number,
  anchoCm: number,
  profCm: number,
  conPoliuretano: boolean,
  conCerradura: boolean
) {
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
  const customVolume = Math.max(1, altoCm * anchoCm * profCm);
  const scaleFactor = 0.45 + 0.55 * (customVolume / baseVolume);
  const extras = (conPoliuretano ? 180 : 0) + (conCerradura ? 110 : 0);
  const precioBs =
    Math.round(
      (baseItem.precio_bs * scaleFactor * (woodMultipliers[finishId] || 1) + extras) / 10
    ) * 10;
  return {
    precioBs,
    anticipoBs: Math.round(precioBs * 0.5),
  };
}

// ============================================================================
// 1. Alerta previa de Forma de Pago y Adelanto antes de registrar cotización
// ============================================================================
interface QuotePaymentAlertModalProps {
  open: boolean;
  summary: {
    modeloNombre: string;
    maderaLabel: string;
    medidasLabel: string;
    clienteNombre?: string;
    precioTotalBs: number;
    anticipoBs: number;
  } | null;
  submitting: boolean;
  onCancel: () => void;
  onConfirm: (formaPago: QuotePaymentMethod, dejaAnticipo: boolean) => void;
}

export function QuotePaymentAlertModal({
  open,
  summary,
  submitting,
  onCancel,
  onConfirm,
}: QuotePaymentAlertModalProps) {
  const [formaPago, setFormaPago] = useState<QuotePaymentMethod>('qr_simple');
  const [dejaAnticipo, setDejaAnticipo] = useState<boolean>(true);

  useEffect(() => {
    if (open) {
      setFormaPago('qr_simple');
      setDejaAnticipo(true);
    }
  }, [open]);

  if (!open || !summary) return null;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="quote-payment-alert-title"
      className="fixed inset-0 z-[70] bg-slate-950/75 flex items-center justify-center p-4"
    >
      <div className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 border border-amber-200 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3
                id="quote-payment-alert-title"
                className="font-serif-brand font-bold text-base sm:text-lg text-slate-900"
              >
                Forma de Pago y Adelanto
              </h3>
              <p className="text-[11px] text-stone-500">
                Confirma antes de enviar la cotización a Bolsa y Pedidos
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            aria-label="Cancelar confirmación"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Summary Box */}
        <div className="bg-white border border-stone-200 rounded-xl p-3.5 text-xs space-y-1.5">
          <div className="font-semibold text-slate-900">{summary.modeloNombre}</div>
          <div className="text-stone-600">
            {summary.maderaLabel} · {summary.medidasLabel}
          </div>
          {summary.clienteNombre && (
            <div className="text-stone-600">
              Cliente: <strong className="text-slate-900">{summary.clienteNombre}</strong>
            </div>
          )}
          <div className="pt-2 mt-1.5 border-t border-stone-100 flex items-center justify-between font-mono-data">
            <span className="text-stone-500">Total estimado:</span>
            <strong className="text-sm text-slate-900">
              Bs. {summary.precioTotalBs.toLocaleString('es-BO')}
            </strong>
          </div>
          <div className="flex items-center justify-between font-mono-data text-amber-800">
            <span>Adelanto sugerido (50%):</span>
            <strong>Bs. {summary.anticipoBs.toLocaleString('es-BO')}</strong>
          </div>
        </div>

        {/* Payment Method Choice */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-800">
            1. Selecciona la forma de pago
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'qr_simple' as const, label: 'QR Simple', icon: QrCode },
              { id: 'transferencia' as const, label: 'Transferencia', icon: Banknote },
              { id: 'showroom' as const, label: 'En Showroom', icon: Store },
            ].map((opt) => {
              const Icon = opt.icon;
              const active = formaPago === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormaPago(opt.id)}
                  className={`p-2.5 rounded-xl border text-[11px] font-semibold flex flex-col items-center gap-1.5 cursor-pointer transition-colors ${
                    active
                      ? 'bg-slate-900 text-amber-300 border-slate-900 shadow-xs'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Advance Toggle Choice */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-800">
            2. ¿Deseas dejar un adelanto ahora?
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setDejaAnticipo(true)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                dejaAnticipo
                  ? 'bg-emerald-50 border-emerald-600 text-emerald-950'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                <span>Sí, dejar adelanto</span>
                {dejaAnticipo && <CheckCircle2 className="w-4 h-4 text-emerald-700" />}
              </div>
              <div className="font-mono-data text-[11px] font-semibold text-emerald-800 mt-1">
                50%: Bs. {summary.anticipoBs.toLocaleString('es-BO')}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setDejaAnticipo(false)}
              className={`p-3 rounded-xl border text-left cursor-pointer transition-colors ${
                !dejaAnticipo
                  ? 'bg-amber-50 border-amber-600 text-amber-950'
                  : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'
              }`}
            >
              <div className="text-xs font-bold flex items-center justify-between">
                <span>Sin adelanto</span>
                {!dejaAnticipo && <CheckCircle2 className="w-4 h-4 text-amber-800" />}
              </div>
              <div className="text-[11px] text-stone-600 mt-1">
                Pagar después en Bolsa y Pedidos
              </div>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onConfirm(formaPago, dejaAnticipo)}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 shadow-sm"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            <span>Confirmar e ir a Bolsa y Pedidos</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 2. Modal Rápido para Registrar Nuevo Cliente desde Cotización a Medida
// ============================================================================
interface NewClientQuickModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (cliente: ClienteDTO) => void;
}

export function NewClientQuickModal({
  open,
  onClose,
  onCreated,
}: NewClientQuickModalProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const cli = await appService.registrarOActualizarCliente({
        nombre,
        telefono,
        direccion,
        notas,
      });
      setNombre('');
      setTelefono('');
      setDireccion('');
      setNotas('');
      onCreated(cli);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo registrar al cliente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-client-title"
      className="fixed inset-0 z-[65] bg-slate-950/75 flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#fbf8f3] border border-stone-200 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-3.5 text-slate-900"
      >
        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-amber-800" />
            <h3 id="quick-client-title" className="font-serif-brand font-bold text-base">
              Registrar Nuevo Cliente
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar registro de cliente"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-stone-600">
          Guarda los datos del cliente y selecciónalo automáticamente en tu cotización.
        </p>

        <input
          type="text"
          required
          placeholder="Nombre completo *"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
        />
        <input
          type="tel"
          required
          placeholder="Teléfono / WhatsApp (ej. 72418920) *"
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
        />
        <input
          type="text"
          required
          placeholder="Dirección en Oruro *"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
        />
        <input
          type="text"
          placeholder="Notas adicionales (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
        />

        {error && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            <span>Guardar y Seleccionar</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 3. Ventana Flotante de Cotización a Medida (para Don Teófilo 3D y Clientes)
// ============================================================================
interface FloatingCotizacionModalProps {
  open: boolean;
  sourceLabel?: string;
  initialCliente?: ClienteDTO | null;
  initialModelKey?: MuebleItem['key'];
  initialFinishId?: WoodFinishId;
  clientes?: ClienteDTO[];
  onClose: () => void;
  onSuccess: (created: CotizacionDTO) => void;
  onViewInShowroom3D?: (
    key: BaseModel3DKey,
    finishId: WoodFinishId,
    dims: PieceDimensionsCm
  ) => void;
}

export function FloatingCotizacionModal({
  open,
  sourceLabel = 'Taller de Don Teófilo · Cotización a Medida',
  initialCliente = null,
  initialModelKey = 'ropero',
  initialFinishId,
  clientes = [],
  onClose,
  onSuccess,
  onViewInShowroom3D,
}: FloatingCotizacionModalProps) {
  const catalogList = useMemo(() => Object.values(MUEBLES_SHOWROOM), []);
  const [selectedKey, setSelectedKey] = useState<MuebleItem['key']>(initialModelKey);
  const baseItem = MUEBLES_SHOWROOM[selectedKey] || MUEBLES_SHOWROOM.ropero;
  const bounds = useMemo(() => getDimensionBounds(baseItem), [baseItem]);

  const [finishId, setFinishId] = useState<WoodFinishId>(
    initialFinishId || baseItem.defaultFinish
  );
  const [alto, setAlto] = useState(baseItem.alto_cm);
  const [ancho, setAncho] = useState(baseItem.ancho_cm);
  const [prof, setProf] = useState(baseItem.profundidad_cm);
  const [conPoliuretano, setConPoliuretano] = useState(true);
  const [conCerradura, setConCerradura] = useState(false);

  const [clienteNombre, setClienteNombre] = useState(initialCliente?.nombre || '');
  const [clienteTelefono, setClienteTelefono] = useState(initialCliente?.telefono || '');
  const [clienteDireccion, setClienteDireccion] = useState(initialCliente?.direccion || '');
  const [notas, setNotas] = useState('');
  const [quickClientOpen, setQuickClientOpen] = useState(false);

  const [paymentAlertOpen, setPaymentAlertOpen] = useState(false);
  const [preview3DOpen, setPreview3DOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setPreview3DOpen(false);
      return;
    }
    const nextItem = MUEBLES_SHOWROOM[initialModelKey] || MUEBLES_SHOWROOM.ropero;
    setSelectedKey(nextItem.key);
    setFinishId(initialFinishId || nextItem.defaultFinish);
    setAlto(nextItem.alto_cm);
    setAncho(nextItem.ancho_cm);
    setProf(nextItem.profundidad_cm);
    setClienteNombre(initialCliente?.nombre || '');
    setClienteTelefono(initialCliente?.telefono || '');
    setClienteDireccion(initialCliente?.direccion || '');
    setNotas('');
    setErrorMsg(null);
  }, [open, initialCliente, initialModelKey, initialFinishId]);

  if (!open) return null;

  const { precioBs, anticipoBs } = computeCotizacionEstimateBs(
    baseItem,
    finishId,
    alto,
    ancho,
    prof,
    conPoliuretano,
    conCerradura
  );

  const handleModelChange = (k: MuebleItem['key']) => {
    const next = MUEBLES_SHOWROOM[k];
    setSelectedKey(k);
    setFinishId(next.defaultFinish);
    setAlto(next.alto_cm);
    setAncho(next.ancho_cm);
    setProf(next.profundidad_cm);
  };

  const handleOpenPaymentAlert = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setPaymentAlertOpen(true);
  };

  const handleConfirmSave = async (formaPago: QuotePaymentMethod, dejaAnticipo: boolean) => {
    setSubmitting(true);
    setErrorMsg(null);
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
        precio_estimado_bs: precioBs,
        con_poliuretano: conPoliuretano,
        con_cerradura: conCerradura,
        forma_pago: formaPago,
        deja_anticipo: dejaAnticipo,
        notas: notas || undefined,
      });
      setPaymentAlertOpen(false);
      onSuccess(created);
    } catch (err) {
      setPaymentAlertOpen(false);
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo guardar la cotización.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="floating-cotizacion-title"
        className="fixed inset-0 z-[55] bg-slate-950/70 flex items-center justify-center p-4"
      >
        <form
          onSubmit={handleOpenPaymentAlert}
          className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4"
        >
          <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
            <div>
              <div className="text-[11px] font-semibold text-amber-800 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5" />
                <span>{sourceLabel}</span>
              </div>
              <h3
                id="floating-cotizacion-title"
                className="font-serif-brand font-bold text-lg text-slate-900 mt-0.5"
              >
                Cotización a Medida Flotante
              </h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar ventana flotante de cotización"
              className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Client details + New client option */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">Datos del Cliente</span>
              <button
                type="button"
                onClick={() => setQuickClientOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 text-[11px] font-semibold cursor-pointer"
              >
                <UserPlus className="w-3 h-3" />
                <span>Nuevo Cliente</span>
              </button>
            </div>

            {clientes.length > 0 && !initialCliente && (
              <select
                defaultValue=""
                onChange={(e) => {
                  const c = clientes.find((cl) => cl.id === e.target.value);
                  if (c) {
                    setClienteNombre(c.nombre);
                    setClienteTelefono(c.telefono);
                    setClienteDireccion(c.direccion);
                  }
                }}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs"
              >
                <option value="">-- Seleccionar cliente registrado (opcional) --</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre} ({c.telefono})
                  </option>
                ))}
              </select>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                required
                placeholder="Nombre completo del cliente *"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
              <input
                type="tel"
                required
                placeholder="Teléfono / WhatsApp *"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                className="px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>
            <input
              type="text"
              placeholder="Dirección en Oruro (opcional)"
              value={clienteDireccion}
              onChange={(e) => setClienteDireccion(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
            />
          </div>

          {/* Model & Wood */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Mueble Base
              </label>
              <select
                value={selectedKey}
                onChange={(e) => handleModelChange(e.target.value as MuebleItem['key'])}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
              >
                {catalogList.map((m) => (
                  <option key={m.key} value={m.key}>
                    {m.nombre} (Bs. {m.precio_bs})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-800 mb-1">
                Madera ({WOOD_FINISHES[finishId].shortLabel})
              </label>
              <div className="grid grid-cols-5 gap-1">
                {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                  const preset = WOOD_FINISHES[fid];
                  const active = finishId === fid;
                  return (
                    <button
                      key={fid}
                      type="button"
                      title={preset.label}
                      onClick={() => setFinishId(fid)}
                      className={`py-1.5 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] cursor-pointer ${
                        active
                          ? 'border-amber-800 bg-amber-50 font-semibold text-amber-950'
                          : 'border-stone-200 bg-white text-stone-600'
                      }`}
                    >
                      <span
                        className="w-3.5 h-3.5 rounded-full border border-black/20"
                        style={{ backgroundColor: preset.swatchHex }}
                      />
                      <span>{preset.shortLabel}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Editable Dimensions */}
          <div className="bg-white border border-stone-200 rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
              <span className="flex items-center gap-1.5">
                <Ruler className="w-3.5 h-3.5 text-amber-800" />
                <span>Medidas a Medida (cm)</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setAlto(baseItem.alto_cm);
                  setAncho(baseItem.ancho_cm);
                  setProf(baseItem.profundidad_cm);
                }}
                className="text-[11px] text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Estándar</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Alto', val: alto, min: bounds.alto.min, max: bounds.alto.max, set: setAlto },
                { label: 'Ancho', val: ancho, min: bounds.ancho.min, max: bounds.ancho.max, set: setAncho },
                { label: 'Prof.', val: prof, min: bounds.prof.min, max: bounds.prof.max, set: setProf },
              ].map((d) => (
                <div key={d.label} className="bg-stone-50 border border-stone-200 rounded-lg p-2 space-y-1">
                  <div className="flex justify-between text-[10px] text-stone-500">
                    <span className="font-semibold text-slate-700">{d.label}</span>
                    <span className="font-mono-data">
                      {d.min}-{d.max}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => d.set(clampDimensionValue(d.val - 5, d.min, d.max))}
                      className="w-5 h-6 rounded border border-stone-300 bg-white flex items-center justify-center cursor-pointer"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <input
                      type="number"
                      min={d.min}
                      max={d.max}
                      value={d.val}
                      onChange={(e) => {
                        const n = Number(e.target.value);
                        if (!Number.isNaN(n)) d.set(Math.max(10, Math.min(400, Math.round(n))));
                      }}
                      onBlur={(e) =>
                        d.set(clampDimensionValue(Number(e.target.value) || d.min, d.min, d.max))
                      }
                      className="w-full min-w-0 text-center font-mono-data text-xs font-semibold bg-white border border-stone-200 rounded py-0.5"
                    />
                    <button
                      type="button"
                      onClick={() => d.set(clampDimensionValue(d.val + 5, d.min, d.max))}
                      className="w-5 h-6 rounded border border-stone-300 bg-white flex items-center justify-center cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={conPoliuretano}
                onChange={(e) => setConPoliuretano(e.target.checked)}
                className="accent-amber-800"
              />
              <span>Poliuretano (+Bs. 180)</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={conCerradura}
                onChange={(e) => setConCerradura(e.target.checked)}
                className="accent-amber-800"
              />
              <span>Herrajes / Cerradura (+Bs. 110)</span>
            </label>
          </div>

          <input
            type="text"
            placeholder="Notas o detalles internos para Don Teófilo..."
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
          />

          <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between font-mono-data">
            <div>
              <span className="text-[11px] text-slate-300 block">Presupuesto Estimado</span>
              <strong className="text-lg text-amber-300">
                Bs. {precioBs.toLocaleString('es-BO')}
              </strong>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-slate-300 block">Adelanto 50%</span>
              <strong className="text-sm text-white">
                Bs. {anticipoBs.toLocaleString('es-BO')}
              </strong>
            </div>
          </div>

          {errorMsg && (
            <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPreview3DOpen((v) => !v)}
              className={`py-2.5 px-3.5 rounded-xl border font-semibold text-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                preview3DOpen
                  ? 'bg-slate-900 border-slate-900 text-amber-300'
                  : 'bg-stone-100 hover:bg-stone-200 border-stone-300 text-slate-900'
              }`}
            >
              <Box className="w-3.5 h-3.5 text-amber-700" />
              <span>{preview3DOpen ? 'Ocultar 3D' : 'Ver en 3D'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-3.5 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer"
            >
              Continuar al Pago y Bolsa
            </button>
          </div>
        </form>
      </div>

      <FloatingQuote3DPreview
        open={preview3DOpen}
        onToggleOpen={setPreview3DOpen}
        modelKey={selectedKey}
        finishId={finishId}
        onChangeFinish={setFinishId}
        altoCm={alto}
        anchoCm={ancho}
        profCm={prof}
        onChangeAlto={setAlto}
        onChangeAncho={setAncho}
        onChangeProf={setProf}
        onResetDims={() => {
          setAlto(baseItem.alto_cm);
          setAncho(baseItem.ancho_cm);
          setProf(baseItem.profundidad_cm);
        }}
        estimatedPriceBs={precioBs}
        anticipoBs={anticipoBs}
        zIndexClass="z-[62]"
        onOpenInShowroom3D={(key, fid, dims) => {
          setPreview3DOpen(false);
          if (onViewInShowroom3D) {
            onClose();
            onViewInShowroom3D(key, fid, dims);
          }
        }}
      />

      <NewClientQuickModal
        open={quickClientOpen}
        onClose={() => setQuickClientOpen(false)}
        onCreated={(cli) => {
          setClienteNombre(cli.nombre);
          setClienteTelefono(cli.telefono);
          setClienteDireccion(cli.direccion);
        }}
      />

      <QuotePaymentAlertModal
        open={paymentAlertOpen}
        summary={{
          modeloNombre: baseItem.nombre,
          maderaLabel: WOOD_FINISHES[finishId].label,
          medidasLabel: `${alto} × ${ancho} × ${prof} cm`,
          clienteNombre: clienteNombre || undefined,
          precioTotalBs: precioBs,
          anticipoBs,
        }}
        submitting={submitting}
        onCancel={() => setPaymentAlertOpen(false)}
        onConfirm={handleConfirmSave}
      />
    </>
  );
}

// ============================================================================
// 4. Helper de resolución + Modal para Editar Toda la Cotización
// ============================================================================
export function resolveQuoteCatalogPair(cot: CotizacionDTO): {
  baseItem: MuebleItem;
  finishId: WoodFinishId;
} {
  const baseItem =
    Object.values(MUEBLES_SHOWROOM).find(
      (m) =>
        m.nombre.toLowerCase() === cot.modelo_base.toLowerCase() ||
        cot.modelo_base.toLowerCase().includes(m.key.replace('_', ' '))
    ) || MUEBLES_SHOWROOM.ropero;

  const finishId =
    (Object.values(WOOD_FINISHES).find(
      (f) =>
        f.label.toLowerCase() === cot.madera_preferida.toLowerCase() ||
        cot.madera_preferida.toLowerCase().includes(f.shortLabel.toLowerCase())
    )?.id as WoodFinishId | undefined) || baseItem.defaultFinish;

  return { baseItem, finishId };
}

function defaultDeliveryDateStr(cot: CotizacionDTO): string {
  if (cot.fecha_entrega && /^\d{4}-\d{2}-\d{2}$/.test(cot.fecha_entrega)) {
    return cot.fecha_entrega;
  }
  const base = new Date(cot.created_at || Date.now());
  base.setDate(base.getDate() + 7);
  return base.toISOString().slice(0, 10);
}

const QUOTE_READONLY_BADGE: Record<
  CotizacionDTO['estado'],
  { label: string; cls: string }
> = {
  pendiente: { label: 'Pendiente', cls: 'bg-amber-100 text-amber-900 border-amber-300' },
  aprobada: { label: 'Aprobada', cls: 'bg-sky-100 text-sky-900 border-sky-300' },
  en_fabricacion: {
    label: 'En fabricación',
    cls: 'bg-indigo-100 text-indigo-900 border-indigo-300',
  },
  completada: { label: 'Completada', cls: 'bg-emerald-100 text-emerald-900 border-emerald-300' },
};

interface EditCotizacionModalProps {
  cotizacion: CotizacionDTO | null;
  onClose: () => void;
  onSaved: (updated: CotizacionDTO) => void;
}

export function EditCotizacionModal({
  cotizacion,
  onClose,
  onSaved,
}: EditCotizacionModalProps) {
  const catalogList = useMemo(() => Object.values(MUEBLES_SHOWROOM), []);
  const [selectedKey, setSelectedKey] = useState<MuebleItem['key']>('ropero');
  const [finishId, setFinishId] = useState<WoodFinishId>('mara');
  const [alto, setAlto] = useState(210);
  const [ancho, setAncho] = useState(180);
  const [prof, setProf] = useState(60);
  const [conPoliuretano, setConPoliuretano] = useState(true);
  const [conCerradura, setConCerradura] = useState(false);
  const [clienteNombre, setClienteNombre] = useState('');
  const [clienteTelefono, setClienteTelefono] = useState('');
  const [fechaEntrega, setFechaEntrega] = useState('');
  const [notas, setNotas] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!cotizacion) return;
    const { baseItem, finishId: fId } = resolveQuoteCatalogPair(cotizacion);
    const b = getDimensionBounds(baseItem);
    setSelectedKey(baseItem.key);
    setFinishId(fId);
    setAlto(clampDimensionValue(Number(cotizacion.alto_cm) || baseItem.alto_cm, b.alto.min, b.alto.max));
    setAncho(clampDimensionValue(Number(cotizacion.ancho_cm) || baseItem.ancho_cm, b.ancho.min, b.ancho.max));
    setProf(
      clampDimensionValue(
        Number(cotizacion.profundidad_cm) || baseItem.profundidad_cm,
        b.prof.min,
        b.prof.max
      )
    );
    setConPoliuretano(Boolean(cotizacion.con_poliuretano));
    setConCerradura(Boolean(cotizacion.con_cerradura));
    setClienteNombre(cotizacion.cliente_nombre || '');
    setClienteTelefono(cotizacion.cliente_telefono || '');
    setFechaEntrega(defaultDeliveryDateStr(cotizacion));
    setNotas(cotizacion.notas || '');
    setErrorMsg(null);
  }, [cotizacion]);

  if (!cotizacion) return null;

  const baseItem = MUEBLES_SHOWROOM[selectedKey] || MUEBLES_SHOWROOM.ropero;
  const bounds = getDimensionBounds(baseItem);
  const { precioBs, anticipoBs } = computeCotizacionEstimateBs(
    baseItem,
    finishId,
    alto,
    ancho,
    prof,
    conPoliuretano,
    conCerradura
  );
  const statusInfo = QUOTE_READONLY_BADGE[cotizacion.estado] || QUOTE_READONLY_BADGE.pendiente;

  const handleModelSwitch = (k: MuebleItem['key']) => {
    const next = MUEBLES_SHOWROOM[k];
    setSelectedKey(k);
    setFinishId(next.defaultFinish);
    setAlto(next.alto_cm);
    setAncho(next.ancho_cm);
    setProf(next.profundidad_cm);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrorMsg(null);
    try {
      const updated = await appService.actualizarCotizacionCompleta(
        cotizacion.codigo_cotizacion,
        {
          cliente_nombre: clienteNombre,
          cliente_telefono: clienteTelefono,
          modelo_key: selectedKey,
          finish_id: finishId,
          alto_cm: clampDimensionValue(alto, bounds.alto.min, bounds.alto.max),
          ancho_cm: clampDimensionValue(ancho, bounds.ancho.min, bounds.ancho.max),
          profundidad_cm: clampDimensionValue(prof, bounds.prof.min, bounds.prof.max),
          con_poliuretano: conPoliuretano,
          con_cerradura: conCerradura,
          fecha_entrega: fechaEntrega,
          notas,
        }
      );
      onSaved(updated);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo actualizar la cotización.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-cotizacion-title"
      className="fixed inset-0 z-[65] bg-slate-950/75 flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono-data font-bold text-amber-800">
                {cotizacion.codigo_cotizacion}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusInfo.cls}`}
              >
                {statusInfo.label} (Solo lectura)
              </span>
            </div>
            <h3
              id="edit-cotizacion-title"
              className="font-serif-brand font-bold text-lg text-slate-900 mt-0.5 flex items-center gap-1.5"
            >
              <Pencil className="w-4 h-4 text-amber-800" />
              <span>Editar Toda la Cotización</span>
            </h3>
            <p className="text-[11px] text-stone-500">
              El estado solo se modifica desde la sección Bolsa y Pedidos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar edición"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Client & Delivery Date */}
        <div className="bg-white border border-stone-200 rounded-xl p-3 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Cliente
              </label>
              <input
                type="text"
                value={clienteNombre}
                onChange={(e) => setClienteNombre(e.target.value)}
                placeholder="Nombre completo"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                Teléfono / WhatsApp
              </label>
              <input
                type="tel"
                value={clienteTelefono}
                onChange={(e) => setClienteTelefono(e.target.value)}
                placeholder="Teléfono"
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-stone-600 mb-1">
              Fecha de Entrega Programada
            </label>
            <input
              type="date"
              value={fechaEntrega}
              onChange={(e) => setFechaEntrega(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-mono-data"
            />
          </div>
        </div>

        {/* Model & Wood */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Mueble Base
            </label>
            <select
              value={selectedKey}
              onChange={(e) => handleModelSwitch(e.target.value as MuebleItem['key'])}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
            >
              {catalogList.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1">
              Madera ({WOOD_FINISHES[finishId].shortLabel})
            </label>
            <div className="grid grid-cols-5 gap-1">
              {(Object.keys(WOOD_FINISHES) as WoodFinishId[]).map((fid) => {
                const preset = WOOD_FINISHES[fid];
                const active = finishId === fid;
                return (
                  <button
                    key={fid}
                    type="button"
                    onClick={() => setFinishId(fid)}
                    title={preset.label}
                    className={`py-1.5 rounded-lg border flex flex-col items-center gap-0.5 text-[10px] cursor-pointer ${
                      active
                        ? 'border-amber-800 bg-amber-50 font-semibold text-amber-950'
                        : 'border-stone-200 bg-white text-stone-600'
                    }`}
                  >
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/20"
                      style={{ backgroundColor: preset.swatchHex }}
                    />
                    <span>{preset.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Dimensions */}
        <div className="bg-white border border-stone-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span className="flex items-center gap-1.5">
              <Ruler className="w-3.5 h-3.5 text-amber-800" />
              <span>Medidas (cm)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setAlto(baseItem.alto_cm);
                setAncho(baseItem.ancho_cm);
                setProf(baseItem.profundidad_cm);
              }}
              className="text-[11px] text-amber-800 hover:text-amber-950 flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Estándar</span>
            </button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Alto', val: alto, min: bounds.alto.min, max: bounds.alto.max, set: setAlto },
              { label: 'Ancho', val: ancho, min: bounds.ancho.min, max: bounds.ancho.max, set: setAncho },
              { label: 'Prof.', val: prof, min: bounds.prof.min, max: bounds.prof.max, set: setProf },
            ].map((d) => (
              <div key={d.label} className="bg-stone-50 border border-stone-200 rounded-lg p-2 space-y-1">
                <div className="flex justify-between text-[10px] text-stone-500">
                  <span className="font-semibold text-slate-700">{d.label}</span>
                  <span className="font-mono-data">
                    {d.min}-{d.max}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => d.set(clampDimensionValue(d.val - 5, d.min, d.max))}
                    className="w-5 h-6 rounded border border-stone-300 bg-white flex items-center justify-center cursor-pointer"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <input
                    type="number"
                    min={d.min}
                    max={d.max}
                    value={d.val}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (!Number.isNaN(n)) d.set(Math.max(10, Math.min(400, Math.round(n))));
                    }}
                    className="w-full min-w-0 text-center font-mono-data text-xs font-semibold bg-white border border-stone-200 rounded py-0.5"
                  />
                  <button
                    type="button"
                    onClick={() => d.set(clampDimensionValue(d.val + 5, d.min, d.max))}
                    className="w-5 h-6 rounded border border-stone-300 bg-white flex items-center justify-center cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs text-stone-700">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={conPoliuretano}
              onChange={(e) => setConPoliuretano(e.target.checked)}
              className="accent-amber-800"
            />
            <span>Poliuretano (+Bs. 180)</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={conCerradura}
              onChange={(e) => setConCerradura(e.target.checked)}
              className="accent-amber-800"
            />
            <span>Herrajes / Cerradura (+Bs. 110)</span>
          </label>
        </div>

        <input
          type="text"
          placeholder="Notas y especificaciones de carpintería..."
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs"
        />

        <div className="bg-slate-900 text-white rounded-xl p-3.5 flex items-center justify-between font-mono-data">
          <div>
            <span className="text-[11px] text-slate-300 block">Nuevo Total Recalculado</span>
            <strong className="text-lg text-amber-300">
              Bs. {precioBs.toLocaleString('es-BO')}
            </strong>
          </div>
          <div className="text-right">
            <span className="text-[11px] text-slate-300 block">Anticipo 50%</span>
            <strong className="text-sm text-white">
              Bs. {anticipoBs.toLocaleString('es-BO')}
            </strong>
          </div>
        </div>

        {errorMsg && (
          <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            {errorMsg}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Guardar Cambios</span>
          </button>
        </div>
      </form>
    </div>
  );
}

// ============================================================================
// 5. Calendario Flotante de Fecha de Entrega (Historial de Cotizaciones)
// ============================================================================
interface FloatingDeliveryCalendarModalProps {
  cotizacion: CotizacionDTO | null;
  onClose: () => void;
  onUpdatedDate: (updated: CotizacionDTO) => void;
}

const MONTH_NAMES_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const WEEK_DAYS_ES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export function FloatingDeliveryCalendarModal({
  cotizacion,
  onClose,
  onUpdatedDate,
}: FloatingDeliveryCalendarModalProps) {
  const [selectedDelivery, setSelectedDelivery] = useState('');
  const [viewYear, setViewYear] = useState(2026);
  const [viewMonth, setViewMonth] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!cotizacion) return;
    const deliveryStr = defaultDeliveryDateStr(cotizacion);
    setSelectedDelivery(deliveryStr);
    const [y, m] = deliveryStr.split('-').map(Number);
    if (y && m) {
      setViewYear(y);
      setViewMonth(m - 1);
    }
  }, [cotizacion]);

  if (!cotizacion) return null;

  const orderDateStr = (cotizacion.created_at || new Date().toISOString()).slice(0, 10);
  const statusInfo = QUOTE_READONLY_BADGE[cotizacion.estado] || QUOTE_READONLY_BADGE.pendiente;

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1);
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  // Convert Sunday=0..Saturday=6 into Monday=0..Sunday=6
  const startOffset = (firstDayOfMonth.getDay() + 6) % 7;

  const cells: Array<{ day: number | null; iso: string | null }> = [];
  for (let i = 0; i < startOffset; i++) {
    cells.push({ day: null, iso: null });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const mm = String(viewMonth + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    cells.push({ day: d, iso: `${viewYear}-${mm}-${dd}` });
  }

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const handleSaveDeliveryDate = async () => {
    if (!selectedDelivery) return;
    setSaving(true);
    try {
      const updated = await appService.actualizarCotizacionCompleta(
        cotizacion.codigo_cotizacion,
        { fecha_entrega: selectedDelivery }
      );
      onUpdatedDate(updated);
      onClose();
    } catch {
      // keep modal open on transient error
    } finally {
      setSaving(false);
    }
  };

  const formatReadableEs = (iso: string) => {
    const [y, m, d] = iso.split('-').map(Number);
    if (!y || !m || !d) return iso;
    return `${d} de ${MONTH_NAMES_ES[m - 1]} de ${y}`;
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-calendar-title"
      className="fixed inset-0 z-[65] bg-slate-950/75 flex items-center justify-center p-4"
    >
      <div className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-900 space-y-4">
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono-data text-[11px] font-bold text-amber-800">
                {cotizacion.codigo_cotizacion}
              </span>
              <span
                className={`px-2 py-0.5 rounded-md border text-[10px] font-semibold ${statusInfo.cls}`}
              >
                {statusInfo.label}
              </span>
            </div>
            <h3
              id="delivery-calendar-title"
              className="font-serif-brand font-bold text-lg text-slate-900 mt-0.5 flex items-center gap-1.5"
            >
              <Calendar className="w-4 h-4 text-emerald-700" />
              <span>Calendario de Entrega</span>
            </h3>
            <p className="text-[11px] text-stone-600">
              {cotizacion.modelo_base} · {cotizacion.cliente_nombre || 'Cliente Showroom'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar calendario flotante"
            className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Dates */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-amber-900 block">
              Fecha de Pedido
            </span>
            <strong className="font-mono-data text-xs text-slate-900">
              {formatReadableEs(orderDateStr)}
            </strong>
          </div>
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5">
            <span className="text-[10px] font-semibold text-emerald-900 block">
              Fecha de Entrega
            </span>
            <strong className="font-mono-data text-xs text-emerald-950">
              {formatReadableEs(selectedDelivery)}
            </strong>
          </div>
        </div>

        {/* Interactive Floating Calendar */}
        <div className="bg-white border border-stone-200 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              aria-label="Mes anterior"
              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-serif-brand font-bold text-sm text-slate-900">
              {MONTH_NAMES_ES[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              aria-label="Mes siguiente"
              className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold text-stone-500">
            {WEEK_DAYS_ES.map((wd) => (
              <div key={wd} className="py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center font-mono-data text-xs">
            {cells.map((c, idx) => {
              if (!c.day || !c.iso) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isOrder = c.iso === orderDateStr;
              const isDelivery = c.iso === selectedDelivery;
              const inRange =
                c.iso > orderDateStr &&
                c.iso < selectedDelivery;

              return (
                <button
                  key={c.iso}
                  type="button"
                  onClick={() => setSelectedDelivery(c.iso!)}
                  title={
                    isDelivery
                      ? 'Fecha de entrega seleccionada'
                      : isOrder
                      ? 'Fecha de pedido'
                      : `Seleccionar ${c.iso} como fecha de entrega`
                  }
                  className={`h-8 rounded-lg flex items-center justify-center text-xs font-semibold cursor-pointer transition-colors ${
                    isDelivery
                      ? 'bg-emerald-700 text-white shadow-xs ring-2 ring-emerald-300'
                      : isOrder
                      ? 'bg-slate-900 text-amber-300'
                      : inRange
                      ? 'bg-amber-50 text-amber-900 hover:bg-amber-100'
                      : 'text-slate-700 hover:bg-stone-100'
                  }`}
                >
                  {c.day}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-stone-100 text-[10px] text-stone-600">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-slate-900 inline-block" /> Pedido
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-amber-100 border border-amber-300 inline-block" />{' '}
              Fabricación taller
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded bg-emerald-700 inline-block" /> Entrega
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={handleSaveDeliveryDate}
            className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>Guardar Fecha de Entrega</span>
          </button>
        </div>
      </div>
    </div>
  );
}

