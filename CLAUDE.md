# Contexto del Proyecto: App de Servicio Técnico para Motos

## Descripción general
App móvil (Android/iOS) que conecta motociclistas con talleres mecánicos y tiendas de accesorios/repuestos. Funciona como marketplace + servicio de auxilio en carretera (lógica tipo Uber).

## Modelo de negocio
- **NO hay pasarela de pago entre cliente y negocio/taller.** El cliente paga el servicio/producto al negocio por fuera de la app (efectivo, transferencia directa, etc.)
- **SÍ hay pasarela de pago entre negocio/taller y la plataforma (app).** Se usa exclusivamente para que el negocio pague:
  1. **Suscripción** (planes de visibilidad, destacados, límites de catálogo)
  2. **Publicidad** de sus servicios/productos dentro de la app
- Esto significa que el flujo de pago con pasarela (ej. Payphone, Stripe, etc.) es **negocio → plataforma**, no cliente → negocio

## Tipos de usuario
1. **Cliente (motociclista)**
2. **Negocio (taller / tienda de accesorios)**
3. **Admin (dueño de la plataforma)** — gestiona vía panel web separado, ver sección "Panel de Administración"

## Funcionalidades por rol

### Cliente
- Registro/login, perfil
- Perfil de vehículo (marca, modelo, año, kilometraje)
- **Sugerencias de mantenimiento** basadas en kilometraje/tiempo (ej. cambio de aceite cada 3,000 km, revisión de frenos cada 6,000 km) — reglas genéricas por tipo/cilindraje de moto en el MVP; tablas específicas por marca/modelo en fase 2
  - Notificación push cuando se acerca el kilometraje sugerido
  - Botón directo "Buscar taller cercano" desde la sugerencia, con el servicio ya filtrado (ej. "cambio de aceite")
  - Oportunidad de publicidad dirigida (ej. marca de aceite anunciando junto a la sugerencia de cambio de aceite)
- Búsqueda de talleres: por ubicación (cercanía), nombre, dirección, ciudad
- Ver perfil de negocio: servicios ofrecidos (mantenimiento, cambio de aceite, lavado, etc.) y productos (partes, accesorios, herramientas)
- **Solicitud de auxilio en carretera** (lógica tipo Uber): el cliente pide ayuda, los talleres cercanos ven la solicitud y pueden contactarlo/aceptarla
- Botón SOS / compartir ubicación en tiempo real
- Historial de servicios recibidos
- Calificación y reseñas a talleres
- **Seguir talleres/negocios** (en lugar de favoritos): relación activa que genera notificaciones de promos/historias del negocio seguido, y feed "Siguiendo" en el home con sus actualizaciones
- Chat con el taller
- Notificaciones push (solicitud aceptada, mecánico en camino, promociones)
- Filtros de búsqueda: tipo de servicio, calificación, disponibilidad 24/7

### Negocio (taller/tienda)
- Registro/login, configuración de perfil de negocio (nombre, dirección, ciudad, ubicación geográfica, horario)
- Configuración de catálogo: servicios (con descripción y precio referencial) y productos (con stock)
- Recepción y gestión de solicitudes de auxilio (aceptar/rechazar, tiempo estimado de llegada)
- Radio de cobertura configurable para auxilio
- Gestión de empleados/mecánicos vinculados al negocio
- Agenda/citas para mantenimiento programado
- Dashboard con métricas básicas (servicios solicitados, productos más vistos)
- Gestión de suscripción (plan activo, beneficios, **pago de suscripción vía pasarela de pago**)
- Gestión de campañas de publicidad (**pago vía pasarela de pago** para destacar servicios/productos)
- Verificación básica (KYC) para generar confianza

## Funcionalidades transversales
- Mapa con geolocalización (Google Maps)
- Sistema de reseñas/calificaciones
- Notificaciones push
- Panel de anuncios publicitarios (gestionados por el admin de la plataforma)
- Soporte multi-ciudad (pensado para escalar en Ecuador)

## Stack técnico
- **Frontend:** React Native + Expo (permite build de iOS vía EAS sin necesidad de Mac, ya que el desarrollo es en Windows)
- **Backend:** Node.js/Express + Supabase (Auth, Postgres, Realtime, Storage)
- **Mapas/ubicación:** Google Maps API + Expo Location
- **Tiempo real (matching de auxilio):** Supabase Realtime
- **Notificaciones push:** Expo Notifications / Firebase Cloud Messaging
- **Chat:** Supabase Realtime o Socket.io

