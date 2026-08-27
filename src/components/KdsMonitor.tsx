import React, { useState, useEffect, useMemo, useRef } from 'react';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { OrderData } from '../types';
import { Icon } from './Icon';
import { printOrderTicket } from '../utils/printTicket';

interface KdsMonitorProps {
  orders: OrderData[];
  db: any;
  appId: string;
  WARNING_THRESHOLDS: Record<string, number[]>;
  setNotesModal: (data: { isOpen: boolean; order: OrderData | null; text: string }) => void;
  handleEditOrder: (order: OrderData) => void;
  notifyClientWhatsApp: (order: OrderData) => void;
  setDeliveryShareModal: (data: { isOpen: boolean; order: OrderData | null }) => void;
  setEditOrderModal: (data: {
    isOpen: boolean;
    order: OrderData | null;
    cashReceived: string;
    tip: string;
    voucherDelivered: boolean;
    transferConfirmed: boolean;
    selectedPaymentMethod: string;
  }) => void;
  handleDirectDispatch: (order: OrderData) => void;
  showMessage: (msg: string, type?: string) => void;
  onCloseFullScreen?: () => void;
  isStandalone?: boolean;
}

export const KdsMonitor: React.FC<KdsMonitorProps> = ({
  orders,
  db,
  appId,
  WARNING_THRESHOLDS,
  setNotesModal,
  handleEditOrder,
  notifyClientWhatsApp,
  setDeliveryShareModal,
  setEditOrderModal,
  handleDirectDispatch,
  showMessage,
  onCloseFullScreen,
  isStandalone = false
}) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<'ALL' | 'DELAYED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [collapsedCards, setCollapsedCards] = useState<Record<string, boolean>>({});
  const [collapseAll, setCollapseAll] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevOrderCountRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Beep sound generator for new / delayed orders
  const playAlertTone = (type: 'new' | 'delayed' | 'ready') => {
    if (!soundEnabled) return;
    try {
      if (!audioContextRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) audioContextRef.current = new AudioCtx();
      }
      const ctx = audioContextRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume();

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      if (type === 'new') {
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === 'delayed') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } else {
        osc.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.warn('Audio alert error:', e);
    }
  };

  // Fullscreen toggle handler
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Filter Active Kitchen Orders
  const activeOrders = useMemo(() => {
    return orders.filter(o => !o.isArchived && (o.status === 'Preparando' || o.status === 'Pendiente'));
  }, [orders]);

  // Alert tone on new orders
  useEffect(() => {
    if (prevOrderCountRef.current > 0 && activeOrders.length > prevOrderCountRef.current) {
      playAlertTone('new');
    }
    prevOrderCountRef.current = activeOrders.length;
  }, [activeOrders.length]);

  // Helper to check if an order is delayed
  const isOrderDelayed = (order: OrderData) => {
    if (order.isScheduled && order.scheduledTime && order.scheduledTime > Date.now()) return false;
    const elapsedMinutes = Math.floor((Date.now() - order.createdAt) / 60000);
    const threshold = (WARNING_THRESHOLDS[order.type] || [25])[0];
    return elapsedMinutes >= threshold;
  };

  const getElapsedMinutes = (createdAt: number) => {
    return Math.max(0, Math.floor((Date.now() - createdAt) / 60000));
  };

  // Classified Orders
  const { localOrders, salonOrders, deliveryOrders, scheduledOrders, delayedOrdersList } = useMemo(() => {
    const local: OrderData[] = [];
    const salon: OrderData[] = [];
    const delivery: OrderData[] = [];
    const scheduled: OrderData[] = [];
    const delayed: OrderData[] = [];

    activeOrders.forEach(o => {
      // Query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = String(o.id || '').toLowerCase().includes(q);
        const matchName = String(o.client?.name || '').toLowerCase().includes(q);
        const matchPhone = String(o.client?.phone || '').includes(q);
        const matchAddress = String(o.client?.address || '').toLowerCase().includes(q);
        if (!matchId && !matchName && !matchPhone && !matchAddress) return;
      }

      const isDelayed = isOrderDelayed(o);
      if (isDelayed) delayed.push(o);

      if (selectedFilter === 'DELAYED' && !isDelayed) return;

      const safeType = String(o.type || '').trim().toLowerCase();
      const isFutureScheduled = o.isScheduled && o.scheduledTime && o.scheduledTime > Date.now();

      if (isFutureScheduled) {
        scheduled.push(o);
      } else if (['local', 'mostrador', 'retiro'].includes(safeType)) {
        local.push(o);
      } else if (['mesa', 'salon', 'salón', 'mesas'].includes(safeType)) {
        salon.push(o);
      } else if (['envío', 'envio', 'delivery', 'web', 'pedido web'].includes(safeType)) {
        delivery.push(o);
      } else {
        local.push(o);
      }
    });

    const sortFn = (a: OrderData, b: OrderData) => {
      const aDel = isOrderDelayed(a);
      const bDel = isOrderDelayed(b);
      if (aDel && !bDel) return -1;
      if (!aDel && bDel) return 1;
      return a.createdAt - b.createdAt;
    };

    return {
      localOrders: local.sort(sortFn),
      salonOrders: salon.sort(sortFn),
      deliveryOrders: delivery.sort(sortFn),
      scheduledOrders: scheduled.sort((a, b) => (a.scheduledTime || a.createdAt) - (b.scheduledTime || b.createdAt)),
      delayedOrdersList: delayed.sort((a, b) => a.createdAt - b.createdAt)
    };
  }, [activeOrders, selectedFilter, searchQuery, WARNING_THRESHOLDS]);

  // Mark order as Ready - moves to Retiro en Local / Mesas / Delivery
  const handleMarkReady = async (order: OrderData) => {
    playAlertTone('ready');
    try {
      const safeType = String(order.type || '').trim().toLowerCase();
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        status: 'Listo',
        preparedAt: Date.now()
      });
      const destName = ['local', 'mostrador', 'retiro'].includes(safeType)
        ? 'Retiro en Local'
        : ['mesa', 'salon', 'salón', 'mesas'].includes(safeType)
        ? 'Mesas'
        : 'Delivery';
      showMessage(`Pedido #${order.id} listo para ${destName}`, 'success');
    } catch (e: any) {
      showMessage('Error al actualizar pedido: ' + e.message, 'error');
    }
  };

  const handleDeleteOrder = async (order: OrderData) => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId));
      showMessage(`Comanda #${order.id} eliminada`, 'info');
    } catch (e: any) {
      showMessage('Error al eliminar: ' + e.message, 'error');
    }
  };

  // Toggle card collapse
  const toggleCardCollapse = (orderId: string) => {
    setCollapsedCards(prev => ({
      ...prev,
      [orderId]: prev[orderId] !== undefined ? !prev[orderId] : !collapseAll
    }));
  };

  const toggleCollapseAll = () => {
    const nextVal = !collapseAll;
    setCollapseAll(nextVal);
    setCollapsedCards({});
  };

  // Render a Single Compact Order Card
  const renderCompactCard = (order: OrderData) => {
    const isDelayed = isOrderDelayed(order);
    const elapsedMinutes = getElapsedMinutes(order.createdAt);
    const isFutureScheduled = order.isScheduled && order.scheduledTime && order.scheduledTime > Date.now();
    const isCollapsed = collapsedCards[order.firestoreId] !== undefined
      ? collapsedCards[order.firestoreId]
      : collapseAll;

    return (
      <div
        key={order.firestoreId}
        id={`kds-card-${order.firestoreId}`}
        className={`rounded-2xl transition-all duration-200 relative overflow-hidden flex flex-col p-3 text-[12px] ${
          isDelayed
            ? 'bg-[#180a0e] border-2 border-red-500 shadow-xl shadow-red-950/60 ring-1 ring-red-500/50'
            : isFutureScheduled
            ? 'bg-[#08101a] border border-blue-500/40 shadow-md'
            : 'bg-[#0a0f16] border border-slate-800 hover:border-blue-500/50 shadow-md'
        }`}
      >
        {/* Delayed red banner indicator */}
        {isDelayed && (
          <div className="absolute top-0 left-0 right-0 h-1 bg-red-500 animate-pulse" />
        )}

        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 overflow-hidden">
            <span className="font-mono font-black text-sm text-white tracking-wide">
              #{order.id}
            </span>
            <span className="font-bold text-slate-200 truncate uppercase text-[12px]">
              {order.client?.name || (order.type === 'Mesa' ? `Mesa` : 'Local')}
            </span>
          </div>

          {/* Time Badge */}
          <div className="flex items-center gap-1 shrink-0">
            {isFutureScheduled ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                <Icon name="event_available" size={12} />
                {new Date(order.scheduledTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            ) : (
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black flex items-center gap-1 shadow-sm ${
                  isDelayed
                    ? 'bg-red-600 text-white animate-pulse'
                    : elapsedMinutes > 15
                    ? 'bg-blue-900/60 text-blue-200 border border-blue-500/40'
                    : 'bg-[#101824] text-slate-300 border border-slate-700'
                }`}
              >
                <Icon name="schedule" size={11} />
                {elapsedMinutes}m
              </span>
            )}
            <button
              type="button"
              onClick={() => toggleCardCollapse(order.firestoreId)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title={isCollapsed ? 'Desplegar comanda' : 'Plegar comanda'}
            >
              <Icon name={isCollapsed ? 'expand_more' : 'expand_less'} size={15} />
            </button>
          </div>
        </div>

        {/* Customer Metadata */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 mb-2 pb-1.5 border-b border-slate-800/80">
          {order.client?.phone && order.client.phone !== 'N/A' && (
            <button
              type="button"
              onClick={() => notifyClientWhatsApp(order)}
              className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
              title="Contactar por WhatsApp"
            >
              <Icon name="chat" size={12} />
              <span>{order.client.phone}</span>
            </button>
          )}

          {order.client?.address && (
            <span className="flex items-center gap-1 text-slate-300 truncate max-w-[190px]" title={order.client.address}>
              <Icon name="place" size={12} className="text-blue-400 shrink-0" />
              <span className="truncate">{order.client.address}</span>
            </span>
          )}

          {order.notes && (
            <span className="px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-200 font-bold border border-blue-500/30 flex items-center gap-1 text-[10px]">
              <Icon name="info" size={11} className="text-blue-400" />
              <span className="truncate max-w-[140px]">{order.notes}</span>
            </span>
          )}
        </div>

        {/* Items List or Collapsed Preview */}
        {isCollapsed ? (
          <div className="flex items-center justify-between py-1.5 px-2 bg-[#060c14] rounded-xl border border-slate-800/80 mb-2 text-slate-300">
            <span className="text-[11px] font-black uppercase text-blue-300 flex items-center gap-1">
              <Icon name="inventory_2" size={13} /> {order.items?.length || 0} productos
            </span>
            <span className="text-xs font-mono font-black text-white">${order.total}</span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 mb-3 flex-1 overflow-y-auto max-h-[220px] pr-1 no-scrollbar">
            {order.items?.map((item, idx) => (
              <div key={idx} className="flex flex-col text-slate-100">
                <div className="flex items-baseline gap-1.5 font-medium leading-tight">
                  <span className="font-mono font-bold text-blue-400 text-[12px] shrink-0">
                    {item.quantity || 1}x
                  </span>
                  <span className="font-semibold text-white tracking-wide">
                    {item.name}
                  </span>
                </div>

                {item.selectedToppings && item.selectedToppings.length > 0 && (
                  <div className="ml-5 mt-0.5">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 font-bold text-[10px] border border-blue-500/40 uppercase tracking-wider">
                      <Icon name="local_pizza" size={10} />+{' '}
                      {item.selectedToppings.map(t => t.name).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Card Footer / Action Buttons */}
        <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-slate-800/80">
          <button
            type="button"
            onClick={() => handleMarkReady(order)}
            className="flex-1 py-2 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black uppercase text-[11px] tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-md shadow-blue-600/30 active:scale-95"
          >
            <Icon name="check" size={14} />
            <span>LISTO</span>
          </button>

          {/* Edit Notes */}
          <button
            type="button"
            onClick={() => setNotesModal({ isOpen: true, order, text: order.notes || '' })}
            className="p-2 bg-[#0e1724] hover:bg-[#142236] text-blue-300 hover:text-white rounded-xl border border-blue-500/30 transition-colors"
            title="Editar notas / comentarios"
          >
            <Icon name="edit_note" size={15} />
          </button>

          {/* Print Ticket */}
          <button
            type="button"
            onClick={() => printOrderTicket(order)}
            className="p-2 bg-[#0e1724] hover:bg-[#142236] text-slate-300 hover:text-white rounded-xl border border-slate-700 transition-colors"
            title="Imprimir comanda"
          >
            <Icon name="print" size={15} />
          </button>

          {/* Delete Order */}
          <button
            type="button"
            onClick={() => handleDeleteOrder(order)}
            className="p-2 bg-red-950/40 hover:bg-red-900 text-red-400 hover:text-white rounded-xl border border-red-800/40 transition-colors"
            title="Eliminar comanda"
          >
            <Icon name="delete" size={15} />
          </button>
        </div>
      </div>
    );
  };

  // Render a Column Container
  const renderColumn = (title: string, count: number, orderList: OrderData[], columnKey: string, iconName: string) => {
    return (
      <div className="flex flex-col bg-[#060b11] rounded-3xl border border-slate-800/90 overflow-hidden shadow-2xl flex-1 min-w-[270px] max-w-full">
        {/* Column Header */}
        <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between bg-[#0a111a] shrink-0">
          <div className="flex items-center gap-2">
            <Icon name={iconName} size={16} className="text-blue-400" />
            <h2 className="font-mono font-black text-xs sm:text-sm tracking-wider uppercase text-slate-100">
              {title}
            </h2>
          </div>
          <span className={`font-mono font-black text-xs px-2.5 py-0.5 rounded-full ${
            count > 0 ? 'bg-blue-950 text-blue-300 border border-blue-500/40' : 'bg-slate-900 text-slate-500'
          }`}>
            {count}
          </span>
        </div>

        {/* Orders Column List */}
        <div className="p-3 flex flex-col gap-2.5 overflow-y-auto flex-1 no-scrollbar min-h-0">
          {orderList.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-600">
              <Icon name="restaurant" size={30} className="opacity-30 mb-2" />
              <span className="text-[11px] font-mono uppercase tracking-widest">Sin comandas</span>
            </div>
          ) : (
            orderList.map(order => renderCompactCard(order))
          )}
        </div>
      </div>
    );
  };

  return (
    <div
      ref={containerRef}
      className={`flex flex-col bg-[#03060a] text-slate-100 overflow-hidden select-none ${
        isFullscreen || isStandalone ? 'fixed inset-0 z-50 p-3 sm:p-4' : 'h-full p-3 sm:p-4'
      }`}
    >
      {/* Top Banner Alert if any Delayed Orders */}
      {delayedOrdersList.length > 0 && (
        <div className="mb-3 px-4 py-2 bg-red-950/80 border border-red-500/80 rounded-2xl flex items-center justify-between text-red-200 text-xs font-bold animate-pulse shadow-lg shadow-red-950/50 shrink-0">
          <div className="flex items-center gap-2">
            <Icon name="warning" size={16} className="text-red-400 animate-bounce" />
            <span>
              ¡ATENCIÓN COCINA! Hay <strong className="underline font-black">{delayedOrdersList.length} pedido(s) demorado(s)</strong> superando el tiempo estimado.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setSelectedFilter(prev => prev === 'DELAYED' ? 'ALL' : 'DELAYED')}
            className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-black uppercase transition-colors shrink-0 shadow"
          >
            {selectedFilter === 'DELAYED' ? 'Ver Todos' : 'Ver Solo Demorados'}
          </button>
        </div>
      )}

      {/* Main KDS Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 mb-3 pb-3 border-b border-slate-800/80 shrink-0">
        {/* Title and Live Status */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-blue-400 font-black text-lg">⚡</span>
            <h1 className="font-mono font-black text-sm sm:text-base tracking-widest uppercase text-white">
              KDS MONITOR COCINA
            </h1>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-950 border border-blue-500/40 text-blue-300 text-[10px] font-black uppercase tracking-wider">
            <span className="w-2 h-2 rounded-full bg-blue-400 animate-ping" />
            <span>EN VIVO</span>
          </div>

          {delayedOrdersList.length > 0 && (
            <span className="px-2.5 py-1 rounded-full bg-red-950 border border-red-500 text-red-400 text-[10px] font-black uppercase animate-pulse">
              {delayedOrdersList.length} DEMORADOS
            </span>
          )}
        </div>

        {/* Controls and Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Expandable Search Input */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center">
                <input
                  type="text"
                  autoFocus
                  placeholder="Buscar comanda..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="bg-[#0b1219] border border-blue-500/40 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none w-44 transition-all"
                />
                <Icon name="search" size={14} className="absolute left-2.5 text-slate-400" />
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setIsSearchOpen(false); }}
                  className="absolute right-2 text-slate-400 hover:text-white"
                >
                  <Icon name="close" size={13} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsSearchOpen(true)}
                className="p-2 bg-[#0b1219] hover:bg-[#121c27] border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-all flex items-center gap-1"
                title="Buscar comanda"
              >
                <Icon name="search" size={15} />
                <span className="text-[10px] font-black uppercase hidden sm:inline">Buscar</span>
              </button>
            )}
          </div>

          {/* Call Demorados Filter Toggle */}
          <button
            type="button"
            onClick={() => setSelectedFilter(prev => prev === 'DELAYED' ? 'ALL' : 'DELAYED')}
            className={`px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${
              selectedFilter === 'DELAYED'
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/30'
                : 'bg-[#0b1219] border-slate-800 text-slate-300 hover:border-red-500/50 hover:text-red-300'
            }`}
            title="Filtrar solo comandas demoradas"
          >
            <Icon name="warning" size={14} className={selectedFilter === 'DELAYED' ? 'text-white' : 'text-red-400'} />
            <span>Call Demorados ({delayedOrdersList.length})</span>
          </button>

          {/* Toggle All Cards Collapse/Expand */}
          <button
            type="button"
            onClick={toggleCollapseAll}
            className="px-3 py-1.5 bg-[#0b1219] hover:bg-[#121c27] border border-slate-800 text-slate-300 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
            title={collapseAll ? 'Desplegar todas las comandas' : 'Plegar todas las comandas'}
          >
            <Icon name={collapseAll ? 'unfold_more' : 'unfold_less'} size={14} className="text-blue-400" />
            <span>{collapseAll ? 'Desplegar' : 'Plegar'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            type="button"
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`p-2 rounded-xl border text-xs transition-colors ${
              soundEnabled
                ? 'bg-blue-950 border-blue-500/40 text-blue-300'
                : 'bg-[#0b1219] border-slate-800 text-slate-500'
            }`}
            title={soundEnabled ? 'Sonido activado' : 'Sonido silenciado'}
          >
            <Icon name={soundEnabled ? 'volume_up' : 'volume_off'} size={15} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 bg-[#0b1219] hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa (TV Cocina)'}
          >
            <Icon name={isFullscreen ? 'fullscreen_exit' : 'fullscreen'} size={16} />
          </button>

          {/* Digital Clock */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0b1219] border border-slate-800 rounded-xl font-mono text-xs sm:text-sm font-bold text-slate-300 shadow-inner">
            <Icon name="alarm" size={14} className="text-blue-400" />
            <span>{currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
          </div>

          {/* Close Standalone if open in modal */}
          {onCloseFullScreen && (
            <button
              type="button"
              onClick={onCloseFullScreen}
              className="p-2 bg-red-950/60 hover:bg-red-900 border border-red-500/50 text-red-300 rounded-xl"
              title="Cerrar monitor KDS"
            >
              <Icon name="close" size={16} />
            </button>
          )}
        </div>
      </header>

      {/* Grid of Columns: 4 Main Columns (or exclusively Delayed Orders when Call Demorados is active) */}
      <main className="flex-1 overflow-x-auto no-scrollbar pb-1">
        {selectedFilter === 'DELAYED' ? (
          <div className="flex flex-col h-full bg-[#060b11] rounded-3xl border-2 border-red-500/60 p-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-red-500/30">
              <div className="flex items-center gap-2">
                <Icon name="warning" size={20} className="text-red-400 animate-bounce" />
                <h2 className="font-mono font-black text-sm sm:text-base text-red-300 uppercase">
                  VISTA EXCLUSIVA: PEDIDOS DEMORADOS ({delayedOrdersList.length})
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setSelectedFilter('ALL')}
                className="px-4 py-1.5 bg-[#0f1724] hover:bg-slate-800 border border-slate-700 text-slate-200 rounded-xl text-xs font-black uppercase transition-all"
              >
                Volver a Ver Todas las Comandas
              </button>
            </div>

            {delayedOrdersList.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                <Icon name="check_circle" size={48} className="text-blue-400 mb-2" />
                <span className="font-mono font-black uppercase text-sm text-slate-300">
                  ¡Excelente! No hay comandas demoradas en este momento
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto flex-1 no-scrollbar">
                {delayedOrdersList.map(order => renderCompactCard(order))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 h-full min-h-0">
            {/* Column 1: Retiro en Local */}
            {renderColumn(
              'RETIRO EN LOCAL',
              localOrders.length,
              localOrders,
              'local',
              'store'
            )}

            {/* Column 2: Salón (Mesas) */}
            {renderColumn(
              'SALÓN (MESAS)',
              salonOrders.length,
              salonOrders,
              'salon',
              'table_restaurant'
            )}

            {/* Column 3: Delivery */}
            {renderColumn(
              'DELIVERY',
              deliveryOrders.length,
              deliveryOrders,
              'delivery',
              'two_wheeler'
            )}

            {/* Column 4: Programados */}
            {renderColumn(
              'PROGRAMADOS',
              scheduledOrders.length,
              scheduledOrders,
              'scheduled',
              'event_available'
            )}
          </div>
        )}
      </main>
    </div>
  );
};
