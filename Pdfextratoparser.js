// =======================================================
// --- MÓDULO: EXTRAÇÃO DE TRANSAÇÕES A PARTIR DE PDF DE EXTRATO ---
// =======================================================
// Estratégia: nenhum banco padroniza o layout do PDF, então mantemos aqui
// mais de um "adaptador" de extração e escolhemos qual usar com base em
// características do texto (ex: presença da coluna "Nº Documento", ou de
// transações em 2 linhas). Se nenhum adaptador específico bater, cai no
// modo genérico mais simples.
//
// Por não sabermos de antemão o layout exato de cada banco, o resultado
// SEMPRE deve passar por uma tela de conferência humana antes de ser
// gravado no banco de dados — nunca importar direto sem revisão.

const MESES = {
    'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4, 'maio': 5, 'junho': 6,
    'julho': 7, 'agosto': 8, 'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
};

// Remove o número do documento/comprovante que sobra colado no fim da descrição
function limparDescricao(desc) {
    return desc.replace(/\s\d{5,}\s*$/, '').trim();
}

// Converte "1.234,56", "-45,00" ou "4,00-" (sinal antes OU depois) para número JS
function parseValorFlexivel(str) {
    let negativo = false;
    let limpo = str.trim();
    if (limpo.startsWith('-')) { negativo = true; limpo = limpo.slice(1); }
    if (limpo.endsWith('-')) { negativo = true; limpo = limpo.slice(0, -1); }
    const valor = parseFloat(limpo.replace(/\./g, '').replace(',', '.'));
    return negativo ? -Math.abs(valor) : Math.abs(valor);
}

// Converte "20/07/2026" -> "2026-07-20" (formato aceito pelo MySQL)
function dataBrParaISO(dataBr) {
    const [dia, mes, ano] = dataBr.split('/');
    return `${ano}-${mes.padStart(2, '0')}-${dia.padStart(2, '0')}`;
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

// Tenta achar o mês/ano de referência do extrato (ex: "maio/2026") para
// resolver datas que vêm sem ano (dd/mm apenas)
function extrairMesAnoReferencia(texto) {
    const m = texto.match(/^([a-zçãéô]+)\/(\d{4})\s*$/im);
    if (m && MESES[m[1].toLowerCase()]) {
        return { mes: MESES[m[1].toLowerCase()], ano: parseInt(m[2], 10) };
    }
    return null;
}

// Resolve "dd/mm" -> "dd/mm/yyyy" usando o mês/ano de referência do extrato.
// Se o mês da transação for maior que o mês de referência, assume que é do ano anterior
// (ex: extrato de referência janeiro/2026 com lançamento 28/12 -> 28/12/2025).
function resolverAno(dataDDMM, referencia) {
    const [dia, mes] = dataDDMM.split('/');
    if (!referencia) {
        const anoAtual = new Date().getFullYear();
        return `${dia}/${mes}/${anoAtual}`;
    }
    const mesNum = parseInt(mes, 10);
    const ano = mesNum > referencia.mes ? referencia.ano - 1 : referencia.ano;
    return `${dia}/${mes}/${ano}`;
}

// =======================================================
// LAYOUT 1: "uma linha por transação", data completa (dd/mm/aaaa) sempre presente,
// crédito/débito com sinal antes do número. Ex: extrato simples de Internet Banking.
// =======================================================
function extrairLayoutUmaLinha(linhas) {
    const padraoCompleto = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]{1,12},\d{2})\s+(-?[\d.]{1,12},\d{2})\s*$/;
    const padraoSaldoAnterior = /^(\d{2}\/\d{2}\/\d{4})\s+(-?[\d.]{1,12},\d{2})\s*$/;

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
                valor: parseValorFlexivel(valorStr),
                saldoApos: parseValorFlexivel(saldoStr)
            });
            continue;
        }
        if (aguardandoSaldoAnterior) {
            const m2 = linha.match(padraoSaldoAnterior);
            if (m2) {
                saldoAnterior = parseValorFlexivel(m2[2]);
                aguardandoSaldoAnterior = false;
            }
        }
    }

    let reconciliacao = null;
    if (brutas.length > 0 && saldoAnterior !== null) {
        const soma = brutas.reduce((acc, t) => acc + t.valor, 0);
        const saldoFinalExtrato = brutas[0].saldoApos; // primeira linha = transação mais recente
        reconciliacao = montarReconciliacao(saldoAnterior, soma, saldoFinalExtrato);
    }

    return { brutas, reconciliacao };
}

