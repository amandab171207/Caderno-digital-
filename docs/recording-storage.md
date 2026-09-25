# Armazenamento e transferência das gravações

Os arquivos originais ficam no IndexedDB do navegador de cada aparelho. Entrar
com Google sincronizava apenas os dados textuais, sem os arquivos de áudio.
O novo botão Sincronizar gravações envia os arquivos locais para Cloud Storage
e copia para o aparelho arquivos ainda não presentes. É uma cópia entre aparelhos,
não uma exclusão sincronizada: apagar localmente não apaga o arquivo na nuvem.
Metadados ficam no campo `recordingFiles` do documento `users/{uid}` já utilizado
pelo caderno. Arquivos ficam em `users/{uid}/recordings/{recordingId}`.

## Pré-requisitos da conta administradora

- Cloud Storage habilitado no projeto Firebase configurado em app.js. O Firebase
  exige plano Blaze para esse produto. Nenhuma configuração de cobrança foi
  alterada por esta implementação.
- Regras de Storage que permitam somente ao dono autenticado ler e escrever
  `users/{uid}/recordings/{recordingId}`. Integrar a regra abaixo às regras
  existentes; não substituir regras de outros recursos sem revisão.
- Regras existentes do Firestore precisam manter `users/{uid}` privado ao dono.
- Downloads por fetch requerem CORS do bucket permitindo GET para
  `https://amandab171207.github.io` (e localhost somente para desenvolvimento).

Exemplo de regra específica de Storage (ainda não implantada):

```text
match /users/{uid}/recordings/{recordingId} {
  allow read, delete: if request.auth != null && request.auth.uid == uid;
  allow create, update: if request.auth != null && request.auth.uid == uid
    && request.resource.size < 1024 * 1024 * 1024
    && request.resource.contentType.matches('(audio|video)/.*');
}
```

## Uso

Abra o mesmo endereço publicado no celular e no computador, entre com a mesma
conta e sincronize primeiro no celular. Os arquivos de localhost pertencem a
outro armazenamento e não aparecem automaticamente no domínio publicado.
Arquivos guardados em outro navegador no celular também precisam ser enviados
pelo navegador de origem. Não limpar os dados do navegador antes da transferência.

Sem Storage habilitado, use Baixar no aparelho de origem e Importar áudios ou
vídeos no computador. O botão informa falhas de acesso sem apagar o arquivo local.

A extensão Chrome é independente: não envia dados para a nuvem e suas gravações
devem ser baixadas e importadas no caderno. O site fechado não pode iniciar a
captura sozinho. Na extensão, é preciso clicar para iniciar cada gravação.

Validação realizada com testes simulados e inspeção da interface. A transferência
de arquivos reais do celular e a captura pela extensão precisam de teste nos
aparelhos do usuário com login e permissões disponíveis.