## Estructura de carpetas sugerida
```
moto-app/
├── app/                    # Pantallas (Expo Router)
│   ├── (auth)/             # Login, registro
│   ├── (client)/           # Flujo cliente
│   ├── (business)/         # Flujo negocio
│   └── (shared)/           # Pantallas compartidas (chat, perfil)
├── components/             # Componentes reutilizables UI
├── services/                # Llamadas a Supabase/API
├── hooks/                   # Custom hooks (useLocation, useAuth, etc.)
├── types/                   # Tipos TypeScript
├── constants/                # Colores, config
├── utils/                    # Funciones auxiliares
└── supabase/                  # Migraciones, esquema DB
```

## Notas sobre el desarrollador
- Desarrollador trabaja en **Windows** (no tiene Mac) → usar EAS Build para compilar iOS
- Ya tiene experiencia previa con Supabase, Next.js y arquitectura full-stack (proyecto previo: EcuaPred, una plataforma de mercados de predicción)
- Prioridad: definir y construir primero un MVP funcional antes de añadir todas las funcionalidades extra

## Sistema de calificaciones (bidireccional)

### 1. Cliente → Negocio/Taller (principal, visible públicamente)
- Después de cada servicio/producto o tras un auxilio en carretera
- Escala 1-5 estrellas + comentario opcional
- Visible para otros clientes al buscar talleres

### 2. Negocio → Cliente (interna, fase 2 — no MVP)
- Solo aplica al flujo de auxilio en carretera (no a compras en tienda)
- Detecta clientes que cancelan o no se presentan
- No es pública, solo se usa para el algoritmo de matching de auxilio

### Ventajas de calificación alta (Negocio/Taller)
- Mejor posición en resultados de búsqueda (junto al plan de suscripción, es factor de ranking)
- Prioridad en notificaciones de solicitudes de auxilio (recibe la alerta antes o aparece primero en la lista del cliente)
- Insignia de confianza ("Recomendado" si supera 4.5 estrellas), complementa el sello "verificado" de plan Pro
- Mayor conversión (más clics → más ventas/servicios)

### Consecuencias de calificación baja (Cliente, interna)
- Advertencia a talleres antes de aceptar su solicitud de auxilio
- En casos extremos, limitación temporal para pedir auxilio

**Prioridad de implementación:** MVP solo incluye calificación Cliente → Negocio. La calificación Negocio → Cliente se implementa en fase 2, una vez validado el flujo de auxilio en carretera.

## Planes de suscripción para negocios/talleres

La publicidad **siempre es un pago independiente**, sin importar el plan (Free, Estándar o Pro). El plan solo controla límites de catálogo y visibilidad.

| Característica | Free | Estándar | Pro |
|---|---|---|---|
| Productos en catálogo | Hasta 5 | Hasta 30 | Ilimitado |
| Servicios en catálogo | Hasta 3 | Hasta 15 | Ilimitado |
| Fotos por producto/servicio | 1 | 3 | 5 |
| Recepción de solicitudes de auxilio | Sí | Sí | Sí (prioridad en matching) |
| Posición en resultados de búsqueda | Normal | Normal | Destacado |
| Empleados/mecánicos vinculados | 1 | 3 | Ilimitado |
| Dashboard/estadísticas | Básico | Intermedio | Avanzado (clics, vistas, conversión) |
| Soporte | Estándar | Prioritario | Prioritario dedicado |
| Insignia "verificado" | No | Opcional | Incluido |

**Nota técnica importante:** la validación de límites de catálogo (productos/servicios) debe hacerse en el backend, no solo en el frontend — al intentar agregar un producto que excede el límite del plan, el sistema debe bloquear la acción y sugerir upgrade.

