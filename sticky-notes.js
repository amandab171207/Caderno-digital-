/* Notes belong to a notebook page; coordinates use the available page area. */
(function () {
  'use strict';
  const paper=document.querySelector('#paper');
  const layer=document.createElement('div');layer.className='sticky-notes-layer';layer.setAttribute('aria-label','Bloquinhos desta página');paper.append(layer);
  const toolbar=document.createElement('section');toolbar.className='sticky-notes-toolbar';
  toolbar.innerHTML='<strong>Bloquinhos de notas</strong><label>Formato<select id="stickyShape"><option value="square">Quadrado</option><option value="rectangle">Retângulo</option><option value="rounded">Arredondado</option><option value="circle">Círculo</option></select></label><label>Tamanho<select id="stickySize"><option value="small">Pequeno</option><option value="medium" selected>Médio</option><option value="large">Grande</option></select></label><label>Cor<select id="stickyColor"><option value="yellow">Amarelo</option><option value="pink">Rosa</option><option value="purple">Lilás</option><option value="green">Verde</option></select></label><button type="button" class="secondary-button" id="addStickyNote">＋ Adicionar bloquinho</button><small>Arraste pela alça para posicionar. Clique no texto para escrever. Selecione um bloquinho para mudar seu formato, tamanho ou cor.</small><span id="stickyNoteStatus" role="status" aria-live="polite"></span>';
  document.querySelector('#notebook').before(toolbar);
  const shape=toolbar.querySelector('#stickyShape'),size=toolbar.querySelector('#stickySize'),color=toolbar.querySelector('#stickyColor'),status=toolbar.querySelector('#stickyNoteStatus');
  const shapes=['square','rectangle','rounded','circle'],sizes={small:150,medium:210,large:280},colors=['yellow','pink','purple','green'];
  let selected=null;
  const page=()=>activeNotebook().pages[currentPage];
  const notes=()=>Array.isArray(page().stickyNotes)?page().stickyNotes:(page().stickyNotes=[]);
  const clamp=value=>Math.max(0,Math.min(1,Number(value)||0));
  function save(){persistNotebooks();status.textContent='Bloquinhos salvos nesta página.';}
  function position(element,note){element.style.left=`${clamp(note.x)*Math.max(0,layer.clientWidth-element.offsetWidth)}px`;element.style.top=`${clamp(note.y)*Math.max(0,layer.clientHeight-element.offsetHeight)}px`;}
  function appearance(element,note){
    element.dataset.shape=shapes.includes(note.shape)?note.shape:'square';element.dataset.color=colors.includes(note.color)?note.color:'yellow';
    const width=Math.min(sizes[note.size]||210,layer.clientWidth||210);
    element.style.width=`${width}px`;element.style.height=`${Math.min(element.dataset.shape==='rectangle'?width*.72:width,layer.clientHeight||width)}px`;
    position(element,note);
  }
  function select(note){selected=note.id;shape.value=note.shape;size.value=note.size;color.value=note.color;layer.querySelectorAll('.sticky-note').forEach(el=>el.classList.toggle('selected',el.dataset.id===selected));}
  function render(){
    layer.replaceChildren();selected=null;
    notes().forEach(note=>{
      const element=document.createElement('article');element.className='sticky-note';element.dataset.id=note.id;
      const handle=document.createElement('button');handle.type='button';handle.className='sticky-note-handle';handle.textContent='⠿ Mover';handle.setAttribute('aria-label','Mover bloquinho: arraste ou use as setas do teclado');
      const remove=document.createElement('button');remove.type='button';remove.className='sticky-note-remove';remove.textContent='×';remove.setAttribute('aria-label','Excluir bloquinho');
      const text=document.createElement('textarea');text.className='sticky-note-text';text.placeholder='Sua anotação…';text.setAttribute('aria-label','Texto do bloquinho');text.value=note.text||'';
      element.append(handle,remove,text);layer.append(element);appearance(element,note);
      element.addEventListener('focusin',()=>select(note));element.addEventListener('pointerdown',()=>select(note));
      text.oninput=()=>{note.text=text.value;save();};
      remove.onclick=()=>{if(note.text&&!confirm('Excluir este bloquinho e sua anotação?'))return;page().stickyNotes=notes().filter(item=>item.id!==note.id);element.remove();if(selected===note.id)selected=null;save();};
      let drag=null;
      handle.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();handle.focus();select(note);drag={x:event.clientX,y:event.clientY,left:element.offsetLeft,top:element.offsetTop};handle.setPointerCapture(event.pointerId);};
      handle.onpointermove=event=>{if(!drag)return;note.x=clamp((drag.left+event.clientX-drag.x)/Math.max(1,layer.clientWidth-element.offsetWidth));note.y=clamp((drag.top+event.clientY-drag.y)/Math.max(1,layer.clientHeight-element.offsetHeight));position(element,note);};
      const finish=()=>{if(!drag)return;drag=null;save();};handle.onpointerup=finish;handle.onpointercancel=finish;handle.onlostpointercapture=finish;
      handle.onkeydown=event=>{const directions={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]},direction=directions[event.key];if(!direction)return;event.preventDefault();const step=event.shiftKey?20:5;note.x=clamp(clamp(note.x)+direction[0]*step/Math.max(1,layer.clientWidth-element.offsetWidth));note.y=clamp(clamp(note.y)+direction[1]*step/Math.max(1,layer.clientHeight-element.offsetHeight));position(element,note);save();};
    });
  }
  toolbar.querySelector('#addStickyNote').onclick=()=>{const note={id:crypto.randomUUID(),shape:shape.value,size:size.value,color:color.value,text:'',x:.3,y:.2};notes().push(note);render();select(note);layer.lastElementChild.querySelector('textarea').focus();save();};
  [shape,size,color].forEach(control=>control.onchange=()=>{const note=notes().find(item=>item.id===selected);if(!note)return;Object.assign(note,{shape:shape.value,size:size.value,color:color.value});const element=[...layer.children].find(el=>el.dataset.id===note.id);appearance(element,note);save();});
  const previousLoad=loadPage;loadPage=function(...args){previousLoad(...args);render();};
  new ResizeObserver(()=>{notes().forEach(note=>{const element=[...layer.children].find(el=>el.dataset.id===note.id);if(element)appearance(element,note);});}).observe(paper);
  render();
})();
