'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOfx, valorTag, numeroOfx } = require('../ofx-parser');

test('lê OFX SGML com múltiplas transações', () => {
    const resultado = parseOfx(`OFXHEADER:100
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Exemplo
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>001
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260801120000[-3:BRT]<TRNAMT>-42.50<FITID>abc-1<MEMO>Mercado &amp; Cia
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260802<TRNAMT>1000.00<FITID>abc-2<NAME>Salário
</BANKTRANLIST><LEDGERBAL><BALAMT>957.50</OFX>`);

    const raiz = resultado.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
    assert.equal(raiz.BANKACCTFROM.BANKID, '001');
    assert.equal(raiz.BANKTRANLIST.STMTTRN.length, 2);
    assert.equal(raiz.BANKTRANLIST.STMTTRN[0].MEMO, 'Mercado & Cia');
    assert.equal(raiz.BANKTRANLIST.STMTTRN[1].TRNAMT, '1000.00');
    assert.equal(raiz.LEDGERBAL.BALAMT, '957.50');
});

test('lê tags OFX em XML e rejeita conteúdo inválido', () => {
    const resultado = parseOfx('<OFX><BANKTRANLIST><STMTTRN><DTPOSTED>20260804</DTPOSTED><TRNAMT>-9.90</TRNAMT><FITID>x</FITID></STMTTRN></BANKTRANLIST></OFX>');
    assert.equal(resultado.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS.BANKTRANLIST.STMTTRN[0].FITID, 'x');
    assert.equal(valorTag('<MEMO> Teste </MEMO>', 'MEMO'), 'Teste');
    assert.throws(() => parseOfx('arquivo sem estrutura'), /Estrutura OFX/);
});

test('normaliza valores OFX com ponto ou vírgula sem perder o sinal', () => {
    assert.equal(numeroOfx('-42,50'), -42.5);
    assert.equal(numeroOfx('1.234,56'), 1234.56);
    assert.equal(numeroOfx('1,234.56'), 1234.56);
    assert.equal(numeroOfx('+1000.00'), 1000);
    assert.ok(Number.isNaN(numeroOfx('valor inválido')));
});

test('tolera variações de bancos, acentos e quebras de linha', () => {
    const bancos = [
        ['260', 'Nubank', 'Compra café', '-12,90'],
        ['341', 'Itaú', 'PIX enviado', '-150.00'],
        ['237', 'Bradesco', 'Crédito salário', '2500.00'],
        ['001', 'Banco do Brasil', 'Mercado &amp; Cia', '-89.10'],
        ['033', 'Santander', 'Pagamento cartão', '-320.45'],
        ['077', 'Banco Inter', 'Transferência recebida', '75.00']
    ];

    for (const [codigo, banco, memo, valor] of bancos) {
        const resultado = parseOfx(
            `OFXHEADER:100\r\nDATA:OFXSGML\r\n\r\n<OFX><FI><ORG>${banco}\r\n`
            + `<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>${codigo}\r\n`
            + `<BANKTRANLIST><STMTTRN><DTPOSTED>20260820120000[-3:BRT]\r\n`
            + `<TRNAMT>${valor}\r\n<FITID>${codigo}-unico\r\n<MEMO>${memo}\r\n</BANKTRANLIST></OFX>`
        );
        const raiz = resultado.OFX.BANKMSGSRSV1.STMTTRNRS.STMTRS;
        assert.equal(raiz.BANKACCTFROM.BANKID, codigo);
        assert.equal(raiz.BANKTRANLIST.STMTTRN[0].FITID, `${codigo}-unico`);
        assert.ok(Number.isFinite(numeroOfx(raiz.BANKTRANLIST.STMTTRN[0].TRNAMT)));
    }
});
