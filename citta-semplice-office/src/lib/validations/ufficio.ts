import { z } from 'zod';

export const ufficioSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  descrizione: z.string().optional(),
  email: z.email({ message: 'Email non valida' }).optional().or(z.literal('')),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  attivo: z.boolean(),
});

export type UfficioFormData = {
  nome: string;
  descrizione?: string;
  email?: string;
  telefono?: string;
  indirizzo?: string;
  attivo: boolean;
};
