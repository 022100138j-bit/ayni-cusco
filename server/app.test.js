import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import session from "express-session";
import request from "supertest";
import { createApp } from "./app.js";
import { seed } from "./seed.js";
import { Category, Event, Organizer } from "./models.js";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
let mongo, app;
let dbPath;
before(
  async () => {
    process.env.SESSION_SECRET = "test-secret-with-at-least-32-characters";
    process.env.NODE_ENV = "test";
    process.env.APP_ORIGIN = "http://localhost:5173";
    if (process.env.TEST_DB_ROOT) {
      await mkdir(process.env.TEST_DB_ROOT, { recursive: true });
      dbPath = await mkdtemp(
        path.join(process.env.TEST_DB_ROOT, "integration-"),
      );
    }
    mongo = await MongoMemoryServer.create({
      instance: dbPath ? { dbPath } : undefined,
    });
    await mongoose.connect(mongo.getUri());
    await seed();
    app = createApp({ store: new session.MemoryStore() });
  },
  { timeout: 180000 },
);
after(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  if (dbPath) await rm(dbPath, { recursive: true, force: true });
});
async function client(email, password = "Ayni2026!") {
  const agent = request.agent(app);
  let r = await agent.get("/api/session");
  let csrf = r.body.csrf;
  if (email) {
    r = await agent
      .post("/api/login")
      .set("X-CSRF-Token", csrf)
      .send({ email, password });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    csrf = r.body.csrf;
  }
  return { agent, csrf };
}
test("migra datos originales y permite búsqueda literal sin inyección regex", async () => {
  const r = await request(app).get("/api/categories");
  assert.equal(r.body.length, 14);
  assert.equal(await Event.countDocuments(), 42);
  assert.equal(await Organizer.countDocuments(), 4);
  const events = await request(app).get("/api/events");
  assert.equal(events.body.length, 42);
  assert.ok(!JSON.stringify(events.body).includes("password"));
  const literal = await request(app).get("/api/events").query({ q: "(" });
  assert.equal(literal.status, 200);
});
test("CSRF, acceso autenticado, propiedad de eventos y persistencia de coordenadas", async () => {
  const c = await client("demo@aynicusco.pe"),
    other = await client("imperiales@aynicusco.pe");
  const cat = await Category.findOne();
  const value = {
    titulo: "Evento de prueba",
    descripcion: "Una descripción válida para el evento.",
    categoria: cat.id,
    lugar: "Plaza de Armas, Cusco",
    whatsapp: "51984000001",
    lat: -13.5167,
    lng: -71.9789,
    placeId: "test-place",
    fecha_inicio: "2026-12-01T18:00:00-05:00",
  };
  let r = await c.agent.post("/api/events").send(value);
  assert.equal(r.status, 403);
  r = await c.agent
    .post("/api/events")
    .set("X-CSRF-Token", c.csrf)
    .send({ ...value, lat: 100 });
  assert.equal(r.status, 400);
  r = await c.agent.post("/api/events").set("X-CSRF-Token", c.csrf).send(value);
  assert.equal(r.status, 201, JSON.stringify(r.body));
  const id = r.body._id;
  assert.equal(r.body.lat, value.lat);
  r = await other.agent
    .put("/api/events/" + id)
    .set("X-CSRF-Token", other.csrf)
    .send({ ...value, titulo: "No autorizado" });
  assert.equal(r.status, 404);
  r = await other.agent
    .delete("/api/events/" + id)
    .set("X-CSRF-Token", other.csrf);
  assert.equal(r.status, 404);
  r = await c.agent
    .put("/api/events/" + id)
    .set("X-CSRF-Token", c.csrf)
    .send({ ...value, titulo: "Actualizado", estado: "oculto", visitas: 999 });
  assert.equal(r.status, 200);
  assert.equal(r.body.estado, "publicado");
  assert.equal(r.body.visitas, 0);
  r = await c.agent.delete("/api/events/" + id).set("X-CSRF-Token", c.csrf);
  assert.equal(r.status, 200);
});
test("favoritos idempotentes y aislados por visitante; comentarios", async () => {
  const a = await client(),
    b = await client();
  const e = await Event.findOne();
  for (let i = 0; i < 2; i++) {
    const r = await a.agent
      .put("/api/favorites/" + e.id)
      .set("X-CSRF-Token", a.csrf)
      .send({});
    assert.equal(r.status, 200);
  }
  assert.equal((await a.agent.get("/api/favorites")).body.length, 1);
  assert.equal((await b.agent.get("/api/favorites")).body.length, 0);
  let r = await a.agent
    .post("/api/events/" + e.id + "/comments")
    .set("X-CSRF-Token", a.csrf)
    .send({ nombre: "Visitante", texto: "Una experiencia excelente" });
  assert.equal(r.status, 201);
  r = await a.agent
    .delete("/api/favorites/" + e.id)
    .set("X-CSRF-Token", a.csrf);
  assert.equal(r.status, 200);
  assert.equal((await a.agent.get("/api/favorites")).body.length, 0);
});
test("recuperación: token de un solo uso, cambio de contraseña y perfil protegido", async () => {
  const c = await client();
  let r = await c.agent
    .post("/api/register")
    .set("X-CSRF-Token", c.csrf)
    .send({
      nombre: "Nuevo organizador",
      email: "test@example.com",
      password: "Password123!",
      whatsapp: "51999999999",
    });
  assert.equal(r.status, 200);
  const csrf = r.body.csrf;
  assert.ok(!r.body.user.password);
  r = await c.agent
    .put("/api/profile")
    .set("X-CSRF-Token", csrf)
    .send({
      nombre: "Nuevo nombre",
      whatsapp: "51999999999",
      verificado: true,
    });
  assert.equal(r.status, 200);
  assert.equal(r.body.verificado, false);
  r = await c.agent
    .post("/api/recover")
    .set("X-CSRF-Token", csrf)
    .send({ email: "test@example.com" });
  assert.equal(r.status, 200);
  const token = new URL(r.body.demoUrl).searchParams.get("token");
  r = await c.agent
    .post("/api/reset")
    .set("X-CSRF-Token", csrf)
    .send({ token, password: "Updated123!" });
  assert.equal(r.status, 200);
  r = await c.agent
    .post("/api/reset")
    .set("X-CSRF-Token", csrf)
    .send({ token, password: "Updated123!" });
  assert.equal(r.status, 400);
  await client("test@example.com", "Updated123!");
});
