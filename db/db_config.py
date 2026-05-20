"""Cấu hình kết nối MSSQL dùng chung cho tất cả extract script."""
import pyodbc

CONNECTION_STRING = (
    "DRIVER={ODBC Driver 17 for SQL Server};"
    "SERVER=localhost;"
    "DATABASE=vcbneo;"
    "Trusted_Connection=yes;"
)

def get_conn():
    return pyodbc.connect(CONNECTION_STRING)
