from dataclasses import dataclass


FILE_SLOTS: dict[str, str] = {
    "swift_di":  "Swift report đi.xlsx",
    "swift_den": "Swift report đến.xlsx",
    "core":      "Core.xlsx",
    "napas_di":  "Napas đi.xlsx",
    "napas_den": "Napas đến.xlsx",
}


@dataclass
class DateConfig:
    """All date-related constants for one reporting day."""
    label: str          # e.g. '01.02'
    core_date: int      # e.g. 20260201
    next_core_date: int # e.g. 20260202
    napas_date: str     # e.g. '0201'  (DDMM, same-day Napas)
    napas_prev: str     # e.g. '0131'  (DDMM, T-1 Napas entries)
    prev_label: str | None
    next_label: str | None
