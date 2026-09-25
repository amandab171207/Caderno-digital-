const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('notes preserve text, appearance and position independently on each page',()=>{
  const controls={};
  class Element {
    constructor(tag){this.tag=tag;this.children=[];this.style={};this.dataset={};this.classList={toggle(){}};this.clientWidth=600;this.clientHeight=800;this.value='';}
    setAttribute(){} addEventListener(){} focus(){} before(){} setPointerCapture(){}
    append(...children){children.forEach(child=>{child.parent=this;this.children.push(child);});}
    replaceChildren(){this.children=[];}
    remove(){this.parent.children=this.parent.children.filter(child=>child!==this);}
    get offsetWidth(){return parseFloat(this.style.width)||0;}get offsetHeight(){return parseFloat(this.style.height)||0;}
    get offsetLeft(){return parseFloat(this.style.left)||0;}get offsetTop(){return parseFloat(this.style.top)||0;}
    get lastElementChild(){return this.children.at(-1);}
    querySelector(selector){if(selector.startsWith('#'))return controls[selector]??=new Element('control');return this.children.find(child=>child.tag===selector);}
    querySelectorAll(){return this.children;}
  }
  const paper=new Element('paper'),notebook={pages:[{},{}]};let saved;
  const c={document:{createElement:tag=>new Element(tag),querySelector:()=>paper},activeNotebook:()=>notebook,currentPage:0,persistNotebooks:()=>{saved=JSON.parse(JSON.stringify(notebook));},crypto:require('node:crypto').webcrypto,ResizeObserver:class{observe(){}},confirm:()=>true};
  c.loadPage=i=>{c.currentPage=i;};vm.createContext(c);vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../sticky-notes.js'),'utf8'),c);
  controls['#stickyShape'].value='circle';controls['#stickySize'].value='large';controls['#stickyColor'].value='purple';
  controls['#addStickyNote'].onclick();const layer=paper.children[0],note=layer.lastElementChild,text=note.querySelector('textarea');
  text.value='Minha anotação';text.oninput();assert.equal(saved.pages[0].stickyNotes[0].text,'Minha anotação');
  const handle=note.children[0];handle.onpointerdown({button:0,preventDefault(){},clientX:0,clientY:0,pointerId:1});handle.onpointermove({clientX:9999,clientY:9999});handle.onpointerup();
  assert.equal(saved.pages[0].stickyNotes[0].x,1);assert.equal(saved.pages[0].stickyNotes[0].y,1);
  c.loadPage(1);assert.equal(layer.children.length,0);controls['#addStickyNote'].onclick();assert.equal(notebook.pages[1].stickyNotes.length,1);
  c.loadPage(0);assert.equal(layer.lastElementChild.querySelector('textarea').value,'Minha anotação');assert.equal(layer.lastElementChild.dataset.shape,'circle');assert.equal(layer.lastElementChild.dataset.color,'purple');
  layer.lastElementChild.children[1].onclick();assert.equal(saved.pages[0].stickyNotes.length,0);assert.equal(saved.pages[1].stickyNotes.length,1);
});
