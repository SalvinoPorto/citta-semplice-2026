Facciamo ordine:
- i servizi rivolti al cittadino sono raggruppati per aree.
- ogni servizio ha un solo modulo per l'inserimento dei dati del richiedente
- il servizio, dalla richiesta da parte del cittadino fino all'erogazione da parte dell'ente segue un iter o timeline stabilito alla creazione del servizio.
- l'iter è formato da fasi o passi. il primo passo di ogni iter è sempre l'invio o la presentazione dell'istanza di fruizione del servizio offerto, l'ultimo passo è sempre la conclusione o chiusura dell'iter. 
- ogni passo ha uno stato, quando si attiva quel passo sarà in stato "In Attesa", quando si conclude per passare al successivo sarà in stato "Terminato"
- ogni passo può prevedere una o più delle seguenti cose:
  - il rilascio di un numero di protocollo e per questo vengono chiamate delle api ad applicativo esterno.
    deve essere prevista la possibilità di selezionare se il protocollo è in usscita o in entrata e la possibilità di selezionare l'unità organizzativa all'interno dell'areaorganizzzativa omogenea.
      - stabiliremo in seguito se questa lista va popolata da un database locale all'pplicazione o da apposita chiamata api all'applicativo di protocollo
  - la richiesta di documenti che il richiedente o l'operatore deve allegare e quindi la possibilità di upload di file;
  questi documenti devono essere visibili e consultabili in qualunque momento del processo, anche dopo la conclusione dell'iter.
  - la richiesta di un pagamento tramite PagoPA e per questo vengo chiamate delle api ad applicativo esterno; in fase di creazione di questa tipologia di step deve esse data la possibilità al gestore di selezionare il codice del tributo da prelevare da apposita chiamata api al sistema di pagamento, decidere se la quota è fissa e quindi indicarla in apposito campo, la causale anche questa fissa o variabile. se la quota non è fissa verrà chiesto all'operatore che avanza l'iter di inserire la cifra in apposito campo.lo stesso per la causale il codice tributo, la cifra, la causale e i dati del richiedente servianno come parametri per la chiamata api al sistema di pagamento per generare il bollettino di pagamento che deve essere inserito nella timeline per essere visibile all'operatore e al richiedente
  - la possibilità per l'operatore di allegare documenti rivolti al richiedente; qundo si attiva questa modalità, durante l'avanzamento del processo verrà data la possibilità all'operatore di fare l'upload di documenti per renderli disponibili al richiedente 
- inoltre deve essere possibile durante la durata del processo scandito dalla timeline, inserire comunicazioni rivolte al richiedente. 
la timeline con i vari passi ed eventuali richieste, così come le comunicazioni saranno visibili al richiedente nella propria area personale dell'applicazione web a lui dedicata che faremo in un secondo tempo.

A questo punto i punti da risolvere sono:
- unire il componente modulo e servizio in una unica entità: il servizo è distinto dal modulo che deve essere compilato. Se in fase di erogazione dei servizi si rende necessario modificare il modulo, il servizio viene disattivato, clonato, modificato in uno nuovo e reso operativo al posto del precedente. Attributi importanti sono quindi il flag attivo/disattivo e le date di inizio e fine validità del servizio.
- trovare un modo coerente per fare avanzare la timeline da parte dell'operatore e di inserire comunicazioni/avvisi per l'utente
- dare la possibilità all'operatore di retrocedere di un passo nel caso si debbano soddisfare condizioni, in modo da creare piccoli loop.
- se per qualche ragione insanabile la richiesta del servizio non può essere soddisfatta, dare la possibilità all'operatore di respingere l'istanza chiudendo l'iter forzatamente. il respingimento deve prevedere un campo da compilare a cura dell'operatore con il motivo del rifiuto, prevedere eventualmente anche degli allegati ( provvedimento di respingimento per es.)
- l'invio da parte del richiedente fa scattare l'inizio del primo step previsto per quel servizio che quindi sarà in stato "In Attesa"

Nella cartella /home/salvino/Scaricati/citta-semplice-main/urbismart/liburbismart si trova una libreria Java per interfacciarsi con l'applicativo di protocollo e nella cartella /home/salvino/Scaricati/citta-semplice-main/PMPay/libpmpay una libreria Java per interfacciarsi con l'applicativo dei pagamenti PagoPA: analizzalim trducili in typescript e adattali a questa applicazione