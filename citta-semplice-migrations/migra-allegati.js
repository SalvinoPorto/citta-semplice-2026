/**
 * Import dei file allegati dal filesystem legacy all'object storage (Garage).
 *
 * Da lanciare DOPO migrate-dati.js, sul database di destinazione già popolato.
 *
 * COSA RISOLVE
 *   Nel legacy i file stanno in LEGACY_DIR/YYYY/MM/DD/<hash>, ma `nome_hash`
 *   in database contiene solo <hash>. Le app nuove leggono dallo storage la
 *   chiave `nome_hash` così com'è: solo il download dell'office ricostruisce
 *   la cartella dalla data, mentre portal e risposte alle comunicazioni
 *   risponderebbero 404. Lo script carica ogni file con chiave YYYY/MM/DD/<hash>
 *   e riscrive `nome_hash` con quella chiave: da lì in poi una sola lettura
 *   funziona ovunque.
 *
 * COME LO FA
 *   1. Indicizza LEGACY_DIR per nome file: un hash si trova anche se la sua
 *      cartella non coincide con la data in database (scarti di fuso a
 *      mezzanotte, file spostati a mano).
 *   2. Per ogni riga di `allegati` e `allegati_risposta` sceglie il file,
 *      calcola la chiave, lo carica su S3 con Content-MD5 (lo storage rifiuta
 *      un upload arrivato corrotto) e il Content-Type da `mime_type`.
 *   3. Aggiorna `nome_hash` a blocchi, con UPDATE condizionato al valore
 *      precedente: una riga cambiata nel frattempo non viene toccata.
 *
 * RILANCIABILE
 *   Un oggetto già presente con la stessa dimensione non viene ricaricato, e
 *   le righe già normalizzate risultano "già a posto". Se migrate-dati.js viene
 *   rilanciato (riscrive gli hash corti), basta rilanciare anche questo: rifà
 *   solo gli UPDATE.
 *
 * Uso:
 *   npm install
 *   npm run migra-allegati -- --prova        # nessuna scrittura: solo report
 *   npm run migra-allegati
 *
 * Opzioni:
 *   --prova            non carica e non aggiorna il database
 *   --concorrenza=N    upload in parallelo (default 8, o ALLEGATI_CONCORRENZA)
 *
 * Esito: exit 0 se ogni riga ha il suo oggetto su storage, 1 altrimenti.
 * Il dettaglio di mancanti, ambigui ed errori finisce in report-allegati-*.csv,
 * i file su disco non referenziati da nessuna riga in orfani-allegati-*.txt.
 */

import { Client } from 'pg';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { opendir, readFile, stat } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── configurazione ────────────────────────────────────────────────────────────
// Stessa precedenza di migrate-dati.js: ambiente reale > .env.local > .env

for (const nome of ['.env.local', '.env']) {
  const percorso = fileURLToPath(new URL(nome, import.meta.url));
  if (existsSync(percorso)) process.loadEnvFile(percorso);
}

const argomenti = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? 'true'];
  }),
);

const PROVA = argomenti.has('prova');
const CONCORRENZA = Math.max(
  1,
  parseInt(argomenti.get('concorrenza') ?? process.env.ALLEGATI_CONCORRENZA ?? '8', 10),
);
const BLOCCO_UPDATE = 500;

function obbligatoria(nome) {
  const valore = process.env[nome];
  if (!valore) {
    console.error(`Variabile ${nome} mancante (vedi .env.example).`);
    process.exit(1);
  }
  return valore;
}

const LEGACY_DIR = obbligatoria('LEGACY_DIR');
const S3_BUCKET = obbligatoria('S3_BUCKET');
// Come in @citta/storage: prefisso normalizzato, e la chiave in database NON
// lo contiene.
const S3_PREFIX = (process.env.S3_PREFIX ?? '').split('/').filter(Boolean).join('/');

const dstConfig = {
  host: process.env.DST_HOST || 'localhost',
  port: parseInt(process.env.DST_PORT || '5432', 10),
  database: process.env.DST_DATABASE || 'citta_semplice',
  user: process.env.DST_USER || 'io_user',
  password: process.env.DST_PASSWORD,
};

const s3 = new S3Client({
  endpoint: obbligatoria('S3_ENDPOINT'),
  // Garage verifica la region della firma: deve coincidere con s3_region.
  region: process.env.S3_REGION || 'garage',
  forcePathStyle: true,
  credentials: {
    accessKeyId: obbligatoria('S3_ACCESS_KEY_ID'),
    secretAccessKey: obbligatoria('S3_SECRET_ACCESS_KEY'),
  },
});

// ── chiavi ────────────────────────────────────────────────────────────────────

const DATA_IN_CHIAVE = /^\d{4}\/\d{2}\/\d{2}\//;

