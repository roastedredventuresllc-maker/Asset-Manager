import { useState, useEffect, useRef } from "react";
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
import { ArrowRight, ArrowLeft } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CampaignFamily } from "@/components/campaign-board";

const POST_CHECKOUT_KEY = "launchpad_post_checkout";
/** Hang safety only. Production copy-first generate returns 201 in ~100–160s; 55s was a false fail. */
const GENERATE_TIMEOUT_MS = 270_000;

/** Sequential desks an agency runs before it presents. Hold the last step until copy is ready. */
const AGENCY_STEPS = [
  { desk: "Research", line: "The market and the category." },
  { desk: "Brief", line: "Who it’s for, and the position." },
  { desk: "Copy", line: "Hooks, body, and the landing." },
  { desk: "Creative", line: "Three boards. One family." },
  { desk: "Media", line: "Then we present the briefing." },
] as const;

export default function Home() {
  const searchParams = new URLSearchParams(window.location.search);
  const successUrlParam = searchParams.get("success");
  const urlCampaignId = searchParams.get("campaignId");

  const [campaignId, setCampaignIdState] = useState<string | null>(
    urlCampaignId || localStorage.getItem("launchpad_campaign_id"),
  );

  const [postCheckout, setPostCheckout] = useState(() => {
    if (successUrlParam === "true") return true;
    const stored = localStorage.getItem(POST_CHECKOUT_KEY);
    const id = urlCampaignId || localStorage.getItem("launchpad_campaign_id");
    return !!id && stored === id;
  });

  useEffect(() => {
    if (campaignId) {
      localStorage.setItem("launchpad_campaign_id", campaignId);
    } else {
      localStorage.removeItem("launchpad_campaign_id");
      localStorage.removeItem(POST_CHECKOUT_KEY);
    }
  }, [campaignId]);

  useEffect(() => {
    if (successUrlParam === "true" && campaignId) {
      localStorage.setItem(POST_CHECKOUT_KEY, campaignId);
      setPostCheckout(true);
    }
  }, [successUrlParam, campaignId]);

  const setCampaignId = (id: string | null) => {
    if (!id) {
      localStorage.removeItem(POST_CHECKOUT_KEY);
      setPostCheckout(false);
    }
    setCampaignIdState(id);
  };

  if (!campaignId) {
    return <InputState setCampaignId={setCampaignId} />;
  }

  return (
    <ActiveCampaignRouter
      campaignId={campaignId}
      setCampaignId={setCampaignId}
      postCheckout={postCheckout || successUrlParam === "true"}
    />
  );
}

function ActiveCampaignRouter({
  campaignId,
  setCampaignId,
  postCheckout,
}: {
  campaignId: string;
  setCampaignId: (id: string | null) => void;
  postCheckout?: boolean;
}) {
  const { data: statusRes } = useGetCampaignStatus(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignStatusQueryKey(campaignId),
      refetchInterval: (query) => {
        const data = query.state.data;
        if (!data) return 2000;
        const assetsPending = (data.adAssets ?? []).some(
          (a) => a.status !== "done" && a.status !== "failed",
        );
        if (data.status === "generating" || data.status === "publishing") return 2000;
        if (assetsPending) return 2000;
        if (postCheckout && data.status === "ready") return 2000;
        if (data.status === "in_review") return 15000;
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

  if (statusRes.status === "in_review") {
    return <ReviewState setCampaignId={setCampaignId} />;
  }

  if (statusRes.status === "publishing") {
    return <ReviewState setCampaignId={setCampaignId} />;
  }

  if (postCheckout && statusRes.status === "ready") {
    return <ReviewState setCampaignId={setCampaignId} />;
  }

  if (statusRes.status === "rejected") {
    return (
      <RejectedState
        reason={statusRes.rejectionReason ?? null}
        setCampaignId={setCampaignId}
      />
    );
  }

  if (statusRes.status === "live" || statusRes.status === "paused") {
    return <LiveState campaignId={campaignId} setCampaignId={setCampaignId} />;
  }

  return (
    <BriefingState
      campaignId={campaignId}
      setCampaignId={setCampaignId}
      statusRes={statusRes}
    />
  );
}

function Mark({ onClick }: { onClick?: () => void }) {
  const className = "font-serif italic text-[17px] text-[#ede6dc]/70 hover:text-[#ede6dc] transition-colors";
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        LaunchPad
      </button>
    );
  }
  return <span className={className}>LaunchPad</span>;
}

