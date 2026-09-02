import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_business
from app.db.session import get_db
from app.models.business import Business
from app.models.voucher import Voucher
from app.models.voucher_usage import VoucherUsage
from app.schemas.voucher import VoucherCreate, VoucherOut, VoucherUpdate

router = APIRouter(prefix="/vouchers", tags=["vouchers"])


def _to_out(db: Session, voucher: Voucher) -> VoucherOut:
    out = VoucherOut.model_validate(voucher)
    out.times_used = db.query(VoucherUsage).filter(VoucherUsage.voucher_id == voucher.id).count()
    return out


@router.get("", response_model=list[VoucherOut])
def list_vouchers(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    vouchers = db.query(Voucher).filter(Voucher.business_id == business.id).order_by(Voucher.created_at.desc()).all()
    return [_to_out(db, v) for v in vouchers]


@router.post("", response_model=VoucherOut, status_code=201)
def create_voucher(payload: VoucherCreate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    code = payload.code.strip().upper()
    exists = db.query(Voucher).filter(Voucher.business_id == business.id, Voucher.code == code).first()
    if exists:
        raise HTTPException(status_code=400, detail=f"Voucher code '{code}' already exists")

    data = payload.model_dump()
    data["code"] = code
    data["applicable_product_ids"] = [str(x) for x in (data["applicable_product_ids"] or [])] or None
    data["applicable_category_ids"] = [str(x) for x in (data["applicable_category_ids"] or [])] or None
    voucher = Voucher(business_id=business.id, **data)
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    return _to_out(db, voucher)


@router.patch("/{voucher_id}", response_model=VoucherOut)
def update_voucher(voucher_id: uuid.UUID, payload: VoucherUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    voucher = db.query(Voucher).filter(Voucher.id == voucher_id, Voucher.business_id == business.id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(voucher, field, value)
    db.commit()
    db.refresh(voucher)
    return _to_out(db, voucher)


@router.delete("/{voucher_id}", status_code=204)
def delete_voucher(voucher_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    voucher = db.query(Voucher).filter(Voucher.id == voucher_id, Voucher.business_id == business.id).first()
    if not voucher:
        raise HTTPException(status_code=404, detail="Voucher not found")
    db.delete(voucher)
    db.commit()
