<script setup lang="ts">
import { computed, ref } from 'vue'
import { useScriptTag } from '@vueuse/core'
import { Icon } from '@iconify/vue'
import type {
  ResourceReport,
  ResourceFilters,
  ResourceSortField,
  ResourceSortDir,
  AwsResource,
  ResourceType,
  ResourceStatus,
  XLSXLibrary,
} from '../types'
import { RESOURCE_TYPES, RESOURCE_REGIONS } from '../utils/resourceDemoData'
import { downloadResourcesCsv, downloadResourcesXlsx } from '../utils/resourceExportUtils'

const props = defineProps<{
  report: ResourceReport
  filteredResources: AwsResource[]
  filters: ResourceFilters
  sortField: ResourceSortField
  sortDir: ResourceSortDir
  stats: {
    total: number
    active: number
    inactive: number
    unknown: number
    topType: { type: string; count: number } | null
  }
  isDemoMode: boolean
  errorMessage: string
}>()

const emit = defineEmits<{
  'update:filters': [filters: ResourceFilters]
  sort: [field: ResourceSortField]
  resetFilters: []
}>()

// ─── XLSX lazy load ───────────────────────────────────────────────────────────

const xlsxReady = ref(false)
let xlsxLib: XLSXLibrary | null = null

const { load: loadXlsx } = useScriptTag(
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  () => {
    xlsxLib = (window as unknown as { XLSX: XLSXLibrary }).XLSX
    xlsxReady.value = true
  },
  { manual: true },
)

// ─── Filter helpers ───────────────────────────────────────────────────────────

function setFilter<K extends keyof ResourceFilters>(key: K, value: ResourceFilters[K]): void {
  emit('update:filters', { ...props.filters, [key]: value })
}

const activeFilterCount = computed(() => {
  let count = 0
  if (props.filters.type !== 'ALL') count++
  if (props.filters.status !== 'ALL') count++
  if (props.filters.region !== 'ALL') count++
  if (props.filters.search.trim()) count++
  return count
})

// ─── Sort helpers ─────────────────────────────────────────────────────────────

function handleSort(field: ResourceSortField): void {
  emit('sort', field)
}

function sortIcon(field: ResourceSortField): string {
  if (props.sortField !== field) return 'lucide:chevrons-up-down'
  return props.sortDir === 'asc' ? 'lucide:chevron-up' : 'lucide:chevron-down'
}

// ─── Detail expand ────────────────────────────────────────────────────────────

const expandedIds = ref<Set<string>>(new Set())

