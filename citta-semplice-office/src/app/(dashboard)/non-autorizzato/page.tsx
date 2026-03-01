import Link from 'next/link';
import { Card, CardBody, Button } from '@/components/ui';

export default function NonAutorizzatoPage() {
  return (
    <div className="d-flex justify-content-center align-items-center" style={{ minHeight: '60vh' }}>
      <Card style={{ maxWidth: '500px' }}>
        <CardBody className="text-center py-5">
          <svg className="icon icon-danger" style={{ width: '80px', height: '80px' }}>
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-ban"></use>
          </svg>
          <h2 className="mt-4">Accesso Non Autorizzato</h2>
          <p className="text-muted mb-4">
            Non hai i permessi necessari per accedere a questa pagina.
            Contatta l&apos;amministratore se ritieni di dover avere accesso.
          </p>
          <Link href="/">
            <Button variant="primary">
              Torna alla Dashboard
            </Button>
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}
