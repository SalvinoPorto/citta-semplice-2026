# Form builder: valore predefinito (radio/select) e obbligatorietà condizionata

Data: 2026-07-23

## Contesto

Il form builder di `citta-semplice-office` produce uno schema JSON (`Servizio.attributi`)
che il portale `citta-semplice-portal` rende al cittadino. I tipi `FormField` sono
**duplicati** tra le due app e i commenti nel codice richiedono che restino allineati:

- office: `citta-semplice-office/src/components/form-builder/types.ts`
- portal: `citta-semplice-portal/src/lib/form-pages.ts` + `form-condition.ts`

La validazione dei dati inviati è **doppia**: client (`ModuloStep` con react-hook-form +
zod) e server (`form-validate.ts`, non aggirabile). Esistono già:

- `defaultValue` su `FormField`, usato oggi solo per i campi `hidden`.
- Una `condition` di **visibilità** condizionale, con un builder UI (campo sorgente +
  operatore + valore) scritto inline nel `field-editor`.
- Una obbligatorietà già condizionata *sulla visibilità*: un campo dentro una sezione
  nascosta non è richiesto (`hasVisibilityRule` in `buildSchema`).

## Obiettivi

1. **Valore predefinito per radio e select**: l'operatore sceglie quale opzione risulta
   preselezionata; il valore preselezionato viene inviato con l'istanza.
2. **Obbligatorietà condizionata sul valore di un altro campo**: un campo può essere
   richiesto sempre, mai, oppure **solo se** un altro campo soddisfa una condizione, a
   parità di visibilità.

## Non-obiettivi

- Non si unificano i tipi duplicati tra office e portal (refactor rischioso, fuori scope):
  le modifiche al modello dati si rispecchiano in entrambe le app.
- Nessun cambiamento allo schema del database (`attributi` resta JSON libero).
- Nessuna migrazione dati: i moduli esistenti senza i nuovi campi continuano a funzionare
  invariati (campi opzionali, assenza = comportamento attuale).

## Decisioni prese

- Valore predefinito applicato a **radio e select** (stesso meccanismo).
- Modello dell'obbligo a **tre stati**: Mai / Sempre / Solo se…
- Il builder di condizione viene **estratto in un componente condiviso**, usato sia dalla
  sezione Visibilità sia dalla nuova sezione Obbligatorietà.

---

## Feature 1 — Valore predefinito (radio + select)

### Modello dati

Riuso del campo esistente `FormField.defaultValue`. Nessun nuovo campo.

### Editor (`field-editor.tsx`, office)

Nel blocco `hasOptions` (select/radio), sotto "Opzioni", aggiungere un `<select>`
"Valore predefinito" popolato da `field.options` più un'opzione "-- Nessuno --". Scrive
`field.defaultValue`. Se il valore predefinito non è più tra le opzioni (opzione
rinominata/rimossa), il `<select>` mostra "-- Nessuno --" ma **non** azzera silenziosamente
`defaultValue` salvato; l'operatore lo ricorregge scegliendone uno valido.

### Preview (`form-preview.tsx`, office)

- radio: `checked={(values[field.name] ?? field.defaultValue) === opt.value}`
- select: `value={values[field.name] ?? field.defaultValue ?? ''}`

Stesso pattern già usato dagli input testuali (`values[name] ?? field.defaultValue ?? ''`).

### Rendering (`ModuloStep.tsx`, portal)

Calcolare i valori iniziali del form come merge `{ ...defaultDaSchema, ...dati }`, dove
`defaultDaSchema` raccoglie `defaultValue` dei soli campi radio/select che lo hanno. I
dati salvati/bozza (`dati`) vincono sempre sul default. Passare il merge a `defaultValues`
di react-hook-form. Il default fluisce nei dati salvati tramite il `useEffect(onChangeDati)`
esistente.

### Validazione server

Nessuna modifica necessaria: il valore predefinito arriva già nei dati inviati come un
valore qualunque.

---

## Feature 2 — Obbligatorietà condizionata

### Modello dati

Aggiungere a `FieldValidation`:

```ts
requiredCondition?: FieldCondition;
```

Mappatura dei tre stati dell'editor:

| Stato editor | `validation.required` | `validation.requiredCondition` |
|---|---|---|
| Mai         | `false` (o assente) | assente |
| Sempre      | `true`  | assente |
| Solo se…    | `false` | valorizzata |

### Required effettivo (runtime)

```
requiredEffettivo(campo, valori) =
  campo.validation?.required === true
  || (campo.validation?.requiredCondition
      && evaluateCondition(campo.validation.requiredCondition, valori))
```

Un campo **non visibile** non è mai richiesto (comportamento attuale invariato): il
controllo di obbligo si applica solo ai campi visibili.

