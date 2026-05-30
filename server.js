const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    "https://fica-eng.github.io",
    "https://fica-eng.github.io/gerador-de-planos-de-aulas/",
    "http://127.0.0.1:5500",
    "http://localhost:3000",
  ]
}));

// Aumentar limite do body para suportar respostas grandes
app.use(express.json({ limit: "10mb" }));

app.post("/gerar", async (req, res) => {
  try {
    // Garantir que max_tokens nunca passa de 8000
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/", (req, res) => {
  res.json({ status: "ok", mensagem: "Servidor do Gerador de Plano de Aula activo." });
});

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
