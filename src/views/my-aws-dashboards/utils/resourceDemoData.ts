import type { AwsResource, ResourceType, ResourceStatus, ResourceReport } from '../types'

// ─── Constants ────────────────────────────────────────────────────────────────

export const RESOURCE_TYPES: ResourceType[] = [
  'EC2',
  'S3',
  'RDS',
  'Lambda',
  'CloudFront',
  'ElastiCache',
  'DynamoDB',
  'ECS',
  'EKS',
  'SQS',
  'SNS',
  'IAM',
  'VPC',
  'Route53',
  'CloudWatch',
]

export const RESOURCE_REGIONS = [
  { value: 'us-east-1', label: 'US East (N. Virginia)' },
  { value: 'us-east-2', label: 'US East (Ohio)' },
  { value: 'us-west-1', label: 'US West (N. California)' },
  { value: 'us-west-2', label: 'US West (Oregon)' },
  { value: 'ap-southeast-1', label: 'Asia Pacific (Singapore)' },
  { value: 'ap-southeast-2', label: 'Asia Pacific (Sydney)' },
  { value: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
  { value: 'ap-south-1', label: 'Asia Pacific (Mumbai)' },
  { value: 'eu-west-1', label: 'Europe (Ireland)' },
  { value: 'eu-central-1', label: 'Europe (Frankfurt)' },
  { value: 'sa-east-1', label: 'South America (São Paulo)' },
] as const

// ─── Deterministic pseudo-random helpers ──────────────────────────────────────

function seededRand(seed: number): number {
  return ((seed * 9301 + 49297) % 233280) / 233280
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.floor(seededRand(seed) * arr.length)] as T
}

// ─── Per-type name generators ─────────────────────────────────────────────────

const EC2_PREFIXES = ['web', 'api', 'worker', 'bastion', 'nat', 'app', 'batch', 'db-proxy']
const S3_SUFFIXES = [
  'assets',
  'backups',
  'logs',
  'data',
  'artifacts',
  'media',
  'static',
  'tf-state',
]
const RDS_PREFIXES = ['prod', 'staging', 'analytics', 'reporting', 'app', 'auth', 'cms']
const LAMBDA_NAMES = [
  'process-events',
  'send-notifications',
  'resize-image',
  'sync-data',
  'auth-handler',
  'webhook-processor',
  'cleanup-job',
  'report-generator',
  'export-csv',
  'ingest-stream',
]
const CLUSTER_PREFIXES = ['main', 'prod', 'staging', 'infra', 'data', 'svc']
const QUEUE_NAMES = ['events', 'notifications', 'jobs', 'dlq-events', 'billing', 'audit']
const TOPIC_NAMES = ['alerts', 'events', 'deployments', 'billing', 'user-actions']

const ENVS = ['prod', 'staging', 'dev', 'qa']
const OWNERS = ['platform', 'backend', 'frontend', 'data', 'infra', 'devops']

function resourceName(type: ResourceType, idx: number): string {
  const env = pick(ENVS, idx * 3)
  const owner = pick(OWNERS, idx * 7)
  switch (type) {
    case 'EC2':
      return `${pick(EC2_PREFIXES, idx * 5)}-${env}-${idx + 1}`
    case 'S3':
      return `${owner}-${pick(S3_SUFFIXES, idx * 11)}-${env}`
    case 'RDS':
      return `${pick(RDS_PREFIXES, idx * 13)}-${env}-db`
    case 'Lambda':
      return `${env}-${pick(LAMBDA_NAMES, idx * 17)}`
    case 'CloudFront':
      return `${owner}-cdn-${env}`
    case 'ElastiCache':
      return `${env}-cache-${idx + 1}`
    case 'DynamoDB':
      return `${owner}-table-${env}`
    case 'ECS':
      return `${pick(CLUSTER_PREFIXES, idx * 19)}-cluster-${env}`
    case 'EKS':
      return `${pick(CLUSTER_PREFIXES, idx * 23)}-eks-${env}`
    case 'SQS':
      return `${env}-${pick(QUEUE_NAMES, idx * 29)}`
    case 'SNS':
      return `${env}-${pick(TOPIC_NAMES, idx * 31)}`
    case 'IAM':
      return `svc-${owner}-role-${env}`
    case 'VPC':
      return `${env}-vpc-${idx + 1}`
    case 'Route53':
      return `${owner}-zone-${env}`
    case 'CloudWatch':
      return `${owner}-dashboard-${env}`
    default:
      return `resource-${idx}`
  }
}

