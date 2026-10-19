const {chromium}=require('playwright');
const fs=require('fs');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({...(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {}),args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1280,height:900}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
let html=fs.readFileSync(require('node:path').join(__dirname,'../Black & Jack.html'),'utf8');
// Observe round results without changing settlement or aggregate counting logic.
html=html.replace('const r = simulateOneRound(RULES, systemKey, betUnits, state, strategyType);', 'const r = simulateOneRound(RULES, systemKey, betUnits, state, strategyType); window.__observedBlackjacks = (window.__observedBlackjacks || 0) + Number(r.blackjack);');
await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
await page.goto('http://blackjack.test/');
await page.locator('#start-training').click();
while(await page.locator('#btn-hit').isDisabled()) await page.locator('#btn-new-hand').click();
await page.locator('#btn-hit').click();
const count=await page.locator('#s-total').innerText();
assert.equal(count,'1');
await page.reload();
assert.equal(await page.locator('#s-total').innerText(),count);
await page.locator('#start-training').click();
await page.screenshot({path:'/tmp/blackjack-desktop.png',fullPage:true,animations:'disabled'});
await page.locator('.tab[data-tab="table"]').click();
await page.locator('#btn-table-deal').click();
assert.equal(await page.locator('#btn-clear-bet').isDisabled(),true);
assert.equal(await page.locator('#btn-table-reshuffle').isDisabled(),true);
assert.equal(await page.locator('#g-h17').isDisabled(),true);
for(let i=0;i<25;i++){
 if(await page.locator('#t-insurance-actions').isVisible()) await page.locator('#t-btn-insure-no').click();
 if(await page.locator('#t-btn-stand').isEnabled()){await page.locator('#t-btn-stand').click();break;}
 if(await page.locator('#btn-table-deal').isEnabled()) break;
 await page.waitForTimeout(300);
}
await page.waitForFunction(()=>!document.getElementById('btn-table-deal').disabled,{},{timeout:20000});
assert.equal(await page.locator('#btn-clear-bet').isEnabled(),true);
// The dealer, lettering and player area must occupy separate vertical regions.
for(const width of [1440,768,375,320]){
 await page.setViewportSize({width,height:1000});
 const layout=await page.evaluate(()=>{
  const rect=s=>document.querySelector(s).getBoundingClientRect().toJSON();
  return {dealer:rect('.dealer-spot'),text:rect('.table-lettering'),player:rect('#t-user-seat'),overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert.ok(layout.dealer.bottom<=layout.text.top,`dealer above lettering at ${width}`);
 assert.ok(layout.text.bottom<=layout.player.top,`lettering above player at ${width}`);
 assert.equal(layout.overflow,false,`Play overflow at ${width}`);
}
await page.setViewportSize({width:375,height:812});
await page.locator('summary').filter({hasText:'Practice'}).click();
await page.locator('.tab[data-tab="strategy"]').click();
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'no mobile overflow');
await page.screenshot({path:'/tmp/blackjack-mobile.png',fullPage:true,animations:'disabled'});
await page.locator('summary').filter({hasText:'Learn'}).click();
await page.locator('.tab[data-tab="simulator"]').click();
await page.locator('#sim-hands').selectOption('500');
await page.locator('#btn-run-sim').click();
await page.waitForFunction(()=>document.getElementById('sim-status').textContent.startsWith('Done'));
assert.equal(await page.locator('#r-hands').innerText(),'500');
assert.equal(Number(await page.locator('#r-bjs').innerText()),await page.evaluate(()=>window.__observedBlackjacks));
assert.deepEqual(errors,[]);
console.log('PASS: browser startup, navigation, decisions, persisted progress, dealing locks, settlement, mobile overflow, simulation blackjack accounting; no JavaScript errors.');
await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
