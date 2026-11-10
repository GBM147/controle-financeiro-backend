const { resend } = require('../config/clientes');
const { db } = require('../db/banco');
const { garantirEstruturaAlertasMultiplos } = require('../db/migracoes');
const { deslocamentoCiclo } = require('./ciclo');
const { revelarIdentidade } = require('./identidade');

// =======================================================
// --- MÓDULO DE NOTIFICAÇÕES E AUDITORIA DE METAS ---
// =======================================================
function estaNoHorarioSilencioso(inicio, fim) {
    if (!inicio || !fim) return false;
    const agora = new Intl.DateTimeFormat('pt-BR', {
        timeZone: 'America/Sao_Paulo',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(new Date());
    const comeco = String(inicio).slice(0, 5);
    const termino = String(fim).slice(0, 5);
    return comeco <= termino
        ? agora >= comeco && agora <= termino
        : agora >= comeco || agora <= termino;
}
// Sem usuário, audita todas as contas (tarefa diária); com usuário, só a dele.
async function auditarMetas(usuarioId = null) {
    try {
        await garantirEstruturaAlertasMultiplos();
        const [prefs] = await db.promise().query('SELECT percentual_alerta FROM preferencias_notificacao WHERE id = 1');
        const percentualAlertaGlobal = prefs.length > 0 ? prefs[0].percentual_alerta : 80;

        // Agora o gasto é calculado POR USUÁRIO (via a conta bancária a que a transação pertence),
        // não somado entre todos os usuários que têm a mesma categoria.
        const sql = `
            SELECT
                cb.usuario_id,
                t.categoria,
                SUM(t.valor) AS total_gasto,
                m.valor_limite,
                COALESCE(map.percentual, m.percentual_alerta, ?) AS percentual_categoria,
                COALESCE(u.dia_fechamento, 1) AS dia_fechamento
            FROM transacoes t
            JOIN contas_bancarias cb ON t.conta_id = cb.id
            JOIN metas m ON t.categoria = m.categoria AND m.usuario_id = cb.usuario_id
            JOIN usuarios u ON u.id = cb.usuario_id
            LEFT JOIN metas_alertas_percentuais map
              ON map.usuario_id = m.usuario_id
             AND map.categoria = m.categoria
            WHERE t.tipo = 'Despesa'
              AND MONTH(DATE_SUB(t.data_transacao, INTERVAL (COALESCE(u.dia_fechamento, 1) - 1) DAY))
                  = MONTH(DATE_SUB(CURRENT_DATE(), INTERVAL (COALESCE(u.dia_fechamento, 1) - 1) DAY))
              AND YEAR(DATE_SUB(t.data_transacao, INTERVAL (COALESCE(u.dia_fechamento, 1) - 1) DAY))
                  = YEAR(DATE_SUB(CURRENT_DATE(), INTERVAL (COALESCE(u.dia_fechamento, 1) - 1) DAY))
              ${usuarioId ? 'AND cb.usuario_id = ?' : ''}
            GROUP BY cb.usuario_id, t.categoria, m.valor_limite, m.percentual_alerta, map.percentual, u.dia_fechamento
        `;
        const parametros = usuarioId ? [percentualAlertaGlobal, usuarioId] : [percentualAlertaGlobal];
        const [gastos] = await db.promise().query(sql, parametros);

        for (const item of gastos) {
            const gastoAbs = Math.abs(item.total_gasto);
            const limite = parseFloat(item.valor_limite);
            const percentualAlerta = Number(item.percentual_categoria);
            const porcentagemAtual = (gastoAbs / limite) * 100;

            if (porcentagemAtual >= percentualAlerta) {
                // A chave única garante que cada faixa (50%, 70% etc.) seja
                // disparada somente uma vez por categoria em cada mês.
                const [registroDisparo] = await db.promise().query(
                    `INSERT IGNORE INTO metas_alertas_disparos
                        (usuario_id, categoria, percentual, ano_mes)
                     VALUES (?, ?, ?, DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY), '%Y-%m'))`,
                    [item.usuario_id, item.categoria, percentualAlerta, deslocamentoCiclo(item.dia_fechamento)]
                );

                if (registroDisparo.affectedRows === 1) {
                    const msg = `Atenção: você ultrapassou o aviso de ${percentualAlerta}% e já atingiu ${porcentagemAtual.toFixed(1)}% do limite de R$ ${limite.toFixed(2)} na categoria ${item.categoria}.`;
                    const [usuarios] = await db.promise().query(
                        `SELECT
                            u.email,
                            u.nome,
                            u.email_criptografado,
                            u.nome_criptografado,
                            COALESCE(p.notificacao_site, 1) AS notificacao_site,
                            COALESCE(p.notificacao_email, 1) AS notificacao_email,
                            p.horario_silencio_inicio,
                            p.horario_silencio_fim
                         FROM usuarios u
                         LEFT JOIN preferencias_notificacao_usuario p ON p.usuario_id = u.id
                         WHERE u.id = ?`,
                        [item.usuario_id]
                    );
                    const usuario = revelarIdentidade(usuarios[0]);

                    try {
                        if (!usuario || Number(usuario.notificacao_site) === 1) {
                            await db.promise().query(
                                `INSERT INTO alertas (usuario_id, categoria, mensagem, tipo)
                                 VALUES (?, ?, ?, 'limite')`,
                                [item.usuario_id, item.categoria, msg]
                            );
                        }
                    } catch (erroAlerta) {
                        // Se não foi possível criar a notificação, libera a faixa
                        // para uma nova tentativa na próxima auditoria.
                        await db.promise().query(
                            `DELETE FROM metas_alertas_disparos
                             WHERE usuario_id = ?
                               AND categoria = ?
                               AND percentual = ?
                               AND ano_mes = DATE_FORMAT(DATE_SUB(CURRENT_DATE(), INTERVAL ? DAY), '%Y-%m')`,
                            [item.usuario_id, item.categoria, percentualAlerta, deslocamentoCiclo(item.dia_fechamento)]
                        );
                        throw erroAlerta;
                    }

                    console.log(`NOVO ALERTA GERADO (usuario ${item.usuario_id}): ${msg}`);

                    // --- ENVIO DO E-MAIL DE NOTIFICAÇÃO PARA O DONO DA META ---
                    if (
                        usuario
                        && usuario.email
                        && Number(usuario.notificacao_email) === 1
                        && !estaNoHorarioSilencioso(
                            usuario.horario_silencio_inicio,
                            usuario.horario_silencio_fim
                        )
                    ) {
                        try {
                            await resend.emails.send({
                                from: 'GBM Financeiro <naoresponder@gbm-finance.com>',
                                to: usuario.email.toLowerCase().trim(),
                                subject: `GBM - ${percentualAlerta}% do limite de ${item.categoria}`,
                                html: `
                                    <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center; background-color: #09101a; color: #e8ecef; border-radius: 8px;">
                                        <h2 style="color: #c89f53;">Guardian of Budget & Money</h2>
                                        <p>Olá, ${usuario.nome}.</p>
                                        <h1 style="color: #ef4444;">${porcentagemAtual.toFixed(1)}%</h1>
                                        <p>Você ultrapassou o aviso configurado de <strong>${percentualAlerta}%</strong>.</p>
                                        <p>Já gastou <strong>R$ ${gastoAbs.toFixed(2)}</strong> de um limite de <strong>R$ ${limite.toFixed(2)}</strong> na categoria <strong>${item.categoria}</strong>.</p>
                                        <p style="color: #8a9ba8; font-size: 12px;">Acesse seu painel para mais detalhes.</p>
                                    </div>
                                `
                            });
                        } catch (emailErr) {
                            console.error("Erro ao enviar e-mail de alerta:", emailErr);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error("Erro na auditoria de metas:", error);
    }
}

module.exports = { auditarMetas };
