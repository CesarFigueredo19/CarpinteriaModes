import { apiUrl } from '../lib/apiConfig';
import { MuebleItem, MUEBLES_SHOWROOM, WoodFinishId } from '../data/catalog';

export interface ClienteDTO {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  notas?: string | null;
  created_at: string;
}

export interface PedidoDTO {
  id: string;
  codigo_pedido: string;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string;
  mueble_nombre: string;
  acabado: string;
  detalles: Array<{
    id: string;
    mueble_nombre: string;
    especificaciones: string;
    medidas: string;
    cantidad: number;
    precio_unitario: number;
    subtotal: number;
  }>;
  precio_bs: number;
  modalidad_entrega: 'oruro' | 'showroom';
  direccion_oruro: string | null;
  notas_entrega?: string | null;
  subtotal_bs: number;
  envio_bs: number;
  total_bs: number;
  anticipo_bs: number;
  metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
  estado_pago: 'pendiente_anticipo' | 'anticipo_pagado' | 'pagado_total';
  referencia_pago?: string | null;
  estado: 'cotizacion' | 'confirmado' | 'en_taller' | 'listo_entrega' | 'entregado' | 'cancelado';
  created_at: string;
}

export interface CotizacionDTO {
  id: string;
  codigo_cotizacion: string;
  cliente_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  modelo_base: string;
  descripcion_medidas: string;
  madera_preferida: string;
  alto_cm: number;
  ancho_cm: number;
  profundidad_cm: number;
  con_poliuretano: boolean;
  con_cerradura: boolean;
  precio_estimado_bs: number;
  anticipo_bs: number;
  forma_pago?: 'qr_simple' | 'transferencia' | 'showroom';
  deja_anticipo?: boolean;
  estado_pago?: 'sin_anticipo' | 'pendiente_anticipo' | 'anticipo_pagado' | 'pagado_total';
  referencia_pago?: string | null;
  fecha_entrega?: string | null;
  notas?: string | null;
  estado: 'pendiente' | 'aprobada' | 'en_fabricacion' | 'completada';
  created_at: string;
}

export interface InversionDTO {
  id: string;
  concepto: string;
  categoria: 'madera' | 'herrajes' | 'acabados' | 'mano_obra' | 'operativo';
  monto_bs: number;
  proveedor?: string | null;
  fecha: string;
  notas?: string | null;
  created_at: string;
}

export interface CrearPedidoInput {
  cliente_nombre: string;
  cliente_telefono: string;
  modalidad_entrega: 'oruro' | 'showroom';
  direccion_oruro: string;
  notas_entrega?: string;
  metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
  items: Array<{
    key: MuebleItem['key'];
    customName?: string;
    finishId: WoodFinishId;
    qty: number;
    customDims?: string;
    unitPriceBs: number;
  }>;
}

export interface CrearCotizacionInput {
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_direccion?: string;
  modelo_key: MuebleItem['key'];
  finish_id: WoodFinishId;
  alto_cm: number;
  ancho_cm: number;
  profundidad_cm: number;
  precio_estimado_bs: number;
  con_poliuretano: boolean;
  con_cerradura: boolean;
  forma_pago?: 'qr_simple' | 'transferencia' | 'showroom';
  deja_anticipo?: boolean;
  fecha_entrega?: string;
  notas?: string;
}

/**
 * Servicio REST unificado para Mueblería Modes (sin dependencias externas).
 * Se comunica directamente con la API (/api/* o VITE_API_URL).
 */
