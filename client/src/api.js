let csrf = "";
export async function api(path, options = {}) {
  const { body, ...rest } = options;
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...rest,
    headers: {
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      "X-CSRF-Token": csrf,
      ...rest.headers,
    },
    ...(body !== undefined
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  const data = await response
    .json()
    .catch(() => ({ message: "El servidor no está disponible." }));
  if (!response.ok)
    throw Error(data.message || "No se pudo completar la solicitud.");
  if (data.csrf) csrf = data.csrf;
  return data;
}
