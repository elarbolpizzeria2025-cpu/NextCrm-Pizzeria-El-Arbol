import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { GoogleDeliveryMap } from './GoogleDeliveryMap';
import { doc, updateDoc } from 'firebase/firestore';

export interface DeliveryOrder {
  firestoreId: string;
  id: string;
  items: Array<{
    name: string;
    quantity: number;
    price?: number;
    finalPrice?: number;
    selectedToppings?: Array<{ name: string; price: number }>;
  }>;
  type: string;
  paymentMethod: string;
  total: number;
  tip?: number;
  status: 'Pendiente' | 'Preparando' | 'Listo' | 'En Camino' | 'Finalizado' | 'Cancelado';
  createdAt: number;
  client?: {
    name?: string;
    phone?: string;
    address?: string;
    zone?: string;
  };
  notes?: string;
  assignedDriver?: string;
  assignedDriverId?: string;
  deliveredAt?: number;
  onWayAt?: number;
}

export const DELIVERY_DRIVERS = [
  { id: 'delivery1', name: 'Fefo', number: 1, color: 'border-purple-500 bg-purple-950/40 text-purple-200 hover:bg-purple-900/60' },
  { id: 'delivery2', name: 'Caetano', number: 2, color: 'border-cyan-500 bg-cyan-950/40 text-cyan-200 hover:bg-cyan-900/60' },
  { id: 'delivery3', name: 'Samuel', number: 3, color: 'border-amber-500 bg-amber-950/40 text-amber-200 hover:bg-amber-900/60' },
];

