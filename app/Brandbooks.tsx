"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleAlert, Copy, Download, FileText, ImagePlus, Layers3, Palette, Plus, Sparkles, Trash2, Upload, X } from "lucide-react";
import { BrandbookAsset, BrandbookColor, BrandbookDraft, BrandbookGraphic, BrandbookKind, BrandbookSection, BrandbookSectionType, brandbookLabel, brandbookThemes, createBrandbookDraft, defaultSectionTypes, sectionDefaults } from "./brandbook-data";
import { loadBrandbooks, saveBrandbooks } from "./creation-storage";
import styles from "./Brandbooks.module.css";

type Notice = { tone: "success" | "error" | "info"; text: string };
type View = "library" | "wizard" | "editor";
type PlanResponse = { title?: string; subtitle?: string; sections?: { type: BrandbookSectionType; title: string; summary: string }[]; warnings?: { message: string }[] };

const STORAGE_KEY = "pixel-brandbooks-v1";
const maxFileBytes = 12 * 1024 * 1024;
const allowedAssetTypes = new Set(["image/svg+xml", "image/png", "image/jpeg", "image/webp"]);
const graphicTypes: BrandbookGraphic["type"][] = ["pattern", "graphic", "icon", "illustration", "photograph", "mockup", "other"];

function fileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler este arquivo."));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(file);
  });
}

function documentPreview(draft: BrandbookDraft) {
  return draft.primaryLogo?.source;
}

