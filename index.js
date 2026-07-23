require('dotenv').config();
const { MercadoPagoConfig, PreApproval, Payment } = require('mercadopago');
// O token secreto que o Render vai ler
const mpClient = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');
const multer = require('multer');
const ofx = require('node-ofx-parser');
const path = require('path');
const pdfParse = require('pdf-parse');
const { renderComEspacamento } = require('./pdfrender');
const { extrairTransacoesDoPdf, detectarBanco: detectarBancoPdf } = require('./Pdfextratoparser');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});
const upload = multer({ storage: multer.memoryStorage() }); // Guarda o ficheiro temporariamente na memória do servidor
const uploadImagem = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // máximo: 5 MB
    fileFilter: (req, file, cb) => {
        const tiposAceitos = ['image/jpeg', 'image/png', 'image/webp'];

        if (!tiposAceitos.includes(file.mimetype)) {
            return cb(new Error('Envie apenas imagens JPG, PNG ou WebP.'));
        }

        cb(null, true);
    }
});

function enviarImagemParaCloudinary(buffer, opcoes) {
    return new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(opcoes, (erro, resultado) => {
            if (erro) return reject(erro);
            resolve(resultado);
        }).end(buffer);
    });
}
// Inicializamos a API de Email (Resend)
const resend = new Resend(process.env.RESEND_API_KEY);

// --- MAPA DE BANCOS (código Febraban -> nome + cor de referência) ---
const BANCOS_INFO = {
    '001': { nome: 'Banco do Brasil',  cor: '#F8DE00' },
    '033': { nome: 'Santander',        cor: '#EC0000' },
    '104': { nome: 'Caixa Econômica',  cor: '#0066B3' },
    '237': { nome: 'Bradesco',         cor: '#CC092F' },
    '341': { nome: 'Itaú',             cor: '#EC7000' },
    '260': { nome: 'Nubank',           cor: '#820AD1' },
    '077': { nome: 'Banco Inter',      cor: '#FF7A00' },
    '212': { nome: 'Banco Original',   cor: '#00AA4F' },
    '336': { nome: 'C6 Bank',          cor: '#1E1E1E' },
    '290': { nome: 'PagBank',          cor: '#00C650' },
    '756': { nome: 'Sicoob',           cor: '#6DB33F' },
    '748': { nome: 'Sicredi',          cor: '#7CB342' },
    'MANUAL': { nome: 'Manual', cor: '#8a9ba8' },
    'OUTRO': { nome: 'Outro banco', cor: '#607d8b' }
};

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
// 1. Inicializamos o servidor Express
const app = express();
// 2. Middlewares essenciais (precisam vir ANTES de qualquer rota, incluindo o webhook,
// senão req.body chega vazio nas rotas registradas antes deles)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// Isso faz o servidor ler e entregar automaticamente os seus ficheiros HTML/CSS da pasta public
app.use(express.static('public'));

// --- SESSÃO DE SERVIDOR (corrige o IDOR: userId deixa de vir do cliente) ---
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);

const sessionStore = new MySQLStore({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

app.set('trust proxy', 1); // necessário no Render para o cookie 'secure' funcionar atrás do proxy

app.use(session({
    // "name" é a opção reconhecida pelo express-session para o nome do cookie.
    // Antes estava como "key", que era ignorado e deixava o cookie com o nome padrão.
    name: 'gbm_sid',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000 // 30 dias
    }
}));

async function exigirLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({ success: false, error: 'Sessão expirada. Faça login novamente.' });
    }

    try {
        // Também confirma que a conta ainda existe. Assim, ao excluir uma conta,
        // sessões abertas em outros dispositivos deixam de funcionar imediatamente.
        const [usuarios] = await db.promise().query(
            'SELECT id FROM usuarios WHERE id = ? LIMIT 1',
            [req.session.userId]
        );

        if (usuarios.length === 0) {
            return req.session.destroy(() => {
                const opcoesCookie = {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                };
                res.clearCookie('gbm_sid', opcoesCookie);
                res.clearCookie('connect.sid', opcoesCookie); // limpa o cookie usado por versões anteriores
                return res.status(401).json({ success: false, error: 'Esta conta não existe mais. Faça login novamente.' });
            });
        }

        return next();
    } catch (erro) {
        console.error('Erro ao validar sessão:', erro);
        return res.status(500).json({ success: false, error: 'Não foi possível validar a sessão.' });
    }
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
app.post('/criar-sessao-pagamento', exigirLogin, express.json(), async (req, res) => {
    const userId = req.session.userId;

    try {
        const [rows] = await db.promise().query("SELECT email FROM usuarios WHERE id = ?", [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const meuDominio = `${req.protocol}://${req.get('host')}`;
        const preApproval = new PreApproval(mpClient);

        // Cria a ASSINATURA diretamente, com 1 mês grátis (trial)
        const resultado = await preApproval.create({
            body: {
                reason: 'Plano Mensal - GBM',
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months',
                    transaction_amount: 9.90,
                    currency_id: 'BRL',
                    free_trial: {
                        frequency: 1,
                        frequency_type: 'months'
                    }
                },
                back_url: `${meuDominio}/dashboard.html?pago=sucesso`,
                payer_email: rows[0].email,
                external_reference: userId.toString()
            }
        });

        if (!resultado.id) {
            throw new Error('O Mercado Pago não retornou o identificador da assinatura.');
        }

        // Guardamos o ID para conseguir cancelar a cobrança recorrente no Mercado
        // Pago, e não apenas mudar um texto/status na nossa própria base.
        await db.promise().query(
            `UPDATE usuarios
             SET mercadopago_preapproval_id = ?, assinatura_cancelada_no_mp = 0
             WHERE id = ?`,
            [String(resultado.id), userId]
        );

        res.json({ url: resultado.init_point }); 
    } catch (error) {
        console.error("Erro ao criar assinatura no MP:", error);
        res.status(500).json({ error: 'Falha ao gerar link de assinatura.' });
    }
});

// --- O CAIXA AUTOMÁTICO (WEBHOOK DO MERCADO PAGO) ---
app.post('/webhook-mercadopago', async (req, res) => {
    // O Mercado Pago exige que respondamos "Tudo OK" (200) imediatamente
    res.sendStatus(200); 

    // Ele pode mandar o ID do pagamento de duas formas, tentamos ler ambas
    const paymentId = req.query.id || (req.body.data && req.body.data.id);

    // Se houver um pagamento para investigar
    if (paymentId && (req.body.type === 'payment' || req.body.action === 'payment.created')) {
        try {
            const paymentAPI = new Payment(mpClient);
            const pagamentoInfo = await paymentAPI.get({ id: paymentId });

            // Se a pessoa pagou o PIX ou o cartão passou
            if (pagamentoInfo.status === 'approved') {
                const userId = pagamentoInfo.external_reference; // Lemos a nossa etiqueta!
                console.log(`💰 PAGAMENTO APROVADO! Liberando usuário ID: ${userId}`);
                
                // Um webhook atrasado de uma cobrança antiga não pode reativar
                // uma assinatura que já foi cancelada pelo usuário.
                const [atualizacao] = await db.promise().query(
                    `UPDATE usuarios
                     SET status_pagamento = 'pago'
                     WHERE id = ? AND assinatura_cancelada_no_mp = 0`,
                    [userId]
                );

                if (atualizacao.affectedRows === 0) {
                    console.log(`🛑 Pagamento ${paymentId} recebido, mas a conta ${userId} permanece cancelada.`);
                }
            }
        } catch (err) {
            console.error("Erro ao checar status do pagamento no MP:", err);
        }
    }
});
// --- LIGAÇÃO À BASE DE DADOS MYSQL ---
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT, 
    ssl: {
        rejectUnauthorized: false
    }
});

let promessaEstruturaAlertasMultiplos = null;

function garantirEstruturaAlertasMultiplos() {
    if (promessaEstruturaAlertasMultiplos) return promessaEstruturaAlertasMultiplos;

    promessaEstruturaAlertasMultiplos = (async () => {
        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS metas_alertas_percentuais (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                categoria VARCHAR(120) NOT NULL,
                percentual TINYINT UNSIGNED NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_meta_alerta_percentual (usuario_id, categoria, percentual),
                KEY idx_meta_alerta_usuario_categoria (usuario_id, categoria)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);

        await db.promise().query(`
            CREATE TABLE IF NOT EXISTS metas_alertas_disparos (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                usuario_id INT NOT NULL,
                categoria VARCHAR(120) NOT NULL,
                percentual TINYINT UNSIGNED NOT NULL,
                ano_mes CHAR(7) NOT NULL,
                criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                UNIQUE KEY uk_meta_alerta_disparo (usuario_id, categoria, percentual, ano_mes),
                KEY idx_meta_disparo_usuario (usuario_id)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        `);
    })().catch((erro) => {
        promessaEstruturaAlertasMultiplos = null;
        throw erro;
    });

    return promessaEstruturaAlertasMultiplos;
}

db.connect((err) => {
    if (err) {
        console.error('❌ Erro a ligar ao MySQL:', err.message);
        return;
    }
    console.log('📦 Ligado à base de dados MySQL com sucesso!');
    garantirEstruturaAlertasMultiplos()
        .then(() => console.log('🔔 Estrutura de múltiplos alertas pronta.'))
        .catch((erroEstrutura) => console.error('❌ Erro ao preparar múltiplos alertas:', erroEstrutura));
});
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

