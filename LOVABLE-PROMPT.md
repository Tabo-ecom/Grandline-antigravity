# Grand Line — Prompt Completo para Lovable

## Descripción General del Proyecto

Grand Line es una plataforma SaaS de analytics y gestión operativa para dropshippers en Latinoamérica que operan con Dropi. Es el "sistema operativo" de una operación de dropshipping. La temática visual está inspirada en One Piece (anime/manga) — los módulos tienen nombres náuticos como WHEEL, BERRY, SHIP, SUNNY, VEGA, LOG POSE.

**URL actual:** https://app.grandline.com.co
**Landing page:** https://grandline.com.co

---

## Stack Técnico

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS v4
- **Autenticación:** Firebase Auth (email/password + Google OAuth)
- **Base de datos:** Firestore
- **Pagos:** Stripe (suscripciones mensuales)
- **Charts:** Recharts
- **Iconos:** Lucide React
- **Fuente principal:** Space Grotesk
- **IA:** Google Gemini + OpenAI (para módulo VEGA)

---

## Identidad Visual y Design System

### Paleta de colores

**Color principal (accent):** `#d75c33` (naranja/coral) — se usa en botones, links activos, gradientes hero, badges
**Fondo oscuro:** `#0A0A0F` (landing page), `#0a0a0a` (app dark mode)
**Fondo claro:** `#f8f9fa` (app light mode)

#### Colores por módulo:
- **WHEEL (Dashboard):** azul `from-blue-500 to-cyan-400`
- **BERRY (Finanzas):** púrpura `from-purple-500 to-violet-400`
- **SHIP (Logística):** verde `from-emerald-500 to-green-400`
- **VEGA IA:** índigo `from-indigo-400 to-blue-500`
- **SUNNY (Ads):** amarillo/naranja `from-yellow-500 to-orange-400`

#### Variables CSS del tema:
```css
:root {
  --background: #f8f9fa;
  --foreground: #1a1a1a;
  --card-bg: #ffffff;
  --card-border: rgba(0, 0, 0, 0.08);
  --sidebar-bg: #ffffff;
  --accent: #d75c33;
  --muted: #6c757d;
}

.dark {
  --background: #0a0a0a;
  --foreground: #ededed;
  --card-bg: #0d0d0d;
  --card-border: rgba(255, 255, 255, 0.08);
  --sidebar-bg: #0c0c0c;
  --accent: #d75c33;
  --muted: #888;
}
```

### Patrones de diseño actuales:
- Glassmorphism: `backdrop-blur-xl`, fondos semi-transparentes
- Gradientes de glow: esferas difuminadas (`blur-[120px]`) de color naranja y azul en el fondo
- Bordes redondeados: `rounded-xl` y `rounded-2xl`
- Bordes sutiles: `border-white/10`, `border-card-border`
- Tipografía: uppercase con `tracking-widest` para labels, bold para headings
- Animación fadeInUp para transiciones de contenido
- Cards con hover suave: `hover:bg-white/[0.06]`

---

## Arquitectura de Páginas y Módulos

### 1. LANDING PAGE (`/`)
Página de marketing completa con tema oscuro fijo `#0A0A0F`.

**Secciones actuales (en orden):**
1. **Navbar fijo:** Logo + nombre "GRAND LINE", links (Módulos, Precios, FAQ), botones "Iniciar Sesión" y "Comenzar Gratis"
2. **Hero:** Badge "Plataforma #1 de Analytics para Dropshipping en LATAM", título grande con gradiente naranja, subtítulo, 2 CTAs, video YouTube embebido, trust badges (Toda Latinoamérica, Datos encriptados, KPIs en tiempo real, IA integrada)
3. **Social Proof:** Grid de 4 stats (LATAM, 8+ módulos, 100K+ órdenes, 24/7 Vega IA)
4. **Módulos principales:** Título "5 módulos. Control total.", grid de 3 cards arriba (WHEEL, BERRY, SHIP) + 2 cards abajo (VEGA IA con badge "IA Integrada", SUNNY), + 3 módulos secundarios más pequeños (Publicidad, Proyección, Log Pose)
5. **Cómo funciona:** 3 pasos (Exporta de Dropi → Sube a Grand Line → Analiza y Escala)
6. **Países:** Grid de 11 banderas LATAM con moneda
7. **VEGA IA highlight:** Sección dedicada con fondo índigo/glow, 4 features (Chat, Alertas, Reportes, Análisis Predictivo)
8. **Pricing:** 3 planes en cards (Rookie $27, Supernova $49 "Más Popular", Yonko $97 "Próximamente")
9. **FAQ:** Accordion con 6 preguntas frecuentes
10. **CTA Final:** Card con "Cada día sin datos es dinero que pierdes" + botón "Crear Cuenta Gratis"
11. **Footer:** Logo, links, "Built with Antigravity AI"

