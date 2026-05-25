import os
import pyodbc
from contextlib import contextmanager

_server   = os.getenv("DB_SERVER",   "DESKTOP-HD3AQVG")
_database = os.getenv("DB_NAME",     "Test_JSONTypeDB")
_user     = os.getenv("DB_USER",     "")
_password = os.getenv("DB_PASSWORD", "")

# Windows Auth when no user/password; SQL Server Auth otherwise (Linux/Docker)
if _user:
    _CONN_STR = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={_server};"
        f"DATABASE={_database};"
        f"UID={_user};"
        f"PWD={_password};"
        "TrustServerCertificate=yes;"
    )
else:
    _CONN_STR = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={_server};"
        f"DATABASE={_database};"
        "Trusted_Connection=yes;"
    )


def get_connection() -> pyodbc.Connection:
    return pyodbc.connect(_CONN_STR, timeout=10)


def ensure_database() -> None:
    """Create target database if it does not exist (needed on fresh Docker SQL Server)."""
    if not _user:
        return  # Windows Auth — assume DB already exists
    master_str = _CONN_STR.replace(f"DATABASE={_database};", "DATABASE=master;")
    conn = pyodbc.connect(master_str, timeout=10, autocommit=True)
    try:
        conn.execute(
            f"IF NOT EXISTS (SELECT 1 FROM sys.databases WHERE name = N'{_database}') "
            f"CREATE DATABASE [{_database}]"
        )
    finally:
        conn.close()


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
