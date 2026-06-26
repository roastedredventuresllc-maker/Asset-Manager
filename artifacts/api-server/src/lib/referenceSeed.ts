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

  // ── TikTok (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_tiktok_4",
    platform: "tiktok",
    title: "Liquid I.V. — relatable product moment",
    sourceUrl: "https://tinuiti.com/blog/paid-social/tiktok-examples-of-ads/",
    imageUrl: "https://tinuiti.com/wp-content/uploads/2023/12/Screenshot-2023-03-20-144126.jpg",
  },
  {
    seedKey: "ref_seed_tiktok_5",
    platform: "tiktok",
    title: "TikTok — platform UI creative mockup",
    sourceUrl: "https://strikesocial.com/blog/tiktok-spark-ads-case-study-gaining-320k-followers/",
    imageUrl: "https://strikesocial.com/wp-content/uploads/2025/07/TikTok-Spark-Ads-case-study-creative-software-brand-651x1024.png",
  },
  {
    seedKey: "ref_seed_tiktok_6",
    platform: "tiktok",
    title: "Digivizer — TikTok business case study",
    sourceUrl: "https://digivizer.com/blog/tiktok-ads-and-boost-lab-case-study/",
    imageUrl: "https://digivizer.com/wp-content/uploads/2022/02/Digi-BoostLab1-BlogHeader.png",
  },
  {
    seedKey: "ref_seed_tiktok_7",
    platform: "tiktok",
    title: "Social app engagement collage ad",
    sourceUrl: "https://blog.hubspot.com/marketing/best-tiktok-ads",
    imageUrl: "https://53.fs1.hubspotusercontent-na1.net/hubfs/53/img-1-20250516-9399498.webp",
  },
  {
    seedKey: "ref_seed_tiktok_8",
    platform: "tiktok",
    title: "Indomilk Tobot Galaxy — interactive product teaser",
    sourceUrl: "https://upbeatagency.com/tiktok-ads-examples/",
    imageUrl: "https://upbeatagency.com/wp-content/uploads/2022/11/High-performing-TikTok-Ad-examples-9.png-599x1024.webp",
  },
  {
    seedKey: "ref_seed_tiktok_9",
    platform: "tiktok",
    title: "Social app promo with CTAs overlay",
    sourceUrl: "https://www.tribegroup.co/blog/tiktok-spark-ads",
    imageUrl: "https://www.tribegroup.co/hubfs/Blog%20Assets/00%20-%202026/YouTube%20Blog%20Assets/0126-youtube-brandconnect-what-brands-need-to-know-header.jpg",
  },

  // ── Instagram Stories (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_ig_stories_5",
    platform: "instagram-stories",
    title: "Yoga International — free trial offer story ad",
    sourceUrl: "https://adespresso.com/blog/instagram-story-ads/",
    imageUrl: "https://adespresso.com/wp-content/uploads/2021/08/word-image.png",
  },
  {
    seedKey: "ref_seed_ig_stories_6",
    platform: "instagram-stories",
    title: "Alo Yoga gift shop launch announcement",
    sourceUrl: "https://skedsocial.com/blog/the-ultimate-guide-to-instagram-story-ads",
    imageUrl: "https://cdn.prod.website-files.com/64952a793c43f45d2d283b23/6495402e05690933565f60f6_AD1-638x1024.png",
  },
  {
    seedKey: "ref_seed_ig_stories_7",
    platform: "instagram-stories",
    title: "Webflow — playful zig-zag messaging ad",
    sourceUrl: "https://www.magiclibrary.co/blog/best-instagram-ad-examples",
    imageUrl: "https://cdn.prod.website-files.com/668bd249016e0e8fc0971aad/668d051d66f072bb36e22c70_Group%201000002539.webp",
  },
  {
    seedKey: "ref_seed_ig_stories_8",
    platform: "instagram-stories",
    title: "Udacity — 50% off programs discount",
    sourceUrl: "https://karolakarlson.com/instagram-story-ad-examples/",
    imageUrl: "https://karolakarlson.com/wp-content/uploads/2020/03/udacity-instagram-story-ad.png",
  },
  {
    seedKey: "ref_seed_ig_stories_9",
    platform: "instagram-stories",
    title: "Banner Boo — Instagram story ads tutorial",
    sourceUrl: "https://bannerboo.com/blog/how-to-create-and-run-instagram-story-ads-in-2023/",
    imageUrl: "https://bannerboo.com/upload/iblock/089/how_to_create_and_run_instagram_story_ads_en.png",
  },

  // ── Instagram Feed (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_ig_feed_4",
    platform: "instagram-feed",
    title: "Poshmark — selling pre-loved items easy",
    sourceUrl: "https://invideo.io/blog/instagram-ads-examples/",
    imageUrl: "https://assets-static.invideo.io/images/large/Instagram_ad_examples_pro_tips_use_call_to_action_or_cta_poshmark_4afba4d61e.png",
  },
  {
    seedKey: "ref_seed_ig_feed_5",
    platform: "instagram-feed",
    title: "Studio Shodwe — conversational SMS-style creative",
    sourceUrl: "https://www.canva.com/instagram-posts/templates/ads/",
    imageUrl: "https://template.canva.com/EAFtzbNacis/2/0/1600w-97R5oZnVnOY.jpg",
  },
  {
    seedKey: "ref_seed_ig_feed_6",
    platform: "instagram-feed",
    title: "Zentime — product launch calendar teaser",
    sourceUrl: "https://www.figma.com/resource-library/instagram-ad-examples/",
    imageUrl: "https://cdn.sanity.io/images/599r6htc/regionalized/114b24166f91e55b15d3b39368c8438c8c7734ca-1440x864.jpg?w=1440&h=864&q=75&fit=max&auto=format",
  },
  {
    seedKey: "ref_seed_ig_feed_7",
    platform: "instagram-feed",
    title: "Social media engagement vibrant lifestyle ad",
    sourceUrl: "https://adgpt.com/blog/the-best-performing-instagram-ads-for-beauty-and-fashion-in-2025",
    imageUrl: "https://adgpt.com/uploads/blogs/blog_0bff92f80c314a71168cff6391376ded.jpg",
  },
  {
    seedKey: "ref_seed_ig_feed_8",
    platform: "instagram-feed",
    title: "Book club goodies launch announcement",
    sourceUrl: "https://blog.hootsuite.com/instagram-ads-guide/",
    imageUrl: "https://blog.hootsuite.com/wp-content/uploads/2025/02/word-image-505095-1-620x1342.png",
  },
  {
    seedKey: "ref_seed_ig_feed_9",
    platform: "instagram-feed",
    title: "The Fab Story — morning routine quiz ad",
    sourceUrl: "https://www.k6agency.com/instagram-ad-examples/",
    imageUrl: "https://www.k6agency.com/wp-content/uploads/2021/05/IMG_3837-690x1024.png",
  },
  {
    seedKey: "ref_seed_ig_feed_10",
    platform: "instagram-feed",
    title: "Microsoft 365 — cloud productivity platform",
    sourceUrl: "https://thebrief.ai/blog/instagram-ads-examples",
    imageUrl: "https://www.thebrief.ai/_next/image?url=https://cdn.sanity.io/images/8wzdrx7x/production/bc77747b0a975eb52b2164cc1dca65f83ad8cf78-284x600.jpg&w=3840&q=75",
  },
  {
    seedKey: "ref_seed_ig_feed_11",
    platform: "instagram-feed",
    title: "MONDAY Haircare — influencer product testimonial",
    sourceUrl: "https://brands.joinstatus.com/branded-content-ads-on-instagram",
    imageUrl: "https://brands.joinstatus.com/hs-fs/hubfs/October%202022%20Blogs/Branded%20Content%20Ads%20on%20Instagram/branded%20content%20ads%202-1.jpg?width=300&name=branded%20content%20ads%202-1.jpg",
  },
  {
    seedKey: "ref_seed_ig_feed_12",
    platform: "instagram-feed",
    title: "Beauty new arrival product showcase ad",
    sourceUrl: "https://www.canva.com/instagram-posts/templates/ads/",
    imageUrl: "https://template.canva.com/EAFBFjox4Zc/1/0/1280w-Y2JJoSQFHD0.jpg",
  },
  {
    seedKey: "ref_seed_ig_feed_13",
    platform: "instagram-feed",
    title: "Photography equipment lifestyle illustration ad",
    sourceUrl: "https://www.ubunzo.com/articles/10-instagram-ad-examples-to-inspire-your-next-design-project",
    imageUrl: "https://cdn.prod.website-files.com/680041f6772cc0ee34719141/6835063e9967589be8ff0cbd_67b66b87ff69bd45d64dbf62_7372cd5c39c362d61a77b75c6182dd6f1233f58e9405b5bab75e2b537d2b1687.webp",
  },
  {
    seedKey: "ref_seed_ig_feed_14",
    platform: "instagram-feed",
    title: "Speks Gump stress ball product demo",
    sourceUrl: "https://blog.hootsuite.com/instagram-ads-guide/",
    imageUrl: "https://blog.hootsuite.com/wp-content/uploads/2025/02/image6-3-620x1341.png",
  },
  {
    seedKey: "ref_seed_ig_feed_15",
    platform: "instagram-feed",
    title: "NewPro Home Solutions — siding color comparison",
    sourceUrl: "https://www.wordstream.com/blog/instagram-ad-copy",
    imageUrl: "https://www.wordstream.com/wp-content/uploads/2024/08/instagram-ad-copy-home-services-example.webp",
  },
  {
    seedKey: "ref_seed_ig_feed_16",
    platform: "instagram-feed",
    title: "ARTAH NAD+ supplement product demo",
    sourceUrl: "https://www.impulze.ai/post/sponsored-post-on-instagram",
    imageUrl: "https://framerusercontent.com/images/mn7xbdceAp5qSGDBAFlgrtev28.png?width=1332&height=1269",
  },
  {
    seedKey: "ref_seed_ig_feed_17",
    platform: "instagram-feed",
    title: "Makery.eu — influencer marketing pop-art ad",
    sourceUrl: "https://karolakarlson.com/instagram-ad-examples/",
    imageUrl: "https://karolakarlson.com/wp-content/uploads/2018/01/null-114.png",
  },
  {
    seedKey: "ref_seed_ig_feed_18",
    platform: "instagram-feed",
    title: "CSR Racing — mobile game install ad",
    sourceUrl: "https://invideo.io/blog/instagram-ads-examples/",
    imageUrl: "https://assets-static.invideo.io/files/Instagram_ad_examples_in_feed_ads_entertaining_ads_C_Sracing_490ddea803.gif",
  },

  // ── Facebook (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_facebook_4",
    platform: "facebook",
    title: "Social Media Manager — service offer ad",
    sourceUrl: "https://www.canva.com/facebook-ads/templates/",
    imageUrl: "https://template.canva.com/EAG7qFuV-6g/1/0/1600w-TSVO_Aj64FY.jpg",
  },
  {
    seedKey: "ref_seed_facebook_5",
    platform: "facebook",
    title: "Semrush — Beast Mode SEO Toolkit video",
    sourceUrl: "https://zapier.com/blog/facebook-ad-examples/",
    imageUrl: "https://images.ctfassets.net/lzny33ho1g45/5Wi37vVJaJmLt3pSZX27Oa/7f0940b7fbedb2b2a477a31ad8aeee70/facebook-ad-examples-image20.png",
  },
  {
    seedKey: "ref_seed_facebook_6",
    platform: "facebook",
    title: "Brand Kit guide for small business",
    sourceUrl: "https://logo.com/blog/facebook-ad-designs",
    imageUrl: "https://logo.com/image-cdn/images/kts928pd/production/48ba5030b92bbdbf45e19b69786fcbe11ca18e5e-1920x1080.png?w=1920&q=72&fm=webp",
  },
  {
    seedKey: "ref_seed_facebook_7",
    platform: "facebook",
    title: "Free workshop — State of Paid Advertising",
    sourceUrl: "https://www.learningrevolution.net/high-converting-facebook-ads/",
    imageUrl: "https://www.learningrevolution.net/wp-content/smush-webp/Picture1-min-2.jpg.webp",
  },
  {
    seedKey: "ref_seed_facebook_8",
    platform: "facebook",
    title: "GRIN — Black Friday influencer marketing toolkit",
    sourceUrl: "https://klientboost.com/facebook/facebook-ad-examples/",
    imageUrl: "https://wp.klientboost.com/wp-content/uploads/2020/07/GRIN-Facebook-Ad-Example-1.png",
  },

  // ── Google Ads (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_google_5",
    platform: "google-ads",
    title: "Shopify — build your business CTA",
    sourceUrl: "https://chainlinkmarketing.com/google-display-ads-2/",
    imageUrl: "https://h6s3h2c7.delivery.rocketcdn.me/wp-content/uploads/2019/07/Google-Display-Ad-Example-Shopify-Original.jpg",
  },
  {
    seedKey: "ref_seed_google_6",
    platform: "google-ads",
    title: "Fiverr — e-commerce development experts",
    sourceUrl: "https://www.lunio.ai/blog/google-display-ad-examples",
    imageUrl: "https://www.lunio.ai/hubfs/Imported_Blog_Media/66cf4c3bebff11a0277fd6ab_66ba1f2fbc4a38c6a8a3fff8_fiverr-banner-display-example-2.jpg",
  },

  // ── LinkedIn (expanded, vision-vetted) ───────────────────
  {
    seedKey: "ref_seed_linkedin_4",
    platform: "linkedin",
    title: "Single Grain SaaS SEO audit lead gen",
    sourceUrl: "https://adespresso.com/blog/linkedin-ads-examples/",
    imageUrl: "https://adespresso.com/wp-content/uploads/2021/07/word-image-7.jpeg",
  },
  {
    seedKey: "ref_seed_linkedin_5",
    platform: "linkedin",
    title: "Motion — before/after ad analytics",
    sourceUrl: "https://www.adconversion.com/blog/linkedin-ad-ideas",
    imageUrl: "https://cdn.prod.website-files.com/6601a492b79719ea9b76ea80/66965a0179e6fbc9e8978e98_AD_4nXdUPgLsYWmFGV1rDB6SS81GBK8mtIAQXF66e0TxcHU9Oinj9VGiah3xYEtjb0azv59h9JLW2h1jxrbnJXx_f7Xwr8HrirgYTOI96_ReSV9c_YpXgZN-yxNxX_mNL6dfbVpeKl20td4PPVwX1-INUc0jj6V-.png",
  },
  {
    seedKey: "ref_seed_linkedin_6",
    platform: "linkedin",
    title: "knak — email creation platform demo video",
    sourceUrl: "https://www.designbuffs.com/blog/linkedin-ad-examples",
    imageUrl: "https://cdn.prod.website-files.com/646e2eaef4ea8c90fde6a519/646e2eef26f709d8049df627_image_6f3e16c503832dcb7cb04bc0e72c6505_800.jpeg",
  },
  {
    seedKey: "ref_seed_linkedin_7",
    platform: "linkedin",
    title: "ZenABM — Black Friday intent-led outbound",
    sourceUrl: "https://zenabm.com/blog/linkedin-single-image-ads-ultimate-guide",
    imageUrl: "https://wp.zenabm.com/wp-content/uploads/2026/01/Flowchart-example-top-performing-linkedin-single-image-ad-ZenABM.png",
  },
  {
    seedKey: "ref_seed_linkedin_8",
    platform: "linkedin",
    title: "ZenABM — AI campaign funnel analysis tool",
    sourceUrl: "https://zenabm.com/blog/linkedin-single-image-ads-ultimate-guide",
    imageUrl: "https://wp.zenabm.com/wp-content/uploads/2026/01/ZenABM-linkedin-single-image-ad-example-with-a-meaningful-user-of-software-interface.png",
  },
];
