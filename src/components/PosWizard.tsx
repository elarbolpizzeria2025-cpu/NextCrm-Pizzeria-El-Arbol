import React, { useState } from 'react';
import { MenuItem, CartItem, ClientData, OrderData } from '../types';
import { Icon } from './Icon';
import { GoogleDeliveryMap } from './GoogleDeliveryMap';

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
  th: any;
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

  // Calculate live change for cash
  const cashNum = parseFloat(cashProvided) || 0;
  const changeDue = cashNum > 0 ? Math.max(0, cashNum - cartTotal) : 0;
  const missingCash = cashNum > 0 && cashNum < cartTotal ? cartTotal - cashNum : 0;
  const totalItemCount = cart.reduce((s, i) => s + (i.quantity || 1), 0);

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

  return (
    <div className="h-full flex flex-col relative bg-[#03060a] text-slate-100 select-none overflow-hidden">
      {/* Wizard Step Progression Bar */}
      <div className="bg-[#070d14] border-b border-slate-800 px-4 py-2.5 shrink-0 flex flex-wrap items-center justify-between gap-3 shadow-md z-30">
        <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar">
          {/* Step 1 */}
          <button
            type="button"
            onClick={() => setPosStep(1)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 1
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-[#0e1724] text-slate-300 hover:bg-[#142236] border border-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 1 ? 'bg-white text-blue-600' : 'bg-blue-950 text-blue-300'}`}>
              1
            </span>
            <span>1. Menú</span>
            {cart.length > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${posStep === 1 ? 'bg-white/20 text-white' : 'bg-blue-600 text-white'}`}>
                {totalItemCount}
              </span>
            )}
          </button>

          <Icon name="chevron_right" size={14} className="text-slate-600 shrink-0 hidden sm:inline" />

          {/* Step 2 */}
          <button
            type="button"
            onClick={() => setPosStep(2)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 2
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-[#0e1724] text-slate-300 hover:bg-[#142236] border border-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 2 ? 'bg-white text-blue-600' : 'bg-blue-950 text-blue-300'}`}>
              2
            </span>
            <span>2. Destino</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${posStep === 2 ? 'bg-white/20 text-white' : 'bg-blue-950 text-blue-300 border border-blue-500/30'}`}>
              {orderType}
            </span>
          </button>

          <Icon name="chevron_right" size={14} className="text-slate-600 shrink-0 hidden sm:inline" />

          {/* Step 3 */}
          <button
            type="button"
            onClick={() => setPosStep(3)}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all ${
              posStep === 3
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'bg-[#0e1724] text-slate-300 hover:bg-[#142236] border border-slate-800'
            }`}
          >
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${posStep === 3 ? 'bg-white text-blue-600' : 'bg-blue-950 text-blue-300'}`}>
              3
            </span>
            <span>3. Pago</span>
            <span className={`text-[10px] px-2 py-0.2 rounded-full font-bold uppercase ${posStep === 3 ? 'bg-white/20 text-white' : 'bg-blue-950 text-blue-300 border border-blue-500/30'}`}>
              {paymentMethod}
            </span>
          </button>
        </div>

        {/* Continuous Voice Order Button */}
        <button
          type="button"
          onClick={() => setVoiceOrderModalOpen(true)}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/30 ml-auto shrink-0"
          title="Tomar pedido completo por voz (dictado continuo)"
        >
          <Icon name="mic" size={15} />
          <span>Pedido por Voz</span>
          <span className="text-[9px] bg-white/20 text-white px-1.5 py-0.2 rounded-full font-black">AI</span>
        </button>
      </div>

      {/* Main Flow: Left Step Panel + Right Permanent Cart & Notes Panel */}
      <div className="flex-1 flex flex-row overflow-hidden">
        {/* Left Step Container */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0 bg-[#03060a]">
          {/* STEP 1: MENU & PRODUCTS */}
          {posStep === 1 && (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Category selector & Product Search Bar */}
              <div className="bg-[#070e17] px-4 py-2.5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 shrink-0">
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar items-center flex-1">
                  <button
                    type="button"
                    onClick={() => setActiveCategory('TODOS')}
                    className={`px-3.5 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all shrink-0 ${
                      activeCategory === 'TODOS'
                        ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/20'
                        : 'bg-[#0f1826] text-slate-300 hover:bg-[#152336] border border-slate-800'
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
                          ? 'bg-blue-600 text-white font-black shadow-md shadow-blue-600/20'
                          : 'bg-[#0f1826] text-slate-300 hover:bg-[#152336] border border-slate-800'
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
                        className="w-40 sm:w-48 pl-7 pr-6 py-1 bg-[#0b121c] border border-blue-500/40 text-white placeholder-slate-500 rounded-xl text-xs font-black uppercase outline-none focus:border-blue-400"
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
                      className="p-1.5 bg-[#0f1826] hover:bg-[#152336] border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs flex items-center gap-1"
                      title="Buscar producto"
                    >
                      <Icon name="search" size={14} />
                      <span className="text-[10px] font-black uppercase hidden sm:inline">Buscar</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Product Cards Grid: Long & Wide layout */}
              <div className="flex-1 p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5 overflow-y-auto content-start custom-dark-scrollbar bg-[#03060a]">
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
                        className="bg-[#080f18] p-3 rounded-2xl border border-slate-800 hover:border-blue-500/60 text-left transition-all shadow-sm group flex flex-col justify-between h-28 active:scale-95 relative overflow-hidden text-slate-100"
                      >
                        <Icon name={BgIcon} size={64} className="absolute -bottom-2 -right-2 text-slate-900/60 group-hover:text-blue-950/40 transition-all z-0" />
                        <div className="relative z-10 flex flex-col h-full justify-between w-full">
                          <div>
                            <div className="flex justify-between items-start gap-1">
                              <div className="text-[11px] font-black uppercase text-white leading-tight line-clamp-2">{item.name}</div>
                              {opensToppingModal && (
                                <span className="text-[8px] font-black uppercase px-1.5 py-0.2 bg-blue-950 text-blue-300 border border-blue-500/30 rounded shrink-0">
                                  Gustos
                                </span>
                              )}
                            </div>
                            {item.desc && <div className="text-[9px] text-slate-400 font-bold uppercase italic leading-tight mt-0.5 line-clamp-1">{item.desc}</div>}
                          </div>

                          <div className="flex justify-between items-end pt-1 border-t border-slate-800/80">
                            <div>
                              <div className="text-[8px] font-black text-slate-500 uppercase">
                                {item.isMeter ? 'Metro' : item.isPortion ? 'Porción' : 'Unidad'}
                              </div>
                              <span className="text-lg font-black text-blue-400 tracking-tighter leading-none">${item.price}</span>
                            </div>
                            <div className="p-1.5 bg-[#0e1a2b] text-blue-400 group-hover:bg-blue-600 group-hover:text-white rounded-lg transition-all border border-blue-500/30">
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
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-dark-scrollbar bg-[#03060a] space-y-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Icon name="local_shipping" size={24} className="text-blue-400" /> Paso 2: Destino & Datos del Cliente
                  </h2>
                </div>

                {/* Destination Selector Cards */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Tipo de Servicio / Destino</label>
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
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                              : 'bg-[#080f18] border-slate-800 text-slate-300 hover:border-slate-700'
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
                <div className="bg-[#070d14] p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
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
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-slate-400 uppercase">Número o Nombre de Mesa</label>
                      <input
                        type="text"
                        placeholder="Ej: Mesa 1, Mesa Terraza, Juan"
                        value={clientInfo.name}
                        onChange={e => setClientInfo({ ...clientInfo, name: e.target.value.toUpperCase() })}
                        className="w-full p-3 bg-[#03060a] border border-slate-800 text-white rounded-xl text-sm font-black uppercase outline-none focus:border-blue-500"
                      />
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
                          className="w-full p-3 bg-[#03060a] border border-slate-800 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500"
                        />

                        {/* CRM Dropdown */}
                        {showClientDropdown && (
                          <div className="absolute top-full left-0 right-0 mt-1 bg-[#09121d] border-2 border-blue-500 rounded-2xl shadow-2xl p-2 z-50 space-y-1 max-h-52 overflow-y-auto">
                            <div className="flex items-center justify-between pb-1 px-1 border-b border-slate-800 text-[9px] font-black text-slate-400 uppercase">
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
                            placeholder="099 123 456"
                            value={clientInfo.phone}
                            onChange={e => setClientInfo({ ...clientInfo, phone: e.target.value })}
                            className="w-full p-3 bg-[#03060a] border border-slate-800 text-white rounded-xl text-xs font-black outline-none focus:border-blue-500"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase">Zona / Barrio</label>
                          <input
                            type="text"
                            placeholder="Centro, Pocitos, Cordón..."
                            value={clientInfo.zone}
                            onChange={e => setClientInfo({ ...clientInfo, zone: e.target.value.toUpperCase() })}
                            className="w-full p-3 bg-[#03060a] border border-slate-800 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500"
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
                          className="w-full p-3 bg-[#03060a] border border-slate-800 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-blue-500"
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
                    className="flex-1 py-3.5 bg-[#0e1724] hover:bg-[#142236] text-slate-300 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 border border-slate-800"
                  >
                    <Icon name="arrow_back" size={15} /> Volver al Menú
                  </button>
                  <button
                    type="button"
                    onClick={() => setPosStep(3)}
                    className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-md shadow-blue-600/20"
                  >
                    Continuar al Pago <Icon name="arrow_forward" size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PAYMENT METHOD & FINAL CONFIRMATION */}
          {posStep === 3 && (
            <div className="flex-1 p-4 sm:p-6 overflow-y-auto custom-dark-scrollbar bg-[#03060a] space-y-4">
              <div className="max-w-3xl mx-auto space-y-4">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    <Icon name="payments" size={24} className="text-blue-400" /> Paso 3: Forma de Pago & Confirmación
                  </h2>
                </div>

                {/* Payment Method Selector Grid */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Medio de Pago</label>
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
                              ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                              : 'bg-[#080f18] border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          <Icon name={pm.icon} size={20} className={isSel ? 'text-blue-400' : 'text-slate-400'} />
                          <span className="font-black text-xs uppercase">{pm.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Cash and Change Box (if paymentMethod === 'Efectivo') */}
                {paymentMethod === 'Efectivo' && (
                  <div className="bg-[#070d14] p-5 rounded-2xl border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase text-blue-400 flex items-center gap-1.5">
                        <Icon name="paid" size={16} /> Pago en Efectivo y Vuelto
                      </span>
                      <span className="text-xs font-black text-slate-300">
                        Total comanda: <strong className="text-blue-400 font-black">${cartTotal}</strong>
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
                            className="w-full pl-8 pr-3 py-2.5 bg-[#03060a] border border-slate-800 text-white rounded-xl text-base font-black outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>

                      {/* Change / Vuelto Output Display */}
                      <div className="p-3 bg-[#03060a] rounded-xl border border-slate-800 flex flex-col justify-center">
                        <div className="text-[10px] font-black uppercase text-slate-400">Vuelto a devolver al cliente:</div>
                        {missingCash > 0 ? (
                          <div className="text-base font-black text-red-400 mt-0.5">
                            Faltan ${missingCash}
                          </div>
                        ) : (
                          <div className="text-2xl font-black text-blue-400 mt-0.5">
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
                          className="px-2.5 py-1 bg-[#0e1724] hover:bg-[#142236] text-blue-300 border border-slate-800 rounded-lg text-xs font-black transition-all"
                        >
                          {val === cartTotal ? `$${val} (Exacto)` : `$${val}`}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Scheduled order option */}
                <div className="bg-[#070d14] p-4 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="schedule-order"
                      checked={isScheduled}
                      onChange={e => setIsScheduled(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 accent-blue-600 cursor-pointer"
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
                      className="p-2 bg-[#03060a] border border-slate-800 text-white rounded-xl text-xs font-black outline-none focus:border-blue-500"
                    />
                  )}
                </div>

                {/* Order Summary Recap */}
                <div className="bg-[#070d14] p-5 rounded-2xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <h3 className="text-xs font-black uppercase text-slate-400">
                      Resumen Final del Pedido
                    </h3>
                    <span className="text-[10px] font-black text-blue-400 uppercase">
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
                      <strong className="text-blue-400 uppercase">{paymentMethod}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 font-black uppercase">Total a Cobrar:</span>{' '}
                      <strong className="text-xl font-black text-blue-400">${cartTotal}</strong>
                    </div>
                  </div>
                </div>

                {/* Step 3 Navigation and Final Dispatch Button */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setPosStep(2)}
                    className="py-3.5 px-5 bg-[#0e1724] hover:bg-[#142236] text-slate-300 rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 border border-slate-800"
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
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
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
        <aside className="w-[340px] md:w-[380px] lg:w-[410px] shrink-0 bg-[#060b12] border-l border-slate-800 shadow-2xl flex flex-col relative z-20 text-slate-100">
          {/* Header */}
          <div className="p-3.5 sm:p-4 border-b border-slate-800 font-black uppercase text-xs flex justify-between items-center bg-[#09111c]">
            <span className="flex items-center gap-2 text-white">
              <Icon name="receipt_long" size={16} className="text-blue-400" />
              <span>
                {posStep === 1 ? 'Comanda • Paso 1: Menú' : posStep === 2 ? 'Comanda • Paso 2: Destino' : 'Comanda • Paso 3: Pago'}
              </span>
            </span>
            
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-full bg-[#101c2c] text-blue-300 font-mono text-[10px] border border-blue-500/30">
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

          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 custom-dark-scrollbar bg-[#060b12]">
            {/* STEP 1 COMANDA VIEW: Items & Observaciones Focus */}
            {posStep === 1 && (
              <>
                {/* Permanent Notes Box - Editable */}
                <div className="bg-[#09111c] p-3 rounded-2xl border border-blue-500/30 space-y-1.5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-blue-300 flex items-center gap-1">
                      <Icon name="description" size={13} className="text-blue-400" /> Observaciones de Cocina
                    </label>
                    {orderNotes && (
                      <button
                        type="button"
                        onClick={() => setOrderNotes('')}
                        className="text-[9px] text-slate-400 hover:text-white uppercase font-black"
                      >
                        Borrar
                      </button>
                    )}
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Ej: Bien tostada, sin orégano, muzza del medio..."
                    value={orderNotes}
                    onChange={e => setOrderNotes(e.target.value)}
                    className="w-full p-2 bg-[#03060a] border border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl text-[11px] font-black uppercase outline-none focus:border-blue-500 resize-none"
                  />
                  {/* Quick Note Presets */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {COMMON_NOTE_CHIPS.map(chip => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => handleAddNoteChip(chip)}
                        className="px-2 py-0.5 bg-[#0e1724] hover:bg-[#142236] text-blue-300 text-[9px] font-bold rounded-lg border border-slate-800 transition-all uppercase"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cart Items List */}
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider flex justify-between">
                    <span>Productos Agregados ({totalItemCount})</span>
                  </div>

                  {cart.length === 0 ? (
                    <div className="py-8 text-center border border-dashed border-slate-800 rounded-2xl p-4 space-y-1">
                      <Icon name="shopping_cart" size={24} className="mx-auto text-slate-600" />
                      <div className="text-xs font-black uppercase text-slate-400">Comanda vacía</div>
                      <div className="text-[10px] text-slate-500">Seleccione productos del menú o use el pedido por voz</div>
                    </div>
                  ) : (
                    cart.map(it => (
                      <div key={it.cartId} className="bg-[#09111c] p-2.5 rounded-xl border border-slate-800 flex flex-col gap-1.5 shadow-sm">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 pr-2">
                            <div className="text-[11px] font-black uppercase text-white leading-tight">
                              {it.quantity > 1 ? `${it.quantity}x ` : ''}{it.name}
                            </div>
                            {it.selectedToppings && it.selectedToppings.length > 0 && (
                              <div className="text-[9px] text-blue-300 italic mt-0.5 flex flex-wrap gap-1">
                                {it.selectedToppings.map((t, idx) => (
                                  <span key={idx} className="bg-blue-950 px-1.5 py-0.2 rounded text-[8px] font-bold border border-blue-500/30">
                                    + {t.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => setCart(cart.filter(x => x.cartId !== it.cartId))}
                            className="text-slate-500 hover:text-red-400 p-0.5"
                            title="Eliminar artículo"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
                          <div className="flex items-center gap-1.5 bg-[#03060a] px-2 py-0.5 rounded-lg border border-slate-800">
                            <button
                              type="button"
                              onClick={() => updateQuantity(it.cartId, -1)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              <Icon name="remove" size={12} />
                            </button>
                            <span className="font-black text-xs text-blue-300 min-w-3 text-center">{it.quantity || 1}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(it.cartId, 1)}
                              className="text-slate-400 hover:text-white p-0.5"
                            >
                              <Icon name="add" size={12} />
                            </button>
                          </div>
                          <span className="text-blue-400 font-black text-xs">
                            ${Math.round((it.finalPrice || 0) * (it.quantity || 1))}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}

            {/* STEP 2 COMANDA VIEW: Destination, Client & Delivery Focus */}
            {posStep === 2 && (
              <div className="space-y-3">
                {/* Active Destination Card */}
                <div className="bg-[#09121d] p-3.5 rounded-2xl border border-blue-500/40 space-y-2.5 shadow-md">
                  <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                    <span className="text-[10px] font-black uppercase text-blue-300 flex items-center gap-1">
                      <Icon name="pin_drop" size={14} className="text-blue-400" /> Destino Configurado
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-[9px] uppercase">
                      {orderType}
                    </span>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-baseline justify-between">
                      <span className="text-slate-400 font-bold uppercase text-[10px]">Cliente:</span>
                      <strong className="text-white uppercase font-black">{clientInfo.name || (orderType === 'Mesa' ? 'Sin mesa' : 'Consumidor Final')}</strong>
                    </div>

                    {clientInfo.phone && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-slate-400 font-bold uppercase text-[10px]">Teléfono:</span>
                        <span className="text-blue-300 font-bold">{clientInfo.phone}</span>
                      </div>
                    )}

                    {['envío', 'envio', 'delivery'].includes(orderType.toLowerCase()) && (
                      <div className="pt-1 border-t border-slate-800">
                        <div className="text-[10px] font-bold text-slate-400 uppercase">Dirección de Entrega:</div>
                        {clientInfo.address ? (
                          <div className="text-xs font-black text-blue-200 mt-0.5 uppercase">
                            📍 {clientInfo.address} {clientInfo.zone ? `(${clientInfo.zone})` : ''}
                          </div>
                        ) : (
                          <div className="p-2 bg-red-950/40 border border-red-500/40 text-red-300 rounded-xl text-[10px] font-black uppercase mt-1 flex items-center gap-1">
                            <Icon name="warning" size={12} className="text-red-400 shrink-0" />
                            <span>Falta ingresar la dirección para el delivery</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Compact Items Recap */}
                <div className="bg-[#070d14] p-3 rounded-2xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400">
                    <span>Resumen de Productos</span>
                    <button type="button" onClick={() => setPosStep(1)} className="text-blue-400 hover:underline">
                      Editar Menú
                    </button>
                  </div>
                  <ul className="text-xs space-y-1.5 divide-y divide-slate-800/60">
                    {cart.map(it => (
                      <li key={it.cartId} className="flex justify-between items-center pt-1 text-slate-200">
                        <span className="truncate max-w-[200px] text-[11px] font-black uppercase">
                          {it.quantity}x {it.name}
                        </span>
                        <span className="font-mono font-bold text-blue-400 text-[11px]">
                          ${Math.round((it.finalPrice || 0) * (it.quantity || 1))}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                {orderNotes && (
                  <div className="p-2.5 bg-[#070d14] border border-blue-500/20 rounded-xl text-[10px] font-bold text-blue-200 uppercase">
                    📝 <span className="font-black text-slate-400">Nota:</span> {orderNotes}
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 COMANDA VIEW: Final Payment & Checkout Recap */}
            {posStep === 3 && (
              <div className="space-y-3">
                {/* Payment summary box */}
                <div className="bg-[#09121d] p-3.5 rounded-2xl border border-blue-500/40 space-y-2 shadow-md">
                  <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                    <span className="text-[10px] font-black uppercase text-blue-300 flex items-center gap-1">
                      <Icon name="payments" size={14} className="text-blue-400" /> Forma de Pago
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white font-black text-[9px] uppercase">
                      {paymentMethod}
                    </span>
                  </div>

                  {paymentMethod === 'Efectivo' && (
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between items-center text-slate-300">
                        <span className="text-[10px] font-bold uppercase">Paga con:</span>
                        <span className="font-mono font-black">${cashNum || cartTotal}</span>
                      </div>
                      <div className="flex justify-between items-center text-blue-300 font-black">
                        <span className="text-[10px] uppercase">Vuelto:</span>
                        <span className="font-mono text-sm">${changeDue}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Client & Destination recap */}
                <div className="bg-[#070d14] p-3 rounded-2xl border border-slate-800 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Destino:</span>
                    <strong className="text-blue-300 uppercase">{orderType}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400 font-bold uppercase text-[10px]">Cliente:</span>
                    <strong className="text-white uppercase">{clientInfo.name || 'CONSUMIDOR FINAL'}</strong>
                  </div>
                  {clientInfo.address && (
                    <div className="text-[10px] text-slate-300 uppercase truncate">
                      📍 {clientInfo.address}
                    </div>
                  )}
                </div>

                {/* Items recap */}
                <div className="bg-[#070d14] p-3 rounded-2xl border border-slate-800 space-y-1.5">
                  <div className="text-[10px] font-black uppercase text-slate-400">
                    Productos ({totalItemCount})
                  </div>
                  <ul className="text-xs space-y-1 max-h-36 overflow-y-auto custom-dark-scrollbar">
                    {cart.map(it => (
                      <li key={it.cartId} className="flex justify-between text-slate-300 text-[11px]">
                        <span className="truncate max-w-[200px] font-black uppercase">{it.quantity}x {it.name}</span>
                        <span className="font-mono text-blue-400">${Math.round((it.finalPrice || 0) * (it.quantity || 1))}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>

          {/* Bottom Total & Step Action Button */}
          <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-[#05090f] shrink-0 space-y-2.5">
            <div className="flex justify-between items-end">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Comanda</span>
                <div className="text-2xl font-black text-blue-400 tracking-tighter leading-none">${cartTotal}</div>
              </div>
              {posStep === 3 && paymentMethod === 'Efectivo' && changeDue > 0 && (
                <div className="text-right">
                  <span className="text-[9px] font-black text-slate-400 uppercase">Vuelto</span>
                  <div className="text-lg font-black text-white leading-none">${changeDue}</div>
                </div>
              )}
            </div>

            {/* Contextual Step Action with Strict Validation */}
            {posStep === 1 && (
              <button
                type="button"
                onClick={() => setPosStep(2)}
                disabled={cart.length === 0}
                className={`w-full py-3.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-md transition-all ${
                  cart.length === 0
                    ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-98'
                }`}
              >
                <span>Paso 2: Destino & Cliente</span> <Icon name="arrow_forward" size={15} />
              </button>
            )}

            {posStep === 2 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPosStep(1)}
                  className="px-3.5 py-3.5 bg-[#0e1724] hover:bg-[#142236] text-slate-300 rounded-xl font-black uppercase text-xs transition-all border border-slate-800 flex items-center justify-center gap-1"
                >
                  <Icon name="arrow_back" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (['envío', 'envio', 'delivery'].includes(orderType.toLowerCase()) && !clientInfo.address.trim()) {
                      showMessage('Por favor ingrese la dirección para el delivery', 'error');
                      return;
                    }
                    setPosStep(3);
                  }}
                  className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/30 active:scale-98"
                >
                  <span>Paso 3: Forma de Pago</span> <Icon name="arrow_forward" size={15} />
                </button>
              </div>
            )}

            {posStep === 3 && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPosStep(2)}
                  className="px-3.5 py-3.5 bg-[#0e1724] hover:bg-[#142236] text-slate-300 rounded-xl font-black uppercase text-xs transition-all border border-slate-800 flex items-center justify-center gap-1"
                >
                  <Icon name="arrow_back" size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleCheckout(false)}
                  disabled={cart.length === 0 || isSubmitting}
                  className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase flex items-center justify-center gap-2 shadow-md transition-all ${
                    cart.length === 0 || isSubmitting
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30 active:scale-98'
                  }`}
                >
                  {isSubmitting ? <Icon name="restart_alt" className="animate-spin" size={15} /> : <Icon name="rocket_launch" size={15} />}
                  <span>{isSubmitting ? "Procesando..." : (editingOrder ? "Actualizar Pedido" : "🚀 Confirmar y Enviar")}</span>
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
};
