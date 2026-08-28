import { OrderData, SessionData } from '../types';

export function getSpecialCelebrationGreeting(dateInput?: Date | number): string {
  const d = dateInput ? new Date(dateInput) : new Date();
  const day = d.getDate();
  const month = d.getMonth() + 1; // 1-12
  const dayOfWeek = d.getDay(); // 0 = Sunday

  // Celebraciones y Feriados Especiales
  if (month === 1 && day === 1) return '🎉 ¡FELIZ AÑO NUEVO! 🎉';
  if (month === 1 && day === 6) return '👑 ¡FELIZ DÍA DE REYES! 👑';
  if (month === 2 && day === 9) return '🍕 ¡FELIZ DÍA INTERNACIONAL DE LA PIZZA! 🍕';
  if (month === 2 && day === 14) return '❤️ ¡FELIZ DÍA DE LOS ENAMORADOS / SAN VALENTÍN! ❤️';
  if (month === 3 && day === 8) return '🌸 ¡FELIZ DÍA INTERNACIONAL DE LA MUJER! 🌸';
  if (month === 4 && day === 19) return '🇺🇾 ¡FELIZ DÍA DEL DESEMBARCO DE LOS 33 ORIENTALES! 🇺🇾';
  if (month === 5 && day === 1) return '🛠️ ¡FELIZ DÍA DE LOS TRABAJADORES! 🛠️';
  if (month === 5 && day === 18) return '🇺🇾 ¡FELIZ DÍA DE LA BATALLA DE LAS PIEDRAS! 🇺🇾';
  if (month === 6 && day === 19) return '👴 ¡FELIZ DÍA DEL ABUELO Y NATALICIO DE ARTIGAS! 👴';
  if (month === 7 && day === 20) return '🤝 ¡FELIZ DÍA DEL AMIGO! 🤝';
  if (month === 8 && day === 24) return '📻 ¡FELIZ NOCHE DE LA NOSTALGIA! 📻';
  if (month === 8 && day === 25) return '🇺🇾 ¡FELIZ DÍA DE LA INDEPENDENCIA NACIONAL! 🇺🇾';
  if (month === 9 && day === 21) return '🌻 ¡FELIZ DÍA DE LA PRIMAVERA! 🌻';
  if (month === 10 && day === 12) return '🌎 ¡FELIZ DÍA DE LA DIVERSIDAD CULTURAL! 🌎';
  if (month === 10 && day === 31) return '🎃 ¡FELIZ NOCHE DE BRUJAS / HALLOWEEN! 🎃';
  if (month === 11 && day === 2) return '🕯️ ¡DÍA DE LOS DIFUNTOS! 🕯️';
  if (month === 12 && day === 24) return '🎄 ¡FELIZ NOCHEBUENA! 🎄';
  if (month === 12 && day === 25) return '🎅 ¡FELIZ NAVIDAD! 🎅';
  if (month === 12 && day === 31) return '🥂 ¡FELIZ FIN DE AÑO Y PRÓSPERO AÑO NUEVO! 🥂';

  // Fechas Móviles (Domingos)
  // Día de la Madre: 2do Domingo de Mayo
  if (month === 5 && dayOfWeek === 0 && day >= 8 && day <= 14) {
    return '💐 ¡FELIZ DÍA DE LA MADRE! 💐';
  }
  // Día del Padre: 2do Domingo de Julio
  if (month === 7 && dayOfWeek === 0 && day >= 8 && day <= 14) {
    return '👔 ¡FELIZ DÍA DEL PADRE! 👔';
  }
  // Día de la Niñez: 2do o 3er Domingo de Agosto
  if (month === 8 && dayOfWeek === 0 && day >= 8 && day <= 21) {
    return '🧸 ¡FELIZ DÍA DE LA NIÑEZ Y DEL NIÑO! 🧸';
  }

  return '¡GRACIAS POR ELEGIRNOS!';
}

