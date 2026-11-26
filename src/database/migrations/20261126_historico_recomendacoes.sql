USE TourWise;

ALTER TABLE pesquisa
    MODIFY nome_cliente VARCHAR(100),
    MODIFY preferencia_lugar VARCHAR(100),
    ADD tipo_hospedagem_preferida VARCHAR(70) NULL AFTER preferencia_lugar,
    ADD ativo TINYINT NOT NULL DEFAULT 1,
    ADD data_criacao DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE recomendacao
    ADD favorito TINYINT NOT NULL DEFAULT 0;
