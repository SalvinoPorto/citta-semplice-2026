# Form builder: valore predefinito e obbligatorietà condizionata — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Aggiungere al form builder il valore predefinito per radio/select e l'obbligatorietà di un campo condizionata sul valore di un altro campo, propagando le due feature al rendering e alla validazione del portale.

**Architecture:** I tipi `FormField` sono duplicati tra `citta-semplice-office` (builder) e `citta-semplice-portal` (rendering). Le modifiche al modello dati si rispecchiano in entrambe le app. La validazione è doppia: client (`ModuloStep`) e server (`form-validate`, non aggirabile); entrambe devono onorare l'obbligo condizionato. Il valore predefinito riusa il campo `defaultValue` già esistente.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, react-hook-form + zod (portal), Bootstrap Italia.

## Global Constraints

- **Nessun framework di test** è configurato (no vitest/jest, nessun file `*.test.ts`). Il ciclo di verifica di ogni task è: build TypeScript (typecheck) + lint + verifica manuale descritta nel task. Non introdurre un test runner.
- Comandi dalla **root del monorepo** `c:\workspaces\citta-semplice-2026`:
  - Typecheck office: `npm run build:office`
  - Typecheck portal: `npm run build:portal`
  - Lint: `npm run lint`
- **Retrocompatibilità obbligatoria**: l'assenza dei nuovi campi (`requiredCondition`) deve produrre il comportamento odierno. Nessuna migrazione dati.
- **Sincronizzazione office ↔ portal**: ogni modifica al tipo `FieldValidation` e a `risolviRiferimentiCondizioni` va replicata identica in entrambe le app.
- **Non unificare** i tipi duplicati: rispecchiare, non rifattorizzare l'architettura.
- Operatori condizione supportati (invariati): `equals`, `not_equals`, `not_empty`, `empty`. Solo `equals`/`not_equals` richiedono un valore.

---

## File Structure

**Office** (`citta-semplice-office/src/components/form-builder/`):
- `types.ts` — MODIFY: aggiungere `requiredCondition` a `FieldValidation`; estendere `risolviRiferimentiCondizioni`.
- `condition-builder.tsx` — CREATE: componente condiviso per il builder di condizione (campo + operatore + valore).
- `field-editor.tsx` — MODIFY: selettore valore predefinito per radio/select; obbligo a 3 stati; uso di `ConditionBuilder` in Visibilità e Obbligatorietà.
- `form-preview.tsx` — MODIFY: preselezione default radio/select; asterisco `*` dinamico.

**Portal** (`citta-semplice-portal/src/`):
- `lib/form-pages.ts` — MODIFY: aggiungere `requiredCondition` a `FieldValidation`; estendere `risolviRiferimentiCondizioni`.
- `lib/form-condition.ts` — MODIFY: aggiungere `requiredEffettivo`.
- `components/istanza/ModuloStep.tsx` — MODIFY: merge dei default; `buildSchema`/`validate` per obbligo condizionato; asterisco dinamico.
- `lib/form-validate.ts` — MODIFY: `validaCampo` usa `requiredEffettivo`.

---

## Task 1: Modello dati — `requiredCondition` e risoluzione riferimenti (entrambe le app)

Fondazione condivisa. Aggiunge il campo al tipo in entrambe le app, estende la risoluzione `fieldId`→`fieldName` a `requiredCondition`, e aggiunge l'helper `requiredEffettivo` lato portale. Nessun cambiamento di comportamento visibile (i campi sono opzionali e nessuno li produce ancora).

**Files:**
- Modify: `citta-semplice-office/src/components/form-builder/types.ts`
- Modify: `citta-semplice-portal/src/lib/form-pages.ts`
- Modify: `citta-semplice-portal/src/lib/form-condition.ts`

**Interfaces:**
- Produces:
  - `FieldValidation.requiredCondition?: FieldCondition` (in entrambe le app)
  - `risolviRiferimentiCondizioni` che rimappa anche `validation.requiredCondition`
  - portal `requiredEffettivo(campo: { validation?: { required?: boolean; requiredCondition?: FieldCondition } }, values: Record<string, unknown>): boolean`

