import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { MUEBLES_CATALOGO, MUEBLES_SHOWROOM, MuebleItem, WOOD_FINISHES, WoodFinishId } from './frontend/src/data/catalog.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;

export interface ClienteRecord {
  id: string;
  nombre: string;
  telefono: string;
  direccion: string;
  notas?: string | null;
  created_at: string;
}

interface LocalOrderItem {
  producto_slug: string;
  nombre: string;
  acabado: string;
  medidas_personalizadas: string | null;
  cantidad: number;
  precio_unitario_bs: number;
}

export interface PedidoRecord {
  id: string;
  codigo_pedido: string;
  cliente_id: string | null;
  cliente_nombre: string;
  cliente_telefono: string;
  mueble_nombre: string;
  acabado: string;
  precio_bs: number;
  modalidad_entrega: 'oruro' | 'showroom';
  direccion_oruro: string | null;
  notas_entrega: string | null;
  subtotal_bs: number;
  envio_bs: number;
  total_bs: number;
  anticipo_bs: number;
  metodo_pago: 'qr_simple' | 'transferencia' | 'showroom';
  estado_pago: 'pendiente_anticipo' | 'anticipo_pagado' | 'pagado_total';
  referencia_pago: string | null;
  estado: 'confirmado' | 'en_taller' | 'listo_entrega' | 'entregado' | 'cancelado';
  items: LocalOrderItem[];
  created_at: string;
}

export interface CotizacionRecord {
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
  notas: string | null;
  estado: 'pendiente' | 'aprobada' | 'en_fabricacion' | 'completada';
  created_at: string;
}

export interface InversionRecord {
  id: string;
  concepto: string;
  categoria: 'madera' | 'herrajes' | 'acabados' | 'mano_obra' | 'operativo';
  monto_bs: number;
  proveedor?: string | null;
  fecha: string;
  notas?: string | null;
  created_at: string;
}

// Local store fallback initialized with Oruro data so preview works seamlessly before Supabase keys are entered
const localStockMap = new Map<string, number>(
  Object.values(MUEBLES_SHOWROOM).map((m) => [m.key, m.stock])
);

