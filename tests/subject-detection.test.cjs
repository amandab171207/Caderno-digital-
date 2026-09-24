const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../subject-detection.js'),'utf8');
function environment(userAgent='Chrome/140.0.0.0'){
  const instances=[],timers=new Map();let timerId=0;
  class Recognition{
    constructor(){instances.push(this);}
    start(track){this.track=track;}
    abort(){this.aborted=true;}
    emit(text){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:true})]});}
  }
  const context=vm.createContext({window:{SpeechRecognition:Recognition},navigator:{userAgent},setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);}});
  vm.runInContext(source,context);
  return {context,instances,timers};
}
test('recognizes topic evidence and explicit school subject names',()=>{
  const {context:c}=environment();
  for(const [text,subject] of [
    ['Vamos resolver uma equação, simplificar a fração e estudar polinômio.','Matemática'],
    ['SQL usa SELECT e uma chave primária.','Banco de Dados'],
    ['Hoje nossa aula de Programação Mobile começa.','Programação Mobile'],
    ['Aula de Robótica','Robótica']
  ])assert.equal(c.inferRecordingSubject(text,[subject]).name,subject);
});
test('avoids guessing on silence, weak, ambiguous or partial-word evidence',()=>{
  const {context:c}=environment();
  for(const text of ['', 'Bom dia pessoal', 'Temos uma equação', 'equação fração polinômio átomo molécula mol', 'moldura molecular'])
    assert.equal(c.inferRecordingSubject(text,['Matemática','Química']),null);
});
test('uses the supplied Meet track and stops after identification',()=>{
  const {context:c,instances,timers}=environment();const track={kind:'audio',readyState:'live'};let subject;
  c.createRecordingSubjectDetector({track,names:['Matemática'],onSubject:value=>subject=value,onStatus(){}});
  assert.equal(instances[0].track,track);
  instances[0].emit('equação fração polinômio');
  assert.equal(subject,'Matemática');assert.equal(instances[0].aborted,true);assert.equal(timers.size,0);
});
test('manual stop ignores late results and cancels retries',()=>{
  const {context:c,instances,timers}=environment();let calls=0;
  const detector=c.createRecordingSubjectDetector({track:{kind:'audio',readyState:'live'},names:['Matemática'],onSubject(){calls++;},onStatus(){}});
  instances[0].onend();detector.stop();instances[0].emit('aula de matemática');
  assert.equal(calls,0);assert.equal(timers.size,0);
});
test('unsupported browsers never fall back to recording the microphone',()=>{
  for(const ua of ['Chrome/134.0','Version/18.0 Safari/605.1','Android Chrome/140.0']){
    const {context:c,instances}=environment(ua);let status;
    c.createRecordingSubjectDetector({track:{kind:'audio',readyState:'live'},names:[],onSubject(){},onStatus:value=>status=value});
    assert.equal(instances.length,0);assert.match(status,/indisponível/);
  }
});
test('permission failure stops recognition without stopping the audio track',()=>{
  const {context:c,instances,timers}=environment();const track={kind:'audio',readyState:'live'};let status;
  c.createRecordingSubjectDetector({track,names:[],onSubject(){},onStatus:value=>status=value});
  instances[0].onerror({error:'not-allowed'});
  assert.match(status,/gravação continua/);assert.equal(track.readyState,'live');assert.equal(timers.size,0);
});
test('timeout reports that manual selection is needed',()=>{
  const {context:c,timers,instances}=environment();let status;
  c.createRecordingSubjectDetector({track:{kind:'audio',readyState:'live'},names:[],onSubject(){},onStatus:value=>status=value});
  [...timers.values()][0]();assert.match(status,/informação suficiente/);assert.equal(instances[0].aborted,true);
});