function mapPedidoToCotizacion(row: Record<string, any>): CotizacionDTO {
  const detail = Array.isArray(row.detalle_pedido) ? row.detalle_pedido[0] || {} : {};
  const measurements = String(detail.medidas || '');
  const dimensionValues = measurements.match(/[\d.]+/g)?.map(Number) || [];
  const specifications = String(detail.especificaciones || '');
  const paymentMethod = specifications.match(/forma_pago=([^;]+)/i)?.[1];
  const deposit = /deja_anticipo=true/i.test(specifications);
  const orderState = String(row.estado_pedido || '').toLowerCase();
  const state: CotizacionDTO['estado'] = orderState.includes('entregado') || orderState.includes('listo')
    ? 'completada'
    : orderState.includes('produccion')
      ? 'en_fabricacion'
      : orderState.includes('confirmado')
        ? 'aprobada'
        : 'pendiente';
  const price = Number(row.monto_total ?? detail.subtotal ?? 0);

  return {
    id: String(row.id_pedido ?? ''),
    codigo_cotizacion: `COT-${row.id_pedido ?? ''}`,
    cliente_id: row.id_cliente == null ? null : String(row.id_cliente),
    cliente_nombre: row.clientes?.nombre_completo || null,
    cliente_telefono: row.clientes?.telefono || null,
    modelo_base: String(detail.nombre_mueble || 'Mueble a medida'),
    descripcion_medidas: measurements || 'Medidas no registradas',
    madera_preferida: specifications.match(/acabado=([^;]+)/i)?.[1] || specifications || 'Acabado no registrado',
    alto_cm: dimensionValues[0] || 0,
    ancho_cm: dimensionValues[1] || 0,
    profundidad_cm: dimensionValues[2] || 0,
    con_poliuretano: /con_poliuretano=true/i.test(specifications),
    con_cerradura: /con_cerradura=true/i.test(specifications),
    precio_estimado_bs: price,
    anticipo_bs: deposit ? Math.round(price * 0.5) : 0,
    forma_pago: ['qr_simple', 'transferencia', 'showroom'].includes(paymentMethod || '')
      ? paymentMethod as CotizacionDTO['forma_pago']
      : undefined,
    deja_anticipo: deposit,
    estado_pago: deposit ? 'pendiente_anticipo' : 'sin_anticipo',
    fecha_entrega: row.fecha_entrega_prometida || null,
    notas: specifications.match(/notas=([^;]+)/i)?.[1] || null,
    estado: state,
    created_at: String(row.created_at || row.fecha_pedido || new Date().toISOString()),
  };
}

