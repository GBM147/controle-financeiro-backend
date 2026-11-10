'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { rootCertificates } = require('node:tls');
const { X509Certificate } = require('node:crypto');
const mysql = require('mysql2');
const { criarConfiguracaoMysql, criarStoreSessaoMysql, criarBancoMysql } = require('../mysql-config');

test('MySQL remoto exige TLS com certificado e identidade verificados', () => {
    const configuracao = criarConfiguracaoMysql({ DB_HOST: 'mysql.exemplo.invalid' });
    assert.equal(configuracao.ssl.rejectUnauthorized, true);
    assert.equal(configuracao.ssl.verifyIdentity, true);
});

test('flag legada false não aborta a configuração nem desativa a validação TLS', (t) => {
    const aviso = t.mock.method(console, 'warn', () => {});
    const configuracao = criarConfiguracaoMysql({
        NODE_ENV: 'production', DB_HOST: 'mysql.exemplo.invalid',
        DB_SSL_REJECT_UNAUTHORIZED: 'false'
    });
    assert.equal(configuracao.ssl.rejectUnauthorized, true);
    assert.equal(configuracao.ssl.verifyIdentity, true);
    assert.equal(aviso.mock.calls.length, 1);
    assert.match(aviso.mock.calls[0].arguments[0], /legada.*ignorada/);
});

test('MySQL sem TLS exige host de loopback explícito fora de produção', () => {
    for (const host of ['localhost', '127.0.0.1', '::1']) {
        assert.equal(criarConfiguracaoMysql({
            DB_HOST: host, DB_SSL: 'false', NODE_ENV: 'development'
        }).ssl, undefined);
    }
    for (const env of [
        { DB_HOST: 'mysql.exemplo.invalid', DB_SSL: 'false' },
        { DB_SSL: 'false' },
        { DB_HOST: '127.0.0.1', DB_SSL: 'false', NODE_ENV: 'production' }
    ]) {
        assert.throws(() => criarConfiguracaoMysql(env), /só é permitido para MySQL local/);
    }
    assert.throws(() => criarConfiguracaoMysql({ DB_SSL: 'falso' }), /true ou false/);
});

test('CA do provedor é carregada sem desativar a verificação TLS', (t) => {
    const diretorio = fs.mkdtempSync(path.join(os.tmpdir(), 'gbm-mysql-ca-'));
    t.after(() => fs.rmSync(diretorio, { recursive: true, force: true }));
    const arquivo = path.join(diretorio, 'ca.pem');
    const conteudo = rootCertificates[0];
    fs.writeFileSync(arquivo, conteudo);
    const configuracao = criarConfiguracaoMysql({ DB_SSL_CA_FILE: arquivo });
    assert.equal(configuracao.ssl.ca, conteudo);
    assert.equal(configuracao.ssl.rejectUnauthorized, true);
    assert.equal(configuracao.ssl.verifyIdentity, true);
    assert.throws(() => criarConfiguracaoMysql({
        DB_SSL_CA_FILE: path.join(diretorio, 'inexistente.pem')
    }), { code: 'ENOENT' });
});

test('CA pública também pode ser configurada por PEM direto, escapado ou base64', () => {
    const ca = rootCertificates[0];
    for (const env of [
        { DB_SSL_CA: ca },
        { DB_SSL_CA: ca.replace(/\n/g, '\\n') },
        { DB_SSL_CA_BASE64: Buffer.from(ca).toString('base64') }
    ]) {
        const config = criarConfiguracaoMysql(env);
        assert.equal(config.ssl.ca, ca);
        assert.equal(config.ssl.rejectUnauthorized, true);
        assert.equal(config.ssl.verifyIdentity, true);
    }
    for (const env of [
        { DB_SSL_CA: 'não é um certificado' },
        { DB_SSL_CA: '-----BEGIN PRIVATE KEY-----\nprivada\n-----END PRIVATE KEY-----' },
        { DB_SSL_CA_BASE64: '*inválido*' },
        { DB_SSL_CA_BASE64: Buffer.from('texto sem certificado').toString('base64') }
    ]) {
        assert.throws(() => criarConfiguracaoMysql(env), /certificado|CA/);
    }
});

