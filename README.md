# Tatico Auto Clicker

## Instalação Automática

Para conseguir rodar a instalação automática, será necesário baixar/atualizar o curl com o comando abaixo:

```bash
sudo apt update && sudo apt install curl -y
```

# Pra instalar curl e o kiosk ao mesmo tempo:
*(O script abrirá um menu interativo para você escolher a Loja e a TV)*

```bash
sudo apt update && sudo apt install curl -y && curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash
```

# Pra instalar o kiosk numa máquina que já possua curl instalado, rode apenas o comando:

```bash
curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash
```

# Se der erro de acesso negado ou falha de permissão durante a instalação, nos passos git pull ou git clone, execute o comando abaixo pra dar permissão do usuário ubuntu atual lidar com o git:

```bash
sudo chown -R "$(whoami)":"$(id -gn)" ~/tatico_extensions/taticoAutoClicker/.git
```

---

## 🛠️ Comandos de Terminal Disponíveis (Kiosk)

Após a instalação, o seu terminal do Ubuntu ganha novos comandos para facilitar o gerenciamento do Kiosk e da Extensão, sem precisar reinstalar tudo do zero. Você pode digitar qualquer um desses comandos no terminal:

*   **`instalar_tk`**: Inicia o menu interativo novamente para reinstalar ou reconfigurar a TV e Loja.
*   **`atualizar_tk`**: Busca a última versão da extensão no GitHub e atualiza na máquina atual.
*   **`atualizar_comandos_tk`**: Atualiza apenas os comandos do sistema no terminal (útil para atualizações silenciosas).
*   **`pausar_tk`**: Pausa a reinicialização automática (serviço kiosk) mantendo o navegador atual aberto para manutenções.
*   **`resumir_tk`**: Retoma a reinicialização automática.
*   **`reiniciar_tk`**: Força o encerramento de abas zumbis e reinicia o Kiosk do zero.
*   **`configurar_tk`**: Permite alterar configurações específicas via terminal usando argumentos (veja os exemplos abaixo).

---

## ⚙️ Argumentos disponíveis (via comando `configurar_tk`)

Você pode usar o comando `configurar_tk` para ajustar configurações sem precisar passar pelo menu interativo.

### Definir a TV

```text
--tipo_tv padaria
```

ou

```text
--tipo_tv acougue
```

---

### Definir a loja

```text
--loja NOME_DA_LOJA_EM_CAIXA_ALTA
```

---

### Atualizar o link do PowerBI

```text
--link "https://meu-novo-link-aqui.com"
```

---

## Exemplo

```bash
configurar_tk --tipo_tv padaria --link "https://meu-novo-link-aqui.com"
```

O comando acima irá atualizar o link do powerbi no inicializador automático do chrome, sendo obrigatório informar a TV alvo.

---

## Exemplo sem atualizar o link do PowerBI

Configurando a TV da padaria em Campinas:

```bash
configurar_tk --tipo_tv padaria --loja CAMPINAS
```

---

## 📁 Estrutura de Diretórios e Arquivos

Para fins de manutenção, os arquivos ficam organizados da seguinte forma no sistema:

*   **`~/.tatico/`**: Pasta principal de configuração.
    *   `bashrc_aliases`: Arquivo onde estão definidos todos os novos comandos interativos (`instalar_tk`, `pausar_tk`, etc). Ele é atrelado automaticamente ao `~/.bashrc`.
    *   `tatico_core.sh`: Núcleo do sistema, que processa e roda a instalação e atualizações via Python.
*   **`~/tatico_extensions/taticoAutoClicker/`**: Pasta da extensão do Chrome baixada via git.
    *   `config.json`: Arquivo gerado que dita as preferências atuais de link, loja e TV.
*   **`~/.config/systemd/user/`**: Onde ficam os arquivos `tatico-chrome.service` e `timer` que fazem o Chrome abrir e reiniciar sozinho.

---

## Instalação Manual

### 1. Instale a ferramenta Git na máquina

```bash
sudo apt update && sudo apt install git -y
```

---

### 2. Crie uma pasta para o repositório

Crie uma pasta em `Documentos` para o repositório e navegue até a mesma.

```bash
sudo mkdir ~/tatico_extensions && cd ~/tatico_extensions
```

└── ### 2.1 Dando permissão ao usuário do ubuntu para gerenciar o git

```bash
sudo chown -R $(whoami):$(id -gn) .git
```

---

### 3. Faça o download do repositório

Faça o download do repositório da extensão com o comando:

```bash
git clone https://github.com/Pedrohrn/taticoAutoClicker.git
```

---

### 4. Adicione a extensão ao Chrome

Vá até:

```
Chrome
└── Menu (...)
    └── Extensões
        └── Gerênciar extensões
```

<p align="center">
    <img width="668" height="893" alt="image" src="https://github.com/user-attachments/assets/8bda0a1b-6bd0-4172-923a-454871544b48" />
</p>

---

### 5. Ative o modo desenvolvedor

