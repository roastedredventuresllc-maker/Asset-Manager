import { cn } from "@/lib/utils";

export type BoardBeat = "hero" | "context" | "close";

export const BEAT_LABEL: Record<BoardBeat, string> = {
  hero: "Hero",
  context: "In use",
  close: "Close",
};

/** Unequal table slots — a 1/3 gallery or matching widths is a Craft fail. */
export const FAMILY_SLOT_CLASS: Record<BoardBeat, string> = {
  hero: "md:col-start-1 md:row-start-1 md:row-span-2 md:pr-3",
  context:
    "w-[52%] max-w-[240px] md:w-auto md:max-w-none md:col-start-2 md:row-start-1 md:self-start md:-mt-3",
  close:
    "w-[66%] max-w-[300px] ml-[14%] md:ml-0 md:w-auto md:max-w-none md:col-start-3 md:row-start-2 md:mt-16 md:self-end",
};

/**
 * Ready stills are already the slot aspect, so object-position alone is a no-op.
 * Close must zoom the crop; hero stays grounded; in-use stays the tall full scene.
 */
export const FAMILY_CROP_CLASS: Record<BoardBeat, string> = {
  hero: "absolute inset-0 h-full w-full object-cover object-bottom",
  context: "absolute inset-0 h-full w-full object-cover object-center",
  close:
    "absolute inset-0 h-full w-full object-cover object-[center_56%] scale-[1.24] origin-[center_56%]",
};

export const FAMILY_ASPECT_CLASS: Record<BoardBeat, string> = {
  hero: "aspect-[4/5]",
  context: "aspect-[9/16]",
  close: "aspect-[4/5]",
};

export const FAMILY_TYPE_BAND: Record<BoardBeat, string> = {
  hero: "h-[32%]",
  context: "h-[28%]",
  close: "h-[32%]",
};

export const FAMILY_TYPE_SIZE: Record<BoardBeat, string> = {
  hero: "text-[clamp(1.35rem,2.6vw,2.15rem)]",
  context: "text-[clamp(1.05rem,1.8vw,1.45rem)]",
  close: "text-[clamp(1.15rem,2vw,1.65rem)]",
};

/** Staggered tracks — never grid-cols-3, never three equal cards. */
export const FAMILY_TABLE_CLASS =
  "grid grid-cols-1 md:grid-cols-[minmax(0,1.28fr)_minmax(0,0.46fr)_minmax(0,0.7fr)] md:grid-rows-[auto_auto] gap-x-6 gap-y-12 md:gap-y-0 items-start";

export function beatForIndex(idx: number): BoardBeat {
  if (idx === 1) return "context";
  if (idx === 2) return "close";
  return "hero";
}

export type FamilyBoard = {
  hook: string;
  imageUrl?: string | null;
  status?: string | null;
  onOpen?: () => void;
};

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
  const aspect = FAMILY_ASPECT_CLASS[beat];
  const typeSize = FAMILY_TYPE_SIZE[beat];
  const typeBand = FAMILY_TYPE_BAND[beat];

  const inner = (
    <>
      {ready ? (
        <img src={imageUrl!} alt="" className={FAMILY_CROP_CLASS[beat]} />
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
    <figure data-family-print={beat} className="m-0">
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
      <figcaption
        data-family-caption={beat}
        className={cn(
          "mt-3 text-[#6e675e]",
          beat === "hero" ? "max-w-[28ch]" : "max-w-[18ch]",
        )}
      >
        <span className="block font-serif italic text-[12px]">{BEAT_LABEL[beat]}</span>
        {beat === "hero" && hook && !failed ? (
          <span className="mt-1 block font-serif text-[clamp(1.05rem,1.7vw,1.4rem)] leading-[1.2] text-[#c4b8a8]">
            {hook}
          </span>
        ) : null}
      </figcaption>
    </figure>
  );
}

/**
 * Art director's table: Hero leads, In use is the tall tuck, Close is the
 * dropped crop study. Not a Variant A/B/C row and not three matching cards.
 */
export function CampaignFamily({ boards }: { boards: Array<FamilyBoard | null | undefined> }) {
  return (
    <section data-campaign-family className="px-6 md:px-10 max-w-[86rem]">
      <div data-family-table className={FAMILY_TABLE_CLASS}>
        {boards.map((board, idx) => {
          if (!board) return null;
          const beat = beatForIndex(idx);
          return (
            <div key={beat} data-family-slot={beat} className={FAMILY_SLOT_CLASS[beat]}>
              <CampaignBoard
                beat={beat}
                hook={board.hook}
                imageUrl={board.imageUrl}
                status={board.status}
                onOpen={board.onOpen}
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}
