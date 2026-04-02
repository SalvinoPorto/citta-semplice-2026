Task: integrazione sistema di pagamento PagoPA 

## Obiettivo
Implementare il servizio di collegamento alle API PmPay, servizio di pagamento PagoPA in cloud.

## Contesto
Durante la creazione di uno step del workflow di un servizio, è possibile richiedere un pagamento all'utenza che deve avvenire tramita la piattaforma PagoPA.

Nuovo comportamento richiesto:
- quando si seleziona il flago "Riichiesto un pagamento" la lista dei servizi, dove per servizio in questo caso si intende i possibili tributi che sono stati defini all'interno della piattaforma PmPay, deve essere popolata appunto con la descrizione di questi tributi e prelevarne il codice;
Così come per l'elenco degli uffici di protocollo è preferibile effettuare la chiamata API che ricava questo elenco una volta al caricamento della pagina di creazione/modifica del servizio (istanza)

- Il file @public/PMPAY 1.21.postman_collection.json contiene un progetto Postman che utilizza le chiamate API al servizio cloud PmPay
- Il file @public/api-pmpay.yaml contiene lo swagger di queste API
Questi file devono essere usati come riferimento principale per:
- endpoint API;
- autenticazione;
- header richiesti;
- payload;
- ordine delle chiamate;
- esempi di risposta;
- eventuali variabili di ambiente.

## Risultato atteso
Implementazione dei seguenti metodi:
- Autenticazione: POST /autenticazione
- ListaServizi: GET /ente/{codiceEnte}/servizio
- NuovoPagamento: POST /ente/{codiceEnte}/pagamento
- OttieniBollettino: GET /ente/{codiceEnte}/pagamento/{iuv}/bollettino
- GetUrlPagamento: POST /ente/{codiceEnte}/pagamento/{iuv}/urlpagamento
- GetReceiptPayment: GET /ente/{codiceEnte}/receipt/{identificativoPagamento}
- GetPaymentDetail: GET /ente/{codiceEnte}/pagamento/{identificativoPagamento}



## Requisiti funzionali
- Intercettare il flusso di salvataggio dello step conclusione.
- Prima della conferma finale del salvataggio, invocare il servizio di protocollo cloud.
- Mappare i dati della richiesta interna nel payload richiesto dal servizio esterno.
- Salvare nella richiesta i dati restituiti dal protocollo.
- Mostrare all'operatore l’esito della protocollazione nel dettaglio istanza.
- Se la protocollazione fallisce, applicare la regola di business concordata:
  - generare un numero progressivo interno all'applicazione preceduto dal prefisso 'PE_' per riconoscerlo dai veri numeri di protocollo.
- Rendere configurabili URL base, credenziali, token, timeout e altri parametri di integrazione, inserire le variabili nel file .env.

## Requisiti tecnici
- Analizzare il progetto Postman per ricostruire il flusso completo di integrazione.
- Non duplicare logica già esistente se è presente un client HTTP comune o un layer integrazioni. 
- Implementare un service dedicato, ad esempio `PmPayService`, isolando la logica verso il provider esterno.
- Separare:
  - mapping dominio -> DTO esterno;
  - client HTTP;
  - orchestrazione del caso d’uso;
  - persistenza dei dati di pagamento.
- Gestire autenticazione secondo quanto definito in Postman (Bearer token, API key, OAuth, login preliminare, ecc.).
- Prevedere logging strutturato delle chiamate esterne, evitando di registrare dati sensibili o segreti in chiaro.
- Gestire timeout, errori transitori e risposte inattese.

## Dati da memorizzare
Verificare in base alla risposta del servizio quali campi siano disponibili. In generale prevedere:
- IUV identificativo unico di versamento;
- data versamento;
- stato del pagamento;

