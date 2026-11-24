import { chromium, firefox, webkit } from 'playwright';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = new URL(process.env.QA_BASE);
assert.equal(base.hostname, '127.0.0.1');
assert.equal(base.protocol, 'http:');
const report = [];
const allowedStatic = new Set(['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net']);
for (const [engine, type] of Object.entries({chromium, firefox, webkit})) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 320]) {
      const context = await browser.newContext({viewport:{width,height:900}});
      try {
        await context.route('**/*', route => {
          const u = new URL(route.request().url());
          if (u.origin === base.origin || (u.protocol === 'https:' && allowedStatic.has(u.hostname) && route.request().method() === 'GET' && ['stylesheet','font'].includes(route.request().resourceType()))) return route.continue();
          return route.abort();
        });
        const anon = await context.request.get(base.origin+'/api/gestion/clientes');
        assert.equal(anon.status(),401);
        await context.addCookies(Object.entries(JSON.parse(process.env.QA_COOKIES)).map(([name,value])=>({name,value,url:base.origin,httpOnly:true,secure:false})));
        const page = await context.newPage();
        for (const path of ['/maquetas/constructor.html','/maquetas/clientes.html','/maquetas/landings.html','/portal/'+encodeURIComponent(process.env.QA_SLUG)+'/']) {
          const errors=[];
          const onError=e=>errors.push(String(e));
          page.on('pageerror',onError);
          try {
            const res=await page.goto(base.origin+path,{waitUntil:'load'});
            assert.ok(res && res.ok(),path);
            assert.equal(new URL(page.url()).pathname,path,'Unexpected redirect');
            await page.locator('body').waitFor();
            await page.evaluate(()=>document.fonts.ready);
            await page.addScriptTag({content:axe.source});
            const results=await page.evaluate(()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
            await page.keyboard.press('Tab');
            const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,visible:!!document.activeElement?.getClientRects().length}));
            const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
            report.push({engine,width,path,errors,focus,overflow,violations:results.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:results.incomplete.map(v=>v.id)});
          } catch(e) { report.push({engine,width,path,failure:String(e)}); }
          finally {page.off('pageerror',onError);}
        }
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
fs.writeFileSync('browser-rc-report.json',JSON.stringify(report,null,2));
assert.equal(report.length,24);
assert.ok(report.every(r=>!r.failure&&!r.errors.length&&r.focus.visible&&!['BODY','HTML'].includes(r.focus.tag)&&!r.overflow&&!r.violations.length),'Browser QA failed; inspect browser-rc-report.json');
