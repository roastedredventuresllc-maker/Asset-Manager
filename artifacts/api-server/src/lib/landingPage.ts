/**
 * Server-rendered /p/:slug. Two states only:
 *   stills exist  → a real product page in the dark room, hero = the plate PNG sharp
 *   stills miss   → honest fail-closed lettermark (not a product page)
 * No cream Framer kit. No third template. No lettermark stand-in. No fake stars.
 */

export type LandingCampaign = {
  brandName: string;
  tagline: string;
  category?: string;
  palette?: string[];
  landing?: {
    hero?: string;
    sub?: string;
    features?: string[];
    socialProof?: string;
    cta?: string;
    faqs?: { q?: string; a?: string }[];
  };
};

export type LandingAsset = {
  idx: number;
  status?: string | null;
  imageUrl?: string | null;
};

export function pickLandingPhoto(
  founderProductUrl: string | null | undefined,
  assets: LandingAsset[],
): string {
  const stills = assets
    .filter((a) => a.status === "done" && typeof a.imageUrl === "string" && a.imageUrl.length > 0)
    .sort((a, b) => a.idx - b.idx);
  if (stills[0]?.imageUrl) return stills[0].imageUrl;
  return founderProductUrl?.trim() || "";
}

export function buildLandingHtml(opts: {
  slug: string;
  campaign: LandingCampaign;
  productImg: string;
  canonical: string;
}): string {
  const { campaign: cj, productImg, canonical } = opts;
  const land = cj.landing ?? {};
  const brandName = String(cj.brandName ?? "");
  const tagline = String(cj.tagline ?? "");
  const accent = sanitizeColor(cj.palette?.[1]) ?? sanitizeColor(cj.palette?.[0]) ?? "#B4502E";
  const features = Array.isArray(land.features)
    ? land.features.filter(Boolean).map((f) => String(f)).slice(0, 6)
    : [];
  const cta = String(land.cta || "Get started");
  const hero = String(land.hero || tagline || brandName || "");
  const sub = String(land.sub || "");
  const socialProof = String(land.socialProof || "");
  const category = String(cj.category ?? "");
  const faqs = Array.isArray(land.faqs)
    ? land.faqs
        .filter((f) => f && f.q && f.a)
        .map((f) => ({ q: String(f.q), a: String(f.a) }))
        .slice(0, 6)
    : [];

  if (!productImg) {
    return failClosedHtml(brandName, hero || tagline);
  }

  const ldNodes: Record<string, unknown>[] = [
    {
      "@type": "Organization",
      name: brandName,
      ...(canonical ? { url: canonical } : {}),
      logo: productImg,
      ...(tagline ? { slogan: tagline } : {}),
    },
    {
      "@type": "WebSite",
      name: brandName,
      ...(canonical ? { url: canonical } : {}),
      ...(sub || tagline ? { description: sub || tagline } : {}),
    },
    {
      "@type": "Product",
      name: brandName,
      ...(sub || tagline ? { description: sub || tagline } : {}),
      ...(category ? { category } : {}),
      image: productImg,
      brand: { "@type": "Brand", name: brandName },
    },
  ];
  if (faqs.length) {
    ldNodes.push({
      "@type": "FAQPage",
      mainEntity: faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    });
  }
  const jsonLdBlock = `<script type="application/ld+json">${jsonLd({
    "@context": "https://schema.org",
    "@graph": ldNodes,
  })}</script>`;

  const faqSection = faqs.length
    ? `<section class="faq" id="faq">
        <div class="faq-list">
          ${faqs
            .map(
              (f) => `<details class="faq-item reveal">
              <summary>${escHtml(f.q)}</summary>
              <p>${escHtml(f.a)}</p>
            </details>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const heroVisual = `<figure class="hero-still reveal"><img src="${escHtml(productImg)}" alt="${escAttr(brandName)}"/></figure>`;

  const demoBand = `<section class="demo reveal">
        <figure class="demo-still"><img src="${escHtml(productImg)}" alt="${escAttr(brandName)}"/></figure>
        <div class="demo-copy">
          <p class="demo-line">${escHtml(sub || tagline || "")}</p>
        </div>
      </section>`;

  const featuresSection = features.length
    ? `<section class="features" id="features">
        <div class="feature-list">
          ${features
            .map(
              (f, i) => `<div class="feature-row reveal">
              <span class="feature-num">${String(i + 1).padStart(2, "0")}</span>
              <p class="feature-text">${escHtml(f)}</p>
            </div>`,
            )
            .join("")}
        </div>
      </section>`
    : "";

  const proofRow = socialProof
    ? `<div class="proof reveal"><span class="proof-text">${escHtml(socialProof)}</span></div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(brandName)} — ${escHtml(tagline)}</title>
  <meta name="description" content="${escAttr(sub)}"/>
  <meta property="og:title" content="${escAttr(brandName)} — ${escAttr(tagline)}"/>
  <meta property="og:description" content="${escAttr(sub)}"/>
  <meta property="og:type" content="website"/>
  ${canonical ? `<meta property="og:url" content="${escAttr(canonical)}"/>` : ""}
  <meta property="og:image" content="${escAttr(productImg)}"/>
  ${canonical ? `<link rel="canonical" href="${escAttr(canonical)}"/>` : ""}
  <meta name="robots" content="index,follow,max-image-preview:large"/>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--room:#161310;--ink:#ede6dc;--mute:#c4b8a8;--accent:${accent};--line:rgba(237,230,220,0.12)}
    html{scroll-behavior:smooth}
    body{background:var(--room);color:var(--ink);font-family:'Instrument Serif',Georgia,serif;line-height:1.5;-webkit-font-smoothing:antialiased}
    a{color:inherit}
    .wrap{max-width:1040px;margin:0 auto;padding:0 24px}
    nav{position:sticky;top:0;z-index:50;background:var(--room)}
    .nav-inner{display:flex;align-items:center;justify-content:space-between;height:72px}
    .brand{font-size:15px;letter-spacing:.08em;text-transform:uppercase}
    .cta{display:inline-block;color:var(--ink);text-decoration:none;border-bottom:1px solid rgba(237,230,220,0.4);padding-bottom:2px;font-size:17px;font-style:italic}
    .cta:hover{border-bottom-color:var(--ink)}
    .hero{padding:48px 0 72px;display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
    .hero h1{font-size:clamp(40px,5.6vw,72px);line-height:1.02;font-weight:400;margin:0 0 22px}
    .hero h1 .em{font-style:italic;color:var(--mute)}
    .hero .sub{font-size:20px;color:var(--mute);max-width:30ch;margin-bottom:32px}
    .proof{margin-top:28px;font-size:16px;color:var(--mute);font-style:italic;max-width:34ch}
    .hero-still{margin:0;aspect-ratio:4/5;overflow:hidden;background:transparent}
    .hero-still img{display:block;width:100%;height:100%;object-fit:cover}
    .features{padding:24px 0 16px}
    .feature-list{border-top:1px solid var(--line)}
    .feature-row{display:grid;grid-template-columns:56px 1fr;gap:20px;align-items:baseline;padding:28px 0;border-bottom:1px solid var(--line)}
    .feature-num{font-size:14px;letter-spacing:.06em;color:var(--mute);font-variant-numeric:tabular-nums}
    .feature-text{font-size:clamp(22px,3vw,32px);line-height:1.28}
    .demo{margin:64px 0;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
    .demo-still{margin:0;aspect-ratio:4/5;overflow:hidden}
    .demo-still img{display:block;width:100%;height:100%;object-fit:cover}
    .demo-line{font-size:clamp(24px,3.2vw,38px);line-height:1.2;color:var(--ink)}
    .faq{padding:24px 0}
    .faq-list{border-top:1px solid var(--line)}
    .faq-item{border-bottom:1px solid var(--line)}
    .faq-item summary{font-size:clamp(20px,2.4vw,28px);line-height:1.3;padding:24px 40px 24px 0;cursor:pointer;list-style:none;position:relative}
    .faq-item summary::-webkit-details-marker{display:none}
    .faq-item summary::after{content:'+';position:absolute;right:2px;top:50%;transform:translateY(-50%);font-size:24px;color:var(--mute)}
    .faq-item[open] summary::after{content:'–'}
    .faq-item p{font-size:17px;line-height:1.55;color:var(--mute);max-width:66ch;padding:0 0 24px}
    .cta-block{padding:80px 0 24px}
    .cta-block h2{font-size:clamp(32px,4.8vw,56px);line-height:1.05;font-weight:400;margin-bottom:16px}
    .cta-block p{color:var(--mute);font-size:18px;margin-bottom:28px;max-width:36ch}
    footer{padding:48px 0 72px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;border-top:1px solid var(--line)}
    footer .fine{font-size:13px;color:var(--mute)}
    .mcta{position:fixed;left:0;right:0;bottom:0;z-index:60;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:var(--room);border-top:1px solid var(--line);transform:translateY(120%);transition:transform .35s ease;display:none}
    .mcta.show{transform:translateY(0)}
    .reveal{opacity:0;transform:translateY(14px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
    .reveal.in{opacity:1;transform:none}
    @media(max-width:780px){
      .hero{grid-template-columns:1fr;padding:28px 0 48px;gap:36px}
      .hero .sub{max-width:none}
      .hero-still{order:-1}
      .feature-row{grid-template-columns:44px 1fr;gap:14px;padding:22px 0}
      .demo{grid-template-columns:1fr;gap:28px}
      .demo-still{order:-1}
      .mcta{display:block}
      nav .cta{display:none}
    }
    @media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}}
  </style>
  ${jsonLdBlock}
</head>
<body>
  <nav id="nav">
    <div class="wrap nav-inner">
      <span class="brand">${escHtml(brandName)}</span>
      <a class="cta" href="#cta">${escHtml(cta)}</a>
    </div>
  </nav>

  <header class="wrap hero">
    <div class="hero-copy">
      <h1 class="reveal">${heroHeadline(hero)}</h1>
      ${sub ? `<p class="sub reveal">${escHtml(sub)}</p>` : ""}
      <a class="cta reveal" href="#cta">${escHtml(cta)}</a>
      ${proofRow}
    </div>
    ${heroVisual}
  </header>

  <main class="wrap">
    ${featuresSection}
    ${demoBand}
    ${faqSection}
    <section class="cta-block" id="cta">
      <h2>${escHtml(tagline || hero)}</h2>
      <p>${escHtml(sub || "")}</p>
      <a class="cta" href="#">${escHtml(cta)}</a>
    </section>
  </main>

  <footer class="wrap">
    <span class="brand">${escHtml(brandName)}</span>
    <span class="fine">© ${new Date().getFullYear()} ${escHtml(brandName)}</span>
  </footer>

  <div class="mcta" id="mcta"><a class="cta" href="#cta">${escHtml(cta)}</a></div>

  <script>
    (function(){
      var nav=document.getElementById('nav'),mcta=document.getElementById('mcta');
      function onScroll(){
        var y=window.scrollY||0;
        if(y>16){nav.classList.add('scrolled');}else{nav.classList.remove('scrolled');}
        if(mcta){if(y>window.innerHeight*0.6){mcta.classList.add('show');}else{mcta.classList.remove('show');}}
      }
      window.addEventListener('scroll',onScroll,{passive:true});onScroll();
      var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target);}});},{threshold:0.12});
      document.querySelectorAll('.reveal').forEach(function(el){io.observe(el);});
    })();
  </script>
</body>
</html>`;
}

