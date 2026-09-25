const status=document.querySelector('#status');
async function loadLibrary(){
  const {lastError}=await chrome.storage.local.get('lastError');status.textContent=lastError||'';
  const sessions=await captureTransaction('sessions','readonly',store=>store.getAll());
  const list=document.querySelector('#list');list.replaceChildren();
  if(!sessions.length){list.textContent='Nenhuma aula gravada ainda.';return;}
  for(const session of sessions.sort((a,b)=>b.createdAt-a.createdAt)){
    const card=document.createElement('article'),title=document.createElement('h2'),detail=document.createElement('small'),button=document.createElement('button');
    title.textContent=session.title;detail.textContent=new Date(session.createdAt).toLocaleString('pt-BR')+(session.complete?'':' · Gravação em andamento ou interrompida; o arquivo pode estar incompleto.');button.textContent='Baixar vídeo';
    button.onclick=async()=>{button.disabled=true;try{
      const chunks=await captureTransaction('chunks','readonly',store=>store.getAll(IDBKeyRange.bound([session.id,0],[session.id,Number.MAX_SAFE_INTEGER])));
      if(!chunks.length)throw new Error('Ainda não há vídeo disponível. Aguarde a gravação terminar.');
      const blob=new Blob(chunks.map(chunk=>chunk.blob),{type:session.mimeType||'video/webm'}),url=URL.createObjectURL(blob),link=document.createElement('a');
      link.href=url;link.download='Aula-'+new Date(session.createdAt).toISOString().replace(/[:.]/g,'-')+'.webm';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
    }catch(error){status.textContent=error.message;}finally{button.disabled=false;}};
    card.append(title,detail,button);list.append(card);
  }
}
loadLibrary().catch(error=>status.textContent=error.message);
