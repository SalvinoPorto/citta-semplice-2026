#!/usr/bin/env node

/**
 * migrate-dati.js
 *
 * Conversione del database legacy (io_db) verso lo schema corrente
 * (citta_semplice), definito da packages/db/prisma/schema.prisma.
 *
 * Punti in cui i due schemi NON si corrispondono, e come sono risolti:
 *   - istanze: i booleani in_bozza/conclusa/respinta sono diventati l'enum
 *     stato_istanza (20260805100000 + contrazione)
 *   - workflows → istanza_attivita, workflow_fasi → istanza_fasi, e le colonne
 *     allegati.workflow_id / pagamenti_attesi.workflow_id → attivita_id
 *     (20260807120000)
 *   - workflows.stato → completata_at IS NULL; workflows.operatore_id, che
 *     aveva doppia semantica, si è separato in istanza_attivita.completata_da_id
 *     (chi ha chiuso) e istanze.assegnatario_id (chi ha in carico) — 20260807110000
 *   - istanze.attivita_corrente_id e assegnatario_id sono mantenute da TRIGGER:
 *     vedi le note in main() sull'ordine vincolante dei passi 12a/12b/12c
 *
 * L'intero import gira in una sola transazione: al primo errore non gestito,
 * ROLLBACK totale. La destinazione viene azzerata in testa (utenti esclusa),
 * quindi lo script è rilanciabile.
 *
 * Uso:
 *   npm install
 *   npm run migrate-dati
 */

import { Client } from 'pg';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// ── caricamento file .env ─────────────────────────────────────────────────────
// Lo script legge la configurazione da process.env, ma nessuno popolava
// process.env: senza questo blocco cadeva sui default (localhost/io_db) e
// sulle password undefined, con un errore di connessione che non diceva perché.
//
// `process.loadEnvFile` (Node ≥ 20.12) NON sovrascrive le variabili già
// presenti nell'ambiente — verificato — quindi la precedenza è determinata
// dall'ordine di caricamento:
//
//   ambiente reale  >  .env.local  >  .env
//
// cioè si può forzare un singolo valore per un lancio senza toccare i file
// (`DST_DATABASE=prova npm run migrate-dati`), e .env.local (non versionato,
// con le credenziali) vince su .env (eventuali default condivisi).
//
// I percorsi sono risolti rispetto a QUESTO file, non alla cwd: lo script deve
// funzionare anche lanciato da un'altra directory.
function caricaEnv() {
  if (typeof process.loadEnvFile !== 'function') {
    console.error(`Node ${process.version} non espone process.loadEnvFile (serve ≥ 20.12).`);
    console.error('In alternativa: node --env-file=.env.local migrate-dati.js');
    process.exit(1);
  }

  const caricati = [];
  for (const nome of ['.env.local', '.env']) {
    const percorso = fileURLToPath(new URL(nome, import.meta.url));
    if (!existsSync(percorso)) continue;
    process.loadEnvFile(percorso);
    caricati.push(nome);
  }

  if (caricati.length === 0) {
    console.warn('⚠ Nessun file .env.local o .env trovato: uso i valori di default.');
    console.warn('  Copia .env.example in .env.local e compilalo.');
  } else {
    console.log(`Configurazione da: ${caricati.join(', ')}`);
  }
}

caricaEnv();

// ── configurazione connessioni ────────────────────────────────────────────────

const srcConfig = {
  host: process.env.SRC_HOST || 'localhost',
  port: parseInt(process.env.SRC_PORT || '5432'),
  database: process.env.SRC_DATABASE || 'io_db',
  user: process.env.SRC_USER || 'io_user',
  password: process.env.SRC_PASSWORD,
};

const dstConfig = {
  host: process.env.DST_HOST || 'localhost',
  port: parseInt(process.env.DST_PORT || '5432'),
  database: process.env.DST_DATABASE || 'citta_semplice',
  user: process.env.DST_USER || 'io_user',
  password: process.env.DST_PASSWORD
};

// ── helper insert transazione-safe ────────────────────────────────────────────
// Esegue una query di scrittura dentro un SAVEPOINT: se fallisce, fa ROLLBACK
// solo di quella riga (non avvelena la transazione globale) e RILANCIA l'errore,
// così i try/catch per-riga esistenti continuano a contare ok/errori correttamente.
async function q(dst, sql, values) {
  await dst.query('SAVEPOINT sp');
  try {
    const res = await dst.query(sql, values);
    await dst.query('RELEASE SAVEPOINT sp');
    return res;
  } catch (err) {
    await dst.query('ROLLBACK TO SAVEPOINT sp');
    await dst.query('RELEASE SAVEPOINT sp');
    throw err;
  }
}