- [ ] **Step 1: Aggiungere `requiredCondition` a `FieldValidation` (office)**

In `citta-semplice-office/src/components/form-builder/types.ts`, aggiungere il campo all'interfaccia `FieldValidation`:

```ts
export interface FieldValidation {
  required?: boolean;
  /** Se presente, il campo è obbligatorio solo quando questa condizione è vera. */
  requiredCondition?: FieldCondition;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}
```

`FieldCondition` è già definita più sopra nello stesso file: nessun import da aggiungere.

- [ ] **Step 2: Estendere `risolviRiferimentiCondizioni` (office)**

In `citta-semplice-office/src/components/form-builder/types.ts`, sostituire l'intera funzione `risolviRiferimentiCondizioni` con:

```ts
export function risolviRiferimentiCondizioni(fields: FormField[]): FormField[] {
  const nomiPerId = new Map(fields.filter((f) => f?.id).map((f) => [f.id, f.name]));

  // Risolve una singola condizione: rimappa `fieldName` dal `fieldId` corrente.
  // `orfana` segnala una sorgente cancellata (condizione da rimuovere).
  const risolvi = (
    cond: FieldCondition | undefined,
  ): { value: FieldCondition | undefined; orfana: boolean } => {
    if (!cond?.fieldId) return { value: cond, orfana: false };
    const nome = nomiPerId.get(cond.fieldId);
    if (!nome) return { value: undefined, orfana: true };
    return { value: nome === cond.fieldName ? cond : { ...cond, fieldName: nome }, orfana: false };
  };

  return fields.map((field) => {
    let next = field;

    const vis = risolvi(field.condition);
    if (vis.orfana) next = { ...next, condition: undefined };
    else if (vis.value !== field.condition) next = { ...next, condition: vis.value };

    const rc = field.validation?.requiredCondition;
    if (rc) {
      const req = risolvi(rc);
      if (req.orfana) {
        next = { ...next, validation: { ...next.validation, requiredCondition: undefined } };
      } else if (req.value !== rc) {
        next = { ...next, validation: { ...next.validation, requiredCondition: req.value } };
      }
    }

    return next;
  });
}
```

- [ ] **Step 3: Replicare le stesse modifiche nel portale (`form-pages.ts`)**

In `citta-semplice-portal/src/lib/form-pages.ts`, aggiungere il campo a `FieldValidation`:

```ts
export interface FieldValidation {
  required?: boolean;
  /** Se presente, il campo è obbligatorio solo quando questa condizione è vera. */
  requiredCondition?: FieldCondition;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
}
```

`FieldCondition` è già importata in cima al file (`import { FieldCondition } from './form-condition';`).

Poi sostituire l'intera funzione `risolviRiferimentiCondizioni` con la versione che usa `campi`/`campo`:

```ts
export function risolviRiferimentiCondizioni(campi: FormField[]): FormField[] {
  const nomiPerId = new Map(campi.filter((c) => c?.id).map((c) => [c.id, c.name]));

  const risolvi = (
    cond: FieldCondition | undefined,
  ): { value: FieldCondition | undefined; orfana: boolean } => {
    if (!cond?.fieldId) return { value: cond, orfana: false };
    const nome = nomiPerId.get(cond.fieldId);
    if (!nome) return { value: undefined, orfana: true };
    return { value: nome === cond.fieldName ? cond : { ...cond, fieldName: nome }, orfana: false };
  };

  return campi.map((campo) => {
    let next = campo;

    const vis = risolvi(campo.condition);
    if (vis.orfana) next = { ...next, condition: undefined };
    else if (vis.value !== campo.condition) next = { ...next, condition: vis.value };

    const rc = campo.validation?.requiredCondition;
    if (rc) {
      const req = risolvi(rc);
      if (req.orfana) {
        next = { ...next, validation: { ...next.validation, requiredCondition: undefined } };
      } else if (req.value !== rc) {
        next = { ...next, validation: { ...next.validation, requiredCondition: req.value } };
      }
    }

    return next;
  });
}
```

