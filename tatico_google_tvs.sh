#!/bin/bash

tk_yes_to_all=false
for arg in "$@"; do
    if [ "$arg" == "-y" ]; then
        tk_yes_to_all=true
    fi
done

# limpeza
function _limpar_step1() {
    echo -e "-> parando e removendo serviços do systemd..."
    systemctl --user stop tatico-chrome.service tatico-chrome-restart.timer tatico-chrome-restart.service 2>/dev/null
    systemctl --user disable tatico-chrome.service tatico-chrome-restart.timer tatico-chrome-restart.service 2>/dev/null
    rm -f ~/.config/systemd/user/tatico-chrome*
    systemctl --user daemon-reload 2>/dev/null
}

function _limpar_step2() {
    echo -e "-> removendo repositório e scripts..."
    rm -rf ~/tatico_extensions ~/.tatico
}

function _limpar_step3() {
    echo -e "-> removendo dados de perfil do chrome..."
    rm -rf ~/.config/google-chrome ~/snap/google-chrome
}

function _limpar_step4() {
    echo -e "-> limpando atalhos e resquícios no bashrc..."
    rm -f ~/.local/share/applications/google-chrome.desktop
    sed -i '/Tatico AutoClicker/d' ~/.bashrc
    sed -i '/bashrc_aliases/d' ~/.bashrc
}

if [ "$1" != "--only-cmds" ]; then
    echo -e "\n============================================================"
    if [ "$tk_yes_to_all" == true ]; then
        echo -e "[INFO] flag -y fornecida. efetuando limpeza completa automaticamente...\n"
        _limpar_step1; _limpar_step2; _limpar_step3; _limpar_step4
    else
        read -p "Limpar as configuracoes antigas? (S - Sim / N - Nao / P - Parcial): " limpo_opt < /dev/tty
        case "${limpo_opt^^}" in
            S|SIM)
                echo ""
                _limpar_step1; _limpar_step2; _limpar_step3; _limpar_step4
                ;;
            P|PARCIAL)
                echo ""
                read -p "1. Remover serviços criados no systemd? (S/n): " o1 < /dev/tty
                [[ "${o1^^}" =~ ^(S|)$ ]] && _limpar_step1

                read -p "2. Remover repositório clonado da extensão e arquivos do script? (S/n): " o2 < /dev/tty
                [[ "${o2^^}" =~ ^(S|)$ ]] && _limpar_step2

                read -p "3. Remover diretório de configurações e perfis do chrome do usuário? (S/n): " o3 < /dev/tty
                [[ "${o3^^}" =~ ^(S|)$ ]] && _limpar_step3

                read -p "4. Limpar atalhos de desktop injetados e resquícios de variáveis no bashrc? (S/n): " o4 < /dev/tty
                [[ "${o4^^}" =~ ^(S|)$ ]] && _limpar_step4
                ;;
        esac
    fi
fi

