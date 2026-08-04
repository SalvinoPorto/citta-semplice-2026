import { SKIP_FIELD_TYPES, type FormField } from './types';

/** Tipi di layout che nel riepilogo diventano titoli di sezione. */
const TITLE_FIELD_TYPES = new Set<string>(['heading', 'section']);

/** Riga di riepilogo: titolo di sezione oppure campo compilato. */
export type VoceRiepilogo =
  | { kind: 'titolo'; label: string }
  | { kind: 'campo'; name: string; label: string; value: string };

/**
 * Intreccia i titoli di sezione dello schema con i valori compilati: il
 * riepilogo e il PDF mostrano così il contesto delle informazioni invece di un
 * elenco piatto di campi.
 *
 * `valore` restituisce null per i campi da omettere (nascosti da una condizione
 * o assenti dai dati salvati); i titoli rimasti senza campi vengono scartati,
 * perché una sezione non applicabile non deve comparire. Un titolo resta in
 * sospeso solo finché ne arriva uno annidato (`parentId`): gli altri, non
 * seguiti da alcun campo, cadono.
 */
export function costruisciRiepilogo(
  campi: FormField[],
  valore: (campo: FormField) => { label: string; value: string } | null,
): VoceRiepilogo[] {
  const voci: VoceRiepilogo[] = [];
  const titoliInSospeso: FormField[] = [];

  for (const campo of campi) {
    if (!campo) continue;

    if (TITLE_FIELD_TYPES.has(campo.type)) {
      while (
        titoliInSospeso.length > 0 &&
        titoliInSospeso[titoliInSospeso.length - 1].id !== campo.parentId
      ) {
        titoliInSospeso.pop();
      }
      if ((campo.label ?? '').trim()) titoliInSospeso.push(campo);
      continue;
    }
    if (SKIP_FIELD_TYPES.has(campo.type)) continue;

    const dato = valore(campo);
    if (!dato) continue;

    for (const titolo of titoliInSospeso) voci.push({ kind: 'titolo', label: titolo.label.trim() });
    titoliInSospeso.length = 0;
    voci.push({ kind: 'campo', name: campo.name, label: dato.label, value: dato.value });
  }

  return voci;
}
