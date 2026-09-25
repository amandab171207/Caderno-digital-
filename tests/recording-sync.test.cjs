const {test}=require('node:test');const assert=require('node:assert/strict');const vm=require('node:vm');const fs=require('node:fs');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../recording-sync.js'),'utf8');
function setup({user={uid:'owner'},remote={},local=[],failUpload=false}={}){
  const nodes={},uploads=[],downloads=[],metadata=[];const $=id=>nodes[id]??={value:'Matemática',append(){},textContent:'',disabled:false};
  const storage={ref(objectPath){return {async put(blob){if(failUpload)throw {code:'storage/unauthorized'};uploads.push({objectPath,blob});},async getDownloadURL(){downloads.push(objectPath);return 'https://example.test/recording';}};}};
  const firebase={storage:()=>storage};
  const c=vm.createContext({$,document:{createElement:()=>({})},window:{firebase},firebase,cloudUser:user,cloudDb:{collection:()=>({doc:()=>({get:async()=>({data:()=>({recordingFiles:remote})}),set:async value=>metadata.push(value)})})},recordings:local,trashedRecordings:[],recordingsStorageReady:true,recordingsSaveTimer:0,clearTimeout(){},saveRecordingsInBrowser:async()=>{},renderRecordings(){},ensureRecordingSubjectOption(){},recordingKind:item=>item.source||'microphone',URL:{createObjectURL:()=> 'blob:received'},fetch:async()=>({ok:true,blob:async()=>new Blob(['remote'],{type:'audio/webm'})}),Blob});
  vm.runInContext(source,c);return {c,$,uploads,downloads,metadata};
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
