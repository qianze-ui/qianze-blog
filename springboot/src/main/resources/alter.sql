-- 安全迁移脚本：仅添加不存在的列，不删数据
-- 执行方式: mysql -u root -p blog < alter.sql
-- 兼容 MySQL 5.7+ / 8.0（无需 IF NOT EXISTS 语法）

DELIMITER $$

DROP PROCEDURE IF EXISTS add_col $$
CREATE PROCEDURE add_col(
    IN p_table VARCHAR(100),
    IN p_column VARCHAR(100),
    IN p_type VARCHAR(200)
)
BEGIN
    DECLARE col_count INT;
    SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column;
    IF col_count = 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table, ' ADD COLUMN ', p_column, ' ', p_type);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DROP PROCEDURE IF EXISTS mod_col $$
CREATE PROCEDURE mod_col(
    IN p_table VARCHAR(100),
    IN p_column VARCHAR(100),
    IN p_type VARCHAR(200)
)
BEGIN
    DECLARE col_count INT;
    SELECT COUNT(*) INTO col_count FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = p_table AND COLUMN_NAME = p_column;
    IF col_count > 0 THEN
        SET @sql = CONCAT('ALTER TABLE ', p_table, ' MODIFY COLUMN ', p_column, ' ', p_type);
        PREPARE stmt FROM @sql;
        EXECUTE stmt;
        DEALLOCATE PREPARE stmt;
    END IF;
END $$

DELIMITER ;

-- visit_logs 新增 browser, os, device, model
CALL add_col('visit_logs', 'browser',     'VARCHAR(50)');
CALL add_col('visit_logs', 'os',          'VARCHAR(50)');
CALL add_col('visit_logs', 'device',      'VARCHAR(20)');
CALL add_col('visit_logs', 'model',       'VARCHAR(100)');

-- guestbook 新增 ip, user_agent, browser, os, device, model
CALL add_col('guestbook',  'ip',          'VARCHAR(50)');
CALL add_col('guestbook',  'user_agent',  'VARCHAR(500)');
CALL add_col('guestbook',  'browser',     'VARCHAR(50)');
CALL add_col('guestbook',  'os',          'VARCHAR(50)');
CALL add_col('guestbook',  'device',      'VARCHAR(20)');
CALL add_col('guestbook',  'model',       'VARCHAR(100)');

-- visit_logs + guestbook 新增地理定位字段
CALL add_col('visit_logs', 'country',     'VARCHAR(50)');
CALL add_col('visit_logs', 'province',    'VARCHAR(50)');
CALL add_col('visit_logs', 'city',        'VARCHAR(50)');
CALL add_col('visit_logs', 'isp',         'VARCHAR(100)');
CALL add_col('guestbook',  'country',     'VARCHAR(50)');
CALL add_col('guestbook',  'province',    'VARCHAR(50)');
CALL add_col('guestbook',  'city',        'VARCHAR(50)');

-- posts: date DATE → DATETIME（不丢数据）
CALL mod_col('posts',      'date',        'DATETIME');

-- guestbook: date DATE → DATETIME（不丢数据）
CALL mod_col('guestbook',  'date',        'DATETIME');

-- songs 表重建（旧表数据会丢失，音乐播放列表可重新添加）
DROP TABLE IF EXISTS songs;
CREATE TABLE songs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    song_id BIGINT UNIQUE,
    title VARCHAR(200) NOT NULL,
    artist VARCHAR(100) DEFAULT '',
    album VARCHAR(200) DEFAULT '',
    url VARCHAR(1000) NOT NULL,
    play_url VARCHAR(1000),
    cover VARCHAR(1000),
    lyric_url LONGTEXT,
    duration INT DEFAULT 0,
    source_type VARCHAR(20) DEFAULT 'external',
    play_count INT DEFAULT 0,
    sort_order INT DEFAULT 0,
    create_time DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 访客点歌记录
CREATE TABLE IF NOT EXISTS guest_music_logs (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    ip VARCHAR(50),
    country VARCHAR(50),
    province VARCHAR(50),
    city VARCHAR(50),
    browser VARCHAR(50),
    os VARCHAR(50),
    device VARCHAR(20),
    model VARCHAR(100),
    song_title VARCHAR(200),
    song_artist VARCHAR(100),
    song_url VARCHAR(1000),
    source VARCHAR(20) DEFAULT 'search',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 清理
DROP PROCEDURE IF EXISTS add_col;
DROP PROCEDURE IF EXISTS mod_col;
