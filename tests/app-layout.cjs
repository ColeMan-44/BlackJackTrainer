const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:375,height:667},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(path.join(__dirname,'../index.html'),'utf8')}));
 await page.goto('http://blackjack.test/');
 // Global Options is a dialog action, not navigation to a missing tab.
 for(const id of ['home','rules','cheatsheet','math','simulator']){
  if(id!=='home') await page.locator('.nav-group summary').filter({hasText:'Learn'}).click();
  await page.locator(`[data-tab="${id}"]`).click();
  for(const close of ['done','escape']){
   const options=page.locator('.app-options-button');
   await options.click();
   assert.ok(await page.locator(`#${id}-panel`).evaluate(e=>e.classList.contains('active') && !e.inert),'previous page stays active behind Options');
   assert.ok(await page.locator('#global-options-dialog').isVisible());
   if(close==='done') await page.locator('#global-options-dialog .dialog-close').click();
   else await page.keyboard.press('Escape');
   assert.equal(await page.locator('#global-options-dialog').isVisible(),false);
   assert.equal(await page.locator('.panel.active').getAttribute('id'),id+'-panel','closing Options preserves the previous tab');
   assert.ok(await page.locator(`#${id}-panel`).isVisible());
   assert.ok(await options.evaluate(e=>e===document.activeElement),'focus returns to Options');
  }
 }

 async function activity(id){
  if(id==='table') await page.locator('[data-tab="table"]').click();
  else {await page.locator('.nav-group summary').filter({hasText:'Practice'}).click();await page.locator(`[data-tab="${id}"]`).click();}
 }
 for(const [width,height] of [[1280,800],[390,844],[375,667],[320,568]]){
  await page.setViewportSize({width,height});
  for(const id of ['table','strategy','counting','speedcount','cardmath']){
   await activity(id);
   const geometry=await page.locator('.panel.active .activity-screen').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight,width:e.clientWidth,scrollWidth:e.scrollWidth,bottom:e.getBoundingClientRect().bottom,viewport:innerHeight,bodyHeight:document.documentElement.scrollHeight,bodyWidth:document.documentElement.scrollWidth,viewportWidth:innerWidth}));
   assert.ok(geometry.scroll<=geometry.height+1,`${id} fits vertically at ${width}x${height}: ${JSON.stringify(geometry)}`);
   assert.ok(geometry.scrollWidth<=geometry.width+1,`${id} fits horizontally`);
   assert.ok(geometry.bottom<=geometry.viewport,`${id} controls are on screen`);
   assert.ok(geometry.bodyHeight<=geometry.viewport,`${id} has no vertical page scroll`);
   assert.ok(geometry.bodyWidth<=geometry.viewportWidth,`${id} has no page overflow`);
   const options=page.locator(`#${id}-panel .activity-options-button`);
   await options.click();
   assert.ok(await page.locator(`#${id}-options-dialog`).isVisible());
   await page.keyboard.press('Escape');
   assert.equal(await page.locator(`#${id}-options-dialog`).isVisible(),false);
   assert.equal(await options.evaluate(e=>e===document.activeElement),true,'focus returns to opener');
   await options.click();
   await page.locator(`#${id}-options-dialog .dialog-close`).click();
   assert.equal(await page.locator('.panel.active').getAttribute('id'),id+'-panel','Done returns to the current activity');
   assert.ok(await page.locator(`#${id}-panel .activity-screen`).isVisible());
  }
 }
 await activity('counting');
 await page.locator('#counting-panel .activity-options-button').click();
 await page.locator('#deal-speed').selectOption('250');
 await page.locator('#card-limit').selectOption('10');
 await page.locator('#counting-options-dialog .dialog-close').click();
 await page.locator('#btn-start-shoe').click();
 await page.waitForFunction(()=>Number(document.getElementById('c-dealt').textContent)>=1);
 await page.locator('#counting-panel .activity-stats-button').click();
 const pausedCount=await page.locator('#c-dealt').innerText();
 await page.waitForTimeout(700);
 assert.equal(await page.locator('#c-dealt').innerText(),pausedCount,'counting pauses behind stats');
 await page.locator('#counting-stats-dialog .dialog-close').click();
 await page.waitForFunction(previous=>Number(document.getElementById('c-dealt').textContent)>previous,Number(pausedCount));
 await page.locator('#counting-panel .activity-options-button').click();
 await page.locator('#card-limit').selectOption('20');
 await page.locator('#counting-options-dialog .dialog-close').click();
 await page.waitForTimeout(500);
 assert.equal(await page.locator('#c-dealt').innerText(),'0','changing drill options does not resume stale drill');
 await activity('strategy');
 await page.locator('#strategy-panel .activity-options-button').click();
 await page.locator('#bs-timed-mode').selectOption('on');
 await page.locator('#strategy-options-dialog .dialog-close').click();
 await page.locator('#btn-new-hand').click();
 while(await page.locator('#btn-hit').isDisabled()) await page.locator('#btn-new-hand').click();
 await page.waitForTimeout(300);
 await page.locator('#strategy-panel .activity-stats-button').click();
 const pausedWidth=await page.locator('#bs-timer-bar').evaluate(e=>e.style.width);
 await page.waitForTimeout(500);
 assert.equal(await page.locator('#bs-timer-bar').evaluate(e=>e.style.width),pausedWidth,'timed strategy pauses behind Progress');
 await page.locator('#strategy-stats-dialog .dialog-close').click();
 await page.waitForFunction(width=>parseFloat(document.getElementById('bs-timer-bar').style.width)<width,parseFloat(pausedWidth));
 await page.locator('#strategy-panel .activity-options-button').click();
 await page.locator('#bs-timed-mode').selectOption('off');
 await page.locator('#strategy-options-dialog .dialog-close').click();
 assert.equal(await page.locator('#bs-timer-wrap').isVisible(),false);
 await page.setViewportSize({width:375,height:667});
 await activity('table');
 await page.locator('#btn-table-deal').click();
 for(let i=0;i<30;i++){
  if(await page.locator('#t-insurance-actions').isVisible()) await page.locator('#t-btn-insure-no').click();
  if(await page.locator('#t-btn-stand').isEnabled() || await page.locator('#btn-table-deal').isEnabled()) break;
  await page.waitForTimeout(200);
 }
 const controls=await page.locator('#table-panel .activity-screen').evaluate(e=>({height:e.clientHeight,scroll:e.scrollHeight}));
 assert.ok(controls.scroll<=controls.height+1,'dealt table also fits, including action buttons');
 await page.screenshot({path:'/tmp/app-play-phone.png',animations:'disabled'});
 await page.locator('#table-panel .activity-options-button').click();
 assert.equal(await page.locator('#t-ai-count').isDisabled(),await page.locator('#btn-table-deal').isDisabled(),'round settings remain locked in Options');
 await page.screenshot({path:'/tmp/app-options-phone.png',animations:'disabled'});
 await page.locator('#table-options-dialog .dialog-close').click();
 assert.deepEqual(errors,[]);
 console.log('PASS: five activity screens fit four viewport sizes, modal focus/escape, counting pause/resume, settings reset, live table controls.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