test('Aiven usa a CA pública incluída no deploy sem desativar TLS', () => {
    const ca = fs.readFileSync(path.join(__dirname, '../certificados/aiven-ca.pem'), 'utf8');
    assert.equal(new X509Certificate(ca).ca, true);
    assert.doesNotMatch(ca, /PRIVATE KEY/);
    const config = criarConfiguracaoMysql({
        NODE_ENV: 'production', DB_HOST: 'servico.aivencloud.com', DB_SSL: 'true'
    });
    assert.equal(config.ssl.ca, ca);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.verifyIdentity, true);
});

test('CA explícita tem prioridade sobre a CA Aiven incluída, sem ocultar erro de configuração', () => {
    const host = { DB_HOST: 'servico.aivencloud.com' };
    for (const configuracao of [
        { DB_SSL_CA: rootCertificates[0] },
        { DB_SSL_CA_BASE64: Buffer.from(rootCertificates[0]).toString('base64') }
    ]) {
        assert.equal(criarConfiguracaoMysql({ ...host, ...configuracao }).ssl.ca, rootCertificates[0]);
    }
    assert.throws(() => criarConfiguracaoMysql({
        ...host, DB_SSL_CA_FILE: path.join(__dirname, 'ca-inexistente.pem'),
        DB_SSL_CA: rootCertificates[0]
    }), { code: 'ENOENT' });
    assert.throws(() => criarConfiguracaoMysql({ ...host, DB_SSL_CA: 'PEM inválido' }), /certificado/);
});

test('CA Aiven incluída não altera a confiança de outros provedores nem do MySQL local', () => {
    for (const host of ['mysql.exemplo.invalid', 'aivencloud.com.exemplo.invalid', 'aivencloud.com']) {
        const config = criarConfiguracaoMysql({ DB_HOST: host });
        assert.equal(config.ssl.ca, undefined);
        assert.equal(config.ssl.rejectUnauthorized, true);
    }
    assert.equal(criarConfiguracaoMysql({
        DB_HOST: '127.0.0.1', DB_SSL: 'false', NODE_ENV: 'development'
    }).ssl, undefined);
});

// Servidor de protocolo MySQL isolado, sem dados ou credenciais reais. Não
// anuncia SSL: consultas que perderem a opção TLS chegariam a este servidor.
async function iniciarMysqlLocal(t, dadosSessao) {
    const sockets = new Set();
    const consultas = [];
    const servidor = mysql.createServer((conexao) => {
        sockets.add(conexao.stream);
        conexao.stream.once('close', () => sockets.delete(conexao.stream));
        conexao.on('error', () => {}); // Desconexão esperada ao recusar TLS.
        conexao.serverHandshake({
            protocolVersion: 10,
            serverVersion: '8.0.0-teste',
            connectionId: 1,
            characterSet: 45,
            statusFlags: 2,
            // LONG_PASSWORD, PROTOCOL_41, SECURE_CONNECTION e PLUGIN_AUTH.
            capabilityFlags: 0x00000001 | 0x00000200 | 0x00008000 | 0x00080000,
            authCallback(_credenciais, autorizar) {
                autorizar();
                conexao.sequenceId = 0;
            }
        });
        conexao.on('query', (sql) => {
            consultas.push(sql);
            if (sql.startsWith('SELECT')) {
                conexao.writeColumns([
                    { catalog: 'def', schema: '', table: '', orgTable: '', name: 'data', orgName: '', characterSet: 45, columnLength: 1024, columnType: mysql.Types.VAR_STRING, flags: 0, decimals: 0 },
                    { catalog: 'def', schema: '', table: '', orgTable: '', name: 'expires', orgName: '', characterSet: 63, columnLength: 11, columnType: mysql.Types.LONG, flags: 0, decimals: 0 }
                ]);
                conexao.writeTextRow([
                    JSON.stringify(dadosSessao), Math.round(Date.now() / 1000) + 60
                ]);
                conexao.writeEof();
            } else {
                conexao.writeOk({ affectedRows: 1 });
            }
            conexao.sequenceId = 0;
        });
    });
    await new Promise((resolve, reject) => {
        servidor._server.once('error', reject);
        servidor.listen(0, '127.0.0.1', resolve);
    });
    t.after(async () => {
        for (const socket of sockets) socket.destroy();
        await new Promise((resolve) => servidor.close(resolve));
    });
    return {
        consultas,
        port: servidor._server.address().port,
        derrubarConexoes() { for (const socket of sockets) socket.destroy(); }
    };
}

const configuracaoLocal = (porta) => criarConfiguracaoMysql({
    DB_HOST: '127.0.0.1', DB_PORT: porta, DB_SSL: 'false', NODE_ENV: 'test'
});
const contar = (servidor, sql) => servidor.consultas.filter((consulta) => consulta === sql).length;
const esperar = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

