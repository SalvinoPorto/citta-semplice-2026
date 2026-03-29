import PDFDocument from 'pdfkit';
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
  intestazione: string | null;
  corpo: string | null;
  footer: string | null;
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

function sostituisciVariabili(testo: string | null | undefined, vars: Record<string, string>): string {
  if (!testo) return '';
  return Object.entries(vars).reduce(
    (acc, [key, val]) => acc.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), val ?? ''),
    testo
  );
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

// ─── Scrittura modulo su PDFDocument ─────────────────────────────────────────

function scriviModulo(
  doc: InstanceType<typeof PDFDocument>,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
): void {
  const campi = parseCampi(datiRaw).filter((c) => c.type !== 'paragraph');

  const COL_LABEL = 50;
  const COL_VALUE = 220;
  const PAGE_WIDTH = 545;

  doc.fontSize(14).font('Helvetica-Bold').text('Comune di Catania', { align: 'center' });
  doc.fontSize(12).font('Helvetica-Bold').text(servizio.areaNome, { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(servizio.titolo, { align: 'center' });
  doc.moveDown(0.5);

  if (istanza.protoNumero) {
    doc.fontSize(10).text(`N° Protocollo: ${istanza.protoNumero}`);
    if (istanza.protoData) doc.text(`Data protocollo: ${formatData(istanza.protoData)}`);
  }

  if (istanza.municipalita) {
    doc.fontSize(10).text(`Municipalità: ${istanza.municipalita}`);
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);

  doc.fontSize(9).font('Helvetica');

  for (const campo of campi) {
    if (doc.y > 730) doc.addPage();

    const label = campo.label ?? campo.name;

    if (campo.type === 'checkbox' && Array.isArray(campo.values)) {
      doc.font('Helvetica-Bold').text(label, COL_LABEL, doc.y, { width: PAGE_WIDTH - COL_LABEL });
      const selezionati = campo.values.filter((v) => v.selected).map((v) => v.label);
      doc.font('Helvetica').text(
        selezionati.join(', ') || '—',
        COL_VALUE,
        doc.y - doc.currentLineHeight(),
        { width: PAGE_WIDTH - COL_VALUE },
      );
    } else {
      const y = doc.y;
      doc.font('Helvetica').fillColor('#555555').text(label, COL_LABEL, y, { width: COL_VALUE - COL_LABEL - 10 });
      doc.font('Helvetica-Bold').fillColor('#000000').text(campo.value || '—', COL_VALUE, y, { width: PAGE_WIDTH - COL_VALUE });
    }

    doc.moveDown(0.3);
  }

  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.5);
  doc.fontSize(9).font('Helvetica').fillColor('#000000')
    .text(`Catania, ${formatData(istanza.dataInvio ?? new Date())}`, { align: 'right' });
}

// ─── Scrittura ricevuta art.18 su PDFDocument ─────────────────────────────────

function scriviRicevuta(
  doc: InstanceType<typeof PDFDocument>,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  ricevuta: DatiRicevuta,
): void {
  const vars: Record<string, string> = {
    protoNumero: istanza.protoNumero ?? '',
    protoData: formatData(istanza.protoData),
    dataInvio: formatData(istanza.dataInvio),
    servizioTitolo: servizio.titolo,
    areaNome: servizio.areaNome,
    istanzaId: String(istanza.id),
  };

  const intestazione = sostituisciVariabili(ricevuta.intestazione, vars);
  const corpo = sostituisciVariabili(ricevuta.corpo, vars);
  const footer = sostituisciVariabili(ricevuta.footer, vars);

  doc.fontSize(14).font('Helvetica-Bold').text('Comune di Catania', { align: 'center' });
  doc.moveDown(0.5);
  doc.fontSize(11).font('Helvetica-Bold')
    .text("Ricevuta ai sensi dell'art. 18 bis L. 241/1990 e L.R. 7/2019", { align: 'center' });
  doc.moveDown();
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown();

  if (intestazione) {
    doc.fontSize(10).font('Helvetica-Bold').text(intestazione);
    doc.moveDown();
  }

  if (corpo) {
    doc.fontSize(10).font('Helvetica').text(corpo, { align: 'justify' });
    doc.moveDown();
  } else {
    doc.fontSize(10).font('Helvetica')
      .text("L'istanza è stata protocollata con il numero ", { continued: true })
      .font('Helvetica-Bold').text(istanza.protoNumero ?? '—', { continued: true })
      .font('Helvetica').text(` del ${formatData(istanza.protoData)}.`);
    doc.moveDown();
    doc.text(`Servizio: ${servizio.titolo}`);
    doc.moveDown();
  }

  if (footer) {
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#555555').text(footer, { align: 'center' });
  }

  doc.moveDown();
  doc.fontSize(9).fillColor('#000000').font('Helvetica')
    .text(`Catania, ${formatData(istanza.dataInvio ?? new Date())}`, { align: 'right' });
}

// ─── API pubblica ─────────────────────────────────────────────────────────────

/**
 * Genera il modulo in memoria (senza proto numero).
 * Usato per inviare il documento al sistema di protocollo esterno.
 */
export async function generaModuloBuffer(
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
): Promise<ArrayBuffer> {
  const buf = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    scriviModulo(doc, istanza, servizio, datiRaw);
    doc.end();
  });
  // slice() crea sempre un ArrayBuffer (non SharedArrayBuffer)
  const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  return ab as ArrayBuffer;
}

/**
 * Genera il documento finale (modulo con proto numero + ricevuta art.18 accodata su nuova pagina
 * se configurata) e lo salva su disco.
 * Chiamare DOPO aver ottenuto il numero di protocollo.
 */
export async function generaDocumentoPdf(
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
  ricevuta?: DatiRicevuta | null,
): Promise<AllegatoCreato> {
  const nomeFile = `modulo_istanza_${istanza.id}.pdf`;

  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    scriviModulo(doc, istanza, servizio, datiRaw);

    if (ricevuta) {
      doc.addPage();
      scriviRicevuta(doc, istanza, servizio, ricevuta);
    }

    doc.end();
  });

  const nomeHash = await salvaPdf(buffer);
  return { nomeFile, nomeHash };
}
