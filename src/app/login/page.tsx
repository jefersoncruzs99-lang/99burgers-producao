import { FormLogin } from "./FormLogin";

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const sp = await searchParams;
  const proximo = sp.proximo && /^\/admin(\/[a-z0-9/-]*)?$/i.test(sp.proximo) ? sp.proximo : undefined;
  const deEtiquetas = proximo?.startsWith("/admin/etiquetas");
  return (
    <main className="container pilha" style={{ maxWidth: 440, paddingTop: 48 }}>
      <h1>
        <span className="marca">NOVE NOVE BURGERS</span>
        <br />
        {deEtiquetas ? "Administração das etiquetas" : "Administração da produção"}
      </h1>
      <p className="muted">Entre com o mesmo e-mail e senha do painel 99 Burgers.</p>
      {sp.expirada && !deEtiquetas && <div className="aviso">Sua sessão expirou. Entre novamente.</div>}
      {sp.sem_acesso && <div className="erro">Este usuário não tem acesso à administração.</div>}
      <FormLogin proximo={proximo} />
    </main>
  );
}
