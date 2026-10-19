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
 window.handTest={preview(count,split=false,short=false){
  document.getElementById('t-ai-count').value=String(count);buildAISeats(count);
  const cards=(short?['A','7']:['A','A','2','2','2','2','2','2']).map(rank=>({rank,suit:'♠',red:false}));
  tableUserCards=cards;tableSplitHands=null;
  tableAIResultsForRound=Array.from({length:count},()=>[{cards:cards.slice(),bet:1,busted:false}]);
  updateAISeatsFromResults(tableAIResultsForRound);
  renderTableUserRow(split?[{cards,bet:1},{cards:cards.slice(),bet:1}]:null);
  tableDealerCards=[{rank:'6',suit:'♠'},{rank:'10',suit:'♠'},{rank:'5',suit:'♠'}];renderTableDealerRow(true);
  soundOn=false;aiSeatEls.forEach(seat=>showBanner(seat.bannerEl,'Loss','loss'));
  showBanner(document.getElementById('t-user-banner'),'Loss · −$25','loss');
  layoutTableHands();
 },stable(){
  const before=aiSeatEls.map(seat=>[...seat.handRowEl.querySelectorAll('.card')]);
  tableAIResultsForRound[0][0].cards.push({rank:'3',suit:'♥',red:true});
  updateAISeatsFromResults(tableAIResultsForRound);
  const unchanged=before.every((cards,i)=>cards.every((card,j)=>aiSeatEls[i].handRowEl.querySelectorAll('.card')[j]===card));
  const cards=tableAIResultsForRound[0][0].cards;
  tableAIResultsForRound[0]=[{cards:cards.slice(0,2),bet:1},{cards:cards.slice(2),bet:1}];
  updateAISeatsFromResults(tableAIResultsForRound);
  const splitStable=before[0].every(card=>aiSeatEls[0].handRowEl.contains(card));
  const after=aiSeatEls.map(seat=>[...seat.handRowEl.querySelectorAll('.card')]);
  updateAISeatsFromResults(tableAIResultsForRound);
  return unchanged && splitStable && after.every((cards,i)=>cards.every((card,j)=>aiSeatEls[i].handRowEl.querySelectorAll('.card')[j]===card));
 },expose(){tableGraveyard=[{rank:'A',suit:'♠'},{rank:'A',suit:'♠'},{rank:'K',suit:'♥',red:true}];renderGraveyardManifest();}};
 // ---------------- init ----------------`);
 await page.route('http://blackjack.test/**',r=>r.fulfill({contentType:'text/html',body:html}));
 await page.goto('http://blackjack.test/');
 await page.locator('[data-tab="table"]').click();
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>window.handTest.preview(3,false,true));
 assert.ok(await page.evaluate(()=>window.handTest.stable()),'turn updates and splits retain existing card nodes');
 await page.emulateMedia({reducedMotion:'reduce'});
 const cut=page.locator('#t-deck-tracker .cut-card-marker');
 assert.ok(await cut.isVisible(),'red cut line is restored');
 assert.equal(await cut.evaluate(e=>Math.round(e.offsetLeft/e.parentElement.clientWidth*100)),15,'cut marker matches 15% shoe threshold');
 for(const [width,height] of [[1440,900],[768,1000],[375,667],[320,568]]){
  await page.setViewportSize({width,height});
  for(const count of [0,2,4,6]){
   await page.evaluate(n=>window.handTest.preview(n),count);
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const geometry=await page.evaluate(()=>{
    const screen=document.querySelector('#table-panel .activity-screen');
    const table=document.getElementById('casino-table').getBoundingClientRect();
    const seats=document.getElementById('t-seats-row');
    const rx=table.width*.5,ry=table.height*.36;
    const railBottom=x=>table.bottom-ry+ry*Math.sqrt(Math.max(0,1-Math.pow((x-table.left-rx)/rx,2)))-8;
    const hands=[...document.querySelectorAll('#casino-table .stepped-hand')];
    return {screenFits:screen.scrollHeight<=screen.clientHeight+1 && screen.scrollWidth<=screen.clientWidth+1,seatsFit:seats.scrollWidth<=seats.clientWidth+1,
     cardsFit:hands.every(hand=>{const h=hand.getBoundingClientRect();return [...hand.children].filter(c=>c.classList.contains('card')).every(c=>{const r=c.getBoundingClientRect();return r.left>=h.left-1 && r.right<=h.right+1 && r.top>=h.top-1 && r.bottom<=h.bottom+1 && r.left>=table.left-1 && r.right<=table.right+1 && r.top>=table.top-1 && r.bottom<=table.bottom+1 && r.bottom<=Math.min(railBottom(r.left),railBottom(r.right))+1;});}),
     labelsFit:[...document.querySelectorAll('#t-seats-row .result-banner.show')].every(label=>{const r=label.getBoundingClientRect();return r.bottom<=Math.min(railBottom(r.left),railBottom(r.right))+1;}),
     newestOnTop:hands.every(hand=>{const cards=[...hand.children].filter(c=>c.classList.contains('card'));return cards.every((card,index)=>index===0 || Number(card.style.zIndex)>Number(cards[index-1].style.zIndex));}),
     dealerRow:[...document.querySelectorAll('#t-dealer-row > .card')].every((card,i,cards)=>!i || (Math.abs(card.offsetTop-cards[0].offsetTop)<1 && card.offsetLeft>=cards[i-1].offsetLeft+cards[i-1].offsetWidth)),
     stepped:hands.filter(hand=>hand.id!=='t-dealer-row').every(hand=>{const cards=[...hand.children].filter(c=>c.classList.contains('card'));return cards.length<2 || cards.at(-1).getBoundingClientRect().top<cards[0].getBoundingClientRect().top;})};
   });
   assert.ok(geometry.screenFits,`screen fits ${count+1} seats at ${width}x${height}`);
   assert.ok(geometry.seatsFit,'no seat-strip side scrolling');
   assert.ok(geometry.cardsFit,`eight-card hands stay inside the table (${count+1} seats, ${width}x${height})`);
   assert.ok(geometry.dealerRow,'dealer cards are side by side without overlap');
   assert.ok(geometry.stepped,'cards step upward');
   assert.ok(geometry.newestOnTop,'new cards overlap above earlier cards');
   assert.ok(geometry.labelsFit,'results stay within the curved rail');
   if(count===6 && width===375) await page.screenshot({path:'/tmp/stepped-seats-phone.png',animations:'disabled'});
   if(count===6 && width===1440) await page.screenshot({path:'/tmp/stepped-seats-desktop.png',animations:'disabled'});
  }
 }
 await page.setViewportSize({width:1440,height:900});
 await page.evaluate(()=>window.handTest.preview(0,false,true));
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const pair=await page.locator('#t-user-row > .card').evaluateAll(cards=>cards.map(c=>({height:c.getBoundingClientRect().height,left:c.getBoundingClientRect().left,z:Number(c.style.zIndex)})));
 assert.ok(pair[0].height>76,'ordinary hands use larger cards than the previous 76px cap');
 assert.ok(pair[1].left-pair[0].left>7,'ordinary hands have wider spacing than the previous 7px cap');
 assert.ok(pair[1].z>pair[0].z,'newest card is drawn over the previous card');
 await page.setViewportSize({width:375,height:667});
 await page.evaluate(()=>{window.handTest.preview(2,true);window.handTest.expose();});
 await page.locator('#table-panel .activity-stats-button').click();
 await page.locator('.dealt-card-history > summary').click();
 assert.equal(await page.locator('.exposed-card-table tbody tr').count(),13);
 assert.equal(await page.locator('.exposed-card-table tbody td').count(),52);
 assert.equal(await page.locator('.exposed-card-table td[aria-label="A♠: 2 of 6 exposed"]').count(),1);
 assert.equal(await page.locator('.exposed-card-table td[aria-label="K♥: 1 of 6 exposed"]').count(),1);
 assert.equal(await page.locator('#shared-options #dealt-cards').count(),0,'history is in tools, not Options');
 await page.locator('.exposed-card-table').scrollIntoViewIfNeeded();
 await page.screenshot({path:'/tmp/dealt-cards-ledger.png',animations:'disabled'});
 await page.locator('#table-stats-dialog .dialog-close').click();
 await page.locator('.nav-group summary').filter({hasText:'Practice'}).click();
 await page.locator('[data-tab="counting"]').click();
 await page.locator('#counting-panel .activity-options-button').click();
 assert.ok(await page.locator('#g-decks').isVisible());assert.ok(await page.locator('#g-sound').isVisible());
 assert.equal(await page.locator('#g-h17').isVisible(),false,'dealer rules are not presented as counting-drill settings');
 await page.locator('#counting-options-dialog .dialog-close').click();
 await page.locator('[data-tab="table"]').click();await page.locator('#table-panel .activity-options-button').click();
 assert.ok(await page.locator('#g-h17').isVisible(),'dealer rules return in Play Options');
 assert.deepEqual(errors,[]);
 console.log('PASS: no scrolling or off-table eight-card hands with 1–7 players, upward stacks, cut line, rank/suit ledger, relevant rule options.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
