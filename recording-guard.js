(function () {
  'use strict';
  let confirmedLesson = '', previousKey = '';
  const box = document.createElement('div');
  box.className = 'lesson-current-status';
  box.innerHTML = '<label><input id="teacherExplaining" type="checkbox"> A professora está explicando</label><p>Ative durante a explicação e desative quando ela parar. O caderno não identifica sozinho quem está falando ou se é uma explicação. A confirmação vale apenas para a aula atual.</p><small id="recordingGuardStatus" role="status"></small>';
  document.querySelector('.record-controls').before(box);
  const control = box.querySelector('input'), status = box.querySelector('small');
  function state() {
    const lesson = window.lessonStatus.current(schoolInfo.schedule || []).lesson;
    const key = lesson ? `${localSchoolDate()}/${lesson.id}` : '';
    const type = lesson ? window.lessonStatus.classify(lesson,localSchoolDate()).type : 'unknown';
    return {lesson,key,type};
  }
  window.recordingPermission = function () {
    const {lesson,key,type} = state();
    if (!lesson) return {allowed:false,reason:'Gravação bloqueada: não há uma aula atual com horários confirmados.'};
    if (type === 'free') return {allowed:false,reason:'Aula vaga: não será gravada.'};
    if (type === 'unknown') return {allowed:false,reason:'Confirme o tipo da aula em Minha semana antes de gravar.'};
    if (!control.checked || confirmedLesson !== key) return {allowed:false,reason:'Sem explicação confirmada: gravação desligada.'};
    return {allowed:true,reason:'Explicação confirmada para esta aula.'};
  };
  function enforce() {
    const {key,type} = state();
    if (key !== previousKey || type === 'free' || type === 'unknown') {
      control.checked = false; confirmedLesson = ''; previousKey = key;
    }
    control.disabled = !key || type === 'free' || type === 'unknown';
    const permission = window.recordingPermission(); status.textContent = permission.reason;
    if (!permission.allowed) {
      if (recorder && recorder.state !== 'inactive') {
        stopLiveCaptions(); recorder.stop(); recorder.stream.getTracks().forEach(track=>track.stop());
      }
      automaticRecordingSession = null;
      lastAutomaticAttempt = null;
    }
  }
  control.onchange = ()=>{confirmedLesson=control.checked?state().key:'';enforce();if(control.checked)runAutomaticRecording();};
  const render = renderSchoolSchedule;
  renderSchoolSchedule = function () { render(); enforce(); };
  setInterval(enforce,1000);
  document.addEventListener('visibilitychange',enforce);
  enforce();
})();
