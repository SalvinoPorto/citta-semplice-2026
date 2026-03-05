import { z } from 'zod';

export const operatoreSchema = z.object({
  email: z.string().email('Email non valida'),
  userName: z.string().min(1, 'Il nome utenteè obbligatorio'),
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri').optional(),
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  cognome: z.string().min(1, 'Il cognome è obbligatorio'),
  // codiceFiscale: z.string().length(16, 'Il codice fiscale deve avere 16 caratteri').optional().or(z.literal('')),
  telefono: z.string().optional(),
  attivo: z.boolean().default(true),
  ruoliIds: z.array(z.number()).min(1, 'Seleziona almeno un ruolo'),
  serviziIds: z.array(z.number()).default([]),
});

export const operatoreCreateSchema = operatoreSchema.extend({
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
});

export type OperatoreFormData = z.infer<typeof operatoreSchema>;
export type OperatoreCreateFormData = z.infer<typeof operatoreCreateSchema>;
