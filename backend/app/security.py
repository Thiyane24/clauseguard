from typing import Optional
import firebase_admin
from firebase_admin import app_check, auth
from fastapi import Header, HTTPException, status
from .config import settings


def _ensure_firebase_app() -> None:
    if not firebase_admin._apps:
        firebase_admin.initialize_app(
            options={"projectId": settings.firebase_project_id}
        )


async def verify_firebase_security(
    authorization: Optional[str] = Header(default=None),
    x_firebase_appcheck: Optional[str] = Header(default=None, alias="X-Firebase-AppCheck"),
) -> dict:
    is_dev = settings.env.lower() == "development"

    if not is_dev and not x_firebase_appcheck:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing X-Firebase-AppCheck token.",
        )

    if x_firebase_appcheck and not is_dev:
        try:
            _ensure_firebase_app()
            app_check.verify_token(x_firebase_appcheck)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid App Check token: {exc}",
            ) from exc

    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ", 1)[1].strip()
        try:
            _ensure_firebase_app()
            decoded = auth.verify_id_token(token)
            if decoded.get("email") and not decoded.get("email_verified"):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Firebase email must be verified.",
                )
            return decoded
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid Firebase Auth token: {exc}",
            ) from exc

    if is_dev:
        return {"uid": "local-dev-user", "env": "development"}

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Missing Firebase Auth Bearer token.",
    )
