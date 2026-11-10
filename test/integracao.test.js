'use strict';

// Testes de integração com MySQL real. Rodam quando GBM_TESTE_MYSQL=1, no CI e
// em desenvolvimento, sobre um banco descartável: todas as tabelas são recriadas.
const test = require('node:test');

if (process.env.GBM_TESTE_MYSQL !== '1') {
    test('integração com MySQL real (defina GBM_TESTE_MYSQL=1 para executar)', { skip: true }, () => {});
    return;
}

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = 'segredo-dos-testes-de-integracao';
process.env.DB_HOST = process.env.DB_HOST || '127.0.0.1';
process.env.DB_PORT = process.env.DB_PORT || '3306';
process.env.DB_USER = process.env.DB_USER || 'root';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || '';
process.env.DB_NAME = process.env.DB_NAME || 'gbm_teste';
process.env.DB_SSL = 'false';
process.env.APP_URL = 'https://gbm-finance.com';
process.env.ALLOWED_ORIGINS = 'https://gbm-finance.com';
process.env.RESEND_API_KEY = 're_teste';
process.env.MP_ACCESS_TOKEN = 'teste';
process.env.DATA_ENCRYPTION_KEY = 'chave-de-criptografia-dos-testes';
process.env.EMAIL_INDEX_KEY = 'chave-de-indice-dos-testes';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const request = require('supertest');

const SENHA = 'Senha-de-integracao-123';
const OFX = `OFXHEADER:100
<OFX><SIGNONMSGSRSV1><SONRS><FI><ORG>Banco Exemplo
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKACCTFROM><BANKID>001
<BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261101120000[-3:BRT]<TRNAMT>-42.50<FITID>int-1<MEMO>Mercado Central
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261102<TRNAMT>1000.00<FITID>int-2<NAME>Salario
</BANKTRANLIST><LEDGERBAL><BALAMT>957.50</OFX>`;

async function recriarBanco() {
    const conexao = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: Number(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        multipleStatements: true
    });
    try {
        const [tabelas] = await conexao.query(
            'SELECT TABLE_NAME AS nome FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()'
        );
        await conexao.query('SET FOREIGN_KEY_CHECKS = 0');
        for (const { nome } of tabelas) await conexao.query(`DROP TABLE \`${nome}\``);
        await conexao.query('SET FOREIGN_KEY_CHECKS = 1');
        await conexao.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
    } finally {
        await conexao.end();
    }
}

