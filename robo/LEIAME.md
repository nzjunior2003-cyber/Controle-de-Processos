# Rastreador PAE — versão com inicialização robusta

Arquivos desta pasta (substituem os de mesmo nome do robô):

- `rastreador_pae.py` — o robô, com as correções abaixo.
- `apps_script_pae.gs` — o script da planilha, com o registro de status (aba `ROBO_LOG`).

## O que mudou

1. **Início sem precisar clicar várias vezes.** O robô agora *espera* o card "PAE 4.0", o ícone
   "Consulta Detalhada" e o botão "FILTRAR" aparecerem (até 20–30 s cada) em vez de olhar a tela uma
   única vez. Se algo falhar, repete a inicialização sozinho (até 4 tentativas).
2. **Login expirado.** Se o PAE pedir login, o robô avisa e espera você entrar na janela (até 5 min).
3. **Sem clique duplo no card do PAE** (antes, se a aba nova demorasse 6 s, ele clicava de novo).
4. **Planilha com timeout e novas tentativas** (3x) — o Apps Script às vezes falha na primeira chamada.
5. **Tela que trava no meio da rodada:** depois de 3 erros seguidos, recarrega o PAE e reabre a consulta;
   se não resolver, recomeça do portal. Ao final, refaz uma vez os processos que deram erro.
6. **Status do robô na planilha:** cada execução registra uma linha na aba `ROBO_LOG`
   (EXECUTANDO / CONCLUIDO / INTERROMPIDO / FALHOU, máquina, totais, minutos, motivo).

## Como aplicar

1. **Apps Script:** abra a planilha > Extensões > Apps Script, substitua o código por `apps_script_pae.gs`
   e salve. Depois: Implantar > **Gerenciar implantações** > lápis > Versão: **Nova versão** > Implantar.
   (A URL do Web App continua a mesma. Sem publicar a nova versão, o robô funciona, mas não grava o status.)
2. **Robô:** troque o `rastreador_pae.py` e teste com `python rastreador_pae.py`.
3. **Para o notebook/colegas:** gere o `.exe` de novo (`instrucoes_build.md`) e reinstale.

## Observações

- As correções foram escritas sem acesso ao PAE: teste a primeira rodada olhando o terminal.
- Se algum seletor do PAE mudar, o robô agora espera até o limite e mostra qual etapa falhou.

---

## Modo vigia (botão "Atualizar agora" e horários automáticos)

O robô ganhou o modo `--vigiar`: ele fica aberto em segundo plano e, a cada minuto,
(1) dá um sinal de vida na planilha, (2) vê se o sistema pediu uma atualização e
(3) roda nos horários agendados (dias úteis; padrão **07:30, 12:30 e 17:30**).
Só **um** computador executa cada pedido/horário (o PC e o notebook não se atropelam).

**Ligar:** dê dois cliques em `iniciar_vigia.bat` (ou `RastreadorPAE.exe --vigiar`).
Para iniciar junto com o Windows: `Win+R` > `shell:startup` > coloque um atalho do `.bat`.
O computador precisa estar **ligado, com a sessão do Windows desbloqueada** (o robô usa o navegador).

**Horários:** edite `%APPDATA%\RastreadorPAE\config.json` e inclua, por exemplo:
`"horarios": ["08:00", "12:30", "17:00"]`.

### Configuração única (token + servidor)

1. No Apps Script: Configurações do projeto > Propriedades do script > adicione `TOKEN_ROBO` = uma senha
   qualquer. Depois publique **nova versão** da implantação (Implantar > Gerenciar implantações).
2. No robô: `RastreadorPAE.exe --reconfigurar` (ou `python rastreador_pae.py --reconfigurar`) e preencha o
   campo "Senha do robô (token)" com a mesma senha. (Faça isso em cada computador.)
3. No servidor da VPS, no `.env`, acrescente:
   ```
   ROBO_WEBAPP_URL=<a mesma URL do Web App, começa com https://script.google.com/...>
   ROBO_TOKEN=<a mesma senha>
   ```
   e reinicie o container (`docker compose up -d`). Sem isso o botão do sistema responde
   "O robô não está configurado no servidor".

### No sistema
Na tela de processos (Apoio e Suprimento) aparece uma faixa com o estado do robô (última execução,
erros, vigia ligado). O botão **Atualizar agora** (master/apoio) só fica ativo quando algum vigia está ligado.

---

## Rodar na VPS (sem PC ligado)

O PAE entra só com usuário e senha, então o robô pode rodar no servidor, sem tela, em modo vigia
(atende o botão "Atualizar agora" e roda nos horários). O PC/notebook passa a ser opcional —
se algum deles também estiver com o vigia ligado, o Apps Script garante que só um execute cada pedido.

**Arquivos novos desta pasta:** `Dockerfile`, `docker-compose.yml`, `.env.exemplo`.

### Passo a passo

1. Faça os passos de "Configuração única" acima (Apps Script com `TOKEN_ROBO` e nova versão publicada).
2. Copie esta pasta para a VPS, por exemplo para `/root/robo-pae/`
   (de preferência **sem** `__pycache__` e **sem** o `.env`). Pelo PowerShell do seu PC:
   ```
   scp -P 2222 -r C:\Users\Manuel\robo-pae-corrigido root@SEU_SERVIDOR:/root/robo-pae
   ```
3. Na VPS:
   ```
   cd /root/robo-pae
   cp .env.exemplo .env
   nano .env        # preencha ROBO_WEBAPP_URL, ROBO_TOKEN, PAE_USUARIO, PAE_SENHA (e o e-mail/horários, se quiser)
   chmod 600 .env
   docker compose up -d --build
   docker compose logs -f      # acompanhe; Ctrl+C sai dos logs sem parar o robô
   ```
4. Em até 1 minuto o sistema passa a mostrar "Vigia ligado em ..." na faixa do robô, e o botão
   "Atualizar agora" fica ativo. O primeiro teste: clique no botão e acompanhe os logs.

### Cuidados

- **Não coloque o `.env` nem esta pasta no GitHub** (o repositório do sistema é público; aqui ficam a senha do PAE e o token).
- A senha do PAE fica no servidor. Se a instituição permitir, prefira uma conta própria para o robô.
- A imagem do Playwright é grande (~1,5 GB) — confira o espaço em disco da VPS.
- Se o login falhar (senha errada/mudou), o sistema mostra "Robô PAE: falhou" com o motivo.
- Para ver o robô trabalhando no seu PC (com janela), continue usando `iniciar_vigia.bat` ou `python rastreador_pae.py`.
- O Dockerfile foi escrito sem poder ser testado aqui (sem Docker): se o `build` reclamar de algo, mande a mensagem.
