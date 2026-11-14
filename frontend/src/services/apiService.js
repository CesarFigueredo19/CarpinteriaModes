/**
 * Servicio de conexión Frontend -> Backend FastAPI (Mueblería Modes · Oruro, Bolivia)
 *
 * Conecta de forma segura con el backend Python/FastAPI.
 * Incluye adaptación tolerante (`mapProductFromDB`) y manejo de fallos de red para que
 * el Showroom 3D con Three.js nunca colapse si falta algún campo o si el backend está apagado.
 */

import {
  MUEBLES_CATALOGO,
  MUEBLES_SHOWROOM,
  WOOD_FINISHES,
} from '../data/catalog';
import { API_BASE_URL, apiUrl } from '../lib/apiConfig';

/**
 * Detecta si un error corresponde a desconexión de red o servidor apagado.
 * @param {unknown} error
 * @returns {boolean}
 */
function isNetworkOrOfflineError(error) {
  if (!error) return false;
  if (error instanceof TypeError) return true;
  const msg = String(error instanceof Error ? error.message : error).toLowerCase();
  return (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('econnrefused') ||
    msg.includes('aborted')
  );
}

/**
 * Busca el mueble base del Showroom 3D que mejor coincida con una fila de Supabase `products`.
 * @param {Record<string, any>} dbProduct
 * @returns {import('../data/catalog').MuebleItem | undefined}
 */
function findMatchingCatalogBase(dbProduct) {
  if (!dbProduct || typeof dbProduct !== 'object') return undefined;

  const rawKey = String(dbProduct.key || dbProduct.slug || '').trim().toLowerCase();
  if (rawKey && rawKey in MUEBLES_SHOWROOM) {
    return MUEBLES_SHOWROOM[/** @type {keyof typeof MUEBLES_SHOWROOM} */ (rawKey)];
  }

  const nameLower = String(dbProduct.name || dbProduct.nombre || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!nameLower) return undefined;

  const exactByName = MUEBLES_CATALOGO.find(
    (item) => item.nombre.toLowerCase() === nameLower
  );
  if (exactByName) return exactByName;

  /** @type {Array<[string, keyof typeof MUEBLES_SHOWROOM]>} */
  const keywordMap = [
    ['ropero', 'ropero'],
    ['closet', 'ropero'],
    ['clóset', 'ropero'],
    ['comedor', 'comedor'],
    ['silla', 'comedor'],
    ['taburete', 'comedor'],
    ['escritorio', 'escritorio'],
    ['estante', 'estante'],
    ['estanteria', 'estante'],
    ['estantería', 'estante'],
    ['librero', 'estante'],
    ['biblioteca', 'estante'],
    ['sillon', 'sillon'],
    ['living', 'sillon'],
    ['sillón', 'sillon'],
    ['comoda', 'comoda'],
    ['cómoda', 'comoda'],
    ['cama', 'cama'],
    ['sofa', 'sofa'],
    ['sofá', 'sofa'],
    ['mesa auxiliar', 'mesa_centro'],
    ['mesa de centro', 'mesa_centro'],
    ['mesa', 'mesa_centro'],
    ['aparador', 'aparador'],
    ['buffet', 'aparador'],
    ['rack', 'rack_tv'],
    ['tv', 'rack_tv'],
    ['vitrina', 'vitrina'],
    ['cava', 'vitrina'],
  ];

  for (const [keyword, modelKey] of keywordMap) {
    if (nameLower.includes(keyword)) {
      return MUEBLES_SHOWROOM[modelKey];
    }
  }

  const numericId = Number(dbProduct.id);
  if (Number.isFinite(numericId) && numericId > 0) {
    const byId = MUEBLES_CATALOGO.find((item) => item.id === numericId);
    if (byId) return byId;
  }

  return undefined;
}

/**
 * Función normalizadora segura (`mapProductFromDB`):
 * Combina una fila de Supabase `products` (`id`, `name`, `price`, `stock`) con el catálogo visual
 * local del Showroom 3D. Si falta cualquier campo en Supabase, rellena valores seguros por defecto.
 *
 * @param {Record<string, any>} dbProduct
 * @param {number} [index=0]
 * @returns {import('../data/catalog').MuebleItem & { name: string; price: number; especificaciones: string; medidas: string }}
 */
