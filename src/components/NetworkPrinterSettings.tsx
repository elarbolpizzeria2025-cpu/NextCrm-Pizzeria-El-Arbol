import React, { useEffect, useState } from 'react';
import { Icon } from './Icon';
import {
  NetworkPrinterConfig,
  LegacyPrinterConfig,
  WindowsPrinterInfo,
  saveNetworkPrinterConfig,
  saveLegacyPrinterConfig,
  testNetworkPrinter,
  testLegacyPrinter,
  listWindowsPrinters,
  checkPrinterBridge
} from '../utils/networkPrinter';

interface Props {
  config: NetworkPrinterConfig;
  onChange: (config: NetworkPrinterConfig) => void;
  legacyConfig: LegacyPrinterConfig;
  onLegacyChange: (config: LegacyPrinterConfig) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

export const NetworkPrinterSettings: React.FC<Props> = ({
  config,
  onChange,
  legacyConfig,
  onLegacyChange,
  showMessage
}) => {
  const [draft, setDraft] = useState<NetworkPrinterConfig>(config);
  const [legacyDraft, setLegacyDraft] = useState<LegacyPrinterConfig>(legacyConfig);
  const [checking, setChecking] = useState(false);
  const [checkingLegacy, setCheckingLegacy] = useState(false);
  const [loadingPrinters, setLoadingPrinters] = useState(false);
  const [printers, setPrinters] = useState<WindowsPrinterInfo[]>([]);
  const [status, setStatus] = useState<'idle' | 'ok' | 'error'>('idle');
  const [legacyStatus, setLegacyStatus] = useState<'idle' | 'ok' | 'error'>('idle');

  useEffect(() => setDraft(config), [config]);
  useEffect(() => setLegacyDraft(legacyConfig), [legacyConfig]);

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

  const saveLegacy = () => {
    const normalized: LegacyPrinterConfig = {
      ...legacyDraft,
      printerName: legacyDraft.printerName.trim(),
      bridgeUrl: legacyDraft.bridgeUrl.trim() || 'http://127.0.0.1:18181',
      copies: Math.min(4, Math.max(1, Number(legacyDraft.copies || 2)))
    };
    saveLegacyPrinterConfig(normalized);
    onLegacyChange(normalized);
    showMessage('Configuración de impresora anterior guardada', 'success');
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

  const refreshWindowsPrinters = async () => {
    setLoadingPrinters(true);
    try {
      const found = await listWindowsPrinters(legacyDraft);
      setPrinters(found);
      if (!legacyDraft.printerName && found.length > 0) {
        const preferred = found.find(p => p.Default) || found[0];
        setLegacyDraft(prev => ({ ...prev, printerName: preferred.Name }));
      }
      showMessage(`Se detectaron ${found.length} impresora(s) en Windows`, 'success');
    } catch (e: any) {
      showMessage(e?.message || 'No se pudieron detectar impresoras en Windows', 'error');
    } finally {
      setLoadingPrinters(false);
    }
  };

  const testLegacy = async () => {
    setCheckingLegacy(true);
    setLegacyStatus('idle');
    try {
      await checkPrinterBridge({
        ...config,
        bridgeUrl: legacyDraft.bridgeUrl,
        bridgeToken: legacyDraft.bridgeToken
      });
      await testLegacyPrinter(legacyDraft);
      setLegacyStatus('ok');
      showMessage('Prueba enviada correctamente a la impresora anterior', 'success');
    } catch (e: any) {
      setLegacyStatus('error');
      showMessage(e?.message || 'No se pudo imprimir en la impresora anterior', 'error');
    } finally {
      setCheckingLegacy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-[#0b0518] border border-violet-500/25 p-5 rounded-[28px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-violet-300">Impresora anterior</div>
            <h3 className="text-lg font-black uppercase text-white">Ticketera instalada en Windows</h3>
            <p className="text-[10px] font-bold text-slate-500">Impresión RAW ESC/POS por la cola de Windows • sin depender de Chrome</p>
          </div>
          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300">
            <input
              type="checkbox"
              checked={legacyDraft.enabled}
              onChange={e => setLegacyDraft(prev => ({ ...prev, enabled: e.target.checked }))}
              className="w-4 h-4 accent-violet-500"
            />
            Activa
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <label className="space-y-1 xl:col-span-2">
            <span className="text-[9px] font-black uppercase text-slate-500">Impresora de Windows</span>
            <div className="flex gap-2">
              <input
                value={legacyDraft.printerName}
                onChange={e => setLegacyDraft(prev => ({ ...prev, printerName: e.target.value }))}
                list="nextcrm-windows-printers"
                placeholder="Ej.: XP-80C"
                className="flex-1 min-w-0 bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-violet-400"
              />
              <datalist id="nextcrm-windows-printers">
                {printers.map(p => (
                  <option key={p.Name} value={p.Name}>
                    {p.Default ? 'Predeterminada' : ''}{p.WorkOffline ? ' • Sin conexión' : ''}
                  </option>
                ))}
              </datalist>
              <button
                type="button"
                onClick={refreshWindowsPrinters}
                disabled={loadingPrinters}
                className="px-3 py-2 bg-[#160829] border border-violet-500/30 text-violet-300 rounded-xl text-[9px] font-black uppercase hover:bg-[#20113a] disabled:opacity-50"
              >
                {loadingPrinters ? 'Buscando...' : 'Detectar'}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[8px] font-bold text-slate-500">Si Detectar falla, escribí exactamente el nombre que muestra Windows.</span>
              <button
                type="button"
                onClick={() => setLegacyDraft(prev => ({ ...prev, printerName: 'XP-80C' }))}
                className="text-[8px] font-black uppercase text-violet-300 hover:text-violet-200"
              >
                Usar XP-80C
              </button>
            </div>
          </label>

          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase text-slate-500">Copias pedidos mesa</span>
            <select
              value={legacyDraft.copies}
              onChange={e => setLegacyDraft(prev => ({ ...prev, copies: Number(e.target.value) }))}
              className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-sm font-bold text-white outline-none focus:border-violet-400"
            >
              <option value={1}>1 copia</option>
              <option value={2}>2 copias</option>
              <option value={3}>3 copias</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[9px] font-black uppercase text-slate-500">Puente local</span>
            <input
              value={legacyDraft.bridgeUrl}
              onChange={e => setLegacyDraft(prev => ({ ...prev, bridgeUrl: e.target.value }))}
              className="w-full bg-[#06020e] border border-purple-500/25 rounded-xl px-3 py-2.5 text-xs font-mono text-white outline-none focus:border-violet-400"
            />
          </label>
        </div>

        <div className="rounded-2xl border border-violet-500/20 bg-violet-950/20 p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="text-[10px] font-black uppercase text-violet-200">¿Dice “Failed to fetch”?</div>
            <div className="text-[9px] font-bold text-slate-400 mt-1">
              Instalá una sola vez el puente local en esta PC de caja y después volvé a tocar Detectar.
            </div>
          </div>
          <a
            href="/instalar-puente-impresion.cmd"
            download
            className="h-9 px-3 rounded-xl bg-violet-500 hover:bg-violet-400 text-slate-950 text-[9px] font-black uppercase flex items-center justify-center gap-1.5 shrink-0"
          >
            <Icon name="download" size={12}/> Instalar puente Windows
          </a>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-300">
            <input
              type="checkbox"
              checked={legacyDraft.autoPrintMesa}
              onChange={e => setLegacyDraft(prev => ({ ...prev, autoPrintMesa: e.target.checked }))}
              className="w-4 h-4 accent-violet-500"
            />
            Usar para impresión automática de mesa
          </label>

          <div className="flex items-center gap-2">
            <span className={
              legacyStatus === 'ok' ? 'text-[9px] font-black uppercase text-emerald-300' :
              legacyStatus === 'error' ? 'text-[9px] font-black uppercase text-red-300' :
              'text-[9px] font-black uppercase text-slate-500'
            }>
              {legacyStatus === 'ok' ? '● Impresora OK' : legacyStatus === 'error' ? '● Sin respuesta' : '● Sin probar'}
            </span>
            <button
              type="button"
              onClick={testLegacy}
              disabled={checkingLegacy}
              className="px-3 py-2 bg-[#160829] border border-violet-500/30 text-violet-300 rounded-xl text-[9px] font-black uppercase hover:bg-[#20113a] disabled:opacity-50 flex items-center gap-1"
            >
              <Icon name="print" size={12}/>{checkingLegacy ? 'Probando...' : 'Imprimir prueba'}
            </button>
            <button
              type="button"
              onClick={saveLegacy}
              className="px-3 py-2 bg-violet-500 hover:bg-violet-400 text-slate-950 rounded-xl text-[9px] font-black uppercase flex items-center gap-1"
            >
              <Icon name="save" size={12}/> Guardar
            </button>
          </div>
        </div>
      </div>

      <div className="bg-[#0b0518] border border-cyan-500/25 p-5 rounded-[28px] space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.18em] text-cyan-300">Ticketera Wi‑Fi</div>
            <h3 className="text-lg font-black uppercase text-white">Unnion UN-TP95W</h3>
            <p className="text-[10px] font-bold text-slate-500">ESC/POS • 80 mm • Wi‑Fi • corte automático</p>
            <p className="text-[9px] font-black text-amber-300 mt-1">IP de configuración Wi‑Fi: 10.10.100.254 (no es la IP LAN para imprimir)</p>
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
              placeholder="Ej.: 192.168.1.201"
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
    </div>
  );
};
