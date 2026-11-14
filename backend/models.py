"""
Modelos de respuesta y estructuras de apoyo para la API FastAPI de Mueblería Modes.
"""

from datetime import date, datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field


ESTADOS_PEDIDO_VALIDOS = (
    "Confirmado",
    "En Produccion",
    "Cotizacion",
    "Listo",
    "Entregado",
)


class ProductOut(BaseModel):
    """Modelo de salida para registros de la tabla `products`."""

    model_config = ConfigDict(extra="allow")

    id: int
    name: str
    price: float = 0.0
    stock: int = 0
    created_at: Optional[datetime | str] = None


class ClienteOut(BaseModel):
    """Modelo de salida para registros de la tabla `clientes`."""

    model_config = ConfigDict(extra="allow")

    id_cliente: int
    nombre_completo: str
    telefono: str
    correo: Optional[str] = None
    direccion_entrega: Optional[str] = "Oruro, Bolivia"
    nit_ci: Optional[str] = None
    created_at: Optional[datetime | str] = None


class DetallePedidoOut(BaseModel):
    """Modelo de salida para filas de la tabla `detalle_pedido`."""

    model_config = ConfigDict(extra="allow")

    id_detalle: int
    id_pedido: int
    nombre_mueble: str
    especificaciones: Optional[str] = "Madera seleccionada en taller"
    medidas: Optional[str] = "Medidas estándar"
    cantidad: int = 1
    precio_unitario: float = 0.0
    subtotal: float = 0.0


class PedidoWithDetailsOut(BaseModel):
    """Modelo de salida para `pedidos` junto con `clientes` y `detalle_pedido`."""

    model_config = ConfigDict(extra="allow")

    id_pedido: int
    id_cliente: int
    fecha_pedido: date
    fecha_entrega_prometida: Optional[date] = None
    monto_total: float = 0.0
    estado_pedido: str = "Confirmado"
    created_at: Optional[datetime | str] = None
    clientes: Optional[ClienteOut] = None
    detalle_pedido: List[DetallePedidoOut] = Field(default_factory=list)


class CrearPedidoResponse(BaseModel):
    """Respuesta estructurada al registrar un pedido completo en POST /api/pedidos."""

    ok: bool = True
    message: str
    cliente: ClienteOut
    pedido: PedidoWithDetailsOut
    detalle_pedido: List[DetallePedidoOut]
