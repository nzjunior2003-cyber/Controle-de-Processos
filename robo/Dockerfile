# Robô PAE em modo servidor (vigia sem tela) - para rodar na VPS sem PC ligado.
# A imagem oficial do Playwright já traz o Chromium e as dependências do sistema.
FROM mcr.microsoft.com/playwright/python:v1.49.1-noble

WORKDIR /app

# A versão do pacote precisa ser a mesma da imagem (v1.49.1) para achar o Chromium instalado nela.
RUN pip install --no-cache-dir --break-system-packages playwright==1.49.1 requests \
    || pip install --no-cache-dir playwright==1.49.1 requests

COPY config_manager.py setup_gui.py rastreador_pae.py ./

ENV TZ=America/Belem \
    ROBO_HEADLESS=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONIOENCODING=utf-8

# Fica vigiando: atende o botão "Atualizar agora" do sistema e roda nos horários (ROBO_HORARIOS).
CMD ["python", "rastreador_pae.py", "--vigiar"]
