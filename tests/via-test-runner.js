window.addEventListener('DOMContentLoaded',()=>setTimeout(async()=>{
 for(let i=0;i<100&&!window.__KIMI_LAZY__;i++)await new Promise(r=>setTimeout(r,100));
 const result={ua:navigator.userAgent,initial:window.fixtureInitialCounts,adapter:!!window.__KIMI_LAZY__};
 const report=()=>fetch('/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(result)});
 await report();
 try {
  const hw=new URLSearchParams(location.search).get('hw')==='1';
  await (hw?runHwFixtureTests():runFixtureTests({allowLate:true}));
  result.results=window.fixtureTestResults;
 } catch(e) { result.error=String(e); result.results=window.fixtureTestResults; }
 result.stats=window.__KIMI_LAZY__?.stats();
 await report();
 const status=document.createElement('div');status.style='position:fixed;bottom:4px;left:4px;z-index:2147483001;background:#123;color:white;padding:10px';status.textContent=result.error?'TEST FAILED':'PASS '+result.results.filter(r=>r.pass).length+'/'+result.results.length;document.body.append(status);
},200));
