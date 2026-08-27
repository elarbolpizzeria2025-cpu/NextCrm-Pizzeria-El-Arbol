import { MenuItem } from '../types';

export const DEFAULT_MENU: Record<string, MenuItem[]> = {
  promos: [
    { id: 'pr1', name: '1 Metro Muzzarella + 2 Fainás', price: 750, desc: '1 metro de muza + 2 fainás comunes' },
    { id: 'pr2', name: '1 Metro Muzzarella + 2 Fainás + 1 Chajá', price: 920, desc: '1 metro muza + 2 fainás + 1 postre chajá' },
    { id: 'pr3', name: '1 Metro Muzzarella + 2 Fainás + 2 Flanes', price: 1000, desc: '1 metro muza + 2 fainás + 2 flanes' },
    { id: 'pr4', name: '1 Metro Muzzarella + 2 Fainás + Refresco 1.5L', price: 900, desc: '1 metro muza + 2 fainás + 1 refresco 1.5L' }
  ],
  pizzas: [
    { id: 'p3', name: 'Pizza Común (porción)', price: 180, isPortion: true, hasToppings: true, maxToppings: 4 },
    { id: 'p6', name: 'Pizza Muzzarella (porción)', price: 250, isPortion: true, hasToppings: true, maxToppings: 4 },
    { id: 'p2', name: 'Pizza Común 1/2 metro', price: 300, isMeter: true, maxToppings: 3 },
    { id: 'p5', name: 'Pizza Muzzarella 1/2 metro', price: 450, isMeter: true, maxToppings: 3 },
    { id: 'p1', name: 'Pizza Común x metro', price: 520, isMeter: true, maxToppings: 6 },
    { id: 'p4', name: 'Pizza Muzzarella x metro', price: 750, isMeter: true, maxToppings: 6 },
  ],
  fainas: [
    { id: 'f1', name: 'Fainá Común', price: 130 },
    { id: 'f2', name: 'Fainá con Muzzarella', price: 180 },
    { id: 'f3', name: 'Fainá de la casa "JPM"', price: 260, desc: 'Jamón, pesto y Muzzarella' },
    { id: 'f4', name: 'Fainá DDL', price: 180, desc: 'Fainá de dulce de leche' },
  ],
  figazas: [
    { id: 'fg1', name: 'Figaza Común', price: 250 },
    { id: 'fg2', name: 'Figaza con Muzzarella', price: 350 }
  ],
  pizzetas: [
    { id: 'pz1', name: 'Pizzeta Muzzarella', price: 480, hasToppings: true, maxToppings: 4 },
    { id: 'pz2', name: 'Pizzeta Napolitana', price: 550, desc: 'Muzzarella jamón tomate', hasToppings: true, maxToppings: 4 },
    { id: 'pz3', name: 'Pizzeta Calabresa', price: 530, desc: 'Muzzarella y peperoni', hasToppings: true, maxToppings: 4 },
    { id: 'pz4', name: 'Pizzeta 4 Quesos', price: 580, desc: 'Muzzarella, parmesano, dambo y roquefort', hasToppings: true, maxToppings: 4 },
    { id: 'pz5', name: 'Pizzeta Hawaiana', price: 580, desc: 'Muzzarella jamón y ananá', hasToppings: true, maxToppings: 4 },
    { id: 'pz6', name: 'Pizzeta Americana', price: 550, desc: 'Muzzarella, panceta y huevo', hasToppings: true, maxToppings: 4 },
    { id: 'pz7', name: 'Pizzeta Roquefort y Cebolla', price: 620, hasToppings: true, maxToppings: 4 },
    { id: 'pz8', name: 'Pizzeta Rúcula y Tomate', price: 550, hasToppings: true, maxToppings: 4 },
    { id: 'pz9', name: 'Pizzeta Jamón y Champiñones', price: 580, hasToppings: true, maxToppings: 4 },
    { id: 'pz10', name: 'Pizzeta Jamón y Aceitunas', price: 560, hasToppings: true, maxToppings: 4 },
    { id: 'pz11', name: 'Pizzeta Capresse', price: 550, desc: 'Muzzarella, tomate y albahaca', hasToppings: true, maxToppings: 4 }
  ],
  postres: [
    { id: 'pt1', name: 'Postre Chajá', price: 180 },
    { id: 'pt2', name: 'Flan Casero', price: 150 },
  ],
  sandwiches: [
    { id: 's1', name: 'Sándwich Caliente', price: 350 },
    { id: 's2', name: 'Sándwich Caliente con Muzzarella', price: 400 },
    { id: 's3', name: 'Sándwich Napolitano', price: 420 },
  ],
  bebidas: [
    { id: 'b_coca_600', name: 'Coca-Cola 600 ml Regular', price: 110, desc: 'Botella 600ml' },
    { id: 'b_coca_600_zero', name: 'Coca-Cola 600 ml Zero', price: 110, desc: 'Botella 600ml sin azúcar' },
    { id: 'b_sprite_600', name: 'Sprite 600 ml', price: 110, desc: 'Botella 600ml común' },
    { id: 'b_sprite_600_zero', name: 'Sprite 600 ml Zero', price: 110, desc: 'Botella 600ml sin azúcar' },
    { id: 'b_coca_15', name: 'Coca-Cola 1.5 L Regular', price: 185, desc: 'Botella 1.5 Litros' },
    { id: 'b_coca_15_zero', name: 'Coca-Cola 1.5 L Zero', price: 185, desc: 'Botella 1.5 Litros sin azúcar' },
    { id: 'b_sprite_15', name: 'Sprite 1.5 L Común', price: 185, desc: 'Botella 1.5 Litros' },
    { id: 'b_fanta_15', name: 'Fanta Naranja 1.5 L', price: 185, desc: 'Botella 1.5 Litros' },
    { id: 'b_schweppes_pomelo_15', name: 'Schweppes Pomelo 1.5 L', price: 185, desc: 'Botella 1.5 Litros' },
    { id: 'b_schweppes_tonica_15', name: 'Schweppes Tónica 1.5 L', price: 185, desc: 'Botella 1.5 Litros' },
    { id: 'b4', name: 'Cerveza Patricia 1L', price: 270, desc: 'Botella 1 Litro' },
    { id: 'b5', name: 'Cerveza Pilsen 1L', price: 260, desc: 'Botella 1 Litro' },
    { id: 'b6', name: 'Cerveza Zillertal 1L', price: 290, desc: 'Botella 1 Litro' },
    { id: 'b7_ste', name: 'Stella Artois 1L', price: 300, desc: 'Botella 1 Litro' },
    { id: 'b7_cor', name: 'Cerveza Corona 330ml', price: 180, desc: 'Botella 330ml' },
    { id: 'b7_art', name: 'Cerveza Artesanal', price: 190, desc: 'Cerveza artesanal tirada/lata' },
    { id: 'b8', name: 'Agua Salus 600ml', price: 80, desc: 'Agua mineral con o sin gas 600ml' },
    { id: 'b9', name: 'Agua Salus 1.5L', price: 120, desc: 'Agua mineral con o sin gas 1.5 Litros' },
    { id: 'b10_sf6', name: 'Salus Frutté 600 ml', price: 120, desc: 'Agua saborizada 600ml' },
    { id: 'b11_sf15', name: 'Salus Frutté 1.5 L', price: 160, desc: 'Agua saborizada 1.5 Litros' },
    { id: 'b12_w', name: 'Whisky', price: 250, desc: 'Medida de Whisky' },
    { id: 'b13_v', name: 'Rosés Tinto', price: 205, desc: 'Vino Rosés Tinto' }
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