function resourceId(type: ResourceType, idx: number): string {
  const hex = (n: number) =>
    Math.floor(seededRand(n) * 0xfffffff)
      .toString(16)
      .padStart(8, '0')
  switch (type) {
    case 'EC2':
      return `i-${hex(idx * 2)}${hex(idx * 3)}`
    case 'S3':
      return resourceName(type, idx) // S3 uses name as id
    case 'RDS':
      return `db-${hex(idx * 4).toUpperCase()}`
    case 'Lambda':
      return resourceName(type, idx)
    case 'VPC':
      return `vpc-${hex(idx * 5)}`
    case 'ECS':
      return `arn:aws:ecs:...:cluster/${resourceName(type, idx)}`
    case 'EKS':
      return `arn:aws:eks:...:cluster/${resourceName(type, idx)}`
    default:
      return `${type.toLowerCase()}-${hex(idx * 6)}`
  }
}

function resourceDetail(type: ResourceType, idx: number): string {
  const instanceTypes = ['t3.micro', 't3.small', 't3.medium', 'm5.large', 'c5.xlarge', 'r5.2xlarge']
  const dbClasses = ['db.t3.micro', 'db.t3.small', 'db.m5.large', 'db.r5.xlarge']
  const runtimes = ['nodejs20.x', 'python3.12', 'java21', 'go1.x']
  const cacheNodes = ['cache.t3.micro', 'cache.r6g.large']
  switch (type) {
    case 'EC2':
      return pick(instanceTypes, idx * 41)
    case 'S3':
      return `${Math.floor(seededRand(idx * 43) * 500 + 1)} GB`
    case 'RDS':
      return `${pick(dbClasses, idx * 47)} · PostgreSQL 16`
    case 'Lambda':
      return `${pick(runtimes, idx * 53)} · ${Math.floor(seededRand(idx * 59) * 3008 + 128)} MB`
    case 'ElastiCache':
      return `${pick(cacheNodes, idx * 61)} · Redis 7`
    case 'DynamoDB':
      return 'On-Demand · PAY_PER_REQUEST'
    case 'ECS':
      return `Fargate · ${Math.floor(seededRand(idx * 67) * 10 + 1)} tasks`
    case 'EKS':
      return `k8s v1.29 · ${Math.floor(seededRand(idx * 71) * 5 + 2)} nodes`
    default:
      return ''
  }
}

function resourceStatus(idx: number, seed: number): ResourceStatus {
  const r = seededRand(idx * seed)
  if (r < 0.7) return 'active'
  if (r < 0.88) return 'inactive'
  return 'unknown'
}

function randomDate(idx: number, seed: number): string {
  // Spread creation dates across the past 3 years
  const start = new Date('2023-01-01').getTime()
  const end = new Date('2026-03-01').getTime()
  const ts = start + seededRand(idx * seed) * (end - start)
  return new Date(ts).toISOString().slice(0, 10)
}

// ─── Typed resource counts per type ──────────────────────────────────────────

const TYPE_COUNTS: Record<ResourceType, number> = {
  EC2: 14,
  S3: 8,
  RDS: 5,
  Lambda: 20,
  CloudFront: 4,
  ElastiCache: 3,
  DynamoDB: 6,
  ECS: 4,
  EKS: 2,
  SQS: 7,
  SNS: 5,
  IAM: 12,
  VPC: 4,
  Route53: 3,
  CloudWatch: 5,
}

const REGIONS_POOL = RESOURCE_REGIONS.map((r) => r.value)

// ─── Generator ────────────────────────────────────────────────────────────────

export function generateDemoResources(): ResourceReport {
  const resources: AwsResource[] = []
  let globalIdx = 0

  for (const type of RESOURCE_TYPES) {
    const count = TYPE_COUNTS[type]
    for (let i = 0; i < count; i++) {
      const seed = globalIdx + 1
      const region = pick(REGIONS_POOL, seed * 37)
      const status = resourceStatus(seed, 79)
      const name = resourceName(type, seed)
      const detail = resourceDetail(type, seed)

      // Tags
      const env = pick(ENVS, seed * 3)
      const owner = pick(OWNERS, seed * 7)
      const tags: Record<string, string> = {
        Environment: env,
        Owner: owner,
        ManagedBy: 'terraform',
      }
      if (seededRand(seed * 11) > 0.5)
        tags['CostCenter'] = `cc-${Math.floor(seededRand(seed * 13) * 900 + 100)}`

      resources.push({
        id: resourceId(type, seed),
        name,
        type,
        status,
        region,
        createdAt: randomDate(seed, 83),
        tags,
        ...(detail ? { detail } : {}),
      })
      globalIdx++
    }
  }

  return {
    resources,
    generatedAt: new Date().toISOString(),
  }
}
