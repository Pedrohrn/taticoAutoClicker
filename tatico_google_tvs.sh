#!/bin/bash

# garantindo o git
sudo apt update && sudo apt install git -y

EXTENSIONS_DIR="$HOME/tatico_extensions"
REPO_URL="https://github.com/Pedrohrn/taticoAutoClicker.git"
CONFIG_DIR="$HOME/.config/tatico-chrome"
CONFIG_FILE="$CONFIG_DIR/urls.conf"

mkdir -p "$CONFIG_DIR"
mkdir -p "$EXTENSIONS_DIR"

# dando permissão pro usuário do ubuntu gerenciar arquivos .git
sudo chown -R $(whoami):$(id -gn) "$EXTENSIONS_DIR/taticoAutoClicker" && cd "$EXTENSIONS_DIR/taticoAutoClicker" && (if [ -d .git ]; then git pull; else git clone "$REPO_URL" .; fi)

# criando o arquivo de configuracao com os valores padrao se for a primeira execucao
if [ ! -f "$CONFIG_FILE" ]; then
    echo "URL_PADARIA=\"https://app.powerbi.com/view?r=eyJrIjoiOTNkMGY3OGQtZjA0NC00MDE0LWI4N2UtN2FhZDllN2ZiNzY2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" > "$CONFIG_FILE"
    echo "URL_ACOUGUE=\"https://app.powerbi.com/view?r=eyJrIjoiYzBjNzRlNjUtY2FjOC00ZjM4LWExMDktMmU0OWE5MzY2NzQ2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" >> "$CONFIG_FILE"
    echo "NOME_LOJA=\"CAMPINAS\"" >> "$CONFIG_FILE"
fi

TIPO_TV=""
NOVA_URL=""
LOJA_INPUT=""

# parse seguro dos argumentos
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tv)
            TIPO_TV="$2"
            shift 2
            ;;
        --update)
            NOVA_URL="$2"
            shift 2
            ;;
        --loja)
            LOJA_INPUT="$2"
            shift 2
            ;;
        *)
            echo "erro: parametro invalido: $1"
            exit 1
            ;;
    esac
done

# valido se o parametro obrigatorio foi passado
if [ -z "$TIPO_TV" ]; then
    echo "Erro!!:  É necessário informar o tipo da tv com '--tv padaria' ou '--tv acougue'"
    exit 1
fi

# carrego as variaveis persistidas no disco
source "$CONFIG_FILE"

# atualizo o nome da loja no arquivo de configuracao usando sed
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
        echo "Erro: Tipo de tv inválido. Utilize 'padaria' ou 'acougue'."
        exit 1
    fi
fi

URL_ALVO=""
if [ "$TIPO_TV" = "padaria" ]; then
    URL_ALVO="$URL_PADARIA"
elif [ "$TIPO_TV" = "acougue" ]; then
    URL_ALVO="$URL_ACOUGUE"
else
    echo "Erro: Tipo de tv inválido."
    exit 1
fi

# detectando dinamicamente o binario do google chrome no ambiente - snap, deb/apt
CHROME_BIN=""
if command -v google-chrome &> /dev/null; then
    CHROME_BIN=$(command -v google-chrome)
elif command -v google-chrome-stable &> /dev/null; then
    CHROME_BIN=$(command -v google-chrome-stable)
elif [ -x "/snap/bin/google-chrome" ]; then
    CHROME_BIN="/snap/bin/google-chrome"
else
    echo "erro: binario do google chrome nao encontrado no sistema."
    exit 1
fi

pkill chrome || true

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/tatico-chrome.service"

mkdir -p "$SERVICE_DIR"

# criando o servico com o carminho correto do binario do chrome
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Tatico Auto Chrome Kiosk
After=graphical-session.target

[Service]
Type=simple
ExecStart=$CHROME_BIN --start-fullscreen --disable-infobars --no-first-run --load-extension="$EXTENSIONS_DIR/taticoAutoClicker" "$URL_ALVO"
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

# recarrego os daemons e aplico a inicializacao
systemctl --user daemon-reload
systemctl --user enable tatico-chrome.service
systemctl --user restart tatico-chrome.service

echo "Serviço configurado e reiniciado via systemd para tv $TIPO_TV (loja: ${NOME_LOJA:-CAMPINAS})"
