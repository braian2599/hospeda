# Entorno de staging

Rama de integración para probar cambios (Booking, Airbnb, ARCA/AFIP) antes de mergear a `main`.

- Deploy: preview automático de Vercel para esta rama.
- Base de datos: Neon branch `staging`, aislada de producción (variable `DATABASE_URL` de Vercel, scope Preview).
- Flujo: `feat/*` → `develop` → probar en preview → `main`.
