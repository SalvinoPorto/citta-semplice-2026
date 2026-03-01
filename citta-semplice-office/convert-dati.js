#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const INPUT = path.join(__dirname, 'dati.json');
const OUTPUT = path.join(__dirname, 'modulo.json');

// ── helpers ────────────────────────────────────────────────────────────────

function generateId() {
  const rand = Math.random().toString(36).slice(2, 12).padEnd(10, '0');
  return `field_${rand}`;
}

const TYPE_MAP = {
  text: 'text',
  email: 'email',
  date: 'date',
  number: 'number',
  autocomplete: 'select',
  checkbox: 'checkbox',
  paragraph: 'paragraph',
};

function mapType(type) {
  return TYPE_MAP[type] ?? type;
}

function findSelected(values) {
  if (!Array.isArray(values)) return undefined;
  const value = values.find(({ selected, label, value }) => (selected ? value : undefined));
  return value?.value;
}

// ── conversion ─────────────────────────────────────────────────────────────

const dati = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));

const result = dati
.filter(item => (item.type !== 'paragraph'))
.map(item => ({
      id: generateId(),
      name: item.name,
      label: item.label,
      value: item.type === 'checkbox' ? findSelected(item.values) : item.value
  }));

console.log(result)
fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
fs.writeFileSync(OUTPUT, JSON.stringify(result, null, 4), 'utf-8');

console.log(`Convertiti ${result.length} campi → ${OUTPUT}`);
