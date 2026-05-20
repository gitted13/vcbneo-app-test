-- ============================================================
--  VCBNeo Reconciliation Schema  –  SQL Server (MSSQL)
--  3 raw tables  +  3 recon tables (auto-populated via triggers)
-- ============================================================

-- ─── RAW TABLES ───────────────────────────────────────────────────────────────

CREATE TABLE swift_raw (
    id          INT            IDENTITY(1,1) PRIMARY KEY,
    period      DATE           NOT NULL,          -- ngày sheet GD (DD/MM → DATE)
    direction   NVARCHAR(4)    NOT NULL,          -- 'Di' | 'Den'
    trace       NVARCHAR(20)   NOT NULL,
    sequence    NVARCHAR(20)   NULL,
    txn_date    DATE           NOT NULL,          -- ngày GD thực tế (THỜI GIAN col)
    host_date   DATE           NOT NULL,          -- ngày ghi nhận (HOSTDATE col)
    amount      BIGINT         NOT NULL,
    status      NVARCHAR(20)   NOT NULL,          -- THANH_CONG | TIMEOUT | THAT_BAI
    created_at  DATETIME2      DEFAULT SYSDATETIME(),
    CONSTRAINT uq_swift UNIQUE (period, direction, trace, amount)
);

CREATE TABLE napas_raw (
    id          INT            IDENTITY(1,1) PRIMARY KEY,
    period      DATE           NOT NULL,
    direction   NVARCHAR(4)    NOT NULL,
    trace       NVARCHAR(20)   NOT NULL,
    txn_date    DATE           NOT NULL,          -- ngày NAPAS ghi nhận (MMDD → DATE)
    txn_time    NVARCHAR(5)    NULL,              -- 'HH:MM' từ cột HHMMSS
    amount      BIGINT         NOT NULL,
    failed      BIT            NOT NULL DEFAULT 0, -- 0=TC, 1=KTC
    napas_type  NVARCHAR(2)    NOT NULL DEFAULT 'GD', -- 'GD' | 'QT'
    created_at  DATETIME2      DEFAULT SYSDATETIME(),
    CONSTRAINT uq_napas UNIQUE (period, direction, trace, amount)
);

CREATE TABLE core_raw (
    id          INT            IDENTITY(1,1) PRIMARY KEY,
    period      DATE           NOT NULL,
    direction   NVARCHAR(4)    NOT NULL,          -- 'Di' (Ghi có) | 'Den' (Ghi nợ)
    trace       NVARCHAR(20)   NULL,              -- từ CRED_PAT (Đi) hoặc NULL (Đến)
    sequence    NVARCHAR(20)   NULL,              -- từ description pattern
    txn_date    DATE           NOT NULL,
    amount      BIGINT         NOT NULL,
    entry_type  NVARCHAR(8)    NOT NULL,          -- 'Ghi co' | 'Ghi no'
    description NVARCHAR(500)  NULL,
    created_at  DATETIME2      DEFAULT SYSDATETIME(),
    CONSTRAINT uq_core UNIQUE (period, direction, sequence, amount)
);

-- Indexes cho matching
CREATE INDEX ix_swift_trace_amt  ON swift_raw (trace, amount, direction);
CREATE INDEX ix_napas_trace_amt  ON napas_raw (trace, amount, direction);
CREATE INDEX ix_core_trace_amt   ON core_raw  (trace, amount, direction);
CREATE INDEX ix_core_seq_amt     ON core_raw  (sequence, amount, direction);

-- ─── RECON TABLES ─────────────────────────────────────────────────────────────

CREATE TABLE swift_core_recon (
    id              INT          IDENTITY(1,1) PRIMARY KEY,
    period          DATE         NOT NULL,
    direction       NVARCHAR(4)  NOT NULL,
    trace           NVARCHAR(20) NOT NULL,
    sequence        NVARCHAR(20) NULL,
    amount          BIGINT       NOT NULL,
    -- FK
    swift_id        INT          NULL REFERENCES swift_raw(id),
    core_id         INT          NULL REFERENCES core_raw(id),
    -- denorm Swift
    swift_txn_date  DATE         NULL,
    swift_host_date DATE         NULL,
    swift_status    NVARCHAR(20) NULL,
    -- denorm Core
    core_date       DATE         NULL,
    core_entry      NVARCHAR(8)  NULL,
    -- recon
    recon_status    NVARCHAR(30) NOT NULL,
    resolved_by     NVARCHAR(100) NULL,
    resolved_at     DATETIME2    NULL,
    note            NVARCHAR(MAX) NULL,
    created_at      DATETIME2    DEFAULT SYSDATETIME(),
    updated_at      DATETIME2    DEFAULT SYSDATETIME(),
    CONSTRAINT uq_sc_recon UNIQUE (period, direction, trace, amount)
);

