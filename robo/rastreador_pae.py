"""
Rastreador Automatizado PAE 4.1 - CBMPA / DAL
Versão Consolidada - Fluxo "Consulta Detalhada"
--------------------------------------------------------------------
Fluxo real do PAE 4.0 mapeado com o usuário:

1. Após abrir o PAE 4.0, clicar no ícone da sidebar "Consulta Detalhada"
   (3 traços horizontais + lupa) - feito 1x, antes do loop.
2. Na tela "Consulta Detalhada", clicar no botão verde "FILTRAR" (topo)
   para abrir o modal de busca.
3. Dentro do modal, preencher o campo "Protocolo" (placeholder "2022/22579")
   e clicar em "BUSCAR". O modal fecha sozinho.
4. O resultado aparece numa tabela na própria página, com colunas fixas:
   Nº do Protocolo | Arquivado | Setor Atual | Data Protocolo | Data Última Tramitação
   -> extrai Setor Atual (3ª coluna) e Data Última Tramitação (5ª coluna).
5. Se não encontrar, aparece a mensagem "Sem retorno".
6. Em ambos os casos (sucesso ou "Sem retorno"), o botão "FILTRAR" reaparece
   normalmente -> clicar nele de novo reabre o modal para o próximo protocolo.
7. O campo de Data/Período Protocolo já reseta sozinho a cada abertura do
   modal (não precisa limpar). O campo Protocolo, sim, precisa ser limpo
   manualmente a partir da 2ª consulta em diante.
"""

import asyncio
import datetime
import json
import os
import re
import socket
import sys
import time
from typing import Dict, List, Tuple
import requests
from playwright.async_api import async_playwright

from config_manager import is_configured, load_config, get_session_dir


def abrir_configuracao_inicial():
    """Abre a telinha de configuração (importa o tkinter só aqui - no servidor ele não existe)."""
    from setup_gui import abrir_configuracao_inicial as _abrir
    return _abrir()

# Modo servidor (Docker): sem janela, login automático com PAE_USUARIO/PAE_SENHA.
HEADLESS = os.environ.get("ROBO_HEADLESS", "") == "1"
PAE_USUARIO = os.environ.get("PAE_USUARIO", "").strip()
PAE_SENHA = os.environ.get("PAE_SENHA", "")

OUTPUT_REPORT_TXT = "relatorio_rastreamento_pae.txt"
OUTPUT_EMAIL_TXT = "email_relatorio_pae.txt"

# WEBAPP_URL, EMAIL_RELATORIO e USER_DATA_DIR não são mais fixos no código:
# são carregados de %APPDATA%\RastreadorPAE\config.json na função main(),
# perguntados ao usuário via tela de configuração na 1ª execução em cada PC.
# Rode "python rastreador_pae.py --reconfigurar" para trocar a planilha depois.


# ----------------------------------------------------------------------
# Utilitários de formatação
# ----------------------------------------------------------------------

def formatar_para_pae(pae_raw: str) -> Tuple[str, str]:
    """Retorna o formato com barra (ex: '2026/2617141') e os dígitos limpos (ex: '20262617141')."""
    pae_str = str(pae_raw).strip()
    matches = re.findall(r'(\d{4})[/-]?\s*(\d+)', pae_str)
    if matches:
        ano, num = matches[0]
        return f"{ano}/{num}", f"{ano}{num}"
    limpo = re.sub(r'\D', '', pae_str)
    return pae_str, limpo


def obter_pagina_pae(context):
    paginas = [p for p in context.pages if not p.is_closed()]
    if not paginas:
        return None
    for p in paginas:
        if "pae" in p.url.lower() and "governodigital" not in p.url.lower():
            return p
    for p in paginas:
        if "pae" in p.url.lower():
            return p
    return paginas[-1]


# ----------------------------------------------------------------------
# Robustez: esperas por condição, tentativas e comunicação com a planilha
# ----------------------------------------------------------------------

URL_PORTAL = "https://www.sistemas.pa.gov.br/governodigital/public/main/index.xhtml"
TIMEOUT_REDE = 60  # segundos, para falar com o Apps Script da planilha


def chamar_webapp(metodo: str, url: str, tentativas: int = 3, **kwargs):
    """
    GET/POST no Web App da planilha com timeout e novas tentativas. O Apps
    Script às vezes demora ou falha na primeira chamada (partida a frio) -
    antes, isso derrubava o robô logo no início e era preciso clicar de novo.
    """
    ultimo_erro = None
    for n in range(1, tentativas + 1):
        try:
            resp = requests.request(metodo, url, timeout=TIMEOUT_REDE, **kwargs)
            resp.raise_for_status()
            return resp.json()
        except Exception as e:
            ultimo_erro = e
            if n < tentativas:
                espera = 3 * n
                print(f"  [Aviso] Falha ao falar com a planilha ({e}). Nova tentativa em {espera}s...")
                time.sleep(espera)
    raise ultimo_erro


async def esperar_visivel(page, seletores, timeout_ms: int = 30000):
    """
    Espera ATÉ o timeout que algum dos seletores fique visível e devolve o
    locator. Antes o robô olhava a tela uma única vez, logo após uma espera
    fixa curta - se o PAE (Angular) ainda não tinha carregado, falhava.
    """
    limite = time.time() + timeout_ms / 1000
    while time.time() < limite:
        for sel in seletores:
            try:
                loc = page.locator(sel)
                if await loc.count() > 0 and await loc.first.is_visible():
                    return loc.first
            except Exception:
                pass
        try:
            await page.wait_for_timeout(500)
        except Exception:
            await asyncio.sleep(0.5)
    return None


