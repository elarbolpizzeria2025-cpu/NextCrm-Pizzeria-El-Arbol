import { OrderData, SessionData, MenuItem, StockItem } from '../types';

export const exportToCSV = (filename: string, rows: (string | number)[][]) => {
  const csvContent = "\uFEFF" + rows.map(row => 
    row.map(cell => {
      const str = String(cell ?? '').replace(/"/g, '""');
      return `"${str}"`;
    }).join(";")
  ).join("\n"); 
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

export const exportToPDF = (title: string, htmlContent: string) => {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(`
    <html><head><title>${title}</title><style>
      @page { size: auto; margin: 12mm; }
      * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      body { font-family: 'Segoe UI', -apple-system, sans-serif; padding: 10px; color: #0f172a; background: #fff; font-size: 12px; }
      .header-box { border-bottom: 3px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: flex-end; }
      h1 { font-size: 24px; font-weight: 900; text-transform: uppercase; margin: 0; color: #0f172a; letter-spacing: 1px; }
      .brand-sub { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 2px; }
      .doc-meta { text-align: right; font-size: 11px; font-weight: 700; color: #64748b; }
      h2 { font-size: 15px; margin-top: 24px; margin-bottom: 8px; color: #0f172a; font-weight: 800; text-transform: uppercase; border-left: 4px solid #0f172a; padding-left: 8px; }
      table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 20px; font-size: 11.5px; }
      th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
      th { background-color: #f1f5f9; font-weight: 800; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px; color: #334155; }
      tr:nth-child(even) td { background-color: #f8fafc; }
      .text-right { text-align: right; }
      .text-center { text-align: center; }
      .font-bold { font-weight: 800; }
      .kpi-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
      .kpi-card { background: #f8fafc; border: 1.5px solid #cbd5e1; padding: 12px; border-radius: 8px; text-align: center; }
      .kpi-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; }
      .kpi-value { font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 2px; }
      .footer { margin-top: 30px; font-size: 10px; font-weight: 700; color: #94a3b8; text-align: center; text-transform: uppercase; border-top: 1px solid #e2e8f0; padding-top: 12px; }
    </style></head><body>
      <div class="header-box">
        <div>
          <div class="brand-sub">EL ÁRBOL PIZZERÍA & RESTAURANTE</div>
          <h1>${title}</h1>
        </div>
        <div class="doc-meta">
          <div>Fecha: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
          <div>Sistema EL ÁRBOL POS</div>
        </div>
      </div>
      ${htmlContent}
      <div class="footer">Documento Oficial Generado por el Sistema EL ÁRBOL POS</div>
      <script>window.onload = function() { setTimeout(() => { window.print(); setTimeout(window.close, 500); }, 500); }</script>
    </body></html>
  `);
  printWindow.document.close();
};

export const exportOrdersToCSV = (orders: OrderData[], filename = 'Historial_Ventas_ElArbol') => {
  const headers = [
    'ID Comanda',
    'Fecha',
    'Hora',
    'Tipo de Envío / Servicio',
    'Cliente',
    'Teléfono',
    'Dirección',
    'Zona',
    'Método de Pago',
    'Estado',
    'Repartidor',
    'Detalle de Productos y Gustos',
    'Subtotal ($)',
    'Propina ($)',
    'Total ($)',
    'Notas / Observaciones'
  ];

  const rows = orders.map(o => {
    const itemsDetail = o.items.map(it => {
      const toppings = it.selectedToppings && it.selectedToppings.length > 0 
        ? ` [GUSTOS: ${it.selectedToppings.map(t => t.name).join(', ')}]` 
        : '';
      return `${it.quantity || 1}x ${it.name}${toppings} (${Math.round((it.finalPrice || 0) * (it.quantity || 1))})`;
    }).join(' | ');

    return [
      o.id,
      new Date(o.createdAt).toLocaleDateString(),
      o.time || '',
      o.type || 'Local',
      o.client?.name || 'Consumidor Final',
      o.client?.phone || '',
      o.client?.address || '',
      o.client?.zone || '',
      o.paymentMethod || 'Efectivo',
      o.status,
      o.assignedDriver || '',
      itemsDetail,
      o.total,
      o.tip || 0,
      (o.total || 0) + (o.tip || 0),
      o.notes || ''
    ];
  });

  exportToCSV(filename, [headers, ...rows]);
};

export const exportOrdersToPDF = (orders: OrderData[], title = 'Historial de Ventas') => {
  const totalSales = orders.reduce((sum, o) => sum + (o.total || 0), 0);
  const totalTips = orders.reduce((sum, o) => sum + (o.tip || 0), 0);
  const totalRevenue = totalSales + totalTips;

  const rowsHtml = orders.map((o, idx) => `
    <tr>
      <td class="font-bold">${o.id}</td>
      <td>${new Date(o.createdAt).toLocaleDateString()} ${o.time || ''}</td>
      <td class="font-bold">${(o.type || 'Local').toUpperCase()}</td>
      <td>${(o.client?.name || 'Consumidor Final').toUpperCase()}${o.client?.phone ? `<br><small style="color:#64748b;">Tel: ${o.client.phone}</small>` : ''}</td>
      <td class="text-center font-bold">${(o.paymentMethod || 'Efectivo').toUpperCase()}</td>
      <td style="font-size:11px;">
        ${o.items.map(it => {
          const toppings = it.selectedToppings && it.selectedToppings.length > 0 
            ? ` <b style="color:#b45309;">(GUSTOS: ${it.selectedToppings.map(t => t.name).join(', ')})</b>` 
            : '';
          return `<div>• ${it.quantity || 1}x ${it.name}${toppings}</div>`;
        }).join('')}
        ${o.notes ? `<div style="color:#b45309; font-style:italic; margin-top:2px;">Nota: ${o.notes}</div>` : ''}
      </td>
      <td class="text-right text-slate-500">${o.tip || 0}</td>
      <td class="text-right font-bold" style="font-size:13px;">${o.total}</td>
    </tr>
  `).join('');

  const html = `
    <div class="kpi-row">
      <div class="kpi-card">
        <div class="kpi-label">Total Comandas</div>
        <div class="kpi-value">${orders.length}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Ventas Netas</div>
        <div class="kpi-value">${totalSales}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Propinas</div>
        <div class="kpi-value">${totalTips}</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Recaudación Total</div>
        <div class="kpi-value" style="color:#16a34a;">${totalRevenue}</div>
      </div>
    </div>

    <h2>Listado Detallado de Ventas Registradas</h2>
    <table>
      <thead>
        <tr>
          <th style="width:65px;">Comanda</th>
          <th style="width:105px;">Fecha / Hora</th>
          <th style="width:80px;">Tipo</th>
          <th style="width:140px;">Cliente</th>
          <th style="width:85px; text-align:center;">Pago</th>
          <th>Detalle Productos & Gustos</th>
          <th style="width:65px; text-align:right;">Propina</th>
          <th style="width:75px; text-align:right;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="background:#f1f5f9; font-weight:900;">
          <td colspan="6" class="text-right" style="font-size:12px;">TOTAL GENERAL (${orders.length} VENTAS):</td>
          <td class="text-right" style="color:#b45309;">${totalTips}</td>
          <td class="text-right" style="color:#16a34a; font-size:14px;">${totalSales}</td>
        </tr>
      </tfoot>
    </table>
  `;

  exportToPDF(title, html);
};

export const exportSessionsToCSV = (sessions: SessionData[], filename = 'Historial_Cierres_Caja_ElArbol') => {
  const headers = [
    'ID Sesión',
    'Fecha Apertura',
    'Fecha Cierre',
    'Comandas Cobradas',
    'Efectivo Inicial ($)',
    'Ventas Totales ($)',
    'Propinas ($)',
    'Efectivo Final en Caja ($)',
    'Metros de Pizza',
    'Fainás Totales',
    'Pizzetas Totales',
    'Porciones Pizza',
    'Sándwiches',
    'Efectivo ($)',
    'Débito ($)',
    'Crédito ($)',
    'Transferencia ($)',
    'Mercado Pago ($)'
  ];

  const rows = sessions.map(s => [
    s.sessionId || s.firestoreId || '',
    s.openedAt ? `${new Date(s.openedAt).toLocaleDateString()} ${new Date(s.openedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}` : 'N/A',
    `${new Date(s.closedAt).toLocaleDateString()} ${new Date(s.closedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}`,
    s.orderCount || 0,
    s.initialCash || 0,
    s.totalSales || 0,
    s.totalTips || 0,
    s.finalCash || 0,
    s.physicalTotals?.metrosPizza || 0,
    s.physicalTotals?.fainas || 0,
    s.physicalTotals?.pizzetas || 0,
    s.physicalTotals?.porcionesPizza || 0,
    s.physicalTotals?.sandwiches || 0,
    s.methodsBreakdown?.['Efectivo'] || 0,
    s.methodsBreakdown?.['Débito'] || 0,
    s.methodsBreakdown?.['Crédito'] || 0,
    s.methodsBreakdown?.['Transferencia'] || 0,
    s.methodsBreakdown?.['Mercado Pago'] || 0
  ]);

  exportToCSV(filename, [headers, ...rows]);
};

export const exportMenuToCSV = (menu: Record<string, MenuItem[]>, filename = 'Menu_Productos_ElArbol') => {
  const headers = ['Categoría', 'ID Producto', 'Nombre', 'Precio ($)', 'Descripción / Ingredientes', 'Modalidad', 'Tiene Gustos / Toppings', 'Máx Gustos'];
  const rows: (string | number)[][] = [];

  Object.entries(menu).forEach(([catKey, items]) => {
    items.forEach(it => {
      rows.push([
        catKey.toUpperCase(),
        it.id,
        it.name,
        it.price,
        it.desc || '',
        it.isMeter ? 'Por Metro' : (it.isPortion ? 'Porción' : 'Unidad Estándar'),
        it.hasToppings ? 'SÍ' : 'NO',
        it.maxToppings || 0
      ]);
    });
  });

  exportToCSV(filename, [headers, ...rows]);
};

export const exportMenuToPDF = (menu: Record<string, MenuItem[]>) => {
  let tablesHtml = '';
  Object.entries(menu).forEach(([catKey, items]) => {
    const rows = items.map(it => `
      <tr>
        <td class="font-bold">${it.name.toUpperCase()}</td>
        <td>${it.desc || '-'}</td>
        <td class="text-center">${it.isMeter ? 'Por Metro' : (it.isPortion ? 'Porción' : 'Unidad')}</td>
        <td class="text-center">${it.hasToppings ? `Sí (Hasta ${it.maxToppings || 4})` : 'No'}</td>
        <td class="text-right font-bold" style="font-size:13px; color:#16a34a;">${it.price}</td>
      </tr>
    `).join('');

    tablesHtml += `
      <h2>Categoría: ${catKey.toUpperCase()} (${items.length} productos)</h2>
      <table>
        <thead>
          <tr>
            <th style="width:200px;">Producto</th>
            <th>Descripción / Ingredientes</th>
            <th style="width:90px; text-align:center;">Tipo</th>
            <th style="width:100px; text-align:center;">Gustos</th>
            <th style="width:80px; text-align:right;">Precio</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `;
  });

  exportToPDF('Catálogo de Menú y Precios', tablesHtml);
};

export const exportStockToCSV = (
  stockItems: StockItem[], 
  initialStock: Record<string, number> = {}, 
  currentStock: Record<string, number> = {}, 
  filename = 'Control_Stock_ElArbol'
) => {
  const headers = ['Categoría', 'Artículo / Insumo', 'Unidad de Medida', 'Stock Inicial del Turno', 'Stock Actual en Caja'];
  const rows = stockItems.map(item => [
    item.category || 'General',
    item.name,
    item.unit || 'Unidades',
    initialStock[item.firestoreId] ?? 0,
    currentStock[item.firestoreId] ?? 0
  ]);

  exportToCSV(filename, [headers, ...rows]);
};

