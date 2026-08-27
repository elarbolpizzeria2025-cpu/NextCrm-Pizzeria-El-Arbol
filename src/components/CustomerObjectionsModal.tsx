import React, { useState } from 'react';
import { Icon } from './Icon';
import { MenuItem } from '../types';

interface CustomerObjectionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  allMenuItems: MenuItem[];
  onAddQuickItem: (item: MenuItem, toppings?: string[], quantity?: number) => void;
  onAddNote: (note: string) => void;
  showMessage: (msg: string, type?: 'success' | 'error') => void;
}

interface ObjectionItem {
  objection: string;
  suggestion: string;
  actionLabel?: string;
  actionType?: 'add_item' | 'add_note';
  targetItemQuery?: string;
  targetNote?: string;
}

interface ObjectionCategory {
  id: string;
  title: string;
  icon: string;
  items: ObjectionItem[];
}

const OBJECTION_CATEGORIES: ObjectionCategory[] = [
  {
    id: 'portions',
    title: 'Porciones, Medidas & Rendimiento',
    icon: 'straighten',
    items: [
      {
        objection: '¿Para cuántas personas rinde 1 Metro de Pizza?',
        suggestion: '1 Metro entero rinde de 4 a 5 personas adultas (son 16 a 20 porciones generosas). Si son 2 o 3 personas, recomiéndale 1/2 Metro (rinde 2-3 personas).',
        actionLabel: '+ Cargar 1 Metro Muzzarella',
        actionType: 'add_item',
        targetItemQuery: 'metro',
      },
      {
        objection: '¿Cuántos gustos le puedo poner a 1 Metro?',
        suggestion: 'El metro se puede dividir hasta en 4 gustos distintos (un gusto por cuarto de metro). El 1/2 metro admite hasta 2 gustos.',
        actionLabel: 'Agregar Nota: "Dividir en 4 Gustos"',
        actionType: 'add_note',
        targetNote: 'Dividir metro en 4 gustos distintos',
      },
      {
        objection: '¿Qué diferencia hay entre Redonda y Metro?',
        suggestion: 'La pizza redonda tradicional rinde 1 o 2 personas (8 porciones). El metro a la pala tiene mayor superficie y masa más aireada a la piedra.',
      },
    ],
  },
  {
    id: 'price',
    title: 'Precios, Promos & Combos',
    icon: 'savings',
    items: [
      {
        objection: 'Me parece un poco caro / Busco alguna promo',
        suggestion: 'Explícale que la pizza es 100% artesanal a la pala a la piedra con muzzarella conaprole de primera calidad. Puedes ofrecerle el combo con Fainá o Refresco que tiene mejor rendimiento por persona.',
        actionLabel: '+ Cargar Fainá Entrada',
        actionType: 'add_item',
        targetItemQuery: 'fainá',
      },
      {
        objection: '¿Tienen descuento por cantidad para cumpleaños o reuniones?',
        suggestion: 'Para más de 3 metros de pizza o eventos familiares, se incluye refresco de 1.5L de cortesía o descuento especial en el envío.',
        actionLabel: 'Agregar Nota "Descuento / Promo Grupo"',
        actionType: 'add_note',
        targetNote: 'Promo Grupo / Refresco incluido',
      },
    ],
  },
  {
    id: 'timing',
    title: 'Demora & Tiempos de Entrega',
    icon: 'schedule',
    items: [
      {
        objection: '¿Cuánto demora el pedido? / Estoy con apuro',
        suggestion: 'Mostrador/Retiro: 15 a 25 min promedio. Delivery: 35 a 45 min. Si tiene apuro, recomiéndale Fainá o Pizza en Porciones que ya están casi listas.',
        actionLabel: 'Agregar Nota "PRIORIDAD / APURO"',
        actionType: 'add_note',
        targetNote: 'URGENTE: Cliente con apuro',
      },
      {
        objection: 'Quiero dejarlo encargado para más tarde',
        suggestion: 'Puedes activar la casilla "Programar Comanda" en el Paso 3 para fijar la hora exacta de salida del horno.',
      },
    ],
  },
  {
    id: 'diet',
    title: 'Dietas, Cocción & Preferencias',
    icon: 'local_dining',
    items: [
      {
        objection: '¿Tienen opciones vegetarianas?',
        suggestion: 'Sí: Pizza con champiñones, morrones asados, aceitunas, choclo, albahaca fresca, 4 quesos o Fainá tradicional.',
        actionLabel: 'Nota: "Opción Vegetariana"',
        actionType: 'add_note',
        targetNote: 'Vegetariana / Sin fiambre',
      },
      {
        objection: 'La quiero bien tostada / crocante',
        suggestion: 'Indícale que la pasaremos por piso del horno para que quede bien crocante y dorada.',
        actionLabel: '+ Nota "Bien Tostada"',
        actionType: 'add_note',
        targetNote: 'Bien tostada',
      },
      {
        objection: 'Sin orégano / sin sal / poco queso',
        suggestion: 'Se prepara a pedido en cocina exactamente como el cliente prefiera.',
        actionLabel: '+ Nota "Sin Orégano"',
        actionType: 'add_note',
        targetNote: 'Sin orégano',
      },
    ],
  },
  {
    id: 'faina',
    title: 'Fainá & Entradas',
    icon: 'bakery_dining',
    items: [
      {
        objection: '¿Qué tipo de Fainá tienen?',
        suggestion: 'Fainá tradicional a la pala, Fainá de orilla (crocante) y Fainá con Muzzarella derretida encima.',
        actionLabel: '+ Cargar Fainá al Carrito',
        actionType: 'add_item',
        targetItemQuery: 'fainá',
      },
      {
        objection: '¿Recomiendan entrada antes de la pizza?',
        suggestion: 'El Fainá caliente con pimienta blanca es la entrada perfecta mientras esperan la pizza principal.',
        actionLabel: '+ Agregar 2 Fainá',
        actionType: 'add_item',
        targetItemQuery: 'fainá',
      },
    ],
  },
];

