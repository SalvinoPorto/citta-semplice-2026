'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Input, Button } from '@/components/ui';
import { updateUtenteContatti } from '../actions';

interface Props {
  utenteId: number;
  defaultValues: {
    email: string;
    telefono: string;
    pec: string;
    indirizzo: string;
    cap: string;
    citta: string;
    provincia: string;
  };
}

export function UtenteContattiForm({ utenteId, defaultValues }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState(defaultValues);

  const set = (field: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await updateUtenteContatti(utenteId, {
        email: values.email || null,
        telefono: values.telefono || null,
        pec: values.pec || null,
        indirizzo: values.indirizzo || null,
        cap: values.cap || null,
        citta: values.citta || null,
        provincia: values.provincia || null,
      });
      if (result.error) {
        toast.error(result.error);
        setLoading(false);
      } else {
        toast.success('Contatti aggiornati', { duration: 1500 });
        setTimeout(() => router.push('/utenti'), 1500);
      }
    } catch {
      toast.error('Si è verificato un errore');
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-3">
        <Input
          type="email"
          label="Email"
          value={values.email}
          onChange={set('email')}
        />
      </div>
      <div className="mb-3">
        <Input
          type="tel"
          label="Telefono"
          value={values.telefono}
          onChange={set('telefono')}
        />
      </div>
      <div className="mb-3">
        <Input
          type="email"
          label="PEC"
          value={values.pec}
          onChange={set('pec')}          
        />
      </div>
      <div className="mb-3">
        <Input
          type="text"
          label="Indirizzo"
          value={values.indirizzo}
          onChange={set('indirizzo')}
        />
      </div>
      <div className="row g-2 mb-3">
        <div className="col-3">
          <Input
            type="text"
            label="CAP"
            value={values.cap}
            onChange={set('cap')}
            maxLength={5}
          />
        </div>
        <div className="col-6">
          <Input
            type="text"
            label="Città"
            value={values.citta}
            onChange={set('citta')}
          />
        </div>
        <div className="col-3">
          <Input
            type="text"
            label="Prov."
            value={values.provincia}
            onChange={set('provincia')}
            maxLength={2}
          />
        </div>
      </div>
      <div className="d-flex justify-content-end">
        <Button type="submit" variant="primary" loading={loading}>
          Salva contatti
        </Button>
      </div>
    </form>
  );
}
