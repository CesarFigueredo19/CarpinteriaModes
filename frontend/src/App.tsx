import { useCallback, useEffect, useState } from 'react';
import {
  Armchair,
  Package,
  ClipboardList,
  Users,
  ShoppingBag,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
  Check,
  Phone,
  Sun,
  Moon,
  TrendingUp,
  AlertTriangle,
} from 'lucide-react';
import Tienda3D, { PieceDimensionsCm } from './components/Tienda3D';
import { BrandLogo } from './components/BrandLogo';
import { CartLine } from './components/ShowroomDrawers';
import {
  CatalogView,
  ClientesView,
  CotizacionesView,
  PedidosView,
} from './components/ManagementViews';
import { ControlEconomicoView } from './components/ControlEconomicoView';
import {
  CheckoutItemInput,
  ClientCheckoutModal,
} from './components/ClientCheckoutModal';
import { AiAssistantWidget } from './components/AiAssistantWidget';
import { MuebleItem, MUEBLES_CATALOGO, WOOD_FINISHES, WoodFinishId } from './data/catalog';
import { soundEngine } from './utils/soundEffects';
import {
  fetchClientes,
  fetchPedidos,
  fetchProducts,
} from './services/apiService.js';
import {
  ClienteDTO,
  CotizacionDTO,
  InversionDTO,
  PedidoDTO,
  appService,
} from './services/appService';

type ActiveSection =
  | 'showroom'
  | 'catalogo'
  | 'cotizaciones'
  | 'clientes'
  | 'pedidos'
  | 'economia';

const CART_SESSION_KEY = 'muebleria_modes_cart_v1';
const MENU_MODE_STORAGE_KEY = 'muebleria_modes_menu_mode_v2';

