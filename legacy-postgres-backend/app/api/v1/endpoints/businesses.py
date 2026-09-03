from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.v1.deps import get_current_business, get_current_user
from app.db.session import get_db
from app.models.business import Business
from app.models.store_settings import StoreSettings
from app.models.subscription import Subscription
from app.models.user import User
from app.schemas.business import BusinessCreate, BusinessOut, BusinessUpdate, StoreSettingsOut, StoreSettingsUpdate
from app.services.slugify import unique_slug

router = APIRouter(prefix="/businesses", tags=["businesses"])


def _to_out(business: Business) -> BusinessOut:
    out = BusinessOut.model_validate(business)
    out.storefront_path = f"/store/{business.slug}"
    return out


@router.post("", response_model=BusinessOut, status_code=201)
def create_business(payload: BusinessCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Onboarding step 2: creates the business record. One business per user in the MVP
    (BusinessMember table allows multi-staff in a later phase without a schema change)."""
    existing = db.query(Business).filter(Business.owner_user_id == user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have a business set up")

    slug = unique_slug(db, Business, payload.name)
    business = Business(
        owner_user_id=user.id,
        name=payload.name,
        slug=slug,
        short_description=payload.short_description,
        category_id=payload.category_id,
        onboarding_step=2,
    )
    db.add(business)
    db.flush()

    db.add(StoreSettings(business_id=business.id))
    db.add(Subscription(business_id=business.id))
    db.commit()
    db.refresh(business)
    return _to_out(business)


@router.get("/me", response_model=BusinessOut)
def get_my_business(business: Business = Depends(get_current_business)):
    return _to_out(business)


@router.patch("/me", response_model=BusinessOut)
def update_my_business(payload: BusinessUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    data = payload.model_dump(exclude_unset=True)
    for field, value in data.items():
        setattr(business, field, value)
    db.commit()
    db.refresh(business)
    return _to_out(business)


@router.post("/me/complete-onboarding", response_model=BusinessOut)
def complete_onboarding(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    business.onboarding_step = 4
    db.commit()
    db.refresh(business)
    return _to_out(business)


@router.get("/me/store-settings", response_model=StoreSettingsOut)
def get_store_settings(business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    settings_row = db.query(StoreSettings).filter(StoreSettings.business_id == business.id).first()
    if not settings_row:
        settings_row = StoreSettings(business_id=business.id)
        db.add(settings_row)
        db.commit()
        db.refresh(settings_row)
    return settings_row


@router.patch("/me/store-settings", response_model=StoreSettingsOut)
def update_store_settings(payload: StoreSettingsUpdate, business: Business = Depends(get_current_business), db: Session = Depends(get_db)):
    settings_row = db.query(StoreSettings).filter(StoreSettings.business_id == business.id).first()
    if not settings_row:
        settings_row = StoreSettings(business_id=business.id)
        db.add(settings_row)
        db.flush()
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(settings_row, field, value)
    db.commit()
    db.refresh(settings_row)
    return settings_row
