import React, { useState } from 'react';
import { Icon } from './Icon';
import { MenuItem } from '../types';

interface WhatsAppOrderParserModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMenuItems: MenuItem[];
  onApplyParsedOrder: (parsed: {
    items: Array<{ item: MenuItem; toppings: string[]; quantity: number }>;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    clientZone: string;
    orderType: 'Mostrador' | 'Mesa' | 'Envío';
    paymentMethod: 'Efectivo' | 'MercadoPago QR' | 'POS Débito' | 'POS Crédito' | 'Transferencia Bancaria';
    notes: string;
  }) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

export const WhatsAppOrderParserModal: React.FC<WhatsAppOrderParserModalProps> = ({
  isOpen,
  onClose,
  allMenuItems,
  onApplyParsedOrder,
  showMessage,
}) => {
  const [rawText, setRawText] = useState('');
  const [parsedPreview, setParsedPreview] = useState<{
    items: Array<{ item: MenuItem; toppings: string[]; quantity: number }>;
    clientName: string;
    clientPhone: string;
    clientAddress: string;
    clientZone: string;
    orderType: 'Mostrador' | 'Mesa' | 'Envío';
    paymentMethod: 'Efectivo' | 'MercadoPago QR' | 'POS Débito' | 'POS Crédito' | 'Transferencia Bancaria';
    notes: string;
  } | null>(null);

  if (!isOpen) return null;

  const parseOrderText = (text: string) => {
    if (!text.trim()) {
      setParsedPreview(null);
      return;
    }

    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    let clientName = '';
    let clientPhone = '';
    let clientAddress = '';
    let clientZone = '';
    let orderType: 'Mostrador' | 'Mesa' | 'Envío' = 'Mostrador';
    let paymentMethod: 'Efectivo' | 'MercadoPago QR' | 'POS Débito' | 'POS Crédito' | 'Transferencia Bancaria' = 'Efectivo';
    const notesArr: string[] = [];
    const detectedItems: Array<{ item: MenuItem; toppings: string[]; quantity: number }> = [];

    // Extract phone numbers (09X XXX XXX or 598...)
    const phoneMatch = text.match(/(?:09\d{7}|5989\d{7}|\b09\d[\s-]?\d{3}[\s-]?\d{3}\b)/);
    if (phoneMatch) {
      clientPhone = phoneMatch[0].replace(/[\s-]/g, '');
    }

    // Determine delivery vs mostrador vs mesa
    const lower = text.toLowerCase();
    if (lower.includes('delivery') || lower.includes('envio') || lower.includes('envío') || lower.includes('direccion') || lower.includes('dirección') || lower.includes('calle')) {
      orderType = 'Envío';
    } else if (lower.includes('mesa') || lower.includes('salon') || lower.includes('salón') || lower.includes('comedor')) {
      orderType = 'Mesa';
    }

    // Determine payment
    if (lower.includes('transferencia') || lower.includes('itau') || lower.includes('brou') || lower.includes('santander')) {
      paymentMethod = 'Transferencia Bancaria';
    } else if (lower.includes('mercadopago') || lower.includes('qr') || lower.includes('mp')) {
      paymentMethod = 'MercadoPago QR';
    } else if (lower.includes('tarjeta') || lower.includes('pos') || lower.includes('debito') || lower.includes('débito')) {
      paymentMethod = 'POS Débito';
    } else if (lower.includes('credito') || lower.includes('crédito')) {
      paymentMethod = 'POS Crédito';
    }

    lines.forEach(line => {
      const lineLower = line.toLowerCase();

      // Check name
      if (lineLower.startsWith('nombre:') || lineLower.startsWith('cliente:') || lineLower.startsWith('para:')) {
        clientName = line.replace(/^(nombre|cliente|para):\s*/i, '').trim();
        return;
      }

      // Check address
      if (lineLower.startsWith('dirección:') || lineLower.startsWith('direccion:') || lineLower.startsWith('dir:')) {
        clientAddress = line.replace(/^(dirección|direccion|dir):\s*/i, '').trim();
        orderType = 'Envío';
        return;
      }

      // Check zone
      if (lineLower.startsWith('zona:') || lineLower.startsWith('barrio:')) {
        clientZone = line.replace(/^(zona|barrio):\s*/i, '').trim();
        return;
      }

      // Check item matches in line
      let matched = false;
      for (const m of allMenuItems) {
        const mName = m.name.toLowerCase();
        if (lineLower.includes(mName) || (mName.length > 5 && lineLower.includes(mName.substring(0, mName.length - 2)))) {
          // Extract quantity
          let qty = 1;
          const qtyMatch = line.match(/^(\d+)[\s*xX-]/) || line.match(/(\d+)\s*(?:unid|porc|metro|pizz)/i);
          if (qtyMatch) {
            qty = parseInt(qtyMatch[1], 10) || 1;
          }

          // Extract toppings or gustos
          const toppings: string[] = [];
          if (lineLower.includes('jamon') || lineLower.includes('jamón')) toppings.push('Jamón');
          if (lineLower.includes('panceta')) toppings.push('Panceta');
          if (lineLower.includes('champignon') || lineLower.includes('champiñon')) toppings.push('Champiñones');
          if (lineLower.includes('morron') || lineLower.includes('morrón')) toppings.push('Morrones');
          if (lineLower.includes('aceituna')) toppings.push('Aceitunas');
          if (lineLower.includes('albahaca')) toppings.push('Albahaca');
          if (lineLower.includes('calabresa')) toppings.push('Calabresa');
          if (lineLower.includes('choclo')) toppings.push('Choclo');

          detectedItems.push({ item: m, toppings, quantity: qty });
          matched = true;
          break;
        }
      }

      if (!matched && !lineLower.startsWith('pago:') && !lineLower.startsWith('total:')) {
        notesArr.push(line);
      }
    });

    // Default fallback if no item matched
    if (detectedItems.length === 0 && allMenuItems.length > 0) {
      detectedItems.push({
        item: allMenuItems[0],
        toppings: [],
        quantity: 1,
      });
    }

    setParsedPreview({
      items: detectedItems,
      clientName: clientName || 'Cliente WhatsApp',
      clientPhone,
      clientAddress,
      clientZone,
      orderType,
      paymentMethod,
      notes: notesArr.slice(0, 3).join(' • '),
    });
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setRawText(text);
      parseOrderText(text);
    } catch {
      showMessage('No se pudo acceder al portapapeles. Pega el texto manualmente.', 'error');
    }
  };

  const handleApply = () => {
    if (!parsedPreview) return;
    onApplyParsedOrder(parsedPreview);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0b0617] border-2 border-purple-500/40 rounded-3xl p-5 sm:p-7 max-w-2xl w-full shadow-2xl space-y-4 text-slate-100 max-h-[90vh] overflow-y-auto custom-dark-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black">
              <Icon name="content_paste_go" size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                Pegar Pedido desde WhatsApp
              </h3>
              <p className="text-[10px] text-purple-300 font-bold uppercase">
                Extractor automático de cliente, pizzas, gustos, dirección y pago
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Input Area */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-black uppercase text-purple-300">
              Pega aquí el mensaje copiado de WhatsApp Web / Celular:
            </label>
            <button
              type="button"
              onClick={handlePasteClipboard}
              className="px-2.5 py-1 bg-[#180931] hover:bg-[#27104f] text-purple-300 border border-purple-500/40 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-1"
            >
              <Icon name="content_paste" size={13} /> Pegar del Portapapeles
            </button>
          </div>

          <textarea
            rows={5}
            value={rawText}
            onChange={(e) => {
              setRawText(e.target.value);
              parseOrderText(e.target.value);
            }}
            placeholder={`Ejemplo:\nCliente: Juan Pérez\nTel: 098 123 456\nDirección: Av. Rivera 2450 esq. Ponce\n1 Metro Muzzarella con Jamón y Panceta\n2 Fainá tradicionales\nPago: Transferencia`}
            className="w-full p-3.5 bg-[#06030e] border border-purple-500/30 text-white placeholder-slate-500 rounded-2xl text-xs font-mono outline-none focus:border-purple-400 resize-none leading-relaxed"
          />
        </div>

        {/* Parsed Preview */}
        {parsedPreview && (
          <div className="bg-[#0e071e] p-4 rounded-2xl border border-purple-500/30 space-y-3">
            <div className="text-xs font-black uppercase text-white flex items-center gap-2 border-b border-purple-500/20 pb-2">
              <Icon name="check_circle" size={16} className="text-purple-400" />
              <span>Pedido Interpretado Correctamente</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[10px] text-purple-300 uppercase font-black">Cliente:</span>
                <p className="font-bold text-white uppercase">{parsedPreview.clientName}</p>
              </div>
              <div>
                <span className="text-[10px] text-purple-300 uppercase font-black">Teléfono / WhatsApp:</span>
                <p className="font-mono text-white">{parsedPreview.clientPhone || 'No detectado'}</p>
              </div>
              <div>
                <span className="text-[10px] text-purple-300 uppercase font-black">Destino:</span>
                <p className="font-bold text-white uppercase">{parsedPreview.orderType}</p>
              </div>
              <div>
                <span className="text-[10px] text-purple-300 uppercase font-black">Método de Pago:</span>
                <p className="font-bold text-white uppercase">{parsedPreview.paymentMethod}</p>
              </div>
              {parsedPreview.clientAddress && (
                <div className="col-span-2">
                  <span className="text-[10px] text-purple-300 uppercase font-black">Dirección de Entrega:</span>
                  <p className="font-bold text-white">{parsedPreview.clientAddress}</p>
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-1 pt-1">
              <span className="text-[10px] text-purple-300 uppercase font-black">Items a Cargar:</span>
              <div className="space-y-1">
                {parsedPreview.items.map((pi, idx) => (
                  <div key={idx} className="p-2 bg-[#080312] rounded-xl border border-purple-500/20 flex justify-between items-center text-xs">
                    <div>
                      <span className="font-black text-white">{pi.quantity}x {pi.item.name}</span>
                      {pi.toppings.length > 0 && (
                        <div className="text-[10px] text-purple-300">+ Gustos: {pi.toppings.join(', ')}</div>
                      )}
                    </div>
                    <span className="font-mono font-black text-white">${pi.item.price * pi.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2.5 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 bg-[#170a2c] hover:bg-[#251046] text-slate-300 rounded-xl text-xs font-black uppercase transition-all"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleApply}
            disabled={!parsedPreview}
            className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/30"
          >
            <Icon name="check" size={16} /> Cargar Directo a Comanda
          </button>
        </div>
      </div>
    </div>
  );
};
