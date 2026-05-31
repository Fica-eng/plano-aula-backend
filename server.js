const express  = require("express");
const cors     = require("cors");
const bcrypt   = require("bcryptjs");
const jwt      = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const crypto   = require("crypto");
const { Pool } = require("pg");

const app        = express();
const PORT       = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "plano_aula_moz_2026_secreto";
const APP_URL    = process.env.APP_URL || "https://fica-eng.github.io/gerador-de-planos-de-aulas";

// Tentar todas as configurações possíveis
const configs = [
  { host:"smtp.gmail.com", port:587, secure:false },
  { host:"smtp.gmail.com", port:465, secure:true  },
  { host:"smtp.gmail.com", port:25,  secure:false },
  { host:"aspmx.l.google.com", port:25, secure:false },
];

function criarTransporter(config) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
}

async function enviarEmailVerificacao(nome, email, token) {
  const link = `${APP_URL}?verificar=${token}`;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <h1 style="color:#1a56db;font-size:22px;margin:0">📋 Gerador de Plano de Aula</h1>
        <p style="color:#666;font-size:13px;margin-top:6px">Plataforma para professores moçambicanos</p>
      </div>
      <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
        <p style="font-size:15px;color:#333">Olá, <b>${nome}</b>!</p>
        <p style="font-size:14px;color:#555;margin-top:8px">
          Obrigado por se registar. Clique no botão abaixo para confirmar o seu email e activar a sua conta.
        </p>
        <div style="text-align:center;margin:28px 0">
          <a href="${link}" style="background:#1a56db;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">
            ✅ Confirmar Email
          </a>
        </div>
        <p style="font-size:12px;color:#888;text-align:center">
          O link expira em <b>24 horas</b>.
        </p>
      </div>
    </div>`;

  // Tentar cada configuração até uma funcionar
  let ultimoErro = null;
  for (const config of configs) {
    try {
      console.log(`🔄 Tentando ${config.host}:${config.port}...`);
      const transporter = criarTransporter(config);
      await transporter.verify();
      await transporter.sendMail({
        from: `"Gerador de Plano de Aula" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "✅ Confirme o seu email — Gerador de Plano de Aula",
        html,
      });
      console.log(`✅ Email enviado via ${config.host}:${config.port}`);
      return; // sucesso — sair
    } catch (err) {
      console.error(`❌ Falhou ${config.host}:${config.port} — ${err.message}`);
      ultimoErro = err;
    }
  }
  throw ultimoErro;
}

// ── Base de dados ──────────────────────────────────────────────────────────
const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function iniciarDB() {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS professores (
        id SERIAL PRIMARY KEY,
        nome TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        senha TEXT NOT NULL,
        escola TEXT DEFAULT '',
        disciplina TEXT DEFAULT '',
        verificado BOOLEAN DEFAULT FALSE,
        token_verificacao TEXT,
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

    // Migração — adicionar colunas se não existirem
    await db.query(`ALTER TABLE professores ADD COLUMN IF NOT EXISTS verificado BOOLEAN DEFAULT FALSE`);
    await db.query(`ALTER TABLE professores ADD COLUMN IF NOT EXISTS token_verificacao TEXT`);
    await db.query(`UPDATE professores SET verificado = TRUE WHERE verificado IS NULL OR verificado = FALSE`);

    console.log("✅ Base de dados pronta.");
  } catch (err) {
    console.error("❌ Erro DB:", err.message);
  }
}
iniciarDB();

