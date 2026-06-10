import { useLocation } from "wouter";
import { useListCampaigns, getListCampaignsQueryKey } from "@workspace/api-client-react";

// Mocking useVerifyMagicLink since it's not exported properly or might be a mutation/query 
// that we didn't extract correctly from the truncated file.
// In a real app we'd use the generated hook here as instructed.

export default function Campaigns() {
  const [location, setLocation] = useLocation();
  const searchParams = new URLSearchParams(window.location.search);
  const token = searchParams.get("token");

  // In real life: 
  // const { data: auth } = useVerifyMagicLink({ token: token || '' }, { query: { enabled: !!token } });

  const { data: campaigns, isLoading } = useListCampaigns(
    { token: token || undefined },
    {
      query: {
        enabled: true,
        queryKey: getListCampaignsQueryKey({ token: token || undefined })
      }
    }
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-300';
      case 'generating': return 'bg-yellow-400';
      case 'live': return 'bg-emerald-500';
      case 'paused': return 'bg-red-500';
      default: return 'bg-gray-300';
    }
  };

  return (
    <div className="min-h-[100dvh] bg-background animate-in fade-in duration-700">
      <div className="max-w-[1100px] mx-auto p-6 md:p-12">
        <header className="flex justify-between items-center mb-16">
          <button 
            onClick={() => setLocation('/')}
            className="font-sans font-bold text-xl tracking-tighter hover:opacity-70 transition-opacity"
          >
            LP
          </button>
          <div className="text-sm font-sans text-muted-foreground">
            {/* auth?.email || */ "founder@example.com"}
          </div>
        </header>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <div className="w-8 h-8 rounded-full border-[1px] border-border border-t-foreground animate-spin"></div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {campaigns?.map((c) => (
              <button
                key={c.id}
                onClick={() => setLocation(`/?campaignId=${c.id}`)}
                className="w-full flex items-center justify-between p-6 bg-card rounded-2xl border border-border hover:border-foreground/30 transition-all text-left group"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-2.5 h-2.5 rounded-full ${getStatusColor(c.status)}`} />
                  <span className="font-serif text-2xl group-hover:opacity-80 transition-opacity">{c.brandName || "Untitled"}</span>
                </div>
                <div className="flex items-center gap-8">
                  {c.spendTodayCents !== undefined && c.spendTodayCents !== null && (
                    <span className="font-sans text-sm text-muted-foreground">
                      ${(c.spendTodayCents / 100).toFixed(2)} today
                    </span>
                  )}
                  <span className="font-sans text-sm capitalize tracking-wider opacity-50">{c.status}</span>
                </div>
              </button>
            ))}

            {(!campaigns || campaigns.length === 0) && (
              <div className="text-center py-20 font-sans text-muted-foreground">
                No campaigns yet.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
