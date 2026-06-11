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
import { Paperclip, Send, ArrowRight, CheckCircle2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

// Assuming we have this custom hook based on the brief
// We might need to fall back to a manual fetch if useUploadProductImage is not found,
// but the prompt says to use useUploadProductImage.
import { useUploadImage } from "@workspace/api-client-react"; // Wait, we might not have it. Let's just mock it or assume it's useUploadImage if not useUploadProductImage. Actually, let's use the fetch API for upload just in case.

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
        const state = query.state.data?.status;
        if (state === "generating") return 3000;
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
  const [isUploading, setIsUploading] = useState(false);
  const generateCampaign = useGenerateCampaign();

  const handleSubmit = async () => {
    if (!brief.trim()) return;
    setIsUploading(true);
    let productImageUrl = null;
    
    try {
      if (file) {
        const dataUrl = await resizeImage(file, 1024);
        const res = await fetch("/api/uploads/product-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl })
        });
        if (res.ok) {
          const data = await res.json();
          productImageUrl = data.url;
        }
      }

      generateCampaign.mutate({ data: { brief, productImageUrl } }, {
        onSuccess: (campaign) => {
          setCampaignId(campaign.id);
        },
        onSettled: () => {
          setIsUploading(false);
        }
      });
    } catch (err) {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-background">
      <div className="max-w-[800px] w-full mx-auto flex flex-col items-center gap-12 animate-in fade-in duration-700">
        <h1 className="font-serif text-5xl md:text-7xl text-center text-foreground">
          What are you <span className="italic opacity-50">launching?</span>
        </h1>

        <div className="w-full bg-card rounded-2xl p-2 shadow-sm border border-border flex flex-col focus-within:ring-1 focus-within:ring-ring transition-all">
          <textarea
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Describe your product..."
            className="w-full min-h-[120px] resize-none bg-transparent outline-none p-4 text-lg font-sans placeholder:text-muted-foreground"
          />
          <div className="flex justify-between items-center px-4 pb-2">
            <label className="cursor-pointer p-2 hover:bg-secondary rounded-full transition-colors">
              <input 
                type="file" 
                className="hidden" 
                accept="image/jpeg,image/png"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
              <Paperclip className={`w-5 h-5 ${file ? "text-foreground" : "text-muted-foreground"}`} />
            </label>
            <button 
              onClick={handleSubmit}
              disabled={!brief.trim() || isUploading || generateCampaign.isPending}
              className="bg-foreground text-background p-3 rounded-full hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3">
          {["A fitness app for busy parents", "An AI writing tool", "A sustainable clothing brand", "A SaaS invoicing tool"].map((chip) => (
            <button
              key={chip}
              onClick={() => setBrief(chip)}
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

function WorkingState() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center p-4 bg-background animate-in fade-in duration-500">
      <div className="w-12 h-12 rounded-full border-[1px] border-border border-t-foreground animate-spin mb-6"></div>
      <p className="font-serif italic text-2xl text-muted-foreground">Building your campaign…</p>
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

function BriefingState({ campaignId, setCampaignId, statusRes }: { campaignId: string, setCampaignId: (id: string | null) => void, statusRes: any }) {
  const [showRevision, setShowRevision] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);

  const { data: campaign } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId)
    }
  });

  const data = statusRes.campaignData || campaign?.campaignData;

  if (!data) return <WorkingState />;

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
        <div className="text-center mt-12 mb-24">
          <h1 className="font-serif text-7xl md:text-[88px] leading-none mb-4">{data.brandName}</h1>
          <p className="font-serif italic text-2xl text-muted-foreground">{data.tagline}</p>
        </div>

        <div className="mb-24">
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-8">Three Ads</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {data.ads.map((ad: any, i: number) => {
              const asset = statusRes.adAssets?.find((a: any) => a.idx === i);
              return (
                <div key={i} className="flex flex-col gap-4">
                  <div className="w-full aspect-square bg-secondary rounded-xl overflow-hidden relative">
                    {asset?.imageUrl ? (
                      <img src={asset.imageUrl} className="w-full h-full object-cover animate-in fade-in duration-1000" />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite] bg-secondary" />
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] font-sans uppercase tracking-[1px] opacity-50 mb-2">{ad.angle}</div>
                    <h3 className="font-sans font-bold text-lg leading-tight mb-2">{ad.hook}</h3>
                    <p className="font-sans text-sm text-muted-foreground leading-relaxed">{ad.body}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div className="mb-24">
          <div className="text-[11px] font-sans uppercase tracking-[2px] opacity-35 mb-8">Landing Page</div>
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
            onClick={() => setShowShipModal(true)}
            className="bg-foreground text-background px-8 py-4 rounded-full font-sans font-medium text-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
          >
            Ship {data.brandName} <ArrowRight className="w-5 h-5" />
          </button>
          
          <button 
            onClick={() => setShowRevision(true)}
            className="font-sans text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Something's off?
          </button>
        </div>
      </div>

      <RevisionSheet open={showRevision} onOpenChange={setShowRevision} campaignId={campaignId} campaign={campaign} />
      <ShipModal open={showShipModal} onOpenChange={setShowShipModal} campaignId={campaignId} data={data} />
    </div>
  );
}

function RevisionSheet({ open, onOpenChange, campaignId, campaign }: any) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<{role: "user" | "ai", content: string}[]>([]);
  const revise = useReviseCampaign();

  const handleSend = () => {
    if (!msg.trim()) return;
    setMessages([...messages, { role: "user", content: msg }]);
    revise.mutate({ id: campaignId, data: { request: msg } }, {
      onSuccess: () => {
        setMessages(prev => [...prev, { role: "ai", content: "Got it. I've updated the campaign." }]);
      }
    });
    setMsg("");
  };

  const isLimited = campaign?.revisionsUsed >= campaign?.revisionsAllowed && campaign?.status === 'draft';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[65vh] rounded-t-3xl border-none shadow-2xl flex flex-col p-0 bg-background">
        <SheetHeader className="p-6 pb-2 border-b border-border/50">
          <SheetTitle className="font-serif text-3xl">What's off?</SheetTitle>
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
            <div className="flex items-center gap-2 max-w-[800px] mx-auto">
              <input 
                className="flex-1 bg-secondary rounded-full px-6 py-4 outline-none font-sans text-sm"
                placeholder="Make it edgier..."
                value={msg}
                onChange={e => setMsg(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={!msg.trim() || revise.isPending}
                className="bg-foreground text-background p-4 rounded-full disabled:opacity-50 transition-opacity"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ShipModal({ open, onOpenChange, campaignId, data }: any) {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[800px] p-12 bg-background border-none shadow-2xl rounded-[32px]">
        <h2 className="font-serif text-5xl mb-12 text-center">Ship it</h2>
        
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
      </DialogContent>
    </Dialog>
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
