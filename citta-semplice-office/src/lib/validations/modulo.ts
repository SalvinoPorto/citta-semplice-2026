import { z } from 'zod';

export const moduloSchema = z.object({
  name: z.string().min(1, 'Il nome è obbligatorio'),
  slug: z.string().min(1, 'Lo slug è obbligatorio').regex(/^[a-z0-9-]+$/, 'Lo slug può contenere solo lettere minuscole, numeri e trattini'),
  description: z.string().optional(),
  tipo: z.enum(['HTML', 'PDF']),
  nomeFile: z.string().optional(),
  attributes: z.string().optional(),
  corpo: z.string().optional(),
  attivo: z.boolean(),
});

export type ModuloFormData = {
  name: string;
  slug: string;
  description?: string;
  tipo: 'HTML' | 'PDF';
  nomeFile?: string;
  attributes?: string;
  corpo?: string;
  attivo: boolean;
};
