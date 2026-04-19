import { z } from 'zod';

export const operatoreSchema = z.object({
  email: z.email({ message: 'Email non valida' }),
  userName: z.string().min(1, 'Il nome utente è obbligatorio'),
  password: z.string().optional().refine(val => !val || val.length >= 6, 'La password deve avere almeno 6 caratteri'),
  nome: z.string().min(1, 'Il nome è obbligatorio'),
  cognome: z.string().min(1, 'Il cognome è obbligatorio'),
  telefono: z.string().optional(),
  attivo: z.boolean(),
  ruoliIds: z.array(z.number()).min(1, 'Seleziona almeno un ruolo'),
  ufficioId: z.number().nullable().optional(),
});

export const operatoreCreateSchema = operatoreSchema.extend({
  password: z.string().min(6, 'La password deve avere almeno 6 caratteri'),
});

export type OperatoreFormData = {
  email: string;
  userName: string;
  password?: string;
  nome: string;
  cognome: string;
  telefono?: string;
  attivo: boolean;
  ruoliIds: number[];
  ufficioId?: number | null;
};

export type OperatoreCreateFormData = OperatoreFormData & {
  password: string;
};
