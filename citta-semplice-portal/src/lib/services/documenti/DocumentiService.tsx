import { Document, Page, Text, View, StyleSheet, Font, renderToBuffer } from '@react-pdf/renderer';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getCampoValue } from '@/lib/utils';

const UPLOAD_DIR = process.env.UPLOAD_DIR ?? '/tmp/allegati';

// La sillabazione automatica di react-pdf spezza le parole italiane in punti
// arbitrari: la disattiviamo mandando a capo la parola intera.
Font.registerHyphenationCallback((word) => [word]);

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

// ─── Stili ───────────────────────────────────────────────────────────────────

const C = {
  ink: '#1a1f26',
  muted: '#6b7684',
  faint: '#aab2bd',
  line: '#e7ebf0',
  lineSoft: '#f0f3f6',
  accent: '#0066cc',
  accentSoft: '#eaf2fb',
  okBg: '#e6f4ea',
  okFg: '#1f7a3d',
  noBg: '#f1f3f5',
  noFg: '#6b7684',
};

const s = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9.5,
    // In react-pdf lineHeight moltiplica l'altezza completa del font (ascender +
    // descender + lineGap), non la sola em: 1 qui rende come `line-height: 1.45` in CSS.
    lineHeight: 1,
    color: C.ink,
    backgroundColor: '#fff',
    paddingTop: '15mm',
    paddingRight: '15mm',
    paddingBottom: '16mm',
    paddingLeft: '15mm',
  },

  // ── Intestazione ──
  docHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  brand: { flex: 1, paddingRight: 16 },
  eyebrow: { fontSize: 7.5, letterSpacing: 1.2, textTransform: 'uppercase', color: C.muted, fontFamily: 'Helvetica-Bold' },
  ente: { fontSize: 20, fontFamily: 'Helvetica-Bold', letterSpacing: -0.4, lineHeight: 1, marginTop: 1, marginBottom: 6 },
  areaTag: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentSoft,
    borderRadius: 20,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  areaTagText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: C.accent },
  titolo: { fontSize: 13, fontFamily: 'Helvetica-Bold', marginTop: 10 },

  protoBox: { flexShrink: 0, minWidth: 150, borderWidth: 1, borderColor: C.line, borderRadius: 8 },
  protoHead: {
    backgroundColor: C.accent,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7,
  },
  protoHeadText: { color: '#fff', fontSize: 7, fontFamily: 'Helvetica-Bold', letterSpacing: 1, textTransform: 'uppercase' },
  protoBody: { paddingVertical: 8, paddingHorizontal: 10 },
  protoNum: { fontSize: 12, fontFamily: 'Helvetica-Bold', letterSpacing: 0.3 },
  protoDate: { fontSize: 8, color: C.muted, marginTop: 2 },
  protoRow: { fontSize: 8, color: C.muted, marginTop: 4 },
  protoRowStrong: { color: C.ink, fontFamily: 'Helvetica-Bold' },

  accentRule: { height: 3, backgroundColor: C.accent, borderRadius: 2, marginTop: 14, marginBottom: 4 },
  sectionLabel: {
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: C.muted,
    marginTop: 18,
    marginBottom: 4,
  },

  // ── Griglia campi ──
  row: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 6 },
  cellLbl: { width: '42%', color: C.muted, paddingRight: 14 },
  cellVal: { flex: 1, fontFamily: 'Helvetica-Bold' },
  empty: { color: C.faint, fontFamily: 'Helvetica' },

  pill: { alignSelf: 'flex-start', borderRadius: 20, paddingVertical: 1, paddingHorizontal: 9 },
  pillYes: { backgroundColor: C.okBg },
  pillNo: { backgroundColor: C.noBg },
  pillText: { fontSize: 8, fontFamily: 'Helvetica-Bold' },
  pillTextYes: { color: C.okFg },
  pillTextNo: { color: C.noFg },

  // ── Firma ──
  foot: { marginTop: 26, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  luogo: { fontSize: 8.5, color: C.muted },
  luogoStrong: { color: C.ink, fontFamily: 'Helvetica-Bold' },
  firma: { minWidth: 200 },
  firmaLine: { borderTopWidth: 1, borderTopColor: C.ink, marginBottom: 3 },
  firmaCap: { fontSize: 7.5, letterSpacing: 0.5, textTransform: 'uppercase', color: C.muted, textAlign: 'center' },

  // ── Ricevuta art.18 ──
  ricBadge: {
    alignSelf: 'flex-start',
    backgroundColor: C.accentSoft,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 10,
    marginTop: 4,
  },
  ricBadgeText: { fontSize: 7.5, fontFamily: 'Helvetica-Bold', letterSpacing: 0.6, textTransform: 'uppercase', color: C.accent },
  ricIntro: {
    borderWidth: 1,
    borderColor: C.line,
    borderLeftWidth: 3,
    borderLeftColor: C.accent,
    borderRadius: 6,
    backgroundColor: '#fafcfe',
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginTop: 16,
    marginBottom: 18,
  },
  ricRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.lineSoft, paddingVertical: 7 },
  ricCellLbl: { width: '46%', color: C.muted, paddingRight: 14 },
  strong: { fontFamily: 'Helvetica-Bold' },
});