function failClosedHtml(brandName: string, line: string): string {
  const brand = escHtml(brandName || "LaunchPad");
  const copy = escHtml(
    line
      ? `${line}. Generation failed. Photography did not come back. This is not a product page until the stills exist.`
      : "Generation failed. Photography did not come back. This is not a product page until the stills exist.",
  );
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${brand} — photography did not come back</title>
  <meta name="robots" content="noindex"/>
</head>
<body style="margin:0;background:#161310;color:#c4b8a8;font-family:Georgia,serif;min-height:100vh;display:flex;align-items:center;justify-content:center;">
  <main style="max-width:36rem;padding:2rem;">
    <p style="opacity:.55;font-size:14px;letter-spacing:.04em;">${brand}</p>
    <p style="font-size:22px;line-height:1.35;margin-top:12px;">${copy}</p>
  </main>
</body>
</html>`;
}

function heroHeadline(text: string): string {
  const safe = escHtml(String(text ?? "").trim());
  const parts = safe.split(" ");
  if (parts.length < 3) return safe;
  const last = parts.pop() as string;
  return `${parts.join(" ")} <span class="em">${last}</span>`;
}

function sanitizeColor(c: string | undefined | null): string | null {
  if (!c || typeof c !== "string") return null;
  const v = c.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(v)) return v;
  if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(,\s*[\d.]+\s*)?\)$/.test(v)) return v;
  if (/^hsla?\(\s*[\d.]+\s*,\s*[\d.]+%\s*,\s*[\d.]+%\s*(,\s*[\d.]+\s*)?\)$/.test(v)) return v;
  return null;
}

function escHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escAttr(str: string): string {
  return escHtml(str);
}

function jsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
