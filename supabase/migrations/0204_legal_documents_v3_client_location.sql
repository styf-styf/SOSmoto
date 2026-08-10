-- Versión 3 de Privacidad -- declara la nueva última ubicación conocida del
-- cliente (país/región/ciudad, migración 0203). Terms no cambia de
-- contenido en esta versión, pero se sube su version también para que
-- ambos documentos queden sincronizados en el mismo número (mismo criterio
-- que ya se usó en 0202: se publican juntos desde la misma sección del
-- admin, y legal_ack_at es un solo timestamp para los dos).
insert into legal_documents (type, version, content, published_at) values
(
  'terms',
  3,
  (select content from legal_documents where type = 'terms' and version = 2),
  now()
),
(
  'privacy',
  3,
  '<h2>1. Responsable del tratamiento</h2>
<p>3Dimensions (RUC 1751489426001) ("SOSmoto"). Contacto para temas de privacidad: <a href="mailto:soporte@sosmoto.net">soporte@sosmoto.net</a>.</p>

<h2>2. Qué datos recolectamos</h2>
<table>
<tr><th>Dato</th><th>Para qué se usa</th></tr>
<tr><td>Correo, teléfono, nombre, foto de perfil</td><td>Crear y mostrar tu cuenta</td></tr>
<tr><td>Rol (cliente/negocio) y datos del negocio (nombre, dirección, país, horario, documento de identidad/tributario para KYC)</td><td>Operar el perfil de negocio y verificarlo</td></tr>
<tr><td>Vehículos (marca, modelo, año, kilometraje)</td><td>Sugerencias de mantenimiento</td></tr>
<tr><td>Ubicación</td><td>Buscar talleres cercanos, y compartirla en tiempo real solo mientras dura una solicitud de auxilio activa</td></tr>
<tr><td>País/región/ciudad aproximados de tu cuenta (a partir de tu GPS al abrir la app)</td><td>Estadísticas internas agregadas de dónde usan la app nuestros clientes -- nunca es un historial de tus movimientos (se sobrescribe, no se guarda cada ubicación por separado), y nunca se te muestra a vos ni a otros usuarios</td></tr>
<tr><td>Mensajes de chat, publicaciones, reseñas, comentarios</td><td>Funcionamiento de esas funciones; moderación ante reportes</td></tr>
<tr><td>Fotos que subís (perfil, catálogo, historias, chat)</td><td>Mostrarlas en la app</td></tr>
<tr><td>Token de notificaciones push</td><td>Enviarte notificaciones (solicitudes, mensajes, promociones)</td></tr>
<tr><td>Historial de pagos del negocio a la plataforma (monto, plan, fecha)</td><td>Facturación de suscripción/publicidad</td></tr>
<tr><td>Estadísticas de uso del negocio (vistas, clics)</td><td>Dashboard del negocio y sugerencias de crecimiento</td></tr>
</table>
<p><strong>Lo que NO recolectamos:</strong> no procesamos ni almacenamos datos de tarjetas de crédito/débito (eso lo maneja directamente Payphone), y no vemos ni intermediamos el pago que le hacés en efectivo o transferencia a un negocio.</p>

<h2>3. Con quién compartimos datos</h2>
<table>
<tr><th>Proveedor</th><th>Para qué</th></tr>
<tr><td>Supabase</td><td>Base de datos, autenticación y almacenamiento de archivos</td></tr>
<tr><td>Payphone</td><td>Procesar el pago del negocio hacia la plataforma (suscripción/publicidad), donde esté disponible</td></tr>
<tr><td>Resend</td><td>Envío de correos (verificación de cuenta, recuperar contraseña, notificaciones)</td></tr>
<tr><td>Google Maps</td><td>Geolocalización y cálculo de distancias/tiempos estimados</td></tr>
<tr><td>Expo / Firebase Cloud Messaging</td><td>Entrega de notificaciones push</td></tr>
<tr><td>Vercel</td><td>Hospedaje del portal web y del panel de administración</td></tr>
</table>
<p>No vendemos tus datos a terceros con fines publicitarios ajenos a la plataforma.</p>

<h2>4. Ubicación en tiempo real</h2>
<p>Tu ubicación exacta solo se comparte con un Negocio cuando: (a) buscas talleres cercanos (se usa para calcular distancia, no se guarda un historial de recorrido), o (b) tienes una solicitud de auxilio en carretera activa — en ese caso el Negocio que la acepta ve tu ubicación en tiempo real hasta que el auxilio se completa o cancela.</p>

<h2>5. Cuánto tiempo guardamos los datos</h2>
<p>Mientras tu cuenta esté activa. Si eliminas tu cuenta, tus datos personales se eliminan o anonimizan, salvo que la ley exija conservar registros de pago por un plazo determinado (aplica a Negocios, por facturación).</p>

<h2>6. Tus derechos</h2>
<p>Puedes acceder, corregir o eliminar tus datos desde la app (Configuración) o escribiendo a <a href="mailto:soporte@sosmoto.net">soporte@sosmoto.net</a>.</p>

<h2>7. Menores de edad</h2>
<p>SOSmoto no está dirigido a menores de 18 años. No recolectamos deliberadamente datos de menores.</p>

<h2>8. Cambios a esta política</h2>
<p>Podemos actualizar esta política. Cambios materiales se notificarán dentro de la app.</p>',
  now()
);
