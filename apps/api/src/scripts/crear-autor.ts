// Crea el único usuario autor, o le cambia la contraseña si ya existe.
// Uso: npm run crear-autor -- tu@email.com
// La contraseña se pide sin mostrarla (o se toma de AUTOR_PASSWORD, para uso no interactivo).
import { createInterface } from 'node:readline';
import { z } from 'zod';
import { hashPassword } from '../auth.js';
import { usuarios } from '../db/schema.js';
import { conBase, destino } from './comun.js';

const MINIMO = 12;

function preguntarOculto(pregunta: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    let mostrando = true;
    // Escribe la pregunta y después silencia el eco de lo que se teclea
    const rlInterno = rl as unknown as { _writeToOutput: (s: string) => void };
    rlInterno._writeToOutput = (s: string) => {
      if (mostrando) process.stdout.write(s);
    };
    rl.question(pregunta, (respuesta) => {
      process.stdout.write('\n');
      rl.close();
      resolve(respuesta);
    });
    mostrando = false;
  });
}

const email = z.string().trim().toLowerCase().email().safeParse(process.argv[2]);
if (!email.success) {
  console.error('Uso: npm run crear-autor -- tu@email.com');
  process.exit(1);
}

let password = process.env.AUTOR_PASSWORD ?? '';
if (!password) {
  password = await preguntarOculto(`Contraseña (mínimo ${MINIMO} caracteres): `);
  const repetida = await preguntarOculto('Repite la contraseña: ');
  if (password !== repetida) {
    console.error('Las contraseñas no coinciden.');
    process.exit(1);
  }
}
if (password.length < MINIMO) {
  console.error(`La contraseña debe tener al menos ${MINIMO} caracteres.`);
  process.exit(1);
}

await conBase(async ({ db }) => {
  const passwordHash = await hashPassword(password);
  await db
    .insert(usuarios)
    .values({ email: email.data, passwordHash })
    .onConflictDoUpdate({ target: usuarios.email, set: { passwordHash } });
  console.log(`Autor ${email.data} guardado en ${destino()}`);
});