Na tela que abrir, ative o **Modo de desenvolvedor** e selecione a opção **"Carregar sem compactação"**.

<p align="center">
    <img width="1919" height="570" alt="image" src="https://github.com/user-attachments/assets/3cd837ab-e4ea-4cdc-92a6-7fdcc515ac80" />
</p>

---

### 6. Selecione a pasta da extensão

Navegue até a pasta onde a extensão foi baixada e selecione a pasta do **taticoAutoClicker**.

Se o passo a passo foi seguido corretamente, a pasta estará em:

```
tatico_extensions/
```

---

### 7. Fixe a extensão

Depois que a extensão for carregada corretamente para o Chrome, clique no ícone de extensões na barra de tarefas do navegador → localize a extensão → clique em **"Fixar"** para que ela fique fixa e vísivel.

<p align="center">
    <img width="597" height="592" alt="image" src="https://github.com/user-attachments/assets/26bfb43a-b7dd-4e51-899f-4189439713c9" />
</p>

---

### 8. Abra as opções da extensão

Clique sobre a logo do Tatico com o botão direito e selecione **"Opções"**.

<p align="center">
    <img width="469" height="513" alt="image" src="https://github.com/user-attachments/assets/f790e40c-00f2-4408-8403-1d4535496a02" />
</p>

---

### 9. Configure a TV

Preencha o nome da loja e o setor onde a TV está localizada e clique em salvar.

---

### 10. Abra o Power BI

Navegue até o link do Microsoft PB do Tatico e recarregue a tela.

> A extensão só funciona nas telas do PowerBI.
>
> O tempo atual de refresh automático da tela é de **60 minutos**.
>
> O tempo que aparece na logo da extensão é atualizado a cada **5 segundos** para poupar recursos do navegador e sistema.

<p align="center">
    <img width="365" height="251" alt="image" src="https://github.com/user-attachments/assets/5ecca156-ab13-432a-8ca1-073bbe61af12" />
</p>

---

# COMANDOS PDVS/TOTVS

# Diagnóstico e Manutenção TOTVS PDV

## 1. Diagnóstico de Vídeo e Acesso Remoto
Diagnóstico gráfico e de conexões remotas executado via SSH sem depender da variável $DISPLAY.

```bash
# checando se estou em um ambiente virtualizado
systemd-detect-virt

# buscando gpus no barramento pci
lspci -nn | grep -i vga

# lendo status dos monitores direto do sysfs pra não travar o x server via ssh
grep -H "^connected" /sys/class/drm/*/status 2>/dev/null

# filtrando processos de acesso remoto na sessao atual
ps -eo pid,user,comm,args | grep -iE 'vnc|xrdp|nomachine|teamviewer|anydesk' | grep -v grep
```

## 2. Diagnóstico de Sistema e Arquivos
Coleta do estado de RAM, CPU e disco sem gerar contenção (lock) de banco de dados.

```bash
# checando uso de ram
free -h

# listando os 10 processos que mais gastam ram, ordenando na base pra poupar cpu
ps -eo pid,%mem,%cpu,comm --sort=-%mem | head -n 11

# pegando os 10 processos com maior uso de cpu
ps -eo pid,%cpu,%mem,comm --sort=-%cpu | head -n 11

# mapeando gargalos no disco silenciando erros de permissao
du -sh /* 2>/dev/null | sort -rh | head -n 15

# caçando arquivos pesados acima de 100mb
find / -type f -size +100M -exec ls -lh {} + 2>/dev/null | awk '{ print $9 ": " $5 }'

# medindo os diretorios temporarios
du -sh /tmp /var/tmp /var/log 2>/dev/null

# mapeando pastas de log e spool do totvs, ajustando o path base se necessario
du -sh /opt/totvs/protheus_data/system /opt/totvs/protheus_data/spool 2>/dev/null

# checando o uptime do caixa
uptime -p
```

## 3. Resoluções Seguras

### Alto Consumo de RAM/CPU
Evitar `kill -9` em processos do banco de dados e client.

```bash
# parando o servico do totvs graciosamente
sudo systemctl restart totvs-pdv.service

# matando o processo orfao de forma limpa via sigterm
sudo kill -15 <NUMERO_DO_PID>
```

### Disco Cheio e Excesso de Logs
Não remover arquivos de log em uso direto com `rm`.

```bash
# truncando log pra liberar disco sem soltar o lock do inode
> /caminho/do/arquivo/de/log/muito_grande.log

# limpando logs do journal mantendo so os ultimos 3 dias
sudo journalctl --vacuum-time=3d
```

### Congelamento da Interface Gráfica
Se o SSH responde e não há interferência de VNC, não reinicie o computador inteiro cortando as transações locais.

```bash
# resetando o display manager (trocar por lightdm se necessario)
sudo systemctl restart gdm3
```

### Reconstrução de Índices TOTVS
Nunca excluir arquivos temporários (`.cdx`, `.ind`) com os processos ativos. Pare o serviço, mova os arquivos problemáticos para `/tmp` como backup de segurança e inicie o serviço forçando a reindexação nativa.
