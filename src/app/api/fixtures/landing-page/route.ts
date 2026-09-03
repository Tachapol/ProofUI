import { NextResponse } from "next/server";

export async function GET() {
  const fixtureHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Acme Cloud Platform</title>
  <style>
    :root {
      --bg: #ffffff;
      --text: #09090b;
      --primary: #2563eb;
      --surface: #f4f4f5;
      --border: #e4e4e7;
    }
    body {
      margin: 0;
      font-family: system-ui, -apple-system, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    header.header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      border-bottom: 1px solid var(--border);
    }
    nav.nav a {
      margin-left: 20px;
      text-decoration: none;
      color: var(--text);
      font-size: 14px;
    }
    section.hero {
      padding: 64px 32px;
      text-align: center;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 {
      font-size: 48px;
      font-weight: 800;
      margin-bottom: 16px;
    }
    p.subtitle {
      font-size: 18px;
      color: #71717a;
      margin-bottom: 32px;
    }
    button.btn-primary {
      background-color: var(--primary);
      color: #ffffff;
      padding: 12px 24px;
      border-radius: 8px;
      border: none;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
    }
    section.features.grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
      max-width: 1100px;
      margin: 48px auto;
      padding: 0 32px;
    }
    .card {
      background-color: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 24px;
    }
    footer.footer {
      border-top: 1px solid var(--border);
      padding: 32px;
      text-align: center;
      color: #71717a;
      font-size: 14px;
      margin-top: 64px;
    }
  </style>
</head>
<body>
  <header class="header">
    <div class="logo"><strong>Acme Cloud</strong></div>
    <nav class="nav">
      <a href="/features">Features</a>
      <a href="/pricing">Pricing</a>
      <a href="/about">About</a>
    </nav>
  </header>

  <main>
    <section class="hero">
      <h1>Scale Your Workflows Instantly</h1>
      <p class="subtitle">Deploy edge compute and realtime analytics in seconds.</p>
      <button class="btn-primary">Get Started Free</button>
    </section>

    <section class="features grid">
      <div class="card">
        <h3>Fast Deployment</h3>
        <p>Deploy containers worldwide with zero configuration.</p>
      </div>
      <div class="card">
        <h3>Realtime Metrics</h3>
        <p>Sub-millisecond telemetry for mission critical infra.</p>
      </div>
      <div class="card">
        <h3>Global Edge</h3>
        <p>Over 300 edge locations with automated failover.</p>
      </div>
    </section>
  </main>

  <footer class="footer">
    <p>&copy; 2026 Acme Cloud Inc. All rights reserved.</p>
  </footer>
</body>
</html>`;

  return new NextResponse(fixtureHtml, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}
