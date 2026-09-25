/* UI hydration is separate from cloud writes to avoid synchronization loops. */
(function(){
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key))??fallback;}catch{return fallback;}};
  window.addEventListener('cloud-data-applied',()=>{
    const received=read(schoolInfoStorage,null);
    if(received&&Array.isArray(received.subjects)&&Array.isArray(received.activities)){
      schoolInfo=received;renderSchoolInfo();renderTrimesterGrades();renderDailyAttendance();renderSchoolSchedule();renderAttendanceStats();
    }
    responseCards=read(responseCardsStorage,[]);studyPlan=read(studyPlanStorage,[]);platformProgress=read(platformProgressStorage,{});
    renderResponseCards();renderStudyPlan();
    focusSchedule=read(focusScheduleStorage,[]);renderFocusSchedule();
    applyFocusMode(localStorage.getItem(focusModeStorage)==='true');
    accessibilityPreferences={...accessibilityPreferences,...read(accessibilityStorage,{})};applyAccessibilityPreferences();
    renderCanvaConnection();renderAluraConnection();
    const context=read('caderno-digital-tutor-context',{});
    for(const [id,key] of [['tutorLevel','level'],['tutorCourse','course'],['tutorSubject','subject']]){const field=document.getElementById(id);if(field&&context[key]!==undefined)field.value=context[key];}
  });
  window.addEventListener('online',()=>{if(cloudUser&&cloudReady){scheduleCloudSave();setCloudStatus('Conexão restabelecida. Sincronizando alterações...');}});
  window.addEventListener('offline',()=>setCloudStatus('Sem internet. Alterações salvas neste aparelho; serão sincronizadas ao reconectar.'));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&cloudUser&&cloudReady)scheduleCloudSave();});
})();
