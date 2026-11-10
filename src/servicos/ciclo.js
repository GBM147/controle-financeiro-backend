const { db } = require('../db/banco');

// --- CICLO FINANCEIRO PERSONALIZADO (dia de fechamento do mes) ---
// O usuario escolhe em que dia o "mes financeiro" dele vira (1, 5, 15, 20...).
// Truque: deslocando a data para tras em (dia - 1) dias, o ciclo passa a cair
// exatamente dentro de um mes de calendario, entao todo o SQL continua simples.
const DIA_FECHAMENTO_PADRAO = 1;
function normalizarDiaFechamento(valor) {
    const numero = Number.parseInt(valor, 10);
    if (!Number.isFinite(numero) || numero < 1 || numero > 31) return DIA_FECHAMENTO_PADRAO;
    return numero;
}
function deslocamentoCiclo(diaFechamento) {
    return normalizarDiaFechamento(diaFechamento) - 1;
}
// Expressao SQL que devolve a data "deslocada" para o ciclo do usuario.
function sqlDataCiclo(coluna, diaFechamento) {
    const desloc = deslocamentoCiclo(diaFechamento);
    return desloc === 0 ? coluna : `DATE_SUB(${coluna}, INTERVAL ${desloc} DAY)`;
}
function sqlMesCiclo(coluna, diaFechamento) {
    return `MONTH(${sqlDataCiclo(coluna, diaFechamento)})`;
}
function sqlAnoCiclo(coluna, diaFechamento) {
    return `YEAR(${sqlDataCiclo(coluna, diaFechamento)})`;
}
// Datas reais (inclusive/exclusiva) do ciclo de um mes/ano.
function calcularPeriodoFechamento(mes, ano, diaFechamento) {
    const desloc = deslocamentoCiclo(diaFechamento);
    const mesNum = Number(mes);
    const anoNum = Number(ano);
    const inicio = new Date(Date.UTC(anoNum, mesNum - 1, 1 + desloc));
    const fim = new Date(Date.UTC(anoNum, mesNum, 1 + desloc));
    const iso = (d) => d.toISOString().slice(0, 10);
    return { inicio: iso(inicio), fim: iso(fim) };
}
async function obterDiaFechamento(userId) {
    try {
        const [linhas] = await db.promise().query(
            'SELECT dia_fechamento FROM usuarios WHERE id = ?',
            [userId]
        );
        if (!linhas.length) return DIA_FECHAMENTO_PADRAO;
        return normalizarDiaFechamento(linhas[0].dia_fechamento);
    } catch (erro) {
        return DIA_FECHAMENTO_PADRAO;
    }
}

module.exports = { calcularPeriodoFechamento, deslocamentoCiclo, normalizarDiaFechamento, obterDiaFechamento, sqlAnoCiclo, sqlMesCiclo };
