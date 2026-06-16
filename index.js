require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { PluggyClient } = require('pluggy-sdk');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const { Resend } = require('resend');

// Inicializamos a API de Email (Resend)
const resend = new Resend(process.env.RESEND_API_KEY);

// 1. Inicializamos o servidor Express
const app = express();

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

// ---------------------------------------
// --- ROTA SECRETA PARA ATUALIZAR O BANCO DE DADOS ---
app.get('/atualizar-banco', (req, res) => {
    const sql = "ALTER TABLE usuarios ADD COLUMN token_verificacao VARCHAR(10), ADD COLUMN verificado TINYINT(1) DEFAULT 0;";
    
    db.query(sql, (err, results) => {
        if (err) {
            if (err.code === 'ER_DUP_FIELDNAME') {
                return res.send("As colunas já existem! O banco já está pronto.");
            }
            return res.send("Erro ao alterar o banco: " + err.message);
        }
        res.send("✅ Banco de dados atualizado com sucesso! As gavetas do token foram criadas.");
    });
});
// --- ROTA SECRETA PARA DEIXAR A TABELA DE CONTAS PERFEITA ---
app.get('/corrigir-contas', async (req, res) => {
    try {
        // Vamos criar as gavetas do Nome do Banco e do Tipo de Conta de uma só vez!
        await db.promise().query("ALTER TABLE contas_bancarias ADD COLUMN nome_instituicao VARCHAR(255), ADD COLUMN tipo_conta VARCHAR(50);");
        res.send("✅ Tabela de contas atualizada com sucesso! Todas as gavetas estão prontas.");
    } catch (err) {
        if (err.code === 'ER_DUP_FIELDNAME') {
            return res.send("As colunas já existem! O banco já está pronto.");
        }
        res.send("Erro ao alterar o banco: " + err.message);
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

// --- CHAVES E CLIENTE PLUGGY ---
const MEU_CLIENT_ID = '52941af5-8efd-4b45-af03-3e515e24e8e6';
const MEU_CLIENT_SECRET = 'e0b21d54-0564-4040-ae45-70cff7abad6b';

const pluggyClient = new PluggyClient({
    clientId: MEU_CLIENT_ID,
    clientSecret: MEU_CLIENT_SECRET,
});

// --- ROTA PARA O WIDGET DO OPEN FINANCE (PLUGGY) ---
app.get('/api/pluggy/token', async (req, res) => {
    try {
        const tokenResponse = await pluggyClient.createConnectToken();
        res.json({ accessToken: tokenResponse.accessToken });
    } catch (error) {
        console.error("Erro ao gerar token da Pluggy:", error);
        res.status(500).json({ success: false, message: 'Erro ao ligar ao Open Finance.' });
    }
});

// --- ROTA DEFINITIVA COM GRAVAÇÃO NO BANCO DE DADOS (MySQL) ---
app.post('/dados-bancarios', async (req, res) => {
    const { itemId } = req.body;
    const usuarioId = 1; 
    console.log("⏳ A extrair dados do Open Finance e a gravar no MySQL... Item ID:", itemId);

    try {
        const contas = await pluggyClient.fetchAccounts(itemId);
        let todasTransacoes = [];
        const dicionarioCategorias = {
            "Housing": "Habitação",
            "Food": "Alimentação",
            "Electricity": "Eletricidade / Luz",
            "Telecommunications": "Telecomunicações / Internet",
            "Credit card payment": "Pagamento de Fatura",
            "Video streaming": "Streaming de Vídeo",
            "Transfer - Bank Slip": "Pagamento de Boleto",
            "Gyms and fitness centers": "Academia e Fitness",
            "Music streaming": "Streaming de Música",
            "Salary": "Salário",
            "Restaurants": "Restaurantes",
            "Groceries": "Supermercado",
            "Transportation": "Transporte",
            "Health": "Saúde",
            "Education": "Educação"
        };
        
        if (contas.results && contas.results.length > 0) {
            
            for (const conta of contas.results) {
                const sqlConta = `
                    INSERT INTO contas_bancarias (usuario_id, conta_id_pluggy, item_id_pluggy, nome_instituicao, tipo_conta, saldo) 
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE saldo = VALUES(saldo), ultima_atualizacao = CURRENT_TIMESTAMP
                `;
                
                await db.promise().query(sqlConta, [
                    usuarioId, conta.id, itemId, conta.name, conta.type, conta.balance
                ]);
                console.log(`✅ Conta "${conta.name}" sincronizada no MySQL.`);
            }

            const primeiraContaId = contas.results[0].id;
            
            const authReq = await fetch('https://api.pluggy.ai/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: MEU_CLIENT_ID,
                    clientSecret: MEU_CLIENT_SECRET
                })
            });
            const { apiKey } = await authReq.json();

            const urlV2 = `https://api.pluggy.ai/v2/transactions?accountId=${primeiraContaId}`;
            const respostaV2 = await fetch(urlV2, {
                method: 'GET',
                headers: {
                    'accept': 'application/json',
                    'X-API-KEY': apiKey
                }
            });
            
            const extrato = await respostaV2.json();
            todasTransacoes = extrato.results || [];

            if (todasTransacoes.length > 0) {
                let transacoesGravadas = 0;

                const [contasLocalizadas] = await db.promise().query(
                    'SELECT id FROM contas_bancarias WHERE conta_id_pluggy = ?', 
                    [primeiraContaId]
                );

                if (contasLocalizadas.length > 0) {
                    const contaInternaId = contasLocalizadas[0].id;

                    await db.promise().query('DELETE FROM transacoes WHERE conta_id = ? AND transacao_id_pluggy IS NOT NULL', [contaInternaId]);

                    for (const transacao of todasTransacoes) {
                        const sqlTransacao = `
                            INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;
                        
                        const dataFormatada = new Date(transacao.date).toISOString().split('T')[0];
                        const categoriaTraduzida = dicionarioCategorias[transacao.category] || transacao.category || 'Outros';
                        
                        await db.promise().query(sqlTransacao, [
                            contaInternaId, transacao.id, transacao.description, transacao.amount, transacao.type, categoriaTraduzida, dataFormatada
                        ]);
                        transacoesGravadas++;
                    }
                    console.log(`🚀 Sucesso! ${transacoesGravadas} transações limpas e gravadas na base de dados com as novas traduções.`);
                }
            }
        }

        res.json({ 
            success: true, 
            contas: contas.results, 
            transacoes: todasTransacoes,
            message: "Sincronização realizada e salva no banco com sucesso!"
        });

    } catch (error) {
        console.error("Erro no processamento e gravação dos dados bancários:", error);
        res.status(500).json({ success: false, error: "Falha ao processar e salvar os dados financeiros." });
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

// --- AUTOMAÇÃO: SINCRONIZAÇÃO SILENCIOSA (BACKGROUND JOB) ---
async function sincronizarPluggySilencioso() {
    console.log('🤖 [CRON] Iniciando sincronização automática com a Pluggy...');
    try {
        await fetch('http://localhost:3000/dados-bancarios', { method: 'POST' });
        console.log('✅ [CRON] Dados financeiros atualizados com sucesso no MySQL!');
        await auditarMetas();
    } catch (error) {
        console.error('❌ [CRON] Erro durante a sincronização noturna:', error);
    }
}

// --- AGENDAMENTO DO ROBÔ ---
cron.schedule('0 4 * * *', () => {
    sincronizarPluggySilencioso();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo"
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
            // Se já foi, manda um "verificado: true"
            res.json({ 
                success: true, 
                verificado: true, 
                userId: usuario.id, 
                message: 'Login efetuado com sucesso!' 
            });
        } else {
            // Se é conta nova, manda para a tela de escolher E-mail/WhatsApp
            res.json({ 
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

// 4. Liga o servidor
const PORT = process.env.PORT || 3000; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando perfeitamente na porta ${PORT}`);
});