// Android App Links -- servido en /.well-known/assetlinks.json vía el
// rewrite en vercel.json. ANDROID_SHA256_FINGERPRINTS admite varias huellas
// separadas por coma (ej. "huella-preview,huella-produccion") para cuando
// se agregue la firma de Play App Signing más adelante -- no reemplazar la
// de preview, agregar la nueva a la lista.
module.exports = async (req, res) => {
  const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
    .split(',')
    .map((f) => f.trim())
    .filter(Boolean);

  res.setHeader('Content-Type', 'application/json');
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
};