export const printOrderTicket = (order: OrderData) => {
  if (!order) return;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const celebrationGreeting = getSpecialCelebrationGreeting(order.createdAt);

  const itemsHtml = order.items.map(it => { 
      const lineTotal = Math.round((it.finalPrice || 0) * (it.quantity || 1)); 
      const toppingsDisplay = it.selectedToppings && it.selectedToppings.length > 0 
        ? `<div class="toppings">★ GUSTOS: ${it.selectedToppings.map(t => t.name.toUpperCase()).join(' • ')}</div>` 
        : '';
      return `
        <div class="item-line">
          <div class="item-main">
            <span class="qty">${it.quantity || 1}</span>
            <span class="name">${it.name.toUpperCase()}</span>
            <span class="price">${lineTotal}</span>
          </div>
          ${toppingsDisplay}
        </div>
      `; 
  }).join('');
  
  const formattedDate = new Date(order.createdAt).toLocaleDateString(); 
  
  const addressLine = ['Envío', 'Web'].includes(order.type) && order.client?.address && order.client.address !== 'N/A' 
      ? `<div class="destination">DIRECCIÓN: ${order.client.address} ${order.client?.zone && order.client.zone !== 'N/A' ? `<span class="destination-zone">ZONA: ${order.client.zone.toUpperCase()}</span>` : ''}</div>` 
      : `<div class="destination">DESTINO: ${order.reference.toUpperCase()}</div>`;
      
  const driverInfo = order.assignedDriver ? `<div class="highlight-box">🛵 REPARTIDOR: ${order.assignedDriver.toUpperCase()}</div>` : ''; 
  const notesInfo = order.notes ? `<div class="notes-box">📌 OBSERVACIÓN / NOTA: ${order.notes.toUpperCase()}</div>` : ''; 
  
  const cashInfo = order.paymentMethod === 'Efectivo' && order.cashProvided && order.cashProvided > order.total 
      ? `<div class="payment-detail">Abonó con: ${order.cashProvided} | <b>VUELTO: ${order.cashProvided - order.total}</b></div>` 
      : '';
      
  const watermarkText = "EL ÁRBOL PIZZERÍA ".repeat(15);

  const deliveryTypeLabel = order.type === 'Envío' 
    ? '🛵 ENVÍO A DOMICILIO' 
    : order.type === 'Mesa' 
    ? '🍽️ CONSUMO EN SALÓN (MESA)' 
    : order.type === 'Web'
    ? '🌐 PEDIDO WEB'
    : '📦 RETIRO EN MOSTRADOR';

  const generateTicketHTML = (titleCopy: string) => `
    <div class="ticket">
       <div class="watermark">${watermarkText}</div>
       <div class="content">
           <div class="header">
              <div class="brand">EL ÁRBOL</div>
              <div class="subtitle">PIZZERÍA</div>
              <div class="via-title">${titleCopy}</div>
           </div>
           
           <div class="order-id">ORDEN ${order.id}</div>

           <!-- TIPO DE ENVÍO DESTACADO EN GRANDE Y NEGRITA -->
           <div class="delivery-type-banner">${deliveryTypeLabel}</div>
           
           <div class="main-info">
              <div class="info-row"><span>FECHA / HORA</span> <b>${formattedDate} ${order.time}</b></div>
              <div class="info-row type-row"><span>TIPO DE SERVICIO</span> <b class="bold-type">${order.type.toUpperCase()}</b></div>
              <div class="info-row"><span>CLIENTE</span> <b>${order.client?.name.toUpperCase() || 'CONSUMIDOR FINAL'}</b></div>
              <div class="info-row"><span>TELÉFONO</span> <b>${order.client?.phone || 'N/A'}</b></div>
              <div class="info-row"><span>MÉTODO DE PAGO</span> <b>${order.paymentMethod.toUpperCase()}</b></div>
           </div>
           
           ${addressLine}
           ${driverInfo}
           ${notesInfo}
           
           <div class="items-header">
              <span class="qty-hdr">CANT</span>
              <span class="name-hdr">DESCRIPCIÓN & GUSTOS</span>
              <span class="price-hdr">TOTAL</span>
           </div>
           
           <div class="items-container">
              ${itemsHtml}
           </div>
           
           <div class="total-section">
              <span class="total-label">TOTAL</span>
              <span class="total-amount">${order.total}</span>
           </div>
           ${cashInfo}
           
           <div class="footer">
              <div class="fake-barcode"></div>
              ${celebrationGreeting !== '¡GRACIAS POR ELEGIRNOS!' ? `
              <div class="celebration-banner">
                 ${celebrationGreeting}
              </div>
              ` : ''}
              <div class="uru-banner">
                 <div class="stars">★★★★★</div>
                 <div class="uru-text">EL ÁRBOL PIZZERÍA</div>
                 <div class="uru-icons">🍕 EL ÁRBOL 🍕</div>
              </div>
              <div class="thanks">¡GRACIAS POR ELEGIRNOS!</div>
           </div>
       </div>
    </div>
  `;

  printWindow.document.write(`
    <html><head><title>Ticket ${order.id}</title>
    <style>
      @page { margin: 0; size: 80mm auto; } 
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; width: 76mm; margin: 0 auto; padding: 0; color: #000; background-color: #fff; } 
      .ticket { position: relative; width: 100%; padding: 0; margin-bottom: 2mm; overflow: hidden; } 
      .watermark { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; font-size: 26px; font-weight: 900; color: rgba(0,0,0,0.05); text-transform: uppercase; transform: rotate(-25deg); display: flex; flex-wrap: wrap; align-content: center; justify-content: center; line-height: 1.5; pointer-events: none; z-index: 0; letter-spacing: 2px; text-align: center; } 
      .content { position: relative; z-index: 1; width: 100%; } 
      .header { text-align: center; margin-bottom: 6px; background: #000; color: #fff; padding: 8px 0; } 
      .brand { font-size: 28px; font-weight: 900; letter-spacing: 4px; line-height: 1; } 
      .subtitle { font-size: 11px; font-weight: 700; letter-spacing: 6px; margin-top: 4px; opacity: 0.9; } 
      .via-title { font-size: 11px; font-weight: 900; background: #fff; color: #000; display: inline-block; padding: 3px 12px; margin-top: 8px; border-radius: 12px; text-transform: uppercase; } 
      .order-id { font-size: 24px; font-weight: 900; text-align: center; margin: 6px 0; padding: 4px 0; border-top: 3px solid #000; border-bottom: 3px solid #000; letter-spacing: 1px; background: rgba(255,255,255,0.8); } 

      /* TIPO DE ENVÍO DESTACADO EN GRANDE Y NEGRITA */
      .delivery-type-banner {
        font-size: 19px;
        font-weight: 900;
        text-align: center;
        background: #000;
        color: #fff;
        padding: 8px 4px;
        margin: 6px 0 8px 0;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        border: 2px solid #000;
        line-height: 1.2;
      }
      .bold-type {
        font-size: 16px !important;
        font-weight: 900 !important;
        color: #000 !important;
        text-decoration: underline;
      }

      .main-info { font-size: 13px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 4px; background: rgba(255,255,255,0.8); padding: 0 2px; } 
      .info-row { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dotted #888; padding-bottom: 3px; } 
      .info-row span { font-size: 11px; font-weight: 800; color: #333; text-transform: uppercase; } 
      .info-row b { font-weight: 900; text-align: right; max-width: 65%; word-wrap: break-word; font-size: 13px; } 
      .destination { font-size: 15px; font-weight: 900; text-align: center; background: #000; color: #fff; padding: 7px; margin: 8px 0; text-transform: uppercase; line-height: 1.3; } 
      .destination-zone { font-size: 12px; font-weight: 800; display: block; margin-top: 2px; opacity: 0.95; background: #333; padding: 2px; } 
      .highlight-box { font-size: 14px; font-weight: 900; text-align: center; border: 2.5px dashed #000; padding: 5px; margin: 6px 0; background: rgba(255,255,255,0.9); } 
      .notes-box { font-size: 13px; background: #000; color: #fff; padding: 7px; margin: 6px 0; font-weight: 900; text-align: center; line-height: 1.3; } 
      .items-header { display: flex; font-size: 12px; font-weight: 900; border-bottom: 2.5px solid #000; padding-bottom: 3px; margin-bottom: 5px; color: #000; background: rgba(255,255,255,0.8); } 
      .qty-hdr { width: 35px; text-align: center; } .name-hdr { flex: 1; padding-left: 2px; } .price-hdr { width: 55px; text-align: right; } 
      .items-container { margin-bottom: 8px; min-height: 40px; background: rgba(255,255,255,0.8); padding: 0 2px; } 
      .item-line { margin-bottom: 8px; page-break-inside: avoid; border-bottom: 1px dotted #ccc; padding-bottom: 4px; } 
      .item-main { display: flex; align-items: flex-start; font-size: 15px; font-weight: 900; line-height: 1.15; } 
      .qty { width: 35px; text-align: center; flex-shrink: 0; padding-top: 2px; margin-right: 2px; font-size: 16px; font-weight: 900; } 
      .name { flex: 1; padding-right: 2px; padding-top: 2px; } 
      .price { width: 55px; text-align: right; flex-shrink: 0; padding-top: 2px; font-size: 15px; font-weight: 900; } 

      /* GUSTOS DESTACADOS EN GRANDE Y NEGRITA */
      .toppings { 
        font-size: 13.5px; 
        font-weight: 900; 
        margin-left: 15px; 
        color: #000; 
        margin-top: 3px; 
        margin-bottom: 3px; 
        font-style: normal; 
        background: #f1f5f9; 
        border-left: 4px solid #000; 
        padding: 3px 6px; 
        letter-spacing: 0.5px; 
        text-transform: uppercase;
        display: block;
      } 

      .celebration-banner {
        font-size: 14px;
        font-weight: 900;
        text-align: center;
        margin: 8px 0;
        padding: 6px 4px;
        background: #000;
        color: #fff;
        border: 2px solid #000;
        letter-spacing: 0.8px;
        text-transform: uppercase;
        border-radius: 4px;
      }

      .total-section { display: flex; justify-content: space-between; align-items: center; border-top: 3px solid #000; border-bottom: 3px solid #000; padding: 6px 2px; margin-top: 8px; background: rgba(255,255,255,0.9); } 
      .total-label { font-size: 20px; font-weight: 900; padding-left: 2px; } 
      .total-amount { font-size: 32px; font-weight: 900; letter-spacing: -1px; padding-right: 2px; } 
      .payment-detail { font-size: 13px; text-align: right; font-weight: 800; margin-top: 4px; background: #eee; padding: 5px; display: inline-block; float: right; margin-right: 2px; border: 1px solid #ccc; } 
      .footer { text-align: center; margin-top: 20px; clear: both; padding-bottom: 0; margin-bottom: 0; } 
      .fake-barcode { height: 25px; width: 100%; margin: 0 auto 10px; background: repeating-linear-gradient(to right, #000, #000 2px, transparent 2px, transparent 4px, #000 4px, #000 5px, transparent 5px, transparent 8px, #000 8px, #000 12px, transparent 12px, transparent 14px, #000 14px, #000 15px, transparent 15px, transparent 18px); } 
      .uru-banner { background: #000; color: #fff; padding: 10px 5px; margin-bottom: 8px; position: relative; } 
      .uru-banner .stars { font-size: 12px; letter-spacing: 6px; opacity: 0.9; margin-bottom: 2px; } 
      .uru-text { font-size: 16px; font-weight: 900; letter-spacing: 1px; margin: 2px 0; text-transform: uppercase; } 
      .uru-icons { font-size: 22px; letter-spacing: 10px; margin-top: 2px; } 
      .thanks { font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; background: rgba(255,255,255,0.8); padding: 2px; } 
      .page-break { page-break-after: always; break-after: page; display: block; height: 0; margin: 0; border: none; }
    </style></head>
    <body>
      ${generateTicketHTML("VÍA CLIENTE")}
      <div class="page-break"></div>
      ${generateTicketHTML("VÍA COMERCIO")}
      <script>window.onload = function() { setTimeout(() => { window.print(); setTimeout(window.close, 500); }, 500); }</script>
    </body></html>
  `);
  printWindow.document.close();
};