export function mapProductFromDB(dbProduct, index = 0) {
  const safeRow = dbProduct && typeof dbProduct === 'object' ? dbProduct : {};
  const base = findMatchingCatalogBase(safeRow) || MUEBLES_SHOWROOM.ropero;

  const id = Number.isFinite(Number(safeRow.id)) ? Number(safeRow.id) : base.id + index;
  const nombre = String(safeRow.name || safeRow.nombre || base.nombre).trim();

  const rawPrice = safeRow.price ?? safeRow.precio_bs;
  const parsedPrice = Number(rawPrice);
  const precio_bs =
    Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : base.precio_bs;

  const rawStock = safeRow.stock;
  const parsedStock = Number(rawStock);
  const stock =
    Number.isFinite(parsedStock) && parsedStock >= 0 ? Math.floor(parsedStock) : base.stock;

  const madera = String(
    safeRow.madera || safeRow.especificaciones || base.madera || 'Madera seleccionada en taller'
  ).trim();

  const especificaciones = String(
    safeRow.especificaciones || safeRow.color_acabado || base.color_acabado || 'Madera seleccionada en taller'
  ).trim();

  const medidas = String(
    safeRow.medidas || safeRow.dimensiones || base.dimensiones || 'Medidas estándar'
  ).trim();

  const modelo_3d =
    safeRow.modelo_3d && safeRow.modelo_3d in MUEBLES_SHOWROOM
      ? safeRow.modelo_3d
      : base.modelo_3d || 'ropero';

  return {
    ...base,
    id,
    key: base.key,
    slug: safeRow.slug || base.slug || base.key,
    nombre,
    name: nombre,
    categoria: String(safeRow.categoria || base.categoria || 'Muebles en Madera Noble'),
    modelo_3d,
    madera: safeRow.madera ? madera : base.madera || 'Madera seleccionada en taller',
    especificaciones: safeRow.especificaciones
      ? String(safeRow.especificaciones)
      : 'Madera seleccionada en taller',
    color_acabado: String(
      safeRow.color_acabado || safeRow.especificaciones || base.color_acabado || 'Madera seleccionada en taller'
    ),
    medidas,
    dimensiones: safeRow.medidas ? medidas : base.dimensiones || 'Medidas estándar',
    alto_cm: Number(safeRow.alto_cm) > 0 ? Number(safeRow.alto_cm) : base.alto_cm || 180,
    ancho_cm: Number(safeRow.ancho_cm) > 0 ? Number(safeRow.ancho_cm) : base.ancho_cm || 120,
    profundidad_cm:
      Number(safeRow.profundidad_cm) > 0 ? Number(safeRow.profundidad_cm) : base.profundidad_cm || 50,
    precio_bs,
    price: precio_bs,
    anticipo_bs:
      Number(safeRow.anticipo_bs) > 0 ? Number(safeRow.anticipo_bs) : Math.round(precio_bs * 0.5),
    stock,
    disponibilidad:
      safeRow.disponibilidad ||
      (stock > 0 ? 'Entrega inmediata en Oruro' : 'Fabricación bajo pedido en taller'),
    descripcion: String(
      safeRow.descripcion || base.descripcion || 'Mueble artesanal fabricado en Oruro, Bolivia.'
    ),
  };
}

/**
 * Normaliza un cliente desde formato FastAPI/Supabase (`id_cliente`, `nombre_completo`, `direccion_entrega`)
 * o desde formato local Express (`id`, `nombre`, `direccion`) al DTO estándar del frontend.
 *
 * @param {Record<string, any>} row
 * @returns {import('./appService').ClienteDTO}
 */