test('fluxos principais com MySQL real', { timeout: 60000 }, async (t) => {
    await recriarBanco();
    const { app, db, prepararBanco } = require('../index');
    t.after(() => db.end());
    t.mock.method(console, 'log', () => {});
    await prepararBanco();
    await prepararBanco(); // migrações são idempotentes

    // Um único servidor HTTP, como em produção, também para as requisições paralelas.
    const servidor = await new Promise((resolve) => {
        const instancia = app.listen(0, '127.0.0.1', () => resolve(instancia));
    });
    t.after(() => new Promise((resolve) => servidor.close(resolve)));
    const cliente = request.agent(servidor);
    let usuarioId;
    let contaId;

    await t.test('health confirma o banco', async () => {
        const resposta = await request(servidor).get('/health').expect(200);
        assert.equal(resposta.body.database, 'ok');
    });

    await t.test('cadastro protege identidade e login abre a sessão', async () => {
        const cadastro = await cliente.post('/cadastro').send({
            nome: 'Pessoa', sobrenome: 'Teste', email: 'Pessoa.Teste@example.invalid',
            telefone: '11999990000', senha: SENHA, aceite_termos: true, consentimento_privacidade: true
        }).expect(200);
        usuarioId = cadastro.body.userId;
        const [[linha]] = await db.promise().query(
            'SELECT nome, email, email_criptografado, email_hash FROM usuarios WHERE id = ?', [usuarioId]
        );
        assert.equal(linha.nome, 'PROTEGIDO');
        assert.match(linha.email, /@anonimo\.gbm\.local$/);
        assert.ok(linha.email_criptografado && linha.email_hash);

        await cliente.post('/cadastro').send({
            nome: 'Outra', email: 'pessoa.teste@example.invalid', senha: SENHA,
            aceite_termos: true, consentimento_privacidade: true
        }).expect(400);

        const pendente = await cliente.post('/login')
            .send({ identificacao: 'pessoa.teste@example.invalid', senha: SENHA }).expect(200);
        assert.equal(pendente.body.verificado, false);
        await cliente.get('/login-status').expect(401);
        await db.promise().query('UPDATE usuarios SET verificado = 1 WHERE id = ?', [usuarioId]);
        await cliente.post('/login').send({ identificacao: 'pessoa.teste@example.invalid', senha: 'errada-123456' }).expect(401);
        await cliente.post('/login').send({ identificacao: 'pessoa.teste@example.invalid', senha: SENHA }).expect(200);
        const status = await cliente.get('/login-status').expect(200);
        assert.equal(String(status.body.userId), String(usuarioId));
    });

    await t.test('contas e lançamentos manuais', async () => {
        const conta = await cliente.post('/contas').send({
            nome: 'Conta principal', banco: 'Banco Exemplo', tipo_conta: 'corrente', saldo_inicial: 1000
        }).expect(201);
        contaId = conta.body.id;
        const contas = await cliente.get('/contas').expect(200);
        assert.ok(JSON.stringify(contas.body).includes('Conta principal'));

        await cliente.post('/transacao-manual').send({
            descricao: 'Mercado do bairro', valor: 150.5, tipo: 'Despesa', categoria: 'Alimentação',
            data_transacao: '2026-11-05', conta_id: contaId
        }).expect(200);
        await cliente.post('/transacao-manual').send({
            descricao: 'Sem conta', valor: 10, tipo: 'Despesa', categoria: 'Outros', data_transacao: '2026-11-05'
        }).expect(400);
        for (const invalido of [
            { valor: 'abc' }, { valor: 0 }, { tipo: 'Qualquer' }, { data_transacao: '05/11/2026' }, { descricao: '' }
        ]) {
            await cliente.post('/transacao-manual').send({
                descricao: 'Inválido', valor: 10, tipo: 'Despesa', categoria: 'Outros',
                data_transacao: '2026-11-05', conta_id: contaId, ...invalido
            }).expect(400);
        }
        const [[{ total }]] = await db.promise().query(
            'SELECT COUNT(*) AS total FROM transacoes WHERE conta_id = ?', [contaId]
        );
        assert.equal(total, 1);
        await cliente.get('/resumo-financeiro').expect(200);
    });

    await t.test('limites e objetivos com transações', async () => {
        await cliente.post('/metas').send({ categoria: 'Alimentação', valor_limite: 900 }).expect(200);
        await cliente.get('/metas-resumo').expect(200);

        const objetivo = await cliente.post('/objetivos').send({
            nome: 'Viagem', valor_meta: 3000, valor_inicial: 100
        }).expect(201);
        await cliente.post(`/objetivos/${objetivo.body.id}/contribuicoes`).send({ valor: 200 }).expect((r) => {
            assert.ok(r.status === 200 || r.status === 201, `status ${r.status}`);
        });
        const [[{ soma }]] = await db.promise().query(
            'SELECT SUM(valor) AS soma FROM objetivo_contribuicoes WHERE objetivo_id = ?', [objetivo.body.id]
        );
        assert.equal(Number(soma), 300);
        await cliente.delete(`/objetivos/${objetivo.body.id}`).expect(200);
        await cliente.delete('/objetivos/999999').expect(404);
    });

    await t.test('importação OFX com prévia assinada, confirmação e desfazer', async () => {
        const previa = await cliente.post('/ofx-extrato/preview')
            .attach('arquivo', Buffer.from(OFX), { filename: 'extrato.ofx', contentType: 'application/x-ofx' })
            .expect(200);
        assert.equal(previa.body.transacoes.length, 2);
        const confirmar = () => cliente.post('/importacoes/confirmar').send({
            conta_id: contaId, tipo_arquivo: 'OFX', nome_arquivo: 'extrato.ofx', banco: 'Banco Exemplo',
            hash_arquivo: previa.body.hash_arquivo, assinatura_previa: previa.body.assinatura_previa,
            saldo_detectado: previa.body.saldo_detectado, transacoes: previa.body.transacoes
        });
        const confirmacao = await confirmar().expect(201);
        await confirmar().expect(409);
        const lista = await cliente.get('/importacoes').expect(200);
        assert.ok(JSON.stringify(lista.body).includes('extrato.ofx'));
        const importacaoId = confirmacao.body.importacao_id || confirmacao.body.id
            || lista.body.importacoes?.[0]?.id;
        assert.ok(importacaoId, 'a confirmação precisa identificar o lote');
        await cliente.delete(`/importacoes/${importacaoId}`).expect(200);
        const [[{ total }]] = await db.promise().query(
            'SELECT COUNT(*) AS total FROM transacoes WHERE importacao_id = ?', [importacaoId]
        );
        assert.equal(total, 0);
    });

    await t.test('transação de uma requisição não captura escritas de outra', async () => {
        const sessaoA = db.promise();
        await sessaoA.beginTransaction();
        await sessaoA.query('INSERT INTO categorias_personalizadas (usuario_id, nome) VALUES (?, ?)', [usuarioId, 'Revertida']);
        await db.promise().query('INSERT INTO categorias_personalizadas (usuario_id, nome) VALUES (?, ?)', [usuarioId, 'Mantida']);
        const [visiveis] = await db.promise().query(
            'SELECT nome FROM categorias_personalizadas WHERE usuario_id = ? ORDER BY nome', [usuarioId]
        );
        assert.deepEqual(visiveis.map((linha) => linha.nome), ['Mantida']);
        await sessaoA.rollback();
        const [finais] = await db.promise().query(
            'SELECT nome FROM categorias_personalizadas WHERE usuario_id = ? ORDER BY nome', [usuarioId]
        );
        assert.deepEqual(finais.map((linha) => linha.nome), ['Mantida']);

        const respostas = await Promise.all([
            ...Array.from({ length: 12 }, (_, indice) => cliente.post('/transacao-manual').send({
                descricao: `Paralelo ${indice}`, valor: 1, tipo: 'Despesa', categoria: 'Outros',
                data_transacao: '2026-11-06', conta_id: contaId
            })),
            cliente.delete('/objetivos/999999'),
            cliente.delete('/transacoes/999999')
        ]);
        assert.equal(respostas.slice(0, 12).filter((r) => r.status === 200).length, 12);
        const [[{ total }]] = await db.promise().query(
            "SELECT COUNT(*) AS total FROM transacoes WHERE conta_id = ? AND descricao LIKE 'Paralelo %'", [contaId]
        );
        assert.equal(total, 12);
    });

    await t.test('assinatura sincronizada por webhook e reconciliação', async (st) => {
        const mercadopago = require('mercadopago');
        const crypto = require('node:crypto');
        const { reconciliarAssinaturas } = require('../src/servicos/assinaturas');
        const statusAtual = async () => (await db.promise().query(
            'SELECT status_pagamento, assinatura_cancelada_no_mp, trial_expira FROM usuarios WHERE id = ?',
            [usuarioId]
        ))[0][0];
        let assinaturaMp = {};
        st.mock.method(mercadopago.PreApproval.prototype, 'get', async () => assinaturaMp);
        st.mock.method(mercadopago.Payment.prototype, 'get', async () => ({
            status: 'approved', external_reference: String(usuarioId)
        }));
        const notificar = (tipo, id) => cliente.post(`/webhook-mercadopago?data.id=${id}&type=${tipo}`)
            .send({ type: tipo, data: { id } });

        await db.promise().query(
            "UPDATE usuarios SET status_pagamento = 'trial', trial_expira = NOW(), mercadopago_preapproval_id = 'pre1' WHERE id = ?",
            [usuarioId]
        );
        await cliente.get('/relatorio-mensal').expect(403);

        assinaturaMp = { id: 'pre1', status: 'authorized', external_reference: String(usuarioId) };
        await notificar('subscription_preapproval', 'pre1').expect(200);
        assert.equal((await statusAtual()).status_pagamento, 'pago');
        await cliente.get('/relatorio-mensal').expect(200);

        const proximaCobranca = new Date(Date.now() + 10 * 86400000);
        assinaturaMp = { id: 'pre1', status: 'cancelled', next_payment_date: proximaCobranca.toISOString() };
        await notificar('subscription_preapproval', 'pre1').expect(200);
        let atual = await statusAtual();
        assert.equal(atual.status_pagamento, 'cancelado');
        assert.equal(atual.assinatura_cancelada_no_mp, 1);
        assert.ok(new Date(atual.trial_expira) > new Date(Date.now() + 9 * 86400000));
        await cliente.get('/relatorio-mensal').expect(200); // período pago continua liberado

        await notificar('payment', '123').expect(200);
        assert.equal((await statusAtual()).status_pagamento, 'cancelado');

        process.env.MP_WEBHOOK_SECRET = 'segredo-webhook-teste';
        st.after(() => { delete process.env.MP_WEBHOOK_SECRET; });
        await notificar('payment', '123').expect(401);
        const ts = String(Date.now());
        const v1 = crypto.createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
            .update(`id:123;request-id:req-1;ts:${ts};`).digest('hex');
        await notificar('payment', '123').set('x-request-id', 'req-1')
            .set('x-signature', `ts=${ts},v1=${v1}`).expect(200);
        delete process.env.MP_WEBHOOK_SECRET;

        await db.promise().query(
            "UPDATE usuarios SET status_pagamento = 'pago', assinatura_cancelada_no_mp = 0, trial_expira = NULL WHERE id = ?",
            [usuarioId]
        );
        assinaturaMp = { id: 'pre1', status: 'paused' };
        const resultado = await reconciliarAssinaturas({ intervaloMs: 0 });
        assert.deepEqual(resultado, { verificadas: 1, corrigidas: 1 });
        atual = await statusAtual();
        assert.equal(atual.status_pagamento, 'cancelado');
        assert.equal(atual.assinatura_cancelada_no_mp, 0);
        await db.promise().query('UPDATE usuarios SET mercadopago_preapproval_id = NULL WHERE id = ?', [usuarioId]);
    });

    await t.test('exclusão da conta remove os dados do usuário', async () => {
        await cliente.delete('/minha-conta').send({ senha: SENHA, confirmacao: 'EXCLUIR MINHA CONTA' }).expect(200);
        const [[{ usuarios }]] = await db.promise().query('SELECT COUNT(*) AS usuarios FROM usuarios WHERE id = ?', [usuarioId]);
        const [[{ contas }]] = await db.promise().query('SELECT COUNT(*) AS contas FROM contas_bancarias WHERE usuario_id = ?', [usuarioId]);
        assert.equal(usuarios, 0);
        assert.equal(contas, 0);
        await cliente.get('/login-status').expect(401);
    });
});
