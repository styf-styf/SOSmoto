module.exports = {
  expo: {
    name: 'SOSmoto',
    slug: 'sosmoto',
    scheme: 'sosmoto',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    runtimeVersion: {
      policy: 'appVersion',
    },
    updates: {
      url: 'https://u.expo.dev/ec5d68aa-d944-4fa3-80dc-0af8f3cddb9d',
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.sosmoto.app',
      // associatedDomains (Universal Links) pendiente -- requiere Team ID
      // real de una cuenta de Apple Developer Program, que todavía no existe
      // para este proyecto. Por ahora en iOS el link siempre abre la página
      // web (con su botón "Abrir en SOSmoto" al scheme). Agregar
      // `associatedDomains: ['applinks:so-smoto.vercel.app']` aquí cuando
      // haya cuenta.
    },
    android: {
      package: 'com.sosmoto.app',
      googleServicesFile: './google-services.json',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY,
        },
      },
      intentFilters: [
        {
          action: 'VIEW',
          autoVerify: true,
          data: [
            { scheme: 'https', host: 'so-smoto.vercel.app', pathPrefix: '/post' },
            { scheme: 'https', host: 'so-smoto.vercel.app', pathPrefix: '/ad' },
            { scheme: 'https', host: 'so-smoto.vercel.app', pathPrefix: '/product' },
            { scheme: 'https', host: 'so-smoto.vercel.app', pathPrefix: '/service' },
          ],
          category: ['BROWSABLE', 'DEFAULT'],
        },
      ],
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      ['./plugins/withAndroidSplashIconBackground.js', { backgroundColor: '#1A1A2E' }],
      [
        'expo-splash-screen',
        {
          image: './assets/SOSmoto_foreground.png',
          imageWidth: 220,
          resizeMode: 'contain',
          backgroundColor: '#1A1A2E',
        },
      ],
      [
        'expo-location',
        {
          locationWhenInUsePermission: 'Permite que SOSmoto encuentre talleres cercanos a ti.',
        },
      ],
      [
        'expo-notifications',
        {
          icon: './assets/notification-icon.png',
          color: '#FF6B00',
        },
      ],
      [
        'expo-image-picker',
        {
          photosPermission: 'Permite que SOSmoto acceda a tus fotos para subir imágenes de tu negocio.',
        },
      ],
      '@react-native-community/datetimepicker',
    ],
    extra: {
      eas: {
        projectId: 'ec5d68aa-d944-4fa3-80dc-0af8f3cddb9d',
      },
    },
  },
};
