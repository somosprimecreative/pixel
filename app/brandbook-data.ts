export type BrandbookKind = "brandbook" | "identity_presentation";
export type BrandAssetRole = "primary_logo" | "alternate_logo" | "pattern" | "graphic" | "icon" | "illustration" | "photograph" | "mockup" | "other";
export type BrandbookTheme = "editorial" | "system" | "expressive";
export type BrandbookSectionType = "cover" | "overview" | "logo_system" | "color_palette" | "typography" | "graphic_elements" | "applications" | "closing";

export type BrandbookAsset = {
  id: string;
  role: BrandAssetRole;
  label: string;
  fileName?: string;
  source?: string;
  recommendedBackground: "light" | "dark" | "both";
  notes?: string;
};

export type BrandbookColor = {
  id: string;
  name: string;
  hex: string;
  role: "primary" | "secondary" | "accent" | "neutral_light" | "neutral_dark" | "support";
};

export type BrandbookGraphic = {
  id: string;
  type: Exclude<BrandAssetRole, "primary_logo" | "alternate_logo">;
  label: string;
  source?: string;
  fileName?: string;
  notes?: string;
};

export type BrandbookSection = {
  id: string;
  type: BrandbookSectionType;
  title: string;
  summary: string;
  visible: boolean;
  layoutKey: string;
};

export type BrandbookDraft = {
  id: string;
  kind: BrandbookKind;
  status: "draft" | "ready";
  name: string;
  client: string;
  industry: string;
  description: string;
  purpose: string;
  audience: string;
  tone: string;
  language: string;
  theme: BrandbookTheme;
  variant: string;
  primaryLogo?: BrandbookAsset;
  alternateLogos: BrandbookAsset[];
  colors: BrandbookColor[];
  fonts: { display: string; body: string };
  graphics: BrandbookGraphic[];
  sections: BrandbookSection[];
  createdAt: string;
  updatedAt: string;
};

export const brandbookThemes: { id: BrandbookTheme; name: string; description: string; variants: string[]; supportedFor: BrandbookKind[] }[] = [
  { id: "editorial", name: "Editorial", description: "Grade ampla, títulos grandes e leitura com bastante respiro.", variants: ["Claro", "Escuro", "Cor em foco"], supportedFor: ["brandbook", "identity_presentation"] },
  { id: "system", name: "System", description: "Estrutura modular para tokens, regras e uso operacional.", variants: ["Neutro", "Contraste", "Compacto"], supportedFor: ["brandbook", "identity_presentation"] },
  { id: "expressive", name: "Expressive", description: "Ativos gráficos e mídia em composições de maior presença.", variants: ["Pôster", "Colagem", "Minimal"], supportedFor: ["brandbook", "identity_presentation"] },
];

const sectionCatalog: Record<BrandbookSectionType, Pick<BrandbookSection, "title" | "summary" | "layoutKey">> = {
  cover: { title: "Guia de identidade", summary: "Sistema visual e diretrizes de aplicação.", layoutKey: "cover-logo" },
  overview: { title: "Essência da marca", summary: "Uma síntese de propósito, público e tom de voz.", layoutKey: "statement" },
  logo_system: { title: "Sistema de logos", summary: "Logo principal, variações e contextos de uso aprovados.", layoutKey: "logo-gallery" },
  color_palette: { title: "Paleta de cores", summary: "Tokens nomeados para aplicação consistente.", layoutKey: "color-system" },
  typography: { title: "Tipografia", summary: "Hierarquia de leitura, fontes e papéis tipográficos.", layoutKey: "type-specimen" },
  graphic_elements: { title: "Elementos gráficos", summary: "Patterns, ícones e grafismos com uso orientado.", layoutKey: "asset-gallery" },
  applications: { title: "Aplicações", summary: "Ativos e exemplos selecionados para expressão da marca.", layoutKey: "application" },
  closing: { title: "Encerramento", summary: "Ativos, contato e próximos passos para a identidade.", layoutKey: "closing" },
};

export const defaultSectionTypes: Record<BrandbookKind, BrandbookSectionType[]> = {
  brandbook: ["cover", "overview", "logo_system", "color_palette", "typography", "graphic_elements", "applications", "closing"],
  identity_presentation: ["cover", "overview", "logo_system", "color_palette", "typography", "closing"],
};

const newId = () => crypto.randomUUID();

export function createBrandbookDraft(kind: BrandbookKind): BrandbookDraft {
  const timestamp = new Date().toISOString();
  return {
    id: newId(), kind, status: "draft", name: "", client: "", industry: "", description: "", purpose: "", audience: "", tone: "", language: "Português (Brasil)",
    theme: "editorial", variant: "Claro", primaryLogo: undefined,
    alternateLogos: Array.from({ length: 4 }, (_, index) => ({ id: newId(), role: "alternate_logo", label: `Logo alternativo ${index + 1}`, recommendedBackground: "both" })),
    colors: [
      { id: newId(), name: "Primária", hex: "#F04B3E", role: "primary" },
      { id: newId(), name: "Neutra clara", hex: "#F1F0EB", role: "neutral_light" },
      { id: newId(), name: "Neutra escura", hex: "#121212", role: "neutral_dark" },
    ],
    fonts: { display: "Geist", body: "Geist" }, graphics: [],
    sections: defaultSectionTypes[kind].map((type) => ({ id: newId(), type, visible: true, ...sectionCatalog[type] })),
    createdAt: timestamp, updatedAt: timestamp,
  };
}

export function sectionDefaults(type: BrandbookSectionType) {
  return { id: newId(), type, visible: true, ...sectionCatalog[type] };
}

export function brandbookLabel(kind: BrandbookKind) {
  return kind === "brandbook" ? "Brandbook" : "Apresentação de identidade";
}
