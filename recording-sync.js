// Audio/video files live in Storage; only metadata is written to the private user document.
const recordingTransferPanel=document.createElement('section');
recordingTransferPanel.className='recording-transfer';
recordingTransferPanel.innerHTML='<h2>Gravações entre aparelhos</h2><p>Abra o caderno no celular e no computador com a mesma conta Google. Toque em sincronizar primeiro no celular e depois no computador.</p><div class="recording-transfer-actions"><button id="syncRecordingFiles" class="secondary-button">Sincronizar gravações</button><label class="secondary-button" for="importRecordingFiles">Importar áudios ou vídeos</label><input id="importRecordingFiles" type="file" accept="audio/*,video/*,.webm,.m4a,.mp3,.wav,.ogg,.mp4" multiple hidden></div><p id="recordingTransferStatus" role="status" aria-live="polite"></p><details><summary>Gravar com o caderno fechado no Chrome</summary><p>Instale a extensão no computador. A aula e o Chrome precisam permanecer abertos. Clique na extensão para iniciar e novamente para parar. Ela grava vídeo com o áudio da aba; seu microfone não é incluído.</p><a href="downloads/caderno-gravador-chrome.zip" download class="secondary-button">Baixar extensão</a><p>Extraia o arquivo, abra chrome://extensions, ative o modo do desenvolvedor e use “Carregar sem compactação” para selecionar a pasta extraída. Após gravar, baixe o vídeo na biblioteca da extensão e importe aqui.</p></details>';
$('#gravacao').append(recordingTransferPanel);
let recordingTransferBusy=false;
const recordingTransferStatus=message=>$('#recordingTransferStatus').textContent=message;
async function waitRecordingStorage(){
  for(let attempts=0;attempts<100&&!recordingsStorageReady;attempts++)await new Promise(resolve=>setTimeout(resolve,100));
  if(!recordingsStorageReady)throw new Error('As gravações ainda estão carregando. Tente novamente.');
}
async function persistTransferredRecordings(){clearTimeout(recordingsSaveTimer);await saveRecordingsInBrowser();}
$('#importRecordingFiles').onchange=async event=>{
  if(recordingTransferBusy)return;
  const files=[...event.target.files];if(!files.length)return;
  recordingTransferBusy=true;$('#syncRecordingFiles').disabled=true;
  try{
    await waitRecordingStorage();let count=0;
    for(const file of files){
      const mime=file.type||(/\.mp4$/i.test(file.name)?'video/mp4':/\.webm$/i.test(file.name)?'video/webm':/\.mp3$/i.test(file.name)?'audio/mpeg':/\.m4a$/i.test(file.name)?'audio/mp4':/\.wav$/i.test(file.name)?'audio/wav':/\.ogg$/i.test(file.name)?'audio/ogg':'');
      if(!/^(audio|video)\//.test(mime))continue;
      const blob=file.type?file:new Blob([file],{type:mime});
      recordings.unshift({id:crypto.randomUUID(),title:file.name,subject:$('#recordSubjectSelect').value==='personalizada'?$('#customSubject').value.trim()||'Não identificada':$('#recordSubjectSelect').value,source:mime.startsWith('video/')?'meet':'microphone',mimeType:mime,blob,url:URL.createObjectURL(blob),caption:''});count++;
    }
    renderRecordings();await persistTransferredRecordings();recordingTransferStatus(`${count} arquivo(s) importado(s). Vídeos ficam em Meets; áudios em Gravações.`);
  }catch(error){recordingTransferStatus(error.message||'Não foi possível importar os arquivos.');}
  finally{recordingTransferBusy=false;$('#syncRecordingFiles').disabled=false;event.target.value='';}
};
$('#syncRecordingFiles').onclick=async()=>{
  if(recordingTransferBusy)return;
  if(!cloudUser){recordingTransferStatus('Entre com Google no caderno, usando a mesma conta do celular.');return;}
  if(!window.firebase?.storage){recordingTransferStatus('Não foi possível carregar a sincronização. Verifique sua conexão e atualize a página.');return;}
  const uid=cloudUser.uid;recordingTransferBusy=true;$('#syncRecordingFiles').disabled=true;$('#importRecordingFiles').disabled=true;
  const checkAccount=()=>{if(cloudUser?.uid!==uid)throw new Error('A conta mudou. Sincronização interrompida.');};
  try{
    await waitRecordingStorage();checkAccount();
    const userRef=cloudDb.collection('users').doc(uid),remote=(await userRef.get()).data()?.recordingFiles||{},storage=firebase.storage();
    storage.setMaxUploadRetryTime?.(30000);storage.setMaxOperationRetryTime?.(15000);
    let uploaded=0,received=0;
    for(const item of [...recordings]){
      checkAccount();if(remote[item.id])continue;
      recordingTransferStatus(`Enviando ${++uploaded}: ${item.title}…`);
      const blob=item.blob||await fetch(item.url).then(response=>response.blob());
      const objectPath=`users/${uid}/recordings/${encodeURIComponent(item.id)}`;
      const upload=storage.ref(objectPath).put(blob,{contentType:blob.type||item.mimeType||'application/octet-stream'});upload.on?.('state_changed',()=>{if(cloudUser?.uid!==uid)upload.cancel();});await upload;checkAccount();
      const metadata={id:item.id,title:item.title,subject:item.subject,custom:!!item.custom,source:recordingKind(item),mimeType:blob.type||item.mimeType||'',caption:item.caption||'',lessonId:item.lessonId||null,objectPath,size:blob.size};
      await userRef.set({recordingFiles:{[item.id]:metadata}},{merge:true});
    }
    for(const item of Object.values(remote)){
      checkAccount();if(recordings.some(local=>local.id===item.id)||trashedRecordings.some(local=>local.id===item.id))continue;
      // Do not follow arbitrary URLs or paths supplied by remote metadata.
      if(typeof item.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(item.id)||item.objectPath!==`users/${uid}/recordings/${encodeURIComponent(item.id)}`)continue;
      recordingTransferStatus(`Recebendo ${++received}: ${item.title}…`);
      const downloadUrl=await storage.ref(item.objectPath).getDownloadURL();const response=await fetch(downloadUrl);if(!response.ok)throw new Error("Não foi possível baixar a gravação.");const blob=await response.blob();checkAccount();
      recordings.unshift({...item,blob,url:URL.createObjectURL(blob)});ensureRecordingSubjectOption(item.subject||'Não identificada');
      await persistTransferredRecordings();
    }
    renderRecordings();await persistTransferredRecordings();recordingTransferStatus(`Sincronização concluída: ${uploaded} enviado(s) e ${received} recebido(s).`);
  }catch(error){
    renderRecordings();
    const configError=/storage\/(unauthorized|bucket-not-found|project-not-found|unknown)|permission-denied/.test(error.code||'');
    recordingTransferStatus(configError?'O armazenamento de gravações na nuvem ainda precisa ser habilitado ou autorizado. Seus arquivos continuam neste aparelho. Use Baixar e Importar para transferi-los.':error.message||'A sincronização foi interrompida. Tente novamente; os arquivos já enviados serão preservados.');
  }finally{recordingTransferBusy=false;$('#syncRecordingFiles').disabled=false;$('#importRecordingFiles').disabled=false;}
};
