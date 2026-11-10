        // Recupera o userId salvo
        function pegarUserId() {
            return window.GBMSession.getUserId();
        }

        // --- GUARDA DE ACESSO PREMIUM ---
        (async function verificarAcessoPremium() {
            try {
                const data = await window.gbmSessaoPronta;
                if (!data) return;
                let isPremium = false;
                if (data.statusPagamento === 'pago') {
                    isPremium = true;
                } else if (data.statusPagamento === 'trial' || data.statusPagamento === 'cancelado') {
                    if (data.trialExpira && new Date() <= new Date(data.trialExpira)) {
                        isPremium = true;
                    }
                }

                if (!isPremium) {
                    // Se não for Premium, expulsa para a tela de pagamento
                    window.location.href = 'pagamento.html';
                }
            } catch (e) {
                console.warn('Não foi possível verificar o plano agora.', e);
            }
        })();

        let meuGraficoComparativo = null;
        let dadosGraficoComparativo = [];

        const NOMES_MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                              'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
        const NOMES_MESES_ABREV = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];

        async function carregarAnosDisponiveis() {
            const select = document.getElementById('ano-ref');
            const anoAtual = new Date().getFullYear();
            try {
                const userId = pegarUserId();
                const res = await fetchApi(`/anos-disponiveis?userId=${userId}`);
                const anos = await res.json();

                if (!anos.includes(anoAtual)) anos.unshift(anoAtual);
                anos.sort((a, b) => b - a);

                select.innerHTML = anos.map(a => `<option value="${a}">${a}</option>`).join('');
            } catch (e) {
                select.innerHTML = `<option value="${anoAtual}">${anoAtual}</option>`;
            }
        }

        async function carregarComparativo() {
            const ano = document.getElementById('ano-ref').value;
            const container = document.getElementById('resultado-comparativo');
            container.innerHTML = '<p class="texto-vazio">Carregando...</p>';

            try {
                const userId = pegarUserId();
                const res = await fetchApi(`/comparativo-mensal?userId=${userId}&ano=${ano}`);
                const dados = await res.json();

                if (!dados || dados.length === 0) {
                    container.innerHTML = `<p class="texto-vazio">Nenhum dado encontrado para ${ano}.</p>`;
                    dadosGraficoComparativo = [];
                    if (meuGraficoComparativo) { meuGraficoComparativo.destroy(); meuGraficoComparativo = null; }
                    return;
                }

                // Monta um array com os 12 meses, preenchendo com zero quem não tem dado
                const mesesCompletos = [];
                for (let m = 1; m <= 12; m++) {
                    const encontrado = dados.find(d => d.mes === m);
                    mesesCompletos.push({
                        mes: m,
                        entradas: encontrado ? parseFloat(encontrado.entradas) || 0 : 0,
                        saidas: encontrado ? parseFloat(encontrado.saidas) || 0 : 0,
                        temDados: !!encontrado
                    });
                }

                const mesesComDados = mesesCompletos.filter(m => m.temDados);

                if (mesesComDados.length === 0) {
                    container.innerHTML = `<p class="texto-vazio">Nenhum dado encontrado para ${ano}.</p>`;
                    dadosGraficoComparativo = [];
                    if (meuGraficoComparativo) { meuGraficoComparativo.destroy(); meuGraficoComparativo = null; }
                    return;
                }

                // Totais do ano
                const totalEntradas = mesesComDados.reduce((s, m) => s + m.entradas, 0);
                const totalSaidas = mesesComDados.reduce((s, m) => s + m.saidas, 0);
                const mediaGastoMensal = totalSaidas / mesesComDados.length;

                // Melhor mês (menor gasto) e pior mês (maior gasto)
                let melhorMes = mesesComDados[0];
                let piorMes = mesesComDados[0];
                mesesComDados.forEach(m => {
                    if (m.saidas < melhorMes.saidas) melhorMes = m;
                    if (m.saidas > piorMes.saidas) piorMes = m;
                });

                let html = `
                    <div class="resumo-ano">
                        <div class="resumo-item">Total de entradas
                            <strong style="color: var(--cor-receita);">R$ ${totalEntradas.toFixed(2)}</strong>
                        </div>
                        <div class="resumo-item">Total de saídas
                            <strong style="color: var(--cor-despesa);">R$ ${totalSaidas.toFixed(2)}</strong>
                        </div>
                        <div class="resumo-item">Média de gasto mensal
                            <strong>R$ ${mediaGastoMensal.toFixed(2)}</strong>
                        </div>
                        <div class="resumo-item">Mês mais econômico
                            <strong style="color: var(--cor-receita);">${NOMES_MESES[melhorMes.mes]}</strong>
                        </div>
                    </div>

                    <div class="grafico-wrapper">
                        <canvas id="graficoComparativo"></canvas>
                    </div>

                    <table style="margin-top: 25px;">
                        <thead>
                            <tr>
                                <th>Mês</th>
                                <th style="text-align: right;">Entradas</th>
                                <th style="text-align: right;">Saídas</th>
                                <th style="text-align: right;">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>`;

                mesesCompletos.forEach(m => {
                    if (!m.temDados) return;
                    const resultado = m.entradas - m.saidas;
                    const corResultado = resultado >= 0 ? 'var(--cor-receita)' : 'var(--cor-despesa)';
                    let classeLinha = '';
                    let badge = '';
                    if (m.mes === melhorMes.mes) { classeLinha = 'linha-melhor-mes'; badge = '<span class="badge-mini badge-melhor">MENOR GASTO</span>'; }
                    if (m.mes === piorMes.mes && piorMes.mes !== melhorMes.mes) { classeLinha = 'linha-pior-mes'; badge = '<span class="badge-mini badge-pior">MAIOR GASTO</span>'; }

                    html += `
                        <tr class="${classeLinha}">
                            <td style="font-weight: 600;">${NOMES_MESES[m.mes]}${badge}</td>
                            <td style="text-align: right; color: var(--cor-receita);">R$ ${m.entradas.toFixed(2)}</td>
                            <td style="text-align: right; color: var(--cor-despesa);">R$ ${m.saidas.toFixed(2)}</td>
                            <td style="text-align: right; font-weight: 700; color: ${corResultado};">R$ ${resultado.toFixed(2)}</td>
                        </tr>`;
                });

                html += '</tbody></table>';
                container.innerHTML = html;

                dadosGraficoComparativo = mesesCompletos;
                desenharGrafico(mesesCompletos);

            } catch (error) {
                console.error(error);
                dadosGraficoComparativo = [];
                if (meuGraficoComparativo) { meuGraficoComparativo.destroy(); meuGraficoComparativo = null; }
                container.innerHTML = '<p class="texto-vazio">Erro ao carregar o comparativo. Tente novamente.</p>';
            }
        }

        function desenharGrafico(mesesCompletos) {
            if (meuGraficoComparativo) meuGraficoComparativo.destroy();
            const canvas = document.getElementById('graficoComparativo');
            if (!canvas || !mesesCompletos.length) return;
            const ctx = canvas.getContext('2d');
            const tipo = document.getElementById('tipo-grafico-comparativo')?.value || 'bar';
            const radar = tipo === 'radar';
            const linha = tipo === 'line';

            meuGraficoComparativo = new Chart(ctx, {
                type: tipo,
                data: {
                    labels: mesesCompletos.map(m => NOMES_MESES_ABREV[m.mes]),
                    datasets: [
                        {
                            label: 'Entradas',
                            data: mesesCompletos.map(m => m.entradas),
                            backgroundColor: radar ? 'rgba(57,217,138,.18)' : (linha ? 'rgba(57,217,138,.08)' : 'rgba(57,217,138,.72)'),
                            borderColor: '#39d98a',
                            borderWidth: linha || radar ? 2.5 : 1.5,
                            borderRadius: tipo === 'bar' ? 6 : 0,
                            fill: radar,
                            tension: linha ? .35 : 0,
                            pointBackgroundColor: '#39d98a',
                            pointRadius: linha || radar ? 3 : 0
                        },
                        {
                            label: 'Saídas',
                            data: mesesCompletos.map(m => m.saidas),
                            backgroundColor: radar ? 'rgba(85,167,255,.18)' : (linha ? 'rgba(85,167,255,.08)' : 'rgba(85,167,255,.72)'),
                            borderColor: '#55a7ff',
                            borderWidth: linha || radar ? 2.5 : 1.5,
                            borderRadius: tipo === 'bar' ? 6 : 0,
                            fill: radar,
                            tension: linha ? .35 : 0,
                            pointBackgroundColor: '#55a7ff',
                            pointRadius: linha || radar ? 3 : 0
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: radar ? {
                        r: { beginAtZero: true, grid: { color: 'rgba(255,255,255,.09)' }, angleLines: { color: 'rgba(255,255,255,.09)' }, pointLabels: { color: '#b0bec5' }, ticks: { display: false } }
                    } : {
                        x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ffffff' } },
                        y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#ffffff' }, beginAtZero: true }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { color: '#ffffff', boxWidth: 12, padding: 18 } },
                        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: R$ ${Number(context.raw || 0).toFixed(2)}` } }
                    }
                }
            });
        }

        function trocarTipoGraficoComparativo() {
            if (dadosGraficoComparativo.length) desenharGrafico(dadosGraficoComparativo);
        }

        // --- SISTEMA GBM DE NOTIFICAÇÕES/CONFIRMAÇÕES (padronizado em todas as páginas) ---
        let _resolveConfirm = null;

        const escaparMensagemModal = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[caractere]);

        function gbmAlerta(mensagem, tipo = 'info') {
            const cor   = tipo === 'erro'  ? 'rgba(239,68,68,0.3)'
                        : tipo === 'aviso' ? 'rgba(85,167,255,0.3)'
                        :                    'rgba(95,255,168,0.3)';

            document.getElementById('lista-notificacoes-modal').innerHTML = `
                <div style="background:rgba(15,23,42,0.8); border:1px solid ${cor}; border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
                    ${escaparMensagemModal(mensagem)}
                </div>`;

            document.getElementById('btn-confirmar-modal').style.display = 'none';
            document.getElementById('btn-fechar-modal').innerText = 'FECHAR';
            document.getElementById('modal-notificacoes').style.display = 'flex';
            _resolveConfirm = null;
        }

        function gbmConfirmar(mensagem) {
            return new Promise(resolve => {
                _resolveConfirm = resolve;

                document.getElementById('lista-notificacoes-modal').innerHTML = `
                    <div style="background:rgba(85,167,255,0.1); border:1px solid rgba(85,167,255,0.4); border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:0.95rem; line-height:1.6; text-align:center;">
                        ${escaparMensagemModal(mensagem)}
                    </div>`;

                document.getElementById('btn-confirmar-modal').style.display = 'block';
                document.getElementById('btn-fechar-modal').innerText = 'CANCELAR';
                document.getElementById('modal-notificacoes').style.display = 'flex';
            });
        }

        function fecharModalNotificacoes(confirmado = false) {
            document.getElementById('modal-notificacoes').style.display = 'none';
            if (_resolveConfirm) {
                _resolveConfirm(confirmado);
                _resolveConfirm = null;
            }
        }

        // --- INICIALIZAÇÃO ---
        (async function iniciar() {
            await carregarAnosDisponiveis();
            carregarComparativo();
        })();
