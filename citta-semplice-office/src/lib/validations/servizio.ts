import { z } from 'zod';

export const allegatoRichiestoSchema = z.object({
  id: z.number().optional(),
  nomeAllegatoRichiesto: z.string().min(1, 'Il nome è obbligatorio'),
  obbligatorio: z.boolean().default(false),
  interno: z.boolean().default(false),
  soggetto: z.enum(['UT', 'OP']).default('UT'),
});

export const stepSchema = z.object({
  id: z.number().optional(),
  descrizione: z.string().min(1, 'La descrizione è obbligatoria'),
  ordine: z.number().int().min(1),
  attivo: z.boolean().default(true),

  // Allegati
  allegati: z.boolean().default(false),
  allegatiOp: z.boolean().default(false),
  allegatiRequired: z.boolean().default(false),
  allegatiOpRequired: z.boolean().default(false),
  allegatiRichiestiList: z.array(allegatoRichiestoSchema).default([]),

  // Protocollo
  protocollo: z.boolean().default(false),
  tipoProtocollo: z.enum(['E', 'U']).optional(), // E = Entrata, U = Uscita
  unitaOrganizzativa: z.string().optional(),
  numerazioneInterna: z.boolean().default(false),

  // Pagamento
  pagamento: z.boolean().default(false),
  pagamentoCodiceTributoId: z.number().int().nullable().optional(),
  pagamentoImporto: z.number().nullable().optional(),
  pagamentoImportoVariabile: z.boolean().default(false),
  pagamentoCausale: z.string().optional(),
  pagamentoCausaleVariabile: z.boolean().default(false),
  pagamentoObbligatorio: z.boolean().default(false),
  pagamentoTipologia: z.string().optional(),
});

export const servizioSchema = z.object({
  // Informazioni base
  titolo: z.string().min(1, 'Il titolo è obbligatorio'),
  sottoTitolo: z.string().optional(),
  descrizione: z.string().optional(),
  comeFare: z.string().optional(),
  cosaServe: z.string().optional(),
  altreInfo: z.string().optional(),
  contatti: z.string().optional(),
  slug: z.string().optional(),
  icona: z.string().optional(),
  ordine: z.number().int().min(0).default(0),
  attivo: z.boolean().default(true),
  areaId: z.number().int().min(1, "Seleziona un'area"),

  // Configurazione istanze
  ufficioId: z.number().int().nullable().optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),

  // Regole di invio
  unicoInvio: z.boolean().default(false),
  unicoInvioPerUtente: z.boolean().default(false),
  campiUnicoInvio: z.string().optional(),
  numeroMaxIstanze: z.number().int().min(0).nullable().optional(),
  msgSopraSoglia: z.string().optional(),
  msgExtraServizio: z.string().optional(),

  // Visualizzazione
  campiInEvidenza: z.string().optional(),
  campiDaEsportare: z.string().optional(),

  // Documento finale
  // prevedeDocumentoFinale: z.boolean().default(false),
  // templateDocumentoFinale: z.string().optional(),
  // nomeDocumentoFinale: z.string().optional(),

  // Modulo (form dati richiedente)
  moduloTipo: z.enum(['HTML', 'PDF']).default('HTML'),
  attributi: z.string().optional(),
  postFormValidation: z.boolean().default(false),
  postFormValidationAPI: z.string().optional(),
  postFormValidationFields: z.string().optional(),

  // Workflow
  steps: z.array(stepSchema).default([]),
});

export type StepFormData = z.infer<typeof stepSchema>;
export type ServizioFormData = z.infer<typeof servizioSchema>;
