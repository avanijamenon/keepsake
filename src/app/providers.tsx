"use client";

import { ClerkProvider, useAuth } from "@clerk/nextjs";
import { ConvexProvider, ConvexReactClient, useConvexAuth, useMutation } from "convex/react";
import { ConvexProviderWithClerk } from "convex/react-clerk";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { ToastProvider } from "@/components/ui";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

type Session = { mode: "clerk" | "dev"; loading: boolean; signedIn: boolean };
const SessionContext = createContext<Session>({ mode: "dev", loading: true, signedIn: false });
export const useSession = () => useContext(SessionContext);

/** Makes sure a users row exists once we know who's here. */
function EnsureUser({
  mode,
  signedIn,
  authLoading,
  children,
}: {
  mode: Session["mode"];
  signedIn: boolean;
  authLoading: boolean;
  children: ReactNode;
}) {
  const ensure = useMutation(api.users.ensure);
  const [ready, setReady] = useState(false);
  const loading = authLoading || (signedIn && !ready);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    ensure({})
      .then(() => !cancelled && setReady(true))
      .catch(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, [signedIn, ensure]);

  return (
    <SessionContext.Provider value={{ mode, loading, signedIn: signedIn && ready }}>
      {children}
    </SessionContext.Provider>
  );
}

function ClerkSession({ children }: { children: ReactNode }) {
  const auth = useConvexAuth();
  return (
    <EnsureUser mode="clerk" signedIn={auth.isAuthenticated} authLoading={auth.isLoading}>
      {children}
    </EnsureUser>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  if (clerkKey) {
    return (
      <ClerkProvider publishableKey={clerkKey} signInUrl="/sign-in" signUpUrl="/sign-up" afterSignOutUrl="/">
        <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
          <ClerkSession>
            <ToastProvider>{children}</ToastProvider>
          </ClerkSession>
        </ConvexProviderWithClerk>
      </ClerkProvider>
    );
  }
  // Local development without Clerk: the Convex deployment treats requests as
  // a single dev user (DEV_AUTH_BYPASS). Never deploy like this.
  return (
    <ConvexProvider client={convex}>
      <EnsureUser mode="dev" signedIn authLoading={false}>
        <ToastProvider>{children}</ToastProvider>
      </EnsureUser>
    </ConvexProvider>
  );
}
