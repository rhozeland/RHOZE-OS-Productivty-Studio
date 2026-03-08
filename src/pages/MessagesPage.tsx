import { MessageSquare } from "lucide-react";

const MessagesPage = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
        <p className="text-muted-foreground">Connect with other creators</p>
      </div>
      <div className="surface-card flex flex-col items-center justify-center py-20">
        <MessageSquare className="mb-4 h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Messaging coming soon. Stay tuned!</p>
      </div>
    </div>
  );
};

export default MessagesPage;
