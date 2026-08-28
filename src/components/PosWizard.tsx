import React, { useState } from 'react';
import { MenuItem, CartItem, ClientData, OrderData } from '../types';
import { Icon } from './Icon';
import { GoogleDeliveryMap } from './GoogleDeliveryMap';
import { WhatsAppOrderParserModal } from './WhatsAppOrderParserModal';
import { CustomerObjectionsModal } from './CustomerObjectionsModal';

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
  orderNotes: string;
  setOrderNotes: React.Dispatch<React.SetStateAction<string>>;
  clientInfo: { phone: string; name: string; address: string; zone: string };
  setClientInfo: React.Dispatch<React.SetStateAction<{ phone: string; name: string; address: string; zone: string }>>;
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
  setToppingModal: (modal: { isOpen: boolean; item: any; selectedToppings: any[]; quantity: number }) => void;
  setVoiceOrderModalOpen: (open: boolean) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
  th?: any;
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

export const PosWizard: React.FC<PosWizardProps> = ({
  posStep,
  setPosStep,
  menu,
  allMenuItems,
  activeCategory,
  setActiveCategory,
  cart,
  setCart,
  addToCart,
  updateQuantity,
  cartTotal,
  orderType,
  setOrderType,
  paymentMethod,
  setPaymentMethod,
  cashProvided,
  setCashProvided,
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
}) => {
  const [productSearch, setProductSearch] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isWhatsAppParserOpen, setIsWhatsAppParserOpen] = useState(false);
  const [isObjectionsOpen, setIsObjectionsOpen] = useState(false);

  // Calculate live change for cash
  const cashNum = parseFloat(cashProvided) || 0;
  const changeDue = cashNum > 0 ? Math.max(0, cashNum - cartTotal) : 0;
  const missingCash = cashNum > 0 && cashNum < cartTotal ? cartTotal - cashNum : 0;
  const totalItemCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

  // Step color configuration: Lila (Step 1), Azul (Step 2), Violeta Profundo (Step 3) - Cero verde y amarillo
  const stepColorTheme = {
    1: {
      name: 'Paso 1: Menú y Productos',
      accent: 'purple',
      activeTab: 'bg-purple-600 text-white shadow-purple-600/30',
      activeText: 'text-purple-400',
      activeBorder: 'border-purple-500/40',
      activeBg: 'bg-[#120824]',
      btnBg: 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/25',
      badgeBg: 'bg-purple-950 text-purple-300 border-purple-500/40',
    },
    2: {
      name: 'Paso 2: Destino y Cliente',
      accent: 'blue',
      activeTab: 'bg-blue-600 text-white shadow-blue-600/30',
      activeText: 'text-blue-400',
      activeBorder: 'border-blue-500/40',
      activeBg: 'bg-[#0a1228]',
      btnBg: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/25',
      badgeBg: 'bg-blue-950 text-blue-300 border-blue-500/40',
    },
    3: {
      name: 'Paso 3: Pago y Confirmación',
      accent: 'violet',
      activeTab: 'bg-violet-600 text-white shadow-violet-600/30',
      activeText: 'text-violet-400',
      activeBorder: 'border-violet-500/40',
      activeBg: 'bg-[#1a0828]',
      btnBg: 'bg-violet-600 hover:bg-violet-500 text-white shadow-violet-600/25',
      badgeBg: 'bg-violet-950 text-violet-300 border-violet-500/40',
    },
  }[posStep];

  // Filter products by search or category
  const filteredProducts = (activeCategory === 'TODOS' ? allMenuItems : (menu[activeCategory] || [])).filter(item => {
    if (!productSearch.trim()) return true;
    const q = productSearch.toLowerCase();
    return item.name.toLowerCase().includes(q) || (item.desc && item.desc.toLowerCase().includes(q));
  });

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
      name: c.name || '',
      phone: c.phone || '',
      address: c.address || '',
      zone: c.zone || ''
    });
    if (c.address) setOrderType('Envío');
    setShowClientDropdown(false);
    showMessage(`Cliente ${c.name} cargado`);
  };

  // WhatsApp Parser Handler
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
      setClientInfo(data.clientInfo);
    }
    if (data.orderType) setOrderType(data.orderType);
    if (data.paymentMethod) setPaymentMethod(data.paymentMethod);
    if (data.cashProvided) setCashProvided(data.cashProvided);
    if (data.notes) {
      handleAddNoteChip(data.notes);
    }
    setPosStep(2);
  };

  // Send delivery directly via WhatsApp Web
  const handleSendDeliveryWhatsApp = () => {
    const rawPhone = clientInfo.phone || '098356320';
    let targetPhone = rawPhone.replace(/[^0-9]/g, '');
    if (targetPhone.startsWith('09') && targetPhone.length === 9) {
      targetPhone = '598' + targetPhone.substring(1);
    } else if (!targetPhone || targetPhone.length < 8) {
      targetPhone = '59898356320';
    }

    const itemsText = cart.length > 0
      ? cart.map(i => `• ${i.quantity}x ${i.name}${i.selectedToppings?.length ? ` (+${i.selectedToppings.map((t: any) => t.name).join(', ')})` : ''} - $${Math.round((i.finalPrice || i.price) * (i.quantity || 1))}`).join('\n')
      : '• (Sin productos cargados)';

    const mapsLink = clientInfo.address
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(clientInfo.address + ', Montevideo, Uruguay')}`
      : '';

    const msg =
      `🛵 *NUEVO PEDIDO DELIVERY - PIZZERÍA EL ÁRBOL*\n` +
      `👤 *Cliente:* ${clientInfo.name || 'Consumidor Final'}\n` +
      `📞 *Teléfono:* ${clientInfo.phone || '098356320'}\n` +
      `📍 *Dirección:* ${clientInfo.address || 'Mostrador / A coordinar'} ${clientInfo.zone ? `(${clientInfo.zone})` : ''}\n` +
      (mapsLink ? `🗺️ *Ubicación Maps:* ${mapsLink}\n` : '') +
      `🍕 *Productos:*\n${itemsText}\n` +
      `💵 *Total:* $${cartTotal}\n` +
      `💳 *Medio de Pago:* ${paymentMethod}${cashNum > 0 ? ` (Paga con $${cashNum} - Vuelto: $${changeDue})` : ''}\n` +
      (orderNotes ? `📝 *Observaciones:* ${orderNotes}\n` : '');

    window.open(`https://wa.me/${targetPhone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="h-full flex flex-col relative bg-[#050508] text-slate-100 select-none overflow-hidden">
      {/* Wizard Step Progression Bar with Dynamic Lila/Blue/Violet Colors */}
      <div className={`px-3 sm:px-4 py-2 shrink-0 flex flex-wrap items-center justify-between gap-2 shadow-md z-30 transition-all border-b ${stepColorTheme.activeBg} ${stepColorTheme.activeBorder}`}>
        <div className="flex items-center gap-1.5 sm:gap-2.5 overflow-x-auto no-scrollbar">
          {/* Step 1: Menú */}
          <button
            type="button"
            onClick={() => setPosStep(1)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 1
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                : 'bg-[#0f091f] text-slate-300 hover:bg-[#1a1033] border border-purple-500/20'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 1 ? 'bg-white text-purple-900' : 'bg-purple-950 text-purple-300'}`}>
              1
            </span>
            <span>1. Menú</span>
            {cart.length > 0 && (
              <span className="text-[9px] px-1.5 py-0.2 rounded-full font-black bg-red-600 text-white">
                {totalItemCount}
              </span>
            )}
          </button>

          <Icon name="chevron_right" size={14} className="text-slate-600 shrink-0 hidden sm:inline" />

          {/* Step 2: Destino */}
          <button
            type="button"
            onClick={() => setPosStep(2)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 2
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-[#0f091f] text-slate-300 hover:bg-[#1a1033] border border-purple-500/20'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 2 ? 'bg-white text-blue-900' : 'bg-blue-950 text-blue-300'}`}>
              2
            </span>
            <span>2. Destino</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${posStep === 2 ? 'bg-white/20 text-white' : 'bg-blue-950 text-blue-300 border border-blue-500/30'}`}>
              {orderType}
            </span>
          </button>

          <Icon name="chevron_right" size={14} className="text-slate-600 shrink-0 hidden sm:inline" />

          {/* Step 3: Pago */}
          <button
            type="button"
            onClick={() => setPosStep(3)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 3
                ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                : 'bg-[#0f091f] text-slate-300 hover:bg-[#1a1033] border border-purple-500/20'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 3 ? 'bg-white text-violet-900' : 'bg-violet-950 text-violet-300'}`}>
              3
            </span>
            <span>3. Pago</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${posStep === 3 ? 'bg-white/20 text-white' : 'bg-violet-950 text-violet-300 border border-violet-500/30'}`}>
              {paymentMethod}
            </span>
          </button>
        </div>

        {/* Action Buttons: WhatsApp Paste + Objections + Delivery WhatsApp + Voice Order */}
        <div className="flex items-center gap-1.5 sm:gap-2 ml-auto shrink-0">
          {/* Pegar de WhatsApp */}
          <button
            type="button"
            onClick={() => setIsWhatsAppParserOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all bg-[#1b0e36] hover:bg-[#28154e] text-purple-200 border border-purple-500/40 shadow-sm"
            title="Pegar pedido recibido por WhatsApp para extraer automáticamente la comanda y dirección"
          >
            <Icon name="content_paste" size={14} className="text-purple-400" />
            <span className="hidden sm:inline">Pegar de WhatsApp</span>
            <span className="sm:hidden">WhatsApp</span>
          </button>

          {/* Asistente de Objeciones */}
          <button
            type="button"
            onClick={() => setIsObjectionsOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all bg-[#12102b] hover:bg-[#1d1a45] text-blue-300 border border-blue-500/40 shadow-sm"
            title="Ver opciones y respuestas a dudas de clientes (rendimiento del metro, precios, demoras)"
          >
            <Icon name="tips_and_updates" size={14} className="text-blue-400" />
            <span className="hidden md:inline">Objeciones & Ayuda</span>
          </button>

          {/* Delivery WhatsApp Direct */}
          {['envío', 'envio', 'delivery'].includes(orderType.toLowerCase()) && (
            <button
              type="button"
              onClick={handleSendDeliveryWhatsApp}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30"
              title="Abrir WhatsApp Web con el pedido completo para enviárselo al cadete / cliente"
            >
              <Icon name="two_wheeler" size={14} />
              <span className="hidden lg:inline">WhatsApp Cadete</span>
            </button>
          )}

          {/* Continuous Voice Order Button */}
          <button
            type="button"
            onClick={() => setVoiceOrderModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-[11px] uppercase transition-all bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/30"
            title="Tomar pedido completo por voz (dictado continuo)"
          >
            <Icon name="mic" size={14} />
            <span>Voz AI</span>
          </button>
        </div>
      </div>

      {/* Main Flow: Left Step Panel + Right Permanent Cart & Notes Panel */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Step Container */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#050508]">
          {/* STEP 1: MENU & PRODUCTS */}
          {posStep === 1 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category selector & Product Search Bar */}
              <div className="bg-[#0b0717] px-4 py-2 border-b border-purple-500/20 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('TODOS')}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all shrink-0 ${
                      activeCategory === 'TODOS'
                        ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/25'
                        : 'bg-[#120926] text-slate-300 hover:bg-[#1f103d] border border-purple-500/20'
                    }`}
                  >
                    TODOS
                  </button>
                  {Object.keys(menu).filter(cat => cat.toLowerCase() !== 'gustos').map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all shrink-0 ${
                        activeCategory === cat
                          ? 'bg-purple-600 text-white font-black shadow-md shadow-purple-600/25'
                          : 'bg-[#120926] text-slate-300 hover:bg-[#1f103d] border border-purple-500/20'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>

                {/* Compact Product Search */}
                <div className="relative">
                  {isSearchOpen ? (
                    <div className="flex items-center">
                      <input
                        type="text"
                        autoFocus
                        placeholder="Buscar producto..."
                        value={productSearch}
                        onChange={e => setProductSearch(e.target.value)}
                        className="w-40 sm:w-48 pl-7 pr-6 py-1 bg-[#090514] border border-purple-500/40 text-white placeholder-slate-500 rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400"
                      />
                      <Icon name="search" size={13} className="absolute left-2 text-slate-400" />
                      <button
                        type="button"
                        onClick={() => { setProductSearch(''); setIsSearchOpen(false); }}
                        className="absolute right-2 text-slate-400 hover:text-white"
                      >
                        <Icon name="close" size={12} />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(true)}
                      className="p-1.5 bg-[#120926] hover:bg-[#1f103d] border border-purple-500/20 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1"
                      title="Buscar producto"
                    >
                      <Icon name="search" size={14} />
                      <span className="text-[10px] font-black uppercase hidden sm:inline">Buscar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Product Cards Grid: Dark Lila & Wide layout */}
              <div className="flex-1 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 overflow-y-auto content-start custom-dark-scrollbar bg-[#050508]">
                {filteredProducts.length === 0 ? (
                  <div className="col-span-full py-16 text-center space-y-2">
                    <Icon name="search_off" size={40} className="mx-auto text-slate-600" />
                    <p className="text-xs font-black uppercase text-slate-400">No se encontraron productos</p>
                  </div>
                ) : (
                  filteredProducts.map(item => {
                    const n = item.name.toLowerCase();
                    let BgIcon = 'local_pizza';
                    if (n.includes('bebida') || n.includes('refresco') || n.includes('agua') || n.includes('cerveza')) BgIcon = 'local_cafe';
                    else if (n.includes('sand') || n.includes('caliente')) BgIcon = 'lunch_dining';
                    else if (n.includes('fainá') || n.includes('faina')) BgIcon = 'bakery_dining';
                    else if (n.includes('postre') || n.includes('flan')) BgIcon = 'icecream';

                    const opensToppingModal = item.isMeter || item.hasToppings || n.includes('pizzeta');
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => opensToppingModal ? setToppingModal({ isOpen: true, item, selectedToppings: [], quantity: 1 }) : addToCart(item, [], 1)}
                        className="bg-[#0e071c] p-3 rounded-2xl border border-purple-500/20 hover:border-purple-500/60 text-left transition-all shadow-sm group flex flex-col justify-between h-28 active:scale-95 relative overflow-hidden text-slate-100"
                      >
                        <Icon name={BgIcon} size={64} className="absolute -bottom-2 -right-2 text-purple-950/35 group-hover:text-purple-900/35 transition-all z-0" />
                        <div className="relative z-10 flex flex-col h-full justify-between w-full">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <div className="text-[11px] font-black uppercase text-white leading-tight line-clamp-2">{item.name}</div>
                              {opensToppingModal && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-purple-950 text-purple-300 border border-purple-500/30 rounded shrink-0">
                                  Gustos
                                </span>
                              )}
                            </div>
                            {item.desc && <div className="text-[9px] text-slate-400 font-bold uppercase italic leading-tight mt-0.5 line-clamp-1">{item.desc}</div>}
                          </div>

                          <div className="flex justify-between items-end pt-1 border-t border-purple-500/15">
                            <div>
                              <div className="text-[8px] font-black text-slate-500 uppercase">
                                {item.isMeter ? 'Metro' : item.isPortion ? 'Porción' : 'Unidad'}
                              </div>
                              <span className="text-lg font-black text-purple-300 tracking-tighter leading-none">${item.price}</span>
                            </div>
                            <div className="p-1.5 bg-[#1b0d38] text-purple-300 group-hover:bg-purple-600 group-hover:text-white rounded-lg transition-all border border-purple-500/30">
                              <Icon name="add" size={14} />
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* STEP 2: DESTINATION & CLIENT */}
          {posStep === 2 && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-dark-scrollbar bg-[#050508] space-y-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Icon name="local_shipping" size={24} className="text-blue-400" /> Paso 2: Destino & Datos del Cliente
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    Selecciona retiro en local, mesa o delivery a domicilio con mapa GPS
                  </p>
                </div>

                {/* Destination Selector Cards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-blue-400 tracking-wider">Tipo de Servicio / Destino</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: 'Local', label: 'Mostrador', desc: 'Retiro en local', icon: 'storefront' },
                      { id: 'Envío', label: 'Delivery', desc: 'Envío a domicilio', icon: 'two_wheeler' },
                      { id: 'Mesa', label: 'Mesa / Salón', desc: 'Consumo en salón', icon: 'table_restaurant' },
                      { id: 'Web', label: 'Pedido Web', desc: 'Online / WhatsApp', icon: 'language' }
                    ].map(dest => {
                      const isSel = orderType.toLowerCase() === dest.id.toLowerCase() || (dest.id === 'Envío' && ['delivery', 'envio'].includes(orderType.toLowerCase()));
                      return (
                        <button
                          key={dest.id}
                          type="button"
                          onClick={() => setOrderType(dest.id)}
                          className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between h-24 ${
                            isSel
                              ? 'bg-blue-600/25 border-blue-500 text-white shadow-md'
                              : 'bg-[#0a0718] border-purple-500/20 text-slate-300 hover:border-blue-500/40'
                          }`}
                        >
                          <Icon name={dest.icon} size={22} className={isSel ? 'text-blue-400' : 'text-slate-400'} />
                          <div>
                            <div className="font-black text-xs uppercase">{dest.label}</div>
                            <div className="text-[9px] text-slate-400 font-bold uppercase">{dest.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Client Data Form */}
                <div className="bg-[#0b071a] p-5 rounded-2xl border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2.5">
                    <span className="text-xs font-black uppercase text-blue-400 flex items-center gap-1.5">
                      <Icon name="person" size={15} /> {orderType === 'Mesa' ? 'Datos de Mesa / Salón' : 'Datos del Cliente'}
                    </span>
                    {orderType !== 'Mesa' && allClients.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowClientDropdown(!showClientDropdown)}
                        className="text-[10px] font-black uppercase text-blue-300 bg-blue-950 px-2.5 py-1 rounded-xl border border-blue-500/30 hover:bg-blue-900 flex items-center gap-1"
                      >
                        <Icon name="history" size={12} /> Directorio ({allClients.length})
                      </button>
                    )}
                  </div>

                  {orderType === 'Mesa' ? (
                    <div className="space-y-4">
                      {/* Interactive 20-Table Selector Grid */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <Icon name="table_restaurant" size={14} /> Seleccionar Mesa (Mesas 1 al 20)
                          </label>
                          <span className="text-[10px] font-black uppercase text-purple-300">
                            {clientInfo.tableNumber ? `Mesa #${clientInfo.tableNumber} Seleccionada` : 'Selecciona una mesa'}
                          </span>
                        </div>

                        <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-5 lg:grid-cols-10 xl:grid-cols-10 gap-2 pt-1">
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(num => {
                            const isSelected = clientInfo.tableNumber === num || clientInfo.tableNumber === String(num);
                            return (
                              <button
                                key={num}
                                type="button"
                                onClick={() => {
                                  setClientInfo({
                                    ...clientInfo,
                                    tableNumber: num,
                                    name: clientInfo.name && !clientInfo.name.startsWith('MESA ') ? clientInfo.name : ''
                                  });
                                }}
                                className={`py-2.5 px-2 rounded-xl font-black text-xs uppercase flex flex-col items-center justify-center gap-0.5 transition-all cursor-pointer border ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-400 shadow-lg shadow-blue-600/40 scale-105 ring-2 ring-blue-400/50'
                                    : 'bg-[#060410] text-slate-300 border-purple-500/20 hover:border-blue-400 hover:bg-blue-950/30'
                                }`}
                              >
                                <span className="text-[9px] text-slate-400 font-bold">MESA</span>
                                <span className="text-sm font-black font-mono">#{num}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Required Customer Name in Table */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-300 uppercase flex items-center justify-between">
                          <span>Nombre del Cliente / Referencia en Mesa *</span>
                          <span className="text-[9px] text-amber-400 font-bold lowercase">requerido para historial</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: Juan, Familia Gómez, Pareja Terraza..."
                          value={clientInfo.name}
                          onChange={e => setClientInfo({ ...clientInfo, name: e.target.value.toUpperCase() })}
                          className="w-full p-3 bg-[#060410] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400 placeholder:text-slate-600"
                        />
                      </div>

                      {/* Waiter / Moza Assigner */}
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-black text-slate-300 uppercase flex items-center gap-1">
                          <Icon name="person" size={13} className="text-purple-400" /> Moza / Mozo que Atiende la Mesa
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {['Moza 1', 'Moza 2', 'Mozo 1', 'Mozo 2'].map(w => {
                            const isWSelected = clientInfo.assignedWaiter === w;
                            return (
                              <button
                                key={w}
                                type="button"
                                onClick={() => setClientInfo({ ...clientInfo, assignedWaiter: w })}
                                className={`p-2 rounded-xl border text-xs font-black uppercase transition-all cursor-pointer ${
                                  isWSelected
                                    ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                                    : 'bg-[#060410] text-slate-400 border-purple-500/20 hover:text-white'
                                }`}
                              >
                                {w}
                              </button>
                            );
                          })}
                        </div>
                        <input
                          type="text"
                          placeholder="O escribe nombre personalizado de Moza / Mozo..."
                          value={clientInfo.assignedWaiter || ''}
                          onChange={e => setClientInfo({ ...clientInfo, assignedWaiter: e.target.value })}
                          className="w-full p-2.5 bg-[#060410] border border-purple-500/20 text-purple-200 rounded-xl text-xs font-bold uppercase outline-none focus:border-purple-400 placeholder:text-slate-600"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2.5 relative">
                      <div className="relative space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Nombre / Apellido</label>
                        <input
                          type="text"
                          placeholder="Buscar cliente en directorio o ingresar nuevo..."
                          value={clientInfo.name}
                          onChange={e => {
                            setClientInfo({ ...clientInfo, name: e.target.value });
                            setShowClientDropdown(true);
                          }}
                          onFocus={() => setShowClientDropdown(true)}
                          className="w-full p-3 bg-[#060410] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400"
                        />

                        {/* CRM Dropdown */}
                        {showClientDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-[#0e0722] border-2 border-blue-500 rounded-2xl shadow-2xl p-2 z-50 space-y-1 max-h-52 overflow-y-auto">
                            <div className="flex items-center justify-between pb-1 px-1 border-b border-purple-500/20 text-[9px] font-black text-slate-400 uppercase">
                              <span>Clientes coincidentes ({matchingClients.length > 0 ? matchingClients.length : allClients.length})</span>
                              <button type="button" onClick={() => setShowClientDropdown(false)} className="text-red-400 hover:text-red-300">Cerrar</button>
                            </div>
                            {(matchingClients.length > 0 ? matchingClients : allClients.slice(0, 8)).map(c => (
                              <button
                                key={c.firestoreId}
                                type="button"
                                onClick={() => handleSelectClient(c)}
                                className="w-full p-2 text-left hover:bg-blue-950/80 rounded-xl transition-colors flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-black text-xs text-blue-300 uppercase">{c.name}</div>
                                  <div className="text-[10px] font-bold text-slate-400">
                                    {c.phone ? `📞 ${c.phone}` : ''} {c.address ? `📍 ${c.address}` : ''} {c.zone ? `(${c.zone})` : ''}
                                  </div>
                                </div>
                                <Icon name="arrow_forward" size={13} className="text-blue-400" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase flex items-center justify-between">
                            <span>Teléfono / Celular</span>
                            {clientInfo.phone && (
                              <button
                                type="button"
                                onClick={() => {
                                  let p = clientInfo.phone.replace(/[^0-9]/g, '');
                                  if (p.startsWith('09') && p.length === 9) p = '598' + p.substring(1);
                                  window.open(`https://wa.me/${p}`, '_blank');
                                }}
                                className="text-blue-400 hover:underline text-[9px] flex items-center gap-0.5"
                              >
                                <Icon name="chat" size={11} /> WhatsApp
                              </button>
                            )}
                          </label>
                          <input
                            type="text"
                            placeholder="098356320"
                            value={clientInfo.phone}
                            onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })}
                            className="w-full p-3 bg-[#060410] border border-purple-500/30 text-white rounded-xl text-xs font-black outline-none focus:border-blue-400"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Zona / Barrio</label>
                          <input
                            type="text"
                            placeholder="Centro, Pocitos, Cordón..."
                            value={clientInfo.zone}
                            onChange={e => setClientInfo({ ...clientInfo, zone: e.target.value.toUpperCase() })}
                            className="w-full p-3 bg-[#060410] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase">Dirección de Entrega</label>
                        <input
                          type="text"
                          placeholder="Calle, número de puerta, esq / apto"
                          value={clientInfo.address}
                          onChange={e => setClientInfo({ ...clientInfo, address: e.target.value.toUpperCase() })}
                          className="w-full p-3 bg-[#060410] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400"
                        />
                      </div>

                      {/* Google Maps Interactive Delivery Pin */}
                      <GoogleDeliveryMap
                        address={clientInfo.address}
                        zone={clientInfo.zone}
                        clientName={clientInfo.name}
                        clientPhone={clientInfo.phone}
                        orderDetails={{
                          itemsSummary: cart.map(i => `• ${i.quantity || 1}x ${i.name}`).join('\n'),
                          totalAmount: cartTotal,
                          paymentMethod,
                          cashProvided: parseFloat(cashProvided) || undefined,
                          changeDue: Math.max(0, (parseFloat(cashProvided) || 0) - cartTotal)
                        }}
                        showMessage={showMessage}
                      />
                    </div>
                  )}
                </div>

                {/* Step 2 Navigation Buttons */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPosStep(1)}
                    className="flex-1 py-3.5 bg-[#120824] hover:bg-[#1e0e3b] text-slate-300 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 border border-purple-500/20"
                  >
                    <Icon name="arrow_back" size={15} /> Volver al Menú
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/25"
                  >
                    Continuar al Pago <Icon name="arrow_forward" size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT METHOD & FINAL CONFIRMATION */}
          {posStep === 3 && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-dark-scrollbar bg-[#050508] space-y-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Icon name="payments" size={24} className="text-violet-400" /> Paso 3: Forma de Pago & Confirmación
                  </h2>
                  <p className="text-[11px] font-bold text-slate-400 uppercase">
                    Calcula vuelto en efectivo, programa horario o envía directo a cocina
                  </p>
                </div>

                {/* Payment Method Selector Grid */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-violet-400 tracking-wider">Medio de Pago</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {[
                      { id: 'Efectivo', label: 'Efectivo', icon: 'payments' },
                      { id: 'Transferencia', label: 'Transferencia', icon: 'account_balance' },
                      { id: 'Débito', label: 'Débito', icon: 'credit_card' },
                      { id: 'Crédito', label: 'Crédito', icon: 'credit_score' },
                      { id: 'Mercado Pago', label: 'Mercado Pago', icon: 'qr_code_2' },
                      { id: 'A confirmar', label: 'A Confirmar', icon: 'help_outline' }
                    ].map(pm => {
                      const isSel = paymentMethod === pm.id;
                      return (
                        <button
                          key={pm.id}
                          type="button"
                          onClick={() => setPaymentMethod(pm.id)}
                          className={`p-3 rounded-2xl border text-left transition-all flex items-center gap-2.5 ${
                            isSel
                              ? 'bg-violet-600/30 border-violet-500 text-white shadow-md'
                              : 'bg-[#0c061a] border-purple-500/20 text-slate-300 hover:border-violet-500/40'
                          }`}
                        >
                          <Icon name={pm.icon} size={20} className={isSel ? 'text-violet-400' : 'text-slate-400'} />
                          <span className="font-black text-xs uppercase">{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Cash and Change Box (if paymentMethod === 'Efectivo') */}
                {paymentMethod === 'Efectivo' && (
                  <div className="bg-[#0e0720] p-5 rounded-2xl border border-purple-500/25 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-violet-400 flex items-center gap-1.5">
                        <Icon name="paid" size={16} /> Pago en Efectivo y Vuelto
                      </span>
                      <span className="text-xs font-black text-slate-300">
                        Total comanda: <strong className="text-purple-300 font-black">${cartTotal}</strong>
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-400">Paga con billete de:</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">$</span>
                          <input
                            type="number"
                            placeholder="Monto entregado"
                            value={cashProvided}
                            onChange={e => setCashProvided(e.target.value)}
                            className="w-full pl-8 pr-3 py-2.5 bg-[#06030e] border border-purple-500/30 text-white rounded-xl text-base font-black outline-none focus:border-violet-400"
                          />
                        </div>
                      </div>

                      {/* Change / Vuelto Output Display */}
                      <div className="p-3 bg-[#06030e] rounded-xl border border-purple-500/20 flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400">Vuelto a devolver al cliente:</div>
                        {missingCash > 0 ? (
                          <div className="text-base font-black text-red-500 mt-0.5">
                            Faltan ${missingCash}
                          </div>
                        ) : (
                          <div className="text-2xl font-black text-white font-mono mt-0.5">
                            ${changeDue}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span className="text-[9px] font-black uppercase text-slate-400 flex items-center mr-1">Billetes:</span>
                      {[cartTotal, 500, 1000, 2000, 5000].filter(v => v >= cartTotal || v === cartTotal).map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setCashProvided(String(val))}
                          className="px-2.5 py-1 bg-[#180d33] hover:bg-[#25154d] text-purple-200 border border-purple-500/30 rounded-lg text-xs font-black transition-all font-mono"
                        >
                          {val === cartTotal ? `$${val} (Exacto)` : `$${val}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled order option */}
                <div className="bg-[#0b071a] p-4 rounded-2xl border border-purple-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="schedule-order"
                      checked={isScheduled}
                      onChange={e => setIsScheduled(e.target.checked)}
                      className="w-4 h-4 rounded text-purple-600 accent-purple-600 cursor-pointer"
                    />
                    <label htmlFor="schedule-order" className="cursor-pointer">
                      <div className="font-black text-xs uppercase text-white">Programar Comanda / Horario Futuro</div>
                      <div className="text-[10px] text-slate-400 font-bold uppercase">Define hora estimada de despacho</div>
                    </label>
                  </div>
                  {isScheduled && (
                    <input
                      type="time"
                      value={scheduledTime}
                      onChange={e => setScheduledTime(e.target.value)}
                      className="p-2 bg-[#06030e] border border-purple-500/30 text-white rounded-xl text-xs font-black outline-none focus:border-violet-400"
                    />
                  )}
                </div>

                {/* Order Summary Recap */}
                <div className="bg-[#0b071a] p-5 rounded-2xl border border-purple-500/20 space-y-3">
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
                    <h3 className="text-xs font-black uppercase text-slate-400">
                      Resumen Final del Pedido
                    </h3>
                    <span className="text-[10px] font-black text-purple-300 uppercase">
                      Pizzería El Árbol
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500 font-black uppercase">Destino:</span>{' '}
                      <strong className="text-blue-400 uppercase">{orderType}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-black uppercase">Cliente:</span>{' '}
                      <strong className="text-white uppercase">{clientInfo.name || 'CONSUMIDOR FINAL'}</strong>
                    </div>
                    {clientInfo.address && (
                      <div className="sm:col-span-2">
                        <span className="text-slate-500 font-black uppercase">Dirección:</span>{' '}
                        <strong className="text-slate-300 uppercase">{clientInfo.address} {clientInfo.zone ? `(${clientInfo.zone})` : ''}</strong>
                      </div>
                    )}
                    <div>
                      <span className="text-slate-500 font-black uppercase">Medio de Pago:</span>{' '}
                      <strong className="text-violet-400 uppercase">{paymentMethod}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-black uppercase">Total a Cobrar:</span>{' '}
                      <strong className="text-xl font-black text-purple-300 font-mono">${cartTotal}</strong>
                    </div>
                  </div>
                </div>

                {/* Step 3 Navigation and Final Dispatch Button */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPosStep(2)}
                    className="py-3.5 px-5 bg-[#120824] hover:bg-[#1e0e3b] text-slate-300 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 border border-purple-500/20"
                  >
                    <Icon name="arrow_back" size={15} /> Volver a Cliente
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCheckout(false)}
                    disabled={cart.length === 0 || isSubmitting}
                    className={`flex-1 py-3.5 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                      cart.length === 0 || isSubmitting
                        ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                        : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
                    }`}
                  >
                    {isSubmitting ? (
                      <>
                        <Icon name="restart_alt" className="animate-spin" size={16} /> Procesando...
                      </>
                    ) : (
                      <>
                        <Icon name="rocket_launch" size={16} /> {editingOrder ? 'Actualizar Pedido' : '🚀 Confirmar y Enviar a Cocina'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Dynamic Contextual Comanda Panel based on posStep */}
        <aside className="w-[340px] md:w-[380px] lg:w-[410px] shrink-0 bg-[#080512] border-l border-purple-500/20 shadow-2xl flex flex-col relative z-20 text-slate-100">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-purple-500/20 font-black uppercase text-xs flex justify-between items-center bg-[#0d071c]">
            <span className="flex items-center gap-2 text-white">
              <Icon name="receipt_long" size={16} className={stepColorTheme.activeText} />
              <span>
                {posStep === 1 ? 'Comanda • Paso 1: Menú' : posStep === 2 ? 'Comanda • Paso 2: Destino' : 'Comanda • Paso 3: Pago'}
              </span>
            </span>
            
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#180c33] text-purple-300 font-mono text-[10px] border border-purple-500/30">
                {totalItemCount} {totalItemCount === 1 ? 'ítem' : 'ítems'}
              </span>
              {editingOrder && (
                <button type="button" onClick={clearForm} className="text-slate-400 text-[10px] hover:text-white font-black">
                  Cancelar
                </button>
              )}
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setCart([]);
                    setCashProvided('');
                    setOrderNotes('');
                  }}
                  className="text-red-400 text-[10px] hover:text-red-300 font-black"
                >
                  Limpiar
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-dark-scrollbar bg-[#080512]">
            {/* Observaciones Box */}
            <div className="bg-[#0e071e] p-3 rounded-2xl border border-purple-500/30 space-y-1.5 shadow-sm">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-purple-300 flex items-center gap-1">
                  <Icon name="edit_note" size={14} className="text-purple-400" /> Observaciones de Comanda
                </label>
                {orderNotes && (
                  <button
                    type="button"
                    onClick={() => setOrderNotes('')}
                    className="text-[9px] text-red-400 hover:text-red-300 font-bold uppercase"
                  >
                    Borrar
                  </button>
                )}
              </div>

              <textarea
                rows={2}
                placeholder="Ej: Masa fina, bien dorada, sin orégano, timbre 4..."
                value={orderNotes}
                onChange={e => setOrderNotes(e.target.value)}
                className="w-full p-2.5 bg-[#06030e] border border-purple-500/30 rounded-xl text-xs font-semibold text-white placeholder-slate-500 outline-none focus:border-purple-400 resize-none"
              />

              {/* Quick Chips */}
              <div className="flex flex-wrap gap-1 pt-1">
                {COMMON_NOTE_CHIPS.map(chip => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleAddNoteChip(chip)}
                    className="px-2 py-0.5 bg-[#170c30] hover:bg-[#25144d] text-purple-200 border border-purple-500/30 rounded-lg text-[9px] font-black uppercase transition-all"
                  >
                    +{chip}
                  </button>
                ))}
              </div>
            </div>

            {/* Cart Items List */}
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between px-1">
                <span>Items en Comanda</span>
                <span>{cart.length} productos</span>
              </div>

              {cart.length === 0 ? (
                <div className="py-8 text-center bg-[#0d071b] rounded-2xl border border-purple-500/20 space-y-1">
                  <Icon name="shopping_cart" size={28} className="mx-auto text-slate-600" />
                  <p className="text-xs font-black uppercase text-slate-400">Comanda vacía</p>
                  <p className="text-[10px] text-slate-500">Selecciona productos del menú</p>
                </div>
              ) : (
                cart.map(item => (
                  <div
                    key={item.cartId}
                    className="bg-[#0e071e] p-2.5 rounded-xl border border-purple-500/25 flex items-center justify-between gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-black text-xs uppercase text-white truncate">{item.name}</div>
                      {item.selectedToppings && item.selectedToppings.length > 0 && (
                        <div className="text-[9px] text-purple-300 font-bold uppercase truncate">
                          +{item.selectedToppings.map(t => t.name).join(', ')}
                        </div>
                      )}
                      <div className="text-[10px] font-black text-purple-300 font-mono">
                        ${Math.round((item.finalPrice || item.price) * (item.quantity || 1))}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 bg-[#06030e] p-1 rounded-lg border border-purple-500/20">
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartId, -1)}
                        className="w-6 h-6 rounded bg-[#170c30] hover:bg-[#25144d] text-white flex items-center justify-center text-xs font-black"
                      >
                        -
                      </button>
                      <span className="w-6 text-center font-black text-xs text-white font-mono">
                        {item.quantity || 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(item.cartId, 1)}
                        className="w-6 h-6 rounded bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center text-xs font-black"
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Cart Footer */}
          <div className="p-3.5 sm:p-4 bg-[#0d071c] border-t border-purple-500/25 space-y-2 shrink-0">
            <div className="flex justify-between items-center text-xs">
              <span className="font-black uppercase text-slate-400">Total a Pagar:</span>
              <span className="text-2xl font-black text-white font-mono">${cartTotal}</span>
            </div>

            {posStep < 3 ? (
              <button
                type="button"
                onClick={() => setPosStep((posStep + 1) as 2 | 3)}
                disabled={cart.length === 0}
                className={`w-full py-3 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${
                  cart.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                }`}
              >
                <span>Avanzar al Paso {posStep + 1}</span>
                <Icon name="arrow_forward" size={14} />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleCheckout(false)}
                disabled={cart.length === 0 || isSubmitting}
                className={`w-full py-3 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 ${
                  cart.length === 0 || isSubmitting
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/30'
                }`}
              >
                {isSubmitting ? (
                  <>
                    <Icon name="restart_alt" className="animate-spin" size={14} />
                    <span>Procesando...</span>
                  </>
                ) : (
                  <>
                    <Icon name="rocket_launch" size={14} />
                    <span>🚀 Confirmar y Enviar a Cocina</span>
                  </>
                )}
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* WhatsApp Order Parser Modal */}
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

      {/* Customer Objections & Help Modal */}
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
