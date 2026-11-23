CREATE DATABASE IF NOT EXISTS TourWise;
USE TourWise;

CREATE TABLE empresa (
    id_empresa INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(45) NOT NULL,
    email VARCHAR(45) UNIQUE
);

CREATE TABLE tipo_usuario (
    id_tipo_usuario INT PRIMARY KEY AUTO_INCREMENT,
    tipo_usuario VARCHAR(45) NOT NULL UNIQUE
);

CREATE TABLE usuario (
    cod_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nome VARCHAR(45) NOT NULL,
    email VARCHAR(45) NOT NULL UNIQUE,
    senha VARCHAR(45) NOT NULL,
    fk_empresa INT NULL,
    fk_tipo_usuario INT NOT NULL,
    FOREIGN KEY (fk_empresa) REFERENCES empresa (id_empresa),
    FOREIGN KEY (fk_tipo_usuario) REFERENCES tipo_usuario (id_tipo_usuario)
);

CREATE TABLE contato (
    id_contato INT PRIMARY KEY AUTO_INCREMENT,
    nome_representante VARCHAR(45),
    nome_empresa VARCHAR(45),
    email VARCHAR(100),
    assunto VARCHAR(200),
    descricao VARCHAR(300),
    dt_envio DATETIME
);

CREATE TABLE historico_leitura_arquivo (
    id_historico_leitura_arquivo INT PRIMARY KEY AUTO_INCREMENT,
    nome_arquivo VARCHAR(255),
    data_hora_leitura DATETIME
);

CREATE TABLE java_logs (
    id_logs INT PRIMARY KEY AUTO_INCREMENT,
    mensagem VARCHAR(45),
    data_hora_log DATETIME
);

CREATE TABLE tipos_notificacoes (
    id_tipos_notificacoes INT PRIMARY KEY AUTO_INCREMENT,
    tipo_notificacao VARCHAR(45)
);

CREATE TABLE notificacoes (
    id_notificacoes INT PRIMARY KEY AUTO_INCREMENT,
    ativo TINYINT,
    data_hora_notificacao DATETIME,
    fk_tipos_notificacoes INT,
    fk_empresa INT,
    FOREIGN KEY (fk_tipos_notificacoes) REFERENCES tipos_notificacoes (id_tipos_notificacoes),
    FOREIGN KEY (fk_empresa) REFERENCES empresa (id_empresa)
);

CREATE TABLE pesquisa (
    id_pesquisa INT PRIMARY KEY AUTO_INCREMENT,
    nome_cliente VARCHAR(45),
    preferencia_lugar VARCHAR(45),
    quantidade_pessoas INT,
    precisa_acessibilidade TINYINT,
    idioma VARCHAR(45),
    dt_viagem DATE,
    fk_usuario INT,
    FOREIGN KEY (fk_usuario) REFERENCES usuario (cod_usuario)
);

CREATE TABLE localizacao (
    id_localizacao INT PRIMARY KEY AUTO_INCREMENT,
    endereco VARCHAR(300),
    municipio VARCHAR(100),
    uf CHAR(2),
    fk_hospedagem INT
);

CREATE TABLE idioma (
    id_idioma INT PRIMARY KEY AUTO_INCREMENT,
    idioma VARCHAR(300),
    codigo_idioma CHAR(2)
);

CREATE TABLE cnae (
    id_cnae INT PRIMARY KEY AUTO_INCREMENT,
    codigo CHAR(7),
    descricao VARCHAR(200)
);

CREATE TABLE hospedagem (
    id_hospedagem INT PRIMARY KEY AUTO_INCREMENT,
    cnpj CHAR(14),
    tipo_hospedagem VARCHAR(70),
    nome_fantasia VARCHAR(200),
    email_comercial VARCHAR(100),
    uni_habit INT,
    leitos INT,
    uni_habit_acess INT,
    leito_acess INT,
    dt_abertura DATE,
    website VARCHAR(150),
    porte VARCHAR(60)
);

ALTER TABLE localizacao
    ADD CONSTRAINT fk_localizacao_hospedagem
    FOREIGN KEY (fk_hospedagem) REFERENCES hospedagem (id_hospedagem);

CREATE TABLE leitura (
    id_leitura INT PRIMARY KEY AUTO_INCREMENT,
    nome_arquivo VARCHAR(100),
    data_hora_leitura DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE cnaes_hospedagem (
    fk_cnae INT,
    fk_hospedagem INT,
    CONSTRAINT pk_cnaes PRIMARY KEY (fk_cnae, fk_hospedagem),
    FOREIGN KEY (fk_cnae) REFERENCES cnae (id_cnae),
    FOREIGN KEY (fk_hospedagem) REFERENCES hospedagem (id_hospedagem)
);

CREATE TABLE idiomas_hospedagem (
    fk_idioma INT,
    fk_hospedagem INT,
    CONSTRAINT pk_idiomas PRIMARY KEY (fk_idioma, fk_hospedagem),
    FOREIGN KEY (fk_idioma) REFERENCES idioma (id_idioma),
    FOREIGN KEY (fk_hospedagem) REFERENCES hospedagem (id_hospedagem)
);

CREATE TABLE telefone (
    id_telefone INT PRIMARY KEY AUTO_INCREMENT,
    numero CHAR(11),
    fk_hospedagem INT,
    FOREIGN KEY (fk_hospedagem) REFERENCES hospedagem (id_hospedagem)
);

CREATE TABLE recomendacao (
    id_recomendacao INT AUTO_INCREMENT,
    fk_hospedagem INT,
    fk_pesquisa INT,
    PRIMARY KEY (id_recomendacao, fk_hospedagem, fk_pesquisa),
    indice_compatibilidade CHAR(4),
    posicao_rank INT,
    FOREIGN KEY (fk_hospedagem) REFERENCES hospedagem (id_hospedagem),
    FOREIGN KEY (fk_pesquisa) REFERENCES pesquisa (id_pesquisa)
);

INSERT INTO tipo_usuario (tipo_usuario) VALUES
    ('adm'),
    ('Gestor'),
    ('Agente');
