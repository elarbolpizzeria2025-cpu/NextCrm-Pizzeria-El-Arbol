import express from 'express';
import net from 'net';

const app = express();
const PORT = Number(process.env.PRINTER_BRIDGE_PORT || 18181);
const HOST = '127.0.0.1';

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Printer-Token');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Private-Network', 'true');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

const requiredToken = String(process.env.PRINTER_BRIDGE_TOKEN || '').trim();

app.use((req, res, next) => {
  if (!requiredToken) return next();
  const token = String(req.header('x-printer-token') || '');
  if (token !== requiredToken) return res.status(401).json({ ok: false, error: 'Token de impresión inválido' });
  next();
});

function isPrivateIPv4(value: string): boolean {
  const parts = value.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 169 && b === 254) return true;
  return false;
}

function sanitizeAscii(value: unknown): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E\n]/g, '')
    .replace(/\r/g, '');
}

function center(text: string, width = 48): string {
  const clean = sanitizeAscii(text).slice(0, width);
  const left = Math.max(0, Math.floor((width - clean.length) / 2));
  return ' '.repeat(left) + clean;
}

function twoCols(left: string, right: string, width = 48): string {
  const l = sanitizeAscii(left);
  const r = sanitizeAscii(right);
  const gap = Math.max(1, width - l.length - r.length);
  return (l + ' '.repeat(gap) + r).slice(0, width);
}

function buildTicket(order: any, copyLabel: string): Buffer {
  const ESC = 0x1b;
  const GS = 0x1d;
  const chunks: Buffer[] = [];
  const cmd = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const txt = (value: string) => chunks.push(Buffer.from(sanitizeAscii(value), 'ascii'));

  cmd(ESC, 0x40); // init
  cmd(ESC, 0x61, 1); // center
  cmd(ESC, 0x45, 1); // bold on
  cmd(GS, 0x21, 0x11); // double size
  txt('EL ARBOL\n');
  cmd(GS, 0x21, 0x00);
  txt('PIZZERIA\n');
  cmd(ESC, 0x45, 0);
  txt(copyLabel + '\n');
  txt('='.repeat(48) + '\n');

  const type = sanitizeAscii(order?.type || 'Local').toUpperCase();
  const id = sanitizeAscii(order?.id || '');
  cmd(ESC, 0x45, 1);
  txt(center(type === 'MESA' ? 'PEDIDO DE MESA' : type) + '\n');
  txt(center('TICKET ' + id) + '\n');
  cmd(ESC, 0x45, 0);

  if (order?.reference) txt(center(order.reference) + '\n');
  if (order?.client?.name) txt(twoCols('CLIENTE', order.client.name) + '\n');
  if (order?.assignedWaiter) txt(twoCols('MOZA/O', order.assignedWaiter) + '\n');
  if (order?.time) txt(twoCols('HORA', order.time) + '\n');

  txt('-'.repeat(48) + '\n');
  const items = Array.isArray(order?.items) ? order.items : [];
  for (const item of items) {
    const qty = Number(item?.quantity || 1);
    const name = sanitizeAscii(item?.name || 'Item');
    const total = Math.round(Number(item?.finalPrice || item?.price || 0) * qty);
    txt(twoCols(qty + 'x ' + name, '$' + total) + '\n');
    const toppings = Array.isArray(item?.selectedToppings) ? item.selectedToppings : [];
    if (toppings.length) txt('  + ' + toppings.map((t: any) => sanitizeAscii(t?.name)).join(', ') + '\n');
  }

  if (order?.notes) {
    txt('-'.repeat(48) + '\n');
    cmd(ESC, 0x45, 1);
    txt('OBS: ' + sanitizeAscii(order.notes) + '\n');
    cmd(ESC, 0x45, 0);
  }

  txt('='.repeat(48) + '\n');
  cmd(ESC, 0x45, 1);
  cmd(GS, 0x21, 0x01);
  txt(twoCols('TOTAL', '$' + Number(order?.total || 0).toFixed(0)) + '\n');
  cmd(GS, 0x21, 0x00);
  cmd(ESC, 0x45, 0);

  if (order?.paymentMethod) txt(twoCols('PAGO', order.paymentMethod) + '\n');
  txt('\n\n');
  cmd(ESC, 0x61, 1);
  txt('*** FIN DE COMANDA ***\n\n\n');
  cmd(GS, 0x56, 0x42, 0x00); // partial cut
  return Buffer.concat(chunks);
}