export function mapClienteFromDB(row) {
  const safe = row && typeof row === 'object' ? row : {};
  return {
    id: String(safe.id_cliente ?? safe.id ?? ''),
    nombre: String(safe.nombre_completo || safe.nombre || 'Cliente Oruro'),
    telefono: String(safe.telefono || ''),
    direccion: String(safe.direccion_entrega || safe.direccion || 'Oruro, Bolivia'),
    notas:
      safe.notas ||
      [safe.nit_ci ? `NIT/CI: ${safe.nit_ci}` : '', safe.correo ? `Correo: ${safe.correo}` : '']
        .filter(Boolean)
        .join(' · ') ||
      null,
    created_at: String(safe.created_at || new Date().toISOString()),
  };
}

/**
 * Mapea el estado textual de Supabase (`Confirmado`, `En Produccion`, `Cotizacion`, `Listo`, `Entregado`)
 * al estado interno usado por las vistas del frontend.
 *
 * @param {string} rawEstado
 * @returns {import('./appService').PedidoDTO['estado']}
 */
function normalizeEstadoPedido(rawEstado) {
  const txt = String(rawEstado || '').trim().toLowerCase();
  if (txt.includes('cotizaci')) return 'cotizacion';
  if (txt.includes('entregado')) return 'entregado';
  if (txt.includes('listo')) return 'listo_entrega';
  if (txt.includes('produccion') || txt.includes('producción') || txt.includes('taller')) {
    return 'en_taller';
  }
  if (txt.includes('cancel')) return 'cancelado';
  return 'confirmado';
}

/**
 * Normaliza un pedido con join (`clientes` + `detalle_pedido`) de FastAPI o Express al DTO del frontend.
 *
 * @param {Record<string, any>} row
 * @returns {import('./appService').PedidoDTO}
 */
export function mapPedidoFromDB(row) {
  const safe = row && typeof row === 'object' ? row : {};
  const clienteObj = safe.clientes && typeof safe.clientes === 'object' ? safe.clientes : null;
  const detalles = Array.isArray(safe.detalle_pedido) ? safe.detalle_pedido : [];

  const totalBs = Number(safe.total_bs ?? safe.monto_total ?? safe.precio_bs ?? 0);
  const firstDetalle = detalles[0] || {};
  const muebleResumen =
    safe.mueble_nombre ||
    (detalles.length > 1
      ? `${firstDetalle.nombre_mueble || 'Mueble'} (+${detalles.length - 1} más)`
      : firstDetalle.nombre_mueble || 'Mueble Mueblería Modes');

  const acabadoResumen =
    safe.acabado ||
    detalles
      .map((d) => d.especificaciones || 'Madera seleccionada en taller')
      .filter(Boolean)
      .join(', ') ||
    'Madera seleccionada en taller';

  const direccion =
    safe.direccion_oruro || clienteObj?.direccion_entrega || 'Oruro, Bolivia';
  const isShowroom = String(direccion).toLowerCase().includes('showroom');

  return {
    id: String(safe.id_pedido ?? safe.id ?? ''),
    codigo_pedido: String(
      safe.codigo_pedido || (safe.id_pedido ? `MOD-${safe.id_pedido}` : 'MOD-0000')
    ),
    cliente_id:
      safe.id_cliente != null
        ? String(safe.id_cliente)
        : safe.cliente_id != null
          ? String(safe.cliente_id)
          : null,
    cliente_nombre: String(
      safe.cliente_nombre || clienteObj?.nombre_completo || 'Cliente Oruro'
    ),
    cliente_telefono: String(safe.cliente_telefono || clienteObj?.telefono || ''),
    mueble_nombre: muebleResumen,
    acabado: acabadoResumen,
    detalles: detalles.map((d) => ({
      id: String(d.id_detalle ?? `${safe.id_pedido ?? safe.id ?? ''}-${d.nombre_mueble ?? ''}`),
      mueble_nombre: String(d.nombre_mueble || 'Mueble'),
      especificaciones: String(d.especificaciones || 'Acabado no especificado'),
      medidas: String(d.medidas || 'Medidas no registradas'),
      cantidad: Number(d.cantidad || 1),
      precio_unitario: Number(d.precio_unitario || 0),
      subtotal: Number(d.subtotal || 0),
    })),
    precio_bs: totalBs,
    modalidad_entrega: safe.modalidad_entrega || (isShowroom ? 'showroom' : 'oruro'),
    direccion_oruro: direccion,
    notas_entrega: safe.notas_entrega || null,
    subtotal_bs: Number(safe.subtotal_bs ?? totalBs),
    envio_bs: Number(safe.envio_bs ?? 0),
    total_bs: totalBs,
    anticipo_bs: Number(safe.anticipo_bs ?? Math.round(totalBs * 0.5)),
    metodo_pago: safe.metodo_pago || 'qr_simple',
    estado_pago: safe.estado_pago || 'pendiente_anticipo',
    referencia_pago: safe.referencia_pago || null,
    estado: normalizeEstadoPedido(safe.estado || safe.estado_pedido || 'Confirmado'),
    created_at: String(safe.created_at || safe.fecha_pedido || new Date().toISOString()),
  };
}

