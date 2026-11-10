const crypto = require('crypto');

const chaveDados = process.env.DATA_ENCRYPTION_KEY
    ? crypto.createHash('sha256').update(process.env.DATA_ENCRYPTION_KEY).digest()
    : null;
function criptografarDado(valor) {
    if (!chaveDados || valor === null || valor === undefined || valor === '') return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', chaveDados, iv);
    const conteudo = Buffer.concat([cipher.update(String(valor), 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${conteudo.toString('base64')}`;
}
function descriptografarDado(valorCriptografado) {
    if (!chaveDados || !valorCriptografado) return null;
    try {
        const [ivBase64, tagBase64, conteudoBase64] = String(valorCriptografado).split('.');
        const decipher = crypto.createDecipheriv(
            'aes-256-gcm',
            chaveDados,
            Buffer.from(ivBase64, 'base64')
        );
        decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
        return Buffer.concat([
            decipher.update(Buffer.from(conteudoBase64, 'base64')),
            decipher.final()
        ]).toString('utf8');
    } catch (erro) {
        console.error('Não foi possível descriptografar um dado sensível:', erro.message);
        return null;
    }
}
function normalizarEmail(email) {
    return String(email || '').trim().toLowerCase();
}
function gerarHashEmail(email) {
    const emailNormalizado = normalizarEmail(email);
    if (!emailNormalizado) return null;
    const segredoIndice = process.env.EMAIL_INDEX_KEY || process.env.DATA_ENCRYPTION_KEY;
    if (!segredoIndice) {
        return crypto.createHash('sha256').update(emailNormalizado).digest('hex');
    }
    return crypto.createHmac('sha256', segredoIndice).update(emailNormalizado).digest('hex');
}
function revelarIdentidade(usuario) {
    if (!usuario) return usuario;
    const copia = { ...usuario };
    copia.nome = descriptografarDado(copia.nome_criptografado) || copia.nome;
    copia.sobrenome = descriptografarDado(copia.sobrenome_criptografado) || copia.sobrenome;
    copia.email = descriptografarDado(copia.email_criptografado) || copia.email;
    copia.nome_exibicao =
        descriptografarDado(copia.nome_exibicao_criptografado)
        || copia.nome_exibicao
        || copia.nome;
    copia.telefone = descriptografarDado(copia.telefone_criptografado) || copia.telefone;
    delete copia.nome_criptografado;
    delete copia.sobrenome_criptografado;
    delete copia.email_criptografado;
    delete copia.nome_exibicao_criptografado;
    delete copia.telefone_criptografado;
    delete copia.cpf_criptografado;
    delete copia.email_hash;
    return copia;
}
function escaparHtmlServidor(valor) {
    return String(valor ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

module.exports = { chaveDados, criptografarDado, descriptografarDado, escaparHtmlServidor, gerarHashEmail, normalizarEmail, revelarIdentidade };
