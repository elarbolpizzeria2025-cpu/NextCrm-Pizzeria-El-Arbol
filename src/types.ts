export interface MenuItem {
  id: string;
  name: string;
  price: number;
  desc?: string;
  isPortion?: boolean;
  isMeter?: boolean;
  hasToppings?: boolean;
  maxToppings?: number;
}

export interface Topping {
  id: string;
  name: string;
  price: number;
}

export interface CartItem extends MenuItem {
  cartId: string;
  selectedToppings?: Topping[];
  finalPrice: number;
  quantity: number;
}

export interface ClientInfo {
  name: string;
  phone?: string;
  address?: string;
  zone?: string;
  notes?: string;
}

export interface ClientData extends ClientInfo {
  firestoreId: string;
  createdAt?: number;
  isVirtual?: boolean;
}

export interface OrderItem {
  id: string;
  name: string;
  price: number;
  finalPrice: number;
  quantity: number;
  selectedToppings?: Topping[];
  isPortion?: boolean;
}

export interface OrderData {
  firestoreId: string;
  id: string;
  type: string; // 'Local' | 'Mesa' | 'Envío' | 'Web'
  reference: string;
  client: ClientInfo;
  items: OrderItem[];
  total: number;
  paymentMethod: string;
  cashProvided?: number;
  cashReceived?: number;
  tip?: number;
  status: 'Preparando' | 'Pendiente' | 'Finalizado';
  createdAt: number;
  time: string;
  isScheduled?: boolean;
  scheduledTime?: number | null;
  isPaid?: boolean;
  isArchived?: boolean;
  notes?: string;
  assignedDriver?: string | null;
  sessionId?: string | null;
  cfeDoc?: CfeDocument | null;
}

export interface DgiConfig {
  enabled: boolean;
  rut: string;
  businessName: string;
  commercialName: string;
  branch: string;
  branchAddress: string;
  environment: 'testing' | 'production';
  provider: 'facturando' | 'memory' | 'zetasoftware' | 'uruware' | 'biller' | 'sicfe' | 'invoicy' | 'billentis' | 'direct' | 'custom_api';
  apiKey: string;
  apiToken?: string;
  apiCompanyId?: string;
  apiSecret?: string;
  apiEndpoint?: string;
  defaultCfeType: '101' | '111';
  autoEmitOnCheckout: boolean;
  includeQrCode: boolean;
  ivaRate: number; // e.g. 22
  dgiCredentials?: {
    user: string;
    password?: string;
    rut: string;
    regime: 'iva_minimo' | 'general' | 'servicios_personales';
    monthlyFixedQuota?: number;
    iraeRate?: number;
  };
  bpsCredentials?: {
    user: string;
    password?: string;
    companyNumber: string;
    numEmployees: number;
    ownerType: 'unipersonal' | 'srl' | 'sociedad_hecho';
    baseOwnerSalary?: number;
    averageEmployeeSalary?: number;
  };
  facturandoConfig?: {
    apiEndpoint?: string;
    autoSendDgi?: boolean;
    sendEmailPdf?: boolean;
    tenantId?: string;
  };
  caeETicket: {
    serie: string;
    from: number;
    to: number;
    current: number;
    expirationDate: string;
    authNumber: string;
  };
  caeEFactura: {
    serie: string;
    from: number;
    to: number;
    current: number;
    expirationDate: string;
    authNumber: string;
  };
}

export interface CfeDocument {
  firestoreId?: string;
  orderId: string;
  cfeType: '101' | '102' | '111' | '112'; // 101: e-Ticket, 111: e-Factura
  cfeTypeName: string;
  serie: string;
  number: number;
  issuedAt: number;
  status: 'Aceptado DGI' | 'Pendiente' | 'Rechazado' | 'Anulado';
  emisorRut: string;
  emisorName: string;
  clientName: string;
  clientDocType: 'CI' | 'RUT' | 'PASAPORTE' | 'DNI' | 'SIN_DOCUMENTO';
  clientDocNumber: string;
  subtotalNeto: number;
  ivaRate: number;
  ivaAmount: number;
  total: number;
  securityCode: string;
  qrUrl: string;
  caeNumber: string;
  caeExpiration: string;
  items: OrderItem[];
  xmlSignedUrl?: string;
}

export interface SupportTicket {
  firestoreId?: string;
  id: string;
  title: string;
  category: 'impresora' | 'pos_caja' | 'dgi_facturacion' | 'pedidos_voz' | 'delivery_maps' | 'otro';
  priority: 'baja' | 'media' | 'alta' | 'urgente';
  description: string;
  status: 'Abierto' | 'En Proceso' | 'Resuelto';
  createdAt: number;
  contactPhone?: string;
  contactName?: string;
  solutionNotes?: string;
}

export interface StockItem {
  firestoreId: string;
  name: string;
  category: string;
  unit?: string;
}

export interface RegisterConfig {
  isOpen: boolean;
  initialCash: number;
  currentCash: number;
  sessionId: string | null;
  openedAt?: number;
  isLoaded?: boolean;
  initialStock?: Record<string, number>;
  currentStock?: Record<string, number>;
}

export interface SessionData {
  firestoreId?: string;
  sessionId: string | null;
  openedAt: number;
  closedAt: number;
  initialCash: number;
  finalCash: number;
  totalSales: number;
  totalTips: number;
  methodsBreakdown: Record<string, number>;
  itemsSoldBreakdown: Record<string, { qty: number; revenue: number }>;
  physicalTotals?: {
    metrosPizza: number;
    porcionesPizza: number;
    pizzetas: number;
    fainas: number;
    sandwiches: number;
  };
  orderCount: number;
  orders?: { id: string; total: number; items: OrderItem[] }[];
  notes?: string;
}

export interface ChatMessage {
  id: string;
  text: string;
  sender: string;
  createdAt: number;
  clientName?: string;
  clientPhone?: string;
}
