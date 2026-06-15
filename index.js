require('dotenv').config();
const crypto = require('crypto');
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const { PluggyClient } = require('pluggy-sdk');
const cron = require('node-cron');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');

// 1. Inicializamos o servidor PRIMEIRO
const app = express();

// 2. LIGAMOS OS TRADUTORES IMEDIATAMENTE A SEGUIR
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

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
// --- CONFIGURAÇÃO DO CARTEIRO (NODEMAILER) ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com', // ou o host do seu e-mail
    port: 465,
    secure: true,
    auth: {
        user: process.env.EMAIL_USER, // Isto vai buscar o que colocou no Render
        pass: process.env.EMAIL_PASS  // A Senha de App que mencionámos
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
            // Se der erro porque a coluna já existe, ele avisa
            if (err.code === 'ER_DUP_FIELDNAME') {
                return res.send("As colunas já existem! O banco já está pronto.");
            }
            return res.send("Erro ao alterar o banco: " + err.message);
        }
        res.send("✅ Banco de dados atualizado com sucesso! As gavetas do token foram criadas.");
    });
});
// --- ROTA DE CADASTRO DE USUÁRIO ---
// --- ROTA 1: APENAS CADASTRO ---
app.post('/cadastro', async (req, res) => {
    const { nome, sobrenome, cpf, email, telefone, senha } = req.body;

    try {
        // 1. Encriptar a palavra-passe
        const salt = await bcrypt.genSalt(10);
        const senhaHash = await bcrypt.hash(senha, salt);
        const cpfLimpo = cpf.replace(/\D/g, '');
        const cpfMascarado = crypto.createHash('sha256').update(cpfLimpo).digest('hex');

        // 2. Guardar no Banco de Dados MySQL (Sem o token por enquanto)
        const sql = `INSERT INTO usuarios (nome, sobrenome, cpf, email, telefone, senha_hash) VALUES (?, ?, ?, ?, ?, ?)`;
        
        // O "result" captura o ID gerado pelo banco
        const [result] = await db.promise().query(sql, [nome, sobrenome, cpf, email, telefone, senhaHash]);

        // 3. Responde com sucesso e envia o userId para o Frontend
        res.json({ success: true, userId: result.insertId, message: 'Cadastro realizado!' });

    } catch (error) {
        console.error(error);
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(400).json({ success: false, message: 'CPF ou E-mail já estão registados!' });
        }
        res.status(500).json({ success: false, message: 'Erro interno do servidor.' });
    }
});

// --- ROTA 2: GERAR E ENVIAR O CÓDIGO ---
app.post('/enviar-codigo', async (req, res) => {
    const { userId, canal } = req.body;

    try {
        // 1. Gerar o código de verificação de 6 dígitos
        const token = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Atualiza o banco de dados do utilizador com o código gerado
        await db.promise().query("UPDATE usuarios SET token_verificacao = ? WHERE id = ?", [token, userId]);

        // 3. Verifica o canal e envia a mensagem
        if (canal === 'email') {
            
            // Vai buscar o e-mail e o nome do utilizador ao banco
            const [rows] = await db.promise().query("SELECT nome, email FROM usuarios WHERE id = ?", [userId]);
            
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
            }
            
            const usuario = rows[0];

            const mailOptions = {
                from: 'guardianofbudgetmoney@gmail.com',
                to: usuario.email,
                subject: 'Código de Confirmação - Financeiro Pro',
                html: `<h2>Olá, ${usuario.nome}!</h2>
                       <p>Bem-vindo ao Financeiro Pro. O teu código de verificação é:</p>
                       <h1 style="color: #3b82f6; letter-spacing: 5px;">${token}</h1>
                       <p>Insere este código no sistema para ativar a tua conta.</p>`
            };

            transporter.sendMail(mailOptions, (error, info) => {
                if (error) {
                    console.error("Erro ao enviar email:", error);
                    return res.status(500).json({ success: false, message: 'Erro ao enviar o e-mail.' });
                }
                res.json({ success: true, message: 'Código enviado por e-mail.' });
            });

} else if (canal === 'whatsapp') {
            
            // 1. Busca o nome e o telefone do usuário no banco de dados
            const [rows] = await db.promise().query("SELECT nome, telefone FROM usuarios WHERE id = ?", [userId]);
            
            if (rows.length === 0) {
                return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
            }
            
            const usuario = rows[0];

            // 2. Limpa a formatação (remove os parênteses e traços que o usuário digitou)
            let telefoneLimpo = usuario.telefone.replace(/\D/g, ''); 
            
            // 3. Monta o número no padrão da API (55 = Brasil + número + @c.us)
            const numeroWhatsApp = "55" + telefoneLimpo + "@c.us";

            // 4. Dispara a mensagem
            try {
                const mensagem = `Olá, *${usuario.nome}*! Bem-vindo ao Financeiro Pro.\n\nO seu código de verificação é: *${token}*`;
                await client.sendMessage(numeroWhatsApp, mensagem);
                res.json({ success: true, message: 'Código enviado via WhatsApp.' });
            } catch (errZap) {
                console.error("Erro ao enviar WhatsApp:", errZap);
                res.status(500).json({ success: false, message: 'Falha ao enviar WhatsApp. O servidor está conectado?' });
      }
    } // <- Esta chave fecha o "else if" do WhatsApp

} catch (error) {
    // 👇 ESTE É O BLOCO QUE TINHA SIDO APAGADO!
    console.error("Erro no envio de código:", error);
    res.status(500).json({ success: false, message: 'Erro ao processar o envio.' });
}
});
// 2. Middlewares (Configurações essenciais)
app.use(cors());
app.use(express.json());
// Isso faz o servidor ler e entregar automaticamente o seu index.html
app.use(express.static('public')); 

