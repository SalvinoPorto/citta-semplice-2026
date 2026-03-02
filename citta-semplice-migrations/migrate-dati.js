#!/usr/bin/env node

/**
 * migrate-dati.js
 *
 * 1. Migra la tabella `utenti` da io_db → io_db_2
 * 2. Migra la tabella `istanze` da io_db → io_db_2:
 *    - converte il campo `dati` (JSON) solo per moduli di tipo HTML
 *    - sostituisce utente_id (codice fiscale testo) con il nuovo id numerico
 *      interrogando direttamente il db di destinazione riga per riga
 *
 * Uso:
 *   npm install
 *   node migrate-dati.js
 */

const { Client } = require('pg');

// ── configurazione connessioni ────────────────────────────────────────────────

const srcConfig = {
  host: process.env.SRC_HOST || 'localhost',
  port: parseInt(process.env.SRC_PORT || '5432'),
  database: 'io_db',
  user: 'io_user',
  password: 'Comct2019',
};

const dstConfig = {
  host: process.env.DST_HOST || 'localhost',
  port: parseInt(process.env.DST_PORT || '5432'),
  database: 'citta_semplice',
  user: 'io_user',
  password: 'Comct2019',
};

// ── helpers conversione dati ──────────────────────────────────────────────────

function generateId() {
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `field_${rand}`;
}

function findSelected(values) {
  if (!Array.isArray(values)) return undefined;
  const found = values.find(({ selected }) => selected);
  return found?.value;
}

function convertDati(raw) {
  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    console.warn('  ⚠ campo dati non è JSON valido, lasciato invariato');
    return raw;
  }

  if (!Array.isArray(parsed)) return raw;

  // Già nel nuovo formato (ha id ma non type)
  if (parsed.length > 0 && parsed[0].id && !parsed[0].type) return raw;

  const result = parsed
    .filter(item => item.type !== 'paragraph')
    .map(item => ({
      id: generateId(),
      name: item.name,
      label: item.label,
      value: item.type === 'checkbox' ? findSelected(item.values) : item.value,
    }));

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

  const fields = parsed.map(item => {
    const field = {
      id: generateId(),
      type: item.type === 'phone' ? 'tel' : item.type,
      name: item.type === 'paragraph' ? 'paragraph' : item.name,
      label: item.type === 'paragraph'
        ? (item.placeholder || item.label || '')
        : (item.label || ''),
      validation: {},
    };

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
    ente, 
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
  await dst.query("DELETE FROM enti");
  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} enti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ente id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dell'area per evitare conflitti con nuove aree create dopo la migrazione
  try {
    await dst.query(`SELECT setval('enti_id_seq', GREATEST((SELECT MAX(id) FROM enti), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza enti: ${err.message}`);
  }
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
    titolo, 
    attivo as attiva, 
    privata, 
    ordine
    FROM aree 
    WHERE id_ente=1
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

  await dst.query("DELETE FROM aree");
  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} aree migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su area id=${row.id}: ${err.message}`);
      errors++;
    }

  }
  // aggiorno il numero di sequenza dell'area per evitare conflitti con nuove aree create dopo la migrazione
  try {
    await dst.query(`SELECT setval('aree_id_seq', GREATEST((SELECT MAX(id) FROM aree), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza aree: ${err.message}`);
  }

  console.log(`Aree: ${ok} OK, ${errors} errori`);
}

// ── migrazione servizi ─────────────────────────────────────────────────────────

async function migrateServizi(src, dst) {
  console.log('\n── Migrazione servizi ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    corpo as descrizione, 
    requisiti as come_fare, 
    riferimento as contatti, 
    slug, 
    sottotitolo as sotto_titolo, 
    titolo, 
    id_area as area_id, 
    attivo,
    m.id as modulo_id
    FROM servizi 
    WHERE id_area in (SELECT id FROM aree WHERE id_ente=1)
    ORDER BY id
    `);
  console.log(`Servizi trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun servizio da migrare.');
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
    INSERT INTO servizi (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;
  await dst.query("DELETE FROM servizi");
  for (const row of rows) {
    const values = columns.map(col => {
      //if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} servizi migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su servizio id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei servizi per evitare conflitti con nuovi servizi creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('servizi_id_seq', GREATEST((SELECT MAX(id) FROM servizi), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza aree: ${err.message}`);
  }

  console.log(`Servizi: ${ok} OK, ${errors} errori`);
}

// ── migrazione uffici ─────────────────────────────────────────────────────────

