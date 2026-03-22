'use client';

import { useState, useRef } from 'react';
import { PrivacyStep } from './PrivacyStep';
import { ModuloStep, ModuloStepHandle } from './ModuloStep';
import { AllegatiStep, AllegatiStepHandle, AllegatoCaricato, AllegatoRichiesto } from './AllegatiStep';
import { RiepilogoStep } from './RiepilogoStep';
import { submitIstanza, salvaBozza } from '@/lib/actions/istanza';
import { toast } from 'sonner';

function buildDatiConLabel(
  datiModulo: Record<string, unknown>,
  attributi: string | null | undefined,
): string {
  let campi: { fields: Array<{ name: string; label: string }> } = { fields: [] };
  try {
    if (attributi) campi = JSON.parse(attributi);
  } catch (e){ console.error('Errore durante il parsing degli attributi', e); }
console.log('Campi del modulo:', datiModulo);
  const arricchiti = campi.fields.map(({ name, label }) => ({
    name,
    label,
    value: datiModulo[name] !== undefined ? String(datiModulo[name]) : '',
  })).filter((campo) => campo.name !== 'paragraph'); // Filtra i campi testo statico
  return JSON.stringify(arricchiti);
}

interface StepWorkflow {
  id: number;
  descrizione: string;
  allegati: boolean;
  allegatiRichiestiList: AllegatoRichiesto[];
}

interface Servizio {
  id: number;
  titolo: string;
  attributi?: string | null;
  moduloCorpo?: string | null;
  steps: StepWorkflow[];
}

interface BozzaIniziale {
  id: number;
  datiModulo: Record<string, unknown>;
  activeStep: number;
}

interface Props {
  servizio: Servizio;
  userId: string;
  bozzaIniziale?: BozzaIniziale;
}

type StepId = 'privacy' | 'modulo' | 'allegati' | 'riepilogo';

const STEPS: { id: StepId; label: string }[] = [
  { id: 'privacy', label: 'Informativa sulla privacy' },
  { id: 'modulo', label: 'Modulo' },
  { id: 'allegati', label: 'Allegati' },
  { id: 'riepilogo', label: 'Riepilogo' },
];

export function IstanzaStepper({ servizio, userId, bozzaIniziale }: Props) {
  const [activeStep, setActiveStep] = useState(bozzaIniziale?.activeStep ?? 0);
  const [privacyAccettata, setPrivacyAccettata] = useState(bozzaIniziale ? true : false);
  const [datiModulo, setDatiModulo] = useState<Record<string, unknown>>(bozzaIniziale?.datiModulo ?? {});
  const [allegatiCaricati, setAllegatiCaricati] = useState<AllegatoCaricato[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [bozzaId, setBozzaId] = useState<number | null>(bozzaIniziale?.id ?? null);

  const moduloRef = useRef<ModuloStepHandle>(null);
  const allegatiRef = useRef<AllegatiStepHandle>(null);

  // Gli allegati del primo step destinati al cittadino (non interni, non operatore)
  const allegatiRichiesti: AllegatoRichiesto[] = servizio.steps[0]?.allegatiRichiestiList ?? [];

  const canGoForward = () => {
    if (activeStep === 0) return privacyAccettata;
    return true;
  };

  const handleForward = async () => {
    if (!canGoForward()) return;
    if (activeStep === 1) {
      const valid = await moduloRef.current?.validate();
      if (!valid) return;
    }
    if (activeStep === 2) {
      const valid = allegatiRef.current?.validate();
      if (!valid) return;
    }
    setActiveStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setActiveStep((s) => Math.max(s - 1, 0));
  };

  const handleSaveDraft = async () => {
    setSavingDraft(true);
    try {
      const formData = new FormData();
      formData.append('servizioId', String(servizio.id));
      formData.append('userId', userId);
      formData.append('dati', buildDatiConLabel(datiModulo, servizio.attributi));
      formData.append('activeStep', String(activeStep));
      if (bozzaId) formData.append('bozzaId', String(bozzaId));

      const result = await salvaBozza(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        if (result.bozzaId && result.bozzaId !== bozzaId) {
          setBozzaId(result.bozzaId);
        }
        toast.success('Bozza salvata con successo!');
      }
    } catch {
      toast.error('Errore durante il salvataggio della bozza. Riprova.');
    } finally {
      setSavingDraft(false);
    }
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('servizioId', String(servizio.id));
      formData.append('userId', userId);
      formData.append('dati', buildDatiConLabel(datiModulo, servizio.attributi));
      if (bozzaId) formData.append('bozzaId', String(bozzaId));
      allegatiCaricati.forEach(({ allegatoId, file }) => {
        formData.append('allegati', file);
        formData.append('allegatiIds', String(allegatoId));
      });

      const result = await submitIstanza(formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Istanza inviata con successo!');
        window.location.href = '/le-mie-istanze';
      }
    } catch (e){
      console.error('Errore durante l\'invio dell\'istanza', e);
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
            ref={moduloRef}
            servizio={servizio}
            dati={datiModulo}
            onChangeDati={setDatiModulo}
          />
        )}
        {activeStep === 2 && (
          <AllegatiStep
            ref={allegatiRef}
            allegatiRichiesti={allegatiRichiesti}
            allegatiCaricati={allegatiCaricati}
            onChangeAllegati={setAllegatiCaricati}
          />
        )}
        {activeStep === 3 && (
          <RiepilogoStep
            servizio={servizio}
            datiModulo={datiModulo}
            allegati={allegatiCaricati.map((a) => a.file)}
          />
        )}
      </div>

      {/* Navigation buttons */}
      <div className="steppers-nav d-flex justify-content-between align-items-center mt-4">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleBack}
          disabled={activeStep === 0}
        >
          <svg className="icon icon-sm me-1" aria-hidden="true">
            <use href="/bootstrap-italia/dist/svg/sprites.svg#it-chevron-left" />
          </svg>
          Indietro
        </button>

        {/* Salva in bozza — visibile dal secondo step in poi, non al riepilogo finale */}
        {activeStep > 0 && activeStep < STEPS.length - 1 && (
          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={handleSaveDraft}
            disabled={savingDraft}
          >
            {savingDraft ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                Salvataggio...
              </>
            ) : (
              <>
                <svg className="icon icon-sm me-1" aria-hidden="true">
                  <use href="/bootstrap-italia/dist/svg/sprites.svg#it-clock" />
                </svg>
                Salva in bozza
              </>
            )}
          </button>
        )}

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
