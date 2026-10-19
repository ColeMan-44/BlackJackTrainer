const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1440,height:1100},reducedMotion:'reduce'});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 // Test-only hooks set a known shoe and remove delays; the shipped HTML exposes no hooks.
 const html=fs.readFileSync(path.join(__dirname,'../Black & Jack.html'),'utf8').replace('  // ---------------- init ----------------', `
 window.seatingTest = {
   prepare(ranks){
     const cards = ranks.concat(Array(100).fill('10')).map(rank=>({rank,suit:'♠',red:false}));
     tableShoeState = {cards:cards.reverse(),runningCount:0,dealt:0,totalDecks:6};
     tableGraveyard = [];
   },
   snapshot(){return {user:tableUserCards.map(c=>c.rank), ai:tableAIResultsForRound.map(h=>h.flatMap(r=>r.cards.map(c=>c.rank))), active:tableRoundActive, count:tableShoeState.runningCount};}
 };
 sleep = async()=>{};
 // ---------------- init ----------------`);
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://blackjack.test/');
 await page.locator('[data-tab="table"]').click();
 await page.locator('#t-ai-count').selectOption('2');
 for(const position of [0,1,2]){
   await page.locator('#t-user-position').selectOption(String(position));
   const order=[0,1];order.splice(position,0,'user');
   const initial={user:['5','6'],0:['2','2'],1:['3','3']};
   const shoe=[...order.map(p=>initial[p][0]),'10',...order.map(p=>initial[p][1]),'7'];
   if(position>0) shoe.push('10','10'); // AI 0 busts before the user's turn.
   if(position>1) shoe.push('10','2'); // AI 1 reaches 18 before the user's turn.
   shoe.push('9'); // User doubles to 20.
   if(position===0) shoe.push('10','10');
   if(position<2) shoe.push('10','2');
   await page.evaluate(ranks=>window.seatingTest.prepare(ranks),shoe);
   await page.locator('[data-tab="table"]').click();
   await page.locator('#btn-table-deal').click();
   await page.waitForFunction(()=>!document.getElementById('t-btn-double').disabled);
   const before=await page.evaluate(()=>window.seatingTest.snapshot());
   assert.deepEqual(before.user,['5','6']);
   assert.deepEqual(before.ai[0],position>0?['2','2','10','10']:['2','2']);
   assert.deepEqual(before.ai[1],position>1?['3','3','10','2']:['3','3']);
   assert.equal(await page.locator('#t-user-position').isDisabled(),true);
   const seats=await page.locator('#t-seats-row > .seat').evaluateAll(els=>els.map(el=>({user:el.id==='t-user-seat',order:Number(el.style.order),x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
   assert.equal(seats.find(s=>s.user).order,position);
   assert.ok(seats.every(s=>s.y===seats[0].y),'seats are side by side');
   assert.ok(seats.every((s,i)=>i===0 || s.x<seats[i-1].x),'turn order goes right to left');
   if(position===0) await page.screenshot({path:'/tmp/seating-desktop.png',fullPage:true,animations:'disabled'});
   await page.locator('#t-btn-double').click();
   await page.waitForFunction(()=>!window.seatingTest.snapshot().active);
   const after=await page.evaluate(()=>window.seatingTest.snapshot());
   assert.deepEqual(after.user,['5','6','9']);
   assert.deepEqual(after.ai,[['2','2','10','10'],['3','3','10','2']]);
   assert.equal(after.count,3,'count includes all exposed cards exactly once');
   assert.equal(await page.locator('#t-user-position').isEnabled(),true);
   await page.locator('[data-tab="table"]').click();
 }
 // Seven players stay in one scrollable row at phone and desktop sizes.
 await page.locator('#t-ai-count').selectOption('6');
 await page.locator('#t-user-position').selectOption('3');
 await page.locator('[data-tab="table"]').click();
 for(const width of [1440,768,375,320]){
   await page.setViewportSize({width,height:1000});
   const geometry=await page.locator('#t-seats-row').evaluate(row=>({tops:[...row.children].map(e=>e.getBoundingClientRect().top),overflow:document.documentElement.scrollWidth>innerWidth,scrollable:row.scrollWidth>row.clientWidth}));
   assert.equal(new Set(geometry.tops).size,1,'no wrapping, even with seven seats');
   assert.equal(geometry.overflow,false,`no page overflow at ${width}`);
   if(width<=375) assert.ok(geometry.scrollable,'phone seat strip scrolls');
   if(width===375) await page.screenshot({path:'/tmp/seating-mobile.png',fullPage:true,animations:'disabled'});
 }
 await page.locator('[data-tab="table"]').click();
 await page.locator('#t-ai-count').selectOption('1');
 assert.equal(await page.locator('#t-user-position').inputValue(),'1','seat clamps when players are removed');
 assert.deepEqual(errors,[]);
 console.log('PASS: first/middle/last seats, correct card and turn order, delayed AI actions, count accuracy, settings lock, seven-player layout at four widths, seat clamping.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
