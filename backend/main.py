"""
Backend FastAPI para Mueblería Modes (Oruro, Bolivia).
Persiste en Supabase (PostgreSQL) mediante SQLAlchemy.

Ejecución en Visual Studio Code:
  - Desde la raíz:    uvicorn backend.main:app --reload --port 8000
  - Desde backend/:   uvicorn main:app --reload --port 8000
"""

from __future__ import annotations

import os
import re
from contextlib import asynccontextmanager
from datetime import date
from typing import Any, Dict, List

from fastapi import FastAPI, HTTPException, status, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import text

try:
    from .database import get_db
    from .models import (
        ClienteOut,
        CrearPedidoResponse,
        DetallePedidoOut,
        PedidoWithDetailsOut,
        ProductOut,
    )
    from .schemas import ClienteSchema, PedidoSchema
except ImportError:
    from database import get_db
    from models import (
        ClienteOut,
        CrearPedidoResponse,
        DetallePedidoOut,
        PedidoWithDetailsOut,
        ProductOut,
    )
    from schemas import ClienteSchema, PedidoSchema


def _normalize_phone(phone: str) -> str:
    return re.sub(r"\s+", "", str(phone or "")).strip()


def _get_allowed_origins() -> List[str]:
    raw = os.getenv(
        "FRONTEND_ORIGINS",
        "https://carpinteria-modes-web.vercel.app,http://localhost:3000,http://127.0.0.1:3000,http://0.0.0.0:3000,http://localhost:5173,http://127.0.0.1:5173,http://0.0.0.0:5173",
    )
    origins = [origin.strip() for origin in raw.split(",") if origin.strip()]
    return origins or ["*"]


@asynccontextmanager
async def lifespan(_app: FastAPI):
    yield


app = FastAPI(
    title="Mueblería Modes API · Oruro, Bolivia",
    description="Backend en FastAPI + Supabase (PostgreSQL) para el Showroom 3D y gestión de pedidos.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_get_allowed_origins(),
    allow_origin_regex=r"https?://([a-zA-Z0-9_-]+\.)*vercel\.app|(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health", tags=["Sistema"])
