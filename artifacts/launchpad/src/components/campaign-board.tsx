import { cn } from "@/lib/utils";

export type BoardBeat = "hero" | "context" | "close";

const BEAT_LABEL: Record<BoardBeat, string> = {
  hero: "Hero",
  context: "In use",
  close: "Close",
};

export function beatForIndex(idx: number): BoardBeat {
  if (idx === 1) return "context";
  if (idx === 2) return "close";
  return "hero";
}

/**
 * One board on the art director's table. The photograph is the ad —
 * type is composited in the crop. Never a gradient. Never a platform chrome frame.
 */
export function CampaignBoard({
  beat,
  hook,
  imageUrl,
  status,
  onChange,
}: {
  beat: BoardBeat;
  hook: string;
  imageUrl?: string | null;
  status?: string | null;
  onChange?: () => void;
}) {
  const failed = status === "failed";
  const ready = Boolean(imageUrl) && !failed;
  const aspect = beat === "context" ? "aspect-[9/16]" : "aspect-[4/5]";

  return (
    <figure className="group m-0 flex flex-col gap-3">
      <div
        className={cn(
          "relative w-full overflow-hidden bg-[#1c1915]",
          aspect,
        )}
      >
        {ready ? (
          <img
            src={imageUrl!}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : failed ? (
          <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
            <p className="font-serif text-[15px] leading-snug text-[#c4b8a8]">
              Generation failed
            </p>
          </div>
        ) : (
          <div className="absolute inset-0">
            {/* Designed top band — type lives here once photography lands. */}
            <div className="absolute inset-x-0 top-0 h-[32%] flex items-end justify-center px-5 pb-3">
              <p className="font-serif text-[clamp(1.1rem,2.4vw,1.85rem)] leading-[1.15] text-[#ede6dc] text-center">
                {hook}
              </p>
            </div>
          </div>
        )}
      </div>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="font-serif italic text-[13px] text-[#b9aea0]">
          {BEAT_LABEL[beat]}
        </span>
        {onChange ? (
          <button
            type="button"
            onClick={onChange}
            className="font-serif text-[13px] text-[#8a8176] hover:text-[#ede6dc] transition-colors"
          >
            Change this
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}
