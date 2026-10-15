'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../public/gbm-chart-depth.js'), 'utf8');

function loadPlugin() {
    const registrations = [];
    const Chart = { register: (plugin) => registrations.push(plugin) };
    const context = vm.createContext({ window: { Chart }, Intl });
    vm.runInContext(source, context);
    return { context, Chart, registrations, plugin: registrations[0] };
}

function canvasContext() {
    let saved = 0;
    let operations = 0;
    const coordinates = [];
    const ctx = {
        save() { saved++; },
        restore() { saved--; assert.ok(saved >= 0); },
        createLinearGradient: () => ({ addColorStop() {} }),
        createRadialGradient: () => ({ addColorStop() {} })
    };
    for (const method of ['beginPath', 'closePath', 'clip', 'fill', 'stroke', 'rect', 'roundRect', 'moveTo', 'lineTo', 'fillRect', 'arc', 'translate']) {
        ctx[method] = (...args) => {
            operations++;
            coordinates.push(...args.filter((value) => typeof value === 'number'));
        };
    }
    return { ctx, saved: () => saved, operations: () => operations, coordinates };
}

function chartFixture(meta, state = canvasContext()) {
    return {
        chart: { ctx: state.ctx, chartArea: { left: 10, top: 10, right: 310, bottom: 210 }, data: { labels: ['Entrada', 'Saída'], datasets: [{ data: [130, -25] }] } },
        args: { index: 0, meta },
        state
    };
}

test('materiais registram uma vez, inclusive se o script for carregado novamente', () => {
    const { context, Chart, registrations } = loadPlugin();
    assert.equal(context.window.GBMChartDepth.register(Chart), true);
    vm.runInContext(source, context);
    assert.equal(registrations.length, 1);
    assert.equal(registrations[0].id, 'gbmDepth');
});

test('barras positivas, negativas e horizontais mantêm seus valores e coordenadas', () => {
    const { plugin } = loadPlugin();
    const meta = { type: 'bar', data: [
        { x: 40, y: 60, base: 160, width: 30, height: 100, options: { backgroundColor: '#39d98a', borderRadius: 6 } },
        { x: 90, y: 195, base: 160, width: 30, height: 35, options: { backgroundColor: '#55a7ff' } },
        { x: 180, y: 80, base: 80, width: 100, height: 20, horizontal: true, options: { backgroundColor: '#39d98a' } },
        { x: 130, y: 160, base: 160, width: 30, height: 0, options: {} }
    ] };
    const { chart, args, state } = chartFixture(meta);
    const original = JSON.stringify({ meta, data: chart.data });
    plugin.beforeDatasetDraw(chart, args, { depth: 8 });
    plugin.afterDatasetDraw(chart, args, { depth: 8 });
    assert.equal(JSON.stringify({ meta, data: chart.data }), original);
    assert.equal(state.saved(), 0);
    assert.ok(state.operations() > 40);
    assert.ok(state.coordinates.every(Number.isFinite));
});

test('anéis, setores completos e raios zerados não geram geometria inválida', () => {
    const { plugin } = loadPlugin();
    const meta = { type: 'doughnut', data: [
        { x: 150, y: 100, startAngle: -Math.PI / 2, endAngle: Math.PI / 2, outerRadius: 70, innerRadius: 48, options: { backgroundColor: '#39d98a', borderWidth: 3 } },
        { x: 150, y: 100, startAngle: Math.PI / 2, endAngle: Math.PI * 1.5, outerRadius: 70, innerRadius: 48, options: { backgroundColor: '#55a7ff', borderWidth: 3 } },
        { x: 150, y: 100, startAngle: 0, endAngle: Math.PI * 2, outerRadius: 0, innerRadius: 0, options: {} }
    ] };
    const { chart, args, state } = chartFixture(meta);
    const original = JSON.stringify(meta);
    plugin.beforeDatasetDraw(chart, args, { depth: 8 });
    plugin.afterDatasetDraw(chart, args, { depth: 8 });
    assert.equal(JSON.stringify(meta), original);
    assert.equal(state.saved(), 0);
    assert.ok(state.coordinates.every(Number.isFinite));
});

test('desativar os materiais mantém o desenho nativo sem operações extras', () => {
    const { plugin } = loadPlugin();
    const { chart, args, state } = chartFixture({ type: 'bar', data: [] });
    plugin.beforeDatasetDraw(chart, args, { enabled: false });
    plugin.afterDatasetDraw(chart, args, { depth: 0 });
    assert.equal(state.operations(), 0);
});

test('rótulo acessível acompanha filtros e preserva descrições próprias', () => {
    const { plugin } = loadPlugin();
    const attributes = new Map();
    const canvas = {
        getAttribute: (key) => attributes.get(key),
        setAttribute: (key, value) => attributes.set(key, value),
        hasAttribute: (key) => attributes.has(key)
    };
    const { chart } = chartFixture({});
    chart.canvas = canvas;
    plugin.afterUpdate(chart);
    assert.equal(attributes.get('role'), 'img');
    assert.match(attributes.get('aria-label'), /Entrada: 130; Saída: -25/);
    chart.data.datasets[0].data = [700, -30];
    plugin.afterUpdate(chart);
    assert.match(attributes.get('aria-label'), /Entrada: 700; Saída: -30/);
    attributes.set('aria-label', 'Comparativo anual personalizado');
    plugin.afterUpdate(chart);
    assert.equal(attributes.get('aria-label'), 'Comparativo anual personalizado');
});

test('uma falha do canvas sempre restaura o contexto gráfico', () => {
    const { plugin } = loadPlugin();
    const state = canvasContext();
    state.ctx.rect = () => { throw new Error('canvas indisponível'); };
    const { chart, args } = chartFixture({ type: 'bar', data: [] }, state);
    assert.throws(() => plugin.beforeDatasetDraw(chart, args, {}), /canvas indisponível/);
    assert.equal(state.saved(), 0);
});
