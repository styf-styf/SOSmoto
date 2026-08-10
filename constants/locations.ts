// Punto único de verdad para país/provincia -- antes ECUADOR_PROVINCES vivía
// duplicado en datos-negocio.tsx y (business)/(tabs)/index.tsx. Se agrega acá
// junto con la lista de países LatAm hispanohablantes (para el picker de país
// del negocio) y su código de marcado telefónico (usado por utils/whatsapp.ts
// para armar el link correcto según el país del negocio, no fijo a Ecuador).
export interface LatamCountry {
  name: string;
  dialCode: string;
}

// Ecuador primero a propósito -- es el mercado base, así aparece arriba en
// cualquier picker sin tener que ordenar alfabéticamente y perder foco.
export const LATAM_COUNTRIES: LatamCountry[] = [
  { name: 'Ecuador', dialCode: '593' },
  { name: 'Argentina', dialCode: '54' },
  { name: 'Bolivia', dialCode: '591' },
  { name: 'Chile', dialCode: '56' },
  { name: 'Colombia', dialCode: '57' },
  { name: 'Costa Rica', dialCode: '506' },
  { name: 'Cuba', dialCode: '53' },
  { name: 'El Salvador', dialCode: '503' },
  { name: 'Guatemala', dialCode: '502' },
  { name: 'Honduras', dialCode: '504' },
  { name: 'México', dialCode: '52' },
  { name: 'Nicaragua', dialCode: '505' },
  { name: 'Panamá', dialCode: '507' },
  { name: 'Paraguay', dialCode: '595' },
  { name: 'Perú', dialCode: '51' },
  { name: 'República Dominicana', dialCode: '1' },
  { name: 'Uruguay', dialCode: '598' },
  { name: 'Venezuela', dialCode: '58' },
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