const BOOL_YES = new Set(['si', 'sì', 'true', 'x', '✓']);
const BOOL_NO = new Set(['no', 'false']);

/** Rende un valore campo: vuoto → trattino tenue, booleano → pill, altrimenti testo. */
function Valore({ v }: { v: string }) {
  const t = (v ?? '').trim();
  if (!t || t === '—' || t === '-') return <Text style={s.empty}>—</Text>;
  const low = t.toLowerCase();
  if (BOOL_YES.has(low)) {
    return (
      <View style={[s.pill, s.pillYes]}>
        <Text style={[s.pillText, s.pillTextYes]}>Sì</Text>
      </View>
    );
  }
  if (BOOL_NO.has(low)) {
    return (
      <View style={[s.pill, s.pillNo]}>
        <Text style={[s.pillText, s.pillTextNo]}>No</Text>
      </View>
    );
  }
  return <Text>{t}</Text>;
}

/** Cella valore per le liste della ricevuta: testo o trattino tenue. */
function ValoreTesto({ v }: { v: string | number | null | undefined }) {
  const t = v == null ? '' : String(v).trim();
  return t ? <Text>{t}</Text> : <Text style={s.empty}>—</Text>;
}

// ─── Template modulo ──────────────────────────────────────────────────────────

function PaginaModulo({
  nomeEnte,
  sede,
  istanza,
  servizio,
  datiRaw,
}: {
  nomeEnte: string;
  sede: string;
  istanza: DatiIstanzaDoc;
  servizio: DatiServizioDoc;
  datiRaw: string | null | undefined;
}) {
  const campi = parseCampi(datiRaw).filter((c) => c.type !== 'paragraph');

  const metaMunicipalita = istanza.municipalita ? (
    <Text style={s.protoRow}>
      <Text style={s.protoRowStrong}>Municipalità: </Text>
      {istanza.municipalita}
    </Text>
  ) : null;

  return (
    <Page size="A4" style={s.page}>
      <View style={s.docHead}>
        <View style={s.brand}>
          <Text style={s.eyebrow}>Comune di</Text>
          <Text style={s.ente}>{nomeEnte}</Text>
          <View style={s.areaTag}>
            <Text style={s.areaTagText}>{servizio.areaNome}</Text>
          </View>
          <Text style={s.titolo}>{servizio.titolo}</Text>
        </View>

        {istanza.protoNumero ? (
          <View style={s.protoBox} wrap={false}>
            <View style={s.protoHead}>
              <Text style={s.protoHeadText}>Protocollo</Text>
            </View>
            <View style={s.protoBody}>
              <Text style={s.protoNum}>{istanza.protoNumero}</Text>
              {istanza.protoData ? <Text style={s.protoDate}>del {formatData(istanza.protoData)}</Text> : null}
              {metaMunicipalita}
            </View>
          </View>
        ) : istanza.municipalita ? (
          <View style={s.protoBox} wrap={false}>
            <View style={s.protoBody}>{metaMunicipalita}</View>
          </View>
        ) : null}
      </View>

      <View style={s.accentRule} />

      <Text style={s.sectionLabel}>Dati della richiesta</Text>
      <View>
        {campi.map((campo, i) => {
          const label = campo.label ?? campo.name;
          const valore =
            campo.type === 'checkbox' && Array.isArray(campo.values)
              ? campo.values.filter((v) => v.selected).map((v) => v.label).join(', ') || '—'
              : getCampoValue(campo.value);

          return (
            <View key={`${campo.name}-${i}`} style={s.row} wrap={false}>
              <Text style={s.cellLbl}>{label}</Text>
              <View style={s.cellVal}>
                <Valore v={valore} />
              </View>
            </View>
          );
        })}
      </View>

      <View style={s.foot} wrap={false}>
        <Text style={s.luogo}>
          <Text style={s.luogoStrong}>{sede}</Text>, {formatData(istanza.dataInvio ?? new Date())}
        </Text>
        <View style={s.firma}>
          <View style={s.firmaLine} />
          <Text style={s.firmaCap}>Firma del dichiarante</Text>
        </View>
      </View>
    </Page>
  );
}