// ── Email ──────────────────────────────────────────────────────────────────
async function enviarEmailVerificacao(nome, email, token) {
  const link = `${APP_URL}?verificar=${token}`;
  try {
    const { data, error } = await resend.emails.send({
      from: "Gerador de Plano de Aula <onboarding@resend.dev>",
      to: email,
      subject: "✅ Confirme o seu email — Gerador de Plano de Aula",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:24px;background:#f9fafb;border-radius:12px">
          <div style="text-align:center;margin-bottom:24px">
            <h1 style="color:#1a56db;font-size:22px;margin:0">📋 Gerador de Plano de Aula</h1>
            <p style="color:#666;font-size:13px;margin-top:6px">Plataforma para professores moçambicanos</p>
          </div>
          <div style="background:#fff;border-radius:10px;padding:24px;border:1px solid #e5e7eb">
            <p style="font-size:15px;color:#333">Olá, <b>${nome}</b>!</p>
            <p style="font-size:14px;color:#555;margin-top:8px">
              Obrigado por se registar. Clique no botão abaixo para confirmar o seu email e activar a sua conta.
            </p>
            <div style="text-align:center;margin:28px 0">
              <a href="${link}" style="background:#1a56db;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-size:15px;font-weight:bold">
                ✅ Confirmar Email
              </a>
            </div>
            <p style="font-size:12px;color:#888;text-align:center">
              Se não se registou, ignore este email.<br/>
              O link expira em <b>24 horas</b>.
            </p>
          </div>
          <p style="font-size:11px;color:#aaa;text-align:center;margin-top:16px">
            © 2026 Gerador de Plano de Aula — Moçambique
          </p>
        </div>
      `,
    });
    if (error) throw new Error(JSON.stringify(error));
    console.log(`✅ Email enviado para ${email}:`, data?.id);
  } catch (err) {
    console.error(`❌ Erro email para ${email}:`, err.message);
    throw err;
  }
}

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

function autenticar(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ erro: "Token em falta." });
  try {
    req.professor = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ erro: "Token inválido ou expirado. Faça login novamente." });
  }
}

// ── REGISTO ────────────────────────────────────────────────────────────────
app.post("/registar", async (req, res) => {
  const { nome, email, senha, escola, disciplina } = req.body;
  if (!nome || !email || !senha)
    return res.status(400).json({ erro: "Nome, email e senha são obrigatórios." });
  try {
    const existe = await db.query("SELECT id FROM professores WHERE email = $1", [email]);
    if (existe.rows.length > 0)
      return res.status(400).json({ erro: "Este email já está registado." });

    const hash  = await bcrypt.hash(senha, 10);
    const token = crypto.randomBytes(32).toString("hex");

    await db.query(
      `INSERT INTO professores (nome, email, senha, escola, disciplina, verificado, token_verificacao)
       VALUES ($1,$2,$3,$4,$5,FALSE,$6)`,
      [nome, email, hash, escola||"", disciplina||"", token]
    );

    // Responder imediatamente — não bloquear à espera do email
    res.json({ mensagem: "Registo feito com sucesso! Verifique o seu email para activar a conta." });

    // Enviar email em background
    enviarEmailVerificacao(nome, email, token)
      .then(() => console.log(`✅ Email enviado para ${email}`))
      .catch(err => console.error(`❌ Erro email para ${email}:`, err.message));

  } catch (err) {
    res.status(500).json({ erro: "Erro ao registar: " + err.message });
  }
});

// ── VERIFICAR EMAIL ────────────────────────────────────────────────────────
app.get("/verificar/:token", async (req, res) => {
  const { token } = req.params;
  try {
    const result = await db.query(
      "SELECT id, nome, email, escola, disciplina FROM professores WHERE token_verificacao = $1",
      [token]
    );
    if (result.rows.length === 0)
      return res.status(400).json({ erro: "Link inválido ou já utilizado." });

    const professor = result.rows[0];
    await db.query(
      "UPDATE professores SET verificado = TRUE, token_verificacao = NULL WHERE id = $1",
      [professor.id]
    );

    const jwtToken = jwt.sign(
      { id: professor.id, nome: professor.nome, email: professor.email },
      JWT_SECRET, { expiresIn: "7d" }
    );

    // Redirecionar para o site com token
    res.redirect(`${APP_URL}?login_token=${jwtToken}&nome=${encodeURIComponent(professor.nome)}&email=${encodeURIComponent(professor.email)}&escola=${encodeURIComponent(professor.escola||"")}&disciplina=${encodeURIComponent(professor.disciplina||"")}`);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── LOGIN ──────────────────────────────────────────────────────────────────
app.post("/login", async (req, res) => {
  const { email, senha } = req.body;
  if (!email || !senha)
    return res.status(400).json({ erro: "Email e senha são obrigatórios." });
  try {
    const result = await db.query("SELECT * FROM professores WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(401).json({ erro: "Email ou senha incorrectos." });

    const professor = result.rows[0];

    if (!professor.verificado)
      return res.status(401).json({ erro: "Por favor confirme o seu email antes de fazer login. Verifique a sua caixa de entrada.", naoVerificado: true });

    const ok = await bcrypt.compare(senha, professor.senha);
    if (!ok)
      return res.status(401).json({ erro: "Email ou senha incorrectos." });

    const token = jwt.sign(
      { id: professor.id, nome: professor.nome, email: professor.email },
      JWT_SECRET, { expiresIn: "7d" }
    );
    res.json({
      token,
      professor: { id: professor.id, nome: professor.nome, email: professor.email, escola: professor.escola, disciplina: professor.disciplina }
    });
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── REENVIAR EMAIL ─────────────────────────────────────────────────────────
app.post("/reenviar-verificacao", async (req, res) => {
  const { email } = req.body;
  try {
    const result = await db.query("SELECT * FROM professores WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ erro: "Email não encontrado." });

    const professor = result.rows[0];
    if (professor.verificado)
      return res.status(400).json({ erro: "Este email já foi verificado." });

    const token = crypto.randomBytes(32).toString("hex");
    await db.query("UPDATE professores SET token_verificacao = $1 WHERE id = $2", [token, professor.id]);

    // Responder imediatamente
    res.json({ mensagem: "Email de verificação reenviado com sucesso." });

    // Enviar em background
    enviarEmailVerificacao(professor.nome, professor.email, token)
      .then(() => console.log(`✅ Email reenviado para ${email}`))
      .catch(err => console.error(`❌ Erro reenvio para ${email}:`, err.message));

  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── PERFIL ─────────────────────────────────────────────────────────────────
app.get("/perfil", autenticar, async (req, res) => {
  try {
    const result = await db.query(
      "SELECT id, nome, email, escola, disciplina, criado_em FROM professores WHERE id = $1",
      [req.professor.id]
    );
    if (result.rows.length === 0)
      return res.status(404).json({ erro: "Professor não encontrado." });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── GERAR PLANO ────────────────────────────────────────────────────────────
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

// ── GUARDAR PLANO ──────────────────────────────────────────────────────────
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

// ── LISTAR PLANOS ──────────────────────────────────────────────────────────
app.get("/meus-planos", autenticar, async (req, res) => {
  try {
    const result = await db.query(
      `SELECT id, tema, disciplina, classe, criado_em FROM planos
       WHERE professor_id = $1 ORDER BY criado_em DESC LIMIT 20`,
      [req.professor.id]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ erro: err.message });
  }
});

// ── TESTE DE EMAIL ─────────────────────────────────────────────────────────
app.get("/teste-email/:email", async (req, res) => {
  try {
    await transporter.verify();
    console.log("✅ Ligação SMTP verificada");
    await transporter.sendMail({
      from: `"Teste" <${process.env.EMAIL_USER}>`,
      to: req.params.email,
      subject: "Teste de email — Gerador de Plano de Aula",
      text: "Se recebeu este email, o sistema está a funcionar correctamente!",
    });
    res.json({ sucesso: true, mensagem: `Email enviado para ${req.params.email}` });
  } catch (err) {
    console.error("❌ Erro teste email:", err);
    res.status(500).json({ erro: err.message, codigo: err.code, resposta: err.response });
  }
});
  res.json({ status: "ok", mensagem: "Servidor do Gerador de Plano de Aula activo." });
});

app.listen(PORT, () => console.log(`🚀 Servidor na porta ${PORT}`));