export function Brandbooks({ onNotice }: { onNotice: (notice: Notice) => void }) {
  const [view, setView] = useState<View>("library");
  const [documents, setDocuments] = useState<BrandbookDraft[]>([]);
  const [draft, setDraft] = useState<BrandbookDraft | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const saveQueue = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    void loadBrandbooks().then((stored) => {
      if (!active) return;
      if (stored.length) {
        setDocuments(stored);
        return;
      }
      try {
        const legacy = window.localStorage.getItem(STORAGE_KEY);
        if (legacy) setDocuments(JSON.parse(legacy) as BrandbookDraft[]);
      } catch {
        onNotice({ tone: "info", text: "Os brandbooks antigos deste navegador não puderam ser restaurados." });
      }
    }).catch(() => {
      if (active) onNotice({ tone: "error", text: "O armazenamento local de brandbooks não está disponível neste navegador." });
    }).finally(() => {
      if (active) setStorageReady(true);
    });
    return () => { active = false; };
  }, [onNotice]);

  useEffect(() => {
    if (!storageReady) return;
    saveQueue.current = saveQueue.current.catch(() => undefined).then(() => saveBrandbooks(documents)).catch(() => {
      onNotice({ tone: "error", text: "Não foi possível salvar os rascunhos de brandbook neste navegador." });
    });
  }, [documents, onNotice, storageReady]);

  const activeSection = draft?.sections.find((section) => section.id === activeSectionId) ?? draft?.sections[0] ?? null;
  const activeTheme = draft ? brandbookThemes.find((theme) => theme.id === draft.theme) ?? brandbookThemes[0] : null;
  const missingLogo = Boolean(draft && !draft.primaryLogo?.source);
  const selectedSectionTypes = new Set(draft?.sections.map((section) => section.type) ?? []);

  const updateDraft = (recipe: (current: BrandbookDraft) => BrandbookDraft) => setDraft((current) => current ? { ...recipe(current), updatedAt: new Date().toISOString() } : current);
  const start = (kind: BrandbookKind) => { const next = createBrandbookDraft(kind); setDraft(next); setStep(1); setActiveSectionId(next.sections[0]?.id ?? null); setView("wizard"); };
  const closeDraft = () => { setDraft(null); setView("library"); };
  const openDocument = (document: BrandbookDraft) => { setDraft(document); setActiveSectionId(document.sections[0]?.id ?? null); setView("editor"); };
  const saveDraft = (next: BrandbookDraft, message?: string) => {
    setDocuments((items) => {
      const found = items.some((item) => item.id === next.id);
      return found ? items.map((item) => item.id === next.id ? next : item) : [next, ...items];
    });
    setDraft(next);
    if (message) onNotice({ tone: "success", text: message });
  };

  useEffect(() => {
    if (!storageReady || !draft) return;
    setDocuments((items) => {
      const existing = items.find((item) => item.id === draft.id);
      if (existing === draft) return items;
      return existing ? items.map((item) => item.id === draft.id ? draft : item) : [draft, ...items];
    });
  }, [draft, storageReady]);

  const handleAsset = async (event: ChangeEvent<HTMLInputElement>, kind: "primary" | "alternate" | "graphic", id?: string) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !draft) return;
    if (!allowedAssetTypes.has(file.type) || file.size > maxFileBytes) { onNotice({ tone: "error", text: "Use SVG, PNG, JPG ou WebP de até 12 MB." }); return; }
    try {
      const source = await fileAsDataUrl(file);
      updateDraft((current) => {
        if (kind === "primary") return { ...current, primaryLogo: { id: current.primaryLogo?.id ?? crypto.randomUUID(), role: "primary_logo", label: "Logo principal", fileName: file.name, source, recommendedBackground: "both" } };
        if (kind === "alternate") return { ...current, alternateLogos: current.alternateLogos.map((asset) => asset.id === id ? { ...asset, source, fileName: file.name } : asset) };
        return { ...current, graphics: current.graphics.map((asset) => asset.id === id ? { ...asset, source, fileName: file.name } : asset) };
      });
      onNotice({ tone: "success", text: "Ativo adicionado à biblioteca local do brandbook." });
    } catch (error) { onNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível adicionar o ativo." }); }
  };

  const generatePlan = async () => {
    if (!draft) return;
    if (!draft.name.trim()) { setStep(1); onNotice({ tone: "error", text: "Informe o nome da marca antes de gerar." }); return; }
    if (!draft.primaryLogo?.source) { setStep(2); onNotice({ tone: "error", text: "Adicione o logo principal antes de gerar ou publicar." }); return; }
    setGenerating(true);
    const selectedTypes = draft.sections.filter((section) => section.visible).map((section) => section.type);
    try {
      const response = await fetch("/api/brandbook/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: draft.kind, name: draft.name, description: draft.description, purpose: draft.purpose, audience: draft.audience, tone: draft.tone, theme: draft.theme, sections: selectedTypes, colors: draft.colors.map((color) => ({ name: color.name, role: color.role })) }) });
      const data = await response.json() as PlanResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "A geração assistida não está disponível.");
      const sections = draft.sections.map((section) => {
        const generated = data.sections?.find((item) => item.type === section.type);
        return generated ? { ...section, title: generated.title, summary: generated.summary } : section;
      });
      const next = { ...draft, status: "ready" as const, sections, updatedAt: new Date().toISOString() };
      saveDraft(next, "Rascunho estruturado gerado pela IA. Revise cada seção antes de publicar.");
      setActiveSectionId(next.sections[0]?.id ?? null); setView("editor");
    } catch (error) {
      const next = { ...draft, status: "ready" as const, updatedAt: new Date().toISOString() };
      saveDraft(next);
      setActiveSectionId(next.sections[0]?.id ?? null); setView("editor");
      onNotice({ tone: "info", text: `${error instanceof Error ? error.message : "A IA não está disponível."} Um rascunho estruturado foi criado para revisão.` });
    } finally { setGenerating(false); }
  };

  const downloadJson = () => {
    if (!draft) return;
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = href; link.download = `${draft.name.toLowerCase().replace(/[^a-z0-9]+/gi, "-") || "brandbook"}.json`; link.click(); URL.revokeObjectURL(href);
  };

  const draftTitle = draft?.name || "Nova identidade";
  const completed = [Boolean(draft?.name), Boolean(draft?.primaryLogo?.source), Boolean(draft?.colors.length), Boolean(draft?.theme), Boolean(draft?.sections.length), Boolean(draft?.status === "ready")];

  if (!storageReady) return <section className={styles.page}><div className={styles.empty}><FileText size={22}/><p>Restaurando seus rascunhos locais…</p></div></section>;

  if (view === "library") return <section className={styles.page}>
    <header className={styles.head}><div><p className="eyebrow">Identidade visual</p><h1>Brandbooks</h1><p>Construa um manual vivo ou uma apresentação curta a partir da mesma base de marca.</p></div></header>
    <div className={styles.startGrid}>
      <article className={styles.startCard}><span className={styles.startIcon}><BookOpen size={20}/></span><div><p className={styles.kicker}>Manual vivo</p><h2>Brandbook com IA</h2><p>Organize logos, tokens, tipografia e ativos em capítulos prontos para revisão.</p></div><button className="button vermilion" onClick={() => start("brandbook")}><Sparkles size={16}/> Criar brandbook</button></article>
      <article className={styles.startCard}><span className={styles.startIcon}><Layers3 size={20}/></span><div><p className={styles.kicker}>Para aprovação</p><h2>Apresentação de identidade</h2><p>Crie uma narrativa mais curta para apresentar a direção visual em poucos cliques.</p></div><button className="button ghost" onClick={() => start("identity_presentation")}><Plus size={16}/> Criar apresentação</button></article>
    </div>
    <section className={styles.library}><div className={styles.libraryHead}><h2>Seus rascunhos</h2><span>{documents.length} {documents.length === 1 ? "documento" : "documentos"}</span></div>{documents.length ? <div className={styles.documentGrid}>{documents.map((document) => <button className={styles.documentCard} onClick={() => openDocument(document)} key={document.id}><div className={`${styles.documentCover} ${styles[document.theme]}`}>{documentPreview(document) ? <img src={documentPreview(document)} alt=""/> : <span>{document.name.slice(0, 2).toUpperCase() || "PB"}</span>}<small>{brandbookLabel(document.kind)}</small></div><span><strong>{document.name || "Sem nome"}</strong><small>{document.status === "ready" ? "Pronto para revisão" : "Rascunho em andamento"}</small></span><ArrowRight size={16}/></button>)}</div> : <div className={styles.empty}><FileText size={22}/><p>Crie o primeiro documento de identidade para começar sua biblioteca.</p></div>}</section>
  </section>;

  if (!draft) return null;

  if (view === "wizard") return <section className={styles.page}>
    <header className={styles.wizardHead}><button className="button ghost" onClick={closeDraft}><ArrowLeft size={16}/> Brandbooks</button><span>Rascunho local</span></header>
    <div className={styles.wizardLayout}><aside className={styles.steps}>{[[1, "Base"], [2, "Logos"], [3, "Tokens"], [4, "Ativos"], [5, "Tema"], [6, "Revisar"]].map(([number, label]) => <button key={String(number)} className={step === number ? styles.activeStep : completed[Number(number) - 1] ? styles.doneStep : ""} onClick={() => completed.slice(0, Number(number) - 1).every(Boolean) && setStep(Number(number))}><span>{completed[Number(number) - 1] && step !== number ? <Check size={13}/> : number}</span>{label}</button>)}</aside>
      <main className={styles.stage}>
        {step === 1 && <><p className={styles.question}>Qual é a base desta identidade?</p><p className={styles.helper}>Nome e logo principal são obrigatórios para gerar ou publicar. Os demais detalhes podem evoluir depois.</p><div className={styles.fieldGrid}><label>Nome da marca<input value={draft.name} onChange={(event) => updateDraft((current) => ({ ...current, name: event.target.value }))} placeholder="Ex.: Estúdio Aurora" autoFocus/></label><label>Cliente / unidade<input value={draft.client} onChange={(event) => updateDraft((current) => ({ ...current, client: event.target.value }))} placeholder="Opcional"/></label><label>Segmento<input value={draft.industry} onChange={(event) => updateDraft((current) => ({ ...current, industry: event.target.value }))} placeholder="Ex.: Arquitetura"/></label><label>Idioma<input value={draft.language} onChange={(event) => updateDraft((current) => ({ ...current, language: event.target.value }))}/></label><label className={styles.wide}>Descrição breve<textarea value={draft.description} onChange={(event) => updateDraft((current) => ({ ...current, description: event.target.value }))} placeholder="O que a marca faz e como quer ser percebida?"/></label><label>Propósito<input value={draft.purpose} onChange={(event) => updateDraft((current) => ({ ...current, purpose: event.target.value }))} placeholder="Opcional"/></label><label>Público<input value={draft.audience} onChange={(event) => updateDraft((current) => ({ ...current, audience: event.target.value }))} placeholder="Opcional"/></label><label className={styles.wide}>Tom de voz<textarea value={draft.tone} onChange={(event) => updateDraft((current) => ({ ...current, tone: event.target.value }))} placeholder="Ex.: direto, próximo e preciso"/></label></div></>}
        {step === 2 && <><p className={styles.question}>Quais logos representam a marca?</p><p className={styles.helper}>O Pixel preserva os arquivos originais. Nesta fase, uploads ficam neste navegador; a fundação de mídia privada no Supabase será ativada após a migration compartilhada ser aplicada.</p><div className={styles.assetList}><AssetInput label="Logo principal" required asset={draft.primaryLogo} onChange={(event) => void handleAsset(event, "primary")} /><div className={styles.logoGrid}>{draft.alternateLogos.map((asset) => <AssetInput key={asset.id} label={asset.label} asset={asset} onChange={(event) => void handleAsset(event, "alternate", asset.id)} onRemove={asset.source ? () => updateDraft((current) => ({ ...current, alternateLogos: current.alternateLogos.map((item) => item.id === asset.id ? { ...item, source: undefined, fileName: undefined } : item) })) : undefined}/>)}</div><button className="button ghost" onClick={() => updateDraft((current) => ({ ...current, alternateLogos: [...current.alternateLogos, { id: crypto.randomUUID(), role: "alternate_logo", label: `Logo alternativo ${current.alternateLogos.length + 1}`, recommendedBackground: "both" }] }))}><Plus size={16}/> Adicionar logo alternativo</button></div></>}
        {step === 3 && <><p className={styles.question}>Como a marca se reconhece em cor e tipo?</p><p className={styles.helper}>Cores são tokens com papel definido: o documento as reutiliza sem copiar hexadecimais por seção.</p><section className={styles.tokenBlock}><div className={styles.blockHead}><h2>Paleta</h2><button className="button ghost" onClick={() => updateDraft((current) => ({ ...current, colors: [...current.colors, { id: crypto.randomUUID(), name: "Nova cor", hex: "#C9C7C1", role: "support" }] }))}><Plus size={16}/> Cor</button></div><div className={styles.colorList}>{draft.colors.map((color) => <ColorRow key={color.id} color={color} onChange={(next) => updateDraft((current) => ({ ...current, colors: current.colors.map((item) => item.id === color.id ? next : item) }))} onRemove={() => updateDraft((current) => ({ ...current, colors: current.colors.filter((item) => item.id !== color.id) }))}/>)}</div></section><section className={styles.typeGrid}><label>Fonte de destaque<input value={draft.fonts.display} onChange={(event) => updateDraft((current) => ({ ...current, fonts: { ...current.fonts, display: event.target.value } }))}/></label><label>Fonte de texto<input value={draft.fonts.body} onChange={(event) => updateDraft((current) => ({ ...current, fonts: { ...current.fonts, body: event.target.value } }))}/></label></section></>}
        {step === 4 && <><p className={styles.question}>Quais elementos completam o sistema?</p><p className={styles.helper}>Patterns, ícones, grafismos, fotos e mockups são opcionais e podem crescer sem limite de interface.</p><div className={styles.graphics}>{draft.graphics.map((asset) => <GraphicInput key={asset.id} asset={asset} onChange={(event) => void handleAsset(event, "graphic", asset.id)} onUpdate={(next) => updateDraft((current) => ({ ...current, graphics: current.graphics.map((item) => item.id === asset.id ? next : item) }))} onRemove={() => updateDraft((current) => ({ ...current, graphics: current.graphics.filter((item) => item.id !== asset.id) }))}/>)}</div><button className="button ghost" onClick={() => updateDraft((current) => ({ ...current, graphics: [...current.graphics, { id: crypto.randomUUID(), type: "graphic", label: "Novo elemento gráfico" }] }))}><ImagePlus size={16}/> Adicionar elemento gráfico</button></>}
        {step === 5 && <><p className={styles.question}>Qual linguagem visual conduz o documento?</p><p className={styles.helper}>O tema controla as composições permitidas; o conteúdo não transforma o brandbook em um canvas livre.</p><div className={styles.themeGrid}>{brandbookThemes.map((theme) => <button className={draft.theme === theme.id ? styles.selectedTheme : ""} key={theme.id} onClick={() => updateDraft((current) => ({ ...current, theme: theme.id, variant: theme.variants[0] }))}><span className={`${styles.themeMini} ${styles[theme.id]}`}><i/><i/><i/></span><strong>{theme.name}</strong><small>{theme.description}</small></button>)}</div><label className={styles.variantSelect}>Variação<select value={draft.variant} onChange={(event) => updateDraft((current) => ({ ...current, variant: event.target.value }))}>{activeTheme?.variants.map((variant) => <option key={variant}>{variant}</option>)}</select></label><section className={styles.chapterBlock}><div className={styles.blockHead}><h2>Capítulos</h2><small>Escolha o que a primeira versão precisa explicar.</small></div>{Object.entries({ cover: "Capa", overview: "Essência da marca", logo_system: "Sistema de logo", color_palette: "Cores", typography: "Tipografia", graphic_elements: "Elementos gráficos", applications: "Aplicações", closing: "Encerramento" } as Record<BrandbookSectionType, string>).map(([type, label]) => <label key={type} className={styles.checkRow}><input type="checkbox" checked={selectedSectionTypes.has(type as BrandbookSectionType)} disabled={type === "cover" || type === "closing"} onChange={(event) => updateDraft((current) => ({ ...current, sections: event.target.checked ? [...current.sections, sectionDefaults(type as BrandbookSectionType)] : current.sections.filter((section) => section.type !== type) }))}/><span>{label}</span></label>)}</section></>}
        {step === 6 && <><p className={styles.question}>Revise a base antes de gerar.</p><p className={styles.helper}>A IA propõe somente a estrutura e textos curtos; logos, cores e arquivos permanecem sob seu controle.</p><div className={styles.review}><div className={`${styles.coverPreview} ${styles[draft.theme]}`}>{draft.primaryLogo?.source ? <img src={draft.primaryLogo.source} alt={`Logo de ${draft.name}`}/> : <span>Logo principal</span>}<small>{brandbookLabel(draft.kind)} · {draft.variant}</small></div><dl><div><dt>Marca</dt><dd>{draft.name || "Não definida"}</dd></div><div><dt>Logos</dt><dd>{1 + draft.alternateLogos.filter((asset) => asset.source).length} ativos</dd></div><div><dt>Paleta</dt><dd>{draft.colors.length} tokens</dd></div><div><dt>Capítulos</dt><dd>{draft.sections.length} selecionados</dd></div></dl>{missingLogo && <p className={styles.warning}><CircleAlert size={16}/> O logo principal é obrigatório antes de gerar.</p>}</div></>}
        <footer className={styles.stageActions}>{step > 1 ? <button className="button ghost" onClick={() => setStep((value) => value - 1)}><ArrowLeft size={16}/> Voltar</button> : <span/>}{step < 6 ? <button className="button vermilion" onClick={() => { if (step === 1 && !draft.name.trim()) { onNotice({ tone: "error", text: "Informe o nome da marca para continuar." }); return; } setStep((value) => value + 1); }}>Continuar <ArrowRight size={16}/></button> : <button className="button vermilion" onClick={() => void generatePlan()} disabled={generating}>{generating ? "Estruturando…" : <><Sparkles size={16}/> Gerar rascunho</>}</button>}</footer>
      </main>
    </div>
  </section>;

  return <section className={styles.page}>
    <header className={styles.editorHead}><button className="button ghost" onClick={closeDraft}><ArrowLeft size={16}/> Brandbooks</button><span className={styles.breadcrumb}>{draftTitle} <i/> {brandbookLabel(draft.kind)}</span><div><span className={styles.saved}><Check size={14}/> Salvo neste dispositivo</span><button className="button ghost" onClick={downloadJson}><Download size={16}/> Baixar dados</button></div></header>
    <div className={styles.editorLayout}><aside className={styles.outline}><p>Índice</p>{draft.sections.map((section) => <button className={activeSection?.id === section.id ? styles.activeSection : ""} onClick={() => setActiveSectionId(section.id)} key={section.id}>{section.title}</button>)}<button className={styles.outlineAdd} onClick={() => updateDraft((current) => ({ ...current, sections: [...current.sections, sectionDefaults("overview")] }))}><Plus size={15}/> Seção</button></aside>
      <main className={`${styles.preview} ${styles[draft.theme]}`}>{activeSection && <SectionPreview section={activeSection} draft={draft}/>}</main>
      <aside className={styles.properties}><div className={styles.propertyHead}><p>Propriedades</p><span>{activeSection?.layoutKey}</span></div>{activeSection && <><label>Título<input value={activeSection.title} onChange={(event) => updateDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === activeSection.id ? { ...section, title: event.target.value } : section) }))}/></label><label>Texto<textarea value={activeSection.summary} onChange={(event) => updateDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === activeSection.id ? { ...section, summary: event.target.value } : section) }))}/></label><label className={styles.checkRow}><input type="checkbox" checked={activeSection.visible} onChange={(event) => updateDraft((current) => ({ ...current, sections: current.sections.map((section) => section.id === activeSection.id ? { ...section, visible: event.target.checked } : section) }))}/><span>Exibir seção</span></label><button className="button ghost" onClick={() => updateDraft((current) => ({ ...current, sections: current.sections.filter((section) => section.id !== activeSection.id) }))}><Trash2 size={16}/> Excluir seção</button></>}<hr/><label>Tema<select value={draft.theme} onChange={(event) => updateDraft((current) => ({ ...current, theme: event.target.value as BrandbookDraft["theme"], variant: brandbookThemes.find((theme) => theme.id === event.target.value)?.variants[0] ?? current.variant }))}>{brandbookThemes.map((theme) => <option value={theme.id} key={theme.id}>{theme.name}</option>)}</select></label><p className={styles.editorNote}>Este rascunho fica salvo neste dispositivo. A sincronização com o workspace e a publicação por link entram na próxima etapa.</p></aside>
    </div>
  </section>;
}

