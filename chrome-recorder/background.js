let handling=false;
async function library(){await chrome.tabs.create({url:chrome.runtime.getURL('library.html')});}
chrome.action.onClicked.addListener(async tab=>{
  if(handling)return;handling=true;
  try{
    const contexts=await chrome.runtime.getContexts({contextTypes:['OFFSCREEN_DOCUMENT']});
    if(!contexts.length)await chrome.offscreen.createDocument({url:'offscreen.html',reasons:['USER_MEDIA'],justification:'Gravar a aula selecionada pelo usuário mesmo com o site do caderno fechado.'});
    const state=await chrome.runtime.sendMessage({target:'recorder',type:'status'});
    if(state.busy){await chrome.runtime.sendMessage({target:'recorder',type:'stop'});return;}
    if(!tab.id||!/^https?:/.test(tab.url||''))throw new Error('Abra a aba do Meet ou da videoaula e clique na extensão.');
    const streamId=await chrome.tabCapture.getMediaStreamId({targetTabId:tab.id});
    const result=await chrome.runtime.sendMessage({target:'recorder',type:'start',streamId,title:tab.title||'Aula'});
    if(result.error)throw new Error(result.error);
    await chrome.storage.local.remove('lastError');
    await chrome.action.setBadgeBackgroundColor({color:'#b84242'});
    await chrome.action.setBadgeText({text:'REC'});
    await chrome.action.setTitle({title:'Gravando aula — clique para parar'});
  }catch(error){await chrome.storage.local.set({lastError:error.message});await library();}
  finally{handling=false;}
});
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||message.target!=='background'||message.type!=='finished')return;
  (async()=>{await chrome.action.setBadgeText({text:''});await chrome.action.setTitle({title:'Gravar esta aula / parar gravação'});if(message.error)await chrome.storage.local.set({lastError:message.error});await library();})().then(()=>respond({ok:true}));return true;
});
