# Pixel · Brand & Product System

## Fonte de verdade

Este repositório implementa **Pixel by Prime Creative**, uma ferramenta de geração de cards e carrosséis orientada por marca, formato, template e conteúdo. Os arquivos em `public/brand/pixel/` são os assets finais e oficiais da marca; use-os diretamente, sem redesenhar, recolorir, rasterizar ou reconstruir símbolos, wordmarks, assinaturas ou app icons.

## Produto

Pixel reduz decisões de composição: a pessoa escolhe uma marca (ou segue sem marca), define formato e template, informa o conteúdo e recebe uma criação pronta. Um card e um carrossel são a mesma criação, com uma ou mais páginas. O produto não é um canvas, editor livre, biblioteca de arquivos ou ferramenta de posicionamento manual.

O fluxo funcional é: **Marca → Formato → Template → Conteúdo → Gerar → Resultado**. Templates são estruturas reutilizáveis; conteúdos podem ser editados e o template recompõe o resultado sem drag, layers, handles ou resize manual.

## Identidade da interface

| Token | Valor | Uso |
| --- | --- | --- |
| Vermilion | `#F04B3E` | ação e produção |
| Ice Blue | `#A9DCE8` | destaque editorial |
| Light background | `#F1F0EB` | fundo principal claro |
| Light surface | `#FFFFFF` | superfície clara |
| Dark background | `#121212` | fundo principal escuro |
| Dark surface | `#1B1B1B` | superfície escura |

Vermilion representa ação e produção. Ice Blue é um acento editorial. Neutros devem dominar superfícies, leitura e áreas de trabalho. Os estados semânticos de sucesso, erro e aviso permanecem distintos das cores de marca.

Light e dark possuem tokens próprios; dark não é uma inversão automática.

## Assets oficiais

Os 30 SVGs oficiais são preservados em famílias sem modificação:

- `symbol/`: símbolo para aplicações compactas;
- `app-icon/`: ícones de instalação e superfícies de sistema;
- `wordmark/`: identificação principal quando há espaço;
- `signature/`: lockups e assinaturas oficiais, incluindo variantes cromáticas.

Escolha a variante oficial adequada para contraste. Se uma aplicação exigir uma variante inexistente, solicite o asset; não crie uma nova versão da marca.

## Prime Product Foundations

Pixel compartilha fundamentos de produto com o Órbita sem diluir sua identidade. A estrutura comum cobre escala tipográfica Geist, espaços, raio, superfícies, botões, campos, estados de foco, menus de conta, modais, toasts, estados vazios, loading e responsividade. A implementação mantém Vermilion e Ice Blue fixos como tokens de Pixel; não importa Blue + Butter nem ativos do Prisma.

O seletor de tema segue a estratégia do Órbita: `next-themes`, com `data-theme`, preferência do sistema como padrão e persistência local automática. O script inicial do provider aplica o tema antes da hidratação, evitando flash entre login, área autenticada, atualização e logout. Ainda não há preferência de aparência no perfil compartilhado; quando existir, ela poderá sincronizar sobre a mesma estratégia sem trocar os tokens de Pixel.

## Acesso compartilhado Prime

O Pixel usa o mesmo Supabase e a mesma sessão SSR do Órbita. Não há banco, tabela, migration, credencial ou login paralelo. A sessão é renovada por `proxy.ts`; o acesso requer um usuário Supabase vinculado a um `team_member` **ativo** no workspace Prime. Convites pendentes, pessoas inativas/removidas, vínculos ausentes e workspace ausente são bloqueados e a sessão é encerrada após uma tentativa de login não autorizada.

Variáveis esperadas (somente nomes): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. O Pixel não presume uma permissão `pixel.*`, porque ela ainda não existe no catálogo compartilhado de permissões do Órbita. O modelo Prime deseja `product_access`, mas essa entidade também não está no schema auditado. Portanto, a autorização atual respeita o controle de acesso real já disponível — membro ativo no workspace — sem fingir SSO ou inventar uma regra de perfil. Uma migration compartilhada com RLS deve adicionar o acesso a produto antes de restringir o Pixel por perfil.

## Limites técnicos atuais

O histórico e a retenção continuam no armazenamento local do navegador por enquanto. Google Drive, persistência compartilhada de criações e exportação server-side ainda dependem de infraestrutura adicional. A autenticação só funciona após as variáveis do Supabase compartilhado estarem configuradas neste ambiente; até isso ocorrer, a tela informa a configuração ausente e não simula uma sessão.

O módulo Brandbooks possui uma fundação de dados aplicada no Supabase central da Prime. Consulte [Módulo de Identidade Visual](../modulo_identidade_visual.md). Não replique a estrutura em um projeto Supabase paralelo nem exponha o bucket de ativos publicamente.
