import { MisComprasView } from '../../components/MisComprasView';

export default function MisComprasScreen() {
  return (
    <MisComprasView
      hrefBase="/(business)"
      emptyText="Todavía no has apartado productos de otros negocios."
      allowCancel={false}
    />
  );
}