app.post('/importar-ofx', exigirLogin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhum ficheiro foi selecionado.' });
        }
        // 1. Converte o ficheiro binário recebido numa string de texto limpa
        const ofxRawData = req.file.buffer.toString('utf8');
        const dadosConvertidos = ofx.parse(ofxRawData);
        // 2. Navega pela árvore estrutural padrão de um ficheiro OFX
        const rais = dadosConvertidos.OFX || {};
        const nomeBanco = identificarBanco(rais);
        const bankMsg = rais.BANKMSGSRSV1 || {};
        const stmtTrnRs = bankMsg.STMTTRNRS || {};
        const stmtRs = stmtTrnRs.STMTRS || {};
        const bankTranList = stmtRs.BANKTRANLIST || {};
        let transacoesOfx = bankTranList.STMTTRN || [];
        // Proteção: se o extrato tiver apenas 1 movimento, o parser gera um objeto único em vez de uma lista. Forçamos a ser lista.
        if (!Array.isArray(transacoesOfx)) {
            transacoesOfx = [transacoesOfx];
        }
        // 3. Localiza a conta do utilizador para vincular os lançamentos
        const userId = req.session.userId;
        const contaInternaId = await obterOuCriarContaDoUsuario(userId);
        console.log('🔐 [IMPORTAÇÃO OFX]', {
            usuarioDaSessao: userId,
            contaUsada: contaInternaId,
            banco: nomeBanco,
            quantidadeDeTransacoes: transacoesOfx.length
        });
        // Carrega as regras salvas pelo usuário para usar na categorização
const [regrasUsuario] = await db.promise().query(
    'SELECT descricao_contem, categoria FROM regras_categoria WHERE usuario_id = ?',
    [userId]
);
        // --- NOVO: CAPTURA O SALDO EXATO DO BANCO PELO OFX ---
        const ledgerBal = stmtRs.LEDGERBAL || {};
        if (ledgerBal.BALAMT) {
            const saldoReal = parseFloat(ledgerBal.BALAMT);
            await db.promise().query('UPDATE contas_bancarias SET saldo = ? WHERE id = ?', [saldoReal, contaInternaId]);

            // Guarda o saldo desse banco específico, sem apagar o saldo dos outros bancos já importados
            await db.promise().query(
                `INSERT INTO saldos_por_banco (usuario_id, banco, saldo)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE saldo = VALUES(saldo)`,
                [userId, nomeBanco, saldoReal]
            );
        }
        // -----------------------------------------------------

        let inseridas = 0;
        let duplicadas = 0;
        // 4. Varre cada linha do extrato bancário
        for (const tx of transacoesOfx) {
    const descricao = tx.MEMO || tx.NAME || 'Transação Eletrónica';
    let transacaoIdBancario = tx.FITID;
    if (!transacaoIdBancario || transacaoIdBancario === '000000') {
        const chaveUnica = `${contaInternaId}-${tx.DTPOSTED}-${tx.TRNAMT}-${descricao}`;
        transacaoIdBancario = crypto.createHash('md5').update(chaveUnica).digest('hex');
    }
            
            // --- A MÁGICA DA CONVERSÃO ENTRA AQUI ---
            const valorOriginal = parseFloat(tx.TRNAMT);
            let tipo = 'Receita'; // Assume como Receita por padrão
            let valor = valorOriginal;

            // Se o valor for menor que zero, é uma saída de dinheiro
            if (valorOriginal < 0) {
                tipo = 'Despesa';
                valor = Math.abs(valorOriginal); // Transforma -100 em 100
            }
            // ----------------------------------------
// Categoriza a transação usando as regras do usuário + keywords padrão
let categoria = categorizarTransacao(descricao, regrasUsuario);
            // Tratamento da Data (O padrão do OFX é YYYYMMDDHHMMSS)
            let dataFormatada = new Date().toISOString().split('T')[0];
            if (tx.DTPOSTED && tx.DTPOSTED.length >= 8) {
                const ano = tx.DTPOSTED.substring(0, 4);
                const mes = tx.DTPOSTED.substring(4, 6);
                const dia = tx.DTPOSTED.substring(6, 8);
                dataFormatada = `${ano}-${mes}-${dia}`;
            }
            
            // 5. Salva na base de dados. Se o transacao_id_pluggy já existir, ele simplesmente ignora para não duplicar!
            const sql = `
                INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao, banco)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE conta_id = conta_id
            `;
            const [resultadoInsert] = await db.promise().query(sql, [
                contaInternaId, transacaoIdBancario, descricao, valor, tipo, categoria, dataFormatada, nomeBanco
            ]);
            
            // affectedRows = 1 significa nova linha. affectedRows = 0 ou 2 significa que já existia e foi ignorada.
            if (resultadoInsert.affectedRows === 1) {
                inseridas++;
            } else {
                duplicadas++;
            }
        }
        
        // Executa o seu auditor de alertas automático para verificar se o novo extrato estourou alguma meta
        if (typeof auditarMetas === 'function') {
            await auditarMetas();
        }
        res.json({
            success: true,
            message: `Sincronização concluída com sucesso! 🚀 Adicionadas: ${inseridas} novas movimentações. Duplicadas ignoradas: ${duplicadas}.`
        });
    } catch (error) {
        console.error('❌ Erro crítico no processador OFX:', error);
        res.status(500).json({ success: false, message: 'Falha interna ao decodificar o extrato bancário.' });
    }
});
// --- ROTA: CONVERSOR DE PDF EM LANÇAMENTOS (PRÉVIA, NÃO GRAVA NO BANCO AINDA) ---
// --- EXTRAÇÃO DE TEXTO DO PDF VIA PYTHON (pdfplumber) ---
// Chama extrator_pdf.py como subprocesso, manda os bytes do PDF pela entrada
// padrão e recebe de volta o texto já com o espaçamento das colunas
// reconstruído — mesmo contrato que o Pdfextratoparser.js já espera, então
// ele continua funcionando sem nenhuma alteração.
// Extrai o texto do PDF preservando espaçamento entre colunas (sem depender de Python)
async function extrairTextoPdf(bufferPdf) {
    const dados = await pdfParse(bufferPdf, { pagerender: renderComEspacamento });
    return dados.text || '';
}

app.post('/pdf-extrato/preview', exigirLogin, upload.single('arquivo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'Nenhum ficheiro PDF foi selecionado.' });
        }
        const userId = req.session.userId;

        // 1. Extrai o texto puro do PDF (preservando o espaçamento entre colunas da tabela)
        const texto = await extrairTextoPdf(req.file.buffer);

        // 2. Roda o extrator de transações (regras genéricas + conferência de saldo)
        const bancoDetectado = detectarBancoPdf(texto);
        const { transacoes, reconciliacao, confianca } = await extrairTransacoesDoPdf(texto);

        if (transacoes.length === 0) {
            return res.status(422).json({
                success: false,
                message: 'Não conseguimos identificar nenhuma transação nesse PDF. Ele pode ser um extrato escaneado (imagem) ou ter um layout muito diferente do esperado.'
            });
        }

        // 3. Carrega as regras do usuário para já sugerir uma categoria em cada linha
        const [regrasUsuario] = await db.promise().query(
            'SELECT descricao_contem, categoria FROM regras_categoria WHERE usuario_id = ?',
            [userId]
        );

        const transacoesComCategoria = transacoes.map(t => ({
            ...t,
            categoria: categorizarTransacao(t.descricao, regrasUsuario)
        }));

        res.json({
            success: true,
            banco_detectado: bancoDetectado,
            confianca, // 'alta' (achou coluna de saldo, deu pra conferir) ou 'baixa' (modo simples)
            reconciliacao, // null quando não foi possível conferir o saldo
            transacoes: transacoesComCategoria
        });
    } catch (error) {
        console.error('❌ Erro ao converter PDF:', error);
        res.status(500).json({ success: false, message: 'Falha ao ler o PDF. Verifique se o ficheiro não está corrompido ou protegido por senha.' });
    }
});

// --- ROTA: CONFIRMA E GRAVA AS TRANSAÇÕES REVISADAS PELO USUÁRIO ---
app.post('/pdf-extrato/confirmar', exigirLogin, async (req, res) => {
    try {
        const { banco, transacoes } = req.body;
        const userId = req.session.userId;
        if (!Array.isArray(transacoes) || transacoes.length === 0) {
            return res.status(400).json({ success: false, message: 'Nenhuma transação para importar.' });
        }

        const contaInternaId = await obterOuCriarContaDoUsuario(userId);
        const nomeBanco = banco || 'Outro banco';
        console.log('🔐 [IMPORTAÇÃO PDF]', {
            usuarioDaSessao: userId,
            contaUsada: contaInternaId,
            banco: nomeBanco,
            quantidadeDeTransacoes: transacoes.length
        });

        let inseridas = 0;
        let duplicadas = 0;

        for (const t of transacoes) {
            const { data, descricao, valor, tipo, categoria } = t;
            if (!data || !descricao || valor === undefined || valor === null || !tipo) continue;

            const valorFinal = Math.abs(parseFloat(valor));
            const valorComSinal = tipo === 'Despesa' ? -valorFinal : valorFinal;

            // Como o PDF não tem um ID único de transação (como o FITID do OFX),
            // criamos uma "impressão digital" da linha para evitar duplicar o mesmo lançamento
            const chaveUnica = `${contaInternaId}-${data}-${valorComSinal}-${descricao}`;
            const transacaoIdUnico = crypto.createHash('md5').update(chaveUnica).digest('hex');

            const sql = `
                INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao, banco)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE conta_id = conta_id
            `;
            const [resultado] = await db.promise().query(sql, [
                contaInternaId, transacaoIdUnico, descricao, valorFinal, tipo, categoria || 'Outros', data, nomeBanco
            ]);

            if (resultado.affectedRows === 1) {
                inseridas++;
            } else {
                duplicadas++;
            }
        }

        if (typeof auditarMetas === 'function') {
            await auditarMetas();
        }

        res.json({
            success: true,
            message: `Importação concluída! 🚀 Adicionadas: ${inseridas} novas movimentações. Duplicadas ignoradas: ${duplicadas}.`
        });
    } catch (error) {
        console.error('❌ Erro ao confirmar importação de PDF:', error);
        res.status(500).json({ success: false, message: 'Falha ao gravar as transações.' });
    }
});

