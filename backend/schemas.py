"""
Esquemas de validación Pydantic (entrada de datos) para Mueblería Modes.
Tolerantes a campos opcionales o ausentes para evitar fallos de integración.
"""

from datetime import date
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field, field_validator


def clean_optional_str(value: Any) -> Optional[str]:
    """Normaliza cadenas vacías o solo espacios a None."""
    if value is None:
        return None
    text = str(value).strip()
    return text if text else None


class ClienteSchema(BaseModel):
    """Esquema de entrada para buscar, actualizar o crear un cliente en `clientes`."""

    model_config = ConfigDict(extra="ignore")

    nombre_completo: str = Field(..., min_length=2, description="Nombre completo del cliente")
    telefono: str = Field(..., min_length=5, description="Teléfono o WhatsApp del cliente")
    correo: Optional[str] = Field(default=None, description="Correo electrónico opcional")
    direccion_entrega: Optional[str] = Field(
        default="Oruro, Bolivia",
        description="Dirección de entrega o retiro en Showroom",
    )
    nit_ci: Optional[str] = Field(default=None, description="NIT o CI opcional")

    @field_validator("nombre_completo", "telefono", mode="before")
    @classmethod
    def strip_required_text(cls, value: Any) -> str:
        return str(value or "").strip()

    @field_validator("correo", "nit_ci", mode="before")
    @classmethod
    def normalize_optional_fields(cls, value: Any) -> Optional[str]:
        return clean_optional_str(value)

    @field_validator("direccion_entrega", mode="before")
    @classmethod
    def ensure_direccion(cls, value: Any) -> str:
        return clean_optional_str(value) or "Oruro, Bolivia"


class DetalleItemSchema(BaseModel):
    """Esquema de entrada para cada mueble adquirido/cotizado en `detalle_pedido`."""

    model_config = ConfigDict(extra="ignore")

    nombre_mueble: str = Field(..., min_length=1, description="Nombre del mueble")
    especificaciones: Optional[str] = Field(
        default="Madera seleccionada en taller",
        description="Madera, color o acabado seleccionado",
    )
    medidas: Optional[str] = Field(
        default="Medidas estándar",
        description="Medidas del mueble, ej: '210 × 180 × 60 cm'",
    )
    cantidad: int = Field(default=1, ge=1, description="Cantidad de unidades")
    precio_unitario: float = Field(default=0.0, ge=0.0, description="Precio unitario en Bs.")

    @field_validator("nombre_mueble", mode="before")
    @classmethod
    def ensure_nombre_mueble(cls, value: Any) -> str:
        return clean_optional_str(value) or "Mueble Artesanal Modes"

    @field_validator("especificaciones", mode="before")
    @classmethod
    def ensure_especificaciones(cls, value: Any) -> str:
        return clean_optional_str(value) or "Madera seleccionada en taller"

    @field_validator("medidas", mode="before")
    @classmethod
    def ensure_medidas(cls, value: Any) -> str:
        return clean_optional_str(value) or "Medidas estándar"


class PedidoSchema(BaseModel):
    """Esquema principal para `POST /api/pedidos` (cliente + cabecera + ítems)."""

    model_config = ConfigDict(extra="ignore")

    cliente: ClienteSchema
    fecha_pedido: Optional[str] = Field(
        default=None,
        description="Fecha en formato YYYY-MM-DD; por defecto toma la fecha actual.",
    )
    fecha_entrega_prometida: Optional[str] = Field(
        default=None,
        description="Fecha estimada de entrega YYYY-MM-DD (opcional).",
    )
    monto_total: Optional[float] = Field(
        default=None,
        ge=0.0,
        description="Monto total; si se omite se calcula sumando los subtotales.",
    )
    estado_pedido: Optional[str] = Field(
        default="Confirmado",
        description="Estado: Confirmado, En Produccion, Cotizacion, Entregado o Listo.",
    )
    es_cotizacion: Optional[bool] = Field(
        default=False,
        description="Si es True, registra el pedido con estado 'Cotizacion'.",
    )
    items: List[DetalleItemSchema] = Field(..., min_length=1)

    @field_validator("fecha_pedido", "fecha_entrega_prometida", mode="before")
    @classmethod
    def normalize_iso_date(cls, value: Any) -> Optional[str]:
        cleaned = clean_optional_str(value)
        if cleaned is None:
            return None
        date_part = cleaned[:10]
        date.fromisoformat(date_part)
        return date_part

    @field_validator("estado_pedido", mode="before")
    @classmethod
    def ensure_estado(cls, value: Any) -> str:
        return clean_optional_str(value) or "Confirmado"
