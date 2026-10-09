import { describe, expect, it } from "vitest";
import { estaAtrasada, hojeISO, segundaDaSemana, somarDias } from "@/lib/datas";

describe("datas", () => {
  it("usa o fuso da Bahia para o 'hoje'", () => {
    // 01:30 UTC de 10/10 ainda é 22:30 de 09/10 em Salvador
    expect(hojeISO(new Date("2026-10-10T01:30:00Z"))).toBe("2026-10-09");
    expect(hojeISO(new Date("2026-10-10T03:30:00Z"))).toBe("2026-10-10");
  });

  it("encontra a segunda-feira da semana", () => {
    expect(segundaDaSemana("2026-10-09")).toBe("2026-10-05"); // sexta
    expect(segundaDaSemana("2026-10-05")).toBe("2026-10-05"); // segunda
    expect(segundaDaSemana("2026-10-11")).toBe("2026-10-05"); // domingo
  });

  it("soma dias atravessando o mês", () => {
    expect(somarDias("2026-10-30", 3)).toBe("2026-11-02");
    expect(somarDias("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("tarefa da semana só fica atrasada depois do prazo", () => {
    const t = { status: "pendente", data_execucao: "2026-10-05", janela_fim: "2026-10-10" };
    expect(estaAtrasada(t, "2026-10-09")).toBe(false);
    expect(estaAtrasada(t, "2026-10-10")).toBe(false);
    expect(estaAtrasada(t, "2026-10-11")).toBe(true);
    expect(estaAtrasada({ ...t, status: "concluida" }, "2026-10-11")).toBe(false);
    expect(estaAtrasada({ ...t, status: "aguardando_aprovacao" }, "2026-10-11")).toBe(false);
  });
});