export interface CashClosureReportData {
  sessionId?: string | null;
  openedAt?: number;
  closedAt: number;
  initialCash: number;
  finalCash: number;
  totalSales: number;
  totalTips: number;
  orderCount: number;
  methods: Record<string, number>;
  physicalTotals: {
    metrosPizza: number;
    porcionesPizza: number;
    pizzetas: number;
    fainas: number;
    sandwiches: number;
  };
  itemsSold: Record<string, { qty: number; revenue: number }>;
  ordersList?: {
    id: string;
    time?: string;
    type?: string;
    clientName?: string;
    paymentMethod?: string;
    total: number;
    tip?: number;
  }[];
  orderTypesBreakdown?: Record<string, { count: number; total: number }>;
}

export const printCashClosureTicket = (data: CashClosureReportData) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const formattedCloseDate = new Date(data.closedAt).toLocaleDateString() + ' ' + new Date(data.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedOpenDate = data.openedAt ? new Date(data.openedAt).toLocaleDateString() + ' ' + new Date(data.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const methodsRowsHtml = Object.entries(data.methods || {})
    .map(([method, amount]) => {
      const pct = data.totalSales > 0 ? Math.round((amount / data.totalSales) * 100) : 0;
      return `<div class="info-row"><span>${method.toUpperCase()} (${pct}%)</span><b>${amount}</b></div>`;
    })
    .join('');

  const orderTypesRowsHtml = Object.entries(data.orderTypesBreakdown || {})
    .map(([type, stats]) => `<div class="info-row"><span>${type.toUpperCase()} (${stats.count} cmd)</span><b>${stats.total}</b></div>`)
    .join('');

  const itemsSoldRowsHtml = Object.entries(data.itemsSold || {})
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, itemData]) => `
      <div class="item-line">
        <div class="item-main">
          <span class="qty">${itemData.qty}x</span>
          <span class="name">${name.toUpperCase()}</span>
          <span class="price">${itemData.revenue}</span>
        </div>
      </div>
    `)
    .join('');

  const ordersListHtml = (data.ordersList || []).map(o => `
    <div class="order-list-row">
      <div class="ol-top">
        <span class="ol-id">#${o.id}</span>
        <span class="ol-time">${o.time || ''}</span>
        <span class="ol-type">${(o.type || 'Local').toUpperCase()}</span>
        <span class="ol-total">${o.total}</span>
      </div>
      <div class="ol-bottom">
        <span>${(o.clientName || 'Consumidor Final').toUpperCase()} • ${(o.paymentMethod || 'Efectivo').toUpperCase()}</span>
        ${o.tip ? `<span class="ol-tip">Prop: ${o.tip}</span>` : ''}
      </div>
    </div>
  `).join('');

  const watermarkText = "EL ÁRBOL POS - CONTABILIDAD Y CIERRE ".repeat(12);

  printWindow.document.write(`
    <!DOCTYPE html>
    <html><head><title>Cierre de Caja ${data.sessionId || ''}</title>
    <style>
      @page { 
        margin: 0; 
        size: 80mm auto; 
      } 
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      /* FONT SIZES INCREMENTADOS PARA MÁXIMA LEGIBILIDAD */
      body { 
        font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; 
        width: 76mm; 
        margin: 0 auto; 
        padding: 5px; 
        color: #000; 
        background-color: #fff; 
        font-size: 13px;
        line-height: 1.3;
      } 
      .ticket { position: relative; width: 100%; padding: 0; margin: 0; } 
      .watermark { position: absolute; top: -50%; left: -50%; width: 200%; height: 200%; font-size: 22px; font-weight: 900; color: rgba(0,0,0,0.03); text-transform: uppercase; transform: rotate(-25deg); display: flex; flex-wrap: wrap; align-content: center; justify-content: center; line-height: 1.5; pointer-events: none; z-index: 0; text-align: center; } 
      .content { position: relative; z-index: 1; width: 100%; } 
      .header { text-align: center; margin-bottom: 8px; background: #000; color: #fff; padding: 10px 4px; } 
      .brand { font-size: 26px; font-weight: 900; letter-spacing: 2px; line-height: 1; } 
      .subtitle { font-size: 11px; font-weight: 700; letter-spacing: 4px; margin-top: 4px; opacity: 0.9; } 
      .via-title { font-size: 13px; font-weight: 900; background: #fff; color: #000; display: inline-block; padding: 4px 12px; margin-top: 6px; border-radius: 8px; text-transform: uppercase; border: 1.5px solid #000; } 
      .order-id { font-size: 18px; font-weight: 900; text-align: center; margin: 6px 0; padding: 5px 0; border-top: 2.5px solid #000; border-bottom: 2.5px solid #000; letter-spacing: 1px; background: #fff; } 
      .section-title { font-size: 13px; font-weight: 900; text-align: center; background: #000; color: #fff; padding: 5px; margin: 12px 0 6px 0; text-transform: uppercase; letter-spacing: 1px; page-break-inside: avoid; break-inside: avoid; } 
      .main-info { font-size: 13px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 4px; background: #fff; padding: 0 2px; } 
      .info-row { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1px dotted #666; padding-bottom: 3px; page-break-inside: avoid; break-inside: avoid; } 
      .info-row span { font-size: 12px; font-weight: 800; color: #222; text-transform: uppercase; } 
      .info-row b { font-weight: 900; text-align: right; font-size: 14px; color: #000; } 
      .highlight-metric { display: flex; justify-content: space-between; align-items: center; background: #eee; border: 2.5px solid #000; padding: 6px 8px; margin: 6px 0; font-weight: 900; font-size: 14px; page-break-inside: avoid; break-inside: avoid; } 
      .items-header { display: flex; font-size: 12px; font-weight: 900; border-bottom: 2.5px solid #000; padding-bottom: 3px; margin-bottom: 5px; color: #000; background: #fff; } 
      .qty-hdr { width: 36px; text-align: center; } .name-hdr { flex: 1; padding-left: 2px; } .price-hdr { width: 60px; text-align: right; } 
      .items-container { margin-bottom: 8px; background: #fff; padding: 0 2px; } 
      .item-line { margin-bottom: 5px; page-break-inside: avoid; break-inside: avoid; border-bottom: 1px dotted #ddd; padding-bottom: 3px; } 
      .item-main { display: flex; align-items: flex-start; font-size: 13.5px; font-weight: 900; line-height: 1.2; } 
      .qty { width: 36px; text-align: center; flex-shrink: 0; padding-top: 1px; margin-right: 2px; font-size: 14px; font-weight: 900; color: #000; } 
      .name { flex: 1; padding-right: 2px; padding-top: 1px; } 
      .price { width: 60px; text-align: right; flex-shrink: 0; padding-top: 1px; font-size: 14px; font-weight: 900; } 
      
      .order-list-box { margin-bottom: 8px; }
      .order-list-row { border-bottom: 1.5px dashed #555; padding: 5px 0; page-break-inside: avoid; break-inside: avoid; }
      .ol-top { display: flex; justify-content: space-between; font-weight: 900; font-size: 12.5px; }
      .ol-id { width: 48px; }
      .ol-time { width: 45px; color: #333; font-size: 11px; }
      .ol-type { flex: 1; text-align: left; font-size: 11px; font-weight: 900; }
      .ol-total { width: 60px; text-align: right; font-size: 13.5px; font-weight: 900; }
      .ol-bottom { display: flex; justify-content: space-between; font-size: 11px; color: #222; font-weight: 800; margin-top: 2px; }
      .ol-tip { color: #000; font-weight: 900; }

      .total-section { display: flex; justify-content: space-between; align-items: center; border-top: 3.5px solid #000; border-bottom: 3.5px solid #000; padding: 8px 2px; margin-top: 12px; background: #fff; page-break-inside: avoid; break-inside: avoid; } 
      .total-label { font-size: 18px; font-weight: 900; } 
      .total-amount { font-size: 30px; font-weight: 900; letter-spacing: -1px; } 
      
      .signatures-area { margin-top: 24px; border-top: 2px dashed #000; padding-top: 16px; page-break-inside: avoid; break-inside: avoid; text-align: center; }
      .signature-box { margin-top: 35px; border-top: 1.5px solid #000; padding-top: 4px; font-weight: 900; font-size: 11px; text-transform: uppercase; }

      .footer { text-align: center; margin-top: 16px; clear: both; padding-bottom: 8px; page-break-inside: avoid; break-inside: avoid; } 
      .uru-banner { background: #000; color: #fff; padding: 8px 4px; margin-bottom: 6px; } 
      .uru-banner .stars { font-size: 11px; letter-spacing: 4px; opacity: 0.9; margin-bottom: 2px; } 
      .uru-text { font-size: 13px; font-weight: 900; letter-spacing: 1px; margin: 2px 0; text-transform: uppercase; } 
      .uru-icons { font-size: 18px; letter-spacing: 6px; margin-top: 2px; } 
      .thanks { font-size: 12px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; } 
    </style></head>
    <body>
      <div class="ticket">
         <div class="watermark">${watermarkText}</div>
         <div class="content">
             <div class="header">
                <div class="brand">EL ÁRBOL</div>
                <div class="subtitle">PIZZERÍA & RESTAURANTE</div>
                <div class="via-title">REPORTE CONTABLE COMPLETO</div>
             </div>
             
             <div class="order-id">${data.sessionId || 'TURNO ACTUAL'}</div>
             
             <div class="main-info">
                <div class="info-row"><span>FECHA APERTURA</span> <b>${formattedOpenDate}</b></div>
                <div class="info-row"><span>FECHA CIERRE</span> <b>${formattedCloseDate}</b></div>
                <div class="info-row"><span>COMANDAS COBRADAS</span> <b>${data.orderCount}</b></div>
             </div>

             <div class="section-title">BALANCE FINANCIERO</div>
             <div class="main-info">
                <div class="info-row"><span>CAJA INICIAL</span> <b>${data.initialCash}</b></div>
                <div class="info-row"><span>VENTAS TOTALES</span> <b>${data.totalSales}</b></div>
                <div class="info-row"><span>PROPINAS</span> <b>${data.totalTips}</b></div>
                <div class="highlight-metric"><span>EFECTIVO FINAL CAJA:</span> <span>${data.finalCash}</span></div>
             </div>

             <div class="section-title">MÉTODOS DE PAGO</div>
             <div class="main-info">
                ${methodsRowsHtml || '<div class="info-row"><span>SIN REGISTROS</span><b>$0</b></div>'}
             </div>

             <div class="section-title">CANALES / TIPOS DE SERVICIO</div>
             <div class="main-info">
                ${orderTypesRowsHtml || '<div class="info-row"><span>SIN REGISTROS</span><b>$0</b></div>'}
             </div>

             <div class="section-title">CANTIDADES Y METROS</div>
             <div class="main-info">
                <div class="highlight-metric"><span>🍕 METROS DE PIZZA:</span> <span>${data.physicalTotals?.metrosPizza || 0} m</span></div>
                <div class="info-row"><span>FAINÁS TOTALES</span> <b>${data.physicalTotals?.fainas || 0} u</b></div>
                <div class="info-row"><span>PIZZETAS TOTALES</span> <b>${data.physicalTotals?.pizzetas || 0} u</b></div>
                <div class="info-row"><span>PORCIONES DE PIZZA</span> <b>${data.physicalTotals?.porcionesPizza || 0} u</b></div>
                <div class="info-row"><span>SÁNDWICHES CALIENTES</span> <b>${data.physicalTotals?.sandwiches || 0} u</b></div>
             </div>

             <div class="section-title">DETALLE DE PRODUCTOS VENDIDOS</div>
             <div class="items-header">
                <span class="qty-hdr">CANT</span>
                <span class="name-hdr">PRODUCTO</span>
                <span class="price-hdr">IMPORTE</span>
             </div>
             
             <div class="items-container">
                ${itemsSoldRowsHtml || '<div class="item-line"><div class="item-main"><span>Sin ventas registradas</span></div></div>'}
             </div>

             ${data.ordersList && data.ordersList.length > 0 ? `
               <div class="section-title">DETALLE DE COMANDAS (${data.ordersList.length})</div>
               <div class="order-list-box">
                 ${ordersListHtml}
               </div>
             ` : ''}
             
             <div class="total-section">
                <span class="total-label">TOTAL TURNO</span>
                <span class="total-amount">${data.totalSales}</span>
             </div>

             <div class="signatures-area">
                <div class="signature-box">Firma Operador de Caja</div>
                <div class="signature-box" style="margin-top: 25px;">Firma Supervisión / Gerencia</div>
             </div>
             
             <div class="footer">
                <div class="uru-banner">
                   <div class="stars">★★★★★</div>
                   <div class="uru-text">EL ÁRBOL POS - CONTABILIDAD</div>
                   <div class="uru-icons">🍕 EL ÁRBOL 🍕</div>
                </div>
                <div class="thanks">¡INFORME DE CIERRE REGISTRADO!</div>
             </div>
         </div>
      </div>
      <script>window.onload = function() { setTimeout(() => { window.print(); setTimeout(window.close, 500); }, 500); }</script>
    </body></html>
  `);
  printWindow.document.close();
};

