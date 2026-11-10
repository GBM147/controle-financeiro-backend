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

        let dadosRelatorio = [];
let CATEGORIAS_TODAS = [];
let BANCOS_CORES = {};

async function carregarBancosInfo() {
    try {
        const res = await fetch('/bancos-info');
        BANCOS_CORES = await res.json();
    } catch (e) {
        console.error('Erro ao carregar cores de bancos:', e);
    }
}
carregarBancosInfo();

function etiquetaBanco(nomeBanco) {
    if (!nomeBanco) return '';
    const corBanco = String(BANCOS_CORES[nomeBanco] || '');
    const cor = /^#[0-9a-f]{3,8}$/i.test(corBanco) ? corBanco : 'var(--text-3)';
    return `<span class="etiqueta-banco"><i style="background:${cor}"></i>${escaparHtmlRelatorio(nomeBanco)}</span>`;
}

function escaparHtmlRelatorio(valor) {
    return String(valor ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}
document.getElementById('mes-ref').value = new Date().getMonth() + 1;

const NOMES_MESES = ['','Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                      'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

async function carregarCategorias() {
    try {
        const userId = pegarUserId();
        const res = await fetchApi(`/categorias?userId=${userId}`);
        const dados = await res.json();
        CATEGORIAS_TODAS = dados.todas || [];
    } catch (e) {
        console.error('Erro ao carregar categorias:', e);
    }
}
carregarCategorias();

async function carregarBancosUsados() {
    try {
        const userId = pegarUserId();
        const res = await fetchApi(`/bancos-usados?userId=${userId}`);
        const bancos = await res.json();
        const select = document.getElementById('banco-ref');
        bancos.forEach(nome => {
            select.appendChild(new Option(String(nome), String(nome)));
        });
    } catch (e) {
        console.error('Erro ao carregar bancos usados:', e);
    }
}
carregarBancosUsados();

        async function gerarRelatorio() {
            const mes = document.getElementById('mes-ref').value;
            const ano = document.getElementById('ano-ref').value;
            const banco = document.getElementById('banco-ref').value;
            const container = document.getElementById('resultado-relatorio');
            container.innerHTML = '<p class="texto-vazio">Carregando...</p>';

            try {
                const userId = pegarUserId();
const res = await fetchApi(`/relatorio-detalhado?mes=${mes}&ano=${ano}&userId=${userId}&banco=${encodeURIComponent(banco)}`);
                dadosRelatorio = await res.json();

                if (dadosRelatorio.length === 0) {
                    const sufixoBanco = banco !== 'todos' ? ` (${escaparHtmlRelatorio(banco)})` : '';
                    container.innerHTML = `<p class="texto-vazio">Nenhum dado encontrado para ${NOMES_MESES[mes]}/${ano}${sufixoBanco}.</p>`;
                    return;
                }

                let totalReceita = 0, totalDespesa = 0;
                dadosRelatorio.forEach(item => {
                    const v = Math.abs(parseFloat(item.valor) || 0);
                    if (item.tipo === 'Receita') totalReceita += v;
                    else totalDespesa += v;
                });
                const saldo = totalReceita - totalDespesa;
                const moeda = (valor) => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

                let html = `
                    <div class="resultado-header">
                        <h3>${NOMES_MESES[mes]} / ${ano}${banco !== 'todos' ? ' — ' + escaparHtmlRelatorio(banco) : ''}</h3>
                        <div class="resumo-rapido">
                            <div class="resumo-item">Entradas
                                <strong class="positivo">${moeda(totalReceita)}</strong>
                            </div>
                            <div class="resumo-item">Saídas
                                <strong class="negativo">${moeda(totalDespesa)}</strong>
                            </div>
                            <div class="resumo-item">Saldo
                                <strong class="${saldo >= 0 ? 'positivo' : 'negativo'}">${moeda(saldo)}</strong>
                            </div>
                        </div>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Categoria</th>
                                <th>Banco</th>
                                <th>Tipo</th>
                                <th class="num">Valor</th>
                            </tr>
                        </thead>
                        <tbody>`;

                dadosRelatorio.forEach(item => {
                    const isReceita = item.tipo === 'Receita';
                    const classeValor = isReceita ? 'positivo' : 'negativo';
                    const sinal  = isReceita ? '+ ' : '- ';
                    const badge  = isReceita
                        ? '<span class="badge-tipo badge-receita">Receita</span>'
                        : '<span class="badge-tipo badge-despesa">Despesa</span>';
                    const valor  = moeda(Math.abs(parseFloat(item.valor) || 0));
                    const itemId = Number(item.id);

                    html += `
                        <tr>
                            <td class="relatorio-categoria">
                                ${escaparHtmlRelatorio(item.categoria || 'Sem categoria')}
                                <br><button class="btn-editar-cat" data-editar-id="${Number.isInteger(itemId) ? itemId : 0}">Editar</button>
                            </td>
                            <td>${etiquetaBanco(item.banco)}</td>
                            <td>${badge}</td>
                            <td class="num ${classeValor}">${sinal}${valor}</td>
                        </tr>`;
                });

                html += '</tbody></table>';
                container.innerHTML = html;
                container.querySelectorAll('[data-editar-id]').forEach((botao) => {
                    botao.addEventListener('click', () => {
                        const id = Number(botao.dataset.editarId);
                        const item = dadosRelatorio.find((registro) => Number(registro.id) === id);
                        if (!item) return;
                        abrirModal(id, item.descricao || item.categoria || '', item.categoria || 'Outros');
                    });
                });

            } catch (error) {
                container.innerHTML = '<p class="texto-vazio">Erro ao carregar o relatório. Tente novamente.</p>';
            }
        }

        function baixarPDF() {
            if (dadosRelatorio.length === 0) return gbmAlerta('Gere o relatório antes de baixar!', 'aviso');

            const mes = document.getElementById('mes-ref').value;
            const ano = document.getElementById('ano-ref').value;
            const banco = document.getElementById('banco-ref').value;
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            doc.setFillColor(15, 123, 95);
            doc.rect(0, 0, 210, 38, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('GBM Finance', 14, 15);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(231, 243, 239);
            doc.text(`Relatório financeiro — ${NOMES_MESES[mes]} / ${ano}${banco !== 'todos' ? ' — ' + banco : ''}`, 14, 25);
            doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 32);

            let totalReceita = 0, totalDespesa = 0;
            dadosRelatorio.forEach(item => {
                const v = Math.abs(parseFloat(item.valor) || 0);
                if (item.tipo === 'Receita') totalReceita += v;
                else totalDespesa += v;
            });
            const saldo = totalReceita - totalDespesa;

            doc.setFillColor(243, 242, 238);
            doc.rect(14, 42, 55, 18, 'F');
            doc.rect(73, 42, 55, 18, 'F');
            doc.rect(132, 42, 64, 18, 'F');

            doc.setFontSize(8);
            doc.setTextColor(85, 85, 79);
            doc.text('ENTRADAS', 16, 48);
            doc.text('SAÍDAS', 75, 48);
            doc.text('SALDO DO PERÍODO', 134, 48);

            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(21, 128, 61);
            doc.text(`R$ ${totalReceita.toFixed(2)}`, 16, 56);
            doc.setTextColor(180, 35, 24);
            doc.text(`R$ ${totalDespesa.toFixed(2)}`, 75, 56);
            doc.setTextColor(saldo >= 0 ? 21 : 180, saldo >= 0 ? 128 : 35, saldo >= 0 ? 61 : 24);
            doc.text(`R$ ${saldo.toFixed(2)}`, 134, 56);

            doc.autoTable({
                head: [['Categoria', 'Banco', 'Tipo', 'Valor']],
                body: dadosRelatorio.map(i => {
                    const isReceita = i.tipo === 'Receita';
                    return [
                        i.categoria,
                        i.banco || '—',
                        i.tipo,
                        (isReceita ? '+ ' : '- ') + 'R$ ' + Math.abs(parseFloat(i.valor) || 0).toFixed(2)
                    ];
                }),
                startY: 65,
                theme: 'striped',
                headStyles: { fillColor: [15, 123, 95], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 },
                alternateRowStyles: { fillColor: [250, 250, 248] },
                didParseCell: function(data) {
                    if (data.cell.section === 'body') {
                        if (data.column.index === 2) {
                            data.cell.styles.textColor = data.cell.raw === 'Receita' ? [21, 128, 61] : [180, 35, 24];
                            data.cell.styles.fontStyle = 'bold';
                        }
                        if (data.column.index === 3) {
                            data.cell.styles.textColor = String(data.cell.raw).startsWith('+') ? [21, 128, 61] : [180, 35, 24];
                            data.cell.styles.fontStyle = 'bold';
                        }
                    }
                },
                columnStyles: { 3: { halign: 'right' } }
            });

            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(176, 190, 197);
                doc.text('Guardian of Budget & Money — Relatório Confidencial',
                    14, doc.internal.pageSize.height - 8);
            }

            doc.save(`GBM-relatorio-${NOMES_MESES[mes]}-${ano}${banco !== 'todos' ? '-' + banco.replace(/\s+/g, '') : ''}.pdf`);
        }

    let txIdAtual = null;

        function abrirModal(id, descricao, categoriaAtual) {
    txIdAtual = id;
    document.getElementById('modal-desc-tx').innerText = descricao;

    const select = document.getElementById('modal-select-cat');
    if (CATEGORIAS_TODAS.length > 0) {
        select.innerHTML = CATEGORIAS_TODAS
            .map(c => `<option value="${escaparHtmlRelatorio(c)}">${escaparHtmlRelatorio(c)}</option>`)
            .join('');
    }
    document.getElementById('modal-select-cat').value = categoriaAtual;
    document.getElementById('modal-categoria').classList.add('ativo');
}

        function fecharModal() {
            txIdAtual = null;
            document.getElementById('modal-categoria').classList.remove('ativo');
        }

        async function salvarCategoria() {
            if (!txIdAtual) return;
            const novaCategoria = document.getElementById('modal-select-cat').value;
            try {
                const res = await fetchApi(`/atualizar-categoria/${txIdAtual}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ categoria: novaCategoria })
                });
                const json = await res.json();
                if (json.success) {
                    fecharModal();
                    gerarRelatorio(); // recarrega o relatório com a nova categoria
                } else {
                    gbmAlerta('Erro ao salvar. Tente novamente.', 'erro');
                }
            } catch (e) {
                gbmAlerta('Falha na comunicação com o servidor.', 'erro');
            }
        }

        // Fechar modal clicando fora
        document.getElementById('modal-categoria').addEventListener('click', function(e) {
            if (e.target === this) fecharModal();
        });

