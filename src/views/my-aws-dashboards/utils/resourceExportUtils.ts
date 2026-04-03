import type { AwsResource, ResourceReport, XLSXLibrary } from '../types'

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function tagsToString(tags: Record<string, string>): string {
  return Object.entries(tags)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ')
}

function buildResourceRows(resources: AwsResource[]): (string | number)[][] {
  const rows: (string | number)[][] = []

  rows.push(['AWS Resources Report'])
  rows.push(['Generated At', new Date().toISOString()])
  rows.push(['Total Resources', resources.length])
  rows.push(['Active', resources.filter((r) => r.status === 'active').length])
  rows.push(['Inactive', resources.filter((r) => r.status === 'inactive').length])
  rows.push(['Unknown', resources.filter((r) => r.status === 'unknown').length])
  rows.push([])
  rows.push(['Resource ID', 'Name', 'Type', 'Status', 'Region', 'Created At', 'Detail', 'Tags'])

  for (const r of resources) {
    rows.push([
      r.id,
      r.name,
      r.type,
      r.status,
      r.region,
      r.createdAt,
      r.detail ?? '',
      tagsToString(r.tags),
    ])
  }

  return rows
}

export function downloadResourcesCsv(report: ResourceReport): void {
  const rows = buildResourceRows(report.resources)
  const csv = rows.map((row) => row.map((cell) => csvEscape(String(cell))).join(',')).join('\n')

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `aws-resources-${new Date().toISOString().slice(0, 10)}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function downloadResourcesXlsx(report: ResourceReport, xlsxLib: XLSXLibrary): void {
  // Summary sheet
  const summaryData: (string | number)[][] = [
    ['AWS Resources Report'],
    ['Generated At', new Date().toISOString()],
    ['Total Resources', report.resources.length],
    ['Active', report.resources.filter((r) => r.status === 'active').length],
    ['Inactive', report.resources.filter((r) => r.status === 'inactive').length],
    ['Unknown', report.resources.filter((r) => r.status === 'unknown').length],
  ]

  // Resources sheet
  const resourcesData: (string | number)[][] = [
    ['Resource ID', 'Name', 'Type', 'Status', 'Region', 'Created At', 'Detail', 'Tags'],
    ...report.resources.map((r) => [
      r.id,
      r.name,
      r.type,
      r.status,
      r.region,
      r.createdAt,
      r.detail ?? '',
      tagsToString(r.tags),
    ]),
  ]

  // Type breakdown sheet
  const typeCounts = new Map<string, { active: number; inactive: number; unknown: number }>()
  for (const r of report.resources) {
    const entry = typeCounts.get(r.type) ?? { active: 0, inactive: 0, unknown: 0 }
    entry[r.status]++
    typeCounts.set(r.type, entry)
  }
  const breakdownData: (string | number)[][] = [
    ['Type', 'Total', 'Active', 'Inactive', 'Unknown'],
    ...[...typeCounts.entries()].map(([type, counts]) => [
      type,
      counts.active + counts.inactive + counts.unknown,
      counts.active,
      counts.inactive,
      counts.unknown,
    ]),
  ]

  const wb = xlsxLib.utils.book_new()
  xlsxLib.utils.book_append_sheet(wb, xlsxLib.utils.aoa_to_sheet(summaryData), 'Summary')
  xlsxLib.utils.book_append_sheet(wb, xlsxLib.utils.aoa_to_sheet(resourcesData), 'Resources')
  xlsxLib.utils.book_append_sheet(wb, xlsxLib.utils.aoa_to_sheet(breakdownData), 'By Type')

  xlsxLib.writeFile(wb, `aws-resources-${new Date().toISOString().slice(0, 10)}.xlsx`)
}
