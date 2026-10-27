import {test,expect} from '@playwright/test';
const state=(page:any)=>page.evaluate(()=>((window as any).__cricverse.state));
async function ready(page:any){await page.goto('/');await expect(page.getByRole('button',{name:'QUICK MATCH TAKE THE CREASE'})).toBeVisible({timeout:45000})}
test('loads licensed character and original stadium assets, playable match, pause, settings and clean restart',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);
 await expect(page.locator('.main-menu')).toHaveCSS('opacity','1');await page.screenshot({path:'qa/main-menu.png'});
 const loaded=await state(page);expect(loaded.loaded).toBe(true);expect(loaded.clips.batsman).toEqual(expect.arrayContaining(['Run','Drive','Loft','Pull','Defend','Bowl']));
 await page.getByRole('button',{name:'QUICK MATCH TAKE THE CREASE'}).click();await page.getByRole('button',{name:'1 OVER',exact:true}).click();await page.getByRole('button',{name:'START INNINGS'}).click();await page.getByRole('button',{name:'Skip tutorial'}).click();
 await page.waitForFunction(()=>((window as any).__cricverse.state.phase==='flight'));await page.screenshot({path:'qa/gameplay.png'});
 await page.keyboard.press('Escape');const before=await state(page);expect(before.paused).toBe(true);await page.waitForTimeout(300);expect((await state(page)).time).toBe(before.time);
 await page.getByRole('button',{name:'Settings',exact:true}).click();await page.getByLabel('Graphics quality').selectOption('Medium');await page.getByRole('button',{name:'Close dialog'}).click();
 await page.getByRole('button',{name:'Restart innings'}).click();expect((await state(page)).score.balls).toBe(0);
 await page.waitForFunction(()=>((window as any).__cricverse.state.phase==='finished'),{},{timeout:75000});await expect(page.getByRole('button',{name:'PLAY AGAIN'})).toBeVisible();await page.screenshot({path:'qa/match-result.png'});
 const end=await state(page);expect(end.score.balls<=6).toBe(true);expect(end.score.history.length).toBeGreaterThan(0);expect(errors).toEqual([]);
 await page.getByRole('button',{name:'PLAY AGAIN'}).click();expect((await state(page)).score.runs).toBe(0);expect((await state(page)).score.balls).toBe(0);
});
test('practice contact, running input and recorded replay',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await page.getByRole('button',{name:'Batting practice',exact:true}).click();await page.getByRole('button',{name:'Skip tutorial'}).click();
 await page.getByLabel('Practice delivery type').selectOption('good');
 await page.getByRole('button',{name:'3 LOFTED DRIVE'}).click();await page.keyboard.down('ArrowRight');await page.waitForTimeout(370);await page.keyboard.up('ArrowRight');
 // Observe simulation state to time ordinary keyboard input. This does not alter the engine.
 await page.waitForFunction(()=>{const s=(window as any).__cricverse.state;return s.phase==='flight'&&s.time-s.flightStart>=s.arrival.time-.205});await page.keyboard.press('Space');
 await page.waitForFunction(()=>((window as any).__cricverse.state.ball.hit),{},{timeout:10000});await page.keyboard.press('r');await page.screenshot({path:'qa/ball-in-play.png'});
 await page.waitForFunction(()=>((window as any).__cricverse.state.phase==='result'),{},{timeout:30000});await page.getByRole('button',{name:'WATCH REPLAY'}).click();await expect(page.getByText('INSTANT REPLAY',{exact:false})).toBeVisible();await page.screenshot({path:'qa/replay.png'});await page.getByRole('button',{name:'BACK TO LIVE'}).click();expect((await state(page)).paused).toBe(false);expect(errors).toEqual([]);
});
test('lab executes actual worker simulation and exports data',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'AI testing lab LAB'}).click();await page.getByRole('button',{name:'RUN SIMULATION'}).click();await expect(page.getByText('Mean contact quality',{exact:false})).toBeVisible();await page.screenshot({path:'qa/lab.png'});
 const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'JSON',exact:true}).click();const download=await downloadPromise;await download.saveAs('qa/lab-results.json');
 await page.getByRole('button',{name:'OBSERVE LIVE'}).click();await expect(page.getByText('LIVE EXPERIMENT')).toBeVisible();
});
test('narrow layout is usable and settings persist',async({page})=>{
 await page.setViewportSize({width:600,height:900});await ready(page);await page.getByRole('button',{name:'Open settings'}).click();await page.getByLabel('Graphics quality').selectOption('Low');await page.getByRole('button',{name:'Close dialog'}).click();await page.reload();await expect(page.getByRole('button',{name:'Open settings'})).toBeVisible();await page.getByRole('button',{name:'Open settings'}).click();await expect(page.getByLabel('Graphics quality')).toHaveValue('Low');await page.screenshot({path:'qa/narrow-settings.png'});
});

