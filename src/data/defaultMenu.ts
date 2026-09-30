import { MenuItem } from '../types';

export const DEFAULT_MENU: Record<string, MenuItem[]> = {
  promos: [
    { id: 'pr1', name: 'Combo Muzzarella + Fainá + Refresco', price: 890, desc: 'Muzzarella, fainá común y refresco 1.5 L' }
  ],
  pizzas: [
    { id: 'p1', name: 'Pizza común x metro', price: 520, isMeter: true, maxToppings: 6 },
    { id: 'p2', name: 'Pizza común 1/2 metro', price: 300, isMeter: true, maxToppings: 3 },
    { id: 'p3', name: 'Pizza común (porción)', price: 180, isPortion: true, hasToppings: true, maxToppings: 4 },
    { id: 'p4', name: 'Pizza muzzarella x metro', price: 750, isMeter: true, maxToppings: 6 },
    { id: 'p5', name: 'Pizza muzzarella 1/2 metro', price: 450, isMeter: true, maxToppings: 3 },
    { id: 'p6', name: 'Pizza muzzarella (porción)', price: 250, isPortion: true, hasToppings: true, maxToppings: 4 }
  ],
  fainas: [
    { id: 'f1', name: 'Fainá común', price: 130 },
    { id: 'f2', name: 'Fainá con muzzarella', price: 180 }
  ],
  figazas: [
    { id: 'fg1', name: 'Figazza común', price: 200 },
    { id: 'fg2', name: 'Fugazzeta', price: 260, desc: 'Figazza con muzzarella' }
  ],
  pizzetas: [
    { id: 'pz1', name: 'Pizzeta muzzarella', price: 490, desc: 'Salsa y muzzarella', hasToppings: true, maxToppings: 4 },
    { id: 'pz2', name: 'Pizzeta napolitana', price: 550, desc: 'Muzzarella, jamón y tomate', hasToppings: true, maxToppings: 4 },
    { id: 'pz3', name: 'Pizzeta jamón y aceitunas', price: 560, desc: 'Muzzarella, jamón y aceitunas', hasToppings: true, maxToppings: 4 }
  ],
  sandwiches: [
    { id: 's1', name: 'Sándwich caliente', price: 350 },
    { id: 's2', name: 'Sándwich caliente con muzzarella', price: 400 },
    { id: 's3', name: 'Sándwich napolitano', price: 420 }
  ],
  fritas: [],
  milanesas: [],
  bebidas: [
    { id: 'b1', name: 'Refresco cola 600 ml', price: 110, desc: 'Botella 600 ml' },
    { id: 'b2', name: 'Refresco lima-limón 600 ml', price: 110, desc: 'Botella 600 ml' },
    { id: 'b3', name: 'Refresco cola 1.5 L', price: 185, desc: 'Botella 1.5 L' },
    { id: 'b4', name: 'Agua mineral 600 ml', price: 80, desc: 'Con o sin gas' }
  ],
  postres: [
    { id: 'pt1', name: 'Flan', price: 125 }
  ],
  extras: [
    { id: 'ext1', name: 'Costo de envío', price: 50 },
    { id: 'ext2', name: 'Costo extra', price: 50 }
  ],
  gustos: [
    { id: 't1', name: 'Jamón', price: 0 },
    { id: 't2', name: 'Panceta', price: 0 },
    { id: 't3', name: 'Cebolla', price: 0 },
    { id: 't4', name: 'Aceitunas', price: 0 },
    { id: 't5', name: 'Tomate', price: 100 },
    { id: 't6', name: 'Huevo frito', price: 0 },
    { id: 't7', name: 'Roquefort', price: 0 },
    { id: 't8', name: 'Champiñones', price: 0 }
  ]
};

export const DEFAULT_TOPPINGS = DEFAULT_MENU.gustos || [];

export const TOPPING_PRICE = 100;

export const calculateToppingsCost = (item: any, selectedToppings: any[]): number => {
  let cost = 0;
  const regToppings = (selectedToppings || []).filter(t => !t.price || t.price === 0);
  const specToppings = (selectedToppings || []).filter(t => t.price > 0);
  const topCount = regToppings.length;
  if (topCount > 0) {
    if (item.isPortion) cost += topCount >= 3 ? topCount * 50 : topCount * 100;
    else cost += topCount * TOPPING_PRICE;
  }
  specToppings.forEach(t => { cost += t.price; });
  return cost;
};

export const WARNING_THRESHOLDS: Record<string, number[]> = {
  Local: [30, 45, 60],
  Mesa: [30, 45, 60],
  Envío: [30, 45, 60],
  Web: [30, 45, 60]
};

export const DRIVERS = [
  { name: 'Repartidor 1', phone: '' },
  { name: 'Repartidor 2', phone: '' },
  { name: 'Repartidor 3', phone: '' }
];
