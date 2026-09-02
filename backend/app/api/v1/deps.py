from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

from app.core.security import decode_token
from app.db.session import get_db
from app.models.business import Business
from app.models.user import User, UserRole

bearer_scheme = HTTPBearer(auto_error=False)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user = db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def get_current_business(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Business:
    """Resolves the seller's own business. All seller-scoped routers depend on this —
    there is no way for a client-supplied business_id to leak into a query."""
    business = db.query(Business).filter(Business.owner_user_id == user.id).first()
    if not business:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No business found for this account yet")
    if business.status == "suspended":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This store has been suspended by the platform")
    return business


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.platform_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
