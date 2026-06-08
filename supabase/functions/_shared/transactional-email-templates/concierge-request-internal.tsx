/**
 * Internal ops alert — fires whenever a user submits a concierge_requests row
 * (Launch a Coin flow OR ConciergeIntakeSheet). Goes to collab@rhozeland.com.
 */
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  category?: string | null
  tier?: string | null
  submitterName?: string | null
  submitterEmail?: string | null
  submitterId?: string | null
  summary?: string | null
  outcome?: string | null
  budgetRange?: string | null
  deadline?: string | null
  requestId?: string | null
  source?: string | null
}

const ConciergeRequestInternal = (p: Props) => {
  const cat = p.category || 'concierge'
  const title =
    cat === 'coin-launch'
      ? 'New Launch-a-Coin submission'
      : 'New Concierge request'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{title} — {p.submitterName || p.submitterEmail || 'unknown user'}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>{title}</Heading>

          <Section style={card}>
            <Row label="From" value={`${p.submitterName ?? '—'} (${p.submitterEmail ?? '—'})`} />
            <Row label="Category" value={cat} />
            {p.tier ? <Row label="Tier" value={p.tier} /> : null}
            {p.budgetRange ? <Row label="Budget" value={p.budgetRange} /> : null}
            {p.deadline ? <Row label="Deadline" value={p.deadline} /> : null}
            {p.source ? <Row label="Source" value={p.source} /> : null}
            {p.requestId ? <Row label="Request ID" value={p.requestId} /> : null}
            {p.submitterId ? <Row label="User ID" value={p.submitterId} /> : null}
          </Section>

          <Hr style={hr} />

          <Text style={label}>Summary</Text>
          <Text style={pre}>{p.summary || '—'}</Text>

          {p.outcome ? (
            <>
              <Text style={label}>Desired outcome</Text>
              <Text style={pre}>{p.outcome}</Text>
            </>
          ) : null}

          <Hr style={hr} />
          <Text style={footer}>
            Review &amp; convert from the admin Concierge inbox: https://rhozeland.app/admin?tab=concierge
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const Row = ({ label, value }: { label: string; value: string }) => (
  <Text style={rowText}>
    <span style={rowLabel}>{label}: </span>
    {value}
  </Text>
)

export const template = {
  component: ConciergeRequestInternal,
  subject: (data: Record<string, any>) => {
    const cat = data?.category || 'concierge'
    const who = data?.submitterName || data?.submitterEmail || 'someone'
    if (cat === 'coin-launch') return `🚀 Launch-a-Coin: ${who}`
    return `✨ New Concierge request from ${who}`
  },
  to: 'collab@rhozeland.com',
  displayName: 'Concierge request (internal alert)',
  previewData: {
    category: 'coin-launch',
    submitterName: 'Jamie',
    submitterEmail: 'jamie@example.com',
    summary: 'Coin: My Release ($MYR)\nPitch: A new EP worth backing.',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '600px' }
const h1 = {
  fontSize: '20px',
  fontWeight: 'bold' as const,
  color: 'hsl(0, 0%, 8%)',
  margin: '0 0 20px',
}
const card = {
  backgroundColor: 'hsl(0, 0%, 97%)',
  borderRadius: '12px',
  padding: '16px 18px',
  margin: '0 0 8px',
}
const rowText = { fontSize: '13px', color: 'hsl(0, 0%, 15%)', margin: '4px 0', lineHeight: '1.5' }
const rowLabel = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
  color: 'hsl(0, 0%, 45%)',
  fontWeight: 600 as const,
}
const label = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'hsl(0, 0%, 45%)',
  margin: '16px 0 6px',
  fontWeight: 600 as const,
}
const pre = {
  fontSize: '14px',
  color: 'hsl(0, 0%, 15%)',
  lineHeight: '1.55',
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
}
const hr = { borderColor: 'hsl(0, 0%, 90%)', margin: '20px 0' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 50%)', margin: '8px 0 0' }
