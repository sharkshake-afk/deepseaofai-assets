// Bundles src/ into a single self-contained index.html (plus an artifact variant).
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const src = join(here, 'src');
const tpl = readFileSync(join(src, 'template.html'), 'utf8');
const js = readdirSync(src).filter(f => /^\d+-.*\.js$/.test(f)).sort().map(f => `// ---- ${f}\n` + readFileSync(join(src, f), 'utf8')).join('\n');
const script = `<script>\n(() => {\n${js}\n})();\n</script>`;
const [head, body] = tpl.split('<!--BODY-->');
const pwa = `<link rel="manifest" href="manifest.webmanifest">\n<link rel="apple-touch-icon" href="icon-192.png">\n<link rel="icon" href="icon-192.png">`;
const full = `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover">\n${head.replace('<!--HEAD-->', '').replace('<!--PWA-->', pwa)}</head>\n<body>\n${body}\n${script}\n</body>\n</html>\n`;
writeFileSync(join(here, 'index.html'), full);
// claude.ai artifact variant: no doctype/head wrapper, no PWA links
const art = `${head.replace('<!--HEAD-->', '').replace('<!--PWA-->', '')}\n${body}\n${script}\n`;
if (process.env.ARTIFACT_OUT) writeFileSync(process.env.ARTIFACT_OUT, art);
console.log('built', (full.length / 1024).toFixed(1) + ' KB');
