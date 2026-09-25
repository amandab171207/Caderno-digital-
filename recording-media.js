function recordingMimeCandidates(video){return video?['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm','video/mp4']:['audio/webm;codecs=opus','audio/webm','audio/mp4'];}
function recordingFileExtension(item){const type=item.mimeType||item.blob?.type||'';if(type.includes('mp4'))return type.startsWith('video/')?'mp4':'m4a';if(type.includes('mpeg'))return 'mp3';if(type.includes('ogg'))return 'ogg';if(type.includes('wav'))return 'wav';return 'webm';}
function recordingIsVideo(item){return (item.mimeType||item.blob?.type||'').startsWith('video/');}
function lessonForRecording(schedule,subjects,selectedId,now=new Date()){
  const candidates=(schedule||[]).filter(lesson=>subjects.some(subject=>subject.id===lesson.subjectId));
  if(selectedId&&selectedId!=='auto')return candidates.find(lesson=>lesson.id===selectedId)||null;
  const minute=now.getHours()*60+now.getMinutes();
  const toMinutes=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
  const current=candidates.filter(lesson=>{const start=toMinutes(lesson.time),end=toMinutes(lesson.endTime);return Number(lesson.day)===now.getDay()&&start!==null&&end!==null&&start<end&&minute>=start&&minute<end;});
  return current.length===1?current[0]:null;
}
