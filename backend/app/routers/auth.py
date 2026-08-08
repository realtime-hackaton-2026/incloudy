from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr

from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..models import User

router = APIRouter()


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    existing = await User.find_one(User.email == body.email)
    if existing is not None:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = User(email=body.email, hashed_password=hash_password(body.password))
    await user.insert()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    user = await User.find_one(User.email == form.username)
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=EmailStr)
async def me(current_user: User = Depends(get_current_user)) -> EmailStr:
    return current_user.email
