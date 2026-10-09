import { describe, expect, it } from "vitest";
import { numeroOuNulo, uuidOuNulo } from "@/lib/form";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.append(k, v));
  return f;
};

describe("validação de formulários", () => {
  it("aceita vírgula decimal e bloqueia negativos", () => {
    expect(numeroOuNulo(fd({ q: "2,5" }), "q")).toBe(2.5);
    expect(numeroOuNulo(fd({ q: "" }), "q")).toBeNull();
    expect(() => numeroOuNulo(fd({ q: "-1" }), "q")).toThrow();
    expect(() => numeroOuNulo(fd({ q: "abc" }), "q")).toThrow();
  });

  it("só aceita UUID válido", () => {
    expect(uuidOuNulo(fd({ id: "8f14e45f-ceea-467a-9a4e-3c6f0b2d1e7a" }), "id")).not.toBeNull();
    expect(uuidOuNulo(fd({ id: "1 or 1=1" }), "id")).toBeNull();
  });
});