## Flusso previsto
1. L'operatore avanza l'iter ( workflow ) ed entra in una fase (step) che prevede un pagamento:
  1.1. deve essere mostrato un form che preveda:
    1.1.1 Un testo statico che mostri codice e descrizione tributo
    1.1.2 Un campo codice fiscale popolato con il codice fiscale del richiedente loggato ma modificable se altro pagatore;
    1.1.3 Un campo Anagrafica pagatore popolato con il nome e cognome del richiedente ma modificabile se altro pagatore;
    1.1.4 Importo: 
       1.1.4.1 Se, in fase di creazione dello step è stato selezionato Importo fisso viene mostrato l'importo indicato in un campo statico non modificabile
       1.1.4.2 Se l'importo è variabile va mostrato un campo numerico obbligatorio
    1.1.5 Causale:
       1.1.5.1 Se, in fase di creazione dello step è stato selezionata Causale fissa viene mostrata in un campo statico non modificabile
       1.1.5.2 Se la causale è variabile va mostrato un campo testo  obbligatorio lungo al massimo 50 caratteri
    1.1.6 Un bottone di submit che tramite i metodi implementati:
       1.1.6.1 generi un nuovo pagamento, chiamata API e scrittura su tabella pagamenti_effettuati
       1.1.6.2 ottenga il bollettino di pagamento
       1.1.6.3 ottenga l'url del pagamento
  1.2 Completata l'operazione di generazione del bollettino, ottenuto lo stesso va aggiunto tra gli allegati generati dall'operatore per essere visualizzato dall'utente tramite la propria area personale del portal. Allo stesso modo deve essere mostrato il link ottenuto per rinviare l'utente alla piattaforma di pagamento per effettuare lo stesso online. 
2. Se il pagamento è stato dichiarato obbligatorio in fase di creazione dello step,
non sarà possibile avanzare di step senza la conferma dell'avvenuto pagamento.
3. Se il pagamento non è obbligatorio, per proseguire l'operatore deve comunque confermare sotto la propria responsabilità che il pagamento è stato effettuato.
4. Lo stato di pagamento effettuato deve essere visibile sia sul backoffice che sul portal e consentire all'operatore e all'utente dal portal di scaricare la ricevuta di pagamento tramite il metodo GetReceiptPayment.
5. I pagamenti devono essere confermati da un task asincrono ( daemon ) che ad intervalli regolari configurabile interroghi il sistema PmPAy tramite il metodo GetPaymentDetail che scorra un elenco di fornito per es. dau una query del genere : SELECT * FROM pagamenti_effettuati WHERE id_iuv IS NOT NULL AND stato < 4 AND data_scadenza > CURRENT_DATE

## Analisi preliminare richiesta
Prima di sviluppare, eseguire queste verifiche:
1. Identificare nel progetto Postman tutte le request coinvolte.
2. Verificare se esistono prerequisiti: autenticazione, recupero classifiche, allegati, conferma finale, ecc.
3. Identificare campi obbligatori e facoltativi.
4. Verificare codici di errore e semantica delle risposte.
5. Verificare se esistono ambienti diversi: test, collaudo, produzione.
6. Documentare le variabili Postman da trasformare in configurazione applicativa.

## Strategia di implementazione proposta
- Creare un client dedicato per il servizio di pagamenti.
- Importare/consultare il progetto Postman come specifica operativa.
- Estrarre in configurazione:
  - base URL;
  - endpoint;
  - credenziali;
  - header custom;
  - timeout.
- Implementare un orchestratore applicativo nel caso d’uso di avanzamento step.
- Aggiornare il modello dati  se occorre, per contenere gli estremi del pagamento.
- Aggiornare il frontend per mostrare:
  - creazione nuovo pagamento riuscito con bollettino allegato e link per pagamento online;
  - errore di generazione pagamento;
  - eventuale stato intermedio.
- Aggiungere log e metriche.

## Output richiesto a Claude Code
1. Analizzare il progetto Postman disponibile.
2. Ricostruire il flusso API necessario alla progestione dei pagamenti.
3. Individuare i punti del codice in cui agganciare la creazione del pagamento.
4. Proporre il design tecnico minimo invasivo.
5. Implementare la feature.
6. Aggiornare eventuali DTO, entity, service, repository e UI coinvolti.
7. Scrivere una breve documentazione tecnica finale con:
   - endpoint usati;
   - configurazioni necessarie;
   - sequenza delle chiamate;
   - casi di errore gestiti.

## Vincoli
- Riutilizzare il più possibile il progetto Postman come fonte di verità.
- Evitare hardcode di credenziali e URL.
- Non modificare il comportamento di salvataggio per casi non coinvolti.
- Mantenere compatibilità con l’architettura attuale del progetto.

## Note operative
Usare il progetto Postman in JSON per:
- ispezionare collection;
- variabili;
- auth;
- esempi di body;
- script pre-request o test utili a capire il flusso.

Se necessario, produrre prima un breve documento di analisi tecnica e poi procedere con il codice.
