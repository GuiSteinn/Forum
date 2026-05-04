import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { MessageCircle, Plus, RefreshCcw, Send, Server, ThumbsDown, ThumbsUp } from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";

async function request(path, options) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
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
  const [form, setForm] = useState({ title: "", author: "", content: "" });
  const [comment, setComment] = useState({ author: "", content: "" });

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
    loadPost(selectedId).catch((error) => setStatus(error.message));
  }, [selectedId]);

  async function createPost(event) {
    event.preventDefault();
    await request("/api/posts", {
      method: "POST",
      body: JSON.stringify(form)
    });
    setForm({ title: "", author: "", content: "" });
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
    setComment({ author: "", content: "" });
    await loadPost(selectedId);
    await loadPosts();
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
          <a href={`${API_URL}/health`} target="_blank" rel="noreferrer">Health check</a>
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
                  <input
                    placeholder="Seu nome"
                    value={comment.author}
                    onChange={(event) => setComment({ ...comment, author: event.target.value })}
                  />
                  <textarea
                    placeholder="Escreva um comentario"
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
            <input
              placeholder="Autor"
              value={form.author}
              onChange={(event) => setForm({ ...form, author: event.target.value })}
            />
            <textarea
              placeholder="Conteudo"
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
