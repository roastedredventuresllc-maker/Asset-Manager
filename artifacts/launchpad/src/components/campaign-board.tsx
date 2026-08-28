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
 * One print on the table. Three beats, one family — not identical cards.
 * Type sits in the top of the crop. Never a gradient. Never Variant A/B/C.
 */
export function CampaignBoard({
  beat,
  hook,
  imageUrl,
  status,
  onOpen,
}: {
  beat: BoardBeat;
  hook: string;
  imageUrl?: string | null;
  status?: string | null;
  onOpen?: () => void;
}) {
  const failed = status === "failed";
  const ready = Boolean(imageUrl) && !failed;
  const aspect = beat === "context" ? "aspect-[9/16]" : "aspect-[4/5]";
  const typeSize =
    beat === "hero"
      ? "text-[clamp(1.35rem,2.6vw,2.15rem)]"
      : beat === "context"
        ? "text-[clamp(1.05rem,1.8vw,1.45rem)]"
        : "text-[clamp(1.15rem,2vw,1.65rem)]";
  const typeBand = beat === "context" ? "h-[28%]" : "h-[32%]";

  const inner = (
    <>
      {ready ? (
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center px-5 text-center">
          <p className="font-serif text-[15px] leading-snug text-[#c4b8a8]">
            Generation failed
          </p>
        </div>
      ) : (
        <div className="absolute inset-0">
          <div
            className={cn(
              "absolute inset-x-0 top-0 flex items-end justify-center px-5 pb-2",
              typeBand,
            )}
          >
            <p
              className={cn(
                "font-serif leading-[1.12] text-[#ede6dc] text-center",
                typeSize,
              )}
            >
              {hook}
            </p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <figure className="m-0">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          aria-label={`${BEAT_LABEL[beat]}: ${hook || "board"}`}
          className={cn(
            "relative block w-full overflow-hidden bg-[#1c1915] text-left",
            aspect,
          )}
        >
          {inner}
        </button>
      ) : (
        <div className={cn("relative w-full overflow-hidden bg-[#1c1915]", aspect)}>
          {inner}
        </div>
      )}
      <figcaption className="mt-2 font-serif italic text-[12px] text-[#6e675e]">
        {BEAT_LABEL[beat]}
      </figcaption>
    </figure>
  );
}
