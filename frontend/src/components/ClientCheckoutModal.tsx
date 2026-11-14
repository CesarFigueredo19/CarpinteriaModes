import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  UserCheck,
  QrCode,
  Landmark,
  Store,
  CheckCircle2,
  Phone,
  Loader2,
  MapPin,
  FileText,
} from 'lucide-react';
import { MuebleItem, WOOD_FINISHES, WoodFinishId } from '../data/catalog';
import {
  ClienteDTO,
  PedidoDTO,
} from '../services/appService';
import { registrarPedido } from '../services/apiService.js';
import { registrarAnticipo } from '../services/api';

export interface CheckoutItemInput {
  key: MuebleItem['key'];
  customName: string;
  finishId: WoodFinishId;
  qty: number;
  customDims?: string;
  unitPriceBs: number;
}

interface ClientCheckoutModalProps {
  open: boolean;
  items: CheckoutItemInput[];
  existingClientes: ClienteDTO[];
  onClose: () => void;
  onSuccess: (result: { cliente: ClienteDTO; pedido: PedidoDTO }) => void;
  onWhatsAppAlert: (title: string, detail: string) => void;
}

export function ClientCheckoutModal({
  open,
  items,
  existingClientes,
  onClose,
  onSuccess,
  onWhatsAppAlert,
}: ClientCheckoutModalProps) {
  const [nombre, setNombre] = useState('');
  const [telefono, setTelefono] = useState('');
  const [direccion, setDireccion] = useState('');
  const [notas, setNotas] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'oruro' | 'showroom'>('oruro');
  const [paymentMethod, setPaymentMethod] = useState<
    'qr_simple' | 'transferencia' | 'showroom'
  >('qr_simple');
  const [submitting, setSubmitting] = useState(false);
  const [payingAdvance, setPayingAdvance] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<{
    cliente: ClienteDTO;
    pedido: PedidoDTO;
  } | null>(null);
  const [advanceRef, setAdvanceRef] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setErrorMsg(null);
      setConfirmed(null);
      setAdvanceRef(null);
    }
  }, [open]);

  const cleanPhone = telefono.replace(/\s+/g, '').trim();
  const matchedCliente = useMemo(
    () =>
      cleanPhone.length >= 7
        ? existingClientes.find((c) => c.telefono.replace(/\s+/g, '') === cleanPhone)
        : undefined,
    [cleanPhone, existingClientes]
  );

  // Autofill name/address if phone matches an existing client in Supabase
  useEffect(() => {
    if (matchedCliente) {
      if (!nombre.trim()) setNombre(matchedCliente.nombre);
      if (!direccion.trim()) setDireccion(matchedCliente.direccion);
    }
  }, [matchedCliente]);

  if (!open) return null;

  const subtotal = items.reduce((acc, it) => acc + it.unitPriceBs * it.qty, 0);
  const envio = deliveryMode === 'oruro' && subtotal > 0 ? 80 : 0;
  const total = subtotal + envio;
  const anticipo = Math.round(subtotal * 0.5);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (nombre.trim().length < 3) {
      setErrorMsg('Por favor ingresa tu nombre completo.');
      return;
    }
    if (cleanPhone.length < 7) {
      setErrorMsg('Ingresa un número de teléfono o WhatsApp válido (mínimo 7 dígitos).');
      return;
    }
    if (deliveryMode === 'oruro' && direccion.trim().length < 5) {
      setErrorMsg('Ingresa tu dirección o zona de referencia en Oruro para el envío.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await registrarPedido({
        cliente_nombre: nombre.trim(),
        cliente_telefono: cleanPhone,
        modalidad_entrega: deliveryMode,
        direccion_oruro:
          deliveryMode === 'oruro'
            ? direccion.trim()
            : 'Retiro en Showroom Mueblería Modes, Oruro',
        notas_entrega: notas.trim() || undefined,
        metodo_pago: paymentMethod,
        items,
      });
      setConfirmed(result);
      onSuccess(result);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'No se pudo completar el registro del pedido. Verifica la conexión con el backend.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerifyAdvance = async () => {
    if (!confirmed) return;
    setPayingAdvance(true);
    setErrorMsg(null);
    try {
      const res = await registrarAnticipo({
        codigo_pedido: confirmed.pedido.codigo_pedido,
        metodo_pago: paymentMethod,
      });
      setAdvanceRef(res.referencia_pago);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo validar el anticipo.');
    } finally {
      setPayingAdvance(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 flex items-center justify-center p-4">
      <div className="bg-[#fbf8f3] border border-stone-200 rounded-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto shadow-2xl text-slate-900">
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between sticky top-0 z-10">
          <div>
            <h3 className="font-serif-brand font-semibold text-lg text-amber-50">
              {confirmed
                ? `Pedido ${confirmed.pedido.codigo_pedido} Confirmado`
                : 'Registro de Cliente y Compra'}
            </h3>
            <p className="text-xs text-slate-300">
              Mueblería Modes · Oruro, Bolivia
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar modal de compra"
            className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          {confirmed ? (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-start gap-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-700 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-950 leading-relaxed">
                  <strong>¡Compra registrada con éxito!</strong> El cliente{' '}
                  <strong>{confirmed.cliente.nombre}</strong> ({confirmed.cliente.telefono}) quedó
                  guardado y el pedido <strong>{confirmed.pedido.codigo_pedido}</strong> fue enviado
                  al sistema.
                </div>
              </div>

              <div className="bg-white border border-stone-200 rounded-2xl p-4 font-mono-data text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-stone-500">Producto(s)</span>
                  <span className="font-semibold text-right max-w-[230px] truncate">
                    {confirmed.pedido.mueble_nombre}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Total Pedido</span>
                  <span className="font-semibold text-slate-900">
                    Bs. {Number(confirmed.pedido.total_bs).toLocaleString('es-BO')}
                  </span>
                </div>
                <div className="flex justify-between text-amber-800 font-semibold">
                  <span>Anticipo 50%</span>
                  <span>Bs. {Number(confirmed.pedido.anticipo_bs).toLocaleString('es-BO')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-500">Estado Pago</span>
                  <span
                    className={`font-semibold ${
                      advanceRef ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {advanceRef ? `Verificado (${advanceRef})` : 'Pendiente de anticipo'}
                  </span>
                </div>
              </div>

              {!advanceRef && (
                <button
                  type="button"
                  onClick={handleVerifyAdvance}
                  disabled={payingAdvance}
                  className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {payingAdvance ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  <span>
                    Confirmar Anticipo 50% (Bs.{' '}
                    {Number(confirmed.pedido.anticipo_bs).toLocaleString('es-BO')})
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() =>
                  onWhatsAppAlert(
                    `Comprobante Pedido ${confirmed.pedido.codigo_pedido}`,
                    `Comunícate al +591 72418920 en Oruro indicando tu código ${confirmed.pedido.codigo_pedido} a nombre de ${confirmed.cliente.nombre} para coordinar despacho.`
                  )
                }
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-600 text-white font-semibold text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Phone className="w-4 h-4" />
                <span>Contacto WhatsApp Oruro</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 font-semibold text-xs cursor-pointer"
              >
                Cerrar y Continuar
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Items Summary */}
              <div className="bg-white border border-stone-200 rounded-xl p-3.5 space-y-2">
                <div className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                  Resumen de Adquisición ({items.length})
                </div>
                {items.map((it, idx) => (
                  <div
                    key={`${it.key}_${idx}`}
                    className="flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="min-w-0">
                      <span className="font-semibold text-slate-900">
                        {it.qty}× {it.customName}
                      </span>
                      <span className="text-stone-500 block text-[11px]">
                        {WOOD_FINISHES[it.finishId]?.label}
                        {it.customDims ? ` · ${it.customDims}` : ''}
                      </span>
                    </div>
                    <span className="font-mono-data font-semibold text-amber-800 shrink-0">
                      Bs. {(it.unitPriceBs * it.qty).toLocaleString('es-BO')}
                    </span>
                  </div>
                ))}
              </div>

              {/* Client Registration Fields */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-900">
                    Datos del Cliente (Oruro)
                  </span>
                  {matchedCliente && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700">
                      <UserCheck className="w-3.5 h-3.5" />
                      Cliente registrado · Se actualizará
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Teléfono / WhatsApp *
                    </label>
                    <input
                      type="tel"
                      required
                      placeholder="Ej. 72418920"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 mb-1">
                      Nombre Completo *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nombre y apellidos"
                      value={nombre}
                      onChange={(e) => setNombre(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                </div>

                {/* Delivery Mode */}
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

                {deliveryMode === 'oruro' && (
                  <div>
                    <label className="flex items-center gap-1 text-[11px] font-medium text-stone-600 mb-1">
                      <MapPin className="w-3 h-3 text-amber-800" />
                      Dirección exacta en Oruro *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Av. 6 de Octubre entre Bolívar y Adolfo Mier"
                      value={direccion}
                      onChange={(e) => setDireccion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-700"
                    />
                  </div>
                )}

                <div>
                  <label className="flex items-center gap-1 text-[11px] font-medium text-stone-600 mb-1">
                    <FileText className="w-3 h-3 text-amber-800" />
                    Notas de entrega o armado (opcional)
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Entregar por la tarde, subir a 2do piso"
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs focus:outline-none focus:ring-2 focus:ring-amber-700"
                  />
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <span className="block text-[11px] font-medium text-stone-600 mb-1.5">
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
                    <span>En Showroom</span>
                  </button>
                </div>
              </div>

              {/* Totals */}
              <div className="bg-slate-900 text-white rounded-2xl p-4 space-y-1 font-mono-data text-xs">
                <div className="flex justify-between text-slate-300">
                  <span>Subtotal Muebles</span>
                  <span>Bs. {subtotal.toLocaleString('es-BO')}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Despacho Oruro</span>
                  <span>{envio === 0 ? 'Gratis' : `Bs. ${envio}`}</span>
                </div>
                <div className="flex justify-between text-white font-semibold text-sm pt-1 border-t border-slate-700">
                  <span>Total a Pagar</span>
                  <span className="text-amber-300">Bs. {total.toLocaleString('es-BO')}</span>
                </div>
                <div className="flex justify-between text-amber-200 text-[11px]">
                  <span>Anticipo 50%</span>
                  <span>Bs. {anticipo.toLocaleString('es-BO')}</span>
                </div>
              </div>

              {errorMsg && (
                <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                  {errorMsg}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm cursor-pointer flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Registrar Cliente y Confirmar Compra</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
