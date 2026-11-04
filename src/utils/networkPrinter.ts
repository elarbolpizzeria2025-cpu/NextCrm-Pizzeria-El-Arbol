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

const STORAGE_KEY = 'nextcrm_network_printer_unnion_tp95w';

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

function headers(config: NetworkPrinterConfig) {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (config.bridgeToken.trim()) h['X-Printer-Token'] = config.bridgeToken.trim();
  return h;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
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
  if (!config.printerIp.trim()) throw new Error('Ingresá la IP de la UN-TP95W');
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
  if (!config.printerIp.trim()) throw new Error('Falta la IP de la UN-TP95W');
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
