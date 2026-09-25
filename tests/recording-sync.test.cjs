const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../recording-sync.js'),'utf8');
function setup({user={uid:'owner'},remote={},local=[],failUpload=false}={}){
  const timers=new Map(),listeners={};let timerId=0;const nodes={},uploads=[],downloads=[],metadata=[];const $=id=>nodes[id]??={value:'Matemática',append(){},textContent:'',disabled:false};
  const storage={ref(objectPath){return {async put(blob){if(failUpload)throw {code:'storage/unauthorized'};uploads.push({objectPath,blob});},async getDownloadURL(){downloads.push(objectPath);return 'https://example.test/recording';}};}};
  const firebase={storage:()=>storage};
  const c=vm.createContext({$,document:{createElement:()=>({}),visibilityState:'visible',addEventListener:(name,fn)=>listeners[name]=fn},window:{firebase,addEventListener:(name,fn)=>listeners[name]=fn},firebase,navigator:{onLine:true},cloudAuth:null,cloudReady:true,cloudUser:user,cloudDb:{collection:()=>({doc:()=>({get:async()=>({data:()=>({recordingFiles:remote})}),set:async value=>{metadata.push(value);Object.assign(remote,value.recordingFiles);},onSnapshot:()=>()=>{}})})},recordings:local,trashedRecordings:[],recordingsStorageReady:true,recordingsSaveTimer:0,setTimeout(fn){timers.set(++timerId,fn);return timerId;},clearTimeout(id){timers.delete(id);},saveRecordingsInBrowser:async()=>{},renderRecordings(){},ensureRecordingSubjectOption(){},recordingKind:item=>item.source||'microphone',URL:{createObjectURL:()=> 'blob:received'},fetch:async()=>({ok:true,blob:async()=>new Blob(['remote'],{type:'audio/webm'})}),Blob});
  vm.runInContext(source,c);return {c,$,uploads,downloads,metadata,timers,listeners,async tick(){const [id,fn]=timers.entries().next().value||[];if(fn){timers.delete(id);await fn();}}};
}
test('cloud synchronization requires sign-in and never uploads while signed out',async()=>{
  const {$,uploads}=setup({user:null});await $('#syncRecordingFiles').onclick();assert.equal(uploads.length,0);assert.match($('#recordingTransferStatus').textContent,/Entre com Google/);
});
test('sync sends binary to owner path and downloads missing recordings without duplicating IDs',async()=>{
  const local={id:'local',title:'Aula',subject:'Matemática',blob:new Blob(['local'],{type:'audio/webm'})};
  const remote={remote:{id:'remote',title:'Do celular',subject:'Português',objectPath:'users/owner/recordings/remote'},bad:{id:'bad',objectPath:'users/someone-else/recordings/bad'}};
  const {c,$,uploads,downloads,metadata}=setup({local:[local],remote});await $('#syncRecordingFiles').onclick();
  assert.equal(uploads.length,1);assert.equal(uploads[0].objectPath,'users/owner/recordings/local');assert.equal(downloads.length,1);assert.equal(c.recordings.length,2);assert.equal(metadata[0].recordingFiles.local.id,'local');
});
test('storage authorization failure is visible and preserves local audio',async()=>{
  const {c,$}=setup({local:[{id:'one',title:'Aula',blob:new Blob(['test'])}],failUpload:true});await $('#syncRecordingFiles').onclick();assert.equal(c.recordings.length,1);assert.match($('#recordingTransferStatus').textContent,/precisa ser habilitado ou autorizado/);assert.equal($('#syncRecordingFiles').disabled,false);
});
test('signed-in devices transfer automatically and avoid uploading unchanged files again',async()=>{
  const env=setup({local:[{id:'auto',title:'Aula',blob:new Blob(['audio'])}]});
  env.c.connectAutomaticRecordingSync({uid:'owner'});await env.tick();assert.equal(env.uploads.length,1);
  env.listeners['recordings-changed']();await env.tick();assert.equal(env.uploads.length,1);
  env.c.recordings.push({id:'second',title:'Outra aula',blob:new Blob(['audio2'])});
  env.listeners['recordings-changed']();await env.tick();assert.equal(env.uploads.length,2);
});
test('automatic synchronization waits for network and cancels on sign-out',async()=>{
  const env=setup({local:[{id:'one',title:'Aula',blob:new Blob(['audio'])}]});
  env.c.navigator.onLine=false;env.c.connectAutomaticRecordingSync({uid:'owner'});await env.tick();assert.equal(env.uploads.length,0);
  env.c.navigator.onLine=true;env.listeners.online();env.c.cloudUser=null;env.c.connectAutomaticRecordingSync(null);await env.tick();assert.equal(env.uploads.length,0);assert.equal(env.timers.size,0);
});
test('automatic synchronization stops retrying when cloud access is denied',async()=>{
  const env=setup({local:[{id:'one',title:'Aula',blob:new Blob(['audio'])}],failUpload:true});
  env.c.connectAutomaticRecordingSync({uid:'owner'});await env.tick();assert.equal(env.timers.size,0);assert.match(env.$('#recordingTransferStatus').textContent,/precisa ser habilitado/);
});
test('automatic synchronization includes videos from both devices',async()=>{
  const env=setup({local:[{id:'video',title:'Meet',source:'meet',mimeType:'video/webm',blob:new Blob(['video'],{type:'video/webm'})}],remote:{phone:{id:'phone',title:'Meet do celular',source:'meet',mimeType:'video/mp4',objectPath:'users/owner/recordings/phone'}}});
  env.c.connectAutomaticRecordingSync({uid:'owner'});await env.tick();
  assert.equal(env.uploads.length,1);assert.equal(env.uploads[0].blob.type,'video/webm');
  assert.equal(env.downloads.length,1);assert.equal(env.c.recordings.find(item=>item.id==='phone').source,'meet');
});
