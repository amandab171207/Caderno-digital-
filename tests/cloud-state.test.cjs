const {test}=require('node:test'),assert=require('node:assert/strict');
const {combine,merge}=require('../cloud-state.js');
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('remote deletions and shorter text replace unchanged local versions',()=>{
 const base=[{id:'a',pages:[{content:'texto longo'}]},{id:'b'}];
 assert.deepEqual(merge(base,base,[{id:'a',pages:[{content:'curto'}]}]),[{id:'a',pages:[{content:'curto'}]}]);
});
test('independent offline changes merge in both directions',()=>{
 const base={notebooks:[{id:'a',title:'A'},{id:'b',title:'B'}],appData:{school:JSON.stringify({schedule:[{id:'one',type:'meet'},{id:'two',type:'meet'}]})}};
 const local=structuredClone(base),remote=structuredClone(base);local.notebooks[0].title='Local';remote.notebooks[1].title='Remoto';
 local.appData.school=JSON.stringify({schedule:[{id:'one',type:'recording'},{id:'two',type:'meet'}]});remote.appData.school=JSON.stringify({schedule:[{id:'one',type:'meet'},{id:'two',type:'free'}]});
 const result=combine(base,local,remote);assert.deepEqual(result.notebooks,[{id:'a',title:'Local'},{id:'b',title:'Remoto'}]);assert.deepEqual(JSON.parse(result.appData.school).schedule,[{id:'one',type:'recording'},{id:'two',type:'free'}]);assert.deepEqual(combine(base,remote,local),result);
});
test('a deleted setting is not restored by an unchanged device',()=>{assert.deepEqual(combine({notebooks:[],appData:{theme:'"dark"'}},{notebooks:[],appData:{theme:'"dark"'}},{notebooks:[],appData:{}}).appData,{});});
test('two devices exchange edits through transactions without reloading',async()=>{
 let server={notebooks:[{id:'a',title:'Inicial',pages:[{content:'texto longo'}]}],appData:{'caderno-digital-test':'1'},recordingFiles:{keep:true}};
 const snapshot=()=>({exists:true,metadata:{hasPendingWrites:false,fromCache:false},data:()=>structuredClone(server)});
 function device(id){
   const storage=new Map(),timers=new Map();let timerId=0;const events=[];
   const c={CloudState:require('../cloud-state.js'),notebooks:structuredClone(server.notebooks),cloudUser:{uid:'user'},cloudReady:true,cloudUnsubscribe:null,cloudSaveTimer:null,cloudClientId:id,lastCloudAppData:'',navigator:{onLine:true},localStorage:{setItem:(k,v)=>storage.set(k,v),getItem:k=>storage.get(k)||null},document:{addEventListener(){}},window:{dispatchEvent:e=>events.push(e)},Event:class{},setTimeout:fn=>{timers.set(++timerId,fn);return timerId;},clearTimeout:id=>timers.delete(id),setCloudStatus(){},scheduleCloudSave(){c.scheduled=true;},collectCloudAppData:()=>({'caderno-digital-test':storage.get('setting')||'1'}),applyCloudAppData:data=>{storage.set('setting',data['caderno-digital-test']);return true;},showCloudNotebooks:data=>{c.notebooks=structuredClone(data);},firebase:{firestore:{FieldValue:{serverTimestamp:()=>1}}},$(){return {innerHTML:'',textContent:''};}};
   c.cloudDb={collection:()=>({doc:()=>({onSnapshot:(_opts,cb)=>{c.receive=cb;return ()=>{};}})}),runTransaction:async fn=>fn({get:async()=>snapshot(),set:(_ref,data)=>{server=structuredClone(data);}})};
   vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(__dirname,'../cloud-engine.js'),'utf8'),c);
   c.cloudRememberBase({notebooks:structuredClone(server.notebooks),appData:server.appData});
   c.flush=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};return c;
 }
 const a=device('a'),b=device('b');a.notebooks[0].pages[0].content='curto';await a.saveLiveCloud();b.queueCloudReceive({notebooks:server.notebooks,appData:server.appData});b.flush();assert.equal(b.notebooks[0].pages[0].content,'curto');
 b.notebooks[0].title='Mudou no celular';await b.saveLiveCloud();a.queueCloudReceive({notebooks:server.notebooks,appData:server.appData});a.flush();assert.equal(a.notebooks[0].title,'Mudou no celular');assert.equal(server.recordingFiles.keep,true);
 a.navigator.onLine=false;a.notebooks[0].title='Offline';await a.saveLiveCloud();assert.equal(server.notebooks[0].title,'Mudou no celular');a.navigator.onLine=true;await a.saveLiveCloud();assert.equal(server.notebooks[0].title,'Offline');
});