const initialClientes: ClienteRecord[] = [
  {
    id: 'cli-oruro-1',
    nombre: 'Valeria Quispe Mendoza',
    telefono: '72410588',
    direccion: 'Av. 6 de Octubre #1420, Zona Central, Oruro',
    notas: 'Preferencia por madera Mara laqueada',
    created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
  },
  {
    id: 'cli-oruro-2',
    nombre: 'Rodrigo Torrico Choque',
    telefono: '71845219',
    direccion: 'Calle Adolfo Mier y Pagador, Oruro',
    notas: 'Entrega en horario de tarde',
    created_at: new Date(Date.now() - 86400000 * 9).toISOString(),
  },
  {
    id: 'cli-oruro-3',
    nombre: 'Carmen Mamani Condori',
    telefono: '73821904',
    direccion: 'Zona Norte, Av. España #450, Oruro',
    notas: 'Cliente frecuente de juego de comedor',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'cli-oruro-4',
    nombre: 'Luis Fernando Apaza',
    telefono: '71190432',
    direccion: 'Calle Bolívar #812, Oruro',
    notas: 'Equipamiento de oficina',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

const localClientes = new Map<string, ClienteRecord>(
  initialClientes.map((c) => [c.telefono, c])
);

const localOrders = new Map<string, PedidoRecord>([
  [
    'MOD-4810',
    {
      id: 'ped-oruro-1',
      codigo_pedido: 'MOD-4810',
      cliente_id: 'cli-oruro-1',
      cliente_nombre: 'Valeria Quispe Mendoza',
      cliente_telefono: '72410588',
      mueble_nombre: 'Ropero Esmeralda 3 Cuerpos c/Gavetas',
      acabado: 'Nogal Oscuro / Mara',
      precio_bs: 4850,
      modalidad_entrega: 'oruro',
      direccion_oruro: 'Av. 6 de Octubre #1420, Zona Central, Oruro',
      notas_entrega: 'Subir al segundo piso',
      subtotal_bs: 4850,
      envio_bs: 80,
      total_bs: 4930,
      anticipo_bs: 2425,
      metodo_pago: 'qr_simple',
      estado_pago: 'pagado_total',
      referencia_pago: 'ORU-884120',
      estado: 'entregado',
      items: [
        {
          producto_slug: 'ropero',
          nombre: 'Ropero Esmeralda 3 Cuerpos c/Gavetas',
          acabado: 'Nogal Oscuro / Mara',
          medidas_personalizadas: null,
          cantidad: 1,
          precio_unitario_bs: 4850,
        },
      ],
      created_at: new Date(Date.now() - 86400000 * 18).toISOString(),
    },
  ],
  [
    'MOD-4924',
    {
      id: 'ped-oruro-2',
      codigo_pedido: 'MOD-4924',
      cliente_id: 'cli-oruro-3',
      cliente_nombre: 'Carmen Mamani Condori',
      cliente_telefono: '73821904',
      mueble_nombre: 'Juego de Comedor Virrey 6 Sillas',
      acabado: 'Cedro Caramelo',
      precio_bs: 3750,
      modalidad_entrega: 'oruro',
      direccion_oruro: 'Zona Norte, Av. España #450, Oruro',
      notas_entrega: null,
      subtotal_bs: 3750,
      envio_bs: 80,
      total_bs: 3830,
      anticipo_bs: 1875,
      metodo_pago: 'transferencia',
      estado_pago: 'pagado_total',
      referencia_pago: 'ORU-492411',
      estado: 'entregado',
      items: [
        {
          producto_slug: 'comedor',
          nombre: 'Juego de Comedor Virrey 6 Sillas',
          acabado: 'Cedro Caramelo',
          medidas_personalizadas: null,
          cantidad: 1,
          precio_unitario_bs: 3750,
        },
      ],
      created_at: new Date(Date.now() - 86400000 * 8).toISOString(),
    },
  ],
  [
    'MOD-5107',
    {
      id: 'ped-oruro-3',
      codigo_pedido: 'MOD-5107',
      cliente_id: 'cli-oruro-4',
      cliente_nombre: 'Luis Fernando Apaza',
      cliente_telefono: '71190432',
      mueble_nombre: 'Escritorio Gerencial en L con Cajonera',
      acabado: 'Roble Miel',
      precio_bs: 2600,
      modalidad_entrega: 'showroom',
      direccion_oruro: 'Retiro en Showroom Mueblería Modes, Oruro',
      notas_entrega: null,
      subtotal_bs: 2600,
      envio_bs: 0,
      total_bs: 2600,
      anticipo_bs: 1300,
      metodo_pago: 'showroom',
      estado_pago: 'pagado_total',
      referencia_pago: 'ORU-510703',
      estado: 'entregado',
      items: [
        {
          producto_slug: 'escritorio',
          nombre: 'Escritorio Gerencial en L con Cajonera',
          acabado: 'Roble Miel',
          medidas_personalizadas: null,
          cantidad: 1,
          precio_unitario_bs: 2600,
        },
      ],
      created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
    },
  ],
  [
    'MOD-5288',
    {
      id: 'ped-oruro-4',
      codigo_pedido: 'MOD-5288',
      cliente_id: 'cli-oruro-2',
      cliente_nombre: 'Rodrigo Torrico Choque',
      cliente_telefono: '71845219',
      mueble_nombre: 'Mesa de Centro Elevable c/Revistero',
      acabado: 'Cedro Caramelo',
      precio_bs: 1580,
      modalidad_entrega: 'oruro',
      direccion_oruro: 'Calle Adolfo Mier y Pagador, Oruro',
      notas_entrega: 'Entrega en la tarde',
      subtotal_bs: 1580,
      envio_bs: 80,
      total_bs: 1660,
      anticipo_bs: 790,
      metodo_pago: 'qr_simple',
      estado_pago: 'pagado_total',
      referencia_pago: 'ORU-528890',
      estado: 'confirmado',
      items: [
        {
          producto_slug: 'mesa_centro',
          nombre: 'Mesa de Centro Elevable c/Revistero',
          acabado: 'Cedro Caramelo',
          medidas_personalizadas: null,
          cantidad: 1,
          precio_unitario_bs: 1580,
        },
      ],
      created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    },
  ],
]);

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(isoDate);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const localQuotes = new Map<string, CotizacionRecord>([
  [
    'COT-3092',
    {
      id: 'cot-oruro-1',
      codigo_cotizacion: 'COT-3092',
      cliente_id: 'cli-oruro-2',
      cliente_nombre: 'Rodrigo Torrico Choque',
      cliente_telefono: '71845219',
      modelo_base: 'Juego de Comedor Virrey 6 Sillas',
      descripcion_medidas: '78 × 210 × 100 cm · Poliuretano',
      madera_preferida: 'Cedro Caramelo',
      alto_cm: 78,
      ancho_cm: 210,
      profundidad_cm: 100,
      con_poliuretano: true,
      con_cerradura: false,
      precio_estimado_bs: 4320,
      anticipo_bs: 2160,
      forma_pago: 'qr_simple',
      deja_anticipo: true,
      estado_pago: 'anticipo_pagado',
      referencia_pago: 'ORU-309210',
      fecha_entrega: addDaysIso(new Date(Date.now() - 86400000 * 3).toISOString(), 8),
      notas: 'Mesa extendida para 8 personas en sala amplia',
      estado: 'aprobada',
      created_at: new Date(Date.now() - 86400000 * 3).toISOString(),
    },
  ],
  [
    'COT-3145',
    {
      id: 'cot-oruro-2',
      codigo_cotizacion: 'COT-3145',
      cliente_id: 'cli-oruro-1',
      cliente_nombre: 'Valeria Quispe Mendoza',
      cliente_telefono: '72410588',
      modelo_base: 'Ropero Esmeralda 3 Cuerpos c/Gavetas',
      descripcion_medidas: '225 × 195 × 62 cm · Poliuretano · Cerradura',
      madera_preferida: 'Nogal Oscuro / Mara',
      alto_cm: 225,
      ancho_cm: 195,
      profundidad_cm: 62,
      con_poliuretano: true,
      con_cerradura: true,
      precio_estimado_bs: 5640,
      anticipo_bs: 2820,
      forma_pago: 'transferencia',
      deja_anticipo: true,
      estado_pago: 'pagado_total',
      referencia_pago: 'ORU-314502',
      fecha_entrega: addDaysIso(new Date(Date.now() - 86400000 * 14).toISOString(), 10),
      notas: 'Divisiones extra para abrigos y zapatera inferior',
      estado: 'completada',
      created_at: new Date(Date.now() - 86400000 * 14).toISOString(),
    },
  ],
  [
    'COT-3208',
    {
      id: 'cot-oruro-3',
      codigo_cotizacion: 'COT-3208',
      cliente_id: 'cli-oruro-3',
      cliente_nombre: 'Carmen Mamani Condori',
      cliente_telefono: '73821904',
      modelo_base: 'Aparador Buffet Tajibo c/Vitrinas',
      descripcion_medidas: '98 × 190 × 48 cm · Poliuretano',
      madera_preferida: 'Tajibo Pátina',
      alto_cm: 98,
      ancho_cm: 190,
      profundidad_cm: 48,
      con_poliuretano: true,
      con_cerradura: false,
      precio_estimado_bs: 4050,
      anticipo_bs: 2025,
      forma_pago: 'qr_simple',
      deja_anticipo: true,
      estado_pago: 'anticipo_pagado',
      referencia_pago: 'ORU-320844',
      fecha_entrega: addDaysIso(new Date(Date.now() - 86400000 * 5).toISOString(), 9),
      notas: 'Vidrio templado biselado en puertas centrales',
      estado: 'en_fabricacion',
      created_at: new Date(Date.now() - 86400000 * 5).toISOString(),
    },
  ],
]);

const localInversiones: InversionRecord[] = [
  {
    id: 'inv-oruro-1',
    concepto: 'Lote madera Mara Boliviana seca (280 pies tablares)',
    categoria: 'madera',
    monto_bs: 4200,
    proveedor: 'Aserradero Chapare · Oruro',
    fecha: new Date(Date.now() - 86400000 * 20).toISOString().slice(0, 10),
    notas: 'Tablones de 2 pulgadas para roperos y camas',
    created_at: new Date(Date.now() - 86400000 * 20).toISOString(),
  },
  {
    id: 'inv-oruro-2',
    concepto: 'Madera Cedro Real & Tajibo seleccionado',
    categoria: 'madera',
    monto_bs: 2950,
    proveedor: 'Maderera San José',
    fecha: new Date(Date.now() - 86400000 * 10).toISOString().slice(0, 10),
    notas: 'Material para comedores y aparadores',
    created_at: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'inv-oruro-3',
    concepto: 'Laca poliuretánica, selladores y solventes',
    categoria: 'acabados',
    monto_bs: 980,
    proveedor: 'Pinturas Andinas Oruro',
    fecha: new Date(Date.now() - 86400000 * 4).toISOString().slice(0, 10),
    notas: 'Acabado semi-mate y protección UV',
    created_at: new Date(Date.now() - 86400000 * 4).toISOString(),
  },
  {
    id: 'inv-oruro-4',
    concepto: 'Bisagras cierre suave, rieles telescópicos y cerraduras',
    categoria: 'herrajes',
    monto_bs: 640,
    proveedor: 'Ferretería Central Pagador',
    fecha: new Date(Date.now() - 86400000 * 1).toISOString().slice(0, 10),
    notas: 'Stock mensual de taller',
    created_at: new Date(Date.now() - 86400000 * 1).toISOString(),
  },
];

function extractQuotePaymentMeta(notas?: string | null): {
  forma_pago: 'qr_simple' | 'transferencia' | 'showroom';
  deja_anticipo: boolean;
  estado_pago: 'sin_anticipo' | 'pendiente_anticipo' | 'anticipo_pagado' | 'pagado_total';
  referencia_pago: string | null;
  fecha_entrega: string | null;
} {
  const txt = String(notas || '');
  const formaMatch = txt.match(/\[PAGO:(qr_simple|transferencia|showroom)\]/i);
  const antMatch = txt.match(/\[ANTICIPO:(si|no)\]/i);
  const estMatch = txt.match(/\[EP:(sin_anticipo|pendiente_anticipo|anticipo_pagado|pagado_total)\]/i);
  const refMatch = txt.match(/\[REF:([^\]]+)\]/i);
  const entMatch = txt.match(/\[ENTREGA:(\d{4}-\d{2}-\d{2})\]/i);
  const deja = antMatch ? antMatch[1].toLowerCase() === 'si' : false;
  return {
    forma_pago: (formaMatch?.[1]?.toLowerCase() as 'qr_simple' | 'transferencia' | 'showroom') || 'qr_simple',
    deja_anticipo: deja,
    estado_pago:
      (estMatch?.[1]?.toLowerCase() as
        | 'sin_anticipo'
        | 'pendiente_anticipo'
        | 'anticipo_pagado'
        | 'pagado_total') || (deja ? 'pendiente_anticipo' : 'sin_anticipo'),
    referencia_pago: refMatch ? refMatch[1] : null,
    fecha_entrega: entMatch ? entMatch[1] : null,
  };
}

function stripQuotePaymentTags(notas?: string | null): string {
  return String(notas || '')
    .replace(/\s*\[(?:PAGO|ANTICIPO|EP|REF|ENTREGA):[^\]]+\]/gi, '')
    .trim();
}

