import { MuebleItem, WoodFinishId } from '../data/catalog';

const WOOD_MULTIPLIERS: Record<WoodFinishId, number> = {
  mara: 1.15,
  tajibo: 1.12,
  cedro: 1.05,
  roble: 1.0,
  grafito: 0.96,
};

export interface DimensionBounds {
  alto: { min: number; max: number };
  ancho: { min: number; max: number };
  prof: { min: number; max: number };
}

export function getDimensionBounds(item: MuebleItem): DimensionBounds {
  return {
    alto: {
      min: Math.max(35, Math.round(item.alto_cm * 0.65)),
      max: Math.min(280, Math.round(item.alto_cm * 1.5)),
    },
    ancho: {
      min: Math.max(40, Math.round(item.ancho_cm * 0.6)),
      max: Math.min(320, Math.round(item.ancho_cm * 1.6)),
    },
    prof: {
      min: Math.max(25, Math.round(item.profundidad_cm * 0.65)),
      max: Math.min(180, Math.round(item.profundidad_cm * 1.55)),
    },
  };
}

export function clampDimensionValue(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.max(min, Math.min(max, Math.round(val)));
}

export interface AdjustedPricingResult {
  precioBs: number;
  anticipoBs: number;
  isCustomSize: boolean;
  customDimsLabel: string | undefined;
}

export function calculateAdjustedPriceBs(
  item: MuebleItem,
  finishId: WoodFinishId,
  altoCm: number,
  anchoCm: number,
  profCm: number
): AdjustedPricingResult {
  const isCustomSize =
    altoCm !== item.alto_cm ||
    anchoCm !== item.ancho_cm ||
    profCm !== item.profundidad_cm;

  if (!isCustomSize) {
    return {
      precioBs: item.precio_bs,
      anticipoBs: item.anticipo_bs,
      isCustomSize: false,
      customDimsLabel: undefined,
    };
  }

  const baseVolume = Math.max(1, item.alto_cm * item.ancho_cm * item.profundidad_cm);
  const customVolume = Math.max(1, altoCm * anchoCm * profCm);
  const scaleFactor = 0.45 + 0.55 * (customVolume / baseVolume);
  const baseWoodMult = WOOD_MULTIPLIERS[item.defaultFinish] || 1;
  const currentWoodMult = WOOD_MULTIPLIERS[finishId] || 1;
  const woodRatio = currentWoodMult / baseWoodMult;

  const precioBs = Math.max(
    250,
    Math.round((item.precio_bs * scaleFactor * woodRatio) / 10) * 10
  );
  const anticipoBs = Math.round(precioBs * 0.5);

  return {
    precioBs,
    anticipoBs,
    isCustomSize: true,
    customDimsLabel: `${altoCm} × ${anchoCm} × ${profCm} cm`,
  };
}
