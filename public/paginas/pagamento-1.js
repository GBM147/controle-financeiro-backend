    function pegarUserId() {
        return window.GBMSession.getUserId();
    }


    // Mostra o banner de trial se vier da tela de cadastro novo
    async function verificarStatusTrial() {
        try {
            const res = await fetchApi('/login-status');
            const data = await res.json();
            if (data.statusPagamento === 'trial') {
                document.getElementById('banner-trial').style.display = 'block';
                document.querySelector('.titulo-pagina').innerText = 'Ative o Premium com o 1º mês grátis';
            }
        } catch(e) {}
    }
    verificarStatusTrial();

    async function irParaPagamento() {
        const btn = document.getElementById('btn-action');
        btn.innerText = 'Redirecionando...';
        btn.disabled = true;

        try {
            const res = await fetchApi('/criar-sessao-pagamento', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ userId: pegarUserId() })
            });
            const data = await res.json();

            if(data.url) {
                window.location.href = data.url; // Leva o usuário para o checkout seguro do Mercado Pago
            } else {
                alert('Erro ao chamar o checkout. Tente novamente.');
                btn.innerText = 'Ativar Premium com 1º mês grátis';
                btn.disabled = false;
            }
        } catch (err) {
            alert('Erro na comunicação com o gateway.');
            btn.innerText = 'Ativar Premium com 1º mês grátis';
            btn.disabled = false;
        }
    }
    // Função para quem escolher o plano gratuito
    function continuarGratis() {
        const btn = document.getElementById('btn-gratis');
        btn.innerText = 'Entrando...';
        btn.disabled = true;
        window.location.href = 'dashboard.html';
    }
