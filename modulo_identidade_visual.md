# Módulo de Identidade Visual · Pixel by Prime Creative

## Status e fonte de verdade

Este documento concentra a especificação do módulo de Identidade Visual do **Pixel by Prime Creative**. Ele traduz a extração oficial `PIXEL-BRANDBOOK-AI-EXTRACTION.md` em um contrato de produto e implementação. Para identidade da interface e assets oficiais do Pixel, prevalece também [docs/pixel-brand-product-system.md](./docs/pixel-brand-product-system.md).

**Estado em 25 de outubro de 2026:** a experiência de Brandbooks está implementada localmente no Pixel; a fundação Supabase foi aplicada ao projeto central **OrbitaByPrime**. A integração de CRUD, upload privado e autosave compartilhado ainda é a próxima etapa de aplicação.

## Objetivo do produto

O módulo cria dois tipos de documento a partir de uma única base de marca:

- **Brandbook:** manual visual e verbal estruturado, pronto para revisão e futura exportação.
- **Apresentação de identidade:** narrativa curta para apresentar e aprovar uma direção visual.

Ele não é Canva, Figma, editor de canvas ou ferramenta de desenho. O usuário informa a marca, seleciona tema e escopo; o Pixel organiza uma estrutura revisável. A composição é determinada por templates de documento e propriedades controladas, nunca por posicionamento manual de elementos.

## Limites de responsabilidade

- O usuário mantém propriedade e controle dos arquivos enviados.
- O Pixel não recria logos, não vetoriza assets, não inventa regras técnicas, área de proteção, tamanhos mínimos ou cores não fornecidas.
- A IA produz somente conteúdo estruturado: plano, títulos, resumos e alertas de lacunas. Ela não retorna HTML, CSS, layout livre ou geometria de marca.
- Toda recomendação gerada é revisável antes de publicação ou exportação.
- Google Drive é destino opcional de exportação; não substitui Storage, banco, versão ou fila de processamento.

## Fluxo do assistente

### 1. Base da marca

Pergunta central: **qual é a base desta identidade?**

Campos: nome da marca (obrigatório), cliente/unidade, segmento, descrição, propósito, público, tom de voz e idioma. Nome e logo principal são os únicos requisitos para gerar a primeira versão.

### 2. Sistema de logos

O logo principal é obrigatório. A tela inicia com quatro espaços de logos alternativos opcionais e permite adicionar quantos forem necessários. Cada ativo tem papel, nome, arquivo original, fundo recomendado e observações. Os arquivos aceitos são SVG, PNG, JPEG e WebP, até 12 MB.

### 3. Tokens

Paleta e tipografia pertencem à marca, não a cada página. Cores têm nome, valor hexadecimal e papel: `primary`, `secondary`, `accent`, `neutral_light`, `neutral_dark` ou `support`. Tipografia registra família, papel (display, body ou support), origem, peso e instruções de uso.

### 4. Biblioteca visual

Patterns, grafismos, ícones, ilustrações, fotos e mockups são opcionais. A interface permite adicionar entradas sem limite fixo e classificá-las por tipo. Esses assets enriquecem capítulos compatíveis; eles não habilitam um editor gráfico livre.

### 5. Tema e escopo

Temas suportados:

- **Editorial:** leitura espaçada, títulos grandes e narrativa visual.
- **System:** grade modular, tokens e regras operacionais.
- **Expressive:** maior presença de mídia e elementos gráficos.

Cada tema possui variantes. O usuário também seleciona capítulos. Capa e encerramento são obrigatórios. O tema permite composições aprovadas, sem alterar livremente a estrutura.

### 6. Geração e revisão

O comando **Gerar rascunho** envia o contexto para uma rota autenticada. A IA retorna um plano estruturado limitado às seções solicitadas; se a IA estiver indisponível, um rascunho editável local continua disponível e a interface informa essa condição. A revisão posterior edita conteúdo e propriedades, não coordenadas ou camadas.

## Capítulos disponíveis

1. Capa
2. Essência da marca
3. Sistema de logos
4. Paleta de cores
5. Tipografia
6. Elementos gráficos
7. Aplicações
8. Encerramento

Cada capítulo tem `section_type`, título, resumo, `layout_key`, posição, visibilidade e conteúdo estruturado. O renderizador escolhe a composição compatível com o tema e a seção.

## Experiência já presente no Pixel

- Aba **Brandbooks** na navegação do produto.
- Criação de Brandbook e apresentação de identidade.
- Assistente em seis etapas.
- Logo principal, quatro alternativas iniciais e adição ilimitada de alternativas.
- Paleta de cores, tipografia e biblioteca de elementos gráficos expansíveis.
- Três temas originais com variações.
- Revisão estruturada, editor por seção e download de um JSON do rascunho.
- Validação de arquivo e tamanho no navegador.
- Geração assistida autenticada via rota `/api/brandbook/generate`.

Enquanto a migration não for aplicada, os rascunhos e uploads permanecem no armazenamento local do navegador. Isso é intencional: não há simulação de persistência compartilhada.

## Fundação Supabase preparada