function toggleExpand(id: string): void {
  const next = new Set(expandedIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  expandedIds.value = next
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function statusClass(status: ResourceStatus): string {
  if (status === 'active') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
  if (status === 'inactive') return 'border-red-500/40 bg-red-500/10 text-red-400'
  return 'border-accent-amber/40 bg-accent-amber/10 text-accent-amber'
}

function statusIcon(status: ResourceStatus): string {
  if (status === 'active') return 'lucide:circle-check'
  if (status === 'inactive') return 'lucide:circle-x'
  return 'lucide:circle-help'
}

// ─── Type icon ────────────────────────────────────────────────────────────────

function typeIcon(type: ResourceType): string {
  const map: Partial<Record<ResourceType, string>> = {
    EC2: 'lucide:server',
    S3: 'lucide:hard-drive',
    RDS: 'lucide:database',
    Lambda: 'lucide:zap',
    CloudFront: 'lucide:globe',
    ElastiCache: 'lucide:layers',
    DynamoDB: 'lucide:table-2',
    ECS: 'lucide:container',
    EKS: 'lucide:network',
    SQS: 'lucide:mail',
    SNS: 'lucide:bell',
    IAM: 'lucide:shield',
    VPC: 'lucide:waypoints',
    Route53: 'lucide:map-pin',
    CloudWatch: 'lucide:activity',
  }
  return map[type] ?? 'lucide:box'
}

// ─── Tags display ─────────────────────────────────────────────────────────────

function tagEntries(tags: Record<string, string>): { key: string; value: string }[] {
  return Object.entries(tags).map(([key, value]) => ({ key, value }))
}

// ─── Export ───────────────────────────────────────────────────────────────────

function handleExportCsv(): void {
  downloadResourcesCsv({
    resources: props.filteredResources,
    generatedAt: props.report.generatedAt,
  })
}

async function handleExportXlsx(): Promise<void> {
  if (!xlsxReady.value) {
    await loadXlsx()
  }
  if (xlsxLib) {
    downloadResourcesXlsx(
      { resources: props.filteredResources, generatedAt: props.report.generatedAt },
      xlsxLib,
    )
  }
}

// ─── Pagination ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 25
const currentPage = ref(1)

const totalPages = computed(() =>
  Math.max(1, Math.ceil(props.filteredResources.length / PAGE_SIZE)),
)

const pagedResources = computed(() => {
  const start = (currentPage.value - 1) * PAGE_SIZE
  return props.filteredResources.slice(start, start + PAGE_SIZE)
})

function goPage(n: number): void {
  currentPage.value = Math.min(Math.max(1, n), totalPages.value)
}
</script>

<template>
  <div class="space-y-6">
    <!-- ─── Error / CORS banner ───────────────────────────────────────────── -->
    <div
      v-if="errorMessage"
      class="flex items-start gap-3 border border-red-500/30 bg-red-500/5 px-4 py-3"
    >
      <Icon icon="lucide:triangle-alert" class="mt-0.5 size-4 shrink-0 text-red-400" />
      <div class="min-w-0">
        <p class="font-display text-sm font-semibold text-red-400">Could not load real data</p>
        <p class="mt-0.5 font-display text-xs text-red-400/80">{{ errorMessage }}</p>
      </div>
    </div>

    <!-- ─── Summary Cards ─────────────────────────────────────────────────── -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <!-- Total -->
      <div class="border border-border-default bg-bg-surface p-4">
        <p class="font-display text-xs text-text-dim">Total Resources</p>
        <p class="mt-1.5 font-display text-2xl font-bold text-text-primary tabular-nums">
          {{ stats.total }}
        </p>
        <p class="mt-1 font-display text-xs text-text-dim">
          across {{ RESOURCE_TYPES.length }} types
        </p>
      </div>

      <!-- Active -->
      <div class="border border-emerald-500/20 bg-emerald-500/5 p-4">
        <p class="font-display text-xs text-emerald-400/70">Active</p>
        <p class="mt-1.5 font-display text-2xl font-bold text-emerald-400 tabular-nums">
          {{ stats.active }}
        </p>
        <p class="mt-1 font-display text-xs text-emerald-400/50">
          {{ stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0 }}% of total
        </p>
      </div>

      <!-- Inactive -->
      <div class="border border-red-500/20 bg-red-500/5 p-4">
        <p class="font-display text-xs text-red-400/70">Inactive</p>
        <p class="mt-1.5 font-display text-2xl font-bold text-red-400 tabular-nums">
          {{ stats.inactive }}
        </p>
        <p class="mt-1 font-display text-xs text-red-400/50">
          {{ stats.total > 0 ? Math.round((stats.inactive / stats.total) * 100) : 0 }}% of total
        </p>
      </div>

      <!-- Top Type -->
      <div class="border border-accent-sky/20 bg-accent-sky/5 p-4">
        <p class="font-display text-xs text-accent-sky/70">Top Type</p>
        <p class="mt-1.5 font-display text-2xl font-bold text-accent-sky tabular-nums">
          {{ stats.topType?.type ?? '—' }}
        </p>
        <p class="mt-1 font-display text-xs text-accent-sky/50">
          {{ stats.topType?.count ?? 0 }} resources
        </p>
      </div>
    </div>

    <!-- ─── Filter Bar ─────────────────────────────────────────────────────── -->
    <div class="border border-border-default bg-bg-surface">
      <!-- Filter header -->
      <div
        class="flex flex-wrap items-center justify-between gap-2 border-b border-border-default px-4 py-3"
      >
        <div class="flex items-center gap-2">
          <Icon icon="lucide:sliders-horizontal" class="size-4 text-accent-coral" />
          <span class="font-display text-sm font-semibold text-text-primary">Filters</span>
          <span
            v-if="activeFilterCount > 0"
            class="flex size-5 items-center justify-center border border-accent-coral bg-accent-coral/10 font-display text-xs text-accent-coral"
          >
            {{ activeFilterCount }}
          </span>
        </div>
        <button
          v-if="activeFilterCount > 0"
          type="button"
          class="flex items-center gap-1 font-display text-xs text-text-dim transition-colors hover:text-accent-coral"
          @click="$emit('resetFilters')"
        >
          <Icon icon="lucide:x" class="size-3" />
          Clear all
        </button>
      </div>

      <!-- Filter controls -->
      <div class="flex flex-wrap gap-3 p-4">
        <!-- Search -->
        <div class="relative min-w-48 flex-1">
          <Icon
            icon="lucide:search"
            class="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-text-dim"
          />
          <input
            type="search"
            :value="filters.search"
            placeholder="Search name, ID, tag…"
            class="w-full border border-border-default bg-bg-elevated py-2 pl-8 pr-3 font-display text-xs text-text-primary placeholder:text-text-dim focus:border-accent-coral/50 focus:outline-none"
            @input="setFilter('search', ($event.target as HTMLInputElement).value)"
          />
        </div>

        <!-- Resource type -->
        <select
          :value="filters.type"
          class="border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-primary focus:border-accent-coral/50 focus:outline-none"
          @change="
            setFilter('type', ($event.target as HTMLSelectElement).value as ResourceFilters['type'])
          "
        >
          <option value="ALL">All Types</option>
          <option v-for="t in RESOURCE_TYPES" :key="t" :value="t">{{ t }}</option>
        </select>

        <!-- Status -->
        <select
          :value="filters.status"
          class="border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-primary focus:border-accent-coral/50 focus:outline-none"
          @change="
            setFilter(
              'status',
              ($event.target as HTMLSelectElement).value as ResourceFilters['status'],
            )
          "
        >
          <option value="ALL">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="unknown">Unknown</option>
        </select>

        <!-- Region -->
        <select
          :value="filters.region"
          class="border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-primary focus:border-accent-coral/50 focus:outline-none"
          @change="setFilter('region', ($event.target as HTMLSelectElement).value)"
        >
          <option value="ALL">All Regions</option>
          <option v-for="r in RESOURCE_REGIONS" :key="r.value" :value="r.value">
            {{ r.value }}
          </option>
        </select>

        <!-- Export buttons -->
        <div class="ml-auto flex items-center gap-2">
          <button
            type="button"
            class="flex items-center gap-1.5 border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-secondary transition-colors hover:border-accent-coral/50 hover:text-accent-coral"
            title="Export current view as CSV"
            @click="handleExportCsv"
          >
            <Icon icon="lucide:download" class="size-3.5" />
            CSV
          </button>
          <button
            type="button"
            class="flex items-center gap-1.5 border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-secondary transition-colors hover:border-accent-coral/50 hover:text-accent-coral"
            title="Export current view as XLSX"
            @click="handleExportXlsx"
          >
            <Icon icon="lucide:file-spreadsheet" class="size-3.5" />
            XLSX
          </button>
        </div>
      </div>

      <!-- Result count -->
      <div class="border-t border-border-default px-4 py-2">
        <p class="font-display text-xs text-text-dim">
          Showing
          <span class="text-text-secondary">{{ filteredResources.length }}</span>
          of
          <span class="text-text-secondary">{{ stats.total }}</span>
          resources
          <span v-if="isDemoMode" class="ml-2 text-accent-sky">[Demo Data]</span>
        </p>
      </div>
    </div>

    <!-- ─── Resources Table ───────────────────────────────────────────────── -->
    <div class="border border-border-default bg-bg-surface">
      <!-- Empty state -->
      <div
        v-if="filteredResources.length === 0"
        class="flex flex-col items-center gap-4 py-20 text-center"
      >
        <div
          class="flex size-14 items-center justify-center border border-border-default bg-bg-elevated"
        >
          <Icon icon="lucide:search-x" class="size-7 text-text-dim" />
        </div>
        <div>
          <p class="font-display text-sm font-semibold text-text-secondary">No resources found</p>
          <p class="mt-1 font-display text-xs text-text-dim">
            Try adjusting your filters or
            <button
              type="button"
              class="text-accent-coral underline underline-offset-2 hover:no-underline"
              @click="$emit('resetFilters')"
            >
              clear all
            </button>
          </p>
        </div>
      </div>

      <!-- Table -->
      <div v-else class="overflow-x-auto">
        <table class="w-full min-w-[800px] border-collapse">
          <!-- Head -->
          <thead>
            <tr class="border-b border-border-default bg-bg-elevated">
              <th class="px-4 py-3 text-left font-display text-xs text-text-dim">
                <!-- expand col -->
              </th>
              <th
                class="cursor-pointer px-4 py-3 text-left font-display text-xs text-text-dim transition-colors hover:text-text-primary"
                @click="handleSort('name')"
              >
                <div class="flex items-center gap-1">
                  Name / ID
                  <Icon :icon="sortIcon('name')" class="size-3" />
                </div>
              </th>
              <th
                class="cursor-pointer px-4 py-3 text-left font-display text-xs text-text-dim transition-colors hover:text-text-primary"
                @click="handleSort('type')"
              >
                <div class="flex items-center gap-1">
                  Type
                  <Icon :icon="sortIcon('type')" class="size-3" />
                </div>
              </th>
              <th
                class="cursor-pointer px-4 py-3 text-left font-display text-xs text-text-dim transition-colors hover:text-text-primary"
                @click="handleSort('status')"
              >
                <div class="flex items-center gap-1">
                  Status
                  <Icon :icon="sortIcon('status')" class="size-3" />
                </div>
              </th>
              <th
                class="cursor-pointer px-4 py-3 text-left font-display text-xs text-text-dim transition-colors hover:text-text-primary"
                @click="handleSort('region')"
              >
                <div class="flex items-center gap-1">
                  Region
                  <Icon :icon="sortIcon('region')" class="size-3" />
                </div>
              </th>
              <th
                class="cursor-pointer px-4 py-3 text-left font-display text-xs text-text-dim transition-colors hover:text-text-primary"
                @click="handleSort('createdAt')"
              >
                <div class="flex items-center gap-1">
                  Created At
                  <Icon :icon="sortIcon('createdAt')" class="size-3" />
                </div>
              </th>
            </tr>
          </thead>

          <!-- Body -->
          <tbody>
            <template v-for="resource in pagedResources" :key="resource.id">
              <!-- Main row -->
              <tr
                class="group border-b border-border-default transition-colors hover:bg-bg-elevated"
                :class="expandedIds.has(resource.id) ? 'bg-bg-elevated' : ''"
              >
                <!-- Expand toggle -->
                <td class="w-8 px-2 py-3 text-center">
                  <button
                    type="button"
                    class="flex size-5 items-center justify-center text-text-dim transition-colors hover:text-accent-coral"
                    :title="expandedIds.has(resource.id) ? 'Collapse' : 'Expand'"
                    @click="toggleExpand(resource.id)"
                  >
                    <Icon
                      :icon="
                        expandedIds.has(resource.id)
                          ? 'lucide:chevron-down'
                          : 'lucide:chevron-right'
                      "
                      class="size-3.5"
                    />
                  </button>
                </td>

                <!-- Name / ID -->
                <td class="px-4 py-3">
                  <p class="font-display text-sm font-medium text-text-primary">
                    {{ resource.name }}
                  </p>
                  <p class="mt-0.5 font-display text-xs text-text-dim">{{ resource.id }}</p>
                </td>

                <!-- Type -->
                <td class="px-4 py-3">
                  <div class="flex items-center gap-1.5">
                    <Icon :icon="typeIcon(resource.type)" class="size-3.5 text-accent-coral" />
                    <span class="font-display text-xs text-text-secondary">{{
                      resource.type
                    }}</span>
                  </div>
                  <p v-if="resource.detail" class="mt-0.5 font-display text-xs text-text-dim">
                    {{ resource.detail }}
                  </p>
                </td>

                <!-- Status -->
                <td class="px-4 py-3">
                  <span
                    class="inline-flex items-center gap-1 border px-2 py-0.5 font-display text-xs"
                    :class="statusClass(resource.status)"
                  >
                    <Icon :icon="statusIcon(resource.status)" class="size-3" />
                    {{ resource.status }}
                  </span>
                </td>

                <!-- Region -->
                <td class="px-4 py-3">
                  <span class="font-display text-xs text-text-secondary">{{
                    resource.region
                  }}</span>
                </td>

                <!-- Created At -->
                <td class="px-4 py-3">
                  <span class="font-display text-xs tabular-nums text-text-secondary">
                    {{ resource.createdAt }}
                  </span>
                </td>
              </tr>

              <!-- Expanded detail row -->
              <tr
                v-if="expandedIds.has(resource.id)"
                class="border-b border-border-default bg-bg-deep"
              >
                <td></td>
                <td colspan="5" class="px-4 py-4">
                  <div class="space-y-3">
                    <!-- Tags -->
                    <div>
                      <p class="mb-1.5 font-display text-xs font-semibold text-text-dim">Tags</p>
                      <div class="flex flex-wrap gap-1.5">
                        <span
                          v-for="tag in tagEntries(resource.tags)"
                          :key="tag.key"
                          class="inline-flex items-center gap-1 border border-border-default bg-bg-elevated px-2 py-0.5 font-display text-xs text-text-secondary"
                        >
                          <span class="text-text-dim">{{ tag.key }}:</span>
                          {{ tag.value }}
                        </span>
                        <span
                          v-if="tagEntries(resource.tags).length === 0"
                          class="font-display text-xs text-text-dim"
                        >
                          No tags
                        </span>
                      </div>
                    </div>

                    <!-- Full ID -->
                    <div>
                      <p class="mb-1 font-display text-xs font-semibold text-text-dim">
                        Resource ID
                      </p>
                      <p
                        class="break-all border border-border-default bg-bg-elevated px-3 py-2 font-display text-xs text-text-secondary"
                      >
                        {{ resource.id }}
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div
        v-if="filteredResources.length > PAGE_SIZE"
        class="flex items-center justify-between border-t border-border-default px-4 py-3"
      >
        <p class="font-display text-xs text-text-dim">
          Page {{ currentPage }} / {{ totalPages }} · {{ filteredResources.length }} results
        </p>
        <div class="flex items-center gap-1">
          <button
            type="button"
            :disabled="currentPage <= 1"
            class="flex size-7 items-center justify-center border border-border-default font-display text-xs text-text-secondary transition-colors hover:border-accent-coral/50 hover:text-accent-coral disabled:cursor-not-allowed disabled:opacity-40"
            @click="goPage(currentPage - 1)"
          >
            <Icon icon="lucide:chevron-left" class="size-3.5" />
          </button>
          <button
            type="button"
            :disabled="currentPage >= totalPages"
            class="flex size-7 items-center justify-center border border-border-default font-display text-xs text-text-secondary transition-colors hover:border-accent-coral/50 hover:text-accent-coral disabled:cursor-not-allowed disabled:opacity-40"
            @click="goPage(currentPage + 1)"
          >
            <Icon icon="lucide:chevron-right" class="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
