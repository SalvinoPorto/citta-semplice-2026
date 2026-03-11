'use client';

import { useState } from 'react';
import { PrivacyStep } from './PrivacyStep';
import { ModuloStep } from './ModuloStep';
import { AllegatiStep } from './AllegatiStep';
import { RiepilogoStep } from './RiepilogoStep';
import { submitIstanza } from '@/lib/actions/istanza';
import { toast } from 'sonner';

interface Step {
  id: number;
  descrizione: string;
  allegati: boolean;
}

interface Servizio {
  id: number;
  titolo: string;
  moduloTipo: string;
  attributi?: string | null;
  moduloCorpo?: string | null;
  steps: Step[];
}

interface Props {
  servizio: Servizio;
  userId: string;
}

type StepId = 'privacy' | 'modulo' | 'allegati' | 'riepilogo';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'privacy', label: 'Informativa sulla privacy' },
  { id: 'modulo', label: 'Modulo' },
  { id: 'allegati', label: 'Allegati' },
  { id: 'riepilogo', label: 'Riepilogo' },
];

export function IstanzaStepper({ servizio, userId }: Props) {
  const [activeStep, setActiveStep] = useState(0);
  const [privacyAccettata, setPrivacyAccettata] = useState(false);
  const [datiModulo, setDatiModulo] = useState<Record<string, unknown>>({});
  const [allegati, setAllegati] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);

  const canGoForward = () => {
    if (activeStep === 0) return privacyAccettata;
    return true;
  };

  const handleForward = () => {
    if (canGoForward()) setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('servizioId', String(servizio.id));
      formData.append('userId', userId);
      formData.append('dati', JSON.stringify(datiModulo));
      allegati.forEach((file) => formData.append('allegati', file));

      const result = await submitIstanza(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Istanza inviata con successo!');
        window.location.href = '/le-mie-istanze';
      }
    } catch {
      toast.error('Errore durante l\'invio. Riprova.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="it-steppers-container">
      {/* Progress bar steps */}
      <div className="steppers mb-4">
        <ul className="steppers-header">
          {STEPS.map((step, i) => (
            <li key={step.id} className={i <= activeStep ? 'active' : ''}>
              <button
                className="btn steppers-btn-empty"
                disabled={i > activeStep}
                onClick={() => i < activeStep && setActiveStep(i)}
              >
                <span className="steppers-number">{i + 1}</span>
                <span className="steppers-label d-none d-lg-block">{step.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Step content */}
      <div className="steppers-content py-3">
        {activeStep === 0 && (
          <PrivacyStep accepted={privacyAccettata} onAccept={setPrivacyAccettata} />
        )}
        {activeStep === 1 && (
          <ModuloStep
            servizio={servizio}
            dati={datiModulo}
            onChangeDati={setDatiModulo}
          />
        )}
        {activeStep === 2 && (
          <AllegatiStep files={allegati} onChangeFiles={setAllegati} />
        )}
        {activeStep === 3 && (
          <RiepilogoStep
            servizio={servizio}
            datiModulo={datiModulo}
            allegati={allegati}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="steppers-nav d-flex justify-content-between mt-4">
        <button
          type="button"
          className="btn btn-outline-primary"
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          <svg className="icon icon-sm me-1" aria-hidden="true">
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-chevron-left" />
          </svg>
          Indietro
        </button>

        {activeStep < STEPS.length - 1 ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleForward}
            disabled={!canGoForward()}
          >
            Avanti
            <svg className="icon icon-sm ms-1" aria-hidden="true">
              <use href="/bootstrap-italia/dist/svg/sprites.svg#it-chevron-right" />
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Invio in corso...
              </>
            ) : (
              'Invia la richiesta'
            )}
          </button>
        )}
      </div>
    </div>
  );
}
