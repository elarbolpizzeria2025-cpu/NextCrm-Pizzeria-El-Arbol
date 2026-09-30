import React, { useState, useEffect, useMemo, useRef } from 'react';
import { MenuItem, CartItem, ClientData, OrderData } from '../types';
import { Icon } from './Icon';
import { GoogleDeliveryMap } from './GoogleDeliveryMap';
import { WhatsAppOrderParserModal } from './WhatsAppOrderParserModal';
import { CustomerObjectionsModal } from './CustomerObjectionsModal';
import { printOrderTicket } from '../utils/printTicket';
import { ClientContactLookup } from './ClientContactLookup';
import { extractBarrioAndAddress, POPULAR_BARRIOS } from '../utils/addressBarrio';

interface PosWizardProps {
  posStep: 1 | 2 | 3;
  setPosStep: (step: 1 | 2 | 3) => void;
  menu: Record<string, MenuItem[]>;
  allMenuItems: MenuItem[];
  activeCategory: string;
  setActiveCategory: (cat: string) => void;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  addToCart: (item: MenuItem, selectedToppings: any[], initialQty?: number) => void;
  updateQuantity: (cartId: string, delta: number) => void;
  cartTotal: number;
  orderType: string;
  setOrderType: (type: string) => void;
  paymentMethod: string;
  setPaymentMethod: (pm: string) => void;
  cashProvided: string;
  setCashProvided: (cash: string) => void;
  orderTip: string;
  setOrderTip: (tip: string) => void;
  orderNotes: string;
  setOrderNotes: React.Dispatch<React.SetStateAction<string>>;
  clientInfo: { phone: string; name: string; address: string; zone: string; tableNumber?: number | string; assignedWaiter?: string; assignedDriver?: string; assignedDriverId?: string };
  setClientInfo: React.Dispatch<React.SetStateAction<any>>;
  allClients: ClientData[];
  matchingClients: ClientData[];
  showClientDropdown: boolean;
  setShowClientDropdown: (show: boolean) => void;
  isScheduled: boolean;
  setIsScheduled: (scheduled: boolean) => void;
  scheduledTime: string;
  setScheduledTime: (time: string) => void;
  editingOrder: OrderData | null;
  clearForm: () => void;
  handleCheckout: (returnToKitchen?: boolean) => void;
  isSubmitting: boolean;
  setToppingModal: (modal: { isOpen: boolean; item: any; selectedToppings: any[]; quantity: number; editingCartId?: string }) => void;
  setVoiceOrderModalOpen: (open: boolean) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
  orders?: OrderData[];
  currentUser?: { username: string; role: string; displayName: string; };
  th?: any;
  db?: any;
  appId?: string;
}

const COMMON_NOTE_CHIPS = [
  'Bien tostada',
  'Masa fina',
  'Sin orégano',
  'Sin cebolla',
  'Poco queso',
  'Cortar en 8',
  'Tocar timbre'
];

const CATEGORY_META: Record<string, { icon: string; label?: string }> = {
  todos: { icon: 'grid_view', label: 'Todo' },
  pizzas: { icon: 'local_pizza', label: 'Pizzas' },
  pizzetas: { icon: 'local_pizza', label: 'Pizzetas' },
  figazas: { icon: 'breakfast_dining', label: 'Figazzas' },
  fainas: { icon: 'bakery_dining', label: 'Fainás' },
  sandwiches: { icon: 'lunch_dining', label: 'Sándwiches' },
  bebidas: { icon: 'local_bar', label: 'Bebidas' },
  postres: { icon: 'icecream', label: 'Postres' },
  gustos: { icon: 'tune', label: 'Gustos' },
  extras: { icon: 'add_circle', label: 'Extras' },
};

const ORDER_TYPES = [
  { id: 'Local', label: 'Mostrador', icon: 'storefront', color: 'from-purple-600 to-indigo-600' },
  { id: 'Mesa', label: 'Mesa / Salón', icon: 'table_restaurant', color: 'from-blue-600 to-cyan-600' },
  { id: 'Envío', label: 'Delivery / Envío', icon: 'two_wheeler', color: 'from-amber-600 to-orange-600' },
];

const PAYMENT_METHODS = [
  { id: 'Efectivo', label: 'Efectivo', icon: 'payments', badge: '💵' },
  { id: 'Débito', label: 'Débito', icon: 'credit_card', badge: '💳' },
  { id: 'Crédito', label: 'Crédito', icon: 'credit_card', badge: '💳' },
  { id: 'Transferencia', label: 'Transf.', icon: 'account_balance', badge: '📱' },
  { id: 'A confirmar', label: 'A Confirmar', icon: 'help_outline', badge: '⚡' },
];

