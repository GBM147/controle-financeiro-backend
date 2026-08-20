'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
    validarAssinaturaPdf,
    validarEstruturaOfx,
    validarAssinaturaImagem,
    detectarTipoImagem
} = require('../file-signatures');

test('aceita assinaturas reais de PDF, OFX, PNG, JPEG e WebP', () => {
    assert.doesNotThrow(() => validarAssinaturaPdf(Buffer.from('%PDF-1.7\n')));
    assert.doesNotThrow(() => validarEstruturaOfx(Buffer.from('OFXHEADER:100\n\n<OFX>')));

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    const webp = Buffer.from('RIFF0000WEBP', 'ascii');
    assert.equal(detectarTipoImagem(png), 'image/png');
    assert.equal(detectarTipoImagem(jpeg), 'image/jpeg');
    assert.equal(detectarTipoImagem(webp), 'image/webp');
});

test('rejeita arquivo disfarçado e divergência entre MIME e conteúdo', () => {
    assert.throws(() => validarAssinaturaPdf(Buffer.from('<html>não é PDF</html>')), /assinatura PDF/);
    assert.throws(() => validarEstruturaOfx(Buffer.from('planilha renomeada.ofx')), /estrutura OFX/);

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.throws(() => validarAssinaturaImagem(png, 'image/jpeg'), /não corresponde/);
});
