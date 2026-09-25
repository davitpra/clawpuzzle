const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export interface LaunchProductRef {
  productRefId: string;
  shopifyHandle: string;
  template: string | null;
}

/**
 * El producto de lanzamiento marcado en el admin (GET /products/launch).
 * Devuelve `null` si no hay ninguno configurado o no tiene handle de Shopify.
 */
export async function fetchLaunchProduct(): Promise<LaunchProductRef | null> {
  const response = await fetch(`${API_URL}/products/launch`, {
    next: { revalidate: 300 },
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(
      `Launch product request failed with status ${response.status}`,
    );
  }

  const json = (await response.json()) as
    | { data?: Partial<LaunchProductRef> }
    | Partial<LaunchProductRef>;
  const data = ("data" in json ? json.data : json) as
    | Partial<LaunchProductRef>
    | undefined;
  if (!data?.shopifyHandle || !data.productRefId) return null;

  return {
    productRefId: data.productRefId,
    shopifyHandle: data.shopifyHandle,
    template: data.template ?? null,
  };
}
