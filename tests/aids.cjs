const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:1280,height:1000},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('  // ---------------- init ----------------', `
 window.aidTest = { prepare(){
  const ranks=['8','6','8','10','3','2','10','7',...Array(100).fill('10')];
  tableShoeState={cards:ranks.map(rank=>({rank,suit:'♠',red:false})).reverse(),runningCount:0,dealt:0,totalDecks:6};
  tableGraveyard=[];
 }};
 sleep=async()=>{};
 // ---------------- init ----------------`);
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://blackjack.test/');
 await page.locator('[data-tab="table"]').click();
 await page.locator('#table-panel .activity-stats-button').click();
 const aids=[['t-show-strategy','t-strategy-guide',false],['t-show-count','t-count-display',false],['t-show-deck','t-deck-details',true]];
 for(const [id,target,initial] of aids){
  if(id==='t-show-deck') await page.locator('#table-stats-dialog .dialog-close').click();
  const button=page.locator('#'+id), content=page.locator('#'+target);
  assert.equal(await button.getAttribute('aria-controls'),target);
  assert.equal(await button.getAttribute('aria-expanded'),String(initial));
  assert.equal(await content.isVisible(),initial);
  await button.click();
  assert.equal(await content.isVisible(),!initial);
  assert.equal(await button.innerText(),initial?'Show':'Hide');
  assert.ok(await button.isVisible(),'header remains available when aid is hidden');
  await button.press('Space');
  assert.equal(await content.isVisible(),initial,'keyboard toggles match mouse behavior');
 }
 await page.locator('#table-panel .activity-stats-button').click();
 await page.locator('#t-show-strategy').click();
 assert.match(await page.locator('#t-strategy-guide').innerText(),/Deal a hand/);
 await page.locator('#t-show-count').click();
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.evaluate(()=>window.aidTest.prepare());
 await page.locator('#btn-table-deal').click();
 await page.waitForFunction(()=>!document.getElementById('t-btn-split').disabled);
 await page.locator('#table-panel .activity-stats-button').click();
 assert.equal(await page.locator('#t-count-display .stat-num').first().innerText(),'+1','unrevealed ten is excluded from count');
 for(const [id] of aids) assert.equal(await page.locator('#'+id).isEnabled(),true,'visibility controls work during play');
 assert.equal(await page.locator('#t-ai-count').isDisabled(),true,'round configuration stays locked');
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.setViewportSize({width:375,height:667});
 await page.locator('#t-btn-split').click();
 const splitLayout=await page.locator('#table-panel .activity-screen').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
 assert.ok(splitLayout.scroll<=splitLayout.height+1,'split hands fit the phone game screen');
 await page.locator('#table-panel .activity-stats-button').click();
 assert.match(await page.locator('#t-strategy-guide').innerText(),/Hard 11/);
 await page.locator('#t-show-strategy').click();
 assert.equal(await page.locator('#t-strategy-guide').isVisible(),false);
 await page.locator('#t-show-strategy').click();
 assert.match(await page.locator('#t-strategy-guide').innerText(),/Hard 11/,'reopening guide uses active split hand');
 await page.locator('#t-show-count').click();
 assert.equal(await page.locator('#t-count-display').isVisible(),false);
 await page.locator('#t-show-count').click();
 assert.equal(await page.locator('#t-count-display .stat-num').first().innerText(),'+3');
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.locator('#t-show-deck').click();
 assert.equal(await page.locator('#t-deck-details').isVisible(),false);
 assert.equal(await page.locator('#t-show-deck').isVisible(),true);
 await page.locator('#t-show-deck').click();
 await page.locator('#t-btn-double').click();
 await page.waitForFunction(()=>document.getElementById('t-strategy-guide').textContent.includes('Hard 10'));
 await page.locator('#table-panel .activity-stats-button').click();
 await page.locator('#t-show-strategy').click();await page.locator('#t-show-strategy').click();
 assert.match(await page.locator('#t-strategy-guide').innerText(),/Hard 10/,'guide advances to second split hand');
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.locator('#t-btn-double').click();
 await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled);
 await page.locator('#table-panel .activity-stats-button').click();
 assert.match(await page.locator('#t-strategy-guide').innerText(),/Deal a hand/,'settlement clears stale advice');
 assert.equal(await page.locator('#t-count-display .stat-num').first().innerText(),'0','hole card and dealer draw are counted once');
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.locator('#table-panel .activity-options-button').click();
 await page.locator('#btn-table-reshuffle').click();
 await page.locator('#table-options-dialog .dialog-close').click();
 assert.equal(await page.locator('#t-count-display .stat-num').first().innerText(),'0');
 for(const width of [1280,375,320]){
  await page.setViewportSize({width,height:1000});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`no overflow at ${width}`);
  assert.ok(await page.locator('#t-show-deck').isVisible());
 }
 const unique=await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(el=>el.id);return ids.length===new Set(ids).size;});
 assert.ok(unique,'each control has a unique ID');
 await page.screenshot({path:'/tmp/play-aids-mobile.png',fullPage:true,animations:'disabled'});
 await page.locator('[data-tab="home"]').click();
 await page.screenshot({path:'/tmp/heart-paw-spacing.png',fullPage:true,animations:'disabled'});
 assert.deepEqual(errors,[]);
 console.log('PASS: consistent aid visibility, keyboard controls, live-round toggles, active split guide, hole-card count, reset behavior, unique controls, mobile layout.');
 } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1)});