- [ ] **Step 4: Aggiungere `requiredEffettivo` (portal `form-condition.ts`)**

In `citta-semplice-portal/src/lib/form-condition.ts`, in fondo al file, aggiungere:

```ts
/**
 * Obbligo effettivo di un campo sui valori correnti: obbligatorio sempre
 * (`required === true`) oppure solo quando `requiredCondition` è vera. Non
 * tiene conto della visibilità: il chiamante applica l'obbligo ai soli campi
 * visibili.
 */
export function requiredEffettivo(
  campo: { validation?: { required?: boolean; requiredCondition?: FieldCondition } },
  values: Record<string, unknown>,
): boolean {
  if (campo.validation?.required === true) return true;
  const rc = campo.validation?.requiredCondition;
  return rc?.fieldName ? evaluateCondition(rc, values) : false;
}
```

`FieldCondition` e `evaluateCondition` sono già definite nello stesso file.

- [ ] **Step 5: Typecheck di entrambe le app**

Run: `npm run build:office`
Expected: build completata senza errori TypeScript.

Run: `npm run build:portal`
Expected: build completata senza errori TypeScript.

- [ ] **Step 6: Commit**

```bash
git add citta-semplice-office/src/components/form-builder/types.ts \
        citta-semplice-portal/src/lib/form-pages.ts \
        citta-semplice-portal/src/lib/form-condition.ts
git commit -m "feat(form-builder): modello requiredCondition e requiredEffettivo"
```

---

## Task 2: Valore predefinito radio/select — editor e preview (office)

Espone nell'editor un selettore "Valore predefinito" per radio e select, e lo mostra preselezionato nella preview.

**Files:**
- Modify: `citta-semplice-office/src/components/form-builder/field-editor.tsx`
- Modify: `citta-semplice-office/src/components/form-builder/form-preview.tsx`

**Interfaces:**
- Consumes: `FormField.defaultValue`, `FormField.options` (già esistenti).

- [ ] **Step 1: Aggiungere il selettore "Valore predefinito" nell'editor**

In `citta-semplice-office/src/components/form-builder/field-editor.tsx`, dentro il blocco `{hasOptions && ( ... )}` (le "Opzioni"), subito **dopo** il `</div>` che chiude quel blocco, aggiungere un nuovo blocco:

```tsx
      {/* Valore predefinito per select/radio */}
      {hasOptions && (
        <div className="mb-3">
          <label className="form-label small fw-bold">Valore predefinito</label>
          <select
            className="form-select form-select-sm"
            value={field.defaultValue ?? ''}
            onChange={(e) => handleChange('defaultValue', e.target.value || undefined)}
          >
            <option value="">-- Nessuno --</option>
            {field.options?.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label || o.value} ({o.value})
              </option>
            ))}
          </select>
          <small className="text-muted">Opzione preselezionata all'apertura del modulo.</small>
        </div>
      )}
```

- [ ] **Step 2: Preselezionare il default nella preview (radio + select)**

In `citta-semplice-office/src/components/form-builder/form-preview.tsx`, nel `case 'radio':`, cambiare l'attributo `checked` dell'input radio da:

```tsx
                  checked={values[field.name] === opt.value}
```
a:
```tsx
                  checked={(values[field.name] ?? field.defaultValue) === opt.value}
```

Nello stesso file, nel `case 'select':`, cambiare l'attributo `value` del `<select>` da:

```tsx
              value={values[field.name] ?? ''}
```
a:
```tsx
              value={values[field.name] ?? field.defaultValue ?? ''}
```

- [ ] **Step 3: Typecheck office**

Run: `npm run build:office`
Expected: build senza errori TypeScript.

- [ ] **Step 4: Verifica manuale**

Run: `npm run dev:office` e aprire il form builder di un servizio.
Verificare:
1. Aggiungere un campo **Radio**: compare il selettore "Valore predefinito" con le opzioni del campo. Scegliendo un'opzione, nella preview quel radio risulta già selezionato.
2. Aggiungere un campo **Select**: idem, la preview mostra l'opzione preselezionata.
3. Impostare "-- Nessuno --": nessuna opzione preselezionata nella preview.

