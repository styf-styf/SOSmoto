// Apple Universal Links -- servido en /.well-known/apple-app-site-association
// vía el rewrite en vercel.json. Debe declarar el Team ID real de Apple
// Developer (variable de entorno APPLE_TEAM_ID en Vercel) antes de que los
// Universal Links funcionen en un build real.
module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json');
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
