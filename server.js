const express = require("express");
const cors    = require("cors");
const bcrypt  = require("bcryptjs");
const jwt     = require("jsonwebtoken");
const { Pool } = require("pg");

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "segredo_muito_secreto_mudar_isto";

// ── Base de dados ──────────────────────────────────────────────────────────
const db = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

// Criar tabelas se não existirem
async function iniciarDB() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS professores (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      senha TEXT NOT NULL,
      escola TEXT,
      disciplina TEXT,
      criado_em TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS planos (
      id SERIAL PRIMARY KEY,
      professor_id INTEGER REFERENCES professores(id) ON DELETE CASCADE,
      tema TEXT,
      disciplina TEXT,
      classe TEXT,
      dados JSONB,
      criado_em TIMESTAMP DEFAULT NOW()
    );
  `);
  console.log("Base de dados pronta.");
}
iniciarDB();

// ── Middleware ─────────────────────────────────────────────────────────────
app.use(cors({
  origin: [
    "https://fica-eng.github.io",
    "https://fica-eng.github.io/gerador-de-planos-de-aulas/",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ]
}));
app.use(express.json({ limit: "10mb" }));

// Middleware de autenticação JWT
function autenticar(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token em falta." });
  try {
    req.professor = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado." });
  }
}

// ── Rotas de autenticação ──────────────────────────────────────────────────

// REGISTO
app.post("/registar", async (req, res) => {
  const { nome, email, senha, escola, disciplina } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Nome, email e senha são obrigatórios." });
  try {
    const existe = await db.query("SELECT id FROM professores WHERE email = $1", [email]);
    if (existe.rows.length > 0)
      return res.status(400).json({ erro: "Este email já está registado." });

    const hash = await bcrypt.hash(senha, 10);
    const result = await db.query(
      "INSERT INTO professores (nome, email, senha, escola, disciplina) VALUES ($1,$2,$3,$4,$5) RETURNING id, nome, email, escola, disciplina",
      [nome, email, hash, escola||"", disciplina||""]
    );
    const professor = result.rows[0];
    const token = jwt.sign({ id: professor.id, nome: professor.nome, email: professor.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, professor });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao registar: " + err.message });
  }
});

// LOGIN
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Email e senha são obrigatórios." });
  try {
    const result = await db.query("SELECT * FROM professores WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(401).json({ erro: "Email ou senha incorrectos." });

    const professor = result.rows[0];
    const senhaCorrecta = await bcrypt.compare(senha, professor.senha);
    if (!senhaCorrecta)
      return res.status(401).json({ erro: "Email ou senha incorrectos." });

    const token = jwt.sign({ id: professor.id, nome: professor.nome, email: professor.email }, JWT_SECRET, { expiresIn: "7d" });
    res.json({ token, professor: { id: professor.id, nome: professor.nome, email: professor.email, escola: professor.escola, disciplina: professor.disciplina } });
  } catch (err) {
    res.status(500).json({ erro: "Erro ao fazer login: " + err.message });
  }
});

// PERFIL
app.get("/perfil", autenticar, async (req, res) => {
  try {
    const result = await db.query("SELECT id, nome, email, escola, disciplina, criado_em FROM professores WHERE id = $1", [req.professor.id]);
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Rota de geração (protegida) ────────────────────────────────────────────
app.post("/gerar", autenticar, async (req, res) => {
  try {
    const body = { ...req.body, max_tokens: Math.min(req.body.max_tokens || 8000, 8000) };

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Guardar plano ──────────────────────────────────────────────────────────
app.post("/guardar-plano", autenticar, async (req, res) => {
  const { tema, disciplina, classe, dados } = req.body;
  try {
    await db.query(
      "INSERT INTO planos (professor_id, tema, disciplina, classe, dados) VALUES ($1,$2,$3,$4,$5)",
      [req.professor.id, tema, disciplina, classe, JSON.stringify(dados)]
    );
    res.json({ sucesso: true });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Listar planos do professor ─────────────────────────────────────────────
app.get("/meus-planos", autenticar, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, tema, disciplina, classe, criado_em FROM planos WHERE professor_id = $1 ORDER BY criado_em DESC LIMIT 20",
      [req.professor.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── Verificação ────────────────────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", mensagem: "Servidor do Gerador de Plano de Aula activo." });
});

app.listen(PORT, () => console.log(`Servidor na porta ${PORT}`));
