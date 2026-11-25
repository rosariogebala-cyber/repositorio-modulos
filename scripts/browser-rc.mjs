import { chromium, firefox, webkit } from 'playwright';
import axe from 'axe-core';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base = new URL(process.env.QA_BASE);
assert.equal(base.hostname, '127.0.0.1');
assert.equal(base.protocol, 'https:');
const report = [];
const allowedStatic = new Set(['fonts.googleapis.com','fonts.gstatic.com','cdn.jsdelivr.net']);
for (const [engine, type] of Object.entries({chromium, firefox, webkit})) {
  const browser = await type.launch();
  try {
    for (const width of [1440, 320]) {
      const context = await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
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
        // Restore the same fictitious draft before each browser/viewport run.
        const qualityErrors = [];
        const qualityError = e => qualityErrors.push(String(e));
        page.on('pageerror', qualityError);
        const qualityPath = '/maquetas/constructor.html?landing='+process.env.QA_DRAFT_ID;
        try {
          const endpoint=base.origin+'/api/landings/'+process.env.QA_DRAFT_ID;
          const existing=await context.request.get(endpoint);
          assert.equal(existing.status(),200);
          const row=await existing.json();
          const reset=await context.request.put(endpoint+'/borrador',{data:{
            cliente_id:row.cliente_id,nombre:row.nombre,plan_id:'express',html:row.html,
            items:row.items,estilo:row.estilo||'',descripcion:'',base_revision:row.borrador_revision}});
          assert.equal(reset.status(),200);
          await page.goto(base.origin+qualityPath);
          const review=page.locator('[data-lb-qa-review]');
          await review.click();
          const panel=page.locator('[data-lb-workflow-report]');
          await panel.getByRole('heading',{name:'Control de calidad',exact:true}).waitFor();
          assert.ok(await panel.getByText('Falta la descripción para Google',{exact:true}).isVisible());
          assert.ok(!(await panel.innerText()).includes(String.fromCharCode(92)+'n'));
          await page.addScriptTag({content:axe.source});
          const results=await page.evaluate(()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
          const edit=panel.getByRole('button',{name:'Editar descripción',exact:true});
          await edit.focus();
          await page.keyboard.press('Enter');
          const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,visible:!!document.activeElement?.getClientRects().length}));
          assert.equal(focus.tag,'TEXTAREA');
          const suggest=panel.getByRole('button',{name:'Sugerir desde el contenido',exact:true});
          page.once('dialog',d=>d.accept());
          await suggest.click();
          assert.ok((await page.locator('[data-lb-desc]').inputValue()).trim().length>0);
          await page.locator('[data-lb-create]').click();
          await page.waitForFunction(()=>document.querySelector('[data-lb-create-label]').textContent==='Borrador guardado');
          await review.click();
          await panel.getByRole('heading',{name:'Control de calidad',exact:true}).waitFor();
          assert.equal(await panel.getByText('Falta la descripción para Google',{exact:true}).count(),0);
          assert.ok(await page.locator('[data-lb-publish-one]').isDisabled());
          const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
          report.push({engine,width,path:qualityPath,errors:qualityErrors,focus,overflow,violations:results.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),incomplete:results.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
        } catch(e) { report.push({engine,width,path:qualityPath,failure:String(e),errors:qualityErrors}); }
        finally {page.off('pageerror',qualityError);}
        // Do not let the team cookie mask missing portal authorization.
        await context.close();
        const portalContext = await browser.newContext({viewport:{width,height:900},ignoreHTTPSErrors:true});
        try {
        await portalContext.route('**/*', route => {
          const u = new URL(route.request().url());
          if (u.origin === base.origin || (u.protocol === 'https:' && allowedStatic.has(u.hostname) && route.request().method() === 'GET' && ['stylesheet','font'].includes(route.request().resourceType()))) return route.continue();
          return route.abort();
        });
        const page = await portalContext.newPage();
        const portalPath='/portal/'+encodeURIComponent(process.env.QA_SLUG)+'/';
        const errors=[];
        const onError=e=>errors.push(String(e));
        page.on('pageerror',onError);
        const requests=[];
        const onResponse=r=>{const u=new URL(r.url());if(u.origin===base.origin && u.pathname.startsWith('/api/portal/'))requests.push({path:u.pathname,hasSite:u.searchParams.get('sitio')===process.env.QA_SLUG,status:r.status()});};
        const onFailed=r=>{const u=new URL(r.url());if(u.origin===base.origin && u.pathname.startsWith('/api/portal/'))requests.push({path:u.pathname,error:r.failure()?.errorText});};
        page.on('response',onResponse);
        page.on('requestfailed',onFailed);
        try {
          await page.goto(base.origin+portalPath);
          await page.locator('[data-login-form]').waitFor({state:'visible'});
          await page.locator('#usuario').fill(process.env.QA_PORTAL_USER);
          await page.locator('#clave').fill(process.env.QA_PORTAL_PASSWORD);
          const loginResponse=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/portal/login' && r.request().method()==='POST');
          await page.locator('[data-login-form] button[type=submit]').click();
          const login=await loginResponse;
          assert.equal(login.status(),200,'Portal login HTTP status');
          // Wait for the browser's own authenticated fetch; APIRequestContext can race cookie processing.
          await page.waitForFunction(async slug=>{
            const r=await fetch('/api/portal/sesion?sitio='+encodeURIComponent(slug),{credentials:'same-origin',cache:'no-store'});
            return r.ok && (await r.json()).ok===true;
          },process.env.QA_SLUG,{timeout:10000});
          try {
            await page.locator('[data-app]').waitFor({state:'visible'});
          } catch (err) {
            // Read-only probes distinguish cached URL responses from actual authorization failures.
            const probes=await page.evaluate(async slug=>{
              const out=[];
              for (const suffix of ['', '&qa_probe='+Date.now()]) {
                const r=await fetch('/api/portal/inicio?sitio='+encodeURIComponent(slug)+suffix,{credentials:'same-origin',cache:'no-store'});
                out.push({uniqueURL:!!suffix,status:r.status});
              }
              return out;
            },process.env.QA_SLUG);
            requests.push({probes});
            throw err;
          }
          assert.equal((await portalContext.request.get(base.origin+'/api/gestion/clientes')).status(),401,'Portal session must not grant team access');
          for (const tab of ['resumen','web','pedidos','visitas','consultas','plan','marca','contacto','cuenta']) {
            const before=errors.length;
            try {
              await page.locator('[data-tab="'+tab+'"]').click();
              await page.waitForFunction(t=>location.hash==='#'+t && document.querySelector('[data-tab="'+t+'"]').getAttribute('aria-current')==='page',tab);
              await page.locator('[data-view] h1').waitFor({state:'visible'});
              if (!(await page.evaluate(()=>Boolean(window.axe)))) await page.addScriptTag({content:axe.source});
              const results=await page.evaluate(()=>window.axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}}));
              await page.keyboard.press('Tab');
              const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,visible:!!document.activeElement?.getClientRects().length}));
              const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
              report.push({engine,width,path:portalPath+'#'+tab,errors:errors.slice(before),focus,overflow,violations:results.violations.map(v=>({id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.target)})),incomplete:results.incomplete.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))});
            } catch(e) {report.push({engine,width,path:portalPath+'#'+tab,failure:String(e)});}
          }
          await page.locator('[data-logout]').click();
          await page.locator('[data-login-form]').waitFor({state:'visible'});
          assert.equal((await portalContext.request.get(base.origin+'/api/portal/inicio?sitio='+encodeURIComponent(process.env.QA_SLUG))).status(),401,'Logout must revoke browser access');
        } catch(e) {report.push({engine,width,path:portalPath+'#auth-flow',failure:String(e),errors,requests});}
        finally {page.off('pageerror',onError);page.off('response',onResponse);page.off('requestfailed',onFailed);}
        } finally {await portalContext.close();}
      } finally {await context.close();}
    }
  } finally {await browser.close();}
}
fs.writeFileSync('browser-rc-report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
assert.equal(report.length,84);
assert.ok(report.every(r=>!r.failure&&!r.errors.length&&r.focus.visible&&!['BODY','HTML'].includes(r.focus.tag)&&!r.overflow&&!r.violations.length),'Browser QA failed; inspect browser-rc-report.json');
