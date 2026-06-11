import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

import { hash } from 'bcryptjs';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL })
})

async function main() {
  console.log('Seeding database...');

  // Create Ruoli
  const ruoli = [
    { nome: 'AMMINISTRATORE', descrizione: 'Amministratore del sistema', permessi: ['admin:access'] },
    { nome: 'OPERATORE', descrizione: 'Operatore standard', permessi: ['istanze:manage', 'istanze:view'] },
    { nome: 'GESTORE_SERVIZI', descrizione: 'Operatore avanzato', permessi: ['istanze:manage', 'istanze:view', 'servizi:manage', 'servizi:view'] },
  ];

  for (const ruolo of ruoli) {
    await prisma.ruolo.upsert({
      where: { nome: ruolo.nome },
      update: {},
      create: ruolo,
    });
  }
  console.log('Created ruoli');

  // Create Ente
  await prisma.ente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Catania',
      descrizione: 'Catania Semplice',
      codice: 'COCAT',
      indirizzo: 'Piazza Duomo, 1 - 95100 Catania (CT)',
      telefono: '095 7421111',
      email: 'urp@comune.catania.it',
      pec: 'protocollo@pec.comune.catania.it',
      attivo: true,
    },
  });
  console.log('Created ente');

  // Create Area
  const area = await prisma.area.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Servizi Demografici e Decentramento',
      descrizione: 'Anagrafe e Stato civile,  Servizi Elettorali, Matrimoni, Assegni di Maternità, Assegni Nucleo Familiare,Tesserini Venatori, Servizi per non deambulanti',
      ordine: 1,
      attiva: true,
      slug: 'servizi-demografici-e-decentramento',
    },
  });
  const area2 = await prisma.area.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nome: 'Servizi Cimiteriali',
      descrizione: 'Gestione attività Cimiteriali e Funebri',
      ordine: 2,
      attiva: true,
      slug: 'servizi-cimiteriali',
    },
  });
  console.log('Created area');

  // Create Ufficio
  const ufficio = await prisma.ufficio.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Anagrafe',
      descrizione: 'Direzione Servizi Demografici, Decentramento - Statistica',
      email: 'anagrafe@comune.catania.it',
      telefono: '095 7421200',
      indirizzo: 'Via La Marmora',
      attivo: true,
    },
  });
  const ufficio2 = await prisma.ufficio.upsert({
    where: { id: 2 },
    update: {},
    create: {
      nome: 'Servizi Cimiteriali',
      descrizione: 'Direzione Patrimonio, Servizi Cimiteriali e Funebri',
      email: 'cimiteri@comune.catania.it',
      telefono: '095 7421300',
      indirizzo: 'Via dei Cimiteri',
      attivo: true,
    },
  });
  console.log('Created ufficio');

  // Create Admin Operatore
  const adminPassword = await hash('#idc2023#', 12);
  const admin = await prisma.operatore.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email: 'salvatore.porto@comune.catania.it',
      password: adminPassword,
      nome: 'Amministratore',
      cognome: 'Sistema',
      userName: 'admin',
      attivo: true,
    },
  });

  // Assign admin role
  const adminRuolo = await prisma.ruolo.findUnique({ where: { nome: 'AMMINISTRATORE' } });
  if (adminRuolo) {
    await prisma.operatoreRuolo.upsert({
      where: {
        operatoreId_ruoloId: {
          operatoreId: admin.id,
          ruoloId: adminRuolo.id,
        },
      },
      update: {},
      create: {
        operatoreId: admin.id,
        ruoloId: adminRuolo.id,
      },
    });
  }
  console.log('Created admin operatore');

  // Create Servizio (con modulo incorporato)
  const servizio = await prisma.servizio.upsert({
    where: { id: 1 },
    update: {},
    create: {
      ordine: 1,
      titolo: 'Dichiarazioni di morte Dichiarazione di morte deceduti a casa (trasporto locale)',
      descrizione: '<p>Ai sensi del comma 1&nbsp; dell\'art.72 del&nbsp; D.P.R.&nbsp; n.386/2000 La dichiarazione di morte è fatta non oltre le ventiquattro ore dal decesso all\'ufficiale dello stato civile del luogo dove questa è avvenuta o, nel caso in cui tale luogo si ignori, del luogo dove il cadavere è stato deposto.</p><p>La dichiarazione di morte va effettuata con le modalità previste dal comma 2 e 3 dell\'art.72 del D.P.R.&nbsp; n.386/2000 che qui di seguito si riportano:</p><p>Comma 2. La dichiarazione è fatta da uno dei congiunti o da una persona convivente con il defunto o da un&nbsp; loro delegato o, in mancanza, da persona informata del decesso.&nbsp;</p><p>Comma 3. In caso di morte in un ospedale, casa di cura o di riposo, collegio, istituto o qualsiasi altro&nbsp;stabilimento, il direttore o chi ne è stato delegato dall\'amministrazione deve trasmettere avviso della&nbsp; morte, nel termine fissato dal comma 1, all\'ufficiale dello stato civile, con le indicazioni stabilite&nbsp; nell\'articolo 73. &nbsp;</p><p><strong>Si avvisa la gentile utenza e&nbsp; le agenzie di trasporto e onoranze funebri operanti nel territorio cittadino che dal 10 Maggio sarà attivo il portale Catania Semplice per tutte&nbsp; le richieste inerenti le operazioni cimiteriali di tumulazione, estumulazione etc.</strong><br><strong>A far data 29 maggio p.v.&nbsp; le richieste inerenti le operazioni cimiteriali potranno essere presentate SOLO mediante il portale Catania Semplice</strong></p>',
      cosaServe: '<p>Documentazione richiesta alle persone individuate nei comma 2 e 3 &nbsp;dell’art.72 del &nbsp;D.P.R. &nbsp;n.386/2000 &nbsp;:</p><p><strong>Deceduti a casa &nbsp;</strong></p><ol><li>Scheda Istat ;</li><li>Verbale Necroscopico;</li><li>Foglio Notizie del defunto;</li><li>Accertamento morte L.578/1993 art.8;</li><li>Domanda di trasporto;</li><li>C.F. e C.I. del defunto.</li></ol><p><strong>Deceduti in Ospedali, Case di cura ecc.</strong> &nbsp;</p><ol><li>Scheda Istat ;</li><li>Verbale Necroscopico;</li><li>Accertamento morte L.578/1993 art.8;</li><li>Allegato dell’ ospedale, casa di cura ecc. ;</li><li>Domanda di trasporto;</li><li>C.F. e C.I. del defunto.</li></ol><p><strong>Trasporto funebre deceduti fuori Comune&nbsp;</strong></p><ol><li>Domanda autorizzazione entrata;</li><li>Dichiarazione di residenza;</li><li>Concessione;</li><li><a href=\"https://www.comune.catania.it/il-comune/uffici/cimitero/modulistica/allegati/atto-notorieta.docx\">Atto notorio.</a></li></ol>',
      altreInfo: '<p>Doc. richiesta alle persone individuate nei comma 2 e 3 &nbsp;dell’art.72 del &nbsp;D.P.R. &nbsp;n.386/2000 &nbsp;:</p><p><strong>Deceduti a casa &nbsp;</strong></p><ol><li>Scheda Istat ;</li><li>Verbale Necroscopico;</li><li>Foglio Notizie del defunto;</li><li>Accertamento morte L.578/1993 art.8;</li><li>Domanda di trasporto;</li><li>C.F. e C.I. del defunto.</li></ol><p>&nbsp;</p>',
      contatti: '<p>Mail 1 :<a href=\"mailto:ufficio.morti@comune.catania.it\">ufficio.morti@comune.catania.it</a>- Tel. 095/7424336</p><p>Mail 2 : <a href=\"mailto:servizi.cimiteriali@comune.catania.it\">servizi.cimiteriali@comune.catania.it</a></p>',
      slug: 'dichiarazione-di-morte-deceduti-a-casa-trasporto-locale',
      attivo: true,
      dataInizio: new Date('2026-01-01'),
      dataFine: new Date('2030-12-31'),
      areaId: area.id,
      ufficioId: ufficio.id,
      // Modulo (form) incorporato nel servizio
      attributi: JSON.stringify({
        fields: [
          { "id": "field_ftc4borrq6", "type": "text", "name": "cognome_defunto", "label": "Cognome defunto", "validation": { "required": true } },
          { "id": "field_5d1yddkcpu", "type": "text", "name": "nome_defunto", "label": "Nome defunto", "validation": { "required": true } },
          { "id": "field_j4wlrlk53e", "type": "text", "name": "richiedente", "label": "Richiedente", "validation": { "required": true } },
          { "id": "field_prfio6r9wo", "type": "select", "name": "tipo_richiedente", "label": "Tipo richiedente", "validation": { "required": true }, "options": [{ "value": "parente", "label": "Parente" }, { "value": "agenzia", "label": "Agenzia autorizzata" }] },
          { "id": "field_ckrzpu86kv", "type": "text", "name": "intestazione_fattura", "label": "Intestazione fattura", "validation": { "required": true } },
          { "id": "field_v1lxvpq7oe", "type": "text", "name": "p_iva", "label": "P. IVA", "validation": { "required": true } },
          { "id": "field_atze07w6zd", "type": "text", "name": "codice_fattura", "label": "Codice fattura elettronica", "validation": {} },
          { "id": "field_jxsbtxh83p", "type": "textarea", "name": "note", "label": "Note ", "validation": {} }
        ],
      }),
      campiInEvidenza: 'cognome_defunto,nome_defunto,richiedente',
      campiDaEsportare: 'cognome_defunto,nome_defunto,richiedente,tipo_richiedente,intestazione_fattura,p_iva,codice_fattura,note'
    },
  });
  console.log('Created servizio');

  // Create fase per servizio
  const fase = await prisma.fase.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      nome: 'Fase 1',
      ordine: 1,
      ufficioId: ufficio.id,
      servizioId: servizio.id,
    }
  });

  // Create Steps for servizio
  const steps = [
    { descrizione: 'Presentazione Istanza', ordine: 1, protocollo: true, tipoProtocollo: 'E' },
    { descrizione: 'Chiusura Pratica', ordine: 2, protocollo: false, tipoProtocollo: null },
  ];

  for (const step of steps) {
    await prisma.step.create({
      data: {
        ...step,
        attivo: true,
        pagamento: false,
        allegati: false,
        faseId: fase.id,
        servizioId: servizio.id,
      },
    });
  }
  console.log('Created steps');

  /*  // Assign servizio to admin
   await prisma.operatoreServizio.upsert({
     where: {
       operatoreId_servizioId: {
         operatoreId: admin.id,
         servizioId: servizio.id,
       },
     },
     update: {},
     create: {
       operatoreId: admin.id,
       servizioId: servizio.id,
     },
   });
   console.log('Assigned servizio to admin'); */
