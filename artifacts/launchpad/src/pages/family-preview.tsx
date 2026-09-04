import { CampaignFamily } from "@/components/campaign-board";

/**
 * DEV-only table so Craft can taste Hero / In use / Close without generating.
 * Same still, three beats — if this reads as three matching cards, the family failed.
 */
const STILL =
  "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1080&h=1350&q=80";

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
            hook: "Wake up already clear",
            imageUrl: STILL,
            status: "done",
          },
          {
            hook: "The second cup at the desk",
            imageUrl: STILL,
            status: "done",
          },
          {
            hook: "Hold the heat",
            imageUrl: STILL,
            status: "done",
          },
        ]}
      />
    </div>
  );
}
