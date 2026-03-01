import { z } from 'zod';

export const stepSchema = z.object({
  id: z.number().optional(),
  descrizione: z.string().min(1, 'La descrizione è obbligatoria'),
  ordine: z.number().int().min(1),
  attivo: z.boolean().default(true),
  pagamento: z.boolean().default(false),
  allegati: z.boolean().default(false),
  allegatiOp: z.boolean().default(false),
  allegatiRequired: z.boolean().default(false),
  allegatiOpRequired: z.boolean().default(false),
  protocollo: z.boolean().default(false),
  unitaOrganizzativa: z.string().optional(),
});

export const moduloSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  slug: z.string().min(1, 'Lo slug è obbligatorio').regex(/^[a-z0-9-]+$/, 'Lo slug può contenere solo lettere minuscole, numeri e trattini'),
  description: z.string().optional(),
  tipo: z.enum(['HTML', 'PDF']).default('HTML'),
  nomeFile: z.string().optional(),
  attributes: z.string().optional(),
  corpo: z.string().optional(),
  dataInizio: z.string().min(1, 'La data di inizio è obbligatoria'),
  dataFine: z.string().min(1, 'La data di fine è obbligatoria'),
  attivo: z.boolean().default(true),

  // Evidence fields
  campiInEvidenza: z.string().optional(),
  campiDaEsportare: z.string().optional(),

  // Unique submission
  unicoInvio: z.boolean().default(false),
  unicoInvioPerUtente: z.boolean().default(false),
  campiUnicoInvio: z.string().optional(),

  // Limits
  numeroMaxIstanze: z.number().int().min(0).nullable().optional(),
  avvisoSoglia: z.number().int().min(0).nullable().optional(),
  msgExtraModulo: z.string().optional(),

  // Final document
  prevedeDocumentoFinale: z.boolean().default(false),
  templateDocumentoFinale: z.string().optional(),
  nomeDocumentoFinale: z.string().optional(),

  // Relations
  servizioId: z.number().int().min(1, 'Seleziona un servizio'),
  ufficioId: z.number().int().nullable().optional(),

  // Steps
  steps: z.array(stepSchema).min(1, 'Aggiungi almeno uno step'),
});

export type StepFormData = z.infer<typeof stepSchema>;
export type ModuloFormData = z.infer<typeof moduloSchema>;
