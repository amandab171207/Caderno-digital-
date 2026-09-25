let recorder,media,output,session,busy=false,writes=Promise.resolve(),failure='',sequence=0;
function release(){media?.getTracks().forEach(track=>track.stop());output?.close().catch(()=>{});media=null;output=null;}
function stop(){if(recorder?.state==='recording')recorder.stop();}
async function start(message){
  if(busy)throw new Error('Já existe uma gravação em andamento.');busy=true;failure='';sequence=0;writes=Promise.resolve();
  try{
    media=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}},video:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:message.streamId}}});
    if(media.getAudioTracks().length){output=new AudioContext();output.createMediaStreamSource(new MediaStream(media.getAudioTracks())).connect(output.destination);await output.resume();}
    const mimeType=['video/webm;codecs=vp8,opus','video/webm'].find(type=>MediaRecorder.isTypeSupported(type));
    recorder=new MediaRecorder(media,mimeType?{mimeType}:undefined);
    session={id:crypto.randomUUID(),title:message.title,createdAt:Date.now(),mimeType:recorder.mimeType,complete:false};
    await captureTransaction('sessions','readwrite',store=>store.put(session));
    recorder.ondataavailable=event=>{
      if(!event.data.size)return;
      const chunk={sessionId:session.id,index:sequence++,blob:event.data};
      writes=writes.then(()=>captureTransaction('chunks','readwrite',store=>store.put(chunk))).catch(error=>{failure=error.message||'Falha ao guardar a gravação.';stop();});
    };
    recorder.onerror=event=>{failure=event.error?.message||'A captura foi interrompida.';stop();};
    recorder.onstop=async()=>{
      release();await writes;
      try{await captureTransaction('sessions','readwrite',store=>store.put({...session,complete:!failure,error:failure,endedAt:Date.now()}));}
      catch(error){failure=error.message;}
      busy=false;
      await chrome.runtime.sendMessage({target:'background',type:'finished',error:failure});
    };
    media.getTracks().forEach(track=>track.addEventListener('ended',stop,{once:true}));
    recorder.start(5000);
  }catch(error){release();busy=false;throw error;}
}
chrome.runtime.onMessage.addListener((message,sender,respond)=>{
  if(sender.id!==chrome.runtime.id||message.target!=='recorder')return;
  if(message.type==='status'){respond({busy});return;}
  if(message.type==='stop'){stop();respond({ok:true});return;}
  if(message.type==='start'){start(message).then(()=>respond({ok:true}),error=>respond({error:error.message}));return true;}
});
