# !/bin/bash

# baixando o git
sudo apt update && sudo apt install git -y

# criando o diretório tatico_extensions
# sudo mkdir ~/tatico_extensions && cd ~/tatico_extensions

# baixando a extensao 
# git clone https://github.com/Pedrohrn/taticoAutoClicker.git

CONFIG_DIR="$HOME/.config/tatico-chrome"
CONFIG_FILE="$CONFIG_DIR/urls.conf"

# crio o diretorio de configuracao local para armazenar as urls persistentes
mkdir -p "$CONFIG_DIR"

# inicializo o arquivo de configuracao com urls padrao caso eu esteja rodando pela primeira vez
if [ ! -f "$CONFIG_FILE" ]; then
    echo "URL_PADARIA=\"https://app.powerbi.com/view?r=eyJrIjoiOTNkMGY3OGQtZjA0NC00MDE0LWI4N2UtN2FhZDllN2ZiNzY2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" > "$CONFIG_FILE"
    echo "URL_ACOUGUE=\"https://app.powerbi.com/view?r=eyJrIjoiYzBjNzRlNjUtY2FjOC00ZjM4LWExMDktMmU0OWE5MzY2NzQ2IiwidCI6IjM2ODY2NjVlLTM3YjItNDBjNi05OTM1LTJkMzFkZmMwMThlNiJ9&embedImagePlaceholder=true\"" >> "$CONFIG_FILE"
fi

TIPO_TV=""
NOVA_URL=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --tv) TIPO_TV="$2"; shift ;;
        --update) NOVA_URL="$2"; shift ;;
        *) echo "parametro invalido: $1"; exit 1 ;;
    esac
    shift
done

if [ -z "$TIPO_TV" ]; then
    echo "É necessário informar o Tipo da TV: --tv <padaria|acougue>"
    echo "Execute o comando novamente com "--tv tipo_tv"; sendo tipo_tv = "acougue" ou "padaria"
    exit 1
fi

# carregando as variaveis salvas no arquivo de configuracao
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
        echo "Tipo de TV inválido. Utilize 'padaria' ou 'acougue'."
        exit 1
    fi
    echo "URL do PowerBI da TV $TIPO_TV atualizado."
fi

URL_ALVO=""

if [ "$TIPO_TV" = "padaria" ]; then
    URL_ALVO="$URL_PADARIA"
elif [ "$TIPO_TV" = "acougue" ]; then
    URL_ALVO="$URL_ACOUGUE"
else
    echo "Tipo de TV inválido. Utilize 'padaria' ou 'acougue'."
    exit 1
fi

SERVICE_DIR="$HOME/.config/systemd/user"
SERVICE_FILE="$SERVICE_DIR/tatico-chrome.service"

echo "Criando serviço daemon de controle do chrome para $TIPO_TV..."

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
RestartSec=20
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

# aplico as novas regras ao systemd e inicio o serviço
systemctl --user daemon-reload
# ativo o servico no meu usuario
systemctl --user enable tatico-chrome.service
# reinicio o servico para aplicar a url recem configurada
systemctl --user restart tatico-chrome.service

echo "daemon configurado e chrome inicializado na tv $TIPO_TV."

# curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv padaria


# curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv acougue --update "https://nova-url-do-powerbi-aqui"
