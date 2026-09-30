import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './Icon';
import { OrderData, OrderItem } from '../types';

interface ImportHistoryExcelModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportOrders: (importedOrders: Partial<OrderData>[]) => Promise<void>;
  onImportSessions: (importedSessions: any[]) => Promise<void>;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

interface ParsedRecord {
  id: string;
  date: string;
  timestamp: number;
  clientName: string;
  clientPhone: string;
  clientAddress: string;
  type: string;
  paymentMethod: string;
  total: number;
  itemsSummary: string;
  notes?: string;
}

export const ImportHistoryExcelModal: React.FC<ImportHistoryExcelModalProps> = ({
  isOpen,
  onClose,
  onImportOrders,
  onImportSessions,
  showMessage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRecord[]>([]);
  const [importMode, setImportMode] = useState<'orders' | 'sessions'>('orders');
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleProcessFile = (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array', cellDates: true });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          showMessage('El archivo Excel está vacío o no contiene filas legibles.', 'error');
          setIsLoading(false);
          return;
        }

        // Map columns flexibly
        const records: ParsedRecord[] = json.map((row, idx) => {
          // Look for flexible column names
          const keys = Object.keys(row);
          const findVal = (matchers: string[]): string => {
            const k = keys.find(key => matchers.some(m => key.toLowerCase().includes(m.toLowerCase())));
            return k && row[k] !== undefined ? String(row[k]).trim() : '';
          };

          const rawDate = findVal(['fecha', 'date', 'hora', 'created', 'momento', 'dia', 'día']);
          let timestamp = Date.now();
          if (rawDate) {
            const parsed = new Date(rawDate);
            if (!isNaN(parsed.getTime())) {
              timestamp = parsed.getTime();
            }
          }

          const rawTotal = findVal(['total', 'monto', 'importe', 'precio', 'valor', 'amount', 'cobrado']);
          const cleanTotal = parseFloat(rawTotal.replace(/[^0-9.-]+/g, '')) || 0;

          const clientName = findVal(['cliente', 'nombre', 'customer', 'destinatario', 'name']) || 'Consumidor Final';
          const clientPhone = findVal(['telefono', 'teléfono', 'tel', 'phone', 'celular', 'cel', 'movil', 'móvil']);
          const clientAddress = findVal(['direccion', 'dirección', 'address', 'calle', 'domicilio', 'ubicacion', 'ubicación']);
          const orderTypeRaw = findVal(['tipo', 'type', 'destino', 'modalidad', 'servicio', 'canal']) || 'Local';
          let orderType = 'Local';
          const otLower = orderTypeRaw.toLowerCase();
          if (otLower.includes('env') || otLower.includes('deliv') || otLower.includes('domic')) orderType = 'Envío';
          else if (otLower.includes('mes') || otLower.includes('sal')) orderType = 'Mesa';
          else if (otLower.includes('web') || otLower.includes('onl') || otLower.includes('what')) orderType = 'Web';

          const paymentRaw = findVal(['pago', 'medio', 'metodo', 'método', 'payment', 'forma']) || 'Efectivo';
          let paymentMethod = 'Efectivo';
          const pmLower = paymentRaw.toLowerCase();
          if (pmLower.includes('trans') || pmLower.includes('brou') || pmLower.includes('itau') || pmLower.includes('santander')) paymentMethod = 'Transferencia';
          else if (pmLower.includes('deb') || pmLower.includes('déb')) paymentMethod = 'Débito';
          else if (pmLower.includes('cred') || pmLower.includes('créd')) paymentMethod = 'Crédito';
          else if (pmLower.includes('mercad') || pmLower.includes('mp') || pmLower.includes('qr')) paymentMethod = 'Mercado Pago';

          const itemsSummary = findVal(['producto', 'item', 'items', 'detalle', 'descripcion', 'descripción', 'pedido', 'comanda']) || '1x Pedido Histórico';
          const notes = findVal(['nota', 'observacion', 'observación', 'comentario', 'obs']);
          const customId = findVal(['id', 'numero', 'número', 'nro', 'comanda', 'folio', 'orden']) || `HIST-${idx + 1}`;

          return {
            id: customId,
            date: rawDate || new Date(timestamp).toLocaleDateString(),
            timestamp,
            clientName,
            clientPhone,
            clientAddress,
            type: orderType,
            paymentMethod,
            total: cleanTotal,
            itemsSummary,
            notes,
          };
        });

        setParsedRows(records);
        showMessage(`Excel procesado: se encontraron ${records.length} registros para importar.`);
      } catch (err: any) {
        showMessage(`Error al leer el archivo Excel: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Fecha': '2026-08-20 21:30',
        'ID Pedido': 'P-101',
        'Cliente': 'GONZALO MARTÍNEZ',
        'Teléfono': '099123456',
        'Dirección': 'Av. 18 de Julio 1420 Apto 402',
        'Tipo': 'Envío',
        'Medio de Pago': 'Efectivo',
        'Total': 980,
        'Detalle Productos': '1x Metro Muzzarella (Masa fina), 2x Fainá',
        'Observaciones': 'Tocar timbre 402'
      },
      {
        'Fecha': '2026-08-20 22:15',
        'ID Pedido': 'P-102',
        'Cliente': 'MARÍA RODRÍGUEZ',
        'Teléfono': '098356320',
        'Dirección': 'Mostrador',
        'Tipo': 'Local',
        'Medio de Pago': 'Transferencia',
        'Total': 620,
        'Detalle Productos': '1/2 Metro Jamón y Morrón, 1x Coca-Cola 1.5L',
        'Observaciones': 'Retira en 15 min'
      },
      {
        'Fecha': '2026-08-21 13:00',
        'ID Pedido': 'P-103',
        'Cliente': 'MESA 4',
        'Teléfono': '',
        'Dirección': 'Salón',
        'Tipo': 'Mesa',
        'Medio de Pago': 'Débito',
        'Total': 1450,
        'Detalle Productos': '1x Metro Cuatro Quesos, 4x Cerveza Patricia 1L',
        'Observaciones': 'Servir bien fría'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Historial');
    XLSX.writeFile(workbook, 'Plantilla_Historial_Pizzeria_El_Arbol.xlsx');
    showMessage('Plantilla Excel descargada exitosamente.');
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      showMessage('No hay registros para importar.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      if (importMode === 'orders') {
        const orderObjects: Partial<OrderData>[] = parsedRows.map(r => {
          // Parse items string into simple order item array
          const items: OrderItem[] = [
            {
              id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
              name: r.itemsSummary || 'Consumo Histórico',
              price: r.total,
              finalPrice: r.total,
              quantity: 1,
            }
          ];

          return {
            id: r.id,
            type: r.type,
            reference: r.id,
            client: {
              name: r.clientName,
              phone: r.clientPhone,
              address: r.clientAddress,
            },
            items,
            total: r.total,
            paymentMethod: r.paymentMethod,
            status: 'Finalizado',
            createdAt: r.timestamp,
            time: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isPaid: true,
            isArchived: true,
            notes: r.notes || 'Importado de archivo histórico Excel',
          };
        });

        await onImportOrders(orderObjects);
        showMessage(`¡Se importaron exitosamente ${orderObjects.length} pedidos al historial de la pizzería!`);
      } else {
        // Import as closed sessions summaries
        const sessionObjects = parsedRows.map(r => ({
          closedAt: r.timestamp,
          openedAt: r.timestamp - (4 * 3600 * 1000), // 4 hours prior
          totalSales: r.total,
          finalCash: r.paymentMethod === 'Efectivo' ? r.total : 0,
          initialCash: 0,
          totalTips: 0,
          notes: `Turno histórico importado (${r.id}): ${r.itemsSummary || ''} - ${r.notes || ''}`,
          physicalTotals: { metrosPizza: 0, fainas: 0, fainasQueso: 0, fainasOrilla: 0, refrescos: 0, cervezas: 0 }
        }));

        await onImportSessions(sessionObjects);
        showMessage(`¡Se importaron exitosamente ${sessionObjects.length} turnos/sesiones al historial!`);
      }

      onClose();
    } catch (err: any) {
      showMessage(`Error al guardar en el historial: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const totalImportSum = parsedRows.reduce((acc, r) => acc + (r.total || 0), 0);

  return (
    <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 select-none">
      <div className="bg-[#0b0b14] border border-purple-500/40 rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-slate-100">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#120824] border-b border-purple-500/30 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center shadow-lg shadow-purple-600/30">
              <Icon name="table_view" size={22} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                Importar Historial desde Excel / CSV
              </h2>
              <p className="text-[11px] font-bold text-purple-300 uppercase">
                Carga pedidos o turnos anteriores de tu pizzería en un clic
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#1b1033] hover:bg-purple-900/60 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto custom-dark-scrollbar space-y-5 flex-1 bg-[#07070d]">
          
          {/* Top Options Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#100922] p-3.5 rounded-2xl border border-purple-500/25 space-y-1.5">
              <label className="text-[10px] font-black uppercase text-purple-300">Modo de Importación</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setImportMode('orders')}
                  className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                    importMode === 'orders'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#180e30] text-slate-300 hover:bg-[#221445] border border-purple-500/20'
                  }`}
                >
                  <Icon name="receipt_long" size={14} />
                  <span>Pedidos</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportMode('sessions')}
                  className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 ${
                    importMode === 'sessions'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                      : 'bg-[#180e30] text-slate-300 hover:bg-[#221445] border border-purple-500/20'
                  }`}
                >
                  <Icon name="history" size={14} />
                  <span>Turnos / Caja</span>
                </button>
              </div>
            </div>

            <div className="bg-[#100922] p-3.5 rounded-2xl border border-purple-500/25 flex flex-col justify-between">
              <div>
                <div className="text-[10px] font-black uppercase text-purple-300">¿No tienes el formato exacto?</div>
                <p className="text-[11px] text-slate-400 font-bold uppercase mt-0.5">
                  El sistema detecta automáticamente cualquier columna (fecha, cliente, total, etc.)
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="mt-2 py-1.5 px-3 bg-[#1c0e3a] hover:bg-[#291456] text-purple-200 border border-purple-500/40 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 self-start"
              >
                <Icon name="download" size={14} className="text-purple-400" />
                <span>Descargar Plantilla Excel Ejemplo (.xlsx)</span>
              </button>
            </div>
          </div>

          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                handleProcessFile(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-3xl p-6 sm:p-8 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-purple-400 bg-purple-950/40'
                : 'border-purple-500/30 bg-[#0d071a] hover:border-purple-500/60 hover:bg-[#140b29]'
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleProcessFile(e.target.files[0]);
                }
              }}
              accept=".xlsx,.xls,.csv"
              className="hidden"
            />
            <div className="w-14 h-14 bg-purple-950/80 text-purple-400 rounded-2xl flex items-center justify-center mx-auto border border-purple-500/40 shadow-inner mb-3">
              <Icon name="upload_file" size={30} />
            </div>
            <div className="font-black text-sm uppercase text-white">
              {file ? file.name : 'Haz clic aquí o arrastra tu archivo Excel (.xlsx / .xls / .csv)'}
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase mt-1">
              Compatible con exportaciones de sistemas anteriores, Excel y Google Sheets
            </p>
          </div>

          {/* Preview Table if rows loaded */}
          {parsedRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black uppercase text-purple-300">
                    Vista Previa de Filas Detectadas
                  </span>
                  <span className="bg-purple-950 text-purple-300 px-2 py-0.5 rounded-full text-[10px] font-black border border-purple-500/40 font-mono">
                    {parsedRows.length} registros
                  </span>
                </div>
                <div className="text-xs font-black uppercase text-white">
                  Suma Total: <span className="text-purple-400 font-black font-mono text-sm">${totalImportSum}</span>
                </div>
              </div>

              <div className="border border-purple-500/30 rounded-2xl overflow-hidden bg-[#0a0515] max-h-56 overflow-y-auto custom-dark-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#150a2b] border-b border-purple-500/30 text-purple-300 uppercase text-[9px] font-black tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">ID / Fecha</th>
                      <th className="p-2.5">Cliente</th>
                      <th className="p-2.5">Destino</th>
                      <th className="p-2.5">Medio Pago</th>
                      <th className="p-2.5">Detalle</th>
                      <th className="p-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15 text-[11px]">
                    {parsedRows.slice(0, 50).map((r, i) => (
                      <tr key={i} className="hover:bg-purple-950/40 transition-colors">
                        <td className="p-2.5 font-mono text-purple-300">
                          <div className="font-black text-white">{r.id}</div>
                          <div className="text-[9px] text-slate-400">{r.date}</div>
                        </td>
                        <td className="p-2.5 font-black uppercase text-slate-200">
                          <div>{r.clientName}</div>
                          {r.clientPhone && <div className="text-[9px] text-slate-400 font-mono">📞 {r.clientPhone}</div>}
                          {r.clientAddress && <div className="text-[9px] text-slate-400 truncate max-w-[150px]">📍 {r.clientAddress}</div>}
                        </td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#180e30] text-blue-300 border border-blue-500/30">
                            {r.type}
                          </span>
                        </td>
                        <td className="p-2.5 uppercase font-bold text-slate-300 text-[10px]">
                          {r.paymentMethod}
                        </td>
                        <td className="p-2.5 text-slate-300 text-[10px] max-w-[200px] truncate" title={r.itemsSummary}>
                          {r.itemsSummary}
                        </td>
                        <td className="p-2.5 text-right font-black text-white font-mono text-xs">
                          ${r.total}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parsedRows.length > 50 && (
                <div className="text-[10px] text-slate-400 text-center font-bold uppercase italic">
                  Mostrando las primeras 50 filas de un total de {parsedRows.length} registros.
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#120824] border-t border-purple-500/30 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="py-2.5 px-5 bg-[#1a0e33] hover:bg-[#251448] text-slate-300 rounded-xl font-black uppercase text-xs transition-all border border-purple-500/20"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={parsedRows.length === 0 || isLoading}
            onClick={handleConfirmImport}
            className={`py-3 px-6 rounded-xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg ${
              parsedRows.length === 0 || isLoading
                ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                : 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30'
            }`}
          >
            {isLoading ? (
              <>
                <Icon name="restart_alt" className="animate-spin" size={16} />
                <span>Importando registros...</span>
              </>
            ) : (
              <>
                <Icon name="cloud_upload" size={16} />
                <span>Confirmar e Importar {parsedRows.length} Registros</span>
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
};
