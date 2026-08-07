#!/bin/bash

TK_DIR="$HOME/.tatico"
TK_RC="$TK_DIR/bashrc_aliases"
TK_SCRIPT="$TK_DIR/tatico_core.sh"
REPO_RAW_URL="https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh"

mkdir -p "$TK_DIR"

# MÓDULO 1: GERADOR DE COMANDOS E INTERAÇÃO
# escrevendo as funcoes no disco de forma independente

cat << 'EOF' > "$TK_RC"
function _tk_timeout() {
    local status=$1
    if [ "$status" -ne 0 ]; then
        echo -e "\n[ERRO] a operação falhou (código de saída: $status). o terminal permanecerá aberto para análise do log."
        return "$status"
    fi

    local s=15
    echo ""
    while [ $s -gt 0 ]; do
        echo -ne "\rterminal fechando em $s segundos... (pressione qualquer tecla para cancelar e ler o log)\033[0K"
        if read -t 1 -n 1 -s < /dev/tty; then
            echo -e "\nfechamento cancelado."
            return 0
        fi
        ((s--))
    done
    echo -ne "\rterminal fechando agora.\033[0K\n"
    kill -9 $(ps -o ppid= -p $PPID) $PPID $$ 2>/dev/null
}

# iniciando o fluxo interativo que invoca o modulo 2
function instalar_tk() {
    local tv_opt="" loja_opt="" tv_str="" loja_str=""

    while true; do
        read -p "Qual é o tipo de TV? (1 - Padaria, 2 - Açougue - digite somente o número): " < /dev/tty tv_opt
        case "$tv_opt" in
            1) tv_str="padaria"; break ;;
            2) tv_str="acougue"; break ;;
            *) echo "opção inválida. tente novamente." ;;
        esac
    done

    while true; do
        read -p "Qual é a loja? (1-CENTRO, 2-GARAVELO, 3-T7, 4-CAMPINAS, 5-PORTAL, 6-PAPILLON - digite somente o número): " < /dev/tty loja_opt
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

    bash "$HOME/.tatico/tatico_core.sh" --acao install --tv "$tv_str" --loja "$loja_str"
    _tk_timeout $?
}

# atualizando somente a logica de bashrc e do core, sem afetar o json/systemd
function atualizar_comandos_tk() {
    echo "baixando comandos mais recentes..."
    curl -sL "https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh" | bash -s -- --only-cmds
    local status=$?
    if [ "$status" -eq 0 ]; then
        source "$HOME/.tatico/bashrc_aliases"
        echo "comandos e core atualizados com sucesso."
    fi
    _tk_timeout $status
}

# chamando atualizacao dos arquivos da extensao no git
function atualizar_tk() {
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
            *) echo "erro: flag desconhecida $1"; return 1 ;;
        esac
    done

    if [ -n "$link" ] && [ -z "$tv" ]; then
        echo "erro: ao informar --link, a flag --tipo_tv é obrigatória."
        return 1
    fi

    bash "$HOME/.tatico/tatico_core.sh" --acao config --tv "$tv" --loja "$loja" --link "$link"
    _tk_timeout $?
}

# parando as rotinas do systemd sem fechar os processos do navegador
function pausar_tk() {
    systemctl --user stop tatico-chrome.service tatico-chrome-restart.timer
    local status=$?
    if [ "$status" -eq 0 ]; then
        echo "kiosk pausado (processos mantidos em execução)."
    fi
    _tk_timeout $status
}

# retomando o gerenciamento do systemd
function resumir_tk() {
    systemctl --user start tatico-chrome.service tatico-chrome-restart.timer
    local status=$?
    if [ "$status" -eq 0 ]; then
        echo "kiosk resumido com sucesso."
    fi
    _tk_timeout $status
}

# limpando processos zumbis e reiniciando o servico master
function reiniciar_tk() {
    pkill -9 -f "chrome" || true
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

# MÓDULO 2
# isolando o script para nao rodar desnecessariamente

cat << 'EOF' > "$TK_SCRIPT"
#!/bin/bash

# garantindo presenca de ferramentas base
if ! command -v git &> /dev/null || ! command -v wmctrl &> /dev/null || ! command -v python3 &> /dev/null; then
    sudo apt-get update > /dev/null 2>&1
    sudo apt-get install -y git wmctrl python3 > /dev/null 2>&1
fi

acao="" tv="" loja="" link=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --acao) acao="$2"; shift 2 ;;
        --tv) tv="$2"; shift 2 ;;
        --loja) loja="$2"; shift 2 ;;
        --link) link="$2"; shift 2 ;;
        *) shift ;;
    esac
done

ext_dir="$HOME/tatico_extensions"
repo_dir="$ext_dir/taticoAutoClicker"
repo_url="https://github.com/Pedrohrn/taticoAutoClicker.git"

