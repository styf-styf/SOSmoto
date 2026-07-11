// El plugin oficial expo-splash-screen no expone una forma de fijar
// `windowSplashScreenIconBackgroundColor` (el fondo del "marco" de ícono que
// usa el splash nativo de Android 12+). Sin esto, ese marco puede verse como
// un cuadro de un tono ligeramente distinto al resto de la pantalla. Este
// plugin agrega ese atributo a mano, apuntando al mismo color de fondo del
// splash, para que el marco del ícono se funda con el resto de la pantalla.
const { withAndroidStyles } = require('expo/config-plugins');

const STYLE_NAME = 'Theme.App.SplashScreen';
const ATTR_NAME = 'windowSplashScreenIconBackgroundColor';

module.exports = function withAndroidSplashIconBackground(config, { backgroundColor }) {
  return withAndroidStyles(config, (config) => {
    const { style = [] } = config.modResults.resources;
    const target = style.find((s) => s.$.name === STYLE_NAME);
    if (target) {
      target.item = (target.item ?? []).filter((i) => i.$.name !== ATTR_NAME);
      target.item.push({ $: { name: ATTR_NAME }, _: backgroundColor });
    }
    return config;
  });
};
