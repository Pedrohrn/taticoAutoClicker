#!/bin/bash

# ==============================================================================
# Tatico TV Kiosk Manager
# Configura o ambiente, aliases e instala/atualiza a extensão Tatico AutoClicker
# ==============================================================================

# Dependências necessárias: git, curl, jq
if ! command -v jq &> /dev/null; then
    echo "Instalando jq para manipulação de JSON..."
    sudo apt-get update && sudo apt-get install -y jq
fi
if ! command -v git &> /dev/null; then
    echo "Instalando git..."
    sudo apt-get update && sudo apt-get install -y git
fi

EXTENSIONS_DIR="$HOME/tatico_extensions"
REPO_DIR="$EXTENSIONS_DIR/taticoAutoClicker"
REPO_URL="https://github.com/Pedrohrn/taticoAutoClicker.git"
SYSTEMD_USER_DIR="$HOME/.config/systemd/user"
SERVICE_NAME="tatico-chrome.service"

mkdir -p "$EXTENSIONS_DIR"

function _get_chrome_bin() {
    if command -v google-chrome &> /dev/null; then
        echo "google-chrome"
    elif command -v google-chrome-stable &> /dev/null; then
        echo "google-chrome-stable"
    elif [ -x "/snap/bin/google-chrome" ]; then
        echo "/snap/bin/google-chrome"
    else
        echo ""
    fi
}

function timeout_terminal() {
    local SECONDS=15
    echo -n "Operação concluída com sucesso. "
    while [ $SECONDS -gt 0 ]; do
        echo -ne "\rTerminal fechando em $SECONDS segundos... (Pressione qualquer tecla para cancelar) "
        if read -t 1 -n 1; then
            echo -e "\nFechamento cancelado."
            return
        fi
        ((SECONDS--))
    done
    echo -e "\nTerminal fechando agora."
    kill -9 $PPID
}

function instalar_tk() {
    if [ -d "$REPO_DIR" ]; then
        echo "Diretório encontrado. Atualizando o repositório..."
        cd "$REPO_DIR" || return 1
        git pull
    else
        echo "Diretório não encontrado. Clonando o repositório..."
        git clone "$REPO_URL" "$REPO_DIR"
    fi

    # Lógica iterativa para capturar tipo de TV e loja
    while true; do
        read -p "Qual é o tipo de TV? (1 - Padaria, 2 - Açougue): " TIPO_IN
        if [[ "$TIPO_IN" == "1" || "$TIPO_IN" == "2" ]]; then
            break
        else
            echo "Opção inválida. Tente novamente."
        fi
    done

    while true; do
        read -p "Qual é a loja? (1- CENTRO, 2- GARAVELO, 3- T7, 4- CAMPINAS, 5- PORTAL, 6- PAPILLON): " LOJA_IN
        case "$LOJA_IN" in
            1) NOME_LOJA="CENTRO"; break ;;
            2) NOME_LOJA="GARAVELO"; break ;;
            3) NOME_LOJA="T7"; break ;;
            4) NOME_LOJA="CAMPINAS"; break ;;
            5) NOME_LOJA="PORTAL"; break ;;
            6) NOME_LOJA="PAPILLON"; break ;;
            *) echo "Opção inválida. Tente novamente." ;;
        esac
    done

    local TARGET_JSON="$REPO_DIR/config.json"
    local SAMPLE_JSON="$REPO_DIR/sample_config.json"

    if [ ! -f "$SAMPLE_JSON" ]; then
        echo "Erro: sample_config.json não encontrado no repositório."
        return 1
    fi

    # Mapeamento do Perfil Base (1=Padaria, 2=Açougue)
    local PERFIL_NOME=""
    if [ "$TIPO_IN" == "1" ]; then
        PERFIL_NOME="TVS Padaria"
    else
        PERFIL_NOME="TVs Açougue"
    fi
    local TIPO_TV_FORMATTED=$(echo "$PERFIL_NOME" | awk '{print toupper($2)}') # Pega a segunda palavra em caixa alta
    local NOME_ROTINA="$TIPO_TV_FORMATTED $NOME_LOJA"

    echo "Gerando config.json a partir de sample_config.json..."

    # Extrai o ID do perfil dinamicamente pelo nome
    local PERFIL_ID=$(jq -r ".perfis[] | select(.nome == \"$PERFIL_NOME\") | .id" "$SAMPLE_JSON")

    # jq magic para adaptar a rotina modelo ao contexto atual
    jq "
        .rotinaAtualNome = \"$NOME_ROTINA\" |
        (.rotinas[0]) |= (
            .nome = \"$NOME_ROTINA\" |
            .perfil_id = \"$PERFIL_ID\" |
            .autorefresh_ativo = true |
            .autorefresh_min = 60 |
            .passos_avancados[1].parada_seletor = \"$NOME_LOJA\"
        )
    " "$SAMPLE_JSON" > "$TARGET_JSON"

    echo "config.json gerado com sucesso."

    _gerar_systemd
    timeout_terminal
}

function atualizar_tk() {
    if [ -d "$REPO_DIR" ]; then
        echo "Atualizando extensão via git pull (preservando config.json)..."
        cd "$REPO_DIR" || return 1
        # stasha configuracoes locais pra n dar conflito e restaura depois do pull
        git stash push config.json
        git pull
        git stash pop
        echo "Extensão atualizada."
        timeout_terminal
    else
        echo "Erro: Repositório não encontrado. Execute instalar_tk primeiro."
    fi
}

