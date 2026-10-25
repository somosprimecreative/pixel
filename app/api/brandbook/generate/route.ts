import { generateObject } from "ai";
import { gateway } from "@ai-sdk/gateway";
import { z } from "zod";
import { getAuthContext } from "@/services/auth.service";

const sectionType = z.enum(["cover", "overview", "logo_system", "color_palette", "typography", "graphic_elements", "applications", "closing"]);
const requestSchema = z.object({
  kind: z.enum(["brandbook", "identity_presentation"]),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1200).optional(),
  purpose: z.string().trim().max(500).optional(),
  audience: z.string().trim().max(500).optional(),
  tone: z.string().trim().max(300).optional(),
  theme: z.enum(["editorial", "system", "expressive"]),
  sections: z.array(sectionType).min(2).max(12),
  colors: z.array(z.object({ name: z.string().max(60), role: z.string().max(40) })).max(16),
});

const responseSchema = z.object({
  title: z.string().max(120),
  subtitle: z.string().max(180),
  sections: z.array(z.object({ type: sectionType, title: z.string().max(80), summary: z.string().max(240) })).min(2).max(12),
  warnings: z.array(z.object({ message: z.string().max(180) })).max(6),
});

export async function POST(request: Request) {
  const auth = await getAuthContext();
  if (auth.kind !== "active") return Response.json({ error: "Sua sessão não permite esta ação." }, { status: 401 });
  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Revise os dados de marca antes de gerar o rascunho." }, { status: 400 });
  if (!process.env.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN) return Response.json({ error: "A geração de brandbook por IA ainda não foi configurada neste ambiente." }, { status: 503 });

  const payload = parsed.data;
  try {
    const { object } = await generateObject({
      model: gateway("anthropic/claude-sonnet-4.6"), schema: responseSchema,
      system: "Você é estrategista de marca brasileiro no Pixel. Retorne exclusivamente dados estruturados para um brandbook original. Não proponha HTML, CSS, layouts livres, logos, cores, fontes, números técnicos, área de proteção, tamanho mínimo ou fatos não informados. Escreva em português do Brasil. Cada resumo deve ser editável, curto, específico e no máximo 34 palavras. Preserve exatamente os tipos de seção solicitados e não acrescente tipos.",
      prompt: `Crie um plano inicial para ${payload.kind === "brandbook" ? "um brandbook" : "uma apresentação curta de identidade"} da marca ${payload.name}. Tema: ${payload.theme}. Descrição: ${payload.description || "não informada"}. Propósito: ${payload.purpose || "não informado"}. Público: ${payload.audience || "não informado"}. Tom: ${payload.tone || "não informado"}. Cores cadastradas: ${payload.colors.map((color) => `${color.name} (${color.role})`).join(", ") || "nenhuma"}. Entregue somente estas seções, na ordem recebida: ${payload.sections.join(", ")}. Para regras técnicas não fornecidas, adicione um aviso em vez de inventar.`
    });
    return Response.json({ ...object, sections: payload.sections.map((type) => object.sections.find((section) => section.type === type) ?? { type, title: type.replaceAll("_", " "), summary: "Conteúdo a revisar." }) });
  } catch (error) {
    console.error("brandbook_generation_failed", error);
    return Response.json({ error: "Não foi possível estruturar o brandbook agora. Tente novamente em alguns instantes." }, { status: 502 });
  }
}