/**
 * Obtiene el catálogo sincronizado desde FastAPI (`GET /api/products`) o Express fallback (`/api/productos`).
 * Si el servidor está apagado o falla la red, devuelve el catálogo local del Showroom 3D y una alerta amigable.
 */
export async function fetchProducts() {
  const localDefaults = MUEBLES_CATALOGO.map((item, idx) => mapProductFromDB(item, idx));

  try {
    let res = await fetch(apiUrl('/api/products'));

    // Compatibilidad automática con el preview local Express si VITE_API_URL no está definido
    if (res.status === 404 && !API_BASE_URL) {
      res = await fetch(apiUrl('/api/productos'));
    }

    if (!res.ok) {
      return {
        products: localDefaults,
        fromFallback: true,
        backendOffline: true,
        warning:
          'No se pudo sincronizar el stock con el backend. Mostrando precios y catálogo local del Showroom 3D.',
      };
    }

    const json = await res.json();
    const rawList = Array.isArray(json.products)
      ? json.products
      : Array.isArray(json.productos)
        ? json.productos
        : [];

    if (rawList.length === 0) {
      return {
        products: localDefaults,
        fromFallback: false,
        backendOffline: false,
        warning: null,
      };
    }

    const normalizedFromDb = rawList.map((row, idx) => mapProductFromDB(row, idx));
    // Conservamos cada registro de Supabase para mostrar el catálogo real de products.
    return {
      products: normalizedFromDb,
      fromFallback: false,
      backendOffline: false,
      warning: null,
    };
  } catch (err) {
    return {
      products: localDefaults,
      fromFallback: true,
      backendOffline: isNetworkOrOfflineError(err) || true,
      warning:
        'Servidor backend desconectado o sin respuesta. El Showroom 3D continúa operativo con los datos locales.',
    };
  }
}

/**
 * Obtiene la lista de clientes desde `GET /api/clientes` con manejo seguro si el backend está offline.
 */
export async function fetchClientes() {
  try {
    const res = await fetch(apiUrl('/api/clientes'));
    if (!res.ok) {
      return {
        clientes: [],
        fromFallback: true,
        backendOffline: true,
        warning: 'No se pudo consultar la lista de clientes en el backend.',
      };
    }
    const json = await res.json();
    const raw = Array.isArray(json.clientes) ? json.clientes : [];
    return {
      clientes: raw.map(mapClienteFromDB),
      fromFallback: false,
      backendOffline: false,
      warning: null,
    };
  } catch {
    return {
      clientes: [],
      fromFallback: true,
      backendOffline: true,
      warning: 'Backend desconectado al cargar clientes. El Showroom 3D sigue operativo.',
    };
  }
}

/**
 * Obtiene los pedidos con join (`clientes` + `detalle_pedido`) desde `GET /api/pedidos`.
 */
export async function fetchPedidos() {
  try {
    const res = await fetch(apiUrl('/api/pedidos'));
    if (!res.ok) {
      return {
        pedidos: [],
        fromFallback: true,
        backendOffline: true,
        warning: 'No se pudieron cargar los pedidos desde el servidor.',
      };
    }
    const json = await res.json();
    const raw = Array.isArray(json.pedidos) ? json.pedidos : [];
    return {
      pedidos: raw.map(mapPedidoFromDB),
      fromFallback: false,
      backendOffline: false,
      warning: null,
    };
  } catch {
    return {
      pedidos: [],
      fromFallback: true,
      backendOffline: true,
      warning: 'Backend desconectado al consultar pedidos. El Showroom 3D sigue operativo.',
    };
  }
}

