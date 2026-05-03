#!/usr/bin/env node

/**
 * migrate-dati.js
 *
 * 1. Migra la tabella `utenti` da io_db → citta_semplice
 * 2. Migra la tabella `istanze` da io_db → citta_semplice:
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

function slugify(str) {
  return str
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
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
    .map(item => ({
      name: item.name,
      label: item.label || '',
      value: item.type === 'checkbox' ? findSelected(item.values) : (item.value ?? ''),
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
        if (item.name === 'codice_fiscale') {
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

  // aggiorno il numero di sequenza dell'ente per evitare conflitti con nuovi enti creati dopo la migrazione
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
    titolo as nome, 
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
    m.id,
    m.tipo as _modulo_tipo,
    s.titolo || COALESCE(' ' || NULLIF(m.name, ''), '') as titolo,
    s.sottotitolo as sotto_titolo,
    s.corpo as descrizione,
    --s.come_fare,
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
    WHERE s.id_area in (SELECT id FROM aree WHERE id_ente=1) AND s.id IS NOT NULL
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
  await dst.query("DELETE FROM servizi");
  for (const row of rows) {
    const values = columns.map(col => {
      if (col === 'attributi') return row._modulo_tipo === 'HTML' ? convertAttributes(row[col]) : row[col];
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} servizi migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su servizio id=${row.id}: ${err.message} ${JSON.stringify(values)}`);
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
  await dst.query("DELETE FROM uffici");
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
    await dst.query(`SELECT setval('uffici_id_seq', GREATEST((SELECT MAX(id) FROM uffici), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza uffici: ${err.message}`);
  }

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
    (SELECT m.id_ufficio FROM operatori_moduli om
     JOIN moduli m ON m.id = om.modulo_id
     WHERE om.operatore_id = o.id AND m.id_ufficio IS NOT NULL
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
  await dst.query("DELETE FROM operatori");
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} operatori migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su operatore id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli operatori per evitare conflitti con nuovi operatori creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('operatori_id_seq', GREATEST((SELECT MAX(id) FROM operatori), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza operatori: ${err.message}`);
  }

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
  await dst.query("DELETE FROM ruoli");
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} ruoli migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su ruolo id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei ruoli per evitare conflitti con nuovi ruoli creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('ruoli_id_seq', GREATEST((SELECT MAX(id) FROM ruoli), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza ruoli: ${err.message}`);
  }

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
  await dst.query("DELETE FROM operatori_ruoli");
  for (const row of rows) {
    const values = columns.map(col => {
      return row[col];
    });

    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} operatori-ruoli migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su operatore-ruolo id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  console.log(`Operatori-Ruoli: ${ok} OK, ${errors} errori`);
}

// ── migrazione fasi ──────────────────────────────────────────────────────────
// Crea una fase unica per ogni servizio; la visibilità operatore→servizio
// è ora mediata dall'ufficio assegnato alla fase (Fase.ufficioId).

async function migrateFasi(src, dst) {
  console.log('\n── Migrazione fasi ────────────────────────────────────────────────');

  await dst.query("DELETE FROM fasi");

  const result = await dst.query(`
    INSERT INTO fasi (nome, ordine, servizio_id, ufficio_id)
    SELECT 'Fase principale', 1, id, ufficio_id
    FROM servizi
    ORDER BY id
    RETURNING id
  `);

  try {
    await dst.query(`SELECT setval('fasi_id_seq', GREATEST((SELECT MAX(id) FROM fasi), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza fasi: ${err.message}`);
  }

  console.log(`Fasi: ${result.rowCount} create`);
}

// ── migrazione workflow_fasi ──────────────────────────────────────────────────

async function migrateWorkflowFasi(src, dst) {
  console.log('\n── Migrazione workflow_fasi ────────────────────────────────────────────────');

  await dst.query("DELETE FROM workflow_fasi");

  const result = await dst.query(`
    INSERT INTO workflow_fasi (data_inizio, data_completamento, istanza_id, fase_id, operatore_completamento_id, direzione)
    SELECT
      i.data_invio,
      CASE WHEN i.conclusa OR i.respinta THEN i.data_invio ELSE NULL END,
      i.id,
      f.id,
      NULL,
      'AVANZAMENTO'
    FROM istanze i
    JOIN fasi f ON f.servizio_id = i.servizio_id
    ORDER BY i.id
  `);

  try {
    await dst.query(`SELECT setval('workflow_fasi_id_seq', GREATEST((SELECT MAX(id) FROM workflow_fasi), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza workflow_fasi: ${err.message}`);
  }

  console.log(`WorkflowFasi: ${result.rowCount} create`);
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
      await dst.query(sql, values);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} utenti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su utente ${row.codice_fiscale}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli utenti per evitare conflitti con nuovi utenti creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('utenti_id_seq', GREATEST((SELECT MAX(id) FROM utenti), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza utenti: ${err.message}`);
  }

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
    --AND s.attivo = true
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
  await dst.query("DELETE FROM steps")
  for (const row of rows) {
    const values = columns.map(c => row[c]);
    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} steps migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su step ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli steps per evitare conflitti con nuovi steps creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('steps_id_seq', GREATEST((SELECT MAX(id) FROM steps), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza step: ${err.message}`);
  }

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
      ar.soggetto,
      ar.id_step   AS step_id,
      ar.id_notifica AS notifica_id
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
  await dst.query("DELETE FROM allegati_richiesti");
  for (const row of rows) {
    const values = columns.map(col => row[col]);
    try {
      await dst.query(sql, values);
      ok++;
      if (ok % 100 === 0) console.log(`  ${ok}/${rows.length} allegati richiesti migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su allegato richiesto id=${row.id}: ${err.message}`);
      errors++;
    }
  }

  try {
    await dst.query(`SELECT setval('allegati_richiesti_id_seq', GREATEST((SELECT MAX(id) FROM allegati_richiesti), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza allegati_richiesti: ${err.message}`);
  }

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
    // .filter(c => c !== 'id')
    .map(c => `"${c}" = EXCLUDED."${c}"`)
    .join(', ');

  const sql = `
    INSERT INTO istanze (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO UPDATE SET ${updateSet}
  `;

  let ok = 0, nonConvertiti = 0, errors = 0;
  await dst.query("DELETE FROM istanze");
  for (const row of rows) {

    /* const isHtml = row._modulo_tipo === 'HTML';

    // Converti dati solo per moduli HTML
    const nuovoDati = isHtml ? convertDati(row.dati) : row.dati;
    if (!isHtml) nonConvertiti++; */

    const nuovoDati = convertDati(row.dati);
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

  // aggiorno il numero di sequenza delle istanze per evitare conflitti con nuove istanze createi dopo la migrazione
  try {
    await dst.query(`SELECT setval('istanze_id_seq', GREATEST((SELECT MAX(id) FROM istanze), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza istanze: ${err.message}`);
  }

  await dst.query(`
    UPDATE istanze SET
      fase_corrente_id = (SELECT id FROM fasi WHERE servizio_id = istanze.servizio_id LIMIT 1),
      ufficio_corrente_id = (SELECT ufficio_id FROM fasi WHERE servizio_id = istanze.servizio_id LIMIT 1)
    WHERE NOT conclusa AND NOT respinta
  `);

  console.log(
    `Istanze: ${ok} OK` +
    ` (${nonConvertiti} dati non convertiti perché non HTML)` +
    `, ${errors} errori`
  );
}

