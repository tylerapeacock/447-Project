from sqlalchemy import Column, Integer, String, Date, Enum, ForeignKey, TIMESTAMP, func
from database import Base

class Department(Base):
    __tablename__ = "departments"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    email = Column(String(150), unique=True, nullable=False)
    role = Column(Enum("dean", "vp", "director", "assistant_director",
                       "department_administrator"), nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=True)

class MetricType(Base):
    __tablename__ = "metric_types"
    id = Column(Integer, primary_key=True)
    name = Column(String(150), unique=True, nullable=False)
    description = Column(String(255))
    created_at = Column(TIMESTAMP, server_default=func.now())

class Metric(Base):
    __tablename__ = "metrics"
    id = Column(Integer, primary_key=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    metric_type_id = Column(Integer, ForeignKey("metric_types.id"), nullable=False)
    metric_date = Column(Date, nullable=False)
    count = Column(Integer, nullable=False)
    created_at = Column(TIMESTAMP, server_default=func.now())

class Upload(Base):
    __tablename__ = "uploads"
    id = Column(Integer, primary_key=True)
    department_id = Column(Integer, ForeignKey("departments.id"), nullable=False)
    uploaded_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    filename = Column(String(255))
    upload_date = Column(TIMESTAMP, server_default=func.now())
    row_count = Column(Integer)
    status = Column(Enum("success", "partial", "failed"), default="success")