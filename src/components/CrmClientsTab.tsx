import React, { useState, useMemo } from 'react';
import { ClientData, OrderData } from '../types';
import { Icon } from './Icon';
import { addDoc, collection, doc, deleteDoc } from 'firebase/firestore';
import { ImportClientsModal } from './ImportClientsModal';

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
  onImportClients?: (clients: Partial<ClientData>[], replaceExisting: boolean) => Promise<void>;
  onClearAllClients?: () => Promise<void>;
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
  onImportClients,
  onClearAllClients,
  db,
  appId,
}) => {
  const [filterType, setFilterType] = useState<'ALL' | 'DELIVERY' | 'PHONE'>('ALL');
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const handleInternalImportClients = async (importedClients: Partial<ClientData>[], replaceExisting: boolean) => {
    if (onImportClients) {
      await onImportClients(importedClients, replaceExisting);
      return;
    }
    if (!db || !appId) return;

    if (replaceExisting) {
      for (const c of clients) {
        if (c.firestoreId) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', c.firestoreId));
        }
      }
    }

    const col = collection(db, 'artifacts', appId, 'public', 'data', 'clients');
    for (const c of importedClients) {
      await addDoc(col, {
        name: c.name || 'Cliente',
        phone: c.phone || '',
        address: c.address || '',
        zone: c.zone || '',
        notes: c.notes || '',
        createdAt: Date.now()
      });
    }
  };

  const handleInternalClearAllClients = async () => {
    if (onClearAllClients) {
      await onClearAllClients();
      return;
    }
    if (!window.confirm("¿Está seguro de que desea eliminar todos los clientes del directorio?")) return;
    if (!db || !appId) return;

    try {
      for (const c of clients) {
        if (c.firestoreId) {
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'clients', c.firestoreId));
        }
      }
      showMessage("Directorio de clientes vaciado exitosamente");
    } catch (e: any) {
      showMessage("Error al vaciar clientes: " + e.message, "error");
    }
  };

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
      const q = clientSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.toLowerCase().includes(q)) ||
        (c.address && c.address.toLowerCase().includes(q)) ||
        (c.zone && c.zone.toLowerCase().includes(q));

      if (!matchSearch) return false;

      if (filterType === 'DELIVERY') return !!(c.address && c.address.trim());
      if (filterType === 'PHONE') return !!(c.phone && c.phone.trim());
      return true;
    });
  }, [allClients, clientSearch, filterType]);

  const virtualClientsCount = allClients.filter(c => c.isVirtual).length;
  const clientsWithPhone = allClients.filter(c => c.phone && c.phone.trim()).length;
  const clientsWithAddress = allClients.filter(c => c.address && c.address.trim()).length;

  const handleStartOrderForClient = (client: ClientData) => {
    setClientInfo({
      name: client.name || '',
      phone: client.phone || '',
      address: client.address || '',
      zone: client.zone || '',
    });
    if (client.address && client.address.trim()) {
      setOrderType('Envío');
    } else {
      setOrderType('Local');
    }
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

  return (
    <div className="p-4 sm:p-8 h-full overflow-y-auto bg-[#050508] text-slate-100 no-scrollbar space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header and Actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-purple-500/20 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-3">
                <Icon name="group" size={32} className="text-purple-400" /> Directorio de Clientes & CRM
              </h1>
              <span className="text-[10px] font-black uppercase px-3 py-1 bg-purple-950 text-purple-300 border border-purple-500/30 rounded-full">
                {allClients.length} Clientes
              </span>
            </div>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              Historial de consumos • Búsqueda rápida • Acceso directo a WhatsApp y toma de pedidos
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsImportModalOpen(true)}
              className="px-4 py-2.5 bg-[#170a2c] border border-purple-500/40 text-purple-200 hover:bg-[#251046] hover:text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-xs cursor-pointer"
              title="Importar lista de clientes desde Excel (.xlsx, .csv) o texto"
            >
              <Icon name="upload_file" size={16} className="text-purple-300" /> 📥 Importar Clientes
            </button>
            {clients.length > 0 && (
              <button
                type="button"
                onClick={handleInternalClearAllClients}
                className="px-3.5 py-2.5 bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-1.5"
                title="Vaciar / Limpiar todos los clientes"
              >
                <Icon name="delete" size={15} /> Limpiar Clientes
              </button>
            )}
            {virtualClientsCount > 0 && (
              <button
                type="button"
                onClick={handleRestoreClientsFromHistory}
                className="px-4 py-2.5 bg-[#170a2c] border border-purple-500/40 text-purple-300 hover:bg-[#251046] rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2"
                title="Guardar todos los clientes encontrados en comandas previas"
              >
                <Icon name="save" size={16} className="text-purple-400" /> Guardar Virtuales ({virtualClientsCount})
              </button>
            )}
            <button
              type="button"
              onClick={() => setNewClientModal(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30"
            >
              <Icon name="person_add" size={16} /> + Nuevo Cliente
            </button>
          </div>
        </div>

        {/* CRM KPI Metric Cards in Lila & Black */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 shadow-xs">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Total Clientes</span>
              <Icon name="contacts" size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">{allClients.length}</div>
            <div className="text-[10px] text-slate-400 mt-1">
              {clients.length} registrados • {virtualClientsCount} en historial
            </div>
          </div>

          <div className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 shadow-xs">
            <div className="text-[10px] font-black text-purple-300 uppercase tracking-widest flex items-center justify-between">
              <span>Con Teléfono / WhatsApp</span>
              <Icon name="phone" size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-purple-300 mt-1">{clientsWithPhone}</div>
            <div className="text-[10px] text-slate-400 mt-1">Habilitados para contacto directo</div>
          </div>

          <div className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 shadow-xs">
            <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center justify-between">
              <span>Clientes Delivery</span>
              <Icon name="location_on" size={16} className="text-blue-400" />
            </div>
            <div className="text-2xl font-black text-blue-400 mt-1">{clientsWithAddress}</div>
            <div className="text-[10px] text-slate-400 mt-1">Con dirección y zona registrada</div>
          </div>

          <div className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 shadow-xs">
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center justify-between">
              <span>Ventas Acumuladas</span>
              <Icon name="trending_up" size={16} className="text-purple-400" />
            </div>
            <div className="text-2xl font-black text-white mt-1">
              ${orders.filter(o => o.status === 'Finalizado').reduce((s, o) => s + (o.total || 0), 0)}
            </div>
            <div className="text-[10px] text-purple-300 mt-1 font-bold uppercase">Facturación total histórica</div>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 shadow-sm flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre, teléfono, dirección o zona..."
              value={clientSearch}
              onChange={e => setClientSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-[#06030e] border border-purple-500/30 text-white placeholder-slate-500 rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400"
            />
            {clientSearch && (
              <button
                type="button"
                onClick={() => setClientSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <Icon name="close" size={14} />
              </button>
            )}
          </div>

          <div className="flex gap-2 w-full md:w-auto">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                filterType === 'ALL'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-[#120826] text-slate-300 hover:bg-[#1f0e3f] border border-purple-500/20'
              }`}
            >
              Todos ({allClients.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('DELIVERY')}
              className={`flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                filterType === 'DELIVERY'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'bg-[#120826] text-slate-300 hover:bg-[#1f0e3f] border border-purple-500/20'
              }`}
            >
              Delivery ({clientsWithAddress})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('PHONE')}
              className={`flex-1 md:flex-none px-3.5 py-2 rounded-xl text-xs font-black uppercase transition-all ${
                filterType === 'PHONE'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'bg-[#120826] text-slate-300 hover:bg-[#1f0e3f] border border-purple-500/20'
              }`}
            >
              WhatsApp ({clientsWithPhone})
            </button>
          </div>
        </div>

        {/* Clients Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredClients.length === 0 ? (
            <div className="col-span-full py-16 text-center bg-[#0b0617] rounded-3xl border border-purple-500/20 space-y-2">
              <Icon name="person_search" size={40} className="mx-auto text-slate-600" />
              <div className="font-black text-sm uppercase text-slate-300">No se encontraron clientes</div>
              <p className="text-xs text-slate-500">Intenta con otro término de búsqueda o agrega un nuevo cliente.</p>
            </div>
          ) : (
            filteredClients.map(c => {
              const stats = getClientStats(c);
              return (
                <div
                  key={c.firestoreId}
                  className="bg-[#0b0617] p-5 rounded-2xl border border-purple-500/20 hover:border-purple-500/50 transition-all flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-black text-sm uppercase text-white truncate">{c.name}</div>
                        {c.isVirtual && (
                          <span className="text-[8px] font-black uppercase px-2 py-0.2 bg-purple-950 text-purple-300 border border-purple-500/30 rounded">
                            Historial
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingClient(c)}
                          className="p-1.5 bg-[#170a2c] hover:bg-[#251046] text-purple-200 rounded-lg transition-colors"
                          title="Editar cliente"
                        >
                          <Icon name="edit" size={13} />
                        </button>
                        {!c.isVirtual && (
                          <button
                            type="button"
                            onClick={() => handleDeleteClient(c.firestoreId)}
                            className="p-1.5 bg-[#170a2c] hover:bg-red-900/60 text-slate-400 hover:text-red-300 rounded-lg transition-colors"
                            title="Eliminar cliente"
                          >
                            <Icon name="delete" size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1 text-xs text-slate-300">
                      {c.phone && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-purple-300">📞 {c.phone}</span>
                          <button
                            type="button"
                            onClick={() => {
                              let p = c.phone!.replace(/[^0-9]/g, '');
                              if (p.startsWith('09') && p.length === 9) p = '598' + p.substring(1);
                              window.open(`https://wa.me/${p}`, '_blank');
                            }}
                            className="text-[10px] text-purple-400 hover:underline font-bold"
                          >
                            WhatsApp
                          </button>
                        </div>
                      )}
                      {c.address && (
                        <div className="text-[11px] text-slate-400 truncate">
                          📍 {c.address} {c.zone ? `(${c.zone})` : ''}
                        </div>
                      )}
                    </div>

                    {/* Stats */}
                    <div className="pt-2 border-t border-purple-500/15 grid grid-cols-2 gap-2 text-[10px]">
                      <div>
                        <span className="text-slate-500 font-bold uppercase">Pedidos:</span>{' '}
                        <strong className="text-white font-mono">{stats.totalOrders}</strong>
                      </div>
                      <div>
                        <span className="text-slate-500 font-bold uppercase">Gastado:</span>{' '}
                        <strong className="text-purple-300 font-mono">${stats.totalSpent}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="pt-1 flex gap-2">
                    {c.isVirtual && (
                      <button
                        type="button"
                        onClick={() => handleSaveVirtual(c)}
                        className="py-2 px-3 bg-[#170a2c] hover:bg-[#251046] text-purple-300 border border-purple-500/30 rounded-xl text-xs font-black uppercase transition-all"
                        title="Guardar como cliente permanente"
                      >
                        Guardar
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleStartOrderForClient(c)}
                      className="flex-1 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-1.5 shadow-md shadow-purple-600/25"
                    >
                      <Icon name="point_of_sale" size={14} /> Tomar Pedido
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Import Clients Modal */}
      <ImportClientsModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportClients={handleInternalImportClients}
        showMessage={showMessage}
      />
    </div>
  );
};