export const CustomerObjectionsModal: React.FC<CustomerObjectionsModalProps> = ({
  isOpen,
  onClose,
  allMenuItems,
  onAddQuickItem,
  onAddNote,
  showMessage,
}) => {
  const [selectedCat, setSelectedCat] = useState<string>('portions');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const currentCategory = OBJECTION_CATEGORIES.find(c => c.id === selectedCat) || OBJECTION_CATEGORIES[0];

  // Filter items by search
  const filteredItems = OBJECTION_CATEGORIES.flatMap(cat =>
    cat.items.map(item => ({ ...item, catTitle: cat.title, catId: cat.id }))
  ).filter(i => {
    if (!searchQuery.trim()) return i.catId === selectedCat;
    const q = searchQuery.toLowerCase();
    return i.objection.toLowerCase().includes(q) || i.suggestion.toLowerCase().includes(q);
  });

  const handleAction = (item: any) => {
    if (item.actionType === 'add_note' && item.targetNote) {
      onAddNote(item.targetNote);
      showMessage(`Observación "${item.targetNote}" agregada a la comanda`, 'success');
    } else if (item.actionType === 'add_item' && item.targetItemQuery) {
      const q = item.targetItemQuery.toLowerCase();
      const found = allMenuItems.find(m => m.name.toLowerCase().includes(q) || (m.desc && m.desc.toLowerCase().includes(q))) || allMenuItems[0];
      if (found) {
        onAddQuickItem(found, [], 1);
        showMessage(`Producto "${found.name}" agregado a la comanda`, 'success');
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[1200] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="bg-[#0b0617] border-2 border-purple-500/40 rounded-3xl p-5 sm:p-7 max-w-3xl w-full shadow-2xl space-y-5 text-slate-100 max-h-[90vh] overflow-y-auto custom-dark-scrollbar">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-purple-600/30 text-purple-300 border border-purple-500/40 flex items-center justify-center font-black">
              <Icon name="tips_and_updates" size={22} />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black uppercase text-white tracking-tight flex items-center gap-2">
                Manejo de Objeciones & Respuestas Comerciales
              </h3>
              <p className="text-[10px] text-purple-300 font-bold uppercase">
                Argumentos clave de venta, rendimientos, porciones y opciones sugeridas
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-xl">
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Search Input */}
        <div className="relative">
          <Icon name="search" size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar objeción o duda (ej: demora, rinde el metro, caro, vegetariana)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#06030e] border border-purple-500/30 text-white placeholder-slate-500 rounded-xl text-xs font-black uppercase outline-none focus:border-purple-400"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <Icon name="close" size={14} />
            </button>
          )}
        </div>

        {/* Category Pills (if not searching) */}
        {!searchQuery.trim() && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
            {OBJECTION_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCat(cat.id)}
                className={`px-3 py-2 rounded-xl text-[11px] font-black uppercase transition-all flex items-center gap-1.5 shrink-0 ${
                  selectedCat === cat.id
                    ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                    : 'bg-[#120826] text-slate-300 hover:bg-[#1e0e3c] border border-purple-500/20'
                }`}
              >
                <Icon name={cat.icon} size={14} />
                <span>{cat.title}</span>
              </button>
            ))}
          </div>
        )}

        {/* Objections & Suggestions List */}
        <div className="space-y-3">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center text-slate-500 uppercase font-black text-xs">
              No se encontraron respuestas para esa consulta.
            </div>
          ) : (
            filteredItems.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#0e071e] p-4 rounded-2xl border border-purple-500/25 space-y-2 hover:border-purple-500/50 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-xs font-black uppercase text-purple-300 flex items-center gap-1.5">
                      <span className="text-red-400">❓</span> {item.objection}
                    </div>
                    <p className="text-xs text-slate-200 font-semibold leading-relaxed pl-5">
                      {item.suggestion}
                    </p>
                  </div>
                </div>

                {item.actionLabel && (
                  <div className="pl-5 pt-1">
                    <button
                      type="button"
                      onClick={() => handleAction(item)}
                      className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-[10px] font-black uppercase transition-all shadow-sm flex items-center gap-1.5"
                    >
                      <Icon name="add" size={13} /> {item.actionLabel}
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-purple-500/20">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-black uppercase text-xs transition-all shadow-md shadow-purple-600/30"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