async function migrateUffici(src, dst) {
  console.log('\n── Migrazione uffici ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    descrizione, 
    nome, 
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
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} uffici migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ufficio id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei servizi per evitare conflitti con nuovi servizi creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('uffici_id_seq', GREATEST((SELECT MAX(id) FROM uffici), nextval('uffici_id_seq')))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza uffici: ${err.message}`);
  }

  console.log(`Uffici: ${ok} OK, ${errors} errori`);
}


// ── migrazione moduli ─────────────────────────────────────────────────────────

async function migrateModuli(src, dst) {
  console.log('\n── Migrazione moduli ────────────────────────────────────────────────');

  const { rows } = await src.query(`SELECT 
    id, 
    attributes, 
    data_fine, 
    data_inizio, 
    description, 
    name, 
    id_servizio as servizio_id, 
    slug, 
    tipo, 
    nome_file, 
    attributes_response, 
    campi_in_evidenza, 
    campi_da_esportare, 
    corpo, 
    --id_ufficio as ufficio_id, 
    aggiorna_stato_ws_esterno, 
    attivo, 
    campi_unico_invio, 
    fornitorewsesterno as fornitore_ws_esterno, 
    host_ws_esterno, 
    invio_allegati_ws_esterno, 
    invio_dati_ws_esterno, 
    path_aggiorna_stato_ws_esterno, 
    path_invio_allegati_ws_esterno, 
    path_invio_ws_esterno, 
    path_verifica_ws_esterno, 
    unico_invio, 
    verifica_dati_ws_esterno, 
    ws_esterno, 
    verifica_dati_bloccante_ws_esterno, 
    acquisizione_posizione_debitoria_ws_esterno, 
    avviso_soglia, msg_extra_modulo, 
    numero_max_istanze, 
    path_acquisizione_posizione_debitoria_ws_esterno, 
    --d_attributo_type as attributo_type_id, 
    nome_documento_finale, 
    path_municipalita_ws_esterno, 
    path_viario_ws_esterno, 
    COALESCE(prevede_documento_finale,false) as prevede_documento_finale, 
    template_documento_finale, 
    COALESCE(viario,false) as viario, 
    label_viario, 
    unico_invio_per_utente, 
    COALESCE(post_form_validation,false) as post_form_validation, 
    post_form_validation_api, 
    post_form_validation_fields,
    data_inizio as updated_at
    FROM moduli 
    WHERE id_servizio IN (
      SELECT id FROM servizi
	    WHERE id_area IN (
        SELECT id FROM aree WHERE id_ente=1))
    ORDER BY id`);
  console.log(`Moduli trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun modulo da migrare.');
    return;
  }

  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
  const updateSet = columns
    // .filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO moduli (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, errors = 0;

  for (const row of rows) {
    const values = columns.map(col => {
      if (col === 'attributes') return row.tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} moduli migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su modulo id=${row.id}: ${err.message}`);
      errors++;
    }
  }

// aggiorno il numero di sequenza dei moduli per evitare conflitti con nuovi moduli creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('moduli_id_seq', GREATEST((SELECT MAX(id) FROM moduli), nextval('moduli_id_seq')))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza moduli: ${err.message}`);
  }

  console.log(`Moduli: ${ok} OK, ${errors} errori`);
}

// ── migrazione utenti ─────────────────────────────────────────────────────────

async function migrateUtenti(src, dst) {
  console.log('\n── Migrazione utenti ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT codice_fiscale, cognome, nome, email,
           mobile AS telefono, data_nascita, luogo_nascita
    FROM utenti
    ORDER BY codice_fiscale LIMIT 100
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
    const values = columns.map(c => row[c]);
    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} utenti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su utente ${row.codice_fiscale}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Utenti: ${ok} inseriti/esistenti, ${errors} errori`);
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

  const { rows } = await src.query(`
    SELECT
      m.tipo            AS _modulo_tipo,
      i.id,
      i.data_invio,
      i.dati,
      i.id_modulo       AS modulo_id,
      i.id_utente       AS utente_id,
      i.proto_data,
      i.proto_numero,
      i.proto_finale_data,
      i.proto_finale_numero,
      i.conclusa,
      i.respinta,
      i.dati_responso,
      i.id_last_step    AS last_step_id,
      i.dati_in_evidenza
    FROM istanze i
    LEFT JOIN moduli m ON m.id = i.id_modulo
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
    .filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO istanze (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, nonConvertiti = 0, errors = 0;

  for (const row of rows) {
    const isHtml = row._modulo_tipo === 'HTML';

    // Converti dati solo per moduli HTML
    const nuovoDati = isHtml ? convertDati(row.dati) : row.dati;
    if (!isHtml) nonConvertiti++;

    // Risolvi utente_id: interroga dst per ottenere l'id numerico dal codice fiscale
    const nuovoUtenteId = await findUtenteId(dst, row.utente_id);
    if (!nuovoUtenteId) {
      console.warn(`  ⚠ utente non trovato per CF="${row.utente_id}", istanza id=${row.id} saltata`);
      errors++;
      continue;
    }

    const values = columns.map(col => {
      if (col === 'dati') return nuovoDati;
      if (col === 'utente_id') return nuovoUtenteId;
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} istanze migrate…`);
    } catch (err) {
      console.error(`  ✗ errore su istanza id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(
    `Istanze: ${ok} OK` +
    ` (${nonConvertiti} dati non convertiti perché non HTML)` +
    `, ${errors} errori`
  );
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
    // 1. Migra utenti
    // await migrateUtenti(src, dst);

    // 2. Migra enti
    // await migrateEnti(src, dst);

    // 3. Migra aree
    // await migrateAree(src, dst);

    // 3. Migra servizi
    // await migrateServizi(src, dst);

    // 4. Migra uffici
    // await migrateUffici(src, dst);

    // 5. Migra moduli (converte il campo attributes nel nuovo formato)
    await migrateModuli(src, dst);

    // 6. Migra istanze (risolve CF→id interrogando dst per ogni riga)
    // await migrateIstanze(src, dst);

    console.log('\n✓ Migrazione completata.');
  } finally {
    await src.end();
    await dst.end();
  }
}

main().catch(err => {
  console.error('Errore fatale:', err.message);
  process.exit(1);
});
