import "dotenv/config";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import {
  createComment,
  createPost,
  getPost,
  healthCheck,
  listPosts,
  migrate,
  votePost
} from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", async (_req, res) => {
  try {
    await healthCheck();
    res.json({ status: "ok", service: "forum-backend" });
  } catch {
    res.status(503).json({ status: "error", service: "forum-backend" });
  }
});

app.get("/api/posts", async (_req, res, next) => {
  try {
    res.json(await listPosts());
  } catch (error) {
    next(error);
  }
});

app.get("/api/posts/:id", async (req, res, next) => {
  try {
    const post = await getPost(req.params.id);
    if (!post) {
      res.status(404).json({ message: "Post nao encontrado" });
      return;
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts", async (req, res, next) => {
  try {
    const { title, author, content } = req.body;
    if (!title?.trim() || !author?.trim() || !content?.trim()) {
      res.status(400).json({ message: "Titulo, autor e conteudo sao obrigatorios" });
      return;
    }

    const post = await createPost({
      title: title.trim(),
      author: author.trim(),
      content: content.trim()
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts/:id/comments", async (req, res, next) => {
  try {
    const { author, content } = req.body;
    if (!author?.trim() || !content?.trim()) {
      res.status(400).json({ message: "Autor e comentario sao obrigatorios" });
      return;
    }

    const comment = await createComment({
      postId: req.params.id,
      author: author.trim(),
      content: content.trim()
    });

    if (!comment) {
      res.status(404).json({ message: "Post nao encontrado" });
      return;
    }

    res.status(201).json(comment);
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts/:id/vote", async (req, res, next) => {
  try {
    const post = await votePost({
      postId: req.params.id,
      direction: req.body.direction
    });

    if (!post) {
      res.status(404).json({ message: "Post nao encontrado" });
      return;
    }

    res.json(post);
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ message: "Erro interno do servidor" });
});

migrate()
  .then(() => {
    app.listen(port, () => {
      console.log(`Forum backend listening on port ${port}`);
    });
  })
  .catch((error) => {
    console.error("Database migration failed", error);
    process.exit(1);
  });
