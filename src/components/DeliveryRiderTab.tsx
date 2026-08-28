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
  status: 'Pendiente' | 'Preparando' | 'En Camino' | 'Finalizado' | 'Cancelado';
  createdAt: number;
  client?: {
    name?: string;
    phone?: string;
    address?: string;
    zone?: string;
  };
  notes?: string;
  assignedDriver?: string;
  deliveredAt?: number;
}

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
  const [filterState, setFilterState] = useState<'all' | 'ready' | 'on_way' | 'delivered'>('ready');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Filter only delivery / envio orders
  const deliveryOrders = useMemo(() => {
    return orders.filter(o => {
      const safeType = String(o.type || '').trim().toLowerCase();
      return ['envío', 'envio', 'delivery', 'reparto'].includes(safeType);
    });
  }, [orders]);

  const filteredOrders = useMemo(() => {
    return deliveryOrders.filter(o => {
      // Status filter
      if (filterState === 'ready' && (o.status !== 'Pendiente' && o.status !== 'Preparando')) return false;
      if (filterState === 'on_way' && o.status !== 'En Camino') return false;
      if (filterState === 'delivered' && o.status !== 'Finalizado') return false;

      // Search filter (address, name, phone, id)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (o.client?.name || '').toLowerCase().includes(q);
        const matchesAddress = (o.client?.address || '').toLowerCase().includes(q);
        const matchesPhone = (o.client?.phone || '').includes(q);
        const matchesId = (o.id || '').toLowerCase().includes(q);
        if (!matchesName && !matchesAddress && !matchesPhone && !matchesId) return false;
      }

      return true;
    });
  }, [deliveryOrders, filterState, searchQuery]);

  const counts = useMemo(() => {
    return {
      all: deliveryOrders.length,
      ready: deliveryOrders.filter(o => o.status === 'Pendiente' || o.status === 'Preparando').length,
      on_way: deliveryOrders.filter(o => o.status === 'En Camino').length,
      delivered: deliveryOrders.filter(o => o.status === 'Finalizado').length,
    };
  }, [deliveryOrders]);

  // Status transitions
  const handleStartDelivery = async (order: DeliveryOrder) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        status: 'En Camino',
        assignedDriver: currentUser.displayName || currentUser.username,
        onWayAt: Date.now()
      });
      showMessage(🏍️ Pedido # marcado En Camino);
    } catch (e: any) {
      showMessage(Error al actualizar estado: , 'error');
    }
  };

  const handleMarkDelivered = async (order: DeliveryOrder) => {
    if (!window.confirm(¿Confirmar entrega y cobro del pedido # por {order.total}?)) return;
    if (!db) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        status: 'Finalizado',
        deliveredAt: Date.now()
      });
      showMessage(✅ ¡Pedido # entregado con éxito!);
    } catch (e: any) {
      showMessage(Error al finalizar pedido: , 'error');
    }
  };

  const notifyClientWhatsApp = (order: DeliveryOrder) => {
    const rawPhone = (order.client?.phone || '').replace(/\D/g, '');
    if (!rawPhone) {
      showMessage('El cliente no tiene teléfono registrado', 'info');
      return;
    }
    const driverName = currentUser.displayName.replace(/[^a-zA-Z0-9 áéíóúÁÉÍÓÚ]/g, '').trim() || 'el repartidor';
    const msg = ¡Hola ! 👋 Tu pedido *#* de *Pizzería El Árbol* ya va en camino con  🛵💨.\n\n📍 Destino: \n💰 Total a abonar: {order.total} ()\n\n¡Muchas gracias por tu compra!;
    const cleanNumber = rawPhone.startsWith('598') ? rawPhone : 598;
    window.open(https://wa.me/?text=, '_blank');
  };

  return (
    <div className=p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6 text-slate-100 min-h-screen>
      {/* Header Banner for Delivery Fleet */}
      <div className=bg-[#090314] border-2 border-purple-500/30 rounded-[36px] p-6 sm:p-8 shadow-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4>
        <div className=flex items-center gap-4>
          <div className=w-16 h-16 rounded-3xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-purple-600/40 shrink-0>
            <div className=w-full h-full bg-[#090314] rounded-[22px] flex items-center justify-center>
              <Icon name=two_wheeler size={32} className=text-purple-300 />
            </div>
          </div>
          <div>
            <div className=flex items-center gap-2>
              <h1 className=text-2xl sm:text-3xl font-black uppercase text-white tracking-tight>
                Ruta & Despacho Delivery
              </h1>
              <span className=text-[10px] font-black uppercase px-2.5 py-1 rounded-xl bg-purple-950 text-purple-300 border border-purple-500/40>
                GPS LIVE
              </span>
            </div>
            <p className=text-xs font-bold text-slate-400 mt-0.5>
              Conectado como: <strong className=text-purple-300>{currentUser.displayName}</strong> • {counts.ready + counts.on_way} envíos activos
            </p>
          </div>
        </div>

        {/* Quick Search */}
        <div className=w-full md:w-72>
          <div className=relative>
            <Icon name=search size={18} className=absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 />
            <input
              type=text
              placeholder=Buscar dirección, cliente, #
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className=w-full pl-11 pr-4 py-3 bg-[#040108] border border-purple-500/30 rounded-2xl text-xs font-bold text-white outline-none focus:border-purple-400 placeholder:text-slate-500
            />
          </div>
        </div>
      </div>

      {/* Filter Tabs Pills */}
      <div className=flex flex-wrap gap-2.5>
        {[
          { id: 'ready', label: 'Listos para Salir', count: counts.ready, icon: 'inventory_2', color: 'text-amber-300' },
          { id: 'on_way', label: 'En Camino / En Ruta', count: counts.on_way, icon: 'two_wheeler', color: 'text-cyan-300' },
          { id: 'delivered', label: 'Entregados Hoy', count: counts.delivered, icon: 'check_circle', color: 'text-emerald-300' },
          { id: 'all', label: 'Todos los Envíos', count: counts.all, icon: 'list_alt', color: 'text-purple-300' },
        ].map(tab => {
          const isActive = filterState === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setFilterState(tab.id as any)}
              className={px-5 py-3 rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all cursor-pointer border }
            >
              <Icon name={tab.icon} size={16} />
              <span>{tab.label}</span>
              <span className={px-2 py-0.5 rounded-lg text-[10px] font-black }>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Orders Grid */}
      {filteredOrders.length === 0 ? (
        <div className=bg-[#090314] border border-purple-500/20 rounded-[36px] p-12 text-center space-y-3>
          <Icon name=two_wheeler size={48} className=mx-auto text-slate-600 />
          <div className=text-lg font-black uppercase text-slate-300>
            No hay pedidos de delivery en esta sección
          </div>
          <p className=text-xs font-bold text-slate-500 max-w-sm mx-auto>
            Cuando se tomen nuevos pedidos con entrega a domicilio aparecerán automáticamente aquí con su dirección y mapa de ruta.
          </p>
        </div>
      ) : (
        <div className=grid grid-cols-1 lg:grid-cols-2 gap-6>
          {filteredOrders.map(order => {
            const isExpanded = expandedOrderId === order.firestoreId;
            const itemsSummary = order.items.map(it => ${it.quantity || 1}x ).join(', ');
            const timeAgoMins = Math.floor((Date.now() - order.createdAt) / 60000);

            return (
              <div
                key={order.firestoreId}
                className={g-[#090314] border rounded-[36px] p-6 shadow-xl space-y-4 transition-all flex flex-col justify-between }
              >
                <div className=space-y-4>
                  {/* Top Bar: Order ID, Status, Timer */}
                  <div className=flex items-start justify-between gap-3 border-b border-purple-500/10 pb-3>
                    <div className=flex items-center gap-2.5>
                      <span className=font-black text-sm bg-purple-600 text-slate-950 px-3 py-1 rounded-xl shadow-xs font-mono>
                        #{order.id}
                      </span>
                      <span className={	ext-[10px] font-black uppercase px-2.5 py-1 rounded-xl border }>
                        {order.status === 'En Camino' ? '🏍️ En Camino' : order.status === 'Finalizado' ? '✅ Entregado' : '⏳ Listo / En Preparación'}
                      </span>
                    </div>

                    <div className=text-right>
                      <div className=text-[10px] font-black uppercase text-slate-400>
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className=text-[10px] font-bold text-purple-400>
                        hace {timeAgoMins} min
                      </div>
                    </div>
                  </div>

                  {/* Customer Information & Actions */}
                  <div className=bg-[#040108] p-4 rounded-2xl border border-purple-500/20 space-y-2>
                    <div className=flex items-center justify-between>
                      <div className=font-black text-sm uppercase text-white flex items-center gap-2>
                        <Icon name=person size={16} className=text-purple-400 />
                        <span>{order.client?.name || 'Cliente Particular'}</span>
                      </div>
                      {order.client?.phone && (
                        <div className=flex items-center gap-2>
                          <button
                            onClick={() => notifyClientWhatsApp(order)}
                            className=px-2.5 py-1 bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/40 text-emerald-300 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer
                            title=Enviar WhatsApp con aviso de entrega
                          >
                            <Icon name=chat size={13} /> WhatsApp
                          </button>
                          <a
                            href={	el:}
                            className=p-1.5 bg-[#160829] hover:bg-[#220c40] border border-purple-500/30 text-purple-300 rounded-xl text-xs transition-all
                            title=Llamar al cliente
                          >
                            <Icon name=call size={14} />
                          </a>
                        </div>
                      )}
                    </div>

                    {order.client?.phone && (
                      <div className=text-xs font-mono font-bold text-purple-300>
                        📞 {order.client.phone}
                      </div>
                    )}
                  </div>

                  {/* Interactive Map & Address Section */}
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

                  {/* Order Items Accordion / Summary */}
                  <div className=bg-[#040108] p-3.5 rounded-2xl border border-purple-500/20 space-y-2>
                    <button
                      type=button
                      onClick={() => setExpandedOrderId(isExpanded ? null : order.firestoreId)}
                      className=w-full flex items-center justify-between text-xs font-black uppercase text-slate-300 cursor-pointer
                    >
                      <span className=flex items-center gap-1.5>
                        <Icon name=receipt_long size={15} className=text-purple-400 />
                        <span>Detalle de Comida ({order.items.length} productos)</span>
                      </span>
                      <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={18} className=text-purple-400 />
                    </button>

                    {isExpanded ? (
                      <ul className=text-xs space-y-1.5 pt-2 border-t border-purple-500/10>
                        {order.items.map((it, idx) => (
                          <li key={idx} className=flex justify-between items-start text-slate-200>
                            <div>
                              <span className=font-black text-purple-300>{it.quantity || 1}x</span> {it.name}
                              {it.selectedToppings && it.selectedToppings.length > 0 && (
                                <div className=text-[10px] text-purple-400 font-bold italic>
                                  + {it.selectedToppings.map(t => t.name).join(', ')}
                                </div>
                              )}
                            </div>
                            <span className=font-bold text-slate-400></span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className=text-[11px] font-medium text-slate-400 truncate>
                        {itemsSummary}
                      </div>
                    )}

                    {order.notes && (
                      <div className=text-[10px] font-bold text-amber-300/90 bg-amber-950/30 p-2 rounded-xl border border-amber-500/20>
                        ⚠️ Nota: {order.notes}
                      </div>
                    )}
                  </div>

                  {/* Payment & Total Banner */}
                  <div className=flex items-center justify-between bg-[#040108] p-3.5 rounded-2xl border border-purple-500/20>
                    <div>
                      <div className=text-[9px] font-black uppercase text-slate-400>Medio de Pago</div>
                      <div className=text-xs font-black uppercase text-purple-300>{order.paymentMethod || 'Efectivo'}</div>
                    </div>
                    <div className=text-right>
                      <div className=text-[9px] font-black uppercase text-slate-400>Total a Cobrar</div>
                      <div className=text-2xl font-black text-white></div>
                    </div>
                  </div>
                </div>

                {/* Delivery Driver Action Progression Buttons */}
                <div className=grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2>
                  {order.status !== 'En Camino' && order.status !== 'Finalizado' && (
                    <button
                      type=button
                      onClick={() => handleStartDelivery(order)}
                      className=w-full py-3.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-cyan-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer col-span-1 sm:col-span-2
                    >
                      <Icon name=two_wheeler size={18} />
                      <span>Iniciar Entrega (En Camino)</span>
                    </button>
                  )}

                  {order.status === 'En Camino' && (
                    <>
                      <button
                        type=button
                        onClick={() => notifyClientWhatsApp(order)}
                        className=py-3.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 cursor-pointer
                      >
                        <Icon name=chat size={16} className=text-emerald-400 />
                        <span>Avisar WhatsApp</span>
                      </button>
                      <button
                        type=button
                        onClick={() => handleMarkDelivered(order)}
                        className=py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-slate-950 font-black rounded-2xl uppercase text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer
                      >
                        <Icon name=check_circle size={18} />
                        <span>Entregado y Cobrado</span>
                      </button>
                    </>
                  )}

                  {order.status === 'Finalizado' && (
                    <div className=col-span-1 sm:col-span-2 py-3 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-center text-xs font-black uppercase text-emerald-300 flex items-center justify-center gap-2>
                      <Icon name=check_circle size={16} />
                      <span>Pedido Entregado con Éxito</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
