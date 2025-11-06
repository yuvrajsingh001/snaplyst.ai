# backend/app/models.py
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductStack(Base):
    __tablename__ = "product_stacks"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    metadata = Column(JSON, default={})
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductImage(Base):
    __tablename__ = "product_images"
    id = Column(Integer, primary_key=True)
    stack_id = Column(Integer, ForeignKey("product_stacks.id"), nullable=False)
    s3_path = Column(String)
    processed = Column(Integer, default=0)
