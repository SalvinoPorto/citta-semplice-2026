#!/usr/bin/env node

/**
 * Converte dati.json (formato legacy) in src/modulo.json (nuovo formato)
 *
 * Regole:
 *  - col='col-12'  → nessun campo width
 *  - qualsiasi altro col → width: 'half'
 *  - autocomplete  → select (values → options)
 *  - paragraph     → mantenuto con type='paragraph'
 */

const fs = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'dati.json');
const OUTPUT = path.join(__dirname, 'src', 'modulo.json');

// ── helpers ────────────────────────────────────────────────────────────────

function generateId() {
  const ts     = Date.now();
  const rand   = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `field_${ts}_${rand}`;
}

const TYPE_MAP = {
  text:         'text',
  email:        'email',
  date:         'date',
  number:       'number',
  autocomplete: 'select',
  checkbox:     'checkbox',
  paragraph:    'paragraph',
};

function mapType(type) {
  return TYPE_MAP[type] ?? type;
}

function mapWidth(col) {
  if (!col || col === 'col-12') return undefined;
  return 'half';
}

function buildValidation(item) {
  const v = {};
  if (item.required) v.required = true;
  return v;
}

function buildOptions(values) {
  if (!Array.isArray(values)) return undefined;
  return values.map(({ label, value }) => ({ value, label }));
}

// ── conversion ─────────────────────────────────────────────────────────────

const dati = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

const fields = dati.map(item => {
  const field = {
    id:   generateId(),
    type: mapType(item.type),
    name: item.name,
    label: item.label,
  };

  // validation (omit if empty)
  const validation = buildValidation(item);
  if (Object.keys(validation).length > 0) {
    field.validation = validation;
  }

  // placeholder
  if (item.placeholder) {
    field.placeholder = item.placeholder;
  }

  // options (select / checkbox)
  const options = buildOptions(item.values);
  if (options) {
    field.options = options;
  }

  // width
  const width = mapWidth(item.col);
  if (width) {
    field.width = width;
  }

  return field;
});

const result = {
  fields,
  version: '1.0',
};

fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 4), 'utf-8');

console.log(`Convertiti ${fields.length} campi → ${OUTPUT}`);
