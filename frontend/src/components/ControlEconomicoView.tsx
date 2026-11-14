import React, { useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ClipboardList,
  DollarSign,
  Loader2,
  Package,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import {
  CotizacionDTO,
  InversionDTO,
  PedidoDTO,
  appService,
} from '../services/appService';

type PeriodMode = 'diario' | 'semanal' | 'mensual' | 'todo';
type ChartVisualMode = 'barras' | 'tendencia';
type HistoryFilter = 'todos' | 'venta' | 'pedido' | 'inversion';

interface ControlEconomicoViewProps {
  pedidos: PedidoDTO[];
  cotizaciones: CotizacionDTO[];
  inversiones: InversionDTO[];
  onRefresh: () => void;
}

interface BucketMetric {
  key: string;
  label: string;
  subLabel: string;
  ventasCount: number;
  pedidosCount: number;
  ingresosBs: number;
  inversionBs: number;
  gananciaBs: number;
}

interface ProductStat {
  nombre: string;
  ventasCount: number;
  pedidosCount: number;
  ingresosBs: number;
  costoEstBs: number;
  gananciaEstBs: number;
  margenPct: number;
}

interface UnifiedHistoryRow {
  id: string;
  fechaIso: string;
  fechaDisplay: string;
  tipo: 'venta' | 'pedido' | 'inversion';
  codigo: string;
  titulo: string;
  contraparte: string;
  ingresoBs: number;
  inversionBs: number;
  netoBs: number;
  badgeText: string;
}

const INV_CAT_LABELS: Record<InversionDTO['categoria'], string> = {
  madera: 'Madera Noble',
  herrajes: 'Herrajes',
  acabados: 'Lacas y Acabados',
  mano_obra: 'Mano de Obra',
  operativo: 'Operativo / Envío',
};

const PRODUCT_COST_RATIO = 0.58; // ~58% madera/herrajes/mano de obra, ~42% margen artesanal
const LABOR_OVERHEAD_RATIO = 0.22; // Mano de obra directa complementaria sobre ingresos

function getQuoteCollectedBs(cot: CotizacionDTO): number {
  if (cot.estado_pago === 'pagado_total') return Number(cot.precio_estimado_bs) || 0;
  if (cot.estado_pago === 'anticipo_pagado' || cot.deja_anticipo) {
    return Number(cot.anticipo_bs) || Math.round((Number(cot.precio_estimado_bs) || 0) * 0.5);
  }
  return 0;
}

function formatShortDateEs(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getMondayKey(dateInput: Date): string {
  const d = new Date(dateInput);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().slice(0, 10);
}

export function ControlEconomicoView({
  pedidos,
  cotizaciones,
  inversiones,
  onRefresh,
}: ControlEconomicoViewProps) {
  const [period, setPeriod] = useState<PeriodMode>('semanal');
  const [chartVisual, setChartVisual] = useState<ChartVisualMode>('barras');
  const [hoveredBucketKey, setHoveredBucketKey] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('todos');
  const [historySearch, setHistorySearch] = useState('');
  const [historySortAsc, setHistorySortAsc] = useState(false);

  // Modal to register new workshop investment
  const [invModalOpen, setInvModalOpen] = useState(false);
  const [invConcepto, setInvConcepto] = useState('');
  const [invCategoria, setInvCategoria] = useState<InversionDTO['categoria']>('madera');
  const [invMonto, setInvMonto] = useState('');
  const [invProveedor, setInvProveedor] = useState('');
  const [invFecha, setInvFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [invNotas, setInvNotas] = useState('');
  const [savingInv, setSavingInv] = useState(false);
  const [invError, setInvError] = useState<string | null>(null);

  // Date cutoff based on period filter
  const periodCutoffMs = useMemo(() => {
    const now = Date.now();
    if (period === 'diario') return now - 86400000 * 7; // últimos 7 días (vista diaria)
    if (period === 'semanal') return now - 86400000 * 56; // últimas 8 semanas
    if (period === 'mensual') return now - 86400000 * 180; // últimos 6 meses
    return 0;
  }, [period]);

  const filteredPedidos = useMemo(
    () =>
      pedidos.filter((p) => new Date(p.created_at).getTime() >= periodCutoffMs),
    [pedidos, periodCutoffMs]
  );

  const filteredCotizaciones = useMemo(
    () =>
      cotizaciones.filter((c) => new Date(c.created_at).getTime() >= periodCutoffMs),
    [cotizaciones, periodCutoffMs]
  );

  const filteredInversiones = useMemo(
    () =>
      inversiones.filter((inv) => {
        const ts = new Date(`${inv.fecha}T12:00:00`).getTime();
        return ts >= periodCutoffMs;
      }),
    [inversiones, periodCutoffMs]
  );

  // Core KPIs
  const summary = useMemo(() => {
    const ventasTotalBs = filteredPedidos.reduce(
      (acc, p) => acc + Number(p.precio_bs ?? p.total_bs ?? 0),
      0
    );
    const pedidosContratadoBs = filteredCotizaciones.reduce(
      (acc, c) => acc + Number(c.precio_estimado_bs || 0),
      0
    );
    const pedidosCobradoBs = filteredCotizaciones.reduce(
      (acc, c) => acc + getQuoteCollectedBs(c),
      0
    );

    const ingresosBrutosBs = ventasTotalBs + pedidosContratadoBs;
    const ingresosCobradosBs = ventasTotalBs + pedidosCobradoBs;

    const inversionTallerBs = filteredInversiones.reduce(
      (acc, inv) => acc + Number(inv.monto_bs || 0),
      0
    );
    const manoObraTallerBs = Math.round(ingresosBrutosBs * LABOR_OVERHEAD_RATIO);
    const costoTotalGeneralBs = inversionTallerBs + manoObraTallerBs;

    const gananciaNetaBs = ingresosBrutosBs - costoTotalGeneralBs;
    const margenGeneralPct =
      ingresosBrutosBs > 0 ? Math.round((gananciaNetaBs / ingresosBrutosBs) * 100) : 0;

    return {
      ventasCount: filteredPedidos.length,
      ventasTotalBs,
      pedidosCount: filteredCotizaciones.length,
      pedidosContratadoBs,
      pedidosCobradoBs,
      ingresosBrutosBs,
      ingresosCobradosBs,
      inversionTallerBs,
      manoObraTallerBs,
      costoTotalGeneralBs,
      gananciaNetaBs,
      margenGeneralPct,
    };
  }, [filteredPedidos, filteredCotizaciones, filteredInversiones]);

  // Dynamic Time-Series Buckets (Diario / Semanal / Mensual)
  const timeBuckets = useMemo<BucketMetric[]>(() => {
    const now = new Date();
    const buckets: BucketMetric[] = [];
    const map = new Map<string, BucketMetric>();

    if (period === 'diario') {
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const label =
          i === 0
            ? 'Hoy'
            : d.toLocaleDateString('es-BO', { weekday: 'short' }).replace('.', '');
        const subLabel = d.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
        const item: BucketMetric = {
          key,
          label,
          subLabel,
          ventasCount: 0,
          pedidosCount: 0,
          ingresosBs: 0,
          inversionBs: 0,
          gananciaBs: 0,
        };
        buckets.push(item);
        map.set(key, item);
      }
    } else if (period === 'semanal') {
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i * 7);
        const key = getMondayKey(d);
        const monday = new Date(`${key}T12:00:00`);
        const label = i === 0 ? 'Esta sem.' : `Sem ${6 - i}`;
        const subLabel = monday.toLocaleDateString('es-BO', { day: '2-digit', month: 'short' });
        if (!map.has(key)) {
          const item: BucketMetric = {
            key,
            label,
            subLabel,
            ventasCount: 0,
            pedidosCount: 0,
            ingresosBs: 0,
            inversionBs: 0,
            gananciaBs: 0,
          };
          buckets.push(item);
          map.set(key, item);
        }
      }
    } else {
      const monthsBack = period === 'mensual' ? 5 : 5;
      for (let i = monthsBack; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const label = d.toLocaleDateString('es-BO', { month: 'short' }).replace('.', '');
        const subLabel = String(d.getFullYear());
        const item: BucketMetric = {
          key,
          label: label.charAt(0).toUpperCase() + label.slice(1),
          subLabel,
          ventasCount: 0,
          pedidosCount: 0,
          ingresosBs: 0,
          inversionBs: 0,
          gananciaBs: 0,
        };
        buckets.push(item);
        map.set(key, item);
      }
    }

    const resolveBucketKey = (isoDate: string): string => {
      const d = new Date(isoDate);
      if (period === 'diario') return d.toISOString().slice(0, 10);
      if (period === 'semanal') return getMondayKey(d);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };

    filteredPedidos.forEach((p) => {
      const b = map.get(resolveBucketKey(p.created_at));
      if (!b) return;
      const amt = Number(p.precio_bs ?? p.total_bs ?? 0);
      b.ventasCount += 1;
      b.ingresosBs += amt;
      b.inversionBs += Math.round(amt * LABOR_OVERHEAD_RATIO);
    });

    filteredCotizaciones.forEach((c) => {
      const b = map.get(resolveBucketKey(c.created_at));
      if (!b) return;
      const amt = Number(c.precio_estimado_bs || 0);
      b.pedidosCount += 1;
      b.ingresosBs += amt;
      b.inversionBs += Math.round(amt * LABOR_OVERHEAD_RATIO);
    });

    filteredInversiones.forEach((inv) => {
      const b = map.get(resolveBucketKey(`${inv.fecha}T12:00:00`));
      if (!b) return;
      b.inversionBs += Number(inv.monto_bs || 0);
    });

    buckets.forEach((b) => {
      b.gananciaBs = b.ingresosBs - b.inversionBs;
    });

    return buckets;
  }, [period, filteredPedidos, filteredCotizaciones, filteredInversiones]);

  const maxChartVal = useMemo(() => {
    let max = 1000;
    timeBuckets.forEach((b) => {
      max = Math.max(max, b.ingresosBs, b.inversionBs, Math.abs(b.gananciaBs));
    });
    return Math.ceil(max / 500) * 500;
  }, [timeBuckets]);

  const activeBucket =
    timeBuckets.find((b) => b.key === hoveredBucketKey) ||
    timeBuckets[timeBuckets.length - 1] ||
    null;

  // Product Profitability Breakdown
  const productStats = useMemo<ProductStat[]>(() => {
    const map = new Map<string, ProductStat>();

    const ensure = (name: string) => {
      const clean = name.trim();
      if (!map.has(clean)) {
        map.set(clean, {
          nombre: clean,
          ventasCount: 0,
          pedidosCount: 0,
          ingresosBs: 0,
          costoEstBs: 0,
          gananciaEstBs: 0,
          margenPct: 42,
        });
      }
      return map.get(clean)!;
    };

    filteredPedidos.forEach((p) => {
      const st = ensure(p.mueble_nombre);
      const amt = Number(p.precio_bs ?? p.total_bs ?? 0);
      const cost = Math.round(amt * PRODUCT_COST_RATIO);
      st.ventasCount += 1;
      st.ingresosBs += amt;
      st.costoEstBs += cost;
      st.gananciaEstBs += amt - cost;
    });

    filteredCotizaciones.forEach((c) => {
      const st = ensure(c.modelo_base);
      const amt = Number(c.precio_estimado_bs || 0);
      const cost = Math.round(amt * PRODUCT_COST_RATIO);
      st.pedidosCount += 1;
      st.ingresosBs += amt;
      st.costoEstBs += cost;
      st.gananciaEstBs += amt - cost;
    });

    return Array.from(map.values())
      .map((s) => ({
        ...s,
        margenPct: s.ingresosBs > 0 ? Math.round((s.gananciaEstBs / s.ingresosBs) * 100) : 0,
      }))
      .sort((a, b) => b.gananciaEstBs - a.gananciaEstBs);
  }, [filteredPedidos, filteredCotizaciones]);

  const maxProductProfit = useMemo(
    () => Math.max(1000, ...productStats.map((p) => p.gananciaEstBs)),
    [productStats]
  );

  // Unified Sorted Economic History
  const unifiedHistory = useMemo<UnifiedHistoryRow[]>(() => {
    const rows: UnifiedHistoryRow[] = [];

    filteredPedidos.forEach((p) => {
      const ingreso = Number(p.precio_bs ?? p.total_bs ?? 0);
      const costo = Math.round(ingreso * PRODUCT_COST_RATIO);
      rows.push({
        id: `ped-${p.id}`,
        fechaIso: p.created_at,
        fechaDisplay: formatShortDateEs(p.created_at),
        tipo: 'venta',
        codigo: p.codigo_pedido,
        titulo: p.mueble_nombre,
        contraparte: p.cliente_nombre,
        ingresoBs: ingreso,
        inversionBs: costo,
        netoBs: ingreso - costo,
        badgeText: 'Venta inmediata',
      });
    });

    filteredCotizaciones.forEach((c) => {
      const ingreso = Number(c.precio_estimado_bs || 0);
      const costo = Math.round(ingreso * PRODUCT_COST_RATIO);
      rows.push({
        id: `cot-${c.id}`,
        fechaIso: c.created_at,
        fechaDisplay: formatShortDateEs(c.created_at),
        tipo: 'pedido',
        codigo: c.codigo_cotizacion,
        titulo: `${c.modelo_base} (${c.descripcion_medidas})`,
        contraparte: c.cliente_nombre || 'Cliente Showroom',
        ingresoBs: ingreso,
        inversionBs: costo,
        netoBs: ingreso - costo,
        badgeText:
          c.estado_pago === 'pagado_total'
            ? 'Pedido 100% pagado'
            : c.estado_pago === 'anticipo_pagado'
            ? 'Pedido c/anticipo 50%'
            : 'Pedido cotizado',
      });
    });

    filteredInversiones.forEach((inv) => {
      const monto = Number(inv.monto_bs || 0);
      rows.push({
        id: `inv-${inv.id}`,
        fechaIso: `${inv.fecha}T12:00:00.000Z`,
        fechaDisplay: formatShortDateEs(`${inv.fecha}T12:00:00`),
        tipo: 'inversion',
        codigo: INV_CAT_LABELS[inv.categoria] || inv.categoria,
        titulo: inv.concepto,
        contraparte: inv.proveedor || 'Taller Mueblería Modes',
        ingresoBs: 0,
        inversionBs: monto,
        netoBs: -monto,
        badgeText: 'Inversión taller',
      });
    });

    const q = historySearch.trim().toLowerCase();
    return rows
      .filter((r) => {
        if (historyFilter !== 'todos' && r.tipo !== historyFilter) return false;
        if (
          q &&
          !r.titulo.toLowerCase().includes(q) &&
          !r.contraparte.toLowerCase().includes(q) &&
          !r.codigo.toLowerCase().includes(q)
        ) {
          return false;
        }
        return true;
      })
      .sort((a, b) =>
        historySortAsc
          ? a.fechaIso.localeCompare(b.fechaIso)
          : b.fechaIso.localeCompare(a.fechaIso)
      );
  }, [
    filteredPedidos,
    filteredCotizaciones,
    filteredInversiones,
    historyFilter,
    historySearch,
    historySortAsc,
  ]);

  const handleSaveInvestment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingInv(true);
    setInvError(null);
    try {
      await appService.registrarInversion({
        concepto: invConcepto,
        categoria: invCategoria,
        monto_bs: Number(invMonto),
        proveedor: invProveedor || undefined,
        fecha: invFecha,
        notas: invNotas || undefined,
      });
      setInvConcepto('');
      setInvMonto('');
      setInvProveedor('');
      setInvNotas('');
      setInvModalOpen(false);
      onRefresh();
    } catch (err) {
      setInvError(err instanceof Error ? err.message : 'Error registrando inversión.');
    } finally {
      setSavingInv(false);
    }
  };

  const handleDeleteInvestment = async (rawId: string) => {
    const cleanId = rawId.replace(/^inv-/, '');
    try {
      await appService.eliminarInversion(cleanId);
      onRefresh();
    } catch {
      // ignore transient error
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#fbf8f3] p-6 lg:p-8 pb-24">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header + Period Controls */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-stone-200 pb-5">
          <div>
            <div className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Finanzas &amp; Rentabilidad · Mueblería Modes Oruro</span>
            </div>
            <h1 className="font-serif-brand font-bold text-2xl sm:text-3xl text-slate-900 mt-1">
              Control Económico General
            </h1>
            <p className="text-xs sm:text-sm text-stone-600 mt-1">
              Monitorea ganancias por producto, ventas inmediatas, pedidos a medida e inversiones diarias, semanales y mensuales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center bg-white border border-stone-200 rounded-xl p-1 shadow-xs">
              {(
                [
                  { id: 'diario', label: 'Diario (7d)' },
                  { id: 'semanal', label: 'Semanal' },
                  { id: 'mensual', label: 'Mensual' },
                  { id: 'todo', label: 'Todo' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPeriod(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    period === tab.id
                      ? 'bg-slate-900 text-amber-300'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setInvModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Registrar Inversión</span>
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Ventas Inmediatas</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <strong className="font-mono-data text-2xl font-bold text-slate-900">
                Bs. {summary.ventasTotalBs.toLocaleString('es-BO')}
              </strong>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900">
                {summary.ventasCount} ventas
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Compras directas registradas en showroom y envíos Oruro.
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Pedidos a Medida</span>
              <div className="w-8 h-8 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center">
                <ClipboardList className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <strong className="font-mono-data text-2xl font-bold text-slate-900">
                Bs. {summary.pedidosContratadoBs.toLocaleString('es-BO')}
              </strong>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-sky-100 text-sky-900">
                {summary.pedidosCount} pedidos
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Cobrado en caja/anticipos:{' '}
              <strong className="font-mono-data text-slate-800">
                Bs. {summary.pedidosCobradoBs.toLocaleString('es-BO')}
              </strong>
            </p>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-500">Inversión &amp; Costos</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center">
                <Wallet className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <strong className="font-mono-data text-2xl font-bold text-amber-900">
                Bs. {summary.costoTotalGeneralBs.toLocaleString('es-BO')}
              </strong>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-950">
                {filteredInversiones.length} gastos
              </span>
            </div>
            <p className="text-[11px] text-stone-500">
              Insumos: Bs. {summary.inversionTallerBs.toLocaleString('es-BO')} · Taller: Bs.{' '}
              {summary.manoObraTallerBs.toLocaleString('es-BO')}
            </p>
          </div>

          <div className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-5 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-amber-300">Ganancia Neta General</span>
              <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="flex items-baseline justify-between gap-2">
              <strong
                className={`font-mono-data text-2xl font-bold ${
                  summary.gananciaNetaBs >= 0 ? 'text-emerald-300' : 'text-rose-300'
                }`}
              >
                Bs. {summary.gananciaNetaBs.toLocaleString('es-BO')}
              </strong>
              <span className="text-xs font-mono-data font-semibold px-2 py-0.5 rounded-md bg-white/10 text-amber-200 flex items-center gap-0.5">
                {summary.gananciaNetaBs >= 0 ? (
                  <ArrowUpRight className="w-3 h-3 text-emerald-300" />
                ) : (
                  <ArrowDownRight className="w-3 h-3 text-rose-300" />
                )}
                {summary.margenGeneralPct}% margen
              </span>
            </div>
            <p className="text-[11px] text-slate-300">
              Ingresos totales: Bs. {summary.ingresosBrutosBs.toLocaleString('es-BO')} ({summary.ventasCount + summary.pedidosCount} operaciones)
            </p>
          </div>
        </div>

        {/* Dynamic Charts Row */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Chart 1: Evolution (Ingresos, Inversión, Ganancia) */}
          <div className="xl:col-span-7 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-serif-brand font-semibold text-lg text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-amber-800" />
                  <span>
                    Evolución Económica ({period === 'diario' ? 'Diaria' : period === 'semanal' ? 'Semanal' : 'Mensual'})
                  </span>
                </h2>
                <p className="text-[11px] text-stone-500">
                  Pasa el cursor sobre cada período para inspeccionar ventas, pedidos, inversión y ganancia.
                </p>
              </div>
              <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 self-start">
                <button
                  type="button"
                  onClick={() => setChartVisual('barras')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                    chartVisual === 'barras'
                      ? 'bg-slate-900 text-amber-300'
                      : 'text-stone-600'
                  }`}
                >
                  Barras
                </button>
                <button
                  type="button"
                  onClick={() => setChartVisual('tendencia')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer ${
                    chartVisual === 'tendencia'
                      ? 'bg-slate-900 text-amber-300'
                      : 'text-stone-600'
                  }`}
                >
                  Tendencia
                </button>
              </div>
            </div>

            {/* Interactive SVG Chart */}
            <div className="bg-[#fbf8f3] border border-stone-200 rounded-xl p-4">
              {(() => {
                const svgW = 640;
                const svgH = 240;
                const padL = 48;
                const padR = 16;
                const padT = 18;
                const padB = 42;
                const plotW = svgW - padL - padR;
                const plotH = svgH - padT - padB;
                const count = Math.max(1, timeBuckets.length);
                const stepW = plotW / count;

                const yFor = (val: number) =>
                  padT + plotH - (Math.max(0, val) / maxChartVal) * plotH;

                const gridLevels = [0, 0.25, 0.5, 0.75, 1];

                return (
                  <svg
                    viewBox={`0 0 ${svgW} ${svgH}`}
                    className="w-full h-56 overflow-visible select-none"
                    role="img"
                    aria-label="Gráfico dinámico de ingresos, inversión y ganancia"
                  >
                    {/* Horizontal Gridlines */}
                    {gridLevels.map((frac) => {
                      const val = Math.round(maxChartVal * frac);
                      const y = padT + plotH * (1 - frac);
                      return (
                        <g key={frac}>
                          <line
                            x1={padL}
                            y1={y}
                            x2={svgW - padR}
                            y2={y}
                            stroke="#e7e0d5"
                            strokeDasharray={frac === 0 ? undefined : '4 4'}
                          />
                          <text
                            x={padL - 8}
                            y={y + 3}
                            textAnchor="end"
                            className="fill-stone-400 text-[9px] font-mono-data"
                          >
                            {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val}
                          </text>
                        </g>
                      );
                    })}

                    {chartVisual === 'barras' ? (
                      timeBuckets.map((b, idx) => {
                        const cx = padL + idx * stepW + stepW / 2;
                        const barW = Math.min(18, stepW * 0.22);
                        const hIng = (b.ingresosBs / maxChartVal) * plotH;
                        const hInv = (b.inversionBs / maxChartVal) * plotH;
                        const hGan = (Math.max(0, b.gananciaBs) / maxChartVal) * plotH;
                        const isHover = activeBucket?.key === b.key;

                        return (
                          <g
                            key={b.key}
                            onMouseEnter={() => setHoveredBucketKey(b.key)}
                            className="cursor-pointer"
                          >
                            {isHover && (
                              <rect
                                x={padL + idx * stepW + 4}
                                y={padT}
                                width={stepW - 8}
                                height={plotH}
                                rx={8}
                                fill="#f59e0b"
                                opacity={0.08}
                              />
                            )}
                            {/* Ingresos */}
                            <rect
                              x={cx - barW * 1.6}
                              y={padT + plotH - hIng}
                              width={barW}
                              height={Math.max(2, hIng)}
                              rx={4}
                              fill="#1e4d3b"
                            />
                            {/* Inversión */}
                            <rect
                              x={cx - barW * 0.5}
                              y={padT + plotH - hInv}
                              width={barW}
                              height={Math.max(2, hInv)}
                              rx={4}
                              fill="#b45309"
                            />
                            {/* Ganancia */}
                            <rect
                              x={cx + barW * 0.6}
                              y={padT + plotH - hGan}
                              width={barW}
                              height={Math.max(2, hGan)}
                              rx={4}
                              fill="#10b981"
                            />
                            <text
                              x={cx}
                              y={padT + plotH + 16}
                              textAnchor="middle"
                              className="fill-slate-800 text-[10px] font-semibold"
                            >
                              {b.label}
                            </text>
                            <text
                              x={cx}
                              y={padT + plotH + 29}
                              textAnchor="middle"
                              className="fill-stone-400 text-[9px] font-mono-data"
                            >
                              {b.subLabel}
                            </text>
                          </g>
                        );
                      })
                    ) : (
                      <>
                        {/* Trendlines for Ingresos & Ganancia */}
                        {(['ingresosBs', 'inversionBs', 'gananciaBs'] as const).map((field) => {
                          const stroke =
                            field === 'ingresosBs'
                              ? '#1e4d3b'
                              : field === 'inversionBs'
                              ? '#b45309'
                              : '#10b981';
                          const pts = timeBuckets
                            .map((b, idx) => {
                              const cx = padL + idx * stepW + stepW / 2;
                              return `${cx},${yFor(Math.max(0, b[field]))}`;
                            })
                            .join(' ');
                          return (
                            <polyline
                              key={field}
                              fill="none"
                              stroke={stroke}
                              strokeWidth={2.75}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              points={pts}
                            />
                          );
                        })}

                        {timeBuckets.map((b, idx) => {
                          const cx = padL + idx * stepW + stepW / 2;
                          const isHover = activeBucket?.key === b.key;
                          return (
                            <g
                              key={b.key}
                              onMouseEnter={() => setHoveredBucketKey(b.key)}
                              className="cursor-pointer"
                            >
                              <circle
                                cx={cx}
                                cy={yFor(b.ingresosBs)}
                                r={isHover ? 5.5 : 4}
                                fill="#1e4d3b"
                                stroke="#fff"
                                strokeWidth={1.5}
                              />
                              <circle
                                cx={cx}
                                cy={yFor(b.inversionBs)}
                                r={isHover ? 5.5 : 4}
                                fill="#b45309"
                                stroke="#fff"
                                strokeWidth={1.5}
                              />
                              <circle
                                cx={cx}
                                cy={yFor(Math.max(0, b.gananciaBs))}
                                r={isHover ? 6 : 4.5}
                                fill="#10b981"
                                stroke="#fff"
                                strokeWidth={1.5}
                              />
                              <text
                                x={cx}
                                y={padT + plotH + 16}
                                textAnchor="middle"
                                className="fill-slate-800 text-[10px] font-semibold"
                              >
                                {b.label}
                              </text>
                              <text
                                x={cx}
                                y={padT + plotH + 29}
                                textAnchor="middle"
                                className="fill-stone-400 text-[9px] font-mono-data"
                              >
                                {b.subLabel}
                              </text>
                            </g>
                          );
                        })}
                      </>
                    )}
                  </svg>
                );
              })()}

              {/* Legend & Active Bucket Readout */}
              <div className="mt-3 pt-3 border-t border-stone-200 flex flex-wrap items-center justify-between gap-3 text-[11px]">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#1e4d3b] inline-block" />
                    Ingresos
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#b45309] inline-block" />
                    Inversión / Costo
                  </span>
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <span className="w-2.5 h-2.5 rounded-xs bg-[#10b981] inline-block" />
                    Ganancia Neta
                  </span>
                </div>

                {activeBucket && (
                  <div className="font-mono-data bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-[11px] text-slate-800">
                    <strong>{activeBucket.label}</strong> ({activeBucket.ventasCount} vta /{' '}
                    {activeBucket.pedidosCount} ped) · Ing:{' '}
                    <span className="text-emerald-800 font-semibold">
                      Bs. {activeBucket.ingresosBs.toLocaleString('es-BO')}
                    </span>{' '}
                    · Gan:{' '}
                    <span
                      className={`font-bold ${
                        activeBucket.gananciaBs >= 0 ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      Bs. {activeBucket.gananciaBs.toLocaleString('es-BO')}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Chart 2: Ganancias por Producto */}
          <div className="xl:col-span-5 bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div>
              <h2 className="font-serif-brand font-semibold text-lg text-slate-900 flex items-center gap-2">
                <Package className="w-4 h-4 text-amber-800" />
                <span>Ganancias por Producto</span>
              </h2>
              <p className="text-[11px] text-stone-500">
                Ranking dinámico combinando compras inmediatas y pedidos a medida.
              </p>
            </div>

            <div className="space-y-3">
              {productStats.slice(0, 6).map((prod, idx) => {
                const pct = Math.max(8, Math.round((prod.gananciaEstBs / maxProductProfit) * 100));
                return (
                  <div key={prod.nombre} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-slate-800 truncate">
                        {idx + 1}. {prod.nombre}
                      </span>
                      <span className="font-mono-data font-bold text-emerald-800 whitespace-nowrap">
                        +Bs. {prod.gananciaEstBs.toLocaleString('es-BO')}
                      </span>
                    </div>
                    <div className="w-full h-2.5 bg-stone-100 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#1e4d3b] to-emerald-500 transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-stone-500 font-mono-data">
                      <span>
                        {prod.ventasCount} venta(s) · {prod.pedidosCount} pedido(s)
                      </span>
                      <span>
                        Ingreso Bs. {prod.ingresosBs.toLocaleString('es-BO')} ({prod.margenPct}% margen)
                      </span>
                    </div>
                  </div>
                );
              })}
              {productStats.length === 0 && (
                <div className="py-10 text-center text-xs text-stone-500">
                  No hay movimientos de productos en el período seleccionado.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Rentabilidad Detallada por Producto */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
            <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
              Desglose Económico por Producto
            </h2>
            <span className="text-[11px] text-stone-500">
              Costo artesanal estimado ~58% · Margen bruto ~42%
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                  <th className="py-3 px-4 font-semibold">Mueble / Producto</th>
                  <th className="py-3 px-4 font-semibold text-center">Ventas</th>
                  <th className="py-3 px-4 font-semibold text-center">Pedidos</th>
                  <th className="py-3 px-4 font-semibold text-right">Ingresos</th>
                  <th className="py-3 px-4 font-semibold text-right">Costo / Inv. Est.</th>
                  <th className="py-3 px-4 font-semibold text-right">Ganancia Producto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {productStats.map((prod) => (
                  <tr key={prod.nombre} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 font-semibold text-slate-900">{prod.nombre}</td>
                    <td className="py-3 px-4 text-center font-mono-data">{prod.ventasCount}</td>
                    <td className="py-3 px-4 text-center font-mono-data">{prod.pedidosCount}</td>
                    <td className="py-3 px-4 text-right font-mono-data text-slate-800">
                      Bs. {prod.ingresosBs.toLocaleString('es-BO')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-data text-amber-800">
                      Bs. {prod.costoEstBs.toLocaleString('es-BO')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-data font-bold text-emerald-800">
                      +Bs. {prod.gananciaEstBs.toLocaleString('es-BO')} ({prod.margenPct}%)
                    </td>
                  </tr>
                ))}
                {productStats.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-stone-500">
                      Sin datos de productos en este rango.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Historial Financiero Bien Ordenado */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div>
              <h2 className="font-serif-brand font-semibold text-lg text-slate-900">
                Historial Ordenado de Ventas, Pedidos e Inversiones ({unifiedHistory.length})
              </h2>
              <p className="text-[11px] text-stone-500">
                Registro cronológico unificado de ingresos por muebles e inversiones en insumos de taller.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-stone-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Buscar producto, cliente..."
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-xl border border-stone-300 bg-stone-50 text-xs w-48"
                />
              </div>

              {(
                [
                  { id: 'todos', label: 'Todos' },
                  { id: 'venta', label: 'Ventas' },
                  { id: 'pedido', label: 'Pedidos' },
                  { id: 'inversion', label: 'Inversiones' },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setHistoryFilter(f.id)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border cursor-pointer ${
                    historyFilter === f.id
                      ? 'bg-slate-900 text-amber-300 border-slate-900'
                      : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                  }`}
                >
                  {f.label}
                </button>
              ))}

              <button
                type="button"
                onClick={() => setHistorySortAsc((v) => !v)}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-stone-200 bg-stone-50 hover:bg-stone-100 text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <Calendar className="w-3 h-3" />
                <span>{historySortAsc ? 'Más antiguos' : 'Más recientes'}</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                  <th className="py-3 px-4 font-semibold">Fecha</th>
                  <th className="py-3 px-4 font-semibold">Tipo &amp; Código</th>
                  <th className="py-3 px-4 font-semibold">Detalle / Concepto</th>
                  <th className="py-3 px-4 font-semibold">Cliente / Proveedor</th>
                  <th className="py-3 px-4 font-semibold text-right">Ingreso</th>
                  <th className="py-3 px-4 font-semibold text-right">Inversión / Costo</th>
                  <th className="py-3 px-4 font-semibold text-right">Balance Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {unifiedHistory.map((row) => (
                  <tr key={row.id} className="hover:bg-stone-50/70">
                    <td className="py-3 px-4 font-mono-data text-[11px] text-stone-600 whitespace-nowrap">
                      {row.fechaDisplay}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-semibold ${
                          row.tipo === 'venta'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : row.tipo === 'pedido'
                            ? 'bg-sky-50 text-sky-900 border-sky-200'
                            : 'bg-amber-50 text-amber-950 border-amber-300'
                        }`}
                      >
                        {row.badgeText}
                      </span>
                      <div className="font-mono-data text-[11px] font-semibold text-slate-800 mt-0.5">
                        {row.codigo}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-900">{row.titulo}</td>
                    <td className="py-3 px-4 text-stone-600">{row.contraparte}</td>
                    <td className="py-3 px-4 text-right font-mono-data text-emerald-800 font-semibold whitespace-nowrap">
                      {row.ingresoBs > 0 ? `Bs. ${row.ingresoBs.toLocaleString('es-BO')}` : '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-data text-amber-800 whitespace-nowrap">
                      Bs. {row.inversionBs.toLocaleString('es-BO')}
                    </td>
                    <td className="py-3 px-4 text-right font-mono-data font-bold whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <span className={row.netoBs >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                          {row.netoBs >= 0 ? '+' : ''}Bs. {row.netoBs.toLocaleString('es-BO')}
                        </span>
                        {row.tipo === 'inversion' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteInvestment(row.id)}
                            title="Eliminar inversión"
                            className="p-1 rounded text-stone-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {unifiedHistory.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-stone-500">
                      No hay registros financieros con ese filtro.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal: Registrar Nueva Inversión de Taller */}
      {invModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="new-inv-title"
          className="fixed inset-0 z-[65] bg-slate-950/75 flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSaveInvestment}
            className="bg-[#fbf8f3] border border-stone-300 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl text-slate-900 space-y-3.5"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5 text-amber-800" />
                <h3 id="new-inv-title" className="font-serif-brand font-bold text-base">
                  Registrar Inversión de Taller
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInvModalOpen(false)}
                aria-label="Cerrar"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <input
              type="text"
              required
              placeholder="Concepto (ej. Tablones de Mara 200 pt) *"
              value={invConcepto}
              onChange={(e) => setInvConcepto(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
            />

            <div className="grid grid-cols-2 gap-2">
              <select
                value={invCategoria}
                onChange={(e) => setInvCategoria(e.target.value as InversionDTO['categoria'])}
                className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
              >
                <option value="madera">Madera Noble</option>
                <option value="herrajes">Herrajes</option>
                <option value="acabados">Lacas / Acabados</option>
                <option value="mano_obra">Mano de Obra</option>
                <option value="operativo">Operativo / Envío</option>
              </select>
              <input
                type="number"
                required
                min={1}
                placeholder="Monto (Bs.) *"
                value={invMonto}
                onChange={(e) => setInvMonto(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-mono-data"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Proveedor (opcional)"
                value={invProveedor}
                onChange={(e) => setInvProveedor(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
              />
              <input
                type="date"
                value={invFecha}
                onChange={(e) => setInvFecha(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-xs font-mono-data"
              />
            </div>

            <input
              type="text"
              placeholder="Notas adicionales (opcional)"
              value={invNotas}
              onChange={(e) => setInvNotas(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-300 bg-white text-xs"
            />

            {invError && (
              <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                {invError}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvModalOpen(false)}
                className="py-2.5 px-4 rounded-xl bg-stone-200 hover:bg-stone-300 text-stone-800 text-xs font-semibold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingInv}
                className="flex-1 py-2.5 px-4 rounded-xl bg-amber-800 hover:bg-amber-700 text-white text-xs font-semibold cursor-pointer flex items-center justify-center gap-2"
              >
                {savingInv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>Guardar Inversión</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
