from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from ..auth import create_access_token, get_current_user, hash_password, verify_password
from ..models import User
from ..schemas import RegisterRequest, TokenResponse, UserResponse, UserUpdateRequest

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest) -> TokenResponse:
    existing = await User.find_one(User.email == body.email)
    if existing is not None:
        raise HTTPException(status_code=400, detail="El email ya está registrado")
    user = User(
        nombre=body.nombre,
        seccion=body.seccion,
        email=body.email,
        hashed_password=hash_password(body.password),
    )
    await user.insert()
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.post("/login", response_model=TokenResponse)
async def login(form: OAuth2PasswordRequestForm = Depends()) -> TokenResponse:
    user = await User.find_one(User.email == form.username)
    if user is None or not verify_password(form.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Email o contraseña incorrectos")
    return TokenResponse(access_token=create_access_token(str(user.id)))


@router.get("/me", response_model=UserResponse)
async def me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse(
        id=str(current_user.id),
        nombre=current_user.nombre,
        email=current_user.email,
        seccion=current_user.seccion,
    )


@router.patch("/me", response_model=UserResponse)
async def update_me(
    body: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
) -> UserResponse:
    email_changed = body.email != current_user.email
    password_changed = body.new_password is not None
    if email_changed or password_changed:
        if not body.current_password or not verify_password(body.current_password, current_user.hashed_password):
            raise HTTPException(status_code=401, detail="La contraseña actual no es correcta")
    if email_changed:
        existing = await User.find_one(User.email == body.email)
        if existing is not None and existing.id != current_user.id:
            raise HTTPException(status_code=400, detail="El email ya está registrado")
    current_user.nombre = body.nombre.strip()
    current_user.email = body.email
    current_user.seccion = body.seccion.strip() if body.seccion else None
    if body.new_password:
        current_user.hashed_password = hash_password(body.new_password)
    await current_user.save()
    return UserResponse(id=str(current_user.id), nombre=current_user.nombre, email=current_user.email, seccion=current_user.seccion)
