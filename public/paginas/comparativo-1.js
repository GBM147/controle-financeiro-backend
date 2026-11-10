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

                const moeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                let html = `
                    <div class="resumo-ano">
                        <div class="resumo-item">Total de entradas
                            <strong class="positivo">${moeda(totalEntradas)}</strong>
                        </div>
                        <div class="resumo-item">Total de saídas
                            <strong class="negativo">${moeda(totalSaidas)}</strong>
                        </div>
                        <div class="resumo-item">Média de gasto mensal
                            <strong>${moeda(mediaGastoMensal)}</strong>
                        </div>
                        <div class="resumo-item">Mês mais econômico
                            <strong>${NOMES_MESES[melhorMes.mes]}</strong>
                        </div>
                    </div>

                    <div class="grafico-wrapper">
                        <canvas id="graficoComparativo"></canvas>
                    </div>

                    <div class="tabela-rolagem tabela-comparativo"><table>
                        <thead>
                            <tr>
                                <th>Mês</th>
                                <th class="num">Entradas</th>
                                <th class="num">Saídas</th>
                                <th class="num">Resultado</th>
                            </tr>
                        </thead>
                        <tbody>`;

                mesesCompletos.forEach(m => {
                    if (!m.temDados) return;
                    const resultado = m.entradas - m.saidas;
                    const classeResultado = resultado >= 0 ? 'positivo' : 'negativo';
                    let classeLinha = '';
                    let badge = '';
                    if (m.mes === melhorMes.mes) { classeLinha = 'linha-melhor-mes'; badge = '<span class="badge-mini badge-melhor">Menor gasto</span>'; }
                    if (m.mes === piorMes.mes && piorMes.mes !== melhorMes.mes) { classeLinha = 'linha-pior-mes'; badge = '<span class="badge-mini badge-pior">Maior gasto</span>'; }

                    html += `
                        <tr class="${classeLinha}">
                            <td class="mes-nome">${NOMES_MESES[m.mes]}${badge}</td>
                            <td class="num">${moeda(m.entradas)}</td>
                            <td class="num">${moeda(m.saidas)}</td>
                            <td class="num ${classeResultado}">${moeda(resultado)}</td>
                        </tr>`;
                });

                html += '</tbody></table></div>';
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
                        ...[['Entradas', 'entradas', 'pos'], ['Saídas', 'saidas', 'neg']].map(([rotulo, campo, tom]) => GBMGraficos.tingir({
                            label: rotulo,
                            data: mesesCompletos.map(m => m[campo]),
                            gbmTokens: {
                                backgroundColor: radar ? [tom, 0.14] : (linha ? [tom, 0.06] : tom),
                                borderColor: tom,
                                pointBackgroundColor: tom
                            },
                            borderWidth: linha || radar ? 2 : 0,
                            borderRadius: tipo === 'bar' ? 4 : 0,
                            fill: radar,
                            pointRadius: linha || radar ? 2.5 : 0
                        }))
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: radar ? {
                        r: { beginAtZero: true, ticks: { display: false } }
                    } : {
                        x: { grid: { display: false }, border: { display: false } },
                        y: { border: { display: false }, beginAtZero: true }
                    },
                    plugins: {
                        legend: { position: 'bottom', labels: { padding: 14 } },
                        tooltip: { callbacks: { label: (context) => `${context.dataset.label}: ${Number(context.raw || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}` } }
                    }
                }
            });
        }

        function trocarTipoGraficoComparativo() {
            if (dadosGraficoComparativo.length) desenharGrafico(dadosGraficoComparativo);
        }


        // --- INICIALIZAÇÃO ---
        (async function iniciar() {
            await carregarAnosDisponiveis();
            carregarComparativo();
        })();