function buildQuoteNotesWithMeta(
  cleanNotes: string | null,
  formaPago: 'qr_simple' | 'transferencia' | 'showroom',
  dejaAnticipo: boolean,
  estadoPago: 'sin_anticipo' | 'pendiente_anticipo' | 'anticipo_pagado' | 'pagado_total',
  referenciaPago?: string | null,
  fechaEntrega?: string | null
): string {
  const base = stripQuotePaymentTags(cleanNotes);
  const tags = `[PAGO:${formaPago}][ANTICIPO:${dejaAnticipo ? 'si' : 'no'}][EP:${estadoPago}]${
    referenciaPago ? `[REF:${referenciaPago}]` : ''
  }${fechaEntrega ? `[ENTREGA:${fechaEntrega}]` : ''}`;
  return base ? `${base} ${tags}` : tags;
}

function generateCode(prefix: 'MOD' | 'COT'): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}-${num}`;
}

function normalizePhone(phone: string): string {
  return String(phone || '').replace(/\s+/g, '').trim();
}

async function upsertClienteRecord(input: {
  nombre: string;
  telefono: string;
  direccion?: string;
  notas?: string | null;
}): Promise<ClienteRecord> {
  const nombre = String(input.nombre).trim();
  const telefono = normalizePhone(input.telefono);
  const direccion = String(input.direccion || 'Oruro, Bolivia').trim();
  const notas = input.notas ? String(input.notas).trim() : null;

  const existing = localClientes.get(telefono);
  const record: ClienteRecord = {
    id: existing?.id || crypto.randomUUID(),
    nombre,
    telefono,
    direccion,
    notas: notas ?? existing?.notas ?? null,
    created_at: existing?.created_at || new Date().toISOString(),
  };
  localClientes.set(telefono, record);
  return record;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: 'muebleria-modes-api',
      oruro_showroom: true,
      storage: 'local',
    });
  });

  // --- PRODUCTOS ---
  app.get('/api/productos', async (_req: Request, res: Response) => {
    try {
      const fallbackProducts = Object.values(MUEBLES_SHOWROOM).map((item) => ({
        ...item,
        stock: localStockMap.get(item.key) ?? item.stock,
      }));
      return res.json({ source: 'local', productos: fallbackProducts });
    } catch (err) {
      console.error('Error en GET /api/productos:', err);
      return res.status(500).json({ error: 'No se pudo obtener el catálogo de productos.' });
    }
  });

  // --- CLIENTES (CRM Oruro) ---
  app.get('/api/clientes', async (_req: Request, res: Response) => {
    try {
      const list = Array.from(localClientes.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      return res.json({ source: 'local', clientes: list });
    } catch (err) {
      console.error('Error en GET /api/clientes:', err);
      return res.status(500).json({ error: 'No se pudieron obtener los clientes.' });
    }
  });

  app.post('/api/clientes', async (req: Request, res: Response) => {
    try {
      const { nombre, telefono, direccion, notas } = req.body || {};
      if (!nombre || !String(nombre).trim()) {
        return res.status(400).json({ error: 'El nombre completo del cliente es obligatorio.' });
      }
      if (!telefono || normalizePhone(telefono).length < 7) {
        return res.status(400).json({ error: 'Ingresa un número de teléfono / WhatsApp válido.' });
      }
      const cliente = await upsertClienteRecord({
        nombre,
        telefono,
        direccion,
        notas,
      });
      return res.status(201).json({ ok: true, cliente });
    } catch (err) {
      console.error('Error en POST /api/clientes:', err);
      return res.status(500).json({ error: 'No se pudo registrar el cliente.' });
    }
  });

  // --- PEDIDOS / COMPRAS ---
  app.get('/api/pedidos', async (_req: Request, res: Response) => {
    try {
      const list = Array.from(localOrders.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      return res.json({ source: 'local', pedidos: list });
    } catch (err) {
      console.error('Error en GET /api/pedidos:', err);
      return res.status(500).json({ error: 'No se pudieron obtener los pedidos.' });
    }
  });

  app.post('/api/pedidos', async (req: Request, res: Response) => {
    try {
      const {
        cliente_nombre,
        cliente_telefono,
        modalidad_entrega = 'oruro',
        direccion_oruro = 'Oruro, Bolivia',
        notas_entrega = null,
        metodo_pago = 'qr_simple',
        items = [],
      } = req.body || {};

      if (!cliente_nombre || !String(cliente_nombre).trim()) {
        return res.status(400).json({ error: 'El nombre completo es obligatorio.' });
      }
      if (!cliente_telefono || normalizePhone(cliente_telefono).length < 7) {
        return res.status(400).json({ error: 'El teléfono / WhatsApp es obligatorio.' });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'El pedido debe contener al menos un mueble.' });
      }

      const validDelivery: 'oruro' | 'showroom' =
        modalidad_entrega === 'showroom' ? 'showroom' : 'oruro';
      const validPayMethod: 'qr_simple' | 'transferencia' | 'showroom' =
        metodo_pago === 'transferencia' || metodo_pago === 'showroom'
          ? metodo_pago
          : 'qr_simple';

      // Upsert cliente automatically before confirming purchase
      const cliente = await upsertClienteRecord({
        nombre: cliente_nombre,
        telefono: cliente_telefono,
        direccion:
          validDelivery === 'oruro'
            ? String(direccion_oruro || 'Oruro, Bolivia')
            : 'Retiro en Showroom Mueblería Modes, Oruro',
        notas: notas_entrega,
      });

      const normalizedItems: LocalOrderItem[] = [];
      let subtotal_bs = 0;

      for (const rawItem of items) {
        const key = String(rawItem.key || '') as MuebleItem['key'];
        const catalogItem = MUEBLES_SHOWROOM[key];
        if (!catalogItem) {
          return res.status(400).json({ error: `Producto inválido: ${key}` });
        }
        const cantidad = Math.max(1, Math.min(20, Math.floor(Number(rawItem.qty) || 1)));
        const finishId = (rawItem.finishId as WoodFinishId) || catalogItem.defaultFinish;
        const finishLabel = WOOD_FINISHES[finishId]?.label || catalogItem.color_acabado;
        const customDims = rawItem.customDims ? String(rawItem.customDims) : null;
        const displayName = rawItem.customName
          ? String(rawItem.customName)
          : catalogItem.nombre;
        const unitPrice =
          Number(rawItem.unitPriceBs) > 0 ? Number(rawItem.unitPriceBs) : catalogItem.precio_bs;

        normalizedItems.push({
          producto_slug: key,
          nombre: displayName,
          acabado: finishLabel,
          medidas_personalizadas: customDims,
          cantidad,
          precio_unitario_bs: unitPrice,
        });
        subtotal_bs += unitPrice * cantidad;
      }

      const envio_bs = validDelivery === 'oruro' ? 80 : 0;
      const total_bs = subtotal_bs + envio_bs;
      const anticipo_bs = Math.round(subtotal_bs * 0.5);
      const codigo_pedido = generateCode('MOD');
      const muebleResumen =
        normalizedItems.length === 1
          ? normalizedItems[0].nombre
          : `${normalizedItems[0].nombre} (+${normalizedItems.length - 1} más)`;
      const acabadoResumen = normalizedItems.map((i) => i.acabado).join(', ');

      for (const it of normalizedItems) {
        if (!it.medidas_personalizadas) {
          const cur = localStockMap.get(it.producto_slug) ?? 0;
          localStockMap.set(it.producto_slug, Math.max(0, cur - it.cantidad));
        }
      }

      const localOrder: PedidoRecord = {
        id: crypto.randomUUID(),
        codigo_pedido,
        cliente_id: cliente.id,
        cliente_nombre: cliente.nombre,
        cliente_telefono: cliente.telefono,
        mueble_nombre: muebleResumen,
        acabado: acabadoResumen,
        precio_bs: total_bs,
        modalidad_entrega: validDelivery,
        direccion_oruro: cliente.direccion,
        notas_entrega: notas_entrega ? String(notas_entrega).trim() : null,
        subtotal_bs,
        envio_bs,
        total_bs,
        anticipo_bs,
        metodo_pago: validPayMethod,
        estado_pago: 'pendiente_anticipo',
        referencia_pago: null,
        estado: 'confirmado',
        items: normalizedItems,
        created_at: new Date().toISOString(),
      };
      localOrders.set(codigo_pedido, localOrder);

      return res.status(201).json({
        source: 'local',
        cliente,
        pedido: localOrder,
      });
    } catch (err) {
      console.error('Error en POST /api/pedidos:', err);
      return res.status(500).json({ error: 'No se pudo registrar el pedido.' });
    }
  });

  app.patch('/api/pedidos/:codigo', async (req: Request, res: Response) => {
    try {
      const codigo = String(req.params.codigo || '').toUpperCase();
      const { estado } = req.body || {};
      const validStates = ['confirmado', 'en_taller', 'listo_entrega', 'entregado', 'cancelado'];
      if (!validStates.includes(estado)) {
        return res.status(400).json({ error: 'Estado de pedido inválido.' });
      }

      const found = localOrders.get(codigo);
      if (!found) return res.status(404).json({ error: 'Pedido no encontrado.' });
      found.estado = estado;
      return res.json({ source: 'local', pedido: found });
    } catch (err) {
      console.error('Error en PATCH /api/pedidos/:codigo:', err);
      return res.status(500).json({ error: 'No se pudo actualizar el estado del pedido.' });
    }
  });

  app.post('/api/pagos/anticipo', async (req: Request, res: Response) => {
    try {
      const { codigo_pedido, metodo_pago = 'qr_simple', referencia_pago } = req.body || {};
      const codigo = String(codigo_pedido || '').toUpperCase();
      if (!codigo) {
        return res.status(400).json({ error: 'Código de pedido requerido.' });
      }

      const referencia =
        referencia_pago && String(referencia_pago).trim()
          ? String(referencia_pago).trim()
          : `ORU-${Date.now().toString().slice(-6)}`;

      const localOrder = localOrders.get(codigo);
      if (!localOrder) {
        return res.status(404).json({ error: 'Pedido no encontrado.' });
      }

      localOrder.estado_pago = 'anticipo_pagado';
      localOrder.metodo_pago =
        metodo_pago === 'transferencia' || metodo_pago === 'showroom' ? metodo_pago : 'qr_simple';
      localOrder.referencia_pago = referencia;

      return res.json({
        source: 'local',
        ok: true,
        codigo_pedido: localOrder.codigo_pedido,
        estado_pago: localOrder.estado_pago,
        anticipo_bs: localOrder.anticipo_bs,
        referencia_pago: localOrder.referencia_pago,
      });
    } catch (err) {
      console.error('Error en POST /api/pagos/anticipo:', err);
      return res.status(500).json({ error: 'No se pudo procesar el registro del anticipo.' });
    }
  });

  // --- COTIZACIONES ---
  app.get('/api/cotizaciones', async (_req: Request, res: Response) => {
    try {
      const list = Array.from(localQuotes.values()).sort((a, b) =>
        b.created_at.localeCompare(a.created_at)
      );
      return res.json({ source: 'local', cotizaciones: list });
    } catch (err) {
      console.error('Error en GET /api/cotizaciones:', err);
      return res.status(500).json({ error: 'No se pudieron obtener las cotizaciones.' });
    }
  });

  app.post('/api/cotizaciones', async (req: Request, res: Response) => {
    try {
      const {
        cliente_nombre = null,
        cliente_telefono = null,
        cliente_direccion = 'Oruro, Bolivia',
        modelo_key = 'ropero',
        finish_id = 'mara',
        alto_cm,
        ancho_cm,
        profundidad_cm,
        con_poliuretano = true,
        con_cerradura = false,
        forma_pago = 'qr_simple',
        deja_anticipo = false,
        fecha_entrega = null,
        notas = null,
      } = req.body || {};

      const validFormaPago: 'qr_simple' | 'transferencia' | 'showroom' =
        forma_pago === 'transferencia' || forma_pago === 'showroom' ? forma_pago : 'qr_simple';
      const dejaAnticipoBool = Boolean(deja_anticipo);
      const estadoPagoInit: 'sin_anticipo' | 'anticipo_pagado' | 'pendiente_anticipo' =
        dejaAnticipoBool ? 'anticipo_pagado' : 'sin_anticipo';
      const refInit = dejaAnticipoBool ? `COT-${Date.now().toString().slice(-6)}` : null;

      const baseItem = MUEBLES_SHOWROOM[modelo_key as MuebleItem['key']] || MUEBLES_SHOWROOM.ropero;
      const validFinish = (finish_id as WoodFinishId) || baseItem.defaultFinish;
      const finishPreset = WOOD_FINISHES[validFinish] || WOOD_FINISHES.mara;

      const alto = Math.max(40, Math.min(300, Number(alto_cm) || baseItem.alto_cm));
      const ancho = Math.max(40, Math.min(350, Number(ancho_cm) || baseItem.ancho_cm));
      const profundidad = Math.max(
        25,
        Math.min(200, Number(profundidad_cm) || baseItem.profundidad_cm)
      );

      const woodMultipliers: Record<WoodFinishId, number> = {
        mara: 1.15,
        tajibo: 1.12,
        cedro: 1.05,
        roble: 1.0,
        grafito: 0.96,
      };
      const baseVol = Math.max(1, baseItem.alto_cm * baseItem.ancho_cm * baseItem.profundidad_cm);
      const customVol = Math.max(1, alto * ancho * profundidad);
      const scaleFactor = 0.45 + 0.55 * (customVol / baseVol);
      const woodFactor = woodMultipliers[validFinish] || 1;
      const extras = (con_poliuretano ? 180 : 0) + (con_cerradura ? 110 : 0);
      const precio_estimado_bs =
        Math.round((baseItem.precio_bs * scaleFactor * woodFactor + extras) / 10) * 10;
      const anticipo_bs = Math.round(precio_estimado_bs * 0.5);
      const codigo_cotizacion = generateCode('COT');
      const nowIso = new Date().toISOString();
      const resolvedFechaEntrega =
        typeof fecha_entrega === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)
          ? fecha_entrega
          : addDaysIso(nowIso, 7);

      const descripcion_medidas = `${alto} × ${ancho} × ${profundidad} cm${
        con_poliuretano ? ' · Poliuretano' : ''
      }${con_cerradura ? ' · Cerradura' : ''}`;

      let clienteId: string | null = null;
      if (cliente_nombre && cliente_telefono && normalizePhone(cliente_telefono).length >= 7) {
        const cli = await upsertClienteRecord({
          nombre: String(cliente_nombre),
          telefono: String(cliente_telefono),
          direccion: String(cliente_direccion || 'Oruro, Bolivia'),
          notas: notas ? String(notas) : null,
        });
        clienteId = cli.id;
      }

      const cleanNotas = notas ? stripQuotePaymentTags(String(notas)) : null;

      const localQuote: CotizacionRecord = {
        id: crypto.randomUUID(),
        codigo_cotizacion,
        cliente_id: clienteId,
        cliente_nombre: cliente_nombre ? String(cliente_nombre).trim() : null,
        cliente_telefono: cliente_telefono ? normalizePhone(cliente_telefono) : null,
        modelo_base: baseItem.nombre,
        descripcion_medidas,
        madera_preferida: finishPreset.label,
        alto_cm: alto,
        ancho_cm: ancho,
        profundidad_cm: profundidad,
        con_poliuretano: Boolean(con_poliuretano),
        con_cerradura: Boolean(con_cerradura),
        precio_estimado_bs,
        anticipo_bs,
        forma_pago: validFormaPago,
        deja_anticipo: dejaAnticipoBool,
        estado_pago: estadoPagoInit,
        referencia_pago: refInit,
        fecha_entrega: resolvedFechaEntrega,
        notas: cleanNotas,
        estado: 'pendiente',
        created_at: nowIso,
      };
      localQuotes.set(codigo_cotizacion, localQuote);

      return res.status(201).json({
        source: 'local',
        cotizacion: localQuote,
      });
    } catch (err) {
      console.error('Error en POST /api/cotizaciones:', err);
      return res.status(500).json({ error: 'No se pudo guardar la cotización.' });
    }
  });

  app.patch('/api/cotizaciones/:codigo', async (req: Request, res: Response) => {
    try {
      const codigo = String(req.params.codigo || '').toUpperCase();
      const {
        estado,
        cliente_nombre,
        cliente_telefono,
        modelo_key,
        finish_id,
        alto_cm,
        ancho_cm,
        profundidad_cm,
        con_poliuretano,
        con_cerradura,
        fecha_entrega,
        notas,
      } = req.body || {};
      const validStates = ['pendiente', 'aprobada', 'en_fabricacion', 'completada'];

      if (estado !== undefined && !validStates.includes(estado)) {
        return res.status(400).json({ error: 'Estado de cotización inválido.' });
      }

      const hasFullOrDimsUpdate =
        cliente_nombre !== undefined ||
        cliente_telefono !== undefined ||
        modelo_key !== undefined ||
        finish_id !== undefined ||
        alto_cm !== undefined ||
        ancho_cm !== undefined ||
        profundidad_cm !== undefined ||
        con_poliuretano !== undefined ||
        con_cerradura !== undefined ||
        fecha_entrega !== undefined ||
        notas !== undefined;

      if (!hasFullOrDimsUpdate && estado === undefined) {
        return res.status(400).json({ error: 'No se especificaron cambios para la cotización.' });
      }

      const computeUpdatedQuoteFields = (
        existing: CotizacionRecord,
        forSupabase: boolean
      ): Partial<CotizacionRecord> => {
        const updatePayload: Partial<CotizacionRecord> = {};
        if (estado !== undefined) {
          updatePayload.estado = estado;
        }
        if (!hasFullOrDimsUpdate) return updatePayload;

        const baseItem =
          (modelo_key && MUEBLES_SHOWROOM[modelo_key as MuebleItem['key']]) ||
          Object.values(MUEBLES_SHOWROOM).find((m) => m.nombre === existing.modelo_base) ||
          MUEBLES_SHOWROOM.ropero;

        const finishEntry: WoodFinishId =
          (typeof finish_id === 'string'
            ? WOOD_FINISHES[finish_id as WoodFinishId]?.id
            : undefined) ||
          (Object.values(WOOD_FINISHES).find(
            (f) => f.label === existing.madera_preferida || f.shortLabel === existing.madera_preferida
          )?.id as WoodFinishId | undefined) ||
          baseItem.defaultFinish;

        const finishPreset = WOOD_FINISHES[finishEntry] || WOOD_FINISHES.mara;
        const alto = Math.max(40, Math.min(300, Number(alto_cm) || existing.alto_cm));
        const ancho = Math.max(40, Math.min(350, Number(ancho_cm) || existing.ancho_cm));
        const profundidad = Math.max(
          25,
          Math.min(200, Number(profundidad_cm) || existing.profundidad_cm)
        );
        const nextPoli =
          con_poliuretano !== undefined ? Boolean(con_poliuretano) : Boolean(existing.con_poliuretano);
        const nextCerr =
          con_cerradura !== undefined ? Boolean(con_cerradura) : Boolean(existing.con_cerradura);

        const woodMultipliers: Record<WoodFinishId, number> = {
          mara: 1.15,
          tajibo: 1.12,
          cedro: 1.05,
          roble: 1.0,
          grafito: 0.96,
        };
        const baseVol = Math.max(
          1,
          baseItem.alto_cm * baseItem.ancho_cm * baseItem.profundidad_cm
        );
        const customVol = Math.max(1, alto * ancho * profundidad);
        const scaleFactor = 0.45 + 0.55 * (customVol / baseVol);
        const woodFactor = woodMultipliers[finishEntry] || 1;
        const extras = (nextPoli ? 180 : 0) + (nextCerr ? 110 : 0);
        const precio_estimado_bs =
          Math.round((baseItem.precio_bs * scaleFactor * woodFactor + extras) / 10) * 10;

        if (cliente_nombre !== undefined) {
          updatePayload.cliente_nombre = cliente_nombre ? String(cliente_nombre).trim() : null;
        }
        if (cliente_telefono !== undefined) {
          updatePayload.cliente_telefono = cliente_telefono
            ? normalizePhone(String(cliente_telefono))
            : null;
        }
        updatePayload.modelo_base = baseItem.nombre;
        updatePayload.madera_preferida = finishPreset.label;
        updatePayload.alto_cm = alto;
        updatePayload.ancho_cm = ancho;
        updatePayload.profundidad_cm = profundidad;
        updatePayload.con_poliuretano = nextPoli;
        updatePayload.con_cerradura = nextCerr;
        updatePayload.descripcion_medidas = `${alto} × ${ancho} × ${profundidad} cm${
          nextPoli ? ' · Poliuretano' : ''
        }${nextCerr ? ' · Cerradura' : ''}`;
        updatePayload.precio_estimado_bs = precio_estimado_bs;
        updatePayload.anticipo_bs = Math.round(precio_estimado_bs * 0.5);

        const meta = extractQuotePaymentMeta(existing.notas);
        const nextForma = existing.forma_pago || meta.forma_pago;
        const nextDeja =
          typeof existing.deja_anticipo === 'boolean' ? existing.deja_anticipo : meta.deja_anticipo;
        const nextEstadoPago = existing.estado_pago || meta.estado_pago;
        const nextRef = existing.referencia_pago ?? meta.referencia_pago;
        const nextEntrega =
          typeof fecha_entrega === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha_entrega)
            ? fecha_entrega
            : existing.fecha_entrega || meta.fecha_entrega || addDaysIso(existing.created_at, 7);
        const cleanNotas =
          notas !== undefined
            ? notas
              ? stripQuotePaymentTags(String(notas))
              : null
            : stripQuotePaymentTags(existing.notas) || null;

        if (forSupabase) {
          updatePayload.notas = buildQuoteNotesWithMeta(
            cleanNotas,
            nextForma,
            nextDeja,
            nextEstadoPago,
            nextRef,
            nextEntrega
          );
        } else {
          updatePayload.fecha_entrega = nextEntrega;
          updatePayload.notas = cleanNotas;
        }

        return updatePayload;
      };

      const found = localQuotes.get(codigo);
      if (!found) return res.status(404).json({ error: 'Cotización no encontrada.' });
      const updatePayload = computeUpdatedQuoteFields(found, false);
      Object.assign(found, updatePayload);
      return res.json({ source: 'local', cotizacion: found });
    } catch (err) {
      console.error('Error en PATCH /api/cotizaciones/:codigo:', err);
      return res.status(500).json({ error: 'No se pudo actualizar la cotización.' });
    }
  });

  app.post('/api/cotizaciones/:codigo/pago', async (req: Request, res: Response) => {
    try {
      const codigo = String(req.params.codigo || '').toUpperCase();
      const {
        forma_pago = 'qr_simple',
        tipo_pago = 'anticipo',
        referencia_pago,
      } = req.body || {};

      const validForma: 'qr_simple' | 'transferencia' | 'showroom' =
        forma_pago === 'transferencia' || forma_pago === 'showroom' ? forma_pago : 'qr_simple';
      const nextEstadoPago: 'anticipo_pagado' | 'pagado_total' =
        tipo_pago === 'total' ? 'pagado_total' : 'anticipo_pagado';
      const ref =
        referencia_pago && String(referencia_pago).trim()
          ? String(referencia_pago).trim()
          : `COT-${Date.now().toString().slice(-6)}`;

      const found = localQuotes.get(codigo);
      if (!found) return res.status(404).json({ error: 'Cotización no encontrada.' });
      found.forma_pago = validForma;
      found.deja_anticipo = true;
      found.estado_pago = nextEstadoPago;
      found.referencia_pago = ref;

      return res.json({ source: 'local', cotizacion: found });
    } catch (err) {
      console.error('Error en POST /api/cotizaciones/:codigo/pago:', err);
      return res.status(500).json({ error: 'No se pudo registrar el pago de la cotización.' });
    }
  });

  // --- INVERSIONES / CONTROL ECONÓMICO ---
  app.get('/api/inversiones', (_req: Request, res: Response) => {
    const sorted = [...localInversiones].sort((a, b) => b.fecha.localeCompare(a.fecha));
    return res.json({ inversiones: sorted });
  });

  app.post('/api/inversiones', (req: Request, res: Response) => {
    try {
      const {
        concepto,
        categoria = 'madera',
        monto_bs,
        proveedor = null,
        fecha,
        notas = null,
      } = req.body || {};

      if (!concepto || !String(concepto).trim()) {
        return res.status(400).json({ error: 'El concepto de inversión es obligatorio.' });
      }
      const monto = Number(monto_bs);
      if (Number.isNaN(monto) || monto <= 0) {
        return res.status(400).json({ error: 'El monto de inversión debe ser mayor a 0.' });
      }
      const validCats = ['madera', 'herrajes', 'acabados', 'mano_obra', 'operativo'];
      const cat = validCats.includes(categoria) ? categoria : 'madera';
      const cleanFecha =
        typeof fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
          ? fecha
          : new Date().toISOString().slice(0, 10);

      const record: InversionRecord = {
        id: crypto.randomUUID(),
        concepto: String(concepto).trim(),
        categoria: cat,
        monto_bs: Math.round(monto),
        proveedor: proveedor ? String(proveedor).trim() : null,
        fecha: cleanFecha,
        notas: notas ? String(notas).trim() : null,
        created_at: new Date().toISOString(),
      };
      localInversiones.unshift(record);
      return res.status(201).json({ inversion: record });
    } catch (err) {
      console.error('Error en POST /api/inversiones:', err);
      return res.status(500).json({ error: 'No se pudo registrar la inversión.' });
    }
  });

  app.delete('/api/inversiones/:id', (req: Request, res: Response) => {
    const idx = localInversiones.findIndex((i) => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Inversión no encontrada.' });
    localInversiones.splice(idx, 1);
    return res.json({ ok: true });
  });

  // --- ASISTENTE IA (Gemini API Server-Side) ---
  app.post('/api/asistente-chat', async (req: Request, res: Response) => {
    try {
      const { message, history = [] } = req.body || {};
      const userMsg = String(message || '').trim();
      if (!userMsg) {
        return res.status(400).json({ error: 'Escribe una consulta para el asistente.' });
      }

      const catalogSummary = MUEBLES_CATALOGO.map(
        (m) =>
          `- ${m.nombre} (${m.categoria}, ${m.madera}): Bs. ${m.precio_bs} (Anticipo 50%: Bs. ${m.anticipo_bs}), medidas estándar ${m.alto_cm}×${m.ancho_cm}×${m.profundidad_cm} cm.`
      ).join('\n');

      const buildFallbackResponse = (q: string) => {
        const lower = q.toLowerCase();
        if (lower.includes('madera') || lower.includes('mara') || lower.includes('cedro') || lower.includes('tajibo') || lower.includes('roble')) {
          return {
            reply:
              'En Mueblería Modes (Oruro) trabajamos 4 maderas nobles bolivianas secadas al natural: **Mara** (color nogal elegante, ideal para roperos y dormitorios), **Cedro** (tono caramelo cálido, muy versátil para comedores), **Tajibo** (alta densidad y resistencia estructural para estanterías y escritorios) y **Roble** (veta clara escandinava). Todas pueden llevar sellado poliuretánico impermeabilizante.',
            suggestions: [
              '¿Qué precio tiene un ropero en Mara?',
              '¿Puedo personalizar las medidas?',
              '¿Cómo funciona el anticipo del 50%?',
            ],
          };
        }
        if (lower.includes('pago') || lower.includes('anticipo') || lower.includes('qr') || lower.includes('transferencia')) {
          return {
            reply:
              'Aceptamos **QR Simple (Banco Unión / Tigo Money)**, **Transferencia Bancaria** y **Pago directo en nuestro Showroom en Oruro**. Para pedidos y cotizaciones a medida puedes dejar un **anticipo del 50%** para iniciar el corte en taller o registrarlo sin anticipo y confirmar tu pago luego desde la sección **Bolsa y Pedidos**.',
            suggestions: [
              '¿Cuánto cuesta el envío en Oruro?',
              'Quiero hacer una cotización a medida',
              '¿Dónde está ubicado el taller?',
            ],
          };
        }
        if (lower.includes('envio') || lower.includes('envío') || lower.includes('entrega') || lower.includes('oruro') || lower.includes('direccion') || lower.includes('dirección')) {
          return {
            reply:
              'Realizamos entregas a domicilio en toda la ciudad de **Oruro** con armado incluido por un costo fijo de **Bs. 80** (o retiro gratuito en nuestro Showroom). El tiempo de fabricación a medida es de 7 a 14 días hábiles según la pieza. Atención directa al WhatsApp/Tel: **+591 72418920**.',
            suggestions: [
              '¿Qué muebles tienen en stock?',
              '¿Cuáles son las medidas de los comedores?',
              '¿Cómo pago mi pedido con QR?',
            ],
          };
        }
        if (lower.includes('cotiz') || lower.includes('medida') || lower.includes('tamaño') || lower.includes('alto') || lower.includes('ancho')) {
          return {
            reply:
              'Puedes ajustar **Alto, Ancho y Profundidad en cm** en tiempo real tanto en el visor **3D Interactivo** (acercándote a Don Teófilo) como en **Cotizaciones a Medida** o **Gestión de Clientes**. Antes de guardar elegirás tu forma de pago y si dejas el anticipo del 50%, y tu cotización pasará directo a **Bolsa y Pedidos**.',
            suggestions: [
              '¿Qué maderas recomiendan para ropero?',
              '¿Incluyen herrajes cierre suave?',
              '¿Cuánto cuesta un comedor de 6 sillas?',
            ],
          };
        }
        return {
          reply:
            '¡Hola! Soy el **Asistente IA de Mueblería Modes** en Oruro, Bolivia. Puedo ayudarte con precios en Bolivianos (Bs.), maderas nobles (Mara, Cedro, Tajibo y Roble), medidas personalizadas, tiempos de fabricación con Don Teófilo, envíos a domicilio en Oruro (Bs. 80) y pagos con QR Simple o transferencia. ¿Sobre qué mueble o medida deseas consultar?',
          suggestions: [
            '¿Qué maderas trabajan y cuál recomiendan?',
            '¿Cuánto cuesta un ropero o comedor?',
            '¿Cómo funciona la cotización y el anticipo?',
          ],
        };
      };

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ source: 'fallback', ...buildFallbackResponse(userMsg) });
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const systemPrompt = `Eres María, la Asistente IA comercial y técnica de "Mueblería Modes" en Oruro, Bolivia (taller del Maestro Artesano Don Teófilo).
Responde siempre en español claro, cordial, experto y conciso (máximo 120 palabras), usando precios en Bolivianos (Bs.).
Información oficial del taller y catálogo:
- Maderas: Mara (elegante nogal oscuro), Cedro (tono caramelo), Tajibo (ultra resistente), Roble (estilo escandinavo claro).
- Envíos en Oruro: Bs. 80 a domicilio en zonas de Oruro, o retiro gratuito en Showroom.
- Pagos: QR Simple, Transferencia Bancaria o en Showroom. En compras o cotizaciones a medida el cliente puede dejar anticipo del 50% o registrarla sin anticipo y pagarla desde Bolsa y Pedidos.
- Contacto WhatsApp/Teléfono Oruro: +591 72418920.
Catálogo principal:
${catalogSummary}

