/// <reference types="npm:@types/react@18.3.1" />

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
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset your password for Rhozeland</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://puielauovddatgqvgxdy.supabase.co/storage/v1/object/public/email-assets/rhozeland-logo.png"
          width="44"
          height="44"
          alt="Rhozeland"
          style={{ marginBottom: '24px' }}
        />
        <Heading style={h1}>Reset your password</Heading>
        <Text style={text}>
          We received a request to reset your Rhozeland password. Click
          the button below to choose a new one.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          If you didn't request this, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '32px 28px' }
const h1 = { fontSize: '22px', fontWeight: 'bold' as const, color: 'hsl(0, 0%, 8%)', margin: '0 0 20px' }
const text = { fontSize: '14px', color: 'hsl(0, 0%, 45%)', lineHeight: '1.6', margin: '0 0 28px' }
const button = { backgroundColor: 'hsl(175, 60%, 55%)', color: 'hsl(0, 0%, 5%)', fontSize: '14px', fontWeight: '600' as const, borderRadius: '0.75rem', padding: '12px 24px', textDecoration: 'none' }
const footer = { fontSize: '12px', color: 'hsl(0, 0%, 60%)', margin: '32px 0 0' }
