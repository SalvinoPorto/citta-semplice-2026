# Runbook — conversione dal DB legacy al go live

Sequenza per portare il database legacy (`io_db`) sullo schema corrente, con la
ricerca delle istanze funzionante e indicizzata, e gli allegati dal filesystem
legacy all'object storage (Garage).

Per l'infrastruttura di destinazione (VM, utenti del database, Garage) vedi
`docs/deploy-proxmox.md`.

Tempi misurati su **308.776 istanze / 650.741 attività / 111.622 utenti**,
PostgreSQL 13.3 con `shared_buffers` a 128 MB (il default). Su una macchina
configurata meglio saranno più bassi.

---

## 0. Pre-flight

```bash
psql "$DATABASE_URL" -c "SELECT version();"
psql "$DATABASE_URL" -c "SHOW shared_buffers;"
psql "$DATABASE_URL" -c "SELECT count(*) FROM pg_available_extensions WHERE name='pg_trgm';"
```

Tre cose da guardare prima di partire:

- **`pg_trgm` deve essere disponibile** (`count = 1`). La migrazione fa
  `CREATE EXTENSION`, che richiede privilegi di superuser o `rds_superuser`. Se
  l'utente applicativo non li ha, l'estensione va creata a mano prima, da un
  utente che li abbia.
- **`shared_buffers` a 128 MB è il default** e va bene solo per un DB giocattolo.
  Con la tabella `istanze` a ~1,7 GB ogni scansione rilegge da disco. Su una
  macchina dedicata metterne 2-4 GB: è una riga di `postgresql.conf` e migliora
  tutto, non solo la ricerca.
- **PostgreSQL 13 è fuori supporto da novembre 2025.** Se il go live è su un
  server nuovo, non nascere già senza patch di sicurezza.

---

## 1. Schema

Su database **vuoto**, in produzione con il job one-shot dello swarm
(`docs/deploy-proxmox.md`, §10.3):

```bash
VERSIONE=v1.0.0 infra/produzione/scripts/migra.sh
```

oppure, da una macchina con il repository:

```bash
cd packages/db
DATABASE_URL=... npx prisma migrate deploy --schema prisma/schema.prisma
```

Applica l'unica migrazione di base, `0_init`: schema Prisma più gli oggetti che
il DSL non esprime (colonna `ricerca`, pg_trgm, funzioni, trigger, indici GIN),
presi da `packages/db/prisma/sql/oggetti-database.sql`.

> **Nota sul DB di sviluppo attuale**: non ha la tabella `_prisma_migrations` —
> lo schema è nato fuori da Prisma. Lì `migrate deploy` proverebbe ad applicare
> `0_init` e fallirebbe su oggetti già esistenti. Per il go live si parte da un
> database vuoto e il problema non si pone; per allineare quello di sviluppo:
> `npx prisma migrate resolve --applied 0_init`.

---

## 2. Disattivare ciò che rallenta l'import

```bash
cd citta-semplice-migrations
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/02-pre-import-ricerca.sql
```

Toglie i due indici GIN e disattiva i trigger di ricerca. Mantenerli durante
300k INSERT costa molto più che ricostruirli in blocco alla fine.

---

## 3. Import

```bash
cp .env.example .env.local     # e compilare con le credenziali dei due DB
npm install
npm run migrate-dati
```

Gira in **una sola transazione**: se un passo fallisce, ROLLBACK totale e il
database resta vuoto, non a metà. È rilanciabile — azzera la destinazione in
testa (tranne `utenti`, vedi i commenti nello script).

Da leggere nell'output, non da scorrere:

- `⚠ N servizi senza ufficio` — le loro fasi finiscono sull'ufficio di default e
  vanno riassegnate a mano dall'amministrazione.
- `⚠ N attività su step disattivati: non importate` — storico che non entra,
  perché lo step soft-deleted non esiste in destinazione. Se il numero è alto,
  fermarsi e decidere se importare anche gli step disattivati.
- I conteggi `X OK, Y errori` di ogni sezione: `Y` deve essere 0.

---

## 4. Allegati: dal filesystem legacy a Garage

