#!/bin/bash

# detectando a branch de origem automaticamente
tk_branch="main"

tk_curl_cmd=$(ps -eo args 2>/dev/null | grep -E "curl.*taticoAutoClicker" | grep -v grep | grep -o "taticoAutoClicker/[^/]*/" | tail -n 1 | cut -d/ -f2)

if [ -z "$tk_curl_cmd" ]; then
    tk_curl_cmd=$(grep -E "curl.*taticoAutoClicker" "$HOME/.bash_history" 2>/dev/null | tail -n 1 | grep -o "taticoAutoClicker/[^/]*/" | cut -d/ -f2)
fi

if [ -z "$tk_curl_cmd" ] && [ -d "$HOME/tatico_extensions/taticoAutoClicker/.git" ]; then
    tk_curl_cmd=$(cd "$HOME/tatico_extensions/taticoAutoClicker" && git rev-parse --abbrev-ref HEAD 2>/dev/null)
fi

if [ -n "$tk_curl_cmd" ] && [ "$tk_curl_cmd" != "HEAD" ]; then
    tk_branch="$tk_curl_cmd"
fi

TK_DIR="$HOME/.tatico"
TK_RC="$TK_DIR/bashrc_aliases"
TK_SCRIPT="$TK_DIR/tatico_core.sh"

mkdir -p "$TK_DIR"

function _tk_sep() {
    echo -e "\n============================================================"
}

cat << EOF > "$TK_RC"
export TK_BRANCH="$tk_branch"
EOF

# escrevendo as funcoes no disco de forma independente
cat << 'EOF' >> "$TK_RC"
function _tk_timeout() {
    local status=$1
    if [ "$status" -ne 0 ]; then
        echo -e "\n[ERRO] a operação falhou (código de saída: $status). o terminal permanecerá aberto para análise do log."
        return "$status"
    fi

    local s=30
    echo ""
    read -t 0.1 -n 1000 -s < /dev/tty 2>/dev/null

    while [ $s -gt 0 ]; do
        echo -ne "\rterminal fechando em $s segundos... (pressione qualquer tecla para cancelar e ler o log)\033[0K"
        if read -t 1 -n 1 -s < /dev/tty 2>/dev/null; then
            echo -e "\nfechamento cancelado pelo usuário."
            return 0
        fi

        local rc=$?
        if [ $rc -ne 142 ] && [ $rc -ne 0 ]; then
            sleep 1
        fi

        ((s--))
    done
    echo -ne "\rterminal fechando agora.\033[0K\n"
    # restringindo o kill apenas ao processo pai imediato e ao proprio shell
    kill -9 $PPID $$ 2>/dev/null
}

# iniciando o fluxo interativo que invoca o modulo 2
function instalar_tk() {
    local tv_opt="" loja_opt="" tv_str="" loja_str="" serv_opt="" serv_str="sim"

    _tk_sep
    while true; do
        read -p "Qual é o tipo de TV? (1 - Padaria, 2 - Açougue, 3 - Outras - digite somente o número): " tv_opt < /dev/tty
        case "$tv_opt" in
            1) tv_str="padaria"; break ;;
            2) tv_str="acougue"; break ;;
            3) tv_str="outras"; break ;;
            *) echo "opção inválida. tente novamente." ;;
        esac
    done

    # skippando a selecao de loja se for uma tv do tipo "outras"
    if [ "$tv_str" != "outras" ]; then
        _tk_sep
        while true; do
            read -p "Qual é a loja? (1-CENTRO, 2-GARAVELO, 3-T7, 4-CAMPINAS, 5-PORTAL, 6-PAPILLON - digite somente o número): " loja_opt < /dev/tty
            case "$loja_opt" in
                1) loja_str="CENTRO"; break ;;
                2) loja_str="GARAVELO"; break ;;
                3) loja_str="T7"; break ;;
                4) loja_str="CAMPINAS"; break ;;
                5) loja_str="PORTAL"; break ;;
                6) loja_str="PAPILLON"; break ;;
                *) echo "opção inválida. tente novamente." ;;
            esac
        done
    else
        loja_str="OUTRAS"
    fi

    _tk_sep
    while true; do
        read -p "Deseja instalar os serviços de inicialização automática e persistente do Chrome? (S/n): " serv_opt < /dev/tty
        serv_opt=${serv_opt:-S}
        case "${serv_opt^^}" in
            S) serv_str="sim"; break ;;
            N) serv_str="nao"; break ;;
            *) echo "opção inválida. tente novamente." ;;
        esac
    done
    _tk_sep

    bash "$HOME/.tatico/tatico_core.sh" --acao install --tv "$tv_str" --loja "$loja_str" --servicos "$serv_str"
    _tk_timeout $?
}

