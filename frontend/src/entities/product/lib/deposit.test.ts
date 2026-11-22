import { describe, expect, it } from "vitest";
import { splitDeposit } from "./deposit";

describe("splitDeposit", () => {
  it("parte el precio en 70% de anticipo y 30% de saldo", () => {
    expect(splitDeposit(100)).toEqual({ deposit: 70, balance: 30 });
  });

  it("redondea el saldo hacia abajo a dólares enteros y el anticipo completa el precio", () => {
    const { deposit, balance } = splitDeposit(69.99);
    expect(deposit).toBe(49.99);
    expect(balance).toBe(20);
    expect(deposit + balance).toBeCloseTo(69.99, 10);
  });

  it("con precio cero no hay anticipo ni saldo", () => {
    expect(splitDeposit(0)).toEqual({ deposit: 0, balance: 0 });
  });
});
