// Classification is conservative: distinct topic terms or an explicit lesson name.
const recordingSubjectVocabulary={
  'Matemática':['equação','fração','polinômio','teorema','hipotenusa','logaritmo','geometria','álgebra'],
  'Português':['verbo','substantivo','oração subordinada','concordância','sintaxe','gramática','figura de linguagem','literatura'],
  'História':['revolução francesa','idade média','feudalismo','colonização','império romano','guerra mundial','revolução industrial'],
  'Geografia':['latitude','longitude','relevo','cartografia','placas tectônicas','urbanização','clima'],
  'Ciências':['método científico','cadeia alimentar','estados da matéria','ciclo da água'],
  'Biologia':['célula','mitose','meiose','genética','dna','fotossíntese','evolução','ecossistema'],
  'Física':['aceleração','velocidade','força resultante','lei de newton','cinemática','eletricidade','energia cinética'],
  'Química':['átomo','molécula','tabela periódica','ligação química','reação química','estequiometria','mol'],
  'Inglês':['verb to be','simple present','past tense','present perfect','english','pronouns'],
  'Educação Física':['alongamento','aquecimento muscular','voleibol','handebol','condicionamento físico'],
  'Educação Financeira':['juros compostos','juros simples','orçamento','renda fixa','investimento','educação financeira'],
  'Banco de Dados':['sql','select','chave primária','chave estrangeira','banco de dados','normalização','mysql'],
  'Ciência de Dados':['machine learning','aprendizado de máquina','regressão','dataset','pandas','ciência de dados'],
  'Programação Back end':['api','endpoint','servidor','back end','backend','requisição http','node js'],
  'Programação Mobile':['android','flutter','react native','kotlin','aplicativo móvel','mobile'],
  'Programação no Desenvolvimento de Sistemas':['algoritmo','variável','laço de repetição','estrutura de dados','orientação a objetos','compilador'],
  'Análise e Projeto de Sistemas':['requisitos funcionais','caso de uso','uml','diagrama de classes','engenharia de software','prototipação'],
  'Computação Gráfica':['renderização','modelagem 3d','textura','vetor gráfico','rasterização','blender']
};
function normalizeSubjectSpeech(value){return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function inferRecordingSubject(transcript,names){
  const text=' '+normalizeSubjectSpeech(transcript)+' ';
  const contains=term=>text.includes(' '+normalizeSubjectSpeech(term)+' ');
  const ranked=[...new Set(names)].map(name=>{
    const explicit=['aula de ','aula e de ','materia de ','disciplina de '].some(prefix=>contains(prefix+name));
    const vocabulary=Object.entries(recordingSubjectVocabulary).find(([key])=>normalizeSubjectSpeech(key)===normalizeSubjectSpeech(name))?.[1]||[];
    const evidence=vocabulary.filter(contains);
    return {name,score:explicit?10:evidence.length,evidence:explicit?['aula de '+name]:evidence};
  }).sort((a,b)=>b.score-a.score);
  const [best,second]=ranked;
  return best&&best.score>=3&&best.score-(second?.score||0)>=2?best:null;
}
function supportsRecordingSpeechTrack(userAgent){
  // Older engines silently ignore start(track), which would capture the microphone.
  const chromium=/\b(?:Chrome|Chromium)\/(\d+)/.exec(userAgent);
  return !!chromium&&Number(chromium[1])>=135&&!/Android|iPhone|iPad|Mobile/.test(userAgent);
}
function createRecordingSubjectDetector({track,names,onSubject,onStatus,onTranscript}){
  const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
  let recognition,stopped=false,timer,retryTimer,segments=[],restarts=0,identified=false;
  function stop(){stopped=true;clearTimeout(timer);clearTimeout(retryTimer);if(recognition){recognition.onresult=null;recognition.onerror=null;recognition.onend=null;try{recognition.abort();}catch{}}}
  function fail(message){onStatus(message);stop();}
  if(!Recognition||!supportsRecordingSpeechTrack(navigator.userAgent)){
    onStatus('Identificação por áudio indisponível neste navegador. Use Chrome atualizado no computador ou escolha a matéria manualmente.');
    return {stop};
  }
  if(!track||track.kind!=='audio'||track.readyState!=='live'){
    onStatus('Não há áudio disponível para identificar a matéria. Escolha manualmente.');return {stop};
  }
  try{
    recognition=new Recognition();recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;
    recognition.onresult=event=>{
      if(stopped)return;
      for(let i=event.resultIndex;i<event.results.length;i++)if(event.results[i].isFinal)segments.push(event.results[i][0].transcript);
      const text=segments.join(' ').slice(-16000);segments=[text];onTranscript?.(text);
      const candidate=inferRecordingSubject(text,names);
      if(candidate){identified=true;onSubject(candidate.name);onStatus('Matéria sugerida: '+candidate.name+'. Você pode corrigir abaixo.');stop();}
    };
    recognition.onerror=event=>{
      if(stopped||event.error==='no-speech')return;
      fail(event.error==='not-allowed'||event.error==='service-not-allowed'?'Permissão de transcrição negada. A gravação continua; escolha a matéria manualmente.':'Não foi possível transcrever o áudio. A gravação continua; escolha a matéria manualmente.');
    };
    recognition.onend=()=>{
      if(stopped)return;
      if(++restarts>4){fail('Não foi possível identificar a matéria. Escolha manualmente.');return;}
      retryTimer=setTimeout(()=>{if(stopped)return;try{recognition.start(track);}catch{fail('A transcrição foi interrompida. Escolha a matéria manualmente.');}},500);
    };
    recognition.start(track);onStatus('Ouvindo as primeiras falas para identificar a matéria…');
    timer=setTimeout(()=>{if(!identified)fail('Não houve informação suficiente para identificar a matéria. Escolha manualmente.');},90000);
  }catch{fail('Não foi possível iniciar a identificação. A gravação continua; escolha a matéria manualmente.');}
  return {stop};
}
