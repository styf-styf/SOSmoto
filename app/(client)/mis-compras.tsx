import { MisComprasView } from '../../components/MisComprasView';

export default function MisComprasScreen() {
  return (
    <MisComprasView
      hrefBase="/(client)"
      emptyText="Todavía no has apartado ningún producto."
      allowCancel
    />
  );
}
