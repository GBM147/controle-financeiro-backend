const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const {
    calcularPeriodoFechamento,
    obterDiaFechamento,
    sqlAnoCiclo,
    sqlMesCiclo
} = require('../servicos/ciclo');
const { exigirLogin, exigirPremium } = require('../web/autorizacao');

function registrar(app) {
    // --- LÓGICA DE NEGÓCIO EVOLUÍDA: RECEITAS, DESPESAS E METAS ---
    app.get('/resumo-financeiro', exigirLogin, async (req, res) => {
        try {
            const { mes, ano, conta_id } = req.query;
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);
            let sql = `
            SELECT 
                t.categoria, 
                t.tipo,
                t.banco,
                SUM(t.valor) AS total_movimentado, 
                COUNT(t.id) AS qtd_transacoes,
                AVG(t.valor) AS ticket_medio,
                m.valor_limite AS teto_gastos
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            LEFT JOIN metas m ON t.categoria = m.categoria AND m.usuario_id = cb.usuario_id
            WHERE cb.usuario_id = ?
        `;
            const params = [userId];
            if (conta_id && Number(conta_id) > 0) {
                sql += ' AND t.conta_id = ?';
                params.push(Number(conta_id));
            }
            if (mes && mes !== 'todos') {
                const mesesArray = mes.split(',');
                const placeholders = mesesArray.map(() => '?').join(',');
                sql += ` AND ${sqlMesCiclo('t.data_transacao', diaFechamento)} IN (${placeholders})`;
                params.push(...mesesArray);
            }
            if (ano && ano !== 'todos') {
                sql += ` AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?`;
                params.push(ano);
            }
            sql += ` GROUP BY t.categoria, t.tipo, t.banco ORDER BY total_movimentado ASC;`;
            const [rows] = await db.promise().query(sql, params);

            res.json({ status: 'success', data: rows });
        } catch (error) {
            console.error("Erro na lógica de resumo com balanço:", error);
            res.status(500).json({ status: 'error', message: 'Falha ao processar resumo financeiro' });
        }
    });
    // --- NOVA ROTA: ECONOMIA DO MÊS COMPARADA AO MÊS ANTERIOR ---
    app.get('/economia-mensal', exigirLogin, async (req, res) => {
        try {
            const { mes, ano, conta_id } = req.query;
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);
            const mesAtual = parseInt(mes);
            const anoAtual = parseInt(ano);

            let mesAnterior = mesAtual - 1;
            let anoAnterior = anoAtual;
            if (mesAnterior === 0) {
                mesAnterior = 12;
                anoAnterior = anoAtual - 1;
            }

            let sql = `
            SELECT ${sqlMesCiclo('t.data_transacao', diaFechamento)} as mes,
                   ${sqlAnoCiclo('t.data_transacao', diaFechamento)} as ano,
                   SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END) as despesas,
                   SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END) as receitas
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ?
        `;
            const parametros = [userId];
            if (conta_id && Number(conta_id) > 0) {
                sql += ' AND t.conta_id = ?';
                parametros.push(Number(conta_id));
            }
            sql += `
              AND ((${sqlMesCiclo('t.data_transacao', diaFechamento)} = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?)
                OR (${sqlMesCiclo('t.data_transacao', diaFechamento)} = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?))
            GROUP BY ${sqlAnoCiclo('t.data_transacao', diaFechamento)}, ${sqlMesCiclo('t.data_transacao', diaFechamento)}
        `;
            parametros.push(mesAtual, anoAtual, mesAnterior, anoAnterior);
            const [rows] = await db.promise().query(sql, parametros);

            const atual = rows.find(r => r.mes === mesAtual && r.ano === anoAtual) || { despesas: 0, receitas: 0 };
            const anterior = rows.find(r => r.mes === mesAnterior && r.ano === anoAnterior);

            const despesaAtual = parseFloat(atual.despesas) || 0;
            const despesaAnterior = anterior ? (parseFloat(anterior.despesas) || 0) : null;

            const economia = despesaAnterior !== null ? (despesaAnterior - despesaAtual) : null;
            const percentual = (despesaAnterior && despesaAnterior > 0) ? (economia / despesaAnterior) * 100 : null;

            const receitaAtual = parseFloat(atual.receitas) || 0;
            const receitaAnterior = anterior ? (parseFloat(anterior.receitas) || 0) : null;
            const percentualReceita = (receitaAnterior && receitaAnterior > 0)
                ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100
                : null;

            res.json({
                despesaAtual,
                despesaAnterior,
                economia,
                percentual,
                receitaAtual,
                receitaAnterior,
                percentualReceita,
                temMesAnterior: !!anterior
            });
        } catch (error) {
            console.error('Erro ao calcular economia mensal:', error);
            res.status(500).json({ error: 'Falha ao calcular economia mensal.' });
        }
    });
    // --- NOVA ROTA: SÉRIE DIÁRIA ACUMULADA DO CICLO (alimenta o mini-gráfico do dashboard) ---
    app.get('/resumo-diario', exigirLogin, async (req, res) => {
        try {
            const { mes, ano, conta_id } = req.query;
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);
            const { inicio, fim } = calcularPeriodoFechamento(mes, ano, diaFechamento);

            let sql = `
            SELECT
                t.data_transacao AS data,
                SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END) AS entradas,
                SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END) AS saidas
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ?
              AND t.data_transacao >= ?
              AND t.data_transacao < ?
        `;
            const params = [userId, inicio, fim];
            if (conta_id && Number(conta_id) > 0) {
                sql += ' AND t.conta_id = ?';
                params.push(Number(conta_id));
            }
            sql += ' GROUP BY t.data_transacao ORDER BY t.data_transacao ASC';
            const [linhas] = await db.promise().query(sql, params);

            // A série vai do início do ciclo até hoje (ou até o fim do ciclo, se o ciclo já acabou)
            const hojeIso = new Date().toISOString().slice(0, 10);
            const ultimoDiaCiclo = new Date(new Date(`${fim}T00:00:00Z`).getTime() - 86400000).toISOString().slice(0, 10);
            const dataFinalSerie = hojeIso < ultimoDiaCiclo ? hojeIso : ultimoDiaCiclo;

            const porData = new Map(linhas.map((linha) => [
                new Date(linha.data).toISOString().slice(0, 10),
                { entradas: Number(linha.entradas) || 0, saidas: Number(linha.saidas) || 0 }
            ]));

            const serie = [];
            let acumulado = 0;
            const cursor = new Date(`${inicio}T00:00:00Z`);
            const limite = new Date(`${dataFinalSerie}T00:00:00Z`);
            while (cursor <= limite) {
                const chave = cursor.toISOString().slice(0, 10);
                const dia = porData.get(chave) || { entradas: 0, saidas: 0 };
                acumulado += dia.entradas - dia.saidas;
                serie.push({ data: chave, resultado_acumulado: Number(acumulado.toFixed(2)) });
                cursor.setUTCDate(cursor.getUTCDate() + 1);
            }

            res.json({ inicio, fim: dataFinalSerie, serie });
        } catch (error) {
            console.error('Erro ao gerar resumo diário:', error);
            res.status(500).json({ error: 'Falha ao gerar o resumo diário.' });
        }
    });
    // --- NOVA ROTA: COMPARATIVO DE TODOS OS MESES DE UM ANO ---
    app.get('/comparativo-mensal', exigirLogin, exigirPremium, async (req, res) => {
        try {
            const { ano } = req.query;
            const userId = req.session.userId;
            const anoConsulta = ano || new Date().getFullYear();
            const diaFechamento = await obterDiaFechamento(userId);

            const sql = `
            SELECT ${sqlMesCiclo('t.data_transacao', diaFechamento)} as mes,
                   SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END) as entradas,
                   SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END) as saidas
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?
            GROUP BY ${sqlMesCiclo('t.data_transacao', diaFechamento)}
            ORDER BY mes ASC
        `;
            const [rows] = await db.promise().query(sql, [userId, anoConsulta]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao gerar comparativo mensal:', error);
            res.status(500).json({ error: 'Falha ao gerar comparativo mensal.' });
        }
    });
    // --- NOVA ROTA: ANOS QUE O USUÁRIO TEM DADOS (pra popular o seletor) ---
    app.get('/anos-disponiveis', exigirLogin, exigirPremium, async (req, res) => {
        try {
            const userId = req.session.userId;
            const [rows] = await db.promise().query(
                `SELECT DISTINCT ${sqlAnoCiclo('t.data_transacao', await obterDiaFechamento(userId))} as ano
             FROM transacoes t
             JOIN contas_bancarias cb ON t.conta_id = cb.id
             WHERE cb.usuario_id = ?
             ORDER BY ano DESC`,
                [userId]
            );
            res.json(rows.map(r => r.ano));
        } catch (error) {
            console.error('Erro ao buscar anos disponíveis:', error);
            res.status(500).json({ error: 'Falha ao buscar anos.' });
        }
    });
    app.get('/relatorio-mensal', exigirLogin, exigirPremium, async (req, res) => {
        try {
            const { mes, ano } = req.query;
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);
            const sql = `
            SELECT t.categoria, t.tipo, IFNULL(SUM(t.valor), 0) as total_movimentado
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND ${sqlMesCiclo('t.data_transacao', diaFechamento)} = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?
            GROUP BY t.categoria, t.tipo
        `;
            const [rows] = await db.promise().query(sql, [userId, mes, ano]);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao gerar relatório mensal:', error);
            res.status(500).json({ error: 'Falha ao gerar relatório mensal.' });
        }
    });
    // --- ROTA: RELATÓRIO DETALHADO (transações individuais para editar categoria) ---
    app.get('/relatorio-detalhado', exigirLogin, exigirPremium, async (req, res) => {
        try {
            const { mes, ano, banco } = req.query;
            const userId = req.session.userId;
            const diaFechamento = await obterDiaFechamento(userId);

            let sql = `
            SELECT t.id, t.descricao, t.valor, t.tipo, t.categoria, t.data_transacao, t.banco
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            WHERE cb.usuario_id = ? AND ${sqlMesCiclo('t.data_transacao', diaFechamento)} = ? AND ${sqlAnoCiclo('t.data_transacao', diaFechamento)} = ?
        `;
            const params = [userId, mes, ano];

            if (banco && banco !== 'todos') {
                sql += ' AND t.banco = ?';
                params.push(banco);
            }

            sql += ' ORDER BY t.data_transacao DESC';

            const [rows] = await db.promise().query(sql, params);
            res.json(rows);
        } catch (error) {
            console.error('Erro ao gerar relatório detalhado:', error);
            res.status(500).json({ error: 'Falha ao gerar relatório detalhado.' });
        }
    });
    app.get('/calendario-financeiro', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const hoje = new Date();
            const ano = Number(req.query.ano) || hoje.getFullYear();
            const mes = Number(req.query.mes) || hoje.getMonth() + 1;
            if (mes < 1 || mes > 12 || ano < 2000 || ano > 2200) {
                return res.status(400).json({ success: false, error: 'Período inválido.' });
            }
            const inicio = `${ano}-${String(mes).padStart(2, '0')}-01`;
            const ultimoDia = new Date(ano, mes, 0).getDate();
            const fim = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDia).padStart(2, '0')}`;

            const [realizadas] = await db.promise().query(`
            SELECT
                t.id,
                t.descricao,
                t.valor,
                t.tipo,
                t.categoria,
                t.data_transacao AS data,
                t.recorrencia_id,
                'realizada' AS status
            FROM transacoes t
            JOIN contas_bancarias cb ON cb.id = t.conta_id
            WHERE cb.usuario_id = ?
              AND t.data_transacao BETWEEN ? AND ?
            ORDER BY t.data_transacao, t.id
        `, [req.session.userId, inicio, fim]);

            const [recorrencias] = await db.promise().query(`
            SELECT r.*
            FROM transacoes_recorrentes r
            WHERE r.usuario_id = ?
              AND r.ativa = 1
              AND r.data_inicio <= ?
              AND (r.data_fim IS NULL OR r.data_fim >= ?)
        `, [req.session.userId, fim, inicio]);

            const idsRealizados = new Set(
                realizadas
                    .filter((item) => item.recorrencia_id)
                    .map((item) => Number(item.recorrencia_id))
            );
            const planejadas = recorrencias
                .filter((item) => !idsRealizados.has(Number(item.id)))
                .map((item) => {
                    const dia = Math.min(Number(item.dia_mes), ultimoDia);
                    return {
                        id: `r-${item.id}`,
                        descricao: item.descricao,
                        valor: Number(item.valor),
                        tipo: item.tipo,
                        categoria: item.categoria,
                        data: `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
                        status: 'prevista'
                    };
                });
            const eventos = [...realizadas, ...planejadas].sort((a, b) => String(a.data).localeCompare(String(b.data)));
            const [[saldo]] = await db.promise().query(
                'SELECT COALESCE(SUM(saldo), 0) AS total FROM contas_bancarias WHERE usuario_id = ? AND ativa = 1',
                [req.session.userId]
            );
            const futuros = planejadas.reduce((acumulado, item) => (
                acumulado + (item.tipo === 'Receita' ? Number(item.valor) : -Number(item.valor))
            ), 0);
            res.json({
                eventos,
                saldo_atual: Number(saldo.total),
                saldo_previsto: Number(saldo.total) + futuros
            });
        } catch (erro) {
            console.error('Erro no calendário financeiro:', erro);
            res.status(500).json({ success: false, error: 'Falha ao montar o calendário.' });
        }
    });
    // =======================================================
    // --- INSIGHTS FINANCEIROS COMPACTOS ---
    // =======================================================
    app.get('/insights', exigirLogin, async (req, res) => {
        try {
            const usuarioId = req.session.userId;
            const contaId = Number(req.query.conta_id || 0);
            const [categorias] = await db.promise().query(`
            SELECT
                atual.categoria,
                atual.total_atual,
                COALESCE(anterior.total_anterior, 0) AS total_anterior
            FROM (
                SELECT t.categoria, SUM(ABS(t.valor)) AS total_atual
                FROM transacoes t
                JOIN contas_bancarias cb ON cb.id = t.conta_id
                WHERE cb.usuario_id = ?
                  AND (? = 0 OR t.conta_id = ?)
                  AND t.tipo = 'Despesa'
                  AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
                  AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
                GROUP BY t.categoria
            ) atual
            LEFT JOIN (
                SELECT t.categoria, SUM(ABS(t.valor)) AS total_anterior
                FROM transacoes t
                JOIN contas_bancarias cb ON cb.id = t.conta_id
                WHERE cb.usuario_id = ?
                  AND (? = 0 OR t.conta_id = ?)
                  AND t.tipo = 'Despesa'
                  AND t.data_transacao >= DATE_FORMAT(CURRENT_DATE() - INTERVAL 1 MONTH, '%Y-%m-01')
                  AND t.data_transacao < DATE_FORMAT(CURRENT_DATE(), '%Y-%m-01')
                GROUP BY t.categoria
            ) anterior ON anterior.categoria = atual.categoria
            ORDER BY atual.total_atual DESC
            LIMIT 8
        `, [usuarioId, contaId, contaId, usuarioId, contaId, contaId]);
            const insights = [];
            for (const item of categorias) {
                const atual = Number(item.total_atual);
                const anterior = Number(item.total_anterior);
                if (anterior > 0) {
                    const variacao = ((atual - anterior) / anterior) * 100;
                    if (variacao >= 15) {
                        insights.push({
                            tipo: 'aumento',
                            titulo: `${item.categoria} subiu ${variacao.toFixed(0)}%`,
                            texto: `R$ ${atual.toFixed(2)} neste mês contra R$ ${anterior.toFixed(2)} no mês anterior.`
                        });
                    }
                }
            }
            const [[resumo]] = await db.promise().query(`
            SELECT
                COALESCE(SUM(CASE WHEN t.tipo = 'Receita' THEN t.valor ELSE 0 END), 0) AS receitas,
                COALESCE(SUM(CASE WHEN t.tipo = 'Despesa' THEN t.valor ELSE 0 END), 0) AS despesas
            FROM transacoes t
            JOIN contas_bancarias cb ON cb.id = t.conta_id
            WHERE cb.usuario_id = ?
              AND (? = 0 OR t.conta_id = ?)
              AND MONTH(t.data_transacao) = MONTH(CURRENT_DATE())
              AND YEAR(t.data_transacao) = YEAR(CURRENT_DATE())
        `, [usuarioId, contaId, contaId]);
            const resultado = Number(resumo.receitas) - Number(resumo.despesas);
            insights.unshift({
                tipo: resultado >= 0 ? 'positivo' : 'atencao',
                titulo: resultado >= 0 ? 'Mês no positivo' : 'Despesas acima das receitas',
                texto: `Resultado atual de R$ ${resultado.toFixed(2)}.`
            });
            res.json(insights.slice(0, 4));
        } catch (erro) {
            console.error('Erro ao gerar insights:', erro);
            res.status(500).json({ success: false, error: 'Falha ao gerar insights.' });
        }
    });
    // =======================================================
    // --- RELATÓRIO AVANÇADO PREMIUM ---
    // =======================================================
    app.get('/relatorio-avancado', exigirLogin, exigirPremium, async (req, res) => {
        try {
            const hoje = new Date();
            const dataFim = /^\d{4}-\d{2}-\d{2}$/.test(req.query.data_fim || '')
                ? req.query.data_fim
                : hoje.toISOString().slice(0, 10);
            const inicioPadrao = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
            const dataInicio = /^\d{4}-\d{2}-\d{2}$/.test(req.query.data_inicio || '')
                ? req.query.data_inicio
                : inicioPadrao;
            if (dataInicio > dataFim) {
                return res.status(400).json({ success: false, error: 'A data inicial deve ser anterior à final.' });
            }

            const filtros = ['cb.usuario_id = ?', 't.data_transacao BETWEEN ? AND ?'];
            const valores = [req.session.userId, dataInicio, dataFim];
            if (req.query.conta_id && req.query.conta_id !== 'todas') {
                filtros.push('cb.id = ?');
                valores.push(Number(req.query.conta_id));
            }
            if (req.query.categoria && req.query.categoria !== 'todas') {
                filtros.push('t.categoria = ?');
                valores.push(String(req.query.categoria));
            }
            if (['Receita', 'Despesa'].includes(req.query.tipo)) {
                filtros.push('t.tipo = ?');
                valores.push(req.query.tipo);
            }

            const [transacoes] = await db.promise().query(`
            SELECT
                t.id,
                t.data_transacao,
                t.descricao,
                t.categoria,
                t.tipo,
                t.valor,
                t.banco,
                cb.id AS conta_id,
                COALESCE(NULLIF(cb.nome_personalizado, ''), NULLIF(cb.banco, ''), CONCAT('Conta ', cb.id)) AS conta
            FROM transacoes t
            JOIN contas_bancarias cb ON cb.id = t.conta_id
            WHERE ${filtros.join(' AND ')}
            ORDER BY t.data_transacao DESC, t.id DESC
            LIMIT 10000
        `, valores);

            const resumo = transacoes.reduce((acumulado, item) => {
                const valor = Number(item.valor);
                if (item.tipo === 'Receita') acumulado.receitas += valor;
                else acumulado.despesas += valor;
                acumulado.por_categoria[item.categoria] =
                    (acumulado.por_categoria[item.categoria] || 0)
                    + (item.tipo === 'Despesa' ? valor : 0);
                return acumulado;
            }, { receitas: 0, despesas: 0, por_categoria: {} });
            resumo.resultado = resumo.receitas - resumo.despesas;

            res.json({ data_inicio: dataInicio, data_fim: dataFim, resumo, transacoes });
        } catch (erro) {
            console.error('Erro no relatório avançado:', erro);
            res.status(500).json({ success: false, error: 'Falha ao gerar o relatório.' });
        }
    });
}

module.exports = { registrar };
