'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseMoney, calculateBudget, calculateReserve } = require('../public/public-calculators.js');

test('valores monetários aceitam formato brasileiro sem confundir milhares com centavos', () => {
    assert.equal(parseMoney('3.500,50'), 3500.5);
    assert.equal(parseMoney('3.500'), 3500);
    assert.equal(parseMoney('3500,50'), 3500.5);
    assert.equal(parseMoney('0,01'), 0.01);
    assert.equal(parseMoney(' 3500 '), 3500);
    assert.equal(parseMoney('3500.50'), 3500.5);
    assert.equal(parseMoney('1.234.567,89'), 1234567.89);
});

test('entrada monetária rejeita vazio, negativos, notação científica e formatos ambíguos', () => {
    ['', '   ', '-1', '1e3', 'NaN', 'Infinity', '1,234.56', '12.34.567', '0,001', 'R$ 100', '1000000000'].forEach(value => {
        assert.throws(() => parseMoney(value), { name: 'RangeError' }, value);
    });
    assert.throws(() => parseMoney(500), { name: 'TypeError' });
});

test('orçamento calcula saldo e participação sobre renda com centavos exatos', () => {
    const result = calculateBudget({ income: 3500, essential: 1800, other: 500, debt: 400, saving: 300 });
    assert.equal(result.allocated, 3000);
    assert.equal(result.balance, 500);
    assert.equal(result.state, 'surplus');
    assert.equal(result.shares.essential, 1800 / 3500 * 100);
    const cents = calculateBudget({ income: 0.3, essential: 0.1, other: 0.2, debt: 0, saving: 0 });
    assert.equal(cents.balance, 0);
    assert.equal(cents.state, 'balanced');
});

test('orçamento deficitário não oculta gastos que ultrapassam a renda', () => {
    const result = calculateBudget({ income: 1000, essential: 1200, other: 100, debt: 200, saving: 0 });
    assert.equal(result.balance, -500);
    assert.equal(result.state, 'deficit');
    assert.equal(result.allocatedShare, 150);
    assert.equal(result.shares.essential, 120);
});

test('renda zero mantém saldo e informa participações não calculáveis', () => {
    const result = calculateBudget({ income: 0, essential: 100, other: 0, debt: 0, saving: 0 });
    assert.equal(result.balance, -100);
    assert.deepEqual(result.shares, { essential: null, other: null, debt: null, saving: null });
    assert.equal(result.allocatedShare, null);
    assert.equal(calculateBudget({ income: 0, essential: 0, other: 0, debt: 0, saving: 0 }).state, 'balanced');
});

test('funções de orçamento rejeitam valores inválidos mesmo fora do formulário', () => {
    const valid = { income: 1000, essential: 500, other: 0, debt: 0, saving: 0 };
    [-1, NaN, Infinity, '500', 0.001, 1000000000].forEach(value => {
        assert.throws(() => calculateBudget({ ...valid, essential: value }), { name: 'RangeError' });
    });
});

test('reserva usa despesas essenciais, abate o saldo e arredonda prazo para cima', () => {
    const result = calculateReserve({ essential: 1800, horizon: 6, saved: 2800, contribution: 500 });
    assert.deepEqual(result, { target: 10800, remaining: 8000, surplus: 0, months: 16, state: 'in-progress' });
    assert.equal(calculateReserve({ essential: 1000, horizon: 3, saved: 1, contribution: 1000 }).months, 3);
    assert.equal(calculateReserve({ essential: 0.01, horizon: 3, saved: 0.02, contribution: 0.01 }).months, 1);
});

test('reserva já alcançada ou excedida informa prazo zero e falta zero', () => {
    const exact = calculateReserve({ essential: 1000, horizon: 3, saved: 3000, contribution: 0 });
    assert.equal(exact.months, 0);
    assert.equal(exact.remaining, 0);
    assert.equal(exact.state, 'reached');
    const exceeded = calculateReserve({ essential: 1000, horizon: 3, saved: 3500, contribution: 100 });
    assert.equal(exceeded.surplus, 500);
    assert.equal(exceeded.months, 0);
});

test('reserva sem aporte não inventa prazo; despesas zero produzem meta zero', () => {
    const noContribution = calculateReserve({ essential: 1500, horizon: 6, saved: 0, contribution: 0 });
    assert.equal(noContribution.months, null);
    assert.equal(noContribution.state, 'no-contribution');
    assert.equal(calculateReserve({ essential: 0, horizon: 6, saved: 0, contribution: 0 }).target, 0);
});

test('reserva rejeita horizonte não suportado e valores negativos', () => {
    [0, 1, 5, 6.5, '6', NaN].forEach(horizon => {
        assert.throws(() => calculateReserve({ essential: 1000, horizon, saved: 0, contribution: 100 }), { name: 'RangeError' });
    });
    assert.throws(() => calculateReserve({ essential: 1000, horizon: 6, saved: -1, contribution: 100 }), { name: 'RangeError' });
});
