const multer = require('multer');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { validarAssinaturaImagem, validarAssinaturaPdf, validarEstruturaOfx } = require('../../file-signatures');

const LIMITE_EXTRATO_BYTES = 10 * 1024 * 1024;
const LIMITE_TEXTO_PDF_CARACTERES = 500000;
function criarUploadExtrato({ extensoes, tiposMime, mensagem }) {
    return multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: LIMITE_EXTRATO_BYTES, files: 1 },
        fileFilter: (req, file, cb) => {
            const extensao = path.extname(String(file.originalname || '')).toLowerCase();
            const mime = String(file.mimetype || '').toLowerCase();
            if (!extensoes.includes(extensao) || !tiposMime.includes(mime)) {
                const erro = new Error(mensagem);
                erro.codigoPublico = 'ARQUIVO_INVALIDO';
                return cb(erro);
            }
            return cb(null, true);
        }
    });
}
const uploadPdf = criarUploadExtrato({
    extensoes: ['.pdf'],
    tiposMime: ['application/pdf', 'application/octet-stream'],
    mensagem: 'Envie apenas um arquivo PDF válido.'
});
const uploadOfx = criarUploadExtrato({
    extensoes: ['.ofx', '.qfx'],
    tiposMime: ['application/x-ofx', 'application/ofx', 'application/octet-stream', 'text/plain'],
    mensagem: 'Envie apenas um arquivo OFX ou QFX válido.'
});
const uploadImagem = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // máximo: 5 MB
    fileFilter: (req, file, cb) => {
        const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp'];

        if (!tiposAceitos.includes(file.mimetype)) {
            const erro = new Error('Envie apenas imagens JPG, PNG ou WebP.');
            erro.codigoPublico = 'ARQUIVO_INVALIDO';
            return cb(erro);
        }

        cb(null, true);
    }
});
function validarUploadPdf(req, res, next) {
    try {
        if (req.file) validarAssinaturaPdf(req.file.buffer);
        next();
    } catch (erro) {
        next(erro);
    }
}
function validarUploadOfx(req, res, next) {
    try {
        if (req.file) validarEstruturaOfx(req.file.buffer);
        next();
    } catch (erro) {
        next(erro);
    }
}
function validarUploadImagem(req, res, next) {
    try {
        if (req.file) validarAssinaturaImagem(req.file.buffer, req.file.mimetype);
        next();
    } catch (erro) {
        next(erro);
    }
}
function enviarImagemParaCloudinary(buffer, opcoes) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(opcoes, (erro, resultado) => {
            if (erro) return reject(erro);
            resolve(resultado);
        }).end(buffer);
    });
}

module.exports = { LIMITE_TEXTO_PDF_CARACTERES, enviarImagemParaCloudinary, uploadImagem, uploadOfx, uploadPdf, validarUploadImagem, validarUploadOfx, validarUploadPdf };