// ── sequenze ──────────────────────────────────────────────────────────────────
// Il nome della sequenza NON segue la tabella: `ALTER TABLE ... RENAME` rinomina
// solo la tabella, quindi dopo 20260807120000_rinomina_istanza_attivita la
// sequenza di `istanza_attivita` si chiama ancora `workflows_id_seq` e quella di
// `istanza_fasi` `workflow_fasi_id_seq`. `pg_get_serial_sequence` risolve il nome
// reale dal catalogo: immune a questa e a qualunque futura rinomina.
async function resetSequence(dst, table) {
  try {
    await dst.query(
      `SELECT setval(pg_get_serial_sequence($1, 'id'),
                     GREATEST((SELECT COALESCE(MAX(id), 0) FROM ${table}), 1))`,
      [table]
    );
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza ${table}: ${err.message}`);
  }
}

// ── introspezione sorgente ────────────────────────────────────────────────────
// Il legacy non è versionato in questo repo (citta_semplice.sql è un dump vecchio
// della DESTINAZIONE, non della sorgente): l'esistenza di una colonna va chiesta
// al catalogo invece di darla per scontata.
async function hasColumn(src, table, column) {
  const { rows } = await src.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
    [table, column]
  );
  return rows.length > 0;
}

// ── azzeramento destinazione ──────────────────────────────────────────────────
// Tutte le DELETE in testa, in ordine inverso di dipendenza. Prima erano sparse
// nelle singole funzioni, nell'ordine di IMPORT: `DELETE FROM servizi` girava
// prima di `DELETE FROM istanze`, ma istanze→servizio è Restrict, quindi al
// secondo lancio la transazione moriva sulla prima FK. Con l'azzeramento in testa
// lo script è rilanciabile.
//
// `utenti` è volutamente ESCLUSA: gli id sono generati e le istanze li risolvono
// per codice fiscale a ogni import, quindi conservarli non crea disallineamenti —
// e cancellarli distruggerebbe le anagrafiche create dal portale dopo l'import.
const TABELLE_DA_AZZERARE = [
  'allegati_risposta',
  'risposte_comunicazioni',
  'comunicazioni',
  'pagamenti_attesi',
  'allegati',
  'istanza_fasi',
  'istanza_attivita',
  'istanze',
  'pagamenti',
  'allegati_richiesti',
  'steps',
  'fasi',
  'operatori_servizi',
  'operatori_ruoli',
  'operatori',
  'servizi',
  'aree',
  'uffici',
  'ruoli',
  'enti',
];

async function resetDestinazione(dst) {
  console.log('\n── Azzeramento destinazione ──────────────────────────────────────');
  for (const tabella of TABELLE_DA_AZZERARE) {
    await dst.query(`DELETE FROM ${tabella}`);
  }
  console.log(`Svuotate ${TABELLE_DA_AZZERARE.length} tabelle (utenti conservata).`);
}

// ── helpers conversione dati ──────────────────────────────────────────────────

function generateId() {
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `field_${rand}`;
}

function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/* function findSelected(values) {
  if (!Array.isArray(values)) return undefined;
  const found = values.find(({ selected }) => selected);
  return found?.value;
} */

function convertDati(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    console.warn('  ⚠ campo dati non è JSON valido, lasciato invariato');
    return raw;
  }

  if (!Array.isArray(parsed) || parsed.length === 0) return raw;

  const first = parsed[0];

  // Già nel nuovo formato: oggetti con name/label/value ma senza type
  if (first && typeof first === 'object' && !Array.isArray(first) && first.name && !first.type) return raw;

  // Formato coppia chiave/valore: [["chiave", "valore"], ...]
  if (Array.isArray(first)) {
    const result = parsed.map(([name, value]) => ({
      name,
      label: name,
      value: value ?? '',
    }));
    return JSON.stringify(result);
  }

  // Vecchio formato HTML (array di oggetti con type)
  const result = parsed
    .filter(item => item.type !== 'paragraph')
    .flatMap(item => {
      // Checkbox: convertAttributes splitta il gruppo in un campo per valore
      // (name = slugify(label)). Qui emettiamo un'entry per OGNI valore selezionato
      // così i name combaciano con lo schema e non si perdono le multi-selezioni.
      if (item.type === 'checkbox') {
        return (item.values || [])
          .filter(v => v.selected)
          .map(v => ({ name: slugify(v.label), label: v.label, value: true }));
      }
      return [{
        name: item.name,
        label: item.label || '',
        value: item.value ?? '',
      }];
    });

  return JSON.stringify(result);
}

// ── conversione attributi modulo ──────────────────────────────────────────────

function convertAttributes(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    console.warn('  ⚠ campo attributes non è JSON valido, lasciato invariato');
    return raw;
  }

  // Già nel nuovo formato (ha la proprietà version)
  if (parsed && typeof parsed === 'object' && parsed.version) return raw;

  // Il vecchio formato è un array
  if (!Array.isArray(parsed)) return raw;

  const fields = parsed.flatMap(item => {
    // Checkbox → un campo checkbox separato per ogni valore
    if (item.type === 'checkbox') {
      return (item.values || []).map(v => ({
        id: generateId(),
        type: 'checkbox',
        name: slugify(v.label),
        label: v.label,
        validation: item.required ? { required: true } : {},
      }));
    }

    const field = {
      id: generateId(),
      type: item.type === 'phone' ? 'tel' : item.type,
      name: item.type === 'paragraph' ? 'paragraph' : item.name,
      label: item.type === 'paragraph'
        ? (item.placeholder || item.label || '')
        : (item.label || ''),
      validation: {},
    };

    if (item.type === 'radio') {
      field.options = item.values?.map(v => ({ value: v.value, label: v.label })) || [];
    } else
      if (item.type === 'autocomplete') {
        field.type = 'select';
        field.options = item.values?.map(v => ({ value: v.value, label: v.label })) || [];
      } else
        if (item.name === 'cf') {
          field.type = "text";
          field.validation = {
            "patternMessage": "Codice fiscale non valido",
            "pattern": "^[A-Z]{6}[0-9]{2}[A-Z][0-9]{2}[A-Z][0-9]{3}[A-Z]$"
          };
        }

    if (item.type !== 'paragraph') {
      if (item.required) field.validation.required = true;
      if (item.placeholder) field.placeholder = item.placeholder;
    }

    return field;
  });

  return JSON.stringify({ fields, version: '1.0' });
}

// ── migrazione enti SOLO CATANIA──────────────────────────────────────────────────

async function migrateEnti(src, dst) {
  console.log('\n── Migrazione enti ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    ente as nome, 
    descrizione, 
    codice, 
    true as attivo
    FROM enti 
    ORDER BY id LIMIT 1
    `);
  console.log(`Enti trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna ente da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO enti (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} enti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ente id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dell'ente per evitare conflitti con nuovi enti creati dopo la migrazione
  await resetSequence(dst, 'enti');
  console.log(`Enti: ${ok} OK, ${errors} errori`);
}

// ── migrazione aree ─────────────────────────────────────────────────────────

async function migrateAree(src, dst) {
  console.log('\n── Migrazione aree ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    descrizione, 
    icon as icona, 
    slug, 
    titolo as nome, 
    attivo as attiva, 
    ordine
    FROM aree 
    WHERE id_ente=1 AND privata=false
    ORDER BY id
    `);
  console.log(`Aree trovate: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna area da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO aree (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;

  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} aree migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su area id=${row.id}: ${err.message}`);
      errors++;
    }

  }
  // aggiorno il numero di sequenza dell'area per evitare conflitti con nuove aree create dopo la migrazione
  await resetSequence(dst, 'aree');

  console.log(`Aree: ${ok} OK, ${errors} errori`);
}

// ── migrazione servizi ─────────────────────────────────────────────────────────

async function migrateServizi(src, dst) {
  console.log('\n── Migrazione servizi ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT
    m.id,
    m.tipo as _modulo_tipo,
    s.titolo || COALESCE(' ' || NULLIF(m.name, ''), '') as titolo,
    s.sottotitolo as sotto_titolo,
    s.corpo as descrizione,
    s.requisiti as cosa_serve,
    m.corpo as altre_info,
    s.riferimento as contatti,
    s.slug || COALESCE('-' || NULLIF(m.slug, ''), '') as slug,
    s.id_area as area_id,
    s.attivo,
    m.attributes as attributi,
    m.data_inizio as data_inizio,
    m.data_fine as data_fine,
    m.data_inizio as updated_at,
    m.campi_in_evidenza as campi_in_evidenza,
    m.campi_da_esportare as campi_da_esportare,
    m.id_ufficio as ufficio_id,
    m.unico_invio,
    m.campi_unico_invio,
    m.unico_invio_per_utente,
    m.numero_max_istanze,
    m.avviso_soglia as msg_sopra_soglia,
    m.msg_extra_modulo as msg_extra_servizio,
    COALESCE(m.post_form_validation, false) as post_form_validation,
    m.post_form_validation_api,
    m.post_form_validation_fields
    FROM moduli m
    LEFT JOIN servizi s ON s.id=m.id_servizio
    WHERE s.id_area in (SELECT id FROM aree WHERE id_ente=1 AND privata=false) AND s.id IS NOT NULL
    ORDER BY m.id
    `);
  console.log(`Servizi trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun servizio da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]).filter(c => c !== '_modulo_tipo');
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO servizi (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      if (col === 'attributi') return row._modulo_tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} servizi migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su servizio id=${row.id}: ${err.message} ${JSON.stringify(values)}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei servizi per evitare conflitti con nuovi servizi creati dopo la migrazione
  await resetSequence(dst, 'servizi');

  console.log(`Servizi: ${ok} OK, ${errors} errori`);
}

