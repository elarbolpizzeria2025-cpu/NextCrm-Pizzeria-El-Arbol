import React from 'react';
import { MenuItem, Topping } from '../types';
import { Icon } from './Icon';
import { calculateToppingsCost, TOPPING_PRICE } from '../data/defaultMenu';

interface ToppingModalProps {
  isOpen: boolean;
  item: MenuItem | null;
  selectedToppings: Topping[];
  quantity: number;
  menuGustos: Topping[];
  onClose: () => void;
  onSelectTopping: (t: Topping) => void;
  onUpdateQuantity: (qty: number) => void;
  onConfirm: (item: MenuItem, toppings: Topping[], qty: number) => void;
}

export const ToppingModal: React.FC<ToppingModalProps> = ({
  isOpen,
  item,
  selectedToppings,
  quantity,
  menuGustos,
  onClose,
  onSelectTopping,
  onUpdateQuantity,
  onConfirm,
}) => {
  if (!isOpen || !item) return null;

  const maxToppings = (item.maxToppings || 4) * quantity;
  const toppingsCostUnit = calculateToppingsCost(item, selectedToppings);
  const finalUnitPrice = item.price + toppingsCostUnit;
  const grandTotal = Math.round(finalUnitPrice * quantity);

  const regToppings = selectedToppings.filter(t => !t.price || t.price === 0);
  const specToppings = selectedToppings.filter(t => t.price > 0);

  return (
    <div className="fixed inset-0 bg-[#060a08]/90 flex items-center justify-center z-[1100] p-4 backdrop-blur-md">
      <div className="bg-[#0b140f] border-2 border-emerald-500/30 rounded-[36px] shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh] text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="bg-[#0e1c15] text-white p-6 flex justify-between items-center border-b border-emerald-500/20">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl">
                <Icon name="local_pizza" size={22} />
              </span>
              <h3 className="font-black uppercase text-xl text-white tracking-tight">
                {item.name}
              </h3>
            </div>
            <p className="text-[11px] font-black text-emerald-400 uppercase mt-1">
              Gustos seleccionados: {selectedToppings.length} de {maxToppings}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2.5 bg-slate-900/60 hover:bg-red-600/80 text-slate-300 hover:text-white rounded-xl transition-all"
          >
            <Icon name="close" size={20} />
          </button>
        </div>

        {/* Live Calculation Banner */}
        <div className="bg-[#070e0a] px-6 py-4 border-b border-emerald-500/20 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 text-xs font-black">
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Precio Base</span>
              <span className="text-white text-base">${item.price}</span>
            </div>
            <div className="text-emerald-500/40 text-lg">+</div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">
                {regToppings.length} Gusto{regToppings.length !== 1 ? 's' : ''} Clásico{regToppings.length !== 1 ? 's' : ''}
              </span>
              <span className="text-emerald-400 text-base">
                +${item.isPortion ? (regToppings.length >= 3 ? regToppings.length * 50 : regToppings.length * 100) : regToppings.length * TOPPING_PRICE}
              </span>
            </div>
            {specToppings.length > 0 && (
              <>
                <div className="text-emerald-500/40 text-lg">+</div>
                <div>
                  <span className="text-slate-400 uppercase text-[9px] block">Especiales</span>
                  <span className="text-amber-400 text-base">
                    +${specToppings.reduce((acc, t) => acc + (t.price || 0), 0)}
                  </span>
                </div>
              </>
            )}
            <div className="text-emerald-500/40 text-lg">=</div>
            <div>
              <span className="text-slate-400 uppercase text-[9px] block">Unitario</span>
              <span className="text-emerald-300 text-lg font-black">${finalUnitPrice}</span>
            </div>
          </div>

          {/* Quantity selector */}
          <div className="flex items-center gap-2 bg-[#0e1b14] px-3 py-1.5 rounded-2xl border border-emerald-500/30">
            <span className="text-[10px] font-black uppercase text-slate-400 mr-1">Cant:</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(Math.max(1, quantity - 1))}
              className="w-7 h-7 bg-[#070e0a] hover:bg-emerald-950 text-slate-300 rounded-lg flex items-center justify-center font-black"
            >
              -
            </button>
            <span className="font-black text-sm text-emerald-400 px-2 min-w-5 text-center">{quantity}</span>
            <button
              type="button"
              onClick={() => onUpdateQuantity(quantity + 1)}
              className="w-7 h-7 bg-[#070e0a] hover:bg-emerald-950 text-slate-300 rounded-lg flex items-center justify-center font-black"
            >
              +
            </button>
          </div>
        </div>

        {/* Toppings Grid */}
        <div className="p-6 bg-[#09120e] flex-1 overflow-y-auto no-scrollbar">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {menuGustos.map(t => {
              const sel = selectedToppings.some(x => x.id === t.id);
              const isSpecial = t.price > 0;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onSelectTopping(t)}
                  className={`p-4 rounded-[22px] border-2 font-black uppercase text-xs transition-all flex flex-col items-center justify-center text-center relative ${
                    sel
                      ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-md shadow-emerald-500/20 scale-[1.02]'
                      : 'bg-[#0e1b14] border-emerald-500/20 text-slate-200 hover:border-emerald-500/50'
                  }`}
                >
                  {sel && (
                    <span className="absolute top-2 right-2 w-4 h-4 bg-slate-950 text-emerald-400 rounded-full flex items-center justify-center text-[9px] font-black">
                      ✓
                    </span>
                  )}
                  <span>{t.name}</span>
                  {isSpecial ? (
                    <span className={`text-[10px] mt-1 font-black ${sel ? 'text-slate-900' : 'text-amber-400'}`}>
                      (+${t.price})
                    </span>
                  ) : (
                    <span className={`text-[9px] mt-1 font-bold ${sel ? 'text-slate-900' : 'text-emerald-400/80'}`}>
                      (+${item.isPortion ? (regToppings.length >= 2 && !sel ? 50 : 100) : TOPPING_PRICE})
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Confirm Footer */}
        <div className="p-6 border-t border-emerald-500/20 bg-[#070e0a] shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <span className="text-[10px] font-black uppercase text-slate-400 block">Total con Gustos ({quantity} un.)</span>
            <span className="text-3xl font-black text-emerald-400 tracking-tighter">${grandTotal}</span>
          </div>

          <button
            type="button"
            onClick={() => onConfirm(item, selectedToppings, quantity)}
            className="w-full sm:w-auto px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-2xl font-black uppercase text-xs shadow-xl shadow-emerald-500/25 transition-all flex items-center justify-center gap-2"
          >
            <Icon name="add_shopping_cart" size={18} /> Agregar a la Comanda (${grandTotal})
          </button>
        </div>
      </div>
    </div>
  );
};
