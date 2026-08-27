import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './Icon';
import { MenuItem } from '../types';

interface ImportMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportMenu: (importedMenu: Record<string, MenuItem[]>, replaceExisting: boolean) => Promise<void>;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

interface ParsedMenuItemRow {
  category: string;
  name: string;
  desc: string;
  price: number;
  isMeter: boolean;
  isPortion: boolean;
  hasToppings: boolean;
  maxToppings: number;
  isValid: boolean;
}

export const ImportMenuModal: React.FC<ImportMenuModalProps> = ({
  isOpen,
  onClose,
  onImportMenu,
  showMessage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedMenuItemRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const mapJsonToMenuItems = (json: any[]): ParsedMenuItemRow[] => {
    return json.map((row) => {
      const keys = Object.keys(row);
      const findVal = (matchers: string[]): string => {
        const k = keys.find(key => matchers.some(m => key.toLowerCase().trim() === m.toLowerCase() || key.toLowerCase().includes(m.toLowerCase())));
        return k && row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
      };

      const rawCategory = findVal(['categoria', 'categoría', 'category', 'seccion', 'sección', 'rubro', 'grupo']) || 'Pizzas';
      const cleanCategory = rawCategory.trim().toLowerCase();
      
      let category = 'pizzas';
      if (cleanCategory.includes('figaza')) category = 'figazas';
      else if (cleanCategory.includes('fain') || cleanCategory.includes('faina')) category = 'fainas';
      else if (cleanCategory.includes('pizzet')) category = 'pizzetas';
      else if (cleanCategory.includes('sandw') || cleanCategory.includes('sándw') || cleanCategory.includes('chivito') || cleanCategory.includes('lomito')) category = 'sandwiches';
      else if (cleanCategory.includes('bebid') || cleanCategory.includes('refresc') || cleanCategory.includes('cervez') || cleanCategory.includes('trago')) category = 'bebidas';
      else if (cleanCategory.includes('postr') || cleanCategory.includes('dulc') || cleanCategory.includes('helad') || cleanCategory.includes('flan')) category = 'postres';
      else if (cleanCategory.includes('gusto') || cleanCategory.includes('topp') || cleanCategory.includes('ingred')) category = 'gustos';
      else if (cleanCategory.includes('promo') || cleanCategory.includes('combo') || cleanCategory.includes('oferta')) category = 'promos';
      else category = cleanCategory; // custom category

      const name = findVal(['nombre', 'producto', 'articulo', 'artículo', 'item', 'name', 'titulo']);
      const desc = findVal(['descripcion', 'descripción', 'desc', 'detalle', 'ingredientes', 'obs', 'nota']);
      const rawPrice = findVal(['precio', 'price', 'costo', 'valor', 'monto', '$', 'importe']);
      const cleanPrice = parseFloat(rawPrice.replace(/[^0-9.-]+/g, '')) || 0;

      const formatRaw = findVal(['formato', 'tipo', 'unidad', 'es_metro', 'metro', 'porcion', 'porción', 'unit']).toLowerCase();
      const isMeter = formatRaw.includes('metro') || ['pizzas', 'figazas'].includes(category);
      const isPortion = formatRaw.includes('porcion') || formatRaw.includes('porción') || category === 'fainas';

      const hasToppingsRaw = findVal(['gustos', 'toppings', 'lleva_gustos', 'personalizable']).toLowerCase();
      const hasToppings = ['si', 'sí', 'true', '1', 'yes'].includes(hasToppingsRaw) || category === 'pizzas';
      const maxToppings = hasToppings ? (parseInt(findVal(['max_gustos', 'max_toppings', 'limite_gustos']), 10) || 4) : 0;

      const isValid = Boolean(name && name.length > 0);

      return {
        category,
        name,
        desc,
        price: cleanPrice,
        isMeter,
        isPortion,
        hasToppings,
        maxToppings,
        isValid,
      };
    }).filter(r => r.isValid);
  };

  const handleProcessFile = (selectedFile: File) => {
    setFile(selectedFile);
    setIsLoading(true);

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        if (!json || json.length === 0) {
          showMessage('El archivo Excel/CSV está vacío o no contiene filas legibles.', 'error');
          setIsLoading(false);
          return;
        }

        const rows = mapJsonToMenuItems(json);
        setParsedRows(rows);
        showMessage(`Menú procesado: ${rows.length} productos detectados en ${new Set(rows.map(r => r.category)).size} categorías.`, 'success');
      } catch (err: any) {
        showMessage(`Error al leer el archivo de menú: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleProcessPastedText = () => {
    if (!rawText.trim()) {
      showMessage('Por favor pegue texto con productos del menú.', 'error');
      return;
    }

    try {
      if (rawText.trim().startsWith('[') || rawText.trim().startsWith('{')) {
        const parsed = JSON.parse(rawText);
        const array = Array.isArray(parsed) ? parsed : Object.keys(parsed).flatMap(k => parsed[k]);
        const items = mapJsonToMenuItems(array);
        setParsedRows(items);
        showMessage(`Se procesaron ${items.length} productos desde JSON.`, 'success');
        return;
      }

      const lines = rawText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));

      const firstRow = rows[0].map(c => c.toLowerCase());
      const hasHeader = firstRow.some(c => ['categoria', 'producto', 'nombre', 'precio', 'price', 'desc'].includes(c));

      const header = hasHeader ? rows[0] : ['categoria', 'nombre', 'precio', 'descripcion'];
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const json = dataRows.map(r => {
        const obj: Record<string, string> = {};
        header.forEach((h, idx) => {
          obj[h] = r[idx] || '';
        });
        return obj;
      });

      const items = mapJsonToMenuItems(json);
      setParsedRows(items);
      showMessage(`Texto procesado: ${items.length} productos listos para el menú.`, 'success');
    } catch (err: any) {
      showMessage(`Error al procesar texto de menú: ${err.message}`, 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Categoría': 'pizzas',
        'Nombre': 'Muzzarella',
        'Descripción': 'Salsa casera de tomate, doble muzzarella artesanal y orégano',
        'Precio': 520,
        'Formato': 'Metro',
        'Lleva Gustos': 'Si',
        'Max Gustos': 4
      },
      {
        'Categoría': 'pizzas',
        'Nombre': 'Fugazzeta Rellena',
        'Descripción': 'Rellena de muzzarella y jamón con cebolla caramelizada',
        'Precio': 640,
        'Formato': 'Metro',
        'Lleva Gustos': 'Si',
        'Max Gustos': 4
      },
      {
        'Categoría': 'fainas',
        'Nombre': 'Fainá Común',
        'Descripción': 'Porción crocante recién horneada',
        'Precio': 95,
        'Formato': 'Porción',
        'Lleva Gustos': 'No',
        'Max Gustos': 0
      },
      {
        'Categoría': 'fainas',
        'Nombre': 'Fainá con Queso',
        'Descripción': 'Porción con gratén de muzzarella fundida',
        'Precio': 140,
        'Formato': 'Porción',
        'Lleva Gustos': 'No',
        'Max Gustos': 0
      },
      {
        'Categoría': 'bebidas',
        'Nombre': 'Coca-Cola 1.5L',
        'Descripción': 'Sabor Original / Sin Azúcar bien fría',
        'Precio': 190,
        'Formato': 'Unidad',
        'Lleva Gustos': 'No',
        'Max Gustos': 0
      },
      {
        'Categoría': 'bebidas',
        'Nombre': 'Cerveza Patricia 1L',
        'Descripción': 'Botella retornable 1 Litro',
        'Precio': 230,
        'Formato': 'Unidad',
        'Lleva Gustos': 'No',
        'Max Gustos': 0
      },
      {
        'Categoría': 'postres',
        'Nombre': 'Flan Casero con Dulce de Leche',
        'Descripción': 'Flan con caramelo y dulce de leche Conaprole',
        'Precio': 170,
        'Formato': 'Unidad',
        'Lleva Gustos': 'No',
        'Max Gustos': 0
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Menu');
    XLSX.writeFile(workbook, 'Plantilla_Menu_Pizzeria.xlsx');
    showMessage('Plantilla de Menú descargada exitosamente.');
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      showMessage('No hay productos para importar.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const menuMap: Record<string, MenuItem[]> = {};

      parsedRows.forEach((r, idx) => {
        const cat = r.category || 'pizzas';
        if (!menuMap[cat]) {
          menuMap[cat] = [];
        }

        menuMap[cat].push({
          id: `${cat}-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
          name: r.name,
          desc: r.desc || '',
          price: r.price,
          isMeter: r.isMeter,
          isPortion: r.isPortion,
          hasToppings: r.hasToppings,
          maxToppings: r.maxToppings,
        });
      });

      await onImportMenu(menuMap, replaceExisting);
      showMessage(`¡Menú importado con éxito! Se cargaron ${parsedRows.length} productos en ${Object.keys(menuMap).length} categorías.`, 'success');
      onClose();
    } catch (err: any) {
      showMessage(`Error al guardar menú: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Grouping for preview
  const categoriesCount = new Set(parsedRows.map(r => r.category)).size;

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0518] border border-purple-500/40 rounded-[35px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20 flex justify-between items-center bg-[#100723]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black">
              <Icon name="restaurant_menu" size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">Importar Carta / Menú de Productos</h2>
              <p className="text-[11px] text-purple-300 font-bold uppercase tracking-wider">
                Carga masiva de pizzas, bebidas, precios y categorías desde Excel o texto
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-[#1a0c36] hover:bg-[#281353] text-slate-300 hover:text-white transition-colors"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 no-scrollbar">
          
          {/* Action Tabs & Template */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setInputMode('file')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                  inputMode === 'file'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#150a2b] text-slate-300 hover:bg-[#200f40] border border-purple-500/20'
                }`}
              >
                <Icon name="upload_file" size={16} /> Subir Archivo Excel / CSV
              </button>
              <button
                type="button"
                onClick={() => setInputMode('paste')}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-2 ${
                  inputMode === 'paste'
                    ? 'bg-purple-600 text-white'
                    : 'bg-[#150a2b] text-slate-300 hover:bg-[#200f40] border border-purple-500/20'
                }`}
              >
                <Icon name="content_paste" size={16} /> Pegar Lista / JSON
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-[#170a2c] hover:bg-[#241044] border border-purple-500/30 text-purple-300 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5"
              title="Descargar plantilla de Excel con categorías y productos de ejemplo"
            >
              <Icon name="download" size={15} /> Descargar Plantilla Menú
            </button>
          </div>

          {/* Mode 1: File Upload */}
          {inputMode === 'file' && (
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleProcessFile(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-3xl p-8 text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-purple-400 bg-purple-950/40'
                  : 'border-purple-500/30 bg-[#080312] hover:border-purple-400 hover:bg-[#120726]'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,.tsv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleProcessFile(e.target.files[0]);
                  }
                }}
              />
              <Icon name="menu_book" size={44} className="mx-auto text-purple-400 mb-2" />
              <div className="font-black text-sm uppercase text-white">
                {file ? `Archivo: ${file.name}` : 'Arrastra o haz clic para subir tu Excel de Menú'}
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase mt-1">
                Columnas: Categoría, Nombre, Descripción, Precio, Formato (Metro/Porción/Unidad), Gustos
              </p>
            </div>
          )}

          {/* Mode 2: Paste Raw Text */}
          {inputMode === 'paste' && (
            <div className="space-y-3">
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Pega aquí el menú copiado de Excel, WhatsApp o JSON...\nEjemplo:\nPizzas\tMuzzarella Especial\t520\tSalsa casera y doble queso\nBebidas\tCoca-Cola 1.5L\t190\tBien fría\nPostres\tFlan Casero\t170\tCon dulce de leche`}
                className="w-full p-4 bg-[#070310] border border-purple-500/30 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2"
              >
                <Icon name="bolt" size={16} /> Procesar Menú Pegado
              </button>
            </div>
          )}

          {/* Import Strategy Switch */}
          <div className="p-4 bg-[#0e071f] border border-purple-500/25 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-black uppercase text-white">Estrategia de Guardado</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {replaceExisting
                  ? '⚠️ Reemplazar todo el menú existente con los productos de este archivo.'
                  : '✅ Fusionar: agregar los nuevos productos a las categorías existentes.'}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-purple-300">Reemplazar Menú</span>
            </label>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-2">
                  <Icon name="visibility" size={16} /> Vista Previa ({parsedRows.length} productos en {categoriesCount} categorías)
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Primeros {Math.min(10, parsedRows.length)} artículos
                </span>
              </div>

              <div className="border border-purple-500/30 rounded-2xl overflow-hidden bg-[#070310] max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#150a2b] text-purple-300 uppercase text-[9px] font-black tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Categoría</th>
                      <th className="p-2.5">Nombre</th>
                      <th className="p-2.5">Descripción</th>
                      <th className="p-2.5 text-right">Precio</th>
                      <th className="p-2.5 text-center">Formato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15 text-[11px]">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-purple-950/20">
                        <td className="p-2.5 font-black uppercase text-purple-300">{r.category}</td>
                        <td className="p-2.5 font-black uppercase text-white">{r.name}</td>
                        <td className="p-2.5 text-slate-400 truncate max-w-xs">{r.desc || '-'}</td>
                        <td className="p-2.5 text-right font-mono font-black text-white">${r.price}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#180b33] text-purple-300 border border-purple-500/30">
                            {r.isMeter ? 'Metro' : r.isPortion ? 'Porción' : 'Unidad'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-6 border-t border-purple-500/20 bg-[#100723] flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-400 font-bold uppercase">
            {parsedRows.length > 0
              ? `Listo para cargar: ${parsedRows.length} productos`
              : 'Seleccione archivo o pegue el menú para continuar'}
          </div>

          <div className="flex gap-2.5 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-5 py-3 rounded-2xl bg-[#1b0d36] hover:bg-[#281350] text-slate-300 font-black uppercase text-xs transition-colors"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmImport}
              disabled={isLoading || parsedRows.length === 0}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                parsedRows.length > 0 && !isLoading
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size={16} className="animate-spin" /> Guardando Menú...
                </>
              ) : (
                <>
                  <Icon name="cloud_done" size={16} /> Importar Menú ({parsedRows.length})
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
