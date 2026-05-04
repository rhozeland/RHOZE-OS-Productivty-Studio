/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Button, Container, Head, Heading, Html, Preview, Section, Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  eventTitle?: string
  eventDate?: string
  venue?: string
  ticketUrl?: string
  tierName?: string
  status?: 'issued' | 'pending_approval' | string
  accountCreated?: boolean
}

const EventTicketConfirmation = ({
  name,
  eventTitle = 'your event',
  eventDate,
  venue,
  ticketUrl = 'https://rhozeland.app',
  tierName,
  status = 'issued',
  accountCreated = false,
}: Props) => {
  const isPending = status === 'pending_approval'
  return (
    <Html lang="en" dir="ltr">
      <Head />
      <Preview>
        {isPending ? `Request received for ${eventTitle}` : `You're in — ${eventTitle}`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>
            {isPending
              ? `Request received${name ? `, ${name}` : ''}`
              : `You're in${name ? `, ${name}` : ''} 🌹`}
          </Heading>
          <Text style={text}>
            {isPending
              ? `Your request to attend ${eventTitle} has been sent to the host. We'll email you the moment it's approved.`
              : `Your ticket for ${eventTitle} is ready.`}
          </Text>

          <Section style={card}>
            <Text style={cardLabel}>Event</Text>
            <Text style={cardValue}>{eventTitle}</Text>
            {eventDate && (
              <>
                <Text style={cardLabel}>When</Text>
                <Text style={cardValue}>{eventDate}</Text>
              </>
            )}
            {venue && (
              <>
                <Text style={cardLabel}>Where</Text>
                <Text style={cardValue}>{venue}</Text>
              </>
            )}
            {tierName && (
              <>
                <Text style={cardLabel}>Ticket</Text>
                <Text style={cardValue}>{tierName}</Text>
              </>
            )}
          </Section>

          {!isPending && (
            <Section style={{ textAlign: 'center', margin: '28px 0' }}>
              <Button style={button} href={ticketUrl}>
                View your ticket
              </Button>
            </Section>
          )}

          {accountCreated && (
            <Text style={footnote}>
              We created a free Rhozeland account for you so you can access your ticket
              and pass anytime. Use the "magic link" sign-in option at rhozeland.app
              with this email — no password needed.
            </Text>
          )}

          <Text style={footer}>See you soon,<br />The Rhozeland team</Text>
        </Container>
      </Body>
    </Html>
  )
}

export const template = {
  component: EventTicketConfirmation,
  subject: (data: Record<string, any>) =>
    data?.status === 'pending_approval'
      ? `Request received — ${data?.eventTitle ?? 'your event'}`
      : `You're in — ${data?.eventTitle ?? 'your event'}`,
  displayName: 'Event ticket confirmation',
  previewData: {
    name: 'Ada',
    eventTitle: 'Lovable Meetup Toronto',
    eventDate: 'Tuesday, May 5 · 5:30 PM',
    venue: 'Rootly HQ, Toronto',
    ticketUrl: 'https://rhozeland.app/tickets/sample',
    tierName: 'General admission',
    status: 'issued',
    accountCreated: true,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }
const container = { padding: '32px 28px', maxWidth: '560px', margin: '0 auto' }
const h1 = { fontSize: '26px', fontWeight: 700, color: '#0a0a0a', margin: '0 0 12px', lineHeight: 1.2 }
const text = { fontSize: '15px', color: '#404040', lineHeight: 1.6, margin: '0 0 20px' }
const card = { backgroundColor: '#fafafa', border: '1px solid #e5e5e5', borderRadius: '14px', padding: '20px 22px', margin: '20px 0' }
const cardLabel = { fontSize: '10px', fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: '#737373', margin: '12px 0 4px' }
const cardValue = { fontSize: '15px', fontWeight: 600, color: '#0a0a0a', margin: '0' }
const button = { backgroundColor: '#0a0a0a', color: '#ffffff', padding: '14px 28px', borderRadius: '999px', fontSize: '14px', fontWeight: 600, textDecoration: 'none', display: 'inline-block' }
const footnote = { fontSize: '13px', color: '#737373', lineHeight: 1.6, margin: '16px 0 0', padding: '14px 16px', backgroundColor: '#fafafa', borderRadius: '10px' }
const footer = { fontSize: '13px', color: '#737373', margin: '32px 0 0' }
