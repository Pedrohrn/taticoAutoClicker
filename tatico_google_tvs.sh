#!/bin/bash

# preencha aqui os urls que deverao abrir com o sistema separados por espaco
# caso forms usar as configuracoes do proprio chrome pra reabrir abas fechadas, deixe apenas URLs=""
URLS="https://app.powerbi.com/view?r=LINK_PADARIA https://app.powerbi.com/view?r=LINK_ACOUGUE"

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/tatico-chrome.service"

echo "Configurando daemon de controle do Chrome Kiosk..."

# criando os diretorios necessariso do systemd do usuario atual caso nao existam
mkdir -p "$SERVICE_DIR"

# criando e injetando o arquivo de servico
# as diretivas restart garantem o keep-alive
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Tatico Auto Chrome Kiosk
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/google-chrome --start-fullscreen --disable-infobars --no-first-run $URLS
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

# aplico as novas regras ao systemd e dou boot no processo
systemctl --user daemon-reload
# ativando o servico
systemctl --user enable tatico-chrome.service
# reiniciando o servico - em caso de alteracao no codigo e afins
systemctl --user restart tatico-chrome.service

echo "Daemon configurado. O Chrome foi inicializado e tornou-se persistente contra crash ou fechamento manual."
