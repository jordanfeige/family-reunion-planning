import { continueWithGoogleAction } from "@/app/actions/login";

export function SignInToSendSheet({
  callbackUrl,
  onDismiss,
}: {
  callbackUrl: string;
  onDismiss: () => void;
}) {
  return (
    <div className="auth-send-sheet" role="dialog" aria-labelledby="auth-send-sheet-title">
      <div className="auth-send-sheet-inner">
        <h3 id="auth-send-sheet-title" className="auth-send-sheet-title">
          Sign in to send your survey
        </h3>
        <p className="auth-send-sheet-body">
          Your plan is saved in this browser. Sign in with Google so family can reply — and so you
          can get their answers back.
        </p>
        <div className="auth-send-sheet-actions">
          <form action={continueWithGoogleAction}>
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <button type="submit" className="btn btn-berry btn-block-sm">
              Continue with Google
            </button>
          </form>
          <button type="button" className="btn btn-secondary btn-block-sm" onClick={onDismiss}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