**Isotipos:** Cada módulo tiene un isotipo PNG personalizado: `/logos/wheel-isotipo.png`, `/logos/berry-isotipo.png`, `/logos/ship-isotipo.png`, `/logos/vega-isotipo.png`, `/logos/sunny-isotipo.png`, `/logos/grandline-isotipo.png`

---

### 2. LOGIN / REGISTRO (`/login`)
Pantalla centrada con fondo oscuro, logo animado (bounce), card con glassmorphism.

**Funcionalidad:**
- Toggle entre "Iniciar Sesión" y "Crear Cuenta" (tabs naranja)
- Campos: email, contraseña, confirmar contraseña (solo registro)
- Botón Google OAuth
- Link "¿Olvidaste tu clave?"
- Post-registro redirige a WhatsApp para activación manual del plan
- Al visitar /login estando logueado, se cierra la sesión automáticamente

---

### 3. SIDEBAR (navegación principal de la app)
Barra lateral colapsable (64px colapsada / 256px expandida), persiste estado en localStorage.

**Contenido:**
- Logo Grand Line con isotipo
- **Sección "Main Fleet":** 6 módulos con iconos (Wheel, Log Pose, Publicidad, Sunny, Berry, Vega AI) — los que requieren plan superior muestran un candado
- **Sección "Ships":** Lista dinámica de países activos con banderas emoji (se detectan de los datos importados)
- **Bottom:** Toggle dark/light mode (Sol/Luna), avatar del usuario con email y badge del plan actual, botón cerrar sesión
- **Import:** Botón separado con icono Upload

---

### 4. DASHBOARD — Módulo WHEEL (`/dashboard`)
Centro de mando con KPIs en tiempo real. ~1145 líneas.

**Layout:**
- **Barra superior:** Toggle "Unificado/Desglose por país", selector de país, date range picker (con drag-to-select en charts)
- **4 KPI cards grandes:** Ventas, Órdenes, CPA, Utilidad Proyectada — cada uno con valor, variación %, mini spark indicator
- **Barra de gasto publicitario:** Facebook vs TikTok con colores de plataforma
- **Tabla de países:** Filas expandibles mostrando rendimiento por país con indicadores de salud (verde/amarillo/rojo)
- **Rankings de productos:** Grid de 2 columnas (por volumen y por rentabilidad)
- **4 trend charts:** Gráficos de área (Recharts) para ventas, órdenes, CPA, utilidad a lo largo del tiempo
- **Drawer de proyecciones:** Panel lateral derecho para configurar parámetros de proyección
- **Integración VEGA:** Botón "Analizar con Vega" al seleccionar rango en charts

**Colores:** Verde para métricas positivas, rojo para negativas, badges de salud con 3 niveles

---

### 5. IMPORT (`/import`)
Hub de importación de datos con 4 tabs.

**Tabs:**
1. **Import Orders:** Zona drag-drop para subir CSV/XLSX de Dropi, tabla preview, resolución de conflictos (modal), historial de imports con delete
2. **Price Corrections:** Editar precios de productos
3. **Campaign Mapping:** Vincular productos a campañas de ads con sugerencias IA
4. **Product Groups:** Organizar productos en categorías custom

---

### 6. BERRY (`/berry`) — Control Financiero
Módulo de P&L y gastos. ~1065 líneas.

**Layout:**
- Toggle mes/año en la parte superior
- Card resumen de gasto total
- Accordion por categoría de gasto (expandir/colapsar)
- Donut chart (distribución por categoría)
- Area chart (tendencia mensual)
- Modal para agregar gastos con selector de categoría
- Import/export Excel
- Gastos recurrentes con templates

---

### 7. PUBLICIDAD (`/publicidad`) — Analytics de Ads
Dashboard de rendimiento publicitario. ~1000+ líneas.

**Layout:**
- Cards resumen globales arriba
- Tabla de análisis de campañas (gasto, ROAS, CPA)
- Desglose de gasto por producto
- Cards de análisis por país
- Charts de tendencia temporal
- Galería de creativos (thumbnails)
- Import CSV para TikTok, sync Meta API para Facebook
- Badges de plataforma: azul para Facebook, negro para TikTok

---

### 8. LOG POSE (`/log-pose`) — Simulador de Proyecciones
Calculadora y simulador what-if. ~800+ líneas.

**Dos modos:**
1. **Simulator:** Sliders para ajustar ventas, CPA, % entrega → waterfall chart mostrando breakdown de ingresos/costos → resultado de utilidad proyectada
2. **Calculator:** Inputs de costos (COGs, envío, FB/TT) + margen deseado → precio sugerido

