import { z } from 'zod';

export const enteSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  descrizione: z.string().optional(),
  codiceFiscale: z.string().optional(),
  indirizzo: z.string().optional(),
  telefono: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  pec: z.string().email('PEC non valida').optional().or(z.literal('')),
  logo: z.string().optional(),
  attivo: z.boolean().default(true),
});

export type EnteFormData = z.infer<typeof enteSchema>;
