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
    { nome: 'ADMIN', descrizione: 'Amministratore del sistema', permessi: ['*'] },
    { nome: 'OPERATORE', descrizione: 'Operatore standard', permessi: ['read', 'write'] },
    { nome: 'VIEWER', descrizione: 'Solo visualizzazione', permessi: ['read'] },
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
  const ente = await prisma.ente.upsert({
    where: { id: 1 },
    update: {},
    create: {
      ente: 'Comune di Catania',
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
      titolo: 'Servizi al Cittadino',
      descrizione: 'Area servizi dedicati ai cittadini',
      ordine: 1,
      attiva: true,
    },
  });
  console.log('Created area');

  // Create Servizio
  const servizio = await prisma.servizio.upsert({
    where: { id: 1 },
    update: {},
    create: {
      titolo: 'Anagrafe',
      descrizione: 'Servizi anagrafici',
      ordine: 1,
      attivo: true,
      areaId: area.id,
    },
  });
  console.log('Created servizio');

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
    where: { email: 'admin@comune.catania.it' },
    update: {},
    create: {
      email: 'admin@comune.catania.it',
      password: adminPassword,
      nome: 'Admin',
      cognome: 'Sistema',
      codiceFiscale: 'ADMIN00000000000',
      attivo: true,
    },
  });

  // Assign admin role
  const adminRuolo = await prisma.ruolo.findUnique({ where: { nome: 'ADMIN' } });
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

  
  // Create sample Modulo
  const modulo = await prisma.modulo.upsert({
    where: { slug: 'richiesta-certificato-anagrafico' },
    update: {},
    create: {
      name: 'Richiesta Certificato Anagrafico',
      slug: 'richiesta-certificato-anagrafico',
      description: 'Modulo per la richiesta di certificati anagrafici',
      tipo: 'HTML',
      dataInizio: new Date('2024-01-01'),
      dataFine: new Date('2030-12-31'),
      attivo: true,
      attributes: JSON.stringify({
        fields: [
          { name: 'tipoCertificato', label: 'Tipo Certificato', type: 'select' },
          { name: 'motivazione', label: 'Motivazione', type: 'textarea' },
        ],
      }),
    },
  });
  console.log('Created modulo');

  // Create Steps for modulo
  const steps = [
    { descrizione: 'Ricezione', ordine: 1, protocollo: true },
    { descrizione: 'Verifica', ordine: 2, protocollo: false },
    { descrizione: 'Emissione', ordine: 3, protocollo: true },
  ];

  for (const step of steps) {
    await prisma.step.upsert({
      where: {
        moduloId_ordine: {
          moduloId: modulo.id,
          ordine: step.ordine,
        },
      },
      update: {},
      create: {
        ...step,
        attivo: true,
        moduloId: modulo.id,
      },
    });
  }
  console.log('Created steps');

  // Assign modulo to admin
  await prisma.operatoreModulo.upsert({
    where: {
      operatoreId_moduloId: {
        operatoreId: admin.id,
        moduloId: modulo.id,
      },
    },
    update: {},
    create: {
      operatoreId: admin.id,
      moduloId: modulo.id,
    },
  });
  console.log('Assigned modulo to admin');

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
