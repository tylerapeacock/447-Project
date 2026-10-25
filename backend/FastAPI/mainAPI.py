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
from pydantic import BaseModel, ConfigDict
from sqlalchemy.orm import Session
from database import get_db
from models import Department, User, Metric, MetricType


app = FastAPI()
# Load a JWT signing key when run 
secret_file = Path(".jwt_secret_key")
if secret_file.exists():
    secret_key = secret_file.read_text().strip()
else:
    secret_key = secrets.token_hex(32)
    secret_file.write_text(secret_key)
    print("Generated a new JWT key.")
os.environ["JWT_SECRET_KEY"] = secret_key
SECRET_KEY = os.environ.get("JWT_SECRET_KEY")
if not SECRET_KEY:
    raise RuntimeError("Error: JWT_SECRET_KEY environment variable is not set.")
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
# Builds a JWT with user id, issued at, and expiry
def create_token(user_id: int) -> str:
    token_time = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": token_time,
        "exp" : token_time + timedelta(minutes = TOKEN_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

# Defines validating credentials/token, looking up a user in the database
def get_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme), db: Session = Depends(get_db)):
    token = credentials.credentials
    # Creates an error response when login token is missing/expired
    error_unauthorized = HTTPException(
        status_code = status.HTTP_401_UNAUTHORIZED,
        detail = "Error: Authentication token is invalid or has expired",
        headers = {"WWW-Authenticate": "Bearer"})
    try:
        # Decode and verify the JWT token
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise error_unauthorized
    # Confirm the user exists in the database 
    lookup_user_database = db.query(User).filter(User.id == user_id).first()
    if lookup_user_database is None:
        raise error_unauthorized
    return lookup_user_database

# Sets which roles have read permissions vs both read and write permissions
read_permissions = {"dean", "vp"}
read_and_write_permissions = {"director", "assistant_director", "department_administrator"}

# Defines extracting a user's role 
def get_role(user: User) -> str:
    curr_role = user.role
    if hasattr(curr_role,"value"):
        curr_role = curr_role.value
    return str(curr_role).lower()

# Function for checking whether a user has permission to modify data
def modify_permissions(current_user: User = Depends(get_user),) -> User:
    curr_role = get_role(current_user)
    # User must have write permissions to edit data
    if curr_role not in read_and_write_permissions:
        raise HTTPException(status_code=403, detail="User doesn't have write permissions.")
    # User must be assigned to a department to edit data
    if current_user.department_id is None:
        raise HTTPException(status_code=403, detail="User hasn't been assigned to a department.")
    return current_user

def metric_dictionary_helper(metric: Metric) -> dict:
    return {
        "Metric ID": metric.id,
        "Department ID": metric.department_id,
        "Metric Type ID": metric.metric_type_id,
        "Date": metric.metric_date,
        "Count": metric.count,
    }

# Defines checking that a user has access to a departments data and that a metric exists
# before attempting modifications
def get_metric_info(metric_id: int, user: User, db: Session) -> Metric:
    retrieved_metric = db.query(Metric).filter(Metric.id == metric_id).first()
    # Check that metric exists
    if retrieved_metric is None:
        raise HTTPException(status_code=404, detail="Metric wasn't found.")
    # Check that the user has permission to specific department info
    if retrieved_metric.department_id != user.department_id:
        raise HTTPException(status_code=403, detail="User doesn't have permission to modify this department.")
    return retrieved_metric

# When creating a metric (POST), all fields are required to have a metric id, metric date, and a count
class CreatingMetric(BaseModel):
    # Rejects the user from adding extra fields
    model_config = ConfigDict(extra = "forbid")
    metric_type_id: int
    metric_date: date
    count: int

# When updating a metric (PUT), not all fields need to be update. Allow some fields to be NONE. 
class UpdatingMetric(BaseModel):
    metric_type_id: Optional[int] = None
    metric_date: Optional[date] = None
    count: Optional[int] = None
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
# Defines creating a new metric
@app.post("/metrics",status_code = 201)
def create_new_metric(metric_data: CreatingMetric, current_user: User = Depends(modify_permissions), db: Session = Depends(get_db)):
    new_metric = Metric(department_id = current_user.department_id, metric_type_id = metric_data.metric_type_id, metric_date = metric_data.metric_date, count = metric_data.count)
    db.add(new_metric)
    db.commit()
    db.refresh(new_metric)
    # Uses the dictionary helper
    return metric_dictionary_helper(new_metric)

# Defines validating whether metric can be updated, and updates it accordingly
@app.put("/metrics/{metric_id}")
def update_metric(metric_id: int, metric_info: UpdatingMetric, current_user: User = Depends(modify_permissions), db: Session = Depends(get_db)):
    update_metric = get_metric_info(metric_id, current_user, db)
    new_update = metric_info.dict(exclude_unset=True)
    # Ensure the user entires a valid field to update
    if not new_update:
        raise HTTPException(status_code = 422, detail="Error: Provide at least one field to update.")
    if None in new_update.values():
        raise HTTPException(status_code = 422, detail="Errror: Updated fields cannot be empty.")
    if "metric_type_id" in new_update:
        metric_type = db.query(MetricType).filter(MetricType.id == new_update["metric_type_id"]).first()  
        if metric_type is None:
            raise HTTPException(status_code = 422, detail = "Error: Invalid metric_type_id, this metric types doesn't exist.")
    # Set the new attributes
    try:
        for key, value in new_update.items():
            setattr(update_metric, key, value)
        db.commit()
        db.refresh(update_metric)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code = 422, detail = "Error: update failed, value(s) voilated a database constraint.")
    return metric_dictionary_helper(update_metric)

# Defines whether a metric can be deleted
@app.delete("/metrics/{metric_id}")
def delete_metric(metric_id: int, current_user: User = Depends(modify_permissions), db: Session = Depends(get_db)):
    delete_metric = get_metric_info(metric_id, current_user, db)
    # Check that the user has permission to specific department info
    if delete_metric.department_id != current_user.department_id:
        raise HTTPException(status_code = 403, detail="User doesn't have permission to modify this department.")
    db.delete(delete_metric)
    db.commit()
    return {"message": "Metric deleted successfully."}

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