**Elementos:** Sliders con cálculo en tiempo real, selector de templates de productos, guardar/cargar proyecciones, panel de recomendaciones basado en ROAS/márgenes

---

### 9. SUNNY (`/sunny`) — Lanzador de Ads
Interfaz para crear campañas de Facebook Ads. ~98 líneas (carga componentes lazy).

**Tabs:**
1. **El Lanzador:** Formulario de creación de campaña
2. **El Motor:** Configuración de conectividad con APIs y estado de plataformas

**Visual:** Verde esmeralda para branding de Sunny, indicadores de estado (check verde = conectado)

---

### 10. VEGA AI (`/vega-ai`) — Asistente IA
Hub de configuración del asistente de IA. ~137 líneas (componentes lazy).

**Tabs:**
1. **Monitoreo:** Reportes y alertas generados por IA
2. **Brújula:** Configurar umbrales de KPIs para alertas (ROAS, CPA, % entrega)
3. **Configuración:** Schedules de reportes, canales de notificación (Slack, email, WhatsApp)

**Visual:** Gradiente índigo/púrpura, panels colapsables, toggles, sliders de umbrales

**Chat Bubble:** Componente flotante `VegaChatBubble` que aparece en todas las páginas autenticadas — chat conversacional con la IA sobre los datos del usuario.

---

### 11. SETTINGS (`/settings`) — Configuración (solo admin)
Panel de configuración de la plataforma. ~504 líneas.

**Secciones accordion:**
- API keys: tokens de Facebook/Meta, TikTok
- Selección de cuentas publicitarias (multi-select con checkboxes)
- Configuración de moneda por plataforma (USD/COP radio buttons)
- Proveedor de IA (Gemini/OpenAI)
- Herramientas demo (seed data para testing)

---

### 12. USUARIOS (`/usuarios`) — Gestión de Equipo (solo admin)
CRUD de miembros del equipo. ~492 líneas.

**Layout:**
- Botón "Añadir Tripulante" arriba
- Cards de miembros con avatar generado, email, badge de rol
- Modal de edición con formulario
- Checkboxes de permisos por módulo para viewers
- Confirmación de delete

---

### 13. DIAGNOSTICO (`/diagnostico`) — Herramienta Gratuita
Wizard de 5 pasos para análisis de rentabilidad. ~1094 líneas.

**Pasos:**
1. Upload de archivo Dropi (drag-drop)
2. Selección de productos a analizar
3. Encuesta (gasto en ads, tamaño de equipo, países)
4. Info de contacto (email, WhatsApp)
5. Resultados con KPIs, gráficos de tendencia, recomendaciones IA

**Visual:** Stepper progress bar, cards animadas con fadeInUp, sistema de slots (5 diagnósticos gratis)

---

### 14. PRICING / PLANES (`/planes`)
Usa el componente `PricingCards` con 3 planes:

| | Rookie ($27) | Supernova ($49) | Yonko ($97) |
|---|---|---|---|
| Trial | 7 días gratis sin tarjeta | No | No |
| Países | 1 | Hasta 3 | Ilimitados |
| Ad accounts | 3 | Ilimitadas | Ilimitadas |
| Módulos | WHEEL, SHIP, LOG POSE | Todo + BERRY, SUNNY, VEGA | Todo + VEGA avanzado |
| Estado | Activo | Activo (Más Popular) | Próximamente |

El plan Supernova tiene borde gradiente naranja y badge "Más Popular". Features de VEGA tienen fondo índigo, features de SUNNY fondo esmeralda.

---

## Sistema de Permisos por Plan

```
PLAN_MODULES:
  free: [] (sin acceso)
  rookie: [dashboard, import, publicidad, log-pose]
  supernova: [dashboard, import, publicidad, log-pose, berry, vega-ai, sunny]
  yonko: (igual que supernova por ahora)
```

Cuando un usuario intenta acceder a un módulo bloqueado, ve una pantalla con: icono del módulo, nombre del plan requerido, lista de features que desbloquea, y un botón de WhatsApp para contactar y hacer upgrade.

---

## Flujo de Usuario

1. **Landing page** → Click "Comenzar Gratis" o "Probar Gratis"
2. **Login/Registro** → Crear cuenta con email o Google
3. **Post-registro** → Redirect a WhatsApp para activación manual del plan
4. **Dashboard** → Si tiene plan activo, accede a los módulos permitidos
5. **Módulo bloqueado** → Pantalla con botón WhatsApp para upgrade

---

## Providers/Context de la App

