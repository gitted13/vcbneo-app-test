from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.types import FILE_SLOTS
from app.modules.ingestion.service import all_files_status, detect_dates_from_swift, file_status, slot_path
from app.modules.reconciliation.service import clear_cache

router = APIRouter()


@router.get("/status")
def get_status():
    return all_files_status()


@router.get("/status/{slot}")
def get_slot_status(slot: str):
    if slot not in FILE_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown slot: {slot}")
    return file_status(slot)


@router.post("/upload")
async def upload_file(slot: str = Form(...), file: UploadFile = File(...)):
    if slot not in FILE_SLOTS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown slot: {slot}")

    dest = slot_path(slot)
    content = await file.read()
    dest.write_bytes(content)

    clear_cache()

    info = file_status(slot)
    return {
        "success": True,
        "slot": slot,
        "filename": FILE_SLOTS[slot],
        "size": info["size"],
        "sheets": info["sheets"],
    }


@router.get("/dates")
def get_detected_dates():
    """Return sheet-based date labels available in the uploaded swift_di file."""
    return {"dates": detect_dates_from_swift()}
