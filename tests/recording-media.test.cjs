const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');
const helper=fs.readFileSync(path.join(__dirname,'../recording-media.js'),'utf8');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
test('lesson linking uses actual clock ranges and avoids overlapping or ordinal guesses',()=>{
  const c=vm.createContext({});vm.runInContext(helper,c);const subjects=[{id:'math',name:'Matemática'}];const lessons=[{id:'a',day:1,time:'08:00',endTime:'09:00',subjectId:'math'}];
  const at=minute=>new Date(2026,8,21,8,minute);
  assert.equal(c.lessonForRecording(lessons,subjects,'auto',at(30)).id,'a');
  assert.equal(c.lessonForRecording(lessons,subjects,'auto',at(60)),null);
  assert.equal(c.lessonForRecording([...lessons,{...lessons[0],id:'b'}],subjects,'auto',at(30)),null);
  assert.equal(c.lessonForRecording([{...lessons[0],time:'1ª aula'}],subjects,'auto',at(30)),null);
  assert.equal(c.lessonForRecording(lessons,subjects,'a',at(60)).id,'a');
});
test('media download extensions distinguish audio and video MP4',()=>{
  const c=vm.createContext({});vm.runInContext(helper,c);
  assert.equal(c.recordingFileExtension({mimeType:'video/mp4'}),'mp4');assert.equal(c.recordingFileExtension({mimeType:'audio/mp4'}),'m4a');assert.equal(c.recordingFileExtension({blob:{type:'audio/mpeg'}}),'mp3');assert.equal(c.recordingIsVideo({blob:{type:'video/webm'}}),true);
});
for(const mode of ['microphone','meet'])for(const includeMic of [false,true])test(`record handler preserves ${mode} tracks, microphone=${includeMic}, lesson and file metadata`,async()=>{
  const elements={},tracks=[];const $=id=>elements[id]??={value:id==='#recordSource'?mode:id==='#recordLessonSelect'?'lesson':'Matemática',checked:id==='#includeMeetMicrophone'&&includeMic,disabled:false,textContent:'',classList:{add(){},remove(){}},setAttribute(){}};
  const track=kind=>{const t={kind,readyState:'live',stop(){this.readyState='ended';},addEventListener(){}};tracks.push(t);return t;};
  class Stream{constructor(ts){this.ts=ts;}getTracks(){return this.ts;}getAudioTracks(){return this.ts.filter(t=>t.kind==='audio');}getVideoTracks(){return this.ts.filter(t=>t.kind==='video');}}
  let recorded,recognitionCalls=0,closed=false;
  class Recorder{static isTypeSupported(){return true;}constructor(input,options){recorded=input;this.mimeType=options.mimeType;this.state='inactive';}start(){this.state='recording';}stop(){this.state='inactive';this.ondataavailable({data:new Blob(['test'])});this.onstop();}}
  class AudioContext{resume(){return Promise.resolve();}close(){closed=true;return Promise.resolve();}createMediaStreamDestination(){return {stream:new Stream([track('audio')])};}createMediaStreamSource(){return {connect(){}};}}
  const c=vm.createContext({$, $$:()=>[],recordingBusy:false,recorder:null,recordTimer:null,recordings:[],subjectDetector:null,recordingSubjectOverride:null,deleteSubjectButton:{},schoolInfo:{subjects:[{id:'math',name:'Matemática'}],schedule:[{id:'lesson',day:1,time:'1ª aula',subjectId:'math'}]},selectRecordingSubject(){},setRecordingControls(){},window:{MediaRecorder:Recorder,recordingPermission:()=>({allowed:true})},navigator:{mediaDevices:{getDisplayMedia:async()=>new Stream([track('audio'),track('video')]),getUserMedia:async()=>new Stream([track('audio')])}},MediaRecorder:Recorder,MediaStream:Stream,AudioContext,Blob,URL:{createObjectURL:()=> 'blob:test'},crypto:require('crypto').webcrypto,liveCaptionText:'',stopLiveCaptions(){},startLiveCaptions(){},renderRecordings(){},recordingSubjectNames:()=>[],ensureRecordingSubjectOption(){},createRecordingSubjectDetector(){recognitionCalls++;},updateDeleteSubjectButton(){},setInterval:()=>1,clearInterval(){},formatTime:()=>''});
  vm.runInContext(helper,c);vm.runInContext(app.slice(app.indexOf('function setRecordingControls(busy)'),app.indexOf("window.addEventListener('beforeunload'",app.indexOf("$('#recordButton').onclick=async()=>"))),c);
  c.window.recordingPermission=()=>({allowed:false,reason:'Aula vaga'});
  await $('#recordButton').onclick();assert.equal(c.recorder,null);assert.equal(tracks.length,0);
  c.window.recordingPermission=()=>({allowed:true});
  await $('#recordButton').onclick();assert.equal(c.recorder.state,'recording');assert.equal(recorded.getVideoTracks().length,mode==='meet'?1:0);assert.equal(recorded.getAudioTracks().length,1);
  await $('#recordButton').onclick();assert.equal(c.recordings.length,1);assert.equal(c.recordings[0].lessonId,'lesson');assert.equal(c.recordings[0].subject,'Matemática');assert.equal(c.recordings[0].source,mode);assert.equal(c.recordings[0].mimeType.startsWith('video/'),mode==='meet');assert.equal(recognitionCalls,0);assert(tracks.every(t=>t.readyState==='ended'));if(mode==='meet'&&includeMic)assert(closed);
});
