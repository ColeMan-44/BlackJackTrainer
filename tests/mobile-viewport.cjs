const {chromium}=require('playwright');
const fs=require('node:fs');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || undefined,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:664},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8')}));
  await page.goto('http://blackjack.test/');
  await page.addStyleTag({content:'body{padding-top:20px;padding-bottom:34px}'});
  await page.locator('[data-tab="table"]').click();
  for(const [width,height] of [[390,664],[375,568],[320,480],[390,744]]){
   await page.setViewportSize({width,height});
   await page.waitForFunction(()=>Math.abs(document.body.getBoundingClientRect().height-visualViewport.height)<1);
   const bounds=await page.locator('.app').evaluate(e=>({bottom:e.getBoundingClientRect().bottom,limit:visualViewport.height-34}));
   assert.ok(bounds.bottom<=bounds.limit+1,'app respects the bottom safe area');
   for(const selector of ['button.chip-5','button.chip-25','button.chip-100','button.chip-500','#btn-clear-bet']){
    const control=page.locator('#table-panel '+selector);
    await control.scrollIntoViewIfNeeded();
    assert.ok(await control.evaluate(e=>{const r=e.getBoundingClientRect();return r.top>=0 && r.bottom<=visualViewport.height-34+1 && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'control is visible and receives touches: '+selector);
    await control.tap();
   }
  }
  console.log('PASS: mobile controls remain tappable with safe-area insets and changing browser viewport heights.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
