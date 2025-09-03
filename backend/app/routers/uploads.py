from fastapi import APIRouter, UploadFile, File, Request, HTTPException
import os
from uuid import uuid4
from ..config.settings import settings

router = APIRouter(prefix="/upload", tags=["uploads"])

@router.post("/photo")
async def upload_photo(request: Request, file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files are allowed.")
    ext = os.path.splitext(file.filename or "")[1].lower() or ".jpg"
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]:
        ext = ".jpg"

    data = await file.read()
    if len(data) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 5MB).")

    name = f"{uuid4().hex}{ext}"
    (settings.UPLOADS_DIR / name).write_bytes(data)

    base = str(request.base_url).rstrip("/")
    url = f"{base}/uploads/{name}"
    return {"ok": True, "url": url, "path": f"/uploads/{name}"}