## Flujo de publicidad (pago independiente, aplica a negocios/talleres Y marcas anunciantes)
1. **Registro como anunciante:** negocio/taller existente compra espacio publicitario, o una marca (ej. marca de aceite) se registra como tipo "Negocio" con sub-tipo "Marca/Proveedor" (sin ubicación de auxilio ni catálogo de servicios)
2. **Selección de campaña:** tipo de anuncio (banner home, destacado en búsquedas, anuncio en perfiles de talleres), duración y alcance (ciudad o nacional)
3. **Carga de contenido:** imagen/banner, texto, link (sitio web, WhatsApp, o lista de talleres que venden su producto)
4. **Pago vía pasarela** (negocio/marca → plataforma), pago único por campaña o recurrente
5. **Revisión/aprobación por admin** antes de publicar (evita contenido inapropiado o competencia desleal)
6. **Visualización con métricas** (impresiones, clics) entregadas al anunciante como valor agregado

## Panel de Administración (Admin)

Panel separado para el dueño de la plataforma, pensado como **dashboard web** (no parte de la app móvil), ej. Next.js conectado a la misma base de datos Supabase — reutiliza experiencia previa del desarrollador (EcuaPred).

### Funciones principales

**1. Gestión de usuarios**
- Ver/buscar clientes y negocios registrados
- Suspender o eliminar cuentas (fraude, abuso, spam)
- Soporte: reseteo de contraseñas, asistencia a usuarios

**2. Verificación de negocios (KYC)**
- Revisar solicitudes de verificación (cédula/RUC, permisos, fotos del local)
- Aprobar/rechazar y otorgar insignia de "verificado"

**3. Gestión de publicidad**
- Cola de anuncios pendientes de aprobación (negocios y marcas anunciantes)
- Aprobar/rechazar contenido antes de publicar
- Ver/pausar campañas activas (ej. por queja o contenido inapropiado)
- Dashboard de ingresos por publicidad

**4. Gestión de suscripciones**
- Ver negocios por plan (Free/Estándar/Pro)
- Historial de pagos, renovaciones, cancelaciones
- Resolución de disputas de pago (ej. cobro fallido)
- Dashboard de ingresos por suscripciones

**5. Moderación de contenido**
- Reportes de reseñas falsas/inapropiadas
- Reportes de negocios con mal comportamiento
- Revisión de productos/servicios que violen políticas

**6. Moderación del auxilio en carretera**
- Historial de solicitudes para resolver disputas (taller no llegó, cliente canceló sin razón)
- Estadísticas: tiempo promedio de respuesta, tasa de aceptación por zona

**7. Métricas generales de la plataforma**
- Usuarios y negocios activos, solicitudes de auxilio por día/ciudad
- Ingresos totales (suscripciones + publicidad)
- Mapa de calor de demanda vs. cobertura de talleres (para reclutamiento de negocios)

**8. Configuración de reglas del sistema**
- Precios de planes (Free/Estándar/Pro) y de publicidad
- Reglas genéricas de sugerencias de mantenimiento (por kilometraje)
- Radio de búsqueda por defecto del auxilio en carretera

## Recomendaciones internas de la plataforma (upselling)

Distinto a la publicidad pagada: son mensajes automáticos generados por la plataforma para que el propio negocio entienda el valor de subir de plan o anunciarse. Se alimentan de la misma data del dashboard (visitas, clics, conversión, solicitudes de auxilio).

### 1. Triggers automáticos (basados en uso)

