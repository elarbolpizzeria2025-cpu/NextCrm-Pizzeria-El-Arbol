import React, { useState, useEffect } from 'react';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { OrderData } from '../types';
import { Icon } from './Icon';
import { printOrderTicket } from '../utils/printTicket';

interface OrderCardProps {
  order: OrderData;
  variant?: 'normal' | 'danger' | 'scheduled';
  hideActions?: boolean;
  collapsible?: boolean;
  db: any;
  appId: string;
  WARNING_THRESHOLDS: Record<string, number[]>;
  setNotesModal: (data: { isOpen: boolean; order: OrderData | null; text: string }) => void;
  handleEditOrder: (order: OrderData) => void;
  notifyClientWhatsApp: (order: OrderData) => void;
  setDeliveryShareModal: (data: { isOpen: boolean; order: OrderData | null }) => void;
  setEditOrderModal: (data: { isOpen: boolean; order: OrderData | null; cashReceived: string; tip: string; voucherDelivered: boolean; transferConfirmed: boolean; selectedPaymentMethod: string }) => void;
  handleDirectDispatch: (order: OrderData) => void;
  showMessage: (msg: string, type?: string) => void;
}

export const OrderCard: React.FC<OrderCardProps> = ({
  order,
  variant = 'normal',
  hideActions = false,
  collapsible = false,
  db,
  appId,
  setNotesModal,
  handleEditOrder,
  notifyClientWhatsApp,
  setDeliveryShareModal,
  setEditOrderModal,
  handleDirectDispatch,
  showMessage,
}) => {
  const isDanger = variant === 'danger';
  const isScheduled = variant === 'scheduled';
  const [elapsedMinutes, setElapsedMinutes] = useState(Math.floor((Date.now() - order.createdAt) / 60000));
  const [isExpanded, setIsExpanded] = useState(!collapsible);
  const isPreparing = order.status === 'Preparando';
  const isWebOrder = ['web', 'pedido web'].includes(String(order.type).toLowerCase());

  useEffect(() => {
    if (hideActions || order.status === 'Finalizado' || isScheduled) return;
    const interval = setInterval(() => setElapsedMinutes(Math.floor((Date.now() - order.createdAt) / 60000)), 60000); 
    return () => clearInterval(interval);
  }, [order.createdAt, hideActions, order.status, isScheduled]);

  const handleDelete = async () => {
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId));
      showMessage(`Comanda #${order.id} eliminada`, 'info');
    } catch (e: any) {
      showMessage('Error al eliminar: ' + e.message, 'error');
    }
  };

  if (collapsible && !isExpanded) {
    return (
      <div 
        onClick={() => setIsExpanded(true)} 
        className={`cursor-pointer rounded-2xl p-3.5 border shadow-md border-l-[6px] flex justify-between items-center transition-all hover:scale-[1.01] active:scale-98 shrink-0 ${
          isDanger 
            ? 'bg-[#180a0e] border-red-500/50 border-l-red-500 text-red-100' 
            : isScheduled 
            ? 'bg-[#09121d] border-blue-500/40 border-l-blue-500 text-blue-100' 
            : isPreparing 
            ? 'bg-[#0c141f] border-blue-500/30 border-l-blue-400 text-slate-100' 
            : order.status === 'Finalizado' 
            ? 'bg-[#080d14] border-slate-800 border-l-slate-600 text-slate-300' 
            : 'bg-[#0a111a] border-slate-800 border-l-blue-400 text-slate-100'
        }`}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <span className="font-black text-[11px] bg-[#05090e] border border-blue-500/30 text-blue-300 px-2.5 py-1 rounded-lg shadow-sm shrink-0">
            #{order.id}
          </span>
          <span className={`font-black text-[12px] truncate uppercase ${
            isDanger ? 'text-red-300' : isScheduled ? 'text-blue-300' : 'text-slate-100'
          }`}>
            {order.client?.name || 'GENERAL'}
          </span>
          <span className="text-[9px] px-2.5 py-0.5 rounded-full font-black text-slate-900 bg-blue-400 shrink-0 hidden sm:inline-block">
            {order.type}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-2">
          {!isScheduled && (
            <span className={`font-black text-[10px] flex items-center gap-1 ${
              isDanger ? 'text-red-400' : 'text-slate-400'
            }`}>
              <Icon name="timer" size={12}/> {elapsedMinutes}m
            </span>
          )}
          {isScheduled && order.scheduledTime && (
            <span className="font-black text-[10px] flex items-center gap-1 text-blue-400">
              <Icon name="event_available" size={12}/> {new Date(order.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          )}
          <Icon name="expand_more" size={18} className={isDanger ? 'text-red-400' : isScheduled ? 'text-blue-400' : 'text-slate-400'}/>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-3xl p-5 sm:p-6 border shadow-lg border-l-[8px] relative overflow-hidden transition-all shrink-0 ${
      isDanger 
        ? 'bg-[#180a0e] border-red-500/50 border-l-red-500 ring-1 ring-red-500/40 text-red-100' 
        : isScheduled 
        ? 'bg-[#09121d] border-blue-500/40 border-l-blue-500 text-blue-100' 
        : isPreparing 
        ? 'bg-[#0c141f] border-blue-500/30 border-l-blue-500 text-slate-100' 
        : order.status === 'Finalizado' 
        ? 'bg-[#070b10] border-slate-800 border-l-slate-700 text-slate-300' 
        : 'bg-[#0a1018] border-slate-800 border-l-blue-400 text-slate-100'
    }`}>
      {isDanger && (
        <div className="absolute top-0 right-0 bg-red-600 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg animate-pulse">
          <Icon name="warning" size={12}/> ¡Demorado!
        </div>
      )}
      {isScheduled && (
        <div className="absolute top-0 right-0 bg-blue-600 text-white px-3 py-1 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg">
          <Icon name="event_available" size={12}/> Programado
        </div>
      )}
      
      <div className={`flex flex-wrap justify-between items-start mb-4 gap-3 ${collapsible ? 'cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-2xl transition-colors' : ''}`} onClick={(e) => { if(collapsible) { e.stopPropagation(); setIsExpanded(false); }}}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-black text-[11px] bg-[#05090e] text-blue-400 px-3 py-1.5 rounded-xl border border-blue-500/30 shadow-inner">
            #{order.id} | {order.time}
          </span>
          {!hideActions && !isScheduled && (
            <span className={`font-black text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg ${
              isDanger ? 'bg-red-900/80 text-red-200 border border-red-500/40' : 'bg-[#101824] text-slate-300 border border-slate-700'
            }`}>
              <Icon name="timer" size={12}/> Hace {elapsedMinutes} min
            </span>
          )}
          {isScheduled && order.scheduledTime && (
            <span className="font-black text-[10px] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/80 text-blue-200 border border-blue-500/40">
              Para: {new Date(order.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-1 items-center" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button"
              onClick={() => setNotesModal({isOpen: true, order, text: order.notes || ''})} 
              className={`p-2 rounded-xl transition-all flex items-center gap-1 ${
                order.notes 
                  ? 'text-blue-200 bg-blue-950 hover:bg-blue-900 border border-blue-500/50' 
                  : 'text-slate-400 hover:text-blue-300 hover:bg-blue-950/40'
              }`} 
              title="Agregar / Editar Observaciones"
            >
              <Icon name="description" size={18}/>
              {order.notes && <span className="text-[10px] font-black uppercase hidden sm:inline">Nota</span>}
            </button>
            {!hideActions && order.status !== 'Finalizado' && (
              <button 
                type="button"
                onClick={() => handleEditOrder(order)} 
                className="p-2 text-slate-400 hover:text-blue-300 hover:bg-[#121c2a] rounded-xl transition-all" 
                title="Editar comanda"
              >
                <Icon name="edit_square" size={18}/>
              </button>
            )}
            {!hideActions && order.status === 'Pendiente' && order.client?.phone && order.client.phone !== 'N/A' && (
              <button 
                type="button"
                onClick={() => notifyClientWhatsApp(order)} 
                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 rounded-xl transition-all" 
                title="Avisar por WhatsApp"
              >
                <Icon name="chat" size={18}/>
              </button>
            )}
            {!hideActions && order.type === 'Envío' && order.status === 'Pendiente' && (
              <button 
                type="button"
                onClick={() => setDeliveryShareModal({ isOpen: true, order })} 
                className="p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-950/40 rounded-xl transition-all" 
                title="Asignar Repartidor"
              >
                <Icon name="near_me" size={18}/>
              </button>
            )}
            <button 
              type="button"
              onClick={() => printOrderTicket(order)} 
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-all" 
              title="Imprimir Ticket"
            >
              <Icon name="print" size={18}/>
            </button>
            <button 
              type="button"
              onClick={handleDelete} 
              className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded-xl transition-all" 
              title="Eliminar comanda"
            >
              <Icon name="delete" size={18}/>
            </button>
            {collapsible && (
              <button type="button" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="p-2 ml-1 border-l border-slate-700 pl-2 text-slate-400 hover:text-white">
                <Icon name="close" size={20}/>
              </button>
            )}
        </div>
      </div>
      
      <div className="space-y-1.5 mb-4">
          <div className={`font-black uppercase text-base tracking-tight ${
            isDanger ? 'text-red-300' : isScheduled ? 'text-blue-300' : 'text-white'
          }`}>
            {order.client?.name || 'GENERAL'}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
             <div className="text-[10px] px-2.5 py-0.5 rounded-full font-black text-slate-950 bg-blue-400">
               {order.type}
             </div>
             <div className={`text-[10px] px-2.5 py-0.5 rounded-full font-black uppercase border ${
               order.paymentMethod === 'A confirmar' 
                 ? 'bg-red-950 text-red-300 border-red-500/50' 
                 : 'bg-[#101824] text-slate-200 border-slate-700'
             }`}>
               {order.paymentMethod}
             </div>
             <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
               {order.reference}
             </div>
             {order.assignedDriver && (
               <div className="text-[10px] px-2.5 py-0.5 rounded-full font-black text-slate-950 bg-blue-400 flex items-center gap-1 shadow-sm">
                 <Icon name="local_shipping" size={10} /> {order.assignedDriver.toUpperCase()}
               </div>
             )}
          </div>
          {order.client?.address && order.client.address !== 'N/A' && (() => {
            const fullAddressQuery = [
              order.client.address,
              order.client.zone,
              order.client.address.toLowerCase().includes('uruguay') ? '' : 'Uruguay'
            ].filter(Boolean).join(', ');
            const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressQuery)}`;

            const sendDriverWhatsApp = (e: React.MouseEvent) => {
              e.stopPropagation();
              const itemsList = order.items.map(it => `• ${it.quantity || 1}x ${it.name}${it.selectedToppings?.length ? ` (+${it.selectedToppings.map(t => t.name).join(', ')})` : ''}`).join('\n');
              const msg = [
                '🛵 *PEDIDO PARA DELIVERY - PIZZERÍA EL ÁRBOL*',
                `📋 *Comanda:* ${order.id}`,
                `👤 *Cliente:* ${order.client?.name || 'General'}`,
                order.client?.phone && order.client.phone !== 'N/A' ? `📞 *Teléfono:* ${order.client.phone}` : '',
                `📍 *Dirección de Entrega:* ${order.client.address} ${order.client.zone ? `(${order.client.zone})` : ''}`,
                `🗺️ *Ubicación Google Maps:* ${googleMapsUrl}`,
                `\n🍕 *Productos:*\n${itemsList}`,
                `\n💰 *Total a Cobrar:* $${order.total}`,
                `💳 *Forma de Pago:* ${order.paymentMethod}`,
                order.cashProvided ? `💵 *Paga con:* $${order.cashProvided} (Vuelto: $${order.changeDue || 0})` : '',
                order.notes ? `📝 *Nota:* ${order.notes}` : ''
              ].filter(Boolean).join('\n');
              window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
            };

            return (
              <div className="mt-2 p-2.5 rounded-xl bg-[#080d14] border border-slate-800 space-y-1.5" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between gap-2">
                  <div className="text-[11px] text-slate-200 font-black uppercase flex items-center gap-1.5 truncate">
                    <Icon name="place" size={14} className="text-blue-400 shrink-0" />
                    <span className="truncate">{order.client.address}</span>
                    {order.client?.zone && order.client.zone !== 'N/A' && (
                      <span className="bg-[#121c2a] text-blue-300 px-1.5 py-0.5 rounded text-[9px] font-black border border-blue-500/30 shrink-0">
                        {order.client.zone}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-2 py-1 bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"
                    title="Abrir mapa en Google Maps"
                  >
                    <Icon name="near_me" size={11} />
                    <span>Google Maps</span>
                    <Icon name="open_in_new" size={9} />
                  </a>

                  <button
                    type="button"
                    onClick={sendDriverWhatsApp}
                    className="px-2 py-1 bg-[#101c2a] hover:bg-[#16273b] text-blue-400 hover:text-white border border-blue-500/30 rounded-lg text-[9px] font-black uppercase flex items-center gap-1 transition-all"
                    title="Enviar comanda al Repartidor por WhatsApp"
                  >
                    <Icon name="two_wheeler" size={11} />
                    <span>Pasar a Delivery (WhatsApp)</span>
                  </button>
                </div>
              </div>
            );
          })()}
          <div 
            className={`mt-2.5 p-2.5 rounded-2xl text-[11px] font-black uppercase shadow-xs flex items-center justify-between gap-2 transition-all ${
              order.notes 
                ? 'bg-blue-950/70 text-blue-200 border border-blue-500/40' 
                : 'bg-[#080d14] text-slate-400 border border-slate-800 hover:border-blue-500 hover:text-blue-300 cursor-pointer'
            }`} 
            onClick={(e) => { e.stopPropagation(); setNotesModal({isOpen: true, order, text: order.notes || ''}); }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <Icon name="description" size={16} className={`shrink-0 ${order.notes ? 'text-blue-400' : 'text-slate-400'}`} />
              <span className={`truncate ${order.notes ? 'italic font-black text-blue-200' : 'normal-case font-bold text-[10px]'}`}>
                {order.notes ? `Nota: ${order.notes}` : '+ Agregar Nota u Observación'}
              </span>
            </div>
            <button 
              type="button"
              onClick={(e) => { e.stopPropagation(); setNotesModal({isOpen: true, order, text: order.notes || ''}); }}
              className={`text-[9px] font-black px-2.5 py-1 rounded-xl shrink-0 uppercase transition-all shadow-xs ${
                order.notes ? 'bg-blue-500 text-slate-950 hover:bg-blue-400' : 'bg-slate-800 border border-slate-700 text-slate-300 hover:bg-blue-950 hover:text-blue-200'
              }`}
            >
              {order.notes ? 'Editar' : '+ Nota'}
            </button>
          </div>
      </div>

      <ul className={`text-[12px] font-bold border-y py-3.5 space-y-2 ${
        isDanger ? 'border-red-500/30' : isScheduled ? 'border-blue-500/30' : 'border-slate-800'
      }`}>
        {order.items.map((it, i) => (
          <li key={i}>
              <div className="flex justify-between items-center">
                <span className={isDanger ? 'text-red-200' : isScheduled ? 'text-blue-200' : 'text-slate-100'}>
                  {it.quantity || 1}x {it.name}
                </span>
                <span className={`font-black ${isDanger ? 'text-red-300' : isScheduled ? 'text-blue-300' : 'text-blue-400'}`}>
                  ${Math.round((it.finalPrice || 0) * (it.quantity || 1))}
                </span>
              </div>
              {it.selectedToppings && it.selectedToppings.length > 0 && (
                <div className="text-[10px] text-blue-300/80 italic block mt-0.5 pl-2">
                  + {it.selectedToppings.map(t => t.name).join(', ')}
                </div>
              )}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap justify-between items-end gap-3 pt-4">
        <div className="flex flex-col">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
            TOTAL ({order.paymentMethod})
          </span>
          <span className={`text-2xl sm:text-3xl font-black leading-none ${
            isDanger ? 'text-red-400' : isScheduled ? 'text-blue-400' : 'text-blue-400'
          }`}>
            ${order.total}
          </span>
          {order.paymentMethod === 'Efectivo' && order.cashProvided && order.cashProvided > order.total && (
            <span className="text-[10px] font-black text-blue-300 uppercase mt-1.5 bg-blue-950/80 border border-blue-500/40 px-2 py-0.5 rounded-lg inline-block self-start shadow-sm">
              Vuelto de ${order.cashProvided} (${order.cashProvided - order.total})
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
            {!hideActions && isWebOrder && order.status === 'Pendiente' ? (
                <>
                   <button type="button" onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), { status: 'Preparando', type: 'Envío', reference: 'ENVÍO' }); showMessage("Derivado a Cocina como ENVÍO"); }} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shadow-md flex items-center gap-1">Aprobar <Icon name="local_shipping" size={15}/></button>
                   <button type="button" onClick={(e) => { e.stopPropagation(); updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), { status: 'Preparando', type: 'Local', reference: 'LOCAL' }); showMessage("Derivado a Cocina como MOSTRADOR"); }} className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 px-4 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shadow-md flex items-center gap-1">Aprobar <Icon name="storefront" size={15}/></button>
                </>
            ) : !hideActions && (
                isPreparing ? (
                  <button type="button" onClick={(e) => { e.stopPropagation(); handleDirectDispatch(order); }} className={`px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shadow-md flex items-center gap-2 ${isDanger ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-blue-600 text-white hover:bg-blue-500'}`}><Icon name="check_circle" size={16}/> Listo</button>
                ) : (
                  <button type="button" onClick={(e) => { e.stopPropagation(); setEditOrderModal({ isOpen: true, order, cashReceived: order.cashProvided ? order.cashProvided.toString() : '', tip: '0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: (order.paymentMethod && order.paymentMethod !== 'A confirmar') ? order.paymentMethod : 'Efectivo' }); }} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-2xl text-[11px] font-black uppercase transition-all shadow-md shadow-blue-600/30">Cobrar</button>
                )
            )}
        </div>
      </div>
    </div>
  );
};
