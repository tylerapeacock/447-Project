import os 
from typing import Optional
import jwt 
from jwt.exceptions import InvalidTokenError
from pwdlib import PasswordHash 
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import datetime, timedelta, timezone
from database import get_db
from models import Department, User, Metric, MetricType

app = FastAPI()

# Lets the React dev server (Vite, port 5173) call this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("JWT_SECRET_KEY environment variable is not set.")
# Assumes we're using email and password (not UMBC sign in)
ALGORITHM = "HS256"
# Token expiration time in minutes
TOKEN_EXPIRE_MINUTES = 10 
password_hasher = PasswordHash.recommended() 
oauth2_scheme = OAuth2PasswordBearer(tokenUrl = "token")
# Creates a signed token identifying a user by their database ID
def access_token_creation(user_id: int) -> str:
    curr_date = datetime.now(timezone.utc)
    payload = {
        "User ID": str(user_id),
        "Issued At": curr_date, 
        "Not before": curr_date, 
        "Expires": curr_date + timedelta(minutes=TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)
# Validates a toekn and retrieves the corresponding user from MariaDB
def get_user(token: incoming_token = Depends(oauth2_scheme), db: open_temp_session = Depends(get_db)):
    error_unauthorized = HTTPException(
        error_code = status.HTTP_401_UNAUTHORIZED,
        error_message = "Error: Authentication token is invalid or has expired",
        headers = {"WWW-Authenticate": "Bearer"})
    try: 
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("User ID"))
    except (InvalidTokenErr, ValueError, TypeError):
        raise error_unauthorized
    lookup_user_database = db.query(User).filter(User.id == user_id).first()
    if lookup_user_database is None:
        raise error_unauthorized
    return lookup_user_database
# Temporary data
# List of departments
@app.get("/departmentInfo")
def getDepartments(db: Session = Depends(get_db)): 
    return [
        {"Department ID": d.id, "Department Name": d.name}
        for d in db.query(Department).all()
    ]

# List of user information
@app.get("/userInfo")
def getUsers(db: Session = Depends(get_db)):
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
    db: Session = Depends(get_db),
):
    q = db.query(Metric)
    if department_id:
        q = q.filter(Metric.department_id == department_id)
    if start:
        q = q.filter(Metric.metric_date >= start)
    if end:
        q = q.filter(Metric.metric_date <= end)
    return [
        {
            "Metric ID": m.id,
            "Department ID": m.department_id,
            "Metric Type ID": m.metric_type_id,
            "Date": m.metric_date,
            "Count": m.count,
        }
        for m in q.all()
    ]

@app.get("/metrics")
def getMetrics(start=None, end=None, department_id=None, db: Session = Depends(get_db)):
    q = db.query(Metric, MetricType.name).join(MetricType)
    if department_id:
        q = q.filter(Metric.department_id == department_id)
    if start:
        q = q.filter(Metric.metric_date >= start)
    if end:
        q = q.filter(Metric.metric_date <= end)
    return [
        {
            "Metric ID": m.id,
            "Department ID": m.department_id,
            "Metric Type": type_name,
            "Date": m.metric_date,
            "Count": m.count,
        }
        for m, type_name in q.all()
    ]

@app.get("/")
def home():
    return {"message": "Hello World"}
