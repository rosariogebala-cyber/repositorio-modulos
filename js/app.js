'use strict';
const modulos = window.NEXOIA_MODULES;
const palette = { estructura:'#38a58b', contenido:'#5084a6', negocio:'#b77658', confianza:'#8a75aa', informacion:'#aa8b50' };
const $ = selector => document.querySelector(selector);
const normalize = text => text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
let termino = '', lastFocus;
const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function renderCategorias() {
  $('#categorias').innerHTML = modulos.map(m => `<a class="category" href="#${m.id}" data-module="${m.id}">${escapeHTML(m.nombre)}</a>`).join('');
}
function renderModulos() {
  const visible = modulos.filter(m => normalize(m.nombre+' '+m.descripcion).includes(normalize(termino)));
  $('#sin-resultados').hidden = visible.length > 0;
  $('#recuento').textContent = `${visible.length} de ${modulos.length} secciones · ${visible.length*3} propuestas`;
  $('#limpiar').hidden = !termino;
  $('#modulos').innerHTML = visible.map(m => `<section class="module-section" id="${m.id}"><div class="module-heading"><div class="module-title"><span class="circle" style="background:${palette[m.categoria]}">${String(m.numero).padStart(2,'0')}</span><h2>${escapeHTML(m.nombre)}</h2></div><p>${escapeHTML(m.descripcion)}</p></div>${m.variantes.map(v=>`<figure class="variant-card"><button type="button" class="preview" aria-label="Ampliar ${escapeHTML(m.nombre)}, variante ${v.nombre}" data-img="${v.imagen}" data-label="${escapeHTML(m.nombre)} · ${v.nombre}"><img loading="lazy" decoding="async" src="${v.imagen}" width="${v.ancho}" height="${v.alto}" alt="${escapeHTML(m.nombre)}, variante ${v.nombre}"></button><figcaption><span>${v.nombre}</span><span>${v.ancho} × ${v.alto} px</span></figcaption></figure>`).join('')}</section>`).join('');
}
$('#categorias').addEventListener('click', e => {
  const link=e.target.closest('[data-module]');if(!link)return;
  if(termino){termino='';$('#buscar').value='';renderModulos();}
  document.querySelectorAll('[data-module]').forEach(a=>{a.classList.toggle('active',a===link);a.removeAttribute('aria-current');});
  link.setAttribute('aria-current','location');
});
$('#buscar').addEventListener('input',e=>{termino=e.target.value.trim();renderModulos();});
$('#limpiar').addEventListener('click',()=>{termino='';$('#buscar').value='';renderCategorias();renderModulos();});
$('#modulos').addEventListener('click',e=>{
 const button=e.target.closest('.preview');if(!button)return;
 lastFocus=button;
 $('#imagen-ampliada').src=button.dataset.img;$('#imagen-ampliada').alt=button.dataset.label;
 $('#descripcion-ampliada').textContent=button.dataset.label;
 $('#descargar-imagen').href=button.dataset.img;$('#descargar-imagen').download=button.dataset.img.split('/').slice(-2).join('-');
 $('#lightbox').hidden=false;document.body.classList.add('modal-open');
 document.querySelector('main').inert=true;document.querySelector('.header').inert=true;document.querySelector('.footer').inert=true;
 $('#cerrar').focus();
});
function closeViewer(){if($('#lightbox').hidden)return;$('#lightbox').hidden=true;document.body.classList.remove('modal-open');document.querySelector('main').inert=false;document.querySelector('.header').inert=false;document.querySelector('.footer').inert=false;lastFocus?.focus();}
$('#cerrar').addEventListener('click',closeViewer);
$('#lightbox').addEventListener('click',e=>{if(e.target.classList.contains('viewer-body'))closeViewer();});
document.addEventListener('keydown',e=>{
 if($('#lightbox').hidden)return;
 if(e.key==='Escape')closeViewer();
 if(e.key==='Tab'){const first=$('#descargar-imagen'),last=$('#cerrar');if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}}
});
renderCategorias();renderModulos();

// Keep anchor targets visible below the sticky header and section navigation.
function updateNavigationOffset(){
 const header=document.querySelector('.header');const bar=document.querySelector('.category-bar');
 document.documentElement.style.setProperty('--header-height',`${header.getBoundingClientRect().height}px`);
 document.documentElement.style.setProperty('--section-offset',`${header.getBoundingClientRect().height+bar.getBoundingClientRect().height+20}px`);
}
new ResizeObserver(updateNavigationOffset).observe(document.querySelector('.header'));
new ResizeObserver(updateNavigationOffset).observe(document.querySelector('.category-bar'));
updateNavigationOffset();
