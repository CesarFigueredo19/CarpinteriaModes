"""
Configuración de la base de datos PostgreSQL en Supabase mediante SQLAlchemy.
Lee la URL de conexión desde el archivo .env.
"""

from __future__ import annotations

import os
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

# Cargar las variables de entorno desde el archivo .env
load_dotenv(Path(__file__).resolve().with_name(".env"))

DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("❌ No se encontró la variable DATABASE_URL en el archivo .env")

# Crear el motor de conexión para PostgreSQL (Supabase)
# pool_pre_ping=True ayuda a mantener la conexión activa con la nube
engine = create_engine(DATABASE_URL, pool_pre_ping=True)

# Fábrica de sesiones para las peticiones HTTP de FastAPI
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base declarativa para tus modelos ORM (en models.py)
Base = declarative_base()


def get_db():
    """
    Dependencia de FastAPI para obtener una sesión de base de datos por petición
    y cerrarla automáticamente al terminar.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
