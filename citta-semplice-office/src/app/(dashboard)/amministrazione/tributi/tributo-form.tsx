'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardBody, CardTitle, Button, Input } from '@/components/ui';
import { saveTributo, deleteTributo, TributoData } from './actions';

interface TributoFormProps {
  initialData?: TributoData & { id: number };
}

export function TributoForm({ initialData }: TributoFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState<TributoData>({
    codice: initialData?.codice || '',
    descrizione: initialData?.descrizione || '',
    attivo: initialData?.attivo ?? true,
  });

  const updateField = (field: keyof TributoData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.codice.trim()) {
      toast.error('Il codice tributo è obbligatorio');
      return;
    }
    setLoading(true);
    try {
      const result = await saveTributo(formData, initialData?.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/tributi'), 1500);
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
    if (!initialData?.id) return;
    if (!confirm('Sei sicuro di voler eliminare questo tributo?')) return;
    setDeleteLoading(true);
    try {
      const result = await deleteTributo(initialData.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/tributi'), 1500);
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
      <Card className="mb-4">
        <CardBody>
          <CardTitle>Dati Tributo</CardTitle>
          <div className="row g-3">
            <div className="col-md-4">
              <Input
                type="text"
                label="Codice Tributo *"
                value={formData.codice}
                onChange={(e) => updateField('codice', e.target.value)}
                placeholder="es. 3916"
                required
              />
            </div>
            <div className="col-md-8">
              <Input
                type="text"
                label="Descrizione"
                value={formData.descrizione}
                onChange={(e) => updateField('descrizione', e.target.value)}
                placeholder="Descrizione del tributo"
              />
            </div>
            <div className="col-md-12">
              <div className="form-check form-switch">
                <input
                  type="checkbox"
                  id="attivo"
                  className="form-check-input"
                  checked={formData.attivo}
                  onChange={(e) => updateField('attivo', e.target.checked)}
                />
                <label htmlFor="attivo" className="form-check-label">
                  <strong>Attivo</strong>
                  <span className="text-muted ms-2">(disponibile per la selezione nei pagamenti)</span>
                </label>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      <div className="d-flex justify-content-between gap-2">
        <div>
          {initialData && (
            <Button
              type="button"
              variant="outline-danger"
              onClick={handleDelete}
              loading={deleteLoading}
              disabled={loading}
            >
              Elimina
            </Button>
          )}
        </div>
        <div className="d-flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push('/amministrazione/tributi')}
            disabled={loading || deleteLoading}
          >
            Annulla
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={deleteLoading}>
            {initialData ? 'Salva Modifiche' : 'Crea Tributo'}
          </Button>
        </div>
      </div>
    </form>
  );
}
