# !/bin/bash

CONFIG_DIR="$HOME/.config/tatico-chrome"
CONFIG_FILE="$CONFIG_DIR/urls.conf"

# crio o diretorio de configuracao local para armazenar as urls persistentes
mkdir -p "$CONFIG_DIR"

# inicializo o arquivo de configuracao com urls padrao caso eu esteja rodando pela primeira vez
if [ ! -f "$CONFIG_FILE" ]; then
    echo "URL_PADARIA=\"https://app.powerbi.com/view?r=LINK_PADARIA\"" > "$CONFIG_FILE"
    echo "URL_ACOUGUE=\"https://app.powerbi.com/view?r=LINK_ACOUGUE\"" >> "$CONFIG_FILE"
fi

TIPO_TV=""
NOVA_URL=""

# percorro os argumentos passados na execucao para capturar minhas variaveis de execucao e url
while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tv) TIPO_TV="$2"; shift ;;
        --update) NOVA_URL="$2"; shift ;;
        *) echo "parametro invalido: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TIPO_TV" ]; then
    echo "uso obrigatorio de parametro: --tv <padaria|acougue>"
    exit 1
fi

# carrego as variaveis salvas no meu arquivo config para a memoria do script
source "$CONFIG_FILE"

# se passei uma nova url, atualizo a config para o tipo de tv escolhido usando sed
if [ -n "$NOVA_URL" ]; then
    if [ "$TIPO_TV" = "padaria" ]; then
        sed -i 's|^URL_PADARIA=.*|URL_PADARIA="'"$NOVA_URL"'"|' "$CONFIG_FILE"
        URL_PADARIA="$NOVA_URL"
    elif [ "$TIPO_TV" = "acougue" ]; then
        sed -i 's|^URL_ACOUGUE=.*|URL_ACOUGUE="'"$NOVA_URL"'"|' "$CONFIG_FILE"
        URL_ACOUGUE="$NOVA_URL"
    else
        echo "tipo de tv invalido para atualizacao. utilize 'padaria' ou 'acougue'."
        exit 1
    fi
    echo "atualizei a url da tv $TIPO_TV no arquivo de configuracao."
fi

URL_ALVO=""

# defino qual url sera injetada no daemon baseando-se na tv que escolhi rodar
if [ "$TIPO_TV" = "padaria" ]; then
    URL_ALVO="$URL_PADARIA"
elif [ "$TIPO_TV" = "acougue" ]; then
    URL_ALVO="$URL_ACOUGUE"
else
    echo "tipo de tv invalido. utilize 'padaria' ou 'acougue'."
    exit 1
fi

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/tatico-chrome.service"

echo "configurando daemon de controle do chrome kiosk para $TIPO_TV..."

# crio os diretorios necessarios do systemd do meu usuario atual caso nao existam
mkdir -p "$SERVICE_DIR"

# crio e injeto o arquivo de servico
# as diretivas restart garantem o meu keep-alive
cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Tatico Auto Chrome Kiosk
After=graphical-session.target

[Service]
Type=simple
ExecStart=/usr/bin/google-chrome --start-fullscreen --disable-infobars --no-first-run "$URL_ALVO"
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

# aplico as novas regras ao systemd e dou boot no meu processo
systemctl --user daemon-reload
# ativo o servico no meu usuario
systemctl --user enable tatico-chrome.service
# reinicio o servico para aplicar a url recem configurada
systemctl --user restart tatico-chrome.service

echo "daemon configurado e chrome inicializado na tv $TIPO_TV."

curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv padaria


curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv acougue --update "https://nova-url-do-powerbi-aqui"
