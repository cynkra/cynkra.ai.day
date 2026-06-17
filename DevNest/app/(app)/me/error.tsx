"use client";

import { RouteError } from "@/components/route-error";

export default function MeError(props: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <RouteError {...props} scope="Your profile" />;
}
