import React, { useState, useMemo } from 'react';
import { Icon } from './Icon';
import { OrderAuditEntry, UserRole } from '../types';

interface AdminAuditHistoryTabProps {
  auditLogs: OrderAuditEntry[];
  currentUser: { id?: string; displayName?: string; role: UserRole };
  currentSessionId?: string | null;
  showMessage: (text: string, type?: 'info' | 'error' | 'success') => void;
  onRefresh?: () => void;
  onDeleteAuditEntry?: (firestoreId: string) => void;
  onClearAllAuditLogs?: () => void;
  onPrintAuditTicket?: () => void;
  adminAlertSoundEnabled?: boolean;
  onToggleAdminAlertSound?: () => void;
  onTestAlertSound?: () => void;
}

export const AdminAuditHistoryTab: React.FC<AdminAuditHistoryTabProps> = ({
  auditLogs,
  currentUser,
  currentSessionId,
  showMessage,
  onRefresh,
  onDeleteAuditEntry,
  onClearAllAuditLogs,
  onPrintAuditTicket,
  adminAlertSoundEnabled = true,
  onToggleAdminAlertSound,
  onTestAlertSound,
}) => {
  const [filterAction, setFilterAction] = useState<string>('TODOS');
  const [filterShift, setFilterShift] = useState<'current' | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedLog, setSelectedLog] = useState<OrderAuditEntry | null>(null);

  // Security gate: strictly for admin
  if (currentUser.role !== 'admin') {
    return (
      <div className="h-full flex items-center justify-center p-6 bg-[#040108] text-slate-100">
        <div className="max-w-md w-full bg-[#0b0518] border border-red-500/40 rounded-3xl p-8 text-center space-y-4 shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-red-950/60 border border-red-500/50 flex items-center justify-center mx-auto text-red-400">
            <Icon name="lock" size={32} />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-white">Acceso Restringido</h2>
          <p className="text-xs font-bold text-slate-400">
            El módulo de Auditoría de Comandas y Rectificaciones está reservado exclusivamente para el perfil Administrador / Dueño.
          </p>
        </div>
      </div>
    );
  }

  // Filter logs
  const filteredLogs = useMemo(() => {
    return auditLogs.filter(log => {
      // Filter by shift
      if (filterShift === 'current' && currentSessionId) {
        if (log.sessionId !== currentSessionId) return false;
      }

      // Filter by action type
      if (filterAction === 'DELETE' && log.action !== 'DELETE_ORDER') return false;
      if (filterAction === 'RECTIFY' && !['RECTIFY_ORDER', 'UPDATE_ORDER'].includes(log.action)) return false;
      if (filterAction === 'ADD_ITEM' && log.action !== 'ADD_ITEM') return false;

      // Filter by search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesOrder = log.orderId.toLowerCase().includes(q);
        const matchesUser = log.userName.toLowerCase().includes(q) || log.userRole.toLowerCase().includes(q);
        const matchesClient = (log.clientName || '').toLowerCase().includes(q);
        const matchesDesc = log.description.toLowerCase().includes(q) || (log.changesSummary || '').toLowerCase().includes(q);
        const matchesType = (log.orderType || '').toLowerCase().includes(q);
        if (!matchesOrder && !matchesUser && !matchesClient && !matchesDesc && !matchesType) return false;
      }

      return true;
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [auditLogs, filterAction, filterShift, currentSessionId, searchQuery]);

  // Summary Metrics
  const stats = useMemo(() => {
    const totalDeletions = auditLogs.filter(l => l.action === 'DELETE_ORDER');
    const totalRectifications = auditLogs.filter(l => ['RECTIFY_ORDER', 'UPDATE_ORDER', 'ADD_ITEM', 'REMOVE_ITEM'].includes(l.action));
    const totalDeletedAmount = totalDeletions.reduce((acc, curr) => acc + (curr.previousTotal || 0), 0);
    const currentShiftLogs = currentSessionId ? auditLogs.filter(l => l.sessionId === currentSessionId) : [];

    return {
      deletionsCount: totalDeletions.length,
      deletedAmount: totalDeletedAmount,
      rectificationsCount: totalRectifications.length,
      currentShiftCount: currentShiftLogs.length,
      totalCount: auditLogs.length
    };
  }, [auditLogs, currentSessionId]);

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showMessage("No hay registros de auditoría para exportar", "error");
      return;
    }

    const headers = [
      "ID Registro",
      "Fecha",
      "Hora",
      "Acción",
      "Comanda #",
      "Tipo Pedido",
      "Mesa",
      "Cliente",
      "Usuario Responsable",
      "Rol",
      "Total Anterior ($)",
      "Total Nuevo ($)",
      "Detalle del Cambio"
    ];

    const rows = filteredLogs.map(l => {
      const d = new Date(l.timestamp);
      return [
        l.firestoreId || '',
        d.toLocaleDateString(),
        d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        l.action === 'DELETE_ORDER' ? 'ELIMINACIÓN' : 'RECTIFICACIÓN',
        `#${l.orderId}`,
        l.orderType || 'Local',
        l.tableNumber ? `Mesa ${l.tableNumber}` : 'N/A',
        `"${(l.clientName || 'Consumidor Final').replace(/"/g, '""')}"`,
        `"${l.userName.replace(/"/g, '""')}"`,
        l.userRole,
        l.previousTotal || 0,
        l.newTotal || 0,
        `"${(l.changesSummary || l.description).replace(/"/g, '""')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Auditoria_Comandas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showMessage("Archivo CSV de auditoría descargado");
  };

  return (
    <div className="p-3.5 sm:p-6 md:p-8 lg:p-12 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-6 sm:space-y-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-purple-500/20 pb-6">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-purple-600/30 border border-purple-500/50 text-purple-300">
                <Icon name="security" size={28} />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tighter text-white flex items-center gap-2.5">
                  <span>Auditoría de Comandas</span>
                  <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-red-950 text-red-300 border border-red-500/40">
                    Solo Admin
                  </span>
                </h1>
                <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-0.5">
                  Control antifraude de eliminaciones, modificaciones y rectificaciones en tiempo real
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onPrintAuditTicket && (
              <button
                type="button"
                onClick={onPrintAuditTicket}
                className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-slate-950 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Icon name="print" size={16} />
                <span>Imprimir Informe</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-4 py-2.5 bg-[#160829] hover:bg-[#220c40] text-purple-200 border border-purple-500/30 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Icon name="download" size={16} />
              <span>Exportar CSV</span>
            </button>
            {onClearAllAuditLogs && auditLogs.length > 0 && (
              <button
                type="button"
                onClick={onClearAllAuditLogs}
                className="px-4 py-2.5 bg-red-950/50 hover:bg-red-900/70 text-red-300 border border-red-500/30 rounded-2xl font-black text-xs uppercase flex items-center gap-2 transition-all cursor-pointer shadow-md"
              >
                <Icon name="delete_sweep" size={16} />
                <span>Vaciar Auditoría</span>
              </button>
            )}
          </div>
        </div>

        {/* Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Tickets Eliminados */}
          <div className="p-5 rounded-3xl bg-[#0b0518] border border-red-500/30 shadow-md space-y-1">
            <div className="flex items-center justify-between text-red-400 text-xs font-black uppercase tracking-wider">
              <span>Tickets Eliminados</span>
              <div className="w-8 h-8 rounded-xl bg-red-950/70 border border-red-500/40 flex items-center justify-center">
                <Icon name="delete_forever" size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{stats.deletionsCount}</div>
            <div className="text-[11px] font-bold text-red-300">
              Total anulado: <span className="font-mono font-black">${stats.deletedAmount}</span>
            </div>
          </div>

          {/* Card 2: Rectificaciones */}
          <div className="p-5 rounded-3xl bg-[#0b0518] border border-amber-500/30 shadow-md space-y-1">
            <div className="flex items-center justify-between text-amber-400 text-xs font-black uppercase tracking-wider">
              <span>Rectificaciones & Cambios</span>
              <div className="w-8 h-8 rounded-xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center">
                <Icon name="edit_note" size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{stats.rectificationsCount}</div>
            <div className="text-[11px] font-bold text-slate-400">
              Ítems agregados o modificados
            </div>
          </div>

          {/* Card 3: Movimientos en este Turno */}
          <div className="p-5 rounded-3xl bg-[#0b0518] border border-purple-500/30 shadow-md space-y-1">
            <div className="flex items-center justify-between text-purple-300 text-xs font-black uppercase tracking-wider">
              <span>En Turno Actual</span>
              <div className="w-8 h-8 rounded-xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center">
                <Icon name="schedule" size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-purple-200 font-mono">{stats.currentShiftCount}</div>
            <div className="text-[11px] font-bold text-slate-400">
              {currentSessionId ? 'Caja activa abierta' : 'Sin turno activo'}
            </div>
          </div>

          {/* Card 4: Total de Auditorías Registradas */}
          <div className="p-5 rounded-3xl bg-[#0b0518] border border-purple-500/30 shadow-md space-y-1">
            <div className="flex items-center justify-between text-purple-400 text-xs font-black uppercase tracking-wider">
              <span>Total Registros</span>
              <div className="w-8 h-8 rounded-xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center">
                <Icon name="history" size={18} />
              </div>
            </div>
            <div className="text-3xl font-black text-white font-mono">{stats.totalCount}</div>
            <div className="text-[11px] font-bold text-slate-400">
              Historial completo archivado
            </div>
          </div>
        </div>

        {/* Real-time Cashier Alerts Configuration Banner */}
        <div className="bg-[#120624] border-2 border-purple-500/40 rounded-3xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
              <Icon name="notifications_active" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-white text-sm uppercase">Alertas en Vivo para Modificaciones de Cajero</h3>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
              <p className="text-xs text-slate-400 font-bold">
                El sistema emite un aviso sonoro y notificación inmediata al dueño cuando un cajero modifica o elimina comandas.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
            {onToggleAdminAlertSound && (
              <button
                type="button"
                onClick={onToggleAdminAlertSound}
                className={`px-3 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all border cursor-pointer ${
                  adminAlertSoundEnabled
                    ? 'bg-purple-600/30 text-purple-200 border-purple-500/50 hover:bg-purple-600/50'
                    : 'bg-slate-900 text-slate-400 border-slate-700 hover:text-white'
                }`}
              >
                <Icon name={adminAlertSoundEnabled ? "volume_up" : "volume_off"} size={16} />
                <span>Sonido: {adminAlertSoundEnabled ? 'Activado' : 'Silenciado'}</span>
              </button>
            )}

            {onTestAlertSound && (
              <button
                type="button"
                onClick={onTestAlertSound}
                className="px-3 py-2 bg-[#1b0838] hover:bg-[#280d52] text-amber-300 border border-amber-500/30 rounded-xl text-xs font-black uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-sm"
                title="Escuchar tono de alerta"
              >
                <Icon name="play_arrow" size={16} />
                <span>Probar Alerta Sonora</span>
              </button>
            )}
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="bg-[#0b0518] p-4 rounded-3xl border border-purple-500/20 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Action Filter Pills */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'TODOS', label: 'Todos los Registros', icon: 'list' },
              { id: 'DELETE', label: 'Eliminaciones', icon: 'delete', color: 'text-red-300' },
              { id: 'RECTIFY', label: 'Rectificaciones', icon: 'edit', color: 'text-amber-300' },
            ].map(tab => {
              const isSelected = filterAction === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFilterAction(tab.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                    isSelected
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md'
                      : 'bg-[#06020e] text-slate-400 hover:text-white border-purple-500/20'
                  }`}
                >
                  <Icon name={tab.icon} size={14} className={tab.color} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Shift Filter & Search */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Shift filter toggle */}
            <div className="flex items-center bg-[#06020e] border border-purple-500/30 rounded-xl p-0.5">
              <button
                type="button"
                onClick={() => setFilterShift('all')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  filterShift === 'all'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Todo el Historial
              </button>
              <button
                type="button"
                onClick={() => setFilterShift('current')}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${
                  filterShift === 'current'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Solo Turno Actual
              </button>
            </div>

            {/* Search Input */}
            <div className="relative min-w-[220px] flex-1 md:flex-initial">
              <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-purple-400" />
              <input
                type="text"
                placeholder="Buscar por # comanda, cliente, cajera..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#06020e] border border-purple-500/30 rounded-xl text-xs font-black text-white placeholder:text-slate-500 outline-none focus:border-purple-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <Icon name="close" size={13} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Audit Trail List */}
        {filteredLogs.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#0b0518] border border-purple-500/20 text-center space-y-3">
            <div className="w-14 h-14 rounded-2xl bg-purple-950/60 border border-purple-500/30 flex items-center justify-center mx-auto text-purple-400">
              <Icon name="verified_user" size={30} />
            </div>
            <h3 className="text-base font-black uppercase tracking-tight text-white">
              No hay movimientos de auditoría registrados
            </h3>
            <p className="text-xs font-medium text-slate-400 max-w-md mx-auto">
              Cada vez que se elimine una comanda o se modifique/rectifique un pedido existente, quedará registrado aquí de forma inmutable con fecha, hora y usuario responsable.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map(log => {
              const isDelete = log.action === 'DELETE_ORDER';
              const isRectify = ['RECTIFY_ORDER', 'UPDATE_ORDER'].includes(log.action);
              const dateObj = new Date(log.timestamp);
              const dateFormatted = dateObj.toLocaleDateString();
              const timeFormatted = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const diffAmount = (log.newTotal || 0) - (log.previousTotal || 0);

              return (
                <div
                  key={log.firestoreId || `${log.orderId}-${log.timestamp}`}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all ${
                    isDelete
                      ? 'bg-[#14060b] border-red-500/40 hover:border-red-500/60 shadow-md shadow-red-950/20'
                      : isRectify
                      ? 'bg-[#140b05] border-amber-500/40 hover:border-amber-500/60 shadow-md shadow-amber-950/20'
                      : 'bg-[#0b0518] border-purple-500/30 hover:border-purple-500/50'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                    {/* Badge & Order info */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase flex items-center gap-1.5 border shadow-xs ${
                        isDelete
                          ? 'bg-red-950 text-red-200 border-red-500/50'
                          : isRectify
                          ? 'bg-amber-950 text-amber-200 border-amber-500/50'
                          : 'bg-purple-950 text-purple-200 border-purple-500/50'
                      }`}>
                        <Icon name={isDelete ? 'delete' : isRectify ? 'edit_note' : 'tune'} size={14} />
                        <span>{isDelete ? 'Comanda Eliminada' : isRectify ? 'Rectificación de Pedido' : 'Modificación'}</span>
                      </span>

                      <span className="font-mono font-black text-sm text-white bg-black/40 px-2.5 py-0.5 rounded-lg border border-white/10">
                        Comanda #{log.orderId}
                      </span>

                      {log.orderType && (
                        <span className="text-[10px] font-black uppercase text-purple-300 bg-purple-950/80 px-2 py-0.5 rounded-md border border-purple-500/30">
                          {log.orderType}
                        </span>
                      )}

                      {log.tableNumber && (
                        <span className="text-[10px] font-black uppercase text-blue-300 bg-blue-950/80 px-2 py-0.5 rounded-md border border-blue-500/30 font-mono">
                          Mesa #{log.tableNumber}
                        </span>
                      )}

                      {log.clientName && (
                        <span className="text-[11px] font-bold text-slate-300 uppercase truncate max-w-xs">
                          {log.clientName}
                        </span>
                      )}
                    </div>

                    {/* Date & Time */}
                    <div className="flex items-center gap-2 text-[11px] font-mono text-slate-400 shrink-0">
                      <Icon name="schedule" size={13} className="text-purple-400" />
                      <span>{dateFormatted} {timeFormatted}</span>
                    </div>
                  </div>

                  {/* Body details */}
                  <div className="mt-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="space-y-1 flex-1">
                      <div className="text-xs font-black text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                        <Icon name="info" size={14} className={isDelete ? 'text-red-400' : 'text-amber-400'} />
                        <span>{log.description}</span>
                      </div>

                      {log.changesSummary && log.changesSummary !== log.description && (
                        <div className="text-[11px] font-bold text-slate-400 bg-black/30 p-2 rounded-xl border border-white/5 font-mono">
                          {log.changesSummary}
                        </div>
                      )}
                    </div>

                    {/* Financial impact & user tag */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {/* Financial difference */}
                      {log.previousTotal !== undefined && (
                        <div className="text-right bg-black/40 px-3 py-1.5 rounded-xl border border-white/10">
                          <div className="text-[9px] font-black uppercase text-slate-400">Total</div>
                          <div className="text-xs font-black font-mono">
                            <span className="text-slate-400 line-through mr-1.5">${log.previousTotal}</span>
                            <span className={isDelete ? 'text-red-400 font-extrabold' : 'text-emerald-400 font-extrabold'}>
                              ${log.newTotal || 0}
                            </span>
                          </div>
                          {diffAmount !== 0 && (
                            <div className={`text-[9px] font-black font-mono ${diffAmount < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                              {diffAmount > 0 ? `+${diffAmount}` : diffAmount}
                            </div>
                          )}
                        </div>
                      )}

                      {/* User Badge */}
                      <div className={`px-3 py-1.5 rounded-xl border text-right ${
                        log.userRole === 'cajero'
                          ? 'bg-red-950/60 border-red-500/50 text-red-200 shadow-sm shadow-red-900/30 ring-1 ring-red-500/30'
                          : 'bg-purple-950/60 border-purple-500/30'
                      }`}>
                        <div className={`text-[8.5px] font-black uppercase ${log.userRole === 'cajero' ? 'text-red-300' : 'text-purple-400'}`}>
                          {log.userRole === 'cajero' ? '🚨 Modif. Cajero' : 'Operador'}
                        </div>
                        <div className="text-xs font-black text-white flex items-center gap-1 justify-end">
                          <Icon name="person" size={12} className={log.userRole === 'cajero' ? 'text-red-300' : 'text-purple-300'} />
                          <span>{log.userName}</span>
                        </div>
                        <div className={`text-[8px] font-bold uppercase ${log.userRole === 'cajero' ? 'text-red-300 font-black' : 'text-slate-400'}`}>
                          {log.userRole === 'admin' ? 'Dueño' : log.userRole === 'cajero' ? 'Cajera' : log.userRole}
                        </div>
                      </div>

                      {/* Detail View Button if items comparison available */}
                      {(log.itemsBefore || log.itemsAfter) && (
                        <button
                          type="button"
                          onClick={() => setSelectedLog(selectedLog?.firestoreId === log.firestoreId ? null : log)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 text-xs font-black uppercase cursor-pointer"
                          title="Ver detalle de ítems"
                        >
                          <Icon name={selectedLog?.firestoreId === log.firestoreId ? 'expand_less' : 'expand_more'} size={18} />
                        </button>
                      )}

                      {onDeleteAuditEntry && log.firestoreId && (
                        <button
                          type="button"
                          onClick={() => onDeleteAuditEntry(log.firestoreId!)}
                          className="p-2 rounded-xl bg-red-950/40 hover:bg-red-900/60 text-red-400 border border-red-500/30 text-xs font-black uppercase cursor-pointer"
                          title="Eliminar este registro de auditoría"
                        >
                          <Icon name="delete" size={16} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expandable items comparison */}
                  {selectedLog?.firestoreId === log.firestoreId && (
                    <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-black/40 p-3 rounded-xl">
                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                          <Icon name="history" size={12} /> Ítems Antes de la Acción:
                        </div>
                        {log.itemsBefore && log.itemsBefore.length > 0 ? (
                          <div className="space-y-1">
                            {log.itemsBefore.map((ib, i) => (
                              <div key={i} className="text-xs font-mono text-slate-300 flex justify-between bg-black/30 p-1.5 rounded">
                                <span>{ib.quantity}x {ib.name}</span>
                                <span className="font-black">${ib.price * ib.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-500 italic">Sin ítems previos registrados</div>
                        )}
                      </div>

                      <div>
                        <div className="text-[10px] font-black uppercase text-slate-400 mb-1 flex items-center gap-1">
                          <Icon name="update" size={12} /> Ítems Después de la Acción:
                        </div>
                        {log.itemsAfter && log.itemsAfter.length > 0 ? (
                          <div className="space-y-1">
                            {log.itemsAfter.map((ia, i) => (
                              <div key={i} className="text-xs font-mono text-emerald-300 flex justify-between bg-black/30 p-1.5 rounded">
                                <span>{ia.quantity}x {ia.name}</span>
                                <span className="font-black">${ia.price * ia.quantity}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-[10px] text-red-400 font-bold italic">Comanda eliminada (0 ítems)</div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
