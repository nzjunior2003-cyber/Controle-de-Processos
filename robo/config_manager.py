"""
Gerenciador de configuração do Rastreador PAE.

Guarda a configuração de cada usuário (URL da planilha/Web App, e-mail do
relatório) e a sessão de login do Chrome numa pasta padrão do Windows
(%APPDATA%\\RastreadorPAE), separada da pasta do programa. Isso permite
distribuir o mesmo programa pra vários PCs/colegas, cada um com sua própria
planilha e seu próprio login salvo, sem misturar dados entre usuários.
"""

import json
import os
from pathlib import Path

APP_NAME = "RastreadorPAE"

DEFAULT_CONFIG = {
    "webapp_url": "",
    "email_relatorio": "sipcdal@gmail.com",
}


def get_config_dir() -> Path:
    """Retorna a pasta de configuração do usuário atual (cria se não existir)."""
    base = os.environ.get("APPDATA") or str(Path.home())
    config_dir = Path(base) / APP_NAME
    config_dir.mkdir(parents=True, exist_ok=True)
    return config_dir


def get_config_path() -> Path:
    return get_config_dir() / "config.json"


def get_session_dir() -> Path:
    """Pasta onde fica salva a sessão de login do Chrome (persistente por usuário do Windows)."""
    session_dir = get_config_dir() / "chrome_session"
    session_dir.mkdir(parents=True, exist_ok=True)
    return session_dir


def _config_do_ambiente() -> dict:
    """
    Variáveis de ambiente que sobrepõem o config.json — é como o robô roda no
    servidor (Docker), sem tela de configuração:
      ROBO_WEBAPP_URL, ROBO_EMAIL_RELATORIO, ROBO_TOKEN, ROBO_HORARIOS ("08:00,14:00").
    """
    cfg = {}
    if os.environ.get("ROBO_WEBAPP_URL", "").strip():
        cfg["webapp_url"] = os.environ["ROBO_WEBAPP_URL"].strip()
    if os.environ.get("ROBO_EMAIL_RELATORIO", "").strip():
        cfg["email_relatorio"] = os.environ["ROBO_EMAIL_RELATORIO"].strip()
    if os.environ.get("ROBO_TOKEN", "").strip():
        cfg["token_robo"] = os.environ["ROBO_TOKEN"].strip()
    horarios = [h.strip() for h in os.environ.get("ROBO_HORARIOS", "").split(",") if h.strip()]
    if horarios:
        cfg["horarios"] = horarios
    return cfg


def load_config() -> dict:
    path = get_config_path()
    base = {}
    if path.exists():
        try:
            with open(path, "r", encoding="utf-8") as f:
                base = json.load(f)
        except Exception:
            base = {}
    return {**base, **_config_do_ambiente()}


def save_config(config: dict) -> None:
    path = get_config_path()
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)


def is_configured() -> bool:
    cfg = load_config()
    return bool(cfg.get("webapp_url", "").strip())
