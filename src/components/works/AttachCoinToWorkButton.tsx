import { Coins, Loader2, Link2Off } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { useTokenAttachment } from "@/hooks/useTokenAttachment";
import { tokenAttachmentErrorMessage } from "@/lib/token-attachment";
import { toast } from "sonner";

interface Props {
  workId: string;
  workOwnerId: string;
  currentMint: string | null | undefined;
  currentTokenId: string | null | undefined;
  onAttachRequest: (workId: string, hasExistingLink: boolean) => void;
}

const AttachCoinToWorkButton = ({ workId, workOwnerId, currentMint, currentTokenId, onAttachRequest }: Props) => {
  const { user } = useAuth();
  const isOwner = user?.id === workOwnerId;
  const tokenAttachment = useTokenAttachment();
  const hasLink = !!currentMint || !!currentTokenId;

  if (!isOwner) return null;

  const unlink = async () => {
    try {
      const unlinked = await tokenAttachment.unlink({ targetType: "work", targetId: workId });
      if (unlinked) toast.success("Coin unlinked from this Work");
    } catch (error) {
      toast.error(tokenAttachmentErrorMessage(error));
    }
  };

  return (
    <div className="inline-flex items-center gap-1.5">
      <Button
        size="sm"
        variant="outline"
        disabled={tokenAttachment.isPending}
        onClick={() => onAttachRequest(workId, hasLink)}
        className="gap-1.5 h-7 text-xs"
      >
        {tokenAttachment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coins className="h-3 w-3 text-emerald-500" />}
        {hasLink ? "Change coin" : "Attach coin"}
      </Button>
      {hasLink && (
        <Button
          size="sm"
          variant="ghost"
          disabled={tokenAttachment.isPending}
          onClick={() => void unlink()}
          className="gap-1 h-7 px-2 text-xs"
          title="Unlink coin"
        >
          {tokenAttachment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Link2Off className="h-3 w-3" />}
          Unlink
        </Button>
      )}
    </div>
  );
};

export default AttachCoinToWorkButton;
