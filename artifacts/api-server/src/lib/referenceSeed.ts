export interface ReferenceSeed {
  seedKey: string;
  platform: string;
  title: string;
  sourceUrl: string;
  imageUrl: string;
}

/**
 * Curated, real best-in-class ad creatives sourced from the public web. Each
 * entry keeps a sourceUrl for attribution. Images are downloaded, normalised,
 * stored, and vision-analysed into the reference corpus by seedReferenceLibrary().
 * Re-running is safe — seedKey dedupes. To refresh, add/replace entries here.
 */
export const REFERENCE_SEEDS: ReferenceSeed[] = [
  // ── TikTok ───────────────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_tiktok_1",
    platform: "tiktok",
    title: "Duolingo — in-feed TikTok ad",
    sourceUrl: "https://megadigital.ai/en/blog/tiktok-ad-creatives/",
    imageUrl: "https://megadigital.ai/wp-content/uploads/2024/10/image-2-1024x745.png",
  },
  {
    seedKey: "ref_seed_tiktok_2",
    platform: "tiktok",
    title: "In-feed TikTok ad example",
    sourceUrl: "https://landingi.com/digital-advertising/tiktok-ad-examples/",
    imageUrl: "https://landingi.com/wp-content/uploads/2026/01/tiktok1-optimized.webp",
  },
  {
    seedKey: "ref_seed_tiktok_3",
    platform: "tiktok",
    title: "In-feed TikTok ad (vertical 9:16)",
    sourceUrl: "https://blog.adnabu.com/tiktok/tiktok-ad-specs/",
    imageUrl:
      "https://i0.wp.com/blog.adnabu.com/wp-content/uploads/TikTok-In-Feed-Ad-Example-.png?resize=424,907&ssl=1",
  },

  // ── Instagram Stories ──────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_ig_stories_1",
    platform: "instagram-stories",
    title: "Spotify — Instagram Stories ad",
    sourceUrl: "https://strikesocial.com/blog/examples-of-instagram-stories-ads/",
    imageUrl: "https://strikesocial.com/wp-content/uploads/2018/07/ag-instagram-story-ad-spotify.png",
  },
  {
    seedKey: "ref_seed_ig_stories_2",
    platform: "instagram-stories",
    title: "Instagram Stories creative example",
    sourceUrl: "https://skedsocial.com/blog/creative-instagram-stories-examples",
    imageUrl:
      "https://cdn.prod.website-files.com/64952a793c43f45d2d283b23/64fa66fdbb6887fce14b6ca5_64954024a90142e27e2a33df.webp",
  },
  {
    seedKey: "ref_seed_ig_stories_3",
    platform: "instagram-stories",
    title: "Airbnb — Instagram Stories ad",
    sourceUrl: "https://invideo.io/blog/instagram-story-ads-examples/",
    imageUrl:
      "https://assets-static.invideo.io/images/large/Air_Bnb_Instagram_Stories_Example_1b52f236c9.jpg",
  },
  {
    seedKey: "ref_seed_ig_stories_4",
    platform: "instagram-stories",
    title: "Instagram Stories full-bleed example",
    sourceUrl: "https://www.wordstream.com/blog/ws/2022/03/01/instagram-story-ideas",
    imageUrl:
      "https://www.wordstream.com/wp-content/uploads/2022/02/instagram-story-ideas-tour-website.png",
  },

  // ── Instagram Feed ─────────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_ig_feed_1",
    platform: "instagram-feed",
    title: "Brooklinen — Instagram feed ad",
    sourceUrl: "https://invideo.io/blog/instagram-ads-examples/",
    imageUrl:
      "https://assets-static.invideo.io/files/Instagram_ad_examples_in_feed_ads_entertaining_ads_Brooklinen_3c11957a6c.gif",
  },
  {
    seedKey: "ref_seed_ig_feed_2",
    platform: "instagram-feed",
    title: "McDonald's — Instagram feed ad",
    sourceUrl: "https://invideo.io/blog/instagram-ads-examples/",
    imageUrl:
      "https://assets-static.invideo.io/images/large/Instagram_ad_examples_in_feed_ads_color_pop_ads_Mc_Donalds_e35e0665cd.jpg",
  },
  {
    seedKey: "ref_seed_ig_feed_3",
    platform: "instagram-feed",
    title: "Twix — gamified Instagram feed ad",
    sourceUrl: "https://invideo.io/blog/instagram-ads-examples/",
    imageUrl:
      "https://assets-static.invideo.io/images/large/Instagram_ad_examples_in_feed_ads_gamified_ads_twix_0d9ab761e3.jpg",
  },

  // ── Facebook ───────────────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_facebook_1",
    platform: "facebook",
    title: "Shopify — Facebook ad",
    sourceUrl: "https://www.cyberclick.net/numericalblogen/20-creative-and-powerful-facebook-ad-examples",
    imageUrl:
      "https://www.cyberclick.net/hs-fs/hubfs/blog/facebook-ad-examples-shopify-2.jpg?width=600&name=facebook-ad-examples-shopify-2.jpg",
  },
  {
    seedKey: "ref_seed_facebook_2",
    platform: "facebook",
    title: "Shutterfly — Facebook ad",
    sourceUrl: "https://www.cyberclick.net/numericalblogen/20-creative-and-powerful-facebook-ad-examples",
    imageUrl: "https://www.cyberclick.net/hs-fs/hubfs/blog/shutterfly-1.jpg?width=600&name=shutterfly-1.jpg",
  },
  {
    seedKey: "ref_seed_facebook_3",
    platform: "facebook",
    title: "Facebook ad creative example",
    sourceUrl: "https://www.foreplay.co/post/facebook-ad-creative",
    imageUrl:
      "https://cdn.prod.website-files.com/62a4f1b9ff17080082bbb71e/6495f32be7bc7a167ad3b81b_062f04cd-93a7-43aa-ad1a-f5b875752eea.png",
  },

  // ── Google Ads ─────────────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_google_1",
    platform: "google-ads",
    title: "Adobe Creative Cloud — Google display ad",
    sourceUrl: "https://chainlinkmarketing.com/google-display-ads-2/",
    imageUrl:
      "https://h6s3h2c7.delivery.rocketcdn.me/wp-content/uploads/2019/07/Google-Display-Ad-Example-Adobe-Creative-Cloud.jpg",
  },
  {
    seedKey: "ref_seed_google_2",
    platform: "google-ads",
    title: "Google responsive display — strong headline",
    sourceUrl: "https://www.wordstream.com/blog/ws/2019/05/23/google-display-ads",
    imageUrl:
      "https://www.wordstream.com/wp-content/uploads/2022/08/google-responsive-display-ads-strong-headline.png",
  },
  {
    seedKey: "ref_seed_google_3",
    platform: "google-ads",
    title: "Responsive display ad example",
    sourceUrl: "https://creativewebsitemarketing.com/how-to-create-responsive-display-ads/",
    imageUrl: "https://creativewebsitemarketing.com/wp-content/uploads/Responsive-Display-Ads-Example-1.png",
  },
  {
    seedKey: "ref_seed_google_4",
    platform: "google-ads",
    title: "Responsive display ad example (alt)",
    sourceUrl: "https://creativewebsitemarketing.com/how-to-create-responsive-display-ads/",
    imageUrl: "https://creativewebsitemarketing.com/wp-content/uploads/Responsive-Display-Ads-Example-2.png",
  },

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  {
    seedKey: "ref_seed_linkedin_1",
    platform: "linkedin",
    title: "LinkedIn sponsored content examples",
    sourceUrl: "https://dripify.com/linkedin-ad-examples/",
    imageUrl: "https://dripify.com/wp-content/uploads/2024/09/LinkedIn-Sponsored-Ad-Examples-1024x768.webp",
  },
  {
    seedKey: "ref_seed_linkedin_2",
    platform: "linkedin",
    title: "LinkedIn sponsored content — lead gen",
    sourceUrl:
      "https://www.magneticaadvertising.com/en/linkedin-advertising/the-complete-guide-to-linkedin-sponsored-content/",
    imageUrl:
      "https://www.magneticaadvertising.com/wp-content/uploads/2019/01/example-of-sponsored-content-ad-with-Lead-Generation-Form-from-Red-Points-advertiser.png",
  },
  {
    seedKey: "ref_seed_linkedin_3",
    platform: "linkedin",
    title: "LinkedIn single image ad example",
    sourceUrl: "https://blog.hubspot.com/marketing/linkedin-sponsored-updates",
    imageUrl:
      "https://53.fs1.hubspotusercontent-na1.net/hub/53/hubfs/linkedin%20sponsored%20content_122022-4%20(1).webp?width=600&height=351&name=linkedin%20sponsored%20content_122022-4%20(1).webp",
  },
];