/*
  // Create Utente fittizio
  const utente = await prisma.utente.upsert({
    where: { codiceFiscale: 'RSSMRA80A01C351Z' },
    update: {},
    create: {
      codiceFiscale: 'RSSMRA80A01C351Z',
      nome: 'Mario',
      cognome: 'Rossi',
      email: 'mario.rossi@example.com',
      telefono: '3331234567',
      dataNascita: new Date('1980-01-01'),
      luogoNascita: 'Catania',
      indirizzo: 'Via Roma, 10',
      cap: '95100',
      citta: 'Catania',
      provincia: 'CT',
    },
  });
  console.log('Created utente');

  // Create Istanza fittizia
  const istanza = await prisma.istanza.create({
    data: {
      utenteId: utente.id,
      servizioId: servizio.id,
      protoNumero: '2026/000001',
      dataInvio: new Date('2026-01-15'),
      dati: JSON.stringify({
        tipoCertificato: 'Nascita',
        motivazione: 'Uso personale',
      }),
      datiInEvidenza: 'Certificato di nascita - Uso personale',
      municipalita: 'I Municipalità',
      conclusa: false,
      respinta: false,
    },
  });
  console.log('Created istanza', istanza.id);
*/
  console.log('Seeding completed!');
  console.log('');
  console.log('=================================');
  console.log('Default admin credentials:');
  console.log('User: admin');
  console.log('Email: admin@comune.catania.it');
  console.log('Password: admin123');
  console.log('=================================');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
