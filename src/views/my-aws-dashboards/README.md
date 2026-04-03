# My AWS Dashboards

> A browser-based AWS cost and billing monitor with interactive charts, service breakdowns, and exportable reports — built as part of [vibe.j2team.org](https://vibe.j2team.org).

![My AWS Dashboards](https://vibe.j2team.org/my-aws-dashboard)

## Overview

**My AWS Dashboards** is a self-contained, client-side tool for visualizing AWS account costs and billing data. It ships with a full-featured demo mode using realistic simulated data so you can explore the dashboard immediately — no AWS account required.

When connected to a real AWS account, the app uses your credentials to query the **AWS Cost Explorer API** and display live billing data.

> [!IMPORTANT]
> AWS Cost Explorer does not support CORS for direct browser requests. When credentials are provided, the app will attempt a live connection and gracefully fall back to demo mode if CORS blocks the request. See [Real AWS Data](#real-aws-data) for workarounds.

## Features

- **Cost Explorer Dashboard** — visualize spending across all AWS services in a selected date range
- **4 Chart Types** — grouped bar, stacked bar, line chart, and donut chart
- **Date Range Filter** — pick any custom date range with daily or monthly granularity
- **Service Filter** — show or hide individual AWS services from the chart
- **Summary Cards** — total cost, top service, average per period, cost trend vs. previous period
- **Sortable Breakdown Table** — sort services by name, cost, or percentage share
- **Export Reports** — download the current dashboard data as **CSV** or **XLSX**
- **Demo Mode** — instantly explore with 6 months of realistic simulated AWS data
- **Secure Local Storage** — credentials are stored exclusively in your browser's `localStorage`, never transmitted to any server

## Architecture

```
src/views/my-aws-dashboard/
├── index.vue                      # Page entry — orchestrates auth vs. dashboard state
├── meta.ts                        # Page metadata for the launcher
├── types.ts                       # Shared TypeScript interfaces
├── components/
│   ├── AwsAuth.vue                # Credential input form
│   └── CostDashboard.vue          # Full dashboard with charts, table, and export
├── composables/
│   ├── useAwsCredentials.ts       # Credential persistence via localStorage
│   └── useAwsCost.ts              # Data fetching — real or demo fallback
└── utils/
    ├── demoData.ts                # Deterministic demo cost data generator
    ├── chartUtils.ts              # Chart.js config builders for each chart type
    └── exportUtils.ts             # CSV and XLSX export logic
```

## Getting Started

This app is part of the vibe.j2team.org project. To run it locally:

```sh
pnpm install
pnpm dev
```

Visit `http://localhost:5173/my-aws-dashboard`.

### Demo Mode

On first visit the AWS credential form is shown. Click **Try with Demo Data** to instantly load simulated data — no configuration needed. You can also click the **Demo** button in the page header at any time.

### Real AWS Data

To connect to your AWS account:

1. Go to **IAM → Users → Security credentials** in the AWS console.
2. Create an **Access Key** with the `ReadOnlyAccess` policy (or at minimum `ce:GetCostAndUsage`).
3. Click **Connect AWS** in the page header (or fill in the credential form shown on first visit), then enter the **Access Key ID**, **Secret Access Key**, and **Region**.

> [!WARNING]
> Due to CORS restrictions on the AWS Cost Explorer API endpoint (`ce.us-east-1.amazonaws.com`), direct browser requests are blocked. The app will show an error and revert to demo data.

**Workarounds for real data:**

- Use a browser extension that disables CORS (development only)
- Set up a local CORS proxy and point requests through it
- Run the equivalent AWS CLI command and paste the output:

```sh
aws ce get-cost-and-usage \
  --time-period Start=2025-11-01,End=2026-04-30 \
  --granularity MONTHLY \
  --group-by Type=DIMENSION,Key=SERVICE \
  --metrics BlendedCost
```

## Required AWS Permissions

The minimum IAM policy needed:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["ce:GetCostAndUsage"],
      "Resource": "*"
    }
  ]
}
```

## Security

- Credentials are stored **only in your browser's `localStorage`** under the key `my-aws-dashboard:credentials`.
- No data is sent to any third-party server — all API calls go directly to `*.amazonaws.com`.
- The app is deployed as a static site on Cloudflare Workers with no backend.
- Clear credentials at any time via the **Disconnect** button in the dashboard toolbar.

## Tech Stack

| Library | Purpose |
|---------|---------|
| Vue 3 + TypeScript | UI framework |
| VueUse `useLocalStorage` | Credential persistence |
| VueUse `useScriptTag` | Lazy-load Chart.js and SheetJS from CDN |
| [Chart.js 4](https://www.chartjs.org/) | Interactive charts (loaded from CDN) |
| [SheetJS (xlsx)](https://sheetjs.com/) | XLSX export (loaded from CDN on demand) |
| Tailwind CSS v4 | Styling via project design system |

## Author

Built by **J2TEAM** as part of [vibe.j2team.org](https://vibe.j2team.org).
