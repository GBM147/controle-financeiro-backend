    // --- SISTEMA DE INSTALAÇÃO DO APLICATIVO (PWA) ---
    // 1. Registar o motor (Service Worker)
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
        }).then((registro) => {
            console.log("Service Worker Registado!");
            return registro.update();
        }).catch((erro) => {
            console.warn('Não foi possível atualizar o aplicativo GBM.', erro);
        });
    }

    const ehIOS = /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
    const jaInstalado = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;

    // 2. Capturar o evento de instalação do Chrome/Android
    let promptInstalacao;
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        promptInstalacao = e;
        document.getElementById('btn-instalar-app').style.display = 'block';
    });

    // 3. No Safari/iOS não existe beforeinstallprompt — mostramos instrução manual
    if (ehIOS && !jaInstalado) {
        const btn = document.getElementById('btn-instalar-app');
        btn.innerText = 'Como instalar no iPhone';
        btn.style.display = 'block';
        btn.onclick = function() {
            gbmAlerta('Toque no ícone de compartilhar (quadrado com seta ↑) na barra do Safari e escolha "Adicionar à Tela de Início".', 'aviso');
        };
    } else {
        document.getElementById('btn-instalar-app').onclick = instalarGBM;
    }

    // 4. Função que roda quando o utilizador clica no botão (Chrome/Android)
    function instalarGBM() {
        if (promptInstalacao) {
            promptInstalacao.prompt();
            promptInstalacao.userChoice.then((resultado) => {
                if (resultado.outcome === 'accepted') {
                    console.log('Usuário instalou o App GBM!');
                }
                promptInstalacao = null;
                document.getElementById('btn-instalar-app').style.display = 'none';
            });
        }
    }
