import { criarSupabaseServidor } from "@/lib/supabase/server";
import { ROTULO_CONSERVACAO, ROTULO_DATA, dataEtiqueta, dataSimples, horaEtiqueta, textoValidade, vencida } from "@/lib/etiqueta";
import type { EtiquetaEmitida } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/** Aberta pelo QR da etiqueta: mostra o que foi impresso e se ainda está na validade. */
export default async function ConsultaEtiqueta({ params }: { params: Promise<{ lote: string }> }) {
  const { lote } = await params;
  const supabase = await criarSupabaseServidor();
  const { data } = await supabase.rpc("prod_etiqueta_por_lote", { p_lote: decodeURIComponent(lote).slice(0, 40) });
  const e = (data ?? null) as EtiquetaEmitida | null;

  if (!e) {
    return (
      <main className="container pilha" style={{ maxWidth: 520, paddingTop: 40 }}>
        <span className="marca">NOVE NOVE BURGERS</span>
        <div className="erro">Etiqueta não encontrada.</div>
      </main>
    );
  }

  const venceu = vencida(e);
  const linhas: [string, string][] = [
    ["Conservação", `${ROTULO_CONSERVACAO[e.conservacao]} · ${e.temperatura}`],
    [ROTULO_DATA[e.tipo], `${dataEtiqueta(e.manipulado_em)} às ${horaEtiqueta(e.manipulado_em)}`],
    ["Validade", textoValidade(e.validade_dias)],
    ["Vence", `${dataEtiqueta(e.vence_em)} às ${horaEtiqueta(e.vence_em)}`],
    ["Responsável", e.responsavel],
    ["Lote", e.lote],
  ];
  if (e.validade_original) linhas.push(["Validade original", dataSimples(e.validade_original)]);

  return (
    <main className="container pilha" style={{ maxWidth: 520, paddingTop: 32 }}>
      <span className="marca">NOVE NOVE BURGERS</span>
      <h1 style={{ fontSize: "1.8rem" }}>{e.nome}</h1>
      <div className={venceu ? "erro" : "ok"} style={{ fontSize: "1.2rem", fontWeight: 800 }}>
        {venceu ? "VENCIDO: descartar" : "Dentro da validade"}
      </div>
      <div className="cartao">
        <table>
          <tbody>
            {linhas.map(([k, v]) => (
              <tr key={k}>
                <th style={{ width: "40%" }}>{k}</th>
                <td>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {e.cnpj && <p className="muted pequeno">CNPJ {e.cnpj}</p>}
    </main>
  );
}
