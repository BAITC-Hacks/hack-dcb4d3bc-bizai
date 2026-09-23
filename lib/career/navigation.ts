// Accept only the employee map route, never arbitrary return URLs or other workspaces.
export function mapReturnPath(value: string | undefined): string | null {
  if (!value || !value.startsWith("/employee/dashboard?")) return null;
  try {
    const url = new URL(value, "http://local.invalid");
    if (url.origin !== "http://local.invalid" || url.pathname !== "/employee/dashboard") return null;
    if (url.searchParams.has("view") && !["overview", "skills"].includes(url.searchParams.get("view")!)) return null;
    const params = new URLSearchParams();
    for (const key of ["view", "mapQuery", "mapFilter", "mapSkill", "mapDetails"]) {
      const item = url.searchParams.get(key);
      if (item !== null) params.set(key, item);
    }
    return `${url.pathname}?${params.toString()}#trajectory`;
  } catch { return null; }
}
