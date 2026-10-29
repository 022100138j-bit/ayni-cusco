import React, { createContext, useContext, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useParams,
  useSearchParams,
  useLocation,
} from "react-router-dom";
import { api } from "./api";
import LeafletLocation from "./LeafletLocation";
import "./style.css";
const AppContext = createContext(null);
const useApp = () => useContext(AppContext);
const date = (e) =>
  e.fecha_inicio
    ? new Intl.DateTimeFormat("es-PE", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "America/Lima",
      }).format(new Date(e.fecha_inicio))
    : e.fecha_texto || "Consulta disponibilidad";
function useLoad(url) {
  const [state, set] = useState({ data: null, error: "", loading: true });
  useEffect(() => {
    let active = true;
    set({ data: null, error: "", loading: true });
    api(url)
      .then((data) => active && set({ data, error: "", loading: false }))
      .catch(
        (e) => active && set({ data: null, error: e.message, loading: false }),
      );
    return () => {
      active = false;
    };
  }, [url]);
  return state;
}
function Status({ state, children }) {
  if (state.loading)
    return (
      <p className="notice" role="status">
        Cargando…
      </p>
    );
  if (state.error)
    return (
      <p className="notice error" role="alert">
        {state.error}
      </p>
    );
  return children(state.data);
}
function FormError({ error }) {
  return error ? (
    <p className="notice error" role="alert">
      {error}
    </p>
  ) : null;
}
function App() {
  const [session, setSession] = useState(null),
    [fatal, setFatal] = useState(""),
    [categories, setCategories] = useState([]),
    [favorites, setFavorites] = useState([]),
    [message, setMessage] = useState("");
  async function refresh() {
    const s = await api("/session");
    setSession(s);
    setFavorites(await api("/favorites"));
  }
  useEffect(() => {
    refresh()
      .then(() => api("/categories"))
      .then(setCategories)
      .catch((e) => setFatal(e.message));
  }, []);
  async function toggle(id) {
    try {
      const exists = favorites.some((x) => x._id === id);
      await api("/favorites/" + id, {
        method: exists ? "DELETE" : "PUT",
        body: {},
      });
      setFavorites(await api("/favorites"));
    } catch (e) {
      setMessage(e.message);
    }
  }
  if (fatal)
    return (
      <main className="page">
        <h1>No se pudo conectar</h1>
        <p>{fatal}</p>
        <p>Comprueba que el servidor y MongoDB estén iniciados.</p>
        <button onClick={() => location.reload()}>Reintentar</button>
      </main>
    );
  if (!session) return <p className="page">Conectando con Ayni Cusco…</p>;
  return (
    <AppContext.Provider
      value={{
        session,
        setSession,
        categories,
        favorites,
        toggle,
        refresh,
        setMessage,
      }}
    >
      <BrowserRouter>
        <ScrollTop />
        <Nav />
        {message && (
          <div className="toast" role="status">
            {message}
            <button aria-label="Cerrar aviso" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/eventos" element={<Catalog />} />
          <Route path="/categoria/:slug" element={<Catalog />} />
          <Route path="/evento/:id" element={<Detail />} />
          <Route path="/favoritos" element={<Favorites />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/registro" element={<Auth register />} />
          <Route path="/recuperar" element={<Recovery />} />
          <Route path="/restablecer" element={<Recovery reset />} />
          <Route
            path="/panel"
            element={
              <Protected>
                <Panel />
              </Protected>
            }
          />
          <Route
            path="/publicar"
            element={
              <Protected>
                <EventForm />
              </Protected>
            }
          />
          <Route
            path="/editar/:id"
            element={
              <Protected>
                <EventForm />
              </Protected>
            }
          />
          <Route
            path="/mi-perfil"
            element={
              <Protected>
                <ProfileEdit />
              </Protected>
            }
          />
          <Route path="/perfil/:id" element={<PublicProfile />} />
          <Route path="/sobre-nosotros" element={<About />} />
          <Route path="/historia-cusco" element={<History />} />
          <Route
            path="*"
            element={
              <main className="page">
                <h1>Página no encontrada</h1>
                <Link to="/">Volver al inicio</Link>
              </main>
            }
          />
        </Routes>
        <Footer />
      </BrowserRouter>
    </AppContext.Provider>
  );
}
function ScrollTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}
function Nav() {
  const { session, favorites, refresh, setMessage } = useApp(),
    [open, setOpen] = useState(false),
    navigate = useNavigate();
  return (
    <>
      <div className="flag-bar" />
      <nav className="nav">
        <Link to="/" className="brand">
          Ayni <span>Cusco</span>
        </Link>
        <button
          className="menu"
          aria-expanded={open}
          aria-label="Abrir menú"
          onClick={() => setOpen(!open)}
        >
          ☰
        </button>
        <div
          className={"nav-items " + (open ? "open" : "")}
          onClick={() => setOpen(false)}
        >
          <Link to="/">Inicio</Link>
          <Link to="/eventos">Categorías y eventos</Link>
          <Link to="/sobre-nosotros">Sobre nosotros</Link>
          <Link
            className="button"
            to={session.user ? "/publicar" : "/registro"}
          >
            + Publicar evento
          </Link>
          <Link to="/favoritos">♥ Favoritos ({favorites.length})</Link>
          {session.user ? (
            <>
              <Link to="/panel">Mi panel</Link>
              <button
                className="plain"
                onClick={async () => {
                  try {
                    await api("/logout", { method: "POST", body: {} });
                    await refresh();
                    navigate("/");
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
              >
                Salir
              </button>
            </>
          ) : (
            <Link to="/login">Ingresar</Link>
          )}
        </div>
      </nav>
    </>
  );
}
function Footer() {
  return (
    <footer>
      <Link className="brand" to="/">
        Ayni <span>Cusco</span>
      </Link>
      <p>Eventos, experiencias y tradiciones de la Ciudad Imperial.</p>
      <Link to="/historia-cusco">Historia del Cusco</Link>
      <span> · </span>
      <Link to="/sobre-nosotros">Sobre nosotros</Link>
      <p>Hecho para conectar nuestra cultura.</p>
    </footer>
  );
}
function Search({ initial = "" }) {
  return (
    <form action="/eventos" className="search">
      <input
        name="q"
        aria-label="Buscar eventos"
        defaultValue={initial}
        placeholder="¿Qué evento buscas hoy?"
        maxLength={150}
      />
      <button>Buscar</button>
    </form>
  );
}
function Home() {
  const state = useLoad("/events"),
    { categories } = useApp();
  return (
    <>
      <header className="hero">
        <p className="eyebrow">CULTURA · MÚSICA · EXPERIENCIAS</p>
        <h1>
          Vive la magia de
          <br />
          <span>Ayni Cusco</span>
        </h1>
        <p>Descubre eventos y experiencias en el corazón del Imperio Inca.</p>
        <Search />
      </header>
      <main className="page home-content">
        <div className="section-head">
          <h2>
            Próximos <span>eventos</span>
          </h2>
          <Link to="/eventos">Ver todos →</Link>
        </div>
        <Status state={state}>
          {(events) => {
            const now = Date.now();
            const upcoming = [...events].sort((a, b) => {
              const rank = (e) =>
                e.fecha_inicio && new Date(e.fecha_inicio).getTime() >= now
                  ? 0
                  : e.fecha_inicio
                    ? 2
                    : 1;
              return (
                rank(a) - rank(b) ||
                new Date(a.fecha_inicio || 8640000000000000) -
                  new Date(b.fecha_inicio || 8640000000000000)
              );
            });
            return <Cards events={upcoming.slice(0, 6)} />;
          }}
        </Status>
        <h2>Encuentra tu experiencia</h2>
        <div className="category-grid">
          {categories.map((c) => (
            <Link to={"/categoria/" + c.slug} key={c._id}>
              <span>{c.emoji}</span>
              <strong>{c.nombre}</strong>
              <small>Explorar →</small>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}
function Cards({ events }) {
  if (!events.length)
    return <p className="notice">No hay eventos para mostrar.</p>;
  return (
    <div className="cards">
      {events.map((e) => (
        <Card event={e} key={e._id} />
      ))}
    </div>
  );
}
function Card({ event: e }) {
  const { favorites, toggle } = useApp(),
    liked = favorites.some((x) => x._id === e._id);
  return (
    <article className="event-card">
      <div className="card-image">
        {e.imagen ? (
          <img loading="lazy" src={e.imagen} alt={e.titulo} />
        ) : (
          <div className="placeholder">{e.categoria?.emoji || "🎪"}</div>
        )}
        <span className="tag">{e.etiqueta || e.categoria?.nombre}</span>
        <button
          className={"heart " + (liked ? "selected" : "")}
          aria-label={liked ? "Quitar favorito" : "Guardar favorito"}
          aria-pressed={liked}
          onClick={() => toggle(e._id)}
        >
          ♥
        </button>
      </div>
      <div className="card-body">
        <h3>
          <Link to={"/evento/" + e._id}>{e.titulo}</Link>
        </h3>
        <p>📅 {date(e)}</p>
        <p>📍 {e.lugar}</p>
        <strong className="price">
          {e.precio_texto || "Consultar precio"}
        </strong>
        <Link className="button outline" to={"/evento/" + e._id}>
          {e.texto_boton || "Ver detalles"} →
        </Link>
      </div>
    </article>
  );
}
function Catalog() {
  const { slug } = useParams(),
    [params, setParams] = useSearchParams(),
    { categories } = useApp();
  const cat = categories.find((c) => c.slug === slug);
  const query = new URLSearchParams(params);
  if (slug) query.set("category", slug);
  const state = useLoad("/events?" + query.toString());
  function filter(k, v) {
    const q = new URLSearchParams(params);
    v ? q.set(k, v) : q.delete(k);
    setParams(q);
  }
  return (
    <main className="page">
      <header
        className="page-heading"
        style={
          cat?.hero_imagen
            ? {
                backgroundImage: `linear-gradient(90deg,rgba(5,11,20,.9),rgba(5,11,20,.65)),url(${cat.hero_imagen})`,
              }
            : {}
        }
      >
        <p className="eyebrow">DESCUBRE CUSCO</p>
        <h1>
          {cat?.emoji} {cat?.titulo || "Todos los eventos"}
        </h1>
        <p>
          {cat?.descripcion ||
            "Encuentra música, cultura y momentos para compartir."}
        </p>
        <Search key={params.get("q")} initial={params.get("q") || ""} />
      </header>
      <div className="filters">
        <Link className={!slug ? "chip active" : "chip"} to="/eventos">
          Todos
        </Link>
        {categories.map((c) => (
          <Link
            className={"chip " + (slug === c.slug ? "active" : "")}
            key={c._id}
            to={"/categoria/" + c.slug}
          >
            {c.emoji} {c.nombre}
          </Link>
        ))}
      </div>
      <div className="filters">
        <button
          className={"chip " + (params.get("free") === "1" ? "active" : "")}
          onClick={() => filter("free", params.get("free") ? "" : "1")}
        >
          Entrada libre
        </button>
        {cat?.subcategorias
          .filter((s) => s.filtro !== "gratis")
          .map((s) => (
            <button
              key={s.legacyId}
              className={
                "chip " +
                (params.get("sub") === String(s.legacyId) ? "active" : "")
              }
              onClick={() =>
                filter(
                  "sub",
                  params.get("sub") === String(s.legacyId) ? "" : s.legacyId,
                )
              }
            >
              {s.emoji} {s.nombre}
            </button>
          ))}
      </div>
      <Status state={state}>
        {(events) => (
          <>
            <p className="muted">{events.length} resultados</p>
            <Cards events={events} />
          </>
        )}
      </Status>
    </main>
  );
}
function Favorites() {
  const { favorites } = useApp();
  return (
    <main className="page">
      <h1>Mis favoritos ♥</h1>
      <p className="muted">
        Guarda las experiencias que quieres vivir. Se conservan en este
        navegador durante la sesión de visitante.
      </p>
      <Cards events={favorites} />
    </main>
  );
}
function Detail() {
  const { id } = useParams(),
    state = useLoad("/events/" + id),
    { setMessage } = useApp();
  return (
    <main className="page">
      <Status state={state}>
        {(e) => (
          <>
            <Link to={"/categoria/" + e.categoria.slug}>
              ← {e.categoria.nombre}
            </Link>
            <div className="detail-grid">
              <article>
                {e.imagen && (
                  <img className="detail-cover" src={e.imagen} alt={e.titulo} />
                )}
                <p className="eyebrow">{e.etiqueta}</p>
                <h1>{e.titulo}</h1>
                <p className="description">{e.descripcion}</p>
                {e.galeria?.length > 0 && (
                  <div className="gallery">
                    {e.galeria.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noreferrer">
                        <img
                          src={url}
                          loading="lazy"
                          alt={`${e.titulo} — foto ${i + 1}`}
                        />
                      </a>
                    ))}
                  </div>
                )}
                <h2>Ubicación</h2>
                <p>{e.lugar}</p>
                <LeafletLocation value={e} />
                <Weather event={e} />
              </article>
              <aside className="box event-info">
                <p>📅 {date(e)}</p>
                <p>📍 {e.lugar}</p>
                <strong className="price">
                  {e.precio_texto || "Consultar precio"}
                </strong>
                <p>{e.visitas} visitas</p>
                <Link to={"/perfil/" + e.organizador._id}>
                  {e.organizador.nombre} {e.organizador.verificado ? "✓" : ""}
                </Link>
                <p className="muted">{e.organizador.descripcion}</p>
                <a
                  className="button whatsapp"
                  href={`https://wa.me/${e.whatsapp.replace(/\D/g, "")}?text=${encodeURIComponent("Hola, quiero información sobre " + e.titulo)}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => {
                    api("/events/" + id + "/whatsapp", {
                      method: "POST",
                      body: {},
                    }).catch(() => {});
                  }}
                >
                  Contactar por WhatsApp
                </a>
                <button
                  className="button outline"
                  onClick={async () => {
                    try {
                      if (navigator.share)
                        await navigator.share({
                          title: e.titulo,
                          url: location.href,
                        });
                      else {
                        await navigator.clipboard.writeText(location.href);
                        setMessage("Enlace copiado.");
                      }
                    } catch (err) {
                      if (err.name !== "AbortError")
                        setMessage(
                          "No se pudo compartir. Puedes copiar la dirección del navegador.",
                        );
                    }
                  }}
                >
                  Compartir evento
                </button>
              </aside>
            </div>
            <Comments event={e} />
          </>
        )}
      </Status>
    </main>
  );
}
function Weather({ event: e }) {
  const [weather, set] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) return;
    const controller = new AbortController();
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${e.lat}&longitude=${e.lng}&current=temperature_2m&timezone=America%2FLima`,
      { signal: controller.signal },
    )
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then(set)
      .catch((err) => {
        if (err.name !== "AbortError") setError("Clima no disponible.");
      });
    return () => controller.abort();
  }, [e.lat, e.lng]);
  if (!weather && !error) return null;
  return (
    <div className="notice">
      {weather
        ? `🌤 Temperatura actual: ${weather.current.temperature_2m} °C. Referencia de hoy, no un pronóstico del evento. Fuente: Open-Meteo.`
        : error}
    </div>
  );
}
function Comments({ event: e }) {
  const [comments, setComments] = useState(e.comentarios),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    const form = ev.currentTarget;
    try {
      const c = await api("/events/" + e._id + "/comments", {
        method: "POST",
        body: Object.fromEntries(new FormData(form)),
      });
      setComments([c, ...comments]);
      form.reset();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="comments">
      <h2>Comentarios</h2>
      <form className="box" onSubmit={submit}>
        <label>
          Tu nombre
          <input name="nombre" required minLength={2} maxLength={80} />
        </label>
        <label>
          Comentario
          <textarea name="texto" required minLength={3} maxLength={600} />
        </label>
        <FormError error={error} />
        <button disabled={busy}>
          {busy ? "Publicando…" : "Publicar comentario"}
        </button>
      </form>
      {comments.map((c) => (
        <article className="comment" key={c._id}>
          <strong>{c.nombre}</strong>
          <small>{new Date(c.createdAt).toLocaleDateString("es-PE")}</small>
          <p>{c.texto}</p>
        </article>
      ))}
    </section>
  );
}
function Protected({ children }) {
  const { session } = useApp();
  return session.user ? children : <Navigate to="/login" replace />;
}
function Auth({ register = false }) {
  const { setSession, refresh, session } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    navigate = useNavigate();
  if (session.user) return <Navigate to="/panel" replace />;
  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await api(register ? "/register" : "/login", {
        method: "POST",
        body: Object.fromEntries(new FormData(ev.currentTarget)),
      });
      setSession(result);
      await refresh();
      navigate("/panel");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page narrow">
      <p className="eyebrow">ORGANIZADORES</p>
      <h1>{register ? "Crea tu cuenta" : "Bienvenido de nuevo"}</h1>
      <form className="box" onSubmit={submit}>
        {register && (
          <>
            <label>
              Nombre del organizador
              <input name="nombre" required minLength={2} maxLength={150} />
            </label>
            <label>
              WhatsApp con código de país
              <input
                name="whatsapp"
                type="tel"
                placeholder="51984000001"
                required
                pattern="\+?[0-9]{8,15}"
              />
            </label>
          </>
        )}
        <label>
          Correo electrónico
          <input
            name="email"
            type="email"
            required
            maxLength={150}
            autoComplete="email"
          />
        </label>
        <label>
          Contraseña
          <input
            name="password"
            type="password"
            minLength={register ? 8 : 1}
            maxLength={128}
            required
            autoComplete={register ? "new-password" : "current-password"}
          />
        </label>
        <FormError error={error} />
        <button disabled={busy}>
          {busy ? "Procesando…" : register ? "Registrarme" : "Iniciar sesión"}
        </button>
        <Link to={register ? "/login" : "/registro"}>
          {register ? "Ya tengo cuenta" : "Crear una cuenta"}
        </Link>
        <Link to="/recuperar">¿Olvidaste tu contraseña?</Link>
      </form>
    </main>
  );
}
function Recovery({ reset = false }) {
  const [params] = useSearchParams(),
    [error, setError] = useState(""),
    [result, setResult] = useState(null),
    [busy, setBusy] = useState(false);
  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(new FormData(ev.currentTarget));
      if (reset) body.token = params.get("token");
      setResult(
        await api(reset ? "/reset" : "/recover", { method: "POST", body }),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page narrow">
      <h1>{reset ? "Nueva contraseña" : "Recuperar contraseña"}</h1>
      <form className="box" onSubmit={submit}>
        {reset ? (
          <label>
            Contraseña nueva
            <input
              name="password"
              type="password"
              required
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
            />
          </label>
        ) : (
          <label>
            Correo electrónico
            <input name="email" type="email" required />
          </label>
        )}
        <FormError error={error} />
        <button disabled={busy}>
          {busy
            ? "Procesando…"
            : reset
              ? "Guardar contraseña"
              : "Solicitar enlace"}
        </button>
        {result && (
          <p className="notice">
            {reset
              ? "Contraseña actualizada. Ya puedes iniciar sesión."
              : result.message}
          </p>
        )}
        {result?.demoUrl && (
          <p>
            Modo de desarrollo:{" "}
            <a href={result.demoUrl}>abrir enlace de recuperación</a>
          </p>
        )}
        <Link to="/login">Iniciar sesión</Link>
      </form>
    </main>
  );
}
function Panel() {
  const state = useLoad("/mine"),
    { session, setMessage } = useApp(),
    [removed, setRemoved] = useState([]);
  async function remove(id) {
    if (!confirm("¿Eliminar este evento de forma permanente?")) return;
    try {
      await api("/events/" + id, { method: "DELETE" });
      setRemoved([...removed, id]);
      setMessage("Evento eliminado.");
    } catch (e) {
      setMessage(e.message);
    }
  }
  return (
    <main className="page">
      <div className="section-head">
        <div>
          <p className="eyebrow">PANEL DEL ORGANIZADOR</p>
          <h1>Hola, {session.user.nombre}</h1>
        </div>
        <Link className="button" to="/publicar">
          + Publicar evento
        </Link>
      </div>
      <div className="filters">
        <Link to="/mi-perfil">Editar mi perfil</Link>
        <Link to={"/perfil/" + session.user._id}>Ver perfil público ↗</Link>
      </div>
      <Status state={state}>
        {(all) => {
          const events = all.filter((e) => !removed.includes(e._id));
          return (
            <>
              <div className="stats">
                <div>
                  <strong>{events.length}</strong> eventos
                </div>
                <div>
                  <strong>{events.reduce((s, e) => s + e.visitas, 0)}</strong>{" "}
                  visitas
                </div>
                <div>
                  <strong>
                    {events.reduce((s, e) => s + e.clics_whatsapp, 0)}
                  </strong>{" "}
                  clics en WhatsApp
                </div>
              </div>
              {!events.length && (
                <p className="notice">
                  Publica tu primer evento para comenzar.
                </p>
              )}
              <div className="manage-list">
                {events.map((e) => (
                  <article className="box manage-item" key={e._id}>
                    <div>
                      <Link to={"/evento/" + e._id}>
                        <h3>{e.titulo}</h3>
                      </Link>
                      <p>
                        {date(e)} · {e.estado}
                      </p>
                    </div>
                    <div className="filters">
                      <Link className="button outline" to={"/editar/" + e._id}>
                        Editar
                      </Link>
                      <button className="danger" onClick={() => remove(e._id)}>
                        Eliminar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          );
        }}
      </Status>
    </main>
  );
}
const blankEvent = {
  titulo: "",
  descripcion: "",
  categoria: "",
  subcategoria_id: null,
  tipo: "evento",
  etiqueta: "",
  fecha_inicio: "",
  fecha_texto: "",
  lugar: "",
  precio_texto: "",
  precio_valor: null,
  whatsapp: "",
  imagen: "",
  lat: null,
  lng: null,
  placeId: "",
};
function localDate(iso) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() - 5 * 3600000)
    .toISOString()
    .slice(0, 16);
}
function EventForm() {
  const { id } = useParams(),
    { session, categories, setMessage } = useApp(),
    navigate = useNavigate();
  const [value, setValue] = useState({
      ...blankEvent,
      whatsapp: session.user.whatsapp,
    }),
    [loading, setLoading] = useState(!!id),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [file, setFile] = useState(null);
  useEffect(() => {
    if (!id) return;
    let active = true;
    api("/mine")
      .then((events) => {
        const e = events.find((x) => x._id === id);
        if (!e) throw Error("No se encontró un evento tuyo con ese ID.");
        if (active)
          setValue({
            ...blankEvent,
            ...e,
            categoria: e.categoria._id,
            fecha_inicio: localDate(e.fecha_inicio),
          });
      })
      .catch((e) => active && setError(e.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);
  const update = (key, v) => setValue((old) => ({ ...old, [key]: v })),
    field = (key, type = "text", extra = {}) => (
      <input
        type={type}
        value={value[key] ?? ""}
        onChange={(ev) => update(key, ev.target.value)}
        {...extra}
      />
    );
  const category = categories.find((c) => c._id === value.categoria);
  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      let imagen = value.imagen;
      if (file) {
        const form = new FormData();
        form.append("imagen", file);
        imagen = (await api("/uploads", { method: "POST", body: form })).url;
      }
      const body = {
        ...value,
        imagen,
        fecha_inicio: value.fecha_inicio
          ? new Date(value.fecha_inicio + ":00-05:00").toISOString()
          : null,
      };
      await api(id ? "/events/" + id : "/events", {
        method: id ? "PUT" : "POST",
        body,
      });
      setMessage(id ? "Cambios guardados." : "Evento publicado.");
      navigate("/panel");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  if (loading) return <main className="page">Cargando evento…</main>;
  return (
    <main className="page form-page">
      <h1>{id ? "Editar evento" : "Publica tu próximo evento"}</h1>
      <form onSubmit={submit} className="box">
        <h2>Información básica</h2>
        <label>
          Nombre del evento
          {field("titulo", "text", {
            required: true,
            minLength: 3,
            maxLength: 180,
          })}
        </label>
        <div className="form-row">
          <label>
            Categoría
            <select
              value={value.categoria}
              required
              onChange={(ev) =>
                setValue({
                  ...value,
                  categoria: ev.target.value,
                  subcategoria_id: null,
                })
              }
            >
              <option value="">Selecciona una categoría</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.emoji} {c.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Subcategoría
            <select
              value={value.subcategoria_id || ""}
              onChange={(ev) =>
                update(
                  "subcategoria_id",
                  ev.target.value ? Number(ev.target.value) : null,
                )
              }
            >
              <option value="">Sin subcategoría</option>
              {category?.subcategorias.map((s) => (
                <option key={s.legacyId} value={s.legacyId}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Tipo
            <select
              value={value.tipo}
              onChange={(ev) => update("tipo", ev.target.value)}
            >
              {["evento", "servicio", "exposicion", "cultural"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label>Etiqueta{field("etiqueta", "text", { maxLength: 60 })}</label>
        </div>
        <label>
          Descripción
          <textarea
            value={value.descripcion}
            onChange={(ev) => update("descripcion", ev.target.value)}
            required
            minLength={10}
            maxLength={10000}
          />
        </label>
        <h2>Fecha, lugar y contacto</h2>
        <div className="form-row">
          <label>
            Fecha y hora en Perú{field("fecha_inicio", "datetime-local")}
          </label>
          <label>
            Disponibilidad / texto alternativo
            {field("fecha_texto", "text", { maxLength: 120 })}
          </label>
        </div>
        <label>
          Dirección o lugar
          {field("lugar", "text", {
            required: true,
            minLength: 3,
            maxLength: 200,
            onChange: (ev) =>
              setValue((old) => ({
                ...old,
                lugar: ev.target.value,
                lat: null,
                lng: null,
                placeId: "",
              })),
          })}
        </label>
        <LeafletLocation
          value={value}
          onChange={(location) => setValue((old) => ({ ...old, ...location }))}
        />
        <label>
          WhatsApp (incluye código de país)
          {field("whatsapp", "tel", {
            required: true,
            pattern: "\\+?[0-9]{8,15}",
          })}
        </label>
        <div className="form-row">
          <label>
            Precio que se mostrará
            {field("precio_texto", "text", {
              placeholder: "Entrada libre / Desde S/ 30",
              maxLength: 80,
            })}
          </label>
          <label>
            Precio numérico (0 = gratis)
            <input
              type="number"
              min="0"
              step="0.01"
              value={value.precio_valor ?? ""}
              onChange={(ev) =>
                update(
                  "precio_valor",
                  ev.target.value === "" ? null : Number(ev.target.value),
                )
              }
            />
          </label>
        </div>
        <h2>Fotografía</h2>
        <label>
          Subir JPG, PNG o WEBP (máximo 5 MB)
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(ev) => setFile(ev.target.files[0] || null)}
          />
        </label>
        <label>
          O usar una imagen por URL HTTPS
          {field("imagen", "text", {
            maxLength: 700,
            placeholder: "https://…",
          })}
        </label>
        {value.imagen && (
          <img
            className="image-preview"
            src={value.imagen}
            alt="Imagen actual"
          />
        )}
        <FormError error={error} />
        <button disabled={busy}>
          {busy
            ? "Guardando…"
            : id
              ? "Guardar cambios"
              : "Publicar evento ahora"}
        </button>
        <Link to="/panel">Cancelar</Link>
      </form>
    </main>
  );
}
function ProfileEdit() {
  const { session, refresh, setMessage } = useApp(),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(ev) {
    ev.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/profile", {
        method: "PUT",
        body: Object.fromEntries(new FormData(ev.currentTarget)),
      });
      await refresh();
      setMessage("Perfil actualizado.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="page narrow">
      <h1>Mi perfil</h1>
      <form className="box" onSubmit={submit}>
        {[
          ["nombre", "Nombre"],
          ["whatsapp", "WhatsApp"],
          ["ubicacion", "Ubicación"],
          ["instagram", "Instagram"],
          ["facebook", "Facebook"],
          ["tiktok", "TikTok"],
          ["youtube", "YouTube"],
        ].map(([key, title]) => (
          <label key={key}>
            {title}
            <input
              name={key}
              defaultValue={session.user[key] || ""}
              required={["nombre", "whatsapp"].includes(key)}
              maxLength={key === "nombre" ? 150 : 255}
            />
          </label>
        ))}
        <label>
          Descripción
          <textarea
            name="descripcion"
            maxLength={3000}
            defaultValue={session.user.descripcion || ""}
          />
        </label>
        <FormError error={error} />
        <button disabled={busy}>
          {busy ? "Guardando…" : "Guardar perfil"}
        </button>
      </form>
    </main>
  );
}
function PublicProfile() {
  const { id } = useParams(),
    user = useLoad("/organizers/" + id),
    events = useLoad("/events?organizer=" + id);
  return (
    <main className="page">
      <Status state={user}>
        {(u) => (
          <header className="box">
            <p className="eyebrow">
              ORGANIZADOR {u.verificado ? "VERIFICADO ✓" : ""}
            </p>
            <h1>{u.nombre}</h1>
            <p>{u.descripcion}</p>
            <p>📍 {u.ubicacion || "Cusco, Perú"}</p>
            <div className="filters">
              {["instagram", "facebook", "tiktok", "youtube"].map((key) =>
                u[key] && /^https:\/\//i.test(u[key]) ? (
                  <a href={u[key]} key={key} target="_blank" rel="noreferrer">
                    {key} ↗
                  </a>
                ) : null,
              )}
            </div>
          </header>
        )}
      </Status>
      <h2>Eventos del organizador</h2>
      <Status state={events}>{(data) => <Cards events={data} />}</Status>
    </main>
  );
}
function About() {
  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">RECIPROCIDAD Y COMUNIDAD</p>
        <h1>Sobre Ayni Cusco</h1>
        <p>
          Conectamos a los organizadores con su público, y a los visitantes con
          la magia de la Ciudad Imperial.
        </p>
      </header>
      <div className="detail-grid">
        <article className="box">
          <h2>Nuestra historia</h2>
          <p>
            Ayni Cusco nació de una idea: reunir en un solo lugar los eventos
            que estaban dispersos en redes sociales y volantes.
          </p>
          <p>
            Los organizadores locales pueden promocionar conciertos, festivales,
            celebraciones y exposiciones, mientras los visitantes descubren
            experiencias para compartir.
          </p>
          <h2>El verdadero Ayni</h2>
          <p>
            Nuestro nombre significa reciprocidad y trabajo en equipo. Apoyamos
            a los artistas y organizadores cusqueños y celebramos nuestra
            cultura.
          </p>
          <Link className="button" to="/eventos">
            Explorar eventos
          </Link>
        </article>
        <img
          className="detail-cover"
          src="https://images.unsplash.com/photo-1526392060635-9d6019884377?w=1000&q=80"
          alt="Cusco"
        />
      </div>
    </main>
  );
}
function History() {
  return (
    <main className="page">
      <header className="page-heading">
        <p className="eyebrow">CULTURA VIVA</p>
        <h1>Historia del Cusco</h1>
        <p>
          Un viaje por la capital histórica del Perú y el corazón del Imperio
          Inca.
        </p>
      </header>
      <img
        className="history-image"
        src="https://images.unsplash.com/photo-1587595431973-160d0d94add1?w=1200&q=80"
        alt="Paisaje y arquitectura andina"
      />
      <div className="timeline">
        {[
          [
            "Siglo XIII",
            "La fundación",
            "Según la tradición, Manco Cápac y Mama Ocllo fundaron Cusco, el «ombligo del mundo».",
          ],
          [
            "Siglo XV",
            "El auge inca",
            "Bajo Pachacútec, Cusco se consolidó como centro político y religioso del Tahuantinsuyo.",
          ],
          [
            "Siglo XVI",
            "La transformación colonial",
            "Tras la llegada de los españoles, templos y casonas coloniales se levantaron sobre construcciones incas.",
          ],
          [
            "1983",
            "Patrimonio de la Humanidad",
            "La UNESCO inscribió la ciudad del Cusco en la Lista del Patrimonio Mundial.",
          ],
        ].map(([year, title, description]) => (
          <article className="box" key={year}>
            <span className="eyebrow">{year}</span>
            <h2>{title}</h2>
            <p>{description}</p>
          </article>
        ))}
      </div>
      <Link className="button" to="/categoria/costumbres-tradiciones">
        Descubre las tradiciones vivas →
      </Link>
    </main>
  );
}
createRoot(document.getElementById("root")).render(<App />);