### Risoluzione riferimenti

`requiredCondition` usa `fieldId` come la condizione di visibilità e va risolto in
`fieldName` a runtime. Estendere `risolviRiferimentiCondizioni` in **entrambe** le app
perché rimappi anche `validation.requiredCondition`, oltre a `field.condition`. Se il campo
sorgente è stato cancellato (`fieldId` non risolvibile), la `requiredCondition` viene
rimossa (il campo torna non-obbligatorio), coerentemente con come oggi si tratta una
`condition` di visibilità orfana.

### Editor (`field-editor.tsx`, office)

Sostituire la checkbox "Campo obbligatorio" con tre radio: **Mai / Sempre / Solo se…**.
Selezionando "Solo se…" compare il builder di condizione (componente condiviso).

**Estrazione componente condiviso**: il builder inline attuale della sezione "Visibilità
Condizionale" (selettore campo sorgente + operatore + input/`select` valore, con la logica
`fieldId`↔`fieldName` e le varianti per opzioni/checkbox) viene estratto in un componente
riutilizzabile (es. `ConditionBuilder`) che riceve la condizione corrente, la lista dei
campi candidati e una callback `onChange`. Usato sia da Visibilità sia da Obbligatorietà.
Il comportamento della sezione Visibilità deve restare identico a prima.

### Validazione client (`ModuloStep.tsx`, portal)

- `buildSchema`: un campo con `requiredCondition` resta **opzionale** nello schema base
  (come già avviene per i campi con regola di visibilità). La condizione perché un campo
  sia richiesto nello schema base diventa: `required === true && !hasVisibilityRule &&
  !requiredCondition`.
- `validate()`: il controllo dinamico oggi limitato a "richiesto se visibile" viene
  generalizzato a "richiesto se **visibile** e **required-effettivo**". Il loop già esiste;
  cambia la condizione d'ingresso (non più solo `hasVisibilityRule && required`, ma anche i
  campi con `requiredCondition`) e il test di obbligo usa `requiredEffettivo`.

### Validazione server (`form-validate.ts`, portal)

`validaDatiModulo` valuta già la visibilità sui valori ricevuti. In `validaCampo`,
sostituire `campo.validation?.required` con `requiredEffettivo(campo, valori)`. È il punto
non aggirabile e determinante. La firma di `validaCampo` va estesa per ricevere `valori`
(o il required effettivo già calcolato dal chiamante, che ha `valori` in scope).

### Asterisco `*`

Dinamico dove i valori sono reattivi: preview (office) e `ModuloStep` (portal) mostrano `*`
quando `requiredEffettivo` è al momento vero. Un campo "Solo se…" con condizione non ancora
soddisfatta non mostra l'asterisco finché non lo diventa.

---

## Helper condivisi da introdurre

- **portal** `form-condition.ts`: `requiredEffettivo(campo, valori)` che riusa
  `evaluateCondition`. Usato da `ModuloStep` (client) e da `form-validate` (server).
- **office**: un equivalente locale per la preview (i valori sono `Record<string,string>`),
  oppure inline nella preview, dato che office e portal non condividono codice.

## Punti di sincronizzazione office ↔ portal

| Modifica | office | portal |
|---|---|---|
| `requiredCondition` nel tipo `FieldValidation` | `types.ts` | `form-pages.ts` |
| `risolviRiferimentiCondizioni` rimappa `requiredCondition` | `types.ts` | `form-pages.ts` |
| helper `requiredEffettivo` | preview (locale) | `form-condition.ts` |

## Rischi e casi limite

- **Sorgente della `requiredCondition` invisibile**: la condizione si valuta sui valori
  correnti a prescindere dalla visibilità del campo sorgente (coerente con la visibilità).
- **`requiredCondition` che punta a un campo che diventa richiesto solo dopo un pagebreak**:
  la validazione client valida solo la pagina corrente; il server rivalida tutto. Se il
  campo sorgente è in una pagina precedente il suo valore è disponibile. Se fosse in una
  pagina successiva la condizione risulterebbe valutata su valore vuoto: comportamento
  accettabile (raro e non regressivo), non gestito specificamente.
- **Retrocompatibilità**: assenza di `requiredCondition` = comportamento odierno. Moduli
  esistenti invariati.

## Criteri di verifica

- Un radio/select con valore predefinito risulta preselezionato in preview e in portale, e
  il valore è presente nei dati inviati anche senza interazione del cittadino.
- Un campo "Solo se…" non blocca l'invio quando la condizione è falsa e lo blocca quando è
  vera, sia lato client sia lato server (test: inviare bypassando il client).
- La sezione Visibilità continua a funzionare identica dopo l'estrazione del builder.
- Moduli esistenti (senza i nuovi campi) si comportano come prima.
