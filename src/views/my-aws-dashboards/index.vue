<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { Icon } from '@iconify/vue'
import { RouterLink } from 'vue-router'
import { useHead } from '@unhead/vue'
import { useCognitoAuth } from './composables/useCognitoAuth'
import { useAwsCost } from './composables/useAwsCost'
import { useAwsResources } from './composables/useAwsResources'
import AwsAuth from './components/AwsAuth.vue'
import CostDashboard from './components/CostDashboard.vue'
import ResourcesDashboard from './components/ResourcesDashboard.vue'
import type { CognitoConfig, Granularity, ResourceFilters, ResourceSortField } from './types'

useHead({
  title: 'My AWS Dashboards — Cost & Billing Monitor',
  meta: [
    {
      name: 'description',
      content:
        'Monitor AWS resource costs with interactive charts, service breakdowns, and exportable reports.',
    },
  ],
})

// ─── Active tab ───────────────────────────────────────────────────────────────

type Tab = 'cost' | 'resources'
const activeTab = ref<Tab>('cost')

function switchTab(tab: Tab): void {
  activeTab.value = tab
  if (tab === 'resources') {
    const s = resources.status.value
    // Don't trigger a new load while one is in progress or after an error (use Refresh to retry)
    if (s === 'loading' || s === 'error') return
    // Load on first visit OR upgrade from demo → real after login
    if (!resources.hasReport.value || resources.isDemoMode.value) {
      if (isAuthenticated.value && session.value) {
        resources.loadRealData(
          session.value.accessKeyId,
          session.value.secretAccessKey,
          session.value.sessionToken,
          session.value.region,
        )
      } else {
        resources.loadDemoData()
      }
    }
  }
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

const showAuth = ref(false)

const {
  config: cognitoConfig,
  session,
  isAuthenticated,
  hasConfig,
  isAuthLoading,
  authError,
  remainingSeconds,
  login,
  clearConfig,
  initSession,
} = useCognitoAuth()

// ─── Cost dashboard ───────────────────────────────────────────────────────────

const {
  errorMessage,
  report,
  isDemoMode,
  isLoading,
  hasReport,
  loadDemoData,
  loadRealData,
  loadFromCliOutput,
} = useAwsCost()

const DEFAULT_START = '2026-01-01'
const DEFAULT_END = new Date().toISOString().slice(0, 10)

// ─── Resources dashboard ──────────────────────────────────────────────────────

const resources = useAwsResources()

// ─── Session countdown display ────────────────────────────────────────────────

const sessionCountdown = computed(() => {
  if (!isAuthenticated.value) return ''
  const total = remainingSeconds.value
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
})

const countdownUrgent = computed(() => remainingSeconds.value > 0 && remainingSeconds.value <= 60)

// ─── Cost data fetching ───────────────────────────────────────────────────────

function fetchData(
  start: string,
  end: string,
  granularity: Granularity,
  services: string[],
  useRealData: boolean,
): void {
  if (useRealData && isAuthenticated.value && session.value) {
    loadRealData(
      session.value.accessKeyId,
      session.value.secretAccessKey,
      session.value.sessionToken,
      session.value.region,
      start,
      end,
      granularity,
      services,
    )
  } else {
    loadDemoData(start, end, granularity, services)
  }
}

// ─── Event handlers ───────────────────────────────────────────────────────────

async function handleConnect(cfg: CognitoConfig): Promise<void> {
  try {
    await login(cfg)
    showAuth.value = false
    // Reload cost data with real credentials
    fetchData(DEFAULT_START, DEFAULT_END, 'MONTHLY', [], true)
    // Reload resources with real credentials (replaces demo data if already shown)
    if (session.value) {
      resources.loadRealData(
        session.value.accessKeyId,
        session.value.secretAccessKey,
        session.value.sessionToken,
        session.value.region,
      )
    }
  } catch {
    // authError reactive ref is already set by useCognitoAuth — shown in AwsAuth
  }
}

function handleDemo(): void {
  showAuth.value = false
  loadDemoData(DEFAULT_START, DEFAULT_END, 'MONTHLY', [])
}

function handleRefresh(
  start: string,
  end: string,
  granularity: Granularity,
  services: string[],
  useRealData: boolean,
): void {
  fetchData(start, end, granularity, services, useRealData)
}

function handleDisconnect(): void {
  clearConfig()
  window.location.reload()
}

function handleCliOutput(json: string, granularity: Granularity, services: string[]): void {
  loadFromCliOutput(json, granularity, services)
}

// ─── Resources handlers ───────────────────────────────────────────────────────

function handleResourceFilters(filters: ResourceFilters): void {
  resources.filters.value = filters
}

function handleResourceSort(field: ResourceSortField): void {
  resources.setSort(field)
}

onMounted(() => {
  if (!hasReport.value && isAuthenticated.value && session.value) {
    // Active in-memory session (same-tab navigation) — reload data
    loadRealData(
      session.value.accessKeyId,
      session.value.secretAccessKey,
      session.value.sessionToken,
      session.value.region,
      DEFAULT_START,
      DEFAULT_END,
      'MONTHLY',
      [],
    )
    return
  }

  // Page refresh — restore session from sessionStorage (no Cognito round-trip).
  // If the 5-minute window has not elapsed, resume the existing session and
  // reload the dashboard data automatically.
  const restored = initSession()
  if (restored && session.value) {
    loadRealData(
      session.value.accessKeyId,
      session.value.secretAccessKey,
      session.value.sessionToken,
      session.value.region,
      DEFAULT_START,
      DEFAULT_END,
      'MONTHLY',
      [],
    )
  }
  // First-time visitor or page refresh — show auth form (session is in-memory only)
})
</script>

<template>
  <div class="min-h-screen bg-bg-deep">
    <!-- Header -->
    <header class="border-b border-border-default bg-bg-surface">
      <div class="mx-auto max-w-7xl px-4 py-4 sm:px-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <!-- Logo + title -->
          <div class="flex items-center gap-3">
            <div
              class="flex size-9 items-center justify-center border border-accent-coral bg-bg-elevated"
            >
              <Icon icon="lucide:cloud" class="size-5 text-accent-coral" />
            </div>
            <div>
              <h1 class="font-display text-lg font-bold text-text-primary leading-none">
                My <span class="text-accent-amber">AWS</span> Dashboards
              </h1>
              <p class="mt-0.5 font-display text-xs text-text-dim">Cost & Billing Monitor</p>
            </div>
          </div>

          <!-- Nav -->
          <nav class="flex items-center gap-3">
            <!-- Tab switcher -->
            <div class="hidden items-center gap-1 sm:flex">
              <button
                type="button"
                class="flex items-center gap-1.5 border px-3 py-1.5 font-display text-xs font-semibold transition-colors"
                :class="
                  activeTab === 'cost'
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                    : 'border-border-default text-text-dim hover:border-accent-coral/40 hover:text-text-secondary'
                "
                @click="switchTab('cost')"
              >
                <Icon icon="lucide:dollar-sign" class="size-3.5" />
                Cost & Billing
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 border px-3 py-1.5 font-display text-xs font-semibold transition-colors"
                :class="
                  activeTab === 'resources'
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                    : 'border-border-default text-text-dim hover:border-accent-coral/40 hover:text-text-secondary'
                "
                @click="switchTab('resources')"
              >
                <Icon icon="lucide:server" class="size-3.5" />
                Resources
              </button>
            </div>

            <!-- Mobile tab switcher -->
            <div class="flex items-center gap-1 sm:hidden">
              <button
                type="button"
                class="flex items-center gap-1 border px-2.5 py-1.5 font-display text-xs transition-colors"
                :class="
                  activeTab === 'cost'
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                    : 'border-border-default text-text-dim'
                "
                @click="switchTab('cost')"
              >
                <Icon icon="lucide:dollar-sign" class="size-3.5" />
              </button>
              <button
                type="button"
                class="flex items-center gap-1 border px-2.5 py-1.5 font-display text-xs transition-colors"
                :class="
                  activeTab === 'resources'
                    ? 'border-accent-coral bg-accent-coral/10 text-accent-coral'
                    : 'border-border-default text-text-dim'
                "
                @click="switchTab('resources')"
              >
                <Icon icon="lucide:server" class="size-3.5" />
              </button>
            </div>

            <!-- Session countdown — shown when authenticated -->
            <div
              v-if="isAuthenticated"
              class="flex items-center gap-1.5 border px-2.5 py-1.5 font-display text-xs"
              :class="
                countdownUrgent
                  ? 'border-red-500/40 bg-red-500/5 text-red-400 animate-pulse'
                  : 'border-accent-amber/30 bg-accent-amber/5 text-accent-amber'
              "
              :title="`Session expires in ${sessionCountdown}`"
            >
              <Icon icon="lucide:timer" class="size-3.5" />
              <span>{{ sessionCountdown }}</span>
            </div>

            <!-- Connection status badge -->
            <div
              class="flex items-center gap-1.5 border px-2.5 py-1.5 font-display text-xs"
              :class="
                isAuthenticated
                  ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400'
                  : isDemoMode
                    ? 'border-accent-sky/30 bg-accent-sky/5 text-accent-sky'
                    : 'border-border-default text-text-dim'
              "
            >
              <Icon
                :icon="isAuthenticated ? 'lucide:shield-check' : 'lucide:database'"
                class="size-3.5"
              />
              <span>{{ isAuthenticated ? 'Cognito Connected' : 'Demo Mode' }}</span>
            </div>

            <!-- Logout button — only shown when Cognito session is active -->
            <button
              v-if="isAuthenticated"
              type="button"
              class="flex items-center gap-1.5 border border-red-500/40 bg-red-500/5 px-2.5 py-1.5 font-display text-xs text-red-400 transition-colors hover:border-red-500/70 hover:bg-red-500/10"
              title="Logout — clears in-memory session credentials"
              @click="handleDisconnect"
            >
              <Icon icon="lucide:log-out" class="size-3.5" />
              <span class="hidden sm:inline">Logout</span>
            </button>

            <!-- Connect button — shown when no active session -->
            <button
              v-if="!isAuthenticated"
              type="button"
              class="flex items-center gap-1.5 border border-accent-coral bg-accent-coral/10 px-2.5 py-1.5 font-display text-xs font-semibold text-accent-coral transition-colors hover:bg-accent-coral/20"
              @click="showAuth = true"
            >
              <Icon icon="lucide:plug" class="size-3.5" />
              <span class="hidden sm:inline">{{ hasConfig ? 'Reconnect' : 'Connect AWS' }}</span>
            </button>

            <!-- Demo mode button — shown when not authenticated and not in demo -->
            <button
              v-if="!isAuthenticated && !isDemoMode && activeTab === 'cost'"
              type="button"
              class="flex items-center gap-1.5 border border-accent-sky/50 bg-accent-sky/10 px-2.5 py-1.5 font-display text-xs text-accent-sky transition-colors hover:bg-accent-sky/20"
              @click="handleDemo"
            >
              <Icon icon="lucide:layout-dashboard" class="size-3.5" />
              <span class="hidden sm:inline">Demo</span>
            </button>

            <RouterLink
              to="/"
              class="flex items-center gap-1.5 border border-border-default bg-bg-elevated px-2.5 py-1.5 font-display text-xs text-text-secondary transition-colors hover:border-accent-coral/50 hover:text-accent-coral"
            >
              <Icon icon="lucide:home" class="size-3.5" />
              <span class="hidden sm:inline">Home</span>
            </RouterLink>
          </nav>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <main class="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <!-- ─── Cost Tab ──────────────────────────────────────────────── -->
      <template v-if="activeTab === 'cost'">
        <!-- Auth screen — shown when no report yet -->
        <div v-if="!hasReport && !isLoading">
          <AwsAuth
            :saved-config="cognitoConfig"
            :is-loading="isAuthLoading"
            :error-message="authError"
            @connect="handleConnect"
            @demo="handleDemo"
          />
        </div>

        <!-- Initial loading (no report yet) -->
        <div
          v-else-if="!hasReport && isLoading"
          class="flex min-h-[50vh] items-center justify-center"
        >
          <div class="flex flex-col items-center gap-4 animate-fade-up">
            <div
              class="flex size-16 items-center justify-center border border-accent-coral bg-bg-surface"
            >
              <Icon icon="lucide:loader-circle" class="size-8 animate-spin text-accent-coral" />
            </div>
            <p class="font-display text-sm text-text-secondary">Fetching cost data…</p>
          </div>
        </div>

        <!-- Dashboard — stays mounted across refreshes so filter state is preserved -->
        <div v-else class="animate-fade-up">
          <!-- Dashboard header -->
          <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-bold text-text-primary">
                <span class="text-accent-coral">//</span> Cost Explorer
              </h2>
              <p class="mt-1 text-sm text-text-secondary">
                {{ report?.dateRange.start }} — {{ report?.dateRange.end }} ·
                <span class="text-text-dim"
                  >{{
                    report?.granularity.charAt(0) +
                    (report?.granularity.slice(1).toLowerCase() ?? '')
                  }}
                  view</span
                >
              </p>
            </div>
          </div>

          <!-- Refresh loading indicator — inline banner, keeps CostDashboard mounted -->
          <div
            v-if="isLoading"
            class="mb-4 flex items-center gap-3 border border-accent-coral/30 bg-accent-coral/5 px-4 py-3"
          >
            <Icon
              icon="lucide:loader-circle"
              class="size-4 shrink-0 animate-spin text-accent-coral"
            />
            <p class="font-display text-sm text-text-secondary">Fetching cost data…</p>
          </div>

          <CostDashboard
            v-if="report"
            :report="report"
            :is-demo-mode="isDemoMode"
            :has-credentials="isAuthenticated"
            :error-message="errorMessage"
            @refresh="handleRefresh"
            @disconnect="handleDisconnect"
            @cli-output="handleCliOutput"
          />
        </div>
      </template>

      <!-- ─── Resources Tab ──────────────────────────────────────────────── -->
      <div v-else-if="activeTab === 'resources'" class="animate-fade-up">
        <!-- Loading -->
        <div v-if="resources.isLoading.value" class="flex min-h-[50vh] items-center justify-center">
          <div class="flex flex-col items-center gap-4">
            <div
              class="flex size-16 items-center justify-center border border-accent-coral bg-bg-surface"
            >
              <Icon icon="lucide:loader-circle" class="size-8 animate-spin text-accent-coral" />
            </div>
            <p class="font-display text-sm text-text-secondary">Loading resources…</p>
          </div>
        </div>

        <!-- Error state (no report loaded — real data fetch failed) -->
        <div
          v-else-if="resources.status.value === 'error' && !resources.hasReport.value"
          class="animate-fade-up"
        >
          <div class="mx-auto max-w-2xl space-y-4">
            <!-- Error banner -->
            <div class="flex items-start gap-4 border border-red-500/30 bg-red-500/5 p-5">
              <div
                class="flex size-10 shrink-0 items-center justify-center border border-red-500/30 bg-red-500/10"
              >
                <Icon icon="lucide:triangle-alert" class="size-5 text-red-400" />
              </div>
              <div class="min-w-0">
                <p class="font-display text-sm font-semibold text-red-400">
                  Could not load real AWS resources
                </p>
                <p class="mt-1 font-display text-xs leading-relaxed text-red-400/80">
                  {{ resources.errorMessage.value }}
                </p>
              </div>
            </div>

            <!-- IAM fix guide (access denied only) -->
            <div
              v-if="resources.errorCode.value === 'access_denied'"
              class="border border-accent-amber/30 bg-accent-amber/5 p-5 space-y-3"
            >
              <div class="flex items-center gap-2">
                <Icon icon="lucide:shield-alert" class="size-4 text-accent-amber" />
                <p class="font-display text-sm font-semibold text-accent-amber">
                  How to fix: add the missing IAM permission
                </p>
              </div>
              <ol
                class="space-y-1.5 font-display text-xs text-text-secondary list-decimal list-inside"
              >
                <li>Open <strong class="text-text-primary">AWS Console → IAM → Roles</strong></li>
                <li>
                  Find your Cognito unauthenticated role (e.g.
                  <code class="text-accent-coral">MyAwsDashboardUnauthRole</code>)
                </li>
                <li>
                  Click
                  <strong class="text-text-primary">Add permissions → Create inline policy</strong>
                </li>
                <li>
                  Switch to the <strong class="text-text-primary">JSON</strong> tab and paste the
                  policy below
                </li>
              </ol>
              <pre
                class="overflow-x-auto border border-border-default bg-bg-deep p-3 font-mono text-xs text-text-secondary leading-relaxed"
              ><code>{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "tag:GetResources"
      ],
      "Resource": "*"
    }
  ]
}</code></pre>
              <p class="font-display text-xs text-text-dim">
                After saving, click <strong class="text-text-primary">Retry</strong> below — no need
                to reconnect.
              </p>
            </div>

            <!-- Action buttons -->
            <div class="flex flex-wrap gap-3">
              <button
                v-if="isAuthenticated && session"
                type="button"
                class="flex items-center gap-1.5 border border-accent-coral bg-accent-coral/10 px-4 py-2 font-display text-xs font-semibold text-accent-coral transition-colors hover:bg-accent-coral/20"
                @click="
                  resources.loadRealData(
                    session.accessKeyId,
                    session.secretAccessKey,
                    session.sessionToken,
                    session.region,
                  )
                "
              >
                <Icon icon="lucide:refresh-cw" class="size-3.5" />
                Retry
              </button>
              <button
                type="button"
                class="flex items-center gap-1.5 border border-accent-sky/50 bg-accent-sky/10 px-4 py-2 font-display text-xs text-accent-sky transition-colors hover:bg-accent-sky/20"
                @click="resources.loadDemoData()"
              >
                <Icon icon="lucide:layout-dashboard" class="size-3.5" />
                Load Demo Data
              </button>
            </div>
          </div>
        </div>

        <!-- Dashboard -->
        <div v-else-if="resources.hasReport.value">
          <!-- Dashboard header -->
          <div class="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 class="font-display text-xl font-bold text-text-primary">
                <span class="text-accent-coral">//</span> AWS Resources
              </h2>
              <p class="mt-1 text-sm text-text-secondary">
                Inventory of all provisioned AWS resources ·
                <span class="text-text-dim">{{ resources.stats.value.total }} total</span>
              </p>
            </div>
            <button
              type="button"
              class="flex items-center gap-1.5 border border-accent-sky/50 bg-accent-sky/10 px-3 py-1.5 font-display text-xs text-accent-sky transition-colors hover:bg-accent-sky/20"
              @click="
                isAuthenticated && session
                  ? resources.loadRealData(
                      session.accessKeyId,
                      session.secretAccessKey,
                      session.sessionToken,
                      session.region,
                    )
                  : resources.loadDemoData()
              "
            >
              <Icon icon="lucide:refresh-cw" class="size-3.5" />
              Refresh
            </button>
          </div>

          <ResourcesDashboard
            :report="resources.report.value!"
            :filtered-resources="resources.filteredResources.value"
            :filters="resources.filters.value"
            :sort-field="resources.sortField.value"
            :sort-dir="resources.sortDir.value"
            :stats="resources.stats.value"
            :is-demo-mode="resources.isDemoMode.value"
            :error-message="resources.errorMessage.value"
            @update:filters="handleResourceFilters"
            @sort="handleResourceSort"
            @reset-filters="resources.resetFilters()"
          />
        </div>
      </div>
    </main>

    <!-- Auth modal overlay -->
    <Teleport to="body">
      <div
        v-if="showAuth"
        class="fixed inset-0 z-50 flex items-center justify-center bg-bg-deep/80 backdrop-blur-sm"
        @click.self="showAuth = false"
      >
        <div class="relative w-full max-w-lg mx-4">
          <button
            type="button"
            class="absolute -top-3 -right-3 z-10 flex size-7 items-center justify-center border border-border-default bg-bg-surface text-text-dim hover:text-text-primary"
            aria-label="Close"
            @click="showAuth = false"
          >
            <Icon icon="lucide:x" class="size-4" />
          </button>
          <AwsAuth
            :saved-config="cognitoConfig"
            :is-loading="isAuthLoading"
            :error-message="authError"
            @connect="handleConnect"
            @demo="handleDemo"
          />
        </div>
      </div>
    </Teleport>

    <!-- Footer -->
    <footer class="mt-12 border-t border-border-default py-6 text-center">
      <p class="font-display text-xs text-text-dim">
        <span class="text-accent-coral">//</span> My AWS Dashboards · Part of
        <RouterLink to="/" class="text-accent-sky hover:underline">vibe.j2team.org</RouterLink> ·
        Cognito-authenticated · Credentials kept in memory only · Session expires in 5 min.
      </p>
    </footer>
  </div>
</template>
