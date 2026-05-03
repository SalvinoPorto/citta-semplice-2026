# Città Semplice - conversione database
App per la conversione dati dal vecchio formato a quello attuale

## Regole
- In questo documento le vecchie tabelle avranno il prefisso old e le nuove nessun prefisso
- Importa i dati conservando gli id originali per mantenere intatte le relazioni esterne
- Unisci le tabelle old.servizi e old.moduli in una sola tabella servizi con una relazione uno a uno
  - Se nel vecchio archivio un servizio ha più moduli duplica il servizio. A questo scopo:
    - la join ha come tabella destra old.servizi e tabella sinistra old.moduli
    - il nome servizio finale è la concat di old.servizi.titolo + ' ' + old.moduli.nome
    - lo slug finale è la concat di old.servizi.slug + '-' + old.moduli.slug
    - l'id finale sarà quello di old.moduli
- Nell'importare old.step in steps considera che:
  - per ogni workflow di una istanza gli step sono minimo 2 ( Presentazione istanza e conclusione)
- La visibilità dei servizi da parte degli operatori deriva da old.operatori_moduli che però è stata spostata a livello di ufficio a cui appartiene l'operatore per cui va convertito in da operatore-moduli, passando per operatori-servizi, a ufficio-servizi
-nel nuovo schema è stato introdotto il concetto di fase che raggruppa gli step; in questa fase di conversione poni tutti gli step esistemti in una fase unica; osserva i progetti portal e office per capire la logica
- usa il file @migrate-dati.js che contiene parte della logica di conversione e completa la parte mancante, aggiusta l'ordine di import delle tabelle in funzione delle chiavi esterne

##
Prima di iniziare a scrivere codice fai domande se qualcosa non è chiaro
