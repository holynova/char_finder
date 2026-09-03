import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const distPath = resolve(projectRoot, 'dist');
const pagesPath = resolve(projectRoot, 'docs');

rmSync(pagesPath, { recursive: true, force: true });
mkdirSync(pagesPath, { recursive: true });
cpSync(distPath, pagesPath, { recursive: true });

console.log(`Synced ${distPath} to ${pagesPath} for GitHub Pages.`);
