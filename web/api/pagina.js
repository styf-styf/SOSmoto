const { renderPage } = require('./_lib/webPage');

// Paginas de contenido estatico (contacto, eliminar-cuenta) -- fusionadas en
// un solo archivo con ?type= (mismo motivo que negocios.js/content.js/
// aasa.js: no superar el limite de 12 funciones serverless del plan Hobby
// de Vercel). Ninguna de las dos necesita Supabase.
const PAGES = {
  contacto: {
    title: 'Contacto · SOSmoto',
    description: 'Cómo contactar a soporte de SOSmoto.',
    render: () => `
<p class="lead">¿Necesitas ayuda con tu cuenta, un pago, o algo no funciona como esperabas?</p>
<a class="button" href="mailto:soporte@sosmoto.net">Escribir a soporte@sosmoto.net</a>
<p class="hint">Te respondemos por ese mismo correo. Si tienes la app instalada, también puedes escribirnos desde Perfil → Configuración.</p>
`,
  },
  'eliminar-cuenta': {
    title: 'Eliminar cuenta · SOSmoto',
    description: 'Cómo eliminar tu cuenta de SOSmoto y qué pasa con tus datos.',
    render: () => `
<p class="lead">Puedes pedir la eliminación de tu cuenta de SOSmoto en cualquier momento, de dos formas:</p>
<ul class="steps">
  <li><strong>Desde la app:</strong> Perfil → Configuración → Eliminar cuenta.</li>
  <li><strong>Por correo:</strong> escríbenos a <a href="mailto:soporte@sosmoto.net?subject=${encodeURIComponent('Eliminar mi cuenta')}">soporte@sosmoto.net</a> indicando el correo con el que te registraste.</li>
</ul>
<a class="button" href="mailto:soporte@sosmoto.net?subject=${encodeURIComponent('Eliminar mi cuenta')}">Pedir eliminación por correo</a>
<p class="section-title">¿Qué se elimina?</p>
<p class="hint">Tu perfil, vehículos registrados, mensajes, historial de servicios y demás datos personales asociados a tu cuenta. Si tienes un negocio, incluye su catálogo, publicaciones e historias.</p>
<p class="section-title">¿Qué se conserva?</p>
<p class="hint">Los registros de pagos y facturación pueden conservarse el tiempo que exige la ley, aun después de eliminar la cuenta, únicamente para fines contables y legales.</p>
<p class="hint">Confirmamos por correo cuando la eliminación se completa.</p>
`,
  },
};

module.exports = async (req, res) => {
  const page = PAGES[req.query.type];
  if (!page) {
    res.status(404).send('Página no encontrada');
    return;
  }

  const bodyHtml = page.render();
  const extraStyle = `
.lead {
  color: #1A1A2E;
  font-size: 15px;
  line-height: 22px;
  margin: 0 0 16px;
}
.hint {
  color: #6B6B7B;
  font-size: 13px;
  line-height: 19px;
  margin: 0 0 12px;
}
.section-title {
  font-size: 14px;
  font-weight: 700;
  color: #1A1A2E;
  margin: 20px 0 6px;
}
.steps {
  margin: 0 0 20px;
  padding-left: 20px;
  color: #1A1A2E;
  font-size: 14px;
  line-height: 22px;
}
.steps li { margin-bottom: 6px; }
.button {
  display: inline-block;
  text-align: center;
  background: #FF6B00;
  color: #fff;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  padding: 14px 24px;
  border-radius: 24px;
  margin-bottom: 8px;
}
a { color: #FF6B00; }
`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(
    renderPage({
      title: page.title,
      description: page.description,
      maxWidth: 480,
      bodyHtml,
      extraStyle,
    })
  );
};
