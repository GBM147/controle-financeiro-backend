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
const upload = multer({ storage: multer.memoryStorage() }); // Guarda o ficheiro temporariamente na memória do servidor
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
app.post('/criar-sessao-pagamento', express.json(), async (req, res) => {
    const { userId } = req.body;

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
                    transaction_amount: 19.90,
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
                
                await db.promise().query("UPDATE usuarios SET status_pagamento = 'pago' WHERE id = ?", [userId]);
            }
        } catch (err) {
            console.error("Erro ao checar status do pagamento no MP:", err);
        }
    }
});
// 2. Middlewares (Configurações essenciais centralizadas)
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
// Isso faz o servidor ler e entregar automaticamente os seus ficheiros HTML/CSS da pasta public
app.use(express.static('public')); 
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
db.connect((err) => {
    if (err) {
        console.error('❌ Erro a ligar ao MySQL:', err.message);
        return;
    }
    console.log('📦 Ligado à base de dados MySQL com sucesso!');
});
// --- NOVA ROTA: IMPORTAÇÃO E PARSER DE EXTRATO BANCÁRIO OFX ---
app.post('/importar-ofx', upload.single('file'), async (req, res) => {
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
        const userId = req.body.userId || 1; // fallback temporário
        const [contas] = await db.promise().query('SELECT id FROM contas_bancarias WHERE usuario_id = ? LIMIT 1', [userId]);
        const contaInternaId = contas.length > 0 ? contas[0].id : 1;
        // Carrega as regras salvas pelo usuário para usar na categorização
const [regrasUsuario] = await db.promise().query(
    'SELECT descricao_contem, categoria FROM regras_categoria WHERE usuario_id = 1'
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
// 1º: Verifica as regras aprendidas do usuário
let categoria = null;
for (const regra of regrasUsuario) {
    if (descricao.toLowerCase().includes(regra.descricao_contem.toLowerCase())) {
        categoria = regra.categoria;
        break;
    }
}

// 2º: Se não achou regra, aplica as keywords padrão
if (!categoria) {
    const descMinuscula = descricao.toLowerCase();
    if (descMinuscula.includes('credito de salario')) {
        categoria = 'Salário';
    } else if (descMinuscula.includes('unicid') || descMinuscula.includes('mensalidade')) {
        categoria = 'Educação';
    } else if (descMinuscula.includes('pagamento cartao') || descMinuscula.includes('fatura')) {
        categoria = 'Pagamento de Fatura';
    } else if (descMinuscula.includes('pagamento de boleto')) {
        categoria = 'Pagamento de Boleto';
    } else if (descMinuscula.includes('cafe') || descMinuscula.includes('coffee') ||
               descMinuscula.includes('servano') || descMinuscula.includes('prc ali') ||
               descMinuscula.includes('ifood') || descMinuscula.includes('restaurante') ||
               descMinuscula.includes('lanche') || descMinuscula.includes('padaria')) {
        categoria = 'Alimentação';
    } else if (descMinuscula.includes('uber') || descMinuscula.includes('99app') ||
               descMinuscula.includes('combustivel') || descMinuscula.includes('posto')) {
        categoria = 'Transporte';
    } else if (descMinuscula.includes('up mobile') || descMinuscula.includes('vivo') ||
               descMinuscula.includes('tim ') || descMinuscula.includes('claro')) {
        categoria = 'Telecomunicações / Internet';
    } else if (descMinuscula.includes('igreja') || descMinuscula.includes('evangelica')) {
        categoria = 'Igreja / Doações';
    } else if (descMinuscula.includes('bytedance') || descMinuscula.includes('netflix') ||
               descMinuscula.includes('spotify') || descMinuscula.includes('prime')) {
        categoria = 'Entretenimento';
    } else if (descMinuscula.includes('mercado') || descMinuscula.includes('carrefour') ||
               descMinuscula.includes('atacadao') || descMinuscula.includes('assai')) {
        categoria = 'Supermercado';
    } else if (descMinuscula.includes('juros') || descMinuscula.includes('multa') ||
               descMinuscula.includes('iof') || descMinuscula.includes('tarifa')) {
        categoria = 'Taxas Bancárias';
    } else if (descMinuscula.includes('credito liberado')) {
        categoria = 'Crédito Cartão';
    } else if (descMinuscula.includes('pix recebido') || descMinuscula.includes('pix enviado')) {
        categoria = 'Transferência';
    } else {
        categoria = 'Outros';
    }
}
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
app.get('/resumo-financeiro', async (req, res) => {
    try {
        const { mes, ano, userId } = req.query;
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

        // --- Saldos separados por banco ---
        const [saldosBancos] = await db.promise().query(
            'SELECT banco, saldo FROM saldos_por_banco WHERE usuario_id = ? ORDER BY saldo DESC',
            [userId]
        );

        let saldoDaConta;
        if (saldosBancos.length > 0) {
            saldoDaConta = saldosBancos.reduce((soma, b) => soma + parseFloat(b.saldo), 0);
        } else {
            const [contaDB] = await db.promise().query('SELECT saldo FROM contas_bancarias WHERE usuario_id = ? LIMIT 1', [userId]);
            saldoDaConta = contaDB.length > 0 ? contaDB[0].saldo : 0;
        }

        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error("❌ Erro na lógica de resumo com balanço:", error);
        res.status(500).json({ status: 'error', message: 'Falha ao processar resumo financeiro' });
    }
});

// --- NOVA ROTA: ECONOMIA DO MÊS COMPARADA AO MÊS ANTERIOR ---
app.get('/economia-mensal', async (req, res) => {
    try {
        const { userId, mes, ano } = req.query;
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
app.get('/comparativo-mensal', async (req, res) => {
    try {
        const { userId, ano } = req.query;
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
app.get('/anos-disponiveis', async (req, res) => {
    try {
        const { userId } = req.query;
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
app.post('/metas', async (req, res) => {
    try {
        const { categoria, valor_limite, userId } = req.body;
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
app.delete('/metas', async (req, res) => {
    try {
        const { categoria, userId } = req.body;
        await db.promise().query('DELETE FROM metas WHERE categoria = ? AND usuario_id = ?', [categoria, userId]);
        console.log(`🗑️ Limite removido. A categoria [${categoria}] agora é um gasto fixo.`);
        res.json({ success: true, message: 'Limite removido com sucesso!' });
    } catch (error) {
        console.error("❌ Erro ao remover meta:", error);
        res.status(500).json({ error: 'Falha ao remover meta' });
    }
});
// --- LANÇAMENTO MANUAL ---
app.post('/transacao-manual', async (req, res) => {
    try {
        const { descricao, valor, tipo, categoria, data_transacao } = req.body;
        const transacaoIdGerado = 'MANUAL_' + Date.now();
        const { userId } = req.body;
        const [contas] = await db.promise().query('SELECT id FROM contas_bancarias WHERE usuario_id = ? LIMIT 1', [userId]);
        const contaInternaId = contas.length > 0 ? contas[0].id : 1; 
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
app.get('/login-status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false });
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
        const [prefs] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        const percentualAlertaGlobal = prefs.length > 0 ? prefs[0].percentual_alerta : 80;

        const sql = `
            SELECT t.categoria, SUM(t.valor) as total_gasto, m.valor_limite, m.percentual_alerta as percentual_categoria
            FROM transacoes t
            JOIN metas m ON t.categoria = m.categoria
            WHERE t.tipo = 'Despesa' AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE()) AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
            GROUP BY t.categoria, m.valor_limite, m.percentual_alerta
        `;
        const [gastos] = await db.promise().query(sql);

        // Pega o e-mail do usuário a notificar (ajuste se tiver multiusuário de verdade)
        const [usuarios] = await db.promise().query('SELECT id, email, nome FROM usuarios LIMIT 1');
        const usuario = usuarios[0];

        for (const item of gastos) {
            const gastoAbs = Math.abs(item.total_gasto);
            const limite = parseFloat(item.valor_limite);
            // Usa o % configurado NA META (por categoria). Se não tiver, cai no global.
            const percentualAlerta = item.percentual_categoria != null ? item.percentual_categoria : percentualAlertaGlobal;
            const porcentagemAtual = (gastoAbs / limite) * 100;

            if (porcentagemAtual >= percentualAlerta) {
                const msg = `Atenção: Você atingiu ${porcentagemAtual.toFixed(1)}% do seu limite de R$ ${limite.toFixed(2)} na categoria ${item.categoria}.`;

                const [check] = await db.promise().query(
                    'SELECT id FROM alertas WHERE categoria = ? AND MONTH(data_criacao) = MONTH(CURRENT_DATE()) AND YEAR(data_criacao) = YEAR(CURRENT_DATE())',
                    [item.categoria]
                );

                if (check.length === 0) {
                    await db.promise().query('INSERT INTO alertas (categoria, mensagem) VALUES (?, ?)', [item.categoria, msg]);
                    console.log(`🔔 NOVO ALERTA GERADO: ${msg}`);

                    // --- ENVIO DO E-MAIL DE NOTIFICAÇÃO ---
                    if (usuario && usuario.email) {
                        try {
                            await resend.emails.send({
                                from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                                to: usuario.email.toLowerCase().trim(),
                                subject: `🚨 GBM - Limite de ${item.categoria} quase estourando!`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                                        <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                                        <p>Olá, ${usuario.nome}.</p>
                                        <h1 style="color: #ef4444;">${porcentagemAtual.toFixed(1)}%</h1>
                                        <p>Você já gastou <strong>R$ ${gastoAbs.toFixed(2)}</strong> de um limite de <strong>R$ ${limite.toFixed(2)}</strong> na categoria <strong>${item.categoria}</strong>.</p>
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
app.get('/configuracoes-alerta', async (req, res) => {
    const [rows] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
    res.json(rows[0] || { percentual_alerta: 80 });
});
app.post('/configuracoes-alerta', async (req, res) => {
    const { percentual } = req.body;
    await db.promise().query('UPDATE preferencias_notificacao SET percentual_alerta = ? WHERE id = 1', [percentual]);
    res.json({ success: true });
});
app.get('/alertas', async (req, res) => {
    const [rows] = await db.promise().query('SELECT * FROM alertas ORDER BY data_criacao DESC LIMIT 50');
    res.json(rows);
});
app.post('/alertas/marcar-lida', async (req, res) => {
    const { id } = req.body;
    await db.promise().query('UPDATE alertas SET lida = TRUE WHERE id = ?', [id]);
    res.json({ success: true });
});
app.get('/relatorio-mensal', async (req, res) => {
    const { mes, ano } = req.query; 
    const sql = `
        SELECT categoria, tipo, IFNULL(SUM(valor), 0) as total_movimentado
        FROM transacoes
        WHERE MONTH(data_transacao) = ? AND YEAR(data_transacao) = ?
        GROUP BY categoria, tipo
    `;
    const [rows] = await db.promise().query(sql, [mes, ano]);
    res.json(rows);
});
// --- ROTA: RELATÓRIO DETALHADO (transações individuais para editar categoria) ---
app.get('/relatorio-detalhado', async (req, res) => {
    const { mes, ano, userId } = req.query;
    const sql = `
        SELECT t.id, t.descricao, t.valor, t.tipo, t.categoria, t.data_transacao, t.banco
        FROM transacoes t
        JOIN contas_bancarias cb ON t.conta_id = cb.id
        WHERE cb.usuario_id = ? AND MONTH(t.data_transacao) = ? AND YEAR(t.data_transacao) = ?
        ORDER BY t.data_transacao DESC
    `;
    const [rows] = await db.promise().query(sql, [userId, mes, ano]);
    res.json(rows);
});

// --- ROTA: ATUALIZAR CATEGORIA DE UMA TRANSAÇÃO ---
app.put('/atualizar-categoria/:id', async (req, res) => {
    const { id } = req.params;
    const { categoria } = req.body;
    try {
        await db.promise().query(
            'UPDATE transacoes SET categoria = ? WHERE id = ?',
            [categoria, id]
        );
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false });
    }
});
app.get('/metas-resumo', async (req, res) => {
    const { userId } = req.query;
    const sql = `
        SELECT m.categoria, m.valor_limite as limite, 
        IFNULL(SUM(ABS(t.valor)), 0) as gasto
        FROM metas m
        LEFT JOIN transacoes t ON m.categoria = t.categoria 
        AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
        LEFT JOIN contas_bancarias cb ON t.conta_id = cb.id AND cb.usuario_id = ?
        WHERE m.usuario_id = ?
        GROUP BY m.categoria, m.valor_limite
    `;
    const [rows] = await db.promise().query(sql, [userId, userId]);
    res.json(rows);
});
app.post('/atualizar-meta-alerta', async (req, res) => {
    const { categoria, valor_limite, percentual_alerta } = req.body;
    await db.promise().query(
        'UPDATE metas SET valor_limite = ?, percentual_alerta = ? WHERE categoria = ?', 
        [valor_limite, percentual_alerta, categoria]
    );
    res.json({ success: true });
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
        // 🧠 O PULO DO GATO: O sistema agora verifica se a conta já foi ativada
        if (usuario.verificado == 1 || usuario.verificado === true) {
            return res.json({ 
                success: true, 
                verificado: true, 
                statusPagamento: usuario.status_pagamento,
                trialExpira: usuario.trial_expira,
                userId: usuario.id, 
                message: 'Login efetuado com sucesso!' 
            });
        } else {
            // Se é conta nova, manda para a tela de escolher E-mail/WhatsApp
            return res.json({ 
                success: true, 
                verificado: false, 
                userId: usuario.id, 
                message: 'Conta não verificada. Insira o código.' 
            });
        }
    });
});
// --- ROTA: VERIFICAR STATUS DO USUÁRIO ---
app.get('/login-status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ success: false });
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
            // 🔥 O AJUSTE ESTÁ AQUI: Agora ele limpa o código E define verificado = 1
            db.query("UPDATE usuarios SET token_verificacao = NULL, verificado = 1 WHERE id = ?", [userId], (updateErr) => {
                if (updateErr) console.error("Erro ao atualizar status:", updateErr);
                
                res.json({ success: true, message: 'Conta validada com sucesso!' });
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
app.delete('/desfazer-ultimo', (req, res) => {
    // Apaga a transação com o maior ID (a última que foi inserida)
    const sql = 'DELETE FROM transacoes ORDER BY id DESC LIMIT 1';
    
    // Usando o formato de callback clássico em vez de 'await'
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Erro ao desfazer transação:', err);
            return res.status(500).json({ error: 'Erro ao excluir no banco de dados.' });
        }
        res.status(200).json({ message: 'Último lançamento desfeito com sucesso!' });
    });
});
// Buscar transações individuais do mês para o modal
app.get('/transacoes-individuais', async (req, res) => {
    try {
        const mes = req.query.mes || new Date().getMonth() + 1;
        const ano = req.query.ano || new Date().getFullYear();
        const [transacoes] = await db.promise().query(`
            SELECT id, descricao, valor, tipo, categoria, data_transacao, banco
            FROM transacoes
            WHERE MONTH(data_transacao) = ? AND YEAR(data_transacao) = ?
            ORDER BY data_transacao DESC
        `, [mes, ano]);
        res.json(transacoes);
    } catch (err) {
        res.status(500).json({ error: 'Erro ao buscar transações.' });
    }
});

// Corrigir categoria e salvar como regra permanente
app.post('/corrigir-categoria', async (req, res) => {
    try {
        const { transacaoId, descricao, novaCategoria } = req.body;

        // 1. Atualiza a transação
        await db.promise().query(
            'UPDATE transacoes SET categoria = ? WHERE id = ?',
            [novaCategoria, transacaoId]
        );

        // 2. Extrai a palavra-chave e salva a regra
        const palavraChave = extrairPalavraChave(descricao);
        if (palavraChave) {
            await db.promise().query(`
                INSERT INTO regras_categoria (usuario_id, descricao_contem, categoria)
                VALUES (1, ?, ?)
                ON DUPLICATE KEY UPDATE categoria = VALUES(categoria)
            `, [palavraChave, novaCategoria]);
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

app.get('/categorias', async (req, res) => {
    try {
        const { userId } = req.query;
        if (!userId) return res.status(400).json({ error: 'userId é obrigatório.' });

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
app.post('/categorias', async (req, res) => {
    try {
        const { userId, nome } = req.body;
        if (!userId || !nome || !nome.trim()) {
            return res.status(400).json({ success: false, error: 'Informe userId e nome da categoria.' });
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
app.delete('/categorias/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { userId } = req.body;
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
