const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

// Permitir pedidos do seu GitHub Pages
app.use(cors({
  origin: [
    "https://fica-eng.github.io",  // o seu GitHub Pages
    "http://127.0.0.1:5500",       // para testes locais
    "http://localhost:3000",
  ]
}));

app.use(express.json());

// Rota principal — recebe o pedido do frontend e chama a Anthropic
app.post("/gerar", async (req, res) => {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY, // chave guardada no Railway
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota de verificação — para confirmar que o servidor está vivo
app.get("/", (req, res) => {
  res.json({ status: "ok", mensagem: "Servidor do Gerador de Plano de Aula activo." });
});

app.listen(PORT, () => {
  console.log(`Servidor a correr na porta ${PORT}`);
});
