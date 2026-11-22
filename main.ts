// VAULT ZERO — The Silent Extraction, a make.fun best-heist-game entry (Node 22, standard
// library only). The game is this directory's game/ folder: plain static files a desktop
// browser loads offline (game/index.html and its ES modules, no library, no network
// request). This program hands it in: it copies game/ and screenshots/ from beside this
// file to /output and writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// The game: a top-down bank heist. The thief crosses two floors (the Meridian Trust
// ground floor and the vault annex basement), grabs weighted loot — cash, gem cases,
// gold bars, a star artifact — while guards patrol with real vision cones, cameras sweep
// and feed an escalating alarm meter (CALM, SUSPICIOUS, HUNTED, LOCKDOWN), laser
// tripwires arm, and the getaway van waits by the rear door. Locked VAULT DOORS seal the
// best loot: VAULT-CRACKING means holding E at a door to spin its combination dial and
// releasing E with the needle in the green zone, three tumblers to swing it open (a
// jammed release raises the alarm). Screenshots live in screenshots/ (the first by name
// is the cover: thief mid-crossing, guard cones, cameras, loot and the alarm meter in
// one frame; the third shows the vault-cracking dial at 2/3 tumblers).
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
