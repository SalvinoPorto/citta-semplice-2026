# Scheduler dei job /api/cron/* dell'office. Build:
#   docker build -t citta-cron infra/produzione/cron
FROM alpine:3.22

# supercronic: cron pensato per i container (gira senza root, log su stdout,
# non avvia un job se l'esecuzione precedente è ancora in corso).
RUN apk add --no-cache curl supercronic tzdata

ENV TZ=Europe/Rome

COPY --chmod=755 chiama.sh /usr/local/bin/chiama
# Default incluso nell'immagine; in Swarm lo sostituisce la config `crontab`.
COPY crontab /etc/citta/crontab

USER nobody
# Percorso assoluto: da PID 1 supercronic si ri-esegue come reaper dei processi
# figli, e con il solo nome fallisce ("Failed to fork exec").
CMD ["/usr/bin/supercronic", "-passthrough-logs", "/etc/citta/crontab"]
