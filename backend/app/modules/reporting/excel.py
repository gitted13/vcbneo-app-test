"""
Excel report writer — produces the same TONG_HOP output as the original script.
"""
import io

import numpy as np
import xlwt

from app.modules.reconciliation.engine import build_date_configs


def _make_style(bold=False, num_fmt="General", align="left", bg=None):
    st = xlwt.XFStyle()
    f = xlwt.Font()
    f.name = "Times New Roman"; f.height = 220; f.bold = bold
    st.font = f
    al = xlwt.Alignment(); al.wrap = 1
    al.horz = (xlwt.Alignment.HORZ_CENTER if align == "center" else
               xlwt.Alignment.HORZ_RIGHT  if align == "right"  else
               xlwt.Alignment.HORZ_LEFT)
    al.vert = xlwt.Alignment.VERT_CENTER
    st.alignment = al
    if num_fmt != "General":
        st.num_format_str = num_fmt
    if bg is not None:
        pat = xlwt.Pattern()
        pat.pattern = xlwt.Pattern.SOLID_PATTERN
        pat.pattern_fore_colour = bg
        st.pattern = pat
    return st


def build_excel(results: dict[str, dict], date_labels: list[str], year: int) -> bytes:
    configs = build_date_configs(date_labels, year)
    label_to_display = {cfg.label: f"{year}-{cfg.label[3:]}-{cfg.label[:2]}" for cfg in configs}

    wb = xlwt.Workbook(encoding="utf-8")
    st_title = _make_style(bold=True, align="center")
    st_hdr   = _make_style(bold=True, align="center", bg=22)
    st_data  = _make_style(align="left")
    st_num   = _make_style(align="right", num_fmt="#,##0")
    st_date  = _make_style(align="center")

    def w(ws, r, c, v, style=None):
        ws.write(r, c, v, style or st_data)

    def wn(ws, r, c, v):
        if v is None:
            ws.write(r, c, "", st_num); return
        try:
            fv = float(v)
        except Exception:
            ws.write(r, c, "", st_num); return
        if np.isnan(fv):
            ws.write(r, c, "", st_num)
        elif fv == 0:
            ws.write(r, c, 0, st_num)
        else:
            ws.write(r, c, int(round(fv)), st_num)

    def whdr(ws, row, col, text, span=1):
        ws.write(row, col, text, st_hdr)
        for cc in range(col + 1, col + span):
            ws.write(row, cc, "", st_hdr)

    R6, R7, R8 = 6, 7, 8

    # ── Sheet ĐI ─────────────────────────────────────────────────────────────
    ws_di = wb.add_sheet("ĐI- ĐỐI CHIẾU NAPAS")
    w(ws_di, 0, 0, "NGÂN HÀNG TM TNHH MTV XÂY DỰNG VIỆT NAM", st_title)
    w(ws_di, 1, 0, "ĐƠN VỊ: TTTT", st_title)
    w(ws_di, 3, 0, "BẢNG TỔNG HỢP THEO DÕI GIAO DỊCH ĐI QUA KÊNH NAPAS", st_title)

    whdr(ws_di, R6, 0, "Ngày")
    whdr(ws_di, R6, 1, "Nội dung")
    whdr(ws_di, R6, 2, "Tổng phát sinh trên Swift", 2)
    whdr(ws_di, R6, 4, "Ghi nhận Core ngày T", 6)
    whdr(ws_di, R6, 10, "Ghi nhận Core ngày T+1", 6)
    whdr(ws_di, R6, 16, "Số phát sinh trên tài khoản GL 270411311 ngày T", 10)
    whdr(ws_di, R6, 26, "Số quyết toán Napas ngày T", 8)
    whdr(ws_di, R6, 34, "Nguyên nhân/ghi chú")

    whdr(ws_di, R7, 4,  "Trạng thái Thành công ghi nhận trên Core ngày T", 2)
    whdr(ws_di, R7, 6,  "Trạng thái Timeout ghi nhận trên Core ngày T", 2)
    whdr(ws_di, R7, 8,  "Trạng thái Thất bại ghi nhận trên Core ngày T", 2)
    whdr(ws_di, R7, 10, "Thành công ngày T+1", 2)
    whdr(ws_di, R7, 12, "Timeout ngày T+1", 2)
    whdr(ws_di, R7, 14, "Thất bại ngày T+1", 2)
    whdr(ws_di, R7, 16, "Tổng số", 2)
    whdr(ws_di, R7, 18, "Số phát sinh ngày T-1 đối chiếu với Napas ngày T", 2)
    whdr(ws_di, R7, 20, "Số phát sinh đối chiếu với Napas ngày T", 2)
    whdr(ws_di, R7, 22, "Số phát sinh trên Swift ngày T đối chiếu với Napas ngày T+1", 2)
    whdr(ws_di, R7, 24, "Giao dịch thất bại có số Trace không ps bên Napas", 2)
    whdr(ws_di, R7, 26, "Tổng giao dịch thành công", 2)
    whdr(ws_di, R7, 28, "Giao dịch thành công trên Core ngày T-1, napas QT ngày T", 2)
    whdr(ws_di, R7, 30, "Giao dịch thành công ngày T", 2)
    whdr(ws_di, R7, 32, "Giao dịch không thành công", 2)

    for c in range(2, 34):
        w(ws_di, R8, c, "Số món" if c % 2 == 0 else "Số tiền", st_hdr)
    w(ws_di, R8, 0, "", st_hdr); w(ws_di, R8, 1, "", st_hdr); w(ws_di, R8, 34, "", st_hdr)

    for ri, label in enumerate(date_labels):
        r = results.get(label, {})
        row = 9 + ri
        w(ws_di, row, 0, label_to_display[label], st_date)
        w(ws_di, row, 1, "Giao dịch chuyển tiền đi 24/7")
        cols = [
            "di_swift_cnt", "di_swift_amt",
            "di_coreT_success_cnt", "di_coreT_success_amt",
            "di_coreT_timeout_cnt", "di_coreT_timeout_amt",
            "di_coreT_fail_cnt", "di_coreT_fail_amt",
            "di_coreT1_success_cnt", "di_coreT1_success_amt",
            "di_coreT1_timeout_cnt", "di_coreT1_timeout_amt",
            "di_coreT1_fail_cnt", "di_coreT1_fail_amt",
            "di_gl_T_cnt", "di_gl_T_amt",
            "di_gl_prev_T_cnt", "di_gl_prev_T_amt",
            "di_gl_T_napas_T_cnt", "di_gl_T_napas_T_amt",
            "di_gl_T_napas_T1_cnt", "di_gl_T_napas_T1_amt",
            "di_gl_fail_cnt", "di_gl_fail_amt",
            "di_napas_T_cnt", "di_napas_T_amt",
            "di_napas_prev_core_cnt", "di_napas_prev_core_amt",
            "di_napas_core_T_cnt", "di_napas_core_T_amt",
            "di_napas_fail_cnt", "di_napas_fail_amt",
        ]
        for ci, key in enumerate(cols):
            wn(ws_di, row, ci + 2, r.get(key, 0))

    # ── Sheet ĐẾN ────────────────────────────────────────────────────────────
    ws_den = wb.add_sheet("ĐẾN -ĐỐI CHIEU NAPAS")
    w(ws_den, 0, 0, "NGÂN HÀNG TM TNHH MTV XÂY DỰNG VIỆT NAM", st_title)
    w(ws_den, 1, 0, "ĐƠN VỊ: TTTT", st_title)
    w(ws_den, 3, 0, "BẢNG TỔNG HỢP THEO DÕI GIAO DỊCH ĐẾN QUA KÊNH NAPAS", st_title)

    whdr(ws_den, R6, 0, "Ngày")
    whdr(ws_den, R6, 1, "Nội dung")
    whdr(ws_den, R6, 2, "Tổng phát sinh trên Swift", 2)
    whdr(ws_den, R6, 4, "Ghi nhận Core ngày T và T+1", 8)
    whdr(ws_den, R6, 12, "Số phát sinh trên tài khoản GL 270411311 ngày T", 8)
    whdr(ws_den, R6, 20, "Số quyết toán Napas ngày T", 8)
    whdr(ws_den, R6, 28, "Nguyên nhân/ghi chú")

    whdr(ws_den, R7, 4,  "Trạng thái Thành công trên Core ngày T", 2)
    whdr(ws_den, R7, 6,  "Trạng thái Thất bại ngày T", 2)
    whdr(ws_den, R7, 8,  "Trạng thái Thành công trên Core ngày T+1", 2)
    whdr(ws_den, R7, 10, "Trạng thái Thất bại ngày T+1", 2)
    whdr(ws_den, R7, 12, "Tổng số", 2)
    whdr(ws_den, R7, 14, "Số phát sinh ngày T-1 đối chiếu với Napas ngày T", 2)
    whdr(ws_den, R7, 16, "Số phát sinh đối chiếu với Napas ngày T", 2)
    whdr(ws_den, R7, 18, "Số phát sinh đối chiếu với Napas ngày T+1", 2)
    whdr(ws_den, R7, 20, "Giao dịch thành công", 2)
    whdr(ws_den, R7, 22, "Giao dịch Vneo đã ghi nhận Core ngày T-1", 2)
    whdr(ws_den, R7, 24, "Giao dịch Vneo đã ghi nhận Core ngày T", 2)
    whdr(ws_den, R7, 26, "Giao dịch Vneo chưa ghi nhận Core (Timeout)", 2)

    for c in range(2, 28):
        w(ws_den, R8, c, "Số món" if c % 2 == 0 else "Số tiền", st_hdr)
    w(ws_den, R8, 0, "", st_hdr); w(ws_den, R8, 1, "", st_hdr); w(ws_den, R8, 28, "", st_hdr)

    for ri, label in enumerate(date_labels):
        r = results.get(label, {})
        row = 9 + ri
        w(ws_den, row, 0, label_to_display[label], st_date)
        w(ws_den, row, 1, "Giao dịch chuyển tiền đến 24/7")
        cols = [
            "den_swift_cnt", "den_swift_amt",
            "den_coreT_success_cnt", "den_coreT_success_amt",
            "den_coreT_fail_cnt", "den_coreT_fail_amt",
            "den_coreT1_success_cnt", "den_coreT1_success_amt",
            "den_coreT1_fail_cnt", "den_coreT1_fail_amt",
            "den_gl_T_cnt", "den_gl_T_amt",
            "den_gl_prev_T_cnt", "den_gl_prev_T_amt",
            "den_gl_T_napas_T_cnt", "den_gl_T_napas_T_amt",
            "den_gl_T_napas_T1_cnt", "den_gl_T_napas_T1_amt",
            "den_napas_T_cnt", "den_napas_T_amt",
            "den_napas_prev_core_cnt", "den_napas_prev_core_amt",
            "den_napas_core_T_cnt", "den_napas_core_T_amt",
            "den_napas_timeout_cnt", "den_napas_timeout_amt",
        ]
        for ci, key in enumerate(cols):
            wn(ws_den, row, ci + 2, r.get(key, 0))

    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()
