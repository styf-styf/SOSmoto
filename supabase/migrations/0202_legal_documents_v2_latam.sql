-- Versión 2 de Términos y Privacidad -- generaliza el lenguaje que asumía
-- Ecuador como único mercado, como parte de expandir SOSmoto a cualquier
-- país de Latinoamérica hispanohablante. Se inserta como fila nueva (mismo
-- patrón versionado de 0141), no se edita la v1.
--
-- IMPORTANTE (nota técnica, no legal): esto NO reemplaza una revisión legal
-- real -- la cláusula de jurisdicción se generaliza razonablemente (ya no
-- fuerza "Ecuador" como ley aplicable) a "las leyes de tu país de
-- residencia", pero no es asesoría legal. El dato del operador (SOSmoto
-- operado por 3Dimensions, RUC 1751489426001) se deja sin cambios -- es un
-- hecho real de registro de la empresa, no una asunción de mercado.
insert into legal_documents (type, version, content, published_at) values
(
  'terms',
  2,
  '<h2>1. Quién ofrece el servicio</h2>
<p>SOSmoto es operado por 3Dimensions (RUC 1751489426001), en adelante "SOSmoto" o "la Plataforma". Contacto: <a href="mailto:soporte@sosmoto.net">soporte@sosmoto.net</a>.</p>

<h2>2. Qué es SOSmoto</h2>
<p>SOSmoto es una aplicación móvil que conecta a motociclistas ("Clientes") con talleres mecánicos y tiendas de accesorios/repuestos ("Negocios"). Funciona como directorio, marketplace de servicios/productos, y sistema de auxilio en carretera.</p>

<h2>3. Cuentas de usuario</h2>
<ul>
<li>Para usar SOSmoto hace falta crear una cuenta con correo y contraseña, y confirmar el correo.</li>
<li>Eres responsable de mantener la confidencialidad de tu contraseña y de toda actividad realizada desde tu cuenta.</li>
<li>Debes tener capacidad legal para contratar según las leyes de tu país de residencia.</li>
<li>SOSmoto puede suspender o eliminar cuentas que incumplan estos Términos, incluyendo fraude, abuso, spam o suplantación.</li>
</ul>

<h2>4. Pagos — cómo funcionan realmente</h2>
<p><strong>Entre Cliente y Negocio: SOSmoto no cobra ni procesa ningún pago.</strong> El Cliente paga el servicio o producto directamente al Negocio, por fuera de la app (efectivo, transferencia, u otro medio que acuerden entre ellos). SOSmoto no es parte de esa transacción, no garantiza precios, calidad, ni cumplimiento, y no media en disputas de pago entre Cliente y Negocio.</p>
<p><strong>Entre Negocio y SOSmoto: sí hay pago con pasarela.</strong> Los Negocios pagan a SOSmoto (vía Payphone) para acceder a planes de suscripción (visibilidad, límites de catálogo) y/o para publicidad dentro de la app, donde esté disponible. Estos pagos se facturan y procesan según las condiciones vigentes en el momento de la compra, visibles en la app antes de confirmar.</p>

<h2>5. Auxilio en carretera</h2>
<p>La función de auxilio conecta a un Cliente que solicita ayuda con Negocios cercanos que pueden aceptar o rechazar la solicitud. SOSmoto facilita el contacto pero <strong>no presta el servicio de auxilio en sí</strong> — quien acepta la solicitud es un Negocio independiente, no un empleado de SOSmoto. El Cliente comparte su ubicación en tiempo real únicamente mientras dura la solicitud activa.</p>

<h2>6. Reseñas y calificaciones</h2>
<p>Los Clientes pueden calificar y comentar sobre Negocios tras un servicio o auxilio completado. Las reseñas deben reflejar experiencias reales; SOSmoto puede moderar o eliminar contenido falso, difamatorio o que viole estos Términos.</p>

<h2>7. Contenido generado por el usuario</h2>
<p>Publicaciones, historias, fotos, comentarios y mensajes de chat son responsabilidad de quien los publica. SOSmoto puede moderar, ocultar o eliminar contenido que incumpla la ley o estos Términos, y cuenta con un sistema de reportes para que cualquier usuario señale contenido inapropiado.</p>

<h2>8. Verificación de negocios (KYC)</h2>
<p>Los Negocios pueden solicitar una insignia de "verificado" enviando documentación (documento de identidad, registro tributario si aplica, permisos, fotos del local). SOSmoto revisa y aprueba o rechaza estas solicitudes a su criterio; la insignia no constituye garantía de calidad del servicio del Negocio.</p>

<h2>9. Limitación de responsabilidad</h2>
<p>SOSmoto es un intermediario tecnológico. En la medida permitida por la ley, SOSmoto no es responsable por: la calidad, seguridad, legalidad o cumplimiento de los servicios/productos ofrecidos por los Negocios; disputas de pago entre Cliente y Negocio (al no ser parte de esa transacción); ni por daños derivados de un auxilio en carretera prestado por un Negocio.</p>

<h2>10. Modificaciones</h2>
<p>SOSmoto puede actualizar estos Términos. Cambios materiales se notificarán dentro de la app antes de entrar en vigencia.</p>

<h2>11. Ley aplicable</h2>
<p>Estos Términos se rigen por las leyes de tu país de residencia, sin perjuicio de las normas de protección al consumidor que te correspondan localmente.</p>',
  now()
),
(
  'privacy',
  2,
  '<h2>1. Responsable del tratamiento</h2>
<p>3Dimensions (RUC 1751489426001) ("SOSmoto"). Contacto para temas de privacidad: <a href="mailto:soporte@sosmoto.net">soporte@sosmoto.net</a>.</p>

<h2>2. Qué datos recolectamos</h2>
<table>
<tr><th>Dato</th><th>Para qué se usa</th></tr>
<tr><td>Correo, teléfono, nombre, foto de perfil</td><td>Crear y mostrar tu cuenta</td></tr>
<tr><td>Rol (cliente/negocio) y datos del negocio (nombre, dirección, país, horario, documento de identidad/tributario para KYC)</td><td>Operar el perfil de negocio y verificarlo</td></tr>
<tr><td>Vehículos (marca, modelo, año, kilometraje)</td><td>Sugerencias de mantenimiento</td></tr>
<tr><td>Ubicación</td><td>Buscar talleres cercanos, y compartirla en tiempo real solo mientras dura una solicitud de auxilio activa</td></tr>
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