// ─── Template ricevuta art.18 ─────────────────────────────────────────────────

function PaginaRicevuta({
  nomeEnte,
  istanza,
  servizio,
  ricevuta,
}: {
  nomeEnte: string;
  istanza: DatiIstanzaDoc;
  servizio: DatiServizioDoc;
  ricevuta: DatiRicevuta;
}) {
  const righe: Array<[string, React.ReactNode]> = [
    ['Servizio', <Text key="srv">{servizio.titolo}</Text>],
    ['Unità organizzativa competente', <ValoreTesto key="uoc" v={ricevuta.unitaOrganizzativaCompetente} />],
    ...(ricevuta.ufficioCompetente
      ? ([['Ufficio competente', <Text key="uff">{ricevuta.ufficioCompetente}</Text>]] as Array<[string, React.ReactNode]>)
      : []),
    ['Responsabile del procedimento', <ValoreTesto key="rp" v={ricevuta.responsabileProcedimento} />],
    ...(ricevuta.durataMassimaProcedimento && ricevuta.durataMassimaProcedimento > 0
      ? ([
          ['Durata massima del procedimento', <Text key="dur">{ricevuta.durataMassimaProcedimento} giorni</Text>],
        ] as Array<[string, React.ReactNode]>)
      : []),
    ['Responsabile del provvedimento finale', <ValoreTesto key="rpf" v={ricevuta.responsabileProvvedimentoFinale} />],
    ['Visione degli atti (collegamento)', <ValoreTesto key="url" v={ricevuta.urlServizioWeb} />],
    ['Potere sostitutivo in caso di inerzia', <ValoreTesto key="ps" v={ricevuta.personaPotereSostitutivo} />],
    ['Ufficio per la visione degli atti', <ValoreTesto key="ur" v={ricevuta.ufficioRicevimento} />],
  ];

  return (
    <Page size="A4" style={s.page}>
      <View style={s.docHead}>
        <View style={s.brand}>
          <Text style={s.eyebrow}>Comune di</Text>
          <Text style={s.ente}>{nomeEnte}</Text>
          <View style={s.ricBadge}>
            <Text style={s.ricBadgeText}>Ricevuta · Art. 18-bis L. 241/1990 e L.R. 7/2019</Text>
          </View>
        </View>
      </View>

      <View style={s.accentRule} />

      <View style={s.ricIntro} wrap={false}>
        <Text>
          L&apos;istanza/segnalazione/comunicazione è stata protocollata tramite Protocollo generale del{' '}
          <Text style={s.strong}>{nomeEnte}</Text> al numero{' '}
          <Text style={s.strong}>{istanza.protoNumero ?? '—'}</Text> del{' '}
          <Text style={s.strong}>{formatData(istanza.protoData)}</Text>.
        </Text>
      </View>

      <Text style={s.sectionLabel}>Riferimenti del procedimento</Text>
      <View>
        {righe.map(([label, valore], i) => (
          <View key={`${label}-${i}`} style={s.ricRow} wrap={false}>
            <Text style={s.ricCellLbl}>{label}</Text>
            <View style={s.cellVal}>{valore}</View>
          </View>
        ))}
      </View>
    </Page>
  );
}

// ─── Motore documento → PDF ───────────────────────────────────────────────────

function buildDocumento(
  nomeEnte: string,
  sede: string,
  istanza: DatiIstanzaDoc,
  servizio: DatiServizioDoc,
  datiRaw: string | null | undefined,
  ricevuta?: DatiRicevuta | null,
) {
  return (
    <Document title={servizio.titolo} author={nomeEnte} language="it">
      <PaginaModulo nomeEnte={nomeEnte} sede={sede} istanza={istanza} servizio={servizio} datiRaw={datiRaw} />
      {ricevuta ? (
        <PaginaRicevuta nomeEnte={nomeEnte} istanza={istanza} servizio={servizio} ricevuta={ricevuta} />
      ) : null}
    </Document>
  );
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
  const buf = await renderToBuffer(buildDocumento(nomeEnte, sede, istanza, servizio, datiRaw));
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
  const buffer = await renderToBuffer(buildDocumento(nomeEnte, sede, istanza, servizio, datiRaw, ricevuta));
  const nomeHash = await salvaPdf(buffer);
  return { nomeFile, nomeHash };
}
