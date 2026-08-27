import React from 'react';
import { Icon } from './Icon';

interface OperationsManualTabProps {
  showMessage?: (msg: string, type?: 'success' | 'error') => void;
  setActiveTab?: (tab: string) => void;
}

export const OperationsManualTab: React.FC<OperationsManualTabProps> = ({
  showMessage,
  setActiveTab,
}) => {
  const handlePrintManual = () => {
    window.print();
  };

  const contactWhatsApp = () => {
    window.open(
      'https://wa.me/59898356320?text=' +
        encodeURIComponent(
          '👋 *Hola Administración de Pizzería El Árbol.*\nMe comunico por una consulta operativa o soporte del sistema.'
        ),
      '_blank'
    );
  };

  return (
    <div className="p-6 md:p-10 h-full overflow-y-auto bg-[#040108] text-slate-100 no-scrollbar space-y-8 print:p-0 print:bg-white print:text-black">
      <div className="max-w-6xl mx-auto space-y-8 print:max-w-none print:space-y-4">
        {/* Header Bar - Centered Title & Right-Aligned Buttons */}
        <div className="bg-[#0d061c] border border-purple-500/30 p-6 sm:p-8 rounded-3xl shadow-xl shadow-purple-950/20 space-y-5 print:border-none print:bg-transparent print:p-0">
          {/* Top Actions: Aligned to the Right */}
          <div className="flex justify-end items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={handlePrintManual}
              className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Icon name="download" size={18} />
              <span>Imprimir Manual PDF</span>
            </button>

            <button
              type="button"
              onClick={contactWhatsApp}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black text-xs uppercase flex items-center gap-2.5 transition-all shadow-lg shadow-purple-600/25 cursor-pointer hover:scale-[1.02] active:scale-95"
            >
              <Icon name="chat" size={18} />
              <span>WhatsApp Directo (098356320)</span>
            </button>
          </div>

          {/* Centered Main Title and Subtitle */}
          <div className="text-center space-y-2 max-w-3xl mx-auto">
            <div className="inline-flex items-center justify-center gap-3">
              <span className="w-12 h-12 rounded-2xl bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black shadow-inner print:hidden">
                <Icon name="menu_book" size={26} />
              </span>
              <h1 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white print:text-black">
                Manual de Operaciones & Protocolo de Turno
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-purple-300 font-bold uppercase tracking-wider print:text-gray-600">
              Pizzería El Árbol • Guía Estándar para Mostrador, Cocina KDS, Reparto y Facturación
            </p>
          </div>
        </div>

        {/* Guía Rápida de 3 Columnas */}
        <div className="bg-[#0b0518] border border-purple-500/25 p-6 rounded-3xl space-y-4 print:border-gray-300 print:bg-transparent">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
            <div>
              <h2 className="text-xl font-black uppercase text-white print:text-black">
                Guía Rápida de Operaciones
              </h2>
              <p className="text-[11px] text-slate-400 font-bold uppercase print:text-gray-600">
                Instrucciones clave para el personal de mostrador y cocina
              </p>
            </div>
            <button
              type="button"
              onClick={handlePrintManual}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase shadow-sm print:hidden"
            >
              <Icon name="download" size={14} /> Imprimir Manual PDF
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Box 1 */}
            <div className="bg-[#06020e] border border-purple-500/20 p-5 rounded-2xl space-y-2 print:border-gray-300 print:bg-transparent">
              <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase print:text-black">
                <Icon name="point_of_sale" size={18} />
                <span>1. Toma de Pedido</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium print:text-gray-700">
                Ingresa al módulo <strong className="text-purple-300 print:text-black">Toma de Pedido</strong>, selecciona tipo de entrega (Mostrador / Delivery / Mesas), carga los productos y gustos, y confirma el pago con cálculo de vuelto y emisión de comanda.
              </p>
            </div>

            {/* Box 2 */}
            <div className="bg-[#06020e] border border-purple-500/20 p-5 rounded-2xl space-y-2 print:border-gray-300 print:bg-transparent">
              <div className="flex items-center gap-2 text-blue-400 font-black text-xs uppercase print:text-black">
                <Icon name="tv" size={18} />
                <span>2. Monitor KDS Cocina</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium print:text-gray-700">
                Visualiza las comandas entrantes clasificadas por tiempo (tiempo normal, alerta, demorado en rojo). Toca 'En Preparación' al meter al horno y 'Listo para Entrega' al despachar la pizza.
              </p>
            </div>

            {/* Box 3 */}
            <div className="bg-[#06020e] border border-purple-500/20 p-5 rounded-2xl space-y-2 print:border-gray-300 print:bg-transparent">
              <div className="flex items-center gap-2 text-purple-400 font-black text-xs uppercase print:text-black">
                <Icon name="mic" size={18} />
                <span>3. Pedido por Voz & WhatsApp</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-medium print:text-gray-700">
                Presiona 'Pedido por Voz' para dictar ítem por ítem con jerga uruguaya, o usa <strong className="text-purple-300 print:text-black">'Pegar de WhatsApp'</strong> para pegar mensajes de clientes y extraer automáticamente la comanda y dirección.
              </p>
            </div>
          </div>
        </div>

        {/* Detailed Operations Chapters */}
        <div className="space-y-6">
          {/* Chapter 1: Toma de Pedidos & WhatsApp */}
          <div className="bg-[#0b0518] border border-purple-500/25 p-6 rounded-3xl space-y-4 print:border-gray-300 print:bg-transparent">
            <h3 className="text-lg font-black uppercase text-purple-400 flex items-center gap-2 print:text-black">
              <Icon name="shopping_cart_checkout" size={20} />
              Capítulo 1: Protocolo de Toma de Pedidos (Paso a Paso)
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-blue-300 uppercase print:text-black">Paso 1: Destino & Cliente</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 print:text-gray-700">
                  <li>Elige: <strong>Mostrador</strong> (retiro), <strong>Mesas</strong> (salón) o <strong>Delivery</strong> (envío).</li>
                  <li>Ingresa teléfono (ej: 098356320) y dirección con esquina o apto.</li>
                  <li>Verifica la ubicación en Google Maps en tiempo real.</li>
                </ul>
              </div>

              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-purple-300 uppercase print:text-black">Paso 2: Menú & Gustos</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 print:text-gray-700">
                  <li>Selecciona la categoría (Pizzas por metro, fainá, bebidas).</li>
                  <li>Usa el modal de gustos para armar mitades o cuartos.</li>
                  <li>Si el cliente escribe por chat, usa <strong className="text-white print:text-black">'Pegar de WhatsApp'</strong>.</li>
                </ul>
              </div>

              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-purple-300 uppercase print:text-black">Paso 3: Pago & Cierre</div>
                <ul className="list-disc list-inside space-y-1 text-slate-300 print:text-gray-700">
                  <li>Selecciona medio de pago: Efectivo, Débito, Crédito, Transferencia o MP.</li>
                  <li>Si paga con billete, ingresa el monto para calcular el vuelto exacto.</li>
                  <li>Pulsa <strong className="text-white print:text-black">'Confirmar y Enviar a Cocina'</strong>.</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Chapter 2: Reparto & Delivery por WhatsApp */}
          <div className="bg-[#0b0518] border border-purple-500/25 p-6 rounded-3xl space-y-4 print:border-gray-300 print:bg-transparent">
            <h3 className="text-lg font-black uppercase text-purple-400 flex items-center gap-2 print:text-black">
              <Icon name="two_wheeler" size={20} />
              Capítulo 2: Despacho a Cadetes y Delivery por WhatsApp
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-white uppercase print:text-black">Envío Automático de Comanda al Cadete</div>
                <p className="text-slate-300 print:text-gray-700">
                  Al confirmar un pedido de delivery o desde el monitor KDS, haz clic en <strong className="text-purple-300 print:text-black">'🛵 Enviar a Cadete por WhatsApp'</strong>. El sistema abrirá WhatsApp Web con la dirección, link GPS directo a Google Maps, detalle de comida, monto a cobrar y vuelto a llevar.
                </p>
              </div>

              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-white uppercase print:text-black">Notificación al Cliente Final</div>
                <p className="text-slate-300 print:text-gray-700">
                  Con el botón de WhatsApp del cliente, puedes avisarle automáticamente cuando la pizza sale del horno en camino a su domicilio, reduciendo reclamos y llamadas.
                </p>
              </div>
            </div>
          </div>

          {/* Chapter 3: Objeciones & Fidelización CRM */}
          <div className="bg-[#0b0518] border border-purple-500/25 p-6 rounded-3xl space-y-4 print:border-gray-300 print:bg-transparent">
            <h3 className="text-lg font-black uppercase text-purple-400 flex items-center gap-2 print:text-black">
              <Icon name="psychology" size={20} />
              Capítulo 3: Manejo de Objeciones y CRM de Clientes
            </h3>

            <div className="space-y-3 text-xs">
              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-white uppercase print:text-black">Respuestas Comerciales Rápidas</div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-300 print:text-gray-700">
                  <div>
                    <strong>• Rendimiento del Metro:</strong> Explica que 1 metro rinde 4 a 5 personas (8 porciones gigantes). Para 2 personas sugiere 1/2 metro o combo con Fainá.
                  </div>
                  <div>
                    <strong>• Calidad vs Precio:</strong> Resalta que la pizza es artesanal a la pala a la piedra con muzzarella Conaprole de primera calidad.
                  </div>
                  <div>
                    <strong>• Demora estimada:</strong> 20-30 min para retiro / 35-45 min para delivery. Si hay apuro, ofrecer fainá o porciones listas.
                  </div>
                  <div>
                    <strong>• Opciones Dietarias:</strong> Ofrecer masa fina bien tostada, vegetales grillados, champiñones, o sin orégano/sin sal.
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Chapter 4: Apertura, Cierre de Caja & Arqueo */}
          <div className="bg-[#0b0518] border border-purple-500/25 p-6 rounded-3xl space-y-4 print:border-gray-300 print:bg-transparent">
            <h3 className="text-lg font-black uppercase text-purple-400 flex items-center gap-2 print:text-black">
              <Icon name="account_balance_wallet" size={20} />
              Capítulo 4: Apertura, Arqueo de Caja y Cierre de Turno
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-white uppercase print:text-black">Apertura con Efectivo Inicial & Stock Opcional</div>
                <p className="text-slate-300 print:text-gray-700">
                  Al iniciar el turno, el sistema solicita ingresar el monto en efectivo con el que se inicia la caja (para cambio). Opcionalmente se puede cargar o editar el inventario de stock disponible, sin ser requisito bloqueante.
                </p>
              </div>

              <div className="bg-[#06020e] p-4 rounded-2xl border border-purple-500/15 space-y-2 print:border-gray-300 print:bg-transparent">
                <div className="font-black text-white uppercase print:text-black">Cierre de Caja Z & Desglose de Medios de Pago</div>
                <p className="text-slate-300 print:text-gray-700">
                  Al finalizar la jornada, se realiza el Cierre de Caja donde se desglosan automáticamente los ingresos por Efectivo, Débito, Crédito, Transferencia bancaria y Mercado Pago, permitiendo imprimir el reporte A4 o ticket térmico de 80mm.
                </p>
              </div>
            </div>
          </div>

          {/* Contact Box */}
          <div className="bg-[#0d061c] border border-purple-500/30 p-6 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-4 text-xs print:border-gray-300 print:bg-transparent">
            <div className="space-y-1 text-center sm:text-left">
              <div className="font-black text-purple-300 uppercase text-sm print:text-black">
                Contacto Directo con Administración & Soporte
              </div>
              <div className="text-slate-300 font-medium print:text-gray-700">
                Número de contacto oficial: <strong className="text-white print:text-black">098356320</strong> (+598 98 356 320)
              </div>
            </div>

            <button
              type="button"
              onClick={contactWhatsApp}
              className="px-5 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-2xl font-black uppercase text-xs transition-all flex items-center gap-2 shadow-lg shadow-purple-600/25 print:hidden"
            >
              <Icon name="chat" size={18} />
              <span>Contactar por WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
