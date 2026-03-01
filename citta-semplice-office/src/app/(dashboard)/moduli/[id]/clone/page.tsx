import { notFound, redirect } from 'next/navigation';
import prisma from '@/lib/db/prisma';
import { cloneModulo } from '../../actions';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CloneModuloPage({ params }: PageProps) {
  const { id } = await params;
  const moduloId = parseInt(id, 10);

  if (isNaN(moduloId)) {
    notFound();
  }

  // Check if modulo exists
  const modulo = await prisma.modulo.findUnique({
    where: { id: moduloId },
    select: { id: true },
  });

  if (!modulo) {
    notFound();
  }

  // Perform the clone operation
  await cloneModulo(moduloId);

  // The cloneModulo action will redirect, but just in case
  redirect('/moduli');
}