Al final de tu respuesta, agrega EXACTAMENTE una línea nueva que empiece por "SUGERENCIAS:" seguida de 3 preguntas cortas de seguimiento separadas por "|" (máximo 6 palabras cada una).`;

      const contents = [
        ...(Array.isArray(history)
          ? history.slice(-6).map((h: { role?: string; text?: string }) => ({
              role: h.role === 'model' ? 'model' : 'user',
              parts: [{ text: String(h.text || '') }],
            }))
          : []),
        { role: 'user', parts: [{ text: userMsg }] },
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.5,
        },
      });

      const fullText = (response.text || '').trim();
      if (!fullText) {
        return res.json({ source: 'fallback', ...buildFallbackResponse(userMsg) });
      }

      const sugIdx = fullText.lastIndexOf('SUGERENCIAS:');
      let reply = fullText;
      let suggestions = [
        '¿Qué maderas recomiendan para roperos?',
        '¿Cómo funciona el anticipo del 50%?',
        '¿Hacen envíos en toda Oruro?',
      ];

      if (sugIdx !== -1) {
        reply = fullText.slice(0, sugIdx).trim();
        const rawSug = fullText.slice(sugIdx + 'SUGERENCIAS:'.length).trim();
        const parsed = rawSug
          .split('|')
          .map((s) => s.trim())
          .filter(Boolean)
          .slice(0, 3);
        if (parsed.length > 0) suggestions = parsed;
      }

      return res.json({ source: 'gemini', reply, suggestions });
    } catch (err) {
      console.error('Error en POST /api/asistente-chat:', err);
      return res.json({
        source: 'fallback',
        reply:
          'Con gusto te ayudo en Mueblería Modes (Oruro). Trabajamos Mara, Cedro, Tajibo y Roble a medida con envíos en Oruro (Bs. 80) y pago por QR Simple, transferencia o en showroom (+591 72418920). ¿Qué mueble te interesa cotizar?',
        suggestions: [
          '¿Qué muebles tienen disponibles?',
          '¿Cómo pido una cotización a medida?',
          '¿Cómo funciona el pago y anticipo?',
        ],
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Mueblería Modes server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
