import { MuebleItem, WoodFinishId } from '../data/catalog';
import { apiUrl } from '../lib/apiConfig';

export interface ProductoStockSnapshot {
  key: MuebleItem['key'];
  stock: number;
  precio_bs: number;
  anticipo_bs: number;
  disponibilidad: string;
}

export interface CrearPedidoPayload {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email?: string;
  modalidad_entrega: 'oruro' | 'showroom';
  direccion_oruro?: string;
  metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
  items: Array<{
    key: MuebleItem['key'];
    finishId: WoodFinishId;
    qty: number;
    customDims?: string;
    unitPriceBs: number;
  }>;
}

export interface PedidoResponse {
  source: 'backend' | 'local';
  pedido: {
    codigo_pedido: string;
    cliente_nombre: string;
    cliente_telefono: string;
    modalidad_entrega: 'oruro' | 'showroom';
    subtotal_bs: number;
    envio_bs: number;
    total_bs: number;
    anticipo_bs: number;
    metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
    estado_pago: string;
    referencia_pago?: string | null;
  };
  whatsapp_url: string;
}

export interface CrearCotizacionPayload {
  cliente_nombre?: string;
  cliente_telefono?: string;
  modelo_key: MuebleItem['key'];
  finish_id: WoodFinishId;
  alto_cm: number;
  ancho_cm: number;
  profundidad_cm: number;
  con_poliuretano: boolean;
  con_cerradura: boolean;
  notas?: string;
}

export interface CotizacionResponse {
  source: 'backend' | 'local';
  cotizacion: {
    codigo_cotizacion: string;
    modelo_base: string;
    madera_acabado: string;
    alto_cm: number;
    ancho_cm: number;
    profundidad_cm: number;
    precio_estimado_bs: number;
    anticipo_bs: number;
  };
  whatsapp_url: string;
}

export interface AnticipoResponse {
  ok: boolean;
  codigo_pedido: string;
  estado_pago: string;
  anticipo_bs: number;
  referencia_pago: string;
}

export async function fetchProductosStock(): Promise<ProductoStockSnapshot[]> {
  const res = await fetch(apiUrl('/api/productos'));
  if (!res.ok) throw new Error('Error cargando catálogo de Oruro');
  const json = await res.json();
  return Array.isArray(json.productos) ? json.productos : [];
}

export async function crearPedido(payload: CrearPedidoPayload): Promise<PedidoResponse> {
  const res = await fetch(apiUrl('/api/pedidos'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'No se pudo confirmar el pedido.');
  }
  return json;
}

export async function registrarAnticipo(payload: {
  codigo_pedido: string;
  metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
  referencia_pago?: string;
}): Promise<AnticipoResponse> {
  const res = await fetch(apiUrl('/api/pagos/anticipo'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'No se pudo verificar el anticipo.');
  }
  return json;
}

export async function crearCotizacion(
  payload: CrearCotizacionPayload
): Promise<CotizacionResponse> {
  const res = await fetch(apiUrl('/api/cotizaciones'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error || 'No se pudo guardar la cotización.');
  }
  return json;
}
