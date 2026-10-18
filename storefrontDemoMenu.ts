import type { MenuItem } from './types';
// Menú exclusivamente de demostración; nunca se usa para calcular cobros reales.
export const DEFAULT_MENU: MenuItem[] = [
  { id: 'demo-muza', name: 'Pizza muzzarella', price: 450, desc: 'Producto de ejemplo' },
  { id: 'demo-faina', name: 'Fainá', price: 130, desc: 'Producto de ejemplo' },
  { id: 'demo-refresco', name: 'Refresco', price: 120, desc: 'Producto de ejemplo' },
];
