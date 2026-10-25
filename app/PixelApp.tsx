"use client";
/* eslint-disable @next/next/no-img-element, jsx-a11y/label-has-associated-control, react-hooks/static-components -- Official SVG assets must remain direct files; this is a stateful product shell with local view fragments. */

import { ChangeEvent, ReactNode, createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "next-themes";
import { ArrowLeft, ArrowRight, BookOpen, Check, ChevronDown, CircleHelp, Copy, Download, Grid2X2, House, Image, Layers3, LayoutPanelTop, Menu, Moon, Palette, Pencil, Plus, Settings2, Sparkles, Sun, Trash2, X, type LucideIcon } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import type { ActiveAuthMember } from "@/lib/auth/types";
import { BrandProfile, Content, Creation, editorialCoverVariants, emptyContent, formats, FormatId, seedBrands, templatePreviewCreation, templates } from "./pixel-data";
import { CardRenderer } from "./CardRenderer";
import { downloadCard, downloadCardsZip, ExportFormat, renderCardBlob, renderCardsZip, safeName } from "./card-export";
import { composePages, inspectRenderedCard, validateContent } from "./pixel-engine";
import { prepareImageForCard } from "./image-processing";
import { loadCreations, saveCreations } from "./creation-storage";
import { Brandbooks } from "./Brandbooks";

type Screen = "home" | "creations" | "templates" | "brands" | "brandbooks" | "settings" | "generate" | "result";
type Retention = "15" | "30" | "90" | "custom";
type Notice = { tone: "success" | "error" | "info"; text: string } | null;
type GoogleDriveState = { loading: boolean; configured: boolean; connected: boolean };
type DriveUploadState = { phase: string; percent: number } | null;

type ShellContextValue = {
  member: ActiveAuthMember;
  theme: "light" | "dark";
  screen: Screen;
  retentionLabel: string;
  mobileNavOpen: boolean;
  notice: Notice;
  navigate: (next: Screen) => void;
  newGeneration: () => void;
  toggleTheme: () => void;
  openMobileNav: () => void;
  closeMobileNav: () => void;
};

const STORAGE_KEY = "pixel-workspace-v1";
const navigationItems: { id: Exclude<Screen, "generate" | "result">; label: string; icon: string }[] = [
  { id: "home", label: "Início", icon: "home" }, { id: "creations", label: "Criações", icon: "grid" }, { id: "templates", label: "Templates", icon: "layers" }, { id: "brands", label: "Marcas", icon: "mark" }, { id: "brandbooks", label: "Brandbooks", icon: "book" }, { id: "settings", label: "Configurações", icon: "gear" },
];
const ShellContext = createContext<ShellContextValue | null>(null);

const icons: Record<string, LucideIcon> = { home: House, grid: Grid2X2, layers: Layers3, mark: Palette, book: BookOpen, gear: Settings2, plus: Plus, arrow: ArrowRight, back: ArrowLeft, sun: Sun, moon: Moon, download: Download, spark: Sparkles, trash: Trash2, edit: Pencil, copy: Copy, check: Check, image: Image, close: X, chevron: ChevronDown, menu: Menu, help: CircleHelp, panel: LayoutPanelTop };
const Icon = ({ name, size = 18 }: { name: string; size?: number }) => {
  const Component = icons[name] ?? CircleHelp;
  return <Component className="icon" size={size} strokeWidth={1.75} aria-hidden="true" />;
};

const now = () => new Date().toISOString();
const shortDate = (value: string) => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(value));
const expiry = (retention: Retention, customDays: number) => {
  const days = retention === "custom" ? customDays : Number(retention);
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString();
};
const dimensionsFor = (format: FormatId, custom: { width: number; height: number }) => {
  if (format === "custom") return custom;
  const preset = formats.find((item) => item.id === format)!;
  return { width: preset.width, height: preset.height };
};

function BrandAvatar({ brand, large = false }: { brand: BrandProfile; large?: boolean }) {
  return <span className={`brand-avatar ${large ? "large" : ""}`} style={{ background: brand.colors[0], color: brand.colors[1] }}>{brand.initials}</span>;
}

function AccountMenu({ member, compact = false }: { member: ActiveAuthMember; compact?: boolean }) {
  const initial = member.name.trim().charAt(0).toUpperCase() || "P";
  if (compact) return <form action={logoutAction}><button className="mobile-logout" type="submit" aria-label="Sair da conta">Sair</button></form>;
  return <details className="account-menu"><summary><span className="account-avatar" aria-hidden="true">{initial}</span><span className="account-summary"><strong>{member.name}</strong><small>{member.workspaceName}</small></span><Icon name="chevron" size={15}/></summary><div className="account-dropdown"><p><strong>{member.name}</strong><span>{member.email}</span></p><span className="account-workspace">Organização: {member.workspaceName}</span><form action={logoutAction}><button className="account-logout" type="submit">Sair</button></form></div></details>;
}

