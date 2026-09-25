const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,channel:'msedge'});
  try{
    const page=await browser.newPage({viewport:{width:1000,height:1000}});
    await page.setContent('<div id="notebook" style="width:600px"><div id="paper" style="position:relative"><div id="paperContent" contenteditable="true"></div></div></div>');
    await page.addStyleTag({path:path.join(__dirname,'../notebook-pages.css')});
    await page.evaluate(()=>{
      window.currentPage=0;window.book={pages:[{title:'Primeira',content:'',stickers:[{emoji:'⭐'}],stickyNotes:[{text:'Fica aqui'}],drawing:'preservar'},{title:'Existente',content:'Não sobrescrever'}]};
      window.activeNotebook=()=>book;window.persistNotebooks=()=>{window.saved=JSON.parse(JSON.stringify(book));};
      window.saveCurrent=()=>{book.pages[currentPage].content=document.querySelector('#paperContent').innerHTML;persistNotebooks();};
      window.loadPage=(i)=>{window.currentPage=i;document.querySelector('#paperContent').innerHTML=book.pages[i].content;};
    });
    await page.addScriptTag({path:path.join(__dirname,'../notebook-pages.js')});
    const result=await page.evaluate(()=>{
      const editor=document.querySelector('#paperContent');editor.innerHTML='<p><strong>'+('Texto com acentuação e emoji 🌷. '.repeat(200))+'</strong></p>';
      const original=editor.textContent;editor.focus();const range=document.createRange();range.selectNodeContents(editor);range.collapse(false);getSelection().removeAllRanges();getSelection().addRange(range);
      editor.dispatchEvent(new InputEvent('input',{bubbles:true}));
      const text=book.pages.slice(0,-1).map(item=>{const div=document.createElement('div');div.innerHTML=item.content;return div.textContent;}).join('');
      return {original,text,count:book.pages.length,current:currentPage,last:book.pages.at(-1),first:book.pages[0],fits:editor.scrollHeight<=editor.clientHeight+1,ratio:document.querySelector('#paper').clientWidth/document.querySelector('#paper').clientHeight,markers:JSON.stringify(saved).includes('data-page-caret'),format:book.pages.slice(0,-1).every(item=>item.content.includes('<strong>'))};
    });
    assert.equal(result.text,result.original);assert(result.count>3);assert.equal(result.current,result.count-2);assert.equal(result.last.content,'Não sobrescrever');assert.equal(result.first.drawing,'preservar');assert.equal(result.first.stickyNotes[0].text,'Fica aqui');assert(result.fits);assert(Math.abs(result.ratio-200/275)<.002);assert.equal(result.markers,false);assert(result.format);
    await page.setViewportSize({width:390,height:800});
    console.log('Paginação verificada: texto integral, emojis, formatação, cursor, proporção, páginas existentes e anotações preservados.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
