import { z } from 'zod';

export const servizioSchema = z.object({
  titolo: z.string().min(1, 'Il titolo è obbligatorio'),
  descrizione: z.string().optional(),
  icona: z.string().optional(),
  ordine: z.number().int().min(0).default(0),
  attivo: z.boolean().default(true),
  areaId: z.number().int().min(1, 'Seleziona un\'area'),
});

export type ServizioFormData = z.infer<typeof servizioSchema>;
