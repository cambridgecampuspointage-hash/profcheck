import { LeadDetailClient } from './LeadDetailClient'

export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <LeadDetailClient leadId={id} />
}