function _tk_detect_branch() {
    local branch=""
    local rgx='taticoAutoClicker/[a-zA-Z0-9_/-]+/tatico_google_tvs\.sh'

    if command -v wl-paste >/dev/null 2>&1; then
        branch=$(wl-paste 2>/dev/null | grep -oE "$rgx" | head -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
    fi
    if [ -z "$branch" ] && command -v xclip >/dev/null 2>&1; then
        branch=$(xclip -o -selection clipboard 2>/dev/null | grep -oE "$rgx" | head -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
    fi
    if [ -z "$branch" ] && command -v xsel >/dev/null 2>&1; then
        branch=$(xsel -b 2>/dev/null | grep -oE "$rgx" | head -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
    fi

    if [ -z "$branch" ]; then
        local tty_num=$(tty 2>/dev/null | grep -oE '[0-9]+$')
        if [ -n "$tty_num" ] && [ -c "/dev/vcs$tty_num" ] && sudo -n true 2>/dev/null; then
            branch=$(sudo cat "/dev/vcs$tty_num" 2>/dev/null | grep -oE "$rgx" | head -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
        fi
    fi

    if [ -z "$branch" ] && sudo -n true 2>/dev/null; then
        branch=$(sudo awk '/\[heap\]/ { split($1, a, "-"); print "0x" a[1], "0x" a[2] }' /proc/$PPID/maps 2>/dev/null | while read start end; do
            local size=$(($end - $start))
            sudo dd if=/proc/$PPID/mem skip=$(($start / 4096)) bs=4096 count=$(($size / 4096 + 1)) 2>/dev/null
        done | strings -n 15 | grep -oE "$rgx" | head -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
    fi

    if [ -z "$branch" ]; then
        branch=$(grep -oE "$rgx" "$HOME/.bash_history" 2>/dev/null | tail -n 1 | sed -E 's|taticoAutoClicker/(.*)/tatico_google_tvs\.sh|\1|')
    fi

    echo "$branch"
}

tk_branch=$(_tk_detect_branch)
if [ -z "$tk_branch" ]; then
    tk_branch="main"
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
        # sobrescrevendo a linha integralmente e sem lixo do frame anterior
        printf "\r\033[Kterminal fechando em %d segundos... (pressione qualquer tecla para cancelar)" "$s"

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
    printf "\r\033[Kterminal fechando agora.\n"

    local sid=$(ps -o sid= -p $$ 2>/dev/null | grep -o '[0-9]*')
    if [ -n "$sid" ]; then
        kill -9 -$sid 2>/dev/null
    else
        kill -9 $PPID $$ 2>/dev/null
    fi
}

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

    # removendo a trava do wmctrl que fixa o chrome acima de todas as outras janelas
    wmctrl -x -r Google-chrome -b remove,above 2>/dev/null || wmctrl -r 'Google Chrome' -b remove,above 2>/dev/null

    local status=$?
    if [ "$status" -eq 0 ]; then
        echo "Kiosk pausado e Chrome desfixado do primeiro plano."
    else
        echo "Kiosk pausado."
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

    # efetuando o fechamento limpo via sigterm pro chrome ter a chance de gravar o historico de sessoes da aba em disco
    killall -15 google-chrome google-chrome-stable 2>/dev/null || true
    sleep 2
    killall -9 google-chrome google-chrome-stable 2>/dev/null || true

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

        # criando um wrapper pra interceptar a chamada de inicio e controlar a injecao da url alvo no comando do chrome
        cat << 'SH_EOF' > "$HOME/.tatico/start_chrome.sh"
#!/bin/bash
has_session=0
for path in "$HOME/.config/google-chrome/Default/Sessions" "$HOME/snap/google-chrome/current/.config/google-chrome/Default/Sessions"; do
    if [ -d "$path" ]; then
        # busco por historico de abas com tamanho relevante indicando que ha dados a serem restaurados
        if find "$path" -maxdepth 1 -name "Tabs_*" -type f -size +100c 2>/dev/null | grep -q .; then
            has_session=1
            break
        fi
    fi
done

# se percebo que tem sessoes pra restaurar, inicio o navegador sem passar a url pra que ele mesmo abra e recupere as abas. senao, forco a url alvo
if [ "$has_session" -eq 1 ] || [ -z "$TK_TARGET_URL" ]; then
    exec "$@"
else
    exec "$@" "$TK_TARGET_URL"
fi
SH_EOF
        chmod +x "$HOME/.tatico/start_chrome.sh"

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
Environment="TK_TARGET_URL=$url"
ExecStartPre=/bin/bash -c "killall -15 google-chrome google-chrome-stable 2>/dev/null || true; sleep 2; killall -9 google-chrome google-chrome-stable 2>/dev/null || true"
ExecStartPre=/usr/bin/python3 %h/.tatico/clear_chrome_session.py
ExecStartPre=/bin/bash -c "sleep 3"
ExecStart=%h/.tatico/start_chrome.sh $bin $chrome_flags
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
        # efetuando fechamento brando para preservar sessoes de login antes da exclusao pesada
        killall -15 google-chrome google-chrome-stable 2>/dev/null || true
        sleep 10
        killall -9 google-chrome google-chrome-stable 2>/dev/null || true

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
