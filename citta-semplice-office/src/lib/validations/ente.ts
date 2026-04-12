import { z } from 'zod';

export const enteSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  descrizione: z.string().optional(),
  codiceFiscale: z.string().optional(),
  indirizzo: z.string().optional(),
  telefono: z.string().optional(),
  email: z.email({ message: 'Email non valida' }).optional().or(z.literal('')),
  pec: z.email({ message: 'PEC non valida' }).optional().or(z.literal('')),
  logo: z.string().optional(),
  attivo: z.boolean(),
});

export type EnteFormData = {
  nome: string;
  descrizione?: string;
  codiceFiscale?: string;
  indirizzo?: string;
  telefono?: string;
  email?: string;
  pec?: string;
  logo?: string;
  attivo: boolean;
};
