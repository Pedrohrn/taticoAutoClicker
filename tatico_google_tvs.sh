#!/bin/bash

# instalacao de dependencias necessarias do sistema
sudo apt update && sudo apt install git -y

EXTENSIONS_DIR="$HOME/tatico_extensions"
REPO_URL="https://github.com/Pedrohrn/taticoAutoClicker.git"
CONFIG_DIR="$HOME/.config/tatico-chrome"
CONFIG_FILE="$CONFIG_DIR/urls.conf"

mkdir -p "$CONFIG_DIR"
mkdir -p "$EXTENSIONS_DIR"

# clone ou pull dinamico da extensao atualizada
if [ ! -d "$EXTENSIONS_DIR/taticoAutoClicker" ]; then
    git clone "$REPO_URL" "$EXTENSIONS_DIR/taticoAutoClicker"
else
    cd "$EXTENSIONS_DIR/taticoAutoClicker" && git pull
fi

# inicializo o arquivo de configuracao com urls padrao caso primeira execucao
if [ ! -f "$CONFIG_FILE" ]; then
    echo "URL_PADARIA=\"https://app.powerbi.com/view?r=eyJrIjoiOTNkMGY3OGQtZjA0NC00MDE0LWI4N2UtN2FhZDllN2ZiNzY2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" > "$CONFIG_FILE"
    echo "URL_ACOUGUE=\"https://app.powerbi.com/view?r=eyJrIjoiYzBjNzRlNjUtY2FjOC00ZjM4LWExMDktMmU0OWE5MzY2NzQ2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" >> "$CONFIG_FILE"
    echo "NOME_LOJA=\"CAMPINAS\"" >> "$CONFIG_FILE"
fi

TIPO_TV=""
NOVA_URL=""
LOJA_INPUT=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tv) TIPO_TV="$2"; shift ;;
        --update) NOVA_URL="$2"; shift ;;
        --loja) LOJA_INPUT="$2"; shift ;;
        *) echo "Parametro invalido: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TIPO_TV" ]; then
    echo "Erro: E necessario informar o Tipo da TV com '--tv <padaria|acougue>'"
    exit 1
fi

source "$CONFIG_FILE"

if [ -n "$LOJA_INPUT" ]; then
    sed -i 's|^NOME_LOJA=.*|NOME_LOJA="'"$LOJA_INPUT"'"|' "$CONFIG_FILE"
    NOME_LOJA="$LOJA_INPUT"
fi

if [ -n "$NOVA_URL" ]; then
    if [ "$TIPO_TV" = "padaria" ]; then
        sed -i 's|^URL_PADARIA=.*|URL_PADARIA="'"$NOVA_URL"'"|' "$CONFIG_FILE"
        URL_PADARIA="$NOVA_URL"
    elif [ "$TIPO_TV" = "acougue" ]; then
        sed -i 's|^URL_ACOUGUE=.*|URL_ACOUGUE="'"$NOVA_URL"'"|' "$CONFIG_FILE"
        URL_ACOUGUE="$NOVA_URL"
    else
        echo "Tipo de TV invalido. Utilize 'padaria' ou 'acougue'."
        exit 1
    fi
fi

URL_ALVO=""
if [ "$TIPO_TV" = "padaria" ]; then
    URL_ALVO="$URL_PADARIA"
elif [ "$TIPO_TV" = "acougue" ]; then
    URL_ALVO="$URL_ACOUGUE"
fi

# encerro instancias anteriores do chrome para aplicar novas extensoes e flags
pkill chrome || true

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/tatico-chrome.service"

mkdir -p "$SERVICE_DIR"

# crio o servico no systemd passando a flag para carregar a extensao do diretorio local
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Tatico Auto Chrome Kiosk
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/google-chrome --start-fullscreen --disable-infobars --no-first-run --load-extension="$EXTENSIONS_DIR/taticoAutoClicker" "$URL_ALVO"
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

# aplico as novas regras no systemd e reinicio o processo
systemctl --user daemon-reload
systemctl --user enable tatico-chrome.service
systemctl --user restart tatico-chrome.service

echo "Daemon configurado com sucesso para a TV $TIPO_TV (Loja: ${NOME_LOJA:-CAMPINAS}). Chrome reiniciado."