// --- ROTA 1: CADASTRO DE USUÁRIO ---
app.post('/cadastro', async (req, res) => {
    const { nome, sobrenome, email, telefone, senha } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const sql = `INSERT INTO usuarios 
            (nome, sobrenome, email, telefone, senha_hash, status_pagamento, trial_expira) 
            VALUES (?, ?, ?, ?, ?, 'trial', DATE_ADD(NOW(), INTERVAL 30 DAY))`;
        const [result] = await db.promise().query(sql, [nome, sobrenome, email, telefone, senhaHash]);
        res.json({ success: true, userId: result.insertId, message: 'Cadastro realizado!' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'E-mail já cadastrado!' });
        }
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});
// --- ROTA 2: GERAR E ENVIAR O CÓDIGO (RESEND + ASYNC/AWAIT) ---
app.post('/enviar-codigo', async (req, res) => {
    const { userId, canal } = req.body;
    try {
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        await db.promise().query("UPDATE usuarios SET token_verificacao = ? WHERE id = ?", [codigo, userId]);
        if (canal === 'email') {
            const [rows] = await db.promise().query("SELECT email, nome FROM usuarios WHERE id = ?", [userId]);
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Usuário não encontrado no banco.' });
            }
            const usuario = rows[0];
            const { error } = await resend.emails.send({
                from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                to: usuario.email.toLowerCase().trim(),
                subject: 'GBM - Seu Código de Acesso',
                html: `
                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                        <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                        <p>Olá, ${usuario.nome}. Seu código de verificação é:</p>
                        <h1 style="letter-spacing: 5px; color: #10b981; background: #111c2e; padding: 15px; border-radius: 8px; display: inline-block;">
                            ${codigo}
                        </h1>
                        <p style="color: #8a9ba8; font-size: 12px;">Se você não solicitou este acesso, ignore este e-mail.</p>
                    </div>
                `
            });
            if (error) {
                console.error("Erro da API Resend:", error);
                return res.status(500).json({ success: false, message: 'Falha no provedor de e-mail.' });
            }
            res.json({ success: true, message: 'Código enviado com sucesso!' });
        } else {
            res.status(400).json({ success: false, message: 'Canal de verificação inválido.' });
        }
    } catch (erro) {
        console.error("Erro crítico no envio do código:", erro);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});
// --- LÓGICA DE NEGÓCIO EVOLUÍDA: RECEITAS, DESPESAS E METAS ---
app.get('/resumo-financeiro', exigirLogin, async (req, res) => {
    try {
        const { mes, ano } = req.query;
        const userId = req.session.userId;
        let sql = `
            SELECT 
                t.categoria, 
                t.tipo,
                t.banco,
                SUM(t.valor) AS total_movimentado, 
                COUNT(t.id) AS qtd_transacoes,
                AVG(t.valor) AS ticket_medio,
                m.valor_limite AS teto_gastos
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            LEFT JOIN metas m ON t.categoria = m.categoria AND m.usuario_id = cb.usuario_id
            WHERE cb.usuario_id = ?
        `;
        const params = [userId];
        if (mes && mes !== 'todos') {
            const mesesArray = mes.split(',');
            const placeholders = mesesArray.map(() => '?').join(',');
            sql += ` AND MONTH(t.data_transacao) IN (${placeholders})`;
            params.push(...mesesArray);
        }
        if (ano && ano !== 'todos') {
            sql += ` AND YEAR(t.data_transacao) = ?`;
            params.push(ano);
        }
        sql += ` GROUP BY t.categoria, t.tipo, t.banco ORDER BY total_movimentado ASC;`;
        const [rows] = await db.promise().query(sql, params);

        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error("❌ Erro na lógica de resumo com balanço:", error);
        res.status(500).json({ status: 'error', message: 'Falha ao processar resumo financeiro' });
    }
});

// --- NOVA ROTA: ECONOMIA DO MÊS COMPARADA AO MÊS ANTERIOR ---
app.get('/economia-mensal', exigirLogin, async (req, res) => {
    try {
        const { mes, ano } = req.query;
        const userId = req.session.userId;
        const mesAtual = parseInt(mes);
        const anoAtual = parseInt(ano);

        let mesAnterior = mesAtual - 1;
        let anoAnterior = anoAtual;
        if (mesAnterior === 0) {
            mesAnterior = 12;
            anoAnterior = anoAtual - 1;
        }

        const sql = `
            SELECT MONTH(t.data_transacao) as mes, YEAR(t.data_transacao) as ano,
                   SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END) as despesas,
                   SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END) as receitas
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ?
              AND ((MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?)
                OR (MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?))
            GROUP BY YEAR(t.data_transacao), MONTH(t.data_transacao)
        `;
        const [rows] = await db.promise().query(sql, [userId, mesAtual, anoAtual, mesAnterior, anoAnterior]);

        const atual = rows.find(r => r.mes === mesAtual && r.ano === anoAtual) || { despesas: 0, receitas: 0 };
        const anterior = rows.find(r => r.mes === mesAnterior && r.ano === anoAnterior);

        const despesaAtual = parseFloat(atual.despesas) || 0;
        const despesaAnterior = anterior ? (parseFloat(anterior.despesas) || 0) : null;

        const economia = despesaAnterior !== null ? (despesaAnterior - despesaAtual) : null;
        const percentual = (despesaAnterior && despesaAnterior > 0) ? (economia / despesaAnterior) * 100 : null;

        res.json({
            despesaAtual,
            despesaAnterior,
            economia,
            percentual,
            temMesAnterior: !!anterior
        });
    } catch (error) {
        console.error('❌ Erro ao calcular economia mensal:', error);
        res.status(500).json({ error: 'Falha ao calcular economia mensal.' });
    }
});

// --- NOVA ROTA: COMPARATIVO DE TODOS OS MESES DE UM ANO ---
app.get('/comparativo-mensal', exigirLogin, async (req, res) => {
    try {
        const { ano } = req.query;
        const userId = req.session.userId;
        const anoConsulta = ano || new Date().getFullYear();

        const sql = `
            SELECT MONTH(t.data_transacao) as mes,
                   SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END) as entradas,
                   SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END) as saidas
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND YEAR(t.data_transacao) = ?
            GROUP BY MONTH(t.data_transacao)
            ORDER BY mes ASC
        `;
        const [rows] = await db.promise().query(sql, [userId, anoConsulta]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao gerar comparativo mensal:', error);
        res.status(500).json({ error: 'Falha ao gerar comparativo mensal.' });
    }
});

// --- NOVA ROTA: ANOS QUE O USUÁRIO TEM DADOS (pra popular o seletor) ---
app.get('/anos-disponiveis', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await db.promise().query(
            `SELECT DISTINCT YEAR(t.data_transacao) as ano
             FROM transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             WHERE cb.usuario_id = ?
             ORDER BY ano DESC`,
            [userId]
        );
        res.json(rows.map(r => r.ano));
    } catch (error) {
        console.error('❌ Erro ao buscar anos disponíveis:', error);
        res.status(500).json({ error: 'Falha ao buscar anos.' });
    }
});