- [ ] **Step 5: Commit**

```bash
git add citta-semplice-office/src/components/form-builder/field-editor.tsx \
        citta-semplice-office/src/components/form-builder/form-preview.tsx
git commit -m "feat(form-builder): valore predefinito per radio e select"
```

---

## Task 3: Valore predefinito radio/select — rendering portale

Il valore predefinito definito nel builder deve risultare preselezionato quando il cittadino apre il modulo, senza sovrascrivere i dati di una bozza ripresa.

**Files:**
- Modify: `citta-semplice-portal/src/components/istanza/ModuloStep.tsx`

**Interfaces:**
- Consumes: `FormField.defaultValue`, `parseCampi` (già esistenti).

- [ ] **Step 1: Calcolare i valori iniziali con i default dello schema**

In `citta-semplice-portal/src/components/istanza/ModuloStep.tsx`, dentro il componente, subito **dopo** la riga `const campi = parseCampi(servizio.attributi);`, aggiungere:

```tsx
  // Valori predefiniti di radio/select dello schema. I dati salvati (bozza)
  // vincono sempre sul default.
  const defaultDaSchema = Object.fromEntries(
    campi
      .filter((c) => (c.type === 'radio' || c.type === 'select') && c.defaultValue)
      .map((c) => [c.name, c.defaultValue as string]),
  );
  const valoriIniziali = { ...defaultDaSchema, ...dati };
```

- [ ] **Step 2: Usare `valoriIniziali` come defaultValues di react-hook-form**

Nello stesso file, nella chiamata `useForm({ ... })`, cambiare:

```tsx
    defaultValues: dati as Record<string, string | boolean>,
```
in:
```tsx
    defaultValues: valoriIniziali as Record<string, string | boolean>,
```

- [ ] **Step 3: Typecheck portal**

Run: `npm run build:portal`
Expected: build senza errori TypeScript.

- [ ] **Step 4: Verifica manuale**

Predisporre un servizio con un campo radio/select che ha un valore predefinito impostato (dal builder in office).
Run: `npm run dev:portal`, aprire la compilazione istanza di quel servizio.
Verificare:
1. All'apertura, il radio/select mostra l'opzione predefinita già selezionata.
2. Andare avanti/inviare senza toccare il campo: nel riepilogo il valore predefinito è presente.
3. Riprendere una **bozza** in cui quel campo aveva un valore diverso: viene mostrato il valore della bozza, non il default.

- [ ] **Step 5: Commit**

```bash
git add citta-semplice-portal/src/components/istanza/ModuloStep.tsx
git commit -m "feat(portal): preselezione valore predefinito radio/select nel modulo"
```

---

## Task 4: Obbligatorietà a 3 stati + estrazione `ConditionBuilder` (office)

Estrae il builder di condizione in un componente condiviso e sostituisce la checkbox "Campo obbligatorio" con tre stati (Mai / Sempre / Solo se…). L'asterisco della preview diventa dinamico. La sezione Visibilità deve continuare a comportarsi identica.

**Files:**
- Create: `citta-semplice-office/src/components/form-builder/condition-builder.tsx`
- Modify: `citta-semplice-office/src/components/form-builder/field-editor.tsx`
- Modify: `citta-semplice-office/src/components/form-builder/form-preview.tsx`

**Interfaces:**
- Produces: `ConditionBuilder` component
  ```ts
  interface ConditionBuilderProps {
    condition: FieldCondition;
    candidateFields: FormField[];
    onChange: (condition: FieldCondition) => void;
  }
  ```
- Consumes (Task 1): `FieldValidation.requiredCondition`.

- [ ] **Step 1: Creare il componente `ConditionBuilder`**

Creare `citta-semplice-office/src/components/form-builder/condition-builder.tsx` con:

