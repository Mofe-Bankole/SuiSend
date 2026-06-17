"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { completeZkLogin } from "@/lib/zklogin";

export default function AuthCallback() {
  const router = useRouter();
  const [status, setStatus] = useState<"processing" | "error" | "done">("processing");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    const params = new URLSearchParams(hash);
    const idToken = params.get("id_token");

    if (!idToken) {
      const error = params.get("error");
      setErrorMsg(error || "No id_token in callback URL");
      setStatus("error");
      return;
    }

    completeZkLogin(idToken)
      .then(() => {
        setStatus("done");
        // Redirect back to the app
        setTimeout(() => router.push("/app"), 500);
      })
      .catch((err) => {
        setErrorMsg(err instanceof Error ? err.message : "ZK proof failed");
        setStatus("error");
      });
  }, [router]);

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="glass-card p-8 max-w-md text-center">
          <div className="tx-x mx-auto mb-4 w-12 h-12">
            <svg viewBox="0 0 24 24">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </div>
          <h2 className="font-display text-lg font-bold mb-2">Sign-in failed</h2>
          <p className="text-text-secondary text-sm mb-4">{errorMsg}</p>
          <button
            className="btn-gradient"
            onClick={() => router.push("/app")}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="glass-card p-8 max-w-md text-center">
        <div className="tx-check mx-auto mb-4 w-12 h-12">
          <svg viewBox="0 0 24 24">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-display text-lg font-bold mb-1">
          {status === "processing" ? "Signing in..." : "Signed in!"}
        </h2>
        <p className="text-text-secondary text-sm">
          {status === "processing"
            ? "Generating your Sui wallet from your Google account..."
            : "Redirecting to the app..."}
        </p>
      </div>
    </div>
  );
}
