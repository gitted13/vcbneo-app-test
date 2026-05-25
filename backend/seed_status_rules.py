"""
Seed status classification rules into reconcileStatusRules.
Values use ASCII-safe lowercase to match 'phản_hồi' field values
case-insensitively: 'THANH CONG', 'TIMEOUT', 'THAT BAI' etc.
The engine uses .lower() comparison so 'thanh cong' matches 'THANH CONG'.
"""
import sys
sys.stdout.reconfigure(encoding='utf-8')
import pyodbc, json

conn = pyodbc.connect(
    'DRIVER={ODBC Driver 17 for SQL Server};'
    'SERVER=DESKTOP-HD3AQVG;'
    'DATABASE=Test_JSONTypeDB;'
    'Trusted_Connection=yes;'
)

# Chip helper
def F(f, op, v):
    return {'f': f, 'op': op, 'v': v}

DEFAULT_CONDS = {
    # Swift vs Core — Swift làm gốc (joins with Core)
    # TT Swift values in DB: 'THANH CONG', 'TIMEOUT', 'THAT BAI'
    # Engine uses .lower() so 'thanh cong' matches 'THANH CONG'
    'SWIFT_DI': [
        [F('TT Swift','=','thanh cong'), F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','thanh cong'), F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
        [F('TT Swift','=','timeout'),    F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','timeout'),    F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
        [F('TT Swift','=','that bai'),   F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','that bai'),   F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
        [F('Core','=','null')],
    ],
    'SWIFT_DEN': [
        [F('TT Swift','=','thanh cong'), F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','thanh cong'), F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
        [F('TT Swift','=','timeout'),    F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','timeout'),    F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
        [F('TT Swift','=','that bai'),   F('Ngay GD','=','Ngay GN'),  F('Core','ne','null')],
        [F('TT Swift','=','that bai'),   F('Ngay GD','ne','Ngay GN'), F('Core','ne','null')],
    ],
    # NAPAS vs Core — NAPAS làm gốc (joins with Core)
    # NAPAS has no explicit TC/KTC field — matched rows are TC, unmatched are KTC
    # So simplify: matched = TC_KHOP_T or TC_KHOP_T1, unmatched = TC_KHONG_CORE
    'NAPAS_DI': [
        [F('Ngay NAPAS','<','Ngay Core'), F('Core','ne','null')],   # TC_KHOP_T: NAPAS before Core
        [F('Ngay NAPAS','=','Ngay Core'), F('Core','ne','null')],   # TC_KHOP_T1: same day
        [],                                                           # KTC: from napas_di_ktc type (unmatched)
        [F('Core','=','null')],                                      # TC_KHONG_CORE
    ],
    'NAPAS_DEN': [
        [F('Ngay Core','<','Ngay NAPAS'), F('Core','ne','null')],
        [F('Ngay Core','=','Ngay NAPAS'), F('Core','ne','null')],
        [F('Ngay Core','>','Ngay NAPAS'), F('Core','ne','null')],
    ],
    # Core vs NAPAS — Core làm gốc (joins with NAPAS)
    'CORE_DI': [
        [F('Ngay NAPAS','<','Ngay Core'), F('Core','ne','null')],
        [F('Ngay NAPAS','=','Ngay Core'), F('Core','ne','null')],
        [F('Ngay NAPAS','>','Ngay Core'), F('Core','ne','null')],
        [F('TT Swift','=','that bai'),    F('Core','ne','null')],
    ],
    'CORE_DEN': [
        [F('Ngay NAPAS','<','Ngay Core'), F('Core','ne','null')],
        [F('Ngay NAPAS','=','Ngay Core'), F('Core','ne','null')],
        [F('Ngay NAPAS','>','Ngay Core'), F('Core','ne','null')],
        [F('Core','ne','null'), F('Core','=','null')],  # CHI_CORE: always false = fallback only
    ],
}

cur = conn.cursor()
rules_json = json.dumps(DEFAULT_CONDS, ensure_ascii=False)

cur.execute('SELECT TOP 1 id FROM reconcileStatusRules ORDER BY id DESC')
existing = cur.fetchone()
if existing:
    cur.execute(
        'UPDATE reconcileStatusRules SET rules_json = ?, updated = GETDATE(), updated_by = ? WHERE id = ?',
        rules_json, 'system', existing[0]
    )
    print(f'Updated existing row id={existing[0]}')
else:
    cur.execute(
        'INSERT INTO reconcileStatusRules (rules_json, updated_by) VALUES (?, ?)',
        rules_json, 'system'
    )
    print('Inserted new row')

conn.commit()
conn.close()
print('Status rules saved.')
