(() => {
  'use strict';
  const STORAGE = 'caderno-digital-study-tools';
  const TRASH = 'caderno-digital-notebook-trash';
  const HISTORY = 'caderno-digital-page-history';
  const THEMES = { claro:'Claro', escuro:'Escuro', lilas:'Lilás', azul:'Azul', verde:'Verde' };
  const TAGS = { '':'Sem etiqueta', importante:'Importante', revisar:'Revisar', prova:'Prova' };
  let toolsState = {theme:'claro',textSize:'medio',studySeconds:{},goals:[],notifications:false,pomodoroMinutes:25};
  let trash = [], history = [], studyStarted = 0, studySubject = '', studyTicker = 0;
  let pomodoroSeconds = 25 * 60, pomodoroTicker = 0, historyBefore = null;

  const read = (key, fallback) => { try { const value=JSON.parse(localStorage.getItem(key)); return value ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); if(typeof scheduleCloudSave==='function')scheduleCloudSave(); } catch {} };
  toolsState = {...toolsState, ...read(STORAGE,{})};
  trash = read(TRASH,[]); history = read(HISTORY,[]);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const saveTools = () => write(STORAGE,toolsState);
  const currentPageIndex = () => [...document.querySelectorAll('[data-page]')].findIndex(button=>button.classList.contains('active'));
  const activePage = () => activeNotebook()?.pages?.[Math.max(0,currentPageIndex())];
  const subjects = () => [...new Set([...(schoolInfo?.subjects||[]).map(s=>s.name), ...notebooks.map(n=>n.title)])].filter(Boolean);

  document.documentElement.dataset.studyTheme=toolsState.theme;
  document.documentElement.dataset.textSize=toolsState.textSize;
  notebooks.forEach(n=>{n.folder??='Sem pasta';n.tag??='';n.pages.forEach(p=>{p.favorite??=false;p.attachments??=[];});});
  persistNotebooks();

  const settingsMount=document.querySelector('#studySettingsMount');
  const hub=document.createElement('section');
  hub.className='study-hub';
  hub.innerHTML=`<div class="study-hub-title"><div><p class="eyebrow">CENTRAL DE ESTUDOS</p><h2>Minhas ferramentas</h2></div><button id="toggleStudyHub" class="secondary-button" aria-expanded="false">Abrir ferramentas</button></div>
    <div id="studyHubBody" class="study-hub-body hidden">
      <article class="study-tool"><h3>◐ Aparência</h3><label>Tema<select id="studyTheme">${Object.entries(THEMES).map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select></label></article>
      <article class="study-tool"><h3>↕ Tamanho do texto</h3><label>Tamanho<select id="studyTextSize"><option value="pequeno">Pequeno</option><option value="medio">Médio</option><option value="grande">Grande</option></select></label></article>
      <article class="study-tool"><h3>✓ Salvamento automático</h3><p>Seus dados são salvos automaticamente neste navegador.</p><strong class="settings-active-badge">Ativado</strong><small id="autoSaveStatus" role="status" aria-live="polite">Tudo salvo.</small></article>
      <article class="study-tool pomodoro-tool"><h3>◴ Pomodoro</h3><strong id="pomodoroClock" class="tool-clock">25:00</strong><div class="tool-row"><button id="pomodoroStart">Iniciar</button><button id="pomodoroReset" class="secondary-button">Reiniciar</button></div></article>
      <article class="study-tool study-time-tool"><h3>⌛ Tempo por matéria</h3><select id="studySubject"></select><strong id="studyClock" class="tool-clock">00:00:00</strong><button id="toggleStudyTimer">Começar a estudar</button><div id="studyTotals" class="tool-list"></div></article>
      <article class="study-tool"><h3>🔔 Lembretes</h3><p>Receba avisos de provas, trabalhos e compromissos cadastrados.</p><button id="enableStudyNotifications">Ativar lembretes</button><small id="notificationStatus"></small></article>
      <article class="study-tool"><h3>⇩ Dados do caderno</h3><p>Crie uma cópia de segurança ou restaure seus dados.</p><div class="tool-row"><button id="exportNotebookBackup">Exportar cópia</button><label class="secondary-button settings-file-button" for="importNotebookBackup">Importar cópia</label><input id="importNotebookBackup" type="file" accept="application/json,.json" hidden></div><small id="backupStatus" role="status" aria-live="polite"></small></article>
      <article class="study-tool danger-settings-tool"><h3>🗑 Limpar dados</h3><p>Apague todas as informações salvas neste navegador.</p><button id="clearNotebookData" class="secondary-button">Apagar dados</button><small id="clearDataStatus" role="status" aria-live="polite"></small></article>
      <article class="study-tool"><h3>ⓘ Sobre o aplicativo</h3><p><strong>Caderno Digital</strong></p><p>Organize seus estudos, materiais e atividades em um só lugar.</p><small>Versão 1.12 · Setembro de 2026</small></article>
    </div>`;
  settingsMount.append(hub);
  document.querySelectorAll('#caderno .study-hub').forEach(block=>settingsMount.append(block));
  const recordingHeading=document.querySelector('#gravacao .page-heading');
  const recordingActions=document.createElement('div');
  recordingActions.className='recording-heading-actions';
  recordingHeading.append(recordingActions);
  recordingActions.append(toggleTrash);
  toggleTrash.innerHTML='🗑 Abrir lixeira (<span id="trashCount">0</span>)';
  const undoRecordingButton=document.createElement('button');
  undoRecordingButton.id='undoRecordingDeletion';undoRecordingButton.className='secondary-button';undoRecordingButton.textContent='Desfazer gravações';recordingActions.append(undoRecordingButton);
  const recordingStatus=document.createElement('small');recordingStatus.id='recordingHistoryStatus';recordingStatus.setAttribute('role','status');recordingStatus.setAttribute('aria-live','polite');recordingHeading.after(recordingStatus);
  undoRecordingButton.onclick=()=>{if(!trashedRecordings.length){recordingStatus.textContent='Não há gravação apagada para recuperar.';return;}const restored=trashedRecordings.shift();recordings.unshift(restored);renderRecordings();renderTrash();recordingStatus.textContent=`“${restored.title}” foi recuperada.`;};

  const pageTools=document.createElement('div');
  pageTools.className='page-extra-tools';
  pageTools.innerHTML='<button id="favoritePage" class="secondary-button">☆ Favoritar página</button>';
  document.querySelector('#caderno .notebook-area').prepend(pageTools);
  const ocrExportTool=document.createElement('article');
  ocrExportTool.className='feature-card';
  ocrExportTool.innerHTML='<span class="feature-icon lavender">▣</span><h2>Ler foto</h2><p>Transforme o texto de uma foto em conteúdo para a página atual do caderno.</p><label class="upload-button" for="ocrPhoto">▣ Ler foto</label><input id="ocrPhoto" type="file" accept="image/*" capture="environment" hidden><p id="ocrExportStatus" class="small-status" role="status" aria-live="polite"></p>';
  document.querySelector('#exportar .export-grid').append(ocrExportTool);

  toggleStudyHub.onclick=()=>{const closed=studyHubBody.classList.toggle('hidden');toggleStudyHub.textContent=closed?'Abrir ferramentas':'Fechar ferramentas';toggleStudyHub.setAttribute('aria-expanded',String(!closed));if(!closed)refreshAll();};
  studyTheme.value=toolsState.theme;
  studyTheme.onchange=()=>{toolsState.theme=studyTheme.value;document.documentElement.dataset.studyTheme=toolsState.theme;saveTools();};
  studyTextSize.value=toolsState.textSize;
  studyTextSize.onchange=()=>{toolsState.textSize=studyTextSize.value;document.documentElement.dataset.textSize=toolsState.textSize;saveTools();showAutoSaveStatus();};

  function showAutoSaveStatus(){const status=document.querySelector('#autoSaveStatus');if(!status)return;status.textContent=`Salvo às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}.`;}
  let autoSaveStatusTimer=0;
  document.addEventListener('input',event=>{if(!event.target.closest('input, textarea, select, [contenteditable]'))return;clearTimeout(autoSaveStatusTimer);autoSaveStatus.textContent='Salvando…';autoSaveStatusTimer=setTimeout(showAutoSaveStatus,1000);});

  exportNotebookBackup.onclick=()=>{const data={};for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);data[key]=localStorage.getItem(key);}const backup={app:'Caderno Digital',version:1,exportedAt:new Date().toISOString(),data},blob=new Blob([JSON.stringify(backup,null,2)],{type:'application/json'}),link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download=`caderno-digital-backup-${new Date().toISOString().slice(0,10)}.json`;link.click();URL.revokeObjectURL(link.href);backupStatus.textContent='Cópia de segurança exportada.';};
  importNotebookBackup.onchange=async event=>{const file=event.target.files[0];if(!file)return;try{const backup=JSON.parse(await file.text());if(backup.app!=='Caderno Digital'||!backup.data||typeof backup.data!=='object')throw new Error('invalid');if(!confirm('Importar esta cópia substituirá os dados atuais. Deseja continuar?')){event.target.value='';return;}localStorage.clear();Object.entries(backup.data).forEach(([key,value])=>localStorage.setItem(key,String(value)));location.reload();}catch{backupStatus.textContent='Arquivo de cópia inválido. Escolha um backup do Caderno Digital.';}event.target.value='';};
  clearNotebookData.onclick=async()=>{if(!confirm('Apagar todos os dados do Caderno Digital neste navegador? Esta ação não pode ser desfeita.'))return;clearDataStatus.textContent='Apagando dados…';localStorage.clear();if(indexedDB?.deleteDatabase){indexedDB.deleteDatabase('caderno-digital-passeios');indexedDB.deleteDatabase('caderno-digital-offline-videos');}setTimeout(()=>location.reload(),300);};

  function decorateNotebooks(){document.querySelectorAll('.notebook-list-item').forEach((row,i)=>{row.querySelector('.notebook-meta')?.remove();const n=notebooks[i];if(!n)return;const meta=document.createElement('small');meta.className=`notebook-meta tag-${n.tag||'none'}`;meta.textContent=`${n.folder||'Sem pasta'}${n.tag?` · ${TAGS[n.tag]}`:''}`;row.querySelector('.notebook-name')?.after(meta);});}
  const oldRenderNotebooks=renderNotebooks;
  renderNotebooks=function(){oldRenderNotebooks();decorateNotebooks();};
  const oldRenderPages=renderPages;
  renderPages=function(){oldRenderPages();activeNotebook().pages.forEach((page,i)=>{const button=document.querySelector(`[data-page="${i}"]`);if(button&&page.favorite)button.textContent=`★ ${page.title}`;});renderPageExtras();};
  renderNotebooks();renderPages();

  favoritePage.onclick=()=>{const p=activePage();if(!p)return;p.favorite=!p.favorite;persistNotebooks();renderPages();};

  function renderPageExtras(){const p=activePage();if(!p)return;favoritePage.textContent=p.favorite?'★ Remover dos favoritos':'☆ Favoritar página';}

  function formatSeconds(total){total=Math.max(0,Math.floor(total));return `${String(Math.floor(total/3600)).padStart(2,'0')}:${String(Math.floor(total%3600/60)).padStart(2,'0')}:${String(total%60).padStart(2,'0')}`;}
  function refreshSubjects(){const names=subjects();studySubject.innerHTML=names.map(s=>`<option>${esc(s)}</option>`).join('')||'<option>Estudos</option>';}
  function renderStudy(){studyTotals.innerHTML=Object.entries(toolsState.studySeconds||{}).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([s,t])=>`<div><span>${esc(s)}</span><strong>${formatSeconds(t)}</strong></div>`).join('');}
  toggleStudyTimer.onclick=()=>{if(studyTicker){const elapsed=Math.floor((Date.now()-studyStarted)/1000);toolsState.studySeconds[studySubject] = (toolsState.studySeconds[studySubject]||0)+elapsed;clearInterval(studyTicker);studyTicker=0;studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject]);toggleStudyTimer.textContent='Começar a estudar';saveTools();renderStudy();return;}studySubject=studySubject.value;studyStarted=Date.now();toggleStudyTimer.textContent='Parar e salvar';studyTicker=setInterval(()=>studyClock.textContent=formatSeconds((toolsState.studySeconds[studySubject]||0)+(Date.now()-studyStarted)/1000),1000);};
  studySubject.onchange=()=>studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject.value]||0);

  function renderPomodoro(){pomodoroClock.textContent=`${String(Math.floor(pomodoroSeconds/60)).padStart(2,'0')}:${String(pomodoroSeconds%60).padStart(2,'0')}`;}
  pomodoroStart.onclick=()=>{if(pomodoroTicker){clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroStart.textContent='Continuar';return;}pomodoroStart.textContent='Pausar';pomodoroTicker=setInterval(()=>{pomodoroSeconds--;renderPomodoro();if(pomodoroSeconds<=0){clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroSeconds=5*60;pomodoroStart.textContent='Iniciar pausa';renderPomodoro();if(Notification.permission==='granted')new Notification('Pomodoro concluído',{body:'Hora de fazer uma pausa de 5 minutos.'});}},1000);};
  pomodoroReset.onclick=()=>{clearInterval(pomodoroTicker);pomodoroTicker=0;pomodoroSeconds=25*60;pomodoroStart.textContent='Iniciar';renderPomodoro();};

  function addTrash(type,item,parentTitle=''){trash.unshift({id:crypto.randomUUID(),type,item,parentTitle,deletedAt:Date.now()});trash=trash.slice(0,30);write(TRASH,trash);}
  deleteNotebook=function(index){if(notebooks.length===1)return;const notebook=notebooks[index];if(!confirm(`Mover o caderno “${notebook.title}” para a lixeira?`))return;saveCurrent();addTrash('notebook',structuredClone(notebook));notebooks.splice(index,1);if(index<currentNotebook)currentNotebook--;else if(currentNotebook>=notebooks.length)currentNotebook=notebooks.length-1;persistNotebooks();loadNotebook(Math.max(0,currentNotebook),false);};
  deletePage=function(index){const pages=activeNotebook().pages;if(pages.length===1)return;const page=pages[index];if(!confirm(`Mover ${page.title} para a lixeira?`))return;saveCurrent();addTrash('page',structuredClone(page),activeNotebook().title);pages.splice(index,1);pages.forEach((p,i)=>p.title=`Página ${i+1}`);persistNotebooks();loadPage(Math.min(index,pages.length-1),false);};

  paperContent.addEventListener('beforeinput',()=>{historyBefore={notebookId:activeNotebook().id,pageIndex:currentPageIndex(),content:paperContent.innerHTML,at:Date.now()};},{capture:true});
  paperContent.addEventListener('input',()=>{if(!historyBefore)return;clearTimeout(window.__pageHistoryTimer);window.__pageHistoryTimer=setTimeout(()=>{history.unshift(historyBefore);history=history.slice(0,40);write(HISTORY,history);historyBefore=null;},700);});

  enableStudyNotifications.onclick=async()=>{if(!('Notification'in window)){notificationStatus.textContent='Este navegador não oferece notificações.';return;}const permission=await Notification.requestPermission();toolsState.notifications=permission==='granted';saveTools();notificationStatus.textContent=permission==='granted'?'Lembretes ativados neste dispositivo.':'Permissão não concedida.';scheduleReminders();};
  function openAttendanceFromNotification(notification){notification.onclick=()=>{window.focus();document.querySelector('[data-tab="informativo"]')?.click();notification.close();};}
  function scheduleReminders(){if(!toolsState.notifications||Notification.permission!=='granted')return;const now=Date.now(),day=86400000;(schoolInfo.activities||[]).forEach(a=>{if(!a.date)return;const when=new Date(`${a.date}T08:00:00`).getTime()-day-now;if(when>0&&when<day)setTimeout(()=>new Notification(`Lembrete: ${a.title}`,{body:`A atividade é amanhã${a.subject?` · ${a.subject}`:''}.`}),when);});const date=localSchoolDate(),weekday=new Date().getDay(),answered=(schoolInfo.attendanceLog||[]).some(item=>item.date===date),reminderKey=`caderno-digital-attendance-reminder-${date}`;if(weekday>=1&&weekday<=5&&!answered&&!localStorage.getItem(reminderKey)){const notification=new Notification('Você foi à escola hoje?',{body:'Abra o Informativo Escolar e marque Sim ou Não.',tag:`frequencia-${date}`});localStorage.setItem(reminderKey,'shown');openAttendanceFromNotification(notification);}}

  ocrPhoto.onchange=async e=>{const file=e.target.files[0];if(!file)return;ocrExportStatus.textContent='Lendo a foto… isso pode levar um pouco.';try{await loadExternalScript('https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js');const result=await Tesseract.recognize(file,'por');const paragraphs=result.data.text.trim().split(/\n+/).filter(Boolean);paperContent.insertAdjacentHTML('beforeend',paragraphs.map(p=>`<p>${esc(p)}</p>`).join(''));saveCurrent();ocrExportStatus.textContent='Texto da foto adicionado à página atual do caderno.';}catch{ocrExportStatus.textContent='Não foi possível ler a foto. Verifique a internet e tente novamente.';}e.target.value='';};

  function refreshAll(){refreshSubjects();renderStudy();renderPageExtras();studyClock.textContent=formatSeconds(toolsState.studySeconds[studySubject.value]||0);notificationStatus.textContent=toolsState.notifications?'Lembretes ativados neste dispositivo.':'Ative para receber avisos.';}
  window.addEventListener('beforeunload',()=>{if(studyTicker)toggleStudyTimer.click();});
  window.addEventListener('load',()=>{
    const attendanceHeader=document.querySelector('.school-table thead th:nth-last-child(2)');
    if(attendanceHeader)attendanceHeader.textContent='Frequência (%)';
  });
  refreshAll();renderPomodoro();scheduleReminders();
})();
