import { OrderData } from '../types';

export interface NetworkPrinterConfig {
  enabled: boolean;
  model: 'UN-TP95W';
  printerIp: string;
  printerPort: number;
  bridgeUrl: string;
  bridgeToken: string;
  paperWidth: 80 | 58;
  copies: number;
  autoPrintMesa: boolean;
}

export interface WindowsPrinterInfo {
  Name: string;
  Default?: boolean;
  WorkOffline?: boolean;
  PrinterStatus?: number;
}

export interface LegacyPrinterConfig {
  enabled: boolean;
  printerName: string;
  bridgeUrl: string;
  bridgeToken: string;
  copies: number;
  autoPrintMesa: boolean;
}

const STORAGE_KEY = 'nextcrm_network_printer_unnion_tp95w';
const LEGACY_STORAGE_KEY = 'nextcrm_legacy_windows_printer';

export const DEFAULT_NETWORK_PRINTER_CONFIG: NetworkPrinterConfig = {
  enabled: false,
  model: 'UN-TP95W',
  printerIp: '',
  printerPort: 9100,
  bridgeUrl: 'http://127.0.0.1:18181',
  bridgeToken: '',
  paperWidth: 80,
  copies: 2,
  autoPrintMesa: true
};

export const DEFAULT_LEGACY_PRINTER_CONFIG: LegacyPrinterConfig = {
  enabled: false,
  printerName: '',
  bridgeUrl: 'http://127.0.0.1:18181',
  bridgeToken: '',
  copies: 2,
  autoPrintMesa: true
};

export function loadNetworkPrinterConfig(): NetworkPrinterConfig {
  if (typeof window === 'undefined') return DEFAULT_NETWORK_PRINTER_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_NETWORK_PRINTER_CONFIG;
    return { ...DEFAULT_NETWORK_PRINTER_CONFIG, ...JSON.parse(raw), model: 'UN-TP95W' };
  } catch {
    return DEFAULT_NETWORK_PRINTER_CONFIG;
  }
}

export function saveNetworkPrinterConfig(config: NetworkPrinterConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...config, model: 'UN-TP95W' }));
}

export function loadLegacyPrinterConfig(): LegacyPrinterConfig {
  if (typeof window === 'undefined') return DEFAULT_LEGACY_PRINTER_CONFIG;
  try {
    const raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return DEFAULT_LEGACY_PRINTER_CONFIG;
    return { ...DEFAULT_LEGACY_PRINTER_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_LEGACY_PRINTER_CONFIG;
  }
}

export function saveLegacyPrinterConfig(config: LegacyPrinterConfig): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(config));
}

function headers(config: { bridgeToken: string }) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.bridgeToken.trim()) h['X-Printer-Token'] = config.bridgeToken.trim();
  return h;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('El puente de impresión no respondió a tiempo. Verificá que esté iniciado en la PC de caja.');
    }
    if (url.includes('127.0.0.1') || url.includes('localhost')) {
      throw new Error('No se pudo conectar con el puente local de impresión. Abrí este CRM desde la PC Windows de la pizzería y asegurate de que el puente esté iniciado en esa misma PC.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkPrinterBridge(config: NetworkPrinterConfig) {
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/health', { method: 'GET', headers: headers(config) }, 3000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'El puente local no responde');
  return data;
}

export async function testNetworkPrinter(config: NetworkPrinterConfig) {
  if (!config.printerIp.trim()) throw new Error('Ingresá la IP LAN de la UN-TP95W');
  if (config.printerIp.trim() === '10.10.100.254') {
    throw new Error('10.10.100.254 es la IP de configuración Wi‑Fi de la ticketera. Para imprimir, usá la IP LAN/STA que recibe en el Wi‑Fi del local.');
  }
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/test', {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({
      printerIp: config.printerIp.trim(),
      printerPort: Number(config.printerPort || 9100)
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'La impresora no respondió');
  return data;
}

export async function printOrderToNetworkPrinter(config: NetworkPrinterConfig, order: OrderData) {
  if (!config.enabled) throw new Error('La impresora WiFi está desactivada');
  if (!config.printerIp.trim()) throw new Error('Falta la IP LAN de la UN-TP95W');
  if (config.printerIp.trim() === '10.10.100.254') {
    throw new Error('10.10.100.254 es la IP de configuración, no la IP de impresión LAN/STA.');
  }
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/print', {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({
      printerIp: config.printerIp.trim(),
      printerPort: Number(config.printerPort || 9100),
      copies: Math.min(4, Math.max(1, Number(config.copies || 2))),
      paperWidth: config.paperWidth,
      order
    })
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'No se pudo enviar el ticket por WiFi');
  return data;
}


export async function listWindowsPrinters(config: LegacyPrinterConfig): Promise<WindowsPrinterInfo[]> {
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/windows-printers', {
    method: 'GET',
    headers: headers(config)
  }, 5000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'No se pudieron leer las impresoras de Windows');
  return Array.isArray(data.printers) ? data.printers : [];
}

export async function testLegacyPrinter(config: LegacyPrinterConfig) {
  if (!config.printerName.trim()) throw new Error('Seleccioná la impresora anterior de Windows');
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/test-windows', {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({ printerName: config.printerName.trim() })
  }, 15000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'La impresora anterior no respondió');
  return data;
}

export async function printOrderToLegacyPrinter(config: LegacyPrinterConfig, order: OrderData) {
  if (!config.enabled) throw new Error('La impresora anterior está desactivada');
  if (!config.printerName.trim()) throw new Error('Falta seleccionar la impresora anterior');
  const base = config.bridgeUrl.replace(/\/$/, '');
  const response = await fetchWithTimeout(base + '/print-windows', {
    method: 'POST',
    headers: headers(config),
    body: JSON.stringify({
      printerName: config.printerName.trim(),
      copies: Math.min(4, Math.max(1, Number(config.copies || 2))),
      order
    })
  }, 15000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.ok) throw new Error(data?.error || 'No se pudo imprimir en la impresora anterior');
  return data;
}
