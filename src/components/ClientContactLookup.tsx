import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ClientData } from '../types';
import { Icon } from './Icon';
import { collection, addDoc } from 'firebase/firestore';

interface ClientContactLookupProps {
  allClients: ClientData[];
  clientInfo: {
    phone: string;
    name: string;
    address: string;
    zone: string;
    notes?: string;
    tableNumber?: number | string;
    assignedWaiter?: string;
    assignedDriver?: string;
    assignedDriverId?: string;
  };
  setClientInfo: React.Dispatch<React.SetStateAction<any>>;
  orderType: string;
  setOrderType?: (t: string) => void;
  mode: 'delivery' | 'counter';
  showMessage?: (msg: string, type?: 'success' | 'error') => void;
  db?: any;
  appId?: string;
}

export const ClientContactLookup: React.FC<ClientContactLookupProps> = ({
  allClients,
  clientInfo,
  setClientInfo,
  orderType,
  setOrderType,
  mode,
  showMessage,
  db,
  appId,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [isSavingDirect, setIsSavingDirect] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // When dropdown opens, optionally focus the dropdown search input
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setDropdownSearch('');
    }
  }, [isOpen]);

  // Clean values
  const cleanPhoneDigits = useMemo(() => {
    return String(clientInfo.phone || '').trim().replace(/\D/g, '');
  }, [clientInfo.phone]);

  const cleanNameQuery = useMemo(() => {
    const n = String(clientInfo.name || '').trim().toLowerCase();
    if (n === 'consumidor final' || n === 'sin nombre' || n.startsWith('mesa #')) return '';
    return n;
  }, [clientInfo.name]);

  // Combined search term: dropdownSearch has priority if user types in it, otherwise fields
  const activeSearchTerm = useMemo(() => {
    if (dropdownSearch.trim()) return dropdownSearch.trim().toLowerCase();
    if (cleanPhoneDigits) return cleanPhoneDigits;
    if (cleanNameQuery) return cleanNameQuery;
    return '';
  }, [dropdownSearch, cleanPhoneDigits, cleanNameQuery]);

  // Filter clients based on search across all 500+ database records
  const filteredClients = useMemo(() => {
    const term = activeSearchTerm.trim().toLowerCase();
    const termDigits = term.replace(/\D/g, '');

    if (!term) {
      // Return top 150 clients when no query is typed
      return allClients.slice(0, 150);
    }

    return allClients.filter(c => {
      const cPhoneRaw = c.phone && c.phone !== 'N/A' ? String(c.phone).trim() : '';
      const cPhoneDigits = cPhoneRaw.replace(/\D/g, '');
      const cName = c.name && c.name !== 'Sin Nombre' ? String(c.name).toLowerCase() : '';
      const cAddress = c.address && c.address !== 'N/A' ? String(c.address).toLowerCase() : '';
      const cZone = c.zone && c.zone !== 'N/A' ? String(c.zone).toLowerCase() : '';

      // Match phone digits
      if (termDigits.length > 0 && cPhoneDigits.includes(termDigits)) {
        return true;
      }

      // Match name
      if (cName.includes(term)) {
        return true;
      }

      // Match address or zone
      if (cAddress.includes(term) || cZone.includes(term)) {
        return true;
      }

      return false;
    }).slice(0, 150);
  }, [allClients, activeSearchTerm]);

  // Check if current phone or name exactly matches an existing client in DB
  const exactMatchedClient = useMemo(() => {
    if (!cleanPhoneDigits && !cleanNameQuery) return null;
    return allClients.find(c => {
      const cPhoneDigits = String(c.phone || '').trim().replace(/\D/g, '');
      const cName = String(c.name || '').trim().toLowerCase();
      const matchPhone = cleanPhoneDigits && cPhoneDigits && (cleanPhoneDigits === cPhoneDigits || (cleanPhoneDigits.length >= 8 && cPhoneDigits.includes(cleanPhoneDigits)));
      const matchName = cleanNameQuery && cName && cName === cleanNameQuery;
      return matchPhone || matchName;
    }) || null;
  }, [allClients, cleanPhoneDigits, cleanNameQuery]);

  const handleSelect = (client: ClientData) => {
    const rawPhone = client.phone === 'N/A' ? '' : (client.phone || '');
    const rawAddress = client.address === 'N/A' ? '' : (client.address || '');
    const rawZone = client.zone === 'N/A' ? '' : (client.zone || '');

    setClientInfo((prev: any) => ({
      ...prev,
      name: client.name || '',
      phone: rawPhone,
      address: rawAddress,
      zone: rawZone,
      notes: client.notes || prev.notes || ''
    }));

    if (rawAddress.trim().length > 0 && setOrderType) {
      if (orderType === 'Local') {
        setOrderType('Envío');
      }
    }

    setIsOpen(false);
    if (showMessage) {
      showMessage(`✓ Contacto cargado: ${client.name}`, 'success');
    }
  };

  const handleClear = () => {
    setClientInfo((prev: any) => ({
      ...prev,
      name: mode === 'counter' ? 'CONSUMIDOR FINAL' : '',
      phone: '',
      address: '',
      zone: ''
    }));
    setIsOpen(false);
  };

  const handleSaveContactDirect = async () => {
    if (!db || !appId) return;
    const phoneToSave = String(clientInfo.phone || '').trim();
    const nameToSave = String(clientInfo.name || '').trim();

    if (!phoneToSave && !nameToSave) {
      if (showMessage) showMessage("Ingrese nombre o teléfono para guardar", "error");
      return;
    }

    setIsSavingDirect(true);
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
        name: nameToSave || 'Cliente',
        phone: phoneToSave || '',
        address: clientInfo.address || '',
        zone: clientInfo.zone || '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastOrderAt: Date.now(),
        orderCount: 1
      });
      if (showMessage) {
        showMessage(`✓ Cliente "${nameToSave || phoneToSave}" guardado en la base de datos`, "success");
      }
      setIsOpen(false);
    } catch (e: any) {
      console.error("Error saving client:", e);
      if (showMessage) showMessage("Error al guardar cliente: " + e.message, "error");
    } finally {
      setIsSavingDirect(false);
    }
  };

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      {/* Top Banner if client is matched from database */}
      {exactMatchedClient && (
        <div className="flex items-center justify-between px-2.5 py-1 bg-emerald-950/70 border border-emerald-500/40 rounded-lg text-emerald-200 text-[10px] animate-in fade-in">
          <div className="flex items-center gap-1.5 font-black truncate">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
            <span className="text-emerald-400 uppercase">Cliente Registrado:</span>
            <span className="text-white font-bold truncate">{exactMatchedClient.name}</span>
            {exactMatchedClient.address && exactMatchedClient.address !== 'N/A' && (
              <span className="text-emerald-300 font-normal hidden sm:inline truncate">
                • 🏠 {exactMatchedClient.address} {exactMatchedClient.zone && exactMatchedClient.zone !== 'N/A' ? `(${exactMatchedClient.zone})` : ''}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-[9px] text-emerald-400 hover:text-white underline shrink-0 cursor-pointer ml-2"
          >
            Limpiar
          </button>
        </div>
      )}

      {/* Input Grid */}
      <div className="grid grid-cols-2 gap-2">
        {/* Phone Input */}
        <div className="space-y-0.5 relative">
          <label className="text-[9px] font-black text-slate-400 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Icon name="phone" size={11} className="text-purple-400" />
              <span>Teléfono / Contacto</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-purple-400 hover:text-purple-300 text-[8.5px] font-bold flex items-center gap-1 px-1.5 py-0.5 bg-purple-950/60 border border-purple-500/30 rounded cursor-pointer transition-colors"
              title="Abrir base de datos de clientes"
            >
              <Icon name="database" size={10} />
              <span>{allClients.length} Clientes</span>
            </button>
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="098356320"
              value={clientInfo.phone}
              onFocus={() => setIsOpen(true)}
              onChange={e => {
                setClientInfo((prev: any) => ({ ...prev, phone: e.target.value }));
                setIsOpen(true);
              }}
              className="w-full p-2 pr-7 bg-[#06020e] border border-purple-500/30 text-white rounded-xl text-xs font-black font-mono outline-none focus:border-purple-400 transition-colors"
            />
            {clientInfo.phone ? (
              <button
                type="button"
                onClick={() => setClientInfo((prev: any) => ({ ...prev, phone: '' }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 text-xs font-black cursor-pointer"
                title="Borrar teléfono"
              >
                ✕
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsOpen(true)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-purple-400 hover:text-purple-300 p-0.5 cursor-pointer"
                title="Buscar en base de datos"
              >
                <Icon name="search" size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Client Name Input */}
        <div className="space-y-0.5 relative">
          <label className="text-[9px] font-black text-slate-400 uppercase flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Icon name="person" size={11} className="text-purple-400" />
              <span>{mode === 'counter' ? 'Nombre / Cliente' : 'Nombre Cliente'}</span>
            </span>
            {clientInfo.name && clientInfo.name !== 'CONSUMIDOR FINAL' && (
              <span className="text-[8px] text-purple-300 font-mono font-bold">
                {exactMatchedClient ? '✓ En Base de Datos' : 'Nuevo'}
              </span>
            )}
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder={mode === 'counter' ? 'CONSUMIDOR FINAL' : 'Nombre del cliente'}
              value={clientInfo.name}
              onFocus={() => setIsOpen(true)}
              onChange={e => {
                setClientInfo((prev: any) => ({ ...prev, name: e.target.value.toUpperCase() }));
                setIsOpen(true);
              }}
              className="w-full p-2 pr-7 bg-[#06020e] border border-purple-500/30 text-white rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400 transition-colors"
            />
            {clientInfo.name && clientInfo.name !== 'CONSUMIDOR FINAL' && (
              <button
                type="button"
                onClick={() => setClientInfo((prev: any) => ({ ...prev, name: mode === 'counter' ? 'CONSUMIDOR FINAL' : '' }))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 p-0.5 text-xs font-black cursor-pointer"
                title="Borrar nombre"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Real-time Dynamic Database Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#100722] border-2 border-purple-500/60 rounded-2xl shadow-2xl shadow-black/95 z-50 overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-150">
          {/* Header of Dropdown */}
          <div className="px-3 py-2 bg-[#170c30] border-b border-purple-500/20 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[10px] font-black text-purple-200 uppercase tracking-wider">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span>Base de Datos de Contactos</span>
              <span className="text-purple-300 font-mono text-[9px] bg-purple-950 px-2 py-0.5 rounded-full border border-purple-500/40">
                {allClients.length} Clientes Reales
              </span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-0.5 text-xs font-black cursor-pointer"
              title="Cerrar sugerencias"
            >
              ✕
            </button>
          </div>

          {/* Quick Filter Search Bar directly inside Dropdown */}
          <div className="p-2 bg-[#0b0416] border-b border-purple-500/20">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={dropdownSearch}
                onChange={e => setDropdownSearch(e.target.value)}
                placeholder="🔍 Buscar por nombre, teléfono, zona o dirección..."
                className="w-full py-1.5 px-2.5 pr-7 bg-[#17092e] border border-purple-500/40 rounded-xl text-xs text-white placeholder-slate-400 font-medium outline-none focus:border-purple-300 transition-colors"
              />
              {dropdownSearch && (
                <button
                  type="button"
                  onClick={() => setDropdownSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1 px-1 text-[9px] text-slate-400 font-medium">
              <span>
                {activeSearchTerm ? (
                  <span>Filtrando por: <strong className="text-purple-300 font-mono">"{activeSearchTerm}"</strong></span>
                ) : (
                  <span className="text-slate-400">Mostrando contactos ordenados por actividad y nombre</span>
                )}
              </span>
              <span className="text-purple-300 font-mono font-bold">
                {filteredClients.length} {filteredClients.length === 1 ? 'contacto' : 'contactos'}
              </span>
            </div>
          </div>

          {/* Results List with smooth scrolling through all database records */}
          <div className="max-h-64 overflow-y-auto divide-y divide-purple-500/15 custom-scrollbar bg-[#0f071f]">
            {filteredClients.length > 0 ? (
              filteredClients.map((c, idx) => {
                const initials = (c.name || 'C')
                  .trim()
                  .split(' ')
                  .map(n => n[0])
                  .filter(Boolean)
                  .slice(0, 2)
                  .join('')
                  .toUpperCase() || 'CL';

                const isCurrentlyLoaded =
                  clientInfo.phone &&
                  c.phone &&
                  clientInfo.phone.replace(/\D/g, '') === c.phone.replace(/\D/g, '');

                const hasValidPhone = c.phone && c.phone !== 'N/A' && c.phone.trim().length > 0;
                const hasValidAddress = c.address && c.address !== 'N/A' && c.address.trim().length > 0;
                const hasValidZone = c.zone && c.zone !== 'N/A' && c.zone.trim().length > 0;

                return (
                  <div
                    key={c.firestoreId || `${c.phone}-${idx}`}
                    onClick={() => handleSelect(c)}
                    className={`p-2.5 hover:bg-purple-600/30 cursor-pointer transition-colors flex items-center justify-between gap-2.5 ${
                      isCurrentlyLoaded ? 'bg-purple-900/40 border-l-4 border-purple-400' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-[#211042] border border-purple-500/40 text-purple-200 font-black text-xs flex items-center justify-center shrink-0">
                        {initials}
                      </div>
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-xs text-white uppercase truncate">
                            {c.name || 'Sin Nombre'}
                          </span>
                          {hasValidZone && (
                            <span className="text-[8px] bg-purple-950/80 text-purple-300 font-bold px-1.5 py-0.2 rounded border border-purple-500/30 uppercase truncate max-w-[140px]">
                              📍 {c.zone}
                            </span>
                          )}
                          {(c as any).orderCount && (c as any).orderCount > 1 && (
                            <span className="text-[8px] bg-amber-950 text-amber-300 font-bold px-1.5 py-0.2 rounded border border-amber-500/30">
                              ⭐ {(c as any).orderCount} pedidos
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 text-[10.5px] text-slate-300 font-mono flex-wrap">
                          {hasValidPhone && (
                            <span className="text-cyan-300 flex items-center gap-0.5 font-bold">
                              <Icon name="phone" size={10} />
                              <span>{c.phone}</span>
                            </span>
                          )}
                          {hasValidAddress && (
                            <span className="text-slate-300 truncate flex items-center gap-0.5 max-w-[220px]">
                              <Icon name="location_on" size={10} className="text-purple-400 shrink-0" />
                              <span className="truncate">{c.address}</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center gap-1">
                      <button
                        type="button"
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-[9px] font-black uppercase tracking-wider shadow-xs cursor-pointer"
                      >
                        Cargar
                      </button>
                    </div>
                  </div>
                );
              })
            ) : (
              /* No matching clients found: Prompt to register as new */
              <div className="p-4 text-center space-y-2">
                <div className="text-xs text-slate-300">
                  No hay ningún cliente en la base de datos con:{' '}
                  <span className="font-mono font-bold text-amber-300">
                    "{activeSearchTerm}"
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 max-w-xs mx-auto">
                  ✨ Al ingresar este nuevo cliente y confirmar el pedido, se guardará automáticamente en el directorio de clientes.
                </div>
                {db && appId && (clientInfo.phone || clientInfo.name) && (
                  <button
                    type="button"
                    disabled={isSavingDirect}
                    onClick={handleSaveContactDirect}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-wider inline-flex items-center gap-1 shadow-md cursor-pointer transition-all disabled:opacity-50 mt-1"
                  >
                    <Icon name="save" size={12} />
                    <span>{isSavingDirect ? 'Guardando...' : 'Guardar en BD Ahora'}</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Footer of Dropdown */}
          <div className="px-3 py-1.5 bg-[#0d061c] border-t border-purple-500/20 flex items-center justify-between text-[8.5px] text-slate-400">
            <span className="flex items-center gap-1">
              <Icon name="touch_app" size={10} className="text-purple-400" />
              <span>Haz clic en cualquier cliente para cargarlo en el pedido</span>
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-purple-400 hover:text-purple-200 font-bold underline cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
};