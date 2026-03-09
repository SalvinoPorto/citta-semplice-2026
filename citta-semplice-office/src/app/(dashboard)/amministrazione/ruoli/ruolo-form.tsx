'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card, CardBody, CardTitle, Button, Input } from '@/components/ui';
import { saveRuolo, deleteRuolo, RuoloData } from './actions';
import { PERMISSIONS } from '@/lib/auth/roles';

const PERMISSION_GROUPS: { label: string; items: { key: string; label: string }[] }[] = [
  {
    label: 'Istanze',
    items: [
      { key: PERMISSIONS.ISTANZE_VIEW, label: 'Visualizza istanze' },
      { key: PERMISSIONS.ISTANZE_MANAGE, label: 'Gestisci istanze' },
    ],
  },
  {
    label: 'Operatori',
    items: [
      { key: PERMISSIONS.OPERATORI_VIEW, label: 'Visualizza operatori' },
      { key: PERMISSIONS.OPERATORI_MANAGE, label: 'Gestisci operatori' },
    ],
  },
  {
    label: 'Organizzazione',
    items: [
      { key: PERMISSIONS.ENTI_VIEW, label: 'Visualizza enti' },
      { key: PERMISSIONS.ENTI_MANAGE, label: 'Gestisci enti' },
      { key: PERMISSIONS.AREE_VIEW, label: 'Visualizza aree' },
      { key: PERMISSIONS.AREE_MANAGE, label: 'Gestisci aree' },
      { key: PERMISSIONS.SERVIZI_VIEW, label: 'Visualizza servizi' },
      { key: PERMISSIONS.SERVIZI_MANAGE, label: 'Gestisci servizi' },
      { key: PERMISSIONS.UFFICI_VIEW, label: 'Visualizza uffici' },
      { key: PERMISSIONS.UFFICI_MANAGE, label: 'Gestisci uffici' },
    ],
  },
  {
    label: 'Amministrazione',
    items: [
      { key: PERMISSIONS.ADMIN_ACCESS, label: 'Accesso amministrazione' },
      { key: PERMISSIONS.RUOLI_MANAGE, label: 'Gestisci ruoli' },
      { key: PERMISSIONS.TRIBUTI_MANAGE, label: 'Gestisci tributi' },
      { key: PERMISSIONS.EMAIL_CONFIG, label: 'Configurazione email' },
    ],
  },
  {
    label: 'Statistiche e Ricerche',
    items: [
      { key: PERMISSIONS.STATISTICHE_VIEW, label: 'Visualizza statistiche' },
      { key: PERMISSIONS.RICERCHE_VIEW, label: 'Accesso ricerche' },
    ],
  },
];

interface RuoloFormProps {
  initialData?: RuoloData & { id: number };
}

export function RuoloForm({ initialData }: RuoloFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const [formData, setFormData] = useState<RuoloData>({
    nome: initialData?.nome || '',
    descrizione: initialData?.descrizione || '',
    permessi: initialData?.permessi || [],
  });

  const updateField = (field: keyof RuoloData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const togglePermesso = (permesso: string) => {
    setFormData((prev) => ({
      ...prev,
      permessi: prev.permessi.includes(permesso)
        ? prev.permessi.filter((p) => p !== permesso)
        : [...prev.permessi, permesso],
    }));
  };

  const toggleGroup = (items: { key: string }[]) => {
    const keys = items.map((i) => i.key);
    const allSelected = keys.every((k) => formData.permessi.includes(k));
    setFormData((prev) => ({
      ...prev,
      permessi: allSelected
        ? prev.permessi.filter((p) => !keys.includes(p))
        : [...new Set([...prev.permessi, ...keys])],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      toast.error('Il nome del ruolo è obbligatorio');
      return;
    }
    setLoading(true);
    try {
      const result = await saveRuolo(formData, initialData?.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/ruoli'), 1500);
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
    if (!confirm('Sei sicuro di voler eliminare questo ruolo?')) return;
    setDeleteLoading(true);
    try {
      const result = await deleteRuolo(initialData.id);
      if (result.success) {
        toast.success(result.message, { duration: 1500 });
        setTimeout(() => router.push('/amministrazione/ruoli'), 1500);
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
          <CardTitle>Dati Ruolo</CardTitle>
          <div className="row g-3">
            <div className="col-md-4">
              <Input
                type="text"
                label="Nome Ruolo *"
                value={formData.nome}
                onChange={(e) => updateField('nome', e.target.value)}
                placeholder="es. OPERATORE"
                required
              />
            </div>
            <div className="col-md-8">
              <Input
                type="text"
                label="Descrizione"
                value={formData.descrizione}
                onChange={(e) => updateField('descrizione', e.target.value)}
                placeholder="Descrizione del ruolo"
              />
            </div>
          </div>
        </CardBody>
      </Card>

      <Card className="mb-4">
        <CardBody>
          <CardTitle>Permessi</CardTitle>
          <p className="text-muted small mb-4">
            Seleziona i permessi assegnati a questo ruolo.
            Attualmente selezionati: <strong>{formData.permessi.length}</strong>
          </p>

          <div className="row g-4">
            {PERMISSION_GROUPS.map((group) => {
              const allSelected = group.items.every((i) => formData.permessi.includes(i.key));
              const someSelected = group.items.some((i) => formData.permessi.includes(i.key));
              return (
                <div key={group.label} className="col-md-6">
                  <div className="border rounded p-3">
                    <div className="d-flex align-items-center justify-content-between mb-2">
                      <strong>{group.label}</strong>
                      <button
                        type="button"
                        className={`btn btn-sm ${allSelected ? 'btn-primary' : someSelected ? 'btn-outline-primary' : 'btn-outline-secondary'}`}
                        onClick={() => toggleGroup(group.items)}
                      >
                        {allSelected ? 'Deseleziona tutti' : 'Seleziona tutti'}
                      </button>
                    </div>
                    {group.items.map((item) => (
                      <div key={item.key} className="form-check">
                        <input
                          type="checkbox"
                          id={`perm-${item.key}`}
                          className="form-check-input"
                          checked={formData.permessi.includes(item.key)}
                          onChange={() => togglePermesso(item.key)}
                        />
                        <label htmlFor={`perm-${item.key}`} className="form-check-label">
                          {item.label}
                          <small className="text-muted ms-1">({item.key})</small>
                        </label>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
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
            onClick={() => router.push('/amministrazione/ruoli')}
            disabled={loading || deleteLoading}
          >
            Annulla
          </Button>
          <Button type="submit" variant="primary" loading={loading} disabled={deleteLoading}>
            {initialData ? 'Salva Modifiche' : 'Crea Ruolo'}
          </Button>
        </div>
      </div>
    </form>
  );
}