# atualizando somente a logica de bashrc e do core respeitando a branch detectada
function atualizar_comandos_tk() {
    _tk_sep
    echo "Baixando comandos mais recentes da branch: $TK_BRANCH..."
    local tmp_file=$(mktemp)
    if curl -sL "https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/${TK_BRANCH}/tatico_google_tvs.sh" -o "$tmp_file"; then
        bash "$tmp_file" --only-cmds
        local status=$?
        if [ "$status" -eq 0 ]; then
            source "$HOME/.tatico/bashrc_aliases"
            echo "Comandos e core atualizados com sucesso."
        fi
    else
        echo "Erro: falha ao baixar o script remoto."
        local status=1
    fi
    rm -f "$tmp_file"
    _tk_timeout $status
}

# chamando atualizacao dos arquivos da extensao no git
function atualizar_tk() {
    _tk_sep
    bash "$HOME/.tatico/tatico_core.sh" --acao update
    _tk_timeout $?
}

# recebendo e validando flags especificas para alterar propriedades pontuais
function configurar_tk() {
    local tv="" loja="" link=""

    while [[ "$#" -gt 0 ]]; do
        case $1 in
            --tipo_tv) tv="$2"; shift 2 ;;
            --loja) loja="$2"; shift 2 ;;
            --link) link="$2"; shift 2 ;;
            *) echo "Erro: Flag desconhecida $1"; return 1 ;;
        esac
    done

    if [ -n "$link" ] && [ -z "$tv" ]; then
        echo "Erro: Ao informar --link, a flag --tipo_tv é obrigatória."
        return 1
    fi

    if [ -n "$loja" ]; then
        if [[ ! "$loja" =~ ^(CENTRO|GARAVELO|T7|CAMPINAS|PORTAL|PAPILLON|OUTRAS)$ ]]; then
            echo "Erro: A loja informada é inválida."
            return 1
        fi
    fi

    _tk_sep
    bash "$HOME/.tatico/tatico_core.sh" --acao config --tv "$tv" --loja "$loja" --link "$link"
    _tk_timeout $?
}

# parando as rotinas do systemd sem fechar os processos do navegador
function pausar_tk() {
    _tk_sep
    systemctl --user stop tatico-chrome.service tatico-chrome-restart.timer
    local status=$?
    if [ "$status" -eq 0 ]; then
        echo "Kiosk pausado (processos mantidos em execução)."
    fi
    _tk_timeout $status
}

# retomando o gerenciamento do systemd
function resumir_tk() {
    _tk_sep
    systemctl --user start tatico-chrome.service tatico-chrome-restart.timer
    local status=$?
    if [ "$status" -eq 0 ]; then
        echo "Kiosk resumido com sucesso."
    fi
    _tk_timeout $status
}

# limpando processos zumbis e reiniciando o servico master
function reiniciar_tk() {
    _tk_sep
    killall -9 google-chrome google-chrome-stable 2>/dev/null || true
    sleep 2
    systemctl --user restart tatico-chrome.service
    local status=$?
    if [ "$status" -eq 0 ]; then
        local pid=$(systemctl --user show -p MainPID --value tatico-chrome.service)
        echo "kiosk reiniciado com sucesso. PID atual: $pid"
    fi
    _tk_timeout $status
}
EOF

