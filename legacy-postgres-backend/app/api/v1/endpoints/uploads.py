from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel

from app.api.v1.deps import get_current_business
from app.models.business import Business
from app.services.storage import get_storage_provider

router = APIRouter(prefix="/uploads", tags=["uploads"])


class UploadOut(BaseModel):
    url: str


@router.post("/image", response_model=UploadOut)
def upload_image(file: UploadFile = File(...), business: Business = Depends(get_current_business)):
    provider = get_storage_provider()
    try:
        url = provider.save(file, subfolder=str(business.id))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except NotImplementedError as e:
        raise HTTPException(status_code=503, detail=str(e))
    return UploadOut(url=url)
