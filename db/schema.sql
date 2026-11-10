-- Esquema base do GBM Finance para desenvolvimento e testes de integração.
--
-- Contém apenas as tabelas que o servidor não cria sozinho. As demais tabelas,
-- colunas e índices são adicionados pelas migrações automáticas em
-- src/db/migracoes.js na inicialização. Foi derivado das consultas do código;
-- para comparar com produção, gere `mysqldump --no-data` do banco publicado.

CREATE TABLE IF NOT EXISTS usuarios (
    id INT NOT NULL AUTO_INCREMENT,
    nome VARCHAR(120) NULL,
    sobrenome VARCHAR(120) NULL,
    nome_exibicao VARCHAR(120) NULL,
    email VARCHAR(255) NOT NULL,
    telefone VARCHAR(40) NULL,
    cpf VARCHAR(20) NULL,
    senha_hash VARCHAR(255) NOT NULL,
    verificado TINYINT(1) NOT NULL DEFAULT 0,
    token_verificacao VARCHAR(255) NULL,
    token_expira_em DATETIME NULL,
    status_pagamento VARCHAR(20) NOT NULL DEFAULT 'trial',
    trial_expira DATETIME NULL,
    mercadopago_preapproval_id VARCHAR(64) NULL,
    assinatura_cancelada_no_mp TINYINT(1) NOT NULL DEFAULT 0,
    foto_perfil_url VARCHAR(500) NULL,
    capa_perfil_url VARCHAR(500) NULL,
    criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uk_usuarios_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS contas_bancarias (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    saldo DECIMAL(15,2) NOT NULL DEFAULT 0,
    PRIMARY KEY (id),
    KEY idx_contas_usuario (usuario_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS transacoes (
    id INT NOT NULL AUTO_INCREMENT,
    conta_id INT NOT NULL,
    transacao_id_pluggy VARCHAR(180) NULL,
    descricao VARCHAR(255) NOT NULL,
    valor DECIMAL(15,2) NOT NULL,
    tipo VARCHAR(20) NOT NULL,
    categoria VARCHAR(120) NOT NULL,
    data_transacao DATE NOT NULL,
    banco VARCHAR(120) NULL,
    PRIMARY KEY (id),
    KEY idx_transacoes_conta_data (conta_id, data_transacao),
    KEY idx_transacoes_pluggy (conta_id, transacao_id_pluggy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS metas (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    categoria VARCHAR(120) NOT NULL,
    valor_limite DECIMAL(15,2) NOT NULL,
    percentual_alerta TINYINT UNSIGNED NOT NULL DEFAULT 80,
    PRIMARY KEY (id),
    UNIQUE KEY uk_metas_usuario_categoria (usuario_id, categoria)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS categorias_personalizadas (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    nome VARCHAR(120) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_categorias_usuario_nome (usuario_id, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS alertas (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    categoria VARCHAR(120) NULL,
    mensagem VARCHAR(500) NOT NULL,
    lida TINYINT(1) NOT NULL DEFAULT 0,
    data_criacao TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_alertas_usuario (usuario_id, lida)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS regras_categoria (
    id INT NOT NULL AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    descricao_contem VARCHAR(180) NOT NULL,
    categoria VARCHAR(120) NOT NULL,
    PRIMARY KEY (id),
    UNIQUE KEY uk_regras_usuario_descricao (usuario_id, descricao_contem)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS preferencias_notificacao (
    id INT NOT NULL,
    percentual_alerta TINYINT UNSIGNED NOT NULL DEFAULT 80,
    PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO preferencias_notificacao (id, percentual_alerta) VALUES (1, 80);
