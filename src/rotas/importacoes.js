const crypto = require('crypto');
const { detectarBanco: detectarBancoPdf, extrairTransacoesDoPdf } = require('../../pdf-extrato-parser');
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { auditarMetas } = require('../servicos/alertas');
const {
    assinarHashPrevia,
    assinaturaHashPreviaValida,
    canonicalizarDescricaoImportacao,
    categorizarTransacao,
    criarChaveCanonicaImportacao,
    extrairTextoPdf,
    normalizarDataBancaria,
    normalizarLoteImportacao,
    prepararOfxParaPrevia,
    valorEmCentavos
} = require('../servicos/importacao');
const { exigirLogin } = require('../web/autorizacao');
const { limitarImportacao } = require('../web/limitadores');
const {
    LIMITE_TEXTO_PDF_CARACTERES,
    uploadOfx,
    uploadPdf,
    validarUploadOfx,
    validarUploadPdf
} = require('../web/uploads');

function registrar(app) {
    app.post('/importar-ofx', exigirLogin, (req, res) => {
        res.status(410).json({
            success: false,
            codigo: 'IMPORTADOR_LEGADO_DESATIVADO',
            message: 'Use a Central de Importações para revisar o arquivo, escolher a conta e confirmar com proteção contra duplicidades.'
        });
    });
    app.post(
        '/pdf-extrato/preview',
        limitarImportacao,
        exigirLogin,
        uploadPdf.single('arquivo'),
        validarUploadPdf,
        async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, message: 'Nenhum ficheiro PDF foi selecionado.' });
            }
            const userId = req.session.userId;

            // 1. Extrai o texto puro do PDF (preservando o espaçamento entre colunas da tabela)
            const texto = await extrairTextoPdf(req.file.buffer);
            if (texto.length > LIMITE_TEXTO_PDF_CARACTERES) {
                return res.status(413).json({
                    success: false,
                    message: 'O texto deste PDF é grande demais para ser processado com segurança.'
                });
            }

            // 2. Roda o extrator de transações (regras genéricas + conferência de saldo)
            const bancoDetectado = detectarBancoPdf(texto);
            const { transacoes, reconciliacao, confianca } = await extrairTransacoesDoPdf(texto);

            if (transacoes.length === 0) {
                return res.status(422).json({
                    success: false,
                    message: 'Não conseguimos identificar nenhuma transação nesse PDF. Ele pode ser um extrato escaneado (imagem) ou ter um layout muito diferente do esperado.'
                });
            }

            // 3. Carrega as regras do usuário para já sugerir uma categoria em cada linha
            const [regrasUsuario] = await db.promise().query(
                'SELECT descricao_contem, categoria FROM regras_categoria WHERE usuario_id = ?',
                [userId]
            );

            const transacoesComCategoria = transacoes.map((t) => {
                const descricao = String(t?.descricao || '').trim().slice(0, 255);
                const data = normalizarDataBancaria(t?.data ?? t?.data_transacao);
                const tipo = t?.tipo === 'Receita' ? 'Receita' : t?.tipo === 'Despesa' ? 'Despesa' : null;
                const centavos = valorEmCentavos(t?.valor);
                if (!descricao || !data || !tipo || centavos === null) return null;
                return {
                    ...t,
                    data,
                    descricao,
                    valor: centavos / 100,
                    tipo,
                    categoria: categorizarTransacao(descricao, regrasUsuario)
                };
            }).filter(Boolean);

            if (!transacoesComCategoria.length) {
                return res.status(422).json({
                    success: false,
                    message: 'As transações encontradas no PDF não possuem datas bancárias, tipos ou valores válidos.'
                });
            }

            const hashArquivo = crypto.createHash('sha256').update(req.file.buffer).digest('hex');

            res.json({
                success: true,
                nome_arquivo: req.file.originalname,
                hash_arquivo: hashArquivo,
                assinatura_previa: assinarHashPrevia(userId, 'PDF', hashArquivo),
                banco_detectado: bancoDetectado,
                confianca, // 'alta' (achou coluna de saldo, deu pra conferir) ou 'baixa' (modo simples)
                reconciliacao, // null quando não foi possível conferir o saldo
                transacoes: transacoesComCategoria
            });
        } catch (error) {
            console.error('Erro ao converter PDF:', error);
            res.status(500).json({ success: false, message: 'Falha ao ler o PDF. Verifique se o ficheiro não está corrompido ou protegido por senha.' });
        }
        }
    );
    // A confirmação sem hash/conta/importação rastreável foi desativada.
    app.post('/pdf-extrato/confirmar', exigirLogin, (req, res) => {
        res.status(410).json({
            success: false,
            codigo: 'IMPORTADOR_LEGADO_DESATIVADO',
            message: 'Confirme PDFs pela Central de Importações para usar hash do arquivo, conta e deduplicação segura.'
        });
    });
    app.post(
        '/ofx-extrato/preview',
        limitarImportacao,
        exigirLogin,
        uploadOfx.single('arquivo'),
        validarUploadOfx,
        async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({ success: false, error: 'Selecione um arquivo OFX.' });
            }
            const usuarioId = req.session.userId;
            const previa = await prepararOfxParaPrevia(req.file.buffer, usuarioId);
            if (!previa.transacoes.length) {
                return res.status(422).json({ success: false, error: 'Nenhuma transação foi encontrada no OFX.' });
            }
            const hashArquivo = crypto.createHash('sha256').update(req.file.buffer).digest('hex');
            res.json({
                success: true,
                nome_arquivo: req.file.originalname,
                hash_arquivo: hashArquivo,
                assinatura_previa: assinarHashPrevia(usuarioId, 'OFX', hashArquivo),
                banco_detectado: previa.banco,
                saldo_detectado: previa.saldo,
                confianca: 'alta',
                transacoes: previa.transacoes
            });
        } catch (erro) {
            console.error('Erro na prévia OFX:', erro);
            res.status(500).json({ success: false, error: 'Falha ao ler o arquivo OFX.' });
        }
        }
    );
    app.post('/importacoes/confirmar', exigirLogin, async (req, res) => {
        const bancoDados = db.promise();
        let transacaoAberta = false;
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const contaId = Number(req.body.conta_id);
            const tipoArquivo = String(req.body.tipo_arquivo || '').toUpperCase();
            const nomeArquivo = String(req.body.nome_arquivo || '').slice(0, 180) || null;
            const nomeBanco = String(req.body.banco || 'Outro banco').slice(0, 120);
            const hashArquivo = String(req.body.hash_arquivo || '').trim().toLowerCase();
            const assinaturaPrevia = String(req.body.assinatura_previa || '').trim().toLowerCase();
            const saldoDetectado = req.body.saldo_detectado === null || req.body.saldo_detectado === undefined
                ? null
                : Number(req.body.saldo_detectado);
            const transacoes = Array.isArray(req.body.transacoes) ? req.body.transacoes : [];

            if (!['OFX', 'PDF'].includes(tipoArquivo) || !transacoes.length) {
                return res.status(400).json({ success: false, error: 'Importação sem dados válidos.' });
            }
            if (!assinaturaHashPreviaValida(usuarioId, tipoArquivo, hashArquivo, assinaturaPrevia)) {
                return res.status(400).json({
                    success: false,
                    codigo: 'PREVIA_IMPORTACAO_INVALIDA',
                    error: 'A prévia não corresponde ao arquivo analisado. Analise o arquivo novamente antes de confirmar.'
                });
            }

            const [contas] = await bancoDados.query(
                'SELECT id, saldo FROM contas_bancarias WHERE id = ? AND usuario_id = ? AND ativa = 1',
                [contaId, usuarioId]
            );
            if (!contas.length) {
                return res.status(400).json({ success: false, error: 'Selecione uma conta válida.' });
            }

            const linhasNormalizadas = normalizarLoteImportacao(transacoes, contaId);
            const chaveArquivoConfirmado = crypto.createHash('sha256')
                .update(`${usuarioId}|${contaId}|${hashArquivo}`)
                .digest('hex');
            const [anteriores] = await bancoDados.query(
                `SELECT id FROM importacoes_extratos
             WHERE usuario_id = ? AND conta_id = ? AND hash_arquivo = ? AND status = 'concluida'
             LIMIT 1`,
                [usuarioId, contaId, hashArquivo]
            );
            if (anteriores.length) {
                return res.status(409).json({
                    success: false,
                    codigo: 'ARQUIVO_JA_IMPORTADO',
                    error: 'Este mesmo arquivo já foi importado para a conta selecionada.'
                });
            }

            await bancoDados.beginTransaction();
            transacaoAberta = true;
            const [lote] = await bancoDados.query(
                `INSERT INTO importacoes_extratos
                (usuario_id, conta_id, tipo_arquivo, nome_arquivo, banco, hash_arquivo,
                 status, saldo_anterior, saldo_importado, chave_arquivo_confirmado)
             VALUES (?, ?, ?, ?, ?, ?, 'processando', ?, ?, ?)`,
                [
                    usuarioId,
                    contaId,
                    tipoArquivo,
                    nomeArquivo,
                    nomeBanco,
                    hashArquivo,
                    Number(contas[0].saldo || 0),
                    Number.isFinite(saldoDetectado) ? saldoDetectado : null,
                    chaveArquivoConfirmado
                ]
            );

            let inseridas = 0;
            let duplicadas = 0;
            const candidatosPorChave = new Map();
            const candidatosConsumidos = new Set();
            for (const linha of linhasNormalizadas) {
                let movimentoExistente = null;
                let transacaoIdExterno;

                if (linha.fitid) {
                    transacaoIdExterno = crypto.createHash('sha256')
                        .update(`${contaId}-${linha.fitid}`)
                        .digest('hex');
                    const [movimentosFitid] = await bancoDados.query(
                        `SELECT id
                     FROM transacoes
                     WHERE conta_id = ?
                       AND (
                           fitid_origem = ?
                           OR identidade_importacao = ?
                           OR transacao_id_pluggy = ?
                       )
                     ORDER BY id
                     LIMIT 1`,
                        [contaId, linha.fitid, linha.identidade, transacaoIdExterno]
                    );
                    movimentoExistente = movimentosFitid[0] || null;
                } else {
                    const chaveCanonica = criarChaveCanonicaImportacao(contaId, linha);
                    if (!candidatosPorChave.has(chaveCanonica)) {
                        const [candidatos] = await bancoDados.query(
                            `SELECT id, descricao, identidade_importacao
                         FROM transacoes
                         WHERE conta_id = ?
                           AND data_transacao = ?
                           AND tipo = ?
                           AND valor = ?
                         ORDER BY id`,
                            [contaId, linha.data, linha.tipo, linha.valor]
                        );
                        candidatosPorChave.set(
                            chaveCanonica,
                            candidatos.filter((candidato) => (
                                canonicalizarDescricaoImportacao(candidato.descricao) === linha.descricaoCanonica
                            ))
                        );
                    }
                    const candidatosCanonicos = candidatosPorChave.get(chaveCanonica);
                    movimentoExistente = candidatosCanonicos
                        .find((candidato) => candidato.identidade_importacao === linha.identidade)
                        || candidatosCanonicos.find((candidato) => !candidatosConsumidos.has(candidato.id))
                        || null;
                    transacaoIdExterno = linha.identidade;
                }

                if (movimentoExistente) {
                    candidatosConsumidos.add(movimentoExistente.id);
                    duplicadas += 1;
                    continue;
                }
                // Tenta conciliar com um lançamento gerado por recorrência ainda não confirmado
                const [placeholders] = await bancoDados.query(
                    `SELECT id FROM transacoes
                 WHERE conta_id = ?
                   AND recorrencia_id IS NOT NULL
                   AND transacao_id_pluggy LIKE 'recorrencia-%'
                   AND tipo = ?
                   AND ABS(valor - ?) <= GREATEST(1, valor * 0.03)
                   AND ABS(DATEDIFF(data_transacao, ?)) <= 5
                 ORDER BY ABS(DATEDIFF(data_transacao, ?)) ASC
                 LIMIT 1`,
                    [contaId, linha.tipo, linha.valor, linha.data, linha.data]
                );
                if (placeholders.length) {
                    await bancoDados.query(
                        `UPDATE transacoes
                     SET transacao_id_pluggy = ?, descricao = ?, valor = ?, data_transacao = ?,
                         banco = ?, importacao_id = ?, fitid_origem = ?, identidade_importacao = ?
                     WHERE id = ?`,
                        [transacaoIdExterno, linha.descricao, linha.valor, linha.data, nomeBanco, lote.insertId, linha.fitid, linha.identidade, placeholders[0].id]
                    );
                    inseridas += 1;
                    continue;
                }
                const [resultado] = await bancoDados.query(
                    `INSERT INTO transacoes
                    (conta_id, transacao_id_pluggy, descricao, valor, tipo, categoria,
                     data_transacao, banco, importacao_id, fitid_origem, identidade_importacao)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                 ON DUPLICATE KEY UPDATE id = id`,
                    [
                        contaId,
                        transacaoIdExterno,
                        linha.descricao,
                        linha.valor,
                        linha.tipo,
                        linha.categoria,
                        linha.data,
                        nomeBanco,
                        lote.insertId,
                        linha.fitid,
                        linha.identidade
                    ]
                );
                if (resultado.affectedRows === 1) inseridas += 1;
                else duplicadas += 1;
            }

            await bancoDados.query(
                `UPDATE importacoes_extratos
             SET status = 'concluida', quantidade_inseridas = ?, quantidade_duplicadas = ?
             WHERE id = ?`,
                [inseridas, duplicadas, lote.insertId]
            );
            await bancoDados.query(
                `UPDATE contas_bancarias
             SET banco = COALESCE(NULLIF(banco, ''), ?),
                 nome_personalizado = COALESCE(NULLIF(nome_personalizado, ''), ?),
                 saldo = COALESCE(?, saldo)
             WHERE id = ? AND usuario_id = ?`,
                [nomeBanco, nomeBanco, Number.isFinite(saldoDetectado) ? saldoDetectado : null, contaId, usuarioId]
            );
            if (Number.isFinite(saldoDetectado)) {
                await bancoDados.query(
                    `INSERT INTO saldos_por_banco (usuario_id, banco, saldo)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE saldo = VALUES(saldo)`,
                    [usuarioId, nomeBanco, saldoDetectado]
                );
            }

            await bancoDados.commit();
            transacaoAberta = false;
            await auditarMetas(req.session.userId);
            res.status(201).json({
                success: true,
                importacao_id: lote.insertId,
                inseridas,
                duplicadas,
                message: `Importação concluída: ${inseridas} novas e ${duplicadas} duplicadas ignoradas.`
            });
        } catch (erro) {
            if (transacaoAberta) {
                try { await bancoDados.rollback(); } catch {}
            }
            if (
                erro?.code === 'ER_DUP_ENTRY'
                && String(erro?.message || '').includes('uk_importacao_arquivo_confirmado')
            ) {
                return res.status(409).json({
                    success: false,
                    codigo: 'ARQUIVO_JA_IMPORTADO',
                    error: 'Este mesmo arquivo já foi importado para a conta selecionada.'
                });
            }
            if (erro?.statusHttp) {
                return res.status(erro.statusHttp).json({
                    success: false,
                    codigo: erro.codigoPublico || 'IMPORTACAO_INVALIDA',
                    error: erro.message
                });
            }
            console.error('Erro ao confirmar importação:', erro);
            res.status(500).json({ success: false, error: 'Falha ao concluir a importação.' });
        }
    });
    app.get('/importacoes', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const [linhas] = await db.promise().query(`
            SELECT
                i.id,
                i.tipo_arquivo,
                i.nome_arquivo,
                i.banco,
                i.status,
                i.quantidade_inseridas,
                i.quantidade_duplicadas,
                i.criado_em,
                i.desfeito_em,
                COALESCE(NULLIF(cb.nome_personalizado, ''), NULLIF(cb.banco, ''), CONCAT('Conta ', cb.id)) AS conta
            FROM importacoes_extratos i
            JOIN contas_bancarias cb ON cb.id = i.conta_id AND cb.usuario_id = i.usuario_id
            WHERE i.usuario_id = ?
            ORDER BY i.criado_em DESC
            LIMIT 100
        `, [req.session.userId]);
            res.json(linhas);
        } catch (erro) {
            res.status(500).json({ success: false, error: 'Falha ao carregar o histórico.' });
        }
    });
    app.delete('/importacoes/:id', exigirLogin, async (req, res) => {
        const bancoDados = db.promise();
        try {
            await bancoDados.beginTransaction();
            const [lotes] = await bancoDados.query(
                `SELECT id, conta_id, saldo_anterior, saldo_importado
             FROM importacoes_extratos
             WHERE id = ? AND usuario_id = ? AND status = 'concluida'
             FOR UPDATE`,
                [req.params.id, req.session.userId]
            );
            if (!lotes.length) {
                await bancoDados.rollback();
                return res.status(404).json({ success: false, error: 'Importação não encontrada ou já desfeita.' });
            }
            const [maisRecentes] = await bancoDados.query(
                `SELECT id
             FROM importacoes_extratos
             WHERE usuario_id = ?
               AND conta_id = ?
               AND status = 'concluida'
               AND id > ?
             LIMIT 1`,
                [req.session.userId, lotes[0].conta_id, lotes[0].id]
            );
            if (maisRecentes.length) {
                await bancoDados.rollback();
                return res.status(409).json({
                    success: false,
                    error: 'Desfaça primeiro a importação mais recente desta conta.'
                });
            }
            const [resultado] = await bancoDados.query(
                'DELETE FROM transacoes WHERE importacao_id = ?',
                [req.params.id]
            );
            await bancoDados.query(
                `UPDATE importacoes_extratos
             SET status = 'desfeita', desfeito_em = NOW(), chave_arquivo_confirmado = NULL
             WHERE id = ? AND usuario_id = ?`,
                [req.params.id, req.session.userId]
            );
            if (lotes[0].saldo_importado !== null && lotes[0].saldo_anterior !== null) {
                await bancoDados.query(
                    `UPDATE contas_bancarias
                 SET saldo = ?
                 WHERE id = ? AND usuario_id = ?`,
                    [lotes[0].saldo_anterior, lotes[0].conta_id, req.session.userId]
                );
            }
            await bancoDados.commit();
            res.json({ success: true, removidas: resultado.affectedRows });
        } catch (erro) {
            try { await bancoDados.rollback(); } catch {}
            res.status(500).json({ success: false, error: 'Falha ao desfazer a importação.' });
        }
    });
}

module.exports = { registrar };
