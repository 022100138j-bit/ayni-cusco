import { z } from "zod";
const text = (n) => z.string().trim().max(n);
const phone = z
  .string()
  .trim()
  .regex(/^\+?\d{8,15}$/, "WhatsApp debe contener de 8 a 15 dígitos");
const id = z.string().regex(/^[a-f\d]{24}$/i, "ID inválido");
const image = text(700).refine(
  (v) => !v || /^https:\/\//i.test(v) || /^\/uploads\/[a-z\d_.-]+$/i.test(v),
  "Usa una URL HTTPS o una imagen subida",
);
const social = text(255).refine(
  (v) => !v || /^https:\/\//i.test(v),
  "Usa una URL HTTPS",
);
export const registration = z.object({
  nombre: text(150).min(2),
  email: z
    .email()
    .max(150)
    .transform((s) => s.toLowerCase()),
  whatsapp: phone,
  password: z.string().min(8).max(128),
});
export const profile = z.object({
  nombre: text(150).min(2),
  whatsapp: phone,
  descripcion: text(3000).default(""),
  ubicacion: text(120).default("Cusco, Perú"),
  instagram: social.default(""),
  facebook: social.default(""),
  tiktok: social.default(""),
  youtube: social.default(""),
});
export const eventInput = z
  .object({
    titulo: text(180).min(3),
    descripcion: text(10000).min(10),
    categoria: id,
    subcategoria_id: z.number().int().positive().nullable().optional(),
    tipo: z
      .enum(["evento", "servicio", "exposicion", "cultural"])
      .default("evento"),
    etiqueta: text(60).default(""),
    fecha_inicio: z
      .union([z.iso.datetime({ offset: true }), z.literal("")])
      .nullable()
      .optional()
      .transform((v) => v || null),
    fecha_texto: text(120).default(""),
    lugar: text(200).min(3),
    precio_texto: text(80).default(""),
    precio_valor: z.number().min(0).nullable().default(null),
    whatsapp: phone,
    imagen: image.default(""),
    lat: z.number().min(-90).max(90).nullable().optional(),
    lng: z.number().min(-180).max(180).nullable().optional(),
    placeId: text(300).default(""),
  })
  .refine(
    (v) => (v.lat == null) === (v.lng == null),
    "Se requieren ambas coordenadas",
  );
export const commentInput = z.object({
  nombre: text(80).min(2),
  texto: text(600).min(3),
});
