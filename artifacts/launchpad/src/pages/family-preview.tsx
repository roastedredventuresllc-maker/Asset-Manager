import { CampaignFamily } from "@/components/campaign-board";

/**
 * DEV-only table of the actual channel plates (Inter type-burn, 4:5 / 9:16 / 4:5).
 * Not a raw photo crop. Not a labeled A/B/C row.
 */
export default function FamilyPreview() {
  return (
    <div className="min-h-[100dvh] bg-background pb-28">
      <div className="px-6 pt-8 md:px-10 flex items-baseline justify-between gap-4">
        <span className="font-serif italic text-[17px] text-[#ede6dc]/70">LaunchPad</span>
        <span className="font-serif italic text-[16px] text-[#6e675e]">What’s off</span>
      </div>

      <div className="px-6 md:px-10 mt-14 mb-12 max-w-[80rem]">
        <h1 className="font-serif text-[clamp(2.8rem,8vw,6.5rem)] leading-[0.92] text-foreground">
          Stillbrew
        </h1>
        <p className="mt-4 font-serif italic text-[clamp(1.2rem,2.4vw,1.75rem)] text-[#c4b8a8] max-w-[28ch]">
          Coffee that waits for you.
        </p>
      </div>

      <CampaignFamily
        boards={[
          {
            hook: "Wake up clearer",
            imageUrl: "/family-preview/hero.png",
            status: "done",
          },
          {
            hook: "Night then quiet",
            imageUrl: "/family-preview/context.png",
            status: "done",
          },
          {
            hook: "Hold the glass",
            imageUrl: "/family-preview/close.png",
            status: "done",
          },
        ]}
      />
    </div>
  );
}
