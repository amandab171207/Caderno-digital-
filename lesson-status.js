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
  const api = {classify,current,minutes,labels};
  root.lessonStatus = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;
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
    const status = document.createElement('p'); status.id = 'currentLessonStatus'; status.className = 'lesson-current-status'; status.setAttribute('role','status');
    mount.querySelector('.school-card-heading').after(status);
    mount.querySelectorAll('[data-delete-schedule]').forEach(button=>{
      const item = schoolInfo.schedule.find(entry=>entry.id === button.dataset.deleteSchedule); if (!item) return;
      const detail = document.createElement('details'); detail.className = 'lesson-detection';
      const summary = document.createElement('summary'); detail.append(summary);
      const refresh = ()=>{const info=classify(item,localSchoolDate());summary.textContent=`${labels[info.type]} · configurar`;}; refresh();
      function field(title, control) { const label=document.createElement('label');label.append(document.createTextNode(title),control);detail.append(label);return control; }
      const start=field('Início',document.createElement('input')),end=field('Término',document.createElement('input'));
      start.type=end.type='time';start.value=minutes(item.time)!==null?item.time:'';end.value=minutes(item.endTime)!==null?item.endTime:'';
      const type=field('Tipo habitual',document.createElement('select'));
      [['auto','Detectar pelo aviso/link'],...Object.entries(labels).filter(([key])=>key!=='unknown')].forEach(([value,text])=>type.add(new Option(text,value)));
      type.value=item.lessonType || 'auto';
      const evidence=field('Link ou aviso do professor',document.createElement('textarea'));evidence.maxLength=3000;evidence.value=item.lessonEvidence || '';evidence.placeholder='Cole o aviso que indica Meet ou aula gravada';
      const override=field('Somente hoje',document.createElement('select'));override.add(new Option('Usar tipo habitual',''));Object.entries(labels).forEach(([value,text])=>override.add(new Option(text,value)));override.value=item.dayOverride?.date===localSchoolDate()?item.dayOverride.type:'';
      const save=document.createElement('button');save.type='button';save.className='secondary-button';save.textContent='Salvar informações';detail.append(save);
      const feedback=document.createElement('small');feedback.setAttribute('role','status');detail.append(feedback);
      save.onclick=()=>{
        if(minutes(start.value)===null || minutes(end.value)===null || minutes(end.value)<=minutes(start.value)){feedback.textContent='Informe início e término válidos, com término depois do início.';return;}
        Object.assign(item,{time:start.value,endTime:end.value,lessonType:type.value,lessonEvidence:evidence.value.trim(),dayOverride:override.value?{date:localSchoolDate(),type:override.value}:null});
        saveSchoolInfo();renderSchoolSchedule();
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
