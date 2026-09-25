(function () {
  'use strict';
  const editor=document.querySelector('#paperContent');
  const status=document.createElement('p');status.className='notebook-page-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  document.querySelector('#notebook').after(status);
  let composing=false,busy=false;
  const markerSelector='[data-page-caret]';
  function boundaries(root){
    const points=[];
    function visit(node){
      if(node.nodeType===Node.TEXT_NODE){let offset=0;for(const character of node.data){offset+=character.length;points.push([node,offset]);}}
      else if(node.nodeType===Node.ELEMENT_NODE){
        if(!node.childNodes.length || node.matches(markerSelector)){const parent=node.parentNode;points.push([parent,[...parent.childNodes].indexOf(node)+1]);}
        else node.childNodes.forEach(visit);
      }
    }
    root.childNodes.forEach(visit);return points;
  }
  function split(html){
    const source=document.createElement('div');source.innerHTML=html;
    const points=boundaries(source);
    function prefix(index){const range=document.createRange();range.selectNodeContents(source);range.setEnd(...points[index]);return range.cloneContents();}
    let low=0,high=points.length-1,best=-1;
    while(low<=high){const middle=Math.floor((low+high)/2);editor.replaceChildren(prefix(middle));if(editor.scrollHeight<=editor.clientHeight+1){best=middle;low=middle+1;}else high=middle-1;}
    if(best<0 || best===points.length-1){editor.innerHTML=html;return null;}
    // Prefer breaking at a word boundary, without discarding any text.
    const lower=Math.max(0,best-60);
    for(let i=best;i>=lower;i--){const [node,offset]=points[i];if(node.nodeType===Node.TEXT_NODE && /\s/.test(node.data[offset-1])){best=i;break;}}
    const range=document.createRange();range.selectNodeContents(source);range.setStart(...points[best]);
    const tail=document.createElement('div');tail.append(range.cloneContents());
    editor.replaceChildren(prefix(best));return {head:editor.innerHTML,tail:tail.innerHTML};
  }
  function paginate(){
    if(busy||composing||editor.clientHeight<1||editor.scrollHeight<=editor.clientHeight+1)return;
    busy=true;
    const notebook=activeNotebook(),index=currentPage,original=editor.innerHTML;
    saveCurrent();
    const previousPages=notebook.pages.slice();
    const previousContent=notebook.pages[index].content;
    const selection=window.getSelection();let hasCaret=false;
    if(selection?.rangeCount&&editor.contains(selection.focusNode)&&selection.isCollapsed){const marker=document.createElement('span');marker.dataset.pageCaret='true';const range=selection.getRangeAt(0).cloneRange();range.insertNode(marker);hasCaret=true;}
    try{
      const parts=[];let remaining=editor.innerHTML;
      while(true){editor.innerHTML=remaining;if(editor.scrollHeight<=editor.clientHeight+1){parts.push(remaining);break;}const result=split(remaining);if(!result){parts.push(remaining);break;}parts.push(result.head);remaining=result.tail;}
      let destination=0;
      const markedParts=parts.slice();
      parts.forEach((html,i)=>{const fragment=document.createElement('div');fragment.innerHTML=html;if(fragment.querySelector(markerSelector))destination=i;fragment.querySelectorAll(markerSelector).forEach(marker=>marker.remove());parts[i]=fragment.innerHTML;});
      notebook.pages[index].content=parts[0];
      const additions=parts.slice(1).map((content,i)=>({title:`Continuação ${index+i+2}`,content,stickers:[],stickyNotes:[],fontFamily:notebook.pages[index].fontFamily}));
      notebook.pages.splice(index+1,0,...additions);
      persistNotebooks();
      loadPage(index+destination,false);
      if(hasCaret){editor.innerHTML=markedParts[destination];const marker=editor.querySelector(markerSelector);if(marker){const range=document.createRange();range.setStartBefore(marker);range.collapse(true);marker.remove();editor.focus({preventScroll:true});selection.removeAllRanges();selection.addRange(range);}editor.scrollTop=0;}
      status.textContent=additions.length?`Folha preenchida. Texto continuado automaticamente em ${additions.length} nova(s) página(s).`:'Este conteúdo precisa de rolagem dentro da folha.';
    }catch(error){notebook.pages=previousPages;notebook.pages[index].content=previousContent;loadPage(index,false);editor.innerHTML=original;persistNotebooks();status.textContent='Texto preservado. Não foi possível dividir esta página agora.';}
    finally{editor.querySelectorAll(markerSelector).forEach(marker=>marker.remove());busy=false;}
  }
  editor.addEventListener('compositionstart',()=>{composing=true;});
  editor.addEventListener('compositionend',()=>{composing=false;paginate();});
  editor.addEventListener('input',event=>{if(!event.isComposing)paginate();});
  status.textContent='Folha com proporção de caderno universitário · O texto continua na próxima página ao preencher a folha.';
})();
