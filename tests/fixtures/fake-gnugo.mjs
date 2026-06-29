#!/usr/bin/env node
// Finto motore GTP per i test: implementa il minimo del protocollo e risponde
// sempre "pass" a genmove. Serve a esercitare il plumbing vs-computer senza
// dipendere da GNU Go reale. Una risposta GTP per ogni comando ricevuto.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin });
rl.on('line', (line) => {
  const cmd = line.trim();
  if (!cmd) return;
  if (cmd.startsWith('genmove')) process.stdout.write('= PASS\n\n');
  else process.stdout.write('= \n\n');
});