Migration versionada:

`supabase/migrations/20261025000000_create_pixel_brandbook_foundation.sql`

Ela deve ser aplicada manualmente **apenas** no Supabase central do ecossistema Prime, que já precisa conter:

- `public.workspaces`
- `public.team_members` com `auth_user_id`, `workspace_id` e `status`

Não aplique em um Supabase paralelo/isolado. O Pixel já compartilha autenticação e workspace com o Órbita; o módulo deve fazer o mesmo.

### Tabelas previstas

| Tabela | Responsabilidade |
| --- | --- |
| `pixel_brand_projects` | Base estratégica e verbal da marca. |
| `pixel_brand_documents` | Brandbook ou apresentação, com tema, variante e status. |
| `pixel_brand_assets` | Metadados dos arquivos privados, sem binários no Postgres. |
| `pixel_brand_color_tokens` | Paleta semântica e ordenada. |
| `pixel_brand_typography_tokens` | Papéis tipográficos e origem da fonte. |
| `pixel_brand_document_sections` | Capítulos ordenados e revisáveis. |
| `pixel_brand_document_versions` | Snapshots imutáveis para aprovação e recuperação. |
| `pixel_brand_jobs` | Estado durável de geração, renderização, publicação e exportação. |
| `pixel_brand_exports` | Histórico de PDFs, ZIPs e links quando ativados. |

Todas recebem `workspace_id`, RLS e políticas baseadas em membership ativa. O helper de membership fica no schema interno `private`, fora da superfície RPC pública. Jobs e exports são somente leitura para o browser; as rotas autenticadas do servidor controlam sua escrita. A migration também inclui índices, timestamps automáticos e validações de tamanho, tipo e valores enumerados.

### Storage privado

O bucket `pixel-brandbook-assets` é privado, aceita SVG, PNG, JPEG e WebP, e limita arquivos a 12 MB. Não recebe política pública ou de upload direto do browser. A futura rota de upload do Pixel deverá:

1. validar sessão com `getAuthContext()`;
2. confirmar membership ativa do workspace;
3. validar MIME real, tamanho e SVG seguro;
4. gravar o binário no bucket usando somente a service role no servidor;
5. persistir metadados em `pixel_brand_assets`;
6. entregar URL assinada temporária para leitura.

O service role nunca vai ao navegador.

### Fila

`pixel_brand_jobs` registra a fonte de verdade de tarefas e retries. A migration não habilita `pgmq`, cron ou worker automaticamente, porque o consumidor ainda precisa ser definido com limites, observabilidade e política de reprocessamento.

Quando houver renderização assíncrona, o transporte pode usar **Supabase Queues / pgmq**, mantendo `pixel_brand_jobs` como histórico auditável de produto. Jobs previstos: `generate_plan`, `render_preview`, `export_pdf` e `publish_document`.

### Aplicação no Supabase

Aplicada no projeto central **OrbitaByPrime**. A verificação confirmou nove tabelas com RLS, 16 políticas, oito triggers de `updated_at` e o bucket `pixel-brandbook-assets` privado. A função de membership está no schema interno `private`, não exposta como RPC pública.

As próximas rotas de CRUD e upload autenticado do Pixel devem usar essa fundação; não crie policies públicas no Storage para facilitar testes.

## Variáveis de ambiente

Já utilizadas pela sessão compartilhada do Pixel:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

Nenhuma nova variável é necessária para aplicar a fundação. Para geração de conteúdo com IA, o ambiente já usa `AI_GATEWAY_API_KEY` ou a credencial OIDC de produção da Vercel. Segredos não devem ser adicionados ao repositório.

## Google Drive

O Drive entra depois da exportação: o servidor renderiza PDF/ZIP, registra o resultado em `pixel_brand_exports`, e opcionalmente envia a cópia para uma pasta configurada no Drive do usuário. A conexão, escopo OAuth e tokens seguem [docs/google-drive-setup.md](./docs/google-drive-setup.md).

Não usar o Drive como banco de dados, biblioteca primária de assets, fila ou controle de versões.

## Próximas etapas de implementação

1. Aplicar a migration manualmente no Supabase central.
2. Criar CRUD autenticado de projeto, documento, tokens e capítulos.
3. Implementar upload/remoção de ativos com Storage privado e SVG seguro.
4. Trocar o autosave local por autosave compartilhado, mantendo fallback local para indisponibilidade temporária.
5. Criar worker consumidor de `pixel_brand_jobs` e integrar Supabase Queues se a renderização exigir processamento assíncrono.
6. Implementar render de PDF/ZIP e a exportação opcional para Google Drive.
7. Adicionar links públicos com escopo, expiração e revogação explícitos, se esse recurso for aprovado.

## Restrições permanentes

- Não transformar o módulo em canvas ou editor livre.
- Não reconstruir assets oficiais via CSS, texto ou ícones genéricos.
- Não salvar arquivos binários como JSON no banco.
- Não expor bucket, service role, tokens OAuth ou fila ao browser.
- Não misturar dados de workspaces.
- Não tratar uma resposta da IA como verdade de marca sem revisão humana.
