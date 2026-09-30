import React, { useEffect, useRef } from 'react';
import { OrderData } from '../types';
import { Icon } from './Icon';

interface ScheduledOrderAlertModalProps {
  orders: OrderData[];
  onDismiss: (orderId: string) => void;
  onPostpone: (order: OrderData, minutes: number) => void;
  onDispatchToKitchen: (order: OrderData) => void;
  onGoToTab: (tabId: string) => void;
}

export const ScheduledOrderAlertModal: React.FC<ScheduledOrderAlertModalProps> = ({
  orders,
  onDismiss,
  onPostpone,
  onDispatchToKitchen,
  onGoToTab,
}) => {
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play continuous alarm tone when large alert is active
  useEffect(() => {
    if (orders.length === 0) return;

    let isCancelled = false;
    const playAlarm = () => {
      if (isCancelled) return;
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

        // High priority alarm pattern
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1174.66, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      } catch (e) {
        console.warn('Audio alarm error:', e);
      }
    };

    playAlarm();
    const interval = setInterval(playAlarm, 2000);
    return () => {
      isCancelled = true;
      clearInterval(interval);
    };
  }, [orders.length]);

  if (orders.length === 0) return null;

  const currentAlertOrder = orders[0];
  const scheduledTimeStr = currentAlertOrder.scheduledTime
    ? new Date(currentAlertOrder.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : currentAlertOrder.time;

  const safeType = String(currentAlertOrder.type || '').trim().toLowerCase();
  const tabTarget = ['envío', 'envio', 'delivery'].includes(safeType)
    ? 'delivery'
    : safeType === 'mesa'
    ? 'tables'
    : ['web', 'pedido web'].includes(safeType)
    ? 'web'
    : 'counter';

  return (
    <div className="fixed inset-0 z-[20000] bg-red-950/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
      {/* Flashing Red Background Glow */}
      <div className="absolute inset-0 bg-gradient-to-b from-red-600/30 via-red-900/40 to-black/80 pointer-events-none animate-pulse" />

      <div className="relative max-w-2xl w-full bg-[#160306] border-4 border-red-500 rounded-[36px] p-6 sm:p-8 shadow-2xl shadow-red-950/90 space-y-6 text-slate-100 text-center animate-in zoom-in-95">
        {/* Top Flashing Urgent Banner */}
        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-red-600 text-white font-black uppercase text-xs sm:text-sm rounded-2xl tracking-widest animate-bounce shadow-lg">
          <Icon name="alarm_on" size={22} className="animate-spin" />
          <span>¡ALERTA: PEDIDO PROGRAMADO PARA AHORA!</span>
          <Icon name="alarm_on" size={22} className="animate-spin" />
        </div>

        {/* Big Header with Order ID and Time */}
        <div className="space-y-1">
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl sm:text-5xl font-black font-mono text-white tracking-tight bg-red-900/60 px-4 py-1.5 rounded-2xl border-2 border-red-500 shadow-inner">
              #{currentAlertOrder.id}
            </span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-red-300 uppercase pt-2">
            HORA PROGRAMADA: <span className="text-white underline font-mono">{scheduledTimeStr}</span>
          </div>
          <div className="text-xs font-bold text-red-200 uppercase tracking-wider">
            Destino: <strong className="text-white text-sm bg-red-950 px-2.5 py-0.5 rounded-lg border border-red-500/40">{currentAlertOrder.type}</strong>
            {currentAlertOrder.assignedDriver && (
              <span className="ml-2 text-amber-300 bg-amber-950/80 px-2 py-0.5 rounded-lg border border-amber-500/40">
                🏍️ Repartidor: {currentAlertOrder.assignedDriver}
              </span>
            )}
          </div>
        </div>

        {/* Customer & Address Information Box */}
        <div className="bg-[#24060b] p-4 rounded-2xl border-2 border-red-500/40 text-left space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-red-500/20 pb-2">
            <div className="font-black text-base text-white uppercase flex items-center gap-2">
              <Icon name="person" size={18} className="text-red-400" />
              <span>{currentAlertOrder.client?.name || 'Cliente'}</span>
            </div>
            {currentAlertOrder.client?.phone && currentAlertOrder.client.phone !== 'N/A' && (
              <div className="text-xs font-mono font-bold text-red-300">
                📞 {currentAlertOrder.client.phone}
              </div>
            )}
          </div>

          {currentAlertOrder.client?.address && currentAlertOrder.client.address !== 'N/A' && (
            <div className="text-xs font-bold text-slate-200 flex items-center gap-2 pt-1">
              <Icon name="place" size={16} className="text-red-400 shrink-0" />
              <span>{currentAlertOrder.client.address} {currentAlertOrder.client.zone ? `(${currentAlertOrder.client.zone})` : ''}</span>
            </div>
          )}

          {currentAlertOrder.notes && (
            <div className="p-2.5 bg-red-950/80 rounded-xl border border-red-500/40 text-xs font-bold text-red-200">
              📌 <strong>Observación:</strong> {currentAlertOrder.notes}
            </div>
          )}
        </div>

        {/* Items List */}
        <div className="bg-[#24060b] p-4 rounded-2xl border border-red-500/30 text-left space-y-2 max-h-48 overflow-y-auto custom-dark-scrollbar">
          <div className="text-[11px] font-black uppercase text-red-300 border-b border-red-500/20 pb-1 flex justify-between">
            <span>Comanda / Productos a Preparar</span>
            <span>Total: ${currentAlertOrder.total} ({currentAlertOrder.paymentMethod})</span>
          </div>
          <ul className="space-y-1.5 text-xs font-bold">
            {currentAlertOrder.items.map((it, idx) => (
              <li key={idx} className="flex justify-between items-start text-white">
                <div>
                  <span className="font-black text-red-300">{it.quantity || 1}x</span> {it.name}
                  {it.selectedToppings && it.selectedToppings.length > 0 && (
                    <span className="text-[10px] text-red-300/80 block italic">
                      + {it.selectedToppings.map(t => t.name).join(', ')}
                    </span>
                  )}
                </div>
                <span className="font-mono text-red-200 font-black">
                  ${Math.round((it.finalPrice || it.price || 0) * (it.quantity || 1))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Counter of multiple pending alerts */}
        {orders.length > 1 && (
          <div className="text-xs font-black text-amber-300 bg-amber-950/80 py-1.5 px-3 rounded-xl border border-amber-500/40 inline-block">
            ⚠️ Hay {orders.length} pedidos programados esperando atención
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {/* Main Action: Enviar a Cocina / Despachar */}
          <button
            type="button"
            onClick={() => onDispatchToKitchen(currentAlertOrder)}
            className="sm:col-span-2 py-4 px-6 bg-gradient-to-r from-red-600 via-rose-600 to-red-500 hover:from-red-500 hover:to-rose-500 text-white rounded-2xl font-black uppercase text-sm shadow-2xl shadow-red-600/60 transition-all flex items-center justify-center gap-2 cursor-pointer border-2 border-red-300 active:scale-95"
          >
            <Icon name="rocket_launch" size={22} />
            <span>🚀 ¡Pasar a Cocina / Despachar Ya!</span>
          </button>

          {/* Posponer 5 minutos */}
          <button
            type="button"
            onClick={() => onPostpone(currentAlertOrder, 5)}
            className="py-3 px-4 bg-[#2b080f] hover:bg-[#3d0b16] text-red-200 border border-red-500/40 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icon name="update" size={16} />
            <span>⏱️ Posponer 5 Minutos</span>
          </button>

          {/* Ver en su solapa */}
          <button
            type="button"
            onClick={() => {
              onDismiss(currentAlertOrder.firestoreId);
              onGoToTab(tabTarget);
            }}
            className="py-3 px-4 bg-[#2b080f] hover:bg-[#3d0b16] text-red-200 border border-red-500/40 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Icon name="open_in_new" size={16} />
            <span>👁️ Ver en Solapa {currentAlertOrder.type}</span>
          </button>

          {/* Entendido / Cerrar */}
          <button
            type="button"
            onClick={() => onDismiss(currentAlertOrder.firestoreId)}
            className="sm:col-span-2 py-2.5 text-slate-400 hover:text-white font-black uppercase text-xs transition-colors cursor-pointer"
          >
            Entendido / Cerrar Alerta
          </button>
        </div>
      </div>
    </div>
  );
};
