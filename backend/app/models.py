from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from .db import Base

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False)
    name = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    product_stacks = relationship("ProductStack", back_populates="owner")

class ProductStack(Base):
    __tablename__ = "product_stacks"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    description = Column(Text)
    price = Column(Integer)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)

    owner = relationship("User", back_populates="product_stacks")
    images = relationship("ProductImage", back_populates="stack")

class ProductImage(Base):
    __tablename__ = "product_images"
    id = Column(Integer, primary_key=True, index=True)
    url = Column(String, nullable=False)
    stack_id = Column(Integer, ForeignKey("product_stacks.id"))
    stack = relationship("ProductStack", back_populates="images")

class Task(Base):
    __tablename__ = "tasks"
    id = Column(Integer, primary_key=True, index=True)
    type = Column(String)
    status = Column(String, default="pending")
    result = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)