function InputState({ setCampaignId }: { setCampaignId: (id: string) => void }) {
  const [brief, setBrief] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const genRef = useRef(0);
  const generateCampaign = useGenerateCampaign();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    if (selected) {
      setPreview(URL.createObjectURL(selected));
    } else {
      setPreview(null);
    }
  };

  const handleSubmit = async () => {
    if (!brief.trim()) {
      setError("Say what you sell.");
      return;
    }
    const gen = ++genRef.current;
    setWorking(true);
    setError(null);
    let productImageUrl: string | null = null;
    let productImageNoBgUrl: string | null = null;

    // Wait on mutateAsync. This timer is not a generate SLA — it only
    // unsticks WorkingState if the request never settles (4.5 min hang).
    const timeout = window.setTimeout(() => {
      if (genRef.current !== gen) return;
      setError("It took too long. Nothing presented. Try again.");
      setWorking(false);
    }, GENERATE_TIMEOUT_MS);

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
          productImageNoBgUrl = data.noBgUrl ?? null;
        }
      }

      const campaign = await generateCampaign.mutateAsync({
        data: { brief: brief.trim(), productImageUrl, productImageNoBgUrl },
      });
      window.clearTimeout(timeout);
      if (genRef.current !== gen) return;
      setCampaignId(campaign.id);
    } catch {
      window.clearTimeout(timeout);
      if (genRef.current !== gen) return;
      setError("We couldn’t write it. Try again.");
      setWorking(false);
    }
  };

  if (working) return <WorkingState />;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24">
        <div className="max-w-[42rem]">
          <h1 className="font-serif text-[clamp(2.75rem,8vw,5.5rem)] leading-[0.95] text-foreground">
            What do you sell.
          </h1>
          <textarea
            value={brief}
            onChange={(e) => {
              setBrief(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSubmit();
              }
            }}
            placeholder="The product, who it’s for, why it exists."
            className="mt-10 w-full min-h-[7.5rem] resize-none bg-transparent border-0 rounded-none outline-none px-0 py-0 font-serif text-[1.35rem] md:text-[1.65rem] leading-snug placeholder:text-[#ede6dc]/28"
            autoFocus
          />
          <div className="mt-8 flex flex-wrap items-baseline gap-x-8 gap-y-3">
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
            />
            {preview ? (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="flex items-center gap-3 font-serif italic text-[15px] text-[#b9aea0]"
              >
                <img src={preview} alt="" className="h-9 w-9 object-cover" />
                Take the photo off
              </button>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="font-serif italic text-[15px] text-[#6e675e] hover:text-[#ede6dc] transition-colors"
              >
                A photo of it, if you have one
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleSubmit()}
              className="font-serif text-[18px] text-foreground hover:opacity-70 disabled:opacity-40 transition-opacity"
            >
              Write it →
            </button>
          </div>
          {error && (
            <p className="mt-6 font-serif text-[15px] text-[#c4a090]">{error}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function WorkingState() {
  const [active, setActive] = useState(0);
  const total = AGENCY_STEPS.length;

  useEffect(() => {
    const id = window.setInterval(() => {
      setActive((a) => Math.min(a + 1, total - 1));
    }, 2400);
    return () => window.clearInterval(id);
  }, [total]);

  const step = AGENCY_STEPS[active];

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24">
        <p className="font-serif italic text-[15px] tracking-wide text-[#6e675e]">
          {step.desk}
        </p>
        <h1
          key={step.desk}
          className="mt-5 font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[1.1] text-foreground max-w-[16ch]"
        >
          {step.line}
        </h1>
        <ol className="mt-16 flex flex-col gap-2 max-w-[20rem]">
          {AGENCY_STEPS.map((s, i) => (
            <li
              key={s.desk}
              className={`font-serif text-[15px] ${
                i === active
                  ? "text-foreground"
                  : i < active
                    ? "text-[#8a8176]"
                    : "text-[#6e675e]/45"
              }`}
            >
              {s.desk}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ErrorState({ setCampaignId }: { setCampaignId: (id: string | null) => void }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark onClick={() => setCampaignId(null)} />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24 max-w-[36rem]">
        <h1 className="font-serif text-[clamp(2.4rem,6vw,4rem)] leading-[1.05]">
          We couldn’t write it.
        </h1>
        <p className="mt-6 font-serif text-[1.15rem] text-[#b9aea0] leading-relaxed">
          The campaign didn’t come back. Nothing ran. Try again from the prompt.
        </p>
        <button
          type="button"
          onClick={() => setCampaignId(null)}
          className="mt-10 self-start font-serif text-[17px] border-b border-[#ede6dc]/40 pb-0.5 hover:border-[#ede6dc]"
        >
          Start over
        </button>
      </div>
    </div>
  );
}

function ReviewState({ setCampaignId }: { setCampaignId: (id: string | null) => void }) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark onClick={() => setCampaignId(null)} />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24 max-w-[36rem]">
        <h1 className="font-serif text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">
          In review.
        </h1>
        <p className="mt-6 font-serif text-[1.15rem] text-[#b9aea0] leading-relaxed">
          Paid. A person looks at the boards before anything goes live.
        </p>
        <button
          type="button"
          onClick={() => setCampaignId(null)}
          className="mt-12 self-start font-serif text-[17px] text-[#8a8176] hover:text-[#ede6dc]"
        >
          Another product
        </button>
      </div>
    </div>
  );
}

function RejectedState({
  reason,
  setCampaignId,
}: {
  reason: string | null;
  setCampaignId: (id: string | null) => void;
}) {
  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark onClick={() => setCampaignId(null)} />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24 max-w-[36rem]">
        <h1 className="font-serif text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02]">
          Not approved.
        </h1>
        <p className="mt-6 font-serif text-[1.15rem] text-[#b9aea0] leading-relaxed">
          It didn’t pass review. The ads were not published.
        </p>
        {reason ? (
          <p className="mt-8 font-serif text-[1.05rem] leading-relaxed text-[#ede6dc]/80">
            {reason}
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => setCampaignId(null)}
          className="mt-12 self-start font-serif text-[17px] border-b border-[#ede6dc]/40 pb-0.5"
        >
          Start over
        </button>
      </div>
    </div>
  );
}

function BriefingState({
  campaignId,
  setCampaignId,
  statusRes,
}: {
  campaignId: string;
  setCampaignId: (id: string | null) => void;
  statusRes: {
    campaignData?: {
      brandName?: string;
      tagline?: string;
      ads?: Array<{ hook?: string; body?: string; cta?: string; angle?: string }>;
      landing?: { hero?: string; sub?: string; cta?: string };
    } | null;
    adAssets?: Array<{ idx: number; imageUrl?: string | null; status?: string | null }>;
  };
}) {
  const [revisionTarget, setRevisionTarget] = useState<string | null>(null);
  const [showLaunch, setShowLaunch] = useState(false);
  const lastStillsKick = useRef(0);

  const { data: campaign } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
    },
  });

  const data = statusRes.campaignData || campaign?.campaignData;

  const assetsGenerating = (statusRes.adAssets ?? []).some(
    (a) => a.status !== "done" && a.status !== "failed",
  );

  useEffect(() => {
    if (!assetsGenerating) return;
    const now = Date.now();
    if (now - lastStillsKick.current < 45_000) return;
    lastStillsKick.current = now;
    void fetch(`/api/campaigns/${campaignId}/render-stills`, { method: "POST" }).catch(
      () => {},
    );
  }, [campaignId, assetsGenerating]);

  if (!data) return <WorkingState />;

  if (showLaunch) {
    return (
      <LaunchPage campaignId={campaignId} data={data} onBack={() => setShowLaunch(false)} />
    );
  }

  const assetsFailed = (statusRes.adAssets ?? []).some((a) => a.status === "failed");
  const ads = data.ads ?? [];
  const landing = data.landing;
  const openBoard = (target: string) => {
    if (assetsGenerating) return;
    setRevisionTarget(target);
  };

  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <div className="px-6 pt-8 md:px-10 flex items-baseline justify-between gap-4">
        <Mark onClick={() => setCampaignId(null)} />
        <button
          type="button"
          onClick={() => setRevisionTarget("the overall campaign")}
          disabled={assetsGenerating}
          className="font-serif italic text-[16px] text-[#6e675e] hover:text-[#ede6dc] disabled:opacity-40"
        >
          What’s off
        </button>
      </div>

      <div className="px-6 md:px-10 mt-14 mb-12 max-w-[80rem]">
        <button
          type="button"
          disabled={assetsGenerating}
          onClick={() =>
            openBoard(
              `the brand name & tagline (currently "${data.brandName}" — "${data.tagline}")`,
            )
          }
          className="text-left disabled:opacity-70"
        >
          <h1 className="font-serif text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.92] text-foreground">
            {data.brandName}
          </h1>
          <p className="mt-4 font-serif italic text-[clamp(1.2rem,2.4vw,1.75rem)] text-[#c4b8a8] max-w-[28ch]">
            {data.tagline}
          </p>
        </button>
      </div>

      {assetsFailed && (
        <p className="px-6 md:px-10 mb-10 font-serif text-[16px] text-[#c4a090] max-w-[36rem]">
          Generation failed. Photography did not come back. Copy is on the table; those frames are not ads.
        </p>
      )}

      {/* Art director's table: one family, three different prints — not a card gallery. */}
      <CampaignFamily
        boards={[0, 1, 2].map((idx) => {
          const ad = ads[idx];
          if (!ad) return null;
          const asset = statusRes.adAssets?.find((a) => a.idx === idx);
          const target =
            idx === 1
              ? `the in-use board (hook: "${ad.hook}")`
              : idx === 2
                ? `the close board (hook: "${ad.hook}")`
                : `the hero board (hook: "${ad.hook}")`;
          return {
            hook: ad.hook ?? "",
            imageUrl: asset?.imageUrl,
            status: asset?.status,
            onOpen: assetsGenerating ? undefined : () => openBoard(target),
          };
        })}
      />

      {landing ? (
        <div className="px-6 md:px-10 mt-20 max-w-[40rem]">
          <button
            type="button"
            disabled={assetsGenerating}
            onClick={() => openBoard("the landing page")}
            className="text-left disabled:opacity-70"
          >
            <p className="font-serif text-[clamp(1.8rem,3.5vw,2.6rem)] leading-[1.15] text-foreground">
              {landing.hero}
            </p>
            {landing.sub ? (
              <p className="mt-4 font-serif text-[1.15rem] leading-relaxed text-[#c4b8a8]">
                {landing.sub}
              </p>
            ) : null}
            {landing.cta ? (
              <p className="mt-5 font-serif italic text-[16px] text-[#ede6dc]/80">{landing.cta}</p>
            ) : null}
          </button>
          {campaign?.landingSlug ? (
            <a
              href={`/p/${campaign.landingSlug}`}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-block font-serif italic text-[14px] text-[#6e675e] hover:text-[#ede6dc]"
            >
              The page
            </a>
          ) : null}
        </div>
      ) : null}

      <div className="px-6 md:px-10 mt-16">
        <button
          type="button"
          onClick={() => setShowLaunch(true)}
          disabled={assetsGenerating || assetsFailed}
          className="font-serif text-[1.35rem] text-foreground disabled:opacity-35 disabled:cursor-not-allowed"
        >
          {assetsGenerating
            ? "Photography still landing…"
            : assetsFailed
              ? "Generation failed"
              : "Ship this campaign"}
        </button>
      </div>

      <RevisionSheet
        open={!!revisionTarget}
        target={revisionTarget}
        assetsGenerating={assetsGenerating}
        onOpenChange={(o: boolean) => {
          if (!o) setRevisionTarget(null);
        }}
        campaignId={campaignId}
        campaign={campaign}
      />
    </div>
  );
}

function RevisionSheet({
  open,
  onOpenChange,
  campaignId,
  campaign,
  target,
  assetsGenerating,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  campaignId: string;
  campaign?: { revisionsUsed?: number; revisionsAllowed?: number; status?: string } | null;
  target: string | null;
  assetsGenerating: boolean;
}) {
  const [msg, setMsg] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);
  const revise = useReviseCampaign();
  const queryClient = useQueryClient();

  useEffect(() => {
    setMessages([]);
    setMsg("");
  }, [target]);

  const isTargeted = !!target && target !== "the overall campaign";

  const handleSend = () => {
    if (!msg.trim()) return;
    const userText = msg.trim();
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    const request = isTargeted ? `Regarding ${target}: ${userText}` : userText;
    revise.mutate(
      { id: campaignId, data: { request } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetCampaignStatusQueryKey(campaignId) });
          queryClient.invalidateQueries({ queryKey: getGetCampaignQueryKey(campaignId) });
          setMessages((prev) => [...prev, { role: "ai", content: "Changed." }]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            { role: "ai", content: "That didn’t take. Say it another way." },
          ]);
        },
      },
    );
    setMsg("");
  };

  const isLimited =
    (campaign?.revisionsUsed ?? 0) >= (campaign?.revisionsAllowed ?? 3) &&
    campaign?.status === "draft";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[62vh] rounded-none border-t border-[#ede6dc]/12 bg-background p-0 flex flex-col shadow-none [&>button]:hidden"
      >
        <SheetHeader className="px-6 pt-8 pb-4">
          <SheetTitle className="font-serif text-[2rem] text-foreground font-normal">
            {isTargeted ? "This board." : "What’s off."}
          </SheetTitle>
          {isTargeted && (
            <p className="font-serif text-[15px] text-[#8a8176] mt-1">{target}</p>
          )}
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 flex flex-col gap-5">
          <p className="font-serif text-[16px] text-[#c4b8a8] max-w-[36ch] leading-relaxed">
            Tell us what to change. We’ll rewrite that — not roll a new campaign.
          </p>

          {messages.map((m, i) => (
            <p
              key={i}
              className={`font-serif text-[16px] leading-relaxed max-w-[40ch] ${
                m.role === "user" ? "text-foreground self-end text-right" : "text-[#c4b8a8]"
              }`}
            >
              {m.content}
            </p>
          ))}

          {revise.isPending && (
            <p className="font-serif italic text-[16px] text-[#8a8176]">Listening…</p>
          )}
        </div>

        <div className="px-6 py-5 border-t border-[#ede6dc]/10">
          {isLimited ? (
            <p className="font-serif text-[15px] text-[#8a8176]">Ship it to keep talking.</p>
          ) : (
            <div>
              {assetsGenerating && (
                <p className="font-serif text-[13px] text-[#8a8176] mb-3">
                  Last change is still landing. One at a time.
                </p>
              )}
              <div className="flex items-end gap-4">
                <input
                  className="flex-1 bg-transparent border-0 border-b border-[#ede6dc]/30 rounded-none outline-none py-2 font-serif text-[17px] placeholder:text-[#ede6dc]/28 focus:border-[#ede6dc]/70"
                  placeholder="Make the hook quieter."
                  value={msg}
                  disabled={assetsGenerating}
                  onChange={(e) => setMsg(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!msg.trim() || revise.isPending || assetsGenerating}
                  className="font-serif text-[16px] disabled:opacity-40"
                >
                  Send
                </button>
              </div>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function shipErrorMessage(err: unknown): string {
  const e = err as { status?: number; data?: { error?: string; message?: string } };
  const code = e?.data?.error;
  switch (code) {
    case "stripe_not_configured":
      return "Payments aren’t set up yet.";
    case "not_generated":
      return "Still being written. Wait, then try again.";
    case "not_found":
      return "This campaign is gone. Start a new one.";
    case "missing_params":
      return "Pick a budget before shipping.";
  }
  if (e?.data?.message) return e.data.message;
  return "Checkout didn’t start. Try again.";
}

function LaunchPage({
  campaignId,
  data,
  onBack,
}: {
  campaignId: string;
  data: {
    brandName?: string;
    recommendedBudgetPreset?: string;
    channelSplit?: { metaPct?: number; tiktokPct?: number };
  };
  onBack: () => void;
}) {
  const [budget, setBudget] = useState(
    data.recommendedBudgetPreset === "scale"
      ? 20000
      : data.recommendedBudgetPreset === "starter"
        ? 2500
        : 7500,
  );
  const [metaPct, setMetaPct] = useState(data.channelSplit?.metaPct || 40);
  const [tiktokPct, setTiktokPct] = useState(data.channelSplit?.tiktokPct || 30);
  const googlePct = Math.max(0, 100 - metaPct - tiktokPct);
  const [showAdjust, setShowAdjust] = useState(false);
  const [shipError, setShipError] = useState<string | null>(null);
  const publish = usePublishCampaign();

  const handleShip = () => {
    setShipError(null);
    publish.mutate(
      {
        id: campaignId,
        data: {
          dailyBudgetCents: budget,
          metaSharePct: metaPct,
          tiktokSharePct: tiktokPct,
          googleSharePct: googlePct,
          successUrl: window.location.origin + "/?success=true&campaignId=" + campaignId,
        },
      },
      {
        onSuccess: (res) => {
          if (res?.checkoutUrl) {
            window.location.href = res.checkoutUrl;
            return;
          }
          if (res?.live === true || (res?.adsMode && res.adsMode !== "live")) {
            window.location.href =
              window.location.origin + "/?success=true&campaignId=" + campaignId;
            return;
          }
          setShipError("Checkout didn’t start.");
        },
        onError: (err) => {
          setShipError(shipErrorMessage(err));
        },
      },
    );
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="px-6 pt-8 md:px-10">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 font-serif text-[15px] text-[#8a8176] hover:text-[#ede6dc]"
        >
          <ArrowLeft className="w-4 h-4" /> Back to the table
        </button>
      </div>
      <div className="px-6 md:px-10 pb-24 pt-12 max-w-[40rem]">
        <h2 className="font-serif text-[clamp(2.4rem,6vw,4.2rem)] leading-[1.02] mb-4">
          Ship {data.brandName}
        </h2>
        <p className="font-serif italic text-[1.2rem] text-[#b9aea0] mb-14">
          A daily budget. Where it runs.
        </p>

        <div className="mb-12">
          <p className="font-serif italic text-[14px] text-[#8a8176] mb-6">Daily</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { val: 2500, label: "Starter" },
              { val: 7500, label: "Growth" },
              { val: 20000, label: "Scale" },
            ].map((tier) => (
              <button
                key={tier.val}
                type="button"
                onClick={() => setBudget(tier.val)}
                className={`flex flex-col items-center py-6 border transition-colors ${
                  budget === tier.val
                    ? "border-[#ede6dc] text-foreground"
                    : "border-[#ede6dc]/15 text-[#8a8176] hover:border-[#ede6dc]/40"
                }`}
              >
                <span className="font-serif text-3xl">${tier.val / 100}</span>
                <span className="mt-2 font-serif italic text-[13px]">{tier.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mb-14">
          <p className="font-serif italic text-[14px] text-[#8a8176] mb-4">Channels</p>
          <p className="font-serif text-[16px] text-[#c4b8a8]">
            {metaPct}% Meta · {tiktokPct}% TikTok · {googlePct}% Google
            {!showAdjust && (
              <button
                type="button"
                onClick={() => setShowAdjust(true)}
                className="ml-3 text-[#8a8176] hover:text-[#ede6dc]"
              >
                Adjust
              </button>
            )}
          </p>
          {showAdjust && (
            <div className="pt-8 flex flex-col gap-6">
              <div>
                <div className="flex justify-between font-serif text-[13px] text-[#8a8176] mb-2">
                  <span>Meta</span>
                  <span>{metaPct}%</span>
                </div>
                <Slider
                  value={[metaPct]}
                  onValueChange={(v) => {
                    const next = Math.min(v[0], 100 - tiktokPct);
                    setMetaPct(next);
                  }}
                  max={100}
                  step={5}
                />
              </div>
              <div>
                <div className="flex justify-between font-serif text-[13px] text-[#8a8176] mb-2">
                  <span>TikTok</span>
                  <span>{tiktokPct}%</span>
                </div>
                <Slider
                  value={[tiktokPct]}
                  onValueChange={(v) => {
                    const next = Math.min(v[0], 100 - metaPct);
                    setTiktokPct(next);
                  }}
                  max={100}
                  step={5}
                />
              </div>
              <div className="flex justify-between font-serif text-[13px] text-[#8a8176]">
                <span>Google</span>
                <span>{googlePct}%</span>
              </div>
            </div>
          )}
        </div>

        <p className="font-serif text-[14px] text-[#8a8176] mb-8 max-w-[32rem] leading-relaxed">
          Ad budget plus 10% · $29/mo · pause anytime. Mock until you flip live.
        </p>

        <button
          type="button"
          onClick={handleShip}
          disabled={publish.isPending}
          className="font-serif text-[1.35rem] border-b border-[#ede6dc]/50 pb-1 hover:border-[#ede6dc] disabled:opacity-40"
        >
          {publish.isPending ? "Preparing…" : `Ship ${data.brandName}`}
        </button>

        {shipError && (
          <p className="mt-6 font-serif text-[15px] text-[#c4a090] max-w-[28rem]">{shipError}</p>
        )}
      </div>
    </div>
  );
}

function LiveState({
  campaignId,
  setCampaignId,
}: {
  campaignId: string;
  setCampaignId: (id: string | null) => void;
}) {
  const { data: campaign } = useGetCampaign(campaignId, {
    query: {
      enabled: !!campaignId,
      queryKey: getGetCampaignQueryKey(campaignId),
    },
  });

  const { data: metrics } = useGetCampaignMetrics(campaignId, {
    query: {
      enabled: !!campaignId && (campaign?.status === "live" || campaign?.status === "paused"),
      queryKey: getGetCampaignMetricsQueryKey(campaignId),
      refetchInterval: 30000,
    },
  });

  const pause = usePauseCampaign();
  const data = campaign?.campaignData;

  if (!campaign || !data) return <WorkingState />;

  return (
    <div className="min-h-[100dvh] bg-background flex flex-col">
      <div className="px-6 pt-8 md:px-10">
        <Mark onClick={() => setCampaignId(null)} />
      </div>
      <div className="flex-1 flex flex-col justify-center px-6 md:px-10 pb-24">
        <h1 className="font-serif text-[clamp(2.4rem,6vw,4.5rem)] leading-[1.02] max-w-[16ch]">
          {campaign.status === "paused"
            ? `${data.brandName} is paused.`
            : `${data.brandName} is live.`}
        </h1>
        <a
          href={`/p/${campaign.landingSlug}`}
          target="_blank"
          rel="noreferrer"
          className="mt-6 font-serif text-[16px] text-[#8a8176] hover:text-[#ede6dc]"
        >
          /p/{campaign.landingSlug}
        </a>

        <div className="grid grid-cols-3 gap-10 mt-16 max-w-[32rem]">
          <div>
            <div className="font-serif text-3xl">{metrics?.impressions?.toLocaleString() || "0"}</div>
            <div className="mt-1 font-serif italic text-[13px] text-[#8a8176]">Impressions</div>
          </div>
          <div>
            <div className="font-serif text-3xl">{metrics?.clicks?.toLocaleString() || "0"}</div>
            <div className="mt-1 font-serif italic text-[13px] text-[#8a8176]">Clicks</div>
          </div>
          <div>
            <div className="font-serif text-3xl">
              ${((metrics?.spendCents || 0) / 100).toFixed(2)}
            </div>
            <div className="mt-1 font-serif italic text-[13px] text-[#8a8176]">Spend today</div>
          </div>
        </div>

        {metrics?.budgetCapCents != null && (
          <div className="w-full max-w-sm mt-12">
            <div className="flex justify-between font-serif text-[14px] text-[#8a8176] mb-2">
              <span>Spent</span>
              <span>
                ${((metrics.lifetimeSpendCents ?? 0) / 100).toFixed(2)} of $
                {(metrics.budgetCapCents / 100).toFixed(2)}
              </span>
            </div>
            <div className="h-px bg-[#ede6dc]/15">
              <div
                className="h-px bg-[#ede6dc]/70"
                style={{
                  width: `${Math.min(100, ((metrics.lifetimeSpendCents ?? 0) / metrics.budgetCapCents) * 100)}%`,
                }}
              />
            </div>
            {campaign.status === "paused" && campaign.pausedReason === "budget_cap" && (
              <p className="font-serif text-[15px] text-[#c4a090] mt-3">
                Paused — the cap is spent.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center gap-8 mt-16">
          <button
            type="button"
            onClick={() => pause.mutate({ id: campaignId })}
            disabled={pause.isPending || campaign.status === "paused"}
            className="font-serif text-[15px] text-[#8a8176] hover:text-[#ede6dc] disabled:opacity-40"
          >
            {campaign.status === "paused" ? "Paused" : "Pause"}
          </button>
          <button
            type="button"
            onClick={() => setCampaignId(null)}
            className="font-serif text-[15px] inline-flex items-center gap-1 hover:opacity-70"
          >
            Another product <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
