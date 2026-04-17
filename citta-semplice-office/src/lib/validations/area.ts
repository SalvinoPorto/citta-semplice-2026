import { z } from 'zod';

export const areaSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  descrizione: z.string().optional(),
  icona: z.string().optional(),
  ordine: z.number().int().min(0),
  attiva: z.boolean(),
  slug: z.string().min(1, 'Lo slug è obbligatorio').regex(/^[a-z0-9-]+$/, 'Solo lettere minuscole, numeri e trattini'),
});

export type AreaFormData = {
  nome: string;
  descrizione?: string;
  icona?: string;
  ordine: number;
  attiva: boolean;
  slug: string;
};
