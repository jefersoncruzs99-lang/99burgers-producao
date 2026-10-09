# Produção · Nove Nove Burgers

App da cozinha para delegar e acompanhar as tarefas de pré-preparo, produção, organização e limpeza das equipes da **Marmitaria** e da **Hamburgueria**.

- **Tablet da cozinha** (`/cozinha`): a pessoa escolhe o setor, toca no próprio nome e vê as tarefas de hoje e da semana. Ao tocar no produto, abre a **ficha técnica já recalculada** para a quantidade do dia. Marca "Comecei" / "Terminei", informa quanto fez e tira foto quando a tarefa exige.
- **Administração** (`/admin`): dono e líder entram com o login do painel 99 Burgers para montar o quadro do dia, cadastrar tarefas recorrentes (diárias e semanais), equipe, produtos e fichas técnicas, e aprovar entregas com foto.

## Tecnologias
Next.js 15 (App Router) · TypeScript estrito · Supabase (Postgres, Auth, Storage) · Vercel.

## Banco de dados
Usa o **mesmo projeto Supabase do painel**. Todas as tabelas deste app têm o prefixo `prod_` para não conflitar com CMV e escala:

| Tabela | Para quê |
|---|---|
| `prod_setores` | Marmitaria, Hamburgueria… |
| `prod_colaboradores` | Equipe da cozinha (sem login) |
| `prod_produtos` | O que é produzido (feijão, arroz…) |
| `prod_fichas_tecnicas` / `prod_ficha_ingredientes` | Receita versionada de cada produto |
| `prod_modelos_tarefa` | Tarefas recorrentes (diárias/semanais) |
| `prod_tarefas` | Cada execução, por pessoa e data (histórico preservado) |
| `prod_evidencias` | Fotos de comprovação |
| `prod_config` | Código do tablet (só o hash) |
| `prod_metas_estoque` | Meta de estoque por produto (semanal/quinzenal), dia de produzir e responsável |
| `prod_contagens` / `prod_contagem_itens` | Contagem semanal; ao confirmar gera as tarefas com meta − estoque |

Migrações em `supabase/migrations/`. Todas já estão aplicadas no projeto do painel.

### Segurança
- RLS ligado em todas as tabelas. Usuários logados do painel (perfis `admin`/`operator`) administram; a área `/admin` também confere o perfil no servidor.
- O tablet **não acessa tabelas diretamente**: usa funções `prod_cozinha_*` (security definer) que exigem o código da cozinha, guardado no tablet em cookie `httpOnly`. Um colaborador só consegue iniciar/concluir tarefas atribuídas a ele.
- Fotos ficam num bucket **privado** (`prod-evidencias`, só imagens até 5 MB). O tablet só consegue enviar; ver as fotos exige login.
- Nenhuma chave `service_role` é usada.

## Configuração
1. Variáveis (Vercel → Settings → Environment Variables), conforme `.env.example`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (chave pública/anon do mesmo projeto do painel)
2. Supabase → Authentication → URL Configuration: adicione `https://SEU-DOMINIO/auth/callback` em *Redirect URLs* (recuperação de senha).
3. Em `/admin/config`, defina o código do tablet.
4. No tablet: abra `/cozinha`, digite o código e use "Adicionar à tela inicial".

## Desenvolvimento
```bash
npm install
cp .env.example .env.local   # preencha
npm run dev
npm run typecheck && npm test && npm run build
```

## Uso do dia a dia
1. **Equipe**: cadastre os colaboradores em cada setor.
2. **Produtos e fichas**: cadastre os produtos e a ficha técnica (quanto rende + ingredientes + preparo).
3. **Tarefas recorrentes**: o que se repete (ex.: "Feijão 3 kg" diária; "Limpar geladeira" semanal com foto).
4. **Quadro do dia**: confira, troque responsáveis e crie tarefas avulsas.
5. **Aprovações**: veja as fotos e aprove ou devolva para refazer.
6. **Metas de estoque**: para geleias, molhos etc. Toda segunda alguém faz a contagem no tablet (📦 Contagem de estoque); ao confirmar, o responsável recebe "Produzir X: meta − estoque" no dia de produção, com a ficha técnica já multiplicada.