// --- ATENÇÃO: COLE AQUI AS SUAS CHAVES ATUALIZADAS ---
const MEU_CLIENT_ID = '52941af5-8efd-4b45-af03-3e515e24e8e6';
const MEU_CLIENT_SECRET = 'e0b21d54-0564-4040-ae45-70cff7abad6b';
// -----------------------------------------------------

const pluggyClient = new PluggyClient({
    clientId: MEU_CLIENT_ID,
    clientSecret: MEU_CLIENT_SECRET,
});

// --- ROTA PARA O WIDGET DO OPEN FINANCE (PLUGGY) ---
app.get('/api/pluggy/token', async (req, res) => {
    try {
        // Pede à Pluggy um token único para abrir o widget
        const tokenResponse = await pluggyClient.createConnectToken();
        
        // Devolve o token formatado corretamente para o seu painel
        res.json({ accessToken: tokenResponse.accessToken });
    } catch (error) {
        console.error("Erro ao gerar token da Pluggy:", error);
        res.status(500).json({ success: false, message: 'Erro ao ligar ao Open Finance.' });
    }
});
// --- ROTA DEFINITIVA COM GRAVAÇÃO NO BANCO DE DADOS (MySQL) ---
app.post('/dados-bancarios', async (req, res) => {
    const { itemId } = req.body;
    const usuarioId = 1; // ID padrão do utilizador do sistema
    console.log("⏳ A extrair dados do Open Finance e a gravar no MySQL... Item ID:", itemId);

    try {
        // 1. Busca as contas bancárias ligadas a este Item na Pluggy
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
            // Pode ir adicionando mais conforme for descobrindo!
        };
        if (contas.results && contas.results.length > 0) {
            
            // --- BLOCO 1: GRAVA OU ATUALIZA AS CONTAS NO MYSQL ---
            for (const conta of contas.results) {
                const sqlConta = `
                    INSERT INTO contas_bancarias (usuario_id, conta_id_pluggy, item_id_pluggy, nome_instituicao, tipo_conta, saldo) 
                    VALUES (?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE saldo = VALUES(saldo), ultima_atualizacao = CURRENT_TIMESTAMP
                `;
                
                await db.promise().query(sqlConta, [
                    usuarioId, 
                    conta.id, 
                    itemId, 
                    conta.name, 
                    conta.type, 
                    conta.balance
                ]);
                console.log(`✅ Conta "${conta.name}" sincronizada no MySQL.`);
            }

            // 2. Captura a primeira conta para extrair o extrato via API V2 (Bypass)
            const primeiraContaId = contas.results[0].id;
            
            // A) Gera a chave temporária (API Key)
            const authReq = await fetch('https://api.pluggy.ai/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clientId: MEU_CLIENT_ID,
                    clientSecret: MEU_CLIENT_SECRET
                })
            });
            const { apiKey } = await authReq.json();

            // B) Busca as transações diretamente na Rota V2
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

            // --- BLOCO 2: GRAVA AS TRANSAÇÕES NO MYSQL ---
            if (todasTransacoes.length > 0) {
                let transacoesGravadas = 0;

                // Descobre o ID interno da conta que acabou de ser atualizada no banco
                const [contasLocalizadas] = await db.promise().query(
                    'SELECT id FROM contas_bancarias WHERE conta_id_pluggy = ?', 
                    [primeiraContaId]
                );

                if (contasLocalizadas.length > 0) {
                    const contaInternaId = contasLocalizadas[0].id;

                    // 🧹 A FAXINA: Apaga as transações antigas da Pluggy antes de inserir as novas (evita duplicatas e limpa o inglês)
                    await db.promise().query('DELETE FROM transacoes WHERE conta_id = ? AND transacao_id_pluggy IS NOT NULL', [contaInternaId]);

                    for (const transacao of todasTransacoes) {
                        const sqlTransacao = `
                            INSERT INTO transacoes (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria, data_transacao)
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                        `;
                        
                        // Formata a data e aplica a tradução do dicionário
                        const dataFormatada = new Date(transacao.date).toISOString().split('T')[0];
                        const categoriaTraduzida = dicionarioCategorias[transacao.category] || transacao.category || 'Outros';
                        
                        await db.promise().query(sqlTransacao, [
                            contaInternaId,
                            transacao.id,
                            transacao.description,
                            transacao.amount,
                            transacao.type,
                            categoriaTraduzida,
                            dataFormatada
                        ]);
                        transacoesGravadas++;
                    }
                    console.log(`🚀 Sucesso! ${transacoesGravadas} transações limpas e gravadas na base de dados com as novas traduções.`);
                }
            }
        }

        // 3. Devolve a resposta de sucesso e os dados para o Dashboard
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

        // O SQL agora puxa t.tipo para diferenciarmos Crédito e Débito
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

        // Agrupamos pela categoria E pelo tipo (garantindo que não mistura receita com despesa)
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
        
        // Se a categoria já tem meta, ele atualiza; se não, ele insere.
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
        
        // Apaga a regra do banco de dados para aquela categoria específica
        await db.promise().query('DELETE FROM metas WHERE categoria = ?', [categoria]);
        
        console.log(`🗑️ Limite removido. A categoria [${categoria}] agora é um gasto fixo.`);
        res.json({ success: true, message: 'Limite removido com sucesso!' });
    } catch (error) {
        console.error("❌ Erro ao remover meta:", error);
        res.status(500).json({ error: 'Falha ao remover meta' });
    }
});
//  LANÇAMENTO MANUAL (CAIXA FÍSICO / OUTRAS RECEITAS) ---
app.post('/transacao-manual', async (req, res) => {
    try {
        const { descricao, valor, tipo, categoria, data_transacao } = req.body;

        // 1. Gera um ID único falso para não quebrar a regra de chave única do MySQL
        const transacaoIdGerado = 'MANUAL_' + Date.now();

        // 2. Pega a primeira conta que existir no banco para atrelar a transação
        const [contas] = await db.promise().query('SELECT id FROM contas_bancarias LIMIT 1');
        const contaInternaId = contas.length > 0 ? contas[0].id : 1; 

        // 3. Regra de ouro financeira: Débitos têm de entrar no banco como negativos!
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

// Função isolada que faz o trabalho pesado
async function sincronizarPluggySilencioso() {
    console.log('🤖 [CRON] Iniciando sincronização automática com a Pluggy...');
    try {
        // OPÇÃO A: Cole aqui dentro a mesma lógica do seu app.post('/dados-bancarios')
        // OPÇÃO B: Faça um fetch (requisição interna) para a sua própria rota, simulando o clique do usuário:
        await fetch('http://localhost:3000/dados-bancarios', { method: 'POST' });

        console.log('✅ [CRON] Dados financeiros atualizados com sucesso no MySQL!');
        await auditarMetas();
    } catch (error) {
        console.error('❌ [CRON] Erro durante a sincronização noturna:', error);
    }
}

// --- AGENDAMENTO DO ROBÔ ---
// O Cron usa uma sintaxe de 5 asteriscos: Minuto | Hora | Dia (Mês) | Mês | Dia (Semana)

// Para o ambiente de PRODUÇÃO (Rodar todos os dias às 04:00 da manhã):
cron.schedule('0 4 * * *', () => {
    sincronizarPluggySilencioso();
}, {
    scheduled: true,
    timezone: "America/Sao_Paulo" // Garante que respeite o fuso horário correto
});

// =======================================================
// --- MÓDULO DE NOTIFICAÇÕES E AUDITORIA DE METAS ---
// =======================================================

// Função que varre os gastos e gera os alertas
async function auditarMetas() {
    try {
        const [prefs] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        const percentualAlerta = prefs.length > 0 ? prefs[0].percentual_alerta : 80;

        // Puxa o total gasto no mês atual cruzado com a meta
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
                
                // Evita criar o mesmo alerta repetido no mesmo dia
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

// Rotas para a Página de Notificações
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
    const { mes, ano } = req.query; // Recebe o mês/ano que o usuário escolheu
    
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
// Rota de Login Corrigida
app.post('/login', async (req, res) => {
    const { identificacao, senha } = req.body;

    const sql = "SELECT * FROM usuarios WHERE email = ? OR cpf = ?";
    db.query(sql, [identificacao, identificacao], async (err, results) => {
        if (err || results.length === 0) {
            return res.status(401).json({ success: false, message: 'Usuário não encontrado.' });
        }

        const usuario = results[0];
        
        // Compara a senha
        const senhaValida = await bcrypt.compare(senha, usuario.senha_hash);
        if (!senhaValida) {
            return res.status(401).json({ success: false, message: 'Senha incorreta.' });
        }

        // SUCESSO: Devolve o ID do usuário para usarmos na tela de validação!
        res.json({ 
            success: true, 
            userId: usuario.id, 
            message: 'Senha correta. Insira o código de verificação.' 
        });
    });
});
// rota de verificação
app.post('/verificar-conta', (req, res) => {
    const { userId, codigoDigitado } = req.body;

    const sql = "SELECT * FROM usuarios WHERE id = ? AND token_verificacao = ?";
    db.query(sql, [userId, codigoDigitado], (err, results) => {
        if (err || results.length === 0) {
            return res.status(400).json({ success: false, message: 'Código inválido!' });
        }

        // Se o código bateu, marcamos como verificado
        db.query("UPDATE usuarios SET verificado = 1 WHERE id = ?", [userId], (err) => {
            if (err) return res.status(500).json({ success: false, message: 'Erro ao ativar conta.' });
            res.json({ success: true, message: 'Conta ativada com sucesso!' });
        });
    });
});
// --- ROTA PARA DISPARAR O CÓDIGO ---
app.post('/enviar-codigo', (req, res) => {
    const { userId, canal } = req.body;

    // 1. Gerar código aleatório de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000);

    // 2. Atualizar o token no banco de dados para esse usuário
    db.query("UPDATE usuarios SET token_verificacao = ? WHERE id = ?", [codigo, userId], (err) => {
        if (err) return res.status(500).json({ success: false, message: 'Erro ao gerar token.' });

        if (canal === 'email') {
            // Lógica do Nodemailer que já configuramos
            // transporter.sendMail(...)
            res.json({ success: true, message: 'Código enviado por e-mail.' });
        } else if (canal === 'whatsapp') {
            // Aqui entra a integração com API (ex: Z-API ou Twilio)
            console.log(`Simulação: WhatsApp enviado com código ${codigo}`);
            res.json({ success: true, message: 'Código enviado via WhatsApp.' });
        }
    });
});
// --- ROTA PARA VALIDAR O CÓDIGO ---
app.post('/validar-codigo', (req, res) => {
    const { userId, codigo } = req.body;

    // Vai buscar o código guardado no banco de dados para este utilizador
    db.query("SELECT token_verificacao FROM usuarios WHERE id = ?", [userId], (err, results) => {
        if (err) return res.status(500).json({ success: false, message: 'Erro no servidor.' });

        if (results.length === 0) {
            return res.status(404).json({ success: false, message: 'Utilizador não encontrado.' });
        }

        const codigoNoBanco = results[0].token_verificacao;

        // Compara o código digitado com o que está guardado
        if (codigo === codigoNoBanco) {
            // Se bater certo, atualiza o utilizador para "verificado" e limpa o token
            db.query("UPDATE usuarios SET token_verificacao = NULL WHERE id = ?", [userId], (updateErr) => {
                if (updateErr) console.error("Erro ao limpar token:", updateErr);
                
                res.json({ success: true, message: 'Conta validada com sucesso!' });
            });
        } else {
            // Se errar o código
            res.status(400).json({ success: false, message: 'Código de verificação incorreto.' });
        }
    });
});
// --- CONFIGURAÇÃO DO WHATSAPP WEB ---
// const { Client, LocalAuth } = require('whatsapp-web.js');
// const qrcode = require('qrcode-terminal');

// const client = new Client({
//    puppeteer: {
//      args: ['--no-sandbox', '--disable-setuid-sandbox']
//    }
// });
// client.on('qr', (qr) => {
    // Quando o servidor iniciar, vai gerar o QR Code no terminal
 //   qrcode.generate(qr, { small: true });
 // console.log('🤖 Escaneie o QR Code acima com o seu WhatsApp para conectar!');
// });

// client.on('ready', () => {
 //   console.log('✅ WhatsApp conectado com sucesso! Servidor pronto.');
 //;

// client.initialize();
// ------------------------------------
// 4. Liga o servidor
// Define a porta dinâmica do Render ou a 3000 se estiver no seu PC
const PORT = process.env.PORT || 3000; 

// O '0.0.0.0' é a chave mágica que o Render pede na documentação
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Servidor rodando perfeitamente na porta ${PORT}`);
});