interface DeliveryRiderTabProps {
  orders: DeliveryOrder[];
  db: any;
  appId: string;
  currentUser: {
    username: string;
    role: 'admin' | 'cajero' | 'mozo' | 'delivery';
    displayName: string;
  };
  showMessage: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export const DeliveryRiderTab: React.FC<DeliveryRiderTabProps> = ({
  orders,
  db,
  appId,
  currentUser,
  showMessage
}) => {
  const isDriverUser = currentUser.role === 'delivery';

  // Determine the delivery driver's specific display name / id
  const myDriverName = useMemo(() => {
    const u = (currentUser.username || '').toLowerCase();
    const d = (currentUser.displayName || '').toLowerCase();
    if (u.includes('fefo') || d.includes('fefo') || u === 'delivery1') return 'Fefo';
    if (u.includes('caetano') || d.includes('caetano') || u === 'delivery2') return 'Caetano';
    if (u.includes('samuel') || d.includes('samuel') || u === 'delivery3') return 'Samuel';
    return currentUser.displayName.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚ]/g, '').trim() || currentUser.username;
  }, [currentUser]);

  const [filterState, setFilterState] = useState<'all' | 'ready' | 'on_way' | 'delivered'>('ready');
  const [driverFilter, setDriverFilter] = useState<string>(() => {
    if (isDriverUser) return myDriverName;
    return 'ALL';
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Modal to assign driver (Fefo, Caetano, Samuel)
  const [assignModal, setAssignModal] = useState<{
    isOpen: boolean;
    order: DeliveryOrder | null;
  }>({
    isOpen: false,
    order: null
  });

  // Filter only delivery / envio orders
  const deliveryOrders = useMemo(() => {
    return orders.filter(o => {
      const safeType = String(o.type || '').trim().toLowerCase();
      return ['envío', 'envio', 'delivery', 'reparto'].includes(safeType);
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return deliveryOrders.filter(o => {
      // STRICT DELIVERY ISOLATION: A delivery driver ONLY sees their own assigned orders or unassigned ready orders
      if (isDriverUser) {
        const isAssignedToMe = (o.assignedDriver || '').toLowerCase() === myDriverName.toLowerCase();
        const isUnassignedReady = !o.assignedDriver && (o.status === 'Listo' || o.status === 'Preparando' || o.status === 'Pendiente');
        if (!isAssignedToMe && !isUnassignedReady) return false;
      } else {
        // Admin / Cajero: apply driverFilter selector
        if (driverFilter !== 'ALL') {
          if (driverFilter === 'UNASSIGNED') {
            if (o.assignedDriver) return false;
          } else {
            if ((o.assignedDriver || '').toLowerCase() !== driverFilter.toLowerCase()) return false;
          }
        }
      }

      // Status filter
      if (filterState === 'ready' && (o.status !== 'Pendiente' && o.status !== 'Preparando' && o.status !== 'Listo')) return false;
      if (filterState === 'on_way' && o.status !== 'En Camino') return false;
      if (filterState === 'delivered' && o.status !== 'Finalizado') return false;

      // Search filter (address, name, phone, id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (o.client?.name || '').toLowerCase().includes(q);
        const matchesAddress = (o.client?.address || '').toLowerCase().includes(q);
        const matchesPhone = (o.client?.phone || '').includes(q);
        const matchesId = (o.id || '').toLowerCase().includes(q);
        const matchesDriver = (o.assignedDriver || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesPhone && !matchesId && !matchesDriver) return false;
      }

      return true;
    });
  }, [deliveryOrders, filterState, driverFilter, searchQuery, isDriverUser, myDriverName]);

  const counts = useMemo(() => {
    const baseList = isDriverUser 
      ? deliveryOrders.filter(o => (o.assignedDriver || '').toLowerCase() === myDriverName.toLowerCase() || (!o.assignedDriver && (o.status === 'Listo' || o.status === 'Preparando' || o.status === 'Pendiente')))
      : deliveryOrders;

    return {
      all: baseList.length,
      ready: baseList.filter(o => o.status === 'Pendiente' || o.status === 'Preparando' || o.status === 'Listo').length,
      on_way: baseList.filter(o => o.status === 'En Camino').length,
      delivered: baseList.filter(o => o.status === 'Finalizado').length,
      fefo: deliveryOrders.filter(o => (o.assignedDriver || '').toLowerCase() === 'fefo' && o.status !== 'Finalizado').length,
      caetano: deliveryOrders.filter(o => (o.assignedDriver || '').toLowerCase() === 'caetano' && o.status !== 'Finalizado').length,
      samuel: deliveryOrders.filter(o => (o.assignedDriver || '').toLowerCase() === 'samuel' && o.status !== 'Finalizado').length,
    };
  }, [deliveryOrders, isDriverUser, myDriverName]);

  // Status transitions & driver assignment
  const handleAssignDriverAndSend = async (order: DeliveryOrder, driverName: string, driverId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        status: 'En Camino',
        assignedDriver: driverName,
        assignedDriverId: driverId,
        onWayAt: Date.now()
      });
      setAssignModal({ isOpen: false, order: null });
      showMessage(`🏍️ Pedido #${order.id} asignado a ${driverName} y puesto "En Camino"`, 'success');
    } catch (e: any) {
      showMessage(`Error al asignar repartidor: ${e.message}`, 'error');
    }
  };

  const handleMarkDelivered = async (order: DeliveryOrder) => {
    if (!window.confirm(`¿Confirmar entrega y cobro del pedido #${order.id} por $${order.total}?`)) return;
    if (!db) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        status: 'Finalizado',
        deliveredAt: Date.now()
      });
      showMessage(`✅ ¡Pedido #${order.id} entregado con éxito!`, 'success');
    } catch (e: any) {
      showMessage(`Error al finalizar pedido: ${e.message}`, 'error');
    }
  };

  const notifyClientWhatsApp = (order: DeliveryOrder) => {
    const rawPhone = (order.client?.phone || '').replace(/\D/g, '');
    if (!rawPhone) {
      showMessage('El cliente no tiene teléfono registrado', 'info');
      return;
    }
    const driverName = order.assignedDriver || currentUser.displayName.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚ]/g, '').trim() || 'el repartidor';
    const msg = `¡Hola ${order.client?.name || ''}! 👋 Tu pedido *#${order.id}* de *Pizzería El Árbol* ya va en camino con ${driverName} 🛵💨.\n\n📍 Destino: ${order.client?.address || ''}\n💰 Total a abonar: $${order.total} (${order.paymentMethod || 'Efectivo'})\n\n¡Muchas gracias por tu compra!`;
    const cleanNumber = rawPhone.startsWith('598') ? rawPhone : `598${rawPhone.replace(/^0/, '')}`;
    window.open(`https://wa.me/${cleanNumber}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 min-h-screen">
      {/* Header Banner for Delivery Fleet */}
      <div className="bg-[#090314] border-2 border-purple-500/30 rounded-[36px] p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-purple-600/40 shrink-0">
            <div className="w-full h-full bg-[#090314] rounded-[22px] flex items-center justify-center">
              <Icon name="two_wheeler" size={32} className="text-purple-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">
                Ruta & Despacho Delivery
              </h1>
              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40">
                GPS LIVE
              </span>
            </div>
            <p className="text-xs font-bold text-slate-400 mt-0.5">
              Conectado como: <strong className="text-purple-300">{currentUser.displayName}</strong> • {counts.ready + counts.on_way} envíos activos
            </p>
          </div>
        </div>

        {/* Quick Search */}
        <div className="w-full md:w-72">
          <div className="relative">
            <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar dirección, cliente, repartidor, #"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 bg-[#040108] border border-purple-500/30 rounded-2xl text-xs font-bold text-white outline-none focus:border-purple-400 placeholder:text-slate-500"
            />
          </div>
        </div>
      </div>

      {/* Driver Filter Badges: FEFO, CAETANO, SAMUEL (Only for Admin / Cajero) or Driver Private Badge */}
      {isDriverUser ? (
        <div className="bg-[#090314] border border-cyan-500/40 rounded-3xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg shadow-cyan-950/30">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950 text-cyan-300 border border-cyan-500/40 flex items-center justify-center font-black text-base shrink-0">
              🛵
            </div>
            <div>
              <div className="font-black text-xs uppercase text-white flex items-center gap-2">
                <span>Mi Hoja de Ruta Privada • {myDriverName}</span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 border border-cyan-500/40 text-[9px] font-mono">
                  SOLO MIS PEDIDOS
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">
                Tus pedidos asignados. Al llegar a la dirección del cliente, pulsa "Marcar como Entregado" para reportarlo al sistema.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-cyan-950/80 text-cyan-300 border border-cyan-500/30 font-mono text-xs font-black">
              {counts.on_way} en camino • {counts.delivered} entregados
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-[#090314] border border-purple-500/20 rounded-3xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-black uppercase text-slate-300">
            <Icon name="two_wheeler" size={16} className="text-purple-400" />
            <span>Control de Flota Repartidores (Admin):</span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setDriverFilter('ALL')}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all cursor-pointer border ${
                driverFilter === 'ALL'
                  ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-md'
                  : 'bg-[#040108] text-slate-400 border-purple-500/20 hover:text-white'
              }`}
            >
              Todos los Repartidores
            </button>

            {DELIVERY_DRIVERS.map(driver => {
              const isSelected = driverFilter.toLowerCase() === driver.name.toLowerCase();
              const count = counts[driver.name.toLowerCase() as keyof typeof counts] || 0;
              return (
                <button
                  key={driver.id}
                  onClick={() => setDriverFilter(driver.name)}
                  className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-md'
                      : 'bg-[#040108] text-slate-300 border-purple-500/20 hover:border-purple-400 hover:text-white'
                  }`}
                >
                  <span>🏍️ #{driver.number} {driver.name}</span>
                  <span className={`px-1.5 py-0.2 rounded-md text-[10px] font-black ${isSelected ? 'bg-slate-950/30 text-white' : 'bg-purple-950 text-purple-300 border border-purple-500/30'}`}>
                    {count}
                  </span>
                </button>
              );
            })}

            <button
              onClick={() => setDriverFilter('UNASSIGNED')}
              className={`px-3.5 py-1.5 rounded-xl font-black text-xs uppercase transition-all cursor-pointer border ${
                driverFilter === 'UNASSIGNED'
                  ? 'bg-amber-500 text-slate-950 border-amber-400 shadow-md'
                  : 'bg-[#040108] text-amber-300/80 border-amber-500/20 hover:text-amber-200'
              }`}
            >
              ⚠️ Sin Asignar
            </button>
          </div>
        </div>
      )}

      {/* Filter Tabs Pills (Status) */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { id: 'ready', label: 'Listos / En Cocina', count: counts.ready, icon: 'inventory_2', color: 'text-amber-300' },
          { id: 'on_way', label: 'En Camino / En Ruta', count: counts.on_way, icon: 'two_wheeler', color: 'text-cyan-300' },
          { id: 'delivered', label: 'Entregados Hoy', count: counts.delivered, icon: 'check_circle', color: 'text-emerald-300' },
          { id: 'all', label: 'Todos los Envíos', count: counts.all, icon: 'list_alt', color: 'text-purple-300' },
        ].map(tab => {
          const isActive = filterState === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterState(tab.id as any)}
              className={`px-5 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all cursor-pointer border ${
                isActive
                  ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-lg shadow-purple-600/30'
                  : 'bg-[#090314] text-slate-300 border-purple-500/20 hover:border-purple-500/40 hover:bg-[#120726]'
              }`}
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
              <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black ${isActive ? 'bg-slate-950/30 text-white' : 'bg-[#040108] text-purple-300 border border-purple-500/20'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-[#090314] border border-purple-500/20 rounded-[36px] p-12 text-center space-y-3">
          <Icon name="two_wheeler" size={48} className="mx-auto text-slate-600" />
          <div className="text-lg font-black uppercase text-slate-300">
            No hay pedidos de delivery en esta sección
          </div>
          <p className="text-xs font-bold text-slate-500 max-w-sm mx-auto">
            Cuando se tomen nuevos pedidos con entrega a domicilio aparecerán automáticamente aquí con su dirección y mapa de ruta.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredOrders.map(order => {
            const isExpanded = expandedOrderId === order.firestoreId;
            const itemsSummary = order.items.map(it => `${it.quantity || 1}x ${it.name}`).join(', ');
            const timeAgoMins = Math.floor((Date.now() - order.createdAt) / 60000);

            return (
              <div
                key={order.firestoreId}
                className={`bg-[#090314] border rounded-[36px] p-6 shadow-xl space-y-4 transition-all flex flex-col justify-between ${
                  order.status === 'En Camino'
                    ? 'border-cyan-500/60 bg-[#070b1a] shadow-cyan-950/30'
                    : order.status === 'Finalizado'
                    ? 'border-emerald-500/30 opacity-80'
                    : order.status === 'Listo'
                    ? 'border-emerald-500/60 bg-[#081512] shadow-emerald-950/30 ring-1 ring-emerald-500/40'
                    : 'border-purple-500/30 hover:border-purple-500/60'
                }`}
              >
                <div className="space-y-4">
                  {/* Top Bar: Order ID, Status, Assigned Driver Badge */}
                  <div className="flex items-start justify-between gap-3 border-b border-purple-500/10 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-black text-sm bg-purple-600 text-slate-950 px-3 py-1 rounded-xl shadow-xs font-mono">
                        #{order.id}
                      </span>
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-xl border ${
                        order.status === 'En Camino'
                          ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50 animate-pulse'
                          : order.status === 'Finalizado'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50'
                          : order.status === 'Listo'
                          ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50 animate-pulse font-black'
                          : 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                      }`}>
                        {order.status === 'En Camino' 
                          ? '🏍️ En Camino' 
                          : order.status === 'Finalizado' 
                          ? '✅ Entregado' 
                          : order.status === 'Listo'
                          ? '🔥 Listo en Cocina (Pronto para Enviar)'
                          : '⏳ En Preparación'}
                      </span>

                      {order.assignedDriver && (
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-purple-950 text-purple-200 border border-purple-500/40 flex items-center gap-1">
                          <Icon name="two_wheeler" size={13} /> {order.assignedDriver}
                        </span>
                      )}
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase text-slate-400">
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="text-[10px] font-bold text-purple-400">
                        hace {timeAgoMins} min
                      </div>
                    </div>
                  </div>

                  {/* Customer Information & Actions */}
                  <div className="bg-[#040108] p-4 rounded-2xl border border-purple-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="font-black text-sm uppercase text-white flex items-center gap-2">
                        <Icon name="person" size={16} className="text-purple-400" />
                        <span>{order.client?.name || 'Cliente Particular'}</span>
                      </div>
                      {order.client?.phone && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => notifyClientWhatsApp(order)}
                            className="px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer"
                            title="Enviar WhatsApp con aviso de entrega"
                          >
                            <Icon name="chat" size={13} /> WhatsApp
                          </button>
                          <a
                            href={`tel:${order.client.phone}`}
                            className="p-1.5 bg-[#160829] hover:bg-[#220c40] border border-purple-500/30 text-purple-300 rounded-xl text-xs transition-all"
                            title="Llamar al cliente"
                          >
                            <Icon name="call" size={14} />
                          </a>
                        </div>
                      )}
                    </div>

                    {order.client?.phone && (
                      <div className="text-xs font-mono font-bold text-purple-300">
                        📞 {order.client.phone}
                      </div>
                    )}
                  </div>

                  {/* Interactive Map & Address Section with Turn-by-Turn GPS */}
                  <GoogleDeliveryMap
                    address={order.client?.address || ''}
                    zone={order.client?.zone || ''}
                    clientName={order.client?.name || ''}
                    clientPhone={order.client?.phone || ''}
                    orderDetails={{
                      orderId: order.id,
                      itemsSummary,
                      totalAmount: order.total,
                      paymentMethod: order.paymentMethod
                    }}
                    showMessage={showMessage}
                  />

                  {/* Order Items Summary */}
                  <div className="bg-[#040108] p-3.5 rounded-2xl border border-purple-500/20 space-y-2">
                    <button
                      type="button"
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.firestoreId)}
                      className="w-full flex items-center justify-between text-xs font-black uppercase text-slate-300 cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Icon name="receipt_long" size={15} className="text-purple-400" />
                        <span>Detalle de Comida ({order.items.length} productos)</span>
                      </span>
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} className="text-purple-400" />
                    </button>

                    {isExpanded ? (
                      <ul className="text-xs space-y-1.5 pt-2 border-t border-purple-500/10">
                        {order.items.map((it, idx) => (
                          <li key={idx} className="flex justify-between items-start text-slate-200">
                            <div>
                              <span className="font-black text-purple-300">{it.quantity || 1}x</span> {it.name}
                              {it.selectedToppings && it.selectedToppings.length > 0 && (
                                <div className="text-[10px] text-purple-400 font-bold italic">
                                  + {it.selectedToppings.map(t => t.name).join(', ')}
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-slate-400">${(it.finalPrice || it.price || 0) * (it.quantity || 1)}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] font-medium text-slate-400 truncate">
                        {itemsSummary}
                      </div>
                    )}

                    {order.notes && (
                      <div className="text-[10px] font-bold text-amber-300/90 bg-amber-950/30 p-2 rounded-xl border border-amber-500/20">
                        ⚠️ Nota: {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Payment & Total Banner */}
                  <div className="flex items-center justify-between bg-[#040108] p-3.5 rounded-2xl border border-purple-500/20">
                    <div>
                      <div className="text-[9px] font-black uppercase text-slate-400">Medio de Pago</div>
                      <div className="text-xs font-black uppercase text-purple-300">{order.paymentMethod || 'Efectivo'}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[9px] font-black uppercase text-slate-400">Total a Cobrar</div>
                      <div className="text-2xl font-black text-white">${order.total}</div>
                    </div>
                  </div>
                </div>

                {/* Delivery Driver Action Progression Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                  {order.status !== 'En Camino' && order.status !== 'Finalizado' && (
                    isDriverUser ? (
                      <button
                        type="button"
                        onClick={() => handleAssignDriverAndSend(order, myDriverName, currentUser.username)}
                        className="w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer col-span-1 sm:col-span-2"
                      >
                        <Icon name="two_wheeler" size={18} />
                        <span>🛵 Tomar este Pedido y Salir en Ruta</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setAssignModal({ isOpen: true, order })}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-purple-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer col-span-1 sm:col-span-2"
                      >
                        <Icon name="two_wheeler" size={18} />
                        <span>{order.assignedDriver ? `Reasignar Repartidor (${order.assignedDriver})` : '🛵 Elegir Repartidor y Enviar'}</span>
                      </button>
                    )
                  )}

                  {order.status === 'En Camino' && (
                    <>
                      <button
                        type="button"
                        onClick={() => notifyClientWhatsApp(order)}
                        className="py-3.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <Icon name="chat" size={16} className="text-emerald-400" />
                        <span>Avisar WhatsApp</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarkDelivered(order)}
                        className="py-3.5 bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black rounded-2xl uppercase text-xs shadow-xl shadow-emerald-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400"
                      >
                        <Icon name="check_circle" size={18} />
                        <span>✅ Marcar como Entregado (${order.total})</span>
                      </button>
                    </>
                  )}

                  {order.status === 'Finalizado' && (
                    <div className="col-span-1 sm:col-span-2 py-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center text-xs font-black uppercase text-emerald-300 flex items-center justify-center gap-2">
                      <Icon name="check_circle" size={16} />
                      <span>Pedido Entregado y Reportado al Sistema</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Asignar a Fefo, Caetano o Samuel */}
      {assignModal.isOpen && assignModal.order && (
        <div className="fixed inset-0 z-[10000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#090314] border-2 border-purple-500/50 rounded-[36px] max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl animate-in zoom-in-95 text-center">
            <div className="space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-purple-600/20 text-purple-300 flex items-center justify-center mx-auto border border-purple-500/40">
                <Icon name="two_wheeler" size={32} />
              </div>
              <h3 className="text-xl font-black uppercase text-white">
                ¿A qué Delivery se lo vas a enviar?
              </h3>
              <p className="text-xs font-bold text-slate-400">
                Pedido <strong className="text-purple-300">#{assignModal.order.id}</strong> • Destino: <strong className="text-white">{assignModal.order.client?.address || 'Sin dirección'}</strong>
              </p>
            </div>

            <div className="space-y-3">
              {DELIVERY_DRIVERS.map(driver => (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => handleAssignDriverAndSend(assignModal.order!, driver.name, driver.id)}
                  className={`w-full p-4 rounded-2xl border-2 flex items-center justify-between font-black text-sm uppercase transition-all cursor-pointer shadow-lg ${driver.color}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center text-lg font-black font-mono">
                      #{driver.number}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-black text-white">{driver.name}</div>
                      <div className="text-[10px] font-bold text-slate-400">Usuario: {driver.id}</div>
                    </div>
                  </div>
                  <span className="text-xs px-3 py-1 bg-white/10 rounded-xl font-black">
                    ASIGNAR 🛵
                  </span>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setAssignModal({ isOpen: false, order: null })}
              className="w-full py-3 bg-[#120726] hover:bg-[#1a0c36] text-slate-400 hover:text-white rounded-2xl font-black text-xs uppercase transition-all cursor-pointer border border-purple-500/20"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
