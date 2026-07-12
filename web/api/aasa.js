// Sirve tanto Apple Universal Links (/.well-known/apple-app-site-association)
// como Android App Links (/.well-known/assetlinks.json) -- fusionados en un
// solo archivo (ver vercel.json, cada ruta pasa ?type=aasa|assetlinks) para
// no superar el limite de 12 funciones serverless del plan Hobby de Vercel.
// APPLE_TEAM_ID / ANDROID_SHA256_FINGERPRINTS son variables de entorno en
// Vercel (esta ultima admite varias huellas separadas por coma, para cuando
// se agregue la firma de Play App Signing mas adelante).
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.query.type === 'assetlinks') {
    const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
      .split(',')
      .map((f) => f.trim())
      .filter(Boolean);
    res.status(200).json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.sosmoto.app',
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
    return;
  }

  res.status(200).json({
    applinks: {
      apps: [],
      details: [
        {
          appID: `${process.env.APPLE_TEAM_ID}.com.sosmoto.app`,
          paths: ['/post/*', '/ad/*'],
        },
      ],
    },
  });
};