1. **AuthProvider:** Estado de autenticación, perfil del usuario, plan, signOut, refreshProfile
2. **FilterProvider:** Filtros globales de fecha y país
3. **SidebarProvider:** Estado colapsado/expandido
4. **SunnyProvider:** Estado del lanzador de campañas
5. **VegaProvider:** Estado del chat de IA

---

## Assets

- `/logos/grandline-isotipo.png` — Isotipo principal de Grand Line
- `/logos/wheel-isotipo.png` — Isotipo módulo WHEEL
- `/logos/berry-isotipo.png` — Isotipo módulo BERRY
- `/logos/ship-isotipo.png` — Isotipo módulo SHIP
- `/logos/vega-isotipo.png` — Isotipo módulo VEGA
- `/logos/sunny-isotipo.png` — Isotipo módulo SUNNY

---

## Lo Que Necesito de Lovable

### Objetivo
Rediseñar y optimizar el diseño gráfico de toda la plataforma Grand Line, manteniendo la identidad visual actual pero llevándola a un nivel premium y profesional. Quiero que el diseño se sienta como un SaaS de clase mundial — limpio, sofisticado, con micro-interacciones y jerarquía visual clara.

### Qué mejorar:

1. **Landing Page:**
   - Rediseñar el hero para que sea más impactante y tenga mejor jerarquía visual
   - Mejorar las cards de módulos — hacerlas más interactivas con hover effects, micro-animaciones
   - Optimizar la sección de pricing para que sea más clara y visualmente atractiva
   - Mejorar la sección de FAQ con un diseño más elegante
   - Añadir animaciones de scroll (intersection observer) para que las secciones aparezcan al hacer scroll
   - Optimizar la responsividad mobile
   - Mejorar la sección de "Cómo funciona" con un diseño más visual y menos texto
   - Mejorar la sección de países con un diseño más atractivo (quizás un mapa estilizado)

2. **Login/Registro:**
   - Mejorar la experiencia visual — más pulido, más profesional
   - Mejores estados de loading y feedback visual
   - Transiciones suaves entre login y registro

3. **Dashboard (WHEEL):**
   - Rediseñar los KPI cards para que sean más informativos y visualmente atractivos
   - Mejorar los charts — más pulidos, mejor uso de colores, tooltips más elegantes
   - Mejorar la tabla de países — mejor jerarquía visual, iconos más claros
   - Optimizar el layout general para que respire más

4. **Sidebar:**
   - Mejorar la transición entre colapsado y expandido — más fluida
   - Mejor tratamiento visual de los módulos bloqueados
   - Hover effects más sofisticados
   - Mejor indicador del módulo activo

5. **Todas las páginas de módulos:**
   - Consistencia visual entre todos los módulos
   - Mejor uso del espacio en blanco
   - Cards más pulidas con sombras y bordes más sofisticados
   - Mejorar la experiencia de tablas de datos — stripe rows, sort indicators, pagination
   - Modales más elegantes con overlay blur
   - Estados de loading con skeletons en vez de spinners
   - Empty states con ilustraciones o iconos descriptivos
   - Mejor feedback visual para acciones (toast notifications elegantes)

6. **PricingCards:**
   - Hacer que el plan popular (Supernova) se destaque más
   - Mejorar los badges de features (VEGA, SUNNY)
   - Animaciones hover en los cards
   - Mejor CTA visual

7. **Diseño responsive:**
   - Optimizar todo para móvil
   - Sidebar que se convierta en bottom navigation en mobile
   - Cards que se apilen correctamente
   - Charts que se adapten al viewport

8. **Micro-interacciones:**
   - Hover effects en botones con scale y shadow transitions
   - Loading skeletons donde corresponda
   - Transiciones suaves entre páginas/tabs
   - Feedback visual inmediato en acciones del usuario
   - Animaciones de entrada para contenido (stagger en listas)

### Restricciones:
- Mantener el color accent `#d75c33` como color principal
- Mantener la fuente Space Grotesk
- Mantener los colores por módulo (azul WHEEL, púrpura BERRY, verde SHIP, índigo VEGA, amarillo SUNNY)
- Mantener el soporte de tema claro/oscuro
- Mantener los isotipos de módulos
- Mantener Tailwind CSS como framework de estilos
- Mantener Recharts para gráficos
- Mantener Lucide React para iconos
- Mantener la temática náutica/One Piece en la nomenclatura

### Inspiración de diseño:
- Linear.app (limpieza, micro-interacciones, glassmorphism)
- Vercel Dashboard (minimalismo, jerarquía clara)
- Stripe Dashboard (tables, cards, data visualization)
- Framer (animaciones de scroll, landing page)
- Arc Browser (sidebar design, visual hierarchy)
