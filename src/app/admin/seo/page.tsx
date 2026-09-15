"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// The standalone SEO page was merged into Settings → SEO tab.
// Keep this route as a redirect so old bookmarks/links keep working.
export default function AdminSeoRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/admin/settings?tab=seo");
  }, [router]);
  return null;
}
