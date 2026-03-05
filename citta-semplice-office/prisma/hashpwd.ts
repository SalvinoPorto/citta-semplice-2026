import { hash } from 'bcryptjs';

async function main() {
  console.log('Hashing passwords...');

  const password = await hash('#idc2023#', 10);
  console.log('Password hashed successfully!', password);
 
}

main();
