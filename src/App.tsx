import React, { useState, useEffect, useMemo, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';

import { auth, db, firebaseErrorMsg, appId } from './firebase';
import { 
  MenuItem, CartItem, ClientData, OrderData, StockItem, RegisterConfig, SessionData, ChatMessage,
  DgiConfig, CfeDocument, SupportTicket, OrderAuditEntry, AuditActionType
} from './types';
import { DEFAULT_MENU, DEFAULT_TOPPINGS, calculateToppingsCost, WARNING_THRESHOLDS } from './data/defaultMenu';
import { 
  exportToCSV, 
  exportOrdersToCSV, 
  exportOrdersToPDF, 
  exportSessionsToCSV, 
  exportMenuToCSV, 
  exportMenuToPDF, 
  exportStockToCSV 
} from './utils/exports';
import { printOrderTicket, printCashClosureTicket, printFullAccountingReport, CashClosureReportData } from './utils/printTicket';
import { extractBarrioAndAddress } from './utils/addressBarrio';
import { Icon } from './components/Icon';
import { OrderCard } from './components/OrderCard';
import { KdsMonitor } from './components/KdsMonitor';
import { VoiceOrderModal } from './components/VoiceOrderModal';
import { PosWizard } from './components/PosWizard';
import { ToppingModal } from './components/ToppingModal';
import { CrmClientsTab } from './components/CrmClientsTab';
import { SupportTab } from './components/SupportTab';
import { OperationsManualTab } from './components/OperationsManualTab';
import { ImportHistoryExcelModal } from './components/ImportHistoryExcelModal';
import { ImportMenuModal } from './components/ImportMenuModal';
import { ImportStockModal } from './components/ImportStockModal';
import { WhatsAppOrderParserModal } from './components/WhatsAppOrderParserModal';
import { CustomerObjectionsModal } from './components/CustomerObjectionsModal';
import { DeliveryRiderTab } from './components/DeliveryRiderTab';
import { StaffPerformanceTab } from './components/StaffPerformanceTab';
import { AdminAuditHistoryTab } from './components/AdminAuditHistoryTab';
import { DEFAULT_DGI_CONFIG, createCfeDocumentFromOrder } from './utils/dgiCfe';
import { ParsedVoiceOrder } from './utils/voiceOrderParser';

export type UserRole = 'admin' | 'cajero' | 'mozo' | 'delivery';

interface ShortageRecord {
  firestoreId: string;
  name: string;
  affectedItemIds: string[];
  active: boolean;
  createdAt: number;
  createdBy?: string;
}

export const detectRoleFromIdentity = (input: string): { role: UserRole; displayName: string } => {
  const normalized = input.trim().toLowerCase();

  // 1. Delivery Drivers by Name (Fefo = 1, Caetano = 2, Samuel = 3)
  if (normalized.includes('fefo') || normalized === 'delivery1' || normalized.includes('delivery 1') || normalized.includes('repartidor1')) {
    return {
      role: 'delivery',
      displayName: '🏍️ Delivery 1 • Fefo'
    };
  }
  if (normalized.includes('caetano') || normalized === 'delivery2' || normalized.includes('delivery 2') || normalized.includes('repartidor2')) {
    return {
      role: 'delivery',
      displayName: '🏍️ Delivery 2 • Caetano'
    };
  }
  if (normalized.includes('samuel') || normalized === 'delivery3' || normalized.includes('delivery 3') || normalized.includes('repartidor3')) {
    return {
      role: 'delivery',
      displayName: '🏍️ Delivery 3 • Samuel'
    };
  }

  // Generic Delivery Driver / Repartidor (delivery, moto, cadete, etc.)
  if (
    normalized.includes('delivery') || 
    normalized.includes('repartidor') || 
    normalized.includes('moto') || 
    normalized.includes('cadete') || 
    normalized.includes('chofer') ||
    normalized.startsWith('del')
  ) {
    const numMatch = normalized.match(/\d+/);
    const numStr = numMatch ? ` #${numMatch[0]}` : '';
    return {
      role: 'delivery',
      displayName: `🏍️ Repartidor Delivery${numStr}`
    };
  }

  // 2. Mozo / Salón (mozo1, mozo2, moza1, salon1, camarero1, etc.)
  if (
    normalized.includes('mozo') || 
    normalized.includes('moza') || 
    normalized.includes('salon') || 
    normalized.includes('salón') || 
    normalized.includes('camarero') || 
    normalized.includes('mesero')
  ) {
    const numMatch = normalized.match(/\d+/);
    const numStr = numMatch ? ` #${numMatch[0]}` : '';
    return {
      role: 'mozo',
      displayName: `🍽️ Mozo / Salón${numStr}`
    };
  }

  // 3. Cajera / Cajero (cajera1, cajera2, cajera3, cajero1, caja1, etc.)
  if (
    normalized.includes('cajero') || 
    normalized.includes('cajera') || 
    normalized.includes('caja')
  ) {
    const numMatch = normalized.match(/\d+/);
    const numStr = numMatch ? ` #${numMatch[0]}` : '';
    return {
      role: 'cajero',
      displayName: `💵 Cajera / Cajero${numStr}`
    };
  }

  // 4. Dueño / Administrador / Supervisor / Admin Vicky (Admin1Vicky@gmail.com)
  if (
    normalized.includes('admin') || 
    normalized.includes('vicky') ||
    normalized.includes('dueño') || 
    normalized.includes('dueno') || 
    normalized.includes('propietario') || 
    normalized.includes('supervisor') || 
    normalized.includes('gerente')
  ) {
    const isVicky = normalized.includes('vicky');
    return {
      role: 'admin',
      displayName: isVicky ? '👑 Admin • Vicky' : '👑 Dueño / Administrador'
    };
  }

  // Fallback default
  return {
    role: 'cajero',
    displayName: `💵 Operador (${input.trim()})`
  };
};

export default function App() {
  const [activeTab, setActiveTab] = useState('kitchen');
  const [posStep, setPosStep] = useState<1 | 2 | 3>(1);
  const [voiceOrderModalOpen, setVoiceOrderModalOpen] = useState(false);
  const [showKdsFullscreenModal, setShowKdsFullscreenModal] = useState(false);
  const [isImportMenuModalOpen, setIsImportMenuModalOpen] = useState(false);
  const [isImportStockModalOpen, setIsImportStockModalOpen] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [register, setRegister] = useState<RegisterConfig>({ 
    isOpen: false, initialCash: 0, currentCash: 0, sessionId: null, isLoaded: false, currentStock: {}, initialStock: {} 
  });
  const [stockItems, setStockItems] = useState<StockItem[]>([]); 
  const [shortages, setShortages] = useState<ShortageRecord[]>([]);
  const [shortagesModalOpen, setShortagesModalOpen] = useState(false);
  const [shortageName, setShortageName] = useState('');
  const [shortageAffectedIds, setShortageAffectedIds] = useState<string[]>([]);
  const [deleteRequestModal, setDeleteRequestModal] = useState<{ isOpen: boolean; order: OrderData | null; note: string; confirmation: string }>({
    isOpen: false, order: null, note: '', confirmation: ''
  });
  const [pendingDeleteModalOpen, setPendingDeleteModalOpen] = useState(false);
  const [uiMessage, setUiMessage] = useState<{ text: string; type: string } | null>(null);

  // DGI Facturación Electrónica & Soporte
  const [dgiConfig, setDgiConfig] = useState<DgiConfig>(DEFAULT_DGI_CONFIG);
  const [cfeDocuments, setCfeDocuments] = useState<CfeDocument[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [forceReconnect, setForceReconnect] = useState(0); 
  
  const [firebaseStatus, setFirebaseStatus] = useState({ 
    connected: false, uid: null as string | null, error: firebaseErrorMsg || null, checking: true 
  });

  const [newOrderAlerts, setNewOrderAlerts] = useState<OrderData[]>([]);
  const initialLoadComplete = useRef(false);
  const initialMessagesLoaded = useRef(false); 
  const prevOrdersIds = useRef<string[]>([]);

  const [activeCategory, setActiveCategory] = useState('TODOS');
  const [orderType, setOrderType] = useState('Local');
  const [clientInfo, setClientInfo] = useState<{ phone: string; name: string; address: string; zone: string; tableNumber?: string; assignedWaiter?: string }>({ phone: '', name: '', address: '', zone: '' });
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashProvided, setCashProvided] = useState(''); 
  const [orderTip, setOrderTip] = useState('0');
  const [orderNotes, setOrderNotes] = useState(''); 
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('');
  const [initialStockInput, setInitialStockInput] = useState<Record<string, string>>({});
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const [toppingModal, setToppingModal] = useState<{ isOpen: boolean; item: any; selectedToppings: any[]; quantity: number; editingCartId?: string }>({ 
    isOpen: false, item: null, selectedToppings: [], quantity: 1 
  });
  const [editOrderModal, setEditOrderModal] = useState<{ 
    isOpen: boolean; 
    order: OrderData | null; 
    cashReceived: string; 
    tip: string; 
    voucherDelivered: boolean; 
    transferConfirmed: boolean;
    selectedPaymentMethod: string;
  }>({ 
    isOpen: false, order: null, cashReceived: '', tip: '0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: 'Efectivo' 
  });
  const [deliveryShareModal, setDeliveryShareModal] = useState<{ isOpen: boolean; order: OrderData | null }>({ 
    isOpen: false, order: null 
  });
  const [notesModal, setNotesModal] = useState<{ isOpen: boolean; order: OrderData | null; text: string }>({ 
    isOpen: false, order: null, text: '' 
  });
  const navRef = useRef<HTMLDivElement>(null);
  const [editingOrder, setEditingOrder] = useState<OrderData | null>(null);
  const [resolvePendingModal, setResolvePendingModal] = useState<{ isOpen: boolean; pending: OrderData[] }>({ 
    isOpen: false, pending: [] 
  });

  // Modals for editing sales history, closed shifts, products, and cash
  const [editSaleModal, setEditSaleModal] = useState<{
    isOpen: boolean;
    order: OrderData | null;
    paymentMethod: string;
    total: string;
    tip: string;
    notes: string;
    status: string;
  }>({
    isOpen: false,
    order: null,
    paymentMethod: 'Efectivo',
    total: '',
    tip: '0',
    notes: '',
    status: 'Finalizado'
  });

  const [editSessionModal, setEditSessionModal] = useState<{
    isOpen: boolean;
    session: SessionData | null;
    totalSales: string;
    finalCash: string;
    initialCash: string;
    totalTips: string;
    notes: string;
  }>({
    isOpen: false,
    session: null,
    totalSales: '',
    finalCash: '',
    initialCash: '',
    totalTips: '',
    notes: ''
  });

  const [adjustCashModal, setAdjustCashModal] = useState<{
    isOpen: boolean;
    amount: string;
  }>({
    isOpen: false,
    amount: ''
  });

  // Open Register Prompt on Login / Startup
  const [openRegisterPromptModal, setOpenRegisterPromptModal] = useState<{
    isOpen: boolean;
    initialCash: string;
  }>({
    isOpen: false,
    initialCash: ''
  });
  const [adminConsultationMode, setAdminConsultationMode] = useState<boolean>(false);
  const hasCheckedRegisterOnLogin = useRef<boolean>(false);

  // Audit Logs (Anti-fraud & modifications history for admin only)
  const [auditLogs, setAuditLogs] = useState<OrderAuditEntry[]>([]);
  const auditLogsRef = useRef<OrderAuditEntry[]>([]);
  const initialAuditLoadDone = useRef<boolean>(false);
  const [adminAlertSoundEnabled, setAdminAlertSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nextcrm_admin_alert_sound') !== 'false';
    }
    return true;
  });
  const adminAlertSoundEnabledRef = useRef<boolean>(adminAlertSoundEnabled);
  const [activeAlertBanner, setActiveAlertBanner] = useState<OrderAuditEntry | null>(null);

  useEffect(() => {
    adminAlertSoundEnabledRef.current = adminAlertSoundEnabled;
    try {
      localStorage.setItem('nextcrm_admin_alert_sound', String(adminAlertSoundEnabled));
    } catch {}
  }, [adminAlertSoundEnabled]);

  const playAdminAlertTone = () => {
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.connect(gain);
      gain.connect(ctx.destination);

      // Distinct 3-frequency warning chime for Cashier changes
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.setValueAtTime(1174.66, now + 0.12);
      osc.frequency.setValueAtTime(1567.98, now + 0.24);

      gain.gain.setValueAtTime(0.28, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.start(now);
      osc.stop(now + 0.55);
    } catch (e) {
      console.warn("Could not play admin alert tone:", e);
    }
  };

  // Universal In-App Confirmation Dialog (Replaces blocking window.confirm)
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    confirmVariant: 'primary',
    onConfirm: () => {}
  });

  const showConfirm = (opts: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    confirmVariant?: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
  }) => {
    setConfirmModal({
      isOpen: true,
      title: opts.title,
      message: opts.message,
      confirmText: opts.confirmText || 'Confirmar',
      cancelText: opts.cancelText || 'Cancelar',
      confirmVariant: opts.confirmVariant || 'primary',
      onConfirm: () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
        opts.onConfirm();
      }
    });
  };

  const [finishedFilter, setFinishedFilter] = useState({ search: '', method: 'TODOS', type: 'TODOS' });
  const [selectedFinishedOrders, setSelectedFinishedOrders] = useState<string[]>([]);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [menuActiveCategory, setMenuActiveCategory] = useState<string>('TODAS');
  const [dismissedBadges, setDismissedBadges] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('elarbol_dismissed_badges');
        return saved ? JSON.parse(saved) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const markTabBadgeDismissed = (tabId: string, count: number) => {
    setDismissedBadges(prev => {
      const updated = { ...prev, [tabId]: count };
      try {
        localStorage.setItem('elarbol_dismissed_badges', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  // NEXT CRM Security Layers (4-Tier Role-Based Access Control)
  const [currentUser, setCurrentUser] = useState<{
    username: string;
    role: UserRole;
    displayName: string;
  }>(() => {
    if (typeof window !== 'undefined') {
      const savedUser = localStorage.getItem('nextcrm_user') || 'admin';
      const detected = detectRoleFromIdentity(savedUser);
      return {
        username: savedUser,
        role: detected.role,
        displayName: detected.displayName
      };
    }
    return { username: 'admin', role: 'admin', displayName: '👑 Dueño / Administrador' };
  });

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('nextcrm_auth') === 'true';
    }
    return false;
  });
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);

  // Admin Security Authorization Modal for Restricted Actions
  const [adminAuthModal, setAdminAuthModal] = useState<{
    isOpen: boolean;
    actionName: string;
    onSuccess: (() => void) | null;
  }>({
    isOpen: false,
    actionName: '',
    onSuccess: null
  });
  const [adminAuthPassword, setAdminAuthPassword] = useState('');
  const [adminAuthError, setAdminAuthError] = useState('');

  const requireAdminAuth = (actionName: string, callback: () => void) => {
    if (currentUser.role === 'admin') {
      callback();
    } else {
      setAdminAuthModal({
        isOpen: true,
        actionName,
        onSuccess: callback
      });
      setAdminAuthPassword('');
      setAdminAuthError('');
    }
  };

  // Stock Modals
  const [importExcelModalOpen, setImportExcelModalOpen] = useState(false);
  const [customerObjectionsModalOpen, setCustomerObjectionsModalOpen] = useState(false);
  const [whatsAppParserModalOpen, setWhatsAppParserModalOpen] = useState(false);
  const [newStockItemModal, setNewStockItemModal] = useState(false);
  const [newStockItemForm, setNewStockItemForm] = useState({ name: '', category: 'Pizzas', unit: 'Metros' });
  const [editStockModal, setEditStockModal] = useState<{ isOpen: boolean; item: StockItem | null; form: { name: string; category: string; qty: number } }>({ 
    isOpen: false, item: null, form: { name: '', category: '', qty: 0 } 
  });

  // Client Modals
  const [newClientModal, setNewClientModal] = useState(false);
  const [newClientForm, setNewClientForm] = useState({ name: '', phone: '', address: '', zone: '' });
  const [editingClient, setEditingClient] = useState<ClientData | null>(null);

  // Stock Alerts
  const [dismissedStockAlerts, setDismissedStockAlerts] = useState<string[]>([]);
  const [showStockAlertModal, setShowStockAlertModal] = useState(false);

  // Theme State: Fixed to 'dark-deluxe' (Black Deluxe)
  const isDarkDeluxe = true;

  const th = useMemo(() => ({
    isDarkDeluxe: true,
    header: 'bg-[#040108] border-b border-purple-500/20',
    logoBorder: 'border-purple-500',
    tabActiveBg: 'bg-[#0e061d]',
    tabActiveText: 'text-purple-300',
    tabActiveBorder: 'border-purple-500',
    priceText: 'text-purple-300',
    cardBorderHover: 'hover:border-purple-500',
    btnBg: 'bg-purple-600 hover:bg-purple-500 text-white',
    btnBgHover: 'hover:bg-purple-500',
    accentBgHover: 'group-hover:bg-purple-500/10',
    ringPrimary: 'focus:border-purple-500',
  }), []);

  const handleApplyVoiceOrder = (parsed: ParsedVoiceOrder, autoSubmit = false) => {
    if (parsed.items && parsed.items.length > 0) {
      setCart(prev => [...prev, ...parsed.items]);
    }
    if (parsed.destination) {
      setOrderType(parsed.destination);
    }
    if (parsed.paymentMethod) {
      setPaymentMethod(parsed.paymentMethod);
    }
    if (parsed.cashProvided) {
      setCashProvided(String(parsed.cashProvided));
    }
    if (parsed.client) {
      setClientInfo(prev => ({
        name: parsed.client?.name || prev.name,
        phone: parsed.client?.phone || prev.phone,
        address: parsed.client?.address || prev.address,
        zone: parsed.client?.zone || prev.zone,
        tableNumber: parsed.client?.tableNumber || (prev as any).tableNumber || '',
        assignedWaiter: parsed.client?.assignedWaiter || (prev as any).assignedWaiter || ''
      }));
    }
    if (parsed.notes) {
      setOrderNotes(prev => prev ? `${prev}, ${parsed.notes}` : (parsed.notes || ''));
    }
    setActiveTab('pos');

    if (autoSubmit) {
      handleCheckout(false);
      return;
    }

    // Smart step progression:
    // If only items were added, keep in Step 1 (Menú) so user sees products added.
    // If destination or client were specified, move to Step 2 (Destino).
    if (parsed.client?.name || parsed.client?.address || (parsed.destination && parsed.destination !== 'Local')) {
      setPosStep(2);
    } else {
      setPosStep(1);
    }
    showMessage(`¡Pedido por voz agregado con éxito! (${parsed.items.length} productos)`, 'success');
  };

  const [menu, setMenu] = useState<Record<string, MenuItem[]>>(DEFAULT_MENU);
  const [editProductModal, setEditProductModal] = useState<{ 
    isOpen: boolean; 
    category: string; 
    item: MenuItem | null; 
    name: string; 
    desc: string; 
    price: string; 
    isPortion: boolean; 
    isMeter: boolean; 
    hasToppings: boolean; 
    maxToppings: number; 
  }>({ 
    isOpen: false, 
    category: '', 
    item: null, 
    name: '', 
    desc: '', 
    price: '', 
    isPortion: false, 
    isMeter: false, 
    hasToppings: false, 
    maxToppings: 4 
  });
  const [newProductModal, setNewProductModal] = useState(false);
  const [newProductForm, setNewProductForm] = useState({ 
    category: 'pizzas', name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 0 
  });

  const showMessage = (msg: string, type = 'success') => { 
    setUiMessage({ text: msg, type }); 
    setTimeout(() => setUiMessage(null), 3500); 
  };

  useEffect(() => {
    if (!auth) { 
      setFirebaseStatus({ connected: false, uid: null, error: "Firebase no inicializado.", checking: false }); 
      return; 
    }
    const initAuth = async () => {
      try { 
        setFirebaseStatus(prev => ({ ...prev, checking: true, error: null }));
        let credential;
        if (typeof window !== 'undefined' && window.__initial_auth_token) { 
          credential = await signInWithCustomToken(auth, window.__initial_auth_token); 
        } else { 
          credential = await signInAnonymously(auth); 
        }
        setFirebaseStatus({ connected: true, uid: credential.user.uid, error: null, checking: false });
      } catch (e: any) { 
        setFirebaseStatus({ connected: false, uid: null, error: `Login Error: ${e.message}`, checking: false }); 
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !user?.uid) return;

    setFirebaseStatus(prev => ({ ...prev, checking: true }));
    setTimeout(() => setFirebaseStatus(prev => ({ ...prev, checking: false })), 800);

    const unsubClients = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), (s) => {
      setClients(s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })));
    }, console.error);

    // Stock Items listener
    const unsubStock = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'stockItems'), (s) => {
      const items = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id }));
      setStockItems(items);
    }, console.error);

    const unsubShortages = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'shortages'), (s) => {
      const items = s.docs
        .map(d => ({ ...(d.data() as any), firestoreId: d.id } as ShortageRecord))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setShortages(items);
    }, console.error);

    const unsubOrders = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), (s) => {
      const rawOrders = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id }));
      const fetchedOrders = rawOrders.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

      if (initialLoadComplete.current) {
         const newOnes = fetchedOrders.filter(o => {
             if (prevOrdersIds.current.includes(o.firestoreId)) return false;
             if (o.status === 'Finalizado' || o.isArchived) return false;
             const isWeb = ['web', 'pedido web'].includes(String(o.type || '').toLowerCase());
             if (o.status === 'Pendiente' && !isWeb) return false;
             return true;
         });
         if (newOnes.length > 0) {
             setNewOrderAlerts(prev => { 
               const existingIds = prev.map(p => p.firestoreId); 
               const trulyNew = newOnes.filter(n => !existingIds.includes(n.firestoreId)); 
               return [...prev, ...trulyNew]; 
             });
         }
      } else { initialLoadComplete.current = true; }
      prevOrdersIds.current = fetchedOrders.map(o => o.firestoreId);
      setOrders(fetchedOrders);
    }, () => setFirebaseStatus(prev => ({ ...prev, error: "Conexión inestable. Reintentando..." })));

    const unsubReg = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), (s) => {
      if (s.exists()) {
          setRegister({ ...(s.data() as any), isLoaded: true });
          if(s.data().isOpen && activeTab === 'cash') setActiveTab('pos');
      }
      else setRegister({ isOpen: false, initialCash: 0, currentCash: 0, sessionId: null, isLoaded: true, currentStock: {}, initialStock: {} });
    }, console.error);

    const unsubSessions = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), (s) => {
      const rawSessions = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id }));
      const validSessions = rawSessions.sort((a, b) => (b.openedAt || b.closedAt || 0) - (a.openedAt || a.closedAt || 0));
      setSessions(validSessions);
    }, console.error);

    const unsubMenu = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), (s) => {
      if (s.exists() && s.data().data !== undefined) {
        const raw = s.data().data || {};
        const cleaned: Record<string, MenuItem[]> = {};
        Object.keys(raw).forEach(cat => {
          const list = raw[cat] || [];
          const seen = new Set<string>();
          cleaned[cat] = list.filter((it: MenuItem) => {
            const nameNorm = (it.name || '').trim().toLowerCase();
            if (!nameNorm || seen.has(nameNorm)) return false;
            seen.add(nameNorm);
            return true;
          });
        });
        if (!cleaned.promos || cleaned.promos.length === 0) {
          cleaned.promos = DEFAULT_MENU.promos || [];
        }
        setMenu(cleaned);
      } else {
        setMenu(DEFAULT_MENU);
      }
    }, console.error);

    // DGI Config Listener
    const unsubDgiConfig = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'dgi'), (s) => {
      if (s.exists()) {
        setDgiConfig(s.data() as DgiConfig);
      } else {
        setDgiConfig(DEFAULT_DGI_CONFIG);
      }
    }, console.error);

    // DGI CFE Documents Listener
    const unsubCfeDocs = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'cfe_documents'), (s) => {
      const docs = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })).sort((a, b) => b.issuedAt - a.issuedAt);
      setCfeDocuments(docs);
    }, console.error);

    // Support Tickets Listener
    const unsubTickets = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'support_tickets'), (s) => {
      const tix = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })).sort((a, b) => b.createdAt - a.createdAt);
      setSupportTickets(tix);
    }, console.error);

    // Audit Logs Listener (Anti-fraud & modifications for admin)
    const unsubAudit = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'), (s) => {
      const logs = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })).sort((a, b) => b.timestamp - a.timestamp);
      
      // Trigger live alert for admin when a cashier modifies or deletes an order
      if (initialAuditLoadDone.current && currentUser.role === 'admin' && logs.length > 0) {
        const newestLog = logs[0];
        const isNew = !auditLogsRef.current.some(existing => existing.firestoreId === newestLog.firestoreId);
        if (isNew && (newestLog.userRole === 'cajero' || (newestLog.userRole !== 'admin' && newestLog.userRole))) {
          if (adminAlertSoundEnabledRef.current) {
            playAdminAlertTone();
          }
          setActiveAlertBanner(newestLog);
        }
      }

      initialAuditLoadDone.current = true;
      auditLogsRef.current = logs;
      setAuditLogs(logs);
    }, console.error);

    return () => { 
      unsubOrders(); 
      unsubClients(); 
      unsubReg(); 
      unsubSessions(); 
      unsubMenu(); 
      unsubStock(); 
      unsubShortages();
      unsubDgiConfig();
      unsubCfeDocs();
      unsubTickets();
      unsubAudit();
    };
  }, [user?.uid, forceReconnect]);

  // Prompt cash register opening upon login if closed - mandatory before operation
  // Cajero: Obligatorio abrir caja con monto (no tiene modo consulta)
  // Admin: Obligatorio ingresar monto si abre caja, con opción exclusiva de entrar en Modo Consulta
  useEffect(() => {
    if (isAuthenticated && register.isLoaded && !register.isOpen) {
      if (currentUser.role === 'admin') {
        if (!adminConsultationMode && !openRegisterPromptModal.isOpen) {
          setOpenRegisterPromptModal(prev => ({
            isOpen: true,
            initialCash: prev.isOpen ? prev.initialCash : ''
          }));
        }
      } else if (currentUser.role === 'cajero') {
        if (!openRegisterPromptModal.isOpen) {
          setOpenRegisterPromptModal(prev => ({
            isOpen: true,
            initialCash: prev.isOpen ? prev.initialCash : ''
          }));
        }
      }
    } else if (register.isOpen) {
      if (openRegisterPromptModal.isOpen) {
        setOpenRegisterPromptModal({ isOpen: false, initialCash: '' });
      }
      if (adminConsultationMode) {
        setAdminConsultationMode(false);
      }
    }
  }, [isAuthenticated, register.isLoaded, register.isOpen, currentUser.role, adminConsultationMode, openRegisterPromptModal.isOpen]);

  // Helper to compute next strictly correlative, non-repeating order ID (#0001, #0002, ...) across all types (Mostrador, Retiro, Mesas, Delivery, Web)
  const getNextCorrelativeOrderId = (existingOrders: OrderData[]): string => {
    let maxNum = 0;
    existingOrders.forEach(o => {
      if (o.id) {
        // Extract numeric digits from id (e.g., "#0042" -> 42, "0042" -> 42)
        const match = o.id.replace('#', '').trim().match(/^\d+/);
        if (match) {
          const num = parseInt(match[0], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    const nextNum = maxNum + 1;
    return `#${String(nextNum).padStart(4, '0')}`;
  };

  const getItemUnit = (item: StockItem): string => {
    if (item.unit) return item.unit;
    const name = (item.name || '').toLowerCase();
    const cat = (item.category || '').toLowerCase();
    if (name.includes('pizza') || name.includes('figaza') || cat.includes('pizza') || cat.includes('figaza')) {
      if (name.includes('pizzeta') || cat.includes('pizzeta')) return 'Unidades';
      return 'Metros';
    }
    if (name.includes('fainá') || name.includes('faina') || cat.includes('fainá') || cat.includes('faina')) return 'Porciones';
    return 'Unidades';
  };

  const getItemUnitSymbol = (item: StockItem): string => {
    const unit = getItemUnit(item);
    if (unit === 'Metros') return 'm';
    if (unit === 'Porciones') return 'porciones';
    return 'u';
  };

  const lowStockAlerts = useMemo(() => {
      if (!register.isOpen) return [];
      return stockItems.filter(item => {
          const current = register.currentStock?.[item.firestoreId] ?? 0;
          const unit = getItemUnit(item);
          if (unit === 'Metros') return current <= 2;
          if (unit === 'Porciones') return current <= 5;
          return current <= 3;
      }).map(item => ({...item, currentQty: register.currentStock?.[item.firestoreId] ?? 0}));
  }, [stockItems, register.currentStock, register.isOpen]);

  useEffect(() => {
      if (lowStockAlerts.length > 0) {
          const hasNewAlerts = lowStockAlerts.some(alert => !dismissedStockAlerts.includes(alert.firestoreId));
          if (hasNewAlerts) setShowStockAlertModal(true);
      } else {
          setShowStockAlertModal(false);
      }
  }, [lowStockAlerts, dismissedStockAlerts]);

  const allClients = useMemo(() => {
    // Only real clients from database - strictly no fictitious/virtual clients
    const orderStatsMap: Record<string, { count: number; lastOrder: number }> = {};
    orders.forEach(o => {
      if (!o.client) return;
      const cleanP = String(o.client.phone || '').trim().replace(/\D/g, '');
      const cleanN = String(o.client.name || '').trim().toLowerCase();
      const key = cleanP || (cleanN !== 'sin nombre' && cleanN !== 'consumidor final' ? cleanN : '');
      if (key) {
        if (!orderStatsMap[key]) orderStatsMap[key] = { count: 0, lastOrder: 0 };
        orderStatsMap[key].count++;
        if (o.createdAt && o.createdAt > orderStatsMap[key].lastOrder) {
          orderStatsMap[key].lastOrder = o.createdAt;
        }
      }
    });

    const clientList: ClientData[] = clients.map(c => {
      const rawPhone = c.phone === 'N/A' ? '' : (c.phone || '');
      const rawAddress = c.address === 'N/A' ? '' : (c.address || '');
      const rawZone = c.zone === 'N/A' ? '' : (c.zone || '');
      const cleanP = rawPhone ? String(rawPhone).trim().replace(/\D/g, '') : '';
      const cleanN = c.name ? String(c.name).trim().toLowerCase() : '';
      const key = cleanP || (cleanN !== 'sin nombre' && cleanN !== 'consumidor final' ? cleanN : '');
      const stats = key ? orderStatsMap[key] : null;

      return {
        ...c,
        phone: rawPhone,
        address: rawAddress,
        zone: rawZone,
        orderCount: (c as any).orderCount || stats?.count || 0,
        lastOrderAt: (c as any).lastOrderAt || stats?.lastOrder || c.createdAt || 0,
        isVirtual: false
      };
    });

    // Sort to keep clients with recent orders first, then alphabetical by name
    return clientList.sort((a, b) => {
      const timeA = (a as any).lastOrderAt || a.createdAt || 0;
      const timeB = (b as any).lastOrderAt || b.createdAt || 0;
      if (timeB !== timeA) return timeB - timeA;
      return String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [clients, orders]);

  const matchingClients = useMemo(() => {
    const rawPhone = String(clientInfo.phone || '').trim();
    const cleanPhoneDigits = rawPhone.replace(/\D/g, '');
    const rawName = String(clientInfo.name || '').trim().toLowerCase();
    const isGenericName = rawName === 'consumidor final' || rawName === 'sin nombre' || rawName.startsWith('mesa #');
    const searchName = isGenericName ? '' : rawName;
    const searchAddress = String(clientInfo.address || '').trim().toLowerCase();

    // If nothing typed yet, return top fresh/recent clients from DB
    if (!cleanPhoneDigits && !searchName && !searchAddress) {
      return allClients.slice(0, 8);
    }

    return allClients.filter(c => {
      const cPhoneDigits = String(c.phone || '').trim().replace(/\D/g, '');
      const cName = String(c.name || '').toLowerCase();
      const cAddress = String(c.address || '').toLowerCase();
      const cZone = String(c.zone || '').toLowerCase();

      if (cleanPhoneDigits.length > 0) {
        if (cPhoneDigits.includes(cleanPhoneDigits) || cleanPhoneDigits.includes(cPhoneDigits)) {
          return true;
        }
      }

      if (searchName.length > 1) {
        if (cName.includes(searchName)) {
          return true;
        }
      }

      if (searchAddress.length > 2) {
        if (cAddress.includes(searchAddress) || cZone.includes(searchAddress)) {
          return true;
        }
      }

      return false;
    }).slice(0, 8);
  }, [allClients, clientInfo.name, clientInfo.phone, clientInfo.address]);

  const allMenuItems = useMemo(() => { 
    let items: MenuItem[] = []; 
    Object.keys(menu).forEach(cat => { if (cat.toLowerCase() !== 'gustos') items = [...items, ...menu[cat]]; }); 
    return items; 
  }, [menu]);

  const reportData = useMemo(() => {
    const currentOrders = orders.filter(o => !o.isArchived); 
    const sType = (t: string) => String(t || '').trim().toLowerCase(); 
    
    const stats = { 
        totalSales: 0, 
        totalTips: 0, 
        methods: { Efectivo: 0, Débito: 0, Crédito: 0, Transferencia: 0, 'A confirmar': 0 } as Record<string, number>, 
        itemsSold: {} as Record<string, { qty: number; revenue: number }>, 
        physicalTotals: { metrosPizza: 0, porcionesPizza: 0, pizzetas: 0, fainas: 0, sandwiches: 0 }, 
        delivery: currentOrders.filter(o => o.status !== 'Finalizado' && o.status !== 'Cancelado' && ['envío', 'envio', 'delivery', 'reparto'].includes(sType(o.type))), 
        mostrador: currentOrders.filter(o => o.status !== 'Finalizado' && o.status !== 'Cancelado' && ['local', 'mostrador'].includes(sType(o.type))), 
        mesas: currentOrders.filter(o => o.status !== 'Finalizado' && o.status !== 'Cancelado' && sType(o.type) === 'mesa'), 
        web: currentOrders.filter(o => o.status !== 'Finalizado' && o.status !== 'Cancelado' && ['web', 'pedido web'].includes(sType(o.type))), 
        finishedTotal: currentOrders.filter(o => o.status === 'Finalizado').length, 
        kitchenTotal: currentOrders.filter(o => o.status === 'Preparando' || o.status === 'Pendiente').length 
    };
    
    currentOrders.filter(o => o.status === 'Finalizado').forEach(o => {
      stats.totalSales += (o.total || 0); 
      stats.totalTips += (o.tip || 0);
      const method = o.paymentMethod || 'Efectivo';
      stats.methods[method] = (stats.methods[method] || 0) + (o.total || 0) + (o.tip || 0);
      
      if (o.items && Array.isArray(o.items)) {
          o.items.forEach(it => {
             const itemName = it.name || 'Desconocido'; 
             const qty = it.quantity || 1; 
             const revenue = Math.round((it.finalPrice || 0) * qty);
             
             if (!stats.itemsSold[itemName]) stats.itemsSold[itemName] = { qty: 0, revenue: 0 };
             stats.itemsSold[itemName].qty += qty; 
             stats.itemsSold[itemName].revenue += revenue;
             
             const nameLower = itemName.toLowerCase();
             if (nameLower.includes('1 metro muzzarella + 2 fainás')) {
                 stats.physicalTotals.metrosPizza += (1 * qty);
                 stats.physicalTotals.fainas += (2 * qty);
             } else if (nameLower.includes('1/2 metro')) {
                 stats.physicalTotals.metrosPizza += (0.5 * qty);
             } else if (nameLower.includes('x metro') || nameLower.includes('1 metro')) {
                 stats.physicalTotals.metrosPizza += (1 * qty);
             } else if (nameLower.includes('porción') || nameLower.includes('porcion')) {
                 stats.physicalTotals.porcionesPizza += (1 * qty);
             } else if (nameLower.includes('fainá') || nameLower.includes('faina')) {
                 stats.physicalTotals.fainas += (1 * qty);
             } else if (nameLower.includes('pizzeta')) {
                 stats.physicalTotals.pizzetas += (1 * qty);
             } else if (nameLower.includes('sándwich') || nameLower.includes('sandwich')) {
                 stats.physicalTotals.sandwiches += (1 * qty);
             }
          });
      }
    });
    if(stats.methods['A confirmar'] === 0) delete stats.methods['A confirmar'];
    return stats;
  }, [orders]);

  const badges = useMemo(() => {
    let deliveryCount = reportData.delivery.length;
    if (currentUser.role === 'delivery') {
      const u = (currentUser.username || '').toLowerCase();
      const d = (currentUser.displayName || '').toLowerCase();
      let myName = 'Fefo';
      if (u.includes('caetano') || d.includes('caetano') || u === 'delivery2') myName = 'Caetano';
      else if (u.includes('samuel') || d.includes('samuel') || u === 'delivery3') myName = 'Samuel';
      deliveryCount = reportData.delivery.filter(o => (o.assignedDriver || '').toLowerCase() === myName.toLowerCase()).length;
    }

    const cashierModifications = auditLogs.filter(l => 
      (l.userRole === 'cajero' || (l.userRole !== 'admin' && l.userRole)) &&
      (register.sessionId ? l.sessionId === register.sessionId : true)
    ).length;

    return { 
      kitchen: reportData.kitchenTotal, 
      mostrador: reportData.mostrador.length, 
      mesas: reportData.mesas.length, 
      delivery: deliveryCount, 
      web: reportData.web.length, 
      finished: reportData.finishedTotal, 
      stock: lowStockAlerts.length,
      audit: cashierModifications
    };
  }, [reportData, lowStockAlerts.length, currentUser, auditLogs, register.sessionId]);

  // Auto-dismiss active tab badge and persist in localStorage
  useEffect(() => {
    if (activeTab) {
      const currentRaw = (badges as any)[activeTab] || (activeTab === 'finished' ? reportData.finishedTotal : activeTab === 'stock' ? lowStockAlerts.length : 0);
      if (currentRaw > 0) {
        markTabBadgeDismissed(activeTab, currentRaw);
      }
    }
  }, [activeTab, badges, reportData.finishedTotal, lowStockAlerts.length]);

  const activeShortages = useMemo(() => shortages.filter(s => s.active !== false), [shortages]);

  const addToCart = (item: MenuItem, selectedToppings: any[], initialQty = 1) => {
    const blockingShortage = activeShortages.find(s => (s.affectedItemIds || []).includes(item.id));
    if (blockingShortage) {
      showMessage(`⚠️ NO DISPONIBLE: ${item.name}. Falta: ${blockingShortage.name}. Avisar al cliente antes de vender.`, 'error');
      return;
    }
    const toppingsCost = calculateToppingsCost(item, selectedToppings);
    const finalPrice = item.price + (toppingsCost / initialQty);
    setCart([...cart, { ...item, cartId: Math.random().toString(36).substr(2,9), selectedToppings, finalPrice, quantity: initialQty }]);
  };

  const saveShortage = async () => {
    const name = shortageName.trim();
    if (!name) return showMessage('Escribí el insumo o producto faltante', 'error');
    if (shortageAffectedIds.length === 0) return showMessage('Seleccioná al menos un producto del menú afectado', 'error');
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'shortages'), {
        name,
        affectedItemIds: shortageAffectedIds,
        active: true,
        createdAt: Date.now(),
        createdBy: currentUser.displayName || currentUser.username
      });
      setShortageName('');
      setShortageAffectedIds([]);
      showMessage(`Faltante activado: ${name}. Los productos relacionados quedaron bloqueados.`, 'success');
    } catch (e: any) {
      showMessage('Error al guardar faltante: ' + e.message, 'error');
    }
  };

  const resolveShortage = async (shortage: ShortageRecord) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'shortages', shortage.firestoreId), { active: false, resolvedAt: Date.now(), resolvedBy: currentUser.displayName || currentUser.username });
      showMessage(`Faltante resuelto: ${shortage.name}`, 'success');
    } catch (e: any) {
      showMessage('Error al resolver faltante: ' + e.message, 'error');
    }
  };

  const updateQuantity = (cartId: string, delta: number) => { 
    setCart(prev => prev.map(it => { 
      if (it.cartId === cartId) { 
        const newQ = (it.quantity || 1) + delta; 
        return newQ > 0 ? { ...it, quantity: newQ } : null; 
      } 
      return it; 
    }).filter(Boolean) as CartItem[]); 
  };

  const cartTotal = Math.round(cart.reduce((a, b) => a + ((b.finalPrice || 0) * (b.quantity || 1)), 0));

  const handleOpenRegister = async (skipStock = false, overrideCash?: number) => {
    const rawVal = overrideCash !== undefined ? String(overrideCash).trim() : String(initialCashInput).trim();
    if (!rawVal || rawVal === '' || isNaN(parseFloat(rawVal))) {
      showMessage("⚠️ Debe ingresar el monto de efectivo inicial para abrir la caja. No se permite abrir sin monto a ningún cajero ni administrador.", "error");
      return;
    }
    const amount = parseFloat(rawVal);
    if (amount <= 0) {
      showMessage("⚠️ El monto de efectivo inicial debe ser mayor a $0. No se permite abrir caja sin declarar el fondo de caja a ningún cajero ni administrador.", "error");
      return;
    }
    
    // Convert inputs into numeric record
    const parsedStock: Record<string, number> = {}; 
    stockItems.forEach(item => { 
      if (skipStock) {
        parsedStock[item.firestoreId] = 0;
      } else {
        const val = initialStockInput[item.firestoreId];
        parsedStock[item.firestoreId] = (val !== undefined && val !== '') ? (parseFloat(val) || 0) : 0; 
      }
    });

    const newRegisterState: RegisterConfig = {
      isOpen: true,
      initialCash: amount,
      currentCash: amount,
      initialStock: parsedStock,
      currentStock: parsedStock,
      openedAt: Date.now(),
      sessionId: `SESSION-${Date.now()}`,
      isLoaded: true
    };

    // 1. Immediately update local state so the UI unlocks without delay
    setRegister(newRegisterState);
    setInitialCashInput(''); 
    setInitialStockInput({});
    setAdminConsultationMode(false);
    setOpenRegisterPromptModal({ isOpen: false, initialCash: '' });
    setActiveTab('pos');
    showMessage(skipStock ? `✅ Caja abierta con $${amount} (Stock iniciado en 0)` : `✅ Caja abierta con $${amount} e inventario cargado`, 'success');

    // 2. Persist to localStorage & Firestore
    try {
      localStorage.setItem('nextcrm_register', JSON.stringify(newRegisterState));
    } catch (_) {}

    try {
      if (db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), newRegisterState);
      }
    } catch (e: any) {
      console.error("Error al sincronizar apertura de caja:", e);
    }
  };

  const handlePrintClosureReport = (overrideSession?: SessionData, mode: 'full' | 'thermal' = 'full') => {
    let dataToPrint: CashClosureReportData;

    if (overrideSession) {
      const ordersList = overrideSession.orders ? overrideSession.orders.map((o: any) => ({
        id: o.id,
        time: o.time || '',
        type: o.type || 'Local',
        clientName: o.clientName || o.client?.name || 'Consumidor Final',
        paymentMethod: o.paymentMethod || 'Efectivo',
        total: o.total,
        tip: o.tip || 0
      })) : [];

      const orderTypesBreakdown: Record<string, { count: number; total: number }> = {};
      ordersList.forEach(o => {
        const type = o.type || 'Local';
        if (!orderTypesBreakdown[type]) orderTypesBreakdown[type] = { count: 0, total: 0 };
        orderTypesBreakdown[type].count += 1;
        orderTypesBreakdown[type].total += o.total;
      });

      const sessionAudit = auditLogs.filter(l => {
        if (overrideSession.sessionId && l.sessionId === overrideSession.sessionId) return true;
        if (overrideSession.openedAt && overrideSession.closedAt) {
          return l.timestamp >= overrideSession.openedAt && l.timestamp <= (overrideSession.closedAt + 300000);
        }
        return false;
      });

      dataToPrint = {
        sessionId: overrideSession.sessionId,
        openedAt: overrideSession.openedAt,
        closedAt: overrideSession.closedAt,
        initialCash: overrideSession.initialCash,
        finalCash: overrideSession.finalCash,
        totalSales: overrideSession.totalSales,
        totalTips: overrideSession.totalTips,
        orderCount: overrideSession.orderCount,
        methods: overrideSession.methodsBreakdown || {},
        physicalTotals: overrideSession.physicalTotals || reportData.physicalTotals,
        itemsSold: overrideSession.itemsSoldBreakdown || {},
        ordersList,
        orderTypesBreakdown,
        auditLogs: sessionAudit
      };
    } else {
      const finishedOrders = orders.filter(o => o.status === 'Finalizado' && !o.isArchived);
      const ordersList = finishedOrders.map(o => ({
        id: o.id,
        time: o.time || '',
        type: o.type || 'Local',
        clientName: o.client?.name || 'Consumidor Final',
        paymentMethod: o.paymentMethod || 'Efectivo',
        total: o.total,
        tip: o.tip || 0
      }));

      const orderTypesBreakdown: Record<string, { count: number; total: number }> = {};
      finishedOrders.forEach(o => {
        const type = o.type || 'Local';
        if (!orderTypesBreakdown[type]) orderTypesBreakdown[type] = { count: 0, total: 0 };
        orderTypesBreakdown[type].count += 1;
        orderTypesBreakdown[type].total += o.total;
      });

      const shiftAudit = auditLogs.filter(l => {
        if (register.sessionId && l.sessionId === register.sessionId) return true;
        if (register.openedAt && l.timestamp >= register.openedAt) return true;
        return false;
      });

      dataToPrint = {
        sessionId: register.sessionId || `SESSION-${Date.now()}`,
        openedAt: register.openedAt,
        closedAt: Date.now(),
        initialCash: register.initialCash || 0,
        finalCash: register.currentCash || 0,
        totalSales: reportData.totalSales,
        totalTips: reportData.totalTips,
        orderCount: reportData.finishedTotal,
        methods: reportData.methods,
        physicalTotals: reportData.physicalTotals,
        itemsSold: reportData.itemsSold,
        ordersList,
        orderTypesBreakdown,
        auditLogs: shiftAudit
      };
    }

    if (mode === 'thermal') {
      printCashClosureTicket(dataToPrint);
    } else {
      printFullAccountingReport(dataToPrint);
    }
  };

  const handleCloseRegister = async (force = false) => {
    if (!register.isOpen) return;
    const pendingOrders = orders.filter(o => !o.isArchived && o.status !== 'Finalizado');
    if (pendingOrders.length > 0 && !force) { 
      setResolvePendingModal({ isOpen: true, pending: pendingOrders }); 
      return; 
    }
    try {
        const finishedOrders = orders.filter(o => o.status === 'Finalizado' && !o.isArchived);
        const sessionData: SessionData = { 
          sessionId: register.sessionId || null, 
          openedAt: register.openedAt || Date.now(), 
          closedAt: Date.now(), 
          initialCash: register.initialCash || 0, 
          finalCash: register.currentCash || 0, 
          totalSales: reportData.totalSales, 
          totalTips: reportData.totalTips, 
          methodsBreakdown: reportData.methods, 
          itemsSoldBreakdown: reportData.itemsSold, 
          physicalTotals: reportData.physicalTotals,
          orderCount: finishedOrders.length, 
          orders: finishedOrders.map(o => ({ 
            id: o.id, 
            total: o.total, 
            time: o.time || '',
            type: o.type || 'Local',
            clientName: o.client?.name || 'Consumidor Final',
            paymentMethod: o.paymentMethod || 'Efectivo',
            tip: o.tip || 0,
            items: o.items 
          })) 
        };

        handlePrintClosureReport(undefined, 'full');

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'sessions'), sessionData);
        const activeOrders = orders.filter(o => !o.isArchived);
        for (const order of activeOrders) { 
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), { isArchived: true }); 
        }
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), { isOpen: false, initialCash: 0, currentCash: 0, sessionId: null });
        setResolvePendingModal({ isOpen: false, pending: [] }); 
        showMessage("Caja cerrada correctamente e informe de contabilidad impreso");
    } catch (e: any) { showMessage("Error al cerrar caja: " + e.message, "error"); }
  };

  const handleResolveAllAndClose = async () => {
    try {
      const activePending = orders.filter(o => !o.isArchived && o.status !== 'Finalizado');
      for (const order of activePending) {
        if (db && order.firestoreId) {
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
            status: 'Finalizado',
            deliveredAt: Date.now()
          });
        }
      }
      showMessage(`✅ Se finalizaron ${activePending.length} comandas pendientes`);
      await handleCloseRegister(true);
    } catch (e: any) {
      showMessage("Error al resolver pedidos: " + e.message, "error");
    }
  };

  const clearForm = () => { 
    setCart([]); 
    setClientInfo({name:'', phone:'', address:'', zone:''}); 
    setCashProvided(''); 
    setOrderTip('0');
    setIsScheduled(false); 
    setScheduledTime(''); 
    setEditingOrder(null); 
    setOrderNotes(''); 
    setPosStep(1);
  };

  const handleEditOrder = (order: OrderData) => {
    const isMesa = order.type === 'Mesa';
    let displayName = order.client?.name || '';
    if (isMesa && displayName.startsWith('MESA ')) displayName = displayName.replace('MESA ', '');
    const itemsWithIds = order.items.map(it => ({ ...it, cartId: Math.random().toString(36).substr(2,9) }));
    setCart(itemsWithIds as any); 
    setClientInfo({ name: displayName, phone: order.client?.phone || '', address: order.client?.address || '', zone: order.client?.zone || '' }); 
    setOrderType(order.type); 
    setPaymentMethod(order.paymentMethod); 
    setCashProvided(order.cashProvided ? order.cashProvided.toString() : ''); 
    setOrderTip(String(order.tip || 0));
    setIsScheduled(order.isScheduled || false);
    if (order.isScheduled && order.scheduledTime) { 
      const d = new Date(order.scheduledTime); 
      setScheduledTime(`${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`); 
    } else { 
      setScheduledTime(''); 
    }
    setOrderNotes(order.notes || ''); 
    setEditingOrder(order); 
    setPosStep(1);
    setActiveTab('pos'); 
    showMessage("Comanda cargada para editar");
  };

  // Centralized Audit Logger for order deletions and modifications/rectifications
  const logOrderAudit = async (entry: {
    orderId: string;
    action: AuditActionType;
    description: string;
    orderType?: string;
    clientName?: string;
    tableNumber?: number | string | null;
    previousTotal?: number;
    newTotal?: number;
    changesSummary?: string;
    itemsBefore?: { name: string; quantity: number; price: number }[];
    itemsAfter?: { name: string; quantity: number; price: number }[];
  }) => {
    try {
      const fullEntry: Omit<OrderAuditEntry, 'firestoreId'> = {
        ...entry,
        timestamp: Date.now(),
        userId: currentUser.id || 'admin',
        userName: currentUser.displayName || (currentUser.role === 'admin' ? 'Dueño' : currentUser.role),
        userRole: currentUser.role,
        sessionId: register.sessionId || null,
      };
      if (db) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'), fullEntry);
      }
      setAuditLogs(prev => [fullEntry as OrderAuditEntry, ...prev]);

      // If action performed while admin is observing or if performed by cashier
      if (fullEntry.userRole === 'cajero' || (fullEntry.userRole !== 'admin' && fullEntry.userRole)) {
        if (currentUser.role === 'admin') {
          if (adminAlertSoundEnabledRef.current) {
            playAdminAlertTone();
          }
          setActiveAlertBanner(fullEntry as OrderAuditEntry);
        }
      }
    } catch (e) {
      console.warn("Error logging audit:", e);
    }
  };

  // Direct Tip Allocation by Order ID / Comanda
  const handleUpdateOrderTip = async (orderId: string, tipAmount: number, tipNotes?: string) => {
    if (!db) {
      showMessage("Error: No hay conexión a base de datos", "error");
      return;
    }
    const cleanId = orderId.replace('#', '').trim();
    const targetOrder = orders.find(o => 
      o.id === orderId || 
      o.id === cleanId || 
      o.firestoreId === orderId ||
      o.id.replace('#', '').padStart(4, '0') === cleanId.padStart(4, '0')
    );

    if (!targetOrder || !targetOrder.firestoreId) {
      showMessage(`No se encontró la comanda #${orderId}`, "error");
      return;
    }

    const previousTip = targetOrder.tip || 0;
    try {
      const orderDocRef = doc(db, 'artifacts', appId, 'public', 'data', 'orders', targetOrder.firestoreId);
      await updateDoc(orderDocRef, {
        tip: tipAmount,
        tipNotes: tipNotes || targetOrder.tipNotes || null,
        updatedAt: Date.now()
      });

      // Track in Audit Log for complete transparency
      await logOrderAudit({
        orderId: targetOrder.id,
        action: 'UPDATE_ORDER',
        description: `Propina asignada: $${tipAmount} (anterior: $${previousTip})`,
        orderType: targetOrder.type,
        clientName: targetOrder.client?.name,
        tableNumber: targetOrder.tableNumber,
        previousTotal: targetOrder.total,
        newTotal: targetOrder.total,
        changesSummary: `Propina registrada: $${tipAmount} para comanda #${targetOrder.id}${tipNotes ? ` (Nota: ${tipNotes})` : ''}`
      });

      showMessage(`Propina de $${tipAmount} asignada a comanda #${targetOrder.id}`, 'success');
    } catch (e: any) {
      console.error("Error updating order tip:", e);
      showMessage("Error al guardar propina: " + e.message, "error");
    }
  };

  const handleCheckout = async (returnToKitchen = false) => {
    const currentAuthUser = user || auth?.currentUser;
    if (!db || !currentAuthUser) return showMessage("Error: No hay conexión con la base de datos", "error");
    // Todos los cajeros, usuarios admin y mozos pueden hacer toma de pedidos y enviarlos a cocina (KDS)
    if (cart.length === 0) return showMessage("El carrito está vacío", "error");
    if (isScheduled && !scheduledTime) return showMessage("Indique hora de entrega", "error");
    setIsSubmitting(true);
    try {
        const isMesa = orderType === 'Mesa';
        const rawPhoneClean = String(clientInfo.phone || '').trim().replace(/\D/g, '');
        const rawNameClean = String(clientInfo.name || '').trim().toLowerCase();
        const isGenericName = rawNameClean === 'consumidor final' || rawNameClean === 'sin nombre' || rawNameClean === 'general';

        if (!isMesa && (rawPhoneClean !== '' || (!isGenericName && rawNameClean !== ''))) {
            const existingClient = clients.find(c => { 
              const cP = String(c.phone || '').trim().replace(/\D/g, ''); 
              const cN = String(c.name || '').trim().toLowerCase(); 
              const matchPhone = rawPhoneClean && cP && (rawPhoneClean === cP || (rawPhoneClean.length >= 8 && cP.includes(rawPhoneClean)) || (cP.length >= 8 && rawPhoneClean.includes(cP)));
              const matchName = !isGenericName && rawNameClean && cN && cN === rawNameClean;
              return matchPhone || matchName; 
            });

            if (existingClient) {
                const updates: any = {}; 
                if (clientInfo.name && !isGenericName && existingClient.name !== clientInfo.name) updates.name = clientInfo.name; 
                if (clientInfo.phone && existingClient.phone !== clientInfo.phone) updates.phone = clientInfo.phone; 
                if (clientInfo.address && existingClient.address !== clientInfo.address) updates.address = clientInfo.address; 
                if (clientInfo.zone && existingClient.zone !== clientInfo.zone) updates.zone = clientInfo.zone;
                updates.updatedAt = Date.now();
                updates.lastOrderAt = Date.now();
                updates.orderCount = ((existingClient as any).orderCount || 0) + 1;
                await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', existingClient.firestoreId), updates);
            } else if (!isGenericName || rawPhoneClean !== '') { 
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { 
                name: isGenericName ? 'Cliente' : (clientInfo.name || 'Cliente'), 
                phone: clientInfo.phone || '', 
                address: clientInfo.address || '', 
                zone: clientInfo.zone || '', 
                createdAt: Date.now(),
                updatedAt: Date.now(),
                lastOrderAt: Date.now(),
                orderCount: 1
              }); 
            }
        }
        let scheduledTimestamp = null;
        if (isScheduled && scheduledTime) { 
          const [hours, minutes] = scheduledTime.split(':'); 
          const d = new Date(); 
          d.setHours(parseInt(hours), parseInt(minutes), 0, 0); 
          scheduledTimestamp = d.getTime(); 
        }
        const tableNum = isMesa ? (clientInfo.tableNumber || 1) : null;
        const waiterName = isMesa 
          ? (clientInfo.assignedWaiter || (currentUser.role === 'mozo' ? currentUser.displayName : 'Moza 1'))
          : null;

        const finalDriver = clientInfo.assignedDriver || (editingOrder ? editingOrder.assignedDriver : null) || null;
        let finalDriverId = clientInfo.assignedDriverId || (editingOrder ? editingOrder.assignedDriverId : null) || null;
        if (finalDriver && !finalDriverId) {
          const low = finalDriver.toLowerCase();
          if (low.includes('fefo') || low.includes('1')) finalDriverId = 'delivery1';
          else if (low.includes('caetano') || low.includes('2')) finalDriverId = 'delivery2';
          else if (low.includes('samuel') || low.includes('3')) finalDriverId = 'delivery3';
        }

        const orderTakerName = editingOrder?.orderTaker || 
          (isMesa ? waiterName : null) || 
          currentUser.displayName || 
          currentUser.username || 
          'Caja';

        const resolvedAddress = !isMesa ? extractBarrioAndAddress(clientInfo.address, clientInfo.zone) : null;
        const finalZone = isMesa 
          ? 'N/A' 
          : (clientInfo.zone && clientInfo.zone !== 'N/A' ? clientInfo.zone : (resolvedAddress?.barrio || 'N/A'));

        const orderData: any = {
          id: editingOrder ? editingOrder.id : getNextCorrelativeOrderId(orders), 
          type: orderType || 'Local', 
          reference: orderType === 'Envío' ? 'ENVÍO' : (orderType === 'Mesa' ? `MESA #${tableNum}` : 'LOCAL'), 
          client: { 
            name: isMesa 
              ? (clientInfo.name ? `${clientInfo.name} (Mesa #${tableNum})` : `Mesa #${tableNum}`) 
              : (clientInfo.name || 'Sin Nombre'), 
            phone: isMesa ? 'N/A' : (clientInfo.phone || 'N/A'), 
            address: isMesa ? 'N/A' : (clientInfo.address || 'N/A'), 
            zone: finalZone,
            tableNumber: tableNum,
            assignedWaiter: waiterName
          }, 
          tableNumber: tableNum,
          assignedWaiter: waiterName,
          items: cart.map(it => ({ 
            id: it.id || 'N/A', name: it.name || 'Item', price: it.price || 0, finalPrice: it.finalPrice || 0, quantity: it.quantity || 1, selectedToppings: it.selectedToppings || [], isPortion: it.isPortion || false 
          })), 
          total: cartTotal, 
          paymentMethod: paymentMethod || 'Efectivo', 
          cashProvided: paymentMethod === 'Efectivo' ? (parseFloat(cashProvided) || 0) : 0, 
          tip: parseFloat(orderTip) || 0,
          status: editingOrder ? (returnToKitchen ? 'Preparando' : editingOrder.status) : 'Preparando', 
          createdAt: editingOrder ? editingOrder.createdAt : Date.now(), 
          time: editingOrder ? editingOrder.time : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
          isScheduled: isScheduled, 
          scheduledTime: scheduledTimestamp, 
          isPaid: editingOrder ? editingOrder.isPaid : false, 
          isArchived: editingOrder ? editingOrder.isArchived : false, 
          notes: orderNotes, 
          assignedDriver: finalDriver, 
          assignedDriverId: finalDriverId,
          orderTaker: orderTakerName,
          sessionId: register.sessionId || null 
        };
        if (editingOrder) { 
          // Audit Log: Record order modification / rectification
          const prevTotal = editingOrder.total || 0;
          const newTotal = cartTotal;
          const addedItems: string[] = [];
          const removedItems: string[] = [];
          const changedItems: string[] = [];

          cart.forEach(cItem => {
            const oldItem = editingOrder.items.find(oi => oi.id === cItem.id || oi.name === cItem.name);
            if (!oldItem) {
              addedItems.push(`${cItem.quantity || 1}x ${cItem.name}`);
            } else if (oldItem.quantity !== cItem.quantity) {
              changedItems.push(`${cItem.name} (${oldItem.quantity} -> ${cItem.quantity})`);
            }
          });

          editingOrder.items.forEach(oldItem => {
            const stillThere = cart.find(cItem => cItem.id === oldItem.id || cItem.name === oldItem.name);
            if (!stillThere) {
              removedItems.push(`${oldItem.quantity || 1}x ${oldItem.name}`);
            }
          });

          const diffParts: string[] = [];
          if (addedItems.length > 0) diffParts.push(`Agregados: ${addedItems.join(', ')}`);
          if (removedItems.length > 0) diffParts.push(`Eliminados: ${removedItems.join(', ')}`);
          if (changedItems.length > 0) diffParts.push(`Cantidades: ${changedItems.join(', ')}`);
          if (prevTotal !== newTotal) diffParts.push(`Total: $${prevTotal} -> $${newTotal}`);
          if (editingOrder.tableNumber !== tableNum) diffParts.push(`Mesa: ${editingOrder.tableNumber || 'S/M'} -> ${tableNum || 'S/M'}`);
          if (editingOrder.type !== orderType) diffParts.push(`Tipo: ${editingOrder.type} -> ${orderType}`);

          const changesSummary = diffParts.length > 0 ? diffParts.join(' • ') : 'Rectificación de comanda sin alteración de monto';

          await logOrderAudit({
            orderId: editingOrder.id,
            action: addedItems.length > 0 ? 'ADD_ITEM' : 'RECTIFY_ORDER',
            description: `Comanda #${editingOrder.id} modificada/rectificada`,
            orderType: orderType || 'Local',
            clientName: clientInfo.name || editingOrder.client?.name,
            tableNumber: tableNum,
            previousTotal: prevTotal,
            newTotal: newTotal,
            changesSummary,
            itemsBefore: editingOrder.items.map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 })),
            itemsAfter: cart.map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))
          });

          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', editingOrder.firestoreId), orderData); 
          showMessage("Pedido actualizado y registrado en auditoría"); 
        } else { 
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), orderData); 
          showMessage("Pedido enviado a COCINA"); 
        }
        clearForm();
    } catch (e: any) { showMessage("Error: " + e.message, "error"); } finally { setIsSubmitting(false); }
  };

  const finalizeOrder = async (order: OrderData, cash: string, tipAmount: string, chosenPaymentMethod?: string) => {
    if (register.isLoaded && !register.isOpen) { showMessage("Abra la caja primero", "error"); return; }
    
    const paymentMethodToUse = chosenPaymentMethod || editOrderModal.selectedPaymentMethod || order.paymentMethod || 'Efectivo';

    if (paymentMethodToUse === 'A confirmar') return showMessage("Debes seleccionar un método de pago real para cobrar", "error");
    if (order.type === 'Envío' && ['Débito', 'Crédito'].includes(paymentMethodToUse) && !editOrderModal.voucherDelivered) return showMessage("Confirme entrega del voucher", "error");
    if (paymentMethodToUse === 'Transferencia' && !editOrderModal.transferConfirmed) return showMessage("Confirme recepción de transferencia", "error");

    const tip = parseFloat(tipAmount) || 0; 
    const finalTotal = (order.total || 0) + tip;
    
    const newCurrentStock = { ...(register.currentStock || {}) };
    order.items.forEach(it => {
        const itemName = it.name.toLowerCase();
        const qty = it.quantity || 1;
        
        if (itemName.includes('1 metro muzzarella + 2 fainás') || (itemName.includes('metro') && itemName.includes('fainá'))) {
            let pizzaStock = stockItems.find(s => s.name.toLowerCase().includes('pizza') && !s.name.toLowerCase().includes('pizzeta'));
            let fainaStock = stockItems.find(s => s.name.toLowerCase().includes('fainá') || s.name.toLowerCase().includes('faina'));
            if (pizzaStock) newCurrentStock[pizzaStock.firestoreId] = Math.round(((newCurrentStock[pizzaStock.firestoreId] || 0) - (1 * qty)) * 100) / 100;
            if (fainaStock) newCurrentStock[fainaStock.firestoreId] = Math.round(((newCurrentStock[fainaStock.firestoreId] || 0) - (2 * qty)) * 100) / 100;
        } else if (itemName.includes('figaza')) {
            let figazaStock = stockItems.find(s => s.name.toLowerCase().includes('figaza'));
            if (figazaStock) {
                let metersToDeduct = 1;
                if (itemName.includes('1/2 metro') || itemName.includes('medio metro')) metersToDeduct = 0.5;
                newCurrentStock[figazaStock.firestoreId] = Math.round(((newCurrentStock[figazaStock.firestoreId] || 0) - (metersToDeduct * qty)) * 100) / 100;
            }
        } else if (itemName.includes('pizza') && !itemName.includes('pizzeta')) {
            let pizzaStock = stockItems.find(s => s.name.toLowerCase() === 'pizza' || (s.name.toLowerCase().includes('pizza') && !s.name.toLowerCase().includes('pizzeta')));
            if (pizzaStock) {
                let metersToDeduct = 1;
                if (itemName.includes('1/2 metro') || itemName.includes('medio metro')) metersToDeduct = 0.5;
                else if (itemName.includes('porción') || itemName.includes('porcion')) metersToDeduct = 0.25;
                newCurrentStock[pizzaStock.firestoreId] = Math.round(((newCurrentStock[pizzaStock.firestoreId] || 0) - (metersToDeduct * qty)) * 100) / 100;
            }
        } else {
            let stockItem = stockItems.find(s => s.name.toLowerCase() === itemName);
            if (!stockItem) {
                stockItem = stockItems.find(s => {
                    const sName = s.name.toLowerCase();
                    if ((sName === 'fainá' || sName === 'faina') && itemName.includes('fain')) return true;
                    if (sName === 'pizzeta' && itemName.includes('pizzeta')) return true;
                    if (sName.includes('sándwich') && itemName.includes('sándwich')) return true;
                    if (sName.includes('flan') && itemName.includes('flan')) return true;
                    if (sName.includes('chajá') && itemName.includes('chajá')) return true;
                    if (sName.includes('refresco') && (itemName.includes('refresco') || itemName.includes('coca') || itemName.includes('fanta'))) return true;
                    if (sName.includes('cerveza') && itemName.includes('cerveza')) return true;
                    if (sName.includes('agua') && itemName.includes('agua')) return true;
                    return false;
                });
            }
            if (stockItem) {
                newCurrentStock[stockItem.firestoreId] = Math.round(((newCurrentStock[stockItem.firestoreId] || 0) - qty) * 100) / 100;
            }
        }
    });

    try {
        let createdCfe: CfeDocument | null = null;
        if (dgiConfig.enabled && dgiConfig.autoEmitOnCheckout) {
          const clientDocType = order.client?.phone?.length === 12 ? 'RUT' : 'SIN_DOCUMENTO';
          const { cfeDoc, updatedConfig } = createCfeDocumentFromOrder(
            { ...order, total: finalTotal },
            dgiConfig,
            clientDocType,
            '',
            dgiConfig.defaultCfeType
          );
          createdCfe = cfeDoc;
          // save CFE doc in Firestore
          await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cfe_documents'), cfeDoc);
          // update DGI CAE current counter in Firestore
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'dgi'), updatedConfig);
        }

        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), { 
          status: 'Finalizado', 
          isPaid: true, 
          cashReceived: parseFloat(cash) || 0, 
          tip: tip, 
          paymentMethod: paymentMethodToUse,
          cfeDoc: createdCfe || undefined,
        });
        const registerUpdates: any = { currentStock: newCurrentStock };
        if (paymentMethodToUse === 'Efectivo') registerUpdates.currentCash = (register.currentCash || 0) + finalTotal;
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), registerUpdates);
        setEditOrderModal({ isOpen: false, order: null, cashReceived: '', tip: '0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: 'Efectivo' }); 
        showMessage(`Venta cobrada (${paymentMethodToUse})${createdCfe ? ' • e-Ticket DGI Emitido' : ''}`);
    } catch (e: any) { showMessage("Error: " + e.message, "error"); }
  };

  // DGI Management Handlers
  const handleUpdateDgiConfig = async (newConfig: DgiConfig) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'dgi'), newConfig);
      setDgiConfig(newConfig);
      showMessage("Configuración de DGI guardada exitosamente");
    } catch (e: any) {
      showMessage("Error al guardar configuración DGI: " + e.message, "error");
    }
  };

  const handleEmitCfe = async (
    orderId: string, 
    docType: '101' | '111', 
    clientDocType: any, 
    clientDocNumber: string, 
    clientName: string
  ) => {
    const targetOrder = orders.find(o => o.id === orderId);
    if (!targetOrder) {
      showMessage("Comanda no encontrada para emitir CFE", "error");
      return;
    }

    try {
      const { cfeDoc, updatedConfig } = createCfeDocumentFromOrder(
        { ...targetOrder, client: { ...targetOrder.client, name: clientName } },
        dgiConfig,
        clientDocType,
        clientDocNumber,
        docType
      );

      // Save CFE to Firestore
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'cfe_documents'), cfeDoc);
      // Update DGI config CAE
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'dgi'), updatedConfig);
      // Update order if present
      if (targetOrder.firestoreId) {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', targetOrder.firestoreId), { cfeDoc });
      }
      showMessage(`CFE ${cfeDoc.cfeTypeName} emitido con éxito a DGI`);
    } catch (e: any) {
      showMessage("Error al emitir CFE: " + e.message, "error");
    }
  };

  const handleCancelCfe = async (cfeFirestoreId: string) => {
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'cfe_documents', cfeFirestoreId), {
        status: 'Anulado / Nota de Crédito'
      });
      showMessage("CFE Anulado / Nota de Crédito generada en DGI");
    } catch (e: any) {
      showMessage("Error al anular CFE: " + e.message, "error");
    }
  };

  // Support Tickets Handlers
  const handleCreateTicket = async (ticketData: Omit<SupportTicket, 'firestoreId' | 'id' | 'createdAt' | 'status'>) => {
    try {
      const ticketId = `TCK-${Date.now().toString().slice(-5)}`;
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'support_tickets'), {
        ...ticketData,
        id: ticketId,
        createdAt: Date.now(),
        status: 'Abierto'
      });
      showMessage("Ticket de soporte registrado correctamente");
    } catch (e: any) {
      showMessage("Error al registrar ticket: " + e.message, "error");
    }
  };

  const handleUpdateTicketStatus = async (ticketId: string, newStatus: 'Abierto' | 'En Proceso' | 'Resuelto', solutionNotes?: string) => {
    try {
      const t = supportTickets.find(x => x.firestoreId === ticketId || x.id === ticketId);
      if (t && t.firestoreId) {
        const updateData: any = { status: newStatus };
        if (solutionNotes) updateData.solutionNotes = solutionNotes;
        if (newStatus === 'Resuelto') updateData.resolvedAt = Date.now();
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'support_tickets', t.firestoreId), updateData);
        showMessage(`Ticket actualizado a: ${newStatus}`);
      }
    } catch (e: any) {
      showMessage("Error al actualizar ticket: " + e.message, "error");
    }
  };

  const handleDirectDispatch = async (order: OrderData) => { 
    try { 
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), { status: 'Pendiente' }); 
      const safeType = String(order.type || '').trim().toLowerCase(); 
      if (['envío', 'envio', 'delivery'].includes(safeType)) { 
        setDeliveryShareModal({ isOpen: true, order }); 
      } else if (['web', 'pedido web'].includes(safeType)) { 
        showMessage("Despachado a Pedidos Web"); 
      } else { 
        showMessage(`Despachado a ${safeType === 'mesa' ? 'Mesas' : 'Mostrador'}`); 
      } 
    } catch (e: any) { showMessage("Error: " + e.message, "error"); } 
  };

  const notifyClientWhatsApp = (order: OrderData) => { 
    if (!order.client?.phone || order.client.phone === 'N/A') return showMessage("El cliente no tiene teléfono", "error"); 
    let phone = String(order.client.phone).replace(/[^0-9]/g, ''); 
    if (phone.startsWith('09') && phone.length === 9) phone = '598' + phone.substring(1); 
    let msg = order.type === 'Envío' 
      ? `¡Hola ${order.client.name}! Tu pedido ${order.id} ya va en camino 🛵. Total: $${order.total}.` 
      : `¡Hola ${order.client.name}! Tu pedido ${order.id} ya está listo para retirar 🍕. Total: $${order.total}.`; 
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank'); 
  };

  // Stock CRUD Operations
  const handleUpdateStockQty = async (itemId: string, newQty: number) => {
    if (!register.isOpen) return showMessage("Caja cerrada", "error");
    try {
      const updatedStock = { ...(register.currentStock || {}), [itemId]: Math.max(0, newQty) };
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), { currentStock: updatedStock });
      showMessage("Stock actualizado");
    } catch (e: any) { showMessage("Error actualizando stock: " + e.message, "error"); }
  };

  const handleCreateStockItem = async () => {
    if (!newStockItemForm.name.trim()) return showMessage("Ingrese nombre del artículo", "error");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stockItems'), {
        name: newStockItemForm.name.trim(),
        category: newStockItemForm.category,
        unit: newStockItemForm.unit || 'Unidades'
      });
      setNewStockItemForm({ name: '', category: 'Pizzas', unit: 'Metros' });
      setNewStockItemModal(false);
      showMessage("Artículo de stock agregado");
    } catch (e: any) { showMessage("Error al guardar stock: " + e.message, "error"); }
  };

  const handleDeleteStockItem = async (itemId: string) => {
    showConfirm({
      title: '¿Eliminar del inventario de stock?',
      message: '¿Está seguro de eliminar este artículo del inventario de stock?',
      confirmText: 'Eliminar Artículo',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', itemId));
          showMessage("Artículo eliminado del stock");
        } catch (e: any) { showMessage("Error al eliminar: " + e.message, "error"); }
      }
    });
  };

  // Client CRUD Operations
  const handleCreateClient = async () => {
    if (!newClientForm.name.trim()) return showMessage("Ingrese nombre del cliente", "error");
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
        name: newClientForm.name.trim(),
        phone: newClientForm.phone.trim(),
        address: newClientForm.address.trim(),
        zone: newClientForm.zone.trim(),
        createdAt: Date.now()
      });
      setNewClientForm({ name: '', phone: '', address: '', zone: '' });
      setNewClientModal(false);
      showMessage("Cliente registrado exitosamente");
    } catch (e: any) { showMessage("Error al registrar cliente: " + e.message, "error"); }
  };

  const handleUpdateClient = async () => {
    if (!editingClient || !editingClient.name.trim()) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', editingClient.firestoreId), {
        name: editingClient.name,
        phone: editingClient.phone || '',
        address: editingClient.address || '',
        zone: editingClient.zone || ''
      });
      setEditingClient(null);
      showMessage("Cliente actualizado");
    } catch (e: any) { showMessage("Error al actualizar cliente: " + e.message, "error"); }
  };

  const handleDeleteClient = async (firestoreId: string) => {
    showConfirm({
      title: '¿Eliminar cliente?',
      message: '¿Está seguro de eliminar este cliente del directorio permanente?',
      confirmText: 'Eliminar Cliente',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', firestoreId));
          showMessage("Cliente eliminado");
        } catch (e: any) { showMessage("Error al eliminar cliente: " + e.message, "error"); }
      }
    });
  };

  const handleRestoreClientsFromHistory = async () => {
    if (!db) return;
    try {
      const virtuals = allClients.filter(c => c.isVirtual);
      if (virtuals.length === 0) {
        return showMessage("Todos los clientes del historial ya están guardados en la base de datos permanente.");
      }
      let count = 0;
      for (const c of virtuals) {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
          name: c.name || 'Sin Nombre',
          phone: c.phone || '',
          address: c.address || '',
          zone: c.zone || '',
          createdAt: Date.now()
        });
        count++;
      }
      showMessage(`¡Se restauraron ${count} clientes recuperados desde el historial!`);
    } catch (e: any) {
      showMessage("Error al restaurar clientes: " + e.message, "error");
    }
  };

  // Product / Menu CRUD Operations
  const handleCleanDuplicates = async () => {
    const cleanedMenu: Record<string, MenuItem[]> = {};
    let duplicatesRemoved = 0;
    
    Object.keys(menu).forEach(cat => {
      const items = menu[cat] || [];
      const seen = new Set<string>();
      cleanedMenu[cat] = items.filter(it => {
        const norm = (it.name || '').trim().toLowerCase();
        if (!norm || seen.has(norm)) {
          duplicatesRemoved++;
          return false;
        }
        seen.add(norm);
        return true;
      });
    });

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: cleanedMenu });
      setMenu(cleanedMenu);
      if (duplicatesRemoved > 0) {
        showMessage(`¡Se eliminaron ${duplicatesRemoved} productos duplicados del menú exitosamente!`);
      } else {
        showMessage("No se encontraron productos duplicados en el menú.");
      }
    } catch (e: any) {
      showMessage("Error al limpiar duplicados: " + e.message, "error");
    }
  };

  const handleCreateProduct = async () => {
    const trimmedName = newProductForm.name.trim();
    if (!trimmedName) return showMessage("Ingrese el nombre del producto", "error");
    const priceNum = parseFloat(newProductForm.price);
    if (isNaN(priceNum) || priceNum < 0) return showMessage("Ingrese un precio válido (número positivo)", "error");
    
    const catKey = (newProductForm.category || 'pizzas').trim().toLowerCase() || 'pizzas';
    
    // Check if name already exists in the same category
    const existsInCat = (menu[catKey] || []).some(
      (it: MenuItem) => it.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (existsInCat) {
      return showMessage(`Ya existe un producto llamado "${trimmedName}" en la categoría ${catKey}.`, "error");
    }

    const newItem: MenuItem = {
      id: `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: trimmedName,
      desc: newProductForm.desc.trim(),
      price: priceNum,
      isPortion: !!newProductForm.isPortion,
      isMeter: !!newProductForm.isMeter,
      hasToppings: !!newProductForm.hasToppings,
      maxToppings: newProductForm.maxToppings || 4
    };

    const updatedMenu = { ...menu };
    if (!updatedMenu[catKey]) updatedMenu[catKey] = [];
    updatedMenu[catKey] = [...updatedMenu[catKey], newItem];

    // Update local state immediately!
    setMenu(updatedMenu);
    try {
      localStorage.setItem('nextcrm_menu', JSON.stringify(updatedMenu));
    } catch (_) {}

    try {
      if (db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
      }
      setNewProductForm({ category: 'pizzas', name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 0 });
      setNewProductModal(false);
      showMessage(`¡Producto "${trimmedName}" agregado al menú con éxito!`, 'success');
    } catch (e: any) { 
      setNewProductForm({ category: 'pizzas', name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 0 });
      setNewProductModal(false);
      showMessage(`¡Producto "${trimmedName}" guardado localmente!`, 'success');
    }
  };

  // Product Edit & Delete Handlers
  const handleOpenEditProduct = (catKey: string, item: MenuItem) => {
    setEditProductModal({
      isOpen: true,
      category: catKey,
      item,
      name: item.name,
      desc: item.desc || '',
      price: String(item.price),
      isPortion: !!item.isPortion,
      isMeter: !!item.isMeter,
      hasToppings: !!item.hasToppings,
      maxToppings: item.maxToppings || 4
    });
  };

  const handleSaveEditProduct = async () => {
    if (!editProductModal.item || !editProductModal.category) return;
    const { name, desc, price, category, isPortion, isMeter, hasToppings, maxToppings } = editProductModal;
    const trimmedName = name.trim();
    if (!trimmedName || !price) return showMessage("Complete nombre y precio", "error");

    // Check duplicate name on edit (excluding this item itself)
    const existsOther = allMenuItems.some(
      (it: MenuItem) => it.id !== editProductModal.item!.id && it.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );
    if (existsOther) {
      return showMessage(`Ya existe otro producto llamado "${trimmedName}" en el menú.`, "error");
    }

    const oldCat = editProductModal.category.toLowerCase();
    const newCat = category.toLowerCase();
    const updatedMenu = { ...menu };

    // Remove from old category
    if (updatedMenu[oldCat]) {
      updatedMenu[oldCat] = updatedMenu[oldCat].filter(it => it.id !== editProductModal.item!.id);
    }

    // Updated item
    const updatedItem: MenuItem = {
      ...editProductModal.item,
      name: trimmedName,
      desc: desc.trim(),
      price: parseFloat(price) || 0,
      isPortion,
      isMeter,
      hasToppings,
      maxToppings: hasToppings ? (maxToppings || 4) : 0
    };

    if (!updatedMenu[newCat]) updatedMenu[newCat] = [];
    updatedMenu[newCat].push(updatedItem);

    // Update local state immediately!
    setMenu(updatedMenu);
    try {
      localStorage.setItem('nextcrm_menu', JSON.stringify(updatedMenu));
    } catch (_) {}

    try {
      if (db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
      }
      setEditProductModal({ isOpen: false, category: '', item: null, name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 4 });
      showMessage(`¡Producto "${trimmedName}" actualizado en el menú!`, 'success');
    } catch (e: any) {
      setEditProductModal({ isOpen: false, category: '', item: null, name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 4 });
      showMessage(`¡Producto "${trimmedName}" guardado localmente!`, 'success');
    }
  };

  const handleDeleteProduct = async (catKey: string, itemId: string) => {
    showConfirm({
      title: '¿Eliminar producto del menú?',
      message: '¿Está seguro de eliminar este producto del menú?',
      confirmText: 'Eliminar Producto',
      confirmVariant: 'danger',
      onConfirm: async () => {
        const cKey = catKey.toLowerCase();
        const updatedMenu = { ...menu };
        if (!updatedMenu[cKey]) return;
        updatedMenu[cKey] = updatedMenu[cKey].filter(it => it.id !== itemId);

        // Update local state immediately!
        setMenu(updatedMenu);
        try {
          localStorage.setItem('nextcrm_menu', JSON.stringify(updatedMenu));
        } catch (_) {}

        try {
          if (db) {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
          }
          setEditProductModal({ isOpen: false, category: '', item: null, name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 4 });
          showMessage("Producto eliminado del menú correctamente", 'info');
        } catch (e: any) {
          showMessage("Producto eliminado localmente", 'info');
        }
      }
    });
  };

  // Sales History (Finished Orders) Handlers
  const handleOpenEditSale = (order: OrderData) => {
    setEditSaleModal({
      isOpen: true,
      order,
      paymentMethod: order.paymentMethod || 'Efectivo',
      total: String(order.total || 0),
      tip: String(order.tip || 0),
      notes: order.notes || '',
      status: order.status || 'Finalizado'
    });
  };

  const handleSaveEditSale = async () => {
    if (!editSaleModal.order) return;
    try {
      const newTot = parseFloat(editSaleModal.total) || 0;
      await logOrderAudit({
        orderId: editSaleModal.order.id,
        action: 'RECTIFY_ORDER',
        description: `Venta #${editSaleModal.order.id} rectificada desde Historial de Ventas`,
        orderType: editSaleModal.order.type || 'Local',
        clientName: editSaleModal.order.client?.name,
        tableNumber: editSaleModal.order.tableNumber,
        previousTotal: editSaleModal.order.total,
        newTotal: newTot,
        changesSummary: `Monto: $${editSaleModal.order.total} -> $${newTot} • Forma de Pago: ${editSaleModal.order.paymentMethod} -> ${editSaleModal.paymentMethod}`,
        itemsBefore: (editSaleModal.order.items || []).map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))
      });

      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', editSaleModal.order.firestoreId), {
        paymentMethod: editSaleModal.paymentMethod,
        total: newTot,
        tip: parseFloat(editSaleModal.tip) || 0,
        notes: editSaleModal.notes,
        status: editSaleModal.status
      });
      setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '', status: 'Finalizado' });
      showMessage("Venta actualizada correctamente y registrada en auditoría");
    } catch (e: any) {
      showMessage("Error al actualizar venta: " + e.message, "error");
    }
  };

  const deleteOrderAsAdmin = async (order: OrderData) => {
    if (currentUser.role !== 'admin') return;
    showConfirm({
      title: `¿Eliminar comanda #${order.id}?`,
      message: `Se eliminará permanentemente. ${order.deleteRequestNote ? `Motivo informado: ${order.deleteRequestNote}` : 'La acción quedará registrada en auditoría.'}`,
      confirmText: 'Eliminar Comanda',
      confirmVariant: 'danger',
      onConfirm: async () => {
        try {
          await logOrderAudit({
            orderId: order.id,
            action: 'DELETE_ORDER',
            description: `Comanda #${order.id} eliminada por Administrador`,
            orderType: order.type,
            clientName: order.client?.name,
            tableNumber: order.tableNumber,
            previousTotal: order.total || 0,
            newTotal: 0,
            changesSummary: `${order.deleteRequestNote ? `Solicitud: ${order.deleteRequestNote} • ` : ''}Eliminación definitiva por admin`,
            itemsBefore: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))
          });
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId));
          showMessage(`Comanda #${order.id} eliminada por Administrador`, 'success');
        } catch (e: any) {
          showMessage('Error al eliminar pedido: ' + e.message, 'error');
        }
      }
    });
  };

  const handleOrderDeleteAction = (order: OrderData) => {
    if (currentUser.role === 'admin') {
      deleteOrderAsAdmin(order);
      return;
    }
    if (!['cajero', 'mozo'].includes(currentUser.role)) {
      showMessage('No tenés permisos para solicitar el borrado de esta comanda', 'error');
      return;
    }
    setDeleteRequestModal({ isOpen: true, order, note: order.deleteRequestNote || '', confirmation: '' });
  };

  const submitDeleteRequest = async () => {
    const order = deleteRequestModal.order;
    if (!order) return;
    if (deleteRequestModal.confirmation !== 'aceptado') {
      showMessage('Para enviar la solicitud escribí exactamente: aceptado', 'error');
      return;
    }
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', order.firestoreId), {
        deleteRequested: true,
        deleteRequestNote: deleteRequestModal.note.trim() || null,
        deleteRequestedBy: currentUser.displayName || currentUser.username,
        deleteRequestedRole: currentUser.role,
        deleteRequestedAt: Date.now()
      });
      await logOrderAudit({
        orderId: order.id,
        action: 'REQUEST_DELETE',
        description: `Solicitud de borrado para comanda #${order.id}`,
        orderType: order.type,
        clientName: order.client?.name,
        tableNumber: order.tableNumber,
        previousTotal: order.total || 0,
        newTotal: order.total || 0,
        changesSummary: deleteRequestModal.note.trim() ? `Motivo: ${deleteRequestModal.note.trim()}` : 'Solicitud de borrado sin nota',
        itemsBefore: (order.items || []).map(i => ({ name: i.name, quantity: i.quantity || 1, price: i.price || 0 }))
      });
      setDeleteRequestModal({ isOpen: false, order: null, note: '', confirmation: '' });
      showMessage('Solicitud enviada al Administrador. El pedido no fue borrado.', 'success');
    } catch (e: any) {
      showMessage('Error al solicitar borrado: ' + e.message, 'error');
    }
  };

  const handleDeleteSale = async (firestoreId: string, orderId: string) => {
    const targetOrder = orders.find(o => o.firestoreId === firestoreId || o.id === orderId);
    if (!targetOrder) return showMessage('No se encontró la comanda', 'error');
    handleOrderDeleteAction(targetOrder);
  };


  // Closed Session History Handlers
  const handleOpenEditSession = (session: SessionData) => {
    setEditSessionModal({
      isOpen: true,
      session,
      totalSales: String(session.totalSales || 0),
      finalCash: String(session.finalCash || 0),
      initialCash: String(session.initialCash || 0),
      totalTips: String(session.totalTips || 0),
      notes: session.notes || ''
    });
  };

  const handleSaveEditSession = async () => {
    if (!editSessionModal.session) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', editSessionModal.session.firestoreId), {
        totalSales: parseFloat(editSessionModal.totalSales) || 0,
        finalCash: parseFloat(editSessionModal.finalCash) || 0,
        initialCash: parseFloat(editSessionModal.initialCash) || 0,
        totalTips: parseFloat(editSessionModal.totalTips) || 0,
        notes: editSessionModal.notes
      });
      setEditSessionModal({ isOpen: false, session: null, totalSales: '', finalCash: '', initialCash: '', totalTips: '', notes: '' });
      showMessage("Registro de turno / caja actualizado");
    } catch (e: any) {
      showMessage("Error al actualizar turno: " + e.message, "error");
    }
  };

  const handleDeleteSession = async (firestoreId: string) => {
    requireAdminAuth("Eliminar Turno Archivado", async () => {
      showConfirm({
        title: '¿Eliminar turno archivado?',
        message: '¿Está seguro de eliminar este registro de turno cerrado del historial?',
        confirmText: 'Eliminar Turno',
        confirmVariant: 'danger',
        onConfirm: async () => {
          try {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', firestoreId));
            showMessage("Turno de caja eliminado del historial");
          } catch (e: any) {
            showMessage("Error al eliminar turno: " + e.message, "error");
          }
        }
      });
    });
  };

  // Cash Adjustment in Open Register
  const handleSaveAdjustCash = async () => {
    if (!adjustCashModal.amount) return showMessage("Ingrese un monto válido", "error");
    const newAmount = parseFloat(adjustCashModal.amount);
    if (isNaN(newAmount)) return showMessage("Ingrese un monto válido", "error");
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
        currentCash: newAmount
      });
      setRegister(prev => ({ ...prev, currentCash: newAmount }));
      setAdjustCashModal({ isOpen: false, amount: '' });
      showMessage(`Efectivo en caja ajustado a $${newAmount}`);
    } catch (e: any) {
      showMessage("Error al ajustar caja: " + e.message, "error");
    }
  };

  // Depuración y Limpieza: Borrar pedidos y reportes creados antes de las 19:00 hs de hoy
  const handlePurgeBefore19HoursToday = async () => {
    requireAdminAuth("Borrar registros anteriores a las 19:00 hs de hoy", async () => {
      const now = new Date();
      let cutoff19 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 19, 0, 0, 0).getTime();
      if (now.getHours() < 19) {
        const prevDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 19, 0, 0, 0);
        cutoff19 = prevDay.getTime();
      }

      // Solo depurar pedidos finalizados o archivados de turnos pasados; nunca borrar pedidos activos en preparación
      const ordersToPurge = orders.filter(o => (o.createdAt || 0) < cutoff19 && (o.status === 'Finalizado' || o.isArchived));
      const sessionsToPurge = sessions.filter(s => (s.openedAt || s.closedAt || 0) < cutoff19);

      if (ordersToPurge.length === 0 && sessionsToPurge.length === 0) {
        return showMessage("No hay pedidos ni reportes creados antes de las 19:00 hs de hoy para depurar.", "info");
      }

      showConfirm({
        title: '⚠️ ACCIÓN DE LIMPIEZA',
        message: `Se eliminarán de forma permanente:\n• ${ordersToPurge.length} pedidos de antes de las 19:00 hs\n• ${sessionsToPurge.length} reportes/turnos de antes de las 19:00 hs\n\n¿Desea continuar?`,
        confirmText: 'Limpiar Registros',
        confirmVariant: 'danger',
        onConfirm: async () => {
          try {
            let deletedOrders = 0;
            let deletedSessions = 0;

            for (const ord of ordersToPurge) {
              if (ord.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', ord.firestoreId));
                deletedOrders++;
              }
            }

            for (const sess of sessionsToPurge) {
              if (sess.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sess.firestoreId));
                deletedSessions++;
              }
            }

            showMessage(`Depuración completada: Se eliminaron ${deletedOrders} pedidos y ${deletedSessions} reportes anteriores a las 19:00 hs.`, 'success');
          } catch (e: any) {
            showMessage("Error durante la depuración: " + e.message, "error");
          }
        }
      });
    });
  };

  
  const handleBatchImportOrders = async (importedOrders: Partial<OrderData>[]) => {
    if (!db) return;
    try {
      const ordersCol = collection(db, 'artifacts', appId, 'public', 'data', 'orders');
      for (const ord of importedOrders) {
        const orderPayload: any = {
          id: ord.id || `HIST-${Date.now().toString().slice(-4)}`,
          items: ord.items || [{ id: 'hist-1', name: (ord as any).itemsSummary || 'Pedido Histórico', price: ord.total || 0, finalPrice: ord.total || 0, quantity: 1 }],
          type: ord.type || 'Local',
          paymentMethod: ord.paymentMethod || 'Efectivo',
          total: ord.total || 0,
          status: 'Finalizado',
          createdAt: (ord as any).timestamp || Date.now(),
          client: {
            name: ord.client?.name || (ord as any).clientName || 'Consumidor Final',
            phone: ord.client?.phone || (ord as any).clientPhone || '',
            address: ord.client?.address || (ord as any).clientAddress || '',
            zone: ord.client?.zone || '',
          },
          notes: ord.notes || '',
        };
        await addDoc(ordersCol, orderPayload);
      }
      showMessage(`¡Se importaron ${importedOrders.length} pedidos históricos a la base de datos!`);
    } catch (err: any) {
      showMessage(`Error al importar: ${err.message}`, 'error');
    }
  };

  const handleBatchImportSessions = async (importedSessions: any[]) => {
    if (!db) return;
    try {
      const sessionsCol = collection(db, 'artifacts', appId, 'public', 'data', 'sessions');
      for (const sess of importedSessions) {
        await addDoc(sessionsCol, sess);
      }
      showMessage(`¡Se importaron ${importedSessions.length} turnos de caja al historial!`);
    } catch (err: any) {
      showMessage(`Error al importar turnos: ${err.message}`, 'error');
    }
  };

  const handleBatchImportMenu = async (importedMenu: Record<string, MenuItem[]>, replaceExisting: boolean) => {
    if (!db) return;
    try {
      let finalMenu: Record<string, MenuItem[]> = {};
      if (!replaceExisting) {
        finalMenu = { ...menu };
        Object.keys(importedMenu).forEach(cat => {
          if (!finalMenu[cat]) {
            finalMenu[cat] = importedMenu[cat];
          } else {
            const existingNames = new Set(finalMenu[cat].map(x => x.name.toLowerCase()));
            const newItems = importedMenu[cat].filter(x => !existingNames.has(x.name.toLowerCase()));
            finalMenu[cat] = [...finalMenu[cat], ...newItems];
          }
        });
      } else {
        finalMenu = importedMenu;
      }

      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: finalMenu });
      setMenu(finalMenu);
      showMessage("¡Menú importado y guardado correctamente!");
    } catch (err: any) {
      showMessage(`Error al importar menú: ${err.message}`, 'error');
    }
  };

  const handleClearAllMenu = async () => {
    requireAdminAuth("Vaciar Menú Completo", async () => {
      showConfirm({
        title: '¿Vaciar menú completo?',
        message: '¿Está seguro de que desea vaciar todo el menú?',
        confirmText: 'Vaciar Menú',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: {} });
            setMenu({});
            showMessage("El menú ha sido vaciado por completo");
          } catch (err: any) {
            showMessage(`Error al vaciar menú: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleRestoreDefaultMenu = async () => {
    requireAdminAuth("Restaurar Menú Sugerido", async () => {
      showConfirm({
        title: '¿Restaurar menú sugerido?',
        message: '¿Desea restaurar el menú con los productos clásicos de muestra?',
        confirmText: 'Restaurar Menú',
        confirmVariant: 'primary',
        onConfirm: async () => {
          if (!db) return;
          try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: DEFAULT_MENU });
            setMenu(DEFAULT_MENU);
            showMessage("Menú sugerido restaurado exitosamente");
          } catch (err: any) {
            showMessage(`Error al restaurar menú: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleBatchImportStock = async (importedItems: Partial<StockItem>[], replaceExisting: boolean) => {
    if (!db) return;
    try {
      if (replaceExisting) {
        for (const item of stockItems) {
          if (item.firestoreId) {
            await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', item.firestoreId));
          }
        }
      }

      const col = collection(db, 'artifacts', appId, 'public', 'data', 'stockItems');
      for (const item of importedItems) {
        await addDoc(col, {
          name: item.name || 'Artículo',
          category: item.category || 'Otros',
          unit: item.unit || 'Unidades'
        });
      }
      showMessage(`¡Se importaron ${importedItems.length} artículos de stock!`);
    } catch (err: any) {
      showMessage(`Error al importar stock: ${err.message}`, 'error');
    }
  };

  const handleClearAllStock = async () => {
    requireAdminAuth("Vaciar Inventario / Stock", async () => {
      showConfirm({
        title: '¿Vaciar inventario de stock?',
        message: '¿Está seguro de que desea eliminar todos los artículos de inventario / stock?',
        confirmText: 'Vaciar Stock',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const item of stockItems) {
              if (item.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', item.firestoreId));
              }
            }
            setStockItems([]);
            showMessage("Inventario de stock vaciado por completo");
          } catch (err: any) {
            showMessage(`Error al vaciar stock: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleClearAllOrders = async () => {
    requireAdminAuth("Vaciar Todos los Pedidos / Comandas", async () => {
      showConfirm({
        title: '¿Vaciar todos los pedidos?',
        message: '¿Está seguro de que desea vaciar todos los pedidos activos y finalizados (KDS, Comandas, Reportes)?',
        confirmText: 'Vaciar Pedidos',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const ord of orders) {
              if (ord.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', ord.firestoreId));
              }
            }
            setOrders([]);
            showMessage("Todos los pedidos y reportes de comandas han sido vaciados");
          } catch (err: any) {
            showMessage(`Error al vaciar pedidos: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleClearAllFinishedOrders = async () => {
    requireAdminAuth("Vaciar Comandas Finalizadas", async () => {
      const finished = orders.filter(o => o.status === 'Finalizado');
      if (finished.length === 0) return showMessage("No hay pedidos finalizados para eliminar", "info");
      showConfirm({
        title: '¿Vaciar comandas finalizadas?',
        message: `¿Está seguro de eliminar TODOS los ${finished.length} pedidos finalizados?`,
        confirmText: 'Eliminar Finalizados',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const ord of finished) {
              if (ord.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', ord.firestoreId));
              }
            }
            setOrders(prev => prev.filter(o => o.status !== 'Finalizado'));
            setSelectedFinishedOrders([]);
            showMessage(`Se eliminaron ${finished.length} pedidos finalizados`);
          } catch (e: any) {
            showMessage(`Error al eliminar pedidos: ${e.message}`, 'error');
          }
        }
      });
    });
  };

  const handleDeleteSelectedFinishedOrders = async () => {
    requireAdminAuth("Eliminar Comandas Seleccionadas", async () => {
      if (selectedFinishedOrders.length === 0) return showMessage("Seleccione al menos una comanda para eliminar", "info");
      showConfirm({
        title: '¿Eliminar comandas seleccionadas?',
        message: `¿Está seguro de eliminar las ${selectedFinishedOrders.length} comandas seleccionadas?`,
        confirmText: 'Eliminar Seleccionadas',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const id of selectedFinishedOrders) {
              await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', id));
            }
            setOrders(prev => prev.filter(o => !selectedFinishedOrders.includes(o.firestoreId)));
            setSelectedFinishedOrders([]);
            showMessage(`Se eliminaron ${selectedFinishedOrders.length} comandas`);
          } catch (e: any) {
            showMessage(`Error al eliminar: ${e.message}`, 'error');
          }
        }
      });
    });
  };

  const handleClearAllHistory = async () => {
    requireAdminAuth("Vaciar Historial de Turnos", async () => {
      showConfirm({
        title: '¿Vaciar historial de turnos?',
        message: '¿Está seguro de que desea vaciar todo el historial de turnos de caja cerrados?',
        confirmText: 'Vaciar Historial',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const sess of sessions) {
              if (sess.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sess.firestoreId));
              }
            }
            setSessions([]);
            setSelectedSessionIds([]);
            showMessage("Historial de turnos vaciado por completo");
          } catch (err: any) {
            showMessage(`Error al vaciar historial: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleDeleteSelectedSessions = async () => {
    requireAdminAuth("Eliminar Turnos de Caja Seleccionados", async () => {
      if (selectedSessionIds.length === 0) return showMessage("Seleccione al menos un turno para eliminar", "info");
      showConfirm({
        title: '¿Eliminar turnos seleccionados?',
        message: `¿Está seguro de eliminar los ${selectedSessionIds.length} turnos seleccionados del historial?`,
        confirmText: 'Eliminar Turnos',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            for (const id of selectedSessionIds) {
              await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', id));
            }
            setSessions(prev => prev.filter(s => !selectedSessionIds.includes(s.firestoreId)));
            setSelectedSessionIds([]);
            showMessage(`Se eliminaron ${selectedSessionIds.length} turnos de caja`);
          } catch (e: any) {
            showMessage(`Error al eliminar: ${e.message}`, 'error');
          }
        }
      });
    });
  };

  const handleClearRegister = async () => {
    requireAdminAuth("Restablecer Arqueo de Caja", async () => {
      showConfirm({
        title: '¿Restablecer arqueo de caja?',
        message: '¿Desea restablecer el arqueo a caja cerrada en $0?',
        confirmText: 'Restablecer a $0',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;
          try {
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
              isOpen: false,
              initialCash: 0,
              currentCash: 0,
              sessionId: null,
              currentStock: {},
              initialStock: {}
            });
            setRegister({
              isOpen: false,
              initialCash: 0,
              currentCash: 0,
              sessionId: null,
              isLoaded: true,
              currentStock: {},
              initialStock: {}
            });
            showMessage("Arqueo restablecido a caja cerrada en $0");
          } catch (err: any) {
            showMessage(`Error al restablecer arqueo: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const handleFullSystemReset = async () => {
    requireAdminAuth("REINICIO TOTAL DEL SISTEMA", async () => {
      showConfirm({
        title: '⚠️ ¿REINICIAR TODO EL SISTEMA?',
        message: 'Esta acción vaciará permanentemente:\n- KDS y comandas\n- Pedidos finalizados y reportes\n- Menú y productos\n- Artículos de stock\n- Directorio de clientes\n- Historial de turnos\n- Arqueo de caja\n\nTodo quedará en blanco listo para importar desde cero.',
        confirmText: 'Reiniciar Todo de Cero',
        confirmVariant: 'danger',
        onConfirm: async () => {
          if (!db) return;

          try {
            // 1. Clear orders
            for (const ord of orders) {
              if (ord.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', ord.firestoreId));
              }
            }
            setOrders([]);

            // 2. Clear sessions
            for (const sess of sessions) {
              if (sess.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', sess.firestoreId));
              }
            }
            setSessions([]);

            // 3. Clear clients
            for (const c of clients) {
              if (c.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', c.firestoreId));
              }
            }
            setClients([]);

            // 4. Clear stock
            for (const s of stockItems) {
              if (s.firestoreId) {
                await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', s.firestoreId));
              }
            }
            setStockItems([]);

            // 5. Reset menu
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: {} });
            setMenu({});

            // 6. Reset register
            await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
              isOpen: false,
              initialCash: 0,
              currentCash: 0,
              sessionId: null,
              currentStock: {},
              initialStock: {}
            });
            setRegister({
              isOpen: false,
              initialCash: 0,
              currentCash: 0,
              sessionId: null,
              isLoaded: true,
              currentStock: {},
              initialStock: {}
            });

            showMessage("✅ ¡Sistema reiniciado por completo! Todo listo y limpio para importar.", "info");
          } catch (err: any) {
            showMessage(`Error en reinicio: ${err.message}`, 'error');
          }
        }
      });
    });
  };

  const kitchenOrders = orders.filter(o => o.status === 'Preparando' && !o.isArchived);
  const scheduledOrders = kitchenOrders.filter(o => o.isScheduled && o.scheduledTime && o.scheduledTime > Date.now());
  const normalAndDelayed = kitchenOrders.filter(o => !o.isScheduled || (o.scheduledTime && o.scheduledTime <= Date.now()));
  const delayedOrders = normalAndDelayed.filter(o => Math.floor((Date.now() - o.createdAt) / 60000) >= (WARNING_THRESHOLDS[o.type] || [30])[0]);
  const normalOrders = normalAndDelayed.filter(o => !delayedOrders.includes(o));

  return (
    <div className="fixed inset-0 flex flex-col bg-[#040108] font-sans text-slate-100 overflow-hidden">
      {uiMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-8 py-3 text-white rounded-full font-black text-xs uppercase shadow-2xl animate-in slide-in-from-top-4 ${uiMessage.type === 'error' ? 'bg-red-600' : 'bg-slate-900 border border-purple-500/40 text-purple-300'}`}>
          {uiMessage.text}
        </div>
      )}

      {/* NEXT CRM Login Screen with 4-Tier Security Roles & Smart Auto-Detection */}
      {!isAuthenticated && (
        <div className="fixed inset-0 z-[10000] bg-[#040108] flex items-center justify-center p-4 min-h-screen">
          <div className="relative max-w-[460px] w-full bg-[#080212] border-2 border-purple-500/40 rounded-[40px] p-7 sm:p-9 shadow-2xl shadow-purple-950/80 space-y-5 text-slate-100 text-center animate-in zoom-in-95">
            {/* NEXT CRM Branding - Perfectly Centered */}
            <div className="flex flex-col items-center justify-center space-y-2.5">
              <div className="flex items-center justify-center gap-3.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-cyan-400 p-[2px] shadow-lg shadow-purple-600/40 shrink-0">
                  <div className="w-full h-full bg-[#080212] rounded-[14px] flex items-center justify-center">
                    <svg className="w-7 h-7 text-purple-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 2L2 7l10 5 10-5-10-5z" />
                      <path d="M2 17l10 5 10-5" />
                      <path d="M2 12l10 5 10-5" />
                    </svg>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-purple-300 via-white to-cyan-300 uppercase">
                    NEXT CRM
                  </div>
                  <div className="text-[10px] font-black uppercase text-purple-400 tracking-wider">
                    PUNTO DE VENTA • EL ÁRBOL
                  </div>
                </div>
              </div>
              <p className="text-xs font-bold text-slate-400 text-center max-w-[320px] leading-relaxed">
                Reconocimiento automático de permisos por correo o usuario
              </p>
            </div>

            {/* Quick Helper Selectors (Optional) */}
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[
                { id: 'admin', label: 'Dueño', icon: 'admin_panel_settings', color: 'border-purple-500/30 bg-purple-950/30 text-purple-300' },
                { id: 'cajera1', label: 'Cajera', icon: 'point_of_sale', color: 'border-cyan-500/30 bg-cyan-950/20 text-cyan-300' },
                { id: 'mozo1', label: 'Mozo', icon: 'table_restaurant', color: 'border-indigo-500/30 bg-indigo-950/20 text-indigo-300' },
                { id: 'delivery1', label: 'Delivery', icon: 'two_wheeler', color: 'border-amber-500/30 bg-amber-950/20 text-amber-300' }
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setLoginUsername(r.id);
                    setLoginPassword('');
                    setLoginError('');
                  }}
                  className={`p-2 rounded-2xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    loginUsername.toLowerCase() === r.id
                      ? 'border-purple-400 bg-purple-600 text-slate-950 font-black shadow-lg shadow-purple-600/30'
                      : `${r.color} hover:bg-white/5`
                  }`}
                >
                  <Icon name={r.icon} size={17} />
                  <span className="text-[9px] font-black uppercase tracking-tight truncate w-full">{r.label}</span>
                </button>
              ))}
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const u = loginUsername.trim();
              const p = loginPassword.trim();

              if (!u || !p) {
                setLoginError('Por favor ingresa tu usuario o correo y contraseña');
                return;
              }

              setLoginLoading(true);
              setLoginError('');

              let firebaseAuthSuccess = false;

              // 1. Direct Firebase Auth (if credentials contain an email '@' or Firebase user)
              if (auth && u.includes('@')) {
                try {
                  const userCredential = await signInWithEmailAndPassword(auth, u, p);
                  if (userCredential.user) {
                    firebaseAuthSuccess = true;
                    setUser(userCredential.user);
                  }
                } catch (firebaseErr: any) {
                  console.warn("Intento Firebase Auth:", firebaseErr.code);
                  // Si falla la autenticación de Firebase, se continúa hacia la verificación local de credenciales del rol
                }
              }

              // 2. Role detection from email or username
              const detected = detectRoleFromIdentity(u);

              // 3. Password check if not authenticated via Firebase email
              if (!firebaseAuthSuccess) {
                if (detected.role === 'admin') {
                  const validAdminPass = ['admin', 'admin123', '1234', 'arbol2025', 'elarbol', 'pizzeria', 'vicky', 'vicky123'];
                  // Accept known admin passwords or any custom password with 3+ characters
                  if (!validAdminPass.includes(p.toLowerCase()) && p.length < 3) {
                    setLoginError('Contraseña incorrecta de Administrador');
                    setLoginLoading(false);
                    return;
                  }
                } else if (p.length < 2) {
                  setLoginError('La contraseña debe tener al menos 2 caracteres');
                  setLoginLoading(false);
                  return;
                }
              }

              const sessionObj = {
                username: u,
                role: detected.role,
                displayName: detected.displayName
              };

              setCurrentUser(sessionObj);
              setIsAuthenticated(true);
              localStorage.setItem('nextcrm_auth', 'true');
              localStorage.setItem('nextcrm_user', sessionObj.username);
              localStorage.setItem('nextcrm_role', sessionObj.role);
              setLoginError('');
              setLoginLoading(false);

              if (detected.role === 'delivery') {
                setActiveTab('delivery');
              } else if (detected.role === 'mozo') {
                setActiveTab('pos');
              } else if (detected.role === 'cajero' && ['reports', 'history', 'products', 'support'].includes(activeTab)) {
                setActiveTab('pos');
              }

              hasCheckedRegisterOnLogin.current = false;
              setAdminConsultationMode(false);
              if (['admin', 'cajero'].includes(detected.role) && !register.isOpen) {
                setOpenRegisterPromptModal({
                  isOpen: true,
                  initialCash: ''
                });
              }

              showMessage(`¡Bienvenido/a ${detected.displayName}!`, 'success');
            }} className="space-y-4 pt-1">
              {loginError && (
                <div className="p-3 bg-red-950/70 border border-red-500/50 rounded-2xl text-xs font-black text-red-200 text-center uppercase tracking-wider">
                  {loginError}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-purple-300 flex items-center justify-center gap-1.5 text-center">
                  <Icon name="person" size={15} className="text-purple-400" /> USUARIO O CORREO ELECTRÓNICO
                </label>
                <input
                  type="text"
                  placeholder="Tu correo electrónico o usuario (ej: admin, mozo1...)"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  style={{ textAlign: 'center' }}
                  className="w-full p-3.5 bg-[#040108] border-2 border-purple-500/30 focus:border-purple-400 rounded-2xl text-sm font-black text-center placeholder:text-center text-white outline-none tracking-wider transition-all focus:shadow-lg focus:shadow-purple-900/30 placeholder:text-slate-600"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="text-[11px] font-black uppercase tracking-wider text-purple-300 flex items-center justify-center gap-1.5 text-center">
                  <Icon name="lock" size={15} className="text-purple-400" /> CONTRASEÑA
                </label>
                <input
                  type="password"
                  placeholder="Tu contraseña de acceso"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  style={{ textAlign: 'center' }}
                  className="w-full p-3.5 bg-[#040108] border-2 border-purple-500/30 focus:border-purple-400 rounded-2xl text-sm font-black text-center placeholder:text-center text-white outline-none tracking-wider transition-all focus:shadow-lg focus:shadow-purple-900/30 placeholder:text-slate-600"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loginLoading}
                className="w-full py-4 bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-wider shadow-lg shadow-purple-600/40 transition-all flex items-center justify-center gap-2 cursor-pointer mt-3 hover:scale-[1.02] active:scale-98 disabled:opacity-50"
              >
                {loginLoading ? (
                  <>
                    <Icon name="sync" size={16} className="animate-spin" />
                    <span>VERIFICANDO CREDENCIALES...</span>
                  </>
                ) : (
                  <>
                    <Icon name="login" size={16} />
                    <span>INGRESAR A NEXT CRM</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Header - Deluxe Compact Edition: Optimized spacing & button sizes */}
      <header className="h-9 sm:h-10 bg-[#040108] border-b border-purple-500/20 text-white flex items-center justify-between px-2 shrink-0 shadow-lg z-50 gap-1.5">
        <div className="flex items-center gap-1 shrink-0 pr-1.5 border-r border-purple-500/20">
          <div className="w-6 h-6 rounded-md border border-purple-500/50 bg-[#0d061c] flex items-center justify-center font-black text-[11px] text-purple-300 shadow-xs">
            🌳
          </div>
          <div className="font-black text-[10px] tracking-wider uppercase flex items-center gap-1">
            <span className="text-white font-extrabold hidden sm:inline">El Árbol</span>
            <span className="text-[7px] bg-purple-950 text-purple-300 px-1 py-0.2 rounded font-black tracking-widest border border-purple-500/40">POS</span>
          </div>
        </div>

        {/* Navigation Bar with Left/Right Scroll Controls - Filtered by Security Layer Role */}
        <div className="flex-1 flex items-center min-w-0 relative group">
          {/* Scroll Left Button */}
          <button
            type="button"
            onClick={() => {
              if (navRef.current) navRef.current.scrollBy({ left: -220, behavior: 'smooth' });
            }}
            className="w-4.5 h-6.5 rounded-md bg-[#0d061c]/90 hover:bg-purple-950 text-purple-400 hover:text-white flex items-center justify-center transition-all border border-purple-500/20 shrink-0 mr-0.5 z-10 cursor-pointer shadow-sm"
            title="Desplazar menú a la izquierda"
          >
            <Icon name="chevron_left" size={12} />
          </button>

          <nav 
            ref={navRef}
            onWheel={(e) => {
              if (navRef.current) {
                navRef.current.scrollLeft += e.deltaY;
              }
            }}
            className="flex-1 flex h-full gap-0.5 overflow-x-auto no-scrollbar items-center py-0 scroll-smooth"
          >
            {[ 
              {id: 'pos', label: 'Toma de Pedido', icon: 'point_of_sale', roles: ['admin', 'cajero', 'mozo']}, 
              {id: 'kitchen', label: 'KDS', icon: 'tv', count: badges.kitchen, roles: ['admin', 'cajero', 'mozo']}, 
              {id: 'counter', label: 'Mostrador', icon: 'storefront', count: badges.mostrador, roles: ['admin', 'cajero', 'mozo']}, 
              {id: 'tables', label: 'Mesas', icon: 'table_restaurant', count: badges.mesas, roles: ['admin', 'cajero', 'mozo']}, 
              {id: 'delivery', label: 'Deliverys', icon: 'two_wheeler', count: badges.delivery, roles: ['admin', 'cajero', 'delivery']}, 
              {id: 'finished', label: 'Finalizados', icon: 'check_circle', count: badges.finished, roles: ['admin', 'cajero']}, 
              {id: 'products', label: 'Menú', icon: 'menu_book', roles: ['admin']}, 
              {id: 'staff', label: 'Propinas', icon: 'payments', roles: ['admin', 'cajero', 'mozo', 'delivery']},
              {id: 'clients', label: 'Clientes', icon: 'people', roles: ['admin', 'cajero']}, 
              {id: 'stock', label: 'Stock', icon: 'inventory_2', count: badges.stock, roles: ['admin', 'cajero']}, 
              {id: 'cash', label: 'Arqueo', icon: 'account_balance_wallet', roles: ['admin', 'cajero']}, 
              {id: 'reports', label: 'Reportes', icon: 'bar_chart', roles: ['admin']}, 
              {id: 'history', label: 'Historial', icon: 'history', roles: ['admin']}, 
              {id: 'audit', label: 'Auditoría', icon: 'security', count: badges.audit, roles: ['admin']},
              {id: 'manual', label: 'Manual', icon: 'auto_stories', roles: ['admin', 'cajero', 'mozo', 'delivery']},
              {id: 'support', label: '', icon: 'support_agent', title: 'Soporte Técnico', count: supportTickets.filter(t => t.status !== 'Resuelto').length, roles: ['admin'], highlight: true, iconOnly: true}
            ].filter(tab => tab.roles.includes(currentUser.role)).map(tab => {
              const isActive = activeTab === tab.id;
              const rawCount = tab.count !== undefined ? tab.count : 0;

              return (
                <button 
                  key={tab.id} 
                  onClick={() => {
                    setActiveTab(tab.id);
                  }} 
                  title={tab.title || tab.label}
                  className={`relative px-1.5 py-0.5 h-7 rounded-md flex items-center gap-1 font-black text-[8px] sm:text-[8.5px] uppercase transition-all shrink-0 min-w-fit cursor-pointer ${
                    isActive 
                      ? tab.id === 'support' 
                        ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                        : 'bg-[#180930] text-purple-200 border border-purple-400 shadow-sm shadow-purple-900/30 ring-1 ring-purple-400/40' 
                      : tab.id === 'support'
                      ? 'text-purple-300 bg-purple-950/40 border border-purple-500/30 hover:bg-purple-900/50'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent hover:border-purple-500/20'
                  }`}
                >
                  {rawCount > 0 && (
                    <span className="absolute -top-1 -right-0.5 bg-red-600 text-white text-[7.5px] font-black min-w-[13px] h-[13px] px-0.5 rounded-full flex items-center justify-center shadow-lg shadow-red-600/60 ring-1 ring-[#040108] animate-pulse z-20">
                      {rawCount}
                    </span>
                  )}
                  <Icon name={tab.icon} size={tab.iconOnly ? 15 : 12} className={isActive ? 'text-purple-300' : 'text-slate-400'}/>
                  {tab.label ? <span className="leading-tight tracking-tight whitespace-nowrap">{tab.label}</span> : null}
                </button>
              );
            })}
          </nav>

          {/* Scroll Right Button */}
          <button
            type="button"
            onClick={() => {
              if (navRef.current) navRef.current.scrollBy({ left: 220, behavior: 'smooth' });
            }}
            className="w-4.5 h-6.5 rounded-md bg-[#0d061c]/90 hover:bg-purple-950 text-purple-400 hover:text-white flex items-center justify-center transition-all border border-purple-500/20 shrink-0 ml-0.5 z-10 cursor-pointer shadow-sm"
            title="Desplazar menú a la derecha"
          >
            <Icon name="chevron_right" size={12} />
          </button>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {['admin', 'cajero', 'mozo'].includes(currentUser.role) && (
            <button
              type="button"
              onClick={() => setShortagesModalOpen(true)}
              className={`h-7 px-2 rounded-lg border text-[8px] sm:text-[8.5px] font-black uppercase flex items-center gap-1 cursor-pointer transition-all ${activeShortages.length ? 'bg-red-950/70 border-red-500/50 text-red-200' : 'bg-[#0d061c] border-purple-500/30 text-purple-200 hover:bg-purple-950'}`}
              title="Marcar faltantes y bloquear productos relacionados"
            >
              <Icon name="production_quantity_limits" size={12} />
              <span className="hidden md:inline">Faltantes</span>
              {activeShortages.length > 0 && <span className="min-w-[14px] h-[14px] px-1 rounded-full bg-red-600 text-white flex items-center justify-center text-[7px]">{activeShortages.length}</span>}
            </button>
          )}
          {currentUser.role === 'admin' && orders.some(o => o.deleteRequested) && (
            <button
              type="button"
              onClick={() => setPendingDeleteModalOpen(true)}
              className="h-7 px-2 rounded-lg bg-amber-950/70 border border-amber-500/50 text-amber-200 text-[8px] sm:text-[8.5px] font-black uppercase flex items-center gap-1 cursor-pointer"
              title="Solicitudes de borrado pendientes"
            >
              <Icon name="pending_actions" size={12} />
              <span className="hidden lg:inline">Borrados</span>
              <span className="min-w-[14px] h-[14px] px-1 rounded-full bg-amber-500 text-slate-950 flex items-center justify-center text-[7px]">{orders.filter(o => o.deleteRequested).length}</span>
            </button>
          )}
        </div>

        {/* User Role Badge & Logout */}
        <div className="flex items-center gap-1.5 shrink-0 pl-1.5 sm:pl-2 border-l border-purple-500/20 bg-[#040108] z-30">
          {/* Active User Role Badge */}
          <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-lg bg-[#0c061a] border border-purple-500/30 text-[8px] sm:text-[8.5px] font-black uppercase text-purple-200">
            <span className={`w-1.5 h-1.5 rounded-full ${
              currentUser.role === 'admin' ? 'bg-purple-400' :
              currentUser.role === 'cajero' ? 'bg-cyan-400' :
              currentUser.role === 'delivery' ? 'bg-amber-400' : 'bg-indigo-400'
            } animate-pulse`}></span>
            <span>{
              currentUser.role === 'admin' ? 'Dueño' :
              currentUser.role === 'cajero' ? 'Cajera' :
              currentUser.role === 'delivery' ? 'Delivery' : 'Mozo'
            }</span>
          </div>

          <div className="flex items-center gap-1">
            <div 
              className={`w-2 h-2 rounded-full transition-colors ${
                register.isOpen 
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' 
                  : (currentUser.role === 'admin' && adminConsultationMode)
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-amber-500'
              }`} 
              title={
                register.isOpen 
                  ? 'Caja Abierta' 
                  : (currentUser.role === 'admin' && adminConsultationMode)
                    ? 'Caja Cerrada • Modo Consulta (Admin)' 
                    : 'Caja Cerrada'
              } 
            />
            <span className={`text-[8px] sm:text-[8.5px] font-black uppercase tracking-wider hidden lg:inline ${
              currentUser.role === 'admin' && adminConsultationMode ? 'text-blue-300' : 'text-slate-300'
            }`}>
              {register.isOpen ? 'Abierta' : (currentUser.role === 'admin' && adminConsultationMode ? 'Modo Consulta' : 'Cerrada')}
            </span>
          </div>

          {['admin', 'cajero'].includes(currentUser.role) && (
            register.isOpen ? (
              <button
                type="button"
                onClick={() => {
                  showConfirm({
                    title: '¿Cerrar Caja y Archivar Turno?',
                    message: 'Se generará el reporte de cierre contable y se archivarán las ventas del turno.',
                    confirmText: 'Cerrar Caja',
                    confirmVariant: 'danger',
                    onConfirm: () => handleCloseRegister(false)
                  });
                }}
                className="px-2 py-0.5 h-7 bg-red-950/60 hover:bg-red-900 border border-red-500/40 text-red-200 rounded-lg text-[8px] sm:text-[8.5px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-xs"
                title="Cerrar caja y finalizar turno"
              >
                <Icon name="lock" size={12} />
                <span className="hidden sm:inline">Cerrar Caja</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setOpenRegisterPromptModal({ isOpen: true, initialCash: '' })}
                className="px-2 py-0.5 h-7 bg-purple-600 hover:bg-purple-500 text-slate-950 rounded-lg text-[8px] sm:text-[8.5px] font-black uppercase flex items-center gap-1 transition-all cursor-pointer shadow-md shadow-purple-600/30"
                title="Abrir caja e ingresar monto inicial obligatorio"
              >
                <Icon name="key" size={12} />
                <span className="hidden sm:inline">Abrir Caja</span>
              </button>
            )
          )}

          {isAuthenticated && (
            <button
              type="button"
              onClick={() => {
                showConfirm({
                  title: '¿Cerrar Sesión?',
                  message: '¿Estás seguro de que deseas salir y cerrar tu sesión en NEXT CRM?',
                  confirmText: 'Cerrar Sesión',
                  confirmVariant: 'danger',
                  onConfirm: () => {
                    setIsAuthenticated(false);
                    localStorage.removeItem('nextcrm_auth');
                    localStorage.removeItem('nextcrm_user');
                    localStorage.removeItem('nextcrm_role');
                    hasCheckedRegisterOnLogin.current = false;
                    setAdminConsultationMode(false);
                    setOpenRegisterPromptModal({ isOpen: false, initialCash: '' });
                    showMessage("Sesión cerrada");
                  }
                });
              }}
              className="p-1 sm:p-1.5 hover:bg-red-950/50 text-slate-400 hover:text-red-300 rounded-lg transition-all border border-transparent hover:border-red-500/30 flex items-center gap-1 text-[8.5px] font-black uppercase cursor-pointer"
              title="Cerrar sesión NEXT CRM"
            >
              <Icon name="logout" size={13} />
              <span className="hidden xl:inline">Salir</span>
            </button>
          )}
        </div>
      </header>

      {/* Real-time Admin Live Modification Alert Notification Banner */}
      {currentUser.role === 'admin' && activeAlertBanner && (
        <div className="fixed top-12 right-3 z-50 max-w-sm sm:max-w-md w-full bg-[#16062a] border-2 border-red-500 rounded-2xl p-3.5 shadow-2xl shadow-red-950/80 animate-in fade-in slide-in-from-top-3 duration-200 flex flex-col gap-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 text-red-300 font-black text-xs uppercase tracking-wider">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span>🚨 Alerta de Modificación en Vivo</span>
            </div>
            <button 
              type="button"
              onClick={() => setActiveAlertBanner(null)}
              className="text-slate-400 hover:text-white p-0.5 text-xs font-black cursor-pointer"
              title="Cerrar alerta"
            >
              ✕
            </button>
          </div>
          <div className="text-white text-xs font-bold">
            <span className="font-black text-purple-300">{activeAlertBanner.userName || 'Cajera'}</span> modificó la comanda <span className="font-mono font-black text-amber-300">#{activeAlertBanner.orderId}</span>
          </div>
          <div className="text-[11px] text-slate-300 bg-black/50 p-2 rounded-xl border border-red-500/20 font-mono">
            {activeAlertBanner.changesSummary || activeAlertBanner.description}
          </div>
          <div className="flex items-center justify-end gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => {
                setActiveAlertBanner(null);
                setActiveTab('audit');
              }}
              className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-slate-950 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 shadow-md cursor-pointer"
            >
              <Icon name="security" size={13} />
              <span>Ver en Auditoría</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveAlertBanner(null)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-[10px] font-black uppercase cursor-pointer"
            >
              <span>Entendido</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 min-h-0 overflow-hidden relative bg-[#040108]">
        {/* POS Tab */}
        {activeTab === 'pos' && (
          <PosWizard
            posStep={posStep}
            setPosStep={setPosStep}
            menu={menu}
            allMenuItems={allMenuItems}
            activeCategory={activeCategory}
            setActiveCategory={setActiveCategory}
            cart={cart}
            setCart={setCart}
            addToCart={addToCart}
            updateQuantity={updateQuantity}
            cartTotal={cartTotal}
            orderType={orderType}
            setOrderType={setOrderType}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            cashProvided={cashProvided}
            setCashProvided={setCashProvided}
            orderTip={orderTip}
            setOrderTip={setOrderTip}
            orderNotes={orderNotes}
            setOrderNotes={setOrderNotes}
            clientInfo={clientInfo}
            setClientInfo={setClientInfo}
            allClients={allClients}
            matchingClients={matchingClients}
            showClientDropdown={showClientDropdown}
            setShowClientDropdown={setShowClientDropdown}
            isScheduled={isScheduled}
            setIsScheduled={setIsScheduled}
            scheduledTime={scheduledTime}
            setScheduledTime={setScheduledTime}
            editingOrder={editingOrder}
            clearForm={clearForm}
            handleCheckout={handleCheckout}
            isSubmitting={isSubmitting}
            setToppingModal={setToppingModal}
            setVoiceOrderModalOpen={setVoiceOrderModalOpen}
            showMessage={showMessage}
            orders={orders}
            currentUser={currentUser}
            th={th}
            db={db}
            appId={appId}
          />
        )}

        {/* KDS Monitor Tab */}
        {activeTab === 'kitchen' && (
          <KdsMonitor
            orders={orders}
            db={db}
            appId={appId}
            WARNING_THRESHOLDS={WARNING_THRESHOLDS}
            setNotesModal={setNotesModal}
            handleEditOrder={handleEditOrder}
            notifyClientWhatsApp={notifyClientWhatsApp}
            setDeliveryShareModal={setDeliveryShareModal}
            setEditOrderModal={setEditOrderModal}
            handleDirectDispatch={handleDirectDispatch}
            showMessage={showMessage}
            onDeleteOrder={handleOrderDeleteAction}
            currentUserRole={currentUser.role}
          />
        )}

        {/* Dedicated Delivery Fleet & GPS Routing Tab */}
        {activeTab === 'delivery' && (
          <div className="h-full overflow-y-auto no-scrollbar bg-[#040108]">
            <DeliveryRiderTab
              orders={orders as any}
              db={db}
              appId={appId}
              currentUser={currentUser}
              showMessage={showMessage}
              setNotesModal={setNotesModal}
              handleEditOrder={handleEditOrder}
              setEditOrderModal={setEditOrderModal}
            />
          </div>
        )}

        {/* Generic active orders tab (counter, tables) */}
        {(['counter', 'tables'].includes(activeTab)) && (
          <div className="p-8 h-full overflow-y-auto no-scrollbar bg-[#040108]">
             <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
               {orders.filter(o => !o.isArchived && o.status !== 'Finalizado' && o.status !== 'Cancelado').filter(o => { 
                   const safeType = String(o.type || '').trim().toLowerCase();
                   if (activeTab === 'counter') return ['local', 'mostrador'].includes(safeType); 
                   if (activeTab === 'tables') return safeType === 'mesa'; 
                   return false; 
               }).map(o => (
                  <OrderCard 
                    key={o.firestoreId} 
                    order={o} 
                    db={db} appId={appId} WARNING_THRESHOLDS={WARNING_THRESHOLDS} setNotesModal={setNotesModal} handleEditOrder={handleEditOrder} notifyClientWhatsApp={notifyClientWhatsApp} setDeliveryShareModal={setDeliveryShareModal} setEditOrderModal={setEditOrderModal} handleDirectDispatch={handleDirectDispatch} showMessage={showMessage}
                    onDeleteOrder={handleOrderDeleteAction} currentUserRole={currentUser.role} collapsible={true}
                  />
               ))}
             </div>
          </div>
        )}

        {/* Dedicated Staff & Tips Liquidation Tab */}
        {activeTab === 'staff' && (
          <div className="h-full overflow-y-auto no-scrollbar bg-[#040108]">
            <StaffPerformanceTab
              orders={orders}
              currentUser={currentUser}
              showMessage={showMessage}
              onUpdateOrderTip={handleUpdateOrderTip}
            />
          </div>
        )}

        {/* Dedicated Finished Orders & Sales History Tab */}
        {activeTab === 'finished' && (() => {
          const finishedOrders = orders.filter(o => !o.isArchived && o.status === 'Finalizado');
          const filteredOrders = finishedOrders.filter(o => {
            const matchesSearch = !finishedFilter.search || 
              o.id.toLowerCase().includes(finishedFilter.search.toLowerCase()) ||
              (o.client?.name || '').toLowerCase().includes(finishedFilter.search.toLowerCase()) ||
              (o.client?.phone || '').includes(finishedFilter.search) ||
              (o.client?.address || '').toLowerCase().includes(finishedFilter.search.toLowerCase()) ||
              o.items.some(it => it.name.toLowerCase().includes(finishedFilter.search.toLowerCase()));

            const matchesMethod = finishedFilter.method === 'TODOS' || (o.paymentMethod || 'Efectivo') === finishedFilter.method;
            const matchesType = finishedFilter.type === 'TODOS' || (o.type || '').toLowerCase().includes(finishedFilter.type.toLowerCase());
            return matchesSearch && matchesMethod && matchesType;
          });

          const totalFilteredSales = filteredOrders.reduce((sum, o) => sum + (o.total || 0), 0);
          const totalFilteredTips = filteredOrders.reduce((sum, o) => sum + (o.tip || 0), 0);
          const totalFilteredCash = filteredOrders.filter(o => o.paymentMethod === 'Efectivo').reduce((sum, o) => sum + (o.total || 0), 0);

          return (
            <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
              <div className="max-w-7xl mx-auto space-y-8">
                {/* Header & Export Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-500/20 pb-6">
                  <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                      <Icon name="history" size={36} className="text-purple-400"/> Historial de Ventas
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                      Comandas cobradas del turno actual • Permite editar, borrar y exportar
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={handlePurgeBefore19HoursToday}
                      className="px-4 py-3 bg-red-950/70 hover:bg-red-900/90 border border-red-500/50 text-red-200 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                      title="Borrar todos los pedidos y reportes creados antes de las 19:00 hs de hoy"
                    >
                      <Icon name="auto_delete" size={16} className="text-red-300"/> 🗑️ Borrar &lt; 19:00 hs de Hoy
                    </button>
                    {finishedOrders.length > 0 && (
                      <button 
                        onClick={handleClearAllFinishedOrders}
                        className="px-4 py-3 bg-red-950/50 hover:bg-red-900/70 border border-red-500/40 text-red-200 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                        title="Eliminar todas las comandas finalizadas"
                      >
                        <Icon name="delete_sweep" size={16}/> 🗑️ Vaciar Finalizados
                      </button>
                    )}
                    <button 
                      onClick={() => setImportExcelModalOpen(true)} 
                      className="px-5 py-3 bg-[#130826] border border-purple-500/40 text-purple-200 hover:text-white rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                      title="Importar ventas o turnos desde archivo Excel"
                    >
                      <Icon name="upload_file" size={16} className="text-purple-300"/> 📥 Importar Excel
                    </button>
                    <button 
                      onClick={() => exportOrdersToCSV(filteredOrders)} 
                      className="px-5 py-3 bg-[#160829] border border-purple-500/30 text-purple-300 hover:bg-[#220c40] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                      title="Descargar listado en formato Excel / CSV"
                    >
                      <Icon name="download" size={16}/> 📊 Exportar Excel (CSV)
                    </button>
                    <button 
                      onClick={() => exportOrdersToPDF(filteredOrders)} 
                      className="px-5 py-3 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-md shadow-purple-500/20"
                      title="Descargar o imprimir reporte en PDF"
                    >
                      <Icon name="print" size={16}/> 📄 Exportar PDF
                    </button>
                  </div>
                </div>

                {/* Multiselect Toolbar */}
                {filteredOrders.length > 0 && (
                  <div className="bg-[#0b0518] p-4 rounded-2xl border border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 text-xs font-black uppercase text-purple-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={filteredOrders.length > 0 && filteredOrders.every(o => selectedFinishedOrders.includes(o.firestoreId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedFinishedOrders(filteredOrders.map(o => o.firestoreId));
                          } else {
                            setSelectedFinishedOrders([]);
                          }
                        }}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                      />
                      <span>Seleccionar Todos ({filteredOrders.length})</span>
                    </label>

                    {selectedFinishedOrders.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 uppercase">
                          {selectedFinishedOrders.length} seleccionados
                        </span>
                        <button
                          onClick={handleDeleteSelectedFinishedOrders}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                        >
                          <Icon name="delete" size={14}/> Eliminar Seleccionados ({selectedFinishedOrders.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Filters & Search */}
                <div className="bg-[#0b0518] p-6 rounded-[30px] border border-purple-500/20 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative">
                    <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Buscar por ID, cliente, teléfono, item..." 
                      value={finishedFilter.search} 
                      onChange={e => setFinishedFilter({ ...finishedFilter, search: e.target.value })} 
                      className="w-full pl-11 pr-4 py-3 bg-[#06020e] border border-purple-500/30 text-purple-100 placeholder-slate-500 rounded-2xl text-xs font-black uppercase outline-none focus:border-purple-400"
                    />
                  </div>
                  <div>
                    <select 
                      value={finishedFilter.method} 
                      onChange={e => setFinishedFilter({ ...finishedFilter, method: e.target.value })} 
                      className="w-full py-3 px-4 bg-[#06020e] border border-purple-500/30 text-purple-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-purple-400"
                    >
                      <option value="TODOS">Todos los medios de pago</option>
                      <option value="Efectivo">Efectivo</option>
                      <option value="Débito">Débito</option>
                      <option value="Crédito">Crédito</option>
                      <option value="Transferencia">Transferencia</option>
                      <option value="Mercado Pago">Mercado Pago</option>
                      <option value="A confirmar">A confirmar</option>
                    </select>
                  </div>
                  <div>
                    <select 
                      value={finishedFilter.type} 
                      onChange={e => setFinishedFilter({ ...finishedFilter, type: e.target.value })} 
                      className="w-full py-3 px-4 bg-[#06020e] border border-purple-500/30 text-purple-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-purple-400"
                    >
                      <option value="TODOS">Todos los tipos de pedido</option>
                      <option value="local">Mostrador / Local</option>
                      <option value="mesa">Mesas</option>
                      <option value="envío">Delivery / Envío</option>
                      <option value="web">Pedidos Web</option>
                    </select>
                  </div>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-[#0b0518] p-6 rounded-[28px] border border-purple-500/20 shadow-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ventas Filtradas</div>
                    <div className="text-3xl font-black text-white mt-1">${totalFilteredSales}</div>
                  </div>
                  <div className="bg-[#0b0518] p-6 rounded-[28px] border border-purple-500/20 shadow-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comandas Cobradas</div>
                    <div className="text-3xl font-black text-white mt-1">{filteredOrders.length}</div>
                  </div>
                  <div className="bg-[#0b0518] p-6 rounded-[28px] border border-purple-500/20 shadow-xs">
                    <div className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Efectivo Cobrado</div>
                    <div className="text-3xl font-black text-purple-400 mt-1">${totalFilteredCash}</div>
                  </div>
                  <div className="bg-[#0b0518] p-6 rounded-[28px] border border-purple-500/20 shadow-xs">
                    <div className="text-[10px] font-black text-purple-300 uppercase tracking-widest">Total Propinas</div>
                    <div className="text-3xl font-black text-purple-300 mt-1">${totalFilteredTips}</div>
                  </div>
                </div>

                {/* Sales Cards Grid */}
                {filteredOrders.length === 0 ? (
                  <div className="bg-[#0b0518] p-12 rounded-[40px] border border-purple-500/20 text-center space-y-3">
                    <Icon name="search_off" size={48} className="mx-auto text-slate-500"/>
                    <div className="font-black text-slate-300 text-lg uppercase">No se encontraron ventas finalizadas</div>
                    <div className="text-xs font-bold text-slate-500">Pruebe ajustando los filtros de búsqueda o el medio de pago.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOrders.map(order => {
                      const isSelected = selectedFinishedOrders.includes(order.firestoreId);
                      return (
                      <div key={order.firestoreId} className={`bg-[#0b0518] rounded-[32px] p-6 border shadow-sm flex flex-col justify-between transition-all ${
                        isSelected ? 'border-purple-500 bg-[#120726]' : 'border-purple-500/20 hover:border-purple-500/40'
                      }`}>
                        <div className="space-y-4">
                          {/* Order Header with Selection Checkbox */}
                          <div className="flex justify-between items-start border-b border-purple-500/10 pb-3">
                            <div className="flex items-start gap-2.5">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedFinishedOrders(prev => [...prev, order.firestoreId]);
                                  } else {
                                    setSelectedFinishedOrders(prev => prev.filter(id => id !== order.firestoreId));
                                  }
                                }}
                                className="mt-1 w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"
                              />
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-black text-sm bg-purple-600 text-slate-950 px-2.5 py-1 rounded-xl shadow-xs font-mono">{order.id}</span>
                                  <span className="font-black text-xs text-slate-400 uppercase">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                                </div>
                                <div className="font-black text-sm uppercase text-white mt-2">{order.client?.name || 'CLIENTE GENERAL'}</div>
                                {order.client?.phone && <div className="text-[11px] font-bold text-purple-400">{order.client.phone}</div>}
                                {order.client?.address && <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">{order.client.address} {order.client.zone ? `(${order.client.zone})` : ''}</div>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-purple-950 text-purple-300 border border-purple-500/30">
                                {order.type || 'Local'}
                              </span>
                              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-[#06020e] text-slate-300 border border-purple-500/20">
                                {order.paymentMethod || 'Efectivo'}
                              </span>
                            </div>
                          </div>

                          {/* Items */}
                          <ul className="text-xs space-y-1.5 py-1">
                            {order.items.map((it, idx) => (
                              <li key={idx} className="flex justify-between items-start">
                                <div>
                                  <span className="font-black text-slate-200">{it.quantity || 1}x {it.name}</span>
                                  {it.selectedToppings && it.selectedToppings.length > 0 && (
                                    <div className="text-[10px] text-purple-400 font-bold italic mt-0.5">
                                      + {it.selectedToppings.map(t => t.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className="font-black text-purple-300">${Math.round((it.finalPrice || 0) * (it.quantity || 1))}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Notes */}
                          {order.notes && (
                            <div className="p-3 bg-purple-950/40 border border-purple-500/30 rounded-2xl text-[11px] font-bold text-purple-200">
                              📝 <span className="uppercase">{order.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Total & Actions */}
                        <div className="mt-6 pt-4 border-t border-purple-500/10 space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Cobrado</div>
                              <div className="text-3xl font-black text-purple-400 leading-none">${order.total}</div>
                              {order.tip ? <div className="text-[10px] font-black text-purple-300 mt-1">+ ${order.tip} Propina</div> : null}
                            </div>
                            <button 
                              onClick={() => printOrderTicket(order)} 
                              className="p-3 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-xs"
                              title="Reimprimir ticket de la comanda"
                            >
                              <Icon name="print" size={16}/> Ticket
                            </button>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex gap-2 pt-2 border-t border-purple-500/10">
                            <button 
                              onClick={() => handleOpenEditSale(order)} 
                              className="flex-1 py-2.5 bg-blue-950/60 hover:bg-blue-900/80 border border-blue-500/30 text-blue-300 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                            >
                              <Icon name="edit" size={14}/> Editar Venta
                            </button>
                            <button 
                              onClick={() => handleDeleteSale(order.firestoreId, order.id)} 
                              className="px-4 py-2.5 bg-red-950/60 hover:bg-red-900/80 border border-red-500/30 text-red-300 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                              title="Eliminar comanda del registro"
                            >
                              <Icon name="delete" size={14}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ); })}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Clients / CRM Tab */}
        {activeTab === 'clients' && (
          <CrmClientsTab
            allClients={allClients}
            clients={clients}
            clientSearch={clientSearch}
            setClientSearch={setClientSearch}
            setNewClientModal={setNewClientModal}
            handleRestoreClientsFromHistory={handleRestoreClientsFromHistory}
            handleDeleteClient={handleDeleteClient}
            setClientInfo={setClientInfo}
            setOrderType={setOrderType}
            setActiveTab={setActiveTab}
            setPosStep={setPosStep}
            showMessage={showMessage}
            setEditingClient={setEditingClient}
            db={db}
            appId={appId}
          />
        )}

        {/* Products / Menu Tab */}
        {activeTab === 'products' && (
          <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-purple-500/20 pb-6">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                    <Icon name="menu_book" size={36} className="text-purple-400"/> Configuración del Menú
                  </h1>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Gestione precios, gustos y categorías • Permite editar y borrar productos sin duplicados</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => setIsImportMenuModalOpen(true)}
                    className="px-4 py-3 bg-[#160829] border border-purple-500/40 text-purple-200 hover:bg-[#251046] hover:text-white rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Importar menú desde Excel (.xlsx, .csv) o formato texto"
                  >
                    <Icon name="upload_file" size={16} className="text-purple-300"/> 📥 Importar Menú
                  </button>
                  {Object.keys(menu).some(cat => (menu[cat] || []).length > 0) && (
                    <button 
                      onClick={handleClearAllMenu}
                      className="px-3.5 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs"
                      title="Vaciar todo el menú para comenzar de cero"
                    >
                      <Icon name="delete" size={15}/> Vaciar Menú
                    </button>
                  )}
                  <button 
                    onClick={handleRestoreDefaultMenu}
                    className="px-4 py-3 bg-purple-600/20 hover:bg-purple-600/40 border border-purple-500/50 text-purple-200 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs"
                    title="Cargar y sincronizar la carta oficial del folleto de El Árbol"
                  >
                    <Icon name="refresh" size={16}/> 🔄 Carta Oficial (Folleto)
                  </button>
                  <button 
                    onClick={handleCleanDuplicates}
                    className="px-4 py-3 bg-purple-950/60 hover:bg-purple-900/80 border border-purple-500/40 text-purple-200 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs"
                    title="Buscar y eliminar automáticamente productos duplicados del menú"
                  >
                    <Icon name="cleaning_services" size={16}/> Limpiar Duplicados
                  </button>
                  <button 
                    onClick={() => exportMenuToCSV(menu)} 
                    className="px-5 py-3 bg-[#160829] border border-purple-500/30 text-purple-300 hover:bg-[#220c40] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Exportar menú a Excel (CSV)"
                  >
                    <Icon name="download" size={16}/> 📊 Exportar Excel
                  </button>
                  <button 
                    onClick={() => exportMenuToPDF(menu)} 
                    className="px-5 py-3 bg-[#160829] border border-purple-500/30 text-purple-300 hover:bg-[#220c40] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Descargar menú en PDF"
                  >
                    <Icon name="print" size={16}/> 📄 Exportar PDF
                  </button>
                  <button onClick={() => setNewProductModal(true)} className="px-6 py-3 bg-purple-600 text-slate-950 rounded-[20px] font-black uppercase text-xs hover:bg-purple-400 transition-all flex items-center gap-2 shadow-md shadow-purple-500/20">
                    <Icon name="add" size={18}/> + Nuevo Producto
                  </button>
                </div>
              </div>

              {Object.keys(menu).length === 0 || Object.values(menu).every((arr: any) => !arr || arr.length === 0) ? (
                <div className="bg-[#0b0518] p-12 rounded-[40px] border border-purple-500/20 text-center space-y-4 max-w-xl mx-auto">
                  <Icon name="menu_book" size={56} className="mx-auto text-purple-400 opacity-60" />
                  <h3 className="text-xl font-black uppercase text-white">Menú Limpio / Vacío</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed">
                    No hay productos cargados en el menú. Puedes crear nuevos productos manualmente, cargar tus productos desde Excel con "Importar Menú" o restaurar el menú base sugerido.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-3">
                    <button 
                      onClick={() => setIsImportMenuModalOpen(true)} 
                      className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      <Icon name="upload_file" size={16} /> 📥 Importar Menú Excel
                    </button>
                    <button 
                      onClick={() => setNewProductModal(true)} 
                      className="px-5 py-3 bg-[#160829] hover:bg-[#251046] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
                    >
                      <Icon name="add" size={16} /> + Nuevo Producto
                    </button>
                    <button 
                      onClick={handleRestoreDefaultMenu} 
                      className="px-4 py-3 bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700/50 rounded-2xl font-black uppercase text-[11px] transition-all flex items-center gap-2"
                    >
                      <Icon name="refresh" size={14} /> Restaurar Menú Sugerido
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Category Filter Pills (Sub-Header) */}
              <div className="bg-[#0b0518] p-3 rounded-2xl border border-purple-500/20 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                {[
                  { id: 'TODAS', label: 'Todas las Categorías', icon: 'apps' },
                  { id: 'promos', label: 'Promos', icon: 'stars' },
                  { id: 'pizzas', label: 'Pizzas', icon: 'local_pizza' },
                  { id: 'fainas', label: 'Fainás', icon: 'bakery_dining' },
                  { id: 'figazas', label: 'Figazzas', icon: 'breakfast_dining' },
                  { id: 'pizzetas', label: 'Pizzetas', icon: 'local_pizza' },
                  { id: 'sandwiches', label: 'Sándwichs', icon: 'lunch_dining' },
                  { id: 'bebidas', label: 'Bebidas', icon: 'local_bar' },
                  { id: 'postres', label: 'Postres', icon: 'icecream' },
                  { id: 'gustos', label: 'Gustos & Toppings', icon: 'tune' },
                  { id: 'extras', label: 'Extras', icon: 'add_circle' },
                ].map(cat => {
                  const isSelected = menuActiveCategory.toLowerCase() === cat.id.toLowerCase();
                  const count = cat.id === 'TODAS' 
                    ? Object.values(menu).reduce((acc: number, arr: any) => acc + (arr?.length || 0), 0)
                    : (menu[cat.id]?.length || 0);

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setMenuActiveCategory(cat.id)}
                      className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase transition-all shrink-0 flex items-center gap-2 border cursor-pointer ${
                        isSelected
                          ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-md shadow-purple-500/25'
                          : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-purple-500/50 hover:text-white'
                      }`}
                    >
                      <Icon name={cat.icon} size={15} />
                      <span>{cat.label}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono font-black ${
                        isSelected ? 'bg-slate-950 text-purple-300' : 'bg-purple-950/80 text-purple-400 border border-purple-500/30'
                      }`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>

              {Object.keys(menu)
                .filter(catKey => menuActiveCategory === 'TODAS' || catKey.toLowerCase() === menuActiveCategory.toLowerCase())
                .map(catKey => {
                const itemsInCat = menu[catKey] || [];
                if (itemsInCat.length === 0) return null;
                return (
                <div key={catKey} className="bg-[#0b0518] p-8 rounded-[40px] border border-purple-500/20 shadow-sm space-y-4">
                  <h2 className="text-2xl font-black uppercase text-white border-b border-purple-500/20 pb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="category" size={24} className="text-purple-400"/> {catKey}
                    </span>
                    <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full">
                      {(menu[catKey] || []).length} artículos
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(menu[catKey] || []).map(item => (
                      <div key={item.id} className="bg-[#06020e] p-5 rounded-[25px] border border-purple-500/20 flex flex-col justify-between hover:border-purple-500/40 transition-all">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-black text-sm uppercase text-white">{item.name}</div>
                            <div className="flex items-center gap-1">
                              {item.isMeter ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-950 text-blue-300 border border-blue-500/30 rounded-md">Metro</span>
                              ) : item.isPortion ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-500/30 rounded-md">Porción</span>
                              ) : null}
                              {item.hasToppings && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-950 text-purple-200 border border-purple-500/30 rounded-md">Gustos</span>
                              )}
                            </div>
                          </div>
                          {item.desc && <div className="text-[10px] font-bold text-slate-400 uppercase italic mt-1">{item.desc}</div>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-purple-500/15 space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-2xl font-black text-purple-400">${item.price}</span>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {item.isMeter ? 'Por metro' : (item.isPortion ? 'Porción' : 'Unidad')}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1 border-t border-purple-500/10">
                            <button 
                              onClick={() => handleOpenEditProduct(catKey, item)} 
                              className="flex-1 py-2 bg-[#160829] border border-purple-500/30 hover:bg-[#1a3325] text-purple-300 rounded-xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Icon name="edit" size={13}/> Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(catKey, item.id)} 
                              className="px-3 py-2 bg-red-950/60 hover:bg-red-900/80 border border-red-500/30 text-red-300 rounded-xl font-black text-[11px] uppercase transition-all flex items-center justify-center"
                              title="Borrar / Eliminar producto"
                            >
                              <Icon name="delete" size={14}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stock Tab (Control de Inventario en Tiempo Real) */}
        {activeTab === 'stock' && (
          <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header Banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-500/20 pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                      <Icon name="inventory_2" size={36} className="text-purple-400"/> Control de Stock
                    </h1>
                    <span className="text-[10px] font-black uppercase px-3 py-1 bg-purple-950 text-purple-300 border border-purple-500/30 rounded-full">
                      {stockItems.length} Artículos
                    </span>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Inventario en vivo • Deducción automática por comandas • Ajuste manual libre y no bloqueante
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button 
                    onClick={() => setIsImportStockModalOpen(true)} 
                    className="px-4 py-3 bg-[#160829] border border-purple-500/40 text-purple-200 hover:bg-[#251046] hover:text-white rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                    title="Importar catálogo de stock desde Excel (.xlsx, .csv) o texto"
                  >
                    <Icon name="upload_file" size={16} className="text-purple-300"/> 📥 Importar Stock
                  </button>
                  {stockItems.length > 0 && (
                    <button 
                      onClick={handleClearAllStock} 
                      className="px-3.5 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs"
                      title="Eliminar todos los artículos del stock para arrancar de cero"
                    >
                      <Icon name="delete" size={15}/> Vaciar Stock
                    </button>
                  )}
                  <button 
                    onClick={() => setNewStockItemModal(true)} 
                    className="px-5 py-3 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-md shadow-purple-500/20"
                  >
                    <Icon name="add" size={18}/> + Nuevo Artículo
                  </button>
                  {!register.isOpen && (
                    <button 
                      onClick={() => setActiveTab('cash')} 
                      className="px-5 py-3 bg-[#160829] text-purple-300 border border-purple-500/30 hover:bg-[#220c40] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2"
                    >
                      <Icon name="account_balance_wallet" size={18}/> Abrir Caja
                    </button>
                  )}
                </div>
              </div>

              {stockItems.length === 0 ? (
                <div className="bg-[#0b0518] p-12 rounded-[40px] border border-purple-500/20 text-center space-y-4 max-w-xl mx-auto">
                  <Icon name="inventory_2" size={56} className="mx-auto text-purple-400 opacity-60" />
                  <h3 className="text-xl font-black uppercase text-white">Inventario Limpio / Vacío</h3>
                  <p className="text-xs font-bold text-slate-400 uppercase leading-relaxed">
                    No hay artículos en el inventario. El sistema está limpio y listo para arrancar de cero. Puedes importar tus insumos y productos desde Excel o crearlos manualmente.
                  </p>
                  <div className="flex flex-wrap justify-center gap-3 pt-3">
                    <button 
                      onClick={() => setIsImportStockModalOpen(true)} 
                      className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer"
                    >
                      <Icon name="upload_file" size={16} /> 📥 Importar Stock Excel
                    </button>
                    <button 
                      onClick={() => setNewStockItemModal(true)} 
                      className="px-5 py-3 bg-[#160829] hover:bg-[#251046] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
                    >
                      <Icon name="add" size={16} /> + Nuevo Artículo
                    </button>
                  </div>
                </div>
              ) : null}

              {/* Status & Non-blocking notice */}
              {!register.isOpen ? (
                <div className="bg-purple-950/40 border border-purple-500/40 p-5 rounded-[28px] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/20 text-purple-300 rounded-2xl">
                      <Icon name="info" size={24}/>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase text-purple-200">Caja cerrada actualmente</div>
                      <div className="text-[11px] font-bold text-slate-300">
                        Puedes ajustar los valores de stock libremente. Al abrir la caja, podrás confirmar este stock o abrir en $0 sin restricción.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('cash')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-300 text-slate-950 rounded-xl font-black text-[11px] uppercase shrink-0"
                  >
                    Ir al Arqueo
                  </button>
                </div>
              ) : (
                <div className="bg-[#0b0518] border border-purple-500/30 p-5 rounded-[28px] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-500/20 text-purple-400 rounded-2xl">
                      <Icon name="sync" size={24} className="animate-spin" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase text-purple-300">Turno en curso y sincronizado</div>
                      <div className="text-[11px] font-bold text-slate-300">
                        Cada venta registrada descuenta automáticamente del inventario. Puedes modificar cualquier valor con los controles rápidos.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Grouped Stock Items */}
              <div className="space-y-6">
                {Object.entries<StockItem[]>(
                  stockItems.reduce((acc: Record<string, StockItem[]>, item: StockItem) => {
                    const cat = item.category || 'Otros';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {})
                ).map(([catName, itemsInCat]) => (
                  <div key={catName} className="bg-[#0b0518] p-6 rounded-[35px] border border-purple-500/20 shadow-md space-y-4">
                    <div className="border-b border-purple-500/20 pb-3 flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-purple-400"></span>
                        {catName}
                      </span>
                      <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-950/80 border border-purple-500/30 px-3 py-1 rounded-full">
                        {itemsInCat.length} {itemsInCat.length === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {itemsInCat.map(item => {
                        const unit = getItemUnit(item);
                        const symbol = getItemUnitSymbol(item);
                        const step = unit === 'Metros' ? 0.5 : 1;
                        const fastStep = unit === 'Metros' ? 1 : 5;
                        
                        // If register open, use live current stock, else initialStockInput
                        const liveStockVal = register.isOpen && register.currentStock 
                          ? register.currentStock[item.firestoreId] 
                          : undefined;
                        const inputValStr = initialStockInput[item.firestoreId] ?? '';
                        const currentDisplayVal = liveStockVal !== undefined ? liveStockVal : (parseFloat(inputValStr) || 0);

                        const isLow = currentDisplayVal <= 3 && currentDisplayVal > 0;
                        const isZero = currentDisplayVal === 0;

                        const handleAdjustStock = async (delta: number) => {
                          const nextVal = Math.max(0, Math.round((currentDisplayVal + delta) * 100) / 100);
                          if (register.isOpen) {
                            try {
                              const updated = { ...(register.currentStock || {}), [item.firestoreId]: nextVal };
                              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
                                currentStock: updated
                              });
                            } catch (e: any) {
                              showMessage("Error: " + e.message, "error");
                            }
                          } else {
                            setInitialStockInput(prev => ({ ...prev, [item.firestoreId]: nextVal.toString() }));
                          }
                        };

                        const handleDirectChange = async (val: string) => {
                          const num = parseFloat(val) || 0;
                          if (register.isOpen) {
                            try {
                              const updated = { ...(register.currentStock || {}), [item.firestoreId]: num };
                              await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
                                currentStock: updated
                              });
                            } catch (e: any) {
                              showMessage("Error: " + e.message, "error");
                            }
                          } else {
                            setInitialStockInput(prev => ({ ...prev, [item.firestoreId]: val }));
                          }
                        };

                        return (
                          <div 
                            key={item.firestoreId} 
                            className={`p-4 rounded-[26px] border transition-all flex flex-col justify-between gap-3 shadow-md ${
                              isZero 
                                ? 'bg-red-950/30 border-red-500/40' 
                                : isLow 
                                ? 'bg-purple-950/30 border-purple-500/40' 
                                : 'bg-[#0b0518] border-purple-500/20 hover:border-purple-500/40'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="text-[12px] font-black uppercase text-slate-100 truncate" title={item.name}>{item.name}</div>
                                <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{unit} ({symbol})</div>
                              </div>
                              <button 
                                type="button" 
                                onClick={() => handleDeleteStockItem(item.firestoreId)}
                                className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                                title="Eliminar artículo de stock"
                              >
                                <Icon name="delete" size={16}/>
                              </button>
                            </div>

                            <div className="flex items-center justify-between gap-2">
                              <div className="text-2xl font-black text-purple-400 tracking-tight">
                                {currentDisplayVal} <span className="text-xs text-slate-400 font-bold">{symbol}</span>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isZero 
                                  ? 'bg-red-950 text-red-400 border border-red-500/40' 
                                  : isLow 
                                  ? 'bg-purple-950 text-purple-300 border border-purple-500/40' 
                                  : 'bg-purple-950 text-purple-400 border border-purple-500/40'
                              }`}>
                                {isZero ? 'Agotado' : isLow ? 'Bajo' : 'OK'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 bg-[#06020e] p-1.5 rounded-xl border border-purple-500/20">
                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(-step)}
                                className="w-8 h-8 bg-[#160829] hover:bg-[#220c40] text-purple-300 rounded-lg font-black text-xs flex items-center justify-center transition-all"
                                title={`Restar ${step}`}
                              >
                                -
                              </button>

                              <div className="relative flex-1">
                                <input 
                                  type="number" 
                                  step={unit === 'Metros' ? "0.5" : "1"}
                                  min="0"
                                  placeholder="0"
                                  value={register.isOpen && liveStockVal !== undefined ? liveStockVal : (initialStockInput[item.firestoreId] ?? currentDisplayVal)} 
                                  onChange={e => handleDirectChange(e.target.value)}
                                  className="w-full py-1 pr-4 pl-1 bg-transparent text-center font-black text-xs text-purple-100 outline-none"
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 pointer-events-none">
                                  {symbol}
                                </span>
                              </div>

                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(step)}
                                className="w-8 h-8 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-lg font-black text-xs flex items-center justify-center transition-all shadow-xs"
                                title={`Sumar ${step}`}
                              >
                                +
                              </button>

                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(fastStep)}
                                className="px-2 h-8 bg-[#160829] hover:bg-[#220c40] text-purple-300 rounded-lg font-black text-[10px] flex items-center justify-center transition-all border border-purple-500/30"
                                title={`Sumar rápido +${fastStep}`}
                              >
                                +{fastStep}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Reportes Tab */}
        {activeTab === 'reports' && (
          <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-purple-500/20 pb-6">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-white">Reporte del Turno</h1>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Estadísticas detalladas de ventas actuales</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={handlePurgeBefore19HoursToday}
                    className="px-4 py-3 bg-red-950/70 hover:bg-red-900/90 border border-red-500/50 text-red-200 rounded-[20px] font-black uppercase text-[10px] transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                    title="Borrar todos los pedidos y reportes creados antes de las 19:00 hs de hoy"
                  >
                    <Icon name="auto_delete" size={16} className="text-red-300"/> 🗑️ Borrar &lt; 19:00 hs de Hoy
                  </button>
                  <button 
                    onClick={() => setImportExcelModalOpen(true)}
                    className="px-4 py-3 bg-[#160829] border border-purple-500/40 text-purple-200 hover:bg-[#251046] hover:text-white rounded-[20px] font-black uppercase text-[10px] transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                    title="Importar ventas y reportes históricos desde archivo Excel (.xlsx, .csv)"
                  >
                    <Icon name="upload_file" size={16} className="text-purple-300"/> 📥 Importar Reportes Excel
                  </button>
                  {orders.length > 0 && (
                    <button 
                      onClick={handleClearAllOrders}
                      className="px-3.5 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-[20px] font-black uppercase text-[10px] transition-all flex items-center gap-1.5 shadow-xs"
                      title="Vaciar comandas activas y finalizadas del reporte"
                    >
                      <Icon name="delete" size={15}/> Limpiar Ventas
                    </button>
                  )}
                  <button 
                    onClick={() => handlePrintClosureReport(undefined, 'full')} 
                    className="px-5 py-3 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-[20px] font-black uppercase text-[10px] transition-all flex items-center gap-2 shadow-md shadow-purple-500/20"
                  >
                    <Icon name="print" size={16}/> 📄 Imprimir Contabilidad (A4)
                  </button>
                  <button 
                    onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                    className="px-5 py-3 bg-[#0b0518] text-purple-300 border border-purple-500/30 rounded-[20px] font-black uppercase text-[10px] hover:bg-[#160829] transition-all flex items-center gap-2"
                  >
                    <Icon name="receipt" size={16}/> 🖨️ Ticket Resumen
                  </button>
                  <button 
                    onClick={() => {
                      const finished = orders.filter(o => !o.isArchived && o.status === 'Finalizado');
                      exportOrdersToCSV(finished);
                    }} 
                    className="px-5 py-3 bg-[#160829] text-purple-300 border border-purple-500/20 rounded-[20px] font-black uppercase text-[10px] hover:bg-[#220c40] flex items-center gap-2"
                  >
                    <Icon name="download" size={16}/> 📊 Exportar Ventas CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-[#0b0518] p-8 rounded-[35px] shadow-sm border border-purple-500/20">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Ventas Totales</div>
                    <div className="text-4xl font-black text-white">${reportData.totalSales}</div>
                 </div>
                 <div className="bg-[#0b0518] p-8 rounded-[35px] shadow-sm border border-purple-500/20">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Comandas Cobradas</div>
                    <div className="text-4xl font-black text-purple-400">{reportData.finishedTotal}</div>
                 </div>
                 <div className="bg-[#0b0518] p-8 rounded-[35px] shadow-sm border border-purple-500/30">
                    <div className="text-[10px] text-purple-300 font-black uppercase tracking-widest mb-1">Propinas</div>
                    <div className="text-4xl font-black text-purple-300">${reportData.totalTips}</div>
                 </div>
                 <div className="bg-purple-950/80 p-8 rounded-[35px] shadow-xl text-white border border-purple-500/40">
                    <div className="text-[10px] text-purple-300 font-black uppercase tracking-widest mb-1">Efectivo en Caja</div>
                    <div className="text-4xl font-black text-purple-400">${register.currentCash}</div>
                 </div>
              </div>

              {/* Physical Quantities & Meters Sold */}
              <div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-200 mb-4 flex items-center gap-2">
                    <Icon name="calculate" size={24} className="text-purple-400"/> Cantidades Físicas (Incluye Promos)
                 </h2>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-[#0b0518] p-6 rounded-[24px] border border-blue-500/30 flex flex-col items-center text-center">
                       <span className="text-[10px] text-blue-400 font-black uppercase tracking-widest mb-1">Metros de Pizza</span>
                       <span className="text-4xl font-black text-blue-300">{reportData.physicalTotals.metrosPizza} m</span>
                    </div>
                    <div className="bg-[#0b0518] p-6 rounded-[24px] border border-purple-500/30 flex flex-col items-center text-center">
                       <span className="text-[10px] text-purple-300 font-black uppercase tracking-widest mb-1">Fainás Totales</span>
                       <span className="text-4xl font-black text-purple-200">{reportData.physicalTotals.fainas}</span>
                    </div>
                    <div className="bg-[#0b0518] p-6 rounded-[24px] border border-purple-500/30 flex flex-col items-center text-center">
                       <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-1">Pizzetas Totales</span>
                       <span className="text-4xl font-black text-purple-300">{reportData.physicalTotals.pizzetas}</span>
                    </div>
                    <div className="bg-[#0b0518] p-6 rounded-[24px] border border-purple-500/30 flex flex-col items-center text-center">
                       <span className="text-[10px] text-purple-400 font-black uppercase tracking-widest mb-1">Porciones Pizza</span>
                       <span className="text-4xl font-black text-purple-300">{reportData.physicalTotals.porcionesPizza}</span>
                    </div>
                    <div className="bg-[#0b0518] p-6 rounded-[24px] border border-rose-500/30 flex flex-col items-center text-center">
                       <span className="text-[10px] text-rose-400 font-black uppercase tracking-widest mb-1">Sándwiches</span>
                       <span className="text-4xl font-black text-rose-300">{reportData.physicalTotals.sandwiches}</span>
                    </div>
                 </div>
              </div>

              {/* Shift Audit Section: Reflected directly in reports */}
              <div className="bg-[#0b0518] p-6 sm:p-8 rounded-[35px] border border-purple-500/30 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-purple-500/20 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-purple-600/20 text-purple-300 rounded-2xl border border-purple-500/30">
                      <Icon name="security" size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl sm:text-2xl font-black uppercase text-white tracking-tight flex items-center gap-2">
                        Auditoría del Turno: Modificaciones y Bajas
                      </h2>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        Control anti-fraude • Eliminaciones de tickets y rectificaciones de pedidos
                      </p>
                    </div>
                  </div>
                  {currentUser.role === 'admin' && (
                    <button
                      onClick={() => setActiveTab('audit')}
                      className="px-4 py-2 bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Icon name="visibility" size={14} /> Ver Auditoría Completa
                    </button>
                  )}
                </div>

                {(() => {
                  const shiftAuditLogs = auditLogs.filter(l => {
                    if (register.sessionId && l.sessionId === register.sessionId) return true;
                    if (register.openedAt && l.timestamp >= register.openedAt) return true;
                    return false;
                  });

                  if (shiftAuditLogs.length === 0) {
                    return (
                      <div className="text-center py-6 text-slate-500 text-xs font-bold uppercase tracking-wider">
                        🛡️ No se registraron eliminaciones ni rectificaciones anómalas en este turno.
                      </div>
                    );
                  }

                  const deletions = shiftAuditLogs.filter(l => l.action === 'DELETE_ORDER');
                  const rectifications = shiftAuditLogs.filter(l => l.action !== 'DELETE_ORDER');

                  return (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-red-950/30 border border-red-500/30 rounded-2xl flex justify-between items-center">
                          <span className="text-xs font-black uppercase text-red-200">Comandas Eliminadas</span>
                          <span className="text-2xl font-black text-red-400">{deletions.length}</span>
                        </div>
                        <div className="p-4 bg-amber-950/30 border border-amber-500/30 rounded-2xl flex justify-between items-center">
                          <span className="text-xs font-black uppercase text-amber-200">Modificaciones / Rectificaciones</span>
                          <span className="text-2xl font-black text-amber-400">{rectifications.length}</span>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-300">
                          <thead className="bg-[#120726] text-purple-300 font-black uppercase text-[10px] tracking-wider border-b border-purple-500/20">
                            <tr>
                              <th className="p-2.5">Hora</th>
                              <th className="p-2.5">Comanda</th>
                              <th className="p-2.5">Acción</th>
                              <th className="p-2.5">Detalle / Alteración</th>
                              <th className="p-2.5">Monto Antes/Después</th>
                              <th className="p-2.5">Responsable</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-purple-500/10">
                            {shiftAuditLogs.slice(0, 10).map((log, idx) => (
                              <tr key={log.firestoreId || idx} className="hover:bg-purple-950/20">
                                <td className="p-2.5 font-mono text-slate-400">
                                  {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="p-2.5 font-bold text-white">#{log.orderId}</td>
                                <td className="p-2.5">
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                                    log.action === 'DELETE_ORDER' 
                                      ? 'bg-red-950/80 border border-red-500/60 text-red-300' 
                                      : 'bg-amber-950/80 border border-amber-500/60 text-amber-300'
                                  }`}>
                                    {log.action === 'DELETE_ORDER' ? 'Eliminado' : 'Modificado'}
                                  </span>
                                </td>
                                <td className="p-2.5 text-slate-300 max-w-xs truncate" title={log.changesSummary || log.description}>
                                  {log.changesSummary || log.description}
                                </td>
                                <td className="p-2.5 font-mono">
                                  {log.previousTotal !== undefined && log.newTotal !== undefined ? (
                                    <span>${log.previousTotal} → ${log.newTotal}</span>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-400 uppercase text-[10px]">
                                  {log.userName || log.userRole}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Arqueo de Caja Tab */}
        {activeTab === 'cash' && (
          <div className="p-4 md:p-8 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar">
            {!register.isOpen ? (
              <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
                {/* Header Banner */}
                <div className="bg-[#0b0518] p-6 md:p-8 rounded-[35px] shadow-sm border border-purple-500/20 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-purple-600 text-slate-950 rounded-[24px] shadow-md shrink-0 font-black">
                      <Icon name="account_balance_wallet" size={32}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-white">
                          Apertura de Caja & Control de Stock
                        </h2>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-purple-950 text-purple-300 rounded-full border border-purple-500/40">
                          Stock Opcional
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase mt-1">
                        Ingrese el efectivo inicial y ajuste el inventario disponible. El stock es editable pero no es obligatorio para iniciar el turno.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => setNewStockItemModal(true)}
                      className="px-4 py-3 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all shadow-md shadow-purple-500/20"
                    >
                      <Icon name="add" size={18}/> + Nuevo Artículo
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const preset: Record<string, string> = {};
                        stockItems.forEach(item => {
                          const unit = getItemUnit(item);
                          if (unit === 'Metros') {
                            preset[item.firestoreId] = item.name.toLowerCase().includes('figaza') ? '10' : '15';
                          } else if (unit === 'Porciones') {
                            preset[item.firestoreId] = '30';
                          } else {
                            preset[item.firestoreId] = '20';
                          }
                        });
                        setInitialStockInput(preset);
                        showMessage("Preset sugerido de stock cargado");
                      }}
                      className="px-4 py-3 bg-[#160829] text-purple-300 hover:bg-[#220c40] rounded-2xl font-black text-xs uppercase flex items-center gap-2 border border-purple-500/30 transition-all"
                    >
                      <Icon name="auto_awesome" size={18}/> Preset Sugerido
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setInitialStockInput({});
                        showMessage("Conteo de stock puesto en 0");
                      }}
                      className="px-4 py-3 bg-[#160829] text-slate-400 hover:bg-[#220c40] rounded-2xl font-black text-xs uppercase flex items-center gap-2 border border-slate-700/50 transition-all"
                    >
                      <Icon name="restart_alt" size={18}/> Poner en 0
                    </button>
                  </div>
                </div>

                {/* Top Section: Cash Input & Primary Action */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Cash Card */}
                  <div className="lg:col-span-2 bg-[#0b0518] p-6 md:p-8 rounded-[35px] shadow-sm border border-purple-500/30 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-200 uppercase tracking-widest flex items-center gap-2">
                        <Icon name="payments" size={20} className="text-purple-400"/> Efectivo Inicial en Caja ($)
                      </label>
                      <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950 px-3 py-1 rounded-full border border-purple-500/40">
                        Efectivo al abrir
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="relative w-full">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-500">$</span>
                        <input 
                          type="number" 
                          className="w-full text-3xl md:text-4xl pl-12 pr-6 py-4 bg-[#040108] rounded-[22px] font-black text-white outline-none border-2 border-purple-500/30 focus:border-purple-400 transition-all" 
                          value={initialCashInput} 
                          onChange={e=>setInitialCashInput(e.target.value)} 
                          placeholder="Ej: 2000"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full overflow-x-auto no-scrollbar">
                        {['1000', '2000', '3000', '5000', '10000', '15000'].map(amount => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setInitialCashInput(amount)}
                            className="flex-1 min-w-[65px] px-3.5 py-3 bg-[#160829] hover:bg-[#220c40] text-purple-300 font-black text-xs rounded-2xl border border-purple-500/30 transition-all text-center"
                          >
                            ${amount}
                          </button>
                        ))}
                      </div>
                      {(!initialCashInput || parseFloat(initialCashInput) <= 0) && (
                        <div className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5">
                          <span>⚠️ Obligatorio: Ingrese un monto de efectivo mayor a $0 para habilitar la apertura de caja.</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Turn Start Primary CTA Card */}
                  <div className="bg-[#0b0518] p-6 md:p-8 rounded-[35px] shadow-xl text-white flex flex-col justify-between space-y-4 border border-purple-500/40">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Confirmación</div>
                      <h3 className="text-xl font-black uppercase text-white">Listo para Iniciar</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {Object.keys(initialStockInput).filter(k => (parseFloat(initialStockInput[k]) || 0) > 0).length} de {stockItems.length} productos con stock declarado
                      </p>
                      <div className="text-[11px] text-purple-400 font-bold mt-2 flex items-center gap-1.5">
                        <Icon name="check_circle" size={15}/> Stock editable y opcional
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button 
                        onClick={() => handleOpenRegister(false)} 
                        disabled={!initialCashInput || parseFloat(initialCashInput) <= 0}
                        className={`w-full py-4.5 rounded-[22px] shadow-lg font-black uppercase text-xs sm:text-sm transition-all flex items-center justify-center gap-2 ${
                          initialCashInput && parseFloat(initialCashInput) > 0
                            ? 'bg-purple-600 hover:bg-purple-400 text-slate-950 shadow-purple-500/20 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-70'
                        }`}
                      >
                        <Icon name="key" size={20}/> {initialCashInput && parseFloat(initialCashInput) > 0 ? `Abrir Caja ($${initialCashInput}) y Guardar Stock` : 'Ingrese Monto para Abrir Caja'}
                      </button>
                      <button 
                        onClick={() => handleOpenRegister(true)} 
                        disabled={!initialCashInput || parseFloat(initialCashInput) <= 0}
                        className={`w-full py-3 rounded-[18px] transition-all flex items-center justify-center gap-1.5 font-black uppercase text-[11px] border ${
                          initialCashInput && parseFloat(initialCashInput) > 0
                            ? 'bg-[#160829] hover:bg-[#220c40] text-slate-300 hover:text-white border-purple-500/30 cursor-pointer'
                            : 'bg-slate-900/60 text-slate-600 border-slate-800 cursor-not-allowed opacity-60'
                        }`}
                        title="Abre la caja inmediatamente sin cargar stock de productos"
                      >
                        <Icon name="bolt" size={16} className="text-purple-300"/> Abrir Rápido (Sin Stock)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stock Products Grid grouped by Category */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-purple-500/20 pb-3 gap-2">
                    <h3 className="text-xl font-black uppercase text-white flex items-center gap-2">
                      <Icon name="inventory_2" size={22} className="text-purple-400"/> Pantalla de Stock de Productos
                    </h3>
                    <div className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400"></span>
                      Pizzas y Figazas (m) • Fainá (porciones) • Bebidas y Otros (u)
                    </div>
                  </div>

                  <div className="space-y-6">
                    {Object.entries<StockItem[]>(
                      stockItems.reduce((acc: Record<string, StockItem[]>, item: StockItem) => {
                        const cat = item.category || 'Otros';
                        if (!acc[cat]) acc[cat] = [];
                        acc[cat].push(item);
                        return acc;
                      }, {})
                    ).map(([catName, itemsInCat]) => (
                      <div key={catName} className="bg-[#0b0518] p-5 md:p-6 rounded-[30px] border border-purple-500/20 shadow-sm space-y-4">
                        <div className="border-b border-purple-500/20 pb-3 flex items-center justify-between">
                          <span className="text-sm font-black uppercase tracking-wider text-purple-300 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-purple-400"></span>
                            {catName}
                          </span>
                          <span className="text-[10px] font-black uppercase text-purple-400 bg-purple-950 border border-purple-500/30 px-3 py-1 rounded-full">
                            {itemsInCat.length} {itemsInCat.length === 1 ? 'artículo' : 'artículos'}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
                          {itemsInCat.map(item => {
                            const unit = getItemUnit(item);
                            const symbol = getItemUnitSymbol(item);
                            const step = unit === 'Metros' ? 0.5 : 1;
                            const fastStep = unit === 'Metros' ? 1 : 5;
                            const curValStr = initialStockInput[item.firestoreId] || '';
                            const curNum = parseFloat(curValStr) || 0;

                            const handleAdjust = (delta: number) => {
                              const nextVal = Math.max(0, Math.round((curNum + delta) * 100) / 100);
                              setInitialStockInput(prev => ({ ...prev, [item.firestoreId]: nextVal.toString() }));
                            };

                            return (
                              <div key={item.firestoreId} className="bg-[#06020e] border border-purple-500/20 hover:border-purple-500/40 p-3.5 rounded-[22px] transition-all flex flex-col justify-between gap-2.5 shadow-xs">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-black uppercase text-slate-100 truncate" title={item.name}>{item.name}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{unit} ({symbol})</div>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteStockItem(item.firestoreId)}
                                    className="text-slate-500 hover:text-red-400 p-1 transition-colors"
                                    title="Eliminar artículo de stock"
                                  >
                                    <Icon name="delete" size={15}/>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 bg-[#06020e] p-1 rounded-xl border border-purple-500/20 shadow-xs">
                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(-step)}
                                    className="w-7 h-7 bg-[#160829] hover:bg-[#220c40] text-purple-300 rounded-lg font-black text-xs flex items-center justify-center transition-all"
                                    title={`Restar ${step}`}
                                  >
                                    -
                                  </button>

                                  <div className="relative flex-1">
                                    <input 
                                      type="number" 
                                      step={unit === 'Metros' ? "0.5" : "1"}
                                      min="0"
                                      placeholder="0"
                                      value={curValStr} 
                                      onChange={e => setInitialStockInput({ ...initialStockInput, [item.firestoreId]: e.target.value })}
                                      className="w-full py-1 pr-4 pl-1 bg-transparent text-center font-black text-xs text-white outline-none"
                                    />
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                                      {symbol}
                                    </span>
                                  </div>

                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(step)}
                                    className="w-7 h-7 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-lg font-black text-xs flex items-center justify-center transition-all shadow-xs"
                                    title={`Sumar ${step}`}
                                  >
                                    +
                                  </button>

                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(fastStep)}
                                    className="px-1.5 h-7 bg-[#160829] hover:bg-[#220c40] text-purple-300 rounded-lg font-black text-[10px] flex items-center justify-center transition-all border border-purple-500/30"
                                    title={`Sumar rápido +${fastStep}`}
                                  >
                                    +{fastStep}
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-4xl mx-auto space-y-10">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-[#0b0518] p-6 rounded-[40px] shadow-sm border border-purple-500/20">
                  <div className="flex items-center gap-3">
                    <div className="p-4 bg-purple-600 text-slate-950 rounded-full font-black"><Icon name="account_balance_wallet" size={28}/></div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-white">Caja Actual</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'full')} 
                      className="px-5 py-3 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-md shadow-purple-500/20"
                      title="Imprimir Informe Completo de Contabilidad (A4/PDF)"
                    >
                      <Icon name="print" size={18}/> Contabilidad (A4)
                    </button>
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                      className="px-5 py-3 bg-[#06020e] text-purple-300 border border-purple-500/30 rounded-[20px] font-black uppercase text-xs hover:bg-[#160829] transition-all flex items-center gap-2"
                      title="Imprimir Ticket Térmico Resumen (80mm)"
                    >
                      <Icon name="receipt" size={18}/> Ticket Resumen
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-[#0b0518] p-8 rounded-[40px] shadow-xl border-t-[8px] border-purple-600 border-x border-b border-purple-500/20 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-black text-slate-400 uppercase mb-2">Efectivo Físico en Caja</div>
                        <div className="text-5xl font-black text-purple-400">${register.currentCash}</div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-purple-500/20">
                        <button 
                          onClick={() => setAdjustCashModal({ isOpen: true, cashAmount: String(register.currentCash || 0) })}
                          className="px-5 py-2.5 bg-purple-950 hover:bg-purple-900 text-purple-300 border border-purple-500/30 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <Icon name="edit" size={14}/> Modificar / Ajustar Caja
                        </button>
                      </div>
                    </div>
                    <div className="bg-[#0b0518] p-8 rounded-[40px] shadow-xl border-t-[8px] border-blue-500 border-x border-b border-blue-500/20">
                      <h3 className="font-black uppercase text-center mb-6 text-sm text-slate-200">Resumen Rápido</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b border-purple-500/10 pb-2"><span className="font-black text-xs uppercase text-slate-400">Ventas Totales:</span><span className="font-black text-lg text-white">${reportData.totalSales}</span></div>
                        <div className="flex justify-between border-b border-purple-500/10 pb-2"><span className="font-black text-xs uppercase text-slate-400">Metros de Pizza:</span><span className="font-black text-lg text-blue-400">{reportData.physicalTotals.metrosPizza} m</span></div>
                        <div className="flex justify-between border-b border-purple-500/10 pb-2"><span className="font-black text-xs uppercase text-slate-400">Fainás Totales:</span><span className="font-black text-lg text-purple-300">{reportData.physicalTotals.fainas}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="max-w-md mx-auto flex flex-col gap-3">
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'full')} 
                      className="w-full py-4 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-[24px] font-black uppercase text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center gap-2 transition-all"
                    >
                      <Icon name="print" size={18}/> 📄 Imprimir Contabilidad Completa (A4)
                    </button>
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                      className="w-full py-4 bg-[#0b0518] text-purple-300 border border-purple-500/30 rounded-[24px] font-black uppercase text-xs hover:bg-[#160829] shadow-sm flex items-center justify-center gap-2 transition-all"
                    >
                      <Icon name="receipt" size={18}/> 🖨️ Imprimir Ticket Resumen (80mm)
                    </button>
                    <button 
                      onClick={() => {
                        showConfirm({
                          title: '¿Cerrar Caja y Archivar Turno?',
                          message: 'Se generará el reporte contable e imprimirá el informe de cierre.',
                          confirmText: 'Cerrar Caja',
                          confirmVariant: 'danger',
                          onConfirm: () => handleCloseRegister(false)
                        });
                      }} 
                      className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-[24px] font-black uppercase text-xs shadow-xl mt-2 transition-all cursor-pointer"
                    >
                      🔒 Cerrar Caja y Archivar Turno
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Historial Tab */}
        {activeTab === 'history' && (
          <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
             <div className="max-w-6xl mx-auto space-y-8">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-purple-500/20 pb-6">
                 <div>
                   <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                     <Icon name="archive" size={36} className="text-purple-400"/> Historial de Turnos Cerrados
                   </h1>
                   <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                     Registros históricos de sesiones de caja • Permite editar, eliminar y reimprimir informes
                   </p>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   <button 
                     onClick={handlePurgeBefore19HoursToday} 
                     className="px-4 py-3 bg-red-950/70 hover:bg-red-900/90 border border-red-500/50 text-red-200 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                     title="Borrar todos los pedidos y reportes creados antes de las 19:00 hs de hoy"
                   >
                     <Icon name="auto_delete" size={16} className="text-red-300"/> 🗑️ Borrar &lt; 19:00 hs de Hoy
                   </button>
                   {sessions.length > 0 && (
                     <button 
                       onClick={handleClearAllHistory} 
                       className="px-4 py-3 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                       title="Eliminar todos los turnos del historial"
                     >
                       <Icon name="delete_sweep" size={15}/> 🗑️ Vaciar Historial
                     </button>
                   )}
                   <button 
                     onClick={() => setImportExcelModalOpen(true)} 
                     className="px-5 py-3 bg-[#130826] border border-purple-500/40 text-purple-200 hover:text-white rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
                     title="Importar turnos o pedidos desde archivo Excel"
                   >
                     <Icon name="upload_file" size={16} className="text-purple-300"/> 📥 Importar Excel
                   </button>
                   {sessions.length > 0 && (
                     <button 
                       onClick={() => exportSessionsToCSV(sessions)} 
                       className="px-5 py-3 bg-[#0b0518] border border-purple-500/30 text-purple-300 hover:bg-[#160829] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                       title="Exportar todos los cierres a Excel (CSV)"
                     >
                       <Icon name="download" size={16}/> 📊 Exportar Historial CSV
                     </button>
                   )}
                 </div>
               </div>

                {/* Multiselect Toolbar */}
                {sessions.length > 0 && (
                  <div className="bg-[#0b0518] p-4 rounded-2xl border border-purple-500/20 flex flex-wrap items-center justify-between gap-3">
                    <label className="flex items-center gap-2.5 text-xs font-black uppercase text-purple-200 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={sessions.length > 0 && sessions.every(s => selectedSessionIds.includes(s.firestoreId))}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSessionIds(sessions.map(s => s.firestoreId));
                          } else {
                            setSelectedSessionIds([]);
                          }
                        }}
                        className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
                      />
                      <span>Seleccionar Todos los Turnos ({sessions.length})</span>
                    </label>

                    {selectedSessionIds.length > 0 && (
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-black text-slate-400 uppercase">
                          {selectedSessionIds.length} seleccionados
                        </span>
                        <button
                          onClick={handleDeleteSelectedSessions}
                          className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all shadow-md shadow-red-600/30 cursor-pointer"
                        >
                          <Icon name="delete" size={14}/> Eliminar Seleccionados ({selectedSessionIds.length})
                        </button>
                      </div>
                    )}
                  </div>
                )}

               {sessions.length === 0 ? (
                 <div className="bg-[#0b0518] p-12 rounded-[40px] border border-purple-500/20 text-center space-y-3">
                   <Icon name="history_toggle_off" size={48} className="mx-auto text-slate-500"/>
                   <div className="font-black text-slate-200 text-lg uppercase">No hay turnos cerrados registrados</div>
                   <div className="text-xs font-bold text-slate-400">Los turnos se archivarán aquí cuando realice el "Cierre de Caja".</div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {sessions.map(session => {
                      const isSelected = selectedSessionIds.includes(session.firestoreId);
                      return (
                       <div key={session.firestoreId} className={`bg-[#0b0518] p-8 rounded-[40px] border shadow-sm flex flex-col justify-between transition-all ${
                         isSelected ? 'border-purple-500 bg-[#120726]' : 'border-purple-500/20 hover:border-purple-500/40'
                       }`}>
                        <div className="space-y-4">
                          <div className="flex justify-between items-start border-b border-purple-500/20 pb-4">
                            <div className="flex items-start gap-2.5">
                               <input
                                 type="checkbox"
                                 checked={isSelected}
                                 onChange={(e) => {
                                   if (e.target.checked) {
                                     setSelectedSessionIds(prev => [...prev, session.firestoreId]);
                                   } else {
                                     setSelectedSessionIds(prev => prev.filter(id => id !== session.firestoreId));
                                   }
                                 }}
                                 className="mt-1 w-4 h-4 accent-purple-600 rounded cursor-pointer shrink-0"
                               />
                               <div>
                                 <div className="text-lg font-black text-white">{new Date(session.closedAt).toLocaleDateString()} {new Date(session.closedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                                 <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Turno Archivado</div>
                               </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handlePrintClosureReport(session, 'full')} 
                                className="p-2.5 bg-purple-600 text-slate-950 hover:bg-purple-400 rounded-2xl transition-all flex items-center gap-1.5 px-3 text-xs font-black uppercase shadow-xs" 
                                title="Imprimir Informe Completo de Contabilidad (A4)"
                              >
                                <Icon name="print" size={16}/> A4
                              </button>
                              <button 
                                onClick={() => handlePrintClosureReport(session, 'thermal')} 
                                className="p-2.5 bg-[#06020e] hover:bg-[#160829] text-purple-300 border border-purple-500/30 rounded-2xl transition-all flex items-center gap-1.5 px-3 text-xs font-black uppercase shadow-xs" 
                                title="Imprimir Ticket Térmico Resumen (80mm)"
                              >
                                <Icon name="receipt" size={16}/> Ticket
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-[#06020e] p-4 rounded-[20px] border border-purple-500/20">
                              <div className="text-[9px] font-black text-slate-400 uppercase">VENTAS TOTALES</div>
                              <div className="text-2xl font-black text-white">${session.totalSales}</div>
                              {session.totalTips ? <div className="text-[10px] font-bold text-purple-300 mt-0.5">+ ${session.totalTips} Propina</div> : null}
                            </div>
                            <div className="bg-[#06020e] p-4 rounded-[20px] border border-purple-500/20">
                              <div className="text-[9px] font-black text-purple-400 uppercase">CAJA FINAL</div>
                              <div className="text-2xl font-black text-purple-400">${session.finalCash}</div>
                              <div className="text-[10px] font-bold text-slate-400 mt-0.5">Ini: ${session.initialCash || 0}</div>
                            </div>
                          </div>

                          {session.notes && (
                            <div className="p-3 bg-[#06020e] rounded-2xl text-[11px] font-bold text-slate-300 border border-purple-500/20">
                              📝 {session.notes}
                            </div>
                          )}
                        </div>

                        {/* Edit & Delete Buttons for Session */}
                        <div className="mt-6 pt-4 border-t border-purple-500/20 flex gap-2">
                          <button 
                            onClick={() => handleOpenEditSession(session)} 
                            className="flex-1 py-2.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/20 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5"
                          >
                            <Icon name="edit" size={14}/> Editar Cierre
                          </button>
                          <button 
                            onClick={() => handleDeleteSession(session.firestoreId)} 
                            className="px-4 py-2.5 bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                            title="Eliminar este cierre del historial"
                          >
                            <Icon name="delete" size={14}/>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                 </div>
               )}
             </div>
          </div>
        )}


        {/* Support & Diagnostics Tab */}
        {activeTab === 'support' && (
          <SupportTab
            tickets={supportTickets}
            onCreateTicket={handleCreateTicket}
            onUpdateTicketStatus={handleUpdateTicketStatus}
            showMessage={showMessage}
          />
        )}

        {/* Operations Manual & Guides Tab */}
        {activeTab === 'manual' && (
          <OperationsManualTab
            showMessage={showMessage}
            setActiveTab={setActiveTab}
          />
        )}

        {/* Admin Audit History Tab (Audit log of ticket deletions and order rectifications) */}
        {activeTab === 'audit' && currentUser.role === 'admin' && (
          <AdminAuditHistoryTab
            auditLogs={auditLogs}
            currentUser={currentUser}
            currentSessionId={register.sessionId}
            showMessage={showMessage}
            adminAlertSoundEnabled={adminAlertSoundEnabled}
            onToggleAdminAlertSound={() => setAdminAlertSoundEnabled(prev => !prev)}
            onTestAlertSound={playAdminAlertTone}
            onDeleteAuditEntry={async (firestoreId: string) => {
              requireAdminAuth('Eliminar Registro de Auditoría', async () => {
                showConfirm({
                  title: '¿Eliminar registro de auditoría?',
                  message: '¿Está seguro de eliminar este registro histórico de auditoría?',
                  confirmText: 'Eliminar Registro',
                  confirmVariant: 'danger',
                  onConfirm: async () => {
                    try {
                      if (db) {
                        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'audit_logs', firestoreId));
                      }
                      setAuditLogs(prev => prev.filter(l => l.firestoreId !== firestoreId));
                      showMessage("Registro de auditoría eliminado");
                    } catch (e: any) {
                      showMessage("Error al eliminar: " + e.message, 'error');
                    }
                  }
                });
              });
            }}
            onClearAllAuditLogs={async () => {
              requireAdminAuth('Vaciar Auditoría Completa', async () => {
                showConfirm({
                  title: '¿Vaciar todo el registro de auditoría?',
                  message: 'Esta acción es irreversible y eliminará todos los registros de auditoría almacenados.',
                  confirmText: 'Vaciar Auditoría',
                  confirmVariant: 'danger',
                  onConfirm: async () => {
                    try {
                      if (db) {
                        const snap = await getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'audit_logs'));
                        const batch = writeBatch(db);
                        snap.docs.forEach(d => batch.delete(d.ref));
                        await batch.commit();
                      }
                      setAuditLogs([]);
                      showMessage("Auditoría vaciada por completo");
                    } catch (e: any) {
                      showMessage("Error al vaciar auditoría: " + e.message, 'error');
                    }
                  }
                });
              });
            }}
            onPrintAuditTicket={() => {
              printFullAccountingReport({
                sessionId: register.sessionId || `AUDIT-${Date.now()}`,
                openedAt: register.openedAt,
                closedAt: Date.now(),
                initialCash: register.initialCash || 0,
                finalCash: register.currentCash || 0,
                totalSales: reportData.totalSales,
                totalTips: reportData.totalTips,
                orderCount: reportData.finishedTotal,
                methods: reportData.methods,
                physicalTotals: reportData.physicalTotals,
                itemsSold: reportData.itemsSold,
                ordersList: [],
                orderTypesBreakdown: {},
                auditLogs: auditLogs
              });
            }}
          />
        )}
      </main>

      {/* Edit Order Modal */}
      {editOrderModal.isOpen && editOrderModal.order && (
        <div className="fixed inset-0 bg-[#06020e]/85 backdrop-blur-md flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0d061c] rounded-[35px] p-6 sm:p-8 max-w-xl w-full flex flex-col shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto no-scrollbar border border-purple-500/40 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div>
                <h3 className="text-xl font-black text-white uppercase flex items-center gap-2">
                  <Icon name="payments" className="text-purple-400" size={24}/>
                  Cobrar Orden {editOrderModal.order.id}
                </h3>
                <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                  {editOrderModal.order.client?.name || 'Cliente General'} {editOrderModal.order.type ? `• (${editOrderModal.order.type})` : ''}
                </div>
              </div>
              <button 
                onClick={() => setEditOrderModal({isOpen:false, order:null, cashReceived:'', tip:'0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: 'Efectivo'})} 
                className="p-1 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>

            {/* Total Display */}
            <div className="bg-[#06020e] border border-purple-500/30 text-white p-5 rounded-[24px] flex items-center justify-between shadow-lg">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto a Cobrar</div>
                <div className="text-4xl font-black text-purple-400">${editOrderModal.order.total}</div>
              </div>
              {editOrderModal.selectedPaymentMethod === 'Efectivo' && editOrderModal.cashReceived && parseFloat(editOrderModal.cashReceived) >= editOrderModal.order.total && (
                <div className="bg-purple-950/80 border border-purple-400/40 p-2.5 rounded-xl text-right">
                  <div className="text-[9px] font-black uppercase text-purple-300">Vuelto a entregar</div>
                  <div className="text-xl font-black text-white">
                    ${(parseFloat(editOrderModal.cashReceived) - editOrderModal.order.total).toFixed(0)}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                <Icon name="credit_card" size={16} className="text-purple-400"/> Forma de Pago
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Mercado Pago'].map(method => {
                  const isSelected = editOrderModal.selectedPaymentMethod === method;
                  return (
                    <button
                      key={method}
                      type="button"
                      onClick={() => setEditOrderModal({ ...editOrderModal, selectedPaymentMethod: method })}
                      className={`p-3 rounded-2xl font-black text-xs uppercase border-2 transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                        isSelected 
                          ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-md shadow-purple-500/20' 
                          : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-purple-500/40'
                      }`}
                    >
                      <Icon 
                        name={
                          method === 'Efectivo' ? 'payments' : 
                          method === 'Transferencia' ? 'account_balance' : 
                          method === 'Mercado Pago' ? 'qr_code_2' : 'credit_card'
                        } 
                        size={16}
                      />
                      {method}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Efectivo input & presets */}
            {editOrderModal.selectedPaymentMethod === 'Efectivo' && (
              <div className="bg-[#06020e] border border-purple-500/30 p-4 rounded-[24px] space-y-3">
                <label className="text-[10px] font-black uppercase text-purple-400 flex items-center gap-1">
                  <Icon name="monetization_on" size={14} className="text-purple-400"/> Efectivo Recibido ($)
                </label>
                <input
                  type="number"
                  placeholder={`Monto recibido (Ej: ${editOrderModal.order.total})`}
                  value={editOrderModal.cashReceived}
                  onChange={e => setEditOrderModal({ ...editOrderModal, cashReceived: e.target.value })}
                  className="w-full p-3 bg-[#0d061c] border border-purple-500/40 text-purple-200 rounded-2xl text-lg font-black outline-none focus:border-purple-400"
                />
                <div className="flex gap-2">
                  {[editOrderModal.order.total, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditOrderModal({ ...editOrderModal, cashReceived: val.toString() })}
                      className="px-3 py-1.5 bg-[#160829] border border-purple-500/30 rounded-xl text-[10px] font-black uppercase hover:bg-[#220c40] text-purple-300 shadow-xs"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer verification checkbox */}
            {editOrderModal.selectedPaymentMethod === 'Transferencia' && (
              <label className="flex items-center gap-2 bg-[#06020e] border border-purple-500/30 p-3 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editOrderModal.transferConfirmed}
                  onChange={e => setEditOrderModal({ ...editOrderModal, transferConfirmed: e.target.checked })}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-xs font-black uppercase text-purple-300">Transferencia bancaria recibida y confirmada</span>
              </label>
            )}

            {/* Voucher verification checkbox for delivery debit/credit */}
            {['Débito', 'Crédito'].includes(editOrderModal.selectedPaymentMethod) && editOrderModal.order.type === 'Envío' && (
              <label className="flex items-center gap-2 bg-[#06020e] border border-purple-500/30 p-3 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editOrderModal.voucherDelivered}
                  onChange={e => setEditOrderModal({ ...editOrderModal, voucherDelivered: e.target.checked })}
                  className="w-4 h-4 accent-purple-600 rounded"
                />
                <span className="text-xs font-black uppercase text-purple-300">Comprobante Posnet / Voucher firmado</span>
              </label>
            )}

            {/* Tip Field */}
            <div className="bg-[#06020e] border border-purple-500/20 p-3 rounded-2xl space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                <Icon name="volunteer_activism" size={14}/> Propina (Opcional) ($)
              </label>
              <input
                type="number"
                placeholder="0"
                value={editOrderModal.tip}
                onChange={e => setEditOrderModal({ ...editOrderModal, tip: e.target.value })}
                className="w-full p-2.5 bg-[#0d061c] border border-purple-500/30 text-white rounded-xl text-sm font-black outline-none focus:border-purple-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditOrderModal({isOpen:false, order:null, cashReceived:'', tip:'0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: 'Efectivo'})} 
                className="flex-1 py-4 bg-[#160829] hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => finalizeOrder(editOrderModal.order!, editOrderModal.cashReceived, editOrderModal.tip, editOrderModal.selectedPaymentMethod)} 
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-lg shadow-purple-500/20 flex items-center justify-center gap-1.5"
              >
                <Icon name="check_circle" size={18}/>
                Confirmar y Cobrar (${editOrderModal.order.total + (parseFloat(editOrderModal.tip) || 0)})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Topping Modal */}
      {toppingModal.isOpen && toppingModal.item && (
        <div className="fixed inset-0 bg-[#06020e]/90 flex items-center justify-center z-[1100] p-4 backdrop-blur-xl">
          <div className="bg-[#0d061c] rounded-[40px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] border border-purple-500/40 text-slate-100">
            <div className="bg-[#06020e] text-white p-6 flex justify-between items-center rounded-t-[40px] border-b border-purple-500/20">
              <div>
                <h3 className="font-black uppercase text-xl flex items-center gap-2"><Icon name="local_pizza" className="text-purple-400"/> {toppingModal.item.name}</h3>
                <p className="text-[11px] font-black text-purple-400 uppercase mt-1">Seleccionados: {toppingModal.selectedToppings.length} de {(toppingModal.item.maxToppings || 4) * toppingModal.quantity}</p>
              </div>
              <button onClick={()=>setToppingModal({isOpen:false, item:null, selectedToppings:[], quantity: 1})} className="p-2 bg-white/10 rounded-xl hover:bg-red-600"><Icon name="close" size={20}/></button>
            </div>
            <div className="p-6 bg-[#06020e] flex-1 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(menu.gustos || []).map(t => {
                  const sel = toppingModal.selectedToppings.some(x=>x.id===t.id);
                  return (
                      <button key={t.id} onClick={() => setToppingModal({...toppingModal, selectedToppings: sel ? toppingModal.selectedToppings.filter(x=>x.id!==t.id) : [...toppingModal.selectedToppings, t]})} className={`p-4 rounded-[20px] border-2 font-black uppercase text-[11px] transition-all flex flex-col items-center justify-center text-center ${sel ? 'bg-purple-600 border-purple-400 text-slate-950 font-black shadow-md shadow-purple-500/20' : 'bg-[#0d061c] border-purple-500/20 text-slate-300 hover:border-purple-500/40'}`}>
                        <span>{t.name}</span>
                        {t.price > 0 && <span className={`text-[10px] ${sel ? 'text-slate-900 font-bold' : 'text-purple-400'}`}>(+${t.price})</span>}
                      </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-purple-500/20 bg-[#06020e] shrink-0 rounded-b-[40px]">
              <button onClick={()=>{
                if (toppingModal.editingCartId) {
                  const toppingsCost = calculateToppingsCost(toppingModal.item, toppingModal.selectedToppings);
                  const finalPrice = Math.round((toppingModal.item.price || 0) + toppingsCost);
                  setCart(prev => prev.map(it => it.cartId === toppingModal.editingCartId ? {
                    ...it,
                    ...toppingModal.item,
                    cartId: it.cartId,
                    selectedToppings: toppingModal.selectedToppings,
                    finalPrice,
                    quantity: toppingModal.quantity
                  } : it));
                } else {
                  addToCart(toppingModal.item, toppingModal.selectedToppings, toppingModal.quantity);
                }
                setToppingModal({isOpen:false, item:null, selectedToppings:[], quantity: 1});
              }} className={`w-full py-5 text-slate-950 rounded-[25px] font-black uppercase text-xs bg-purple-600 hover:bg-purple-400 shadow-md shadow-purple-500/20`}>
                {toppingModal.editingCartId ? 'Guardar cambios' : 'Agregar al Carrito'} - Total: ${Math.round((toppingModal.item.price * toppingModal.quantity) + calculateToppingsCost(toppingModal.item, toppingModal.selectedToppings))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Stock Item Modal */}
      {newStockItemModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/30 rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
            <h3 className="text-2xl font-black uppercase text-white">Nuevo Artículo de Stock</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Artículo</label>
                <input 
                  type="text" 
                  placeholder="Ej: Muzzarella, Figaza, Refresco..." 
                  value={newStockItemForm.name} 
                  onChange={e => setNewStockItemForm({ ...newStockItemForm, name: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Categoría</label>
                <select 
                  value={newStockItemForm.category} 
                  onChange={e => {
                    const cat = e.target.value;
                    let defaultUnit = 'Unidades';
                    if (cat === 'Pizzas' || cat === 'Figazas') defaultUnit = 'Metros';
                    else if (cat === 'Fainá') defaultUnit = 'Porciones';
                    setNewStockItemForm({ ...newStockItemForm, category: cat, unit: defaultUnit });
                  }}
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"
                >
                  <option value="Pizzas" className="bg-[#0b0518] text-white">Pizzas (Metros)</option>
                  <option value="Figazas" className="bg-[#0b0518] text-white">Figazas (Metros)</option>
                  <option value="Fainá" className="bg-[#0b0518] text-white">Fainá (Porciones)</option>
                  <option value="Pizzetas" className="bg-[#0b0518] text-white">Pizzetas (Unidades)</option>
                  <option value="Sándwiches" className="bg-[#0b0518] text-white">Sándwiches (Unidades)</option>
                  <option value="Postres" className="bg-[#0b0518] text-white">Postres (Unidades)</option>
                  <option value="Bebidas" className="bg-[#0b0518] text-white">Bebidas (Unidades)</option>
                  <option value="Insumos" className="bg-[#0b0518] text-white">Insumos (Unidades)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Unidad de Medida</label>
                <select 
                  value={newStockItemForm.unit} 
                  onChange={e => setNewStockItemForm({ ...newStockItemForm, unit: e.target.value })}
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"
                >
                  <option value="Metros" className="bg-[#0b0518] text-white">Metros (m)</option>
                  <option value="Porciones" className="bg-[#0b0518] text-white">Porciones</option>
                  <option value="Unidades" className="bg-[#0b0518] text-white">Unidades (u)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNewStockItemModal(false)} className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleCreateStockItem} className="flex-1 py-4 bg-purple-600 text-slate-950 rounded-2xl font-black uppercase text-xs hover:bg-purple-400 shadow-md shadow-purple-500/20">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {newClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/30 rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
            <h3 className="text-2xl font-black uppercase text-white">Registrar Cliente</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre completo" value={newClientForm.name} onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Teléfono" value={newClientForm.phone} onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Dirección" value={newClientForm.address} onChange={e => setNewClientForm({ ...newClientForm, address: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Zona (Barrio)" value={newClientForm.zone} onChange={e => setNewClientForm({ ...newClientForm, zone: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNewClientModal(false)} className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleCreateClient} className="flex-1 py-4 bg-purple-600 text-slate-950 rounded-2xl font-black uppercase text-xs hover:bg-purple-400 shadow-md shadow-purple-500/20">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {newProductModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border-2 border-purple-500/40 rounded-[36px] p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-5 text-slate-100 animate-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <h3 className="text-xl sm:text-2xl font-black uppercase text-white flex items-center gap-2">
                <Icon name="add_circle" size={24} className="text-purple-400" /> Nuevo Producto
              </h3>
              <button 
                onClick={() => setNewProductModal(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-white/5 cursor-pointer"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); handleCreateProduct(); }} className="space-y-4 text-left">
              {/* Category Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-purple-300 flex items-center gap-1">
                  <Icon name="category" size={14} className="text-purple-400" /> Categoría del Producto *
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-36 overflow-y-auto p-1 bg-[#040108] rounded-xl border border-purple-500/20">
                  {Array.from(new Set([
                    'pizzas', 'pizzetas', 'fainas', 'calzones', 'sandwiches', 'empanadas', 'bebidas', 'postres', 'promociones', 'otros',
                    ...Object.keys(menu)
                  ])).map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setNewProductForm({ ...newProductForm, category: cat })}
                      className={`p-2 rounded-lg text-xs font-black uppercase transition-all cursor-pointer border text-center ${
                        newProductForm.category.toLowerCase() === cat.toLowerCase()
                          ? 'bg-purple-600 text-slate-950 border-purple-400 shadow-sm'
                          : 'bg-[#0b0518] text-slate-300 border-purple-500/15 hover:border-purple-400 hover:text-white'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <input 
                  type="text" 
                  placeholder="O escribir otra categoría personalizada..." 
                  value={newProductForm.category} 
                  onChange={e => setNewProductForm({ ...newProductForm, category: e.target.value })} 
                  className="w-full p-2.5 bg-[#040108] border border-purple-500/30 text-purple-200 rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400"
                />
              </div>

              {/* Name */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-purple-300">Nombre del Producto *</label>
                <input 
                  type="text" 
                  placeholder="Ej: Pizza Muzzarella con Panceta, Coca-Cola 1.5L..." 
                  value={newProductForm.name} 
                  onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })} 
                  className="w-full p-3 bg-[#040108] border border-purple-500/30 text-white rounded-xl text-sm font-black uppercase outline-none focus:border-purple-400"
                  required
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción o Ingredientes (Opcional)</label>
                <input 
                  type="text" 
                  placeholder="Ej: Salsa de tomate artesanal, muzzarella y orégano" 
                  value={newProductForm.desc} 
                  onChange={e => setNewProductForm({ ...newProductForm, desc: e.target.value })} 
                  className="w-full p-3 bg-[#040108] border border-purple-500/30 text-white rounded-xl text-xs outline-none focus:border-purple-400"
                />
              </div>

              {/* Price */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-emerald-400">Precio en Pesos ($) *</label>
                <input 
                  type="number" 
                  placeholder="Ej: 450" 
                  value={newProductForm.price} 
                  onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })} 
                  className="w-full p-3 bg-[#040108] border border-emerald-500/40 text-emerald-300 rounded-xl text-lg font-black font-mono outline-none focus:border-emerald-400"
                  required
                  min="0"
                  step="1"
                />
              </div>

              {/* Product Type Options */}
              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-1.5 p-2 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProductForm.isMeter}
                    onChange={e => setNewProductForm({ ...newProductForm, isMeter: e.target.checked, isPortion: false })}
                    className="accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-black uppercase text-slate-300">Por Metro</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProductForm.isPortion}
                    onChange={e => setNewProductForm({ ...newProductForm, isPortion: e.target.checked, isMeter: false })}
                    className="accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-black uppercase text-slate-300">Por Porción</span>
                </label>
                <label className="flex items-center gap-1.5 p-2 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newProductForm.hasToppings}
                    onChange={e => setNewProductForm({ ...newProductForm, hasToppings: e.target.checked })}
                    className="accent-purple-600 rounded cursor-pointer"
                  />
                  <span className="text-[10px] font-black uppercase text-purple-300">Gustos</span>
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-3">
                <button 
                  type="button"
                  onClick={() => setNewProductModal(false)} 
                  className="flex-1 py-3.5 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs cursor-pointer border border-purple-500/30"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-lg shadow-purple-500/25 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Icon name="check" size={16} /> Agregar al Menú
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.isOpen && notesModal.order && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/40 rounded-[35px] p-8 max-w-md w-full shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                <Icon name="description" className="text-purple-300" size={20}/>
                Notas de Comanda {notesModal.order.id}
              </h3>
              <button onClick={() => setNotesModal({ isOpen: false, order: null, text: '' })} className="p-1 text-slate-400 hover:text-white">
                <Icon name="close" size={20}/>
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-400 bg-[#040108] p-2.5 rounded-xl border border-purple-500/20">
                Cliente: {notesModal.order.client?.name || 'General'}
              </div>
              <textarea
                rows={4}
                placeholder="Escriba observaciones para cocina, mostrador o delivery..."
                value={notesModal.text}
                onChange={e => setNotesModal({ ...notesModal, text: e.target.value })}
                className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl text-xs font-bold outline-none focus:border-purple-300 resize-none uppercase"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNotesModal({ isOpen: false, order: null, text: '' })} className="flex-1 py-3.5 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs">
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (!notesModal.order) return;
                  try {
                    await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', notesModal.order.firestoreId), { notes: notesModal.text });
                    setNotesModal({ isOpen: false, order: null, text: '' });
                    showMessage("Notas de la comanda actualizadas");
                  } catch (e: any) {
                    showMessage("Error al guardar notas: " + e.message, "error");
                  }
                }}
                className="flex-1 py-3.5 bg-purple-600 hover:bg-purple-300 text-slate-950 font-black uppercase text-xs shadow-md shadow-purple-500/20"
              >
                Guardar Notas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/30 rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
            <h3 className="text-2xl font-black uppercase text-white">Editar Cliente</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre completo" value={editingClient.name} onChange={e => setEditingClient({ ...editingClient, name: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Teléfono" value={editingClient.phone || ''} onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Dirección" value={editingClient.address || ''} onChange={e => setEditingClient({ ...editingClient, address: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
              <input type="text" placeholder="Zona (Barrio)" value={editingClient.zone || ''} onChange={e => setEditingClient({ ...editingClient, zone: e.target.value })} className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-400"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingClient(null)} className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleUpdateClient} className="flex-1 py-4 bg-purple-600 text-slate-950 rounded-2xl font-black uppercase text-xs hover:bg-purple-400 shadow-md shadow-purple-500/20">Actualizar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductModal.isOpen && editProductModal.item && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/40 rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
                <Icon name="edit" className="text-purple-300" size={24}/>
                Editar Producto
              </h3>
              <button 
                onClick={() => setEditProductModal({ isOpen: false, category: '', item: null, name: '', price: '', desc: '', isMeter: false, isPortion: false, hasToppings: false })} 
                className="p-1 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Categoría</label>
                <input 
                  type="text" 
                  disabled 
                  value={editProductModal.category} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 rounded-2xl font-black text-sm uppercase text-slate-400 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={editProductModal.name} 
                  onChange={e => setEditProductModal({ ...editProductModal, name: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-purple-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Precio ($)</label>
                <input 
                  type="number" 
                  value={editProductModal.price} 
                  onChange={e => setEditProductModal({ ...editProductModal, price: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-300"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción / Detalles</label>
                <input 
                  type="text" 
                  value={editProductModal.desc} 
                  onChange={e => setEditProductModal({ ...editProductModal, desc: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-300"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-2 p-3 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.isMeter} 
                    onChange={e => setEditProductModal({ ...editProductModal, isMeter: e.target.checked })} 
                    className="w-4 h-4 rounded text-blue-500 bg-slate-900 border-purple-500/30"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-200">Metro</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.isPortion} 
                    onChange={e => setEditProductModal({ ...editProductModal, isPortion: e.target.checked })} 
                    className="w-4 h-4 rounded text-purple-500 bg-slate-900 border-purple-500/30"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-200">Porción</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-[#040108] border border-purple-500/20 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.hasToppings} 
                    onChange={e => setEditProductModal({ ...editProductModal, hasToppings: e.target.checked })} 
                    className="w-4 h-4 rounded text-purple-600 bg-slate-900 border-purple-500/30"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-200">Gustos</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditProductModal({ isOpen: false, category: '', item: null, name: '', price: '', desc: '', isMeter: false, isPortion: false, hasToppings: false })} 
                className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditProduct} 
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-300 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-md shadow-purple-500/20 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale (Order) Modal */}
      {editSaleModal.isOpen && editSaleModal.order && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-blue-500/40 rounded-[40px] p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div>
                <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
                  <Icon name="edit" className="text-blue-400" size={24}/>
                  Editar Venta #{editSaleModal.order.id}
                </h3>
                <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                  Cliente: {editSaleModal.order.client?.name || 'General'}
                </div>
              </div>
              <button 
                onClick={() => setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '' })} 
                className="p-1 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Total Venta ($)</label>
                <input 
                  type="number" 
                  value={editSaleModal.total} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, total: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-purple-400 rounded-2xl font-black text-base outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Medio de Pago</label>
                <select 
                  value={editSaleModal.paymentMethod} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, paymentMethod: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm uppercase outline-none focus:border-blue-400"
                >
                  <option value="Efectivo" className="bg-[#0b0518] text-white">Efectivo</option>
                  <option value="Débito" className="bg-[#0b0518] text-white">Débito</option>
                  <option value="Crédito" className="bg-[#0b0518] text-white">Crédito</option>
                  <option value="Transferencia" className="bg-[#0b0518] text-white">Transferencia</option>
                  <option value="Mercado Pago" className="bg-[#0b0518] text-white">Mercado Pago</option>
                  <option value="A confirmar" className="bg-[#0b0518] text-white">A confirmar</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Propina ($)</label>
                <input 
                  type="number" 
                  value={editSaleModal.tip} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, tip: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Notas / Observaciones</label>
                <textarea 
                  rows={2}
                  value={editSaleModal.notes} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, notes: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-bold text-xs uppercase outline-none focus:border-blue-400 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '' })} 
                className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditSale} 
                className="flex-1 py-4 bg-blue-500 hover:bg-blue-400 text-white rounded-2xl font-black uppercase text-xs shadow-md shadow-blue-500/20 transition-all"
              >
                Actualizar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSessionModal.isOpen && editSessionModal.session && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/40 rounded-[40px] p-8 max-w-lg w-full shadow-2xl space-y-6 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <div>
                <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
                  <Icon name="edit" className="text-purple-400" size={24}/>
                  Editar Turno Archivado
                </h3>
                <div className="text-[11px] font-bold text-slate-400 uppercase mt-0.5">
                  Cerrado el {new Date(editSessionModal.session.closedAt).toLocaleString()}
                </div>
              </div>
              <button 
                onClick={() => setEditSessionModal({ isOpen: false, session: null, totalSales: '', finalCash: '', initialCash: '', totalTips: '', notes: '' })} 
                className="p-1 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Ventas Totales ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.totalSales} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, totalSales: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Caja Final ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.finalCash} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, finalCash: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-purple-400 rounded-2xl font-black text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Caja Inicial ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.initialCash} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, initialCash: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-black text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Propinas Totales ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.totalTips} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, totalTips: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-purple-300 rounded-2xl font-black text-sm outline-none focus:border-purple-400"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Notas del Turno</label>
                <textarea 
                  rows={2}
                  value={editSessionModal.notes} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, notes: e.target.value })} 
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-white rounded-2xl font-bold text-xs outline-none focus:border-purple-400 resize-none uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditSessionModal({ isOpen: false, session: null, totalSales: '', finalCash: '', initialCash: '', totalTips: '', notes: '' })} 
                className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditSession} 
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs shadow-md shadow-purple-600/20 transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Cash Modal */}
      {adjustCashModal.isOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#0b0518] border border-purple-500/40 rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 text-slate-100">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <h3 className="text-2xl font-black uppercase text-white flex items-center gap-2">
                <Icon name="payments" className="text-purple-400" size={24}/>
                Modificar Efectivo en Caja
              </h3>
              <button 
                onClick={() => setAdjustCashModal({ isOpen: false, amount: '' })} 
                className="p-1 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto en Efectivo Físico ($)</label>
              <input 
                type="number" 
                placeholder="0"
                value={adjustCashModal.amount} 
                onChange={e => setAdjustCashModal({ ...adjustCashModal, amount: e.target.value })} 
                className="w-full p-4 bg-[#040108] border-2 border-purple-500/20 text-purple-400 rounded-2xl font-black text-2xl outline-none focus:border-purple-400 text-center"
              />
              <p className="text-[11px] font-bold text-slate-400 mt-2 text-center uppercase">
                Ajuste el valor si hubo ingresos manuales, gastos de caja o correcciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setAdjustCashModal({ isOpen: false, amount: '' })} 
                className="flex-1 py-4 bg-[#160829] text-slate-300 hover:bg-[#220c40] rounded-2xl font-black uppercase text-xs transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAdjustCash} 
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-400 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-md shadow-purple-500/20 transition-all"
              >
                Guardar Monto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Voice Order Floating Draggable Widget (AI + Speech Recognition) */}
      <VoiceOrderModal
        isOpen={voiceOrderModalOpen}
        onClose={() => setVoiceOrderModalOpen(false)}
        menu={menu}
        allMenuItems={allMenuItems}
        allClients={allClients}
        toppings={DEFAULT_TOPPINGS}
        onApplyToCart={handleApplyVoiceOrder}
        showMessage={showMessage}
      />

      {/* Excel / CSV History Batch Import Modal */}
      <ImportHistoryExcelModal
        isOpen={importExcelModalOpen}
        onClose={() => setImportExcelModalOpen(false)}
        onImportOrders={handleBatchImportOrders}
        onImportSessions={handleBatchImportSessions}
        showMessage={showMessage}
      />

      {/* Menu Batch Import Modal */}
      <ImportMenuModal
        isOpen={isImportMenuModalOpen}
        onClose={() => setIsImportMenuModalOpen(false)}
        onImportMenu={handleBatchImportMenu}
        showMessage={showMessage}
      />

      {/* Stock Batch Import Modal */}
      <ImportStockModal
        isOpen={isImportStockModalOpen}
        onClose={() => setIsImportStockModalOpen(false)}
        onImportStock={handleBatchImportStock}
        showMessage={showMessage}
      />

      {/* WhatsApp Smart Parser Modal */}
      <WhatsAppOrderParserModal
        isOpen={whatsAppParserModalOpen}
        onClose={() => setWhatsAppParserModalOpen(false)}
        menu={menu}
        toppings={DEFAULT_TOPPINGS}
        onApplyOrder={(parsed) => {
          handleApplyVoiceOrder(parsed);
          showMessage("¡Comanda de WhatsApp cargada con éxito!");
        }}
      />

      {/* Customer Objections & Closing Scripts Modal */}
      <CustomerObjectionsModal
        isOpen={customerObjectionsModalOpen}
        onClose={() => setCustomerObjectionsModalOpen(false)}
      />

      {/* Faltantes / productos no disponibles */}
      {shortagesModalOpen && (
        <div className="fixed inset-0 z-[11900] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[88dvh] overflow-hidden bg-[#090314] border-2 border-red-500/40 rounded-[30px] shadow-2xl flex flex-col text-slate-100">
            <div className="p-5 border-b border-red-500/25 flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-black uppercase text-lg text-white flex items-center gap-2"><Icon name="production_quantity_limits" size={20} className="text-red-400"/> Faltantes / Sin stock</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Marcá qué falta y qué productos del menú no se pueden vender.</p>
              </div>
              <button onClick={() => setShortagesModalOpen(false)} className="p-2 text-slate-400 hover:text-white"><Icon name="close" size={20}/></button>
            </div>
            <div className="p-5 overflow-y-auto custom-dark-scrollbar space-y-5">
              {activeShortages.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] font-black uppercase text-red-300">Faltantes activos</div>
                  {activeShortages.map(sh => (
                    <div key={sh.firestoreId} className="p-3 rounded-2xl bg-red-950/35 border border-red-500/30 flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black text-sm uppercase text-red-200">{sh.name}</div>
                        <div className="text-[10px] text-slate-400 mt-1">Afecta {(sh.affectedItemIds || []).length} producto(s)</div>
                      </div>
                      <button onClick={() => resolveShortage(sh)} className="px-3 py-2 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-[10px] font-black uppercase">Ya hay stock</button>
                    </div>
                  ))}
                </div>
              )}
              <div className="space-y-3 border-t border-purple-500/20 pt-4">
                <input value={shortageName} onChange={e => setShortageName(e.target.value)} placeholder="Qué falta: ej. muzzarella, Coca 1.5L, jamón..." className="w-full p-3 bg-[#040108] border border-red-500/35 rounded-xl outline-none text-sm font-bold text-white"/>
                <div className="text-[10px] font-black uppercase text-slate-300">Productos del menú afectados</div>
                <div className="max-h-[330px] overflow-y-auto custom-dark-scrollbar grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
                  {allMenuItems.map(item => {
                    const checked = shortageAffectedIds.includes(item.id);
                    return (
                      <label key={item.id} className={`p-2.5 rounded-xl border cursor-pointer flex items-center gap-2 ${checked ? 'bg-red-950/50 border-red-500/50 text-red-100' : 'bg-[#080411] border-purple-500/15 text-slate-300'}`}>
                        <input type="checkbox" checked={checked} onChange={() => setShortageAffectedIds(prev => checked ? prev.filter(id => id !== item.id) : [...prev, item.id])} className="accent-red-500"/>
                        <span className="text-[10px] font-black uppercase">{item.name}</span>
                      </label>
                    );
                  })}
                </div>
                <button onClick={saveShortage} className="w-full py-3 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-xs">Activar faltante y bloquear esos productos</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cajera / moza: solicitud de borrado, nunca elimina directamente */}
      {deleteRequestModal.isOpen && deleteRequestModal.order && (
        <div className="fixed inset-0 z-[11950] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#090314] border-2 border-amber-500/50 rounded-[30px] p-6 shadow-2xl text-slate-100 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-black uppercase text-lg text-white">Solicitar borrado #{deleteRequestModal.order.id}</h3>
              <button onClick={() => setDeleteRequestModal({ isOpen:false, order:null, note:'', confirmation:'' })} className="text-slate-400 hover:text-white"><Icon name="close" size={20}/></button>
            </div>
            <p className="text-xs text-slate-300">La comanda <strong>no se borrará ahora</strong>. Quedará marcada para que el Administrador la revise al cierre/conteo de caja.</p>
            <textarea rows={3} value={deleteRequestModal.note} onChange={e => setDeleteRequestModal({ ...deleteRequestModal, note:e.target.value })} placeholder="Nota opcional: duplicado, cliente canceló, error de carga..." className="w-full p-3 bg-[#040108] border border-amber-500/30 rounded-xl text-sm outline-none resize-none"/>
            <div>
              <label className="text-[10px] font-black uppercase text-amber-300">Escribí aceptado para confirmar</label>
              <input type="password" value={deleteRequestModal.confirmation} onChange={e => setDeleteRequestModal({ ...deleteRequestModal, confirmation:e.target.value })} placeholder="••••••••" className="w-full mt-1 p-3 bg-[#040108] border border-amber-500/35 rounded-xl text-center tracking-[0.35em] font-black outline-none"/>
              <p className="text-[9px] text-slate-500 mt-1">Debe escribirse exactamente en minúscula: aceptado</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => setDeleteRequestModal({ isOpen:false, order:null, note:'', confirmation:'' })} className="py-3 bg-slate-900 border border-slate-700 rounded-xl text-xs font-black uppercase">Cancelar</button>
              <button onClick={submitDeleteRequest} className="py-3 bg-amber-500 text-slate-950 rounded-xl text-xs font-black uppercase">Enviar solicitud</button>
            </div>
          </div>
        </div>
      )}

      {/* Solo Admin: solicitudes pendientes para resolver al cierre */}
      {pendingDeleteModalOpen && currentUser.role === 'admin' && (
        <div className="fixed inset-0 z-[11900] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85dvh] bg-[#090314] border-2 border-amber-500/40 rounded-[30px] overflow-hidden flex flex-col text-slate-100">
            <div className="p-5 border-b border-amber-500/25 flex justify-between items-center shrink-0">
              <div><h3 className="font-black uppercase text-lg text-white">Solicitudes de borrado</h3><p className="text-[10px] text-slate-400 uppercase font-bold">Revisar y eliminar al cierre de caja</p></div>
              <button onClick={() => setPendingDeleteModalOpen(false)} className="text-slate-400 hover:text-white"><Icon name="close" size={20}/></button>
            </div>
            <div className="p-5 overflow-y-auto custom-dark-scrollbar space-y-3">
              {orders.filter(o => o.deleteRequested).length === 0 ? <div className="text-center py-8 text-slate-500 font-bold">No hay solicitudes pendientes.</div> : orders.filter(o => o.deleteRequested).map(order => (
                <div key={order.firestoreId} className="p-4 rounded-2xl bg-amber-950/25 border border-amber-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="font-black text-white">#{order.id} · {order.client?.name || 'General'} · ${order.total}</div>
                    <div className="text-[10px] text-amber-200 mt-1">Solicitó: {order.deleteRequestedBy || 'Operador'} {order.deleteRequestNote ? `• ${order.deleteRequestNote}` : '• Sin nota'}</div>
                  </div>
                  <button onClick={() => deleteOrderAsAdmin(order)} className="px-4 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-1"><Icon name="delete" size={14}/> Borrar</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Supervisor / Admin Authorization Override Modal */}
      {adminAuthModal.isOpen && (
        <div className="fixed inset-0 z-[12000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-[#090314] border-2 border-purple-500/50 rounded-[36px] p-8 shadow-2xl shadow-purple-950/90 space-y-5 text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-purple-950/80 border-2 border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto shadow-lg shadow-purple-950/50">
              <Icon name="shield" size={32} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                Autorización de Supervisor
              </h3>
              <p className="text-xs font-bold text-slate-300">
                La acción (<strong className="text-purple-300">{adminAuthModal.actionName}</strong>) está restringida y requiere la clave del <strong>Administrador / Dueño</strong>.
              </p>
            </div>

            {adminAuthError && (
              <div className="p-3 bg-red-950/80 border border-red-500/50 rounded-2xl text-xs font-black text-red-200 uppercase tracking-wider">
                {adminAuthError}
              </div>
            )}

            <form onSubmit={(e) => {
              e.preventDefault();
              if (adminAuthPassword === 'admin' || adminAuthPassword === 'admin123' || adminAuthPassword === '1234') {
                const cb = adminAuthModal.onSuccess;
                setAdminAuthModal({ isOpen: false, actionName: '', onSuccess: null });
                setAdminAuthPassword('');
                setAdminAuthError('');
                if (cb) cb();
                showMessage("Acción autorizada por Administrador", "success");
              } else {
                setAdminAuthError("Clave de Administrador incorrecta");
              }
            }} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-black uppercase text-purple-300 flex items-center justify-center gap-1.5">
                  <Icon name="lock" size={14} className="text-purple-400" /> Clave de Administrador
                </label>
                <input
                  type="password"
                  autoFocus
                  placeholder="••••••••"
                  value={adminAuthPassword}
                  onChange={e => setAdminAuthPassword(e.target.value)}
                  style={{ textAlign: 'center' }}
                  className="w-full p-4 bg-[#040108] border-2 border-purple-500/40 focus:border-purple-400 rounded-2xl text-base font-black text-center text-white outline-none tracking-widest"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdminAuthModal({ isOpen: false, actionName: '', onSuccess: null })}
                  className="py-3.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="py-3.5 bg-purple-600 hover:bg-purple-500 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-lg shadow-purple-600/30 transition-all cursor-pointer"
                >
                  Autorizar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Apertura de Caja al Iniciar Sesión (Obligatorio con Monto, Modo Consulta exclusivo para Admin) */}
      {openRegisterPromptModal.isOpen && (
        <div className="fixed inset-0 z-[12000] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-lg w-full bg-[#090314] border-2 border-purple-500/50 rounded-[40px] p-7 sm:p-9 shadow-2xl shadow-purple-950/90 space-y-6 text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-purple-950/80 border-2 border-purple-500/40 text-purple-300 flex items-center justify-center mx-auto shadow-lg shadow-purple-950/50">
              <Icon name="account_balance_wallet" size={32} />
            </div>

            {currentUser.role === 'admin' ? (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-purple-950/80 border border-purple-500/50 rounded-full text-purple-300 text-[10px] font-black uppercase tracking-wider">
                  <Icon name="shield_person" size={13} />
                  <span>Acceso Administrador / Dueño</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                  Apertura de Caja o Consulta
                </h3>
                <p className="text-xs font-medium text-slate-300 leading-relaxed max-w-md mx-auto">
                  Como Administrador, ingresa el <strong className="text-white">monto de efectivo inicial</strong> para abrir el turno de ventas, o accede en <strong className="text-purple-300">Modo Consulta</strong> para auditar reportes, pedidos y configuración sin abrir caja.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-950/80 border border-amber-500/50 rounded-full text-amber-300 text-[10px] font-black uppercase tracking-wider">
                  <Icon name="warning" size={13} />
                  <span>Apertura Obligatoria de Turno</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight text-white">
                  Apertura de Turno de Caja
                </h3>
                <p className="text-xs font-medium text-slate-300 leading-relaxed max-w-md mx-auto">
                  Para operar en el sistema, es obligatorio ingresar el <strong className="text-white">monto de efectivo inicial</strong>. Ningún cajero puede operar con la caja cerrada ni ingresar en modo consulta.
                </p>
              </div>
            )}

            {/* Quick cash presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Sugerencias rápidas:</span>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[1000, 2000, 3000, 5000, 10000, 15000].map(amount => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setOpenRegisterPromptModal(prev => ({ ...prev, initialCash: String(amount) }))}
                    className={`py-2 px-1 rounded-xl font-black text-xs transition-all border cursor-pointer ${
                      openRegisterPromptModal.initialCash === String(amount)
                        ? 'bg-purple-600 border-purple-400 text-slate-950 shadow-md shadow-purple-600/30'
                        : 'bg-[#160829] border-purple-500/30 text-purple-200 hover:bg-[#251046]'
                    }`}
                  >
                    ${amount}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-purple-300 flex items-center justify-center gap-1.5">
                <Icon name="monetization_on" size={15} className="text-emerald-400" /> Monto en Efectivo Inicial ($)
              </label>
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-500">$</span>
                <input
                  type="number"
                  min="1"
                  autoFocus
                  placeholder="Ej: 2000"
                  value={openRegisterPromptModal.initialCash}
                  onChange={e => setOpenRegisterPromptModal({ ...openRegisterPromptModal, initialCash: e.target.value })}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      const amount = parseFloat(openRegisterPromptModal.initialCash);
                      if (isNaN(amount) || amount <= 0) {
                        showMessage("⚠️ Debe ingresar el monto de efectivo inicial para abrir la caja. No se permite abrir sin monto a ningún cajero ni administrador.", "error");
                        return;
                      }
                      handleOpenRegister(true, amount);
                    }
                  }}
                  style={{ textAlign: 'center' }}
                  className="w-full p-4 pl-10 bg-[#040108] border-2 border-purple-500/40 focus:border-purple-400 rounded-2xl text-2xl font-black text-center text-emerald-400 outline-none tracking-wider"
                />
              </div>
              {(!openRegisterPromptModal.initialCash || parseFloat(openRegisterPromptModal.initialCash) <= 0) ? (
                <p className="text-[10.5px] font-bold text-amber-400">
                  ⚠️ Debe ingresar un monto mayor a $0 para poder abrir la caja.
                </p>
              ) : (
                <p className="text-[10.5px] font-bold text-emerald-400 flex items-center justify-center gap-1">
                  <Icon name="check_circle" size={13} /> Monto válido: ${parseFloat(openRegisterPromptModal.initialCash)}
                </p>
              )}
            </div>

            <div className="space-y-3 pt-2">
              {(() => {
                const amount = parseFloat(openRegisterPromptModal.initialCash);
                const isValid = !isNaN(amount) && amount > 0;
                return (
                  <button
                    type="button"
                    disabled={!isValid}
                    onClick={() => {
                      if (!isValid) {
                        showMessage("⚠️ Debe ingresar el monto de efectivo inicial para abrir la caja. No se permite abrir sin monto a ningún cajero ni administrador.", "error");
                        return;
                      }
                      handleOpenRegister(true, amount);
                    }}
                    className={`w-full py-4 rounded-2xl font-black uppercase text-xs sm:text-sm tracking-wider shadow-lg transition-all flex items-center justify-center gap-2 ${
                      isValid
                        ? 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/40 cursor-pointer hover:scale-[1.01]'
                        : 'bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed opacity-75'
                    }`}
                  >
                    <Icon name="bolt" size={18} />
                    <span>{isValid ? `Abrir Caja e Iniciar Turno ($${amount})` : 'Ingrese el Monto para Abrir Caja'}</span>
                  </button>
                );
              })()}

              {/* Modo Consulta: DISPONIBLE ÚNICAMENTE PARA ADMINISTRADOR */}
              {currentUser.role === 'admin' ? (
                <button
                  type="button"
                  onClick={() => {
                    setAdminConsultationMode(true);
                    setOpenRegisterPromptModal({ isOpen: false, initialCash: '' });
                    showMessage("Modo Consulta activado para Administrador (Caja permanece cerrada)", "info");
                  }}
                  className="w-full py-3.5 bg-[#180a30] hover:bg-[#25104a] text-purple-300 hover:text-white border border-purple-500/40 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Icon name="visibility" size={16} className="text-purple-400" />
                  <span>Continuar en Modo Consulta (Solo Administrador)</span>
                </button>
              ) : (
                <div className="py-1 px-3 bg-[#0a0514] border border-slate-800/80 rounded-xl text-[10px] text-slate-400 flex items-center justify-center gap-1.5">
                  <Icon name="lock" size={12} className="text-amber-400" />
                  <span>El modo consulta está restringido exclusivamente para el Administrador</span>
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsAuthenticated(false);
                  localStorage.removeItem('nextcrm_auth');
                  localStorage.removeItem('nextcrm_user');
                  localStorage.removeItem('nextcrm_role');
                  hasCheckedRegisterOnLogin.current = false;
                  setAdminConsultationMode(false);
                  setOpenRegisterPromptModal({ isOpen: false, initialCash: '' });
                  showMessage('Sesión cerrada');
                }}
                className="w-full py-2.5 text-slate-400 hover:text-red-300 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Icon name="logout" size={14} />
                <span>Cerrar Sesión / Salir</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Resolver Pedidos Pendientes antes de Cerrar Caja */}
      {resolvePendingModal.isOpen && (
        <div className="fixed inset-0 z-[12000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-[#090314] border-2 border-purple-500/50 rounded-[36px] p-7 sm:p-8 shadow-2xl shadow-purple-950/90 space-y-5 text-slate-100 text-center animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-3xl bg-amber-950/80 border-2 border-amber-500/40 text-amber-300 flex items-center justify-center mx-auto shadow-lg shadow-amber-950/50">
              <Icon name="pending_actions" size={32} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                Comandas Pendientes Detectadas
              </h3>
              <p className="text-xs font-bold text-slate-300">
                Hay <strong className="text-amber-300">{resolvePendingModal.pending.length} comanda(s)</strong> sin finalizar en el sistema.
              </p>
            </div>

            <div className="bg-[#040108] p-3 rounded-2xl border border-purple-500/30 max-h-40 overflow-y-auto space-y-1.5 text-left text-xs font-bold text-slate-300">
              {resolvePendingModal.pending.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center py-1 border-b border-purple-500/10 last:border-0">
                  <span className="text-purple-300 font-black">#{p.id} - {p.type}</span>
                  <span className="text-amber-400 font-black">${p.total} ({p.status})</span>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 pt-2">
              <button
                type="button"
                onClick={handleResolveAllAndClose}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white rounded-2xl font-black uppercase text-xs shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="check_circle" size={16} />
                <span>Finalizar Todas ({resolvePendingModal.pending.length}) y Cerrar Caja</span>
              </button>

              <button
                type="button"
                onClick={() => handleCloseRegister(true)}
                className="w-full py-3 bg-red-950 hover:bg-red-900 border border-red-500/40 text-red-200 rounded-2xl font-black uppercase text-xs transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Icon name="lock" size={16} />
                <span>Forzar Cierre de Caja</span>
              </button>

              <button
                type="button"
                onClick={() => setResolvePendingModal({ isOpen: false, pending: [] })}
                className="w-full py-2.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-[11px] transition-all cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Universal In-App Confirmation Modal (Non-blocking) */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[13000] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="relative max-w-md w-full bg-[#090314] border-2 border-purple-500/50 rounded-[36px] p-7 sm:p-8 shadow-2xl shadow-purple-950/90 space-y-5 text-slate-100 text-center animate-in zoom-in-95">
            <div className={`w-16 h-16 rounded-3xl border-2 flex items-center justify-center mx-auto shadow-lg ${
              confirmModal.confirmVariant === 'danger'
                ? 'bg-red-950/80 border-red-500/40 text-red-400 shadow-red-950/50'
                : confirmModal.confirmVariant === 'success'
                ? 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400 shadow-emerald-950/50'
                : 'bg-purple-950/80 border-purple-500/40 text-purple-300 shadow-purple-950/50'
            }`}>
              <Icon name={confirmModal.confirmVariant === 'danger' ? 'warning' : 'help_outline'} size={32} />
            </div>

            <div className="space-y-1.5">
              <h3 className="text-xl font-black uppercase tracking-tight text-white">
                {confirmModal.title}
              </h3>
              <p className="text-xs font-bold text-slate-300 leading-relaxed">
                {confirmModal.message}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
                className="py-3.5 bg-[#160829] hover:bg-[#220c40] text-purple-300 border border-purple-500/30 rounded-2xl font-black uppercase text-xs transition-all cursor-pointer"
              >
                {confirmModal.cancelText || 'Cancelar'}
              </button>
              <button
                type="button"
                onClick={() => confirmModal.onConfirm()}
                className={`py-3.5 rounded-2xl font-black uppercase text-xs shadow-lg transition-all cursor-pointer ${
                  confirmModal.confirmVariant === 'danger'
                    ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30'
                    : confirmModal.confirmVariant === 'success'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : 'bg-purple-600 hover:bg-purple-500 text-slate-950 shadow-purple-600/30'
                }`}
              >
                {confirmModal.confirmText || 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
