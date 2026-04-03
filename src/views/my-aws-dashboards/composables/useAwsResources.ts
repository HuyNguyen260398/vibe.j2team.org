import { ref, computed } from 'vue'
import type {
  ResourceReport,
  ResourceFilters,
  AwsResource,
  ResourceType,
  ResourceSortField,
  ResourceSortDir,
} from '../types'
import { generateDemoResources } from '../utils/resourceDemoData'
import { signRequest } from '../utils/sigv4'

export type ResourceFetchStatus = 'idle' | 'loading' | 'demo' | 'error'
export type ResourceErrorCode = '' | 'access_denied' | 'cors' | 'timeout' | 'unknown'

// ─── Tagging API response shape ───────────────────────────────────────────────

type TaggingApiResource = {
  ResourceARN: string
  Tags: { Key: string; Value: string }[]
}

type TaggingApiResponse = {
  ResourceTagMappingList: TaggingApiResource[]
  PaginationToken?: string
}

// ─── ARN parsing + type mapping ───────────────────────────────────────────────

function parseArn(arn: string): { service: string; region: string; resourcePart: string } | null {
  // arn:aws:<service>:<region>:<account>:<resource…>
  const parts = arn.split(':')
  if (parts.length < 6 || parts[0] !== 'arn') return null
  return {
    service: parts[2] ?? '',
    region: parts[3] ?? '',
    resourcePart: parts.slice(5).join(':'),
  }
}

function mapServiceToType(service: string, resourcePart: string): ResourceType | null {
  const s = service.toLowerCase()
  const r = resourcePart.toLowerCase()
  if (s === 'ec2') {
    if (r.startsWith('vpc/') || r.startsWith('vpc-')) return 'VPC'
    return 'EC2'
  }
  if (s === 's3') return 'S3'
  if (s === 'rds') return 'RDS'
  if (s === 'lambda') return 'Lambda'
  if (s === 'cloudfront') return 'CloudFront'
  if (s === 'elasticache') return 'ElastiCache'
  if (s === 'dynamodb') return 'DynamoDB'
  if (s === 'ecs') return 'ECS'
  if (s === 'eks') return 'EKS'
  if (s === 'sqs') return 'SQS'
  if (s === 'sns') return 'SNS'
  if (s === 'iam') return 'IAM'
  if (s === 'route53') return 'Route53'
  if (s === 'cloudwatch') return 'CloudWatch'
  return null
}

function extractName(resourcePart: string, tags: Record<string, string>): string {
  if (tags['Name']) return tags['Name']
  // Last path segment after '/' or ':'
  const last = resourcePart.split(/[/:?]/).filter(Boolean).pop() ?? resourcePart
  return last
}

function parseTaggingBatch(items: TaggingApiResource[], fallbackRegion: string): AwsResource[] {
  const resources: AwsResource[] = []
  for (const item of items) {
    const parsed = parseArn(item.ResourceARN)
    if (!parsed) continue

    const tags: Record<string, string> = {}
    for (const t of item.Tags) tags[t.Key] = t.Value

    const type = mapServiceToType(parsed.service, parsed.resourcePart)
    if (!type) continue

    resources.push({
      id: item.ResourceARN,
      name: extractName(parsed.resourcePart, tags),
      type,
      // Tagging API doesn't expose running status — requires per-service calls
      status: 'unknown',
      region: parsed.region || fallbackRegion,
      createdAt: (tags['CreatedAt'] ?? tags['aws:cloudformation:stack-name']) ? '' : '',
      tags,
    })
  }
  return resources
}

// ─── Composable ───────────────────────────────────────────────────────────────

