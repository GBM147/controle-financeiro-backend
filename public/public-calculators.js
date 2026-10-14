(function (root, factory) {
    'use strict';
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.GBMCalculators = api;
        const start = function () { api.init(document); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
        else start();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const MAX_VALUE = 999999999.99;
    const HORIZONS = [3, 6, 9, 12];

    function toCents(value, name) {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > MAX_VALUE) {
            throw new RangeError((name || 'Valor') + ': informe um valor entre zero e R$ 999.999.999,99.');
        }
        const cents = Math.round(value * 100);
        if (Math.abs(value * 100 - cents) > 0.00001) {
            throw new RangeError((name || 'Valor') + ': use no máximo duas casas decimais.');
        }
        return cents;
    }

    // Aceita o formato brasileiro, com ou sem separadores de milhar.
    // Um ponto isolado com uma ou duas casas também é aceito como decimal.
    function parseMoney(raw) {
        if (typeof raw !== 'string') throw new TypeError('Informe um valor em reais.');
        const value = raw.trim();
        if (!value) throw new RangeError('Preencha este campo. Use 0 se não houver valor.');
        if (value.startsWith('-')) throw new RangeError('O valor não pode ser negativo.');
        let normalized;
        if (/^\d+(?:,\d{1,2})?$/.test(value)) {
            normalized = value.replace(',', '.');
        } else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) {
            normalized = value.replace(/\./g, '').replace(',', '.');
        } else if (/^\d+\.\d{1,2}$/.test(value)) {
            normalized = value;
        } else {
            throw new RangeError('Use um valor como 1500,50 ou 1.500,50, com até duas casas decimais.');
        }
        const number = Number(normalized);
        toCents(number);
        return number;
    }

    function calculateBudget(values) {
        const income = toCents(values.income, 'Renda líquida');
        const essential = toCents(values.essential, 'Despesas essenciais');
        const other = toCents(values.other, 'Outras despesas');
        const debt = toCents(values.debt, 'Parcelas de dívidas');
        const saving = toCents(values.saving, 'Aportes planejados');
        const allocated = essential + other + debt + saving;
        const difference = income - allocated;
        const share = function (value) { return income === 0 ? null : value / income * 100; };
        return {
            income: income / 100,
            allocated: allocated / 100,
            balance: difference / 100,
            state: difference > 0 ? 'surplus' : difference < 0 ? 'deficit' : 'balanced',
            shares: { essential: share(essential), other: share(other), debt: share(debt), saving: share(saving) },
            allocatedShare: share(allocated)
        };
    }

    function calculateReserve(values) {
        const essential = toCents(values.essential, 'Despesas essenciais');
        const saved = toCents(values.saved, 'Valor já guardado');
        const contribution = toCents(values.contribution, 'Aporte mensal');
        if (!HORIZONS.includes(values.horizon)) throw new RangeError('Escolha um horizonte de 3, 6, 9 ou 12 meses.');
        const target = essential * values.horizon;
        const remaining = Math.max(0, target - saved);
        return {
            target: target / 100,
            remaining: remaining / 100,
            surplus: Math.max(0, saved - target) / 100,
            months: remaining === 0 ? 0 : contribution === 0 ? null : Math.ceil(remaining / contribution),
            state: remaining === 0 ? 'reached' : contribution === 0 ? 'no-contribution' : 'in-progress'
        };
    }

    function init(doc) {
        if (!doc || !doc.querySelectorAll) return;
        const currency = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
        const percent = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
        const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });

        doc.querySelectorAll('form[data-calculator]').forEach(function (form) {
            const result = doc.getElementById(form.dataset.result);
            const status = form.querySelector('[data-form-status]');
            const fields = Array.from(form.querySelectorAll('[data-money]'));

            function write(key, value) {
                const element = result.querySelector('[data-result="' + key + '"]');
                if (element) element.textContent = value;
            }

            function clearError(field) {
                field.removeAttribute('aria-invalid');
                const error = doc.getElementById(field.id + '-error');
                if (error) { error.hidden = true; error.textContent = ''; }
            }

            fields.forEach(function (field) {
                field.addEventListener('input', function () {
                    clearError(field);
                    result.hidden = true;
                    status.textContent = 'Valores alterados. Clique em Calcular para atualizar o resultado.';
                });
            });
            form.querySelectorAll('select').forEach(function (field) {
                field.addEventListener('change', function () {
                    result.hidden = true;
                    status.textContent = 'Horizonte alterado. Clique em Calcular para atualizar o resultado.';
                });
            });

            form.addEventListener('reset', function () {
                fields.forEach(clearError);
                result.hidden = true;
                status.textContent = 'Campos restaurados. Nenhum cálculo está salvo.';
            });

            form.addEventListener('submit', function (event) {
                event.preventDefault();
                result.hidden = true;
                const values = {};
                let firstInvalid;
                fields.forEach(function (field) {
                    clearError(field);
                    try {
                        // Sem atributo name, uma submissão nativa sem JavaScript
                        // também não pode enviar os valores digitados ao servidor.
                        values[field.id] = parseMoney(field.value);
                    } catch (error) {
                        field.setAttribute('aria-invalid', 'true');
                        const message = doc.getElementById(field.id + '-error');
                        if (message) { message.textContent = error.message; message.hidden = false; }
                        if (!firstInvalid) firstInvalid = field;
                    }
                });
                if (firstInvalid) {
                    status.textContent = 'Confira os campos indicados antes de calcular.';
                    firstInvalid.focus();
                    return;
                }

                try {
                    if (form.dataset.calculator === 'budget') {
                        const budget = calculateBudget(values);
                        result.dataset.state = budget.state;
                        write('headline', budget.state === 'surplus' ? 'Sobra planejada no mês' : budget.state === 'deficit' ? 'Falta no orçamento do mês' : 'Orçamento equilibrado');
                        write('balance', currency.format(Math.abs(budget.balance)));
                        write('income', currency.format(budget.income));
                        write('allocated', currency.format(budget.allocated));
                        write('description', budget.state === 'surplus'
                            ? 'Depois das despesas, parcelas e aportes informados, este valor ainda está disponível. Confira também gastos anuais e imprevistos antes de assumir novos compromissos.'
                            : budget.state === 'deficit'
                                ? 'Os compromissos informados ultrapassam a renda neste valor. Revise os números e procure ajustes possíveis nas despesas, nos aportes ou na negociação das dívidas.'
                                : 'Os valores informados usam toda a renda. Não há margem planejada para uma despesa extra; confira se faltou alguma conta.');
                        ['essential', 'other', 'debt', 'saving'].forEach(function (key) {
                            write(key + '-value', currency.format(values[key]));
                            write(key + '-share', budget.shares[key] === null ? 'Não calculável' : percent.format(budget.shares[key]) + '%');
                        });
                        write('share-note', budget.income === 0
                            ? 'Com renda igual a zero, percentuais da renda não podem ser calculados. Os valores e o saldo continuam válidos.'
                            : 'As parcelas acima usam a renda líquida como base. Elas podem somar mais de 100% quando há falta no orçamento.');
                    } else if (form.dataset.calculator === 'reserve') {
                        values.horizon = Number(form.elements.horizon.value);
                        const reserve = calculateReserve(values);
                        result.dataset.state = reserve.state;
                        write('target', currency.format(reserve.target));
                        write('remaining', currency.format(reserve.remaining));
                        write('months', reserve.months === null ? 'Sem prazo calculável' : reserve.months === 0 ? 'Meta já alcançada' : integer.format(reserve.months) + (reserve.months === 1 ? ' mês' : ' meses'));
                        write('description', reserve.target === 0
                            ? 'A meta informada é zero porque as despesas essenciais são zero. Confira se moradia, alimentação, saúde e contas obrigatórias foram incluídas antes de usar este resultado.'
                            : reserve.state === 'reached'
                                ? 'O valor guardado cobre a meta escolhida.' + (reserve.surplus > 0 ? ' Há ' + currency.format(reserve.surplus) + ' além dessa meta.' : '') + ' Reavalie a meta se suas despesas ou sua situação mudarem.'
                                : reserve.state === 'no-contribution'
                                    ? 'Com aporte mensal igual a zero, não há prazo para alcançar a meta. Escolha um aporte viável, sem comprometer despesas essenciais.'
                                    : 'Com aportes de ' + currency.format(values.contribution) + ' ao fim de cada mês, a meta será alcançada no mês indicado. O cálculo não inclui rendimentos, inflação ou retiradas.');
                    }
                    result.hidden = false;
                    status.textContent = 'Cálculo concluído. O resultado aparece logo abaixo do formulário.';
                } catch (error) {
                    status.textContent = error.message;
                }
            });
            const submit = form.querySelector('button[type="submit"]');
            if (submit) submit.disabled = false;
        });
    }

    return { parseMoney: parseMoney, calculateBudget: calculateBudget, calculateReserve: calculateReserve, init: init };
}));
