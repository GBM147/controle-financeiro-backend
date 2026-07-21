// =======================================================
// --- MÓDULO: EXTRAÇÃO DE TRANSAÇÕES A PARTIR DE PDF DE EXTRATO ---
// =======================================================
// Estratégia: extrator genérico baseado em padrão de linha (não é específico
// de um banco). Funciona bem para extratos em formato de tabela texto
// (Data | Descrição | Docto | Crédito | Débito | Saldo), que é o padrão
// usado por vários bancos digitais/internet banking brasileiros.
//
// Por não sabermos de antemão o layout exato de cada banco, o resultado
// SEMPRE deve passar por uma tela de conferência humana antes de ser
// gravado no banco de dados — nunca importar direto sem revisão.

// Remove o número do documento/comprovante que sobra colado no fim da descrição
function limparDescricao(desc) {
    return desc.replace(/\s\d{5,}\s*$/, '').trim();
}

// Converte "1.234,56" ou "-45,00" para número JS (1234.56 / -45.00)
function parseValorBR(str) {
    return parseFloat(str.replace(/\./g, '').replace(',', '.'));
}

// Converte "20/07/2026" -> "2026-07-20" (formato aceito pelo MySQL)
function dataBrParaISO(dataBr) {
    const [dia, mes, ano] = dataBr.split('/');
    return `${ano}-${mes}-${dia}`;
}

function detectarBanco(texto) {
    const t = texto.toLowerCase();
    if (t.includes('santander')) return 'Santander';
    if (t.includes('itaú') || t.includes('itau')) return 'Itaú';
    if (t.includes('bradesco')) return 'Bradesco';
    if (t.includes('nubank') || t.includes('nu pagamentos')) return 'Nubank';
    if (t.includes('banco do brasil') || t.includes('bb.com.br')) return 'Banco do Brasil';
    if (t.includes('caixa econômica') || t.includes('caixa economica') || t.includes('caixa.gov')) return 'Caixa Econômica';
    if (t.includes('banco inter')) return 'Banco Inter';
    if (t.includes('c6 bank')) return 'C6 Bank';
    if (t.includes('sicoob')) return 'Sicoob';
    if (t.includes('sicredi')) return 'Sicredi';
    return 'Outro banco';
}

// Extrai as transações do texto bruto do PDF (já convertido de binário para texto)
function extrairTransacoesDoPdf(texto) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);

    // Linha "completa": Data + Descrição (+ Docto) + Valor + Saldo (2 números decimais no fim)
    const padraoCompleto = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]{1,12},\d{2})\s+(-?[\d.]{1,12},\d{2})\s*$/;
    // Linha do "saldo anterior": Data + 1 valor
    const padraoSaldoAnterior = /^(\d{2}\/\d{2}\/\d{4})\s+(-?[\d.]{1,12},\d{2})\s*$/;
    // Fallback (bancos sem coluna de saldo corrente): Data + Descrição + 1 valor no fim
    const padraoSimples = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]{1,12},\d{2})\s*$/;

    let brutas = [];
    let saldoAnterior = null;
    let aguardandoSaldoAnterior = false;

    for (const linha of linhas) {
        if (/saldo anterior/i.test(linha)) {
            aguardandoSaldoAnterior = true;
            continue;
        }
        const m = linha.match(padraoCompleto);
        if (m) {
            const [, data, descBruta, valorStr, saldoStr] = m;
            brutas.push({
                data,
                descricao: limparDescricao(descBruta),
                valor: parseValorBR(valorStr),
                saldoApos: parseValorBR(saldoStr)
            });
            continue;
        }
        if (aguardandoSaldoAnterior) {
            const m2 = linha.match(padraoSaldoAnterior);
            if (m2) {
                saldoAnterior = parseValorBR(m2[2]);
                aguardandoSaldoAnterior = false;
            }
        }
    }

    let confianca = 'alta';

    // Fallback: se o padrão "com saldo" não encontrou nada, tenta o modo mais simples
    if (brutas.length === 0) {
        confianca = 'baixa';
        for (const linha of linhas) {
            const m = linha.match(padraoSimples);
            if (m) {
                const [, data, descBruta, valorStr] = m;
                brutas.push({
                    data,
                    descricao: limparDescricao(descBruta),
                    valor: parseValorBR(valorStr),
                    saldoApos: null
                });
            }
        }
    }

    // Conferência de saldo (só é possível quando temos saldo corrente por linha)
    let reconciliacao = null;
    if (confianca === 'alta' && brutas.length > 0 && saldoAnterior !== null) {
        const soma = brutas.reduce((acc, t) => acc + t.valor, 0);
        const saldoFinalExtrato = brutas[0].saldoApos; // primeira linha = transação mais recente
        const esperado = Math.round((saldoAnterior + soma) * 100) / 100;
        const diferenca = Math.round((esperado - saldoFinalExtrato) * 100) / 100;
        reconciliacao = {
            saldo_inicial: saldoAnterior,
            soma_transacoes: Math.round(soma * 100) / 100,
            saldo_final_esperado: esperado,
            saldo_final_extrato: saldoFinalExtrato,
            diferenca,
            bate: Math.abs(diferenca) < 0.01
        };
    }

    const transacoes = brutas.map(t => ({
        data: dataBrParaISO(t.data),
        descricao: t.descricao,
        valor: Math.round(Math.abs(t.valor) * 100) / 100,
        tipo: t.valor < 0 ? 'Despesa' : 'Receita'
    }));

    return { transacoes, reconciliacao, confianca };
}

module.exports = { extrairTransacoesDoPdf, detectarBanco };