CREATE TABLE napas_core_recon (
    id              INT          IDENTITY(1,1) PRIMARY KEY,
    period          DATE         NOT NULL,
    direction       NVARCHAR(4)  NOT NULL,
    trace           NVARCHAR(20) NOT NULL,
    amount          BIGINT       NOT NULL,
    -- FK
    napas_id        INT          NULL REFERENCES napas_raw(id),
    core_id         INT          NULL REFERENCES core_raw(id),
    -- denorm NAPAS
    napas_date      DATE         NULL,
    napas_time      NVARCHAR(5)  NULL,
    napas_type      NVARCHAR(2)  NULL,
    napas_failed    BIT          NULL,
    -- denorm Core
    core_date       DATE         NULL,
    core_entry      NVARCHAR(8)  NULL,
    -- recon
    recon_status    NVARCHAR(30) NOT NULL,
    resolved_by     NVARCHAR(100) NULL,
    resolved_at     DATETIME2    NULL,
    note            NVARCHAR(MAX) NULL,
    created_at      DATETIME2    DEFAULT SYSDATETIME(),
    updated_at      DATETIME2    DEFAULT SYSDATETIME(),
    CONSTRAINT uq_nc_recon UNIQUE (period, direction, trace, amount)
);

CREATE TABLE master_recon (
    id              INT          IDENTITY(1,1) PRIMARY KEY,
    period          DATE         NOT NULL,
    direction       NVARCHAR(4)  NOT NULL,
    trace           NVARCHAR(20) NOT NULL,
    sequence        NVARCHAR(20) NULL,
    amount          BIGINT       NOT NULL,
    -- FK
    swift_id        INT          NULL REFERENCES swift_raw(id),
    napas_id        INT          NULL REFERENCES napas_raw(id),
    core_id         INT          NULL REFERENCES core_raw(id),
    -- denorm Swift
    swift_txn_date  DATE         NULL,
    swift_host_date DATE         NULL,
    swift_status    NVARCHAR(20) NULL,
    -- denorm NAPAS
    napas_date      DATE         NULL,
    napas_time      NVARCHAR(5)  NULL,
    napas_type      NVARCHAR(2)  NULL,
    napas_failed    BIT          NULL,
    -- denorm Core
    core_date       DATE         NULL,
    core_entry      NVARCHAR(8)  NULL,
    -- recon
    recon_status    NVARCHAR(30) NOT NULL,
    resolved_by     NVARCHAR(100) NULL,
    resolved_at     DATETIME2    NULL,
    note            NVARCHAR(MAX) NULL,
    created_at      DATETIME2    DEFAULT SYSDATETIME(),
    updated_at      DATETIME2    DEFAULT SYSDATETIME(),
    CONSTRAINT uq_master UNIQUE (period, direction, trace, amount)
);

-- ─── HELPER FUNCTION: tính recon_status từ các trường Swift ─────────────────

CREATE FUNCTION dbo.fn_swift_recon_status (
    @status    NVARCHAR(20),
    @host_date DATE,
    @txn_date  DATE,
    @core_id   INT
) RETURNS NVARCHAR(30) AS
BEGIN
    RETURN CASE
        WHEN @core_id IS NULL AND @status = 'TIMEOUT'  THEN 'SWIFT_TIMEOUT'
        WHEN @core_id IS NULL AND @status = 'THAT_BAI' THEN 'SWIFT_THAT_BAI'
        WHEN @core_id IS NULL                           THEN 'CHI_SWIFT'
        WHEN @status = 'TIMEOUT'                        THEN 'TIMEOUT_CO_CORE'
        WHEN @host_date <> @txn_date                    THEN 'KHOP_LECH_NGAY'
        ELSE 'KHOP'
    END
END;
GO

-- ─── TRIGGER 1: swift_raw → cập nhật swift_core_recon + master_recon ─────────

