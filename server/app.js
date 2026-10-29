import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import multer from "multer";
import { fileTypeFromBuffer } from "file-type";
import {
  Organizer,
  Category,
  Event,
  Comment,
  Favorite,
  Reset,
} from "./models.js";
import {
  registration,
  profile,
  eventInput,
  commentInput,
} from "./validation.js";
const here = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(here, "uploads");
const asyncSession = (req, user, res) =>
  req.session.regenerate((err) => {
    if (err)
      return res.status(500).json({ message: "No se pudo iniciar la sesión" });
    req.session.user = user.id;
    req.session.csrf = crypto.randomBytes(24).toString("hex");
    const u = user.toObject();
    delete u.password;
    res.json({ user: u, csrf: req.session.csrf });
  });
export function createApp({ store } = {}) {
  const app = express();
  if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
  app.use(
    helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(
    session({
      name: "ayni.sid",
      secret: process.env.SESSION_SECRET,
      store: store || MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 7 * 86400000,
      },
    }),
  );
  app.use(
    "/api",
    rateLimit({
      windowMs: 60000,
      limit: 200,
      standardHeaders: "draft-8",
      legacyHeaders: false,
    }),
  );
  app.use("/api", (req, res, next) => {
    if (!req.session.visitor) req.session.visitor = crypto.randomUUID();
    if (!req.session.csrf)
      req.session.csrf = crypto.randomBytes(24).toString("hex");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.get("x-csrf-token") !== req.session.csrf
    )
      return res
        .status(403)
        .json({ message: "Recarga la página e inténtalo nuevamente." });
    next();
  });
  const auth = (req, res, next) =>
    req.session.user
      ? next()
      : res.status(401).json({ message: "Inicia sesión para continuar." });
  const loginLimit = rateLimit({ windowMs: 60000, limit: 8 });
  const valid = (req, res, next) =>
    mongoose.isValidObjectId(req.params.id)
      ? next()
      : res.status(400).json({ message: "ID inválido" });
  async function validateCategory(value) {
    const c = await Category.findById(value.categoria);
    if (!c)
      throw Object.assign(new Error("Categoría inválida"), { status: 400 });
    if (
      value.subcategoria_id &&
      !c.subcategorias.some((s) => s.legacyId === value.subcategoria_id)
    )
      throw Object.assign(new Error("Subcategoría inválida"), { status: 400 });
  }
  app.get("/api/session", async (req, res) =>
    res.json({
      csrf: req.session.csrf,
      user: req.session.user
        ? await Organizer.findById(req.session.user)
        : null,
    }),
  );
  app.post("/api/register", loginLimit, async (req, res) => {
    const v = registration.parse(req.body);
    const user = await Organizer.create({
      ...v,
      password: await bcrypt.hash(v.password, 12),
    });
    asyncSession(req, user, res);
  });
  app.post("/api/login", loginLimit, async (req, res) => {
    const email = String(req.body.email || "")
      .trim()
      .toLowerCase();
    const user = await Organizer.findOne({ email }).select("+password");
    if (
      !user ||
      typeof req.body.password !== "string" ||
      req.body.password.length > 128 ||
      !(await bcrypt.compare(req.body.password, user.password))
    )
      return res
        .status(401)
        .json({ message: "Correo o contraseña incorrectos." });
    asyncSession(req, user, res);
  });
  app.post("/api/logout", (req, res) =>
    req.session.destroy(() => {
      res.clearCookie("ayni.sid");
      res.json({ ok: true });
    }),
  );
  app.put("/api/profile", auth, async (req, res) =>
    res.json(
      await Organizer.findByIdAndUpdate(
        req.session.user,
        profile.parse(req.body),
        { new: true },
      ),
    ),
  );
  app.post("/api/recover", loginLimit, async (req, res) => {
    const user = await Organizer.findOne({
      email: String(req.body.email || "")
        .toLowerCase()
        .trim(),
    });
    let demoUrl;
    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      await Reset.create({
        organizador: user.id,
        hash: crypto.createHash("sha256").update(token).digest("hex"),
        expires: new Date(Date.now() + 3600000),
      });
      const url = `${process.env.APP_ORIGIN}/restablecer?token=${token}`;
      if (process.env.SMTP_HOST) {
        await nodemailer
          .createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT || 587),
            secure: process.env.SMTP_PORT === "465",
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
          .sendMail({
            from: process.env.MAIL_FROM,
            to: user.email,
            subject: "Restablecer contraseña — Ayni Cusco",
            text: `Abre este enlace (válido una hora): ${url}`,
          });
      } else if (process.env.NODE_ENV !== "production") demoUrl = url;
    }
    res.json({
      message:
        "Si el correo existe, recibirás un enlace para restablecer tu contraseña.",
      demoUrl,
    });
  });
  app.post("/api/reset", loginLimit, async (req, res) => {
    const password = registration.shape.password.parse(req.body.password);
    const hash = crypto
      .createHash("sha256")
      .update(String(req.body.token || ""))
      .digest("hex");
    const reset = await Reset.findOneAndDelete({
      hash,
      expires: { $gt: new Date() },
    });
    if (!reset)
      return res.status(400).json({ message: "Enlace vencido o utilizado." });
    await Organizer.findByIdAndUpdate(reset.organizador, {
      password: await bcrypt.hash(password, 12),
    });
    await Reset.deleteMany({ organizador: reset.organizador });
    res.json({ ok: true });
  });
  app.get("/api/categories", async (req, res) =>
    res.json(await Category.find().sort("orden")),
  );
  app.get("/api/events", async (req, res) => {
    const filter = { estado: "publicado" };
    if (req.query.category) {
      const c = await Category.findOne({ slug: String(req.query.category) });
      if (!c) return res.json([]);
      filter.categoria = c.id;
    }
    if (req.query.q) {
      const escaped = String(req.query.q)
        .slice(0, 150)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = { $regex: escaped, $options: "i" };
      const [cats, orgs] = await Promise.all([
        Category.find({ nombre: regex }).select("_id"),
        Organizer.find({ nombre: regex }).select("_id"),
      ]);
      filter.$or = [
        ...["titulo", "lugar", "etiqueta", "descripcion"].map((k) => ({
          [k]: regex,
        })),
        { categoria: { $in: cats.map((x) => x._id) } },
        { organizador: { $in: orgs.map((x) => x._id) } },
      ];
    }
    if (req.query.free === "1") filter.precio_valor = 0;
    if (req.query.sub) filter.subcategoria_id = Number(req.query.sub);
    if (req.query.organizer && mongoose.isValidObjectId(req.query.organizer))
      filter.organizador = req.query.organizer;
    res.json(
      await Event.find(filter)
        .populate("categoria organizador")
        .sort({ destacado: -1, fecha_inicio: 1 })
        .limit(200),
    );
  });
  app.get("/api/mine", auth, async (req, res) =>
    res.json(
      await Event.find({ organizador: req.session.user })
        .populate("categoria")
        .sort("-createdAt"),
    ),
  );
  app.get("/api/events/:id", valid, async (req, res) => {
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, estado: "publicado" },
      { $inc: { visitas: 1 } },
      { new: true },
    ).populate("categoria organizador");
    if (!event)
      return res.status(404).json({ message: "Evento no encontrado" });
    res.json({
      ...event.toObject(),
      comentarios: await Comment.find({ evento: event.id })
        .sort("-createdAt")
        .limit(100),
    });
  });
  app.post("/api/events", auth, async (req, res) => {
    const value = eventInput.parse(req.body);
    await validateCategory(value);
    res
      .status(201)
      .json(await Event.create({ ...value, organizador: req.session.user }));
  });
  app.put("/api/events/:id", auth, valid, async (req, res) => {
    const value = eventInput.parse(req.body);
    await validateCategory(value);
    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, organizador: req.session.user },
      value,
      { new: true },
    );
    if (!event)
      return res
        .status(404)
        .json({ message: "No se encontró un evento tuyo con ese ID" });
    res.json(event);
  });
  app.delete("/api/events/:id", auth, valid, async (req, res) => {
    const e = await Event.findOneAndDelete({
      _id: req.params.id,
      organizador: req.session.user,
    });
    if (!e) return res.status(404).json({ message: "Evento no encontrado" });
    await Promise.all([
      Comment.deleteMany({ evento: e.id }),
      Favorite.deleteMany({ evento: e.id }),
    ]);
    res.json({ ok: true });
  });
  app.post(
    "/api/events/:id/comments",
    valid,
    rateLimit({ windowMs: 15000, limit: 1 }),
    async (req, res) => {
      if (!(await Event.exists({ _id: req.params.id, estado: "publicado" })))
        return res.status(404).json({ message: "Evento no encontrado" });
      res
        .status(201)
        .json(
          await Comment.create({
            ...commentInput.parse(req.body),
            evento: req.params.id,
          }),
        );
    },
  );
  app.post("/api/events/:id/whatsapp", valid, async (req, res) => {
    const e = await Event.findOneAndUpdate(
      { _id: req.params.id, estado: "publicado" },
      { $inc: { clics_whatsapp: 1 } },
    );
    if (!e) return res.status(404).json({ message: "Evento no encontrado" });
    res.json({
      url: `https://wa.me/${e.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, quiero información sobre ${e.titulo}`)}`,
    });
  });
  app.get("/api/favorites", async (req, res) => {
    const list = await Favorite.find({
      visitante: req.session.visitor,
    }).populate({
      path: "evento",
      populate: [{ path: "categoria" }, { path: "organizador" }],
    });
    res.json(
      list.filter((x) => x.evento?.estado === "publicado").map((x) => x.evento),
    );
  });
  app.put("/api/favorites/:id", valid, async (req, res) => {
    if (!(await Event.exists({ _id: req.params.id, estado: "publicado" })))
      return res.status(404).json({ message: "Evento no encontrado" });
    await Favorite.updateOne(
      { visitante: req.session.visitor, evento: req.params.id },
      {
        $setOnInsert: { visitante: req.session.visitor, evento: req.params.id },
      },
      { upsert: true },
    );
    res.json({ ok: true });
  });
  app.delete("/api/favorites/:id", valid, async (req, res) => {
    await Favorite.deleteOne({
      visitante: req.session.visitor,
      evento: req.params.id,
    });
    res.json({ ok: true });
  });
  app.get("/api/organizers/:id", valid, async (req, res) => {
    const u = await Organizer.findById(req.params.id);
    if (!u)
      return res.status(404).json({ message: "Organizador no encontrado" });
    res.json(u);
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  });
  app.post("/api/uploads", auth, upload.single("imagen"), async (req, res) => {
    if (!req.file)
      return res.status(400).json({ message: "Selecciona una imagen" });
    const type = await fileTypeFromBuffer(req.file.buffer);
    if (!type || !["image/jpeg", "image/png", "image/webp"].includes(type.mime))
      return res.status(400).json({ message: "Solo JPG, PNG o WEBP" });
    await mkdir(uploadDir, { recursive: true });
    const name = `${crypto.randomUUID()}.${type.ext}`;
    await writeFile(path.join(uploadDir, name), req.file.buffer);
    res.status(201).json({ url: `/uploads/${name}` });
  });
  app.use("/api", (req, res) =>
    res.status(404).json({ message: "Ruta no encontrada" }),
  );
  app.use("/uploads", express.static(uploadDir, { index: false }));
  const dist = path.join(here, "../client/dist");
  app.use(express.static(dist));
  app.get("/{*path}", (req, res) =>
    res.sendFile(path.join(dist, "index.html")),
  );
  app.use((err, req, res, next) => {
    if (err.name === "ZodError")
      return res
        .status(400)
        .json({
          message: err.issues
            .map((i) => `${i.path.join(".")}: ${i.message}`)
            .join(" · "),
        });
    if (err.code === 11000)
      return res.status(409).json({ message: "El registro ya existe." });
    if (err.code === "LIMIT_FILE_SIZE")
      return res
        .status(400)
        .json({ message: "La imagen debe pesar como máximo 5 MB." });
    if (err.status)
      return res.status(err.status).json({ message: err.message });
    console.error(err.message);
    res.status(500).json({ message: "No se pudo completar la operación." });
  });
  return app;
}
