/* Classification uses evidence entered for a lesson, never the subject name. */
(function (root) {
  'use strict';
  const labels = {unknown:'Tipo não identificado', meet:'Meet ao vivo', recording:'Gravação', inperson:'Presencial', free:'Aula vaga'};
  function classify(lesson, date) {
    const override = lesson.dayOverride;
    if (override?.date === date && labels[override.type]) return {type:override.type, reason:'Confirmado por você para hoje'};
    if (lesson.lessonType && lesson.lessonType !== 'auto' && labels[lesson.lessonType]) return {type:lesson.lessonType, reason:'Informado por você'};
    const text = String(lesson.lessonEvidence || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    // Ambiguous notices and cancellations require confirmation.
    if (/\b(nao|cancelad[ao]|sem aula|aula vaga)\b/.test(text)) return {type:'unknown',reason:'Confirme o aviso e marque a situação de hoje'};
    const meet = /https?:\/\/meet\.google\.com\/[a-z0-9-]+\b/.test(text) || /\b(meet|ao vivo|sincrona)\b/.test(text);
    const recording = /\b(gravacao|gravada|gravado|assincrona)\b/.test(text) || /https?:\/\/[^\s]+\.(mp4|webm)(?:[?#\s]|$)/.test(text);
    if (meet && recording) return {type:'unknown',reason:'O aviso menciona Meet e gravação; escolha o tipo'};
    return meet ? {type:'meet',reason:'Indício no link ou aviso'} : recording ? {type:'recording',reason:'Indício no link ou aviso'} : {type:'unknown',reason:'Adicione um aviso ou confirme o tipo; um link de vídeo sozinho não confirma gravação'};
  }
  function minutes(value) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value || '')) return null;
    const [h,m] = value.split(':').map(Number); return h * 60 + m;
  }
  function current(schedule, now = new Date()) {
    const today = schedule.filter(item=>Number(item.day) === now.getDay());
    if (!today.length) return {message:'Nenhuma aula cadastrada para hoje. Confira se a grade está completa.'};
    const timed = today.map(item=>({item,start:minutes(item.time),end:minutes(item.endTime)}));
    const incomplete = timed.some(row=>row.start === null || row.end === null || row.end <= row.start);
    const valid = timed.filter(row=>row.start !== null && row.end !== null && row.end > row.start);
    const minute = now.getHours()*60 + now.getMinutes();
    const active = valid.filter(row=>row.start <= minute && minute < row.end);
    if (active.length > 1) return {message:'Há aulas com horários sobrepostos. Corrija a grade para confirmar sua situação.'};
    if (incomplete) return {message:'Ainda não consigo confirmar: preencha o início e o término de todas as aulas de hoje.'};
    if (active.length) return {lesson:active[0].item};
    return {message:minute < Math.min(...valid.map(row=>row.start)) || minute >= Math.max(...valid.map(row=>row.end)) ? 'Fora do horário das aulas cadastradas.' : 'Intervalo na grade: nenhuma aula cadastrada agora. Isso não confirma aula vaga.'};
  }
  function lessonChanges(existing, values) {
    const changes = {lessonType:values.type,lessonEvidence:values.evidence.trim(),dayOverride:values.override || null};
    // Type and notices can be saved even when an imported lesson has only an ordinal.
    if (values.start || values.end) {
      if (minutes(values.start) === null || minutes(values.end) === null || minutes(values.end) <= minutes(values.start)) {
        throw new Error('Preencha início e término juntos, com término depois do início. Para salvar apenas o tipo e o aviso, deixe os dois vazios.');
      }
      changes.time=values.start;changes.endTime=values.end;
    }
    return {...existing,...changes};
  }
  function shareLessonInformation(schedule, updated) {
    return schedule.map(lesson=>lesson.id===updated.id ? updated : updated.subjectId && lesson.subjectId===updated.subjectId ? {...lesson,lessonType:updated.lessonType,lessonEvidence:updated.lessonEvidence} : lesson);
  }
  const api = {classify,current,minutes,labels,lessonChanges,shareLessonInformation};
  root.lessonStatus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
  let editors = new Map();
  function updateStatus() {
    const box = document.querySelector('#currentLessonStatus'); if (!box) return;
    const result = current(schoolInfo.schedule || []);
    if (!result.lesson) { box.textContent = result.message; return; }
    const item = result.lesson, info = classify(item,localSchoolDate());
    const name = schoolInfo.subjects.find(subject=>subject.id === item.subjectId)?.name || 'Aula';
    box.textContent = `Agora: ${name} · ${labels[info.type]} (${item.time}–${item.endTime}). ${info.reason}.${info.type === 'recording' ? ' Aula gravada também é atividade; não é aula vaga.' : ''}`;
  }
  function enhance() {
    const mount = document.querySelector('#schoolScheduleMount .school-schedule-card'); if (!mount) return;
    editors = new Map();
    const status = document.createElement('p'); status.id = 'currentLessonStatus'; status.className = 'lesson-current-status'; status.setAttribute('role','status');
    mount.querySelector('.school-card-heading').after(status);
    mount.querySelectorAll('[data-delete-schedule]').forEach(button=>{
      const item = schoolInfo.schedule.find(entry=>entry.id === button.dataset.deleteSchedule); if (!item) return;
      const detail = document.createElement('details'); detail.className = 'lesson-detection';
      const summary = document.createElement('summary'); detail.append(summary);
      const refresh = ()=>{const current=schoolInfo.schedule.find(lesson=>lesson.id===item.id)||item;const info=classify(current,localSchoolDate());summary.textContent=`${labels[info.type]} · configurar`;}; refresh();
      function field(title, control) { const label=document.createElement('label');label.append(document.createTextNode(title),control);detail.append(label);return control; }
      const start=field('Início',document.createElement('input')),end=field('Término',document.createElement('input'));
      start.type=end.type='time';start.value=minutes(item.time)!==null?item.time:'';end.value=minutes(item.endTime)!==null?item.endTime:'';
      const type=field('Tipo habitual',document.createElement('select'));
      [['auto','Detectar pelo aviso/link'],...Object.entries(labels).filter(([key])=>key!=='unknown')].forEach(([value,text])=>type.add(new Option(text,value)));
      type.value=item.lessonType || 'auto';
      const evidence=field('Link ou aviso do professor',document.createElement('textarea'));evidence.maxLength=3000;evidence.value=item.lessonEvidence || '';evidence.placeholder='Cole o aviso que indica Meet ou aula gravada';
      const override=field('Somente hoje',document.createElement('select'));override.add(new Option('Usar tipo habitual',''));Object.entries(labels).forEach(([value,text])=>override.add(new Option(text,value)));override.value=item.dayOverride?.date===localSchoolDate()?item.dayOverride.type:'';
      const hint=document.createElement('p');hint.textContent='Ao salvar, o tipo habitual e o link ou aviso serão aplicados automaticamente a todas as aulas desta matéria na semana. Horários e “Somente hoje” são individuais.';detail.append(hint);
      const save=document.createElement('button');save.type='button';save.className='secondary-button';save.textContent='Salvar para esta matéria na semana';detail.append(save);
      const feedback=document.createElement('small');feedback.setAttribute('role','status');detail.append(feedback);
      editors.set(item.id,{type,evidence,refresh,feedback});
      save.onclick=()=>{
        const index=schoolInfo.schedule.findIndex(entry=>entry.id===item.id);
        if(index<0){feedback.textContent='Esta aula foi removida. Atualize a grade antes de salvar.';return;}
        const previous=schoolInfo.schedule[index];
        let updated;
        try { updated=lessonChanges(previous,{start:start.value,end:end.value,type:type.value,evidence:evidence.value,override:override.value?{date:localSchoolDate(),type:override.value}:null}); }
        catch(error){feedback.textContent=error.message;return;}
        const previousSchedule=schoolInfo.schedule;
        schoolInfo.schedule=shareLessonInformation(previousSchedule,updated);
        try { saveSchoolInfo(); }
        catch {schoolInfo.schedule=previousSchedule;feedback.textContent='Não foi possível salvar neste aparelho. Tente novamente.';return;}
        updateStatus();
        const name=schoolInfo.subjects.find(subject=>subject.id===updated.subjectId)?.name || 'Aula';
        const affected=schoolInfo.schedule.filter(lesson=>lesson.id===updated.id || (updated.subjectId && lesson.subjectId===updated.subjectId));
        affected.forEach(lesson=>{const editor=editors.get(lesson.id);if(!editor)return;editor.type.value=lesson.lessonType||'auto';editor.evidence.value=lesson.lessonEvidence||'';editor.refresh();editor.feedback.textContent=`✓ Tipo e aviso salvos nas ${affected.length} aula(s) de ${name} na semana.`;});
        button.parentElement.querySelector('strong').textContent=`${updated.time}${updated.endTime?'–'+updated.endTime:''} · ${name}`;
        if(typeof scheduleCloudSave==='function')scheduleCloudSave();
      };
      button.parentElement.append(detail);
    });
    updateStatus();
  }
  const original=renderSchoolSchedule;
  renderSchoolSchedule=function(){original();enhance();};
  renderSchoolSchedule();
  setInterval(updateStatus,15000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)updateStatus();});
})(typeof globalThis !== 'undefined' ? globalThis : this);