test('aim remains live after release and freezes on mouse-click commitment',async({page})=>{
 await ready(page);await page.getByRole('button',{name:'Batting practice',exact:true}).click();await page.getByRole('button',{name:'Skip tutorial'}).click();await page.waitForFunction(()=>(window as any).__cricverse.state.phase==='flight');
 await page.mouse.move(390,440);const left=(await state(page)).aim;await page.mouse.move(1050,440);const right=(await state(page)).aim;expect(Math.abs(right-left)).toBeGreaterThan(.2);
 await page.mouse.click(1050,440);const committed=await state(page);expect(committed.swingAt).toBeGreaterThan(0);await page.mouse.move(300,420);await page.keyboard.press('ArrowLeft');const after=await state(page);expect(after.swingAim).toBe(committed.swingAim);expect(after.aim).toBe(committed.aim);
 await page.screenshot({path:'qa/rescue/live-aim.png'});
});
test('motion inspection renders the real skin with locked grips at every stage',async({page})=>{
 await page.goto('/inspector.html');await page.waitForFunction(()=>(window as any).__motion?.ready);
 for(const stage of ['-.01','.08','.18','.30','.48','.81']){await page.locator('#stage').selectOption(stage);const records=await page.evaluate(()=>(window as any).__motion.records);expect(records).toHaveLength(4);for(const r of records){expect(r.errors.L).toBeLessThan(.012);expect(r.errors.R).toBeLessThan(.012);}}
 await page.locator('#stage').selectOption('.18');await page.screenshot({path:'qa/rescue/contact-comparison.png',fullPage:true});
});

test('plays six legal deliveries using ordinary controls and preserves the score ledger',async({page})=>{
 test.setTimeout(150000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await ready(page);await page.getByRole('button',{name:'Batting practice',exact:true}).click();await page.getByRole('button',{name:'Skip tutorial'}).click();await page.getByLabel('Practice delivery type').selectOption('good');
 let deliveries=0;
 while((await state(page)).score.balls<6&&deliveries++<10){
  await page.waitForFunction(()=>(window as any).__cricverse.state.phase==='runup');
  const before=await state(page);await page.keyboard.press(String(1+(deliveries-1)%4));
  await page.waitForFunction(()=>{const s=(window as any).__cricverse.state;return s.phase==='flight'&&s.time-s.flightStart>=s.arrival.time-.205});await page.keyboard.press('Space');
  await page.waitForFunction((n:number)=>(window as any).__cricverse.state.score.history.length>n,before.score.history.length,{timeout:30000});
 }
 const end=await state(page);expect(end.score.balls).toBeGreaterThanOrEqual(6);expect(end.score.runs).toBe(end.score.history.reduce((n:number,r:any)=>n+r.runs,0));expect(errors).toEqual([]);
 await (await import('node:fs/promises')).writeFile('qa/rescue/full-over.json',JSON.stringify(end.score,null,2));await page.screenshot({path:'qa/rescue/full-over.png'});
});
