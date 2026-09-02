import random
import string
import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_business
from app.db.session import get_db
from app.models.business import Business
from app.models.gift_card import GiftCard
from app.models.gift_card_transaction import GiftCardTransaction, GiftCardTxnType
from app.schemas.gift_card import GiftCardCreate, GiftCardOut

router = APIRouter(prefix="/gift-cards", tags=["gift-cards"])

PRESET_AMOUNTS = [500, 1000, 2000, 5000]


def _generate_code() -> str:
    return "GC-" + "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


@router.get("/preset-amounts")
def get_preset_amounts():
    return {"amounts": PRESET_AMOUNTS}


@router.get("", response_model=list[GiftCardOut])
def list_gift_cards(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    return db.query(GiftCard).filter(GiftCard.business_id == business.id).order_by(GiftCard.created_at.desc()).all()


@router.post("", response_model=GiftCardOut, status_code=201)
def create_gift_card(payload: GiftCardCreate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    code = _generate_code()
    while db.query(GiftCard).filter(GiftCard.code == code).first():
        code = _generate_code()

    gift_card = GiftCard(
        business_id=business.id,
        code=code,
        initial_balance=payload.initial_balance,
        current_balance=payload.initial_balance,
        sender_name=payload.sender_name,
        recipient_name=payload.recipient_name,
        recipient_contact=payload.recipient_contact,
        message=payload.message,
        delivery_date=payload.delivery_date,
        expires_at=payload.expires_at,
    )
    db.add(gift_card)
    db.flush()
    db.add(GiftCardTransaction(
        gift_card_id=gift_card.id, type=GiftCardTxnType.issue,
        amount=payload.initial_balance, balance_after=payload.initial_balance,
    ))
    db.commit()
    db.refresh(gift_card)
    return gift_card


@router.get("/{gift_card_id}", response_model=GiftCardOut)
def get_gift_card(gift_card_id: uuid.UUID, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    gc = db.query(GiftCard).filter(GiftCard.id == gift_card_id, GiftCard.business_id == business.id).first()
    if not gc:
        raise HTTPException(status_code=404, detail="Gift card not found")
    return gc
