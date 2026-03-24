require('dotenv').config();
const { Telegraf } = require('telegraf');
const { Client } = require('pg');
const express = require('express');

const app = express();
const port = 3000;
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// --- LÓGICA DO BOT (TELEGRAM) ---
function calcularValores(texto) {
    const match = texto.match(/(\d+(?:[.,]\d+)?)/);
    if (!match) return null;
    const bruto = parseFloat(match[0].replace(',', '.'));
    const base = bruto / 1.23;
    const iva = bruto - base;
    return { bruto: bruto.toFixed(2), base: base.toFixed(2), iva: iva.toFixed(2) };
}

bot.on('text', async (ctx) => {
    const valores = calcularValores(ctx.message.text);
    if (!valores) return ctx.reply("❌ Envie: Jantar 25.50");

    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const query = 'INSERT INTO despesas (usuario, descricao, valor_bruto, valor_base, valor_iva) VALUES ($1, $2, $3, $4, $5)';
        await client.query(query, [ctx.from.first_name, ctx.message.text, valores.bruto, valores.base, valores.iva]);
        ctx.reply(`✅ Salvo no Neon!\n💰 Total: ${valores.bruto}€\n📉 Base: ${valores.base}€\n🏛️ IVA: ${valores.iva}€`);
    } catch (err) {
        console.error(err);
        ctx.reply("⚠️ Erro ao salvar no banco.");
    } finally { await client.end(); }
});

// --- LÓGICA DO DASHBOARD (WEB LOCALHOST) ---
app.get('/', async (req, res) => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const result = await client.query('SELECT * FROM despesas ORDER BY data DESC LIMIT 10');
        
        let html = `<h1>📊 EuroTax Dashboard (Localhost)</h1>
                    <table border="1" style="width:100%; text-align:left; border-collapse: collapse;">
                    <tr style="background:#eee;"><th>Data</th><th>Usuário</th><th>Descrição</th><th>Bruto (€)</th><th>Base (€)</th><th>IVA (€)</th></tr>`;
        
        result.rows.forEach(row => {
            html += `<tr>
                <td>${new Date(row.data).toLocaleString()}</td>
                <td>${row.usuario}</td>
                <td>${row.descricao}</td>
                <td>${row.valor_bruto}</td>
                <td>${row.valor_base}</td>
                <td>${row.valor_iva}</td>
            </tr>`;
        });
        html += `</table><p>Mande novas mensagens no Telegram para atualizar!</p>`;
        res.send(html);
    } catch (err) {
        res.send("Erro ao carregar dados: " + err.message);
    } finally { await client.end(); }
});

// Iniciar Bot e Servidor Web
bot.launch();
app.listen(port, () => {
    console.log(`------------------------------------------`);
    console.log(`🤖 BOT ONLINE NO TELEGRAM`);
    console.log(`🌐 DASHBOARD EM: http://localhost:${port}`);
    console.log(`------------------------------------------`);
});