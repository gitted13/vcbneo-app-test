-- Run once against Test_JSONTypeDB to seed systems + types
-- Check if already seeded
IF NOT EXISTS (SELECT 1 FROM uploadedSystems WHERE code = 'reconcile')
BEGIN
    INSERT INTO uploadedSystems (code, name, description, is_active)
    VALUES ('reconcile', N'Đối soát VCBNeo', N'Hệ thống đối soát SWIFT/NAPAS/Core GL', 1)
END

DECLARE @sys_id INT = (SELECT id FROM uploadedSystems WHERE code = 'reconcile')

-- Swift Report Đi
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'swift_di')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'swift_di', N'Swift Report Đi', 'DI',
N'[
  {"key":"seq",      "label":"SEQ",          "type":"integer","required":true},
  {"key":"trace",    "label":"TRACE NUMBER",  "type":"integer","required":true},
  {"key":"hostdate", "label":"HOSTDATE",      "type":"date",   "required":true},
  {"key":"amount",   "label":"SỐ TIỀN",       "type":"number", "required":true},
  {"key":"status",   "label":"PHẢN HỒI",      "type":"string", "required":true,"allowedValues":["THANH CONG","TIMEOUT","THAT BAI"]}
]', 1)

-- Swift Report Đến
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'swift_den')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'swift_den', N'Swift Report Đến', 'DEN',
N'[
  {"key":"seq",      "label":"SEQ",       "type":"integer","required":false},
  {"key":"trace",    "label":"TRACE",     "type":"integer","required":true},
  {"key":"hostdate", "label":"HOST DATE", "type":"date",   "required":true},
  {"key":"amount",   "label":"SỐ TIỀN",   "type":"number", "required":true},
  {"key":"status",   "label":"PHẢN HỒI",  "type":"string", "required":true,"allowedValues":["THANH CONG","THAT BAI"]}
]', 1)

-- Core Banking
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'core')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'core', N'Core (Ghi có / Ghi nợ)', NULL,
N'[
  {"key":"dien_giai","label":"DIỄN GIẢI","type":"string", "required":true},
  {"key":"teller",   "label":"TELLER",   "type":"integer","required":false},
  {"key":"seq",      "label":"SEQ",      "type":"integer","required":false},
  {"key":"trace",    "label":"TRACE",    "type":"integer","required":false},
  {"key":"kind",     "label":"Loại GD",  "type":"string", "required":false,"allowedValues":["DI","DEN"]}
]', 1)

-- NAPAS Đi
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'napas_di')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'napas_di', N'Napas Đi', 'DI',
N'[
  {"key":"trace",  "label":"Số trace","type":"integer","required":true},
  {"key":"amount", "label":"Số tiền", "type":"number", "required":true},
  {"key":"ngay",   "label":"Ngày GD", "type":"string", "required":true}
]', 1)

-- NAPAS Đến
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'napas_den')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'napas_den', N'Napas Đến', 'DEN',
N'[
  {"key":"trace",  "label":"Số trace","type":"integer","required":true},
  {"key":"amount", "label":"Số tiền", "type":"number", "required":true},
  {"key":"ngay",   "label":"Ngày GD", "type":"string", "required":true}
]', 1)

-- NAPAS Đi Không thành công
IF NOT EXISTS (SELECT 1 FROM uploadedTypes WHERE type_code = 'napas_di_fail')
INSERT INTO uploadedTypes (system_id, type_code, type_name, direction, fields_schema, is_active)
VALUES (@sys_id, 'napas_di_fail', N'Napas Đi Không thành công', 'DI',
N'[
  {"key":"trace",  "label":"Số trace","type":"integer","required":true},
  {"key":"amount", "label":"Số tiền", "type":"number", "required":true}
]', 1)

SELECT t.id, t.type_code, t.type_name FROM uploadedTypes t WHERE t.system_id = @sys_id ORDER BY t.id
