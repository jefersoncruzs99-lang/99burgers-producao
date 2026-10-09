import { describe, expect, it } from "vitest";
import { aProduzir, lerQuantidade, produzNaSemana } from "@/lib/estoque";

describe("meta de estoque", () => {
  it("produz a diferença entre a meta e o contado (maionese 50 − 30 = 20)", () => {
    expect(aProduzir(50, 30)).toBe(20);
    expect(aProduzir(40, 30)).toBe(10);
  });
  it("não produz quando já tem o suficiente", () => {
    expect(aProduzir(50, 55)).toBe(0);
    expect(aProduzir(50, 50)).toBe(0);
  });
  it("sem contagem ou fora da semana do quinzenal, não produz", () => {
    expect(aProduzir(50, null)).toBe(0);
    expect(aProduzir(50, 10, false)).toBe(0);
  });
  it("arredonda decimais", () => {
    expect(aProduzir(10, 7.333)).toBe(2.67);
  });
  it("quinzenal alterna as semanas", () => {
    expect(produzNaSemana("quinzenal", "2026-10-05", "2026-10-05")).toBe(true);
    expect(produzNaSemana("quinzenal", "2026-10-05", "2026-10-12")).toBe(false);
    expect(produzNaSemana("quinzenal", "2026-10-05", "2026-10-19")).toBe(true);
    expect(produzNaSemana("quinzenal", "2026-10-05", "2026-09-28")).toBe(false);
    expect(produzNaSemana("semanal", "2026-10-05", "2026-10-12")).toBe(true);
  });
  it("lê a quantidade digitada", () => {
    expect(lerQuantidade("2,5")).toBe(2.5);
    expect(lerQuantidade("")).toBeNull();
    expect(lerQuantidade("-3")).toBeNull();
  });
});
