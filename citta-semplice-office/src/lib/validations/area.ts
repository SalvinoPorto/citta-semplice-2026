import { z } from 'zod';

export const areaSchema = z.object({
  titolo: z.string().min(1, 'Il titolo è obbligatorio'),
  descrizione: z.string().optional(),
  icona: z.string().optional(),
  ordine: z.number().int().min(0).default(0),
  attiva: z.boolean().default(true),
});

export type AreaFormData = z.infer<typeof areaSchema>;
