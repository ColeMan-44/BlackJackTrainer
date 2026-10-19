const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
 for(const motion of ['reduce','no-preference']){
 const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:motion});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('  // ---------------- init ----------------',`
 window.resultTest={prepare(ranks){
  tableShoeState={cards:ranks.concat(Array(100).fill('10')).map(rank=>({rank,suit:'♠',red:false})).reverse(),runningCount:0,dealt:0,totalDecks:6};
  tableGraveyard=[];tableDiscardCount=0;updateDiscardTray();updateTableDeckVisual();
 }};
 sleep=async()=>{};
 // ---------------- init ----------------`);
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://blackjack.test/');await page.locator('[data-tab="table"]').click();
 for(const [ranks,action,expected,kind] of [
  [['10','6','7','10','5'],'stand','Loss · −$25','loss'],
  [['10','6','9','10','10'],'stand','Win · +$25','win'],
  [['10','10','8','8'],'stand','Push · $0','push'],
  [['A','10','K','8'],null,'Blackjack! · +$37.50','win']
 ]){
  await page.evaluate(r=>window.resultTest.prepare(r),ranks);
  await page.locator('#btn-table-deal').click();
  if(action){await page.waitForFunction(()=>!document.getElementById('t-btn-stand').disabled);await page.locator('#t-btn-stand').click();}
  await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled);
  const badge=page.locator('#t-user-banner');
  assert.equal(await badge.innerText(),expected);
  assert.match(await badge.getAttribute('class'),new RegExp(kind));
  const geometry=await badge.evaluate(e=>({opacity:getComputedStyle(e).opacity,position:getComputedStyle(e).position,rect:e.getBoundingClientRect().toJSON(),cards:document.getElementById('t-user-row').getBoundingClientRect().toJSON()}));
  assert.equal(geometry.opacity,'1',`result remains visible with ${motion}`);
  assert.equal(geometry.position,'static');
  assert.ok(geometry.rect.top>=geometry.cards.bottom,'label sits below cards');
 }
 // Mixed split: one doubled win and one loss must report the actual net +$25.
 await page.evaluate(()=>window.resultTest.prepare(['8','10','8','8','3','2','10','10','5']));
 await page.locator('#btn-table-deal').click();await page.waitForFunction(()=>!document.getElementById('t-btn-split').disabled);
 await page.locator('#t-btn-split').click();
 await page.locator('#t-btn-double').click();
 await page.locator('#t-btn-hit').click(); // second hand reaches 20
 await page.locator('#t-btn-hit').click(); // busts with 25
 await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled);
 assert.equal(await page.locator('#t-user-banner').innerText(),'Split · +$25');
 assert.match(await page.locator('#t-user-banner').getAttribute('class'),/win/);
 for(const [width,height] of [[1280,800],[375,667],[320,568]]){
  await page.setViewportSize({width,height});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const geometry=await page.locator('#table-panel .activity-screen').evaluate(e=>({h:e.clientHeight,s:e.scrollHeight,w:e.clientWidth,sw:e.scrollWidth}));
  assert.ok(geometry.s<=geometry.h+1,`settled split fits ${width}x${height}`);
  assert.ok(geometry.sw<=geometry.w+1,`horizontal fit at ${width}x${height}: ${JSON.stringify(geometry)}`);
  const resultPosition=await page.locator('#t-user-banner').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,top:e.getBoundingClientRect().top,cardsBottom:document.getElementById('t-user-row').getBoundingClientRect().bottom,seatsBottom:document.getElementById('t-seats-row').getBoundingClientRect().bottom}));
  assert.ok(resultPosition.top>=resultPosition.cardsBottom,'split result stays below cards');
  assert.ok(resultPosition.bottom<=resultPosition.seatsBottom+1,`split result is not clipped at ${width}x${height}: ${JSON.stringify(resultPosition)}`);
 }
 await page.setViewportSize({width:375,height:667});
 await page.screenshot({path:`/tmp/results-${motion}.png`,animations:'disabled'});
 assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: win/loss/push/blackjack labels, precise payouts, mixed split net, no card overlap, normal and reduced motion, mobile layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
