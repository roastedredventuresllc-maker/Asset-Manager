import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import {
  useGenerateCampaign,
  useGetCampaignStatus,
  useGetCampaign,
  useGetCampaignMetrics,
  useReviseCampaign,
  usePublishCampaign,
  usePauseCampaign,
  getGetCampaignStatusQueryKey,
  getGetCampaignQueryKey,
  getGetCampaignMetricsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { resizeImage } from "@/lib/image-upload";
import { Paperclip, Send, ArrowRight, ArrowLeft, CheckCircle2, X, MessageSquarePlus } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { InSituAd } from "@/components/ad-mockups";

export default function Home() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const successUrlParam = searchParams.get("success");
  const urlCampaignId = searchParams.get("campaignId");

  const [campaignId, setCampaignId] = useState<string | null>(
    urlCampaignId || localStorage.getItem("launchpad_campaign_id")
  );

  useEffect(() => {
    if (campaignId) {
      localStorage.setItem("launchpad_campaign_id", campaignId);
    } else {
      localStorage.removeItem("launchpad_campaign_id");
    }
  }, [campaignId]);

  if (successUrlParam === "true" && campaignId) {
    return <LiveState campaignId={campaignId} setCampaignId={setCampaignId} />;
  }

  if (!campaignId) {
    return <InputState setCampaignId={setCampaignId} />;
  }

  return <ActiveCampaignRouter campaignId={campaignId} setCampaignId={setCampaignId} />;
}

function ActiveCampaignRouter({ campaignId, setCampaignId }: { campaignId: string, setCampaignId: (id: string | null) => void }) {
  const { data: statusRes } = useGetCampaignStatus(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignStatusQueryKey(campaignId),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        // The campaign flips to "ready" before the ad images finish (they are
        // generated as background jobs after the copy is ready). Keep polling
        // while generating OR while any asset is still pending/processing, so
        // the UI swaps the shimmer for the real images instead of freezing.
        const assetsPending = (data.adAssets ?? []).some(
          (a) => a.status !== "done" && a.status !== "failed",
        );
        if (data.status === "generating" || data.status === "publishing") return 2000;
        if (assetsPending) return 2000;
        return false;
      },
    },
  });

  if (!statusRes) return <WorkingState />;

  if (statusRes.status === "generating") {
    return <WorkingState />;
  }

  if (statusRes.status === "error") {
    return <ErrorState setCampaignId={setCampaignId} />;
  }

  if (statusRes.status === "live" || statusRes.status === "paused") {
    return <LiveState campaignId={campaignId} setCampaignId={setCampaignId} />;
  }

  // Ready or Draft or Publishing
  return <BriefingState campaignId={campaignId} setCampaignId={setCampaignId} statusRes={statusRes} />;
}

