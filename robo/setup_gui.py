"""
Tela de configuração inicial do Rastreador PAE.

Aparece só na primeira execução em cada PC (ou quando o usuário pede pra
reconfigurar). Pede a URL do Web App (Apps Script) da planilha que vai ser
usada como base de dados, e o e-mail que vai receber o relatório de
mudanças de setor. Depois de salvar, o próprio robô cuida de abrir o
navegador para o login manual no PAE (usuário/senha, certificado ou
gov.br - o que a pessoa usar normalmente).
"""

import tkinter as tk
from tkinter import messagebox

from config_manager import load_config, save_config, DEFAULT_CONFIG


def abrir_configuracao_inicial() -> dict:
    """
    Abre uma janela simples pedindo a URL da planilha (Web App) e o
    e-mail de destino do relatório. Bloqueia a execução até o usuário
    salvar. Retorna o config salvo.
    """
    config_atual = load_config() or dict(DEFAULT_CONFIG)

    janela = tk.Tk()
    janela.title("Configuração Inicial - Rastreador PAE")
    janela.geometry("540x370")
    janela.resizable(False, False)

    tk.Label(
        janela,
        text="Configuração Inicial do Rastreador PAE",
        font=("Segoe UI", 13, "bold")
    ).pack(pady=(16, 4))

    tk.Label(
        janela,
        text="Preencha os dados abaixo. Isso só é pedido na primeira vez neste PC.",
        font=("Segoe UI", 9),
        fg="#555555"
    ).pack(pady=(0, 16))

    frame = tk.Frame(janela)
    frame.pack(fill="x", padx=24)

    tk.Label(frame, text="URL do Web App (Google Apps Script) da planilha:", anchor="w").pack(fill="x")
    entrada_url = tk.Entry(frame, width=64)
    entrada_url.insert(0, config_atual.get("webapp_url", ""))
    entrada_url.pack(fill="x", pady=(2, 12))

    tk.Label(frame, text="E-mail para receber o relatório de mudanças de setor:", anchor="w").pack(fill="x")
    entrada_email = tk.Entry(frame, width=64)
    entrada_email.insert(0, config_atual.get("email_relatorio", "sipcdal@gmail.com"))
    entrada_email.pack(fill="x", pady=(2, 12))

    tk.Label(frame, text="Senha do robô (token) - só se o sistema/Apps Script pedir:", anchor="w").pack(fill="x")
    entrada_token = tk.Entry(frame, width=64, show="*")
    entrada_token.insert(0, config_atual.get("token_robo", ""))
    entrada_token.pack(fill="x", pady=(2, 12))

    resultado = {}

    def salvar():
        url = entrada_url.get().strip()
        email = entrada_email.get().strip()

        if not url.startswith("https://script.google.com"):
            messagebox.showerror(
                "URL inválida",
                "A URL do Web App deve começar com:\n"
                "https://script.google.com\n\n"
                "Copie o link de implantação (Deploy) do Apps Script da planilha."
            )
            return

        if "@" not in email or "." not in email:
            messagebox.showerror("E-mail inválido", "Digite um e-mail válido para receber o relatório.")
            return

        # Preserva o que já estava no config.json (ex.: "horarios") e acrescenta o token.
        novo_config = {**load_config(), "webapp_url": url, "email_relatorio": email,
                       "token_robo": entrada_token.get().strip()}
        save_config(novo_config)
        resultado.update(novo_config)
        janela.destroy()

    tk.Button(
        janela, text="Salvar e Continuar", command=salvar,
        bg="#1e8449", fg="white", font=("Segoe UI", 10, "bold"),
        padx=16, pady=8
    ).pack(pady=(8, 4))

    tk.Label(
        janela,
        text="Depois de salvar, o navegador vai abrir para você fazer login no PAE\n"
             "(usuário/senha, certificado digital ou gov.br - o que você usar normalmente).\n"
             "Isso só precisa ser feito uma vez; a sessão fica salva neste PC.",
        font=("Segoe UI", 8), fg="#777777", justify="center"
    ).pack(pady=(10, 0))

    janela.protocol("WM_DELETE_WINDOW", lambda: (_ for _ in ()).throw(SystemExit(
        "Configuração cancelada pelo usuário. O robô não pode rodar sem a URL da planilha."
    )))

    janela.mainloop()
    return resultado
