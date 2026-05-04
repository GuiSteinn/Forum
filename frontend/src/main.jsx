import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LogIn,
  LogOut,
  MessageCircle,
  Plus,
  RefreshCcw,
  Send,
  Server,
  ThumbsDown,
  ThumbsUp,
  UserPlus
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
const TOKEN_KEY = "forum_token";

async function request(path, options = {}) {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Erro inesperado" }));
    throw new Error(error.message);
  }

  return response.json();
}

function App() {
  const [posts, setPosts] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedPost, setSelectedPost] = useState(null);
  const [status, setStatus] = useState("Carregando forum...");
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authStatus, setAuthStatus] = useState("");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [form, setForm] = useState({ title: "", content: "" });
  const [comment, setComment] = useState({ content: "" });

  const selectedSummary = useMemo(
    () => posts.find((post) => post.id === selectedId),
    [posts, selectedId]
  );

  async function loadPosts() {
    setStatus("Atualizando posts...");
    const data = await request("/api/posts");
    setPosts(data);
    setSelectedId((current) => current || data[0]?.id || null);
    setStatus("Online");
  }

  async function loadPost(id) {
    if (!id) {
      setSelectedPost(null);
      return;
    }
    const data = await request(`/api/posts/${id}`);
    setSelectedPost(data);
  }

  useEffect(() => {
    loadPosts().catch((error) => setStatus(error.message));
  }, []);

  useEffect(() => {
    if (!localStorage.getItem(TOKEN_KEY)) return;

    request("/api/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setUser(null);
      });
  }, []);

  useEffect(() => {
    loadPost(selectedId).catch((error) => setStatus(error.message));
  }, [selectedId]);

  async function createPost(event) {
    event.preventDefault();
    await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setForm({ title: "", content: "" });
    await loadPosts();
  }

  async function vote(direction) {
    if (!selectedId) return;
    await request(`/api/posts/${selectedId}/vote`, {
      method: "POST",
      body: JSON.stringify({ direction })
    });
    await loadPosts();
    await loadPost(selectedId);
  }

  async function createComment(event) {
    event.preventDefault();
    if (!selectedId) return;
    await request(`/api/posts/${selectedId}/comments`, {
      method: "POST",
      body: JSON.stringify(comment)
    });
    setComment({ content: "" });
    await loadPost(selectedId);
    await loadPosts();
  }

  async function authenticate(event) {
    event.preventDefault();
    setAuthStatus("Validando acesso...");
    const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    const payload =
      authMode === "login"
        ? { email: authForm.email, password: authForm.password }
        : authForm;

    try {
      const data = await request(path, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      localStorage.setItem(TOKEN_KEY, data.token);
      setUser(data.user);
      setAuthForm({ name: "", email: "", password: "" });
      setAuthStatus("");
    } catch (error) {
      setAuthStatus(error.message);
    }
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }

  if (!user) {
    return (
      <main className="auth-page">
        <section className="auth-panel">
          <div className="brand auth-brand">
            <Server size={26} />
            <div>
              <strong>Forum Distribuido</strong>
              <span>Acesse para postar, comentar e votar</span>
            </div>
          </div>

          <form className="auth-form" onSubmit={authenticate}>
            <div className="form-title">
              {authMode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
              <strong>{authMode === "login" ? "Entrar" : "Criar conta"}</strong>
            </div>

            {authMode === "register" && (
              <input
                placeholder="Nome"
                value={authForm.name}
                onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
              />
            )}
            <input
              placeholder="Email"
              type="email"
              value={authForm.email}
              onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
            />
            <input
              placeholder="Senha"
              type="password"
              value={authForm.password}
              onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
            />

            {authStatus && <p className="form-status">{authStatus}</p>}
            <button type="submit">
              {authMode === "login" ? <LogIn size={18} /> : <UserPlus size={18} />}
              {authMode === "login" ? "Entrar" : "Cadastrar"}
            </button>
          </form>

          <button
            className="mode-switch"
            onClick={() => {
              setAuthMode(authMode === "login" ? "register" : "login");
              setAuthStatus("");
            }}
          >
            {authMode === "login" ? "Criar uma nova conta" : "Ja tenho uma conta"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <Server size={24} />
          <div>
            <strong>Forum Distribuido</strong>
            <span>{status}</span>
          </div>
        </div>

        <button className="refresh" onClick={() => loadPosts().catch((error) => setStatus(error.message))}>
          <RefreshCcw size={18} />
          Atualizar
        </button>

        <nav className="post-list" aria-label="Posts">
          {posts.map((post) => (
            <button
              className={post.id === selectedId ? "post-link active" : "post-link"}
              key={post.id}
              onClick={() => setSelectedId(post.id)}
            >
              <strong>{post.title}</strong>
              <span>{post.votes} votos · {post.comments_count} comentarios</span>
            </button>
          ))}
        </nav>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <span className="eyebrow">React + Node + Postgres</span>
            <h1>Forum para demonstrar sistemas distribuidos</h1>
          </div>
          <div className="user-menu">
            <span>Ola, {user.name}</span>
            <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">Health check</a>
            <button onClick={logout} title="Sair"><LogOut size={18} /> Sair</button>
          </div>
        </header>

        <div className="workspace">
          <article className="thread">
            {selectedPost ? (
              <>
                <div className="thread-header">
                  <div>
                    <h2>{selectedPost.title}</h2>
                    <p>Publicado por {selectedPost.author}</p>
                  </div>
                  <div className="votes">
                    <button title="Votar positivo" onClick={() => vote("up")}><ThumbsUp size={18} /></button>
                    <strong>{selectedPost.votes}</strong>
                    <button title="Votar negativo" onClick={() => vote("down")}><ThumbsDown size={18} /></button>
                  </div>
                </div>
                <p className="post-body">{selectedPost.content}</p>

                <div className="comments-title">
                  <MessageCircle size={18} />
                  <strong>{selectedPost.comments.length} comentarios</strong>
                </div>

                <div className="comments">
                  {selectedPost.comments.map((item) => (
                    <div className="comment" key={item.id}>
                      <strong>{item.author}</strong>
                      <p>{item.content}</p>
                    </div>
                  ))}
                </div>

                <form className="comment-form" onSubmit={createComment}>
                  <textarea
                    placeholder={`Comentar como ${user.name}`}
                    value={comment.content}
                    onChange={(event) => setComment({ ...comment, content: event.target.value })}
                  />
                  <button type="submit"><Send size={18} /> Comentar</button>
                </form>
              </>
            ) : (
              <p className="empty">Crie o primeiro post para iniciar o forum.</p>
            )}
          </article>

          <form className="new-post" onSubmit={createPost}>
            <div className="form-title">
              <Plus size={18} />
              <strong>Novo post</strong>
            </div>
            <input
              placeholder="Titulo"
              value={form.title}
              onChange={(event) => setForm({ ...form, title: event.target.value })}
            />
            <textarea
              placeholder={`Conteudo por ${user.name}`}
              value={form.content}
              onChange={(event) => setForm({ ...form, content: event.target.value })}
            />
            <button type="submit"><Send size={18} /> Publicar</button>
          </form>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")).render(<App />);
