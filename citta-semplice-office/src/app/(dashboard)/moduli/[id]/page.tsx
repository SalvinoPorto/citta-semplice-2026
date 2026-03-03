import { notFound } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { ModuloForm } from '../modulo-form';

async function getModulo(id: number) {
  return prisma.modulo.findUnique({
    where: { id },
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ModificaModuloPage({ params }: PageProps) {
  const { id } = await params;
  const moduloId = parseInt(id, 10);

  if (isNaN(moduloId)) {
    notFound();
  }

  const modulo = await getModulo(moduloId);

  if (!modulo) {
    notFound();
  }

  return (
    <div>
      <div className="page-header">
        <h1>Modifica Modulo</h1>
        <p>{modulo.name}</p>
      </div>

      <ModuloForm
        modulo={{
          id: modulo.id,
          name: modulo.name,
          slug: modulo.slug,
          description: modulo.description || '',
          tipo: modulo.tipo as 'HTML' | 'PDF',
          nomeFile: modulo.nomeFile || '',
          attributes: modulo.attributes || '',
          corpo: modulo.corpo || '',
          attivo: modulo.attivo,
        }}
      />
    </div>
  );
}