def health_check(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Verifica el estado del backend FastAPI y la conexión con Supabase."""
    try:
        db.execute(text("SELECT 1"))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="FastAPI está activo, pero no pudo conectarse a Supabase.",
        ) from exc

    return {
        "ok": True,
        "service": "muebleria-modes-fastapi",
        "storage": "supabase-postgresql",
    }


@app.get("/api/products", tags=["Catálogo"])
@app.get("/api/productos", tags=["Catálogo"], include_in_schema=False)
def list_products(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Devuelve el inventario de muebles desde la tabla `products` en Supabase."""
    rows = db.execute(
        text("SELECT id, name, price, stock, created_at FROM products ORDER BY id ASC")
    ).mappings().all()
    products = [ProductOut.model_validate(dict(row)).model_dump() for row in rows]
    return {"ok": True, "products": products, "total": len(products)}


@app.get("/api/clientes", tags=["Clientes"])
def list_clientes(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Lista los clientes registrados en la tabla `clientes` de Supabase."""
    rows = db.execute(
        text("""
            SELECT id_cliente, nombre_completo, telefono, correo, direccion_entrega, nit_ci, created_at
            FROM clientes
            ORDER BY id_cliente DESC
        """)
    ).mappings().all()
    clientes = [ClienteOut.model_validate(dict(row)).model_dump() for row in rows]
    return {"ok": True, "clientes": clientes, "total": len(clientes)}


@app.post("/api/clientes", status_code=status.HTTP_201_CREATED, tags=["Clientes"])
def upsert_cliente(payload: ClienteSchema, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Registra o actualiza un cliente buscando por teléfono o NIT/CI en Supabase."""
    clean_phone = _normalize_phone(payload.telefono)
    if len(clean_phone) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El teléfono del cliente debe tener al menos 5 dígitos.",
        )

    existing = db.execute(
        text("SELECT * FROM clientes WHERE telefono = :telefono LIMIT 1"),
        {"telefono": clean_phone},
    ).mappings().first()

    if not existing and payload.nit_ci:
        existing = db.execute(
            text("SELECT * FROM clientes WHERE nit_ci = :nit_ci LIMIT 1"),
            {"nit_ci": payload.nit_ci},
        ).mappings().first()

    if existing:
        id_cliente = int(existing["id_cliente"])
        db.execute(
            text("""
                UPDATE clientes
                SET nombre_completo = :nombre_completo,
                    telefono = :telefono,
                    direccion_entrega = :direccion_entrega,
                    correo = COALESCE(:correo, correo),
                    nit_ci = COALESCE(:nit_ci, nit_ci)
                WHERE id_cliente = :id_cliente
            """),
            {
                "nombre_completo": payload.nombre_completo,
                "telefono": clean_phone,
                "direccion_entrega": payload.direccion_entrega,
                "correo": payload.correo,
                "nit_ci": payload.nit_ci,
                "id_cliente": id_cliente,
            },
        )
    else:
        result = db.execute(
            text("""
                INSERT INTO clientes (nombre_completo, telefono, correo, direccion_entrega, nit_ci)
                VALUES (:nombre_completo, :telefono, :correo, :direccion_entrega, :nit_ci)
                RETURNING id_cliente
            """),
            {
                "nombre_completo": payload.nombre_completo,
                "telefono": clean_phone,
                "correo": payload.correo,
                "direccion_entrega": payload.direccion_entrega,
                "nit_ci": payload.nit_ci,
            },
        )
        id_cliente = int(result.scalar())

    db.commit()
    row = db.execute(
        text("SELECT * FROM clientes WHERE id_cliente = :id_cliente"),
        {"id_cliente": id_cliente},
    ).mappings().fetchone()
    
    cliente_out = ClienteOut.model_validate(dict(row)).model_dump()
    return {"ok": True, "cliente": cliente_out}


@app.get("/api/pedidos", tags=["Pedidos"])
def list_pedidos(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Lista los pedidos con su cliente asociado y líneas de `detalle_pedido` desde Supabase."""
    pedido_rows = db.execute(
        text("""
            SELECT p.*, c.nombre_completo AS c_nombre_completo, c.telefono AS c_telefono,
                   c.correo AS c_correo, c.direccion_entrega AS c_direccion_entrega,
                   c.nit_ci AS c_nit_ci, c.created_at AS c_created_at
            FROM pedidos p
            JOIN clientes c ON c.id_cliente = p.id_cliente
            ORDER BY p.id_pedido DESC
        """)
    ).mappings().all()

    pedidos: List[Dict[str, Any]] = []
    for p in pedido_rows:
        det_rows = db.execute(
            text("SELECT * FROM detalle_pedido WHERE id_pedido = :id_pedido ORDER BY id_detalle ASC"),
            {"id_pedido": p["id_pedido"]},
        ).mappings().all()

        pedido_obj = PedidoWithDetailsOut.model_validate(
            {
                "id_pedido": p["id_pedido"],
                "id_cliente": p["id_cliente"],
                "fecha_pedido": p["fecha_pedido"],
                "fecha_entrega_prometida": p["fecha_entrega_prometida"],
                "monto_total": p["monto_total"],
                "estado_pedido": p["estado_pedido"],
                "created_at": p["created_at"],
                "clientes": {
                    "id_cliente": p["id_cliente"],
                    "nombre_completo": p["c_nombre_completo"],
                    "telefono": p["c_telefono"],
                    "correo": p["c_correo"],
                    "direccion_entrega": p["c_direccion_entrega"],
                    "nit_ci": p["c_nit_ci"],
                    "created_at": p["c_created_at"],
                },
                "detalle_pedido": [dict(d) for d in det_rows],
            }
        )
        pedidos.append(pedido_obj.model_dump())

    return {"ok": True, "pedidos": pedidos, "total": len(pedidos)}


@app.post(
    "/api/pedidos",
    status_code=status.HTTP_201_CREATED,
    response_model=CrearPedidoResponse,
    tags=["Pedidos"],
)
def create_pedido(payload: PedidoSchema, db: Session = Depends(get_db)) -> CrearPedidoResponse:
    """Registra un pedido completo en Supabase (PostgreSQL)."""
    clean_phone = _normalize_phone(payload.cliente.telefono)
    if len(clean_phone) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El teléfono del cliente debe tener al menos 5 dígitos.",
        )

    # 1) Buscar o insertar cliente
    existing = db.execute(
        text("SELECT * FROM clientes WHERE telefono = :telefono LIMIT 1"),
        {"telefono": clean_phone},
    ).mappings().first()

    if not existing and payload.cliente.nit_ci:
        existing = db.execute(
            text("SELECT * FROM clientes WHERE nit_ci = :nit_ci LIMIT 1"),
            {"nit_ci": payload.cliente.nit_ci},
        ).mappings().first()

    if existing:
        id_cliente = int(existing["id_cliente"])
        db.execute(
            text("""
                UPDATE clientes
                SET nombre_completo = :nombre_completo,
                    telefono = :telefono,
                    direccion_entrega = :direccion_entrega,
                    correo = COALESCE(:correo, correo),
                    nit_ci = COALESCE(:nit_ci, nit_ci)
                WHERE id_cliente = :id_cliente
            """),
            {
                "nombre_completo": payload.cliente.nombre_completo,
                "telefono": clean_phone,
                "direccion_entrega": payload.cliente.direccion_entrega,
                "correo": payload.cliente.correo,
                "nit_ci": payload.cliente.nit_ci,
                "id_cliente": id_cliente,
            },
        )
    else:
        cur_cli = db.execute(
            text("""
                INSERT INTO clientes (nombre_completo, telefono, correo, direccion_entrega, nit_ci)
                VALUES (:nombre_completo, :telefono, :correo, :direccion_entrega, :nit_ci)
                RETURNING id_cliente
            """),
            {
                "nombre_completo": payload.cliente.nombre_completo,
                "telefono": clean_phone,
                "correo": payload.cliente.correo,
                "direccion_entrega": payload.cliente.direccion_entrega,
                "nit_ci": payload.cliente.nit_ci,
            },
        )
        id_cliente = int(cur_cli.scalar())

    # 2) Cabecera en `pedidos`
    calculated_total = round(
        sum(item.cantidad * item.precio_unitario for item in payload.items),
        2,
    )
    monto_total = (
        round(float(payload.monto_total), 2)
        if payload.monto_total is not None and payload.monto_total >= 0
        else calculated_total
    )
    fecha_pedido = payload.fecha_pedido or date.today().isoformat()
    estado_pedido = (
        "Cotizacion" if payload.es_cotizacion else (payload.estado_pedido or "Confirmado")
    )

    cur_ped = db.execute(
        text("""
            INSERT INTO pedidos (id_cliente, fecha_pedido, fecha_entrega_prometida, monto_total, estado_pedido)
            VALUES (:id_cliente, :fecha_pedido, :fecha_entrega_prometida, :monto_total, :estado_pedido)
            RETURNING id_pedido
        """),
        {
            "id_cliente": id_cliente,
            "fecha_pedido": fecha_pedido,
            "fecha_entrega_prometida": payload.fecha_entrega_prometida,
            "monto_total": monto_total,
            "estado_pedido": estado_pedido,
        },
    )
    id_pedido = int(cur_ped.scalar())

    # 3) Ítems en `detalle_pedido`
    for item in payload.items:
        subtotal = round(float(item.cantidad) * float(item.precio_unitario), 2)
        db.execute(
            text("""
                INSERT INTO detalle_pedido (
                    id_pedido, nombre_mueble, especificaciones, medidas, cantidad, precio_unitario, subtotal
                ) VALUES (:id_pedido, :nombre_mueble, :especificaciones, :medidas, :cantidad, :precio_unitario, :subtotal)
            """),
            {
                "id_pedido": id_pedido,
                "nombre_mueble": item.nombre_mueble,
                "especificaciones": item.especificaciones,
                "medidas": item.medidas,
                "cantidad": item.cantidad,
                "precio_unitario": round(float(item.precio_unitario), 2),
                "subtotal": subtotal,
            },
        )

        if estado_pedido != "Cotizacion":
            db.execute(
                text("""
                    UPDATE products
                    SET stock = GREATEST(0, stock - :cantidad)
                    WHERE LOWER(name) = LOWER(:nombre_mueble)
                """),
                {"cantidad": item.cantidad, "nombre_mueble": item.nombre_mueble},
            )

    db.commit()

    cliente_row = dict(
        db.execute(text("SELECT * FROM clientes WHERE id_cliente = :id_cliente"), {"id_cliente": id_cliente}).mappings().fetchone()
    )
    pedido_row = dict(
        db.execute(text("SELECT * FROM pedidos WHERE id_pedido = :id_pedido"), {"id_pedido": id_pedido}).mappings().fetchone()
    )
    detalles_rows = [
        dict(r)
        for r in db.execute(
            text("SELECT * FROM detalle_pedido WHERE id_pedido = :id_pedido ORDER BY id_detalle ASC"),
            {"id_pedido": id_pedido},
        ).mappings().all()
    ]

    cliente_out = ClienteOut.model_validate(cliente_row)
    detalles_out = [DetallePedidoOut.model_validate(row) for row in detalles_rows]
    pedido_out = PedidoWithDetailsOut.model_validate(
        {
            **pedido_row,
            "clientes": cliente_out.model_dump(),
            "detalle_pedido": [d.model_dump() for d in detalles_out],
        }
    )

    return CrearPedidoResponse(
        ok=True,
        message=f"Pedido #{id_pedido} registrado correctamente en Supabase.",
        cliente=cliente_out,
        pedido=pedido_out,
        detalle_pedido=detalles_out,
    )