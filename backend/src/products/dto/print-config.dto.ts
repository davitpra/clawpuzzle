import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, Min } from 'class-validator';

/**
 * Especificación de impresión propia de una variante de puzzle. Sustituye al
 * antiguo `PodConfigDto`, que describía materiales y opciones de un proveedor POD.
 *
 * Las dimensiones van en centímetros y son la fuente primaria del cálculo de
 * DPI del estudio de impresión: sin ellas hay que adivinarlas parseando el
 * título de la variante en Shopify, que es frágil.
 */
export class PrintConfigDto {
  @ApiPropertyOptional({ example: 48, description: 'Ancho impreso en cm' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  widthCm?: number;

  @ApiPropertyOptional({ example: 36, description: 'Alto impreso en cm' })
  @IsNumber()
  @Min(1)
  @IsOptional()
  heightCm?: number;

  /**
   * Obsoleto: la sangre es fija (3 mm) y este valor se ignora. Se acepta
   * porque hay variantes que ya lo tienen guardado y el admin lo reenvía.
   */
  @ApiPropertyOptional({
    example: 3,
    description: 'Obsoleto: se ignora, la sangre es fija de 3 mm',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  bleedMm?: number;

  /**
   * Margen interior sin contenido crítico. Una línea de corte que parte un ojo
   * arruina la pieza, y el troquel no cae siempre en el mismo sitio.
   */
  @ApiPropertyOptional({
    example: 10,
    description: 'Margen de seguridad en mm',
  })
  @IsNumber()
  @Min(0)
  @IsOptional()
  safeMarginMm?: number;

  @ApiPropertyOptional({ example: 300, description: 'DPI mínimo aceptable' })
  @IsNumber()
  @Min(72)
  @IsOptional()
  minDpi?: number;
}
