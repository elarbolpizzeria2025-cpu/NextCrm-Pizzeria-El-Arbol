import { MenuItem } from '../types';

export const DEFAULT_MENU: Record<string, MenuItem[]> = {
  promos: [
    { id: 'pr1', name: '1 Metro Muzzarella + 2 Fainás', price: 750, desc: '1 metro de muza + 2 fainás comunes' },
    { id: 'pr2', name: '1 Metro Muzzarella + 2 Fainás + 1 Chajá', price: 950, desc: '1 metro muza + 2 fainás + 1 postre chajá' },
    { id: 'pr3', name: '1 Metro Muzzarella + 2 Fainás + 2 Flanes', price: 950, desc: '1 metro muza + 2 fainás + 2 flanes' },
    { id: 'pr4', name: '1 Metro Muzzarella + 2 Fainás + Refresco 1.5L', price: 990, desc: '1 metro muza + 2 fainás + 1 refresco 1.5L' },
    { id: 'pr5', name: '1 Metro Muzzarella + 2 Fainás + 2 Flanes Premium', price: 1050, desc: '1 metro muza + 2 fainás + 2 flanes' }
  ],
  pizzas: [
    { id: 'p1', name: 'Pizza Común x metro', price: 520, isMeter: true, maxToppings: 6 },
    { id: 'p2', name: 'Pizza Común 1/2 metro', price: 300, isMeter: true, maxToppings: 3 },
    { id: 'p3', name: 'Pizza Común (porción)', price: 180, isPortion: true, hasToppings: true, maxToppings: 4 },
    { id: 'p4', name: 'Pizza Muzzarella x metro', price: 750, isMeter: true, maxToppings: 6 },
    { id: 'p5', name: 'Pizza Muzzarella 1/2 metro', price: 450, isMeter: true, maxToppings: 3 },
    { id: 'p6', name: 'Pizza Muzzarella (porción)', price: 250, isPortion: true, hasToppings: true, maxToppings: 4 },
  ],
  fainas: [
    { id: 'f1', name: 'Fainá común', price: 130 },
    { id: 'f2', name: 'Fainá con Muzzarella', price: 180 },
    { id: 'f3', name: 'Fainá de la casa "JPM"', price: 260, desc: 'Jamón, pesto y Muzzarella' },
    { id: 'f4', name: 'Fainá DDL', price: 180, desc: 'Fainá de dulce de leche' },
  ],
  figazas: [
    { id: 'fg1', name: 'Figazza común', price: 260 },
    { id: 'fg2', name: 'Fugazzeta', price: 260, desc: 'Figaza con muzzarella' }
  ],
  pizzetas: [
    { id: 'pz1', name: 'Pizzeta Muzzarella', price: 480, hasToppings: true, maxToppings: 4 },
    { id: 'pz2', name: 'Pizzeta Napolitana', price: 550, desc: 'Muzzarella jamón tomate', hasToppings: true, maxToppings: 4 },
    { id: 'pz3', name: 'Pizzeta Calabrese', price: 530, desc: 'Muzzarella y peperoni', hasToppings: true, maxToppings: 4 },
    { id: 'pz4', name: 'Pizzeta 4 Quesos', price: 580, desc: 'Muzzarella, parmesano, dambo y roquefort', hasToppings: true, maxToppings: 4 },
    { id: 'pz5', name: 'Pizzeta Hawaiana', price: 580, desc: 'Muzzarella jamón y ananá', hasToppings: true, maxToppings: 4 },
    { id: 'pz6', name: 'Pizzeta Americana', price: 550, desc: 'Muzzarella, panceta, huevo frito', hasToppings: true, maxToppings: 4 },
    { id: 'pz7', name: 'Pizzeta Roquefort y Cebolla', price: 620, desc: 'Muzzarella, roquefort, cebolla caramelizada y rúcula', hasToppings: true, maxToppings: 4 },
    { id: 'pz8', name: 'Pizzeta Rúcula y Tomate', price: 550, hasToppings: true, maxToppings: 4 },
    { id: 'pz9', name: 'Pizzeta Jamón y Champiñones', price: 580, desc: 'Muzzarella jamón y champiñones', hasToppings: true, maxToppings: 4 },
    { id: 'pz10', name: 'Pizzeta Jamón y Aceitunas', price: 580, desc: 'Muzzarella, jamón y aceitunas', hasToppings: true, maxToppings: 4 },
    { id: 'pz11', name: 'Pizzeta Capresse', price: 550, desc: 'Muzzarella, tomate y albahaca', hasToppings: true, maxToppings: 4 }
  ],
  sandwiches: [
    { id: 's1', name: 'Sándwich caliente', price: 350 },
    { id: 's2', name: 'Sándwiche c/muzza', price: 400 },
    { id: 's3', name: 'Sándwiche Napolitano', price: 420 },
  ],
  bebidas: [
    { id: 'b1', name: 'Refresco 600 ml', price: 110, desc: 'Coca-Cola, Sprite, Fanta, Paso de los Toros 600ml' },
    { id: 'b2', name: 'Refresco 1 L', price: 150, desc: 'Coca-Cola, Sprite 1 Litro' },
    { id: 'b3', name: 'Coca cola de 1,5 litros', price: 185, desc: 'Coca-Cola 1.5 Litros' },
    { id: 'b4', name: 'Cerveza Patricia de litro', price: 270, desc: 'Botella 1 Litro' },
    { id: 'b5', name: 'Cerveza Pilsen 1L', price: 260, desc: 'Botella 1 Litro' },
    { id: 'b6', name: 'Cerveza Zillertal 1L', price: 290, desc: 'Botella 1 Litro' },
    { id: 'b7_ste', name: 'Stella Artois 1L', price: 300, desc: 'Botella 1 Litro' },
    { id: 'b7_art', name: 'Cerveza artesanal', price: 190, desc: 'Cerveza artesanal tirada/lata' },
    { id: 'b7_cor', name: 'Cerveza Corona 330ml', price: 180, desc: 'Botella 330ml' },
    { id: 'b8', name: 'Agua Salus 600ml', price: 80, desc: 'Agua mineral con o sin gas 600ml' },
    { id: 'b9', name: 'Agua Salus 1.5L', price: 120, desc: 'Agua mineral con o sin gas 1.5 Litros' },
    { id: 'b10_sf6', name: 'Salus Frutté 600 ml', price: 120, desc: 'Agua saborizada 600ml' },
    { id: 'b11_sf15', name: 'Salus Frutté 1.5 L', price: 160, desc: 'Agua saborizada 1.5 Litros' },
    { id: 'b12_w', name: 'Whisky', price: 250, desc: 'Medida de Whisky' },
    { id: 'b13_v', name: 'Rosés Tinto / Vino', price: 205, desc: 'Vino de la casa' }
  ],
  postres: [
    { id: 'pt1', name: 'Postre Chajá', price: 250 },
    { id: 'pt2', name: 'Flan Casero', price: 125 },
  ],
  extras: [
    { id: 'ext1', name: 'Costo de Envío', price: 50 },
    { id: 'ext2', name: 'Costo Extra Fijo', price: 50 }
  ],
  gustos: [
    { id: 't1', name: 'Cebolla caramelizada', price: 0 },
    { id: 't2', name: 'Jamón', price: 0 },
    { id: 't3', name: 'Panceta', price: 0 },
    { id: 't4', name: 'Rúcula', price: 0 },
    { id: 't5', name: 'Albahaca', price: 0 },
    { id: 't7', name: 'Roquefort', price: 0 },
    { id: 't8', name: 'Champiñones', price: 0 },
    { id: 't9', name: 'Aceitunas', price: 0 },
    { id: 't10', name: 'Pepperoni', price: 0 },
    { id: 't11', name: 'Pesto', price: 0 },
    { id: 't12', name: 'Ananá', price: 0 },
    { id: 't13', name: '4 Quesos', price: 0 },
    { id: 't16', name: 'Cebolla', price: 0 },
    { id: 't17', name: 'Huevo Frito', price: 0 },
    { id: 't18', name: 'Tomate', price: 100 },
    { id: 't14', name: 'Cebolla caramelizada, roquefort y panceta', price: 200 },
    { id: 't15', name: 'Cebolla caramelizada, roquefort y rúcula', price: 200 }
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

export const DRIVERS = [{ name: 'Fefo', phone: '' }, { name: 'Samuel', phone: '' }];
