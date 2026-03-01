# Citta Semplice Office

Backoffice per la gestione delle Istanze Online - Comune di Catania.

Migrazione dell'applicazione Spring Boot + Angular 8 a Next.js 14+ fullstack.

## Stack Tecnologico

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Autenticazione**: NextAuth.js (JWT)
- **UI**: Bootstrap Italia 2.x + React
- **Forms**: React Hook Form + Zod
- **Tabelle**: TanStack Table
- **State**: Server Components + React hooks

## Requisiti

- Node.js 20+
- PostgreSQL 15+
- Docker e Docker Compose (opzionale)

## Quick Start con Docker

```bash
# Clona il repository
git clone <repository-url>
cd citta-semplice-office

# Copia il file .env
cp .env.example .env

# Modifica le variabili d'ambiente nel file .env
# Genera un NEXTAUTH_SECRET sicuro:
# openssl rand -base64 32

# Avvia con Docker Compose
docker-compose up -d

# Il seed del database viene eseguito automaticamente al primo avvio
```

L'applicazione sarà disponibile su http://localhost:3000

## Setup Sviluppo Locale

### 1. Installazione dipendenze

```bash
npm install
```

### 2. Configurazione Database

Crea un database PostgreSQL:

```sql
CREATE USER io_user WITH PASSWORD 'password';
CREATE DATABASE io_db OWNER io_user;
```

### 3. Configurazione Environment

```bash
cp .env.example .env
```

Modifica il file `.env` con le tue configurazioni:

```env
DATABASE_URL="postgresql://io_user:password@localhost:5432/io_db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-super-secret-key"
```

### 4. Setup Database

```bash
# Genera il client Prisma
npm run db:generate

# Applica le migrazioni
npm run db:push

# Popola il database con dati iniziali
npm run db:seed
```

### 5. Avvio Server

```bash
npm run dev
```

L'applicazione sarà disponibile su http://localhost:3000

## Credenziali Default

Dopo il seed del database:

- **Email**: admin@comune.catania.it
- **Password**: admin123

## Struttura Progetto

```
citta-semplice-office/
├── src/
│   ├── app/                    # App Router (pagine e API)
│   │   ├── (auth)/             # Pagine non autenticate
│   │   ├── (dashboard)/        # Pagine autenticate
│   │   └── api/                # API Routes
│   ├── components/
│   │   ├── ui/                 # Componenti Bootstrap Italia
│   │   ├── layout/             # Header, Sidebar, Footer
│   │   └── shared/             # DataTable, etc.
│   ├── lib/
│   │   ├── db/                 # Client Prisma
│   │   ├── auth/               # Configurazione NextAuth
│   │   ├── external/           # Urbismart, PMPay
│   │   └── utils/              # Utilities
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript types
├── prisma/
│   ├── schema.prisma           # Schema database
│   └── seed.ts                 # Dati iniziali
└── docker-compose.yml
```

## Funzionalità Principali

### Gestione Istanze
- Lista istanze con filtri e paginazione
- Dettaglio istanza con dati utente e form
- Gestione workflow (avanzamento step, rifiuto, riapertura)
- Upload e download allegati
- Storico workflow

### Gestione Moduli
- CRUD moduli/template form
- Configurazione steps e workflow
- Gestione allegati richiesti
- Configurazione pagamenti

### Organizzazione
- Gestione Enti
- Gestione Aree
- Gestione Servizi
- Gestione Uffici
- Gestione Operatori e Ruoli

### Statistiche
- Dashboard con contatori
- Statistiche giornaliere
- Report pagamenti
- Top moduli per istanze

### Integrazioni
- **Urbismart**: Protocollazione documenti
- **PMPay**: Pagamenti PagoPA

## API Routes

### Autenticazione
- `POST /api/auth/[...nextauth]` - NextAuth.js endpoints

### Upload/Download
- `POST /api/upload` - Upload allegati
- `GET /api/download/[id]` - Download allegato

### Cron Jobs
- `GET /api/cron/payments` - Sincronizzazione pagamenti
- `GET /api/cron/statistics` - Generazione statistiche

### Health Check
- `GET /api/health` - Stato del sistema

## Cron Jobs

I cron jobs sono protetti dall'header `x-cron-secret` e possono essere schedulati esternamente:

```bash
# Sincronizzazione pagamenti (ogni 5 minuti)
curl -H "x-cron-secret: your-secret" http://localhost:3000/api/cron/payments

# Statistiche giornaliere (ogni notte)
curl -H "x-cron-secret: your-secret" http://localhost:3000/api/cron/statistics
```

## Deployment

### Build Produzione

```bash
npm run build
npm start
```

### Docker

```bash
# Build immagine
docker build -t citta-semplice-office .

# Avvia container
docker-compose up -d
```

## Migrazione Dati

Per migrare i dati dal vecchio sistema Spring Boot:

1. Esporta i dati dal database PostgreSQL esistente
2. Adatta lo script di migrazione in `prisma/migrate-data.ts`
3. Esegui la migrazione: `npx tsx prisma/migrate-data.ts`

## Licenza

Proprietario - Comune di Catania