def registrar_status(webapp_url: str, situacao: str, motivo: str = "", total: int = 0,
                     sucesso: int = 0, mudaram: int = 0, erros: int = 0, minutos: float = 0.0):
    """
    Avisa a planilha (aba ROBO_LOG) em que pé está o robô: EXECUTANDO,
    CONCLUIDO, INTERROMPIDO ou FALHOU. É só um registro - nunca derruba o robô.
    """
    try:
        chamar_webapp("POST", webapp_url, tentativas=2, json={
            "acao": "status_robo",
            "maquina": socket.gethostname(),
            "situacao": situacao,
            "motivo": motivo,
            "total": total,
            "sucesso": sucesso,
            "mudaram": mudaram,
            "erros": erros,
            "minutos": round(minutos, 1),
        })
    except Exception as e:
        print(f"  [Aviso] Não foi possível registrar o status do robô: {e}")


# ----------------------------------------------------------------------
# Passo 1 (1x): abrir a tela "Consulta Detalhada" via ícone da sidebar
# ----------------------------------------------------------------------

async def clicar_icone_consulta_detalhada(page) -> bool:
    """
    Clica 1x, no início, no ícone 'Consulta Detalhada' da sidebar
    (3 traços horizontais + lupa - Material Icon 'manage_search').
    """
    seletores = [
        "mat-icon:has-text('manage_search')",
        "[aria-label*='Consulta Detalhada' i]",
        "[title*='Consulta Detalhada' i]",
        "a:has-text('Consulta Detalhada')",
    ]
    # Espera (até 30s) o ícone aparecer - a sidebar do PAE pode demorar a carregar.
    alvo = await esperar_visivel(page, seletores, 30000)
    if alvo is not None:
        try:
            print("  -> Ícone 'Consulta Detalhada' encontrado.")
            await alvo.click()
            await page.wait_for_timeout(1200)
            return True
        except Exception as e:
            print(f"  [Aviso] Falha ao clicar no ícone: {e}")

    for sel in seletores:
        try:
            loc = page.locator(sel)
            if await loc.count() > 0 and await loc.first.is_visible():
                print(f"  -> Ícone 'Consulta Detalhada' encontrado via: {sel}")
                await loc.first.click()
                await page.wait_for_timeout(1200)
                return True
        except Exception:
            continue

    print("  [Aviso] Nenhum seletor direto funcionou. Tentando fallback posicional...")
    try:
        # Fallback: 4º ícone de baixo pra cima na sidebar, ignorando o ponto
        # verde de status. Ajuste o seletor de container caso o HTML real
        # da sidebar seja diferente.
        icones = page.locator(
            "nav >> visible=true >> button, nav >> visible=true >> a, "
            ".sidebar >> visible=true >> *[role='button']"
        )
        qtd = await icones.count()
        if qtd >= 4:
            indice_alvo = qtd - 4  # 4º contando de baixo pra cima
            await icones.nth(indice_alvo).click()
            await page.wait_for_timeout(1200)
            return True
    except Exception as e:
        print(f"  [Aviso] Fallback posicional falhou: {e}")

    print("  ❌ Não foi possível abrir 'Consulta Detalhada'.")
    return False


# ----------------------------------------------------------------------
# Passo 2 (a cada processo): abrir modal via botão FILTRAR
# ----------------------------------------------------------------------

async def clicar_botao_filtrar(page) -> bool:
    """Clica no botão verde 'FILTRAR' (topo da página) para abrir o modal de busca."""
    campo = page.get_by_placeholder("2022/22579")

    async def modal_aberto() -> bool:
        try:
            return await campo.count() > 0 and await campo.first.is_visible()
        except Exception:
            return False

    try:
        # Ao entrar na Consulta Detalhada o modal de busca costuma JÁ abrir sozinho
        # (e cobre o botão FILTRAR) - nesse caso não há nada a clicar.
        try:
            await campo.first.wait_for(state="visible", timeout=6000)
            return True
        except Exception:
            pass

        btn = await esperar_visivel(page, ["button:visible:has-text('FILTRAR')"], 20000)
        if btn is None:
            return await modal_aberto()
        try:
            await btn.click(timeout=8000)
        except Exception:
            # Clique barrado (outra janela por cima): se o modal já está aberto, está tudo certo.
            if await modal_aberto():
                return True
            raise
        await page.wait_for_timeout(800)
        # confirma que o modal abriu esperando o campo Protocolo aparecer
        await campo.first.wait_for(state="visible", timeout=10000)
        return True
    except Exception as e:
        print(f"  [Aviso] Falha ao abrir modal via FILTRAR: {e}")
    return await modal_aberto()


# ----------------------------------------------------------------------
# Passo 3 (a cada processo): preencher Protocolo e buscar
# ----------------------------------------------------------------------

