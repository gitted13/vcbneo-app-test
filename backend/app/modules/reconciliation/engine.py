"""
Core reconciliation engine.
All date-specific constants are passed in via DateConfig — no globals.
"""
from __future__ import annotations

import datetime
from pathlib import Path

import pandas as pd

from app.core.types import DateConfig
from app.modules.reconciliation.parsers import (
    load_napas_di,
    load_napas_den,
    load_swift_di,
    load_swift_den,
    parse_napas_df,
    parse_swift_df,
    safe_int,
    to_num,
)


# ── Date config builder ───────────────────────────────────────────────────────

def build_date_configs(labels: list[str], year: int) -> list[DateConfig]:
    """
    Convert sheet name labels like ['01.02', '02.02'] into DateConfig objects.
    The year is required to compute YYYYMMDD core dates and DDMM napas keys.
    """
    configs: list[DateConfig] = []
    for i, label in enumerate(labels):
        day, month = int(label[:2]), int(label[3:])
        date = datetime.date(year, month, day)
        next_date = date + datetime.timedelta(days=1)
        prev_date = date - datetime.timedelta(days=1)
        configs.append(DateConfig(
            label=label,
            core_date=date.year * 10000 + date.month * 100 + date.day,
            next_core_date=next_date.year * 10000 + next_date.month * 100 + next_date.day,
            napas_date=f"{date.month:02d}{date.day:02d}",
            napas_prev=f"{prev_date.month:02d}{prev_date.day:02d}",
            prev_label=labels[i - 1] if i > 0 else None,
            next_label=labels[i + 1] if i < len(labels) - 1 else None,
        ))
    return configs


# ── Main reconcile function ───────────────────────────────────────────────────

