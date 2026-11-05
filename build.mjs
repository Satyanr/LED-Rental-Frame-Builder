import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
await build({entryPoints:['src/app.js'],bundle:true,format:'iife',target:['es2020'],minify:true,legalComments:'eof',outfile:'app.bundle.js'});
const html=await readFile('index.html','utf8'),css=await readFile('styles.css','utf8'),js=await readFile('app.bundle.js','utf8');
const standalone=html.replace('<link rel="stylesheet" href="styles.css">',()=>`<style>${css}</style>`).replace('<script defer src="app.bundle.js"></script>','').replace('</body>',()=>`<script>${js.replace(/<\/script/gi,'<\\/script')}</script></body>`);
await writeFile('LED-Rental-Frame-Builder.html',standalone);
console.log('Selesai: index.html dan LED-Rental-Frame-Builder.html (satu file, offline).');
