// Variável global para sabermos o status do cliente em qualquer lugar da tela
        window.usuarioPremium = true; 
        window.usuarioEmTesteGratuito = false;

        function atualizarEstadoRecursosPremium(statusPagamento, trialExpira) {
            const itens = [
                document.getElementById('item-relatorio-mensal'),
                document.getElementById('item-comparativo-mensal')
            ].filter(Boolean);
            const cadeados = [
                document.getElementById('cadeado-relatorio'),
                document.getElementById('cadeado-comparativo')
            ].filter(Boolean);
            const aviso = document.getElementById('aviso-recursos-premium');
            if (!itens.length || !cadeados.length || !aviso) return;

            const status = String(statusPagamento || '').toLowerCase();
            const dataExpiracao = trialExpira ? new Date(trialExpira) : null;
            const prazoValido = dataExpiracao && !Number.isNaN(dataExpiracao.getTime())
                ? new Date() <= dataExpiracao
                : false;
            const assinaturaPaga = status === 'pago';
            const testeOuPrazoAtivo = (status === 'trial' || status === 'cancelado') && prazoValido;

            window.usuarioEmTesteGratuito = !assinaturaPaga && testeOuPrazoAtivo;
            const recursosBloqueados = !assinaturaPaga && !testeOuPrazoAtivo;
            itens.forEach((item) => {
                item.classList.toggle('recurso-bloqueado', recursosBloqueados);
                if (recursosBloqueados) item.setAttribute('aria-disabled', 'true');
                else item.removeAttribute('aria-disabled');
            });

            if (assinaturaPaga) {
                cadeados.forEach((cadeado) => { cadeado.style.display = 'none'; });
                aviso.style.display = 'none';
                aviso.textContent = '';
                return;
            }

            cadeados.forEach((cadeado) => { cadeado.style.display = 'inline-flex'; });
            aviso.style.display = 'block';

            if (testeOuPrazoAtivo) {
                aviso.textContent = 'Relatório Mensal e Comparativo estão disponíveis durante o teste gratuito. Ao final do teste, esses recursos ficarão indisponíveis no plano grátis.';
            } else {
                aviso.textContent = 'Relatório mensal e comparativo são recursos Premium e não estão disponíveis no plano grátis.';
            }
        }

        // --- GUARDA DE AUTENTICAÇÃO (FREEMIUM) ---
        window.promessaVerificacaoAcesso = (async function verificarAcesso() {
            try {
                const data = await window.gbmSessaoPronta;
                if (!data) return null;
                sincronizarIdentidadeLocal(data);

                let isPremium = false;
                
                // Verifica se é pagante ou se está num Trial/Cancelado ainda no prazo
                if (data.statusPagamento === 'pago') {
                    isPremium = true;
                } else if (data.statusPagamento === 'trial' || data.statusPagamento === 'cancelado') {
                    if (data.trialExpira) {
                        const dataExpiracao = new Date(data.trialExpira);
                        if (new Date() <= dataExpiracao) isPremium = true;
                    }
                }

                if (!isPremium) {
                    window.usuarioPremium = false; // Grava na memória que é gratuito
                    // O dashboard é uma tela de ferramenta/navegação. As políticas
                    // do AdSense não permitem anúncios nesse tipo de página.
                    console.log("Modo Gratuito: recursos básicos ativos.");
                } else {
                    console.log("Modo Premium: Tela limpa e sem anúncios.");
                }

                atualizarEstadoRecursosPremium(data.statusPagamento, data.trialExpira);
                return data;
            } catch (e) {
                console.warn('Não foi possível verificar o acesso agora.', e);
                return null;
            }
        })();

        // --- FUNÇÃO DA TRAVA DO MENU LATERAL ---
        function acessarRotaPremium(url, nomeRecurso) {
            if (window.usuarioPremium) {
                // Se for assinante, deixa passar direto
                window.location.href = url;
            } else {
                // Se for gratuito, fecha o menu e mostra a propaganda amigável
                fecharMenuLateral();
                gbmConfirmar(`A ferramenta <strong>${nomeRecurso}</strong> é uma funcionalidade exclusiva para assinantes do plano Premium.<br><br>Deseja assinar agora por apenas R$ 9,90 e liberar todos os recursos avançados sem anúncios?`).then((confirmado) => {
                    if (confirmado) {
                        window.location.href = 'pagamento.html';
                    }
                });
            }
        }
        // --- 1. TEMA ESCURO (Lembrar escolha) ---
        try {
            if (localStorage.getItem('tema') === 'dark') document.body.classList.add('dark-theme');
        } catch { /* O tema padrão também funciona com storage bloqueado. */ }
        let meuChart = null;
        // Recupera o userId salvo (permanente com "Manter conectado", ou só da aba atual)
        function pegarUserId() {
            return window.GBMSession.getUserId();
        }

        function fazerLogout() {
            encerrarSessao();
        }

        async function carregarAtalhoPerfil() {
            try {
                const resposta = await fetchApi('/perfil');
                const dados = await resposta.json();
                if (!dados.success) return;

                const perfil = dados.perfil;
                const foto = document.getElementById('foto-perfil-cabecalho');
                const nome = document.getElementById('nome-perfil-cabecalho');

                if (perfil.foto_perfil_url) {
                    foto.src = perfil.foto_perfil_url;
                }

                nome.innerText = perfil.nome_exibicao || perfil.nome || 'Meu perfil';

                DIA_FECHAMENTO = Number(perfil.dia_fechamento) || 1;
                montarSeletorDiaFechamento();
                atualizarRotuloPeriodo();
                carregarDados();
            } catch (erro) {
                console.warn('Não foi possível carregar o atalho de perfil.', erro);
            }
        }

        let dadosAPI = [];
        let BANCOS_CORES = {};

        // --- CICLO FINANCEIRO PERSONALIZADO ---
        // O usuário escolhe o dia em que o mês financeiro dele fecha (1, 5, 15, 20...).
        let DIA_FECHAMENTO = 1;
        const NOMES_MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                             'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

        // Devolve o mês/ano do ciclo vigente: se hoje ainda é antes do dia de
        // fechamento, o ciclo em andamento é o do mês anterior.
        function cicloAtual() {
            const hoje = new Date();
            const deslocado = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (DIA_FECHAMENTO - 1));
            return { mes: deslocado.getMonth() + 1, ano: deslocado.getFullYear() };
        }

        function intervaloCiclo(mes, ano) {
            const desloc = DIA_FECHAMENTO - 1;
            const inicio = new Date(ano, mes - 1, 1 + desloc);
            const fim = new Date(ano, mes, desloc); // último dia do ciclo
            const fmt = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
            return `${fmt(inicio)} a ${fmt(fim)}`;
        }

        function atualizarRotuloPeriodo() {
            const el = document.getElementById('rotulo-periodo-ciclo');
            if (!el) return;
            const { mes, ano } = cicloAtual();
            const mesesCurtos = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
            const desloc = DIA_FECHAMENTO - 1;
            const inicio = new Date(ano, mes - 1, 1 + desloc);
            const fim = new Date(ano, mes, desloc);
            const fmt = (d) => `${String(d.getDate()).padStart(2, '0')} ${mesesCurtos[d.getMonth()]}`;
            el.innerText = `${fmt(inicio)} — ${fmt(fim)}`;
        }

        function montarSeletorDiaFechamento() {
            const select = document.getElementById('dia-fechamento');
            if (!select) return;
            select.innerHTML = '';
            for (let dia = 1; dia <= 31; dia++) {
                select.innerHTML += `<option value="${dia}">Dia ${dia}</option>`;
            }
            select.value = String(DIA_FECHAMENTO);
        }

        async function salvarDiaFechamento() {
            const select = document.getElementById('dia-fechamento');
            const novoDia = Number(select.value) || 1;
            const anterior = DIA_FECHAMENTO;
            try {
                const respostaPerfil = await fetchApi('/perfil');
                const dadosPerfil = await respostaPerfil.json();
                const nomeAtual = (dadosPerfil.perfil && (dadosPerfil.perfil.nome_exibicao || dadosPerfil.perfil.nome)) || 'Meu perfil';

                const res = await fetchApi('/perfil', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome_exibicao: nomeAtual, dia_fechamento: novoDia })
                });
                const dados = await res.json();
                if (!res.ok || !dados.success) throw new Error(dados.message || 'Não foi possível salvar o dia de fechamento.');

                DIA_FECHAMENTO = novoDia;
                atualizarRotuloPeriodo();
                carregarDados();
                if (typeof carregarInsights === 'function') carregarInsights();
                gbmAlerta(`Fechamento do mês definido para o dia ${novoDia}.`, 'sucesso');
            } catch (erro) {
                select.value = String(anterior);
                gbmAlerta(erro.message, 'erro');
            }
        }

        montarSeletorDiaFechamento();
        atualizarRotuloPeriodo();

        async function carregarBancosInfo() {
            try {
                const res = await fetch('/bancos-info');
                BANCOS_CORES = await res.json();
            } catch (e) {
                console.error('Erro ao carregar cores de bancos:', e);
            }
        }

        // Monta a etiqueta pequena e colorida com o nome do banco
        function etiquetaBanco(nomeBanco) {
            if (!nomeBanco) return '';
            const cor = BANCOS_CORES[nomeBanco] || '#607d8b';
            return `<span style="display:inline-flex; align-items:center; gap:4px; font-size:0.75rem; color:${cor}; border:1px solid ${cor}55; background:${cor}18; padding:1px 8px; border-radius:10px; margin-left:6px; white-space:nowrap;"> ${escaparHtmlDashboard(nomeBanco)}</span>`;
        }
        // Preenche a data de hoje no lançamento rápido para facilitar
        const inputData = document.getElementById('manual-data');
        if (inputData) inputData.valueAsDate = new Date();
        // --- 2. MENU SANDUÍCHE E TEMA ---
        function toggleMenu(event) {
            event.stopPropagation();
            document.getElementById('dropdownMenu').classList.toggle('show');
        }
        window.onclick = function(event) {
            const menu = document.getElementById('dropdownMenu');
            if (menu && menu.classList.contains('show')) {
                menu.classList.remove('show');
            }
        }
        function alternarTema() { 
            document.body.classList.toggle('dark-theme'); 
            const modoEscuroAtivo = document.body.classList.contains('dark-theme');
            localStorage.setItem('tema', modoEscuroAtivo ? 'dark' : 'light');
            renderizarVisualizacao(); 
        }
        // --- 3. CARREGAR E DESENHAR DADOS ---
        async function carregarDados() {
            try {
                const { mes, ano } = cicloAtual();
                const userId = pegarUserId();
                const contaQuery = queryContaDashboard();
                const res = await fetchApi(`/resumo-financeiro?mes=${mes}&ano=${ano}&userId=${userId}${contaQuery}`);
                const json = await res.json();
                dadosAPI = json.data ? json.data : (Array.isArray(json) ? json : []);
                const saldoBanco = parseFloat(json.saldo_banco) || 0;

                atualizarResumoFinanceiro(saldoBanco);
                carregarEconomiaMensal();
                carregarGraficoResultado();
                renderizarVisualizacao();
                atualizarPulsoFinanceiro();
                atualizarPrincipaisCategorias();
                atualizarGraficoGastosCategorias();
                carregarUltimasMovimentacoes();
                carregarObjetivosDashboard();
                atualizarIdentidadeDashboard();
            } catch (err) { 
                console.error("Erro ao carregar dados:", err); 
            }
        }

        let graficoResultado = null;
        async function carregarGraficoResultado() {
            try {
                const { mes, ano } = cicloAtual();
                const res = await fetchApi(`/resumo-diario?mes=${mes}&ano=${ano}${queryContaDashboard()}`);
                const dados = await res.json();
                const serie = dados.serie || [];
                const labels = serie.map((p) => {
                    const [, m, d] = p.data.split('-');
                    return `${d}/${m}`;
                });
                const valores = serie.map((p) => Number(p.resultado_acumulado) || 0);
                const ctx = document.getElementById('grafico-resultado-periodo')?.getContext('2d');
                if (!ctx || typeof Chart === 'undefined') return;
                if (graficoResultado) graficoResultado.destroy();

                const ultimoValor = valores.length ? valores[valores.length - 1] : 0;
                const linha = ultimoValor < 0 ? '#ff5d6c' : '#39d98a';
                const area = ultimoValor < 0 ? 'rgba(255,93,108,.14)' : 'rgba(57,217,138,.10)';

                graficoResultado = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels,
                        datasets: [{
                            label: 'Resultado',
                            data: valores,
                            borderColor: linha,
                            backgroundColor: area,
                            borderWidth: 2.2,
                            fill: true,
                            tension: .38,
                            pointRadius: 0,
                            pointHoverRadius: 3,
                            pointHoverBackgroundColor: linha,
                            pointHoverBorderColor: '#07111c',
                            pointHoverBorderWidth: 2
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        interaction: { mode: 'index', intersect: false },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                enabled: true,
                                displayColors: false,
                                backgroundColor: '#101c2b',
                                borderColor: 'rgba(255,255,255,.10)',
                                borderWidth: 1,
                                titleColor: '#edf5fb',
                                bodyColor: '#b8c6d5',
                                padding: 10,
                                callbacks: {
                                    label: (contexto) => ' ' + Number(contexto.raw || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { color: 'rgba(148,163,184,.055)' },
                                border: { display: false },
                                ticks: { color: '#65768b', maxTicksLimit: 7, font: { family: 'Inter', size: 10 } }
                            },
                            y: {
                                grid: { color: 'rgba(148,163,184,.065)' },
                                border: { display: false },
                                ticks: {
                                    color: '#65768b',
                                    font: { family: 'Inter', size: 10 },
                                    callback: (valor) => Number(valor).toLocaleString('pt-BR', { notation: 'compact', maximumFractionDigits: 1 })
                                }
                            }
                        }
                    }
                });
            } catch (erro) {
                console.error('Erro ao carregar o gráfico do período:', erro);
            }
        }


        async function atualizarIdentidadeDashboard() {
            const nomeEl = document.getElementById('dashboard-nome');
            const dataEl = document.getElementById('dashboard-data-atual');
            if (dataEl) {
                dataEl.textContent = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
            }
            if (!nomeEl) return;
            try {
                const resposta = await fetchApi('/perfil');
                const dados = await resposta.json();
                const perfil = dados.perfil || dados;
                nomeEl.textContent = perfil.nome_exibicao || perfil.nome || 'Giovanni';
            } catch {
                nomeEl.textContent = 'Giovanni';
            }
        }

        async function carregarUltimasMovimentacoes() {
            const lista = document.getElementById('ultimas-movimentacoes-lista');
            if (!lista) return;
            try {
                const { mes, ano } = cicloAtual();
                const resposta = await fetchApi(`/transacoes-individuais?mes=${mes}&ano=${ano}${queryContaDashboard()}`);
                const dados = await resposta.json();
                if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar as movimentações.');
                const recentes = (Array.isArray(dados) ? [...dados] : [])
                    .sort((a, b) => String(b.data_transacao || '').localeCompare(String(a.data_transacao || '')))
                    .slice(0, 5);
                if (!recentes.length) {
                    lista.innerHTML = '<div class="dashboard-v3-empty">Nenhuma movimentação no período.</div>';
                    return;
                }
                lista.innerHTML = recentes.map((item) => {
                    const receita = item.tipo === 'Receita';
                    const valor = Math.abs(Number(String(item.total_movimentado || item.valor || 0).replace(',', '.')) || 0);
                    const data = String(item.data_transacao || '').slice(0, 10);
                    const dataFmt = data ? data.split('-').reverse().join('/') : '—';
                    const descricao = item.descricao || item.categoria || 'Movimentação';
                    const categoria = item.categoria || item.tipo || 'Sem categoria';
                    return '<div class="dashboard-v3-transaction">' +
                        '<span class="dashboard-v3-transaction-icon ' + (receita ? 'receita' : 'despesa') + '">' + (receita ? '↑' : '•') + '</span>' +
                        '<div class="dashboard-v3-transaction-main"><strong>' + escaparHtmlDashboard(descricao) + '</strong><span>' + escaparHtmlDashboard(categoria) + '</span></div>' +
                        '<div class="dashboard-v3-transaction-value ' + (receita ? 'receita' : 'despesa') + '"><strong>' + (receita ? '+' : '-') + ' ' + formatarMoedaDashboard(valor) + '</strong><span>' + dataFmt + '</span></div>' +
                    '</div>';
                }).join('');
            } catch (erro) {
                console.error('Erro ao carregar últimas movimentações:', erro);
                lista.innerHTML = '<div class="dashboard-v3-empty">Não foi possível carregar as movimentações.</div>';
            }
        }

        async function carregarObjetivosDashboard() {
            const lista = document.getElementById('objetivos-dashboard-lista');
            if (!lista) return;
            try {
                const resposta = await fetchApi('/objetivos');
                const dados = await resposta.json();
                if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar os objetivos.');
                const objetivos = (Array.isArray(dados) ? dados : []).filter((objetivo) => objetivo.status === 'ativo').slice(0, 4);
                if (!objetivos.length) {
                    lista.innerHTML = '<div class="dashboard-v3-empty">Você ainda não tem metas ativas.</div>';
                    return;
                }
                lista.innerHTML = objetivos.map((objetivo) => {
                    const meta = Math.max(0, Number(objetivo.valor_meta) || 0);
                    const guardado = Math.max(0, Number(objetivo.valor_guardado) || 0);
                    const percentual = meta > 0 ? Math.min(100, (guardado / meta) * 100) : 0;
                    return '<div class="dashboard-v3-goal">' +
                        '<span class="dashboard-v3-goal-icon">◎</span>' +
                        '<div class="dashboard-v3-goal-main"><strong>' + escaparHtmlDashboard(objetivo.nome || 'Objetivo') + '</strong><span>' + formatarMoedaDashboard(guardado) + ' / ' + formatarMoedaDashboard(meta) + '</span><div class="dashboard-v3-goal-bar"><i style="width:' + percentual.toFixed(1) + '%"></i></div></div>' +
                        '<span class="dashboard-v3-goal-pct">' + percentual.toFixed(0) + '%</span>' +
                    '</div>';
                }).join('');
            } catch (erro) {
                console.error('Erro ao carregar metas do dashboard:', erro);
                lista.innerHTML = '<div class="dashboard-v3-empty">Não foi possível carregar suas metas.</div>';
            }
        }

        function atualizarDropdownCategorias() {
    const selectMeta = document.getElementById('meta-categoria');
    if (!selectMeta) return;

    const selecionadaAntes = selectMeta.value;
    selectMeta.innerHTML = '<option value="" disabled selected>Categoria...</option>';

    const categoriasUnicas = [...new Set(dadosAPI.map(i => i.categoria).filter(c => c))];

    CATEGORIAS_DISPONIVEIS.forEach(padrao => {
        if (!categoriasUnicas.includes(padrao)) categoriasUnicas.push(padrao);
    });

    categoriasUnicas.forEach(cat => selectMeta.appendChild(new Option(String(cat), String(cat))));

    if (selecionadaAntes) selectMeta.value = selecionadaAntes;
}
        function formatarMoedaDashboard(valor) {
            const numero = Number(valor) || 0;
            return numero.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        }

        function atualizarResumoFinanceiro(saldoBancoReal = 0) {
    let ent = 0, sai = 0;
    dadosAPI.forEach(item => {
        let v = parseFloat(String(item.total_movimentado || item.valor || 0).replace(/[R$\s+\-]/g, ''));
        if (!isNaN(v)) {
            if (item.tipo === 'Receita') ent += v; else sai += v;
        }
    });
    document.getElementById('total-entradas').innerText = formatarMoedaDashboard(ent);
    document.getElementById('total-saidas').innerText = formatarMoedaDashboard(sai);
    const saldoTotalDashboard = document.getElementById('saldo-total-dashboard');
    if (saldoTotalDashboard) saldoTotalDashboard.innerText = formatarMoedaDashboard(saldoBancoReal);

    // Card 3: resultado do período (as contas batem: Entradas - Saídas)
    const periodo = ent - sai;
    const elPeriodo = document.getElementById('saldo-liquido');
    elPeriodo.innerText = formatarMoedaDashboard(periodo);
    elPeriodo.style.color = periodo < 0 ? '#ff5d6c' : '#f4f8fc';
    elPeriodo.style.textShadow = 'none';

    const badgeTaxa = document.getElementById('taxa-poupada-badge');
    if (badgeTaxa) {
        if (ent > 0) {
            const taxa = (periodo / ent) * 100;
            badgeTaxa.style.display = 'inline-flex';
            badgeTaxa.innerHTML = `Taxa poupada <strong>${taxa.toFixed(1)}%</strong>`;
        } else {
            badgeTaxa.style.display = 'none';
        }
    }

    const badgeSaidas = document.getElementById('comparativo-saidas');
    if (badgeSaidas) {
        if (ent > 0) {
            const percentualUsado = (sai / ent) * 100;
            badgeSaidas.style.display = 'block';
            badgeSaidas.className = 'badge-comparativo-fluxo ' + (percentualUsado > 100 ? 'negativo' : 'neutro');
            badgeSaidas.innerText = `${percentualUsado.toFixed(1)}% das entradas utilizadas`;
        } else {
            badgeSaidas.style.display = 'none';
        }
    }

    window._resumoFluxoAtual = { ent, sai, periodo };
}

        // --- CARD: PULSO FINANCEIRO (barra de gasto/preservado/meta) ---
        const META_TAXA_POUPADA = 15; // meta padrão de % preservado da renda
        function atualizarPulsoFinanceiro() {
            const resumo = window._resumoFluxoAtual || { ent: 0, sai: 0, periodo: 0 };
            const barra = document.getElementById('pulso-barra-preenchimento');
            const marcador = document.getElementById('pulso-marcador-meta');
            const elGasto = document.getElementById('pulso-gasto');
            const elPreservado = document.getElementById('pulso-preservado');
            const elMeta = document.getElementById('pulso-meta');
            const elStatus = document.getElementById('pulso-status-texto');
            const elStatusTitulo = document.getElementById('pulso-status-titulo');
            if (!barra || !elGasto || !elPreservado) return;

            const ent = resumo.ent || 0;
            const gastoPct = ent > 0 ? Math.min(100, (resumo.sai / ent) * 100) : 0;
            const preservadoPct = ent > 0 ? Math.max(0, 100 - gastoPct) : 0;

            barra.style.width = `${gastoPct.toFixed(1)}%`;
            if (marcador) marcador.style.left = `${Math.min(100, META_TAXA_POUPADA)}%`;
            elGasto.innerText = `${gastoPct.toFixed(1)}%`;
            elPreservado.innerText = `${preservadoPct.toFixed(1)}%`;
            if (elMeta) elMeta.innerText = `${META_TAXA_POUPADA}%`;

            if (elStatusTitulo && elStatus) {
                if (preservadoPct >= META_TAXA_POUPADA) {
                    elStatusTitulo.innerText = 'Seu mês permanece positivo';
                    elStatus.innerText = `Você já preservou ${preservadoPct.toFixed(1)}% da renda, acima da meta de ${META_TAXA_POUPADA}%.`;
                } else {
                    const faltam = Math.max(0, META_TAXA_POUPADA - preservadoPct);
                    elStatusTitulo.innerText = ent > 0 ? 'Faltam pontos para a meta' : 'Sem entradas no período';
                    elStatus.innerText = ent > 0
                        ? `Faltam ${faltam.toFixed(1)} pontos para alcançar a meta.`
                        : 'Registre entradas para calcular sua taxa poupada.';
                }
            }
        }


        let graficoGastosCategorias = null;

        function atualizarGraficoGastosCategorias() {
            const canvas = document.getElementById('grafico-gastos-categorias');
            const vazio = document.getElementById('grafico-gastos-categorias-vazio');
            if (!canvas || typeof Chart === 'undefined') return;

            const porCategoria = new Map();
            dadosAPI.forEach((item) => {
                if (item.tipo !== 'Despesa') return;
                const valor = Math.abs(parseFloat(String(item.total_movimentado || item.valor || 0).replace(',', '.'))) || 0;
                const categoria = item.categoria || 'Outros';
                porCategoria.set(categoria, (porCategoria.get(categoria) || 0) + valor);
            });

            const ordenadas = [...porCategoria.entries()]
                .filter(([, valor]) => valor > 0)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 6);

            const temDados = ordenadas.length > 0;
            canvas.hidden = !temDados;
            if (vazio) vazio.hidden = temDados;

            if (graficoGastosCategorias) {
                graficoGastosCategorias.destroy();
                graficoGastosCategorias = null;
            }
            if (!temDados) return;

            const cores = ['#55a7ff','#39d98a','#8b6cff','#6f91b6','#3a6d93','#8aa2b8'];
            graficoGastosCategorias = new Chart(canvas.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: ordenadas.map(([categoria]) => categoria),
                    datasets: [{
                        data: ordenadas.map(([, valor]) => valor),
                        backgroundColor: cores,
                        borderColor: '#0d1825',
                        borderWidth: 3,
                        hoverOffset: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '70%',
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: {
                                color: '#8191a4',
                                boxWidth: 8,
                                boxHeight: 8,
                                padding: 10,
                                font: { family: 'Inter', size: 9 }
                            }
                        },
                        tooltip: {
                            displayColors: false,
                            backgroundColor: '#101c2b',
                            borderColor: 'rgba(255,255,255,.10)',
                            borderWidth: 1,
                            titleColor: '#edf5fb',
                            bodyColor: '#b8c6d5',
                            callbacks: {
                                label: (contexto) => {
                                    const valor = Number(contexto.raw || 0);
                                    return ' ' + valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                                }
                            }
                        }
                    }
                }
            });
        }

        // --- CARD: PRINCIPAIS CATEGORIAS (participação das despesas no período) ---
        function atualizarPrincipaisCategorias() {
            const lista = document.getElementById('principais-categorias-lista');
            if (!lista) return;

            const despesasPorCategoria = new Map();
            let totalDespesas = 0;
            dadosAPI.forEach((item) => {
                if (item.tipo !== 'Despesa') return;
                const valor = Math.abs(parseFloat(String(item.total_movimentado || item.valor || 0).replace(',', '.'))) || 0;
                const categoria = item.categoria || 'Outros';
                despesasPorCategoria.set(categoria, (despesasPorCategoria.get(categoria) || 0) + valor);
                totalDespesas += valor;
            });

            if (!totalDespesas || despesasPorCategoria.size === 0) {
                lista.innerHTML = '<div class="categoria-participacao-item"><span class="categoria-participacao-vazio">Sem despesas no período.</span></div>';
                return;
            }

            const cores = ['#55a7ff', '#39d98a', '#55a7ff', '#39d98a', '#55a7ff'];
            const ordenadas = [...despesasPorCategoria.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);

            lista.innerHTML = ordenadas.map(([categoria, valor], indice) => {
                const pct = (valor / totalDespesas) * 100;
                const cor = cores[indice % cores.length];
                return `
                    <div class="categoria-participacao-item">
                        <div class="categoria-participacao-topo">
                            <span class="categoria-participacao-nome">${escaparHtmlDashboard(categoria)}</span>
                            <span class="categoria-participacao-pct">${pct.toFixed(0)}%</span>
                        </div>
                        <div class="categoria-participacao-barra-fundo">
                            <div class="categoria-participacao-barra-preenchimento" style="width:${pct.toFixed(1)}%; background:${cor};"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }

        // Card 4: quanto você economizou (ou gastou a mais) comparado ao mês anterior
        async function carregarEconomiaMensal() {
            try {
                const { mes, ano } = cicloAtual();
                const userId = pegarUserId();

                const res = await fetchApi(`/economia-mensal?userId=${userId}&mes=${mes}&ano=${ano}${queryContaDashboard()}`);
                const dados = await res.json();

                const elEconomia = document.getElementById('economia-mensal');
                const elDetalhe = document.getElementById('detalhe-economia');

                if (!dados.temMesAnterior) {
                    elEconomia.innerText = '—';
                    elEconomia.style.color = 'var(--texto-mutado)';
                    elEconomia.style.textShadow = 'none';
                    elDetalhe.innerText = 'Sem dados do mês anterior para comparar ainda.';
                    return;
                }

                const economia = dados.economia || 0;
                const positivo = economia >= 0;

                elEconomia.innerText = `${positivo ? '+' : '-'} ${formatarMoedaDashboard(Math.abs(economia))}`;
                elEconomia.style.color = positivo ? '#2ecc71' : '#ff4d4d';
                elEconomia.style.textShadow = positivo ? '0 0 5px rgba(46,204,113,0.3)' : '0 0 5px rgba(255,77,77,0.3)';

                const percentualTexto = dados.percentual !== null ? ` (${Math.abs(dados.percentual).toFixed(1)}%)` : '';
                elDetalhe.innerText = positivo
                    ? `Você gastou ${formatarMoedaDashboard(Math.abs(economia))} a menos que o mês passado${percentualTexto}.`
                    : `Você gastou ${formatarMoedaDashboard(Math.abs(economia))} a mais que o mês passado${percentualTexto}.`;

                const badgeResultado = document.getElementById('detalhe-economia-resultado');
                if (badgeResultado) {
                    badgeResultado.style.display = 'inline-flex';
                    badgeResultado.style.borderColor = positivo ? 'rgba(57,217,138,.35)' : 'rgba(255,93,108,.35)';
                    badgeResultado.style.background = positivo ? 'rgba(57,217,138,.1)' : 'rgba(255,93,108,.1)';
                    badgeResultado.style.color = positivo ? '#8bffc1' : '#ff9aa4';
                    badgeResultado.innerText = `${positivo ? '↑' : '↓'} ${formatarMoedaDashboard(Math.abs(economia))} ${positivo ? 'melhor' : 'pior'} que antes`;
                }

                const badgeEntradas = document.getElementById('comparativo-entradas');
                if (badgeEntradas) {
                    if (dados.percentualReceita === null || dados.percentualReceita === undefined) {
                        badgeEntradas.style.display = 'none';
                    } else {
                        const receitaSubiu = dados.percentualReceita >= 0;
                        badgeEntradas.style.display = 'block';
                        badgeEntradas.className = 'badge-comparativo-fluxo ' + (receitaSubiu ? 'positivo' : 'negativo');
                        badgeEntradas.innerText = `${Math.abs(dados.percentualReceita).toFixed(1)}% ${receitaSubiu ? 'acima' : 'abaixo'} do mês anterior`;
                    }
                }
            } catch (e) {
                console.error('Erro ao carregar economia mensal:', e);
            }
        }

        function renderizarVisualizacao() {
            const tipoExibicao = document.getElementById('select-tipo').value;
            const tipoGrafico = document.getElementById('select-grafico-dashboard')?.value || 'bar';
            const containerPai = document.getElementById('container-do-grafico');
            const tabelaDiv = document.getElementById('minhaTabelaContainer');
            const graficoDiv = document.getElementById('wrapper-do-grafico');
            const corpoTabela = document.getElementById('corpo-tabela');

            const isHibrido = tipoExibicao === 'both';
            const showTable = tipoExibicao !== 'chart';
            const showChart = tipoExibicao !== 'table';

            if (containerPai) {
                containerPai.classList.toggle('hibrido', isHibrido);
                containerPai.classList.toggle('somente-grafico', tipoExibicao === 'chart');
            }

            if (tabelaDiv) tabelaDiv.style.display = showTable ? 'block' : 'none';
            if (graficoDiv) graficoDiv.style.display = showChart ? 'block' : 'none';

            // Constrói a Tabela
            if (showTable && corpoTabela) {
                corpoTabela.innerHTML = ''; 
                if (dadosAPI.length === 0) {
                    corpoTabela.innerHTML = `<tr><td colspan="2" style="text-align: center; padding: 30px;">Sem dados registrados.</td></tr>`;
                } else {
                    dadosAPI.forEach(item => {
                        const isCredit = item.tipo === 'Receita';
                        const valorLimpo = Math.abs(parseFloat(String(item.total_movimentado || item.valor || 0).replace(/[R$\s+\-]/g, '')));
                        const sinal = isCredit ? '+' : '-';
                        
                       corpoTabela.innerHTML += `
                                <tr>
                                    <td style="font-weight: 600;">${escaparHtmlDashboard(item.categoria || 'Sem Categoria')}${etiquetaBanco(item.banco)}</td>
                                    <td style="font-weight: bold;">${sinal} R$ ${valorLimpo.toFixed(2)}</td>
                                </tr>
                            `;
                        aplicarCoresFinanceiras();
                    });
                }
            }

            if (showChart) {
                if (meuChart) meuChart.destroy();
                const ctx = document.getElementById('meuGrafico').getContext('2d');

                // Só mostra o banco no rótulo do eixo se houver mais de 1 banco nos dados
                const bancosDistintos = new Set(dadosAPI.map(i => i.banco).filter(Boolean));
                const mostrarBancoNoRotulo = bancosDistintos.size > 1;
                const circular = tipoGrafico === 'doughnut';
                const valores = dadosAPI.map(i => Math.abs(parseFloat(String(i.total_movimentado || i.valor || 0).replace(',', '.'))) || 0);

                // Padrão visual financeiro dos gráficos comuns: entradas = verde, saídas = vermelho.
                const fundos = dadosAPI.map(i => i.tipo === 'Receita' ? 'rgba(57, 217, 138, .76)' : 'rgba(255, 77, 77, .76)');
                const bordas = dadosAPI.map(i => i.tipo === 'Receita' ? '#39d98a' : '#ff4d4d');

                // Na rosca, cada categoria de gasto recebe uma cor própria para que
                // a legenda (caixas abaixo do gráfico) identifique exatamente cada gasto.
                const coresGastosRosca = [
                    '#ff4d4d', '#ff7a59', '#ffb84d', '#a78bfa', '#f472b6',
                    '#60a5fa', '#22d3ee', '#f59e0b', '#c084fc', '#fb7185'
                ];
                const mapaCoresRosca = new Map();
                let indiceCorGasto = 0;
                const corRoscaDaCategoria = (categoria) => {
                    const chave = String(categoria || 'Outros');
                    if (!mapaCoresRosca.has(chave)) {
                        mapaCoresRosca.set(chave, coresGastosRosca[indiceCorGasto % coresGastosRosca.length]);
                        indiceCorGasto += 1;
                    }
                    return mapaCoresRosca.get(chave);
                };

                let labelsGrafico;
                let valoresGrafico;
                let fundosGrafico;
                let bordasGrafico;
                let detalhesGrafico;

                if (circular) {
                    const porGrupo = new Map();
                    dadosAPI.forEach((item) => {
                        const valor = Math.abs(parseFloat(String(item.total_movimentado || item.valor || 0).replace(',', '.'))) || 0;
                        if (!valor) return;
                        const tipo = item.tipo === 'Receita' ? 'Entrada' : 'Saída';
                        const categoria = String(item.categoria || 'Outros');
                        const chave = `${tipo}::${categoria}`;
                        const atual = porGrupo.get(chave) || { tipo, categoria, valor: 0, banco: item.banco || '' };
                        atual.valor += valor;
                        porGrupo.set(chave, atual);
                    });

                    const grupos = [...porGrupo.values()];
                    labelsGrafico = grupos.map((grupo) => `${grupo.categoria} — ${grupo.tipo}`);
                    valoresGrafico = grupos.map((grupo) => grupo.valor);
                    fundosGrafico = grupos.map((grupo) =>
                        grupo.tipo === 'Entrada' ? '#39d98a' : corRoscaDaCategoria(grupo.categoria)
                    );
                    bordasGrafico = fundosGrafico.map((cor) => cor);
                    detalhesGrafico = grupos;
                } else {
                    labelsGrafico = dadosAPI.map(i => {
                        const categoria = i.categoria || 'Outros';
                        const tipo = i.tipo === 'Receita' ? 'Entrada' : 'Saída';
                        const base = mostrarBancoNoRotulo && i.banco ? `${categoria} (${i.banco})` : categoria;
                        return `${base} — ${tipo}`;
                    });
                    valoresGrafico = valores;
                    fundosGrafico = fundos;
                    bordasGrafico = bordas;
                    detalhesGrafico = dadosAPI;
                }

                const dataset = {
                    label: 'Valor movimentado',
                    data: valoresGrafico,
                    backgroundColor: tipoGrafico === 'line'
                        ? (detalhesGrafico.length && detalhesGrafico[detalhesGrafico.length - 1]?.tipo === 'Despesa'
                            ? 'rgba(255, 77, 77, .14)'
                            : 'rgba(57, 183, 122, .10)')
                        : fundosGrafico,
                    borderColor: tipoGrafico === 'line'
                        ? (detalhesGrafico.length && detalhesGrafico[detalhesGrafico.length - 1]?.tipo === 'Despesa'
                            ? '#ff4d4d' : '#26874E')
                        : bordasGrafico,
                    borderWidth: tipoGrafico === 'line' ? 2.5 : (circular ? 2 : 1.5),
                    borderRadius: tipoGrafico === 'bar' ? 7 : 0,
                    borderSkipped: false,
                    fill: tipoGrafico === 'line',
                    tension: tipoGrafico === 'line' ? .35 : 0,
                    pointBackgroundColor: tipoGrafico === 'line' ? bordasGrafico : undefined,
                    pointBorderColor: tipoGrafico === 'line' ? bordasGrafico : undefined,
                    pointRadius: tipoGrafico === 'line' ? 3 : undefined,
                    pointHoverRadius: tipoGrafico === 'line' ? 5 : undefined,
                    ...(tipoGrafico === 'line' ? {
                        segment: {
                            borderColor: (context) => {
                                const indice = context.p1DataIndex ?? context.p0DataIndex ?? 0;
                                return dadosAPI[indice]?.tipo === 'Receita' ? '#39d98a' : '#ff4d4d';
                            }
                        }
                    } : {})
                };

                meuChart = new Chart(ctx, {
                    type: tipoGrafico,
                    data: {
                        labels: labelsGrafico,
                        datasets: [dataset]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: circular ? undefined : {
                            x: { grid: { display: false }, ticks: { color: '#b0bec5' } },
                            y: { grid: { color: 'rgba(255,255,255,.06)' }, ticks: { color: '#b0bec5' }, beginAtZero: true }
                        },
                        plugins: {
                            legend: { display: circular, position: 'bottom', labels: { color: '#eef6ff', boxWidth: 12, padding: 16 } },
                            tooltip: {
                                callbacks: {
                                    label: function(context) {
                                        const item = detalhesGrafico[context.dataIndex];
                                        const tipo = item?.tipo || 'Movimentação';
                                        const categoria = item?.categoria ? `${item.categoria}: ` : '';
                                        return `${categoria}${tipo}: R$ ${Number(context.raw || 0).toFixed(2)}`;
                                    },
                                    afterLabel: function(context) {
                                        const item = detalhesGrafico[context.dataIndex];
                                        return item && item.banco ? `Banco: ${item.banco}` : '';
                                    }
                                }
                            }
                        }
                    }
                });
            } else if (meuChart) {
                meuChart.destroy();
                meuChart = null;
            }
        }

        // --- 4. FUNÇÕES DOS BOTÕES (Lançar e Metas) ---
        function queryContaDashboard() {
            const contaId = Number(document.getElementById('filtro-conta-dashboard')?.value || 0);
            return contaId > 0 ? `&conta_id=${contaId}` : '';
        }

        function trocarContaDashboard() {
            const contaId = document.getElementById('filtro-conta-dashboard').value;
            if (contaId) document.getElementById('manual-conta').value = contaId;
            carregarDados();
            carregarInsights();
            carregarGraficoResultado();
        }

        async function carregarContasLancamento() {
            const seletor = document.getElementById('manual-conta');
            const filtro = document.getElementById('filtro-conta-dashboard');
            try {
                const resposta = await fetchApi('/contas');
                if (!resposta.ok) throw new Error('Não foi possível carregar as contas.');
                const contas = (await resposta.json()).filter((conta) => Number(conta.ativa) !== 0);
                const opcoes = contas.map((conta) => `<option value="${Number(conta.id)}">${escaparHtmlDashboard(conta.nome || conta.nome_personalizado || 'Conta')}</option>`).join('');
                seletor.innerHTML = contas.length
                    ? opcoes
                    : '<option value="">Cadastre uma conta primeiro</option>';
                filtro.innerHTML = `<option value="">Todas as contas</option>${opcoes}`;
            } catch (erro) {
                seletor.innerHTML = '<option value="">Conta indisponível</option>';
                filtro.innerHTML = '<option value="">Todas as contas</option>';
            }
        }

        async function salvarLancamentoManual() {
            const descricao = document.getElementById('manual-desc').value;
            const valor = document.getElementById('manual-valor').value;
            const tipo = document.getElementById('manual-tipo').value;
            const categoria = document.getElementById('manual-cat').value;
            const data_transacao = document.getElementById('manual-data').value;
            const conta_id = Number(document.getElementById('manual-conta').value);

            if (!conta_id) return gbmAlerta("Cadastre ou selecione uma conta.", 'aviso');
            if (!descricao || !valor || !data_transacao) return gbmAlerta("Preencha todos os campos!", 'erro');

            try {
                const userId = pegarUserId();
                const resposta = await fetchApi('/transacao-manual', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ descricao, valor: parseFloat(valor), tipo, categoria, data_transacao, conta_id, userId })
                });
                const jsonRetorno = await resposta.json();
                if (jsonRetorno.success) {
                    document.getElementById('manual-desc').value = '';
                    document.getElementById('manual-valor').value = '';
                    carregarDados(); // Recarrega a tabela na hora!
                } else { gbmAlerta("Erro no servidor.", 'erro'); }
            } catch (error) { gbmAlerta("Falha na comunicação.", 'erro'); }
        }

        async function salvarMeta() {
            const categoria = document.getElementById('meta-categoria').value;
            const valor = document.getElementById('meta-valor').value;
            if (!categoria || !valor) return gbmAlerta('Selecione uma categoria e digite o valor limite.', 'aviso');
            
            try {
                const userId = pegarUserId();
                await fetchApi('/metas', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoria, valor_limite: parseFloat(valor), userId })
                });
                document.getElementById('meta-valor').value = '';
                carregarDados();
                gbmAlerta("Limite salvo com sucesso!");
            } catch (error) { gbmAlerta('Erro ao salvar o limite.', 'erro'); }
        }

        async function removerMeta() {
            const categoria = document.getElementById('meta-categoria').value;
            if (!categoria) return gbmAlerta('Selecione uma categoria primeiro.', 'aviso');
            try {
                const userId = pegarUserId();
                await fetchApi('/metas', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoria, userId })
                });
                document.getElementById('meta-valor').value = '';
                carregarDados();
                gbmAlerta("Limite removido!");
            } catch (error) { gbmAlerta('Erro ao remover o limite.', 'erro'); }
        }
        function aplicarCoresFinanceiras() {
            // Procura todos os textos dentro da tabela e dos cards superiores
            const elementosValores = document.querySelectorAll('td, .card p');
            
            elementosValores.forEach(el => {
                const texto = el.innerText;
                // Lê todo o texto da caixa (para sabermos se estamos na caixa de "Saídas")
                const textoDoCard = el.parentElement.innerText.toLowerCase(); 
                
                // Se o texto contiver o símbolo de dinheiro...
                if (texto.includes('R$')) {
                    // Se for negativo (tiver sinal de menos) OU estiver dentro da caixa de "Gasto" / "Saídas"
                    if (texto.includes('-') || textoDoCard.includes('gasto') || textoDoCard.includes('saídas') || textoDoCard.includes('saidas')) {
                        el.style.color = '#ff4d4d'; // Vermelho vivo
                        el.style.textShadow = '0 0 5px rgba(255, 77, 77, 0.3)'; // Brilho leve
                    } 
                    // Se for positivo e não for zero
                    else if (texto !== 'R$ 0,00' && texto !== 'R$ 0') {
                        el.style.color = '#2ecc71'; // Verde brilhante
                        el.style.textShadow = '0 0 5px rgba(46, 204, 113, 0.3)'; // Brilho leve
                    }
                }
            });
        }
        let _resolveConfirm = null;

        const escaparMensagemModal = (valor) => String(valor ?? '').replace(/[&<>"']/g, (caractere) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[caractere]);

        function gbmAlerta(mensagem, tipo = 'info') {
    const cor   = tipo === 'erro'  ? 'rgba(239,68,68,0.3)'
                : tipo === 'aviso' ? 'rgba(85,167,255,0.3)'
                :                    'rgba(95,255,168,0.3)';

    document.getElementById('lista-notificacoes-modal').innerHTML = `
        <div style="background:rgba(15,23,42,0.8); border:1px solid ${cor}; border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:1rem; line-height:1.6; text-align:center;">
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
            <div style="background:rgba(85,167,255,0.1); border:1px solid rgba(85,167,255,0.4); border-radius:10px; padding:20px; font-family:'Inter',sans-serif; font-size:1rem; line-height:1.6; text-align:center;">
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
        // Funções do Menu Lateral (Sidebar)
        function abrirMenuLateral(event) {
            if(event) event.stopPropagation();
            const sidebar = document.getElementById('sidebar-menu');
            const overlay = document.getElementById('menu-overlay');
            sidebar.classList.add('aberto');
            overlay.style.display = 'block';
            document.body.style.overflow = 'hidden';
            document.documentElement.style.overflow = 'hidden';
        }

        function fecharMenuLateral() {
            document.getElementById('sidebar-menu').classList.remove('aberto');
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            setTimeout(() => {
                document.getElementById('menu-overlay').style.display = 'none';
            }, 200);
        }

        // Evita que a rolagem sobre o menu faça a página de fundo se mover.
        document.addEventListener('DOMContentLoaded', () => {
            const sidebar = document.getElementById('sidebar-menu');
            if (!sidebar) return;
            sidebar.addEventListener('wheel', (event) => event.stopPropagation(), { passive: true });
        });
        // --- FUNÇÃO PARA DESFAZER ÚLTIMO LANÇAMENTO ---
        async function desfazerUltimo() {
            const ok = await gbmConfirmar('Deseja apagar o <strong>último lançamento</strong> adicionado? Esta ação não pode ser desfeita.');
            if (!ok) return;

            try {
                const res = await fetchApi('/desfazer-ultimo', {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        conta_id: Number(document.getElementById('filtro-conta-dashboard')?.value || 0)
                    })
                });

                if (res.ok) {
                    window.location.reload(); // Recarrega para atualizar totais e gráfico
                } else {
                    gbmAlerta('Erro ao desfazer. Tente novamente.', 'erro');
                }
            } catch (error) {
                console.error('Erro de conexão:', error);
                gbmAlerta('Erro ao comunicar com o servidor.', 'erro');
            }
        }
        let CATEGORIAS_DISPONIVEIS = [
    'Alimentação', 'Transporte', 'Salário', 'Educação', 'Saúde', 'Moradia',
    'Entretenimento', 'Telecomunicações / Internet', 'Supermercado',
    'Igreja / Doações', 'Pagamento de Fatura', 'Pagamento de Boleto',
    'Taxas Bancárias', 'Transferência', 'Crédito Cartão', 'Outros'
];

async function carregarCategorias() {
    try {
        const userId = pegarUserId();
        const res = await fetchApi(`/categorias?userId=${userId}`);
        const dados = await res.json();
        CATEGORIAS_DISPONIVEIS = dados.todas || CATEGORIAS_DISPONIVEIS;
        window._categoriasPersonalizadas = dados.personalizadas || [];
        preencherSelectsDeCategoria();
    } catch (e) {
        console.error('Erro ao carregar categorias:', e);
    }
}

function preencherSelectsDeCategoria() {
    const selectManual = document.getElementById('manual-cat');
    if (selectManual) {
        const atual = selectManual.value;
        selectManual.innerHTML = categoriasOpcoes(atual);
    }
    atualizarDropdownCategorias();
    renderizarCategoriasPersonalizadas();
}

function renderizarCategoriasPersonalizadas() {
    const container = document.getElementById('lista-categorias-personalizadas');
    if (!container) return;
    const lista = window._categoriasPersonalizadas || [];

    if (lista.length === 0) {
        container.innerHTML = '<span style="color: var(--texto-mutado); font-size:0.8125rem;">Nenhuma categoria personalizada ainda.</span>';
        return;
    }

    container.innerHTML = lista.map(c => `
        <span style="display:inline-flex; align-items:center; gap:6px; background:rgba(26,86,160,0.25); border:1px solid rgba(95,255,168,0.2); padding:5px 10px; border-radius:14px; font-size:0.8125rem;">
            ${escaparHtmlDashboard(c.nome)}
            <button data-acao="removerCategoriaPersonalizada" data-args="[${Number(c.id)}]" title="Remover categoria" style="background:none; border:none; color:#ff8080; cursor:pointer; font-size:0.875rem; line-height:1;">✕</button>
        </span>
    `).join('');
}

async function removerCategoriaPersonalizada(id) {
    const ok = await gbmConfirmar('Remover esta categoria? Os lançamentos já feitos mantêm o nome, mas ela deixará de aparecer nas opções.');
    if (!ok) return;
    const userId = pegarUserId();
    try {
        const res = await fetchApi(`/categorias/${id}`, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (data.success) {
            await carregarCategorias();
        } else {
            gbmAlerta(data.error || 'Erro ao remover categoria.', 'erro');
        }
    } catch (e) {
        gbmAlerta('Falha na comunicação com o servidor.', 'erro');
    }
}

async function criarNovaCategoria() {
    const input = document.getElementById('nova-categoria-nome');
    const nome = input.value.trim();
    if (!nome) return gbmAlerta('Digite o nome da categoria.', 'aviso');

    const userId = pegarUserId();
    try {
        const res = await fetchApi('/categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, nome })
        });
        const data = await res.json();
        if (data.success) {
            input.value = '';
            await carregarCategorias();
            gbmAlerta(`Categoria "${nome}" criada! Já está disponível nos seus lançamentos.`);
        } else {
            gbmAlerta(data.error || 'Erro ao criar categoria.', 'erro');
        }
    } catch (e) {
        gbmAlerta('Falha na comunicação com o servidor.', 'erro');
    }
}

function categoriasOpcoes(selecionada) {
    return CATEGORIAS_DISPONIVEIS.map(c =>
        `<option value="${escaparHtmlDashboard(c)}" ${c === selecionada ? 'selected' : ''}>${escaparHtmlDashboard(c)}</option>`
    ).join('');
}

let transacoesModal = [];
let objetivosAtivosVinculo = [];
let transacaoSelecionadaVinculo = null;
let focoAnteriorVinculo = null;

function escaparHtmlDashboard(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

async function carregarObjetivosVinculo(forcar = false) {
    if (objetivosAtivosVinculo.length && !forcar) return objetivosAtivosVinculo;
    const resposta = await fetchApi('/objetivos');
    const dados = await resposta.json();
    if (!resposta.ok) throw new Error(dados.error || 'Não foi possível carregar os objetivos.');
    objetivosAtivosVinculo = dados.filter((objetivo) => objetivo.status === 'ativo');
    return objetivosAtivosVinculo;
}

function renderizarAcaoObjetivoTransacao(transacao) {
    if (transacao.objetivo_id) {
        return `
            <span class="vinculo-objetivo-atual"> ${escaparHtmlDashboard(transacao.objetivo_nome)}</span><br>
            <button type="button" class="btn-objetivo-transacao secundario"
                data-acao="desvincularTransacaoObjetivo" data-args="[${Number(transacao.id)}]"
                aria-label="Desvincular a transação do objetivo ${escaparHtmlDashboard(transacao.objetivo_nome)}">
                Desvincular
            </button>`;
    }
    return `
        <button type="button" class="btn-objetivo-transacao"
            data-acao="abrirVinculoObjetivo" data-args="[${Number(transacao.id)}]" data-com-elemento
            aria-label="Destinar esta transação a um objetivo de poupança">
            Destinar ao objetivo
        </button>`;
}

async function abrirModalTransacoes() {
    const modal = document.getElementById('modal-transacoes');
    const container = document.getElementById('lista-transacoes-modal');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    container.innerHTML = '<p style="color:#a0a0a0;text-align:center;">Carregando...</p>';
    try {
        const { mes: mesCiclo, ano: anoCiclo } = cicloAtual();
        const res = await fetchApi(`/transacoes-individuais?mes=${mesCiclo}&ano=${anoCiclo}${queryContaDashboard()}`);
        const dados = await res.json();
        if (!res.ok) throw new Error(dados.error || 'Não foi possível carregar as transações.');
        transacoesModal = dados;
        carregarObjetivosVinculo().catch(() => {});

        if (!transacoesModal.length) {
            container.innerHTML = `<p style="color:#a0a0a0; text-align:center;">Nenhuma transação no período (${intervaloCiclo(mesCiclo, anoCiclo)}).</p>`;
            return;
        }

        let html = `
            <div class="acoes-categorias-transacoes">
                <span id="resumo-alteracoes-categoria" class="resumo-alteracoes-categoria" aria-live="polite">
                    Nenhuma categoria alterada.
                </span>
                <button type="button" id="btn-salvar-categorias" class="btn-salvar-categorias"
                    data-acao="salvarCorrecoesCategoria" disabled>
                    Salvar alterações
                </button>
            </div>
            <div class="transacoes-scroll"><table style="width:100%; border-collapse:collapse;">
            <thead>
                <tr style="color:#a0a0a0; font-size:0.875rem;">
                    <th style="text-align:left; padding:10px;">Data</th>
                    <th style="text-align:left; padding:10px;">Descrição</th>
                    <th style="text-align:left; padding:10px;">Valor</th>
                    <th style="text-align:left; padding:10px;">Banco</th>
                    <th style="text-align:left; padding:10px;">Categoria</th>
                    <th style="text-align:left; padding:10px;">Objetivo de poupança</th>
                    <th style="padding:10px;">Excluir</th>
                </tr>
            </thead><tbody>`;

        transacoesModal.forEach((t) => {
            const cor = t.tipo === 'Receita' ? '#10b981' : '#ef4444';
            const sinal = t.tipo === 'Receita' ? '+' : '-';
            const [ano, mes, dia] = String(t.data_transacao).slice(0, 10).split('-');
            const data = ano && mes && dia ? `${dia}/${mes}/${ano}` : '—';
            html += `
                <tr id="transacao-${Number(t.id)}" style="border-bottom:1px solid rgba(255,255,255,0.05);">
                    <td style="padding:10px; font-size:0.8125rem; color:#a0a0a0; white-space:nowrap;">${data}</td>
                    <td style="padding:10px; font-size:0.8125rem; max-width:250px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escaparHtmlDashboard(t.descricao)}</td>
                    <td style="padding:10px; font-weight:bold; color:${cor}; white-space:nowrap;">${sinal} R$ ${Number(t.valor).toFixed(2)}</td>
                    <td style="padding:10px;">${etiquetaBanco(t.banco)}</td>
                    <td style="padding:10px;">
                        <label class="sr-only" for="cat-${Number(t.id)}">Categoria de ${escaparHtmlDashboard(t.descricao)}</label>
                        <select id="cat-${Number(t.id)}" data-acao-change="atualizarEstadoSalvarCategorias"
                            style="min-height:44px;background:#2a2a2a; border:1px solid rgba(255,255,255,0.15); color:white; padding:6px 8px; border-radius:10px; font-size:0.8125rem; width:100%;">
                            ${categoriasOpcoes(t.categoria)}
                        </select>
                    </td>
                    <td style="padding:10px;min-width:190px;">${renderizarAcaoObjetivoTransacao(t)}</td>
                    <td style="padding:10px;text-align:center;">
                        <button type="button" id="excluir-transacao-${Number(t.id)}" class="btn-excluir-transacao"
                            data-acao="excluirTransacao" data-args="[${Number(t.id)}]"
                            aria-label="Excluir somente a transação ${escaparHtmlDashboard(t.descricao)}">
                            Excluir
                        </button>
                    </td>
                </tr>`;
        });

        html += '</tbody></table></div>';
        container.innerHTML = html;
        atualizarEstadoSalvarCategorias();
    } catch (erro) {
        container.innerHTML = `<p style="color:#fca5a5;text-align:center;">${escaparHtmlDashboard(erro.message)}</p>`;
        gbmAlerta(erro.message, 'erro');
    }
}

function obterAlteracoesCategorias() {
    return transacoesModal.flatMap((transacao) => {
        const select = document.getElementById(`cat-${Number(transacao.id)}`);
        if (!select || select.value === String(transacao.categoria || '')) return [];
        return [{
            transacaoId: Number(transacao.id),
            novaCategoria: select.value
        }];
    });
}

function atualizarEstadoSalvarCategorias() {
    const alteracoes = obterAlteracoesCategorias();
    const botao = document.getElementById('btn-salvar-categorias');
    const resumo = document.getElementById('resumo-alteracoes-categoria');
    if (!botao || !resumo) return;
    botao.disabled = alteracoes.length === 0;
    resumo.textContent = alteracoes.length === 0
        ? 'Nenhuma categoria alterada.'
        : `${alteracoes.length} ${alteracoes.length === 1 ? 'categoria alterada' : 'categorias alteradas'}.`;
}

async function salvarCorrecoesCategoria() {
    const alteracoes = obterAlteracoesCategorias();
    if (!alteracoes.length) return;
    const botao = document.getElementById('btn-salvar-categorias');
    const textoOriginal = botao.textContent;
    botao.disabled = true;
    botao.textContent = 'Salvando...';

    try {
        const resposta = await fetchApi('/corrigir-categorias', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ alteracoes })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Não foi possível salvar as categorias.');

        const categoriasPorId = new Map(
            alteracoes.map((alteracao) => [Number(alteracao.transacaoId), alteracao.novaCategoria])
        );
        transacoesModal.forEach((transacao) => {
            if (categoriasPorId.has(Number(transacao.id))) {
                transacao.categoria = categoriasPorId.get(Number(transacao.id));
            }
        });
        atualizarEstadoSalvarCategorias();
        carregarDados();
        carregarInsights();
        gbmAlerta(
            `${dados.atualizadas} ${dados.atualizadas === 1 ? 'categoria foi atualizada' : 'categorias foram atualizadas'} com sucesso.`
        );
    } catch (erro) {
        gbmAlerta(erro.message, 'erro');
    } finally {
        botao.textContent = textoOriginal;
        atualizarEstadoSalvarCategorias();
    }
}

async function excluirTransacao(transacaoId) {
    const transacao = transacoesModal.find((item) => Number(item.id) === Number(transacaoId));
    if (!transacao) return;
    const valor = Math.abs(Number(transacao.valor || 0)).toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    });
    const ok = await gbmConfirmar(
        `Excluir somente a movimentação “${transacao.descricao}”, no valor de ${valor}? Esta ação não pode ser desfeita e não exclui outras parcelas, recorrências ou itens da mesma importação.`
    );
    if (!ok) return;

    const botao = document.getElementById(`excluir-transacao-${Number(transacaoId)}`);
    if (botao) {
        botao.disabled = true;
        botao.textContent = 'Excluindo...';
    }

    try {
        const resposta = await fetchApi(`/transacoes/${Number(transacaoId)}`, { method: 'DELETE' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Não foi possível excluir a movimentação.');

        transacoesModal = transacoesModal.filter((item) => Number(item.id) !== Number(transacaoId));
        document.getElementById(`transacao-${Number(transacaoId)}`)?.remove();
        if (!transacoesModal.length) {
            document.getElementById('lista-transacoes-modal').innerHTML =
                '<p style="color:#a0a0a0;text-align:center;">Nenhuma transação neste período.</p>';
        } else {
            atualizarEstadoSalvarCategorias();
        }
        if (transacao.objetivo_id) carregarObjetivosVinculo(true).catch(() => {});
        carregarDados();
        carregarInsights();
        gbmAlerta('Movimentação excluída com sucesso.');
    } catch (erro) {
        if (botao) {
            botao.disabled = false;
            botao.textContent = 'Excluir';
        }
        gbmAlerta(erro.message, 'erro');
    }
}

async function abrirVinculoObjetivo(transacaoId, botaoOrigem) {
    const transacao = transacoesModal.find((item) => Number(item.id) === Number(transacaoId));
    if (!transacao) return;
    try {
        const objetivos = await carregarObjetivosVinculo(true);
        if (!objetivos.length) {
            gbmAlerta('Crie um objetivo de poupança ativo antes de destinar uma transação.', 'aviso');
            return;
        }
        transacaoSelecionadaVinculo = transacao;
        focoAnteriorVinculo = botaoOrigem || document.activeElement;
        const select = document.getElementById('objetivo-vinculo-select');
        select.innerHTML = objetivos.map((objetivo) => (
            `<option value="${Number(objetivo.id)}">${escaparHtmlDashboard(objetivo.nome)} — ${Number(objetivo.valor_guardado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</option>`
        )).join('');
        document.getElementById('resumo-transacao-vinculo').textContent =
            `${transacao.descricao} — ${Math.abs(Number(transacao.valor)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`;
        const aviso = document.getElementById('aviso-despesa-vinculo');
        const confirmar = document.getElementById('confirmar-vinculo-objetivo');
        if (transacao.tipo === 'Despesa') {
            aviso.hidden = false;
            aviso.textContent = 'Esta movimentação continuará sendo uma Despesa. O valor será contado somente como progresso do objetivo, sem alterar saldo, categoria ou relatórios.';
            confirmar.textContent = 'Confirmar e manter como despesa';
        } else {
            aviso.hidden = true;
            aviso.textContent = '';
            confirmar.textContent = 'Confirmar vínculo';
        }
        const modal = document.getElementById('modal-vinculo-objetivo');
        modal.style.display = 'flex';
        modal.setAttribute('aria-hidden', 'false');
        window.setTimeout(() => select.focus(), 0);
    } catch (erro) {
        gbmAlerta(erro.message, 'erro');
    }
}

function fecharVinculoObjetivo() {
    const modal = document.getElementById('modal-vinculo-objetivo');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    transacaoSelecionadaVinculo = null;
    if (focoAnteriorVinculo?.focus) focoAnteriorVinculo.focus();
    focoAnteriorVinculo = null;
}

async function confirmarVinculoObjetivo() {
    if (!transacaoSelecionadaVinculo) return;
    const objetivoId = Number(document.getElementById('objetivo-vinculo-select').value);
    const botao = document.getElementById('confirmar-vinculo-objetivo');
    botao.disabled = true;
    try {
        const resposta = await fetchApi(`/transacoes/${Number(transacaoSelecionadaVinculo.id)}/objetivo`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ objetivo_id: objetivoId })
        });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Não foi possível vincular a transação.');
        const eraDespesa = transacaoSelecionadaVinculo.tipo === 'Despesa';
        fecharVinculoObjetivo();
        gbmAlerta(
            eraDespesa
                ? `Despesa vinculada a “${dados.objetivo_nome}” sem alterar a movimentação.`
                : `Transação destinada a “${dados.objetivo_nome}”.`
        );
        await carregarObjetivosVinculo(true);
        await abrirModalTransacoes();
        carregarDados();
    } catch (erro) {
        gbmAlerta(erro.message, 'erro');
    } finally {
        botao.disabled = false;
    }
}

