/** Plan entitlements are authoritative ONLY when verified on the backend. */
export type StorefrontPlan = 'gestion' | 'web' | 'web_pagos';
export const STOREFRONT_PLANS = {
  gestion: { publicWeb: false, cart: false, submitOrders: false, onlinePayments: false },
  web: { publicWeb: true, cart: true, submitOrders: true, onlinePayments: false },
  web_pagos: { publicWeb: true, cart: true, submitOrders: true, onlinePayments: true },
} as const;
export const capabilitiesFor = (plan: StorefrontPlan) => STOREFRONT_PLANS[plan];
// No inferir planes a partir de query params, localStorage o controles del navegador.
// En producción el servidor debe verificar plan, tenant y estado de suscripción.
