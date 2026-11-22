/**
 * Esquema de pago de los rompecabezas: anticipo de ~70% al pedir (pago manual
 * registrado en Shopify) y el resto, ~30%, en efectivo al recibir. Debe
 * coincidir con la sección "Pagos" de /shipping-returns y con /terms. Los packs
 * de créditos se pagan completos y no pasan por aquí.
 */
export const BALANCE_RATE = 0.3;

/**
 * Parte el precio en anticipo y saldo. El saldo es el 30% redondeado hacia
 * abajo a dólares enteros (se cobra en efectivo: sin centavos) y el anticipo es
 * la diferencia, para que ambos sumen exactamente el precio.
 * $69,99 → $49,99 + $20.
 */
export function splitDeposit(price: number): {
  deposit: number;
  balance: number;
} {
  // El épsilon evita que 30.000…01 / 29.999…99 de coma flotante caiga mal.
  const balance = Math.max(0, Math.floor(price * BALANCE_RATE + 1e-9));
  const deposit = Math.round((price - balance) * 100) / 100;
  return { deposit, balance };
}
