import { CONTAINER_TYPE, type FieldCondition, type FormField, type FormPage } from './types';

/**
 * Riscrive le condizioni che puntano al campo sorgente per `fieldId`,
 * valorizzandone il `fieldName` corrente: a runtime i valori del form sono
 * indicizzati per nome. Le condizioni dei moduli più vecchi, prive di
 * `fieldId`, restano invariate.
 */
export function risolviRiferimentiCondizioni(campi: FormField[]): FormField[] {
  const nomiPerId = new Map(campi.filter((c) => c?.id).map((c) => [c.id, c.name]));

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

/**
 * Propaga la condizione di visibilità dei contenitori (`section`) ai campi che
 * vi appartengono tramite `parentId`, risalendo l'intera catena di contenitori.
 * Le condizioni ereditate si sommano in AND a quella propria del campo: un
 * campo dentro una sezione nascosta resta nascosto.
 */
export function risolviGerarchia(campi: FormField[]): FormField[] {
  const contenitori = new Map(
    campi.filter((c) => c?.id && c.type === CONTAINER_TYPE).map((c) => [c.id, c]),
  );
  if (contenitori.size === 0) return campi;

  return campi.map((campo) => {
    const ereditate: FieldCondition[] = [];
    const visti = new Set<string>([campo.id]);
    let padre = campo.parentId ? contenitori.get(campo.parentId) : undefined;
    // `visti` protegge da cicli in schemi malformati (A dentro B dentro A).
    while (padre && !visti.has(padre.id)) {
      visti.add(padre.id);
      if (padre.condition?.fieldName) ereditate.unshift(padre.condition);
      padre = padre.parentId ? contenitori.get(padre.parentId) : undefined;
    }
    return ereditate.length > 0 ? { ...campo, conditions: ereditate } : campo;
  });
}

/** Catena di contenitori di un campo, dal più esterno al più interno. */
export function catenaContenitori(campo: FormField, campi: FormField[]): FormField[] {
  const contenitori = new Map(
    campi.filter((c) => c?.id && c.type === CONTAINER_TYPE).map((c) => [c.id, c]),
  );
  const catena: FormField[] = [];
  const visti = new Set<string>([campo.id]);
  let padre = campo.parentId ? contenitori.get(campo.parentId) : undefined;
  while (padre && !visti.has(padre.id)) {
    visti.add(padre.id);
    catena.unshift(padre);
    padre = padre.parentId ? contenitori.get(padre.parentId) : undefined;
  }
  return catena;
}

/**
 * Campi dello schema di un servizio, sia in formato `{fields:[...]}` che array
 * piatto. Prima i riferimenti (fieldId → fieldName), poi la propagazione ai
 * contenuti: così le condizioni ereditate sono già risolte.
 */
export function parseCampi(attributi: string | null | undefined): FormField[] {
  if (!attributi) return [];
  try {
    const parsed = JSON.parse(attributi);
    const campi = Array.isArray(parsed) ? parsed : parsed?.fields;
    if (!Array.isArray(campi)) return [];
    return risolviGerarchia(risolviRiferimentiCondizioni(campi as FormField[]));
  } catch {
    return [];
  }
}

/**
 * Divide un elenco piatto di campi in pagine usando i campi `pagebreak` come
 * separatori. Uno schema senza pagebreak produce una sola pagina: i moduli
 * esistenti continuano a funzionare senza modifiche.
 */
export function splitPages(campi: FormField[]): FormPage[] {
  const pages: FormPage[] = [{ titolo: '', fields: [] }];
  for (const campo of campi) {
    if (campo.type === 'pagebreak') {
      pages.push({ titolo: campo.label, fields: [] });
    } else {
      pages[pages.length - 1].fields.push(campo);
    }
  }
  // Un pagebreak a inizio/fine schema o due consecutivi non devono generare
  // pagine vuote; se restano zero pagine si torna a una pagina unica.
  const piene = pages.filter((p) => p.fields.length > 0);
  return piene.length > 0 ? piene : [{ titolo: '', fields: [] }];
}
