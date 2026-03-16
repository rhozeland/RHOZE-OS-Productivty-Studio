/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your verification code</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://puielauovddatgqvgxdy.supabase.co/storage/v1/object/public/email-assets/rhozeland-logo.png"
          width="44"
          height="44"
          alt="Rhozeland"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>Verification code</Heading>
        <Text style={text}>Use the code below to confirm your identity:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          This code will expire shortly. If you didn't request this, ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(0, 0%, 8%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(0, 0%, 45%)', lineHeight: '1.6', margin: '0 0 28px' }
const codeStyle = { fontFamily: 'Courier, monospace', fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(0, 0%, 8%)', margin: '0 0 30px' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 60%)', margin: '32px 0 0' }
