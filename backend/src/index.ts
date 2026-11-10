import express from "express";
import cors from "cors";
import "./db/database";
import authRoutes from "./routes/auth";
import usuariosRoutes from "./routes/usuarios";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/usuarios", usuariosRoutes);

app.get("/", (_req, res) => {
  res.json({ mensaje: "API de Seguridad — NubaGlow App" });
});

const PUERTO = 4000;
app.listen(PUERTO, () => {
  console.log(`Backend de Seguridad corriendo en http://localhost:${PUERTO}`);
});
