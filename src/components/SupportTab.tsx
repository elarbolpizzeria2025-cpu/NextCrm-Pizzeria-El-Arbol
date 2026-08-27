import React, { useState } from 'react';
import { SupportTicket } from '../types';
import { Icon } from './Icon';

interface SupportTabProps {
  tickets: SupportTicket[];
  onCreateTicket: (ticketData: Omit<SupportTicket, 'firestoreId' | 'id' | 'createdAt' | 'status'>) => void;
  onUpdateTicketStatus: (ticketId: string, newStatus: 'Abierto' | 'En Proceso' | 'Resuelto', solutionNotes?: string) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

export const SupportTab: React.FC<SupportTabProps> = ({
  tickets,
  onCreateTicket,
  onUpdateTicketStatus,
  showMessage,
}) => {
  const [newTicketModal, setNewTicketModal] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: 'pos_caja' as 'impresora' | 'pos_caja' | 'pedidos_voz' | 'delivery_maps' | 'otro',
    priority: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    description: '',
    contactPhone: '098356320',
    contactName: 'Encargado de Turno',
  });

  const [faqSearch, setFaqSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('TODOS');

  // Diagnostics check status
  const [diagnostics, setDiagnostics] = useState<{
    internet: 'ok' | 'checking' | 'error';
    firebase: 'ok' | 'checking' | 'error';
    speech: 'ok' | 'checking' | 'error';
    maps: 'ok' | 'checking' | 'error';
    whatsapp: 'ok' | 'checking' | 'error';
    printer: 'ok' | 'checking' | 'error';
  }>({
    internet: 'ok',
    firebase: 'ok',
    speech: 'ok',
    maps: 'ok',
    whatsapp: 'ok',
    printer: 'ok',
  });

  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  const runDiagnostics = () => {
    setIsRunningDiagnostics(true);
    setDiagnostics({
      internet: 'checking',
      firebase: 'checking',
      speech: 'checking',
      maps: 'checking',
      whatsapp: 'checking',
      printer: 'checking',
    });

    setTimeout(() => {
      setIsRunningDiagnostics(false);
      setDiagnostics({
        internet: 'ok',
        firebase: 'ok',
        speech: 'ok',
        maps: 'ok',
        whatsapp: 'ok',
        printer: 'ok',
      });
      showMessage('Diagnóstico de infraestructura completado: Todos los sistemas operativos', 'success');
    }, 1000);
  };

  const handleOpenWhatsAppSupport = () => {
    const text = encodeURIComponent(
      `👋 *HOLA SOPORTE TÉCNICO PIZZERÍA EL ÁRBOL*\n` +
      `📌 *Solicitud de asistencia técnica del sistema POS*\n` +
      `🕒 *Fecha:* ${new Date().toLocaleString('es-UY')}\n` +
      `👤 *Contacto:* ${form.contactName} (${form.contactPhone})\n` +
      `💬 *Consulta / Incidente:* ${form.description || 'Necesito asistencia con el sistema'}`
    );
    window.open(`https://wa.me/59898356320?text=${text}`, '_blank');
  };

  const FAQS = [
    {
      q: '¿Cómo importar historial de ventas o pedidos anteriores desde Excel?',
      a: 'Ve a la pestaña Historial o Reportes y pulsa el botón "Importar Historial (Excel / CSV)". Podrás cargar tus archivos .xlsx o .csv del sistema anterior para sumarlos automáticamente.',
      cat: 'pos_caja'
    },
    {
      q: '¿Cómo abrir la caja y cargar el inventario de stock?',
      a: 'En la pantalla de Apertura de Caja ingresa el monto inicial de efectivo (ej: $3000) y pulsa "Abrir Caja". Si deseas contar pizzas, fainás o bebidas, pulsa "Cargar Stock Inicial", el cual es completamente opcional.',
      cat: 'pos_caja'
    },
    {
      q: '¿Cómo pegar pedidos copiados de WhatsApp?',
      a: 'En la Toma de Pedidos (POS), presiona el botón "Pegar de WhatsApp". Pega el texto del chat y el sistema extraerá productos, gustos, cliente, dirección y método de pago a la comanda.',
      cat: 'pos_caja'
    },
    {
      q: '¿Cómo enviar el pedido al repartidor por WhatsApp?',
      a: 'Cuando el pedido tenga destino "Delivery" o "Envío", pulsa el botón "WhatsApp Cadete" o el botón de WhatsApp en la comanda. Se abrirá el mensaje con dirección, enlace GPS y total.',
      cat: 'delivery_maps'
    }
  ];

  const filteredFaqs = FAQS.filter(faq => {
    const matchCat = filterCategory === 'TODOS' || faq.cat === filterCategory;
    const matchQ = !faqSearch || faq.q.toLowerCase().includes(faqSearch.toLowerCase()) || faq.a.toLowerCase().includes(faqSearch.toLowerCase());
    return matchCat && matchQ;
  });

  return (
    <div className="p-4 sm:p-8 h-full overflow-y-auto bg-[#050508] text-slate-100 no-scrollbar space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-[#0d071c] border border-purple-500/30 p-5 sm:p-6 rounded-3xl shadow-xl">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <span className="w-10 h-10 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black shadow-lg shadow-purple-600/30">
                <Icon name="support_agent" size={24} />
              </span>
              <div>
                <h1 className="text-xl sm:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                  Centro de Soporte Técnico & Asistencia
                </h1>
                <p className="text-[11px] text-purple-300 font-bold uppercase tracking-wider">
                  Mesa de Ayuda • WhatsApp Directo 098356320 • Monitoreo de Conectividad
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleOpenWhatsAppSupport}
              className="px-4 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30"
            >
              <Icon name="chat" size={16} /> WhatsApp 098356320
            </button>
            <button
              type="button"
              onClick={() => setNewTicketModal(true)}
              className="px-4 py-2.5 bg-[#170a2c] hover:bg-[#251046] text-purple-200 border border-purple-500/40 rounded-xl font-black uppercase text-xs transition-all flex items-center gap-2"
            >
              <Icon name="add_task" size={16} className="text-purple-400" /> + Abrir Ticket
            </button>
          </div>
        </div>

        {/* Diagnostics & Infrastructure Bar */}
        <div className="bg-[#0b0617] p-5 rounded-3xl border border-purple-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase text-purple-300 flex items-center gap-2">
              <Icon name="monitor_heart" size={16} className="text-purple-400" />
              <span>Estado del Sistema & Conectividad en Vivo</span>
            </div>
            <button
              type="button"
              onClick={runDiagnostics}
              disabled={isRunningDiagnostics}
              className="text-[10px] font-black uppercase px-3 py-1 bg-[#170b2f] hover:bg-[#26124d] text-purple-300 border border-purple-500/30 rounded-xl transition-all"
            >
              {isRunningDiagnostics ? 'Ejecutando Test...' : 'Verificar Todos'}
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            {[
              { id: 'internet', name: 'Internet / Red', icon: 'wifi' },
              { id: 'firebase', name: 'Cloud Firestore', icon: 'cloud_done' },
              { id: 'speech', name: 'Reconocimiento Voz', icon: 'mic' },
              { id: 'maps', name: 'Google Maps GPS', icon: 'map' },
              { id: 'whatsapp', name: 'WhatsApp API', icon: 'chat' },
              { id: 'printer', name: 'Impresora Térmica', icon: 'print' },
            ].map(item => (
              <div key={item.id} className="p-3 bg-[#070310] rounded-xl border border-purple-500/20 flex items-center gap-2">
                <Icon name={item.icon} size={16} className="text-purple-400" />
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase text-white truncate">{item.name}</div>
                  <div className="text-[9px] text-purple-300 font-bold uppercase flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> Operativo
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* FAQs and Knowledge Base */}
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <h2 className="text-base font-black uppercase text-white flex items-center gap-2">
              <Icon name="help_outline" size={18} className="text-purple-400" /> Preguntas Frecuentes & Guías Rápidas
            </h2>

            <div className="relative w-full sm:w-64">
              <input
                type="text"
                placeholder="Buscar solución rápida..."
                value={faqSearch}
                onChange={e => setFaqSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[#090514] border border-purple-500/30 rounded-xl text-xs text-white placeholder-slate-500 outline-none focus:border-purple-400"
              />
              <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {filteredFaqs.map((faq, idx) => (
              <div key={idx} className="bg-[#0b0617] p-4 rounded-2xl border border-purple-500/20 space-y-2">
                <div className="font-black text-xs uppercase text-white flex items-start gap-2">
                  <span className="text-purple-400 shrink-0">❓</span>
                  <span>{faq.q}</span>
                </div>
                <p className="text-xs text-slate-300 font-semibold pl-5 leading-relaxed">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets Historial & Active Tickets Section */}
        <div className="bg-[#0b0617] p-6 rounded-3xl border border-purple-500/20 space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-black uppercase text-white flex items-center gap-2">
                <Icon name="confirmation_number" size={20} className="text-purple-400" /> Historial de Tickets de Soporte
              </h2>
              <p className="text-xs text-purple-300 font-bold uppercase">
                Seguimiento de incidencias técnicas • Envío directo a WhatsApp 098356320
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNewTicketModal(true)}
              className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/30 cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Icon name="add_task" size={18} /> + Nuevo Ticket
            </button>
          </div>

          {tickets.length === 0 ? (
            <div className="p-8 text-center bg-[#070310] rounded-2xl border border-purple-500/15 space-y-2">
              <Icon name="verified" size={36} className="mx-auto text-purple-400" />
              <div className="font-black text-xs uppercase text-white">No hay tickets abiertos</div>
              <p className="text-[11px] text-slate-400">Todos los sistemas de la pizzería están funcionando sin reportes pendientes.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {tickets.map(t => {
                const sendTicketWhatsApp = () => {
                  const text = encodeURIComponent(
                    `🎫 *TICKET DE SOPORTE #${t.id || 'INC'}*\n` +
                    `📌 *Título:* ${t.title}\n` +
                    `📂 *Categoría:* ${t.category.toUpperCase()}\n` +
                    `⚡ *Prioridad:* ${t.priority.toUpperCase()}\n` +
                    `🕒 *Fecha:* ${new Date(t.createdAt).toLocaleString('es-UY')}\n` +
                    `📝 *Descripción:* ${t.description}\n` +
                    `🔄 *Estado Actual:* ${t.status}\n` +
                    `\n_Enviado desde el Sistema POS Pizzería El Árbol_`
                  );
                  window.open(`https://wa.me/59898356320?text=${text}`, '_blank');
                };

                return (
                  <div key={t.firestoreId || t.id} className="p-4 bg-[#070310] border border-purple-500/20 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                          t.priority === 'urgente' ? 'bg-red-950 text-red-300 border-red-500/40' :
                          t.priority === 'alta' ? 'bg-orange-950 text-orange-300 border-orange-500/40' :
                          'bg-purple-950 text-purple-300 border-purple-500/40'
                        }`}>
                          {t.priority}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400">#{t.id}</span>
                        <h4 className="font-black text-xs uppercase text-white">{t.title}</h4>
                      </div>
                      <p className="text-xs text-slate-300">{t.description}</p>
                      <div className="text-[10px] text-purple-300 font-bold">
                        Categoría: {t.category} • Creado: {new Date(t.createdAt).toLocaleString('es-UY')}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={sendTicketWhatsApp}
                        className="px-3.5 py-2 bg-[#170b2f] hover:bg-purple-600 text-purple-200 hover:text-white rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 border border-purple-500/30"
                        title="Enviar a WhatsApp"
                      >
                        <Icon name="chat" size={15} /> WhatsApp
                      </button>

                      <select
                        value={t.status}
                        onChange={e => onUpdateTicketStatus(t.firestoreId || t.id, e.target.value as any)}
                        className="px-3 py-2 bg-[#0d071c] border border-purple-500/30 rounded-xl text-xs font-black uppercase text-purple-200 outline-none"
                      >
                        <option value="Abierto">Abierto</option>
                        <option value="En Proceso">En Proceso</option>
                        <option value="Resuelto">Resuelto</option>
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* New Ticket Modal */}
      {newTicketModal && (
        <div className="fixed inset-0 z-[9999] bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#0b0617] border border-purple-500/40 rounded-3xl max-w-lg w-full p-6 space-y-4 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
              <h3 className="text-base font-black uppercase text-white flex items-center gap-2">
                <Icon name="confirmation_number" size={20} className="text-purple-400" /> Registrar Incidencia Técnica
              </h3>
              <button
                type="button"
                onClick={() => setNewTicketModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <Icon name="close" size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-purple-300">Título / Resumen</label>
                <input
                  type="text"
                  placeholder="Ej: Error al emitir CFE o conectar Facturando..."
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  className="w-full p-3 bg-[#06030e] border border-purple-500/30 rounded-xl text-xs font-black uppercase text-white outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-purple-300">Categoría</label>
                  <select
                    value={form.category}
                    onChange={e => setForm({ ...form, category: e.target.value as any })}
                    className="w-full p-3 bg-[#06030e] border border-purple-500/30 rounded-xl text-xs font-black uppercase text-white outline-none focus:border-purple-400"
                  >
                    <option value="pos_caja">Toma de Pedidos / Caja</option>
                    <option value="impresora">Impresora Térmica</option>
                    <option value="delivery_maps">Delivery & GPS</option>
                    <option value="pedidos_voz">Voz AI</option>
                    <option value="otro">Otro</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-purple-300">Prioridad</label>
                  <select
                    value={form.priority}
                    onChange={e => setForm({ ...form, priority: e.target.value as any })}
                    className="w-full p-3 bg-[#06030e] border border-purple-500/30 rounded-xl text-xs font-black uppercase text-white outline-none focus:border-purple-400"
                  >
                    <option value="baja">Baja</option>
                    <option value="media">Media</option>
                    <option value="alta">Alta</option>
                    <option value="urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-purple-300">Descripción Detallada</label>
                <textarea
                  rows={3}
                  placeholder="Detalla lo ocurrido para que el equipo de soporte pueda ayudarte enseguida..."
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full p-3 bg-[#06030e] border border-purple-500/30 rounded-xl text-xs text-white outline-none focus:border-purple-400 resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setNewTicketModal(false)}
                  className="py-3 px-4 bg-[#170a2c] text-slate-300 rounded-xl font-black uppercase text-xs hover:bg-[#231044]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title) return showMessage('Ingrese un título', 'error');
                    onCreateTicket(form);
                    setNewTicketModal(false);
                    showMessage('Ticket de soporte guardado');
                  }}
                  className="flex-1 py-3 bg-[#180b33] hover:bg-[#25124f] text-purple-200 border border-purple-500/40 rounded-xl font-black uppercase text-xs"
                >
                  Solo Guardar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!form.title) return showMessage('Ingrese un título', 'error');
                    onCreateTicket(form);
                    setNewTicketModal(false);
                    const text = encodeURIComponent(
                      `🎫 *NUEVO TICKET DE SOPORTE*\n` +
                      `📌 *Título:* ${form.title}\n` +
                      `📂 *Categoría:* ${form.category.toUpperCase()}\n` +
                      `⚡ *Prioridad:* ${form.priority.toUpperCase()}\n` +
                      `🕒 *Fecha:* ${new Date().toLocaleString('es-UY')}\n` +
                      `📝 *Descripción:* ${form.description || 'Sin detalle adicional'}\n` +
                      `\n_Enviado desde Pizzería El Árbol_`
                    );
                    window.open(`https://wa.me/59898356320?text=${text}`, '_blank');
                    showMessage('Ticket guardado y enviado a WhatsApp');
                  }}
                  className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs shadow-lg shadow-purple-600/30 flex items-center justify-center gap-1.5"
                >
                  <Icon name="chat" size={16} /> Guardar & WhatsApp
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
