const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('  // ---------------- init ----------------',`
 window.experienceTest={prepare(){
  tableShoeState={cards:['10','6','7','10','5',...Array(100).fill('10')].map(rank=>({rank,suit:'♠',red:false})).reverse(),runningCount:0,dealt:0,totalDecks:RULES.decks};
  tableGraveyard=[]; tableDiscardCount=0;updateDiscardTray();updateTableDeckVisual();
 }};
 sleep=async()=>{};
 // ---------------- init ----------------`);
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://blackjack.test/');
 assert.equal(await page.locator('[data-tab="settings"], [data-tab="graveyard"], [data-goto="settings"]').count(),0,'obsolete routes removed');
 await page.locator('.app-options-button').click();
 await page.locator('#g-decks').selectOption('8');
 await page.locator('#global-options-dialog .dialog-close').click();
 await page.locator('[data-tab="table"]').click();
 assert.ok(await page.locator('#black-coach #cat-widget').isVisible(),'Black is visible on Play');
 assert.match(await page.locator('.dealer-spot .seat-label').innerText(),/Jack/i);
 assert.equal(await page.locator('#table-panel .activity-stats-button').innerText(),'Table tools');
 await page.locator('#table-panel .activity-options-button').click();
 assert.equal(await page.locator('#g-decks').inputValue(),'8','shared rule value follows Options between screens');
 await page.locator('#g-sound').selectOption('off');
 assert.equal(await page.locator('#g-decks').count(),1,'one shared control, no copies');
 await page.locator('#table-options-dialog .dialog-close').click();
 await page.evaluate(()=>window.experienceTest.prepare());
 const drawStart=Number(await page.locator('#draw-pile-count').innerText());
 await page.locator('#btn-table-deal').click();
 await page.waitForFunction(()=>!document.getElementById('t-btn-stand').disabled);
 assert.equal(Number(await page.locator('#draw-pile-count').innerText()),drawStart-4,'initial deal removes four cards from draw shoe');
 assert.equal(await page.locator('#discard-pile-count').innerText(),'0','current hands stay out of discard tray');
 const source=await page.locator('#shoe-icon').boundingBox();assert.ok(source.width>0 && source.height>0,'draw animation source is visible');
 await page.locator('#t-btn-stand').click();
 await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled);
 assert.match(await page.locator('#t-feedback').innerText(),/strong enough to stand/,'Black gives actual strategy reasoning');
 assert.ok(await page.locator('#black-coach #cat-widget').isVisible());
 await page.locator('#btn-table-deal').click();
 await page.waitForFunction(()=>!document.getElementById('t-btn-stand').disabled);
 assert.equal(await page.locator('#discard-pile-count').innerText(),'5','last completed round moves to discard tray');
 assert.equal(await page.locator('#discard-top').innerText(),'5♠');
 await page.locator('#table-panel .activity-stats-button').click();
 await page.locator('.dealt-card-history > summary').click();
 assert.ok(await page.locator('#graveyard-manifest').isVisible(),'dealt-card history is inside table tools');
 assert.equal(await page.locator('#table-stats-dialog #dealt-cards').count(),1);
 assert.equal(await page.locator('.nav-menu [data-tab="graveyard"]').count(),0);
 await page.screenshot({path:'/tmp/table-tools-phone.png',animations:'disabled'});
 await page.locator('#table-stats-dialog .dialog-close').click();
 for(const [width,height] of [[1440,900],[375,667],[320,568]]){
  await page.setViewportSize({width,height});
  const geometry=await page.locator('#table-panel .activity-screen').evaluate(e=>({h:e.clientHeight,scroll:e.scrollHeight,w:e.clientWidth,scrollW:e.scrollWidth}));
  assert.ok(geometry.scroll<=geometry.h+1,`table fits at ${width}x${height}`);
  assert.ok(geometry.scrollW<=geometry.w+1,`horizontal fit at ${width}x${height}: ${JSON.stringify(geometry)}`);
  assert.ok(await page.locator('#black-coach #cat-widget').isVisible());
  if(width===375) await page.screenshot({path:'/tmp/black-and-jack-table-phone.png',animations:'disabled'});
  if(width===1440) await page.screenshot({path:'/tmp/black-and-jack-table-desktop.png',animations:'disabled'});
 }
 await page.locator('#t-btn-stand').click();
 await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled);
 await page.locator('#table-panel .activity-options-button').click();
 await page.locator('#btn-table-reshuffle').click();
 await page.locator('#table-options-dialog .dialog-close').click();
 assert.equal(await page.locator('#discard-pile-count').innerText(),'0','shuffle empties discard tray');
 assert.equal(await page.locator('#draw-pile-count').innerText(),'416');
 assert.deepEqual(errors,[]);
 console.log('PASS: named visible coach/dealer, real shoe and discard counts, table-only history, shared Options, no obsolete routes, portrait layouts.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
