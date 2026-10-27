import {chromium} from '@playwright/test';
import fs from 'node:fs/promises';
const browser=await chromium.launch({headless:true,args:['--use-angle=metal','--enable-webgl']});const page=await browser.newPage({viewport:{width:1600,height:980}});page.on('pageerror',e=>console.log('ERROR',e.message));
await page.goto('http://127.0.0.1:5174/inspector.html');await page.waitForFunction(()=>window.__motion?.ready);await page.locator('#stage').selectOption('.18');await page.screenshot({path:'qa/rescue/contact-comparison.png',fullPage:true});
for(const [name,value] of [['idle','-.01'],['backswing','.08'],['follow-through','.30'],['extension','.48'],['recovery','.81']]){await page.locator('#stage').selectOption(value);await page.screenshot({path:`qa/rescue/${name}-comparison.png`,fullPage:true});}
await fs.writeFile('qa/rescue/rendered-grips.json',JSON.stringify(await page.evaluate(()=>window.__motion.records),null,2));await browser.close();
