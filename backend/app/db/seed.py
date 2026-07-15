import json
from app.db.connection import db_cursor

# ── Reconcile join configs ────────────────────────────────────────────────────
# matchFields dùng tên field thực tế trong uploadedFileRows
# (sau khi user cấu hình schema đúng với file thật của họ)
_JOIN_CONFIGS = [
    {
        "name": "Swift vs NAPAS", "leftSource": "Swift", "rightSource": "NAPAS",
        "direction": "Đi", "joinType": "left",
        "matchFields": [
            {"left": "trace_number", "right": "số_trace"},
            {"left": "số_tiền",      "right": "số_tiền"},
        ],
    },
    {
        "name": "Swift vs NAPAS", "leftSource": "Swift", "rightSource": "NAPAS",
        "direction": "Đến", "joinType": "left",
        "matchFields": [
            {"left": "trace",   "right": "số_trace"},
            {"left": "số_tiền", "right": "số_tiền"},
        ],
    },
    {
        # Đi = ghi có (credit) per _ROW_FILTER in engine_flex.py và data flow
        # "Swift đi → NAPAS đi TC → Core Ghi có" (docs/handover.md).
        # teller thêm vào để tránh seq trùng giữa các ngày khác nhau (seq reset
        # theo ca/teller — xác nhận 5 trường hợp trùng thật trong dữ liệu sản
        # xuất, vd seq=1063 tồn tại cả ngày 02/02 và 03/02 với teller khác nhau).
        "name": "Swift vs Core", "leftSource": "Swift", "rightSource": "Core",
        "direction": "Đi", "joinType": "left",
        "matchFields": [
            {"left": "seq",     "right": "sequence"},
            {"left": "teller",  "right": "teller"},
            {"left": "số_tiền", "right": "số_tiền_ghi_có"},
        ],
    },
    {
        # Đến = ghi nợ (debit) — "Core Ghi nợ → NAPAS đến TC → Swift đến".
        "name": "Swift vs Core", "leftSource": "Swift", "rightSource": "Core",
        "direction": "Đến", "joinType": "left",
        "matchFields": [
            {"left": "seq",     "right": "sequence"},
            {"left": "teller",  "right": "teller"},
            {"left": "số_tiền", "right": "số_tiền_ghi_nợ"},
        ],
    },
    {
        "name": "Core vs NAPAS", "leftSource": "Core", "rightSource": "NAPAS",
        "direction": "Đi", "joinType": "left",
        "matchFields": [
            {"left": "trace",           "right": "số_trace"},
            {"left": "số_tiền_ghi_có", "right": "số_tiền"},
        ],
    },
    {
        "name": "Core vs NAPAS", "leftSource": "Core", "rightSource": "NAPAS",
        "direction": "Đến", "joinType": "left",
        "matchFields": [
            {"left": "trace",           "right": "số_trace"},
            {"left": "số_tiền_ghi_nợ", "right": "số_tiền"},
        ],
    },
]

def _F(f, op, v):
    return {"f": f, "op": op, "v": v}

def _rule(id_, label, color, *groups):
    """One self-describing status rule: matches if ANY group's chips ALL
    match (OR of ANDs). See migrate_status_rules() in engine_flex.py for
    the full rationale — labels/colors live on the rule itself now, not in
    a separate frontend array matched by position."""
    return {"id": id_, "label": label, "color": color, "groups": [g for g in groups if g]}

