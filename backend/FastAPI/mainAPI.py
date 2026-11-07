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
from sqlalchemy import func, distinct, case
from database import get_db
from models import Department, User, Metric, MetricType, ServiceEvent, Enrollment




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
    sort_by: str = "Metric Date",
    current_order: str = "descending",
    current_user: User = Depends(get_user),
    db: Session = Depends(get_db)):

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
    sort_col = {
        "Metric ID": Metric.id,
        "Metric Date": Metric.metric_date, 
        "Department ID": Metric.department_id, 
        "Metric Type ID": Metric.metric_type_id,
        "Count": Metric.count 
    } 
    if sort_by not in sort_col and curr_role in read_and_write_permissions:
        raise HTTPException(status_code = 422, detail = "Error: Field to sort by is invalid. Possible fields to sort by include: Metric ID, Metric Date, Metric Type ID, Count")
    if sort_by not in sort_col and curr_role in write_permissions:
        raise HTTPException(status_code = 422, detail = "Error: Field to sort by is invalid. Possible fields to sort by include: Metric ID, Metric Date, Department ID, Metric Type ID, Count")
    if sort_by == "Department ID" and curr_role not in read_permissions:
        raise HTTPException(status_code = 403, detail = "Error: You don't have permission to sort by department ID.")

    if current_order.lower() == "descending":
        q = q.order_by(sort_col[sort_by].desc())
    elif current_order.lower() == "ascending":
        q = q.order_by(sort_col[sort_by].asc())
    else:
        raise HTTPException(status_code = 422, detail = "Error: Must sort by ascending or descending order.")
    return [
        {
            "Metric ID": metric.id,
            "Department ID": metric.department_id,
            "Metric Type": metric_type_name,
            "Metric Date": metric.metric_date,
            "Count": metric.count,
        }
        for metric, metric_type_name in q.all()
    ]
# Defines a basic statistical analysis functionality
@app.get("/metrics/statistics")
def get_metric_stats(
    # Can contain an int/date or be defaulted to None
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    department_id: Optional[int] = None,
    metric_type_id: Optional[int] = None,
    current_user: User = Depends(get_user),
    db: Session = Depends(get_db)):
    curr_role = get_role(current_user)
    # Check the date range
    if start_date is not None and end_date is not None and start_date > end_date:
        raise HTTPException(status_code=422, detail=" Error: Start date cannot be after the end date.")
    # Dean and VP can view metrics for all departments
    if curr_role in read_permissions:
        pass
    # Everyone else can only view metrics for their own departments
    elif curr_role in read_and_write_permissions:
        if current_user.department_id is None:
            raise HTTPException(status_code = 403, detail = "Error: User hasn't been assigned to a department.")
        if (department_id is not None and department_id != current_user.department_id):
            raise HTTPException(status_code = 403, detail = "Error: User doesn't have permission to view this department")
        department_id = current_user.department_id
    else:
        raise HTTPException(status_code = 403, detail = "Error: User doesn't have permission to view statistics.")
    # Constructs a database query for:
        # - count how many metric records match the filters
        # - sum for adding together the values of the matching records
        # - average for calculating the mean values of matching records
        # - min returns the smallest value
        # - max returns the largest value
    database_query = db.query(func.count(Metric.id).label("record_count"),
        func.sum(Metric.count).label("record_total"),
        func.avg(Metric.count).label("record_average"),
        func.min(Metric.count).label("record_minimum"),
        func.max(Metric.count).label("record_maximum"))
    # Filter by start and end date (if provided)
    if start_date is not None:
        database_query = database_query.filter(Metric.metric_date >= start_date)
    if end_date is not None:
        database_query = database_query.filter(Metric.metric_date <= end_date)
    # Filter by department
    if department_id is not None:
        database_query = database_query.filter(Metric.department_id == department_id)
    # Filter by metric type
    if metric_type_id is not None:
        database_query = database_query.filter(Metric.metric_type_id == metric_type_id)
   
    query_result = database_query.one()
    record_average = query_result.record_average
    if record_average is not None:
        record_average = float(record_average)
    return {
        "Metric Type ID": metric_type_id,
        "Department ID": department_id,
        "Start Date": start_date,
        "End Date": end_date,
        "Record Count": query_result.record_count,
        "Record Total": query_result.record_total or 0,
        "Record Average": record_average,
        "Record Minimum": query_result.record_minimum,
        "Record Maximum": query_result.record_maximum
    }  

@app.get("/")
def home():
    return {"message": "Hello World"}



SMALL_CELL_MIN = int(os.environ.get("SMALL_CELL_MIN", "5"))
 
 
def is_small(value):
    return value is not None and 0 < value < SMALL_CELL_MIN
 
 
def suppress_small(value, label, suppressed):
    """Return the count, or None (and note why) if it's a small, identifying group."""
    if is_small(value):
        suppressed.append(label)
        return None
    return value
 
 
def reach_scope(current_user: User):
    """None for portfolio-wide roles, else the user's own department id."""
    curr_role = get_role(current_user)
    if curr_role in read_permissions:
        return None
    if curr_role in read_and_write_permissions:
        if current_user.department_id is None:
            raise HTTPException(status_code=403, detail="User hasn't been assigned to a department.")
        return current_user.department_id
    raise HTTPException(status_code=403, detail="User doesn't have read permissions.")
 
 
