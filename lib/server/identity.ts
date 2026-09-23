// Keep picker sessions separate from previously issued credential sessions.
export function sessionKey(token: string) { return `demo:${token}`; }
