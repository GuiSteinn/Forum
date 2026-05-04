import "dotenv/config";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import {
  createUser,
  createComment,
  createPost,
  findUserByEmail,
  getPost,
  healthCheck,
  listPosts,
  migrate,
  votePost
} from "./db.js";

const app = express();
const port = Number(process.env.PORT || 3001);
const authSecret = process.env.AUTH_SECRET || "forum-dev-secret";
const tokenMaxAgeSeconds = Number(process.env.AUTH_TOKEN_MAX_AGE_SECONDS || 60 * 60 * 24);

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email
  };
}

function signToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    exp: Math.floor(Date.now() / 1000) + tokenMaxAgeSeconds
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", authSecret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifyToken(token) {
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", authSecret).update(body).digest("base64url");
  const signatureBuffer = Buffer.from(signature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);
  if (
    signatureBuffer.length !== expectedSignatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedSignatureBuffer)
  ) {
    return null;
  }

  const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    return null;
  }
  return payload;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, passwordHash) {
  const [algorithm, salt, storedHash] = passwordHash.split("$");
  if (algorithm !== "scrypt" || !salt || !storedHash) return false;

  const hash = crypto.scryptSync(password, salt, 64);
  const storedHashBuffer = Buffer.from(storedHash, "hex");
  return storedHashBuffer.length === hash.length && crypto.timingSafeEqual(storedHashBuffer, hash);
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";

  try {
    const user = token ? verifyToken(token) : null;
    if (!user) {
      res.status(401).json({ message: "Login obrigatorio" });
      return;
    }

    req.user = user;
    next();
  } catch {
    res.status(401).json({ message: "Sessao invalida" });
  }
}

app.get("/health", async (_req, res) => {
  try {
    await healthCheck();
    res.json({ status: "ok", service: "forum-backend" });
  } catch {
    res.status(503).json({ status: "error", service: "forum-backend" });
  }
});

app.post("/api/auth/register", async (req, res, next) => {
  try {
    const { name, email, password } = req.body;
    if (!name?.trim() || !email?.trim() || !password) {
      res.status(400).json({ message: "Nome, email e senha sao obrigatorios" });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ message: "A senha precisa ter pelo menos 6 caracteres" });
      return;
    }

    const user = await createUser({
      name: name.trim(),
      email: normalizeEmail(email),
      passwordHash: hashPassword(password)
    });

    res.status(201).json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    if (error.code === "USER_EXISTS") {
      res.status(409).json({ message: "Email ja cadastrado" });
      return;
    }
    next(error);
  }
});

app.post("/api/auth/login", async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      res.status(400).json({ message: "Email e senha sao obrigatorios" });
      return;
    }

    const user = await findUserByEmail(normalizeEmail(email));
    if (!user || !verifyPassword(password, user.password_hash)) {
      res.status(401).json({ message: "Email ou senha invalidos" });
      return;
    }

    res.json({ user: publicUser(user), token: signToken(user) });
  } catch (error) {
    next(error);
  }
});

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: publicUser(req.user) });
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

app.post("/api/posts", requireAuth, async (req, res, next) => {
  try {
    const { title, content } = req.body;
    if (!title?.trim() || !content?.trim()) {
      res.status(400).json({ message: "Titulo e conteudo sao obrigatorios" });
      return;
    }

    const post = await createPost({
      title: title.trim(),
      author: req.user.name,
      content: content.trim()
    });

    res.status(201).json(post);
  } catch (error) {
    next(error);
  }
});

app.post("/api/posts/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const { content } = req.body;
    if (!content?.trim()) {
      res.status(400).json({ message: "Comentario e obrigatorio" });
      return;
    }

    const comment = await createComment({
      postId: req.params.id,
      author: req.user.name,
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

app.post("/api/posts/:id/vote", requireAuth, async (req, res, next) => {
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
