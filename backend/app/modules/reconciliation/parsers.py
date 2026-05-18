"""
File loaders and parsers for all 5 input file types.
All functions take base_dir: Path instead of using a global constant.
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd

from app.core.types import FILE_SLOTS


# ── Low-level helpers ─────────────────────────────────────────────────────────

def fcol(df: pd.DataFrame, keywords: list[str], exclude: list[str] | None = None) -> str | None:
    kws = [k.upper() for k in keywords]
    exs = [e.upper() for e in (exclude or [])]
    for c in df.columns:
        cu = str(c).upper()
        if any(k in cu for k in kws) and not any(e in cu for e in exs):
            return c
    return None


def safe_int(v) -> int | None:
    try:
        if v is None or (isinstance(v, float) and np.isnan(v)):
            return None
        return int(float(v))
    except Exception:
        return None


def to_num(v, default: float = 0.0) -> float:
    try:
        r = float(v)
        return r if not np.isnan(r) else default
    except Exception:
        return default


def parse_hostdate(v) -> int | None:
    if v is None:
        return None
    if isinstance(v, float):
        if np.isnan(v):
            return None
        iv = int(v)
        return iv if iv > 0 else None
    if isinstance(v, int):
        return v if v > 0 else None
    s = str(v).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%Y", "%m/%d/%Y %H:%M:%S %p"):
        try:
            d = pd.to_datetime(s, format=fmt).date()
            return d.year * 10000 + d.month * 100 + d.day
        except Exception:
            pass
    try:
        d = pd.to_datetime(s).date()
        return d.year * 10000 + d.month * 100 + d.day
    except Exception:
        return None


def _find_header_row(xl: pd.ExcelFile, sheet: str, keywords: list[str]) -> int | None:
    raw = xl.parse(sheet, header=None)
    for i, row in raw.iterrows():
        vals = [str(v).strip().upper() for v in row if pd.notna(v)]
        if any(any(kw.upper() in v for kw in keywords) for v in vals):
            return i
    return None


# ── File loaders ──────────────────────────────────────────────────────────────

def load_swift_di(base_dir: Path) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    xl = pd.ExcelFile(base_dir / FILE_SLOTS["swift_di"], engine="openpyxl")
    for sheet in xl.sheet_names:
        hrow = _find_header_row(xl, sheet, ["SEQ", "TIỀN", "HOSTDATE"])
        if hrow is None:
            continue
        df = xl.parse(sheet, header=hrow).dropna(how="all")
        df.columns = [str(c).strip() for c in df.columns]
        seq_c = fcol(df, ["SEQ"], exclude=["TRACE"])
        if seq_c:
            df = df[pd.to_numeric(df[seq_c], errors="coerce").notna()].copy()
        result[sheet] = df
    return result


def load_swift_den(base_dir: Path) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    xl = pd.ExcelFile(base_dir / FILE_SLOTS["swift_den"], engine="openpyxl")
    for sheet in xl.sheet_names:
        hrow = _find_header_row(xl, sheet, ["SEQ", "TRACE", "TIỀN"])
        if hrow is None:
            continue
        df = xl.parse(sheet, header=hrow).dropna(how="all")
        df.columns = [str(c).strip() for c in df.columns]
        trace_c = fcol(df, ["TRACE"], exclude=["NUMBER"])
        if trace_c:
            df = df[pd.to_numeric(df[trace_c], errors="coerce").notna()].copy()
        result[sheet] = df
    return result


_RE_DI  = re.compile(r"^(\d+)-(\d+)-(\d+)\s+TRANSFER\s+CREDMBNEO\.(\d+)\.(\d+)", re.I)
_RE_DEN = re.compile(r"^(\d+)-(\d+)-(\d+)\s+TRANSFER\s+G/L(\d+)\.(\d{6})\.(\d+)", re.I)


def _parse_dg(s: str) -> dict:
    if not isinstance(s, str):
        return {}
    s = s.strip().strip('"').strip("'")
    m = _RE_DI.match(s)
    if m:
        return {"teller": int(m.group(2)), "seq": int(m.group(3)), "trace": int(m.group(5)), "kind": "DI"}
    m = _RE_DEN.match(s)
    if m:
        return {"teller": int(m.group(2)), "seq": int(m.group(3)), "trace": int(m.group(6)), "kind": "DEN"}
    return {}


def load_core(base_dir: Path) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    xl = pd.ExcelFile(base_dir / FILE_SLOTS["core"], engine="openpyxl")
    for sheet in xl.sheet_names:
        hrow = _find_header_row(xl, sheet, ["DIỄN GIẢI", "DIEN GIAI"])
        if hrow is None:
            hrow = _find_header_row(xl, sheet, ["STT", "NGÀY GIAO DỊCH"])
        if hrow is None:
            continue
        df = xl.parse(sheet, header=hrow).dropna(how="all")
        df.columns = [str(c).strip() for c in df.columns]
        dg_col = next(
            (c for c in df.columns if "DIỄN GIẢI" in c or "DIEN GIAI" in c.upper()),
            df.columns[-1],
        )
        parsed = df[dg_col].apply(_parse_dg)
        df["_teller"] = parsed.apply(lambda x: x.get("teller"))
        df["_seq"]    = parsed.apply(lambda x: x.get("seq"))
        df["_trace"]  = parsed.apply(lambda x: x.get("trace"))
        df["_kind"]   = parsed.apply(lambda x: x.get("kind"))
        result[sheet] = df
    return result


def load_napas_di(base_dir: Path, date_labels: list[str]) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    xl = pd.ExcelFile(base_dir / FILE_SLOTS["napas_di"], engine="openpyxl")
    for i, sheet in enumerate(xl.sheet_names):
        if i < len(date_labels):
            result[date_labels[i]] = xl.parse(sheet, header=0)
    return result


def load_napas_den(base_dir: Path, date_labels: list[str]) -> dict[str, pd.DataFrame]:
    result: dict[str, pd.DataFrame] = {}
    xl = pd.ExcelFile(base_dir / FILE_SLOTS["napas_den"], engine="openpyxl")
    for i, sheet in enumerate(xl.sheet_names):
        if i < len(date_labels):
            result[date_labels[i]] = xl.parse(sheet, header=0)
    return result


# ── DataFrame parsers ─────────────────────────────────────────────────────────

def parse_swift_df(df: pd.DataFrame, kind: str = "di") -> pd.DataFrame:
    df = df.copy()
    if kind == "di":
        seq_c   = fcol(df, ["SEQ"], exclude=["TRACE"])
        trace_c = fcol(df, ["TRACE NUMBER", "TRACE NUM"]) or fcol(df, ["TRACE"], exclude=["NUMBER"])
        amt_c   = fcol(df, ["SỐ TIỀN"], exclude=["PHÍ"])
        stat_c  = fcol(df, ["PHẢN HỒI"], exclude=["TRẠNG", "TÌNH", "TINH"])
        hdate_c = fcol(df, ["HOSTDATE"])
    else:
        seq_c   = fcol(df, ["SEQ"], exclude=["TRACE"])
        trace_c = fcol(df, ["TRACE"], exclude=["NUMBER"])
        amt_c   = fcol(df, ["SỐ TIỀN"], exclude=["PHÍ"])
        stat_c  = fcol(df, ["PHẢN HỒI"], exclude=["TRẠNG", "TÌNH", "TINH"])
        hdate_c = fcol(df, ["HOST DATE", "HOSTDATE"])

    df["_seq"]    = df[seq_c].apply(safe_int)   if seq_c   else None
    df["_trace"]  = df[trace_c].apply(safe_int) if trace_c else None
    df["_amt"]    = pd.to_numeric(df[amt_c], errors="coerce") if amt_c else np.nan
    df["_status"] = df[stat_c].astype(str).str.strip().str.upper() if stat_c else pd.Series(["UNKNOWN"] * len(df))
    df["_hdate"]  = df[hdate_c].apply(parse_hostdate) if hdate_c else None

    if kind == "den":
        df = df.dropna(subset=["_trace", "_amt"])
    else:
        df = df.dropna(subset=["_seq", "_amt"])
    return df


def _napas_find_cols(ndf: pd.DataFrame) -> tuple[str | None, str | None, str | None]:
    trace_c = amt_c = ngay_c = None
    for c in ndf.columns:
        cs = str(c).strip()
        if cs in ("Số trace", "Số Trace"):
            trace_c = c
        if cs in ("Số tiền", "Số Tiền") and "Phí" not in cs and "phí" not in cs:
            amt_c = c
        if cs in ("Ngày GD", "Ngày giao dịch"):
            ngay_c = c
    if not trace_c:
        trace_c = next((c for c in ndf.columns if "TRACE" in str(c).upper() and "TIỀN" not in str(c).upper()), None)
    if not amt_c:
        amt_c = next((c for c in ndf.columns if "tiền" in str(c).lower() and "phí" not in str(c).lower() and "fee" not in str(c).lower()), None)
    if not ngay_c:
        ngay_c = next((c for c in ndf.columns if "ngày" in str(c).lower() or "ngay" in str(c).lower()), None)
    return trace_c, amt_c, ngay_c


def _norm_ngay(v) -> str:
    if v is None or (isinstance(v, float) and np.isnan(v)):
        return ""
    if isinstance(v, (int, float)):
        return str(int(v)).zfill(4)
    s = str(v).strip()
    return s.zfill(4) if s.isdigit() else s


def parse_napas_df(ndf: pd.DataFrame) -> pd.DataFrame:
    ndf = ndf.copy()
    trace_c, amt_c, ngay_c = _napas_find_cols(ndf)
    if not trace_c or not amt_c:
        return pd.DataFrame()
    ndf["_trace"] = ndf[trace_c].apply(safe_int)
    ndf["_amt"]   = pd.to_numeric(ndf[amt_c], errors="coerce")
    ndf["_ngay"]  = ndf[ngay_c].apply(_norm_ngay) if ngay_c else ""
    ndf = ndf.dropna(subset=["_trace", "_amt"])
    ndf = ndf[ndf["_amt"] > 0]
    return ndf