/** Stessa normalizzazione di @citta/storage (percorso.ts): backslash, segmenti vuoti, `..`. */
function normalizzaChiave(valore) {
  const segmenti = String(valore).replace(/\\/g, '/').split('/').filter(Boolean);
  if (segmenti.length === 0 || segmenti.some((s) => s === '.' || s === '..') || valore.includes('\0')) {
    throw new Error(`chiave non valida: "${valore}"`);
  }
  return segmenti.join('/');
}

function chiaveS3(chiave) {
  return S3_PREFIX ? `${S3_PREFIX}/${chiave}` : chiave;
}

// ── 1. indice del filesystem legacy ───────────────────────────────────────────

async function indicizza(radice) {
  console.log(`\n── Indicizzazione di ${radice}`);
  const perNome = new Map(); // nome file -> [percorso relativo con /]
  let totale = 0;

  async function visita(cartella) {
    for await (const voce of await opendir(cartella)) {
      const percorso = join(cartella, voce.name);
      if (voce.isDirectory()) {
        await visita(percorso);
      } else if (voce.isFile()) {
        const rel = relative(radice, percorso).split(sep).join('/');
        const elenco = perNome.get(voce.name);
        if (elenco) elenco.push(rel);
        else perNome.set(voce.name, [rel]);
        if (++totale % 100000 === 0) console.log(`  ${totale} file…`);
      }
    }
  }

  await visita(radice);
  console.log(`File trovati: ${totale}`);
  return { perNome, totale };
}

// ── 2. piano: quale file per ogni riga ────────────────────────────────────────

async function leggiRighe(db) {
  // to_char lavora sul valore memorizzato: la data è quella "da orologio a muro"
  // con cui il legacy ha creato la cartella, senza passare dal fuso di Node.
  const { rows } = await db.query(`
    SELECT 'allegati' AS tabella, id, nome_hash, mime_type,
           to_char(data_inserimento, 'YYYY/MM/DD') AS giorno
      FROM allegati
    UNION ALL
    -- Nessuna data per le risposte: risposte_comunicazioni.created_at è il
    -- momento dell'import (migrate-dati non lo valorizza), non quello legacy.
    -- Il file si trova per nome nell'indice.
    SELECT 'allegati_risposta', id, nome_hash, mime_type, NULL
      FROM allegati_risposta
     ORDER BY 1, 2
  `);
  return rows;
}

function pianifica(riga, indice) {
  let normalizzato;
  try {
    normalizzato = normalizzaChiave(riga.nome_hash);
  } catch (err) {
    return { esito: 'errore', dettaglio: err.message };
  }

  const nome = normalizzato.split('/').pop();
  const candidati = indice.perNome.get(nome) ?? [];

  if (candidati.length === 0) {
    return { esito: 'mancante', dettaglio: `nessun file "${nome}" sotto LEGACY_DIR` };
  }

  // Scelta del file: il percorso esatto se nome_hash ne contiene già uno, poi
  // quello nella cartella della data, altrimenti l'unico candidato.
  const attesoDaData = riga.giorno ? `${riga.giorno}/${nome}` : null;
  const file =
    candidati.find((c) => c === normalizzato) ??
    (attesoDaData && candidati.find((c) => c === attesoDaData)) ??
    (candidati.length === 1 ? candidati[0] : null);

  if (!file) {
    return { esito: 'ambiguo', dettaglio: `${candidati.length} file "${nome}": ${candidati.join(' | ')}` };
  }

  // Chiave: quella già completa in database, altrimenti la posizione legacy se
  // ha la forma YYYY/MM/DD/<hash>, altrimenti la data della riga.
  let chiave;
  if (DATA_IN_CHIAVE.test(normalizzato)) chiave = normalizzato;
  else if (DATA_IN_CHIAVE.test(file) && file.split('/').length === 4) chiave = file;
  else if (attesoDaData) chiave = attesoDaData;
  else return { esito: 'errore', dettaglio: `impossibile ricavare la data per ${file}` };

  return { esito: 'pronto', file, chiave, aggiornaDb: chiave !== riga.nome_hash };
}

// ── 3. upload ────────────────────────────────────────────────────────────────

async function carica(piano, riga) {
  const percorso = join(LEGACY_DIR, ...piano.file.split('/'));
  const { size } = await stat(percorso);
  const Key = chiaveS3(piano.chiave);

  try {
    const testa = await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key }));
    if (testa.ContentLength === size) return 'già presente';
  } catch (err) {
    if (err?.$metadata?.httpStatusCode !== 404) throw err;
  }

  if (PROVA) return 'da caricare';

  const dati = await readFile(percorso);
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key,
      Body: dati,
      ContentLength: dati.length,
      ContentMD5: createHash('md5').update(dati).digest('base64'),
      ContentType: riga.mime_type || 'application/octet-stream',
    }),
  );
  return 'caricato';
}

// ── 4. aggiornamento database a blocchi ──────────────────────────────────────

