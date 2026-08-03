import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Check, Copy, Download, Loader2, Share2, X } from "lucide-react";
import { generateShareToken, revokeShareToken } from "../supabase/taskShareApi";

function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [header, base64] = dataUrl.split(",");
  const mimeMatch = header.match(/:(.*?);/);
  const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }

  return new File([bytes], fileName, { type: mimeType });
}

type ShareTaskPopoverProps = {
  taskId: string;
  shareToken: string | null;
  onTokenChange: (taskId: string, token: string | null) => void;
  onClose: () => void;
};

export function ShareTaskPopover({
  taskId,
  shareToken,
  onTokenChange,
  onClose,
}: ShareTaskPopoverProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRevoking, setIsRevoking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  const shareUrl = shareToken ? `${window.location.origin}/share/${shareToken}` : null;

  useEffect(() => {
    let isCancelled = false;

    async function ensureToken() {
      setError(null);

      if (shareToken) {
        return;
      }

      setIsLoading(true);

      try {
        const token = await generateShareToken(taskId);

        if (!isCancelled) {
          onTokenChange(taskId, token);
        }
      } catch (shareError) {
        console.error("Nepodařilo se vytvořit sdílený odkaz na úkol:", shareError);

        if (!isCancelled) {
          setError("Nepodařilo se vytvořit sdílený odkaz. Zkontrolujte připojení a zkuste to znovu.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    }

    ensureToken();

    return () => {
      isCancelled = true;
    };
  }, [taskId, shareToken, onTokenChange]);

  useEffect(() => {
    if (!shareUrl) {
      setQrDataUrl(null);
      return;
    }

    let isCancelled = false;

    QRCode.toDataURL(shareUrl, { width: 220, margin: 1 })
      .then((dataUrl) => {
        if (!isCancelled) {
          setQrDataUrl(dataUrl);
        }
      })
      .catch(() => {
        if (!isCancelled) {
          setError("Nepodařilo se vygenerovat QR kód.");
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [shareUrl]);

  async function handleCopyLink() {
    if (!shareUrl) {
      return;
    }

    await navigator.clipboard.writeText(shareUrl);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  function downloadQrImage() {
    if (!qrDataUrl) {
      return;
    }

    const link = document.createElement("a");
    link.href = qrDataUrl;
    link.download = "ukol-qr-kod.png";
    link.click();
  }

  async function handleShareQr() {
    if (!qrDataUrl || !shareUrl) {
      return;
    }

    const file = dataUrlToFile(qrDataUrl, "ukol-qr-kod.png");
    const canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFile) {
      try {
        await navigator.share({
          files: [file],
          title: "QR kód úkolu",
          text: shareUrl,
        });
        return;
      } catch (shareError) {
        if (shareError instanceof Error && shareError.name === "AbortError") {
          return;
        }
      }
    }

    downloadQrImage();
  }

  async function handleRevoke() {
    setIsRevoking(true);
    setError(null);

    try {
      await revokeShareToken(taskId);
      onTokenChange(taskId, null);
      onClose();
    } catch (revokeError) {
      console.error("Nepodařilo se zrušit sdílení úkolu:", revokeError);
      setError("Nepodařilo se zrušit sdílení. Zkuste to znovu.");
      setIsRevoking(false);
    }
  }

  return (
    <div className="share-task-popover" role="dialog" aria-label="Sdílet úkol pomocí QR kódu">
      <div className="share-task-popover__header">
        <h3>Sdílet úkol</h3>
        <button
          type="button"
          className="share-task-popover__close"
          aria-label="Zavřít"
          onClick={onClose}
        >
          <X size={16} />
        </button>
      </div>

      {isLoading ? (
        <div className="share-task-popover__loading">
          <Loader2 size={20} className="share-task-popover__spinner" />
          <span>Vytvářím odkaz…</span>
        </div>
      ) : null}

      {error ? <p className="share-task-popover__error">{error}</p> : null}

      {!isLoading && qrDataUrl ? (
        <>
          <img
            className="share-task-popover__qr"
            src={qrDataUrl}
            alt="QR kód pro náhled úkolu"
            width={220}
            height={220}
          />
          <p className="share-task-popover__hint">
            Kdokoliv s tímto odkazem uvidí náhled úkolu ke čtení, i bez přihlášení.
          </p>
          <div className="share-task-popover__actions">
            <button type="button" onClick={handleShareQr}>
              <Share2 size={16} />
              Sdílet QR kód
            </button>
            <button type="button" onClick={downloadQrImage}>
              <Download size={16} />
              Stáhnout QR kód
            </button>
            <button type="button" onClick={handleCopyLink}>
              {isCopied ? <Check size={16} /> : <Copy size={16} />}
              {isCopied ? "Zkopírováno" : "Kopírovat odkaz"}
            </button>
            <button
              type="button"
              className="share-task-popover__revoke"
              disabled={isRevoking}
              onClick={handleRevoke}
            >
              {isRevoking ? "Ruším…" : "Zrušit sdílení"}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
