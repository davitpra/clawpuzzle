/**
 * Esquema de pago de los rompecabezas: anticipo del 70% al pedir (pago manual
 * registrado en Shopify) y el 30% en efectivo al recibir. Debe coincidir con la
 * sección "Pagos" de /shipping-returns y con /terms. Los packs de créditos se
 * pagan completos y no pasan por aquí.
 */
export const DEPOSIT_RATE = 0.7;

/**
 * Parte el precio en anticipo y saldo. El anticipo se redondea a centavos y el
 * saldo es la diferencia, para que ambos sumen exactamente el precio.
 */
export function splitDeposit(price: number): {
  deposit: number;
  balance: number;
} {
  const deposit = Math.round(price * DEPOSIT_RATE * 100) / 100;
  const balance = Math.round((price - deposit) * 100) / 100;
  return { deposit, balance };
}
