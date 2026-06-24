import { useState } from "react";
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ChevronRight,
  ChevronUp,
  X,
  Globe,
  ThumbsUp,
  Repeat2,
  Share2,
  Music2,
  Plus,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * In-situ platform mockups — render a generated ad inside a faithful, platform
 * accurate frame (Instagram Feed/Stories, Facebook, LinkedIn, Google, TikTok) so
 * founders can picture how the campaign actually shows up in the wild.
 *
 * These deliberately use explicit platform colors (not the app theme tokens) so
 * each frame reads as the real surface regardless of the surrounding design.
 */

export type AdPlacement = "square" | "vertical";

type PlatformId =
  | "instagram-feed"
  | "facebook"
  | "linkedin"
  | "google"
  | "instagram-stories"
  | "tiktok";

interface MockupAd {
  brandName: string;
  hook: string;
  body: string;
  cta: string;
  accent: string;
  imageUrl?: string | null;
  status?: string | null;
}

const SQUARE_PLATFORMS: PlatformId[] = [
  "instagram-feed",
  "facebook",
  "linkedin",
  "google",
];
const VERTICAL_PLATFORMS: PlatformId[] = ["instagram-stories", "tiktok"];

const PLATFORM_LABELS: Record<PlatformId, string> = {
  "instagram-feed": "Instagram",
  facebook: "Facebook",
  linkedin: "LinkedIn",
  google: "Google",
  "instagram-stories": "IG Stories",
  tiktok: "TikTok",
};

function safeHex(hex: string | null | undefined, fallback = "#111111"): string {
  if (!hex) return fallback;
  const v = hex.trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v) ? v : fallback;
}

function handle(name: string): string {
  const h = (name || "brand").toLowerCase().replace(/[^a-z0-9]+/g, "");
  return h || "brand";
}

function domain(name: string): string {
  return `${handle(name)}.com`;
}

/* ----------------------------- shared atoms ----------------------------- */

function BrandAvatar({
  name,
  accent,
  size = 28,
  square = false,
}: {
  name: string;
  accent: string;
  size?: number;
  square?: boolean;
}) {
  const initial = (name || "L").trim().charAt(0).toUpperCase();
  return (
    <span
      className={cn(
        "flex items-center justify-center font-sans font-semibold text-white",
        square ? "rounded-md" : "rounded-full",
      )}
      style={{
        width: size,
        height: size,
        background: accent,
        fontSize: Math.round(size * 0.42),
      }}
    >
      {initial}
    </span>
  );
}

function GradientRing({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex rounded-full p-[2px]"
      style={{
        background:
          "linear-gradient(45deg,#feda75,#fa7e1e,#d62976,#962fbf,#4f5bd5)",
      }}
    >
      {children}
    </span>
  );
}

/** The creative itself: handles done / generating / failed states. */
function MediaFill({ ad }: { ad: MockupAd }) {
  if (ad.imageUrl) {
    return (
      <img
        src={ad.imageUrl}
        alt={`${ad.brandName} ad creative`}
        className="absolute inset-0 h-full w-full object-cover animate-in fade-in duration-700"
      />
    );
  }
  if (ad.status === "failed") {
    return (
      <div className="absolute inset-0 flex items-center justify-center bg-neutral-200 px-3 text-center font-sans text-[11px] text-neutral-600">
        Image didn't generate
      </div>
    );
  }
  return (
    <div
      className="absolute inset-0 animate-pulse"
      style={{
        background: `linear-gradient(135deg, ${ad.accent}, ${ad.accent}44)`,
      }}
    >
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-sans text-[10px] uppercase tracking-[2px] text-white/70">
          Generating…
        </span>
      </div>
    </div>
  );
}

function SquareMedia({ ad }: { ad: MockupAd }) {
  return (
    <div className="relative aspect-square w-full overflow-hidden bg-neutral-100">
      <MediaFill ad={ad} />
    </div>
  );
}

function FeedCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-[340px] overflow-hidden rounded-xl border border-neutral-200 bg-white text-left shadow-sm">
      {children}
    </div>
  );
}

function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative mx-auto aspect-[9/19] w-full max-w-[232px] overflow-hidden rounded-[2rem] border-[5px] border-neutral-900 bg-black shadow-xl">
      {children}
    </div>
  );
}

function RailIcon({
  icon,
  label,
}: {
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <span className="flex flex-col items-center gap-0.5 text-white drop-shadow">
      {icon}
      <span className="font-sans text-[9px] leading-none">{label}</span>
    </span>
  );
}

