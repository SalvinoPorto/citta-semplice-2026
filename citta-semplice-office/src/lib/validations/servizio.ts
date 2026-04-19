import { z } from 'zod';

export const faseSchema = z.object({
  id: z.number().optional(),
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  ordine: z.number().int().min(1),
  ufficioId: z.number().int().nullable().optional(),
});

export const allegatoRichiestoSchema = z.object({
  id: z.number().optional(),
  nomeAllegatoRichiesto: z.string().min(1, 'Il nome è obbligatorio'),
  obbligatorio: z.boolean(),
  interno: z.boolean(),
  soggetto: z.enum(['UT', 'OP']),
});

export const stepSchema = z.object({
  id: z.number().optional(),
  descrizione: z.string().min(1, 'La descrizione è obbligatoria'),
  ordine: z.number().int().min(0),
  attivo: z.boolean(),

  // Allegati
  allegati: z.boolean(),
  allegatiOp: z.boolean(),
  allegatiRequired: z.boolean(),
  allegatiOpRequired: z.boolean(),
  allegatiRichiestiList: z.array(allegatoRichiestoSchema),

  // Protocollo
  protocollo: z.boolean(),
  tipoProtocollo: z.enum(['E', 'U']).optional(), // E = Entrata, U = Uscita
  unitaOrganizzativa: z.string().optional(),
  numerazioneInterna: z.boolean(),

  // Pagamento
  pagamento: z.boolean(),
  pagamentoCodiceTributo: z.string().optional(),
  pagamentoDescrizioneTributo: z.string().optional(),
  pagamentoImporto: z.number().nullable().optional(),
  pagamentoImportoVariabile: z.boolean(),
  pagamentoCausale: z.string().optional(),
  pagamentoCausaleVariabile: z.boolean(),
  pagamentoObbligatorio: z.boolean(),
  pagamentoTipologia: z.string().optional(),
  faseOrdine: z.number().int().min(1), // ordine della fase di appartenenza
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
  ordine: z.number().int().min(0),
  attivo: z.boolean(),
  areaId: z.number().int().min(1, "Seleziona un'area"),

  // Configurazione istanze
  ufficioId: z.number().int().nullable().optional(),
  dataInizio: z.string().optional(),
  dataFine: z.string().optional(),

  // Regole di invio
  unicoInvio: z.boolean(),
  unicoInvioPerUtente: z.boolean(),
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
  attributi: z.string().optional(),
  postFormValidation: z.boolean(),
  postFormValidationAPI: z.string().optional(),
  postFormValidationFields: z.string().optional(),

  // Art. 18 bis L 241/1990
  ricevutaArt18: z.object({
    richiestaArt18: z.boolean(),
    unitaOrganizzativaCompetente: z.string().optional(),
    ufficioCompetente: z.string().optional(),
    responsabileProcedimento: z.string().optional(),
    durataMassimaProcedimento: z.number().int().min(0).nullable().optional(),
    responsabileProvvedimentoFinale: z.string().optional(),
    personaPotereSostitutivo: z.string().optional(),
    urlServizioWeb: z.string().optional(),
    ufficioRicevimento: z.string().optional(),
  }).optional(),

  // Workflow
  fasi: z.array(faseSchema).min(1, 'Almeno una fase è obbligatoria'),
  steps: z.array(stepSchema),
});

export type FaseFormData = z.infer<typeof faseSchema>;
export type StepFormData = z.infer<typeof stepSchema>;
export type ServizioFormData = z.infer<typeof servizioSchema>;
