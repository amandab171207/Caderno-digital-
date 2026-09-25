let cloudBase={notebooks:[],appData:{}},cloudSaving=false,cloudPending=null,cloudReceiveTimer=null,cloudInteraction=0,cloudRetryTimer=null;
const cloudCopy=value=>JSON.parse(JSON.stringify(value));
const cloudLocal=()=>({notebooks:cloudCopy(notebooks),appData:collectCloudAppData()});
function cloudRememberBase(data){cloudBase=cloudCopy(data);if(cloudUser)localStorage.setItem(`caderno-sync-base-${cloudUser.uid}`,JSON.stringify(cloudBase));}
function cloudRecovery(local,remote){
  if(!CloudState.equal(local,remote)&&cloudUser){
    try{localStorage.setItem(`caderno-sync-recovery-${cloudUser.uid}`,JSON.stringify({at:Date.now(),local,remote}));}catch{}
  }
}
function cloudApply(data){
  if(Array.isArray(data.notebooks)&&data.notebooks.length&&!CloudState.equal(notebooks,data.notebooks))showCloudNotebooks(data.notebooks);
  const changed=applyCloudAppData(data.appData||{});
  lastCloudAppData=JSON.stringify(collectCloudAppData());
  if(changed)window.dispatchEvent(new Event('cloud-data-applied'));
}
function cloudReceive(remote){
  const local=cloudLocal(),merged=CloudState.combine(cloudBase,local,remote);
  if(!CloudState.equal(local,cloudBase)&&!CloudState.equal(remote,cloudBase))cloudRecovery(local,remote);
  cloudApply(merged);cloudRememberBase(remote);
  if(!CloudState.equal(merged,remote))scheduleCloudSave();
  setCloudStatus('✓ Alterações recebidas automaticamente do outro aparelho.');
}
function queueCloudReceive(data){
  cloudPending=data;clearTimeout(cloudReceiveTimer);
  const flush=()=>{
    if(!cloudUser||!cloudReady)return;
    if(cloudSaving||Date.now()-cloudInteraction<1200){cloudReceiveTimer=setTimeout(flush,500);return;}
    const pending=cloudPending;cloudPending=null;if(pending)cloudReceive(pending);
  };cloudReceiveTimer=setTimeout(flush,100);
}
document.addEventListener('input',()=>{cloudInteraction=Date.now();},true);
document.addEventListener('pointerdown',()=>{cloudInteraction=Date.now();},true);
async function saveLiveCloud(){
  if(!cloudUser||!cloudReady||cloudSaving||navigator.onLine===false)return;
  const uid=cloudUser.uid,local=cloudLocal(),base=cloudCopy(cloudBase);
  cloudSaving=true;setCloudStatus('Salvando e sincronizando suas alterações...');
  try{
    const ref=cloudDb.collection('users').doc(uid);
    const committed=await cloudDb.runTransaction(async transaction=>{
      const snapshot=await transaction.get(ref),data=snapshot.data()||{};
      const remote={notebooks:data.notebooks||[],appData:data.appData||{}};
      const merged=CloudState.combine(base,local,remote);
      transaction.set(ref,{...data,...merged,updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:cloudClientId});
      return merged;
    });
    if(cloudUser?.uid!==uid)return;
    const latest=cloudLocal(),merged=CloudState.combine(local,latest,committed);
    // Reconcile remote changes after typing settles; never reset the editor on every save.
    if(!CloudState.equal(latest,committed))queueCloudReceive(committed);
    else cloudRememberBase(committed);
    lastCloudAppData=JSON.stringify(local.appData);
    if(!CloudState.equal(merged,committed))scheduleCloudSave();
    setCloudStatus('✓ Sincronizado automaticamente no computador, celular e tablet.');
  }catch(error){
    if(cloudUser?.uid!==uid)return;
    setCloudStatus('Salvo neste aparelho. A sincronização será tentada novamente quando houver conexão.');
    if(!['permission-denied','resource-exhausted'].includes(error?.code)){clearTimeout(cloudRetryTimer);cloudRetryTimer=setTimeout(()=>scheduleCloudSave(),15000);}
  }finally{cloudSaving=false;}
}
async function connectLiveCloud(user){
  cloudUnsubscribe?.();cloudUnsubscribe=null;clearTimeout(cloudReceiveTimer);clearTimeout(cloudSaveTimer);clearTimeout(cloudRetryTimer);cloudPending=null;
  cloudUser=user;cloudReady=false;
  if(!user){$('#sideGoogleLogin').innerHTML='<span aria-hidden="true">G</span> Continuar com Google';setCloudStatus('Entre com a mesma conta Google nos aparelhos para sincronizar.');return;}
  $('#sideGoogleLogin').textContent='Sair da nuvem';setCloudStatus('Conectando a sincronização automática...');
  let baseline=null;try{baseline=JSON.parse(localStorage.getItem(`caderno-sync-base-${user.uid}`));}catch{}
  cloudBase=baseline||{notebooks:[],appData:{}};
  let first=true;
  const ref=cloudDb.collection('users').doc(user.uid);
  cloudUnsubscribe=ref.onSnapshot({includeMetadataChanges:true},snapshot=>{
    if(cloudUser?.uid!==user.uid||snapshot.metadata.hasPendingWrites)return;
    // A cache-only snapshot cannot establish an authoritative initial baseline.
    if(first&&snapshot.metadata.fromCache)return;
    const data=snapshot.data()||{},remote={notebooks:data.notebooks||[],appData:data.appData||{}};
    if(first){
      first=false;cloudReady=true;
      if(!baseline&&snapshot.exists){
        const local=cloudLocal();cloudRecovery(local,remote);
        // On first connection, cloud versions win for existing IDs; keep local-only notebooks.
        cloudBase=cloudCopy(local);cloudBase.notebooks=local.notebooks.filter(item=>remote.notebooks.some(other=>other.id===item.id));
        cloudBase.appData=Object.fromEntries(Object.entries(local.appData).filter(([key])=>key in remote.appData));
      }
      queueCloudReceive(remote);return;
    }
    if(data.updatedBy!==cloudClientId)queueCloudReceive(remote);
  },error=>{setCloudStatus(error?.code==='permission-denied'?'A conta não tem permissão para sincronizar. Entre novamente.':'A sincronização foi interrompida. Tentando reconectar...');if(error?.code!=='permission-denied')cloudRetryTimer=setTimeout(()=>{if(cloudUser?.uid===user.uid)connectLiveCloud(user);},15000);});
}
