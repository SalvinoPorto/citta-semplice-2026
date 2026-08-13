import { prisma } from '@/lib/db/prisma';
import { whereStato } from '@citta/db';

export const MSG_SOGLIA_DEFAULT = 'Il numero massimo di istanze è stato raggiunto';

export const MSG_UNICO_INVIO_PER_UTENTE = 'Hai già inviato una richiesta per questo servizio';

/**
 * Stati che consumano il diritto a presentare l'istanza.
 *
 * Una RESPINTA non lo consuma: l'iter si è chiuso senza dare al cittadino quel
 * che chiedeva, quindi può ripresentare. Vale per ENTRAMBE le regole di
 * unicità — `unicoInvio` (per beneficiario) e `unicoInvioPerUtente` (per
 * account) — che prima rispondevano in modo opposto sullo stesso caso.
 *
 * Le bozze non contano: non sono mai state inviate.
 */
const STATI_CHE_BLOCCANO_IL_REINVIO = ['IN_LAVORAZIONE', 'CONCLUSA'] as const;

/**
 * Insieme DIVERSO, e volutamente: `numeroMaxIstanze` è una quota di capienza
 * (quante istanze il servizio può lavorare), non un diritto individuale. Una
 * respinta ha comunque occupato un posto ed è stata istruita, quindi resta
 * conteggiata. Se anche questa dovesse ignorare le respinte è una decisione a
 * sé, che cambia quante istanze un servizio accetta.
 */
const STATI_CONTEGGIATI_NELLA_QUOTA = ['IN_LAVORAZIONE', 'CONCLUSA', 'RESPINTA'] as const;

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
    where: { servizioId: servizio.id, ...whereStato([...STATI_CONTEGGIATI_NELLA_QUOTA]) },
  });
  return count >= servizio.numeroMaxIstanze;
}

/**
 * `unicoInvioPerUtente`: il CITTADINO LOGGATO può inviare una sola istanza per
 * questo servizio, identificato dal suo account (quindi dal codice fiscale, che
 * è la chiave univoca di `Utente` ed è ciò con cui si autentica).
 *
 * Differenza rispetto a `verificaUnicoInvio`: qui conta CHI INVIA, lì conta CHI
 * BENEFICIA. Un CAF che presenta istanze per cento cittadini diversi viene
 * bloccato da questa regola dopo la prima, e non da quella.
 *
 * Stava inline in `submitIstanza`, lontana dall'altra regola di unicità: è così
 * che le due hanno finito per usare insiemi di stati diversi senza che si
 * notasse. Ritorna il messaggio di errore, oppure null se l'invio è ammesso.
 *
 * Dipende solo da chi è loggato, quindi è nota PRIMA che il cittadino compili
 * il modulo: la chiamano anche la scheda servizio (per non mostrare il pulsante)
 * e la pagina di compilazione (che rimanda indietro). `submitIstanza` la
 * richiama comunque — le pagine sono cortesia, il controllo che conta è quello
 * al momento della scrittura.
 */
export async function verificaUnicoInvioPerUtente(
  servizio: { id: number; unicoInvioPerUtente: boolean },
  utenteId: number,
): Promise<string | null> {
  if (!servizio.unicoInvioPerUtente) return null;

  const esistente = await prisma.istanza.findFirst({
    where: {
      servizioId: servizio.id,
      utenteId,
      ...whereStato([...STATI_CHE_BLOCCANO_IL_REINVIO]),
    },
    select: { id: true },
  });

  return esistente ? MSG_UNICO_INVIO_PER_UTENTE : null;
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
 * Le istanze respinte non bloccano, le bozze nemmeno: vedi
 * STATI_CHE_BLOCCANO_IL_REINVIO.
 *
 * Ritorna il messaggio di errore, oppure null se l'invio è ammesso.
 */
export async function verificaUnicoInvio(
  servizio: { id: number; unicoInvio: boolean; campiUnicoInvio: string | null },
  datiRaw: string | null | undefined,
): Promise<string | null> {
  if (!servizio.unicoInvio) return null;

  // `unicoInvio` attivo senza `campiUnicoInvio` è una configurazione incompleta,
  // non "regola disattivata": l'amministratore ha acceso il flag credendo di
  // aver messo un vincolo che non esiste. Il portale non può bloccare l'invio
  // per un errore di configurazione, ma non deve nemmeno tacere — office ora lo
  // impedisce in validazione (servizioSchema), questo copre i servizi salvati
  // prima di quel controllo.
  const campi = (servizio.campiUnicoInvio ?? '').split(',').map((c) => c.trim()).filter(Boolean);
  if (campi.length === 0) {
    console.warn(
      `[unicoInvio] servizio ${servizio.id}: flag attivo ma campiUnicoInvio vuoto, nessun vincolo applicato`,
    );
    return null;
  }

  const dati = parseDati(datiRaw);
  const tupla = campi.map((campo) => dati.find((d) => d.name === campo));

  // Se anche un solo campo della tupla manca o è vuoto il beneficiario non è
  // identificabile: non si può bloccare l'invio.
  if (tupla.some((d) => !d || normalizza(d.value) === '')) return null;
  const valori = tupla.map((d) => normalizza(d!.value));

  // Prefiltro in SQL su `istanze.ricerca`, che contiene già i valori del modulo
  // normalizzati in minuscolo (trigger `ricerca_su_istanza`). Restringe i
  // candidati senza caricare tutte le istanze del servizio.
  //
  // Prima il prefiltro era su `dati`, cioè sul JSON grezzo, e portava due
  // problemi che qui spariscono:
  //   - andava applicato solo ai valori che JSON.stringify lascia invariati,
  //     perché virgolette e backslash rompevano il match: `ricerca` non ha
  //     escaping JSON, quindi il filtro non serve più;
  //   - `dati contains` non è indicizzabile e costringeva al Seq Scan.
  //
  // Restano esclusi i valori NON scalari (multi-select): Postgres li rende come
  // `["a","b"]` mentre `normalizza` in JS produce `a,b`. Prefiltrarli darebbe
  // zero candidati e lascerebbe passare un duplicato — meglio non prefiltrare e
  // lasciare il lavoro al confronto esatto qui sotto, che è comunque quello che
  // decide. (Il vecchio codice aveva lo stesso buco, mascherato dal filtro su
  // JSON.stringify.)
  const prefiltro = tupla
    .filter((d) => typeof d!.value !== 'object')
    .map((d) => ({ ricerca: { contains: normalizza(d!.value) } }));

  const candidate = await prisma.istanza.findMany({
    where: {
      servizioId: servizio.id,
      ...whereStato([...STATI_CHE_BLOCCANO_IL_REINVIO]),
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
