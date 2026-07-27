#!/bin/bash

# dando tempo pro sistema ligar componentes de vídeo e afins 
sleep 30 

# chrome keep-alive
while true; do
    # trocar pelo link da padaria/açougue
    google-chrome --start-fullscreen "https://app.powerbi.com/view?r=LINK_AQUI"

    # se ochrome fechar por qualquer motivo, espera 15 segundos e executa novamente
    sleep 15
done

# nao esqueça de dar permissao pro script com o comando:
# chmod +x ~/tatico_google_tvs.sh
