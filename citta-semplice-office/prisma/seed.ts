import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create Status
  const statuses = [
    { ordine: 1, stato: 'ELABORAZIONE', icon: 'yellow-circle.png' },
    { ordine: 2, stato: 'SUCCESSO', icon: 'green-circle.png' },
    { ordine: 3, stato: 'ATTESA', icon: 'blue-circle.png' },
    { ordine: 4, stato: 'RESPINTA', icon: 'red-circle.png' },
  ];

  for (const status of statuses) {
    await prisma.status.upsert({
      where: { ordine: status.ordine },
      update: {},
      create: status,
    });
  }
  console.log('Created statuses');

  // Create Ruoli
  const ruoli = [
    { nome: 'AMMINISTRATORE', descrizione: 'Amministratore del sistema', permessi: ['admin:access'] },
    { nome: 'OPERATORE', descrizione: 'Operatore standard', permessi: ['istanze:manage','istanze:view'] },
    { nome: 'GESTORE_SERVIZI', descrizione: 'Operatore avanzato',permessi: ['istanze:manage','istanze:view','servizi:manage','servizi:view'] },
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
      nome: 'Comune di Catania',
      descrizione: 'Comune di Catania - Città Metropolitana di Catania',
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
      nome: 'Servizi al Cittadino',
      descrizione: 'Area servizi dedicati ai cittadini',
      ordine: 1,
      attiva: true,
    },
  });
  console.log('Created area');

  // Create Ufficio
  const ufficio = await prisma.ufficio.upsert({
    where: { id: 1 },
    update: {},
    create: {
      nome: 'Ufficio Anagrafe',
      descrizione: 'Ufficio servizi anagrafici',
      email: 'anagrafe@comune.catania.it',
      telefono: '095 7421200',
      indirizzo: 'Via Etnea, 100 - Catania',
      attivo: true,
    },
  });
  console.log('Created ufficio');

  // Create Admin Operatore
  const adminPassword = await hash('admin123', 12);
  const admin = await prisma.operatore.upsert({
    where: { id: 1 },
    update: {},
    create: {
      email: 'admin@comune.catania.it',
      password: adminPassword,
      nome: 'Admin',
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
      titolo: 'Anagrafe',
      descrizione: 'Servizi anagrafici',
      ordine: 1,
      attivo: true,
      dataInizio: new Date('2024-01-01'),
      dataFine: new Date('2030-12-31'),
      areaId: area.id,
      ufficioId: ufficio.id,
      // Modulo (form) incorporato nel servizio
      attributi: JSON.stringify({
        fields: [
          { name: 'tipoCertificato', label: 'Tipo Certificato', type: 'select' },
          { name: 'motivazione', label: 'Motivazione', type: 'textarea' },
        ],
      }),
    },
  });
  console.log('Created servizio');

  // Create Steps for servizio
  const steps = [
    { descrizione: 'Ricezione', ordine: 1, protocollo: true },
    { descrizione: 'Verifica', ordine: 2, protocollo: false },
    { descrizione: 'Emissione', ordine: 3, protocollo: true },
  ];

  for (const step of steps) {
    await prisma.step.create({
      data: {
        ...step,
        attivo: true,
        servizioId: servizio.id,
      },
    });
  }
  console.log('Created steps');

  // Assign servizio to admin
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
  console.log('Assigned servizio to admin');

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

  // Create Tributo
  await prisma.tributo.upsert({
    where: { codice: '0001' },
    update: {},
    create: {
      codice: '0001',
      descrizione: 'Diritti di segreteria',
      attivo: true,
    },
  });
  console.log('Created tributo');

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
