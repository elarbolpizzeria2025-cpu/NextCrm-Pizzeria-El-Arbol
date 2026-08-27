import React, { useState, useEffect, useMemo, useRef } from 'react';
import { signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { doc, setDoc, collection, onSnapshot, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';

import { auth, db, firebaseErrorMsg, appId } from './firebase';
import { 
  MenuItem, CartItem, ClientData, OrderData, StockItem, RegisterConfig, SessionData, ChatMessage,
  DgiConfig, CfeDocument, SupportTicket
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
import { Icon } from './components/Icon';
import { OrderCard } from './components/OrderCard';
import { KdsMonitor } from './components/KdsMonitor';
import { VoiceOrderModal } from './components/VoiceOrderModal';
import { PosWizard } from './components/PosWizard';
import { ToppingModal } from './components/ToppingModal';
import { CrmClientsTab } from './components/CrmClientsTab';
import { DgiBillingTab } from './components/DgiBillingTab';
import { SupportTab } from './components/SupportTab';
import { DEFAULT_DGI_CONFIG, createCfeDocumentFromOrder } from './utils/dgiCfe';
import { ParsedVoiceOrder } from './utils/voiceOrderParser';

export default function App() {
  const [activeTab, setActiveTab] = useState('kitchen');
  const [posStep, setPosStep] = useState<1 | 2 | 3>(1);
  const [voiceOrderModalOpen, setVoiceOrderModalOpen] = useState(false);
  const [showKdsFullscreenModal, setShowKdsFullscreenModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [clients, setClients] = useState<ClientData[]>([]);
  const [sessions, setSessions] = useState<SessionData[]>([]);
  const [register, setRegister] = useState<RegisterConfig>({ 
    isOpen: false, initialCash: 0, currentCash: 0, sessionId: null, isLoaded: false, currentStock: {}, initialStock: {} 
  });
  const [stockItems, setStockItems] = useState<StockItem[]>([]); 
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
  const [clientInfo, setClientInfo] = useState({ phone: '', name: '', address: '', zone: '' });
  const [paymentMethod, setPaymentMethod] = useState('Efectivo');
  const [cashProvided, setCashProvided] = useState(''); 
  const [orderNotes, setOrderNotes] = useState(''); 
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [initialCashInput, setInitialCashInput] = useState('');
  const [initialStockInput, setInitialStockInput] = useState<Record<string, string>>({});
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledTime, setScheduledTime] = useState('');

  const [toppingModal, setToppingModal] = useState<{ isOpen: boolean; item: any; selectedToppings: any[]; quantity: number }>({ 
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
    cashAmount: string;
  }>({
    isOpen: false,
    cashAmount: ''
  });

  const [finishedFilter, setFinishedFilter] = useState({ search: '', method: 'TODOS', type: 'TODOS' });

  // Stock Modals
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
    header: 'bg-[#05080e] border-b border-slate-800',
    logoBorder: 'border-blue-500',
    tabActiveBg: 'bg-[#0e1724]',
    tabActiveText: 'text-blue-400',
    tabActiveBorder: 'border-blue-500',
    priceText: 'text-blue-400',
    cardBorderHover: 'hover:border-blue-500',
    btnBg: 'bg-blue-600 hover:bg-blue-500 text-white',
    btnBgHover: 'hover:bg-blue-500',
    accentBgHover: 'group-hover:bg-blue-500/10',
    ringPrimary: 'focus:border-blue-500',
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
      }));
    }
    if (parsed.notes) {
      setOrderNotes(prev => prev ? `${prev}, ${parsed.notes}` : (parsed.notes || ''));
    }
    setActiveTab('pos');
    if (parsed.paymentMethod || parsed.cashProvided) {
      setPosStep(3);
    } else if (parsed.client?.name || parsed.client?.address || parsed.destination) {
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

    // Stock Items listener with auto-seed default items if empty & legacy category migration
    const unsubStock = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'stockItems'), (s) => {
      const items = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id }));
      if (items.length === 0) {
        const defaults = [
          { name: 'Pizza', category: 'Pizzas', unit: 'Metros' },
          { name: 'Figaza', category: 'Figazas', unit: 'Metros' },
          { name: 'Fainá', category: 'Fainá', unit: 'Porciones' },
          { name: 'Pizzeta', category: 'Pizzetas', unit: 'Unidades' },
          { name: 'Sándwich Caliente', category: 'Sándwiches', unit: 'Unidades' },
          { name: 'Flan Casero', category: 'Postres', unit: 'Unidades' },
          { name: 'Postre Chajá', category: 'Postres', unit: 'Unidades' },
          { name: 'Refresco 600ml', category: 'Bebidas', unit: 'Unidades' },
          { name: 'Refresco 1.5L', category: 'Bebidas', unit: 'Unidades' },
          { name: 'Cerveza 1L', category: 'Bebidas', unit: 'Unidades' },
          { name: 'Agua Mineral', category: 'Bebidas', unit: 'Unidades' }
        ];
        defaults.forEach(def => {
          addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'stockItems'), def);
        });
      } else {
        items.forEach(item => {
          if (item.category === 'Pizzas/Fainás' || item.category === 'Pizzas/Fainas') {
            const nameL = (item.name || '').toLowerCase();
            let newCat = 'Pizzas';
            let newUnit = 'Metros';
            if (nameL.includes('fainá') || nameL.includes('faina')) { newCat = 'Fainá'; newUnit = 'Porciones'; }
            else if (nameL.includes('figaza')) { newCat = 'Figazas'; newUnit = 'Metros'; }
            else if (nameL.includes('pizzeta')) { newCat = 'Pizzetas'; newUnit = 'Unidades'; }
            updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', item.firestoreId), { category: newCat, unit: newUnit });
          }
        });
        setStockItems(items);
      }
    }, console.error);

    const unsubOrders = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'orders'), (s) => {
      const fetchedOrders = s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })).sort((a,b) => b.createdAt - a.createdAt);
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
      setSessions(s.docs.map(d => ({ ...(d.data() as any), firestoreId: d.id })).sort((a,b) => b.closedAt - a.closedAt));
    }, console.error);

    const unsubMenu = onSnapshot(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), (s) => {
      if (s.exists() && s.data().data) { setMenu(s.data().data); } else { setMenu(DEFAULT_MENU); }
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

    return () => { 
      unsubOrders(); 
      unsubClients(); 
      unsubReg(); 
      unsubSessions(); 
      unsubMenu(); 
      unsubStock(); 
      unsubDgiConfig();
      unsubCfeDocs();
      unsubTickets();
    };
  }, [user?.uid, forceReconnect]);

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
    const clientList: ClientData[] = []; 
    const seenPhones = new Set<string>(); 
    const seenNames = new Set<string>();
    clients.forEach(c => {
        clientList.push(c);
        if (c.phone && String(c.phone).trim() !== '') seenPhones.add(String(c.phone).trim().replace(/\D/g, ''));
        if (c.name && String(c.name).trim() !== '') seenNames.add(String(c.name).trim().toLowerCase());
    });
    orders.forEach(o => {
        if (!o.client) return;
        const rawName = String(o.client.name || '').trim(); 
        const rawPhone = String(o.client.phone || '').trim();
        if (rawName === '' && rawPhone === '') return;
        if (rawName.toLowerCase() === 'sin nombre' && (rawPhone === 'N/A' || rawPhone === '')) return;
        if (rawName.toLowerCase() === 'general' && (rawPhone === 'N/A' || rawPhone === '')) return;
        if (rawName.toLowerCase().startsWith('mesa ')) return; 
        const cleanPhone = rawPhone.replace(/\D/g, ''); 
        const cleanName = rawName.toLowerCase();
        const matchPhone = cleanPhone !== '' && seenPhones.has(cleanPhone);
        const matchName = cleanName !== '' && cleanName !== 'sin nombre' && seenNames.has(cleanName);
        if (!matchPhone && !matchName) {
            clientList.push({ 
              firestoreId: `virtual-${o.id}-${Math.random()}`, 
              name: rawName || 'Sin Nombre', 
              phone: rawPhone === 'N/A' ? '' : rawPhone, 
              address: o.client.address || '', 
              zone: o.client.zone || '', 
              isVirtual: true 
            });
            if (cleanPhone) seenPhones.add(cleanPhone); 
            if (cleanName && cleanName !== 'sin nombre') seenNames.add(cleanName);
        }
    });
    return clientList.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [clients, orders]);

  const matchingClients = useMemo(() => {
    const q = (clientInfo.name + ' ' + clientInfo.phone + ' ' + clientInfo.address).toLowerCase().trim();
    if (!q) return [];
    return allClients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      const address = (c.address || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || address.includes(q);
    }).slice(0, 6);
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
        delivery: currentOrders.filter(o => o.status === 'Pendiente' && ['envío', 'envio', 'delivery'].includes(sType(o.type))), 
        mostrador: currentOrders.filter(o => o.status === 'Pendiente' && ['local', 'mostrador'].includes(sType(o.type))), 
        mesas: currentOrders.filter(o => o.status === 'Pendiente' && sType(o.type) === 'mesa'), 
        web: currentOrders.filter(o => o.status === 'Pendiente' && ['web', 'pedido web'].includes(sType(o.type))), 
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

  const badges = useMemo(() => ({ 
    kitchen: reportData.kitchenTotal, 
    mostrador: reportData.mostrador.length, 
    mesas: reportData.mesas.length, 
    delivery: reportData.delivery.length, 
    web: reportData.web.length, 
    finished: reportData.finishedTotal, 
    stock: lowStockAlerts.length 
  }), [reportData, lowStockAlerts.length]);

  const addToCart = (item: MenuItem, selectedToppings: any[], initialQty = 1) => {
    const toppingsCost = calculateToppingsCost(item, selectedToppings);
    const finalPrice = item.price + (toppingsCost / initialQty);
    setCart([...cart, { ...item, cartId: Math.random().toString(36).substr(2,9), selectedToppings, finalPrice, quantity: initialQty }]);
  };

  const updateQuantity = (cartId: string, delta: number) => { 
    setCart(cart.map(it => { 
      if (it.cartId === cartId) { 
        const newQ = (it.quantity || 1) + delta; 
        if (newQ > 0) return { ...it, quantity: newQ }; 
      } 
      return it; 
    })); 
  };

  const cartTotal = Math.round(cart.reduce((a, b) => a + ((b.finalPrice || 0) * (b.quantity || 1)), 0));

  const handleOpenRegister = async (skipStock = false) => {
    const amount = initialCashInput !== '' ? parseFloat(initialCashInput) : 0;
    if (isNaN(amount) || amount < 0) return showMessage("Ingrese un monto de efectivo inicial válido (ej: 0 o más)", "error");
    
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

    try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), { 
          isOpen: true, 
          initialCash: amount, 
          currentCash: amount, 
          initialStock: parsedStock, 
          currentStock: parsedStock, 
          openedAt: Date.now(), 
          sessionId: `SESSION-${Date.now()}` 
        });
        setInitialCashInput(''); 
        setInitialStockInput({}); 
        showMessage(skipStock ? "Caja abierta correctamente (Stock iniciado en 0)" : "Caja e inventario abiertos correctamente");
        setActiveTab('pos');
    } catch (e: any) { showMessage("Error al abrir caja: " + e.message, "error"); }
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
        orderTypesBreakdown
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
        orderTypesBreakdown
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

  const clearForm = () => { 
    setCart([]); 
    setClientInfo({name:'', phone:'', address:'', zone:''}); 
    setCashProvided(''); 
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

  const handleCheckout = async (returnToKitchen = false) => {
    if (!db || !user) return showMessage("Error: No hay conexión", "error");
    if (register.isLoaded && !register.isOpen) { showMessage("Debe abrir la caja antes de procesar", "error"); setActiveTab('cash'); return; }
    if (cart.length === 0) return showMessage("El carrito está vacío", "error");
    if (isScheduled && !scheduledTime) return showMessage("Indique hora de entrega", "error");
    setIsSubmitting(true);
    try {
        const isMesa = orderType === 'Mesa';
        if (!isMesa && ((clientInfo.name && clientInfo.name.trim() !== '') || (clientInfo.phone && clientInfo.phone.trim() !== ''))) {
            const existingClient = clients.find(c => { 
              const infoP = String(clientInfo.phone || '').trim(); 
              const infoN = String(clientInfo.name || '').trim().toLowerCase(); 
              const cP = String(c.phone || '').trim(); 
              const cN = String(c.name || '').trim().toLowerCase(); 
              return (infoP !== '' && infoP.toLowerCase() !== 'n/a' && cP === infoP) || (infoN !== '' && infoN.toLowerCase() !== 'sin nombre' && cN === infoN); 
            });
            if (existingClient) {
                const updates: any = {}; 
                if (clientInfo.name && existingClient.name !== clientInfo.name) updates.name = clientInfo.name; 
                if (clientInfo.phone && existingClient.phone !== clientInfo.phone) updates.phone = clientInfo.phone; 
                if (clientInfo.address && existingClient.address !== clientInfo.address) updates.address = clientInfo.address; 
                if (clientInfo.zone && existingClient.zone !== clientInfo.zone) updates.zone = clientInfo.zone;
                if (Object.keys(updates).length > 0) await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', existingClient.firestoreId), updates);
            } else { 
              await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), { 
                name: clientInfo.name || 'Sin Nombre', phone: clientInfo.phone || '', address: clientInfo.address || '', zone: clientInfo.zone || '', createdAt: Date.now() 
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
        const orderData: any = {
          id: editingOrder ? editingOrder.id : `#${String(orders.length + 1).padStart(4, '0')}`, 
          type: orderType || 'Local', 
          reference: orderType === 'Envío' ? 'ENVÍO' : (orderType === 'Web' ? 'PEDIDO WEB' : (orderType === 'Mesa' ? `MESA ${clientInfo.name || 'S/N'}` : 'LOCAL')), 
          client: { 
            name: isMesa ? `MESA ${clientInfo.name || 'S/N'}` : (clientInfo.name || 'Sin Nombre'), 
            phone: isMesa ? 'N/A' : (clientInfo.phone || 'N/A'), 
            address: isMesa ? 'N/A' : (clientInfo.address || 'N/A'), 
            zone: isMesa ? 'N/A' : (clientInfo.zone || 'N/A') 
          }, 
          items: cart.map(it => ({ 
            id: it.id || 'N/A', name: it.name || 'Item', price: it.price || 0, finalPrice: it.finalPrice || 0, quantity: it.quantity || 1, selectedToppings: it.selectedToppings || [], isPortion: it.isPortion || false 
          })), 
          total: cartTotal, 
          paymentMethod: paymentMethod || 'Efectivo', 
          cashProvided: paymentMethod === 'Efectivo' ? (parseFloat(cashProvided) || 0) : 0, 
          status: editingOrder ? (returnToKitchen ? 'Preparando' : editingOrder.status) : 'Preparando', 
          createdAt: editingOrder ? editingOrder.createdAt : Date.now(), 
          time: editingOrder ? editingOrder.time : new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}), 
          isScheduled: isScheduled, 
          scheduledTime: scheduledTimestamp, 
          isPaid: editingOrder ? editingOrder.isPaid : false, 
          isArchived: editingOrder ? editingOrder.isArchived : false, 
          notes: orderNotes, 
          assignedDriver: editingOrder ? editingOrder.assignedDriver : null, 
          sessionId: register.sessionId || null 
        };
        if (editingOrder) { 
          await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', editingOrder.firestoreId), orderData); 
          showMessage("Pedido actualizado"); 
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
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'stockItems', itemId));
      showMessage("Artículo eliminado del stock");
    } catch (e: any) { showMessage("Error al eliminar: " + e.message, "error"); }
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
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', firestoreId));
      showMessage("Cliente eliminado");
    } catch (e: any) { showMessage("Error al eliminar cliente: " + e.message, "error"); }
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
  const handleCreateProduct = async () => {
    if (!newProductForm.name.trim() || !newProductForm.price) return showMessage("Complete nombre y precio", "error");
    const catKey = newProductForm.category.toLowerCase();
    const newItem: MenuItem = {
      id: `prod-${Date.now()}`,
      name: newProductForm.name.trim(),
      desc: newProductForm.desc.trim(),
      price: parseFloat(newProductForm.price) || 0,
      isPortion: newProductForm.isPortion,
      isMeter: newProductForm.isMeter,
      hasToppings: newProductForm.hasToppings,
      maxToppings: newProductForm.maxToppings || 4
    };

    const updatedMenu = { ...menu };
    if (!updatedMenu[catKey]) updatedMenu[catKey] = [];
    updatedMenu[catKey] = [...updatedMenu[catKey], newItem];

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
      setNewProductForm({ category: 'pizzas', name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 0 });
      setNewProductModal(false);
      showMessage("Producto agregado al menú");
    } catch (e: any) { showMessage("Error al agregar producto: " + e.message, "error"); }
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
    if (!name.trim() || !price) return showMessage("Complete nombre y precio", "error");

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
      name: name.trim(),
      desc: desc.trim(),
      price: parseFloat(price) || 0,
      isPortion,
      isMeter,
      hasToppings,
      maxToppings: hasToppings ? (maxToppings || 4) : 0
    };

    if (!updatedMenu[newCat]) updatedMenu[newCat] = [];
    updatedMenu[newCat].push(updatedItem);

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
      setEditProductModal({ isOpen: false, category: '', item: null, name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 4 });
      showMessage("Producto actualizado en el menú");
    } catch (e: any) {
      showMessage("Error al actualizar producto: " + e.message, "error");
    }
  };

  const handleDeleteProduct = async (catKey: string, itemId: string) => {
    if (!confirm("¿Está seguro de eliminar este producto del menú?")) return;
    const cKey = catKey.toLowerCase();
    const updatedMenu = { ...menu };
    if (!updatedMenu[cKey]) return;
    updatedMenu[cKey] = updatedMenu[cKey].filter(it => it.id !== itemId);

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'menu'), { data: updatedMenu });
      setEditProductModal({ isOpen: false, category: '', item: null, name: '', desc: '', price: '', isPortion: false, isMeter: false, hasToppings: false, maxToppings: 4 });
      showMessage("Producto eliminado del menú");
    } catch (e: any) {
      showMessage("Error al eliminar producto: " + e.message, "error");
    }
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
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', editSaleModal.order.firestoreId), {
        paymentMethod: editSaleModal.paymentMethod,
        total: parseFloat(editSaleModal.total) || 0,
        tip: parseFloat(editSaleModal.tip) || 0,
        notes: editSaleModal.notes,
        status: editSaleModal.status
      });
      setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '', status: 'Finalizado' });
      showMessage("Venta actualizada correctamente");
    } catch (e: any) {
      showMessage("Error al actualizar venta: " + e.message, "error");
    }
  };

  const handleDeleteSale = async (firestoreId: string, orderId: string) => {
    if (!confirm(`¿Está seguro de eliminar la comanda ${orderId} del historial? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'orders', firestoreId));
      showMessage(`Comanda ${orderId} eliminada del registro`);
    } catch (e: any) {
      showMessage("Error al eliminar venta: " + e.message, "error");
    }
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
    if (!confirm("¿Está seguro de eliminar este registro de turno cerrado del historial? Esta acción no se puede deshacer.")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sessions', firestoreId));
      showMessage("Turno eliminado del historial");
    } catch (e: any) {
      showMessage("Error al eliminar turno: " + e.message, "error");
    }
  };

  // Cash Adjustment in Open Register
  const handleSaveAdjustCash = async () => {
    if (!adjustCashModal.amount) return;
    const newAmount = parseFloat(adjustCashModal.amount);
    if (isNaN(newAmount)) return showMessage("Ingrese un monto válido", "error");
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'config', 'register'), {
        currentCash: newAmount
      });
      setAdjustCashModal({ isOpen: false, amount: '', note: '' });
      showMessage(`Efectivo en caja ajustado a ${newAmount}`);
    } catch (e: any) {
      showMessage("Error al ajustar caja: " + e.message, "error");
    }
  };

  const kitchenOrders = orders.filter(o => o.status === 'Preparando' && !o.isArchived);
  const scheduledOrders = kitchenOrders.filter(o => o.isScheduled && o.scheduledTime && o.scheduledTime > Date.now());
  const normalAndDelayed = kitchenOrders.filter(o => !o.isScheduled || (o.scheduledTime && o.scheduledTime <= Date.now()));
  const delayedOrders = normalAndDelayed.filter(o => Math.floor((Date.now() - o.createdAt) / 60000) >= (WARNING_THRESHOLDS[o.type] || [30])[0]);
  const normalOrders = normalAndDelayed.filter(o => !delayedOrders.includes(o));

  return (
    <div className="fixed inset-0 flex flex-col bg-[#060a08] font-sans text-slate-100 overflow-hidden">
      {uiMessage && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-8 py-3 text-white rounded-full font-black text-xs uppercase shadow-2xl animate-in slide-in-from-top-4 ${uiMessage.type === 'error' ? 'bg-red-600' : 'bg-slate-900 border border-emerald-500/40 text-emerald-300'}`}>
          {uiMessage.text}
        </div>
      )}

      {/* Lock screen overlay if register closed (allow 'cash' & 'stock' tabs so user can see or open shift) */}
      {register.isLoaded && !register.isOpen && activeTab !== 'cash' && activeTab !== 'stock' && (
        <div className="fixed inset-0 z-[9995] bg-[#060a08]/90 backdrop-blur-md flex items-center justify-center p-4">
             <div className="bg-[#0c1711] p-8 sm:p-10 rounded-[45px] max-w-xl w-full shadow-2xl text-center space-y-5 border border-emerald-500/30 text-slate-100">
                 <div className="w-20 h-20 bg-amber-950/80 text-amber-400 rounded-full flex items-center justify-center mx-auto border-2 border-amber-500/50 shadow-inner">
                   <Icon name="lock" size={44} />
                 </div>
                 <div>
                   <h2 className="text-2xl sm:text-3xl font-black uppercase text-white tracking-tight">Apertura de Caja</h2>
                   <p className="text-xs sm:text-sm font-bold text-slate-400 mt-2">
                     Inicia el turno para comenzar a registrar pedidos. Podrás ver y editar la pantalla de stock (opcional) o abrir la caja directamente con el efectivo inicial.
                   </p>
                 </div>

                 <div className="bg-[#070e0a] p-4 rounded-2xl border border-emerald-500/20 text-left space-y-2">
                   <div className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1.5">
                     <Icon name="info" size={14} className="text-emerald-400"/> Stock No Bloqueante
                   </div>
                   <p className="text-xs font-semibold text-slate-300">
                     El conteo de stock inicial es totalmente editable pero <strong className="text-emerald-400">no es obligatorio</strong> para abrir la caja.
                   </p>
                 </div>

                 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                   <button 
                     onClick={() => setActiveTab('cash')} 
                     className="w-full py-4.5 bg-[#14231a] hover:bg-[#1a2f23] text-emerald-300 border border-emerald-500/30 rounded-[22px] font-black uppercase text-xs shadow-lg transition-all flex items-center justify-center gap-2"
                   >
                     <Icon name="inventory_2" size={18} className="text-emerald-400"/> Ver Stock y Abrir Caja
                   </button>
                   <button 
                     onClick={() => handleOpenRegister(true)} 
                     className="w-full py-4.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-[22px] font-black uppercase text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2"
                   >
                     <Icon name="bolt" size={18} className="text-slate-950"/> Abrir Directo ($0)
                   </button>
                 </div>
             </div>
        </div>
      )}

      {/* Header - Black Deluxe Edition */}
      <header className="h-14 bg-[#05080e] border-b border-slate-800 text-white flex items-center justify-between px-3 sm:px-4 shrink-0 shadow-lg z-50">
        <div className="flex items-center gap-2 shrink-0 pr-2 border-r border-slate-800/80">
          <div className="w-8 h-8 rounded-xl border border-blue-500/50 bg-[#09121d] flex items-center justify-center font-black text-sm text-blue-400 shadow-xs">
            🌳
          </div>
          <div className="font-black text-xs sm:text-sm tracking-wider uppercase flex items-center gap-1.5">
            <span className="text-white">El Árbol</span>
            <span className="text-[9px] bg-blue-950 text-blue-400 px-1.5 py-0.2 rounded-md border border-blue-500/30 font-black tracking-widest">POS</span>
          </div>
        </div>

        {/* Complete Navigation Bar */}
        <nav className="flex h-full gap-0.5 ml-auto overflow-x-auto no-scrollbar items-center pl-1">
          {[ 
            {id: 'kitchen', label: 'KDS Cocina', icon: 'tv', count: badges.kitchen}, 
            {id: 'pos', label: 'Caja / POS', icon: 'point_of_sale'}, 
            {id: 'web', label: 'Web', icon: 'public', count: badges.web}, 
            {id: 'counter', label: 'Mostrador', icon: 'storefront', count: badges.mostrador}, 
            {id: 'tables', label: 'Mesas', icon: 'table_restaurant', count: badges.mesas}, 
            {id: 'delivery', label: 'Delivery', icon: 'two_wheeler', count: badges.delivery}, 
            {id: 'finished', label: 'Finalizados', icon: 'check_circle', count: badges.finished}, 
            {id: 'clients', label: 'Clientes', icon: 'people'}, 
            {id: 'products', label: 'Menú', icon: 'menu_book'}, 
            {id: 'stock', label: 'Stock', icon: 'inventory_2', count: badges.stock}, 
            {id: 'reports', label: 'Reportes', icon: 'bar_chart'}, 
            {id: 'history', label: 'Historial', icon: 'history'}, 
            {id: 'cash', label: 'Arqueo', icon: 'account_balance_wallet'},
            {id: 'dgi', label: 'DGI CFE', icon: 'receipt_long'},
            {id: 'support', label: 'Soporte', icon: 'support_agent', count: supportTickets.filter(t => t.status !== 'Resuelto').length}
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)} 
              className={`px-2.5 lg:px-3.5 h-full flex items-center gap-1 font-black text-[9px] lg:text-[10px] uppercase transition-all relative shrink-0 ${
                activeTab === tab.id 
                  ? 'bg-[#0e1724] text-blue-400 border-b-2 border-blue-500' 
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon name={tab.icon} size={15}/> <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className="ml-0.5 bg-red-500 text-white text-[8px] px-1.5 py-0.2 rounded-full font-black">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </header>

      {/* Main Container */}
      <main className="flex-1 overflow-hidden relative bg-[#060a08]">
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
            th={th}
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
          />
        )}

        {/* Generic active orders tab (counter, tables, delivery, web) */}
        {(['counter', 'tables', 'delivery', 'web'].includes(activeTab)) && (
          <div className="p-8 h-full overflow-y-auto no-scrollbar bg-[#060a08]">
             <div className="max-w-[1600px] mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
               {orders.filter(o => !o.isArchived && o.status === 'Pendiente').filter(o => { 
                   const safeType = String(o.type || '').trim().toLowerCase();
                   if (activeTab === 'counter') return ['local', 'mostrador'].includes(safeType); 
                   if (activeTab === 'tables') return safeType === 'mesa'; 
                   if (activeTab === 'delivery') return ['envío', 'envio', 'delivery'].includes(safeType); 
                   if (activeTab === 'web') return ['web', 'pedido web'].includes(safeType); 
                   return false; 
               }).map(o => (
                  <OrderCard 
                    key={o.firestoreId} 
                    order={o} 
                    db={db} appId={appId} WARNING_THRESHOLDS={WARNING_THRESHOLDS} setNotesModal={setNotesModal} handleEditOrder={handleEditOrder} notifyClientWhatsApp={notifyClientWhatsApp} setDeliveryShareModal={setDeliveryShareModal} setEditOrderModal={setEditOrderModal} handleDirectDispatch={handleDirectDispatch} showMessage={showMessage} 
                  />
               ))}
             </div>
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
            <div className="p-8 md:p-12 h-full overflow-y-auto bg-[#060a08] text-slate-100 no-scrollbar space-y-8">
              <div className="max-w-7xl mx-auto space-y-8">
                {/* Header & Export Actions */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-500/20 pb-6">
                  <div>
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                      <Icon name="history" size={36} className="text-emerald-400"/> Historial de Ventas
                    </h1>
                    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                      Comandas cobradas del turno actual • Permite editar, borrar y exportar
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button 
                      onClick={() => exportOrdersToCSV(filteredOrders)} 
                      className="px-5 py-3 bg-[#112017] border border-emerald-500/30 text-emerald-300 hover:bg-[#192f22] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                      title="Descargar listado en formato Excel / CSV"
                    >
                      <Icon name="download" size={16}/> 📊 Exportar Excel (CSV)
                    </button>
                    <button 
                      onClick={() => exportOrdersToPDF(filteredOrders)} 
                      className="px-5 py-3 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20"
                      title="Descargar o imprimir reporte en PDF"
                    >
                      <Icon name="print" size={16}/> 📄 Exportar PDF
                    </button>
                  </div>
                </div>

                {/* Filters & Search */}
                <div className="bg-[#0b140f] p-6 rounded-[30px] border border-emerald-500/20 shadow-sm grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="relative">
                    <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input 
                      type="text" 
                      placeholder="Buscar por ID, cliente, teléfono, item..." 
                      value={finishedFilter.search} 
                      onChange={e => setFinishedFilter({ ...finishedFilter, search: e.target.value })} 
                      className="w-full pl-11 pr-4 py-3 bg-[#070e0a] border border-emerald-500/30 text-emerald-100 placeholder-slate-500 rounded-2xl text-xs font-black uppercase outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <select 
                      value={finishedFilter.method} 
                      onChange={e => setFinishedFilter({ ...finishedFilter, method: e.target.value })} 
                      className="w-full py-3 px-4 bg-[#070e0a] border border-emerald-500/30 text-emerald-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-emerald-400"
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
                      className="w-full py-3 px-4 bg-[#070e0a] border border-emerald-500/30 text-emerald-100 rounded-2xl text-xs font-black uppercase outline-none focus:border-emerald-400"
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
                  <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Ventas Filtradas</div>
                    <div className="text-3xl font-black text-slate-900 mt-1">${totalFilteredSales}</div>
                  </div>
                  <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-xs">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Comandas Cobradas</div>
                    <div className="text-3xl font-black text-slate-900 mt-1">{filteredOrders.length}</div>
                  </div>
                  <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-xs">
                    <div className="text-[10px] font-black text-green-600 uppercase tracking-widest">Efectivo Cobrado</div>
                    <div className="text-3xl font-black text-green-600 mt-1">${totalFilteredCash}</div>
                  </div>
                  <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-xs">
                    <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Total Propinas</div>
                    <div className="text-3xl font-black text-amber-600 mt-1">${totalFilteredTips}</div>
                  </div>
                </div>

                {/* Sales Cards Grid */}
                {filteredOrders.length === 0 ? (
                  <div className="bg-white p-12 rounded-[40px] border border-slate-200 text-center space-y-3">
                    <Icon name="search_off" size={48} className="mx-auto text-slate-300"/>
                    <div className="font-black text-slate-700 text-lg uppercase">No se encontraron ventas finalizadas</div>
                    <div className="text-xs font-bold text-slate-400">Pruebe ajustando los filtros de búsqueda o el medio de pago.</div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredOrders.map(order => (
                      <div key={order.firestoreId} className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
                        <div className="space-y-4">
                          {/* Order Header */}
                          <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-black text-sm bg-slate-900 text-white px-2.5 py-1 rounded-xl shadow-xs">{order.id}</span>
                                <span className="font-black text-xs text-slate-500 uppercase">{new Date(order.createdAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                              </div>
                              <div className="font-black text-sm uppercase text-slate-900 mt-2">{order.client?.name || 'CLIENTE GENERAL'}</div>
                              {order.client?.phone && <div className="text-[11px] font-bold text-slate-400">{order.client.phone}</div>}
                              {order.client?.address && <div className="text-[10px] font-bold text-slate-500 uppercase mt-0.5">{order.client.address} {order.client.zone ? `(${order.client.zone})` : ''}</div>}
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-green-100 text-green-800">
                                {order.type || 'Local'}
                              </span>
                              <span className="text-[10px] font-black uppercase px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700">
                                {order.paymentMethod || 'Efectivo'}
                              </span>
                            </div>
                          </div>

                          {/* Items */}
                          <ul className="text-xs space-y-1.5 py-1">
                            {order.items.map((it, idx) => (
                              <li key={idx} className="flex justify-between items-start">
                                <div>
                                  <span className="font-black text-slate-800">{it.quantity || 1}x {it.name}</span>
                                  {it.selectedToppings && it.selectedToppings.length > 0 && (
                                    <div className="text-[10px] text-slate-500 font-bold italic mt-0.5">
                                      + {it.selectedToppings.map(t => t.name).join(', ')}
                                    </div>
                                  )}
                                </div>
                                <span className="font-black text-slate-700">${Math.round((it.finalPrice || 0) * (it.quantity || 1))}</span>
                              </li>
                            ))}
                          </ul>

                          {/* Notes */}
                          {order.notes && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-[11px] font-bold text-amber-900">
                              📝 <span className="uppercase">{order.notes}</span>
                            </div>
                          )}
                        </div>

                        {/* Bottom Total & Actions */}
                        <div className="mt-6 pt-4 border-t border-slate-100 space-y-4">
                          <div className="flex justify-between items-end">
                            <div>
                              <div className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Total Cobrado</div>
                              <div className="text-3xl font-black text-green-600 leading-none">${order.total}</div>
                              {order.tip ? <div className="text-[10px] font-black text-amber-600 mt-1">+ ${order.tip} Propina</div> : null}
                            </div>
                            <button 
                              onClick={() => printOrderTicket(order)} 
                              className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl text-xs font-black uppercase transition-all flex items-center gap-1.5 shadow-xs"
                              title="Reimprimir ticket de la comanda"
                            >
                              <Icon name="print" size={16}/> Ticket
                            </button>
                          </div>

                          {/* Action Buttons: Edit & Delete */}
                          <div className="flex gap-2 pt-2 border-t border-slate-100">
                            <button 
                              onClick={() => handleOpenEditSale(order)} 
                              className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                            >
                              <Icon name="edit" size={14}/> Editar Venta
                            </button>
                            <button 
                              onClick={() => handleDeleteSale(order.firestoreId, order.id)} 
                              className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                              title="Eliminar comanda del registro"
                            >
                              <Icon name="delete" size={14}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Stock Tab */}
        {activeTab === 'stock' && (
          <div className="p-8 md:p-12 h-full overflow-y-auto bg-slate-50 no-scrollbar space-y-8">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                    <Icon name="inventory_2" size={36} className="text-blue-600"/> Control de Stock
                  </h1>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Gestión e inventario inicial / actual por producto</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => exportStockToCSV(stockItems, register.initialStock, register.currentStock)} 
                    className="px-5 py-3.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Exportar inventario a Excel (CSV)"
                  >
                    <Icon name="download" size={16}/> 📊 Exportar Stock CSV
                  </button>
                  <button onClick={() => setNewStockItemModal(true)} className="px-6 py-3.5 bg-slate-900 text-white rounded-[20px] font-black uppercase text-xs hover:bg-black transition-all flex items-center gap-2 shadow-md">
                    <Icon name="add" size={18}/> + Nuevo Artículo
                  </button>
                </div>
              </div>

              {!register.isOpen && (
                <div className="bg-white border-2 border-amber-300 p-6 rounded-[35px] shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-5 bg-gradient-to-r from-amber-50/80 to-white">
                  <div className="flex items-center gap-4">
                    <div className="p-3.5 bg-amber-500 text-white rounded-2xl shadow-sm shrink-0">
                      <Icon name="lock_clock" size={28}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="font-black uppercase text-amber-950 text-base">Caja Cerrada</div>
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full border border-amber-300">
                          Preparación de Stock
                        </span>
                      </div>
                      <div className="text-xs font-bold text-amber-800/80 mt-0.5">
                        Puedes configurar y revisar el catálogo de stock libremente. El conteo de stock inicial no es obligatorio para abrir la caja.
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap w-full md:w-auto">
                    <button 
                      onClick={() => setActiveTab('cash')} 
                      className="flex-1 md:flex-none px-5 py-3.5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black transition-all flex items-center justify-center gap-2 shadow-md"
                    >
                      <Icon name="account_balance_wallet" size={16}/> Ir a Apertura de Caja
                    </button>
                    <button 
                      onClick={() => handleOpenRegister(true)} 
                      className="flex-1 md:flex-none px-5 py-3.5 bg-green-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-green-700 transition-all flex items-center justify-center gap-1.5 shadow-md"
                      title="Abrir inmediatamente la caja con $0"
                    >
                      <Icon name="bolt" size={16} className="text-yellow-300"/> Abrir Rápido ($0)
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-8">
                {Object.entries<StockItem[]>(
                  stockItems.reduce((acc: Record<string, StockItem[]>, item: StockItem) => {
                    const cat = item.category || 'Otros';
                    if (!acc[cat]) acc[cat] = [];
                    acc[cat].push(item);
                    return acc;
                  }, {})
                ).map(([catName, itemsInCat]) => (
                  <div key={catName} className="bg-white p-6 rounded-[35px] border border-slate-200 shadow-sm space-y-4">
                    <h2 className="text-xl font-black uppercase text-slate-800 border-b pb-3 flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Icon name="inventory_2" size={20} className="text-blue-600"/> {catName}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400 uppercase">
                        {itemsInCat.length} {itemsInCat.length === 1 ? 'artículo' : 'artículos'}
                      </span>
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {itemsInCat.map(item => {
                        const currentQty = register.isOpen ? (register.currentStock?.[item.firestoreId] ?? 0) : 0;
                        const initialQty = register.isOpen ? (register.initialStock?.[item.firestoreId] ?? 0) : 0;
                        const unit = getItemUnit(item);
                        const symbol = getItemUnitSymbol(item);
                        const step = unit === 'Metros' ? 0.5 : 1;
                        const isLow = register.isOpen && (
                          unit === 'Metros' ? currentQty <= 2 : (unit === 'Porciones' ? currentQty <= 5 : currentQty <= 3)
                        );

                        return (
                          <div key={item.firestoreId} className={`bg-slate-50 p-5 rounded-[25px] border-2 shadow-sm flex flex-col justify-between transition-all ${isLow ? 'border-red-400 bg-red-50/40' : 'border-slate-200 hover:border-slate-300'}`}>
                            <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-white border border-slate-200 text-blue-700 rounded-full">
                                  {unit} ({symbol})
                                </span>
                                <button onClick={() => handleDeleteStockItem(item.firestoreId)} className="text-slate-300 hover:text-red-500 p-1" title="Eliminar artículo">
                                  <Icon name="delete" size={18}/>
                                </button>
                              </div>
                              <h3 className="text-base font-black uppercase text-slate-900 mb-3">{item.name}</h3>

                              <div className="grid grid-cols-2 gap-2 bg-white p-3 rounded-[18px] border border-slate-200 mb-3">
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">Stock Inicial</div>
                                  <div className="text-lg font-black text-slate-700">{initialQty} {symbol}</div>
                                </div>
                                <div>
                                  <div className="text-[9px] font-black uppercase text-slate-400">Stock Actual</div>
                                  <div className={`text-xl font-black ${isLow ? 'text-red-600' : 'text-slate-900'}`}>{currentQty} {symbol}</div>
                                </div>
                              </div>
                            </div>

                            {register.isOpen && (
                              <div className="flex items-center gap-2 pt-2 border-t">
                                <button onClick={() => handleUpdateStockQty(item.firestoreId, Math.max(0, Math.round((currentQty - step) * 100) / 100))} className="flex-1 py-2 bg-white border border-slate-200 hover:bg-slate-100 text-slate-800 rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-sm">
                                  <Icon name="remove" size={14}/> -{step}{symbol === 'm' ? 'm' : ''}
                                </button>
                                <button onClick={() => handleUpdateStockQty(item.firestoreId, Math.round((currentQty + step) * 100) / 100)} className="flex-1 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs flex items-center justify-center gap-1 shadow-sm">
                                  <Icon name="add" size={14}/> +{step}{symbol === 'm' ? 'm' : ''}
                                </button>
                              </div>
                            )}
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
          <div className="p-8 md:p-12 h-full overflow-y-auto bg-slate-50 no-scrollbar space-y-8">
            <div className="max-w-6xl mx-auto space-y-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                    <Icon name="menu_book" size={36} className="text-yellow-500"/> Configuración del Menú
                  </h1>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Gestione precios, gustos y categorías • Permite editar y eliminar productos</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => exportMenuToCSV(menu)} 
                    className="px-5 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Exportar menú a Excel (CSV)"
                  >
                    <Icon name="download" size={16}/> 📊 Exportar Excel
                  </button>
                  <button 
                    onClick={() => exportMenuToPDF(menu)} 
                    className="px-5 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                    title="Descargar menú en PDF"
                  >
                    <Icon name="print" size={16}/> 📄 Exportar PDF
                  </button>
                  <button onClick={() => setNewProductModal(true)} className="px-6 py-3 bg-slate-900 text-white rounded-[20px] font-black uppercase text-xs hover:bg-black transition-all flex items-center gap-2 shadow-md">
                    <Icon name="add" size={18}/> + Nuevo Producto
                  </button>
                </div>
              </div>

              {Object.keys(menu).map(catKey => (
                <div key={catKey} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm space-y-4">
                  <h2 className="text-2xl font-black uppercase text-slate-800 border-b pb-3 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Icon name="category" size={24} className="text-slate-400"/> {catKey}
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {(menu[catKey] || []).length} artículos
                    </span>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {(menu[catKey] || []).map(item => (
                      <div key={item.id} className="bg-slate-50 p-5 rounded-[25px] border border-slate-200 flex flex-col justify-between hover:border-slate-300 transition-all">
                        <div>
                          <div className="flex justify-between items-start mb-1">
                            <div className="font-black text-sm uppercase text-slate-900">{item.name}</div>
                            <div className="flex items-center gap-1">
                              {item.isMeter ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-blue-100 text-blue-800 rounded-md">Metro</span>
                              ) : item.isPortion ? (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md">Porción</span>
                              ) : null}
                              {item.hasToppings && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md">Gustos</span>
                              )}
                            </div>
                          </div>
                          {item.desc && <div className="text-[10px] font-bold text-slate-500 uppercase italic mt-1">{item.desc}</div>}
                        </div>
                        <div className="mt-4 pt-3 border-t border-slate-200 space-y-3">
                          <div className="flex justify-between items-end">
                            <span className="text-2xl font-black text-green-600">${item.price}</span>
                            <div className="text-[10px] font-bold text-slate-400 uppercase">
                              {item.isMeter ? 'Por metro' : (item.isPortion ? 'Porción' : 'Unidad')}
                            </div>
                          </div>
                          <div className="flex gap-2 pt-1 border-t border-slate-200">
                            <button 
                              onClick={() => handleOpenEditProduct(catKey, item)} 
                              className="flex-1 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 rounded-xl font-black text-[11px] uppercase transition-all flex items-center justify-center gap-1 shadow-xs"
                            >
                              <Icon name="edit" size={13}/> Editar
                            </button>
                            <button 
                              onClick={() => handleDeleteProduct(catKey, item.id)} 
                              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl font-black text-[11px] uppercase transition-all flex items-center justify-center"
                              title="Eliminar producto"
                            >
                              <Icon name="delete" size={14}/>
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Stock Tab (Control de Inventario en Tiempo Real) */}
        {activeTab === 'stock' && (
          <div className="p-8 md:p-12 h-full overflow-y-auto bg-[#060a08] text-slate-100 no-scrollbar space-y-8">
            <div className="max-w-7xl mx-auto space-y-8">
              {/* Header Banner */}
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-emerald-500/20 pb-6">
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-3">
                      <Icon name="inventory_2" size={36} className="text-emerald-400"/> Control de Stock
                    </h1>
                    <span className="text-[10px] font-black uppercase px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/30 rounded-full">
                      {stockItems.length} Artículos
                    </span>
                  </div>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Inventario en vivo • Deducción automática por comandas • Ajuste manual libre y no bloqueante
                  </p>
                </div>

                <div className="flex flex-wrap gap-2.5">
                  <button 
                    onClick={() => setNewStockItemModal(true)} 
                    className="px-5 py-3 bg-emerald-500 text-slate-950 hover:bg-emerald-400 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-md shadow-emerald-500/20"
                  >
                    <Icon name="add" size={18}/> + Nuevo Artículo
                  </button>
                  {!register.isOpen && (
                    <button 
                      onClick={() => setActiveTab('cash')} 
                      className="px-5 py-3 bg-[#112017] text-emerald-300 border border-emerald-500/30 hover:bg-[#192f22] rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2"
                    >
                      <Icon name="account_balance_wallet" size={18}/> Abrir Caja
                    </button>
                  )}
                </div>
              </div>

              {/* Status & Non-blocking notice */}
              {!register.isOpen ? (
                <div className="bg-amber-950/40 border border-amber-500/40 p-5 rounded-[28px] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-amber-500/20 text-amber-400 rounded-2xl">
                      <Icon name="info" size={24}/>
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase text-amber-300">Caja cerrada actualmente</div>
                      <div className="text-[11px] font-bold text-slate-300">
                        Puedes ajustar los valores de stock libremente. Al abrir la caja, podrás confirmar este stock o abrir en $0 sin restricción.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setActiveTab('cash')}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl font-black text-[11px] uppercase shrink-0"
                  >
                    Ir al Arqueo
                  </button>
                </div>
              ) : (
                <div className="bg-[#0b140f] border border-emerald-500/30 p-5 rounded-[28px] flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                      <Icon name="sync" size={24} className="animate-spin" />
                    </div>
                    <div>
                      <div className="text-xs font-black uppercase text-emerald-300">Turno en curso y sincronizado</div>
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
                  <div key={catName} className="bg-[#0b140f] p-6 rounded-[35px] border border-emerald-500/20 shadow-md space-y-4">
                    <div className="border-b border-emerald-500/20 pb-3 flex items-center justify-between">
                      <span className="text-sm font-black uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-emerald-400"></span>
                        {catName}
                      </span>
                      <span className="text-[10px] font-black uppercase text-emerald-400 bg-emerald-950/80 border border-emerald-500/30 px-3 py-1 rounded-full">
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
                                ? 'bg-amber-950/30 border-amber-500/40' 
                                : 'bg-[#0f1c15] border-emerald-500/20 hover:border-emerald-500/40'
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
                              <div className="text-2xl font-black text-emerald-400 tracking-tight">
                                {currentDisplayVal} <span className="text-xs text-slate-400 font-bold">{symbol}</span>
                              </div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                isZero 
                                  ? 'bg-red-950 text-red-400 border border-red-500/40' 
                                  : isLow 
                                  ? 'bg-amber-950 text-amber-400 border border-amber-500/40' 
                                  : 'bg-emerald-950 text-emerald-400 border border-emerald-500/40'
                              }`}>
                                {isZero ? 'Agotado' : isLow ? 'Bajo' : 'OK'}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0 bg-[#070e0a] p-1.5 rounded-xl border border-emerald-500/20">
                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(-step)}
                                className="w-8 h-8 bg-[#122218] hover:bg-[#1a2f23] text-emerald-300 rounded-lg font-black text-xs flex items-center justify-center transition-all"
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
                                  className="w-full py-1 pr-4 pl-1 bg-transparent text-center font-black text-xs text-emerald-100 outline-none"
                                />
                                <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-500 pointer-events-none">
                                  {symbol}
                                </span>
                              </div>

                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(step)}
                                className="w-8 h-8 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black text-xs flex items-center justify-center transition-all shadow-xs"
                                title={`Sumar ${step}`}
                              >
                                +
                              </button>

                              <button 
                                type="button"
                                onClick={() => handleAdjustStock(fastStep)}
                                className="px-2 h-8 bg-[#15271c] hover:bg-[#1f3a2a] text-emerald-300 rounded-lg font-black text-[10px] flex items-center justify-center transition-all border border-emerald-500/30"
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
          <div className="p-8 md:p-12 h-full overflow-y-auto bg-slate-50 no-scrollbar">
            <div className="max-w-6xl mx-auto space-y-10">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
                <div>
                  <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">Reporte del Turno</h1>
                  <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">Estadísticas detalladas de ventas actuales</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button 
                    onClick={() => handlePrintClosureReport(undefined, 'full')} 
                    className="px-5 py-3 bg-slate-900 text-white rounded-[20px] font-black uppercase text-[10px] hover:bg-black transition-all flex items-center gap-2 shadow-md"
                  >
                    <Icon name="print" size={16}/> 📄 Imprimir Contabilidad (A4)
                  </button>
                  <button 
                    onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                    className="px-5 py-3 bg-white text-slate-800 border border-slate-300 rounded-[20px] font-black uppercase text-[10px] hover:bg-slate-100 transition-all flex items-center gap-2 shadow-sm"
                  >
                    <Icon name="receipt" size={16}/> 🖨️ Ticket Resumen
                  </button>
                  <button 
                    onClick={() => {
                      const finished = orders.filter(o => !o.isArchived && o.status === 'Finalizado');
                      exportOrdersToCSV(finished);
                    }} 
                    className="px-5 py-3 bg-green-50 text-green-700 rounded-[20px] font-black uppercase text-[10px] hover:bg-green-100 flex items-center gap-2"
                  >
                    <Icon name="download" size={16}/> 📊 Exportar Ventas CSV
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                 <div className="bg-white p-8 rounded-[35px] shadow-sm border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Ventas Totales</div>
                    <div className="text-4xl font-black text-slate-900">${reportData.totalSales}</div>
                 </div>
                 <div className="bg-white p-8 rounded-[35px] shadow-sm border border-slate-100">
                    <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">Comandas Cobradas</div>
                    <div className="text-4xl font-black text-slate-900">{reportData.finishedTotal}</div>
                 </div>
                 <div className="bg-white p-8 rounded-[35px] shadow-sm border border-slate-100">
                    <div className="text-[10px] text-amber-500 font-black uppercase tracking-widest mb-1">Propinas</div>
                    <div className="text-4xl font-black text-amber-600">${reportData.totalTips}</div>
                 </div>
                 <div className="bg-green-600 p-8 rounded-[35px] shadow-xl text-white">
                    <div className="text-[10px] text-green-200 font-black uppercase tracking-widest mb-1">Efectivo en Caja</div>
                    <div className="text-4xl font-black">${register.currentCash}</div>
                 </div>
              </div>

              {/* Physical Quantities & Meters Sold */}
              <div>
                 <h2 className="text-2xl font-black uppercase tracking-tighter text-slate-800 mb-4 flex items-center gap-2">
                    <Icon name="calculate" size={24}/> Cantidades Físicas (Incluye Promos)
                 </h2>
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    <div className="bg-blue-50 p-6 rounded-[24px] border border-blue-100 flex flex-col items-center text-center">
                       <span className="text-[10px] text-blue-500 font-black uppercase tracking-widest mb-1">Metros de Pizza</span>
                       <span className="text-4xl font-black text-blue-700">{reportData.physicalTotals.metrosPizza} m</span>
                    </div>
                    <div className="bg-amber-50 p-6 rounded-[24px] border border-amber-100 flex flex-col items-center text-center">
                       <span className="text-[10px] text-amber-600 font-black uppercase tracking-widest mb-1">Fainás Totales</span>
                       <span className="text-4xl font-black text-amber-700">{reportData.physicalTotals.fainas}</span>
                    </div>
                    <div className="bg-green-50 p-6 rounded-[24px] border border-green-100 flex flex-col items-center text-center">
                       <span className="text-[10px] text-green-600 font-black uppercase tracking-widest mb-1">Pizzetas Totales</span>
                       <span className="text-4xl font-black text-green-700">{reportData.physicalTotals.pizzetas}</span>
                    </div>
                    <div className="bg-purple-50 p-6 rounded-[24px] border border-purple-100 flex flex-col items-center text-center">
                       <span className="text-[10px] text-purple-600 font-black uppercase tracking-widest mb-1">Porciones Pizza</span>
                       <span className="text-4xl font-black text-purple-700">{reportData.physicalTotals.porcionesPizza}</span>
                    </div>
                    <div className="bg-rose-50 p-6 rounded-[24px] border border-rose-100 flex flex-col items-center text-center">
                       <span className="text-[10px] text-rose-600 font-black uppercase tracking-widest mb-1">Sándwiches</span>
                       <span className="text-4xl font-black text-rose-700">{reportData.physicalTotals.sandwiches}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {/* Arqueo de Caja Tab */}
        {activeTab === 'cash' && (
          <div className="p-4 md:p-8 h-full overflow-y-auto bg-slate-100 no-scrollbar">
            {!register.isOpen ? (
              <div className="w-full max-w-7xl mx-auto space-y-6 pb-12">
                {/* Header Banner */}
                <div className="bg-white p-6 md:p-8 rounded-[35px] shadow-sm border border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                  <div className="flex items-center gap-4">
                    <div className="p-4 bg-slate-900 text-white rounded-[24px] shadow-md shrink-0">
                      <Icon name="account_balance_wallet" size={32}/>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter text-slate-800">
                          Apertura de Caja & Control de Stock
                        </h2>
                        <span className="text-[10px] font-black uppercase px-2.5 py-1 bg-green-100 text-green-800 rounded-full border border-green-200">
                          Stock Opcional
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-500 uppercase mt-1">
                        Ingrese el efectivo inicial y ajuste el inventario disponible. El stock es editable pero no es obligatorio para iniciar el turno.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                    <button 
                      type="button"
                      onClick={() => setNewStockItemModal(true)}
                      className="px-4 py-3 bg-slate-900 text-white hover:bg-black rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all shadow-sm"
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
                      className="px-4 py-3 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-2xl font-black text-xs uppercase flex items-center gap-2 border border-blue-200 transition-all shadow-sm"
                    >
                      <Icon name="auto_awesome" size={18}/> Preset Sugerido
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        setInitialStockInput({});
                        showMessage("Conteo de stock puesto en 0");
                      }}
                      className="px-4 py-3 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase flex items-center gap-2 border border-slate-200 transition-all"
                    >
                      <Icon name="restart_alt" size={18}/> Poner en 0
                    </button>
                  </div>
                </div>

                {/* Top Section: Cash Input & Primary Action */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Cash Card */}
                  <div className="lg:col-span-2 bg-white p-6 md:p-8 rounded-[35px] shadow-sm border-2 border-slate-900 flex flex-col justify-between space-y-4">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                        <Icon name="payments" size={20} className="text-green-600"/> Efectivo Inicial en Caja ($)
                      </label>
                      <span className="text-[10px] font-black uppercase text-green-700 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                        Efectivo al abrir
                      </span>
                    </div>

                    <div className="space-y-3">
                      <div className="relative w-full">
                        <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-400">$</span>
                        <input 
                          type="number" 
                          className="w-full text-3xl md:text-4xl pl-12 pr-6 py-4 bg-slate-50 rounded-[22px] font-black text-slate-900 outline-none border-2 border-slate-200 focus:border-green-500 transition-all" 
                          value={initialCashInput} 
                          onChange={e=>setInitialCashInput(e.target.value)} 
                          placeholder="0"
                        />
                      </div>
                      <div className="flex items-center gap-2 shrink-0 w-full overflow-x-auto no-scrollbar">
                        {['0', '1000', '2000', '5000', '10000'].map(amount => (
                          <button
                            key={amount}
                            type="button"
                            onClick={() => setInitialCashInput(amount)}
                            className="flex-1 min-w-[65px] px-3.5 py-3 bg-green-50 hover:bg-green-100 text-green-800 font-black text-xs rounded-2xl border border-green-200 transition-all text-center"
                          >
                            ${amount}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Turn Start Primary CTA Card */}
                  <div className="bg-slate-900 p-6 md:p-8 rounded-[35px] shadow-xl text-white flex flex-col justify-between space-y-4">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Confirmación</div>
                      <h3 className="text-xl font-black uppercase text-white">Listo para Iniciar</h3>
                      <p className="text-xs text-slate-300 mt-1">
                        {Object.keys(initialStockInput).filter(k => (parseFloat(initialStockInput[k]) || 0) > 0).length} de {stockItems.length} productos con stock declarado
                      </p>
                      <div className="text-[11px] text-green-400 font-bold mt-2 flex items-center gap-1.5">
                        <Icon name="check_circle" size={15}/> Stock editable y opcional
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      <button 
                        onClick={() => handleOpenRegister(false)} 
                        className="w-full py-4.5 bg-green-500 hover:bg-green-600 text-slate-950 font-black uppercase text-xs sm:text-sm rounded-[22px] shadow-lg transition-all flex items-center justify-center gap-2"
                      >
                        <Icon name="key" size={20}/> Abrir Caja y Guardar Stock
                      </button>
                      <button 
                        onClick={() => handleOpenRegister(true)} 
                        className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-black uppercase text-[11px] rounded-[18px] transition-all flex items-center justify-center gap-1.5 border border-slate-700"
                        title="Abre la caja inmediatamente sin cargar stock de productos"
                      >
                        <Icon name="bolt" size={16} className="text-yellow-400"/> Abrir Rápido (Sin Stock)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Stock Products Grid grouped by Category */}
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-200 pb-3 gap-2">
                    <h3 className="text-xl font-black uppercase text-slate-800 flex items-center gap-2">
                      <Icon name="inventory_2" size={22} className="text-blue-600"/> Pantalla de Stock de Productos
                    </h3>
                    <div className="text-xs font-bold uppercase text-slate-500 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
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
                      <div key={catName} className="bg-white p-5 md:p-6 rounded-[30px] border border-slate-200 shadow-sm space-y-4">
                        <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                          <span className="text-sm font-black uppercase tracking-wider text-slate-800 flex items-center gap-2">
                            <span className="w-3 h-3 rounded-full bg-blue-600"></span>
                            {catName}
                          </span>
                          <span className="text-[10px] font-black uppercase text-blue-700 bg-blue-50 border border-blue-100 px-3 py-1 rounded-full">
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
                              <div key={item.firestoreId} className="bg-slate-50 hover:bg-white border border-slate-200 hover:border-blue-400 p-3.5 rounded-[22px] transition-all flex flex-col justify-between gap-2.5 shadow-xs">
                                <div className="flex items-start justify-between gap-1">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[11px] font-black uppercase text-slate-900 truncate" title={item.name}>{item.name}</div>
                                    <div className="text-[9px] font-bold text-slate-400 uppercase mt-0.5">{unit} ({symbol})</div>
                                  </div>
                                  <button 
                                    type="button" 
                                    onClick={() => handleDeleteStockItem(item.firestoreId)}
                                    className="text-slate-300 hover:text-red-500 p-1 transition-colors"
                                    title="Eliminar artículo de stock"
                                  >
                                    <Icon name="delete" size={15}/>
                                  </button>
                                </div>

                                <div className="flex items-center gap-1 shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(-step)}
                                    className="w-7 h-7 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-black text-xs flex items-center justify-center transition-all"
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
                                      className="w-full py-1 pr-4 pl-1 bg-transparent text-center font-black text-xs text-slate-900 outline-none"
                                    />
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-slate-400 pointer-events-none">
                                      {symbol}
                                    </span>
                                  </div>

                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(step)}
                                    className="w-7 h-7 bg-slate-900 hover:bg-black text-white rounded-lg font-black text-xs flex items-center justify-center transition-all shadow-xs"
                                    title={`Sumar ${step}`}
                                  >
                                    +
                                  </button>

                                  <button 
                                    type="button"
                                    onClick={() => handleAdjust(fastStep)}
                                    className="px-1.5 h-7 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-black text-[10px] flex items-center justify-center transition-all border border-blue-200"
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
                <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[40px] shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="p-4 bg-slate-900 text-white rounded-full"><Icon name="account_balance_wallet" size={28}/></div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-800">Caja Actual</h2>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'full')} 
                      className="px-5 py-3 bg-slate-900 text-white rounded-[20px] font-black uppercase text-xs hover:bg-black transition-all flex items-center gap-2 shadow-md"
                      title="Imprimir Informe Completo de Contabilidad (A4/PDF)"
                    >
                      <Icon name="print" size={18}/> Contabilidad (A4)
                    </button>
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                      className="px-5 py-3 bg-slate-100 text-slate-800 border border-slate-300 rounded-[20px] font-black uppercase text-xs hover:bg-slate-200 transition-all flex items-center gap-2 shadow-sm"
                      title="Imprimir Ticket Térmico Resumen (80mm)"
                    >
                      <Icon name="receipt" size={18}/> Ticket Resumen
                    </button>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-8 rounded-[40px] shadow-xl border-t-[16px] border-green-500 text-center flex flex-col justify-between">
                      <div>
                        <div className="text-[11px] font-black text-slate-400 uppercase mb-2">Efectivo Físico en Caja</div>
                        <div className="text-5xl font-black text-slate-900">${register.currentCash}</div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => setAdjustCashModal({ isOpen: true, cashAmount: String(register.currentCash || 0) })}
                          className="px-5 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center gap-1.5 mx-auto"
                        >
                          <Icon name="edit" size={14}/> Modificar / Ajustar Caja
                        </button>
                      </div>
                    </div>
                    <div className="bg-white p-8 rounded-[40px] shadow-xl border-t-[16px] border-blue-500">
                      <h3 className="font-black uppercase text-center mb-6 text-sm text-slate-800">Resumen Rápido</h3>
                      <div className="space-y-3">
                        <div className="flex justify-between border-b pb-2"><span className="font-black text-xs uppercase text-slate-500">Ventas Totales:</span><span className="font-black text-lg text-slate-900">${reportData.totalSales}</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="font-black text-xs uppercase text-slate-500">Metros de Pizza:</span><span className="font-black text-lg text-blue-600">{reportData.physicalTotals.metrosPizza} m</span></div>
                        <div className="flex justify-between border-b pb-2"><span className="font-black text-xs uppercase text-slate-500">Fainás Totales:</span><span className="font-black text-lg text-amber-600">{reportData.physicalTotals.fainas}</span></div>
                      </div>
                    </div>
                  </div>
                  <div className="max-w-md mx-auto flex flex-col gap-3">
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'full')} 
                      className="w-full py-4 bg-slate-900 text-white rounded-[24px] font-black uppercase text-xs hover:bg-black shadow-lg flex items-center justify-center gap-2"
                    >
                      <Icon name="print" size={18}/> 📄 Imprimir Contabilidad Completa (A4)
                    </button>
                    <button 
                      onClick={() => handlePrintClosureReport(undefined, 'thermal')} 
                      className="w-full py-4 bg-slate-100 text-slate-800 border border-slate-300 rounded-[24px] font-black uppercase text-xs hover:bg-slate-200 shadow-sm flex items-center justify-center gap-2"
                    >
                      <Icon name="receipt" size={18}/> 🖨️ Imprimir Ticket Resumen (80mm)
                    </button>
                    <button 
                      onClick={() => handleCloseRegister(false)} 
                      className="w-full py-5 bg-red-600 text-white rounded-[24px] font-black uppercase text-xs shadow-xl hover:bg-red-700 mt-2"
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
          <div className="p-8 md:p-12 h-full overflow-y-auto bg-slate-50 no-scrollbar space-y-8">
             <div className="max-w-6xl mx-auto space-y-8">
               <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-200 pb-6">
                 <div>
                   <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 flex items-center gap-3">
                     <Icon name="archive" size={36} className="text-slate-700"/> Historial de Turnos Cerrados
                   </h1>
                   <p className="text-slate-500 font-bold uppercase text-[10px] tracking-widest mt-1">
                     Registros históricos de sesiones de caja • Permite editar, eliminar y reimprimir informes
                   </p>
                 </div>
                 {sessions.length > 0 && (
                   <button 
                     onClick={() => exportSessionsToCSV(sessions)} 
                     className="px-5 py-3 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-[20px] font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs"
                     title="Exportar todos los cierres a Excel (CSV)"
                   >
                     <Icon name="download" size={16}/> 📊 Exportar Historial CSV
                   </button>
                 )}
               </div>

               {sessions.length === 0 ? (
                 <div className="bg-white p-12 rounded-[40px] border border-slate-200 text-center space-y-3">
                   <Icon name="history_toggle_off" size={48} className="mx-auto text-slate-300"/>
                   <div className="font-black text-slate-700 text-lg uppercase">No hay turnos cerrados registrados</div>
                   <div className="text-xs font-bold text-slate-400">Los turnos se archivarán aquí cuando realice el "Cierre de Caja".</div>
                 </div>
               ) : (
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   {sessions.map(session => (
                      <div key={session.firestoreId} className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm flex flex-col justify-between hover:shadow-md transition-all">
                        <div className="space-y-4">
                          <div className="flex justify-between items-start border-b border-slate-100 pb-4">
                            <div>
                              <div className="text-lg font-black text-slate-900">{new Date(session.closedAt).toLocaleDateString()} {new Date(session.closedAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase mt-0.5">Turno Archivado</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button 
                                onClick={() => handlePrintClosureReport(session, 'full')} 
                                className="p-2.5 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all flex items-center gap-1.5 px-3 text-xs font-black uppercase shadow-xs" 
                                title="Imprimir Informe Completo de Contabilidad (A4)"
                              >
                                <Icon name="print" size={16}/> A4
                              </button>
                              <button 
                                onClick={() => handlePrintClosureReport(session, 'thermal')} 
                                className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl transition-all flex items-center gap-1.5 px-3 text-xs font-black uppercase border shadow-xs" 
                                title="Imprimir Ticket Térmico Resumen (80mm)"
                              >
                                <Icon name="receipt" size={16}/> Ticket
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-4 rounded-[20px] border border-slate-200">
                              <div className="text-[9px] font-black text-slate-400 uppercase">VENTAS TOTALES</div>
                              <div className="text-2xl font-black text-slate-900">${session.totalSales}</div>
                              {session.totalTips ? <div className="text-[10px] font-bold text-amber-600 mt-0.5">+ ${session.totalTips} Propina</div> : null}
                            </div>
                            <div className="bg-green-50 p-4 rounded-[20px] border border-green-100">
                              <div className="text-[9px] font-black text-green-600 uppercase">CAJA FINAL</div>
                              <div className="text-2xl font-black text-green-700">${session.finalCash}</div>
                              <div className="text-[10px] font-bold text-green-600 mt-0.5">Ini: ${session.initialCash || 0}</div>
                            </div>
                          </div>

                          {session.notes && (
                            <div className="p-3 bg-slate-50 rounded-2xl text-[11px] font-bold text-slate-600 border">
                              📝 {session.notes}
                            </div>
                          )}
                        </div>

                        {/* Edit & Delete Buttons for Session */}
                        <div className="mt-6 pt-4 border-t border-slate-100 flex gap-2">
                          <button 
                            onClick={() => handleOpenEditSession(session)} 
                            className="flex-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5"
                          >
                            <Icon name="edit" size={14}/> Editar Cierre
                          </button>
                          <button 
                            onClick={() => handleDeleteSession(session.firestoreId)} 
                            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1"
                            title="Eliminar este cierre del historial"
                          >
                            <Icon name="delete" size={14}/>
                          </button>
                        </div>
                      </div>
                   ))}
                 </div>
               )}
             </div>
          </div>
        )}

        {/* DGI Electronic Billing Tab */}
        {activeTab === 'dgi' && (
          <DgiBillingTab
            dgiConfig={dgiConfig}
            onUpdateDgiConfig={handleUpdateDgiConfig}
            cfeDocuments={cfeDocuments}
            onEmitCfe={handleEmitCfe}
            onCancelCfe={handleCancelCfe}
            completedOrders={orders.filter(o => o.status === 'Finalizado' || o.isPaid)}
            showMessage={showMessage}
          />
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
      </main>

      {/* Edit Order Modal */}
      {editOrderModal.isOpen && editOrderModal.order && (
        <div className="fixed inset-0 bg-[#050a07]/85 backdrop-blur-md flex items-center justify-center z-[1100] p-4">
          <div className="bg-[#09150e] rounded-[35px] p-6 sm:p-8 max-w-xl w-full flex flex-col shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto no-scrollbar border border-emerald-500/40 text-slate-100">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div>
                <h3 className="text-xl font-black text-white uppercase flex items-center gap-2">
                  <Icon name="payments" className="text-emerald-400" size={24}/>
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
            <div className="bg-[#050a07] border border-emerald-500/30 text-white p-5 rounded-[24px] flex items-center justify-between shadow-lg">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Monto a Cobrar</div>
                <div className="text-4xl font-black text-emerald-400">${editOrderModal.order.total}</div>
              </div>
              {editOrderModal.selectedPaymentMethod === 'Efectivo' && editOrderModal.cashReceived && parseFloat(editOrderModal.cashReceived) >= editOrderModal.order.total && (
                <div className="bg-emerald-950/80 border border-emerald-400/40 p-2.5 rounded-xl text-right">
                  <div className="text-[9px] font-black uppercase text-emerald-300">Vuelto a entregar</div>
                  <div className="text-xl font-black text-white">
                    ${(parseFloat(editOrderModal.cashReceived) - editOrderModal.order.total).toFixed(0)}
                  </div>
                </div>
              )}
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-black uppercase text-slate-300 flex items-center gap-1.5">
                <Icon name="credit_card" size={16} className="text-emerald-400"/> Forma de Pago
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
                          ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20' 
                          : 'bg-[#050a07] text-slate-300 border-emerald-500/20 hover:border-emerald-500/40'
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
              <div className="bg-[#050a07] border border-emerald-500/30 p-4 rounded-[24px] space-y-3">
                <label className="text-[10px] font-black uppercase text-emerald-400 flex items-center gap-1">
                  <Icon name="monetization_on" size={14} className="text-emerald-400"/> Efectivo Recibido ($)
                </label>
                <input
                  type="number"
                  placeholder={`Monto recibido (Ej: ${editOrderModal.order.total})`}
                  value={editOrderModal.cashReceived}
                  onChange={e => setEditOrderModal({ ...editOrderModal, cashReceived: e.target.value })}
                  className="w-full p-3 bg-[#09150e] border border-emerald-500/40 text-emerald-200 rounded-2xl text-lg font-black outline-none focus:border-emerald-400"
                />
                <div className="flex gap-2">
                  {[editOrderModal.order.total, 500, 1000, 2000].map(val => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setEditOrderModal({ ...editOrderModal, cashReceived: val.toString() })}
                      className="px-3 py-1.5 bg-[#122419] border border-emerald-500/30 rounded-xl text-[10px] font-black uppercase hover:bg-[#1a3525] text-emerald-300 shadow-xs"
                    >
                      ${val}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Transfer verification checkbox */}
            {editOrderModal.selectedPaymentMethod === 'Transferencia' && (
              <label className="flex items-center gap-2 bg-[#050a07] border border-emerald-500/30 p-3 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editOrderModal.transferConfirmed}
                  onChange={e => setEditOrderModal({ ...editOrderModal, transferConfirmed: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-xs font-black uppercase text-emerald-300">Transferencia bancaria recibida y confirmada</span>
              </label>
            )}

            {/* Voucher verification checkbox for delivery debit/credit */}
            {['Débito', 'Crédito'].includes(editOrderModal.selectedPaymentMethod) && editOrderModal.order.type === 'Envío' && (
              <label className="flex items-center gap-2 bg-[#050a07] border border-emerald-500/30 p-3 rounded-2xl cursor-pointer">
                <input
                  type="checkbox"
                  checked={editOrderModal.voucherDelivered}
                  onChange={e => setEditOrderModal({ ...editOrderModal, voucherDelivered: e.target.checked })}
                  className="w-4 h-4 accent-emerald-500 rounded"
                />
                <span className="text-xs font-black uppercase text-emerald-300">Comprobante Posnet / Voucher firmado</span>
              </label>
            )}

            {/* Tip Field */}
            <div className="bg-[#050a07] border border-emerald-500/20 p-3 rounded-2xl space-y-1">
              <label className="text-[10px] font-black uppercase text-slate-400 flex items-center gap-1">
                <Icon name="volunteer_activism" size={14}/> Propina (Opcional) ($)
              </label>
              <input
                type="number"
                placeholder="0"
                value={editOrderModal.tip}
                onChange={e => setEditOrderModal({ ...editOrderModal, tip: e.target.value })}
                className="w-full p-2.5 bg-[#09150e] border border-emerald-500/30 text-white rounded-xl text-sm font-black outline-none focus:border-emerald-400"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setEditOrderModal({isOpen:false, order:null, cashReceived:'', tip:'0', voucherDelivered: true, transferConfirmed: true, selectedPaymentMethod: 'Efectivo'})} 
                className="flex-1 py-4 bg-[#122419] hover:bg-[#1a3525] rounded-2xl font-black uppercase text-xs text-slate-300"
              >
                Cancelar
              </button>
              <button 
                type="button"
                onClick={() => finalizeOrder(editOrderModal.order!, editOrderModal.cashReceived, editOrderModal.tip, editOrderModal.selectedPaymentMethod)} 
                className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5"
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
        <div className="fixed inset-0 bg-[#050a07]/90 flex items-center justify-center z-[1100] p-4 backdrop-blur-xl">
          <div className="bg-[#09150e] rounded-[40px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] border border-emerald-500/40 text-slate-100">
            <div className="bg-[#050a07] text-white p-6 flex justify-between items-center rounded-t-[40px] border-b border-emerald-500/20">
              <div>
                <h3 className="font-black uppercase text-xl flex items-center gap-2"><Icon name="local_pizza" className="text-emerald-400"/> {toppingModal.item.name}</h3>
                <p className="text-[11px] font-black text-emerald-400 uppercase mt-1">Seleccionados: {toppingModal.selectedToppings.length} de {(toppingModal.item.maxToppings || 4) * toppingModal.quantity}</p>
              </div>
              <button onClick={()=>setToppingModal({isOpen:false, item:null, selectedToppings:[], quantity: 1})} className="p-2 bg-white/10 rounded-xl hover:bg-red-600"><Icon name="close" size={20}/></button>
            </div>
            <div className="p-6 bg-[#070e0a] flex-1 overflow-y-auto no-scrollbar">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {(menu.gustos || []).map(t => {
                  const sel = toppingModal.selectedToppings.some(x=>x.id===t.id);
                  return (
                      <button key={t.id} onClick={() => setToppingModal({...toppingModal, selectedToppings: sel ? toppingModal.selectedToppings.filter(x=>x.id!==t.id) : [...toppingModal.selectedToppings, t]})} className={`p-4 rounded-[20px] border-2 font-black uppercase text-[11px] transition-all flex flex-col items-center justify-center text-center ${sel ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-black shadow-md shadow-emerald-500/20' : 'bg-[#09150e] border-emerald-500/20 text-slate-300 hover:border-emerald-500/40'}`}>
                        <span>{t.name}</span>
                        {t.price > 0 && <span className={`text-[10px] ${sel ? 'text-slate-900 font-bold' : 'text-emerald-400'}`}>(+${t.price})</span>}
                      </button>
                  );
                })}
              </div>
            </div>
            <div className="p-6 border-t border-emerald-500/20 bg-[#050a07] shrink-0 rounded-b-[40px]">
              <button onClick={()=>{addToCart(toppingModal.item, toppingModal.selectedToppings, toppingModal.quantity); setToppingModal({isOpen:false, item:null, selectedToppings:[], quantity: 1});}} className={`w-full py-5 text-slate-950 rounded-[25px] font-black uppercase text-xs bg-emerald-500 hover:bg-emerald-400 shadow-md shadow-emerald-500/20`}>
                Agregar al Carrito - Total: ${Math.round((toppingModal.item.price * toppingModal.quantity) + calculateToppingsCost(toppingModal.item, toppingModal.selectedToppings))}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Stock Item Modal */}
      {newStockItemModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-black uppercase text-slate-900">Nuevo Artículo de Stock</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Artículo</label>
                <input 
                  type="text" 
                  placeholder="Ej: Muzzarella, Figaza, Refresco..." 
                  value={newStockItemForm.name} 
                  onChange={e => setNewStockItemForm({ ...newStockItemForm, name: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none focus:border-blue-500"
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
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"
                >
                  <option value="Pizzas">Pizzas (Metros)</option>
                  <option value="Figazas">Figazas (Metros)</option>
                  <option value="Fainá">Fainá (Porciones)</option>
                  <option value="Pizzetas">Pizzetas (Unidades)</option>
                  <option value="Sándwiches">Sándwiches (Unidades)</option>
                  <option value="Postres">Postres (Unidades)</option>
                  <option value="Bebidas">Bebidas (Unidades)</option>
                  <option value="Insumos">Insumos (Unidades)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Unidad de Medida</label>
                <select 
                  value={newStockItemForm.unit} 
                  onChange={e => setNewStockItemForm({ ...newStockItemForm, unit: e.target.value })}
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"
                >
                  <option value="Metros">Metros (m)</option>
                  <option value="Porciones">Porciones</option>
                  <option value="Unidades">Unidades (u)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNewStockItemModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleCreateStockItem} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black">Guardar</button>
            </div>
          </div>
        </div>
      )}

      {/* New Client Modal */}
      {newClientModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-black uppercase text-slate-900">Registrar Cliente</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre completo" value={newClientForm.name} onChange={e => setNewClientForm({ ...newClientForm, name: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
              <input type="text" placeholder="Teléfono" value={newClientForm.phone} onChange={e => setNewClientForm({ ...newClientForm, phone: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none"/>
              <input type="text" placeholder="Dirección" value={newClientForm.address} onChange={e => setNewClientForm({ ...newClientForm, address: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
              <input type="text" placeholder="Zona (Barrio)" value={newClientForm.zone} onChange={e => setNewClientForm({ ...newClientForm, zone: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNewClientModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleCreateClient} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-green-700">Guardar Cliente</button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Modal */}
      {newProductModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-black uppercase text-slate-900">Nuevo Producto</h3>
            <div className="space-y-3">
              <select value={newProductForm.category} onChange={e => setNewProductForm({ ...newProductForm, category: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none">
                {Object.keys(menu).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <input type="text" placeholder="Nombre del producto" value={newProductForm.name} onChange={e => setNewProductForm({ ...newProductForm, name: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
              <input type="text" placeholder="Descripción breve" value={newProductForm.desc} onChange={e => setNewProductForm({ ...newProductForm, desc: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none"/>
              <input type="number" placeholder="Precio ($)" value={newProductForm.price} onChange={e => setNewProductForm({ ...newProductForm, price: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNewProductModal(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleCreateProduct} className="flex-1 py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-black">Agregar al Menú</button>
            </div>
          </div>
        </div>
      )}

      {/* Notes Modal */}
      {notesModal.isOpen && notesModal.order && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[35px] p-8 max-w-md w-full shadow-2xl space-y-5 border-t-8 border-amber-500">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-lg font-black uppercase text-slate-900 flex items-center gap-2">
                <Icon name="description" className="text-amber-500" size={20}/>
                Notas de Comanda {notesModal.order.id}
              </h3>
              <button onClick={() => setNotesModal({ isOpen: false, order: null, text: '' })} className="p-1 text-slate-400 hover:text-slate-600">
                <Icon name="close" size={20}/>
              </button>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 p-2.5 rounded-xl">
                Cliente: {notesModal.order.client?.name || 'General'}
              </div>
              <textarea
                rows={4}
                placeholder="Escriba observaciones para cocina, mostrador o delivery..."
                value={notesModal.text}
                onChange={e => setNotesModal({ ...notesModal, text: e.target.value })}
                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-amber-500 resize-none uppercase"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setNotesModal({ isOpen: false, order: null, text: '' })} className="flex-1 py-3.5 bg-slate-100 rounded-2xl font-black uppercase text-xs">
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
                className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black uppercase text-xs shadow-md"
              >
                Guardar Notas
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Client Modal */}
      {editingClient && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6">
            <h3 className="text-2xl font-black uppercase text-slate-900">Editar Cliente</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Nombre completo" value={editingClient.name} onChange={e => setEditingClient({ ...editingClient, name: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
              <input type="text" placeholder="Teléfono" value={editingClient.phone || ''} onChange={e => setEditingClient({ ...editingClient, phone: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none"/>
              <input type="text" placeholder="Dirección" value={editingClient.address || ''} onChange={e => setEditingClient({ ...editingClient, address: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
              <input type="text" placeholder="Zona (Barrio)" value={editingClient.zone || ''} onChange={e => setEditingClient({ ...editingClient, zone: e.target.value })} className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none"/>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setEditingClient(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs">Cancelar</button>
              <button onClick={handleUpdateClient} className="flex-1 py-4 bg-green-600 text-white rounded-2xl font-black uppercase text-xs hover:bg-green-700">Actualizar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Product Modal */}
      {editProductModal.isOpen && editProductModal.item && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 border-t-8 border-yellow-500">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-2">
                <Icon name="edit" className="text-yellow-500" size={24}/>
                Editar Producto
              </h3>
              <button 
                onClick={() => setEditProductModal({ isOpen: false, category: '', item: null, name: '', price: '', desc: '', isMeter: false, isPortion: false, hasToppings: false })} 
                className="p-1 text-slate-400 hover:text-slate-600"
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
                  className="w-full p-4 bg-slate-100 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase text-slate-500 cursor-not-allowed"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nombre del Producto</label>
                <input 
                  type="text" 
                  value={editProductModal.name} 
                  onChange={e => setEditProductModal({ ...editProductModal, name: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Precio ($)</label>
                <input 
                  type="number" 
                  value={editProductModal.price} 
                  onChange={e => setEditProductModal({ ...editProductModal, price: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-yellow-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Descripción / Detalles</label>
                <input 
                  type="text" 
                  value={editProductModal.desc} 
                  onChange={e => setEditProductModal({ ...editProductModal, desc: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-yellow-500"
                />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.isMeter} 
                    onChange={e => setEditProductModal({ ...editProductModal, isMeter: e.target.checked })} 
                    className="w-4 h-4 rounded text-blue-600"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-700">Metro</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.isPortion} 
                    onChange={e => setEditProductModal({ ...editProductModal, isPortion: e.target.checked })} 
                    className="w-4 h-4 rounded text-purple-600"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-700">Porción</span>
                </label>
                <label className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editProductModal.hasToppings} 
                    onChange={e => setEditProductModal({ ...editProductModal, hasToppings: e.target.checked })} 
                    className="w-4 h-4 rounded text-amber-600"
                  />
                  <span className="text-[11px] font-black uppercase text-slate-700">Gustos</span>
                </label>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditProductModal({ isOpen: false, category: '', item: null, name: '', price: '', desc: '', isMeter: false, isPortion: false, hasToppings: false })} 
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditProduct} 
                className="flex-1 py-4 bg-yellow-500 hover:bg-yellow-600 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-md transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Sale (Order) Modal */}
      {editSaleModal.isOpen && editSaleModal.order && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl space-y-6 border-t-8 border-blue-500">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-2">
                  <Icon name="edit" className="text-blue-500" size={24}/>
                  Editar Venta #{editSaleModal.order.id}
                </h3>
                <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">
                  Cliente: {editSaleModal.order.client?.name || 'General'}
                </div>
              </div>
              <button 
                onClick={() => setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '' })} 
                className="p-1 text-slate-400 hover:text-slate-600"
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
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-base text-green-700 outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Medio de Pago</label>
                <select 
                  value={editSaleModal.paymentMethod} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, paymentMethod: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm uppercase outline-none focus:border-blue-500"
                >
                  <option value="Efectivo">Efectivo</option>
                  <option value="Débito">Débito</option>
                  <option value="Crédito">Crédito</option>
                  <option value="Transferencia">Transferencia</option>
                  <option value="Mercado Pago">Mercado Pago</option>
                  <option value="A confirmar">A confirmar</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Propina ($)</label>
                <input 
                  type="number" 
                  value={editSaleModal.tip} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, tip: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Notas / Observaciones</label>
                <textarea 
                  rows={2}
                  value={editSaleModal.notes} 
                  onChange={e => setEditSaleModal({ ...editSaleModal, notes: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs uppercase outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditSaleModal({ isOpen: false, order: null, paymentMethod: 'Efectivo', total: '', tip: '0', notes: '' })} 
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditSale} 
                className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black uppercase text-xs shadow-md transition-all"
              >
                Actualizar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Session Modal */}
      {editSessionModal.isOpen && editSessionModal.session && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-lg w-full shadow-2xl space-y-6 border-t-8 border-purple-600">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-2">
                  <Icon name="edit" className="text-purple-600" size={24}/>
                  Editar Turno Archivado
                </h3>
                <div className="text-[11px] font-bold text-slate-500 uppercase mt-0.5">
                  Cerrado el {new Date(editSessionModal.session.closedAt).toLocaleString()}
                </div>
              </div>
              <button 
                onClick={() => setEditSessionModal({ isOpen: false, session: null, totalSales: '', finalCash: '', initialCash: '', totalTips: '', notes: '' })} 
                className="p-1 text-slate-400 hover:text-slate-600"
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
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Caja Final ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.finalCash} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, finalCash: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Caja Inicial ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.initialCash} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, initialCash: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-purple-600"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Propinas Totales ($)</label>
                <input 
                  type="number" 
                  value={editSessionModal.totalTips} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, totalTips: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-sm outline-none focus:border-purple-600"
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black uppercase text-slate-400">Notas del Turno</label>
                <textarea 
                  rows={2}
                  value={editSessionModal.notes} 
                  onChange={e => setEditSessionModal({ ...editSessionModal, notes: e.target.value })} 
                  className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-bold text-xs outline-none focus:border-purple-600 resize-none uppercase"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button 
                onClick={() => setEditSessionModal({ isOpen: false, session: null, totalSales: '', finalCash: '', initialCash: '', totalTips: '', notes: '' })} 
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveEditSession} 
                className="flex-1 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl font-black uppercase text-xs shadow-md transition-all"
              >
                Guardar Cambios
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Adjust Cash Modal */}
      {adjustCashModal.isOpen && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-[1100] p-4">
          <div className="bg-white rounded-[40px] p-8 max-w-md w-full shadow-2xl space-y-6 border-t-8 border-green-500">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="text-2xl font-black uppercase text-slate-900 flex items-center gap-2">
                <Icon name="payments" className="text-green-600" size={24}/>
                Modificar Efectivo en Caja
              </h3>
              <button 
                onClick={() => setAdjustCashModal({ isOpen: false, cashAmount: '' })} 
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <Icon name="close" size={22}/>
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Monto en Efectivo Físico ($)</label>
              <input 
                type="number" 
                placeholder="0"
                value={adjustCashModal.cashAmount} 
                onChange={e => setAdjustCashModal({ ...adjustCashModal, cashAmount: e.target.value })} 
                className="w-full p-4 bg-slate-50 border-2 border-slate-200 rounded-2xl font-black text-2xl text-green-700 outline-none focus:border-green-500 text-center"
              />
              <p className="text-[11px] font-bold text-slate-400 mt-2 text-center uppercase">
                Ajuste el valor si hubo ingresos manuales, gastos de caja o correcciones.
              </p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setAdjustCashModal({ isOpen: false, cashAmount: '' })} 
                className="flex-1 py-4 bg-slate-100 rounded-2xl font-black uppercase text-xs hover:bg-slate-200 transition-all"
              >
                Cancelar
              </button>
              <button 
                onClick={handleSaveAdjustCash} 
                className="flex-1 py-4 bg-green-600 hover:bg-green-700 text-white rounded-2xl font-black uppercase text-xs shadow-md transition-all"
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
        toppings={DEFAULT_TOPPINGS}
        onApplyToCart={handleApplyVoiceOrder}
        showMessage={showMessage}
      />
    </div>
  );
}
