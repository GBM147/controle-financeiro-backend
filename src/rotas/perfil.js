const bcrypt = require('bcrypt');
const cloudinary = require('cloudinary').v2;
const { db } = require('../db/banco');
const { garantirEstruturaProduto } = require('../db/migracoes');
const { assinaturaEstaCanceladaNoMP, localizarAssinaturaNoMP } = require('../servicos/assinaturas');
const { registrarAuditoria } = require('../servicos/auditoria');
const { normalizarDiaFechamento } = require('../servicos/ciclo');
const { criptografarDado, revelarIdentidade } = require('../servicos/identidade');
const { exigirLogin } = require('../web/autorizacao');
const { enviarImagemParaCloudinary, uploadImagem, validarUploadImagem } = require('../web/uploads');
const { registrarErro } = require('../servicos/log');

function registrar(app) {
    app.get('/perfil', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;

            const [usuarios] = await db.promise().query(
                `SELECT id, nome, sobrenome, nome_exibicao,
                    nome_criptografado, sobrenome_criptografado,
                    nome_exibicao_criptografado,
                    foto_perfil_url, capa_perfil_url, dia_fechamento
             FROM usuarios
             WHERE id = ?`,
                [userId]
            );

            if (usuarios.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuária não encontrada.'
                });
            }

            res.json({
                success: true,
                perfil: {
                    ...revelarIdentidade(usuarios[0]),
                    dia_fechamento: normalizarDiaFechamento(usuarios[0].dia_fechamento)
                }
            });
        } catch (erro) {
            registrarErro('Erro ao buscar perfil:', erro);
            res.status(500).json({
                success: false,
                message: 'Não foi possível carregar o perfil.'
            });
        }
    });
    app.put('/perfil', exigirLogin, async (req, res) => {
        try {
            const userId = req.session.userId;
            const { nome_exibicao, dia_fechamento } = req.body;

            const nomeLimpo = String(nome_exibicao || '').trim();

            if (!nomeLimpo || nomeLimpo.length > 100) {
                return res.status(400).json({
                    success: false,
                    message: 'Informe um nome de até 100 caracteres.'
                });
            }

            // O dia de fechamento é opcional: só valida quando vier no corpo.
            let diaFechamento = null;
            if (dia_fechamento !== undefined && dia_fechamento !== null && dia_fechamento !== '') {
                const diaNumero = Number.parseInt(dia_fechamento, 10);
                if (!Number.isFinite(diaNumero) || diaNumero < 1 || diaNumero > 31) {
                    return res.status(400).json({
                        success: false,
                        message: 'Escolha um dia de fechamento entre 1 e 31.'
                    });
                }
                diaFechamento = diaNumero;
            }

            const nomeExibicaoCriptografado = criptografarDado(nomeLimpo);
            const camposExtras = diaFechamento !== null ? ', dia_fechamento = ?' : '';
            const parametros = [
                nomeExibicaoCriptografado ? 'PROTEGIDO' : nomeLimpo,
                nomeExibicaoCriptografado
            ];
            if (diaFechamento !== null) parametros.push(diaFechamento);
            parametros.push(userId);

            await db.promise().query(
                `UPDATE usuarios
             SET nome_exibicao = ?,
                 nome_exibicao_criptografado = ?${camposExtras}
             WHERE id = ?`,
                parametros
            );

            res.json({
                success: true,
                message: 'Perfil atualizado com sucesso.',
                dia_fechamento: diaFechamento
            });
        } catch (erro) {
            registrarErro('Erro ao atualizar perfil:', erro);
            res.status(500).json({
                success: false,
                message: 'Não foi possível atualizar o perfil.'
            });
        }
    });
    app.post('/perfil/foto', exigirLogin, uploadImagem.single('foto'), validarUploadImagem, async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Selecione uma foto.'
                });
            }

            const userId = req.session.userId;

            const imagem = await enviarImagemParaCloudinary(req.file.buffer, {
                folder: `gbm/perfis/${userId}`,
                public_id: 'foto-perfil',
                overwrite: true,
                resource_type: 'image'
            });

            await db.promise().query(
                'UPDATE usuarios SET foto_perfil_url = ? WHERE id = ?',
                [imagem.secure_url, userId]
            );

            res.json({
                success: true,
                url: imagem.secure_url,
                message: 'Foto atualizada com sucesso.'
            });
        } catch (erro) {
            registrarErro('Erro ao enviar foto:', erro);
            res.status(500).json({
                success: false,
                message: 'Não foi possível enviar a foto.'
            });
        }
    });
    app.post('/perfil/capa', exigirLogin, uploadImagem.single('capa'), validarUploadImagem, async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Selecione uma imagem de capa.'
                });
            }

            const userId = req.session.userId;

            const imagem = await enviarImagemParaCloudinary(req.file.buffer, {
                folder: `gbm/perfis/${userId}`,
                public_id: 'capa-perfil',
                overwrite: true,
                resource_type: 'image'
            });

            await db.promise().query(
                'UPDATE usuarios SET capa_perfil_url = ? WHERE id = ?',
                [imagem.secure_url, userId]
            );

            res.json({
                success: true,
                url: imagem.secure_url,
                message: 'Capa atualizada com sucesso.'
            });
        } catch (erro) {
            registrarErro('Erro ao enviar capa:', erro);
            res.status(500).json({
                success: false,
                message: 'Não foi possível enviar a capa.'
            });
        }
    });
    // --- ROTA: EXCLUIR A PRÓPRIA CONTA ---
    // A confirmação por texto e pela senha atual impedem exclusões acidentais.
    // Nunca exponha uma rota administrativa que aceite um userId vindo do navegador.
    app.delete('/minha-conta', exigirLogin, async (req, res) => {
        const userId = req.session.userId;
        const { senha, confirmacao } = req.body || {};
        const confirmacaoEsperada = 'EXCLUIR MINHA CONTA';
        const banco = db.promise();
        let transacaoAberta = false;

        if (typeof senha !== 'string' || !senha) {
            return res.status(400).json({ success: false, message: 'Informe a senha atual para excluir a conta.' });
        }

        if (confirmacao !== confirmacaoEsperada) {
            return res.status(400).json({
                success: false,
                message: `Digite exatamente “${confirmacaoEsperada}” para confirmar a exclusão.`
            });
        }

        // Identificadores SQL não podem ser passados como parâmetros. Esta validação
        // permite usar somente os nomes retornados pelo próprio banco de dados.
        const identificar = (nome) => {
            if (!/^[A-Za-z0-9_]+$/.test(nome)) {
                throw new Error('Nome de tabela inesperado ao excluir a conta.');
            }
            return `\`${nome}\``;
        };

        try {
            await banco.beginTransaction();
            transacaoAberta = true;

            const [usuarios] = await banco.query(
                `SELECT email, email_criptografado, senha_hash, status_pagamento, mercadopago_preapproval_id,
                    assinatura_cancelada_no_mp
             FROM usuarios
             WHERE id = ? FOR UPDATE`,
                [userId]
            );

            if (usuarios.length === 0) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(404).json({ success: false, message: 'Conta não encontrada.' });
            }
            usuarios[0] = revelarIdentidade(usuarios[0]);

            const senhaConfere = await bcrypt.compare(senha, usuarios[0].senha_hash);
            if (!senhaConfere) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(401).json({ success: false, message: 'A senha informada está incorreta.' });
            }

            // Consulta o Mercado Pago novamente antes de apagar. Isso recupera
            // assinaturas antigas (criadas antes de salvarmos o preapproval_id) e
            // não confunde o acesso restante do período grátis com uma nova cobrança.
            let cancelamentoConfirmadoNoMP = usuarios[0].assinatura_cancelada_no_mp === 1 || usuarios[0].assinatura_cancelada_no_mp === true;
            try {
                const encontrada = await localizarAssinaturaNoMP(
                    userId,
                    usuarios[0].email,
                    usuarios[0].mercadopago_preapproval_id
                );

                if (encontrada.assinatura && assinaturaEstaCanceladaNoMP(encontrada.assinatura.status)) {
                    await banco.query(
                        `UPDATE usuarios
                     SET mercadopago_preapproval_id = ?,
                         status_pagamento = 'cancelado',
                         assinatura_cancelada_no_mp = 1
                     WHERE id = ?`,
                        [encontrada.preapprovalId, userId]
                    );
                    cancelamentoConfirmadoNoMP = true;
                    usuarios[0].mercadopago_preapproval_id = encontrada.preapprovalId;
                    usuarios[0].status_pagamento = 'cancelado';
                } else if (encontrada.assinatura) {
                    // Guardamos o ID encontrado para que uma futura tentativa de
                    // cancelamento fale com a assinatura correta do Mercado Pago.
                    await banco.query(
                        'UPDATE usuarios SET mercadopago_preapproval_id = ? WHERE id = ?',
                        [encontrada.preapprovalId, userId]
                    );
                    usuarios[0].mercadopago_preapproval_id = encontrada.preapprovalId;
                } else {
                    // Não existe preapproval no Mercado Pago. Portanto, um eventual
                    // status "pago" foi colocado apenas no banco local e não pode
                    // produzir cobranças recorrentes.
                    await banco.query(
                        `UPDATE usuarios
                     SET mercadopago_preapproval_id = NULL,
                         status_pagamento = 'cancelado',
                         assinatura_cancelada_no_mp = 1
                     WHERE id = ?`,
                        [userId]
                    );
                    cancelamentoConfirmadoNoMP = true;
                    usuarios[0].mercadopago_preapproval_id = null;
                    usuarios[0].status_pagamento = 'cancelado';
                }
            } catch (erroMercadoPago) {
                registrarErro('Não foi possível conferir a assinatura no Mercado Pago antes de excluir:', erroMercadoPago);
                await banco.rollback();
                transacaoAberta = false;
                return res.status(502).json({
                    success: false,
                    message: 'Não foi possível confirmar o status da assinatura no Mercado Pago. Tente novamente em alguns minutos.'
                });
            }

            // Uma assinatura ativa nunca pode ser desvinculada apenas no banco local.
            // Também bloqueamos um "cancelado" antigo sem confirmação do MP, pois a
            // versão anterior do projeto só alterava o status local e podia manter a
            // cobrança recorrente ativa.
            const assinaturaNaoConfirmada =
                (usuarios[0].mercadopago_preapproval_id && !cancelamentoConfirmadoNoMP) ||
                usuarios[0].status_pagamento === 'pago' ||
                (usuarios[0].status_pagamento === 'cancelado' && !cancelamentoConfirmadoNoMP);

            if (assinaturaNaoConfirmada) {
                await banco.rollback();
                transacaoAberta = false;
                return res.status(409).json({
                    success: false,
                    message: 'Cancele a assinatura no Mercado Pago e aguarde a confirmação antes de excluir a conta.'
                });
            }

            // Apaga tabelas que dependem das contas bancárias. A consulta ao
            // INFORMATION_SCHEMA também cobre futuras tabelas com chave estrangeira
            // direta para contas_bancarias, sem desativar FOREIGN_KEY_CHECKS.
            const [dependentesDasContas] = await banco.query(`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
              AND REFERENCED_TABLE_NAME = 'contas_bancarias'
        `);

            for (const relacao of dependentesDasContas) {
                const tabelaFilha = identificar(relacao.TABLE_NAME);
                const colunaFilha = identificar(relacao.COLUMN_NAME);
                await banco.query(
                    `DELETE filha
                 FROM ${tabelaFilha} AS filha
                 INNER JOIN contas_bancarias AS conta ON filha.${colunaFilha} = conta.id
                 WHERE conta.usuario_id = ?`,
                    [userId]
                );
            }

            // Garante a exclusão das transações mesmo se a base antiga não possuir
            // a chave estrangeira transacoes.conta_id configurada.
            await banco.query(`
            DELETE transacao
            FROM transacoes AS transacao
            INNER JOIN contas_bancarias AS conta ON transacao.conta_id = conta.id
            WHERE conta.usuario_id = ?
        `, [userId]);

            // Tabelas conhecidas que usam usuario_id, inclusive em bancos mais antigos
            // onde a chave estrangeira ainda não foi criada.
            const tabelasDoUsuario = [
                'saldos_por_banco',
                'regras_categoria',
                'metas_alertas_disparos',
                'metas_alertas_percentuais',
                'objetivo_contribuicoes',
                'objetivos_financeiros',
                'importacoes_extratos',
                'transacoes_recorrentes',
                'preferencias_notificacao_usuario',
                'auditoria_seguranca',
                'metas',
                'categorias_personalizadas',
                'alertas'
            ];

            // Nem todas as versões do banco possuem todas as tabelas acima.
            // Confere o esquema real antes de apagar para que uma tabela opcional
            // ausente não interrompa (e reverta) toda a exclusão da conta.
            const [tabelasDisponiveis] = await banco.query(`
            SELECT TABLE_NAME
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND COLUMN_NAME = 'usuario_id'
              AND TABLE_NAME IN (
                  'saldos_por_banco',
                  'regras_categoria',
                  'metas_alertas_disparos',
                  'metas_alertas_percentuais',
                  'objetivo_contribuicoes',
                  'objetivos_financeiros',
                  'importacoes_extratos',
                  'transacoes_recorrentes',
                  'preferencias_notificacao_usuario',
                  'auditoria_seguranca',
                  'metas',
                  'categorias_personalizadas',
                  'alertas'
              )
        `);
            const nomesTabelasDisponiveis = new Set(
                tabelasDisponiveis.map((linha) => linha.TABLE_NAME)
            );

            for (const tabela of tabelasDoUsuario) {
                if (!nomesTabelasDisponiveis.has(tabela)) {
                    console.log(`Tabela opcional "${tabela}" ausente; exclusão continuará.`);
                    continue;
                }

                await banco.query(`DELETE FROM ${identificar(tabela)} WHERE usuario_id = ?`, [userId]);
            }

            // O Adminer mostrou mais de uma relação em alertas. Esta parte remove
            // qualquer outra tabela ligada diretamente a usuarios, antes da linha pai.
            const [dependentesDoUsuario] = await banco.query(`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_SCHEMA = DATABASE()
              AND REFERENCED_TABLE_NAME = 'usuarios'
              AND TABLE_NAME <> 'contas_bancarias'
        `);

            for (const relacao of dependentesDoUsuario) {
                const tabelaFilha = identificar(relacao.TABLE_NAME);
                const colunaFilha = identificar(relacao.COLUMN_NAME);
                await banco.query(`DELETE FROM ${tabelaFilha} WHERE ${colunaFilha} = ?`, [userId]);
            }

            await banco.query('DELETE FROM contas_bancarias WHERE usuario_id = ?', [userId]);
            const [resultado] = await banco.query('DELETE FROM usuarios WHERE id = ?', [userId]);

            if (resultado.affectedRows !== 1) {
                throw new Error('A conta não pôde ser removida.');
            }

            await banco.commit();
            transacaoAberta = false;

            // Os dois arquivos são removidos após o banco confirmar a exclusão. Falhas
            // no provedor de imagens não desfazem uma conta já apagada; ficam registradas.
            // A função assíncrona converte erros síncronos do SDK (como credenciais
            // ausentes) em rejeições, para que nunca interrompam a resposta.
            const apagarImagem = async (nome) => cloudinary.uploader.destroy(
                `gbm/perfis/${userId}/${nome}`, { resource_type: 'image', invalidate: true }
            );
            const resultadosCloudinary = await Promise.allSettled([
                apagarImagem('foto-perfil'),
                apagarImagem('capa-perfil')
            ]);
            resultadosCloudinary
                .filter((resultadoCloudinary) => resultadoCloudinary.status === 'rejected')
                .forEach((resultadoCloudinary) => console.warn(
                    'Não foi possível apagar uma imagem de perfil:',
                    resultadoCloudinary.reason?.message || resultadoCloudinary.reason
                ));

            return req.session.destroy((erroSessao) => {
                if (erroSessao) {
                    registrarErro('Conta apagada, mas não foi possível encerrar a sessão atual:', erroSessao);
                }

                const opcoesCookie = {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax'
                };
                res.clearCookie('gbm_sid', opcoesCookie);
                res.clearCookie('connect.sid', opcoesCookie);
                return res.json({ success: true, message: 'Sua conta e seus dados foram excluídos com sucesso.' });
            });
        } catch (erro) {
            if (transacaoAberta) {
                try {
                    await banco.rollback();
                } catch (erroRollback) {
                    registrarErro('Erro ao desfazer a exclusão da conta:', erroRollback);
                }
            }

            registrarErro('Erro ao excluir conta:', erro);
            const bloqueioPorRelacao = erro.code === 'ER_ROW_IS_REFERENCED' || erro.code === 'ER_ROW_IS_REFERENCED_2';
            return res.status(bloqueioPorRelacao ? 409 : 500).json({
                success: false,
                message: bloqueioPorRelacao
                    ? 'Há um dado relacionado que ainda impede a exclusão. Nenhum dado foi apagado; contate o suporte para concluir com segurança.'
                    : 'Não foi possível excluir a conta. Tente novamente mais tarde.'
            });
        }
    });
    app.get('/minha-conta/exportar', exigirLogin, async (req, res) => {
        try {
            await garantirEstruturaProduto();
            const usuarioId = req.session.userId;
            const [[usuarioBanco]] = await db.promise().query(
                `SELECT id, nome, sobrenome, email, telefone,
                    nome_criptografado, sobrenome_criptografado, email_criptografado,
                    telefone_criptografado,
                    status_pagamento, trial_expira, criado_em, consentimento_privacidade_em,
                    termos_aceitos_em, termos_versao
             FROM usuarios WHERE id = ?`,
                [usuarioId]
            );
            const consultas = await Promise.all([
                db.promise().query('SELECT * FROM contas_bancarias WHERE usuario_id = ?', [usuarioId]),
                db.promise().query(`
                SELECT t.*
                FROM transacoes t
                JOIN contas_bancarias cb ON cb.id = t.conta_id
                WHERE cb.usuario_id = ?
                ORDER BY t.data_transacao, t.id
            `, [usuarioId]),
                db.promise().query('SELECT * FROM objetivos_financeiros WHERE usuario_id = ?', [usuarioId]),
                db.promise().query('SELECT * FROM objetivo_contribuicoes WHERE usuario_id = ?', [usuarioId]),
                db.promise().query('SELECT * FROM transacoes_recorrentes WHERE usuario_id = ?', [usuarioId]),
                db.promise().query('SELECT * FROM alertas WHERE usuario_id = ?', [usuarioId]),
                db.promise().query('SELECT * FROM importacoes_extratos WHERE usuario_id = ?', [usuarioId]),
                db.promise().query('SELECT * FROM categorias_personalizadas WHERE usuario_id = ?', [usuarioId])
            ]);
            const usuario = revelarIdentidade(usuarioBanco);
            const exportacao = {
                exportado_em: new Date().toISOString(),
                usuario,
                contas: consultas[0][0],
                transacoes: consultas[1][0],
                objetivos: consultas[2][0],
                contribuicoes_objetivos: consultas[3][0],
                recorrencias: consultas[4][0],
                notificacoes: consultas[5][0],
                importacoes: consultas[6][0],
                categorias_personalizadas: consultas[7][0]
            };
            await registrarAuditoria(req, 'DADOS_EXPORTADOS');
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.setHeader('Content-Disposition', 'attachment; filename="meus-dados-gbm.json"');
            res.send(JSON.stringify(exportacao, null, 2));
        } catch (erro) {
            registrarErro('Erro ao exportar dados:', erro);
            res.status(500).json({ success: false, error: 'Falha ao exportar seus dados.' });
        }
    });
}

module.exports = { registrar };
