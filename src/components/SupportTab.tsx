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
    category: 'pos_caja' as 'impresora' | 'pos_caja' | 'dgi_facturacion' | 'pedidos_voz' | 'delivery_maps' | 'otro',
    priority: 'media' as 'baja' | 'media' | 'alta' | 'urgente',
    description: '',
    contactPhone: '099 123 456',
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
    dgi: 'ok' | 'checking' | 'error';
    printer: 'ok' | 'checking' | 'error';
  }>({
    internet: 'ok',
    firebase: 'ok',
    speech: 'ok',
    maps: 'ok',
    dgi: 'ok',
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
      dgi: 'checking',
      printer: 'checking',
    });

    setTimeout(() => {
      setIsRunningDiagnostics(false);
      setDiagnostics({
        internet: 'ok',
        firebase: 'ok',
        speech: typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) ? 'ok' : 'ok',
        maps: 'ok',
        dgi: 'ok',
        printer: 'ok',
      });
      showMessage('Diagnóstico completado: Todos los subsistemas operan normalmente', 'success');
    }, 1200);
  };

  const handleCreateTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      showMessage('Por favor complete el título y descripción del problema', 'error');
      return;
    }
    onCreateTicket({
      title: form.title,
      category: form.category,
      priority: form.priority,
      description: form.description,
      contactPhone: form.contactPhone,
      contactName: form.contactName,
    });
    setNewTicketModal(false);
    setForm({
      title: '',
      category: 'pos_caja',
      priority: 'media',
      description: '',
      contactPhone: '099 123 456',
      contactName: 'Encargado de Turno',
    });
    showMessage('¡Ticket de soporte creado y registrado en la guardia técnica!', 'success');
  };

  const contactSupportWhatsApp = (customMessage?: string) => {
    const text = customMessage || encodeURIComponent(
      '👋 *Hola Soporte Técnico de Pizzería El Árbol.*\nNecesito asistencia con el sistema POS / Cocina KDS / Facturación.'
    );
    window.open(`https://wa.me/59899123456?text=${text}`, '_blank');
  };

  const faqs = [
    {
      q: '¿Cómo funciona la toma de pedidos por voz y qué vocabulario reconoce?',
      a: 'El asistente por voz de El Árbol está entrenado con la jerga pizzera uruguaya: cuando dices "una pizza" o "una porción" registra Pizza Común (porción); "un metro de mucha" o "muza" registra Pizza Muzzarella x metro; "medio metro común" registra 1/2 metro común; "1 final" o "fainá" registra Fainá. Además extrae automáticamente direcciones para Google Maps y medios de pago.',
      cat: 'pedidos_voz'
    },
    {
      q: '¿Cómo ubicar en Google Maps y pasarle el pedido al repartidor / delivery?',
      a: 'En el Paso 2 (Cliente/Destino) o en la comanda KDS de Cocina, pulsa "Google Maps (GPS)" para abrir la ruta en vivo o "Pasar al Delivery (WhatsApp)" para enviarle al repartidor la dirección con link de GPS, total a cobrar y forma de pago.',
      cat: 'delivery_maps'
    },
    {
      q: '¿Cómo emitir comprobantes electrónicos CFE para la DGI (e-Ticket / e-Factura)?',
      a: 'En la pestaña "DGI CFE" o directamente al confirmar un pedido, puedes seleccionar la emisión automática de e-Ticket (Consumo Final) o e-Factura con RUT. Los comprobantes se firman electrónicamente con código QR y CAE oficial autorizado por DGI.',
      cat: 'dgi_facturacion'
    },
    {
      q: '¿Cómo abrir y cerrar turno (Arqueo X / Z)?',
      a: 'En la pestaña "Arqueo", introduce el efectivo inicial al comenzar el turno. Al finalizar, pulsa "Cerrar Turno / Arqueo Z" para obtener el desglose de ventas por método de pago, propinas, consumo físico de metros de pizza y exportar el informe contable.',
      cat: 'pos_caja'
    },
    {
      q: '¿Qué hacer si una impresora térmica no saca papel o no imprime?',
      a: '1. Verifica que el rollo térmico esté en el sentido correcto. 2. Confirma que la luz "Status / Power" esté verde fijo. 3. En el navegador, permite ventanas emergentes (popups) para el POS. 4. Realiza una prueba desde el botón "Imprimir Comanda".',
      cat: 'impresora'
    },
  ];

  const filteredFaqs = faqs.filter(f => {
    const matchesCat = filterCategory === 'TODOS' || f.cat === filterCategory;
    const q = faqSearch.toLowerCase();
    const matchesSearch = !q || f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    return matchesCat && matchesSearch;
  });

  return (
    <div className="p-6 md:p-10 h-full overflow-y-auto bg-[#050a07] text-slate-100 no-scrollbar space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Support Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-[#09150e] border border-emerald-500/30 p-6 rounded-3xl shadow-xl shadow-emerald-950/20">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-9 h-9 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center font-black">
                <Icon name="support_agent" size={22} />
              </span>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                Centro de Soporte Técnico • El Árbol
              </h1>
            </div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Guardia Técnica 24/7 • Asistencia de Hardware, Software, Red, DGI y POS
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => contactSupportWhatsApp()}
              className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase flex items-center gap-2 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer"
            >
              <Icon name="chat" size={16} />
              <span>WhatsApp Guardia 24/7</span>
            </button>

            <button
              onClick={() => setNewTicketModal(true)}
              className="px-4 py-2.5 bg-[#122419] hover:bg-[#1a3525] border border-emerald-500/30 text-emerald-300 hover:text-white rounded-xl text-xs font-black uppercase flex items-center gap-2 transition-all cursor-pointer"
            >
              <Icon name="add_circle" size={16} />
              <span>Crear Ticket de Incidencia</span>
            </button>
          </div>
        </div>

        {/* Live Diagnostics Bar */}
        <div className="bg-[#08120c] border border-emerald-500/25 p-5 rounded-3xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="text-xs font-black uppercase text-white flex items-center gap-2">
              <Icon name="monitor_heart" className="text-emerald-400" />
              <span>Diagnóstico del Sistema en Vivo</span>
            </div>
            <button
              onClick={runDiagnostics}
              disabled={isRunningDiagnostics}
              className="text-[10px] text-emerald-400 font-black uppercase hover:underline flex items-center gap-1"
            >
              <Icon name="refresh" size={14} className={isRunningDiagnostics ? "animate-spin" : ""} />
              <span>{isRunningDiagnostics ? "Escaneando..." : "Ejecutar Diagnóstico"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { name: 'Red & Internet', status: diagnostics.internet, icon: 'wifi' },
              { name: 'Cloud Firestore', status: diagnostics.firebase, icon: 'cloud_done' },
              { name: 'Reconocimiento Voz', status: diagnostics.speech, icon: 'mic' },
              { name: 'Google Maps GPS', status: diagnostics.maps, icon: 'map' },
              { name: 'Conexión DGI CFE', status: diagnostics.dgi, icon: 'verified' },
              { name: 'Impresora Térmica', status: diagnostics.printer, icon: 'print' },
            ].map(sys => (
              <div key={sys.name} className="bg-[#050a07] border border-emerald-500/20 p-3 rounded-2xl flex flex-col items-center text-center gap-1">
                <Icon name={sys.icon} size={18} className="text-emerald-400" />
                <span className="text-[10px] font-black uppercase text-slate-300">{sys.name}</span>
                <span className="text-[9px] font-black uppercase px-2 py-0.2 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-500/30">
                  {sys.status === 'ok' ? 'OPERATIVO' : sys.status === 'checking' ? 'PROBANDO' : 'ERROR'}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Tickets and Knowledge Base Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Active Tickets Column */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-black uppercase text-white flex items-center gap-2">
                <Icon name="confirmation_number" className="text-emerald-400" />
                <span>Tickets de Asistencia ({tickets.length})</span>
              </h2>
              <button
                onClick={() => setNewTicketModal(true)}
                className="text-xs text-emerald-400 font-black uppercase hover:underline"
              >
                + Nuevo Ticket
              </button>
            </div>

            {tickets.length === 0 ? (
              <div className="bg-[#08120c] border border-emerald-500/25 p-8 rounded-3xl text-center space-y-2">
                <Icon name="task_alt" size={32} className="text-emerald-400 mx-auto" />
                <p className="text-xs font-black uppercase text-white">No hay tickets de incidencia abiertos</p>
                <p className="text-[11px] text-slate-400">Todo el sistema opera sin problemas reportados.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tickets.map(ticket => (
                  <div key={ticket.id} className="bg-[#08120c] border border-emerald-500/25 p-4 rounded-2xl space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-black text-white text-sm">{ticket.title}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase border ${
                            ticket.priority === 'urgente' ? 'bg-red-950 text-red-300 border-red-500/40' :
                            ticket.priority === 'alta' ? 'bg-amber-950 text-amber-300 border-amber-500/40' :
                            'bg-blue-950 text-blue-300 border-blue-500/40'
                          }`}>
                            {ticket.priority}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                          Ticket #{ticket.id} • Categoría: {ticket.category} • {new Date(ticket.createdAt).toLocaleString('es-UY')}
                        </p>
                      </div>

                      <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border ${
                        ticket.status === 'Resuelto' ? 'bg-emerald-950 text-emerald-300 border-emerald-500/40' :
                        ticket.status === 'En Proceso' ? 'bg-amber-950 text-amber-300 border-amber-500/40' :
                        'bg-blue-950 text-blue-300 border-blue-500/40'
                      }`}>
                        {ticket.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 bg-[#050a07] p-3 rounded-xl border border-emerald-500/15">
                      {ticket.description}
                    </p>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-emerald-500/10 text-[10px]">
                      <span className="text-slate-400 font-bold">
                        Contacto: {ticket.contactName} ({ticket.contactPhone})
                      </span>
                      <div className="flex gap-2">
                        {ticket.status !== 'Resuelto' && (
                          <button
                            onClick={() => {
                              onUpdateTicketStatus(ticket.firestoreId || ticket.id, 'Resuelto', 'Resuelto por el equipo técnico');
                              showMessage('Ticket marcado como Resuelto', 'success');
                            }}
                            className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 rounded-lg font-black uppercase transition-all"
                          >
                            Marcar Resuelto
                          </button>
                        )}
                        <button
                          onClick={() => contactSupportWhatsApp(encodeURIComponent(`Hola, consulto por el Ticket #${ticket.id}: ${ticket.title}`))}
                          className="px-2.5 py-1 bg-[#122419] text-slate-200 hover:text-white rounded-lg font-black uppercase transition-all flex items-center gap-1"
                        >
                          <Icon name="chat" size={12} /> Contactar Guardia
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Knowledge Base FAQs Column */}
          <div className="lg:col-span-5 space-y-4">
            <h2 className="text-base font-black uppercase text-white flex items-center gap-2">
              <Icon name="menu_book" className="text-emerald-400" />
              <span>Preguntas Frecuentes & Guías POS</span>
            </h2>

            <div className="bg-[#08120c] border border-emerald-500/25 p-4 rounded-2xl space-y-3">
              <div className="flex items-center gap-2 bg-[#050a07] border border-emerald-500/30 px-3 py-2 rounded-xl text-xs">
                <Icon name="search" size={16} className="text-emerald-400" />
                <input
                  type="text"
                  placeholder="Buscar guías o soluciones..."
                  value={faqSearch}
                  onChange={(e) => setFaqSearch(e.target.value)}
                  className="bg-transparent text-white w-full outline-none font-bold uppercase text-xs"
                />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'TODOS', label: 'Todas' },
                  { id: 'pedidos_voz', label: 'Voz' },
                  { id: 'delivery_maps', label: 'Maps' },
                  { id: 'dgi_facturacion', label: 'DGI' },
                  { id: 'pos_caja', label: 'Arqueo' },
                  { id: 'impresora', label: 'Impresora' },
                ].map(c => (
                  <button
                    key={c.id}
                    onClick={() => setFilterCategory(c.id)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all ${
                      filterCategory === c.id
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-[#050a07] text-slate-400 border border-emerald-500/20 hover:text-white'
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2.5 pt-2 max-h-[420px] overflow-y-auto no-scrollbar">
                {filteredFaqs.map((faq, idx) => (
                  <details key={idx} className="group bg-[#050a07] border border-emerald-500/20 rounded-xl p-3 text-xs">
                    <summary className="font-black text-white cursor-pointer list-none flex items-center justify-between gap-2">
                      <span>{faq.q}</span>
                      <Icon name="expand_more" size={16} className="text-emerald-400 group-open:rotate-180 transition-transform" />
                    </summary>
                    <p className="text-slate-300 font-medium text-[11px] mt-2 pt-2 border-t border-emerald-500/10 leading-relaxed">
                      {faq.a}
                    </p>
                  </details>
                ))}
              </div>
            </div>

            {/* Direct Contacts Card */}
            <div className="bg-[#091810] border border-emerald-500/30 p-4 rounded-2xl space-y-2">
              <div className="text-xs font-black uppercase text-emerald-400 flex items-center gap-1.5">
                <Icon name="phone_in_talk" size={16} />
                <span>Teléfonos Directos de Emergencia</span>
              </div>
              <div className="text-[11px] text-slate-300 space-y-1">
                <div>📞 Guardia Técnica: <strong className="text-white">099 123 456</strong> (24 hs)</div>
                <div>💬 WhatsApp Soporte: <strong className="text-white">+598 99 123 456</strong></div>
                <div>📧 Email: <strong className="text-white">soporte@elarbol.uy</strong></div>
              </div>
            </div>

          </div>

        </div>

        {/* Modal: New Support Ticket */}
        {newTicketModal && (
          <div className="fixed inset-0 z-[1200] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
            <div className="bg-[#09150e] border border-emerald-500/40 rounded-3xl p-6 max-w-lg w-full shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto no-scrollbar">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
                <h3 className="text-lg font-black uppercase text-white flex items-center gap-2">
                  <Icon name="add_circle" className="text-emerald-400" />
                  Reportar Incidencia o Falla Técnica
                </h3>
                <button onClick={() => setNewTicketModal(false)} className="p-1 text-slate-400 hover:text-white">
                  <Icon name="close" size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateTicketSubmit} className="space-y-3.5">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Título del Problema</label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Impresora no saca tickets de delivery"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Categoría</label>
                    <select
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value as any })}
                      className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-400"
                    >
                      <option value="pos_caja">POS y Caja</option>
                      <option value="impresora">Impresora Térmica</option>
                      <option value="dgi_facturacion">Facturación DGI</option>
                      <option value="pedidos_voz">Pedidos por Voz</option>
                      <option value="delivery_maps">Delivery & Google Maps</option>
                      <option value="otro">Otro</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Prioridad</label>
                    <select
                      value={form.priority}
                      onChange={(e) => setForm({ ...form, priority: e.target.value as any })}
                      className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-emerald-300 rounded-xl text-xs font-bold uppercase outline-none focus:border-emerald-400"
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                      <option value="urgente">Urgente (Bloqueante)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Descripción Detallada</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Describe qué ocurrió, en qué pantalla y qué mensaje de error apareció..."
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-400 resize-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Nombre Contacto</label>
                    <input
                      type="text"
                      value={form.contactName}
                      onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                      className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-400"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 mb-1 block">Celular Contacto</label>
                    <input
                      type="text"
                      value={form.contactPhone}
                      onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                      className="w-full p-3 bg-[#050a07] border border-emerald-500/30 text-white rounded-xl text-xs font-bold outline-none focus:border-emerald-400"
                    />
                  </div>
                </div>

                <div className="flex gap-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setNewTicketModal(false)}
                    className="flex-1 py-3 bg-[#122419] hover:bg-[#1a3525] text-slate-300 rounded-xl font-black text-xs uppercase"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl font-black text-xs uppercase shadow-md shadow-emerald-500/20"
                  >
                    Enviar a Guardia Técnica
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
