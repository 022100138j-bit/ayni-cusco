import "dotenv/config";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Organizer, Category, Event, Comment } from "./models.js";
export async function seed() {
  const data = JSON.parse(
    await readFile(new URL("./seed-data.json", import.meta.url), "utf8"),
  );
  const orgs = new Map(),
    cats = new Map(),
    events = new Map();
  const password = await bcrypt.hash("Ayni2026!", 12);
  for (const u of data.organizers) {
    const { id, ...rest } = u;
    const doc = await Organizer.findOneAndUpdate(
      { email: u.email },
      { $setOnInsert: { ...rest, legacyId: id, password } },
      { upsert: true, new: true },
    );
    orgs.set(id, doc._id);
  }
  for (const c of data.categories) {
    const { id, subcategorias, ...rest } = c;
    const doc = await Category.findOneAndUpdate(
      { slug: c.slug },
      {
        $setOnInsert: {
          ...rest,
          legacyId: id,
          subcategorias: subcategorias.map(({ id, categoria_id, ...s }) => ({
            ...s,
            legacyId: id,
          })),
        },
      },
      { upsert: true, new: true },
    );
    cats.set(id, doc._id);
  }
  for (const e of data.events) {
    const { id, organizador_id, categoria_id, fecha_inicio, ...rest } = e;
    const doc = await Event.findOneAndUpdate(
      { legacyId: id },
      {
        $setOnInsert: {
          ...rest,
          legacyId: id,
          fecha_inicio: fecha_inicio
            ? new Date(fecha_inicio.replace(" ", "T") + "-05:00")
            : null,
          organizador: orgs.get(organizador_id),
          categoria: cats.get(categoria_id),
        },
      },
      { upsert: true, new: true },
    );
    events.set(id, doc._id);
  }
  for (const c of data.comments) {
    const { evento_id, ...rest } = c;
    await Comment.updateOne(
      { evento: events.get(evento_id), nombre: c.nombre, texto: c.texto },
      { $setOnInsert: rest },
      { upsert: true },
    );
  }
  console.log(
    `Datos cargados: ${orgs.size} organizadores, ${cats.size} categorías, ${events.size} eventos. No se borraron registros existentes.`,
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (!process.env.MONGODB_URI)
    throw Error("Configura MONGODB_URI en server/.env");
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    await seed();
  } finally {
    await mongoose.disconnect();
  }
}