async def preencher_protocolo_e_buscar(page, fmt_barra: str) -> bool:
    """Limpa o campo Protocolo (essencial da 2ª consulta em diante),
    digita o novo número e clica em BUSCAR."""
    try:
        campo = page.get_by_placeholder("2022/22579")
        await campo.click()

        # Limpeza robusta: seleciona tudo e apaga via teclado
        # (mais confiável que fill("") em campos Angular com máscara/binding)
        await page.keyboard.press("Control+A")
        await page.keyboard.press("Backspace")
        await page.wait_for_timeout(150)

        # Garante que realmente esvaziou; se não, força delete char a char
        valor_atual = await campo.input_value()
        if valor_atual:
            for _ in range(len(valor_atual) + 5):
                await page.keyboard.press("Backspace")
            await page.wait_for_timeout(100)

        await campo.type(fmt_barra, delay=35)
        await page.wait_for_timeout(200)

        btn_buscar = page.locator("button:visible:has-text('BUSCAR')")
        await btn_buscar.first.click()

        # espera o modal fechar (campo Protocolo some da tela após BUSCAR)
        await campo.wait_for(state="hidden", timeout=8000)
        return True
    except Exception as e:
        print(f"  [Aviso] Falha ao preencher/buscar protocolo: {e}")
        return False


# ----------------------------------------------------------------------
# Passo 4 (a cada processo): extrair resultado da tabela ou "Sem retorno"
# ----------------------------------------------------------------------

async def extrair_resultado_tabela(page) -> Dict[str, str]:
    """
    Aguarda um dos dois estados possíveis pós-busca:
      a) tabela de resultado com a linha do protocolo
      b) mensagem 'Sem retorno' (processo não encontrado)
    Extrai Setor Atual (3ª coluna) e Data Última Tramitação (5ª coluna).
    """
    resultado = {"setor_atual": "", "ultima_tramitacao": "", "encontrado": False, "sem_retorno": False}

    try:
        # espera até 8s por QUALQUER um dos dois estados aparecer
        await page.wait_for_function(
            """() => {
                const semRetorno = document.body.innerText.includes('Sem retorno');
                const linhas = document.querySelectorAll('table tbody tr');
                return semRetorno || linhas.length > 0;
            }""",
            timeout=8000
        )
    except Exception:
        print("  [Aviso] Timeout esperando resultado (nem tabela nem 'Sem retorno' apareceram).")
        return resultado

    msg_sem_retorno = page.get_by_text("Sem retorno", exact=False)
    if await msg_sem_retorno.count() > 0 and await msg_sem_retorno.first.is_visible():
        resultado["sem_retorno"] = True
        return resultado

    try:
        # Extração por NOME do cabeçalho (não por índice fixo). Isso evita
        # o bug de desalinhamento causado por colunas extras (ex: ícone de
        # "olho" ao lado do protocolo), que fazia o código pegar a coluna
        # "Arquivado" (valores "Sim"/"Não") em vez de "Setor Atual".
        headers = page.locator("table thead th")
        qtd_headers = await headers.count()
        idx_setor = None
        idx_tram = None

        for h in range(qtd_headers):
            texto_h = (await headers.nth(h).inner_text()).strip().lower()
            if "setor atual" in texto_h:
                idx_setor = h
            elif "última tramita" in texto_h or "ultima tramita" in texto_h:
                idx_tram = h

        linha_tabela = page.locator("table tbody tr")
        if await linha_tabela.count() > 0 and idx_setor is not None and idx_tram is not None:
            linha = linha_tabela.first
            celulas = linha.locator("td")
            setor = (await celulas.nth(idx_setor).inner_text()).strip()
            data_tram = (await celulas.nth(idx_tram).inner_text()).strip()
            resultado["setor_atual"] = setor
            resultado["ultima_tramitacao"] = data_tram
            resultado["encontrado"] = bool(setor)
        elif await linha_tabela.count() > 0:
            # Fallback: cabeçalho não localizado - avisa e usa índices fixos
            # antigos (2 e 4) só como último recurso, já sabendo que podem
            # estar desalinhados.
            print("  [Aviso] Cabeçalhos 'Setor Atual'/'Data Última Tramitação' não "
                  "localizados por nome. Usando índice fixo como fallback (risco de desalinhamento).")
            linha = linha_tabela.first
            celulas = linha.locator("td")
            if await celulas.count() >= 5:
                setor = (await celulas.nth(3).inner_text()).strip()
                data_tram = (await celulas.nth(5).inner_text()).strip()
                resultado["setor_atual"] = setor
                resultado["ultima_tramitacao"] = data_tram
                resultado["encontrado"] = bool(setor)
    except Exception as e:
        print(f"  [Aviso] Falha ao extrair tabela: {e}")

    return resultado


# ----------------------------------------------------------------------
# Orquestração da consulta de um único processo
# ----------------------------------------------------------------------

