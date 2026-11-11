import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Clerk keeps session cookies fresh for server rendering. Pages themselves
// stay public: the app gates content client-side and Convex enforces
// permissions server-side on every query and mutation.
const withClerk = clerkMiddleware();

export default process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  ? withClerk
  : () => NextResponse.next();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
