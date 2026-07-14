import os
import pyodbc
from contextlib import contextmanager

# Explicit — this is already pyodbc's default, but Linux/Docker (production)
# relies on unixODBC's own pooling config, which we can't verify from here.
# Setting it explicitly costs nothing and guards against a future pyodbc
# version changing its default.
pyodbc.pooling = True

_server   = os.getenv("DB_SERVER",   "DESKTOP-HD3AQVG")
_database = os.getenv("DB_NAME",     "Test_JSONTypeDB")
_user     = os.getenv("DB_USER",     "")
_password = os.getenv("DB_PASSWORD", "")
_sa_pass  = os.getenv("SA_PASSWORD", _password)  # chỉ dùng khi tạo DB lần đầu

# Windows Auth (local dev) vs SQL Server Auth (Docker/Linux)
if _user:
    _CONN_STR = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={_server};DATABASE={_database};"
        f"UID={_user};PWD={_password};"
        "TrustServerCertificate=yes;"
    )
    _MASTER_STR = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={_server};DATABASE=master;"
        f"UID=sa;PWD={_sa_pass};"
        "TrustServerCertificate=yes;"
    )
else:
    _CONN_STR = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={_server};DATABASE={_database};"
        "Trusted_Connection=yes;"
    )
    _MASTER_STR = _CONN_STR.replace(f"DATABASE={_database};", "DATABASE=master;")


def get_connection() -> pyodbc.Connection:
    return pyodbc.connect(_CONN_STR, timeout=10)


def get_master_connection() -> pyodbc.Connection:
    return pyodbc.connect(_MASTER_STR, timeout=10)


def ensure_database() -> None:
    """
    Tạo database và app user nếu chưa có.
    Chỉ chạy trên Docker/Linux (khi DB_USER được set).
    Dùng sa (SA_PASSWORD) để khởi tạo, app dùng DB_USER bình thường sau đó.
    """
    if not _user:
        return

    # Bước 1: Dùng sa kết nối master → tạo DB + login
    conn = get_master_connection()
    conn.autocommit = True
    try:
        conn.execute(
            f"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'{_database}') "
            f"CREATE DATABASE [{_database}]"
        )
        if _user.lower() != "sa":
            conn.execute(
                f"IF NOT EXISTS (SELECT 1 FROM sys.server_principals WHERE name = N'{_user}') "
                f"CREATE LOGIN [{_user}] WITH PASSWORD = N'{_password}', CHECK_POLICY = OFF"
            )
    finally:
        conn.close()

    # Bước 2: Dùng sa kết nối vcbneo → tạo DB user + gán quyền
    if _user.lower() != "sa":
        db_str = _MASTER_STR.replace("DATABASE=master;", f"DATABASE={_database};")
        conn2 = pyodbc.connect(db_str, timeout=10, autocommit=True)
        try:
            conn2.execute(
                f"IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'{_user}') "
                f"CREATE USER [{_user}] FOR LOGIN [{_user}]"
            )
            conn2.execute(f"ALTER ROLE db_owner ADD MEMBER [{_user}]")
        finally:
            conn2.close()

    print(f"[DB] server={_server}  database={_database}  user={_user}")


@contextmanager
def db_cursor():
    conn = get_connection()
    try:
        cur = conn.cursor()
        yield cur
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