// ── migrazione uffici ─────────────────────────────────────────────────────────

async function migrateUffici(src, dst) {
  console.log('\n── Migrazione uffici ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    descrizione, 
    nome
    FROM uffici 
    WHERE id_ente=1
    ORDER BY id
    `);
  console.log(`Uffici trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun ufficio da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO uffici (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} uffici migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ufficio id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli uffici per evitare conflitti con nuovi uffici creati dopo la migrazione
  await resetSequence(dst, 'uffici');

  console.log(`Uffici: ${ok} OK, ${errors} errori`);
}

// ── migrazione operatori ─────────────────────────────────────────────────────────

async function migrateOperatori(src, dst) {
  console.log('\n── Migrazione operatori ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT
    o.id,
    o.abilitato as attivo,
    o.cognome,
    o.nome,
    COALESCE(o.data_registrazione, NOW()) as created_at,
    COALESCE(o.data_registrazione, NOW()) as updated_at,
    o.email,
    o.operatore_id as user_name,
    o.passwd as password,
    -- L'ufficio dell'operatore è quello in cui lavora sulla MAGGIOR PARTE dei
    -- moduli assegnati. Prima era un LIMIT 1 senza ORDER BY: non deterministico,
    -- e su un operatore con moduli di più uffici l'esito cambiava fra un lancio
    -- e l'altro. La visibilità delle istanze dipende da questa colonna.
    (SELECT m.id_ufficio FROM operatori_moduli om
     JOIN moduli m ON m.id = om.modulo_id
     WHERE om.operatore_id = o.id AND m.id_ufficio IS NOT NULL
     GROUP BY m.id_ufficio
     ORDER BY COUNT(*) DESC, m.id_ufficio
     LIMIT 1) as ufficio_id
    FROM operatori o
    ORDER BY o.id
    `);
  console.log(`Operatori trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun operatore da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO operatori (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} operatori migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su operatore id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli operatori per evitare conflitti con nuovi operatori creati dopo la migrazione
  await resetSequence(dst, 'operatori');

  console.log(`Operatori: ${ok} OK, ${errors} errori`);
}

// ── migrazione ruoli ─────────────────────────────────────────────────────────

async function migrateRuoli(src, dst) {
  console.log('\n── Migrazione ruoli ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    nome
    FROM ruoli 
    ORDER BY id
    `);
  console.log(`Ruoli trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun ruolo da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO ruoli (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} ruoli migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ruolo id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei ruoli per evitare conflitti con nuovi ruoli creati dopo la migrazione
  await resetSequence(dst, 'ruoli');

  console.log(`Ruoli: ${ok} OK, ${errors} errori`);
}

// ── migrazione ruoli ─────────────────────────────────────────────────────────

async function migrateOperatoriRuoli(src, dst) {
  console.log('\n── Migrazione operatori_ruoli ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    operatori_id as operatore_id, 
    ruoli_id as ruolo_id
    FROM operatori_ruoli 
    `);
  console.log(`Operatori-Ruoli trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun operatore-ruolo da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    //.filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO operatori_ruoli (${colList})
    VALUES (${placeholders})
    ON CONFLICT (operatore_id, ruolo_id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} operatori-ruoli migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su operatore-ruolo id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Operatori-Ruoli: ${ok} OK, ${errors} errori`);
}

// ── migrazione operatori_servizi ──────────────────────────────────────────────
// Visibilità granulare operatore→servizio DENTRO il suo ufficio. Nel legacy la
// visibilità stava tutta su operatori_moduli; qui è a due livelli:
//   - operatori.ufficio_id  → l'ufficio di appartenenza
//   - operatori_servizi     → il sottoinsieme di servizi visibili nell'ufficio
// Lista VUOTA = tutti i servizi dell'ufficio (vedi Operatore.servizi nello
// schema). Senza questa tabella ogni operatore vedrebbe tutti i servizi del
// proprio ufficio, anche quelli che nel legacy non gli erano assegnati.
//
// Si migrano solo le assegnazioni verso servizi effettivamente importati: un
// modulo di un altro ente non esiste in destinazione e farebbe fallire la FK.
async function migrateOperatoriServizi(src, dst) {
  console.log('\n── Migrazione operatori_servizi ──────────────────────────────────');

  const { rows } = await src.query(`
    SELECT DISTINCT
      om.operatore_id,
      m.id AS servizio_id
    FROM operatori_moduli om
    JOIN moduli m ON m.id = om.modulo_id
    JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY om.operatore_id, m.id
  `);
  console.log(`Assegnazioni operatore-servizio trovate: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna assegnazione da migrare.');
    return;
  }

  const sql = `
    INSERT INTO operatori_servizi (operatore_id, servizio_id)
    VALUES ($1, $2)
    ON CONFLICT (operatore_id, servizio_id) DO NOTHING
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    try {
      await q(dst, sql, [row.operatore_id, row.servizio_id]);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} assegnazioni migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su operatore=${row.operatore_id} servizio=${row.servizio_id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Operatori-Servizi: ${ok} OK, ${errors} errori`);
}

// ── migrazione fasi ──────────────────────────────────────────────────────────
// Crea una fase unica per ogni servizio; la visibilità operatore→servizio
// è ora mediata dall'ufficio assegnato alla fase (Fase.ufficioId).

async function migrateFasi(src, dst) {
  console.log('\n── Migrazione fasi ────────────────────────────────────────────────');

  // A7: fasi.ufficio_id è NOT NULL. I servizi senza ufficio ricevono un ufficio
  // di default (il primo per id) così l'INSERT set-based non fallisce; l'admin
  // potrà riassegnare. Segnaliamo quanti servizi sono in questa condizione.
  const { rows: senzaUff } = await dst.query(
    `SELECT COUNT(*)::int AS n FROM servizi WHERE ufficio_id IS NULL`
  );
  if (senzaUff[0].n > 0) {
    console.warn(`  ⚠ ${senzaUff[0].n} servizi senza ufficio → fase assegnata all'ufficio di default (primo per id)`);
  }

  const result = await dst.query(`
    INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id)
    SELECT 'Competenza', 1, id, COALESCE(ufficio_id, (SELECT MIN(id) FROM uffici))
    FROM servizi
    ORDER BY id
    RETURNING id
  `);

  await resetSequence(dst, 'fasi');

  console.log(`Fasi: ${result.rowCount} create`);
}

// ── migrazione istanza_fasi ───────────────────────────────────────────────────
// Ex `workflow_fasi`, rinominata da 20260807120000_rinomina_istanza_attivita.

async function migrateIstanzaFasi(src, dst) {
  console.log('\n── Migrazione istanza_fasi ─────────────────────────────────────────');

  const result = await dst.query(`
    INSERT INTO istanza_fasi (data_inizio, data_completamento, istanza_id, fase_id, operatore_completamento_id, direzione)
    SELECT
      i.data_invio,
      CASE WHEN i.stato IN ('CONCLUSA', 'RESPINTA') THEN i.data_invio ELSE NULL END,
      i.id,
      f.id,
      NULL,
      'AVANZAMENTO'
    FROM istanze i
    JOIN fasi f ON f.servizio_id = i.servizio_id
    ORDER BY i.id
  `);

  await resetSequence(dst, 'istanza_fasi');

  console.log(`IstanzaFasi: ${result.rowCount} create`);
}

// ── migrazione utenti ─────────────────────────────────────────────────────────

async function migrateUtenti(src, dst) {
  console.log('\n── Migrazione utenti ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT 
    codice_fiscale, 
    cognome, 
    nome, 
    email,
    mobile AS telefono, 
    data_nascita, 
    luogo_nascita
    FROM utenti
    ORDER BY codice_fiscale
  `);
  console.log(`Utenti trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun utente da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO utenti (${colList})
    VALUES (${placeholders})
    ON CONFLICT (codice_fiscale) DO NOTHING
  `;

  let ok = 0, errors = 0;

  for (const row of rows) {
    const values = columns.map(c => {
      if (c === 'cognome' || c === 'nome') return row[c].toUpperCase();
      return row[c];
    });
    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} utenti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su utente ${row.codice_fiscale}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli utenti per evitare conflitti con nuovi utenti creati dopo la migrazione
  await resetSequence(dst, 'utenti');

  console.log(`Utenti: ${ok} inseriti/esistenti, ${errors} errori`);
}

// ── migrazione steps ─────────────────────────────────────────────────────────

async function migrateSteps(src, dst) {
  console.log('\n── Migrazione steps ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT 
    s.id,
    s.attivo,
    s.descrizione,
    pagamento,
    allegati,
    --allegati_richiesti,
    --allegati_op_richiesti,
    protocollo,
    unita_organizzativa,
    ordine,
    m.id as servizio_id,
    COALESCE(allegati_op, false) as allegati_op
    --COALESCE(allegati_op_required, false) as allegati_op_required,
    --COALESCE(allegati_required, false) as allegati_required,
    --COALESCE(assegnabileaspecifico_ufficio, false) as assegnabile_a_specifico_ufficio,
    --COALESCE(setta_attributo, false) as setta_attributo
    FROM step s
    LEFT JOIN moduli m ON m.id=s.id_modulo
    LEFT JOIN servizi se ON se.id=m.id_servizio
	  WHERE se.id_area in (SELECT id FROM aree WHERE id_ente=1)
    AND s.attivo = true
    ORDER BY s.id
  `);
  console.log(`Step trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuno step da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO steps (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
    --ON CONFLICT (servizio_id, steps.ordine) DO UPDATE SET steps.ordine=${columns[7]}+1
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} steps migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su step ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli steps per evitare conflitti con nuovi steps creati dopo la migrazione
  await resetSequence(dst, 'steps');

  await dst.query(`
    UPDATE steps SET fase_id = (
      SELECT id FROM fasi WHERE servizio_id = steps.servizio_id LIMIT 1
    )
  `);

  console.log(`Steps: ${ok} inseriti/esistenti, ${errors} errori`);
}

// ── migrazione allegati_richiesti ─────────────────────────────────────────────

async function migrateAllegatiRichiesti(src, dst) {
  console.log('\n── Migrazione allegati_richiesti ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT
      ar.id,
      ar.nome_allegato_richiesto,
      ar.obbligatorio,
      ar.interno,
      -- Normalizza al dominio enum Soggetto (OP | UT); valori ignoti → NULL
      CASE
        WHEN upper(ar.soggetto) IN ('OP', 'OPERATORE') THEN 'OP'
        WHEN upper(ar.soggetto) IN ('UT', 'UTENTE') THEN 'UT'
        ELSE NULL
      END AS soggetto,
      ar.id_step   AS step_id
    FROM allegati_richiesti ar
    INNER JOIN step s ON s.id = ar.id_step
    INNER JOIN moduli m ON m.id = s.id_modulo
    INNER JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
      AND s.attivo = true
    ORDER BY ar.id
  `);
  console.log(`Allegati richiesti trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun allegato richiesto da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO allegati_richiesti (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const values = columns.map(col => row[col]);
    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} allegati richiesti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su allegato richiesto id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  await resetSequence(dst, 'allegati_richiesti');

  console.log(`Allegati richiesti: ${ok} OK, ${errors} errori`);
}

// ── risoluzione utente per codice fiscale ────────────────────────────────────

async function findUtenteId(dst, codiceFiscale) {
  const { rows } = await dst.query(
    'SELECT id FROM utenti WHERE codice_fiscale = $1 LIMIT 1',
    [codiceFiscale]
  );
  return rows.length > 0 ? rows[0].id : null;
}

// ── migrazione istanze ────────────────────────────────────────────────────────

async function migrateIstanze(src, dst) {
  console.log('\n── Migrazione istanze ───────────────────────────────────────────────');

  // I tre booleani `in_bozza`/`conclusa`/`respinta` sono stati sostituiti
  // dall'enum stato_istanza (20260805100000_stato_istanza_enum + contrazione).
  // L'ordine dei rami replica quello del backfill di quella migrazione.
  //
  // `in_bozza` esiste nel legacy? Non è dato saperlo a priori — il legacy non è
  // versionato qui. Se esiste va rispettato: una bozza importata come
  // IN_LAVORAZIONE diventerebbe visibile agli operatori, cioè un documento mai
  // inviato dal cittadino che entra in lavorazione.
  const legacyHaBozze = await hasColumn(src, 'istanze', 'in_bozza');
  console.log(legacyHaBozze
    ? '  legacy.istanze.in_bozza presente → le bozze restano BOZZA'
    : '  legacy.istanze.in_bozza assente → nessuna bozza da preservare');

  const ramoBozza = legacyHaBozze ? `WHEN i.in_bozza THEN 'BOZZA'` : '';

  const { rows } = await src.query(`
    SELECT
      m.tipo            AS _modulo_tipo,
      i.id,
      i.data_invio,
      i.dati,
      i.id_modulo       AS servizio_id,
      i.id_utente       AS utente_id,
      i.proto_data,
      COALESCE(i.proto_numero, '') AS  proto_numero,
      i.proto_finale_data,
      i.proto_finale_numero,
      CASE
        ${ramoBozza}
        WHEN i.conclusa THEN 'CONCLUSA'
        WHEN i.respinta THEN 'RESPINTA'
        ELSE 'IN_LAVORAZIONE'
      END               AS stato,
      i.dati_responso,
      i.dati_in_evidenza
    FROM istanze i
    JOIN moduli m ON m.id = i.id_modulo
    JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY i.id
  `);

  console.log(`Istanze trovate: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna istanza da migrare.');
    return;
  }

  // Colonne da inserire (escluso il campo di servizio aggiunto dalla JOIN)
  const columns = Object.keys(rows[0]).filter(c => c !== '_modulo_tipo');
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    // .filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO istanze (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    const nuovoDati = convertDati(row.dati);
    // Risolvi utente_id: interroga dst per ottenere l'id numerico dal codice fiscale
    let nuovoUtenteId = await findUtenteId(dst, row.utente_id);
    if (!nuovoUtenteId) {
      // Utente non presente in utenti: creiamo un placeholder così NON perdiamo
      // l'istanza (e i suoi workflow/allegati). Il CF resta tracciabile.
      const cf = (row.utente_id || '').trim() || `SCONOSCIUTO_${row.id}`;
      try {
        const ins = await q(dst,
          `INSERT INTO utenti (codice_fiscale, nome, cognome)
           VALUES ($1, 'N/D', 'N/D')
           ON CONFLICT (codice_fiscale) DO UPDATE SET codice_fiscale = EXCLUDED.codice_fiscale
           RETURNING id`,
          [cf]
        );
        nuovoUtenteId = ins.rows[0].id;
        console.warn(`  ⚠ utente CF="${row.utente_id}" non trovato: creato placeholder id=${nuovoUtenteId} per istanza id=${row.id}`);
      } catch (err) {
        console.error(`  ✗ impossibile creare utente placeholder per CF="${row.utente_id}", istanza id=${row.id}: ${err.message}`);
        errors++;
        continue;
      }
    }

    const values = columns.map(col => {
      if (col === 'dati') return nuovoDati;
      if (col === 'utente_id') return nuovoUtenteId;
      return row[col];
    });

    try {
      await q(dst, sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} istanze migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su istanza id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza delle istanze per evitare conflitti con nuove istanze createi dopo la migrazione
  await resetSequence(dst, 'istanze');

  // Posizione di partenza: prima fase del servizio (per ORDINE, non la prima che
  // capita). È solo un valore iniziale: la fase reale dipende dalle attività, che
  // a questo punto non sono ancora state migrate → riallineaFaseCorrente() gira
  // dopo migrateAttivita e corregge. L'ufficio corrente non è denormalizzato: si
  // deriva da fasi.ufficio_id.
  await dst.query(`
    UPDATE istanze SET
      fase_corrente_id = (
        SELECT id FROM fasi WHERE servizio_id = istanze.servizio_id ORDER BY ordine LIMIT 1
      )
    WHERE stato = 'IN_LAVORAZIONE'
  `);

  console.log(`Istanze: ${ok} OK, ${errors} errori`);
}

// ── riallineamento posizione istanze ─────────────────────────────────────────

// La fase corrente di un'istanza è quella dello step della sua ultima attività.
// migrateIstanze() non può saperlo (gira prima delle attività) e imposta la prima
// fase del servizio: per i servizi multi-fase ogni istanza già lavorata in fase
// 2+ resterebbe puntata alla fase 1, quindi visibile all'ufficio sbagliato —
// la visibilità operatore si basa su fasi.ufficio_id via fase_corrente_id.
// Stessa logica di sql/01-riallinea-fase-corrente.sql, idempotente.
async function riallineaFaseCorrente(dst) {
  console.log('\n── Riallineamento fase corrente istanze ──────────────────────────────');

  const res = await dst.query(`
    UPDATE istanze i
    SET fase_corrente_id = ua.fase_id
    FROM (
      SELECT DISTINCT ON (a.istanza_id) a.istanza_id, s.fase_id
      FROM istanza_attivita a
      JOIN steps s ON s.id = a.step_id
      ORDER BY a.istanza_id, a.data_variazione DESC, a.id DESC
    ) ua
    WHERE ua.istanza_id = i.id
      AND i.stato = 'IN_LAVORAZIONE'
      AND i.fase_corrente_id IS DISTINCT FROM ua.fase_id
  `);

  // Le istanze chiuse non hanno fase corrente
  const chiuse = await dst.query(`
    UPDATE istanze SET fase_corrente_id = NULL
    WHERE stato IN ('CONCLUSA', 'RESPINTA') AND fase_corrente_id IS NOT NULL
  `);

  console.log(`Fase corrente riallineata su ${res.rowCount} istanze aperte; azzerata su ${chiuse.rowCount} chiuse.`);
}

// ── allineamento attività corrente ────────────────────────────────────────────
// `istanze.attivita_corrente_id` è mantenuta dal trigger AFTER INSERT su
// istanza_attivita, che assume "corrente = ULTIMA INSERITA". In import l'ordine
// di inserimento è quello degli id legacy, mentre la definizione di corrente è
// (data_variazione DESC, id DESC) — la stessa usata dal backfill di
// 20260807100000. Se le due divergono, l'istanza resta puntata all'attività
// sbagliata e l'office mostra lo step sbagliato: qui si riallinea esplicitamente.
async function allineaAttivitaCorrente(dst) {
  console.log('\n── Allineamento attività corrente ────────────────────────────────');

  const res = await dst.query(`
    UPDATE istanze i
    SET attivita_corrente_id = ua.id
    FROM (
      SELECT DISTINCT ON (istanza_id) istanza_id, id
      FROM istanza_attivita
      ORDER BY istanza_id, data_variazione DESC, id DESC
    ) ua
    WHERE ua.istanza_id = i.id
      AND i.attivita_corrente_id IS DISTINCT FROM ua.id
  `);

  console.log(`Attività corrente corretta su ${res.rowCount} istanze.`);
}

// ── assegnazione operatore corrente ───────────────────────────────────────────
// Nel legacy `workflow.id_operatore` aveva doppia semantica: su una riga chiusa
// era CHI l'ha chiusa, su una riga aperta era CHI ha in carico l'istanza. La
// contrazione 20260807110000 ha separato le due cose: la prima è
// istanza_attivita.completata_da_id, la seconda istanze.assegnatario_id.
//
// DEVE girare DOPO ogni scrittura di fase_corrente_id: il trigger
// `assegnatario_al_cambio_fase` azzera l'assegnatario a ogni cambio di fase, e
// riallineaFaseCorrente() è appunto un cambio di fase. Invertire l'ordine
// significa perdere silenziosamente tutte le assegnazioni.
async function assegnaOperatoriCorrenti(src, dst) {
  console.log('\n── Assegnazione operatore corrente ───────────────────────────────');

  const { rows } = await src.query(`
    SELECT DISTINCT ON (w.id_istanza)
      w.id_istanza   AS istanza_id,
      w.id_operatore AS operatore_id
    FROM workflow w
    WHERE w.id_step IS NOT NULL AND w.id_operatore IS NOT NULL
    ORDER BY w.id_istanza, w.data_variazione DESC, w.id DESC
  `);
  console.log(`Istanze con operatore sull'ultima attività: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna assegnazione da riportare.');
    return;
  }

  // Un solo statement con UNNEST invece di N update: l'operazione è puramente
  // insiemistica e non ha nulla da riportare riga per riga.
  const res = await dst.query(`
    UPDATE istanze i
    SET assegnatario_id = v.operatore_id
    FROM (SELECT UNNEST($1::int[]) AS istanza_id, UNNEST($2::int[]) AS operatore_id) v
    WHERE v.istanza_id = i.id
      AND EXISTS (SELECT 1 FROM operatori o WHERE o.id = v.operatore_id)
  `, [rows.map(r => r.istanza_id), rows.map(r => r.operatore_id)]);

  console.log(`Assegnatario impostato su ${res.rowCount} istanze.`);
}

// ── migrazione attività dell'istanza ──────────────────────────────────────────
// Ex tabella `workflows` (rinominata da 20260807120000). Rispetto a prima:
//   - `stato` binario → rimosso: "aperta" è completata_at IS NULL
//   - `operatore_id` → rimosso: vedi assegnaOperatoriCorrenti() per la doppia
//     semantica che nascondeva

async function migrateAttivita(src, dst) {
  console.log('\n── Migrazione attività istanza ───────────────────────────────────');

  // Mappatura legacy→nuovo presa dai backfill 2 e 3 di
  // 20260807100000_posizione_corrente_espansione, per non averne due diverse:
  //   - status legacy 1 = "presentata/in lavorazione" → attività APERTA
  //   - ogni altro status → attività CHIUSA
  //   - quando è stata chiusa non esiste nel legacy: il proxy è la
  //     data_variazione dell'attività SUCCESSIVA della stessa istanza (quando è
  //     partita la successiva, la precedente era chiusa), con fallback sulla
  //     propria data_variazione per l'ultima riga chiusa.
  //
  // Il filtro su step attivo e area è lo stesso di migrateSteps: un'attività su
  // uno step non importato violerebbe la FK. Le righe scartate sono contate.
  const { rows } = await src.query(`
    SELECT
      w.id,
      w.note,
      w.data_variazione,
      w.id_istanza AS istanza_id,
      w.id_step    AS step_id,
      CASE WHEN w.id_status = 1 THEN NULL
           ELSE COALESCE(
             LEAD(w.data_variazione) OVER (PARTITION BY w.id_istanza ORDER BY w.data_variazione, w.id),
             w.data_variazione
           )
      END AS completata_at,
      CASE WHEN w.id_status = 1 THEN NULL ELSE w.id_operatore END AS completata_da_id
    FROM workflow w
    JOIN step st ON st.id = w.id_step AND st.attivo = true
    JOIN moduli m ON m.id = st.id_modulo
    JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY w.id
  `);
  console.log(`Attività trovate: ${rows.length}`);

  const { rows: [scartate] } = await src.query(`
    SELECT COUNT(*)::int AS n
    FROM workflow w
    JOIN step st ON st.id = w.id_step
    WHERE st.attivo = false
  `);
  if (scartate.n > 0) {
    console.warn(`  ⚠ ${scartate.n} attività su step disattivati: non importate (lo step non esiste in destinazione)`);
  }

  if (rows.length === 0) {
    console.log('Nessuna attività da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO istanza_attivita (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    try {
      await q(dst, sql, columns.map(col => row[col]));
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} attività migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su attività ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza delle attività per evitare conflitti con nuove attività create dopo la migrazione
  await resetSequence(dst, 'istanza_attivita');

  console.log(`Attività: ${ok} inserite/esistenti, ${errors} errori`);
}


// ── migrazione Comunicazioni da Workflow ─────────────────────────────────────────────────────────

async function migrateComunicazioni(src, dst) {
  console.log('\n── Migrazione comunicazioni da workflow ────────────────────────────────────────────────');

  // Preserviamo l'id del workflow-notifica legacy come id della Comunicazione:
  // serve per agganciare le risposte del cittadino (RispostaComunicazione).
  // Aggreghiamo per workflow così un notifica con più allegati_richiesti resta
  // una sola comunicazione (niente duplicati da JOIN 1-a-molti).
  const { rows } = await src.query(`
    SELECT
    w.id AS id,
    w.data_variazione AS data_creazione,
    COALESCE(NULLIF(w.note, ''), n.descrizione, '') AS testo,
    w.id_operatore as operatore_id,
    w.id_istanza as istanza_id,
    (COUNT(ar.id) > 0) as richiede_risposta,
    (json_agg(
       json_build_object(
         'nome', ar.nome_allegato_richiesto,
         'obbligatorio', COALESCE(ar.obbligatorio, false)
       )
     ) FILTER (WHERE ar.id IS NOT NULL))::text as allegati_richiesti
    FROM public.workflow w
    LEFT JOIN notifiche n ON n.id=w.id_notifica
    LEFT JOIN allegati_richiesti ar ON n.id=ar.id_notifica
    WHERE w.id_step IS NULL
    GROUP BY w.id, w.data_variazione, w.note, n.descrizione, w.id_operatore, w.id_istanza
    ORDER BY w.id;
  `);
  console.log(`Workflow di comunicazione trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun workflow di comunicazione da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO comunicazioni (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    try {
      await q(dst, sql, columns.map(col => row[col]));
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} comunicazioni migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su comunicazione ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza delle comunicazioni per evitare conflitti con nuove comunicazioni create dopo la migrazione
  await resetSequence(dst, 'comunicazioni');

  console.log(`Comunicazioni: ${ok} inserite/esistenti, ${errors} errori`);
}

// ── migrazione allegati ─────────────────────────────────────────────────────────

async function migrateAllegati(src, dst) {
  console.log('\n── Migrazione allegati ────────────────────────────────────────────────');

  // Solo allegati legati a workflow-di-step (id_step NOT NULL): quelli sono
  // migrati in istanza_attivita. Gli allegati su workflow-notifica (id_step
  // NULL) sono risposte del cittadino → gestiti in migrateRisposteComunicazioni.
  //
  // La colonna è `attivita_id` dalla rinomina 20260807120000, e il filtro su
  // step attivo/area ripete quello di migrateAttivita: un allegato la cui
  // attività non è stata importata violerebbe la FK.
  const { rows } = await src.query(`
    SELECT
    a.id,
    a.nome_file,
    a.nome_hash,
    a.nome_file_richiesto,
    a.mime_type, a.inv_utente,
    a.visto, a.data_inserimento,
    a.id_workflow as attivita_id
    FROM allegati a
    JOIN workflow w ON w.id = a.id_workflow
    JOIN step st ON st.id = w.id_step AND st.attivo = true
    JOIN moduli m ON m.id = st.id_modulo
    JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY a.id
  `);
  console.log(`Allegati trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun allegato da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO allegati (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    try {
      await q(dst, sql, columns.map(col => row[col]));
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} allegati migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su allegato ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli allegati per evitare conflitti con nuovi allegati creati dopo la migrazione
  await resetSequence(dst, 'allegati');

  console.log(`Allegati: ${ok} inseriti/esistenti, ${errors} errori`);
}

// ── migrazione risposte comunicazioni ─────────────────────────────────────────
// Nel legacy la risposta del cittadino a una notifica = allegati con
// inv_utente=true sul workflow-notifica (id_step NULL). Nel nuovo modello:
// RispostaComunicazione (1 per comunicazione) + AllegatoRisposta (N file).
// La comunicazione ha id = id del workflow-notifica legacy (vedi migrateComunicazioni).

async function migrateRisposteComunicazioni(src, dst) {
  console.log('\n── Migrazione risposte comunicazioni ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT
      a.id_workflow AS comunicazione_id,
      a.nome_file,
      a.nome_hash,
      a.mime_type
    FROM allegati a
    JOIN workflow w ON w.id = a.id_workflow
    WHERE w.id_step IS NULL AND a.inv_utente = true
    ORDER BY a.id_workflow, a.id
  `);
  console.log(`Allegati risposta trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna risposta da migrare.');
    return;
  }

  // Raggruppa gli allegati per comunicazione (workflow-notifica)
  const byComunicazione = new Map();
  for (const row of rows) {
    if (!byComunicazione.has(row.comunicazione_id)) byComunicazione.set(row.comunicazione_id, []);
    byComunicazione.get(row.comunicazione_id).push(row);
  }

  let risposteOk = 0, allegatiOk = 0, errors = 0;
  for (const [comunicazioneId, allegati] of byComunicazione) {
    try {
      // 1 risposta per comunicazione (FK verso comunicazioni migrate con id preservato)
      const ins = await q(dst,
        `INSERT INTO risposte_comunicazioni (comunicazione_id)
         VALUES ($1)
         ON CONFLICT (comunicazione_id) DO UPDATE SET comunicazione_id = EXCLUDED.comunicazione_id
         RETURNING id`,
        [comunicazioneId]
      );
      const rispostaId = ins.rows[0].id;
      risposteOk++;

      for (const a of allegati) {
        try {
          await q(dst,
            `INSERT INTO allegati_risposta (nome_file, nome_hash, mime_type, risposta_id)
             VALUES ($1, $2, $3, $4)`,
            [a.nome_file, a.nome_hash, a.mime_type, rispostaId]
          );
          allegatiOk++;
        } catch (err) {
          console.error(`  ✗ errore su allegato_risposta (com=${comunicazioneId}): ${err.message}`);
          errors++;
        }
      }
    } catch (err) {
      console.error(`  ✗ errore su risposta comunicazione ${comunicazioneId} (comunicazione mancante?): ${err.message}`);
      errors++;
    }
  }

  await resetSequence(dst, 'risposte_comunicazioni');
  await resetSequence(dst, 'allegati_risposta');

  console.log(`Risposte: ${risposteOk} risposte, ${allegatiOk} allegati, ${errors} errori`);
}

// ── migrazione config pagamenti step ──────────────────────────────────────────
// Config pagamento a livello di step: legacy pagamenti (importo, tributo,
// obbligatorio, tipologia) → nuovo modello Pagamento (step_id unico).

async function migratePagamenti(src, dst) {
  console.log('\n── Migrazione config pagamenti ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT
      p.id,
      p.importo,
      COALESCE(p.obbligatorio, false) as obbligatorio,
      p.tipologia_pagamento::text as tipologia_pagamento,
      LEFT(ct.codice, 30) as codice_tributo,
      LEFT(ct.descrizione, 512) as descrizione_tributo,
      p.id_step as step_id
    FROM pagamenti p
    LEFT JOIN codici_tributo ct ON ct.id = p.id_codice_tributo
    JOIN step s ON s.id = p.id_step
    LEFT JOIN moduli m ON m.id = s.id_modulo
    LEFT JOIN servizi se ON se.id = m.id_servizio
    WHERE se.id_area IN (SELECT id FROM aree WHERE id_ente=1) AND s.attivo = true
    ORDER BY p.id
  `);
  console.log(`Config pagamenti trovate: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessuna config pagamento da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ');
  const sql = `
    INSERT INTO pagamenti (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  for (const row of rows) {
    try {
      await q(dst, sql, columns.map(col => row[col]));
      ok++;
    } catch (err) {
      console.error(`  ✗ errore su pagamento id=${row.id} (step ${row.step_id} già configurato?): ${err.message}`);
      errors++;
    }
  }

  await resetSequence(dst, 'pagamenti');

  console.log(`Config pagamenti: ${ok} OK, ${errors} errori`);
}

// ── migrazione storico pagamenti ──────────────────────────────────────────────
// pagamenti_effettuati → pagamenti_attesi. Un record per workflow (il più
// recente). Solo workflow-di-step migrati (FK verso istanza_attivita). Tronca i campi
// alle lunghezze del nuovo schema per evitare errori di insert.

async function migratePagamentiAttesi(src, dst) {
  console.log('\n── Migrazione storico pagamenti ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT DISTINCT ON (pe.id_workflow)
      pe.id,
      LEFT(pe.id_iuv, 100) as iuv,
      LEFT(pe.numero_documento, 30) as numero_documento,
      -- importo_totale è NOT NULL in destinazione
      COALESCE(pe.importo_totale, 0) as importo_totale,
      LEFT(pe.stato::text, 3) as stato,
      pe.data_emissione,
      pe.data_scadenza,
      pe.data_operazione,
      pe.data_richiesta as data_ricevuta,
      LEFT(pe.pagante, 16) as pagante_codice_fiscale,
      LEFT(TRIM(CONCAT(pe.pagante_nome, ' ', pe.pagante_cognome)), 50) as pagante,
      LEFT(pe.email, 50) as pagante_email,
      LEFT(pe.causale, 100) as causale,
      pe.id_workflow as attivita_id
    FROM pagamenti_effettuati pe
    JOIN workflow w ON w.id = pe.id_workflow AND w.id_step IS NOT NULL
    JOIN step st ON st.id = w.id_step AND st.attivo = true
    JOIN moduli m ON m.id = st.id_modulo
    JOIN servizi se ON se.id = m.id_servizio
    WHERE pe.id_workflow IS NOT NULL
      AND se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY pe.id_workflow, pe.data_transazione DESC NULLS LAST
  `);
  console.log(`Storico pagamenti trovati: ${rows.length}`);

  let ok = 0, errors = 0;
  if (rows.length > 0) {
    const columns = Object.keys(rows[0]);
    const colList = columns.map(c => `"${c}"`).join(', ');
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const sql = `
      INSERT INTO pagamenti_attesi (${colList})
      VALUES (${placeholders})
      ON CONFLICT (attivita_id) DO NOTHING
    `;

    for (const row of rows) {
      try {
        await q(dst, sql, columns.map(col => row[col]));
        ok++;
        if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} pagamenti migrati…`);
      } catch (err) {
        console.error(`  ✗ errore su pagamento_atteso id=${row.id}: ${err.message}`);
        errors++;
      }
    }
  }

  // B8: preserva workflow.importo_richiesto (importo richiesto dall'operatore per
  // pagamenti a importo variabile). Se il pagamento è stato eseguito arriva già da
  // pagamenti_effettuati; qui recuperiamo i RICHIESTI-ma-non-pagati creando un
  // PagamentoAtteso pending. ON CONFLICT (attivita_id) → l'effettuato ha precedenza.
  const { rows: richiesti } = await src.query(`
    SELECT w.id as attivita_id, w.importo_richiesto as importo_totale
    FROM workflow w
    JOIN step s ON s.id = w.id_step AND s.pagamento = true AND s.attivo = true
    JOIN moduli m ON m.id = s.id_modulo
    JOIN servizi se ON se.id = m.id_servizio
    WHERE w.importo_richiesto IS NOT NULL AND w.importo_richiesto > 0
      AND se.id_area IN (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY w.id
  `);
  console.log(`Importi richiesti (non pagati) trovati: ${richiesti.length}`);

  let richiestiOk = 0;
  const sqlRichiesto = `
    INSERT INTO pagamenti_attesi (importo_totale, attivita_id)
    VALUES ($1, $2)
    ON CONFLICT (attivita_id) DO NOTHING
  `;
  for (const row of richiesti) {
    try {
      await q(dst, sqlRichiesto, [row.importo_totale, row.attivita_id]);
      richiestiOk++;
    } catch (err) {
      console.error(`  ✗ errore su importo richiesto attività=${row.attivita_id}: ${err.message}`);
      errors++;
    }
  }

  await resetSequence(dst, 'pagamenti_attesi');

  console.log(`Storico pagamenti: ${ok} effettuati, ${richiestiOk} richiesti-non-pagati, ${errors} errori`);
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  const src = new Client(srcConfig);
  const dst = new Client(dstConfig);

  console.log(`Connessione a sorgente:      ${srcConfig.host}/${srcConfig.database}`);
  await src.connect();

  console.log(`Connessione a destinazione:  ${dstConfig.host}/${dstConfig.database}`);
  await dst.connect();

  try {
    // Transazione unica: se un passo fallisce, ROLLBACK totale.
    // Evita di lasciare il DB destinazione in stato parziale/incoerente.
    await dst.query('BEGIN');

    //  0. Azzera la destinazione in ordine inverso di dipendenza (utenti esclusa)
    await resetDestinazione(dst);

    //  1. Migra enti (nessuna dipendenza)
    await migrateEnti(src, dst);

    //  2. Migra uffici (nessuna dipendenza)
    await migrateUffici(src, dst);

    //  3. Migra ruoli (nessuna dipendenza)
    await migrateRuoli(src, dst);

    //  4. Migra aree (dipende da enti)
    await migrateAree(src, dst);

    //  5. Migra servizi (dipende da aree, uffici; converte attributi nel nuovo formato)
    await migrateServizi(src, dst);

    //  6. Migra fasi (dipende da servizi, uffici; una fase unica per servizio)
    await migrateFasi(src, dst);

    //  7. Migra steps (dipende da servizi, fasi; aggiorna fase_id post-insert)
    await migrateSteps(src, dst);

    //  7b. Migra allegati_richiesti (dipende da steps)
    await migrateAllegatiRichiesti(src, dst);

    //  7c. Migra config pagamenti step (dipende da steps)
    await migratePagamenti(src, dst);

    //  8. Migra operatori (nessuna dipendenza; include ufficio_id da operatori_moduli)
    await migrateOperatori(src, dst);

    //  9. Migra operatori_ruoli (dipende da operatori, ruoli)
    await migrateOperatoriRuoli(src, dst);

    //  9b. Migra operatori_servizi (dipende da operatori, servizi)
    await migrateOperatoriServizi(src, dst);

    // 10. Migra utenti (nessuna dipendenza)
    await migrateUtenti(src, dst);

    // 11. Migra istanze (dipende da utenti, servizi; risolve CF→id; setta fase_corrente_id)
    await migrateIstanze(src, dst);

    // 12. Migra le attività dell'istanza (dipende da istanze, steps, operatori)
    await migrateAttivita(src, dst);

    // ─────────────────────────────────────────────────────────────────────────
    // I tre passi seguenti sono in ORDINE VINCOLANTE, non per comodità:
    //
    //   12a. l'attività corrente la scrive il trigger AFTER INSERT seguendo
    //        l'ordine di inserimento; qui si riporta alla definizione vera
    //        (ultima per data_variazione).
    //   12b. la fase corrente si ricava dallo step dell'ultima attività, quindi
    //        non prima che le attività esistano.
    //   12c. l'assegnatario va scritto PER ULTIMO: il trigger
    //        `assegnatario_al_cambio_fase` lo azzera a ogni cambio di
    //        fase_corrente_id, e 12b è esattamente un cambio di fase.
    // ─────────────────────────────────────────────────────────────────────────
    await allineaAttivitaCorrente(dst);
    await riallineaFaseCorrente(dst);
    await assegnaOperatoriCorrenti(src, dst);

    // 13. Migra Comunicazioni (dipende da istanze, operatori; id = id workflow-notifica legacy)
    await migrateComunicazioni(src, dst);

    // 13b. Migra risposte comunicazioni (dipende da comunicazioni)
    await migrateRisposteComunicazioni(src, dst);

    // 14. Migra istanza_fasi (dipende da istanze, fasi)
    await migrateIstanzaFasi(src, dst);

    // 15. Migra allegati di attività (dipende da istanza_attivita)
    await migrateAllegati(src, dst);

    // 16. Migra storico pagamenti (dipende da istanza_attivita)
    await migratePagamentiAttesi(src, dst);

    await dst.query('COMMIT');
    console.log('\n✓ Migrazione completata.');
  } catch (err) {
    await dst.query('ROLLBACK').catch(() => { });
    console.error('\n✗ Migrazione annullata (ROLLBACK):', err.message);
    throw err;
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch(err => {
  console.error('Errore fatale:', err.message);
  process.exit(1);
});
