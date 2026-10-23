from datetime import date
from typing import Optional

import bcrypt

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session

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

class LoginRequest(BaseModel):
    email: str
    password: str


@app.post("/login")
def login(creds: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == creds.email).first()
 
    # Same message either way, so nobody can probe which emails exist.
    if not user or not bcrypt.checkpw(
        creds.password.encode(), user.password_hash.encode()
    ):
        raise HTTPException(status_code=401, detail="Invalid email or password")
 
    # password_hash is left out of the response.
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "department_id": user.department_id,
    }

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
