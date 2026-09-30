import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './Icon';
import { StockItem } from '../types';

interface ImportStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportStock: (items: Partial<StockItem>[], replaceExisting: boolean) => Promise<void>;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

interface ParsedStockRow {
  name: string;
  category: string;
  unit: string;
  isValid: boolean;
}

export const ImportStockModal: React.FC<ImportStockModalProps> = ({
  isOpen,
  onClose,
  onImportStock,
  showMessage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedRows, setParsedRows] = useState<ParsedStockRow[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const mapJsonToStockItems = (json: any[]): ParsedStockRow[] => {
    return json.map((row) => {
      const keys = Object.keys(row);
      const findVal = (matchers: string[]): string => {
        const k = keys.find(key => matchers.some(m => key.toLowerCase().trim() === m.toLowerCase() || key.toLowerCase().includes(m.toLowerCase())));
        return k && row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
      };

      const name = findVal(['nombre', 'articulo', 'artículo', 'producto', 'item', 'name']);
      const rawCategory = findVal(['categoria', 'categoría', 'rubro', 'grupo', 'seccion', 'sección']) || 'General';
      const rawUnit = findVal(['unidad', 'unit', 'medida', 'formato', 'tipo']) || 'Unidades';

      let unit = 'Unidades';
      const uLower = rawUnit.toLowerCase();
      if (uLower.includes('metr') || uLower.includes('mts') || uLower === 'm') unit = 'Metros';
      else if (uLower.includes('porc')) unit = 'Porciones';
      else if (uLower.includes('litr') || uLower === 'l' || uLower === 'lt') unit = 'Litros';
      else if (uLower.includes('kilo') || uLower === 'kg') unit = 'Kilos';
      else if (uLower.includes('paq') || uLower.includes('pack')) unit = 'Paquetes';

      const isValid = Boolean(name && name.length > 0);

      return {
        name,
        category: rawCategory,
        unit,
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

        const rows = mapJsonToStockItems(json);
        setParsedRows(rows);
        showMessage(`Stock procesado: ${rows.length} artículos detectados.`, 'success');
      } catch (err: any) {
        showMessage(`Error al leer archivo de stock: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleProcessPastedText = () => {
    if (!rawText.trim()) {
      showMessage('Por favor pegue texto con artículos de stock.', 'error');
      return;
    }

    try {
      const lines = rawText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));

      const firstRow = rows[0].map(c => c.toLowerCase());
      const hasHeader = firstRow.some(c => ['nombre', 'articulo', 'producto', 'unidad', 'categoria'].includes(c));

      const header = hasHeader ? rows[0] : ['nombre', 'categoria', 'unidad'];
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const json = dataRows.map(r => {
        const obj: Record<string, string> = {};
        header.forEach((h, idx) => {
          obj[h] = r[idx] || '';
        });
        return obj;
      });

      const items = mapJsonToStockItems(json);
      setParsedRows(items);
      showMessage(`Texto procesado: ${items.length} artículos de inventario listos.`, 'success');
    } catch (err: any) {
      showMessage(`Error al procesar texto de stock: ${err.message}`, 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Nombre del Artículo': 'Pizza',
        'Categoría': 'Pizzas',
        'Unidad': 'Metros'
      },
      {
        'Nombre del Artículo': 'Figaza',
        'Categoría': 'Figazas',
        'Unidad': 'Metros'
      },
      {
        'Nombre del Artículo': 'Fainá',
        'Categoría': 'Fainá',
        'Unidad': 'Porciones'
      },
      {
        'Nombre del Artículo': 'Pizzeta',
        'Categoría': 'Pizzetas',
        'Unidad': 'Unidades'
      },
      {
        'Nombre del Artículo': 'Refresco 1.5L',
        'Categoría': 'Bebidas',
        'Unidad': 'Unidades'
      },
      {
        'Nombre del Artículo': 'Cerveza 1L',
        'Categoría': 'Bebidas',
        'Unidad': 'Unidades'
      },
      {
        'Nombre del Artículo': 'Muzzarella en Barra',
        'Categoría': 'Materia Prima',
        'Unidad': 'Kilos'
      },
      {
        'Nombre del Artículo': 'Harina 000',
        'Categoría': 'Materia Prima',
        'Unidad': 'Kilos'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Stock');
    XLSX.writeFile(workbook, 'Plantilla_Stock_Pizzeria.xlsx');
    showMessage('Plantilla de Stock descargada exitosamente.');
  };

  const handleConfirmImport = async () => {
    if (parsedRows.length === 0) {
      showMessage('No hay artículos para importar.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const items: Partial<StockItem>[] = parsedRows.map(r => ({
        name: r.name,
        category: r.category,
        unit: r.unit,
      }));

      await onImportStock(items, replaceExisting);
      showMessage(`¡Inventario importado con éxito! Se cargaron ${items.length} artículos.`, 'success');
      onClose();
    } catch (err: any) {
      showMessage(`Error al guardar artículos de stock: ${err.message}`, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-[#0b0518] border border-purple-500/40 rounded-[35px] max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 border-b border-purple-500/20 flex justify-between items-center bg-[#100723]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black">
              <Icon name="inventory_2" size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">Importar Artículos de Stock & Inventario</h2>
              <p className="text-[11px] text-purple-300 font-bold uppercase tracking-wider">
                Carga masiva de artículos, insumos y unidades desde Excel o texto
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
                <Icon name="upload_file" size={16} /> Subir Excel / CSV
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
                <Icon name="content_paste" size={16} /> Pegar Lista de Insumos
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-[#170a2c] hover:bg-[#241044] border border-purple-500/30 text-purple-300 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5"
              title="Descargar plantilla de Excel con artículos de stock"
            >
              <Icon name="download" size={15} /> Descargar Plantilla Stock
            </button>
          </div>

          {/* Mode 1: File */}
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
              <Icon name="inventory" size={44} className="mx-auto text-purple-400 mb-2" />
              <div className="font-black text-sm uppercase text-white">
                {file ? `Archivo: ${file.name}` : 'Arrastra o haz clic para subir tu Excel de Stock'}
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase mt-1">
                Columnas: Nombre del Artículo, Categoría, Unidad (Metros / Porciones / Unidades / Kilos / Litros)
              </p>
            </div>
          )}

          {/* Mode 2: Paste */}
          {inputMode === 'paste' && (
            <div className="space-y-3">
              <textarea
                rows={5}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={`Pega aquí los artículos de inventario...\nEjemplo:\nPizza Muzzarella\tPizzas\tMetros\nFainá\tFainá\tPorciones\nRefresco 1.5L\tBebidas\tUnidades\nHarina de Trigo\tMateria Prima\tKilos`}
                className="w-full p-4 bg-[#070310] border border-purple-500/30 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2"
              >
                <Icon name="bolt" size={16} /> Procesar Artículos Pegados
              </button>
            </div>
          )}

          {/* Strategy */}
          <div className="p-4 bg-[#0e071f] border border-purple-500/25 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-black uppercase text-white">Modo de Guardado</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {replaceExisting
                  ? '⚠️ Reemplazar todos los artículos existentes en la lista de stock.'
                  : '✅ Sumar artículos a los existentes.'}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-purple-300">Reemplazar Stock</span>
            </label>
          </div>

          {/* Preview Table */}
          {parsedRows.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-2">
                  <Icon name="visibility" size={16} /> Vista Previa ({parsedRows.length} artículos detectados)
                </span>
              </div>

              <div className="border border-purple-500/30 rounded-2xl overflow-hidden bg-[#070310] max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#150a2b] text-purple-300 uppercase text-[9px] font-black tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Nombre del Artículo</th>
                      <th className="p-2.5">Categoría</th>
                      <th className="p-2.5 text-center">Unidad de Medida</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15 text-[11px]">
                    {parsedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="hover:bg-purple-950/20">
                        <td className="p-2.5 font-black uppercase text-white">{r.name}</td>
                        <td className="p-2.5 text-purple-300 font-bold uppercase">{r.category}</td>
                        <td className="p-2.5 text-center">
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-[#180b33] text-purple-300 border border-purple-500/30">
                            {r.unit}
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

        {/* Footer */}
        <div className="p-6 border-t border-purple-500/20 bg-[#100723] flex flex-col sm:flex-row justify-between items-center gap-3">
          <div className="text-xs text-slate-400 font-bold uppercase">
            {parsedRows.length > 0
              ? `Total a importar: ${parsedRows.length} artículos`
              : 'Seleccione datos para comenzar'}
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
                  <Icon name="sync" size={16} className="animate-spin" /> Guardando en Inventario...
                </>
              ) : (
                <>
                  <Icon name="cloud_done" size={16} /> Importar {parsedRows.length} Artículos
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
