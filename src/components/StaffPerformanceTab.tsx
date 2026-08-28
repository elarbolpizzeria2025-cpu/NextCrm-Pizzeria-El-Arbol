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
}

export const StaffPerformanceTab: React.FC<StaffPerformanceTabProps> = ({
  orders,
  currentUser,
  showMessage
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'waiters' | 'drivers'>('waiters');
  const [selectedStaff, setSelectedStaff] = useState<string>('ALL');

  // Filter finished or active orders
  const allOrders = useMemo(() => {
    return orders.filter(o => !o.isArchived);
  }, [orders]);

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
  const grandTotalTips = totalWaiterTips + totalDriverTips;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 min-h-screen">
      {/* Header Banner */}
      <div className="bg-[#090314] border-2 border-purple-500/30 rounded-[36px] p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-purple-600/40 shrink-0">
            <div className="w-full h-full bg-[#090314] rounded-[22px] flex items-center justify-center">
              <Icon name="payments" size={32} className="text-purple-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
                Liquidación de Personal & Propinas
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40">
                AUDITORÍA
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Historial detallado de mesas atendidas por Mozas y repartos realizados por Deliveries
            </p>
          </div>
        </div>

        {/* Propinas Summary Card */}
        <div className="bg-[#040108] border border-purple-500/30 rounded-2xl p-4 flex items-center gap-4 text-right self-stretch md:self-auto">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400">Total Propinas Registradas</div>
            <div className="text-2xl font-black text-emerald-400">${grandTotalTips}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
            <Icon name="volunteer_activism" size={20} />
          </div>
        </div>
      </div>

      {/* Main Mode Toggle: Mozas vs Deliveries */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => { setActiveSubTab('waiters'); setSelectedStaff('ALL'); }}
          className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all cursor-pointer border ${
            activeSubTab === 'waiters'
              ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-lg shadow-purple-600/30'
              : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-purple-400 hover:bg-[#120726]'
          }`}
        >
          <Icon name="table_restaurant" size={18} />
          <span>🍽️ Mozas / Salón (${waiterStats.length})</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-950/30 text-white font-black">
            $${totalWaiterTips} propinas
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveSubTab('drivers'); setSelectedStaff('ALL'); }}
          className={`px-6 py-3.5 rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all cursor-pointer border ${
            activeSubTab === 'drivers'
              ? 'bg-cyan-600 text-white border-cyan-400 shadow-lg shadow-cyan-600/30'
              : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-cyan-400 hover:bg-[#120726]'
          }`}
        >
          <Icon name="two_wheeler" size={18} />
          <span>🏍️ Deliveries (${driverStats.length})</span>
          <span className="px-2 py-0.5 rounded-lg text-[10px] bg-slate-950/30 text-white font-black">
            $${totalDriverTips} propinas
          </span>
        </button>
      </div>

      {/* SECTION 1: MOZAS / SALON */}
      {activeSubTab === 'waiters' && (
        <div className="space-y-6">
          {/* Summary Cards per Moza */}
          {waiterStats.length === 0 ? (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[36px] p-12 text-center space-y-3">
              <Icon name="table_restaurant" size={48} className="mx-auto text-slate-600" />
              <div className="text-lg font-black uppercase text-slate-300">
                No hay comandas registradas en mesas aún
              </div>
              <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto">
                Cuando las mozas tomen pedidos para mesas (1 al 20) quedarán registradas aquí con sus clientes y propinas.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {waiterStats.map(w => (
                <div
                  key={w.name}
                  className="bg-[#090314] border border-purple-500/30 rounded-[32px] p-6 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center font-black text-base border border-purple-500/30">
                        <Icon name="person" size={22} />
                      </div>
                      <div>
                        <div className="font-black text-base text-white uppercase">{w.name}</div>
                        <div className="text-[10px] font-bold text-purple-400">
                          {w.orderCount} comandas • {w.tables.size} mesas atendidas
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-[#040108] p-3 rounded-2xl border border-purple-500/20">
                      <div className="text-[9px] font-black uppercase text-slate-400">Total Facturado</div>
                      <div className="text-lg font-black text-white">${w.totalSales}</div>
                    </div>
                    <div className="bg-[#040108] p-3 rounded-2xl border border-emerald-500/30">
                      <div className="text-[9px] font-black uppercase text-emerald-400">Propinas</div>
                      <div className="text-lg font-black text-emerald-300">${w.totalTips}</div>
                    </div>
                  </div>

                  {/* Mesas List */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                      <Icon name="table_restaurant" size={13} /> Mesas:
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(w.tables).map(t => (
                        <span key={t} className="px-2.5 py-1 bg-purple-950/80 border border-purple-500/30 rounded-xl text-[10px] font-mono font-black text-purple-200">
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
            <div className="bg-[#090314] border border-purple-500/20 rounded-[32px] p-6 space-y-4 overflow-x-auto">
              <h3 className="font-black text-base uppercase text-white flex items-center gap-2">
                <Icon name="list_alt" size={18} className="text-purple-400" /> Detalle de Mesas y Clientes Atendidos
              </h3>
              <table className="w-full text-left text-xs font-bold">
                <thead>
                  <tr className="border-b border-purple-500/20 text-[10px] font-black uppercase text-slate-400">
                    <th className="pb-3">Comanda</th>
                    <th className="pb-3">Mesa</th>
                    <th className="pb-3">Moza / Mozo</th>
                    <th className="pb-3">Cliente en Mesa</th>
                    <th className="pb-3">Total</th>
                    <th className="pb-3 text-emerald-400">Propina</th>
                    <th className="pb-3">Estado</th>
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
                      <td className="py-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                          order.status === 'Finalizado'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* SECTION 2: DELIVERIES (FEFO, CAETANO, SAMUEL) */}
      {activeSubTab === 'drivers' && (
        <div className="space-y-6">
          {driverStats.length === 0 ? (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[36px] p-12 text-center space-y-3">
              <Icon name="two_wheeler" size={48} className="mx-auto text-slate-600" />
              <div className="text-lg font-black uppercase text-slate-300">
                No hay envíos registrados aún
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {driverStats.map(d => (
                <div
                  key={d.name}
                  className="bg-[#090314] border border-cyan-500/30 rounded-[32px] p-6 shadow-xl space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 text-cyan-300 flex items-center justify-center font-black text-base border border-cyan-500/30">
                        <Icon name="two_wheeler" size={22} />
                      </div>
                      <div>
                        <div className="font-black text-base text-white uppercase">🏍️ {d.name}</div>
                        <div className="text-[10px] font-bold text-cyan-400">
                          {d.orderCount} asignados • {d.deliveredCount} entregados
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-[#040108] p-3 rounded-2xl border border-purple-500/20">
                      <div className="text-[9px] font-black uppercase text-slate-400">Total Cobrado</div>
                      <div className="text-lg font-black text-white">${d.totalCollected}</div>
                    </div>
                    <div className="bg-[#040108] p-3 rounded-2xl border border-emerald-500/30">
                      <div className="text-[9px] font-black uppercase text-emerald-400">Propinas</div>
                      <div className="text-lg font-black text-emerald-300">${d.totalTips}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Delivery Audit Table */}
          {driverStats.length > 0 && (
            <div className="bg-[#090314] border border-purple-500/20 rounded-[32px] p-6 space-y-4 overflow-x-auto">
              <h3 className="font-black text-base uppercase text-white flex items-center gap-2">
                <Icon name="two_wheeler" size={18} className="text-cyan-400" /> Detalle de Repartos y Propinas
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
                    <th className="pb-3">Estado</th>
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
                      <td className="py-3">
                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${
                          order.status === 'Finalizado'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/30'
                            : 'bg-cyan-950 text-cyan-300 border border-cyan-500/30'
                        }`}>
                          {order.status}
                        </span>
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
