export function Mensagens({ erro, ok }: { erro?: string; ok?: string }) {
  return (
    <>
      {erro && (
        <div className="erro" role="alert">
          {erro}
        </div>
      )}
      {ok && (
        <div className="ok" role="status">
          {ok}
        </div>
      )}
    </>
  );
}

export type ParamsPagina = Promise<Record<string, string | undefined>>;
