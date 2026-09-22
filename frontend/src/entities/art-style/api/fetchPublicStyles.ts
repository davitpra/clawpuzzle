import type { StyleDifficulty } from "@/entities/art-style/model/difficulty";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/api";

export interface PublicStyleImage {
  id: string;
  imageUrl: string;
  altImage: string | null;
  orderIndex: number;
  isPrimary: boolean;
}

export interface PublicStyle {
  id: string;
  displayName: string;
  difficulty: StyleDifficulty;
  images: PublicStyleImage[];
}

const DIFFICULTIES = new Set<StyleDifficulty>([
  "easy",
  "medium",
  "challenging",
]);

function isPublicStyleImage(value: unknown): value is PublicStyleImage {
  if (!value || typeof value !== "object") return false;
  const image = value as Partial<PublicStyleImage>;

  return (
    typeof image.id === "string" &&
    typeof image.imageUrl === "string" &&
    (typeof image.altImage === "string" || image.altImage === null) &&
    typeof image.orderIndex === "number" &&
    typeof image.isPrimary === "boolean"
  );
}

function isPublicStyle(value: unknown): value is PublicStyle {
  if (!value || typeof value !== "object") return false;
  const style = value as Partial<PublicStyle>;

  return (
    typeof style.id === "string" &&
    typeof style.displayName === "string" &&
    typeof style.difficulty === "string" &&
    DIFFICULTIES.has(style.difficulty as StyleDifficulty) &&
    Array.isArray(style.images) &&
    style.images.every(isPublicStyleImage)
  );
}

export async function fetchPublicStyles(): Promise<PublicStyle[]> {
  const response = await fetch(`${API_URL}/styles`, {
    next: { revalidate: 300 },
  });
  if (!response.ok) {
    throw new Error(`Styles request failed with status ${response.status}`);
  }

  const json = (await response.json()) as
    | { data?: unknown }
    | unknown[];
  const data = Array.isArray(json) ? json : json.data;
  if (!Array.isArray(data)) return [];

  return data.filter(isPublicStyle).map((style) => ({
    ...style,
    images: [...style.images].sort(
      (a, b) => a.orderIndex - b.orderIndex || a.id.localeCompare(b.id),
    ),
  }));
}