```tsx
'use client';

import { FormField, FieldCondition, ConditionOperator } from './types';

interface ConditionBuilderProps {
  condition: FieldCondition;
  candidateFields: FormField[];
  onChange: (condition: FieldCondition) => void;
}

/**
 * Editor di una singola condizione (campo sorgente + operatore + valore).
 * Estratto dalla sezione Visibilità per essere riusato dall'Obbligatorietà.
 * Identifica la sorgente per `fieldId` (stabile alla rinomina), tenendo
 * allineato `fieldName` con cui i valori sono indicizzati a runtime.
 */
export function ConditionBuilder({ condition, candidateFields, onChange }: ConditionBuilderProps) {
  const operator = condition.operator ?? 'equals';
  const needsValue = operator === 'equals' || operator === 'not_equals';

  const sorgente =
    candidateFields.find((f) => f.id === condition.fieldId) ??
    candidateFields.find((f) => f.name && f.name === condition.fieldName);

  const setCondition = (patch: Partial<FieldCondition>) =>
    onChange({
      fieldId: condition.fieldId,
      fieldName: condition.fieldName ?? '',
      operator: condition.operator ?? 'equals',
      value: condition.value,
      ...patch,
    });

  const setSorgente = (id: string) => {
    const f = candidateFields.find((c) => c.id === id);
    // Cambiare campo sorgente invalida il valore atteso.
    setCondition({ fieldId: f?.id, fieldName: f?.name ?? '', value: '' });
  };

  if (candidateFields.length === 0) {
    return (
      <small className="text-muted">
        Aggiungi altri campi al form per usare le condizioni.
      </small>
    );
  }

  return (
    <>
      <div className="mb-2">
        <label className="form-label small">Campo</label>
        <select
          className="form-select form-select-sm"
          value={sorgente?.id ?? ''}
          onChange={(e) => setSorgente(e.target.value)}
        >
          <option value="">-- Seleziona campo --</option>
          {candidateFields.map((f) => (
            <option key={f.id} value={f.id}>
              {f.name || `(${f.type} senza nome)`}
              {f.label ? ` — ${f.label}` : ''}
            </option>
          ))}
        </select>
        {sorgente && !sorgente.name && (
          <small className="text-danger">
            Il campo selezionato non ha un Nome Campo (ID): assegnaglielo,
            altrimenti la condizione non può essere valutata.
          </small>
        )}
      </div>

      <div className="mb-2">
        <label className="form-label small">Condizione</label>
        <select
          className="form-select form-select-sm"
          value={operator}
          onChange={(e) => setCondition({ operator: e.target.value as ConditionOperator })}
        >
          <option value="equals">è uguale a</option>
          <option value="not_equals">è diverso da</option>
          <option value="not_empty">non è vuoto</option>
          <option value="empty">è vuoto</option>
        </select>
      </div>

      {needsValue && (
        <div className="mb-2">
          <label className="form-label small">Valore</label>
          {sorgente?.options?.length ? (
            <select
              className="form-select form-select-sm"
              value={condition.value ?? ''}
              onChange={(e) => setCondition({ value: e.target.value })}
            >
              <option value="">-- Seleziona valore --</option>
              {sorgente.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label || o.value} ({o.value})
                </option>
              ))}
            </select>
          ) : sorgente?.type === 'checkbox' ? (
            <select
              className="form-select form-select-sm"
              value={condition.value ?? ''}
              onChange={(e) => setCondition({ value: e.target.value })}
            >
              <option value="">-- Seleziona valore --</option>
              <option value="true">Selezionato</option>
              <option value="false">Non selezionato</option>
            </select>
          ) : (
            <input
              type="text"
              className="form-control form-control-sm"
              value={condition.value ?? ''}
              onChange={(e) => setCondition({ value: e.target.value })}
              placeholder="Valore atteso..."
            />
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Importare `ConditionBuilder` e `FieldValidation`; lift di `candidateFields`**

In `citta-semplice-office/src/components/form-builder/field-editor.tsx`:

Aggiungere `FieldValidation` all'import dei tipi (già si importa da `./types`):
```tsx
import {
  FormField,
  FieldOption,
  FieldCondition,
  FieldValidation,
  ConditionOperator,
  CONTAINER_TYPE,
  catenaContenitori,
} from './types';
import { ConditionBuilder } from './condition-builder';
```

Nel corpo del componente `FieldEditor`, **dopo** la definizione di `handleOptionsChange` e prima delle costanti `isInputField`, aggiungere due helper condivisi:

```tsx
  const setValidation = (patch: Partial<FieldValidation>) =>
    onUpdate({ ...field, validation: { ...field.validation, ...patch } });

  // Campi utilizzabili come sorgente di una condizione (visibilità o obbligo).
  const candidateFields = allFields.filter(
    (f) =>
      f.id !== field.id &&
      !['heading', 'section', 'paragraph', 'divider', 'pagebreak', 'hidden'].includes(f.type),
  );
