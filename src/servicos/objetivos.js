// =======================================================
// --- OBJETIVOS FINANCEIROS (SEPARADOS DOS LIMITES) ---
// =======================================================
async function recalcularStatusObjetivo(conexao, objetivoId, usuarioId) {
    const [[resumo]] = await conexao.query(
        `SELECT
            o.valor_meta,
            COALESCE(SUM(c.valor), 0) AS valor_guardado
         FROM objetivos_financeiros o
         LEFT JOIN objetivo_contribuicoes c
           ON c.objetivo_id = o.id
          AND c.usuario_id = o.usuario_id
         WHERE o.id = ? AND o.usuario_id = ?
         GROUP BY o.id, o.valor_meta`,
        [objetivoId, usuarioId]
    );
    if (!resumo) return null;
    const valorGuardado = Number(resumo.valor_guardado || 0);
    const status = valorGuardado >= Number(resumo.valor_meta) ? 'concluido' : 'ativo';
    await conexao.query(
        'UPDATE objetivos_financeiros SET status = ? WHERE id = ? AND usuario_id = ?',
        [status, objetivoId, usuarioId]
    );
    return { status, valor_guardado: valorGuardado };
}

module.exports = { recalcularStatusObjetivo };
