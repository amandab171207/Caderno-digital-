(() => {
  'use strict';
  const STORAGE = 'caderno-digital-study-tools';
  const TRASH = 'caderno-digital-notebook-trash';
  const HISTORY = 'caderno-digital-page-history';
  const THEMES = { claro:'Claro', escuro:'Escuro', lilas:'Lilás', azul:'Azul', verde:'Verde' };
  const TAGS = { '':'Sem etiqueta', importante:'Importante', revisar:'Revisar', prova:'Prova' };
  let toolsState = {theme:'claro',studySeconds:{},goals:[],notifications:false,pomodoroMinutes:25};
  let trash = [], history = [], studyStarted = 0, studySubject = '', studyTicker = 0;
  let pomodoroSeconds = 25 * 60, pomodoroTicker = 0, historyBefore = null;

  const read = (key, fallback) => { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); if(typeof scheduleCloudSave==='function')scheduleCloudSave(); } catch {} };
  toolsState = {...toolsState, ...read(STORAGE,{})};
  trash = read(TRASH,[]); history = read(HISTORY,[]);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const textOf = html => { const node=document.createElement('div'); node.innerHTML=html||''; return node.textContent||''; };
  const saveTools = () => write(STORAGE,toolsState);
  const currentPageIndex = () => [...document.querySelectorAll('[data-page]')].findIndex(button=>button.classList.contains('active'));
  const activePage = () => activeNotebook()?.pages?.[Math.max(0,currentPageIndex())];
  const subjects = () => [...new Set([...(schoolInfo?.subjects||[]).map(s=>s.name), ...notebooks.map(n=>n.title)])].filter(Boolean);

  document.documentElement.dataset.studyTheme=toolsState.theme;
  notebooks.forEach(n=>{n.folder??='Sem pasta';n.tag??='';n.pages.forEach(p=>{p.favorite??=false;p.attachments??=[];});});
  persistNotebooks();

  const settingsMount=document.querySelector('#studySettingsMount');
  const hub=document.createElement('section');
  hub.className='study-hub';
  hub.innerHTML=`<div class="study-hub-title"><div><p class="eyebrow">CENTRAL DE ESTUDOS</p><h2>Minhas ferramentas</h2></div><button id="toggleStudyHub" class="secondary-button" aria-expanded="false">Abrir ferramentas</button></div>
    <div id="studyHubBody" class="study-hub-body hidden">
      <article class="study-tool search-tool"><h3>⌕ Buscar em tudo</h3><div class="tool-row"><input id="globalNotebookSearch" type="search" placeholder="Buscar nos cadernos e páginas"><button id="runNotebookSearch">Buscar</button></div><div id="globalSearchResults" class="tool-list"></div></article>
      <article class="study-tool"><h3>◐ Aparência</h3><label>Tema<select id="studyTheme">${Object.entries(THEMES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></article>
      <article class="study-tool"><h3>◴ Pomodoro</h3><strong id="pomodoroClock" class="tool-clock">25:00</strong><div class="tool-row"><button id="pomodoroStart">Iniciar</button><button id="pomodoroReset" class="secondary-button">Reiniciar</button></div></article>
      <article class="study-tool"><h3>⌛ Tempo por matéria</h3><select id="studySubject"></select><strong id="studyClock" class="tool-clock">00:00:00</strong><button id="toggleStudyTimer">Começar a estudar</button><div id="studyTotals" class="tool-list"></div></article>
      <article class="study-tool"><h3>🎯 Metas da semana</h3><div class="tool-row"><select id="goalSubject"></select><input id="goalTarget" type="number" min="1" max="50" value="5" aria-label="Quantidade da meta"><button id="addWeeklyGoal">Adicionar</button></div><div id="weeklyGoals" class="tool-list"></div></article>
      <article class="study-tool"><h3>🏷 Organizar caderno</h3><label>Pasta<input id="notebookFolder" maxlength="40" placeholder="Ex.: 2026 ou Curso técnico"></label><label>Etiqueta<select id="notebookTag">${Object.entries(TAGS).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label><button id="saveNotebookOrganization">Salvar organização</button></article>
      <article class="study-tool"><h3>🔔 Lembretes</h3><p>Avise antes dos trabalhos e provas cadastrados.</p><button id="enableStudyNotifications">Ativar lembretes</button><small id="notificationStatus"></small></article>
      <article class="study-tool"><h3>🛡 Segurança</h3><p>Proteja o caderno com um PIN neste dispositivo.</p><button id="manageNotebookPin">Configurar PIN</button></article>
      <article class="study-tool"><h3>🗑 Lixeira e histórico</h3><div class="tool-row"><button id="openNotebookTrash">Abrir lixeira</button><button id="undoPageChange" class="secondary-button">Desfazer escrita</button></div><div id="notebookTrashList" class="tool-list"></div></article>
    </div>`;
  settingsMount.append(hub);
  document.querySelectorAll('#caderno .study-hub').forEach(block=>settingsMount.append(block));

  const pageTools=document.createElement('div');
  pageTools.className='page-extra-tools';
  pageTools.innerHTML='<button id="favoritePage" class="secondary-button">☆ Favoritar página</button><label class="secondary-button attachment-button" for="pageAttachment">📎 Anexar arquivo</label><input id="pageAttachment" type="file" accept="image/*,.pdf,.doc,.docx" hidden><label class="secondary-button attachment-button" for="ocrPhoto">▣ Ler foto</label><input id="ocrPhoto" type="file" accept="image/*" capture="environment" hidden><span id="extraToolStatus" role="status"></span>';
  document.querySelector('#caderno .notebook-area').prepend(pageTools);
  const attachmentList=document.createElement('div');attachmentList.id='pageAttachments';attachmentList.className='page-attachments';document.querySelector('#paper').after(attachmentList);

  toggleStudyHub.onclick=()=>{const closed=studyHubBody.classList.toggle('hidden');toggleStudyHub.textContent=closed?'Abrir ferramentas':'Fechar ferramentas';toggleStudyHub.setAttribute('aria-expanded',String(!closed));if(!closed)refreshAll();};
  studyTheme.value=toolsState.theme;
  studyTheme.onchange=()=>{toolsState.theme=studyTheme.value;document.documentElement.dataset.studyTheme=toolsState.theme;saveTools();};

  function decorateNotebooks(){document.querySelectorAll('.notebook-list-item').forEach((row,i)=>{row.querySelector('.notebook-meta')?.remove();const n=notebooks[i];if(!n)return;const meta=document.createElement('small');meta.className=`notebook-meta tag-${n.tag||'none'}`;meta.textContent=`${n.folder||'Sem pasta'}${n.tag?` · ${TAGS[n.tag]}`:''}`;row.querySelector('.notebook-name')?.after(meta);});}
  const oldRenderNotebooks=renderNotebooks;
  renderNotebooks=function(){oldRenderNotebooks();decorateNotebooks();updateOrganizer();};
  const oldRenderPages=renderPages;
  renderPages=function(){oldRenderPages();activeNotebook().pages.forEach((page,i)=>{const button=document.querySelector(`[data-page="${i}"]`);if(button&&page.favorite)button.textContent=`★ ${page.title}`;});renderPageExtras();};
  renderNotebooks();renderPages();

  function updateOrganizer(){const n=activeNotebook();if(!n)return;notebookFolder.value=n.folder||'Sem pasta';notebookTag.value=n.tag||'';}
  saveNotebookOrganization.onclick=()=>{const n=activeNotebook();n.folder=notebookFolder.value.trim()||'Sem pasta';n.tag=notebookTag.value;persistNotebooks();renderNotebooks();extraToolStatus.textContent='Organização salva.';};
  favoritePage.onclick=()=>{const p=activePage();if(!p)return;p.favorite=!p.favorite;persistNotebooks();renderPages();};

  function renderPageExtras(){const p=activePage();if(!p)return;favoritePage.textContent=p.favorite?'★ Remover dos favoritos':'☆ Favoritar página';attachmentList.innerHTML=(p.attachments||[]).map((a,i)=>`<div><a href="${a.data}" download="${esc(a.name)}">${a.type.startsWith('image/')?'🖼':'📎'} ${esc(a.name)}</a><button data-remove-attachment="${i}" aria-label="Remover anexo">✕</button></div>`).join('');attachmentList.querySelectorAll('[data-remove-attachment]').forEach(b=>b.onclick=()=>{p.attachments.splice(+b.dataset.removeAttachment,1);persistNotebooks();renderPageExtras();});}
  pageAttachment.onchange=async e=>{const file=e.target.files[0];if(!file)return;if(file.size>2*1024*1024){extraToolStatus.textContent='Escolha um arquivo de até 2 MB.';return;}const data=await new Promise((ok,no)=>{const r=new FileReader();r.onload=()=>ok(r.result);r.onerror=no;r.readAsDataURL(file);});const p=activePage();p.attachments??=[];p.attachments.push({name:file.name,type:file.type||'application/octet-stream',data});persistNotebooks();renderPageExtras();extraToolStatus.textContent='Arquivo anexado.';e.target.value='';};

  function runSearch(){const q=globalNotebookSearch.value.trim().toLocaleLowerCase('pt-BR');if(!q){globalSearchResults.innerHTML='';return;}const results=[];notebooks.forEach((n,ni)=>n.pages.forEach((p,pi)=>{if(`${n.title} ${p.title} ${textOf(p.content)} ${n.folder} ${TAGS[n.tag]||''}`.toLocaleLowerCase('pt-BR').includes(q))results.push({ni,pi,label:`${n.title} — ${p.title}`});}));globalSearchResults.innerHTML=results.length?results.slice(0,30).map(r=>`<button data-search-notebook="${r.ni}" data-search-page="${r.pi}">▤ ${esc(r.label)}</button>`).join(''):'<p>Nenhum resultado encontrado.</p>';globalSearchResults.querySelectorAll('button').forEach(b=>b.onclick=()=>{loadNotebook(+b.dataset.searchNotebook);loadPage(+b.dataset.searchPage,false);globalSearchResults.innerHTML='';studyHubBody.classList.add('hidden');toggleStudyHub.textContent='Abrir ferramentas';});}
  runNotebookSearch.onclick=runSearch;globalNotebookSearch.onkeydown=e=>{if(e.key==='Enter')runSearch();};

  function formatSeconds(total){total=Math.max(0,Math.floor(total));return `${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
  function refreshSubjects(){const options=subjects().map(s=>`<option>${esc(s)}</option>`).join('')||'<option>Estudos</option>';studySubject.innerHTML=options;goalSubject.innerHTML=options;}
  function renderStudy(){studyTotals.innerHTML=Object.entries(toolsState.studySeconds||{}).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([s,t])=>`<div><span>${esc(s)}</span><strong>${formatSeconds(t)}</strong></div>`).join('');}
  toggleStudyTimer.onclick=()=>{if(studyTicker){const elapsed=Math.floor((Date.now()-studyStarted)/1000);toolsState.studySeconds[studySubject] = (toolsState.studySeconds[studySubject]||0)+elapsed;clearInterval(studyTicker);studyTicker=0;studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject]);toggleStudyTimer.textContent='Começar a estudar';saveTools();renderStudy();return;}studySubject=studySubject.value;studyStarted=Date.now();toggleStudyTimer.textContent='Parar e salvar';studyTicker=setInterval(()=>studyClock.textContent=formatSeconds((toolsState.studySeconds[studySubject]||0)+(Date.now()-studyStarted)/1000),1000);};
  studySubject.onchange=()=>studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject.value]||0);

  function renderPomodoro(){pomodoroClock.textContent=`${String(Math.floor(pomodoroSeconds/60)).padStart(2,'0')}:${String(pomodoroSeconds%60).padStart(2,'0')}`;}
  pomodoroStart.onclick=()=>{if(pomodoroTicker){clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroStart.textContent='Continuar';return;}pomodoroStart.textContent='Pausar';pomodoroTicker=setInterval(()=>{pomodoroSeconds--;renderPomodoro();if(pomodoroSeconds<=0){clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroSeconds=5*60;pomodoroStart.textContent='Iniciar pausa';renderPomodoro();if(Notification.permission==='granted')new Notification('Pomodoro concluído',{body:'Hora de fazer uma pausa de 5 minutos.'});}},1000);};
  pomodoroReset.onclick=()=>{clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroSeconds=25*60;pomodoroStart.textContent='Iniciar';renderPomodoro();};

  function weekKey(){const d=new Date(),first=new Date(d);first.setDate(d.getDate()-((d.getDay()+6)%7));return first.toISOString().slice(0,10);}
  function renderGoals(){const wk=weekKey();weeklyGoals.innerHTML=(toolsState.goals||[]).map(g=>{if(g.week!==wk)g.done=0;g.week=wk;return `<div><span>${esc(g.subject)}</span><strong>${g.done}/${g.target}</strong><button data-goal-plus="${g.id}" aria-label="Somar uma sessão">＋</button><button data-goal-delete="${g.id}" aria-label="Excluir meta">✕</button></div>`;}).join('')||'<p>Nenhuma meta criada.</p>';weeklyGoals.querySelectorAll('[data-goal-plus]').forEach(b=>b.onclick=()=>{const g=toolsState.goals.find(x=>x.id===b.dataset.goalPlus);g.done=Math.min(g.target,g.done+1);saveTools();renderGoals();});weeklyGoals.querySelectorAll('[data-goal-delete]').forEach(b=>b.onclick=()=>{toolsState.goals=toolsState.goals.filter(g=>g.id!==b.dataset.goalDelete);saveTools();renderGoals();});saveTools();}
  addWeeklyGoal.onclick=()=>{toolsState.goals.push({id:crypto.randomUUID(),subject:goalSubject.value,target:Math.max(1,+goalTarget.value||1),done:0,week:weekKey()});saveTools();renderGoals();};

  function addTrash(type,item,parentTitle=''){trash.unshift({id:crypto.randomUUID(),type,item,parentTitle,deletedAt:Date.now()});trash=trash.slice(0,30);write(TRASH,trash);}
  deleteNotebook=function(index){if(notebooks.length===1)return;const notebook=notebooks[index];if(!confirm(`Mover o caderno “${notebook.title}” para a lixeira?`))return;saveCurrent();addTrash('notebook',structuredClone(notebook));notebooks.splice(index,1);if(index<currentNotebook)currentNotebook--;else if(currentNotebook>=notebooks.length)currentNotebook=notebooks.length-1;persistNotebooks();loadNotebook(Math.max(0,currentNotebook),false);};
  deletePage=function(index){const pages=activeNotebook().pages;if(pages.length===1)return;const page=pages[index];if(!confirm(`Mover ${page.title} para a lixeira?`))return;saveCurrent();addTrash('page',structuredClone(page),activeNotebook().title);pages.splice(index,1);pages.forEach((p,i)=>p.title=`Página ${i+1}`);persistNotebooks();loadPage(Math.min(index,pages.length-1),false);};
  function renderNotebookTrash(){notebookTrashList.innerHTML=trash.length?trash.map(t=>`<div><span>${t.type==='notebook'?'📓':'▤'} ${esc(t.item.title)}</span><button data-restore-trash="${t.id}">Restaurar</button><button data-purge-trash="${t.id}" aria-label="Apagar para sempre">✕</button></div>`).join(''):'<p>A lixeira está vazia.</p>';notebookTrashList.querySelectorAll('[data-restore-trash]').forEach(b=>b.onclick=()=>{const i=trash.findIndex(t=>t.id===b.dataset.restoreTrash),t=trash[i];if(t.type==='notebook')notebooks.push(t.item);else activeNotebook().pages.push(t.item);trash.splice(i,1);write(TRASH,trash);persistNotebooks();renderNotebooks();renderPages();renderNotebookTrash();});notebookTrashList.querySelectorAll('[data-purge-trash]').forEach(b=>b.onclick=()=>{trash=trash.filter(t=>t.id!==b.dataset.purgeTrash);write(TRASH,trash);renderNotebookTrash();});}
  openNotebookTrash.onclick=renderNotebookTrash;

  paperContent.addEventListener('beforeinput',()=>{historyBefore={notebookId:activeNotebook().id,pageIndex:currentPageIndex(),content:paperContent.innerHTML,at:Date.now()};},{capture:true});
  paperContent.addEventListener('input',()=>{if(!historyBefore)return;clearTimeout(window.__pageHistoryTimer);window.__pageHistoryTimer=setTimeout(()=>{history.unshift(historyBefore);history=history.slice(0,40);write(HISTORY,history);historyBefore=null;},700);});
  undoPageChange.onclick=()=>{const n=activeNotebook(),i=history.findIndex(h=>h.notebookId===n.id&&h.pageIndex===currentPageIndex());if(i<0){extraToolStatus.textContent='Não há alteração para desfazer nesta página.';return;}paperContent.innerHTML=history[i].content;history.splice(i,1);write(HISTORY,history);saveCurrent();extraToolStatus.textContent='Última alteração desfeita.';};

  enableStudyNotifications.onclick=async()=>{if(!('Notification'in window)){notificationStatus.textContent='Este navegador não oferece notificações.';return;}const permission=await Notification.requestPermission();toolsState.notifications=permission==='granted';saveTools();notificationStatus.textContent=permission==='granted'?'Lembretes ativados neste dispositivo.':'Permissão não concedida.';scheduleReminders();};
  function scheduleReminders(){if(!toolsState.notifications||Notification.permission!=='granted')return;const now=Date.now(),day=86400000;(schoolInfo.activities||[]).forEach(a=>{if(!a.date)return;const when=new Date(`${a.date}T08:00:00`).getTime()-day-now;if(when>0&&when<day)setTimeout(()=>new Notification(`Lembrete: ${a.title}`,{body:`A atividade é amanhã${a.subject?` · ${a.subject}`:''}.`}),when);});}

  async function digestPin(value){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join('');}
  manageNotebookPin.onclick=async()=>{const existing=localStorage.getItem('caderno-digital-pin-hash');if(existing){const old=prompt('Digite o PIN atual para alterar ou remover:');if(!old||await digestPin(old)!==existing){extraToolStatus.textContent='PIN incorreto.';return;}if(confirm('Deseja remover o PIN?')){localStorage.removeItem('caderno-digital-pin-hash');extraToolStatus.textContent='PIN removido.';return;}}const pin=prompt('Crie um PIN de 4 a 8 números:');if(!/^\d{4,8}$/.test(pin||'')){extraToolStatus.textContent='Use de 4 a 8 números.';return;}localStorage.setItem('caderno-digital-pin-hash',await digestPin(pin));extraToolStatus.textContent='PIN configurado.';};
  async function lockIfNeeded(){const hash=localStorage.getItem('caderno-digital-pin-hash');if(!hash)return;const overlay=document.createElement('div');overlay.className='pin-lock';overlay.innerHTML='<form><div>🔒</div><h2>Caderno protegido</h2><p>Digite seu PIN para continuar.</p><input inputmode="numeric" type="password" maxlength="8" autofocus><button>Desbloquear</button><small></small></form>';document.body.append(overlay);overlay.querySelector('form').onsubmit=async e=>{e.preventDefault();if(await digestPin(overlay.querySelector('input').value)===hash)overlay.remove();else overlay.querySelector('small').textContent='PIN incorreto.';};}

  ocrPhoto.onchange=async e=>{const file=e.target.files[0];if(!file)return;extraToolStatus.textContent='Lendo a foto… isso pode levar um pouco.';try{await loadExternalScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');const result=await Tesseract.recognize(file,'por');const paragraphs=result.data.text.trim().split(/\n+/).filter(Boolean);paperContent.insertAdjacentHTML('beforeend',paragraphs.map(p=>`<p>${esc(p)}</p>`).join(''));saveCurrent();extraToolStatus.textContent='Texto da foto adicionado à página.';}catch{extraToolStatus.textContent='Não foi possível ler a foto. Verifique a internet e tente novamente.';}e.target.value='';};

  function refreshAll(){refreshSubjects();renderStudy();renderGoals();renderNotebookTrash();updateOrganizer();renderPageExtras();studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject.value]||0);notificationStatus.textContent=toolsState.notifications?'Lembretes ativados neste dispositivo.':'Ative para receber avisos.';}
  window.addEventListener('beforeunload',()=>{if(studyTicker)toggleStudyTimer.click();});
  refreshAll();renderPomodoro();scheduleReminders();lockIfNeeded();
})();