async function desvincularTransacaoObjetivo(transacaoId) {
    const transacao = transacoesModal.find((item) => Number(item.id) === Number(transacaoId));
    if (!transacao?.objetivo_id) return;
    if (!confirm(`Desvincular de “${transacao.objetivo_nome}”? A transação e a contribuição manual de outras origens não serão alteradas.`)) return;
    try {
        const resposta = await fetchApi(`/transacoes/${Number(transacaoId)}/objetivo`, { method: 'DELETE' });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.error || 'Não foi possível desvincular a transação.');
        gbmAlerta(`Transação desvinculada de “${dados.objetivo_nome || transacao.objetivo_nome}”.`);
        await carregarObjetivosVinculo(true);
        await abrirModalTransacoes();
        carregarDados();
    } catch (erro) {
        gbmAlerta(erro.message, 'erro');
    }
}

async function salvarObjetivo() {
            const nome = document.getElementById('objetivo-nome').value.trim();
            const valor = document.getElementById('objetivo-valor').value;
            
            if (!nome || !valor) return gbmAlerta('Digite o nome e o valor do objetivo de poupança.', 'aviso');
            
            try {
                const resposta = await fetchApi('/objetivos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nome, valor_meta: parseFloat(valor), valor_inicial: 0 })
                });
                if (!resposta.ok) throw new Error('Não foi possível criar o objetivo de poupança.');
                document.getElementById('objetivo-nome').value = '';
                document.getElementById('objetivo-valor').value = '';
                gbmAlerta("Objetivo criado! Acesse Objetivos de poupança no menu para acompanhar.");
            } catch (error) { gbmAlerta('Erro ao criar o objetivo de poupança.', 'erro'); }
        }

