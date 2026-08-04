'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOfx, valorTag } = require('../ofx-parser');

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
