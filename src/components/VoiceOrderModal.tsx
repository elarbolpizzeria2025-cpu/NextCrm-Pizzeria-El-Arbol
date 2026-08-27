import React, { useState, useEffect, useRef } from 'react';
import { MenuItem, Topping } from '../types';
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
  toppings: Topping[];
  onApplyToCart: (parsed: ParsedVoiceOrder, autoSubmit?: boolean) => void;
  showMessage: (text: string, type?: 'success' | 'error') => void;
}

export const VoiceOrderModal: React.FC<VoiceOrderModalProps> = ({
  isOpen,
  onClose,
  menu,
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

  const modalRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Draggable floating window state
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 24, y: 70 });
  const isDraggingRef = useRef(false);
  const dragStartOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    if (isOpen) {
      const initialY = Math.max(65, Math.min(window.innerHeight - 560, 80));
      const initialX = Math.max(16, Math.min(window.innerWidth - 480, 24));
      setPosition({ x: initialX, y: initialY });
      startContinuousListening();
    } else {
      stopListening();
    }
  }, [isOpen]);

  // Dragging logic
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('button') || (e.target as HTMLElement).closest('input') || (e.target as HTMLElement).closest('textarea')) {
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
    const newX = Math.max(8, Math.min(window.innerWidth - 380, e.clientX - dragStartOffsetRef.current.x));
    const newY = Math.max(50, Math.min(window.innerHeight - 120, e.clientY - dragStartOffsetRef.current.y));
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
      setMicError('El navegador no soporta reconocimiento de voz nativo. Puedes escribir el pedido.');
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
      // On pause, parse the current transcript automatically
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
      setParsedResult(null);
      return;
    }
    const parsed = parseVoiceOrderHeuristic(transcript, menu, toppings);
    setParsedResult(parsed);
  }, [transcript, menu, toppings]);

  // Loading items and resetting for next batch of spoken items
  const handleApplyBatchAndContinue = (autoSubmit = false) => {
    if (!parsedResult || (parsedResult.items.length === 0 && !parsedResult.notes && !parsedResult.destination && !parsedResult.paymentMethod)) {
      showMessage('No se detectaron artículos para cargar', 'error');
      return;
    }

    onApplyToCart(parsedResult, autoSubmit);
    // Clear transcript and parsed state to allow adding more items immediately!
    setTranscript('');
    setParsedResult(null);
    
    // Ensure dictation continues seamlessly
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
    { name: 'Pizza Mozzarella', price: 280, category: 'Pizzas', icon: '🍕' },
    { name: 'Fainá con Queso', price: 160, category: 'Fainá', icon: '🧀' },
    { name: 'Fainá Clásico', price: 110, category: 'Fainá', icon: '🔥' },
    { name: 'Promo 2 Fainá + Muzza', price: 420, category: 'Promos', icon: '⭐' },
    { name: 'Sándwich Caliente', price: 220, category: 'Minutas', icon: '🥪' },
    { name: 'Coca Cola 1.5L', price: 170, category: 'Bebidas', icon: '🥤' },
    { name: 'Empanada Jamón y Queso', price: 95, category: 'Empanadas', icon: '🥟' },
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
        destination: prev?.destination || null,
        paymentMethod: prev?.paymentMethod || null,
        cashProvided: prev?.cashProvided || null,
        notes: prev?.notes || '',
        items: existingItems,
        matchedCount: existingItems.length
      };
    });
    showMessage(`+ 1 ${sugg.name} agregado`);
  };

  if (!isOpen) return null;

  const totalCalculated = parsedResult?.items.reduce(
    (sum, it) => sum + (it.finalPrice || 0) * (it.quantity || 1), 0
  ) || 0;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={modalRef}
        style={{
          transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          width: isMinimized ? '340px' : '450px',
          maxWidth: 'calc(100vw - 32px)',
        }}
        className="pointer-events-auto absolute bg-[#05080c] border border-blue-500/30 rounded-3xl shadow-2xl overflow-hidden flex flex-col text-slate-100 transition-all duration-150 backdrop-blur-xl"
      >
        {/* Draggable Header */}
        <div
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          className="bg-[#0b1219] p-3.5 border-b border-blue-500/20 flex items-center justify-between cursor-move select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="text-blue-400 flex items-center">
              <Icon name="drag_indicator" size={18} />
            </div>
            <div className="relative">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black transition-all ${
                isLiveListening ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/40 animate-pulse' : 'bg-[#0f1722] text-blue-400 border border-blue-500/30'
              }`}>
                <Icon name={isLiveListening ? "mic" : "mic_off"} size={18} />
              </div>
              {isLiveListening && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-blue-400 animate-ping"></span>
              )}
            </div>

            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black uppercase text-white tracking-wider">
                  Dictado Continuo de Pedidos
                </span>
                <span className="text-[8px] bg-blue-950 text-blue-300 px-1.5 py-0.5 rounded-full font-black border border-blue-500/40">
                  VOZ DIRECTA
                </span>
              </div>
              <p className="text-[10px] text-blue-400/80 font-bold uppercase">
                {isLiveListening ? 'Escuchando en vivo...' : 'En pausa (Toca micrófono para reanudar)'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMinimized(!isMinimized)}
              className="w-7 h-7 rounded-lg bg-[#0f1722] hover:bg-[#162232] text-slate-300 hover:text-white flex items-center justify-center text-xs transition-all border border-blue-500/20"
              title={isMinimized ? 'Expandir' : 'Minimizar'}
            >
              <Icon name={isMinimized ? "expand_less" : "expand_more"} size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded-lg bg-[#141b24] hover:bg-red-950 text-slate-400 hover:text-red-400 flex items-center justify-center text-xs transition-all border border-red-500/20"
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
              className={`px-3 py-1.5 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all ${
                isLiveListening ? 'bg-blue-600 text-white animate-pulse' : 'bg-[#101926] text-blue-400 border border-blue-500/30'
              }`}
            >
              <Icon name={isLiveListening ? "mic" : "mic_off"} size={14} />
              <span>{isLiveListening ? 'Escuchando...' : 'Pausado'}</span>
            </button>

            {parsedResult && parsedResult.items.length > 0 ? (
              <button
                type="button"
                onClick={() => handleApplyBatchAndContinue(false)}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-black text-xs uppercase flex items-center gap-1 shadow-md shadow-blue-500/30"
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
          <div className="p-4 space-y-3.5 max-h-[82vh] overflow-y-auto no-scrollbar bg-[#060a0f]">
            {/* Live Status Strip */}
            <div className="bg-gradient-to-r from-[#0b1420] to-[#070e17] p-3.5 rounded-2xl border border-blue-500/30 flex items-center justify-between gap-3 shadow-inner">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all shrink-0 shadow-lg ${
                    isLiveListening
                      ? 'bg-blue-600 text-white scale-105 shadow-blue-500/50 animate-pulse'
                      : 'bg-[#101a26] text-blue-400 border border-blue-500/40 hover:bg-[#162334]'
                  }`}
                  title={isLiveListening ? 'Pausar dictado' : 'Reanudar dictado'}
                >
                  <Icon name={isLiveListening ? "mic" : "mic_off"} size={24} />
                </button>

                <div>
                  <div className="text-xs font-black uppercase text-white flex items-center gap-1.5">
                    <span>{isLiveListening ? 'Dictado continuo activo' : 'Dictado pausado'}</span>
                  </div>
                  <div className="text-[10px] text-blue-300/80 font-medium mt-0.5">
                    {isLiveListening ? 'Habla y los productos se detectarán automáticamente.' : 'Toca el micrófono para comenzar o reanudar.'}
                  </div>
                </div>
              </div>

              {parsedResult && parsedResult.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleApplyBatchAndContinue(false)}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase rounded-xl transition-all flex items-center gap-1 shadow-md shadow-blue-500/30"
                  title="Carga los productos actuales y continúa escuchando"
                >
                  <Icon name="add_shopping_cart" size={14} />
                  <span>+ Agregar ({parsedResult.items.length})</span>
                </button>
              )}
            </div>

            {micError && (
              <div className="p-2.5 bg-red-950/60 border border-red-500/40 rounded-xl text-[11px] text-red-200 flex items-center gap-2">
                <Icon name="warning" size={16} className="text-red-400 shrink-0" />
                <span>{micError}</span>
              </div>
            )}

            {/* Lo Más Pedido / Ranking Rápido */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-slate-400 mb-1.5 px-1">
                <span className="flex items-center gap-1 text-blue-400">
                  <Icon name="trending_up" size={13} /> Lo Más Pedido (Agregar con 1 toque)
                </span>
                <span className="text-[9px] text-slate-500">Ranking</span>
              </div>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {POPULAR_SUGGESTIONS.map(sugg => (
                  <button
                    key={sugg.name}
                    type="button"
                    onClick={() => handleAddPopularItem(sugg)}
                    className="px-2.5 py-1.5 bg-[#0a131f] hover:bg-blue-950/80 border border-blue-500/30 hover:border-blue-400 text-blue-200 hover:text-white rounded-xl text-[10px] font-black uppercase transition-all shrink-0 flex items-center gap-1.5 shadow-xs"
                    title={`Agregar 1x ${sugg.name} ($${sugg.price})`}
                  >
                    <span>{sugg.icon}</span>
                    <span>{sugg.name}</span>
                    <span className="text-blue-400 font-mono text-[9px]">${sugg.price}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Transcript Area */}
            <div>
              <div className="flex items-center justify-between text-[10px] font-black uppercase text-blue-400/90 mb-1 px-1">
                <span>Texto Dictado</span>
                <div className="flex items-center gap-2">
                  {transcript && (
                    <button
                      type="button"
                      onClick={() => { setTranscript(''); setParsedResult(null); }}
                      className="text-slate-400 hover:text-red-400 flex items-center gap-1 font-bold"
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
                placeholder='Dicta productos, ej: "2 fainá con queso, 1 pizza con jamón y morrón, nota refresco 1.5 coca cola"'
                rows={2}
                className="w-full bg-[#04070a] border border-blue-500/30 focus:border-blue-400 rounded-2xl p-3 text-xs text-blue-100 placeholder-slate-600 focus:outline-none transition-all resize-none shadow-inner"
              />
            </div>

            {/* Real-time Parsed Items Preview */}
            {parsedResult && (
              <div className="bg-[#091018] border border-blue-500/30 rounded-2xl p-3.5 space-y-3 shadow-lg">
                <div className="flex items-center justify-between border-b border-blue-500/20 pb-2">
                  <div className="flex items-center gap-1.5 text-xs font-black uppercase text-white">
                    <Icon name="check_circle" size={16} className="text-blue-400" />
                    <span>Detectado ({parsedResult.items.length} {parsedResult.items.length === 1 ? 'producto' : 'productos'})</span>
                  </div>
                  <div className="text-sm font-black text-blue-400">
                    Total: ${totalCalculated}
                  </div>
                </div>

                {parsedResult.items.length === 0 ? (
                  <div className="text-center py-2 text-[11px] font-bold text-slate-400 bg-[#060a0f] border border-slate-800 rounded-xl p-2">
                    {transcript.trim() ? 'No se reconoció un ítem del menú en la frase dictada.' : 'Comienza a hablar para detectar productos.'}
                  </div>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                    {parsedResult.items.map((item, idx) => (
                      <div
                        key={idx}
                        className="bg-[#0d1622] border border-blue-500/20 p-2.5 rounded-xl flex items-center justify-between gap-2 hover:border-blue-400/50 transition-all"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            {/* Quantity Controls */}
                            <div className="flex items-center gap-1 bg-[#060b10] p-0.5 rounded-lg border border-blue-500/20 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, -1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-950 text-xs font-black"
                              >
                                -
                              </button>
                              <span className="w-5 text-center font-black text-xs text-blue-400">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateItemQty(idx, 1)}
                                className="w-5 h-5 rounded flex items-center justify-center text-slate-400 hover:text-white hover:bg-blue-950 text-xs font-black"
                              >
                                +
                              </button>
                            </div>

                            <span className="text-xs font-black uppercase text-white truncate">
                              {item.name}
                            </span>
                          </div>

                          {item.selectedToppings && item.selectedToppings.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1 pl-14">
                              {item.selectedToppings.map((top, tidx) => (
                                <span
                                  key={tidx}
                                  className="px-1.5 py-0.2 bg-blue-950 border border-blue-500/30 text-blue-300 rounded text-[9px] font-bold"
                                >
                                  +{top.name} {top.price > 0 ? `(+$${top.price})` : ''}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <div className="text-right">
                            <div className="text-xs font-black text-blue-400">
                              ${item.finalPrice * item.quantity}
                            </div>
                            <div className="text-[9px] text-slate-500">
                              ${item.finalPrice} c/u
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1 text-slate-500 hover:text-red-400 hover:bg-red-950/40 rounded transition-all"
                            title="Quitar producto"
                          >
                            <Icon name="delete" size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Extra Extracted Order Metadata (Destination / Payment / Notes) */}
                {(parsedResult.destination || parsedResult.paymentMethod || parsedResult.notes || parsedResult.cashProvided) && (
                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-500/20 text-[10px]">
                    <div className="bg-[#060a0f] p-2 rounded-lg border border-blue-500/20">
                      <span className="text-slate-500 uppercase font-black block">Destino</span>
                      <span className="font-bold text-blue-300 uppercase">
                        {parsedResult.destination || 'Local'}
                      </span>
                    </div>
                    <div className="bg-[#060a0f] p-2 rounded-lg border border-blue-500/20">
                      <span className="text-slate-500 uppercase font-black block">Pago</span>
                      <span className="font-bold text-blue-300 uppercase">
                        {parsedResult.paymentMethod || 'Efectivo'} {parsedResult.cashProvided ? `($${parsedResult.cashProvided})` : ''}
                      </span>
                    </div>
                    <div className="bg-[#060a0f] p-2 rounded-lg border border-blue-500/20 truncate">
                      <span className="text-slate-500 uppercase font-black block">Nota</span>
                      <span className="font-bold text-blue-300 truncate block">
                        {parsedResult.notes || 'Ninguna'}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            {parsedResult && parsedResult.items.length > 0 && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleApplyBatchAndContinue(false)}
                  className="py-3 px-3 bg-[#0d1825] hover:bg-[#132336] border border-blue-500/40 text-blue-300 font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg"
                >
                  <Icon name="add_shopping_cart" size={16} />
                  <span>+ Agregar ({parsedResult.items.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleApplyBatchAndContinue(true)}
                  className="py-3 px-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs uppercase rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-lg shadow-blue-500/30"
                >
                  <Icon name="local_fire_department" size={16} />
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
