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
// 1. Inicializamos o servidor Express
const app = express();
// --- ROTA: CRIAR SESSÃO DE PAGAMENTO (MERCADO PAGO) ---
// --- ROTA: CRIAR ASSINATURA MENSAL (MERCADO PAGO) ---
app.post('/criar-sessao-pagamento', express.json(), async (req, res) => {
    const { userId } = req.body;

    try {
        const [rows] = await db.promise().query("SELECT email FROM usuarios WHERE id = ?", [userId]);
        if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });

        const meuDominio = `${req.protocol}://${req.get('host')}`;
        const preApproval = new PreApproval(mpClient);

        // Cria a ASSINATURA (Cobrança Mensal Recorrente)
        const resultado = await preApproval.create({
            body: {
                reason: 'Plano Premium Mensal - GBM Financeiro',
                auto_recurring: {
                    frequency: 1,
                    frequency_type: 'months', // Repete a cada 1 mês
                    transaction_amount: 19.90, // Novo valor!
                    currency_id: 'BRL'
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
        const [contas] = await db.promise().query('SELECT id FROM contas_bancarias LIMIT 1');
        const contaInternaId = contas.length > 0 ? contas[0].id : 1;
        let inseridas = 0;
        let duplicadas = 0;
        
        // 4. Varre cada linha do extrato bancário
        for (const tx of transacoesOfx) {
            if (!tx.FITID) continue; // Pula linhas inválidas sem ID bancário
            const transacaoIdBancario = tx.FITID;
            const descricao = tx.MEMO || tx.NAME || 'Transação Eletrónica';
            
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

            // Categoria Inteligente por palavras-chave
            let categoria = 'Outros';
            const descMinuscula = descricao.toLowerCase();
            if (descMinuscula.includes('uber') || descMinuscula.includes('99app') || descMinuscula.includes('combustivel') || descMinuscula.includes('posto')) {
                categoria = 'Transporte';
            } else if (descMinuscula.includes('ifood') || descMinuscula.includes('restaurante') || descMinuscula.includes('burger') || descMinuscula.includes('mcdonald') || descMinuscula.includes('cafe')) {
                categoria = 'Alimentação';
            } else if (descMinuscula.includes('mercado') || descMinuscula.includes('carrefour') || descMinuscula.includes('extra')) {
                categoria = 'Supermercado';
            } else if (descMinuscula.includes('netflix') || descMinuscula.includes('spotify') || descMinuscula.includes('prime')) {
                categoria = 'Streaming';
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
                INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE conta_id = conta_id
            `;
            const [resultadoInsert] = await db.promise().query(sql, [
                contaInternaId, transacaoIdBancario, descricao, valor, tipo, categoria, dataFormatada
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
    const { nome, sobrenome, cpf, email, telefone, senha } = req.body;
    try {
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const cpfLimpo = cpf.replace(/\D/g, '');
        const cpfMascarado = crypto.createHash('sha256').update(cpfLimpo).digest('hex');
        const sql = `INSERT INTO usuarios (nome, sobrenome, cpf, email, telefone, senha_hash) VALUES (?, ?, ?, ?, ?, ?)`;
        const [result] = await db.promise().query(sql, [nome, sobrenome, cpf, email, telefone, senhaHash]);
        res.json({ success: true, userId: result.insertId, message: 'Cadastro realizado!' });
    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'CPF ou E-mail já estão registados!' });
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
            const { data, error } = await resend.emails.send({
                from: 'GBM Financeiro <onboarding@resend.dev>',
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
        } else if (canal === 'whatsapp') {
            res.json({ success: false, message: 'Integração com WhatsApp aguardando lançamento.' });
        }
    } catch (erro) {
        console.error("Erro crítico no envio do código:", erro);
        res.status(500).json({ success: false, message: 'Erro interno no servidor.' });
    }
});
// --- LÓGICA DE NEGÓCIO EVOLUÍDA: RECEITAS, DESPESAS E METAS ---
app.get('/resumo-financeiro', async (req, res) => {
    try {
        const { mes, ano } = req.query;
        let sql = `
            SELECT 
                t.categoria, 
                t.tipo,
                SUM(t.valor) AS total_movimentado, 
                COUNT(t.id) AS qtd_transacoes,
                AVG(t.valor) AS ticket_medio,
                m.valor_limite AS teto_gastos
            FROM transacoes t
            LEFT JOIN metas m ON t.categoria = m.categoria
            WHERE 1=1
        `;
        const params = [];
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
        sql += ` GROUP BY t.categoria, t.tipo ORDER BY total_movimentado ASC;`;
        const [rows] = await db.promise().query(sql, params);
        res.json({ status: 'success', data: rows });
    } catch (error) {
        console.error("❌ Erro na lógica de resumo com balanço:", error);
        res.status(500).json({ status: 'error', message: 'Falha ao processar resumo financeiro' });
    }
});
// --- NOVA ROTA: SALVAR/ATUALIZAR METAS DO USUÁRIO ---
app.post('/metas', async (req, res) => {
    try {
        const { categoria, valor_limite } = req.body;
        const sql = `
            INSERT INTO metas (categoria, valor_limite) 
            VALUES (?, ?) 
            ON DUPLICATE KEY UPDATE valor_limite = VALUES(valor_limite)
        `;
        await db.promise().query(sql, [categoria, valor_limite]);
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
        const { categoria } = req.body;
        await db.promise().query('DELETE FROM metas WHERE categoria = ?', [categoria]);
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
        const [contas] = await db.promise().query('SELECT id FROM contas_bancarias LIMIT 1');
        const contaInternaId = contas.length > 0 ? contas[0].id : 1; 
        const valorFinal = tipo === 'DEBIT' ? -Math.abs(valor) : Math.abs(valor);
        const sql = `INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao)
                     VALUES (?, ?, ?, ?, ?, ?, ?)`;
        await db.promise().query(sql, [contaInternaId, transacaoIdGerado, descricao, valorFinal, tipo, categoria, data_transacao]);
        console.log(`✍️ Lançamento Manual: ${descricao} | R$ ${valorFinal} | ${data_transacao}`);
        await auditarMetas();
        res.json({ success: true, message: 'Lançamento inserido no MySQL!' });
    } catch (error) {
        console.error("❌ Erro ao salvar lançamento manual:", error);
        res.status(500).json({ error: 'Falha ao processar lançamento.' });
    }
});
// =======================================================
// --- MÓDULO DE NOTIFICAÇÕES E AUDITORIA DE METAS ---
// =======================================================
async function auditarMetas() {
    try {
        const [prefs] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        const percentualAlerta = prefs.length > 0 ? prefs[0].percentual_alerta : 80;
        const sql = `
            SELECT t.categoria, SUM(t.valor) as total_gasto, m.valor_limite
            FROM transacoes t
            JOIN metas m ON t.categoria = m.categoria
            WHERE t.tipo = 'DEBIT' AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE()) AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
            GROUP BY t.categoria, m.valor_limite
        `;
        const [gastos] = await db.promise().query(sql);
        for (const item of gastos) {
            const gastoAbs = Math.abs(item.total_gasto);
            const limite = parseFloat(item.valor_limite);
            const porcentagemAtual = (gastoAbs / limite) * 100;
            if (porcentagemAtual >= percentualAlerta) {
                const msg = `Atenção: Você atingiu ${porcentagemAtual.toFixed(1)}% do seu limite de R$ ${limite.toFixed(2)} na categoria ${item.categoria}.`;
                const [check] = await db.promise().query(
                    'SELECT id FROM alertas WHERE categoria = ? AND DATE(data_criacao) = CURRENT_DATE()', 
                    [item.categoria]
                );
                if (check.length === 0) {
                    await db.promise().query('INSERT INTO alertas (categoria, mensagem) VALUES (?, ?)', [item.categoria, msg]);
                    console.log(`🔔 NOVO ALERTA GERADO: ${msg}`);
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
app.get('/metas-resumo', async (req, res) => {
    const sql = `
        SELECT m.categoria, m.valor_limite as limite, 
        IFNULL(SUM(ABS(t.valor)), 0) as gasto
        FROM metas m
        LEFT JOIN transacoes t ON m.categoria = t.categoria 
        AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
        GROUP BY m.categoria, m.valor_limite
    `;
    const [rows] = await db.promise().query(sql);
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
    const sql = "SELECT * FROM usuarios WHERE email = ? OR cpf = ?";
    db.query(sql, [identificacao, identificacao], async (err, results) => {
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
                statusPagamento: usuario.status_pagamento, // 🔍 ENVIAMOS O STATUS DO PAGAMENTO
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
// 4. Liga o servidor
const PORT = process.env.PORT || 3000; 
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando perfeitamente na porta ${PORT}`);
});