// =======================================================
// LAYOUT 2: "duas linhas por transação" (linha de valor + linha de complemento),
// data só aparece na primeira transação de cada dia, sinal de débito DEPOIS do
// número (ex: "4,00-"), saldo corrente aparece só esporadicamente. Ex: Santander
// "Extrato Consolidado Inteligente".
// =======================================================
function extrairLayoutDuasLinhas(linhas, referenciaMesAno) {
    const ruido = /^Extrato_PF|^BALP_|^P[aá]gina[:\s]|^EXTRATO CONSOLIDADO INTELIGENTE$|^[a-zçãéô]+\/\d{4}$/i;
    const regexHeaderTabela = /^Data\s+Descri[cç][aã]o\s+N[ºo]\s*Documento/i;
    const regexFimTabela = /^Compras com Cart|^Cr[ée]ditos Contratados|^Comprovantes de Pagamento|^Saldos por Per[ií]odo|^Se voc[eê] n[ãa]o tem Limite/i;
    const regexSaldoLinha = /^SALDO EM (\d{2}\/\d{2})\s+(-?[\d.]{1,12},\d{2}-?)\s*$/i;
    const regexLinhaMovimento = /^(?:(\d{2}\/\d{2})\s+)?(.+?)\s+(-|\d{2,})\s+(-?[\d.]{1,12},\d{2}-?)(?:\s+(-?[\d.]{1,12},\d{2}-?))?\s*$/;

    let dentroTabela = false;
    let dataCorrente = null;
    const saldos = [];
    const brutas = [];
    let atual = null;

    for (const linha of linhas) {
        if (regexHeaderTabela.test(linha)) { dentroTabela = true; continue; }
        if (regexFimTabela.test(linha)) { dentroTabela = false; continue; }
        if (!dentroTabela) continue;
        if (ruido.test(linha)) continue;

        const mSaldo = linha.match(regexSaldoLinha);
        if (mSaldo) {
            saldos.push(parseValorFlexivel(mSaldo[2]));
            continue;
        }

        const m = linha.match(regexLinhaMovimento);
        if (m) {
            if (atual) brutas.push(atual);
            const [, dataLinha, desc, , valorStr, saldoStr] = m;
            if (dataLinha) dataCorrente = resolverAno(dataLinha, referenciaMesAno);
            atual = {
                data: dataCorrente,
                descricao: limparDescricao(desc.trim()),
                valor: parseValorFlexivel(valorStr),
                saldoApos: saldoStr ? parseValorFlexivel(saldoStr) : null
            };
        } else if (atual) {
            atual.descricao = limparDescricao(atual.descricao + ' ' + linha);
        }
    }
    if (atual) brutas.push(atual);

    let reconciliacao = null;
    if (saldos.length >= 2) {
        const soma = brutas.reduce((acc, t) => acc + t.valor, 0);
        reconciliacao = montarReconciliacao(saldos[0], soma, saldos[saldos.length - 1]);
    }

    return { brutas, reconciliacao };
}

// Fallback genérico: 1 valor só por linha (sem coluna de saldo corrente)
function extrairLayoutSimples(linhas) {
    const padraoSimples = /^(\d{2}\/\d{2}\/\d{4})\s+(.+?)\s+(-?[\d.]{1,12},\d{2})\s*$/;
    const brutas = [];
    for (const linha of linhas) {
        const m = linha.match(padraoSimples);
        if (m) {
            const [, data, descBruta, valorStr] = m;
            brutas.push({
                data,
                descricao: limparDescricao(descBruta),
                valor: parseValorFlexivel(valorStr),
                saldoApos: null
            });
        }
    }
    return { brutas, reconciliacao: null };
}

function montarReconciliacao(saldoInicial, soma, saldoFinalExtrato) {
    const esperado = Math.round((saldoInicial + soma) * 100) / 100;
    const diferenca = Math.round((esperado - saldoFinalExtrato) * 100) / 100;
    return {
        saldo_inicial: Math.round(saldoInicial * 100) / 100,
        soma_transacoes: Math.round(soma * 100) / 100,
        saldo_final_esperado: esperado,
        saldo_final_extrato: Math.round(saldoFinalExtrato * 100) / 100,
        diferenca,
        bate: Math.abs(diferenca) < 0.01
    };
}

// Extrai as transações do texto bruto do PDF (já convertido de binário para texto)
function extrairTransacoesDoPdf(texto) {
    const linhas = texto.split('\n').map(l => l.trim()).filter(Boolean);
    const usaLayoutDuasLinhas = /N[ºo]\s*Documento/i.test(texto) && /^(?:\d{2}\/\d{2}\s+)?.+\s+(-|\d{2,})\s+-?[\d.]{1,12},\d{2}-?\s*$/m.test(texto);

    let resultado;
    let confianca = 'alta';

    if (usaLayoutDuasLinhas) {
        const referencia = extrairMesAnoReferencia(texto);
        resultado = extrairLayoutDuasLinhas(linhas, referencia);
    } else {
        resultado = extrairLayoutUmaLinha(linhas);
    }

    if (resultado.brutas.length === 0) {
        confianca = 'baixa';
        resultado = extrairLayoutSimples(linhas);
    }

    const transacoes = resultado.brutas.map(t => ({
        data: dataBrParaISO(t.data),
        descricao: t.descricao,
        valor: Math.round(Math.abs(t.valor) * 100) / 100,
        tipo: t.valor < 0 ? 'Despesa' : 'Receita'
    }));

    return { transacoes, reconciliacao: resultado.reconciliacao, confianca };
}

module.exports = { extrairTransacoesDoPdf, detectarBanco };