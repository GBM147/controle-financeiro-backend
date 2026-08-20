'use strict';

function erroArquivo(mensagem) {
    const erro = new Error(mensagem);
    erro.codigoPublico = 'ARQUIVO_INVALIDO';
    erro.statusHttp = 400;
    return erro;
}

function exigirBuffer(buffer) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
        throw erroArquivo('O arquivo enviado está vazio ou é inválido.');
    }
}

function validarAssinaturaPdf(buffer) {
    exigirBuffer(buffer);
    const cabecalho = buffer.subarray(0, 1024).toString('latin1');
    if (!/^[\s\uFEFF]*%PDF-/i.test(cabecalho)) {
        throw erroArquivo('O conteúdo enviado não possui uma assinatura PDF válida.');
    }
}

function validarEstruturaOfx(buffer) {
    exigirBuffer(buffer);
    const inicio = buffer.subarray(0, 16 * 1024).toString('utf8').replace(/^\uFEFF/, '');
    if (inicio.includes('\u0000') || !/<OFX\b/i.test(inicio)) {
        throw erroArquivo('O conteúdo enviado não possui uma estrutura OFX ou QFX válida.');
    }
}

function detectarTipoImagem(buffer) {
    exigirBuffer(buffer);

    if (
        buffer.length >= 3
        && buffer[0] === 0xff
        && buffer[1] === 0xd8
        && buffer[2] === 0xff
    ) return 'image/jpeg';

    const assinaturaPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    if (buffer.length >= assinaturaPng.length && buffer.subarray(0, 8).equals(assinaturaPng)) {
        return 'image/png';
    }

    if (
        buffer.length >= 12
        && buffer.subarray(0, 4).toString('ascii') === 'RIFF'
        && buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    ) return 'image/webp';

    throw erroArquivo('O conteúdo enviado não é uma imagem JPG, PNG ou WebP válida.');
}

function validarAssinaturaImagem(buffer, tipoMimeInformado) {
    const tipoDetectado = detectarTipoImagem(buffer);
    if (tipoMimeInformado && tipoDetectado !== String(tipoMimeInformado).toLowerCase()) {
        throw erroArquivo('O tipo informado da imagem não corresponde ao conteúdo do arquivo.');
    }
    return tipoDetectado;
}

module.exports = {
    validarAssinaturaPdf,
    validarEstruturaOfx,
    validarAssinaturaImagem,
    detectarTipoImagem
};
