import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createI18n, localeCookie, parseLocale } from "./index";
export const getI18n = cache(async () => createI18n(parseLocale((await cookies()).get(localeCookie)?.value)));
