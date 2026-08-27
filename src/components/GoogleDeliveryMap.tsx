import React, { useState } from 'react';
import { Icon } from './Icon';

interface GoogleDeliveryMapProps {
  address: string;
  zone?: string;
  clientName?: string;
  clientPhone?: string;
  orderDetails?: {
    orderId?: string;
    itemsSummary?: string;
    totalAmount?: number;
    paymentMethod?: string;
    cashProvided?: number;
    changeDue?: number;
  };
  className?: string;
  showMessage?: (msg: string, type?: 'success' | 'error') => void;
}

export const GoogleDeliveryMap: React.FC<GoogleDeliveryMapProps> = ({
  address,
  zone = '',
  clientName = '',
  clientPhone = '',
  orderDetails,
  className = '',
  showMessage,
}) => {
  const [copied, setCopied] = useState(false);
  const [driverPhone, setDriverPhone] = useState('');
  const [showDriverInput, setShowDriverInput] = useState(false);

  const cleanAddress = address?.trim() || '';
  const cleanZone = zone?.trim() || '';
  
  // Construct full search query with country context
  const fullAddressQuery = [
    cleanAddress,
    cleanZone,
    cleanAddress.toLowerCase().includes('uruguay') ? '' : 'Uruguay'
  ].filter(Boolean).join(', ');

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddressQuery)}`;
  const embedMapsUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddressQuery)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const copyMapsLink = () => {
    if (!cleanAddress) return;
    const textToCopy = `📍 Dirección: ${cleanAddress} ${cleanZone ? `(${cleanZone})` : ''}\n🗺️ Google Maps: ${googleMapsUrl}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    if (showMessage) showMessage('¡Dirección y enlace de Google Maps copiados!', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWithDriver = (phoneToSend?: string) => {
    const targetPhone = (phoneToSend || driverPhone || '').replace(/\D/g, '');
    
    const lines = [
      '🛵 *PEDIDO PARA DELIVERY - PIZZERÍA EL ÁRBOL*',
      orderDetails?.orderId ? `📋 *Comanda:* ${orderDetails.orderId}` : '',
      clientName ? `👤 *Cliente:* ${clientName}` : '',
      clientPhone ? `📞 *Teléfono Cliente:* ${clientPhone}` : '',
      `📍 *Dirección de Entrega:* ${cleanAddress || 'A confirmar'} ${cleanZone ? `(${cleanZone})` : ''}`,
      `🗺️ *Ubicación en Google Maps:* ${googleMapsUrl}`,
      orderDetails?.itemsSummary ? `\n🍕 *Detalle del Pedido:*\n${orderDetails.itemsSummary}` : '',
      orderDetails?.totalAmount ? `\n💰 *Total a Cobrar:* $${orderDetails.totalAmount}` : '',
      orderDetails?.paymentMethod ? `💳 *Forma de Pago:* ${orderDetails.paymentMethod}` : '',
      orderDetails?.cashProvided ? `💵 *Paga con:* $${orderDetails.cashProvided} (Vuelto: $${orderDetails.changeDue || 0})` : '',
    ].filter(Boolean);

    const message = encodeURIComponent(lines.join('\n'));
    const url = targetPhone ? `https://wa.me/598${targetPhone.replace(/^0/, '')}?text=${message}` : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
  };

  if (!cleanAddress) {
    return (
      <div className={`p-4 bg-[#0a140f] border border-emerald-500/20 rounded-2xl text-center space-y-2 ${className}`}>
        <div className="flex items-center justify-center gap-2 text-emerald-400/70 font-black text-xs uppercase">
          <Icon name="place" size={18} />
          <span>Localizador Google Maps</span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          Ingresa la calle y número (o dicta por voz) para ubicar automáticamente la entrega en el mapa y pasársela al repartidor con GPS.
        </p>
      </div>
    );
  }

  return (
    <div className={`bg-[#08120c] border border-emerald-500/30 rounded-2xl overflow-hidden shadow-lg space-y-3 p-3.5 ${className}`}>
      {/* Map Card Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/30">
            <Icon name="map" size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">
                Google Maps GPS
              </span>
              <span className="text-[8px] bg-emerald-950 text-emerald-300 px-1.5 py-0.2 rounded-full font-black border border-emerald-500/30">
                UBICACIÓN EN VIVO
              </span>
            </div>
            <p className="text-xs font-black text-white truncate">
              {cleanAddress} {cleanZone ? `• ${cleanZone}` : ''}
            </p>
          </div>
        </div>

        {/* Quick External Map Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-[11px] font-black uppercase flex items-center gap-1 transition-all"
            title="Abrir en app de Google Maps"
          >
            <Icon name="near_me" size={14} />
            <span>Navegar</span>
            <Icon name="open_in_new" size={11} />
          </a>

          <button
            type="button"
            onClick={copyMapsLink}
            className="p-1.5 bg-[#122218] hover:bg-[#1a3324] text-slate-300 hover:text-white border border-emerald-500/20 rounded-xl transition-all"
            title="Copiar dirección y enlace GPS"
          >
            <Icon name={copied ? "check" : "content_copy"} size={16} className={copied ? "text-emerald-400" : ""} />
          </button>
        </div>
      </div>

      {/* Embedded Dynamic Google Map View */}
      <div className="relative w-full h-44 sm:h-48 rounded-xl overflow-hidden border border-emerald-500/30 bg-[#050a07]">
        <iframe
          title="Google Map Delivery Locator"
          width="100%"
          height="100%"
          style={{ border: 0, filter: 'contrast(1.05) saturate(1.1)' }}
          loading="lazy"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          src={embedMapsUrl}
        />
        
        {/* Subtle overlay pill with address */}
        <div className="absolute bottom-2 left-2 right-2 bg-[#08100c]/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-emerald-500/40 flex items-center justify-between text-[10px]">
          <div className="flex items-center gap-1.5 text-slate-200 font-black truncate">
            <Icon name="pin_drop" size={14} className="text-emerald-400 shrink-0" />
            <span className="truncate">{cleanAddress} {cleanZone ? `(${cleanZone})` : ''}</span>
          </div>
          <a
            href={googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-400 font-black uppercase hover:underline shrink-0 ml-2"
          >
            Ver grande ↗
          </a>
        </div>
      </div>

      {/* Dispatch Action: WhatsApp to Delivery Driver */}
      <div className="bg-[#0b1811] p-2.5 rounded-xl border border-emerald-500/20 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1.5">
            <Icon name="two_wheeler" size={15} className="text-emerald-400" />
            <span>Pasar al Delivery / Repartidor con GPS</span>
          </div>
          <button
            type="button"
            onClick={() => setShowDriverInput(!showDriverInput)}
            className="text-[9px] font-black uppercase text-emerald-400 hover:underline"
          >
            {showDriverInput ? 'Ocultar Celular' : 'Especificar Celular'}
          </button>
        </div>

        {showDriverInput && (
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Celular del Repartidor (ej: 099 123 456)"
              value={driverPhone}
              onChange={(e) => setDriverPhone(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#050a07] border border-emerald-500/30 text-emerald-100 rounded-xl text-xs font-black outline-none focus:border-emerald-400"
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => handleShareWithDriver()}
          className="w-full py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/20"
        >
          <Icon name="share" size={15} />
          <span>🛵 Enviar Ubicación y Comanda al Repartidor (WhatsApp)</span>
        </button>
      </div>
    </div>
  );
};
