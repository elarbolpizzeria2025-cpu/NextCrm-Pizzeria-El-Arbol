# NEXTCRM — Contrato de seguridad SaaS (implementación pendiente)

Este documento define condiciones obligatorias para Pizzería, Miniempresas y NEXTCRM Central. No declara funciones implementadas.

## Aislamiento y acceso
- Cada cuenta comercial tiene tenant_id inmutable. La identidad se deriva de sesión verificada por servidor, nunca de un tenant_id suministrado libremente por navegador.
- Autorización por tenant, rol y plan en cada operación de servidor y reglas de Firestore. Prohibido acceso cruzado, incluso en listeners, exportaciones y almacenamiento.
- Estado de suscripción comprobado en servidor para cada recurso protegido; suspensión reversible sin borrar datos. Las landing públicas solo se sirven para planes habilitados.
- MFA obligatorio para administradores centrales; roles de mínimo privilegio, sesiones revocables, registro auditable de altas, cambios de plan, bloqueos y credenciales.

## Pedidos y pagos
- Prohibido crear pedidos directamente desde una landing pública en Firestore sin validación del backend. Precios, productos, cantidades, descuentos y total se recalculan en servidor con catálogo de ese tenant.
- Mercado Pago/dLocal Go: tokens secretos exclusivamente en servidor, almacenados en gestor de secretos; cada comercio usa su cuenta autorizada. No guardar datos de tarjetas.
- Webhooks: verificar firma y autenticidad según proveedor, obtener el pago desde API oficial, contrastar comercio, monto, moneda, pedido y estado. Responder idempotentemente a reintentos; impedir doble confirmación.
- Transferencias: estado pendiente hasta conciliación verificada; nunca marcar pagado por captura o texto enviado por cliente.
- Biller: credenciales por tenant protegidas, trazabilidad fiscal, permisos de emisión separados y reintentos idempotentes.

## Protección operativa
- WAF y rate limiting por IP, usuario y tenant; protección contra abuso de endpoints públicos, autenticación y webhooks.
- CORS restrictivo, CSP y cabeceras de seguridad, validación de esquemas, límites de tamaño, sanitización de salidas y control CSRF donde corresponda.
- No publicar secretos en frontend, repositorio ni logs. Rotación de credenciales; separación desarrollo/producción.
- Backups cifrados y pruebas de restauración; alertas por anomalías y consumo, auditoría de dependencias y pruebas de autorización inter-tenant.

## Puertas de salida a producción
1. Confirmar arquitectura de identidad, reglas reales de Firebase y backend; pruebas negativas entre dos empresas.
2. Integración de checkout y webhooks con sandbox y pruebas de duplicados, reembolsos y errores.
3. Revisión de roles, MFA, backups, monitoreo, límites de gasto y pruebas de regresión del CRM existente.
4. Desplegar primero entorno de pruebas; verificar build y funcionamiento antes de habilitar pagos reales.

## Planes
- Pizzería 1: gestión; 2: gestión + landing y WhatsApp; 3: gestión + landing + mensajería + pagos.
- Miniempresas 1: gestión; 2: gestión + landing y facturación; 3: gestión + landing + facturación + cobros.
- Los permisos no se implementan ocultando botones solamente: deben bloquearse en el backend.
