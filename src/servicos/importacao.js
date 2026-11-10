const crypto = require('crypto');
const pdfParse = require('pdf-parse');
const { numeroOfx, parseOfx } = require('../../ofx-parser');
const { renderComEspacamento } = require('../../pdf-render');
const { BANCOS_INFO } = require('../config/constantes');
const { db } = require('../db/banco');

// Identifica o banco a partir da árvore já convertida do OFX
function identificarBanco(rais) {
    try {
        const bankId = rais?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS?.BANKACCTFROM?.BANKID;
        const orgFI  = rais?.SIGNONMSGSRSV1?.SONRS?.FI?.ORG;

        if (bankId && BANCOS_INFO[bankId]) return BANCOS_INFO[bankId].nome;
        if (orgFI) return orgFI; // usa o nome que o próprio banco colocou no arquivo
        return 'Outro banco';
    } catch (e) {
        return 'Outro banco';
    }
}
function normalizarDataBancaria(valor) {
    const texto = String(valor ?? '').trim();
    let ano;
    let mes;
    let dia;

    let correspondencia = texto.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (correspondencia) {
        [, ano, mes, dia] = correspondencia;
    } else {
        correspondencia = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
        if (correspondencia) {
            [, dia, mes, ano] = correspondencia;
        } else {
            correspondencia = texto.match(/^(\d{4})(\d{2})(\d{2})(?:\d{6})?(?:\.\d+)?(?:\[[^\]]+\])?$/);
            if (!correspondencia) return null;
            [, ano, mes, dia] = correspondencia;
        }
    }

    const anoNumero = Number(ano);
    const mesNumero = Number(mes);
    const diaNumero = Number(dia);
    if (
        !Number.isInteger(anoNumero)
        || !Number.isInteger(mesNumero)
        || !Number.isInteger(diaNumero)
        || anoNumero < 1900
        || anoNumero > 2200
        || mesNumero < 1
        || mesNumero > 12
    ) {
        return null;
    }

    const ultimoDiaDoMes = new Date(Date.UTC(anoNumero, mesNumero, 0)).getUTCDate();
    if (diaNumero < 1 || diaNumero > ultimoDiaDoMes) return null;

    return `${String(anoNumero).padStart(4, '0')}-${String(mesNumero).padStart(2, '0')}-${String(diaNumero).padStart(2, '0')}`;
}
function canonicalizarDescricaoImportacao(valor) {
    return String(valor ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[\u2010-\u2015\u2212-]+/g, ' ')
        .replace(/[^A-Z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function normalizarFitid(valor) {
    const fitid = String(valor ?? '').trim();
    if (!fitid || /^0+$/.test(fitid)) return null;
    return fitid.slice(0, 180);
}
function valorEmCentavos(valor) {
    const numero = Math.abs(numeroOfx(valor));
    if (!Number.isFinite(numero) || numero <= 0) return null;
    return Math.round((numero + Number.EPSILON) * 100);
}
function criarChaveCanonicaImportacao(contaId, linha) {
    return [
        Number(contaId),
        linha.data,
        linha.tipo,
        linha.valorCentavos,
        linha.descricaoCanonica
    ].join('|');
}
function criarIdentidadeImportacao(contaId, linha) {
    if (linha.fitid) {
        return crypto.createHash('sha256')
            .update(`ofx-fitid|${Number(contaId)}|${linha.fitid}`)
            .digest('hex');
    }
    return crypto.createHash('sha256')
        .update(`gbm-importacao-v2|${criarChaveCanonicaImportacao(contaId, linha)}|${linha.ocorrencia}`)
        .digest('hex');
}
function normalizarLoteImportacao(transacoes, contaId) {
    const ocorrenciasPorDescricaoDeOrigem = new Map();
    return transacoes.slice(0, 5000).map((linha, indice) => {
        const descricao = String(linha?.descricao ?? '').trim().slice(0, 255);
        const descricaoCanonica = canonicalizarDescricaoImportacao(descricao);
        const data = normalizarDataBancaria(linha?.data ?? linha?.data_transacao);
        const tipo = linha?.tipo === 'Receita' ? 'Receita' : linha?.tipo === 'Despesa' ? 'Despesa' : null;
        const valorCentavos = valorEmCentavos(linha?.valor);
        if (!descricao || !descricaoCanonica || !data || !tipo || valorCentavos === null) {
            const erro = new Error(`Transação inválida na posição ${indice + 1}. Confira data, descrição, tipo e valor.`);
            erro.statusHttp = 400;
            erro.codigoPublico = 'TRANSACAO_IMPORTACAO_INVALIDA';
            throw erro;
        }

        const normalizada = {
            descricao,
            descricaoCanonica,
            data,
            tipo,
            valorCentavos,
            valor: valorCentavos / 100,
            categoria: String(linha?.categoria || 'Outros').trim().slice(0, 120) || 'Outros',
            fitid: normalizarFitid(linha?.id_externo ?? linha?.fitid)
        };
        const chaveCanonica = criarChaveCanonicaImportacao(contaId, normalizada);
        const descricaoDeOrigem = descricao
            .normalize('NFC')
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
        if (!ocorrenciasPorDescricaoDeOrigem.has(chaveCanonica)) {
            ocorrenciasPorDescricaoDeOrigem.set(chaveCanonica, new Map());
        }
        const contagensDaChave = ocorrenciasPorDescricaoDeOrigem.get(chaveCanonica);
        normalizada.ocorrencia = (contagensDaChave.get(descricaoDeOrigem) || 0) + 1;
        contagensDaChave.set(descricaoDeOrigem, normalizada.ocorrencia);
        normalizada.identidade = criarIdentidadeImportacao(contaId, normalizada);
        return normalizada;
    });
}
function assinarHashPrevia(usuarioId, tipoArquivo, hashArquivo) {
    const segredo = String(process.env.SESSION_SECRET || '');
    const hash = String(hashArquivo || '').toLowerCase();
    if (!segredo || !/^[a-f0-9]{64}$/.test(hash)) return null;
    return crypto.createHmac('sha256', segredo)
        .update(`${Number(usuarioId)}|${String(tipoArquivo).toUpperCase()}|${hash}`)
        .digest('hex');
}
function assinaturaHashPreviaValida(usuarioId, tipoArquivo, hashArquivo, assinatura) {
    const esperada = assinarHashPrevia(usuarioId, tipoArquivo, hashArquivo);
    const recebida = String(assinatura || '').toLowerCase();
    if (!esperada || !/^[a-f0-9]{64}$/.test(recebida)) return false;
    return crypto.timingSafeEqual(Buffer.from(esperada, 'hex'), Buffer.from(recebida, 'hex'));
}
// --- ROTA: CRIAR SESSÃO DE PAGAMENTO (MERCADO PAGO) ---
// --- ROTA: CRIAR ASSINATURA MENSAL (MERCADO PAGO) ---
// Extrai o nome do estabelecimento limpando os prefixos padrão dos bancos
function extrairPalavraChave(descricao) {
    const chave = descricao
        .replace(/DEBITO VISA ELECTRON BRASIL\s*/i, '')
        .replace(/COMPRA CARTAO DEB MC\s*/i, '')
        .replace(/PIX ENVIADO OPEN FINANCE\s*/i, '')
        .replace(/PIX ENVIADO\s*/i, '')
        .replace(/PIX RECEBIDO\s*/i, '')
        .replace(/CREDITO LIBERADO PARA PIX\s*/i, '')
        .replace(/CREDITO DE SALARIO\s*/i, '')
        .replace(/PAGAMENTO CARTAO CREDITO BCE\s*/i, '')
        .replace(/PAGAMENTO DE BOLETO OUTROS BANCOS\s*/i, '')
        .replace(/\d{2}\/\d{2}\s*/g, '') // Remove datas como "10/06 "
        .trim();
    return chave.substring(0, 40).trim();
}
async function obterOuCriarContaDoUsuario(userId) {
    const [contas] = await db.promise().query(
        'SELECT id FROM contas_bancarias WHERE usuario_id = ? LIMIT 1',
        [userId]
    );

    if (contas.length > 0) {
        return contas[0].id;
    }

    const [resultado] = await db.promise().query(
        'INSERT INTO contas_bancarias (usuario_id, saldo) VALUES (?, ?)',
        [userId, 0]
    );

    return resultado.insertId;
}
// --- NOVA ROTA: IMPORTAÇÃO E PARSER DE EXTRATO BANCÁRIO OFX ---
// Aplica as regras aprendidas do usuário e, na falta delas, as keywords padrão do sistema
function categorizarTransacao(descricao, regrasUsuario) {
    // 1º: Verifica as regras aprendidas do usuário
    for (const regra of regrasUsuario) {
        if (descricao.toLowerCase().includes(regra.descricao_contem.toLowerCase())) {
            return regra.categoria;
        }
    }

    // 2º: Se não achou regra, aplica as keywords padrão
    const descMinuscula = descricao.toLowerCase();
    if (descMinuscula.includes('credito de salario')) {
        return 'Salário';
    } else if (descMinuscula.includes('unicid') || descMinuscula.includes('mensalidade')) {
        return 'Educação';
    } else if (descMinuscula.includes('pagamento cartao') || descMinuscula.includes('fatura')) {
        return 'Pagamento de Fatura';
    } else if (descMinuscula.includes('pagamento de boleto')) {
        return 'Pagamento de Boleto';
    } else if (descMinuscula.includes('cafe') || descMinuscula.includes('coffee') ||
               descMinuscula.includes('servano') || descMinuscula.includes('prc ali') ||
               descMinuscula.includes('ifood') || descMinuscula.includes('restaurante') ||
               descMinuscula.includes('lanche') || descMinuscula.includes('padaria')) {
        return 'Alimentação';
    } else if (descMinuscula.includes('uber') || descMinuscula.includes('99app') ||
               descMinuscula.includes('combustivel') || descMinuscula.includes('posto')) {
        return 'Transporte';
    } else if (descMinuscula.includes('up mobile') || descMinuscula.includes('vivo') ||
               descMinuscula.includes('tim ') || descMinuscula.includes('claro')) {
        return 'Telecomunicações / Internet';
    } else if (descMinuscula.includes('igreja') || descMinuscula.includes('evangelica')) {
        return 'Igreja / Doações';
    } else if (descMinuscula.includes('bytedance') || descMinuscula.includes('netflix') ||
               descMinuscula.includes('spotify') || descMinuscula.includes('prime')) {
        return 'Entretenimento';
    } else if (descMinuscula.includes('mercado') || descMinuscula.includes('carrefour') ||
               descMinuscula.includes('atacadao') || descMinuscula.includes('assai')) {
        return 'Supermercado';
    } else if (descMinuscula.includes('juros') || descMinuscula.includes('multa') ||
               descMinuscula.includes('iof') || descMinuscula.includes('tarifa')) {
        return 'Taxas Bancárias';
    } else if (descMinuscula.includes('credito liberado')) {
        return 'Crédito Cartão';
    } else if (descMinuscula.includes('pix recebido') || descMinuscula.includes('pix enviado')) {
        return 'Transferência';
    }
    return 'Outros';
}
// --- ROTA: CONVERSOR DE PDF EM LANÇAMENTOS (PRÉVIA, NÃO GRAVA NO BANCO AINDA) ---
// --- EXTRAÇÃO DE TEXTO DO PDF VIA PYTHON (pdfplumber) ---
// Chama extrator_pdf.py como subprocesso, manda os bytes do PDF pela entrada
// padrão e recebe de volta o texto já com o espaçamento das colunas
// reconstruído — mesmo contrato que o pdf-extrato-parser.js já espera, então
// ele continua funcionando sem nenhuma alteração.
// Extrai o texto do PDF preservando espaçamento entre colunas (sem depender de Python)
async function extrairTextoPdf(bufferPdf) {
    const dados = await pdfParse(bufferPdf, { pagerender: renderComEspacamento });
    return dados.text || '';
}
// =======================================================
// --- CENTRAL E HISTÓRICO DE IMPORTAÇÕES ---
// =======================================================
async function prepararOfxParaPrevia(buffer, usuarioId) {
    const texto = buffer.toString('utf8');
    const dadosConvertidos = parseOfx(texto);
    const raiz = dadosConvertidos.OFX || {};
    const nomeBanco = identificarBanco(raiz);
    const extrato = raiz?.BANKMSGSRSV1?.STMTTRNRS?.STMTRS || {};
    let transacoes = extrato?.BANKTRANLIST?.STMTTRN || [];
    if (!Array.isArray(transacoes)) transacoes = [transacoes];

    const [regrasUsuario] = await db.promise().query(
        'SELECT descricao_contem, categoria FROM regras_categoria WHERE usuario_id = ?',
        [usuarioId]
    );

    const linhas = transacoes.map((tx) => {
        const descricao = tx.MEMO || tx.NAME || 'Transação eletrônica';
        const valorOriginal = numeroOfx(tx.TRNAMT || 0);
        const data = normalizarDataBancaria(tx.DTPOSTED);
        return {
            id_externo: normalizarFitid(tx.FITID),
            data,
            descricao,
            valor: Math.abs(valorOriginal),
            tipo: valorOriginal < 0 ? 'Despesa' : 'Receita',
            categoria: categorizarTransacao(descricao, regrasUsuario)
        };
    }).filter((linha) => linha.data && Number.isFinite(linha.valor) && linha.valor > 0);

    return {
        banco: nomeBanco,
        saldo: extrato?.LEDGERBAL?.BALAMT != null
            ? numeroOfx(extrato.LEDGERBAL.BALAMT)
            : null,
        transacoes: linhas
    };
}

module.exports = { assinarHashPrevia, assinaturaHashPreviaValida, canonicalizarDescricaoImportacao, categorizarTransacao, criarChaveCanonicaImportacao, extrairPalavraChave, extrairTextoPdf, normalizarDataBancaria, normalizarLoteImportacao, prepararOfxParaPrevia, valorEmCentavos };