async def consultar_processo_modal(page, pae_raw: str) -> Dict[str, str]:
    fmt_barra, num_limpo = formatar_para_pae(pae_raw)

    resultado = {
        "pae": f"E-{fmt_barra}",
        "num_limpo": num_limpo,
        "setor_atual": "",
        "ultima_tramitacao": "",
        "status_consulta": "NÃO ENCONTRADO",
        "motivo": "",
    }

    if not num_limpo:
        resultado["status_consulta"] = "ERRO"
        resultado["motivo"] = "Número de processo inválido"
        return resultado

    try:
        await page.bring_to_front()

        # 1. Garante que o modal está aberto (se não estiver, abre)
        if await page.get_by_placeholder("2022/22579").count() == 0:
            abriu = await clicar_botao_filtrar(page)
            if not abriu:
                resultado["status_consulta"] = "ERRO"
                resultado["motivo"] = "Não foi possível abrir modal FILTRAR"
                return resultado

        # 2. Preenche e busca
        buscou = await preencher_protocolo_e_buscar(page, fmt_barra)
        if not buscou:
            resultado["status_consulta"] = "ERRO"
            resultado["motivo"] = "Falha ao preencher/buscar protocolo"
            return resultado

        # 3. Extrai da tabela (ou detecta "Sem retorno")
        extraido = await extrair_resultado_tabela(page)
        if extraido["encontrado"]:
            resultado["setor_atual"] = extraido["setor_atual"]
            resultado["ultima_tramitacao"] = extraido["ultima_tramitacao"]
            resultado["status_consulta"] = "SUCESSO"
        elif extraido["sem_retorno"]:
            resultado["status_consulta"] = "NÃO ENCONTRADO"
            resultado["motivo"] = "Sem retorno (protocolo não localizado no PAE)"
        else:
            resultado["status_consulta"] = "ERRO"
            resultado["motivo"] = "Nem tabela nem 'Sem retorno' apareceram (timeout)"

        # 4. Reabre o FILTRAR pra deixar pronto pro próximo protocolo
        #    (reaparece normalmente tanto em sucesso quanto em "Sem retorno")
        await clicar_botao_filtrar(page)

    except Exception as e:
        resultado["status_consulta"] = "ERRO"
        resultado["motivo"] = f"Falha RPA: {str(e)}"

    return resultado


# ----------------------------------------------------------------------
# Inicialização com tentativas automáticas (portal -> PAE 4.0 -> Consulta Detalhada)
# ----------------------------------------------------------------------

def opcoes_navegador() -> Dict:
    """Opções do Chrome: janela maximizada no PC; sem tela (headless) e com tamanho fixo no servidor."""
    args = ["--disable-blink-features=AutomationControlled"]
    if HEADLESS:
        args += ["--no-sandbox", "--disable-dev-shm-usage"]
        return {
            "headless": True,
            "args": args,
            "ignore_https_errors": True,
            "viewport": {"width": 1440, "height": 900},
            "locale": "pt-BR",
            "timezone_id": "America/Belem",
        }
    return {"headless": False, "args": ["--start-maximized"] + args, "ignore_https_errors": True}


async def tentar_login_automatico(page) -> bool:
    """
    Se o portal mostra o formulário de login (usuário/senha) e há credenciais
    configuradas (PAE_USUARIO/PAE_SENHA), preenche e entra. Devolve True se
    tentou entrar.
    """
    if not PAE_USUARIO or not PAE_SENHA:
        return False
    try:
        campo_usuario = page.locator('[id="form_login:login_username"]')
        if await campo_usuario.count() == 0 or not await campo_usuario.first.is_visible():
            return False
        print("Fazendo login no PAE com as credenciais configuradas...")
        await campo_usuario.first.fill(PAE_USUARIO)
        await page.locator('[id="form_login:login_password"]').first.fill(PAE_SENHA)
        await page.locator('[id="form_login:button_login"]').first.click()
        return True
    except Exception as e:
        print(f"  [Aviso] Falha no login automático: {e}")
        return False


async def abrir_pae(context, page, espera_login_s: int = 300):
    """
    Abre o portal, espera (de verdade) o card 'PAE 4.0' e o clica UMA vez.
    Se a sessão expirou, avisa e espera o login manual por até 5 minutos em
    vez de seguir adiante e falhar.
    """
    if HEADLESS:
        espera_login_s = 20  # no servidor ninguém pode fazer login manual
    seletores_cartao = ['text="PAE 4.0"', "a:has-text('PAE 4.0')", "div:has-text('PAE 4.0')"]
    seletores_entrar = ["button:has-text('Entrar')", "a:has-text('Entrar')", "input[value*='Entrar']"]

    await page.goto(URL_PORTAL, wait_until="domcontentloaded", timeout=60000)
    cartao = await esperar_visivel(page, seletores_cartao, 8000)

    # Sessão expirada/sem login: entra sozinho com usuário e senha.
    if cartao is None and await tentar_login_automatico(page):
        cartao = await esperar_visivel(page, seletores_cartao, 30000)

    if cartao is None:
        entrar = await esperar_visivel(page, seletores_entrar, 8000)
        if entrar is not None:
            print("Clicando no botão 'Entrar'...")
            await entrar.click()
            cartao = await esperar_visivel(page, seletores_cartao, 20000)

    if cartao is None:
        if HEADLESS:
            print("⚠️ Não encontrei o card 'PAE 4.0' nem consegui entrar. Confira PAE_USUARIO e PAE_SENHA.")
        else:
            print("⚠️ Não encontrei o card 'PAE 4.0'. Se o PAE pediu login, faça o login na janela "
                  f"do navegador - aguardando até {max(espera_login_s // 60, 1)} minutos...")
        cartao = await esperar_visivel(page, seletores_cartao, espera_login_s * 1000)

    if cartao is None:
        return None

    paginas_antes = set(context.pages)
    await cartao.click()

    # O PAE abre numa aba nova (ou na mesma): espera até 20s, SEM clicar de novo.
    page_pae = None
    limite = time.time() + 20
    while time.time() < limite:
        novas = [pg for pg in context.pages if pg not in paginas_antes and not pg.is_closed()]
        if novas:
            page_pae = novas[-1]
            break
        if "pae" in page.url.lower() and "governodigital" not in page.url.lower():
            page_pae = page
            break
        await asyncio.sleep(0.5)

    if page_pae is None:
        page_pae = obter_pagina_pae(context) or page
    await page_pae.bring_to_front()
    return page_pae