function buildTestTicket(): Buffer {
  return buildTicket({
    id: '#TEST',
    type: 'Mesa',
    reference: 'MESA #1',
    client: { name: 'PRUEBA UN-TP95W' },
    assignedWaiter: 'Prueba de sistema',
    time: new Date().toLocaleTimeString('es-UY', { hour: '2-digit', minute: '2-digit' }),
    items: [{ name: 'PRUEBA DE IMPRESION WIFI', quantity: 1, finalPrice: 0 }],
    total: 0,
    paymentMethod: 'PRUEBA',
    notes: 'ESC/POS 80mm - WiFi OK'
  }, 'PRUEBA DE CONEXION');
}

function sendRaw(printerIp: string, printerPort: number, payload: Buffer): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: printerIp, port: printerPort });
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('Tiempo de espera agotado conectando con la impresora'));
    }, 5000);

    socket.once('connect', () => {
      socket.write(payload, err => {
        if (err) {
          clearTimeout(timeout);
          socket.destroy();
          reject(err);
          return;
        }
        socket.end();
      });
    });

    socket.once('close', hadError => {
      clearTimeout(timeout);
      if (!hadError) resolve();
    });

    socket.once('error', err => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

function parsePrinterTarget(body: any) {
  const printerIp = String(body?.printerIp || '').trim();
  const printerPort = Number(body?.printerPort || 9100);
  if (!isPrivateIPv4(printerIp)) throw new Error('La IP debe ser una dirección privada válida de la red local');
  if (!Number.isInteger(printerPort) || printerPort < 1 || printerPort > 65535) throw new Error('Puerto inválido');
  return { printerIp, printerPort };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    bridge: 'NextCRM Unnion WiFi Printer Bridge',
    model: 'UN-TP95W',
    protocol: 'ESC/POS',
    port: PORT
  });
});

app.post('/test', async (req, res) => {
  try {
    const { printerIp, printerPort } = parsePrinterTarget(req.body);
    await sendRaw(printerIp, printerPort, buildTestTicket());
    res.json({ ok: true, printerIp, printerPort, model: 'UN-TP95W' });
  } catch (error: any) {
    res.status(502).json({ ok: false, error: error?.message || 'No se pudo imprimir la prueba' });
  }
});

app.post('/print', async (req, res) => {
  try {
    const { printerIp, printerPort } = parsePrinterTarget(req.body);
    const order = req.body?.order;
    if (!order || !Array.isArray(order.items)) return res.status(400).json({ ok: false, error: 'Pedido inválido' });

    const copies = Math.min(4, Math.max(1, Number(req.body?.copies || 2)));
    const buffers: Buffer[] = [];
    for (let i = 0; i < copies; i++) {
      buffers.push(buildTicket(order, copies > 1 ? (i === 0 ? 'VIA COCINA' : 'VIA CONTROL') : 'COMANDA'));
    }
    await sendRaw(printerIp, printerPort, Buffer.concat(buffers));
    res.json({ ok: true, copies, printerIp, printerPort, ticketId: order.id });
  } catch (error: any) {
    res.status(502).json({ ok: false, error: error?.message || 'No se pudo enviar el ticket' });
  }
});

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('NextCRM - Puente de impresora WiFi UN-TP95W');
  console.log('Escuchando en http://' + HOST + ':' + PORT);
  console.log('La PC debe estar conectada a la misma red que la ticketera.');
  console.log('');
});