// ── migrazione workflow ─────────────────────────────────────────────────────────

async function migrateWorkflow(src, dst) {
  console.log('\n── Migrazione workflow ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT 
    id, 
    note, 
    data_variazione, 
    id_istanza as istanza_id, 
    id_step as step_id, 
    id_notifica as notifica_id, 
    id_operatore as operatore_id 
    FROM workflow
    ORDER BY id
  `);
  console.log(`Workflow trovati: ${rows.length}`);

  if (rows.length === 0) {
    console.log('Nessun workflow da migrare.');
    return;
  }

  // Colonne derivate dalla query (già rinominate con alias)
  const columns = Object.keys(rows[0]);
  const colList = columns.map(c => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  const sql = `
    INSERT INTO workflows (${colList})
    VALUES (${placeholders})
    ON CONFLICT (id) DO NOTHING
  `;

  let ok = 0, errors = 0;
  await dst.query("DELETE FROM workflows");
  for (const row of rows) {
    try {
      await dst.query(sql, columns.map(col => row[col]));
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} workflow migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su workflow ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza dei workflow per evitare conflitti con nuovi workflow creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('workflows_id_seq', GREATEST((SELECT MAX(id) FROM workflows), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza workflows: ${err.message}`);
  }

  console.log(`Workflows: ${ok} inseriti/esistenti, ${errors} errori`);
}


// ── migrazione allegati ─────────────────────────────────────────────────────────

async function migrateAllegati(src, dst) {
  console.log('\n── Migrazione allegati ────────────────────────────────────────────────');

  const { rows } = await src.query(`
    SELECT 
    id, 
    nome_file, 
    nome_hash, 
    nome_file_richiesto, 
    mime_type, inv_utente, 
    visto, data_inserimento, 
    id_workflow as workflow_id
    FROM allegati
    ORDER BY id
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
  await dst.query("DELETE FROM allegati");
  for (const row of rows) {
    try {
      await dst.query(sql, columns.map(col => row[col]));
      ok++;
      if (ok % 1000 === 0) console.log(`  ${ok}/${rows.length} allegati migrati…`);
    } catch (err) {
      console.error(`  ✗ errore su allegato ${row.id}: ${err.message}`);
      errors++;
    }
  }

  // aggiorno il numero di sequenza degli allegati per evitare conflitti con nuovi allegati creati dopo la migrazione
  try {
    await dst.query(`SELECT setval('allegati_id_seq', GREATEST((SELECT MAX(id) FROM allegati), 1))`);
  } catch (err) {
    console.error(`  ⚠ errore nell'aggiornamento sequenza allegati: ${err.message}`);
  }

  console.log(`Allegati: ${ok} inseriti/esistenti, ${errors} errori`);
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

   /*  //  1. Migra enti (nessuna dipendenza)
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
 */
    //  7. Migra steps (dipende da servizi, fasi; aggiorna fase_id post-insert)
    await migrateSteps(src, dst);

    //  7b. Migra allegati_richiesti (dipende da steps)
    await migrateAllegatiRichiesti(src, dst);

    //  8. Migra operatori (nessuna dipendenza; include ufficio_id da operatori_moduli)
    await migrateOperatori(src, dst);

    //  9. Migra operatori_ruoli (dipende da operatori, ruoli)
    await migrateOperatoriRuoli(src, dst);

    // 10. Migra utenti (nessuna dipendenza)
    await migrateUtenti(src, dst);

    // 11. Migra istanze (dipende da utenti, servizi, steps; risolve CF→id; setta fase_corrente_id)
    await migrateIstanze(src, dst);

    // 12. Migra workflow (dipende da istanze, steps, operatori)
    await migrateWorkflow(src, dst);

    // 13. Migra workflow_fasi (dipende da istanze, fasi)
    await migrateWorkflowFasi(src, dst);

    // 14. Migra allegati (dipende da workflow)
    await migrateAllegati(src, dst);

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