export const appService = {
  async listarClientes(): Promise<ClienteDTO[]> {
    const res = await fetch(apiUrl('/api/clientes'));
    const json = await res.json();
    return Array.isArray(json.clientes) ? json.clientes : [];
  },

  async registrarOActualizarCliente(input: {
    nombre: string;
    telefono: string;
    direccion: string;
    notas?: string;
  }): Promise<ClienteDTO> {
    const cleanPhone = input.telefono.replace(/\s+/g, '').trim();
    const res = await fetch(apiUrl('/api/clientes'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        nombre_completo: input.nombre.trim(),
        direccion_entrega: input.direccion.trim() || 'Oruro, Bolivia',
        telefono: cleanPhone,
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.detail || 'Error registrando cliente');
    return json.cliente;
  },

  async listarPedidos(): Promise<PedidoDTO[]> {
    const res = await fetch(apiUrl('/api/pedidos'));
    const json = await res.json();
    return Array.isArray(json.pedidos) ? json.pedidos : [];
  },

  async crearPedidoConCliente(
    payload: CrearPedidoInput
  ): Promise<{ cliente: ClienteDTO; pedido: PedidoDTO }> {
    const res = await fetch(apiUrl('/api/pedidos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || json.detail || 'No se pudo confirmar la compra.');
    return { cliente: json.cliente, pedido: json.pedido };
  },

  async actualizarEstadoPedido(
    codigoPedido: string,
    estado: PedidoDTO['estado']
  ): Promise<PedidoDTO> {
    const res = await fetch(apiUrl(`/api/pedidos/${encodeURIComponent(codigoPedido)}`), {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error actualizando pedido');
    return json.pedido;
  },

  async listarCotizaciones(): Promise<CotizacionDTO[]> {
    const res = await fetch(apiUrl('/api/pedidos'));
    const json = await res.json();
    if (!res.ok) throw new Error(json.detail || 'No se pudieron cargar las cotizaciones.');
    return Array.isArray(json.pedidos)
      ? json.pedidos
          .filter((row: Record<string, any>) =>
            String(row.estado_pedido || '').toLowerCase().includes('cotizaci')
          )
          .map(mapPedidoToCotizacion)
      : [];
  },

  async crearCotizacionConCliente(payload: CrearCotizacionInput): Promise<CotizacionDTO> {
    const base = MUEBLES_SHOWROOM[payload.modelo_key];
    const specifications = [
      `acabado=${payload.finish_id}`,
      `con_poliuretano=${payload.con_poliuretano}`,
      `con_cerradura=${payload.con_cerradura}`,
      `forma_pago=${payload.forma_pago || 'showroom'}`,
      `deja_anticipo=${Boolean(payload.deja_anticipo)}`,
      payload.notas ? `notas=${payload.notas.replace(/[;\r\n]/g, ' ')}` : '',
    ].filter(Boolean).join('; ');
    const res = await fetch(apiUrl('/api/pedidos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cliente: {
          nombre_completo: payload.cliente_nombre || 'Cliente Showroom',
          telefono: payload.cliente_telefono || '0000000000',
          direccion_entrega: payload.cliente_direccion || 'Oruro, Bolivia',
        },
        fecha_entrega_prometida: payload.fecha_entrega,
        monto_total: payload.precio_estimado_bs,
        estado_pedido: 'Cotizacion',
        es_cotizacion: true,
        items: [{
          nombre_mueble: base.nombre,
          especificaciones: specifications,
          medidas: `${payload.alto_cm} x ${payload.ancho_cm} x ${payload.profundidad_cm} cm`,
          cantidad: 1,
          precio_unitario: payload.precio_estimado_bs,
        }],
      }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo registrar la cotización.');
    return mapPedidoToCotizacion(json.pedido);
  },

  async actualizarEstadoCotizacion(
    codigoCotizacion: string,
    estado: CotizacionDTO['estado']
  ): Promise<CotizacionDTO> {
    const res = await fetch(
      apiUrl(`/api/cotizaciones/${encodeURIComponent(codigoCotizacion)}`),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error actualizando cotización');
    return json.cotizacion;
  },

  async actualizarMedidasCotizacion(
    codigoCotizacion: string,
    dims: {
      alto_cm: number;
      ancho_cm: number;
      profundidad_cm: number;
      descripcion_medidas: string;
      precio_estimado_bs: number;
      anticipo_bs: number;
    }
  ): Promise<CotizacionDTO> {
    const res = await fetch(
      apiUrl(`/api/cotizaciones/${encodeURIComponent(codigoCotizacion)}`),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alto_cm: dims.alto_cm,
          ancho_cm: dims.ancho_cm,
          profundidad_cm: dims.profundidad_cm,
        }),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Error actualizando medidas de cotización');
    return json.cotizacion;
  },

  async actualizarCotizacionCompleta(
    codigoCotizacion: string,
    payload: {
      cliente_nombre?: string;
      cliente_telefono?: string;
      modelo_key?: MuebleItem['key'];
      finish_id?: WoodFinishId;
      alto_cm?: number;
      ancho_cm?: number;
      profundidad_cm?: number;
      con_poliuretano?: boolean;
      con_cerradura?: boolean;
      fecha_entrega?: string;
      notas?: string;
    }
  ): Promise<CotizacionDTO> {
    const res = await fetch(
      apiUrl(`/api/cotizaciones/${encodeURIComponent(codigoCotizacion)}`),
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo actualizar la cotización');
    return json.cotizacion;
  },

  async registrarPagoCotizacion(
    codigoCotizacion: string,
    payload: {
      forma_pago: 'qr_simple' | 'transferencia' | 'showroom';
      tipo_pago: 'anticipo' | 'total';
      referencia_pago?: string;
    }
  ): Promise<CotizacionDTO> {
    const res = await fetch(
      apiUrl(`/api/cotizaciones/${encodeURIComponent(codigoCotizacion)}/pago`),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo registrar el pago de la cotización');
    return json.cotizacion;
  },

  async listarInversiones(): Promise<InversionDTO[]> {
    const res = await fetch(apiUrl('/api/inversiones'));
    const json = await res.json();
    return Array.isArray(json.inversiones) ? json.inversiones : [];
  },

  async registrarInversion(payload: {
    concepto: string;
    categoria: InversionDTO['categoria'];
    monto_bs: number;
    proveedor?: string;
    fecha?: string;
    notas?: string;
  }): Promise<InversionDTO> {
    const res = await fetch(apiUrl('/api/inversiones'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo registrar la inversión');
    return json.inversion;
  },

  async eliminarInversion(id: string): Promise<void> {
    const res = await fetch(apiUrl(`/api/inversiones/${encodeURIComponent(id)}`), {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('No se pudo eliminar la inversión');
  },

  async enviarMensajeAsistente(
    message: string,
    history: Array<{ role: 'user' | 'model'; text: string }>
  ): Promise<{ reply: string; suggestions: string[] }> {
    const res = await fetch(apiUrl('/api/asistente-chat'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history }),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'No se pudo consultar al asistente');
    return {
      reply: String(json.reply || ''),
      suggestions: Array.isArray(json.suggestions) ? json.suggestions : [],
    };
  },
};
