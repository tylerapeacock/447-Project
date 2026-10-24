import os
import secrets
from pathlib import Path
from datetime import date, datetime, timedelta, timezone
from typing import Optional
import bcrypt
import jwt
from jwt import InvalidTokenError
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from database import get_db
from models import Department, User, Metric, MetricType

app = FastAPI()
secret_file = Path(".jwt_secret_key")
if secret_file.exists():
    secret_key = secret_file .read_text().strip()
else:
    secret_key = secrets.token_hex(32)
    secret_file.write_text(secret_key)
    print("Generated a new JWT key.")
os.environ["JWT_SECRET_KEY"] = secret_key
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is not set.")
ALGORITHM = "HS256"
TOKEN_EXPIRE_MINUTES = 10
bearer_scheme = HTTPBearer()
# Lets the React dev server (Vite, port 5173) call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class LoginRequest(BaseModel):
    email: str
    password: str
def create_token(user_id: int) -> str:
    token_time = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": token_time,
        "exp" : token_time + timedelta(minutes = TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def get_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)):
    token = credentials.credentials
    error_unauthorized = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail = "Error: Authentication token is invalid or has expired",
        headers = {"WWW-Authenticate": "Bearer"})
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise error_unauthorized
    lookup_user_database = db.query(User).filter(User.id == user_id).first()
    if lookup_user_database is None:
        raise error_unauthorized
    return lookup_user_database
read_permissions = {"dean", "vp"}
read_and_write_permissions = {"director", "assistant_director", "department_administrator"}
def get_role(user: User) -> str: 
    curr_role = user.role
    if hasattr(curr_role,"value"):
        curr_role = curr_role.value
    return str(curr_role).lower()

@app.post("/login")
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
 
    # Same message either way, so nobody can probe which emails exist.
    if not user or not user.password_hash or not bcrypt.checkpw(
        creds.password.encode(), user.password_hash.encode()
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    user_token = create_token(user.id)
    # password_hash is left out of the response.
    return {
        "access_token": user_token,
        "token_type": "bearer",
        "user": {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "department_id": user.department_id,
        },
    }


# Temporary data
# List of departments
@app.get("/departmentInfo")
def getDepartments(current_user: User = Depends(get_user), db: Session = Depends(get_db)):
    return [
        {"Department ID": d.id, "Department Name": d.name}
        for d in db.query(Department).all()
    ]

# List of user information
@app.get("/userInfo")
def getUsers(current_user: User = Depends(get_user), db: Session = Depends(get_db)):
    return [
        {"User ID": u.id, "User's Name": u.name}
        for u in db.query(User).all()
    ]


# Metrics with optional filters, for the dashboard's calendar/date picker
@app.get("/metrics")
def getMetrics(
    start: Optional[date] = None,
    end: Optional[date] = None,
    department_id: Optional[int] = None,
    current_user: User = Depends(get_user),
    db: Session = Depends(get_db),
):
    curr_role = get_role(current_user)
    # Check the date range 
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="Start date cannot be after the end date.")
    # VP and dean can view all departments (read-only)
    if curr_role in read_permissions:
        pass
    # Director, assistant director, and department administrators can read/write, but only to 
    # their own department. 
    elif curr_role in read_and_write_permissions:
        if current_user.department_id is None:
            raise HTTPException(status_code=403, detail="User hasn't been assigned to a department.")
        if (department_id is not None and department_id != current_user.department_id):
            raise HTTPException(status_code=403, detail="User doesn't have permission to view this department.")
        department_id = current_user.department_id
    else: 
        raise HTTPException(status_code=403, detail="User doesn't have read permissions.")
    q = db.query(Metric, MetricType.name).join(MetricType, Metric.metric_type_id == MetricType.id)
    if department_id is not None:
        q = q.filter(Metric.department_id == department_id)
    if start is not None:
        q = q.filter(Metric.metric_date >= start)
    if end is not None:
        q = q.filter(Metric.metric_date <= end)
    return [
        {
            "Metric ID": m.id,
            "Department ID": m.department_id,
            "Metric Type ID": m.metric_type_id,
            "Date": m.metric_date,
            "Count": m.count,
        }
        for m, metric_type_name in q.all()
    ]

@app.get("/")
def home():
    return {"message": "Hello World"}