// --- NOVA ROTA: SALVAR/ATUALIZAR METAS DO USUÁRIO ---
app.post('/metas', exigirLogin, async (req, res) => {
    try {
        const { categoria, valor_limite } = req.body;
        const userId = req.session.userId;
        const sql = `
            INSERT INTO metas (categoria, valor_limite, usuario_id) 
            VALUES (?, ?, ?) 
            ON DUPLICATE KEY UPDATE valor_limite = VALUES(valor_limite), usuario_id = VALUES(usuario_id)
        `;
        await db.promise().query(sql, [categoria, valor_limite, userId]);
        console.log(`🎯 Nova meta definida: ${categoria} -> R$ ${valor_limite}`);
        res.json({ success: true, message: 'Orçamento atualizado!' });
    } catch (error) {
        console.error("❌ Erro ao salvar meta:", error);
        res.status(500).json({ error: 'Falha ao salvar meta' });
    }
});
// --- NOVA ROTA: REMOVER LIMITE (TORNAR GASTO FIXO / SEM LIMITE) ---
app.delete('/metas', exigirLogin, async (req, res) => {
    try {
        const { categoria } = req.body;
        const userId = req.session.userId;
        await db.promise().query('DELETE FROM metas WHERE categoria = ? AND usuario_id = ?', [categoria, userId]);
        console.log(`🗑️ Limite removido. A categoria [${categoria}] agora é um gasto fixo.`);
        res.json({ success: true, message: 'Limite removido com sucesso!' });
    } catch (error) {
        console.error("❌ Erro ao remover meta:", error);
        res.status(500).json({ error: 'Falha ao remover meta' });
    }
});
// --- LANÇAMENTO MANUAL ---
app.post('/transacao-manual', exigirLogin, async (req, res) => {
    try {
        const { descricao, valor, tipo, categoria, data_transacao } = req.body;
        const transacaoIdGerado = 'MANUAL_' + Date.now();
        const userId = req.session.userId;
        const contaInternaId = await obterOuCriarContaDoUsuario(userId);
        const valorFinal = Math.abs(valor);
        const sql = `INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao, banco)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        await db.promise().query(sql, [contaInternaId, transacaoIdGerado, descricao, valorFinal, tipo, categoria, data_transacao, 'Manual']);
        console.log(`✍️ Lançamento Manual: ${descricao} | R$ ${valorFinal} | ${data_transacao}`);
        await auditarMetas();
        res.json({ success: true, message: 'Lançamento inserido no MySQL!' });
    } catch (error) {
        console.error("❌ Erro ao salvar lançamento manual:", error);
        res.status(500).json({ error: 'Falha ao processar lançamento.' });
    }
});
// --- ROTA: VERIFICAR STATUS DO USUÁRIO PARA PAGAMENTO ---
app.get('/login-status', exigirLogin, async (req, res) => {
    const userId = req.session.userId;
    try {
        const [rows] = await db.promise().query(
            'SELECT status_pagamento, trial_expira FROM usuarios WHERE id = ?', [userId]
        );
        if (rows.length === 0) return res.status(404).json({ success: false });
        res.json({ statusPagamento: rows[0].status_pagamento, trialExpira: rows[0].trial_expira });
    } catch (e) {
        res.status(500).json({ success: false });
    }
});
// =======================================================
// --- MÓDULO DE NOTIFICAÇÕES E AUDITORIA DE METAS ---
// =======================================================
async function auditarMetas() {
    try {
        await garantirEstruturaAlertasMultiplos();
        const [prefs] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        const percentualAlertaGlobal = prefs.length > 0 ? prefs[0].percentual_alerta : 80;

        // Agora o gasto é calculado POR USUÁRIO (via a conta bancária a que a transação pertence),
        // não somado entre todos os usuários que têm a mesma categoria.
        const sql = `
            SELECT
                cb.usuario_id,
                t.categoria,
                SUM(t.valor) AS total_gasto,
                m.valor_limite,
                COALESCE(map.percentual, m.percentual_alerta, ?) AS percentual_categoria
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            JOIN metas m ON t.categoria = m.categoria AND m.usuario_id = cb.usuario_id
            LEFT JOIN metas_alertas_percentuais map
              ON map.usuario_id = m.usuario_id
             AND map.categoria = m.categoria
            WHERE t.tipo = 'Despesa'
              AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
              AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
            GROUP BY cb.usuario_id, t.categoria, m.valor_limite, m.percentual_alerta, map.percentual
        `;
        const [gastos] = await db.promise().query(sql, [percentualAlertaGlobal]);

        for (const item of gastos) {
            const gastoAbs = Math.abs(item.total_gasto);
            const limite = parseFloat(item.valor_limite);
            const percentualAlerta = Number(item.percentual_categoria);
            const porcentagemAtual = (gastoAbs / limite) * 100;

            if (porcentagemAtual >= percentualAlerta) {
                // A chave única garante que cada faixa (50%, 70% etc.) seja
                // disparada somente uma vez por categoria em cada mês.
                const [registroDisparo] = await db.promise().query(
                    `INSERT IGNORE INTO metas_alertas_disparos
                        (usuario_id, categoria, percentual, ano_mes)
                     VALUES (?, ?, ?, DATE_FORMAT(CURRENT_DATE(), '%Y-%m'))`,
                    [item.usuario_id, item.categoria, percentualAlerta]
                );

                if (registroDisparo.affectedRows === 1) {
                    const msg = `Atenção: você ultrapassou o aviso de ${percentualAlerta}% e já atingiu ${porcentagemAtual.toFixed(1)}% do limite de R$ ${limite.toFixed(2)} na categoria ${item.categoria}.`;

                    try {
                        await db.promise().query(
                            'INSERT INTO alertas (usuario_id, categoria, mensagem) VALUES (?, ?, ?)',
                            [item.usuario_id, item.categoria, msg]
                        );
                    } catch (erroAlerta) {
                        // Se não foi possível criar a notificação, libera a faixa
                        // para uma nova tentativa na próxima auditoria.
                        await db.promise().query(
                            `DELETE FROM metas_alertas_disparos
                             WHERE usuario_id = ?
                               AND categoria = ?
                               AND percentual = ?
                               AND ano_mes = DATE_FORMAT(CURRENT_DATE(), '%Y-%m')`,
                            [item.usuario_id, item.categoria, percentualAlerta]
                        );
                        throw erroAlerta;
                    }

                    console.log(`🔔 NOVO ALERTA GERADO (usuario ${item.usuario_id}): ${msg}`);

                    // --- ENVIO DO E-MAIL DE NOTIFICAÇÃO PARA O DONO DA META ---
                    const [usuarios] = await db.promise().query('SELECT email, nome FROM usuarios WHERE id = ?', [item.usuario_id]);
                    const usuario = usuarios[0];
                    if (usuario && usuario.email) {
                        try {
                            await resend.emails.send({
                                from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                                to: usuario.email.toLowerCase().trim(),
                                subject: `🚨 GBM - ${percentualAlerta}% do limite de ${item.categoria}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                                        <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                                        <p>Olá, ${usuario.nome}.</p>
                                        <h1 style="color: #ef4444;">${porcentagemAtual.toFixed(1)}%</h1>
                                        <p>Você ultrapassou o aviso configurado de <strong>${percentualAlerta}%</strong>.</p>
                                        <p>Já gastou <strong>R$ ${gastoAbs.toFixed(2)}</strong> de um limite de <strong>R$ ${limite.toFixed(2)}</strong> na categoria <strong>${item.categoria}</strong>.</p>
                                        <p style="color: #8a9ba8; font-size: 12px;">Acesse seu painel para mais detalhes.</p>
                                    </div>
                                `
                            });
                        } catch (emailErr) {
                            console.error("❌ Erro ao enviar e-mail de alerta:", emailErr);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("❌ Erro na auditoria de metas:", error);
    }
}
app.get('/configuracoes-alerta', exigirLogin, async (req, res) => {
    try {
        const [rows] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        res.json(rows[0] || { percentual_alerta: 80 });
    } catch (error) {
        console.error('❌ Erro ao buscar configurações de alerta:', error);
        res.status(500).json({ percentual_alerta: 80 });
    }
});
app.post('/configuracoes-alerta', exigirLogin, async (req, res) => {
    try {
        const { percentual } = req.body;
        await db.promise().query('UPDATE preferencias_notificacao SET percentual_alerta = ? WHERE id = 1', [percentual]);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erro ao salvar configurações de alerta:', error);
        res.status(500).json({ success: false });
    }
});
app.get('/alertas', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const [rows] = await db.promise().query(
            'SELECT * FROM alertas WHERE usuario_id = ? ORDER BY data_criacao DESC LIMIT 50',
            [userId]
        );
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao buscar alertas:', error);
        res.status(500).json({ error: 'Falha ao buscar alertas.' });
    }
});
app.post('/alertas/marcar-lida', exigirLogin, async (req, res) => {
    try {
        const { id } = req.body;
        const userId = req.session.userId;
        await db.promise().query('UPDATE alertas SET lida = TRUE WHERE id = ? AND usuario_id = ?', [id, userId]);
        res.json({ success: true });
    } catch (error) {
        console.error('❌ Erro ao marcar alerta como lido:', error);
        res.status(500).json({ success: false });
    }
});
app.get('/relatorio-mensal', exigirLogin, async (req, res) => {
    try {
        const { mes, ano } = req.query;
        const userId = req.session.userId;
        const sql = `
            SELECT t.categoria, t.tipo, IFNULL(SUM(t.valor), 0) as total_movimentado
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?
            GROUP BY t.categoria, t.tipo
        `;
        const [rows] = await db.promise().query(sql, [userId, mes, ano]);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao gerar relatório mensal:', error);
        res.status(500).json({ error: 'Falha ao gerar relatório mensal.' });
    }
});
// --- ROTA: RELATÓRIO DETALHADO (transações individuais para editar categoria) ---
app.get('/relatorio-detalhado', exigirLogin, async (req, res) => {
    try {
        const { mes, ano, banco } = req.query;
        const userId = req.session.userId;

        let sql = `
            SELECT t.id, t.descricao, t.valor, t.tipo, t.categoria, t.data_transacao, t.banco
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?
        `;
        const params = [userId, mes, ano];

        if (banco && banco !== 'todos') {
            sql += ' AND t.banco = ?';
            params.push(banco);
        }

        sql += ' ORDER BY t.data_transacao DESC';

        const [rows] = await db.promise().query(sql, params);
        res.json(rows);
    } catch (error) {
        console.error('❌ Erro ao gerar relatório detalhado:', error);
        res.status(500).json({ error: 'Falha ao gerar relatório detalhado.' });
    }
});

// --- ROTA: ATUALIZAR CATEGORIA DE UMA TRANSAÇÃO ---
app.put('/atualizar-categoria/:id', exigirLogin, async (req, res) => {
    const { id } = req.params;
    const { categoria } = req.body;
    const userId = req.session.userId;
    try {
        const [result] = await db.promise().query(
            `UPDATE transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             SET t.categoria = ?
             WHERE t.id = ? AND cb.usuario_id = ?`,
            [categoria, id, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Transação não encontrada para este usuário.' });
        }
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});
app.get('/metas-resumo', exigirLogin, async (req, res) => {
    try {
        await garantirEstruturaAlertasMultiplos();
        const userId = req.session.userId;
        const sql = `
            SELECT
                m.categoria,
                m.valor_limite AS limite,
                m.percentual_alerta,
                IFNULL(SUM(
                    CASE WHEN t.tipo = 'Despesa' THEN ABS(t.valor) ELSE 0 END
                ), 0) AS gasto
            FROM metas m
            LEFT JOIN contas_bancarias cb
              ON cb.usuario_id = m.usuario_id
            LEFT JOIN transacoes t
              ON t.conta_id = cb.id
             AND t.categoria = m.categoria
             AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
             AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
            WHERE m.usuario_id = ?
            GROUP BY m.categoria, m.valor_limite, m.percentual_alerta
        `;
        const [rows] = await db.promise().query(sql, [userId]);
        const [faixas] = await db.promise().query(
            `SELECT categoria, percentual
             FROM metas_alertas_percentuais
             WHERE usuario_id = ?
             ORDER BY categoria, percentual`,
            [userId]
        );

        const faixasPorCategoria = new Map();
        for (const faixa of faixas) {
            if (!faixasPorCategoria.has(faixa.categoria)) {
                faixasPorCategoria.set(faixa.categoria, []);
            }
            faixasPorCategoria.get(faixa.categoria).push(Number(faixa.percentual));
        }

        const resposta = rows.map((meta) => ({
            categoria: meta.categoria,
            limite: meta.limite,
            gasto: meta.gasto,
            // Limites antigos continuam funcionando com o percentual que já existia.
            percentuais_alerta: faixasPorCategoria.get(meta.categoria)
                || [Number(meta.percentual_alerta || 80)]
        }));

        res.json(resposta);
    } catch (error) {
        console.error('❌ Erro ao carregar resumo dos limites:', error);
        res.status(500).json({ success: false, error: 'Falha ao carregar os limites.' });
    }
});
app.post('/atualizar-meta-alerta', exigirLogin, async (req, res) => {
    const banco = db.promise();
    let transacaoAberta = false;

    try {
        await garantirEstruturaAlertasMultiplos();
        const { categoria, valor_limite, percentual_alerta, percentuais_alerta } = req.body;
        const userId = req.session.userId;
        const categoriaLimpa = String(categoria || '').trim();
        const valorLimite = Number(valor_limite);
        const percentuaisRecebidos = Array.isArray(percentuais_alerta)
            ? percentuais_alerta
            : [percentual_alerta];
        const percentuais = [...new Set(
            percentuaisRecebidos
                .map(Number)
                .filter((valor) => Number.isInteger(valor) && valor >= 1 && valor <= 100)
        )].sort((a, b) => a - b);

        if (!categoriaLimpa || categoriaLimpa.length > 120) {
            return res.status(400).json({ success: false, error: 'Informe uma categoria válida.' });
        }
        if (!Number.isFinite(valorLimite) || valorLimite <= 0) {
            return res.status(400).json({ success: false, error: 'O limite precisa ser maior que zero.' });
        }
        if (percentuais.length === 0) {
            return res.status(400).json({ success: false, error: 'Adicione ao menos um percentual entre 1% e 100%.' });
        }

        await banco.beginTransaction();
        transacaoAberta = true;

        await banco.query(
            `INSERT INTO metas (categoria, valor_limite, percentual_alerta, usuario_id)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE valor_limite = VALUES(valor_limite), percentual_alerta = VALUES(percentual_alerta)`,
            [categoriaLimpa, valorLimite, percentuais[0], userId]
        );

        await banco.query(
            'DELETE FROM metas_alertas_percentuais WHERE usuario_id = ? AND categoria = ?',
            [userId, categoriaLimpa]
        );

        const marcadores = percentuais.map(() => '(?, ?, ?)').join(', ');
        const valores = percentuais.flatMap((percentual) => [userId, categoriaLimpa, percentual]);
        await banco.query(
            `INSERT INTO metas_alertas_percentuais (usuario_id, categoria, percentual)
             VALUES ${marcadores}`,
            valores
        );

        await banco.commit();
        transacaoAberta = false;
        await auditarMetas();
        res.json({ success: true, percentuais_alerta: percentuais });
    } catch (error) {
        if (transacaoAberta) {
            try {
                await banco.rollback();
            } catch (erroRollback) {
                console.error('❌ Erro ao desfazer atualização do limite:', erroRollback);
            }
        }
        console.error('❌ Erro ao atualizar meta/alerta:', error);
        res.status(500).json({ success: false, error: 'Falha ao atualizar meta.' });
    }
});
// --- ROTA DE LOGIN CORRIGIDA (PULA VERIFICAÇÃO SE JÁ VERIFICADO) ---
app.post('/login', async (req, res) => {
    const { identificacao, senha } = req.body;
    const sql = "SELECT * FROM usuarios WHERE email = ?";
    db.query(sql, [identificacao], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
        }
        const usuario = results[0];
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }

        // Cria um novo identificador de sessão em cada login. Isso impede que
        // uma sessão anterior seja reutilizada por outro usuário.
        req.session.regenerate((erroSessao) => {
            if (erroSessao) {
                console.error('Erro ao renovar sessão no login:', erroSessao);
                return res.status(500).json({ success: false, message: 'Não foi possível iniciar uma nova sessão.' });
            }

            req.session.userId = usuario.id;

            req.session.save((erroSalvar) => {
                if (erroSalvar) {
                    console.error('Erro ao salvar sessão no login:', erroSalvar);
                    return res.status(500).json({ success: false, message: 'Não foi possível salvar a sessão.' });
                }

                const verificado = usuario.verificado == 1 || usuario.verificado === true;

                return res.json({
                    success: true,
                    verificado,
                    statusPagamento: usuario.status_pagamento,
                    trialExpira: usuario.trial_expira,
                    userId: usuario.id,
                    message: verificado ? 'Login efetuado com sucesso!' : 'Conta não verificada. Insira o código.'
                });
            });
        });
    });
});
// --- ROTA: VERIFICAR STATUS DO USUÁRIO --- (duplicada removida — já definida acima)
// --- ROTA DE VERIFICAÇÃO ---
app.post('/verificar-conta', (req, res) => {
    const { userId, codigoDigitado } = req.body;
    const sql = "SELECT * FROM usuarios WHERE id = ? AND token_verificacao = ?";
    db.query(sql, [userId, codigoDigitado], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido!' });
        }
        db.query("UPDATE usuarios SET verificado = 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Erro ao ativar conta.' });
            res.json({ success: true, message: 'Conta ativada com sucesso!' });
        });
    });
});
// --- ROTA PARA VALIDAR O CÓDIGO (AGORA SALVA A VERIFICAÇÃO DEFINITIVA) ---
app.post('/validar-codigo', (req, res) => {
    const { userId, codigo } = req.body;
    db.query("SELECT token_verificacao FROM usuarios WHERE id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Erro no servidor.' });

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }
        const codigoNoBanco = results[0].token_verificacao;
        if (codigo === codigoNoBanco) {
            db.query("UPDATE usuarios SET token_verificacao = NULL, verificado = 1 WHERE id = ?", [userId], (updateErr) => {
                if (updateErr) {
                    console.error('Erro ao atualizar status:', updateErr);
                    return res.status(500).json({ success: false, message: 'Não foi possível validar a conta.' });
                }

                // A validação também autentica o usuário; nunca reutilize uma
                // sessão iniciada antes da confirmação do código.
                req.session.regenerate((erroSessao) => {
                    if (erroSessao) {
                        console.error('Erro ao renovar sessão na validação:', erroSessao);
                        return res.status(500).json({ success: false, message: 'Não foi possível iniciar uma nova sessão.' });
                    }

                    req.session.userId = userId;
                    req.session.save((erroSalvar) => {
                        if (erroSalvar) {
                            console.error('Erro ao salvar sessão na validação:', erroSalvar);
                            return res.status(500).json({ success: false, message: 'Não foi possível salvar a sessão.' });
                        }

                        return res.json({ success: true, message: 'Conta validada com sucesso!' });
                    });
                });
            });
        } else {
            res.status(400).json({ success: false, message: 'Código de verificação incorreto.' });
        }
    });
});
// --- ROTA: SOLICITAR RECUPERAÇÃO DE SENHA ---
app.post('/esqueci-senha', async (req, res) => {
    const { email } = req.body;
    try {
        const [rows] = await db.promise().query("SELECT id, nome FROM usuarios WHERE email = ?", [email]);

        // Resposta genérica mesmo se o e-mail não existir (evita expor quais e-mails estão cadastrados)
        if (rows.length === 0) {
            return res.json({ success: true, message: 'Se o e-mail existir, enviaremos um código.' });
        }

        const usuario = rows[0];
        const codigo = Math.floor(100000 + Math.random() * 900000).toString();
        const expira = new Date(Date.now() + 15 * 60 * 1000); // 15 minutos

        await db.promise().query(
            "UPDATE usuarios SET token_verificacao = ?, token_expira_em = ? WHERE id = ?",
            [codigo, expira, usuario.id]
        );

        const { error } = await resend.emails.send({
            from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
            to: email.toLowerCase().trim(),
            subject: 'GBM - Recuperação de Senha',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                    <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                    <p>Olá, ${usuario.nome}. Use o código abaixo para redefinir sua senha:</p>
                    <h1 style="letter-spacing: 5px; color: #10b981; background: #111c2e; padding: 15px; border-radius: 8px; display: inline-block;">
                        ${codigo}
                    </h1>
                    <p style="color: #8a9ba8; font-size: 12px;">Expira em 15 minutos. Se não foi você, ignore este e-mail.</p>
                </div>
            `
        });

        if (error) {
            console.error("Erro da API Resend:", error);
            return res.status(500).json({ success: false, message: 'Falha ao enviar e-mail.' });
        }

        res.json({ success: true, message: 'Se o e-mail existir, enviaremos um código.' });
    } catch (erro) {
        console.error("Erro ao solicitar recuperação:", erro);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});