_STATUS_RULES = {
    "SWIFT_DI": [
        _rule("swift_di_0", "Thành công – Core ngày T", "#059669",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Thành công"), _F("Core","ne","null")]),
        _rule("swift_di_1", "Thành công – Core ngày T+1", "#0891b2",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Thành công"), _F("Core","ne","null")]),
        _rule("swift_di_2", "Timeout – Core ngày T", "#d97706",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Timeout"), _F("Core","ne","null")]),
        _rule("swift_di_3", "Timeout – Core ngày T+1", "#f59e0b",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Timeout"), _F("Core","ne","null")]),
        _rule("swift_di_4", "Thất bại – ngày T", "#6b7280",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Thất bại"), _F("Core","ne","null")]),
        _rule("swift_di_5", "Thất bại – ngày T+1", "#9ca3af",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Thất bại"), _F("Core","ne","null")]),
        _rule("swift_di_6", "Chỉ Swift", "#dc2626",
              [_F("Core","=","null")]),
    ],
    "SWIFT_DEN": [
        _rule("swift_den_0", "Thành công – Core ngày T", "#059669",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Thành công"), _F("Core","ne","null")]),
        _rule("swift_den_1", "Thành công – Core ngày T+1", "#0891b2",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Thành công"), _F("Core","ne","null")]),
        _rule("swift_den_2", "Timeout – Core ngày T", "#d97706",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Timeout"), _F("Core","ne","null")]),
        _rule("swift_den_3", "Timeout – Core ngày T+1", "#f59e0b",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Timeout"), _F("Core","ne","null")]),
        _rule("swift_den_4", "Thất bại – ngày T", "#6b7280",
              [_F("Ngày GD","=","Ngày GN"), _F("TT Swift","=","Thất bại"), _F("Core","ne","null")]),
        _rule("swift_den_5", "Thất bại – ngày T+1", "#9ca3af",
              [_F("Ngày GD","ne","Ngày GN"), _F("TT Swift","=","Thất bại"), _F("Core","ne","null")]),
        _rule("swift_den_6", "Chỉ Swift", "#dc2626",
              [_F("Core","=","null")]),
    ],
    "NAPAS_DI": [
        _rule("napas_di_0", "Thành công – NAPAS ngày T-1, Core ngày T", "#0891b2",
              [_F("Ngày NAPAS","<","Ngày Core"), _F("TC/KTC","=","TC"), _F("Core","ne","null")]),
        _rule("napas_di_1", "Thành công – NAPAS ngày T, Core ngày T", "#059669",
              [_F("Ngày NAPAS","=","Ngày Core"), _F("TC/KTC","=","TC"), _F("Core","ne","null")]),
        _rule("napas_di_2", "Không thành công (KTC)", "#dc2626",
              [_F("TC/KTC","=","KTC")]),
        _rule("napas_di_3", "Chỉ NAPAS TC – không có Core", "#d97706",
              [_F("TC/KTC","=","TC"), _F("Core","=","null")]),
    ],
    "NAPAS_DEN": [
        _rule("napas_den_0", "Thành công – Core ngày T-1", "#7c3aed",
              [_F("Ngày Core","<","Ngày NAPAS"), _F("Core","ne","null")]),
        _rule("napas_den_1", "Thành công – Core ngày T", "#059669",
              [_F("Ngày Core","=","Ngày NAPAS"), _F("Core","ne","null")]),
        _rule("napas_den_2", "Thành công – Core ngày T+1", "#0891b2",
              [_F("Ngày Core",">","Ngày NAPAS"), _F("Core","ne","null")]),
    ],
    "CORE_DI": [
        _rule("core_di_0", "Swift ngày T-1 – NAPAS ngày T", "#0891b2",
              [_F("Ngày NAPAS","<","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_di_1", "Swift ngày T – NAPAS ngày T", "#059669",
              [_F("Ngày NAPAS","=","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_di_2", "Swift ngày T – NAPAS ngày T+1", "#7c3aed",
              [_F("Ngày NAPAS",">","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_di_3", "Thất bại – không có trên NAPAS", "#d97706",
              [_F("TT Swift","=","Thất bại"), _F("Core","ne","null")]),
    ],
    "CORE_DEN": [
        _rule("core_den_0", "Core ngày T – NAPAS ngày T-1", "#0891b2",
              [_F("Ngày NAPAS","<","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_den_1", "Core ngày T – NAPAS ngày T", "#059669",
              [_F("Ngày NAPAS","=","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_den_2", "Core ngày T – NAPAS ngày T+1", "#7c3aed",
              [_F("Ngày NAPAS",">","Ngày Core"), _F("Core","ne","null")]),
        _rule("core_den_3", "Core có – không có NAPAS", "#d97706",
              [_F("Core","=","null")]),
    ],
}

SYSTEM = {"system_code": "reconcile", "system_name": "Đối soát VCBNeo"}

FILE_TYPE = {
    "file_type_name": "Excel",
    "file_extension": ".xlsx,.xls",
    "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
}

TYPES = [
    {
        "upload_name": "Swift Report đi",
        "fields_schema": {
            "type_code": "swift_di", "description": "",
            "unique_key": ["trace_number", "seq"],
            "columns": [
                {"col_name": "THỜI GIAN",         "field_name": "thời_gian",          "data_type": "string",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TK/THẺ CHUYỂN",     "field_name": "tk/thẻ_chuyển",      "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TÊN NGƯỜI CHUYỂN",  "field_name": "tên_người_chuyển",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NGÂN HÀNG NHẬN",    "field_name": "ngân_hàng_nhận",     "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TK/THẺ NHẬN",       "field_name": "tk/thẻ_nhận",        "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TÊN NGƯỜI HƯỞNG",   "field_name": "tên_người_hưởng",    "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TRACE NUMBER",       "field_name": "trace_number",       "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "SỐ TIỀN",            "field_name": "số_tiền",            "data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SỐ TIỀN PHÍ",       "field_name": "số_tiền_phí",        "data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NÔI DUNG GD",        "field_name": "nôi_dung_gd",        "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NGUỒN",              "field_name": "nguồn",              "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TELLER",             "field_name": "teller",             "data_type": "integer", "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SEQ",                "field_name": "seq",                "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "PCTIME",             "field_name": "pctime",             "data_type": "date",    "required": False, "allowed_values": [], "note": ""},
                {"col_name": "HOSTDATE",           "field_name": "hostdate",           "data_type": "date",    "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TINH TRẠNG PHẢN HỒI","field_name": "tinh_trạng_phản_hồi","data_type": "integer","required": False, "allowed_values": [], "note": ""},
                {"col_name": "PHẢN HỒI",           "field_name": "phản_hồi",           "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "CHI NHÁNH",          "field_name": "chi_nhánh",          "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "CHI NHÁNH XỬ LÝ",   "field_name": "chi_nhánh_xử_lý",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"field_name": "direction", "data_type": "string", "required": False, "allowed_values": [], "note": "", "fixed_value": "đi"},
            ],
        },
    },
    {
        "upload_name": "Swift Report đến",
        "fields_schema": {
            "type_code": "swift_den", "description": "",
            "unique_key": ["trace", "seq"],
            "columns": [
                {"col_name": "MESSAGE ID",         "field_name": "message_id",         "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "THỜI GIAN",          "field_name": "thời_gian",          "data_type": "datetime", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TK NGƯỜI CHUYỂN",    "field_name": "tk_người_chuyển",    "data_type": "integer",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TÊN NGƯỜI CHUYỂN",   "field_name": "tên_người_chuyển",   "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NGÂN HÀNG CHUYỂN",   "field_name": "ngân_hàng_chuyển",   "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TÀI KHOẢN HƯỞNG",   "field_name": "tài_khoản_hưởng",   "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TÊN NGƯỜI HƯỞNG",   "field_name": "tên_người_hưởng",    "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "CN QLTK",            "field_name": "cn_qltk",            "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SỐ TIỀN",            "field_name": "số_tiền",            "data_type": "number",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NÔI DUNG GD",        "field_name": "nôi_dung_gd",        "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"col_name": "HOST DATE",          "field_name": "host_date",          "data_type": "date",     "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TRACE",              "field_name": "trace",              "data_type": "integer",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TELLER",             "field_name": "teller",             "data_type": "integer",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SEQ",                "field_name": "seq",                "data_type": "integer",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "PCTIME",             "field_name": "pctime",             "data_type": "date",     "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TINH TRẠNG PHẢN HỒI","field_name": "tinh_trạng_phản_hồi","data_type": "integer", "required": False, "allowed_values": [], "note": ""},
                {"col_name": "PHẢN HỒI",           "field_name": "phản_hồi",           "data_type": "string",   "required": False, "allowed_values": [], "note": ""},
                {"field_name": "direction", "data_type": "string", "required": False, "allowed_values": [], "note": "", "fixed_value": "đến"},
            ],
        },
    },
    {
        "upload_name": "Core Banking",
        "fields_schema": {
            "type_code": "core_banking", "description": "",
            "unique_key": ["trace", "sequence", "số_tiền_ghi_nợ", "số_tiền_ghi_có"],
            "columns": [
                {"col_name": "STT",            "field_name": "stt",             "data_type": "integer", "required": False, "allowed_values": [], "note": ""},
                {"col_name": "NGÀY GIAO DỊCH", "field_name": "ngày_giao_dịch", "data_type": "date",    "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "TÀI KHOẢN",      "field_name": "tài_khoản",      "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SỐ CHỨNG TỪ",    "field_name": "số_chứng_từ",    "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SỐ TIỀN GHI NỢ", "field_name": "số_tiền_ghi_nợ","data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "SỐ TIỀN GHI CÓ", "field_name": "số_tiền_ghi_có","data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "TKDU",           "field_name": "tkdu",           "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "DIỄN GIẢI",      "field_name": "diễn_giải",      "data_type": "string",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "DIỄN GIẢI", "field_name": "teller",   "data_type": "string", "required": True, "allowed_values": [], "note": "",
                 "transform": {"type": "regex_extract", "pattern": "(?<=-)\\d+(?=-)", "group": 0}},
                {"col_name": "DIỄN GIẢI", "field_name": "sequence", "data_type": "string", "required": True, "allowed_values": [], "note": "",
                 "transform": {"type": "regex_extract", "pattern": "(?<=-)\\d+(?=\\s)", "group": 0}},
                {"col_name": "DIỄN GIẢI", "field_name": "trace",    "data_type": "string", "required": True, "allowed_values": [], "note": "",
                 "transform": {"type": "regex_extract", "pattern": "^[^.]+\\.[^.]+\\.(\\d+)", "group": 1}},
            ],
        },
    },
    {
        "upload_name": "Napas đi",
        "fields_schema": {
            "type_code": "napas_di", "description": "",
            "unique_key": ["số_trace", "ngày_gd", "giờ_gd", "số_tiền"],
            "columns": [
                {"col_name": "Số tài khoản/Số thẻ", "field_name": "số_tài_khoản/số_thẻ",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tiền",              "field_name": "số_tiền",                "data_type": "number",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Số trace",             "field_name": "số_trace",               "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Giờ GD",               "field_name": "giờ_gd",                 "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Ngày GD",              "field_name": "ngày_gd",                "data_type": "date",    "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Mã thiết bị",          "field_name": "mã_thiết_bị",            "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Mã ngân hàng chuyển",  "field_name": "mã_ngân_hàng_chuyển",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Mã ngân hàng nhận",    "field_name": "mã_ngân_hàng_nhận",     "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tài khoản chuyển",  "field_name": "số_tài_khoản_chuyển",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Phí dịch vụ",          "field_name": "phí_dịch_vụ",            "data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Phí chia sẻ rút tiền", "field_name": "phí_chia_sẻ_rút_tiền",  "data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Phí chia sẻ quẹt POS", "field_name": "phí_chia_sẻ_quẹt_pos", "data_type": "number",  "required": False, "allowed_values": [], "note": ""},
                {"field_name": "direction", "data_type": "string", "required": False, "allowed_values": [], "note": "", "fixed_value": "đi"},
            ],
        },
    },
    {
        "upload_name": "Napas đến",
        "fields_schema": {
            "type_code": "napas_den", "description": "",
            "unique_key": ["số_trace", "ngày_gd", "giờ_gd", "số_tiền"],
            "columns": [
                {"col_name": "Mã GD",               "field_name": "mã_gd",                "data_type": "integer", "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tài khoản chuyển", "field_name": "số_tài_khoản_chuyển",  "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tiền",             "field_name": "số_tiền",               "data_type": "number",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Số trace",            "field_name": "số_trace",              "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Giờ GD",              "field_name": "giờ_gd",                "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Ngày GD",             "field_name": "ngày_gd",               "data_type": "date",    "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Mã thiết bị",         "field_name": "mã_thiết_bị",           "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Mã ngân hàng chuyển", "field_name": "mã_ngân_hàng_chuyển",  "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Mã ngân hàng nhận",   "field_name": "mã_ngân_hàng_nhận",    "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tài khoản nhận",   "field_name": "số_tài_khoản_nhận",    "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Nội dung",            "field_name": "nội_dung",              "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"field_name": "direction", "data_type": "string", "required": False, "allowed_values": [], "note": "", "fixed_value": "đến"},
            ],
        },
    },
    {
        "upload_name": "Napas đi không thành công",
        "fields_schema": {
            "type_code": "napas_di_ktc", "description": "",
            "unique_key": ["số_trace", "ngày_gd", "giờ_gd", "số_tiền"],
            "columns": [
                {"col_name": "Mã GD",          "field_name": "mã_gd",          "data_type": "integer", "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số Tài khoản",   "field_name": "số_tài_khoản",   "data_type": "string",  "required": False, "allowed_values": [], "note": ""},
                {"col_name": "Số tiền",        "field_name": "số_tiền",        "data_type": "number",  "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Số trace",       "field_name": "số_trace",       "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Giờ GD",         "field_name": "giờ_gd",         "data_type": "integer", "required": True,  "allowed_values": [], "note": ""},
                {"col_name": "Ngày GD",        "field_name": "ngày_gd",        "data_type": "date",    "required": True,  "allowed_values": [], "note": ""},
                {"field_name": "direction", "data_type": "string", "required": False, "allowed_values": [], "note": "", "fixed_value": "đi"},
            ],
        },
    },
]


def init_reconcile_tables():
    try:
        with db_cursor() as cur:
            # ── Flex tables ───────────────────────────────────────────────────
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'systemCollection'
                )
                CREATE TABLE systemCollection (
                    id          INT IDENTITY(1,1) PRIMARY KEY,
                    system_code NVARCHAR(100) NOT NULL UNIQUE,
                    system_name NVARCHAR(255) NOT NULL,
                    is_active   BIT NOT NULL DEFAULT 1,
                    created     DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by  NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'uploadedFileTypes'
                )
                CREATE TABLE uploadedFileTypes (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    file_type_name  NVARCHAR(100) NOT NULL UNIQUE,
                    file_extension  NVARCHAR(100),
                    mime_type       NVARCHAR(255),
                    is_active       BIT NOT NULL DEFAULT 1,
                    created         DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by      NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'uploadedTypes'
                )
                CREATE TABLE uploadedTypes (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    system_id       INT NOT NULL,
                    file_type_id    INT NOT NULL,
                    upload_name     NVARCHAR(255) NOT NULL,
                    fields_schema   NVARCHAR(MAX),
                    is_active       BIT NOT NULL DEFAULT 1,
                    created         DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by      NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'uploadedFiles'
                )
                CREATE TABLE uploadedFiles (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    upload_type_id  INT NOT NULL,
                    original_name   NVARCHAR(500),
                    is_active       BIT NOT NULL DEFAULT 1,
                    error_detail    NVARCHAR(MAX),
                    created         DATETIME NOT NULL DEFAULT GETDATE(),
                    modified        DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by      NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'uploadedFileRows'
                )
                CREATE TABLE uploadedFileRows (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    upload_file_id  INT NOT NULL,
                    row_count       INT NOT NULL DEFAULT 0,
                    file_data       NVARCHAR(MAX),
                    created         DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by      NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            # ── Reconcile tables ──────────────────────────────────────────────
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'reconcileJoinConfigs'
                )
                CREATE TABLE reconcileJoinConfigs (
                    id          INT IDENTITY(1,1) PRIMARY KEY,
                    system_id   INT NOT NULL DEFAULT 1,
                    config_json NVARCHAR(MAX) NOT NULL,
                    is_active   BIT NOT NULL DEFAULT 1,
                    created     DATETIME NOT NULL DEFAULT GETDATE(),
                    created_by  NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'reconcileStatusRules'
                )
                CREATE TABLE reconcileStatusRules (
                    id          INT IDENTITY(1,1) PRIMARY KEY,
                    system_id   INT NOT NULL DEFAULT 1,
                    rules_json  NVARCHAR(MAX) NOT NULL,
                    updated     DATETIME NOT NULL DEFAULT GETDATE(),
                    updated_by  NVARCHAR(100) NOT NULL DEFAULT 'system'
                )
            """)
            cur.execute("""
                IF NOT EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES
                    WHERE TABLE_NAME = 'reconcileResults'
                )
                CREATE TABLE reconcileResults (
                    id              INT IDENTITY(1,1) PRIMARY KEY,
                    config_id       INT NOT NULL,
                    run_date        DATE NOT NULL,
                    left_type_id    INT NOT NULL,
                    right_type_id   INT,
                    left_row_id     INT NOT NULL,
                    matched_ids     NVARCHAR(MAX),
                    merged_data     NVARCHAR(MAX),
                    status          NVARCHAR(100),
                    status_override NVARCHAR(100),
                    is_stale        BIT NOT NULL DEFAULT 0,
                    config_snapshot NVARCHAR(MAX),
                    note            NVARCHAR(MAX),
                    resolved_by     NVARCHAR(100),
                    resolved_at     DATETIME,
                    created_by      NVARCHAR(100) NOT NULL DEFAULT 'system',
                    created         DATETIME NOT NULL DEFAULT GETDATE()
                )
            """)
        print("[init_reconcile_tables] OK")
    except Exception as exc:
        print(f"[init_reconcile_tables] error: {exc}")


def seed_flex():
    try:
        with db_cursor() as cur:
            cur.execute("SELECT id FROM systemCollection WHERE system_code = ?", SYSTEM["system_code"])
            row = cur.fetchone()
            if row:
                system_id = row[0]
            else:
                cur.execute(
                    "INSERT INTO systemCollection (system_code, system_name, is_active, created, created_by) OUTPUT INSERTED.id VALUES (?, ?, 1, GETDATE(), 'system')",
                    SYSTEM["system_code"], SYSTEM["system_name"],
                )
                system_id = cur.fetchone()[0]

            cur.execute("SELECT id FROM uploadedFileTypes WHERE file_type_name = ?", FILE_TYPE["file_type_name"])
            row = cur.fetchone()
            if row:
                file_type_id = row[0]
            else:
                cur.execute(
                    "INSERT INTO uploadedFileTypes (file_type_name, file_extension, mime_type, is_active, created, created_by) OUTPUT INSERTED.id VALUES (?, ?, ?, 1, GETDATE(), 'system')",
                    FILE_TYPE["file_type_name"], FILE_TYPE["file_extension"], FILE_TYPE["mime_type"],
                )
                file_type_id = cur.fetchone()[0]

            for t in TYPES:
                schema_json = json.dumps(t["fields_schema"], ensure_ascii=False)
                type_code = t["fields_schema"]["type_code"]
                # Match by type_code (stable, not user-editable) rather than
                # upload_name (editable in FileTypeSettings) — matching by
                # name meant renaming a seeded type made the seeder "lose
                # track" of it and re-insert a fresh duplicate on next
                # restart. Also: only INSERT when truly missing, never
                # UPDATE an existing row — this is seed data for a fresh DB,
                # not a sync-on-every-boot; overwriting fields_schema here
                # was silently reverting any column customization a user
                # made via FileTypeSettings every time the backend restarted.
                cur.execute(
                    "SELECT id FROM uploadedTypes WHERE system_id = ? AND JSON_VALUE(fields_schema, '$.type_code') = ?",
                    system_id, type_code,
                )
                if not cur.fetchone():
                    cur.execute(
                        "INSERT INTO uploadedTypes (system_id, file_type_id, upload_name, fields_schema, is_active, created, created_by) VALUES (?, ?, ?, ?, 1, GETDATE(), 'system')",
                        system_id, file_type_id, t["upload_name"], schema_json,
                    )

        print("[seed_flex] OK")
    except Exception as exc:
        print(f"[seed_flex] error: {exc}")


def seed_reconcile_configs():
    """Seed reconcileJoinConfigs và reconcileStatusRules nếu chưa có dữ liệu."""
    try:
        with db_cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM reconcileJoinConfigs")
            if cur.fetchone()[0] == 0:
                for cfg in _JOIN_CONFIGS:
                    cur.execute(
                        "INSERT INTO reconcileJoinConfigs (system_id, config_json, is_active, created_by) "
                        "VALUES (1, ?, 1, 'system')",
                        json.dumps(cfg, ensure_ascii=False),
                    )
                print(f"[seed_reconcile_configs] Inserted {len(_JOIN_CONFIGS)} join configs")
            else:
                print("[seed_reconcile_configs] Join configs already exist, skipped")

            cur.execute("SELECT COUNT(*) FROM reconcileStatusRules")
            if cur.fetchone()[0] == 0:
                cur.execute(
                    "INSERT INTO reconcileStatusRules (system_id, rules_json, updated_by) "
                    "VALUES (1, ?, 'system')",
                    json.dumps(_STATUS_RULES, ensure_ascii=False),
                )
                print("[seed_reconcile_configs] Inserted status rules")
            else:
                print("[seed_reconcile_configs] Status rules already exist, skipped")
    except Exception as exc:
        print(f"[seed_reconcile_configs] error: {exc}")
