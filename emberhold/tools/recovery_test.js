/* Regression: Embers recovered from an interrupted run are persisted at boot, so a process kill right after launch cannot grant them twice.
   usage: python3 -m http.server 8765 --directory web &  then  node tools/recovery_test.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport:{width:390,height:844} });
  const p = await ctx.newPage();
  await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(300);
  await p.evaluate(()=>localStorage.clear()); await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(()=>{ const S=EH.Save.data; S.tut={welcome:1,buy:1,def:1,abil:1,workshop:1}; EH.UI.closeAll(); EH.Game.startRun(); EH.Game.run.embers=500; EH.Game.appPause(); });
  // Next launch: block pagehide saves so we observe storage exactly as a process kill would leave it.
  await p.addInitScript(() => { const orig = window.addEventListener; window.addEventListener = function (t, f, o) { if (t === 'pagehide') return; return orig.call(this, t, f, o); }; });
  await p.reload(); await p.waitForTimeout(100);
  const stored = await p.evaluate(()=>{ const o=JSON.parse(localStorage.getItem('emberhold.save')); return JSON.parse(o.d).pending; });
  if (stored != null) process.exitCode = 1;
  console.log(stored == null ? 'PASS' : 'FAIL', 'recovered run cleared from storage immediately at boot; stored pending =', JSON.stringify(stored));
  await b.close();
})();