function loadSessionCart(): CartLine[] {
  try {
    const raw = sessionStorage.getItem(CART_SESSION_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

type MenuMode = 'claro' | 'oscuro';

const SIDEBAR_MODES: Record<
  MenuMode,
  {
    isDark: boolean;
    accentTone: 'salvia' | 'grafito';
    container: string;
    divider: string;
    collapseBtn: string;
    activeItem: string;
    activeIcon: string;
    inactiveItem: string;
    inactiveIcon: string;
    badgeActive: string;
    badgeInactive: string;
    cardBox: string;
    cardLabel: string;
    cardPrice: string;
    ctaBtn: string;
    waBtn: string;
    mobileBadge: string;
  }
> = {
  claro: {
    isDark: false,
    accentTone: 'salvia',
    container: 'bg-[#F8F5EF] text-[#1E2421] border-r border-[#E2DAD0]',
    divider: 'border-[#E2DAD0]',
    collapseBtn: 'text-stone-600 hover:text-slate-900 hover:bg-[#EAE4DA]',
    activeItem: 'bg-[#1E4D3B] text-white shadow-sm',
    activeIcon: 'text-amber-200',
    inactiveItem: 'text-stone-700 hover:bg-[#ECE6DC] hover:text-slate-950',
    inactiveIcon: 'text-[#854D1E]',
    badgeActive: 'bg-[#133327] text-emerald-100',
    badgeInactive: 'bg-[#E6DFD4] text-stone-800',
    cardBox: 'bg-white border border-[#E2DAD0] shadow-xs',
    cardLabel: 'text-stone-600',
    cardPrice: 'text-[#1E4D3B]',
    ctaBtn: 'bg-[#1E4D3B] hover:bg-[#163B2D] text-white',
    waBtn: 'bg-white hover:bg-[#EFEAE1] border border-[#D8CFC2] text-[#1E4D3B]',
    mobileBadge: 'bg-[#1E4D3B] text-white',
  },
  oscuro: {
    isDark: true,
    accentTone: 'grafito',
    container: 'bg-[#151A22] text-slate-100 border-r border-[#27303E]',
    divider: 'border-[#27303E]',
    collapseBtn: 'text-slate-400 hover:text-amber-300 hover:bg-[#1F2733]',
    activeItem: 'bg-gradient-to-r from-[#B45309] to-[#9A4212] text-white shadow-sm',
    activeIcon: 'text-amber-100',
    inactiveItem: 'text-slate-300 hover:bg-[#1F2632] hover:text-amber-200',
    inactiveIcon: 'text-amber-400',
    badgeActive: 'bg-[#6F2D0A] text-amber-100',
    badgeInactive: 'bg-[#232B38] text-amber-300',
    cardBox: 'bg-[#1D2430] border border-[#2D3748]',
    cardLabel: 'text-slate-300',
    cardPrice: 'text-amber-300',
    ctaBtn: 'bg-[#B45309] hover:bg-[#9A4212] text-white',
    waBtn: 'bg-[#1D2430] hover:bg-[#252E3D] border border-[#323D4E] text-emerald-300',
    mobileBadge: 'bg-[#B45309] text-white',
  },
};

export default function App() {
  const [activeSection, setActiveSection] = useState<ActiveSection>('showroom');
  const [pedidosTab, setPedidosTab] = useState<'compras' | 'cotizaciones'>('compras');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [menuMode, setMenuMode] = useState<MenuMode>(() => {
    try {
      const saved = localStorage.getItem(MENU_MODE_STORAGE_KEY);
      return saved === 'oscuro' ? 'oscuro' : 'claro';
    } catch {
      return 'claro';
    }
  });

  const [focusRequest, setFocusRequest] = useState<{
    key: MuebleItem['key'];
    seq: number;
    finishId?: WoodFinishId;
    dims?: PieceDimensionsCm;
  } | null>(null);

  const [cartItems, setCartItems] = useState<CartLine[]>(loadSessionCart);
  const [cartToast, setCartToast] = useState<string | null>(null);

  // Backend / Supabase synchronized datasets
  const [stockByKey, setStockByKey] = useState<
    Partial<Record<MuebleItem['key'], number>>
  >({});
  const [products, setProducts] = useState<MuebleItem[]>(MUEBLES_CATALOGO);
  const [clientes, setClientes] = useState<ClienteDTO[]>([]);
  const [pedidos, setPedidos] = useState<PedidoDTO[]>([]);
  const [cotizaciones, setCotizaciones] = useState<CotizacionDTO[]>([]);
  const [inversiones, setInversiones] = useState<InversionDTO[]>([]);
  const [backendWarning, setBackendWarning] = useState<string | null>(null);

  // Client registration + Checkout modal state
  const [checkoutState, setCheckoutState] = useState<{
    open: boolean;
    items: CheckoutItemInput[];
    clearCartOnSuccess: boolean;
  }>({ open: false, items: [], clearCartOnSuccess: false });

  // In-app WhatsApp alert (never navigates to external wa.me link)
  const [whatsappAlert, setWhatsappAlert] = useState<{
    title: string;
    phone: string;
    detail: string;
  } | null>(null);

  const handleShowWhatsAppAlert = useCallback((title: string, detail: string) => {
    setWhatsappAlert({
      title,
      phone: '+591 72418920',
      detail,
    });
  }, []);

  const refreshAllData = useCallback(async () => {
    try {
      const [productsRes, clientesRes, pedidosRes, cotList, invList] = await Promise.all([
        fetchProducts(),
        fetchClientes(),
        fetchPedidos(),
        appService.listarCotizaciones().catch(() => []),
        appService.listarInversiones().catch(() => []),
      ]);

      if (productsRes.products.length > 0) {
        setProducts(productsRes.products);
        const nextStock: Partial<Record<MuebleItem['key'], number>> = {};
        productsRes.products.forEach((p) => {
          const modelKey = p.key as MuebleItem['key'] | undefined;
          if (modelKey) {
            nextStock[modelKey] = p.stock;
          }
        });
        setStockByKey(nextStock);
      }

      if (productsRes.backendOffline || clientesRes.backendOffline || pedidosRes.backendOffline) {
        setBackendWarning(
          productsRes.warning ||
            clientesRes.warning ||
            pedidosRes.warning ||
            'No se pudo conectar al servidor backend. El Showroom 3D continúa funcionando en modo local.'
        );
      } else {
        setBackendWarning(null);
      }

      setClientes(clientesRes.clientes);
      setPedidos(pedidosRes.pedidos);
      setCotizaciones(cotList);
      setInversiones(invList);
    } catch {
      // Keep existing state and 3D scene intact on transient errors
    }
  }, []);

  useEffect(() => {
    refreshAllData();
  }, [refreshAllData]);

  // Persist shopping bag in sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(CART_SESSION_KEY, JSON.stringify(cartItems));
    } catch {
      // Ignore storage quota errors
    }
  }, [cartItems]);

  useEffect(() => {
    if (!cartToast) return;
    const t = window.setTimeout(() => setCartToast(null), 3200);
    return () => clearTimeout(t);
  }, [cartToast]);

  const handleAddToCart = (
    mueble: MuebleItem,
    finishId: WoodFinishId = mueble.defaultFinish,
    customDims?: string,
    overridePriceBs?: number
  ) => {
    const unitPriceBs = overridePriceBs ?? mueble.precio_bs;
    const lineId = `${mueble.slug || mueble.key}_${finishId}_${customDims || 'std'}`;

    setCartItems((prev) => {
      const existing = prev.find((l) => l.id === lineId);
      if (existing) {
        return prev.map((l) =>
          l.id === lineId ? { ...l, qty: l.qty + 1 } : l
        );
      }
      return [
        ...prev,
        {
          id: lineId,
          mueble,
          finishId,
          qty: 1,
          customDims,
          unitPriceBs,
        },
      ];
    });

    soundEngine.playChime();
    setCartToast(
      `${mueble.nombre} (${WOOD_FINISHES[finishId].shortLabel}) añadido a tu bolsa`
    );
  };

  const handleUpdateQty = (id: string, delta: number) => {
    setCartItems((prev) =>
      prev
        .map((l) => (l.id === id ? { ...l, qty: l.qty + delta } : l))
        .filter((l) => l.qty > 0)
    );
  };

  const handleRemoveCartItem = (id: string) => {
    setCartItems((prev) => prev.filter((l) => l.id !== id));
  };

  const handleOpenSingleCheckout = (item: CheckoutItemInput) => {
    setCheckoutState({
      open: true,
      items: [item],
      clearCartOnSuccess: false,
    });
  };

  const handleOpenCartCheckout = () => {
    if (cartItems.length === 0) return;
    setCheckoutState({
      open: true,
      items: cartItems.map((line) => ({
        key: line.mueble.key,
        customName: line.mueble.nombre,
        finishId: line.finishId,
        qty: line.qty,
        customDims: line.customDims,
        unitPriceBs: line.unitPriceBs,
      })),
      clearCartOnSuccess: true,
    });
  };

  const handleFocusIn3D = (
    key: MuebleItem['key'],
    finishId?: WoodFinishId,
    dims?: PieceDimensionsCm
  ) => {
    setActiveSection('showroom');
    setMobileMenuOpen(false);
    // Delay slightly so Showroom container finishes revealing before gliding camera
    window.setTimeout(() => {
      setFocusRequest({ key, finishId, dims, seq: Date.now() });
    }, 60);
  };

  const totalUnits = cartItems.reduce((acc, item) => acc + item.qty, 0);
  const subtotalBs = cartItems.reduce(
    (acc, item) => acc + item.unitPriceBs * item.qty,
    0
  );

  const handleGoToPedidosQuotes = useCallback(() => {
    setPedidosTab('cotizaciones');
    setActiveSection('pedidos');
    setMobileMenuOpen(false);
  }, []);

  const navItems: Array<{
    id: ActiveSection;
    label: string;
    icon: typeof Armchair;
    badge?: number;
  }> = [
    { id: 'showroom', label: '3D Interactivo', icon: Armchair },
    { id: 'catalogo', label: 'Catálogo de Muebles', icon: Package },
    {
      id: 'cotizaciones',
      label: 'Cotizaciones a Medida',
      icon: ClipboardList,
      badge: cotizaciones.length > 0 ? cotizaciones.length : undefined,
    },
    {
      id: 'clientes',
      label: 'Gestión de Clientes',
      icon: Users,
      badge: clientes.length > 0 ? clientes.length : undefined,
    },
    {
      id: 'pedidos',
      label: 'Bolsa y Pedidos',
      icon: ShoppingBag,
      badge: totalUnits > 0 ? totalUnits : undefined,
    },
    {
      id: 'economia',
      label: 'Control Económico',
      icon: TrendingUp,
    },
  ];

  const theme = SIDEBAR_MODES[menuMode];

  const handleToggleMenuMode = (mode: MenuMode) => {
    setMenuMode(mode);
    try {
      localStorage.setItem(MENU_MODE_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  const renderSidebarBody = (isMobile: boolean) => {
    const collapsed = !isMobile && sidebarCollapsed;
    return (
      <div
        className={`h-full flex flex-col transition-colors duration-200 font-menu-bricolage ${theme.container}`}
      >
        {/* Brand Logo Header */}
        <div className={`px-4 py-4 border-b flex items-center justify-between gap-2 ${theme.divider}`}>
          <button
            type="button"
            onClick={() => {
              setActiveSection('showroom');
              if (isMobile) setMobileMenuOpen(false);
            }}
            className="text-left cursor-pointer min-w-0"
          >
            <BrandLogo
              collapsed={collapsed}
              darkText={!theme.isDark}
              accentTone={theme.accentTone}
            />
          </button>
          {isMobile ? (
            <button
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Cerrar menú"
              className={`p-1.5 rounded-lg cursor-pointer ${theme.collapseBtn}`}
            >
              <X className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              title={collapsed ? 'Expandir menú' : 'Contraer menú'}
              aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}
              className={`p-1.5 rounded-lg cursor-pointer shrink-0 ${theme.collapseBtn}`}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-4 h-4" />
              ) : (
                <PanelLeftClose className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeSection === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveSection(item.id);
                  if (isMobile) setMobileMenuOpen(false);
                }}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center ${
                  collapsed ? 'justify-center px-2' : 'justify-between px-3.5'
                } py-2.5 rounded-xl text-[13px] font-medium transition-colors cursor-pointer ${
                  active ? theme.activeItem : theme.inactiveItem
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? theme.activeIcon : theme.inactiveIcon
                    }`}
                  />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </span>
                {!collapsed && typeof item.badge === 'number' && (
                  <span
                    className={`font-mono-data text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${
                      active ? theme.badgeActive : theme.badgeInactive
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Active Bag Summary + Claro / Oscuro Toggle + WhatsApp */}
        <div className={`p-3 border-t space-y-2.5 ${theme.divider}`}>
          {totalUnits > 0 && !collapsed && (
            <div className={`rounded-xl p-3 space-y-2 ${theme.cardBox}`}>
              <div className="flex items-center justify-between text-xs">
                <span className={theme.cardLabel}>Bolsa ({totalUnits})</span>
                <span className={`font-mono-data font-semibold ${theme.cardPrice}`}>
                  Bs. {subtotalBs.toLocaleString('es-BO')}
                </span>
              </div>
              <button
                onClick={handleOpenCartCheckout}
                className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold cursor-pointer ${theme.ctaBtn}`}
              >
                Finalizar Pedido
              </button>
            </div>
          )}

          {/* Simple Claro / Oscuro Toggle */}
          {!collapsed ? (
            <div className={`rounded-xl p-1 grid grid-cols-2 gap-1 ${theme.cardBox}`}>
              <button
                type="button"
                onClick={() => handleToggleMenuMode('claro')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  menuMode === 'claro'
                    ? 'bg-[#1E4D3B] text-white'
                    : 'text-slate-300 hover:bg-[#252E3D]'
                }`}
              >
                <Sun className="w-3.5 h-3.5" />
                <span>Claro</span>
              </button>
              <button
                type="button"
                onClick={() => handleToggleMenuMode('oscuro')}
                className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                  menuMode === 'oscuro'
                    ? 'bg-[#B45309] text-white'
                    : 'text-stone-700 hover:bg-[#ECE6DC]'
                }`}
              >
                <Moon className="w-3.5 h-3.5" />
                <span>Oscuro</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() =>
                handleToggleMenuMode(menuMode === 'claro' ? 'oscuro' : 'claro')
              }
              title={menuMode === 'claro' ? 'Cambiar a menú oscuro' : 'Cambiar a menú claro'}
              className={`w-full flex items-center justify-center py-2 rounded-xl cursor-pointer ${theme.cardBox}`}
            >
              {menuMode === 'claro' ? (
                <Moon className="w-4 h-4 text-stone-700" />
              ) : (
                <Sun className="w-4 h-4 text-amber-300" />
              )}
            </button>
          )}

          {!collapsed && (
            <button
              onClick={() =>
                handleShowWhatsAppAlert(
                  'Showroom Mueblería Modes · Oruro',
                  'Atención personalizada de Don Teófilo y María Paredes en Oruro, Bolivia. Escríbenos o llámanos al +591 72418920.'
                )
              }
              className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${theme.waBtn}`}
            >
              <Phone className="w-3.5 h-3.5" />
              <span>WhatsApp +591 72418920</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#F4F5F2]">
      {/* Desktop Retractable Left Sidebar */}
      <aside
        className={`hidden md:block shrink-0 transition-all duration-200 h-full z-30 ${
          sidebarCollapsed ? 'w-[74px]' : 'w-[268px]'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div className="w-72 h-full">{renderSidebarBody(true)}</div>
          <div
            className="flex-1 bg-slate-950/65"
            onClick={() => setMobileMenuOpen(false)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 h-full flex flex-col relative">
        {/* Compact Mobile Top Trigger */}
        <div className={`md:hidden h-14 px-4 border-b flex items-center justify-between shrink-0 font-menu-bricolage ${theme.container}`}>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú lateral"
              className={`p-2 rounded-lg cursor-pointer ${theme.collapseBtn}`}
            >
              <Menu className="w-5 h-5" />
            </button>
            <BrandLogo darkText={!theme.isDark} accentTone={theme.accentTone} />
          </div>
          <button
            onClick={() => setActiveSection('pedidos')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${theme.mobileBadge}`}
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>{totalUnits}</span>
          </button>
        </div>

        {/* Dynamic Workspace Views */}
        <main className="flex-1 min-h-0 relative">
          {/* Keep 3D WebGL scene mounted for instant view switching */}
          <div className={activeSection === 'showroom' ? 'w-full h-full' : 'hidden'}>
            <Tienda3D
              isActive={activeSection === 'showroom'}
              onGoToPanel={() => setActiveSection('catalogo')}
              onComprarMueble={(mueble, finish, customDims, overridePriceBs) =>
                handleAddToCart(mueble, finish, customDims, overridePriceBs)
              }
              onAcquireMueble={(mueble, finish, customDims, overridePriceBs) =>
                handleOpenSingleCheckout({
                  key: mueble.key,
                  customName: customDims
                    ? `${mueble.nombre} (A medida)`
                    : mueble.nombre,
                  finishId: finish || mueble.defaultFinish,
                  qty: 1,
                  customDims,
                  unitPriceBs: overridePriceBs ?? mueble.precio_bs,
                })
              }
              onWhatsAppAlert={handleShowWhatsAppAlert}
              focusRequest={focusRequest}
              stockByKey={stockByKey}
              clientes={clientes}
              onQuoteCreated={refreshAllData}
              onGoToPedidos={handleGoToPedidosQuotes}
              onOpenAiAssistant={() => setAiChatOpen(true)}
            />
          </div>

          {activeSection === 'catalogo' && (
            <CatalogView
              products={products}
              stockByKey={stockByKey}
              onViewIn3D={handleFocusIn3D}
              onAddToCart={(mueble, finish, customDims, overridePriceBs) =>
                handleAddToCart(mueble, finish, customDims, overridePriceBs)
              }
              onAcquireNow={handleOpenSingleCheckout}
            />
          )}

          {activeSection === 'cotizaciones' && (
            <CotizacionesView
              cotizaciones={cotizaciones}
              clientes={clientes}
              onRefresh={refreshAllData}
              onAddCustomToCart={(mueble, finish, dims, priceBs) =>
                handleAddToCart(mueble, finish, dims, priceBs)
              }
              onAcquireNow={handleOpenSingleCheckout}
              onViewIn3D={handleFocusIn3D}
              onWhatsAppAlert={handleShowWhatsAppAlert}
              onGoToPedidosQuotes={handleGoToPedidosQuotes}
            />
          )}

          {activeSection === 'clientes' && (
            <ClientesView
              clientes={clientes}
              pedidos={pedidos}
              onRefresh={refreshAllData}
              onWhatsAppAlert={handleShowWhatsAppAlert}
              onGoToPedidosQuotes={handleGoToPedidosQuotes}
            />
          )}

          {activeSection === 'pedidos' && (
            <PedidosView
              cartItems={cartItems}
              pedidos={pedidos}
              cotizaciones={cotizaciones}
              activeTab={pedidosTab}
              onChangeTab={setPedidosTab}
              onUpdateQty={handleUpdateQty}
              onRemoveCartItem={handleRemoveCartItem}
              onClearCart={() => setCartItems([])}
              onFinalizeCart={handleOpenCartCheckout}
              onRefresh={refreshAllData}
              onWhatsAppAlert={handleShowWhatsAppAlert}
            />
          )}

          {activeSection === 'economia' && (
            <ControlEconomicoView
              pedidos={pedidos}
              cotizaciones={cotizaciones}
              inversiones={inversiones}
              onRefresh={refreshAllData}
            />
          )}

          {/* Bag Confirmation Toast */}
          {cartToast && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 bg-slate-900 text-white border border-amber-500/40 px-4 py-2.5 rounded-xl shadow-xl flex items-center gap-3 text-xs">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{cartToast}</span>
              <button
                onClick={() => {
                  setCartToast(null);
                  setPedidosTab('compras');
                  setActiveSection('pedidos');
                }}
                className="text-amber-300 hover:text-amber-200 font-semibold underline cursor-pointer whitespace-nowrap"
              >
                Ir a bolsa
              </button>
            </div>
          )}

          {/* Friendly Non-blocking Backend Offline Alert (3D scene remains intact) */}
          {backendWarning && (
            <div
              role="status"
              className="absolute bottom-4 left-4 z-40 max-w-md bg-amber-950/95 text-amber-50 border border-amber-500/50 px-3.5 py-2.5 rounded-xl shadow-xl flex items-start gap-2.5 text-xs"
            >
              <AlertTriangle className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
              <span className="leading-snug flex-1">{backendWarning}</span>
              <button
                type="button"
                onClick={() => void refreshAllData()}
                className="text-amber-200 hover:text-white underline underline-offset-2 whitespace-nowrap cursor-pointer"
              >
                Reintentar
              </button>
              <button
                type="button"
                onClick={() => setBackendWarning(null)}
                aria-label="Cerrar aviso de conexión"
                className="text-amber-300 hover:text-white p-0.5 rounded cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Asistente IA Chat en la misma página (disponible en todas las vistas) */}
      <AiAssistantWidget open={aiChatOpen} onToggle={setAiChatOpen} />

      {/* Modal de Registro de Cliente y Compra (Adquirir / Finalizar Pedido) */}
      <ClientCheckoutModal
        open={checkoutState.open}
        items={checkoutState.items}
        existingClientes={clientes}
        onClose={() =>
          setCheckoutState({ open: false, items: [], clearCartOnSuccess: false })
        }
        onSuccess={() => {
          if (checkoutState.clearCartOnSuccess) {
            setCartItems([]);
          }
          refreshAllData();
        }}
        onWhatsAppAlert={handleShowWhatsAppAlert}
      />

      {/* Alerta Modal de Contacto WhatsApp (Sin enlace externo wa.me) */}
      {whatsappAlert && (
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="wa-alert-title"
          className="fixed inset-0 z-[60] bg-slate-950/75 flex items-center justify-center p-4"
        >
          <div className="bg-[#fbf8f3] border border-stone-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl text-slate-900">
            <div className="flex items-start justify-between gap-3 pb-3 border-b border-stone-200">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <Phone className="w-4 h-4" />
                </div>
                <div>
                  <h3
                    id="wa-alert-title"
                    className="font-serif-brand font-semibold text-base text-slate-900"
                  >
                    {whatsappAlert.title}
                  </h3>
                  <p className="font-mono-data text-xs font-semibold text-emerald-700">
                    WhatsApp Oruro: {whatsappAlert.phone}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setWhatsappAlert(null)}
                aria-label="Cerrar alerta"
                className="text-stone-400 hover:text-stone-700 p-1 rounded-lg cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-stone-700 leading-relaxed mt-3.5 bg-white border border-stone-200 rounded-xl p-3">
              {whatsappAlert.detail}
            </p>
            <button
              type="button"
              onClick={() => setWhatsappAlert(null)}
              className="mt-4 w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 font-semibold text-xs cursor-pointer"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
