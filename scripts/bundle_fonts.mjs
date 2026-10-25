import fs from 'node:fs/promises';
const css=await (await fetch('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Barlow:wght@400;500;600;700&display=swap',{headers:{'User-Agent':'Mozilla/5.0'}})).text();
let output=css;let i=0;
for(const url of [...new Set(css.match(/https:\/\/[^)]+/g))]){const filename=`barlow-${i++}.ttf`;const buf=await (await fetch(url)).arrayBuffer();await fs.writeFile('public/fonts/'+filename,Buffer.from(buf));output=output.split(url).join('/fonts/'+filename)}
await fs.writeFile('src/fonts.css',output);
const license=await (await fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/barlow/OFL.txt')).text();await fs.writeFile('public/fonts/OFL.txt',license);
