import mongoose from "mongoose";
const { Schema } = mongoose;
const opts = { timestamps: true };
export const Organizer = mongoose.model(
  "Organizer",
  new Schema(
    {
      legacyId: Number,
      nombre: String,
      email: { type: String, unique: true, required: true },
      whatsapp: String,
      password: { type: String, select: false },
      descripcion: String,
      ubicacion: String,
      instagram: String,
      facebook: String,
      tiktok: String,
      youtube: String,
      verificado: { type: Boolean, default: false },
    },
    opts,
  ),
);
export const Category = mongoose.model(
  "Category",
  new Schema(
    {
      legacyId: Number,
      slug: { type: String, unique: true },
      nombre: String,
      emoji: String,
      titulo: String,
      descripcion: String,
      hero_imagen: String,
      color: String,
      color2: String,
      color_texto: String,
      vista: String,
      orden: Number,
      subcategorias: [
        {
          legacyId: Number,
          nombre: String,
          emoji: String,
          slug: String,
          filtro: String,
        },
      ],
    },
    opts,
  ),
);
const eventSchema = new Schema(
  {
    legacyId: Number,
    organizador: {
      type: Schema.Types.ObjectId,
      ref: "Organizer",
      required: true,
    },
    categoria: { type: Schema.Types.ObjectId, ref: "Category", required: true },
    subcategoria_id: Number,
    tipo: { type: String, default: "evento" },
    titulo: String,
    etiqueta: String,
    descripcion: String,
    fecha_inicio: Date,
    fecha_texto: String,
    lugar: String,
    precio_texto: String,
    precio_valor: Number,
    nota: String,
    texto_boton: String,
    whatsapp: String,
    imagen: String,
    galeria: [String],
    lat: Number,
    lng: Number,
    placeId: String,
    destacado: Boolean,
    estado: { type: String, default: "publicado" },
    visitas: { type: Number, default: 0 },
    clics_whatsapp: { type: Number, default: 0 },
  },
  opts,
);
eventSchema.index({ estado: 1, fecha_inicio: 1 });
export const Event = mongoose.model("Event", eventSchema);
export const Comment = mongoose.model(
  "Comment",
  new Schema(
    {
      evento: { type: Schema.Types.ObjectId, ref: "Event" },
      nombre: String,
      texto: String,
    },
    opts,
  ),
);
const favSchema = new Schema(
  { visitante: String, evento: { type: Schema.Types.ObjectId, ref: "Event" } },
  opts,
);
favSchema.index({ visitante: 1, evento: 1 }, { unique: true });
export const Favorite = mongoose.model("Favorite", favSchema);
export const Reset = mongoose.model(
  "Reset",
  new Schema(
    {
      organizador: { type: Schema.Types.ObjectId, ref: "Organizer" },
      hash: String,
      expires: { type: Date, index: { expires: 0 } },
    },
    opts,
  ),
);
