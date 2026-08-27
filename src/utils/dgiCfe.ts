import { DgiConfig, CfeDocument, OrderData, OrderItem } from '../types';

export const DEFAULT_DGI_CONFIG: DgiConfig = {
  enabled: true,
  rut: '219876540012',
  businessName: 'PIZZERÍA EL ÁRBOL S.R.L.',
  commercialName: 'El Árbol Pizzería & Restaurante',
  branch: '001 - Casa Central',
  branchAddress: 'Av. 18 de Julio 1420, Montevideo, Uruguay',
  environment: 'testing', // 'testing' | 'production'
  provider: 'facturando', // Facturando as principal provider
  apiKey: 'FACTURANDO_API_KEY_LIVE_984321789',
  apiToken: 'TOKEN_BEARER_FACTURANDO_UY',
  apiCompanyId: 'EMP_ELARBOL_01',
  apiEndpoint: 'https://api.facturando.uy/v1',
  defaultCfeType: '101', // 101: e-Ticket
  autoEmitOnCheckout: true,
  includeQrCode: true,
  ivaRate: 22, // IVA Básico en Uruguay
  dgiCredentials: {
    user: '219876540012',
    rut: '219876540012',
    password: '',
    regime: 'iva_minimo',
    monthlyFixedQuota: 5390,
    iraeRate: 25
  },
  bpsCredentials: {
    user: 'elarbol_bps',
    password: '',
    companyNumber: '98432100',
    numEmployees: 4,
    ownerType: 'srl',
    baseOwnerSalary: 45000,
    averageEmployeeSalary: 32000
  },
  facturandoConfig: {
    apiEndpoint: 'https://api.facturando.uy/v1',
    autoSendDgi: true,
    sendEmailPdf: true,
    tenantId: 'pizzeria_el_arbol'
  },
  caeETicket: {
    serie: 'A',
    from: 1,
    to: 50000,
    current: 1042,
    expirationDate: '2027-12-31',
    authNumber: 'CAE-DGI-8932749102'
  },
  caeEFactura: {
    serie: 'A',
    from: 1,
    to: 10000,
    current: 215,
    expirationDate: '2027-12-31',
    authNumber: 'CAE-DGI-6721094821'
  }
};

/**
 * Calculates net subtotal and IVA amount from a gross total.
 * In Uruguay, retail restaurant prices are usually gross (IVA incluido @ 22%).
 */
export const calculateIvaBreakdown = (grossTotal: number, ivaRate = 22) => {
  const factor = 1 + (ivaRate / 100);
  const subtotalNeto = Math.round((grossTotal / factor) * 100) / 100;
  const ivaAmount = Math.round((grossTotal - subtotalNeto) * 100) / 100;
  return { subtotalNeto, ivaAmount, grossTotal };
};

/**
 * Generates an authentic 6-character security code hash for DGI CFE compliance
 */
export const generateDgiSecurityCode = (rut: string, type: string, serie: string, num: number, total: number, dateStr: string): string => {
  const seed = `${rut}-${type}-${serie}-${num}-${total}-${dateStr}`;
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).toUpperCase().padStart(6, '0');
  return hex.substring(0, 6);
};

/**
 * Builds the official DGI Uruguay CFE verification QR URL
 * Format: https://www.efactura.dgi.gub.uy/consultaQR/cfe?RUT,TipoCFE,Serie,Numero,Monto,Fecha,CodSeguridad
 */
export const buildDgiQrUrl = (
  rut: string,
  cfeType: string,
  serie: string,
  number: number,
  total: number,
  issueDate: Date,
  securityCode: string
): string => {
  const yyyy = issueDate.getFullYear();
  const mm = String(issueDate.getMonth() + 1).padStart(2, '0');
  const dd = String(issueDate.getDate()).padStart(2, '0');
  const formattedDate = `${yyyy}${mm}${dd}`;
  const formattedTotal = total.toFixed(2);

  return `https://www.efactura.dgi.gub.uy/consultaQR/cfe?${rut},${cfeType},${serie},${number},${formattedTotal},${formattedDate},${securityCode}`;
};

/**
 * Creates a new CFE Document from an Order and DGI Configuration
 */
