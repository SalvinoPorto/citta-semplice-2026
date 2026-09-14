# syntax=docker/dockerfile:1

# Contesto di build: la RADICE del monorepo, non la cartella dell'app.
# Il Dockerfile precedente (citta-semplice-office/Dockerfile) copiava solo il
# package.json dell'app: @citta/db, @citta/storage, @citta/form-schema e
# @citta/integrations non si risolvevano e `npm ci` non poteva funzionare.
#
# Un solo Dockerfile per le due app, selezionate con --build-arg:
#   docker build --build-arg APP=citta-semplice-office -t citta-office .
#   docker build --build-arg APP=citta-semplice-portal -t citta-portal .

# Next 16 richiede Node >= 20.9; usiamo la LTS 22.
ARG NODE_VERSION=22-alpine

# ============================================
# Stage 1: dipendenze
# ============================================
FROM node:${NODE_VERSION} AS deps

RUN apk add --no-cache libc6-compat
WORKDIR /app

# Solo i manifest: così il layer di `npm ci` si invalida quando cambiano le
# dipendenze, non a ogni modifica del codice.
COPY package.json package-lock.json ./
COPY citta-semplice-office/package.json citta-semplice-office/
COPY citta-semplice-portal/package.json citta-semplice-portal/
COPY citta-semplice-migrations/package.json citta-semplice-migrations/
COPY packages/db/package.json packages/db/
COPY packages/form-schema/package.json packages/form-schema/
COPY packages/integrations/package.json packages/integrations/
COPY packages/storage/package.json packages/storage/

# --ignore-scripts: i postinstall (prisma generate, copia degli asset di
# bootstrap-italia) hanno bisogno dei sorgenti, che a questo punto non sono
# ancora stati copiati. Vengono eseguiti espressamente nello stage builder.
RUN npm ci --ignore-scripts

# ============================================
# Stage 2: build
# ============================================
FROM node:${NODE_VERSION} AS builder

ARG APP
RUN test -n "$APP" || { \
      echo "ERRORE: manca --build-arg APP=<citta-semplice-office|citta-semplice-portal>"; \
      exit 1; \
    }

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Lo schema Prisma vive in @citta/db e il client generato finisce in
# packages/db/generated (non in node_modules, ed è in .gitignore): va generato
# qui, altrimenti il build dell'app non trova i tipi.
RUN npm run db:generate -w @citta/db

# Copia gli sprite SVG e il bundle JS di bootstrap-italia in <app>/public.
RUN npm run postinstall -w "$APP"

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Attiva `output: 'standalone'` in next.config.ts
ENV STANDALONE_BUILD=true

RUN npm run build -w "$APP"

# ============================================
# Stage 3: runtime
# ============================================
FROM node:${NODE_VERSION} AS runner

ARG APP
ENV APP=${APP}

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Le immagini Node girano in UTC. Il protocollo dell'SSO dell'ente firma le
# richieste con l'ora locale e le rifiuta se scostano di oltre 30 minuti dalla
# sua (vedi tagOrario in citta-semplice-portal/src/lib/auth/cig-client.ts); lo
# stesso fuso serve alle date mostrate e stampate lato server. Node include i
# dati dei fusi (ICU): su alpine non serve il pacchetto tzdata.
ENV TZ=Europe/Rome

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# In un monorepo lo standalone replica la struttura del workspace: la sua radice
# contiene node_modules/ e <app>/server.js. Verificato sull'output reale del
# build, non presunto.
COPY --from=builder --chown=nextjs:nodejs /app/${APP}/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/${APP}/.next/static ./${APP}/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/${APP}/public ./${APP}/public

# Nessuna COPY del client Prisma, di node_modules/.prisma o di engine binari,
# come faceva il Dockerfile precedente: con Prisma 7 e @prisma/adapter-pg non
# esiste un query engine nativo, e il client generato è già dentro i chunk del
# server (i package @citta/* non compaiono in standalone/node_modules perché
# transpilePackages li inlina). Verificato avviando il bundle standalone e
# ottenendo 200 da /api/ready con una query reale al database.

# Usata solo con STORAGE_DRIVER=local. Con STORAGE_DRIVER=s3 (obbligatorio per
# poter replicare l'app) resta vuota.
RUN mkdir -p /data/uploads && chown -R nextjs:nodejs /data

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Liveness, non readiness: /api/health non interroga il database, così un
# database lento o in riavvio non fa riavviare a cascata tutti i container.
# La verifica del database è su /api/ready, che deve interrogare chi bilancia.
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider "http://127.0.0.1:${PORT}/api/health" || exit 1

# `sh -c` perché il percorso dipende da APP, che va espanso a runtime.
CMD ["sh", "-c", "node ${APP}/server.js"]
