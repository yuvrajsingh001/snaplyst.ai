from fastapi import APIRouter

router = APIRouter(prefix="/auth")


@router.post("/login")
async def login(payload: dict):
    # placeholder: validate credentials here, return token
    return {"access_token": "dev-token", "token_type": "bearer"}


@router.post("/signup")
async def signup(payload: dict):
    # placeholder: create user here, return token
    return {"access_token": "dev-token", "token_type": "bearer"}