function AssetInput({ label, asset, required, onChange, onRemove }: { label: string; asset?: BrandbookAsset; required?: boolean; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onRemove?: () => void }) {
  const id = `asset-${asset?.id ?? "primary"}`;
  return <div className={styles.assetInput}>{asset?.source ? <div className={styles.assetPreview}><img src={asset.source} alt={label}/><span>{asset.fileName || label}</span>{onRemove && <button type="button" onClick={onRemove} aria-label={`Remover ${label}`}><X size={14}/></button>}</div> : <label htmlFor={id}><Upload size={18}/><strong>{label}{required ? " *" : ""}</strong><small>SVG, PNG, JPG ou WebP</small><input id={id} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" onChange={onChange}/></label>}</div>;
}

function ColorRow({ color, onChange, onRemove }: { color: BrandbookColor; onChange: (color: BrandbookColor) => void; onRemove: () => void }) {
  return <div className={styles.colorRow}><input aria-label={`Cor ${color.name}`} type="color" value={color.hex} onChange={(event) => onChange({ ...color, hex: event.target.value.toUpperCase() })}/><input aria-label="Nome da cor" value={color.name} onChange={(event) => onChange({ ...color, name: event.target.value })}/><input aria-label="Valor hexadecimal" value={color.hex} onChange={(event) => onChange({ ...color, hex: event.target.value })}/><select aria-label="Papel da cor" value={color.role} onChange={(event) => onChange({ ...color, role: event.target.value as BrandbookColor["role"] })}>{[["primary", "Primária"], ["secondary", "Secundária"], ["accent", "Acento"], ["neutral_light", "Neutra clara"], ["neutral_dark", "Neutra escura"], ["support", "Suporte"]].map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button type="button" aria-label={`Remover ${color.name}`} onClick={onRemove}><Trash2 size={15}/></button></div>;
}

function GraphicInput({ asset, onChange, onUpdate, onRemove }: { asset: BrandbookGraphic; onChange: (event: ChangeEvent<HTMLInputElement>) => void; onUpdate: (asset: BrandbookGraphic) => void; onRemove: () => void }) {
  const id = `graphic-${asset.id}`;
  return <div className={styles.graphicInput}>{asset.source ? <div className={styles.graphicPreview}><img src={asset.source} alt=""/><span>{asset.fileName || asset.label}</span></div> : <label htmlFor={id}><ImagePlus size={18}/><span>Adicionar arquivo</span><input id={id} type="file" accept="image/svg+xml,image/png,image/jpeg,image/webp" onChange={onChange}/></label>}<div><input value={asset.label} onChange={(event) => onUpdate({ ...asset, label: event.target.value })} aria-label="Nome do elemento"/><select value={asset.type} onChange={(event) => onUpdate({ ...asset, type: event.target.value as BrandbookGraphic["type"] })}>{graphicTypes.map((type) => <option key={type}>{type}</option>)}</select></div><button type="button" onClick={onRemove} aria-label={`Remover ${asset.label}`}><Trash2 size={15}/></button></div>;
}

function SectionPreview({ section, draft }: { section: BrandbookSection; draft: BrandbookDraft }) {
  const logos = [draft.primaryLogo, ...draft.alternateLogos].filter((asset): asset is BrandbookAsset => Boolean(asset?.source));
  if (section.type === "cover") return <article className={styles.coverSection}>{draft.primaryLogo?.source ? <img src={draft.primaryLogo.source} alt={`Logo de ${draft.name}`}/> : <span>Logo principal</span>}<div><p>Guia de identidade visual</p><h2>{draft.name || "Nova identidade"}</h2><small>{section.summary}</small></div></article>;
  if (section.type === "logo_system") return <article className={styles.contentSection}><header><p>02 · Identidade</p><h2>{section.title}</h2></header><p>{section.summary}</p><div className={styles.logoWall}>{logos.length ? logos.map((asset) => <div key={asset.id}><img src={asset.source} alt={asset.label}/><small>{asset.label}</small></div>) : <span>Adicione variações de logo no assistente.</span>}</div></article>;
  if (section.type === "color_palette") return <article className={styles.contentSection}><header><p>03 · Tokens</p><h2>{section.title}</h2></header><p>{section.summary}</p><div className={styles.swatches}>{draft.colors.map((color) => <div style={{ background: color.hex, color: color.role === "neutral_dark" ? "#fff" : "#121212" }} key={color.id}><strong>{color.name}</strong><small>{color.hex}</small></div>)}</div></article>;
  if (section.type === "typography") return <article className={styles.typeSection}><p>04 · Tipografia</p><h2 style={{ fontFamily: draft.fonts.display }}>{draft.fonts.display || "Fonte de destaque"}</h2><span>{section.summary}</span><div><strong style={{ fontFamily: draft.fonts.body }}>Aa</strong><p style={{ fontFamily: draft.fonts.body }}>{draft.fonts.body || "Fonte de texto"} · leitura com ritmo e contraste.</p></div></article>;
  if (section.type === "graphic_elements" || section.type === "applications") return <article className={styles.contentSection}><header><p>05 · Biblioteca visual</p><h2>{section.title}</h2></header><p>{section.summary}</p><div className={styles.gallery}>{draft.graphics.filter((asset) => asset.source).length ? draft.graphics.filter((asset) => asset.source).map((asset) => <img src={asset.source} alt={asset.label} key={asset.id}/>) : <span>Adicione elementos gráficos, fotos ou mockups para compor esta seção.</span>}</div></article>;
  return <article className={styles.statementSection}><p>{section.type === "closing" ? "Próximos passos" : "Estratégia"}</p><h2>{section.title}</h2><span>{section.summary || draft.description || "Inclua uma mensagem curta para orientar esta seção."}</span><div>{draft.tone && <small>Tom de voz: {draft.tone}</small>}{draft.audience && <small>Público: {draft.audience}</small>}</div></article>;
}