function configurar_tk() {
    local TIPO_TV=""
    local LOJA=""
    local LINK=""

    while [[ "$#" -gt 0 ]]; do
        case $1 in
            --tipo_tv) TIPO_TV="$2"; shift 2;;
            --loja) LOJA="$2"; shift 2;;
            --link) LINK="$2"; shift 2;;
            *) echo "Erro: Parâmetro desconhecido: $1"; return 1;;
        esac
    done

    if [[ -n "$LINK" && -z "$TIPO_TV" ]]; then
        echo "Erro estrito: A flag --link requer obrigatoriamente a flag --tipo_tv <padaria|acougue>."
        return 1
    fi

    local TARGET_JSON="$REPO_DIR/config.json"
    if [ ! -f "$TARGET_JSON" ]; then
        echo "Erro: config.json não encontrado. Execute instalar_tk primeiro."
        return 1
    fi

    if [[ -n "$LINK" && -n "$TIPO_TV" ]]; then
        local NOME_ALVO=""
        if [ "$TIPO_TV" == "padaria" ]; then
            NOME_ALVO="TVS Padaria"
        elif [ "$TIPO_TV" == "acougue" ]; then
            NOME_ALVO="TVs Açougue"
        else
            echo "Erro: --tipo_tv deve ser 'padaria' ou 'acougue'."
            return 1
        fi

        # jq pra substituir dinamicamente o link no array
        jq "( .perfis[] | select(.nome == \"$NOME_ALVO\") | .urls_alvo[0] ) = \"$LINK\"" "$TARGET_JSON" > "${TARGET_JSON}.tmp" && mv "${TARGET_JSON}.tmp" "$TARGET_JSON"
        echo "Link atualizado para a TV $TIPO_TV."
    fi

    if [[ -n "$LOJA" ]]; then
        # jq pra alterar o nome da loja na condicao do passo e compor novo titulo da rotina
        jq "
            (.rotinas[0].passos_avancados[1].parada_seletor) = \"$LOJA\" |
            (.rotinas[0].nome) |= sub(\" [A-Z0-9]+$\"; \" $LOJA\") |
            .rotinaAtualNome = .rotinas[0].nome
        " "$TARGET_JSON" > "${TARGET_JSON}.tmp" && mv "${TARGET_JSON}.tmp" "$TARGET_JSON"
        echo "Loja atualizada para $LOJA na rotina alvo."
    fi

    timeout_terminal
}

function pausar_tk() {
    systemctl --user stop "$SERVICE_NAME"
    echo "Serviço systemd do Kiosk pausado. O Chrome/Extensão continuam rodando caso abertos manualmente."
    timeout_terminal
}

function resumir_tk() {
    systemctl --user start "$SERVICE_NAME"
    echo "Serviço systemd do Kiosk retomado."
    timeout_terminal
}

function reiniciar_tk() {
    pkill chrome || true
    systemctl --user restart "$SERVICE_NAME"
    local PID=$(systemctl --user show -p MainPID --value "$SERVICE_NAME")
    echo "Serviço reiniciado. Main PID: $PID"
    timeout_terminal
}

function _gerar_systemd() {
    local CHROME_BIN=$(_get_chrome_bin)
    if [ -z "$CHROME_BIN" ]; then
        echo "Erro: Executável do Chrome não encontrado."
        return 1
    fi

    mkdir -p "$SYSTEMD_USER_DIR"
    local SERVICE_FILE="$SYSTEMD_USER_DIR/$SERVICE_NAME"

    # URL inicial extraída diretamente do json
    local START_URL=$(jq -r '.perfis[0].urls_alvo[0]' "$REPO_DIR/config.json")

    cat <<EOF > "$SERVICE_FILE"
[Unit]
Description=Tatico Auto Chrome Kiosk
After=graphical-session.target

[Service]
Type=simple
ExecStartPre=/usr/bin/sleep 10
ExecStart=$CHROME_BIN --start-fullscreen --disable-session-crashed-bubble --disable-infobars --no-first-run --load-extension="$REPO_DIR" "$START_URL"
Restart=always
RestartSec=10
Environment=DISPLAY=:0

[Install]
WantedBy=default.target
EOF

    systemctl --user daemon-reload
    systemctl --user enable "$SERVICE_NAME"

    # pra evitar vazamento de ram, o chrome reinicia sozinho duas vezes, uma as 06 e outra ás 18h
    local TIMER_FILE="$SYSTEMD_USER_DIR/tatico-chrome.timer"
    cat <<EOF > "$TIMER_FILE"
[Unit]
Description=Reinicia o Tatico Chrome Kiosk duas vezes ao dia

[Timer]
OnCalendar=*-*-* 06:00:00
OnCalendar=*-*-* 18:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

    systemctl --user enable tatico-chrome.timer
    systemctl --user start tatico-chrome.timer

    echo "Configuração do Systemd gerada/atualizada."
}

# exporta as funcoes pra usar no terminal atual talvez precisa fazer source
export -f instalar_tk atualizar_tk configurar_tk pausar_tk resumir_tk reiniciar_tk
