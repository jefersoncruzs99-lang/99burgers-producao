import { describe, expect, it } from "vitest";
import { ajustarFicha, converter, formatarQtd } from "@/lib/receita";

const feijao = {
  rendimento: 1,
  unidade_rendimento: "kg",
  ingredientes: [
    { nome: "Feijão carioca", quantidade: 0.4, unidade: "kg" },
    { nome: "Sal", quantidade: 8, unidade: "g" },
    { nome: "Alho", quantidade: 2, unidade: "dente" },
  ],
};

describe("ajustarFicha", () => {
  it("multiplica a receita pela quantidade pedida (3 kg de feijão)", () => {
    const r = ajustarFicha(feijao, 3, "kg");
    expect(r.fator).toBe(3);
    expect(r.ajustada).toBe(true);
    expect(r.ingredientes.map((i) => i.quantidade)).toEqual([1.2, 24, 6]);
    expect(r.ingredientes[1]?.unidade).toBe("g");
  });

  it("converte unidades compatíveis (pedido em g, ficha em kg)", () => {
    const r = ajustarFicha(feijao, 500, "g");
    expect(r.fator).toBe(0.5);
    expect(r.ingredientes[0]?.quantidade).toBe(0.2);
  });

  it("ficha que rende 5 kg e pedido de 2 kg", () => {
    const r = ajustarFicha({ ...feijao, rendimento: 5 }, 2, "kg");
    expect(r.fator).toBeCloseTo(0.4);
    expect(r.ingredientes[2]?.quantidade).toBe(0.8);
  });

  it("sem quantidade na tarefa mostra a receita original", () => {
    const r = ajustarFicha(feijao, null, null);
    expect(r.ajustada).toBe(false);
    expect(r.ingredientes).toEqual(feijao.ingredientes);
  });

  it("unidades incompatíveis mostram a original com aviso", () => {
    const r = ajustarFicha(feijao, 10, "un");
    expect(r.ajustada).toBe(false);
    expect(r.aviso).toMatch(/receita original/);
  });

  it("não altera a ficha recebida", () => {
    ajustarFicha(feijao, 3, "kg");
    expect(feijao.ingredientes[0]?.quantidade).toBe(0.4);
  });

  it("ignora quantidade zero ou negativa", () => {
    expect(ajustarFicha(feijao, 0, "kg").ajustada).toBe(false);
    expect(ajustarFicha(feijao, -2, "kg").ajustada).toBe(false);
  });
});

describe("converter", () => {
  it("kg ↔ g e l ↔ ml", () => {
    expect(converter(1.5, "kg", "g")).toBe(1500);
    expect(converter(250, "ml", "L")).toBe(0.25);
    expect(converter(1, "kg", "l")).toBeNull();
  });
});

describe("formatarQtd", () => {
  it("formata no padrão brasileiro", () => {
    expect(formatarQtd(1.2, "kg")).toBe("1,2 kg");
    expect(formatarQtd(3)).toBe("3");
    expect(formatarQtd(null, "kg")).toBe("");
  });
});
