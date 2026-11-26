// SORTIE — submission program for best-flight-game-20261126-0057.
// Copies game/ and screenshots/ from this repository into the output directory
// and writes dossier.json with buildDossier from the kit library.
// Node 22, standard library only, no network, deterministic output.
import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};

function copyTree(src: string, dest: string): void {
  mkdirSync(dest, { recursive: true });
  for (const name of readdirSync(src).sort()) {
    const from = join(src, name);
    const to = join(dest, name);
    const st = statSync(from);
    if (st.isDirectory()) {
      copyTree(from, to);
    } else if (st.isFile()) {
      cpSync(from, to);
    }
  }
}

function main(): void {
  const repoDir = dirname(fileURLToPath(import.meta.url));
  const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR ?? '/output');
  mkdirSync(outDir, { recursive: true });
  // Drop a stale dossier from an earlier run first: a failed build must never
  // leave behind a dossier.json that looks like a success.
  const staleDossier = join(outDir, 'dossier.json');
  if (existsSync(staleDossier)) rmSync(staleDossier, { force: true });
  for (const sub of ['game', 'screenshots']) {
    const src = join(repoDir, sub);
    if (!existsSync(src) || !statSync(src).isDirectory()) {
      throw new Error(`main.ts: repository is missing ${sub}/ under ${repoDir}`);
    }
    const dest = join(outDir, sub);
    if (existsSync(dest)) rmSync(dest, { recursive: true, force: true });
    copyTree(src, dest);
  }
  const dossier = buildDossier(outDir, CAPS);
  writeFileSync(join(outDir, 'dossier.json'), dossier);
}

main();