test('pool reabre conexões após queda sem repetir consultas', { timeout: 5000 }, async (t) => {
    const servidor = await iniciarMysqlLocal(t, {});
    t.mock.method(console, 'error', () => {});
    const db = criarBancoMysql(configuracaoLocal(servidor.port), { limiteConexoes: 2 });
    t.after(() => db.end());
    await db.promise().query('SELECT primeira');
    servidor.derrubarConexoes();
    await esperar(50);
    await db.promise().query('SELECT nova');
    assert.equal(contar(servidor, 'SELECT primeira'), 1);
    assert.equal(contar(servidor, 'SELECT nova'), 1);
});

test('transação reserva uma conexão exclusiva até commit ou rollback', { timeout: 5000 }, async (t) => {
    const servidor = await iniciarMysqlLocal(t, {});
    const db = criarBancoMysql(configuracaoLocal(servidor.port), { limiteConexoes: 1 });
    t.after(() => db.end());
    const transacao = db.promise();
    await transacao.beginTransaction();
    await transacao.query('UPDATE dentro_da_transacao');
    let concluida = false;
    const outraRequisicao = db.promise().query('UPDATE outra_requisicao').then(() => { concluida = true; });
    await esperar(50);
    assert.equal(concluida, false, 'outra requisição não pode usar a conexão da transação');
    await transacao.commit();
    await outraRequisicao;
    assert.equal(concluida, true);
    assert.deepEqual(
        servidor.consultas.filter((sql) => /TRANSACTION|COMMIT|UPDATE/.test(sql)),
        ['START TRANSACTION', 'UPDATE dentro_da_transacao', 'COMMIT', 'UPDATE outra_requisicao']
    );
    await assert.rejects(transacao.commit(), /Nenhuma transação aberta/);
    await transacao.rollback();
});

test('transação esquecida é revertida e libera a conexão', { timeout: 5000 }, async (t) => {
    const servidor = await iniciarMysqlLocal(t, {});
    t.mock.method(console, 'error', () => {});
    const db = criarBancoMysql(configuracaoLocal(servidor.port), {
        limiteConexoes: 1, tempoMaximoTransacaoMs: 30
    });
    t.after(() => db.end());
    const esquecida = db.promise();
    await esquecida.beginTransaction();
    await esperar(80);
    assert.throws(() => esquecida.query('UPDATE depois_do_prazo'), /tempo máximo/);
    await db.promise().query('SELECT livre');
    assert.ok(servidor.consultas.includes('ROLLBACK'));
    assert.ok(!servidor.consultas.includes('UPDATE depois_do_prazo'));
});

test('flag legada false não permite que o store conecte a MySQL sem TLS', { timeout: 5000 }, async (t) => {
    const servidor = await iniciarMysqlLocal(t, {});
    t.mock.method(console, 'warn', () => {});
    const configuracao = criarConfiguracaoMysql({
        NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_PORT: servidor.port,
        DB_SSL_REJECT_UNAUTHORIZED: 'false'
    });
    const store = criarStoreSessaoMysql(configuracao, { createDatabaseTable: false, clearExpired: false });
    await store.onReady();
    t.after(() => store.close());
    await assert.rejects(store.get('sessao-teste'), { code: 'HANDSHAKE_NO_SSL_SUPPORT' });
    assert.equal(servidor.consultas.length, 0);
});

test('store persiste e lê sessões pelo pool explícito e o fecha junto', { timeout: 5000 }, async (t) => {
    const dados = { userId: 123, cookie: { maxAge: null } };
    const servidor = await iniciarMysqlLocal(t, dados);
    const configuracao = criarConfiguracaoMysql({
        DB_HOST: '127.0.0.1', DB_PORT: servidor.port, DB_SSL: 'false', NODE_ENV: 'test'
    });
    const store = criarStoreSessaoMysql(configuracao, { createDatabaseTable: false, clearExpired: false });
    await store.onReady();
    t.after(() => store.close());
    await store.set('sessao-teste', dados);
    assert.deepEqual(await store.get('sessao-teste'), dados);
    assert.equal(servidor.consultas.length, 2);
    assert.match(servidor.consultas[0], /INSERT INTO `sessions`/);
    assert.ok(servidor.consultas[0].includes(mysql.escape(JSON.stringify(dados))));
    await store.close();
    await assert.rejects(store.connection.query('SELECT 1'), /Pool is closed/);
});
