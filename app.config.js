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
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
    },
    plugins: [
      'expo-router',
      ['./plugins/withAndroidSplashIconBackground.js', { backgroundColor: '#FF6B00' }],
      [
        'expo-splash-screen',
        {
          image: './assets/splash-icon-white.png',
          imageWidth: 180,
          resizeMode: 'contain',
          backgroundColor: '#FF6B00',
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