Nel legacy i file stanno in `<base>/YYYY/MM/DD/<hash>`, ma `nome_hash` in
database contiene **solo** `<hash>` (99,97% delle righe nel dump demo). Le app
nuove leggono dallo storage la chiave `nome_hash` così com'è: senza questo
passo il portal e le risposte alle comunicazioni rispondono 404 su tutti gli
allegati storici, e solo il download dell'office li ritrova.

`migra-allegati.js` carica ogni file su Garage con chiave `YYYY/MM/DD/<hash>`
e riscrive `nome_hash` con quella chiave.

### Prerequisiti

- Il filesystem legacy **montato in sola lettura** (NFS/SMB) su una macchina
  della VLAN di gestione che raggiunga il database di destinazione (5432) e il
  VIP di Garage (3900). Nel firewall Proxmox aprire la 3900 anche a quella
  macchina, di norma chiusa fuori dalla VLAN applicativa.
- Bucket e chiave con permesso di scrittura: la stessa chiave delle app
  (`garage key info citta-app --show-secret`) o una dedicata da revocare dopo.
- Spazio: `du -sh <base>` sul legacy. Garage tiene 3 copie, una per nodo:
  ogni nodo deve avere almeno quello spazio libero, più la crescita.

### Esecuzione

In `.env.local`, oltre alle `DST_*`, le variabili `LEGACY_DIR` e `S3_*` (vedi
`.env.example`), con gli stessi `S3_BUCKET`, `S3_REGION` ed eventuale
`S3_PREFIX` delle app.

```bash
npm run migra-allegati -- --prova          # nessuna scrittura: solo conteggi e report
npm run migra-allegati -- --concorrenza=16
```

Va lanciato **dopo** il passo 3: legge le righe già importate. È rilanciabile:
- un oggetto già presente con la stessa dimensione non viene ricaricato;
- se si rilancia `migrate-dati` (che riscrive gli hash corti), basta rilanciare
  anche questo, e rifà solo gli UPDATE.

Ogni upload viaggia con `Content-MD5`: Garage rifiuta un file arrivato corrotto
(`InvalidDigest`, verificato), che finisce tra gli errori del report.

### Da leggere nell'output

| Voce | Atteso | Se no |
|---|---|---|
| `mancanti` | **0** | Righe senza file sul legacy: verificare `LEGACY_DIR` e il mount. Se sono file davvero persi, decidere prima del go live (il cittadino vedrà "File non disponibile") |
| `ambigui` | **0** | Lo stesso hash in più cartelle, nessuna nella data della riga: scegliere a mano dal report quale è quello giusto |
| `errori` | **0** | Rete, credenziali, permessi sul bucket: rilanciare, gli upload fatti non si ripetono |
| `file orfani su disco` | informativo | File che nessuna riga usa (istanze non importate, ad esempio su step disattivati). Non vengono caricati: l'elenco in `orfani-allegati-*.txt` serve a decidere se conservarli o scartarli |

Exit code 0 solo con mancanti, ambigui ed errori a zero. I report
(`report-allegati-*.csv`, `orfani-allegati-*.txt`) contengono hash e percorsi:
restano fuori da git e vanno cancellati a migrazione chiusa.

### Prova rapida

```sql
-- Righe non ancora normalizzate: deve essere 0 (a parte mancanti e ambigui del report)
SELECT 'allegati' AS tabella, count(*) FROM allegati WHERE nome_hash !~ '^\d{4}/\d{2}/\d{2}/'
UNION ALL
SELECT 'allegati_risposta', count(*) FROM allegati_risposta WHERE nome_hash !~ '^\d{4}/\d{2}/\d{2}/';
```

Poi da interfaccia: scaricare un allegato storico dal portal (come cittadino) e
dall'office, e l'allegato di una risposta a una comunicazione.

---