// --- ROTA: REDEFINIR SENHA COM O CÓDIGO ---
app.post('/redefinir-senha', async (req, res) => {
    const { email, codigo, novaSenha } = req.body;
    try {
        const [rows] = await db.promise().query(
            "SELECT id, token_verificacao, token_expira_em FROM usuarios WHERE email = ?",
            [email]
        );

        if (rows.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
        }

        const usuario = rows[0];
        const expirado = !usuario.token_expira_em || new Date(usuario.token_expira_em) < new Date();

        if (usuario.token_verificacao !== codigo || expirado) {
            return res.status(400).json({ success: false, message: 'Código inválido ou expirado.' });
        }

        const salt = await bcrypt.genSalt(10);
        const novaSenhaHash = await bcrypt.hash(novaSenha, salt);

        await db.promise().query(
            "UPDATE usuarios SET senha_hash = ?, token_verificacao = NULL, token_expira_em = NULL WHERE id = ?",
            [novaSenhaHash, usuario.id]
        );

        res.json({ success: true, message: 'Senha redefinida com sucesso!' });
    } catch (erro) {
        console.error("Erro ao redefinir senha:", erro);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});
// --- ROTA PARA DESFAZER O ÚLTIMO LANÇAMENTO (VERSÃO CORRIGIDA) ---
app.delete('/desfazer-ultimo', exigirLogin, (req, res) => {
    const userId = req.session.userId;
    // Apaga apenas a transação de maior ID PERTENCENTE AO USUÁRIO (a última que ele inseriu)
    const sql = `
        DELETE t FROM transacoes t
        JOIN contas_bancarias cb ON t.conta_id = cb.id
        WHERE cb.usuario_id = ?
        ORDER BY t.id DESC LIMIT 1
    `;

    // Usando o formato de callback clássico em vez de 'await'
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error('Erro ao desfazer transação:', err);
            return res.status(500).json({ error: 'Erro ao excluir no banco de dados.' });
        }
        res.status(200).json({ message: 'Último lançamento desfeito com sucesso!' });
    });
});
// Buscar transações individuais do mês para o modal
app.get('/transacoes-individuais', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const mes = req.query.mes || new Date().getMonth() + 1;
        const ano = req.query.ano || new Date().getFullYear();
        const [transacoes] = await db.promise().query(`
            SELECT t.id, t.descricao, t.valor, t.tipo, t.categoria, t.data_transacao, t.banco
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?
            ORDER BY t.data_transacao DESC
        `, [userId, mes, ano]);
        res.json(transacoes);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar transações.' });
    }
});

