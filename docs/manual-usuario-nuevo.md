# GRAND LINE — Manual de Configuración para Usuarios Nuevos

> Guía paso a paso para configurar tu cuenta y empezar a usar Grand Line como Command Center de tu operación COD.

---

## Índice

1. [Crear tu cuenta](#1-crear-tu-cuenta)
2. [Elegir tu plan](#2-elegir-tu-plan)
3. [Configurar Meta (Facebook) Ads](#3-configurar-meta-facebook-ads)
4. [Importar tus órdenes de Dropi](#4-importar-tus-órdenes-de-dropi)
5. [Vincular campañas a productos](#5-vincular-campañas-a-productos)
6. [Tu primer Dashboard](#6-tu-primer-dashboard)
7. [Configurar proyecciones](#7-configurar-proyecciones)
8. [Módulos adicionales](#8-módulos-adicionales)
9. [Preguntas frecuentes](#9-preguntas-frecuentes)

---

## 1. Crear tu cuenta

### Paso 1: Ir a la página de login

Ingresa a **grandline.com.co** y serás redirigido a la pantalla de acceso.

[SCREENSHOT: Pantalla de login con el logo ⚓ Grand Line, campos de email/password y botón de Google]

### Paso 2: Registrarte

Tienes dos opciones:

- **Con Google** (recomendado): Haz clic en "Iniciar sesión con Google" y selecciona tu cuenta Gmail.
- **Con email y contraseña**: Ingresa tu email y una contraseña segura.

> 💡 **Tip**: Usar Google es más rápido y no necesitas recordar otra contraseña.

### Paso 3: Acceso al Dashboard

Después de registrarte, serás redirigido automáticamente al **Dashboard**. La primera vez estará vacío — es normal, necesitas importar datos primero.

---

## 2. Elegir tu plan

### Paso 1: Ir a Planes

En el menú lateral, haz clic en **Planes** o ve directamente a **grandline.com.co/planes**.

[SCREENSHOT: Página de planes mostrando las 3 tarjetas — Rookie, Supernova, Yonko]

### Planes disponibles

| Plan | Precio | Ideal para |
|------|--------|------------|
| **Rookie** | $27/mes | Empezar a controlar tu operación. 1 país, 3 cuentas publicitarias. Incluye 7 días gratis. |
| **Supernova** | $49/mes | Escalar sin límites. Hasta 3 países, cuentas ilimitadas, Vega IA, Berry P&L, multi-usuarios. |
| **Yonko** | $97/mes | Imperios multi-país. Todo en Supernova + Sunny (lanzador de anuncios), Vega IA avanzado, alertas automáticas, soporte VIP. |

### Paso 2: Seleccionar y pagar

1. Haz clic en **"Empezar"** en el plan que prefieras.
2. Serás redirigido a Stripe (pasarela de pago segura).
3. Ingresa tu tarjeta de crédito/débito.
4. Confirma el pago.
5. Serás redirigido de vuelta al Dashboard con tu plan activo.

> 💡 **Tip**: El plan Rookie incluye **7 días de prueba gratis**. No se cobra hasta que pasen los 7 días.

---

## 3. Configurar Meta (Facebook) Ads

Para que Grand Line pueda importar tus datos de publicidad automáticamente, necesitas conectar tu cuenta de Meta Ads.

### Paso 1: Generar tu Token de Meta

1. Ve a **[developers.facebook.com/tools/explorer](https://developers.facebook.com/tools/explorer/)**
2. En la parte superior, selecciona tu **App** (o crea una nueva si no tienes).
3. En "User or Page", selecciona **"User Token"**.
4. En "Permissions", agrega estos permisos:
   - `ads_read`
   - `ads_management`
   - `business_management`
5. Haz clic en **"Generate Access Token"**.
6. Copia el token generado (empieza con `EAAB...`).

[SCREENSHOT: Facebook Graph API Explorer con el token generado y los permisos seleccionados]

> ⚠️ **Importante**: Este token temporal expira en ~1 hora. Para un token de larga duración, ve a la sección de [Preguntas frecuentes](#cómo-genero-un-token-de-larga-duración).

### Paso 2: Pegar el token en Grand Line

1. En el menú lateral, haz clic en **Configuración** (ícono de engranaje).
2. En la sección **"Meta (Facebook) Token"**, pega tu token.
3. Selecciona la **moneda** de tu cuenta publicitaria (COP, USD, etc.).

[SCREENSHOT: Página de Settings mostrando el campo de Meta Token con placeholder "EAAB..."]

### Paso 3: Cargar tus cuentas publicitarias

1. Haz clic en el botón **"Cargar Cuentas"** junto al campo del token.
2. Aparecerán todas las cuentas publicitarias asociadas a tu token.
3. **Selecciona** las cuentas que quieres monitorear (marca las casillas).

[SCREENSHOT: Lista de cuentas publicitarias con checkboxes, algunas seleccionadas con borde naranja]

### Paso 4: Guardar

Haz clic en **"Guardar Configuración"** en la parte inferior de la página.

> ✅ ¡Listo! Grand Line ahora puede leer tus datos de Meta Ads.

---

## 4. Importar tus órdenes de Dropi

Las órdenes de Dropi son la base de todo tu dashboard: ventas, logística, entregas, cancelaciones.

### Paso 1: Descargar el reporte de Dropi

1. Inicia sesión en **Dropi** (panel de vendedor).
2. Ve a **Reportes** → **Reportes de órdenes**.
3. Selecciona el rango de fechas que quieres analizar.
4. Descarga el archivo **Excel (.xlsx)**.

[SCREENSHOT: Panel de Dropi mostrando la sección de reportes con el botón de descarga]

### Paso 2: Importar en Grand Line

1. En el menú lateral, haz clic en **Importar** (ícono de subida).
2. Arrastra tu archivo de Dropi al área de importación, o haz clic para seleccionarlo.
3. Grand Line detectará automáticamente el formato y procesará las órdenes.

[SCREENSHOT: Página de importación con el área de drag & drop y un archivo siendo procesado]

### Paso 3: Verificar la importación

Después de importar verás:
- ✅ Número de órdenes procesadas
- ✅ Países detectados
- ✅ Rango de fechas del archivo
- ⚠️ Advertencias si hay datos duplicados o incompletos

[SCREENSHOT: Resumen post-importación mostrando "450 órdenes importadas" con desglose por país]

> 💡 **Tip**: Puedes importar múltiples archivos. Grand Line detecta y previene duplicados automáticamente.

---

## 5. Vincular campañas a productos

Para que Grand Line sepa qué campaña de Facebook corresponde a qué producto, necesitas vincularlas.

### Paso 1: Ir a Publicidad

En el menú lateral, haz clic en **Publicidad**.

### Paso 2: Pestaña "Mapeo"

1. Haz clic en la pestaña **"Mapeo"** en la parte superior.
2. Verás una lista de tus campañas de Meta Ads.
3. Para cada campaña, selecciona el **producto** al que corresponde del dropdown.

[SCREENSHOT: Pestaña de mapeo mostrando campañas con dropdown de productos para vincular]

### Paso 3: Guardar vinculaciones

Cada vez que vinculas una campaña, se guarda automáticamente.

> 💡 **Tip**: Si tienes **Vega IA** (plan Supernova o superior), puedes activar el **auto-mapeo** en Configuración. La IA sugerirá vinculaciones automáticamente basándose en los nombres de tus campañas.

---

## 6. Tu primer Dashboard

Con órdenes importadas y publicidad conectada, tu Dashboard ya estará funcionando.

### Qué verás en el Dashboard (WHEEL)

[SCREENSHOT: Dashboard completo mostrando KPIs, gráficos y tabla de países]

- **KPIs principales**: Ingreso real, gasto en ads, CPA, tasa de entrega, utilidad proyectada.
- **Salud operativa**: Indicadores visuales (verde/amarillo/rojo) de tus métricas clave.
- **Desglose por plataforma**: Cuánto gastas en Meta vs otras fuentes.
- **Operación Global (tabla de países)**: Métricas detalladas por país con logística y finanzas.
- **Gráfico de tendencia**: Evolución de tus ventas y gasto en el tiempo.

### Filtros

En la parte superior verás la **barra de filtros**:

- **Rango de fechas**: Filtra por período (hoy, 7 días, 30 días, personalizado).
- **País**: Filtra por país específico.
- **Producto**: Filtra por producto específico.

[SCREENSHOT: Barra de filtros con selectores de fecha, país y producto]

---

## 7. Configurar proyecciones

La tabla "Operación Global" tiene una columna especial: **Proj %** (porcentaje de entrega proyectado).

### Qué es el Proj %

Es tu estimación de qué porcentaje de órdenes despachadas serán entregadas exitosamente. Grand Line usa este número para calcular la **Utilidad Proyectada**.

### Cómo ajustarlo

1. En la tabla de Operación Global, busca la columna **Proj %**.
2. Haz clic en el número y cámbialo (ej: de 65 a 70).
3. Puedes ajustar por **país** o por **producto** individual (expande el país haciendo clic en la fila).
4. Haz clic en **"Guardar Brújula"** para guardar tus proyecciones.

[SCREENSHOT: Tabla de Operación Global con la columna Proj % resaltada y el botón "Guardar Brújula"]

> 💡 **Tip**: Si estás empezando, un Proj % de **60-65%** es un buen punto de partida para Colombia.

---

## 8. Módulos adicionales

Según tu plan, tendrás acceso a estos módulos:

### SHIP — Control Logístico *(Todos los planes)*
Vista detallada del estado de cada orden: despachadas, en tránsito, entregadas, canceladas, devoluciones. Accede desde el menú lateral → tu país → **Operación**.

### BERRY — Control Financiero *(Supernova+)*
Registra gastos operativos (envío, empaque, personal, etc.) y visualiza tu P&L real. Accede desde **Berry** en el menú lateral.

### VEGA IA — Inteligencia Operativa *(Supernova+)*
Tu asistente de IA que analiza tu operación, genera reportes y te alerta sobre problemas. Accede desde **Vega IA** en el menú lateral.

### LOG POSE — Importación Avanzada *(Supernova+)*
Simulador financiero y calculadora de rentabilidad. Accede desde **Log Pose** en el menú lateral.

### SUNNY — Lanzador de Anuncios *(Yonko)*
Crea y lanza campañas de Meta Ads directamente desde Grand Line. Accede desde **Sunny** en el menú lateral.

---

## 9. Preguntas frecuentes

### ¿Cómo genero un token de larga duración?

El token del Graph API Explorer expira en ~1 hora. Para uno de larga duración (~60 días):

1. Ve a **[developers.facebook.com/tools/debug/accesstoken](https://developers.facebook.com/tools/debug/accesstoken/)**
2. Pega tu token corto y haz clic en "Debug".
3. Haz clic en **"Extend Access Token"** en la parte inferior.
4. Copia el nuevo token extendido y pégalo en Grand Line.

### ¿Cada cuánto debo importar mis órdenes?

Lo ideal es importar **diariamente** o al menos **cada 2-3 días** para mantener tu dashboard actualizado. Mientras más frecuente, más precisa tu data.

### ¿Qué pasa si importo el mismo archivo dos veces?

Grand Line detecta duplicados automáticamente. Si importas un archivo con órdenes que ya existen, te mostrará una advertencia y no duplicará los datos.

### ¿Puedo tener varios usuarios en mi cuenta?

Sí, desde el plan **Supernova**. Ve a **Usuarios** en el menú lateral para invitar miembros de tu equipo. Los datos se comparten automáticamente dentro del equipo.

### ¿Cómo cambio mi plan?

Ve a **Planes** en el menú lateral y selecciona el nuevo plan. También puedes gestionar tu suscripción desde el portal de facturación de Stripe.

### ¿Mis datos de Meta se sincronizan automáticamente?

Los datos de publicidad se actualizan cada vez que abres la sección de **Publicidad**. No es una sincronización automática en background — se consultan en tiempo real cuando los necesitas.

### ¿Qué moneda usa Grand Line?

Grand Line muestra todo en **COP (pesos colombianos)** por defecto. Si tu cuenta de Meta está en USD u otra moneda, asegúrate de configurar la moneda correcta en **Configuración** para que la conversión sea precisa.

---

## Checklist rápido de configuración

- [ ] Crear cuenta (Google o email)
- [ ] Elegir plan (Rookie / Supernova / Yonko)
- [ ] Pegar token de Meta en Configuración
- [ ] Seleccionar cuentas publicitarias
- [ ] Guardar configuración
- [ ] Importar primer archivo de Dropi
- [ ] Vincular campañas a productos en Publicidad → Mapeo
- [ ] Ajustar Proj % en el Dashboard
- [ ] ¡Explorar tu operación! 🚀

---

*Grand Line — Command Center para E-commerce COD*
*¿Necesitas ayuda? Contacta a soporte.*
