# Tatico Auto Clicker

# Instalação Automática

## Argumentos disponíveis

### Definir a TV

```text
--tv padaria
```

ou

```text
--tv acougue
```

---

### Definir a loja

```text
--loja NOME_DA_LOJA_EM_CAIXA_ALTA
```

---

### Atualizar o link do PowerBI

```text
--update
```

---

## Exemplo

```bash
curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv padaria --update https://meu-novo-link-aqui.com
```

O comando acima irá atualizar o link do powerbi no inicializador automático do chrome.

---

## Exemplo sem atualizar o link do PowerBI

Configurando a TV da padaria em Campinas:

```bash
curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv padaria --loja CAMPINAS
```
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