// Corrigir categoria e salvar como regra permanente
app.post('/corrigir-categoria', exigirLogin, async (req, res) => {
    try {
        const { transacaoId, descricao, novaCategoria } = req.body;
        const userId = req.session.userId;

        // 1. Atualiza a transação (garantindo que ela pertence ao próprio usuário)
        await db.promise().query(
            `UPDATE transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             SET t.categoria = ?
             WHERE t.id = ? AND cb.usuario_id = ?`,
            [novaCategoria, transacaoId, userId]
        );

        // 2. Extrai a palavra-chave e salva a regra vinculada a este usuário
        const palavraChave = extrairPalavraChave(descricao);
        if (palavraChave) {
            await db.promise().query(`
                INSERT INTO regras_categoria (usuario_id, descricao_contem, categoria)
                VALUES (?, ?, ?)
                ON DUPLICATE KEY UPDATE categoria = VALUES(categoria)
            `, [userId, palavraChave, novaCategoria]);
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false });
    }
});
// --- CATEGORIAS PERSONALIZADAS (por conta/usuário) ---
const CATEGORIAS_PADRAO = [
    'Alimentação', 'Habitação', 'Transporte', 'Eletricidade / Luz',
    'Telecomunicações / Internet', 'Pagamento de Fatura', 'Pagamento de Boleto',
    'Streaming de Vídeo', 'Streaming de Música', 'Academia e Fitness',
    'Saúde', 'Educação', 'Supermercado', 'Restaurantes', 'Salário',
    'Lazer', 'Transferência', 'Crédito Cartão', 'Taxas Bancárias',
    'Igreja / Doações', 'Outros'
];

// Lista as categorias padrão + as personalizadas criadas por este usuário
// Expõe o mapa de bancos (nome + cor) para o frontend usar nas etiquetas
app.get('/bancos-info', (req, res) => {
    const mapa = {};
    Object.values(BANCOS_INFO).forEach(b => { mapa[b.nome] = b.cor; });
    res.json(mapa);
});

// Lista os bancos distintos que o usuário já usou em suas transações
// (usado para popular o filtro de banco no relatório)
app.get('/bancos-usados', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;

        const [rows] = await db.promise().query(
            `SELECT DISTINCT t.banco
             FROM transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             WHERE cb.usuario_id = ? AND t.banco IS NOT NULL AND t.banco <> ''
             ORDER BY t.banco ASC`,
            [userId]
        );

        res.json(rows.map(r => r.banco));
    } catch (error) {
        console.error('❌ Erro ao buscar bancos usados:', error);
        res.status(500).json({ error: 'Falha ao buscar bancos usados.' });
    }
});

app.get('/categorias', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;

        const [rows] = await db.promise().query(
            'SELECT id, nome FROM categorias_personalizadas WHERE usuario_id = ? ORDER BY nome ASC',
            [userId]
        );

        res.json({
            padrao: CATEGORIAS_PADRAO,
            personalizadas: rows, // [{id, nome}]
            todas: [...CATEGORIAS_PADRAO, ...rows.map(r => r.nome)]
        });
    } catch (error) {
        console.error('❌ Erro ao buscar categorias:', error);
        res.status(500).json({ error: 'Falha ao buscar categorias.' });
    }
});

// Cria uma nova categoria, vinculada apenas ao usuário que a criou
app.post('/categorias', exigirLogin, async (req, res) => {
    try {
        const { nome } = req.body;
        const userId = req.session.userId;
        if (!nome || !nome.trim()) {
            return res.status(400).json({ success: false, error: 'Informe o nome da categoria.' });
        }
        const nomeLimpo = nome.trim().slice(0, 100);

        const jaEhPadrao = CATEGORIAS_PADRAO.some(c => c.toLowerCase() === nomeLimpo.toLowerCase());
        if (jaEhPadrao) {
            return res.status(409).json({ success: false, error: 'Essa categoria já existe entre as categorias padrão.' });
        }

        await db.promise().query(
            'INSERT INTO categorias_personalizadas (usuario_id, nome) VALUES (?, ?)',
            [userId, nomeLimpo]
        );
        console.log(`🏷️ Nova categoria personalizada: "${nomeLimpo}" (usuário ${userId})`);
        res.json({ success: true, message: 'Categoria criada com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ success: false, error: 'Você já tem uma categoria com esse nome.' });
        }
        console.error('❌ Erro ao criar categoria:', error);
        res.status(500).json({ success: false, error: 'Falha ao criar categoria.' });
    }
});

// Remove uma categoria personalizada (apenas o dono pode remover a sua)
app.delete('/categorias/:id', exigirLogin, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.session.userId;
        const [result] = await db.promise().query(
            'DELETE FROM categorias_personalizadas WHERE id = ? AND usuario_id = ?',
            [id, userId]
        );
        if (result.affectedRows === 0) {
            return res.status(404).json({ success: false, error: 'Categoria não encontrada para este usuário.' });
        }
        res.json({ success: true, message: 'Categoria removida com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao remover categoria:', error);
        res.status(500).json({ success: false, error: 'Falha ao remover categoria.' });
    }
});
// --- ROTA: BUSCAR DADOS DA ASSINATURA ---
function assinaturaEstaCanceladaNoMP(status) {
    const statusNormalizado = String(status || '').toLowerCase();
    return statusNormalizado === 'canceled' || statusNormalizado === 'cancelled';
}

// O preapproval_id é a prova de que uma assinatura foi criada no Mercado Pago.
// Sem esse ID, o status existente é apenas local e nenhuma chamada ao MP deve
// ser feita: não existe assinatura remota para consultar ou cancelar.
async function localizarAssinaturaNoMP(userId, email, preapprovalId) {
    if (!preapprovalId) {
        return { preApproval: null, preapprovalId: null, assinatura: null };
    }

    const preApproval = new PreApproval(mpClient);
    const assinatura = await preApproval.get({ preApprovalId: String(preapprovalId) });
    return { preApproval, preapprovalId: String(preapprovalId), assinatura };
}

app.get('/minha-assinatura', exigirLogin, async (req, res) => {
    const userId = req.session.userId;

    try {
        const [rows] = await db.promise().query(
            'SELECT nome, email, status_pagamento, trial_expira FROM usuarios WHERE id = ?', 
            [userId]
        );
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado.' });
        
        res.json(rows[0]);
    } catch (error) {
        console.error('❌ Erro ao buscar assinatura:', error);
        res.status(500).json({ error: 'Falha ao buscar dados da assinatura.' });
    }
});

