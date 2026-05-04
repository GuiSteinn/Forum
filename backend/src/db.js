import pg from "pg";

const { Pool } = pg;
const useMemoryDatabase = !process.env.DATABASE_URL || process.env.DATABASE_URL === "memory";

export const pool = useMemoryDatabase
  ? null
  : new Pool({
      connectionString: process.env.DATABASE_URL,
      max: Number(process.env.DB_POOL_SIZE || 10),
      idleTimeoutMillis: 30000
    });

let posts = [
  {
    id: 1,
    title: "Como explicar balanceadores de carga no video?",
    author: "Ana",
    content: "Nossa ideia e mostrar o frontend e o backend rodando em pods diferentes, cada um atras de um LoadBalancer.",
    votes: 8,
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    title: "Kubernetes no EKS",
    author: "Bruno",
    content: "Estamos usando manifests simples para mostrar Deployments, Services e replicas da aplicacao.",
    votes: 5,
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    title: "Persistencia com Postgres",
    author: "Carla",
    content: "O banco guarda posts e comentarios para provar que os dados continuam existindo mesmo quando a API reinicia.",
    votes: 3,
    created_at: new Date().toISOString()
  }
];

let comments = [];
let users = [];
let nextPostId = 4;
let nextCommentId = 1;
let nextUserId = 1;

export async function migrate() {
  if (useMemoryDatabase) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      title VARCHAR(160) NOT NULL,
      author VARCHAR(80) NOT NULL,
      content TEXT NOT NULL,
      votes INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(80) NOT NULL,
      email VARCHAR(160) NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS comments (
      id SERIAL PRIMARY KEY,
      post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
      author VARCHAR(80) NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM posts");
  if (rows[0].total === 0) {
    await pool.query(
      `INSERT INTO posts (title, author, content, votes)
       VALUES
       ($1, $2, $3, 8),
       ($4, $5, $6, 5),
       ($7, $8, $9, 3)`,
      [
        "Como explicar balanceadores de carga no video?",
        "Ana",
        "Nossa ideia e mostrar o frontend e o backend rodando em pods diferentes, cada um atras de um LoadBalancer.",
        "Kubernetes no EKS",
        "Bruno",
        "Estamos usando manifests simples para mostrar Deployments, Services e replicas da aplicacao.",
        "Persistencia com Postgres",
        "Carla",
        "O banco guarda posts e comentarios para provar que os dados continuam existindo mesmo quando a API reinicia."
      ]
    );
  }
}

export async function healthCheck() {
  if (useMemoryDatabase) return;
  await pool.query("SELECT 1");
}

export async function listPosts() {
  if (useMemoryDatabase) {
    return posts
      .map((post) => ({
        ...post,
        comments_count: comments.filter((comment) => comment.post_id === post.id).length
      }))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }

  const { rows } = await pool.query(`
    SELECT
      p.id,
      p.title,
      p.author,
      p.content,
      p.votes,
      p.created_at,
      COUNT(c.id)::int AS comments_count
    FROM posts p
    LEFT JOIN comments c ON c.post_id = p.id
    GROUP BY p.id
    ORDER BY p.created_at DESC;
  `);
  return rows;
}

export async function getPost(id) {
  if (useMemoryDatabase) {
    const post = posts.find((item) => item.id === Number(id));
    if (!post) return null;
    return {
      ...post,
      comments: comments.filter((comment) => comment.post_id === post.id)
    };
  }

  const postResult = await pool.query("SELECT * FROM posts WHERE id = $1", [id]);
  if (postResult.rowCount === 0) return null;

  const commentsResult = await pool.query(
    "SELECT * FROM comments WHERE post_id = $1 ORDER BY created_at ASC",
    [id]
  );

  return { ...postResult.rows[0], comments: commentsResult.rows };
}

export async function createPost({ title, author, content }) {
  if (useMemoryDatabase) {
    const post = {
      id: nextPostId++,
      title,
      author,
      content,
      votes: 0,
      created_at: new Date().toISOString()
    };
    posts = [post, ...posts];
    return post;
  }

  const { rows } = await pool.query(
    `INSERT INTO posts (title, author, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [title, author, content]
  );
  return rows[0];
}

export async function createComment({ postId, author, content }) {
  if (useMemoryDatabase) {
    const post = posts.find((item) => item.id === Number(postId));
    if (!post) return null;

    const comment = {
      id: nextCommentId++,
      post_id: Number(postId),
      author,
      content,
      created_at: new Date().toISOString()
    };
    comments.push(comment);
    return comment;
  }

  const { rows } = await pool.query(
    `INSERT INTO comments (post_id, author, content)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [postId, author, content]
  );
  return rows[0];
}

export async function votePost({ postId, direction }) {
  const voteChange = direction === "down" ? -1 : 1;

  if (useMemoryDatabase) {
    const post = posts.find((item) => item.id === Number(postId));
    if (!post) return null;
    post.votes += voteChange;
    return post;
  }

  const { rows } = await pool.query(
    "UPDATE posts SET votes = votes + $1 WHERE id = $2 RETURNING *",
    [voteChange, postId]
  );
  return rows[0] || null;
}

export async function createUser({ name, email, passwordHash }) {
  if (useMemoryDatabase) {
    const existingUser = users.find((user) => user.email === email);
    if (existingUser) {
      const error = new Error("Email ja cadastrado");
      error.code = "USER_EXISTS";
      throw error;
    }

    const user = {
      id: nextUserId++,
      name,
      email,
      password_hash: passwordHash,
      created_at: new Date().toISOString()
    };
    users.push(user);
    return sanitizeUser(user);
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO users (name, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id, name, email, created_at`,
      [name, email, passwordHash]
    );
    return rows[0];
  } catch (error) {
    if (error.code === "23505") {
      error.code = "USER_EXISTS";
    }
    throw error;
  }
}

export async function findUserByEmail(email) {
  if (useMemoryDatabase) {
    return users.find((user) => user.email === email) || null;
  }

  const { rows } = await pool.query("SELECT * FROM users WHERE email = $1", [email]);
  return rows[0] || null;
}

function sanitizeUser(user) {
  const { password_hash, ...safeUser } = user;
  return safeUser;
}
