const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname,'../Black & Jack.html'),'utf8');
function extract(name){
  const start = source.indexOf(`  function ${name}(`);
  assert.notEqual(start,-1,name);
  return source.slice(start,source.indexOf('\n  }',start)+4);
}
function engine(overrides={}){
  const context=vm.createContext({});
  const names=['rankGroup','handValue','baseHard','baseSoft','basePair','buildTables','resolveCell','correctAction','getHandStrategyInfo','playHand'];
  vm.runInContext(`let HARD,SOFT,PAIR,SURRENDER; const RULES=${JSON.stringify({decks:6,h17:false,das:true,surrender:true,...overrides})}; function renderFullCheatSheet(){}; ${names.map(extract).join('\n')} buildTables(RULES);`,context);
  return code=>vm.runInContext(code,context);
}
const hand=(...ranks)=>JSON.stringify(ranks.map(rank=>({rank})));
test('six-deck S17 and H17 strategy regressions',()=>{
 for(const h17 of [false,true]){
  const run=engine({h17});
  const cases=[[['A','8'],6,h17?'D':'S'],[['A','7'],2,h17?'D':'S'],[['10','5'],9,'H'],[['10','6'],8,'H'],[['10','7'],11,h17?'R':'S'],[['8','8'],11,h17?'R':'P'],[['A','K'],6,'S'],[['A','A'],6,'P'],[['5','5'],6,'D']];
  for(const [ranks,dealer,expected] of cases) assert.equal(run(`correctAction(${hand(...ranks)},${dealer},true,true)`),expected,`${h17?'H17':'S17'} ${ranks} vs ${dealer}`);
 }
});
test('doubling fallbacks and surrender eligibility',()=>{
 const run=engine({h17:true});
 assert.equal(run(`correctAction(${hand('A','7')},2,false,false)`),'S');
 assert.equal(run(`correctAction(${hand('6','5')},11,false,false)`),'H');
 assert.equal(run(`correctAction(${hand('10','6')},10,true,false,false)`),'H');
 assert.equal(engine({surrender:false})(`correctAction(${hand('10','6')},10,true,false)`),'H');
 assert.equal(engine({das:false})(`correctAction(${hand('2','2')},2,true,true)`),'H');
 assert.equal(engine({das:false})(`correctAction(${hand('4','4')},6,true,true)`),'H');
});
test('split hands cannot surrender even when DAS is allowed',()=>{
 const run=engine();
 run(`let queue=[{rank:'8'},{rank:'10'},{rank:'2'}]; function drawCard(){return queue.shift();}`);
 const result=JSON.parse(run(`JSON.stringify(playHand(${hand('8','8')},10,RULES,{},'hilo',true,true,'basic'))`));
 assert.equal(result.length,2);
 assert.ok(result.every(h=>!h.surrendered));
 assert.equal(result[0].cards.length,3);
 assert.equal(run(`getHandStrategyInfo(${hand('10','6')},10,true,false,false).getCell(10)`),'H');
});
test('Ace totals remain correct as Aces change from 11 to 1',()=>{
 const run=engine();
 for(const [ranks,total,soft] of [[['A','A'],12,true],[['A','6'],17,true],[['A','6','10'],17,false],[['A','A','9'],21,true],[['K','Q','2'],22,false]]){
  assert.equal(run(`JSON.stringify(handValue(${hand(...ranks)}))`),JSON.stringify({total,soft}));
 }
});