def reconcile_one_day(
    cfg: DateConfig,
    sdi_all: dict[str, pd.DataFrame],
    sden_all: dict[str, pd.DataFrame],
    napas_di_all: dict[str, pd.DataFrame],
    napas_den_all: dict[str, pd.DataFrame],
) -> dict:
    res: dict = {}

    def _stats(df_sub: pd.DataFrame, pfx: str):
        res[f"{pfx}_cnt"] = len(df_sub)
        res[f"{pfx}_amt"] = float(df_sub["_amt"].sum()) if len(df_sub) > 0 else 0.0

    def _zero(pfx: str):
        res[f"{pfx}_cnt"] = 0
        res[f"{pfx}_amt"] = 0.0

    # ── OUTGOING (ĐI) ─────────────────────────────────────────────────────────
    sdi = sdi_all.get(cfg.label, pd.DataFrame())

    if sdi.empty:
        for k in ["di_swift", "di_coreT_success", "di_coreT_timeout", "di_coreT_fail",
                  "di_coreT1_success", "di_coreT1_timeout", "di_coreT1_fail",
                  "di_gl_T", "di_gl_prev_T", "di_gl_T_napas_T", "di_gl_T_napas_T1",
                  "di_gl_fail", "di_napas_T", "di_napas_prev_core", "di_napas_core_T", "di_napas_fail"]:
            _zero(k)
    else:
        dT   = sdi[sdi["_hdate"] == cfg.core_date]
        dT1  = sdi[sdi["_hdate"] == cfg.next_core_date]

        _stats(sdi, "di_swift")
        _stats(dT[dT["_status"] == "THANH CONG"],   "di_coreT_success")
        _stats(dT[dT["_status"] == "TIMEOUT"],       "di_coreT_timeout")
        _stats(dT[dT["_status"] == "THAT BAI"],      "di_coreT_fail")
        _stats(dT1[dT1["_status"] == "THANH CONG"], "di_coreT1_success")
        _stats(dT1[dT1["_status"] == "TIMEOUT"],    "di_coreT1_timeout")
        _stats(dT1[dT1["_status"] == "THAT BAI"],   "di_coreT1_fail")

        prev_sdi   = sdi_all.get(cfg.prev_label, pd.DataFrame()) if cfg.prev_label else pd.DataFrame()
        prev_T1    = prev_sdi[prev_sdi["_hdate"] == cfg.core_date] if not prev_sdi.empty else pd.DataFrame(columns=sdi.columns)
        gl_T_all   = pd.concat([dT, prev_T1], ignore_index=True)
        _stats(gl_T_all, "di_gl_T")

        ndi_raw = napas_di_all.get(cfg.label, pd.DataFrame())
        ndi = parse_napas_df(ndi_raw) if not ndi_raw.empty else pd.DataFrame()
        _stats(ndi, "di_napas_T")

        if not ndi.empty and not gl_T_all.empty:
            ndi_same = ndi[ndi["_ngay"] == cfg.napas_date]
            ndi_prev = ndi[ndi["_ngay"] == cfg.napas_prev]

            napas_same_set = {(safe_int(t), int(round(float(a)))) for t, a in zip(ndi_same["_trace"], ndi_same["_amt"]) if safe_int(t)}
            napas_prev_set = {(safe_int(t), int(round(float(a)))) for t, a in zip(ndi_prev["_trace"],  ndi_prev["_amt"])  if safe_int(t)}

            prev_T1_set: set = set()
            if not prev_T1.empty:
                for _, r in prev_T1.iterrows():
                    t = safe_int(r["_trace"]); a = int(round(to_num(r["_amt"])))
                    if t and a > 0:
                        prev_T1_set.add((t, a))

            dT_set: set = set()
            for _, r in dT.iterrows():
                t = safe_int(r["_trace"]); a = int(round(to_num(r["_amt"])))
                if t and a > 0:
                    dT_set.add((t, a))

            matched_prev = [(t, a) for (t, a) in prev_T1_set if (t, a) in napas_prev_set]
            _stats(pd.DataFrame({"_amt": [a for _, a in matched_prev]}), "di_gl_prev_T")
            res["di_gl_prev_T_cnt"] = len(matched_prev)

            napas_T_full = napas_same_set | napas_prev_set
            dT_in_ndi_same = dT[dT.apply(lambda r: (safe_int(r["_trace"]), int(round(to_num(r["_amt"])))) in napas_same_set, axis=1)]
            dT_that_bai = dT[dT["_status"] == "THAT BAI"]
            dT_that_bai_not_in_same = dT_that_bai[~dT_that_bai.apply(lambda r: (safe_int(r["_trace"]), int(round(to_num(r["_amt"])))) in napas_same_set, axis=1)]
            gl_napasT_df = pd.concat([dT_in_ndi_same, dT_that_bai_not_in_same], ignore_index=True)
            _stats(gl_napasT_df, "di_gl_T_napas_T")
            res["di_gl_T_napas_T_cnt"] = len(gl_napasT_df)

            ndi_next_raw = napas_di_all.get(cfg.next_label, pd.DataFrame()) if cfg.next_label else pd.DataFrame()
            if not ndi_next_raw.empty:
                ndi_next = parse_napas_df(ndi_next_raw)
                ndi_next_today = ndi_next[ndi_next["_ngay"] == cfg.napas_date]
                napas_T1_set = {(safe_int(t), int(round(float(a)))) for t, a in zip(ndi_next_today["_trace"], ndi_next_today["_amt"]) if safe_int(t)}
            else:
                napas_T1_set = set()

            dT_candidates_T1 = dT[~dT.apply(lambda r: (safe_int(r["_trace"]), int(round(to_num(r["_amt"])))) in napas_same_set, axis=1) & (dT["_status"] != "THAT BAI")]
            dT_cand_keys = {(safe_int(r["_trace"]), int(round(to_num(r["_amt"])))) for _, r in dT_candidates_T1.iterrows() if safe_int(r["_trace"])}
            matched_T1 = [(t, a) for (t, a) in dT_cand_keys if (t, a) in napas_T1_set]
            _stats(pd.DataFrame({"_amt": [a for _, a in matched_T1]}), "di_gl_T_napas_T1")
            res["di_gl_T_napas_T1_cnt"] = len(matched_T1)

            prev_T1_unmatched = [(t, a) for (t, a) in prev_T1_set if (t, a) not in napas_T_full]
            _stats(pd.DataFrame({"_amt": [a for _, a in prev_T1_unmatched]}), "di_gl_fail")
            res["di_gl_fail_cnt"] = len(prev_T1_unmatched)

            matched_prev_keys = set(matched_prev)
            ndi_prev_matched   = ndi_prev[ndi_prev.apply(lambda r: (safe_int(r["_trace"]), int(round(float(r["_amt"])))) in matched_prev_keys, axis=1)]
            ndi_prev_unmatched = ndi_prev[~ndi_prev.apply(lambda r: (safe_int(r["_trace"]), int(round(float(r["_amt"])))) in matched_prev_keys, axis=1)]
            napas_T_df = pd.concat([ndi_same, ndi_prev_matched], ignore_index=True)
            _stats(napas_T_df, "di_napas_core_T")
            _stats(ndi_prev_unmatched, "di_napas_prev_core")
            _stats(dT[dT["_status"] == "THAT BAI"], "di_napas_fail")
        else:
            for k in ["di_gl_prev_T", "di_gl_T_napas_T", "di_gl_T_napas_T1", "di_gl_fail",
                      "di_napas_prev_core", "di_napas_core_T", "di_napas_fail"]:
                _zero(k)

    # ── INCOMING (ĐẾN) ────────────────────────────────────────────────────────
    sden = sden_all.get(cfg.label, pd.DataFrame())

    if sden.empty:
        for k in ["den_swift", "den_coreT_success", "den_coreT_fail",
                  "den_coreT1_success", "den_coreT1_fail",
                  "den_gl_T", "den_gl_prev_T", "den_gl_T_napas_T", "den_gl_T_napas_T1",
                  "den_gl_fail", "den_napas_T", "den_napas_prev_core", "den_napas_core_T",
                  "den_napas_timeout", "den_napas_coreT1"]:
            _zero(k)
    else:
        dT2  = sden[sden["_hdate"] == cfg.core_date]
        dT12 = sden[sden["_hdate"] == cfg.next_core_date]
        den_fail_all = sden[sden["_status"] == "THAT BAI"]

        _stats(sden, "den_swift")
        _stats(dT2[dT2["_status"] == "THANH CONG"],   "den_coreT_success")
        _stats(den_fail_all,                            "den_coreT_fail")
        _stats(dT12[dT12["_status"] == "THANH CONG"], "den_coreT1_success")
        _stats(dT12[dT12["_status"] == "THAT BAI"],   "den_coreT1_fail")

        prev_sden  = sden_all.get(cfg.prev_label, pd.DataFrame()) if cfg.prev_label else pd.DataFrame()
        prev_T1_den = prev_sden[prev_sden["_hdate"] == cfg.core_date] if not prev_sden.empty else pd.DataFrame(columns=sden.columns)
        gl_T_den = pd.concat([dT2, prev_T1_den], ignore_index=True)
        _stats(gl_T_den, "den_gl_T")

        nden_raw = napas_den_all.get(cfg.label, pd.DataFrame())
        nden = parse_napas_df(nden_raw) if not nden_raw.empty else pd.DataFrame()
        _stats(nden, "den_napas_T")

        if not nden.empty and not gl_T_den.empty:
            nden_same = nden[nden["_ngay"] == cfg.napas_date]
            nden_prev = nden[nden["_ngay"] == cfg.napas_prev]

            napas_same_set2 = {(safe_int(t), int(round(float(a)))) for t, a in zip(nden_same["_trace"], nden_same["_amt"]) if safe_int(t)}
            napas_prev_set2 = {(safe_int(t), int(round(float(a)))) for t, a in zip(nden_prev["_trace"],  nden_prev["_amt"])  if safe_int(t)}
            napas_full_set2 = napas_same_set2 | napas_prev_set2

            prev_T1_den_set: set = set()
            if not prev_T1_den.empty:
                for _, r in prev_T1_den.iterrows():
                    t = safe_int(r["_trace"]); a = int(round(to_num(r["_amt"])))
                    if t and a > 0:
                        prev_T1_den_set.add((t, a))

            dT2_set: set = set()
            for _, r in dT2.iterrows():
                t = safe_int(r["_trace"]); a = int(round(to_num(r["_amt"])))
                if t and a > 0:
                    dT2_set.add((t, a))

            matched_prev_den = [(t, a) for (t, a) in prev_T1_den_set if (t, a) in napas_full_set2]
            _stats(pd.DataFrame({"_amt": [a for _, a in matched_prev_den]}), "den_gl_prev_T")
            res["den_gl_prev_T_cnt"] = len(matched_prev_den)

            matched_same_den = [(t, a) for (t, a) in dT2_set if (t, a) in napas_same_set2]
            _stats(pd.DataFrame({"_amt": [a for _, a in matched_same_den]}), "den_gl_T_napas_T")
            res["den_gl_T_napas_T_cnt"] = len(matched_same_den)

            nden_next_raw = napas_den_all.get(cfg.next_label, pd.DataFrame()) if cfg.next_label else pd.DataFrame()
            if not nden_next_raw.empty:
                nden_next = parse_napas_df(nden_next_raw)
                nden_next_today = nden_next[nden_next["_ngay"] == cfg.napas_date]
                napas_T1_set2 = {(safe_int(t), int(round(float(a)))) for t, a in zip(nden_next_today["_trace"], nden_next_today["_amt"]) if safe_int(t)}
            else:
                napas_T1_set2 = set()

            unmatched_dT2 = [(t, a) for (t, a) in dT2_set if (t, a) not in napas_same_set2]
            matched_T1_den = [(t, a) for (t, a) in unmatched_dT2 if (t, a) in napas_T1_set2]
            _stats(pd.DataFrame({"_amt": [a for _, a in matched_T1_den]}), "den_gl_T_napas_T1")
            res["den_gl_T_napas_T1_cnt"] = len(matched_T1_den)

            still2 = [(t, a) for (t, a) in unmatched_dT2 if (t, a) not in napas_T1_set2]
            _stats(pd.DataFrame({"_amt": [a for _, a in still2]}), "den_gl_fail")
            res["den_gl_fail_cnt"] = len(still2)

            gl_T_den_set = dT2_set | prev_T1_den_set
            nden_matched_gl = nden[nden.apply(lambda r: (safe_int(r["_trace"]), int(round(float(r["_amt"])))) in gl_T_den_set, axis=1)]
            _stats(nden_matched_gl, "den_napas_core_T")

            nden_prev_unmatched = nden_prev[~nden_prev.apply(lambda r: (safe_int(r["_trace"]), int(round(float(r["_amt"])))) in gl_T_den_set, axis=1)]
            _stats(nden_prev_unmatched, "den_napas_prev_core")

            nden_same_timeout = nden_same[~nden_same.apply(lambda r: (safe_int(r["_trace"]), int(round(float(r["_amt"])))) in gl_T_den_set, axis=1)]
            _stats(nden_same_timeout, "den_napas_timeout")
            res["den_napas_timeout_cnt"] = len(nden_same_timeout)

            _stats(pd.DataFrame({"_amt": [a for _, a in matched_T1_den]}), "den_napas_coreT1")
            res["den_napas_coreT1_cnt"] = len(matched_T1_den)
            _zero("den_napas_fail")
        else:
            for k in ["den_gl_prev_T", "den_gl_T_napas_T", "den_gl_T_napas_T1", "den_gl_fail",
                      "den_napas_prev_core", "den_napas_core_T", "den_napas_timeout",
                      "den_napas_coreT1", "den_napas_fail"]:
                _zero(k)

    return res


def run_all(base_dir: Path, date_labels: list[str], year: int) -> dict[str, dict]:
    configs = build_date_configs(date_labels, year)

    sdi_raw  = load_swift_di(base_dir)
    sden_raw = load_swift_den(base_dir)
    ndi_all  = load_napas_di(base_dir, date_labels)
    nden_all = load_napas_den(base_dir, date_labels)

    sdi_all  = {d: parse_swift_df(df, "di")  for d, df in sdi_raw.items()}
    sden_all = {d: parse_swift_df(df, "den") for d, df in sden_raw.items()}

    return {cfg.label: reconcile_one_day(cfg, sdi_all, sden_all, ndi_all, nden_all) for cfg in configs}