**Sugerencia de cambio de plan:**
- Negocio en Free llega al límite (ej. intenta agregar producto #6) → mensaje de upgrade a Estándar + botón directo a cambio de plan
- Negocio en Estándar cerca del límite (ej. 25/30 productos) → notificación preventiva
- Negocio pierde solicitudes de auxilio por no tener prioridad de matching → sugerencia de upgrade a Pro

**Sugerencia de publicidad:**
- Negocio con pocas visitas/clics en su perfil (dato del dashboard) → sugerencia de campaña para aumentar visibilidad
- Negocio nuevo sin historial → oferta de descuento en publicidad los primeros días
- Negocio en temporada baja de servicios → sugerencia de campaña dirigida

### 2. Dónde aparecen (dentro de la app del negocio)
- Banner/tarjeta en el dashboard del negocio (no intrusivo)
- Notificación push puntual (máximo 1-2 por semana, evitar saturar)
- Pantalla dedicada "Crece tu negocio" con métricas + sugerencias personalizadas

### 3. Lógica de priorización
- Negocio Pro con publicidad activa → no mostrar estas sugerencias (evitar ruido)
- Negocio Free con poco uso → priorizar mensaje de upgrade de plan antes que publicidad
- Personalizar mensaje según data real del negocio (vistas, clics, solicitudes perdidas), no genérico

### 4. Objetivo de negocio
Marketing automatizado interno que aumenta conversión a planes pagos y campañas de publicidad sin venta manual directa.

## Sugerencias a futuro (no MVP, no fase 2 inmediata)

### Historias tipo Instagram/TikTok (negocio/taller)
Negocios/talleres pueden subir contenido (foto/video) visible 24h, similar a historias de Instagram/TikTok. Da contenido fresco recurrente y motiva apertura frecuente de la app por parte del cliente.

**Funcionamiento:**
- Foto o video corto (15-30 seg)
- Plantillas predefinidas: "Promo del día", "Antes/Después", "Nuevo producto", "Cupo disponible hoy"
- Botón de acción en la historia ("Ver servicio", "Ver producto", "Contactar") que lleva directo al catálogo/servicio mencionado

**Descubrimiento:**
- Sección "Historias cerca de ti" en el home del cliente, ordenadas por cercanía
- Indicador visual (anillo de color) en el perfil del taller cuando tiene historia activa

**Segmentación por plan (oportunidad de monetización adicional):**
- Free: sin historias o solo 1 activa
- Estándar: hasta 3 historias simultáneas
- Pro: historias ilimitadas + opción de "fijar" una historia como destacado permanente (como Destacados de Instagram)

**Métricas:** vistas y clics al botón de acción, alimentan el dashboard del negocio y las recomendaciones de upselling.

**Moderación:** admin puede reportar/eliminar historias inapropiadas (no requiere aprobación previa, a diferencia de publicidad pagada, por ser contenido orgánico de 24h).

**Nota técnica:** para una futura implementación, empezar solo con **fotos** (no video) para reducir complejidad de almacenamiento/procesamiento; video requeriría servicio especializado (ej. Mux, Cloudinary) ya que Supabase Storage tiene limitaciones para este caso de uso.

## Sistema "Seguir" (reemplaza el concepto de favoritos)

"Seguir" crea una relación activa cliente → negocio, en lugar de un simple guardado pasivo. Se conecta con las historias (funcionalidad futura) y el feed de novedades.

### Funcionamiento
- Botón "Seguir" en el perfil del negocio (en lugar de "Favorito")
- Notificaciones al cliente cuando el negocio seguido publica una promo o historia
- Sección "Siguiendo" en el home del cliente: feed con actualizaciones de los negocios seguidos
- Contador de seguidores visible en el perfil del negocio (señal social de confianza)

### Impacto en ranking y visibilidad
- El número de seguidores puede ser **un factor adicional de ranking** en búsquedas, junto a calificación y plan de suscripción
- Alimenta el dashboard de upselling del negocio (ej. "Tienes pocos seguidores, anúnciate para crecer")

### Mitigación del riesgo de descubrimiento (talleres nuevos quedan invisibles)
1. **Separar ranking de búsqueda del feed de seguidos:** la búsqueda por cercanía/nombre/ciudad es neutral, no afectada por seguidores — un taller nuevo cercano siempre aparece igual. El feed "Siguiendo" es aparte y solo afecta a quien ya sigue a alguien
2. **Sección "Descubre" / "Nuevos en tu zona":** espacio dedicado en el home para negocios recién registrados o con pocos seguidores, ordenados por cercanía
3. **Boost temporal para negocios nuevos:** impulso en el ranking durante los primeros 15-30 días tras el registro
4. **Plan Pro y publicidad como compensación:** un negocio nuevo sin seguidores puede ganar visibilidad pagando plan Pro (destacado) o publicidad — coherente con el modelo de monetización
5. **El auxilio en carretera NO se ve afectado por seguidores:** en emergencias solo importa cercanía, calificación y plan, nunca relación social

## Estructura de navegación

### Menú inferior (Bottom Tab Navigation) — Cliente
1. 🏠 Inicio — feed "Siguiendo" + sección "Descubre" (talleres nuevos cerca), con barra de **historias** arriba del feed (scroll horizontal, igual que Instagram)
2. 🔍 Buscar — búsqueda de talleres por ubicación/nombre/ciudad con filtros
3. 🆘 Auxilio — botón central destacado para pedir ayuda en carretera
4. 💬 Mensajes — chats con talleres
5. 👤 Perfil — vehículos, historial, y entrada a **Configuración** (ver abajo)

### Menú inferior (Bottom Tab Navigation) — Negocio
1. 🏠 Inicio — dashboard resumen (solicitudes nuevas, métricas rápidas)
2. 📦 Catálogo — gestión de productos/servicios
3. 🆘 Solicitudes — auxilios pendientes/activos (con badge de notificación)
4. 💬 Mensajes
5. 👤 Perfil/Negocio — plan, suscripción, publicidad, historias, y entrada a **Configuración** (ver abajo)

### Historias (barra superior)
- Solo visible en la pantalla de Inicio del Cliente (los negocios las suben desde su propio panel, no las consumen ahí)
- Orden: primero negocios que el cliente sigue, luego sección "Descubre" (talleres nuevos/cercanos con historia activa)
- Anillo de color en el avatar del negocio para indicar historia activa sin ver

### Nota técnica de navegación (React Native)
- Bottom tabs: React Navigation (Bottom Tab Navigator), estándar en Expo
- Botón de Auxilio central con estilo visual destacado (más grande, color distinto) por ser la acción más crítica
- Historias: componente horizontal (`FlatList horizontal` o `ScrollView`), separado del feed principal

## Configuración (dentro de Perfil, no es pestaña propia del menú inferior)

Se accede desde un ícono/botón (⚙️) dentro de la pantalla de Perfil de cada rol.

### Configuración — Cliente
- **Cuenta:** editar datos personales, foto, teléfono, email, contraseña, WhatsApp
- **Vehículos:** agregar/editar/eliminar motos, actualizar kilometraje, ajustar sugerencias de mantenimiento
- **Privacidad y ubicación:** permisos de ubicación, visibilidad de perfil (ej. si se muestra a quién sigue)
- **Notificaciones:** por tipo (auxilio, promos de seguidos, mantenimiento, mensajes)
- **General:** ciudad por defecto, idioma (si aplica a futuro), cerrar sesión, eliminar cuenta

### Configuración — Negocio
- **Cuenta y negocio:** datos del negocio, logo, descripción, dirección, ubicación en mapa, horario, contacto
- **Suscripción y facturación:** plan actual, upgrade/downgrade, historial de pagos/facturas, método de pago
- **Publicidad:** campañas activas/pasadas, crear campaña, métricas (impresiones, clics)
- **Auxilio en carretera:** radio de cobertura, disponibilidad on/off, tiempo de respuesta esperado
- **Empleados:** agregar/eliminar mecánicos, permisos (quién acepta solicitudes de auxilio)
- **Notificaciones:** solicitudes de auxilio, mensajes, recordatorios de pago, recomendaciones de upselling
- **Verificación:** estado de KYC, subir/actualizar documentos
- **General:** cerrar sesión, desactivar negocio temporalmente, eliminar cuenta

## Esquema de base de datos (Postgres / Supabase)

### users (extiende auth.users de Supabase)
```sql
- id (uuid, PK, refs auth.users)
- email
- phone
- full_name
- role (enum: 'client', 'business', 'admin')
- avatar_url
- created_at
```

### vehicles (perfil de moto del cliente)
```sql
- id (uuid, PK)
- user_id (FK -> users)
- brand, model, year
- current_mileage
- last_mileage_update
- created_at
```

### businesses
```sql
- id (uuid, PK)
- owner_id (FK -> users)
- business_type (enum: 'workshop', 'store', 'brand_advertiser')
- name, description, logo_url
- address, city, latitude, longitude
- phone, whatsapp
- schedule (jsonb)
- is_verified (bool)
- rating_avg (decimal)
- followers_count (int)
- plan_id (FK -> subscription_plans)
- aid_radius_km (int, nullable — solo workshops)
- created_at
```

### business_employees
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- user_id (FK -> users)
- role (enum: 'owner', 'mechanic')
- can_accept_aid_requests (bool)
- created_at
```

### subscription_plans
```sql
- id (uuid, PK)
- name (enum: 'free', 'standard', 'pro')
- max_products, max_services, max_photos_per_item
- max_employees
- has_priority_matching (bool)
- has_featured_listing (bool)
- has_stories (bool) -- futuro
- price_monthly
```

### business_subscriptions (historial de pagos de plan)
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- plan_id (FK -> subscription_plans)
- status (enum: 'active', 'expired', 'cancelled')
- started_at, expires_at
- payment_id (FK -> payments)
```

### services (catálogo del negocio)
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- name, description
- reference_price
- photos (text[])
- is_active (bool)
- created_at
```

### products (catálogo del negocio)
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- name, description, category
- reference_price
- stock
- photos (text[])
- is_active (bool)
- created_at
```

### help_requests (auxilio en carretera)
```sql
- id (uuid, PK)
- client_id (FK -> users)
- vehicle_id (FK -> vehicles)
- latitude, longitude
- description
- status (enum: 'pending', 'accepted', 'in_progress', 'completed', 'cancelled')
- accepted_business_id (FK -> businesses, nullable)
- estimated_arrival_minutes
- created_at, accepted_at, completed_at
```

### help_request_notifications (qué talleres vieron/recibieron la solicitud)
```sql
- id (uuid, PK)
- help_request_id (FK -> help_requests)
- business_id (FK -> businesses)
- notified_at
- responded (bool)
```

### reviews
```sql
- id (uuid, PK)
- reviewer_id (FK -> users)
- reviewed_business_id (FK -> businesses, nullable)
- reviewed_client_id (FK -> users, nullable) -- fase 2, calificación interna
- help_request_id (FK, nullable)
- rating (int, 1-5)
- comment
- is_public (bool) -- false para reviews internas de cliente sobre negocio
- created_at
```

### ads (publicidad pagada)
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- type (enum: 'home_banner', 'search_featured', 'profile_ad')
- title, image_url, link_url
- target_city (nullable, null = nacional)
- status (enum: 'pending_review', 'approved', 'rejected', 'active', 'expired')
- starts_at, ends_at
- payment_id (FK -> payments)
- impressions, clicks
- created_at
```

### payments (negocio → plataforma)
```sql
- id (uuid, PK)
- business_id (FK -> businesses)
- amount, currency
- type (enum: 'subscription', 'advertising')
- gateway (ej. 'payphone')
- gateway_transaction_id
- status (enum: 'pending', 'completed', 'failed', 'refunded')
- created_at
```

### maintenance_rules (sugerencias de mantenimiento — genéricas en MVP)
```sql
- id (uuid, PK)
- moto_type (enum: 'scooter', 'street', 'naked', 'enduro', etc.)
- service_name (ej. 'Cambio de aceite')
- interval_km
- interval_months (alternativa por tiempo)
```

### maintenance_suggestions (instancia generada por vehículo)
```sql
- id (uuid, PK)
- vehicle_id (FK -> vehicles)
- rule_id (FK -> maintenance_rules)
- due_at_km
- status (enum: 'pending', 'notified', 'dismissed', 'completed')
- created_at
```

### follows (reemplaza a "favorites")
```sql
- id (uuid, PK)
- client_id (FK -> users)
- business_id (FK -> businesses)
- created_at
```

## Estado actual del proyecto

Ya inicializado: Expo + TypeScript + Expo Router, estructura de carpetas (`app/(auth)`, `app/(client)`, `app/(business)`, `app/(shared)`, `components/`, `services/`, `hooks/`, `types/`, `constants/`, `utils/`, `supabase/migrations/`), cliente de Supabase (`services/supabase.ts`), tipos generados a mano del esquema (`types/database.ts`, `types/supabase.ts`), migraciones SQL iniciales con RLS (`supabase/migrations/0001_initial_schema.sql`, `0002_rls_policies.sql`), y flujo de auth básico (login/registro con selección de rol cliente/negocio) + tabs por rol con pantallas placeholder. Verificado que compila (`tsc --noEmit`) y que el bundle de Metro exporta sin errores.

Nota técnica: el proyecto usa `.npmrc` con `legacy-peer-deps=true` porque `expo-router@56` trae dependencias web (`@radix-ui/*`, `vaul`) con conflictos de peer deps con React 19 que de otra forma rompen `npm install`.

## Próximo paso
1. Crear el proyecto real en Supabase, correr las migraciones de `supabase/migrations/`, y poner las credenciales reales en `.env` (ver `.env.example`).
2. Implementar las pantallas reales de catálogo (productos/servicios) con validación de límites de plan en backend.
3. Implementar búsqueda de talleres por ubicación/nombre/ciudad y el flujo de auxilio en carretera con Supabase Realtime.