function Shell({ children }: { children: ReactNode }) {
  const context = useContext(ShellContext);
  if (!context) throw new Error("A estrutura de navegação do Pixel não foi inicializada.");
  const { member, theme, screen, retentionLabel, mobileNavOpen, notice, navigate, newGeneration, toggleTheme, openMobileNav, closeMobileNav } = context;
  return <main className="app-shell">
    <aside className="sidebar">
      <button className="brand-lockup" onClick={() => navigate("home")} aria-label="Ir para início"><img src={`/brand/pixel/signature/lockup-wide-${theme === "dark" ? "light" : "ink"}.svg`} alt="Pixel, um produto Prime Creative" /></button>
      <button className="generate-nav" onClick={newGeneration}><Icon name="plus"/> Gerar</button>
      <nav>{navigationItems.map((item) => <button key={item.id} className={screen === item.id ? "nav-active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
      <div className="sidebar-bottom"><p>Criações ficam disponíveis por {retentionLabel}.</p></div>
    </aside>
    <section className="main-panel">
      <header className="desktop-top"><div><strong>Pixel</strong><small>{member.workspaceName}</small></div><div className="desktop-actions"><button className="icon-button" aria-label="Alternar tema" onClick={toggleTheme}><Icon name={theme === "light" ? "moon" : "sun"}/></button><AccountMenu member={member}/></div></header>
      <header className="mobile-top"><button className="brand-lockup" onClick={() => navigate("home")}><img src={`/brand/pixel/wordmark/wordmark-${theme === "dark" ? "light" : "ink"}.svg`} alt="Pixel" /></button><div className="mobile-actions"><button className="icon-button" aria-label="Abrir navegação" aria-expanded={mobileNavOpen} onClick={openMobileNav}><Icon name="menu"/></button><button className="icon-button" aria-label="Alternar tema" onClick={toggleTheme}><Icon name={theme === "light" ? "moon" : "sun"}/></button><AccountMenu member={member} compact/></div></header>
      {children}
    </section>
    <nav className="mobile-bottom-nav" aria-label="Navegação principal">{navigationItems.map((item) => <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav>
    {mobileNavOpen && <div className="mobile-nav-layer"><button className="mobile-nav-scrim" aria-label="Fechar navegação" onClick={closeMobileNav}/><aside className="mobile-nav-sheet" aria-label="Navegação do Pixel"><div className="mobile-nav-head"><img src={`/brand/pixel/wordmark/wordmark-${theme === "dark" ? "light" : "ink"}.svg`} alt="Pixel"/><button className="icon-button" aria-label="Fechar navegação" onClick={closeMobileNav}><Icon name="close"/></button></div><button className="generate-nav" onClick={newGeneration}><Icon name="plus"/> Gerar</button><nav>{navigationItems.map((item) => <button key={item.id} className={screen === item.id ? "nav-active" : ""} onClick={() => navigate(item.id)}><Icon name={item.icon}/><span>{item.label}</span></button>)}</nav><p>Criações ficam disponíveis por {retentionLabel}.</p></aside></div>}
    {notice && <div className={`toast ${notice.tone}`}><Icon name={notice.tone === "success" ? "check" : "spark"}/>{notice.text}</div>}
  </main>;
}

export function PixelApp({ member }: { member: ActiveAuthMember }) {
  const [screen, setScreen] = useState<Screen>("home");
  const { resolvedTheme, setTheme } = useTheme();
  const [themeReady, setThemeReady] = useState(false);
  const theme = themeReady && resolvedTheme === "dark" ? "dark" : "light";
  const [retention, setRetention] = useState<Retention>("30");
  const [hydrated, setHydrated] = useState(false);
  const [customDays, setCustomDays] = useState(45);
  const [brands, setBrands] = useState<BrandProfile[]>(seedBrands);
  const [creations, setCreations] = useState<Creation[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<string | null>(seedBrands[0].id);
  const [format, setFormat] = useState<FormatId>("portrait");
  const [customSize, setCustomSize] = useState({ width: 1200, height: 1200 });
  const [templateId, setTemplateId] = useState("minimal-editorial");
  const [content, setContent] = useState<Content>(emptyContent);
  const [suggestedPages, setSuggestedPages] = useState<Content[] | null>(null);
  const [selectedCreation, setSelectedCreation] = useState<string | null>(null);
  const [resultPage, setResultPage] = useState(0);
  const [generating, setGenerating] = useState(false);
  const [preparingImage, setPreparingImage] = useState(false);
  const [step, setStep] = useState(1);
  const [notice, setNotice] = useState<Notice>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | "bulk" | null>(null);
  const [variationOpen, setVariationOpen] = useState(false);
  const [variation, setVariation] = useState("layout");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [googleDrive, setGoogleDrive] = useState<GoogleDriveState>({ loading: true, configured: false, connected: false });
  const [driveUpload, setDriveUpload] = useState<DriveUploadState>(null);
  const [disconnectingDrive, setDisconnectingDrive] = useState(false);
  const exportNodes = useRef<(HTMLElement | null)[]>([]);
  const showNotice = useCallback((next: Exclude<Notice, null>) => setNotice(next), []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setThemeReady(true));
    const hydrate = async () => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { retention?: Retention; customDays?: number; brands?: BrandProfile[] };
          setRetention(parsed.retention ?? "30"); setCustomDays(parsed.customDays ?? 45);
          setBrands(parsed.brands?.length ? parsed.brands : seedBrands);
        } catch { window.localStorage.removeItem(STORAGE_KEY); }
      }
      try {
        const stored = (await loadCreations()).filter((item) => new Date(item.expiresAt) > new Date());
        setCreations(stored);
      } catch {
        setCreations([]);
        setNotice({ tone: "info", text: "As criações desta sessão não poderão ser mantidas após recarregar." });
      } finally { setHydrated(true); }
    }
    void hydrate();
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ retention, customDays, brands }));
    void saveCreations(creations).catch(() => setNotice({ tone: "error", text: "Não foi possível guardar esta criação neste navegador." }));
  }, [hydrated, retention, customDays, brands, creations]);

  useEffect(() => { if (notice) { const timeout = window.setTimeout(() => setNotice(null), 4200); return () => window.clearTimeout(timeout); } }, [notice]);

  useEffect(() => {
    let active = true;
    const result = new URLSearchParams(window.location.search).get("drive");
    let resultNotice: Notice = null;
    if (result) {
      window.history.replaceState({}, "", window.location.pathname);
      const messages: Record<string, Notice> = {
        connected: { tone: "success", text: "Google Drive conectado. A pasta Prime Creative/Pixel/Exportações está pronta para receber exportações." },
        denied: { tone: "info", text: "A conexão com o Google Drive foi cancelada." },
        configuration: { tone: "error", text: "A integração com Google Drive ainda não foi configurada." },
        "invalid-state": { tone: "error", text: "Não foi possível validar a conexão com o Google Drive. Tente novamente." },
        unauthenticated: { tone: "error", text: "Sua sessão expirou antes de concluir a conexão com o Google Drive." },
        error: { tone: "error", text: "Não foi possível concluir a conexão com o Google Drive." },
      };
      resultNotice = messages[result] ?? null;
    }
    void fetch("/api/integrations/google-drive/status")
      .then(async (response) => response.ok ? await response.json() as { configured: boolean; connected: boolean } : { configured: false, connected: false })
      .then((state) => { if (active) { setGoogleDrive({ loading: false, configured: state.configured, connected: state.connected }); if (resultNotice) setNotice(resultNotice); } })
      .catch(() => { if (active) setGoogleDrive({ loading: false, configured: false, connected: false }); });
    return () => { active = false; };
  }, []);

  const activeCreation = creations.find((item) => item.id === selectedCreation) ?? null;
  const activeBrand = brands.find((item) => item.id === (activeCreation?.brandId ?? selectedBrand ?? ""));
  const compatibleTemplates = useMemo(() => templates.filter((item) => format === "custom" || item.formats.includes(format)), [format]);
  const currentTemplate = templates.find((item) => item.id === templateId) ?? templates[0];

  const navigate = (next: Screen) => { setScreen(next); setSelectedIds([]); setMobileNavOpen(false); if (next === "generate") setStep(1); };
  const newGeneration = (brandId?: string | null | unknown) => { const chosenBrand = typeof brandId === "string" || brandId === null ? brandId : (brands[0]?.id ?? null); setSelectedBrand(chosenBrand); setFormat("portrait"); setTemplateId("minimal-editorial"); setContent({ ...emptyContent, coverVariant: "editorial" }); setSuggestedPages(null); setStep(1); setMobileNavOpen(false); setScreen("generate"); };
  const patchContent = (key: keyof Content, value: string) => { setSuggestedPages(null); setContent((old) => ({ ...old, [key]: value })); };
  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const image = event.target.files?.[0];
    if (!image) return;
    setPreparingImage(true);
    try {
      const prepared = await prepareImageForCard(image);
      setSuggestedPages(null);
      setContent((old) => ({ ...old, imageName: prepared.name, imageData: prepared.dataUrl, imagePosition: "50% 50%" }));
      setNotice({ tone: "success", text: "Imagem preparada para recorte e exportação nítidos." });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível preparar esta imagem." });
    } finally { setPreparingImage(false); event.target.value = ""; }
  };

  const generate = async () => {
    const validation = validateContent(content, currentTemplate);
    if (!content.title.trim()) { setNotice({ tone: "error", text: validation[0]?.message ?? "Inclua um título antes de gerar." }); return; }
    if (preparingImage) { setNotice({ tone: "info", text: "Aguarde o preparo da imagem terminar." }); return; }
    setGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 1100));
    const pages = composePages(content, currentTemplate, suggestedPages ?? undefined);
    const creation: Creation = { id: crypto.randomUUID(), name: content.title, brandId: selectedBrand, templateId, format, dimensions: dimensionsFor(format, customSize), content, pages, createdAt: now(), expiresAt: expiry(retention, customDays) };
    setCreations((items) => [creation, ...items]); setSelectedCreation(creation.id); setResultPage(0); setGenerating(false); setScreen("result");
    const softWarning = validation.find((item) => item.code === "content-overflow");
    if (softWarning) setNotice({ tone: "info", text: softWarning.message });
  };

  const interpretBrief = async () => {
    if (content.brief.trim().length < 8) { setNotice({ tone: "error", text: "Descreva a comunicação com pelo menos 8 caracteres." }); return; }
    setGenerating(true);
    try {
      const response = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: content.brief, audience: activeBrand?.voice, slideCount: currentTemplate.pages === "multiple" ? currentTemplate.pageBlueprint.length : 1, template: currentTemplate.name }) });
      const data = await response.json() as { slides?: { kicker: string; title: string; text: string; cta?: string }[]; error?: string };
      if (!response.ok || !data.slides?.length) throw new Error(data.error || "Não foi possível interpretar o briefing.");
      const pages = data.slides.map((slide, index) => ({ ...content, title: slide.title, subtitle: slide.kicker, body: slide.text, cta: slide.cta ?? (index === data.slides!.length - 1 ? content.cta : "Continue") }));
      setSuggestedPages(pages);
      setContent((old) => ({ ...old, ...pages[0] }));
      setNotice({ tone: "success", text: "O Pixel preencheu uma primeira versão. Revise antes de gerar." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "A interpretação não está disponível." }); }
    finally { setGenerating(false); }
  };

  const updateCreation = () => {
    if (!activeCreation) return;
    const template = templates.find((item) => item.id === activeCreation.templateId) ?? currentTemplate;
    const pages = template.family && template.family !== "legacy"
      ? composePages(content, template)
      : activeCreation.pages.map((item, index) => index === 0 ? content : item);
    setCreations((items) => items.map((item) => item.id === activeCreation.id ? { ...item, name: content.title, content, pages } : item));
    setEditing(false); setNotice({ tone: "success", text: "Card atualizado pelo template selecionado." });
  };

  const duplicate = (creation: Creation, asVariation = false) => {
    const copy: Creation = { ...creation, id: crypto.randomUUID(), name: `${creation.name}${asVariation ? " · variação" : " · cópia"}`, createdAt: now(), expiresAt: expiry(retention, customDays), parentId: asVariation ? creation.id : creation.parentId, pages: creation.pages.map((page) => ({ ...page })) };
    if (asVariation && variation === "text") copy.content = { ...copy.content, title: `${copy.content.title} — uma nova leitura` };
    if (asVariation && variation === "layout") {
      const nextTemplate = templates.find((item) => item.id === (copy.templateId === "minimal-editorial" ? "hook" : "minimal-editorial")) ?? templates[0];
      copy.templateId = nextTemplate.id;
      copy.pages = composePages(copy.content, nextTemplate);
    }
    setCreations((items) => [copy, ...items]); setSelectedCreation(copy.id); setResultPage(0); setVariationOpen(false); setScreen("result");
    setNotice({ tone: "success", text: asVariation ? "Variação criada e vinculada à criação original." : "Criação duplicada." });
  };

  const removeCreations = () => {
    const ids = confirmDelete === "bulk" ? selectedIds : [confirmDelete!];
    setCreations((items) => items.filter((item) => !ids.includes(item.id))); setSelectedIds([]); setConfirmDelete(null);
    if (activeCreation && ids.includes(activeCreation.id)) setScreen("creations");
    setNotice({ tone: "success", text: ids.length > 1 ? "Criações excluídas definitivamente." : "Criação excluída definitivamente." });
  };

  const download = async () => {
    if (!activeCreation) return;
    const node = document.querySelector<HTMLElement>(".result-stage [data-pixel-card='true']");
    if (!node) { setNotice({ tone: "error", text: "Não foi possível preparar a página para exportação." }); return; }
    const issues = inspectRenderedCard(node);
    if (issues.length) { setNotice({ tone: "error", text: issues[0].message }); return; }
    try {
      await downloadCard(node, `${activeCreation.name}-${resultPage + 1}`, exportFormat);
      setNotice({ tone: "success", text: `Página baixada em ${exportFormat.toUpperCase()} a partir do preview final.` });
    } catch { setNotice({ tone: "error", text: "A exportação não foi concluída. Tente novamente." }); }
  };

  const downloadAll = async () => {
    if (!activeCreation || activeCreation.pages.length < 2) return;
    const nodes = exportNodes.current.filter((node): node is HTMLElement => node !== null);
    if (nodes.length !== activeCreation.pages.length) { setNotice({ tone: "error", text: "Ainda estamos preparando as páginas para o ZIP. Tente novamente em instantes." }); return; }
    const issues = nodes.flatMap((node) => inspectRenderedCard(node));
    if (issues.length) { setNotice({ tone: "error", text: issues[0].message }); return; }
    try {
      await downloadCardsZip(nodes, activeCreation.name, exportFormat);
      setNotice({ tone: "success", text: `${activeCreation.pages.length} páginas reunidas em um ZIP ${exportFormat.toUpperCase()}.` });
    } catch { setNotice({ tone: "error", text: "Não foi possível criar o ZIP. Tente novamente." }); }
  };

  const sendExportsToDrive = (files: File[]) => new Promise<string[]>((resolve, reject) => {
    const data = new FormData();
    files.forEach((file) => data.append("files", file));
    const request = new XMLHttpRequest();
    request.open("POST", "/api/integrations/google-drive/upload");
    request.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      const percent = Math.round((event.loaded / event.total) * 100);
      setDriveUpload({ phase: percent === 100 ? "Salvando em Prime Creative/Pixel/Exportações…" : "Enviando exportações ao Pixel…", percent });
    };
    request.onerror = () => reject(new Error("A conexão falhou antes de concluir o envio ao Google Drive."));
    request.onload = () => {
      let response: { error?: string; uploaded?: { name: string }[] } = {};
      try { response = JSON.parse(request.responseText) as { error?: string; uploaded?: { name: string }[] }; }
      catch { /* A mensagem padrão abaixo cobre uma resposta inválida. */ }
      if (request.status < 200 || request.status >= 300) { reject(new Error(response.error || "Não foi possível enviar os arquivos ao Google Drive.")); return; }
      resolve(response.uploaded?.map((file) => file.name) ?? []);
    };
    request.send(data);
  });

  const savePageToDrive = async () => {
    if (!activeCreation || !googleDrive.connected || driveUpload) return;
    const node = document.querySelector<HTMLElement>(".result-stage [data-pixel-card='true']");
    if (!node) { setNotice({ tone: "error", text: "Não foi possível preparar a página para envio." }); return; }
    const issues = inspectRenderedCard(node);
    if (issues.length) { setNotice({ tone: "error", text: issues[0].message }); return; }
    setDriveUpload({ phase: "Preparando a exportação…", percent: 0 });
    try {
      const blob = await renderCardBlob(node, exportFormat);
      const file = new File([blob], `${safeName(activeCreation.name)}-${resultPage + 1}.${exportFormat}`, { type: blob.type || (exportFormat === "png" ? "image/png" : "image/jpeg") });
      const uploaded = await sendExportsToDrive([file]);
      setNotice({ tone: "success", text: `${uploaded[0] || "A página"} foi salva em Prime Creative/Pixel/Exportações.` });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível enviar a página ao Google Drive." }); }
    finally { setDriveUpload(null); }
  };

  const saveAllToDrive = async () => {
    if (!activeCreation || !googleDrive.connected || driveUpload || activeCreation.pages.length < 2) return;
    const nodes = exportNodes.current.filter((node): node is HTMLElement => node !== null);
    if (nodes.length !== activeCreation.pages.length) { setNotice({ tone: "error", text: "Ainda estamos preparando as páginas para o envio. Tente novamente em instantes." }); return; }
    const issues = nodes.flatMap((node) => inspectRenderedCard(node));
    if (issues.length) { setNotice({ tone: "error", text: issues[0].message }); return; }
    setDriveUpload({ phase: "Preparando imagens e ZIP…", percent: 0 });
    try {
      const images = await Promise.all(nodes.map(async (node, index) => {
        const blob = await renderCardBlob(node, exportFormat);
        return new File([blob], `${safeName(activeCreation.name)}-${String(index + 1).padStart(2, "0")}.${exportFormat}`, { type: blob.type || (exportFormat === "png" ? "image/png" : "image/jpeg") });
      }));
      const zip = await renderCardsZip(nodes, activeCreation.name, exportFormat);
      const files = [...images, new File([zip], `${safeName(activeCreation.name)}.zip`, { type: "application/zip" })];
      const uploaded = await sendExportsToDrive(files);
      setNotice({ tone: "success", text: `${uploaded.length} arquivos foram salvos em Prime Creative/Pixel/Exportações.` });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível enviar as exportações ao Google Drive." }); }
    finally { setDriveUpload(null); }
  };

  const disconnectDrive = async () => {
    if (!googleDrive.connected || disconnectingDrive) return;
    setDisconnectingDrive(true);
    try {
      const response = await fetch("/api/integrations/google-drive/disconnect", { method: "POST" });
      const result = await response.json() as { revoked?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error || "Não foi possível desconectar o Google Drive.");
      setGoogleDrive({ loading: false, configured: true, connected: false });
      setNotice({ tone: result.revoked ? "success" : "info", text: result.revoked ? "Google Drive desconectado e autorização revogada." : "Google Drive desconectado. Não foi possível confirmar a revogação no Google." });
    } catch (error) { setNotice({ tone: "error", text: error instanceof Error ? error.message : "Não foi possível desconectar o Google Drive." }); }
    finally { setDisconnectingDrive(false); }
  };

  const brandFromForm = (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); const values = new FormData(event.currentTarget); const name = String(values.get("name") || "Nova marca"); const brand: BrandProfile = { id: crypto.randomUUID(), name, initials: name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase(), colors: [String(values.get("primary") || "#F04B3E"), String(values.get("secondary") || "#A9DCE8")], fonts: String(values.get("fonts") || "Geist"), slogan: String(values.get("slogan") || ""), voice: String(values.get("voice") || ""), guidelines: String(values.get("guidelines") || ""), assets: "Aguardando upload de assets" }; setBrands((items) => [brand, ...items]); setNotice({ tone: "success", text: "Marca cadastrada e pronta para ser usada na geração." }); event.currentTarget.reset(); };

  const shellContext: ShellContextValue = {
    member,
    theme,
    screen,
    retentionLabel: retention === "custom" ? `${customDays} dias` : `${retention} dias`,
    mobileNavOpen,
    notice,
    navigate,
    newGeneration: () => newGeneration(),
    toggleTheme: () => setTheme(theme === "light" ? "dark" : "light"),
    openMobileNav: () => setMobileNavOpen(true),
    closeMobileNav: () => setMobileNavOpen(false),
  };

  const SectionHead = ({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) => <header className="section-head"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1></div>{action}</header>;

  const Home = () => <Shell><SectionHead eyebrow="Pixel · geração criativa" title="O que vamos criar hoje?" action={<button className="button vermilion" onClick={() => newGeneration()}><Icon name="spark"/> Gerar</button>}/><section className="hero-intro"><div><p>Transforme conteúdo e identidade em uma peça pronta, sem montar layouts manualmente.</p><button className="text-link" onClick={() => newGeneration()}>Começar uma criação <Icon name="arrow"/></button></div><div className="hero-steps"><span>Marca</span><Icon name="arrow"/><span>Formato</span><Icon name="arrow"/><span>Template</span><Icon name="arrow"/><span>Conteúdo</span></div></section><div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-head"><h2>Criações recentes</h2><button className="text-link" onClick={() => navigate("creations")}>Ver todas <Icon name="arrow"/></button></div>{creations.length ? <div className="recent-list">{creations.slice(0, 3).map((item) => <button className="recent-item" key={item.id} onClick={() => { setSelectedCreation(item.id); setResultPage(0); setScreen("result"); }}><CardRenderer creation={item} brand={brands.find((brand) => brand.id === item.brandId)} compact/><span><strong>{item.name}</strong><small>{shortDate(item.createdAt)} · {item.pages.length} {item.pages.length === 1 ? "página" : "páginas"}</small></span></button>)}</div> : <div className="empty-state"><Icon name="spark" size={24}/><p>Ainda não há criações salvas.</p><button className="text-link" onClick={() => newGeneration()}>Gerar a primeira</button></div>}</section><section className="panel"><div className="panel-head"><h2>Templates para começar</h2><button className="text-link" onClick={() => navigate("templates")}>Ver todos <Icon name="arrow"/></button></div><div className="template-mini-list">{templates.slice(0, 3).map((item) => <button key={item.id} onClick={() => { setTemplateId(item.id); setStep(3); setScreen("generate"); }}><CardRenderer creation={templatePreviewCreation(item)} brand={seedBrands[0]} compact/><span><strong>{item.name}</strong><small>{item.pages === "multiple" ? "Múltiplas páginas" : "Card ou sequência"}</small></span><Icon name="arrow"/></button>)}</div></section></div><section className="brand-strip"><div className="panel-head"><h2>Marcas no Pixel</h2><button className="text-link" onClick={() => navigate("brands")}>Gerenciar <Icon name="arrow"/></button></div><div className="brand-row">{brands.map((brand) => <button key={brand.id} onClick={() => newGeneration(brand.id)}><BrandAvatar brand={brand}/><span><strong>{brand.name}</strong><small>{brand.fonts}</small></span></button>)}<button className="add-brand-inline" onClick={() => navigate("brands")}><Icon name="plus"/> Nova marca</button></div></section></Shell>;

  const Generation = () => <Shell><SectionHead eyebrow="Nova criação" title="Gerar" action={<button className="button ghost" onClick={() => navigate("home")}><Icon name="close"/> Cancelar</button>}/><div className="generator-layout"><aside className="stepper">{[[1, "Marca"], [2, "Formato"], [3, "Template"], [4, "Conteúdo"], [5, "Gerar"]].map(([number, label]) => <button key={String(number)} className={step === number ? "active" : step > Number(number) ? "done" : ""} onClick={() => step > Number(number) && setStep(Number(number))}><span>{step > Number(number) ? <Icon name="check" size={14}/> : number}</span>{label}</button>)}</aside><section className="generation-stage">
    {step === 1 && <><p className="stage-question">Para qual marca vamos criar?</p><p className="stage-helper">A marca oferece ao Pixel o contexto visual e verbal da criação.</p><div className="selection-grid brands-select">{brands.map((brand) => <button className={selectedBrand === brand.id ? "selected" : ""} onClick={() => setSelectedBrand(brand.id)} key={brand.id}><BrandAvatar brand={brand} large/><span><strong>{brand.name}</strong><small>{brand.slogan}</small></span><span className="selection-check"><Icon name="check" size={15}/></span></button>)}<button className={selectedBrand === null ? "selected no-brand" : "no-brand"} onClick={() => setSelectedBrand(null)}><span className="no-brand-symbol"><Icon name="mark"/></span><span><strong>Sem marca</strong><small>Usar apenas o conteúdo desta criação.</small></span><span className="selection-check"><Icon name="check" size={15}/></span></button></div></>}
    {step === 2 && <><p className="stage-question">Em qual formato a criação será publicada?</p><p className="stage-helper">O formato define quais templates podem ser usados depois.</p><div className="format-grid">{formats.map((item) => <button className={format === item.id ? "selected" : ""} key={item.id} onClick={() => { setFormat(item.id); if (!templates.find((template) => template.id === templateId && (item.id === "custom" || template.formats.includes(item.id)))) setTemplateId("minimal-editorial"); }}><span className={`format-ratio ${item.id}`}/><strong>{item.name}</strong><small>{item.pixels}</small><span className="selection-check"><Icon name="check" size={15}/></span></button>)}</div>{format === "custom" && <div className="custom-dimensions"><label>Largura<input type="number" min="320" max="6000" value={customSize.width} onChange={(event) => setCustomSize((value) => ({ ...value, width: Number(event.target.value) }))}/></label><span>×</span><label>Altura<input type="number" min="320" max="6000" value={customSize.height} onChange={(event) => setCustomSize((value) => ({ ...value, height: Number(event.target.value) }))}/></label></div>}</>}
    {step === 3 && <><p className="stage-question">Qual estrutura visual funciona melhor?</p><p className="stage-helper">Previews mostram a composição real de cada template. Nenhum deles abre editor livre.</p><div className="template-grid">{compatibleTemplates.map((item) => <button className={templateId === item.id ? "selected" : ""} key={item.id} onClick={() => { setTemplateId(item.id); if (item.id === "minimal-editorial") setContent((value) => ({ ...value, coverVariant: value.coverVariant ?? "editorial" })); }}><CardRenderer creation={templatePreviewCreation(item)} brand={seedBrands[0]} compact/><strong>{item.name}</strong><small>{item.description}</small><em>{item.pages === "multiple" ? `${item.pageBlueprint.length} páginas` : item.pages === "single" ? "Card" : "Card ou sequência"}</em><span className="selection-check"><Icon name="check" size={15}/></span></button>)}</div>{templateId === "minimal-editorial" && <section className="cover-variant-picker" aria-label="Variação de capa Brand Editorial"><p>Variação de capa</p><div>{editorialCoverVariants.map((variant) => <button className={content.coverVariant === variant.id || (!content.coverVariant && variant.id === "editorial") ? "selected" : ""} key={variant.id} onClick={() => setContent((value) => ({ ...value, coverVariant: variant.id }))}><strong>{variant.name}</strong><small>{variant.description}</small></button>)}</div></section>}</>}
    {step === 4 && <><p className="stage-question">O que você quer comunicar?</p><p className="stage-helper">Descreva a ideia em linguagem natural ou escreva os campos abaixo. Você revisa tudo antes de gerar.</p><div className="content-form"><label className="brief-label">Briefing<textarea value={content.brief} onChange={(event) => patchContent("brief", event.target.value)} placeholder="Ex.: anunciar uma nova consultoria para pequenos negócios, com tom direto e convidativo."/></label><button className="button subtle" onClick={interpretBrief} disabled={generating || preparingImage}><Icon name="spark"/> Interpretar briefing</button><div className="content-fields"><label>Título<input value={content.title} onChange={(event) => patchContent("title", event.target.value)}/></label><label>Subtítulo<input value={content.subtitle} onChange={(event) => patchContent("subtitle", event.target.value)}/></label><label className="wide">Texto<textarea value={content.body} onChange={(event) => patchContent("body", event.target.value)}/></label><label>CTA<input value={content.cta} onChange={(event) => patchContent("cta", event.target.value)}/></label><label>Imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} disabled={preparingImage}/>{preparingImage && <small>Preparando imagem…</small>}</label></div></div></>}
    {step === 5 && <><p className="stage-question">Tudo pronto para o Pixel compor sua criação.</p><p className="stage-helper">{selectedBrand ? `${brands.find((item) => item.id === selectedBrand)?.name} · ` : "Sem marca · "}{formats.find((item) => item.id === format)?.name} · {currentTemplate.name}</p><div className="generate-summary"><CardRenderer creation={{ id: "preview", name: content.title, brandId: selectedBrand, templateId, format, dimensions: dimensionsFor(format, customSize), content, pages: composePages(content, currentTemplate, suggestedPages ?? undefined), createdAt: now(), expiresAt: now() }} brand={brands.find((item) => item.id === selectedBrand)} /><div><span className="eyebrow">Pronto para gerar</span><h2>A composição será calculada pelo template.</h2><p>Você poderá ajustar conteúdo, imagem ou formato depois, sem mover elementos manualmente.</p><button className="button vermilion large" onClick={generate} disabled={generating || preparingImage}>{generating ? <><span className="spinner"/> Pixel está compondo</> : preparingImage ? "Preparando imagem…" : <><Icon name="spark"/> Gerar card</>}</button></div></div></>}
    <footer className="stage-actions">{step > 1 ? <button className="button ghost" onClick={() => setStep((value) => value - 1)}><Icon name="back"/> Voltar</button> : <span/>}{step < 5 && <button className="button vermilion" onClick={() => setStep((value) => value + 1)}>Continuar <Icon name="arrow"/></button>}</footer>
  </section></div></Shell>;

  const Creations = () => <Shell><SectionHead eyebrow="Histórico temporário" title="Criações" action={<button className="button vermilion" onClick={newGeneration}><Icon name="plus"/> Gerar</button>}/><div className="retention-note"><Icon name="gear"/><span>As criações deste espaço são excluídas automaticamente após {retention === "custom" ? `${customDays} dias` : `${retention} dias`}. Arquivos baixados ou exportados não são afetados.</span></div>{creations.length ? <><div className="collection-toolbar"><label><input type="checkbox" checked={selectedIds.length === creations.length} onChange={(event) => setSelectedIds(event.target.checked ? creations.map((item) => item.id) : [])}/> Selecionar todas</label>{selectedIds.length > 0 && <button className="button danger" onClick={() => setConfirmDelete("bulk")}><Icon name="trash"/> Excluir {selectedIds.length}</button>}</div><div className="creation-grid">{creations.map((item) => <article className="creation-card" key={item.id}><label className="selection-box"><input type="checkbox" checked={selectedIds.includes(item.id)} onChange={(event) => setSelectedIds((ids) => event.target.checked ? [...ids, item.id] : ids.filter((id) => id !== item.id))}/></label><button className="creation-open" onClick={() => { setSelectedCreation(item.id); setResultPage(0); setScreen("result"); }}><CardRenderer creation={item} brand={brands.find((brand) => brand.id === item.brandId)} compact/></button><div><p>{templates.find((template) => template.id === item.templateId)?.name}</p><h2>{item.name}</h2><small>Criada em {shortDate(item.createdAt)} · expira {shortDate(item.expiresAt)}</small></div><div className="card-actions"><button aria-label="Duplicar criação" onClick={() => duplicate(item)}><Icon name="copy"/></button><button aria-label="Excluir criação" onClick={() => setConfirmDelete(item.id)}><Icon name="trash"/></button></div></article>)}</div></> : <div className="empty-page"><img src={`/brand/pixel/symbol/symbol-${theme === "dark" ? "light" : "ink"}.svg`} alt="Símbolo Pixel"/><h2>Suas criações aparecem aqui.</h2><p>O Pixel guarda o resultado temporariamente para você baixar, variar ou adaptar quando precisar.</p><button className="button vermilion" onClick={newGeneration}><Icon name="spark"/> Gerar agora</button></div>}</Shell>;

  const Templates = () => <Shell><SectionHead eyebrow="Estruturas reutilizáveis" title="Templates" action={<button className="button vermilion" onClick={newGeneration}><Icon name="plus"/> Gerar</button>}/><p className="page-intro">Cada preview é o resultado real do renderer, com tipografia, recorte e hierarquia que serão usados na geração. O template combina campos de conteúdo com formato e nunca se transforma em uma tela de edição livre.</p><div className="template-library">{templates.map((item) => <article key={item.id}><CardRenderer creation={templatePreviewCreation(item)} brand={seedBrands[0]} compact/><div><p>{item.category}</p><h2>{item.name}</h2><span>{item.description}</span><dl><div><dt>Compatível com</dt><dd>{item.formats.map((formatId) => formats.find((format) => format.id === formatId)?.name).join(" · ")}</dd></div><div><dt>Páginas</dt><dd>{item.pages === "multiple" ? `${item.pageBlueprint.length} páginas` : item.pages === "single" ? "Uma" : "Card ou sequência"}</dd></div><div><dt>Campos</dt><dd>{item.fields.join(" · ")}</dd></div></dl><button className="button vermilion" onClick={() => { setTemplateId(item.id); setFormat(item.formats[0]); setStep(4); setScreen("generate"); }}>Usar template <Icon name="arrow"/></button></div></article>)}</div></Shell>;

  const Brands = () => <Shell><SectionHead eyebrow="Contexto para geração consistente" title="Marcas" action={<button className="button vermilion" onClick={() => document.getElementById("brand-form")?.scrollIntoView({ behavior: "smooth" })}><Icon name="plus"/> Nova marca</button>}/><p className="page-intro">Uma marca reúne referências visuais e verbais para que o Pixel saiba como a comunicação deve parecer e como deve falar.</p><div className="brand-management">{brands.map((brand) => <article key={brand.id}><div className="brand-title"><BrandAvatar brand={brand} large/><div><h2>{brand.name}</h2><p>{brand.slogan || "Sem slogan definido"}</p></div><button className="button vermilion" onClick={() => newGeneration(brand.id)}>Usar para gerar <Icon name="arrow"/></button></div><dl><div><dt>Paleta</dt><dd><i style={{ background: brand.colors[0] }}/><i style={{ background: brand.colors[1] }}/>{brand.colors.join(" · ")}</dd></div><div><dt>Tipografia</dt><dd>{brand.fonts}</dd></div><div><dt>Tom de voz</dt><dd>{brand.voice}</dd></div><div><dt>Diretrizes</dt><dd>{brand.guidelines}</dd></div><div><dt>Ativos</dt><dd>{brand.assets}</dd></div></dl></article>)}</div><form id="brand-form" className="brand-form panel" onSubmit={brandFromForm}><div className="panel-head"><div><h2>Adicionar marca</h2><p>Cadastre o contexto essencial agora; o campo de ativos está pronto para ser conectado a um storage.</p></div></div><div className="content-fields"><label>Nome<input name="name" required placeholder="Nome da marca"/></label><label>Slogan<input name="slogan" placeholder="Uma frase de marca"/></label><label>Cor principal<input name="primary" defaultValue="#F04B3E" type="color"/></label><label>Cor de apoio<input name="secondary" defaultValue="#A9DCE8" type="color"/></label><label>Tipografias<input name="fonts" placeholder="Ex.: Geist + serif"/></label><label>Tom de voz<input name="voice" placeholder="Ex.: claro, próximo e preciso"/></label><label className="wide">Diretrizes<textarea name="guidelines" placeholder="O que deve ser priorizado nas criações?"/></label></div><button className="button vermilion" type="submit"><Icon name="plus"/> Cadastrar marca</button></form></Shell>;

  const Settings = () => <Shell><SectionHead eyebrow="Produto e preferências" title="Configurações"/><div className="settings-stack"><section className="setting-card"><div><h2>Aparência</h2><p>Os dois temas usam tokens específicos do Pixel — não uma inversão automática de cores. Altere a aparência pelo controle global no cabeçalho.</p></div><span className="setting-status">Controle global</span></section><section className="setting-card"><div><h2>Retenção de criações</h2><p>Cada criação recebe uma data prevista de exclusão. Exclusões manuais são definitivas.</p></div><div className="retention-options">{(["15", "30", "90", "custom"] as Retention[]).map((value) => <label key={value}><input type="radio" name="retention" checked={retention === value} onChange={() => setRetention(value)}/><span>{value === "custom" ? "Personalizado" : `${value} dias${value === "30" ? " · padrão" : ""}`}</span></label>)}</div>{retention === "custom" && <label className="day-input">Dias<input type="number" min="1" max="365" value={customDays} onChange={(event) => setCustomDays(Number(event.target.value))}/></label>}</section><section className="setting-card integration"><div><p className="eyebrow">Integrações</p><h2>Google Drive</h2><p>Salve exportações em <strong>Prime Creative/Pixel/Exportações</strong>. O Pixel não lê a sua biblioteca e continua funcionando sem Drive.</p></div><div className="integration-status"><span className={googleDrive.connected ? "connected" : ""}>{googleDrive.loading ? "Verificando…" : googleDrive.connected ? "Conectado" : googleDrive.configured ? "Não conectado" : "Configuração necessária"}</span>{googleDrive.connected ? <><button className="button ghost" onClick={disconnectDrive} disabled={disconnectingDrive}>{disconnectingDrive ? "Desconectando…" : "Desconectar e revogar"}</button><small>As novas exportações serão salvas em Prime Creative/Pixel/Exportações nesta conta.</small></> : <><button className="button vermilion" onClick={() => { window.location.assign("/api/integrations/google-drive/connect"); }} disabled={googleDrive.loading || !googleDrive.configured} title={googleDrive.configured ? "Conectar uma conta Google" : "Requer configuração OAuth do Google no ambiente"}>Conectar Google Drive</button><small>{googleDrive.configured ? "Você autoriza somente o envio dos arquivos que escolher no Pixel." : "Aguarda credenciais OAuth e armazenamento seguro de tokens no ambiente."}</small></>}</div></section></div></Shell>;

  const Result = () => {
    if (!activeCreation) return <Creations />;
    const resultBrand = brands.find((brand) => brand.id === activeCreation.brandId);
    exportNodes.current = [];
    return <Shell>
      <SectionHead eyebrow={activeCreation.pages.length > 1 ? "Criação com múltiplas páginas" : "Card gerado"} title={activeCreation.name} action={<button className="button ghost" onClick={() => navigate("creations")}><Icon name="back"/> Criações</button>}/>
      <div className="result-layout">
        <section className="result-stage">
          <CardRenderer creation={activeCreation} brand={resultBrand} page={resultPage}/>
          {activeCreation.pages.length > 1 && <div className="page-switcher">{activeCreation.pages.map((_, index) => <button key={index} aria-label={`Página ${index + 1}`} className={resultPage === index ? "active" : ""} onClick={() => setResultPage(index)}>{index + 1}</button>)}</div>}
        </section>
        <aside className="result-actions">
          <div><p className="eyebrow">Peça pronta</p><h2>{activeCreation.pages.length === 1 ? "Seu card está pronto." : "Sua criação está pronta."}</h2><p>O template calculou a composição para {formats.find((formatItem) => formatItem.id === activeCreation.format)?.name} · {activeCreation.dimensions.width} × {activeCreation.dimensions.height}px.</p></div>
          <div className="export-controls" aria-label="Formato de exportação"><span>Formato</span><button className={exportFormat === "png" ? "selected" : ""} onClick={() => setExportFormat("png")}>PNG</button><button className={exportFormat === "jpg" ? "selected" : ""} onClick={() => setExportFormat("jpg")}>JPG</button></div>
          <button className="button vermilion full" onClick={download}><Icon name="download"/> Baixar página {activeCreation.pages.length > 1 ? resultPage + 1 : ""}</button>
          {activeCreation.pages.length > 1 && <button className="button vermilion full" onClick={downloadAll}><Icon name="layers"/> Baixar todas em ZIP</button>}
          {googleDrive.connected && <><button className="button ghost full" onClick={savePageToDrive} disabled={Boolean(driveUpload)}><Icon name="download"/> {driveUpload ? `${driveUpload.phase} ${driveUpload.percent}%` : "Salvar página no Drive"}</button>{activeCreation.pages.length > 1 && <button className="button ghost full" onClick={saveAllToDrive} disabled={Boolean(driveUpload)}><Icon name="layers"/> {driveUpload ? "Envio em andamento…" : "Salvar imagens e ZIP no Drive"}</button>}</>}
          {!googleDrive.loading && googleDrive.configured && !googleDrive.connected && <button className="button ghost full" onClick={() => navigate("settings")}>Conectar Google Drive para salvar</button>}
          <div className="action-list"><button onClick={() => setVariationOpen(true)}><Icon name="spark"/><span><strong>Gerar variação</strong><small>Explorar outra direção com base nesta criação.</small></span><Icon name="arrow"/></button><button onClick={() => { setContent(activeCreation.content); setEditing(true); }}><Icon name="edit"/><span><strong>Editar conteúdo</strong><small>Atualize textos ou CTA; a composição será recalculada.</small></span><Icon name="arrow"/></button><button onClick={() => { setContent(activeCreation.content); setStep(4); setSelectedBrand(activeCreation.brandId); setFormat(activeCreation.format); setTemplateId(activeCreation.templateId); setScreen("generate"); }}><Icon name="image"/><span><strong>Trocar imagem</strong><small>Selecione uma nova imagem e gere novamente.</small></span><Icon name="arrow"/></button><button onClick={() => { setContent(activeCreation.content); setStep(2); setSelectedBrand(activeCreation.brandId); setTemplateId(activeCreation.templateId); setScreen("generate"); }}><Icon name="grid"/><span><strong>Adaptar formato</strong><small>Escolha outra proporção compatível.</small></span><Icon name="arrow"/></button><button className="danger-link" onClick={() => setConfirmDelete(activeCreation.id)}><Icon name="trash"/> Excluir definitivamente</button></div>
        </aside>
      </div>
      {activeCreation.pages.length > 1 && <div className="export-staging" aria-hidden="true">{activeCreation.pages.map((_, index) => <div key={index} ref={(node) => { exportNodes.current[index] = node?.querySelector<HTMLElement>("[data-pixel-card='true']") ?? null; }}><CardRenderer creation={activeCreation} brand={resultBrand} page={index} exportMode /></div>)}</div>}
    </Shell>;
  };

  const Modal = () => (editing && activeCreation) ? <div className="modal-backdrop"><section className="modal"><button className="modal-close" aria-label="Fechar" onClick={() => setEditing(false)}><Icon name="close"/></button><p className="eyebrow">Editar conteúdo</p><h2>Atualize o que a criação comunica.</h2><p>O Pixel mantém o template e recalcula a composição. Não há movimentação manual de elementos.</p><div className="content-fields"><label>Título<input value={content.title} onChange={(event) => patchContent("title", event.target.value)}/></label><label>Subtítulo<input value={content.subtitle} onChange={(event) => patchContent("subtitle", event.target.value)}/></label><label className="wide">Texto<textarea value={content.body} onChange={(event) => patchContent("body", event.target.value)}/></label><label>CTA<input value={content.cta} onChange={(event) => patchContent("cta", event.target.value)}/></label><label>Imagem<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageUpload} disabled={preparingImage}/>{preparingImage && <small>Preparando imagem…</small>}</label></div><div className="modal-actions"><button className="button ghost" onClick={() => setEditing(false)}>Cancelar</button><button className="button vermilion" onClick={updateCreation} disabled={preparingImage}><Icon name="spark"/> Atualizar card</button></div></section></div> : null;
  const VariationModal = () => (variationOpen && activeCreation) ? <div className="modal-backdrop"><section className="modal compact-modal"><button className="modal-close" aria-label="Fechar" onClick={() => setVariationOpen(false)}><Icon name="close"/></button><p className="eyebrow">Gerar variação</p><h2>O que você quer explorar?</h2><div className="variation-options">{[["layout", "Variar layout", "Outra estrutura visual compatível."], ["text", "Variar texto", "Uma nova leitura da mesma ideia."], ["image", "Variar imagem", "Preparado para assets conectados."], ["all", "Variar tudo", "Outra direção com base na criação."]].map(([value, label, description]) => <button className={variation === value ? "selected" : ""} key={value} onClick={() => setVariation(value)}><strong>{label}</strong><small>{description}</small><span className="selection-check"><Icon name="check" size={15}/></span></button>)}</div><label className="brief-label">Orientação opcional<textarea placeholder="Ex.: mais sóbrio, mais direto, mais editorial."/></label><div className="modal-actions"><button className="button ghost" onClick={() => setVariationOpen(false)}>Cancelar</button><button className="button vermilion" onClick={() => duplicate(activeCreation, true)}><Icon name="spark"/> Gerar variação</button></div></section></div> : null;
  const DeleteModal = () => confirmDelete ? <div className="modal-backdrop"><section className="modal confirm-modal"><img src={`/brand/pixel/symbol/symbol-${theme === "dark" ? "light" : "ink"}.svg`} alt="Símbolo Pixel"/><p className="eyebrow">Exclusão definitiva</p><h2>{confirmDelete === "bulk" ? `Excluir ${selectedIds.length} criações?` : "Excluir esta criação?"}</h2><p>Essa ação não pode ser desfeita. Arquivos que você já baixou ou exportou não são afetados.</p><div className="modal-actions"><button className="button ghost" onClick={() => setConfirmDelete(null)}>Cancelar</button><button className="button danger" onClick={removeCreations}><Icon name="trash"/> Excluir definitivamente</button></div></section></div> : null;

  const page = screen === "home" ? <Home/> : screen === "creations" ? <Creations/> : screen === "templates" ? <Templates/> : screen === "brands" ? <Brands/> : screen === "brandbooks" ? <Shell><Brandbooks onNotice={showNotice}/></Shell> : screen === "settings" ? <Settings/> : screen === "generate" ? <Generation/> : <Result/>;
  return <ShellContext.Provider value={shellContext}>{page}<Modal/><VariationModal/><DeleteModal/></ShellContext.Provider>;
}