```

- [ ] **Step 3: Sostituire la checkbox obbligatorio con i 3 stati**

Nel blocco Validazione, sostituire l'intero `div.form-check` che contiene la checkbox `id="required"` (la checkbox "Campo obbligatorio") con:

```tsx
          <div className="mb-3">
            <label className="form-label small fw-bold d-block">Obbligatorietà</label>
            {(() => {
              const mode: 'never' | 'always' | 'conditional' = field.validation?.requiredCondition
                ? 'conditional'
                : field.validation?.required
                  ? 'always'
                  : 'never';
              const setMode = (m: 'never' | 'always' | 'conditional') => {
                if (m === 'never') setValidation({ required: false, requiredCondition: undefined });
                else if (m === 'always') setValidation({ required: true, requiredCondition: undefined });
                else
                  setValidation({
                    required: false,
                    requiredCondition: { fieldName: '', operator: 'equals', value: '' },
                  });
              };
              return (
                <>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_never"
                      name="requiredMode"
                      checked={mode === 'never'}
                      onChange={() => setMode('never')}
                    />
                    <label className="form-check-label" htmlFor="req_never">Mai</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_always"
                      name="requiredMode"
                      checked={mode === 'always'}
                      onChange={() => setMode('always')}
                    />
                    <label className="form-check-label" htmlFor="req_always">Sempre</label>
                  </div>
                  <div className="form-check">
                    <input
                      type="radio"
                      className="form-check-input"
                      id="req_conditional"
                      name="requiredMode"
                      checked={mode === 'conditional'}
                      onChange={() => setMode('conditional')}
                    />
                    <label className="form-check-label" htmlFor="req_conditional">Solo se…</label>
                  </div>
                  {mode === 'conditional' && (
                    <div className="mt-2 ps-3 border-start">
                      <ConditionBuilder
                        condition={field.validation!.requiredCondition!}
                        candidateFields={candidateFields}
                        onChange={(c) => setValidation({ requiredCondition: c })}
                      />
                    </div>
                  )}
                </>
              );
            })()}
          </div>
```

- [ ] **Step 4: Rifattorizzare la sezione Visibilità per usare `ConditionBuilder`**

Nella IIFE della "Visibilità Condizionale", rimuovere le variabili locali ora inutili (`operator`, `needsValue`, `sorgente`, `setCondition`, `setSorgente`) e il markup dei tre `<select>`, delegando a `ConditionBuilder`. Sostituire l'intera IIFE `{(() => { ... })()}` della Visibilità con:

```tsx
      {/* Conditional Visibility */}
      {(() => {
        const hasCondition = !!field.condition;

        return (
          <>
            <hr />
            <h6 className="mb-3">Visibilità Condizionale</h6>
            {field.type === CONTAINER_TYPE && (
              <p className="text-muted small">
                La condizione di una sezione si applica anche a tutti i campi che le
                appartengono.
              </p>
            )}
            <div className="form-check mb-3">
              <input
                type="checkbox"
                className="form-check-input"
                id="enableCondition"
                checked={hasCondition}
                onChange={(e) =>
                  onUpdate({
                    ...field,
                    condition: e.target.checked
                      ? { fieldName: '', operator: 'equals', value: '' }
                      : undefined,
                  })
                }
              />
              <label className="form-check-label" htmlFor="enableCondition">
                Mostra solo se...
              </label>
            </div>

            {hasCondition && (
              <ConditionBuilder
                condition={field.condition!}
                candidateFields={candidateFields}
                onChange={(c) => onUpdate({ ...field, condition: c })}
              />
            )}
          </>
        );
      })()}