function _tk_processar_json() {
    python3 -c "
import json, sys, re, os

acao = '$acao'
tv = '$tv'
loja = '$loja'
link = '$link'
repo = '$repo_dir'

c_path = os.path.join(repo, 'config.json')

try:
    with open(c_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
except Exception:
    sys.exit(1)

if acao == 'install':
    p_nome = 'TVS Padaria' if tv == 'padaria' else 'TVs Açougue'
    p_id = next((p['id'] for p in data.get('perfis', []) if re.search(p_nome, p.get('nome', ''), re.IGNORECASE)), '')

    tv_upper = 'PADARIA' if tv == 'padaria' else 'AÇOUGUE'
    r_nome = f'{tv_upper} {loja}'

    data['rotinaAtualNome'] = r_nome
    if data.get('rotinas'):
        r = data['rotinas'][0]
        r['nome'] = r_nome
        r['perfil_id'] = p_id
        r['autorefresh_ativo'] = True
        r['autorefresh_min'] = 60
        if len(r.get('passos_avancados', [])) > 1:
            r['passos_avancados'][1]['parada_seletor'] = loja

elif acao == 'config':
    if loja and data.get('rotinas'):
        r = data['rotinas'][0]
        prefixo = r['nome'].split()[0] if r.get('nome') else ''
        n_nome = f'{prefixo} {loja}'.strip()
        r['nome'] = n_nome
        data['rotinaAtualNome'] = n_nome
        if len(r.get('passos_avancados', [])) > 1:
            r['passos_avancados'][1]['parada_seletor'] = loja

    if link and tv:
        p_nome = 'TVS Padaria' if tv == 'padaria' else 'TVs Açougue'
        for p in data.get('perfis', []):
            if re.search(p_nome, p.get('nome', ''), re.IGNORECASE):
                if p.get('urls_alvo'):
                    p['urls_alvo'][0] = link

with open(c_path, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2, ensure_ascii=False)
"
}

# configurando ambiente de servicos assincronos e verificando o executavel do chrome
function _tk_configurar_systemd() {
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

    local url=$(python3 -c "import json; print(next((p['urls_alvo'][0] for p in json.load(open('$repo_dir/config.json'))['perfis'] if ('Padaria' if '$tv' == 'padaria' else 'Açougue') in p['nome']), ''))")

    local chrome_flags="--start-fullscreen --disable-infobars --disable-session-crashed-bubble --no-first-run --disable-crash-reporter --no-errdialogs --disable-notifications --disable-default-apps --no-default-browser-check --disable-features=TranslateUI"

    local sd_dir="$HOME/.config/systemd/user"
    mkdir -p "$sd_dir"

    python3 -c "
import json, os, hashlib

repo = '$repo_dir'
h = hashlib.sha256(repo.encode('utf-8')).hexdigest()[:32]
ext_id = ''.join(chr(ord(c) + 49) if c.isdigit() else chr(ord(c) + 10) for c in h)

ext_dir_path = os.path.expanduser('~/.config/google-chrome/External Extensions')
os.makedirs(ext_dir_path, exist_ok=True)
ext_json_path = os.path.join(ext_dir_path, f'{ext_id}.json')

with open(ext_json_path, 'w', encoding='utf-8') as f:
    json.dump({
        'external_path': repo,
        'external_version': '1.0'
    }, f, indent=2)

paths = [os.path.expanduser('~/.config/google-chrome/Default/Preferences')]
for p in paths:
    try:
        os.makedirs(os.path.dirname(p), exist_ok=True)
        data = {}
        if os.path.exists(p):
            with open(p, 'r', encoding='utf-8') as f:
                data = json.load(f)

        exts = data.setdefault('extensions', {})
        exts.setdefault('ui', {})['developer_mode'] = True

        with open(p, 'w', encoding='utf-8') as f:
            json.dump(data, f)
    except Exception:
        pass
"

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
KillMode=none
ExecStartPre=/bin/bash -c "sed -i 's/\"exit_type\":\"Crashed\"/\"exit_type\":\"Normal\"/g' $HOME/.config/google-chrome/Default/Preferences 2>/dev/null || true; sed -i 's/\"exited_cleanly\":false/\"exited_cleanly\":true/g' $HOME/.config/google-chrome/Default/Preferences 2>/dev/null || true; sleep 1"
ExecStart=$bin $chrome_flags "$url"
ExecStartPost=/bin/bash -c "sleep 8; wmctrl -r 'Google Chrome' -b add,above || true"
Restart=always
RestartSec=10
Environment=DISPLAY=:0

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
OnCalendar=*-*-* 06:00:00
OnCalendar=*-*-* 18:00:00
Persistent=true

[Install]
WantedBy=timers.target
SYS_EOF

    systemctl --user daemon-reload
    systemctl --user enable tatico-chrome.service
    systemctl --user enable --now tatico-chrome-restart.timer
}

case "$acao" in
    install)
        pkill -9 -f "chrome" || true
        sleep 2

        mkdir -p "$ext_dir"
        cd "$ext_dir" || exit 1
        if [ -d "$repo_dir" ]; then
            cd "$repo_dir" && git reset --hard && git pull
        else
            git clone "$repo_url" "$repo_dir"
            cd "$repo_dir" || exit 1
        fi

        cp -f "$repo_dir/sample_config.json" "$repo_dir/config.json" 2>/dev/null || cp -f "$repo_dir/sample.json" "$repo_dir/config.json" 2>/dev/null

        _tk_processar_json
        _tk_configurar_systemd || exit 1

        systemctl --user restart tatico-chrome.service || { echo -e "\n[ERRO] falha ao registrar o servico no systemctl."; exit 1; }

        echo "instalação base concluída."
        ;;
    update)
        cd "$repo_dir" || exit 1
        cp config.json /tmp/tk_cfg_bkp.json 2>/dev/null || true
        git reset --hard && git pull || exit 1
        mv /tmp/tk_cfg_bkp.json config.json 2>/dev/null || true
        echo "extensão atualizada."
        ;;
    config)
        _tk_processar_json
        systemctl --user restart tatico-chrome.service || exit 1
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