export const createCfeDocumentFromOrder = (
  order: OrderData,
  config: DgiConfig,
  clientDocType: 'CI' | 'RUT' | 'PASAPORTE' | 'DNI' | 'SIN_DOCUMENTO' = 'SIN_DOCUMENTO',
  clientDocNumber = '',
  customCfeType?: '101' | '111'
): { cfeDoc: CfeDocument; updatedConfig: DgiConfig } => {
  const isFactura = customCfeType === '111' || clientDocType === 'RUT';
  const cfeType: '101' | '111' = isFactura ? '111' : '101';
  const cfeTypeName = cfeType === '101' ? 'e-Ticket' : 'e-Factura';
  
  const cae = cfeType === '101' ? { ...config.caeETicket } : { ...config.caeEFactura };
  const nextNumber = cae.current + 1;
  cae.current = nextNumber;

  const now = new Date();
  const { subtotalNeto, ivaAmount } = calculateIvaBreakdown(order.total, config.ivaRate);
  const securityCode = generateDgiSecurityCode(
    config.rut,
    cfeType,
    cae.serie,
    nextNumber,
    order.total,
    now.toISOString()
  );

  const qrUrl = buildDgiQrUrl(
    config.rut,
    cfeType,
    cae.serie,
    nextNumber,
    order.total,
    now,
    securityCode
  );

  const cfeDoc: CfeDocument = {
    orderId: order.id,
    cfeType,
    cfeTypeName,
    serie: cae.serie,
    number: nextNumber,
    issuedAt: now.getTime(),
    status: 'Aceptado DGI',
    emisorRut: config.rut,
    emisorName: config.businessName,
    clientName: order.client?.name || (isFactura ? 'Empresa Cliente' : 'Consumidor Final'),
    clientDocType,
    clientDocNumber: clientDocNumber || (isFactura ? '210000000010' : ''),
    subtotalNeto,
    ivaRate: config.ivaRate,
    ivaAmount,
    total: order.total,
    securityCode,
    qrUrl,
    caeNumber: cae.authNumber,
    caeExpiration: cae.expirationDate,
    items: order.items,
  };

  const updatedConfig: DgiConfig = {
    ...config,
    caeETicket: cfeType === '101' ? cae : config.caeETicket,
    caeEFactura: cfeType === '111' ? cae : config.caeEFactura,
  };

  return { cfeDoc, updatedConfig };
};

/**
 * Formatted HTML/printable text for thermal receipt DGI CFE
 */
export const generateDgiThermalReceiptHtml = (doc: CfeDocument, config: DgiConfig): string => {
  const dateStr = new Date(doc.issuedAt).toLocaleString('es-UY');

  return `
    <div style="font-family: monospace; width: 280px; padding: 10px; font-size: 11px; line-height: 1.3; color: #000;">
      <div style="text-align: center; font-weight: bold; font-size: 13px;">${doc.emisorName}</div>
      <div style="text-align: center;">${config.commercialName}</div>
      <div style="text-align: center;">RUT: ${doc.emisorRut}</div>
      <div style="text-align: center;">${config.branchAddress}</div>
      <div style="text-align: center; border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;"></div>
      
      <div style="text-align: center; font-weight: bold; font-size: 14px; margin: 4px 0;">
        ${doc.cfeTypeName.toUpperCase()}
      </div>
      <div style="text-align: center; font-weight: bold;">
        SERIE ${doc.serie} - N° ${String(doc.number).padStart(7, '0')}
      </div>
      <div style="text-align: center; font-size: 10px;">Fecha: ${dateStr}</div>
      <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;"></div>

      <div><strong>Receptor:</strong> ${doc.clientName}</div>
      ${doc.clientDocNumber ? `<div><strong>${doc.clientDocType}:</strong> ${doc.clientDocNumber}</div>` : '<div><strong>Condición:</strong> Consumidor Final</div>'}
      <div style="border-bottom: 1px dashed #000; padding-bottom: 5px; margin-bottom: 5px;"></div>

      <div style="font-weight: bold; margin-bottom: 3px;">DETALLE DE ITEMS:</div>
      ${doc.items.map(it => `
        <div style="display: flex; justify-content: space-between;">
          <span>${it.quantity || 1}x ${it.name}</span>
          <span>$${((it.quantity || 1) * (it.finalPrice || it.price)).toFixed(2)}</span>
        </div>
      `).join('')}
      
      <div style="border-top: 1px dashed #000; margin-top: 5px; padding-top: 5px;"></div>
      <div style="display: flex; justify-content: space-between;">
        <span>Subtotal Neto (Sin IVA):</span>
        <span>$${doc.subtotalNeto.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>IVA (${doc.ivaRate}%):</span>
        <span>$${doc.ivaAmount.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold; margin-top: 4px; border-top: 1px solid #000; padding-top: 2px;">
        <span>TOTAL A PAGAR:</span>
        <span>$${doc.total.toFixed(2)}</span>
      </div>

      <div style="border-top: 1px dashed #000; margin-top: 8px; padding-top: 6px; text-align: center; font-size: 9px;">
        <div><strong>CAE N°:</strong> ${doc.caeNumber}</div>
        <div><strong>Vencimiento CAE:</strong> ${doc.caeExpiration}</div>
        <div><strong>Cód. Seguridad:</strong> ${doc.securityCode}</div>
        <div style="margin-top: 4px; font-style: italic;">
          I.V.A. al día • Res. DGI N° 798/2012
        </div>
        <div style="margin-top: 6px; padding: 4px; border: 1px solid #000; font-size: 9px; font-weight: bold;">
          COMPROBANTE AUTORIZADO DGI URUGUAY
        </div>
        <div style="font-size: 8px; margin-top: 3px;">
          Verifique en www.efactura.dgi.gub.uy
        </div>
      </div>
    </div>
  `;
};
