import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  Lock,
  LogOut,
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronRight,
  Share2,
  Music2,
} from "lucide-react";

const TOKEN_KEY = "lp_admin_token";

type AdSurface = "feed-square" | "vertical" | "tiktok-infeed" | "landing";

interface PlacementSpec {
  id: AdSurface;
  name: string;
  platforms: string;
  aspectRatio: string;
  dimensions: string;
  safeZone: string;
  imageryNotes: string;
  copyNorms: string;
}
interface AdSlotContract {
  idx: number;
  label: string;
  placement: AdSurface;
  direction: string;
}
interface ReferenceArchetype {
  id: string;
  title: string;
  vertical: string;
  keywords: string[];
  surface: AdSurface;
  angle: string;
  imageryStyle: string;
  hookPattern: string;
  bodyPattern: string;
  ctaPattern: string;
  whyItWorks: string;
}
interface WebsiteReference {
  id: string;
  title: string;
  vertical: string;
  keywords: string[];
  heroDevice: string;
  sections: string[];
  typography: string;
  palette: string;
  whyItWorks: string;
}
interface Library {
  designPrinciples: string[];
  webPrinciples: string[];
  placements: PlacementSpec[];
  slotContracts: AdSlotContract[];
  adArchetypes: ReferenceArchetype[];
  websiteReferences: WebsiteReference[];
  landingPattern: { structure: string[]; principles: string };
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
}
function gradientFor(id: string): string {
  const h = hashHue(id);
  return `linear-gradient(140deg, hsl(${h} 44% 85%), hsl(${(h + 42) % 360} 48% 70%))`;
}
function accentFor(id: string): string {
  return `hsl(${hashHue(id)} 46% 52%)`;
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

export default function Admin() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [library, setLibrary] = useState<Library | null>(null);
  const [phase, setPhase] = useState<"login" | "loading" | "ready" | "unconfigured">(
    token ? "loading" : "login",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setPhase("login");
      return;
    }
    let cancelled = false;
    setPhase("loading");
    fetch("/api/admin/reference-library", { headers: { "x-admin-token": token } })
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          setToken(null);
          setPhase("login");
          return;
        }
        if (res.status === 503) {
          setPhase("unconfigured");
          return;
        }
        if (!res.ok) {
          setError("Couldn't load the library.");
          setPhase("login");
          return;
        }
        const data = (await res.json()) as Library;
        if (!cancelled) {
          setLibrary(data);
          setPhase("ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Network error. Try again.");
          setPhase("login");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.status === 503) {
        setPhase("unconfigured");
        return;
      }
      if (res.status === 401) {
        setError("Incorrect password.");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong.");
        return;
      }
      const data = (await res.json()) as { token: string };
      localStorage.setItem(TOKEN_KEY, data.token);
      setPassword("");
      setToken(data.token);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setLibrary(null);
    setError(null);
    setPhase("login");
  };

  if (phase === "unconfigured") {
    return (
      <Centered>
        <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-6">
          <Lock className="w-5 h-5 text-muted-foreground" />
        </div>
        <h1 className="font-serif text-4xl mb-3">Not configured</h1>
        <p className="font-sans text-sm text-muted-foreground max-w-sm">
          Admin access isn't set up yet. Add an{" "}
          <code className="bg-secondary px-1 rounded text-xs">ADMIN_PASSWORD</code> secret to the
          server, then reload this page.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="mt-8 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back home
        </button>
      </Centered>
    );
  }

  if (phase === "loading" && !library) {
    return (
      <Centered>
        <span className="w-6 h-6 rounded-full border-2 border-border border-t-foreground animate-spin" />
        <p className="mt-5 font-sans text-sm text-muted-foreground">Loading library…</p>
      </Centered>
    );
  }

  if (phase === "login") {
    return (
      <Centered>
        <div className="w-full max-w-[360px] animate-in fade-in duration-700">
          <div className="text-center mb-10">
            <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mx-auto mb-6">
              <Lock className="w-5 h-5 text-foreground" />
            </div>
            <h1 className="font-serif text-4xl mb-2">
              Reference <span className="italic opacity-50">library</span>
            </h1>
            <p className="font-sans text-sm text-muted-foreground">
              Enter the admin password to continue.
            </p>
          </div>
          <form onSubmit={handleLogin} className="flex flex-col gap-3">
            <input
              type="password"
              autoFocus
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(null);
              }}
              placeholder="Admin password"
              className="w-full bg-card border border-border rounded-2xl px-5 py-4 font-sans text-base outline-none focus:ring-1 focus:ring-ring transition-all"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-foreground text-background rounded-2xl px-5 py-4 font-sans font-medium text-base hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {submitting ? "Checking…" : "Enter"}
            </button>
            {error && <p className="text-center font-sans text-sm text-red-500">{error}</p>}
          </form>
          <button
            onClick={() => setLocation("/")}
            className="block mx-auto mt-8 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← Back home
          </button>
        </div>
      </Centered>
    );
  }

  if (!library) return <Centered>{null}</Centered>;

  const placementName = (s: AdSurface) =>
    library.placements.find((p) => p.id === s)?.name ?? s;

  return (
    <div className="min-h-[100dvh] bg-background animate-in fade-in duration-700">
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur border-b border-border/60">
        <div className="max-w-[1100px] mx-auto px-6 h-16 flex items-center justify-between">
          <button
            onClick={() => setLocation("/")}
            className="font-sans font-bold text-xl tracking-tighter hover:opacity-70 transition-opacity"
          >
            LP
          </button>
          <div className="flex items-center gap-5">
            <span className="font-sans text-[11px] uppercase tracking-[2px] text-muted-foreground hidden sm:inline">
              Reference Library
            </span>
            <button
              onClick={logout}
              className="inline-flex items-center gap-1.5 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-[1100px] mx-auto px-6 py-16">
        <div className="mb-20 max-w-2xl">
          <h1 className="font-serif text-6xl md:text-7xl leading-none mb-5">
            The <span className="italic opacity-50">reference</span> library
          </h1>
          <p className="font-sans text-base text-muted-foreground leading-relaxed">
            The curated, in-house knowledge LaunchPad draws on — best-in-class 2026 design-forward
            paid-social ads and landing pages, distilled into patterns, platform specs and
            principles. This is what shapes every campaign.
          </p>
        </div>

        <Section label="Ad creative archetypes">
          <div className="grid gap-x-8 gap-y-14 [grid-template-columns:repeat(auto-fill,minmax(280px,1fr))] items-start">
            {library.adArchetypes.map((ad) => (
              <figure key={ad.id} className="flex flex-col">
                {ad.surface === "feed-square" ? (
                  <FeedCard ad={ad} />
                ) : (
                  <VerticalCard ad={ad} />
                )}
                <figcaption className="mt-5">
                  <div className="text-[11px] font-sans uppercase tracking-[1.5px] opacity-40">
                    {placementName(ad.surface)} · {ad.angle}
                  </div>
                  <h4 className="font-serif text-2xl mt-1.5">{ad.title}</h4>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed mt-2">
                    <span className="opacity-50">Imagery</span> — {ad.imageryStyle}
                  </p>
                  <p className="font-sans text-xs text-muted-foreground leading-relaxed mt-1.5">
                    <span className="opacity-50">Why it works</span> — {ad.whyItWorks}
                  </p>
                </figcaption>
              </figure>
            ))}
          </div>
        </Section>

        <Section label="Landing page references">
          <div className="grid gap-x-8 gap-y-12 md:grid-cols-2 items-start">
            {library.websiteReferences.map((site) => (
              <WebsiteMockup key={site.id} site={site} />
            ))}
          </div>
        </Section>

        <Section label="Placement specs">
          <div className="grid md:grid-cols-2 gap-5">
            {library.placements
              .filter((p) => p.id !== "landing")
              .map((p) => (
                <div key={p.id} className="bg-card border border-border rounded-2xl p-6">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <h4 className="font-serif text-2xl leading-tight">{p.name}</h4>
                    <span className="flex-shrink-0 text-[11px] font-sans bg-secondary rounded-full px-2.5 py-1 text-muted-foreground">
                      {p.aspectRatio} · {p.dimensions}
                    </span>
                  </div>
                  <p className="font-sans text-xs text-muted-foreground mb-4">{p.platforms}</p>
                  <SpecRow label="Imagery" value={p.imageryNotes} />
                  <SpecRow label="Copy" value={p.copyNorms} />
                  <SpecRow label="Safe zone" value={p.safeZone} />
                </div>
              ))}
          </div>
        </Section>

        <Section label="Ad slot contracts">
          <div className="flex flex-col gap-4">
            {library.slotContracts.map((s) => (
              <div
                key={s.idx}
                className="bg-card border border-border rounded-2xl p-5 flex gap-5 items-start"
              >
                <span className="font-serif text-3xl opacity-25 leading-none">
                  {String(s.idx + 1).padStart(2, "0")}
                </span>
                <div>
                  <h4 className="font-sans font-semibold text-sm mb-1">{s.label}</h4>
                  <p className="font-sans text-sm text-muted-foreground leading-relaxed">
                    {s.direction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section label="2026 design-forward principles">
          <PrincipleList items={library.designPrinciples} />
        </Section>

        <Section label="Web design principles">
          <PrincipleList items={library.webPrinciples} />
        </Section>
      </div>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center text-center p-6">
      {children}
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="mb-24">
      <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-8">{label}</div>
      {children}
    </section>
  );
}

function SpecRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="py-2 border-t border-border/60">
      <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mb-0.5">
        {label}
      </span>
      <span className="font-sans text-sm text-foreground/80 leading-relaxed">{value}</span>
    </div>
  );
}

function PrincipleList({ items }: { items: string[] }) {
  return (
    <ol className="grid md:grid-cols-2 gap-x-12 gap-y-6">
      {items.map((p, i) => (
        <li key={i} className="flex gap-4">
          <span className="font-serif text-2xl opacity-25 leading-none pt-0.5">
            {String(i + 1).padStart(2, "0")}
          </span>
          <p className="font-sans text-sm leading-relaxed text-foreground/80">{p}</p>
        </li>
      ))}
    </ol>
  );
}

function FeedCard({ ad }: { ad: ReferenceArchetype }) {
  return (
    <div className="w-full max-w-[340px] mx-auto bg-card rounded-2xl border border-border shadow-sm overflow-hidden font-sans">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-semibold text-white"
          style={{ background: accentFor(ad.id) }}
        >
          {initials(ad.vertical)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold leading-tight truncate">your_brand</div>
          <div className="text-[11px] text-muted-foreground leading-tight">Sponsored</div>
        </div>
        <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
      </div>
      <div
        className="aspect-square relative flex items-center justify-center"
        style={{ background: gradientFor(ad.id) }}
      >
        <span className="font-serif text-6xl text-white/40 select-none">{initials(ad.vertical)}</span>
        <span className="absolute bottom-2.5 left-2.5 text-[10px] font-sans uppercase tracking-wide text-white/80 bg-black/20 backdrop-blur rounded-full px-2 py-0.5">
          {ad.vertical}
        </span>
      </div>
      <div className="flex items-center gap-4 px-3 py-2.5">
        <Heart className="w-5 h-5" />
        <MessageCircle className="w-5 h-5" />
        <Send className="w-5 h-5" />
        <Bookmark className="w-5 h-5 ml-auto" />
      </div>
      <div className="px-3 pb-2.5">
        <p className="text-[13px] leading-snug">
          <span className="font-semibold">your_brand</span> {ad.hookPattern}
        </p>
        <p className="text-[12px] text-muted-foreground leading-snug mt-1">{ad.bodyPattern}</p>
      </div>
      <a className="flex items-center justify-between px-3 py-3 border-t border-border bg-secondary/40 text-[13px] font-medium cursor-default">
        {ad.ctaPattern}
        <ChevronRight className="w-4 h-4" />
      </a>
    </div>
  );
}

function VerticalCard({ ad }: { ad: ReferenceArchetype }) {
  const isTikTok = ad.surface === "tiktok-infeed";
  return (
    <div className="mx-auto w-[230px]">
      <div
        className="relative rounded-[2rem] border-[6px] border-foreground/90 overflow-hidden shadow-xl"
        style={{ aspectRatio: "9 / 16" }}
      >
        <div className="absolute inset-0" style={{ background: gradientFor(ad.id) }} />
        <span className="absolute inset-0 flex items-center justify-center font-serif text-white/30 text-5xl select-none">
          {initials(ad.vertical)}
        </span>
        <div className="absolute top-3 left-0 right-0 flex justify-center">
          <span className="text-[10px] font-sans uppercase tracking-wide text-white/90 bg-black/25 backdrop-blur rounded-full px-2.5 py-0.5">
            Sponsored
          </span>
        </div>

        {isTikTok && (
          <div className="absolute right-2.5 bottom-28 flex flex-col items-center gap-4 text-white">
            <Heart className="w-6 h-6" />
            <MessageCircle className="w-6 h-6" />
            <Share2 className="w-6 h-6" />
            <Music2 className="w-5 h-5 animate-spin [animation-duration:4s]" />
          </div>
        )}

        <div
          className={`absolute left-0 right-0 bottom-0 p-3 pt-10 bg-gradient-to-t from-black/75 to-transparent text-white ${
            isTikTok ? "pr-12" : ""
          }`}
        >
          <p className="font-semibold text-[13px] leading-snug">{ad.hookPattern}</p>
          <p className="text-[11px] text-white/80 leading-snug mt-1 line-clamp-2">{ad.bodyPattern}</p>
          <button className="mt-2.5 w-full bg-white text-black rounded-lg py-1.5 text-[12px] font-semibold flex items-center justify-center gap-1 cursor-default">
            {ad.ctaPattern}
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

function WebsiteMockup({ site }: { site: WebsiteReference }) {
  const h = hashHue(site.id);
  const heroBg = `linear-gradient(140deg, hsl(${h} 40% 92%), hsl(${(h + 36) % 360} 44% 84%))`;
  const slug = site.vertical.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "brand";
  return (
    <figure>
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border bg-secondary/40">
          <span className="w-2.5 h-2.5 rounded-full bg-red-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400/70" />
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/70" />
          <div className="ml-2 flex-1 h-5 rounded-md bg-background border border-border flex items-center px-2.5 text-[10px] text-muted-foreground truncate">
            {slug}.com
          </div>
        </div>
        <div className="p-4 flex flex-col gap-3">
          <div className="rounded-lg p-5" style={{ background: heroBg }}>
            <div className="text-[10px] font-sans uppercase tracking-wide opacity-50 mb-2">
              {site.vertical}
            </div>
            <div className="font-serif text-2xl leading-tight mb-2">{site.title}</div>
            <p className="font-sans text-xs text-foreground/60 leading-relaxed">{site.heroDevice}</p>
            <span className="inline-block mt-3 px-3.5 py-1.5 rounded-full bg-foreground text-background text-[11px] font-medium">
              Get started
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {site.sections.map((s, i) => (
              <span
                key={i}
                className="text-[11px] font-sans px-2.5 py-1 rounded-full bg-secondary text-muted-foreground border border-border/60"
              >
                {s}
              </span>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div>
              <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mb-0.5">
                Type
              </span>
              <span className="font-sans text-xs text-muted-foreground leading-relaxed">
                {site.typography}
              </span>
            </div>
            <div>
              <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mb-0.5">
                Palette
              </span>
              <span className="font-sans text-xs text-muted-foreground leading-relaxed">
                {site.palette}
              </span>
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-4">
        <h4 className="font-serif text-2xl">{site.title}</h4>
        <p className="font-sans text-xs text-muted-foreground leading-relaxed mt-1.5">
          <span className="opacity-50">Why it works</span> — {site.whyItWorks}
        </p>
      </figcaption>
    </figure>
  );
}
