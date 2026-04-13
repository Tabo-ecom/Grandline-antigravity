# Grand Line v8

Plataforma SaaS de analytics para dropshippers LATAM que operan con Dropi. Temática náutica/One Piece.

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + Tailwind CSS v4
- **Auth:** Firebase Auth (email/password + Google OAuth)
- **DB:** Firestore (multi-tenant, scoped por `team_id`)
- **Pagos:** Stripe (suscripciones mensuales, webhooks)
- **Charts:** Recharts | **Iconos:** Lucide React | **Fuente:** Space Grotesk
- **IA:** Google Gemini + OpenAI (módulo VEGA)
- **Deploy:** Vercel (`npx vercel --prod --yes`)

## Comandos

- `npm run dev` — Dev server
- `npm run build` — Build producción
- `npx vercel --prod --yes` — Deploy a producción
- `node scripts/set-plan.mjs <email> <plan>` — Asignar plan (rookie/supernova/yonko/free)
- `node scripts/generate-demo-dropi.mjs` — Generar reporte demo Dropi

## Arquitectura

```
app/
  page.tsx              — Landing page (tema oscuro fijo #0A0A0F)
  login/page.tsx        — Login/Registro (auto-signout al visitar)
  dashboard/page.tsx    — WHEEL: KPIs, charts, tabla países
  import/page.tsx       — Import Dropi CSV/XLSX, mapeo campañas
  berry/page.tsx        — BERRY: P&L, gastos, donut chart
  publicidad/page.tsx   — Ads analytics (Facebook + TikTok)
  log-pose/page.tsx     — Simulador proyecciones, calculadora
  sunny/page.tsx        — Lanzador de campañas Facebook
  vega-ai/page.tsx      — Config IA: alertas, reportes, umbrales
  settings/page.tsx     — API keys, ad accounts (admin only)
  usuarios/page.tsx     — CRUD equipo (admin only)
  diagnostico/page.tsx  — Wizard 5 pasos análisis gratis
  planes/page.tsx       — Pricing cards (Stripe checkout)
  api/stripe/           — checkout, webhook, verify-session
  api/admin/set-plan/   — Asignar plan manualmente (admin auth)
components/
  layout/AppProviders   — Providers raíz, sidebar condicional
  layout/ProtectedLayout — Auth guard, plan gate, verify-session polling
  layout/Sidebar        — Nav colapsable, países dinámicos, plan badge
  pricing/PricingCards   — 3 planes con Stripe integration
lib/
  context/AuthContext   — user, profile, effectiveUid, refreshProfile, hasFeature
  context/FilterContext — Filtros fecha/país globales
  hooks/usePlanAccess   — Permisos por plan (canAccess, accessibleModules)
  firebase/admin.ts     — Firebase Admin SDK (adminAuth, adminDb)
  firebase/firestore.ts — getUserProfile, Firestore client helpers
  api/auth.ts           — verifyAuth (token → uid, email, teamId)
  api/client.ts         — authFetch (Firebase token en headers)
```

## Diseño

- **Accent:** `#d75c33` (naranja/coral) — botones, links, gradientes
- **Módulos:** WHEEL (azul), BERRY (púrpura), SHIP (verde), VEGA (índigo), SUNNY (amarillo)
- **Temas:** Light (`#f8f9fa`) / Dark (`#0a0a0a`) via CSS variables
- **Patrones:** Glassmorphism, gradient glows, rounded-xl/2xl, uppercase tracking-widest labels

## Planes y Permisos

| Plan | Precio | Módulos |
|------|--------|---------|
| Rookie ($27) | 7 días free trial sin tarjeta | dashboard, import, publicidad, log-pose |
| Supernova ($49) | Más Popular | + berry, vega-ai, sunny |
| Yonko ($97) | Próximamente | = supernova (por ahora) |

## Dominios

- **Landing:** `grandline.com.co` — Solo `/` y `/diagnostico`
- **App:** `app.grandline.com.co` — Todo lo demás
- ProtectedLayout redirige entre dominios preservando query params

## Flujo post-registro

Registro → Redirect a WhatsApp (573153920396) para activación manual del plan.
Asignar plan: `node scripts/set-plan.mjs correo@email.com supernova`

## Reglas de desarrollo

- Siempre usar TypeScript estricto
- No agregar features/refactors no solicitados
- No crear archivos .md a menos que se pida explícitamente
- Preferir editar archivos existentes sobre crear nuevos
- Para deploy: `npx vercel --prod --yes` (NO usar npm global)
- Status de suscripción `trialing` cuenta como activo (igual que `active`)
- Webhook fix: `customer.subscription.updated` trata `trialing` como activo
- Variables de entorno sensibles en `.env.local` — NUNCA commitear
- Firebase Admin: project `grand-line-v8`, service account en env vars
