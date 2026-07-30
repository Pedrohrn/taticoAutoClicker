# Instale a ferramenta git na máquina
$ sudo apt update && sudo apt install git -y

# Crie uma pasta em Documentos para o repositório e navegue até a mesma

$ sudo mkdir ~/tatico_extensions && cd ~/tatico_extensions

# Faça o download do repositório da extensão com o comando:
$ git clone https://github.com/Pedrohrn/taticoAutoClicker.git

# Para adicionar ao navegador, vá até o chrome -> menu reticiências (...) no canto superior direito > extensões -> gerênciar extensões

<img width="668" height="893" alt="image" src="https://github.com/user-attachments/assets/8bda0a1b-6bd0-4172-923a-454871544b48" />

# Na tela que abrir, ative o modo de desenvolvedor e selecione a opção "Carregar sem compactação"

<img width="1919" height="570" alt="image" src="https://github.com/user-attachments/assets/3cd837ab-e4ea-4cdc-92a6-7fdcc515ac80" />

# Navegue até a pasta onde a extensão foi baixada e selecione a pasta do taticoAutoClicker (se o passo a passo foi seguido corretamente, a pasta estará em tatico_extensions/)

# Depois que a extensão for carregada corretamente para o Chrome, clique no ícone de extensões na barra de tarefas do navegador -> localize a extensão clique em "Fixar" para que ela fique fixa e vísivel

<img width="597" height="592" alt="image" src="https://github.com/user-attachments/assets/26bfb43a-b7dd-4e51-899f-4189439713c9" />

# Clique sobre a logo do Tatico com o botão direito e selecione "Opções"

<img width="469" height="513" alt="image" src="https://github.com/user-attachments/assets/f790e40c-00f2-4408-8403-1d4535496a02" />

# Preencha o nome da loja e o setor onde a TV está localizada e clique em salvar

# Navegue até o link do Microsoft PB do Tatico e recarregue a tela

# A extensão só funciona nas telas do PowerBI. O tempo atual de refresh automático da tela é de 60 minutos. O tempo que aparece na logo da extensão é atualizado a cada 5 segundos para poupar recursos do navegador e sistema

<img width="365" height="251" alt="image" src="https://github.com/user-attachments/assets/5ecca156-ab13-432a-8ca1-073bbe61af12" />


# ou pule todo esse passo a passo e instale automaticamente copiando e colando no terminal da maquina
curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash

# nova versao:
# use o argumento --tv padaria ou --tv acougue
# user o argumento --loja NOME_DA_LOJA_EM_CAIXA_ALTA para definir a loja
# use o argumento --update para atualizar o link do powerbi
# exemplo:

--tv padaria --update https://meu-novo-link-aqui.com

o comando acima irá atualizar o link do powerbi no inicializador automático do chrome

# exemplo sem atualizar a tv, configurando a tv da padaria em campinas:

curl -s https://raw.githubusercontent.com/Pedrohrn/taticoAutoClicker/main/tatico_google_tvs.sh | bash -s -- --tv padaria --loja CAMPINAS
