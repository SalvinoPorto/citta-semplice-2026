import { z } from 'zod';

export const moduloSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  slug: z.string().min(1, 'Lo slug è obbligatorio').regex(/^[a-z0-9-]+$/, 'Lo slug può contenere solo lettere minuscole, numeri e trattini'),
  description: z.string().optional(),
  tipo: z.enum(['HTML', 'PDF']).default('HTML'),
  nomeFile: z.string().optional(),
  attributes: z.string().optional(),
  corpo: z.string().optional(),
  attivo: z.boolean().default(true),
});

export type ModuloFormData = z.infer<typeof moduloSchema>;