def filter_events(query, department_id, start, end):
    if department_id is not None:
        query = query.filter(ServiceEvent.department_id == department_id)
    if start is not None:
        query = query.filter(ServiceEvent.event_date >= start)
    if end is not None:
        query = query.filter(ServiceEvent.event_date <= end)
    return query
 
 
def check_range(start, end):
    if start is not None and end is not None and start > end:
        raise HTTPException(status_code=422, detail="Start date cannot be after the end date.")
 
 
# Unique students, repeat visitors, and cross-unit overlap. Reads
# service_events, not metrics: aggregate counts can't tell 300 visits
# from 300 people.
@app.get("/reach")
def getReach(
    start: Optional[date] = None,
    end: Optional[date] = None,
    term: Optional[str] = None,
    current_user: User = Depends(get_user),
    db: Session = Depends(get_db),
):
    check_range(start, end)
    department_id = reach_scope(current_user)
 
    def scoped(query):
        return filter_events(query, department_id, start, end)
 
    unique_students = scoped(
        db.query(func.count(distinct(ServiceEvent.student_token_id)))
    ).scalar()
 
    total_visits = scoped(db.query(func.count(ServiceEvent.id))).scalar()
 
    repeat_visitors = (
        scoped(db.query(ServiceEvent.student_token_id))
        .group_by(ServiceEvent.student_token_id)
        .having(func.count(ServiceEvent.id) > 1)
        .count()
    )
 
    # Overlap only makes sense across the whole portfolio. A department-scoped
    # user only sees their own unit's events, and shouldn't learn about other
    # units through this number.
    multi_unit = None
    if department_id is None:
        multi_unit = (
            scoped(db.query(ServiceEvent.student_token_id))
            .group_by(ServiceEvent.student_token_id)
            .having(func.count(distinct(ServiceEvent.department_id)) > 1)
            .count()
        )
 
    share_of_enrollment = None
    if term is not None:
        total = (
            db.query(Enrollment.headcount)
            .filter(
                Enrollment.term == term,
                Enrollment.category == "all",
                Enrollment.value == "all",
            )
            .scalar()
        )
        if total:
            share_of_enrollment = round(unique_students / total, 4)
 
    suppressed = []
    shown_unique = suppress_small(unique_students, "Unique Students", suppressed)
 
    # share x headcount gives back the unique count, so hide the share
    # whenever the count itself is hidden.
    if shown_unique is None and share_of_enrollment is not None:
        share_of_enrollment = None
        suppressed.append("Share Of Enrollment")
 
    return {
        "Scope": "portfolio" if department_id is None else "department",
        "Department ID": department_id,
        "Unique Students": shown_unique,
        "Total Visits": suppress_small(total_visits, "Total Visits", suppressed),
        "Repeat Visitors": suppress_small(repeat_visitors, "Repeat Visitors", suppressed),
        "Served By Multiple Units": suppress_small(multi_unit, "Served By Multiple Units", suppressed),
        "Share Of Enrollment": share_of_enrollment,  # a fraction: 0.0004 means 0.04%
        "Suppressed": suppressed,
        "Suppression Threshold": SMALL_CELL_MIN,
    }
 
 
# Unique students per unit, split into one-time and returning (2+ visits to
# that unit). Every unit in the user's scope is listed, including units with
# no visits yet, so a missing bar means "nobody", not "not loaded".
@app.get("/reach/by-unit")
def getReachByUnit(
    start: Optional[date] = None,
    end: Optional[date] = None,
    current_user: User = Depends(get_user),
    db: Session = Depends(get_db),
):
    check_range(start, end)
    department_id = reach_scope(current_user)
 
    # One row per (unit, student) with that student's visit count at the unit.
    per_student = (
        filter_events(
            db.query(
                ServiceEvent.department_id.label("department_id"),
                ServiceEvent.student_token_id.label("student"),
                func.count(ServiceEvent.id).label("visits"),
            ),
            department_id,
            start,
            end,
        )
        .group_by(ServiceEvent.department_id, ServiceEvent.student_token_id)
        .subquery()
    )
 
    counts = {
        row.department_id: (row.unique_students, int(row.returning or 0))
        for row in db.query(
            per_student.c.department_id,
            func.count().label("unique_students"),
            func.sum(case((per_student.c.visits > 1, 1), else_=0)).label("returning"),
        ).group_by(per_student.c.department_id)
    }
 
    departments = db.query(Department).order_by(Department.id)
    if department_id is not None:
        departments = departments.filter(Department.id == department_id)
 
    units = []
    for d in departments:
        unique_students, returning = counts.get(d.id, (0, 0))
        one_time = unique_students - returning
 
        if is_small(unique_students):
            # The whole unit is a small group: hide everything about it.
            shown = (None, None, None)
            hidden = "all"
        elif is_small(returning) or is_small(one_time):
            # The total is safe, but the split would expose a small group
            # (and either part gives the other back by subtraction).
            shown = (unique_students, None, None)
            hidden = "split"
        else:
            shown = (unique_students, returning, one_time)
            hidden = None
 
        units.append({
            "Department ID": d.id,
            "Department": d.name,
            "Unique Students": shown[0],
            "Returning Students": shown[1],
            "One-time Students": shown[2],
            "Hidden": hidden,
        })
 
    return {"Units": units, "Suppression Threshold": SMALL_CELL_MIN}