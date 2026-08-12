'use strict';

const LIMITE_TEXTO_OFX = 10 * 1024 * 1024;

function escaparRegex(valor) {
    return String(valor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function decodificarEntidades(valor) {
    return String(valor || '')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'")
        .trim();
}

function valorTag(conteudo, nomeTag) {
    const tag = escaparRegex(nomeTag);
    const correspondencia = String(conteudo || '').match(
        new RegExp(`<${tag}\\b[^>]*>\\s*([^<\\r\\n]*)`, 'i')
    );
    return correspondencia ? decodificarEntidades(correspondencia[1]) : undefined;
}

function blocosTag(conteudo, nomeTag, proximaTag) {
    const tag = escaparRegex(nomeTag);
    const proxima = escaparRegex(proximaTag || nomeTag);
    const regex = new RegExp(
        `<${tag}\\b[^>]*>([\\s\\S]*?)(?=<\\/${tag}>|<${proxima}\\b|<\\/BANKTRANLIST>|$)`,
        'gi'
    );
    return [...String(conteudo || '').matchAll(regex)].map((item) => item[1]);
}

function parseOfx(textoOriginal) {
    const texto = String(textoOriginal || '').replace(/^\uFEFF/, '');
    if (!texto.trim()) throw new Error('O arquivo OFX está vazio.');
    if (Buffer.byteLength(texto, 'utf8') > LIMITE_TEXTO_OFX) {
        throw new Error('O arquivo OFX excede o limite permitido.');
    }
    if (!/<OFX\b/i.test(texto)) throw new Error('Estrutura OFX não encontrada.');

    const transacoes = blocosTag(texto, 'STMTTRN', 'STMTTRN').map((bloco) => ({
        TRNTYPE: valorTag(bloco, 'TRNTYPE'),
        DTPOSTED: valorTag(bloco, 'DTPOSTED'),
        TRNAMT: valorTag(bloco, 'TRNAMT'),
        FITID: valorTag(bloco, 'FITID'),
        NAME: valorTag(bloco, 'NAME'),
        MEMO: valorTag(bloco, 'MEMO')
    }));

    return {
        OFX: {
            SIGNONMSGSRSV1: {
                SONRS: { FI: { ORG: valorTag(texto, 'ORG') } }
            },
            BANKMSGSRSV1: {
                STMTTRNRS: {
                    STMTRS: {
                        BANKACCTFROM: { BANKID: valorTag(texto, 'BANKID') },
                        BANKTRANLIST: { STMTTRN: transacoes },
                        LEDGERBAL: { BALAMT: valorTag(texto, 'BALAMT') }
                    }
                }
            }
        }
    };
}

module.exports = { parseOfx, valorTag };
