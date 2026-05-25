"""Cập nhật join configs để dùng đúng field amount cho Core."""
import json, sys, urllib.request
sys.stdout.reconfigure(encoding='utf-8')

BASE = "http://127.0.0.1:8000/api/v1/reconcile/join-configs"

configs_to_update = [
    {
        "id": 3,
        "config": {
            "name": "Swift vs Core",
            "leftSource": "Swift",
            "rightSource": "Core",
            "direction": "Đi",
            "joinType": "left",
            "matchFields": [
                {"left": "seq", "right": "sequence"},
                {"left": "số_tiền", "right": "số_tiền_ghi_có"},
            ],
        },
    },
    {
        "id": 4,
        "config": {
            "name": "Swift vs Core",
            "leftSource": "Swift",
            "rightSource": "Core",
            "direction": "Đến",
            "joinType": "left",
            "matchFields": [
                {"left": "seq", "right": "sequence"},
                {"left": "số_tiền", "right": "số_tiền_ghi_nợ"},
            ],
        },
    },
    {
        "id": 5,
        "config": {
            "name": "Core vs NAPAS",
            "leftSource": "Core",
            "rightSource": "NAPAS",
            "direction": "Đi",
            "joinType": "left",
            "matchFields": [
                {"left": "trace", "right": "số_trace"},
                {"left": "số_tiền_ghi_có", "right": "số_tiền"},
            ],
        },
    },
    {
        "id": 6,
        "config": {
            "name": "Core vs NAPAS",
            "leftSource": "Core",
            "rightSource": "NAPAS",
            "direction": "Đến",
            "joinType": "left",
            "matchFields": [
                {"left": "trace", "right": "số_trace"},
                {"left": "số_tiền_ghi_nợ", "right": "số_tiền"},
            ],
        },
    },
]

for item in configs_to_update:
    cfg_id = item["id"]
    body = json.dumps({"config": item["config"], "created_by": "admin"}, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE}/{cfg_id}",
        data=body,
        method="PATCH",
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
        print(f"Config {cfg_id} updated: {result}")