/**
 * Registra un pedido completo en `POST /api/pedidos`.
 * Adapta el payload automáticamente al esquema FastAPI + Supabase (`clientes`, `pedidos`, `detalle_pedido`)
 * cuando `VITE_API_URL` está configurado, manteniendo compatibilidad con el preview local Express.
 *
 * @param {{
 *   cliente_nombre: string;
 *   cliente_telefono: string;
 *   correo?: string | null;
 *   nit_ci?: string | null;
 *   modalidad_entrega: 'oruro' | 'showroom';
 *   direccion_oruro: string;
 *   notas_entrega?: string;
 *   metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
 *   es_cotizacion?: boolean;
 *   fecha_entrega_prometida?: string | null;
 *   items: Array<{
 *     key: import('../data/catalog').MuebleItem['key'];
 *     customName?: string;
 *     finishId: import('../data/catalog').WoodFinishId;
 *     qty: number;
 *     customDims?: string;
 *     unitPriceBs: number;
 *   }>;
 * }} input
 */
export async function registrarPedido(input) {
  const isFastApiTarget = Boolean(API_BASE_URL);
  const subtotal = input.items.reduce(
    (acc, it) => acc + Number(it.unitPriceBs || 0) * Number(it.qty || 1),
    0
  );
  const envio = input.modalidad_entrega === 'oruro' && subtotal > 0 ? 80 : 0;
  const montoTotal = subtotal + envio;

  const fastApiPayload = {
    cliente: {
      nombre_completo: input.cliente_nombre.trim(),
      telefono: input.cliente_telefono.replace(/\s+/g, '').trim(),
      correo: input.correo || null,
      direccion_entrega:
        input.modalidad_entrega === 'oruro'
          ? input.direccion_oruro.trim()
          : 'Retiro en Showroom Mueblería Modes, Oruro',
      nit_ci: input.nit_ci || null,
    },
    fecha_entrega_prometida: input.fecha_entrega_prometida || null,
    monto_total: montoTotal,
    estado_pedido: input.es_cotizacion ? 'Cotizacion' : 'Confirmado',
    es_cotizacion: Boolean(input.es_cotizacion),
    items: input.items.map((it) => {
      const base = MUEBLES_SHOWROOM[it.key];
      const finishLabel =
        WOOD_FINISHES[it.finishId]?.label || base?.color_acabado || 'Madera seleccionada en taller';
      return {
        nombre_mueble: it.customName || base?.nombre || 'Mueble Artesanal Modes',
        especificaciones: finishLabel,
        medidas: it.customDims || base?.dimensiones || 'Medidas estándar',
        cantidad: Math.max(1, Number(it.qty) || 1),
        precio_unitario: Number(it.unitPriceBs ?? base?.precio_bs ?? 0),
      };
    }),
  };

  try {
    const res = await fetch(apiUrl('/api/pedidos'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isFastApiTarget ? fastApiPayload : input),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const detail =
        json.detail ||
        json.error ||
        'El servidor no pudo registrar el pedido.';
      throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
    }

    return {
      cliente: mapClienteFromDB(json.cliente || fastApiPayload.cliente),
      pedido: mapPedidoFromDB(json.pedido || {}),
    };
  } catch (err) {
    if (isNetworkOrOfflineError(err)) {
      throw new Error(
        'No se pudo conectar con el servidor backend FastAPI. Enciende el backend o verifica tu conexión; el Showroom 3D seguirá funcionando sin problemas.'
      );
    }
    throw err instanceof Error
      ? err
      : new Error('Ocurrió un problema inesperado al registrar el pedido.');
  }
}

export const apiService = {
  mapProductFromDB,
  mapClienteFromDB,
  mapPedidoFromDB,
  fetchProducts,
  fetchClientes,
  fetchPedidos,
  registrarPedido,
};

export default apiService;