async function aggiornaBlocco(db, tabella, blocco) {
  if (PROVA || blocco.length === 0) return 0;
  const { rowCount } = await db.query(
    `UPDATE ${tabella} AS t
        SET nome_hash = v.nuovo
       FROM unnest($1::int[], $2::text[], $3::text[]) AS v(id, nuovo, vecchio)
      WHERE t.id = v.id AND t.nome_hash = v.vecchio`,
    [blocco.map((b) => b.id), blocco.map((b) => b.nuovo), blocco.map((b) => b.vecchio)],
  );
  return rowCount;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`Import allegati${PROVA ? ' — MODALITÀ PROVA, nessuna scrittura' : ''}`);
  console.log(`Sorgente: ${LEGACY_DIR}`);
  console.log(`Destinazione: s3://${S3_BUCKET}/${S3_PREFIX} + ${dstConfig.database}@${dstConfig.host}`);

  const db = new Client(dstConfig);
  await db.connect();

  const indice = await indicizza(LEGACY_DIR);
  const righe = await leggiRighe(db);
  console.log(`\n── Righe in database: ${righe.length}`);

  const orario = new Date().toISOString().replace(/[:.]/g, '-');
  const report = createWriteStream(fileURLToPath(new URL(`report-allegati-${orario}.csv`, import.meta.url)));
  report.write('tabella;id;nome_hash;esito;dettaglio\n');
  const segnala = (riga, esito, dettaglio) =>
    report.write(`${riga.tabella};${riga.id};${riga.nome_hash};${esito};"${String(dettaglio).replace(/"/g, '""')}"\n`);

  const conteggi = { caricato: 0, 'già presente': 0, 'da caricare': 0, mancante: 0, ambiguo: 0, errore: 0 };
  const usati = new Set();
  const updates = { allegati: [], allegati_risposta: [] };
  let aggiornate = 0;
  let daAggiornare = 0;
  let giaAPosto = 0;
  let fatte = 0;

  // Pool di worker sullo stesso array: nessuna dipendenza esterna.
  let prossima = 0;
  async function lavoratore() {
    while (prossima < righe.length) {
      const riga = righe[prossima++];
      const piano = pianifica(riga, indice);

      if (piano.esito !== 'pronto') {
        conteggi[piano.esito]++;
        segnala(riga, piano.esito, piano.dettaglio);
      } else {
        usati.add(piano.file);
        let caricato = false;
        try {
          conteggi[await carica(piano, riga)]++;
          caricato = true;
        } catch (err) {
          conteggi.errore++;
          segnala(riga, 'errore', err?.message ?? err);
        }
        // nome_hash cambia solo se l'oggetto è su storage. Un errore del
        // database qui NON è per riga: interrompe tutto (rilanciabile).
        if (caricato && piano.aggiornaDb) {
          daAggiornare++;
          const coda = updates[riga.tabella];
          coda.push({ id: riga.id, nuovo: piano.chiave, vecchio: riga.nome_hash });
          if (coda.length >= BLOCCO_UPDATE) aggiornate += await aggiornaBlocco(db, riga.tabella, coda.splice(0));
        } else if (caricato) {
          giaAPosto++;
        }
      }

      if (++fatte % 1000 === 0) console.log(`  ${fatte}/${righe.length}…`);
    }
  }

  await Promise.all(Array.from({ length: CONCORRENZA }, lavoratore));
  for (const [tabella, coda] of Object.entries(updates)) {
    aggiornate += await aggiornaBlocco(db, tabella, coda.splice(0));
  }
  await new Promise((fine) => report.end(fine));

  // File su disco che nessuna riga usa: allegati di istanze non importate o
  // residui. Non vengono caricati; l'elenco serve a decidere cosa farne.
  const orfani = [];
  for (const elenco of indice.perNome.values()) {
    for (const rel of elenco) if (!usati.has(rel)) orfani.push(rel);
  }
  if (orfani.length > 0) {
    const fileOrfani = fileURLToPath(new URL(`orfani-allegati-${orario}.txt`, import.meta.url));
    const out = createWriteStream(fileOrfani);
    for (const rel of orfani) out.write(`${rel}\n`);
    await new Promise((fine) => out.end(fine));
  }

  await db.end();

  const problemi = conteggi.mancante + conteggi.ambiguo + conteggi.errore;
  console.log('\n── Esito');
  console.log(`  caricati:              ${conteggi.caricato}`);
  console.log(`  già presenti su S3:    ${conteggi['già presente']}`);
  if (PROVA) console.log(`  da caricare:           ${conteggi['da caricare']}`);
  console.log(`  nome_hash aggiornati:  ${PROVA ? `0 (prova, da aggiornare: ${daAggiornare})` : aggiornate}`);
  console.log(`  nome_hash già a posto: ${giaAPosto}`);
  console.log(`  mancanti:              ${conteggi.mancante}`);
  console.log(`  ambigui:               ${conteggi.ambiguo}`);
  console.log(`  errori:                ${conteggi.errore}`);
  console.log(`  file orfani su disco:  ${orfani.length}`);
  if (problemi > 0) console.log(`\nDettaglio in report-allegati-${orario}.csv`);

  process.exit(problemi > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('\n✗ Import interrotto:', err);
  process.exit(1);
});
