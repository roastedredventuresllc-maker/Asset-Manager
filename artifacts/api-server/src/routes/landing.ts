import { Router } from "express";
import { db, campaignsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

// GET /p/:slug — server-rendered landing page
router.get("/:slug", async (req, res) => {
  const campaign = await db.query.campaignsTable.findFirst({
    where: eq(campaignsTable.landingSlug, req.params.slug),
  });

  if (!campaign || !campaign.campaignJson) {
    return res.status(404).send(`<!DOCTYPE html>
<html><head><title>Not Found</title></head>
<body style="background:#F9F7F4;display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:Inter,sans-serif;">
<p style="color:#111;opacity:0.5;font-size:14px;">Page not found.</p>
</body></html>`);
  }

  const cj = campaign.campaignJson as {
    brandName: string;
    tagline: string;
    palette: string[];
    landing: { hero: string; sub: string; features: string[]; socialProof: string; cta: string };
  };

  const primary = cj.palette?.[0] ?? "#111111";
  const accent = cj.palette?.[1] ?? "#2563eb";
  const productImg = campaign.productImageUrl ?? "";

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escHtml(cj.brandName)}</title>
  <meta name="description" content="${escHtml(cj.landing.sub)}"/>
  <meta property="og:title" content="${escHtml(cj.brandName)} — ${escHtml(cj.tagline)}"/>
  <meta property="og:description" content="${escHtml(cj.landing.sub)}"/>
  <meta property="og:type" content="website"/>
  ${productImg ? `<meta property="og:image" content="${escHtml(productImg)}"/>` : ""}
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    :root{--primary:${primary};--accent:${accent}}
    body{background:#F9F7F4;color:#111111;font-family:'Inter',sans-serif;line-height:1.6}
    .hero{min-height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 24px;max-width:900px;margin:0 auto}
    .brand{font-size:13px;letter-spacing:3px;text-transform:uppercase;opacity:0.4;margin-bottom:32px;font-weight:500}
    h1{font-family:'Instrument Serif',serif;font-size:clamp(48px,8vw,88px);font-weight:400;line-height:1.1;margin-bottom:24px}
    .sub{font-size:18px;opacity:0.65;max-width:600px;margin:0 auto 48px}
    .cta-btn{display:inline-block;background:#111;color:#fff;padding:16px 40px;border-radius:40px;font-family:'Inter',sans-serif;font-size:15px;font-weight:600;text-decoration:none;letter-spacing:0.5px;transition:opacity .2s}
    .cta-btn:hover{opacity:0.8}
    ${productImg ? ".product-img{width:200px;height:200px;object-fit:contain;border-radius:16px;margin-bottom:48px;box-shadow:0 24px 48px rgba(0,0,0,0.1)}" : ""}
    .features{padding:100px 24px;max-width:1100px;margin:0 auto}
    .features-label{font-size:11px;letter-spacing:2px;text-transform:uppercase;opacity:0.35;text-align:center;margin-bottom:64px;font-weight:500}
    .features-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:32px}
    .feature-card{background:#fff;border-radius:16px;padding:32px;border:1px solid rgba(0,0,0,0.06)}
    .feature-num{font-size:11px;opacity:0.3;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px;font-weight:500}
    .feature-text{font-family:'Instrument Serif',serif;font-size:22px;line-height:1.4}
    .social{padding:80px 24px;text-align:center;max-width:700px;margin:0 auto}
    .social-proof{font-family:'Instrument Serif',serif;font-style:italic;font-size:22px;opacity:0.6}
    .footer-cta{padding:120px 24px;text-align:center;background:#fff;border-top:1px solid rgba(0,0,0,0.06)}
    .footer-cta h2{font-family:'Instrument Serif',serif;font-size:clamp(32px,5vw,56px);margin-bottom:32px}
    @media(max-width:600px){h1{font-size:40px}.features-grid{grid-template-columns:1fr}}
  </style>
</head>
<body>
  <section class="hero">
    ${productImg ? `<img class="product-img" src="${escHtml(productImg)}" alt="${escHtml(cj.brandName)}"/>` : ""}
    <p class="brand">${escHtml(cj.brandName)}</p>
    <h1>${escHtml(cj.landing.hero)}</h1>
    <p class="sub">${escHtml(cj.landing.sub)}</p>
    <a class="cta-btn" href="#">${escHtml(cj.landing.cta)}</a>
  </section>
  <section class="features">
    <p class="features-label">Why it works</p>
    <div class="features-grid">
      ${cj.landing.features.map((f: string, i: number) => `
      <div class="feature-card">
        <p class="feature-num">${String(i + 1).padStart(2, "0")}</p>
        <p class="feature-text">${escHtml(f)}</p>
      </div>`).join("")}
    </div>
  </section>
  <section class="social">
    <p class="social-proof">"${escHtml(cj.landing.socialProof)}"</p>
  </section>
  <section class="footer-cta">
    <h2>${escHtml(cj.tagline)}</h2>
    <a class="cta-btn" href="#">${escHtml(cj.landing.cta)}</a>
  </section>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  return res.send(html);
});

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export default router;
