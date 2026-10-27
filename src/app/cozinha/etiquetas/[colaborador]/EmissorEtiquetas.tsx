"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ROTULO_CONSERVACAO,
  ROTULO_TIPO,
  dataEtiqueta,
  horaEtiqueta,
  normalizar,
  opcoesConservacao,
  textoValidade,
  type OpcaoConservacao,
} from "@/lib/etiqueta";
import { MODOS_IMPRESSAO, imprimirEtiqueta, lerModo, salvarModo, type ModoImpressao } from "@/lib/etiqueta-desenho";
import type { Conservacao, EtiquetaEmitida, EtiquetaItem } from "@/lib/tipos";
import { emitirEtiqueta } from "../../actions";

type Props = {
  colaboradorId: string;
  setor: string;
  itens: EtiquetaItem[];
  recentes: EtiquetaEmitida[];
  produtoInicial: string | null;
  tarefaId: string | null;
};

export function EmissorEtiquetas({ colaboradorId, setor, itens, recentes, produtoInicial, tarefaId }: Props) {
  const inicial = produtoInicial ? (itens.find((i) => i.produto_id === produtoInicial) ?? null) : null;
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState<string | null>(inicial ? null : setor);
  const [item, setItem] = useState<EtiquetaItem | null>(inicial);
  const [modo, setModo] = useState<ModoImpressao>("rawbt-pdf");
  const [mostrarConfig, setMostrarConfig] = useState(false);
  const [historico, setHistorico] = useState<EtiquetaEmitida[]>(recentes);

  useEffect(() => setModo(lerModo()), []);

  const grupos = useMemo(() => Array.from(new Set(itens.map((i) => i.grupo))), [itens]);
  const visiveis = useMemo(() => {
    const q = normalizar(busca);
    if (q) return itens.filter((i) => normalizar(`${i.nome} ${i.grupo}`).includes(q));
    if (grupo && grupos.includes(grupo)) return itens.filter((i) => i.grupo === grupo);
    return itens;
  }, [itens, busca, grupo, grupos]);

  function trocarModo(m: ModoImpressao) {
    setModo(m);
    salvarModo(m);
  }

  return (
    <div className="pilha">
      {produtoInicial && !inicial && (
        <div className="aviso">Este produto ainda não tem validade cadastrada. Escolha na lista ou peça para a líder cadastrar.</div>
      )}

      {item ? (
        <FormEtiqueta
          key={item.id}
          item={item}
          colaboradorId={colaboradorId}
          tarefaId={inicial?.id === item.id ? tarefaId : null}
          modo={modo}
          aoVoltar={() => setItem(null)}
          aoEmitir={(e) => setHistorico((h) => [e, ...h].slice(0, 15))}
        />
      ) : (
        <>
          <input
            id="busca-etiqueta"
            type="search"
            placeholder="Buscar produto (ex.: cheddar, bacon, alface)"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            style={{ fontSize: "1.2rem", minHeight: 56 }}
            aria-label="Buscar produto"
          />
          {!busca && (
            <div className="linha">
              <button type="button" className={`botao ${grupo === null ? "primario" : ""}`} onClick={() => setGrupo(null)}>
                Todos
              </button>
              {grupos.map((g) => (
                <button key={g} type="button" className={`botao ${grupo === g ? "primario" : ""}`} onClick={() => setGrupo(g)}>
                  {g}
                </button>
              ))}
            </div>
          )}
          {visiveis.length === 0 && <div className="aviso">Nenhum produto encontrado.</div>}
          <div className="itens-etiqueta">
            {visiveis.map((i) => (
              <button key={i.id} type="button" className="item-etiqueta" onClick={() => setItem(i)}>
                <span className="nome">{i.nome}</span>
                <span className="detalhe">{resumoPrazo(i)}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {historico.length > 0 && (
        <section className="pilha" style={{ marginTop: 12 }}>
          <h2>Últimas etiquetas</h2>
          <div className="cartao tabela-rolagem">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Feita</th>
                  <th>Vence</th>
                  <th>Por</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {historico.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <strong>{e.nome}</strong>
                      <div className="muted pequeno">
                        {ROTULO_CONSERVACAO[e.conservacao]} · {e.quantidade} un · lote {e.lote}
                      </div>
                    </td>
                    <td>
                      {dataEtiqueta(e.manipulado_em)} {horaEtiqueta(e.manipulado_em)}
                    </td>
                    <td>{dataEtiqueta(e.vence_em)}</td>
                    <td>{e.responsavel}</td>
                    <td>
                      <BotaoReimprimir etiqueta={e} modo={modo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="pilha">
        <button type="button" className="botao" style={{ alignSelf: "flex-start" }} onClick={() => setMostrarConfig((v) => !v)}>
          ⚙ Impressora
        </button>
        {mostrarConfig && (
          <div className="cartao pilha">
            <p className="muted">Escolha como este tablet envia as etiquetas para a Knup. A escolha fica salva neste tablet.</p>
            {MODOS_IMPRESSAO.map((m) => (
              <label key={m.valor} className="check" style={{ alignItems: "flex-start" }}>
                <input type="radio" name="modo" checked={modo === m.valor} onChange={() => trocarModo(m.valor)} />
                <span>
                  <strong>{m.rotulo}</strong>
                  <br />
                  <span className="muted pequeno">{m.ajuda}</span>
                </span>
              </label>
            ))}
            <BotaoTeste modo={modo} />
          </div>
        )}
      </section>
    </div>
  );
}

function resumoPrazo(i: EtiquetaItem): string {
  const partes: string[] = [];
  if (i.dias_resfriado !== null) partes.push(`Resfriado ${textoValidade(i.dias_resfriado)}`);
  if (i.dias_congelado !== null) partes.push(`Congelado ${textoValidade(i.dias_congelado)}`);
  if (i.dias_ambiente !== null) partes.push(`Ambiente ${textoValidade(i.dias_ambiente)}`);
  if (partes.length === 0) return "Prazo da embalagem";
  return partes.join(" · ");
}

function FormEtiqueta({
  item,
  colaboradorId,
  tarefaId,
  modo,
  aoVoltar,
  aoEmitir,
}: {
  item: EtiquetaItem;
  colaboradorId: string;
  tarefaId: string | null;
  modo: ModoImpressao;
  aoVoltar: () => void;
  aoEmitir: (e: EtiquetaEmitida) => void;
}) {
  const opcoes = opcoesConservacao(item);
  const [escolha, setEscolha] = useState<OpcaoConservacao>(opcoes[0]!);
  const [qtd, setQtd] = useState(1);
  const [dias, setDias] = useState("");
  const [original, setOriginal] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [feita, setFeita] = useState<{ etiqueta: EtiquetaEmitida; previa: string } | null>(null);
  const [pendente, iniciar] = useTransition();
  const precisaDias = escolha.dias === null;

  function imprimir() {
    setErro(null);
    if (precisaDias && dias.trim() === "") {
      setErro("Digite em quantos dias vence (está na embalagem).");
      return;
    }
    iniciar(async () => {
      const r = await emitirEtiqueta({
        colaboradorId,
        itemId: item.id,
        conservacao: escolha.conservacao,
        quantidade: qtd,
        dias: precisaDias ? Number(dias.replace(",", ".")) : null,
        validadeOriginal: original || null,
        tarefaId,
      });
      if (!r.etiqueta) {
        setErro(r.erro ?? "Não foi possível gerar a etiqueta.");
        return;
      }
      aoEmitir(r.etiqueta);
      try {
        const previa = await imprimirEtiqueta(r.etiqueta, qtd, modo);
        setFeita({ etiqueta: r.etiqueta, previa });
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Etiqueta registrada, mas a impressão falhou. Use Reimprimir.");
      }
    });
  }

  async function imprimirDeNovo() {
    if (!feita) return;
    setErro(null);
    try {
      await imprimirEtiqueta(feita.etiqueta, qtd, modo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "A impressão falhou.");
    }
  }

  return (
    <section className="cartao destaque pilha">
      <div className="linha entre">
        <div>
          <div className="muted pequeno">
            {item.grupo} · {ROTULO_TIPO[item.tipo]}
          </div>
          <h2 style={{ fontSize: "1.6rem", margin: 0 }}>{item.nome}</h2>
        </div>
        <button type="button" className="botao grande" onClick={aoVoltar}>
          Trocar produto
        </button>
      </div>
      {item.observacao && <div className="aviso">{item.observacao}</div>}

      {feita ? (
        <div className="pilha">
          <div className="ok" style={{ fontSize: "1.15rem" }}>
            Etiqueta enviada para a impressora. Lote {feita.etiqueta.lote}, vence {dataEtiqueta(feita.etiqueta.vence_em)}.
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={feita.previa} alt={`Prévia da etiqueta de ${feita.etiqueta.nome}`} className="previa-etiqueta" />
          {erro && <div className="erro">{erro}</div>}
          <div className="linha">
            <button type="button" className="botao grande" style={{ flex: 1 }} onClick={imprimirDeNovo}>
              🖨 Imprimir de novo
            </button>
            <button type="button" className="botao primario grande" style={{ flex: 1 }} onClick={aoVoltar}>
              Outra etiqueta
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="pilha">
            <span className="rotulo-grande">Como vai guardar?</span>
            <div className="linha">
              {opcoes.map((o) => (
                <button
                  key={o.conservacao}
                  type="button"
                  className={`botao grande ${escolha.conservacao === o.conservacao ? "primario" : ""}`}
                  style={{ flex: "1 1 160px", flexDirection: "column", gap: 2 }}
                  onClick={() => setEscolha(o)}
                  aria-pressed={escolha.conservacao === o.conservacao}
                >
                  {ROTULO_CONSERVACAO[o.conservacao as Conservacao]}
                  <span style={{ fontSize: ".9rem", fontWeight: 600 }}>
                    {o.dias === null ? "prazo da embalagem" : textoValidade(o.dias)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {precisaDias && (
            <div className="campos">
              <div className="campo">
                <label htmlFor="dias-etiqueta">Vale quantos dias depois de aberto?</label>
                <input
                  id="dias-etiqueta"
                  inputMode="numeric"
                  value={dias}
                  onChange={(e) => setDias(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="Veja na embalagem"
                  style={{ fontSize: "1.3rem" }}
                />
              </div>
            </div>
          )}

          {item.tipo !== "preparo" && (
            <div className="campos">
              <div className="campo">
                <label htmlFor="original-etiqueta">Validade original da embalagem (opcional)</label>
                <input id="original-etiqueta" type="date" value={original} onChange={(e) => setOriginal(e.target.value)} />
              </div>
            </div>
          )}

          <div className="pilha">
            <span className="rotulo-grande">Quantas etiquetas?</span>
            <div className="linha">
              <button type="button" className="botao grande" onClick={() => setQtd((q) => Math.max(1, q - 1))} aria-label="Menos">
                −
              </button>
              <span className="qtd" style={{ minWidth: 70, textAlign: "center" }} aria-live="polite">
                {qtd}
              </span>
              <button type="button" className="botao grande" onClick={() => setQtd((q) => Math.min(50, q + 1))} aria-label="Mais">
                +
              </button>
              {[5, 10].map((n) => (
                <button key={n} type="button" className="botao" onClick={() => setQtd(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>

          {erro && <div className="erro">{erro}</div>}
          <button type="button" className="botao primario grande cheio" disabled={pendente} onClick={imprimir}>
            {pendente ? "Gerando etiqueta..." : `🏷 Imprimir ${qtd} etiqueta${qtd > 1 ? "s" : ""}`}
          </button>
        </>
      )}
    </section>
  );
}

function BotaoReimprimir({ etiqueta, modo }: { etiqueta: EtiquetaEmitida; modo: ModoImpressao }) {
  const [erro, setErro] = useState(false);
  return (
    <button
      type="button"
      className="botao"
      title={erro ? "A impressão falhou" : undefined}
      onClick={async () => {
        try {
          await imprimirEtiqueta(etiqueta, 1, modo);
          setErro(false);
        } catch {
          setErro(true);
        }
      }}
    >
      {erro ? "Tentar de novo" : "Reimprimir"}
    </button>
  );
}

function BotaoTeste({ modo }: { modo: ModoImpressao }) {
  const [msg, setMsg] = useState<string | null>(null);
  async function testar() {
    const agora = new Date();
    const vence = new Date(agora.getTime() + 3 * 86400000);
    const teste: EtiquetaEmitida = {
      id: "teste",
      lote: "TESTE",
      nome: "Etiqueta de teste",
      tipo: "preparo",
      setor: "Cozinha",
      conservacao: "resfriado",
      temperatura: "até 4 °C",
      manipulado_em: agora.toISOString(),
      validade_dias: 3,
      vence_em: vence.toISOString(),
      validade_original: null,
      quantidade: 1,
      responsavel: "Teste",
      empresa: "NOVE NOVE BURGER'S",
      cnpj: null,
    };
    try {
      await imprimirEtiqueta(teste, 1, modo);
      setMsg("Teste enviado. Se não saiu, confira se o RawBT está instalado e com a Knup escolhida.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "O teste falhou.");
    }
  }
  return (
    <div className="pilha">
      <button type="button" className="botao" style={{ alignSelf: "flex-start" }} onClick={testar}>
        Imprimir etiqueta de teste (não fica registrada)
      </button>
      {msg && <p className="muted pequeno">{msg}</p>}
    </div>
  );
}