/* ------------------------------- mockups -------------------------------- */

function InstagramFeed({ ad }: { ad: MockupAd }) {
  return (
    <FeedCard>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <GradientRing>
          <BrandAvatar name={ad.brandName} accent={ad.accent} size={26} />
        </GradientRing>
        <div className="leading-tight">
          <p className="font-sans text-[13px] font-semibold text-neutral-900">
            {handle(ad.brandName)}
          </p>
          <p className="font-sans text-[11px] text-neutral-500">Sponsored</p>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-neutral-700" />
      </div>

      <SquareMedia ad={ad} />

      <div className="flex items-center justify-between border-y border-neutral-100 bg-neutral-50 px-3 py-2">
        <span className="font-sans text-[13px] font-semibold text-neutral-900">
          {ad.cta || "Learn more"}
        </span>
        <ChevronRight className="h-4 w-4 text-neutral-500" />
      </div>

      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="h-[22px] w-[22px] text-neutral-900" />
        <MessageCircle className="h-[22px] w-[22px] text-neutral-900" />
        <Send className="h-[22px] w-[22px] text-neutral-900" />
        <Bookmark className="ml-auto h-[22px] w-[22px] text-neutral-900" />
      </div>

      <div className="px-3 pb-3 pt-2">
        <p className="font-sans text-[12px] font-semibold text-neutral-900">
          1,248 likes
        </p>
        <p className="mt-0.5 font-sans text-[13px] leading-snug text-neutral-900">
          <span className="font-semibold">{handle(ad.brandName)}</span>{" "}
          {ad.hook}
        </p>
        {ad.body ? (
          <p className="mt-0.5 line-clamp-2 font-sans text-[12px] leading-snug text-neutral-500">
            {ad.body}
          </p>
        ) : null}
      </div>
    </FeedCard>
  );
}

function FacebookFeed({ ad }: { ad: MockupAd }) {
  return (
    <FeedCard>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <BrandAvatar name={ad.brandName} accent={ad.accent} size={34} square />
        <div className="leading-tight">
          <p className="font-sans text-[13px] font-semibold text-neutral-900">
            {ad.brandName}
          </p>
          <p className="flex items-center gap-1 font-sans text-[11px] text-neutral-500">
            Sponsored · <Globe className="h-3 w-3" />
          </p>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-neutral-700" />
      </div>

      <p className="line-clamp-3 px-3 pb-2.5 font-sans text-[13px] leading-snug text-neutral-800">
        {ad.body || ad.hook || ad.brandName}
      </p>

      <SquareMedia ad={ad} />

      <div className="flex items-center gap-3 bg-neutral-100 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-sans text-[10px] uppercase tracking-wide text-neutral-500">
            {domain(ad.brandName)}
          </p>
          <p className="line-clamp-2 font-sans text-[13px] font-semibold leading-snug text-neutral-900">
            {ad.hook || ad.brandName}
          </p>
        </div>
        <span className="flex-shrink-0 rounded-md bg-neutral-200 px-3 py-1.5 font-sans text-[12px] font-semibold text-neutral-900">
          {ad.cta || "Learn More"}
        </span>
      </div>

      <div className="flex items-center justify-around border-t border-neutral-100 px-3 py-1.5 text-neutral-500">
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <MessageCircle className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <Share2 className="h-4 w-4" /> Share
        </span>
      </div>
    </FeedCard>
  );
}

function LinkedInPost({ ad }: { ad: MockupAd }) {
  return (
    <FeedCard>
      <div className="flex items-start gap-2.5 px-3 py-2.5">
        <BrandAvatar name={ad.brandName} accent={ad.accent} size={36} square />
        <div className="leading-tight">
          <p className="font-sans text-[13px] font-semibold text-neutral-900">
            {ad.brandName}
          </p>
          <p className="font-sans text-[11px] text-neutral-500">
            3,402 followers
          </p>
          <p className="font-sans text-[11px] text-neutral-500">Promoted</p>
        </div>
        <MoreHorizontal className="ml-auto h-4 w-4 text-neutral-700" />
      </div>

      <p className="line-clamp-3 px-3 pb-2.5 font-sans text-[13px] leading-snug text-neutral-800">
        {ad.body || ad.hook || ad.brandName}
      </p>

      <SquareMedia ad={ad} />

      <div className="flex items-center gap-3 border-t border-neutral-100 bg-neutral-50 px-3 py-3">
        <p className="min-w-0 flex-1 line-clamp-2 font-sans text-[13px] font-semibold leading-snug text-neutral-900">
          {ad.hook || ad.brandName}
        </p>
        <span className="flex-shrink-0 rounded-full border border-[#0a66c2] px-4 py-1 font-sans text-[12px] font-semibold text-[#0a66c2]">
          {ad.cta || "Learn more"}
        </span>
      </div>

      <div className="flex items-center justify-around border-t border-neutral-100 px-3 py-1.5 text-neutral-500">
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <ThumbsUp className="h-4 w-4" /> Like
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <MessageCircle className="h-4 w-4" /> Comment
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <Repeat2 className="h-4 w-4" /> Repost
        </span>
        <span className="flex items-center gap-1.5 font-sans text-[12px]">
          <Send className="h-4 w-4" /> Send
        </span>
      </div>
    </FeedCard>
  );
}