## 5. Ricostruire la ricerca

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f sql/03-post-import-ricerca.sql
```

**Non** usare `-1`: contiene un `VACUUM`, che non può stare in transazione.

Riattiva i trigger, fa il backfill (~2 min), ricostruisce gli indici (~30 s),
fa `VACUUM ANALYZE` e verifica. Nell'output finale:

| Controllo | Valore atteso |
|---|---|
| `ricerca_mancanti` | **0** — se no, la ricerca sarà parziale: non andare in produzione |
| `stato` dei due trigger | **`O`** su entrambi (`D` = ancora disabilitati) |
| indici `%trgm` | **due** righe |
| piano dell'`EXPLAIN` finale | deve contenere `Bitmap Index Scan on istanze_ricerca_trgm` |

Se l'ultimo dice `Seq Scan`, quasi sempre manca l'`ANALYZE`: rilanciare
`VACUUM (ANALYZE) istanze;`.

---

## 6. Verifica funzionale

```sql
-- La posizione corrente deve essere coerente: entrambi 0
SELECT count(*) AS aperte_senza_fase
FROM istanze WHERE stato = 'IN_LAVORAZIONE' AND fase_corrente_id IS NULL;

SELECT count(*) AS chiuse_con_fase
FROM istanze WHERE stato IN ('CONCLUSA','RESPINTA') AND fase_corrente_id IS NOT NULL;

-- L'attività corrente deve essere l'ultima per data, non l'ultima inserita
SELECT count(*) AS attivita_corrente_sbagliata
FROM istanze i
JOIN LATERAL (
  SELECT id FROM istanza_attivita a
  WHERE a.istanza_id = i.id
  ORDER BY a.data_variazione DESC, a.id DESC LIMIT 1
) ua ON true
WHERE i.attivita_corrente_id IS DISTINCT FROM ua.id;

-- Le sequenze non devono collidere con gli id importati
SELECT 'istanze' AS tabella, last_value FROM istanze_id_seq
UNION ALL SELECT 'istanza_attivita', last_value FROM workflows_id_seq;
```

> `workflows_id_seq` **non è un errore**: `ALTER TABLE ... RENAME` non rinomina
> la sequenza, quindi quella di `istanza_attivita` porta ancora il vecchio nome.

Per gli allegati, la prova rapida del passo 4 deve dare 0.

Poi, da interfaccia: aprire la lista istanze in office e cercare un cognome
comune. Deve rispondere in decine di millisecondi e trovare le istanze sia per
dati del modulo sia per anagrafica del cittadino.

---

## Se qualcosa va storto

L'intervento sulla ricerca è indipendente dai dati e si annulla senza perderli:

```sql
DROP TRIGGER IF EXISTS "ricerca_su_istanza" ON "istanze";
DROP TRIGGER IF EXISTS "ricerca_su_utente"  ON "utenti";
DROP INDEX  IF EXISTS "istanze_ricerca_trgm";
DROP INDEX  IF EXISTS "istanze_dati_in_evidenza_trgm";
ALTER TABLE "istanze" DROP COLUMN IF EXISTS "ricerca";
```

Va però ripristinato anche il filtro in
`citta-semplice-office/src/app/api/istanze/paged/route.ts`, che senza la colonna
non trova più nulla.

L'import degli allegati non cancella nulla: i file legacy restano dove sono,
e un nuovo `migrate-dati` riporta `nome_hash` alla forma legacy. Gli oggetti già
caricati su Garage restano, e un rilancio di `migra-allegati` li riusa.

---

## Numeri di riferimento

Misurati su questo dataset, prima e dopo l'intervento:

| Operazione | Prima | Dopo |
|---|---|---|
| `COUNT(*)` della lista con filtro cerca | 3081 ms | **4,5 ms** |
| Lista paginata, termine comune | 510 ms | **10,3 ms** |
| Lista paginata, termine inesistente | 4540 ms | **0,04 ms** |
| Ricerca per codice fiscale | passava da subplan su `utenti` | **1,8 ms** |

Copertura verificata identica: 4365 istanze trovate col vecchio OR a cinque
rami, 4365 col nuovo predicato singolo.

Costo: `ricerca` è lunga in media 196 caratteri (il 15% di `dati`), l'indice
GIN pesa **117 MB**, e la tabella passa da 1443 MB a 1687 MB in totale.

### Limite noto

Sotto i **3 caratteri** i trigrammi non si applicano e la ricerca torna al Seq
Scan (~600 ms). È un limite di `pg_trgm`, non una regressione: prima quei
termini costavano comunque 3 secondi. Se dà fastidio, la soluzione è lato UI —
non far partire la ricerca prima del terzo carattere.
