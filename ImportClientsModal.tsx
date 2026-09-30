import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from './Icon';
import { ClientData } from '../types';

interface ImportClientsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportClients: (clients: Partial<ClientData>[], replaceExisting: boolean) => Promise<void>;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

interface ParsedClient {
  name: string;
  phone: string;
  address: string;
  zone: string;
  notes: string;
  isValid: boolean;
}

export const ImportClientsModal: React.FC<ImportClientsModalProps> = ({
  isOpen,
  onClose,
  onImportClients,
  showMessage,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [parsedClients, setParsedClients] = useState<ParsedClient[]>([]);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [rawText, setRawText] = useState('');
  const [inputMode, setInputMode] = useState<'file' | 'paste'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const mapJsonToClients = (json: any[]): ParsedClient[] => {
    return json.map((row) => {
      const keys = Object.keys(row);
      const findVal = (matchers: string[]): string => {
        const k = keys.find(key => matchers.some(m => key.toLowerCase().trim() === m.toLowerCase() || key.toLowerCase().includes(m.toLowerCase())));
        return k && row[k] !== undefined && row[k] !== null ? String(row[k]).trim() : '';
      };

      const name = findVal(['nombre', 'cliente', 'name', 'customer', 'razon social', 'razón social', 'contacto', 'empresa']);
      const phone = findVal(['telefono', 'teléfono', 'tel', 'phone', 'celular', 'cel', 'movil', 'móvil', 'whatsapp', 'wpp']);
      const address = findVal(['direccion', 'dirección', 'address', 'calle', 'domicilio', 'ubicacion', 'ubicación', 'puerta']);
      const zone = findVal(['zona', 'barrio', 'zone', 'localidad', 'ciudad', 'sector']);
      const notes = findVal(['nota', 'notas', 'observaciones', 'observacion', 'comentario', 'obs', 'rut', 'ci', 'doc']);

      const isValid = Boolean(name || phone || address);

      return {
        name: name || (phone ? `Cliente ${phone}` : 'Cliente Sin Nombre'),
        phone,
        address,
        zone,
        notes,
        isValid,
      };
    }).filter(c => c.isValid);
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
          showMessage('El archivo Excel/CSV está vacío o no contiene filas con datos.', 'error');
          setIsLoading(false);
          return;
        }

        const clients = mapJsonToClients(json);
        setParsedClients(clients);
        showMessage(`Archivo procesado: se encontraron ${clients.length} clientes listos para importar.`, 'success');
      } catch (err: any) {
        showMessage(`Error al leer archivo: ${err.message}`, 'error');
      } finally {
        setIsLoading(false);
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  };

  const handleProcessPastedText = () => {
    if (!rawText.trim()) {
      showMessage('Por favor pegue texto con datos de clientes.', 'error');
      return;
    }

    try {
      // Check if it's JSON
      if (rawText.trim().startsWith('[') || rawText.trim().startsWith('{')) {
        const parsed = JSON.parse(rawText);
        const array = Array.isArray(parsed) ? parsed : [parsed];
        const clients = mapJsonToClients(array);
        setParsedClients(clients);
        showMessage(`Se procesaron ${clients.length} clientes desde JSON.`, 'success');
        return;
      }

      // Process TSV or CSV lines
      const lines = rawText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
      if (lines.length === 0) return;

      const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
      const rows = lines.map(line => line.split(delimiter).map(cell => cell.trim().replace(/^["']|["']$/g, '')));

      // If first row looks like header
      const firstRow = rows[0].map(c => c.toLowerCase());
      const hasHeader = firstRow.some(c => ['nombre', 'cliente', 'telefono', 'tel', 'direccion', 'name', 'phone'].includes(c));

      const header = hasHeader ? rows[0] : ['nombre', 'telefono', 'direccion', 'zona', 'notas'];
      const dataRows = hasHeader ? rows.slice(1) : rows;

      const json = dataRows.map(r => {
        const obj: Record<string, string> = {};
        header.forEach((h, idx) => {
          obj[h] = r[idx] || '';
        });
        return obj;
      });

      const clients = mapJsonToClients(json);
      setParsedClients(clients);
      showMessage(`Texto procesado: ${clients.length} clientes listos para importar.`, 'success');
    } catch (err: any) {
      showMessage(`Error al procesar texto: ${err.message}`, 'error');
    }
  };

  const handleDownloadTemplate = () => {
    const templateData = [
      {
        'Nombre': 'GONZALO MARTÍNEZ',
        'Teléfono': '099123456',
        'Dirección': 'Av. 18 de Julio 1420 Apto 402',
        'Barrio/Zona': 'Centro / Cordón',
        'Notas': 'RUT 219999990019 - Tocar timbre 402'
      },
      {
        'Nombre': 'MARÍA RODRÍGUEZ',
        'Teléfono': '098356320',
        'Dirección': 'Bulevar Artigas 2150',
        'Barrio/Zona': 'Tres Cruces',
        'Notas': 'Cliente frecuente de mostrador'
      },
      {
        'Nombre': 'EMPRESA TECNO SRL',
        'Teléfono': '094888777',
        'Dirección': 'Plaza Independencia 810 Piso 5',
        'Barrio/Zona': 'Ciudad Vieja',
        'Notas': 'RUT 218765430018 - Factura con RUT'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Plantilla_Clientes');
    XLSX.writeFile(workbook, 'Plantilla_Clientes_Pizzeria.xlsx');
    showMessage('Plantilla descargada: complete los datos y vuelva a subirla.');
  };

  const handleConfirmImport = async () => {
    if (parsedClients.length === 0) {
      showMessage('No hay clientes para importar.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const clientObjects: Partial<ClientData>[] = parsedClients.map(c => ({
        name: c.name,
        phone: c.phone,
        address: c.address,
        zone: c.zone,
        notes: c.notes,
        createdAt: Date.now(),
      }));

      await onImportClients(clientObjects, replaceExisting);
      showMessage(`¡Se importaron ${clientObjects.length} clientes exitosamente al directorio!`, 'success');
      onClose();
    } catch (err: any) {
      showMessage(`Error al guardar clientes: ${err.message}`, 'error');
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
              <Icon name="group_add" size={26} />
            </div>
            <div>
              <h2 className="text-xl font-black uppercase text-white tracking-tight">Importar Directorio de Clientes</h2>
              <p className="text-[11px] text-purple-300 font-bold uppercase tracking-wider">
                Compatible con Excel (.xlsx, .xls), CSV, Google Sheets o texto copiado
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

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 no-scrollbar">
          
          {/* Action Tabs & Template Download */}
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
                <Icon name="content_paste" size={16} /> Pegar Texto / Tablas
              </button>
            </div>

            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="px-3.5 py-2 bg-[#170a2c] hover:bg-[#241044] border border-purple-500/30 text-purple-300 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5"
              title="Descargar archivo Excel con columnas preconfiguradas"
            >
              <Icon name="download" size={15} /> Descargar Plantilla Excel
            </button>
          </div>

          {/* Mode 1: File Drag & Drop */}
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
              <Icon name="cloud_upload" size={44} className="mx-auto text-purple-400 mb-2" />
              <div className="font-black text-sm uppercase text-white">
                {file ? `Archivo: ${file.name}` : 'Arrastra o haz clic para subir tu archivo Excel / CSV'}
              </div>
              <p className="text-[11px] text-slate-400 font-bold uppercase mt-1">
                Columnas detectadas automáticamente: Nombre, Teléfono, Dirección, Barrio/Zona, Notas/RUT
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
                placeholder={`Pega aquí los clientes copiados de Excel, Google Sheets, WhatsApp o JSON...\nEjemplo:\nGonzalo Martínez\t099123456\t18 de Julio 1420\tCentro\nMaría Rodríguez\t098356320\tBv. Artigas 2150\tTres Cruces`}
                className="w-full p-4 bg-[#070310] border border-purple-500/30 rounded-2xl text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
              <button
                type="button"
                onClick={handleProcessPastedText}
                className="w-full py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2"
              >
                <Icon name="bolt" size={16} /> Procesar Texto Pegado
              </button>
            </div>
          )}

          {/* Import Strategy Switch */}
          <div className="p-4 bg-[#0e071f] border border-purple-500/25 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-xs font-black uppercase text-white">Modo de Importación</div>
              <div className="text-[11px] text-slate-400 font-medium">
                {replaceExisting
                  ? '⚠️ Se borrarán los clientes actuales y se guardarán únicamente los del archivo.'
                  : '✅ Se sumarán los nuevos clientes a los ya existentes sin borrar nadie.'}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={replaceExisting}
                onChange={(e) => setReplaceExisting(e.target.checked)}
                className="w-4 h-4 rounded text-purple-600 accent-purple-600 cursor-pointer"
              />
              <span className="text-xs font-black uppercase text-purple-300">Reemplazar todo</span>
            </label>
          </div>

          {/* Preview Table */}
          {parsedClients.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black uppercase text-purple-300 flex items-center gap-2">
                  <Icon name="visibility" size={16} /> Vista Previa ({parsedClients.length} clientes listos)
                </span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  Mostrando primeros {Math.min(10, parsedClients.length)} de {parsedClients.length}
                </span>
              </div>

              <div className="border border-purple-500/30 rounded-2xl overflow-hidden bg-[#070310] max-h-56 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#150a2b] text-purple-300 uppercase text-[9px] font-black tracking-wider sticky top-0">
                    <tr>
                      <th className="p-2.5">Nombre / Razón Social</th>
                      <th className="p-2.5">Teléfono / WhatsApp</th>
                      <th className="p-2.5">Dirección</th>
                      <th className="p-2.5">Barrio / Zona</th>
                      <th className="p-2.5">Notas / RUT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-purple-500/15 text-[11px]">
                    {parsedClients.slice(0, 10).map((c, i) => (
                      <tr key={i} className="hover:bg-purple-950/20">
                        <td className="p-2.5 font-black uppercase text-white">{c.name}</td>
                        <td className="p-2.5 font-mono text-purple-300">{c.phone || '-'}</td>
                        <td className="p-2.5 text-slate-300">{c.address || '-'}</td>
                        <td className="p-2.5 text-slate-400">{c.zone || '-'}</td>
                        <td className="p-2.5 text-slate-400 truncate max-w-xs">{c.notes || '-'}</td>
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
            {parsedClients.length > 0
              ? `Total a importar: ${parsedClients.length} clientes`
              : 'Seleccione o pegue datos para comenzar'}
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
              disabled={isLoading || parsedClients.length === 0}
              className={`flex-1 sm:flex-none px-6 py-3 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                parsedClients.length > 0 && !isLoading
                  ? 'bg-purple-600 hover:bg-purple-500 text-white shadow-purple-600/30 cursor-pointer'
                  : 'bg-slate-800 text-slate-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <>
                  <Icon name="sync" size={16} className="animate-spin" /> Guardando en Base de Datos...
                </>
              ) : (
                <>
                  <Icon name="cloud_done" size={16} /> Importar {parsedClients.length} Clientes
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
