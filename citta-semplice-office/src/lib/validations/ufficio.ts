import { z } from 'zod';

export const ufficioSchema = z.object({
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  descrizione: z.string().optional(),
  email: z.string().email('Email non valida').optional().or(z.literal('')),
  telefono: z.string().optional(),
  indirizzo: z.string().optional(),
  attivo: z.boolean().default(true),
});

export type UfficioFormData = z.infer<typeof ufficioSchema>;
