/**
 * Verified Artist status email — one template, four states.
 *
 * `state` controls which copy block + CTA renders so we don't fan out into
 * four near-identical templates. Subject line is computed from `state` too.
 *
 * States:
 *   - submitted  → applicant just hit "Apply for Verified Artist"
 *   - in_review  → an admin started reviewing (today this is the same as
 *                  submitted; surfaced separately so we can introduce a
 *                  manual "in review" transition without changing the
 *                  template later)
 *   - approved   → admin approved → profile is now Verified Artist
 *   - revoked    → admin rejected/revoked. `note` is shown when present.
 */
import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Rhozeland'
const SITE_URL = 'https://rhozeland.app'
const LOGO_URL =
  'https://puielauovddatgqvgxdy.supabase.co/storage/v1/object/public/email-assets/rhozeland-logo.png'

export type VerificationState = 'submitted' | 'in_review' | 'approved' | 'revoked'

interface Props {
  state?: VerificationState
  /** Display name used to address the artist; falls back to "there". */
  name?: string
  /** Admin review note — only rendered when state === 'revoked'. */
  note?: string | null
}

const COPY: Record<
  VerificationState,
  {
    subject: string
    preview: string
    heading: string
    body: string
    ctaLabel: string
    ctaPath: string
  }
> = {
  submitted: {
    subject: 'Your Verified Artist application is in',
    preview: 'We received your Verified Artist application.',
    heading: 'Application received ✦',
    body:
      "Thanks for applying to become a Verified Artist on Rhozeland. Our team will review your submission within a few days. You'll get another email the moment we have a decision.",
    ctaLabel: 'View application',
    ctaPath: '/settings/verification',
  },
  in_review: {
    subject: 'Your Verified Artist application is under review',
    preview: 'A reviewer is looking at your application now.',
    heading: 'Under review',
    body:
      "Heads up — a reviewer just opened your Verified Artist application. We'll send another email once a decision is made.",
    ctaLabel: 'Track status',
    ctaPath: '/settings/verification',
  },
  approved: {
    subject: 'You’re a Verified Artist on Rhozeland',
    preview: "You're verified — IP, coins, and monetization are unlocked.",
    heading: "You're verified ✦",
    body:
      "Welcome to the Verified Artist tier. You can now anchor Verified IP, launch your profile coin, and access monetized Spaces. Your profile shows the Verified Artist badge from now on.",
    ctaLabel: 'Open my studio',
    ctaPath: '/dashboard',
  },
  revoked: {
    subject: 'Update on your Verified Artist application',
    preview: 'An update on your Verified Artist application.',
    heading: 'Application update',
    body:
      "We weren't able to approve your Verified Artist application this round. You can resubmit with updated info anytime — see the note below for details.",
    ctaLabel: 'Resubmit',
    ctaPath: '/settings/verification',
  },
}

const VerificationStatusEmail = ({ state, name, note }: Props) => {
  const s: VerificationState = state ?? 'submitted'
  const copy = COPY[s] ?? COPY.submitted
  const greetingName = name?.trim() || 'there'

  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>{copy.preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Img
            src={LOGO_URL}
            width="44"
            height="44"
            alt={SITE_NAME}
            style={{ marginBottom: '24px' }}
          />
          <Heading style={h1}>{copy.heading}</Heading>
          <Text style={text}>Hey {greetingName},</Text>
          <Text style={text}>{copy.body}</Text>

          {s === 'revoked' && note ? (
            <Section style={noteBox}>
              <Text style={noteLabel}>Reviewer note</Text>
              <Text style={noteText}>{note}</Text>
            </Section>
          ) : null}

          <Button style={button} href={`${SITE_URL}${copy.ctaPath}`}>
            {copy.ctaLabel}
          </Button>

          <Text style={footer}>
            You're getting this because you applied for the Verified Artist tier on {SITE_NAME}.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: VerificationStatusEmail,
  subject: (data: Record<string, any>) => {
    const s = (data?.state as VerificationState) ?? 'submitted'
    return (COPY[s] ?? COPY.submitted).subject
  },
  displayName: 'Verified Artist status update',
  previewData: { state: 'approved', name: 'Jamie' },
} satisfies TemplateEntry

/* ─── styles ─── */
const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px', maxWidth: '560px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: 'hsl(0, 0%, 8%)',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: 'hsl(0, 0%, 25%)',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const button = {
  backgroundColor: 'hsl(175, 60%, 55%)',
  color: 'hsl(0, 0%, 5%)',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '0.75rem',
  padding: '12px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '8px',
}
const noteBox = {
  backgroundColor: 'hsl(0, 0%, 96%)',
  borderRadius: '0.75rem',
  padding: '14px 16px',
  margin: '8px 0 24px',
}
const noteLabel = {
  fontSize: '11px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.08em',
  color: 'hsl(0, 0%, 45%)',
  margin: '0 0 6px',
}
const noteText = {
  fontSize: '14px',
  color: 'hsl(0, 0%, 15%)',
  lineHeight: '1.5',
  margin: 0,
  whiteSpace: 'pre-wrap' as const,
}
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 55%)', margin: '32px 0 0' }