export const printFullAccountingReport = (data: CashClosureReportData) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const formattedCloseDate = new Date(data.closedAt).toLocaleDateString() + ' ' + new Date(data.closedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const formattedOpenDate = data.openedAt ? new Date(data.openedAt).toLocaleDateString() + ' ' + new Date(data.openedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'N/A';

  const methodsRows = Object.entries(data.methods || {})
    .map(([method, amount]) => {
      const pct = data.totalSales > 0 ? Math.round((amount / data.totalSales) * 100) : 0;
      return `<tr>
        <td style="padding: 9px 14px; font-weight: bold; font-size: 13.5px;">${method.toUpperCase()}</td>
        <td style="padding: 9px 14px; text-align: center; font-size: 13px;">${pct}%</td>
        <td style="padding: 9px 14px; text-align: right; font-weight: bold; font-size: 14px;">${amount}</td>
      </tr>`;
    }).join('');

  const orderTypesRows = Object.entries(data.orderTypesBreakdown || {})
    .map(([type, stats]) => {
      return `<tr>
        <td style="padding: 9px 14px; font-weight: bold; font-size: 13.5px;">${type.toUpperCase()}</td>
        <td style="padding: 9px 14px; text-align: center; font-size: 13px;">${stats.count}</td>
        <td style="padding: 9px 14px; text-align: right; font-weight: bold; font-size: 14px;">${stats.total}</td>
      </tr>`;
    }).join('');

  const itemsSoldRows = Object.entries(data.itemsSold || {})
    .sort((a, b) => b[1].qty - a[1].qty)
    .map(([name, itemData], idx) => `<tr>
      <td style="padding: 8px 12px; text-align: center; color: #64748b; font-size: 12px;">#${idx + 1}</td>
      <td style="padding: 8px 12px; font-weight: 700; font-size: 13.5px;">${name.toUpperCase()}</td>
      <td style="padding: 8px 12px; text-align: center; font-weight: 900; color: #2563eb; font-size: 14px;">${itemData.qty}</td>
      <td style="padding: 8px 12px; text-align: right; font-weight: 900; font-size: 14px;">${itemData.revenue}</td>
    </tr>`).join('');

  const ordersListRows = (data.ordersList || []).map(o => `<tr>
    <td style="padding: 8px 12px; font-weight: 900;">#${o.id}</td>
    <td style="padding: 8px 12px;">${o.time || '-'}</td>
    <td style="padding: 8px 12px; font-weight: 700;">${(o.type || 'Local').toUpperCase()}</td>
    <td style="padding: 8px 12px;">${(o.clientName || 'Consumidor Final').toUpperCase()}</td>
    <td style="padding: 8px 12px; text-align: center; font-size: 12px; font-weight: 700;">${(o.paymentMethod || 'Efectivo').toUpperCase()}</td>
    <td style="padding: 8px 12px; text-align: right;">${o.tip || 0}</td>
    <td style="padding: 8px 12px; text-align: right; font-weight: 900; font-size: 14px;">${o.total}</td>
  </tr>`).join('');

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Informe Completo de Contabilidad - ${data.sessionId || 'Cierre de Caja'}</title>
      <style>
        @page { 
          size: auto; 
          margin: 10mm; 
        }
        * {
          box-sizing: border-box;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; color: #0f172a; background: #fff; margin: 0; padding: 12px; font-size: 13.5px; line-height: 1.45; }
        .header-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; border-bottom: 3.5px solid #0f172a; padding-bottom: 14px; }
        .brand-title { font-size: 28px; font-weight: 900; letter-spacing: 2px; color: #0f172a; margin: 0; }
        .brand-subtitle { font-size: 12px; font-weight: 800; color: #64748b; letter-spacing: 4px; text-transform: uppercase; }
        .doc-title { font-size: 18px; font-weight: 900; text-transform: uppercase; color: #1e293b; text-align: right; margin: 0; }
        .doc-badge { display: inline-block; background: #0f172a; color: #fff; font-size: 12px; font-weight: 800; padding: 5px 12px; border-radius: 6px; margin-top: 4px; text-transform: uppercase; }
        
        .meta-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 14px; border-radius: 10px; break-inside: avoid; }
        .meta-item { display: flex; flex-direction: column; }
        .meta-label { font-size: 10.5px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; }
        .meta-val { font-size: 14px; font-weight: 900; color: #0f172a; margin-top: 2px; }
        
        .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; break-inside: avoid; }
        .kpi-card { background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 14px; text-align: center; }
        .kpi-card.primary { background: #0f172a; color: #fff; border-color: #0f172a; }
        .kpi-card.success { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
        .kpi-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; opacity: 0.85; }
        .kpi-amount { font-size: 26px; font-weight: 900; line-height: 1.1; }

        .section-header { font-size: 14px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #0f172a; background: #e2e8f0; padding: 7px 12px; border-radius: 6px; margin: 22px 0 12px 0; border-left: 5px solid #0f172a; break-inside: avoid; }

        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 18px; font-size: 13px; }
        table.data-table th { background: #f1f5f9; color: #1e293b; font-weight: 900; text-transform: uppercase; font-size: 11px; letter-spacing: 0.5px; padding: 9px 12px; border: 1px solid #cbd5e1; text-align: left; }
        table.data-table td { border: 1px solid #e2e8f0; }
        table.data-table tr { break-inside: avoid; }
        table.data-table tr:nth-child(even) td { background-color: #f8fafc; }

        .two-col-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; break-inside: avoid; }

        .signatures-area { margin-top: 40px; border-top: 2px dashed #cbd5e1; padding-top: 30px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; text-align: center; break-inside: avoid; page-break-inside: avoid; }
        .signature-line { border-top: 1.5px solid #0f172a; margin-top: 50px; padding-top: 6px; font-weight: 800; font-size: 12px; text-transform: uppercase; color: #334155; }

        .footer-note { text-align: center; margin-top: 30px; font-size: 11px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 1px; break-inside: avoid; }

        @media print {
          body { padding: 0; }
          .no-print { display: none; }
        }
      </style>
    </head>
    <body>
      <table class="header-table">
        <tr>
          <td>
            <div class="brand-title">EL ÁRBOL</div>
            <div class="brand-subtitle">PIZZERÍA & RESTAURANTE</div>
          </td>
          <td style="text-align: right;">
            <div class="doc-title">INFORME COMPLETO DE CONTABILIDAD</div>
            <div class="doc-badge">${data.sessionId || 'TURNO ACTUAL'}</div>
          </td>
        </tr>
      </table>

      <div class="meta-grid">
        <div class="meta-item"><span class="meta-label">Fecha Apertura</span><span class="meta-val">${formattedOpenDate}</span></div>
        <div class="meta-item"><span class="meta-label">Fecha Cierre</span><span class="meta-val">${formattedCloseDate}</span></div>
        <div class="meta-item"><span class="meta-label">Comandas Cobradas</span><span class="meta-val">${data.orderCount}</span></div>
        <div class="meta-item"><span class="meta-label">Efectivo Inicial</span><span class="meta-val">${data.initialCash}</span></div>
      </div>

      <div class="kpi-grid">
        <div class="kpi-card primary">
          <div class="kpi-title">Ventas Totales</div>
          <div class="kpi-amount">${data.totalSales}</div>
        </div>
        <div class="kpi-card success">
          <div class="kpi-title">Efectivo Final Caja</div>
          <div class="kpi-amount">${data.finalCash}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Propinas Recaudadas</div>
          <div class="kpi-amount">${data.totalTips}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">Promedio por Comanda</div>
          <div class="kpi-amount">${data.orderCount > 0 ? Math.round(data.totalSales / data.orderCount) : 0}</div>
        </div>
      </div>

      <div class="two-col-grid">
        <div>
          <div class="section-header">💳 Métodos de Pago</div>
          <table class="data-table">
            <thead>
              <tr><th>Método</th><th style="text-align:center">% Total</th><th style="text-align:right">Importe</th></tr>
            </thead>
            <tbody>
              ${methodsRows || '<tr><td colspan="3" style="text-align:center; padding:10px;">Sin registros</td></tr>'}
            </tbody>
          </table>
        </div>

        <div>
          <div class="section-header">📍 Canales / Tipos de Servicio</div>
          <table class="data-table">
            <thead>
              <tr><th>Canal</th><th style="text-align:center">Comandas</th><th style="text-align:right">Importe</th></tr>
            </thead>
            <tbody>
              ${orderTypesRows || '<tr><td colspan="3" style="text-align:center; padding:10px;">Sin registros</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>

      <div class="section-header">🍕 Cantidades Físicas y Métrica Metrada</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="text-align:center">Metros de Pizza</th>
            <th style="text-align:center">Fainás Totales</th>
            <th style="text-align:center">Pizzetas Totales</th>
            <th style="text-align:center">Porciones de Pizza</th>
            <th style="text-align:center">Sándwiches Calientes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align:center; font-weight:900; font-size:17px; color:#1d4ed8; padding:12px;">${data.physicalTotals?.metrosPizza || 0} m</td>
            <td style="text-align:center; font-weight:900; font-size:17px; color:#b45309; padding:12px;">${data.physicalTotals?.fainas || 0} u</td>
            <td style="text-align:center; font-weight:900; font-size:17px; color:#15803d; padding:12px;">${data.physicalTotals?.pizzetas || 0} u</td>
            <td style="text-align:center; font-weight:900; font-size:17px; color:#7e22ce; padding:12px;">${data.physicalTotals?.porcionesPizza || 0} u</td>
            <td style="text-align:center; font-weight:900; font-size:17px; color:#be123c; padding:12px;">${data.physicalTotals?.sandwiches || 0} u</td>
          </tr>
        </tbody>
      </table>

      <div class="section-header">📦 Ranking y Detalle de Productos Vendidos</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:45px; text-align:center">#</th>
            <th>Producto / Artículo</th>
            <th style="width:110px; text-align:center">Cant. Vendida</th>
            <th style="width:130px; text-align:right">Total Recaudado</th>
          </tr>
        </thead>
        <tbody>
          ${itemsSoldRows || '<tr><td colspan="4" style="text-align:center; padding:10px;">Sin ventas registradas</td></tr>'}
        </tbody>
      </table>

      ${data.ordersList && data.ordersList.length > 0 ? `
        <div class="section-header">📋 Registro de Comandas Cobradas en el Turno</div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:75px">Orden</th>
              <th style="width:65px">Hora</th>
              <th>Tipo</th>
              <th>Cliente / Destino</th>
              <th style="text-align:center">Pago</th>
              <th style="text-align:right">Propina</th>
              <th style="text-align:right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${ordersListRows}
          </tbody>
          <tfoot>
            <tr style="background:#f1f5f9; font-weight:900;">
              <td colspan="5" style="padding:10px 12px; text-align:right; text-transform:uppercase;">TOTAL REGISTRADO (${data.ordersList.length} Comandas):</td>
              <td style="padding:10px 12px; text-align:right; color:#b45309; font-size:14px;">${data.totalTips}</td>
              <td style="padding:10px 12px; text-align:right; color:#15803d; font-size:16px;">${data.totalSales}</td>
            </tr>
          </tfoot>
        </table>
      ` : ''}

      <div class="signatures-area">
        <div>
          <div class="signature-line">Firma y Aclaración - Operador de Caja</div>
        </div>
        <div>
          <div class="signature-line">Firma y Aclaración - Supervisión / Gerencia</div>
        </div>
      </div>

      <div class="footer-note">
        Sistema EL ÁRBOL POS • Impreso el ${new Date().toLocaleDateString()} a las ${new Date().toLocaleTimeString()}
      </div>

      <script>
        window.onload = function() {
          setTimeout(() => {
            window.print();
            setTimeout(window.close, 500);
          }, 500);
        };
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
};