CREATE TRIGGER trg_swift_recon
ON swift_raw
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- swift_core_recon
    MERGE swift_core_recon AS tgt
    USING (
        SELECT
            i.id            AS swift_id,
            i.period, i.direction, i.trace, i.sequence, i.amount,
            i.txn_date      AS swift_txn_date,
            i.host_date     AS swift_host_date,
            i.status        AS swift_status,
            c.id            AS core_id,
            c.txn_date      AS core_date,
            c.entry_type    AS core_entry,
            dbo.fn_swift_recon_status(i.status, i.host_date, i.txn_date, c.id) AS recon_status
        FROM inserted i
        LEFT JOIN core_raw c
            ON c.trace = i.trace AND c.amount = i.amount AND c.direction = i.direction
    ) AS src
    ON  tgt.period = src.period AND tgt.direction = src.direction
    AND tgt.trace  = src.trace  AND tgt.amount    = src.amount
    WHEN MATCHED THEN UPDATE SET
        swift_id        = src.swift_id,        core_id         = src.core_id,
        swift_txn_date  = src.swift_txn_date,  swift_host_date = src.swift_host_date,
        swift_status    = src.swift_status,    core_date       = src.core_date,
        core_entry      = src.core_entry,      recon_status    = src.recon_status,
        updated_at      = SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT
        (period, direction, trace, sequence, amount,
         swift_id, core_id, swift_txn_date, swift_host_date, swift_status,
         core_date, core_entry, recon_status)
    VALUES
        (src.period, src.direction, src.trace, src.sequence, src.amount,
         src.swift_id, src.core_id, src.swift_txn_date, src.swift_host_date, src.swift_status,
         src.core_date, src.core_entry, src.recon_status);

    -- master_recon
    MERGE master_recon AS tgt
    USING (
        SELECT
            i.id            AS swift_id,
            i.period, i.direction, i.trace, i.sequence, i.amount,
            i.txn_date      AS swift_txn_date,
            i.host_date     AS swift_host_date,
            i.status        AS swift_status,
            c.id            AS core_id,
            c.txn_date      AS core_date,
            c.entry_type    AS core_entry,
            n.id            AS napas_id,
            n.txn_date      AS napas_date,
            n.txn_time      AS napas_time,
            n.napas_type,
            n.failed        AS napas_failed,
            dbo.fn_swift_recon_status(i.status, i.host_date, i.txn_date, c.id) AS recon_status
        FROM inserted i
        LEFT JOIN core_raw  c ON c.trace  = i.trace AND c.amount = i.amount AND c.direction = i.direction
        LEFT JOIN napas_raw n ON n.trace  = i.trace AND n.amount = i.amount AND n.direction = i.direction
                              AND n.failed = 0
    ) AS src
    ON  tgt.period = src.period AND tgt.direction = src.direction
    AND tgt.trace  = src.trace  AND tgt.amount    = src.amount
    WHEN MATCHED THEN UPDATE SET
        swift_id        = src.swift_id,        core_id         = src.core_id,
        napas_id        = src.napas_id,
        swift_txn_date  = src.swift_txn_date,  swift_host_date = src.swift_host_date,
        swift_status    = src.swift_status,    core_date       = src.core_date,
        core_entry      = src.core_entry,      napas_date      = src.napas_date,
        napas_time      = src.napas_time,      napas_type      = src.napas_type,
        napas_failed    = src.napas_failed,    recon_status    = src.recon_status,
        updated_at      = SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT
        (period, direction, trace, sequence, amount,
         swift_id, core_id, napas_id,
         swift_txn_date, swift_host_date, swift_status,
         core_date, core_entry, napas_date, napas_time, napas_type, napas_failed,
         recon_status)
    VALUES
        (src.period, src.direction, src.trace, src.sequence, src.amount,
         src.swift_id, src.core_id, src.napas_id,
         src.swift_txn_date, src.swift_host_date, src.swift_status,
         src.core_date, src.core_entry, src.napas_date, src.napas_time, src.napas_type, src.napas_failed,
         src.recon_status);
END;
GO

-- ─── TRIGGER 2: napas_raw → cập nhật napas_core_recon + master_recon ─────────