async def preparar_consulta(page_pae) -> bool:
    """Abre 'Consulta Detalhada' e deixa o modal FILTRAR pronto (campo Protocolo visível)."""
    if not await clicar_icone_consulta_detalhada(page_pae):
        return False
    return await clicar_botao_filtrar(page_pae)


async def iniciar_pae(context, page, tentativas: int = 4):
    """
    Faz a inicialização inteira, repetindo sozinho se algo não carregar:
    era esse o motivo de precisar clicar no robô várias vezes até ele começar.
    Devolve a página do PAE pronta para consultar, ou None.
    """
    for n in range(1, tentativas + 1):
        print(f"Iniciando acesso ao PAE (tentativa {n}/{tentativas})...")
        try:
            for extra in list(context.pages):
                if extra is not page and not extra.is_closed():
                    await extra.close()
            page_pae = await abrir_pae(context, page)
            if page_pae is not None and await preparar_consulta(page_pae):
                print("✅ PAE pronto para consulta.")
                return page_pae
        except Exception as e:
            print(f"  [Aviso] Falha na tentativa {n}: {e}")
        await asyncio.sleep(3)
    return None


async def recuperar_consulta(context, page, page_pae):
    """
    Chamada quando várias consultas seguidas falham (tela travada): recarrega
    a página do PAE e reabre Consulta Detalhada/FILTRAR; se não resolver,
    recomeça do portal. Devolve a página pronta, ou None.
    """
    try:
        await page_pae.reload(wait_until="domcontentloaded", timeout=60000)
        if await preparar_consulta(page_pae):
            return page_pae
    except Exception as e:
        print(f"  [Aviso] Recarregar a tela não resolveu: {e}")
    return await iniciar_pae(context, page, tentativas=2)


def tratar_resultado(proc: Dict, res: Dict, atualizacoes: List[Dict], mudancas_totais: List[Dict]) -> None:
    """Atualiza o processo com o resultado da consulta e separa os que mudaram de setor."""
    proc["status_consulta"] = res["status_consulta"]
    proc["motivo"] = res["motivo"]
    proc["pae"] = res["pae"]

    if res["status_consulta"] == "SUCESSO":
        proc["setor_atual"] = res["setor_atual"]
        proc["ultima_tramitacao"] = res["ultima_tramitacao"]

        if proc["setor_atual"] != proc["setor_anterior"]:
            # Só grava na planilha e entra no relatório quando o setor
            # realmente mudou; se não mudou, as colunas R/T ficam como estavam.
            proc["status_alteracao"] = "MUDOU DE SETOR"
            print(f"  -> 🔄 MUDOU DE SETOR: '{proc['setor_anterior']}' ➔ '{proc['setor_atual']}' ({proc['ultima_tramitacao']})")
            item_mudanca = {
                "linha": proc["linha"],
                "ordem": proc["ordem"],
                "pae": proc["pae"],
                "setor_anterior": proc["setor_anterior"],
                "setor_atual": proc["setor_atual"],
                "ultima_tramitacao": proc["ultima_tramitacao"],
            }
            atualizacoes.append(item_mudanca)
            mudancas_totais.append(item_mudanca)
        else:
            proc["status_alteracao"] = "SEM ALTERAÇÃO"
            print(f"  -> 🔁 SEM ALTERAÇÃO: '{proc['setor_atual']}' (planilha não alterada)")
    else:
        print(f"  -> ⚠️ {res['status_consulta']}: {res['motivo']}")


# ----------------------------------------------------------------------
# Relatório final
# ----------------------------------------------------------------------

