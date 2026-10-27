import { describe, expect, it } from "vitest";
import { camposEtiqueta, dataEtiqueta, diaSemanaEtiqueta, horaEtiqueta, normalizar, opcoesConservacao, vencida } from "@/lib/etiqueta";
import { bitmap1Bit, pdfEtiquetas, tsplEtiquetas } from "@/lib/etiqueta-arquivos";
import type { EtiquetaEmitida } from "@/lib/tipos";

const base: EtiquetaEmitida = {
  id: "x",
  lote: "271026-014",
  nome: "Maionese Especial",
  tipo: "preparo",
  setor: "Hamburgueria",
  conservacao: "resfriado",
  temperatura: "até 4 °C",
  manipulado_em: "2026-10-27T14:42:00Z", // 11:42 na Bahia
  validade_dias: 2,
  vence_em: "2026-10-29T14:42:00Z",
  validade_original: null,
  quantidade: 1,
  responsavel: "Pablo Gomes",
  empresa: "NOVE NOVE BURGER'S",
  cnpj: "40.161.847/0001-72",
};

const texto = (b: Uint8Array) => Array.from(b, (c) => String.fromCharCode(c)).join("");

describe("etiqueta", () => {
  it("formata data, hora e dia da semana no fuso da Bahia", () => {
    expect(dataEtiqueta(base.manipulado_em)).toBe("27/10/26");
    expect(horaEtiqueta(base.manipulado_em)).toBe("11:42");
    expect(diaSemanaEtiqueta(base.vence_em)).toBe("QUI");
    // 01:30 UTC ainda é o dia anterior em Salvador
    expect(dataEtiqueta("2026-10-28T01:30:00Z")).toBe("27/10/26");
  });

  it("monta os campos do modelo A", () => {
    const f = camposEtiqueta(base);
    expect(f.tag).toBeNull();
    expect(f.nome).toBe("MAIONESE ESPECIAL");
    expect(f.venceDia).toBe("QUI 29/10/26");
    expect(f.lote).toBe("Lote 271026-014");
    expect(f.linhas.map((l) => l.rotulo)).toEqual(["Conservação", "Temperatura", "Manipulação", "Validade", "Responsável"]);
    expect(f.linhas[3]?.valor).toBe("2 dias");
  });

  it("produto aberto ganha a tag e a validade original", () => {
    const f = camposEtiqueta({ ...base, tipo: "aberto", validade_original: "2027-01-15" });
    expect(f.tag).toBe("ABERTO");
    expect(f.linhas[2]?.rotulo).toBe("Aberto em");
    expect(f.linhas.at(-1)).toEqual({ rotulo: "Val. original", valor: "15/01/27" });
  });

  it("oferece só as conservações com prazo, ou todas quando o prazo vem da embalagem", () => {
    expect(opcoesConservacao({ dias_resfriado: 3, dias_congelado: 30, dias_ambiente: null })).toEqual([
      { conservacao: "resfriado", dias: 3 },
      { conservacao: "congelado", dias: 30 },
    ]);
    const semPrazo = opcoesConservacao({ dias_resfriado: null, dias_congelado: null, dias_ambiente: null });
    expect(semPrazo).toHaveLength(3);
    expect(semPrazo.every((o) => o.dias === null)).toBe(true);
  });

  it("sabe quando venceu e busca sem acento", () => {
    expect(vencida(base, new Date("2026-10-29T14:41:00Z"))).toBe(false);
    expect(vencida(base, new Date("2026-10-29T14:43:00Z"))).toBe(true);
    expect(normalizar("  Feijão ")).toBe("feijao");
  });
});

describe("arquivos da impressora", () => {
  it("gera um PDF com uma página por etiqueta", () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = texto(pdfEtiquetas(jpeg, 480, 400, 3));
    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Count 3");
    expect(pdf.match(/\/Type \/Page /g)).toHaveLength(3);
    expect(pdf).toContain("/MediaBox [0 0 170.08 141.73]");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
    // o startxref aponta para a tabela xref
    const inicio = Number(pdf.match(/startxref\n(\d+)/)?.[1]);
    expect(pdf.slice(inicio, inicio + 4)).toBe("xref");
  });

  it("converte pixels em bitmap TSPL (0 = preto)", () => {
    // 8 x 1: preto, branco, preto, branco...
    const px = new Uint8Array(8 * 4);
    for (let x = 0; x < 8; x++) {
      const v = x % 2 === 0 ? 0 : 255;
      px.set([v, v, v, 255], x * 4);
    }
    expect(Array.from(bitmap1Bit(px, 8, 1))).toEqual([0b01010101]);
    const cmd = texto(tsplEtiquetas(new Uint8Array(60 * 400).fill(0xff), 480, 400, 2));
    expect(cmd).toContain("SIZE 60 mm,50 mm");
    expect(cmd).toContain("BITMAP 0,0,60,400,0,");
    expect(cmd.trimEnd().endsWith("PRINT 1,2")).toBe(true);
  });
});
