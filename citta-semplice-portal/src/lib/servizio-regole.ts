import { prisma } from '@/lib/db/prisma';

export const MSG_SOGLIA_DEFAULT = 'Il numero massimo di istanze è stato raggiunto';

/**
 * Verifica se il servizio ha raggiunto la quota massima di istanze (`numeroMaxIstanze`).
 * Le bozze non sono conteggiate.
 */
export async function sogliaIstanzeRaggiunta(servizio: {
  id: number;
  numeroMaxIstanze: number | null;
}): Promise<boolean> {
  if (!servizio.numeroMaxIstanze || servizio.numeroMaxIstanze <= 0) return false;
  const count = await prisma.istanza.count({
    where: { servizioId: servizio.id, inBozza: false },
  });
  return count >= servizio.numeroMaxIstanze;
}

type DatoConLabel = { name: string; label?: string; value: unknown };

function parseDati(datiRaw: string | null | undefined): DatoConLabel[] {
  if (!datiRaw) return [];
  try {
    const parsed = JSON.parse(datiRaw);
    return Array.isArray(parsed) ? (parsed as DatoConLabel[]) : [];
  } catch {
    return [];
  }
}

const normalizza = (v: unknown) => String(v ?? '').trim().toLowerCase();

/**
 * `unicoInvio`: il beneficiario dell'istanza — identificato dalla tupla di campi
 * elencati in `campiUnicoInvio` (name separati da virgola) — può comparire una
 * sola volta per questo servizio, a prescindere da chi invia (delegato, CAF...).
 *
 * Il match è su TUTTI i campi della tupla: due beneficiari diversi che condividono
 * un singolo valore (es. il cognome) restano ammessi.
 *
 * Come nel legacy, le istanze respinte non bloccano; le bozze nemmeno.
 *
 * Ritorna il messaggio di errore, oppure null se l'invio è ammesso.
 */
export async function verificaUnicoInvio(
  servizio: { id: number; unicoInvio: boolean; campiUnicoInvio: string | null },
  datiRaw: string | null | undefined,
): Promise<string | null> {
  if (!servizio.unicoInvio || !servizio.campiUnicoInvio) return null;

  const campi = servizio.campiUnicoInvio.split(',').map((c) => c.trim()).filter(Boolean);
  if (campi.length === 0) return null;

  const dati = parseDati(datiRaw);
  const tupla = campi.map((campo) => dati.find((d) => d.name === campo));

  // Se anche un solo campo della tupla manca o è vuoto il beneficiario non è
  // identificabile: non si può bloccare l'invio.
  if (tupla.some((d) => !d || normalizza(d.value) === '')) return null;
  const valori = tupla.map((d) => normalizza(d!.value));

  // Prefiltro in SQL sul JSON grezzo: restringe i candidati senza caricare tutte
  // le istanze del servizio. Applicabile solo ai valori che JSON.stringify lascia
  // invariati (niente virgolette/backslash), altrimenti il substring non matcha.
  const prefiltro = valori
    .filter((v) => JSON.stringify(v) === `"${v}"`)
    .map((v) => ({ dati: { contains: v, mode: 'insensitive' as const } }));

  const candidate = await prisma.istanza.findMany({
    where: {
      servizioId: servizio.id,
      inBozza: false,
      respinta: false,
      ...(prefiltro.length > 0 ? { AND: prefiltro } : {}),
    },
    select: { dati: true },
  });

  const duplicata = candidate.some((istanza) => {
    const esistenti = parseDati(istanza.dati);
    return campi.every((campo, i) => {
      const dato = esistenti.find((d) => d.name === campo);
      return dato !== undefined && normalizza(dato.value) === valori[i];
    });
  });

  if (!duplicata) return null;

  const etichette = tupla.map((d) => d!.label || d!.name).join(', ');
  return `Esiste già una richiesta per questo servizio con gli stessi dati (${etichette}).`;
}
