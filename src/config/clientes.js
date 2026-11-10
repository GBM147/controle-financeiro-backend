const { MercadoPagoConfig } = require('mercadopago');
const cloudinary = require('cloudinary').v2;
const { Resend } = require('resend');

// O token secreto que o Render vai ler
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
// Inicializamos a API de Email (Resend)
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = { mpClient, resend };
