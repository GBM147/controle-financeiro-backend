'use strict';

// Exercita o SDK @google/genai real, interceptando somente a chamada HTTP.
process.env.GEMINI_API_KEY = 'chave-apenas-para-testes';
process.env.GEMINI_MODEL = 'modelo-de-teste';

const test = require('node:test');
const assert = require('node:assert/strict');

function respostaGemini(texto) {
    return new Response(JSON.stringify({
        candidates: [{ content: { role: 'model', parts: [{ text: texto }] }, finishReason: 'STOP' }]
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

test('parser de PDF pede JSON ao Gemini e lê as transações', async (t) => {
    const chamadas = [];
    t.mock.method(globalThis, 'fetch', async (url, opcoes) => {
        chamadas.push({ url: String(url), corpo: JSON.parse(opcoes.body) });
        return respostaGemini('[{"data":"2026-11-01","descricao":"Mercado Central","valor":42.5,"tipo":"Despesa"}]');
    });
    const { extrairTransacoesDoPdf } = require('../pdf-extrato-parser');
    const resultado = await extrairTransacoesDoPdf('01/11/2026 Mercado Central -42,50');
    assert.deepEqual(resultado.transacoes, [
        { data: '2026-11-01', descricao: 'Mercado Central', valor: 42.5, tipo: 'Despesa' }
    ]);
    assert.equal(chamadas.length, 1);
    assert.match(chamadas[0].url, /modelo-de-teste:generateContent/);
    assert.equal(chamadas[0].corpo.generationConfig.responseMimeType, 'application/json');
    assert.match(JSON.stringify(chamadas[0].corpo.contents), /Mercado Central/);
});

test('falha do Gemini no parser devolve lista vazia sem expor dados', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => new Response('{"error":{"message":"indisponível"}}', { status: 503 }));
    const erros = t.mock.method(console, 'error', () => {});
    const { extrairTransacoesDoPdf } = require('../pdf-extrato-parser');
    const resultado = await extrairTransacoesDoPdf('extrato com dados pessoais');
    assert.deepEqual(resultado.transacoes, []);
    assert.equal(resultado.confianca, 'baixa');
    assert.doesNotMatch(JSON.stringify(erros.mock.calls), /dados pessoais/);
});

test('assistente responde com o texto gerado pelo Gemini', async (t) => {
    t.mock.method(globalThis, 'fetch', async () => respostaGemini('Use o botão Nova conta na página Minhas contas.'));
    const { registrarRotaAssistente } = require('../ia-assistente');
    let manipulador;
    registrarRotaAssistente({ post(caminho, funcao) { manipulador = funcao; } });
    const resposta = {};
    await manipulador(
        { session: { userId: 1 }, body: { pergunta: 'Como faço para organizar várias carteiras diferentes?', pagina: 'contas.html' } },
        { status(codigo) { resposta.status = codigo; return this; }, json(dados) { resposta.dados = dados; return this; } }
    );
    assert.equal(resposta.dados.success, true);
    assert.ok(resposta.dados.resposta.length > 0);
});
