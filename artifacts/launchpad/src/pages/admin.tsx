import { useCallback, useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Lock, LogOut, Upload, Trash2, ExternalLink, Loader2, Check, RefreshCw, Plug, X } from "lucide-react";
import { resizeImage } from "../lib/image-upload";
import { cn } from "@/lib/utils";

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

type AssetStatus = "analyzing" | "ready" | "failed";
interface ReferenceAnalysis {
  format: string;
  hook: string;
  angle: string;
  visualTokens: string[];
  copyPattern: string;
  tone: string;
  whyItWorks: string;
}
interface ReferenceAsset {
  id: string;
  platform: string;
  source: "curated" | "uploaded";
  sourceUrl: string | null;
  title: string | null;
  imageUrl: string;
  status: AssetStatus;
  analysis: ReferenceAnalysis | null;
}
interface PlatformMeta {
  slug: string;
  label: string;
}

interface ConnectorStatus {
  id: string;
  label: string;
  blurb: string;
  note: string | null;
  connected: boolean;
  requiredSecretKeys: string[];
  missingKeys: string[];
  optionalSecretKeys: string[];
  optionalPresentKeys: string[];
  storedKeys: string[];
  source: "stored" | "env" | "none";
  setupSteps: string[];
  docsUrl: string;
}
interface ConnectorsResponse {
  adsMode: string;
  connectors: ConnectorStatus[];
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return h;
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
  const [assets, setAssets] = useState<ReferenceAsset[] | null>(null);
  const [assetPlatforms, setAssetPlatforms] = useState<PlatformMeta[]>([]);
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<ConnectorsResponse | null>(null);
  const [connectorsLoading, setConnectorsLoading] = useState(false);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);

  const refetchAssets = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch("/api/admin/reference-assets", {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        platforms: PlatformMeta[];
        assets: ReferenceAsset[];
      };
      setAssets(data.assets);
      setAssetPlatforms(data.platforms);
    } catch {
      /* keep previous state */
    }
  }, [token]);

  const refetchConnectors = useCallback(async () => {
    if (!token) return;
    setConnectorsLoading(true);
    setConnectorsError(null);
    try {
      const res = await fetch("/api/admin/connectors", {
        headers: { "x-admin-token": token },
      });
      if (!res.ok) {
        setConnectorsError("Couldn't load connector status. Try refreshing.");
        return;
      }
      const data = (await res.json()) as ConnectorsResponse;
      setConnectors(data);
    } catch {
      setConnectorsError("Couldn't load connector status. Try refreshing.");
    } finally {
      setConnectorsLoading(false);
    }
  }, [token]);

  const handleUpload = async (platform: string, file: File) => {
    if (!token) return;
    setUploading(platform);
    setUploadError(null);
    try {
      const dataUrl = await resizeImage(file, 1280);
      const res = await fetch("/api/admin/reference-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ platform, dataUrl }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setUploadError(d.error ?? "Upload failed.");
        return;
      }
      await refetchAssets();
    } catch {
      setUploadError("Couldn't process that image.");
    } finally {
      setUploading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!token) return;
    setAssets((prev) => prev?.filter((a) => a.id !== id) ?? prev);
    try {
      await fetch(`/api/admin/reference-assets/${id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
    } catch {
      void refetchAssets();
    }
  };

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

  useEffect(() => {
    if (phase === "ready" && token) {
      void refetchAssets();
      void refetchConnectors();
    }
  }, [phase, token, refetchAssets, refetchConnectors]);

  useEffect(() => {
    if (!assets || !token) return;
    if (!assets.some((a) => a.status === "analyzing")) return;
    const t = setTimeout(() => void refetchAssets(), 4000);
    return () => clearTimeout(t);
  }, [assets, token, refetchAssets]);

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

        <ConnectorsSection
          data={connectors}
          loading={connectorsLoading}
          error={connectorsError}
          onRefresh={() => void refetchConnectors()}
          token={token ?? ""}
        />

        <ReferenceExamples
          assets={assets}
          platforms={assetPlatforms}
          uploading={uploading}
          uploadError={uploadError}
          onUpload={handleUpload}
          onDelete={handleDelete}
        />

        <Section label="Creative strategy patterns">
          <div className="grid gap-6 [grid-template-columns:repeat(auto-fill,minmax(300px,1fr))] items-start">
            {library.adArchetypes.map((ad) => (
              <ArchetypeCard key={ad.id} ad={ad} placement={placementName(ad.surface)} />
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

function ConnectorsSection({
  data,
  loading,
  error,
  onRefresh,
  token,
}: {
  data: ConnectorsResponse | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  token: string;
}) {
  return (
    <Section label="Ad platform connectors">
      <div className="-mt-4 mb-8 flex items-start justify-between gap-6 flex-wrap">
        <p className="max-w-2xl font-sans text-sm text-muted-foreground leading-relaxed">
          The ad networks LaunchPad can publish to. Enter each platform's credentials below — they're
          encrypted before they're stored and never shown again — or set them as server secrets. A
          platform needs its credentials connected and{" "}
          <code className="bg-secondary px-1 rounded text-xs">ADS_MODE</code> set to{" "}
          <code className="bg-secondary px-1 rounded text-xs">live</code> before real campaigns run;
          otherwise everything stays in safe <code className="bg-secondary px-1 rounded text-xs">mock</code>{" "}
          simulation.
        </p>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="inline-flex items-center gap-1.5 font-sans text-sm rounded-full px-4 py-2 border border-border hover:bg-secondary disabled:opacity-50 transition-colors flex-shrink-0"
        >
          <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
          Refresh status
        </button>
      </div>

      {data && (
        <div className="mb-8 inline-flex items-center gap-2 font-sans text-xs text-muted-foreground bg-secondary/60 border border-border/60 rounded-full px-3.5 py-1.5">
          <span className="opacity-50 uppercase tracking-[1.5px] text-[10px]">Publishing mode</span>
          <code className="font-mono text-foreground/80">ADS_MODE={data.adsMode}</code>
        </div>
      )}

      {error && (
        <div className="mb-6 font-sans text-sm text-red-700 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
          {error}
        </div>
      )}

      {data === null ? (
        error ? null : (
          <div className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading connectors…
          </div>
        )
      ) : (
        <div className="grid gap-6 md:grid-cols-2 items-start">
          {data.connectors.map((c) => (
            <ConnectorCard key={c.id} c={c} token={token} onChanged={onRefresh} />
          ))}
        </div>
      )}
    </Section>
  );
}

function StatusBadge({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "flex-shrink-0 inline-flex items-center gap-1.5 text-[11px] font-sans rounded-full px-2.5 py-1 border",
        connected
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
          : "bg-secondary text-muted-foreground border-border/60",
      )}
    >
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full",
          connected ? "bg-emerald-500" : "bg-muted-foreground/40",
        )}
      />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function SecretChip({ name, present }: { name: string; present: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full border",
        present
          ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/30"
          : "bg-secondary text-muted-foreground border-border/60",
      )}
    >
      {present ? (
        <Check className="w-3 h-3" />
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
      )}
      {name}
    </span>
  );
}

function ConnectorCard({
  c,
  token,
  onChanged,
}: {
  c: ConnectorStatus;
  token: string;
  onChanged: () => void;
}) {
  const required = new Set(c.requiredSecretKeys);
  const missing = new Set(c.missingKeys);
  const optionalPresent = new Set(c.optionalPresentKeys);
  const stored = new Set(c.storedKeys);
  const allKeys = [...c.requiredSecretKeys, ...c.optionalSecretKeys];

  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Show the entry form when the platform isn't connected yet, or when the
  // operator chose to edit a connected one.
  const showForm = editing || !c.connected;
  const storedHere = c.source === "stored";

  const present = (k: string): boolean =>
    required.has(k) ? !missing.has(k) : optionalPresent.has(k);

  const placeholderFor = (k: string): string =>
    stored.has(k)
      ? "Saved — leave blank to keep"
      : present(k)
        ? "Set via server environment"
        : "Enter value";

  const setField = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));

  const save = async () => {
    const payload: Record<string, string> = {};
    for (const k of allKeys) {
      const v = values[k];
      if (typeof v === "string" && v.trim()) payload[k] = v.trim();
    }
    if (Object.keys(payload).length === 0) {
      setErr("Enter at least one value to save.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/connectors/${c.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify({ values: payload }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(d.error ?? "Couldn't save credentials.");
        return;
      }
      setValues({});
      setEditing(false);
      onChanged();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const disconnect = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/connectors/${c.id}`, {
        method: "DELETE",
        headers: { "x-admin-token": token },
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(d.error ?? "Couldn't disconnect.");
        return;
      }
      setValues({});
      setEditing(false);
      onChanged();
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="bg-card border border-border rounded-2xl p-6 flex flex-col h-full">
      <div className="flex items-start justify-between gap-4 mb-2">
        <h4 className="font-serif text-2xl leading-tight flex items-center gap-2">
          <Plug className="w-4 h-4 opacity-40" />
          {c.label}
        </h4>
        <StatusBadge connected={c.connected} />
      </div>
      <p className="font-sans text-sm text-muted-foreground leading-relaxed mb-1">{c.blurb}</p>
      {c.note && (
        <p className="font-sans text-xs text-muted-foreground/70 leading-relaxed mb-3">{c.note}</p>
      )}

      {/* When connected, affirm and HIDE the setup instructions. */}
      {c.connected && (
        <div className="mt-2 mb-1 flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5">
          <Check className="w-4 h-4 mt-0.5 text-emerald-600 flex-shrink-0" />
          <p className="font-sans text-sm text-emerald-800 leading-relaxed">
            Connected and ready.{" "}
            {storedHere
              ? "Credentials are stored encrypted on the server."
              : "Using credentials from the server environment."}
          </p>
        </div>
      )}

      {/* Setup steps only show until the platform is connected. */}
      {!c.connected && (
        <>
          <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mt-3 mb-3">
            Setup
          </span>
          <ol className="flex flex-col gap-3 mb-5">
            {c.setupSteps.map((s, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-serif text-lg opacity-25 leading-none pt-0.5">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <p className="font-sans text-sm text-foreground/80 leading-relaxed">{s}</p>
              </li>
            ))}
          </ol>
        </>
      )}

      <div className="mt-auto pt-4 border-t border-border/60">
        <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mb-2">
          Required secrets
        </span>
        <div className="flex flex-wrap gap-1.5">
          {c.requiredSecretKeys.map((k) => (
            <SecretChip key={k} name={k} present={!missing.has(k)} />
          ))}
        </div>

        {c.optionalSecretKeys.length > 0 && (
          <>
            <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mt-4 mb-2">
              Optional
            </span>
            <div className="flex flex-wrap gap-1.5">
              {c.optionalSecretKeys.map((k) => (
                <SecretChip key={k} name={k} present={optionalPresent.has(k)} />
              ))}
            </div>
          </>
        )}

        {showForm ? (
          <div className="mt-5 flex flex-col gap-2.5">
            {allKeys.map((k) => (
              <label key={k} className="flex flex-col gap-1">
                <span className="font-mono text-[11px] text-foreground/70">
                  {k}
                  {!required.has(k) && (
                    <span className="text-muted-foreground/60"> (optional)</span>
                  )}
                </span>
                <input
                  type="password"
                  autoComplete="off"
                  spellCheck={false}
                  value={values[k] ?? ""}
                  onChange={(e) => setField(k, e.target.value)}
                  placeholder={placeholderFor(k)}
                  className="font-mono text-sm rounded-lg border border-border bg-background px-3 py-2 outline-none focus:border-foreground/40 transition-colors"
                />
              </label>
            ))}
            {err && <p className="font-sans text-xs text-red-700">{err}</p>}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 font-sans text-sm rounded-full px-4 py-2 bg-foreground text-background hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Saving…" : "Save credentials"}
              </button>
              {c.connected && (
                <button
                  onClick={() => {
                    setEditing(false);
                    setValues({});
                    setErr(null);
                  }}
                  className="font-sans text-sm rounded-full px-4 py-2 border border-border hover:bg-secondary transition-colors"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="font-sans text-[11px] text-muted-foreground/70 leading-relaxed">
              Values are encrypted before they're stored and never shown again. Saving does not
              enable live publishing — campaigns stay in mock mode until ADS_MODE is set to live.
            </p>
          </div>
        ) : (
          <div className="mt-5 flex items-center gap-2">
            <button
              onClick={() => setEditing(true)}
              className="font-sans text-sm rounded-full px-4 py-2 border border-border hover:bg-secondary transition-colors"
            >
              Edit credentials
            </button>
            {storedHere && (
              <button
                onClick={() => void disconnect()}
                disabled={busy}
                className="inline-flex items-center gap-1.5 font-sans text-sm rounded-full px-4 py-2 border border-red-500/30 text-red-700 hover:bg-red-500/10 disabled:opacity-50 transition-colors"
              >
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                Disconnect
              </button>
            )}
          </div>
        )}

        {err && !showForm && <p className="font-sans text-xs text-red-700 mt-2">{err}</p>}

        <a
          href={c.docsUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex items-center gap-1 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Setup docs <ExternalLink className="w-3 h-3" />
        </a>
      </div>
    </article>
  );
}

function ArchetypeCard({ ad, placement }: { ad: ReferenceArchetype; placement: string }) {
  return (
    <article className="bg-card border border-border rounded-2xl p-6 flex flex-col h-full">
      <div className="text-[11px] font-sans uppercase tracking-[1.5px] opacity-40">
        {placement} · {ad.angle}
      </div>
      <h4 className="font-serif text-2xl mt-1.5 mb-4">{ad.title}</h4>
      <div className="flex flex-col gap-3">
        <ArchLine label="Hook" value={ad.hookPattern} />
        <ArchLine label="Body" value={ad.bodyPattern} />
        <ArchLine label="CTA" value={ad.ctaPattern} />
        <ArchLine label="Imagery" value={ad.imageryStyle} />
      </div>
      <p className="font-sans text-xs text-muted-foreground leading-relaxed mt-4 pt-4 border-t border-border/60">
        <span className="opacity-50">Why it works</span> — {ad.whyItWorks}
      </p>
    </article>
  );
}

function ArchLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-[10px] font-sans uppercase tracking-[1.5px] opacity-40 mb-0.5">
        {label}
      </span>
      <span className="font-sans text-sm text-foreground/80 leading-snug">{value}</span>
    </div>
  );
}

function ReferenceExamples({
  assets,
  platforms,
  uploading,
  uploadError,
  onUpload,
  onDelete,
}: {
  assets: ReferenceAsset[] | null;
  platforms: PlatformMeta[];
  uploading: string | null;
  uploadError: string | null;
  onUpload: (platform: string, file: File) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Section label="Real reference examples">
      <p className="-mt-4 mb-10 max-w-2xl font-sans text-sm text-muted-foreground leading-relaxed">
        Real, best-in-class ads — curated from the web and uploaded by you. Each one is
        vision-analysed and indexed into the reference corpus that shapes every generation. Add your
        own to any platform.
      </p>
      {assets === null ? (
        <div className="flex items-center gap-2 font-sans text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading examples…
        </div>
      ) : (
        <div className="flex flex-col gap-16">
          {platforms.map((p) => {
            const items = assets.filter((a) => a.platform === p.slug);
            return (
              <div key={p.slug}>
                <div className="flex items-center justify-between gap-4 mb-6">
                  <h3 className="font-serif text-3xl flex items-baseline gap-2.5">
                    {p.label}
                    <span className="font-sans text-sm text-muted-foreground">{items.length}</span>
                  </h3>
                  <UploadButton
                    platform={p.slug}
                    uploading={uploading === p.slug}
                    onUpload={onUpload}
                  />
                </div>
                {items.length === 0 ? (
                  <p className="font-sans text-sm text-muted-foreground">
                    No examples yet — add the first one.
                  </p>
                ) : (
                  <div className="grid gap-x-6 gap-y-10 [grid-template-columns:repeat(auto-fill,minmax(220px,1fr))] items-start">
                    {items.map((a) => (
                      <AssetCard key={a.id} asset={a} onDelete={onDelete} />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {uploadError && <p className="mt-5 font-sans text-sm text-red-500">{uploadError}</p>}
    </Section>
  );
}

function UploadButton({
  platform,
  uploading,
  onUpload,
}: {
  platform: string;
  uploading: boolean;
  onUpload: (platform: string, file: File) => void;
}) {
  return (
    <label
      className={`inline-flex items-center gap-1.5 font-sans text-sm rounded-full px-4 py-2 transition-opacity ${
        uploading
          ? "bg-secondary text-muted-foreground cursor-wait"
          : "bg-foreground text-background hover:opacity-90 cursor-pointer"
      }`}
    >
      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
      {uploading ? "Uploading…" : "Add example"}
      <input
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUpload(platform, f);
          e.target.value = "";
        }}
      />
    </label>
  );
}

function AssetCard({ asset, onDelete }: { asset: ReferenceAsset; onDelete: (id: string) => void }) {
  const a = asset;
  return (
    <figure className="group flex flex-col">
      <div className="relative rounded-xl overflow-hidden border border-border bg-secondary/40">
        <img
          src={a.imageUrl}
          alt={a.title ?? "Ad reference"}
          loading="lazy"
          className="w-full h-auto block"
        />
        {a.status === "analyzing" && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-[11px] font-sans uppercase tracking-wide text-muted-foreground">
              Indexing…
            </span>
          </div>
        )}
        {a.status === "failed" && (
          <div className="absolute top-2 left-2 text-[10px] font-sans bg-red-500/90 text-white rounded-full px-2 py-0.5">
            Analysis failed
          </div>
        )}
        <button
          onClick={() => onDelete(a.id)}
          title="Remove"
          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <figcaption className="mt-3">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] font-sans uppercase tracking-[1.5px] opacity-40">
            {a.source === "curated" ? "Curated" : "Uploaded"}
          </span>
          {a.sourceUrl && (
            <a
              href={a.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-sans text-muted-foreground hover:text-foreground inline-flex items-center gap-0.5"
            >
              source <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        {a.title && <h4 className="font-serif text-lg leading-snug mt-1">{a.title}</h4>}
        {a.analysis && (
          <div className="mt-2 space-y-1.5">
            <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
              <span className="opacity-50">Angle</span> — {a.analysis.angle}
            </p>
            <p className="text-[11px] font-sans text-muted-foreground leading-relaxed">
              <span className="opacity-50">Why</span> — {a.analysis.whyItWorks}
            </p>
            {a.analysis.visualTokens?.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {a.analysis.visualTokens.slice(0, 4).map((t, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-sans px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60"
                  >
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}
      </figcaption>
    </figure>
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
