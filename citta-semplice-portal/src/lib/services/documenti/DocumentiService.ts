import puppeteer from 'puppeteer';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';

// ─── Tipi ────────────────────────────────────────────────────────────────────

export type CampoModulo = {
  name: string;
  label: string;
  value: string;
  type?: string;
  values?: Array<{ label: string; selected: boolean }>;
  placeholder?: string;
};

export type DatiServizioDoc = {
  titolo: string;
  areaNome: string;
};

export type DatiIstanzaDoc = {
  id: number;
  protoNumero: string | null;
  protoData: Date | null;
  dataInvio: Date | null;
  municipalita: string | null;
};

export type DatiRicevuta = {
  id: number;
  servizioId: number;
  richiestaArt18: boolean;
  unitaOrganizzativaCompetente: string | null;
  ufficioCompetente: string | null;
  responsabileProcedimento: string | null;
  durataMassimaProcedimento: number | null;
  responsabileProvvedimentoFinale: string | null;
  personaPotereSostitutivo: string | null;
  urlServizioWeb: string | null;
  ufficioRicevimento: string | null;
};

export type AllegatoCreato = {
  nomeFile: string;
  nomeHash: string;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseCampi(datiRaw: string | null | undefined): CampoModulo[] {
  if (!datiRaw) return [];
  try {
    const parsed = JSON.parse(datiRaw);
    return Array.isArray(parsed) ? (parsed as CampoModulo[]) : [];
  } catch {
    return [];
  }
}

function formatData(d: Date | null | undefined): string {
  if (!d) return '';
  return new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(d);
}

async function salvaPdf(buffer: Buffer): Promise<string> {
  const now = new Date();
  const relDir = join(
    String(now.getFullYear()),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
  );
  const absDir = join(UPLOAD_DIR, relDir);
  await mkdir(absDir, { recursive: true });
  const uuid = randomUUID();
  await writeFile(join(absDir, uuid), buffer);
  return join(relDir, uuid);
}

// ─── CSS comune ──────────────────────────────────────────────────────────────

const CSS_BASE = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-size: 10pt;
    color: #000;
    background: #fff;
    margin: 15mm;
  }
  h1 { font-size: 13pt; text-align: center; margin-bottom: 4px; }
  h2 { font-size: 11pt; text-align: center; font-weight: bold; margin-bottom: 4px; }
  h3 { font-size: 10pt; text-align: center; font-weight: normal; margin-bottom: 12px; }
  .divider { border: none; border-top: 1px solid #000; margin: 10px 0; }
  .meta { font-size: 9pt; margin-bottom: 4px; }
  .data-fine { font-size: 9pt; text-align: right; margin-top: 16px; }

  /* Campi modulo */
  .campo { display: flex; align-items: flex-start; }
  .campo-label { flex: 0 0 160px; color: #555; padding-right: 10px; }
  .campo-value { flex: 1; font-weight: bold; }

  /* Ricevuta */
  .ricevuta-title { font-size: 10pt; text-align: center; font-weight: bold; margin-bottom: 16px; }
  .ricevuta-row { margin-bottom: 10px; line-height: 1.5; }
  .ricevuta-row strong { font-weight: bold; }

  @media print {
    body { padding: 0; }
    .page-break { page-break-before: always; }
  }
`;

// ─── Template modulo ──────────────────────────────────────────────────────────

function buildModuloHtml(
  nomeEnte: string,
  sede: string,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
): string {
  const campi = parseCampi(datiRaw).filter((c) => c.type !== 'paragraph');

  const righe = campi.map((campo) => {
    const label = campo.label ?? campo.name;
    let valore: string;

    if (campo.type === 'checkbox' && Array.isArray(campo.values)) {
      const selezionati = campo.values.filter((v) => v.selected).map((v) => v.label);
      valore = selezionati.join(', ') || '—';
    } else {
      valore = campo.value || '—';
    }

    return `
      <div class="campo">
        <div class="campo-label">${label}</div>
        <div class="campo-value">${valore}</div>
      </div>`;
  }).join('');

  const metaProto = istanza.protoNumero
    ? `<p class="meta"><strong>N° Protocollo:</strong> ${istanza.protoNumero}</p>
       ${istanza.protoData ? `<p class="meta"><strong>Data protocollo:</strong> ${formatData(istanza.protoData)}</p>` : ''}`
    : '';

  const metaMunicipalita = istanza.municipalita
    ? `<p class="meta"><strong>Municipalità:</strong> ${istanza.municipalita}</p>`
    : '';

  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>${CSS_BASE}</style>
</head>
<body>
  <h1>${nomeEnte}</h1>
  <h2>${servizio.areaNome}</h2>
  <h3>${servizio.titolo}</h3>
  ${metaProto}
  ${metaMunicipalita}
  <hr class="divider">
  ${righe}
  <hr class="divider">
  <p class="data-fine">${sede}, ${formatData(istanza.dataInvio ?? new Date())}</p>
</body>
</html>`;
}

// ─── Template ricevuta art.18 ─────────────────────────────────────────────────

function buildRicevutaHtml(
  nomeEnte: string,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  ricevuta: DatiRicevuta,
): string {
  const durataRiga = ricevuta.durataMassimaProcedimento && ricevuta.durataMassimaProcedimento > 0
    ? `<div class="ricevuta-row">La durata massima del procedimento è di ${ricevuta.durataMassimaProcedimento} giorni</div>`
    : '';

  const ufficioRiga = ricevuta.ufficioCompetente
    ? `<div class="ricevuta-row">L'ufficio competente è: ${ricevuta.ufficioCompetente}</div>`
    : '';

  return `
  <div class="page-break">
    <h1>${nomeEnte}</h1>
    <p class="ricevuta-title">Ai sensi dell'art. 18 bis L. 241/1990 e L.R. 7/2019</p>
    <hr class="divider">
    <div class="ricevuta-row">
      L'istanza/segnalazione/comunicazione è stata protocollata tramite Protocollo generale del ${nomeEnte}
      al numero <strong>${istanza.protoNumero ?? '—'}</strong> del ${formatData(istanza.protoData)}.
    </div>
    <div class="ricevuta-row">Servizio: <strong>${servizio.titolo}</strong></div>
    <div class="ricevuta-row">L'unità organizzativa competente è: ${ricevuta.unitaOrganizzativaCompetente ?? '—'}</div>
    ${ufficioRiga}
    <div class="ricevuta-row">Il Responsabile del Procedimento è: ${ricevuta.responsabileProcedimento ?? '—'}</div>
    ${durataRiga}
    <div class="ricevuta-row">Il Responsabile del Provvedimento Finale è: ${ricevuta.responsabileProvvedimentoFinale ?? '—'}</div>
    <div class="ricevuta-row">
      Attraverso il seguente collegamento potrà prendere visione degli atti inerenti la sua pratica:
      ${ricevuta.urlServizioWeb ?? '—'}
    </div>
    <div class="ricevuta-row">
      La persona e/o l'Unità Organizzativa cui è possibile rivolgersi in caso di inerzia del Responsabile è:
      ${ricevuta.personaPotereSostitutivo ?? '—'}
    </div>
    <div class="ricevuta-row">
      L'ufficio presso il quale potrà prendere visione degli atti inerenti la sua pratica è:
      ${ricevuta.ufficioRicevimento ?? '—'}
    </div>
  </div>`;
}

// ─── Motore HTML → PDF ────────────────────────────────────────────────────────

async function htmlToPdf(html: string): Promise<Buffer> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

/**
 * Genera il modulo in memoria (senza proto numero).
 * Usato per inviare il documento al sistema di protocollo esterno.
 */
export async function generaModuloBuffer(
  nomeEnte: string,
  sede: string,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
): Promise<ArrayBuffer> {
  const html = buildModuloHtml(nomeEnte, sede, istanza, servizio, datiRaw);
  const buf = await htmlToPdf(html);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

/**
 * Genera il documento finale (modulo con proto numero + ricevuta art.18 accodata su nuova pagina
 * se configurata) e lo salva su disco.
 * Chiamare DOPO aver ottenuto il numero di protocollo.
 */
export async function generaDocumentoPdf(
  nomeEnte: string,
  sede: string,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
  ricevuta?: DatiRicevuta | null,
): Promise<AllegatoCreato> {
  const nomeFile = `modulo_istanza_${istanza.id}.pdf`;

  let html = buildModuloHtml(nomeEnte, sede, istanza, servizio, datiRaw);

  if (ricevuta) {
    const bodyClose = html.lastIndexOf('</body>');
    const ricevutaHtml = buildRicevutaHtml(nomeEnte, istanza, servizio, ricevuta);
    html = html.slice(0, bodyClose) + ricevutaHtml + html.slice(bodyClose);
  }

  const buffer = await htmlToPdf(html);
  const nomeHash = await salvaPdf(buffer);
  return { nomeFile, nomeHash };
}