function fecharModalTransacoes() {
    fecharVinculoObjetivo();
    const modal = document.getElementById('modal-transacoes');
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden', 'true');
    document.getElementById('btn-gerenciar-categorias')?.focus();
}

document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Escape') return;
    const modalVinculo = document.getElementById('modal-vinculo-objetivo');
    if (modalVinculo.style.display === 'flex') {
        fecharVinculoObjetivo();
        return;
    }
    const modalTransacoes = document.getElementById('modal-transacoes');
    if (modalTransacoes.style.display === 'flex') fecharModalTransacoes();
});
async function carregarInsights() {
    const container = document.getElementById('insights-lista');
    try {
        const res = await fetchApi(`/insights?${queryContaDashboard().replace(/^&/, '')}`);
        if (!res.ok) throw new Error('Falha ao carregar insights.');
        const insights = await res.json();
        const corPorTipo = (tipo) => tipo === 'aumento'
            ? { borda: '#55a7ff', badge: null }
            : tipo === 'positivo'
                ? { borda: '#39d98a', badge: 'Desempenho positivo' }
                : { borda: '#ff9aa4', badge: null };
        const rotuloPorTipo = (tipo) => tipo === 'aumento'
            ? 'ATENÇÃO'
            : tipo === 'positivo'
                ? 'DESEMPENHO'
                : 'ALERTA';
        container.innerHTML = insights.length
            ? insights.map((item) => {
                const estilo = corPorTipo(item.tipo);
                return `
                <div class="insight-item" style="border-left:3px solid ${estilo.borda};">
                    <span class="insight-rotulo">${rotuloPorTipo(item.tipo)}</span>
                    <strong>${escaparHtmlDashboard(item.titulo || '')}</strong>
                    <span>${escaparHtmlDashboard(item.texto || '')}</span>
                    ${estilo.badge
                        ? `<span class="insight-badge">${estilo.badge}</span>`
                        : `<a href="#" class="insight-link" data-acao="abrirModalTransacoes" data-prevenir>Ver movimentações</a>`}
                </div>
            `;
            }).join('')
            : '<div class="insight-item"><span>Continue lançando seus dados para receber análises personalizadas.</span></div>';
    } catch (erro) {
        container.innerHTML = '<div class="insight-item"><span>Os insights estarão disponíveis quando houver dados suficientes.</span></div>';
    }
}
async function carregarAlertas() {
    try {
        const res = await fetchApi('/alertas?userId=' + pegarUserId());
        if (!res.ok) throw new Error('Falha ao carregar notificações.');

        const alertas = await res.json();
        const naoLidos = alertas.filter(a => !a.lida);

        const dot = document.getElementById('dot-alertas');
        const badgeMenu = document.getElementById('badge-alertas-menu');

        if (dot) {
            dot.style.display = naoLidos.length > 0 ? 'block' : 'none';
        }
        if (badgeMenu) {
            badgeMenu.style.display = naoLidos.length > 0 ? 'inline-block' : 'none';
            if (naoLidos.length > 0) badgeMenu.innerText = naoLidos.length;
        }
        window._alertasCache = alertas;
    } catch (e) {
        console.error('Erro ao carregar alertas:', e);
    }
}

function abrirPainelAlertas() {
    const alertas = window._alertasCache || [];
    if (alertas.length === 0) {
        gbmAlerta('Nenhuma notificação por enquanto ');
        return;
    }
    const texto = alertas.map(a => `• ${a.mensagem}`).join('<br>');
    gbmAlerta(texto);
    alertas.forEach(a => {
        if (!a.lida) fetchApi('/alertas/marcar-lida', {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ id: a.id, userId: pegarUserId() })
        });
    });
    carregarAlertas();
    fecharMenuLateral(); // fecha o menu depois de abrir o painel
}

window.promessaVerificacaoAcesso.then((sessao) => {
    if (!sessao) return;
    carregarAtalhoPerfil();
    carregarAlertas();
    window.intervaloAlertas = setInterval(carregarAlertas, 60000);
    // --- 5. LIGAR O MOTOR ---
    carregarBancosInfo();
    carregarCategorias();
    carregarContasLancamento();
    carregarDados();
    carregarInsights();
}).catch(() => {
    // verificarAcesso já redireciona sessões inválidas para a tela de login.
});