export const PosWizard: React.FC<PosWizardProps> = ({
  menu,
  allMenuItems,
  activeCategory,
  setActiveCategory,
  cart,
  addToCart,
  updateQuantity,
  cartTotal,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  cashProvided,
  setCashProvided,
  orderTip,
  setOrderTip,
  orderNotes,
  setOrderNotes,
  clientInfo,
  setClientInfo,
  allClients,
  matchingClients,
  showClientDropdown,
  setShowClientDropdown,
  isScheduled,
  setIsScheduled,
  scheduledTime,
  setScheduledTime,
  editingOrder,
  clearForm,
  handleCheckout,
  isSubmitting,
  setToppingModal,
  setVoiceOrderModalOpen,
  showMessage,
  orders = [],
  currentUser,
  th,
  db,
  appId,
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [isWhatsAppParserOpen, setIsWhatsAppParserOpen] = useState(false);
  const [isObjectionsOpen, setIsObjectionsOpen] = useState(false);
  const [showMobileComanda, setShowMobileComanda] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<string | null>(null);
  
  // Mandatory print flag: obligar a imprimir antes de pasar a KDS
  const [ticketPrinted, setTicketPrinted] = useState(false);

  // Split ratio for POS screen: percentage width of the left panel (catalog)
  // Default is 65% for catalog and 35% for comanda / mostrador
  const [leftPanelWidthPercent, setLeftPanelWidthPercent] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('nextcrm_pos_split_percent');
      if (saved) {
        const val = parseFloat(saved);
        if (!isNaN(val) && val >= 35 && val <= 78) return val;
      }
    } catch (e) {}
    return 65; // Default 65% catalog, 35% comanda
  });
  const [isDraggingSplitter, setIsDraggingSplitter] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const categoriesRef = useRef<HTMLDivElement>(null);

  // Menu density mode: 'compact' (fits 3x more items on screen) vs 'detailed'
  const [menuDensity, setMenuDensity] = useState<'compact' | 'detailed'>(() => {
    try {
      const saved = localStorage.getItem('nextcrm_menu_density');
      if (saved === 'detailed') return 'detailed';
    } catch (e) {}
    return 'compact'; // Default compact so operator sees the whole menu at once
  });

  const toggleMenuDensity = () => {
    const next = menuDensity === 'compact' ? 'detailed' : 'compact';
    setMenuDensity(next);
    try {
      localStorage.setItem('nextcrm_menu_density', next);
    } catch (e) {}
  };

  const [isDesktop, setIsDesktop] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : true
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Drag handler for the resizable splitter
  useEffect(() => {
    if (!isDraggingSplitter) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - rect.left;
      const percent = (newWidth / rect.width) * 100;
      // Allow dragging between 35% and 78% of the screen
      const clamped = Math.min(78, Math.max(35, percent));
      setLeftPanelWidthPercent(clamped);
    };

    const handleMouseUp = () => {
      setIsDraggingSplitter(false);
      try {
        localStorage.setItem('nextcrm_pos_split_percent', String(leftPanelWidthPercent));
      } catch (e) {}
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!containerRef.current || !e.touches[0]) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newWidth = e.touches[0].clientX - rect.left;
      const percent = (newWidth / rect.width) * 100;
      const clamped = Math.min(78, Math.max(35, percent));
      setLeftPanelWidthPercent(clamped);
    };

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleMouseUp);

    return () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDraggingSplitter, leftPanelWidthPercent]);

  // Persist split percentage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem('nextcrm_pos_split_percent', String(leftPanelWidthPercent));
    } catch (e) {}
  }, [leftPanelWidthPercent]);

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      categoriesRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // Delivery Drivers & Sequential Round-Robin Logic (1 Fefo, 2 Caetano, 3 Samuel)
  const DRIVERS = [
    { number: 1, name: 'Fefo', id: 'delivery1', label: '1. Fefo' },
    { number: 2, name: 'Caetano', id: 'delivery2', label: '2. Caetano' },
    { number: 3, name: 'Samuel', id: 'delivery3', label: '3. Samuel' },
  ];

  const suggestedDriver = useMemo(() => {
    if (!orders || orders.length === 0) return DRIVERS[0];
    const assignedDeliveryOrders = orders
      .filter(o => o.assignedDriver && ['envío', 'delivery'].includes(String(o.type || '').toLowerCase()))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    if (assignedDeliveryOrders.length === 0) return DRIVERS[0];

    const last = (assignedDeliveryOrders[0].assignedDriver || '').trim().toLowerCase();
    if (last.includes('fefo')) return DRIVERS[1]; // 2 Caetano
    if (last.includes('caetano')) return DRIVERS[2]; // 3 Samuel
    if (last.includes('samuel')) return DRIVERS[0]; // 1 Fefo

    return DRIVERS[0];
  }, [orders]);

  // When switching to Delivery, auto-assign suggested driver if not set
  useEffect(() => {
    if (['envío', 'delivery'].includes(orderType.toLowerCase()) && !clientInfo.assignedDriver) {
      setClientInfo((prev: any) => ({
        ...prev,
        assignedDriver: suggestedDriver.name,
        assignedDriverId: suggestedDriver.id
      }));
    }
  }, [orderType, suggestedDriver]);

  // Reset print status when cart or order core details change
  useEffect(() => {
    setTicketPrinted(false);
  }, [cart, orderType, clientInfo.tableNumber, clientInfo.name, clientInfo.address, paymentMethod]);

  // Calculate live change for cash
  const cashNum = parseFloat(cashProvided) || 0;
  const tipNum = Math.max(0, parseFloat(orderTip) || 0);
  const totalWithTip = cartTotal + tipNum;
  const changeDue = cashNum > 0 ? Math.max(0, cashNum - totalWithTip) : 0;
  const missingCash = cashNum > 0 && cashNum < totalWithTip ? totalWithTip - cashNum : 0;
  const totalItemCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  // Cart item count map for highlighting products already added
  const cartItemQuantities = useMemo(() => {
    const map: Record<string, number> = {};
    cart.forEach(item => {
      if (item.id) {
        map[item.id] = (map[item.id] || 0) + (item.quantity || 1);
      }
    });
    return map;
  }, [cart]);

  // Filter products by search or category
  const filteredProducts = useMemo(() => {
    const list = activeCategory === 'TODOS' ? allMenuItems : (menu[activeCategory] || []);
    if (!productSearch.trim()) return list;
    const q = productSearch.toLowerCase();
    return list.filter(item => item.name.toLowerCase().includes(q) || (item.desc && item.desc.toLowerCase().includes(q)));
  }, [activeCategory, allMenuItems, menu, productSearch]);

  const handleAddNoteChip = (chip: string) => {
    setOrderNotes(prev => {
      const current = prev.trim();
      if (!current) return chip;
      if (current.toLowerCase().includes(chip.toLowerCase())) return current;
      return `${current}, ${chip}`;
    });
  };

  const handleSelectClient = (c: ClientData) => {
    setClientInfo({
      ...clientInfo,
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      zone: c.zone || ''
    });
    if (c.address) setOrderType('Envío');
    setShowClientDropdown(false);
    showMessage(`Cliente ${c.name} cargado`);
  };

  // Build current order object for printing
  const buildCurrentOrderForPrint = (): OrderData => {
    const isMesa = orderType === 'Mesa';
    const tableNum = isMesa ? (clientInfo.tableNumber || 1) : null;
    const waiterName = isMesa ? (clientInfo.assignedWaiter || 'Moza 1') : null;
    const finalDriver = clientInfo.assignedDriver || null;
    const finalDriverId = clientInfo.assignedDriverId || null;
    const resolvedAddressInfo = !isMesa ? extractBarrioAndAddress(clientInfo.address, clientInfo.zone) : null;
    const resolvedZone = isMesa
      ? 'N/A'
      : (clientInfo.zone && clientInfo.zone !== 'N/A' ? clientInfo.zone : (resolvedAddressInfo?.barrio || 'N/A'));

    return {
      firestoreId: editingOrder?.firestoreId || 'temp',
      id: String(editingOrder ? editingOrder.id : (orders && orders.length > 0 ? Math.max(...orders.map(o => Number(o.id) || 0)) + 1 : 1)),
      type: orderType || 'Local',
      reference: orderType === 'Envío' ? 'ENVÍO' : (orderType === 'Mesa' ? `MESA #${tableNum}` : 'LOCAL'),
      client: {
        name: isMesa 
          ? (clientInfo.name ? `${clientInfo.name} (Mesa #${tableNum})` : `Mesa #${tableNum}`) 
          : (clientInfo.name || 'CONSUMIDOR FINAL'),
        phone: isMesa ? 'N/A' : (clientInfo.phone || 'N/A'),
        address: isMesa ? 'N/A' : (clientInfo.address || 'N/A'),
        zone: resolvedZone,
        tableNumber: tableNum,
        assignedWaiter: waiterName
      },
      tableNumber: tableNum,
      assignedWaiter: waiterName,
      items: cart.map(it => ({
        id: it.id || 'N/A',
        name: it.name || 'Item',
        price: it.price || 0,
        finalPrice: it.finalPrice || it.price || 0,
        quantity: it.quantity || 1,
        selectedToppings: it.selectedToppings || [],
        isPortion: it.isPortion || false
      })),
      total: cartTotal,
      tip: tipNum,
      paymentMethod: paymentMethod || 'Efectivo',
      cashProvided: paymentMethod === 'Efectivo' ? (parseFloat(cashProvided) || 0) : 0,
      status: 'Preparando',
      createdAt: editingOrder ? editingOrder.createdAt : Date.now(),
      time: editingOrder ? editingOrder.time : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      isScheduled: isScheduled,
      scheduledTime: isScheduled && scheduledTime ? Date.now() : null,
      notes: orderNotes,
      assignedDriver: finalDriver,
      assignedDriverId: finalDriverId,
      orderTaker: editingOrder?.orderTaker || (isMesa ? waiterName : null) || currentUser?.displayName || currentUser?.username || 'Caja',
    };
  };

  // Trigger ticket printing
  const handlePrintTicket = (): boolean => {
    if (cart.length === 0) {
      showMessage("Cargue al menos un producto a la comanda antes de imprimir", "error");
      return false;
    }
    const orderData = buildCurrentOrderForPrint();
    printOrderTicket(orderData);
    setTicketPrinted(true);
    showMessage("Imprimiendo comanda térmica...");
    return true;
  };

  // Submit to KDS with strict enforcement of printing
  const handleDispatchToKds = (autoPrint = false) => {
    if (cart.length === 0) {
      showMessage("El carrito está vacío. Agregue productos antes de enviar a cocina.", "error");
      return;
    }

    if (orderType === 'Mesa' && !clientInfo.tableNumber) {
      showMessage("Debe seleccionar el número de mesa", "error");
      return;
    }

    // Si autoPrint o no ha impreso el ticket, se ejecuta la impresión obligatoria
    if (!ticketPrinted || autoPrint) {
      const printed = handlePrintTicket();
      if (!printed) return;
    }

    // Enviar a KDS
    handleCheckout(false);
    setTicketPrinted(false);
    setShowMobileComanda(false);
  };

  // WhatsApp Order Parser Handler
  const handleApplyWhatsAppOrder = (data: {
    items: { item: MenuItem; quantity: number; selectedToppings: any[] }[];
    clientInfo: { name: string; phone: string; address: string; zone: string };
    orderType: string;
    paymentMethod: string;
    cashProvided: string;
    notes: string;
  }) => {
    if (data.items.length > 0) {
      data.items.forEach(it => {
        addToCart(it.item, it.selectedToppings, it.quantity);
      });
    }
    if (data.clientInfo.name || data.clientInfo.phone || data.clientInfo.address) {
      setClientInfo((prev: any) => ({ ...prev, ...data.clientInfo }));
    }
    if (data.orderType) setOrderType(data.orderType);
    if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
    if (data.cashProvided) setCashProvided(data.cashProvided);
    if (data.notes) {
      handleAddNoteChip(data.notes);
    }
    showMessage("Pedido de WhatsApp aplicado exitosamente");
  };

  // Categories list
  const categoryKeys = useMemo(() => {
    const keys = Object.keys(menu);
    return ['TODOS', ...keys];
  }, [menu]);

  // Render individual product card (supports compact POS density or detailed cards)
  const renderProductCard = (item: MenuItem) => {
    const qtyInCart = cartItemQuantities[item.id] || 0;
    const requiresToppings = item.hasToppings || item.isMeter;
    const isCompact = menuDensity === 'compact';

    const handleItemClick = () => {
      if (requiresToppings) {
        setToppingModal({ isOpen: true, item, selectedToppings: [], quantity: 1 });
      } else {
        addToCart(item, []);
      }
    };

    if (isCompact) {
      return (
        <button
          key={item.id}
          type="button"
          onClick={handleItemClick}
          className={`group relative aspect-square min-h-[132px] rounded-[22px] border p-2.5 transition-all cursor-pointer flex flex-col justify-between text-left overflow-hidden shadow-md ${
            qtyInCart > 0
              ? 'border-purple-300 bg-gradient-to-br from-[#1a0b36] via-[#130726] to-[#0b0517] shadow-purple-950/40 ring-2 ring-purple-400/40'
              : 'border-purple-500/20 bg-gradient-to-br from-[#120722] via-[#0d061a] to-[#090313] hover:border-purple-400/60 hover:shadow-purple-950/30'
          }`}
        >
          <div className={`absolute inset-x-0 top-0 h-1 ${qtyInCart > 0 ? 'bg-gradient-to-r from-purple-300 via-fuchsia-400 to-purple-500' : 'bg-gradient-to-r from-purple-700/70 via-indigo-600/70 to-purple-700/70'}`}></div>

          {qtyInCart > 0 && (
            <span className="absolute top-2 right-2 min-w-[28px] h-7 px-1.5 rounded-xl bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white text-[11px] font-black flex items-center justify-center shadow-lg">
              x{qtyInCart}
            </span>
          )}

          <div className="flex items-start justify-between gap-2 pr-8">
            <div className="flex flex-wrap gap-1">
              {item.isMeter && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-indigo-950 text-indigo-200 border border-indigo-400/30">
                  Metro
                </span>
              )}
              {item.isPortion && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-blue-950 text-blue-200 border border-blue-400/30">
                  Porción
                </span>
              )}
              {requiresToppings && (
                <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded-lg bg-amber-950 text-amber-200 border border-amber-400/30">
                  Gustos
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
            <h4 className="font-black text-[13px] sm:text-sm text-white uppercase tracking-tight leading-tight line-clamp-3">
              {item.name}
            </h4>
            {item.desc && (
              <p className="text-[9px] text-slate-400 font-semibold leading-tight line-clamp-2 mt-1 uppercase">
                {item.desc}
              </p>
            )}
          </div>

          <div className="pt-2 mt-2 border-t border-purple-500/15 flex items-end justify-between gap-2">
            <div>
              <div className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Precio</div>
              <div className="text-xl font-black text-emerald-300 font-mono leading-none">${item.price}</div>
            </div>
            <div className={`min-w-[70px] h-10 rounded-2xl px-2 flex items-center justify-center gap-1.5 text-[10px] font-black uppercase border transition-all ${
              requiresToppings
                ? 'bg-amber-950/80 text-amber-200 border-amber-500/30'
                : 'bg-purple-600 text-white border-purple-300 group-hover:bg-purple-500'
            }`}>
              <Icon name={requiresToppings ? 'tune' : 'add'} size={14} />
              <span>{requiresToppings ? 'Elegir' : 'Agregar'}</span>
            </div>
          </div>
        </button>
      );
    }

    return (
      <button
        key={item.id}
        type="button"
        onClick={handleItemClick}
        className={`group relative aspect-square min-h-[170px] rounded-[26px] border p-3.5 transition-all cursor-pointer flex flex-col justify-between text-left overflow-hidden shadow-md ${
          qtyInCart > 0
            ? 'border-purple-300 bg-gradient-to-br from-[#1a0b36] via-[#130726] to-[#0b0517] shadow-purple-950/40 ring-2 ring-purple-400/40'
            : 'border-purple-500/20 bg-gradient-to-br from-[#120722] via-[#0d061a] to-[#090313] hover:border-purple-400/60 hover:shadow-purple-950/30'
        }`}
      >
        <div className={`absolute inset-x-0 top-0 h-1.5 ${qtyInCart > 0 ? 'bg-gradient-to-r from-purple-300 via-fuchsia-400 to-purple-500' : 'bg-gradient-to-r from-purple-700/70 via-indigo-600/70 to-purple-700/70'}`}></div>

        {qtyInCart > 0 && (
          <span className="absolute top-3 right-3 min-w-[32px] h-8 px-2 rounded-2xl bg-gradient-to-r from-purple-500 to-fuchsia-600 text-white text-xs font-black flex items-center justify-center shadow-lg">
            x{qtyInCart}
          </span>
        )}

        <div className="pr-10 space-y-2">
          <div className="flex flex-wrap gap-1">
            {item.isMeter && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-indigo-950 text-indigo-200 border border-indigo-400/30">
                Metro
              </span>
            )}
            {item.isPortion && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-blue-950 text-blue-200 border border-blue-400/30">
                Porción
              </span>
            )}
            {requiresToppings && (
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-amber-950 text-amber-200 border border-amber-400/30">
                Personalizable
              </span>
            )}
          </div>

          <div>
            <h4 className="font-black text-base text-white uppercase tracking-tight leading-tight line-clamp-3">
              {item.name}
            </h4>
            {item.desc && (
              <p className="text-[11px] text-slate-400 font-medium leading-snug line-clamp-3 mt-1 uppercase">
                {item.desc}
              </p>
            )}
          </div>
        </div>

        <div className="pt-3 mt-3 border-t border-purple-500/15 flex items-end justify-between gap-2">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Precio</div>
            <div className="text-2xl font-black text-emerald-300 font-mono leading-none">${item.price}</div>
          </div>

          <div className={`h-11 px-3 rounded-2xl flex items-center justify-center gap-1.5 text-[11px] font-black uppercase border transition-all ${
            requiresToppings
              ? 'bg-amber-950/80 text-amber-200 border-amber-500/30'
              : 'bg-purple-600 text-white border-purple-300 group-hover:bg-purple-500'
          }`}>
            <Icon name={requiresToppings ? 'tune' : 'add'} size={15} />
            <span>{requiresToppings ? 'Configurar' : 'Agregar'}</span>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="h-full w-full bg-[#040108] text-slate-100 select-none overflow-hidden relative min-h-0">
      {/* ================================================================ */}
      {/* PEDIDOS: PANTALLA PRINCIPAL DE MENÚ                              */}
      {/* La navegación superior general vive en App.tsx y no se modifica. */}
      {/* ================================================================ */}
      <div className="h-full w-full flex flex-col bg-[#05020c] overflow-hidden">
        {/* Barra propia de Pedidos: búsqueda, herramientas y acceso a Cobrar */}
        <div className="px-3 sm:px-4 py-2.5 bg-[#080314] border-b border-purple-500/20 flex items-center gap-2 shrink-0 shadow-lg">
          <div className="relative flex-1 max-w-xl min-w-0">
            <Icon name="search" size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
            <input
              type="text"
              placeholder="Buscar producto..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
              className="w-full h-11 pl-10 pr-9 bg-[#040108] border border-purple-500/30 rounded-2xl text-sm font-black text-white placeholder:text-slate-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20 transition-all"
            />
            {productSearch && (
              <button
                type="button"
                onClick={() => setProductSearch('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center cursor-pointer"
              >
                <Icon name="close" size={15} />
              </button>
            )}
          </div>

          <div className="hidden md:flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsWhatsAppParserOpen(true)}
              className="h-10 px-3 bg-[#120824] hover:bg-[#1f0d3d] border border-purple-500/30 text-purple-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
              title="Pegar pedido de WhatsApp"
            >
              <Icon name="content_paste" size={14} /> WhatsApp
            </button>
            <button
              type="button"
              onClick={() => setVoiceOrderModalOpen(true)}
              className="h-10 px-3 bg-[#20081e] hover:bg-[#330d30] border border-pink-500/30 text-pink-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
              title="Tomar pedido por voz"
            >
              <Icon name="mic" size={14} /> Voz
            </button>
            <button
              type="button"
              onClick={() => setIsObjectionsOpen(true)}
              className="h-10 px-3 bg-[#0e112b] hover:bg-[#161c47] border border-blue-500/30 text-blue-200 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 cursor-pointer"
              title="Asistente de objeciones"
            >
              <Icon name="tips_and_updates" size={14} /> Ayuda
            </button>
          </div>

          {cart.length > 0 && (
            <button
              type="button"
              onClick={clearForm}
              className="hidden sm:flex h-10 px-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-200 rounded-xl text-[10px] font-black uppercase items-center gap-1.5 cursor-pointer"
              title="Vaciar pedido actual"
            >
              <Icon name="delete_sweep" size={14} /> Limpiar
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMobileComanda(true)}
            disabled={cart.length === 0}
            className={`h-11 px-3 sm:px-5 rounded-2xl font-black uppercase flex items-center gap-2 shrink-0 border transition-all ${
              cart.length === 0
                ? 'bg-slate-900 text-slate-600 border-slate-800 cursor-not-allowed'
                : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white border-emerald-300 shadow-lg shadow-emerald-900/30 cursor-pointer'
            }`}
            title={cart.length === 0 ? 'Agregá productos para continuar' : 'Revisar pedido y cobrar'}
          >
            <Icon name="point_of_sale" size={18} />
            <span className="hidden sm:inline text-[11px]">Cobrar / Ver pedido</span>
            <span className="text-[11px] font-mono bg-black/20 px-2 py-1 rounded-lg">{totalItemCount} • ${cartTotal}</span>
          </button>
        </div>

        {/* Estado del pedido, siempre visible sin ocupar un panel lateral */}
        {cart.length > 0 && (
          <div className="px-3 sm:px-4 py-2 bg-[#0a0415] border-b border-purple-500/15 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
                <Icon name="shopping_cart" size={16} />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-black uppercase text-purple-300">Pedido en curso</div>
                <div className="text-[11px] font-bold text-slate-300 truncate">
                  {cart.slice(0, 4).map(i => `${i.quantity || 1}× ${i.name}`).join(' • ')}{cart.length > 4 ? ` • +${cart.length - 4}` : ''}
                </div>
              </div>
            </div>
            <div className="font-mono font-black text-emerald-300 text-lg shrink-0">${cartTotal}</div>
          </div>
        )}

        {/* Contenido principal del menú */}
        <div className="flex-1 min-h-0 overflow-y-auto custom-dark-scrollbar p-3 sm:p-4 lg:p-5">
          {activeCategory === 'TODOS' && !productSearch.trim() ? (
            <div className="max-w-[1500px] mx-auto">
              <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white">Elegí una categoría</h2>
                  <p className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 mt-1">Primero el grupo, después el producto. Pensado para tomar pedidos rápido.</p>
                </div>
                <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950/70 border border-purple-500/30 px-3 py-1.5 rounded-xl shrink-0">
                  {allMenuItems.length} productos
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 sm:gap-4">
                {categoryKeys.filter(cat => cat !== 'TODOS').map(cat => {
                  const count = (menu[cat] || []).length;
                  if (count === 0) return null;
                  const meta = CATEGORY_META[cat.toLowerCase()] || { icon: 'restaurant_menu', label: cat };
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className="group aspect-square min-h-[150px] rounded-[28px] border border-purple-500/25 bg-gradient-to-br from-[#16092b] via-[#0e061b] to-[#080311] hover:border-purple-300/70 hover:from-[#231044] hover:to-[#0d051b] transition-all shadow-lg hover:shadow-purple-950/50 cursor-pointer p-4 flex flex-col items-center justify-center text-center relative overflow-hidden"
                    >
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-purple-600 via-fuchsia-500 to-indigo-600 opacity-80" />
                      <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-[22px] bg-purple-600/20 border border-purple-400/30 text-purple-200 flex items-center justify-center mb-3 group-hover:scale-105 group-hover:bg-purple-600/30 transition-all">
                        <Icon name={meta.icon} size={30} />
                      </div>
                      <div className="text-sm sm:text-base font-black uppercase text-white leading-tight">{meta.label || cat}</div>
                      <div className="mt-2 text-[10px] font-black uppercase text-purple-300 bg-purple-950/70 border border-purple-500/20 px-2.5 py-1 rounded-full">{count} opciones</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="max-w-[1600px] mx-auto space-y-4">
              <div className="sticky top-0 z-10 -mx-1 px-1 py-1 bg-[#040108]/95 backdrop-blur flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => { setProductSearch(''); setActiveCategory('TODOS'); }}
                  className="h-11 px-4 rounded-2xl bg-[#15082c] hover:bg-[#211043] border border-purple-500/30 text-purple-200 font-black uppercase text-[11px] flex items-center gap-2 cursor-pointer"
                >
                  <Icon name="arrow_back" size={16} /> Menús
                </button>
                <div className="text-right min-w-0">
                  <div className="text-[10px] font-black uppercase text-slate-500">Seleccionando</div>
                  <div className="text-sm sm:text-base font-black uppercase text-white truncate">{productSearch.trim() ? `Resultados: “${productSearch}”` : activeCategory}</div>
                </div>
              </div>

              {filteredProducts.length === 0 ? (
                <div className="h-56 flex flex-col items-center justify-center text-center rounded-[28px] border border-dashed border-purple-500/25 bg-[#0a0415]">
                  <Icon name="search_off" size={40} className="text-purple-400/50" />
                  <p className="text-sm font-black text-slate-300 mt-3">No encontramos productos</p>
                  <button type="button" onClick={() => { setProductSearch(''); setActiveCategory('TODOS'); }} className="mt-3 text-xs font-black uppercase text-purple-300 hover:text-white cursor-pointer">Volver a categorías</button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
                  {filteredProducts.map(renderProductCard)}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ================================================================ */}
      {/* COBRO / REVISIÓN DEL PEDIDO                                      */}
      {/* Se abre solo al tocar el botón superior derecho.                  */}
      {/* ================================================================ */}
      <div
        className={`absolute inset-0 z-50 bg-[#040108] flex flex-col transition-transform duration-300 ${
          showMobileComanda ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        <div className="px-3 sm:px-5 py-3 bg-[#090317] border-b border-purple-500/25 flex items-center justify-between gap-3 shrink-0 shadow-lg">
          <button
            type="button"
            onClick={() => setShowMobileComanda(false)}
            className="h-11 px-4 rounded-2xl bg-[#16082d] hover:bg-[#241046] border border-purple-500/30 text-purple-200 font-black uppercase text-[11px] flex items-center gap-2 cursor-pointer"
          >
            <Icon name="arrow_back" size={16} /> Volver al menú
          </button>
          <div className="text-center min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Caja / Cobro</div>
            <div className="text-sm sm:text-lg font-black uppercase text-white truncate">{editingOrder ? `Editar pedido #${editingOrder.id}` : 'Revisar y cobrar pedido'}</div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[9px] font-black uppercase text-slate-500">Subtotal</div>
            <div className="font-mono font-black text-xl text-emerald-300">${cartTotal}</div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-dark-scrollbar p-3 sm:p-5">
          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[1.25fr_0.75fr] gap-4 sm:gap-5">
            {/* Columna izquierda: destino, cliente, productos y notas */}
            <div className="space-y-4">
              <section className="bg-[#0c0519] border border-purple-500/25 rounded-[28px] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">1. Destino</div>
                    <h3 className="text-base font-black uppercase text-white">¿Dónde va el pedido?</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-purple-950 text-purple-200 border border-purple-500/30">{orderType}</span>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {ORDER_TYPES.map(t => {
                    const selected = orderType.toLowerCase() === t.id.toLowerCase();
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => {
                          setOrderType(t.id);
                          if (t.id === 'Mesa' && !clientInfo.tableNumber) setClientInfo((prev: any) => ({ ...prev, tableNumber: 1 }));
                        }}
                        className={`aspect-[1.35/1] rounded-[22px] border font-black uppercase text-[10px] sm:text-xs flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${selected ? `bg-gradient-to-br ${t.color} text-white border-white/30 shadow-lg ring-2 ring-purple-400/40` : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-purple-400/50 hover:text-white'}`}
                      >
                        <Icon name={t.icon} size={22} />
                        <span className="text-center leading-tight">{t.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-400">Nombre del cliente / referencia</label>
                  <input
                    type="text"
                    placeholder={orderType === 'Mesa' ? 'Ej: Familia Pérez' : 'Nombre del cliente'}
                    value={clientInfo.name}
                    onChange={e => setClientInfo((prev: any) => ({ ...prev, name: e.target.value.toUpperCase() }))}
                    className="w-full h-12 px-4 bg-[#06020e] border border-purple-500/30 text-white rounded-2xl text-sm font-black uppercase outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-500/20"
                  />
                </div>

                {orderType === 'Mesa' && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-blue-300">Número de mesa</label>
                      <span className="text-xs font-black font-mono bg-blue-600 px-2.5 py-1 rounded-lg text-white">MESA #{clientInfo.tableNumber || 1}</span>
                    </div>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2">
                      {Array.from({ length: 20 }, (_, i) => i + 1).map(num => {
                        const selected = String(clientInfo.tableNumber || 1) === String(num);
                        return (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setClientInfo((prev: any) => ({ ...prev, tableNumber: num }))}
                            className={`aspect-square rounded-xl font-black font-mono text-xs border cursor-pointer transition-all ${selected ? 'bg-blue-600 text-white border-blue-300 ring-2 ring-blue-400/40' : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-blue-400/50'}`}
                          >
                            {num}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

              </section>

              <section className="bg-[#0c0519] border border-purple-500/25 rounded-[28px] p-4 sm:p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">2. Control</div>
                    <h3 className="text-base font-black uppercase text-white">Productos cargados</h3>
                  </div>
                  <span className="text-[10px] font-black uppercase bg-purple-950 text-purple-200 border border-purple-500/30 px-2.5 py-1 rounded-xl">{totalItemCount} ítems</span>
                </div>

                {cart.length === 0 ? (
                  <div className="py-10 text-center border border-dashed border-purple-500/25 rounded-2xl text-slate-500 font-bold text-sm">No hay productos cargados.</div>
                ) : (
                  <div className="space-y-2">
                    {cart.map((item, idx) => {
                      const linePrice = Math.round((item.finalPrice || item.price) * (item.quantity || 1));
                      return (
                        <div key={item.cartId || idx} className="bg-[#06020e] border border-purple-500/20 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="font-black text-sm uppercase text-white">{item.name}</div>
                            {item.selectedToppings && item.selectedToppings.length > 0 && (
                              <div className="text-[10px] font-bold text-amber-300 mt-0.5">{item.selectedToppings.map((t: any) => t.name).join(' • ')}</div>
                            )}
                            <div className="text-[10px] font-mono text-slate-400 mt-1">${item.finalPrice || item.price} c/u</div>
                          </div>

                          <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                            <div className="flex items-center bg-[#0c0519] border border-purple-500/30 rounded-xl overflow-hidden">
                              <button type="button" onClick={() => updateQuantity(item.cartId, -1)} className="w-9 h-9 text-slate-300 hover:bg-purple-900/40 font-black cursor-pointer">−</button>
                              <span className="w-9 text-center font-mono font-black text-white">{item.quantity || 1}</span>
                              <button type="button" onClick={() => updateQuantity(item.cartId, 1)} className="w-9 h-9 text-purple-200 hover:bg-purple-600/60 font-black cursor-pointer">+</button>
                            </div>
                            <div className="w-20 text-right font-mono font-black text-emerald-300">${linePrice}</div>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.hasToppings || item.isMeter || (item.selectedToppings && item.selectedToppings.length > 0)) {
                                  setToppingModal({ isOpen: true, item, selectedToppings: item.selectedToppings || [], quantity: item.quantity || 1, editingCartId: item.cartId });
                                } else {
                                  setEditingCartItemId(item.cartId);
                                }
                              }}
                              className="h-9 px-3 rounded-xl bg-blue-950/70 hover:bg-blue-900 text-blue-200 border border-blue-500/30 font-black uppercase text-[9px] flex items-center gap-1 cursor-pointer"
                            >
                              <Icon name="edit" size={13} /> Editar
                            </button>
                            <button type="button" onClick={() => updateQuantity(item.cartId, -(item.quantity || 1))} className="w-9 h-9 rounded-xl bg-red-950/50 hover:bg-red-900 text-red-300 border border-red-500/25 flex items-center justify-center cursor-pointer" title="Eliminar">
                              <Icon name="delete" size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="bg-[#0c0519] border border-purple-500/25 rounded-[28px] p-4 sm:p-5 space-y-2">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">3. Notas</div>
                <textarea
                  rows={3}
                  placeholder="Observaciones del pedido: bien tostada, sin orégano, tocar timbre..."
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                  className="w-full p-3 bg-[#06020e] border border-purple-500/30 text-white rounded-2xl text-sm font-medium outline-none focus:border-purple-400 resize-none"
                />
              </section>
            </div>

            {/* Columna derecha: pago, monto entregado, propina y total */}
            <div className="space-y-4 lg:sticky lg:top-0 lg:self-start">
              <section className="bg-[#0c0519] border border-purple-500/25 rounded-[28px] p-4 sm:p-5 space-y-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">4. Cobro</div>
                  <h3 className="text-base font-black uppercase text-white">Forma de pago</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(pm => {
                    const selected = paymentMethod.toLowerCase() === pm.id.toLowerCase();
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`min-h-[82px] rounded-2xl border font-black uppercase text-[10px] flex flex-col items-center justify-center gap-1 cursor-pointer transition-all ${selected ? 'bg-purple-600 text-white border-purple-300 ring-2 ring-purple-400/40 shadow-lg' : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-purple-400/50'}`}
                      >
                        <span className="text-xl">{pm.badge}</span>
                        <span>{pm.label}</span>
                      </button>
                    );
                  })}
                </div>

                {paymentMethod === 'Efectivo' && (
                  <div className="space-y-2 p-3 bg-[#06020e] border border-purple-500/20 rounded-2xl">
                    <label className="text-[10px] font-black uppercase text-slate-400">Monto que entrega</label>
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="Ej: 2000"
                      value={cashProvided}
                      onChange={e => setCashProvided(e.target.value)}
                      className="w-full h-12 px-3 bg-[#0c0519] border border-purple-500/30 text-white rounded-xl text-lg font-black font-mono outline-none focus:border-purple-400"
                    />
                    <div className="grid grid-cols-3 gap-2">
                      <button type="button" onClick={() => setCashProvided(String(totalWithTip))} className="py-2 rounded-xl bg-purple-950/70 border border-purple-500/30 text-purple-200 font-black text-[10px] uppercase cursor-pointer">Exacto</button>
                      {[1000, 2000].map(amt => (
                        <button key={amt} type="button" onClick={() => setCashProvided(String(amt))} className="py-2 rounded-xl bg-[#120722] border border-purple-500/20 text-slate-300 font-black text-[10px] font-mono cursor-pointer">${amt}</button>
                      ))}
                    </div>
                    <div className={`rounded-xl px-3 py-2 flex items-center justify-between border ${missingCash > 0 ? 'bg-red-950/30 border-red-500/30' : 'bg-emerald-950/30 border-emerald-500/30'}`}>
                      <span className="text-[10px] font-black uppercase text-slate-300">{missingCash > 0 ? 'Falta' : 'Vuelto'}</span>
                      <span className={`font-mono font-black text-lg ${missingCash > 0 ? 'text-red-300' : 'text-emerald-300'}`}>${missingCash > 0 ? missingCash : changeDue}</span>
                    </div>
                  </div>
                )}

                <div className="space-y-2 p-3 bg-[#06020e] border border-purple-500/20 rounded-2xl">
                  <label className="text-[10px] font-black uppercase text-slate-400">¿Deja propina?</label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min="0"
                        value={orderTip}
                        onChange={e => setOrderTip(e.target.value)}
                        className="w-full h-12 pl-7 pr-3 bg-[#0c0519] border border-purple-500/30 text-white rounded-xl text-lg font-black font-mono outline-none focus:border-purple-400"
                      />
                    </div>
                    {[0, 50, 100].map(amt => (
                      <button key={amt} type="button" onClick={() => setOrderTip(String(amt))} className={`w-14 rounded-xl border font-black text-[10px] cursor-pointer ${tipNum === amt ? 'bg-purple-600 border-purple-300 text-white' : 'bg-[#120722] border-purple-500/20 text-slate-300'}`}>{amt === 0 ? 'No' : `$${amt}`}</button>
                    ))}
                  </div>
                </div>
              </section>

              <section className="bg-gradient-to-br from-[#16082d] to-[#090313] border border-purple-400/30 rounded-[28px] p-4 sm:p-5 space-y-3 shadow-xl shadow-purple-950/40">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-black uppercase text-slate-400">Pedido</span>
                  <span className="font-mono font-black text-white">${cartTotal}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-black uppercase text-slate-400">Propina</span>
                  <span className="font-mono font-black text-purple-200">${tipNum}</span>
                </div>
                <div className="border-t border-purple-500/25 pt-3 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-purple-300">Total a cobrar</div>
                    <div className="text-[10px] font-bold text-slate-500 uppercase">{orderType} • {paymentMethod}</div>
                  </div>
                  <div className="font-mono font-black text-3xl text-emerald-300">${totalWithTip}</div>
                </div>
              </section>
            </div>
          </div>
        </div>

        <div className="px-3 sm:px-5 py-3 bg-[#080214] border-t border-purple-500/30 shrink-0 shadow-2xl">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
            <div className="text-[10px] font-bold text-slate-500 uppercase hidden sm:block">Revisá destino, productos y cobro antes de confirmar.</div>
            <div className="flex gap-2 sm:ml-auto">
              <button
                type="button"
                onClick={() => setShowMobileComanda(false)}
                className="h-12 px-4 rounded-2xl bg-[#14082b] hover:bg-[#211042] border border-purple-500/30 text-purple-200 font-black uppercase text-[10px] cursor-pointer"
              >
                Seguir agregando
              </button>
              <button
                type="button"
                onClick={() => handlePrintTicket()}
                disabled={cart.length === 0}
                className="h-12 px-4 rounded-2xl bg-[#16112b] hover:bg-[#211942] border border-indigo-500/30 text-indigo-200 font-black uppercase text-[10px] flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
              >
                <Icon name="print" size={15} /> Imprimir
              </button>
              <button
                type="button"
                onClick={() => handleDispatchToKds(true)}
                disabled={cart.length === 0 || isSubmitting}
                className="h-12 flex-1 sm:flex-none px-5 sm:px-7 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 border border-emerald-300 text-white font-black uppercase text-[11px] flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/40 disabled:opacity-40"
              >
                {isSubmitting ? <Icon name="sync" size={16} className="animate-spin" /> : <Icon name="point_of_sale" size={16} />}
                <span>{isSubmitting ? 'Procesando...' : `Cobrar • $${totalWithTip}`}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Editor rápido para productos simples del pedido */}
      {editingCartItemId && (() => {
        const item = cart.find(it => it.cartId === editingCartItemId);
        if (!item) return null;
        const lineTotal = Math.round((item.finalPrice || item.price || 0) * (item.quantity || 1));
        return (
          <div className="absolute inset-0 z-[70] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md bg-[#0c0519] border border-purple-500/35 rounded-[30px] p-5 shadow-2xl space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-400">Editar producto</div>
                  <h3 className="text-lg font-black uppercase text-white mt-1">{item.name}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingCartItemId(null)}
                  className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 flex items-center justify-center cursor-pointer"
                >
                  <Icon name="close" size={18} />
                </button>
              </div>

              <div className="bg-[#06020e] border border-purple-500/20 rounded-2xl p-4">
                <div className="text-[10px] font-black uppercase text-slate-400 mb-2">Cantidad</div>
                <div className="flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartId, -1)}
                    className="w-14 h-14 rounded-2xl bg-[#16082d] hover:bg-[#241046] border border-purple-500/30 text-white text-2xl font-black cursor-pointer"
                  >−</button>
                  <div className="text-center">
                    <div className="text-3xl font-black font-mono text-white">{item.quantity || 1}</div>
                    <div className="text-[10px] font-bold uppercase text-slate-500">unidades</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateQuantity(item.cartId, 1)}
                    className="w-14 h-14 rounded-2xl bg-purple-600 hover:bg-purple-500 border border-purple-300 text-white text-2xl font-black cursor-pointer"
                  >+</button>
                </div>
              </div>

              <div className="flex items-center justify-between bg-[#06020e] border border-purple-500/20 rounded-2xl p-4">
                <span className="text-[10px] font-black uppercase text-slate-400">Total del producto</span>
                <span className="text-2xl font-black font-mono text-emerald-300">${lineTotal}</span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    updateQuantity(item.cartId, -(item.quantity || 1));
                    setEditingCartItemId(null);
                  }}
                  className="h-12 rounded-2xl bg-red-950/50 hover:bg-red-900 border border-red-500/30 text-red-200 font-black uppercase text-[10px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icon name="delete" size={15} /> Eliminar
                </button>
                <button
                  type="button"
                  onClick={() => setEditingCartItemId(null)}
                  className="h-12 rounded-2xl bg-purple-600 hover:bg-purple-500 border border-purple-300 text-white font-black uppercase text-[10px] cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ========================================================================= */}
      {/* MODALS: WHATSAPP PARSER & OBJECTIONS                                      */}
      {/* ========================================================================= */}
      {isWhatsAppParserOpen && (
        <WhatsAppOrderParserModal
          isOpen={isWhatsAppParserOpen}
          onClose={() => setIsWhatsAppParserOpen(false)}
          menu={menu}
          allMenuItems={allMenuItems}
          onApplyParsedOrder={handleApplyWhatsAppOrder}
          showMessage={showMessage}
        />
      )}

      {isObjectionsOpen && (
        <CustomerObjectionsModal
          isOpen={isObjectionsOpen}
          onClose={() => setIsObjectionsOpen(false)}
          allMenuItems={allMenuItems}
          onAddQuickItem={(item, toppings, qty) => addToCart(item, toppings, qty || 1)}
          onAddNote={handleAddNoteChip}
          showMessage={showMessage}
        />
      )}
    </div>
  );
};