export function useAwsResources() {
  const status = ref<ResourceFetchStatus>('idle')
  const report = ref<ResourceReport | null>(null)
  const isDemoMode = ref(true)
  const errorMessage = ref('')
  const errorCode = ref<ResourceErrorCode>('')

  const isLoading = computed(() => status.value === 'loading')
  const hasReport = computed(() => report.value !== null)

  // ─── Filters ─────────────────────────────────────────────────────────────────

  const filters = ref<ResourceFilters>({
    type: 'ALL',
    status: 'ALL',
    region: 'ALL',
    search: '',
  })

  // ─── Sort ────────────────────────────────────────────────────────────────────

  const sortField = ref<ResourceSortField>('createdAt')
  const sortDir = ref<ResourceSortDir>('desc')

  function setSort(field: ResourceSortField): void {
    if (sortField.value === field) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortField.value = field
      sortDir.value = 'asc'
    }
  }

  // ─── Filtered + sorted resources ─────────────────────────────────────────────

  const filteredResources = computed<AwsResource[]>(() => {
    if (!report.value) return []

    let result = report.value.resources

    if (filters.value.type !== 'ALL') {
      result = result.filter((r) => r.type === filters.value.type)
    }
    if (filters.value.status !== 'ALL') {
      result = result.filter((r) => r.status === filters.value.status)
    }
    if (filters.value.region !== 'ALL') {
      result = result.filter((r) => r.region === filters.value.region)
    }
    if (filters.value.search.trim()) {
      const q = filters.value.search.trim().toLowerCase()
      result = result.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.id.toLowerCase().includes(q) ||
          r.type.toLowerCase().includes(q) ||
          Object.values(r.tags).some((v) => v.toLowerCase().includes(q)),
      )
    }

    return [...result].sort((a, b) => {
      let cmp = 0
      const field = sortField.value
      if (field === 'name') cmp = a.name.localeCompare(b.name)
      else if (field === 'type') cmp = a.type.localeCompare(b.type)
      else if (field === 'status') cmp = a.status.localeCompare(b.status)
      else if (field === 'region') cmp = a.region.localeCompare(b.region)
      else if (field === 'createdAt') cmp = a.createdAt.localeCompare(b.createdAt)
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  })

  // ─── Summary stats ────────────────────────────────────────────────────────────

  const stats = computed(() => {
    const all = report.value?.resources ?? []
    const active = all.filter((r) => r.status === 'active').length
    const inactive = all.filter((r) => r.status === 'inactive').length
    const unknown = all.filter((r) => r.status === 'unknown').length

    const byType = new Map<string, number>()
    for (const r of all) byType.set(r.type, (byType.get(r.type) ?? 0) + 1)
    const topType = [...byType.entries()].sort((a, b) => b[1] - a[1])[0]

    return {
      total: all.length,
      active,
      inactive,
      unknown,
      topType: topType ? { type: topType[0], count: topType[1] } : null,
    }
  })

  // ─── Demo ─────────────────────────────────────────────────────────────────────

  function loadDemoData(): void {
    status.value = 'loading'
    errorMessage.value = ''
    setTimeout(() => {
      report.value = generateDemoResources()
      status.value = 'demo'
      isDemoMode.value = true
    }, 400)
  }

  // ─── Real data via Resource Groups Tagging API ────────────────────────────────

  /**
   * Fetches all tagged resources in the given region using the AWS Resource Groups
   * Tagging API (`tag:GetResources`). Falls back to demo data on CORS/auth errors.
   *
   * The Cognito unauthenticated role must include:
   *   { "Action": "tag:GetResources", "Resource": "*" }
   *
   * NOTE: Like Cost Explorer, this API endpoint does not support CORS for browser
   * requests. The app will attempt the call and fall back to demo mode on failure.
   */
  async function loadRealData(
    accessKeyId: string,
    secretAccessKey: string,
    sessionToken: string,
    region: string,
  ): Promise<void> {
    status.value = 'loading'
    errorMessage.value = ''
    errorCode.value = ''

    try {
      const SERVICE = 'tagging'
      const HOST = `tagging.${region}.amazonaws.com`
      const TARGET = 'ResourceGroupsTaggingAPI_20170126.GetResources'
      const CONTENT_TYPE = 'application/x-amz-json-1.1'

      const allResources: AwsResource[] = []
      let paginationToken: string | undefined

      do {
        const body = JSON.stringify({
          ResourcesPerPage: 100,
          ...(paginationToken ? { PaginationToken: paginationToken } : {}),
        })

        const signedHeaders = await signRequest({
          accessKeyId,
          secretAccessKey,
          sessionToken: sessionToken || undefined,
          region,
          service: SERVICE,
          host: HOST,
          method: 'POST',
          path: '/',
          body,
          amzTarget: TARGET,
          contentType: CONTENT_TYPE,
        })

        const response = await fetch(`https://${HOST}/`, {
          method: 'POST',
          headers: signedHeaders,
          body,
          signal: AbortSignal.timeout(15000),
        })

        if (!response.ok) {
          let msg = `HTTP ${response.status}`
          let isAccessDenied = false
          try {
            const err = (await response.json()) as {
              __type?: string
              message?: string
              Message?: string
            }
            const errType = err.__type?.split('#').pop() ?? ''
            const errDetail = err.message ?? err.Message ?? ''
            // AWS returns AccessDeniedException on HTTP 400, not 403, for missing IAM permissions
            isAccessDenied =
              response.status === 403 ||
              errType === 'AccessDeniedException' ||
              errDetail.toLowerCase().includes('not authorized')
            if (!isAccessDenied) {
              if (errType) msg += `: ${errType}`
              if (errDetail) msg += ` — ${errDetail}`
            }
          } catch {
            // keep generic message
          }
          if (isAccessDenied) {
            throw new Error('__access_denied__')
          }
          throw new Error(msg)
        }

        const data = (await response.json()) as TaggingApiResponse
        const batch = parseTaggingBatch(data.ResourceTagMappingList ?? [], region)
        allResources.push(...batch)
        paginationToken = data.PaginationToken || undefined
      } while (paginationToken)

      report.value = {
        resources: allResources,
        generatedAt: new Date().toISOString(),
      }
      status.value = 'idle'
      isDemoMode.value = false
    } catch (err) {
      let msg: string
      let code: ResourceErrorCode = 'unknown'
      if (err instanceof TypeError) {
        code = 'cors'
        msg =
          'CORS Error: The AWS Resource Groups Tagging API does not support direct browser requests. Use a CORS proxy to work around this restriction.'
      } else if (err instanceof DOMException && err.name === 'TimeoutError') {
        code = 'timeout'
        msg = 'Request timed out. Check your network connection and try again.'
      } else if (err instanceof Error && err.message === '__access_denied__') {
        code = 'access_denied'
        msg =
          'Your Cognito unauthenticated IAM role is missing the "tag:GetResources" permission. Attach the policy below to your role in the AWS Console.'
      } else if (err instanceof Error) {
        msg = err.message
      } else {
        msg = 'Unknown error'
      }
      errorMessage.value = msg
      errorCode.value = code
      status.value = 'error'
      // Do not auto-fallback to demo — preserve the error so the user sees it
    }
  }

  function resetFilters(): void {
    filters.value = { type: 'ALL', status: 'ALL', region: 'ALL', search: '' }
  }

  return {
    status,
    report,
    isDemoMode,
    errorMessage,
    errorCode,
    isLoading,
    hasReport,
    filters,
    sortField,
    sortDir,
    filteredResources,
    stats,
    setSort,
    loadDemoData,
    loadRealData,
    resetFilters,
  }
}