CREATE TRIGGER trg_napas_recon
ON napas_raw
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- napas_core_recon
    MERGE napas_core_recon AS tgt
    USING (
        SELECT
            i.id            AS napas_id,
            i.period, i.direction, i.trace, i.amount,
            i.txn_date      AS napas_date,
            i.txn_time      AS napas_time,
            i.napas_type, i.failed AS napas_failed,
            c.id            AS core_id,
            c.txn_date      AS core_date,
            c.entry_type    AS core_entry,
            CASE
                WHEN i.failed = 1  THEN 'NAPAS_THAT_BAI'
                WHEN c.id IS NULL  THEN 'CHI_NAPAS'
                WHEN i.txn_date <> c.txn_date THEN 'KHOP_LECH_NGAY'
                ELSE 'KHOP'
            END AS recon_status
        FROM inserted i
        LEFT JOIN core_raw c ON c.trace = i.trace AND c.amount = i.amount AND c.direction = i.direction
    ) AS src
    ON  tgt.period = src.period AND tgt.direction = src.direction
    AND tgt.trace  = src.trace  AND tgt.amount    = src.amount
    WHEN MATCHED THEN UPDATE SET
        napas_id     = src.napas_id,    core_id      = src.core_id,
        napas_date   = src.napas_date,  napas_time   = src.napas_time,
        napas_type   = src.napas_type,  napas_failed = src.napas_failed,
        core_date    = src.core_date,   core_entry   = src.core_entry,
        recon_status = src.recon_status, updated_at  = SYSDATETIME()
    WHEN NOT MATCHED THEN INSERT
        (period, direction, trace, amount, napas_id, core_id,
         napas_date, napas_time, napas_type, napas_failed, core_date, core_entry, recon_status)
    VALUES
        (src.period, src.direction, src.trace, src.amount, src.napas_id, src.core_id,
         src.napas_date, src.napas_time, src.napas_type, src.napas_failed,
         src.core_date, src.core_entry, src.recon_status);

    -- master_recon: bổ sung napas cho các row swift đã có
    UPDATE mr SET
        napas_id     = i.id,
        napas_date   = i.txn_date,
        napas_time   = i.txn_time,
        napas_type   = i.napas_type,
        napas_failed = i.failed,
        updated_at   = SYSDATETIME()
    FROM master_recon mr
    JOIN inserted i ON i.trace = mr.trace AND i.amount = mr.amount AND i.direction = mr.direction
    WHERE i.failed = 0;
END;
GO

-- ─── TRIGGER 3: core_raw → cập nhật các recon tables ─────────────────────────

CREATE TRIGGER trg_core_recon
ON core_raw
AFTER INSERT, UPDATE
AS
BEGIN
    SET NOCOUNT ON;

    -- swift_core_recon: bổ sung core cho các swift row đã có
    UPDATE sc SET
        core_id      = i.id,
        core_date    = i.txn_date,
        core_entry   = i.entry_type,
        recon_status = dbo.fn_swift_recon_status(sc.swift_status, sc.swift_host_date, sc.swift_txn_date, i.id),
        updated_at   = SYSDATETIME()
    FROM swift_core_recon sc
    JOIN inserted i ON i.trace = sc.trace AND i.amount = sc.amount AND i.direction = sc.direction;

    -- napas_core_recon: bổ sung core cho các napas row đã có
    UPDATE nc SET
        core_id      = i.id,
        core_date    = i.txn_date,
        core_entry   = i.entry_type,
        recon_status = CASE
            WHEN nc.napas_failed = 1     THEN 'NAPAS_THAT_BAI'
            WHEN nc.napas_date <> i.txn_date THEN 'KHOP_LECH_NGAY'
            ELSE 'KHOP'
        END,
        updated_at   = SYSDATETIME()
    FROM napas_core_recon nc
    JOIN inserted i ON i.trace = nc.trace AND i.amount = nc.amount AND i.direction = nc.direction;

    -- master_recon: bổ sung core
    UPDATE mr SET
        core_id      = i.id,
        core_date    = i.txn_date,
        core_entry   = i.entry_type,
        recon_status = dbo.fn_swift_recon_status(mr.swift_status, mr.swift_host_date, mr.swift_txn_date, i.id),
        updated_at   = SYSDATETIME()
    FROM master_recon mr
    JOIN inserted i ON i.trace = mr.trace AND i.amount = mr.amount AND i.direction = mr.direction;
END;
GO