function GoogleDisplay({ ad }: { ad: MockupAd }) {
  return (
    <FeedCard>
      <div className="relative">
        <SquareMedia ad={ad} />
        <span className="absolute left-2 top-2 rounded-sm bg-white/90 px-1.5 py-0.5 font-sans text-[10px] font-bold text-neutral-700">
          Ad
        </span>
      </div>
      <div className="px-3 py-3">
        <p className="line-clamp-2 font-sans text-[15px] leading-snug text-[#1a0dab]">
          {ad.hook || ad.brandName}
        </p>
        {ad.body ? (
          <p className="mt-1 line-clamp-2 font-sans text-[12px] leading-snug text-neutral-600">
            {ad.body}
          </p>
        ) : null}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <BrandAvatar name={ad.brandName} accent={ad.accent} size={22} />
            <span className="truncate font-sans text-[12px] text-neutral-700">
              {domain(ad.brandName)}
            </span>
          </div>
          <span className="flex-shrink-0 rounded-full bg-[#1a73e8] px-4 py-1.5 font-sans text-[12px] font-semibold text-white">
            {ad.cta || "Learn more"}
          </span>
        </div>
      </div>
    </FeedCard>
  );
}

function InstagramStories({ ad }: { ad: MockupAd }) {
  return (
    <PhoneFrame>
      <MediaFill ad={ad} />
      <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/55 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute inset-x-3 top-2.5 flex gap-1">
        <span className="h-0.5 flex-1 rounded-full bg-white/90" />
        <span className="h-0.5 flex-1 rounded-full bg-white/30" />
        <span className="h-0.5 flex-1 rounded-full bg-white/30" />
      </div>

      <div className="absolute inset-x-3 top-5 flex items-center gap-2">
        <GradientRing>
          <BrandAvatar name={ad.brandName} accent={ad.accent} size={24} />
        </GradientRing>
        <span className="font-sans text-[12px] font-semibold leading-none text-white">
          {handle(ad.brandName)}
        </span>
        <span className="font-sans text-[11px] leading-none text-white/70">
          Sponsored
        </span>
        <X className="ml-auto h-4 w-4 text-white" />
      </div>

      <div className="absolute inset-x-3 bottom-14 flex flex-col items-center gap-3">
        <p className="line-clamp-2 text-center font-sans text-[13px] font-semibold leading-snug text-white drop-shadow">
          {ad.hook || ad.brandName}
        </p>
        <div className="flex items-center gap-1.5 rounded-full bg-white px-4 py-1.5 font-sans text-[12px] font-semibold text-neutral-900">
          <ChevronUp className="h-3.5 w-3.5" /> {ad.cta || "Learn more"}
        </div>
      </div>

      <div className="absolute inset-x-3 bottom-3 flex items-center gap-2">
        <div className="flex-1 truncate rounded-full border border-white/50 px-3 py-1.5 font-sans text-[11px] text-white/70">
          Send message
        </div>
        <Heart className="h-5 w-5 shrink-0 text-white" />
        <Send className="h-5 w-5 shrink-0 text-white" />
      </div>
    </PhoneFrame>
  );
}

