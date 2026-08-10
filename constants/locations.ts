// Punto único de verdad para país/provincia -- antes ECUADOR_PROVINCES vivía
// duplicado en datos-negocio.tsx y (business)/(tabs)/index.tsx. Se agrega acá
// junto con la lista de países LatAm hispanohablantes (para el picker de país
// del negocio), su código de marcado telefónico (usado por utils/whatsapp.ts
// para armar el link correcto según el país del negocio, no fijo a Ecuador),
// y coordenadas aproximadas de su capital (usadas como centro inicial del
// mapa mientras el GPS todavía no resuelve, en vez de un punto fijo en
// Quito sin importar el país elegido).
export interface LatamCountry {
  name: string;
  dialCode: string;
  capital: { latitude: number; longitude: number };
}

// Ecuador primero a propósito -- es el mercado base, así aparece arriba en
// cualquier picker sin tener que ordenar alfabéticamente y perder foco.
export const LATAM_COUNTRIES: LatamCountry[] = [
  { name: 'Ecuador', dialCode: '593', capital: { latitude: -0.1807, longitude: -78.4678 } },
  { name: 'Argentina', dialCode: '54', capital: { latitude: -34.6037, longitude: -58.3816 } },
  { name: 'Bolivia', dialCode: '591', capital: { latitude: -16.5, longitude: -68.15 } },
  { name: 'Chile', dialCode: '56', capital: { latitude: -33.4489, longitude: -70.6693 } },
  { name: 'Colombia', dialCode: '57', capital: { latitude: 4.711, longitude: -74.0721 } },
  { name: 'Costa Rica', dialCode: '506', capital: { latitude: 9.9281, longitude: -84.0907 } },
  { name: 'Cuba', dialCode: '53', capital: { latitude: 23.1136, longitude: -82.3666 } },
  { name: 'El Salvador', dialCode: '503', capital: { latitude: 13.6929, longitude: -89.2182 } },
  { name: 'Guatemala', dialCode: '502', capital: { latitude: 14.6349, longitude: -90.5069 } },
  { name: 'Honduras', dialCode: '504', capital: { latitude: 14.0723, longitude: -87.1921 } },
  { name: 'México', dialCode: '52', capital: { latitude: 19.4326, longitude: -99.1332 } },
  { name: 'Nicaragua', dialCode: '505', capital: { latitude: 12.1364, longitude: -86.2514 } },
  { name: 'Panamá', dialCode: '507', capital: { latitude: 8.9824, longitude: -79.5199 } },
  { name: 'Paraguay', dialCode: '595', capital: { latitude: -25.2637, longitude: -57.5759 } },
  { name: 'Perú', dialCode: '51', capital: { latitude: -12.0464, longitude: -77.0428 } },
  { name: 'República Dominicana', dialCode: '1', capital: { latitude: 18.4861, longitude: -69.9312 } },
  { name: 'Uruguay', dialCode: '598', capital: { latitude: -34.9011, longitude: -56.1645 } },
  { name: 'Venezuela', dialCode: '58', capital: { latitude: 10.4806, longitude: -66.9036 } },
];

export const ECUADOR_PROVINCES: string[] = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
];

export function dialCodeForCountry(country: string | null | undefined): string {
  return LATAM_COUNTRIES.find((c) => c.name === country)?.dialCode ?? '593';
}

export function capitalCoordsForCountry(country: string | null | undefined): { latitude: number; longitude: number } {
  return LATAM_COUNTRIES.find((c) => c.name === country)?.capital ?? LATAM_COUNTRIES[0].capital;
}