# injetando a persistencia no bashrc do usuario local
if ! grep -q "source $TK_RC" "$HOME/.bashrc"; then
    echo -e "\n# Tatico AutoClicker Kiosk\nsource $TK_RC" >> "$HOME/.bashrc"
fi

# isolando o script para nao rodar desnecessariamente
cat << 'EOF' > "$TK_SCRIPT"
#!/bin/bash

# garantindo presenca de ferramentas base
if ! command -v git &> /dev/null || ! command -v wmctrl &> /dev/null || ! command -v python3 &> /dev/null; then
    sudo apt-get update > /dev/null 2>&1
    sudo apt-get install -y git wmctrl python3 > /dev/null 2>&1
fi

acao="" tv="" loja="" link="" servicos="sim"

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --acao) acao="$2"; shift 2 ;;
        --tv) tv="$2"; shift 2 ;;
        --loja) loja="$2"; shift 2 ;;
        --link) link="$2"; shift 2 ;;
        --servicos) servicos="$2"; shift 2 ;;
        *) shift ;;
    esac
done

ext_dir="$HOME/tatico_extensions"
repo_dir="$ext_dir/taticoAutoClicker"
repo_url="https://github.com/Pedrohrn/taticoAutoClicker.git"

function _tk_processar_json() {
    export TK_ACAO="$acao"
    export TK_TV="$tv"
    export TK_LOJA="$loja"
    export TK_LINK="$link"
    export TK_REPO="$repo_dir"

    python3 -c "
import json, sys, re, os

acao = os.environ.get('TK_ACAO', '')
tv = os.environ.get('TK_TV', '')
loja = os.environ.get('TK_LOJA', '')
link = os.environ.get('TK_LINK', '')
repo = os.environ.get('TK_REPO', '')

c_path = os.path.join(repo, 'config.json')

try:
    with open(c_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    sys.exit(1)

if acao == 'install':
    if tv != 'outras':
        p_nome = 'TVs Padaria' if tv == 'padaria' else 'TVs Açougue'
        p_id = next((p['id'] for p in data.get('perfis', []) if re.search(p_nome, p.get('nome', ''), re.IGNORECASE)), None)

        tv_upper = 'PADARIA' if tv == 'padaria' else 'AÇOUGUE'
        r_nome = f'{tv_upper} {loja}'

        data['rotinaAtualNome'] = r_nome
        if data.get('rotinas'):
            r = data['rotinas'][0]
            r['nome'] = r_nome
            if p_id:
                r['perfil_id'] = p_id
            r['autorefresh'] = True
            r['autorefresh_min'] = 60
            if len(r.get('passos_avancados', [])) > 1:
                r['passos_avancados'][1]['parada_seletor'] = loja

elif acao == 'config':
    if loja and data.get('rotinas') and tv != 'outras':
        r = data['rotinas'][0]
        prefixo = r['nome'].split()[0] if r.get('nome') else ''
        n_nome = f'{prefixo} {loja}'.strip()
        r['nome'] = n_nome
        data['rotinaAtualNome'] = n_nome
        if len(r.get('passos_avancados', [])) > 1:
            r['passos_avancados'][1]['parada_seletor'] = loja

    if link and tv and tv != 'outras':
        p_nome = 'TVs Padaria' if tv == 'padaria' else 'TVs Açougue'
        for p in data.get('perfis', []):
            if re.search(p_nome, p.get('nome', ''), re.IGNORECASE):
                if p.get('urls_alvo'):
                    p['urls_alvo'][0] = link

with open(c_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
"
}

# configurando ambiente de servicos assincronos e verificando o executavel do chrome
function _tk_configurar_ambiente() {
    local bin=""
    for p in "/usr/bin/google-chrome-stable" "/usr/bin/google-chrome" "/opt/google/chrome/google-chrome" "/snap/bin/google-chrome"; do
        if [ -x "$p" ]; then
            bin="$p"
            break
        fi
    done

    if [ -z "$bin" ]; then
        bin=$(command -v google-chrome-stable || command -v google-chrome || echo "/usr/bin/google-chrome-stable")
    fi

    local url=""
    if [ "$tv" != "outras" ]; then
        url=$(python3 -c "import json; print(next((p['urls_alvo'][0] for p in json.load(open('$repo_dir/config.json'))['perfis'] if ('Padaria' if '$tv' == 'padaria' else 'Açougue') in p['nome']), ''))" 2>/dev/null)
    fi

    local chrome_flags="--start-fullscreen --disable-print-preview --kiosk-printing --disable-infobars --disable-session-crashed-bubble --no-first-run --disable-crash-reporter --no-errdialogs --disable-notifications --disable-default-apps --no-default-browser-check --password-store=basic --use-mock-keychain --simulate-outdated-no-au='Tue, 31 Dec 2099 23:59:59 GMT' --metrics-recording-only --disable-sync --disable-background-networking --disable-prompt-on-repost --disable-client-side-phishing-detection --disable-component-update --disable-features=Translate,TranslateUI,OptimizationHints,MediaRouter,DialMediaRouteProvider,CalculateNativeWinOcclusion,CertificateTransparencyComponentUpdater,AutofillServerCommunication,PrivacySandboxSettings4 --load-extension=$repo_dir"

    python3 -c "
import json, os

paths = [os.path.expanduser('~/.config/google-chrome/Default/Preferences'), os.path.expanduser('~/snap/google-chrome/current/.config/google-chrome/Default/Preferences')]
for p in paths:
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        data = {}
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)

        exts = data.get('extensions', {})
        ui = exts.get('ui', {})
        ui['developer_mode'] = True
        exts['ui'] = ui
        data['extensions'] = exts

        sess = data.get('session', {})
        sess['restore_on_startup'] = 1
        data['session'] = sess

        with open(p, 'w', encoding='utf-8') as f:
            json.dump(data, f)
    except Exception:
        pass
"

    # configuracoes de desktop e systemd somente se o usuario solicitou
    if [ "$servicos" == "sim" ]; then
        local sd_dir="$HOME/.config/systemd/user"
        mkdir -p "$sd_dir"

        # o restart agendado do systemd nativamente envia SIGTERM, ou seja, eh gracefully. a unica coisa
        # que preciso eh garantir que o status crashed no preferences seja mascarado pra restaurar certinho,
        # sem nunca deletar de fato a pasta de sessoes de ninguem
        cat << 'PY_EOF' > "$HOME/.tatico/clear_chrome_session.py"
import json, os
paths = [os.path.expanduser('~/.config/google-chrome/Default'), os.path.expanduser('~/snap/google-chrome/current/.config/google-chrome/Default')]
for p in paths:
    pref = os.path.join(p, 'Preferences')
    if os.path.exists(pref):
        try:
            with open(pref, 'r', encoding='utf-8') as f: d = json.load(f)
            if 'profile' not in d: d['profile'] = {}
            d['profile']['exit_type'] = 'Normal'
            d['profile']['exited_cleanly'] = True
            with open(pref, 'w', encoding='utf-8') as f: json.dump(d, f)
        except: pass
PY_EOF
        chmod +x "$HOME/.tatico/clear_chrome_session.py"

        local desk_path="$HOME/.local/share/applications/google-chrome.desktop"
        mkdir -p "$HOME/.local/share/applications"
        if [ -f "/usr/share/applications/google-chrome.desktop" ]; then
            cp "/usr/share/applications/google-chrome.desktop" "$desk_path"
        elif [ -f "/var/lib/snapd/desktop/applications/google-chrome_google-chrome.desktop" ]; then
            cp "/var/lib/snapd/desktop/applications/google-chrome_google-chrome.desktop" "$desk_path"
        fi

        if [ -f "$desk_path" ]; then
            sed -i "s|^Exec=.*|Exec=$bin $chrome_flags %U|g" "$desk_path"
            update-desktop-database "$HOME/.local/share/applications" &>/dev/null || true
        fi

        cat <<SYS_EOF > "$sd_dir/tatico-chrome.service"
[Unit]
Description=Tatico Chrome Fullscreen
After=graphical-session.target

[Service]
Type=simple
KillMode=mixed
Environment=TK_TV_TYPE=$tv
Environment=DISPLAY=${DISPLAY:-:0}
ExecStartPre=/bin/bash -c "killall -9 google-chrome google-chrome-stable 2>/dev/null || true; sleep 2"
ExecStartPre=/usr/bin/python3 %h/.tatico/clear_chrome_session.py
ExecStartPre=/bin/bash -c "sleep 5"
ExecStart=$bin $chrome_flags "$url"
ExecStartPost=/bin/bash -c "for i in {1..20}; do wmctrl -x -r Google-chrome -b add,fullscreen,above 2>/dev/null || wmctrl -r 'Google Chrome' -b add,fullscreen,above 2>/dev/null && break; sleep 2; done"
Restart=always
RestartSec=10

[Install]
WantedBy=default.target
SYS_EOF

        cat <<SYS_EOF > "$sd_dir/tatico-chrome-restart.service"
[Unit]
Description=Restart Kiosk Service

[Service]
Type=oneshot
ExecStart=/usr/bin/systemctl --user restart tatico-chrome.service
SYS_EOF

        cat <<SYS_EOF > "$sd_dir/tatico-chrome-restart.timer"
[Unit]
Description=Timer Tatico Restart Kiosk Diario

[Timer]
OnCalendar=*-*-* 07:00:00
Persistent=true

[Install]
WantedBy=timers.target
SYS_EOF

        systemctl --user daemon-reload
        systemctl --user enable tatico-chrome.service
        systemctl --user enable --now tatico-chrome-restart.timer
    else
        echo "instalação de serviços persistentes skippada. modo desenvolvedor ativado."
    fi
}

case "$acao" in
    install)
        killall -9 google-chrome google-chrome-stable 2>/dev/null || true
        sleep 2

        mkdir -p "$ext_dir"
        cd "$ext_dir" || exit 1
        if [ -d "$repo_dir" ]; then
            cd "$repo_dir" && git reset --hard && git fetch origin && git checkout "$TK_BRANCH" && git reset --hard "origin/$TK_BRANCH"
        else
            git clone -b "$TK_BRANCH" "$repo_url" "$repo_dir"
            cd "$repo_dir" || exit 1
        fi

        cp -f "$repo_dir/sample_config.json" "$repo_dir/config.json" 2>/dev/null || cp -f "$repo_dir/sample.json" "$repo_dir/config.json" 2>/dev/null

        _tk_processar_json
        _tk_configurar_ambiente || exit 1

        if [ "$servicos" == "sim" ]; then
            systemctl --user restart tatico-chrome.service || { echo -e "\n[ERRO] falha ao registrar o servico no systemctl."; exit 1; }
        fi

        echo "instalação base concluída."
        ;;
    update)
        cd "$repo_dir" || exit 1
        cp config.json /tmp/tk_cfg_bkp.json 2>/dev/null || true
        git fetch origin && git checkout "$TK_BRANCH" && git reset --hard "origin/$TK_BRANCH" || exit 1
        mv /tmp/tk_cfg_bkp.json config.json 2>/dev/null || true
        echo "extensão atualizada."
        ;;
    config)
        _tk_processar_json
        if [ "$servicos" == "sim" ]; then
            systemctl --user restart tatico-chrome.service || exit 1
        fi
        echo "configurações aplicadas."
        ;;
esac
EOF

chmod +x "$TK_SCRIPT"

# validando se estamos atualizando apenas os scripts ou rodando instalacao completa
if [ "$1" == "--only-cmds" ]; then
    # finaliza silenciosamente apos recriar os arquivos base
    exit 0
fi

# forcando o carregamento dos aliases nesta sessao de pipe
source "$TK_RC"

# iniciando interacao de configuracao final da tv
instalar_tk
