import { motion } from "framer-motion";
import { MessageSquare, Users, Send, Shield, ArrowRight, Inbox, FileText } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Direct Messages",
    description: "Chat one-on-one with creators, clients, and collaborators in real time.",
  },
  {
    icon: Users,
    title: "Circles",
    description: "Create group chats for project teams, communities, and creative crews.",
  },
  {
    icon: Inbox,
    title: "Inquiries",
    description: "Receive and manage service inquiries directly from your marketplace listings.",
  },
  {
    icon: FileText,
    title: "Quotes & Attachments",
    description: "Send project quotes, share files, and keep everything organized in one thread.",
  },
];

const GuestMessagesPreview = () => (
  <div className="max-w-3xl mx-auto py-8 space-y-8">
    {/* Hero */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center space-y-4"
    >
      <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
        <MessageSquare className="h-8 w-8 text-primary" />
      </div>
      <h1 className="font-display text-3xl md:text-4xl text-foreground">
        Your Creative Inbox
      </h1>
      <p className="text-muted-foreground font-body max-w-md mx-auto leading-relaxed">
        Message collaborators, manage inquiries, send quotes, and build your creative network — all in one place.
      </p>
    </motion.div>

    {/* Feature grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {FEATURES.map((f, i) => (
        <motion.div
          key={f.title}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 + i * 0.08 }}
          className="border border-border rounded-lg p-5 bg-card"
        >
          <f.icon className="h-5 w-5 text-primary mb-3" />
          <p className="text-sm font-semibold text-foreground font-body mb-1">{f.title}</p>
          <p className="text-xs text-muted-foreground font-body leading-relaxed">{f.description}</p>
        </motion.div>
      ))}
    </div>

    {/* Security note */}
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.5 }}
      className="flex items-center gap-3 p-4 rounded-lg bg-muted/50 border border-border"
    >
      <Shield className="h-5 w-5 text-muted-foreground shrink-0" />
      <p className="text-xs text-muted-foreground font-body leading-relaxed">
        All messages are private and encrypted. Only you and your conversation partners can see your chats.
      </p>
    </motion.div>

    {/* CTA */}
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="text-center"
    >
      <Link to="/auth">
        <Button className="gap-2">
          Sign Up to Start Messaging <ArrowRight className="h-4 w-4" />
        </Button>
      </Link>
    </motion.div>
  </div>
);

export default GuestMessagesPreview;
