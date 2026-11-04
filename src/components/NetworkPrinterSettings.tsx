import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import {
  NetworkPrinterConfig,
  saveNetworkPrinterConfig,
  testNetworkPrinter,
  checkPrinterBridge
} from '../utils/networkPrinter';

interface Props {
  config: NetworkPrinterConfig;
  onChange: (config: NetworkPrinterConfig) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

export const NetworkPrinterSettings: React.FC<Props> = ({ config, onChange, showMessage }) => {
  const [draft, setDraft] = useState<NetworkPrinterConfig>(config);
  const [checking, setChecking] = useState(false);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => setDraft(config), [config]);

  const save = () => {
    const normalized: NetworkPrinterConfig = {
      ...draft,
      model: 'UN-TP95W',
      printerIp: draft.printerIp.trim(),
      printerPort: Number(draft.printerPort || 9100),
      bridgeUrl: draft.bridgeUrl.trim() || 'http://127.0.0.1:18181',
      copies: Math.min(4, Math.max(1, Number(draft.copies || 2))),
      paperWidth: 80
    };
    saveNetworkPrinterConfig(normalized);
    onChange(normalized);
    showMessage('Configuración de ticketera UN-TP95W guardada', 'success');
  };

  const test = async () => {
    setChecking(true);
    setStatus('idle');
    try {
      await checkPrinterBridge(draft);
      await testNetworkPrinter(draft);
      setStatus('ok');
      showMessage('Prueba enviada correctamente a la UN-TP95W', 'success');
    } catch (e: any) {
      setStatus('error');
      showMessage(e?.message || 'No se pudo conectar con la ticketera', 'error');
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="bg-[#0b0518] border border-cyan-500/25 p-5 rounded-[28px] space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Ticketera Wi‑Fi</div>
          <h3 className="text-lg font-black uppercase text-white">Unnion UN-TP95W</h3>
          <p className="text-[10px] font-bold text-slate-500">ESC/POS • 80 mm • Wi‑Fi • corte automático</p>
        </div>
        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={e => setDraft(prev => ({ ...prev, enabled: e.target.checked }))}
            className="w-4 h-4 accent-cyan-500"
          />
          Activa
        </label>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-500">IP de la impresora</span>
          <input
            value={draft.printerIp}
            onChange={e => setDraft(prev => ({ ...prev, printerIp: e.target.value }))}
            placeholder="192.168.1.80"
            className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-cyan-400"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-500">Puerto ESC/POS</span>
          <input
            type="number"
            value={draft.printerPort}
            onChange={e => setDraft(prev => ({ ...prev, printerPort: Number(e.target.value || 9100) }))}
            className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm font-mono text-white outline-none focus:border-cyan-400"
          />
        </label>

        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-500">Copias pedidos mesa</span>
          <select
            value={draft.copies}
            onChange={e => setDraft(prev => ({ ...prev, copies: Number(e.target.value) }))}
            className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-cyan-400"
          >
            <option value={1}>1 copia</option>
            <option value={2}>2 copias</option>
            <option value={3}>3 copias</option>
          </select>
        </label>

        <label className="space-y-1">
          <span className="text-[9px] font-black uppercase text-slate-500">Puente local</span>
          <input
            value={draft.bridgeUrl}
            onChange={e => setDraft(prev => ({ ...prev, bridgeUrl: e.target.value }))}
            className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-cyan-400"
          />
        </label>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300">
          <input
            type="checkbox"
            checked={draft.autoPrintMesa}
            onChange={e => setDraft(prev => ({ ...prev, autoPrintMesa: e.target.checked }))}
            className="w-4 h-4 accent-cyan-500"
          />
          Imprimir automáticamente pedidos de mesa
        </label>

        <div className="flex items-center gap-2">
          <span className={
            status === 'ok' ? 'text-[9px] font-black uppercase text-emerald-300' :
            status === 'error' ? 'text-[9px] font-black uppercase text-red-300' :
            'text-[9px] font-black uppercase text-slate-500'
          }>
            {status === 'ok' ? '● Conexión OK' : status === 'error' ? '● Sin conexión' : '● Sin probar'}
          </span>
          <button
            type="button"
            onClick={test}
            disabled={checking}
            className="px-3 py-2 bg-[#160829] border border-cyan-500/30 text-cyan-300 rounded-xl text-[9px] font-black uppercase hover:bg-[#20113a] disabled:opacity-50 flex items-center gap-1"
          >
            <Icon name="print" size={12}/>{checking ? 'Probando...' : 'Imprimir prueba'}
          </button>
          <button
            type="button"
            onClick={save}
            className="px-3 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-xl text-[9px] font-black uppercase flex items-center gap-1"
          >
            <Icon name="save" size={12}/> Guardar
          </button>
        </div>
      </div>

      <div className="text-[9px] font-bold text-slate-500 leading-relaxed">
        La PC del POS y la UN-TP95W deben estar en la misma red Wi‑Fi. Conviene reservar una IP fija para la impresora en el router.
      </div>
    </div>
  );
};
