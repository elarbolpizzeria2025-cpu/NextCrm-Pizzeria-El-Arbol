import React, { useState, useMemo, useRef } from 'react';
import { ClientData, OrderData } from '../types';
import { Icon } from './Icon';
import { addDoc, collection } from 'firebase/firestore';
import { exportClientsToCSV } from '../utils/exports';

interface CrmClientsTabProps {
  allClients: ClientData[];
  clients: ClientData[];
  orders?: OrderData[];
  clientSearch: string;
  setClientSearch: (s: string) => void;
  setNewClientModal: (b: boolean) => void;
  setEditingClient: (c: ClientData | null) => void;
  handleDeleteClient: (id: string) => void;
  handleRestoreClientsFromHistory: () => void;
  setClientInfo: (info: { phone: string; name: string; address: string; zone: string }) => void;
  setOrderType: (t: string) => void;
  setActiveTab: (tab: string) => void;
  setPosStep: (step: 1 | 2 | 3) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
  onSaveVirtualClient?: (client: ClientData) => Promise<void>;
  db?: any;
  appId?: string;
}

export const CrmClientsTab: React.FC<CrmClientsTabProps> = ({
  allClients,
  clients,
  orders = [],
  clientSearch,
  setClientSearch,
  setNewClientModal,
  setEditingClient,
  handleDeleteClient,
  handleRestoreClientsFromHistory,
  setClientInfo,
  setOrderType,
  setActiveTab,
  setPosStep,
  showMessage,
  onSaveVirtualClient,
  db,
  appId,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DELIVERY' | 'PHONE'>('ALL');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Compute stats per client from orders history
  const clientStatsMap = useMemo(() => {
    const map: Record<string, { totalOrders: number; totalSpent: number; lastOrder: number }> = {};
    (orders || []).forEach(o => {
      if (!o.client) return;
      const cleanPhone = String(o.client.phone || '').trim().replace(/\D/g, '');
      const cleanName = String(o.client.name || '').trim().toLowerCase();
      const key = cleanPhone || cleanName;
      if (!key) return;

      if (!map[key]) {
        map[key] = { totalOrders: 0, totalSpent: 0, lastOrder: 0 };
      }
      map[key].totalOrders += 1;
      map[key].totalSpent += (o.total || 0);
      if (o.createdAt && o.createdAt > map[key].lastOrder) {
        map[key].lastOrder = o.createdAt;
      }
    });
    return map;
  }, [orders]);

  // Filter clients
  const filteredClients = useMemo(() => {
    return allClients.filter(c => {
      // Type filter
      if (filterType === 'DELIVERY' && !c.address) return false;
      if (filterType === 'PHONE' && !c.phone) return false;

      // Text search
      if (!clientSearch.trim()) return true;
      const q = clientSearch.toLowerCase();
      return (
        (c.name || '').toLowerCase().includes(q) ||
        (c.phone || '').includes(q) ||
        (c.address || '').toLowerCase().includes(q) ||
        (c.zone || '').toLowerCase().includes(q)
      );
    });
  }, [allClients, clientSearch, filterType]);

  const virtualClientsCount = allClients.filter(c => c.isVirtual).length;
  const clientsWithAddress = allClients.filter(c => c.address && c.address.trim() !== '').length;
  const clientsWithPhone = allClients.filter(c => c.phone && c.phone.trim() !== '').length;

  const handleStartOrderForClient = (client: ClientData) => {
    setClientInfo({
      name: client.name || '',
      phone: client.phone || '',
      address: client.address || '',
      zone: client.zone || ''
    });
    setOrderType(client.address ? 'Envío' : 'Local');
    setPosStep(1);
    setActiveTab('pos');
    showMessage(`Cliente ${client.name} cargado en comanda`);
  };

  const getClientStats = (client: ClientData) => {
    const cleanPhone = String(client.phone || '').trim().replace(/\D/g, '');
    const cleanName = String(client.name || '').trim().toLowerCase();
    return clientStatsMap[cleanPhone] || clientStatsMap[cleanName] || { totalOrders: 0, totalSpent: 0, lastOrder: 0 };
  };

  const handleSaveVirtual = async (client: ClientData) => {
    if (onSaveVirtualClient) {
      await onSaveVirtualClient(client);
      return;
    }
    if (db && appId) {
      try {
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
          name: client.name,
          phone: client.phone || '',
          address: client.address || '',
          zone: client.zone || '',
          createdAt: Date.now()
        });
        showMessage("Cliente guardado en directorio permanente", "success");
      } catch (e: any) {
        showMessage("Error: " + e.message, "error");
      }
    }
  };

  const handleImportClientsFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !db || !appId) return;

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
      if (lines.length <= 1) return showMessage("El archivo CSV está vacío", "error");

      const existingPhones = new Set(allClients.map(c => String(c.phone || '').replace(/\D/g, '')).filter(Boolean));
      const existingNames = new Set(allClients.map(c => String(c.name || '').trim().toLowerCase()).filter(Boolean));

      let addedCount = 0;
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Parse CSV line (supporting semicolon or comma, and quotes)
        const parts = line.split(/[;,]/).map(p => p.replace(/^["']|["']$/g, '').trim());
        if (parts.length < 1) continue;

        const name = parts[0];
        const phone = parts[1] || '';
        const address = parts[2] || '';
        const zone = parts[3] || '';

        if (!name) continue;

        const cleanPhone = phone.replace(/\D/g, '');
        const cleanName = name.toLowerCase();

        if ((cleanPhone && existingPhones.has(cleanPhone)) || existingNames.has(cleanName)) {
          continue; // Skip duplicate
        }

        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'clients'), {
          name,
          phone,
          address,
          zone,
          createdAt: Date.now()
        });

        if (cleanPhone) existingPhones.add(cleanPhone);
        existingNames.add(cleanName);
        addedCount++;
      }

      if (fileInputRef.current) fileInputRef.current.value = '';
      showMessage(`¡Se importaron ${addedCount} contactos sin duplicados!`, "success");
    } catch (err: any) {
      showMessage("Error al importar contactos: " + err.message, "error");
    }
  };

  return (
    <div className="p-6 md:p-10 h-full overflow-y-auto bg-[#060a08] text-slate-100 no-scrollbar space-y-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-emerald-500/20 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <Icon name="group" size={36} className="text-emerald-400" /> Directorio de Clientes & CRM
              </h1>
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-emerald-950 text-emerald-300 border border-emerald-500/30 rounded-full">
                {allClients.length} Clientes
              </span>
            </div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              Historial de consumos • Búsqueda rápida • Acceso directo a WhatsApp y toma de pedidos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportClientsFile} 
              accept=".csv,.txt" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-3 bg-[#112017] border border-emerald-500/30 text-emerald-300 hover:bg-[#1a2e20] rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
              title="Importar contactos desde archivo CSV sin duplicar"
            >
              <Icon name="upload" size={16} className="text-emerald-400" /> 📥 Importar CSV
            </button>
            <button
              type="button"
              onClick={() => exportClientsToCSV(allClients)}
              className="px-4 py-3 bg-[#112017] border border-emerald-500/30 text-emerald-300 hover:bg-[#1a2e20] rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
              title="Exportar clientes a Excel (CSV)"
            >
              <Icon name="download" size={16} className="text-emerald-400" /> 📊 Exportar CSV
            </button>
            {virtualClientsCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreClientsFromHistory}
                className="px-4 py-3 bg-[#112017] border border-amber-500/30 text-amber-300 hover:bg-[#1a2e20] rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
                title="Guardar todos los clientes encontrados en comandas previas"
              >
                <Icon name="save" size={16} className="text-amber-400" /> Guardar Virtuales ({virtualClientsCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setNewClientModal(true)}
              className="px-5 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/20"
            >
              <Icon name="person_add" size={18} /> + Nuevo Cliente
            </button>
          </div>
        </div>

        {/* CRM KPI Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-[#0b140f] p-5 rounded-[28px] border border-emerald-500/20 shadow-xs">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Total Clientes</span>
              <Icon name="contacts" size={16} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-white mt-1">{allClients.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {clients.length} registrados • {virtualClientsCount} en historial
            </div>
          </div>

          <div className="bg-[#0b140f] p-5 rounded-[28px] border border-emerald-500/20 shadow-xs">
            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center justify-between">
              <span>Con WhatsApp / Teléfono</span>
              <Icon name="phone" size={16} className="text-emerald-400" />
            </div>
            <div className="text-3xl font-black text-emerald-400 mt-1">{clientsWithPhone}</div>
            <div className="text-[10px] text-slate-400 mt-1">Habilitados para contacto directo</div>
          </div>

          <div className="bg-[#0b140f] p-5 rounded-[28px] border border-emerald-500/20 shadow-xs">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-between">
              <span>Clientes Delivery</span>
              <Icon name="location_on" size={16} className="text-blue-400" />
            </div>
            <div className="text-3xl font-black text-blue-400 mt-1">{clientsWithAddress}</div>
            <div className="text-[10px] text-slate-400 mt-1">Con dirección y zona registrada</div>
          </div>

          <div className="bg-[#0b140f] p-5 rounded-[28px] border border-emerald-500/20 shadow-xs">
            <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center justify-between">
              <span>Ventas Acumuladas</span>
              <Icon name="trending_up" size={16} className="text-amber-400" />
            </div>
            <div className="text-3xl font-black text-amber-400 mt-1">
              ${orders.filter(o => o.status === 'Finalizado').reduce((s, o) => s + (o.total || 0), 0)}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">Facturación total de clientes</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-[#0b140f] p-4 sm:p-5 rounded-[28px] border border-emerald-500/20 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Icon name="search" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, dirección o zona..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-[#070e0a] border border-emerald-500/30 text-emerald-100 placeholder-slate-500 rounded-2xl text-xs font-black uppercase outline-none focus:border-emerald-400"
            />
            {clientSearch && (
              <button
                type="button"
                onClick={() => setClientSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={16} />
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${
                filterType === 'ALL'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#122218] text-slate-300 hover:bg-[#1a2f23]'
              }`}
            >
              Todos ({allClients.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('DELIVERY')}
              className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${
                filterType === 'DELIVERY'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#122218] text-slate-300 hover:bg-[#1a2f23]'
              }`}
            >
              Con Dirección
            </button>
            <button
              type="button"
              onClick={() => setFilterType('PHONE')}
              className={`flex-1 md:flex-none px-4 py-3 rounded-2xl text-[11px] font-black uppercase transition-all ${
                filterType === 'PHONE'
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#122218] text-slate-300 hover:bg-[#1a2f23]'
              }`}
            >
              Con WhatsApp
            </button>
          </div>
        </div>

        {/* Clients Cards Grid */}
        {filteredClients.length === 0 ? (
          <div className="bg-[#0b140f] p-12 rounded-[36px] border border-emerald-500/20 text-center space-y-3">
            <Icon name="person_search" size={48} className="mx-auto text-slate-600" />
            <div className="font-black text-slate-300 text-base uppercase">No se encontraron clientes</div>
            <div className="text-xs font-bold text-slate-500">Pruebe con otro término de búsqueda o agregue un cliente nuevo.</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredClients.map(client => {
              const stats = getClientStats(client);
              const hasPhone = Boolean(client.phone && client.phone.trim() !== '');
              let waPhone = '';
              if (hasPhone) {
                waPhone = String(client.phone).replace(/[^0-9]/g, '');
                if (waPhone.startsWith('09') && waPhone.length === 9) waPhone = '598' + waPhone.substring(1);
              }

              return (
                <div
                  key={client.firestoreId}
                  className="bg-[#0b140f] p-5 rounded-[30px] border border-emerald-500/20 hover:border-emerald-500/50 transition-all flex flex-col justify-between shadow-sm group"
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-black uppercase text-white tracking-tight">{client.name}</h3>
                          {client.isVirtual && (
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-500/30 rounded-full">
                              Historial
                            </span>
                          )}
                        </div>
                        {stats.totalOrders > 0 && (
                          <div className="text-[10px] font-bold text-emerald-400 mt-0.5">
                            {stats.totalOrders} pedidos realizados • ${stats.totalSpent} acumulados
                          </div>
                        )}
                      </div>

                      {!client.isVirtual && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClient(client.firestoreId)}
                          className="text-slate-500 hover:text-red-400 p-1"
                          title="Eliminar cliente"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      )}
                    </div>

                    {/* Contact Details */}
                    <div className="space-y-1.5 text-xs font-bold text-slate-400">
                      {client.phone && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <Icon name="phone" size={14} className="text-emerald-400" />
                          <span>{client.phone}</span>
                        </div>
                      )}
                      {client.address && (
                        <div className="flex items-center gap-2 text-slate-300">
                          <Icon name="location_on" size={14} className="text-blue-400" />
                          <span>{client.address}</span>
                        </div>
                      )}
                      {client.zone && (
                        <div className="flex items-center gap-2 text-slate-400">
                          <Icon name="map" size={14} className="text-purple-400" />
                          <span>Zona: {client.zone}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div className="pt-4 mt-4 border-t border-emerald-500/10 flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleStartOrderForClient(client)}
                      className="px-3.5 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
                    >
                      <Icon name="add_shopping_cart" size={14} /> Cargar Pedido
                    </button>

                    <div className="flex items-center gap-1.5">
                      {hasPhone && (
                        <button
                          type="button"
                          onClick={() => window.open(`https://wa.me/${waPhone}`, '_blank')}
                          className="p-2.5 bg-[#122218] hover:bg-[#1a3323] text-emerald-400 border border-emerald-500/30 rounded-xl font-black text-xs uppercase transition-all"
                          title="Enviar mensaje por WhatsApp"
                        >
                          <Icon name="chat" size={16} />
                        </button>
                      )}

                      {client.isVirtual ? (
                        <button
                          type="button"
                          onClick={() => handleSaveVirtual(client)}
                          className="px-3 py-2 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-500/30 rounded-xl font-black text-xs uppercase flex items-center gap-1"
                        >
                          <Icon name="save" size={13} /> Guardar
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditingClient(client)}
                          className="px-3 py-2 bg-[#122218] hover:bg-[#1a2f23] text-slate-300 border border-emerald-500/20 rounded-xl font-black text-xs uppercase flex items-center gap-1"
                        >
                          <Icon name="edit" size={13} /> Editar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
