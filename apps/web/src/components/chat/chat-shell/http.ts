export const fetchJson = async <T,>(
  url: string
): Promise<
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: string;
    }
> => {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      let msg = `${res.status}`;
      try {
        const body = await res.json();
        if (body?.error && typeof body.error === "string") msg = body.error;
      } catch {
        //
      }
      return { ok: false, error: msg };
    }
    const data = (await res.json()) as T;
    return { ok: true, data };
  } catch {
    return { ok: false, error: "网络错误" };
  }
};

export const consumeSse = async (
  stream: ReadableStream<Uint8Array>,
  handle: (event: string, payload: unknown) => void,
  signal?: AbortSignal
): Promise<void> => {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const onAbort = () => {
    void reader.cancel().catch(() => undefined);
  };
  if (signal) {
    if (signal.aborted) {
      await reader.cancel().catch(() => undefined);
      return;
    }
    signal.addEventListener("abort", onAbort, { once: true });
  }
  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      while (true) {
        const idx = buffer.indexOf("\n\n");
        if (idx < 0) break;
        const raw = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        let eventName = "message";
        let dataPayload = "";
        const lines = raw.split("\n").filter(Boolean);
        for (const ln of lines) {
          if (ln.startsWith("event:"))
            eventName = ln.slice("event:".length).trim();
          else if (ln.startsWith("data:"))
            dataPayload = ln.slice("data:".length).trim();
        }
        if (dataPayload) {
          let parsed: unknown = dataPayload;
          try {
            parsed = JSON.parse(dataPayload);
          } catch {
            //
          }
          handle(eventName, parsed);
        }
      }
    }
  } finally {
    if (signal) signal.removeEventListener("abort", onAbort);
    try {
      reader.releaseLock();
    } catch {
      //
    }
  }
};

export const mutateJson = async <B, R>(
  url: string,
  method: "POST" | "PATCH" | "DELETE",
  body?: B
): Promise<
  | {
      ok: true;
      data: R;
    }
  | {
      ok: false;
      error: string;
      status: number;
    }
> => {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      //
    }
    let msg = `${res.status}`;
    if (
      parsed &&
      typeof parsed === "object" &&
      "error" in parsed &&
      typeof (
        parsed as {
          error?: unknown;
        }
      ).error === "string"
    ) {
      msg = (
        parsed as {
          error: string;
        }
      ).error;
    }
    if (!res.ok) {
      return { ok: false, error: msg, status: res.status };
    }
    return { ok: true, data: parsed as R };
  } catch {
    return { ok: false, error: "网络错误", status: 0 };
  }
};
