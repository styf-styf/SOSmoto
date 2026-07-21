// Compartido entre app/(client)/(tabs)/buscar.tsx y app/(business)/buscar.tsx.
export const ratingFilters: { label: string; value: number | undefined }[] = [
  { label: 'Todas', value: undefined },
  { label: '4+ ★', value: 4 },
  { label: '4.5+ ★', value: 4.5 },
];