def gerar_relatorio_final(todos_processos: List[Dict], tempo_minutos: float) -> str:
    total = len(todos_processos)
    sucesso = [p for p in todos_processos if p["status_consulta"] == "SUCESSO"]
    mudaram = [p for p in sucesso if p["status_alteracao"] == "MUDOU DE SETOR"]
    sem_alteracao = [p for p in sucesso if p["status_alteracao"] == "SEM ALTERAÇÃO"]
    erros = [p for p in todos_processos if p["status_consulta"] != "SUCESSO"]

    linhas = []
    linhas.append("📊 RESUMO GERAL")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    linhas.append(f"✅ Total de processos na planilha : {total}")
    linhas.append(f"✅ Consultados com sucesso         : {len(sucesso)}")
    linhas.append(f"🔄 Mudaram de setor               : {len(mudaram)}")
    linhas.append(f"🔁 Sem alteração de setor         : {len(sem_alteracao)}")
    linhas.append(f"⚠️ Não encontrados / com erro     : {len(erros)}")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    linhas.append(f"⏱️ Tempo total de execução       : {tempo_minutos:.1f} minutos")

    linhas.append("\n🔄 PROCESSOS QUE MUDARAM DE SETOR")
    linhas.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    linhas.append(f"| {'Ordem':<5} | {'Nº PAE':<16} | {'Setor Anterior':<22} | {'Setor Atual (novo)':<22} | {'Data Tramitação':<15} |")
    linhas.append(f"|{'-'*7}|{'-'*18}|{'-'*24}|{'-'*24}|{'-'*17}|")
    for m in mudaram:
        linhas.append(f"| {m['ordem']:<5} | {m['pae']:<16} | {m['setor_anterior'][:20]:<22} | {m['setor_atual'][:20]:<22} | {m['ultima_tramitacao']:<15} |")

    if erros:
        linhas.append("\n⚠️ PROCESSOS NÃO ENCONTRADOS OU COM ERRO")
        linhas.append("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
        linhas.append(f"| {'Ordem':<5} | {'Nº PAE':<16} | {'Motivo':<30} |")
        linhas.append(f"|{'-'*7}|{'-'*18}|{'-'*32}|")
        for e in erros:
            linhas.append(f"| {e['ordem']:<5} | {e['pae']:<16} | {e['motivo'][:28]:<30} |")

    return "\n".join(linhas)


def gerar_corpo_email(relatorio_texto: str) -> str:
    hoje_str = datetime.date.today().strftime("%d/%m/%Y")
    return "\n".join([
        "Manoel,",
        "",
        f"Segue o relatório da atualização automática dos processos PAE realizada em {hoje_str}.",
        "",
        relatorio_texto,
        "",
        "Atenciosamente,",
        "Assistente PAE - DAL/CBMPA"
    ])


# ----------------------------------------------------------------------
# Execução principal
# ----------------------------------------------------------------------

async def main():
    inicio = time.time()
    hoje_str = datetime.date.today().strftime("%d/%m/%Y")
    print("=" * 60)
    print(f"ROBÔ RPA PAE 4.1 - CBMPA / DAL ({hoje_str})")
    print("Fluxo: Consulta Detalhada > FILTRAR > BUSCAR > Tabela")
    print("=" * 60)

    # PASSO 0: Garante que existe configuração (planilha + e-mail).
    # Se for a 1ª execução neste PC (ou "--reconfigurar" foi passado),
    # abre a telinha pedindo a URL da planilha e o e-mail do relatório.
    if "--reconfigurar" in sys.argv or not is_configured():
        print("Abrindo tela de configuração inicial (URL da planilha + e-mail)...")
        abrir_configuracao_inicial()

    config = load_config()
    WEBAPP_URL = config.get("webapp_url", "")
    EMAIL_RELATORIO = config.get("email_relatorio", "sipcdal@gmail.com")
    USER_DATA_DIR = str(get_session_dir())

    if not WEBAPP_URL:
        print("❌ Nenhuma URL de planilha configurada. Encerrando.")
        return

    print("Conectando à planilha Google Sheets online...")
    try:
        res = chamar_webapp("GET", WEBAPP_URL)
        processos_brutos = res.get("processos", [])
    except Exception as e:
        print(f"❌ Erro ao conectar com o Google Sheets: {e}")
        return

    # Filtro estrito de processos válidos
    processos = []
    for p in processos_brutos:
        pae_str = str(p.get("pae", "")).strip()
        if re.search(r'\d{4}[/-]?\s*\d+', pae_str):
            p["status_consulta"] = "PENDENTE"
            p["status_alteracao"] = "PENDENTE"
            p["setor_atual"] = ""
            p["ultima_tramitacao"] = ""
            p["motivo"] = ""
            try:
                p["ordem_num"] = int(p["ordem"]) if str(p.get("ordem", "")).isdigit() else 0
            except ValueError:
                p["ordem_num"] = 0
            processos.append(p)

    if not processos:
        print("❌ Nenhum processo válido retornado da planilha.")
        return

    print(f"✅ Total exato de {len(processos)} processos carregados da planilha Google Sheets!")
    processos_ordenados = sorted(processos, key=lambda x: x["ordem_num"], reverse=True)
    registrar_status(WEBAPP_URL, "EXECUTANDO", total=len(processos))
    abortou = False
    motivo_falha = ""

    async with async_playwright() as p:
        try:
            context = await p.chromium.launch_persistent_context(
                USER_DATA_DIR,
                channel="chrome",
                **opcoes_navegador()
            )
        except Exception:
            context = await p.chromium.launch_persistent_context(
                USER_DATA_DIR,
                **opcoes_navegador()
            )

        page = context.pages[0] if context.pages else await context.new_page()

        # PASSOS 1-4: portal -> PAE 4.0 -> Consulta Detalhada -> FILTRAR.
        # Tudo com espera por condição e até 4 tentativas automáticas (se o
        # login expirou, espera você fazer o login na janela).
        page_pae = await iniciar_pae(context, page)
        if page_pae is None:
            print("❌ Não foi possível abrir o PAE depois de várias tentativas. Encerrando.")
            registrar_status(WEBAPP_URL, "FALHOU",
                             motivo="Não consegui abrir o PAE/Consulta Detalhada (login ou portal fora do ar)",
                             total=len(processos), minutos=(time.time() - inicio) / 60)
            await context.close()
            return

        # PASSO 5: Loop de consulta de todos os processos em blocos de 20
        # mudancas_totais acumula, durante toda a execução (todos os blocos),
        # apenas os processos que REALMENTE mudaram de setor -> usado pra
        # montar o relatório final enviado por e-mail.
        mudancas_totais = []
        erros_seguidos = 0

        tamanho_bloco = 20
        for i in range(0, len(processos_ordenados), tamanho_bloco):
            bloco = processos_ordenados[i:i + tamanho_bloco]
            num_bloco = (i // tamanho_bloco) + 1
            total_blocos = (len(processos_ordenados) + tamanho_bloco - 1) // tamanho_bloco
            print(f"\n--- Processando Bloco {num_bloco}/{total_blocos} ({len(bloco)} processos) ---")

            atualizacoes_bloco = []
            for proc in bloco:
                fmt, _ = formatar_para_pae(proc["pae"])
                print(f"Consultando Ordem {proc['ordem']} | E-{fmt}...")
                page_pae = obter_pagina_pae(context) or page_pae
                res = await consultar_processo_modal(page_pae, proc["pae"])
                tratar_resultado(proc, res, atualizacoes_bloco, mudancas_totais)

                # Várias falhas seguidas = a tela travou: recupera antes de seguir.
                erros_seguidos = erros_seguidos + 1 if res["status_consulta"] == "ERRO" else 0
                if erros_seguidos >= 3:
                    print("⚠️ 3 falhas seguidas - tentando recuperar a tela do PAE...")
                    page_pae = await recuperar_consulta(context, page, page_pae)
                    erros_seguidos = 0
                    if page_pae is None:
                        print("❌ Não foi possível recuperar o PAE. Interrompendo a rodada.")
                        abortou = True
                        motivo_falha = "O PAE travou e não foi possível recuperar a tela"
                        break

                await asyncio.sleep(1.0)

            # Gravação direta no Google Sheets - só dos que mudaram
            if atualizacoes_bloco:
                print(f"Gravando {len(atualizacoes_bloco)} mudança(s) de setor diretamente na planilha Google Sheets online...")
                try:
                    resp_post = chamar_webapp("POST", WEBAPP_URL, json={"atualizacoes": atualizacoes_bloco})
                    print(f"  -> Google Sheets atualizado: {resp_post}")
                except Exception as e:
                    print(f"  -> Aviso ao salvar: {e}")

            if abortou:
                break

        # Segunda passada: tenta de novo, uma vez, os que deram ERRO (timeout/tela travada).
        if not abortou:
            repetir = [pr for pr in processos_ordenados if pr["status_consulta"] == "ERRO"]
            if repetir:
                print(f"\n--- Segunda tentativa para {len(repetir)} processo(s) que deram erro ---")
                atualizacoes_retry: List[Dict] = []
                for proc in repetir:
                    fmt, _ = formatar_para_pae(proc["pae"])
                    print(f"Reconsultando Ordem {proc['ordem']} | E-{fmt}...")
                    page_pae = obter_pagina_pae(context) or page_pae
                    res = await consultar_processo_modal(page_pae, proc["pae"])
                    tratar_resultado(proc, res, atualizacoes_retry, mudancas_totais)
                    await asyncio.sleep(1.0)
                if atualizacoes_retry:
                    print(f"Gravando {len(atualizacoes_retry)} mudança(s) de setor da segunda tentativa...")
                    try:
                        resp_retry = chamar_webapp("POST", WEBAPP_URL, json={"atualizacoes": atualizacoes_retry})
                        print(f"  -> Google Sheets atualizado: {resp_retry}")
                    except Exception as e:
                        print(f"  -> Aviso ao salvar: {e}")

        await context.close()

    # PASSO 6: Envia por e-mail o relatório apenas dos processos que
    # mudaram de setor (via Apps Script -> MailApp, para o e-mail configurado)
    print(f"\nEnviando relatório de mudanças de setor por e-mail ({len(mudancas_totais)} processo(s))...")
    try:
        payload_email = {
            "acao": "enviar_relatorio",
            "destinatario": EMAIL_RELATORIO,
            "mudancas": mudancas_totais,
        }
        resp_email = chamar_webapp("POST", WEBAPP_URL, tentativas=1, json=payload_email)
        print(f"  -> Resposta do envio de e-mail: {resp_email}")
    except Exception as e:
        print(f"  -> Aviso ao enviar e-mail: {e}")

    tempo_total = (time.time() - inicio) / 60
    relatorio = gerar_relatorio_final(processos_ordenados, tempo_total)
    registrar_status(
        WEBAPP_URL,
        "INTERROMPIDO" if abortou else "CONCLUIDO",
        motivo=motivo_falha,
        total=len(processos_ordenados),
        sucesso=len([pr for pr in processos_ordenados if pr["status_consulta"] == "SUCESSO"]),
        mudaram=len(mudancas_totais),
        erros=len([pr for pr in processos_ordenados if pr["status_consulta"] != "SUCESSO"]),
        minutos=tempo_total,
    )
    corpo_email = gerar_corpo_email(relatorio)

    with open(OUTPUT_REPORT_TXT, "w", encoding="utf-8") as f_rep:
        f_rep.write(relatorio)

    with open(OUTPUT_EMAIL_TXT, "w", encoding="utf-8") as f_em:
        f_em.write(corpo_email)

    print("\n" + "=" * 60)
    print(relatorio)
    print("=" * 60)
    print(f"\n✅ Relatório na tela salvo em   : {OUTPUT_REPORT_TXT}")
    print(f"✅ Texto do e-mail salvo em     : {OUTPUT_EMAIL_TXT}")


# ----------------------------------------------------------------------
# Modo vigia (--vigiar): fica aberto em segundo plano, atende o botão
# "Atualizar agora" do sistema e roda nos horários agendados
# ----------------------------------------------------------------------

def _arquivo_estado_vigia() -> str:
    return os.path.join(str(get_session_dir().parent), "vigia_estado.json")


def _carregar_estado_vigia() -> Dict:
    try:
        with open(_arquivo_estado_vigia(), "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {}


def _salvar_estado_vigia(estado: Dict) -> None:
    try:
        with open(_arquivo_estado_vigia(), "w", encoding="utf-8") as f:
            json.dump(estado, f, ensure_ascii=False)
    except Exception as e:
        print(f"  [Aviso] Não foi possível salvar o estado do vigia: {e}")


def _chamar_script(url: str, token: str, acao: str, **dados) -> Dict:
    return chamar_webapp("POST", url, tentativas=2, json={"acao": acao, "token": token, **dados})


def vigiar() -> None:
    """
    Fica rodando (deixe a janela minimizada) e, a cada minuto:
      1. dá um sinal de vida na planilha (o sistema mostra "vigia ligado");
      2. vê se o sistema pediu uma atualização (botão "Atualizar agora");
      3. vê se chegou um horário agendado (config.json: "horarios", dias úteis).
    Só uma máquina executa cada pedido/horário (o Apps Script decide).
    O computador precisa estar ligado, com a sessão do Windows desbloqueada.
    """
    if not is_configured():
        abrir_configuracao_inicial()
    config = load_config()
    url = config.get("webapp_url", "")
    token = config.get("token_robo", "")
    horarios = config.get("horarios") or ["07:30", "12:30", "17:30"]
    maquina = socket.gethostname()

    if not url:
        print("❌ Nenhuma URL de planilha configurada. Encerrando.")
        return

    print("=" * 60)
    print(f"VIGIA DO ROBÔ PAE - {maquina}")
    print(f"Horários agendados (dias úteis): {', '.join(horarios)}")
    print("Deixe esta janela aberta (pode minimizar). Ctrl+C para sair.")
    print("=" * 60)

    while True:
        executar = ""
        try:
            _chamar_script(url, token, "sinal_vigia", maquina=maquina, estado="AGUARDANDO")

            pedido = chamar_webapp("GET", url, tentativas=1, params={"acao": "pedido", "token": token})
            if pedido.get("pendente"):
                if _chamar_script(url, token, "reivindicar_pedido", maquina=maquina).get("ok"):
                    executar = f"pedido do sistema ({pedido.get('quem') or 'sem nome'})"

            agora = datetime.datetime.now()
            if not executar and agora.weekday() < 5:
                hoje = agora.strftime("%Y-%m-%d")
                hm = agora.strftime("%H:%M")
                estado = _carregar_estado_vigia()
                feitos = [c for c in estado.get("horarios_feitos", []) if c.startswith(hoje)]
                vencidos = [h for h in horarios if hm >= h and f"{hoje} {h}" not in feitos]
                if vencidos:
                    # Se o vigia ligou tarde, roda uma vez só (marca todos os horários já vencidos).
                    for h in vencidos:
                        feitos.append(f"{hoje} {h}")
                    estado["horarios_feitos"] = feitos
                    _salvar_estado_vigia(estado)
                    chave = f"{hoje} {vencidos[-1]}"
                    if _chamar_script(url, token, "reivindicar_horario", maquina=maquina, chave=chave).get("ok"):
                        executar = f"horário agendado ({vencidos[-1]})"
        except Exception as e:
            print(f"[{datetime.datetime.now():%H:%M:%S}] Aviso no vigia: {e}")

        if executar:
            print(f"\n[{datetime.datetime.now():%d/%m %H:%M}] Iniciando atualização - {executar}")
            try:
                _chamar_script(url, token, "sinal_vigia", maquina=maquina, estado="EXECUTANDO")
            except Exception:
                pass
            try:
                asyncio.run(main())
            except Exception:
                import traceback
                traceback.print_exc()
            print("Atualização encerrada. Voltando a vigiar...")

        time.sleep(60)


if __name__ == "__main__":
    # Modo especial usado pelo instalador (Inno Setup) logo após a
    # instalação, para baixar o Chrome gerenciado pelo Playwright uma
    # única vez. O usuário final nunca precisa digitar isso manualmente.
    if "--instalar-navegador" in sys.argv:
        print("Baixando o navegador do Playwright (só acontece uma vez)...")
        from playwright.__main__ import main as playwright_cli_main
        sys.argv = ["playwright", "install", "chrome"]
        try:
            playwright_cli_main()
        except SystemExit:
            pass
        print("Navegador instalado com sucesso.")
        sys.exit(0)

    # Modo vigia: roda para sempre, sem pausa no fim.
    if "--vigiar" in sys.argv:
        try:
            vigiar()
        except KeyboardInterrupt:
            print("\nVigia encerrado.")
        sys.exit(0)

    # A partir daqui, SEMPRE deixa a janela aberta até o usuário apertar
    # Enter - mesmo se der erro, mesmo se fechar com duplo clique (não
    # via terminal). Sem isso, um erro faz a janela sumir instantaneamente
    # e ninguém consegue ler o que aconteceu.
    try:
        asyncio.run(main())
    except Exception:
        import traceback
        print("\n" + "=" * 60)
        print("❌ Ocorreu um erro inesperado. Detalhes abaixo:")
        print("=" * 60)
        traceback.print_exc()
    finally:
        input("\nPressione Enter para fechar esta janela...")
