import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { OrderData } from '../types';

interface StaffPerformanceTabProps {
  orders: OrderData[];
  currentUser: {
    username: string;
    role: 'admin' | 'cajero' | 'mozo' | 'delivery';
    displayName: string;
  };
  showMessage: (msg: string, type?: string) => void;
  onUpdateOrderTip?: (orderId: string, tipAmount: number, tipNotes?: string) => Promise<void> | void;
}

export const StaffPerformanceTab: React.FC<StaffPerformanceTabProps> = ({
  orders,
  currentUser,
  showMessage,
  onUpdateOrderTip
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'waiters' | 'drivers' | 'tips_log'>('tips_log');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');

  // Tip Entry by Order ID State
  const [tipSearchQuery, setTipSearchQuery] = useState<string>('');
  const [selectedOrderForTip, setSelectedOrderForTip] = useState<OrderData | null>(null);
  const [tipAmountInput, setTipAmountInput] = useState<string>('');
  const [tipNotesInput, setTipNotesInput] = useState<string>('');
  const [isSavingTip, setIsSavingTip] = useState<boolean>(false);

  // Filter finished or active orders
  const allOrders = useMemo(() => {
    return orders.filter(o => !o.isArchived);
  }, [orders]);

  // Orders with registered tips
  const ordersWithTips = useMemo(() => {
    return allOrders.filter(o => (o.tip || 0) > 0).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [allOrders]);

  // Helper to extract clean numeric identifier from an order ID
  const normalizeOrderId = (idStr: string) => {
    return (idStr || '').replace('#', '').trim().toLowerCase();
  };

  // Matched order when searching by comanda number
  const searchMatchedOrders = useMemo(() => {
    const q = normalizeOrderId(tipSearchQuery);
    if (!q) return [];
    return allOrders.filter(o => {
      const oNum = normalizeOrderId(o.id);
      const oPadded = oNum.padStart(4, '0');
      const qPadded = q.padStart(4, '0');
      return oNum === q || oPadded === qPadded || o.id.toLowerCase().includes(q) ||
        (o.client?.name || '').toLowerCase().includes(q) ||
        (o.tableNumber && String(o.tableNumber) === q);
    }).slice(0, 5);
  }, [tipSearchQuery, allOrders]);

  // Group by Waiter / Moza
  const waiterStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      orderCount: number;
      tables: Set<string | number>;
      clients: Set<string>;
      totalSales: number;
      totalTips: number;
      orders: OrderData[];
    }> = {};

    allOrders.forEach(o => {
      const isMesa = String(o.type || '').toLowerCase() === 'mesa';
      if (!isMesa) return;

      const waiter = o.assignedWaiter || o.client?.assignedWaiter || 'Moza General';
      if (!map[waiter]) {
        map[waiter] = {
          name: waiter,
          orderCount: 0,
          tables: new Set(),
          clients: new Set(),
          totalSales: 0,
          totalTips: 0,
          orders: []
        };
      }

      map[waiter].orderCount += 1;
      if (o.tableNumber || o.client?.tableNumber) {
        map[waiter].tables.add(o.tableNumber || o.client?.tableNumber || '');
      }
      if (o.client?.name) {
        map[waiter].clients.add(o.client.name);
      }
      map[waiter].totalSales += o.total || 0;
      map[waiter].totalTips += o.tip || 0;
      map[waiter].orders.push(o);
    });

    return Object.values(map);
  }, [allOrders]);

  // Group by Delivery Driver (Fefo, Caetano, Samuel, etc.)
  const driverStats = useMemo(() => {
    const map: Record<string, {
      name: string;
      orderCount: number;
      deliveredCount: number;
      clients: Set<string>;
      totalCollected: number;
      totalTips: number;
      orders: OrderData[];
    }> = {};

    allOrders.forEach(o => {
      const isDelivery = ['envío', 'envio', 'delivery'].includes(String(o.type || '').toLowerCase());
      if (!isDelivery) return;

      const driver = o.assignedDriver || 'Sin Asignar';
      if (!map[driver]) {
        map[driver] = {
          name: driver,
          orderCount: 0,
          deliveredCount: 0,
          clients: new Set(),
          totalCollected: 0,
          totalTips: 0,
          orders: []
        };
      }

      map[driver].orderCount += 1;
      if (o.status === 'Finalizado') map[driver].deliveredCount += 1;
      if (o.client?.name) map[driver].clients.add(o.client.name);
      map[driver].totalCollected += o.total || 0;
      map[driver].totalTips += o.tip || 0;
      map[driver].orders.push(o);
    });

    return Object.values(map);
  }, [allOrders]);

  // Totals
  const totalWaiterTips = waiterStats.reduce((sum, w) => sum + w.totalTips, 0);
  const totalDriverTips = driverStats.reduce((sum, d) => sum + d.totalTips, 0);
  const otherTips = allOrders.filter(o => {
    const isMesa = String(o.type || '').toLowerCase() === 'mesa';
    const isDelivery = ['envío', 'envio', 'delivery'].includes(String(o.type || '').toLowerCase());
    return !isMesa && !isDelivery && (o.tip || 0) > 0;
  }).reduce((sum, o) => sum + (o.tip || 0), 0);
  const grandTotalTips = totalWaiterTips + totalDriverTips + otherTips;

  // Handle selecting an order to enter or adjust its tip
  const handleSelectOrderForTip = (order: OrderData) => {
    setSelectedOrderForTip(order);
    setTipAmountInput(order.tip ? String(order.tip) : '');
    setTipNotesInput('');
  };

  // Submit tip assignment for the chosen order
  const handleSaveTip = async () => {
    if (!selectedOrderForTip) {
      showMessage("Seleccione una comanda primero", "error");
      return;
    }
    const val = parseFloat(tipAmountInput);
    if (isNaN(val) || val < 0) {
      showMessage("Ingrese un monto de propina válido ($0 o más)", "error");
      return;
    }

    if (!onUpdateOrderTip) {
      showMessage("Función de actualización no disponible", "error");
      return;
    }

    setIsSavingTip(true);
    try {
      await onUpdateOrderTip(selectedOrderForTip.id, val, tipNotesInput.trim() || undefined);
      showMessage(`✅ Propina de $${val} asignada a comanda #${selectedOrderForTip.id}`, 'success');
      setSelectedOrderForTip(null);
      setTipAmountInput('');
      setTipNotesInput('');
      setTipSearchQuery('');
    } catch (e: any) {
      showMessage("Error al guardar propina: " + e.message, "error");
    } finally {
      setIsSavingTip(false);
    }
  };

  // Helper to format origin / "de dónde"
  const getOrderOrigin = (o: OrderData) => {
    const typeLower = String(o.type || '').toLowerCase();
    if (typeLower === 'mesa') {
      const tableNum = o.tableNumber || o.client?.tableNumber;
      return `🍽️ Mesa ${tableNum ? `#${tableNum}` : 'General'}`;
    }
    if (['envío', 'envio', 'delivery'].includes(typeLower)) {
      return `🏍️ Delivery (${o.client?.address || 'Domicilio'})`;
    }
    return `🏪 Mostrador / Retiro`;
  };

  // Helper to format staff / "quién atendió"
  const getOrderStaff = (o: OrderData) => {
    const typeLower = String(o.type || '').toLowerCase();
    if (typeLower === 'mesa') {
      return o.assignedWaiter || o.client?.assignedWaiter || 'Moza General';
    }
    if (['envío', 'envio', 'delivery'].includes(typeLower)) {
      return o.assignedDriver ? `🏍️ ${o.assignedDriver}` : 'Sin Asignar';
    }
    return 'Caja / Mostrador';
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="bg-[#090314] border-2 border-purple-500/30 rounded-[32px] p-5 sm:p-7 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-purple-600/40 shrink-0">
            <div className="w-full h-full bg-[#090314] rounded-[14px] flex items-center justify-center">
              <Icon name="payments" size={28} className="text-purple-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
                Liquidación de Personal & Propinas
              </h1>
              <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/40">
                AUDITORÍA
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Control de propinas por número de comanda • Registro de quién atendió y de dónde provino
            </p>
          </div>
        </div>

        {/* Propinas Summary Card */}
        <div className="bg-[#040108] border border-purple-500/30 rounded-2xl p-3.5 sm:p-4 flex items-center gap-4 text-right self-stretch md:self-auto shadow-inner">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Total Propinas Turno</div>
            <div className="text-2xl font-black text-emerald-400">${grandTotalTips}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Icon name="volunteer_activism" size={20} />
          </div>
        </div>
      </div>

      {/* CORE FEATURE: Ingresar Propina por Número de Comanda */}
      <div className="bg-[#0b0518] border-2 border-emerald-500/40 rounded-[28px] p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 flex items-center justify-center">
              <Icon name="receipt_long" size={18} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase text-white tracking-tight flex items-center gap-2">
                <span>Ingresar Propina por N° de Comanda</span>
                <span className="text-[9px] font-black px-2 py-0.5 rounded-md bg-emerald-950 text-emerald-300 border border-emerald-500/40 uppercase">
                  Atribución Exacta
                </span>
              </h2>
              <p className="text-[11px] font-bold text-slate-400">
                Ingrese el número de ticket/comanda (#0001, 12, etc.) para asociar la propina a la mesa, mozo o delivery responsable
              </p>
            </div>
          </div>

          {selectedOrderForTip && (
            <button
              type="button"
              onClick={() => setSelectedOrderForTip(null)}
              className="px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-black uppercase transition-all"
            >
              ✕ Cambiar Comanda
            </button>
          )}
        </div>

        {/* Step 1: Comanda Selector / Search Field */}
        {!selectedOrderForTip ? (
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2.5">
              <div className="relative flex-1">
                <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-purple-400" />
                <input
                  type="text"
                  value={tipSearchQuery}
                  onChange={(e) => setTipSearchQuery(e.target.value)}
                  placeholder="Escriba el N° de Comanda (ej: #0012, 12 o nombre del cliente)..."
                  className="w-full pl-10 pr-4 py-2.5 bg-[#040108] border border-purple-500/40 focus:border-emerald-400 rounded-xl text-white font-black text-sm placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                />
                {tipSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTipSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-black"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* Matching Orders List */}
            {tipSearchQuery.trim() !== '' && (
              <div className="bg-[#040108] border border-purple-500/30 rounded-2xl p-2 divide-y divide-purple-500/10 max-h-60 overflow-y-auto">
                {searchMatchedOrders.length === 0 ? (
                  <div className="p-4 text-center text-xs font-bold text-slate-400">
                    No se encontró ninguna comanda con el término "{tipSearchQuery}".
                  </div>
                ) : (
                  searchMatchedOrders.map(o => (
                    <div
                      key={o.firestoreId}
                      onClick={() => handleSelectOrderForTip(o)}
                      className="p-3 hover:bg-purple-950/40 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-3 group"
                    >
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-emerald-300 text-sm bg-emerald-950/60 px-2 py-0.5 rounded-lg border border-emerald-500/30">
                          #{o.id}
                        </span>
                        <div>
                          <div className="font-black text-xs text-white uppercase flex items-center gap-2">
                            <span>{getOrderOrigin(o)}</span>
                            <span className="text-slate-400 font-bold">•</span>
                            <span className="text-purple-300">{o.client?.name || 'Consumidor Final'}</span>
                          </div>
                          <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                            Atendido por: <strong className="text-white">{getOrderStaff(o)}</strong> • Total: ${o.total} • Propina actual: ${o.tip || 0}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="px-3 py-1.5 bg-emerald-600 group-hover:bg-emerald-500 text-slate-950 rounded-xl font-black text-xs uppercase transition-all shrink-0 flex items-center gap-1 shadow-md"
                      >
                        <Icon name="payments" size={14} />
                        <span>Seleccionar</span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Quick Pills for Recent Orders */}
            <div className="space-y-1.5 pt-1">
              <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
                <Icon name="schedule" size={13} />
                <span>Comandas recientes del turno (Click para ingresar propina):</span>
              </div>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {allOrders.slice(0, 10).map(o => (
                  <button
                    key={o.firestoreId}
                    type="button"
                    onClick={() => handleSelectOrderForTip(o)}
                    className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer border ${
                      (o.tip || 0) > 0
                        ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-200 hover:bg-emerald-900'
                        : 'bg-[#040108] border-purple-500/30 text-slate-300 hover:border-emerald-400 hover:text-white'
                    }`}
                  >
                    <span className="font-mono text-purple-300">#{o.id}</span>
                    <span>{getOrderOrigin(o)}</span>
                    {(o.tip || 0) > 0 && (
                      <span className="text-emerald-400 font-extrabold">+${o.tip}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          /* Step 2: Order Identified - Enter Tip & Confirm */
          <div className="bg-[#040108] border border-emerald-500/40 rounded-2xl p-4 sm:p-5 space-y-4">
            {/* Comanda Identified Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-[#0c061a] p-3.5 rounded-xl border border-purple-500/30 text-xs">
              <div>
                <div className="text-[9px] font-black uppercase text-slate-400">Comanda</div>
                <div className="font-mono font-black text-base text-emerald-300">#{selectedOrderForTip.id}</div>
                <div className="text-[10px] text-slate-400 font-bold">{selectedOrderForTip.time || 'Hoy'}</div>
              </div>

              <div>
                <div className="text-[9px] font-black uppercase text-slate-400">¿De dónde? (Origen)</div>
                <div className="font-black text-white text-xs mt-0.5">{getOrderOrigin(selectedOrderForTip)}</div>
                <div className="text-[10px] text-purple-300 font-bold">Cliente: {selectedOrderForTip.client?.name || 'Consumidor Final'}</div>
              </div>

              <div>
                <div className="text-[9px] font-black uppercase text-slate-400">¿Quién atendió?</div>
                <div className="font-black text-cyan-300 text-xs mt-0.5">{getOrderStaff(selectedOrderForTip)}</div>
                <div className="text-[10px] text-slate-400 font-bold">Estado: {selectedOrderForTip.status}</div>
              </div>

              <div>
                <div className="text-[9px] font-black uppercase text-slate-400">Venta & Propina Actual</div>
                <div className="font-black text-white text-xs mt-0.5">Total Venta: ${selectedOrderForTip.total}</div>
                <div className="text-[11px] font-black text-emerald-400">
                  Propina Actual: ${selectedOrderForTip.tip || 0}
                </div>
              </div>
            </div>

            {/* Tip Amount Input & Quick Shortcuts */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-emerald-400 font-black text-base">$</span>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    autoFocus
                    value={tipAmountInput}
                    onChange={(e) => setTipAmountInput(e.target.value)}
                    placeholder="Monto de propina ($)..."
                    className="w-full pl-8 pr-4 py-2.5 bg-[#090314] border-2 border-emerald-500/60 focus:border-emerald-400 rounded-xl text-white font-black text-base focus:outline-none focus:ring-2 focus:ring-emerald-400/40"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[50, 100, 200, 300, 500].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setTipAmountInput(String(amt))}
                      className="px-2.5 py-2 bg-[#120726] hover:bg-emerald-950 border border-purple-500/30 hover:border-emerald-400 text-emerald-300 rounded-xl text-xs font-black transition-all"
                    >
                      +${amt}
                    </button>
                  ))}
                  {selectedOrderForTip.total > 0 && (
                    <button
                      type="button"
                      onClick={() => setTipAmountInput(String(Math.round(selectedOrderForTip.total * 0.10)))}
                      className="px-2.5 py-2 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-200 rounded-xl text-xs font-black transition-all"
                      title="Calcular 10% sugerido"
                    >
                      10% (${Math.round(selectedOrderForTip.total * 0.10)})
                    </button>
                  )}
                </div>
              </div>

              {/* Optional Notes */}
              <input
                type="text"
                value={tipNotesInput}
                onChange={(e) => setTipNotesInput(e.target.value)}
                placeholder="Observación opcional (ej: propina dejada en efectivo al mozo, transferencia, etc.)..."
                className="w-full px-3 py-2 bg-[#090314] border border-purple-500/30 rounded-xl text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-purple-400"
              />

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedOrderForTip(null)}
                  className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-xl text-xs font-black uppercase transition-all"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={isSavingTip || tipAmountInput.trim() === ''}
                  onClick={handleSaveTip}
                  className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-950 font-black text-xs uppercase rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {isSavingTip ? (
                    <>
                      <Icon name="sync" size={16} className="animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="save" size={16} />
                      <span>Guardar Propina en Comanda #{selectedOrderForTip.id}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Mode Toggles: Historial de Propinas, Mozas, Deliveries */}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={() => { setActiveSubTab('tips_log'); setSelectedStaff('ALL'); }}
          className={`px-5 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubTab === 'tips_log'
              ? 'bg-emerald-600 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-600/30'
              : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-emerald-400 hover:bg-[#120726]'
          }`}
        >
          <Icon name="receipt_long" size={16} />
          <span>💰 Propinas por Comanda (${ordersWithTips.length})</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-950/30 text-white font-black">
            ${grandTotalTips}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('waiters'); setSelectedStaff('ALL'); }}
          className={`px-5 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubTab === 'waiters'
              ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-lg shadow-purple-600/30'
              : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-purple-400 hover:bg-[#120726]'
          }`}
        >
          <Icon name="table_restaurant" size={16} />
          <span>🍽️ Mozas / Salón (${waiterStats.length})</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-950/30 text-white font-black">
            ${totalWaiterTips}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('drivers'); setSelectedStaff('ALL'); }}
          className={`px-5 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer border ${
            activeSubTab === 'drivers'
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-600/30'
              : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-cyan-400 hover:bg-[#120726]'
          }`}
        >
          <Icon name="two_wheeler" size={16} />
          <span>🏍️ Deliveries (${driverStats.length})</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-950/30 text-white font-black">
            ${totalDriverTips}
          </span>
        </button>
      </div>

      {/* VIEW 1: HISTORIAL DE TODAS LAS PROPINAS REGISTRADAS POR COMANDA */}
      {activeSubTab === 'tips_log' && (
        <div className="space-y-4">
          <div className="bg-[#090314] border border-purple-500/20 rounded-[28px] p-5 sm:p-6 space-y-4 overflow-x-auto">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2 border-b border-purple-500/20 pb-3">
              <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                <Icon name="receipt_long" size={18} className="text-emerald-400" />
                <span>Auditoría de Propinas por N° de Comanda</span>
              </h3>
              <span className="text-xs font-bold text-slate-400">
                Total registrado: <strong className="text-emerald-400">${grandTotalTips}</strong> en {ordersWithTips.length} comandas
              </span>
            </div>

            {ordersWithTips.length === 0 ? (
              <div className="p-10 text-center space-y-2">
                <Icon name="volunteer_activism" size={40} className="mx-auto text-slate-600" />
                <div className="text-sm font-black uppercase text-slate-300">
                  Aún no se registraron propinas en este turno
                </div>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Utilice el buscador superior para ingresar el número de comanda y cargar las propinas otorgadas por los clientes.
                </p>
              </div>
            ) : (
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-purple-500/20 text-[10px] font-black uppercase text-slate-400">
                    <th className="pb-3">Comanda</th>
                    <th className="pb-3">De Dónde (Origen)</th>
                    <th className="pb-3">Quién Atendió</th>
                    <th className="pb-3">Cliente</th>
                    <th className="pb-3">Total Venta</th>
                    <th className="pb-3 text-emerald-400">Propina</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {ordersWithTips.map(order => (
                    <tr key={order.firestoreId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono font-black text-purple-300">#{order.id}</td>
                      <td className="py-3 font-black text-white">
                        {getOrderOrigin(order)}
                      </td>
                      <td className="py-3 text-cyan-300">
                        {getOrderStaff(order)}
                      </td>
                      <td className="py-3 text-slate-200 uppercase">{order.client?.name || 'Consumidor Final'}</td>
                      <td className="py-3 font-black text-white">${order.total}</td>
                      <td className="py-3 font-black text-emerald-400 text-sm">
                        +${order.tip}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectOrderForTip(order)}
                          className="px-2.5 py-1 bg-purple-950/70 hover:bg-purple-900 border border-purple-500/30 text-purple-200 rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          ✏️ Modificar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: MOZAS / SALON */}
      {activeSubTab === 'waiters' && (
        <div className="space-y-6">
          {/* Summary Cards per Moza */}
          {waiterStats.length === 0 ? (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[32px] p-12 text-center space-y-3">
              <Icon name="table_restaurant" size={44} className="mx-auto text-slate-600" />
              <div className="text-lg font-black uppercase text-slate-300">
                No hay comandas registradas en mesas aún
              </div>
              <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto">
                Cuando las mozas tomen pedidos para mesas quedarán registradas aquí con sus clientes y propinas atribuidas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {waiterStats.map(w => (
                <div
                  key={w.name}
                  className="bg-[#090314] border border-purple-500/30 rounded-[28px] p-5 shadow-xl space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center font-black text-base border border-purple-500/30">
                        <Icon name="person" size={20} />
                      </div>
                      <div>
                        <div className="font-black text-sm text-white uppercase">{w.name}</div>
                        <div className="text-[10px] font-bold text-purple-400">
                          {w.orderCount} comandas • {w.tables.size} mesas atendidas
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-[#040108] p-2.5 rounded-xl border border-purple-500/20">
                      <div className="text-[9px] font-black uppercase text-slate-400">Total Facturado</div>
                      <div className="text-base font-black text-white">${w.totalSales}</div>
                    </div>
                    <div className="bg-[#040108] p-2.5 rounded-xl border border-emerald-500/30">
                      <div className="text-[9px] font-black uppercase text-emerald-400">Propinas</div>
                      <div className="text-base font-black text-emerald-300">${w.totalTips}</div>
                    </div>
                  </div>

                  {/* Mesas List */}
                  <div className="space-y-1 pt-1">
                    <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Icon name="table_restaurant" size={12} /> Mesas atendidas:
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(w.tables).map(t => (
                        <span key={t} className="px-2 py-0.5 bg-purple-950/80 border border-purple-500/30 rounded-lg text-[9px] font-mono font-black text-purple-200">
                          Mesa #{t}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Orders Audit Table for Mesas */}
          {waiterStats.length > 0 && (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[28px] p-5 sm:p-6 space-y-4 overflow-x-auto">
              <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                <Icon name="list_alt" size={16} className="text-purple-400" /> Detalle de Mesas y Propinas Asignadas
              </h3>
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-purple-500/20 text-[10px] font-black uppercase text-slate-400">
                    <th className="pb-3">Comanda</th>
                    <th className="pb-3">Mesa</th>
                    <th className="pb-3">Moza / Mozo</th>
                    <th className="pb-3">Cliente</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3 text-emerald-400">Propina</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {allOrders.filter(o => String(o.type || '').toLowerCase() === 'mesa').map(order => (
                    <tr key={order.firestoreId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono font-black text-purple-300">#{order.id}</td>
                      <td className="py-3 font-mono font-black text-white">
                        Mesa #{order.tableNumber || order.client?.tableNumber || 'S/N'}
                      </td>
                      <td className="py-3 text-slate-200">
                        {order.assignedWaiter || order.client?.assignedWaiter || 'Moza General'}
                      </td>
                      <td className="py-3 text-white uppercase">{order.client?.name || 'Cliente'}</td>
                      <td className="py-3 font-black text-white">${order.total}</td>
                      <td className="py-3 font-black text-emerald-300">
                        {order.tip ? `+$${order.tip}` : '-'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectOrderForTip(order)}
                          className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          {order.tip ? '✏️ Editar' : '+ Propina'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 3: DELIVERIES (FEFO, CAETANO, SAMUEL) */}
      {activeSubTab === 'drivers' && (
        <div className="space-y-6">
          {driverStats.length === 0 ? (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[32px] p-12 text-center space-y-3">
              <Icon name="two_wheeler" size={44} className="mx-auto text-slate-600" />
              <div className="text-lg font-black uppercase text-slate-300">
                No hay envíos registrados aún
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {driverStats.map(d => (
                <div
                  key={d.name}
                  className="bg-[#090314] border border-cyan-500/30 rounded-[28px] p-5 shadow-xl space-y-3.5"
                >
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-2xl bg-cyan-600/20 text-cyan-300 flex items-center justify-center font-black text-base border border-cyan-500/30">
                        <Icon name="two_wheeler" size={20} />
                      </div>
                      <div>
                        <div className="font-black text-sm text-white uppercase">🏍️ {d.name}</div>
                        <div className="text-[10px] font-bold text-cyan-400">
                          {d.orderCount} asignados • {d.deliveredCount} entregados
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-[#040108] p-2.5 rounded-xl border border-purple-500/20">
                      <div className="text-[9px] font-black uppercase text-slate-400">Total Cobrado</div>
                      <div className="text-base font-black text-white">${d.totalCollected}</div>
                    </div>
                    <div className="bg-[#040108] p-2.5 rounded-xl border border-emerald-500/30">
                      <div className="text-[9px] font-black uppercase text-emerald-400">Propinas</div>
                      <div className="text-base font-black text-emerald-300">${d.totalTips}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delivery Audit Table */}
          {driverStats.length > 0 && (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[28px] p-5 sm:p-6 space-y-4 overflow-x-auto">
              <h3 className="font-black text-sm uppercase text-white flex items-center gap-2">
                <Icon name="two_wheeler" size={16} className="text-cyan-400" /> Detalle de Repartos y Propinas
              </h3>
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-purple-500/20 text-[10px] font-black uppercase text-slate-400">
                    <th className="pb-3">Comanda</th>
                    <th className="pb-3">Repartidor</th>
                    <th className="pb-3">Cliente</th>
                    <th className="pb-3">Dirección</th>
                    <th className="pb-3">Total Cobrado</th>
                    <th className="pb-3 text-emerald-400">Propina</th>
                    <th className="pb-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-purple-500/10">
                  {allOrders.filter(o => ['envío', 'envio', 'delivery'].includes(String(o.type || '').toLowerCase())).map(order => (
                    <tr key={order.firestoreId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 font-mono font-black text-cyan-300">#{order.id}</td>
                      <td className="py-3 font-black text-white">
                        {order.assignedDriver ? `🏍️ ${order.assignedDriver}` : 'Sin Asignar'}
                      </td>
                      <td className="py-3 text-white uppercase">{order.client?.name || 'Cliente'}</td>
                      <td className="py-3 text-slate-300">{order.client?.address || 'Mostrador'}</td>
                      <td className="py-3 font-black text-white">${order.total}</td>
                      <td className="py-3 font-black text-emerald-300">
                        {order.tip ? `+$${order.tip}` : '-'}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleSelectOrderForTip(order)}
                          className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-lg text-[10px] font-black uppercase transition-all"
                        >
                          {order.tip ? '✏️ Editar' : '+ Propina'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