```

Nota: la variabile `candidateFields` ora è quella liftata allo Step 2. Il messaggio "Aggiungi altri campi al form per usare le condizioni." è gestito internamente da `ConditionBuilder`.

- [ ] **Step 5: Asterisco dinamico nella preview**

In `citta-semplice-office/src/components/form-builder/form-preview.tsx`, aggiungere un helper locale subito **dopo** la funzione `evaluateCondition` (fuori dal componente):

```tsx
function requiredEffettivo(field: FormField, values: Record<string, string>): boolean {
  if (field.validation?.required === true) return true;
  const rc = field.validation?.requiredCondition;
  return rc?.fieldName ? evaluateCondition(rc, values) : false;
}
```

Poi, dentro `renderField`, cambiare la riga:

```tsx
    const requiredMark = field.validation?.required ? (
```
in:
```tsx
    const requiredMark = requiredEffettivo(field, values) ? (
```

- [ ] **Step 6: Typecheck e lint office**

Run: `npm run build:office`
Expected: build senza errori TypeScript.

Run: `npm run lint`
Expected: nessun errore di lint sui file modificati.

- [ ] **Step 7: Verifica manuale**

Run: `npm run dev:office`, aprire il form builder.
Verificare:
1. **Regressione Visibilità**: un campo con "Mostra solo se…" continua a funzionare identico a prima (selezione campo/operatore/valore, preview che nasconde/mostra).
2. **Obbligo Mai/Sempre**: impostando "Sempre" compare l'asterisco `*` accanto all'etichetta in preview; "Mai" lo rimuove.
3. **Obbligo Solo se…**: selezionando "Solo se…" compare il builder di condizione. Impostando p.es. `altro_campo è uguale a X`, in preview l'asterisco `*` appare solo quando `altro_campo` vale X.

- [ ] **Step 8: Commit**

```bash
git add citta-semplice-office/src/components/form-builder/condition-builder.tsx \
        citta-semplice-office/src/components/form-builder/field-editor.tsx \
        citta-semplice-office/src/components/form-builder/form-preview.tsx
git commit -m "feat(form-builder): obbligatorietà a 3 stati e ConditionBuilder condiviso"
```

---

## Task 5: Obbligatorietà condizionata — validazione portale (client + server)

Rende operativo l'obbligo condizionato nel rendering del cittadino: schema client, controllo dinamico al cambio pagina, asterisco dinamico e rivalidazione server non aggirabile.

**Files:**
- Modify: `citta-semplice-portal/src/components/istanza/ModuloStep.tsx`
- Modify: `citta-semplice-portal/src/lib/form-validate.ts`

**Interfaces:**
- Consumes (Task 1): `requiredEffettivo`, `FieldValidation.requiredCondition`.

- [ ] **Step 1: Importare `requiredEffettivo` in ModuloStep**

In `citta-semplice-portal/src/components/istanza/ModuloStep.tsx`, aggiornare l'import da `@/lib/form-condition`:

```tsx
import { hasVisibilityRule, isFieldVisible, requiredEffettivo } from '@/lib/form-condition';
```

- [ ] **Step 2: Escludere i campi con `requiredCondition` dall'obbligo dello schema base**

Nella funzione `buildSchema`, cambiare la riga:

```tsx
    const required = (campo.validation?.required ?? false) && !hasVisibilityRule(campo);
```
in:
```tsx
    const required =
      (campo.validation?.required ?? false) &&
      !hasVisibilityRule(campo) &&
      !campo.validation?.requiredCondition;
```

- [ ] **Step 3: Generalizzare il controllo dinamico in `validate()`**

Nel corpo di `validate` (dentro `useImperativeHandle`), sostituire l'intero blocco `for (const campo of campiPagina) { ... }` che gestisce i campi condizionali con:

```tsx
      // Valida l'obbligo effettivo (visibilità + requiredCondition) dei campi
      // che non sono obbligatori "puri" nello schema base.
      let conditionalValid = true;
      for (const campo of campiPagina) {
        if (LAYOUT_FIELD_TYPES.has(campo.type) || campo.type === 'hidden') continue;
        const dinamico =
          (hasVisibilityRule(campo) && campo.validation?.required) ||
          !!campo.validation?.requiredCondition;
        if (!dinamico) continue;

        const richiesto =
          isFieldVisible(campo, currentValues) && requiredEffettivo(campo, currentValues);
        if (richiesto) {
          const val = currentValues[campo.name];
          const isEmpty =
            val === undefined ||
            val === null ||
            val === '' ||
            (campo.type === 'checkbox' && val !== true) ||
            (campo.type === 'file' && (!val || (val as FileList).length === 0));
          if (isEmpty) {
            setError(campo.name as string, { message: 'Campo obbligatorio' });
            conditionalValid = false;
          } else {
            clearErrors(campo.name as string);
          }
        } else {
          clearErrors(campo.name as string);
        }
      }
```

(Mantiene la dichiarazione `let conditionalValid = true;` — non duplicarla se già presente: questa sostituzione la include.)

- [ ] **Step 4: Asterisco dinamico nel rendering**

In `renderField`, cambiare:

```tsx
    const requiredMark = campo.validation?.required ? (
```
in:
```tsx
    const requiredMark = requiredEffettivo(campo, values as Record<string, unknown>) ? (
```

(`const values = watch();` è già definito prima di `renderField`.)

- [ ] **Step 5: Usare `requiredEffettivo` nella validazione server**

In `citta-semplice-portal/src/lib/form-validate.ts`, aggiornare l'import in cima:

```tsx
import { isFieldVisible, requiredEffettivo } from './form-condition';
```

Cambiare la firma di `validaCampo` per ricevere i valori e calcolare l'obbligo effettivo:

```tsx
function validaCampo(campo: FormField, valore: string, valori: Record<string, string>): string | null {
  const etichetta = campo.label || campo.name;
  const required = requiredEffettivo(campo, valori);
```

(Rimuovere la vecchia riga `const required = campo.validation?.required ?? false;`.)

Aggiornare la chiamata dentro `validaDatiModulo` da:

```tsx
    const errore = validaCampo(campo, valore);
```
a:
```tsx
    const errore = validaCampo(campo, valore, valori);
```

- [ ] **Step 6: Typecheck e lint portal**

Run: `npm run build:portal`
Expected: build senza errori TypeScript.

Run: `npm run lint`
Expected: nessun errore di lint sui file modificati.

- [ ] **Step 7: Verifica manuale (client e server)**

Predisporre un servizio con un campo `note` impostato su "Solo se… `tipo_richiesta è uguale a altro`" (dal builder office).
Run: `npm run dev:portal`, aprire la compilazione.
Verificare:
1. Con `tipo_richiesta` ≠ `altro`: il campo `note` non ha asterisco e l'invio/avanzamento pagina procede anche se `note` è vuoto.
2. Con `tipo_richiesta` = `altro`: compare l'asterisco; lasciando `note` vuoto, l'avanzamento/invio è bloccato con "Campo obbligatorio".
3. **Server non aggirabile**: inviare (p.es. via richiesta diretta alla server action, o disabilitando la validazione client dai devtools) con `tipo_richiesta = altro` e `note` vuoto → la validazione server restituisce errore e l'istanza non viene accettata.
4. **Regressione**: un modulo esistente senza `requiredCondition` si comporta come prima (obbligo semplice e visibilità invariati).

- [ ] **Step 8: Commit**

```bash
git add citta-semplice-portal/src/components/istanza/ModuloStep.tsx \
        citta-semplice-portal/src/lib/form-validate.ts
git commit -m "feat(portal): obbligatorietà condizionata nel modulo (client + server)"
```

---

## Note di verifica finale (dopo tutti i task)

- Build completa: `npm run build` (office + portal).
- Un modulo che usa **entrambe** le feature insieme (radio con default + campo obbligatorio "solo se" quel radio ha un certo valore) si comporta coerentemente: il default preseleziona il radio e, se il default soddisfa la condizione, il campo dipendente risulta subito obbligatorio.