function TikTok({ ad }: { ad: MockupAd }) {
  return (
    <PhoneFrame>
      <MediaFill ad={ad} />
      <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/75 to-transparent" />

      <div className="absolute inset-x-0 top-3 flex items-center justify-center gap-4 font-sans text-[12px]">
        <span className="text-white/60">Following</span>
        <span className="border-b-2 border-white pb-0.5 font-semibold text-white">
          For You
        </span>
      </div>
      <Search className="absolute right-3 top-3 h-4 w-4 text-white/90" />

      <div className="absolute bottom-20 right-2 flex flex-col items-center gap-4">
        <div className="relative mb-1">
          <BrandAvatar name={ad.brandName} accent={ad.accent} size={32} />
          <span className="absolute -bottom-1.5 left-1/2 flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-[#fe2c55]">
            <Plus className="h-2.5 w-2.5 text-white" />
          </span>
        </div>
        <RailIcon icon={<Heart className="h-6 w-6 fill-white" />} label="12.4k" />
        <RailIcon
          icon={<MessageCircle className="h-6 w-6 fill-white text-black" />}
          label="842"
        />
        <RailIcon
          icon={<Bookmark className="h-6 w-6 fill-white" />}
          label="1.2k"
        />
        <RailIcon icon={<Share2 className="h-6 w-6 fill-white" />} label="Share" />
        <span
          className="mt-1 flex h-8 w-8 animate-spin items-center justify-center rounded-full border-2 border-white/30 [animation-duration:4s]"
          style={{ background: ad.accent }}
        >
          <Music2 className="h-3.5 w-3.5 text-white" />
        </span>
      </div>

      <div className="absolute bottom-4 left-3 right-14 flex flex-col gap-2 text-white">
        <div>
          <p className="mb-1 font-sans text-[13px] font-semibold leading-none">
            @{handle(ad.brandName)}
            <span className="ml-1 rounded-sm bg-white/20 px-1 py-0.5 align-middle text-[9px] uppercase tracking-wide">
              Sponsored
            </span>
          </p>
          <p className="mb-1.5 line-clamp-2 font-sans text-[12px] leading-snug">
            {ad.hook || ad.brandName}
          </p>
          <p className="flex items-center gap-1.5 font-sans text-[11px]">
            <Music2 className="h-3 w-3" /> original sound — {handle(ad.brandName)}
          </p>
        </div>
        <div className="flex items-center justify-center gap-1 rounded-md bg-[#fe2c55] py-1.5 font-sans text-[12px] font-semibold text-white">
          {ad.cta || "Learn more"} <ChevronRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </PhoneFrame>
  );
}

function renderMockup(platform: PlatformId, ad: MockupAd) {
  switch (platform) {
    case "instagram-feed":
      return <InstagramFeed ad={ad} />;
    case "facebook":
      return <FacebookFeed ad={ad} />;
    case "linkedin":
      return <LinkedInPost ad={ad} />;
    case "google":
      return <GoogleDisplay ad={ad} />;
    case "instagram-stories":
      return <InstagramStories ad={ad} />;
    case "tiktok":
      return <TikTok ad={ad} />;
  }
}

function PlatformPills({
  platforms,
  active,
  onChange,
}: {
  platforms: PlatformId[];
  active: PlatformId;
  onChange: (p: PlatformId) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-1.5">
      {platforms.map((p) => (
        <button
          key={p}
          type="button"
          aria-pressed={active === p}
          onClick={() => onChange(p)}
          className={cn(
            "rounded-full border px-3 py-1 font-sans text-[11px] tracking-wide transition-colors",
            active === p
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-transparent text-muted-foreground hover:border-foreground/40",
          )}
        >
          {PLATFORM_LABELS[p]}
        </button>
      ))}
    </div>
  );
}

export interface InSituAdProps {
  brandName: string;
  hook: string;
  body: string;
  cta: string;
  accent?: string | null;
  imageUrl?: string | null;
  status?: string | null;
  placement: AdPlacement;
}

/**
 * Renders a single generated ad inside a platform-accurate mockup, with a pill
 * selector to preview it across the placements relevant to its aspect ratio.
 */
export function InSituAd({
  brandName,
  hook,
  body,
  cta,
  accent,
  imageUrl,
  status,
  placement,
}: InSituAdProps) {
  const platforms =
    placement === "vertical" ? VERTICAL_PLATFORMS : SQUARE_PLATFORMS;
  const [active, setActive] = useState<PlatformId>(platforms[0]);

  const ad: MockupAd = {
    brandName: brandName || "Brand",
    hook: hook || "",
    body: body || "",
    cta: cta || "",
    accent: safeHex(accent),
    imageUrl,
    status,
  };

  return (
    <div className="flex flex-col gap-4">
      <PlatformPills platforms={platforms} active={active} onChange={setActive} />
      <div className="flex justify-center">{renderMockup(active, ad)}</div>
    </div>
  );
}
