'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardBody, Button, Input, Textarea } from '@/components/ui';
import { createArea, updateArea, deleteArea } from './actions';
import type { AreaFormData } from '@/lib/validations/area';

interface AreaData {
  id: number;
  nome: string;
  descrizione: string;
  icona: string;
  ordine: number;
  attiva: boolean;
}

interface AreaFormProps {
  area?: AreaData;
  isNew?: boolean;
}

export function AreaForm({ area, isNew }: AreaFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState<AreaFormData>({
    nome: area?.nome || '',
    descrizione: area?.descrizione || '',
    icona: area?.icona || '',
    ordine: area?.ordine ?? 0,
    attiva: area?.attiva ?? true,
  });

  const updateField = (field: keyof AreaFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Il nome è obbligatorio');
      return;
    }
    setLoading(true);
    try {
      const result = isNew
        ? await createArea(formData)
        : await updateArea(area!.id, formData);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/aree'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!area) return;
    if (!confirm('Sei sicuro di voler eliminare questa area?')) return;
    setDeleteLoading(true);
    try {
      const result = await deleteArea(area.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/aree'), 1500);
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('Si è verificato un errore');
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="row">
        <div className="col-lg-8">
          <Card className="mb-4">
            <CardBody>
              <h5 className="mb-4">Informazioni Area</h5>

              <div className="mb-3">
                <Input
                  type="text"
                  label="Nome *"
                  value={formData.nome}
                  onChange={(e) => updateField('nome', e.target.value)}
                  required
                />
              </div>

              <div className="mb-3">
                <Textarea
                  label="Descrizione"
                  value={formData.descrizione}
                  onChange={(e) => updateField('descrizione', e.target.value)}
                  rows={3}
                />
              </div>

              <div className="row">
                <div className="col-md-6 mb-3">
                  <Input
                    type="text"
                    label="Icona (classe CSS o URL)"
                    value={formData.icona}
                    onChange={(e) => updateField('icona', e.target.value)}
                  />
                </div>
                <div className="col-md-6 mb-3">
                  <Input
                    label="Ordine"
                    type="number"
                    value={formData.ordine}
                    onChange={(e) => updateField('ordine', parseInt(e.target.value) || 0)}
                    min={0}
                  />
                </div>
              </div>

              <div className="form-check mb-3">
                <input
                  type="checkbox"
                  className="form-check-input"
                  id="attiva"
                  checked={formData.attiva}
                  onChange={(e) => updateField('attiva', e.target.checked)}
                />
                <label className="form-check-label" htmlFor="attiva">
                  Area attiva
                </label>
              </div>
            </CardBody>
          </Card>
        </div>

        <div className="col-lg-4">
          <Card className="sticky-top" style={{ top: '1rem' }}>
            <CardBody>
              <h5 className="mb-4">Azioni</h5>

              <div className="d-grid gap-2">
                <Button type="submit" variant="primary" loading={loading} disabled={deleteLoading}>
                  {isNew ? 'Crea Area' : 'Salva Modifiche'}
                </Button>

                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => router.push('/amministrazione/aree')}
                  disabled={loading || deleteLoading}
                >
                  Annulla
                </Button>

                {!isNew && area && (
                  <>
                    <hr />
                    <Button
                      type="button"
                      variant="outline-danger"
                      onClick={handleDelete}
                      loading={deleteLoading}
                      disabled={loading}
                    >
                      Elimina Area
                    </Button>
                  </>
                )}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </form>
  );
}