// --- ROTA: CANCELAR ASSINATURA ---
app.post('/cancelar-assinatura', exigirLogin, async (req, res) => {
    const userId = req.session.userId;
    try {
        const [usuarios] = await db.promise().query(
            `SELECT email, mercadopago_preapproval_id
             FROM usuarios
             WHERE id = ?`,
            [userId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const encontrada = await localizarAssinaturaNoMP(
            userId,
            usuarios[0].email,
            usuarios[0].mercadopago_preapproval_id
        );

        // Se não existe assinatura no Mercado Pago, o status "pago" foi apenas
        // alterado localmente (por exemplo, em um teste no Adminer). Nesse caso
        // não existe cobrança recorrente para cancelar: basta corrigir o estado local.
        if (!encontrada.assinatura || !encontrada.preapprovalId) {
            await db.promise().query(
                `UPDATE usuarios
                 SET mercadopago_preapproval_id = NULL,
                     status_pagamento = 'cancelado',
                     assinatura_cancelada_no_mp = 1
                 WHERE id = ?`,
                [userId]
            );

            return res.json({
                success: true,
                message: 'Plano local cancelado. Esta conta não possuía uma assinatura recorrente no Mercado Pago.'
            });
        }

        let assinaturaConfirmada = encontrada.assinatura;
        if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada.status)) {
            assinaturaConfirmada = await encontrada.preApproval.update({
                id: encontrada.preapprovalId,
                body: { status: 'canceled' }
            });
        }

        // Confere uma segunda vez no Mercado Pago. O banco local só recebe
        // "cancelado" depois que o provedor confirmar o status real.
        if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada?.status)) {
            assinaturaConfirmada = await encontrada.preApproval.get({
                preApprovalId: encontrada.preapprovalId
            });
        }

        if (!assinaturaEstaCanceladaNoMP(assinaturaConfirmada?.status)) {
            return res.status(502).json({
                success: false,
                message: 'O Mercado Pago ainda não confirmou o cancelamento. Nenhum status local foi alterado.'
            });
        }

        await db.promise().query(
            `UPDATE usuarios
             SET mercadopago_preapproval_id = ?,
                 status_pagamento = 'cancelado',
                 assinatura_cancelada_no_mp = 1
             WHERE id = ?`,
            [encontrada.preapprovalId, userId]
        );
        
        res.json({ success: true, message: 'Sua assinatura foi cancelada no Mercado Pago com sucesso.' });
    } catch (error) {
        console.error('❌ Erro ao cancelar assinatura:', error);
        res.status(502).json({ success: false, message: 'O Mercado Pago não confirmou o cancelamento. Tente novamente mais tarde.' });
    }
});
// --- ROTA: RECEBER FEEDBACK DA PÁGINA "FALE CONOSCO" ---
app.post('/api/enviar-feedback', async (req, res) => {
    try {
        const { assunto, mensagem } = req.body;
        const userId = req.session.userId;
        if (!mensagem || !assunto) {
            return res.status(400).json({ success: false, error: 'Assunto e mensagem são obrigatórios.' });
        }

        let userEmail = null;
        let userNome = null;
        if (userId) {
            const [rows] = await db.promise().query('SELECT nome, email FROM usuarios WHERE id = ?', [userId]);
            if (rows.length > 0) {
                userEmail = rows[0].email;
                userNome = rows[0].nome;
            }
        }

        const emailSuporte = process.env.EMAIL_SUPORTE || 'suporte@gbm-finance.com';

        const { data, error: resendError } = await resend.emails.send({
    from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
    to: emailSuporte,
    reply_to: userEmail || undefined,
    subject: `📩 [Fale Conosco] ${assunto} — Usuário ${userId || 'desconhecido'}`,
    html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Nova mensagem via Fale Conosco</h2>
            <p><strong>Usuário:</strong> ${userNome || 'não identificado'} (ID: ${userId || 'desconhecido'})</p>
            <p><strong>E-mail:</strong> ${userEmail || 'não informado'}</p>
            <p><strong>Assunto:</strong> ${assunto}</p>
            <p><strong>Mensagem:</strong></p>
            <p>${(mensagem || '').replace(/\n/g, '<br>')}</p>
        </div>
    `
});

if (resendError) {
    console.error('❌ Erro do Resend ao enviar feedback:', resendError);
    return res.status(502).json({
        success: false,
        error: 'O provedor de e-mail não conseguiu enviar sua mensagem.'
    });
}

console.log('✅ Feedback enviado pelo Resend. ID:', data?.id);
res.json({ success: true, message: 'Mensagem enviada com sucesso!' });
    } catch (error) {
        console.error('❌ Erro ao enviar feedback:', error);
        res.status(500).json({ success: false, error: 'Falha ao enviar mensagem.' });
    }
});
app.get('/perfil', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;

        const [usuarios] = await db.promise().query(
            `SELECT id, nome, sobrenome, nome_exibicao,
                    foto_perfil_url, capa_perfil_url
             FROM usuarios
             WHERE id = ?`,
            [userId]
        );

        if (usuarios.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Usuária não encontrada.'
            });
        }

        res.json({
            success: true,
            perfil: usuarios[0]
        });
    } catch (erro) {
        console.error('Erro ao buscar perfil:', erro);
        res.status(500).json({
            success: false,
            message: 'Não foi possível carregar o perfil.'
        });
    }
});

app.put('/perfil', exigirLogin, async (req, res) => {
    try {
        const userId = req.session.userId;
        const { nome_exibicao } = req.body;

        const nomeLimpo = String(nome_exibicao || '').trim();

        if (!nomeLimpo || nomeLimpo.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'Informe um nome de até 100 caracteres.'
            });
        }

        await db.promise().query(
            'UPDATE usuarios SET nome_exibicao = ? WHERE id = ?',
            [nomeLimpo, userId]
        );

        res.json({
            success: true,
            message: 'Perfil atualizado com sucesso.'
        });
    } catch (erro) {
        console.error('Erro ao atualizar perfil:', erro);
        res.status(500).json({
            success: false,
            message: 'Não foi possível atualizar o perfil.'
        });
    }
});

app.post('/perfil/foto', exigirLogin, uploadImagem.single('foto'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Selecione uma foto.'
            });
        }

        const userId = req.session.userId;

        const imagem = await enviarImagemParaCloudinary(req.file.buffer, {
            folder: `gbm/perfis/${userId}`,
            public_id: 'foto-perfil',
            overwrite: true,
            resource_type: 'image'
        });

        await db.promise().query(
            'UPDATE usuarios SET foto_perfil_url = ? WHERE id = ?',
            [imagem.secure_url, userId]
        );

        res.json({
            success: true,
            url: imagem.secure_url,
            message: 'Foto atualizada com sucesso.'
        });
    } catch (erro) {
        console.error('Erro ao enviar foto:', erro);
        res.status(500).json({
            success: false,
            message: 'Não foi possível enviar a foto.'
        });
    }
});

app.post('/perfil/capa', exigirLogin, uploadImagem.single('capa'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Selecione uma imagem de capa.'
            });
        }

        const userId = req.session.userId;

        const imagem = await enviarImagemParaCloudinary(req.file.buffer, {
            folder: `gbm/perfis/${userId}`,
            public_id: 'capa-perfil',
            overwrite: true,
            resource_type: 'image'
        });

        await db.promise().query(
            'UPDATE usuarios SET capa_perfil_url = ? WHERE id = ?',
            [imagem.secure_url, userId]
        );

        res.json({
            success: true,
            url: imagem.secure_url,
            message: 'Capa atualizada com sucesso.'
        });
    } catch (erro) {
        console.error('Erro ao enviar capa:', erro);
        res.status(500).json({
            success: false,
            message: 'Não foi possível enviar a capa.'
        });
    }
});

// --- ROTA: EXCLUIR A PRÓPRIA CONTA ---
// A confirmação por texto e pela senha atual impedem exclusões acidentais.
// Nunca exponha uma rota administrativa que aceite um userId vindo do navegador.
app.delete('/minha-conta', exigirLogin, async (req, res) => {
    const userId = req.session.userId;
    const { senha, confirmacao } = req.body || {};
    const confirmacaoEsperada = 'EXCLUIR MINHA CONTA';
    const banco = db.promise();
    let transacaoAberta = false;

    if (typeof senha !== 'string' || !senha) {
        return res.status(400).json({ success: false, message: 'Informe a senha atual para excluir a conta.' });
    }

    if (confirmacao !== confirmacaoEsperada) {
        return res.status(400).json({
            success: false,
            message: `Digite exatamente “${confirmacaoEsperada}” para confirmar a exclusão.`
        });
    }

    // Identificadores SQL não podem ser passados como parâmetros. Esta validação
    // permite usar somente os nomes retornados pelo próprio banco de dados.
    const identificar = (nome) => {
        if (!/^[A-Za-z0-9_]+$/.test(nome)) {
            throw new Error('Nome de tabela inesperado ao excluir a conta.');
        }
        return `\`${nome}\``;
    };

    try {
        await banco.beginTransaction();
        transacaoAberta = true;

        const [usuarios] = await banco.query(
            `SELECT email, senha_hash, status_pagamento, mercadopago_preapproval_id,
                    assinatura_cancelada_no_mp
             FROM usuarios
             WHERE id = ? FOR UPDATE`,
            [userId]
        );

        if (usuarios.length === 0) {
            await banco.rollback();
            transacaoAberta = false;
            return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
        }

        const senhaConfere = await bcrypt.compare(senha, usuarios[0].senha_hash);
        if (!senhaConfere) {
            await banco.rollback();
            transacaoAberta = false;
            return res.status(401).json({ success: false, message: 'A senha informada está incorreta.' });
        }

        // Consulta o Mercado Pago novamente antes de apagar. Isso recupera
        // assinaturas antigas (criadas antes de salvarmos o preapproval_id) e
        // não confunde o acesso restante do período grátis com uma nova cobrança.
        let cancelamentoConfirmadoNoMP = usuarios[0].assinatura_cancelada_no_mp === 1 || usuarios[0].assinatura_cancelada_no_mp === true;
        try {
            const encontrada = await localizarAssinaturaNoMP(
                userId,
                usuarios[0].email,
                usuarios[0].mercadopago_preapproval_id
            );

            if (encontrada.assinatura && assinaturaEstaCanceladaNoMP(encontrada.assinatura.status)) {
                await banco.query(
                    `UPDATE usuarios
                     SET mercadopago_preapproval_id = ?,
                         status_pagamento = 'cancelado',
                         assinatura_cancelada_no_mp = 1
                     WHERE id = ?`,
                    [encontrada.preapprovalId, userId]
                );
                cancelamentoConfirmadoNoMP = true;
                usuarios[0].mercadopago_preapproval_id = encontrada.preapprovalId;
                usuarios[0].status_pagamento = 'cancelado';
            } else if (encontrada.assinatura) {
                // Guardamos o ID encontrado para que uma futura tentativa de
                // cancelamento fale com a assinatura correta do Mercado Pago.
                await banco.query(
                    'UPDATE usuarios SET mercadopago_preapproval_id = ? WHERE id = ?',
                    [encontrada.preapprovalId, userId]
                );
                usuarios[0].mercadopago_preapproval_id = encontrada.preapprovalId;
            } else {
                // Não existe preapproval no Mercado Pago. Portanto, um eventual
                // status "pago" foi colocado apenas no banco local e não pode
                // produzir cobranças recorrentes.
                await banco.query(
                    `UPDATE usuarios
                     SET mercadopago_preapproval_id = NULL,
                         status_pagamento = 'cancelado',
                         assinatura_cancelada_no_mp = 1
                     WHERE id = ?`,
                    [userId]
                );
                cancelamentoConfirmadoNoMP = true;
                usuarios[0].mercadopago_preapproval_id = null;
                usuarios[0].status_pagamento = 'cancelado';
            }
        } catch (erroMercadoPago) {
            console.error('Não foi possível conferir a assinatura no Mercado Pago antes de excluir:', erroMercadoPago);
            await banco.rollback();
            transacaoAberta = false;
            return res.status(502).json({
                success: false,
                message: 'Não foi possível confirmar o status da assinatura no Mercado Pago. Tente novamente em alguns minutos.'
            });
        }

        // Uma assinatura ativa nunca pode ser desvinculada apenas no banco local.
        // Também bloqueamos um "cancelado" antigo sem confirmação do MP, pois a
        // versão anterior do projeto só alterava o status local e podia manter a
        // cobrança recorrente ativa.
        const assinaturaNaoConfirmada =
            (usuarios[0].mercadopago_preapproval_id && !cancelamentoConfirmadoNoMP) ||
            usuarios[0].status_pagamento === 'pago' ||
            (usuarios[0].status_pagamento === 'cancelado' && !cancelamentoConfirmadoNoMP);

        if (assinaturaNaoConfirmada) {
            await banco.rollback();
            transacaoAberta = false;
            return res.status(409).json({
                success: false,
                message: 'Cancele a assinatura no Mercado Pago e aguarde a confirmação antes de excluir a conta.'
            });
        }

        // Apaga tabelas que dependem das contas bancárias. A consulta ao
        // INFORMATION_SCHEMA também cobre futuras tabelas com chave estrangeira
        // direta para contas_bancarias, sem desativar FOREIGN_KEY_CHECKS.
        const [dependentesDasContas] = await banco.query(`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
              AND REFERENCED_TABLE_NAME = 'contas_bancarias'
        `);

        for (const relacao of dependentesDasContas) {
            const tabelaFilha = identificar(relacao.TABLE_NAME);
            const colunaFilha = identificar(relacao.COLUMN_NAME);
            await banco.query(
                `DELETE filha
                 FROM ${tabelaFilha} AS filha
                 INNER JOIN contas_bancarias AS conta ON filha.${colunaFilha} = conta.id
                 WHERE conta.usuario_id = ?`,
                [userId]
            );
        }

        // Garante a exclusão das transações mesmo se a base antiga não possuir
        // a chave estrangeira transacoes.conta_id configurada.
        await banco.query(`
            DELETE transacao
            FROM transacoes AS transacao
            INNER JOIN contas_bancarias AS conta ON transacao.conta_id = conta.id
            WHERE conta.usuario_id = ?
        `, [userId]);

        // Tabelas conhecidas que usam usuario_id, inclusive em bancos mais antigos
        // onde a chave estrangeira ainda não foi criada.
        const tabelasDoUsuario = [
            'saldos_por_banco',
            'regras_categoria',
            'metas_alertas_disparos',
            'metas_alertas_percentuais',
            'metas',
            'categorias_personalizadas',
            'alertas'
        ];

        // Nem todas as versões do banco possuem todas as tabelas acima.
        // Confere o esquema real antes de apagar para que uma tabela opcional
        // ausente não interrompa (e reverta) toda a exclusão da conta.
        const [tabelasDisponiveis] = await banco.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND COLUMN_NAME = 'usuario_id'
              AND TABLE_NAME IN (
                  'saldos_por_banco',
                  'regras_categoria',
                  'metas_alertas_disparos',
                  'metas_alertas_percentuais',
                  'metas',
                  'categorias_personalizadas',
                  'alertas'
              )
        `);
        const nomesTabelasDisponiveis = new Set(
            tabelasDisponiveis.map((linha) => linha.TABLE_NAME)
        );

        for (const tabela of tabelasDoUsuario) {
            if (!nomesTabelasDisponiveis.has(tabela)) {
                console.log(`ℹ️ Tabela opcional "${tabela}" ausente; exclusão continuará.`);
                continue;
            }

            await banco.query(`DELETE FROM ${identificar(tabela)} WHERE usuario_id = ?`, [userId]);
        }

        // O Adminer mostrou mais de uma relação em alertas. Esta parte remove
        // qualquer outra tabela ligada diretamente a usuarios, antes da linha pai.
        const [dependentesDoUsuario] = await banco.query(`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
              AND REFERENCED_TABLE_NAME = 'usuarios'
              AND TABLE_NAME <> 'contas_bancarias'
        `);

        for (const relacao of dependentesDoUsuario) {
            const tabelaFilha = identificar(relacao.TABLE_NAME);
            const colunaFilha = identificar(relacao.COLUMN_NAME);
            await banco.query(`DELETE FROM ${tabelaFilha} WHERE ${colunaFilha} = ?`, [userId]);
        }

        await banco.query('DELETE FROM contas_bancarias WHERE usuario_id = ?', [userId]);
        const [resultado] = await banco.query('DELETE FROM usuarios WHERE id = ?', [userId]);

        if (resultado.affectedRows !== 1) {
            throw new Error('A conta não pôde ser removida.');
        }

        await banco.commit();
        transacaoAberta = false;

        // Os dois arquivos são removidos após o banco confirmar a exclusão. Falhas
        // no provedor de imagens não desfazem uma conta já apagada; ficam registradas.
        const resultadosCloudinary = await Promise.allSettled([
            cloudinary.uploader.destroy(`gbm/perfis/${userId}/foto-perfil`, { resource_type: 'image', invalidate: true }),
            cloudinary.uploader.destroy(`gbm/perfis/${userId}/capa-perfil`, { resource_type: 'image', invalidate: true })
        ]);
        resultadosCloudinary
            .filter((resultadoCloudinary) => resultadoCloudinary.status === 'rejected')
            .forEach((resultadoCloudinary) => console.warn('Não foi possível apagar uma imagem de perfil:', resultadoCloudinary.reason));

        return req.session.destroy((erroSessao) => {
            if (erroSessao) {
                console.error('Conta apagada, mas não foi possível encerrar a sessão atual:', erroSessao);
            }

            const opcoesCookie = {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax'
            };
            res.clearCookie('gbm_sid', opcoesCookie);
            res.clearCookie('connect.sid', opcoesCookie);
            return res.json({ success: true, message: 'Sua conta e seus dados foram excluídos com sucesso.' });
        });
    } catch (erro) {
        if (transacaoAberta) {
            try {
                await banco.rollback();
            } catch (erroRollback) {
                console.error('Erro ao desfazer a exclusão da conta:', erroRollback);
            }
        }

        console.error('Erro ao excluir conta:', erro);
        const bloqueioPorRelacao = erro.code === 'ER_ROW_IS_REFERENCED' || erro.code === 'ER_ROW_IS_REFERENCED_2';
        return res.status(bloqueioPorRelacao ? 409 : 500).json({
            success: false,
            message: bloqueioPorRelacao
                ? 'Há um dado relacionado que ainda impede a exclusão. Nenhum dado foi apagado; contate o suporte para concluir com segurança.'
                : 'Não foi possível excluir a conta. Tente novamente mais tarde.'
        });
    }
});
// 4. Liga o servidor
const PORT = process.env.PORT || 3000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando perfeitamente na porta ${PORT}`);
});
// Roda a auditoria de metas todos os dias às 08:00 (mesmo sem novo lançamento)
cron.schedule('0 8 * * *', () => {
    console.log('⏰ Rodando auditoria diária de metas...');
    auditarMetas();
});