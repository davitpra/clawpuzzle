import { describe, expect, it } from "vitest";
import { splitDeposit } from "./deposit";

describe("splitDeposit", () => {
  it("parte el precio en 70% de anticipo y 30% de saldo", () => {
    expect(splitDeposit(100)).toEqual({ deposit: 70, balance: 30 });
  });

  it("redondea el saldo hacia abajo a un múltiplo de $10 y el anticipo completa el precio", () => {
    const { deposit, balance } = splitDeposit(69.99);
    expect(deposit).toBe(49.99);
    expect(balance).toBe(20);
    expect(deposit + balance).toBeCloseTo(69.99, 10);
  });

  it("en el bundle el saldo es $30 (2 rompecabezas) y $40 (3)", () => {
    expect(splitDeposit(119.98)).toEqual({ deposit: 89.98, balance: 30 });
    expect(splitDeposit(149.97)).toEqual({ deposit: 109.97, balance: 40 });
  });

  it("con menos de $10 de saldo no se cobra nada al recibir", () => {
    expect(splitDeposit(25)).toEqual({ deposit: 25, balance: 0 });
  });

  it("con precio cero no hay anticipo ni saldo", () => {
    expect(splitDeposit(0)).toEqual({ deposit: 0, balance: 0 });
  });
});