function InputState({ setCampaignId }: { setCampaignId: (id: string) => void }) {
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const generateCampaign = useGenerateCampaign();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      const url = URL.createObjectURL(selected);
      setPreview(url);
    } else {
      setPreview(null);
    }
  };

  const removeFile = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async () => {
    if (!brief.trim()) { setError("Add a description first."); return; }
    setIsSubmitting(true);
    setError(null);
    let productImageUrl: string | null = null;

    try {
      if (file) {
        const dataUrl = await resizeImage(file, 1024);
        const res = await fetch("/api/uploads/product-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          productImageUrl = data.url;
        }
        // upload failure is non-fatal — we proceed without the image
      }

      generateCampaign.mutate(
        { data: { brief: brief.trim(), productImageUrl } },
        {
          onSuccess: (campaign) => setCampaignId(campaign.id),
          onError: () => {
            setError("Something went wrong. Try again.");
            setIsSubmitting(false);
          },
          onSettled: () => setIsSubmitting(false),
        }
      );
    } catch {
      setError("Something went wrong. Try again.");
      setIsSubmitting(false);
    }
  };

  const isPending = isSubmitting || generateCampaign.isPending;

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background relative">
      <header className="absolute top-0 left-0 right-0 flex justify-between items-center max-w-[1100px] mx-auto px-6 py-6 w-full">
        <span className="font-sans font-bold text-xl tracking-tighter">LP</span>
        <nav className="flex items-center gap-6">
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/admin`}
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Admin
          </a>
          <a
            href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/docs`}
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Developers
          </a>
        </nav>
      </header>
      <div className="max-w-[800px] w-full mx-auto flex flex-col items-center gap-12 animate-in fade-in duration-700">
        <h1 className="font-serif text-5xl md:text-7xl text-center text-foreground">
          What are you <span className="italic opacity-50">launching?</span>
        </h1>

        <div className="w-full flex flex-col gap-2">
          <div className="w-full bg-card rounded-2xl p-2 shadow-sm border border-border flex flex-col focus-within:ring-1 focus-within:ring-ring transition-all">
            <textarea
              value={brief}
              onChange={(e) => { setBrief(e.target.value); setError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              placeholder="Describe your product..."
              className="w-full min-h-[120px] resize-none bg-transparent outline-none p-4 text-lg font-sans placeholder:text-muted-foreground"
            />

            {preview && (
              <div className="px-4 pb-2">
                <div className="relative inline-flex items-center gap-2 bg-secondary rounded-xl pr-2 overflow-hidden">
                  <img src={preview} alt="Product" className="h-12 w-12 object-cover rounded-lg" />
                  <span className="font-sans text-xs text-muted-foreground max-w-[160px] truncate">{file?.name}</span>
                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1 hover:bg-border rounded-full transition-colors flex-shrink-0"
                  >
                    <X className="w-3 h-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-between items-center px-4 pb-2 pt-1">
              <label className="cursor-pointer p-2 hover:bg-secondary rounded-full transition-colors" title="Attach product image">
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                />
                <Paperclip className={`w-5 h-5 ${file ? "text-foreground" : "text-muted-foreground"}`} />
              </label>
              <button
                onClick={handleSubmit}
                disabled={isPending}
                className="bg-foreground text-background p-3 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>

          {error && (
            <p className="text-center font-sans text-sm text-red-500">{error}</p>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {["A fitness app for busy parents", "An AI writing tool", "A sustainable clothing brand", "A SaaS invoicing tool"].map((chip) => (
            <button
              key={chip}
              onClick={() => { setBrief(chip); setError(null); }}
              className="text-sm font-sans text-muted-foreground bg-secondary/50 hover:bg-secondary px-4 py-2 rounded-full transition-colors border border-border/50"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

const CAMPAIGN_STEPS = [
  "Interpreting your market & category",
  "Studying best-in-class 2026 ad campaigns",
  "Mapping your ideal audience & positioning",
  "Writing your channel strategy & budget split",
  "Crafting three ad concepts — hooks, copy & CTAs",
  "Art-directing your visuals & landing page",
];

function WorkingState() {
  // Time-driven narrative of what the engine is actually doing during the
  // ~10–15s "generating" phase. The progress rail intentionally holds just
  // short of full on the final step (and keeps a live shimmer) until the
  // backend leaves "generating" and the router unmounts this screen — we never
  // claim the work is done before it is.
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const total = CAMPAIGN_STEPS.length;

  useEffect(() => {
    const id = setInterval(() => {
      setActive((a) => Math.min(a + 1, total - 1));
    }, 2600);
    return () => clearInterval(id);
  }, [total]);

  const isLast = active >= total - 1;
  const pct = isLast ? 92 : Math.round(((active + 1) / total) * 100);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      {!reduce && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute w-[520px] h-[520px] rounded-full blur-3xl opacity-[0.07]"
          style={{
            background: "radial-gradient(circle at 50% 50%, rgba(17,17,17,1), transparent 65%)",
          }}
          animate={{ scale: [1, 1.18, 1], x: [0, 28, 0], y: [0, -22, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      <div className="relative z-10 w-full max-w-[560px] flex flex-col items-center">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.9 }}
          className="font-sans text-[11px] uppercase tracking-[3px] text-muted-foreground mb-10 flex items-center gap-2.5"
        >
          <motion.span
            className="w-1.5 h-1.5 rounded-full bg-foreground"
            animate={reduce ? undefined : { opacity: [1, 0.2, 1] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
          Building your campaign
        </motion.p>

        <div className="h-[124px] md:h-[136px] w-full flex items-center justify-center text-center mb-12">
          <AnimatePresence mode="wait">
            <motion.h2
              key={active}
              initial={{ opacity: 0, y: 16, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -16, filter: "blur(8px)" }}
              transition={{ duration: 0.7, ease: [0.2, 0.7, 0.2, 1] }}
              className="font-serif text-3xl md:text-[42px] leading-[1.12] max-w-[18ch]"
            >
              {CAMPAIGN_STEPS[active]}
            </motion.h2>
          </AnimatePresence>
        </div>

        <div className="w-full max-w-[340px]">
          <div className="relative h-[3px] w-full rounded-full bg-border overflow-hidden">
            <motion.div
              className="absolute left-0 top-0 h-full rounded-full bg-foreground overflow-hidden"
              initial={{ width: "0%" }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.1, ease: [0.2, 0.7, 0.2, 1] }}
            >
              {!reduce && (
                <motion.span
                  className="absolute inset-y-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
                  animate={{ x: ["-100%", "300%"] }}
                  transition={{ duration: 1.7, repeat: Infinity, ease: "easeInOut" }}
                />
              )}
            </motion.div>
          </div>
          <div className="mt-4 flex items-center justify-between font-sans text-[12px] text-muted-foreground tabular-nums">
            <span>
              {String(Math.min(active + 1, total)).padStart(2, "0")} / {String(total).padStart(2, "0")}
            </span>
            <span className="opacity-60">Just a few seconds…</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ErrorState({ setCampaignId }: { setCampaignId: (id: string | null) => void }) {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background animate-in fade-in duration-500">
      <p className="font-serif text-3xl mb-3">Something went wrong</p>
      <p className="font-sans text-muted-foreground text-sm mb-8 text-center max-w-xs">
        The AI couldn't generate your campaign. Make sure the server has a valid{" "}
        <code className="bg-secondary px-1 rounded text-xs">ANTHROPIC_API_KEY</code> and try again.
      </p>
      <button
        onClick={() => setCampaignId(null)}
        className="bg-foreground text-background px-6 py-3 rounded-full font-sans text-sm hover:opacity-90 transition-opacity"
      >
        Try again
      </button>
    </div>
  );
}

function FeedbackButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-full bg-background/80 backdrop-blur border border-border px-3 py-1.5 text-xs font-sans text-muted-foreground hover:text-foreground hover:border-foreground/40 shadow-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-border"
    >
      <MessageSquarePlus className="w-3.5 h-3.5" />
      {label}
    </button>
  );
}

function BriefingState({ campaignId, setCampaignId, statusRes }: { campaignId: string, setCampaignId: (id: string | null) => void, statusRes: any }) {
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [showLaunch, setShowLaunch] = useState(false);

  const { data: campaign } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId)
    }
  });

  const data = statusRes.campaignData || campaign?.campaignData;

  if (!data) return <WorkingState />;

  if (showLaunch) {
    return <LaunchPage campaignId={campaignId} data={data} onBack={() => setShowLaunch(false)} />;
  }

  const assetsGenerating = (statusRes.adAssets ?? []).some(
    (a: any) => a.status !== "done" && a.status !== "failed",
  );

  return (
    <div className="min-h-[100dvh] bg-background pb-32 animate-in fade-in duration-1000">
      <div className="p-6">
        <button 
          onClick={() => setCampaignId(null)}
          className="font-sans font-bold text-xl tracking-tighter hover:opacity-70 transition-opacity"
        >
          LP
        </button>
      </div>

      <div className="max-w-[1100px] mx-auto px-6">
        <div className="text-center mt-12 mb-6">
          <h1 className="font-serif text-7xl md:text-[88px] leading-none mb-4">{data.brandName}</h1>
          <p className="font-serif italic text-2xl text-muted-foreground">{data.tagline}</p>
        </div>
        <div className="flex justify-center mb-24">
          <FeedbackButton
            label="Tweak name or tagline"
            disabled={assetsGenerating}
            onClick={() =>
              setRevisionTarget(
                `the brand name & tagline (currently "${data.brandName}" — "${data.tagline}")`,
              )
            }
          />
        </div>

        <div className="mb-24">
          <div className="flex items-baseline justify-between gap-4 mb-8">
            <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35">Three Ads</div>
            <div className="text-[11px] font-sans text-muted-foreground hidden sm:block">Previewed in-feed — switch platforms on each ad</div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-x-8 gap-y-14 items-start">
            {data.ads.map((ad: any, i: number) => {
              const asset = statusRes.adAssets?.find((a: any) => a.idx === i);
              const placement: "square" | "vertical" = i === 1 ? "vertical" : "square";
              return (
                <div key={i} className="flex flex-col gap-5">
                  <InSituAd
                    brandName={data.brandName}
                    hook={ad.hook}
                    body={ad.body}
                    cta={ad.cta}
                    accent={(data.palette && data.palette[0]) || ad.gradientHex1}
                    imageUrl={asset?.imageUrl}
                    status={asset?.status}
                    placement={placement}
                  />
                  <div className="text-center">
                    <div className="text-[11px] font-sans uppercase tracking-[1px] opacity-50 mb-2">{ad.angle}</div>
                    <FeedbackButton
                      label="Edit this ad"
                      disabled={assetsGenerating}
                      onClick={() =>
                        setRevisionTarget(`Ad ${i + 1} — the "${ad.angle}" angle (hook: "${ad.hook}")`)
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-24">
          <div className="flex items-center justify-between mb-8">
            <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35">Landing Page</div>
            <FeedbackButton
              label="Edit landing page"
              disabled={assetsGenerating}
              onClick={() => setRevisionTarget("the landing page")}
            />
          </div>
          <div className="w-full h-[600px] rounded-2xl overflow-hidden border border-border shadow-sm">
            {campaign?.landingSlug ? (
               <iframe src={`/p/${campaign.landingSlug}`} className="w-full h-full border-none" />
            ) : (
               <div className="w-full h-full bg-secondary flex items-center justify-center text-muted-foreground font-sans text-sm">Building page...</div>
            )}
          </div>
        </div>

        <div className="flex flex-col items-center gap-6">
          <button 
            onClick={() => setShowLaunch(true)}
            disabled={assetsGenerating}
            className="bg-foreground text-background px-8 py-4 rounded-full font-sans font-medium text-lg flex items-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {assetsGenerating ? "Finishing images…" : <>Continue to launch <ArrowRight className="w-5 h-5" /></>}
          </button>
          
          <button 
            onClick={() => setRevisionTarget("the overall campaign")}
            disabled={assetsGenerating}
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Something's off? Give overall feedback
          </button>
        </div>
      </div>

      <RevisionSheet
        open={!!revisionTarget}
        target={revisionTarget}
        assetsGenerating={assetsGenerating}
        onOpenChange={(o: boolean) => { if (!o) setRevisionTarget(null); }}
        campaignId={campaignId}
        campaign={campaign}
      />
    </div>
  );
}

function RevisionSheet({ open, onOpenChange, campaignId, campaign, target, assetsGenerating }: any) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<{role: "user" | "ai", content: string}[]>([]);
  const revise = useReviseCampaign();
  const queryClient = useQueryClient();

  // Start a fresh thread whenever the user opens feedback on a different asset.
  useEffect(() => { setMessages([]); setMsg(""); }, [target]);

  const isTargeted = !!target && target !== "the overall campaign";

  const handleSend = () => {
    if (!msg.trim()) return;
    const userText = msg.trim();
    setMessages(prev => [...prev, { role: "user", content: userText }]);
    const request = isTargeted ? `Regarding ${target}: ${userText}` : userText;
    revise.mutate({ id: campaignId, data: { request } }, {
      onSuccess: () => {
        // Visual revisions reset the ad images to pending on the server, so
        // invalidate to resume polling and stream the new images in.
        queryClient.invalidateQueries({ queryKey: getGetCampaignStatusQueryKey(campaignId) });
        queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
        setMessages(prev => [...prev, { role: "ai", content: "Got it — I've updated the campaign. Close this to watch the changes apply." }]);
      },
      onError: () => {
        setMessages(prev => [...prev, { role: "ai", content: "That didn't go through. Try rephrasing your request." }]);
      }
    });
    setMsg("");
  };

  const isLimited = campaign?.revisionsUsed >= campaign?.revisionsAllowed && campaign?.status === 'draft';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[65vh] rounded-t-3xl border-none shadow-2xl flex flex-col p-0 bg-background">
        <SheetHeader className="p-6 pb-2 border-b border-border/50">
          <SheetTitle className="font-serif text-3xl">{isTargeted ? "Edit this" : "What's off?"}</SheetTitle>
          {isTargeted && (
            <p className="font-sans text-sm text-muted-foreground mt-1">Feedback on {target}</p>
          )}
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4">
          <div className="bg-card shadow-sm border border-border rounded-2xl p-4 self-start max-w-[80%] font-sans text-sm">
            I can adjust angles, rewrite copy, change the color palette, or regenerate images. What should we tweak?
          </div>
          
          {messages.map((m, i) => (
            <div key={i} className={`rounded-2xl p-4 max-w-[80%] font-sans text-sm ${
              m.role === "user" 
                ? "bg-foreground text-background self-end" 
                : "bg-card shadow-sm border border-border self-start"
            }`}>
              {m.content}
            </div>
          ))}

          {revise.isPending && (
            <div className="bg-card shadow-sm border border-border rounded-2xl p-4 self-start flex gap-1 items-center h-[52px]">
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-[bounce_1.4s_infinite_-.32s]" />
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-[bounce_1.4s_infinite_-.16s]" />
              <div className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-[bounce_1.4s_infinite]" />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 bg-background/80 backdrop-blur">
          {isLimited ? (
             <div className="text-center font-sans text-sm text-muted-foreground py-4">
               Ship it to unlock unlimited revisions.
             </div>
          ) : (
            <div className="max-w-[800px] mx-auto">
              {assetsGenerating && (
                <div className="text-center font-sans text-xs text-muted-foreground mb-3">
                  Applying your last change — images are regenerating. One tweak at a time.
                </div>
              )}
              <div className="flex items-center gap-2">
                <input 
                  className="flex-1 bg-secondary rounded-full px-6 py-4 outline-none font-sans text-sm disabled:opacity-50"
                  placeholder="Make it edgier..."
                  value={msg}
                  disabled={assetsGenerating}
                  onChange={e => setMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                />
                <button 
                  onClick={handleSend}
                  disabled={!msg.trim() || revise.isPending || assetsGenerating}
                  className="bg-foreground text-background p-4 rounded-full disabled:opacity-50 transition-opacity"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function LaunchPage({ campaignId, data, onBack }: { campaignId: string; data: any; onBack: () => void }) {
  const [budget, setBudget] = useState(data.recommendedBudgetPreset === 'scale' ? 20000 : data.recommendedBudgetPreset === 'starter' ? 2500 : 7500);
  const [metaPct, setMetaPct] = useState(data.channelSplit?.metaPct || 50);
  const [showAdjust, setShowAdjust] = useState(false);
  const publish = usePublishCampaign();

  const handleShip = () => {
    publish.mutate({ 
      id: campaignId, 
      data: { 
        dailyBudgetCents: budget, 
        metaSharePct: metaPct, 
        tiktokSharePct: 100 - metaPct,
        successUrl: window.location.origin + "/?success=true&campaignId=" + campaignId
      }
    }, {
      onSuccess: (res) => {
        window.location.href = res.checkoutUrl;
      }
    });
  };

  return (
    <div className="min-h-[100dvh] bg-background animate-in fade-in duration-700">
      <div className="max-w-[800px] mx-auto px-6 pt-6">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to review
        </button>
      </div>
      <div className="max-w-[800px] mx-auto px-6 pb-24 pt-8">
        <h2 className="font-serif text-5xl md:text-6xl mb-3 text-center">Ship {data.brandName}</h2>
        <p className="font-serif italic text-xl text-muted-foreground text-center mb-12">Choose a budget and where it runs.</p>
        
        <div className="mb-10">
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-6 text-center">Daily Budget</div>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { val: 2500, label: "Starter", desc: "~2,000–5,000 daily reach" },
              { val: 7500, label: "Growth", desc: "~8,000–15,000 daily reach", recommended: true },
              { val: 20000, label: "Scale", desc: "~25,000–50,000 daily reach" }
            ].map(tier => (
              <button 
                key={tier.val}
                onClick={() => setBudget(tier.val)}
                className={`flex flex-col items-center justify-center p-6 rounded-2xl border transition-all ${
                  budget === tier.val ? "border-foreground bg-foreground text-background" : "border-border bg-card text-foreground hover:border-foreground/30"
                }`}
              >
                {tier.recommended && <div className="text-[10px] uppercase tracking-wider opacity-70 mb-2">Recommended</div>}
                <div className="font-serif text-3xl mb-1">${tier.val / 100}</div>
                <div className={`text-xs font-sans text-center ${budget === tier.val ? 'opacity-80' : 'text-muted-foreground'}`}>{tier.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-12">
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-6 text-center">Channels</div>
          <div className="text-center font-sans text-sm mb-4">
            Running {metaPct}% Meta · {100 - metaPct}% TikTok — picked for your audience
            {!showAdjust && <button onClick={() => setShowAdjust(true)} className="ml-2 text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border">Adjust</button>}
          </div>
          {showAdjust && (
            <div className="px-12 py-4">
              <Slider 
                value={[metaPct]} 
                onValueChange={(v) => setMetaPct(v[0])} 
                max={100} 
                step={5} 
                className="w-full"
              />
              <div className="flex justify-between mt-2 text-xs font-sans text-muted-foreground">
                <span>Meta</span>
                <span>TikTok</span>
              </div>
            </div>
          )}
        </div>

        <div className="text-center font-sans text-xs text-muted-foreground mb-8 max-w-[400px] mx-auto leading-relaxed">
          Your ad budget + 10% service fee · $29/mo minimum · includes hosting, image generation, unlimited revisions · pause anytime.
        </div>

        <button 
          onClick={handleShip}
          disabled={publish.isPending}
          className="w-full bg-foreground text-background py-5 rounded-full font-sans font-medium text-lg flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {publish.isPending ? "Preparing..." : `Ship ${data.brandName}`} <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function LiveState({ campaignId, setCampaignId }: { campaignId: string, setCampaignId: (id: string | null) => void }) {
  const { data: campaign } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId)
    }
  });

  const { data: metrics } = useGetCampaignMetrics(campaignId, {
    query: {
      enabled: !!campaignId && campaign?.status === 'live',
      queryKey: getGetCampaignMetricsQueryKey(campaignId),
      refetchInterval: 30000
    }
  });

  const pause = usePauseCampaign();
  const data = campaign?.campaignData;

  if (!campaign || !data) return <WorkingState />;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000">
      <div className="flex items-center justify-center w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full mb-8">
        <CheckCircle2 className="w-10 h-10" />
      </div>
      
      <h1 className="font-serif text-5xl md:text-7xl mb-6 text-center">{data.brandName} is live.</h1>
      
      <a href={`/p/${campaign.landingSlug}`} target="_blank" className="font-sans text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-border transition-colors mb-16">
        launchpad.com/p/{campaign.landingSlug}
      </a>

      <div className="grid grid-cols-3 gap-12 mb-20 text-center">
        <div>
          <div className="font-serif text-4xl mb-2">{metrics?.impressions?.toLocaleString() || "0"}</div>
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35">Impressions</div>
        </div>
        <div>
          <div className="font-serif text-4xl mb-2">{metrics?.clicks?.toLocaleString() || "0"}</div>
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35">Clicks</div>
        </div>
        <div>
          <div className="font-serif text-4xl mb-2">${((metrics?.spendCents || 0) / 100).toFixed(2)}</div>
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35">Spend Today</div>
        </div>
      </div>

      <div className="flex items-center gap-8">
        <button 
          onClick={() => pause.mutate({ id: campaignId })}
          disabled={pause.isPending || campaign.status === 'paused'}
          className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          {campaign.status === 'paused' ? 'Paused' : 'Pause campaign'}
        </button>
        <button 
          onClick={() => setCampaignId(null)}
          className="font-sans text-sm font-medium flex items-center gap-1 hover:opacity-70 transition-opacity"
        >
          Launch another <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
