/**
 * Server-rendered /p/:slug. A product page only when a photograph exists
 * (generated still or founder upload). No lettermark kit. No fake stars.
 * Canvas matches the Craft bar dark room (#161310), not Replit cream #F9F7F4.
 * Hero stills fill the card (cover) — no halo / contain inset that reads as blur.
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
        <p class="eyebrow reveal"><span class="dot"></span>Questions</p>
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

  const heroVisual = `<div class="hero-visual reveal"><img src="${escHtml(productImg)}" alt="${escAttr(brandName)}"/></div>`;

  const demoBand = `<section class="demo reveal">
        <div class="demo-frame"><img src="${escHtml(productImg)}" alt="${escAttr(brandName)}"/></div>
        <div class="demo-copy">
          <p class="eyebrow"><span class="dot"></span>See it in action</p>
          <p class="demo-line">${escHtml(sub || tagline || "")}</p>
        </div>
      </section>`;

  const featuresSection = features.length
    ? `<section class="features" id="features">
        <p class="eyebrow reveal"><span class="dot"></span>Why it works</p>
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
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--ink:#ede6dc;--canvas:#161310;--card:#1c1915;--accent:${accent};--line:rgba(237,230,220,0.12)}
    html{scroll-behavior:smooth}
    body{background:var(--canvas);color:var(--ink);font-family:'Inter',sans-serif;line-height:1.6;-webkit-font-smoothing:antialiased}
    .serif{font-family:'Instrument Serif',serif;font-weight:400}
    .eyebrow{font-size:11px;letter-spacing:2.5px;text-transform:uppercase;font-weight:500;opacity:0.55;display:flex;align-items:center;gap:10px}
    .eyebrow .dot{width:5px;height:5px;border-radius:999px;background:var(--accent);display:inline-block}
    a{color:inherit}
    .wrap{max-width:1080px;margin:0 auto;padding:0 24px}
    nav{position:fixed;top:0;left:0;right:0;z-index:50;transition:background .3s ease,border-color .3s ease,backdrop-filter .3s ease;border-bottom:1px solid transparent}
    nav.scrolled{background:rgba(22,19,16,0.82);backdrop-filter:saturate(180%) blur(12px);border-bottom:1px solid var(--line)}
    .nav-inner{display:flex;align-items:center;justify-content:space-between;height:64px}
    .brand{font-size:15px;letter-spacing:1.5px;text-transform:uppercase;font-weight:600}
    .btn{display:inline-flex;align-items:center;gap:8px;background:var(--ink);color:var(--canvas);padding:13px 26px;border-radius:999px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.3px;transition:transform .2s ease,opacity .2s ease;white-space:nowrap}
    .btn:hover{transform:translateY(-1px);opacity:.9}
    .btn--sm{padding:10px 20px;font-size:13px}
    .btn--ghost{background:transparent;color:var(--ink);text-decoration:none;font-weight:500;font-size:14px;opacity:.6;transition:opacity .2s}
    .btn--ghost:hover{opacity:1}
    .btn--light{background:var(--canvas);color:var(--ink)}
    .hero{padding:160px 0 80px;display:grid;grid-template-columns:1.05fr .95fr;gap:56px;align-items:center}
    .hero h1{font-family:'Instrument Serif',serif;font-size:clamp(46px,6.4vw,84px);line-height:1.02;letter-spacing:-.5px;margin:22px 0 24px}
    .hero h1 .em{font-style:italic;opacity:.5}
    .hero .sub{font-size:19px;opacity:.66;max-width:30ch;margin-bottom:36px}
    .hero-actions{display:flex;align-items:center;gap:22px;flex-wrap:wrap}
    .proof{display:flex;align-items:center;gap:12px;margin-top:34px;font-size:14px;opacity:.62}
    .proof-text{max-width:34ch}
    .hero-visual{position:relative;aspect-ratio:4/5;border-radius:2px;background:var(--card);border:1px solid var(--line);overflow:hidden}
    .hero-visual img{display:block;width:100%;height:100%;object-fit:cover}
    .features{padding:60px 0 40px}
    .feature-list{margin-top:40px;border-top:1px solid var(--line)}
    .feature-row{display:grid;grid-template-columns:64px 1fr;gap:24px;align-items:baseline;padding:32px 0;border-bottom:1px solid var(--line)}
    .feature-num{font-size:13px;font-weight:600;letter-spacing:1px;opacity:.32;font-variant-numeric:tabular-nums}
    .feature-text{font-family:'Instrument Serif',serif;font-size:clamp(24px,3.2vw,34px);line-height:1.28}
    .demo{margin:70px 0;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center;background:color-mix(in srgb,var(--accent) 7%,var(--canvas));border:1px solid var(--line);border-radius:28px;padding:48px}
    .demo-frame{border-radius:2px;overflow:hidden;background:var(--card);border:1px solid var(--line);aspect-ratio:4/5}
    .demo-frame img{display:block;width:100%;height:100%;object-fit:cover}
    .demo-line{font-family:'Instrument Serif',serif;font-size:clamp(26px,3.4vw,40px);line-height:1.2;margin-top:18px}
    .faq{padding:50px 0 20px}
    .faq-list{margin-top:36px;border-top:1px solid var(--line)}
    .faq-item{border-bottom:1px solid var(--line)}
    .faq-item summary{font-family:'Instrument Serif',serif;font-size:clamp(20px,2.6vw,28px);line-height:1.3;padding:26px 40px 26px 0;cursor:pointer;list-style:none;position:relative}
    .faq-item summary::-webkit-details-marker{display:none}
    .faq-item summary::after{content:'+';position:absolute;right:2px;top:50%;transform:translateY(-50%);font-size:26px;opacity:.4;transition:opacity .2s}
    .faq-item[open] summary::after{content:'–'}
    .faq-item p{font-size:16px;line-height:1.6;opacity:.66;max-width:66ch;padding:0 0 28px}
    .closing{margin:90px 24px 0;border-radius:32px;background:var(--ink);color:var(--canvas);text-align:center;padding:clamp(64px,9vw,120px) 24px}
    .closing h2{font-family:'Instrument Serif',serif;font-size:clamp(34px,5.4vw,68px);line-height:1.05;margin-bottom:14px}
    .closing p{opacity:.6;font-size:16px;margin-bottom:36px}
    footer{padding:48px 0 64px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
    footer .brand{opacity:.85}
    footer .fine{font-size:12px;opacity:.4}
    .mcta{position:fixed;left:0;right:0;bottom:0;z-index:60;padding:14px 16px calc(14px + env(safe-area-inset-bottom));background:rgba(22,19,16,.9);backdrop-filter:blur(12px);border-top:1px solid var(--line);transform:translateY(120%);transition:transform .35s ease;display:none}
    .mcta.show{transform:translateY(0)}
    .mcta .btn{width:100%;justify-content:center}
    .reveal{opacity:0;transform:translateY(18px);transition:opacity .7s cubic-bezier(.2,.7,.2,1),transform .7s cubic-bezier(.2,.7,.2,1)}
    .reveal.in{opacity:1;transform:none}
    @media(max-width:780px){
      .hero{grid-template-columns:1fr;padding:120px 0 48px;gap:40px}
      .hero .sub{max-width:none}
      .hero-actions{gap:16px}
      .hero-visual{order:-1}
      .feature-row{grid-template-columns:48px 1fr;gap:16px;padding:26px 0}
      .demo{grid-template-columns:1fr;padding:32px;gap:28px}
      .demo-frame{order:-1}
      .closing{margin:64px 16px 0}
      .mcta{display:block}
      nav .btn{display:none}
    }
    @media(prefers-reduced-motion:reduce){.reveal{opacity:1;transform:none;transition:none}html{scroll-behavior:auto}}
  </style>
  ${jsonLdBlock}
</head>
<body>
  <nav id="nav">
    <div class="wrap nav-inner">
      <span class="brand">${escHtml(brandName)}</span>
      <a class="btn btn--sm" href="#cta">${escHtml(cta)}</a>
    </div>
  </nav>

  <header class="wrap hero">
    <div class="hero-copy">
      <p class="eyebrow reveal"><span class="dot"></span>${escHtml(brandName)}</p>
      <h1 class="reveal">${heroHeadline(hero)}</h1>
      ${sub ? `<p class="sub reveal">${escHtml(sub)}</p>` : ""}
      <div class="hero-actions reveal">
        <a class="btn" href="#cta">${escHtml(cta)}</a>
        ${features.length ? `<a class="btn--ghost" href="#features">See how it works →</a>` : ""}
      </div>
      ${proofRow}
    </div>
    ${heroVisual}
  </header>

  <main class="wrap">
    ${featuresSection}
  </main>

  <div class="wrap">${demoBand}</div>

  ${faqSection ? `<div class="wrap">${faqSection}</div>` : ""}

  <section class="closing" id="cta">
    <h2>${escHtml(tagline || hero)}</h2>
    <p>${escHtml(sub || "")}</p>
    <a class="btn btn--light" href="#">${escHtml(cta)}</a>
  </section>

  <footer class="wrap">
    <span class="brand">${escHtml(brandName)}</span>
    <span class="fine">© ${new Date().getFullYear()} ${escHtml(brandName)}</span>
  </footer>

  <div class="mcta" id="mcta"><a class="btn" href="#cta">${escHtml(cta)}</a></div>

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
