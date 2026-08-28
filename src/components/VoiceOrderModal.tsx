import React, { useState, useEffect, useRef, useMemo } from 'react';
import { MenuItem, Topping, ClientData } from '../types';
import { 
  ParsedVoiceOrder, 
  parseVoiceOrderHeuristic, 
  cleanSpokenTranscript 
} from '../utils/voiceOrderParser';
import { Icon } from './Icon';

interface VoiceOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  menu: Record<string, MenuItem[]>;
  allMenuItems?: MenuItem[];
  allClients?: ClientData[];
  toppings: Topping[];
  onApplyToCart: (parsed: ParsedVoiceOrder, autoSubmit?: boolean) => void;
  showMessage: (text: string, type?: 'success' | 'error') => void;
}

export const VoiceOrderModal: React.FC<VoiceOrderModalProps> = ({
  isOpen,
  onClose,
  menu,
  allMenuItems = [],
  allClients = [],
  toppings,
  onApplyToCart,
  showMessage,
}) => {
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [parsedResult, setParsedResult] = useState<ParsedVoiceOrder | null>(null);
  const [speechSupported, setSpeechSupported] = useState(true);
  const [micError, setMicError] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isWide, setIsWide] = useState(false);

  // Quick Controls State within Voice Modal
  const [quickDestination, setQuickDestination] = useState<'Local' | 'Envío' | 'Mesa'>('Local');
  const [quickTableNumber, setQuickTableNumber] = useState<number | string>(1);
  const [quickPaymentMethod, setQuickPaymentMethod] = useState<string>('Efectivo');
  const [quickCashAmount, setQuickCashAmount] = useState<string>('');
  
  // Client selection / quick registration state
  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<ClientData | null>(null);
  const [customClientName, setCustomClientName] = useState('');
  const [customClientPhone, setCustomClientPhone] = useState('');
  const [customClientAddress, setCustomClientAddress] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showQuickSettings, setShowQuickSettings] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Draggable floating window state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 20, y: 65 });
  const isDraggingRef = useRef(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      const initialY = Math.max(55, Math.min(window.innerHeight - 680, 65));
      const initialX = Math.max(10, Math.min(window.innerWidth - 650, 20));
      setPosition({ x: initialX, y: initialY });
      startContinuousListening();
    } else {
      stopListening();
    }
  }, [isOpen]);

  // Filter matching clients for quick dropdown
  const filteredClients = useMemo(() => {
    if (!clientSearchQuery.trim()) return allClients.slice(0, 10);
    const q = clientSearchQuery.toLowerCase().trim();
    return allClients.filter(c => 
      (c.name && c.name.toLowerCase().includes(q)) || 
      (c.phone && c.phone.includes(q)) ||
      (c.address && c.address.toLowerCase().includes(q))
    ).slice(0, 10);
  }, [allClients, clientSearchQuery]);

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('textarea') || (e.target as HTMLElement).closest('select')) {
      return;
    }
    isDraggingRef.current = true;
    dragStartOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const currentWidth = isMinimized ? 340 : (isWide ? 780 : 640);
    const newX = Math.max(4, Math.min(window.innerWidth - currentWidth, e.clientX - dragStartOffsetRef.current.x));
    const newY = Math.max(45, Math.min(window.innerHeight - 100, e.clientY - dragStartOffsetRef.current.y));
    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    isDraggingRef.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Initialize continuous Web Speech recognition
  const startContinuousListening = () => {
    if (typeof window === 'undefined') return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechSupported(false);
      setMicError('El navegador no soporta reconocimiento de voz nativo. Puedes escribir o elegir productos.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'es-UY';

      recognition.onstart = () => {
        setIsLiveListening(true);
        setMicError(null);
      };

      recognition.onerror = (event: any) => {
        if (event.error === 'not-allowed') {
          setMicError('Permiso de micrófono denegado en el navegador.');
        }
        setIsLiveListening(false);
      };

      recognition.onend = () => {
        setIsLiveListening(false);
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = '';
        for (let i = 0; i < event.results.length; i++) {
          fullTranscript += event.results[i][0].transcript + ' ';
        }
        const cleaned = cleanSpokenTranscript(fullTranscript.trim());
        setTranscript(cleaned);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err: any) {
      setMicError('No se pudo acceder al micrófono.');
      setIsLiveListening(false);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }
    setIsLiveListening(false);
  };

  const toggleListening = () => {
    if (isLiveListening) {
      stopListening();
      if (transcript.trim()) {
        const parsed = parseVoiceOrderHeuristic(transcript, menu, toppings);
        setParsedResult(parsed);
      }
    } else {
      startContinuousListening();
    }
  };

  // Real-time automatic heuristic parsing whenever transcript updates
  useEffect(() => {
    if (!transcript.trim()) {
      return;
    }
    const parsed = parseVoiceOrderHeuristic(transcript, menu, toppings);
    
    // Auto-detect destination if spoken
    if (parsed.destination) {
      if (['Local', 'Envío', 'Mesa'].includes(parsed.destination)) {
        setQuickDestination(parsed.destination as any);
      }
    }
    // Auto-detect payment if spoken
    if (parsed.paymentMethod) {
      setQuickPaymentMethod(parsed.paymentMethod);
    }
    if (parsed.cashProvided) {
      setQuickCashAmount(String(parsed.cashProvided));
    }
    // Auto-detect client if spoken
    if (parsed.client?.name && !customClientName) {
      setCustomClientName(parsed.client.name);
    }
    if (parsed.client?.phone && !customClientPhone) {
      setCustomClientPhone(parsed.client.phone);
    }
    if (parsed.client?.address && !customClientAddress) {
      setCustomClientAddress(parsed.client.address);
    }

    setParsedResult(parsed);
  }, [transcript, menu, toppings]);

  // Loading items and applying to order
  const handleApplyBatchAndContinue = (autoSubmit = false) => {
    const finalItems = parsedResult?.items || [];
    if (finalItems.length === 0 && !parsedResult?.notes && !customClientName && !selectedClient) {
      showMessage('Dicta o selecciona al menos un producto para cargar', 'error');
      return;
    }

    // Build client info
    let finalClient: any = null;
    if (selectedClient) {
      finalClient = {
        name: selectedClient.name,
        phone: selectedClient.phone,
        address: selectedClient.address,
        zone: selectedClient.zone,
        tableNumber: quickDestination === 'Mesa' ? quickTableNumber : null
      };
    } else if (customClientName || customClientPhone || customClientAddress || quickDestination === 'Mesa') {
      finalClient = {
        name: customClientName || (quickDestination === 'Mesa' ? `Mesa #${quickTableNumber}` : 'Cliente'),
        phone: customClientPhone || 'N/A',
        address: customClientAddress || (quickDestination === 'Envío' ? 'Dirección a confirmar' : 'Mostrador'),
        zone: '',
        tableNumber: quickDestination === 'Mesa' ? quickTableNumber : null
      };
    }

    const payload: ParsedVoiceOrder = {
      items: finalItems,
      destination: quickDestination,
      paymentMethod: quickPaymentMethod,
      cashProvided: quickPaymentMethod === 'Efectivo' && quickCashAmount ? parseFloat(quickCashAmount) : null,
      client: finalClient,
      notes: parsedResult?.notes || '',
      matchedCount: finalItems.length
    };

    onApplyToCart(payload, autoSubmit);
    
    // Clear state
    setTranscript('');
    setParsedResult(null);
    setCustomClientName('');
    setCustomClientPhone('');
    setCustomClientAddress('');
    setSelectedClient(null);
    setClientSearchQuery('');
    
    if (!isLiveListening && !autoSubmit) {
      startContinuousListening();
    }
  };

  const handleUpdateItemQty = (index: number, delta: number) => {
    if (!parsedResult) return;
    const newItems = [...parsedResult.items];
    const current = newItems[index];
    const newQty = (current.quantity || 1) + delta;
    if (newQty <= 0) {
      newItems.splice(index, 1);
    } else {
      newItems[index] = { ...current, quantity: newQty };
    }
    setParsedResult({
      ...parsedResult,
      items: newItems,
      matchedCount: newItems.length
    });
  };

  const handleRemoveItem = (index: number) => {
    if (!parsedResult) return;
    const newItems = [...parsedResult.items];
    newItems.splice(index, 1);
    setParsedResult({
      ...parsedResult,
      items: newItems,
      matchedCount: newItems.length
    });
  };

  const POPULAR_SUGGESTIONS = [
    { name: '1 Metro Muzzarella + 2 Fainás', price: 750, category: 'Promociones', icon: '⭐' },
    { name: '1 Metro Muzzarella + 2 Fainás + Refresco 1.5L', price: 900, category: 'Promociones', icon: '🥤' },
    { name: '1 Metro Muzzarella + 2 Fainás + 1 Chajá', price: 920, category: 'Promociones', icon: '🍰' },
    { name: '1 Metro Muzzarella + 2 Fainás + 2 Flanes', price: 1000, category: 'Promociones', icon: '🍮' },
    { name: 'Fainá con Queso', price: 160, category: 'Fainás', icon: '🧀' },
    { name: 'Fainá Clásico', price: 110, category: 'Fainás', icon: '🔥' },
    { name: 'Sándwich Caliente', price: 220, category: 'Sándwichs', icon: '🥪' },
  ];

  const handleAddPopularItem = (sugg: { name: string; price: number; category: string }) => {
    setParsedResult(prev => {
      const existingItems = prev?.items ? [...prev.items] : [];
      const foundIdx = existingItems.findIndex(i => i.name.toLowerCase() === sugg.name.toLowerCase());
      if (foundIdx >= 0) {
        existingItems[foundIdx] = {
          ...existingItems[foundIdx],
          quantity: (existingItems[foundIdx].quantity || 1) + 1
        };
      } else {
        existingItems.push({
          id: 'sugg-' + Date.now() + Math.random(),
          name: sugg.name,
          quantity: 1,
          basePrice: sugg.price,
          finalPrice: sugg.price,
          category: sugg.category,
          selectedToppings: []
        });
      }
      return {
        destination: prev?.destination || quickDestination,
        paymentMethod: prev?.paymentMethod || quickPaymentMethod,
        cashProvided: prev?.cashProvided || (quickCashAmount ? parseFloat(quickCashAmount) : null),
        notes: prev?.notes || '',
        items: existingItems,
        matchedCount: existingItems.length
      };
    });
    showMessage(`+ 1 ${sugg.name} agregado`);
  };

  if (!isOpen) return null;

  const totalCalculated = (parsedResult?.items || []).reduce(
    (sum, it) => sum + (it.finalPrice || 0) * (it.quantity || 1), 0
  );

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={modalRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: isMinimized ? '340px' : (isWide ? '780px' : '620px'),
          maxWidth: 'calc(100vw - 20px)',
        }}
        className="pointer-events-auto absolute bg-[#05080c] border-2 border-purple-500/50 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 transition-all duration-150 backdrop-blur-xl max-h-[90vh]"
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="bg-[#0e071e] p-3.5 border-b border-purple-500/30 flex items-center justify-between cursor-move select-none shrink-0"
        >
          <div className="flex items-center gap-2.5">
            <div className="text-purple-400 flex items-center">
              <Icon name="drag_indicator" size={18} />
            </div>
            <div className="relative">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all ${
                isLiveListening ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/40 animate-pulse' : 'bg-[#150a2b] text-purple-400 border border-purple-500/30'
              }`}>
                <Icon name={isLiveListening ? "mic" : "mic_off"} size={18} />
              </div>
              {isLiveListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-purple-400 animate-ping"></span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  Toma Rápida por Voz + Opciones
                </span>
                <span className="text-[8px] bg-purple-950 text-purple-300 px-1.5 py-0.5 rounded-full font-black border border-purple-500/40">
                  IA VOZ
                </span>
              </div>
              <p className="text-[10px] text-purple-300/80 font-bold uppercase">
                {isLiveListening ? 'Escuchando en vivo...' : 'En pausa (Toca micrófono para reanudar)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsWide(!isWide)}
              className="w-7 h-7 rounded-lg bg-[#150a2b] hover:bg-[#220f44] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-all border border-purple-500/20 cursor-pointer"
              title={isWide ? 'Vista normal (620px)' : 'Vista amplia (780px)'}
            >
              <Icon name={isWide ? "fullscreen_exit" : "fullscreen"} size={16} />
            </button>
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-7 h-7 rounded-lg bg-[#150a2b] hover:bg-[#220f44] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-all border border-purple-500/20 cursor-pointer"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              <Icon name={isMinimized ? "expand_less" : "expand_more"} size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#1c0822] hover:bg-red-950 text-slate-400 hover:text-red-400 flex items-center justify-center text-xs transition-all border border-red-500/20 cursor-pointer"
              title="Cerrar pedido por voz"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
        </div>

        {/* Minimized Bar */}
        {isMinimized ? (
          <div className="p-3 bg-[#080d14] flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleListening}
              className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                isLiveListening ? 'bg-purple-600 text-white animate-pulse' : 'bg-[#101926] text-purple-400 border border-purple-500/30'
              }`}
            >
              <Icon name={isLiveListening ? "mic" : "mic_off"} size={14} />
              <span>{isLiveListening ? 'Escuchando...' : 'Pausado'}</span>
            </button>

            {parsedResult && parsedResult.items.length > 0 ? (
              <button
                type="button"
                onClick={() => handleApplyBatchAndContinue(false)}
                className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black text-xs uppercase flex items-center gap-1 shadow-md shadow-purple-500/30 cursor-pointer"
              >
                <Icon name="add_shopping_cart" size={14} />
                <span>+ Cargar ({parsedResult.items.length})</span>
              </button>
            ) : (
              <span className="text-[10px] text-slate-400 font-bold truncate">
                {transcript || 'Dicta los productos libremente...'}
              </span>
            )}
          </div>
        ) : (
          /* Expanded Body */
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-[#06030c]">
            <div className="p-4 space-y-3 overflow-y-auto no-scrollbar flex-1">
              {/* Live Status Strip */}
              <div className="bg-gradient-to-r from-[#120726] to-[#0a0316] p-3 rounded-2xl border border-purple-500/30 flex items-center justify-between gap-3 shadow-inner">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleListening}
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-lg cursor-pointer ${
                      isLiveListening
                        ? 'bg-purple-600 text-white scale-105 shadow-purple-500/50 animate-pulse'
                        : 'bg-[#180b33] text-purple-300 border border-purple-500/40 hover:bg-[#261050]'
                    }`}
                    title={isLiveListening ? 'Pausar dictado' : 'Reanudar dictado'}
                  >
                    <Icon name={isLiveListening ? "mic" : "mic_off"} size={22} />
                  </button>

                  <div>
                    <div className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                      <span>{isLiveListening ? 'Dictado continuo activo' : 'Dictado pausado'}</span>
                    </div>
                    <div className="text-[10px] text-purple-300/80 font-medium">
                      {isLiveListening ? 'Habla y los productos se detectarán en tiempo real.' : 'Toca el micrófono para comenzar o reanudar.'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setShowQuickSettings(!showQuickSettings)}
                    className={`px-2.5 py-1.5 rounded-xl font-black text-[10px] uppercase border transition-all flex items-center gap-1 cursor-pointer ${
                      showQuickSettings 
                        ? 'bg-purple-600 text-white border-purple-400' 
                        : 'bg-[#14082c] text-purple-300 border-purple-500/30 hover:bg-purple-900/40'
                    }`}
                  >
                    <Icon name="tune" size={13} />
                    <span>{showQuickSettings ? 'Ocultar Opciones' : 'Destino & Pago'}</span>
                  </button>
                </div>
              </div>

              {micError && (
                <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-[11px] text-red-200 flex items-center gap-2">
                  <Icon name="warning" size={16} className="text-red-400 shrink-0" />
                  <span>{micError}</span>
                </div>
              )}

              {/* QUICK SETTINGS (Destino + Pago + Cliente) */}
              {showQuickSettings && (
                <div className="bg-[#0b0518] border border-purple-500/30 rounded-2xl p-3 space-y-3 animate-in fade-in-50 text-left">
                  {/* 1. Destino Rápido: Mostrador, Envío, Mesa */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                      <span>1. Tipo / Destino del Pedido</span>
                      <span className="text-purple-300 font-bold lowercase">{quickDestination}</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'Local', label: '🏢 Mostrador' },
                        { id: 'Envío', label: '🛵 Envío' },
                        { id: 'Mesa', label: '🍽️ Mesa' }
                      ].map(d => (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => setQuickDestination(d.id as any)}
                          className={`p-1.5 rounded-xl text-xs font-black uppercase border transition-all cursor-pointer text-center ${
                            quickDestination === d.id
                              ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                              : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-purple-400'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>

                    {/* Mesa Number Selector if Mesa is chosen */}
                    {quickDestination === 'Mesa' && (
                      <div className="pt-1.5 flex items-center gap-2">
                        <span className="text-[10px] font-black uppercase text-blue-400 shrink-0">N° Mesa:</span>
                        <div className="flex gap-1 overflow-x-auto no-scrollbar py-0.5">
                          {Array.from({ length: 20 }, (_, i) => i + 1).map(num => (
                            <button
                              key={num}
                              type="button"
                              onClick={() => setQuickTableNumber(num)}
                              className={`w-7 h-7 rounded-lg text-xs font-black font-mono shrink-0 transition-all border cursor-pointer ${
                                quickTableNumber === num
                                  ? 'bg-blue-600 text-white border-blue-400 shadow-md'
                                  : 'bg-[#06020e] text-slate-400 border-purple-500/20 hover:text-white'
                              }`}
                            >
                              #{num}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. Método de Pago Rápido */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-slate-400 flex items-center justify-between">
                      <span>2. Método de Pago</span>
                      <span className="text-purple-300 font-bold">{quickPaymentMethod}</span>
                    </label>
                    <div className="grid grid-cols-3 sm:grid-cols-5 gap-1">
                      {['Efectivo', 'Débito', 'Crédito', 'Transferencia', 'Mercado Pago'].map(pm => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setQuickPaymentMethod(pm)}
                          className={`p-1.5 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer text-center ${
                            quickPaymentMethod === pm
                              ? 'bg-emerald-600 text-white border-emerald-400 shadow-md'
                              : 'bg-[#06020e] text-slate-300 border-purple-500/20 hover:border-emerald-500/50'
                          }`}
                        >
                          {pm === 'Efectivo' ? '💵 Efect.' : pm === 'Débito' ? '💳 Déb.' : pm === 'Crédito' ? '💳 Créd.' : pm === 'Transferencia' ? '📲 Transf.' : '📱 MP'}
                        </button>
                      ))}
                    </div>

                    {quickPaymentMethod === 'Efectivo' && (
                      <div className="flex items-center gap-2 pt-1">
                        <span className="text-[10px] font-black uppercase text-emerald-400 shrink-0">Paga con $:</span>
                        <input
                          type="number"
                          placeholder="Ej: 1000"
                          value={quickCashAmount}
                          onChange={e => setQuickCashAmount(e.target.value)}
                          className="flex-1 p-1.5 bg-[#06020e] border border-emerald-500/40 text-emerald-300 rounded-lg text-xs font-mono font-black outline-none focus:border-emerald-400"
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. Cliente Registrado o Nuevo */}
                  <div className="space-y-1.5 relative">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-black uppercase text-slate-400">
                        3. Cliente (Directorio o Nuevo)
                      </label>
                      {selectedClient && (
                        <button
                          type="button"
                          onClick={() => { setSelectedClient(null); setClientSearchQuery(''); }}
                          className="text-[9px] text-red-400 hover:underline font-bold uppercase cursor-pointer"
                        >
                          Quitar selección
                        </button>
                      )}
                    </div>

                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Buscar cliente en directorio..."
                        value={selectedClient ? `${selectedClient.name} (${selectedClient.phone || 'S/N'})` : clientSearchQuery}
                        onChange={e => {
                          setSelectedClient(null);
                          setClientSearchQuery(e.target.value);
                          setShowClientDropdown(true);
                        }}
                        onFocus={() => setShowClientDropdown(true)}
                        className="w-full p-2 bg-[#06020e] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400"
                      />
                    </div>

                    {showClientDropdown && !selectedClient && filteredClients.length > 0 && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 max-h-36 overflow-y-auto bg-[#090314] border border-purple-500/40 rounded-xl shadow-2xl p-1 space-y-1">
                        {filteredClients.map(c => (
                          <div
                            key={c.firestoreId}
                            onClick={() => {
                              setSelectedClient(c);
                              setCustomClientName(c.name || '');
                              setCustomClientPhone(c.phone || '');
                              setCustomClientAddress(c.address || '');
                              setShowClientDropdown(false);
                            }}
                            className="p-2 rounded-lg bg-[#06020e] hover:bg-purple-950 border border-purple-500/15 cursor-pointer text-left transition-colors flex items-center justify-between"
                          >
                            <div>
                              <div className="text-xs font-black uppercase text-white">{c.name}</div>
                              <div className="text-[9px] text-purple-300">{c.phone || 'Sin cel'} • {c.address || 'Mostrador'}</div>
                            </div>
                            <span className="text-[9px] bg-purple-900 text-purple-200 px-1.5 py-0.5 rounded font-black">ELEGIR</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {!selectedClient && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="Nombre Cliente"
                          value={customClientName}
                          onChange={e => setCustomClientName(e.target.value.toUpperCase())}
                          className="p-1.5 bg-[#06020e] border border-purple-500/20 text-white rounded-lg text-xs font-bold uppercase outline-none focus:border-purple-400"
                        />
                        <input
                          type="text"
                          placeholder="Celular"
                          value={customClientPhone}
                          onChange={e => setCustomClientPhone(e.target.value)}
                          className="p-1.5 bg-[#06020e] border border-purple-500/20 text-white rounded-lg text-xs font-mono font-bold outline-none focus:border-purple-400"
                        />
                        {quickDestination === 'Envío' && (
                          <input
                            type="text"
                            placeholder="Dirección entrega"
                            value={customClientAddress}
                            onChange={e => setCustomClientAddress(e.target.value)}
                            className="p-1.5 bg-[#06020e] border border-purple-500/20 text-white rounded-lg text-xs font-bold uppercase outline-none focus:border-purple-400 col-span-2 sm:col-span-1"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Lo Más Pedido / Ranking Rápido */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1 px-1">
                  <span className="flex items-center gap-1 text-purple-400">
                    <Icon name="trending_up" size={13} /> Lo Más Pedido (Toca para agregar)
                  </span>
                  <span className="text-[9px] text-slate-500">Popular</span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {POPULAR_SUGGESTIONS.map(sugg => (
                    <button
                      key={sugg.name}
                      type="button"
                      onClick={() => handleAddPopularItem(sugg)}
                      className="px-2.5 py-1.5 bg-[#0a0416] hover:bg-purple-950/80 border border-purple-500/30 hover:border-purple-400 text-purple-200 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-1.5 cursor-pointer"
                      title={`Agregar 1x ${sugg.name} ($${sugg.price})`}
                    >
                      <span>{sugg.icon}</span>
                      <span>{sugg.name}</span>
                      <span className="text-purple-400 font-mono text-[9px]">${sugg.price}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Transcript Area */}
              <div>
                <div className="flex items-center justify-between text-[10px] font-black uppercase text-purple-300 mb-1 px-1">
                  <span>Texto Reconocido por Voz</span>
                  <div className="flex items-center gap-2">
                    {transcript && (
                      <button
                        type="button"
                        onClick={() => { setTranscript(''); setParsedResult(null); }}
                        className="text-slate-400 hover:text-red-400 flex items-center gap-1 font-bold cursor-pointer"
                      >
                        <Icon name="clear" size={12} />
                        <span>Limpiar</span>
                      </button>
                    )}
                    <span className="text-slate-500">{transcript.length} carac.</span>
                  </div>
                </div>
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  placeholder='Dicta productos, ej: "2 fainá con queso, 1 pizza con jamón y morrón, para enviar a Juan en 18 de julio"'
                  rows={2}
                  className="w-full bg-[#040108] border border-purple-500/30 focus:border-purple-400 rounded-2xl p-2.5 text-xs text-purple-100 placeholder-slate-600 focus:outline-none transition-all resize-none shadow-inner font-medium"
                />
              </div>

              {/* PRODUCTOS DETECTADOS EN TIEMPO REAL */}
              <div className="bg-[#090314] border-2 border-purple-500/40 rounded-2xl p-3.5 space-y-2.5 shadow-xl">
                <div className="flex items-center justify-between border-b border-purple-500/25 pb-2">
                  <div className="flex items-center gap-2 text-xs font-black uppercase text-white">
                    <Icon name="shopping_bag" size={17} className="text-purple-400" />
                    <span>Productos Detectados ({parsedResult?.items.length || 0})</span>
                  </div>
                  <div className="text-base font-black text-emerald-400 font-mono">
                    Total: ${totalCalculated}
                  </div>
                </div>

                {(!parsedResult || parsedResult.items.length === 0) ? (
                  <div className="text-center py-4 text-xs font-bold text-slate-400 bg-[#06020e] border border-purple-500/15 rounded-xl p-3">
                    {transcript.trim() 
                      ? 'Reconociendo frase... Continúa dictando o toca los atajos rápidos de arriba.' 
                      : '🎙️ Dicta productos con el micrófono o toca los botones populares para agregarlos a la comanda.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1 no-scrollbar">
                    {parsedResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0e0620] border border-purple-500/30 p-2.5 rounded-xl flex items-center justify-between gap-3 hover:border-purple-400 transition-all shadow-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1 bg-[#06020e] p-0.5 rounded-lg border border-purple-500/30 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, -1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-purple-950 text-sm font-black cursor-pointer"
                              >
                                -
                              </button>
                              <span className="w-6 text-center font-black text-xs text-purple-200 font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 1)}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-purple-950 text-sm font-black cursor-pointer"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-xs font-black uppercase text-white truncate">
                              {item.name}
                            </span>
                          </div>

                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 pl-16">
                              {item.selectedToppings.map((top, tidx) => (
                                <span
                                  key={tidx}
                                  className="px-1.5 py-0.5 bg-purple-950 border border-purple-500/40 text-purple-300 rounded text-[9px] font-bold"
                                >
                                  +{top.name} {top.price > 0 ? `(+$${top.price})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <div className="text-sm font-black text-emerald-400 font-mono">
                              ${item.finalPrice * item.quantity}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono">
                              ${item.finalPrice} c/u
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-950/50 rounded-lg transition-all cursor-pointer"
                            title="Quitar producto"
                          >
                            <Icon name="delete" size={17} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* STICKY BOTTOM ACTION FOOTER */}
            {parsedResult && parsedResult.items.length > 0 && (
              <div className="p-3.5 bg-[#0a0416] border-t border-purple-500/30 grid grid-cols-2 gap-2 shrink-0 shadow-2xl">
                <button
                  type="button"
                  onClick={() => handleApplyBatchAndContinue(false)}
                  className="py-3.5 px-3 bg-[#16082c] hover:bg-[#230d45] border border-purple-500/50 text-purple-200 font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg cursor-pointer"
                >
                  <Icon name="add_shopping_cart" size={17} />
                  <span>+ Cargar a Comanda ({parsedResult.items.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyBatchAndContinue(true)}
                  className="py-3.5 px-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs uppercase rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/40 cursor-pointer"
                >
                  <Icon name="local_fire_department" size={17} />
                  <span>Enviar a Cocina</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
