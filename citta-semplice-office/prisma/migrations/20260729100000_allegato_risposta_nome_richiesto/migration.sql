-- Gli allegati inviati in risposta a una comunicazione conservano il nome
-- dell'allegato richiesto dall'operatore, così da poter essere elencati
-- insieme agli altri allegati dell'istanza con il relativo "tipo richiesto".
ALTER TABLE "allegati_risposta" ADD COLUMN "nome_file_richiesto" VARCHAR(512);
