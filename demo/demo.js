'use strict';
const initial=Object.freeze({name:'Estudio Norte',headline:'Un espacio para vos',description:'Descubrí una experiencia pensada para vos.',services:'Atención personalizada y asesoramiento.',palette:'#243d34'});
const byId=id=>document.getElementById(id);
const fields=Object.keys(initial);
function restore(){fields.forEach(key=>{byId(key).value=initial[key];});render();}
function render(){fields.filter(key=>key!=='palette').forEach(key=>{byId('out-'+key).textContent=byId(key).value;});const color=byId('palette').value;byId('hero').style.backgroundColor=['#243d34','#4931a9','#173c69'].includes(color)?color:initial.palette;}
byId('edit').addEventListener('click',event=>{event.preventDefault();byId('portal').hidden=false;byId('name').focus();});
byId('close').addEventListener('click',()=>{byId('portal').hidden=true;byId('edit').focus();});
byId('editor').addEventListener('submit',event=>{event.preventDefault();render();byId('status').textContent='Vista previa actualizada. No se publicó ningún cambio.';});
byId('reset').addEventListener('click',()=>{restore();byId('status').textContent='Demo restaurado.';});
restore();
